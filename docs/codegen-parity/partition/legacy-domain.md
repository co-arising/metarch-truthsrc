# legacy-domain：传统 CLI 与同名产品子生产器的逻辑分区

状态：`content-specification`。仅保存分配的文档片段，未修改生成器、作者树、生成应用、catalog、baseline、ledger 或 anchors。没有运行应用、CLI、生成、编译、测试、typecheck 或服务；复杂度为 `not-measured`。

## 1. 范围、计数和证据

机器合同见 [legacy-domain.json](legacy-domain.json)。本组完整覆盖以下八个 producer 的 **34 条 producer-output 合同**，不是 34 个文件，也不是 34 个传统 Scala 族。

| Producer | catalog 输出合同数 | 两条实现路线 |
|---|---:|---|
| adapter-dsl | 2 | 独立 CLI；未进入产品子生产器 registry |
| aggregate-dsl | 9 | 旧 spec/render/CLI；现代 State + Actor renderer |
| command-dsl | 4 | 旧三方法 CommandHelper；现代纯 payload、事件构造与计算端口 |
| converter-dsl | 5 | 旧 ProtoConverters；现代 PB 图转换、codec、serializer、adapters |
| event-dsl | 1 | 独立事件 CLI；run-all 明确不接线 |
| invariant-dsl | 5 | 旧经验规则/Params/marker；现代已准入决策与 fold |
| proto-dsl | 5 | 旧 aggregate/shared/messages；现代 schema/build/config/tests |
| valueobject-dsl | 3 | 旧 VO + Play JSON；现代 nominal/record/exact VO |

分区结果为 **49 个逻辑条目：A 33，B 16**。其中包含 **8 个 catalog 未列的 parser 中间 spec 写出合同**，对应五个 B 逻辑条目：四份相同 binding-copy parser 共享一个条目，另外四种解析变换分别登记。它们不是八种应用源码。

- `catalogCoverage` 保留全部 34 个原始 outputId，没有遗漏、伪造 key 或用笼统类别代替构造。
- 已完整阅读并登记 **83 份固定源码/配置/样例**，每份 SHA-256 与 `baseline/index.json` 对应。所有引用的实际源码均已入原基线，`extraSources=[]`，没有另存快照。
- 逐 output 读了 emit、render/produce、共享 renderer、模板和终端 writer，而非按文件名自动分类。
- `implemented` 仅表示存在实际返回 entry/写文件的源码。它不表示 parser 输入完整、可编译、银行消费或运行通过。没有发现本组仅声明而完全没有发射体的 catalog 合同；发现的缺接线和语义问题如下单列。
- JSON/路径/哈希/覆盖关系的机械装配仅检查文档账，不构成新的 parity 或 behavior 验证。

## 2. 三种入口必须分清

### 2.1 旧 CLI 并非产品入口

八份 `generator.json` 都是 `name/version/baseline/entrypoint/golden` 的旧描述。独立 `emit.mjs` 可以读取 spec 并写文件，但不满足 [普通 manifest loader](../baseline/js/src/core/manifest.mjs) 的 `inputSchema/products/artifactKinds/output` 合同。

[run-all](../baseline/js/generators/run-all.mjs) 的 `runGen`（405–441）临时写 spec，调用 emit；它不是银行选定的正式产品入口。具体接线为 command 765–801、aggregate 803–882、invariant 884–956、valueobject 1089–1096、proto 1137–1294、adapter/converter 1794–1878。command 文件最终由 2033–2048 移入 `behaviors`。event-dsl 在 445–450 明确排除，事件由 Entity 发出。

### 2.2 六个同名现代子 producer 不调用旧 renderer

[scala-cqrs-domain/generate.mjs](../baseline/js/generators/scala-cqrs-domain/generate.mjs) 注册六个 `produce.mjs`，实际调用 `scala-cqrs-domain/render-*.mjs`。这是不同于旧 `render(spec)` 的实现：版本 1 的产品组是 dependencies/folds 4、decision 3；[produce-v2](../baseline/js/generators/scala-cqrs-domain/produce-v2.mjs) 则将 dependencies/folds 提升为 6、decision 为 4。

同一 renderer 可以共享逻辑条目，不能把不同产品版本等同成相同输入。`aggregate/aggregate-2` 是同一个物理 Actor 文件内的不同导航合同，不是两份 factory 文件。

### 2.3 银行继承链及覆盖点

固定 [银行 project 配置](../baseline/bank/truthsrc.project.json) 278–298 选择 `scala-cqrs-play-service`，包为 `example.bankwealth`，`verificationCases=[]`。实际继承链是：

`scala-cqrs-play-service/generate.mjs:16` → `createEffectRegistry('2')` → `applicationRegistry('2')` → 六个同 ID 子 producer。

| 银行中的子 producer | 实际选择，不可混称 |
|---|---|
| aggregate-dsl | service 19–20 **替换**为 `renderAggregateLayers`；其内部调用 `renderAggregate(..., true)`。不消费旧 CLI，也不消费基础 flat Actor 文件体 |
| invariant-dsl | service 21–22 明确调用 `renderInvariant(..., true)`；真规则、Params、旧包转发与 layered fold 是多个物理文件 |
| command/valueobject/converter | 复用现代 renderer；产品 pins 与 service 包装可不同，不会回到旧 emit |
| proto-dsl | schema 复用；build/config/tests 经 application、effect、service 逐层追加/改写 |
| adapter-dsl/event-dsl | 不在该 registry；不能由同职责现代 adapters 或事件字段倒推这两个旧 producer 被选中 |

[registeredProductProducer](../baseline/js/lib/products/generate-cli.mjs) 92–101 将 domain-kernel、aggregate-core、module-seams、persistence-readside、saga-monarch、play-application 等候选**独立注册**。可选择不等于自动进入银行。

本分区只登记所分配 producer 的 output keys。银行 layered 的额外 Entity 别名、Rules/Params/wrapper、EventHandler wrapper 和应用聚合层，应由 formal 分区用自己的精确 catalogRefs 归并；本组 flat 逻辑行不能顶替那些输出。`bankConsumption=inherited` 是同 ID 子 producer 层面，具体行中的覆盖/不选状态优先，绝非所有旧文件均消费。

## 3. 内容分类与复合文件拆分

### 3.1 `Protocol` 不能按名字全部算 Actor 协议

[旧 aggregate renderer](../baseline/js/generators/aggregate-dsl/render.mjs) 810–906 真正生成 typed `replyTo`、Commands/Replies 和 Effect handler alias，属于 A `application-protocol`。

[现代 renderCommand](../baseline/js/generators/scala-cqrs-domain/render-domain.mjs) 20–30 的同名 `domain/<A>Protocol.scala` 则包含：

- **B 纯命令输入**：`sealed trait Command` 与字段 case class，没有 ActorRef。
- **A 领域事件**：`sealed trait Event` 与事件载荷，属于 `domain-entity` 的事件部分。
- 共享头、package、object 边界及类型依赖只由 `legacy-domain/pure-protocol-assembly` 组装一次。目标分别是 `domain/invariant/params/<A>CommandParams.scala` 与 `domain/entities/<A>Entity.scala`。

不能为覆盖数字把纯 Command 注入 `replyTo`，也不能把全部 Protocol 挪到 application 就称分层完成。

### 3.2 现代 `CommandHelpers.scala` 不是 CommandHelper

[旧 command renderer](../baseline/js/generators/command-dsl/render.mjs) 有真正的 `toParam/createFailureReply/createSuccessReply`，为 A `command-helper`。现代同名文件实际拆为：

- **A `aggregate-rules-formal` 的事件构造 RHS**：`emit<Cmd>(state,p,hosts):Vector[Event]`；目标归 `domain/invariant/<A>Rules.scala` 的具名成功臂。它不提供 CommandHelper 三方法。
- **B 计算端口**：`trait <A>Computations` 与 companion；仅 hosts 为空才有 `none`。目标为 `domain/services/<A>Computations.scala`。这不是已生成的业务计算实现，也不充当 classic DomainService object 的算法覆盖。

共享 import/头/对象边界由 `legacy-domain/event-construction-assembly` 唯一拥有。实现端口与独立 oracle 均需保留，不能生成恒真或空结果来填满它。

### 3.3 现代 flat `Aggregate.scala` 的五种职责

[renderActors](../baseline/js/generators/scala-cqrs-domain/render-actor.mjs) 的物理文件包含：

1. A 应用 Request/Reply：Execute、GetState、Accepted、Refused，以及条件 Ingest 请求。
2. A 聚合入口/持久化装配：显式 PID、初态、hosts、EventSourcedBehavior、event/snapshot adapter。
3. A 命令行为：Rules 分发、拒绝不持久化、成功先 persist 后回复。
4. A 本地 Behavior factory：顶层 `AggregateFactory.create`，不是 classic sharding 初始化 ask。
5. B 外部授权接入：ExternalAuthority、authority 参数/require、稳定身份检查及授权后 ingest。

`legacy-domain/product-actor-assembly` 统一拥有容器；ActorRef 属协议，Effect 属行为，PersistenceId/EventSourcedBehavior 属装配，authority 初始化属接入。目标拆到 `application/aggregates`、`behaviors`、`factories` 和 `infrastructure/bootstrap`；不是只移动最显眼方法、遗留 imports 或初始化。

### 3.4 序列化不能合并成一个“其它”类

- `DomainConverters.scala` / `Part<N>`：**A** domain/PB 转换与 **B** exact wire/PO 文本 codec，分别登记；facade、extends、self-type、私有 helper、跨分片调用全部归 `legacy-domain/product-converter-assembly`。
- `DomainProtoSerializer.scala` / `Part<N>`：**B** 明确 PB 白名单字节 serializer，不是 EventAdapter。保留 `741000 + context index` 和原 manifest。
- `<A>Adapters.scala`：**A event-adapter + A snapshot-adapter**；拆文件后 import 分配、两个 object 的边界与具名 converter 调用由 `legacy-domain/product-adapters-assembly` 统一。
- PB schema 仍是 **A protobuf-schema**。旧 PO oneof 与现代节点 PB 图不是相同 wire；现代 `present`、`fN`、字段编号、精确文本不能为形似 raw 模板而改掉。

### 3.5 VO 的 JSON companion 是 A 的明确基准例外

catalog 的 `value-object-2` 描述不能替代源码裁定。[raw ValueObjectTemplate](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/ValueObjectTemplate.scala) 42–106 本来就发 Play JSON companion，因此本组把它列为 **A value-object 的 JSON 构造**，不是 HTTP DTO，也不是 B 兜底。

本角色拥有 Instant Format、OFormat 初始化、Reads/OWrites 与局部 json imports；VO case class/派生谓词仍是另一逻辑角色，由同一个 VO assembly 组合。raw 的框架依赖必须忠实承认；未经兼容裁定不能改变 companion 隐式发现。

## 4. 缺接线、坏实现与注释失真

| 位置 | 源码阅读确认的事实 | 处理边界 |
|---|---|---|
| aggregate legacy 847–851 / 948–1011 | 普通分支可合成 GetState，但 behaviorCases 只遍历原命令，未为合成命令补 handler | A 协议与行为接线差距；不假称查询实现完整 |
| aggregate legacy 994–997 / invariant legacy 1277–1297 | 注释说 withPost；实际 behavior 直接 runReplyingPolicy，没有调用后置检查方法 | 需裁定 persist 前后置检查接线、拒绝错误顺序 |
| aggregate legacy 1031 / 1119 | 初始化命令取字母序第一条；空 commands 未保护 | 需显式初始化语义，不能按名字猜业务 |
| invariant legacy 146–345 / 600–1016 | 存在固定 UUID 哨兵、枚举/VO表、guard 跳过、事件推导；事件构造会读 Instant.now | 对应职责仍为 A，但不是可复用纯规则或真实跨聚合验证 |
| invariant emit 8–9 | 先写真实规则后写 marker；outPath 若正是 `<A>Rules.scala` 会覆盖规则 | 提议工具 scratch receipt 替代，未更改 CLI |
| command parse 11–17 / render 19–36 | parser 只写旧单命令 shape，renderer 需要 commands/paramDefs/objectName | parser+emit 不构成完整 CommandHelper 生成链 |
| valueobject parse 10–17 | 丢 optional/defaultValue/knowledge | 只针对独立 parser，不是当前 run-all |
| run-all 376–394 / 1824–1837 | 当前已透传 defaultValue 和 parent/role/nature | 旧 VO/converter renderer 注释“仍未透传”过时，不能据注释报缺失 |
| valueobject legacy 138–140 / raw VO 64–69 | JS 大对象无默认 Option 用 asOpt，raw 用 as[T] | 错误/null吞没行为有差距，严格性变更需明确合同 |
| modern actor 23–24 | persist 后回 Accepted(events)，不调用新 State 的成功 Reply helper | 不能称等价 runReplyingPolicy；目标适配须保留真实回复语义 |

raw Scala 本身并非全部完成：InvariantRule/DomainService 有 `???`，EntityBehavior 有 helper 填空，CommandHelpers 有 MANUAL 三方法，AggregateBehavior 有 MANUAL apply。A 的职责归属不代表实现正确；本轮只用传统 39 族及三项单列扩展作为基准，不拿 `template/products/*`、人工补全例或 Node 后处理混入 raw 金样。

## 5. B 的具体目标与 fixture

下列均为建议规范，不是新接口或算法已获实施批准。所有 fixture 状态为 `specified-not-executed`。`app/<base-path>` 是本组显式单工程目标根；多模块选择另行裁定。

| B 职责 | 目标文件 | 必需 fixture / 质量重点 |
|---|---|---|
| 外部授权接入 | `app/<base-path>/application/aggregates/behaviors/<A>ExternalIngress.scala` | `parity-external-ingress-v1`：允许/拒绝、identity 顺序、构造求值顺序；§4.1/4.6、§5.5 |
| 纯命令参数 ADT | `app/<base-path>/domain/invariant/params/<A>CommandParams.scala` | `parity-pure-command-v1`：零字段、容器和名义类型；不引入 ActorRef；§2、§5.2 |
| 纯计算接口 | `app/<base-path>/domain/services/<A>Computations.scala` | `parity-computation-port-v1`：有/无 hosts、手写实现与独立 oracle；§4.1/4.6、§5.1 |
| 外部事件桥接 | `app/<base-path>/application/connectors/<A>ExternalEventBridge.scala` | `parity-external-ingress-v1`：成员投影与 nominal identity；§4.2、§5.2 |
| exact wire/PO codec | `app/<base-path>/infrastructure/persistence/converters/ExactValueCodecs.scala` | `parity-exact-codec-v1`：两种文本格式、负零/指数/scale/长度拒绝、跨分片调用；§5.6、§9 |
| PB serializer | `app/<base-path>/infrastructure/persistence/DomainProtoSerializer.scala` 与 `Part<N>.scala` | `parity-pb-serializer-v1`：精确白名单、manifest、65536/60000/128 边界；§8.4、§9 |
| legacy marker 替代回执 | `<spec-scratch>/invariant-dsl/<A>.emit-receipt.json` | `parity-emitter-receipt-v1`：目录/独立marker/真实规则路径碰撞；§2、§8 |
| 构建支持 | `build.sbt`、`project/plugins.sbt`、`project/build.properties` | `parity-domain-build-profile-v1`：domain/application/Play 版本与源根差别；§2、§8 |
| serializer 配置 | domain 的 `src/main/resources/application.conf`；Play 的 `conf/serialization.conf` | `parity-serialization-config-v1`：context、strict/effect hosts、include；§8.4、§9 |
| PB 往返测试源码 | `src/test/scala/<base-path>/infrastructure/persistence/GeneratedDomainRoundtripSpec.scala` | `parity-generated-test-source-v1`：非平凡默认/精确值/Play检查注入；不能替代独立oracle |
| Actor 查询/显式案例测试源码 | `src/test/scala/<base-path>/application/aggregates/GeneratedActorStateSpec.scala` | 同 fixture：拒绝/成功、同PID Actor重建、finally关闭；不声称跨JVM恢复 |
| 四份相同 binding-copy 中间 spec | `<spec-scratch>/<producer-id>/<input-id>.spec.json` | `parity-legacy-parser-v1`：逐字复制、非JSON输入也复制、两参数CLI；不进业务根 |
| aggregate/command/event/valueobject 四种 parser spec | `<spec-scratch>/<对应producer-id>/<input-id>.spec.json` | 同 fixture：旧payload形状、字段丢失、renderer输入错配；各自独立逻辑条目 |

所有 Scala B 同样遵守包与命名、依赖 imports、普通方法 CC≤5 目标和默认 120 行宽；没有任何“generated 代码豁免”。配置、proto、JSON、构建文件不伪装成 Scala 业务包。

## 6. 可读业务路径与不能推出的结论

固定银行例可从 [CreditBalanceProtocol](../baseline/actual-js/app/example/bankwealth/domain/CreditBalanceProtocol.scala) 的纯 `ReserveFunds(txid,resource,amount)` 出发，经 [CreditBalanceRules](../baseline/actual-js/app/example/bankwealth/domain/invariant/CreditBalanceRules.scala) 20–35 检查账户资源、CNY、正金额、已提交/已补偿/已预留的一致性与幂等，再检查可用余额。

成功臂调用 [CreditBalanceCommandHelpers](../baseline/actual-js/app/example/bankwealth/domain/CreditBalanceCommandHelpers.scala) 15 行的事件构造，所需 `BalanceAfterReserveFunds` 只在 9 行声明为调用者计算接口。事件到状态的纯 fold、Actor 的持久化与回复、PB journal 边界是不同职责，不能因同一文件名或目录合并理解。

这里没有验证这条业务路径运行通过。银行 `verificationCases=[]`；所生成的 query-only 端口在被调用时会抛错，同 ActorSystem 内 stop/restart 案例也不等于真实 JVM 重启恢复。

## 7. 集成与真实未决项

1. **Formal/legacy 所有权归并**：保留本组 34 个原 output refs，按真实共享 renderer 合并逻辑角色；银行替换的 layered 输出不能由 flat 行顶替。全局 42 族缺项反查由集成者负责。
2. **协议/Helper 迁移合同**：明确纯 CommandParams、Actor Requests、RuleParams、Computations 的边界；确定 Accepted(events) 与目标新 State Reply 的兼容关系，不能把接口整改写成无行为变化。
3. **旧规则语义**：固定哨兵、跳过的 guard、Instant.now、GEN_SKIPPED、后置检查是否接线及初始化命令选择，需要逐项裁定；不因 raw 也有填空就将坏代码标为通过。
4. **Wire/稳定身份**：旧 PO oneof 和现代 PB graph 不强行同构；PB 字段、PID、serializer identifier/manifest、nominal、scale/precision、overflow、稳定 identity 字符串全部不变。
5. **中间 writer 与来源真实性**：marker 覆盖真实 Rules 的冲突和 parser/renderer shape 不匹配需后续修复；run-all 的 scratch、静态 scaffold、core 的 ledger/anchors 写出由其所属分区归并，不算本组新增业务源码。
6. **测试根与复合文件 assembly**：迁移 package 必须同步测试发现/显式 runner；精确 codec 与 converter parts 的可见性和共享 import/init 必须有一个 owner；当前没有运行可验证这些建议。

本轮仅落盘内容有据的分区。全部实施、同输入完整文件对账、编译、独立行为验证、复杂度度量和回锚迁移仍未执行。
