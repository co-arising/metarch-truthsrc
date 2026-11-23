// Unified emitter family registry (emitter-unification plan, F1/F2).
//
// One generator: every family is a module registered here under a single
// contract. The registry is fail-closed everywhere — a family that does not
// satisfy the contract shape is rejected at registration with diagnostics,
// an unknown id is rejected at lookup with the known-id list, and a render
// output that is not a clean relative-path → text map is rejected before any
// byte reaches disk (D-P08 discipline globalized).
//
// Family contract (uniform, per the plan §4 Phase 1):
//   id            registry key, kebab-case
//   familyNumber  the family number of the program ledger (#11…#42)
//   inputSchema   the curated JSON input schema (the sole emission input, F2)
//   goldenRoot    repo-relative curated golden tree (the family spec, F3)
//   fixtureDir    repo-relative fixture directory carrying input.json
//   toolsRef      repo-relative byte-parity reference generator (until classic
//                 retirement; provenance of the port, see families/*.mjs) — or
//                 null for a handwritten-golden family (ruling 2026-11-22:
//                 goldens curated by hand before any generator existed have no
//                 classic reference; the golden tree IS the spec, F3, and a
//                 duplicate byte-parity generator would break the one-generator
//                 program — such a family must declare
//                 provenance: 'handwritten-golden' and carries no tools-parity
//                 leg in the parity harness)
//   checkInput(input)             fail-closed validation, throws coded errors
//   renderAll(input) → map       byte-deterministic { relativePath: content }
//   runNegatives(input)|null      directed rejection battery; null = the ported
//                                 curated module carries no battery — a
//                                 registered debt, reported by the parity
//                                 harness, never silently accepted as "green"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fail = (code, message) => { throw Object.assign(new Error(code + ': ' + message), { code }); };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const families = new Map();

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SCHEMA_PATTERN = /^truthsrc\.[a-z0-9]+(-[a-z0-9]+)*-input\/v\d+$/;

const repoPathExists = (repoRelative, what) => {
  if (typeof repoRelative !== 'string' || repoRelative.length === 0)
    fail('EMITTER_REGISTRY', `${what} must be a nonempty repo-relative path`);
  const absolute = path.join(ROOT, repoRelative);
  if (!fs.existsSync(absolute))
    fail('EMITTER_REGISTRY', `${what} ${JSON.stringify(repoRelative)} does not exist in the repository (fail-closed: a family without its golden tree or fixture cannot be registered)`);
  return absolute;
};

export function registerFamily(family) {
  if (typeof family !== 'object' || family === null || Array.isArray(family))
    fail('EMITTER_REGISTRY', 'a family must be an object');
  const missing = ['id', 'familyNumber', 'inputSchema', 'goldenRoot', 'fixtureDir', 'toolsRef', 'checkInput', 'renderAll']
    .filter(member => !(member in family));
  if (missing.length)
    fail('EMITTER_REGISTRY', `family registration missing contract member(s): ${missing.join(', ')}`);
  if (typeof family.id !== 'string' || !ID_PATTERN.test(family.id))
    fail('EMITTER_REGISTRY', `family id ${JSON.stringify(family.id)} must be a kebab-case identifier`);
  if (!Number.isInteger(family.familyNumber) || family.familyNumber <= 0)
    fail('EMITTER_REGISTRY', `family ${family.id}: familyNumber must be a positive integer`);
  if (typeof family.inputSchema !== 'string' || !SCHEMA_PATTERN.test(family.inputSchema))
    fail('EMITTER_REGISTRY', `family ${family.id}: inputSchema ${JSON.stringify(family.inputSchema)} must be a truthsrc.<family>-input/v<N> schema id`);
  if (typeof family.checkInput !== 'function')
    fail('EMITTER_REGISTRY', `family ${family.id}: checkInput must be a function (fail-closed validation is not optional)`);
  if (typeof family.renderAll !== 'function')
    fail('EMITTER_REGISTRY', `family ${family.id}: renderAll must be a function`);
  if (family.runNegatives !== undefined && family.runNegatives !== null && typeof family.runNegatives !== 'function')
    fail('EMITTER_REGISTRY', `family ${family.id}: runNegatives must be a function or null (a missing battery is a declared debt, not an omission)`);
  if (family.toolsRef === null) {
    if (family.provenance !== 'handwritten-golden')
      fail('EMITTER_REGISTRY', `family ${family.id}: toolsRef null requires provenance 'handwritten-golden' (a family without a reference generator must declare its golden provenance)`);
  } else if (typeof family.toolsRef !== 'string' || !family.toolsRef.startsWith('tools/'))
    fail('EMITTER_REGISTRY', `family ${family.id}: toolsRef must point at the byte-parity reference generator under tools/ (or be null with provenance 'handwritten-golden')`);
  if (families.has(family.id))
    fail('EMITTER_REGISTRY', `family id ${family.id} is already registered (one generator, one registry entry per family)`);
  families.set(family.id, family);
  return family;
}

// Spec-tree existence is enforced at SPEC-USE time, not at registration
// (ruling 2026-11-23): the flip wiring makes the classic play-service generate
// path transitively import the family index, and the installed npm package
// contractually excludes test/reference/ (offline-tarball suites assert it) —
// while generation itself never reads the spec trees (they are F3 acceptance
// material for the parity harness and the diff/verify surfaces, both of which
// call this first and stay fail-closed with the same diagnostics).
export function requireFamilySpecPaths(family) {
  repoPathExists(family.goldenRoot, `family ${family.id} goldenRoot`);
  repoPathExists(family.fixtureDir, `family ${family.id} fixtureDir`);
  if (family.toolsRef !== null) repoPathExists(family.toolsRef, `family ${family.id} toolsRef`);
  return family;
}

export function getFamily(id) {
  if (typeof id !== 'string' || id.length === 0)
    fail('EMITTER_USAGE', 'family id must be nonempty text');
  const family = families.get(id);
  if (!family)
    fail('EMITTER_REGISTRY', `unknown family ${JSON.stringify(id)}; registered families: ${listFamilyIds().join(', ') || '(none)'}`);
  return family;
}

export function listFamilyIds() {
  return [...families.keys()].sort();
}

export function listFamilies() {
  return listFamilyIds().map(getFamily);
}

// The uniform emission path: strict deep copy → fail-closed validation →
// render → output-shape validation. Every emitter entry point (CLI, parity
// harness, future derivation layer) goes through this envelope so a family
// module cannot skip a gate.
export function renderFamily(family, input) {
  const checked = JSON.parse(JSON.stringify(input));
  family.checkInput(checked);
  const outputs = family.renderAll(JSON.parse(JSON.stringify(input)));
  if (typeof outputs !== 'object' || outputs === null || Array.isArray(outputs))
    fail('EMITTER_RENDER', `family ${family.id}: renderAll must return an object of relativePath → content`);
  const validated = {};
  for (const [relative, content] of Object.entries(outputs)) {
    if (typeof relative !== 'string' || relative.length === 0)
      fail('EMITTER_RENDER', `family ${family.id}: renderAll produced a non-text path key`);
    if (relative.startsWith('/') || relative.split(/[/\\]/).includes('..') || path.isAbsolute(relative))
      fail('EMITTER_RENDER', `family ${family.id}: renderAll path ${JSON.stringify(relative)} must be a clean relative path`);
    if (typeof content !== 'string')
      fail('EMITTER_RENDER', `family ${family.id}: renderAll content for ${JSON.stringify(relative)} must be text`);
    validated[relative] = content;
  }
  return validated;
}
