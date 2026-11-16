# Fixture 覆盖矩阵：42族条件反查与308条B输出索引

**状态：source-only / candidate-spec / not-exercised。** 本文是缺口与候选输入规格，不是可执行 fixture、expected 字节交付或运行验收。仅静态读取已交付记录；不读取并发 F1/F2、expected、interface-decisions 文件，也不对其未交付状态下结论。

机器表：[coverage-matrix.json](coverage-matrix.json)。依据：[作者合同](../AUTHORING-CONTRACT.md)、[fixture准入合同](../FIXTURE-AND-EXPECTED-CONTRACT.md)、[Scala清单](../scala-artifacts.json)、[中央JS分区](../js-partition.json)、[来源逐字段表](../details/fixture-source-evidence.json)。机器表 sourcePins 保留既有75个文档pin不刷新，仅新增3个实际读到的固定源码pin（共78个）。全文字节指纹只用于来源追溯，读取范围见精确引用/readCoverage，不代表新 expected、runtime 锁字节或 CLI 通过。

## 1. 计数与证据边界

| 口径 | 静态结果 | 不表示什么 |
|---|---|---|
| Scala族 / diff | 39传统+3扩展=42族；42份diff均存在 | 不是42个输出文件，也不是42族通过 |
| 原名条件记录 | 32族details的173条`scalaVariants`；protobuf表另有2个原名；其余9族保留无名条件证据 | 成员/布局/零写/拒绝不相加成文件数；不是所有正交组合的笛卡尔全集 |
| 中央A/B | 591出现位置=283 A+308 B；641 catalog导航 | 不是独立文件数或已实现能力数 |
| Scala对应关系 | 38部分对应；4缺项为四个`saga-trigger-*` | 旧diff对完整classic形态的missing不被部分对应抹平 |
| F1候选 | 18族：四件优先+14族必要闭包；17条structured条件+protobuf aggregate为候选 | 尚未建立无损双端输入，连候选条件也未exercise |
| F2来源候选 | 8族语义/HAND对照；传统dispatch命中声明0 | Warehouse不替代classic Protocol/Helper，不替代所有投影/Saga |
| 候选族并集 | 19族；其余23族无F1/F2来源候选 | 候选范围不等覆盖率 |
| B反查 | 308/308原ID、分类、fixture/pointer保留；197原fixture ID，292种完整metadata | 同ID不同conditions不合并掉；B当前308条全uncovered |
| 外部内容 | 3个退休动态内容槽blocked | 不新增B桶，不以641−3宣称638完整 |
| 同输入/expected/执行 | 本矩阵建立的可执行同输入fixture=0；全族expected字节集=0；exercise/PASS=0 | 未生成、未plan、未validate/roundtrip、未编译/测试/typecheck/runtime |

`uncovered`表示没有已建立的该条件覆盖；`decision-required`表示候选源存在但输入映射、target或接口/身份待定；`blocked`用于缺外部源码等不可分类/取证面。原记录中的`specified-not-executed`保持原文，不转换为通过。

## 2. F1/F2 明确候选范围

### F1 classic CreditBalance

- 固定来源为 `Examples.bankingSystem` 的 CreditBalance 子集及必要闭包，而非整个 Examples。先处理 **application-protocol、command-helper、aggregate-behavior、domain-entity** 四件完整目标及其输入槽。
- 十命令保留原字段与顺序：AddInitial/Deposit/Withdraw/GetBalance及六个资金阶段命令；raw七回复，人工额外TransferConfirmation独立裁决。纯参数Money、Id、(Id,Money)与readonly分开。
- Deposit等两臂目标来自明确人工参考：失败`(Some(error),Nil)`，成功`(None,postFoldState.accountBalance.values.toList)`；其它方法用其确切`param/param._1`。raw通用位置参数不能产出这些目标。raw free variable/currentBalance、optional/default、人工三Map.empty/时钟默认都分开记账，不创造新业务规则。
- F1 aggregate/codec/sharding候选仍缺无损映射、单/多根选择和技术绑定。proto名分三层：[raw输入 Examples.scala L161](../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L161) 显式为 `ProtoConfig(fileName="credits.proto")`；[传统Builder命名结果](../diffs/protobuf-schema.diff.md#L16) 为 `credit_balance.proto`；curated历史imports为 `credits`，三者不互换。repository/factory初始化、tag/PID/serializer不能从名称推算。
- 仅将 ReserveFundsRule 的 **TransferValidator 依赖闭包**列为 domain-service 来源候选：[Examples.scala L50、57](../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L50-L57) 分别引用 `transferValidator.validate`、定义 `DomainServiceMetadata("TransferValidator", ...)`；[curated ReserveFundsRule L5–23](../baseline/curated-scala/net/imadz/domain/invariants/ReserveFundsRule.scala#L5-L23) 调用 `TransferValidatorDomainService.validate`，与[原diff L617](../diffs/invariant-rule.diff.md#L617)一致。算法、错误定义及注入名字仍待来源裁定；`service-object-single` 仅先行候选、decision-required，不是命中或 profile 迁移批准，其它 domain-service variants 保持 uncovered。
- `helper-method-slots` 的 F1 来源已在 [Examples.scala L43–45](../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L43-L45)：显式声明 `updateAccountBalanceMethod` 并传入 `Seq(updateAccountBalanceMethod)`，无须另找 helper 声明。[raw模板约束](../diffs/event-handler.diff.md#L287-L292)仍是 body `???`、`referenceCode` 仅入 prompt；[curated helper L46–49](../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L46-L49)有实际实现，须分栏，不代表生成或 runtime 通过。
- 除上述 TransferValidator 必要依赖外，不自动选入整个 Examples 的 services/query/projection/Saga/API；GetBalance不是aggregate-state-controller要求的Get${a.name}State；存在资金阶段命令不证明classic Saga、strict或composition被触发。

### F2 Warehouse

- 来源为固定scaffold作者/绑定与独立HAND。TxId/WarehouseId/SkuId/ReservationId是四个独立String carrier；state仅receipts，不能悄加identifier。Reserve先quantity>0，再已有receipt空成功，再ReservationIdentity，再发事件；reserve fold为identity。Commit只更新对应receipt，不添加库存扣减。
- 作为value/entity/fold/formal规则语义及proto/converter/adapters的**来源候选**；没有无损BC runCommon adapter，所有传统variant命中仍为0。HAND Execute/GetState/Accepted/Rejected不等classic逐命令Protocol/Helper。
- 显式serializerId=736401、envelopeVersion=1与三条实际layout SHA在机器表原样保留；synthetic `.repeat(64)`不能作wire pin。cross-role event/state与required/duplicate map是候选边界，不宣称所有同wire nominal错换可检测。
- H2 receipt store、Caller-supplied PID/resource/namespace/initial state/computations/DataSource/event source/blocking EC/ActorSystem需各自owner与执行证据；不能凭Warehouse名称覆盖传统projection、API或双资源Saga。

两者都必须分别保存raw输入/真实raw输出、人工参考、批准target、新JS完整输出以及raw→target/JS→target差异；本矩阵没有建立这些字节资产，也未读取并发owner的目标文件。

## 3. 42族总表

下表的基数是源规格计划值，实际写入还受Builder异常、scope/territory、路径碰撞影响。F1/F2栏仅是来源候选；每个未列为候选的原条件明确uncovered。机器表`aFamilies[].scalaVariants`完整保留原定义，`variantCoverage`逐条关联，未重命名变体。

| # / 族（diff） | 调度与输出基数 | 来源候选 / 当前缺口 |
|---|---|---|
| 1 / [value-object](../diffs/value-object.diff.md) | domain.valueObjects.foreach；V 个文件；*State 走 entityState resolver，不重复当普通 VO。 | F1闭包候选；F2仅语义来源。F1 Money/Id 与 F2 四 nominal 仅候选；0/1/22/23+、跨包同名、keyword、默认/optional/Instant、exact 边界及派生方法全条件未齐。 |
| 2 / [domain-entity](../diffs/domain-entity.diff.md) | domain.entities 每项一文件；E；State/Events/empty 在同文件。 | F1四件；F2仅语义来源。F1 原四字段/七事件与人工默认分开；F2 receipts-only/两事件是另一输入。空事件、字段排除、首字段 ID、optional/default、nested owner/未知事件仍缺。 |
| 3 / [event-handler](../diffs/event-handler.diff.md) | domain.behaviors 每项一文件；成员 mutation/helper 不增加文件；scope 可能零写。 | F1闭包候选；F2仅语义来源。F1 helper 声明已在 Examples.scala L43–45，helper-method-slots 是来源候选；raw ???/referenceCode 仅 prompt 与 curated 实际实现分开，映射/target/行为证据仍缺。F2 reserve identity fold/commit put 仅来源对照；scalar/collection、put-all/remove-all、multi/scope 专属输入未齐。 |
| 4 / [invariant-rule](../diffs/invariant-rule.diff.md) | domain.invariants 每项一文件；I；conditions 为空仍可发文件，空 invariants 为0。 | F1闭包候选。F1 仅原规则候选；referenceCode Some/None、空条件、multi/scope、失败语义需独立 target；不加金融规则。 |
| 5 / [domain-service](../diffs/domain-service.diff.md) | domain.services 每项一文件；D；methods 空仍1；multiProject raw 回落 app。 | F1闭包候选；decision-required。F1 仅纳入 ReserveFundsRule→TransferValidator 的 domain-service 来源候选，不纳入整个 Examples 的 services。算法、错误定义及注入名字仍待来源裁定；service-object-single 仅先行候选、不批准 profile 迁移，其余 multi-root-fallback/empty-services/empty-methods 保持 uncovered。 |
| 6 / [aggregate-root](../diffs/aggregate-root.diff.md) | app.aggregates 每项一文件；A；metaCategory 只改归属；ShardedTags 外拒绝。 | F1闭包候选。F1 显式 state/event/behavior/key/tag 候选；null/suffix Saga/inline/steps 为模板历史面，标准 Builder 不启用，支持与否待裁定。 |
| 7 / [application-protocol](../diffs/application-protocol.diff.md) | app.aggregates 每项一 Protocol；A；replyTo/handler alias 为同文件成员。 | F1四件。F1 十命令/七 raw reply 明确候选；缺 replyTo、transactor attribution、inline-state 模板-only、scope/territory 未覆盖。 |
| 8 / [aggregate-factory](../diffs/aggregate-factory.diff.md) | 每 app.aggregate 一文件；先裸引用，再首个非只读带参命令的初始化 ask；缺 reply 会抛错。 | F1闭包候选。F1 AddInitial 候选不意味着初始化已可运行；bare-only、missing-reply、transactor 路由及无聚合/scope 输入未齐。 |
| 9 / [aggregate-behavior](../diffs/aggregate-behavior.diff.md) | 每成功构建且可写 aggregate 一 Behaviors 文件；组/命令数不增文件。 | F1四件。F1 policy+GetBalance query 候选；transient/formal、empty apply、without-helpers 两分支、multi/scope 尚无已定输入。 |
| 10 / [command-helper](../diffs/command-helper.diff.md) | 每非 transactor 聚合一文件；每写命令一个 implicit object；readonly 无成员，空写集 raw 仍发 trait。 | F1四件。F1 Money/Id/Tuple2 与 read-only suppression 候选；formal first reply/empty reply、空写集、transactor/scope 全部另列未覆盖。 |
| 11 / [aggregate-rules-formal](../diffs/aggregate-rules-formal.diff.md) | 非 transactor 且 formal 可解析时每聚合至多1；每成功 command 一 Params/Rule；无法解析可零。 | F2仅语义来源。F1 raw 不是 formal；F2 只供守卫/端口/事件语义对照。formal multi app fallback、零 payload/no guards、emission=None 模板-only 与部分命令消失需专属输入。 |
| 12 / [aggregate-repository-port](../diffs/aggregate-repository-port.diff.md) | app.repositories 中每 AggregateRepositoryMetadata 一文件；合成 entityRef+声明 QueryMethod。 | F1闭包候选。F1 必要 repository 候选；声明 query/同名过滤、非aggregate、noteId、multi 条件未固定。 |
| 13 / [external-connector-port](../diffs/external-connector-port.diff.md) | application.connectors 每项一 trait；methods 空仍1；connectors Nil 为0；multi raw app fallback。 | 无；uncovered。无 F1/F2 指定 connector；scriptParam Some/None、注释、空方法/空集合/scope 与手供实现逐项缺输入。 |
| 14 / [application-service](../diffs/application-service.diff.md) | app.services 每项一 class；methods 空仍1；multi raw app fallback；ActorSystem 是成员分支。 | 无；uncovered。无已选同输入 service；方法算法、依赖构造/ActorSystem 条件、空对象/空方法与返回错误待指定。 |
| 15 / [query-service](../diffs/query-service.diff.md) | app.queries 每项一文件；structs 为同文件0/1 companion；multi app fallback。 | 无；uncovered。F1 GetBalance Actor query 不等 QueryServiceMetadata；structs、repositories、Timeout 模板-only/Builder 剔除差异无专属输入。 |
| 16 / [saga-participant](../diffs/saga-participant.diff.md) | app.sagas × participants；每 participant 一文件；重复名可能碰撞。 | 无；uncovered。F1 未选择 classic Saga；三相位 Some/None、reply/result/error/timeout、repository 与构造过滤须提供。中央部分对应不解除 diff 的完整 classic 缺项。 |
| 17 / [saga-definition](../diffs/saga-definition.diff.md) | app.sagas 每项一文件；S；每 participant 一逻辑 step，不是每 phase 一 step。 | 无；uncovered。args 必填、Money helper 精确条件、Id 转换、首 step/retry/group/context/import 条件无专属输入。 |
| 18 / [saga-trigger-protocol](../diffs/saga-trigger-protocol.diff.md) | 每 classic app.saga 一文件；S；N 个非 Update 命令+1状态命令+1确认。 | 无；uncovered。中央四个 missing 之一；no-update、zero-trigger、multi app fallback/no-sagas 均无候选输入。 |
| 19 / [saga-trigger-entity](../diffs/saga-trigger-entity.diff.md) | 每 classic Saga 且 args=Some 一文件；S；args=None 拒绝，empty args 可能非法文本。 | 无；uncovered。中央 missing；不是独立 version==3 gate。args 缺/空、multi、scope/territory 需专属输入与目标裁决。 |
| 20 / [saga-trigger-root](../diffs/saga-trigger-root.diff.md) | 每 classic app.saga 一 Root；S；前序成功和 scope 为前提。 | 无；uncovered。中央 missing；context explicit/fallback、multi raw app fallback、无 Saga/scope 均未覆盖。 |
| 21 / [saga-trigger-behaviors](../diffs/saga-trigger-behaviors.diff.md) | 每 classic Saga 一文件；trigger cases 数=非 Update 命令数；S。 | 无；uncovered。中央 missing；args/零或异构 triggers 首条复用、multi/scope 及错误/恢复语义均缺专属输入。 |
| 22 / [aggregate-repository-implementation](../diffs/aggregate-repository-implementation.diff.md) | infrastructure.repositories 中每 AggregateRepositoryMetadata 一文件；storage 不分支；multi→glue。 | F1闭包候选。F1 classic sharding 候选；不与 local actor cache 等同；QueryMethod ???、absent/scope/multi 与实际 JAR ABI 尚缺。 |
| 23 / [projection-repository-port](../diffs/projection-repository-port.diff.md) | infrastructure.repositories 中每 ProjectionRepositoryMetadata 一接口文件；DTO companion 同文件。 | 无；uncovered。table single/multi、Mongo/graph/vector 各需专属输入；F2 H2 receipt store 不替代这五变体。 |
| 24 / [projection-repository-implementation](../diffs/projection-repository-implementation.diff.md) | 每 ProjectionRepositoryMetadata 一实现文件；table/graph/vector/Mongo 四存储路。 | 无；uncovered。四存储与 unsupported ES/Redis fallback 均未覆盖；graph manual 与任意 implOverride 独立阻断。 |
| 25 / [connector-implementation](../diffs/connector-implementation.diff.md) | infrastructure.connectors 每项一文件；Ci；helper/script 为文件内分支；multi app fallback。 | 无；uncovered。helper-with/without-script、no-helper/zero connectors 和 typed 外部调用算法/资源未指定。 |
| 26 / [projection-apply-event](../diffs/projection-apply-event.diff.md) | 正常 single=0；multi 且 applyEvents.nonEmpty 时每投影0或1文件，非每事件一文件。 | 无；uncovered。create/update-only/delete/persistence-id-create/degraded 与 absent 均缺专属 input/target；全 degraded 仍可有空对象文件。 |
| 27 / [projection](../diffs/projection.diff.md) | infrastructure.projections 每项一文件；P；多个 active source/provider 可在同文件；零 handler 会 head 拒绝。 | 无；uncovered。single-handler/composite/multi-source 与空 handler 拒绝未覆盖；F2 单 store 不证明 source grouping。 |
| 28 / [projection-handler](../diffs/projection-handler.diff.md) | 每 projection 最终 model.handlers 每项一文件；总数Σhandlers；multi→glue。 | 无；uncovered。single/multi manual、GraphView 名称、degraded、四 applyForm 均缺输入；任意 manualBlocks 字节未提供。 |
| 29 / [protobuf-schema](../diffs/protobuf-schema.diff.md) | 每 app.aggregate 一 aggregate proto，加 buildShared messages 非空时1；A+[shared非空]。 | F1闭包候选；F2仅语义来源。F1 仅 aggregate 候选，F2仅 frame/nominal来源；shared cold/多owner/state引用需多聚合专属输入；schema身份/编号/presence 不自动升级。 |
| 30 / [proto-converter](../diffs/proto-converter.diff.md) | 每 app.aggregate 一 trait+companion 文件；A；shared VO converters 在各需要的 aggregate 内，不另算族。 | F1闭包候选；F2仅语义来源。F1/F2 输入与 wire 不同；state必须VO、shared/local owner、Option/容器/exact/租户及旧bytes均未定齐。 |
| 31 / [event-adapter](../diffs/event-adapter.diff.md) | 每 app.aggregate 一 event adapter；A；无 shared-VO/classic Saga adapter 自动输出。 | F1闭包候选；F2仅语义来源。raw oneof/curated outer/bank payload 不混同；manifest/Empty/未知/损坏bytes/serializer白名单及 old replay 未执行。 |
| 32 / [snapshot-adapter](../diffs/snapshot-adapter.diff.md) | 每 app.aggregate 一 snapshot adapter；A；不按 retention 裁剪，无 shared snapshot adapter。 | F1闭包候选；F2仅语义来源。state 元数据/PO命名与 entity fallback、null/wrong-type/error/old snapshot/FQN 迁移必须专属证据。 |
| 33 / [saga-context](../diffs/saga-context.diff.md) | 每 application.saga 一 context；S；infrastructure阶段调度但输出 application.services.transactor。 | 无；uncovered。explicit context.name 与 resolver 回退不同；same-simple-name repo/field collision/generic与required repo 缺失未覆盖。 |
| 34 / [aggregate-state-controller](../diffs/aggregate-state-controller.diff.md) | eligible = repository.isDefined 且命令恰为 Get${a.name}State；非空时系统1文件，否则0。 | 无；uncovered。F1 GetBalance 不命中。需精确命令名、state/reply/Instant/Id 独立组合、root/multi/scope专属输入。 |
| 35 / [http-controller](../diffs/http-controller.diff.md) | 每 ControllerMetadata 一文件；controller 内 legacy/DSL/mixed branches；前序异常不保证回滚。 | 无；uncovered。8变体全未选：tenant/global/anonymous、path/factory/conflict/flow/view/mixed/skip-rejection；无凭名称的 F1 API 覆盖。 |
| 36 / [command-endpoint-dsl](../diffs/command-endpoint-dsl.diff.md) | 任一 endpoint.gate.isDefined 时每 InterfaceLayer 至多1文件，五件套同文件；全部无 gate 为0。 | 无；uncovered。gate-declared single/multi-root 与 gate-none 未覆盖；gate存在不等 active route。 |
| 37 / [route-definition](../diffs/route-definition.diff.md) | 有效 routeLines 非空时至多更新1个 conf/routes 中 codegen:controllers 块；N行非N文件。 | 无；uncovered。8变体全无具体 target-state：无active、新文件、首对replace、append、malformed、单/多根；零写不删旧块。 |
| 38 / [bootstrap](../diffs/bootstrap.diff.md) | 四原名变体：aggregate=A；saga-coordinator=[S>0]；saga-transactor=S；projection=P。 | F1闭包候选。仅 aggregate 为F1候选；其余缺 classic Saga/projection输入。A/S/P零、多值及 raw branches/恢复/关闭不可由F1名字推断。 |
| 39 / [application-bootstrap](../diffs/application-bootstrap.diff.md) | runCommon 总装配计划1文件；strict entries 0/1/N不增文件；multi→glue且strict wiring空。 | F1闭包候选。F1仅classic-empty-strict候选；strict-single/strict-many/multi-project/empty-traits缺输入；空extends目标决策未完成。 |
| 40 / [strict-saga-module](../diffs/strict-saga-module.diff.md) | 每 admitted strict Saga 一模块；single/multi(glue)替代；suppressed=0，invalid admission拒绝。 | 无；uncovered。4变体均无F1/F2同输入映射；classic阶段命令不等admitted v3；实际base/类型/资源/锁bytes待提供。 |
| 41 / [strict-fixture-host](../diffs/strict-fixture-host.diff.md) | 每 strict model：有效single五production+两test=7；multi五production、零test；非strict=0。 | 无；uncovered。money-single/collection-single需不同专属数据；strict-multi及unsettled组合不得宣称可用profile。 |
| 42 / [composition-invocation-host](../diffs/composition-invocation-host.diff.md) | 同一 admitted single-project composition：host/child-plan/recovery-spec/deployment-spec各1，共4；缺省0，非法组合拒绝。 | 无；uncovered。五原名变体全未覆盖；formal单步invocation host不是组合目标；需要strict、binding与真实recovery/deployment证据。 |

## 4. 必须单独看待的条件闭包

### Bootstrap 四变体不是一个成功样例

| 原variant ID | 条件 / 基数 | 当前候选与缺口 |
|---|---|---|
| `aggregate` | system.application.aggregates.foreach；每聚合一次；A=0抑制；A | F1仅来源候选，A=0/多聚合、所有rawBranches及实际接线未覆盖 |
| `saga-coordinator` | system.application.sagas.nonEmpty；全系统一次，不是每个Saga一次；S > 0 ? 1 : 0 | uncovered；须专属classic Saga输入，不能用strict或F1阶段命令替代 |
| `saga-transactor` | system.application.sagas.foreach；每classic Saga一次；S=0抑制；S | uncovered；须专属classic Saga输入，不能用strict或F1阶段命令替代 |
| `projection` | system.infrastructure.projections.foreach；每projection一次；P=0抑制；P | uncovered；须专属projection/source/handler输入 |

`saga-coordinator`是全系统S>0时1件，不是S件；`saga-transactor`才是S件。`application-bootstrap`另一个族：classic-empty-strict/strict-single/strict-many/multi-project/empty-traits均是同一装配文件的条件；严格条目数不等文件数，多工程强制空strict wiring，empty-traits仍有非法extends决策。

### Shared proto / classic / strict / composition

- `protobuf-schema`原表的`aggregate`与`shared-value-objects`分开。shared取owner空且非aggregate state的VO，含cold零引用VO，不是“至少两个聚合用到”一句话即可触发。需要多聚合/连通分量、单owner/多owner/零owner、shared引用state、同名与字段号/presence的专属数据。F1单聚合、F2nominal均不能据名字勾shared。
- shared proto不是独立shared converter/adapter族：converter在每个需要的aggregate trait内；没有shared event/snapshot adapter。raw BigDecimal→double不是银行exact目标；容器、tenantId、stateMeta/BaseStatePO缺口保持decision-required，不据此授权公共schema变化。
- classic七族（participant/definition/context+四trigger）与admitted strict完全分开。后者需要真实base/严格准入，fixture-host单工程7文件、多工程5文件且test/wiring抑制；money+collection/text-only/empty形状尚未裁定。
- composition必须有strict、binding且single-project，host/child-plan/recovery-spec/deployment-spec共4件；没有composition是0，有composition但无strict或multi是拒绝，不能都写“suppressed”。

### API/service/手供slots

- F1仅为 TransferValidator 的 DomainServiceMetadata 和已声明 event-handler helper 提供来源候选，算法/错误定义/注入名字及目标仍待裁定。其它 DomainService/ApplicationService/QueryService/connector，以及空列表、空方法、依赖和raw multi app fallback需要各自输入；不带入整个 Examples。API八分支、endpoint gate与实际active route、state controller精确命令名分别选数据。
- 每个MANUAL/???/referenceCode、helper script、graph mergeLinkTolerant或任意override须有完整方法/文件来源、owner和行为预期；缺算法不填空成功，不能用generated tests替代独立oracle。
- routes需要实际目标初态：新文件、首对marker替换、无marker追加、畸形marker及无active不删除旧块；仅指定业务输入不能覆盖writer分支。

## 5. 原名scalaVariants逐条反查

以下保留全部173个原ID和condition；其中F1 structured来源候选17条，其余156条无候选。F1列仅表示可讨论的来源形状，仍decision-required/not-exercised，空候选为uncovered。精确outputPaths与原cardinality/plannedCardinality、其它原字段在机器表；未提供单条cardinality时不臆造数字，回看42族总表与原定义。F2因无无损adapter不挂任何传统variant。

### event-handler

原定义：[details](../details/event-handler.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `traditional-single` | CodegenMain 传统路径；domain.behaviors 每项依次 build/template/writeArtifact；owner 可解析且 scope 包含归属，非 multiProject；无非空 handlers/helpers/formal 条件门。 | F1来源候选；decision-required；not-exercised |
| `traditional-multi` | 传统路径 multiProject=true；event-handlers kind 经 targetModuleOf 分配 kernel。 | 无；uncovered；not-exercised |
| `scope-suppressed` | currentScope.includes(attribution)==false；先执行 Builder/Template 和 ledger 记账，writeArtifact 再跳过文件写入。 | 无；uncovered；not-exercised |
| `mutation-reference-code-or-todo` | 无可用 formal render；有 BusinessLogic.referenceCode 则 verbatim，否则 TODO intent 加恒等 state；不是成功实现。 | F1来源候选；decision-required；not-exercised |
| `mutation-scalar-formal` | 无 put-all/remove-all；所有非空 fold 行可解析；set/put/remove/money-apply 按原序一次 state.copy；任一行失败整组回退。 | 无；uncovered；not-exercised |
| `mutation-collection-formal` | 任一行 put-all/remove-all 则整组 collectionFolds；全部行只容许 put/remove/put-all/remove-all；Template 原序 state.copy。 | 无；uncovered；not-exercised |
| `helper-method-slots` | helperMethods 非空；按原序生成 private def、参数知识注释和 AI_PROMPT，实际 body 恒 ???，referenceCode 只进入 prompt。 | F1来源候选；decision-required；not-exercised |

### invariant-rule

原定义：[details](../details/invariant-rule.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `classic-single` | 传统 CodegenMain -> runCommon -> domain.invariants.foreach；每个 metadata 一次 MBT，writer scope 包含 attribution；multiProject=false | F1来源候选；decision-required；not-exercised |
| `classic-multi` | 同一传统 MBT 且 multiProject=true；kind=rules 映射 kernel | 无；uncovered；not-exercised |
| `empty-invariants` | domain.invariants 为空 | 无；uncovered；not-exercised |
| `scope-excluded` | currentScope.includes(attribution)=false；Builder/Template 与 writer 记账已在源文件写入 skip 前发生 | 无；uncovered；not-exercised |
| `empty-conditions` | metadata 存在但 conditions 为空；并非制品级抑制条件 | 无；uncovered；not-exercised |
| `reference-code-present-or-absent` | 每个 condition 的 BusinessLogic.referenceCode 为 Some 或 None | 无；uncovered；not-exercised |

### domain-service

原定义：[details](../details/domain-service.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `service-object-single` | 传统 CodegenMain 分支遍历 system.domain.services；每个服务一个候选文件；writer scope/领地策略可抑制实际写入 | F1来源候选；decision-required；not-exercised |
| `service-object-multi-root-fallback` | multiProject=true；targetModuleOf 对 domain-service 返回 None；writeArtifact 使用 app fallback，不是 kernel 模块 | 无；uncovered；not-exercised |
| `empty-services` | system.domain.services 为空 | 无；uncovered；not-exercised |
| `empty-methods` | 服务存在但 methods 为空；同一模板仍输出 extends DomainService 的空 object | 无；uncovered；not-exercised |

### application-protocol

原定义：[details](../details/application-protocol.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `traditional-aggregate` | 非 semanticProductsFile 的传统 runCommon；generateApplicationLayer 遍历 app.aggregates，每个普通聚合构造一次 Protocol；实际落盘仍受 scope/territory 约束 | F1来源候选；decision-required；not-exercised |
| `traditional-transactor-attribution` | app.aggregates 中 meta.metaCategory == application.services.transactor；使用相同 MBT 和 application.aggregates 包，kind=protocol，schemaCategory=saga | 无；uncovered；not-exercised |
| `reply-to-present` | cmd.replyToType 为 Some；原业务参数后追加 FieldDef(replyTo, ActorRef[ResolvedReply])，无默认、无合成 noteId | F1来源候选；decision-required；not-exercised |
| `reply-to-absent` | cmd.replyToType 为 None；不追加 replyTo，不推断默认 Reply；目标 Actor 命令缺少明确回复合同则阻断该输入 | 无；uncovered；not-exercised |
| `handler-pair` | stateType.zip(eventType) 非空；传统 Builder 始终给两者 Some；alias 名全量替换 Command 为 CommandHandler，RHS=(State, CommandFamily)=>Effect[Event, State] | F1来源候选；decision-required；not-exercised |
| `inline-state-template-only` | Model.state 为 Some 时 Template 发 TransactionEvent、Status、State、applyEvent=???、empty(id)=State(id=Some(id))；本传统 Builder 固定 state=None | 无；uncovered；not-exercised |
| `scope-or-territory-suppressed` | writer scope 不包含 attribution，或已有领地 KEEP/冻结规则拒写；不能用模型数量冒充文件写入数量 | 无；uncovered；not-exercised |

### aggregate-factory

原定义：[details](../details/aggregate-factory.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `bare-reference-only` | app.aggregates 中的聚合进入传统应用层调度；按原命令顺序 find(!isReadOnly && parameters.nonEmpty) 为 None；writer scope 允许。一个 Factory 文件，仅裸引用方法；仍发 Inject、implicit EC 和 10 秒 askTimeout。 | 无；uncovered；not-exercised |
| `reference-and-initialize` | 原序第一个非只读且带参数的命令存在并声明 replyToType；同一 Factory 文件先裸引用方法后 ask 初始化方法；factoryMethods 首带参方法只提供方法名。 | F1来源候选；decision-required；not-exercised |
| `initialization-missing-reply` | find 命中但所选命令没有 replyToType；Builder 抛 IllegalStateException，不生成该 Factory 的成功输出；此前 Root/Protocol 可能已经落盘。 | 无；uncovered；not-exercised |
| `transactor-attribution` | app.aggregates 中 metaCategory 为 application.services.transactor，仍调用同一 Factory MBT；attribution=saga-participant，BC multi targetModuleOf 无对应项，回退 app 根。方法条件仍按上述变体。 | 无；uncovered；not-exercised |
| `no-aggregate-or-scope-suppressed` | 没有聚合，或 writer scope 排除 attribution；无 Factory 落盘。scope 检查晚于 build/render，不能绕过初始化缺回复错误。 | 无；uncovered；not-exercised |

### aggregate-behavior

原定义：[details](../details/aggregate-behavior.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `policy-groups` | app.aggregates 中可解析 BehaviorMetadata 的非只读 flows；有任一 handler 时保留原业务组顺序。 | F1来源候选；decision-required；not-exercised |
| `query-group` | isReadOnly 命令非空；必须显式 replyToType；追加 QueryBehaviors。Get*StateReply 之外保留原始 ??? 回复槽。 | F1来源候选；decision-required；not-exercised |
| `transient-fallback` | 全部既有写组无 handler；逐个匹配 Run/Complete/Fail+base，不要求三件套齐全；应用侧 Instant.now 与 CmdReply(None) 待裁定。 | 无；uncovered；not-exercised |
| `formal-rule-group` | 同名 formal aggregate，未覆盖非只读命令的 produced events/bindings/guards 全部可解析；追加 FormalRuleBehaviors。 | 无；uncovered；not-exercised |
| `empty-apply-slot` | commandHelpers 有值但无可调用组或所有 handlers 为空；MANUAL apply 内原始 ???。 | 无；uncovered；not-exercised |
| `without-helpers-context` | Template 接收 commandHelpers=None、contextType=Some；生成 actor setup，且仅接第一组。 | 无；uncovered；not-exercised |
| `without-helpers-repository` | Template 接收 commandHelpers=None、contextType=None；从 dependencies 找 Repository，缺省 Any；保留 PID 和 first-group-only 原始体。 | 无；uncovered；not-exercised |
| `multi-project-layout` | multiProject=true 且 kind=behavior-skeleton；targetModuleOf 映射 kernel；与逻辑分支正交。 | 无；uncovered；not-exercised |
| `scope-suppressed` | writer scope 不包含 attribution 时记账后跳过写入，与空行为模型不同。 | 无；uncovered；not-exercised |

### command-helper

原定义：[details](../details/command-helper.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `ordinary-write` | meta.metaCategory != application.services.transactor；formalReplyName 不可选中；逐命令排除 isReadOnly，保留元数据原顺序。每聚合一个文件，每写命令一个 implicit object。 | F1来源候选；decision-required；not-exercised |
| `formal-single-slot` | 非 transactor；formalSemantics 中 aggregate 与 meta.name 相等，guards 或 emissions 非空，且 replyFamily.replies.headOption 存在。命名 Params 在 domain.invariants.root 下的 <meta.name>Rules 内；写命令回复取族首项。源码未核验其构造器确为单 error 槽。 | 无；uncovered；not-exercised |
| `formal-without-first-reply` | formal guards/emissions 存在但回复族为空，formalReplyName=None，raw 退回普通推断而非自动拒绝；目标需 D1/D5 裁定。 | 无；uncovered；not-exercised |
| `read-only-suppressed` | isReadOnly 命令被 Builder.filterNot 排除，不生成该命令 Helper；内部只读回复推断分支因此不可达。混合聚合仍有其余写命令的文件。 | F1来源候选；decision-required；not-exercised |
| `empty-write-set` | 非 transactor 但无写命令，raw 仍产生空 Helpers trait 并导入 CommandHelper；目标是否抑制空文件需 D8 裁定。 | 无；uncovered；not-exercised |
| `transactor-suppressed` | meta.metaCategory == application.services.transactor 时 CQRSApplicationGenerator L660–678 不调用本族 Builder/Template，零文件。 | 无；uncovered；not-exercised |
| `scope-suppressed` | writeArtifact 先记录 attribution/dependencies/noteIds/morphisms，随后 currentScope.includes=false 时 return，不写内容；不是 Builder 未执行。 | 无；uncovered；not-exercised |

### aggregate-rules-formal

原定义：[details](../details/aggregate-rules-formal.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `formal-single-project` | 非 application.services.transactor；formalSemantics 有同名 aggregate；eventFamilyRef 与 stateRef 元数据可解析；至少一个非只读命令的所有 produced event 槽位及全部 guards 可解析；writer concern scope 包含该制品。 | 无；uncovered；not-exercised |
| `formal-multi-project-raw-fallback` | 同上且 multiProject=true；raw 的 rules-formal 未列入 targetModuleOf 的 rules 分支，因此走 app 兜底，不是 kernel。 | 无；uncovered；not-exercised |
| `suppressed-by-dispatch-or-builder` | Saga transactor 调度排除；或 formal 缺省/找不到同名 aggregate/event family/state；或无非只读命令；或全部命令缺事件/绑定不可解析/guard 不支持。 | 无；uncovered；not-exercised |
| `no-guards-and-zero-payload-event` | 命令有可解析 produced event，可以没有 guards；事件字段为空时不要求 emission binding 行。 | 无；uncovered；not-exercised |
| `template-only-emission-none` | 外部直接构造 RuleModel(emission=None) 时 T 渲染 Right(Nil)；正常 B 对通过的命令要求 produced 非空，故这不是正常 builder 的缺实现兜底。 | 无；uncovered；not-exercised |

### aggregate-repository-port

原定义：[details](../details/aggregate-repository-port.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `single-default` | 传统 runCommon 的 app.repositories 中每条 AggregateRepositoryMetadata；其他 RepositoryMetadata 在该分派不输出。Builder 成功后计划一文件，scope/领地策略可能跳过实际写盘。 | F1来源候选；decision-required；not-exercised |
| `multi-default` | 同一 metadata 条件且实际 multiProject 开启；repository-iface 路由 kernel | 无；uncovered；not-exercised |
| `declared-query-methods` | 合成 entityRef 首位；声明 QueryMethod 先构造再过滤同名 entityRef，其他 QueryMethod 保留顺序；非 QueryMethod 忽略 | 无；uncovered；not-exercised |
| `knowledge-present-or-absent` | aggregate noteId 控制容器注释；QueryMethod 参数 noteId 控制参数锚；缺来源不发射、不编造 hash | 无；uncovered；not-exercised |
| `non-aggregate-repository` | app.repositories 元素不是 AggregateRepositoryMetadata | 无；uncovered；not-exercised |

### external-connector-port

原定义：[details](../details/external-connector-port.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `single-project` | system.application.connectors 的每项经 ConnectorBuilder/ConnectorTemplate 生成；multiProject=false；writeArtifact 的 scope 守卫允许实际写入。 | 无；uncovered；not-exercised |
| `multi-project-fallback` | multiProject=true；connector-iface 未在 targetModuleOf 注册，返回 None 并落 root app。 | 无；uncovered；not-exercised |
| `script-param` | ConnectorMethodMetadata.scriptParam=None 时 def m()；Some(p) 时 def m(p: String)，没有参数默认值。 | 无；uncovered；not-exercised |
| `knowledge-comment` | noteId=Some(id) 时 trait 注解前发知识注释，并按现有元素 hash 表追加后缀；None 不发。方法 noteId 不被本模板消费。 | 无；uncovered；not-exercised |
| `empty-methods` | 某 connector methods=Nil，仍发 package/import/说明/可选知识注释/ImplementedBy/空 trait。 | 无；uncovered；not-exercised |
| `no-connectors` | ApplicationLayer.connectors=Nil。 | 无；uncovered；not-exercised |
| `scope-suppressed` | currentScope.includes(attribution)=false；writer 在记录 ledger/morphisms 之后跳过文件写入。 | 无；uncovered；not-exercised |

### application-service

原定义：[details](../details/application-service.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `classic-single` | 传统 runCommon -> generateApplicationLayer 遍历 app.services；每个 ApplicationServiceMetadata 调 Builder/Template/writeArtifact；scope 与领地可抑制实际写入 | 无；uncovered；not-exercised |
| `classic-multi-root-fallback` | multiProject=true；targetModuleOf 没有 application-service，返回 None；writeArtifact 使用 app fallback，非 kernel/glue | 无；uncovered；not-exercised |
| `empty-services` | app.services.isEmpty | 无；uncovered；not-exercised |
| `empty-methods` | 服务存在但 methods.isEmpty；仍输出带注入构造器的空 class | 无；uncovered；not-exercised |
| `actor-system-member` | model.dependencies.exists(_.name == ActorSystem)；同文件发 private val system = classicSystem.toTyped；constructor 另有过滤条件，二者不完全等价 | 无；uncovered；not-exercised |

### query-service

原定义：[details](../details/query-service.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `query-class` | 传统 runCommon → generateApplicationLayer 的 app.queries.foreach；每个 QueryServiceMetadata 一文件，空列表不输出；scope/territory 仍可能抑制实际写入 | 无；uncovered；not-exercised |
| `query-with-structs` | model.structs.map(renderStruct).mkString 非空；同文件在 class 前输出一个 companion，structs/fields 均按输入顺序 | 无；uncovered；not-exercised |
| `timeout-model-branch` | Template 的 model.dependencies 含短名 Timeout 才输出 askTimeout；正常 QueryServiceBuilder 最终剔除全部短名 Timeout，因此生产链此分支被抑制，不能由 invokes 推断启用 | 无；uncovered；not-exercised |
| `multi-project-fallback` | multiProject=true，但 targetModuleOf 没有 query-service 分支，writer fallback 为 app，不自动落 modules/kernel 或 modules/glue | 无；uncovered；not-exercised |

### saga-trigger-protocol

原定义：[details](../details/saga-trigger-protocol.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `classic-single-project-per-saga` | CodegenMain 传统链进入 runCommon.generateApplicationLayer；对每个 app.sagas，前置 participant/definition 构建完成且 writer scope/territory 允许写入。 | 无；uncovered；not-exercised |
| `classic-multi-project-fallback` | multiProject=true；saga-trigger-protocol 不在 targetModuleOf 表中，None 分支回落 app，而不是 modules/glue。 | 无；uncovered；not-exercised |
| `no-sagas` | app.sagas 为空。 | 无；uncovered；not-exercised |
| `no-update-command` | 可到达本族且没有名字以 Update 开头的命令；状态命令名回退 Update<Base>SagaStatus，字段仍为 String/TransactionResult/typed replyTo。 | 无；uncovered；not-exercised |
| `zero-trigger-template` | 单独本 Builder/Template 对 N=0 不抑制文件，仍发状态命令和确认；不证明完整链及首命令驱动 Behaviors 可执行。 | 无；uncovered；not-exercised |

### saga-trigger-entity

原定义：[details](../details/saga-trigger-entity.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `classic-present-single-project` | runCommon 的 generateApplicationLayer 遍历 app.sagas；args 为 Some；前序生成未失败且 scope/territory 允许写。每条 metadata 一份 Entity；代码没有独立 version == 3 判断。 | 无；uncovered；not-exercised |
| `classic-present-multi-project` | multiProject=true；saga-trigger-entity 未列入 targetModuleOf，raw writer fallback app，不自动落 kernel module。 | 无；uncovered；not-exercised |
| `no-sagas` | app.sagas 为空，本族不调度。 | 无；uncovered；not-exercised |
| `missing-args` | meta.args=None；buildEntity 抛 RuntimeException，不是成功 suppression；整个链可能已有更早制品写入。 | 无；uncovered；not-exercised |
| `empty-args` | args=Some 且 fields 为空；Builder 无拒绝，Template 发 TransactionInitiated(, timestamp: Long)，需裁定拒绝或 timestamp-only。未验证更上游准入。 | 无；uncovered；not-exercised |
| `scope-or-territory-skip` | writeArtifact 可在记账后 scope return，或 territorial writer 不写入；模型计数不能当实际写成文件数。 | 无；uncovered；not-exercised |

### saga-trigger-root

原定义：[details](../details/saga-trigger-root.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `classic-v3-context-explicit` | 传统 runCommon 的 app.sagas.foreach 中一项；meta.context=Some(c)，前置 definition/entity 构建成功且 scope 包含该 attribution；每项一个 Root。 | 无；uncovered；not-exercised |
| `classic-v3-context-fallback` | 同一经典 Saga 循环，meta.context=None；仅解析 context 类型名，不保证对应 context 文件存在。 | 无；uncovered；not-exercised |
| `classic-v3-multi-project-fallback` | multiProject=true；saga-trigger-root 未列入 targetModuleOf，返回 None 后 writer 使用 app 前缀；不可推断为 modules/glue。 | 无；uncovered；not-exercised |
| `suppressed-no-saga-or-scope` | app.sagas 为空则本族零文件；scope 不包含 attribution 时模型和模板已求值、ledger 已记录，writer 随后跳过写入。 | 无；uncovered；not-exercised |

### saga-trigger-behaviors

原定义：[details](../details/saga-trigger-behaviors.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `classic-v3-single-project` | 传统 CodegenMain -> runCommon -> generateApplicationLayer 对 app.sagas 逐项执行；前置构建成功且 writer scope 包含 saga-trigger-behaviors attribution。 | 无；uncovered；not-exercised |
| `classic-v3-multi-project-fallback` | multiProject=true；targetModuleOf 未登记该 kind，实际 fallback 为 app。 | 无；uncovered；not-exercised |
| `no-sagas-or-scope-suppressed` | app.sagas 为空，或构建后 writer scope 排除本 attribution；scope 排除发生在记账之后。 | 无；uncovered；not-exercised |
| `invalid-args-or-trigger-shape` | args=None 显式抛错；零 trigger/零参数/异构 triggers 没有完整准入诊断，首 trigger 参数复用和逗号问题须 D2 裁定。 | 无；uncovered；not-exercised |

### aggregate-repository-implementation

原定义：[details](../details/aggregate-repository-implementation.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `classic-sharding-single` | CodegenMain 传统 runCommon；system.infrastructure.repositories 中每个 AggregateRepositoryMetadata；multiProject=false；writer 的 scope/领地规则允许时实际写入。storage 不参与本 Builder 分支。 | F1来源候选；decision-required；not-exercised |
| `classic-sharding-multi` | 同一传统 Model/Builder/Template；multiProject=true；repository-impl 由 targetModuleOf 分配至 glue；不是独立内容模板。 | 无；uncovered；not-exercised |
| `absent-or-suppressed` | 没有 AggregateRepositoryMetadata 时本项 0 文件；scope 不包含 attribution 或领地 KEEP 时不实际覆盖。ProjectionRepositoryMetadata 属另一制品。 | 无；uncovered；not-exercised |

### projection-repository-port

原定义：[details](../details/projection.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `table-single` | ProjectionRepositoryMetadata; default/table storage; multiProject=false | 无；uncovered；not-exercised |
| `table-multi` | table/default storage; multiProject=true; omit ImplementedBy and implementation dependency | 无；uncovered；not-exercised |
| `mongo` | MongoDocumentMetadata; table-shape port with MongoRepositoryImpl binding; single/multi source root as above | 无；uncovered；not-exercised |
| `graph` | Neo4jGraphMetadata; declared methods and schema DTO; single/multi are alternative roots | 无；uncovered；not-exercised |
| `vector` | PgVectorTableMetadata; fixed upsert/findByIdentity/delete/search, not metadata.methods; alternative single/multi roots | 无；uncovered；not-exercised |

### projection-repository-implementation

原定义：[details](../details/projection.json#/diffs/1)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `jdbc-table` | TableMetadata/default branch; one implementation per metadata; alternative single/multi roots | 无；uncovered；not-exercised |
| `graph` | Neo4jGraphMetadata; strict executor verbs; mergeLinkTolerant remains manual ???; unknown verbs fail | 无；uncovered；not-exercised |
| `vector` | PgVectorTableMetadata; injected PgVectorStore then embeddingClient; fixed methods and row mapper | 无；uncovered；not-exercised |
| `mongo` | MongoDocumentMetadata; injected MongoViewStore; JSON string API; optional kind discriminator | 无；uncovered；not-exercised |
| `unsupported-storage-fallback` | EsIndexMetadata/RedisKeyMetadata reach default table fallback; not genuine ES/Redis implementations | 无；uncovered；not-exercised |

### connector-implementation

原定义：[details](../details/connector-implementation.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `single-project` | 每个 system.infrastructure.connectors 元素；非 multiProject | 无；uncovered；not-exercised |
| `multi-project-app-fallback` | multiProject=true，但 targetModuleOf 未登记 connector-impl，走 None -> app | 无；uncovered；not-exercised |
| `helper-with-script` | helperNames 非空且解析到的首接口方法 script 有值；注入全部 helper，默认只调用第一个 | 无；uncovered；not-exercised |
| `helper-without-script` | helperNames 非空且无首方法 script，包括接口或方法 lookup 无结果的 fallback | 无；uncovered；not-exercised |
| `no-helper` | helperNames 为空；不发显式构造参数和 @Inject()，raw dependencies 仍包含 Inject | 无；uncovered；not-exercised |
| `zero-connectors` | system.infrastructure.connectors 为空 | 无；uncovered；not-exercised |

### projection-apply-event

原定义：[details](../details/projection.json#/diffs/2)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `absent` | model.applyEvents.isEmpty; ordinary single-project Builder returns Nil; no file | 无；uncovered；not-exercised |
| `create` | multiProject; nonempty applyEvents with create records; onEvent(Option[View],Event):View in one shared file | 无；uncovered；not-exercised |
| `update-only` | multiProject; updateOnly form; onEvent(View,Event):View | 无；uncovered；not-exercised |
| `delete` | multiProject; delete form; onEvent(Event):(String,String); incomplete key extraction must not be called exact | 无；uncovered；not-exercised |
| `persistence-id-create` | multiProject; persistenceIdCreate; onEvent(Event,String):View; invalid existing fallback documented | 无；uncovered；not-exercised |
| `degraded-records` | nonempty applyEvents whose degraded records are omitted as methods; all-degraded can still write an empty object/import file; graph dialect follows this path | 无；uncovered；not-exercised |

### projection

原定义：[details](../details/projection.json#/diffs/3)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `single-handler` | aggregateSources empty and handlers.size=1; direct new Handler(repository) | 无；uncovered；not-exercised |
| `composite` | aggregateSources empty and handlers.size>1; all constructed, routable subset dispatched | 无；uncovered；not-exercised |
| `multi-source` | aggregateSources nonempty; per-active-source provider/factory/private composite inside one file; applies independently of single/multi physical source roots | 无；uncovered；not-exercised |
| `empty-handlers-rejected-by-head` | Template accesses model.handlers.head; no valid empty-handler projection output established | 无；uncovered；not-exercised |

### projection-handler

原定义：[details](../details/projection.json#/diffs/4)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `single-manual` | multiProject=false; family-level event match with MANUAL ???; one file per nested handler | 无；uncovered；not-exercised |
| `multi-graph-manual` | multiProject=true and selfType.name contains GraphView; manual skeleton independent of actual storage type | 无；uncovered；not-exercised |
| `multi-degraded-manual` | multiProject non-GraphView and missing/unrecognized refCode head; no ViewMachine call | 无；uncovered；not-exercised |
| `multi-create` | recognized dialect; create/default; ViewMachine.run decode/identity/read/applyEvent/write | 无；uncovered；not-exercised |
| `multi-update-only` | recognized dialect and applyForm=updateOnly; row-signature kernel callback | 无；uncovered；not-exercised |
| `multi-delete` | recognized dialect and applyForm=delete; PO decode then pure keys then repo.delete | 无；uncovered；not-exercised |
| `multi-persistence-id` | recognized dialect and applyForm=persistenceIdCreate; PID tail, fixed duplicate identity tuple, two-argument read | 无；uncovered；not-exercised |

### aggregate-state-controller

原定义：[details](../details/aggregate-state-controller.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `single-enabled` | multiProject=false；system.application.aggregates 中 repository.isDefined 且命令名等于 Get${a.name}State 的条目非空；scope 与领地允许写入 | 无；uncovered；not-exercised |
| `multi-enabled-root` | multiProject=true，其余 eligible/scope/territory 条件同 single；controller kind 分配 root | 无；uncovered；not-exercised |
| `suppressed-no-eligible-aggregate` | repository/Get${a.name}State 过滤结果为空，dispatch 直接 return | 无；uncovered；not-exercised |
| `scope-or-territory-suppressed` | 已构建模型，但 scope 不包含 attribution 或写入领地 KEEP/拒写；ledger 记录在 scope return 之前 | 无；uncovered；not-exercised |
| `shared-writer-combinations` | anyInstant 检查 state field signature 包含 Instant；anyId 检查 signature 包含 Id 且 typeRef.name != String；两条件独立 | 无；uncovered；not-exercised |

### http-controller

原定义：[details](../details/http-controller.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `legacy-stub` | ControllerMetadata 存在且 dslFlags.aggHasDsl=false；raw 模板对全部 endpoints 发 stub，包括全部 skip 后退回此分支的情况；本次未生成 | 无；uncovered；not-exercised |
| `dsl-command-path` | 存在 non-skip gate 端点；tenant Command 的 Id 参数与 aggregate.identifier.name 相同，按 Path 寻址；本次未生成 | 无；uncovered；not-exercised |
| `dsl-command-factory` | active tenant/global Command 没有 pathKey，按 Factory 发号；可叠加 empty-body、IdGuard、InstantGuard；本次未生成 | 无；uncovered；not-exercised |
| `dsl-conflict` | active Command 的 errorPayloads 非空且符合单聚合单投影约定；首个 payload 用于预查冲突，全部 payload 用于尾部 VO 声明；本次未生成 | 无；uncovered；not-exercised |
| `dsl-flow-anonymous` | anonymous GateKind + ServesUseCase + requestBody，生成 Flow 委托；非匿名 Flow 不在 raw 发射集；本次未生成 | 无；uncovered；not-exercised |
| `dsl-view` | tenant/global ServesView；精确 list/item 签名；复合 item 仅 tenant；按需生成 pageGuard、tenantList、globalList、tenantItem、globalItem、compositeItem；本次未生成 | 无；uncovered；not-exercised |
| `mixed` | DSL controller 内 gate=None 端点保留 raw stub；skip 只在 DSL 分支过滤；本次未生成 | 无；uncovered；not-exercised |
| `skip-and-rejection` | VO-List/read-only 标 skip；全 skip 退回 stub 是待裁定缺陷。悬空引用、多聚合、多投影、匿名读/命令直发等抛异常；不承诺整个生成事务回滚 | 无；uncovered；not-exercised |

### command-endpoint-dsl

原定义：[details](../details/command-endpoint-dsl.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `gate-declared-single` | 传统 runCommon 的 generateInterfaceLayer 中，interfaces.controllers.exists(_.endpoints.exists(_.gate.isDefined)) 为 true；单工程；前置 Controller 构建及 writer 保护条件允许写入。 | 无；uncovered；not-exercised |
| `gate-declared-multi-root` | 同一 gate 存在条件；multiProject=true，kind command-dsl 映射 root，不能放入 modules/kernel。 | 无；uncovered；not-exercised |
| `gate-none` | 无 controllers、无 endpoints 或全部 gate=None；Builder 返回 None。 | 无；uncovered；not-exercised |

### route-definition

原定义：[details](../details/route-definition.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `gated-controller-fragment` | ControllerModel.endpoints 中 gate.isDefined && skip.isEmpty 的路由行非空；ControllerModel/endpoint 输入顺序保留 | 无；uncovered；not-exercised |
| `no-active-endpoints` | routeLines.isEmpty，RoutesBuilder.build 返回 None | 无；uncovered；not-exercised |
| `single-project` | multiProjectMode=false；规范化 outputRoot 的 parent 为 projectRoot，通常 outputRoot=<target>/app | 无；uncovered；not-exercised |
| `multi-project` | multiProjectMode=true；outputRoot 就是 projectRoot，不根据目录名判断 | 无；uncovered；not-exercised |
| `writer-new-file` | 模型非空且目标不存在；三行 NewFileHeader 紧接 block，再加末 LF | 无；uncovered；not-exercised |
| `writer-replace-first-pair` | 目标包含首个 start 之后的 end；quote/replaceFirst 替换含两标记的整段 | 无；uncovered；not-exercised |
| `writer-append` | 目标完全没有标记；trim 尾随空白，添加双 LF、AppendNotice、block、末 LF | 无；uncovered；not-exercised |
| `writer-malformed` | 未形成 start 后 end，且并非完全无标记；抛 IllegalStateException；并不完整检查重复标记 | 无；uncovered；not-exercised |

### bootstrap

原定义：[details](../details/bootstrap.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `aggregate` | system.application.aggregates.foreach；每聚合一次；A=0抑制 | F1来源候选；decision-required；not-exercised |
| `saga-coordinator` | system.application.sagas.nonEmpty；全系统一次，不是每个Saga一次 | 无；uncovered；not-exercised |
| `saga-transactor` | system.application.sagas.foreach；每classic Saga一次；S=0抑制 | 无；uncovered；not-exercised |
| `projection` | system.infrastructure.projections.foreach；每projection一次；P=0抑制 | 无；uncovered；not-exercised |

### application-bootstrap

原定义：[details](../details/application-bootstrap.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `classic-empty-strict` | 传统 runCommon 到达 generateBootstraps 末尾且 strictEntries 为空；无条件构造一次总装配 Model。saga 注册按原顺序，非空时一个 engine，然后聚合、投影；scope 与 territorial writer 可阻止实际落盘。 | F1来源候选；decision-required；not-exercised |
| `strict-single` | single-project，admitted strict plan 提供恰好一个 entry FQN；同一 class 追加 strictSagaCoordinator 和其后的 installEventSource。 | 无；uncovered；not-exercised |
| `strict-many` | single-project，strictEntries.size=N>1；同一 class 顺序追加 strictSagaCoordinator0 至 strictSagaCoordinator(N-1)，每项 spawn 后立即 install；Builder 不去重。 | 无；uncovered；not-exercised |
| `multi-project` | codegen.multiProject=true；kind=bootstrap 路由到 glue；仍生成总装配，但 runCommon 强制 strictEntryFqns=Seq.empty。 | 无；uncovered；not-exercised |
| `empty-traits` | aggregates、classic sagas、projections 均为空；strictEntries 不贡献 traits；raw 仍发 extends 后空串，产生非法 extends 子句。拒绝、抑制或省略 extends 待 D3 裁定。 | 无；uncovered；not-exercised |

### strict-saga-module

原定义：[details](../details/strict-saga-module.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `admitted-v3-single` | CodegenMain 的显式 codegen.sagaExecutionV3 经实际 base 准入且 sagas 非空；StrictSagaGenerationPlan 准备成功，multiProject=false，writer scope 接受。每 admitted saga 一个模块；整条 CLI 还发其他层和 fixture-host。当前未运行。 | 无；uncovered；not-exercised |
| `admitted-v3-multi` | 同一 admitted v3 条件，multiProject=true；targetModuleOf(strict-saga-module)=glue。每 admitted saga 一个模块。当前未运行。 | 无；uncovered；not-exercised |
| `suppressed` | 未提供 strict slot 或 writer scope 排除 strict-saga-module 时本族零输出；不是缺少 Template。当前未运行。 | 无；uncovered；not-exercised |
| `invalid-admission` | 空 sagas、实际 base 不匹配、unsafe/碰撞输出、unsupported source 或类型形状等拒绝，不制造空成功模型。当前未运行。 | 无；uncovered；not-exercised |

### strict-fixture-host

原定义：[details](../details/strict-fixture-host.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `suppressed` | CodegenMain traditional 分支没有 admitted strict plan；本族输出零文件。未运行。 | 无；uncovered；not-exercised |
| `money-single` | strict plan 每个 model；moneyCodecName.nonEmpty；!multiProject。T 为隔离目标绝对根，P 为 module package 的斜线形式；五个 production 文件加两个 test。没有本轮同输入输出。 | 无；uncovered；not-exercised |
| `collection-single` | strict plan；moneyCodecName 为空；argsFields 含 FixtureCollectionShape；!multiProject。两份 test 读取 bounded-collection 资源。未运行。 | 无；uncovered；not-exercised |
| `strict-multi` | strict plan 且 multiProject；五个 production 文件归 glue，test 与 strict entry bootstrap wiring suppress。Builder 仍要求第二 step funding。未运行。 | 无；uncovered；not-exercised |
| `unsettled-shape-combinations` | money+collection、text-only、empty args 的 production/test 分支选择不等于可用 profile；需要 D4 明确准入或扩展，不虚构成功输出。 | 无；uncovered；not-exercised |

### composition-invocation-host

原定义：[details](../details/composition-invocation-host.json#/diffs/0)。

| 原ID | 原condition | 候选 / 状态 |
|---|---|---|
| `host` | CodegenMain systemFile/systemBindings + sagaExecutionV3 + executionBinding admitted；CQRSApplicationGenerator composition.isDefined、strict.isDefined、single-project；计划1份，scope及领地可阻止实际写入 | 无；uncovered；not-exercised |
| `child-plan` | 同一admitted composition，计划1份；保留父pipeline与child pipeline双来源键 | 无；uncovered；not-exercised |
| `recovery-spec` | 同一single-project composition，计划1份；包含完整composition-recovery资源及E5；仅源码观察，未执行 | 无；uncovered；not-exercised |
| `deployment-spec` | 同一single-project composition，计划1份；含facts object、test node main、两个模式suite；仅源码观察，未执行 | 无；uncovered；not-exercised |
| `absent-or-rejected` | composition未提供时输出0份；有composition但无strict或multi-project时拒绝，不能标成已覆盖的suppressed变体 | 无；uncovered；not-exercised |

### 未另造ID的十族

value-object、domain-entity、aggregate-root、saga-participant、saga-definition、proto-converter、event-adapter、snapshot-adapter、saga-context没有对应structured scalaVariants；其原dispatch/Builder/模板/验收条件以机器表conditionEvidence的原文和行指针保留，不能虚构统一variant名。protobuf-schema也无structured表，但保留原Markdown两名如下。

| 原ID | 原条件/基数 | 当前 |
|---|---|---|
| `aggregate` | 每个 `app.aggregates`，A 个 | F1 aggregate来源候选；decision-required；not-exercised |
| `shared-value-objects` | `buildShared` 得到非空 messages，0 或 1 | 无专属shared输入；uncovered；not-exercised |

## 6. B侧：308逻辑出现位置，不与A族候选混计

机器表`bOccurrences`逐条保存原`id`、`classification=B`、原variant/role/sourceLogicalIds/catalogRefs、目标paths、目标construct指针、原fixture ID和精确`../js-partition.json#/logicalOutputs/<i>/fixture`。`fixtureMetadataRef`指向本文件`bFixtureRequirements`中的完整原fixture元数据；197个原ID有292种不同metadata，只有完全相同的对象才共享，不能因同ID吞掉不同requiredConditions。

本轮 **308/308已建立文档反查，0/308绑定已建立的F1/F2同输入，308/308 uncovered，0 exercised**。原有`specified-not-executed`仅是条件规格。A侧F1/F2候选不自动传递到B；一条“双warehouse同类型”条件也不是本次单Warehouse来源fixture。

| 来源fragment | B出现位置 | 当前 |
|---|---:|---|
| `family-domain-aggregate` | 13 | 原fixture/pointer齐；uncovered/not-exercised |
| `family-readside-play` | 42 | 原fixture/pointer齐；uncovered/not-exercised |
| `family-seams-saga` | 23 | 原fixture/pointer齐；uncovered/not-exercised |
| `formal-application` | 47 | 原fixture/pointer齐；uncovered/not-exercised |
| `formal-domain` | 16 | 原fixture/pointer齐；uncovered/not-exercised |
| `formal-service` | 55 | 原fixture/pointer齐；uncovered/not-exercised |
| `integrator-addendum` | 1 | 原fixture/pointer齐；uncovered/not-exercised |
| `legacy-application` | 18 | 原fixture/pointer齐；uncovered/not-exercised |
| `legacy-domain` | 15 | 原fixture/pointer齐；uncovered/not-exercised |
| `legacy-orchestration` | 38 | 原fixture/pointer齐；uncovered/not-exercised |
| `ordinary-review` | 16 | 原fixture/pointer齐；uncovered/not-exercised |
| `retired-seven` | 24 | 原fixture/pointer齐；uncovered/not-exercised |

为便于人工按原ID查找，以下308行是机器表同一索引的紧凑视图；完整requiredConditions仅在共享metadata中保留一次，不新增308个任务。

| 原logical ID | 分类 | 原fixture ID | 原fixture精确指针 / 本地metadata |
|---|---|---|
| `family-domain-aggregate/apply-evidence/anchors` | B | `parity-family-apply-evidence-v1` | [源fixture](../js-partition.json#/logicalOutputs/5/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/0/metadataVariants/0/originalMetadata) |
| `family-domain-aggregate/apply-evidence/ledger` | B | `parity-family-apply-evidence-v1` | [源fixture](../js-partition.json#/logicalOutputs/6/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/0/metadataVariants/1/originalMetadata) |
| `family-domain-aggregate/build/core-plugins` | B | `parity-family-build-profiles-v1` | [源fixture](../js-partition.json#/logicalOutputs/7/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/1/metadataVariants/0/originalMetadata) |
| `family-domain-aggregate/build/core-project` | B | `parity-family-build-profiles-v1` | [源fixture](../js-partition.json#/logicalOutputs/8/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/1/metadataVariants/1/originalMetadata) |
| `family-domain-aggregate/build/core-properties` | B | `parity-family-build-profiles-v1` | [源fixture](../js-partition.json#/logicalOutputs/9/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/1/metadataVariants/2/originalMetadata) |
| `family-domain-aggregate/build/kernel-plugins` | B | `parity-family-build-profiles-v1` | [源fixture](../js-partition.json#/logicalOutputs/10/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/1/metadataVariants/0/originalMetadata) |
| `family-domain-aggregate/build/kernel-project` | B | `parity-family-build-profiles-v1` | [源fixture](../js-partition.json#/logicalOutputs/11/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/1/metadataVariants/3/originalMetadata) |
| `family-domain-aggregate/build/kernel-properties` | B | `parity-family-build-profiles-v1` | [源fixture](../js-partition.json#/logicalOutputs/12/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/1/metadataVariants/2/originalMetadata) |
| `family-domain-aggregate/decision/dispatch` | B | `parity-family-formal-decision-v1` | [源fixture](../js-partition.json#/logicalOutputs/15/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/2/metadataVariants/0/originalMetadata) |
| `family-domain-aggregate/exact-codecs/context` | B | `parity-family-exact-representations-v1` | [源fixture](../js-partition.json#/logicalOutputs/19/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/3/metadataVariants/0/originalMetadata) |
| `family-domain-aggregate/payload/command` | B | `parity-family-payload-separation-v1` | [源fixture](../js-partition.json#/logicalOutputs/23/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/4/metadataVariants/0/originalMetadata) |
| `family-domain-aggregate/tests/protobuf-roundtrip` | B | `parity-family-protobuf-v1` | [源fixture](../js-partition.json#/logicalOutputs/28/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/5/metadataVariants/0/originalMetadata) |
| `family-domain-aggregate/tests/replay` | B | `parity-family-folds-v1` | [源fixture](../js-partition.json#/logicalOutputs/29/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/6/metadataVariants/0/originalMetadata) |
| `family-readside-play/ancillary/anchors` | B | `parity-family-readside-play/ancillary/anchors` | [源fixture](../js-partition.json#/logicalOutputs/38/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/7/metadataVariants/0/originalMetadata) |
| `family-readside-play/ancillary/canonical` | B | `parity-family-readside-play/ancillary/canonical` | [源fixture](../js-partition.json#/logicalOutputs/39/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/8/metadataVariants/0/originalMetadata) |
| `family-readside-play/ancillary/compiled` | B | `parity-family-readside-play/ancillary/compiled` | [源fixture](../js-partition.json#/logicalOutputs/40/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/9/metadataVariants/0/originalMetadata) |
| `family-readside-play/ancillary/inputs` | B | `parity-family-readside-play/ancillary/inputs` | [源fixture](../js-partition.json#/logicalOutputs/41/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/10/metadataVariants/0/originalMetadata) |
| `family-readside-play/ancillary/knowledge-store` | B | `parity-family-readside-play/ancillary/knowledge-store` | [源fixture](../js-partition.json#/logicalOutputs/42/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/11/metadataVariants/0/originalMetadata) |
| `family-readside-play/ancillary/ledger` | B | `parity-family-readside-play/ancillary/ledger` | [源fixture](../js-partition.json#/logicalOutputs/43/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/12/metadataVariants/0/originalMetadata) |
| `family-readside-play/ancillary/request` | B | `parity-family-readside-play/ancillary/request` | [源fixture](../js-partition.json#/logicalOutputs/44/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/13/metadataVariants/0/originalMetadata) |
| `family-readside-play/api-authority` | B | `parity-family-readside-play/api-authority` | [源fixture](../js-partition.json#/logicalOutputs/45/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/14/metadataVariants/0/originalMetadata) |
| `family-readside-play/api-outcome-and-command-dto` | B | `parity-family-readside-play/api-outcome-and-command-dto` | [源fixture](../js-partition.json#/logicalOutputs/46/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/15/metadataVariants/0/originalMetadata) |
| `family-readside-play/application-admission-runtime` | B | `parity-family-readside-play/application-admission-runtime` | [源fixture](../js-partition.json#/logicalOutputs/48/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/16/metadataVariants/0/originalMetadata) |
| `family-readside-play/application-close-report` | B | `parity-family-readside-play/application-close-report` | [源fixture](../js-partition.json#/logicalOutputs/50/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/17/metadataVariants/0/originalMetadata) |
| `family-readside-play/application-components` | B | `parity-family-readside-play/application-components` | [源fixture](../js-partition.json#/logicalOutputs/51/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/18/metadataVariants/0/originalMetadata) |
| `family-readside-play/application-config` | B | `parity-family-readside-play/application-config` | [源fixture](../js-partition.json#/logicalOutputs/52/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/19/metadataVariants/0/originalMetadata) |
| `family-readside-play/application-lifecycle` | B | `parity-family-readside-play/application-lifecycle` | [源fixture](../js-partition.json#/logicalOutputs/53/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/20/metadataVariants/0/originalMetadata) |
| `family-readside-play/application-loader` | B | `parity-family-readside-play/application-loader` | [源fixture](../js-partition.json#/logicalOutputs/54/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/21/metadataVariants/0/originalMetadata) |
| `family-readside-play/application-settings` | B | `parity-family-readside-play/application-settings` | [源fixture](../js-partition.json#/logicalOutputs/55/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/22/metadataVariants/0/originalMetadata) |
| `family-readside-play/build-plugins/persistence` | B | `parity-family-readside-play/build-plugins/persistence` | [源fixture](../js-partition.json#/logicalOutputs/56/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/23/metadataVariants/0/originalMetadata) |
| `family-readside-play/build-plugins/play` | B | `parity-family-readside-play/build-plugins/play` | [源fixture](../js-partition.json#/logicalOutputs/57/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/24/metadataVariants/0/originalMetadata) |
| `family-readside-play/build-properties/persistence` | B | `parity-family-readside-play/build-properties/persistence` | [源fixture](../js-partition.json#/logicalOutputs/58/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/25/metadataVariants/0/originalMetadata) |
| `family-readside-play/build-properties/play` | B | `parity-family-readside-play/build-properties/play` | [源fixture](../js-partition.json#/logicalOutputs/59/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/26/metadataVariants/0/originalMetadata) |
| `family-readside-play/build/persistence` | B | `parity-family-readside-play/build/persistence` | [源fixture](../js-partition.json#/logicalOutputs/60/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/27/metadataVariants/0/originalMetadata) |
| `family-readside-play/build/play` | B | `parity-family-readside-play/build/play` | [源fixture](../js-partition.json#/logicalOutputs/61/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/28/metadataVariants/0/originalMetadata) |
| `family-readside-play/domain-command-payload` | B | `parity-family-readside-play/domain-command-payload` | [源fixture](../js-partition.json#/logicalOutputs/65/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/29/metadataVariants/0/originalMetadata) |
| `family-readside-play/exact-value-codec` | B | `parity-family-readside-play/exact-value-codec` | [源fixture](../js-partition.json#/logicalOutputs/71/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/30/metadataVariants/0/originalMetadata) |
| `family-readside-play/frame-protocol` | B | `parity-family-readside-play/frame-protocol` | [源fixture](../js-partition.json#/logicalOutputs/75/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/31/metadataVariants/0/originalMetadata) |
| `family-readside-play/http-authorization-gate` | B | `parity-family-readside-play/http-authorization-gate` | [源fixture](../js-partition.json#/logicalOutputs/76/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/32/metadataVariants/0/originalMetadata) |
| `family-readside-play/http-codec` | B | `parity-family-readside-play/http-codec` | [源fixture](../js-partition.json#/logicalOutputs/77/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/33/metadataVariants/0/originalMetadata) |
| `family-readside-play/http-errors` | B | `parity-family-readside-play/http-errors` | [源fixture](../js-partition.json#/logicalOutputs/79/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/34/metadataVariants/0/originalMetadata) |
| `family-readside-play/persistence-serializer` | B | `parity-family-readside-play/persistence-serializer` | [源fixture](../js-partition.json#/logicalOutputs/84/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/35/metadataVariants/0/originalMetadata) |
| `family-readside-play/readside-ddl` | B | `parity-family-readside-play/readside-ddl` | [源fixture](../js-partition.json#/logicalOutputs/89/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/36/metadataVariants/0/originalMetadata) |
| `family-readside-play/readside-envelope` | B | `parity-family-readside-play/readside-envelope` | [源fixture](../js-partition.json#/logicalOutputs/90/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/37/metadataVariants/0/originalMetadata) |
| `family-readside-play/readside-progress` | B | `parity-family-readside-play/readside-progress` | [源fixture](../js-partition.json#/logicalOutputs/95/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/38/metadataVariants/0/originalMetadata) |
| `family-readside-play/readside-runner-lifecycle` | B | `parity-family-readside-play/readside-runner-lifecycle` | [源fixture](../js-partition.json#/logicalOutputs/97/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/39/metadataVariants/0/originalMetadata) |
| `family-readside-play/readside-schema` | B | `parity-family-readside-play/readside-schema` | [源fixture](../js-partition.json#/logicalOutputs/98/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/40/metadataVariants/0/originalMetadata) |
| `family-readside-play/receipt-view` | B | `parity-family-readside-play/receipt-view` | [源fixture](../js-partition.json#/logicalOutputs/101/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/41/metadataVariants/0/originalMetadata) |
| `family-readside-play/resource-directory` | B | `parity-family-readside-play/resource-directory` | [源fixture](../js-partition.json#/logicalOutputs/102/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/42/metadataVariants/0/originalMetadata) |
| `family-readside-play/serialization-config` | B | `parity-family-readside-play/serialization-config` | [源fixture](../js-partition.json#/logicalOutputs/104/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/43/metadataVariants/0/originalMetadata) |
| `family-readside-play/technical-frame` | B | `parity-family-readside-play/technical-frame` | [源fixture](../js-partition.json#/logicalOutputs/105/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/44/metadataVariants/0/originalMetadata) |
| `family-readside-play/test/empty-replay` | B | `parity-family-readside-play/test/empty-replay` | [源fixture](../js-partition.json#/logicalOutputs/106/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/45/metadataVariants/0/originalMetadata) |
| `family-readside-play/test/frame-roundtrip` | B | `parity-family-readside-play/test/frame-roundtrip` | [源fixture](../js-partition.json#/logicalOutputs/107/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/46/metadataVariants/0/originalMetadata) |
| `family-readside-play/test/http-wire` | B | `parity-family-readside-play/test/http-wire` | [源fixture](../js-partition.json#/logicalOutputs/108/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/47/metadataVariants/0/originalMetadata) |
| `family-readside-play/test/state-roundtrip` | B | `parity-family-readside-play/test/state-roundtrip` | [源fixture](../js-partition.json#/logicalOutputs/109/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/48/metadataVariants/0/originalMetadata) |
| `family-seams-saga/binary-frame/base-codecs` | B | `parity-saga-binary-frame-v1` | [源fixture](../js-partition.json#/logicalOutputs/111/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/49/metadataVariants/0/originalMetadata) |
| `family-seams-saga/binary-frame/typed-run-codecs` | B | `parity-typed-run-modes-v1` | [源fixture](../js-partition.json#/logicalOutputs/112/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/50/metadataVariants/0/originalMetadata) |
| `family-seams-saga/run-contract/typed-leaves` | B | `parity-typed-run-modes-v1` | [源fixture](../js-partition.json#/logicalOutputs/113/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/50/metadataVariants/1/originalMetadata) |
| `family-seams-saga/run-runtime/bounded-host` | B | `parity-typed-run-modes-v1` | [源fixture](../js-partition.json#/logicalOutputs/114/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/50/metadataVariants/2/originalMetadata) |
| `family-seams-saga/run-runtime/managed-operation-adapter` | B | `parity-typed-run-modes-v1` | [源fixture](../js-partition.json#/logicalOutputs/115/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/50/metadataVariants/3/originalMetadata) |
| `family-seams-saga/run-runtime/typed-state-machine` | B | `parity-typed-run-modes-v1` | [源fixture](../js-partition.json#/logicalOutputs/116/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/50/metadataVariants/4/originalMetadata) |
| `family-seams-saga/runtime/reference-run-facade` | B | `parity-run-reference-facade-v1` | [源fixture](../js-partition.json#/logicalOutputs/117/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/51/metadataVariants/0/originalMetadata) |
| `family-seams-saga/runtime/settings-ownership` | B | `parity-two-resource-saga-r2-v1` | [源fixture](../js-partition.json#/logicalOutputs/118/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/52/metadataVariants/0/originalMetadata) |
| `family-seams-saga/saga-build/main` | B | `parity-saga-build-v1` | [源fixture](../js-partition.json#/logicalOutputs/119/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/53/metadataVariants/0/originalMetadata) |
| `family-seams-saga/saga-build/serialization-config` | B | `parity-saga-runtime-config-v1` | [源fixture](../js-partition.json#/logicalOutputs/120/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/54/metadataVariants/0/originalMetadata) |
| `family-seams-saga/saga-build/version` | B | `parity-saga-build-v1` | [源fixture](../js-partition.json#/logicalOutputs/121/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/53/metadataVariants/1/originalMetadata) |
| `family-seams-saga/saga-delivery/result-contract` | B | `parity-two-resource-saga-r2-v1` | [源fixture](../js-partition.json#/logicalOutputs/123/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/52/metadataVariants/1/originalMetadata) |
| `family-seams-saga/saga-evidence/verification-ports` | B | `parity-two-resource-saga-r2-v1` | [源fixture](../js-partition.json#/logicalOutputs/124/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/52/metadataVariants/2/originalMetadata) |
| `family-seams-saga/saga-facade/application-ports` | B | `parity-two-resource-saga-r2-v1` | [源fixture](../js-partition.json#/logicalOutputs/125/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/52/metadataVariants/3/originalMetadata) |
| `family-seams-saga/saga-root/recovery-lifecycle` | B | `parity-r2-authorized-recovery-v1` | [源fixture](../js-partition.json#/logicalOutputs/127/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/55/metadataVariants/0/originalMetadata) |
| `family-seams-saga/saga-store/original-association` | B | `parity-two-resource-saga-r2-v1` | [源fixture](../js-partition.json#/logicalOutputs/128/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/52/metadataVariants/4/originalMetadata) |
| `family-seams-saga/seams-bridge/pure-delegation` | B | `parity-seams-bridge-v1` | [源fixture](../js-partition.json#/logicalOutputs/130/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/56/metadataVariants/0/originalMetadata) |
| `family-seams-saga/seams-build/main` | B | `parity-seams-build-v1` | [源fixture](../js-partition.json#/logicalOutputs/131/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/57/metadataVariants/0/originalMetadata) |
| `family-seams-saga/seams-build/version` | B | `parity-seams-build-v1` | [源fixture](../js-partition.json#/logicalOutputs/132/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/57/metadataVariants/1/originalMetadata) |
| `family-seams-saga/seams-root/constructor-composition` | B | `parity-seams-parcel-v1` | [源fixture](../js-partition.json#/logicalOutputs/136/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/58/metadataVariants/0/originalMetadata) |
| `family-seams-saga/seams-test/root-shape` | B | `parity-seams-parcel-v1` | [源fixture](../js-partition.json#/logicalOutputs/137/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/58/metadataVariants/1/originalMetadata) |
| `family-seams-saga/seams-test/value-shape` | B | `parity-seams-parcel-v1` | [源fixture](../js-partition.json#/logicalOutputs/138/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/58/metadataVariants/2/originalMetadata) |
| `family-seams-saga/workflow/finite-program` | B | `parity-r2-workflow-branches-v1` | [源fixture](../js-partition.json#/logicalOutputs/143/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/59/metadataVariants/0/originalMetadata) |
| `formal-application/anchors/shared` | B | `formal-application/final-bytes` | [源fixture](../js-partition.json#/logicalOutputs/148/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/60/metadataVariants/0/originalMetadata) |
| `formal-application/build/shared` | B | `formal-application/profile-build` | [源fixture](../js-partition.json#/logicalOutputs/149/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/61/metadataVariants/0/originalMetadata) |
| `formal-application/child-protobuf/child` | B | `formal-application/child-prefix` | [源fixture](../js-partition.json#/logicalOutputs/153/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/62/metadataVariants/0/originalMetadata) |
| `formal-application/child-serializer/child` | B | `formal-application/child-prefix` | [源fixture](../js-partition.json#/logicalOutputs/154/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/62/metadataVariants/1/originalMetadata) |
| `formal-application/current-child-journal/child` | B | `formal-application/child-query` | [源fixture](../js-partition.json#/logicalOutputs/156/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/63/metadataVariants/0/originalMetadata) |
| `formal-application/direct-association-host/shared` | B | `formal-application/direct-host` | [源fixture](../js-partition.json#/logicalOutputs/157/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/64/metadataVariants/0/originalMetadata) |
| `formal-application/domain-proto-serializer/shared` | B | `formal-application/bounded-serializer` | [源fixture](../js-partition.json#/logicalOutputs/161/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/65/metadataVariants/0/originalMetadata) |
| `formal-application/effect-bindings/effect` | B | `formal-application/effect-reconcile` | [源fixture](../js-partition.json#/logicalOutputs/163/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/66/metadataVariants/0/originalMetadata) |
| `formal-application/effect-durable-host/effect` | B | `formal-application/effect-reconcile` | [源fixture](../js-partition.json#/logicalOutputs/164/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/66/metadataVariants/1/originalMetadata) |
| `formal-application/effect-protobuf/effect` | B | `formal-application/effect-reconcile` | [源fixture](../js-partition.json#/logicalOutputs/165/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/66/metadataVariants/2/originalMetadata) |
| `formal-application/effect-serializer/effect` | B | `formal-application/effect-reconcile` | [源fixture](../js-partition.json#/logicalOutputs/166/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/66/metadataVariants/3/originalMetadata) |
| `formal-application/exact-wire-po-codecs/shared` | B | `formal-application/exact-boundaries` | [源fixture](../js-partition.json#/logicalOutputs/171/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/67/metadataVariants/0/originalMetadata) |
| `formal-application/execution-contract/hosted` | B | `formal-application/finite-hosted` | [源fixture](../js-partition.json#/logicalOutputs/172/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/68/metadataVariants/0/originalMetadata) |
| `formal-application/execution-contract/pure` | B | `formal-application/finite-pure` | [源fixture](../js-partition.json#/logicalOutputs/173/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/69/metadataVariants/0/originalMetadata) |
| `formal-application/execution-protobuf/shared` | B | `formal-application/finite-codec` | [源fixture](../js-partition.json#/logicalOutputs/174/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/70/metadataVariants/0/originalMetadata) |
| `formal-application/execution-runtime/hosted` | B | `formal-application/finite-hosted` | [源fixture](../js-partition.json#/logicalOutputs/175/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/68/metadataVariants/1/originalMetadata) |
| `formal-application/execution-runtime/pure` | B | `formal-application/finite-pure` | [源fixture](../js-partition.json#/logicalOutputs/176/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/69/metadataVariants/1/originalMetadata) |
| `formal-application/execution-state-codec/shared` | B | `formal-application/finite-codec` | [源fixture](../js-partition.json#/logicalOutputs/177/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/70/metadataVariants/1/originalMetadata) |
| `formal-application/external-authority/shared` | B | `formal-application/external-admission` | [源fixture](../js-partition.json#/logicalOutputs/178/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/71/metadataVariants/0/originalMetadata) |
| `formal-application/external-event-mapping/shared` | B | `formal-application/external-admission` | [源fixture](../js-partition.json#/logicalOutputs/181/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/71/metadataVariants/1/originalMetadata) |
| `formal-application/host-admission/shared` | B | `formal-application/admission-reentry` | [源fixture](../js-partition.json#/logicalOutputs/183/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/72/metadataVariants/0/originalMetadata) |
| `formal-application/host-io/shared` | B | `formal-application/technical-roles` | [源fixture](../js-partition.json#/logicalOutputs/184/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/73/metadataVariants/0/originalMetadata) |
| `formal-application/host-protobuf/shared` | B | `formal-application/host-wire` | [源fixture](../js-partition.json#/logicalOutputs/185/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/74/metadataVariants/0/originalMetadata) |
| `formal-application/host-serializer/shared` | B | `formal-application/host-wire` | [源fixture](../js-partition.json#/logicalOutputs/186/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/74/metadataVariants/1/originalMetadata) |
| `formal-application/knowledge-store/shared` | B | `formal-application/project-evidence` | [源fixture](../js-partition.json#/logicalOutputs/187/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/75/metadataVariants/0/originalMetadata) |
| `formal-application/ledger/shared` | B | `formal-application/final-bytes` | [源fixture](../js-partition.json#/logicalOutputs/188/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/60/metadataVariants/1/originalMetadata) |
| `formal-application/lifecycle-ports/shared` | B | `formal-application/technical-roles` | [源fixture](../js-partition.json#/logicalOutputs/189/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/73/metadataVariants/1/originalMetadata) |
| `formal-application/project-evidence/canonical` | B | `formal-application/project-evidence` | [源fixture](../js-partition.json#/logicalOutputs/192/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/75/metadataVariants/1/originalMetadata) |
| `formal-application/project-evidence/compiled` | B | `formal-application/project-evidence` | [源fixture](../js-partition.json#/logicalOutputs/193/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/75/metadataVariants/1/originalMetadata) |
| `formal-application/project-evidence/inputs` | B | `formal-application/project-evidence` | [源fixture](../js-partition.json#/logicalOutputs/194/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/75/metadataVariants/1/originalMetadata) |
| `formal-application/project-evidence/request` | B | `formal-application/project-evidence` | [源fixture](../js-partition.json#/logicalOutputs/195/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/75/metadataVariants/1/originalMetadata) |
| `formal-application/pure-rule-parameters/shared` | B | `formal-application/pure-vs-actor` | [源fixture](../js-partition.json#/logicalOutputs/196/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/76/metadataVariants/0/originalMetadata) |
| `formal-application/serialization-config/base` | B | `formal-application/profile-build` | [源fixture](../js-partition.json#/logicalOutputs/199/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/61/metadataVariants/1/originalMetadata) |
| `formal-application/serialization-config/child` | B | `formal-application/profile-build` | [源fixture](../js-partition.json#/logicalOutputs/200/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/61/metadataVariants/2/originalMetadata) |
| `formal-application/serialization-config/effect` | B | `formal-application/profile-build` | [源fixture](../js-partition.json#/logicalOutputs/201/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/61/metadataVariants/3/originalMetadata) |
| `formal-application/technical-bindings/shared` | B | `formal-application/technical-roles` | [源fixture](../js-partition.json#/logicalOutputs/206/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/73/metadataVariants/2/originalMetadata) |
| `formal-application/tests/actor-state` | B | `formal-application/actor-persist-reply` | [源fixture](../js-partition.json#/logicalOutputs/207/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/77/metadataVariants/0/originalMetadata) |
| `formal-application/tests/domain-roundtrip` | B | `formal-application/exact-boundaries` | [源fixture](../js-partition.json#/logicalOutputs/208/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/67/metadataVariants/1/originalMetadata) |
| `formal-application/tests/effect-host` | B | `formal-application/effect-reconcile` | [源fixture](../js-partition.json#/logicalOutputs/209/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/66/metadataVariants/4/originalMetadata) |
| `formal-application/tests/finite-execution` | B | `formal-application/finite-pure` | [源fixture](../js-partition.json#/logicalOutputs/210/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/69/metadataVariants/2/originalMetadata) |
| `formal-application/tests/finite-host-child` | B | `formal-application/host-child` | [源fixture](../js-partition.json#/logicalOutputs/211/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/78/metadataVariants/0/originalMetadata) |
| `formal-application/tests/finite-host-direct` | B | `formal-application/host-direct` | [源fixture](../js-partition.json#/logicalOutputs/212/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/79/metadataVariants/0/originalMetadata) |
| `formal-application/tests/finite-host-pipeline` | B | `formal-application/host-pipeline` | [源fixture](../js-partition.json#/logicalOutputs/213/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/80/metadataVariants/0/originalMetadata) |
| `formal-application/tests/host-extended` | B | `formal-application/host-extended` | [源fixture](../js-partition.json#/logicalOutputs/214/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/81/metadataVariants/0/originalMetadata) |
| `formal-application/tests/host-recovery` | B | `formal-application/host-recovery` | [源fixture](../js-partition.json#/logicalOutputs/215/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/82/metadataVariants/0/originalMetadata) |
| `formal-application/tests/host-required-bindings` | B | `formal-application/host-required-bindings` | [源fixture](../js-partition.json#/logicalOutputs/216/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/83/metadataVariants/0/originalMetadata) |
| `formal-application/unused-delivery/shared` | B | `formal-application/admission-reentry` | [源fixture](../js-partition.json#/logicalOutputs/217/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/72/metadataVariants/1/originalMetadata) |
| `formal-domain/akka-pb-serializer/shared` | B | `parity/domain-serializer-boundaries-v1` | [源fixture](../js-partition.json#/logicalOutputs/223/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/84/metadataVariants/0/originalMetadata) |
| `formal-domain/build-plugins/standalone` | B | `parity/domain-standalone-build-v1` | [源fixture](../js-partition.json#/logicalOutputs/224/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/85/metadataVariants/0/originalMetadata) |
| `formal-domain/build-properties/standalone` | B | `parity/domain-standalone-build-v1` | [源fixture](../js-partition.json#/logicalOutputs/225/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/85/metadataVariants/1/originalMetadata) |
| `formal-domain/build-sbt/standalone` | B | `parity/domain-standalone-build-v1` | [源fixture](../js-partition.json#/logicalOutputs/226/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/85/metadataVariants/2/originalMetadata) |
| `formal-domain/code-anchors/apply` | B | `parity/domain-apply-evidence-v1` | [源fixture](../js-partition.json#/logicalOutputs/227/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/86/metadataVariants/0/originalMetadata) |
| `formal-domain/exact-wire-po-codecs/shared` | B | `parity/domain-exact-codecs-v1` | [源fixture](../js-partition.json#/logicalOutputs/235/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/87/metadataVariants/0/originalMetadata) |
| `formal-domain/external-event-construction/shared` | B | `parity/domain-external-output-v1` | [源fixture](../js-partition.json#/logicalOutputs/236/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/88/metadataVariants/0/originalMetadata) |
| `formal-domain/external-stable-identity/shared` | B | `parity/domain-external-output-v1` | [源fixture](../js-partition.json#/logicalOutputs/237/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/88/metadataVariants/1/originalMetadata) |
| `formal-domain/generated-actor-query-tests/standalone` | B | `parity/domain-generated-actor-tests-v1` | [源fixture](../js-partition.json#/logicalOutputs/240/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/89/metadataVariants/0/originalMetadata) |
| `formal-domain/generated-command-replay-tests/standalone` | B | `parity/domain-generated-actor-tests-v1` | [源fixture](../js-partition.json#/logicalOutputs/241/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/89/metadataVariants/1/originalMetadata) |
| `formal-domain/generated-roundtrip-tests/standalone` | B | `parity/domain-serialization-graph-v1` | [源fixture](../js-partition.json#/logicalOutputs/242/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/90/metadataVariants/0/originalMetadata) |
| `formal-domain/generation-ledger/apply` | B | `parity/domain-apply-evidence-v1` | [源fixture](../js-partition.json#/logicalOutputs/243/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/86/metadataVariants/1/originalMetadata) |
| `formal-domain/project-evidence/project` | B | `parity/domain-project-evidence-v1` | [源fixture](../js-partition.json#/logicalOutputs/245/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/91/metadataVariants/0/originalMetadata) |
| `formal-domain/project-knowledge-store/project` | B | `parity/domain-project-evidence-v1` | [源fixture](../js-partition.json#/logicalOutputs/246/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/91/metadataVariants/1/originalMetadata) |
| `formal-domain/pure-command-payload/shared` | B | `parity/domain-payload-boundary-v1` | [源fixture](../js-partition.json#/logicalOutputs/248/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/92/metadataVariants/0/originalMetadata) |
| `formal-domain/serializer-configuration/standalone` | B | `parity/domain-serializer-boundaries-v1` | [源fixture](../js-partition.json#/logicalOutputs/250/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/84/metadataVariants/1/originalMetadata) |
| `formal-service/aggregate-repository/handle` | B | `parity/local-aggregate-repository-v1` | [源fixture](../js-partition.json#/logicalOutputs/257/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/93/metadataVariants/0/originalMetadata) |
| `formal-service/build/play-service` | B | `parity/play-service-build-v1` | [源fixture](../js-partition.json#/logicalOutputs/261/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/94/metadataVariants/0/originalMetadata) |
| `formal-service/command-payload/pure` | B | `parity/domain-command-params-v1` | [源fixture](../js-partition.json#/logicalOutputs/262/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/95/metadataVariants/0/originalMetadata) |
| `formal-service/effect-host/durable` | B | `parity/durable-effect-host-v2` | [源fixture](../js-partition.json#/logicalOutputs/268/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/96/metadataVariants/0/originalMetadata) |
| `formal-service/effect-wire/protobuf` | B | `parity/effect-wire-v1` | [源fixture](../js-partition.json#/logicalOutputs/269/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/97/metadataVariants/0/originalMetadata) |
| `formal-service/effect-wire/serializer` | B | `parity/effect-wire-v1` | [源fixture](../js-partition.json#/logicalOutputs/270/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/97/metadataVariants/0/originalMetadata) |
| `formal-service/event-handler/compatibility-forwarder` | B | `parity/legacy-callsite-migration-v1` | [源fixture](../js-partition.json#/logicalOutputs/272/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/98/metadataVariants/0/originalMetadata) |
| `formal-service/evidence/anchor-temporary` | B | `parity/anchor-atomic-write-v1` | [源fixture](../js-partition.json#/logicalOutputs/274/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/99/metadataVariants/0/originalMetadata) |
| `formal-service/evidence/anchors` | B | `parity/apply-evidence-v1` | [源fixture](../js-partition.json#/logicalOutputs/275/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/100/metadataVariants/0/originalMetadata) |
| `formal-service/evidence/ledger` | B | `parity/apply-evidence-v1` | [源fixture](../js-partition.json#/logicalOutputs/276/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/100/metadataVariants/1/originalMetadata) |
| `formal-service/evidence/project-json` | B | `parity/project-evidence-v1` | [源fixture](../js-partition.json#/logicalOutputs/277/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/101/metadataVariants/0/originalMetadata) |
| `formal-service/evidence/project-knowledge-store` | B | `parity/project-knowledge-publication-v1` | [源fixture](../js-partition.json#/logicalOutputs/278/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/102/metadataVariants/0/originalMetadata) |
| `formal-service/exact-codecs/wire-po` | B | `parity/exact-representations-v1` | [源fixture](../js-partition.json#/logicalOutputs/279/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/103/metadataVariants/0/originalMetadata) |
| `formal-service/execution-codec/invocation` | B | `parity/finite-execution-invocation-v1` | [源fixture](../js-partition.json#/logicalOutputs/280/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/104/metadataVariants/0/originalMetadata) |
| `formal-service/execution-codec/pure` | B | `parity/finite-execution-pure-v1` | [源fixture](../js-partition.json#/logicalOutputs/281/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/105/metadataVariants/0/originalMetadata) |
| `formal-service/execution-data/invocation` | B | `parity/finite-execution-invocation-v1` | [源fixture](../js-partition.json#/logicalOutputs/282/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/104/metadataVariants/1/originalMetadata) |
| `formal-service/execution-data/pure` | B | `parity/finite-execution-pure-v1` | [源fixture](../js-partition.json#/logicalOutputs/283/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/105/metadataVariants/1/originalMetadata) |
| `formal-service/execution-runtime/invocation` | B | `parity/finite-execution-invocation-v1` | [源fixture](../js-partition.json#/logicalOutputs/284/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/104/metadataVariants/2/originalMetadata) |
| `formal-service/execution-runtime/pure` | B | `parity/finite-execution-pure-v1` | [源fixture](../js-partition.json#/logicalOutputs/285/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/105/metadataVariants/2/originalMetadata) |
| `formal-service/execution-wire/protobuf` | B | `parity/finite-execution-wire-v1` | [源fixture](../js-partition.json#/logicalOutputs/286/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/106/metadataVariants/0/originalMetadata) |
| `formal-service/external-authority/actor-ingress` | B | `parity/external-event-bridge-v1` | [源fixture](../js-partition.json#/logicalOutputs/287/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/107/metadataVariants/0/originalMetadata) |
| `formal-service/external-events/payload-bridge` | B | `parity/external-event-bridge-v1` | [源fixture](../js-partition.json#/logicalOutputs/289/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/107/metadataVariants/1/originalMetadata) |
| `formal-service/generated-tests/actor-state` | B | `parity/domain-verification-sources-v1` | [源fixture](../js-partition.json#/logicalOutputs/290/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/108/metadataVariants/0/originalMetadata) |
| `formal-service/generated-tests/domain-roundtrip` | B | `parity/domain-verification-sources-v1` | [源fixture](../js-partition.json#/logicalOutputs/291/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/108/metadataVariants/0/originalMetadata) |
| `formal-service/generated-tests/effect-host` | B | `parity/generated-effect-host-v1` | [源fixture](../js-partition.json#/logicalOutputs/292/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/109/metadataVariants/0/originalMetadata) |
| `formal-service/generated-tests/extended-ports` | B | `parity/generated-extended-ports-v1` | [源fixture](../js-partition.json#/logicalOutputs/293/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/110/metadataVariants/0/originalMetadata) |
| `formal-service/generated-tests/finite-execution` | B | `parity/generated-finite-execution-v1` | [源fixture](../js-partition.json#/logicalOutputs/294/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/111/metadataVariants/0/originalMetadata) |
| `formal-service/generated-tests/finite-host` | B | `parity/generated-finite-host-v1` | [源fixture](../js-partition.json#/logicalOutputs/295/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/112/metadataVariants/0/originalMetadata) |
| `formal-service/generated-tests/host-recovery` | B | `parity/generated-host-recovery-v1` | [源fixture](../js-partition.json#/logicalOutputs/296/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/113/metadataVariants/0/originalMetadata) |
| `formal-service/generated-tests/required-bindings` | B | `parity/generated-required-bindings-v1` | [源fixture](../js-partition.json#/logicalOutputs/297/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/114/metadataVariants/0/originalMetadata) |
| `formal-service/host-io/admission-delivery` | B | `parity/host-admission-delivery-v1` | [源fixture](../js-partition.json#/logicalOutputs/298/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/115/metadataVariants/0/originalMetadata) |
| `formal-service/host-wire/protobuf` | B | `parity/host-wire-v1` | [源fixture](../js-partition.json#/logicalOutputs/299/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/116/metadataVariants/0/originalMetadata) |
| `formal-service/host-wire/serializer` | B | `parity/host-wire-v1` | [源fixture](../js-partition.json#/logicalOutputs/300/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/116/metadataVariants/1/originalMetadata) |
| `formal-service/http-contract/endpoint-bindings` | B | `parity/service-http-boundary-v1` | [源fixture](../js-partition.json#/logicalOutputs/301/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/117/metadataVariants/0/originalMetadata) |
| `formal-service/http-contract/security-json` | B | `parity/service-http-boundary-v1` | [源fixture](../js-partition.json#/logicalOutputs/302/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/117/metadataVariants/1/originalMetadata) |
| `formal-service/invocation-host/direct` | B | `parity/direct-saga-host-v1` | [源fixture](../js-partition.json#/logicalOutputs/305/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/118/metadataVariants/0/originalMetadata) |
| `formal-service/journal-domain/rehydration-adapter` | B | `parity/journal-domain-v1` | [源fixture](../js-partition.json#/logicalOutputs/307/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/119/metadataVariants/0/originalMetadata) |
| `formal-service/journal-records/storage-carriers` | B | `parity/journal-records-v1` | [源fixture](../js-partition.json#/logicalOutputs/310/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/120/metadataVariants/0/originalMetadata) |
| `formal-service/journal-schema/scala-and-sql` | B | `parity/journal-schema-v1` | [源fixture](../js-partition.json#/logicalOutputs/312/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/121/metadataVariants/0/originalMetadata) |
| `formal-service/legacy-bootstrap-facade/forwarder` | B | `parity/legacy-callsite-migration-v1` | [源fixture](../js-partition.json#/logicalOutputs/313/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/98/metadataVariants/1/originalMetadata) |
| `formal-service/page-contract/renderer` | B | `parity/service-pages-v1` | [源fixture](../js-partition.json#/logicalOutputs/314/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/122/metadataVariants/0/originalMetadata) |
| `formal-service/page-delivery/http-presentation` | B | `parity/service-pages-v1` | [源fixture](../js-partition.json#/logicalOutputs/315/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/122/metadataVariants/1/originalMetadata) |
| `formal-service/play-loader/lifecycle` | B | `parity/service-composition-v1` | [源fixture](../js-partition.json#/logicalOutputs/316/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/123/metadataVariants/0/originalMetadata) |
| `formal-service/rules/compatibility-forwarder` | B | `parity/legacy-callsite-migration-v1` | [源fixture](../js-partition.json#/logicalOutputs/320/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/98/metadataVariants/2/originalMetadata) |
| `formal-service/serialization-config/formal-inherited` | B | `parity/serializer-whitelist-v1` | [源fixture](../js-partition.json#/logicalOutputs/323/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/124/metadataVariants/0/originalMetadata) |
| `formal-service/serializer/domain-pb` | B | `parity/serializer-whitelist-v1` | [源fixture](../js-partition.json#/logicalOutputs/324/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/124/metadataVariants/1/originalMetadata) |
| `formal-service/service-composition/factory-contract` | B | `parity/service-composition-v1` | [源fixture](../js-partition.json#/logicalOutputs/325/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/123/metadataVariants/1/originalMetadata) |
| `formal-service/service-configuration/hocon` | B | `parity/service-configuration-v1` | [源fixture](../js-partition.json#/logicalOutputs/326/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/125/metadataVariants/0/originalMetadata) |
| `formal-service/service-configuration/validator` | B | `parity/service-configuration-v1` | [源fixture](../js-partition.json#/logicalOutputs/327/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/125/metadataVariants/1/originalMetadata) |
| `formal-service/service-tests/configuration` | B | `parity/service-configuration-v1` | [源fixture](../js-partition.json#/logicalOutputs/328/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/125/metadataVariants/2/originalMetadata) |
| `formal-service/service-tests/storage` | B | `parity/unit-storage-boundary-v1` | [源fixture](../js-partition.json#/logicalOutputs/329/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/126/metadataVariants/0/originalMetadata) |
| `formal-service/technical-bindings/installation` | B | `parity/technical-installation-v1` | [源fixture](../js-partition.json#/logicalOutputs/333/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/127/metadataVariants/0/originalMetadata) |
| `formal-service/unit-support/hocon` | B | `parity/unit-storage-boundary-v1` | [源fixture](../js-partition.json#/logicalOutputs/335/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/126/metadataVariants/1/originalMetadata) |
| `formal-service/unit-support/network-boundary` | B | `parity/unit-storage-boundary-v1` | [源fixture](../js-partition.json#/logicalOutputs/336/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/126/metadataVariants/2/originalMetadata) |
| `formal-service/unit-support/runner` | B | `parity/unit-runner-v1` | [源fixture](../js-partition.json#/logicalOutputs/337/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/128/metadataVariants/0/originalMetadata) |
| `legacy-application/auth/endpoint-role-policy` | B | `parity-auth-endpoint-policy-v1` | [源fixture](../js-partition.json#/logicalOutputs/341/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/129/metadataVariants/0/originalMetadata) |
| `legacy-application/auth/view-key-constants` | B | `parity-auth-view-keys-v1` | [源fixture](../js-partition.json#/logicalOutputs/342/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/130/metadataVariants/0/originalMetadata) |
| `legacy-application/intermediate/normalized-binding-spec` | B | `parity-legacy-spec-intermediates-v1` | [源fixture](../js-partition.json#/logicalOutputs/352/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/131/metadataVariants/0/originalMetadata) |
| `legacy-application/intermediate/readmodel-derived-spec` | B | `parity-legacy-spec-intermediates-v1` | [源fixture](../js-partition.json#/logicalOutputs/353/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/131/metadataVariants/1/originalMetadata) |
| `legacy-application/intermediate/run-all-owned-specs` | B | `parity-legacy-spec-intermediates-v1` | [源fixture](../js-partition.json#/logicalOutputs/354/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/131/metadataVariants/2/originalMetadata) |
| `legacy-application/intermediate/verbatim-binding-spec` | B | `parity-legacy-spec-intermediates-v1` | [源fixture](../js-partition.json#/logicalOutputs/355/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/131/metadataVariants/3/originalMetadata) |
| `legacy-application/pipeline/queue-manifest` | B | `parity-legacy-pipeline-queue-v1` | [源fixture](../js-partition.json#/logicalOutputs/356/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/132/metadataVariants/0/originalMetadata) |
| `legacy-application/readmodel/default-row-factory` | B | `parity-readmodel-row-and-defaults-v1` | [源fixture](../js-partition.json#/logicalOutputs/357/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/133/metadataVariants/0/originalMetadata) |
| `legacy-application/scaffold/application-config` | B | `parity-legacy-configuration-v1` | [源fixture](../js-partition.json#/logicalOutputs/366/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/134/metadataVariants/0/originalMetadata) |
| `legacy-application/scaffold/build-definition` | B | `parity-legacy-play-build-v1` | [源fixture](../js-partition.json#/logicalOutputs/367/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/135/metadataVariants/0/originalMetadata) |
| `legacy-application/scaffold/empty-command-role-map` | B | `parity-scope-only-role-map-v1` | [源fixture](../js-partition.json#/logicalOutputs/369/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/136/metadataVariants/0/originalMetadata) |
| `legacy-application/scaffold/minor-unit-arithmetic` | B | `parity-minor-unit-arithmetic-v1` | [源fixture](../js-partition.json#/logicalOutputs/370/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/137/metadataVariants/0/originalMetadata) |
| `legacy-application/scaffold/mongo-persistence-config` | B | `parity-mongo-persistence-config-v1` | [源fixture](../js-partition.json#/logicalOutputs/371/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/138/metadataVariants/0/originalMetadata) |
| `legacy-application/scaffold/primitive-codec-support` | B | `parity-primitive-codec-support-v1` | [源fixture](../js-partition.json#/logicalOutputs/372/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/139/metadataVariants/0/originalMetadata) |
| `legacy-application/scaffold/project-ignore` | B | `parity-project-ignore-v1` | [源fixture](../js-partition.json#/logicalOutputs/373/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/140/metadataVariants/0/originalMetadata) |
| `legacy-application/scaffold/runtime-binary-provision` | B | `parity-runtime-binary-provision-v1` | [源fixture](../js-partition.json#/logicalOutputs/374/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/141/metadataVariants/0/originalMetadata) |
| `legacy-application/scaffold/serialization-config` | B | `parity-serializer-registration-v1` | [源fixture](../js-partition.json#/logicalOutputs/375/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/142/metadataVariants/0/originalMetadata) |
| `legacy-application/service/port-bridge` | B | `parity-computation-port-bridge-v1` | [源fixture](../js-partition.json#/logicalOutputs/379/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/143/metadataVariants/0/originalMetadata) |
| `legacy-domain/actor-test/product` | B | `parity-generated-test-source-v1` | [源fixture](../js-partition.json#/logicalOutputs/384/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/144/metadataVariants/0/originalMetadata) |
| `legacy-domain/aggregate-spec/legacy` | B | `parity-legacy-parser-v1` | [源fixture](../js-partition.json#/logicalOutputs/389/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/145/metadataVariants/0/originalMetadata) |
| `legacy-domain/binding-copy-spec/legacy` | B | `parity-legacy-parser-v1` | [源fixture](../js-partition.json#/logicalOutputs/391/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/145/metadataVariants/1/originalMetadata) |
| `legacy-domain/command-spec/legacy` | B | `parity-legacy-parser-v1` | [源fixture](../js-partition.json#/logicalOutputs/393/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/145/metadataVariants/2/originalMetadata) |
| `legacy-domain/emit-marker/legacy` | B | `parity-emitter-receipt-v1` | [源fixture](../js-partition.json#/logicalOutputs/396/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/146/metadataVariants/0/originalMetadata) |
| `legacy-domain/event-spec/legacy` | B | `parity-legacy-parser-v1` | [源fixture](../js-partition.json#/logicalOutputs/402/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/145/metadataVariants/3/originalMetadata) |
| `legacy-domain/exact-text-codec/product` | B | `parity-exact-codec-v1` | [源fixture](../js-partition.json#/logicalOutputs/403/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/147/metadataVariants/0/originalMetadata) |
| `legacy-domain/external-event-bridge/product` | B | `parity-external-ingress-v1` | [源fixture](../js-partition.json#/logicalOutputs/404/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/148/metadataVariants/0/originalMetadata) |
| `legacy-domain/external-ingress/product` | B | `parity-external-ingress-v1` | [源fixture](../js-partition.json#/logicalOutputs/405/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/148/metadataVariants/1/originalMetadata) |
| `legacy-domain/protobuf-serializer/product` | B | `parity-pb-serializer-v1` | [源fixture](../js-partition.json#/logicalOutputs/414/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/149/metadataVariants/0/originalMetadata) |
| `legacy-domain/pure-command-payload/product` | B | `parity-pure-command-v1` | [源fixture](../js-partition.json#/logicalOutputs/415/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/150/metadataVariants/0/originalMetadata) |
| `legacy-domain/roundtrip-test/product` | B | `parity-generated-test-source-v1` | [源fixture](../js-partition.json#/logicalOutputs/417/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/144/metadataVariants/1/originalMetadata) |
| `legacy-domain/sbt-build/product` | B | `parity-domain-build-profile-v1` | [源fixture](../js-partition.json#/logicalOutputs/420/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/151/metadataVariants/0/originalMetadata) |
| `legacy-domain/serialization-config/product` | B | `parity-serialization-config-v1` | [源fixture](../js-partition.json#/logicalOutputs/421/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/152/metadataVariants/0/originalMetadata) |
| `legacy-domain/valueobject-spec/legacy` | B | `parity-legacy-parser-v1` | [源fixture](../js-partition.json#/logicalOutputs/430/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/145/metadataVariants/4/originalMetadata) |
| `legacy-orchestration/ddl/standalone` | B | `legacy-ddl-types-v1` | [源fixture](../js-partition.json#/logicalOutputs/431/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/153/metadataVariants/0/originalMetadata) |
| `legacy-orchestration/evidence/code-anchors` | B | `core-apply-evidence-v1` | [源fixture](../js-partition.json#/logicalOutputs/432/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/154/metadataVariants/0/originalMetadata) |
| `legacy-orchestration/evidence/generation-ledger` | B | `core-apply-evidence-v1` | [源fixture](../js-partition.json#/logicalOutputs/433/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/154/metadataVariants/1/originalMetadata) |
| `legacy-orchestration/intermediate/binding-pass-through` | B | `legacy-parser-contracts-v1` | [源fixture](../js-partition.json#/logicalOutputs/434/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/155/metadataVariants/0/originalMetadata) |
| `legacy-orchestration/intermediate/monarch-spec` | B | `legacy-parser-contracts-v1` | [源fixture](../js-partition.json#/logicalOutputs/435/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/155/metadataVariants/1/originalMetadata) |
| `legacy-orchestration/intermediate/policy-spec` | B | `legacy-parser-contracts-v1` | [源fixture](../js-partition.json#/logicalOutputs/436/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/155/metadataVariants/2/originalMetadata) |
| `legacy-orchestration/intermediate/run-all-monarch` | B | `legacy-parser-contracts-v1` | [源fixture](../js-partition.json#/logicalOutputs/437/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/155/metadataVariants/3/originalMetadata) |
| `legacy-orchestration/intermediate/run-all-policy` | B | `legacy-parser-contracts-v1` | [源fixture](../js-partition.json#/logicalOutputs/438/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/155/metadataVariants/3/originalMetadata) |
| `legacy-orchestration/intermediate/run-all-projection` | B | `legacy-parser-contracts-v1` | [源fixture](../js-partition.json#/logicalOutputs/439/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/155/metadataVariants/3/originalMetadata) |
| `legacy-orchestration/intermediate/saga-spec` | B | `legacy-parser-contracts-v1` | [源fixture](../js-partition.json#/logicalOutputs/440/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/155/metadataVariants/4/originalMetadata) |
| `legacy-orchestration/monarch/checkpoint-codec` | B | `legacy-monarch-replay-v1` | [源fixture](../js-partition.json#/logicalOutputs/441/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/156/metadataVariants/0/originalMetadata) |
| `legacy-orchestration/monarch/ordered-plan` | B | `legacy-monarch-replay-v1` | [源fixture](../js-partition.json#/logicalOutputs/442/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/156/metadataVariants/1/originalMetadata) |
| `legacy-orchestration/monarch/persistent-host` | B | `legacy-monarch-replay-v1` | [源fixture](../js-partition.json#/logicalOutputs/443/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/156/metadataVariants/2/originalMetadata) |
| `legacy-orchestration/monarch/run-state` | B | `legacy-monarch-replay-v1` | [源fixture](../js-partition.json#/logicalOutputs/444/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/156/metadataVariants/3/originalMetadata) |
| `legacy-orchestration/policy/delivery-handler` | B | `legacy-policy-delivery-v1` | [源fixture](../js-partition.json#/logicalOutputs/446/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/157/metadataVariants/0/originalMetadata) |
| `legacy-orchestration/policy/dlq-bury` | B | `legacy-policy-dlq-v1` | [源fixture](../js-partition.json#/logicalOutputs/447/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/158/metadataVariants/0/originalMetadata) |
| `legacy-orchestration/policy/domain-reaction` | B | `legacy-policy-fanout-v1` | [源fixture](../js-partition.json#/logicalOutputs/448/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/159/metadataVariants/0/originalMetadata) |
| `legacy-orchestration/policy/execution-decision` | B | `legacy-policy-delivery-v1` | [源fixture](../js-partition.json#/logicalOutputs/449/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/157/metadataVariants/1/originalMetadata) |
| `legacy-orchestration/policy/failure-verdict` | B | `legacy-policy-delivery-v1` | [源fixture](../js-partition.json#/logicalOutputs/450/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/157/metadataVariants/2/originalMetadata) |
| `legacy-orchestration/policy/legacy-delivery-transcriptions` | B | `legacy-policy-transcription-v1` | [源fixture](../js-partition.json#/logicalOutputs/451/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/160/metadataVariants/0/originalMetadata) |
| `legacy-orchestration/policy/runtime-machine` | B | `legacy-policy-delivery-v1` | [源fixture](../js-partition.json#/logicalOutputs/452/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/157/metadataVariants/3/originalMetadata) |
| `legacy-orchestration/projection/mongo-index-spec` | B | `legacy-view-mongo-index-v1` | [源fixture](../js-partition.json#/logicalOutputs/455/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/161/metadataVariants/0/originalMetadata) |
| `legacy-orchestration/projection/nested-read-documents` | B | `legacy-view-structured-document-v1` | [源fixture](../js-partition.json#/logicalOutputs/456/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/162/metadataVariants/0/originalMetadata) |
| `legacy-orchestration/projection/sql-schema` | B | `legacy-view-ddl-v1` | [源fixture](../js-partition.json#/logicalOutputs/474/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/163/metadataVariants/0/originalMetadata) |
| `legacy-orchestration/run-all/build-pins` | B | `legacy-run-all-deployment-closure-v1` | [源fixture](../js-partition.json#/logicalOutputs/475/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/164/metadataVariants/0/originalMetadata) |
| `legacy-orchestration/run-all/persistence-config` | B | `legacy-run-all-deployment-closure-v1` | [源fixture](../js-partition.json#/logicalOutputs/476/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/164/metadataVariants/0/originalMetadata) |
| `legacy-orchestration/run-all/runtime-jars` | B | `legacy-run-all-deployment-closure-v1` | [源fixture](../js-partition.json#/logicalOutputs/477/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/164/metadataVariants/1/originalMetadata) |
| `legacy-orchestration/run-all/serialization-config` | B | `legacy-run-all-deployment-closure-v1` | [源fixture](../js-partition.json#/logicalOutputs/478/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/164/metadataVariants/0/originalMetadata) |
| `legacy-orchestration/saga/composition-deployment-facts` | B | `strict-composition-deployment-v1` | [源fixture](../js-partition.json#/logicalOutputs/480/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/165/metadataVariants/0/originalMetadata) |
| `legacy-orchestration/saga/composition-deployment-node` | B | `strict-composition-deployment-v1` | [源fixture](../js-partition.json#/logicalOutputs/481/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/165/metadataVariants/0/originalMetadata) |
| `legacy-orchestration/saga/composition-deployment-suite` | B | `strict-composition-deployment-v1` | [源fixture](../js-partition.json#/logicalOutputs/482/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/165/metadataVariants/0/originalMetadata) |
| `legacy-orchestration/saga/composition-recovery-spec` | B | `strict-composition-confirmed-prefix-v1` | [源fixture](../js-partition.json#/logicalOutputs/484/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/166/metadataVariants/0/originalMetadata) |
| `legacy-orchestration/saga/legacy-source-slots` | B | `legacy-saga-three-phases-v1` | [源fixture](../js-partition.json#/logicalOutputs/488/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/167/metadataVariants/0/originalMetadata) |
| `legacy-orchestration/saga/strict-consumption` | B | `legacy-saga-contract-evidence-v1` | [源fixture](../js-partition.json#/logicalOutputs/490/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/168/metadataVariants/0/originalMetadata) |
| `legacy-orchestration/saga/strict-contract` | B | `legacy-saga-contract-evidence-v1` | [源fixture](../js-partition.json#/logicalOutputs/491/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/168/metadataVariants/0/originalMetadata) |
| `legacy-orchestration/saga/strict-deployment-node` | B | `strict-saga-deployment-v1` | [源fixture](../js-partition.json#/logicalOutputs/492/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/169/metadataVariants/0/originalMetadata) |
| `legacy-orchestration/saga/strict-phase-table` | B | `legacy-saga-contract-evidence-v1` | [源fixture](../js-partition.json#/logicalOutputs/497/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/168/metadataVariants/0/originalMetadata) |
| `legacy-orchestration/saga/strict-safety-spec` | B | `strict-saga-money-and-collection-v1` | [源fixture](../js-partition.json#/logicalOutputs/498/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/170/metadataVariants/0/originalMetadata) |
| `ordinary-review/code-anchor/shared-core` | B | `shared-generation-core/receipt-outcomes-v1` | [源fixture](../js-partition.json#/logicalOutputs/501/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/171/metadataVariants/0/originalMetadata) |
| `ordinary-review/design-model/typed-review-json` | B | `ordinary-review/design-five-planes-v1` | [源fixture](../js-partition.json#/logicalOutputs/502/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/172/metadataVariants/0/originalMetadata) |
| `ordinary-review/design-planes/five-plane-diagrams` | B | `ordinary-review/design-five-planes-v1` | [源fixture](../js-partition.json#/logicalOutputs/503/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/172/metadataVariants/1/originalMetadata) |
| `ordinary-review/design-source-index/source-provenance` | B | `ordinary-review/design-five-planes-v1` | [源fixture](../js-partition.json#/logicalOutputs/504/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/172/metadataVariants/2/originalMetadata) |
| `ordinary-review/generation-ledger/shared-core` | B | `shared-generation-core/receipt-outcomes-v1` | [源fixture](../js-partition.json#/logicalOutputs/505/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/171/metadataVariants/1/originalMetadata) |
| `ordinary-review/pipeline-queue/ts-registration-receipt` | B | `shared-generation-core/pipeline-queue-v1` | [源fixture](../js-partition.json#/logicalOutputs/506/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/173/metadataVariants/0/originalMetadata) |
| `ordinary-review/project-evidence/canonical` | B | `ordinary-review/design-project-evidence-v1` | [源fixture](../js-partition.json#/logicalOutputs/507/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/174/metadataVariants/0/originalMetadata) |
| `ordinary-review/project-evidence/compiled` | B | `ordinary-review/design-project-evidence-v1` | [源fixture](../js-partition.json#/logicalOutputs/508/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/174/metadataVariants/1/originalMetadata) |
| `ordinary-review/project-evidence/inputs` | B | `ordinary-review/design-project-evidence-v1` | [源fixture](../js-partition.json#/logicalOutputs/509/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/174/metadataVariants/2/originalMetadata) |
| `ordinary-review/project-evidence/request` | B | `ordinary-review/design-project-evidence-v1` | [源fixture](../js-partition.json#/logicalOutputs/510/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/174/metadataVariants/3/originalMetadata) |
| `ordinary-review/project-knowledge-store/review-wrapper` | B | `shared-project-evidence/graph-publish-v1` | [源fixture](../js-partition.json#/logicalOutputs/511/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/175/metadataVariants/0/originalMetadata) |
| `ordinary-review/starter-generator/source-copy` | B | `ordinary-review/init-generator-contract-v1` | [源fixture](../js-partition.json#/logicalOutputs/512/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/176/metadataVariants/0/originalMetadata) |
| `ordinary-review/starter-manifest/directory-name` | B | `ordinary-review/init-generator-contract-v1` | [源fixture](../js-partition.json#/logicalOutputs/513/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/176/metadataVariants/1/originalMetadata) |
| `ordinary-review/teaching-summary/per-aggregate` | B | `ordinary-review/teaching-empty-and-named-v1` | [源fixture](../js-partition.json#/logicalOutputs/514/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/177/metadataVariants/0/originalMetadata) |
| `ordinary-review/typescript-contracts/direct-emitter` | B | `ordinary-review/ts-shapes-v1` | [源fixture](../js-partition.json#/logicalOutputs/515/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/178/metadataVariants/0/originalMetadata) |
| `ordinary-review/typescript-input-spec/parser-write` | B | `ordinary-review/ts-parser-round-v1` | [源fixture](../js-partition.json#/logicalOutputs/516/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/179/metadataVariants/0/originalMetadata) |
| `retired-seven/api/command-role-map` | B | `retired-api-role-view-contract` | [源fixture](../js-partition.json#/logicalOutputs/525/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/180/metadataVariants/0/originalMetadata) |
| `retired-seven/api/support-graph` | B | `retired-support-controller-graph` | [源fixture](../js-partition.json#/logicalOutputs/527/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/181/metadataVariants/0/originalMetadata) |
| `retired-seven/api/support-health` | B | `retired-support-controller-health` | [源fixture](../js-partition.json#/logicalOutputs/528/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/182/metadataVariants/0/originalMetadata) |
| `retired-seven/api/support-metadata` | B | `retired-support-controller-metadata` | [源fixture](../js-partition.json#/logicalOutputs/529/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/183/metadataVariants/0/originalMetadata) |
| `retired-seven/api/vector-json` | B | `retired-vector-search` | [源fixture](../js-partition.json#/logicalOutputs/531/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/184/metadataVariants/0/originalMetadata) |
| `retired-seven/api/vector-query` | B | `retired-vector-search` | [源fixture](../js-partition.json#/logicalOutputs/532/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/184/metadataVariants/1/originalMetadata) |
| `retired-seven/api/view-json` | B | `retired-view-codecs` | [源fixture](../js-partition.json#/logicalOutputs/534/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/185/metadataVariants/0/originalMetadata) |
| `retired-seven/api/view-keys` | B | `retired-api-role-view-contract` | [源fixture](../js-partition.json#/logicalOutputs/535/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/180/metadataVariants/1/originalMetadata) |
| `retired-seven/ddl/mysql-decision-views` | B | `retired-ddl-dialects` | [源fixture](../js-partition.json#/logicalOutputs/540/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/186/metadataVariants/0/originalMetadata) |
| `retired-seven/ddl/pgvector` | B | `retired-ddl-dialects` | [源fixture](../js-partition.json#/logicalOutputs/541/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/186/metadataVariants/1/originalMetadata) |
| `retired-seven/evidence/anchor-atomic-temp` | B | `retired-apply-evidence` | [源fixture](../js-partition.json#/logicalOutputs/545/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/187/metadataVariants/0/originalMetadata) |
| `retired-seven/evidence/code-anchors` | B | `retired-apply-evidence` | [源fixture](../js-partition.json#/logicalOutputs/546/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/187/metadataVariants/1/originalMetadata) |
| `retired-seven/evidence/generation-ledger` | B | `retired-apply-evidence` | [源fixture](../js-partition.json#/logicalOutputs/547/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/187/metadataVariants/1/originalMetadata) |
| `retired-seven/policy-exec/decision-disposal` | B | `retired-policy-execution` | [源fixture](../js-partition.json#/logicalOutputs/550/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/188/metadataVariants/0/originalMetadata) |
| `retired-seven/policy-exec/envelope-handler` | B | `retired-policy-execution` | [源fixture](../js-partition.json#/logicalOutputs/551/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/188/metadataVariants/1/originalMetadata) |
| `retired-seven/ports/domain-service-bridge` | B | `retired-domain-port` | [源fixture](../js-partition.json#/logicalOutputs/554/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/189/metadataVariants/0/originalMetadata) |
| `retired-seven/rules/params-legacy` | B | `retired-rules-and-params` | [源fixture](../js-partition.json#/logicalOutputs/580/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/190/metadataVariants/0/originalMetadata) |
| `retired-seven/rules/reaction-policies` | B | `retired-policy-reaction` | [源fixture](../js-partition.json#/logicalOutputs/581/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/191/metadataVariants/0/originalMetadata) |
| `retired-seven/tests/actor-config` | B | `retired-actor-executable` | [源fixture](../js-partition.json#/logicalOutputs/583/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/192/metadataVariants/0/originalMetadata) |
| `retired-seven/tests/actor-executable` | B | `retired-actor-executable` | [源fixture](../js-partition.json#/logicalOutputs/584/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/192/metadataVariants/1/originalMetadata) |
| `retired-seven/tests/function-oracle` | B | `retired-function-oracle` | [源fixture](../js-partition.json#/logicalOutputs/585/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/193/metadataVariants/0/originalMetadata) |
| `retired-seven/tests/projection-repository` | B | `retired-storage-table` | [源fixture](../js-partition.json#/logicalOutputs/586/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/194/metadataVariants/0/originalMetadata) |
| `retired-seven/tests/reaction-policies` | B | `retired-policy-reaction` | [源fixture](../js-partition.json#/logicalOutputs/587/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/191/metadataVariants/1/originalMetadata) |
| `retired-seven/tests/rules` | B | `retired-rules-tests` | [源fixture](../js-partition.json#/logicalOutputs/588/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/195/metadataVariants/0/originalMetadata) |
| `shared-project/roundtrip-temporary-tree` | B | `shared-project-roundtrip-write-boundary-v1` | [源fixture](../js-partition.json#/logicalOutputs/590/fixture) · [完整metadata](coverage-matrix.json#/bFixtureRequirements/196/metadataVariants/0/originalMetadata) |

### 三个退休外部槽保持blocked

| producer / output | 未提供内容 | 导航边界 |
|---|---|---|
| `scala-cqrs-es-api` / `support-controller` | 动态passthrough允许任意path/content；本片段按实读retired-controllers.json三键分类，未给未提供内容发明通用B桶。 今后新增sidecar键必须固定path/hash并内容拆分；当前三键不是动态合同全集证明。 | [原阻断](../js-partition.json#/unresolvedCoverage/0)；[catalog导航](../js-partition.json#/catalogCoverage/423)；未提供内容不分类 |
| `scala-cqrs-es-projection` / `projection-handler` | manualBlocks任意内容可覆盖推导体；本轮覆盖renderer/已定义槽职责，未将所有可能手写字节认定为纯ApplyEvent。 同输入比较前提供该输入完整MANUAL sidecar及选择结果，每个新增混合职责再拆分。 | [原阻断](../js-partition.json#/unresolvedCoverage/1)；[catalog导航](../js-partition.json#/catalogCoverage/442)；未提供内容不分类 |
| `scala-cqrs-es-projection` / `projection-repository-impl` | staleGenerations.implOverrides可整文件替换，模板四存储分支不能证明任意override内容。 后续对选定fixture固定override完整bytes/hash与构造范围，不能以历史戳宣称当前生成parity。 | [原阻断](../js-partition.json#/unresolvedCoverage/2)；[catalog导航](../js-partition.json#/catalogCoverage/444)；未提供内容不分类 |

这些catalog仍有已知renderer/固定sidecar角色的A/B导航，不等任意外部内容已读。三槽必须先拿到实际选择的源码bytes/hash再分职责；不创建“其它B”，不删导航，不称638完整。

## 7. 最小缺口表与依赖顺序

这些是输入/target/实际证据缺口组，不是新增几十条实现任务；共用需求ID不会取消任何原条件或B出现位置。

| 组 | 专属输入缺口 | 完整目标缺口 | 需要的实际证据（当前全未执行） |
|---|---|---|
| G1 F1 四件与纯领域依赖 | 冻结 Examples.bankingSystem 的 CreditBalance 子集及依赖闭包；无损映射十命令、七 raw replies、Money/Id/有序 tuple、原事件和 state。TransferConfirmation 是人工额外项，不自动并入。逐方法回复两臂、readonly 与 post-fold state 阶段须有来源。 Examples.scala L43–45 已提供 helper 声明；L50、57 与 curated ReserveFundsRule L5–23 给出 TransferValidator 依赖，仅将该 service 纳入 F1 来源候选，不带入整个 Examples。 | 先裁定 Protocol/Helper/Behavior/Entity 四个完整目标文件，再列 raw→target 有限差异；raw Helper 位置参数错误、currentBalance 未定义、optional/default 与人工三 Map.empty 不混签。 raw helper ???/referenceCode 仅 prompt 与 curated 实际实现分栏；TransferValidator 算法、错误定义及 raw transferValidator / curated TransferValidatorDomainService 的注入名字仍待来源裁定。single 仅先行候选，不批准 profile 迁移。 | 未来真实 typed CommandHelper/CommandHandler/EventSourcedBehavior 接口；失败无 persist、成功从新 State 回复、readonly 不写 Helper、不意外 publish。现在无此执行证据。 |
| G2 运行时身份、布局与启动闭包 | 单/多工程、scope/KEEP、local/sharding 分开；声明 repository/factory 初始化命令、typed reply、entityTypeKey/tag/PID、snapshot/event adapter 和 proto/serializer 精确绑定。不得按类名猜。 | F1 必要 root/factory/repository/bootstrap/application-bootstrap 与 codec 完整文件；raw 输入 ProtoConfig(fileName="credits.proto")、传统 Builder 命名结果 credit_balance.proto、curated 历史 imports=credits 三层分栏且不互换；不同源码根是替代布局而非双份输出。 | 实际消费锁定字节和唯一 source-local/JAR owner 尚未完成，作为阻断引用，不调查/下载/发布。未来需真实初始化 ask、分片/恢复/关闭与 codec 接线证据。 |
| G3 F2 名义类型及持久化接缝 | 固定 Warehouse 四 String nominal、两命令、ReservationIdentity port、receipts-only state、显式 persistence binding/调用方资源。缺无损 BC runCommon adapter；现 adapter 注入 identifier/reply 不能当同输入。 | 区分作者快照、独立 HAND 与传统目标；HAND Execute/GetState/Accepted/Rejected 不等 classic Protocol/Helper。保留 reserve identity fold，不加库存扣减；不能把 H2 receipt store 当所有传统 projection。 | serializerId=736401、envelopeVersion=1、三条真实 layout pin 的旧 bytes→decoder、cross-role event/state 拒绝、required/duplicate map 边界，以及 DataSource/ActorSystem/EC/source/PID owner；现在未执行。 |
| G4 专属形状、共享 proto 与纯模型分支 | 补 0/1/22/23+ 字段、keyword、optional/default/Instant、同简名跨包、nominal、decimal/Long 边界；0/多事件、scalar/collection put-all 单次求值、空 fold 与未完成槽；多聚合 VO 连通分量及 cold/shared/state 引用。模板-only 输入不得冒充 runCommon 可达输入。 | aggregate/shared-value-objects 分开；消息/字段号/oneof/presence/owner/import/顺序与 per-aggregate converter 同闭包；None/empty、Set/Vector/Option[Map]、tenantId 和 BaseStatePO 命名缺口逐项保留为决策，不猜新 schema 支持。 | 未来真实 ScalaPB、PrimitiveConverter、旧 journal/snapshot bytes/manifest/ID；raw BigDecimal→double 不替换 exact 文本；不扩 allowlist、不换 PID、不删旧数据来通过。 |
| G5 Service/API/connector 与手供算法槽 | F1 仅 TransferValidator 依赖已列入 G1 来源候选；其它 DomainService/ApplicationService/QueryService/connector metadata、方法与依赖/struct 仍需独立输入；真实方法体/port ABI/生命周期；API tenant/global/anonymous、path/factory、body/guard/error/auth/view/gate/skip；routes 已有内容和各 marker 状态。不自动带入整个 Examples。 | TransferValidator 的算法、错误定义及注入名字仍待来源裁定，service-object-single 仅先行候选、不批准 profile 迁移；其它 domain-service variants 保持 uncovered。无方法/无对象/多根 fallback、Timeout/ActorSystem 分支、script/helper 有无仍需专属输入；每方法 MANUAL/???/referenceCode 单独定来源。GetBalance 不是 Get${a.name}State，不能据此命中 aggregate-state-controller；全 skip 回退 stub 等缺陷待裁决。 | 未来真实 Play/Guice/typed ask/auth/参数错误与服务资源关闭；手供方法独立行为证据，禁止 fake success。route writer 新建/替换/追加/损坏需独占目标文件证据。 |
| G6 传统投影及多存储专属输入 | 单/多工程、0/1/多 handler、source grouping/routable、create/updateOnly/delete/persistenceIdCreate/degraded；table/Mongo/graph/vector 各 metadata、DTO、identity、refCode 和完整手供算法。 | single applyEvents=Nil→0；multi 每 projection 至多一个 ApplyEvent 文件；handler 按最终 model.handlers 个数；projection 一个文件内可多 source；ES/Redis table fallback 不认作真支持；GraphView 名称分支和实际 storage 分开。 | 未来 JdbcHandler/ViewMachine 与 SQL 事务、外部 sink 各自错误/恢复语义；graph mergeLinkTolerant/manual 未完成，不把 JDBC exactly-once 扩大为端到端。 |
| G7 classic Saga 专属输入 | 独立 classic app.sagas、participants、args/context、step 顺序/phase bindings、typed replies/result/error/retry/timeouts、repository；零/缺/空 args、零/异构 triggers、同名碰撞、显式/回退 context。F1 资金阶段命令不等于已选择 classic Saga fixture。 | participant/definition/context 加四 trigger 文件；各无输入/抑制/拒绝分开；coordinator 系统级单件、transactor 每 Saga；context/repo 去重及首 step/trigger 假设保留未决。 | 未来真实 AskParticipant/Saga definition/registry/coordinator ABI、注册先于恢复、phase/error/result 与事务恢复；不拿 strict/bridge 近似代替 classic。 |
| G8 strict/fixture-host/composition 专属准入 | 分别提供 admitted sagaExecutionV3、实际 base、合法类型/输出和 strict entries；money/collection 的完整 payload 与第二 step funding；composition 另需 systemFile/systemBindings/executionBinding，single-project 且 strict。 | strict module 每 admitted Saga；fixture-host 每 model 单工程五 production+两 test，多工程五 production、test/strict entry wiring 抑制；money+collection/text-only/empty 未定。composition host/child-plan/recovery-spec/deployment-spec 四件，不与 formal 单步 host 混同。 | 未来真实 strict/Monarch runtime 锁字节、资源模板、codec/phase/receipt/query/unknown、safety/deployment/recovery 证据；strict-single/strict-many 安装次序及 multi 抑制分别取证。发布仍阻断，本文件不调查。 |
| G9 B 独立输出、writer 与派生证据 | 逐条保留 B 原逻辑 ID/分类/variant/fixture.requiredConditions/目标 construct 指针；每个 producer/profile 选择、build/config/test/resource、plan/apply/MANUAL/KEEP/故障/临时树输入由其原 fixture 规格给出。 | 308 条出现位置全部在 bOccurrences；197 个原 fixture ID 下按完整 metadata 去重为292条，不把同名但不同条件合并丢失。四 JSON/SQLite/ledger/anchors/临时输出等不并入 A 或忽略；53 writer observations 是来源观察数，不再加成53条 B。 | 未来真实公开入口选择、隔离 target 的最终 bytes/ownership/spans、拒绝/失败/关闭/临时清理；源中 generated tests 不是独立业务 oracle。本轮所有 B 未与 F1/F2 建立同输入绑定。 |
| G10 退休外部内容的三个 blocked 槽 | support-controller 任意 path/content 的实际 sidecar；projection-handler 被选 MANUAL 全文；projection-repository-impl 被选整文件 implOverrides。都需准确 bytes/hash、选择条件、来源/owner。 | 仅给已实读模板/sidecar角色保留原 A/B 行。未提供外部源码的职责未知，不能额外落 B、不能据641−3宣称638完整，也不能把三条 catalog 导航删去。 | 先完成源内容分类及目标比对规格，之后才可能进入独立执行窗口；当前 blocked。 |

1. **F1四件先行**：Protocol/Helper/Behavior/Entity的同输入槽与完整target先裁定，raw/curated不混签。
2. **只扩F1必要闭包**：values/invariants/fold、已声明 helper 与仅 TransferValidator 的 domain-service 依赖，再到root/factory/repository/bootstrap/codec接线；算法/错误定义/注入名字及raw/curated/target分栏待裁定，single不批准profile迁移。common演进和真实消费锁字节由其它会话交付，未完成即阻断，不调查供应、不逐模板启动构建。
3. **再F2**：固定非银行nominal/port/fold/持久化边界，先解决BC无损映射与HAND/classic目标区别。
4. **其它变体按专属数据补齐**：shape/shared与布局/拒绝/模板-only，service/API/connector，传统projection，classic Saga各取最小闭包；不让F1/F2承担未声明业务。
5. **strict→其host/wiring→composition**：仅在相应专属准入、资源、锁字节与owner齐备时进入后续规格/实施窗口；classic不作为strict替身。
6. **B随所属闭包逐ID归还**：build/config/resource/test/派生证据/writer均保留原fixture条件；3个外部槽先收源码再分类。实际生成、接口/行为取证由主会话集中授权和排资源窗口。

## 8. 本次 static-document 静态自检范围

- JSON可解析；42族唯一且与inventory/scalaCoverage齐；32族173个原variant对象完整保留；protobuf原表两名不重命名。
- 308个B原ID精确集合、classification、原fixture metadata、目标paths与源指针对应；197/292计数分开；3个外部阻断不变成新增B。
- 文档来源与diff链接文件存在，JSON Pointer按本次所读源对象定位；来源字节指纹仅供静态追溯。Markdown的L行锚是导航提示，不是执行证据。
- 仅修改本目录这两个矩阵文件；无生成/validate/roundtrip/编译/测试/typecheck/服务/下载/发布/Git操作，无expected字节虚构。上述核对仅为 static-document，不称运行验收或parity PASS。
