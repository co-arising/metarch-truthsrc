// Single-source-of-truth introspection, capabilities.lock export, and contract checks for @madpolaris/truthsrc.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { SUPPORTED_S1_PROTOCOLS } from './effect-tck.mjs';

const CORE_V2_CLI_COMMANDS = [
  'init-v2',
  'check-v2',
  'compile-v2',
  'generate-v2',
  'verify-v2',
  'audit-coverage-v2',
  'run-tck-v2',
  'view-v2',
  'atlas-v2',
  'event-matrix-v2',
  'tasks-v2',
  'export-capabilities',
];

function walkFilesByExt(dir, ext, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFilesByExt(full, ext, out);
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      out.push(full);
    }
  }
  return out;
}

function readGitCommit(rootDir) {
  const candidates = ['/Library/Developer/CommandLineTools/usr/bin/git', 'git'];
  for (const bin of candidates) {
    try {
      const sha = execFileSync(bin, ['-C', rootDir, 'rev-parse', 'HEAD'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (sha) return sha;
    } catch {
      // try next git binary
    }
  }
  return null;
}

function collectCliCommands(binText) {
  const found = new Set();
  for (const m of binText.matchAll(/^\s*case\s+'([a-z0-9-]+)':/gmu)) {
    found.add(m[1]);
  }
  return [...found].sort();
}

function collectMcpTools(mcpText) {
  const all = [];
  const seen = new Set();
  for (const m of mcpText.matchAll(/\bT\('([a-z0-9_-]+)'/gu)) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      all.push(m[1]);
    }
  }
  const v2 = all.filter(name => name.startsWith('v2_')).sort();
  const v1 = all.filter(name => !name.startsWith('v2_')).sort();
  return { total: all.length, v1, v2 };
}

function collectSkills(skillsDir) {
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(join(skillsDir, d.name, 'SKILL.md')))
    .map(d => d.name)
    .sort();
}

function collectLibErrorCodes(rootDir) {
  const codes = new Set();
  const files = [
    ...walkFilesByExt(join(rootDir, 'lib', 'ears'), '.mjs'),
    ...walkFilesByExt(join(rootDir, 'lib', 'v2'), '.mjs'),
  ];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\b(?:EARS|V2)_[A-Z0-9_]+\b/gu)) {
      codes.add(m[0]);
    }
  }
  return [...codes].sort();
}

/**
 * Introspect the authoritative CLI, MCP, Skill, Effect-protocol, and diagnostic surface.
 */
export function introspectSurface(rootDir) {
  const absRoot = resolve(rootDir);
  const pkg = JSON.parse(readFileSync(join(absRoot, 'package.json'), 'utf8'));
  const binText = readFileSync(join(absRoot, 'bin', 'truthsrc.js'), 'utf8');
  const mcpText = readFileSync(join(absRoot, 'mcp', 'server.mjs'), 'utf8');
  const effectSchema = JSON.parse(
    readFileSync(join(absRoot, 'schema', 'effect-binding-v2.schema.json'), 'utf8'),
  );

  const cliCommands = collectCliCommands(binText);
  const mcpTools = collectMcpTools(mcpText);
  const skills = collectSkills(join(absRoot, 'skills'));
  const effectProtocols = [...(effectSchema?.properties?.effects?.items?.properties?.protocol?.enum ?? [])].sort();
  const errorCodes = collectLibErrorCodes(absRoot);
  const toolCommit = readGitCommit(absRoot);

  const digestInput = {
    version: pkg.version,
    cliCommands,
    mcpTools,
    skills,
    effectProtocols,
    errorCodes,
  };
  const surfaceSha256 = createHash('sha256').update(JSON.stringify(digestInput)).digest('hex');

  return {
    toolName: pkg.name,
    toolVersion: pkg.version,
    toolCommit,
    nodeEngine: pkg.engines?.node ?? null,
    runtimeDependencies: Object.keys(pkg.dependencies ?? {}).length,
    cliCommands,
    mcpTools,
    skills,
    effectProtocols,
    errorCodes,
    surfaceSha256,
  };
}

/**
 * Export a sanitized, machine-readable `co-arising.capabilities/v1` lock JSON.
 */
export function exportCapabilitiesLock(rootDir, { outFile = null } = {}) {
  const surface = introspectSurface(rootDir);
  const payload = {
    schemaVersion: 'co-arising.capabilities/v1',
    toolName: surface.toolName,
    toolVersion: surface.toolVersion,
    toolCommit: surface.toolCommit,
    nodeEngine: surface.nodeEngine,
    runtimeDependencies: surface.runtimeDependencies,
    cliCommands: surface.cliCommands,
    mcpTools: surface.mcpTools,
    skills: surface.skills,
    effectProtocols: surface.effectProtocols,
    errorCodeCount: surface.errorCodes.length,
    surfaceSha256: surface.surfaceSha256,
    exportedAt: new Date().toISOString(),
  };

  const serialized = JSON.stringify(payload, null, 2) + '\n';
  if (/\/Users\/|\/home\//u.test(serialized)) {
    throw new Error('V2_CAPABILITIES_PATH_LEAK: capabilities payload must not contain local machine paths');
  }
  if (outFile) {
    const absOut = resolve(outFile);
    mkdirSync(dirname(absOut), { recursive: true });
    writeFileSync(absOut, serialized, 'utf8');
  }
  return payload;
}

function checkReadmeParity(absRoot, surface, errors) {
  const expectedTgz = `madpolaris-truthsrc-${surface.toolVersion}.tgz`;
  const mcpCountStr = String(surface.mcpTools.total);
  const v2Skills = ['coarising_distill', 'coarising_cloze_worker', 'coarising_saga_monarch'];

  for (const name of ['README.md', 'README-zh.md']) {
    const text = readFileSync(join(absRoot, name), 'utf8');
    if (!text.includes(expectedTgz)) {
      errors.push(`${name}: missing expected tarball reference ${expectedTgz}`);
    }
    if (text.includes('0.5.0.tgz')) {
      errors.push(`${name}: contains stale 0.5.0.tgz reference`);
    }
    if (!text.includes(mcpCountStr)) {
      errors.push(`${name}: does not mention total MCP tool count (${mcpCountStr})`);
    }
    for (const skill of v2Skills) {
      if (!text.includes(`skills/${skill}/SKILL.md`)) {
        errors.push(`${name}: missing link to skills/${skill}/SKILL.md`);
      }
    }
  }

  const enReadme = readFileSync(join(absRoot, 'README.md'), 'utf8');
  for (const tool of surface.mcpTools.v2) {
    if (!enReadme.includes(tool)) {
      errors.push(`README.md: missing v2 MCP tool "${tool}"`);
    }
  }
}

function checkSkillErrorCodes(absRoot, surface, errors) {
  const realCodes = new Set(surface.errorCodes);
  const mdFiles = walkFilesByExt(join(absRoot, 'skills'), '.md');
  for (const file of mdFiles) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\b((?:EARS|V2)_[A-Z0-9_]+)\b/gu)) {
      const code = m[1];
      if (code.endsWith('_')) continue;
      if (!realCodes.has(code)) {
        errors.push(`${file.slice(absRoot.length + 1)}: references unknown error code "${code}"`);
      }
    }
  }
}

/**
 * Verify single-source-of-truth consistency across CLI, MCP, schemas, skills, and READMEs.
 */
export function checkContracts(rootDir) {
  const absRoot = resolve(rootDir);
  const surface = introspectSurface(absRoot);
  const errors = [];

  checkReadmeParity(absRoot, surface, errors);
  checkSkillErrorCodes(absRoot, surface, errors);

  const schemaProtocols = new Set(surface.effectProtocols);
  for (const proto of SUPPORTED_S1_PROTOCOLS) {
    if (!schemaProtocols.has(proto)) {
      errors.push(`schema/effect-binding-v2.schema.json: missing TCK protocol "${proto}"`);
    }
  }

  const cliSet = new Set(surface.cliCommands);
  for (const cmd of CORE_V2_CLI_COMMANDS) {
    if (!cliSet.has(cmd)) {
      errors.push(`bin/truthsrc.js: missing declared CLI command "${cmd}"`);
    }
  }

  return {
    schemaVersion: 'co-arising.contract-check/v1',
    passed: errors.length === 0,
    summary: {
      toolVersion: surface.toolVersion,
      cliCommands: surface.cliCommands.length,
      mcpTools: surface.mcpTools.total,
      mcpV2Tools: surface.mcpTools.v2.length,
      skills: surface.skills.length,
      effectProtocols: surface.effectProtocols.length,
      errorCodes: surface.errorCodes.length,
      surfaceSha256: surface.surfaceSha256,
    },
    errors,
  };
}
