import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, sep } from 'node:path';
import { captureProject, localPath, projectPlan, assertUnchanged } from './cli.mjs';
import { projectGraphFile, graphSelection } from './graph.mjs';
import { createProjectQuerySession } from './query.mjs';
import { exportKnowledgeAst } from '../knowledge-graph.mjs';
import { SqliteKnowledgeGraphStore } from '../knowledge-sqlite.mjs';
import { parseStrictJson } from '../strict-json.mjs';
import { captureProductJson } from '../products/cli.mjs';
import { resolveSourcePointer } from '../source-index.mjs';
import { readAnchorsIndex } from '../../src/core/anchors.mjs';
import { generatedFingerprint } from '../../src/core/apply-preflight.mjs';
import { validateCodeMappings, finalMappingSpan } from '../../src/core/code-mappings.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fingerprint = bytes => 'sha256:' + sha(bytes);
const same = (a, b, message) => assert.deepStrictEqual(a, b, message);
const checkNames = ['currentInputs', 'graphSnapshot', 'graphAst', 'plannedFiles', 'finalBytes', 'ownership',
  'anchorMembership', 'anchorSpans', 'sameGraphAnchors', 'sourceAssociations', 'requiredCoverage', 'captureUnchanged'];
const buildDirectories = new Set(['target', 'project/target', 'project/project/target']);
const associations = entry => [...new Set([...(entry.knowledgeId ? [entry.knowledgeId] : []),
  ...(entry.knowledgeIds || []), ...(entry.noteIds || [])])].sort();
const locations = rows => rows.map(row => ({ file: row.file, span: row.span ?? null }))
  .sort((a, b) => a.file.localeCompare(b.file) || (a.span?.start ?? -1) - (b.span?.start ?? -1) || (a.span?.end ?? -1) - (b.span?.end ?? -1));
const inside = (root, path) => { const p = relative(root, path); return p === '' || !isAbsolute(p) && p !== '..' && !p.startsWith('..' + sep); };

function requirements(input) {
  assert.ok(Array.isArray(input) && input.length <= 100, 'required must be an array of at most 100 selectors');
  return input.map(row => {
    const value = typeof row === 'string' ? { knowledge: row, precision: 'span', minLocations: 1 } : row;
    assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'invalid coverage requirement');
    assert.ok(Object.keys(value).every(key => ['knowledge', 'precision', 'minLocations'].includes(key)), 'unknown coverage field');
    assert.ok(typeof value.knowledge === 'string' && value.knowledge.trim(), 'knowledge selector required');
    const precision = value.precision ?? 'span', minLocations = value.minLocations ?? 1;
    assert.ok(['span', 'file'].includes(precision) && Number.isSafeInteger(minLocations) && minLocations > 0,
      'coverage needs file/span precision and a positive minimum');
    return { knowledge: value.knowledge, precision, minLocations };
  });
}

function fileSet(root, current = '') {
  const directory = localPath(root, current || '.');
  const stat = lstatSync(directory);
  assert.ok(stat.isDirectory() && !stat.isSymbolicLink(), 'regular output directory required');
  return readdirSync(directory).sort().flatMap(name => {
    const path = current ? current + '/' + name : name, full = localPath(root, path), info = lstatSync(full);
    if (info.isDirectory()) return buildDirectories.has(path) ? [] : fileSet(root, path);
    assert.ok(info.isFile() && !info.isSymbolicLink() && info.nlink === 1, 'plain single-linked output file required: ' + path);
    return [path];
  });
}

export function inspectProject({ project, out, required = [] }) {
  const result = { schemaVersion: 'truthsrc.project-verification/v1', passed: false, project, output: out,
    snapshot: null, graph: null, codeDigest: null, files: [], checks: Object.fromEntries(checkNames.map(key => [key, false])),
    counts: { files: 0, knowledgeKeys: 0, locations: 0, spans: 0, fileCandidates: 0 }, coverage: [], diagnostics: [], runtimeVerified: false,
    limitations: ['This is source, graph and anchor verification, not Scala execution or banking-service acceptance.',
      'Only declared mappings are precise; file candidates are not symbol or call-graph certification.',
      'Build artifact directories are excluded; generated source/configuration membership remains exact.'] };
  let store, stage = 'currentInputs';
  const buffers = new Map(), observed = new Map();
  try {
    const requested = requirements(required), captured = captureProject(project, { roundtripCheck: false });
    project = captured.file; out = localPath(process.cwd(), out);
    result.project = project; result.output = out;
    assert.ok(!inside(out, project) && !inside(captured.tree, out) && !inside(out, captured.tree), 'output overlaps author inputs');
    const read = file => {
      const full = localPath(out, file), info = lstatSync(full);
      assert.ok(inside(out, full) && info.isFile() && !info.isSymbolicLink() && info.nlink === 1, 'plain owned file required: ' + file);
      assert.ok(info.size <= 32 * 1024 * 1024, 'file exceeds verification limit: ' + file);
      if (!observed.has(full)) observed.set(full, readFileSync(full));
      return observed.get(full);
    };
    const json = file => parseStrictJson(read(file));
    const inputs = json('.truthsrc/inputs.json');
    same(inputs.sources, captured.sources, 'project inputs or tool changed; generate an explicit update before verification');
    same(inputs.sourceIndex, captured.sourceIndex, 'current source index differs');
    assert.ok(inputs.validation?.hard?.length === 0 && inputs.validation?.roundtrip?.ok === true, 'generation has no successful validation/roundtrip evidence');
    result.checks.currentInputs = true; result.snapshot = inputs.sourceIndex.snapshot;

    stage = 'graphSnapshot';
    assert.equal(inputs.graph?.schemaVersion, 'truthsrc.project-graph/v1', 'same-graph generation evidence required');
    store = new SqliteKnowledgeGraphStore(localPath(process.cwd(), projectGraphFile(project)), { readonly: true });
    const snapshot = store.readSnapshot({ project, id: inputs.graph.snapshot });
    same(snapshot.capture.canonical, captured.canonical, 'graph canonical differs from current source');
    same(snapshot.capture.sourceIndex, captured.sourceIndex, 'graph author mappings differ');
    same(snapshot.capture.request, captured.request, 'graph request differs');
    same(snapshot.capture.compilation, captured.compilation, 'graph products differ');
    result.checks.graphSnapshot = true;

    stage = 'graphAst';
    const ast = exportKnowledgeAst(store, { project, snapshot: snapshot.id, expectedSources: captured.sources });
    same(graphSelection(ast, out), inputs.graph, 'generation is bound to another output/snapshot');
    const plan = projectPlan(captured, out, ast);
    result.graph = inputs.graph; result.checks.graphAst = true;

    stage = 'plannedFiles';
    const ledger = json('truthsrc.ledger.json'), anchors = readAnchorsIndex(json('anchors.json'));
    assert.equal(ledger.generator, plan.generator.id, 'generator differs');
    assert.ok(Array.isArray(ledger.entries), 'ownership ledger entries required');
    const rows = new Map(ledger.entries.map(row => [row.path, row]));
    assert.equal(rows.size, ledger.entries.length, 'duplicate ledger paths');
    same([...rows.keys()].sort(), plan.entries.map(row => row.path).sort(), 'missing, foreign or retained ledger entry');
    const beforeFiles = fileSet(out);
    same(beforeFiles, [...rows.keys(), 'truthsrc.ledger.json', 'anchors.json'].sort(), 'unplanned/missing output files');
    result.checks.plannedFiles = true;

    const expected = new Map();
    for (const entry of plan.entries) {
      stage = 'finalBytes';
      assert.ok(!entry.noLedger && !entry.merge, 'shared/merged entry is outside project verification: ' + entry.path);
      const bytes = read(entry.path); buffers.set(entry.path, bytes);
      if (entry.path === '.truthsrc/inputs.json') {
        const expectedInputs = parseStrictJson(entry.content);
        for (const key of ['sources', 'sourceIndex', 'generatedFiles', 'canonicalId', 'graph']) same(inputs[key], expectedInputs[key], 'generation input differs: ' + key);
      } else assert.equal(generatedFingerprint(bytes, entry.path), generatedFingerprint(Buffer.from(entry.content), entry.path),
        'source differs from current registered producer outside MANUAL blocks: ' + entry.path);
      stage = 'ownership';
      const row = rows.get(entry.path);
      same([row.kind, row.ownership?.id, row.ownership?.generator], [entry.kind, project, plan.generator.id], 'ownership differs: ' + entry.path);
      assert.equal(row.ownership.fingerprint, fingerprint(bytes), 'final bytes not re-anchored: ' + entry.path);
      assert.equal(row.ownership.generatedFingerprint, generatedFingerprint(bytes, entry.path), 'generated fingerprint differs');
      same(associations(row), associations(entry), 'declared knowledge membership differs');
      stage = 'anchorSpans';
      const mappings = validateCodeMappings(entry);
      for (const key of associations(entry)) {
        const selected = mappings.filter(mapping => mapping.knowledgeKey === key);
        const spans = selected.map(mapping => {
          const span = finalMappingSpan(mapping, entry.content, bytes);
          assert.ok(span, 'required span cannot be relocated unambiguously: ' + entry.path);
          return span;
        });
        if (!expected.has(key)) expected.set(key, []);
        expected.get(key).push(...(spans.length ? spans : [null]).map(span => ({ file: entry.path, span })));
      }
      if (entry.kind !== 'project-evidence') result.files.push({ file: entry.path, bytes: bytes.length, sha256: sha(bytes) });
    }
    result.checks.finalBytes = true; result.checks.ownership = true;
    stage = 'anchorMembership';
    same(Object.keys(anchors.anchors).sort(), [...expected.keys()].sort(), 'anchor knowledge membership differs from producer plan');
    for (const [key, expectedLocations] of expected) {
      same(locations(anchors.anchors[key]), locations(expectedLocations), 'anchor file/span associations differ: ' + key);
      for (const location of anchors.anchors[key]) {
        stage = 'anchorSpans';
        const bytes = buffers.get(location.file);
        same([location.repo, location.generator, location.generatorVersion, location.status],
          [out, plan.generator.id, String(plan.generator.version), 'source-verified'], 'foreign or unverified anchor');
        assert.equal(location.fingerprint, fingerprint(bytes), 'anchor fingerprint differs');
        assert.equal(location.verification.fileVerified, true, 'file evidence missing');
        assert.equal(location.symbol, null, 'registered project producer does not declare symbol evidence');
        assert.equal(location.module, null, 'registered project producer does not declare module evidence');
        assert.equal(location.verification.symbolVerified, false, 'unplanned symbol certification');
        assert.equal(location.verification.symbolEvidence, undefined, 'unplanned symbol parser evidence');
        assert.equal(location.verification.level, location.span ? 'span' : 'file', 'unexpected anchor precision');
        if (location.span) {
          assert.equal(location.verification.spanVerified, true, 'span evidence missing');
          assert.ok(bytes.subarray(location.span.start, location.span.end).equals(Buffer.from(location.span.text)), 'span bytes differ');
          result.counts.spans++;
        } else result.counts.fileCandidates++;
        result.counts.locations++;
      }
    }
    result.checks.anchorMembership = true; result.checks.anchorSpans = true;
    result.counts.files = result.files.length; result.counts.knowledgeKeys = expected.size;

    stage = 'sameGraphAnchors';
    const published = store.queryCodeAnchors({ project, snapshot: snapshot.id, generation: inputs.graph.generation });
    same(readAnchorsIndex(published.anchors), anchors, 'graph anchors disagree with exchange index');
    same([published.receipt.output, published.receipt.generator, published.receipt.ledger],
      [out, captured.config.generator, localPath(out, 'truthsrc.ledger.json')], 'graph anchor receipt differs');
    const prefix = 'source:' + captured.config.canonicalId + '#';
    const expectedAssociations = Object.keys(anchors.anchors).map(key => ({ key,
      identities: key.startsWith(prefix) ? [...new Set(resolveSourcePointer(captured.sourceIndex, key.slice(prefix.length)).map(row => row.identity))] : [] }));
    same(published.receipt.associations, expectedAssociations, 'stored graph identity associations differ');
    result.checks.sameGraphAnchors = true;

    stage = 'sourceAssociations';
    const query = createProjectQuerySession({ captured, anchors });
    const unresolved = [];
    for (const key of expected.keys()) {
      const origins = query.origins(key);
      if (!origins.length || origins.every(row => !row.file || row.relation === 'unresolved')) unresolved.push(key);
      for (const origin of origins) if (origin.file && origin.kind !== 'technical-binding') {
        const file = localPath(captured.tree, origin.file);
        assert.ok(inside(captured.tree, file) && captured.sources.some(row => row.file === file), 'origin is not a real captured author file');
      }
    }
    result.counts.unresolvedKeys = unresolved.length;
    result.unresolved = unresolved;
    assert.equal(unresolved.length, 0, 'planned anchors lack real author or explicit technical origins');
    result.checks.sourceAssociations = true;

    stage = 'requiredCoverage';
    result.coverage = requested.map(request => {
      const selected = query.select(request.knowledge), identities = [...new Set(selected.map(row => row.identity))];
      const found = query.forward(request.knowledge).flatMap(row => row.locations);
      const matched = found.filter(row => request.precision !== 'span' || row.span && row.verification.spanVerified);
      const unique = new Set(matched.map(row => JSON.stringify([row.file, row.span ?? null])));
      const passed = identities.length === 1 && selected.every(row => row.file && row.relation !== 'unresolved') && unique.size >= request.minLocations;
      return { ...request, identities, locations: unique.size, passed };
    });
    assert.ok(result.coverage.every(row => row.passed), 'required knowledge is missing, ambiguous or below requested precision');
    result.checks.requiredCoverage = true;

    stage = 'captureUnchanged';
    same(fileSet(out), beforeFiles, 'output membership changed during verification');
    for (const [file, bytes] of observed) assert.ok(readFileSync(localPath(process.cwd(), file)).equals(bytes), 'output changed during verification: ' + file);
    same(store.queryCodeAnchors({ project, snapshot: snapshot.id, generation: inputs.graph.generation }), published, 'graph anchors changed during verification');
    assertUnchanged(captured);
    result.checks.captureUnchanged = true;
    result.files.sort((a, b) => a.file.localeCompare(b.file));
    result.codeDigest = fingerprint(JSON.stringify(result.files));
    result.passed = true;
    return { result, captured, snapshot, anchors, query, buffers, plan };
  } catch (error) {
    result.diagnostics.push({ code: 'PROJECT_VERIFICATION_' + stage.toUpperCase(), stage,
      message: error.code === 'ERR_ASSERTION' ? error.message.split('\n\n')[0] : error.message,
      next: 'Inspect the source/ownership conflict, then use an explicit generation update or a new owned output. No files were repaired.' });
    return { result };
  } finally { store?.close(); }
}

export function verifyProject(options) { return inspectProject(options).result; }

export function verifyProjectCli(args) {
  const flags = new Map();
  for (let i = 0; i < args.length; i += 2) {
    assert.ok(['--project', '--out', '--requirements'].includes(args[i]) && !flags.has(args[i]) && args[i + 1] && !args[i + 1].startsWith('--'),
      'verify-project accepts unique --project, --out and optional --requirements');
    flags.set(args[i], args[i + 1]);
  }
  assert.ok(flags.has('--project') && flags.has('--out'), 'explicit --project and --out required');
  let required = [];
  if (flags.has('--requirements')) {
    const value = captureProductJson(localPath(process.cwd(), flags.get('--requirements'))).value;
    same(Object.keys(value).sort(), ['required', 'schemaVersion']);
    assert.equal(value.schemaVersion, 'truthsrc.project-requirements/v1');
    required = value.required;
  }
  return verifyProject({ project: flags.get('--project'), out: flags.get('--out'), required });
}
