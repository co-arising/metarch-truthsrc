import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { renderWorkshop } from '../lib/workshop/render.mjs';

// This is a synthetic renderer fixture, NOT a captured application or bank result.
function fixture() {
  const identity = name => `knowledge:renderer-fixture/counter/${name}`;
  const source = { file: 'truth/counter/structure.yaml', pointer: '/guards/positive', label: '共享作者声明', startLine: 7, text: 'guard: positive\nrule: value > 0\n', sha256: 'fixture-source-digest' };
  const code = { file: 'generated/CounterRules.scala', startLine: 20, endLine: 23, text: 'def decide(value: Int) = {\n  require(value > 0)\n  ValueChanged(value)\n}\n', highlight: { startLine: 21, endLine: 21 }, precision: 'span', fingerprint: 'fixture-code-digest', sourceIdentity: identity('guard/positive'), reverseIdentities: [identity('command/SetValue'), identity('guard/positive')] };
  const node = (id, kind, state, extra = {}) => ({ id, identity: identity(id), label: id.split('/').at(-1), kind, state, owner: ['Counter'], description: '', sources: [], locations: [], diagnostics: [], ...extra });
  return {
    schemaVersion: 'truthsrc.project-view/v1',
    title: '一个计数规则的知识地图', subtitle: '仅供 renderer 自动测试的虚构教学快照',
    project: { name: 'Renderer fixture', system: 'renderer-fixture', context: 'counter' },
    snapshot: { source: 'fixture-source', knowledge: 'fixture-knowledge', generation: 'fixture-generation', codeDigest: 'fixture-code' },
    freshness: { state: 'current', checkedAtExport: true, live: false },
    verification: { passed: true, checks: [{ code: 'FIXTURE_ONLY', passed: true }], counts: { spans: 2 }, diagnostics: [] },
    evidence: [
      { id: 'fixture-anchors', label: '回锚 fixture', status: 'passed', summary: '仅测试状态展示。', scope: 'synthetic-fixture' },
      { id: 'fixture-code', label: '代码执行', status: 'not-run', summary: '此 fixture 未运行 Scala。', scope: 'synthetic-fixture' },
      { id: 'fixture-service', label: '业务服务', status: 'blocked', summary: '未提供服务运行证据。', scope: 'synthetic-fixture' },
    ],
    nodes: [
      node('story/change', 'story', 'not-generated', { label: '为什么修改数值？', description: '从用户意图看规则边界。', sources: [source] }),
      node('command/SetValue', 'command', 'mapped', { description: '检查数值，再产生事件。', sources: [source], locations: [code] }),
      node('guard/positive', 'guard', 'mapped', { label: '数值必须为正', description: '真实 span 与文件候选不能混为一谈。', sources: [source], locations: [code] }),
      node('event/ValueChanged', 'event', 'mapped', { sources: [source], locations: [{ ...code, highlight: { startLine: 22, endLine: 22 }, reverseIdentities: [identity('event/ValueChanged')] }] }),
      node('candidate/shared', 'next-future-kind', 'ambiguous', { label: '共享文件候选', locations: [{ ...code, precision: 'file', reverseIdentities: [identity('candidate/shared')] }] }),
      node('fold/old', 'fold', 'stale', { label: '过期演进', sources: [source] }),
    ],
    edges: [
      { from: 'story/change', to: 'command/SetValue', kind: 'declared-reference', label: '故事声明引用命令', proof: { pointer: '/uses/0', relationship: 'not-direct-generation' }, asserted: false },
      { from: 'command/SetValue', to: 'guard/positive', kind: 'source', label: '展开来源', proof: 'fixture: explicit origin reference', asserted: false },
      { from: 'guard/positive', to: 'event/ValueChanged', kind: 'context', label: '阅读顺序', proof: '仅供解释，不是执行轨迹', asserted: false },
    ],
    chapters: [
      { id: 'intent', title: '先理解意图', kicker: '01 / 从问题出发', description: '先看声明关系，再追到规则。', nodeIds: ['story/change', 'command/SetValue', 'guard/positive'], questions: ['规则通过就等于服务通过了吗？'] },
      { id: 'precision', title: '区分证据精度', kicker: '02 / 看清边界', description: '精确区间、候选与过期。', nodeIds: ['guard/positive', 'event/ValueChanged', 'candidate/shared', 'fold/old'], questions: [] },
    ],
    totals: { nodes: 9, edges: 5, shownNodes: 6, omittedNodes: 3 },
    limitations: ['未包含整个项目。未做浏览器或运行验收。'],
  };
}

const inlineScript = html => [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].at(-1)[1];
const embeddedData = html => /<script id="workshop-view" type="application\/json">([\s\S]*?)<\/script>/.exec(html)[1];
const digest = text => createHash('sha256').update(text).digest('base64');

// A deliberately small DOM/event harness for the real embedded client. It tests
// interactions and text sinks in Node, not CSS layout, accessibility-tree output,
// CSP enforcement, or browser screenshots (those belong to browser acceptance).
class Element {
  constructor(tag, doc) {
    this.tagName = tag.toUpperCase(); this.doc = doc;
    this.children = []; this.attributes = new Map(); this.listeners = new Map();
    this._text = ''; this.className = ''; this.id = ''; this.hidden = false;
    this.value = ''; this.open = false; this.disabled = false;
    this.classList = {
      toggle: (name, force) => {
        const tokens = new Set(this.className.split(/\s+/).filter(Boolean));
        const add = force ?? !tokens.has(name);
        if (add) tokens.add(name); else tokens.delete(name);
        this.className = [...tokens].join(' ');
      },
    };
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set innerHTML(_) { throw new Error('untrusted HTML sink used'); }
  set outerHTML(_) { throw new Error('untrusted HTML sink used'); }
  insertAdjacentHTML() { throw new Error('untrusted HTML sink used'); }
  append(...children) { for (const child of children) { this.children.push(child); child.parentElement = this; } }
  replaceChildren(...children) { this.children = []; this._text = ''; this.append(...children); }
  setAttribute(key, value) {
    this.attributes.set(key, String(value));
    if (key === 'class') this.className = String(value);
    if (key === 'id') this.id = String(value);
  }
  getAttribute(key) { return key === 'class' ? this.className : key === 'id' ? this.id : this.attributes.get(key) ?? null; }
  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(listener);
  }
  fire(type, data = {}) {
    const event = { type, target: this, currentTarget: this, preventDefault() { this.defaultPrevented = true; }, ...data };
    for (const listener of this.listeners.get(type) || []) listener(event);
    return event;
  }
  click() { if (!this.disabled) this.fire('click'); }
  focus() { this.doc.activeElement = this; }
  scrollIntoView() { this.scrolled = true; }
  showModal() { this.open = true; }
  close() { this.open = false; this.fire('close'); }
  getBoundingClientRect() {
    if (this.id === 'graph-area') return { left: 0, top: 0, right: 600, bottom: 600, width: 600, height: 600 };
    const nodes = this.doc.all().filter(item => item.className.split(' ').includes('node-card'));
    const index = Math.max(0, nodes.indexOf(this));
    const top = index * 150 + 30;
    return { left: 150, top, right: 450, bottom: top + 110, width: 300, height: 110 };
  }
  querySelectorAll(selector) { return descendants(this).filter(item => matches(item, selector)); }
}
function descendants(element) { return element.children.flatMap(child => [child, ...descendants(child)]); }
function matches(element, selector) {
  if (selector.startsWith('.')) return element.className.split(/\s+/).includes(selector.slice(1));
  const attr = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector);
  if (attr) return element.getAttribute(attr[1]) !== null && (attr[2] == null || element.getAttribute(attr[1]) === attr[2]);
  return element.tagName === selector.toUpperCase();
}
function boot(view = fixture()) {
  const html = renderWorkshop(view);
  const document = {
    roots: [], listeners: new Map(), activeElement: null,
    all() { return this.roots.flatMap(root => [root, ...descendants(root)]); },
    getElementById(id) { return this.all().find(element => element.id === id) ?? null; },
    createElement(tag) { return new Element(tag, this); },
    createElementNS(_, tag) { return this.createElement(tag); },
    addEventListener: Element.prototype.addEventListener,
    fire: Element.prototype.fire,
  };
  for (const match of html.slice(0, html.indexOf('<script id="workshop-view"')).matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
    const id = /\bid="([^"]+)"/.exec(match[2])?.[1];
    if (!id) continue;
    const element = document.createElement(match[1]);
    element.id = id;
    element.hidden = /\bhidden\b/.test(match[2]);
    element.className = /\bclass="([^"]+)"/.exec(match[2])?.[1] || '';
    document.roots.push(element);
  }
  const data = document.createElement('script'); data.id = 'workshop-view'; data.textContent = embeddedData(html); document.roots.push(data);
  const requests = [], copies = [], frames = new Map(); let nextFrame = 1;
  const blocked = name => (...args) => { requests.push([name, args]); throw new Error(`unexpected ${name}`); };
  const context = {
    document,
    window: { addEventListener() {}, matchMedia: () => ({ matches: false }), open: blocked('window.open') },
    navigator: { clipboard: { writeText: async value => copies.push(value) }, sendBeacon: blocked('sendBeacon') },
    requestAnimationFrame(fn) { const id = nextFrame++; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    ResizeObserver: class { observe() {} },
    fetch: blocked('fetch'), XMLHttpRequest: blocked('XMLHttpRequest'), WebSocket: blocked('WebSocket'), EventSource: blocked('EventSource'), Worker: blocked('Worker'),
    eval: blocked('eval'), Function: blocked('Function'),
  };
  runInNewContext(inlineScript(html), context, { timeout: 1500 });
  const flush = () => { const work = [...frames.values()]; frames.clear(); work.forEach(fn => fn()); };
  flush();
  return {
    document, requests, copies, html, flush,
    get: id => document.getElementById(id),
    find: selector => document.all().filter(item => matches(item, selector)),
    search(value) { const input = document.getElementById('node-search'); input.value = value; input.fire('input'); flush(); },
  };
}

test('schema gate rejects broken shape and endpoints, accepts empty views and future kinds', () => {
  assert.throws(() => renderWorkshop(null), /view must be an object/);
  assert.throws(() => renderWorkshop({}), /schemaVersion/);
  for (const key of ['nodes', 'edges', 'chapters']) {
    const view = fixture(); view[key] = {};
    assert.throws(() => renderWorkshop(view), new RegExp(`${key} must be an array`));
  }
  const duplicate = fixture(); duplicate.nodes.push(duplicate.nodes[0]);
  assert.throws(() => renderWorkshop(duplicate), /duplicate node id/);
  const brokenEdge = fixture(); brokenEdge.edges[0].to = 'invented';
  assert.throws(() => renderWorkshop(brokenEdge), /edge endpoints/);
  const badSource = fixture(); badSource.nodes[0].sources[0].text = { html: 'not-text' };
  assert.throws(() => renderWorkshop(badSource), /source text must be a string/);
  const badEvidence = fixture(); badEvidence.evidence = [null];
  assert.throws(() => renderWorkshop(badEvidence), /each evidence item must be an object/);
  const empty = fixture(); empty.nodes = []; empty.edges = []; empty.chapters = [];
  assert.match(renderWorkshop(empty), /<!doctype html>/);
  const app = boot(empty);
  assert.equal(app.get('graph-empty').hidden, false);
  assert.match(app.get('inspector-content').textContent, /从一个知识节点开始/);
});

test('HTML is deterministic, self-contained, inertly embeds every untrusted character, and does not mutate input', () => {
  const view = fixture();
  const attack = '</script><script src="https://untrusted.invalid/?token=secret">boom</script><img src=x onerror=alert(1)>&' + String.fromCharCode(0x2028, 0x2029);
  view.title = attack;
  view.nodes[0].label = attack;
  view.nodes[0].sources[0].text = attack;
  view.nodes[1].locations[0].text = attack;
  view.nodes[0].sources[0].file = 'https://source.invalid/?token=secret';
  const original = structuredClone(view);
  const html = renderWorkshop(view);
  assert.equal(html, renderWorkshop(view));
  assert.deepEqual(view, original);
  const embedded = embeddedData(html);
  assert.deepEqual(JSON.parse(embedded), view);
  assert.equal(/[<>&]/.test(embedded), false);
  assert.equal(embedded.includes(String.fromCharCode(0x2028)), false);
  assert.equal(embedded.includes(String.fromCharCode(0x2029)), false);
  assert.match(embedded, /\\u003c\/script\\u003e/);
  assert.equal((html.match(/<script\b/g) || []).length, 2);
  assert.equal((html.match(/<\/script>/g) || []).length, 2);
  assert.equal((html.match(/<style>/g) || []).length, 1);
  assert.match(html, /<title>&lt;\/script&gt;/);
  assert.equal(/<(?:script|link|img|iframe)[^>]+(?:src|href)\s*=/i.test(html), false);
  const app = boot(view);
  assert.equal(app.get('selected-node-title').textContent, attack);
  assert.ok(app.find('.line-text').some(line => line.textContent === attack));
  app.find('[data-node-id="command/SetValue"]')[0].click();
  app.get('tab-code').click();
  assert.ok(app.find('.line-text').some(line => line.textContent === attack), 'source and code both use literal text nodes');
  assert.equal(app.find('img').length, 0);
  assert.equal(app.find('a').length, 0, 'source URLs are plain text, never navigable token-bearing links');
  assert.deepEqual(app.requests, []);
});

test('CSP hashes exactly cover the embedded script and stylesheet without unsafe-inline or eval', () => {
  const html = renderWorkshop(fixture());
  const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)[1].replaceAll('&#39;', "'");
  const style = /<style>([\s\S]*?)<\/style>/.exec(html)[1];
  assert.ok(csp.includes(`script-src 'sha256-${digest(inlineScript(html))}'`));
  assert.ok(csp.includes(`style-src 'sha256-${digest(style)}'`));
  for (const directive of ['default-src', 'connect-src', 'img-src', 'font-src', 'frame-src', 'worker-src', 'form-action', 'base-uri']) assert.ok(csp.includes(`${directive} 'none'`));
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|https?:/);
  assert.match(html, /name="referrer" content="no-referrer"/);
  for (const asset of [inlineScript(html), style]) assert.equal(asset.includes(String.fromCharCode(0)), false, 'HTML parser NUL replacement would invalidate CSP hash');
});

test('chapters, questions, paging controls, selection and cross-chapter search really update the view', () => {
  const app = boot();
  assert.equal(app.get('map-heading').textContent, '先理解意图');
  assert.match(app.get('chapter-questions').textContent, /规则通过就等于服务通过了吗/);
  assert.equal(app.find('.node-card').length, 3);
  assert.equal(app.get('selected-node-title').textContent, '为什么修改数值？');
  app.find('[data-node-id="guard/positive"]')[0].click();
  assert.equal(app.get('selected-node-title').textContent, '数值必须为正');
  assert.equal(app.find('[data-node-id="guard/positive"]')[0].getAttribute('aria-pressed'), 'true');
  app.get('next-chapter').click();
  assert.equal(app.get('map-heading').textContent, '区分证据精度');
  assert.equal(app.get('next-chapter').disabled, true);
  assert.equal(app.find('.node-card').length, 4);
  app.find('[data-node-id="candidate/shared"]')[0].click();
  assert.match(app.get('inspector-content').textContent, /next-future-kind/);
  assert.match(app.get('inspector-content').textContent, /有歧义/);
  app.find('[data-node-id="fold/old"]')[0].click();
  assert.match(app.get('inspector-content').textContent, /已过期/);
  app.search('SetValue CounterRules.scala');
  assert.equal(app.find('.node-card').length, 1);
  assert.equal(app.get('selected-node-title').textContent, 'SetValue');
  app.search('there-is-no-such-node');
  assert.equal(app.get('graph-empty').hidden, false);
  assert.equal(app.find('.node-card').length, 0);
  app.get('clear-search').click();
  assert.equal(app.get('node-search').value, '');
  assert.equal(app.get('map-heading').textContent, '区分证据精度');
  app.get('all-nodes').click();
  assert.equal(app.find('.node-card').length, 6);
  assert.match(app.get('export-count').textContent, /省略 3 个/);
});

test('only actual edges are drawn and selectable with their proof; unknown relation kinds are neutral', () => {
  const app = boot();
  assert.equal(app.find('.edge-group').length, 2);
  assert.equal(app.find('.edge-item').length, 2);
  app.find('.edge-item')[0].click();
  assert.match(app.get('inspector-content').textContent, /not-direct-generation/);
  assert.match(app.get('inspector-content').textContent, /声明引用/);
  app.find('.endpoint-link')[1].click();
  assert.equal(app.get('selected-node-title').textContent, 'SetValue');
  app.get('next-chapter').click(); app.flush();
  app.find('.edge-hit')[0].click();
  assert.match(app.get('inspector-content').textContent, /非执行证据/);
  const noEdges = fixture(); noEdges.edges = [];
  const isolated = boot(noEdges);
  assert.equal(isolated.find('.edge-group').length, 0);
  assert.match(isolated.get('edge-list').textContent, /没有模型提供的关系边/);
  const future = fixture(); future.edges[0].kind = 'future-relation'; future.edges[0].proof = null;
  const unknown = boot(future); unknown.find('.edge-item')[0].click();
  assert.match(unknown.get('inspector-content').textContent, /其他关系 · future-relation/);
  assert.match(unknown.get('inspector-content').textContent, /未附带关系依据/);
});

test('source/code tabs expose literal excerpts, genuine span highlights and candidate non-highlighting', () => {
  const app = boot();
  app.find('[data-node-id="guard/positive"]')[0].click();
  assert.equal(app.get('tab-source').getAttribute('aria-selected'), 'true');
  assert.match(app.get('inspector-tab-panel').textContent, /truth\/counter\/structure.yaml/);
  assert.match(app.get('inspector-tab-panel').textContent, /\/guards\/positive/);
  app.get('tab-code').click();
  assert.equal(app.get('tab-code').getAttribute('aria-selected'), 'true');
  const highlight = app.find('.is-highlighted');
  assert.equal(highlight.length, 1);
  assert.equal(highlight[0].getAttribute('data-line'), '21');
  assert.match(highlight[0].textContent, /require\(value > 0\)/);
  assert.equal(app.find('.excerpt-line').length, 4, 'trailing newline is not a phantom source line');
  app.get('next-chapter').click();
  app.find('[data-node-id="candidate/shared"]')[0].click();
  app.get('tab-code').click();
  assert.equal(app.find('.is-highlighted').length, 0, 'a candidate never inherits span highlighting');
  assert.match(app.get('inspector-tab-panel').textContent, /文件级候选 · 非精确 span/);
  app.find('.reverse-action')[0].click();
  assert.match(app.find('.reverse-results')[0].textContent, /文件级候选/);
});

test('code-line reverse lookup uses provided ranges and identities, including adjacent spans and unexported identities', () => {
  const view = fixture();
  view.nodes[1].locations[0].reverseIdentities.push('knowledge:renderer-fixture/not-exported');
  const app = boot(view);
  app.find('[data-node-id="guard/positive"]')[0].click(); app.get('tab-code').click();
  app.find('.line-button').find(line => line.textContent === '21').click();
  const results = app.find('.reverse-results')[0];
  assert.match(results.textContent, /区间关联/);
  assert.match(results.textContent, /文件级候选/);
  assert.match(results.textContent, /该身份未导出为节点/);
  assert.equal(app.find('[data-related-node="event/ValueChanged"]').length, 0);
  app.find('.line-button').find(line => line.textContent === '22').click();
  assert.equal(app.find('[data-related-node="event/ValueChanged"]').length, 1);
  assert.equal(app.find('[data-related-node="guard/positive"]').length, 0, 'do not associate adjacent lines by same file or name');
  app.find('[data-related-node="event/ValueChanged"]')[0].click();
  assert.equal(app.get('selected-node-title').textContent, 'ValueChanged');
  assert.equal(app.get('map-heading').textContent, '区分证据精度');
  assert.equal(app.get('tab-code').getAttribute('aria-selected'), 'true');
  assert.equal(app.find('.is-highlighted')[0].getAttribute('data-line'), '22');
});

test('missing or incomplete span metadata is not fabricated, and missing reverse results remain empty', () => {
  const view = fixture();
  view.nodes[1].locations[0] = { file: 'lonely.scala', precision: 'span', text: 'x', highlight: { startLine: 9, endLine: 9 }, reverseIdentities: [] };
  const app = boot(view); app.find('[data-node-id="command/SetValue"]')[0].click(); app.get('tab-code').click();
  assert.equal(app.find('.is-highlighted').length, 0);
  assert.match(app.get('inspector-tab-panel').textContent, /未提供文件起始行/);
  assert.match(app.get('inspector-tab-panel').textContent, /未完整包含/);
  app.find('.reverse-action')[0].click();
  assert.match(app.find('.reverse-results')[0].textContent, /没有已导出的反查身份/);
});

test('evidence drawer retains blocked and missing service states even if anchor verification passed', () => {
  const app = boot();
  assert.match(app.html, /静态快照 · 非实时运行/);
  assert.match(app.get('verification-summary').textContent, /回锚校验通过（仅导出时）/);
  app.get('open-evidence').click();
  assert.equal(app.get('evidence-dialog').open, true);
  assert.equal(app.document.activeElement, app.get('close-evidence'));
  assert.match(app.get('evidence-content').textContent, /业务服务阻断/);
  assert.match(app.get('evidence-content').textContent, /代码执行未执行/);
  assert.match(app.get('evidence-content').textContent, /fixture-code/);
  assert.match(app.get('evidence-content').textContent, /不据此合成/);
  app.get('close-evidence').click();
  assert.equal(app.get('evidence-dialog').open, false);
  assert.equal(app.document.activeElement, app.get('open-evidence'));
  const missing = fixture(); missing.evidence = []; missing.verification = {}; missing.freshness = { state: 'stale', live: true };
  const incomplete = boot(missing); incomplete.get('open-evidence').click();
  assert.match(incomplete.get('evidence-content').textContent, /完整交付保持未验/);
  assert.match(incomplete.get('freshness-summary').textContent, /检查未确认 · 状态 stale/);
  assert.match(incomplete.html, /静态快照 · 非实时运行/);
  assert.equal(incomplete.find('.badge-passed').length, 0);
});

test('keyboard tab selection, search shortcut, clear, copy and evidence actions perform no requests', async () => {
  const app = boot();
  app.document.fire('keydown', { key: '/', target: app.get('map-heading') });
  assert.equal(app.document.activeElement, app.get('node-search'));
  app.search('SetValue');
  app.get('tab-source').fire('keydown', { key: 'ArrowRight' });
  assert.equal(app.get('tab-code').getAttribute('aria-selected'), 'true');
  assert.equal(app.document.activeElement, app.get('tab-code'));
  app.find('.copy-button')[0].click(); await Promise.resolve();
  assert.equal(app.copies[0], 'generated/CounterRules.scala:21-21');
  app.find('.reverse-action')[0].click();
  app.get('footer-evidence').click(); app.get('close-evidence').click();
  app.document.fire('keydown', { key: 'Escape', target: app.get('node-search') });
  assert.equal(app.get('node-search').value, '');
  assert.deepEqual(app.requests, []);
  const client = readFileSync(new URL('../lib/workshop/client.js', import.meta.url), 'utf8');
  assert.doesNotMatch(client, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|eval)\s*\(|\bnew\s+(?:Function|Worker|Image)\s*\(|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|localStorage|sessionStorage|document\.cookie|location\.(?:href|assign|replace)/);
  const css = readFileSync(new URL('../lib/workshop/style.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /@import|url\s*\(/i);
  assert.match(css, /prefers-reduced-motion/);
});

test('parent spans retain each reverse identity own range instead of spreading child identities', () => {
  const view = fixture(), id = name => `knowledge:renderer-fixture/counter/${name}`;
  const parent = view.nodes[1].locations[0];
  parent.highlight = { startLine: 20, endLine: 23 };
  parent.reverseIdentities = [id('command/SetValue'), id('guard/positive'), id('event/ValueChanged')];
  parent.reverseLocations = [
    { identity: id('command/SetValue'), precision: 'span', startLine: 20, endLine: 23 },
    { identity: id('guard/positive'), precision: 'span', startLine: 21, endLine: 21 },
    { identity: id('event/ValueChanged'), precision: 'span', startLine: 22, endLine: 22 },
  ];
  view.nodes[2].locations = []; view.nodes[3].locations = [];
  const app = boot(view); app.find('[data-node-id="command/SetValue"]')[0].click(); app.get('tab-code').click();
  app.find('.line-button').find(line => line.textContent === '21').click();
  assert.equal(app.find('[data-related-node="guard/positive"]').length, 1);
  assert.equal(app.find('[data-related-node="event/ValueChanged"]').length, 0);
  app.find('.line-button').find(line => line.textContent === '22').click();
  assert.equal(app.find('[data-related-node="guard/positive"]').length, 0);
  assert.equal(app.find('[data-related-node="event/ValueChanged"]').length, 1);
});

test('large snapshots disclose UI truncation and load-more works without inventing topology', () => {
  const view = fixture();
  view.nodes = Array.from({ length: 27 }, (_, index) => ({ id: `node-${index}`, label: `知识 ${index}`, kind: 'unfamiliar', state: 'unmapped', sources: [], locations: [], owner: [] }));
  view.edges = [{ from: 'node-0', to: 'node-1', kind: 'source' }, { from: 'node-1', to: 'node-0', kind: 'context' }, { from: 'node-0', to: 'node-0', kind: 'context' }];
  view.chapters = [{ id: 'all', title: '测试大视图', nodeIds: view.nodes.map(node => node.id).concat('missing-id'), questions: [] }];
  view.totals = { nodes: 30, edges: 3, shownNodes: 27, omittedNodes: 3 };
  const app = boot(view);
  assert.equal(app.find('.node-card').length, 12);
  assert.match(app.get('result-count').textContent, /12 \/ 27/);
  assert.match(app.get('export-count').textContent, /另隐藏 15 个已导出节点/);
  assert.equal(app.get('chapter-gaps').hidden, false);
  assert.match(app.get('chapter-gaps').textContent, /missing-id/);
  app.get('show-more').click(); app.flush();
  assert.equal(app.find('.node-card').length, 24);
  app.get('show-more').click(); app.flush();
  assert.equal(app.find('.node-card').length, 27);
  assert.equal(app.get('show-more').hidden, true);
  assert.equal(app.find('.edge-group').length, 3, 'cycles and self edges retain the actual edge set');
});
