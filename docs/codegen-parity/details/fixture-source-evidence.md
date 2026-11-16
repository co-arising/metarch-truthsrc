# 两个同语义 parity fixture 的来源证据

状态：`content-specification`；来源研究已完成，fixture/expected 由主会话制作。
仅写本文件与 [JSON 矩阵](fixture-source-evidence.json)。新生成、编译、测试、typecheck、运行全部 **未执行**。
未导入调用工程代码、未创建 canonical/request/compiled、未复制业务树、未操作 Git/服务/下载。
首次检查两个证据文件均不存在；本次先分别保存骨架，再补齐研究。未读取旧代理 transcript。
已读本仓 AGENTS、AUTHORING-CONTRACT 及 BC 的 CLAUDE/AGENTS；本轮文档限定优先于其执行型日常流程。

## 1. 结论与来源分层

`R=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc`，`B=/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen`。
下文 `S-*` 对应 JSON 的绝对路径、原仓路径、逐文件 SHA-256；baseline 项另保留 index 中的固定 SHA。
`R/reference` 当前不存在；实际参考根是 `R/test/reference`。只发现目录名后读取 aggregate-core/persistence-readside 的相关子集。

| fixture | 可直接采用的来源 | 不可混同的来源 | 目前同语义状态 |
|---|---|---|---|
| F1 classic CreditBalance | 固定 `Examples.bankingSystem` 的 raw `SystemMetadata`；curated 的协议/helper/fold 作独立人工参考 | Saga 作者样例、银行财富现存输出、formal 单槽 reply 与 classic 均不同 | raw 类型/关系可定位；回复 RHS、初始化/运行身份 adapter 未闭合 |
| F2 Warehouse nominal types + persistence | 既有小型 scaffold 作者项目、独立 aggregate-core HAND、persistence-readside HAND | synthetic test fixture、Tickets 宽 converter、Parcel module-seams 都不是同一输入 | 作者到 JS 公共入口已存在；到传统 BC runCommon 的同语义 adapter 未建立 |

不凭 CreditBalance/Warehouse 同名认定输入相同；不以参考源码存在认定生成/编译/行为通过。
F2 的 cross-type 范围是四个不同名义 ID、PB/domain 转换与 event/state frame 分派；不是任意跨类型图或完整 nested-container 覆盖。

## 2. F1：固定 raw classic，而不是重建一棵金融真源

主源 [Examples.scala](../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala)（S-raw，19–162、364–365）。
它是手写 Scala metadata 输入，不是 author YAML、编译 canonical 或 generated application。
`BankingSystem` / context `banking`；聚合 `CreditBalanceAggregate`、实体 `CreditBalanceEntity`、state `CreditBalanceState`。
全系统还含 services/query/projection/Saga/API；先界定本 fixture 的 aggregate 子集与依赖闭包，不能默默宣称覆盖整个 Examples。

### 2.1 命令、replyFamily 与纯 domainParams

`CreditBalanceReply` 包含七种 reply；`CreditBalanceConfirmation(error: Option[iMadzError], balances: List[Money])`。
其余六种是 `(transferId: Id, error: Option[iMadzError])`。`ActorRef` 属 actor command，不进入这些 domainParams 或 events。

| 命令 | raw reply（成功/失败同一名义类型） | domainParams / toParam（raw builder 与 curated 对应） |
|---|---|---|
| AddInitial | CreditBalanceConfirmation | Money / command.initial |
| Deposit、Withdraw | CreditBalanceConfirmation | Money / command.change |
| GetBalance | CreditBalanceConfirmation | read-only；没有 helper/CommandHandlingFlow |
| ReserveFunds | FundsReservationConfirmation | (Id, Money) / (command.transferId, command.amount) |
| DeductFunds | FundsDeductionConfirmation | Id / command.transferId |
| ReleaseReservedFunds | FundsReleaseConfirmation | Id / command.transferId |
| RecordIncomingCredits | RecordIncomingCreditsConfirmation | (Id, Money) / (command.transferId, command.amount) |
| CommitIncomingCredits | CommitIncomingCreditsConfirmation | Id / command.transferId |
| CancelIncomingCredit | CancelIncomingCreditConfirmation | Id / command.transferId |

S-meta 的 `ReplyMappingConfig` 只有 success/failure **类型引用**，没有字段赋值表达式。
S-helper-builder 28–35 只取 successReplyRef；41 排除 readonly；79–94 按参数数目推导 Unit/单值/tuple，不读取 invariant.changeType。
110–119 对非 formal 的单值生成 `Reply(param, None)` / `Reply(param, Some(error))`，tuple 则取 `param._1`。
因此 raw AddInitial/Deposit/Withdraw 会得到 `CreditBalanceConfirmation(param, None)` 等机械 RHS，与真实 `(error, balances)` 字段不符。
BC `CommandHelpersScaffoldSpec` 只查非裸 `???`、名字、MANUAL、无 `Unit(...)`；其标题的 compilable 不是编译证明，readonly 注释也不应覆盖当前 builder。

### 2.2 curated 是补充语义，不是 raw 已有的输出

[S-curated-helper](../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala) 给出可冻结的九个 helper。
余额类成功：`CreditBalanceConfirmation(None, state.accountBalance.values.toList)`；失败：`CreditBalanceConfirmation(Some(error), Nil)`。
转账 tuple 成功/失败以 `param._1` 保留 transferId；Id 类以 `param` 保留 transferId，error 分别 None/Some(error)。
[S-curated-glue](../baseline/curated-scala/net/imadz/common/application/CommandHandlerReplyingBehavior.scala) 的 `replyWith` 先 toParam、再 rule；失败回复不 persist，成功 persist(events).thenReply 使用 **fold 后 state**。
[S-curated-behavior](../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala) 九条写命令调用 `runReplyingPolicy(...).replyWith(...)`；不要改为 replyWithAndPublish。
curated 协议还有 raw replyFamily 不含的 `TransferConfirmation`，且各 reply 直接 extends CborSerializable；不能全文冒充 raw golden。
raw context=`banking`，`listOfMoney` 还显式引用 `net.imadz.banking.domain.values.Money`；curated 引用 `net.imadz.domain.values.Money`。FQN/名义类型映射也必须冻结，不能只比较短名。

### 2.3 state fold、默认值与 runtime identity

raw 七个事件精确保留拼写 `IncomingCreditsCommited`；不要修成另一个名义类型。
BalanceChanged 累加余额；FundsReserved 扣可用余额并登记预留；FundsDeducted 移除预留；ReservationReleased 回补并移除。
IncomingCreditsRecorded 登记；IncomingCreditsCommited 根据原 incomingCredits 贷记并删除；IncomingCreditsCanceled 删除。
raw `updateAccountBalance` referenceCode 引用了未在该方法体定义的 `currentBalance`；curated 有 getOrElse 与 Money 加法，二者不能静默互换。
raw state 是 `userId: Id` + 三个 Map；三个 `FieldMetadata(..., true)` 表示 **optional=true**，不是 default 或业务初始化（S-meta 136–140）。
raw 未传 defaultValue；S-entity-builder 174–193 自行给 Map.empty，属于 **生成器策略**。neutralValueFor 的 1/null 等也不是金融真源。
curated `empty(userId)` 明确三张空 Map；curated BalanceChanged 的 currentTimeMillis 默认值也不是 raw 事件字段显式默认值。
主会话必须分别冻结 raw 发射期望与人工补全目标，不得把 curated defaults 回填成 raw 原文。
raw persistence：entityTypeKey=`CreditBalance`、ShardedTags(`credit-balance-`,5)、snapshotInterval 默认100、eventAdapter 默认true。
raw implConfig：`credits.proto`，imports saga_v2.proto/saga_participant.proto，AkkaShardingBootstrap(`credit-balance-`,5)。
curated bootstrap 按 entityId 选 tag、由调用者 userId 建 `PersistenceId(typeKey.name,userId.toString)`，并装配 event/snapshot adapters。
这些寻址/serializer/PID/tag 身份应在技术绑定明确，不从业务名、银行新实例或本地随机 ID 猜测。

### 2.4 两个明确的“不是同输入”反例

S-saga-author：`example/saga-money-transfer-serial/.../credit-balance/aggregate.yaml` 是既有 legacy 作者样例。
其 identifier 是 AccountId/id，13 个命令，无 AddInitial/Deposit/Withdraw，另有 phase、committed、compensated、sagaResults 与不同事件名。
S-bank-output-state/protocol 是固定 **已生成输出**：AccountId/TxId、initialized、四张 committed/compensated map；actor 面是 Execute/GetState/Accepted/Refused aliases。
二者都不能替代 raw userId/Id、七种 classic reply 与四字段 state；本轮不核查其运行状态或追认来源新鲜度。

## 3. F2：直接复用既有 Warehouse 来源，不克隆业务

作者项目入口 S-warehouse-config：`R/scaffold/persistence-readside-project/truthsrc.project.json`。
唯一业务树 `truth/persistence-readside`，context=`inventory`，canonicalId=`inventory-domain`；aggregate=`Warehouse`。
作者 aggregate 的 identifier 为 WarehouseId/id；stateFields 只有 `receipts: Map[TxId,String]`，default=`[]`（作者表示，HAND 字段默认写作 `Map()`）。
四个 VO：TxId/WarehouseId/SkuId/ReservationId，各自名义身份、String carrier；不能因同底层类型而合并。
ReserveSkuQuantity 参数 `(txid,warehouseId,skuId,quantity:Long)`；先 quantity>0，不满足拒绝 `quantity-positive`，再已有 receipt 时 succeed-empty。
否则显式 ReservationIdentity host 产 ReservationId，发 SkuQuantityReserved；其 fold 是 identity，不能臆造库存扣减。
CommitSkuReservation 参数 `(txid,warehouseId,skuId,reservationId)`；receipt 已有则空成功，否则发 SkuReservationCommitted(txid)。
其 fold 只 `receipts.updated(txid,"SkuReservationCommitted")`，保留其它键；无额外金融/库存政策。

| 来源层 | 具体源与责任 |
|---|---|
| author | S-warehouse-author/reserve/commit/四个 VO；业务参数、guards、host、fold、初始 receipts |
| technical binding | S-warehouse-binding，`documents:[{id:"persistence",file:"bindings/persistence.json"}]` + `roles.persistenceReadsideBinding="persistence"` |
| JS profile/options | `scala-cqrs-persistence-readside-v1`；options 仅 packages/names/protobuf；config 显式列八个 product 版本 |
| independent HAND | `test/reference/aggregate-core/project` 的协议/helpers/rules/fold/converter；`test/reference/persistence-readside/scala` 的 frame/adapters |
| raw SystemMetadata | 没有本轮已定位的 Warehouse→传统 runCommon 同语义输入；不能拿另一个 BC product test 当它 |
| generated output | 本轮未生成或读取 Warehouse candidate 输出；reference/project 路径不是生成验收回执 |

S-warehouse-binding 精确指定 serializerId=736401、envelopeVersion=1、三条 event/state typeId/version/layoutSha256。
HAND `WarehouseWirePins.scala` 的三个常量与 binding 文本相同；旧 REFERENCE-CONTRACT 的“pins pending”已滞后，不能照抄为当前空缺，也不能当新 wire 验证。
PB converter 保留 TxId map key；required message 缺失与 duplicate map key 拒绝，编码 map 按 key bytes 排序。
Frame 用显式 role/typeId/version/layout 注册分派；manifest 必须精确一致；event/state cross-role 拒绝。它不保证可识别所有同 wire 形状的语义错换。
actor protocol 为 Execute(domain Command, ActorRef[Reply])、GetState(ActorRef[WarehouseState])，Reply=Accepted(events)/Rejected(code)；不是 classic 每命令 typed confirmation。
PID、resource、namespace、initial state、hosts、DataSource、event source、EC 由调用方供给；不可从 WarehouseId/PID 字符串推断资源关系。
S-persistence-test-fixture 中 1/2/3.repeat(64) 明确是 synthetic admission pins，不能代替 scaffold 的实际固定常量。

## 4. 具体缺失的输入 adapter / 映射槽

| 缺口 | 已有槽/拒绝证据 | 主会话需要明确的映射（不是本轮实现） |
|---|---|---|
| classic replyFamily | raw 有族/成员；JS deriveLayout 只建 aggregate/state/command/event，无该 reply declaration 路径 | actor 专用回复族及字段顺序、每命令 replyTo 引用；不塞进纯 domain payload |
| per-command success/failure | raw ReplyMappingConfig 只有类型；helper builder 通用猜参 | 两臂各字段来源：param/param._1、error Some/None、失败 Nil、成功 post-fold balances |
| domainParams | raw builder 按参数数目猜，与 invariant.changeType 独立 | 有序字段到 Money/Id/Tuple2 的确定映射；readonly 无 helper，不能强行映射 Unit write |
| initial defaults | raw 无显式 default；builder、curated、Warehouse 作者各有不同来源 | 标明 absent vs inferred vs author-declared；标识符由谁提供，时间值由谁提供 |
| runtime identity | raw sharding vs JS local actor/cache/PersistenceId 形状不同 | entity type key、tag 前缀/数量、PID 构造、proto/serializer 名义身份、resource 关联 |
| BC file input | SerialCanonicalAdapter 合成 `<Agg>Reply(error)` / `Get<Agg>StateReply(state)`，并把 identifier 加到 state 首字段 | 不能保留 classic 七种 reply；Warehouse HAND state 不含 id，直接走此 adapter 也改变输入 |
| BC/JS public handoff | JS project 捕获作者与技术绑定；BC raw slot 接 SystemMetadata，product slot 另一路 | 需主会话设计受控 semantic projection/adapter；不能手写 canonical/request/compiled 伪装公共链路 |
| F2 traditional persistence | BC pinned product profile switch 不含 aggregate-core@1/persistence-readside@1 | 显式实现/批准有限 target adapter，或把暂不覆盖项标 missing-counterpart；不能宣称 runCommon parity |

BC `ProductConverterPartitionSpec` 和 `ProductSharedExternalTypeSpec` 仅作规格：宽 Tickets 的完整方法/分片/关键字与独立 goldens；同名义结果的双 external bridge。
其 fixture 输入分别为 compiled-tickets-wide-converters / compiled-shared-external-type，并非 Warehouse，也非 classic；未运行、未读取其 compiled 内容、未改 golden。

## 5. 已有公共命令与完整副作用边界（均仅记录，未执行）

下面 `<PROJECT>`、`<OUT>` 等为主会话将来拥有的绝对路径，不是已经创建的 fixture。
Node 入口固定 `node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js`；项目命令可另加 `--format human|json`。

| 命令尾部 | 实际输入/副作用 |
|---|---|
| `compile-project --project <PROJECT>` | live author+config+documents 捕获、validate/roundtrip、内存 derive/compile；roundtrip 建/清 OS 临时树，读取工具指纹；不写 target/项目数据库/持久 compiled |
| `generate-project --project <PROJECT> --out <OUT> --plan` | 同上且 producer admission/render plan；memory graph，不写 target/项目 SQLite；不执行 Scala；不是零计算或全部 overwrite preflight |
| `generate-project --project <PROJECT> --out <OUT> --update --plan` | 另执行 overwrite/MANUAL merge preflight，不 apply；读取现存输出 |
| `generate-project --project <PROJECT> --out <OUT> [--update]` | 写项目 `.truthsrc/knowledge.sqlite` 快照/anchors；target 源码/build/config/generated-test、`.truthsrc/{canonical,request,compiled,inputs}.json`、ledger/anchors；可能部分落盘，无跨文件事务/自动回滚/自动删旧输出 |
| `generate-products --request <MANIFEST> --generator <SHIPPED-DIR> --out <OUT> --options-json <OPTIONS> --plan` | 必须四项全显式；捕获文件请求、内存 compile/plan，不写 target；不是任意目录动态 producer，也不接受 raw Scala SystemMetadata |
| 同上去掉 `--plan` | apply 源码及 ledger/anchors；没有 project live-author/SQLite 语义，也没有 `--update`；不能为本轮手工制造请求来绕过 project |
| `compile-products --request <MANIFEST> --out <NEW-FILE>` | 写新 compiled 文件（wx），不能覆盖；不是 read-only。本轮禁止调用或手工造它的输入 |

generator 的选择在 project config 的 `generator`，不是 `generate-project --profile/--generator` 参数；names/protobuf 是 options，不是公有 CLI flags。
可用 producer：aggregate-core-v1 与 persistence-readside-v1；`scala-cqrs-legacy-compatible-v1`/`modular-candidate-v1` 只是 target 合同，S-target-profiles 明确 generator=null。
Play-service 是已注册 producer，但需 packages/verificationCases/runtimeArtifact/service 与额外 products；plan 也读取实际本地 runtime JAR/外部源码根，不是 classic 快捷入口。
module-seams/Saga-Monarch/Play-application 的 raw generate-products（含 plan）被 live implementation capture gate 拒绝；不能用序列化 capture 绕行。
所有 project 输出必须与工具安装、作者、配置、绑定、graph 不重叠；scaffold 在工具仓内只能作现存输入研究，将来目标必须在其外且主会话独占。

BC 在 `B` 内的已有形状：`JAVA_OPTS="-Dcodegen.system=Examples -Dcodegen.targetDir=<OUT>" sbt "runMain net.imadz.codegen.CodegenMain"`。
固定 CodegenMain 当前先 prepare/harness 再 mkdir/copy scaffold，随后 raw runCommon 写输出/manifest；multiProject 另移动13个 common 文件。
它不是安全预览：main 不解析 `--plan/--dry-run`；sbt 会启动 JVM、可能解析依赖/写构建缓存，生成期还可能作版本探测；已有目标可能被写。
另有 `-Dcodegen.systemFile=<CANONICAL> -Dcodegen.systemBindings=<BINDINGS>`，二者成对且与 codegen.system 互斥，走 SerialCanonicalAdapter，不是任意 raw JSON adapter。
另有 `-Dcodegen.semanticProductsFile=<COMPILED> -Dcodegen.productOptionsFile=<OPTIONS> -Dcodegen.productTargetProfile=scala-cqrs-domain@2 -Dcodegen.targetDir=<ABSENT-OUT>`。
此 product 入口先构造/核对 plan、要求新独占目标，再写输出；它绕过 raw runCommon，不是39模板基准，且所支持 profile/版本不等于 JS 当前 family profile。

## 6. 交给主会话的最小冻结集合

JSON `sources` 是本轮具体读取的证据，不是全工程依赖/供应链清单；`beyondBaselineSources` 逐文件列出待主会话冻结项。
F1 冻结 raw + metadata/builder + curated 各自层次，批准回复/默认/运行身份映射后才制作最小 fixture；不从现存银行树复制全部业务。
F2 复用现存 Warehouse 作者项目及 HAND 子集，保留独立 oracle 所有权；若要更宽跨类型覆盖，另批准 Tickets/Parcel 子例，不能改名冒充本 fixture。
逐项允许状态：source-located / decision-required / missing-counterpart；本证据不能升级为 implemented、same-input、parity-PASS 或 behavior-PASS。
