// shared.mjs — tree atom parsing/serialization shared by compile & decompose.
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

export const BANNER = '# ═══ truthsrc atom — hand-editable; contract: SCHEMA.md ═══';

export const slug = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unnamed';

/** Parse one atom file: fixed-shape YAML-ish header + verbatim JSON payload block. */
export function parseAtom(text, file = '<atom>') {
  const lines = text.split('\n');
  const header = {};
  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#') || line.trim() === '') continue;
    if (line === 'payload:' || line.startsWith('payload:')) break;
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) throw new Error(`${file}: malformed header line — ${JSON.stringify(line)}`);
    if (m[1] === 'origin') {
      header.origin = {};
      for (i++; i < lines.length; i++) {
        const o = lines[i].match(/^ {2}(\w+):\s*(.*)$/);
        if (!o) { i--; break; }
        header.origin[o[1]] = o[2];
      }
    } else {
      header[m[1]] = m[2];
    }
  }
  // payload: JSON block, every continuation line indented by exactly 2 spaces.
  // JSON.stringify output never contains blank lines, so a blank line ends the block.
  const pl = lines.slice(i);
  if (!pl.length || !pl[0].startsWith('payload:')) throw new Error(`${file}: payload block missing`);
  const first = pl[0].slice('payload:'.length).trim();
  const rest = [];
  for (const l of pl.slice(1)) {
    if (l.trim() === '') break;
    if (!l.startsWith('  ')) throw new Error(`${file}: payload continuation lines must be indented by 2 spaces`);
    rest.push(l.slice(2));
  }
  header.payload = JSON.parse([first, ...rest].join('\n').trim() || '{}');
  return header;
}

/** Serialize one atom to canonical bytes (the exact shape decompose emits). */
export function emitAtom({ kind, type, name, origin, payload }) {
  const L = [BANNER, '', `kind: ${kind}`, `type: ${type}`, `name: ${JSON.stringify(name)}`, 'origin:'];
  for (const k of ['stage', 'board', 'seq']) L.push(`  ${k}: ${origin[k]}`);
  // body line 0 is '{' (no indent); JSON's own 2-space indent carries the nesting —
  // parseAtom strips exactly 2 spaces from every continuation line, so this round-trips.
  const body = JSON.stringify(payload, null, 2).split('\n').map((l) => `  ${l}`);
  L.push('payload:', ...body, '');
  return L.join('\n');
}
