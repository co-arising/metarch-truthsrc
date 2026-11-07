import assert from 'node:assert/strict';
import { captureEvidenceFile } from '../verification/files.mjs';
import { posix } from 'node:path';
import { compare, exactKeys, jsonBytes, normalizedPath, sha256, unique, within } from './io.mjs';
import { parseStrictJson } from '../strict-json.mjs';

export const CAPABILITY_SCHEMA = 'truthsrc.artifact-documentation/v2';
export const EVIDENCE_LEVELS = ['generated', 'compiled', 'behavior-verified', 'final-approved'];
const lifecycles = new Set(['current', 'legacy', 'retired', 'reference']);
const responsibilities = new Set(['generate-code', 'generate-wiring', 'derive-evidence', 'consume-library', 'handwritten', 'reference-only']);
const registrations = new Set(['product-profile', 'ordinary', 'legacy', 'retired']);
const roles = new Set(['input', 'entrypoint', 'builder', 'model', 'template', 'writer', 'runtime', 'implementation', 'test']);
const outcomes = new Set(['passed', 'failed', 'skipped']);
const channels = new Set(['manifest', 'apply', 'project', 'auxiliary', 'scaffold', 'pipeline', 'init', 'subproducer']);
const outputDispositions = new Set(['code', 'wiring', 'evidence', 'source-copy', 'binary-copy', 'marker']);
const verifiedObservations = new WeakMap();
const active = capability => capability.lifecycle === 'current';
const isJs = variant => variant.profile.startsWith('js-');
const code = capability => ['generate-code', 'generate-wiring'].includes(capability.responsibility);
const text = (value, label) => assert.ok(typeof value === 'string' && value.trim(), 'nonempty ' + label + ' required');
const digest = value => assert.match(value, /^[a-f0-9]{64}$/, 'SHA256 required');
const identity = value => assert.match(value, /^[a-z][a-z0-9-]*$/, 'stable lowercase identity required');
const refKey = ref => ref.repo + ':' + ref.file + '#' + ref.symbol;
function reference(ref) {
  exactKeys(ref, ['repo', 'file', 'symbol'], 'capability source');
  identity(ref.repo); normalizedPath(ref.file); text(ref.symbol, 'source symbol');
}
function stages(values, label) {
  assert.ok(Array.isArray(values) && values.length, label + ' sources required');
  unique(values.map(stage => stage.role + ':' + refKey(stage.ref)), label + ' stage');
  for (const stage of values) {
    exactKeys(stage, ['role', 'ref'], label + ' stage');
    assert.ok(roles.has(stage.role), 'unknown source stage'); reference(stage.ref);
  }
}
function strings(values, label) {
  assert.ok(Array.isArray(values), label + ' array required'); unique(values, label);
  for (const value of values) text(value, label);
}
function observationDeclaration(observation, producers) {
  exactKeys(observation, ['id', 'producer', 'channel', 'level', 'status', 'sourceFingerprint', 'outputs', 'receipt'], 'observation');
  assert.ok(channels.has(observation.channel), 'explicit observation channel required');
  identity(observation.id); assert.ok(producers.has(observation.producer), 'unknown observation producer');
  assert.ok(EVIDENCE_LEVELS.includes(observation.level) && outcomes.has(observation.status), 'unknown evidence level or status');
  digest(observation.sourceFingerprint);
  strings(observation.outputs, 'observed output');
  assert.ok(observation.status !== 'passed' || observation.outputs.length, 'passed observation requires outputs');
  const outputs = new Set(producers.get(observation.producer).outputs.filter(output => output.channel === observation.channel).map(output => output.id));
  for (const output of observation.outputs) assert.ok(outputs.has(output), 'unknown observation output');
  exactKeys(observation.receipt, ['file', 'sha256'], 'observation receipt');
  normalizedPath(observation.receipt.file); digest(observation.receipt.sha256);
  assert.ok(observation.receipt.file.startsWith('evidence/') && observation.receipt.file.endsWith('.json'), 'evidence JSON path required');
}

export function validateCapabilities(catalog) {
  assert.equal(catalog.schemaVersion, CAPABILITY_SCHEMA);
  assert.ok(Array.isArray(catalog.producers) && Array.isArray(catalog.observations), 'producers and observations required');
  unique(catalog.producers.map(producer => producer.id), 'producer');
  unique(catalog.producers.map(producer => refKey(producer.manifest)), 'producer manifest');
  const producers = new Map(catalog.producers.map(producer => [producer.id, producer])), mapped = new Set();
  for (const producer of catalog.producers) {
    exactKeys(producer, ['id', 'manifest', 'version', 'lifecycle', 'registration', 'input', 'stages', 'outputs', 'notes'], 'producer');
    identity(producer.id); reference(producer.manifest);
    assert.ok(producer.manifest.repo === 'js' && producer.manifest.file.startsWith('generators/') && producer.manifest.file.endsWith('/generator.json'), 'shipped JS manifest required');
    text(producer.version, 'producer version'); text(producer.input, 'producer input');
    assert.ok(lifecycles.has(producer.lifecycle) && registrations.has(producer.registration), 'unknown producer lifecycle or registration');
    assert.equal(producer.lifecycle === 'retired', producer.registration === 'retired', 'retired registration and lifecycle must agree');
    stages(producer.stages, 'producer'); strings(producer.notes, 'producer note');
    for (const role of ['entrypoint', 'writer']) assert.ok(producer.stages.some(stage => stage.role === role), 'producer ' + role + ' required');
    assert.ok(Array.isArray(producer.outputs) && producer.outputs.length, 'producer output contracts required');
    unique(producer.outputs.map(output => output.id), 'producer output');
    for (const output of producer.outputs) {
      exactKeys(output, ['id', 'kind', 'paths', 'shape', 'sources', 'channel', 'disposition', 'conditions'], 'output contract');
      assert.ok(channels.has(output.channel) && outputDispositions.has(output.disposition), 'unknown output channel or disposition');
      strings(output.conditions, 'output condition');
      identity(output.id); assert.ok(output.kind === null || typeof output.kind === 'string' && output.kind, 'output kind or explicit null required');
      strings(output.paths, 'output path'); assert.ok(output.paths.length, 'output paths required');
      for (const path of output.paths) { normalizedPath(path); assert.ok(!/[?\[\]{}]/.test(path), 'only literal, * and ** output paths supported'); }
      text(output.shape, 'output shape');
      assert.ok(Array.isArray(output.sources) && output.sources.length, 'output source required');
      unique(output.sources.map(refKey), 'output source'); output.sources.forEach(reference);
    }
  }
  unique(catalog.observations.map(observation => observation.id), 'observation');
  unique(catalog.observations.map(observation => observation.receipt.file), 'observation receipt');
  for (const observation of catalog.observations) observationDeclaration(observation, producers);
  const observations = new Map(catalog.observations.map(observation => [observation.id, observation]));
  for (const category of catalog.categories) for (const variant of category.variants) {
    const capability = variant.capability;
    exactKeys(capability, ['lifecycle', 'responsibility', 'input', 'implementation', 'routes', 'evidence', 'gaps', 'rationale'], 'capability');
    assert.ok(lifecycles.has(capability.lifecycle) && responsibilities.has(capability.responsibility), 'unknown capability lifecycle or responsibility');
    text(capability.input, 'capability input'); text(capability.rationale, 'capability rationale');
    stages(capability.implementation, 'implementation'); strings(capability.gaps, 'capability gap'); strings(capability.evidence, 'capability evidence');
    if (capability.responsibility === 'consume-library') assert.equal(variant.ownership, 'library', 'library consumption requires library ownership');
    if (code(capability)) assert.ok(['generated', 'mixed'].includes(variant.ownership), 'code or wiring requires generated or mixed ownership');
    if (capability.responsibility === 'handwritten') assert.ok(['handwritten', 'mixed'].includes(variant.ownership), 'handwritten responsibility requires matching ownership');
    if (capability.responsibility === 'derive-evidence') assert.ok(['derived', 'generated', 'mixed'].includes(variant.ownership), 'evidence ownership differs');
    assert.ok(Array.isArray(capability.routes), 'producer routes required');
    unique(capability.routes.map(route => route.producer), 'capability route');
    for (const route of capability.routes) {
      exactKeys(route, ['producer', 'outputs'], 'capability route');
      const producer = producers.get(route.producer);
      assert.ok(producer, 'unknown route producer: ' + route.producer);
      strings(route.outputs, 'route output'); assert.ok(route.outputs.length, 'route outputs required');
      assert.ok(!['consume-library', 'handwritten'].includes(capability.responsibility), 'library or handwritten responsibility cannot claim a generator route');
      assert.ok(producer.lifecycle !== 'retired' || ['retired', 'reference'].includes(capability.lifecycle), 'retired producer cannot support an active capability');
      for (const output of route.outputs) {
        const contract = producer.outputs.find(entry => entry.id === output);
        assert.ok(contract, 'unknown route output: ' + output);
        if (code(capability) && active(capability)) assert.ok(!['source-copy', 'binary-copy', 'marker'].includes(contract.disposition) && contract.channel !== 'subproducer',
          'copy, marker or indirect subproducer cannot claim current native code');
        mapped.add(producer.id + ':' + output);
      }
    }
    if (isJs(variant) && code(capability) && !capability.routes.length) assert.ok(capability.gaps.length, 'missing producer requires explicit backlog');
    for (const id of capability.evidence) {
      const observation = observations.get(id);
      assert.ok(observation && capability.routes.some(route => route.producer === observation.producer && route.outputs.some(output => observation.outputs.includes(output))), 'unrelated or unknown capability evidence: ' + id);
    }
  }
  for (const producer of catalog.producers) for (const output of producer.outputs)
    assert.ok(mapped.has(producer.id + ':' + output.id), 'unmapped producer output: ' + producer.id + ':' + output.id);
}

function producerReferences(producer) {
  return [producer.manifest, ...producer.stages.map(stage => stage.ref), ...producer.outputs.flatMap(output => output.sources)];
}
export function verifyCapabilitySources(catalog, lock) {
  if (catalog.schemaVersion !== CAPABILITY_SCHEMA) return [];
  const diagnostics = [], producers = catalog.producers;
  const check = (ref, owner) => {
    const record = lock.repositories[ref.repo]?.files.find(file => file.path === ref.file);
    if (!record) diagnostics.push({ code: 'CAPABILITY_SOURCE_MISSING', owner, ref });
    else if (ref.symbol !== '*' && !record.symbols?.includes(ref.symbol)) diagnostics.push({ code: 'CAPABILITY_SYMBOL_MISSING', owner, ref });
  };
  for (const producer of producers) {
    for (const ref of producerReferences(producer)) check(ref, producer.id);
    const manifest = lock.repositories.js?.files.find(file => file.path === producer.manifest.file)?.manifest;
    if (manifest?.entrypoint) {
      const file = posix.join(posix.dirname(producer.manifest.file), manifest.entrypoint);
      if (!producer.stages.some(stage => stage.role === 'entrypoint' && stage.ref.repo === 'js' && stage.ref.file === file))
        diagnostics.push({ code: 'CAPABILITY_ENTRYPOINT', producer: producer.id, file });
    }
  }
  for (const category of catalog.categories) for (const variant of category.variants)
    for (const stage of variant.capability.implementation) check(stage.ref, category.id + ':' + variant.profile);
  const declared = new Set(producers.map(producer => producer.manifest.file));
  for (const file of lock.repositories.js?.files ?? []) if (file.manifest && !declared.has(file.path))
    diagnostics.push({ code: 'UNCALIBRATED_MANIFEST', file: file.path });
  return diagnostics;
}

export function producerFingerprint(catalog, lock, id) {
  const producer = catalog.producers.find(producer => producer.id === id);
  assert.ok(producer, 'unknown producer');
  const spec = lock.repositories.js;
  const scopes = new Set(spec.scopes.filter(scope => scope.packaged && scope.id !== 'artifact-docs').map(scope => scope.id));
  const files = spec.files.filter(file => scopes.has(file.scope)).map(file => ({ file: file.path, bytes: file.bytes, sha256: file.sha256 }))
    .sort((a, b) => compare(a.file, b.file));
  for (const file of files) { normalizedPath(file.file); digest(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0); }
  digest(lock.productionToolSha256);
  return sha256(jsonBytes({ producer, productionToolSha256: lock.productionToolSha256,
    sourceScope: 'complete project tool inputs and all packaged locked sources', files }));
}
function pattern(path) {
  let result = '^';
  for (let i = 0; i < path.length; i++) {
    if (path.slice(i, i + 3) === '**/') { result += '(?:[^/]+/)*'; i += 2; }
    else if (path.slice(i, i + 2) === '**') { result += '.*'; i++; }
    else if (path[i] === '*') result += '[^/]*';
    else result += path[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(result + '$');
}
export function matchOutputContracts(producer, artifact, channel = null) {
  normalizedPath(artifact.path);
  return producer.outputs.filter(output => (channel === null || output.channel === channel) && output.kind === artifact.kind && output.paths.some(path => pattern(path).test(artifact.path))).map(output => output.id);
}
export function validateObservation(catalog, lock, observation, bytes) {
  observationDeclaration(observation, new Map(catalog.producers.map(producer => [producer.id, producer])));
  assert.ok(Buffer.byteLength(bytes) <= 8 * 1024 * 1024, 'bounded observation receipt required');
  assert.equal(sha256(bytes), observation.receipt.sha256, 'observation receipt drift');
  const receipt = parseStrictJson(bytes);
  exactKeys(receipt, ['schemaVersion', 'producer', 'channel', 'level', 'status', 'sourceFingerprint', 'command', 'inputs', 'artifacts', 'checks', 'independent', 'approval'], 'observation receipt');
  assert.equal(receipt.schemaVersion, 'truthsrc.artifact-capability-observation/v1');
  for (const name of ['producer', 'channel', 'level', 'status', 'sourceFingerprint']) assert.equal(receipt[name], observation[name], 'observation ' + name + ' differs');
  assert.equal(receipt.sourceFingerprint, producerFingerprint(catalog, lock, receipt.producer), 'stale producer observation');
  text(receipt.command, 'executed command');
  assert.ok(Array.isArray(receipt.inputs) && receipt.inputs.length, 'explicit observation inputs required');
  unique(receipt.inputs.map(input => input.name), 'observation input');
  for (const input of receipt.inputs) { exactKeys(input, ['name', 'sha256'], 'observation input'); text(input.name, 'input name'); digest(input.sha256); }
  assert.ok(Array.isArray(receipt.artifacts) && Array.isArray(receipt.checks), 'artifact and check arrays required');
  unique(receipt.artifacts.map(artifact => artifact.path), 'observed artifact');
  unique(receipt.checks.map(check => check.name), 'observation check');
  const producer = catalog.producers.find(producer => producer.id === receipt.producer), matches = new Set();
  for (const artifact of receipt.artifacts) {
    exactKeys(artifact, ['path', 'kind', 'bytes', 'sha256', 'contracts'], 'observed artifact'); normalizedPath(artifact.path); digest(artifact.sha256);
    assert.ok(Number.isSafeInteger(artifact.bytes) && artifact.bytes >= 0, 'observed artifact byte count required');
    const eligible = matchOutputContracts(producer, artifact, observation.channel);
    strings(artifact.contracts, 'artifact contract');
    assert.ok(artifact.contracts.length && artifact.contracts.every(output => eligible.includes(output)), 'artifact does not match its explicit output contracts: ' + artifact.path);
    artifact.contracts.forEach(output => matches.add(output));
  }
  for (const check of receipt.checks) { exactKeys(check, ['name', 'passed'], 'observation check'); text(check.name, 'check name'); assert.equal(typeof check.passed, 'boolean'); }
  assert.equal(typeof receipt.independent, 'boolean');
  if (receipt.status === 'passed') {
    assert.ok(receipt.artifacts.length && receipt.checks.length && receipt.checks.every(check => check.passed), 'passing observation requires artifacts and successful checks');
    for (const output of observation.outputs) assert.ok(matches.has(output), 'unobserved output contract: ' + output);
    assert.deepEqual([...matches].sort(compare), [...observation.outputs].sort(compare), 'all observed output contracts must be declared');
    if (['behavior-verified', 'final-approved'].includes(receipt.level)) assert.equal(receipt.independent, true, 'independent oracle or authority required');
    if (receipt.level === 'final-approved') {
      exactKeys(receipt.approval, ['authority', 'decision', 'recordSha256'], 'final approval');
      text(receipt.approval.authority, 'approval authority'); assert.equal(receipt.approval.decision, 'approved'); digest(receipt.approval.recordSha256);
    } else assert.equal(receipt.approval, null, 'approval belongs only to the final level');
  }
  const sample = sha256(jsonBytes({ producer: receipt.producer, channel: receipt.channel, sourceFingerprint: receipt.sourceFingerprint,
    inputs: [...receipt.inputs].sort((a, b) => compare(a.name, b.name)),
    artifacts: receipt.artifacts.map(({ contracts, ...artifact }) => artifact).sort((a, b) => compare(a.path, b.path)) }));
  const result = Object.freeze({ id: observation.id, producer: observation.producer, level: observation.level,
    passed: receipt.status === 'passed', outputs: Object.freeze([...observation.outputs]), sample });
  verifiedObservations.set(result, { declaration: jsonBytes(observation), fingerprint: receipt.sourceFingerprint });
  return result;
}
export function inspectCapabilityObservations(catalog, lock, directory) {
  if (catalog.schemaVersion !== CAPABILITY_SCHEMA) return { verified: [], diagnostics: [] };
  const verified = [], diagnostics = [];
  for (const observation of catalog.observations) {
    try {
      const { value } = captureEvidenceFile(within(directory, observation.receipt.file), { limit: 8 * 1024 * 1024 });
      verified.push(validateObservation(catalog, lock, observation, value));
    }
    catch (error) { diagnostics.push({ code: 'CAPABILITY_EVIDENCE_INVALID', observation: observation.id, message: error.message }); }
  }
  return { verified, diagnostics };
}
function achieved(catalog, lock, verified) {
  const declarations = new Map(catalog.observations.map(observation => [observation.id, observation]));
  const valid = new Map();
  for (const result of verified) {
    const proof = verifiedObservations.get(result), declaration = declarations.get(result.id);
    if (proof && result.passed && declaration && proof.declaration === jsonBytes(declaration) &&
        proof.fingerprint === producerFingerprint(catalog, lock, result.producer)) valid.set(result.id, result);
  }
  return (capability, level) => capability.routes.some(route => {
    const observations = capability.evidence.map(id => valid.get(id)).filter(observation => observation?.producer === route.producer);
    const samples = new Set(observations.map(observation => observation.sample));
    return [...samples].some(sample => EVIDENCE_LEVELS.slice(0, EVIDENCE_LEVELS.indexOf(level) + 1).every(required =>
      route.outputs.every(output => observations.some(observation => observation.sample === sample && observation.level === required && observation.outputs.includes(output)))));
  });
}
const count = rows => ({ categories: new Set(rows.map(row => row.category.id)).size, variants: rows.length });
function summaryGroup(rows, hasEvidence) {
  const required = rows.filter(row => code(row.capability));
  const evidence = rows.filter(row => row.capability.responsibility === 'derive-evidence');
  const summarize = selected => ({ required: count(selected),
    producerLocated: count(selected.filter(row => row.capability.routes.length)),
    generated: count(selected.filter(row => hasEvidence(row.capability, 'generated'))),
    compiled: count(selected.filter(row => hasEvidence(row.capability, 'compiled'))),
    behaviorVerified: count(selected.filter(row => hasEvidence(row.capability, 'behavior-verified'))),
    finalApproved: count(selected.filter(row => hasEvidence(row.capability, 'final-approved'))),
    missingProducer: selected.filter(row => !row.capability.routes.length).map(row => row.category.id + ':' + row.variant.profile) });
  return { code: summarize(required), evidence: summarize(evidence),
    excluded: count(rows.filter(row => !code(row.capability) && row.capability.responsibility !== 'derive-evidence')) };
}
export function capabilitySummary(catalog, lock, verified = []) {
  const base = { schemaVersion: 'truthsrc.artifact-capability-summary/v1', calibrated: catalog.schemaVersion === CAPABILITY_SCHEMA,
    categories: catalog.categories.length, variants: catalog.categories.reduce((sum, category) => sum + category.variants.length, 0) };
  if (!base.calibrated) return { ...base, producers: null, js: null, legacyJs: null, profiles: null };
  const rows = catalog.categories.flatMap(category => category.variants.map(variant => ({ category, variant, capability: variant.capability })));
  const hasEvidence = achieved(catalog, lock, verified);
  const currentJs = rows.filter(row => isJs(row.variant) && active(row.capability));
  const excludedJs = rows.filter(row => isJs(row.variant) && ['retired', 'reference'].includes(row.capability.lifecycle));
  const js = summaryGroup(currentJs, hasEvidence);
  js.excluded = count([...currentJs.filter(row => !code(row.capability) && row.capability.responsibility !== 'derive-evidence'), ...excludedJs]);
  return { ...base, producers: { total: catalog.producers.length,
    ...Object.fromEntries([...lifecycles].map(lifecycle => [lifecycle, catalog.producers.filter(producer => producer.lifecycle === lifecycle).length])) },
    js, legacyJs: summaryGroup(rows.filter(row => isJs(row.variant) && row.capability.lifecycle === 'legacy'), hasEvidence),
    profiles: Object.fromEntries([...new Set(rows.map(row => row.variant.profile))].sort(compare).map(profile => [profile, {
      ...count(rows.filter(row => row.variant.profile === profile)),
      responsibilities: Object.fromEntries([...responsibilities].map(responsibility => [responsibility,
        rows.filter(row => row.variant.profile === profile && row.capability.responsibility === responsibility).length]))
    }])) };
}
const md = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
export function renderCapabilityMatrix(catalog, lock, verified = []) {
  const summary = capabilitySummary(catalog, lock, verified);
  assert.ok(summary.calibrated, 'v1 catalogue has no calibrated matrix');
  const hasEvidence = achieved(catalog, lock, verified);
  const lines = ['# 生成能力矩阵（派生）', '',
    '> 由 catalog.json、sources.lock.json 与显式验证回执派生；请勿独立编辑。来源匹配不等于语义或运行认证。', '',
    `类别 ${summary.categories}；变体 ${summary.variants}；生成入口 ${summary.producers.total}。`, '',
    '计数按类别去重，同时保留变体数。现役代码与装配、派生证据、旧式及退役入口分别统计；library/手写不计模板完成率。',
    '一个完整生产路径的样例通过只证明该样例，不保证该profile全部输入。编译、行为和最终审定必须逐级具有有效回执。', '',
    '| 范围 | 应生成类别/变体 | producer已定位 | 样例已生成 | 已编译 | 行为已验证 | 最终审定 |',
    '|---|---:|---:|---:|---:|---:|---:|'];
  const n = value => `${value.categories}/${value.variants}`;
  for (const [label, group] of [['现役JS代码/装配', summary.js.code], ['现役JS派生证据', summary.js.evidence], ['旧式JS代码/装配', summary.legacyJs.code], ['旧式JS派生证据', summary.legacyJs.evidence]])
    lines.push(`| ${label} | ${n(group.required)} | ${n(group.producerLocated)} | ${n(group.generated)} | ${n(group.compiled)} | ${n(group.behaviorVerified)} | ${n(group.finalApproved)} |`);
  lines.push('', '## 类别与适用变体', '');
  for (const category of catalog.categories) {
    lines.push(`### [${category.id} — ${category.title}](${category.document})`, '');
    for (const variant of category.variants) {
      const c = variant.capability;
      const levels = EVIDENCE_LEVELS.filter(level => hasEvidence(c, level));
      lines.push(`- **${variant.profile}**：${c.lifecycle}；${c.responsibility}；owner=${variant.ownership}。`,
        `  - 生产路径：${c.routes.length ? c.routes.map(route => '\\`' + route.producer + ':' + route.outputs.join(',') + '\\`').join('；').replaceAll('\\`', '`') : '无JS产出声明'}。有效证据：${levels.join('、') || (c.routes.length ? 'producer-located；未取得样例/编译/行为/审定回执' : '不作JS生成证明')}。`,
        `  - 边界：${c.rationale}`);
      if (c.gaps.length) lines.push('  - 未满足项：' + c.gaps.join('；'));
    }
    lines.push('');
  }
  lines.push('## 生成入口反向覆盖', '');
  for (const producer of catalog.producers) {
    lines.push(`### ${producer.id}`, '', `- Manifest：\`${producer.manifest.file}\`；版本 ${producer.version}；${producer.lifecycle}/${producer.registration}。`,
      '- 输入：' + producer.input,
      '- 生产链：' + producer.stages.map(stage => `${stage.role}=\`${refKey(stage.ref)}\``).join('；'), '',
      '| 输出合同 | kind | 路径 | 类别/profile |', '|---|---|---|---|');
    for (const output of producer.outputs) {
      const mappings = catalog.categories.flatMap(category => category.variants.filter(variant => variant.capability.routes.some(route => route.producer === producer.id && route.outputs.includes(output.id)))
        .map(variant => category.id + '/' + variant.profile));
      lines.push(`| ${output.id} | ${md(output.kind ?? '(untyped)')} | ${output.paths.map(md).join('<br>')} | ${mappings.map(md).join('<br>')} |`);
    }
    if (producer.notes.length) lines.push('', ...producer.notes.map(note => '- ' + note));
    lines.push('');
  }
  return lines.join('\n');
}
