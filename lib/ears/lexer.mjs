// Deterministic bilingual lexer for co-arising EARS 1.0 (Style A + Style C, EN + CN).
import { KEYWORDS } from './tokens.mjs';

const IDENT_START_RE = /^[\p{L}_]/u;
const IDENT_CONT_RE = /^[\p{L}\p{N}_]/u;
const DIGIT_RE = /^[0-9]/u;
const TWO_CHAR_OPS = new Map([
  ['==', 'OP_EQ'],
  ['!=', 'OP_NEQ'],
  ['>=', 'OP_GTE'],
  ['<=', 'OP_LTE'],
  ['->', 'ARROW'],
  ['..', 'DOTDOT'],
]);
const ONE_CHAR_OPS = new Map([
  ['>', 'OP_GT'],
  ['<', 'OP_LT'],
  ['=', 'ASSIGN'],
  ['+', 'PLUS'],
  ['-', 'MINUS'],
  ['*', 'STAR'],
  ['.', 'DOT'],
  [':', 'COLON'],
  [',', 'COMMA'],
  ['，', 'COMMA'],
  ["'", 'PRIME'],
  ['(', 'LPAREN'],
  [')', 'RPAREN'],
  ['[', 'LBRACKET'],
  [']', 'RBRACKET'],
  ['{', 'LBRACE'],
  ['}', 'RBRACE'],
]);

export class EarsSyntaxError extends Error {
  constructor(message, { line = 1, col = 1, file = '<input>' } = {}) {
    super(`${file}:${line}:${col}: ${message}`);
    this.name = 'EarsSyntaxError';
    this.code = 'EARS_SYNTAX';
    this.line = line;
    this.col = col;
    this.file = file;
  }
}

function scanString(source, start, state) {
  let i = start + 1;
  let value = '';
  const startLine = state.line;
  const startCol = state.col;
  state.col += 1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') {
      if (i + 1 >= source.length) {
        throw new EarsSyntaxError('unterminated string escape', { line: startLine, col: startCol, file: state.file });
      }
      const next = source[i + 1];
      if (next === 'n') value += '\n';
      else if (next === 't') value += '\t';
      else value += next;
      i += 2;
      state.col += 2;
      continue;
    }
    if (ch === '"') {
      state.col += 1;
      return {
        nextIndex: i + 1,
        token: { type: 'STRING_LIT', value, raw: source.slice(start, i + 1), line: startLine, col: startCol, offset: start, length: i + 1 - start },
      };
    }
    if (ch === '\n') {
      throw new EarsSyntaxError('unterminated string literal', { line: startLine, col: startCol, file: state.file });
    }
    value += ch;
    i += 1;
    state.col += 1;
  }
  throw new EarsSyntaxError('unterminated string literal', { line: startLine, col: startCol, file: state.file });
}

const DURATION_UNITS = new Map([
  ['ms', 1],
  ['s', 1000],
  ['m', 60_000],
  ['h', 3_600_000],
  ['d', 86_400_000],
]);

function scanNumber(source, start, state) {
  const startLine = state.line;
  const startCol = state.col;
  let i = start;
  while (i < source.length && DIGIT_RE.test(source[i])) i += 1;
  let scale = 0;
  if (i < source.length && source[i] === '.' && source[i + 1] !== '.' && DIGIT_RE.test(source[i + 1] ?? '')) {
    const dotPos = i;
    i += 1;
    while (i < source.length && DIGIT_RE.test(source[i])) i += 1;
    scale = i - dotPos - 1;
  }
  const numRaw = source.slice(start, i);

  // Check for duration suffix (ms, s, m, h, d) when integer and not followed by identifier continuation
  if (scale === 0) {
    for (const unit of ['ms', 's', 'm', 'h', 'd']) {
      if (source.slice(i, i + unit.length) === unit) {
        const after = source[i + unit.length] ?? '';
        if (!IDENT_CONT_RE.test(after)) {
          const endIdx = i + unit.length;
          const raw = source.slice(start, endIdx);
          const ms = Number(numRaw) * DURATION_UNITS.get(unit);
          state.col += raw.length;
          return {
            nextIndex: endIdx,
            token: {
              type: 'DURATION_LIT',
              value: String(ms),
              durationMs: ms,
              unit,
              scale: 0,
              raw,
              line: startLine,
              col: startCol,
              offset: start,
              length: raw.length,
            },
          };
        }
      }
    }
  }

  state.col += numRaw.length;
  return {
    nextIndex: i,
    token: {
      type: 'NUMBER_LIT',
      value: numRaw,
      scale,
      raw: numRaw,
      line: startLine,
      col: startCol,
      offset: start,
      length: numRaw.length,
    },
  };
}

function scanWord(source, start, state) {
  const startLine = state.line;
  const startCol = state.col;
  let i = start;
  while (i < source.length) {
    const ch = source[i];
    if (IDENT_CONT_RE.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '-' && IDENT_CONT_RE.test(source[i + 1] ?? '')) {
      i += 1;
      continue;
    }
    break;
  }
  const raw = source.slice(start, i);
  state.col += raw.length;
  const kwType = KEYWORDS.get(raw);
  const token = kwType
    ? { type: kwType, value: kwType === 'BOOL_LIT' ? raw === 'true' : raw, raw, line: startLine, col: startCol, offset: start, length: raw.length }
    : { type: 'IDENT', value: raw, raw, line: startLine, col: startCol, offset: start, length: raw.length };
  return { nextIndex: i, token };
}

function mergeMultiWordTokens(rawTokens) {
  const out = [];
  for (let i = 0; i < rawTokens.length; i += 1) {
    const cur = rawTokens[i];
    const next = rawTokens[i + 1];
    if (cur.type === 'KW_SHALL' && next?.type === 'KW_NOT' && cur.line === next.line) {
      out.push({
        type: 'KW_SHALL_NOT',
        value: `${cur.raw} ${next.raw}`,
        raw: `${cur.raw} ${next.raw}`,
        line: cur.line,
        col: cur.col,
        offset: cur.offset,
        length: (next.offset + next.length) - cur.offset,
      });
      i += 1;
      continue;
    }
    if (cur.type === 'KW_IS_NOT') {
      out.push({ ...cur, type: 'KW_IS', value: cur.raw });
      out.push({ ...cur, type: 'KW_NOT', value: cur.raw });
      continue;
    }
    out.push(cur);
  }
  return out;
}

export function tokenizeEars(source, { file = '<input>' } = {}) {
  const rawTokens = [];
  const state = { line: 1, col: 1, file };
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      i += 1;
      state.col += 1;
      continue;
    }
    if (ch === '\n') {
      i += 1;
      state.line += 1;
      state.col = 1;
      continue;
    }
    if (ch === '#') {
      while (i < source.length && source[i] !== '\n') {
        i += 1;
        state.col += 1;
      }
      continue;
    }
    if (ch === '"') {
      const scanned = scanString(source, i, state);
      rawTokens.push(scanned.token);
      i = scanned.nextIndex;
      continue;
    }
    if (ch === '@' && source.slice(i, i + 5) === '@host') {
      rawTokens.push({ type: 'AT_HOST', value: '@host', raw: '@host', line: state.line, col: state.col, offset: i, length: 5 });
      i += 5;
      state.col += 5;
      continue;
    }
    const two = source.slice(i, i + 2);
    if (TWO_CHAR_OPS.has(two)) {
      rawTokens.push({ type: TWO_CHAR_OPS.get(two), value: two, raw: two, line: state.line, col: state.col, offset: i, length: 2 });
      i += 2;
      state.col += 2;
      continue;
    }
    if (ONE_CHAR_OPS.has(ch)) {
      rawTokens.push({ type: ONE_CHAR_OPS.get(ch), value: ch, raw: ch, line: state.line, col: state.col, offset: i, length: 1 });
      i += 1;
      state.col += 1;
      continue;
    }
    if (DIGIT_RE.test(ch)) {
      const scanned = scanNumber(source, i, state);
      rawTokens.push(scanned.token);
      i = scanned.nextIndex;
      continue;
    }
    if (IDENT_START_RE.test(ch)) {
      const scanned = scanWord(source, i, state);
      rawTokens.push(scanned.token);
      i = scanned.nextIndex;
      continue;
    }
    throw new EarsSyntaxError(`unexpected character ${JSON.stringify(ch)}`, { line: state.line, col: state.col, file });
  }
  const merged = mergeMultiWordTokens(rawTokens);
  merged.push({ type: 'EOF', value: '', raw: '', line: state.line, col: state.col, offset: source.length, length: 0 });
  return merged;
}
