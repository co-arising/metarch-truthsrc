# projection-apply-event（26，条件子产物）内容规格

## 1. 范围、状态与固定来源

Artifact id `projection-apply-event`；状态 `decision-required`。完整固定 [ProjectionModel](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/ProjectionModel.scala)、[ProjectionBuilder](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/ProjectionBuilder.scala)、[ProjectionApplyEventTemplate](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/ProjectionApplyEventTemplate.scala)，HEAD/hash 见 [inventory](../scala-artifacts.json)、[index](../baseline/index.json)。不把 raw 模板中“纯函数”标签当成确定性证明。

[CQRSApplicationGenerator L855–875](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L855) 只在 **`model.applyEvents.nonEmpty`** 时写文件。Builder 仅在 `codegen.multiProject=true` 构建 applyEvents；单项目为 Nil，因此正常单项目输出基数 **0**。multi 每投影 **0 或 1** 文件，含多事件函数，不是一事件一文件。即使全部记录 degraded，序列仍非空，也可能生成只有 imports/空 object 的文件。

路径 `modules/kernel/src/main/scala/<business-base>/application/projection/handlers/<View>ApplyEvent.scala`；writer 用改过 selfType 的 model 记账，而 Template 收的是**原始 ProjectionModel**，自行在原 projection package 后加 `.handlers`、在原名后加 ApplyEvent。不能把已修改的 selfType 再传 template 造成双后缀/双 handlers。模块不是第四业务层，业务 base 下仅 domain/application/infrastructure。

## 2. Model 全字段（原序/类型/默认值）

共享载体并不等于五个同名平行 Model。handlers 与 applyEvents 都嵌套在 ProjectionModel。

| 类型 | 完整构造字段 |
|---|---|
| `ProjectionModel` | `selfType: TypeRef, sourceAggregate: TypeRef, sourceProtoEventType: TypeRef, repository: TypeRef, handlers: Seq[ProjectionHandlerModel], dependencies: Set[TypeRef], aggregateSources: Seq[ProjectionAggregateSource]=Nil, noteIds: Seq[String]=Nil, applyEvents: Seq[ApplyEventFunction]=Nil, identityScheme: Option[String]=None` |
| `ProjectionAggregateSource` | `aggregate: TypeRef, protoEventType: TypeRef, handlers: Seq[ProjectionHandlerModel]`，全部必填；多源分别持 PO 事件族，不能混流 |
| `ProjectionHandlerModel` | `selfType: TypeRef, event: TypeRef, repository: TypeRef, logicCode: String, dependencies: Set[TypeRef], eventCaseName: String="", routable: Boolean=true, viewName: String="", concreteEventName: String="", entityEventFqn: String="", identityKeys: Seq[(String,Boolean)]=Nil, applyForm: String="create", noteIds: Seq[String]=Nil` |
| `ApplyEventFunction` | `eventName: String, eventFqn: String="", applyExpr: Option[String], bodyExpr: String="", applyForm: String="create", fieldPairs: Seq[(String,String,String)], literalPairs: Seq[(String,String)], droppedColumns: Seq[String]=Nil, deletePairs: Seq[(String,String)]=Nil, viewColumns: Seq[(String,String)]=Nil` |

`applyExpr/fieldPairs/literalPairs` 没默认值；其余明确为 Nil/None/空串者才可省略。eventFqn 是 entity event 的 FQN，不是 PO；fieldPairs 是(viewField,eventField,viewType)，literalPairs 为(field,literal)，deletePairs 为(keyName,expression)，viewColumns 为(column,typeSignature)。本 Template 的函数体取 `bodyExpr/applyForm/deletePairs/viewColumns`；`applyExpr/fieldPairs/literalPairs/droppedColumns` **当前不控制函数发射**。注释声称会留 droppedColumns 痕迹，实际 template 没消费，需按源码记录。

TypeRef=`name:String, packageName:String, typeParams:Seq[TypeRef]=Nil`，泛型/元组 signature 见 [TypeSystem](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala)；ArtifactModel 的默认 morphisms Nil、registerTo 只注册本体，noteIds 文件归属见 writer。Template 不使用 ProjectionModel.dependencies 来计算 import；这也是依赖账与实际源码可能分离的原因。

## 3. Builder 从输入到表达式（全文分支覆盖）

### 3.1 公共上下文

Builder L19–69 由 layout/resolver 解析 projection/source aggregate/repository；repositoryRef 缺失抛异常；PO family 来自 AggregateRootProtoBuilder。sourceAggregates.size>1 时按聚合过滤 entity FQN 的 handlers，空组不保留；非空组展开成 model.handlers，否则 fallback 单源 meta.handlers。依赖收集 handler/source/repo/PO/framework 并 shouldImport；applyEvent 文件沿用此父依赖账，不能据此声称 kernel 依赖已经净化。事件具体 FQN、logicCode 与 identity/form 来自 [嵌套 ProjectionHandlerBuilder](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/ProjectionModel.scala#L106)，缺 referenceCode 为 `???`。

### 3.2 方言识别与重写（L77–190）

仅 multi 才遍历 **已构建 handlers**，保留原序；每个 handler：

1. trim logicCode。空或 `???`→degraded；`updateOnly(`→取第一个冒号之后为 body；`view.delete(`→delete；`emptyRow(`→persistenceIdCreate；`upsert by <key>:`→create 并去头；`view.copy(`→create；其它（含 graph.*、view.manual/prose）→degraded。
2. updateOnlyEvents 声明把 create/degraded 改 updateOnly；degraded+声明改 body=`row`，不是抛异常。这与 handler 的 missing-head 判定仍落 MANUAL 存在不一致。
3. 顺序敏感 rewrite：`event.`→`e.`；暂存 view.copy 与 view.，按 form 改 create 基座 `existing.getOrElse(emptyRow).copy(` 或 updateOnly `row.copy(`；其他 form 且 persistenceIdMode 用 `emptyRow(entityId, e.tenantId.toString).copy(`；裸 view.field→row.field；指定 emptyRow(entityId,e.tenantId) 改 `.toString`。这是字符串重写，不是完整 Scala parser，不能声称任何表达式保真。
4. deletePairs **只抓 `key = e.field`**，按事件字段 Id 类型或名字 *Id 加 .toString；源码的字面量 `sourceType = "note"` 不进入 deletePairs，已存在 `.toString` 的表达式也不能当作完整支持。模板仅按提取序号取两个值，不能保证 key 名/顺序。
5. adaptKeyPairs 只在最外层第一个 `.copy(...)` 的匹配括号内按顶层逗号拆分；识别括号/方括号/backtick，并非支持所有引号/字符串文法。create/persistenceIdCreate 内 List/Seq 列的 `row.field`→`existing.map(_.field).getOrElse(Nil)`；updateOnly 保留 row。
6. 单纯 `vf = e.ef` 对：String←Id→.toString；Option[Instant]←Instant→ts；同内型的 optional List/Seq→getOrElse(Nil)；String←optional→getOrElse("")；其它直接取值；关键字两侧补 backtick。**None→空值会覆盖原列，并不是注释所说“不改列”**，必须裁决。
7. Id 探针 `resolved.name==Id || fieldName.endsWith(Id)`，找不到字段仍用后缀；Instant 找不到字段以 timestamp 名兜底；optional 使用 FieldMetadata.optional 而非已包 Option 名称。viewTypeOf/adapt nullable 缺省 Instant 包 Option，但最终 `viewColumns` 使用**原 resolved signature**，不包 nullable Option。
8. fieldPairs 仅筛已知 viewColumns；literalPairs 仅匹配字符串/数字L?/布尔；droppedColumns 固定 Nil。`applyExpr=None` 仅 form=degraded，其它为 Some(form)。noteIds 从投影透传。

## 4. Template 从上到下所有 construct / RHS

| 构造 | 精确规则 |
|---|---|
| package | `${model.selfType.packageName}.handlers` |
| imports | 第一行**硬编码** `net.imadz.metarch.application.projection.repository.<View>Table.<View>`；之后所有 applyEvents.eventFqn 非空 distinct 按原首次顺序，未排序，连 degraded 事件也 import；不从 dependencies 来，无通用包参数替换 |
| 文档/object | “纯函数族/kernel零机制”文档后 `object <View>ApplyEvent { ... }`；无注解/继承/self-type/主辅构造器 |
| helpers 顺序 | emptyRow → ts → strOr → upsertBy（按需，具体如下） |
| functions | 按 applyEvents 原序过滤掉 degraded，逐个事件 doc→对应 on<Event> 方法；不去重复事件名，不产生 overload 消歧；无 MANUAL 区 |

### 4.1 emptyRow 与 helpers

- createForms 仅 create/persistenceIdCreate；body 含 `.copy(` 或开头 emptyRow 则 needsEmptyRow；至少有非空 viewColumns、所有列 defaultOf 可得才生成。columns 按 createForms 展开后 distinct(tuple)；同名不同类型不会按名归一。
- defaults：String/空型→`""`；Option→None；List/Seq→Nil；Id→`net.imadz.common.Id.of("00000000-0000-0000-0000-000000000000")`；Boolean→false；Int/Long→0；裸 Instant→None（显式 non-null Instant 可能类型错误）；其它 VO/BigDecimal/Map 等不可推导→无默认行。
- 普通 `private def emptyRow: View = View(namedArgs...)`；persistenceIdMode `private def emptyRow(entityId: String, tenantId: String): View`，**所有 Id 列**取 Id.of(entityId)，列名 tenantId 取参数，其它默认；不是按 isKey 判定。关键字列仅有限八字集合补 backtick。
- body 含 `ts(e.` 才发 `private def ts(i: java.time.Instant): Option[java.time.Instant] = Some(Option(i).filterNot(_.toEpochMilli == 0L).getOrElse(java.time.Instant.now()))`。null/epoch0→now，读取时钟，故非确定性纯函数；本阶段不得改为任意时间常量。
- 含 strOr( 发 `private def strOr(s:String):String=Option(s).getOrElse("")`。
- 含 upsertBy( 发 `private def upsertBy[A](list:List[A], item:A)(key:A=>Any):List[A]`：k=key(item)→idx=list.indexWhere→命中 list.updated 保 slot，否则追加 list :+ item。Any 是现有局部 helper 限制，不扩为通用 API。

### 4.2 每种函数签名/RHS

```scala
// create：bodyExpr；若依赖 emptyRow 但默认行缺席，则 existing.getOrElse(???)
def onEvent(existing: Option[View], e: Event): View = ...
// updateOnly：bodyExpr 空时为 row，否则原 body；壳负责查无行跳过
def onEvent(row: View, e: Event): View = ...
// delete：deletePairs(0/1)._2；缺一项填 ""；不按 sourceType/sourceId 名定位
def onEvent(e: Event): (String, String) = (key0, key1)
// persistenceIdCreate：bodyExpr；若依赖 emptyRow 且默认行缺席，实际模板错误地引用无参数 existing
def onEvent(e: Event, entityId: String): View = ...
```

- degraded **无函数**，不是每种未知都发 ???。其它未知 applyForm（手工 Model 可达）用 existing 参数形及 `existing.getOrElse(???)`。
- create 默认行失败时 Some(existing) 可以原样返回，仅 None 执行 ???；不能称“一律显式失败”。persistenceIdCreate 降级分支输出 `existing.getOrElse(???)`，该签名无 existing，是源级缺陷，不作目标金样。
- event 类型取 eventFqn 最后片段，FQN 缺失会形成空/无效类型；不自动解冲突。模板不注入 ActorRef/PO/SQL，但既有固定 Metarch import、时钟、Id 工厂仍是依赖。

## 5. JS 当前责任与对照

- formal [renderJournalDomain](../baseline/js/generators/scala-cqrs-play-service/render-journal-domain.mjs) 从 projectionStore.streams、reference-layout 解声明，生成 state 解码/空 state identity/Ownership、`fold(row,event:Any,ownership)`；逐 stream 用 EventAdapter.fromJournal→domain EventHandler.foldLeft→验证 identity→ownership→StatePB bytes。它是聚合状态回放，不是 `Option[View]×Event→View`。接线见 [renderJournalReadside](../baseline/js/generators/scala-cqrs-play-service/render-journal-readside.mjs#L249)。
- legacy [emit](../baseline/js/generators/projection-dsl/emit.mjs#L293) 只有 handler MANUAL ???；[smviews](../baseline/js/generators/projection-dsl/smviews.mjs#L237) translateVector 直接在 MANUAL 中 Await/read/copy/upsert，含硬编码 KnowledgeSemanticView 默认行与 10s；graph translateGraph 直接调用 repo 动词，残余转 ???。有部分表达式生成，**无独立 ApplyEvent 文件/产品接线**。
- deprecated [handler](../baseline/js/generators/_deprecated/scala-cqrs-es-projection/templates/handler.mjs) table/vector/graph 派生 MANUAL 或取 sidecar；不相等时直接保留人工 bytes，无 sidecar且无法派生则抛，不能把“字节一致”当语义来自真源。tableManual 的 keysDecl 是 String，却比较 k.name，不能假称键派生已经正确。
- 新 family [handlerTemplate](../baseline/js/generators/scala-cqrs-persistence-readside-v1/templates/repository.mjs#L203) decode frame→现有 aggregate EventHandler.apply→事件/state/index/checkpoint，一 aggregate map-index 状态回放；不输出独立 view apply-event。family Model/renderer owner 见 [build-models](../baseline/js/generators/scala-cqrs-persistence-readside-v1/build-models.mjs)、[render](../baseline/js/generators/scala-cqrs-persistence-readside-v1/render.mjs)，仅 reuse 映射/命名/writer discipline，不能当此族 exact。

结构性对照，非同输入字节比较。minus 摘自 [真实银行输出](../baseline/actual-js/app/example/bankwealth/infrastructure/projection/BankJournalReadsideDomain.scala#L28)；plus 以示例 View/Event 名表达 raw create 结构，未虚构银行有此 view。

```diff
-object BankJournalReadsideDomain {
-  def fold(row: Row, event: Any, ownership: Ownership): State = row.kind match {
-    case "payment-saga" | "payment-host" | "payment-run" | "refund-saga" | "refund-host" | "refund-run" | "ta-host" | "ta-run" | "sip-host" | "sip-run" => State(None, None, None)
-    case _ => throw new IllegalArgumentException("unrecognized persistence kind")
-  }
-}
+package example.bankwealth.application.projection.handlers
+import example.bankwealth.application.projection.repository.ViewTable.View
+import example.bankwealth.domain.entities.SampleEntity.Renamed
+object ViewApplyEvent {
+  private def emptyRow: View = View(label = "")
+  def onRenamed(existing: Option[View], e: Renamed): View =
+    existing.getOrElse(emptyRow).copy(label = e.label)
+}
```

plus 修正为配置业务 base 的正常 import（明确覆盖 raw 硬编码），不表示业务行为已验证。[人工月度 handler](../baseline/curated-scala/net/imadz/application/projection/MonthlyIncomeAndExpenseSummaryProjectionHandler.scala) 是 adapter+时间/正负金额+repo 写，不存在分离 ApplyEvent 金样；不能把它包装一下就宣称纯函数等价。

## 6. 胶水与后续实施写集合

必需生成类型 `<base>.application.projection.repository.<View>Table.<View>`、`<base>.domain.entities.<Agg>Entity.<Event>`；`net.imadz.common.Id.of`、java.time.Instant；壳的 converter/ViewMachine/repository 不得倒灌进 kernel。`ViewMachine.run/updateOnly` 负责 IO，与此纯数据函数分开，ABI/事务详见 [handler diff](projection-handler.diff.md)。不据 sibling 源存在推断 common-core JAR 包含新 ViewMachine。

后续 proposed：`generators/scala-cqrs-projection-v1/build-apply-event-models.mjs`、`templates/apply-event.mjs`；复用明确类型解析，不移植有损 regex/静默默认。projection 集成者的 `build-models.mjs/render.mjs` 为组装 owner，收到已判定的函数 presence/form/signature 后**条件创建**文件；handler 只引用实际存在函数。legacy smviews/emit/deprecated handler 的 MANUAL 折叠可逐个迁到此模型，人工 body 需映射/回锚后迁，不丢副作用、不假成功。formal render-journal-domain.mjs 保留自身责任，是否迁移由 D-P01 决策。公共 profile/registry/names/types/layout/writer 归集成者，本次不修改。

## 7. 验收与未决项

未来同输入文件 `diff -u <scala-output> <js-output>`：单项目0文件、multi缺席/空对象/四形函数、全部 Model 字段/construct/RHS/默认行与 helper 触发、imports、函数顺序、keyword、锚、稳定重复生成。经批准独占输出内 `sbt compile`，逐函数输入 existing Some/None、updateOnly 查无行、delete 字面量/Id/两键顺序、nullable/epoch0/None patch/列表 slot 的 oracle；不能用仅签名对账代替行为。生成/编译写 target/cache，当前没有运行，也不指定不存在的 spec。CC≤5、>10需重构/逐方法批准，不许 String/Any dispatcher 刷分。

新增 3 个未决语义，另依赖 D-P01/D-P03/D-P05。

- **D-P08**：delete 字面键/显式 .toString 的丢失、只按位置取键、未知/空 form 是否应该 fail-closed；如何统一 Builder 的 applyForm/函数 presence 与 handler 判定，避免空对象引用/错误参数签名。
- **D-P09**：None patch 是保留原列还是清空、epoch0/null 时间是否可取 now、emptyRow 未知默认值与 persistenceId 所有 Id 列取同值是否成立；需要业务 oracle，不能声称当前纯函数确定性。
- **D-P10**：shared ViewMachine 的实际 FQN/API、kernel↔glue 边界和源码依赖账如何提供；原硬编码 Metarch import、persistenceIdCreate 降级无 existing、viewColumns nullable 分歧须作为显式修正而非复刻。

`generatorsModified=false`；`runtimeExecuted=false`。
