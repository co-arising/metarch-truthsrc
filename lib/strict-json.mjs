import { fail } from './products/request.mjs';

export const MAX_JSON_BYTES = 8 * 1024 * 1024;

/** Strict JSON boundary for new products only; legacy loaders are unchanged. */
export function parseStrictJson(input) {
  let raw;
  if (typeof input === 'string') raw = input;
  else if (input instanceof Uint8Array) {
    if (input.byteLength > MAX_JSON_BYTES) fail('PRODUCT_INPUT', 'JSON exceeds 8 MiB');
    try { raw = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(input); }
    catch { fail('PRODUCT_INPUT', 'invalid UTF-8'); }
  } else fail('PRODUCT_INPUT', 'expected UTF-8 bytes or JSON text');
  if (Buffer.byteLength(raw, 'utf8') > MAX_JSON_BYTES) fail('PRODUCT_INPUT', 'JSON exceeds 8 MiB');
  let i = 0;
  const bad = message => fail('PRODUCT_INPUT', `${message} at character ${i}`);
  const whitespace = () => { while (i < raw.length && ' \n\r\t'.includes(raw[i])) i++; };
  function string() {
    if (raw[i] !== '"') bad('expected string');
    const start = i++;
    let escaped = false;
    while (i < raw.length && (escaped || raw[i] !== '"')) {
      if (escaped) escaped = false; else if (raw[i] === '\\') escaped = true;
      i++;
    }
    if (i === raw.length) bad('unterminated string');
    i++;
    try { return JSON.parse(raw.slice(start, i)); } catch { bad('invalid string'); }
  }
  function value(depth) {
    if (depth > 128) bad('nesting exceeds 128');
    whitespace();
    if (raw[i] === '"') return string();
    if (raw[i] === '{') {
      i++; whitespace(); const result = {};
      if (raw[i] === '}') { i++; return result; }
      while (true) {
        whitespace(); const key = string(); whitespace();
        if (Object.hasOwn(result, key)) bad('duplicate object key');
        if (raw[i++] !== ':') bad('expected colon');
        Object.defineProperty(result, key, { value: value(depth + 1), enumerable: true, writable: true, configurable: true });
        whitespace();
        if (raw[i] === '}') { i++; return result; }
        if (raw[i++] !== ',') bad('expected comma');
      }
    }
    if (raw[i] === '[') {
      i++; whitespace(); const result = [];
      if (raw[i] === ']') { i++; return result; }
      while (true) {
        result.push(value(depth + 1)); whitespace();
        if (raw[i] === ']') { i++; return result; }
        if (raw[i++] !== ',') bad('expected comma');
      }
    }
    for (const [word, v] of [['true', true], ['false', false], ['null', null]]) if (raw.startsWith(word, i)) { i += word.length; return v; }
    if (raw[i] === '-' || (i < raw.length && /[0-9]/u.test(raw[i]))) {
      const start = i++;
      while (i < raw.length && /[0-9.eE+\-]/u.test(raw[i])) i++;
      const token = raw.slice(start, i);
      if (!/^-?(0|[1-9][0-9]*)$/u.test(token) || token === '-0' || !Number.isSafeInteger(Number(token)))
        fail('PRODUCT_EXACT_NUMBER', 'JSON numbers must be safe integer tokens; exact values use strings');
      return Number(token);
    }
    bad('expected JSON value');
  }
  const result = value(0); whitespace();
  if (i !== raw.length) bad('trailing JSON input');
  return result;
}
