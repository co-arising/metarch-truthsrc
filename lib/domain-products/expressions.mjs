import { equal, fail } from '../products/request.mjs';
import { refKey } from './references.mjs';
import { parseExact } from '../value-products/exact-types.mjs';

export const decimal = { form: 'primitive', name: 'decimal' };
export function numericLiteral(value) {
  if (typeof value !== 'string' || value.length > 80 || !/^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/u.test(value) || /^-0(?:\.0+)?$/u.test(value))
    fail('DECISION_NUMBER', 'numeric literal requires bounded canonical decimal text');
  return { op: 'decimal', value };
}
export const fractionDigits = value => (value.split('.')[1] || '').length;

const bool = { form: 'primitive', name: 'boolean' }, string = { form: 'primitive', name: 'string' };
const unary = (op, argument) => ({ op, argument });
const binary = (op, left, right) => ({ op, left, right });
export function references(e) {
  const refs = e.op === 'ref' ? [e.ref] : e.op === 'member' ? [...references(e.argument), e.member] : e.argument ? references(e.argument) : e.left ? [...references(e.left), ...references(e.right)] : [];
  return refs.filter((r, i) => refs.findIndex(other => refKey(other) === refKey(r)) === i);
}
export function exactOperand(e, command, layout, exactTypes) {
  if (!exactTypes) return null;
  if (e.op === 'ref') {
    const t = infer(e, command, layout, exactTypes);
    return t.form === 'nominal' ? exactTypes.types.find(x => equal(x.domain, t.ref) && x.form === 'decimal') ?? null : null;
  }
  if (e.op === 'member') {
    const t = infer(e.argument, command, layout, exactTypes);
    return t.form === 'nominal' ? exactTypes.types.find(x => equal(x.domain, t.ref) && equal(x.amountMember, e.member)) ?? null : null;
  }
  return null;
}
function exactComparison(e, command, layout, exactTypes) {
  if (!exactTypes) fail('DECISION_TYPE', 'exact comparison requires declared exact types');
  const a = exactOperand(e.left, command, layout, exactTypes), b = exactOperand(e.right, command, layout, exactTypes);
  if (a && b && equal(a.domain, b.domain)) return;
  const type = a ?? b, literal = a ? e.right : e.left;
  if (type && literal.op === 'decimal') {
    try { parseExact(literal.value, type); return; } catch { /* Refuse unrepresentable literals before compiling the decision. */ }
  }
  fail('DECISION_TYPE', 'exact comparison requires one declared type and a representable literal or the same exact type');
}
export function infer(e, command, layout, exactTypes = null) {
  const bad = () => fail('DECISION_TYPE', 'unsupported or incompatible expression types');
  if (e.op === 'ref') {
    const r = e.ref;
    if (r.context !== command.context || !(r.kind === 'state-field' && equal(r.owner, command.owner) || r.kind === 'parameter' && equal(r.owner, [...command.owner, command.id]))) bad();
    const d = layout.declarations.find(d => refKey(d.ref) === refKey(r));
    if (!d?.valueType) bad();
    return d.valueType;
  }
  if (e.op === 'decimal') { if (!exactTypes) bad(); numericLiteral(e.value); return decimal; }
  if (e.op === 'member') {
    if (!exactTypes) bad();
    const parent = infer(e.argument, command, layout, exactTypes);
    const type = parent.form === 'nominal' && layout.declarations.find(d => equal(d.ref, parent.ref));
    const member = layout.declarations.find(d => equal(d.ref, e.member));
    if (type?.valueType?.form !== 'record' || !type.valueType.members.some(r => equal(r, e.member)) || !member?.valueType) bad();
    return member.valueType;
  }
  if (e.op === 'boolean') return bool;
  if (e.op === 'string') return string;
  if (e.argument) {
    const t = infer(e.argument, command, layout, exactTypes);
    if (e.op === 'not' && equal(t, bool)) return bool;
    if (e.op === 'map-keys' && t.form === 'map') return { form: 'sequence', element: t.key };
    if (['is-empty', 'non-empty'].includes(e.op) && (equal(t, string) || ['map', 'sequence', 'optional'].includes(t.form))) return bool;
    return bad();
  }
  const l = infer(e.left, command, layout, exactTypes), r = infer(e.right, command, layout, exactTypes);
  if (['less', 'less-equal', 'greater', 'greater-equal'].includes(e.op)) {
    exactComparison(e, command, layout, exactTypes);
    return bool;
  }
  if (['and', 'or'].includes(e.op) && equal(l, bool) && equal(r, bool)) return bool;
  if (exactTypes && ['equal', 'not-equal'].includes(e.op) && (e.left.op === 'decimal' || e.right.op === 'decimal' || equal(l, decimal) || equal(r, decimal))) {
    exactComparison(e, command, layout, exactTypes);
    return bool;
  }
  if (['equal', 'not-equal'].includes(e.op) && equal(l, r)) return bool;
  if (['map-get', 'map-lookup', 'map-contains'].includes(e.op) && l.form === 'map' && equal(l.key, r))
    return e.op === 'map-get' ? { form: 'optional', element: l.value } : e.op === 'map-lookup' ? l.value : bool;
  if (e.op === 'all-equal' && l.form === 'sequence' && equal(l.element, r)) return bool;
  if (e.op === 'contains' && (['optional', 'sequence'].includes(l.form) && equal(l.element, r) || equal(l, string) && equal(r, string))) return bool;
  return bad();
}
export function parseExpression(raw, command, layout, exactTypes = null) {
  const bad = message => fail('DECISION_SOURCE_EXPRESSION_UNSUPPORTED', message);
  if (typeof raw !== 'string' || raw.length > 65536) bad('expression exceeds source bounds');
  const tokens = [];
  let i = 0;
  while (i < raw.length) {
    if (' \t\r\n'.includes(raw[i])) { i++; continue; }
    const start = i;
    if (tokens.length >= 512) bad('expression exceeds token bounds');
    if (raw[i] === '"') {
      i++;
      let escaped = false;
      while (i < raw.length && (escaped || raw[i] !== '"')) {
        if (escaped) escaped = false; else if (raw[i] === '\\') escaped = true;
        i++;
      }
      if (i === raw.length) bad('unterminated string literal');
      i++;
      let value;
      try { value = JSON.parse(raw.slice(start, i)); } catch { bad('invalid JSON string literal'); }
      tokens.push({ kind: 'string', value });
    } else if (exactTypes && (/[0-9]/u.test(raw[i]) || raw[i] === '-')) {
      i++;
      while (i < raw.length && /[0-9.]/u.test(raw[i])) i++;
      const value = raw.slice(start, i); numericLiteral(value); tokens.push({ kind: 'decimal', value });
    } else if (/[A-Za-z_]/u.test(raw[i])) {
      i++;
      while (i < raw.length && /[A-Za-z0-9_]/u.test(raw[i])) i++;
      tokens.push({ kind: 'identifier', value: raw.slice(start, i) });
    } else {
      const pair = raw.slice(i, i + 2);
      if (['&&', '||', '==', '!=', ...(exactTypes ? ['<=', '>='] : [])].includes(pair)) { tokens.push({ kind: pair }); i += 2; }
      else if (('!().' + (exactTypes ? '<>' : '')).includes(raw[i])) { tokens.push({ kind: raw[i] }); i++; }
      else bad(`unsupported token at ${i}`);
    }
  }
  tokens.push({ kind: 'end' });
  let cursor = 0, nesting = 0;
  const accept = kind => tokens[cursor]?.kind === kind ? (cursor++, true) : false;
  const expect = kind => { const token = tokens[cursor]; if (!accept(kind)) bad(`expected ${kind}`); return token; };
  const nested = fn => { if (++nesting > 32) bad('expression exceeds nesting bounds'); const result = fn(); nesting--; return result; };
  function disjunction() { let v = conjunction(); while (accept('||')) v = binary('or', v, conjunction()); return v; }
  function conjunction() { let v = equality(); while (accept('&&')) v = binary('and', v, equality()); return v; }
  function equality() {
    let v = comparison();
    while (['==', '!='].includes(tokens[cursor].kind)) { const op = tokens[cursor++].kind; v = binary(op === '==' ? 'equal' : 'not-equal', v, comparison()); }
    return v;
  }
  function comparison() {
    let v = negate();
    const ops = { '<': 'less', '<=': 'less-equal', '>': 'greater', '>=': 'greater-equal' };
    while (Object.hasOwn(ops, tokens[cursor].kind)) { const op = tokens[cursor++].kind; v = binary(ops[op], v, negate()); }
    return v;
  }
  function negate() { return accept('!') ? nested(() => unary('not', negate())) : postfix(); }
  function postfix() {
    let v = primary();
    while (true) {
      if (accept('(')) { const key = nested(disjunction); expect(')'); v = binary('map-lookup', v, key); }
      else if (accept('.')) {
        const method = expect('identifier').value;
        if (method === 'isEmpty' || method === 'nonEmpty') v = unary(method === 'isEmpty' ? 'is-empty' : 'non-empty', v);
        else if (method === 'keys') v = unary('map-keys', v);
        else if (method === 'get' || method === 'contains') {
          expect('('); const arg = nested(disjunction); expect(')');
          const op = method === 'get' ? 'map-get' : infer(v, command, layout, exactTypes).form === 'map' ? 'map-contains' : 'contains';
          v = binary(op, v, arg);
        } else if (method === 'forall') {
          if (v.op !== 'map-keys') bad('only map.keys.forall(_ == expression) is supported');
          expect('('); if (expect('identifier').value !== '_') bad('forall requires bound underscore');
          expect('=='); const arg = nested(primary); expect(')');
          if (arg.op !== 'ref') bad('forall comparison requires a declared reference');
          v = binary('all-equal', v, arg);
        } else if (exactTypes) {
          const parent = infer(v, command, layout, exactTypes);
          if (parent.form !== 'nominal') bad('member requires a declared nominal record');
          const member = { context: parent.ref.context, kind: 'member', owner: [parent.ref.id], id: method };
          v = { op: 'member', argument: v, member }; infer(v, command, layout, exactTypes);
        } else bad('unsupported member or method');
      } else return v;
    }
  }
  function primary() {
    if (accept('(')) { const v = nested(disjunction); expect(')'); return v; }
    if (tokens[cursor].kind === 'decimal') return numericLiteral(expect('decimal').value);
    if (tokens[cursor].kind === 'string') return { op: 'string', value: expect('string').value };
    const root = expect('identifier').value;
    if (root === 'true' || root === 'false') return { op: 'boolean', value: root === 'true' };
    if (!['param', 'state'].includes(root)) bad('only declared param/state paths supported');
    expect('.'); const id = expect('identifier').value;
    return { op: 'ref', ref: { context: command.context, kind: root === 'param' ? 'parameter' : 'state-field', owner: root === 'param' ? [...command.owner, command.id] : command.owner, id } };
  }
  const result = disjunction(); expect('end');
  function depth(e, n = 0) { if (n > 64) bad('expression exceeds AST depth bounds'); if (e.argument) depth(e.argument, n + 1); if (e.left) { depth(e.left, n + 1); depth(e.right, n + 1); } }
  depth(result); infer(result, command, layout, exactTypes);
  return result;
}
const fact = (map, key) => JSON.stringify([map, key]);
const union = (a, b) => new Set([...a, ...b]);
const intersect = (a, b) => new Set([...a].filter(x => b.has(x)));
export function presentWhen(e, truth) {
  if (e.op === 'map-contains' && truth) return new Set([fact(e.left, e.right)]);
  if (e.op === 'not') return presentWhen(e.argument, !truth);
  if (e.op === 'and') return (truth ? union : intersect)(presentWhen(e.left, truth), presentWhen(e.right, truth));
  if (e.op === 'or') return (truth ? intersect : union)(presentWhen(e.left, truth), presentWhen(e.right, truth));
  return new Set();
}
export function lookupSafety(e, known = new Set()) {
  if (e.op === 'map-lookup' && !known.has(fact(e.left, e.right))) fail('DECISION_LOOKUP_UNSAFE', 'map lookup lacks a dominating presence guard');
  if (e.argument) lookupSafety(e.argument, known);
  if (e.left) {
    lookupSafety(e.left, known);
    lookupSafety(e.right, ['and', 'or'].includes(e.op) ? union(known, presentWhen(e.left, e.op === 'and')) : known);
  }
}
