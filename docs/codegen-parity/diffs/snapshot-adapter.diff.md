# snapshot-adapter — 状态快照类型、恢复行为与文件拆分

- Artifact **32 / `snapshot-adapter`**，状态 **`decision-required`**。这是第一阶段文档，不是 implemented/parity-PASS/behavior-PASS；未运行生成、构建、测试、服务或改 Git。
- 固定 [inventory](../scala-artifacts.json) / [index](../baseline/index.json)：BC `cc335eb1e0d0fae17bf092fd61b126040196ea70`，JS `bf104e16ab82ef39d7fa416d0997907d18a815ad`。
- [Scala调度 L950–959](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala) 对每个 `app.aggregates` 都发一份，不根据 snapshot retention 设置裁剪。传统 Play路径 `app/<B path>/infrastructure/persistence/<AggregateBase>SnapshotAdapter.scala`，package `B.infrastructure.persistence`；shared VO没有独立 snapshot adapter。运行时何时保存快照不是本模板的职责。

## 1. Model 的全部字段与子型

完整 [AdapterModel.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/infrastructure/persistence/AdapterModel.scala)，event/snapshot共用。这里完整列出，避免把 snapshot 误当只有一个 typeName 的小模板。

```scala
AdapterModel(
  selfType: TypeRef,
  scalaRootType: TypeRef,
  protoRootType: TypeRef,
  mappings: Seq[AdapterMapping],
  converterTrait: TypeRef,
  converters: Seq[ConverterMethodModel] = Nil,
  isSnapshot: Boolean = false,
  dependencies: Set[TypeRef],
  noteIds: Seq[String] = Nil) // extends ArtifactModel; selfType/dependencies/noteIds 为 override val
AdapterMapping(
  scalaCaseName: String,
  protoOneOfName: Option[String],
  protoMessageName: String,
  fields: Seq[FieldMapping] = Nil)
FieldMapping(scalaName: String, protoName: String,
  conversion: ConversionStrategy, scalaType: TypeRef)
ConverterMethodModel(methodNameBase: String, scalaType: TypeRef,
  protoType: TypeRef, toJournalBody: String, fromJournalBody: String)
sealed trait ConversionStrategy
case object Direct extends ConversionStrategy
case class CustomConversion(methodNameBase: String) extends ConversionStrategy
case object EnumMapping extends ConversionStrategy
case object OptionWrap extends ConversionStrategy
```

`TypeRef(name:String,packageName:String,typeParams:Seq[TypeRef]=Nil)` 见 [TypeSystem](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala)。继承 [ArtifactModel](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala) 的 fqn、registerTo、morphisms=Nil；noteIds供writer记账，不在模板 body手造注解。

snapshot读取 selfType、scalaRootType、protoRootType、converterTrait、dependencies 和 `mappings.head.scalaCaseName`；不读取 protoOneOfName/protoMessageName/fields、converters、isSnapshot。**`toJournalBody/fromJournalBody` 为保留的原始源码字符串槽，当前模板不发射、builder不填，不能用它们证明可配置恢复算法。** 字段存在与行为就绪是两件事；此 raw模板无 `???`/MANUAL。

## 2. Builder 的全部决策

[AggregateAdapterBuilder L87–151](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/persistence/AggregateAdapterBuilder.scala)：

1. selfType=`typeResolver.aggregateSnapshotAdapter(meta)`，后者 AggregateBase + SnapshotAdapter，包=layout.infrastructure.persistence.root。
2. state=`metaRegistry.resolve[ValueObjectMetadata](meta.stateRef)`，缺失抛 `RuntimeException("Critical Error: Cannot resolve State Metadata for <stateRef.targetName>")`；无 default state fallback。
3. 可选 entity=`resolve[DomainEntityMetadata](meta.entityRef)`：若存在且 entity.state.name==stateMeta.name，statePkg=`layout.domain.entities.root + "." + meta.entityRef.targetName`；否则 state FQN 去最后名字得到relative，空→ctx.basePackage，非空→`ctx.basePackage + "." + relative`。
4. scalaRootType=`scalaStateType(stateMeta.name,statePkg)`；protoRootType=`protoState(meta.name,ctx)`，来自 aggregate BaseStatePO+该aggregate的proto文件包，不是直接采用 stateMeta.name。
5. converterTrait=`aggregateProtoConverter(meta)`；唯一 mapping `(stateMeta.name,None,stateMeta.name+"PO",Nil)`。
6. deps=`Set(snapshotAdapter,scalaRootType,protoRootType,converterTrait)`；mappings=Seq(mapping)，converters=Nil，isSnapshot=true，noteIds=aggregate.noteId.toSeq。

约束缺口：mapping列出的 protoMessageName 在模板中不用；若 stateMeta名不是 BaseState，方法会调 `StateMetaNameConv` 而 cast到 `BaseStatePO`，与 converter的 StateMetaNamePO不一定一致。builder没有在这里检测；必须和 schema/converter构造一起做一致性判定，而不是猜“命名上看着差不多”。

## 3. Template 的完整 construct/RHS

完整 [SnapshotAdapterTemplate](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/persistence/SnapshotAdapterTemplate.scala)。

| 顺序 | 内容与精确规则 |
|---|---|
| 1 package | `package selfType.packageName` |
| 2 imports | dependencies映射 `package.name`，sorted.distinct；再追加固定 `akka.persistence.typed.SnapshotAdapter`；通过imports DSL排序，但**不再去重**。所以当前builder已含该类型时产生重复import。不是已经正常化的目标。 |
| 3 comment/class | 中文职责Scaladoc；`class Self extends SnapshotAdapter[ScalaRoot] with ConverterTrait`。无显式主/辅构造器、companion、generic参数、bounds、annotation/self-type、type alias、字段或implicit/lazy成员。 |
| 4 converter selection | 生成时 `mapping=mappings.head`，convObj=`mapping.scalaCaseName+"Conv"`；空mappings会在生成时失败，不是运行时空状态。 |
| 5 methods | toJournal先、fromJournal后；完整body如下。 |

```scala
class <Self> extends SnapshotAdapter[<ScalaRoot>] with <ConverterTrait> {
  override def toJournal(state: <ScalaRoot>): Any = {
    <StateName>Conv.toProto(state)
  }

  override def fromJournal(from: Any): <ScalaRoot> = {
    val proto = from.asInstanceOf[<ProtoRoot>]
    <StateName>Conv.fromProto(proto)
  }
}
```

这是Akka要求的边界 `Any`，不是业务内部允许使用无类型dispatcher。`fromJournal`先cast后convert；错误类型可能 ClassCastException，null会传给converter再按实际解引用失败；没有default empty、读仓库、事件补发、重试或恢复完成承诺。

**本接口没有 manifest/identifier/toBinary/fromBinary/includeManifest 方法。** SnapshotAdapter只做DomainState↔journal对象；字节序列化属于另一个serializer。不能为了形式统一给 snapshot添 EventAdapter的方法。

## 4. 人工参考 vs raw vs behavior-ready

[人工 CreditBalanceSnapshotAdapter](../baseline/curated-scala/net/imadz/infrastructure/persistence/CreditBalanceSnapshotAdapter.scala) 的包/继承同方向，但 imports `CreditBalanceEntity._` 与 `proto.credits.CreditBalanceStatePO`；`credits`不是raw常规`credit_balance`。toJournal body相同；fromJournal不同：

```scala
override def fromJournal(from: Any): CreditBalanceState = from match {
  case po: CreditBalanceStatePO =>
    CreditBalanceStateConv.fromProto(po)
  case unknown => throw new IllegalStateException(s"Unknown journal type: ${unknown.getClass.getName}")
}
```

这里unknown=null时 `.getClass` 仍会NPE；不能称null安全的完成方案。raw cast、人工IllegalStateException、formal JS IllegalArgumentException三种行为不能悄悄混用。本文目标是将差异交具体决策，不为“好看”选择一个然后声称不变。

snapshot helper本身虽然可直接委托，并不证明 converter所有container类型/required字段/codec/共享VO可正确回读，更不证明业务fold/command logic已脱离 `???` 或原始代码槽。目标 behavior-ready必须实际验证旧snapshot bytes与真实依赖接口，不以文件存在为通过。

## 5. JS formal 实现/新 family/legacy

### formal四层账

- Model/Builder没有独立快照模型；[render-adapters L59–70](../baseline/js/generators/scala-cqrs-domain/render-adapters.mjs) 从 layout aggregate id/name直接推 State/StatePB和方法名。与events同函数输出。
- Template为 `object <A>SnapshotAdapter extends SnapshotAdapter[<A>State]`，与EventAdapter合写 `app/<B path>/infrastructure/serialization/<A>Adapters.scala`。
- imports由组合文件提供 `akka.persistence.typed.{EventAdapter,EventSeq,SnapshotAdapter}`、B.domain._、B.domain.AProtocol._；snapshot本身不需要全部event imports。
- toJournal=`DomainConverters.encode<A>StatePB(state)`；fromJournal value match到精确 `B.infrastructure.proto.<A>StatePB` 才decode；其它抛 `IllegalArgumentException("snapshot type mismatch")`。**没有manifest参数**。
- 银行三个完整实物：[CreditBalance L38–44](../baseline/actual-js/app/example/bankwealth/infrastructure/serialization/CreditBalanceAdapters.scala)、[FundOrder L113–119](../baseline/actual-js/app/example/bankwealth/infrastructure/serialization/FundOrderAdapters.scala)、[SipPlan L71–77](../baseline/actual-js/app/example/bankwealth/infrastructure/serialization/SipPlanAdapters.scala)。

### snapshot字段/递归消费账（不是把快照body当黑箱）

所有domain type来自 `example.bankwealth.domain.values`（primitive/容器除外）。所有root PB在 `example.bankwealth.infrastructure.proto`。[银行proto](../baseline/actual-js/app/protobuf/example_bankwealth_domain.proto) 与实际State构造顺序对齐；下表 k列精确表示 **PB名 fk、field number k+1**。不擅改号或顺序。

**CreditBalanceStatePB**，9字段；[State](../baseline/actual-js/app/example/bankwealth/domain/CreditBalanceState.scala)，proto L1115–1125：

| k | domain accessor:type | PB field type |
|---|---|---|
| 0 | id:AccountId | AccountIdPB |
| 1 | initialized:Boolean | bool |
| 2 | accountBalance:Map[String,Money] | CreditBalanceStatePBField2 |
| 3 | reservedAmount:Map[TxId,Money] | CreditBalanceStatePBField3 |
| 4 | incomingCredits:Map[TxId,Money] | CreditBalanceStatePBField4 |
| 5 | committedOutgoing:Map[TxId,Money] | CreditBalanceStatePBField5 |
| 6 | committedIncoming:Map[TxId,Money] | CreditBalanceStatePBField6 |
| 7 | compensatedOutgoing:Map[TxId,Money] | CreditBalanceStatePBField7 |
| 8 | compensatedIncoming:Map[TxId,Money] | CreditBalanceStatePBField8 |

**FundOrderStatePB**，30字段；[State](../baseline/actual-js/app/example/bankwealth/domain/FundOrderState.scala)，proto L1297–1328。`F(k)`精确展开为`FundOrderStatePBField<k>`：

| k | accessor:type | PB |
|---|---|---|
| 0 | id:FundOrderId | FundOrderIdPB |
| 1 | status:String | string |
| 2 | operationId:OperationId | OperationIdPB |
| 3 | investorAccountId:AccountId | AccountIdPB |
| 4 | fundCollectionAccountId:AccountId | AccountIdPB |
| 5 | fundCode:String | string |
| 6 | amount:Money | MoneyPB |
| 7 | reservedSubscriptions:Map[TxId,Money] | F(7) |
| 8 | committedSubscriptions:Map[TxId,Money] | F(8) |
| 9 | compensatedSubscriptions:Map[TxId,Money] | F(9) |
| 10 | selectedPaymentTxId:TxId | TxIdPB |
| 11 | paymentOutcome:String | string |
| 12 | cashPaymentResults:Map[TxId,String] | F(12) |
| 13 | cashPaymentFinalResults:Map[TxId,String] | F(13) |
| 14 | taRequestId:TaRequestId | TaRequestIdPB |
| 15 | taReference:String | string |
| 16 | taStatus:String | string |
| 17 | taReceipts:Map[String,String] | F(17) |
| 18 | taReceiptOutcomes:Map[String,String] | F(18) |
| 19 | taConfirmedShares:FundShare | FundSharePB |
| 20 | taRejectionReason:String | string |
| 21 | refundOperationId:OperationId | OperationIdPB |
| 22 | refundOutcome:String | string |
| 23 | refundResultReceipts:Map[String,String] | F(23) |
| 24 | refundFinalResults:Map[TxId,String] | F(24) |
| 25 | taObservedReceipts:Map[String,String] | F(25) |
| 26 | paymentObservedResults:Map[TxId,String] | F(26) |
| 27 | refundObservedResults:Map[TxId,String] | F(27) |
| 28 | cashRequestSource:Option[BankCashOriginal] | F(28) |
| 29 | cashRequestOriginals:Map[String,BankCashOriginal] | F(29) |

**SipPlanStatePB**，27字段；[State](../baseline/actual-js/app/example/bankwealth/domain/SipPlanState.scala)，proto L1663–1691。`S(k)`精确展开`SipPlanStatePBField<k>`：

| k | accessor:type | PB |
|---|---|---|
| 0 | id:PlanId | PlanIdPB |
| 1 | initialized:Boolean | bool |
| 2 | scheduleSealed:Boolean | bool |
| 3 | scheduleCount:Long | sint64 |
| 4 | lastDueSlot:Long | sint64 |
| 5 | slots:Map[Long,Long] | S(5) |
| 6 | currentTick:Long | sint64 |
| 7 | observedCount:Long | sint64 |
| 8 | startCount:Long | sint64 |
| 9 | paused:Boolean | bool |
| 10 | pauseTick:Long | sint64 |
| 11 | pauseIntervals:Map[Long,Long] | S(11) |
| 12 | revisions:Map[RevisionId,SipRevisionConfig] | S(12) |
| 13 | revisionEnds:Map[RevisionId,Long] | S(13) |
| 14 | latestRevision:RevisionId | RevisionIdPB |
| 15 | latestEffectiveSlot:Long | sint64 |
| 16 | slotDisposition:Map[Long,String] | S(16) |
| 17 | occurrences:Map[Long,SipOccurrence] | S(17) |
| 18 | occurrenceProgress:Map[OccurrenceId,String] | S(18) |
| 19 | firstTerminals:Map[OccurrenceId,String] | S(19) |
| 20 | terminalReceiptBodies:Map[String,String] | S(20) |
| 21 | successTotal:Long | sint64 |
| 22 | failureTotal:Long | sint64 |
| 23 | createIntent:Option[BankSipCreateIntent] | S(23) |
| 24 | sipCreateIntents:Map[String,BankSipCreateIntent] | S(24) |
| 25 | createIntentDueSlots:Vector[Long] | S(25) |
| 26 | intentAppendedDueSlots:Map[Long,Long] | S(26) |

对应每个 map carrier `XStatePBFieldk` 的message固定为`repeated XStatePBFieldkEntry f0=1`；Entry `key f0=1,value f1=2`，名义key/value仍是各自PB，Long是sint64。optional carrier为`bool present=1; <NominalPB> f0=2`；sequence carrier为`repeated sint64 f0=1`。这些container的decode先经过required carrier检查，map还拒绝duplicate decoded keys，不能换成裸Map的默认空。

根state converter toProto：字段顺序同表，primitive直接给值、所有message/carrier包装Some(encode…)；fromProto：依序取p.fk，primitive直接给值、message必须getOrElse(throw "required typed value missing")再decode；末尾构造完整State，**不调用 State.empty**。VO/container的全部递归/RHS见 [converter文档 §6](proto-converter.diff.md)。状态表把命名/PB字段一一对应，不能为new schema美观重排或把 nominal TxId/AccountId/PlanId合并。

### legacy 与 family

[adapter-dsl/emit.mjs L48–77](../baseline/js/generators/adapter-dsl/emit.mjs) 已有独立class、mixin、raw cast恢复，与Scala模板相近；但它是有顶层文件I/O的CLI、硬编码header、重复SnapshotAdapter import，formal不调用，不能原样import成纯模板。

新 [aggregate-core-v1 factory](../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/factory.mjs) 收 `snapshotAdapter: akka.persistence.typed.SnapshotAdapter[State]`；是需要外部实现的端口，不是新family已提供bank snapshot codec。kernel-v1 对sequence/map加present与integer改int64的schema差异见 [proto文档](protobuf-schema.diff.md)，不能拿它直接回读上述sint64/tag1快照。

## 6. substantive unified diff（保持wire/error语义的目标提案）

minus为actual完整snapshot对象；plus按Scala每聚合class+mixin布局组织，**继续使用现有CreditBalanceStatePB与错误类型/文本**，不声称已采用raw cast，也不改state名/字段号/codec。converter由[converter文档](proto-converter.diff.md)供完整typed CreditBalanceStateConv。文件移动/拆分有回锚迁移，非同输入完整字节比较。

```diff
--- a/app/example/bankwealth/infrastructure/serialization/CreditBalanceAdapters.scala
+++ b/app/example/bankwealth/infrastructure/persistence/CreditBalanceSnapshotAdapter.scala
@@
-object CreditBalanceSnapshotAdapter extends SnapshotAdapter[CreditBalanceState] {
-  override def toJournal(state: CreditBalanceState): Any = DomainConverters.encodeCreditBalanceStatePB(state)
+package example.bankwealth.infrastructure.persistence
+
+import akka.persistence.typed.SnapshotAdapter
+import example.bankwealth.domain.CreditBalanceState
+import example.bankwealth.infrastructure.persistence.converters.CreditBalanceProtoConverters
+import example.bankwealth.infrastructure.proto.CreditBalanceStatePB
+
+class CreditBalanceSnapshotAdapter extends SnapshotAdapter[CreditBalanceState]
+    with CreditBalanceProtoConverters {
+  override def toJournal(state: CreditBalanceState): Any =
+    CreditBalanceStateConv.toProto(state)
+
   override def fromJournal(value: Any): CreditBalanceState = value match {
-    case state: example.bankwealth.infrastructure.proto.CreditBalanceStatePB => DomainConverters.decodeCreditBalanceStatePB(state)
+    case state: CreditBalanceStatePB => CreditBalanceStateConv.fromProto(state)
     case _ => throw new IllegalArgumentException("snapshot type mismatch")
   }
 }
```

这份diff的新增package/import属于拆出的新文件，旧组合文件event部分同时由event文档迁走；不是在原class中间插package的可直接apply patch。FundOrder、SipPlan按同模式，各自PB类型/StateConv不同，不制造同形别名互换。

## 7. byte serializer/胶水与装配边界

snapshot不执行toBinary/fromBinary。实际路径为：State→SnapshotAdapter.toJournal→PB message→Akka按**具体PB类绑定**找到DomainProtoSerializer→白名单manifest→toByteArray；恢复按serializer id+manifest→parseFrom(bytes)→PB message→SnapshotAdapter.fromJournal→State。

相关 [实际DomainProtoSerializer](../baseline/actual-js/app/example/bankwealth/infrastructure/serialization/DomainProtoSerializer.scala) 的`identifier=741000`、`manifest(value:AnyRef)=manifestPart0(value)`、`toBinary(value:AnyRef)={manifest(value);value.asInstanceOf[GeneratedMessage].toByteArray}`、`fromBinary(bytes:Array[Byte],manifest:String)=fromBinaryPart0(bytes,manifest)`；state manifests分别 **CreditBalanceStatePB / FundOrderStatePB / SipPlanStatePB**。它们不是SnapshotAdapter的方法；整个白名单/分片/unknown分支详见 [event文档 §6](event-adapter.diff.md)。不得用PB wildcard绑定来替代每个真实PB FQN，也不能改identifier或PID隐藏迁移问题。

胶水精确符号：`akka.persistence.typed.SnapshotAdapter[S]` 的两个journal方法；`scalapb.GeneratedMessage.toByteArray` 与各PB companion.parseFrom；`akka.serialization.SerializerWithStringManifest` 的identifier/manifest/byte方法；`net.imadz.common.serialization.PrimitiveConverter.ProtoConverter[S,P]`（继承获得的内嵌类型，真实JAR需另证）；应用自己的 `B.infrastructure.persistence.converters.<A>ProtoConverters.<State>Conv`。不根据源码存在推断所有依赖已发布/可用。

[formal bootstrap](../baseline/js/generators/scala-cqrs-play-service/templates/aggregate-bootstrap.mjs) 当前import `B.infrastructure.serialization.{AEventAdapter,ASnapshotAdapter}` 并用singleton `.snapshotAdapter(ASnapshotAdapter)`；切class要改new/注入+import，**保持 `PersistenceId.ofUniqueId(persistenceId)`、emptyState=initial、eventHandler不变**。删除旧snapshot或改保存策略不属于本规格的授权。

## 8. 实施写集合（仅提案）

- `generators/scala-cqrs-domain/templates/snapshot-adapter.mjs`（proposed）：只发本文package/import/class/two methods；去重复import为用户明确可读性覆盖，不暗改cast/match决策。
- `generators/scala-cqrs-domain/models/adapter.mjs`、`builders/aggregate-adapter.mjs`（proposed）：由event-adapter组装owner与本子规格共用，验证mappings单一且非空、state/PO/converter一致。
- `generators/scala-cqrs-domain/render-adapters.mjs`：split出snapshot，**由event文档owner统一改此共享文件**；这里不另写第二份serializer。
- `generators/adapter-dsl/emit.mjs`：legacy可复用class结构，先隔离CLI I/O再引入正式renderer；不能执行现CLI。
- `generators/scala-cqrs-play-service/templates/aggregate-bootstrap.mjs`：调用方依赖由集成者统一更改；shared layout/names/types/writer/registry与config仍属集成owner。

新旧文件清单由manifest控制退役，旧AAdapters中的snapshot锚映射到独立文件和方法；所有states/converters/proto/serializer bindings同步审查。禁止手改银行generated或拷贝baseline当目标。没有业务算法缺口时不人为加入MANUAL/???，有unsupported codec时明确拒绝而非返回empty state。

## 9. 验收与具体未决

尚未执行。未来批准输出后，用同等输入比完整snapshot文件、converter+schema+bindings，覆盖3聚合全部66个root字段及其容器闭包；检查实际ScalaPB序列化字节与旧snapshot恢复、wrong-type/null/required-message/duplicate map/optional absence、exact decimal与negative Long；不能仅测 `.empty` roundtrip。生成计划命令形状 `node bin/truthsrc.js generate-project --project <absolute-project> --out <approved-output> --plan`（先审副作用边界）；真实生成、目标仓`sbt compile`/`sbt test`另授权，当前未运行。银行service禁testOnly，不猜spec名。

普通method CC≤5，>10先拆typed helper或逐方法批准；SnapshotAdapter的Any是框架签名，不扩散到domain/codec。稳定重生与回锚应覆盖split/move/delete，不能通过清理PID数据通过验收。

1. **S-ERROR-POLICY**：保留formal match+IllegalArgumentException（本文过渡目标），复制raw cast+ClassCastException，或采用人工IllegalStateException？null行为也要明确，不随重命名夹带。
2. **S-SCHEMA-REPLAY**：PB/flat_package→per-aggregate PO的迁移是否批准？旧state manifest/id/PB descriptors和读旧snapshot路径如何保留，不能擅自删除snapshots/换PID。
3. **S-STATE-NAME**：stateMeta.name、aggregate BaseStatePO、converter state PO必须一致或显式绑定；否则generation fail的具体位置/报错需确定。
4. **S-CLASS-INJECTION**：class实例在哪构造/注入？三个bootstrap与legacy factory同时还是分profile迁移？由集成者确认实际调用方集合。
5. **S-PRESENCE-NUMERIC**：现state map/sequence tag1与new family present1/payload2、sint64/int64差异属于真实兼容性变更，先冻结/版本化，不能为统一模板强行切换。

额外未入baseline但本次读取的生产源码：无。
