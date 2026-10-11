// naming.mjs — shared name/type conventions (mirrors internal structure/NamingConventions).
export const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2').toLowerCase();
export const scalaType = (dt) => (dt === 'string (uuid)' || dt === 'uuid' ? 'Id' : dt);
