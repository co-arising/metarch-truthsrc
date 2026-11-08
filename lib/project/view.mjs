import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inspectProject } from './verify.mjs';
import { localPath, assertUnchanged } from './cli.mjs';
import { resolveRecordSource } from '../source-index.mjs';
import { parseStrictJson } from '../strict-json.mjs';
import { captureProductJson } from '../products/cli.mjs';
import { declaredViewRelations, pointerValue } from './view-relations.mjs';
import { authorExcerpt } from './view-source.mjs';
import { renderWorkshop } from '../workshop/render.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const inside = (root, file) => { const p = relative(root, file); return p === '' || !isAbsolute(p) && p !== '..' && !p.startsWith('..' + sep); };
const description = value => [value?.description, value?.purpose, value?.payload?.description, value?.payload?.purpose,
  value?.info?.description, value?.cond && '条件：' + value.cond, value?.expr && '状态更新：' + value.expr].find(value => typeof value === 'string' && value.trim()) || '';
const uniqueLocations = rows => [...new Map(rows.map(row => [JSON.stringify([row.file, row.span || null]), row])).values()];

function tourConfig(value) {
  if (!value) return null;
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'tour must be an object');
  assert.ok(Object.keys(value).every(key => ['schemaVersion', 'title', 'subtitle', 'chapters', 'maxNodes'].includes(key)), 'unknown tour field');
  assert.equal(value.schemaVersion, 'truthsrc.workshop-tour/v1');
  assert.ok(typeof value.title === 'string' && Array.isArray(value.chapters) && value.chapters.length <= 12, 'tour needs title and at most 12 chapters');
  const ids = new Set();
  for (const chapter of value.chapters) {
    assert.ok(chapter && typeof chapter.id === 'string' && !ids.has(chapter.id), 'unique chapter id required'); ids.add(chapter.id);
    assert.ok(Object.keys(chapter).every(key => ['id', 'title', 'kicker', 'description', 'knowledge', 'questions'].includes(key)), 'unknown chapter field');
    assert.ok(typeof chapter.title === 'string' && Array.isArray(chapter.knowledge) && chapter.knowledge.every(key => typeof key === 'string'), 'chapter title/knowledge required');
  }
  assert.ok(value.maxNodes === undefined || Number.isSafeInteger(value.maxNodes) && value.maxNodes >= 1 && value.maxNodes <= 300, 'maxNodes must be 1–300');
  return value;
}

export function viewProject({ project, out, config, knowledge }) {
  const tour = tourConfig(config), inspected = inspectProject({ project, out });
  const { result: verification, captured, query, snapshot, anchors, buffers } = inspected;
  assert.ok(verification.passed, 'VIEW_REQUIRES_VERIFIED_PROJECT: ' + verification.diagnostics.map(row => row.message).join('; '));
  const records = captured.sourceIndex.records.filter(row => row.surface === '' && row.relation !== 'unresolved');
  const byIdentity = new Map();
  for (const record of records) {
    if (!byIdentity.has(record.identity)) byIdentity.set(record.identity, []);
    byIdentity.get(record.identity).push(record);
  }
  const relations = declaredViewRelations(captured.canonical, captured.sourceIndex), selected = new Set(), diagnostics = [...relations.diagnostics];
  const select = key => {
    const rows = query.select(key), ids = [...new Set(rows.map(row => row.identity))];
    if (ids.length !== 1) diagnostics.push({ code: ids.length ? 'VIEW_SELECTION_AMBIGUOUS' : 'VIEW_SELECTION_MISSING', selector: key, matches: ids });
    for (const id of ids) selected.add(id);
    return ids;
  };
  let chapters;
  if (tour) chapters = tour.chapters.map(chapter => ({ ...chapter, nodeIds: [...new Set(chapter.knowledge.flatMap(select))] }));
  else {
    const defaultKinds = captured.implementations ? ['value-object', 'port', 'port-method', 'signature-variant'] : ['aggregate', 'command', 'event', 'guard', 'fold'];
    const initial = knowledge ? select(knowledge) : records.filter(row => defaultKinds.includes(row.kind)).slice(0, 24).map(row => { selected.add(row.identity); return row.identity; });
    chapters = [{ id: 'explore', title: '从一条规则开始', kicker: 'KNOWLEDGE → CODE', description: '选择知识，查看真实声明与生成代码；再从代码行查回同一身份。',
      nodeIds: initial, questions: ['编辑在哪里？', '代码来自哪条知识？'] }];
  }
  if (knowledge && tour) select(knowledge);
  const maxNodes = tour?.maxNodes || 120, initiallySelected = new Set(selected);
  for (const edge of relations.edges) {
    if (selected.size >= maxNodes) break;
    if (initiallySelected.has(edge.from) || initiallySelected.has(edge.to)) { selected.add(edge.from); selected.add(edge.to); }
  }
  const chosen = [...selected].slice(0, maxNodes);
  const sourceBytes = new Map();
  const sourceFor = record => {
    const source = resolveRecordSource(captured.sourceIndex, record), file = localPath(captured.tree, source.file);
    const expected = captured.sources.find(row => row.file === file);
    assert.ok(expected && inside(captured.tree, file), 'view source is not captured author input');
    if (!sourceBytes.has(file)) {
      const bytes = readFileSync(file); assert.equal(sha(bytes), expected.sha256, 'author changed during export');
      sourceBytes.set(file, bytes);
    }
    const excerpt = authorExcerpt(sourceBytes.get(file).toString('utf8'), source.atomPointer);
    return { file: relative(dirname(captured.file), file).split(sep).join('/'), pointer: source.atomPointer,
      ...excerpt, label: source.locationMapping?.label || excerpt.label, sha256: expected.sha256,
      mapping: source.locationMapping || null };
  };
  const locationFor = (location, identity) => {
    const bytes = buffers.get(location.file), text = bytes.toString('utf8'), lines = text.split('\n');
    const start = location.span ? bytes.subarray(0, location.span.start).toString('utf8').split('\n').length : 1;
    const end = location.span ? bytes.subarray(0, Math.max(location.span.start, location.span.end - 1)).toString('utf8').split('\n').length : Math.min(24, lines.length);
    const startLine = Math.max(1, start - 3), endLine = Math.min(lines.length, startLine + 79, end + 3);
    const reverse = query.reverse(location.file).filter(row => !location.span || row.location.span &&
      row.location.span.start < location.span.end && row.location.span.end > location.span.start);
    const reverseLocations = reverse.flatMap(row => row.origins.map(origin => ({ identity: origin.identity,
      precision: row.location.span ? 'span' : 'file',
      ...(row.location.span ? { startLine: bytes.subarray(0, row.location.span.start).toString('utf8').split('\n').length,
        endLine: bytes.subarray(0, Math.max(row.location.span.start, row.location.span.end - 1)).toString('utf8').split('\n').length } : {}) })));
    return { file: location.file, startLine, endLine, text: lines.slice(startLine - 1, endLine).join('\n'),
      ...(location.span ? { highlight: { startLine: start, endLine: end } } : {}),
      fingerprint: location.fingerprint, precision: location.span ? 'span' : 'file', sourceIdentity: identity,
      reverseIdentities: [...new Set(reverseLocations.map(row => row.identity))], reverseLocations,
      truncated: endLine < end };
  };
  const nodes = chosen.filter(id => byIdentity.has(id)).map(identity => {
    const matches = byIdentity.get(identity), record = matches[0], value = pointerValue(captured.canonical, record.pointer);
    let direct = query.forward(identity), linkedLocations = [], links = [];
    if (!direct.some(row => row.locations.length)) {
      // Only the explicit saga/ref or pipeline/ref contract authorizes a host bridge.
      const hosts = relations.edges.filter(edge => edge.to === identity && ['saga/ref', 'pipeline/ref'].includes(edge.proof.carrier));
      for (const edge of hosts) {
        linkedLocations.push(...query.forward(edge.from).flatMap(row => row.locations));
        links.push({ code: 'DECLARED_HOST_IMPLEMENTATION', message: '通过显式技术宿主引用定位代码，不是该声明直接生成。', via: edge.from, proof: edge.proof });
      }
    }
    const all = uniqueLocations([...direct.flatMap(row => row.locations), ...linkedLocations]), shown = all.slice(0, 12);
    return { id: identity, identity, label: record.name || identity, kind: record.kind, owner: record.owner,
      description: description(value), state: matches.length > 1 ? 'ambiguous' : all.length ? 'mapped' : 'not-generated',
      sources: matches.map(sourceFor), locations: shown.map(row => locationFor(row, identity)),
      diagnostics: [...links, ...(all.length > shown.length ? [{ code: 'VIEW_LOCATIONS_TRUNCATED', message: `显示${shown.length}/${all.length}处代码；公共query可查看完整关联。` }] : [])],
      summary: record.meaning };
  });
  const nodeIds = new Set(nodes.map(node => node.id));
  const edges = relations.edges.filter(edge => nodeIds.has(edge.from) && nodeIds.has(edge.to));
  for (const chapter of chapters) {
    chapter.nodeIds = chapter.nodeIds.filter(id => nodeIds.has(id));
    delete chapter.knowledge;
  }
  assertUnchanged(captured);
  for (const [file, bytes] of sourceBytes) assert.ok(readFileSync(localPath(process.cwd(), file)).equals(bytes), 'source changed during view export');
  for (const [file, bytes] of buffers) assert.ok(readFileSync(localPath(out, file)).equals(bytes), 'code changed during view export');
  return { schemaVersion: 'truthsrc.project-view/v1', title: tour?.title || '知识与代码，看得见的来处',
    subtitle: tour?.subtitle || '从文件真源，到可验证的代码关联。所有内容来自本次真实快照。',
    project: { name: captured.canonical.authoring?.system?.name || basename(dirname(captured.file)), system: captured.sourceIndex.system, context: captured.sourceIndex.context },
    snapshot: { source: verification.snapshot, knowledge: snapshot.id, generation: verification.graph.generation, codeDigest: verification.codeDigest },
    freshness: { state: 'current-at-export', checkedAtExport: true, live: false }, verification,
    ...(verification.implementationEvidence ? { implementations: verification.implementationEvidence } : {}),
    evidence: [
      ...(verification.implementationEvidence?.members ?? []).map(member => ({ id: 'implementation:' + member.id,
        label: '外置手写 · ' + member.id, status: 'passed',
        summary: `${member.module} · ${member.file} · SHA256 ${member.sha256} · 声明 ${member.declaredSymbol}`,
        scope: '显式声明与文件字节核验；非生成所有权，未认证Scala符号、构造ABI或业务行为' })),
      { id: 'anchors', label: '真源 · 图 · 回锚', status: 'passed', summary: `${verification.counts.files}份源码/配置，${verification.counts.spans}个精确区间已核验。`, scope: '当前快照最终字节与完整关联' },
      { id: 'code', label: '代码构建与测试', status: 'not-run', summary: '导出知识图不会运行Scala测试。', scope: '需要独立同源构建回执' },
      { id: 'service', label: '银行业务服务', status: 'not-run', summary: '静态知识图不是运行回放，不继承历史服务结果。', scope: '需要当前候选的HTTP/数据库/浏览器验收' }],
    nodes, edges, chapters, totals: { nodes: byIdentity.size, edges: relations.edges.length, shownNodes: nodes.length, omittedNodes: byIdentity.size - nodes.length },
    diagnostics, limitations: ['静态快照，仅在导出时核验新鲜度；不会检测后续文件变化。',
      '实线是有来源的声明引用，不是完整调用图或运行因果关系。',
      '技术绑定、说明性知识与生成实现区分展示；没有代码关联不等于业务不存在。',
      ...verification.limitations] };
}

export function viewProjectCli(args) {
  const flags = new Map();
  for (let i = 0; i < args.length; i += 2) {
    assert.ok(['--project', '--out', '--html', '--tour', '--knowledge'].includes(args[i]) && !flags.has(args[i]) && args[i + 1] && !args[i + 1].startsWith('--'),
      'view-project accepts unique --project --out --html [--tour] [--knowledge]');
    flags.set(args[i], args[i + 1]);
  }
  assert.ok(['--project', '--out', '--html'].every(key => flags.has(key)), 'explicit project, generated output and new HTML required');
  const project = localPath(process.cwd(), flags.get('--project')), out = localPath(process.cwd(), flags.get('--out'));
  const html = localPath(process.cwd(), flags.get('--html'));
  assert.ok(/\.html$/i.test(html) && !inside(out, html), 'HTML must be outside generated output');
  assert.ok(lstatSync(dirname(html)).isDirectory(), 'HTML parent must exist');
  let config;
  if (flags.has('--tour')) config = captureProductJson(localPath(process.cwd(), flags.get('--tour'))).value;
  const view = viewProject({ project, out, config, knowledge: flags.get('--knowledge') });
  const projectConfig = parseStrictJson(readFileSync(project));
  assert.ok(!inside(localPath(dirname(project), projectConfig.tree), html), 'HTML cannot be written into author tree');
  const tool = fileURLToPath(new URL('../../', import.meta.url));
  assert.ok(!inside(tool, html), 'HTML cannot be written into installed tool');
  for (const root of view.implementations?.roots ?? []) assert.ok(!inside(root.path, html), 'HTML cannot be written into handwritten source roots');
  const bytes = renderWorkshop(view);
  writeFileSync(html, bytes, { flag: 'wx', mode: 0o600 });
  return { schemaVersion: 'truthsrc.project-view-result/v1', file: html, url: pathToFileURL(html).href,
    bytes: Buffer.byteLength(bytes), sha256: sha(bytes), snapshot: view.snapshot, verification: view.verification,
    nodes: view.nodes.length, edges: view.edges.length, omissions: view.totals.omittedNodes, runtimeVerified: false };
}
