# formal-domain：领域入口逻辑制品分区规格

状态：`content-specification`。本组只对应 `scala-cqrs-domain`、`scala-cqrs-domain-v2`；不修改生成器、原 catalog、基线、作者树、应用或任何运行回执。

机器合同见 [formal-domain.json](formal-domain.json)。本组覆盖 **2 个 producer、40 条 producer-output 记录、33 个逻辑项（A 16、B 17）**。A 对应 13 个传统 Scala 族的部分职责，并不表示这些族完整实现。数字不是物理文件数、同输入比较结果或运行通过数。`catalogCoverage` 无未映射项；接口和实施决策仍有明确未决项。

## 1. 来源、入口与版本边界

已完整阅读两入口、六个 v1 子 producer、v2 registry，以及本组 state/domain/actor/value/expression/serialization/adapter/scaffold/test renderer 和 state model/template。共享 writer 读取了 `applyEntries` 完整文件及 anchors 的完整 terminal writer 区间；不将后者其余未读函数标成已审阅。所读固定副本逐文件保留原路径、完整 bytes、SHA-256 和符号行号；不是只引用 catalog 描述。

主要固定入口：

- [domain v1 generate](../baseline/js/generators/scala-cqrs-domain/generate.mjs)，9–20 行：六个真实 `produce` 组成 registry，交给 `planProductSet`。
- [domain v2 generate](../baseline/js/generators/scala-cqrs-domain-v2/generate.mjs)，4–7 行：明确要求 `scala-cqrs-domain@2`，使用 [producerRegistryV2](../baseline/js/generators/scala-cqrs-domain/produce-v2.mjs)。
- [公共注册入口](../baseline/js/lib/products/generate-cli.mjs)，92–102 行：按 shipped directory 的 realpath 选择实现，不执行用户 JSON 指定的任意代码。
- [planProductSet](../baseline/js/src/core/product-plan.mjs)，71–105 行：源码中的准入包括完整编译结果再编译一致性、精确产品版本、restricted products、footprint、确定性和依赖闭包。**本轮没有调用它。**

| 维度 | domain v1 | domain v2 | 银行选择 |
|---|---|---|---|
| generator 目录 | `scala-cqrs-domain` | `scala-cqrs-domain-v2` | `scala-cqrs-play-service` |
| targetProfile | `scala-cqrs-domain@1` | `scala-cqrs-domain@2` | `scala-cqrs-play-service@1` |
| decision / dependencies / folds / external-events | 3 / 4 / 4 / 1 | 4 / 6 / 6 / 2 | 对应 v2 的产品版本，另有应用产品 |
| renderer 布局 | `layered=false` | `layered=false` | 聚合入口替换，规则 `layered=true` |
| standalone Actor externalIngress | false | false | 不使用本组 standalone Actor 原体 |
| 构建 | sbt 1.11.7、Scala 2.13.14、Akka 2.6.20 | 同左 | service 包装改 sbt 1.4.9，并追加 Play 等 |

两 domain manifest 的 `name` 都是 `scala-cqrs-domain`，只有 version 为 1/2。`naming.entry` 的 generated header 又固定写 `scala-cqrs-domain:1`。因此不能从源码头判定消费 profile，也不能认为两个目录天然拥有独立的输出目录所有权。

相同逻辑项共用一行的依据是实际调用相同 renderer、相同非 layered/externalIngress 分支；JSON 精确列出两份 catalogRefs。**产品版本不同仍保留在 profileMatrix，不声称两版本输入语言相同。**

## 2. 银行继承链不能简化为“domain v2 被运行”

[银行固定配置](../baseline/bank/truthsrc.project.json) 278–299 行选择 `scala-cqrs-play-service`，包为 `example.bankwealth`，`verificationCases=[]`。本轮只读计算了当前配置 SHA，与固定副本相同：`ae42876f8cd46d75372378fc993595ecff5dd65755e98adc045ff22597c3e691`。

真实继承链是：

```text
scala-cqrs-play-service.generate
  → createEffectRegistry('2')
    → applicationRegistry('2')
      → 共享 domain renderers
```

证据为 [service generate](../baseline/js/generators/scala-cqrs-play-service/generate.mjs) 16–58 行、[effect registry](../baseline/js/generators/scala-cqrs-application/produce-effect.mjs) 6–27 行和 [application registry](../baseline/js/generators/scala-cqrs-application/produce.mjs) 17–31 行。

必须保留以下区别：

1. `aggregate-dsl` 被替换为 [renderAggregateLayers](../baseline/js/generators/scala-cqrs-play-service/render-aggregate-layers.mjs)，不是本组 `renderActors`。其 state 路径还调用 `renderAggregate(..., true)`，生成 Entity aliases/empty；本组直接入口只发普通 State。
2. `invariant-dsl` 调 `renderInvariant(..., true)`：增加 RuleParams、实际 invariant 文件和旧 domain wrapper；fold 同样有实际 behavior 文件与 wrapper。这些归 service 变体，不能报成本组两个 standalone producer 的未编目写入。
3. command/value/converter/adapters 继续复用同 renderer。scaffold 经过 application/effect/service 多次包装：运行依赖、serializer 配置、测试初始化和 sbt 设置均可能变化；配置最终改放 `conf/serialization.conf`。
4. family 候选在公共注册表独立登记。`domain-kernel-v1`、`aggregate-core-v1` 等不能因为已注册就算银行继承或消费。
5. JSON 中 v2 的 `bankConsumption.status=inherited` 只描述同版本子 renderer 复用；不表示银行直接选择 `domain-v2.generate`。v1 产品版本未选。源码可达、银行配置选择、现存生成物、运行通过是四种证据。

## 3. 按内容拆开复合文件

`physicalAssemblies` 为每个当前容器指定唯一协调 owner；逻辑项再逐构造指定目标文件和 imports。下表不重新复制全部机器账。

| 当前容器 | 真实职责分区 | 唯一当前协调 owner / 目标 |
|---|---|---|
| `{A}Aggregate.scala` | A application-protocol：Request/Reply；A aggregate-root：PID、require、EventSourcedBehavior、adapters；A aggregate-behavior：查询/决策/persist/reply；A aggregate-factory：独立 Factory object | root 协调完整 header/package/imports/object；目标为 `application/aggregates`、`behaviors`、`factories` 的独立文件 |
| `{A}Protocol.scala` | **B 纯 Command 参数 ADT**；A domain-entity 的 Event ADT | pure-command-payload 协调原容器；命令进入 `domain/invariant/params/{A}Commands.scala`，事件进入 `domain/entities/{A}Entity.scala` |
| `{A}CommandHelpers.scala` | A domain-service 的抽象 Computations/companion/none；A aggregate-rules-formal 的成功事件构造 RHS | rule-emission 协调原 header/import/object；Computations 入 `domain/services`，emit RHS 回 formal Rules |
| `{A}ExternalEvents.scala` | B output→event 桥；B 有序稳定身份提取器 | bridge 协调原容器；两项进入 `application/aggregates/behaviors` 的具体文件 |
| `DomainConverters.scala` 与 Parts | A proto-converter 的节点/容器转换；B exact 文本及 wire/PO codec | converter 协调 facade/trait/self type/header；B 包含 facade 和每个 Part 中所有重复 private helper，不能漏掉 |
| `{A}Adapters.scala` | A EventAdapter；A SnapshotAdapter | event-adapter 协调原合并 imports；目标各自位于 `infrastructure/persistence` |
| `GeneratedActorStateSpec.scala` | B query-only 测试；B verificationCases 命令与同 PID replay 测试 | query-test 协调原 suite/imports；每个 test 完整持有 ActorTestKit 的 try/finally；目标有独立包和测试文件 |

这里最容易发生的误判是“CommandHelpers 文件已有，所以 command-helper 族已实现”。[renderCommand](../baseline/js/generators/scala-cqrs-domain/render-domain.mjs) 31–42 行只输出计算接口和 `Vector(Event(...))` 构造方法；没有 `toParam`、`createFailureReply`、`createSuccessReply`。

事件构造分入 A `aggregate-rules-formal`，依据是 [传统 AggregateRulesTemplate](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateRulesTemplate.scala) 48–51 行的成功 emission 职责，而不是方法名称。Computations 分入 A `domain-service` 是**纯计算能力的部分对应**，不是已经生成算法实现。普通、非 formal 的 `invariant-rule` 也不能用同一份 formal guards 重复充数；缺项交中央按 42 族反查。

### 明确的结构差距

- standalone Actor 采用 `Execute(Command, replyTo)` 后再嵌套 match，成功 `persist(events).thenRun(_ => Accepted(events))`。这有真实 A behavior 职责，但不是 `runReplyingPolicy(...).replyWith(...)` 或新 State 驱动的成功回复。
- State 与 Event 当前分居 State/Protocol，且 nominal 字段大量 FQN。目标需要 Entity 的完整声明所有权和集中 imports；不能只加 alias 文件宣称完成拆分。
- Rules 以 `Either[String, Vector[Event]]`、顺序 early return 实现 reject/succeed-empty；没有传统 Params/InvariantRule/iMadzError 接口。双重否定由表达式树保真处理，不对生成源码做 regex 清洗。
- Fold 的 typed `nextN` 按赋值顺序求值再 `state.copy`。只有证明无跨字段/异常次序影响时才能内联；保留 `addExact/subtractExact`、exact plus/minus 和 put-all 的一次求值。

## 4. 所有 B 都有具体目标和 fixture

以下 `P` 表示 `app/{basePath}/`，`T` 表示 `src/test/scala/{basePath}/`；仅为阅读缩写，JSON 已逐行给完整路径。

| B 职责 | 具体目标 | fixture 要求 |
|---|---|---|
| 纯领域命令参数 | `P/domain/invariant/params/{Aggregate}Commands.scala` | `parity/domain-payload-boundary-v1`：纯参数、领域事件、Actor wrapper 三者分离，前两者不得引 ActorRef |
| 外部 output→event | `P/application/aggregates/behaviors/{Aggregate}ExternalEventBridge.scala` | `parity/domain-external-output-v1`：多 slot、空集合不发、standalone 不自动获得 ingress |
| 外部稳定身份 | `P/application/aggregates/behaviors/{Aggregate}ExternalIdentity.scala` | 同上：复合 key 顺序、nominal `.value` 解包，不更改摘要或业务身份 |
| exact wire/PO 表示类型 | `P/infrastructure/persistence/converters/{WireType}.scala`、`{POType}.scala` | `parity/domain-exact-codecs-v1`：两个独立 nominal，minorUnits/currency 或 value:String；不能合并为 alias |
| exact 文本 codec | `P/infrastructure/persistence/converters/ExactValueCodecs.scala` | 同上：minor/fixed-scale 分支、负零、指数、前导零、长度、scale、单位以及分片调用 |
| Akka PB serializer | `P/infrastructure/persistence/DomainProtoSerializer.scala` 和 `DomainProtoSerializerPart{n}.scala` | `parity/domain-serializer-boundaries-v1`：具体 class/manifest 白名单、unknown 拒绝、短/长包名和分片边界 |
| sbt 项目接线 | `build.sbt` | `parity/domain-standalone-build-v1`：源根、PB 根、版本和 Test scopes，区别 Play 包装 |
| protoc 插件 | `project/plugins.sbt` | 同上：sbt-protoc 与 compilerplugin 对应，不假设本地已安装 |
| launcher 版本 | `project/build.properties` | 同上：standalone 1.11.7 与 service 1.4.9 分开 |
| serializer 配置 | `src/main/resources/application.conf` | serializer fixture：每 PB 精确 binding，不扩大到全部 GeneratedMessage |
| PB/exact 往返测试 | `T/infrastructure/persistence/GeneratedDomainRoundtripSpec.scala` | `parity/domain-serialization-graph-v1`：真实 bytes 操作、presence、map keys、非 empty State 和 exact 反例 |
| Actor query 测试 | `T/application/aggregates/GeneratedActorStateSpec.scala` | `parity/domain-generated-actor-tests-v1`：query-only host 明确抛错，GetState 不调用业务计算，finally 释放 kit |
| 命令与 replay 测试 | `T/application/aggregates/GeneratedCommandReplaySpec.scala` | 同上：显式 expected、拒绝不持久化、同 PID actor 重建；不是跨 JVM 验证 |
| generation ledger | `{outDir}/truthsrc.ledger.json` | `parity/domain-apply-evidence-v1`：最终字节、ownership、KEEP/MERGE、两 profile 同 generator name |
| code anchor 索引 | `{outDir}/anchors.json`，附属原子写临时文件 | 同上：合并后的 span、rename 前漂移、失败清理仅自有 inode；没有 parser 不出 symbol 证书 |
| project 输入证据包 | `{outDir}/.truthsrc/{canonical,request,compiled,inputs}.json` | `parity/domain-project-evidence-v1`：四份各司其职，区别 product/project 和 plan/apply |
| 项目知识数据库 | `{projectDir}/.truthsrc/knowledge.sqlite` | 同上：plan 仅 memory，snapshot 与生成回锚两阶段，事务/冲突/close；不是业务数据库 |

所有 fixture 均为 `specified-not-executed`。B 的默认质量要求包括：正确三层归属或非 Scala 物理根、集中命名与依赖、120 列、多字段分行、普通方法 CC≤5 目标及逐方法超限处理。当前复杂度是 `not-measured`，不存在以平均值或字符串 dispatcher 抹平问题的例外。

wire/PO 的 B 分类有正证据，不靠文件后缀：[银行 exactCodecs](../baseline/bank/truthsrc.project.json) 112–209 行明确指向这些类型；[MoneyWire](../baseline/actual-js/app/example/bankwealth/domain/values/MoneyWire.scala) 与 [MoneyPO](../baseline/actual-js/app/example/bankwealth/domain/values/MoneyPO.scala) 都是文本表示 record。当前 value renderer 的 restricted products 没有 codecs，实施这种移包前必须先设计显式依赖；不得用模板后缀猜测，更不能让纯领域类型反向依赖基础设施表示。

## 5. 真实未编目写入与补充来源

本组 manifest renderers 的可达 entry 已由 40 条 catalog 合同覆盖。沿合同已有 project/apply channel 追到两个未单列写入：

1. **持久输出** `{projectDir}/.truthsrc/knowledge.sqlite`。`projectCli:190–208` 在非 plan 时打开 store；`projectKnowledgeAst` 先发布 snapshot，apply 成功后 `publishProjectAnchors` 再发布 generation/关联。数据库不在生成 outDir，snapshot 存在也不能证明 apply 成功。
2. **瞬态写入** `{outDir}/.anchors.json.tmp-{pid}-{uuid}`。`anchors.mjs:574–610` exclusive open、write、sync、close、复核后 rename。失败只清理自有 inode。此项映射到已有 B anchor 逻辑项，不重复算永久业务制品。

补充来源未收在原 baseline/index.json，已完整只读并登记到 `extraSources`，没有复制到其它位置：

| 可变原仓文件 | SHA-256 |
|---|---|
| `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/lib/project/graph.mjs` | `d0e1efaaf4c3784094c66f0f77afee59a053a0d5c317c2684e4d56450fb3c47a` |
| `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/lib/knowledge-sqlite.mjs` | `096767820645e3e05789ba5c9a701dd9f9c6f6f41f6646cdf03083a2a33fee71` |

SQLite 引擎自身是否产生 journal/sidecar 不在这次静态阅读中臆造；没有打开数据库。补充冻结由集成者另行决定，不改原 852 文件基线。

## 6. 可读业务路径与不可偷换的 Scala 基准

可从银行固定产物阅读下列路径，但它是 **service 继承变体的既有源码**，不是本轮执行轨迹：

- [CreditBalanceProtocol](../baseline/actual-js/app/example/bankwealth/domain/CreditBalanceProtocol.scala)：`ReserveFunds` 是纯参数，`ReserveFundsConfirmed` 是事件。
- [CreditBalanceRules](../baseline/actual-js/app/example/bankwealth/domain/invariant/CreditBalanceRules.scala) 20–35 行：资源/单位/正数、历史金额一致性、已处理空成功、余额充分性，最后成功 emission。
- [CreditBalanceCommandHelpers](../baseline/actual-js/app/example/bankwealth/domain/CreditBalanceCommandHelpers.scala) 6–20 行：声明 `BalanceAfterReserveFunds` 能力，构造事件时调用；这里没有该算法实现。
- [FundOrderExternalEvents](../baseline/actual-js/app/example/bankwealth/domain/FundOrderExternalEvents.scala) 27–28 行：TaReceipt slots→FundTAReceiptObserved；身份按 `taRequestId.value, receiptId` 排序输出。桥接不负责 TA 实际连接、授权和 journal 写入。

结构性目标是把“参数→顺序规则→必要计算→事件→状态折叠”和“Actor 请求→持久化→按新状态回复”分别看清；不是把所有源码移入 application。

只以 [scala-artifacts.json](../scala-artifacts.json) 中 raw classic 39 族和单列 3 扩展作为对应口径，不以 `template/products/*` 或新 family 作为金样。raw Scala 的例外必须保留：

- DomainServiceTemplate 的业务体有 `???`；EntityBehavior 的 helper 也有 `???`，并有默认 `case _ => state`。JS 当前 fold 没有这个兜底，不应随布局迁移改变未知事件语义。
- ValueObjectTemplate 带 Play JSON companion、默认值、Instant 和超 22 字段处理；本 domain renderer 没有这些能力。A 分类不能掩盖缺失，也不能未经依赖裁定将 Play 强塞入纯领域入口。
- AggregateRulesTemplate 使用源码字符串和反否定字符串处理；并非“传统端完全没有代码字符串”。目标应按表达式模型保真整理。
- AggregateConverterTemplate 中 decimal→Double、部分 optional 容器有损处理不能覆盖本任务明确保护的 exact/presence/nominal 语义。
- EventAdapter raw class/oneof/class-name manifest 与 JS singleton/PB-name manifest 不同；PB message 名、字段号、serializer ID、PID 和摘要身份均不因布局整改改写。

## 7. 未决接口与后续实施前置条件

1. **FD-REPLY / FD-RULE / FD-PARAM**：缺真实应用 CommandHelper 接线；现 `Accepted(events)`、`Either[String,Vector]` 如何到逐命令 reply、`iMadzError`、pure Params，须先固定合同。不能把 `thenRun(Accepted)` 称为 `replyWith`，更不能混同 `replyWithAndPublish`。
2. **FD-ROOT / FD-STATE**：standalone 创建 Behavior，raw factory 管 sharding；State.empty 的无参与 ID 参数差别不能靠猜测消除。保留现 PID 和显式 initial state，不增添未授权 cluster 宿主。
3. **FD-ABI / FD-SERIALIZER / FD-PARTS**：布局与源码 owner 可以规格化，但 wire schema、manifest、context-index serializer ID 不得顺便改；当前按字符分片也不代表已证明 JVM 方法有界，超大单 node group 需要独立 fixture。
4. **FD-SERVICE / FD-VALUES / FD-CODEC**：计算接口不等于实现；raw JSON companion 与领域纯度需裁定；wire/PO 搬迁要 codec-aware 模型与全部调用方迁移，不能使 domain 反向依赖 infrastructure。
5. **FD-TEST-HOST**：`verificationTests:24` 仅拒绝选中命令拥有 host，42 行却实例化全聚合 `new Computations {}`。若同聚合其它命令要求抽象计算方法，该测试源码缺完整实现。应选完整显式 fixture 或聚合级拒绝，不能伪造默认业务算法。此处为静态源码缺口，未运行复现。
6. **FD-INGRESS / FD-IDENTITY**：standalone 外部桥有输出但 Actor externalIngress=false；服务的真实授权入口是另一变体，身份提取器本身不提供授权策略。
7. **FD-PROFILE-OWNER / FD-EXTRA-SOURCE**：v1/v2 共享 manifest name 的输出迁移须协调；两份补充 graph 源码尚待集成者冻结。

后续只在另获实施授权后，按共享语义 fixture 做同等输入的**完整文件、构造、RHS、imports、初始化、资源释放与回锚**对账，再开展真实接口与行为验证。公共 naming/type/layout/registry/writer 属集成者；不得直接手改银行生成目录。

本轮仅执行了文件读取、准确路径定位、固定文件 SHA/bytes 对账、人工映射的 JSON 序列化和覆盖计数。**没有运行应用、CLI、生成器、编译、typecheck、测试、数据库、服务或下载，没有任何新 parity-PASS / behavior-PASS。**
