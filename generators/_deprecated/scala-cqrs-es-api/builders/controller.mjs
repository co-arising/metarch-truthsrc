// controller.mjs — 【Builder】decision layer, ported verbatim from the production
// gen_api_controllers/builder.mjs: protocol parsing (Protocol.scala text → command IR), the
// Lane-A addressing table, VO-List skip, tier/strict-field/guard/ctor decisions, the VO
// dependency topo sort and the aggregate assembly. Pure functions — zero Scala text assembly,
// zero fs (ctx carries the derivation callbacks the orchestrator injects).
//
// Fixture contract (Fork A): the command IR comes from parsing THIS generator suite's own
// skeleton output — generate.mjs renders <Agg>Protocol.scala via the scala-cqrs-es generator
// (byte-identical to live CodegenMain per its own golden gate) and feeds the text here, which
// mirrors the live two-pass pipeline (gen_api_layer parses the Protocol file the skeleton pass
// wrote). ctx.paramOrigin / ctx.dvJsExpr / ctx.commandNoteIdOf / ctx.voFieldsOf come from the
// canonical's api-face slots (tools/augment-api-canonical.mjs).
import { tierOf, idRefsOf, cidNameOf, kebab, bindNameOf, id, reqTypeOf } from './core.mjs';
import { newViewKeyOf, kebabViewStrict } from './rolemap.mjs';

// ── Protocol 解析（Protocol.scala → 命令 IR）──
// 反引号剥离（2026-08-25 BUG-005 真源修正）：解析层还原裸名，反引号由调用方 id()/SCALA_KEYWORDS 加回。
// Reply 分型（2026-08-26 D5-A）：写命令 Reply 带 error: Option[iMadzError]；查询命令无 error 位 → 跳过生成（S2-17 邻接）。
export function parseProtocol(src, agg) {
  const commands = [];
  for (const m of src.matchAll(/case class\s+(\w+)\(([^)]*)\)\s*extends\s+\w*CommandFamily/g)) {
    const name = m[1];
    const params = m[2].split(',').map((p) => p.trim()).filter(Boolean).map((p) => {
      // Controller 三可选参根治批 2026-10-05：剥 ` = None` 默认值尾巴＋标 optional（Protocol 直译 Option[T] 签名）
      const [n, t] = p.split(':').map((x) => x.trim());
      const type = (t || '').replace(/\s*=\s*.*$/, '');
      return { name: n.replace(/`/g, ''), type, optional: /^Option\[/.test(type) };
    }).filter((p) => p.name !== 'replyTo');
    const reply = `${name}Reply`;
    commands.push({ name, params, reply });
  }
  const replyIsError = new Map();
  for (const m of src.matchAll(/case class\s+(\w+Reply)\(([^)]*)\)/g)) {
    replyIsError.set(m[1], /error\s*:\s*Option\[/i.test(m[2]));
  }
  for (const c of commands) c.isErrorReply = replyIsError.get(c.reply) ?? true;
  const entityTypeKey = new RegExp(`val\\s+entityTypeKey[^=]*=\\s*EntityTypeKey\\("([^"]+)"\\)`).exec(src)?.[1] || agg;
  return { commands, entityTypeKey };
}

/** 载荷严格必填字段集（决策）：除 triggeredBy 字面量外的全部参数，按门档位收窄——
 *  tenant 档 tenantId 一律会话注入（D5-A，不从 body 收取）；global 档聚合同名 Id＝工厂发号不入 body（onboard 的 tenantId）；
 *  非 聚合同名 Id（accept 的 tenantId body 契约）保持；anonymous 档身份自证走 body（全量收取）。 */
function strictFieldsOf(cmd, tier, agg, idp) {
  const aggNamed = (p) => p.name.toLowerCase() === `${agg.toLowerCase()}id`;
  return cmd.params.filter((p) => p.name !== 'triggeredBy'
    && !(p.name === 'tenantId' && tier === 'tenant')
    && !(tier === 'global' && aggNamed(p) && /^Id/.test(p.type))
    && !(p === idp && !idp.fromBody));
}

// ── Lane A R1/R2/R3 寻址判定表（EP_CommandWriteIntents_MetadataContract §十三·2026-08-30 本批落地）──
// 背景（GEN-ID bug 治本）：SYS_GEN 键聚合的 follow-up 命令曾全部投递 randomUUID 一次性实体 → AGG_NOT_INITIALIZED。
// 判定按真源 fieldOrigin（非「Req 是否带键」——patchId 虽在协议参数中但 SYSTEM_GENERATED，字面判会判错）：
//   r2      —— PROPAGATED 业务键：entityRef(req.<key>)（Guard 解析），回执=业务键（R2 明文）
//   r3      —— 特例拍板：协议多键命令按指定键寻址（merge-concepts→targetConceptId）
//   httpKey —— D1 边界变体（2026-08-30 用户拍板）：协议命令无该参数，寻址键仅入 HTTP Req（合成字段），
//              事件键经 entityRef 种子传导（ModelCatalogEntity.empty(catalogId) 种子 → AssembleMetadataRule 事件取 state.catalogId）
//   r1      —— SYSTEM_GENERATED 键在协议参数中：不入 Req/Guard，ctor 填 Id.of(generatedId)，回执=发号键（SubmitKnowledgePatch）
// 本批范围收窄（Lane A 13.3 反查冻结）：未列入表的命令维持现行寻址（其余 R2 族＋幂等回归留 Lane A 全量批）；
// Concept 等字面聚合同名键的 path 寻址（idp）形态保持不变。
const LANE_A_ADDRESSING = {
  ModelCatalog: {
    ReleaseCatalogVersion: { r2: 'catalogId' },
    DetectCatalogConflicts: { r2: 'catalogId' },
    ExportMetadata: { r2: 'catalogId' },
    ReleaseMetadataVersion: { r2: 'catalogId' },
    ResolveCatalogConflict: { r2: 'catalogId' },
    ApplyKnowledgePatch: { r2: 'catalogId' },
    AssembleMetadata: { httpKey: 'catalogId' },   // D1：面向既有目录（body 带 catalogId）
  },
  Relation: {
    RelateConcept: { r2: 'edgeId' },
    UnrelateConcept: { r2: 'edgeId' },
    UpdateRelation: { r2: 'edgeId' },
  },
  ContextRelation: {
    DefineContextRelation: { r2: 'relationId' },
    UpdateContextRelation: { r2: 'relationId' },
  },
  KnowledgePatch: {
    MergeKnowledgePatch: { r2: 'patchId' },
    // B3（EP_S2_59_S2_60·拍板#3/D2 兑现·2026-09-06）：r1→r2——patchId 改由 Workshop 铸造（ScheduleWorkshop
    // origin 车道 r1 发号存 Workshop state）·客户端自 workshops 视图读后随首提携带（body 业务键寻址）＝KP 懒建。
    // template origin 已改 PROPAGATED（Workshop→KP 共享业务键·relations ruling 在案）。
    SubmitKnowledgePatch: { r2: 'patchId' },   // patchId 客户端携带（Workshop 铸造·KP 懒建·拍板#3/D2）
    // 批1-B item 8（2026-09-06·Act 13 13.2/13.8 live 400 AGG_NOT_INITIALIZED）：SubmitKnowledgePatch
    // 发号即聚合键（entityRef=发号键=patchId），follow-up 命令必须按 patchId 业务键寻址——原 randomUUID
    // 选址=投递空聚合恒拒（confirm/decline/reject/request-merge 四命令同族）。
    ConfirmKnowledgeReady: { r2: 'patchId' },
    DeclineKnowledgeMerge: { r2: 'patchId' },
    RejectKnowledgePatch: { r2: 'patchId' },
    RequestKnowledgeMerge: { r2: 'patchId' },
    // 漏网补录（2026-09-25·新门 aggregate_addressing_recon 抓出）：本命令此前未登记
    // ⇒ entityRef(generatedId) 而 Req/Guard 握有 patchId。与上面四条同族同修法。
    ConfirmPatchMerged: { r2: 'patchId' },
  },
  Concept: {
    MergeConcepts: { r3: 'targetConceptId' },     // R3 特例拍板：合并落 target 聚合（MergeConceptsRule 无状态守卫）
  },
  Note: {
    // 2026-09-26（外部系统捕获写侧幂等·用户批准计划）：CaptureNote 曾 entityRef(randomUUID) 工厂语义
    // → 每次同步 = 新实体（重同步同卡 = 重复建便签）。r2c＝(tenantId, sourceSystem, externalId) →
    //   nameUUIDFromBytes 派生确定性 UUID——同键恒同实体（同 Akka shard 单写者串行化），重复同步天然
    //   upsert，无读侧索引/无投影延迟竞态。sourceSystem/externalId 为**裸串**（Miro 雪花号非 UUID 形）
    //   ⇒ 仅作派生字节输入·不进 IdGuard（IdGuard 要 UUID 形）；tenantId 会话注入（ts.tenantId）。
    CaptureNote: { r2c: ['tenantId', 'sourceSystem', 'externalId'] },
  },
  OrganizationMember: {
    // 批1-C item 17（2026-09-06·BUG-007/MF1）：邀请族五命令曾全部 entityRef(randomUUID) 一次性实体
    // → accept-tenant-invitation AGG_NOT_INITIALIZED → 用户从未真实入租户 → 概念命令 TENANT_REQUIRED 级联拦截。
    // r2c＝复合业务键变体：(tenantId,userId) → nameUUIDFromBytes 派生确定性 UUID——
    //   ① 确定性：五命令同键同实体（invite 建立后 accept/revoke/resend/remove 可寻址）；
    //   ② 多组织成员关系：真源明文「一人多组织不同职务」，单 userId 寻址会跨租户串档；
    //   ③ UUID 形：Bootstrap emptyState=Id.of(entityId) 硬约束（裸复合串会 UUID 解析崩溃）。
    // tenant 档 tenantId 会话注入（ts.tenantId·D5-A），global 档（accept）tenantId 走 body Guard。
    AcceptTenantInvitation: { r2c: ['tenantId', 'userId'] },
    InviteTenantMember: { r2c: ['tenantId', 'userId'] },
    RemoveTenantMember: { r2c: ['tenantId', 'userId'] },
    ResendInvitation: { r2c: ['tenantId', 'userId'] },
    RevokeInvitation: { r2c: ['tenantId', 'userId'] },
  },
  // ── 批·聚合寻址补录（2026-09-25·用户令「修吧」）───────────────────────────────
  // 病：这些聚合的**「可建可改」命令**（其 checkAggregate 的 InitialCommands 含它们——设计上
  //   既建又改）未登记本表 ⇒ 落默认 `generatedId`（随机 v4）⇒ 每次都投递到全新空实体 ⇒
  //   事件落孤儿聚合、聚合状态永远只有 1 个事件。因 InitialCommands 放行，**全程不报错**。
  FieldModelDefinition: {
    DeclareFieldModel:     { r2: 'definitionId' },
    DeclareStateField:     { r2: 'definitionId' },
    AddWrittenBy:          { r2: 'definitionId' },
    ReplaceWrittenBy:      { r2: 'definitionId' },
    CutWrittenBy:          { r2: 'definitionId' },
    DeclareCommand:        { r2: 'definitionId' },
    AddCommandParameter:   { r2: 'definitionId' },
    DeclareEvent:          { r2: 'definitionId' },
    AddEventPayload:       { r2: 'definitionId' },
    PatchAggregateStatus:  { r2: 'definitionId' },
    DeclareRelation:       { r2: 'definitionId' },
    DeclareStateGate:      { r2: 'definitionId' },
    RenameDescription:     { r2: 'definitionId' },
    RemoveStateField:      { r2: 'definitionId' },
    RemoveCommand:         { r2: 'definitionId' },
    RemoveEvent:           { r2: 'definitionId' },
    RemoveRelation:        { r2: 'definitionId' },
    RemoveStateGate:       { r2: 'definitionId' },
    RemoveFieldModel:      { r2: 'definitionId' },
  },
  ReadModelDefinition: {
    DeclareReadModel:    { r2: 'definitionId' },
    PatchReadModelField: { r2: 'definitionId' },
    RemoveReadModel:     { r2: 'definitionId' },
  },
  CemEdge: {
    DeclareEdge: { r2: 'edgeId' },
    PatchEdge:   { r2: 'edgeId' },
    RetireEdge:  { r2: 'edgeId' },
  },
  ValueObjectDefinition: {
    DeclareValueObject:  { r2: 'definitionId' },
    RemoveValueObject:   { r2: 'definitionId' },
  },
  // 立项B（2026-09-29）：UseCase 族业务键寻址（VOD 同款）——缺表项＝工厂 randomUUID 发号，
  // 载荷 definitionId（uuidOf('ucd',name) 确定性键）与实体 id 双空间分裂（P13 实证·GetState 查不到）。
  UseCaseDefinition: {
    DeclareUseCaseDefinition: { r2: 'definitionId' },
    RemoveUseCaseDefinition:  { r2: 'definitionId' },
  },
  TruthSourceProvenance: {
    RecordTruthProvenance: { r2: 'provenanceId' },
  },
  RoleCommandBinding: {
    BindCommand:   { r2: 'bindingId' },
    UnbindCommand: { r2: 'bindingId' },
  },
  FsmDefinition: {
    ProposeFsmDefinition:   { r2: 'fsmId' },
    EstablishFsmDefinition: { r2: 'fsmId' },
    UpdateFsmElements:      { r2: 'fsmId' },
  },
  WorkTicket: {
    ConcludeWorkTicket:    { r2: 'ticketId' },
    UpdateWorkTicketItems: { r2: 'ticketId' },
  },
};
/** D3（2026-08-30 用户拍板）：VO-List 嵌套 VO 端点放行白名单。D11（2026-09-05 用户拍板·S2-48 批6 ③B）：
 *  6 个 VO-List 命令全量放行——请求体 JSON body tier（Endpoint.write[T]＋Req 嵌套 VO Reads）。 */
const VO_LIST_ENDPOINTS = new Set([
  'SubmitKnowledgePatch',
  'EvaluateDoR', 'SubmitDoRFindings',
  'ProposeFsmDefinition', 'UpdateFsmElements',
  'CreateWorkTicket', 'UpdateWorkTicketItems',
  'DeclareReadModel', 'PatchAggregateStatus',
  'DeclareValueObject',
  'DeclareFieldModel',
]);

/** B2（2026-09-10）：命令参数裸类型词表（非 VO 判定基线）——协议签名实测全集＝
 *  String/Id/Boolean/Int/Instant（Long/Double/BigDecimal/UUID 防御性纳入）。
 *  裸大写类型不在此表＝domain.values 的 VO（FieldParamSpec 等 6 直参实证）。 */
const BARE_SCALAR_TYPES = new Set(['String', 'Id', 'Boolean', 'Int', 'Long', 'Double', 'BigDecimal', 'Instant', 'UUID']);

/** Flow 委托表（批1-B item 7·2026-09-06）：服务端装配命令——controller 只剩委托，编排/DB 取数下沉手写应用服务。 */
const FLOW_DELEGATES = {
  DoR: { RequestDoR: { flowService: 'requestDoRFlow', flowMethod: 'request', bodyFields: ['workshopId'] } },
};

/**
 * 构建单命令端点 Model（决策单点）——B5-L 全 DSL：返回 { skip: null|原因, kind:'dsl', ... }。
 * 门档位发射语义：tenant=api.tenant.write＋CommandRoleMap；global=api.global.write 空 roles（D1 scope 兜底）；
 * anonymous=api.anonymous.write（register 走 Flow 委托·D3）；establish=409 查重前置＋typed payload（样例 E）。
 */
export function buildCommandModel(ctx, agg, cmd) {
  const laneA = (LANE_A_ADDRESSING[agg] || {})[cmd.name] || null;
  // VO-List skip 判定：嵌套 VO 才 skip（List[DoRVerdict] 形态）。标量名单不 skip——
  // List[String] 与 List[Id]（uuid-unify 后的 UUID 名单·S2-48 批3）都是扁平 JSON 数组，非 VO 嵌套。
  const voList = cmd.params.find((p) => /^List\[/.test(p.type) && !/^List\[(String|Id)( \(UUID\))?\]/.test(p.type));
  if (voList && !VO_LIST_ENDPOINTS.has(cmd.name)) return { skip: `${cmd.name}(${voList.name}: ${voList.type})` };
  const tier = tierOf(agg, cmd.name);
  const aggNamed = (p) => p.name.toLowerCase() === `${agg.toLowerCase()}id`;
  // 寻址（B2·T02 保守化）：仅 tenant 档聚合同名 Id 参数作路径寻址；global/anonymous 档工厂发号——
  // 聚合同名 Id 不入 body 不路径化（onboard 的 tenantId 服务端发号），非聚合同名 Id（accept 的 tenantId）保持 body 契约。
  const idp = tier === 'tenant'
    ? cmd.params.find((p) => p.name.toLowerCase() === `${agg.toLowerCase()}id` && /^Id/.test(p.type))
    : undefined;
  // Lane A 寻址键解析（r2/r3 同形＝协议既有 Id 参数；httpKey＝合成 Req 字段；r1＝协议键参数工厂发号；
  // r2c＝复合业务键——多键确定性派生 UUID，键式按档位：tenant 档 tenantId 会话注入、其余 Guard cid）
  const r2Key = laneA && (laneA.r2 || laneA.r3) ? cmd.params.find((p) => p.name === (laneA.r2 || laneA.r3)) : null;
  const httpKey = laneA && laneA.httpKey ? { name: laneA.httpKey, type: 'Id', synthetic: true } : null;
  // B2 origin 车道（EP_S2_59_S2_60）：无 LANE_A 表项时，template origin=SYSTEM_GENERATED 的 Id 型参数自动走 r1 铸造
  // （不入 Req·ctor Id.of(generatedId)·回执发号键）——LANE_A 表项优先（override 兼容层·表在语义=寻址已裁决）。
  const originOf = (p) => ctx.paramOrigin?.(agg, cmd.name, p.name) || '';
  let r1Key = laneA && laneA.r1 ? cmd.params.find((p) => p.name === laneA.r1) : null;
  if (!laneA && !r1Key) {
    r1Key = cmd.params.find((p) => originOf(p) === 'SYSTEM_GENERATED' && /^Id/.test(p.type)) || null;
  }
  const r2cKeys = laneA && laneA.r2c
    ? laneA.r2c.map((n) => cmd.params.find((p) => p.name === n)).filter(Boolean)
    : null;
  if (r2cKeys && r2cKeys.length !== (laneA.r2c || []).length)
    throw new Error(`LANE_A r2c 键缺失：${agg}.${cmd.name} 需 ${laneA.r2c.join('+')}（协议参数实际命中 ${r2cKeys.map((p) => p.name).join('+') || '无'}）`);
  // multiTarget＝「无任何寻址键（工厂 randomUUID）＋带 List」才标注 TODO——r2/r2c/httpKey 寻址键在即非工厂语义
  const multiTarget = !idp && !r1Key && !r2Key && !r2cKeys && !httpKey && cmd.params.some((p) => /^List\[/.test(p.type));
  const isEstablish = cmd.name === 'EstablishConcept';
  const isRegister = cmd.name === 'RegisterUser';
  if (cmd.isErrorReply === false) return { skip: `${cmd.name}（查询型 Reply——读侧契约待 S2-17 族，暂缓）` };
  let strictFields = strictFieldsOf(cmd, tier, agg, idp);
  if (r1Key) strictFields = strictFields.filter((p) => p !== r1Key);   // Lane A R1：SYS_GEN 键不入 Req（服务端发号）
  // origin 车道（续）：SYSTEM_GENERATED 非 Id 型参数同样不入 Req（数据形·服务端装配）——现无非 Flow 实例，
  // ctor 实参若命中即 fail-fast（哑生成比报错更危险）
  if (!laneA) strictFields = strictFields.filter((p) => originOf(p) !== 'SYSTEM_GENERATED' || p === r1Key);
  // S2-89 WP-A（2026-09-14·洞③）：SYSTEM_QUERIED 参数＝读模型查询注入（命令条件依赖读模型——
  //   客户端不可伪造冲突清单）——不入 Req；ctor 实参由手写 <Agg>ParamEnricher.enrich<Cmd>(ctx, req)
  //   服务端装配（ask 管线外层 flatMap { q => … }·q.<name> 逐参数引用）。
  const queriedParams = cmd.params.filter((p) => originOf(p) === 'SYSTEM_QUERIED');
  if (queriedParams.length) strictFields = strictFields.filter((p) => originOf(p) !== 'SYSTEM_QUERIED');
  const cidOf = (p) => ((p === idp && !idp.fromBody) ? 'id' : `req.${id(p.name)}`);
  const lowerCmd = `${cmd.name.charAt(0).toLowerCase()}${cmd.name.slice(1)}`;
  const sig = idp ? `(${idp.fromBody ? 'entityId' : 'id'}: String)` : '';
  const routeLine = `POST     ${idp ? `/api/${kebab(agg)}/:${idp.fromBody ? 'entityId' : idp.name}/${kebab(cmd.name)}` : `/api/${kebab(agg)}/${kebab(cmd.name)}`}  controllers.${agg}ApiController.${lowerCmd}${idp ? `(${idp.fromBody ? 'entityId' : idp.name}: String)` : ''}`;

  // ── serverScoped Flow 委托（批1-B item 7）：path 寻址保留（idp），body 全空或 bodyFields 声明字段——
  //    scope/快照由 Flow 服务端装配。B3（EP_S2_59_S2_60·拍板#1）：bodyFields 变体＝客户端唯一入口。
  const flowDef = (FLOW_DELEGATES[agg] || {})[cmd.name];
  if (flowDef) {
    const bodyParams = (flowDef.bodyFields || [])
      .map((n) => cmd.params.find((p) => p.name === n))
      .filter(Boolean);
    if (bodyParams.length !== (flowDef.bodyFields || []).length)
      throw new Error(`FLOW_DELEGATES bodyFields 缺失：${agg}.${cmd.name} 需 ${(flowDef.bodyFields || []).join('+')}（协议参数实际命中 ${bodyParams.map((p) => p.name).join('+') || '无'}）`);
    return {
      skip: null, kind: 'dsl', actionName: lowerCmd, sig, routeLine, tier, multiTarget,
      flowDelegate: true, flowService: flowDef.flowService, flowMethod: flowDef.flowMethod,
      flowScoped: true, // serverScoped 变体：Flow 收 (id, [body 字段…], ts)——tenant 会话
      flowArgs: bodyParams.length ? `id, ${bodyParams.map((p) => `req.${id(p.name)}`).join(', ')}, ts` : null,
      reqName: bodyParams.length ? `${cmd.name}Req` : 'play.api.libs.json.JsObject',
      // Controller 三可选参根治批 2026-10-05：optional 参 Req 面 Option[T]=None（Json.reads 缺键→None 原生支持）
      reqFields: bodyParams.length ? bodyParams.map((p) => `${id(p.name)}: ${p.optional ? `Option[${reqTypeOf(p)}] = None` : reqTypeOf(p)}`).join(', ') : null,
      hasEmptyBody: bodyParams.length === 0,
      cmdName: cmd.name, reply: cmd.reply, dvExpr: ctx.dvJsExpr(cmd.name),
      cmdNoteId: ctx.commandNoteIdOf(cmd.name), // S7 #1b：控制器端点逐命令锚的号源
      generatedId: false, multiTarget: false,
    };
  }

  // ── anonymous 档 register：五步编排下沉手写 RegisterUserFlow（D3·应用服务 MANUAL 实写面）——controller 只剩委托（样例 C）──
  if (isRegister) {
    // R-REG（2026-08-29 用户拍板）：wire 契约 userId→username——userId 恒后端发号（聚合键＝登录身份 _id＝发号 UUID），
    // body 只申报 username（注册者自选登录名）；查重 409 USERNAME_TAKEN＋发号＋协议 userId 填充全在 Flow 内部。
    const regFields = strictFields.map((p) => (p.name === 'userId' ? { name: 'username', type: 'String' } : p));
    return {
      skip: null, kind: 'dsl', actionName: lowerCmd, sig, routeLine, tier, multiTarget,
      flowDelegate: true, flowService: 'registerUserFlow', flowMethod: 'register',
      flowArgs: regFields.map((p) => `body.${id(p.name)}`).join(', '),
      reqName: `${cmd.name}Req`, reqFields: regFields.map((p) => `${id(p.name)}: ${reqTypeOf(p)}`).join(', '),
      hasEmptyBody: false, cmdName: cmd.name, reply: cmd.reply,
      cmdNoteId: ctx.commandNoteIdOf(cmd.name), // S7 #1b
      dvExpr: ctx.dvJsExpr(cmd.name), generatedId: true, multiTarget,
    };
  }

  // ── 全档共用 DSL 决策 ──
  const instantFields = strictFields.filter((p) => /Instant/.test(p.type));
  // Lane A D1 变体：httpKey 合成字段只入 Req/Guard（协议命令无此参数，ctor 不发）——事件键经 entityRef 种子传导
  const reqFieldsSrc = httpKey ? [...strictFields, httpKey] : strictFields;
  const reqName = reqFieldsSrc.length ? `${cmd.name}Req` : 'play.api.libs.json.JsObject';
  // Controller 三可选参根治批 2026-10-05：optional 参（Protocol 直译）通用规则取代 establish 硬编码特例——
  //   Req 面 Option[T] = None（缺键→None），ctor 实参 req.<name> 直传 Option→Option（无 getOrElse）。
  //   D3b（T 权威·EP_Mech_Key_Retirement）：内型经 reqTypeOf 边界映射——Option[Id]→Req 面
  //   Option[String] = None（ctor 逐元素 Id.of 装配·=List[Id] 纪律 0/1 元素特例）。
  const reqFieldType = (p) => p.optional ? `${reqTypeOf(p)} = None`
    : (isEstablish && (p.name === 'kind' || p.name === 'description')) ? 'Option[String]' : reqTypeOf(p);
  const reqFields = reqFieldsSrc.length ? reqFieldsSrc.map((p) => `${id(p.name)}: ${reqFieldType(p)}`).join(', ') : null;
  // ctor 实参决策（M4）：Ctx 身份注入；Id/Instant 参数用 Guard 预校验绑定
  const ctorArgsDsl = cmd.params.map((p) => {
    if (p === idp && !idp.fromBody) return cidNameOf(p);
    if (p.name === 'triggeredBy') return tier === 'tenant' ? 'ts.userId' : 'gc.userId';
    // Id 战役（c898bd0）：协议 tenantId 为 Id 型（=UUID），Ctx 携带 String——边界 Id.of 转换。
    //   立项B 判例（2026-09-29）：tenantId 实型以协议签名为权威——String 型协议裸串直传，勿硬转 Id。
    if (p.name === 'tenantId' && tier === 'tenant' && /^Id/.test(p.type)) return 'net.imadz.common.Id.of(ts.tenantId)';
    if (p.name === 'tenantId' && tier === 'tenant') return 'ts.tenantId';
    // global 档聚合同名 tenantId＝工厂发号（仅 onboard 命中；accept 的 tenantId 走 /^Id$/ 分支入 Guard）
    if (p.name === 'tenantId' && tier === 'global' && aggNamed(p)) return 'net.imadz.common.Id.of(generatedId)';
    // Lane A R1：SYS_GEN 键 ctor 填发号键（patchId 等聚合自体键服务端发号）
    if (p === r1Key) return 'net.imadz.common.Id.of(generatedId)';
    if (isEstablish && (p.name === 'kind' || p.name === 'description')) {
      return `req.${id(p.name)}.getOrElse(${p.name === 'kind' ? '"AGGREGATE"' : '""'})`;
    }
    // Controller 三可选参根治批 2026-10-05：optional 参直传 Option→Option（无 getOrElse）；
    //   D3b（T 权威·用户裁定解锁 2026-10-11）：Option[Id]＝List[Id] 纪律的 0/1 元素特例——Req 面
    //   Option[String]，ctor 逐元素 Id.of；其余 Id/Instant 内型（Option[Instant] 等）仍 fail-fast 宁红勿猜。
    if (p.optional && /^Option\[Id\]$/.test(p.type)) {
      return `req.${id(p.name)}.map(net.imadz.common.Id.of)`;
    }
    if (p.optional && /^Option\[/.test(p.type) && /Id|Instant/.test(p.type)) {
      throw new Error(`optional 参数 Id/Instant 内型无装配规则：${agg}.${cmd.name}.${p.name} : ${p.type}——先拍板 Req 序列化边界再扩展`);
    }
    if (/^Id$/.test(p.type)) return cidNameOf(p);
    if (/Instant/.test(p.type)) return `${bindNameOf(p)}Instant`;
    // List[Id]（UUID 名单·S2-48 批3 uuid-unify）：Req 面=List[String]（序列化边界），协议面=List[Id]
    // ——ctor 边界逐元素 Id.of（与 tenantId Id.of(ts.tenantId) 同一纪律）。
    if (/^List\[Id\]$/.test(p.type)) return `req.${id(p.name)}.map(net.imadz.common.Id.of)`;
    // origin 车道 fail-fast（EP_S2_59_S2_60 B2）：非 Id 的 SYSTEM_GENERATED 参数已被剔出 Req（!laneA 分支），
    // 走到这里＝无任何装配来源——报错防哑生成。
    if (!laneA && p !== r1Key && originOf(p) === 'SYSTEM_GENERATED') {
      throw new Error(`origin 车道不支持：${agg}.${cmd.name}.${p.name} 为 SYSTEM_GENERATED 非 Id 参数（无 r1 发号/无 Flow 装配）——需先拍板装配路径`);
    }
    // S2-89 WP-A：SYSTEM_QUERIED 参数——enricher flatMap 域内 q.<name>（服务端读模型装配）
    if (originOf(p) === 'SYSTEM_QUERIED') return `q.${id(p.name)}`;
    return `req.${id(p.name)}`;
  }).join(', ');
  // Lane A 寻址：r2/r3/httpKey＝业务键寻址（Guard 解析的 Id 变量——entityRef 收 String 故 .toString），回执=业务键；
  // r2c＝复合键确定性派生 UUID（同键恒同实体·UUID 形满足 Bootstrap Id.of(entityId) 播种）；r1/无键＝工厂发号；idp＝path 寻址。
  // r2c 键式：tenant 档 tenantId＝ts.tenantId 会话注入（D5-A 不入 body/Guard），global 档＝Guard cid。
  // 类型感知（2026-09-26）：Id 型＝Guard 解析的 cid；**String 型＝裸串直传**（外部系统 id 非 UUID 形，
  //   入不了 IdGuard/Id.of⇒400）——nameUUIDFromBytes 收任意字节，仅 IdGuard 要求 UUID 形。
  const r2cKeyExpr = (p) => (p.name === 'tenantId' && tier === 'tenant') ? 'ts.tenantId'
    : /^Id/.test(p.type) ? `${cidNameOf(p)}.toString`
    : p.type === 'String' ? `req.${id(p.name)}`
    : (() => { throw new Error(`LANE_A r2c 键 ${p.name} 类型 ${p.type} 不可派生（仅 Id/String/会话注入 tenantId）`); })();
  const entityExprRaw = r2Key ? `${cidNameOf(r2Key)}.toString`
    : r2cKeys ? `java.util.UUID.nameUUIDFromBytes((${r2cKeys.map(r2cKeyExpr).join(' + ":" + ')}).getBytes("UTF-8")).toString`
    : httpKey ? `${cidNameOf(httpKey)}.toString`
    : idp ? (idp.fromBody ? `req.${id(idp.name)}` : 'id') : 'generatedId';
  let idRefs = idRefsOf(cmd, idp, tier, agg);
  if (r1Key) idRefs = idRefs.filter((p) => p !== r1Key);              // Lane A R1：发号键不入 Guard
  if (httpKey) idRefs = [...idRefs, httpKey];                          // Lane A D1：合成键入 Guard（bad UUID→400）
  if (r2cKeys) idRefs = [...idRefs, ...r2cKeys.filter((p) => /^Id/.test(p.type) && !idRefs.includes(p)
    && !(p.name === 'tenantId' && tier === 'tenant'))];               // Lane A R2C：复合键 Id 型组件入 Guard
  const idGuardPairs = idRefs.map((p) => `"${p.name}" -> ${(p === idp && !idp.fromBody) ? 'id' : `req.${id(p.name)}`}`).join(', ');
  const instantGuardPairs = instantFields.map((p) => `"${p.name}" -> req.${id(p.name)}`).join(', ');
  const instantNames = instantFields.map((p) => `${bindNameOf(p)}Instant`);
  // D3：VO-List 嵌套 VO 类型（Req companion 需逐类型发射 Json.reads）
  // B2（2026-09-10）：VO 直参同通道——裸 VO 类型与 List[VO] 一样需要 valuesImports import＋Req
  // companion 嵌套 Reads。限一层直参：嵌套内层 VO 不展开——当前协议全集里内层 VO 均另有直参命令携带。
  const voItemTypes = [...new Set([
    ...(VO_LIST_ENDPOINTS.has(cmd.name)
      ? cmd.params.flatMap((p) => {
          const mOpt = /^Option\[List\[([A-Z][^\]]*)\]\]$/.exec(p.type);
          if (mOpt) return [mOpt[1]];
          const mL = /^List\[([A-Z][^\]]*)\]$/.exec(p.type);
          return mL ? [mL[1]] : [];
        })
          // List[String] 也匹配 /^List\[[A-Z]/——切片出标量混进 valuesImports（编译红实证），排除。
          .filter((t) => !BARE_SCALAR_TYPES.has(t))
      : []),
    ...cmd.params
      .map((p) => reqFieldType(p))
      .filter((t) => /^[A-Z][A-Za-z0-9]*$/.test(t) && !BARE_SCALAR_TYPES.has(t)),
  ])];
  return {
    skip: null, kind: 'dsl', actionName: lowerCmd, sig, routeLine, tier, multiTarget,
    establish409: isEstablish,
    reqName, reqFields, hasEmptyBody: reqFieldsSrc.length === 0,       cmdName: cmd.name, reply: cmd.reply,
    cmdNoteId: ctx.commandNoteIdOf(cmd.name), // S7 #1b：控制器端点逐命令锚的号源

    ctorArgsDsl, entityExprRaw, dvExpr: ctx.dvJsExpr(cmd.name),
    idGuard: idRefs.length ? { pairs: idGuardPairs, cids: idRefs.map(cidNameOf).join(', ') } : null,
    instantGuard: instantFields.length ? { pairs: instantGuardPairs, names: instantNames.join(', ') } : null,
    hasIdRefs: idRefs.length > 0, hasInstant: instantFields.length > 0,
    // generatedId 旗标＝「本端点铸新号」：工厂模式（无任何寻址键）或 r1 键在（Lane A 表项/origin 车道——
    // 路径寻址命令也可带 r1 键，如 ScheduleWorkshop 路径 workshopId＋r1 patchId，回执仍=路径键）
    generatedId: !!r1Key || (!idp && !r2Key && !r2cKeys && !httpKey), multiTarget, voItemTypes,
    laneAAddressing: laneA ? (r2Key ? `body-key:${r2Key.name}` : r2cKeys ? `body-key-composite:${laneA.r2c.join('+')}` : httpKey ? `http-key:${httpKey.name}` : 'factory') : (idp ? 'path' : 'factory'),
    // S2-89 WP-A：SYSTEM_QUERIED 装配声明——ask 管线外层包 enricher flatMap（tpl 消费）
    enrich: queriedParams.length ? {
      serviceVar: `${agg.charAt(0).toLowerCase()}${agg.slice(1)}ParamEnricher`,
      method: `enrich${cmd.name}`,
      ctxVar: tier === 'tenant' ? 'ts' : 'gc',
    } : null,
  };
}

/** 读侧视图 Model（B2 形态 B 数据面）：keys/roles/单复键/租户分类决策；OWrites 字段行由模板层渲染。
 *  （controllers inc12 不消费；ViewApi/ViewWrites face 落位时启用。） */
export function buildViewModels(rm, renameMap, viewNoteIdOf = () => null, mongoViewNames = new Set()) {
  const viewsAll = (rm.readModels ?? []).filter((m) => m.name.endsWith('DecisionView'));
  const keyOf = (viewName) => newViewKeyOf(kebabViewStrict(viewName), renameMap);
  const views = [...viewsAll]
    .sort((a, b) => keyOf(a.name).localeCompare(keyOf(b.name)))
    .map((v) => {
      const key = keyOf(v.name);
      const keys = (v.fields ?? []).filter((f) => f.isKey);
      return {
        viewName: v.name, key,
        repoParam: `${v.name.charAt(0).toLowerCase()}${v.name.slice(1)}Repository`,
        noteId: viewNoteIdOf(v.name), // S7 #1b：读端点/ViewWrites 逐视图锚的号源
        fields: v.fields ?? [],
        hasTenant: (v.fields ?? []).some((f) => f.name === 'tenantId'),
        singleKey: keys.length === 1 ? keys[0] : null,
        isGlobal: !(v.fields ?? []).some((f) => f.name === 'tenantId'),
        // [视图存储重设计 2026-10-08] engine=mongo → 列表端点走 findByTenantPaged/countByTenant
        engine: mongoViewNames.has(v.name) ? 'mongo' : 'mysql',
      };
    });
  return { views };
}

/** VO 依赖拓扑序（B2 wave2 F8）：被依赖 VO 在前——companion 内 implicit Reads 的宏展开
 *  依赖同作用域文本在先的隐式。voFieldsOf(name) → 字段 dataType 列表（可为 null＝无元数据退字母序）；
 *  容器包装（List</Option<…）逐层剥壳；环容错（DFS in-progress 标记跳过）；同名确定性（入参先排序）。 */
export function topoSortVos(types, voFieldsOf) {
  const sorted = [...types].sort();
  if (!voFieldsOf) return sorted;
  const set = new Set(sorted);
  const depsOf = (t) => {
    const flds = voFieldsOf(t);
    if (!flds) return [];
    const out = new Set();
    for (const dt of flds) {
      let inner = dt;
      for (;;) {
        const m = inner.match(/^(?:List|Option|Set|Seq)<(.+)>$/);
        if (!m) break;
        inner = m[1];
      }
      if (inner !== t && set.has(inner)) out.add(inner);
    }
    return [...out].sort();
  };
  const order = []; const seen = new Set(); const inFlight = new Set();
  const visit = (t) => {
    if (seen.has(t) || inFlight.has(t)) return;
    inFlight.add(t);
    for (const d of depsOf(t)) visit(d);
    inFlight.delete(t); seen.add(t); order.push(t);
  };
  sorted.forEach(visit);
  return order;
}

export function buildAggregateController(ctx, agg, proto) {
  const actions = [];
  const reqVos = [];
  const skippedCmds = [];
  const routeLines = [];
  const valuesImports = new Set();
  let aggHasDsl = false;
  let aggHasEmptyBody = false;
  let dslCount = 0;
  const needsParkRepo = proto.commands.some((c) => c.name === 'EstablishConcept');
  const needsRegisterFlow = proto.commands.some((c) => c.name === 'RegisterUser');
  // serverScoped Flow 委托注入面（批1-B item 7）：RequestDoRFlow——controller 构造注入手写应用服务
  const needsDoRFlow = proto.commands.some((c) => (FLOW_DELEGATES[agg] || {})[c.name]);
  // S2-89 WP-A（2026-09-14·洞③）：SYSTEM_QUERIED 参数装配注入面——手写 <Agg>ParamEnricher 应用服务
  let needsParamEnricher = false;
  for (const cmd of proto.commands) {
    const ep = buildCommandModel(ctx, agg, cmd);
    if (ep.skip) { skippedCmds.push(ep.skip); continue; }
    if (ep.enrich) needsParamEnricher = true;
    routeLines.push(ep.routeLine);
    aggHasDsl = true;
    dslCount += 1;
    if (ep.hasEmptyBody) aggHasEmptyBody = true;
    if (ep.reqFields) reqVos.push({ reqName: ep.reqName, reqFields: ep.reqFields, voKind: 'reads', voItemTypes: ep.voItemTypes });
    if (ep.voItemTypes) ep.voItemTypes.forEach((t) => valuesImports.add(t));
    if (ep.establish409) {
      // B5-L（样例 B·VO 归属裁定）：409 typed payload 归 REQ VO 家族——companion＋Json.format（OFormat 写侧对称），与 M2 Req 相邻
      reqVos.push({ reqName: 'ConceptNameTaken', reqFields: 'existingConceptId: String', voKind: 'format' });
    }
    actions.push(ep);
  }
  // D3 作用域修缮（B2 wave2 F8）：Req companion 里的 implicit Reads 只在同 companion 可见——
  // 修法＝每个 companion 发射**控制器全集** valuesImports 的嵌套 Reads，companion 各自封闭。
  // 顺序＝依赖拓扑序（被依赖 VO 的 Reads 文本在先），无 VO 元数据时退字母序。
  const voAll = topoSortVos([...valuesImports], ctx.voFieldsOf);
  reqVos.forEach((r) => { if (r.voKind === 'reads') r.voItemTypes = voAll; });
  return {
    agg, ctrlName: `${agg}ApiController`,
    actions, reqVos, skippedCmds, routeLines,
    valuesImports: [...valuesImports].sort(),
    flags: { aggHasDsl, aggHasEmptyBody, needsParkRepo, needsRegisterFlow, needsDoRFlow, needsParamEnricher },
    dslCount,
  };
}
