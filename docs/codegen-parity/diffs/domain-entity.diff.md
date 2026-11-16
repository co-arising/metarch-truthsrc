# domain-entity：State / Events 的真实领域归属

## 1. 范围、状态、输出

Artifact `domain-entity`（族 2），状态 `content-specification`；实现与运行时未执行。[调度](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala) 532–542 对 `domain.entities` 每项输出一文件 `app/<base>/domain/entities/<Name>Entity.scala`。文件含实体容器、State、empty、事件族与事件、handler 类型别名；不是平铺 domain Protocol 的别名壳。

固定来源：[Model](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/domain/DomainEntityModel.scala)、[Builder](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/DomainEntityBuilder.scala)、[Template](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/DomainEntityTemplate.scala)；[人工 CreditBalance](../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala) 与银行 [Entity](../baseline/actual-js/app/example/bankwealth/domain/entities/CreditBalanceEntity.scala)、[State](../baseline/actual-js/app/example/bankwealth/domain/CreditBalanceState.scala)、[Protocol](../baseline/actual-js/app/example/bankwealth/domain/CreditBalanceProtocol.scala) 分别作完成结构参考与现存事实，不混签为同业务输入。

目标硬边界：领域事件和 State 留 entities；应用 Commands/Replies 由应用协议组装，`ActorRef[Reply]` 只属于 application actor command。纯规则参数和持久化事件不可注入 ActorRef。事件数量、字段类型、持久化身份不因布局变化而缩减。

## 2. Model 全字段、子型、注册与 Builder

构造序及默认：

- `DomainEntityModel(selfType: TypeRef, state: StateModel, eventFamily: EventFamilyModel, dependencies: Set[TypeRef], morphisms: Seq[MappingMorphism] = Nil, noteId: Option[String] = None)`，继承 ArtifactModel，`noteIds = noteId.toSeq`。
- `StateModel(name: String, fields: Seq[FieldDef], selfType: TypeRef)`。
- `EventFamilyModel(name: String, selfType: TypeRef, events: Seq[EventModel], superTypes: Seq[TypeRef] = Nil)`。
- `EventModel(name: String, selfType: TypeRef, fields: Seq[FieldDef], superTypes: Seq[TypeRef] = Nil)`。
- [FieldDef / TypeRef](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala) 全槽为 name/typeRef/defaultValue=None/comment=None/noteId=None/description=""；TypeRef 带 name/packageName/typeParams=Nil、短 signature、递归依赖。
- `registerTo` 顺序：register 本身 → family 嵌套于 self → 逐事件嵌套于 family → state 嵌套于 self。这是**模型注册关系**；raw template 实际把事件 case class 直接放 Entity，未生成 family companion。物理嵌套与 resolver/registry 不一致要显式处理，不能照抄假 FQN。

Builder 的全部推导分支：

| 阶段 | 实际规则 |
|---|---|
| self/state | `ctx.typeResolver.entity(meta.name)`；状态字段先 `filterNot(ctx.isStateFieldExcluded)`，同一列表用于模型和态射；状态名 `meta.state.name`，`entityState(name)` 给 Entity 内嵌 State FQN |
| 状态字段 | 按原序 `resolve(f.fieldType)`；透传 noteId/description，**未读取 f.optional/f.defaultValue**；仅 typeRef 名 Map/List/Seq/Set/Vector/Option 给 Map.empty/List.empty/Seq.empty/Set.empty/Vector.empty/None；标量签名无默认 |
| field morphisms | 非无号 status 的每条 writtenBy 原文成为 `MappingMorphism(WrittenBy, Derived, PathEndpoint(w), f.name, memberOwner=Some(stateName), memberNoteId=f.noteId)`；不在 Scala 解析路径；owner+member 区分同 ID 的 state/event 字段 |
| status morphisms | 存在无 noteId 的 status 且事件族非空时，对 **meta.eventFamily.events 全集**作 concept endpoint `event.<ev.name>`，member=status、owner=stateName、memberNoteId=None、landing=Container、containerFqn=self；有 ID 的 status 走正常字段态射；无事件不发 |
| 事件族 | `eventFamily(meta.eventFamily.name)`；superTypes 为 knownFrameworkTypes CborSerializable；从 `meta.events` 过滤掉名字恰等于 familyName 的伪事件，保留其他顺序 |
| 每个事件 | selfType=`TypeRef(evt.name, familyTypeRef.fqn)`，superTypes=Seq(familyTypeRef)；字段按 metadata 序，optional → Option[resolved] 且 `= None`，其余直接类型无默认；保留 noteId/description |
| 依赖 | state 字段、event 字段、event superTypes、family superTypes 的递归依赖；**实际末尾仍 filter shouldImport(pkg)**，尽管注释写“不应过滤”，不能误报已经保留全部拓扑边 |

[TypeResolverDSL](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala) 144–159：字符串 entityState 返回 `<entities>.<Entity>.<State>`，字符串 eventFamily 只给 `<entities>.<Family>`；MetaRef 路径又经 [TypeResolver](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala) 的 symbolTable 找嵌套 owner。因此后续统一类型表必须表示 **真实输出 owner**，不能将这些历史 overload 差异带入 JS。

## 3. 全部输出 construct / RHS（从上到下）

1. `package model.selfType.packageName`。
2. dependencies 过滤 shouldImport、按 fqn 排序、map fqn；未显式 distinct，泛型依赖可能渲染同名 import 多次。[DSL](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala) 对 imports 再排序。
3. 可选 Entity concept Scaladoc（noteId 继承聚合），之后空行，再 `object selfType.name {`。
4. 带号 State 字段的 `@param` 文档后 `case class StateName(f1: T1 = default, ...)`；字段名经 scalaIdentifier，类型短 signature，参数逗号空格单行；raw 不是 final，没有父类、独立 companion 或 require。
5. 有状态字段才发 `def empty(firstField: FirstType): StateName = StateName(args...)`。**首字段被假定为 ID**，不检查类型/role；其余逐字段位置参数。无字段时整个 empty 省略。
6. empty 的 RHS 完整默认表：Id → `net.imadz.common.Id.of("00000000-0000-0000-0000-000000000001")`；String → `""`；Int/Integer → `1`；Long → `1L`；Boolean → false；Double/Float → `1.0`；BigDecimal → `BigDecimal(1)`；Instant → null；Map → Map.empty；List/Seq/Set/Vector → Nil；Option → None；未知 → null。**非首字段**且名 version、数值 Int/Integer/Long 额外改为 0/0L。注意 Set/Vector 的 Nil 并不证明类型可编译；默认表本身也是基线待决例外，不作为银行默认来源。
7. `sealed trait FamilyName`，有 superTypes 时 `extends S1 with S2`，raw 通常 CborSerializable。
8. 每事件按模型原序：字段锚文档 → `case class EventName(fields...) extends Family`；optional `= None`；无 payload 仍 `EventName()`。事件 family trait 与 case classes 同为 Entity 的直接成员。
9. `type <Family去掉末尾Event，否则原名>EventHandler = (StateName, FamilyName) => StateName`。例如 Family 已叫 Events 则 raw 不去 s，不能拿聚合名猜 alias。
10. 关 object；块间空行、末尾换行按 SourceFile。除此没有 annotation、自类型、泛型边界、var/lazy/implicit、继承构造实参、辅助构造器、重载或 ActorRef。生成头是 writer 的职责。

目标保留以上内容职责，覆盖用户排版要求：State 长参数逐字段一行；empty named args；正常 imports；按 `// State`、`// Events`、`// Event Handler Extension Point` 分组（人工参考已有 State/Event 分组）。默认值不从“漂亮的零”推导，formal 用声明 defaults；若支持 raw 元数据中性值兼容，必须有单独输入适配标记。

人工参考明确差异：State 仅 userId/accountBalance/reservedAmount/incomingCredits，empty 用真实 userId 与三 Map.empty；事件族不继承 CborSerializable；BalanceChanged timestamp 默认 `System.currentTimeMillis()`（构造时副作用），有拼写 `IncomingCreditsCommited`。这些不是银行 AccountInitialized 等事件的替代，不把时钟默认灌入回放或擅自更名持久化事件。

## 4. JS 已接线链、近似实现与目标 diff

### Formal 银行链（不是 legacy）

[play-service generate](../baseline/js/generators/scala-cqrs-play-service/generate.mjs) 19–22 选 aggregate layered；[renderAggregateLayers](../baseline/js/generators/scala-cqrs-play-service/render-aggregate-layers.mjs) 29 调 `renderAggregate(..., true)`；[buildStateModels](../baseline/js/generators/scala-cqrs-domain/build-state-models.mjs) 11–49：字段由 domain-folds.defaults **数组序**选出，事件由 layout declaration 选出；递归 nominal closure 保存 literalTypes，模型含 aggregate/package/paths/layered/fields/events/sources/dependencies/exactTypes，无 state/eventFamily/registration/morphisms 的对应模型。

[aggregate-state template](../baseline/js/generators/scala-cqrs-domain/templates/aggregate-state.mjs) 4–24：
- parameters/initial 直接 join 单行；nominal 经 `typeName` 一律 FQN。
- 非 layered：独立 root State、companion.empty 直接构造。
- layered：root State 的 empty 委托 Entity；Entity 的 type+val State 又指回 root State；Event alias 指 root Protocol.Event；每个事件 type/val 双别名四行；Entity.empty 才有 positional default 实体构造。ledger deps 因互引出现 state↔entity，不是真实领域所有权。
- [renderCommand](../baseline/js/generators/scala-cqrs-domain/render-domain.mjs) 20–30 把所有 Command/Event 定义混放 root `domain/<Agg>Protocol.scala`；不是 Entity 真正持有 Events。

### Legacy/family 并非完全缺失

[aggregate-dsl/render](../baseline/js/generators/aggregate-dsl/render.mjs) 158–298 已有 Entity 内 State/Events、Cbor、empty、handler alias，可适配结构，但它：识别 credential/parent/writtenBy 深路径作额外过滤；注入 spec.identifier；事件按字母排序；State 只 List 默认，optional None；empty 的非 version 数值零值与 BC 中性 1 不同；零字段 empty=`???` 与 BC 省略不同；文档有一个号则给所有字段 @param 与 BC 仅带号字段不同。不能直接接上当已对齐。

[kernel buildModels](../baseline/js/generators/scala-cqrs-domain-kernel-v1/build-models.mjs) 231–310 验证一字段一显式默认、source/default 对应与 signatures 全覆盖、JVM 参数槽，保留 nominal/source/path/deps，值得复用；[stateTemplate](../baseline/js/generators/scala-cqrs-domain-kernel-v1/templates/state.mjs) 28–35 已多行/短名/默认值具名；`val empty = State()` 是一次构造，不等于每次 `def empty`。其 [protocolTemplate](../baseline/js/generators/scala-cqrs-domain-kernel-v1/templates/protocol.mjs) 仍混合 Commands/Events，family 尚未给本组目标 Entity 内真实声明，也未接银行 layered 路线。

**同事件结构对照，目标位置改变**；上下文 minus 来自银行 Entity，而真正 case class 当前在 root Protocol。目标为实体直接成员，不是 alias 精简技巧。

```diff
 package example.bankwealth.domain.entities
 
+import example.bankwealth.domain.values.{AccountId, Money}
+
 object CreditBalanceEntity {
-  type Event = example.bankwealth.domain.CreditBalanceProtocol.Event
-
-  object Events {
-    type AccountInitialized = example.bankwealth.domain.CreditBalanceProtocol.AccountInitialized
-    val AccountInitialized: example.bankwealth.domain.CreditBalanceProtocol.AccountInitialized.type =
-      example.bankwealth.domain.CreditBalanceProtocol.AccountInitialized
-  }
+  // Events
+  sealed trait CreditBalanceEvent
+  final case class AccountInitialized(
+    resource: AccountId,
+    currency: String,
+    amount: Money
+  ) extends CreditBalanceEvent
 }
```

省略上下文的其他事件必须逐一真实迁移（此块只演示一个成员，不代表完整目标文件）。final 为不可变事件风格覆盖项；是否保留 BC 的 Cbor marker 由序列化实际依赖裁定，未核 JAR 时不暗添绑定。已知银行 empty 的完整 RHS 保真目标如下（同默认值，不改为 Id.of 哨兵，也不引 first-field 参数）

```scala
def empty: CreditBalanceState = CreditBalanceState(
  id = AccountId(""),
  initialized = false,
  accountBalance = Map.empty,
  reservedAmount = Map.empty,
  incomingCredits = Map.empty,
  committedOutgoing = Map.empty,
  committedIncoming = Map.empty,
  compensatedOutgoing = Map.empty,
  compensatedIncoming = Map.empty
)
```

State 在同一 Entity 内声明所有九字段，Map key 的 String/TxId 及 Money 类型保持。raw `empty(id)` 和 formal `empty` 的差别来自输入默认合同，不是悄悄认为签名等价。

## 5. 胶水、写集合及迁移

- `net.imadz.common.CborSerializable` 为 marker（[固定源码](../baseline/common/src/main/scala/net/imadz/common/CborSerializable.scala)），不代表生成事件已被消费 JAR 序列化注册；`net.imadz.common.CommonTypes.Id = UUID` 与 `net.imadz.common.Id.of` 也不能替换银行 AccountId/TxId。
- domain 不需 Akka ActorRef/Effect；event handler alias 为纯 `(State, Event) => State`。应用/转换器/adapter/bootstrap/projection 依赖新 Entity 的真实 nested 名，回锚需 source memberOwner 更新；不能以扩大 serializer 全包绑定解决 FQN 迁移。
- 后续本组逻辑写集：`generators/scala-cqrs-domain/build-state-models.mjs`、`templates/aggregate-state.mjs`（替换）；proposed `models/domain-entity.mjs`、`builders/domain-entity.mjs`、`templates/domain-entity.mjs`（均在 `generators/scala-cqrs-domain/`）；`aggregate-dsl/render.mjs` 对应 entity 段适配。
- 共享拆分：`render-domain.mjs::renderCommand` 中事件定义 **move** 到 domain-entity builder/template，命令/回复由 application-protocol owner 接收；事件构造 helper/host 不在此删除。原 root State/Protocol/实体别名壳 **replace/retire**，必须全部消费者转新 FQN 后一次清理，不留反向 domain→application alias。
- 单一文件 assembly owner 为 domain-entity template；公共 names/type/import/layout/writer/registry 和 play-service renderAggregateLayers 由集成者改，避免组间写冲突。State default、event payload、锚、依赖统一模型，不再一个文件内定义另一个文件反向引用。

## 6. 验收及未决

本阶段没有生成、编译或行为测试。后续同输入逐完整文件核字段/事件/类型/默认/序、分组、imports、别名 RHS、named constructor args、回锚落点；单字段变更只能改变合理闭包。identity、version 初值、Option/集合默认、空字段/空事件、事件同名冲突、qualified imports 和 source mappings 均需判例。两次输出及 ledger 字节稳定。普通方法 CC≤5，>10 需拆分或逐方法认定，不用字符串事件 dispatcher 降分。

命令形状：`diff -u <expected-entity> <new-generated-entity>`；新隔离 Scala 目标 `sbt compile`，`node --test <实际存在的entity/layout测试文件>`；具体 suite 由实施时已有入口确认，构建/运行写盘均属后续授权。生成必须显式 target，不写 current。

未决是具体内容：① 是否统一 raw 无参数 empty/首字段 ID contract，还是保持显式两个输入变体；② TypeResolver 字符串 family 与真实 nested owner/registry 的修复设计；③ Cbor marker 与持久化 FQN 迁移的真实 serializer/manifest兼容范围；④ raw Set/Vector Nil 及 unknown null 不安全默认如何表述为禁止/兼容例外；⑤ 事件排序以 metadata/声明序为准，legacy 字母序是否保留为独立兼容模式；⑥ final 修饰与现有源码兼容需确认，不改事件身份。
