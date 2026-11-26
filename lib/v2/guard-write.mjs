// First-class PreToolUse anti-cheat write guard & Stop/PreToolUse hook scaffolder for co-arising 2.0.
// Physically blocks writes to compiler-owned locked territories (generated-tests, generated-scaffold,
// projections) and enforces @cloze:start(<id>)..@cloze:end(<id>) edit isolation.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

export const DEFAULT_READ_ONLY_SEGMENTS = [
  'generated-tests',
  'generated-scaffold',
  'projections/ac',
  'projections/tables',
];

export const DEFAULT_READ_ONLY_PREFIXES = [
  'projections/ac/',
  'projections/tables/',
  'generated-tests/',
  'generated-scaffold/',
  'generated/',
];

const CLOZE_START_RE = /^\s*(?:\/\/|#|--)\s*@cloze:start\(([^)]+)\)\s*$/u;
const CLOZE_END_RE = /^\s*(?:\/\/|#|--)\s*@cloze:end\(([^)]+)\)\s*$/u;
const CLOZE_ANY_MARKER_RE = /@cloze:(?:start|end)\([^)]+\)/u;

export function parseClozeRanges(sourceText) {
  const lines = sourceText.split('\n');
  const ranges = [];
  let open = null;
  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const startMatch = line.match(CLOZE_START_RE);
    if (startMatch) {
      open = { id: startMatch[1].trim(), startMarkerLine: lineNo, editableStart: lineNo + 1 };
      return;
    }
    const endMatch = line.match(CLOZE_END_RE);
    if (endMatch && open && endMatch[1].trim() === open.id) {
      ranges.push({
        id: open.id,
        startMarkerLine: open.startMarkerLine,
        endMarkerLine: lineNo,
        editableStart: open.editableStart,
        editableEnd: lineNo - 1,
      });
      open = null;
    }
  });
  return ranges;
}

function normalizeRelPath(filePath, rootDir) {
  const abs = resolve(rootDir, filePath);
  const rel = relative(rootDir, abs).split(sep).join('/');
  return { abs, rel };
}

function lineSpanOfSubstring(sourceText, needle) {
  if (!needle) return null;
  const idx = sourceText.indexOf(needle);
  if (idx < 0) return null;
  const startLine = sourceText.slice(0, idx).split('\n').length;
  const endLine = startLine + needle.split('\n').length - 1;
  return { startLine, endLine };
}

function isLockedTerritory(rel, readOnlyPrefixes) {
  for (const prefix of readOnlyPrefixes) {
    const trimmed = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
    if (rel === trimmed || rel.startsWith(`${trimmed}/`)) return true;
  }
  for (const seg of DEFAULT_READ_ONLY_SEGMENTS) {
    if (rel === seg || rel.startsWith(`${seg}/`) || rel.includes(`/${seg}/`) || rel.endsWith(`/${seg}`)) {
      return true;
    }
  }
  return false;
}

function loadPolicyOverrides(rootDir) {
  const policyPath = join(rootDir, '.truthsrc/hooks-policy.json');
  if (!existsSync(policyPath)) return null;
  try {
    return JSON.parse(readFileSync(policyPath, 'utf8'));
  } catch {
    return null;
  }
}

export function evaluateWriteGuard(payload, {
  rootDir = process.cwd(),
  activeCloze = process.env.COARISING_ACTIVE_CLOZE || '',
  readOnlyPrefixes = null,
} = {}) {
  const absRoot = resolve(rootDir);
  const toolInput = payload?.tool_input ?? payload ?? {};
  const filePath = toolInput.file_path ?? toolInput.path ?? '';
  if (!filePath) return { allowed: true };

  const { abs, rel } = normalizeRelPath(filePath, absRoot);
  if (rel.startsWith('..')) return { allowed: true };

  const policy = loadPolicyOverrides(absRoot);
  const effectivePrefixes = readOnlyPrefixes
    ?? policy?.readOnlyPrefixes
    ?? DEFAULT_READ_ONLY_PREFIXES;

  if (isLockedTerritory(rel, effectivePrefixes)) {
    return {
      allowed: false,
      code: 'TERRITORY_LOCKED',
      file: rel,
      reason: `Blocked write to locked territory "${rel}". Projections, generated-tests, and generated-scaffold are compiler-owned read-only artifacts.`,
    };
  }

  if (existsSync(abs)) {
    const current = readFileSync(abs, 'utf8');
    const ranges = parseClozeRanges(current);
    if (ranges.length > 0) {
      const allowedRanges = activeCloze ? ranges.filter(r => r.id === activeCloze) : ranges;
      if (allowedRanges.length === 0) {
        return {
          allowed: false,
          code: 'CLOZE_SLOT_MISMATCH',
          file: rel,
          reason: `File "${rel}" has no @cloze slot matching active COARISING_ACTIVE_CLOZE="${activeCloze}".`,
        };
      }

      let edits = null;
      if (Array.isArray(toolInput.edits)) {
        edits = toolInput.edits;
      } else if (typeof toolInput.old_string === 'string') {
        edits = [{ old_string: toolInput.old_string, new_string: toolInput.new_string ?? '' }];
      }

      if (!edits) {
        return {
          allowed: false,
          code: 'CLOZE_FULL_OVERWRITE_BLOCKED',
          file: rel,
          reason: `Full-file overwrite on @cloze-protected file "${rel}" is forbidden; edit only inside @cloze:start..@cloze:end.`,
        };
      }

      for (const edit of edits) {
        if (CLOZE_ANY_MARKER_RE.test(edit.old_string ?? '') || CLOZE_ANY_MARKER_RE.test(edit.new_string ?? '')) {
          return {
            allowed: false,
            code: 'CLOZE_MARKER_TAMPER',
            file: rel,
            reason: `Modifying or injecting @cloze boundary markers in "${rel}" is forbidden.`,
          };
        }
        const span = lineSpanOfSubstring(current, edit.old_string);
        if (!span) continue;
        const inside = allowedRanges.some(r => span.startLine >= r.editableStart && span.endLine <= r.editableEnd);
        if (!inside) {
          return {
            allowed: false,
            code: 'CLOZE_OUT_OF_BOUNDS',
            file: rel,
            reason: `Edit on "${rel}" lines ${span.startLine}-${span.endLine} falls outside permitted @cloze slot boundaries.`,
          };
        }
      }
    }
  }

  return { allowed: true, file: rel };
}

export function initHooksV2({
  rootDir = process.cwd(),
  bin = 'truthsrc',
  targets = ['typescript'],
  readOnlyPrefixes = DEFAULT_READ_ONLY_PREFIXES,
  force = false,
} = {}) {
  const absRoot = resolve(rootDir);
  const policyPath = join(absRoot, '.truthsrc/hooks-policy.json');
  const claudeSettingsPath = join(absRoot, '.claude/settings.json');

  const written = [];
  const policy = {
    schemaVersion: 'co-arising.hooks-policy/v1',
    readOnlyPrefixes,
    verifyTargets: targets,
    strict: true,
  };
  mkdirSync(dirname(policyPath), { recursive: true });
  writeFileSync(policyPath, JSON.stringify(policy, null, 2) + '\n', 'utf8');
  written.push('.truthsrc/hooks-policy.json');

  let settings = {};
  if (existsSync(claudeSettingsPath) && !force) {
    try {
      settings = JSON.parse(readFileSync(claudeSettingsPath, 'utf8'));
    } catch {
      settings = {};
    }
  }

  const guardCmd = `${bin} guard-write --root .`;
  const verifyCmd = `${bin} verify-v2 --root . --strict --target ${targets.join(',')}`;

  settings.hooks = settings.hooks ?? {};
  settings.hooks.PreToolUse = [
    {
      matcher: 'Edit|Write|MultiEdit',
      hooks: [{ type: 'command', command: guardCmd }],
    },
  ];
  settings.hooks.Stop = [
    {
      hooks: [{ type: 'command', command: verifyCmd }],
    },
  ];

  mkdirSync(dirname(claudeSettingsPath), { recursive: true });
  writeFileSync(claudeSettingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  written.push('.claude/settings.json');

  return {
    schemaVersion: 'co-arising.init-hooks/v1',
    rootDir: absRoot,
    files: written,
    guardCommand: guardCmd,
    stopCommand: verifyCmd,
  };
}
