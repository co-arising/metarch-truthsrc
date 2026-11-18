import { typeRef } from './types.mjs';
import { ProductError } from '../products/request.mjs';

// Offline port of scala-library 2.13.16 (Apache-2.0), from the existing Coursier
// scala-library-2.13.16-sources.jar, SHA256
// c02edc324e7db59c52115214a6ef36e2d78d0a50dff635eda4dcee5502b1dea5.
// Sources: util/hashing/MurmurHash3.scala:20–53,64–94,237–268,330–357;
// collection/Hashing.scala:21–26; immutable/Set.scala:97–114,163–353,362–407;
// immutable/HashSet.scala:48–85,94–102,332–337,736–775,1437–1699,1738–1855;
// immutable/ChampCommon.scala:20–37,100–185; collection/Set.scala:226–246;
// collection/StrictOptimizedIterableOps.scala:87–120. Strings use Java's UTF-16
// hashCode, NOT MurmurHash3.stringHash: Statics.anyHash delegates to hashCode.
// Frozen .rounds/f1-byte-parity-20261116/bc-source TypeSystem.scala:4–8 declares
// the ordered product fields. Its pinned TypeRef.class (SHA256
// 6d5bfa1f4037f7acc4018c544f36b8ed3f9d79b26a6d6136b9697ca4dcf298c3) returns
// "TypeRef" from productPrefix and calls ScalaRunTime._hashCode from hashCode;
// ScalaRunTime.scala:158 delegates to productHash with productSeed 0xcafebabe.

function invalid(message) {
  throw new ProductError('CLASSIC_SCALA_SET', message);
}

function rotateLeft(value, distance) {
  return (value << distance) | (value >>> (32 - distance));
}

function mixLast(hash, data) {
  const block = Math.imul(rotateLeft(Math.imul(data, 0xcc9e2d51), 15), 0x1b873593);
  return hash ^ block;
}

function mix(hash, data) {
  return (Math.imul(rotateLeft(mixLast(hash, data), 13), 5) + 0xe6546b64) | 0;
}

function avalanche(hash) {
  let value = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return value ^ (value >>> 16);
}

function finalizeHash(hash, length) {
  return avalanche(hash ^ length);
}

function javaStringHash(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1)
    hash = (Math.imul(hash, 31) + value.charCodeAt(index)) | 0;
  return hash;
}

// All immutable Seq implementations in the pinned library have this value hash,
// including Nil/List and indexed sequences. The arithmetic-progression shortcut
// is observable even for two elements, and must not be replaced by a plain fold.
function seqHash(hashes) {
  const seed = javaStringHash('Seq');
  if (hashes.length === 0) return finalizeHash(seed, 0);
  let hash = mix(seed, hashes[0]);
  if (hashes.length === 1) return finalizeHash(hash, 1);
  const firstHash = hash;
  const difference = (hashes[1] - hashes[0]) | 0;
  let previous = hashes[1];
  for (let index = 2; index < hashes.length; index += 1) {
    hash = mix(hash, previous);
    const current = hashes[index];
    if (difference === 0 || difference !== ((current - previous) | 0)) {
      hash = mix(hash, current);
      for (let rest = index + 1; rest < hashes.length; rest += 1)
        hash = mix(hash, hashes[rest]);
      return finalizeHash(hash, hashes.length);
    }
    previous = current;
  }
  return avalanche(mix(mix(firstHash, difference), previous));
}

function typeRefHash(ref) {
  let hash = mix(0xcafebabe, javaStringHash('TypeRef'));
  hash = mix(hash, javaStringHash(ref.name));
  hash = mix(hash, javaStringHash(ref.packageName));
  hash = mix(hash, seqHash(ref.typeParams.map(typeRefHash)));
  return finalizeHash(hash, 3);
}

function improve(hash) {
  let value = (hash + ~(hash << 9)) | 0;
  value ^= value >>> 14;
  value = (value + (value << 4)) | 0;
  return value ^ (value >>> 10);
}

function refKey(ref) {
  return [ref.name, ref.packageName, ref.typeParams.map(refKey)];
}

// The supported Scala element universe is deliberately narrow: String and the
// exact frozen TypeRef product, not arbitrary JS objects or a universal hash.
function entry(value) {
  if (typeof value === 'string')
    return Object.freeze({ value, key: JSON.stringify(['String', value]), hash: improve(javaStringHash(value)) });
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      typeof value.name !== 'string' || typeof value.packageName !== 'string' ||
      !Array.isArray(value.typeParams))
    invalid('expected a String or structured TypeRef');
  const ref = typeRef(value.name, value.packageName, value.typeParams);
  return Object.freeze({ value: ref, key: JSON.stringify(['TypeRef', refKey(ref)]), hash: improve(typeRefHash(ref)) });
}

function iterable(values) {
  if (!values || typeof values[Symbol.iterator] !== 'function')
    invalid('expected an iterable of Strings or TypeRefs');
  return values;
}

function unique(entries) {
  const keys = new Set();
  return entries.filter(item => {
    if (keys.has(item.key)) return false;
    keys.add(item.key);
    return true;
  });
}

function buckets(entries, shift) {
  const result = Array.from({ length: 32 }, () => []);
  for (const item of entries) result[(item.hash >>> shift) & 31].push(item);
  return result;
}

// CHAMP is NOT lexicographic sorting of hash chunks: every node emits all its
// inline payloads first, then child nodes by ascending mask. A full 32-bit hash
// collision emits its Vector in insertion order. Grouping reconstructs that
// canonical topology without copying Scala's mutable bitmap storage machinery.
function champOrder(entries, shift = 0) {
  if (shift >= 32) return entries;
  const groups = buckets(entries, shift);
  const payloads = groups.filter(group => group.length === 1).flat();
  const children = groups.filter(group => group.length > 1)
    .flatMap(group => champOrder(group, shift + 5));
  return payloads.concat(children);
}

// HashSet ++ HashSet uses node union, not iteration followed by +. In particular
// a left inline payload joining a right child is added to the RIGHT child;
// this reverses the naive left-first order for full-hash collisions in that case.
function unionBucket(left, right, shift) {
  if (left.length === 0) return right;
  if (right.length === 0) return left;
  if (left.length === 1 && right.length > 1)
    return champOrder(unique(right.concat(left)), shift);
  return unionEntries(left, right, shift);
}

function unionEntries(left, right, shift = 0) {
  if (right.length <= 1 || shift >= 32)
    return champOrder(unique(left.concat(right)), shift);
  const leftGroups = buckets(left, shift);
  const rightGroups = buckets(right, shift);
  const merged = leftGroups.flatMap((group, mask) =>
    unionBucket(group, rightGroups[mask], shift + 5));
  return champOrder(merged, shift);
}

function makeSet(entries, forceHashSet = false) {
  const distinct = unique(entries);
  const hashed = forceHashSet || distinct.length > 4;
  return new ScalaStructuralSet(hashed ? champOrder(distinct) : distinct, hashed);
}

class ScalaStructuralSet {
  #entries;
  #hashed;

  constructor(entries, hashed) {
    this.#entries = Object.freeze(entries);
    this.#hashed = hashed;
    Object.freeze(this);
  }

  get size() { return this.#entries.length; }
  get representation() { return this.#hashed ? 'HashSet' : `Set${this.size}`; }
  toArray() { return Object.freeze(this.#entries.map(item => item.value)); }
  [Symbol.iterator]() { return this.toArray()[Symbol.iterator](); }

  // Set.from / an immutable Set's toSet retains the existing representation.
  toSet() { return this; }
  contains(value) {
    const key = entry(value).key;
    return this.#entries.some(item => item.key === key);
  }

  incl(value) {
    return makeSet(this.#entries.concat(entry(value)), this.#hashed);
  }

  concat(values) {
    if (values instanceof ScalaStructuralSet && this.#hashed && values.#hashed)
      return makeSet(unionEntries(this.#entries, values.#entries), true);
    const additions = Array.from(iterable(values), entry);
    return makeSet(this.#entries.concat(additions), this.#hashed);
  }

  // Predicates/transforms must be pure. These methods reproduce result values
  // and iteration, not Scala's internal callback evaluation order or identity.
  filter(predicate) {
    return makeSet(this.#entries.filter(item => predicate(item.value)), this.#hashed);
  }

  map(transform) {
    return makeSet(this.#entries.map(item => entry(transform(item.value))), this.#hashed);
  }

  flatMap(transform) {
    const entries = this.#entries.flatMap(item => Array.from(iterable(transform(item.value)), entry));
    return makeSet(entries, this.#hashed);
  }
}

/** Scala immutable.Set.from / Seq.toSet for String and TypeRef values.
 * Returns an immutable iterable facade with size, representation, toArray(),
 * toSet(), contains(), incl(), concat(), filter(), map(), and flatMap(). Existing
 * facades retain provenance; an ordinary iterable constructs a fresh Set0–4 or
 * HashSet. HashSet filter/map/flatMap stay HashSet even below five elements.
 * Mapping to other Scala products requires their real product hashes, so it is
 * intentionally unsupported rather than silently using a JSON/string hash.
 */
export function scalaSetFrom(refs) {
  if (refs instanceof ScalaStructuralSet) return refs;
  return makeSet(Array.from(iterable(refs), entry));
}

/** Frozen TypeRef array in fresh Scala Set iteration order (not dependencies).
 * For operation chains, retain scalaSetFrom's facade until the final toArray;
 * rebuilding from an intermediate array loses HashSet/factory provenance.
 */
export function scalaTypeRefSet(refs) {
  const set = scalaSetFrom(refs);
  const values = set.toArray();
  if (values.some(value => typeof value === 'string'))
    invalid('scalaTypeRefSet requires TypeRefs, not Strings');
  return values;
}

// mutable.Set delegates to mutable.HashSet in the pinned library. Its hash table
// differs from CHAMP: xor-high16 hashing, signed hash order within each bucket,
// default capacity 16/load factor .75, and add-before-duplicate-check resizing.
function mutableTypeRefOrder(refs) {
  let table = Array.from({ length: 16 }, () => []), size = 0;
  for (const value of iterable(refs)) {
    const item = entry(value);
    if (typeof item.value === 'string') invalid('mutable TypeRef Set requires TypeRefs');
    if (size + 1 >= Math.floor(table.length * 0.75)) {
      if (table.length >= 1 << 30) invalid('mutable TypeRef Set capacity exceeded');
      const length = table.length, grown = Array.from({ length: length * 2 }, () => []);
      table.forEach((bucket, index) => {
        for (const node of bucket) grown[index + ((node.hash & length) === 0 ? 0 : length)].push(node);
      });
      table = grown;
    }
    const rawHash = typeRefHash(item.value), hash = rawHash ^ (rawHash >>> 16);
    const bucket = table[hash & (table.length - 1)];
    let index = 0, duplicate = false;
    while (index < bucket.length && bucket[index].hash <= hash) {
      if (bucket[index].hash === hash && bucket[index].key === item.key) {
        duplicate = true; break;
      }
      index++;
    }
    if (!duplicate) {
      bucket.splice(index, 0, { value: item.value, key: item.key, hash });
      size++;
    }
  }
  return table.flat().map(item => item.value);
}

/** Frozen builder's sequential mutable.Set.add -> immutable.Set.from -> toSeq.
 * Retain add attempts (including duplicates), not only encounter-order uniques.
 * The final immutable factory reuses the central Set0-4/CHAMP implementation.
 */
export function scalaTypeRefSetIteration(refs, operation) {
  if (operation !== 'mutable-set-to-immutable-set') invalid('unsupported TypeRef Set operation');
  return scalaTypeRefSet(mutableTypeRefOrder(refs));
}
