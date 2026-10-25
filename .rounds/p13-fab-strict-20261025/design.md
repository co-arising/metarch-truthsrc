# P13 批A（第 5 门第一段）：fab strict 面——真源深化 + 双 saga 拿到就能跑

日期：2026-10-25。状态：设计冻结（Stage 0）。上游计划：p2-design-freeze 锚点 P12 块 + 第 5 门
三批裁决（P13 fab strict → P14 组合面 → P15 BC parity）。

## 一、目标

`example/fab-split-merge` 真源树从 contract-only 深化为可 strict 发射的树：fab-split/fab-merge
双 saga 经 run-all strict 面生成完整隔离应用，`FabSafetySpec`（A 守恒/幂等 + B 全 TCC 三结局 +
C1 中断恢复）全绿；money 应用 12/12 不动；truthsrc 全量绿；金样零 diff；money digest 双钉点
（ir `ba60f58a` / definition `3a586c81`）不变；fab 新 digest 钉点登记。

零库改动红线保持：saga-core / monarch-core / monarch-persistence 本批全不动（TypeContract/ValueShape
定义在生成应用内部，形状表扩展是生成器工作——实核 /tmp/p11-deployment-app/app/fixture/SagaModule.scala:43-54）。

## 二、语义定案

### 1. v3 契约可选能力扩展（不破 money 钉点的机制）

现状：`documentCheck`（runtime-binding.mjs:76-89）要求文件 target.capabilities **恰等于**编译侧
V3_CAPABILITIES（10 项，缺一即 RUNTIME_CAPABILITY_MISSING）——直接扩集合会炸 money 文件。且
featureCheckV3 对 fab 有三处硬拒：manifest mode durable-reference（:159）、collection/manifest-reference
类型（:167）、resilience 重试参数（:162）。

定案：capabilities 拆「必选 10 + 可选 N」——`V3_OPTIONAL_CAPABILITIES = ['bounded-collection-args',
'args-anchored-manifest']`。documentCheck 允许列表=必选∪可选、必选清单不变（money 文件零改动→
digest 零改动）。featureCheckV3 收文件能力集：
- 无 `args-anchored-manifest`：现行为不变（durable-reference 拒绝）。
- 有：mode=durable-reference 放行，当且仅当 `durable && selection==='frozen-before-prepare'` 且
  存在 args 槽携带的有界 collection（运行时永不解引用 manifest；冻结操作集=canonical args 携带的
  有界集，ref/version 仅审计锚）——语义依据 EP「不以 hash 代替可读取 manifest」+ strict runtime
  只收 canonical args bytes 的事实。
- 无 `bounded-collection-args`：collection 类型拒绝不变。有：collection 类型放行当且仅当
  elementType 解析到 id/text 标量、minItems≥1、maxItems≤64（与 admission.maxItemsPerChunk 对齐）。
  manifest-reference 类型放行当且仅当 readable=true 且 version 声明（锚语义）。

fab resilience 对齐 v3 运行时事实：maxAttempts 3→1、backoffMs 100→0、queryTimeoutMs 500→1000
（=phaseTimeoutMs）——真源声明改为 strict 运行时真实语义（一 attempt、无退避、单一交互超时）。

### 2. 聚合面 DSL 两处封闭扩展（fab wafer 语义的诚实表达）

- **guard 新形态 `collection-covered`**：`when {form: collection-covered, map: <state map 字段>,
  collection: <param 集合字段>}`，语义=∀ w ∈ collection: map.contains(w)；onFail ∈ reject/succeed-empty
  与既有形态同。用于 ReserveWaferRemoval 的「source 携带全部冻结 wafer」守卫（B2 拒绝面的真语义）。
- **fold 新算子 `put-all` / `remove-all`**：key=event 集合槽（对 map 字段按集合元素逐键 put/remove），
  value=标量表达式或 literal。用于 carried 集合的批次迁移（remove-all=搬出、put-all=搬入/回补）。
  既有 put/remove/money-apply 三算子不动（金样惰性）。

### 3. Lot 深化（money CreditBalance 金主模式移植，聚合面不进 saga digest）

stateFields（7 字段）：
- `phase: String`（pass-through，既有）
- `carried: Map[WaferId, String]`——wafer→"carried" 标记（presence=在册）；writtenBy 六 TCC 事件中
  触碰 carried 的确认事件 txid 槽（Removal prepare=remove-all、Add commit=put-all、Removal
  compensate=put-all 回补）
- `reservedRemovals: Map[TxId, ReservationId]`——source prepare 证据 map（writtenBy
  ReserveWaferRemovalConfirmed.txid）
- `reservedAdditions: Map[TxId, ReservationId]`——target prepare 证据 map
- `committed: Map[TxId, TxId]`——commit 相标记（writtenBy CommitWaferRemovalConfirmed.txid /
  CommitAddWaferConfirmed.txid；value=receiptId）
- `compensated: Map[TxId, String]`——compensate 相标记（writtenBy ReleaseReservedWaferConfirmed.txid /
  CancelAddWaferConfirmed.txid）
- `sagaResults: Map[TxId, String]`——终态台账（五 result-* 事件）

守卫/折叠表（每切片；errCode 用 fab 族 61xxx）：
- ReserveWaferRemoval：map-absent(reservedRemovals, txid)→succeed-empty（幂等）；collection-covered
  (carried, param.wafers)→reject（守恒前置）。事件 ReserveWaferRemovalConfirmed(txid, reservation,
  wafers)：fold=reservedRemovals.put(txid→reservation) + carried.remove-all(event.wafers)。
- CommitWaferRemoval：map-contains(reservedRemovals, txid)→reject（无预留拒绝）。事件
  (txid, receiptId)：fold=committed.put(txid→receiptId) + reservedRemovals.remove(txid)。
- ReleaseReservedWafer：map-contains(reservedRemovals, txid)→reject。事件 (txid, wafers)：
  fold=compensated.put(txid→literal) + carried.put-all(event.wafers→literal "carried") +
  reservedRemovals.remove(txid)。
- ReserveAddWafer：map-absent(reservedAdditions, txid)→succeed-empty。事件 (txid, reservation)：
  fold=reservedAdditions.put(txid→reservation)。
- CommitAddWafer：map-contains(reservedAdditions, txid)→reject。事件 (txid, receiptId, wafers)：
  fold=committed.put(txid→receiptId) + carried.put-all(event.wafers→"carried") +
  reservedAdditions.remove(txid)。
- CancelAddWafer：map-contains(reservedAdditions, txid)→reject。事件 (txid)：
  fold=compensated.put(txid→literal) + reservedAdditions.remove(txid)。
- 五条 RecordResult* 新切片：map-absent(sagaResults, txid)→succeed-empty（61010 幂等重发空成功）；
  事件=result-*：fold=sagaResults.put(txid→kind literal)——money P5 逐字模式。
- StartTransfer 既有（触发命令面完整，零改动）。

参数扩展（truth 树=authoring 面，README 明示 desired additions）：ReleaseReservedWafer 与
CommitAddWafer 事件/命令补 wafers 载荷（回补/入册 fold 需要）；命令参数随之补 wafers
（ReleaseReservedWafer 的 wafers 绑定可取 args:wafers——compensate 可读 args）。

### 4. 技术面

- bindings.json：双 saga module 拆名 `fixture.FabSplitSagaModule` / `fixture.FabMergeSagaModule`
  （entrypoint 同步 `fixture.FabSplitSagaEntry` / `FabMergeSagaEntry`）——fab digest 无历史钉点，
  新值钉新测试。types/consumption 断言链（fixtures/saga-contract.mjs fab-double-lot）按需同步。
- 新 `example/fab-split-merge/runtime-binding.json`（v2 文档 + V3 全 10 必选 + 2 可选能力；双 saga
  pin，receiptCodecs 全 (step,phase) 覆盖，runtimeVersion 1）。
- emit-strict.mjs 泛化：money 类型缺席（无 MoneyShape/ExactMoneyCodec 发射——条件化）；collection
  args 渲染 `Vector[String]` + ArgsCodec JSON 数组往返；ValueShape 增 `SequenceShape(element, minItems,
  maxItems)`（生成应用内部形状表）；manifest-reference 渲染（readable/version 锚形状或 BoundedText
  语义注记——实施时按 SagaModule 形状表最小面定）。fundingSeed 槽形状驱动 spec 字面量
  （money→Money(...)、collection→Vector 字面量、text→字符串）。
- 聚合面 collection 折叠：run-all serial 规范化 + protocol/state/adapter/converter 渲染
  WaferSet→List[String]（element id kind）；proto 已支持 repeated（proto-dsl/emit.mjs:66-68）。
- emit-strict-host/spec 双 saga：per-saga module 后文件名天然分离；spec 单件 FabSafetySpec 覆盖
  双 saga（split 全 A/B/C 矩阵；merge 至少成功+补偿两径）；fundingSeed=reserve-target prepare+commit
  对（ReserveAddWafer+CommitAddWafer）播两 lot（money 先例：两账户都播）。

## 三、文件级改动清单（truthsrc 仓）

真源：`example/fab-split-merge/tree/aggregates/lot/aggregate.yaml`（7 字段+ruleRefs）、六 TCC 切片
guards/folds/payloads、新五 record-result-*.slice.yaml、两 saga yaml 仅 resilience 三值；bindings.json
module 拆名；新 runtime-binding.json。
编译器：`lib/saga/runtime-binding.mjs`（可选能力机制+featureCheckV3 三处条件放行）；SCHEMA.md
guard/fold 新形态条目。
生成器：`generators/saga-dsl/emit-strict.mjs`、`emit-strict-host.mjs`、`emit-strict-spec.mjs`
（泛化+fab 形状）；`generators/run-all.mjs`（serial 规范化 collection 折叠+条件化 money）。
测试：新 `test/saga-fab-runtime-binding-v3.test.mjs`（能力门+fab digest 钉+负例：无能力时三拒绝
仍在）；guard/fold 扩展断言入既有 aggregate 面测试或新件；saga-examples 既有断言预期不动
（pipelines/documentOnly 零改动）。

## 四、验收矩阵

1. truthsrc `npm test` 全量绿（1705+新增）。
2. fab 树 run-all 独立产物（隔离缓存+候选 jar saga-core 0.2+1-cf26cd7a sha256:1009300e…）：
   `sbt compile` exit0 + `FabSafetySpec` 全绿（A1 split 守恒：source 恰失 W、target 恰得 W；
   A2 补偿守恒；A3 幂等重放；B1 成功+result-succeeded 发布；B2 冻结集不满足→rejected-before-effects；
   B3 target prepare 预录失败→auto-abort→compensated；C1 中断恢复；merge 成功+补偿径）。
3. money 应用 12/12 复跑不动（发射泛化必须金样惰性）。
4. 金样：metarch 树 run-all 产物与 P12 基线（/tmp/p11-golden out5 配方）字节零 diff。
5. digest：money 双钉点不变（既有测试断言）；fab 双 digest 新值登记钉死。

## 五、风险与迭代预期

- 聚合面 collection 折叠的渲染链（protocol/state/adapter/converter/invariant 五处）可能逐处冒
  尖——按 P9 批A 惯例逐轮修（金样惰性硬门每轮核）。
- emit-strict money 条件化可能触碰 money 发射路径——每轮以 money 应用产物 diff=0 自检。
- evidence 推导（emit-strict fail-closed 四字段/三重判定）对 fab 切片形状的适配轮次未知。
- 预计 6–12 轮编译/测试迭代；失败证据全留 .rounds。

## 六、红线

不 commit/push/publish；不写共享 apps；不启停共享服务（mongo 沿用 P11 授权——本批 A/B/C 用
testkit 无需 mongo，仅 D 面属 P14）；生成应用修复走 generator/scaffold 合法源面重新生成，不手补
生成源码；诚实标记不因验证绿改写；金样字节恒等；digest 纪律如上；隔离缓存不入库；不删失败证据。

## 六、实施记录（Stage 1–3，2026-10-25）

**lib 扩展**：validate.mjs——FOLD_OPS 增 put-all/remove-all（集合槽逐键迁移）、GUARD_FORMS 增
collection-covered（map+collection）；runtime-binding.mjs——V3_OPTIONAL_CAPABILITIES=
[bounded-collection-args, args-anchored-manifest] 可选能力机制（documentCheck 允许列表=必选∪可选，
必选 10 项不变→money 文件/digest 零改动）；featureCheckV3 按文件能力集条件放行 manifest
durable-reference（durable+frozen-before-prepare+args 携带有界集合）、collection（id/text 元素
1..64）、manifest-reference（readable+version 锚）。

**真源深化**（fab 树）：aggregate.yaml 七字段（carried Map[WaferId,String]/reservedRemovals/
reservedAdditions/committed/compensated/sagaResults + phase）+ruleRefs 61xxx；六 TCC 切片重塑
（guards: prepare 幂等 map-absent→succeed-empty（Removal）/reject（Add——B3 决定性拒绝面同 money
60007 机理）+collection-covered 守恒前置；commit/compensate map-contains reject；folds:
reservedX.put/remove + carried remove-all/put-all + 相标记 put）；补 get-lot-state 查询切片与五
RecordResult* 发布切片（money P5 逐字模式）；事件载荷补 txid/wafers（receipt=同名输入投影风格）。
双 saga reshape：outputs 全投影化（prepare=[txid,wafers]、commit/compensate=[txid]）、跨步 receipt
引用改 step:…:wafers、commit 砍 reservation 参数（预留按 txid 键控——money DeductFunds 先例）、
resilience 对齐 v3（1 attempt/0 backoff/等超时）。bindings/execution-bindings：module 拆名
fixture.split.FabSplitSagaModule / fixture.merge.FabMergeSagaModule（per-saga 子包——双 saga 文件
天然分离）+artifact 对齐 runtime target。新 runtime-binding.json（v2 文档+12 能力+双 saga pin）。

**生成器泛化**：run-all（类型折叠 collection→List[String]/manifest-ref→String+Map 值侧、守卫翻译
collection-covered→forall(contains)）；aggregate-dsl（fold put-all/remove-all=Map ++/--）；proto-dsl
（List[X] 方括号形态→repeated）；converter-dsl（isListType 方括号）；emit-strict（shape 表增
Sequence/ManifestRefShape、money 面可选、StrictWire 独立成件+lengthPrefixedAll 集合 wire、
ArgsCodec 逐槽链、fundingSeed 模型补事件载荷/命令参数清单、boundsOf 集合/manifest 支持、
receipt-field 输入构造接线 request.receipt(producerIdentity, pin, codec).get.slot——StrictReceiptContext
首次在生成面使用）；emit-strict-host（receipt codec 逐槽链、命令集合 Vector→List、trigger 集合
守卫+toVector）；emit-strict-spec 整件重写分族（fab=集合守恒族：ChildBaseWafers 不相交播种使 To
断言锋利、per-entity 种子参数、A/B/C/D 全矩阵集合断言、node CSV wafer 参数）。

**迭代 5 轮**：①emit-strict fundingSeed 用 phases 模型字段（ph.commandRef→aggName）②shapeExpr 作用域
（typeById→b.types）③boundsOf manifest 缺省 ④proto/converter 方括号 List 识别 ⑤D3/D4 父测断言错
（to-carried=6 不可能——Seed∪Split=4；节点语义全对 exit0。修法=ChildBaseWafers 不相交播种，
To 断言 3 片锋利化——钝断言会让 put-all 静默失效也通过）。

**验收**：fab 应用（target/p13-fab-strict-20261025/app·候选 jar 1009300e…）**24/24**（双 saga ×12：
A1-A3/B1-B3/C1 testkit+D1 共享 Mongo+D2 事件源+D3 两 JVM 14s+D4 failover 收敛+conf 装配·
allow-java=off 全 strict 面）；money 应用重产 **12/12**（生成器泛化惰性）；truthsrc 全量
**1711/1711**（1705+6 新增 test/saga-fab-runtime-binding-v3.test.mjs：digest 钉+四负例）；
**金样零 diff**（P10 剥 loan 配方重产 vs /tmp/p11-golden/out5 字节恒等）；digest 新钉：fab ir
`9fea6196…`、fab-split def `86da085f…`、fab-merge def `cd186ecb…`；money 双钉点 ba60f58a/3a586c81
不变（既有测试守护）。saga-core/monarch 零改动。SCHEMA.md guard/fold 新形态条目补齐。

**边界如实**：fab 树 readiness 仍 contract-only（compile-sagas 输出诚实标记）；v3 可选能力=
lowering 门扩展非运行时认证（runnable=false 不变）；集合 wire=fixture 族（bounded id/text 元素），
任意嵌套集合不在面；多源合批/子 Monarch 组合=P14 批B 范围。
