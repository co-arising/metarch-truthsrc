import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const stylesheet = readFileSync(new URL('./style.css', import.meta.url), 'utf8');
const client = readFileSync(new URL('./client.js', import.meta.url), 'utf8');
const schemaVersion = 'truthsrc.project-view/v1';

function validateView(view) {
  const fail = message => { throw new TypeError(`renderWorkshop: ${message}`); };
  if (!view || typeof view !== 'object' || Array.isArray(view)) fail('view must be an object');
  if (view.schemaVersion !== schemaVersion) fail(`expected schemaVersion ${schemaVersion}`);
  for (const key of ['nodes', 'edges', 'chapters']) {
    if (!Array.isArray(view[key])) fail(`${key} must be an array`);
  }
  for (const key of ['evidence', 'limitations']) {
    if (view[key] != null && !Array.isArray(view[key])) fail(`${key} must be an array`);
  }
  for (const item of view.evidence ?? []) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail('each evidence item must be an object');
  }
  const ids = new Set();
  for (const node of view.nodes) {
    if (!node || typeof node.id !== 'string' || !node.id.trim()) fail('each node needs a non-empty string id');
    if (ids.has(node.id)) fail(`duplicate node id ${node.id}`);
    ids.add(node.id);
    for (const key of ['sources', 'locations', 'diagnostics', 'owner']) {
      if (node[key] != null && !Array.isArray(node[key])) fail(`node ${node.id}: ${key} must be an array`);
    }
    for (const source of node.sources ?? []) {
      if (!source || typeof source !== 'object') fail(`node ${node.id}: invalid source`);
      if (source.text != null && typeof source.text !== 'string') fail('source text must be a string');
    }
    for (const location of node.locations ?? []) {
      if (!location || typeof location !== 'object') fail(`node ${node.id}: invalid location`);
      if (location.text != null && typeof location.text !== 'string') fail('code text must be a string');
      if (location.reverseIdentities != null && !Array.isArray(location.reverseIdentities)) fail('reverseIdentities must be an array');
    }
  }
  for (const edge of view.edges) {
    if (!edge || !ids.has(edge.from) || !ids.has(edge.to)) fail('edge endpoints must reference exported node ids');
  }
  const chapters = new Set();
  for (const chapter of view.chapters) {
    if (!chapter || typeof chapter.id !== 'string' || !chapter.id.trim()) fail('each chapter needs an id');
    if (chapters.has(chapter.id)) fail(`duplicate chapter id ${chapter.id}`);
    chapters.add(chapter.id);
    if (!Array.isArray(chapter.nodeIds)) fail(`chapter ${chapter.id}: nodeIds must be an array`);
    if (chapter.questions != null && !Array.isArray(chapter.questions)) fail(`chapter ${chapter.id}: questions must be an array`);
    // Missing chapter references are visible gaps, not new nodes or invented edges.
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function embedJson(view) {
  const unsafe = new RegExp('[<>&' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');
  return JSON.stringify(view).replace(unsafe, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

const hash = text => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;

/**
 * Render an already captured project view. No project files, URLs, or services
 * are read. The only disk reads are this module's two fixed UI assets.
 * Returns deterministic, self-contained HTML; does not write any output file.
 */
export function renderWorkshop(view) {
  validateView(view);
  const data = embedJson(view);
  const csp = [
    "default-src 'none'",
    `script-src ${hash(client)}`,
    `style-src ${hash(stylesheet)}`,
    "connect-src 'none'", "img-src 'none'", "font-src 'none'",
    "object-src 'none'", "base-uri 'none'", "form-action 'none'",
    "frame-src 'none'", "worker-src 'none'", "media-src 'none'",
  ].join('; ');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="light">
<title>${escapeHtml(view.title || '知识与代码 · Truthsrc Workshop')}</title>
<style>${stylesheet}</style>
</head>
<body>
<a class="skip-link" href="#map-heading">跳到知识地图</a>
<header class="app-header">
  <div class="brand"><span class="brand-mark" aria-hidden="true">t<span>·</span></span><div><b>truthsrc</b><span class="brand-caption">KNOWLEDGE WORKSHOP</span></div></div>
  <div class="header-project"><span class="eyebrow">知识 · 来源 · 代码</span><span id="project-name"></span></div>
  <div class="header-actions"><span class="snapshot-pill"><span class="snapshot-dot" aria-hidden="true"></span>静态快照 · 非实时运行</span><button id="open-evidence" class="button button-dark" type="button" aria-haspopup="dialog">证据与总状态 <span aria-hidden="true">↗</span></button></div>
</header>
<div class="snapshot-ribbon"><span id="freshness-summary"></span><span>不会检测后续文件变化，也不执行代码或服务。</span></div>
<div class="workspace">
  <aside class="sidebar" aria-label="章节导航">
    <div class="sidebar-intro"><span class="eyebrow">沿着问题，找到依据</span><h1 id="view-title"></h1><p id="view-subtitle"></p></div>
    <div class="nav-label">阅读路径 <span>EXPLORE</span></div>
    <nav id="chapter-nav" aria-label="教学章节"></nav>
    <button id="all-nodes" class="all-nodes" type="button">浏览全部已导出节点 <span aria-hidden="true">↗</span></button>
    <div class="sidebar-foot"><span class="tiny-rule"></span><p>图上的关联不是运行轨迹。<br>每一条线，都可以查看依据。</p><button id="sidebar-evidence" class="text-button" type="button">查看快照身份与限制 →</button></div>
  </aside>
  <main class="map-panel" id="map-panel">
    <div class="map-intro"><div class="section-overline"><span id="chapter-kicker" class="eyebrow"></span><span id="chapter-progress"></span></div><h2 id="map-heading" tabindex="-1"></h2><p id="chapter-description"></p><div id="chapter-questions"></div></div>
    <div class="search-bar"><span class="search-symbol" aria-hidden="true"></span><label class="sr-only" for="node-search">搜索全部已导出节点、身份或文件</label><input id="node-search" type="search" placeholder="搜索知识、身份或文件…" autocomplete="off" spellcheck="false"><button id="clear-search" type="button" class="search-clear" aria-label="清除搜索" hidden>清除</button><kbd aria-hidden="true">/</kbd></div>
    <div class="map-meta"><span id="result-count" role="status" aria-live="polite"></span><span>点选节点，查看右侧依据</span></div>
    <div id="chapter-gaps" class="notice notice-warning" hidden></div>
    <div class="graph-legend" aria-label="图边类型"><span><i class="legend-line"></i>声明引用</span><span><i class="legend-line source"></i>来源关联</span><span><i class="legend-line context"></i>讲解线 · 非执行</span></div>
    <div id="graph-area" class="graph-area"><svg id="graph-edges" class="graph-edges" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"></svg><div id="graph-layers" class="graph-layers"></div></div>
    <div id="graph-empty" class="empty-state" hidden><span class="empty-symbol" aria-hidden="true">∅</span><h3>这里还没有可展示的节点</h3><p id="graph-empty-reason"></p></div>
    <div class="map-more"><button id="show-more" class="button button-light" type="button" hidden></button></div>
    <details class="edge-directory" id="edge-directory"><summary id="edge-directory-title">图中关系</summary><div id="edge-list"></div></details>
    <p id="export-count" class="export-count"></p>
    <div class="chapter-pager"><button id="previous-chapter" class="text-button" type="button">← 上一章</button><button id="next-chapter" class="text-button" type="button">下一章 →</button></div>
  </main>
  <aside id="inspector" class="inspector" aria-label="选中知识与来源"><div id="inspector-content"></div></aside>
</div>
<footer class="evidence-strip"><span class="footer-label">本次导出</span><span id="verification-summary"></span><span class="runtime-caution">服务状态以独立证据为准 · 缺项即未验</span><button id="footer-evidence" type="button" class="text-button">展开证据 <span aria-hidden="true">↑</span></button></footer>
<dialog id="evidence-dialog" class="evidence-dialog" aria-labelledby="evidence-heading"><div class="drawer-top"><div><span class="eyebrow">SNAPSHOT EVIDENCE</span><h2 id="evidence-heading">证据与总状态</h2></div><button id="close-evidence" class="button button-light" type="button" aria-label="关闭证据抽屉">关闭 ×</button></div><div id="evidence-content" class="evidence-content"></div></dialog>
<div id="announcer" class="sr-only" role="status" aria-live="polite"></div>
<noscript><div class="noscript">这是离线知识快照。需启用 JavaScript 才能浏览章节、节点与摘录；本页面不会连接网络或执行被展示的代码。</div></noscript>
<script id="workshop-view" type="application/json">${data}</script>
<script>${client}</script>
</body>
</html>\n`;
}
