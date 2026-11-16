# retired-seven：退役七入口的逻辑制品分区

状态：`content-specification`。这是内容与归属规格，不是复活退役入口、修改生成器或银行切换的许可。机器账见 [retired-seven.json](retired-seven.json)。

## 1. 覆盖与计数边界

| producer | catalog producer-output 数 |
|---|---:|
| `scala-cqrs-es` | 20 |
| `scala-cqrs-es-api` | 12 |
| `scala-cqrs-es-ddl` | 4 |
| `scala-cqrs-es-function-specs` | 3 |
| `scala-cqrs-es-policy-exec` | 7 |
| `scala-cqrs-es-projection` | 7 |
| `scala-cqrs-es-rules` | 14 |
| **合计** | **67** |

67 个精确输入键全部进入 `catalogCoverage`，没有按路径通配或类别名推断归属。内容拆分后为 **73 个逻辑项：A 50、B 23**，其中包含一个未在本组 catalog 合同列出的 **anchors 原子写临时文件 B 项**。这些数字不是文件数，也不是传统模板族覆盖数：互斥形态、同文件角色和多个 producer 共享的 writer 分别记账。

- 七个 `generation-ledger` 合同共同引用一个逻辑项；七个 `code-anchor` 合同同样共享一个逻辑项。它们确实执行同一个 core writer，故不复制七份内容描述。
- 骨架与 rules 对 Behaviors、CommandHelpers、EventHandler 的重写不是相同 emitter，分别保留，不能凭目标路径相同去重。
- `port-2` 有真实内联 bridge 内容，但**没有独立 bridge 文件 entry**；它映射到 port 文件中的 bridge object。这里没有伪造一个“声明了就已输出”的文件。
- `support-controller` 的任意输入字节、`manualBlocks` 和 `implOverrides` 是三个无界调用方内容槽。已读源码充分定位其选择和写出机制，但不能对尚未提供的任意字节保证分类。JSON 的三个 `unresolvedCoverage` 明确记录此边界；已读支持控制器 sidecar 的三个精确键均已具体分类，没有“其它代码”兜底项。

A 的基准范围只有 [scala-artifacts.json](../scala-artifacts.json) 的传统 39 族及单列 3 扩展。`template/products/*`、Node 后处理、静态副本不作为传统布局金样。原始 Scala 的 `???`、框架依赖、重复 imports、代码字符串槽也不是“已经达标”的证明。

## 2. 退役、静态可调用、银行消费必须分开

七入口的生命周期与注册口径均为 `retired`。实际读取了七个 `generate.mjs` 和 manifest，而不只读取 catalog 的阶段描述。

### 2.1 退役入口仍有显式 legacy 调用路径

静态链为：

1. [bin/truthsrc.js](../baseline/js/bin/truthsrc.js) 259–300 行接收 legacy `generate` 参数。
2. `lib/execution/generate-cli.mjs` 5–45 行解析显式 generator 路径和 options；这份文件没有进入原基线，本次只读并在 `extraSources` 登记。
3. [manifest.mjs](../baseline/js/src/core/manifest.mjs) 8–28 行验证 manifest 结构，并没有按 `_deprecated` 目录拒绝。
4. [canonical.mjs](../baseline/js/src/core/canonical.mjs) 6–14 行要求 `truthsrc/v1`，再比较 manifest 的数字 inputSchema 下限。
5. [core generate.mjs](../baseline/js/src/core/generate.mjs) 23–42 行动态 import 所选目录的 `generate`，检查 entry/kind 与两次返回一致性；246–267 行才是实际 apply writer。

因此可以说“源码 export 与显式 legacy 入口静态可达”，**不能说本次已成功调用，更不能说产出的 Scala 已编译或应用已运行**。各 producer 还有独立拒绝条件，例如 API/DDL 的视图注记零交集门、工厂缺可初始化命令、policy 缺签名、投影缺可推导 MANUAL 内容。

### 2.2 银行没有选择这七个入口

[银行固定配置](../baseline/bank/truthsrc.project.json) 278 行选择 `scala-cqrs-play-service`。其真实继承链是：

- [Play service generate](../baseline/js/generators/scala-cqrs-play-service/generate.mjs) 16–58 行：`createEffectRegistry('2')`；aggregate/invariant 两个分支还被 service renderer 覆盖。
- [produce-effect](../baseline/js/generators/scala-cqrs-application/produce-effect.mjs) 6–26 行：继续继承 `applicationRegistry('2')`。
- [application produce](../baseline/js/generators/scala-cqrs-application/produce.mjs) 1–30 行：调用 domain/application 当前 renderers，不是这里的七个 `_deprecated` 入口。
- [产品注册表](../baseline/js/lib/products/generate-cli.mjs) 92–101 行：formal 与 family 候选分别注册。候选注册不代表自动进入银行继承链。

本组每个 producer 的 `bankConsumption.status` 都是 `not-selected`。这些旧 Metarch 路径不被描述成当前银行业务链，也不把旧源码头里的“byte-verified/live”等历史文字转写为本次结论。

## 3. A 的实际职责与关键拆分

### 3.1 聚合骨架、领域载荷与持久化装配

[骨架入口](../baseline/js/generators/_deprecated/scala-cqrs-es/generate.mjs) 67–178 行形成 18 个业务/基础设施输出合同。

- **Protocol → `application-protocol`**：真正的 Actor-facing Commands，每个 command 追加 typed `replyTo`；Replies 单独分段；最后是 Effect handler alias。不是因为文件名含 Protocol 才归 A。
- **Entity → `domain-entity`**：State、empty、Event ADT 和纯 `(State, Event) => State` alias。纯事件载荷不加 ActorRef。
- **Aggregate → `aggregate-root`**：commandHandler 转发、entityTypeKey 和 tags。当前真正的 `EventSourcedBehavior` 构造位于 **Aggregate Bootstrap**，后者归 `bootstrap`，不能把 Aggregate object 误报为完整持久化 actor。
- **EventHandler → `event-handler`**：有 foldAssignments 时 `state.copy`，没有时 identity；stateHelpers 仍可能为 `???`。identity 是实际缺口，不是另归 B 的理由。
- **Repository/Factory/Behaviors/Helpers**：分别对应传统端口、工厂、行为组及三方法 CommandHelper。骨架的 tuple/Unit reply 假设、query helper 和空行为链问题均保留为 A 差距。
- **VO → `value-object`**：包括当前原始模板同责的 JSON companion，而不是只留下 case class。≤22、默认值、>22、Instant 四类格式构造均记录。JSON 是否应迁出领域层须按最终覆盖标准裁定，不能隐瞒 raw Scala 同样具有这部分内容。
- **Proto / shared proto / converter / adapters**：PO 消息、oneof、字段号、tenant 补列、转换工具及 self-companion 全部归账。BigDecimal→double、Option[List] 缺失与空值合并是现状语义问题，不能以保留旧字节为由当成银行 Money 的合格合同。

当前物理布局是 `modules/kernel/src/main/scala/<pkgPath>/...` 与硬编码 `app/net/imadz/metarch/...` 混用；部分内容 package 仍固定 Metarch，甚至与计算出的 pkgPath 不一致。JSON 目标统一以单工程 `app/<basePath>/...` / `test/<basePath>/...` 表达建议，业务根下只有 domain/application/infrastructure。`controllers` 在业务根之外，proto/routes/SQL/回执使用各自物理根。若最终选多模块，必须显式重新指定 module owner，不能假称两种根是同输入字节一致。

### 3.2 HTTP 文件不能只登记最显眼的 Action

[Controller renderer](../baseline/js/generators/_deprecated/scala-cqrs-es-api/templates/controller.mjs) 与 [端点 renderer](../baseline/js/generators/_deprecated/scala-cqrs-es-api/templates/tpl_dsl.mjs) 都已完整读取。

- 聚合 controller 的 package/import、构造注入、timeout、emptyBodyReads、Action、文件尾 Req/409 case class 和 companion 都纳入 A `http-controller`。传统 [ControllerTemplate](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/ControllerTemplate.scala) 本身就生成 Req/payload，不能把这些 HTTP DTO 误称领域 VO，也无需伪造 B 差距。
- `CommandDsl.scala` 的 OkReceipt/ViewListDto/ViewItem/IdGuard/InstantGuard 确有传统 [CommandDslTemplate](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/CommandDslTemplate.scala) 内容对应，归 A；目标保留 raw 的 `app/net/imadz/infrastructure/api/CommandDsl.scala` 特例并交集成者裁定共享边界。
- ViewApiController 的租户/全局 list/item、分页门与复合键 400 属 A controller；独立 `ViewWrites.scala` 的行编码域归具体 B。
- AggregateStateApiController 的私有共享 writers、逐字段 State writers、Reply writers、初始化顺序和 typed GetState ask 全部归 A `aggregate-state-controller`。
- VectorSearchApiController 划分为三个逻辑项：A HTTP 边界、B embedding→repository 查询协调、B SearchRequest/结果 JSON。当前构造器的 embedding/store 依赖随 B 查询协调迁移，JSON 类型与隐式初始化随 B codec 迁移；A 保留 Endpoint/cc/EC、鉴权、输入拒绝和 HTTP 错误映射。**唯一组装 owner 为 `retired-seven/vector-search-file-assembler`**，不能由三个改动者分别重写整文件。

`conf/routes` 仅拥有 E301 marker 块，顺序为 commands→views→vector→state。entry 标有 `noLedger`；没有既存目标文件时不写路由，返回一条 entry 不等于路由已部署。

### 3.3 Projection：运行装配、分发、值变换与 I/O

[projection renderer](../baseline/js/generators/_deprecated/scala-cqrs-es-projection/templates/projection.mjs)、[handler renderer](../baseline/js/generators/_deprecated/scala-cqrs-es-projection/templates/handler.mjs)、[repository](../baseline/js/generators/_deprecated/scala-cqrs-es-projection/templates/repository.mjs)、[impl](../baseline/js/generators/_deprecated/scala-cqrs-es-projection/templates/impl.mjs) 均按全文审读。

| 物理容器 | 逻辑职责 | 唯一装配 owner |
|---|---|---|
| `<View>.scala` | A projection：单事件、单源多事件、多源三互斥变体；A projection-handler：私有 CompositeHandler | `retired-seven/projection-definition-file-assembler` |
| `<View>On<Event>Handler.scala` | A projection-handler：PO 解包、Await、repository/graph 操作与 MANUAL 领地；A projection-apply-event：默认行、copy、delete 键值等值变换 | `retired-seven/projection-handler-file-assembler` |
| `<View>Repository.scala` | A projection-repository-port：Table DTO、trait、方法、注解及 imports；四 storage variant | 每个互斥 storage variant 的 repository assembler |
| `<View>[Mongo]RepositoryImpl.scala` | A projection-repository-implementation：四种后端方法体、codec、辅助成员与构造注入 | 每个互斥 storage variant 的 implementation assembler |

CompositeHandler 的 constructor/extends/process 属分发角色；runtime 行拥有外层 object、projectionName、sourceProvider、创建分发器的使用点和 sessionFactory。imports 由同一 owner 汇总，不能遗漏或重复保留两个文件头。

值变换目前直接接触 PO，并嵌在 Await/写库之间；A `projection-apply-event` 的目标是独立 `<View>ApplyEvent.scala`。这不表示当前已经存在纯函数文件。对比的是 [传统 ApplyEventTemplate](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/ProjectionApplyEventTemplate.scala) 的实际职责；updateOnly/persistenceIdCreate 缺少对应分支，不能为改善覆盖数编造。

四种存储实现均是 A，而不是以技术后端名字当 B：

- table：DB.localTx upsert、Future readOnly 查询、列级 bind/read。
- mongo：MongoViewStore、kind discriminator、JSON 编解码和毒行隔离、分页与计数。
- graph：Strict GraphMutationExecutor 与有白名单的边映射；`mergeLinkTolerant` 仍为 `???`。
- vector：同步 embedding、PgVectorStore、ViewColumns 和当前 Map[String,Any] cast。

JDBC projection 的 exactlyOnce 容器**不能证明**这些独立 localTx、Mongo、图或 embedding 副作用也是 exactly-once。

### 3.4 Rules 与 Policy：按语义拆，不按名词统一

[规则入口](../baseline/js/generators/_deprecated/scala-cqrs-es-rules/generate.mjs)、[Rules body builder](../baseline/js/generators/_deprecated/scala-cqrs-es-rules/builders/rules_face.mjs)、[EventHandler body builder](../baseline/js/generators/_deprecated/scala-cqrs-es-rules/builders/eventhandler_face.mjs) 均完整审读。

- 有显式 behaviorModel guards/emissions/emitWhen 的 Params 与 command decision 对应 A `aggregate-rules-formal`；其余独立纯 Params 是明确 B 参数投影，不是 Actor Protocol。
- Rules 文件中的 err/notNull/isMissingRef、InitialCommands/checkAggregate、旧规则库推导属于 A `invariant-rule`；显式 formal command bodies 独立列 A；事件后置校验另列 A `invariant-rule`。
- `rules-file-assembler` 唯一拥有整个 Rules 文件组装；公共行拥有 header/package/object，formal/postcondition 行只提交自己的声明和依赖需求。`rule-params-file-assembler` 对混合 formal/legacy Params 同样只组装一份外壳。
- 规则面重写的 CommandHelpers、Behaviors 和 EventHandler，与骨架实现独立保存。新State回复、withPost、readOnly 路径与 ports 参数表不能用“同一路径”掩盖差异。
- 纯 `<Agg>Policies` 是 `Event → List[CmdParams]` 的 B 反应策略，包含 fanOut/filter 与描述性 idempotencyKey，不代表执行了幂等。
- 执行侧 `<Cmd>Policy` 的 decide/dispose 也是具体 B，不能映射到不在 39+3 范围的旧 PolicyTemplate；但其 **Handler、Runner、Bootstrap 仍分别归 A** projection-handler/projection/bootstrap，因为职责真实相同。
- `<Cmd>Mechanics` 用 sharding ask 执行应用命令并译 Reply，归 A `application-service`；object/curried 参数与传统 DI class 的形态差异保留，不因实现形式不同挪到 B。

可选 domain port 文件是另一处 A/B 混合：B trait 声明与 A domain-service bridge object 分开登记。bridge methods 当前逐个转发手写目标，不等于业务实现已经生成。`port-2` 对应这个内联 object，唯一 owner 为 `retired-seven/domain-port-file-assembler`。

## 4. B 的具体目标与 fixture

以下列出全部 23 个 B 逻辑项。路径中 `<basePath>` 为建议业务根包的路径形式；fixture 均只是规格，状态全部为 `specified-not-executed`。所有 Scala B 均遵循 [layout-and-style](../layout-and-style.md) §2 三层/测试根、§3 名称与 imports、§4–5 依赖与纯性、§7 可读性、§8 最终字节与归属；SQL/JSON/临时文件使用其物理分区，不假装是 Scala 业务包。

| B 逻辑项 | 具体目标 | fixture 与专项要求 |
|---|---|---|
| view-keys | `app/<basePath>/infrastructure/auth/ViewKeys.scala` | `retired-api-role-view-contract`：注记门、重命名、公开key不变 |
| command-role-map | `app/<basePath>/infrastructure/auth/CommandRoleMap.scala` | 同上：读权不泄漏写权，空角色仍有scope门 |
| view-json | `app/controllers/ViewWrites.scala` | `retired-view-codecs`：Instant/Option/null、UUID、List[VO] |
| vector-query | `app/<basePath>/application/queries/<View>SemanticSearch.scala` | `retired-vector-search`：embedding/store分开失败，租户传递与阻塞边界 |
| vector-json | `app/controllers/<View>SearchJson.scala` | 同上：Request可选字段、typed writers、不返回embedding |
| support-graph | `app/controllers/GraphApiController.scala` | `retired-support-controller-graph`：可见租户并集、Strict图过滤、404/500、depth语义 |
| support-health | `app/controllers/HealthController.scala` | `retired-support-controller-health`：SELECT 1及200/503语义，不把探针当业务完成 |
| support-metadata | `app/controllers/MetaController.scala` | `retired-support-controller-metadata`：三种apimeta资源、404、流finally关闭 |
| mysql-decision-views | `conf/sql/2.sql` | `retired-ddl-dialects`：键序、列类型、大文本，排除graph/mongo，不DROP |
| pgvector | `conf/sql/5-pgvector.sql` | 同上：dims、distance、列/索引白名单、空views仍发扩展 |
| function-oracle | `test/<basePath>/domain/services/ContentFingerprintSpec.scala` | `retired-function-oracle`：手写oracle、转义与输出类型，不反推实现 |
| decision-disposal | `app/<basePath>/application/projection/policy/<Cmd>Policy.scala` | `retired-policy-execution`：Retryable/Permanent、事件→Params，不改恢复语义 |
| projection-repository tests | `test/<basePath>/infrastructure/repositories/projection/<View>RepositorySpec.scala` | `retired-storage-table`：H2、完整行往返、重复upsert、隔离/关闭资源 |
| params-legacy | `app/<basePath>/domain/invariant/params/<Agg>RuleParams.scala` | `retired-rules-and-params`：纯参数供应序、List默认值、无ActorRef |
| rules tests | `test/<basePath>/domain/invariant/<Agg>RulesSpec.scala` | `retired-rules-tests`：正负case、port、SKIP与patchForCases披露 |
| reaction-policies | `app/<basePath>/domain/policy/<Agg>Policies.scala` | `retired-policy-reaction`：bindings、fanOut/filter、UUID、无隐式I/O |
| reaction-policy tests | `test/<basePath>/domain/policy/<Agg>PoliciesSpec.scala` | 同上：差异化哨兵；数量断言不替代逐字段oracle |
| actor-executable tests | `test/<basePath>/application/aggregates/<Agg>ExecutableSpec.scala` | `retired-actor-executable`：typed reply、事件/新State、负例不持久化应补齐 |
| actor-config | `test/<basePath>/application/aggregates/ExecutableSpecConfig.scala` | 同上：隔离testkit配置，不扩大生产serializer绑定 |
| domain-contract | `app/<basePath>/domain/services/<PortTrait>.scala` | `retired-domain-port`：逐方法合同、跨包/module、domain不得隐式依赖Play JSON |
| generation-ledger | `truthsrc.ledger.json` | `retired-apply-evidence`：按path最终writer、noLedger、MANUAL后字节 |
| code-anchors | `anchors.json` | 同上：file/span/symbol分级、旧证据降级、禁止索引自锚 |
| anchor-atomic-temp | `.anchors.json.tmp-<pid>-<uuid>` | 同上：wx0600/sync/close/rename；失败只清自己inode，不是业务输出 |

B 的新目标路径/接口是建议规范，不代表用户已经批准新的查询服务算法、恢复语义或数据类型迁移。

## 5. 已定位的缺实现与接缝问题

以下是内容阅读所得，**不是本次运行复现结果**。

1. **动态源码名和硬编码 Metarch 假设错位。** Protocol 支持自定义 commandFamily/reply；API parseProtocol 却只认 `*CommandFamily` 和 `<Cmd>Reply`，并直接逗号拆参数；repository implementation/bootstrap 也有固定命令族。生成一个接口不等于其它入口能正确消费它。
2. **骨架不是完成业务。** helper 的 tuple/Unit reply、query `???`、EventHandler 的 identity/helper `???`、空业务组行为链，都不能被表内 A 归属自动认证。
3. **ApplicationBootstrap 边界。** builder 的 constructor tail 依赖最后一个 projection repository，无视图输入有未定义尾项问题；ports union 在 root/EH 与 bootstrap 的来源集合不完全一致。组合 bootstrap 只接聚合及 projectionViews，不接 policy-exec 的 bootstrap traits。
4. **Handler 推导有实质缺口。** `deriveView` 85 行把 keysDecl 做成字符串数组，`tableManual` 32–41 行却按 `k.name` 读取；正常非空key分支可能推导失败后依赖sidecar。graphManual 162 行 `mergeEdge` 只发三个参数，而 repository methodsOf 68 行接口另要求 tenantId。sidecar 可以遮住缺口，不能据有历史成品判断纯推导完成。
5. **读仓储未完成与资源问题。** graph 的 mergeLinkTolerant 是 `???`；table 查询有未在该文件定义的 rsBigDecimal；H2 spec 没有显式关闭 Source/pool，并依赖跨case累计数据。Mongo countByTenant 全集合解码后使用 Int-valued count；接口 Future[Long] 下 Scala 是否做预期类型扩宽本轮没有 typecheck，因此不声称这是已证实编译错，仍需裁定大集合与毒行计数语义。
6. **规则降级不能冒充真实验证。** sentinelFallback、未翻译规则跳过、事件构造默认值、now、version+1、GEN_SKIPPED/幂等分支的硬拼 else 均需内容级处理；规则面 `.withPost` 旗标与实际 evtFinal 函数存在性还须同输入对账。普通方法复杂度未测量。
7. **Port bridge 注释与代码相反。** 注释声称跨module bridge跳过，实际 `bridgeSkip=false`；bridgeFq仅取短名并写入trait所在package，且entry路径固定domain/service。不能据 catalog `port-2` 推断已具备跨模块bridge writer。
8. **HTTP 边界缺口。** 多vectorViews仍发同一个POST路径；vector recover把整个链条故障一律报告为embedding失败；Req renderer尝试用cmdNoteId发锚，但builder构造Req记录没有携带该字段。公开operation/view key与稳定身份不能为修文件名而改动。
9. **测试不是独立业务oracle的替代。** RulesSpec/ExecutableSpec会patch给定值或按同源血缘派生断言，PoliciesSpec主要检查数量/非null；FunctionSpec才明确以手写输出表为来源，但其字符串转义/类型覆盖也需审定。testkit配置源码实际允许Java serialization，不能照抄注释说已关闭。

本片段不尝试通过删规则、合并名义类型、`addExact→+`、更换PID/PB号/manifest、放宽serializer或反推oracle来“解决”这些差距。

## 6. 可读的业务路径与所有权

这里可以阅读的路径是**旧Metarch作者/生成器路径**，不是当前银行已验链路：

- 声明字段模型命令 → API request/身份字段 → Repository.entityRef → typed Actor Command → Helper纯Params → Rule事件决定 → 持久化/事件应用 → 新State Reply。骨架与rules两遍如何选择，必须由输出计划明确。
- 领域事件 → PO/adapter → 按tag读取 → Projection/CompositeHandler → per-event Handler → 读行值变换与RepositoryImpl → ViewWrites → 租户读端点。offset事务与外部存储副作用不可混称一个原子事务。
- executionSide policy：源事件 → Handler decode → 纯反应Params → Mechanics ask目标聚合 → Retryable/Permanent分类 → at-least-once offset推进。当前应用组合没有自动接上这些bootstrap；幂等/死信机制引用手写运行时，不能由本组文件存在反推完成。

每个分解点都有唯一文件组装 owner；公共 layout/naming/types、writer、registry 归集成者协调。本阶段没有任何生成应用、ledger、anchor、作者树或稳定业务ID被修改。

## 7. 固定来源与补充只读来源

JSON 登记 **64 份固定来源**，完整文件字节数及SHA与 `baseline/index.json` 对应；`readCoverage` 区分全文与明确区间。七入口和全部产物renderer/包含实际Scala body的主要builders均已实读。未宣称把所有传递依赖或任意调用方字节全部审完。

补充来源只有两份，均未写入/替换任何基线：

| 原仓相对路径 | 完整 SHA-256 | 用途 |
|---|---|---|
| `lib/execution/generate-cli.mjs` | `b9f33e711730f1f6fcac9311e20ec3333531353ca65e588c4058bd106012fe66` | legacy CLI参数入口，全文只读 |
| `golden/scala-cqrs-es-api-metarch/retired-controllers.json` | `ec65ae8d5d078c5f43c45f730316f0b62281a9df285eb90ce970c60a7ed88f8d` | GraphApiController/HealthController/MetaController实际载体字节，全文只读；不是设计金样 |

当前支持控制器文件的任意额外键、projection MANUAL和整文件override，需要后续选定输入后固定其准确path/hash并逐construct分类。不能凭本片段推断未提供的任意字节已有覆盖。

## 8. 本轮结果与后续阻断

本轮只保存本组 JSON/MD，并对手工映射做键、引用、A族ID及固定来源bytes/SHA的文档机械对账。**没有执行任何应用/CLI运行、测试、typecheck、compile、generation、服务、下载或Git写操作；没有 fresh verification，也没有 parity-PASS/behavior-PASS。**

下一阶段若获实施授权，必须先固定同输入fixture与所有sidecar、选择单工程或多模块、裁定上述接口/时间/精度/恢复问题，然后才能分别验收完整文件内容、构造/RHS、真正消费接口与必要行为。退役源码的文档完整不等于应该复活它，更不等于银行切换授权。
