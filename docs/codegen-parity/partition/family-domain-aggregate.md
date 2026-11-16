# family-domain-aggregate：领域内核与聚合候选的逻辑制品分区

状态：`content-specification`。仅文档片段；未修改生成器、catalog、基线、作者树、生成应用、ledger 或 anchors。未运行应用、CLI、生成、编译、typecheck、测试或服务，没有新的验证结果。

机器账见 [family-domain-aggregate.json](family-domain-aggregate.json)。本组严格限定两个 producer：

| producer | catalog 输出合同 | 静态调用边界 | 银行选择 |
|---|---:|---|---|
| `scala-cqrs-domain-kernel-v1` | 12 | 显式 `scala-cqrs-domain-kernel@1`；纯内核、PB glue、构建与空状态字节测试 | `not-selected` |
| `scala-cqrs-aggregate-core-v1` | 21 | 显式 `scala-cqrs-aggregate-core@1`；继承内核发射器，增加纯规则/折叠与 Actor 聚合 | `not-selected` |

**33 条 producer-output 全部保留原 ID，并映射到 32 个逻辑项：A 16、B 16。** 其中两项 B 是公共 apply writer 的派生证据；32 不是物理文件数，不是独立模板数，也不是 Scala 42 族的通过数。A 涉及 13 个不同传统族；其余族的全局反查交给集成者。没有将实现差距转移到 B 来改善覆盖数字。

## 1. 实际入口、继承与来源边界

已读两个 `generate.mjs`、完整 `build-models.mjs`、`render.mjs`、所有相关模板及表达式、serialization/ABI 支撑。JSON 登记了 62 个实际阅读的固定来源，完整文件字节数和 SHA-256 来自并逐字节核对 [baseline/index.json](../baseline/index.json)。少量大公共文件明确记录所读区间，不冒称全文阅读。所需来源均已在原基线，本组 `extraSources` 为空；没有新建补充快照。

真实链路是：

```text
registeredProductProducer（显式目录 realpath 匹配）
  → 对应 generate 的 targetProfile 检查
  → planProductSet 的唯一 domain-kernel / aggregate-core 子 producer
  → buildModels → productionJobs / render → renderJobs
  → sourceEntry / aggregateSourceEntry（最终 UTF-8 content 与 codeMappings）
  → generateProductCli 非 --plan 分支 → applyEntries
```

入口及 writer 证据：

- [kernel generate](../baseline/js/generators/scala-cqrs-domain-kernel-v1/generate.mjs) 12–27 行；[core generate](../baseline/js/generators/scala-cqrs-aggregate-core-v1/generate.mjs) 11–24 行。
- [注册与终端入口](../baseline/js/lib/products/generate-cli.mjs) 66–102、110–146 行；[计划边界](../baseline/js/src/core/product-plan.mjs) 71–105 行。
- [kernel render](../baseline/js/generators/scala-cqrs-domain-kernel-v1/render.mjs) 18–86 行；[core render](../baseline/js/generators/scala-cqrs-aggregate-core-v1/render.mjs) 15–35 行。
- [source entry](../baseline/js/generators/scala-cqrs-domain-kernel-v1/entry.mjs) 17–19、40–65 行；[apply writer](../baseline/js/src/core/generate.mjs) 134–269 行。

这些读取证明静态注册和实现位置，不证明某输入已成功通过准入。`planProductSet` 本身包含重编译比对和两次独立产物计划；本阶段没有调用它。

### 真实继承不能按版本号或目录名猜测

Core 调用一次 `buildKernelModels`，复用 kernel `productionJobs` 和 PB 测试模板；它**不调用 kernel.generate，也不继承 kernel 的 build 模板**。因此：

- 值、纯 payload、State、Params、计算端口、exact codec、PB 和 converter 等相同发射器共享逻辑项，并列出两个精确 `catalogRefs`。
- Core 对继承项统一使用 `aggregateSourceEntry`，生成头 owner 变为 `scala-cqrs-aggregate-core:1`；共享逻辑项不表示完整文件字节相同。
- 两个 build 模板分别登记，即使 `build.properties`、`plugins.sbt` 的有效配置相同也不伪称继承。Core 多出 Akka 依赖、protoc 3.21.9 和非并行测试配置；kernel 没有显式 protocVersion。
- Core 拒绝所有 external producers，并要求每个 Event 有本地 Command producer；kernel 的结构产品一致性检查不等于执行外部事件授权。

### 银行不是这两个 family 的消费者

固定 [银行配置](../baseline/bank/truthsrc.project.json) 与实际 `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/truthsrc.project.json` 字节一致；278 行选择 `scala-cqrs-play-service`。

该入口通过 [service generate](../baseline/js/generators/scala-cqrs-play-service/generate.mjs) 16–23 行的 **`createEffectRegistry('2')`** 继承，并覆盖 `aggregate-dsl` / `invariant-dsl`。再追到 [produce-effect](../baseline/js/generators/scala-cqrs-application/produce-effect.mjs) 6–26 行及 [applicationRegistry](../baseline/js/generators/scala-cqrs-application/produce.mjs) 1–5、17–29 行，调用的是 `scala-cqrs-domain` 路径的 renderers，不是本组 family1/2。

独立注册 ≠ 银行消费 ≠ 运行通过；本组不退役这两个 current 候选，也不授权银行切流。

## 2. 核心 A/B 拆分

以下 `<basePath>` 是显式 Scala package 的路径形式。当前路径中的名字来自模型最终解析结果，不能强行加固定后缀。目标保留候选 `modules/kernel` / `modules/glue` 物理根；raw Scala 的 `app/` 根是另一 profile，不能混称同输入字节对账。

| 当前内容 | 分类与对应 | 内容依据及目标 |
|---|---|---|
| 非 wire/PO 的 value case class、exact 构造校验与算术 | A `value-object` | 保留 `kernel/.../domain/values/<Value>.scala`；名义类型、精度、unit 检查不简化掉 |
| codec 显式引用的 wire 与 PO 文本 case class | B，两项 | 它们虽然使用同一 valueTemplate，职责是编码表示。建议迁到 `glue/.../infrastructure/serialization/values/<WireValue 或 PoValue>.scala`，须先解决纯 kernel 是否引用它们 |
| `Protocol` 内纯 `Command` 与其 case classes | B | 迁到 `kernel/.../domain/invariant/params/<Aggregate>Commands.scala`；无 ActorRef，不能标成应用 Actor 协议 |
| 同一 `Protocol` 内 Event 族与 case classes | A `domain-entity` | 与 State 组装到 `kernel/.../domain/entities/<Aggregate>Entity.scala` |
| 独立 State 与 companion.empty | A `domain-entity` | 同上；保留显式 defaults，不复制 raw 的首字段 ID 与 neutral 值推断 |
| 每命令 `(state, command, hosts)` Params | A `aggregate-rules-formal` | raw formal 模板本来就发 Params；建议并入 `kernel/.../domain/invariant/<Aggregate>Rules.scala` |
| Computations trait 及按 inputDependencies 排列的方法 | B | 建议 `kernel/.../domain/services/<Aggregate>Computations.scala`；是 typed 计算端口，不是已完成 DomainService 算法 |
| ExactValueCodecs 的 canonical text 双向转换 | B | 保留 `glue/.../infrastructure/serialization/ExactValueCodecs.scala`；与 PB converter 分责 |
| PB schema / DomainConverters | A `protobuf-schema` / `proto-converter` | schema 保留现有 wire identity；converter 建议归 `glue/.../infrastructure/persistence/converters/DomainConverters.scala` |
| Rules 内逐命令 guards / 纯 decide dispatcher | A `aggregate-rules-formal` / B | 规则留 `<Aggregate>Rules.scala`；typed dispatcher 建议独立 `<Aggregate>Decision.scala`，不使用 String/Any 分发表 |
| 名为 CommandHelpers 的纯事件构造方法 | A `aggregate-rules-formal` 的 emission 部分 | raw formal 成功臂也构造事件；不是 A `command-helper`。建议与规则同文件组装，或在该文件内保留具名私有方法 |
| EventHandler 的纯 event fold | A `event-handler` | 保留 `domain/entities/behaviors/<Aggregate>EventHandler.scala`，逐 RHS 保留 pre-state、溢出及一次求值 |
| ActorProtocol | A `application-protocol` | 现有 Execute/GetState 与 typed replyTo 真正面向 Actor；目标按 Commands/Replies/Handler 分段 |
| Aggregate.scala 的 provider / 实际命令处理体 | A `aggregate-root` / A `aggregate-behavior` | 拆到 `application/aggregates/<Aggregate>Aggregate.scala` 与 `application/aggregates/behaviors/<Aggregate>Behaviors.scala`；不能把实际行为责任漏掉 |
| Factory / Bootstrap | A `aggregate-factory` / `bootstrap` | Factory 改到 `application/aggregates/factories`；Bootstrap 保留基础设施，但完整 raw sharding/生命周期仍缺 |
| ActorRepository trait+Handle / 本地缓存实现 | A repository port / implementation | 接口归 `application/aggregates/repository`；实现归 `infrastructure/repositories/aggregate`；不是后续 family 的运行时中立业务 Repository |

### 单一文件组装 owner

JSON 的 `physicalAssemblies` 给出源文件和目标文件各自唯一 owner；`target.assemblyOwner` 表示目标责任。

1. **纯 Protocol 混合文件**：`protocol-file-assembly` 独占现有生成头、package、values imports、object 定界；Command 与 Event 声明范围互斥。目标 Command 文件仍由它组装；目标 Entity 由 `entity-file-assembly` 合并 Event 与 State，包含全部 defaults/empty 初始化和导入重算。
2. **Rules 混合文件**：当前 `rules-file-assembly` 独占头、imports、object；`decide` 和逐命令规则分别分区。目标 `<Aggregate>Rules.scala` 由 `formal-rule-file-assembly` 合并 Params、guards、emissions；目标 Decision 文件由 `rules-file-assembly` 组装。
3. **Aggregate 混合文件**：`aggregate-file-assembly` 一次组装。根项拥有头、package、所有 imports、object、handler 签名和构造时 `hosts != null`；行为项拥有返回 lambda 的全部 match/persist/reply 方法体。拆开后仍不允许两个 writer 抢同一输出。
4. **本地 Repository**：构造器、双 Map、closed/inOperation、同步与重入检查、get/close、失败恢复和 Actor 所有权注释均归仓库实现。它们是同一 A 责任，不把资源状态当“其它代码”遗失。

## 3. 内容级差距与必须保留的语义

### 不是应用 CommandHelper，也没有完整的新 State 回复接线

[纯 helpers](../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/command-helpers.mjs) 14–25 行只发 `emitMethod(state, command, hosts): Vector[Event]`。Host 调用按实际 occurrence 和 `inputDependencies` 顺序求值；模型依赖去重不意味着 memoization。

[Aggregate](../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/aggregate.mjs) 13–15 行实质为：

```scala
case Right(events) =>
  Effect.persist[Event, State](events)
    .thenReply(replyTo)(_ => Accepted(events))
```

这是对模板局部结构的缩写，不是银行生成实例，也不是同输入 diff。源码使用 `thenReply`，但回调忽略新 State。它不是用户要求的 `toParam`、`createFailureReply`、`createSuccessReply` 三方法，也没有 `runReplyingPolicy(...).replyWith(command.replyTo)` 接线；更不能等同于 `replyWithAndPublish`。

对应 A 差距保持开放，不能因为已有可调用 Actor 方法就标为已追平。未来要按 [layout-and-style §6](../layout-and-style.md) 明确每命令回复、新状态读取及 common artifact/API，不猜测库消费版本可用。

### Fold、exact 与 nominal 不能为了好看而改变

- [event-handler](../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/event-handler.mjs) 9–24 行从一个 pre-event State 计算所有 `state.copy` RHS。
- [expressions](../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/expressions.mjs) 140–155 行覆盖 set、put、remove、put-all、remove-all、money-apply、integer-apply。`put-all` 即便 key 集合为空也先计算 value 一次；`addExact/subtractExact` 不可换普通 `+/-`。
- exact 中 UNNECESSARY scale、precision、UNLIMITED MathContext、unit 一致性、canonical 文本拒绝都属于语义。`coreLeftN/coreValueN` 等可以改善命名，但不能改变一次求值和异常顺序。
- wire、PO、domain 必须保持独立 nominal identity。移包须先检查纯内核依赖，不能生成 kernel→glue 倒依赖，也不能用 type alias 合并三者。

### 本地聚合宿主只是有限实现

[bootstrap](../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/bootstrap.mjs) 12 行实际装配 `EventSourcedBehavior`，依次接入 event 与 snapshot adapters；它不创建 ActorSystem、不 spawn、不注册 serializer、不调用 sharding.init，没有 tagger、retention 或 backoff。

[repository](../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/repository.mjs) 11–20 行的完整实现必须保留：先成功完成 identity/behavior/spawn，再登记双 Map；异常后可重试；get/close 串行并拒绝回调重入；close 只清本地句柄，不停止已交付 Actor。它不提供 deathwatch、淘汰或分布式 PID 唯一性。

这些仍归真实 A 职责的有限变体；不能假称 raw 集群 Factory/Bootstrap/Repository 的完整实现，也不能在文档整理中自动增加生命周期算法。

## 4. B 的具体落点与 fixture

所有路径相对将来显式 `outDir`，不是当前文档写目录。每项的完整字段、来源、变体与依赖在 JSON；这里不重复机器账。

| B 责任 | 目标路径 | 拟定 fixture 与重点 |
|---|---|---|
| wire / PO 文本表示 | `modules/glue/src/main/scala/<basePath>/infrastructure/serialization/values/<WireValue 或 PoValue>.scala` | `parity-family-exact-representations-v1`：三种 nominal 区分、字段重命名、kernel 引用边界 |
| 纯 command payload | `modules/kernel/src/main/scala/<basePath>/domain/invariant/params/<Aggregate>Commands.scala` | `parity-family-payload-separation-v1`：Command/Event 不混、传播参数顺序、跨聚合同名 |
| Computations 端口 | `modules/kernel/src/main/scala/<basePath>/domain/services/<Aggregate>Computations.scala` | `parity-family-computations-v1`：空/多 host、交错输入顺序、重复 occurrence；实现与 BDD 独立提供 |
| exact codecs | `modules/glue/src/main/scala/<basePath>/infrastructure/serialization/ExactValueCodecs.scala` | exact fixture：minor-units/fixed-decimal、不同 precision/scale、负零/前导零/越界/unit |
| typed decision dispatch | `modules/kernel/src/main/scala/<basePath>/domain/invariant/<Aggregate>Decision.scala` | `parity-family-formal-decision-v1`：穷尽 typed match、拒绝/空成功/事件成功、导入冲突 |
| 两个 profile 各自三份构建文件 | `build.sbt`、`project/build.properties`、`project/plugins.sbt` | `parity-family-build-profiles-v1`：kernel 无 Akka、core 明确 Akka/protoc/非并行测试、合法生成头；互斥输出目录 |
| PB 空状态字节往返测试 | `modules/glue/src/test/scala/<basePath>/infrastructure/persistence/converters/<State>RoundTripSpec.scala` | `parity-family-protobuf-v1`：实际 encode→bytes→parseFrom→decode，另立非空/畸形数据期望 |
| 空历史回放测试 | `modules/glue/src/test/scala/<basePath>/domain/entities/behaviors/<Aggregate>ReplaySpec.scala` | `parity-family-folds-v1`：保留 empty-history 名称；非空 fold/溢出/交叉字段须独立 oracle |
| apply ledger | `truthsrc.ledger.json` | `parity-family-apply-evidence-v1`：各写入 outcome、最终 bytes、ownership、失败顺序 |
| anchors 与瞬态临时索引 | `anchors.json`，同目录 `.anchors.json.tmp-<pid>-<uuid>` | 同一 evidence fixture：UTF-8 spans、MANUAL 最终字节、索引并发变化、inode/rename 失败 |

B 遵守 [layout-and-style](../layout-and-style.md) §2 的层次和物理根、§3 的集中命名/类型/导入、§4–5 的依赖与副作用边界、§7 的行宽和逐方法复杂度目标、§8 的最终字节与回锚顺序。生成 Scala imports 按 Scala/JDK、框架、项目依赖分组排序去重。JSON、properties 和构建文件不伪造业务 package。

所有 fixture 均为 **`specified-not-executed`**。现有 PB 测试只覆盖 declared empty State；ReplaySpec 只有空 Event Vector，连非空 fold 分支都不进入。生成测试源码不等于执行证据或独立业务 oracle。

## 5. Catalog 描述漂移与未列出的真实写出

逐源码阅读发现三项描述差异，均未更改 catalog：

1. `protobuf-schema` 的 shape 称文件名来自 protobuf package；[kernel build-models](../baseline/js/generators/scala-cqrs-domain-kernel-v1/build-models.mjs) 364–365 行实际是 **`context + '_domain.proto'`**。PB package 是另一独立输入。
2. `exact-value-codec` 的 descriptor ID/version 被保留在模型/准入，不是生成 Scala 的常量；[exact-codecs](../baseline/js/generators/scala-cqrs-domain-kernel-v1/templates/exact-codecs.mjs) 全文没有发出这些常量。不能把模型携带误写成源码公开 API。
3. `aggregate-root` 描述说 Aggregate 装配 pure fold；实际 Aggregate 只输出 commandHandler，fold 接线在 Bootstrap。机器账按实际职责拆分而非复述描述。

此外，两个 producer 的 33 条输出合同不列公共 `applyEntries` 的 ledger 和 anchors。已经登记 **3 个写出形态、2 个 B 逻辑项**：ledger、最终 anchors、anchors 的独占临时文件。它们不增加本组 catalogOutputCount；也不声称整个全局 catalog 都漏掉这些公共责任。集成者必须跨组去重。

公共 writer 先写源文件，再写 ledger，最后原子提交 anchors；不是跨文件事务。临时索引采用 `wx`、0600、sync/close、freshness 与 inode 检查、rename，失败只清理自己拥有的 inode。本轮没有触碰这些文件，也没有将它们复制到文档目录。

## 6. Raw Scala 基准例外与未决事项

采用 [scala-artifacts.json](../scala-artifacts.json) 的 **39 传统族 + 3 扩展**。`template/products/*` 不是金样，人工 curated 样例不是本次新生成结果。

重要 raw 例外已直接阅读：

- `ValueObjectTemplate` 自带 Play JSON companion；当前纯 kernel 没有。它是必须解释的依赖/分层差异，不应为了形似而把 Play 注入领域内核。
- `DomainEntityTemplate.empty` 可推 neutral 值，并有无法推导时的 `???`；当前 family 明确要求全字段 authored defaults，不能退回猜值。
- `DomainServiceTemplate` 和普通 `InvariantRuleTemplate` 有 `???` 算法槽；本组 Computations 仅声明接口，不冒充填完算法。
- formal `AggregateRulesTemplate` 本来就负责 Params、顺序 guards 与 emission，因此本组 Params/规则/纯事件构造对应同一 A 族；退役 Scala Policy 不参与归类。
- `CommandHelpersTemplate` 的三方法有 MANUAL 槽；当前纯 emit 方法不是对应实现。
- raw converter 有 `BigDecimal.doubleValue`、`Option[List]` 的缺席折叠等语义；不得以复刻 raw 排版为由复制有损编码。
- raw EntityBehavior 的 fallback 与算法槽、Bootstrap 的 sharding/tag/retention/backoff，均须与候选真实能力分开比较。

实施前仍需裁定的具体问题：

1. 应用每业务命令的参数、错误类型、成功回复及其新 State 来源；common `runReplyingPolicy` 消费 artifact/API 与发布/不发布边界。
2. 纯 Command、Params、typed dispatcher 的最终接口粒度，以及 Entity 内嵌 State/Event 的 FQN 迁移；不能改业务 ID 或持久化身份。
3. wire/PO 移包时 kernel 是否允许引用这些表示；若现有签名引用，先设计边界，不直接制造反向依赖。
4. Computations 逐方法的真实实现、独立 BDD 和 host 稳定身份语义；不能用固定成功值补齐。
5. raw 集群 root/factory/bootstrap 与候选本地显式 PID/adapter/缓存接口的差异如何保留或扩展；禁止自动推 PID、补退避或改 serializer。
6. PB 文件/descriptor、converter 公开 ABI 与 raw per-aggregate/shared 分区的迁移方案；保持 PB 字段号、名义类型、exact 及溢出合同。
7. 62 个来源与 33 条覆盖的机械对账只完成文档指向；同输入完整产物对账、复杂度测量、行为/资源失败验证均未运行。后续需独立授权的验收窗口。

以上是文档完整度与真实差距，不是 parity-PASS、behavior-PASS 或银行消费完成声明。
