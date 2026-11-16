# proto-converter — typed conversion DSL 与既有 codec 边界

- Artifact **30 / `proto-converter`**；状态 **`decision-required`**。仅第一阶段内容规格，未实施/编译/生成/运行或证明行为通过。
- 固定 [inventory](../scala-artifacts.json)、[index](../baseline/index.json)：BC `cc335eb1e0d0fae17bf092fd61b126040196ea70`，JS `bf104e16ab82ef39d7fa416d0997907d18a815ad`。所有实现引用为 baseline，不把可变工作副本当证据。
- [CQRSApplicationGenerator L929–938](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala)：每个 `app.aggregates` 都生成一份；不因没有 VO 跳过。传统 Play 路径 `app/<B as path>/infrastructure/persistence/converters/<AggregateBase>ProtoConverters.scala`，package 同路径点分；trait 与 companion 在**同文件**。共享 proto 不对应独立 Scala 模板族；VO converter 在每个需要它的 aggregate trait 中出现，PO import 根据真实宿主解析。

## 1. Model、支撑类型全字段

完整 [AggregateConverterModel](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/infrastructure/persistence/AggregateConverterModel.scala)。构造顺序与类型如下。

```scala
case class AggregateConverterModel(
  override val selfType: TypeRef,
  parentType: TypeRef,
  valueObjects: Seq[ConverterDef],
  events: Seq[ConverterDef],
  state: Option[ConverterDef],
  override val dependencies: Set[TypeRef],
  override val noteIds: Seq[String] = Nil
) extends ArtifactModel

case class ConverterDef(
  objectName: String,
  participantType: TypeRef,
  poType: TypeRef,
  fields: Seq[FieldDef],
  repository: Option[FieldDef]
)
```

`state`/`repository` 虽为 Option **没有默认值**；builder 总给 Some(stateConverter)/None(repository)。template 不消费 repository；不存在 repository 构造器或查询副作用。

[TypeSystem](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala) 的依赖：

```scala
TypeRef(name: String, packageName: String, typeParams: Seq[TypeRef] = Nil)
FieldDef(name: String, typeRef: TypeRef,
  defaultValue: Option[String] = None, comment: Option[String] = None,
  noteId: Option[String] = None, description: String = "")
```

`TypeRef.collectAllDependencies = Set(this) ++ typeParams.flatMap(_.collectAllDependencies)`；`signature` 可渲染 Tuple/泛型，但本模板方法签名只用 `.name`。FieldDef 的 defaultValue 是**源码字符串槽**，本 converter 不读它；comment/description 也不输出，noteId 输出到具名实参前。继承 [ArtifactModel](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala) 的 fqn、registerTo、morphisms=Nil；没有再隐藏的 converter model 子类。

## 2. Builder：metadata → 完整定义/依赖

完整 [AggregateConverterBuilder](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/persistence/AggregateConverterBuilder.scala)。

| 位置 | 精确行为 |
|---|---|
| L18–58 | selfType 经 typeResolver.aggregateProtoConverter；parent 经 primitiveConverter；protoPkg=layout.infrastructure.proto.eventPackage(meta.name)。解析 state、eventFamily、可选 entity；生成 VO→event→state，合并依赖，noteIds=meta.noteId.toSeq。 |
| L76–102 | state **必须** resolve 为 ValueObjectMetadata，否则 `Critical Error: Cannot resolve State Metadata for ...`；eventFamily 也必须存在，否则同型抛错。与 proto builder 的“空结构 fallback”并不一致。 |
| L115–129 | 从所有未过滤 state fields 和 event fields 的 fieldType 递归 `collectDeepDependencies[ValueObjectMetadata]`；剔除 state 自身和名为 Id/Currency 的 VO。并非任意同结构 VO 去重。 |
| L133–161 | VO 若是某 DomainEntity.state 则 package 指向 entityObjectPath；否则从 VO.fullQualifiedName 去掉最后一个名字，前加 ctx.basePackage，空则 basePackage。 |
| L171–195 | VO 按名排序；调用 proto builder.voOwnerMap/buildShared；shared PO import 包为 `proto.root.shared_value_objects`，有本地主为 owner 的 eventPackage，否则 fallback 当前 aggregate protoPkg。领域类型包和 PO 宿主包分别求值。 |
| L200–220 | event package=entityObjectPath（entity 存在），否则 layout.domain.events.root；events 保留 eventFamily.events 次序。 |
| L225–254 | entity.state.name==stateMeta.name 时 state 放 entityObjectPath，否则 FQN 相对包；state fields 排除 ctx.isStateFieldExcluded，但不做 proto 那样的同名去重。 |
| L259–287 | 每个 converter：participantType=domainType(name,domainPkg)，poType=poType(name+PO,hostPkg)，objectName=NamingConventions.getConverterObjectName(name)，fields 保留顺序并 resolveField(fieldType,optional)，noteId 透传。 |
| L292–316 | field type 的深层依赖 + participantTypes + poTypes + parent；排除 java.lang/scala/空 package，以及名字 String/Long/Int/Double/Boolean/Unit/Any；Set 去重。不会删掉 scala.math.BigDecimal，也不会自动排除同包类型。 |

重要不一致：proto state 名以 aggregate base 推 `BaseStatePO`，converter 则以 state metadata 名推 `StateMetaNamePO`；两者不相等时需要显式一致性门，不能只相信约定。proto 追加 tenantId 不等于 converter 也追加了 tenantId。

## 3. Template construct 与完整 RHS 规则

完整 [AggregateConverterTemplate](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/persistence/AggregateConverterTemplate.scala)。这是**typed `ProtoConverter[S,P]` 组合 DSL**，不是反射/String dispatcher；同时它的 template 自身仍用字符串拼 RHS，不能称无源码文本的通用表达式 AST。

1. `package selfType.packageName`。
2. dependencies 过滤空/java.lang/scala，映射 `package.name`，sorted.distinct；`CodeGenerationDSL.imports(...).code` 再排序，逐行 import，不产生 `._`。参见 [DSL L20–21](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala)。
3. `trait <Self> extends <parentType.name> {`，无 type parameters/constructor/self-type/annotations/implicit val。
4. `valueObjects ++ events ++ state.toSeq` 每个 c 渲染如下完整模式（fields 可空，仍保留括号）：

```scala
object <c.objectName> extends ProtoConverter[<c.participantType.name>, <c.poType.name>] {
  override def toProto(d: <D>): <P> = <P>(
    // 每个有 noteId 的 field 才有 @knowledge <annotated-id> 行
    <escaped-field-name> = <to-RHS>
  )
  override def fromProto(p: <P>): <D> = <D>(
    <escaped-field-name> = <from-RHS>
  )
}
```

实参按 fields 次序，以 `,\n      ` 分隔；`scalaIdentifier` 同时转义实参名与 d/p accessor；noteId 通过 `annotateKnowledge(Some(raw)).getOrElse(raw)` 加 hash，而不是编造 anchor。raw 模板没有 `// --- Value Objects ---` / Events / State 分组注释；人工 CreditBalance 有这些分组，属于可读性目标，不假称 raw 已有。

令 `d.f`/`p.f` 已完成关键字转义，`C(T)` 为 `String→StringConv, Id→IdConv, Currency→CurrencyConv, 其它→<T.name>Conv`。下面涵盖 `resolveConversion` 的**全部**分支、优先级与 RHS：

| t.name/条件 | toProto RHS | fromProto RHS |
|---|---|---|
| String/Long/Int/Double/Boolean | `d.f` | `p.f` |
| BigDecimal | `d.f.doubleValue` | `BigDecimal(p.f)` |
| Id | `IdConv.toProto(d.f)` | `IdConv.fromProto(p.f)` |
| Currency | `CurrencyConv.toProto(d.f)` | `CurrencyConv.fromProto(p.f)` |
| Instant | `InstantConv.toProto(d.f)` | `InstantConv.fromProto(p.f)` |
| Option[Boolean] | `d.f` | `p.f` |
| Option[List[E]] / Option[Seq[E]] | `d.f.getOrElse(Nil).map(C(E).toProto)` | `Some(p.f.map(C(E).fromProto).toList)` |
| 其它 Option[T] | `d.f.map(C(T).toProto)` | `p.f.map(C(T).fromProto)` |
| List[T]/Seq[T]/Set[T] | `d.f.map(C(T).toProto)` | `p.f.map(C(T).fromProto).toList` |
| Vector[T] | `d.f.map(C(T).toProto)` | `p.f.map(C(T).fromProto).toVector` |
| Map[K,V] | `toProtoMap(d.f, C(K), C(V))` | `fromProtoMap(p.f, C(K), C(V))` |
| 其它（required VO） | `Some(C(T).toProto(d.f))` | `C(T).fromProto(p.f.getOrElse(throw new IllegalArgumentException(s"Missing required field: f")))` |

该递归是 **VO converter 方法相互调用** + 容器把元素交给 converter，不是任意类型树都能自动生成正确 codec。`Option[Int]`/`List[Long]` 会引用 IntConv/LongConv，而 PrimitiveConverter 没有；`Set[T]` 解码成 List；`Option[Vector[T]]` 走 VectorConv 而模板只定义 ListConv；`UUID` 在 proto mapper 为 string，converter 没有 UUID 专门分支；嵌套 Map/List 也未自动造 converter 实例。这些是待判定输入/类型能力，不得隐瞒。

5. 所有实体 converter 后无条件发两个 helper，完整签名/RHS：

```scala
object ListConv {
  def toProto[D, P](domain: List[D])(implicit c: ProtoConverter[D, P]): Seq[P] = domain.map(c.toProto)
  def fromProto[D, P](proto: Seq[P])(implicit c: ProtoConverter[D, P]): List[D] = proto.map(c.fromProto).toList
}
object InstantConv {
  def toProto(domain: java.time.Instant): Long = Option(domain).fold(0L)(_.toEpochMilli)
  def fromProto(proto: Long): java.time.Instant = java.time.Instant.ofEpochMilli(proto)
}
```

注意 helper `ListConv` 的隐式参数并不会把各 `object XConv` 自动注册为 implicit。Instant null→0→epoch 不对称，不能为了 prettiness 改掉后叫兼容。

6. 关闭 trait，输出 self-companion 的 S2-82-B3 注释与 `object Self extends Self`，为 projection 等静态 `Self.XConv.fromProto` 提供 term。没有额外字段、type alias、辅助构造器、lazy/implicit 成员，也不写 repository。

## 4. PrimitiveConverter 实际胶水（不是只列符号）

[common-core 固定 PrimitiveConverter](../baseline/common/src/main/scala/net/imadz/common/serialization/PrimitiveConverter.scala)：import `net.imadz.common.CommonTypes.Id`、`java.util.{Currency,UUID}`；trait 内嵌：

```scala
trait ProtoConverter[S, P] {
  def toProto(domain: S): P
  def fromProto(proto: P): S
  def toProtoOption(domain: Option[S]): Option[P] = domain.map(toProto)
  def fromProtoOption(proto: Option[P]): Option[S] = proto.map(fromProto)
  def toProtoList(domain: Seq[S]): Seq[P] = domain.map(toProto)
  def fromProtoList(proto: Seq[P]): List[S] = proto.map(fromProto).toList
}
def toProtoMap[K1,V1,K2,V2](domain: Map[K1,V1], keyConv: ProtoConverter[K1,K2], valConv: ProtoConverter[V1,V2]): Map[K2,V2] =
  domain.map { case (k,v) => keyConv.toProto(k) -> valConv.toProto(v) }
def fromProtoMap[K1,V1,K2,V2](proto: Map[K1,V1], keyConv: ProtoConverter[K2,K1], valConv: ProtoConverter[V2,V1]): Map[K2,V2] =
  proto.map { case (k,v) => keyConv.fromProto(k) -> valConv.fromProto(v) }
```

`IdConv extends ProtoConverter[Id,String]`: encode `id.toString`，decode `UUID.fromString(s)`；`CurrencyConv[Currency,String]`: `c.getCurrencyCode`/`Currency.getInstance(s)`；`StringConv[String,String]` 双向 identity。Map helper 不排序、不保留重复 wire keys，也没有先检测两个 domain key 转成同一 wire key；不能替代银行 typed map 的确定性和拒绝重复约定。

TypeResolver 的 parent 位置实际由 `ctx.frameworkPackage + ".common.serialization"`（[L1073–1076](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala)）决定，通常 net.imadz；库源码可见 **不等于消费 JAR 已有接口**。future target 必须固定 common artifact 或明确唯一 scaffold owner，不能同时复制同 FQN 和引入冲突 JAR。银行 `AccountId`/`TxId` 为独立 nominal text 类型，不得用 CommonTypes.Id(UUID) 替换。

## 5. 人工 Scala 参考与 raw 的边界

[CreditBalanceProtoConverters](../baseline/curated-scala/net/imadz/infrastructure/persistence/converters/CreditBalanceProtoConverters.scala) 为已补写的领域示例：

- package `net.imadz.infrastructure.persistence.converters`；imports PrimitiveConverter、`CreditBalanceEntity._`、Money、`proto.credits._`，含“包名按实际调整”的注释。不是 raw 的排序逐类型 imports/常规 credit_balance 文件包。
- VO MoneyConv：`amount=m.amount.doubleValue,currency=CurrencyConv.toProto(m.currency)`；反向 `Money(BigDecimal(p.amount),CurrencyConv.fromProto(p.currency))`。这是历史 double 语义，**不是银行精确 Money codec**。
- BalanceChangedConv 完整 fields：`update=Some(MoneyConv.toProto(e.update)), timestamp=e.timestamp`；反向 required update (`"Missing update"`) + timestamp identity。
- FundsReserved/FundsDeducted/ReservationReleased/IncomingCreditsRecorded 四对方法：`transferId=IdConv.toProto(e.transferId), amount=Some(MoneyConv.toProto(e.amount))`；反向 IdConv + required amount (`"Missing amount"`)。
- IncomingCreditsCommited/IncomingCreditsCanceled 两对：只 transferId 双向 IdConv，**Commited 原拼写保留**。
- CreditBalanceStateConv 四个 fields 按顺序：`userId` 双向 IdConv；accountBalance 双向 Map(StringConv,MoneyConv)；reservedAmount、incomingCredits 双向 Map(IdConv,MoneyConv)。没有 raw 的 ListConv/InstantConv/self-companion。

[LotProtoConverters](../baseline/curated-scala/net/imadz/FabSplitMergeDesign/infrastructure/persistence/converters/LotProtoConverters.scala) 提供 Vector 分支和 map 双侧 StringConv 的实物：wafers encode `.map(StringConv.toProto)`，decode `.map(StringConv.fromProto).toVector`；LotState 的 id/phase identity，carried/reservedRemovals/reservedAdditions/committed/compensated/sagaResults 均双向 `toProtoMap/fromProtoMap(...,StringConv,StringConv)`；`result_*` 原类型名不擅改。其 helper/companion 存在。上述具体验证范围不能推广成所有 Scala raw 分支行为通过。

[人工 SagaExecutorConverter](../baseline/curated-scala/net/imadz/infra/saga/serialization/SagaExecutorConverter.scala) 是**额外 runtime 参考而非 artifact30 输出**：`def system: ExtendedActorSystem`、`protected lazy val serialization=SerializationExtension(system)`；StepDescriptor 的 phase 显式匹配、unknown decode 默认 Prepare、stepGroup 0→1、duration millis、circuitBreaker map；OperationSucceeded/ManualFixCompleted 先 findSerializerFor→toBinary→manifestFor→ByteString，反向有空 result 分支及动态类选择。说明人工业务/运行时算法不等于 MBT 已推导，更不授权把它的 Any/runtime serializer 路径搬进银行 nominal converter。

这四个 serialization raw 模板自身没有 `???`；AdapterModel 的保留 body 字符串槽见 adapter 文档但当前 builder 不填。不能以“无 ???”推断 upstream domain decision/fold 已完成，或用 fake defaults 掩盖不支持类型。

## 6. JS 当前 formal 与可复用近似实现

### formal Model/Builder/Template/产物

银行 [project](../baseline/bank/truthsrc.project.json)→[play-service generate L16–23](../baseline/js/generators/scala-cqrs-play-service/generate.mjs) 继承 effect/application producer；domain 的 [produce-v2 L16](../baseline/js/generators/scala-cqrs-domain/produce-v2.mjs) 一次发 `renderConverters` **和 renderAdapters**。[render-serialization L23–95](../baseline/js/generators/scala-cqrs-domain/render-serialization.mjs) 不是 MBT 三文件：取 [serializationModel](../baseline/js/generators/scala-cqrs-domain/serialization.mjs) 的 nodes，在同一函数推类型、递归转换表达式、输出和分文件。

所有 formal 节点产生 public `def encode<Node>(value:<domain-or-container-type>): <pkg>.infrastructure.proto.<Node>` 与反向 decode。domain nominal/state/event 的真实全名通过 domainType，structural type 通过 carrierType/actualType；每个签名是 typed，不应把它误报成 Any converter。问题是 **全 context 扁平方法+FQN+fN+按字符数拆 PartN**，不是完全无类型。

完整 RHS 模式如下（E 为 encode helper、D 为 decode helper）：

| node/carrier | 现行 RHS |
|---|---|
| primitive | E identity；decimal E=`v.bigDecimal.toPlainString`，D=`BigDecimal(v)`；node E=`encodeName(v)`，D=`decodeName(v)`。 |
| PB field | node 包 `Some(E(v))`，primitive 不包；required node 先 `.getOrElse(throw new IllegalArgumentException("required typed value missing"))` 再 D。 |
| exact | amount 为 `.setScale(scale,UNNECESSARY).unscaledValue.toString`（minor）或 fixed 文本；PB 构造按 amount[,unit]；D 构造 nominal `readExact(value.f0,scale,minor)[,value.f1]`；还发 NameTo/FromWire、NameTo/FromPO，经 PB codec 中转，四个名义表示不合并。 |
| optional | E `value match {None=>PB(present=false);Some(item)=>PB(present=true,f0=field(item))}`；D `if(!value.present){require(empty,"absent optional contains a value");None}else Some(required(f0))`；empty 为 node/string/decimal `.isEmpty`，bool `!f0`，数值 `==0L`。 |
| sequence | E `PB(value.map(item=>E(item)))`；D `value.f0.map(item=>D(item)).toVector`；没有 present 校验。 |
| map | E `val rows=value.toVector.map(item=>E(entry)).sortBy(item=>item.toByteArray.iterator.map(b=>f"${b & 0xff}%02x").mkString); PB(rows)`；D decode 全 rows→Vector，require key distinct.size==rows.size (`"duplicate typed map key"`)，再 `.toMap`。排序为**完整 encoded entry bytes**，不是按原 key 或 key-only bytes。 |
| map-entry | 按 value._1/value._2 encode，decode 构造 `(required(f0),required(f1))`。 |
| record/state/event | PB **位置实参**为各 domain `value.<field.name>` 经过 field helper；D 依序取 `value.fN` 经过 required，位置构造对应 domain。没有 defaults fallback。 |

完整 `readExact`（[actual Part0 L5–11](../baseline/actual-js/app/example/bankwealth/infrastructure/serialization/DomainConvertersPart0.scala)）：

```scala
private def fixed(value: BigDecimal, scale: Int): String =
  value.bigDecimal.setScale(scale, java.math.RoundingMode.UNNECESSARY).toPlainString
private def readExact(value: String, scale: Int, minor: Boolean): BigDecimal = {
  require(value != null && value.length <= 80, "bounded exact text required")
  val pattern = if (minor || scale == 0) "-?(0|[1-9][0-9]*)" else "-?(0|[1-9][0-9]*)\\.[0-9]{" + scale + "}"
  require(value.matches(pattern) && !(value.startsWith("-") && BigDecimal(value) == 0), "noncanonical exact text")
  if (minor) BigDecimal(new java.math.BigDecimal(new java.math.BigInteger(value), scale)) else BigDecimal(value)
}
```

这里 pattern 长度上限80、规范文本/负零拒绝与 UNNECESSARY 不可“简化”。precision38/scale2/CNY 为银行声明/VO 约束，与该 helper 自身检查要分开归因。

文件分裂：[render L82–94](../baseline/js/generators/scala-cqrs-domain/render-serialization.mjs)：text≤60000 保单文件；超出按每个 node 的 method group 顺序，累积 >48000 切 part；facade `object DomainConverters extends Part0 with Part1 ...`；每个 part `trait DomainConvertersPartN { self: DomainConverters.type =>`，复制 private fixed/readExact。一个超长 group 本身没有再细分。这是字符数，不是已证明 JVM bytecode/CC 预算。

实际 [facade](../baseline/actual-js/app/example/bankwealth/infrastructure/serialization/DomainConverters.scala) 混入 Part0–4；Part0 L38–47 明确有 MoneyToWire/MoneyFromWire/MoneyToPO/MoneyFromPO 和三组 encode/decodeMoney…，PB f0 是 minor units string。其它四个 part 不应仅按行数退役：有跨 part 相互调用和公共 ABI/调用方。

### 内容 diff：typed 组织可先不改 wire schema

minus 精确来自 [Part2 L118–121](../baseline/actual-js/app/example/bankwealth/infrastructure/serialization/DomainConvertersPart2.scala) 的 AccountInitialized 两行；plus 是**结构性对照，不是同输入完整文件比较**。提案在 per-aggregate trait 中定义 typed object，PB 仍旧名字/fields，codec/error 文本仍旧值，显示可读性改善不依赖 schema 偷改。`AccountIdConv`/`MoneyConv` 是同一目标 trait 或明确共享 trait 提供的依赖：前者保留 nominal text，后者必须按上面的 exact 算法，绝不是 PrimitiveConverter.IdConv 或历史 double MoneyConv。

```diff
--- a/app/example/bankwealth/infrastructure/serialization/DomainConvertersPart2.scala
+++ b/app/example/bankwealth/infrastructure/persistence/converters/CreditBalanceProtoConverters.scala
@@
-  def encodeCreditBalanceAccountInitializedPB(value: example.bankwealth.domain.CreditBalanceProtocol.AccountInitialized): example.bankwealth.infrastructure.proto.CreditBalanceAccountInitializedPB = example.bankwealth.infrastructure.proto.CreditBalanceAccountInitializedPB(Some(encodeAccountIdPB(value.resource)), value.currency, Some(encodeMoneyPB(value.amount)))
-  def decodeCreditBalanceAccountInitializedPB(value: example.bankwealth.infrastructure.proto.CreditBalanceAccountInitializedPB): example.bankwealth.domain.CreditBalanceProtocol.AccountInitialized = example.bankwealth.domain.CreditBalanceProtocol.AccountInitialized(decodeAccountIdPB(value.f0.getOrElse(throw new IllegalArgumentException("required typed value missing"))), value.f1, decodeMoneyPB(value.f2.getOrElse(throw new IllegalArgumentException("required typed value missing"))))
+  // --- Events ---
+  object AccountInitializedConv extends ProtoConverter[AccountInitialized, CreditBalanceAccountInitializedPB] {
+    override def toProto(d: AccountInitialized): CreditBalanceAccountInitializedPB =
+      CreditBalanceAccountInitializedPB(
+        f0 = Some(AccountIdConv.toProto(d.resource)),
+        f1 = d.currency,
+        f2 = Some(MoneyConv.toProto(d.amount))
+      )
+
+    override def fromProto(p: CreditBalanceAccountInitializedPB): AccountInitialized =
+      AccountInitialized(
+        resource = AccountIdConv.fromProto(p.f0.getOrElse(throw new IllegalArgumentException("required typed value missing"))),
+        currency = p.f1,
+        amount = MoneyConv.fromProto(p.f2.getOrElse(throw new IllegalArgumentException("required typed value missing")))
+      )
+  }
```

plus 的完整外部结构契约：package `example.bankwealth.infrastructure.persistence.converters`；imports `example.bankwealth.domain.CreditBalanceProtocol.AccountInitialized`、`example.bankwealth.domain.values.{AccountId,Money}`（若 helper 在本文件）、`example.bankwealth.infrastructure.proto.{AccountIdPB,CreditBalanceAccountInitializedPB,MoneyPB}` 及选定的 `net.imadz.common.serialization.PrimitiveConverter`，按实际用到的 TypeRef 去重排序；`trait CreditBalanceProtoConverters extends PrimitiveConverter`；末尾 `object CreditBalanceProtoConverters extends CreditBalanceProtoConverters`。业务 domain 分离布局若迁移，imports 跟 domain 组映射变更，不能凭本文更换 domain FQN。

要把 f0/f1/f2 进一步改名 resource/currency/amount，应先裁决 [P-WIRE-FIELD-NAMES](protobuf-schema.diff.md)，再同步 PB 访问器；不能以“typed DSL”名义改字段号/包名/codec。现有 `DomainConverters.encode…` 可作为**有期限的同签名委托兼容 facade**，不能保留两套实际算法。

### legacy/family 已有实现，不是从零

- [converter-dsl/render.mjs L246–299](../baseline/js/generators/converter-dsl/render.mjs) 已具 trait+object+helper+companion 与字段锚，formal 未调用。L65 shared catalog 硬编码；L197 event 排序；L170 直接更改输入 stateEntry.fields；L189 nature 仅 credential 硬编码；VO optional 仍 Some(Conv.toProto(d.f)) 而非 Option.map；BigDecimal 裸值分支 identity 不能承诺 double 转换；map convOf 未知类型 fallback StringConv；VO refsOf 主要 List/Array 的 innerType，不覆盖 Map 递归。不能原样接线后宣称 parity。
- [kernel-v1 converter-abi](../baseline/js/generators/scala-cqrs-domain-kernel-v1/converter-abi.mjs) 解析 root methodName/typeName、event 同名 import alias，产出 ref/role/nodeId/domainType/protobufType/encode/decode registrations。可复用**显式 ABI 账**而非字符串猜名字。
- [kernel-v1 converters template](../baseline/js/generators/scala-cqrs-domain-kernel-v1/templates/converters.mjs) L10–39：object DomainConverters、event aliases→state imports→domain.values._→pb 包别名；`required[A]` 显式路径。pair 发 typed encode/decode；L40–67 optional/sequence/map-entry，L68–100 key-byte comparator 与 typed-map 重复/歧义拒绝，L102–111 调 ExactValueCodecs，L112–124 record named args，L125–139 structural helpers 子节点先发且去重。它仍不是 AggregateConverter trait family；sequence/map **强制 present**、map 改 key-only byte 排序、exact helper另包、ABI去PB后缀等不能静默替代银行。更细完整 RHS 见下段。

新 family helper 的关键 RHS：optional Some→PB(present=true,f0=encoded)，None→PB(present=false)，decode present true→Some(required+decode)，false先拒绝非空 payload；sequence encode PB(present=true,f0=mapped)，decode require(present) 后 `.toVector`；map-entry 为 f0/key、f1/value，decode tuple；string-key map 按 `_._1` 排序，非 string key 将 encoded entry 的 f1 清为 None/""/false/0L 后 `.toByteArray`，按 unsigned bytes 字典序并拒绝相同 encoded key bytes；decode require present→decode entries→distinct decoded keys→toMap。exact 通过 `ExactValueCodecs.<codec>.toWire/fromWire`，record 用 `value.<accessor>`→PB fN、decode named domain args（非 record nominal 用 positional）。这些是具体语义差别，不是排版差别。

## 7. 写集合/装配责任

未来改动仅规格，未写生产文件：

- `generators/scala-cqrs-domain/render-serialization.mjs`：split/remove converter 分支，避免继续按字数拼 PartN。
- `generators/scala-cqrs-domain/models/aggregate-converter.mjs`（proposed）：完整 Model + 按冻结 wireField/domainAccessor 的字段转换计划、所需 typed helper；不要塞 body:String 当结构模型。
- `generators/scala-cqrs-domain/builders/aggregate-converter.mjs`（proposed）：VO 闭包/宿主与 proto builder共用；记录具体 codec identity、scope、imports、unsupported input，不隐式归 String。
- `generators/scala-cqrs-domain/templates/aggregate-converter.mjs`（proposed）：本文完整 DSL/RHS pattern；分组注释、正常 imports、PascalCase converter type/lowerCamel method。
- `generators/converter-dsl/render.mjs`：adapt 可复用的 construct，不复用 golden 硬编码与 fallback。
- `generators/scala-cqrs-domain-kernel-v1/converter-abi.mjs`、`templates/converters.mjs`：family 协同 adapt/reuse，但与 formal semantic/version gate 分开。
- `generators/scala-cqrs-domain/produce-v2.mjs` 和 `generators/converter-dsl/produce.mjs` 的接线由集成 owner 合并；公共 names/types/layout/writer/registry 不独立改。serializer assembly 由本组 event-adapter 主文档统一拥有，snapshot 不重复写。

旧 `DomainConvertersPart0..N.scala` 经 manifest 退役而非手删银行输出；全部 codec entry callers（event/snapshot/projection/host/execution）与代码回锚有一对一迁移账，ABI facade/目标 trait/proto schema同批裁决。PO/VO 同名时必须 alias imports，禁止合并 MoneyPO 与 PB MoneyPOPB 或 MoneyWire。

## 8. 验收和具体未决项

未执行。未来授权后，同等输入比较完整 converter 文件（VO/event/state/helper/companion/import/anchor），编译真实 common artifact 与 ScalaPB，验证 encode→decode 及 **旧 bytes→new decode** 两方向；注意 codec canonical bytes、typed map 顺序/重复、Option None/Some(empty)、required message、precision/scale/负零/长文本/不支持 Currency/Id、Instant epoch/null 的原行为。普通 method CC≤5，>10 拆成 typed helper 或逐方法认可，不能 Any/String dispatcher 刷分。

命令形状：`node bin/truthsrc.js generate-project --project <absolute-project> --out <approved-output> --plan` 只作后续计划入口；实生成另批准，再目标仓 `sbt compile`、`sbt test`。银行 service 生成器 [generate L44](../baseline/js/generators/scala-cqrs-play-service/generate.mjs) 明确禁用 `testOnly`，因此不虚构可用单 suite 命令。不运行这些命令也不把代码阅读叫验证。

1. **C-CODEC-IDENTITY**：raw Money double 与银行 Money/AmountDecimal minor-units-text 是不兼容 codec，银行应保留现有 exact contract；是否另开新 schema 只能用户明确决定。
2. **C-DSL-ABI**：采用每聚合 trait+companion 后，哪些公共 encode/decode/ToWire/ToPO 名字保留委托 facade、何时删除？按实际调用方账决定，不能只删 PartN。
3. **C-SHARED-CONVERTER**：跨聚合 VO 是各 trait重复 typed object（Scala 基线）还是独立 shared trait mixin？后一选择需确定 owner、包名、diamond/name conflict/anchor身份，不能和 shared proto 混作同一件事。
4. **C-CONTAINER-SEMANTICS**：保留银行完整 entry-byte 排序/duplicate拒绝，还是版本升级到 key-only/order规则？Option/sequence/map presence 与 Set/Vector/primitive converter缺口逐类型裁决，不能套原始 Scala unsupported 分支。
5. **C-STATE-TENANT**：state metadata 名与 aggregate BaseStatePO 是否强制相同；proto 合成 tenantId 的合法 source/default/读回路径是什么？不制造租户假值。
6. **C-GLUE**：消费 PrimitiveConverter 的具体坐标/版本/唯一源码 owner；在未证实接口前本文 plus 不是可编译交付。
7. **C-ERROR-CONTRACT**：错误文本可先保持；如增加 path-rich required errors、unknown type 分类、Instant null拒绝，各自是明确行为变更，不随命名重构夹带。

额外未入固定基线但本次读取的生产源码：无。
