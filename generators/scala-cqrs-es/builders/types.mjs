// types.mjs — the dependency/import computation, ported from the internal TypeSystem
// (TypeRef.shouldImport / collectAllDependencies, DomainEntityBuilder.neutralValueFor /
// emptyDefaultFor). This is the "依赖计算" the user flagged as load-bearing: imports are a
// pure package comparison, and the import list is the sorted MULTISET of fqns over the set of
// DISTINCT fully-qualified TypeRefs (distinctness includes type parameters) — so Map[String,M]
// and Map[Id,M] both emit `scala.collection.immutable.Map` (two lines), while one List[Id] used
// in many places emits it once. Mirrors Set[TypeRef] dedup followed by .map(_.fqn).
const SENTINEL_ID = '00000000-0000-0000-0000-000000000001';

// base type name → { pkg } for importable types; empty pkg ⇒ never imported (primitives/collections root).
function pkgOf(baseName, fb) {
  switch (baseName) {
    case 'Id':
    case 'iMadzError': return `${fb}.CommonTypes`;
    case 'Instant': return 'java.time';
    case 'List':
    case 'Map':
    case 'Seq':
    case 'Set':
    case 'Vector': return 'scala.collection.immutable';
    case 'String':
    case 'Int':
    case 'Long':
    case 'Boolean':
    case 'Double':
    case 'Float':
    case 'BigDecimal':
    case 'Option':
    case 'Unit': return '';            // scala / primitive → no import
    default: return null;              // unknown → caller supplies (VO typeImport)
  }
}

// Parse a Scala type string into { base, params[] }. e.g. "Map[String, Money]" → {base:'Map',params:['String','Money']}
function parseType(t) {
  const s = t.trim();
  const lb = s.indexOf('[');
  if (lb === -1) return { base: s, params: [] };
  const base = s.slice(0, lb);
  const inner = s.slice(lb + 1, s.lastIndexOf(']'));
  const params = [];
  let depth = 0, cur = '';
  for (const ch of inner) {
    if (ch === '[') depth++;
    if (ch === ']') depth--;
    if (ch === ',' && depth === 0) { params.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) params.push(cur.trim());
  return { base, params };
}

// dataType (truthsrc) → Scala type signature. 'string (uuid)'|'uuid' → Id; else verbatim.
export function scalaSig(dataType) {
  if (dataType === 'string (uuid)' || dataType === 'uuid') return 'Id';
  return dataType;
}

// Collect dependency rows [{ fqn, key }] for a Scala type string. `key` = the full sub-type
// signature (so distinctness includes type params, mirroring Set[TypeRef]). voImport supplies
// the fqn for an unknown base (value-object type with an explicit typeImport in canonical).
export function typeDeps(sig, fb, voImport) {
  const out = [];
  const walk = (typeStr) => {
    const { base, params } = parseType(typeStr);
    const pkg = pkgOf(base, fb);
    if (pkg === null) {
      if (voImport) out.push({ fqn: voImport, key: base });   // VO: dedup by base name
    } else if (pkg !== '') {
      out.push({ fqn: `${pkg}.${base}`, key: typeStr });       // dedup by full type string
    }
    params.forEach(walk);
  };
  walk(sig);
  return out;
}

// case-class field default (emptyDefaultFor): collection/Option get `= X.empty`/`= None`; scalar none.
export function fieldDefault(sig) {
  const { base } = parseType(sig);
  switch (base) {
    case 'Map': return 'Map.empty';
    case 'List': return 'List.empty';
    case 'Seq': return 'Seq.empty';
    case 'Set': return 'Set.empty';
    case 'Vector': return 'Vector.empty';
    case 'Option': return 'None';
    default: return undefined;
  }
}

// empty() neutral value (neutralValueFor): type → compilable zero value.
export function neutralValue(sig, fb) {
  const { base } = parseType(sig);
  switch (base) {
    case 'Id': return `${fb}.Id.of("${SENTINEL_ID}")`;
    case 'String': return '""';
    case 'Int':
    case 'Integer': return '1';
    case 'Long': return '1L';
    case 'Boolean': return 'false';
    case 'Double':
    case 'Float': return '1.0';
    case 'BigDecimal': return 'BigDecimal(1)';
    case 'Instant': return 'null';
    case 'Map': return 'Map.empty';
    case 'List':
    case 'Seq':
    case 'Set':
    case 'Vector': return 'Nil';
    case 'Option': return 'None';
    default: return 'null';
  }
}

// Sort + render an import multiset: input rows [{fqn,key}] across a file; dedup by (fqn+key),
// then one `import <fqn>` per surviving row, sorted by fqn (stable). selfPkg filter + extraFqns
// (self-qualified refs, framework singletons) handled by callers.
export function renderImports(rows) {
  const seen = new Set();
  const fqns = [];
  for (const r of rows) {
    const id = `${r.fqn}\u0000${r.key ?? r.fqn}`;
    if (seen.has(id)) continue;
    seen.add(id);
    fqns.push(r.fqn);
  }
  return fqns.sort().map((f) => `import ${f}`).join('\n');
}
