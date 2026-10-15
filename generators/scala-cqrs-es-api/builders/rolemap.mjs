// rolemap.mjs — the api-face semantic discoveries, ported verbatim from the production
// gen_api_layer family: rolemap_export.mjs (PB1 command-role derivation), readmodels_view_gate.mjs
// (S2-56 ③-layer field-note gate), and the view-key face of gen_api_controllers/builder.mjs
// (buildViewModels' viewName/key pair) + core.mjs (kebab family).
//
// The fixture carries the RAW inputs (tools/augment-api-canonical.mjs): roleLinkNotes (compact
// co-link participants), readModels (the ③-layer face), viewFieldNotes (the gate's annotated-view
// registry), viewKeyRenames. Everything below is derivation the generator owns.

// ── 词表 14 值两层（rolemap-whitelist.v1 基准；越界 fail-fast）──
// 2026-09-05 S2-46：+KnowledgeCurator（知识管理员·MergeKnowledgePatch/DeclineKnowledgeMerge）
export const ROLE_CONSTANTS = {
  User: 'User', SystemOperator: 'SystemOperator',
  TenantOwner: 'TenantOwner', TenantMember: 'TenantMember', System: 'System', 'AI Agent': 'AiAgent',
  WorkgroupOwner: 'WorkgroupOwner', WorkgroupMember: 'WorkgroupMember',
  ProjectOwner: 'ProjectOwner', ProjectMember: 'ProjectMember',
  Facilitator: 'Facilitator', DomainExpert: 'DomainExpert', MetadataEngineer: 'MetadataEngineer',
  KnowledgeCurator: 'KnowledgeCurator',
};
export const ALL_ROLES = Object.keys(ROLE_CONSTANTS);

// kebab family (gen_api_controllers/core.mjs)
/** S2-17 B3：视图名→kebab（两段式对齐 E301-R 权威表含 DoR 类缩写词） */
export const kebabViewStrict = (n) => String(n).replace(/DecisionView$/, '')
  .replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2').toLowerCase();

/** kebab viewKey → ViewKeys 常量名 */
export const constNameOf = (kebab) => kebab.split('-').filter(Boolean).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');

/** 视图新 key 解析：rename map 命中 → 新名；未命中 → 原名（幂等） */
export const newViewKeyOf = (oldKebab, renameMap) => renameMap.get(oldKebab) ?? oldKebab;

/** 推导逐命令 roles（共链三形态统一）；词表越界抛错（发射期 fail-fast）。
  * S2-88 读/写分离：readModel 型便签排除——其 links 是③层视图规格（decisionCommands 镜像），
  * role: 链只声明视图读权（deriveViewReadRoles）；若参与共链会把读权漏进写侧全部关联命令。
  * Fixture 契约：notes = canonical.roleLinkNotes（augment-api-canonical 的机械参与者过滤，
  * 形状 {type, name, links}——真源 collectNotes 的展平等价物）。 */
export function deriveCommandRoles(notes) {
  const map = new Map();
  const add = (cmd, role) => {
    if (!ALL_ROLES.includes(role)) {
      throw new Error(`rolemap: 词表越界 role="${role}"（command=${cmd}）——白名单 13 值之外，查真源 notes 共链`);
    }
    if (!map.has(cmd)) map.set(cmd, new Set());
    map.get(cmd).add(role);
  };
  for (const note of notes ?? []) {
    if (note.type === 'readModel') continue; // S2-88：读侧声明面不进写侧共链
    const links = Array.isArray(note.links) ? note.links : [];
    const roleRefs = links.filter((l) => typeof l === 'string' && l.startsWith('role:')).map((l) => l.slice(5));
    const cmdRefs = links.filter((l) => typeof l === 'string' && l.startsWith('command:')).map((l) => l.slice(8));
    if (note.type === 'role' && note.name) roleRefs.push(note.name);
    if (note.type === 'command' && note.name) cmdRefs.push(note.name);
    for (const c of new Set(cmdRefs)) for (const r of new Set(roleRefs)) add(c, r);
  }
  return new Map([...map.entries()].map(([c, rs]) => [c, [...rs].sort()]));
}

/** 视图读权显式声明（S2-88）：readModel 便签名 → ∪ role: targets（词表 fail-fast 同律） */
export function deriveViewReadRoles(notes) {
  const m = new Map();
  for (const note of notes ?? []) {
    if (note.type !== 'readModel' || !note.name) continue;
    for (const r of new Set((Array.isArray(note.links) ? note.links : [])
      .filter((l) => typeof l === 'string' && l.startsWith('role:')).map((l) => l.slice(5)))) {
      if (!ALL_ROLES.includes(r)) {
        throw new Error(`rolemap: 词表越界 role="${r}"（readModel=${note.name}）——视图读权声明查白名单`);
      }
      if (!m.has(note.name)) m.set(note.name, new Set());
      m.get(note.name).add(r);
    }
  }
  return new Map([...m.entries()].map(([v, rs]) => [v, [...rs].sort()]));
}

/** decisionSupport 聚合：m[V] = ∪ roles(c∈commandsOf(V)) ∪ readRoles(V)（S2-88：显式读权并集·只增不减） */
export function aggregateByView(commandRoles, readmodels, viewReadRoles = new Map()) {
  const m = new Map();
  for (const v of readmodels.readModels ?? []) {
    if (!String(v.name).endsWith('DecisionView')) continue;
    const union = new Set(viewReadRoles.get(v.name) ?? []);
    for (const c of v.decisionSupport ?? []) for (const r of commandRoles.get(c) ?? []) union.add(r);
    if (union.size || (v.decisionSupport ?? []).length) m.set(v.name, [...union].sort());
  }
  return m;
}

/** ③层门（S2-56）：只留带③层字段便签（viewFieldNotes 的 info.parent）注记的视图，并用便签
  * dataType 富化字段（UUID 口径回补·运行时富化不回写 fixture）。未注记视图剔除（降级不
  * FATAL——草案视图是合法中间产物）；注记集与视图集零交集 → FATAL（门失灵即拒绝放行，
  * 防「门名存实亡」静默全量放行）。原 readmodels_view_gate.gateViews 逐字移植，注记源改
  * canonical.viewFieldNotes（augment-api-canonical 的机械过滤等价物）。 */
export function gateViews(models, viewFieldNotes, { tool = 'emitter', failFast = false, log = console } = {}) {
  const notesByView = new Map();
  for (const n of viewFieldNotes ?? []) {
    if (!notesByView.has(n.info.parent)) notesByView.set(n.info.parent, new Map());
    notesByView.get(n.info.parent).set(n.name, n.info);
  }
  const kept = [];
  const dropped = [];
  for (const m of models ?? []) {
    const notes = notesByView.get(String(m.name));
    if (!notes) { dropped.push(String(m.name)); continue; }
    // dataType 富化（浅拷贝字段·不污染原对象）：便签 dataType 更精确时采用
    const enriched = (m.fields ?? []).map((f) => {
      const note = notes.get(f.name);
      return note && note.dataType && note.dataType !== f.dataType
        ? { ...f, dataType: note.dataType, __dataTypeEnriched: true }
        : f;
    });
    kept.push(enriched === m.fields ? m : { ...m, fields: enriched });
  }
  if (kept.length === 0) {
    throw new Error(`[RM-VIEW-GATE] FATAL（${tool}）：readmodels 视图与③层字段便签注记集零交集——视图命名体系疑似漂移（门失灵即拒绝放行，防静默全量）`);
  }
  if (dropped.length) {
    const msg = `[RM-VIEW-GATE] ${tool}：剔除 ${dropped.length} 个无③层字段便签的草案视图（S2-56 门）：${dropped.join(', ')}`;
    if (failFast) throw new Error(msg);
    if (log.warn) log.warn(msg); else log.log(msg);
  }
  return kept;
}

/** 视图 key 面（gen_api_controllers/builder.buildViewModels 的 inc11 切面）：{viewName, key}
  * 按 key localeCompare 排序（ViewKeys val 行序＝字节恒等口径）。controllers/ViewWrites 面
  * （repoParam/fields/noteId/engine）归 inc12，随消费面落位。 */
export function viewKeyModel(readModels, renameMap) {
  const keyOf = (viewName) => newViewKeyOf(kebabViewStrict(viewName), renameMap);
  const views = [...(readModels ?? [])]
    .filter((m) => String(m.name).endsWith('DecisionView'))
    .sort((a, b) => keyOf(a.name).localeCompare(keyOf(b.name)))
    .map((v) => ({ viewName: v.name, key: keyOf(v.name) }));
  return { views, keyOf };
}
