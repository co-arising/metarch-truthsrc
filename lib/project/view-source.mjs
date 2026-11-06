const escape = value => String(value).replaceAll('~', '~0').replaceAll('/', '~1');

function jsonRanges(text, start, prefix) {
  let pos = start;
  const ranges = new Map();
  const white = () => { while (/\s/.test(text[pos] || '') && pos < text.length) pos++; };
  const string = () => {
    const begin = pos++;
    while (pos < text.length) {
      if (text[pos++] === '\\') pos++;
      else if (text[pos - 1] === '"') return JSON.parse(text.slice(begin, pos));
    }
    throw new Error('unterminated JSON string');
  };
  const value = path => {
    white(); const begin = pos, token = text[pos];
    if (token === '{') {
      pos++; white();
      while (text[pos] !== '}') {
        if (text[pos] !== '"') throw new Error('object key expected');
        const key = string(); white();
        if (text[pos++] !== ':') throw new Error('colon expected');
        value(path + '/' + escape(key)); white();
        if (text[pos] === '}') break;
        if (text[pos++] !== ',') throw new Error('comma expected');
        white();
      }
      pos++;
    } else if (token === '[') {
      pos++; white(); let index = 0;
      while (text[pos] !== ']') {
        value(path + '/' + index++); white();
        if (text[pos] === ']') break;
        if (text[pos++] !== ',') throw new Error('comma expected');
        white();
      }
      pos++;
    } else if (token === '"') string();
    else {
      const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(pos));
      if (!match) throw new Error('JSON value expected');
      pos += match[0].length;
    }
    ranges.set(path, { start: begin, end: pos });
  };
  value(prefix);
  return ranges;
}

export function authorExcerpt(text, pointer, { maxLines = 80 } = {}) {
  const lines = text.split('\n'), lineAt = offset => text.slice(0, offset).split('\n').length;
  let range;
  if (pointer === '') range = { start: 0, end: text.length };
  else if (typeof pointer === 'string') {
    const top = pointer.split('/')[1]?.replaceAll('~1', '/').replaceAll('~0', '~');
    for (const match of text.matchAll(/^(\w+):[^\n]*\n?/gm)) if (match[1] === top) {
      let start = match.index + match[0].indexOf(':') + 1;
      while (/\s/.test(text[start] || '') && start < text.length) start++;
      if (['{', '['].includes(text[start])) {
        try { range = jsonRanges(text, start, '/' + escape(top)).get(pointer); } catch { /* The compiler, not this locator, admits author syntax. */ }
      } else if (pointer === '/' + escape(top)) range = { start: match.index, end: match.index + match[0].length };
      break;
    }
  }
  const first = range ? lineAt(range.start) : 1, last = range ? lineAt(range.end) : lines.length;
  const startLine = Math.max(1, first - 2), endLine = Math.min(lines.length, startLine + maxLines - 1, Math.max(last + 2, first + 8));
  return { text: lines.slice(startLine - 1, endLine).join('\n'), startLine, endLine,
    pointerLocated: !!range, truncated: endLine < last,
    label: range ? '真实作者位置 · ' + (pointer || '/') : '真实作者文件摘录 · 以 pointer 定位' };
}
