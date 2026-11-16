# formal-service：正式 Play 服务逻辑制品分区规范

状态：`content-specification`。仅归属 producer `scala-cqrs-play-service`。机器账见 [formal-service.json](formal-service.json)。本文不是生成器修改、业务接口变更或运行验收授权。

## 1. 覆盖与证据边界

- 输入固定为 [catalog](../baseline/js/docs/artifacts/catalog.json) 中本 producer 的 **60 条 producer-output 合同**；全部在 JSON `catalogCoverage` 中回指实际构造。
- 本组划分 **84 个逻辑条目：A 28、B 56**。这是角色/变体数，不是物理文件数、Scala 模板族数或能力通过数。A 中同族的多入口和部分职责不会因此变成多次“通过”。
- 另外发现 **2 类未登记写入**：项目目录的知识 SQLite，以及提交 anchors 时的独占临时文件。前者是持久派生存储；后者成功 rename 后消失，不是额外长期业务产物。
- JSON 保存 82 个已读固定来源条目；另有 3 个未入基线的只读 `extraSources`，均记录完整字节 SHA-256。固定源的哈希/bytes 与 `baseline/index.json` 做了机械核对，未运行项目模块。`anchors.mjs` 只阅读并引用 475–612 行的最终核验/写入范围；`FixtureHostTemplate.scala` 仅阅读 1–220 行的文件族和 wire 说明，未冒称完成整个 fixture 宿主审查。
- 本轮未执行 application/CLI、测试、typecheck、编译、生成、服务、下载或 Git 写操作；没有新的同输入字节对账、复杂度测量或运行证据。所有建议 fixture 都是 `specified-not-executed`，不标 `parity-PASS` 或 `behavior-PASS`。

路径说明：当前 `basePath` 是 `options.packages` 中 context 对应 package 的斜线路径；`A`、`V`、`Store` 来自声明。当前 host/pipeline stem 是真实实现的 `id.replaceAll('-', '_')`，**不是**推荐源码命名。当前服务文件 stem 来自 `artifact.artifact.id`，可以造成重复技术后缀；目标 stem 应经统一命名模型生成。目标选 **单工程 Play** 的 `app/<package>/` 和 `test/<package>/`，不是 family 多模块物理根。测试资源迁移与 build 配置必须一起实施。业务根下只允许 domain/application/infrastructure；顶层 `app/controllers/` 在业务根之外。

## 2. 正式选择与继承关系

证据链如下，全部是静态来源事实。

1. [银行配置](../baseline/bank/truthsrc.project.json) 278–299 行明确选择 `scala-cqrs-play-service`、`bank-service`、外部 `handwritten/scala`；`verificationCases` 是空数组。6–63 行固定 domain-decision 4、domain-folds/dependencies 6、artifact-contract 3、saga-host/effect-host 2。
2. [generate-cli](../baseline/js/lib/products/generate-cli.mjs) 92–101 行按 shipped generator 的精确 realpath 注册分派。domain-kernel、aggregate-core、module-seams、persistence-readside、saga-monarch、play-application 是**独立注册候选**，不会自动成为银行消费。
3. [formal generate](../baseline/js/generators/scala-cqrs-play-service/generate.mjs) 16–23 行调用 `createEffectRegistry('2')`，再通过 [produce-effect](../baseline/js/generators/scala-cqrs-application/produce-effect.mjs) 6–25 行继承 [applicationRegistry('2')](../baseline/js/generators/scala-cqrs-application/produce.mjs)。
4. 正式入口覆盖 `aggregate-dsl` 为 `renderAggregateLayers`，覆盖 `invariant-dsl` 为 `renderInvariant(..., true)`。所以正式 `domain/<A>Aggregate.scala` 来自 `legacyTemplate`，**不是** `renderActors` 的独立 domain actor 实现。后者存在、可由其它 profile 调用，不代表此入口执行它。
5. 正式 wrapper 还改变 footprint、测试 class 初始化、Play build、sbt 版本，以及把继承的 `src/main/resources/application.conf` 迁到 `conf/serialization.conf`。不可把版本 1/2 或覆盖前后的字节误并。
6. [planProductSet](../baseline/js/src/core/product-plan.mjs) 71–103 行要求完整产品重编译一致、精确 producer 版本/footprint、两次计划确定性和完整 deps。本文只读这些条件，没有调用该函数。
7. `generate-product` 的 apply 走 `applyEntries`；`generate-project` 还绝对化相对 runtime repository/source roots，经过知识 AST、增加四个 evidence entry，并发布项目知识图。源码存在、配置选择、完整计划可接受、应用运行通过是四种不同声明。

### 本入口没有接通的内容

- 没有 `createChildRegistry` 或 `child-plan-contract` 继承。`renderInvocationExecution` 的 child 分支需要另一明确产品，不能把这个分支的源码存在当作银行已消费 child run。
- `renderService` 22 行对非空 `service.projections` 明确拒绝。另一个已实现分支是 `service.projectionStore` → `renderJournalReadside`，两者不是同一协议。
- `GeneratedFiniteHostSpec` 会构造 base 文件，但业务测试体只对 `inventory` host 发出；recovery/extended/required-bindings 也有 inventory 条件。execution/effect 测试有 `allocation-inspection`/`inspect` 固定筛选。空 base suite 和空 `verificationCases` 不构成银行写侧或金融 oracle。
- Factory、HTTP Authority、Endpoint 的 codecs/run、PageRenderer、技术 callback、Journal、Ownership 及纯 Computations 算法仍由外部实现提供；没有以声明/安装表伪造实现。

## 3. A 对应按内容，而非按目录标签

| 实际生成职责 | A 对应 | 明确保留的差距 |
|---|---|---|
| State case class、Entity aliases/empty、Protocol 中 Event ADT | `domain-entity` | State/Events 真实声明仍散在旧容器；不能把别名壳叫作已完成实体迁移 |
| 纯规则 guard、参数、成功事件构造 | `aggregate-rules-formal` | `CommandHelpers.emit*` 是规则成功臂，不是 Actor CommandHelper；String/Vector 与 iMadzError/List、InvariantRule 接口存在差距 |
| 不可变名义/record/exact values | `value-object` | exact 数学行为必须保真；当前缺传统 Play JSON/default 字段相关形态，不能改财务表示来追求字节一致 |
| 领域 PB、domain↔PB、Event/Snapshot adapter | schema/converter/adapter 对应族 | 当前按包 serialization graph、FQN、object/分片与传统 aggregate/shared、mixin/oneof 不同；协议编号/manifest 固定 |
| Actor Request/Reply、handler alias | `application-protocol` | typed ActorRef 存在，但目前是 Execute 包纯 payload、Accepted(events)，不等逐命令 typed reply；纯 Command 参数另列 B |
| root.commandHandler、行为组、两个 factory 入口、EventSourcedBehavior bootstrap | aggregate-root/behavior/factory、bootstrap | 本地 PID、无 sharding tags/retention/backoff 等；不能靠 A 标签隐去差距 |
| 本地 actor cache 的 get/identity/spawn | aggregate repository implementation | 具体实现放错层且无独立 port；close 只清缓存，不负责 stop actor |
| StrictSagaDefinition、PhasePort/receipt/identity/participant 装配 | `strict-saga-module` 扩展 | 不是 classic SagaDefinition/Participant；HostRequirements、完整准入/期限/漂移合同不能视为已等价 |
| pipeline-owned Saga intent、持久身份观察、结果确认桥 | `composition-invocation-host` 扩展的部分职责 | 没有传统扩展完整 split→child→merge、cluster singleton 或 child journal 权威链；direct host 单列 B |
| 外部提交/查询 typed 能力声明 | `external-connector-port` | 仅相应 technical role；其它 entry/policy/phase/安装表不混入此 A |
| Loader 内 action、路由定义、顶层启动 | http-controller/route-definition/application-bootstrap | 混合文件也算 A 实际差距；没有真实 `conf/routes` entry，反射 Factory 与 raw DI class 不同 |
| JDBC 读库 SQL/session、journal 源运行装配、事件事务处理 | projection repo implementation/projection/handler | 当前不是 tag-based JdbcProjection exactlyOnce；不能宣称端到端 exactly-once |

`renderJournalDomain` 是 PB 解码、现有领域 fold 的重建调用、身份检查和 ownership 适配，列 B；它并未另行生成业务视图的纯 `ProjectionApplyEvent` 算法，不用它伪填该族缺项。纯 Computations trait 也不意味着生成了 DomainService 算法。其余 42 族缺项由集成者统一反查，不在本组制造空对应。

## 4. 复合容器的完整拆分与唯一组装者

JSON 的 `assemblyPlan` 和逐条 `constructDisposition` 是完整机器账。下面是影响业务阅读的关键边界。

### 4.1 领域载荷、Actor 协议、规则与回复

来源：[render-domain](../baseline/js/generators/scala-cqrs-domain/render-domain.mjs)、[aggregate-state](../baseline/js/generators/scala-cqrs-domain/templates/aggregate-state.mjs)、[aggregate-protocol](../baseline/js/generators/scala-cqrs-play-service/templates/aggregate-protocol.mjs)、[aggregate-behavior](../baseline/js/generators/scala-cqrs-play-service/templates/aggregate-behavior.mjs)。

- `domain-entity-assembly` 拥有旧 State/Protocol/Entity 容器的 package、所有字段/默认值、Event 与别名/伴生以及目标 import。纯 Command 参数迁到 `domain/invariant/params/<A>CommandParams.scala`，不得注入 ActorRef。
- `domain-rule-assembly` 把 Computations trait/空依赖 none 实例与 emit 构造区分；前者落 `domain/services/<A>Computations.scala`，后者归规则成功臂。core rules、Params、旧 wrapper 的调用关系整体迁移。
- `aggregate-protocol-assembly` 处理旧 `domain/<A>Aggregate.scala` 中 Request/Reply、ExternalAuthority、apply 和独立顶层 AggregateFactory，以及 application Protocol 的所有 type/val aliases。不是只挑出 case class 后丢下 object 壳、imports 或工厂。
- `aggregate-runtime-assembly` 管 root、behaviors、factory 与 bootstrap。保持错误不持久化，成功持久化并应用后回复；当前 `thenRun(_ => Accepted(events))` **不是**期望的 `CommandHelper` 三方法及新 State 回复合同。
- `domain-event-assembly` 保留每个 fold 的求值/异常顺序；`nextN` 只有在证明单次求值和跨字段依赖不变时才简化。整数 `addExact/subtractExact`、Money 单位与精度不动。

**关键缺接线**：当前没有 `toParam`、`createFailureReply`、`createSuccessReply` 与 `runReplyingPolicy(...).replyWith(...)`。不能用纯 emit helper 充数，也不能将 `replyWithAndPublish` 与 `replyWith` 混为一谈。

### 4.2 持久化与 wire

来源：[render-serialization](../baseline/js/generators/scala-cqrs-domain/render-serialization.mjs)、[render-adapters](../baseline/js/generators/scala-cqrs-domain/render-adapters.mjs)。

- `domain-serialization-assembly` 唯一负责 DomainConverters object、分片 trait/self-type、PB methods、共享 exact parser、wire/PO methods 和最终注册配置。
- exact parser 的长度限制、规范数字形式、负零/指数拒绝、UNNECESSARY scale、map 排序与重复 key 拒绝均在构造账中；不得作为“样板”删掉。
- 同一个 `<A>Adapters.scala` 中 EventAdapter 与 SnapshotAdapter 拆成两个 A。EventAdapter 的类型+manifest 双检查和 SnapshotAdapter 的精确 StatePB 检查都保留。
- `DomainProtoSerializer` 是 B 字节 serializer，不是上述两个 A；其 `741000+contextIndex`、精确白名单及分片链是完整独立职责。host/effect serializer 的 `742000+index`/`744000+index` 同样是单独技术合同。
- .proto 物理位置本阶段建议先保持现有 `app/protobuf`，由构建 owner 与制品 diff 决定最终迁移；不能为了搬包直接改 PB package、字段号、manifest 或接收类型集合。

### 4.3 Saga、Monarch 与 effect 的差别

来源：[render-host](../baseline/js/generators/scala-cqrs-application/render-host.mjs)、[pipeline invocation](../baseline/js/generators/scala-cqrs-application/render-pipeline-invocation.mjs)、[HostIO](../baseline/js/generators/scala-cqrs-application/render-host-io.mjs)、[effect host](../baseline/js/generators/scala-cqrs-application/render-effect-hosts.mjs)。

- `saga-definition` 与 `saga-definition-2` 精确回指同一 strict module 条目，不重复计算一份 identical emitter。其 argsCodec、Ports、fromTechnical、逐 phase receiptCodec/check/command/bind、definition、coordinator 全部在内。
- direct 与 pipeline invocation **分开**。pipeline 保存整个父 checkpoint，direct 保存入口 original；关联摘要 inputs 和结果类型不同，不能因同叫 Host 合并。
- `wireHostIO` 不仅换方法调用，还增加 admitted 字段、AdmissionGranted/Admitted、排队回复、可选 occurrence 消息及 event fold。全部归唯一 invocation owner，不能漏掉初始化或恢复相关状态。
- Host 中残留 Delivery trait 虽被 Installed TechnicalPorts 替代调用，仍是当前真实构造；是否删除必须核查外部引用。
- Monarch Execution 的 data/StateCodec/runtime 三角色分别定位；pure 与 invocation/effect 两个分支互斥。桥 actor、Promise、20ms Pending 重试、PostStop 失败以及所有 imports/初始化都有 owner；不能把纯 Request 当 Actor protocol。
- effect host 持久化 Intent 后才 execute，恢复只 query；重试要求同 original/operation、absent 证据与授权。未知结果不等失败、不等未执行。其摘要格式没有 `sha256:` 前缀，与 Saga invocation 格式不同，保持不变。
- resource-policy 是 HostIO 准入端口；不对应已退休 Scala Policy 模板。bindingOwnership 是静态实现义务，不是业务授权证书。

### 4.4 Play 服务的边界

来源：[render-service](../baseline/js/generators/scala-cqrs-play-service/render-service.mjs)、[pages](../baseline/js/generators/scala-cqrs-play-service/render-service-pages.mjs)、[configuration](../baseline/js/generators/scala-cqrs-play-service/render-configuration.mjs)。

`play-http-assembly` 独占 Service/Loader/Bootstrap 的组装，拆出以下内容。

1. 安全与 JSON：Principal、Authority、Failure/Outcome、严格 decodeBody；Jackson parser 的 finally close 必须跟随该职责。
2. Endpoint 与 typed Bindings：每个 implementation/version/Reads/Writes/run 的安装条件，不生成外部业务 callback。
3. Composition/Factory：ready、close、外部创建接口和 pages 可选值，落 infrastructure.bootstrap。
4. A action：ready→authenticate→role→csrf→decode/路径参数→invoke；错误状态与 NonFatal 503 保真。
5. A routes：当前 tuple/Route、regex、alias、静态 shell/script 分支，目标为显式 controller actions 与共享 marker routes。当前没有写 `conf/routes`。
6. B presentation：PageRenderer、Response、CSP/no-store/nosniff/referrer、HTML/script 错误输出。没有生成实际银行 HTML 或脚本业务。
7. B loader/components：implicit ec、httpFilters、stop hook、pageRenderer 校验初始化。不能整文件挪入 application 就宣称分层。
8. A ApplicationBootstrap：配置检查先于反射 Factory；核 pin 后 create、安装、Components.application，失败按现有次序清理。cleanup 异常和生命周期 Future 是否等待是待明确语义，不在本阶段暗改。

有/无 pages 的合同与输出保持两个条件变体；共享 renderer 的主体不是字节完全相同。`private[service]` 的访问边界、Loader 配置 FQN 和手写 Factory 引用必须随拆包一起设计。

### 4.5 显式 journal 读侧

来源：[journal readside](../baseline/js/generators/scala-cqrs-play-service/render-journal-readside.mjs)、[repository](../baseline/js/generators/scala-cqrs-play-service/render-journal-repository.mjs)、[journal domain](../baseline/js/generators/scala-cqrs-play-service/render-journal-domain.mjs)、[shared JDBC templates](../baseline/js/generators/shared-jdbc/templates.mjs)。

- `journal-storage-assembly` 拆 PO/row 载体与 A repository 实现。Row/Payload/State/Owner/index case classes 有具体应用合同位置；hash、namespace、DataSource、active Session、SQL、transaction、resource close 全归实现 owner。
- 本入口使用 shared JDBC 的 legacy 参数：`unknownCommit=false`、`finishBeforeCommit=false`、`threadConfined=false`。不能把其它 family 的更强模式写成当前已经消费。
- A ingestion 保持 identity 检查先于 SQL，重复序号必须 payload 类型/manifest/bytes 全等；新序号必须 `addExact(last,1)`，同一 session 内 fold→append→indexes。
- `journal-projection-assembly` 唯一拥有 repository 实例、materializer、serialization、kill switch、watch/catchUp maps、discovery、poll、closed/initialized/pendingWork、drained/shutdownResult。拆分建议不能导致双初始化或丢失退出路径。
- 发现源可能无限，不能等发现结束才 ready；frontier 是每 PID 的观察样本，不证明整个索引最新。shutdown 先关闭入口/取消调度/终止订阅、等待排空，再使 freshness 失效，不关闭外部 Journal/DataSource/ActorSystem。
- JournalDomain 是具体重建适配；技术 kind 可返回无业务 payload，未知 kind 拒绝。allowEmptyIdentity、事件身份字段与名义文本解包都按明确声明，不推测业务身份。

## 5. B 的具体目标与 fixture

下表是 B 类规范导航；完整逐项路径/construct/条件/规则已在 JSON，不用笼统“其它”归类。

| B 内容 | 建议目标 | 必需 fixture/质量点 |
|---|---|---|
| 纯命令参数 | `app/<basePath>/domain/invariant/params/<A>CommandParams.scala` | `parity/domain-command-params-v1`；无 ActorRef，字段顺序/名义身份不变 |
| 纯计算端口 | `app/<basePath>/domain/services/<A>Computations.scala` | `parity/domain-computations-v1`；无host/有host；不得造假算法 |
| 外部事件映射 | `app/<basePath>/application/connectors/<A>ExternalEventMapper.scala` | `parity/external-event-bridge-v1`；完整 output 和身份 key 顺序 |
| exact wire/PO | `app/<basePath>/infrastructure/persistence/converters/<V>RepresentationCodec.scala` | `parity/exact-representations-v1`；负零/指数/精度、nominal 不折叠 |
| PB serializer/分片 | `app/<basePath>/infrastructure/persistence/DomainProtoSerializer[Part<N>].scala` | `parity/serializer-whitelist-v1`；ID/manifest/白名单/边界分片 |
| direct host、HostIO、技术安装对象 | `app/<basePath>/application/services/transactor/<Host>{Host,HostIO,TechnicalBindings}.scala` | direct/admission-delivery/technical-installation fixtures；持久事实、版本与完整上下文 |
| Host/effect wire | `app/protobuf/<stem>_{host,effect}.proto`；`infrastructure/persistence/<Host>HostSerializer.scala` 或 `<Effect>EffectHostSerializer.scala` | host/effect-wire；完整事件与双版本拒绝 |
| Monarch data/runtime/codec | `application/services/transactor/<Pipeline>Execution.scala`；`infrastructure/persistence/converters/<Pipeline>ExecutionCodec.scala` | pure/invocation fixtures；确认前缀、尾重跑、完整 checkpoint |
| Execution PB | `app/protobuf/<pipeline_stem>_execution.proto` | `parity/finite-execution-wire-v1`；nominal/scalar/presence 与 planversion |
| 独立 effect host | `application/services/transactor/<Effect>EffectHost.scala` | durable-effect-host-v2；unknown/absent 区别、授权 retry、stale callback |
| ExternalAuthority、Handle | `application/aggregates/<A>ExternalAuthority.scala`；`application/aggregates/repository/<A>Handle.scala` | ingress拒绝、PID/ref一致、本地repository生命周期 |
| 旧 apply/rule/fold wrapper | 迁调用到 Bootstrap/core Rules/core EventHandler 后退役 | legacy-callsite-migration；不是保留错误层永久转发 |
| HTTP safety/Endpoint/PageRenderer | `infrastructure/connectors/http/<Service>{HttpContract,EndpointBindings,PageRenderer}.scala` | service-http-boundary/pages；strict JSON、401/403/409/503、renderer pin |
| Play Composition/Loader/Components | `infrastructure/bootstrap/<Service>{Composition,Loader,Components}.scala` | service-composition；ready/cleanup/stopHook及初始化顺序 |
| 页面响应呈现 | `app/controllers/<Service>Pages.scala` | service-pages；CSP/MIME/error fallback，业务渲染外部实现 |
| 配置验证与 HOCON | `infrastructure/bootstrap/<Service>Configuration.scala`；`conf/{service,application,serialization}.conf` | service-configuration；符号连接字面键、无秘密泄露、禁止错误 destination |
| DDL/Scala Schema | `infrastructure/repositories/projection/<Store>Schema.scala`；`conf/sql/<store.id>.sql` | journal-schema；SQL类型/nullable/key/version合法且一致 |
| JournalRecords/重建适配 | `application/projection/repository/<Store>Records.scala`；`infrastructure/persistence/converters/<Store>JournalDomain.scala` | journal-records/domain；身份错配/技术kind/默认状态重建 |
| domain/actor/host/execution/effect测试源码 | `test/<basePath>/verification/Generated<具体Suite>.scala` | JSON逐suite fixture；固定库存筛选不算银行oracle |
| unit隔离、runner、服务测试 | `test/resources/service-unit.conf`；`test/<basePath>/verification/{UnitNoNetwork,UnitConfigurationCheck,UnitTestMain,GeneratedUnitStorageSpec,GeneratedServiceConfigurationSpec}.scala` | unit-storage-boundary/unit-runner；无生产连接、非空suite、失败传播 |
| sbt/插件 | `build.sbt`、`project/plugins.sbt`、`project/build.properties` | play-service-build；测试FQN/目录和外部源码根同步 |
| ledger/anchors/四JSON | target 的 `truthsrc.ledger.json`、`anchors.json`、`.truthsrc/{canonical,request,compiled,inputs}.json` | apply/project-evidence；最终字节、ownership、stale拒绝 |
| 项目知识图、anchors临时文件 | `<projectDir>/.truthsrc/knowledge.sqlite`；`<outDir>/.anchors.json.tmp-<pid>-<uuid>` | knowledge-publication/anchor-atomic-write；snapshot与generation分开、wx/sync/rename、仅清理己有inode |

所有 B Scala 适用 [layout-and-style](../layout-and-style.md) §2 三层与测试根、§3 N1/N2 命名及 imports、§4/5 依赖/纯值与 I/O 边界、§7 每方法复杂度与120列目标、§8 最终字节后做 fingerprint/anchor。配置/SQL/proto/证据不硬塞业务包；但仍有唯一物理归属与写入者。本文未测量 CC，不把 String/Any dispatcher 当降低复杂度的办法。

## 6. 基准例外与冻结约束

本组只将传统 **39 模板族＋单列3扩展**作为 A 候选。`template/products/*`、Node 后处理、静态 scaffold 不增加这个计数；产品 Scala 源码不充当设计金样。

实际读到的 raw Scala 例外包括：

- `DomainServiceTemplate` 与 `InvariantRuleTemplate` 含 `???`/注释逻辑槽；不能把它们描述为全部业务已实现。
- `AggregateRulesTemplate` 具有明确 guard/参数/成功事件构造，但 RHS 本身仍来自模型代码槽；不是“全无源码字符串”。
- `AggregateBehaviorTemplate` 有 MANUAL 区及未建模时 `???`，raw query/transient/policy 分支不同。
- `AggregateConverterTemplate` 存在 BigDecimal→double、Option[List]缺席折叠等原始语义，不允许本组为了仿真而损失当前 exact/optional 合同。
- `ValueObjectTemplate` 含 Play JSON 格式、默认值与超过22字段分支；当前 formal 值对象不能仅因 class 名相同就称 parity。
- `ProjectionHandlerTemplate` 单工程默认仍含手写槽；多工程模板的具体 ViewMachine 分支不能冒作本银行单工程已实现内容。
- `ApplicationBootstrapTemplate` 的 raw DI/模块风格与用户三层覆盖规则不同，目标明确归 `infrastructure.bootstrap`。
- `InvocationHostTemplate` 是独立扩展且含具体 child/runtime/部署测试职责；本 formal 的部分 pipeline host 不证明整个扩展已经实现。它也不是无条件可复制的金样。

以下内容本阶段保持不变：业务稳定 ID、PB 字段号、PID 组成、serializer identifier/manifest、摘要格式、独立名义类型、溢出/精度/舍入与独立 oracle。源码命名改为 PascalCase/lowerCamelCase 不能反向更改这些身份。禁止合并不同事件协议、扩大 `GeneratedMessage` 绑定、`addExact→+` 或为降 CC 改为无类型业务路由表。

## 7. 未登记写入与补充来源

[projectCli](../baseline/js/lib/project/cli.mjs) 190–208 行实际创建项目图 store、发布 snapshot，生成/apply 后再发布 anchors。沿其调用读取以下**可变生产源码**，本组只读并在 JSON `extraSources` 登记准确 SHA，没有复制到任何 baseline：

- `lib/project/graph.mjs`：`projectGraphFile` 指定 `<projectDir>/.truthsrc/knowledge.sqlite`；`projectKnowledgeAst` 先 publishSnapshot；`publishProjectAnchors` 发布 generation/receipt。
- `lib/knowledge-sqlite.mjs`：真正的目录/数据库创建、schema、snapshot/node/relation/generation SQL 事务、CAS 更新与 close。
- `lib/products/journal-readside.mjs`：formal renderer 导入但固定基线漏捕获的 projectionStore 完整准入/有限索引合同。

SQLite 位于项目目录，不是生成 target 中四 JSON 的另一个名字。它可能在后续 source apply 失败前已有 snapshot，不应被描述为与整个输出文件集原子提交。planOnly 用内存图，不产生磁盘知识库。

[anchors terminal writer](../baseline/js/src/core/anchors.mjs) 574–608 行的临时文件是真实写入：wx/0600 → writeFile → fsync → close → 新鲜度与 inode 检查 → rename。失败仅可删除自己创建的 inode；该路径单列为 transient write，不增加长期业务产物数。

## 8. 明确未决项与实施前置

1. **Actor/规则胶水合同**：逐命令的纯参数、typed reply、新 State 成功回复、错误码/iMadzError、List/Vector 和 CommandHelper 三方法须由对应制品 owner 明确；不能将目前 Accepted(events) 当等价实现。
2. **聚合部署 profile**：本地 actor cache/ofUniqueId 与传统 sharding/typeKey/tags/retention/backoff 的选择须明确。不能用目录整改顺带改变 PID、实例所有权或恢复语义。
3. **Strict/Monarch ABI**：当前固定0.3.0 artifact pin 与真实 HostRequirements、deadline/admission、phase mapper/receipt、reconcile budget 要在获准的实施/运行窗口逐接口核对；源码 import 不证明所消费 JAR 可用。本入口没有 child 继承。
4. **Play 手写接口迁移**：Factory、Authority、Endpoint codecs/run、PageRenderer、生命周期清理与 route 参数映射要先固定。新的文件位置是规范建议，不代表用户批准新算法/接口。
5. **JDBC 边界**：repo port、Session 生命周期、commit异常结果未知、readside排空/外部资源所有权需专门裁定；保留现有 transaction/identity/freshness 语义，不把两个 JDBC profile 偷换。
6. **ABI/回锚迁移**：所有搬包和格式化必须先固定最终 bytes，再更新 imports/config/manifest/fingerprint/spans；不得保留旧 offset 假装有效。
7. **中央清单接续**：集成者决定 catalog 的知识图/临时写入登记，并补充三个 extraSources 固定快照；本组没有改 catalog、原852文件或任何中央账。
8. **验证缺口**：新同输入完整文件/construct/RHS对照、真实接口/行为/恢复、复杂度及稳定生成均未进行。测试源码与已有配置不能替代新的银行运行证据。

## 9. 可读业务路径

以声明驱动的读取顺序理解，而不是把生成文件数当进展：

- **写侧**：HTTP action → 外部 typed Endpoint 实现 → 应用 Actor Request → Rules/纯参数/Computations → 领域 Events → EventHandler 新 State → 明确 Reply。协议壳、规则算法与回复胶水各有 owner。
- **Saga**：完整 original/parent checkpoint → Host admission → durable association/intent → Strict coordinator → 注入 phase ports/权威 receipt → 持久身份和结果意图 → 权威校验后投递 → 交付确认；Monarch 只接受对应步骤的权威完成，不把超时或 derived mirror 当终局。
- **读侧**：明确 Journal → PID identity → 同序列 payload 检查 → PB/domain重建 → 同事务append/index/checkpoint → 带 freshness 限定的读取；启动和排空由唯一源生命周期 owner 控制。
- **文件证据**：固定产品/来源 → 完整 source plan → 受控 apply → 最终 ledger/anchors → 项目图 generation。任何一层的“可达/已保存”都不等于业务运行通过。
