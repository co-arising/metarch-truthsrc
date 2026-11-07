import assert from 'node:assert/strict';

function matching(text, start) {
  let quote = null, escaped = false, depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return text.slice(start + 1, i);
  }
  return null;
}
function argumentsOf(body) {
  const values = []; let start = 0, depth = 0, quote = null, escaped = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = null; continue; }
    if ('\"\'`'.includes(c)) quote = c;
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ',' && depth === 0) { values.push(body.slice(start, i).trim()); start = i + 1; }
  }
  values.push(body.slice(start).trim()); return values;
}
const literal = text => /^(?:'([^']+)'|"([^"]+)")$/.exec(text)?.slice(1).find(Boolean) ?? null;

export function emittedKinds(file, text) {
  const kinds = new Set(), dynamic = [];
  for (const [token, position] of [['ArtifactAttribution', 0], ['entry', 2]]) {
    const pattern = new RegExp('\\b' + token + '\\s*\\(', 'g');
    for (const match of text.matchAll(pattern)) {
      const before = text.slice(Math.max(0, match.index - 30), match.index);
      if (/function\s*$/.test(before)) continue;
      const body = matching(text, match.index + match[0].lastIndexOf('('));
      if (body === null) { dynamic.push(token + ':unparsed'); continue; }
      const value = argumentsOf(body)[position];
      if (!value) continue;
      const kind = literal(value);
      if (kind) kinds.add(kind); else dynamic.push(token + ':' + value.slice(0, 120));
    }
  }
  // Object-form entries have both an output path/content and a kind. Other domain
  // objects also use `kind`, so only writer-facing neighbours are candidates.
  for (const match of text.matchAll(/\bkind\s*:\s*(['"])([^'"\n]+)\1/g)) {
    const left = text.slice(Math.max(0, match.index - 240), match.index);
    const right = text.slice(match.index, match.index + 240);
    if (/\b(?:path|content)\s*[:,]|\bschemaCategory\s*:|ledgerRow\s*\(/.test(left + right)) kinds.add(match[2]);
  }
  return { kinds: [...kinds].sort(), dynamic: [...new Set(dynamic)].sort() };
}
export function validateOutputVocabulary(catalog, repositories) {
  const diagnostics = [];
  const maps = { js: new Map(), bc: new Map() };
  for (const category of catalog.categories) for (const repo of ['js', 'bc']) for (const kind of category.aliases[repo + 'Kinds']) {
    if (!maps[repo].has(kind)) maps[repo].set(kind, new Set());
    maps[repo].get(kind).add(category.id);
  }
  for (const repo of ['js', 'bc']) for (const file of repositories[repo]?.files ?? []) {
    for (const kind of file.emittedKinds ?? []) {
      const declared = maps[repo].get(kind);
      if (!declared) diagnostics.push({ code: 'UNDOCUMENTED_OUTPUT_KIND', repo, file: file.path, kind });
      else if (!file.categories.some(id => declared.has(id))) diagnostics.push({ code: 'OUTPUT_KIND_CATEGORY', repo, file: file.path, kind });
    }
    if ((file.dynamicKinds?.length ?? 0) && (!file.outputContract || file.outputContract.sourceSha256 !== file.sha256 ||
        !Array.isArray(file.outputContract.categories) || !file.outputContract.categories.length ||
        file.outputContract.categories.some(id => !file.categories.includes(id))))
      diagnostics.push({ code: 'UNREVIEWED_DYNAMIC_OUTPUT', repo, file: file.path });
  }
  return diagnostics;
}
