import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { absolutePath, files, hash, regular, snapshot, within } from '../compiler-tools.mjs';
import { captureEvidenceFile } from '../../../lib/verification/files.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export async function admitGeneration(receiptFile, toolRoot) {
  regular(absolutePath(receiptFile, 'generation receipt'));
  absolutePath(toolRoot, 'explicit producer root');
  assert.equal(fs.realpathSync(toolRoot), toolRoot);
  const receiptPin = captureEvidenceFile(receiptFile, { parse: bytes => JSON.parse(bytes.toString()) });
  const receipt = receiptPin.value;
  const project = regular(absolutePath(receipt.project, 'author project'));
  const generated = absolutePath(receipt.generated, 'generated root');
  assert.equal(fs.realpathSync(generated), generated);
  assert(!within(generated, toolRoot) && !within(toolRoot, generated));
  assert.equal(receipt.applied?.schemaVersion, 'truthsrc.project-result/v1');
  assert.equal(receipt.applied.applied, true);
  const source = receipt.applied.sources.filter(s => s.role === 'tool');
  assert.equal(source.length, 1);
  assert.equal(path.resolve(source[0].root), toolRoot, 'explicit executing producer differs from receipt');
  const api = await import(pathToFileURL(regular(path.join(toolRoot, 'lib/project/cli.mjs'))));
  const { verifyProject } = await import(pathToFileURL(regular(path.join(toolRoot, 'lib/project/verify.mjs'))));
  const captured = api.captureProject(project);
  assert.equal(captured.config.generator, 'scala-cqrs-play-application-v1');
  assert.deepEqual(captured.sources, receipt.applied.sources, 'stale writer source/producer inputs');
  const plan = api.projectPlan(captured, generated);
  assert.deepEqual(plan, receipt.plan.plan, 'receipt plan differs from current full public plan');
  const ledger = JSON.parse(fs.readFileSync(path.join(generated, 'truthsrc.ledger.json')));
  const inventory = files(generated);
  const expected = [...plan.entries.map(e => e.path), 'truthsrc.ledger.json', 'anchors.json'];
  assert.equal(new Set(expected).size, expected.length);
  assert.deepEqual(inventory.map(f => path.relative(generated, f)).sort(), expected.sort());
  assert.deepEqual(ledger.entries.map(e => e.path).sort(), plan.entries.map(e => e.path).sort());
  assert.deepEqual(receipt.applied.result.actions.map(e => e.path).sort(), plan.entries.map(e => e.path).sort());
  for (const entry of plan.entries) {
    const file = path.join(generated, entry.path), stored = ledger.entries.find(e => e.path === entry.path);
    const action = receipt.applied.result.actions.find(e => e.path === entry.path);
    assert.equal(hash(file), digest(Buffer.from(entry.content)), 'generated source bytes differ: ' + entry.path);
    assert.equal(stored.ownership.id, captured.file);
    assert.equal(stored.ownership.generator, plan.generator.id);
    assert.equal(stored.kind, entry.kind);
    assert.equal(action.kind, entry.kind);
    assert.equal(stored.ownership.fingerprint, 'sha256:' + hash(file));
    assert.equal(action.fingerprint, stored.ownership.fingerprint);
    assert(['ADD', 'COVER', 'MERGE', 'IDENTICAL'].includes(action.outcome));
  }
  const input = JSON.parse(fs.readFileSync(path.join(generated, '.truthsrc/inputs.json')));
  assert.deepEqual(input.sources, captured.sources);
  assert.deepEqual(input.implementations, captured.implementations);
  assert.equal(captured.implementations.members.length, 2, 'only explicit computations and authority implementations');
  const { buildModels } = await import(pathToFileURL(regular(path.join(toolRoot, 'generators/scala-cqrs-play-application-v1/build-models.mjs'))));
  const model = buildModels({ products: Object.fromEntries(captured.compilation.result.products.map(p => [p.id, p.payload])), options: captured.config.options });
  const oracleRoles = [['application', 'WarehouseApplication'], ['controller', 'WarehouseController'], ['settings', 'WarehouseSettings'],
    ['components', 'WarehouseComponents'], ['loader', 'WarehouseLoader'], ['lifecycle', 'WarehouseResourceLifecycle'],
    ['commands', 'WarehouseCommands'], ['queries', 'WarehouseQueries'], ['codec', 'WarehouseHttpCodec']];
  const oracleReplacements = [['example.inventory.', model.persistence.context.package + '.'],
    ...oracleRoles.map(([key, before]) => [before, model.names[key].name])].filter(([before, after]) => before !== after);
  assert.deepEqual(receipt.oracleReplacements ?? [], oracleReplacements, 'oracle ABI adaptation must match admitted model names');
  const verification = verifyProject({ project, out: generated });
  assert(verification.passed, JSON.stringify(verification.diagnostics));
  const outputPins = snapshot(inventory);
  const close = () => {
    api.assertUnchanged(captured);
    assert.equal(hash(receiptFile), receiptPin.sha256);
    assert.deepEqual(snapshot(files(generated)), outputPins);
  };
  close();
  return { receipt, captured, model, oracleReplacements, plan, outputPins, verification, close,
    files: [...inventory, project, receiptFile, ...captured.sources.filter(s => s.file).map(s => s.file)] };
}

export function stageFile(io, destination, file, pins) {
  const value = captureEvidenceFile(file);
  const expected = pins.find(p => p.path === file);
  assert(expected && expected.sha256 === value.sha256, 'source changed before staging: ' + file);
  return io.write(destination, value.value);
}
