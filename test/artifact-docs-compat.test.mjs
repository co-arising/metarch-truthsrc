import test from 'node:test';
import assert from 'node:assert/strict';
import { linkSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { compatibilityPlan, checkCompatibility, syncCompatibility } from '../lib/artifact-docs/compat.mjs';
import { DOC_ROOT, readJson, sha256 } from '../lib/artifact-docs/io.mjs';
const catalog = readJson(join(DOC_ROOT, 'catalog.json'));
function fixture(t, target = 'bc') {
  const root = mkdtempSync(join(tmpdir(), 'artifact-compat-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const entries = compatibilityPlan(catalog, DOC_ROOT, target);
  for (const entry of entries) {
    mkdirSync(dirname(join(root, entry.path)), { recursive: true });
    writeFileSync(join(root, entry.path), entry.content);
  }
  return { root, entries, target };
}

test('compatibility output is deterministic and contains full text rather than link-only stubs', () => {
  for (const target of ['bc', 'play']) {
    const entries = compatibilityPlan(catalog, DOC_ROOT, target);
    assert.deepEqual(entries, compatibilityPlan(catalog, DOC_ROOT, target));
    for (const entry of entries.filter(e => e.path.endsWith('.md'))) {
      assert.ok(entry.content.includes('## 输入与人工信息'));
      assert.ok(entry.content.includes('## 验证'));
      assert.ok(entry.content.includes('source-sha256'));
    }
  }
});

test('flat offline snapshots rewrite category links and retain package locators for support views', () => {
  const entries = compatibilityPlan(catalog, DOC_ROOT, 'bc');
  const serializer = entries.find(entry => entry.path.endsWith('/saga_serializer.md'));
  assert.ok(serializer.content.includes('公共包 docs/artifacts/CAPABILITY-MATRIX.md'));
  assert.ok(!serializer.content.includes('](../../CAPABILITY-MATRIX.md)'));
  const report = entries.find(entry => entry.path.endsWith('/strict_saga_definition.md'));
  assert.ok(report.content.includes('Strict'));
});

test('read-only snapshot checks reject mutation and missing files', t => {
  const f = fixture(t);
  assert.equal(checkCompatibility(f).passed, true);
  const file = join(f.root, f.entries[0].path);
  writeFileSync(file, 'tampered snapshot');
  assert.ok(checkCompatibility(f).diagnostics.some(d => d.code === 'SNAPSHOT_DRIFT'));
  rmSync(file);
  assert.ok(checkCompatibility(f).diagnostics.some(d => d.code === 'MISSING_SNAPSHOT'));
});

test('sync requires exact observed prior bytes and preserves unrelated files', t => {
  const f = fixture(t);
  const unrelated = join(f.root, 'unrelated.txt'); writeFileSync(unrelated, 'preserve');
  const expected = Object.fromEntries(f.entries.map(e => [e.path, sha256(readFileSync(join(f.root, e.path)))]));
  assert.equal(syncCompatibility({ ...f, expected }).written, 0);
  writeFileSync(join(f.root, f.entries[0].path), 'changed after inspection');
  assert.throws(() => syncCompatibility({ ...f, expected }), /unapproved/);
  assert.equal(readFileSync(unrelated, 'utf8'), 'preserve');
  expected[f.entries[0].path] = sha256('changed after inspection');
  assert.equal(syncCompatibility({ ...f, expected }).written, 1);
  assert.equal(checkCompatibility(f).passed, true);
});

test('unknown target and partial prior inventories fail before any writes', t => {
  const f = fixture(t);
  assert.throws(() => compatibilityPlan(catalog, DOC_ROOT, 'arbitrary'));
  assert.throws(() => syncCompatibility({ ...f, expected: {} }), /unapproved/);
});

test('hard-linked snapshot targets cannot overwrite another file through the shared inode', t => {
  const f = fixture(t);
  const file = join(f.root, f.entries[0].path), other = join(f.root, 'protected.scala');
  rmSync(file); writeFileSync(other, 'protected source'); linkSync(other, file);
  const expected = Object.fromEntries(f.entries.map(e => [e.path, sha256(readFileSync(join(f.root, e.path)))]));
  assert.throws(() => syncCompatibility({ ...f, expected }), /single-link/);
  assert.equal(readFileSync(other, 'utf8'), 'protected source');
});

test('custom catalogue cannot redirect compatibility output into application sources', () => {
  const changed = structuredClone(catalog);
  changed.compatibility.bc.directory = 'src/main/scala';
  assert.throws(() => compatibilityPlan(changed, DOC_ROOT, 'bc'), /fixed documentation/);
  changed.compatibility.bc.directory = catalog.compatibility.bc.directory;
  changed.compatibility.bc.documents[0] = 'CodegenMain.scala';
  assert.throws(() => compatibilityPlan(changed, DOC_ROOT, 'bc'), /Markdown/);
});

test('central dispatch maps preserve distinct invariants, converters and helpers', () => {
  assert.equal(catalog.dispatch.mcp.InvariantRule, 'domain_invariant.md');
  assert.equal(catalog.dispatch.scala.InvariantRuleModel, 'domain_invariant.md');
  assert.equal(catalog.dispatch.mcp.AggregateConverter, 'proto_converters.md');
  assert.equal(catalog.dispatch.scala.AggregateConverterModel, 'proto_converters.md');
  assert.equal(catalog.dispatch.scala.CommandHelperModel, 'command_helpers.md');
});
