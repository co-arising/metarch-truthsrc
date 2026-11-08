import assert from 'node:assert/strict';
import { readFileSync, realpathSync, lstatSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { absolutePath, files, regular, snapshot, within } from '../compiler-tools.mjs';
import { captureEvidenceFile } from '../../../lib/verification/files.mjs';
import { modules, handwrittenInventory, referenceInventory, generatedInventory, variantInventory } from './contract.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function exactInventory(actual, expected, label) {
  assert.equal(new Set(actual).size, actual.length, 'Duplicate ' + label);
  assert.deepEqual([...actual].sort(), [...expected].sort(), 'Incomplete or extra ' + label);
}
const directory = path => {
  absolutePath(path, 'input directory');
  assert(lstatSync(path).isDirectory() && realpathSync(path) === path, 'Canonical input directory required');
  return path;
};
const normalizeRoot = root => root.endsWith('/') ? root.slice(0, -1) : root;

export function checkWriter(source, receipt, ledger, plan, pins, owner, variant = 'main') {
  const writerInventory = variantInventory(variant).writer;
  assert.equal(receipt.schemaVersion, 'truthsrc.project-result/v1'); assert.equal(receipt.applied, true, 'Final apply receipt required');
  assert.equal(receipt.result?.name, 'scala-cqrs-module-seams'); assert.equal(ledger.generator, 'scala-cqrs-module-seams');
  assert.equal(receipt.result.ledger, join(source, 'truthsrc.ledger.json'));
  assert.equal(receipt.result.anchors, join(source, 'anchors.json'));
  exactInventory(plan.entries.map(e => e.path), writerInventory, 'main Parcel plan');
  exactInventory(ledger.entries.map(e => e.path), writerInventory, 'main Parcel ledger');
  exactInventory(receipt.result.actions.map(e => e.path), writerInventory, 'main Parcel writer actions');
  exactInventory(pins.map(e => e.path), writerInventory, 'main Parcel byte pins');
  assert.equal(receipt.result.total, writerInventory.length);
  for (const expected of plan.entries) {
    const pin = pins.find(p => p.path === expected.path), entry = ledger.entries.find(e => e.path === expected.path);
    const action = receipt.result.actions.find(e => e.path === expected.path);
    assert.equal(pin.sha256, digest(Buffer.from(expected.content)), 'Final bytes differ from fresh actual producer plan: ' + expected.path);
    assert.equal(entry.ownership?.id, owner); assert.equal(entry.ownership?.generator, 'scala-cqrs-module-seams');
    assert.equal(entry.kind, expected.kind); assert.equal(action.kind, expected.kind);
    assert.equal(entry.ownership.fingerprint, 'sha256:' + pin.sha256); assert.equal(action.fingerprint, entry.ownership.fingerprint);
    assert(['ADD', 'COVER', 'MERGE', 'IDENTICAL'].includes(action.outcome), 'Unaccepted writer action');
  }
}

export async function admitMixedInputs({ source, sourceReceipt, project, producerRoot, variant = 'main' }) {
  const { production, writer: writerInventory } = variantInventory(variant);
  directory(source); directory(producerRoot); regular(absolutePath(project, '--project'));
  regular(absolutePath(sourceReceipt, '--source-receipt'));
  assert(!within(sourceReceipt, source), 'Writer receipt must be outside generated source');
  assert(!within(source, producerRoot) && !within(producerRoot, source), 'Producer and output must be disjoint');
  const receiptFile = captureEvidenceFile(sourceReceipt, { parse: bytes => JSON.parse(bytes.toString()) });
  const receipt = receiptFile.value;
  const recorded = receipt.sources?.filter(s => s.role === 'tool');
  assert.equal(recorded?.length, 1, 'One explicit producer required');
  assert.equal(normalizeRoot(recorded[0].root), producerRoot, 'Receipt cannot select a different executing producer');
  const api = await import(pathToFileURL(regular(join(producerRoot, 'lib/project/cli.mjs'))).href);
  const captured = api.captureProject(project);
  assert.equal(captured.config.generator, 'scala-cqrs-module-seams-v1');
  assert.equal(captured.config.context, 'parcel');
  assert.equal(captured.config.canonicalId, 'parcel-domain');
  assert.deepEqual(captured.sources, receipt.sources, 'Final writer input/capture mismatch');
  assert.equal(captured.implementations.members.length, 3);
  const plan = api.projectPlan(captured, source);
  const outputPaths = files(source), outputPins = snapshot(outputPaths);
  exactInventory(outputPaths.map(path => relative(source, path)), [...writerInventory, 'truthsrc.ledger.json', 'anchors.json'], 'generated output');
  const inputs = JSON.parse(readFileSync(join(source, '.truthsrc/inputs.json')));
  assert.deepEqual(inputs.implementations, captured.implementations, 'Handwritten evidence differs from fresh live capability');
  assert.deepEqual(inputs.sources, captured.sources);
  const ledger = JSON.parse(readFileSync(join(source, 'truthsrc.ledger.json')));
  checkWriter(source, receipt, ledger, plan, writerInventory.map(path => ({ path, sha256: digest(readFileSync(join(source, path))) })), captured.file, variant);
  const sets = Object.fromEntries(modules.map(module => [module, production[module].map(path => ({
    path: join(source, path), destination: 'generated/' + path, role: 'generated', module,
  }))]));
  for (const module of modules) for (const h of handwrittenInventory[module]) {
    const member = captured.implementations.members.find(m => m.id === h.id);
    assert(member && member.module === module && member.file === h.file, 'Wrong finite implementation');
    sets[module].push({ path: member.absoluteFile, destination: 'handwritten/' + module + '/' + member.file, role: 'handwritten', module });
  }
  const sourcePins = snapshot(sets.kernel.concat(sets.glue, sets.ext, sets.root).map(row => row.path));
  const close = () => {
    api.assertUnchanged(captured);
    assert.equal(digest(readFileSync(sourceReceipt)), receiptFile.sha256, 'Writer receipt changed');
    assert.deepEqual(snapshot(files(source)), outputPins, 'Final writer output membership/bytes changed');
    assert.deepEqual(snapshot(sourcePins.map(p => p.path)), sourcePins, 'Mixed source changed');
  };
  close();
  return { sets, sourcePins, outputPins, producerRoot, project, source, sourceReceipt, plan,
    implementationEvidence: captured.implementations, close };
}

export function admitReferenceInputs(reference) {
  directory(reference);
  const all = files(reference), production = all.filter(path => /(?:^|\/)src\/main\/scala\//.test(path));
  exactInventory(production.map(path => relative(reference, path)), referenceInventory, 'reference production');
  const sets = Object.fromEntries(modules.map(module => [module, [
    ...generatedInventory[module], ...handwrittenInventory[module].map(h => h.reference),
  ].map(path => ({ path: join(reference, path), destination: 'reference/' + path, role: 'reference', module }))]));
  const sourcePins = snapshot(production);
  return { sets, sourcePins, reference, close: () => assert.deepEqual(snapshot(files(reference).filter(path => /(?:^|\/)src\/main\/scala\//.test(path))), sourcePins, 'Reference production changed') };
}

export function stageInputs(io, sets, pins) {
  const byPath = new Map(pins.map(p => [p.path, p.sha256]));
  return Object.fromEntries(Object.entries(sets).map(([module, sources]) => [module, sources.map(row => {
    const captured = captureEvidenceFile(row.path);
    assert.equal(captured.sha256, byPath.get(row.path), 'Staged source differs from admitted bytes');
    return { ...row, staged: io.write('inputs/' + row.destination, captured.value) };
  })]));
}
