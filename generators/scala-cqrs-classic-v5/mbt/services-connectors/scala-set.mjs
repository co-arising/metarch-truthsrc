import { collectDependencies, typeRef } from '../../../../lib/classic-architecture/types.mjs';

// Observable collection semantics only, not a type/name resolver. The frozen
// builders use scala.collection.immutable.Set (Set1..Set4, then CHAMP HashSet).
// Filtering a HashSet retains its factory; mapping it REHASHES even two strings.
// Algorithms follow the locally available Scala 2.13.16 sources Set.scala,
// HashSet.scala, ChampCommon.scala, Hashing.scala and MurmurHash3.scala.
// Scala sources: Copyright EPFL and Lightbend, Inc.; Apache License 2.0.
const rotl = (value, bits) => (value << bits) | (value >>> (32 - bits));
function mix(hash, value) {
  let data = Math.imul(value, 0xcc9e2d51);
  data = Math.imul(rotl(data, 15), 0x1b873593);
  return (Math.imul(rotl(hash ^ data, 13), 5) + 0xe6546b64) | 0;
}
function avalanche(value) {
  let hash = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return hash ^ (hash >>> 16);
}
const finalize = (hash, length) => avalanche(hash ^ length);
function stringHash(value) {
  // String.## is java.lang.String.hashCode, NOT MurmurHash3.stringHash.
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (Math.imul(hash, 31) + value.charCodeAt(i)) | 0;
  return hash;
}
function sequenceHash(values) {
  // MurmurHash3.seqHash: List/Vector agree, including arithmetic hash ranges.
  const seed = stringHash('Seq');
  if (values.length === 0) return finalize(seed, 0);
  const first = valueHash(values[0]);
  const h0 = mix(seed, first);
  if (values.length === 1) return finalize(h0, 1);
  let hash = h0;
  let previous = valueHash(values[1]);
  const difference = (previous - first) | 0;
  for (let i = 2; i < values.length; i++) {
    hash = mix(hash, previous);
    const current = valueHash(values[i]);
    if (difference === 0 || difference !== ((current - previous) | 0)) {
      hash = mix(hash, current);
      for (let j = i + 1; j < values.length; j++) hash = mix(hash, valueHash(values[j]));
      return finalize(hash, values.length);
    }
    previous = current;
  }
  return avalanche(mix(mix(h0, difference), previous));
}
function valueHash(value) {
  if (typeof value === 'string') return stringHash(value);
  let hash = mix(0xcafebabe, stringHash('TypeRef'));
  hash = mix(hash, stringHash(value.name));
  hash = mix(hash, stringHash(value.packageName));
  hash = mix(hash, sequenceHash(value.typeParams));
  return finalize(hash, 3);
}
function improvedHash(value) {
  const original = valueHash(value);
  let hash = (original + ~(original << 9)) | 0;
  hash ^= hash >>> 14;
  hash = (hash + (hash << 4)) | 0;
  return hash ^ (hash >>> 10);
}
function valueKey(value) {
  return typeof value === 'string' ? JSON.stringify(['String', value])
    : JSON.stringify(['TypeRef', value.name, value.packageName, value.typeParams.map(valueKey)]);
}
function detached(value) {
  return typeof value === 'string' ? value : typeRef(value.name, value.packageName, value.typeParams);
}
function distinct(values) {
  const seen = new Set();
  return values.filter(value => {
    const key = valueKey(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function hashIteration(values) {
  const records = values.map(value => ({ value, hash: improvedHash(value) }));
  // A full-hash collision's order depends on optimized node-to-node concat
  // history. Do not substitute insertion order for that unimplemented surface.
  const hashes = new Set();
  for (const record of records) {
    if (hashes.has(record.hash)) {
      throw new Error('Classic service Scala Set full-hash collision requires central collision-node semantics');
    }
    hashes.add(record.hash);
  }
  function scan(entries, shift) {
    if (entries.length <= 1) return entries.map(entry => entry.value);
    if (shift >= 32) throw new Error('Unexpected classic service Scala Set hash collision');
    const buckets = Array.from({ length: 32 }, () => []);
    for (const entry of entries) buckets[(entry.hash >>> shift) & 31].push(entry);
    // CHAMP yields ALL inline payloads, then child nodes, in bitmap order.
    return [
      ...buckets.filter(bucket => bucket.length === 1).map(bucket => bucket[0].value),
      ...buckets.filter(bucket => bucket.length > 1).flatMap(bucket => scan(bucket, shift + 5)),
    ];
  }
  return scan(records, 0);
}

/** Build a direct-element Set; do NOT expand TypeRef parameters here. */
export function scalaSet(values, representation = 'small') {
  if (!Array.isArray(values) || !['small', 'hash'].includes(representation)) {
    throw new TypeError('Classic service Set requires an array and small/hash representation');
  }
  const unique = distinct(values.map(detached));
  const kind = representation === 'hash' || unique.length > 4 ? 'hash' : 'small';
  return Object.freeze({
    representation: kind,
    values: Object.freeze(kind === 'hash' ? hashIteration(unique) : unique),
  });
}

/** Set ++ IterableOnce retains the left factory; the right sequence is ordered. */
export function concatScalaSet(left, rightValues) {
  return scalaSet([...left.values, ...rightValues], left.representation);
}
export function unionScalaSet(left, right) {
  return concatScalaSet(left, right.values);
}
export function filterScalaSet(set, predicate) {
  // Rebuild the trie after filtering: singleton children become inline payloads.
  return scalaSet(set.values.filter(predicate), set.representation);
}
export function mapScalaSet(set, transform) {
  return scalaSet(set.values.map(transform), set.representation);
}
export function flatMapScalaSet(set, transform) {
  return scalaSet(set.values.flatMap(transform), set.representation);
}

/** TypeRef.collectAllDependencies = Set(this) ++ typeParams.flatMap(recursion).
 * Central collectDependencies supplies validation, cloning and structural refs;
 * only the original collection operations/iteration are reconstructed here.
 */
export function scalaDependencySet(ref) {
  const [self] = collectDependencies([ref]);
  return concatScalaSet(scalaSet([self]),
    self.typeParams.flatMap(parameter => scalaDependencySet(parameter).values));
}

/** Seq[FieldDef/TypeRef].flatMap(_.collectAllDependencies), still a Seq. */
export function scalaDependencySequence(refs) {
  return refs.flatMap(ref => scalaDependencySet(ref).values);
}
