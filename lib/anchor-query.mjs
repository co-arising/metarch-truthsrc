import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute, sep, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { readAnchorsIndex, anchorIdentity } from '../src/core/anchors.mjs';

const inside = (root, file) => {
  const path = relative(root, file);
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`));
};

/** Query derived evidence, never canonical truth. Every verified file is checked
 * against current bytes; this does not create new parser/symbol certification.
 *
 * indexFile takes one path or several: each pipeline owns its own index file
 * (truthsrc core apply, backend codegen, ...) and the union happens here, never
 * in a merged derived file. Locations naming the same physical anchor through
 * different indexes collapse by their six-field identity; each index still fails
 * closed on its own (missing file or unknown version throws). */
export function queryAnchorsIndex(knowledgeKey, { indexFile, repoRoots } = {}) {
  const indexFiles = Array.isArray(indexFile) ? indexFile : indexFile == null ? [] : [indexFile];
  if (!indexFiles.length || !repoRoots || typeof repoRoots !== 'object' || Array.isArray(repoRoots)) {
    throw new Error('anchors query requires indexFile and explicit repoRoots');
  }
  const locations = [];
  const seen = new Set();
  for (const path of indexFiles) {
    const index = readAnchorsIndex(readFileSync(path, 'utf8'));
    for (const location of index.anchors[knowledgeKey] ?? []) {
      const identity = anchorIdentity(location);
      if (seen.has(identity)) continue;
      seen.add(identity);
      locations.push(location);
    }
  }
  return locations.map(location => {
    const root = Object.hasOwn(repoRoots, location.repo) ? repoRoots[location.repo] : null;
    if (!root || !isAbsolute(root)) throw new Error(`Absolute root required for anchor repository ${location.repo}`);
    const absoluteRoot = realpathSync(root);
    const target = resolve(absoluteRoot, location.file);
    if (!inside(absoluteRoot, target)) throw new Error('anchor file escapes its repository');
    try {
      for (let path = target; path !== absoluteRoot; path = dirname(path)) {
        if (lstatSync(path).isSymbolicLink()) throw new Error('anchor file crosses a symbolic link');
      }
      if (!inside(absoluteRoot, realpathSync(target)) || !lstatSync(target).isFile()) throw new Error('anchor target is not a repository file');
      const bytes = readFileSync(target);
      const fingerprint = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
      if (location.status !== 'source-verified') return { ...location, observedFingerprint: fingerprint };
      if (fingerprint !== location.fingerprint) return { ...location, status: 'stale',
        verification: { method: 'none', level: 'none', fileVerified: false, symbolVerified: false, spanVerified: false,
          reason: 'source-fingerprint-changed', observedFingerprint: fingerprint } };
      const evidence = location.verification.symbolEvidence?.span ?? location.span;
      if (evidence && !bytes.subarray(evidence.start, evidence.end).equals(Buffer.from(evidence.text))) {
        return { ...location, status: 'stale', verification: { method: 'none', level: 'none',
          fileVerified: false, symbolVerified: false, spanVerified: false, reason: 'source-span-changed' } };
      }
      return { ...location, freshness: 'current-bytes', observedFingerprint: fingerprint };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return { ...location, status: 'unmapped', verification: { method: 'none', level: 'none',
        fileVerified: false, symbolVerified: false, spanVerified: false, reason: 'source-missing' } };
    }
  });
}
