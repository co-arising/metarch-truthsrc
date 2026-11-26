// Zero-dependency hardened YAML/JSON subset parser for co-arising 2.0 orthogonal structure files.
// Supports block mappings/sequences, multiline block scalars (|, |-, |+, >, >-, >+),
// multiline flow collections ([...], {...}), document markers (--- / ...), and file:line:col snippets.
import { formatSourceSnippet } from './diagnostics.mjs';

export class V2YamlError extends Error {
  constructor(message, { file = '<input>', line = 1, col = 1, sourceText = '' } = {}) {
    const snippet = sourceText ? formatSourceSnippet(sourceText, { line, col, file }) : null;
    super(`V2_YAML_PARSE: ${file}:${line}:${col}: ${message}${snippet ? `\n${snippet}` : ''}`);
    this.name = 'V2YamlError';
    this.code = 'V2_YAML_PARSE';
    this.file = file;
    this.line = line;
    this.col = col;
    this.location = `${file}:${line}:${col}`;
    this.snippet = snippet;
  }
}

function splitFlowItems(inner) {
  const items = [];
  let cur = '';
  let depth = 0;
  let quote = null;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (quote) {
      cur += ch;
      if (ch === '\\' && i + 1 < inner.length) {
        cur += inner[i + 1];
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '[' || ch === '{') depth += 1;
    else if (ch === ']' || ch === '}') depth -= 1;
    if (ch === ',' && depth === 0) {
      if (cur.trim().length > 0) items.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim().length > 0) items.push(cur.trim());
  return items;
}

function stripInlineComment(raw) {
  let quote = null;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (quote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '#' && (i === 0 || /\s/u.test(raw[i - 1]))) {
      return raw.slice(0, i).trimEnd();
    }
  }
  return raw.trimEnd();
}

function flowBalanceDelta(text) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '[' || ch === '{') depth += 1;
    else if (ch === ']' || ch === '}') depth -= 1;
  }
  return depth;
}

function findUnquotedColon(text) {
  let quote = null;
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '[' || ch === '{') depth += 1;
    else if (ch === ']' || ch === '}') depth -= 1;
    if (ch === ':' && depth === 0 && (i + 1 === text.length || text[i + 1] === ' ')) {
      return i;
    }
  }
  return -1;
}

function parseScalar(raw, meta = {}) {
  const s = stripInlineComment(raw).trim();
  if (s === '' || s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s.startsWith('"') && s.endsWith('"')) return JSON.parse(s);
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1).replaceAll("''", "'");
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return splitFlowItems(inner).map(item => parseScalar(item, meta));
  }
  if (s.startsWith('{') && s.endsWith('}')) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return {};
    const obj = {};
    for (const pair of splitFlowItems(inner)) {
      const colonIdx = findUnquotedColon(pair);
      if (colonIdx < 0) {
        throw new V2YamlError(`invalid flow object entry "${pair}"`, meta);
      }
      const k = parseScalar(pair.slice(0, colonIdx), meta);
      const v = parseScalar(pair.slice(colonIdx + 1), meta);
      obj[String(k)] = v;
    }
    return obj;
  }
  if (/^-?\d+$/u.test(s)) return Number(s);
  if (/^-?\d+\.\d+$/u.test(s)) return Number(s);
  return s;
}

const BLOCK_SCALAR_RE = /^([|>])([+-])?$/u;

function parseBlockScalar(rawLines, startRawIdx, parentIndent, header) {
  const match = header.match(BLOCK_SCALAR_RE);
  const style = match[1]; // '|' or '>'
  const chomp = match[2] ?? ''; // '' (clip), '-' (strip), '+' (keep)

  const collected = [];
  let blockIndent = null;
  let i = startRawIdx;
  while (i < rawLines.length) {
    const raw = rawLines[i];
    if (raw.trim() === '') {
      collected.push({ blank: true, text: '' });
      i += 1;
      continue;
    }
    const indent = raw.length - raw.trimStart().length;
    if (indent <= parentIndent) break;
    if (blockIndent === null) blockIndent = indent;
    collected.push({ blank: false, text: raw.slice(Math.min(indent, blockIndent)) });
    i += 1;
  }

  // Separate trailing blank lines for chomp control
  let trailingBlanks = 0;
  while (collected.length > 0 && collected[collected.length - 1].blank) {
    collected.pop();
    trailingBlanks += 1;
  }

  let value;
  if (style === '|') {
    value = collected.map(c => c.text).join('\n');
  } else {
    // Folded scalar '>': single newlines between non-blank lines become spaces; blank lines become paragraph breaks
    const parts = [];
    for (let k = 0; k < collected.length; k += 1) {
      const cur = collected[k];
      if (cur.blank) {
        parts.push('\n');
      } else {
        if (k > 0 && !collected[k - 1].blank) parts.push(' ');
        parts.push(cur.text);
      }
    }
    value = parts.join('');
  }

  if (chomp === '+') {
    value += '\n'.repeat(trailingBlanks + (collected.length > 0 ? 1 : 0));
  } else if (chomp === '' && collected.length > 0) {
    value += '\n';
  }
  return { value, nextRawIdx: i };
}

function preprocessLines(text, file) {
  const rawLines = text.replace(/\r\n?/gu, '\n').split('\n');
  const result = [];

  for (let i = 0; i < rawLines.length; i += 1) {
    const raw = rawLines[i];
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('#') || trimmed === '---' || trimmed === '...') continue;
    const indent = raw.length - raw.trimStart().length;
    if (raw.slice(0, indent).includes('\t')) {
      throw new V2YamlError('tab indentation is forbidden', { file, line: i + 1, col: 1, sourceText: text });
    }
    let cleanText = stripInlineComment(raw.slice(indent));
    const startLineNo = i + 1;

    // Support multiline flow sequences/mappings (unclosed '[' or '{' spanning lines)
    let balance = flowBalanceDelta(cleanText);
    while (balance > 0 && i + 1 < rawLines.length) {
      i += 1;
      const cont = stripInlineComment(rawLines[i]).trim();
      if (!cont || cont.startsWith('#')) continue;
      cleanText = `${cleanText} ${cont}`;
      balance = flowBalanceDelta(cleanText);
    }
    if (balance !== 0) {
      throw new V2YamlError('unbalanced flow collection brackets/braces', { file, line: startLineNo, col: indent + 1, sourceText: text });
    }

    result.push({ lineNo: startLineNo, rawIdx: i, indent, text: cleanText });
  }
  return { lines: result, rawLines };
}

export function parseStructuredDoc(text, file = '<input>') {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch (err) {
      throw new V2YamlError(`invalid JSON: ${err.message}`, { file, line: 1, col: 1, sourceText: text });
    }
  }
  const { lines, rawLines } = preprocessLines(text, file);
  if (lines.length === 0) return {};

  let idx = 0;

  function consumeBlockScalarIfNeeded(valRaw, line, parentIndent) {
    if (!BLOCK_SCALAR_RE.test(valRaw)) return null;
    const parsed = parseBlockScalar(rawLines, line.rawIdx + 1, parentIndent, valRaw);
    while (idx < lines.length && lines[idx].rawIdx < parsed.nextRawIdx) {
      idx += 1;
    }
    return parsed.value;
  }

  function parseValue(valRaw, line, parentIndent, childMinIndent) {
    const meta = { file, line: line.lineNo, col: line.indent + 1, sourceText: text };
    if (!valRaw) return parseBlock(childMinIndent);
    const blockVal = consumeBlockScalarIfNeeded(valRaw, line, parentIndent);
    if (blockVal !== null) return blockVal;
    return parseScalar(valRaw, meta);
  }

  function parseBlock(minIndent) {
    if (idx >= lines.length) return null;
    const first = lines[idx];
    if (first.indent < minIndent) return null;
    if (first.text === '-' || first.text.startsWith('- ')) {
      return parseSequence(first.indent);
    }
    return parseMapping(first.indent);
  }

  function parseSequence(seqIndent) {
    const arr = [];
    while (idx < lines.length && lines[idx].indent === seqIndent) {
      const line = lines[idx];
      if (!(line.text === '-' || line.text.startsWith('- '))) break;
      idx += 1;
      const rest = line.text === '-' ? '' : line.text.slice(2).trim();
      if (!rest) {
        arr.push(parseBlock(seqIndent + 1));
        continue;
      }
      if (BLOCK_SCALAR_RE.test(rest)) {
        arr.push(consumeBlockScalarIfNeeded(rest, line, seqIndent));
        continue;
      }
      const colonIdx = findUnquotedColon(rest);
      if (colonIdx > 0) {
        const obj = {};
        const key = String(parseScalar(rest.slice(0, colonIdx), { file, line: line.lineNo, col: seqIndent + 3, sourceText: text }));
        const valRaw = rest.slice(colonIdx + 1).trim();
        obj[key] = parseValue(valRaw, line, seqIndent, seqIndent + 2);
        while (idx < lines.length && lines[idx].indent > seqIndent) {
          const entryLine = lines[idx];
          const cIdx = findUnquotedColon(entryLine.text);
          if (cIdx < 0) {
            throw new V2YamlError('expected mapping entry inside list item', { file, line: entryLine.lineNo, col: entryLine.indent + 1, sourceText: text });
          }
          idx += 1;
          const k = String(parseScalar(entryLine.text.slice(0, cIdx), { file, line: entryLine.lineNo, col: entryLine.indent + 1, sourceText: text }));
          const vRaw = entryLine.text.slice(cIdx + 1).trim();
          if (Object.hasOwn(obj, k)) {
            throw new V2YamlError(`duplicate key "${k}"`, { file, line: entryLine.lineNo, col: entryLine.indent + 1, sourceText: text });
          }
          obj[k] = parseValue(vRaw, entryLine, entryLine.indent, entryLine.indent + 1);
        }
        arr.push(obj);
      } else {
        arr.push(parseScalar(rest, { file, line: line.lineNo, col: seqIndent + 3, sourceText: text }));
      }
    }
    return arr;
  }

  function parseMapping(mapIndent) {
    const obj = {};
    while (idx < lines.length && lines[idx].indent === mapIndent) {
      const line = lines[idx];
      const colonIdx = findUnquotedColon(line.text);
      if (colonIdx < 0) {
        throw new V2YamlError(`expected "key: value", got "${line.text}"`, { file, line: line.lineNo, col: mapIndent + 1, sourceText: text });
      }
      idx += 1;
      const key = String(parseScalar(line.text.slice(0, colonIdx), { file, line: line.lineNo, col: mapIndent + 1, sourceText: text }));
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new V2YamlError(`forbidden key "${key}"`, { file, line: line.lineNo, col: mapIndent + 1, sourceText: text });
      }
      if (Object.hasOwn(obj, key)) {
        throw new V2YamlError(`duplicate key "${key}"`, { file, line: line.lineNo, col: mapIndent + 1, sourceText: text });
      }
      const valRaw = line.text.slice(colonIdx + 1).trim();
      obj[key] = parseValue(valRaw, line, mapIndent, mapIndent + 1);
    }
    return obj;
  }

  return parseBlock(lines[0].indent);
}
