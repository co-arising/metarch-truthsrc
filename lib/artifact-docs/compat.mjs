import assert from 'node:assert/strict';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { DOC_ROOT, jsonBytes, readJson, sha256, unique, within } from './io.mjs';

const TARGETS = Object.freeze({ bc: 'skills/codegenerator/knowledge_base/artifacts', play: 'knowledge_base/artifacts' });
export function compatibilityPlan(catalog, directory, target) {
  assert.ok(Object.hasOwn(TARGETS, target), 'unknown compatibility target: ' + target);
  const spec = catalog.compatibility[target];
  assert.ok(spec && spec.directory === TARGETS[target], 'only fixed documentation destinations are admitted');
  assert.ok(Array.isArray(spec.documents) && spec.documents.every(name => /^[a-z][a-z0-9_-]*\.md$/.test(name)), 'only flat Markdown snapshot names are admitted');
  const byAlias = new Map(catalog.categories.flatMap(category => category.aliases.docs.map(alias => [alias, category])));
  const entries = spec.documents.map(name => {
    const category = byAlias.get(name);
    assert.ok(category, 'unmapped compatibility document: ' + name);
    const source = readFileSync(within(directory, category.document), 'utf8');
    const destinations = new Map(catalog.categories.map(category => [category.document,
      spec.documents.find(name => category.aliases.docs.includes(name))]));
    const copied = source.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (whole, label, href) => {
      if (/^[a-z]+:|^#/.test(href)) return whole;
      const [path, anchor] = href.split('#');
      const central = posix.normalize(posix.join(posix.dirname(category.document), path));
      const local = destinations.get(central);
      return local ? `[${label}](${local}${anchor ? '#' + anchor : ''})` : `${label}（公共包 docs/artifacts/${central}${anchor ? '#' + anchor : ''}）`;
    });
    const attribution = `<!-- Derived from @madpolaris/truthsrc docs/artifacts/${category.document}; catalog ${catalog.version}; source-sha256 ${sha256(source)}. Edit the central document, not this snapshot. -->\n\n`;
    return { path: spec.directory + '/' + name, content: attribution + copied, category: category.id };
  });
  unique(entries.map(entry => entry.path), 'compatibility output');
  entries.push({ path: spec.directory + '/catalog-index.json', content: jsonBytes({ schemaVersion: 'truthsrc.artifact-documentation-compat/v1',
    version: catalog.version, source: '@madpolaris/truthsrc/docs/artifacts',
    documents: entries.map(entry => ({ file: entry.path.slice(spec.directory.length + 1), category: entry.category, sha256: sha256(entry.content) })),
    dispatch: target === 'bc' ? catalog.dispatch : {} }) });
  return entries;
}
export function checkCompatibility({ root, target, directory = DOC_ROOT }) {
  const catalog = readJson(join(directory, 'catalog.json')), entries = compatibilityPlan(catalog, directory, target), diagnostics = [];
  for (const entry of entries) {
    const file = within(root, entry.path);
    if (!existsSync(file)) diagnostics.push({ code: 'MISSING_SNAPSHOT', file: entry.path });
    else if (sha256(readFileSync(file)) !== sha256(entry.content)) diagnostics.push({ code: 'SNAPSHOT_DRIFT', file: entry.path });
  }
  return { passed: diagnostics.length === 0, target, files: entries.length, diagnostics };
}
export function syncCompatibility({ root, target, directory = DOC_ROOT, expected }) {
  const catalog = readJson(join(directory, 'catalog.json')), entries = compatibilityPlan(catalog, directory, target);
  assert.ok(expected && typeof expected === 'object', 'explicit prior snapshot digests required');
  const prepared = entries.map(entry => {
    const file = within(root, entry.path), stat = lstatSync(file, { throwIfNoEntry: false });
    assert.ok(!stat || stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1, 'single-link regular snapshot required');
    const actual = stat ? sha256(readFileSync(file)) : null;
    assert.ok(Object.hasOwn(expected, entry.path) && expected[entry.path] === actual, 'snapshot changed or unapproved: ' + entry.path);
    return { ...entry, file, before: actual };
  });
  unique(Object.keys(expected), 'prior snapshot');
  assert.deepEqual(Object.keys(expected).sort(), prepared.map(entry => entry.path).sort(), 'exact snapshot inventory required');
  let written = 0;
  for (const entry of prepared) {
    const path = within(root, entry.path), stat = lstatSync(path, { throwIfNoEntry: false });
    assert.ok(!stat || stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1, 'snapshot links changed before write');
    const current = stat ? sha256(readFileSync(path)) : null;
    assert.equal(current, entry.before, 'snapshot changed before write: ' + entry.path);
    if (current === sha256(entry.content)) continue;
    mkdirSync(dirname(entry.file), { recursive: true });
    writeFileSync(entry.file, entry.content, { flag: current === null ? 'wx' : 'w' }); written++;
  }
  return { ...checkCompatibility({ root, target, directory }), written };
}
