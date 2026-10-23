// diff-apply.test.mjs — V4-7 gate: the diff-apply write policies.
//
//   • mergeManualBlocks — the MANUAL-block merge (manifest_merge.mjs port): generated base +
//     hand blocks implanted by def-anchor (ordered per same-name anchor), group-order pairing
//     for anchor-less blocks, orphan/malformed refusal (silent block loss is impossible).
//   • mergeRoutesBlock — the conf/routes E301 shared territory: marker-region swap with
//     byte-preserving outside territory, CRLF-normalized zero-write, CRLF alignment on real
//     changes, append + fingerprint-head prepend for marker-less targets, half-marker fail-fast.
//   • apply() integration — fresh-tree fill skips the routes block (live existsSync parity),
//     the routes merge preserves outer territory, a hand-edited MANUAL body survives
//     regeneration, ledger rows carry noteIds and no conf/routes row.
import { equal, ok, throws, rejects } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mergeManualBlocks, mergeRoutesBlock, hasManualBlocks } from '../src/core/merge.mjs';
import { apply } from '../src/core/generate.mjs';

const ROOT = join(import.meta.dirname, '..');
const API_GEN = join(ROOT, 'generators', '_deprecated', 'scala-cqrs-es-api');
const SKELETON_GEN = join(ROOT, 'generators', '_deprecated', 'scala-cqrs-es');
const CANON = join(ROOT, 'golden', 'scala-cqrs-es-metarch', 'model-catalog.canonical.json');
const HASHES = JSON.parse(readFileSync(join(ROOT, 'golden', 'scala-cqrs-es-api-metarch', 'elementHashes.json'), 'utf8'));
const SKELETON_HASHES = JSON.parse(readFileSync(join(ROOT, 'golden', 'scala-cqrs-es-metarch', 'elementHashes.json'), 'utf8'));

// ── mergeManualBlocks ──────────────────────────────────────────────────────────────────────
// (anchor shape = `def name(` — the manifest_merge anchorOf regex; a def with a type annotation
// between name and parens is anchor-less and pairs by group order instead)
const shell = (body) => `def applyFor(state: State, cmd: Cmd) = {
  // ==== BEGIN MANUAL ====
  ${body}
  // ==== END MANUAL ====
}
`;
// def-anchor implant: the hand body rides the regenerated shell.
const gen = shell('??? // mechanical skeleton');
const target = shell('state.items.map(customRanking) // hand-tuned');
equal(mergeManualBlocks(gen, target), shell('state.items.map(customRanking) // hand-tuned'), 'def-anchored block implant');

// Same-name anchors consume their blocks in appearance order (CommandHelpers' repeated objects).
const twoGen = `object A {
  def toParam(x: Int) = {
  // ==== BEGIN MANUAL ====
  gen-a-1
  // ==== END MANUAL ====
  }
  def toParam(y: Int) = {
  // ==== BEGIN MANUAL ====
  gen-a-2
  // ==== END MANUAL ====
  }
}`;
const twoTarget = twoGen
  .replace('gen-a-1', 'hand-a-1')
  .replace('gen-a-2', 'hand-a-2');
equal(mergeManualBlocks(twoGen, twoTarget), twoTarget, 'same-name anchors pair in order');

// Anchor-less blocks pair by group order.
const anonGen = 'x\n// ==== BEGIN MANUAL ====\ngen-1\n// ==== END MANUAL ====\ny\n// ==== BEGIN MANUAL ====\ngen-2\n// ==== END MANUAL ====\nz';
const anonTarget = anonGen.replace('gen-1', 'hand-1').replace('gen-2', 'hand-2');
equal(mergeManualBlocks(anonGen, anonTarget), anonTarget, 'anchor-less blocks pair by group order');

// Generated-side block with no target counterpart keeps the generated body (new method) while
// the existing anchor still implants.
const newMethodGen = `${shell('gen-apply')}
def extra(c: Int) = {
  // ==== BEGIN MANUAL ====
  gen-extra
  // ==== END MANUAL ====
}`;
ok(mergeManualBlocks(newMethodGen, shell('hand-apply')).includes('gen-extra'), 'target-less generated block keeps generated body');
ok(mergeManualBlocks(newMethodGen, shell('hand-apply')).includes('hand-apply'), 'target block still implanted');

// Orphan refusal: hand block anchored at a method the generator no longer emits.
const removedGen = `object B {
  def other(q: Int) = {
  // ==== BEGIN MANUAL ====
  gen-b
  // ==== END MANUAL ====
  }
}`;
throws(() => mergeManualBlocks(removedGen, shell('hand-orphan')), /无落点.*def applyFor/, 'orphan block refuses the merge');

// Malformed markers refuse.
throws(() => mergeManualBlocks(gen, 'def applyFor(state: State) = {\n  // ==== BEGIN MANUAL ====\n  x\n'), /不配对/, 'unpaired markers refuse');
equal(hasManualBlocks('def apply = {\n  // ==== BEGIN MANUAL ====\n  x\n'), false, 'hasManualBlocks gates on pairs');

// Hand blocks present + identical generated body → merge is the identity.
ok(mergeManualBlocks(target, target) === target, 'identical input passes through');

// ── mergeRoutesBlock ───────────────────────────────────────────────────────────────────────
const BLOCK = '# >>> gen_api_layer (E301) >>>\nPOST     /api/x/create  controllers.XApiController.create\n# <<< gen_api_layer <<<';
const BLOCK2 = '# >>> gen_api_layer (E301) >>>\nPOST     /api/x/create  controllers.XApiController.create\nPOST     /api/x/retire  controllers.XApiController.retire\n# <<< gen_api_layer <<<';
const routesFile = '# @generated by gen_api_layer:2026-08-26\nGET     /assets/*file  controllers.Assets.versioned\n' + BLOCK + '\nGET      /api/feed  controllers.FeedApiController.feed()\n';

// Segment swap: outer territory byte-preserved.
const swapped = mergeRoutesBlock(BLOCK2, routesFile);
ok(swapped.changed, 'region swap reports changed');
ok(swapped.text.includes('controllers.XApiController.retire'), 'new region in');
equal(swapped.text.split('# <<< gen_api_layer <<<')[1], '\nGET      /api/feed  controllers.FeedApiController.feed()\n', 'tail territory byte-preserved');
equal(swapped.text.split('# >>> gen_api_layer (E301) >>>')[0], '# @generated by gen_api_layer:2026-08-26\nGET     /assets/*file  controllers.Assets.versioned\n', 'head territory byte-preserved');

// Zero-write: identical region (LF) and CRLF-variant both report unchanged.
equal(mergeRoutesBlock(BLOCK, routesFile).changed, false, 'content-equal region → zero-write');
const crlfRoutes = routesFile.replace(/\n/g, '\r\n').replace(BLOCK.replace(/\n/g, '\r\n'), BLOCK.replace(/\n/g, '\r\n'));
equal(mergeRoutesBlock(BLOCK, crlfRoutes).changed, false, 'CRLF-variant equal region → zero-write');

// CRLF alignment: a real change into a CRLF-checked-out target lands CRLF.
const crlfTarget = routesFile.replace(/\n/g, '\r\n');
const aligned = mergeRoutesBlock(BLOCK2, crlfTarget);
ok(aligned.changed, 'crlf change detected');
ok(aligned.text.includes('POST     /api/x/create  controllers.XApiController.create\r\nPOST     /api/x/retire'), 'inserted region adopts CRLF');

// Append path: no markers → trimEnd + blank line + block; fingerprint head prepended when absent.
const bare = 'GET     /assets/*file  controllers.Assets.versioned\n';
const appended = mergeRoutesBlock(BLOCK, bare, { release: '1.0.0' });
equal(appended.text, `# @generated by gen_api_layer:2026-08-26\n# @knowledge-release 1.0.0\n${bare.replace(/\n$/, '')}\n\n${BLOCK}\n`, 'append + fingerprint head + release line');
const stamped = mergeRoutesBlock(BLOCK, `# @generated by other:1\n${bare}`);
ok(stamped.text.startsWith('# @generated by other:1\n'), 'existing fingerprint head kept');
ok(stamped.text.endsWith(`\n\n${BLOCK}\n`), 'append shape (trimEnd + blank line + block)');

// Half markers fail fast (MarkerBlockWriter H052/H053 — a silent append would double the start
// marker and the next swap would swallow manual territory).
throws(() => mergeRoutesBlock(BLOCK, 'x\n# >>> gen_api_layer (E301) >>>\ny'), /半标记/, 'start without end refuses');
throws(() => mergeRoutesBlock(BLOCK, 'x\n# <<< gen_api_layer <<<\ny'), /半标记/, 'end without start refuses');
throws(() => mergeRoutesBlock(BLOCK, `${BLOCK}\n${BLOCK}`), /重复/, 'duplicated markers refuse');

// ── apply() integration ────────────────────────────────────────────────────────────────────
const temp = mkdtempSync(join(tmpdir(), 'truthsrc-diffapply-'));
try {
  // Fresh tree: everything writes except the routes block (live existsSync guard — gen_api_layer
  // never creates conf/routes); the ledger carries noteIds and no conf/routes row.
  const fresh = join(temp, 'fresh');
  const r1 = await apply({ canonicalFile: CANON, generatorDir: API_GEN, outDir: fresh, options: { elementHashes: HASHES } });
  equal(r1.routesNoTarget, 1, 'routes block awaits a target conf/routes');
  equal(r1.written, 8, 'eight face files written (V4-13 vector + V4-14 aggregate-state controllers)');
  ok(!existsSync(join(fresh, 'conf', 'routes')), 'no conf/routes created');
  const ledger1 = JSON.parse(readFileSync(join(fresh, 'truthsrc.ledger.json'), 'utf8'));
  ok(!ledger1.entries.some((r) => r.path === 'conf/routes'), 'no ledger row for conf/routes (live C6)');
  const ctrlRow = ledger1.entries.find((r) => r.path === 'app/controllers/ModelCatalogApiController.scala');
  equal(ctrlRow.noteIds.length, 7, 'controller ledger row carries noteIds');
  equal(ledger1.entries.find((r) => r.path.endsWith('ViewWrites.scala')).noteIds.length, 33, 'ViewWrites ledger row carries view ids');
  ok(!('noteIds' in ledger1.entries.find((r) => r.kind === 'command-dsl')), 'CommandDsl row has no noteIds');

  // Idempotent second run.
  const r2 = await apply({ canonicalFile: CANON, generatorDir: API_GEN, outDir: fresh, options: { elementHashes: HASHES } });
  equal(r2.identical, 8, 'second run: all eight face files identical');
  equal(r2.routesNoTarget, 1, 'the routes block still awaits its target (nothing re-written)');
  equal(r2.written, 0, 'second run writes nothing');

  // Routes merge into a pre-existing shared file: outer territory survives, run is idempotent.
  const shared = join(temp, 'shared');
  mkdirSync(join(shared, 'conf'), { recursive: true });
  writeFileSync(join(shared, 'conf', 'routes'), '# @generated by gen_api_layer:2026-08-26\nGET     /assets/*file  controllers.Assets.versioned\n# >>> gen_api_layer (E301) >>>\nPOST     /api/stale/old  controllers.StaleApiController.old\n# <<< gen_api_layer <<<\nGET      /api/feed  controllers.FeedApiController.feed()\n');
  const r3 = await apply({ canonicalFile: CANON, generatorDir: API_GEN, outDir: shared, options: { elementHashes: HASHES } });
  equal(r3.written, 9, 'routes merge counts as a write');
  const mergedRoutes = readFileSync(join(shared, 'conf', 'routes'), 'utf8');
  ok(mergedRoutes.includes('controllers.ModelCatalogApiController.createCatalogVersion'), 'generated region swapped in');
  ok(!mergedRoutes.includes('StaleApiController'), 'stale region gone');
  ok(mergedRoutes.startsWith('# @generated by gen_api_layer:2026-08-26\nGET     /assets/*file'), 'head territory preserved');
  ok(mergedRoutes.endsWith('GET      /api/feed  controllers.FeedApiController.feed()\n'), 'tail territory preserved');
  const r4 = await apply({ canonicalFile: CANON, generatorDir: API_GEN, outDir: shared, options: { elementHashes: HASHES } });
  equal(r4.written, 0, 'routes merge idempotent (zero-write on content-equal region)');
  equal(r4.identical, 9, 'second run all identical');

  // MANUAL-block merge through a full skeleton apply: hand-tune a block, regenerate, block rides.
  const skel = join(temp, 'skel');
  await apply({ canonicalFile: CANON, generatorDir: SKELETON_GEN, outDir: skel, options: { generatorVersion: 'af096839', elementHashes: SKELETON_HASHES } });
  const behavRel = 'modules/kernel/src/main/scala/net/imadz/metarch/application/aggregates/behaviors/ModelCatalogBehaviors.scala';
  const behavPath = join(skel, behavRel);
  const behav1 = readFileSync(behavPath, 'utf8');
  ok(hasManualBlocks(behav1), 'skeleton emits MANUAL territory');
  // Hand edits in BOTH territories: the block body (preserved) and the header stamp outside it
  // (reverted — live C2 preserves exactly the MANUAL blocks, nothing else).
  const beginLine = behav1.indexOf('// ==== BEGIN MANUAL ====');
  const bodyStart = behav1.indexOf('\n', beginLine) + 1;
  const endLine = behav1.indexOf('// ==== END MANUAL ====', bodyStart);
  const handEdited = (behav1.slice(0, bodyStart) + '    state // hand-tuned dispatch\n' + behav1.slice(endLine))
    .replace('af096839', 'handstamp');
  writeFileSync(behavPath, handEdited);
  const r5 = await apply({ canonicalFile: CANON, generatorDir: SKELETON_GEN, outDir: skel, options: { generatorVersion: 'af096839', elementHashes: SKELETON_HASHES } });
  equal(r5.written, 1, 'the hand-edited file is rewritten (merge path)');
  equal(r5.merged, 1, 'counted as a merge');
  const behav2 = readFileSync(behavPath, 'utf8');
  ok(behav2.includes('hand-tuned dispatch'), 'hand body survived regeneration');
  ok(behav2.includes('af096839') && !behav2.includes('handstamp'), 'outside-block drift reverted to generated form');
  const r6 = await apply({ canonicalFile: CANON, generatorDir: SKELETON_GEN, outDir: skel, options: { generatorVersion: 'af096839', elementHashes: SKELETON_HASHES } });
  equal(r6.written, 0, 'merged result is a fixed point');

  // Refusal contract intact: drift OUTSIDE MANUAL territory without a concern still refuses.
  const drift = join(temp, 'drift');
  await apply({ canonicalFile: CANON, generatorDir: API_GEN, outDir: drift, options: { elementHashes: HASHES } });
  const vk = join(drift, 'modules/kernel/src/main/scala/net/imadz/metarch/infrastructure/auth/ViewKeys.scala');
  writeFileSync(vk, readFileSync(vk, 'utf8').replace('dor-verdicts', 'verdicts-of-dor'));
  await rejects(() => apply({ canonicalFile: CANON, generatorDir: API_GEN, outDir: drift, options: { elementHashes: HASHES } }), /refusing to overwrite/, 'non-MANUAL drift still refuses without a concern');
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log('✅ diff-apply — MANUAL-block merge (anchor implant · orphan refusal · fixed point) + routes territory (swap · append · fail-fast) + ledger noteIds');
