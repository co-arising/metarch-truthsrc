// shared.mjs — tree atom parsing/serialization shared by compile, decompose & validate.
//
// Design invariants (enforced by the roundtrip gate, see roundtrip.mjs):
//   I1  Byte-deterministic: same tree → byte-identical canonical, always.
//   I2  Roundtrip identity: decompose(compile(tree)) ≡ tree, byte for byte.
//   I3  Payload verbatim: the payload block is the workshop's own JSON, never
//       rewritten, reordered, or annotated by the compiler.
//   I4  No hidden state: everything lives in the tree; canonical.json is a
//       pure projection and safe to delete at any time.

export const STAGE_ORDER = [
  'eventStorming', 'commandStorming', 'aggregateDiscovery', 'subdomainExploration',
  'contextMapping', 'refining', 'storyMapping',
];

export const STAGE_CODE = {
  eventStorming: 'es', commandStorming: 'cs', aggregateDiscovery: 'ad',
  subdomainExploration: 'sd', contextMapping: 'cm', refining: 'rf', storyMapping: 'sm',
};

export const NOTE_TYPES = [
  'event', 'question', 'command', 'role', 'policy', 'aggregate', 'entity',
  'readModel', 'timer', 'externalSystem', 'context', 'subdomain', 'relation', 'field', 'story',
];

// Atom kinds — one file per atom; `kind` is the first header line.
//   note         L1 sticky note (inbox/<stage>/ or aggregates/<slug>/notes/)
//   policy       L1 policy with structured triggers/invokes (policies/)
//   aggregate    solution contract (aggregates/<slug>/aggregate.yaml)
//   slice        one command's vertical slice (aggregates/<slug>/slices/)
//   value-object global VO catalog (value-objects/)
//   read-model   decision view (read-models/)
//   story        user story (stories/)
//   use-cases    single flow-model file (use-cases.yaml)
export const ATOM_KINDS = [
  'note', 'policy', 'aggregate', 'slice', 'value-object', 'read-model', 'story', 'use-cases',
];

export const BANNER = '# ═══ truthsrc atom — hand-editable; contract: SCHEMA.md ═══';

// Deterministic filename slug: camel-case aware (RequestLoan → request-loan),
// same shape as the reference implementation so trees are portable both ways.
export const slug = (s) =>
  String(s)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unnamed';

const unquote = (v) => {
  if (typeof v !== 'string' || !v.startsWith('"')) return v;
  try { return JSON.parse(v); } catch { return v; }
};
const num = (v) => (/^-?\d+$/.test(v) ? Number(v) : v);

/**
 * Parse one atom file. Shape (all YAML-ish, no dependencies):
 *   - comment/blank lines skipped
 *   - scalar header lines:  `key: value` (value: number | "quoted string" | raw)
 *   - nested maps:          `origin:` / `order:` followed by `  key: value` lines
 *                           (value may be an inline JSON array `[A, B]`)
 *   - object lists:         `triggers:` followed by `  - k: v` + `    k: v` rows
 *   - JSON blocks:          `payload:` / `events:` / `extraEvents:` where the first
 *                           indented line is `{` or `[`; continuation lines carry a
 *                           2-space prefix that is stripped; a blank line ends the block.
 * Returns one flat object (header keys + parsed blocks). Throws on malformed lines.
 */
export function parseDoc(text, file = '<atom>') {
  const lines = text.split('\n');
  const doc = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('#') || line.trim() === '') { i++; continue; }
    const m = line.match(/^(\w+):(?: (.*))?$/);
    if (!m) throw new Error(`${file}: malformed line — ${JSON.stringify(line)}`);
    const key = m[1];
    const rest = m[2];
    if (rest !== undefined && rest !== '') { doc[key] = num(unquote(rest)); i++; continue; }
    // Block or nested collection: inspect the following indented lines.
    const sub = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      const l = lines[j];
      if (l.trim() === '') { if (sub.length) break; else continue; }
      if (l.startsWith('  ')) sub.push(l.slice(2));
      else break;
    }
    if (!sub.length) { doc[key] = null; i = j; continue; }
    if (sub[0].startsWith('{') || sub[0].startsWith('[')) {
      // JSON literal block — every continuation line was prefixed with exactly
      // 2 spaces by emitDoc; JSON.stringify output never contains blank lines.
      doc[key] = JSON.parse(sub.join('\n'));
      i = j;
      continue;
    }
    if (sub[0].startsWith('- ')) {
      // List: scalar rows (`- eventStorming`) or object rows
      // (`  - k: v` first line + `    k: v` continuations, e.g. triggers/invokes).
      if (!/- \w+: /.test(sub[0])) {
        doc[key] = sub.map((l) => {
          const sm = l.match(/^- (.*)$/);
          if (!sm) throw new Error(`${file}: malformed list row — ${JSON.stringify(l)}`);
          return num(unquote(sm[1]));
        });
        i = j;
        continue;
      }
      const rows = [];
      let row = null;
      for (const l of sub) {
        const rm = l.match(/^- (\w+): (.*)$/);
        if (rm) { row = { [rm[1]]: num(unquote(rm[2])) }; rows.push(row); continue; }
        const cm = l.replace(/^ {2}/, '').match(/^(\w+): (.*)$/);
        if (!cm || !row) throw new Error(`${file}: malformed list row — ${JSON.stringify(l)}`);
        row[cm[1]] = num(unquote(cm[2]));
      }
      doc[key] = rows;
      i = j;
      continue;
    }
    // Nested map (origin/order): `k: v` or inline `k: [A, B]`.
    const map = {};
    for (const l of sub) {
      const km = l.match(/^(\w+): (.*)$/);
      if (!km) throw new Error(`${file}: malformed map line — ${JSON.stringify(l)}`);
      map[km[1]] = km[2].startsWith('[') ? JSON.parse(km[2]) : num(unquote(km[2]));
    }
    doc[key] = map;
    i = j;
  }
  return doc;
}

/**
 * Serialize one atom to canonical bytes (the exact shape decompose emits).
 *   scalars : ordered [key, value] pairs — value stringified via JSON.stringify
 *             when it is a string that needs quoting is the caller's choice; we
 *             emit strings raw and let parseDoc's unquote handle quoted forms.
 *   nested  : {origin: {...}, order: {commands: [...], ...}} — flat string/number
 *             values, arrays emitted as inline JSON.
 *   objLists: {triggers: [{event, aggregate}], invokes: [...]}
 *   blocks  : {payload, events, extraEvents} — verbatim JSON, 2-space indented.
 */
export function emitDoc({ scalars = [], nested = {}, objLists = {}, blocks = {} }) {
  const L = [BANNER, ''];
  for (const [k, v] of scalars) L.push(`${k}: ${typeof v === 'string' && /^[\w.-]+$/.test(v) ? v : JSON.stringify(v)}`);
  for (const [k, obj] of Object.entries(nested)) {
    L.push(`${k}:`);
    for (const [kk, vv] of Object.entries(obj)) {
      L.push(`  ${kk}: ${Array.isArray(vv) ? JSON.stringify(vv) : vv}`);
    }
  }
  for (const [k, rows] of Object.entries(objLists)) {
    L.push(`${k}:`);
    for (const row of rows) {
      const es = Object.entries(row);
      L.push(`  - ${es[0][0]}: ${es[0][1]}`);
      for (const [kk, vv] of es.slice(1)) L.push(`    ${kk}: ${vv}`);
    }
  }
  for (const [k, v] of Object.entries(blocks)) {
    if (v === undefined) continue;
    const body = JSON.stringify(v, null, 2).split('\n').map((l) => `  ${l}`);
    L.push(`${k}:`, ...body);
  }
  L.push('');
  return L.join('\n');
}

// Back-compat aliases (v0.1 API): single-payload atoms.
export const parseAtom = parseDoc;
export function emitAtom({ kind, type, name, origin, payload }) {
  return emitDoc({
    scalars: [['kind', kind], ['type', type], ['name', name]],
    nested: { origin },
    blocks: { payload },
  });
}
