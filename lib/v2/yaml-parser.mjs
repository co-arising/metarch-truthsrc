// Zero-dependency strict YAML/JSON subset parser for co-arising 2.0 orthogonal structure files.

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

function parseScalar(raw) {
  const s = stripInlineComment(raw).trim();
  if (s === '' || s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s.startsWith('"') && s.endsWith('"')) return JSON.parse(s);
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1).replaceAll("''", "'");
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return splitFlowItems(inner).map(parseScalar);
  }
  if (s.startsWith('{') && s.endsWith('}')) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return {};
    const obj = {};
    for (const pair of splitFlowItems(inner)) {
      const colonIdx = findUnquotedColon(pair);
      if (colonIdx < 0) throw new Error(`V2_YAML_PARSE: invalid flow object entry "${pair}"`);
      const k = parseScalar(pair.slice(0, colonIdx));
      const v = parseScalar(pair.slice(colonIdx + 1));
      obj[String(k)] = v;
    }
    return obj;
  }
  if (/^-?\d+$/u.test(s)) return Number(s);
  if (/^-?\d+\.\d+$/u.test(s)) return Number(s);
  return s;
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

function preprocessLines(text) {
  const result = [];
  const rawLines = text.replace(/\r\n?/gu, '\n').split('\n');
  for (let i = 0; i < rawLines.length; i += 1) {
    const raw = rawLines[i];
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const indent = raw.length - raw.trimStart().length;
    if (raw.slice(0, indent).includes('\t')) {
      throw new Error(`V2_YAML_PARSE: tab indentation forbidden on line ${i + 1}`);
    }
    result.push({ lineNo: i + 1, indent, text: stripInlineComment(raw.slice(indent)) });
  }
  return result;
}

export function parseStructuredDoc(text, file = '<input>') {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed);
  }
  const lines = preprocessLines(text);
  if (lines.length === 0) return {};

  let idx = 0;

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
      const colonIdx = findUnquotedColon(rest);
      if (colonIdx > 0) {
        const obj = {};
        const key = String(parseScalar(rest.slice(0, colonIdx)));
        const valRaw = rest.slice(colonIdx + 1).trim();
        obj[key] = valRaw ? parseScalar(valRaw) : parseBlock(seqIndent + 2);
        while (idx < lines.length && lines[idx].indent > seqIndent) {
          const entryLine = lines[idx];
          const cIdx = findUnquotedColon(entryLine.text);
          if (cIdx < 0) {
            throw new Error(`V2_YAML_PARSE: ${file}:${entryLine.lineNo}: expected mapping entry inside list item`);
          }
          idx += 1;
          const k = String(parseScalar(entryLine.text.slice(0, cIdx)));
          const vRaw = entryLine.text.slice(cIdx + 1).trim();
          if (Object.hasOwn(obj, k)) {
            throw new Error(`V2_YAML_PARSE: ${file}:${entryLine.lineNo}: duplicate key "${k}"`);
          }
          obj[k] = vRaw ? parseScalar(vRaw) : parseBlock(entryLine.indent + 1);
        }
        arr.push(obj);
      } else {
        arr.push(parseScalar(rest));
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
        throw new Error(`V2_YAML_PARSE: ${file}:${line.lineNo}: expected "key: value", got "${line.text}"`);
      }
      idx += 1;
      const key = String(parseScalar(line.text.slice(0, colonIdx)));
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new Error(`V2_YAML_PARSE: ${file}:${line.lineNo}: forbidden key "${key}"`);
      }
      if (Object.hasOwn(obj, key)) {
        throw new Error(`V2_YAML_PARSE: ${file}:${line.lineNo}: duplicate key "${key}"`);
      }
      const valRaw = line.text.slice(colonIdx + 1).trim();
      obj[key] = valRaw ? parseScalar(valRaw) : parseBlock(mapIndent + 1);
    }
    return obj;
  }

  return parseBlock(lines[0].indent);
}
