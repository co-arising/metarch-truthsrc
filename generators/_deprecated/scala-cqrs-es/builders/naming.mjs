// naming.mjs — shared name/type conventions (mirrors internal structure/NamingConventions).
export const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2').toLowerCase();
export const scalaType = (dt) => (dt === 'string (uuid)' || dt === 'uuid' ? 'Id' : dt);

// Scala keyword → backticked identifier (verbatim NamingConventions.scala:135-144, 2026-08-21
// 摄入侧形态适配 — sticky-note field names may collide with keywords, `type` being the canon case).
export const SCALA_KEYWORDS = new Set([
  'type', 'object', 'class', 'trait', 'def', 'val', 'var', 'for', 'while', 'if', 'else',
  'match', 'case', 'import', 'package', 'extends', 'with', 'new', 'return', 'throw',
  'try', 'catch', 'finally', 'null', 'true', 'false', 'this', 'super', 'sealed',
  'implicit', 'lazy', 'override', 'private', 'protected', 'abstract', 'final', 'yield', 'do',
]);
export const scalaIdentifier = (name) => (SCALA_KEYWORDS.has(name) ? `\`${name}\`` : name);
