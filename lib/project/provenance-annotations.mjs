// Stamps deterministic `@generated`, `@knowledge-release`, and order-independent
// Plan-A `@knowledge <stableId>@<elementHash16>` provenance annotations onto
// generated Scala and Protobuf plan entries while keeping every byte-exact
// `codeMappings` span valid.
import { createHash } from 'node:crypto';
import { resolveSourcePointer } from '../source-index.mjs';

const stableJson = value => {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stableJson(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
};

const hash16 = value => createHash('sha256').update(value).digest('hex').slice(0, 16);

function getByPointer(root, pointer) {
  if (!pointer || pointer === '') return root;
  const parts = pointer.slice(1).split('/').map(p => p.replaceAll('~1', '/').replaceAll('~0', '~'));
  let cur = root;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = Array.isArray(cur) ? cur[Number(part)] : cur[part];
  }
  return cur;
}

function extractGuardStableId(guardNode, fallbackHash) {
  if (typeof guardNode === 'string') {
    const m = /\b(?:reject|succeed-empty)\s+([A-Za-z0-9_.-]+)/.exec(guardNode);
    if (m) return m[1];
  } else if (guardNode && typeof guardNode === 'object') {
    const code = guardNode.id ?? guardNode.ruleId ?? guardNode.code ?? guardNode.ref ?? guardNode.name;
    if (typeof code === 'string' && code.trim()) return code.trim();
  }
  return 'guard-' + fallbackHash.slice(0, 8);
}

function resolveStableKnowledgeTag(knowledgeKey, { canonical, sourceIndex, canonicalId }) {
  const prefix = 'source:' + canonicalId + '#';
  if (!knowledgeKey.startsWith(prefix)) return null;
  const pointer = knowledgeKey.slice(prefix.length);
  const node = getByPointer(canonical, pointer);
  const elementHash = hash16(node === undefined ? pointer : stableJson(node));
  const system = sourceIndex?.system || canonical?.workshop || canonicalId;
  const context = sourceIndex?.context || canonical?.context || '';

  const guardMatch = /^\/aggregates\/(\d+)\/commands\/(\d+)\/guards\/(\d+)$/.exec(pointer);
  if (guardMatch) {
    const agg = canonical?.aggregates?.[Number(guardMatch[1])];
    const cmd = agg?.commands?.[Number(guardMatch[2])];
    if (agg?.name && cmd?.name) {
      const guardCode = extractGuardStableId(node, elementHash);
      const id = [system, context, 'guard', agg.name, cmd.name, guardCode]
        .filter(Boolean).map(v => encodeURIComponent(String(v))).join('/');
      return `${id}@${elementHash}`;
    }
  }

  const records = sourceIndex ? resolveSourcePointer(sourceIndex, pointer) : [];
  const rec = records[0];
  if (rec?.identity?.startsWith('knowledge:')) {
    const base = rec.identity.slice('knowledge:'.length);
    const suffix = rec.projectionPointer && pointer.startsWith(rec.projectionPointer)
      ? pointer.slice(rec.projectionPointer.length) : '';
    if (!suffix) return `${base}@${elementHash}`;
    const tail = node && typeof node === 'object' && typeof (node.name ?? node.id) === 'string'
      ? '/' + encodeURIComponent(node.name ?? node.id)
      : suffix.replace(/\/\d+/g, '');
    return `${base}${tail}@${elementHash}`;
  }

  // Fallback: never leak positional indices; anchor by canonicalId + content hash.
  const cleanKind = pointer.replace(/\/\d+/g, '').replace(/^\/+/, '') || 'root';
  return `${encodeURIComponent(system)}/${encodeURIComponent(cleanKind)}@${elementHash}`;
}

function rewriteInlineKnowledgeComments(entry, ctx) {
  const prefix = 'source:' + ctx.canonicalId + '#';
  const re = new RegExp(`(// @knowledge )(${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\s\\n]+)`, 'g');
  if (!re.test(entry.content)) return entry;
  re.lastIndex = 0;

  const edits = [];
  const origBytes = Buffer.from(entry.content, 'utf8');
  let out = '';
  let lastCharIdx = 0;
  let match;
  while ((match = re.exec(entry.content)) !== null) {
    const key = match[2];
    const resolved = resolveStableKnowledgeTag(key, ctx);
    if (!resolved) continue;
    const matchStartChar = match.index + match[1].length;
    const matchEndChar = match.index + match[0].length;
    const startByte = Buffer.byteLength(entry.content.slice(0, matchStartChar), 'utf8');
    const endByte = Buffer.byteLength(entry.content.slice(0, matchEndChar), 'utf8');
    const replacementBytesLen = Buffer.byteLength(resolved, 'utf8');
    edits.push({ startByte, endByte, delta: replacementBytesLen - (endByte - startByte) });
    out += entry.content.slice(lastCharIdx, matchStartChar) + resolved;
    lastCharIdx = matchEndChar;
  }
  if (!edits.length) return entry;
  out += entry.content.slice(lastCharIdx);

  const shiftPos = pos => {
    let offset = 0;
    for (const e of edits) {
      if (e.endByte <= pos) offset += e.delta;
      else if (e.startByte < pos) offset += e.delta;
    }
    return pos + offset;
  };

  const newBytes = Buffer.from(out, 'utf8');
  const codeMappings = (entry.codeMappings ?? []).map(m => {
    const spanStart = shiftPos(m.span.start);
    const spanEnd = shiftPos(m.span.end);
    const scopeStart = shiftPos(m.scope.start);
    const scopeEnd = shiftPos(m.scope.end);
    if (origBytes.length < m.span.end) return m;
    return {
      knowledgeKey: m.knowledgeKey,
      span: { start: spanStart, end: spanEnd, text: newBytes.subarray(spanStart, spanEnd).toString('utf8') },
      scope: { start: scopeStart, end: scopeEnd, text: newBytes.subarray(scopeStart, scopeEnd).toString('utf8') },
    };
  });
  return { ...entry, content: out, ...(entry.codeMappings ? { codeMappings } : {}) };
}

function shiftCodeMappings(codeMappings, headerByteLen) {
  if (!Array.isArray(codeMappings) || !codeMappings.length || headerByteLen === 0) return codeMappings;
  return codeMappings.map(m => ({
    knowledgeKey: m.knowledgeKey,
    span: { start: m.span.start + headerByteLen, end: m.span.end + headerByteLen, text: m.span.text },
    scope: { start: m.scope.start + headerByteLen, end: m.scope.end + headerByteLen, text: m.scope.text },
  }));
}

function supportsSlashHeader(filePath) {
  return filePath.endsWith('.scala') || filePath.endsWith('.proto');
}

export function annotateProjectEntries(entries, { generator, canonical, sourceIndex, canonicalId }) {
  const snapshotRaw = String(sourceIndex?.snapshot ?? '').replace(/^sha256:/, '');
  const releaseTag = `${canonicalId}@${snapshotRaw.slice(0, 12) || 'unknown'}`;
  const genHeader = `// @generated by truthsrc ${generator.id}:${generator.version}`;
  const relHeader = `// @knowledge-release ${releaseTag}`;
  const ctx = { canonical, sourceIndex, canonicalId };

  return entries.map(rawEntry => {
    if (!supportsSlashHeader(rawEntry.path)) return rawEntry;
    const entry = rewriteInlineKnowledgeComments(rawEntry, ctx);
    const hasGenHeader = /^\/\/ @generated by /m.test(entry.content.split('\n')[0] ?? '');
    const headerLines = [];
    if (!hasGenHeader) headerLines.push(genHeader);
    headerLines.push(relHeader);

    const hasInlineKnowledge = /\/\/ @knowledge\s+/.test(entry.content);
    if (!hasInlineKnowledge) {
      const keys = [...new Set([
        ...(entry.knowledgeId ? [entry.knowledgeId] : []),
        ...(entry.knowledgeIds ?? []),
      ])];
      const tags = [...new Set(
        keys.map(k => resolveStableKnowledgeTag(k, ctx)).filter(Boolean)
      )].sort();
      for (const tag of tags) headerLines.push(`// @knowledge ${tag}`);
    }

    const prefix = headerLines.join('\n') + '\n';
    const prefixBytes = Buffer.byteLength(prefix, 'utf8');
    return {
      ...entry,
      content: prefix + entry.content,
      ...(entry.codeMappings ? { codeMappings: shiftCodeMappings(entry.codeMappings, prefixBytes) } : {}),
    };
  });
}
