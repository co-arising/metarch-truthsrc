(() => {
  'use strict';

  const view = JSON.parse(document.getElementById('workshop-view').textContent);
  const $ = id => document.getElementById(id);
  const list = value => Array.isArray(value) ? value : [];
  const text = value => value == null ? '' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
  const el = (tag, className, content) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content != null) element.textContent = text(content);
    return element;
  };
  const button = (label, className, action) => {
    const element = el('button', className, label);
    element.type = 'button';
    element.addEventListener('click', action);
    return element;
  };
  const notice = (message, tone = '') => el('p', `notice ${tone ? `notice-${tone}` : ''}`, message);
  const announce = message => { $('announcer').textContent = message; };
  const number = value => Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString('zh-CN') : '未提供';
  const lineNumber = value => Number.isSafeInteger(value) && value > 0;
  const nodeById = new Map(view.nodes.map(node => [node.id, node]));
  const identityIndex = new Map();
  for (const node of view.nodes) {
    for (const identity of new Set([node.id, text(node.identity)].filter(Boolean))) {
      if (!identityIndex.has(identity)) identityIndex.set(identity, []);
      identityIndex.get(identity).push(node);
    }
  }
  const chapters = view.chapters;
  const PAGE_SIZE = 12;
  let chapterId = chapters[0]?.id ?? null;
  let selectedId = null;
  let selectedEdge = null;
  let activeTab = 'source';
  let search = '';
  let limit = PAGE_SIZE;
  let visibleNodes = [];
  let visibleEdges = [];
  let nodeButtons = new Map();
  let edgeButtons = new Map();
  let edgePaths = new Map();
  let drawFrame = null;
  let dialogOpener = null;

  const kindNames = new Map(Object.entries({
    story: '业务故事', usecase: '用例', 'use-case': '用例', command: '命令', event: '事件',
    guard: '规则', rule: '规则', fold: '状态演进', aggregate: '聚合', saga: '事务协调',
    'saga-host': '事务宿主', pipeline: '执行流程', role: '角色', structure: '结构声明',
    'read-model': '读模型', readModel: '读模型', projectionStore: '投影存储',
    context: '上下文', system: '系统', policy: '策略', 'value-object': '值对象',
  }));
  const kindLabel = kind => kindNames.get(kind) || (kind ? text(kind) : '未分类知识');
  const stateNames = new Map(Object.entries({
    mapped: ['已关联', 'mapped'], 'not-generated': ['未生成', 'neutral'],
    ambiguous: ['有歧义', 'warning'], unmapped: ['未关联', 'warning'], stale: ['已过期', 'warning'],
  }));
  const statusNames = new Map(Object.entries({
    passed: ['通过', 'passed'], 'not-run': ['未执行', 'warning'],
    blocked: ['阻断', 'warning'], failed: ['失败', 'failed'],
  }));
  const stateBadge = state => {
    const [label, tone] = stateNames.get(state) || [`未知状态${state ? ` · ${text(state)}` : ''}`, 'neutral'];
    return el('span', `badge badge-${tone}`, label);
  };
  const statusBadge = status => {
    const [label, tone] = statusNames.get(status) || ['未核验', 'warning'];
    return el('span', `badge badge-${tone}`, label);
  };
  const edgeType = edge => {
    if (edge.kind === 'declared-reference') return ['声明引用', 'declared'];
    if (edge.kind === 'source') return ['来源关联', 'source'];
    if (edge.kind === 'context') return ['讲解线 · 非执行证据', 'context'];
    return [`其他关系${edge.kind ? ` · ${text(edge.kind)}` : ''}`, 'unknown'];
  };
  const nodeLabel = node => text(node.label || node.identity || node.id);
  const currentChapter = () => chapters.find(chapter => chapter.id === chapterId);
  const codeEntries = view.nodes.flatMap(node => list(node.locations).map(location => ({ node, location })));
  const searchable = new Map(view.nodes.map(node => [node.id, [
    node.label, node.identity, node.id, node.kind, node.description, ...list(node.owner),
    ...list(node.sources).flatMap(source => [source.file, source.pointer, source.label]),
    ...list(node.locations).map(location => location.file),
  ].map(text).join('\n').toLocaleLowerCase()]));

  function details(label, value) {
    const box = el('details', 'metadata-details');
    box.append(el('summary', '', label), el('pre', 'metadata-text', text(value)));
    return box;
  }
  function field(label, value) {
    const row = el('div', 'identity-row');
    row.append(el('dt', '', label), el('dd', '', value == null || value === '' ? '未提供' : text(value)));
    return row;
  }
  function identityFields() {
    const fields = el('dl', 'identity-fields');
    for (const [label, value] of [
      ['项目', view.project?.name], ['系统', view.project?.system], ['上下文', view.project?.context],
      ['作者快照', view.snapshot?.source], ['知识快照', view.snapshot?.knowledge],
      ['生成批次', view.snapshot?.generation], ['代码摘要', view.snapshot?.codeDigest],
    ]) fields.append(field(label, value));
    return fields;
  }

  $('view-title').textContent = text(view.title || '知识与代码，一路可追查');
  $('view-subtitle').textContent = text(view.subtitle);
  $('project-name').textContent = [view.project?.name || view.project?.system, view.project?.context].filter(Boolean).map(text).join(' / ') || '项目身份未提供';
  const freshness = view.freshness || {};
  $('freshness-summary').textContent = `${freshness.checkedAtExport === true ? '导出时已检查' : '导出时检查未确认'} · 状态 ${text(freshness.state) || '未知'}`;
  const verification = view.verification || {};
  $('verification-summary').textContent = verification.passed === true ? '回锚校验通过（仅导出时）' : verification.passed === false ? '回锚校验未通过' : '回锚校验未提供';

  function renderNavigation() {
    const nav = $('chapter-nav');
    nav.replaceChildren();
    chapters.forEach((chapter, index) => {
      const item = button('', 'chapter-link', () => changeChapter(chapter.id));
      item.setAttribute('data-chapter-id', chapter.id);
      if (chapter.id === chapterId && !search) item.setAttribute('aria-current', 'step');
      const copy = el('span', 'chapter-link-copy');
      copy.append(el('span', 'chapter-link-title', chapter.title || chapter.id));
      if (chapter.kicker) copy.append(el('span', 'chapter-link-kicker', chapter.kicker));
      item.append(el('span', 'chapter-number', String(index + 1).padStart(2, '0')), copy, el('span', 'chapter-arrow', '›'));
      nav.append(item);
    });
    $('all-nodes').setAttribute('aria-pressed', String(chapterId === null && !search));
  }

  function changeChapter(id) {
    chapterId = id;
    search = '';
    limit = PAGE_SIZE;
    $('node-search').value = '';
    renderScope();
    const first = visibleNodes[0];
    if (first) selectNode(first.id, 'source', false);
    else clearInspector();
  }

  function filteredNodes() {
    if (search) {
      const terms = search.toLocaleLowerCase().split(/\s+/).filter(Boolean);
      return view.nodes.filter(node => terms.every(term => searchable.get(node.id).includes(term)));
    }
    const chapter = currentChapter();
    return chapter ? [...new Set(chapter.nodeIds)].map(id => nodeById.get(id)).filter(Boolean) : view.nodes;
  }

  function renderScope() {
    renderNavigation();
    const chapter = currentChapter();
    const index = chapters.indexOf(chapter);
    $('chapter-kicker').textContent = search ? 'FIND IN SNAPSHOT' : text(chapter?.kicker) || 'KNOWLEDGE MAP';
    $('chapter-progress').textContent = search ? '搜索整个导出快照' : chapter ? `${String(index + 1).padStart(2, '0')} / ${String(chapters.length).padStart(2, '0')}` : '仅包含已导出知识';
    $('map-heading').textContent = search ? '找到问题的落点' : text(chapter?.title) || '全部已导出节点';
    $('chapter-description').textContent = search ? `正在搜索「${search}」。范围包含全部已导出节点，不包含未导出的知识。` : text(chapter?.description) || '选择一个节点，查看真实身份、作者来源与代码关联。';
    $('chapter-questions').replaceChildren();
    if (!search && list(chapter?.questions).length) {
      const questions = el('div', 'question-card');
      questions.append(el('span', 'eyebrow', '带着问题看图'));
      list(chapter.questions).forEach(question => questions.append(el('p', '', question)));
      $('chapter-questions').append(questions);
    }
    $('clear-search').hidden = !search;
    const missing = !search && chapter ? [...new Set(chapter.nodeIds)].filter(id => !nodeById.has(id)) : [];
    $('chapter-gaps').hidden = missing.length === 0;
    $('chapter-gaps').textContent = `本章有 ${missing.length} 个引用未包含在导出快照中，未补造节点：${missing.join('、')}`;
    const matching = filteredNodes();
    visibleNodes = matching.slice(0, limit);
    const ids = new Set(visibleNodes.map(node => node.id));
    visibleEdges = view.edges.map((edge, index) => ({ edge, index })).filter(({ edge }) => ids.has(edge.from) && ids.has(edge.to));
    $('result-count').textContent = `显示 ${visibleNodes.length} / ${matching.length} 个节点 · ${visibleEdges.length} 条关系`;
    $('graph-empty').hidden = visibleNodes.length > 0;
    $('graph-area').hidden = visibleNodes.length === 0;
    $('graph-empty-reason').textContent = search ? '试试更短的业务词、限定身份或文件名，或清除搜索。不会自动查询其他文件。' : '本章未包含可展示的节点。可切换章节或查看导出限制。';
    $('show-more').hidden = matching.length <= limit;
    $('show-more').textContent = `再显示 ${Math.min(PAGE_SIZE, Math.max(0, matching.length - limit))} 个节点（余 ${Math.max(0, matching.length - limit)} 个）`;
    const totals = view.totals || {};
    $('export-count').textContent = `导出内 ${view.nodes.length} 个节点 / ${view.edges.length} 条边；模型声明总数 ${number(totals.nodes)} 个节点 / ${number(totals.edges)} 条边，展示 ${number(totals.shownNodes)} 个，省略 ${number(totals.omittedNodes)} 个。当前筛选另隐藏 ${view.nodes.length - visibleNodes.length} 个已导出节点、${view.edges.length - visibleEdges.length} 条已导出边。`;
    $('previous-chapter').disabled = !!search || index <= 0;
    $('next-chapter').disabled = !!search || index < 0 || index >= chapters.length - 1;
    renderGraph();
    if (selectedId && !ids.has(selectedId) && selectedEdge === null) {
      if (visibleNodes.length) selectNode(visibleNodes[0].id, activeTab, false);
      else clearInspector();
    } else if (selectedEdge !== null && !visibleEdges.some(item => item.index === selectedEdge)) {
      if (visibleNodes.length) selectNode(visibleNodes[0].id, activeTab, false);
      else clearInspector();
    }
  }

  // Deterministic layers of the supplied directed graph. Cycles remain visible
  // in one final layer; neither layout nor a shared label introduces an edge.
  function layersFor(nodes, edges) {
    const indegree = new Map(nodes.map(node => [node.id, 0]));
    const outgoing = new Map(nodes.map(node => [node.id, []]));
    for (const { edge } of edges) {
      if (edge.from === edge.to) continue;
      outgoing.get(edge.from).push(edge.to);
      indegree.set(edge.to, indegree.get(edge.to) + 1);
    }
    const remaining = new Set(nodes.map(node => node.id));
    const layers = [];
    while (remaining.size) {
      const next = nodes.filter(node => remaining.has(node.id) && indegree.get(node.id) === 0);
      if (!next.length) { layers.push(nodes.filter(node => remaining.has(node.id))); break; }
      layers.push(next);
      for (const node of next) remaining.delete(node.id);
      for (const node of next) for (const target of outgoing.get(node.id)) indegree.set(target, indegree.get(target) - 1);
    }
    return layers;
  }

  function renderGraph() {
    nodeButtons = new Map();
    const layers = $('graph-layers');
    layers.replaceChildren();
    for (const group of layersFor(visibleNodes, visibleEdges)) {
      const row = el('div', 'graph-layer');
      for (const node of group) {
        const card = button('', 'node-card', () => selectNode(node.id, 'source', true));
        card.setAttribute('data-node-id', node.id);
        card.setAttribute('aria-label', `${nodeLabel(node)} · ${kindLabel(node.kind)}`);
        const top = el('span', 'node-top');
        top.append(el('span', 'node-kind', kindLabel(node.kind)), stateBadge(node.state));
        card.append(top, el('strong', 'node-title', nodeLabel(node)));
        if (node.description) {
          const description = el('span', 'node-description', node.description);
          description.title = text(node.description);
          card.append(description);
        }
        const bottom = el('span', 'node-bottom');
        bottom.append(el('span', '', `${list(node.sources).length} 处来源 · ${list(node.locations).length} 处代码`), el('span', 'node-arrow', '↗'));
        card.append(bottom);
        row.append(card);
        nodeButtons.set(node.id, card);
      }
      layers.append(row);
    }
    edgeButtons = new Map();
    $('edge-list').replaceChildren();
    $('edge-directory-title').textContent = `图中关系 ${visibleEdges.length} · 选择一条查看依据`;
    if (!visibleEdges.length) $('edge-list').append(notice('当前节点之间没有模型提供的关系边。并排展示不表示存在关联。'));
    for (const { edge, index } of visibleEdges) {
      const [label, type] = edgeType(edge);
      const item = button('', `edge-item edge-${type}`, () => selectEdge(index));
      item.setAttribute('data-edge-index', String(index));
      item.append(el('span', 'edge-item-type', label), el('span', 'edge-item-label', `${nodeLabel(nodeById.get(edge.from))} → ${nodeLabel(nodeById.get(edge.to))}`));
      if (edge.label) item.append(el('span', 'edge-item-note', edge.label));
      $('edge-list').append(item);
      edgeButtons.set(index, item);
    }
    updateSelection();
    scheduleEdges();
  }

  function updateSelection() {
    for (const [id, card] of nodeButtons) card.setAttribute('aria-pressed', String(id === selectedId && selectedEdge === null));
    for (const [index, item] of edgeButtons) item.setAttribute('aria-pressed', String(index === selectedEdge));
    for (const [index, path] of edgePaths) path.classList.toggle('is-selected', index === selectedEdge);
  }
  function scheduleEdges() {
    if (drawFrame !== null) cancelAnimationFrame(drawFrame);
    drawFrame = requestAnimationFrame(() => { drawFrame = null; drawEdges(); });
  }
  function svgElement(name, attrs) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
    return element;
  }
  function drawEdges() {
    const svg = $('graph-edges');
    svg.replaceChildren();
    edgePaths = new Map();
    const area = $('graph-area').getBoundingClientRect();
    if (!area.width || !area.height) return;
    svg.setAttribute('viewBox', `0 0 ${area.width} ${area.height}`);
    svg.setAttribute('width', String(area.width));
    svg.setAttribute('height', String(area.height));
    const defs = svgElement('defs', {});
    for (const tone of ['declared', 'source', 'context', 'unknown']) {
      const marker = svgElement('marker', { id: `arrow-${tone}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' });
      marker.append(svgElement('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: `arrow-${tone}` }));
      defs.append(marker);
    }
    svg.append(defs);
    for (const { edge, index } of visibleEdges) {
      const a = nodeButtons.get(edge.from).getBoundingClientRect();
      const b = nodeButtons.get(edge.to).getBoundingClientRect();
      const x1 = a.left + a.width / 2 - area.left;
      const x2 = b.left + b.width / 2 - area.left;
      const y1 = a.bottom - area.top;
      const y2 = b.top - area.top;
      let d;
      if (edge.from === edge.to) {
        const x = a.right - area.left, y = a.top + a.height / 2 - area.top;
        d = `M ${x} ${y - 18} C ${x + 26} ${y - 35}, ${x + 26} ${y + 35}, ${x} ${y + 18}`;
      } else if (b.top >= a.bottom) {
        const middle = (y1 + y2) / 2;
        d = `M ${x1} ${y1} C ${x1} ${middle}, ${x2} ${middle}, ${x2} ${y2 - 3}`;
      } else if (Math.abs(a.top - b.top) < 5) {
        const forward = b.left > a.left;
        const start = (forward ? a.right : a.left) - area.left;
        const end = (forward ? b.left : b.right) - area.left;
        const y = a.top + a.height / 2 - area.top;
        d = `M ${start} ${y} L ${end} ${y}`;
      } else {
        const side = Math.max(a.right, b.right) - area.left + 14;
        d = `M ${a.right - area.left} ${a.top + a.height / 2 - area.top} C ${side} ${y1}, ${side} ${y2}, ${b.right - area.left} ${b.top + b.height / 2 - area.top}`;
      }
      const type = edgeType(edge)[1];
      const group = svgElement('g', { class: `edge-group edge-${type}`, 'data-edge-index': index });
      const line = svgElement('path', { class: 'edge-line', d, 'marker-end': `url(#arrow-${type})` });
      const hit = svgElement('path', { class: 'edge-hit', d });
      hit.addEventListener('click', () => selectEdge(index));
      group.append(line, hit);
      svg.append(group);
      edgePaths.set(index, group);
    }
    updateSelection();
  }

  function clearInspector() {
    selectedId = null;
    selectedEdge = null;
    const empty = el('div', 'inspector-empty');
    empty.append(el('span', 'eyebrow', 'FOLLOW THE SOURCE'), el('h2', '', '从一个知识节点开始'), el('p', '', '选中图中的节点，查看它的真实作者位置、展开身份与代码。没有关联的部分，会如实保留空缺。'));
    $('inspector-content').replaceChildren(empty);
    updateSelection();
  }
  function focusInspector() {
    if (window.matchMedia('(max-width: 1000px)').matches) $('inspector').scrollIntoView({ block: 'start', behavior: 'auto' });
  }
  function selectNode(id, tab = 'source', scroll = false) {
    const node = nodeById.get(id);
    if (!node) return;
    selectedId = id;
    selectedEdge = null;
    activeTab = tab;
    if (!visibleNodes.some(item => item.id === id)) {
      search = '';
      $('node-search').value = '';
      chapterId = chapters.find(chapter => chapter.nodeIds.includes(id))?.id ?? null;
      const position = filteredNodes().findIndex(item => item.id === id);
      limit = Math.max(PAGE_SIZE, Math.ceil((position + 1) / PAGE_SIZE) * PAGE_SIZE);
      renderScope();
    }
    updateSelection();
    renderInspector(node);
    $('inspector').scrollTop = 0;
    announce(`已选择 ${nodeLabel(node)}，${kindLabel(node.kind)}`);
    if (scroll) {
      $('selected-node-title').focus({ preventScroll: true });
      focusInspector();
    }
  }

  function renderInspector(node) {
    const root = $('inspector-content');
    const heading = el('div', 'inspector-heading');
    const top = el('div', 'inspector-overline');
    top.append(el('span', 'eyebrow', 'SELECTED KNOWLEDGE'), stateBadge(node.state));
    heading.append(top, el('span', 'inspector-kind', `${kindLabel(node.kind)}${node.kind ? ` / ${text(node.kind)}` : ''}`));
    const title = el('h2', '', nodeLabel(node));
    title.id = 'selected-node-title';
    title.tabIndex = -1;
    heading.append(title);
    if (node.description) heading.append(el('p', 'inspector-description', node.description));
    const identity = el('details', 'node-identity');
    identity.append(el('summary', '', '限定身份与归属'));
    const fields = el('dl', 'identity-fields');
    fields.append(field('身份', node.identity || node.id), field('节点 ID', node.id), field('归属', list(node.owner).length ? node.owner.join(' / ') : null));
    identity.append(fields);
    heading.append(identity);
    if (node.state !== 'mapped') {
      const explanation = {
        'not-generated': '模型标记为未生成。知识存在，不等于已有可运行实现；不会借同名节点补齐代码。',
        ambiguous: '关联有歧义。下面保留候选和身份，不将其提升为唯一、精确结果。',
        unmapped: '尚未建立代码关联。不会把文件名相似当成回锚。',
        stale: '这条关联已过期。可阅读捕获的摘录，但不能用它证明当前文件仍一致。',
      };
      heading.append(notice(Object.hasOwn(explanation, node.state) ? explanation[node.state] : '模型未给出可确认的关联状态，按未知展示。', 'warning'));
    }
    const tabs = el('div', 'inspector-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '来源与代码');
    const panel = el('div', 'inspector-body');
    panel.id = 'inspector-tab-panel';
    panel.setAttribute('role', 'tabpanel');
    panel.tabIndex = 0;
    const tabButtons = [];
    for (const [id, label, count] of [['source', '作者来源', list(node.sources).length], ['code', '生成代码', list(node.locations).length]]) {
      const item = button(`${label}  ${count}`, 'inspector-tab', () => activate(id));
      item.id = `tab-${id}`;
      item.setAttribute('role', 'tab');
      item.setAttribute('aria-controls', panel.id);
      item.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : id === 'source' ? 1 : 0;
        activate(next === 0 ? 'source' : 'code');
        tabButtons[next].focus();
      });
      tabButtons.push(item);
      tabs.append(item);
    }
    function activate(id) {
      activeTab = id;
      tabButtons.forEach((item, index) => {
        const selected = id === (index === 0 ? 'source' : 'code');
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
      });
      panel.setAttribute('aria-labelledby', `tab-${id}`);
      panel.replaceChildren();
      if (id === 'source') renderSources(panel, node);
      else renderCode(panel, node);
    }
    root.replaceChildren(heading, tabs, panel);
    activate(activeTab);
    if (list(node.diagnostics).length) root.append(details(`节点诊断 · ${node.diagnostics.length}`, node.diagnostics));
  }

  function copyButton(value) {
    const item = button('复制位置', 'copy-button', async () => {
      try {
        if (!navigator.clipboard?.writeText) throw new Error('unavailable');
        await navigator.clipboard.writeText(value);
        item.textContent = '已复制';
        announce('已复制位置');
      } catch {
        item.textContent = '请手动选择位置';
        announce('当前浏览器不允许复制，请手动选择文件位置文字。');
      }
    });
    return item;
  }

  function excerptLines(excerpt, clickable, onLine) {
    const wrap = el('div', `excerpt ${clickable ? 'code-excerpt' : 'source-excerpt'}`);
    const hasStart = lineNumber(excerpt.startLine);
    const highlight = excerpt.highlight;
    const hasHighlight = excerpt.precision === 'span' && hasStart && lineNumber(highlight?.startLine) && lineNumber(highlight?.endLine) && highlight.endLine >= highlight.startLine;
    if (!hasStart) wrap.append(el('p', 'excerpt-note', '未提供文件起始行；下方为摘录序号，不能用作精确行反查。'));
    if (typeof excerpt.text !== 'string' || !excerpt.text.length) {
      wrap.append(el('p', 'excerpt-note', '此位置未附带文本摘录。页面不会读取磁盘补齐。'));
      return wrap;
    }
    const lines = excerpt.text.split('\n');
    // A trailing newline terminates the last line; it is not another captured line.
    if (lines.at(-1) === '') lines.pop();
    lines.forEach((content, index) => {
      const n = (hasStart ? excerpt.startLine : 1) + index;
      const highlighted = hasHighlight && n >= highlight.startLine && n <= highlight.endLine;
      const row = el('div', `excerpt-line${highlighted ? ' is-highlighted' : ''}`);
      row.setAttribute('data-line', String(n));
      if (clickable && hasStart) {
        const line = button(String(n), 'line-number line-button', () => onLine(n));
        line.setAttribute('aria-label', `反查代码第 ${n} 行`);
        line.setAttribute('aria-pressed', 'false');
        row.append(line);
      } else row.append(el('span', 'line-number', n));
      row.append(el('code', 'line-text', content));
      wrap.append(row);
    });
    return wrap;
  }

  function renderSources(panel, node) {
    panel.append(el('p', 'panel-intro', '作者声明是编辑入口。展开知识可以共享同一处声明，但仍保留各自身份。'));
    if (!list(node.sources).length) { panel.append(notice('模型没有提供作者摘录或来源位置。未重建虚拟作者文件。', 'warning')); return; }
    list(node.sources).forEach((source, index) => {
      const card = el('section', 'excerpt-card');
      const head = el('div', 'excerpt-heading');
      head.append(el('span', 'eyebrow', source.label || `作者来源 ${index + 1}`));
      const location = `${text(source.file)}${source.pointer ? `#${text(source.pointer)}` : ''}`;
      head.append(copyButton(location));
      card.append(head, el('p', 'file-path', source.file || '文件位置未提供'));
      if (source.pointer) card.append(el('p', 'source-pointer', source.pointer));
      if (lineNumber(source.startLine)) card.append(el('p', 'excerpt-caption', `作者文件摘录 · 从第 ${source.startLine} 行开始`));
      card.append(excerptLines(source, false));
      if (source.sha256) card.append(details('来源摘要', source.sha256));
      panel.append(card);
    });
  }

  function spanRange(location) {
    const range = location.highlight;
    return location.precision === 'span' && lineNumber(range?.startLine) && lineNumber(range?.endLine) && range.endLine >= range.startLine ? range : null;
  }
  function reverseAt(file, line) {
    const hits = [];
    if (typeof file !== 'string' || !file) return hits;
    for (const { location } of codeEntries) {
      if (location.file !== file) continue;
      if (Array.isArray(location.reverseLocations)) {
        for (const row of location.reverseLocations) {
          if (row.precision === 'file') hits.push({ identity: text(row.identity), precision: 'file' });
          else if (row.precision === 'span' && lineNumber(row.startLine) && lineNumber(row.endLine) && line >= row.startLine && line <= row.endLine)
            hits.push({ identity: text(row.identity), precision: 'span' });
        }
        continue;
      }
      const range = spanRange(location);
      if (range && line >= range.startLine && line <= range.endLine) {
        for (const identity of list(location.reverseIdentities)) hits.push({ identity: text(identity), precision: 'span' });
      } else if (location.precision === 'file') {
        for (const identity of list(location.reverseIdentities)) hits.push({ identity: text(identity), precision: 'file' });
      }
    }
    return hits;
  }
  function renderReverse(target, hits, caption) {
    target.replaceChildren();
    target.hidden = false;
    target.append(el('h4', '', caption), el('p', '', '仅按导出模型中的反查身份与区间定位；不是类型解析或唯一符号认证。'));
    const unique = new Map();
    for (const hit of hits) {
      const key = JSON.stringify([hit.precision, hit.identity]);
      if (!unique.has(key)) unique.set(key, hit);
    }
    if (!unique.size) target.append(notice('此处没有已导出的反查身份。没有结果不表示整个项目不存在关联。', 'warning'));
    for (const hit of unique.values()) {
      const nodes = identityIndex.get(hit.identity) || [];
      const precision = hit.precision === 'span' ? '区间关联' : hit.precision === 'file' ? '文件级候选' : '精度未确认';
      if (!nodes.length) {
        target.append(el('p', 'reverse-missing', `${precision} · ${hit.identity}（该身份未导出为节点）`));
        continue;
      }
      for (const node of nodes) {
        const item = button('', 'reverse-link', () => selectNode(node.id, 'code', true));
        item.setAttribute('data-related-node', node.id);
        item.append(el('span', '', nodeLabel(node)), el('span', 'reverse-precision', `${precision}${nodes.length > 1 ? ' · 身份对应多个节点' : ''}`), el('code', '', hit.identity));
        target.append(item);
      }
    }
    announce(`${caption}，${unique.size} 个反查身份`);
    target.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }

  function renderCode(panel, node) {
    panel.append(el('p', 'panel-intro', '高亮只表示模型给出的文本 span；文件级候选不高亮。点击行号，从代码反查相关知识。'));
    if (!list(node.locations).length) { panel.append(notice('没有提供代码位置。这不是运行失败，也不能证明已有实现。', 'warning')); return; }
    list(node.locations).forEach((location, index) => {
      const card = el('section', 'excerpt-card');
      card.setAttribute('data-location-index', String(index));
      const range = spanRange(location);
      const precisionLabel = location.precision === 'span' ? '精确文本 span' : location.precision === 'file' ? '文件级候选 · 非精确 span' : '关联精度未确认';
      const head = el('div', 'excerpt-heading');
      head.append(el('span', `badge badge-${range ? 'mapped' : 'warning'}`, precisionLabel), copyButton(`${text(location.file)}${range ? `:${range.startLine}-${range.endLine}` : ''}`));
      card.append(head, el('p', 'file-path', location.file || '文件位置未提供'));
      const lineSpan = lineNumber(location.startLine) ? `${location.startLine}${lineNumber(location.endLine) ? `–${location.endLine}` : ' 起'}` : '未提供';
      card.append(el('p', 'excerpt-caption', `摘录行 ${lineSpan}${range ? ` · 高亮行 ${range.startLine}–${range.endLine}` : ' · 不推断高亮区间'}`));
      if (location.precision === 'span' && !range) card.append(notice('模型声明 span，但缺少有效高亮行区间；不凭名称或文本猜测。', 'warning'));
      if (range && (!lineNumber(location.startLine) || typeof location.text !== 'string' || range.startLine < location.startLine || range.endLine >= location.startLine + location.text.replace(/\n$/, '').split('\n').length)) {
        card.append(notice('高亮区间未完整包含在所附摘录内。这里只显示交集，不补读文件。', 'warning'));
      }
      const reverse = el('div', 'reverse-results');
      reverse.setAttribute('aria-live', 'polite');
      reverse.hidden = true;
      const excerpt = excerptLines(location, true, n => {
        for (const line of excerpt.querySelectorAll('.line-button')) line.setAttribute('aria-pressed', String(line.textContent === String(n)));
        renderReverse(reverse, reverseAt(location.file, n), `第 ${n} 行 → 相关知识`);
      });
      card.append(excerpt);
      const action = button('从此代码位置反查 →', 'reverse-action', () => renderReverse(reverse,
        Array.isArray(location.reverseLocations) ? location.reverseLocations.map(row => ({ identity: text(row.identity), precision: row.precision }))
          : list(location.reverseIdentities).map(identity => ({ identity: text(identity), precision: range ? 'span' : location.precision === 'file' ? 'file' : 'unknown' })),
        `${range ? '此 span' : location.precision === 'file' ? '此文件候选' : '此位置（精度未确认）'} → 相关知识`));
      card.append(action, reverse);
      const metadata = {};
      if (location.sourceIdentity) metadata.sourceIdentity = location.sourceIdentity;
      if (location.fingerprint) metadata.fingerprint = location.fingerprint;
      if (Object.keys(metadata).length) card.append(details('关联身份与指纹', metadata));
      panel.append(card);
    });
  }

  function selectEdge(index) {
    const edge = view.edges[index];
    if (!edge) return;
    selectedEdge = index;
    updateSelection();
    const [label] = edgeType(edge);
    const head = el('div', 'inspector-heading');
    head.append(el('span', 'eyebrow', 'SELECTED RELATION'), el('h2', '', edge.label || label), el('span', 'badge badge-neutral', label));
    head.append(el('p', 'inspector-description', edge.kind === 'context' ? '这是一条讲解关系，仅用于阅读导航，不证明代码执行、事务顺序或业务因果。' : '这是模型提供的关联，不是服务运行轨迹，也不自动代表直接生成或调用关系。'));
    const body = el('div', 'inspector-body');
    for (const [name, id] of [['起点', edge.from], ['终点', edge.to]]) {
      const node = nodeById.get(id);
      const jump = button('', 'endpoint-link', () => selectNode(id, 'source', true));
      jump.append(el('span', 'eyebrow', name), el('strong', '', nodeLabel(node)), el('code', '', node.identity || node.id));
      body.append(jump);
    }
    const fields = el('dl', 'identity-fields');
    fields.append(field('关系类型', edge.kind), field('asserted（原值）', edge.asserted));
    body.append(fields, el('h3', '', '关联依据'));
    if (edge.proof == null || edge.proof === '') body.append(notice('模型未附带关系依据；不能把这条线提升为已验证事实。', 'warning'));
    else body.append(el('pre', 'proof-text', edge.proof));
    body.append(notice('以上是展示模型的原始关联。没有补造其他连线，也没有自动获取外部来源。'));
    $('inspector-content').replaceChildren(head, body);
    announce(`已选择关系：${label}`);
    focusInspector();
  }

  function renderEvidence() {
    const root = $('evidence-content');
    root.replaceChildren();
    const summary = el('section', 'evidence-summary');
    summary.append(el('h3', '', '按层看结果，不把局部通过当作完整验收'), notice('静态快照 · 非实时运行。此页不发起校验、不运行服务；导出后文件是否变化，需要重新校验并导出。', 'warning'));
    const verifyRow = el('div', 'verification-row');
    verifyRow.append(el('strong', '', '回锚校验'), statusBadge(verification.passed === true ? 'passed' : verification.passed === false ? 'failed' : 'not-run'));
    summary.append(verifyRow, el('p', '', '回锚通过不等于代码已执行，更不等于银行或其他业务服务已通过。运行、交付与新人可用性只能以各自证据判定。'));
    root.append(summary);
    const evidence = list(view.evidence);
    const counts = new Map();
    evidence.forEach(item => counts.set(item.status, (counts.get(item.status) || 0) + 1));
    root.append(el('p', 'evidence-counts', `已提供 ${evidence.length} 项证据：通过 ${counts.get('passed') || 0}，失败 ${counts.get('failed') || 0}，阻断 ${counts.get('blocked') || 0}，未执行 ${counts.get('not-run') || 0}，其他 ${evidence.filter(item => !statusNames.has(item.status)).length}。不据此合成“完整通过”。`));
    if (!evidence.length) root.append(notice('没有提供分层验收证据。代码执行、业务服务及完整交付保持未验，不借用其他快照结果。', 'warning'));
    evidence.forEach(item => {
      const card = el('section', 'evidence-card');
      const top = el('div', 'evidence-card-top');
      top.append(el('h3', '', item.label || item.id || '未命名证据'), statusBadge(item.status));
      card.append(top);
      if (item.summary) card.append(el('p', '', item.summary));
      const scope = el('dl', 'identity-fields');
      scope.append(field('范围', item.scope), field('证据 ID', item.id));
      card.append(scope);
      root.append(card);
    });
    const checks = verification.checks;
    if (checks != null) root.append(details(`全部回锚检查${Array.isArray(checks) ? ` · ${checks.length}` : ''}`, checks));
    if (verification.counts != null) root.append(details('校验计数（原值）', verification.counts));
    if (verification.diagnostics != null) root.append(details('校验诊断（原值）', verification.diagnostics));
    const limitations = el('section', 'limitations');
    limitations.append(el('h3', '', '展示边界与缺口'));
    const items = el('ul', 'limitations-list');
    list(view.limitations).forEach(item => items.append(el('li', '', item)));
    if (!list(view.limitations).length) items.append(el('li', '', '模型未提供额外限制说明；不代表没有未覆盖能力。'));
    items.append(el('li', '', `模型声明省略 ${number(view.totals?.omittedNodes)} 个节点；未导出的知识不能通过此页面搜索或反查。`));
    items.append(el('li', '', '来源地址与代码均为只读文本；不会跟踪、自动打开外链、获取本地文件或联网补齐。'));
    limitations.append(items);
    root.append(limitations);
    const snapshot = el('section', 'snapshot-details');
    snapshot.append(el('h3', '', '同一次导出的身份'), identityFields());
    const freshnessFields = el('dl', 'identity-fields');
    freshnessFields.append(field('最新性（原值）', view.freshness));
    snapshot.append(freshnessFields);
    root.append(snapshot);
  }
  function openEvidence(event) {
    dialogOpener = event?.currentTarget || document.activeElement;
    renderEvidence();
    const dialog = $('evidence-dialog');
    if (!dialog.open) dialog.showModal();
    $('close-evidence').focus();
  }
  function closeEvidence() { $('evidence-dialog').close(); }
  for (const id of ['open-evidence', 'sidebar-evidence', 'footer-evidence']) $(id).addEventListener('click', openEvidence);
  $('close-evidence').addEventListener('click', closeEvidence);
  $('evidence-dialog').addEventListener('close', () => { dialogOpener?.focus(); });
  $('evidence-dialog').addEventListener('click', event => {
    if (event.target !== $('evidence-dialog')) return;
    const rect = $('evidence-dialog').getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeEvidence();
  });
  $('all-nodes').addEventListener('click', () => changeChapter(null));
  $('previous-chapter').addEventListener('click', () => {
    const index = chapters.indexOf(currentChapter());
    if (index > 0) changeChapter(chapters[index - 1].id);
  });
  $('next-chapter').addEventListener('click', () => {
    const index = chapters.indexOf(currentChapter());
    if (index >= 0 && index + 1 < chapters.length) changeChapter(chapters[index + 1].id);
  });
  $('show-more').addEventListener('click', () => { limit += PAGE_SIZE; renderScope(); });
  $('node-search').addEventListener('input', event => {
    search = event.target.value.trim();
    limit = PAGE_SIZE;
    renderScope();
    if (!selectedId && visibleNodes.length) selectNode(visibleNodes[0].id, 'source', false);
  });
  $('clear-search').addEventListener('click', () => {
    search = '';
    $('node-search').value = '';
    limit = PAGE_SIZE;
    renderScope();
    if (!selectedId && visibleNodes.length) selectNode(visibleNodes[0].id, 'source', false);
    $('node-search').focus();
  });
  document.addEventListener('keydown', event => {
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName) || event.target?.isContentEditable;
    if (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey && !$('evidence-dialog').open) {
      event.preventDefault();
      $('node-search').focus();
    }
    if (event.key === 'Escape' && event.target === $('node-search') && search) {
      event.preventDefault();
      $('clear-search').click();
    }
  });
  window.addEventListener('resize', scheduleEdges);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(scheduleEdges).observe($('graph-area'));
  renderScope();
  if (visibleNodes.length) selectNode(visibleNodes[0].id, 'source', false);
  else clearInspector();
})();
