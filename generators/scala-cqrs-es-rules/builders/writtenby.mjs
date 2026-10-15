// writtenby.mjs — the writtenBy lineage-path grammar and its parser, ported verbatim from
// backend-codegen's tools/writtenby_lib.mjs (the single grammar implementation; the source's
// own audit rule is that every writtenBy consumer goes through THIS parse, never split('.')).
//
// The `stateFields[].writtenBy` truth values are TEXT mentions of event-payload paths. Grammar
// (derived from the emitted forms — 5 shapes over 333 ②-layer rows):
//   Path    := Segment ('.' Segment)*
//   Segment := Name ('[]')?            // '[]' marks a list member
//   Name    := [A-Za-z_][A-Za-z0-9_]*
//
//   X           whole event   ← the field is written by this event occurring (e.g. status)
//   X.p         payload field ← p is an event payload field
//   X.p.member  VO member     ← p is a payload field of VO type, member its member
//   X.l[].m     list member   ← l is a List<VO> payload field, m an element member
//   X.p.l[].m   nested list   ← p is a VO payload field, l its List<VO> member, m element member
//
// parse() is SYNTAX-only (shape check); semantic resolution (does the event/field/VO member
// exist) is the caller's job — the event-handler face only needs the shape kind plus the first
// two segment names, exactly like rules_domain_gen line 2042.

/** Single grammar segment regex: Name with optional '[]' suffix. */
const SEGMENT_RE = /^([A-Za-z_][A-Za-z0-9_]*)(\[\])?$/;

/**
 * Syntax parse (no catalog lookup — shape only) → segment array.
 * @returns {ok:true, segments:[{name,list}], shape:string} | {ok:false, reason, at}
 */
export function parse(path) {
  if (typeof path !== 'string' || path.trim() === '')
    return { ok: false, reason: 'empty', at: path };
  const raw = path.split('.');
  const segments = [];
  for (const seg of raw) {
    const m = SEGMENT_RE.exec(seg);
    if (!m) return { ok: false, reason: 'bad-segment', at: seg };
    segments.push({ name: m[1], list: m[2] === '[]' });
  }
  // '[]' may only sit on a segment pointing at a VO — non-last segments allowed; a last segment
  // with [] denotes the list itself (legal: the whole list is written)
  const shape = segments.map((s) => (s.list ? '[]' : 'X')).join('.');
  return { ok: true, segments, shape };
}
