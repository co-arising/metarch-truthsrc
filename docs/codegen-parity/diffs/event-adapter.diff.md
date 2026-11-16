# event-adapter — journal 类型、manifest 与 byte serializer 分层

- Artifact **31 / `event-adapter`**；状态 **`decision-required`**。仅文档；未生成、编译、测试、启动服务或变更运行数据。
- 固定来源 [inventory](../scala-artifacts.json)、[index](../baseline/index.json)，BC `cc335eb1e0d0fae17bf092fd61b126040196ea70` / JS `bf104e16ab82ef39d7fa416d0997907d18a815ad`。
- [Scala 调度 L940–948](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala) 每个 `app.aggregates` 一份，跟 proto/converter 同循环。传统输出 `app/<B path>/infrastructure/persistence/<AggregateBase>EventAdapter.scala`；package `B.infrastructure.persistence`。没有 shared-VO event adapter；classic saga v3 不从此处生成 runtime 的 adapter。
- 本文是四份文档中 **`render-adapters.mjs` / DomainProtoSerializer 文件组装的主 owner**；snapshot 文档只定义 snapshot 分支，避免一个 JS 文件被两组各自重写。该 owner 只是未来分工，不是本阶段实施许可。

## 1. Model 全字段与未用槽

完整 [AdapterModel.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/infrastructure/persistence/AdapterModel.scala)，按源码参数顺序：

```scala
case class AdapterModel(
  override val selfType: TypeRef,
  scalaRootType: TypeRef,
  protoRootType: TypeRef,
  mappings: Seq[AdapterMapping],
  converterTrait: TypeRef,
  converters: Seq[ConverterMethodModel] = Nil,
  isSnapshot: Boolean = false,
  override val dependencies: Set[TypeRef],
  override val noteIds: Seq[String] = Nil
) extends ArtifactModel
case class AdapterMapping(
  scalaCaseName: String,
  protoOneOfName: Option[String],
  protoMessageName: String,
  fields: Seq[FieldMapping] = Nil
)
case class FieldMapping(
  scalaName: String, protoName: String,
  conversion: ConversionStrategy, scalaType: TypeRef
)
case class ConverterMethodModel(
  methodNameBase: String, scalaType: TypeRef, protoType: TypeRef,
  toJournalBody: String, fromJournalBody: String
)
sealed trait ConversionStrategy
case object Direct extends ConversionStrategy
case class CustomConversion(methodNameBase: String) extends ConversionStrategy
case object EnumMapping extends ConversionStrategy
case object OptionWrap extends ConversionStrategy
```

TypeRef 是 `TypeRef(name:String,packageName:String,typeParams:Seq[TypeRef]=Nil)`；ArtifactModel 的 fqn/registerTo/morphisms=Nil 见 [TypeSystem](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala)、[ArtifactModel](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala)。注意 dependencies 必需，虽排在默认参数之后也没有默认值。

当前 event template **只读** selfType、scalaRootType、protoRootType、mappings.scalaCaseName/protoOneOfName、converterTrait、dependencies；不读 mappings.protoMessageName/fields、converters、isSnapshot、noteIds（文件锚走 writer）。body:String 两槽是**原始源码逻辑槽**，不是结构化行为 AST；builder 都设 Nil，模板也没有发射它们。不能因为这些字段存在就声称支持自定义 enum/optional 转换。此族 raw template 本身没有 `???` 或 MANUAL 成员。

## 2. Builder 的精确推导

[AggregateAdapterBuilder L13–85、L153–156](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/persistence/AggregateAdapterBuilder.scala)：

1. `selfType=ctx.typeResolver.aggregateEventAdapter(meta)`，常规 `<Base>EventAdapter` / `layout.infrastructure.persistence.root`。
2. `metaRegistry.resolve[EventFamilyMetadata](meta.eventFamilyRef)`；不存在抛 `RuntimeException("Critical Error: Cannot resolve EventFamily Metadata for <target>")`，不生成空 adapter。
3. domain root 名=eventFamily.name，包=`layout.domain.entities.root + "." + meta.entityRef.targetName`。这里**没有用 entityObjectPath 的智能 fallback**；与 converter builder 不完全同构，实体名/对象名不同需一致性门。
4. `protoRootType=protoEventFamily(meta.name,ctx)`（`BaseEventPO.Event`），outerProto=protoEvent（`BaseEventPO`），converterTrait=aggregateProtoConverter(meta)。
5. 每个 event 按 eventFamily.events 原顺序：scalaCaseName=evt.name，protoOneOfName=Some(pascalCaseOf(evt.name))，protoMessageName=`evt.name+PO`，fields=Nil。pascalCaseOf 是 split `[-_]`→过滤空→各段首字母大写→拼接；`result_succeeded`→ResultSucceeded，不修改领域名本身。
6. deps=Akka EventAdapter/EventSeq + domain root + proto root + outer proto + converter trait + 每个领域 event TypeRef；isSnapshot=false，converters=Nil，noteIds=aggregate noteId.toSeq。Builder 不需要 payload PO imports，因为转换细节封装于 converter。

## 3. Scala Template 从头到尾与完整行为模式

完整 [EventAdapterTemplate](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/persistence/EventAdapterTemplate.scala)。所有输出 construct：

- package selfType.packageName。
- deps→`d.packageName + "." + d.name`→sorted.distinct，**不调用 shouldImport 过滤**。imports DSL 再排序逐行输出，无 wildcard；包括 outer Proto 与嵌套 Event 的 import（即使 body 写完整 `BaseEventPO.Event`）。
- 适配器中文职责 Scaladoc，然后 `class Self extends EventAdapter[DomainRoot, ProtoRoot] with ConverterTrait`；无显式构造参数、companion、泛型界限、type alias、val/var/implicit/lazy/annotation/self-type。
- 成员严格按 manifest → toJournal → fromJournal 顺序。完整生成模式如下，循环体解释见下表：

```scala
class <Self> extends EventAdapter[<DomainRoot>, <BaseEventPO.Event>]
    with <AggregateProtoConverters> {
  override def manifest(event: <DomainRoot>): String = event.getClass.getName

  override def toJournal(e: <DomainRoot>): <BaseEventPO.Event> = {
    val eventUnion = e match {
      // mappings 每项一条
      case evt: <scalaCaseName> =>
        <BaseEventPO.Event>.<protoOneOfName>(<scalaCaseName>Conv.toProto(evt))
    }
    eventUnion
  }

  override def fromJournal(p: <BaseEventPO.Event>, manifest: String): EventSeq[<DomainRoot>] = {
    p match {
      // mappings 每项一条
      case <BaseEventPO.Event>.<protoOneOfName>(po) =>
        EventSeq.single(<scalaCaseName>Conv.fromProto(po))
      case <BaseEventPO.Event>.Empty =>
        EventSeq.empty
    }
  }
}
```

| construct | 输入→行为/副作用顺序 |
|---|---|
| manifest | domain runtime class 的 `getName`；不查 PB、不编码、不保存任何状态。嵌套类可能带 `$`，不是业务显式版本字符串。 |
| toJournal cases | 对每个 mapping，先 typed converter.toProto，再构造 **oneof case**，绑定局部 eventUnion，最后返回。没有构造 outer `BaseEventPO(eventUnion)`。未知 domain 实例没有 default（运行时可能 MatchError）。 |
| fromJournal cases | 对 oneof 解构→converter.fromProto→EventSeq.single；`manifest` 参数**未使用**，不校验类型+manifest 配对。Empty→empty，意味着丢弃该 journal event，不是故障。 |
| converters/fields | 未用保留槽，不输出方法；没有 hidden field-by-field fallback、ActorRef、thenReply 或业务事件发布。 |

因此 raw 的“typed Journal=oneof ADT”与 **可序列化外壳 GeneratedMessage** 不可画等号。不能让它直接进 `GeneratedMessage.toByteArray` 或靠扩大绑定掩盖缺口。要写明真实 serializer 接收何类型及对应版本的 ScalaPB 接口，见未决 E-JOURNAL-TYPE。

## 4. 人工 Scala 参考，不冒充 raw 相同行为

[CreditBalanceEventAdapter](../baseline/curated-scala/net/imadz/infrastructure/persistence/CreditBalanceEventAdapter.scala) 的 domain `CreditBalanceEntity._` 与 `proto.credits._` wildcard imports 是历史人工源，不是正常 imports 目标。其 class+mix-in、getName manifest、返回 inner Event、Empty→empty 均与上述模式一致。完整映射集如下，左右 converter 名等于领域名+Conv：

`BalanceChanged, FundsReserved, FundsDeducted, ReservationReleased, IncomingCreditsRecorded, IncomingCreditsCommited, IncomingCreditsCanceled`。

每个 toJournal 为 `CreditBalanceEventPO.Event.<same-case>(<case>Conv.toProto(evt))`；from 为 `EventSeq.single(<case>Conv.fromProto(po))`，顺序即上表，Commited 拼写不“修正”。这不是银行 actual-js 那组 Confirmed 事件的同输入 gold master。

[StepExecutorEventAdapter](../baseline/curated-scala/net/imadz/infra/saga/persistence/StepExecutorEventAdapter.scala) 则有**不同的人工完成契约**：

- 构造器 `(override val system: akka.actor.ExtendedActorSystem)`；extends `EventAdapter[StepExecutor.Event, StepExecutorEventPO] with SagaExecutorConverter`。
- manifest=`event.getClass.getCanonicalName`（不是 getName）；toJournal match 得到 inner payload，再 **`StepExecutorEventPO(payload)`** 返回 outer message。
- ExecutionStarted→Started(ExecutionStartedConv)，OperationSucceeded→Succeed(OperationSucceededConv)，ManualFixCompleted→ManualFixed(ManualFixCompletedConv)，OperationFailed→Failed(FailedConv)，RetryScheduled→Rescheduled(RetryScheduledConv)。fromJournal 匹配 `p.event`，每条 EventSeq.single，default→EventSeq.empty。
- 该 runtime 示例证明 outer-envelope 是另一真实设计，而非 raw 模板已经如此；它的 system/动态结果序列化不能注入纯 domain 事件。raw→outer 必须单独决定 schema/serializer 迁移。

## 5. JS formal 产物与三层身份

formal 调用链起于银行 [project](../baseline/bank/truthsrc.project.json) 与 [service generate L16–23](../baseline/js/generators/scala-cqrs-play-service/generate.mjs)，继承的 domain [producer L16](../baseline/js/generators/scala-cqrs-domain/produce-v2.mjs) 一次发 converters+adapters；实际 [render-adapters L59–70](../baseline/js/generators/scala-cqrs-domain/render-adapters.mjs) 每聚合**一个 `<Aggregate>Adapters.scala`**，里面两个 singleton objects，package `B.infrastructure.serialization`。不存在独立 AdapterModel/Builder；从 products layout + dependency events 直接拼方法。

实际完整固定例：

- [CreditBalanceAdapters.scala](../baseline/actual-js/app/example/bankwealth/infrastructure/serialization/CreditBalanceAdapters.scala)，7 个事件；Event 部分 L8–37，snapshot L38–44。
- [FundOrderAdapters.scala](../baseline/actual-js/app/example/bankwealth/infrastructure/serialization/FundOrderAdapters.scala)，32 个事件；event L8–112，snapshot L113–119。
- [SipPlanAdapters.scala](../baseline/actual-js/app/example/bankwealth/infrastructure/serialization/SipPlanAdapters.scala)，18 个事件；event L8–70，snapshot L71–77。

imports 完整规则：先 `akka.persistence.typed.{EventAdapter, EventSeq, SnapshotAdapter}`，再 `B.domain._`，再 `B.domain.<Name>Protocol._`；body 仍大量 FQN。EventAdapter 的 J 是 `scalapb.GeneratedMessage`，不是 inner oneof，更不是 `Any` domain event。对每个事件 E、原聚合 id A：

```scala
manifest(event: Event): String = event match {
  case _: E => "AEPB"
}
toJournal(event: Event): scalapb.GeneratedMessage = event match {
  case value: E => DomainConverters.encodeAEPB(value)
}
fromJournal(event: scalapb.GeneratedMessage, manifest: String): EventSeq[Event] =
  (event, manifest) match {
    case (value: B.infrastructure.proto.AEPB, "AEPB") =>
      EventSeq.single(DomainConverters.decodeAEPB(value))
    case _ => throw new IllegalArgumentException("event manifest and payload mismatch")
  }
```

循环是完整的一对一映射，不是未解释的 dispatcher：mappings 输入次序来自 products.events，PB名=**原 id 拼接**（domain Scala名可能经 symbol），manifest 与 PB消息名相同；toJournal 返回 payload message，无 union；fromJournal 同时检查 PB具体类型与字符串，不忽略 manifest，且无 Empty/drop 分支。

全部实际 E 清单（前缀 A/后缀 PB 得到准确 manifest）：

| A | E（源码顺序） |
|---|---|
| CreditBalance | AccountInitialized; ReserveFundsConfirmed; DeductFundsConfirmed; ReleaseReservedFundsConfirmed; RecordIncomingCreditsConfirmed; CommitIncomingCreditsConfirmed; CancelIncomingCreditConfirmed |
| FundOrder | FundPurchaseSettlementRequested; ReserveFundSubscriptionConfirmed; FundSubscriptionPaymentConfirmed; CashFundSubscriptionCanceled; FundCashPaymentSucceeded; FundCashPaymentRejectedBeforeEffects; FundCashPaymentCompensated; FundCashPaymentRecoveryRequired; FundCashPaymentOutcomeUnknown; FundTASubmissionRegistered; FundTAAccepted; FundTASharesConfirmed; FundTARejected; FundTAUnknown; FundPurchaseRefundRequested; FundRefundSucceeded; FundRefundRejectedBeforeEffects; FundRefundCompensated; FundRefundRecoveryRequired; FundRefundOutcomeUnknown; FundTAReceiptObserved; BankPaymentResultSucceeded; BankPaymentResultRejectedBeforeEffects; BankPaymentResultCompensated; BankPaymentResultRecoveryRequired; BankPaymentResultOutcomeUnknown; BankRefundResultSucceeded; BankRefundResultRejectedBeforeEffects; BankRefundResultCompensated; BankRefundResultRecoveryRequired; BankRefundResultOutcomeUnknown; CashRequestSourceRecorded |
| SipPlan | SipPlanCreated; SipDueSlotAppended; SipScheduleSealed; SipPlanRevised; SipClockAdvanced; SipPlanPaused; SipPlanResumed; SipDueSlotObserved; SipPausedDueSlotSkipped; SipSkippedSlotAdvanced; SipInstallmentTriggered; SipInstallmentPending; SipInstallmentOutcomeUnknown; SipInstallmentRecoveryRequired; SipInstallmentRefundInProgress; SipInstallmentSucceeded; SipInstallmentFailed; SipCreateIntentRecorded |

要分清**三层身份**：PersistenceId（决定流）、EventAdapter.manifest（领域→journal 转换的元数据）、SerializerWithStringManifest 的 identifier+manifest（PB→bytes恢复入口）。当前两个 manifest 恰同文本不意味着是一个接口，也不授权改 PID 逃避历史数据。

## 6. DomainProtoSerializer 的完整 byte 链（本族关联产物，不算第40模板）

[render-adapters L6–58](../baseline/js/generators/scala-cqrs-domain/render-adapters.mjs) 在 event/snapshot 前，每 context 生成 `app/<B path>/infrastructure/serialization/DomainProtoSerializer.scala`。类 extends `akka.serialization.SerializerWithStringManifest`，imports 同名类型及 `scalapb.GeneratedMessage`，identifier=`741000+reference-layout.contexts.indexOf(context)`。银行实际 [facade L7–11](../baseline/actual-js/app/example/bankwealth/infrastructure/serialization/DomainProtoSerializer.scala)：

```scala
final class DomainProtoSerializer extends SerializerWithStringManifest with DomainProtoSerializerPart0 {
  override def identifier: Int = 741000
  override def manifest(value: AnyRef): String = manifestPart0(value)
  override def toBinary(value: AnyRef): Array[Byte] = {
    manifest(value)
    value.asInstanceOf[GeneratedMessage].toByteArray
  }
  override def fromBinary(bytes: Array[Byte], manifest: String): AnyRef =
    fromBinaryPart0(bytes, manifest)
}
```

注意 `toBinary` 先执行 manifest 的**白名单类型检查**再 cast/toByteArray；不能删掉前一步。`fromBinary` 先选具体 PB companion 再 parseFrom(bytes)，不是尝试按任意 class name 反射。

全部 local serialization nodes（含 VO、state、event、optional/map-entry 等）参与：

- `manifest`: 每 node 一条 `case _: B.infrastructure.proto.Node => "Node"`；末尾 IllegalArgumentException("unregistered protobuf value")。
- `fromBinary`: 同集合 `case "Node" => B.infrastructure.proto.Node.parseFrom(bytes)`；末尾 IllegalArgumentException("unknown protobuf manifest")；parse 失败原样抛出，无 decode-domain、无默认成功。
- 如果带 entry 包装后的完整 serializer.content.length≤65536 保持旧单类字节。否则每 part 至多128 nodes，且带/不带下一段的 entry 两种长度最大值≤60000；单 node 不满足直接 TypeError。
- `trait DomainProtoSerializerPartN [extends PartN+1]`，`protected def manifestPartN(value:AnyRef):String` 与 `protected def fromBinaryPartN(bytes:Array[Byte],manifest:String):AnyRef`。匹配失败转 next 方法，末段抛以上两种异常；facade extends Part0。每 part依赖 proto路径及下一 part，facade依赖 Part0；不存在 shared mutable registry。
- 银行固定实物有 Part0、Part1、[Part2](../baseline/actual-js/app/example/bankwealth/infrastructure/serialization/DomainProtoSerializerPart2.scala)。末段明确注册 SipPlanStatePB、18事件以及 SipPlanSipCreateIntentRecordedPBField1，方法完全对称。PartN 只是源拆分，不改变任何 serializer manifest。

[domain scaffold L47–49](../baseline/js/generators/scala-cqrs-domain/scaffold.mjs) 为每个 node **显式 FQN** 生成 serialization-binding；service generate L51–53 将 application.conf 的条目输出路径改为 `conf/serialization.conf`。不能建议改为 `scalapb.GeneratedMessage`、PB包通配或更宽 serializer binding。另一个 [scaffold-static/conf/serialization.conf](../baseline/js/generators/scaffold-static/conf/serialization.conf) **确实有宽绑定**，它是别的旧 scaffold 源，不是本任务目标，也不证明 inner oneof可由该 serializer编码。

额外固定 [ObjectIdOffsetSerializer](../baseline/common/src/main/scala/net/imadz/common/serialization/ObjectIdOffsetSerializer.scala) 是不同角色：extends Serializer，id=20160728，includeManifest=true；toBinary 只接 `ObjectIdOffset(hexString,_)`，`new BigInteger(hexString,16).toByteArray`；fromBinary `(bytes,Option[Class[_]])` 用 `BSONObjectID.parse(new BigInteger(bytes).toString(16))`，成功重建 offset/id.time，失败 IllegalStateException。不是 PB serializer、不能借用它的编号/类型来规避本组迁移。

## 7. substantive diff：保持旧 journal 的可读 typed DSL 过渡形态

minus 是 actual CreditBalanceAdapters 原文，plus 是**结构性目标，不是同输入全文件比较**。完整类有上文全部7条 manifest/cases；本片段展现文件、class、converter委托以及前两条的完整 RHS。余五条遵循上文已列明每项名称的一对一循环。暂时保留 PB journal type与manifest，不把“追齐Scala布局”伪装成 raw oneof schema已迁移。

```diff
--- a/app/example/bankwealth/infrastructure/serialization/CreditBalanceAdapters.scala
+++ b/app/example/bankwealth/infrastructure/persistence/CreditBalanceEventAdapter.scala
@@
-package example.bankwealth.infrastructure.serialization
+package example.bankwealth.infrastructure.persistence
 
-import akka.persistence.typed.{EventAdapter, EventSeq, SnapshotAdapter}
-import example.bankwealth.domain._
-import example.bankwealth.domain.CreditBalanceProtocol._
+import akka.persistence.typed.{EventAdapter, EventSeq}
+import example.bankwealth.domain.CreditBalanceProtocol.{AccountInitialized, CancelIncomingCreditConfirmed, CommitIncomingCreditsConfirmed, DeductFundsConfirmed, Event, RecordIncomingCreditsConfirmed, ReleaseReservedFundsConfirmed, ReserveFundsConfirmed}
+import example.bankwealth.infrastructure.persistence.converters.CreditBalanceProtoConverters
+import example.bankwealth.infrastructure.proto.{CreditBalanceAccountInitializedPB, CreditBalanceReserveFundsConfirmedPB}
+import scalapb.GeneratedMessage
 
-object CreditBalanceEventAdapter extends EventAdapter[Event, scalapb.GeneratedMessage] {
+class CreditBalanceEventAdapter extends EventAdapter[Event, GeneratedMessage]
+    with CreditBalanceProtoConverters {
@@
-  override def toJournal(event: Event): scalapb.GeneratedMessage = event match {
-    case value: AccountInitialized => DomainConverters.encodeCreditBalanceAccountInitializedPB(value)
-    case value: ReserveFundsConfirmed => DomainConverters.encodeCreditBalanceReserveFundsConfirmedPB(value)
+  override def toJournal(event: Event): GeneratedMessage = event match {
+    case value: AccountInitialized => AccountInitializedConv.toProto(value)
+    case value: ReserveFundsConfirmed => ReserveFundsConfirmedConv.toProto(value)
@@
-  override def fromJournal(event: scalapb.GeneratedMessage, manifest: String): EventSeq[Event] = (event, manifest) match {
-    case (value: example.bankwealth.infrastructure.proto.CreditBalanceAccountInitializedPB, "CreditBalanceAccountInitializedPB") => EventSeq.single(DomainConverters.decodeCreditBalanceAccountInitializedPB(value))
-    case (value: example.bankwealth.infrastructure.proto.CreditBalanceReserveFundsConfirmedPB, "CreditBalanceReserveFundsConfirmedPB") => EventSeq.single(DomainConverters.decodeCreditBalanceReserveFundsConfirmedPB(value))
+  override def fromJournal(event: GeneratedMessage, manifest: String): EventSeq[Event] = (event, manifest) match {
+    case (value: CreditBalanceAccountInitializedPB, "CreditBalanceAccountInitializedPB") =>
+      EventSeq.single(AccountInitializedConv.fromProto(value))
+    case (value: CreditBalanceReserveFundsConfirmedPB, "CreditBalanceReserveFundsConfirmedPB") =>
+      EventSeq.single(ReserveFundsConfirmedConv.fromProto(value))
@@
     case _ => throw new IllegalArgumentException("event manifest and payload mismatch")
```

完整文件其余 PB类型 imports按实际 cases 全部加入，不保留未用 SnapshotAdapter/domain wildcard。snapshot object从旧文件独立 split，详见 [snapshot 规格](snapshot-adapter.diff.md)。生成 class替换 object后 bootstrap必须显式构造（或工厂注入），**不改 `PersistenceId.ofUniqueId(persistenceId)`**。[service aggregate-bootstrap L16、L24、L29–30](../baseline/js/generators/scala-cqrs-play-service/templates/aggregate-bootstrap.mjs) 当前引用两个 singleton，需同步改接线。

## 8. legacy / family 与写集合

[adapter-dsl/emit.mjs](../baseline/js/generators/adapter-dsl/emit.mjs) 已有 Scala raw形状：两独立 class文件、ConverterTrait、manifest getName、inner oneof / Empty；不能说 JS没有近似实现。但它在顶层 readFileSync/mkdirSync/writeFileSync，是 CLI emitter，不是可直接 import 的 pure renderer；events强制排序，header硬编码 CodegenMain:225ed28b/release1.0.0；scalapbCase仅 underscore regex，与 Scala split [-_] 不同；snapshot重复import。formal没有调用它。

新 [aggregate-core-v1 factory template](../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/factory.mjs) 声明 `create[J](persistenceId:PersistenceId, initial:State, hosts:Computations, eventAdapter:EventAdapter[Protocol.Event,J], snapshotAdapter:SnapshotAdapter[State]):Behavior[Actor.Command]`，adapter由调用方注入；**这不是已生成的 event adapter 实现**。kernel-v1只有 protobuf/converter，接线不能等于 counterpart behavior完成。

未来写集合（本阶段均未动）：

- `generators/scala-cqrs-domain/render-adapters.mjs`：本组统一 split，保持 byte serializer注册行为，移 event/snapshot到独立MBT；旧 aggregator入口过渡转调新 renderer。
- `generators/scala-cqrs-domain/models/adapter.mjs`、`builders/aggregate-adapter.mjs`（均 proposed）：共用于 event/snapshot；明确 journal payload vs inner/outer envelope、manifest策略、converter refs；不以不可检查 body:String 承担正常规则。
- `generators/scala-cqrs-domain/templates/event-adapter.mjs`（proposed）；`templates/snapshot-adapter.mjs`（proposed，由snapshot子规格约束）。
- `generators/scala-cqrs-domain/templates/domain-proto-serializer.mjs`（proposed）：从 render-adapters 移动 explicit registration+byte methods，不扩大类型绑定；复杂度问题须 typed/generated分组审查，不建万能 String/Any dispatcher。
- `generators/adapter-dsl/emit.mjs`：extract/adapt 为纯内容renderer时独立 CLI I/O；不直接 import执行现入口。
- `generators/scala-cqrs-domain/produce-v2.mjs`、`generators/converter-dsl/produce.mjs` 及 service bootstrap、scaffold config 调用处由集成者协调；shared names/types/layout/writer/registry不在本组单独修改权内。

旧 `<A>Adapters.scala`、PartN serializer 按最终文件清单+回锚映射退役；serializer manifest/identifier若不变不应由文件移动重编号。未来若按聚合切 byte serializer，需保持旧 id+manifest reader，不能用 context排序/文件序号重新分配。

## 9. 验收/未决项

全部未运行。未来获批后完整文件对账包括 model依赖/import/case全集、events→proto→converters→adapters→bindings；除了 encode/decode roundtrip，还应使用真实 ScalaPB/Akka serializer byte回放，包括未知manifest、错误payload、空oneof、损坏bytes、旧包名/旧serializer id、真实old snapshot。生成前计划命令形状见 [proto文档](protobuf-schema.diff.md)，实生成有写输出/回执副作用另授权；目标仓 `sbt compile`/`sbt test`，银行 service不支持testOnly。普通方法CC≤5；FundOrder32 cases 与 serializer128 cases不能假装达标，>10须类型化拆分或逐方法批准必要封闭ADT匹配例外，不以字符串转发刷分。

1. **E-JOURNAL-TYPE**：传统 raw返回 `EventPO.Event`，人工Saga返回 outer `EventPO`，银行返回具体PB payload。究竟冻结旧PB、为oneof选专用serializer，还是版本化outer envelope？须给具体 GeneratedMessage/oneof API、明确 bindings与旧数据迁移；不建议任何 PB wildcard binding。
2. **E-MANIFEST**：银行显式AEPB且配对校验，raw getName且忽略入参；是否保留旧字符串，还是新旧双reader？领域class/package改名影响getName，不能随领域排版改变manifest。
3. **E-EMPTY**：raw Empty→EventSeq.empty丢事件，银行 mismatch抛错；新 schema empty/unknown case选择丢弃还是故障必须明确，不用空EventSeq冒充成功迁移。
4. **E-SERIALIZER-ID**：银行741000现行固定；多context的index偏移规则在重排后可能变化。需要显式稳定id表还是保留当前映射？不可换PID或自动清理journal来避错。
5. **E-CLASS-WIRING**：class vs object以及new/注入点，精确改service bootstrap与配置FQN，converter trait就绪后一起交付。
6. **E-CC**：大封闭type match可接受的逐方法例外与替代typed组织；byte whitelist不能为降CC删掉。

额外未入baseline但本次读取的生产源码：无。
