import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, matchesGlob } from 'node:path';
import { parseStrictJson } from '../strict-json.mjs';
import { classifySource } from './classify.mjs';
import { emittedKinds } from './vocabulary.mjs';
import { compare, fileRecord, normalizedPath, readJson, sha256, unique, walk, within } from './io.mjs';

const excluded = /(^|\/)(?:target|node_modules|__pycache__|\.git)(?:\/|$)|\.(?:bak|tmp|log|tgz|sqlite|class|jar|pyc)$/;
export function discoverSources(root, scopes) {
  const selected = new Map();
  for (const scope of scopes) {
    assert.ok(scope.id && Array.isArray(scope.extensions) && Array.isArray(scope.paths));
    for (const prefix of scope.paths) {
      normalizedPath(prefix);
      const absolute = within(root, prefix);
      assert.ok(existsSync(absolute), 'required inventory root is missing: ' + prefix);
      const candidates = scope.files ? [prefix] : walk(root, prefix);
      for (const file of candidates) {
        if (excluded.test(file) || scope.excludePaths?.some(path => file === path || file.startsWith(path + '/')) ||
            !scope.extensions.some(extension => extension === '*' || file.endsWith(extension))) continue;
        const previous = selected.get(file);
        assert.ok(!previous || previous.scope === scope.id, 'overlapping inventory scope: ' + file);
        selected.set(file, { path: file, scope: scope.id });
      }
    }
  }
  return [...selected.values()].sort((a, b) => compare(a.path, b.path));
}

export function sourceFacts(file, bytes) {
  const text = bytes.toString('utf8');
  const facts = { declaredKinds: [], declarations: [], outputSites: [] };
  if (file.endsWith('/generator.json')) {
    const manifest = readJsonBytes(bytes);
    facts.manifest = { name: manifest.name, schemaVersion: manifest.schemaVersion ?? null,
      targetProfile: manifest.targetProfile ?? null, entrypoint: manifest.entrypoint ?? null,
      producers: manifest.producers ?? [], artifactKinds: manifest.artifactKinds ?? [] };
    facts.declaredKinds = [...new Set(manifest.artifactKinds ?? [])].sort(compare);
  }
  if (/\.(mjs|js|scala)$/.test(file)) {
    for (const match of text.matchAll(/\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|\b(?:case\s+)?(?:class|trait|object)\s+([A-Za-z_$][\w$]*)/g)) {
      facts.declarations.push(match[1] ?? match[2]);
    }
    for (const [index, line] of text.split('\n').entries()) {
      if (/\b(?:writeArtifact|ArtifactAttribution|writeFileSync|copyFileSync|appendRows|ledgerRow|entry)\s*\(|\b(?:Files\.write|Files\.copy)\s*\(|\bkind\s*:\s*['"]|\bpath\s*:\s*[`'"]/.test(line)) {
        facts.outputSites.push({ line: index + 1, sha256: sha256(line), excerpt: line.trim().slice(0, 180) });
      }
    }
    facts.declarations = [...new Set(facts.declarations)].sort(compare);
  }
  return facts;
}
function readJsonBytes(bytes) {
  return parseStrictJson(bytes);
}

export function inspectRepository(name, root, spec, categories, catalogCategories = []) {
  const current = discoverSources(root, spec.scopes);
  const expected = new Map(spec.files.map(row => [row.path, row]));
  unique(spec.files.map(row => row.path), name + ' source path');
  const diagnostics = [], checked = [];
  for (const row of current) {
    const prior = expected.get(row.path);
    if (!prior) { diagnostics.push({ code: 'UNDOCUMENTED_SOURCE', repo: name, file: row.path }); continue; }
    const bytes = readFileSync(within(root, row.path));
    const actual = fileRecord(root, row.path);
    if (actual.sha256 !== prior.sha256 || actual.bytes !== prior.bytes || actual.mode !== prior.mode)
      diagnostics.push({ code: 'SOURCE_DRIFT', repo: name, file: row.path });
    if (catalogCategories.length) {
      const classified = classifySource(name, row.path, bytes.toString('utf8'), catalogCategories);
      if (!classified || classified.categories.some(id => !prior.categories.includes(id)))
        diagnostics.push({ code: 'CLASSIFICATION_DRIFT', repo: name, file: row.path });
      const facts = sourceFacts(row.path, bytes);
      if (JSON.stringify(facts.outputSites) !== JSON.stringify(prior.outputSites))
        diagnostics.push({ code: 'OUTPUT_SITE_DRIFT', repo: name, file: row.path });
      if (['js', 'bc'].includes(name) && /\.(mjs|js|scala)$/.test(row.path)) {
        const vocabulary = emittedKinds(row.path, bytes.toString('utf8'));
        if (JSON.stringify(vocabulary.kinds) !== JSON.stringify(prior.emittedKinds ?? []) ||
            JSON.stringify(vocabulary.dynamic) !== JSON.stringify(prior.dynamicKinds ?? []))
          diagnostics.push({ code: 'OUTPUT_VOCABULARY_DRIFT', repo: name, file: row.path });
      }
    }
    if (!prior.disposition || !prior.reason || !Array.isArray(prior.categories) || !prior.categories.length ||
        prior.categories.some(id => !categories.has(id)))
      diagnostics.push({ code: 'SOURCE_CLASSIFICATION', repo: name, file: row.path });
    checked.push(row.path);
  }
  const present = new Set(current.map(row => row.path));
  for (const file of expected.keys()) if (!present.has(file)) diagnostics.push({ code: 'MISSING_SOURCE', repo: name, file });
  return { repo: name, checked: checked.length, discovered: current.length, diagnostics };
}

export function verifySourceReferences(catalog, lock) {
  const diagnostics = [];
  for (const category of catalog.categories) for (const variant of category.variants) for (const ref of variant.sourceRefs) {
    const spec = lock.repositories[ref.repo], record = spec?.files.find(row => row.path === ref.file);
    if (!record) diagnostics.push({ code: 'UNLOCKED_REFERENCE', category: category.id, ref });
    else if (!record.categories.includes(category.id)) diagnostics.push({ code: 'REFERENCE_CATEGORY', category: category.id, ref });
    if (record && ref.symbol !== '*' && ref.symbol && !record.symbols.includes(ref.symbol)) diagnostics.push({ code: 'REFERENCE_SYMBOL', category: category.id, ref });
  }
  return diagnostics;
}

export function productionToolFingerprint(root, { distributable = true } = {}) {
  const files = ['lib', 'src', 'generators', 'schema', 'scaffold'].flatMap(directory => walk(root, directory));
  files.push('bin/truthsrc.js', 'package.json');
  const exclusions = distributable ? (readJson(join(root, 'package.json')).files ?? []).filter(pattern => pattern.startsWith('!')).map(pattern => pattern.slice(1)) : [];
  const inventory = files.filter(file => !exclusions.some(pattern => matchesGlob(file, pattern))).sort(compare)
    .map(file => [file, sha256(readFileSync(within(root, file)))]);
  return sha256(JSON.stringify(inventory) + '\n');
}

export function generatedKinds(root) {
  const paths = walk(root, 'generators').filter(path => path.endsWith('/generator.json') && !excluded.test(path));
  return paths.map(file => ({ file, manifest: readJson(join(root, file)) }));
}
