// Scala 2.13.16 StringOps.stripMargin preserves CR/LF separators and strips
// only a leading sequence of chars <= space followed by '|'. Used at the raw
// interpolation sites, never as file/byte-comparison normalization.
export function stripMargin(value) {
  if (typeof value !== 'string') throw new TypeError('stripMargin requires a string');
  let result = '', offset = 0;
  while (offset < value.length) {
    const start = offset;
    while (offset < value.length && value[offset] !== '\n' && value[offset] !== '\r') offset++;
    if (offset < value.length) {
      const separator = value[offset++];
      if (separator === '\r' && value[offset] === '\n') offset++;
    }
    let margin = start;
    while (margin < offset && value.charCodeAt(margin) <= 32) margin++;
    result += value.slice(margin < offset && value[margin] === '|' ? margin + 1 : start, offset);
  }
  return result;
}
