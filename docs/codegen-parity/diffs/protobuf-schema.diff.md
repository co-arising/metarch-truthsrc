# protobuf-schema — 聚合协议与共享 VO 的内容规格

- Artifact **29 / `protobuf-schema`**；状态 **`decision-required`**。这是第一阶段文档，不是实施、字节一致或行为通过声明。
- 固定依据为 [inventory](../scala-artifacts.json) 与 [baseline index](../baseline/index.json)：BC `cc335eb1e0d0fae17bf092fd61b126040196ea70`、JS `bf104e16ab82ef39d7fa416d0997907d18a815ad`。以下链接均为固定副本；未改基线、生成器、银行产物或 Git，未执行生成/编译/测试/服务。
- 合同所称 `CodegenMain.runCommon` 链路（实际方法位于 `CQRSApplicationGenerator.runCommon`，L170）的传统 MBT/布局是结构基准，不以 `template/products/*` 为金样。银行现有 codec/名义类型/字段号不是为了追求该结构即可覆盖的东西。

## 1. 调度、基数、输出

[调度器 L910–977](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala) 对 `app.aggregates` **每个**元素调用 `build` → `ProtoTemplate.generate` → `writeProto`，随后才生成 converter/event/snapshot adapter；不是仅有持久化事件才发。共享文件在聚合循环之后独立 `buildShared(ctx).foreach` 发出。`app.sagas` 的 classic v3 路径只生成 Context，不为 participant 另发 journal proto。

| 变体 | 条件/数量 | 传统 Play 输出（以 app 为源码根） | package/ScalaPB 出包 |
|---|---|---|---|
| aggregate | 每个 `app.aggregates`，A 个 | `app/protobuf/<getProtoFileName(aggregate)>.proto` | proto `B.infrastructure.proto`；Scala 引用 `B.infrastructure.proto.<eventPackage segment>` |
| shared-value-objects | `buildShared` 得到非空 messages，0 或 1 | `app/protobuf/shared_value_objects.proto` | proto 同上；Scala `B.infrastructure.proto.shared_value_objects` |

精确 writer 接收 `outputRoot/protobuf`；multiProject 分支为 `outputRoot/modules/glue/src/main/protobuf`（调度器 L197、L428–435），不能把 app 前缀当成 builder 内置。`writeProto` 忽略 package 路径，直接 `Paths.get(protoDir, model.fileName)`。`NamingConventions.getProtoFileName` 是 `toSnakeCase(getAggregateBaseName(name)) + ".proto"`；CreditBalance 常规输出是 **`credit_balance.proto`**，人工参考 imports 的 **`credits`** 是不同历史文件名，不能偷换。

proto package 与 ScalaPB 文件分包不是一回事。[PackageLayout L117–135](../baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala) 的 `eventPackage` 将 baseName 每个大写字母前加 `_` 后小写；和 filename 的 snake-case 函数对缩写名是否完全相同必须核对，不能仅以 CreditBalance 推广。

## 2. Scala Model 全字段

完整 [ProtoFileModel.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/infrastructure/proto/ProtoFileModel.scala)。构造顺序如下（未标默认值的参数均必需）。

```scala
ProtoFileModel(
  fileName: String,
  packageName: String,
  javaPackage: Option[String],
  imports: Seq[String],
  enums: Seq[ProtoEnumModel],
  messages: Seq[ProtoMessageModel],
  override val noteIds: Seq[String] = Nil)
// extends ArtifactModel
// dependencies = Set.empty[TypeRef]
// selfType = TypeRef(fileName, packageName)

ProtoEnumModel(name: String, values: Seq[(String, Int)])
ProtoMessageModel(name: String, fields: Seq[ProtoField],
  nestedEnums: Seq[ProtoEnumModel] = Nil,
  nestedMessages: Seq[ProtoMessageModel] = Nil,
  oneOfs: Seq[ProtoOneOfModel] = Nil)
sealed trait ProtoField { def name: String; def index: Int }
NormalField(name: String, fieldType: String, index: Int,
  isRepeated: Boolean = false, isOptional: Boolean = false,
  comment: Option[String] = None, noteId: Option[String] = None)
MapField(name: String, keyType: String, valueType: String, index: Int,
  noteId: Option[String] = None)
ProtoOneOfModel(name: String, fields: Seq[NormalField])
```

`NormalField`/`MapField` 继承 `ProtoField`。`MapField` **没有 comment 槽**；`ProtoMessageModel` 虽有 nested 槽，模板不渲染它们。`javaPackage` 没有构造默认值，builder 显式给 `None`。`ArtifactModel` 继承的 `fqn=selfType.packageName+"."+selfType.name`、`registerTo(registry)=registry.register(this)`、`morphisms=Nil`、`noteIds=Nil` 见 [ArtifactModel](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala)。`dependencies=Set.empty` 不表示没有 proto imports，二者是分离槽。

辅助 `SimpleStruct(fields: Seq[FieldDef], name: String)` 位于 builder L290。[TypeSystem](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala) 的全部支撑字段为 `TypeRef(name:String, packageName:String, typeParams:Seq[TypeRef]=Nil)` 与 `FieldDef(name:String,typeRef:TypeRef,defaultValue:Option[String]=None,comment:Option[String]=None,noteId:Option[String]=None,description:String="")`。这里 fields 使用类型、版本 comment 和 noteId，不消费 defaultValue/description。

## 3. Builder 完整分支与编号账

完整 [AggregateRootProtoBuilder](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/proto/AggregateRootProtoBuilder.scala) 与 [ProtoTypeMapper](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/proto/ProtoTypeMapper.scala)。

| 位置 | 输入、算法、输出/限制 |
|---|---|
| L16–37 | event/state 名经 NamingConventions；事件外壳 `BaseEventPO`，family `BaseEventPO.Event`；state `AggregateBaseStatePO`。`getProtoEventPOName` 用 getBaseName，state/file 用 getAggregateBaseName，不能擅自合并。 |
| L292–320 resolveStruct | 先找 `ValueObjectMetadata`，否则 `DomainEntityMetadata.state`；均 `filterNot(ctx.isStateFieldExcluded)`，用 **裸 resolve(fieldType)**，不是 resolveField(optional)；都找不到返回空 fields 而非抛错。 |
| L322–341 resolveEvents | 找 `EventFamilyMetadata`，保留 `family.events` 次序；field 用 `TypeResolver.resolveField(fieldType,optional,ctx)`；找不到返回 Nil。 |
| L348–393 recursive closure | List/Option/Seq/Vector 的所有 typeParams，Map 两侧递归；VO 字段继续扫描，Set 去重终止已访问。String/Int/Long/Double/Boolean/BigDecimal/Date/DateTime/UUID/Id/Currency 及 java./scala. 包排除。Set 容器不在扫描名单。 |
| L188–235 owner map | 全部 VO 组成无向连通分量（字段 VO 引用 union）；聚合按名排序，从 **state字段+event字段** 收集引用分量。恰一聚合引用 → 该聚合名；其余（含零引用）→ 空串。不是按首次碰到的聚合复制 VO。 |
| L244–285 shared | owners 空串、非各聚合 `stateRef.targetName` 的 VO，按 VO 名排序，字段保留 metadata 次序。文件 imports/enums=Nil，javaPackage=None，noteIds 默认 Nil。**实际代码没有再排除零引用 cold VO**；与注释“冷 VO 不产消息”不一致，不能照注释声称仅 ≥2 引用。 |
| L64–102 aggregate local/import | local 为 referencedTypes 自然 Set 迭代次序、owner==本聚合、非 shared 的 VO；每个字段 resolveField(optional)，编号 i+1。外部定义按 owner 引 shared 或宿主 proto，distinct.sorted。不能把 local 排序当无差别重排。 |
| L108–115 state | 按字段名去重、保留首次，然后连续编号 1…N；state message 在最后。重复字段过滤会改变后续编号，需保持输入与旧 schema 台账，不是迁移方案。 |
| L120–132 event payload | 事件名 + PO；字段原顺序 i+1；聚合名 **不等于字面 User** 且无字面 tenantId 时追加 `string tenantId = base.size+1`。无锚；converter 不自动合成此字段。 |
| L135–151 union | `BaseEventPO`，无普通 fields；一个 `oneof event`；第 i 个 payload 为 `PayloadPO lowerCamel(PayloadName) = i+1`，只首字符小写，不排序；number 属于 union，与 payload 内字段号独立。 |
| L153–163 aggregate model | `localMessages ++ eventMsgs :+ eventUnion :+ stateMsg`；package=layout.infrastructure.proto.root；noteIds=聚合 noteId.toSeq。 |

### 字段类型、presence 与注释

`toProtoField` 的分支顺序与 RHS 必须保存：

1. `Map` 且恰两参数 → `MapField(name, mapper(key), mapper(value), index, noteId)`；传入的 version comment 丢失。
2. `Option` 且恰一参数 → 内层 List/Seq/Vector 时 repeated 元素（None 与空表折叠）；否则 NormalField(isOptional=true)。
3. List/Seq/Vector → NormalField(isRepeated=true)，取 head 类型；不额外检查 arity。
4. 其它 → 普通 NormalField。

Mapper：`String|Id|UUID|Currency -> string`，`Int -> int32`，`Long|Instant -> int64`，`Double|BigDecimal -> double`，`Boolean -> bool`，Option 在 mapper 被直接调用时返回 `optional <mapped-inner>`，其它为 **FQN** `layout.infrastructure.proto.root.<name>PO`。因此 Date/DateTime、Set、深层容器/Option[Map] 等不能由“支持递归”概括为可用：例如 map value 的 optional 文本不是合法 map 类型；这些是具体未支持组合。

`fieldComment(introducedIn)` 对 null/trim 后空返回 None，其余 trim 后字符串。VO/event optional 尊重 metadata；state 的裸 resolve 可能漏 optional 标志，须结合真实 typeRef 决定，不把 Scala 基线叫行为完备。

## 4. Template 从上到下覆盖

完整 [ProtoTemplate](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/proto/ProtoTemplate.scala)。

| construct | 精确内容 |
|---|---|
| header | `syntax = "proto3";`、空行、`package ${packageName};`；没有 ScalaPB flat_package 选项。生成指纹/文件锚由 writer 包装，不是模板正文固定字符串。 |
| imports | model.imports 按输入顺序逐个 `import "<file>";`，此层不再排序。 |
| options | 总是 `option java_multiple_files = true;`；javaPackage Some 才 `option java_package = "...";`，None 留空插值行。 |
| enums | 输入顺序；`enum N {` 内每个 `(n,i)` 为两空格 `n = i;`，不合成零值、不排序。传统 builder enums=Nil。 |
| messages | 输入顺序；每个 `message N {`；先 ordinary fields，再 oneofs，最后 `}`；保留模板空行。 |
| normal field | repeated 优先于 optional：`  [repeated |optional ]type name = index;`。尾注释 `comment.toSeq ++ noteId.map("@knowledge "+annotated(id))`，以空格合并后前缀 ` // `。 |
| map field | `  map<K, V> name = index;`；可带 ` // @knowledge <annotated-id>`，无 version comment。 |
| oneof | `  oneof name {` 内四空格 `type name = index;`；不渲染该 NormalField 的 repeated/optional/comment/noteId。 |
| nested | nestedEnums、nestedMessages 未递归输出；有数据仍会丢失。 |

`annotated` 调 `CQRSApplicationGenerator.annotateKnowledge(Some(raw)).getOrElse(raw)`，不是自造 hash。模板不输出 service/rpc、reserved number/name、extend；没有 MANUAL 或 `???`，但缺失 metadata、未支持类型和失效 nested 槽不能称 behavior-ready。

## 5. JS 四层差距与具体例

### formal 银行路径（存在实现，不是 missing）

[银行 project L278](../baseline/bank/truthsrc.project.json) 选择 `scala-cqrs-play-service`；[generator.json L200–234](../baseline/js/generators/scala-cqrs-play-service/generator.json) 的 proto/converter producer 接传统 domain producer。实际发射位于 [serialization.mjs L4–61](../baseline/js/generators/scala-cqrs-domain/serialization.mjs)、[render-serialization.mjs L9–21](../baseline/js/generators/scala-cqrs-domain/render-serialization.mjs)。

- Model 以 context→nodes 组织：节点 `name,pkg,kind,sources,fields`，名义节点另 `ref,type,descriptor,codec`，state `aggregate`，event `event`。field `name,carrier,repeated`；carrier primitive `{form,type}` 或 `{form:'node',type,node}`。**name 是领域 accessor，输出字段却强制 f0…**。
- Builder 先全 context 的 type 声明，再 aggregate defaults 组 state，再 declaredSlots 组 event。名义类型按 ref 去重，跨 context 拒绝；没有跨聚合 VO 宿主/共享文件判定。optional/sequence/map 递归造 `<Root>FieldN[Entry|Key|Value|Element]`，不把 TxId/AccountId 合成 String。
- Template 每个 package 一个 `app/protobuf/<pkg dots to underscores>_domain.proto`；银行即 `app/protobuf/example_bankwealth_domain.proto`。`import scalapb/scalapb.proto` 在 package 前，`flat_package:true`；无 oneof、java_multiple_files、字段知识注释。primitive integer 是 **sint64**，decimal 是 **string**。仅 optional node 有 `bool present=1`、payload f0=2；sequence/map f0=1，没有 present。
- actual-js 保持上述形态。完整 [银行 proto 1792 行](../baseline/actual-js/app/protobuf/example_bankwealth_domain.proto)；其中 MoneyPB、MoneyWirePB、MoneyPOPB 分别是不同消息，各含 `string f0=1,string f1=2`，不可因形状相同合并。

实际 CreditBalance 的完整 root 字段号账（L1115–1173；下表 `k:T` 代表 **fk:T，number=k+1**）：

| message | 全部字段（顺序即编号） |
|---|---|
| CreditBalanceStatePB | 0:AccountIdPB, 1:bool, 2:CreditBalanceStatePBField2, 3:…Field3, 4:…Field4, 5:…Field5, 6:…Field6, 7:…Field7, 8:…Field8 |
| CreditBalanceAccountInitializedPB | 0:AccountIdPB, 1:string, 2:MoneyPB |
| CreditBalanceReserveFundsConfirmedPB | 0:TxIdPB, 1:AccountIdPB, 2:MoneyPB, 3:string, 4:MoneyPB |
| CreditBalanceDeductFundsConfirmedPB | 0:TxIdPB, 1:AccountIdPB, 2:MoneyPB |
| CreditBalanceReleaseReservedFundsConfirmedPB | 0:TxIdPB, 1:AccountIdPB, 2:MoneyPB, 3:string, 4:MoneyPB |
| CreditBalanceRecordIncomingCreditsConfirmedPB | 0:TxIdPB, 1:AccountIdPB, 2:MoneyPB |
| CreditBalanceCommitIncomingCreditsConfirmedPB | 0:TxIdPB, 1:AccountIdPB, 2:MoneyPB, 3:string, 4:MoneyPB |
| CreditBalanceCancelIncomingCreditConfirmedPB | 0:TxIdPB, 1:AccountIdPB, 2:MoneyPB |

State Field2–8 每个 `repeated <same-name>Entry f0=1`；Entry 的 f0=1 为 Field2 的 string、其余为 **TxIdPB**；f1=2 全为 MoneyPB。这不能无条件改为 `map<string,MoneyPO>`：名义 key、message key、canonical ordering/重复键拒绝规则均有差异。

### 结构性 unified diff（非同输入字节比较、不是可直接 apply 的迁移）

minus 为 actual-js 的完整相关消息；plus 是同一业务字段含义的可读命名 **提案**，保留消息名、wire type、field number、名义边界和既有 minor-units-text codec。这里 `minorUnits` 不是把金额改成 double；plus 需要正式 schema identity 决策后才可用。

```diff
--- a/app/protobuf/example_bankwealth_domain.proto
+++ b/app/protobuf/example_bankwealth_domain.proto
@@
 message MoneyPB {
-  string f0 = 1;
-  string f1 = 2;
+  string minorUnits = 1;
+  string currency = 2;
 }
 
 message MoneyWirePB {
-  string f0 = 1;
-  string f1 = 2;
+  string minorUnits = 1;
+  string currency = 2;
 }
 
 message MoneyPOPB {
-  string f0 = 1;
-  string f1 = 2;
+  string minorUnits = 1;
+  string currency = 2;
 }
```

字段改名通常不改 protobuf 二进制 tag，但会改变 descriptor/JSON 名、ScalaPB accessor/源码 ABI 与回锚路径，不能称“纯排版”。**按聚合拆文件、flat_package 改为文件包、PB→PO、payload→oneof** 是另一层 schema/serializer identity 迁移；上面 diff 不授权它。目标 MBT 首先分离领域 accessor 与冻结 wire name/number，使可读 Scala named arguments 不再由 fN 索引控制，而旧二进制描述符能显式保留。

### legacy 与新 family

- [proto-dsl/render.mjs](../baseline/js/generators/proto-dsl/render.mjs) 已有 aggregate/shared/flat 三分支、oneof、tenantId、localVOs、字段锚；但 formal producer 用 `renderProto`，**不调这个 render**。该 legacy renderer 自己按 event name 排序（L107），会改变 union 号；SHARED_VOS 是硬编码目录（L34–41），map 未知 key 默认 string（L75），contractIds 折成 string（L79），生成 header 硬编码 `CodegenMain:225ed28b`/release 1.0.0。不可原样接线。
- [domain-kernel-v1/serialization-model.mjs](../baseline/js/generators/scala-cqrs-domain-kernel-v1/serialization-model.mjs) 有显式 root binding、name collision/JVM 参数预算、node refs/sources/deps、递归/跨 context 拒绝，值得复用结构校验；L123 仍指定 fN。新 family [protobuf template](../baseline/js/generators/scala-cqrs-domain-kernel-v1/templates/protobuf.mjs) 仍单 context 文件、flat_package+single_file、没有 oneof；所有 optional/**sequence/map** 变为 present=1/f0=2，integer 改 **int64**。这与银行的 sint64、sequence/map f0=1 **真实不兼容**，不能作为“更整洁”的 drop-in。

## 6. 胶水与写集合

- Schema 消费者为 `scalapb.GeneratedMessage`/生成 companion `parseFrom`/oneof `GeneratedSealedOneof` 形状及 `com.google.protobuf` 运行库；proto options 来自 `scalapb/scalapb.proto`。Scala/JVM 类型可见性与 `.proto package` 不应混为一谈；未运行 protoc/ScalaPB。
- `net.imadz.codegen.scaffolding.cqrs.TypeResolver.resolveField`、`GeneratorContext.metaRegistry/isStateFieldExcluded`、`NamingConventions` 和 `PackageLayout` 决定 fields/位置；文件/字段来源由统一 writer 接收。共享 Scala 源码存在不证明银行依赖 JAR 已具所需接口。
- `PrimitiveConverter` 的 Money double 示例是历史 codec，不适用于银行 minor-units-text。银行配置精度38/scale2/CNY，与 MoneyWire/MoneyPO 名义类型分别保留；详见 [converter 规格](proto-converter.diff.md)。

建议未来生产写集合（**本阶段未写**）：

| JS 路径 | 动作/owner |
|---|---|
| `generators/scala-cqrs-domain/serialization.mjs` | adapt：按 ref 保持名义闭包，增加显式冻结 wire identity/ownership 数据；不可按展示名去重。 |
| `generators/scala-cqrs-domain/render-serialization.mjs` | split：proto 分支搬出，converter 分支由 converter 文档负责；禁止两份实现各自定 field number。 |
| `generators/scala-cqrs-domain/models/proto-file.mjs`（proposed） | model：对应全字段 ProtoFileModel，增加兼容身份/来源槽，不放 Scala body 字符串。 |
| `generators/scala-cqrs-domain/builders/aggregate-proto.mjs`（proposed） | builder：聚合/共享组件、imports、freeze number/name、拒绝不支持组合。 |
| `generators/scala-cqrs-domain/templates/protobuf.mjs`（proposed） | template：只做本文 construct 发射；template 不能推断/排序 event identity。 |
| `generators/proto-dsl/render.mjs` | adapt/reuse construct，不复用硬编码 shared catalog/contract id 折叠。 |
| `generators/scala-cqrs-domain-kernel-v1/serialization-model.mjs`、`templates/protobuf.mjs` | family 后续协同；冻结与 formal 的 ABI 差异，不偷偷替换。 |

`scala-cqrs-play-service/generate.mjs`、`scala-cqrs-domain/produce-v2.mjs`、`proto-dsl/produce.mjs` 的调用/producer registry 改动由集成者统一接线；names/type/layout/writer/manifest 公共文件不在本组独立写权内。域文件、共享文件、converter、serializer binding 的 source anchors 必须一起迁移；原 context proto 只在消费者与回放迁移完成后由生成 manifest 退役，不能手删共享银行输出。serializer 不以 PB 通配绑定替代逐消息注册。

## 7. 验收与必须裁决的问题

**尚未执行全部验收**。未来在隔离、获批输出根，用现有 `node bin/truthsrc.js generate-project --project <absolute-project.json> --out <approved-output> --plan` 先审计划（不假定计划零副作用）；实生成另行授权。对同等输入核完整 `.proto`/ScalaPB/converter/adapter 文件，而非只比片段。Scala 编译/行为用批准后的目标仓 `sbt compile`、`sbt test`；这里没有运行，也不臆造 serialization spec 名。

覆盖必需包含：三个银行聚合+共享闭包；所有消息/oneof/field name+number+type+presence；缺失/空 payload；exact 文本边界；引用共享 state、互相 VO 引用、冷 VO、重复 state field、underscore/acronym；同输入重复生成和 anchors；旧 journal/snapshot 字节/manifest/serializer id 回放。普通生成方法 CC≤5，>10 须拆分或逐方法认可；不以 String/Any dispatcher 降分。

1. **P-SCHEMA-IDENTITY**：银行保持 PB/flat-package 现有描述符，仅重构 MBT/可读 wrapper，还是发布明确版本的新 per-aggregate PO/oneof schema并保留旧 decoder？须交旧→新全名、字段号、serializer id/manifest、snapshot 重建/读取方案；本阶段不改 PID，不以换 PID 回避回放。
2. **P-WIRE-FIELD-NAMES**：fN→业务 wire name 是否获准改变 ScalaPB/JSON/descriptor ABI？Money 的 f0 是 minorUnits，不是 domain amount；各 nominal message 不合并。
3. **P-PRESENCE-INTEGER**：银行 sequence/map payload tag1 与新 family present1/payload2，sint64 与 int64、Scala Option[List] None≡空表的差异，选择哪个版本及转换器；不得隐式覆盖。
4. **P-EXACT-CODEC**：银行 `Money`/`AmountDecimal` 保留 precision38/scale2 minor-units-text；Scala BigDecimal→double 只能作为独立历史基准，不成为银行目标。
5. **P-SHARED-OWNERSHIP**：raw buildShared 包括 cold VO、剔除 state 本体且 imports=Nil；当 shared 引用他聚合 state 时定义/文件依赖如何保证？明确修复 vs 保持，不把注释当实现。local Set 顺序与稳定输出另定，不重新分配字段号。
6. **P-SCALA-GAPS**：state optional 丢失、nested 未渲染、Option[Map]/Set/递归容器、tenantId 合成但 converter 未映射，逐项拒绝输入或给出真实 schema/codec；不能靠填默认成功通过。

本文件使用的源码均已在 baseline 中；额外未固定生产源码：无。
