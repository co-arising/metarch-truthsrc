import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildTargetModel } from '../lib/scala-target/model.mjs';
import { parcelTargetInput } from './scala-target-fixture.mjs';

const root = fileURLToPath(new URL('./reference/module-seams/', import.meta.url));
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
  ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
const source = path => readFileSync(join(root, path), 'utf8');
const type = value => {
  if (value.form === 'primitive') return { string: 'String', integer: 'Long', boolean: 'Boolean', decimal: 'BigDecimal' }[value.name];
  if (value.form === 'nominal') return value.ref.id;
  if (value.form === 'sequence') return 'Vector[' + type(value.element) + ']';
  if (value.form === 'optional') return 'Option[' + type(value.element) + ']';
  if (value.form === 'map') return 'Map[' + type(value.key) + ', ' + type(value.value) + ']';
  if (value.form === 'either') return 'Either[' + type(value.left) + ', ' + type(value.right) + ']';
  assert.fail('unsupported test type');
};
const params = fields => fields.map(field => field.identifier + ': ' + type(field.valueType)).join(', ');

test('independent reference production inventory equals the finite structural model', () => {
  const model = buildTargetModel(parcelTargetInput());
  const actual = walk(root).filter(path => path.endsWith('.scala') && path.includes('/src/main/scala/')).map(path => path.slice(root.length)).sort();
  assert.deepEqual(model.files, actual);
  assert.equal(actual.length, 10);
  assert.equal(model.values.length, 8);
  for (const entry of [...model.values, ...model.ports, ...model.components]) {
    const text = source(entry.path);
    assert.ok(text.startsWith('package ' + entry.packageName + '\n'), entry.path);
    assert.match(text, new RegExp('\\b(?:class|trait|object) ' + entry.name + '\\b'));
    assert.doesNotMatch(text, /\?\?\?|@ImplementedBy|@knowledge/);
  }
});

test('nested value and port signatures agree with independently authored Scala', () => {
  const model = buildTargetModel(parcelTargetInput());
  for (const value of model.values) {
    const text = source(value.path);
    if (value.shape === 'record') assert.ok(text.includes('case class ' + value.name + '(' + params(value.fields) + ')'));
    else for (const variant of value.variants) assert.ok(text.includes(variant.fields.length
      ? 'case class ' + variant.name + '(' + params(variant.fields) + ') extends ' + value.name
      : 'case object ' + variant.name + ' extends ' + value.name));
  }
  for (const port of model.ports) for (const method of port.methods) {
    const returns = type(method.result.valueType);
    const signature = 'def ' + method.identifier + '(' + params(method.parameters) + '): ' +
      (method.result.effect === 'future' ? 'Future[' + returns + ']' : returns);
    assert.ok(source(port.path).includes(signature), signature);
  }
});

test('kernel sources and explicit build keep framework and outer implementation dependencies outside', () => {
  for (const path of walk(join(root, 'modules/kernel/src/main/scala'))) {
    const text = readFileSync(path, 'utf8');
    assert.doesNotMatch(text, /import\s+(?:akka|play|javax|com\.google|java\.(?:sql|io|net))\b|example\.parcel\.(?:infrastructure|composition|application\.DefaultQuoteFlow)/);
  }
  const build = source('build.sbt');
  assert.match(build, /lazy val glue[\s\S]*?\.dependsOn\(kernel\)/);
  assert.match(build, /lazy val ext[\s\S]*?\.dependsOn\(kernel, glue\)/);
  assert.match(build, /lazy val root[\s\S]*?\.dependsOn\(kernel, glue, ext\)/);
  assert.match(build, /scalatest-funsuite.*% Test/);
  assert.doesNotMatch(build, /akka|play|saga|monarch/i);
});

test('offline verifier rejects invalid CLI without running a JVM or falling back to implicit paths', () => {
  const verifier = join(root, 'verify.mjs');
  for (const args of [[], ['--help'], ['--java', 'relative'], ['--java', '/not-a-java', '--java', '/another'], ['--out']]) {
    const result = spawnSync(process.execPath, [verifier, ...args], { encoding: 'utf8', timeout: 10000,
      env: { PATH: '/usr/bin:/bin', NODE_V8_COVERAGE: '' } });
    assert.equal(result.status, 1);
    assert.equal(result.signal, null);
    assert.match(result.stderr, /Missing flag|Unknown flag|absolute path|Repeated flag|Missing value/);
  }
});

test('test discovery cannot implicitly launch the offline Scala verifier', () => {
  const result = spawnSync(process.execPath, [join(root, 'verify.mjs')], { encoding: 'utf8', timeout: 10000,
    env: { PATH: '/usr/bin:/bin', NODE_TEST_CONTEXT: 'child-v8', NODE_V8_COVERAGE: '' } });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});
