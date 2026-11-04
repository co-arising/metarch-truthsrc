import { parseDoc } from './shared.mjs';

// New author input uses the existing small grammar, not another YAML dialect.
// Audit its lexical collections BEFORE parseDoc can overwrite duplicate keys.
// The only scalar semantic difference is preserving explicitly quoted integers.
export function parseAuthorDoc(text, file = '<author atom>') {
  const fail = message => { throw new Error(`AUTHOR_PARSE: ${file}: ${message}`); };
  if (typeof text !== 'string') fail('text required');
  const unique = (seen, key, where) => {
    if (seen.has(key)) fail(`duplicate ${where} key ${key}`);
    // parseDoc's ordinary-object assignments cannot carry this YAML map key.
    if (key === '__proto__') fail(`unsupported ${where} key ${key}`);
    seen.add(key);
  };
  const json = raw => {
    const tokens = raw.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|[^\s{}\[\]:,]+/g) || [];
    const stack = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token === '{') stack.push(new Set());
      else if (token === '[') stack.push(null);
      else if (token === '}' || token === ']') stack.pop();
      else if (tokens[i + 1] === ':') {
        const key = JSON.parse(token), names = stack.at(-1);
        if (!names) fail('malformed JSON object');
        if (names.has(key)) fail(`duplicate JSON key ${key}`);
        names.add(key);
      }
    }
    // Leave JSON syntax/number semantics to the same parser as parseDoc.
    JSON.parse(raw);
  };
  const quoted = [];
  const scalar = (raw, path) => {
    if (!raw.startsWith('"')) return;
    // parseDoc deliberately retains malformed quoted prose as raw text.
    let value;
    try { value = JSON.parse(raw); } catch { return; }
    if (typeof value === 'string' && /^-?\d+$/.test(value)) quoted.push({ path, value });
  };
  const lines = text.split('\n'), root = new Set();
  for (let i = 0; i < lines.length;) {
    const line = lines[i++];
    if (line.startsWith('#') || line.trim() === '') continue;
    const m = line.match(/^(\w+):(?: (.*))?$/);
    if (!m) fail(`malformed line — ${JSON.stringify(line)}`);
    const [, key, rest] = m;
    unique(root, key, 'root');
    if (rest !== undefined && rest !== '') {
      const flow = rest.trim();
      if ((flow.startsWith('{') && flow.endsWith('}')) || (flow.startsWith('[') && flow.endsWith(']'))) json(flow);
      else scalar(rest, [key]);
      continue;
    }
    const sub = [];
    for (; i < lines.length; i++) {
      const l = lines[i];
      if (l.trim() === '') { if (sub.length) break; else continue; }
      if (l.startsWith('  ')) sub.push(l.slice(2));
      else break;
    }
    if (!sub.length) continue;
    if (sub[0].startsWith('{') || sub[0].startsWith('[')) { json(sub.join('\n')); continue; }
    if (sub[0].startsWith('- ')) {
      if (!/- \w+: /.test(sub[0])) {
        sub.forEach((l, index) => {
          const row = l.match(/^- (.*)$/);
          if (row) scalar(row[1], [key, index]);
        });
      } else {
        let row = -1, seen;
        for (const l of sub) {
          const first = l.match(/^- (\w+): (.*)$/);
          if (first) { row++; seen = new Set(); }
          const part = first || l.replace(/^ {2}/, '').match(/^(\w+): (.*)$/);
          if (!part || !seen) fail(`malformed ${key} list row`);
          unique(seen, part[1], key + ' row');
          scalar(part[2], [key, row, part[1]]);
        }
      }
      continue;
    }
    const seen = new Set();
    for (const l of sub) {
      const part = l.match(/^(\w+): (.*)$/);
      if (!part) fail(`malformed ${key} map line`);
      unique(seen, part[1], key);
      if (part[2].startsWith('[')) json(part[2]);
      else scalar(part[2], [key, part[1]]);
    }
  }
  const doc = parseDoc(text, file);
  for (const { path, value } of quoted) {
    const target = path.slice(0, -1).reduce((object, key) => object[key], doc);
    target[path.at(-1)] = value;
  }
  return doc;
}
