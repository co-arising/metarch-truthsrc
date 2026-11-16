# value-object：内容级差异与后续实施规格

## 1. 范围、状态、来源

- Artifact：`value-object`（传统族 1）；状态 `content-specification`。仅文档，生成器、实现、运行时均未执行。
- 传统调度：[CQRSApplicationGenerator.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala) 516–531，`domain.valueObjects.foreach`，每个 VO 一文件，`app/<base>/domain/values/<Name>.scala`。`*State` 特例经过 entityState resolver，不能把实体 State 当普通 VO 重复生成；实体归属见 [domain-entity](domain-entity.diff.md)。路径来自 resolved selfType，不是输入文件名拼接。
- 固定 MBT：[Model](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/domain/ValueObjectModel.scala)、[Builder](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/ValueObjectBuilder.scala)、[Template](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/ValueObjectTemplate.scala)。这三者才是 raw 模板基准；[人工 Money](../baseline/curated-scala/net/imadz/domain/values/Money.scala) 是完成业务参考，非同输入生成结果。
- 银行现存：[Money](../baseline/actual-js/app/example/bankwealth/domain/values/Money.scala)、[BankSipCreate](../baseline/actual-js/app/example/bankwealth/domain/values/BankSipCreate.scala)。用户味道清单中的类型合并建议不是批准项；本规格不合并 Money/AmountDecimal、Wire/PO、Receipt 或不同 nominal ID。

## 2. Model / Builder 全字段与规则

`ValueObjectModel` 构造序：`selfType: TypeRef`、`fields: Seq[FieldDef]`、`dependencies: Set[TypeRef]`、`logicMethods: Seq[String] = Nil`、`voNoteIds: Seq[String] = Nil`、`voOwnNoteId: Option[String] = None`；继承 `ArtifactModel`，`noteIds = voNoteIds`。携带者并集用于文件台账，只有 own ID 可作本 VO 的概念注释，不能复制成假自有锚。

共享 [TypeSystem.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala)：`FieldDef(name: String, typeRef: TypeRef, defaultValue: Option[String] = None, comment: Option[String] = None, noteId: Option[String] = None, description: String = "")`。`TypeRef(name, packageName, typeParams = Nil)` 递归依赖包含自身；signature 用短名、递归泛型及 Tuple 语法糖；空包/同包/scala/java.lang 不 import。`comment` 本模板未消费。

Builder 顺序与实际条件（不能仅按源码注释概括）：

1. 取 `layout.domain.values.root`；名以 `State` 结束走 `entityState`，其余 `valueObject`。
2. 保留 metadata 字段顺序，`TypeResolver.resolveField(fieldType, optional, ctx)`：optional 包一层 Option；透传原始 `defaultValue`、noteId、description，不主动制造 None 默认。
3. 递归收集全部字段类型依赖为 Set，**不在 builder 过滤同包**，以保留拓扑排序边。
4. `deriveLogicMethods` 按下列组顺序连接，最后字符串 `.distinct`：
   - 名为 resolvedAt/appliedAt/confirmedAt/recordedAt → `def isResolved/isApplied/isConfirmed/isRecorded: Boolean = Option(field).isDefined`，没有额外时间类型检查。
   - `typeRef.name == "List"` → `def has<Field.capitalize>: Boolean = Option(field).exists(_.nonEmpty)`；Option[List] 不命中。
   - 同时有 source/target → `def isSelfLoop: Boolean = source == target`；实际实现**没有**注释所说的单值类型检查。
   - 名为 description/details → `def hasDescription/hasDetails: Boolean = Option(field).exists(_.nonEmpty)`；没有 String 类型检查。
5. `meta.noteIds` 与 `meta.ownNoteId` 分别进入双槽。方法体是 Scala 字符串，raw builder 并非全结构 AST。

[TypeResolver](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala) 14–90 的基础型、泛型、Struct/框架型、nested owner 解析必须复用公共类型责任；其未知类型落 Any / `resolveMetaRef = ???` 是原基线缺陷，不能作为新 JS 容错标准。

## 3. 按输出顺序的 construct / RHS 账

| 顺序 | raw 模板的全部生成构造及 RHS | 后续明确目标 |
|---|---|---|
| 1 | `package selfType.packageName` | app 下三层布局内的 domain.values |
| 2 | dependencies → shouldImport → fqn 排序 → distinct → imports | 从类型树收集真实依赖；同包短名，跨包显式 import；重名 alias/FQN 仅用于消歧 |
| 3 | 可选单一 Scaladoc：own concept 行在前，带 noteId 的字段按声明序作 `@param ... @knowledge` | 保留来源身份，迁移 span/ledger；不新造 ID/hash |
| 4 | `final case class Name(f1: T1 = rawDefault, ...) { ... }`；无父类/泛型/辅助构造器 | 保留字段与默认值语义；长或复杂参数逐行，不把不同名义类型折叠 |
| 5 | 上述派生方法组；空组为 `// Value Object Logic Stubs` | 显式已证明的逻辑才发，不能凭名称新增银行业务约束 |
| 6 | `object Name` companion | 放在 class 之后；不可无故丢 JSON 协议 |
| 7 | 仅顶层字段 `typeRef.name == Instant` 时，`private implicit val instantFormat: play.api.libs.json.Format[java.time.Instant] = Format(Reads[Instant](js => js.validate[String].map(Instant.parse)), Writes[Instant](i => JsString(i.toString)))` | 用正常 imports 表达；嵌套 Option/List[Instant] 漏检需单独补规格，不能称已支持 |
| 8a | 字段数 ≤22、无默认：`implicit val jsonFormat: OFormat[Name] = Json.format[Name]`（raw 为完整 FQN） | 同协议、短类型引用 |
| 8b | ≤22、有任何默认：`Json.using[Json.MacroOptions with Json.DefaultValues].format[Name]` | 保留缺字段读取默认的语义，不能只发 Json.format |
| 8c | >22：`implicit val jsonFormat: OFormat[Name] = { import play.api.libs.json._; val reads = new Reads[Name] { override def reads(json: JsValue): JsResult[Name] = JsSuccess(Name(args...)) }; val writes = new OWrites[Name] { override def writes(d: Name): JsObject = Json.obj(pairs...) }; OFormat(reads, writes) }` | 保留显式读写分支；每字段/构造实参可读换行 |

8c 的每个 reads 参数按字段序：有默认为 `(json \\ "field").toOption.map(_.as[T]).getOrElse(default)`；无默认为 `(json \\ "field").as[T]`。writes **全字段** `"field" -> d.field`，raw 每三对一行。缺 key 才回落默认；存在但坏值不允许用 asOpt 吞掉；raw `.as` 抛异常再包 `JsSuccess` 不等于错误累积的 JsError。显式 null 对 Option 的行为需依实际 Play JSON 接口验证，不能把注释的“所有 null 拒收”扩大成已证事实。

[CodeGenerationDSL](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala) 20–84 对 imports 再排序、块间 `\n\n`、文件末 `\n`；空 imports 也保留空段。raw class 参数单行，类体两空格；无 annotation/self-type/var/lazy/父构造参数/curried 参数。生成头由 writer 加，不是该 Template 本体。锚文档细节见 [KnowledgeAnchorDoc](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/KnowledgeAnchorDoc.scala)。

## 4. JS 四层差距与实际对照

### 已接线 formal

[render-values.mjs](../baseline/js/generators/scala-cqrs-domain/render-values.mjs) `renderValues` 4–37，从 reference-layout 的 type 声明及 exact descriptor 直接插值，无独立 VO model。record 按 members 序、标量包 `value`；[naming.mjs](../baseline/js/generators/scala-cqrs-domain/naming.mjs) 15–21 的 `typeName` 给每个 nominal 拼完整 `.domain.values` FQN，17 行是银行 BankSipCreate 同包 FQN 的来源，不是 Scala 编译器要求。路径用原 `d.ref.id`，`symbol` 仅校验/转义、不做 PascalCase。

exact 分支依 descriptor 输出 amount BigDecimal、unit String：构造时 `checkedAmount(amount)` 后单位 Set require；isPositive、compareSameUnit、plus、minus，最后 companion.checkedAmount。checkedAmount 顺序是非 null → setScale(UNNECESSARY) → precision 上限 → unlimited MathContext BigDecimal。plus/minus 内输入双检查、结果检查、构造再检查，实际银行三层重复来自 15–22 行，不是 JSON companion。任何抽取都必须保留结果溢精度拒绝、单位一致与任意精度运算；禁止以 Double 或四舍五入替代。

[produce-v2](../baseline/js/generators/scala-cqrs-domain/produce-v2.mjs) 14、[valueobject produce](../baseline/js/generators/valueobject-dsl/produce.mjs) 1–5 调用此 renderer，而不是同目录的 legacy `render(spec)`。

### 存在但未接入此 formal 路线的近似实现

- [legacy render](../baseline/js/generators/valueobject-dsl/render.mjs) 23–190：已有 final class、JSON 三分支、derived helpers、锚；不得声称 VO MBT 能力完全缺失。内部混合解析/推导/模板；硬编码 `VO_FIELD_DEFAULTS` 与生成版本头；类型只正则收集 Id/Instant/List，未知型不构造可靠依赖。helper 顺序是 completion→collections→details→selfLoop，**不同于 BC**；String/单值额外约束也不同。>22 的无默认 Option 用 asOpt，会吞坏值，非 BC `.as[Option[T]]`。
- [legacy parse](../baseline/js/generators/valueobject-dsl/parse.mjs) 11–16 只搬 name/dataType，丢 optional/default/noteId；不能只接 renderer 就宣称 parity。
- [family buildModels](../baseline/js/generators/scala-cqrs-domain-kernel-v1/build-models.mjs) 124–230：value artifact 有 role/kind/module/ref/name/identifier/package/fqn/path/refs/sources/directDeps/deps；字段保留 ref、name/identifier/accessor、type、source/sources；record 按成员，标量 synthetic value；exact 形状/版本/precision/scale/单位与 nominal 闭包验证，参数 JVM 槽数验证；递归结构、未知/重复/未使用 override 均拒绝。nominal/optional/sequence/map 类型不能降成 String。
- [family valueTemplate/localType](../baseline/js/generators/scala-cqrs-domain-kernel-v1/templates/values.mjs) 4–62 已有递归本包短类型、复杂 record 多行和来源 append；仍没有 JSON/derived/own-ID 双槽；MODULAR_CANDIDATE 的 modules 路径不是本次 app 三层目标。可复用其模型能力，不整包机械迁移。

实际 BankSipCreate 的**同字段结构对照，仅布局改动**（没有批准 MoneyWire→Money）

```diff
 package example.bankwealth.domain.values
 
-final case class BankSipCreate(clientRequestId: String, fundCode: String, amount: example.bankwealth.domain.values.MoneyWire, effectiveSlot: Long, dueSlots: Vector[Long])
+final case class BankSipCreate(
+  clientRequestId: String,
+  fundCode: String,
+  amount: MoneyWire,
+  effectiveSlot: Long,
+  dueSlots: Vector[Long]
+)
```

此 diff 仅覆盖签名；完整目标还须按明确的输入能力生成上表 body/JSON 分支。人工 Money 用 `Currency`，`+/-/<=` 返回 Option、异币种为 None；银行 exact Money 为 String 单位且 require 异币种、precision 38/scale 2。这是**业务及 API 差异**，不自动互换。BankSipCreate 是否应在领域入口改为 Money，需要显式 wire→domain 接入绑定迁移，不是 renderer 偷换名义类型。

## 5. 胶水、写集合与文件 owner

- Scala 内建 immutable collections/Option；`java.time.Instant.parse/toString`；Play JSON `Format/Reads/Writes/OFormat/OWrites/JsValue/JsResult/JsSuccess/JsObject/Json` 及 `Json.using[MacroOptions with DefaultValues]`；`java.math.RoundingMode.UNNECESSARY`、`MathContext.UNLIMITED`。与库版本的真实消费接口验证尚未执行。
- `Id` 必须由公共 resolver 给实际 FQN，不能将所有 ID alias 到 String。raw nullable Instant/默认表达式不是完成业务设计。
- 后续写集合：`generators/scala-cqrs-domain/render-values.mjs`（替换 direct interpolation）；`generators/valueobject-dsl/produce.mjs`（适配共享 MBT）；`generators/valueobject-dsl/render.mjs`（提取可复用分支、去硬编码兼容表，保留 legacy 明确入口）；proposed `generators/scala-cqrs-domain/models/value-object.mjs`、`builders/value-object.mjs`、`templates/value-object.mjs`。family 的 buildModels/localType 复用需经公共 owner，不在本组重复创建 naming/type API。
- 文件组装 owner 是 VO template，经唯一 writer 输出；pipeline/producer registry、profile/layout、名字/依赖/import API、ledger/byte spans 由集成者接线。旧原 ID 路径经映射迁移并删除 ledger 中真正被替代的输出，不能遗留重复类或直接覆盖银行目录。

## 6. 验收要求与具体未决项

全部未来执行：同输入完整文件比较（含头、imports、空行、注释、字段及方法 RHS）；分别覆盖 0/1/22/23+ 字段、默认/坏值/null、嵌套 optional、同名跨包类型、exact 单位/精度/溢出、构造参数边界和双槽锚。稳定重复生成比字节及 ledger，逐映射核 span，不只 grep 类名。普通方法 CC≤5，>10 拆分或逐方法认可例外，不用 Any/字符串分派降分。

后续命令形状为 `node --test <经确认存在的VO测试文件>`、在隔离目标 `sbt compile` / `sbt "testOnly <实际JSON/exact suite>"`、`diff -u <expected> <actual>`；前两类会产生运行/构建文件，本阶段禁止且未运行；不猜测 generation flag 或测试名。

具体决策：① JSON 是否为所有 formal VO 强制能力，还是按明确 profile（kernel 无 Play 依赖不可暗引）；② >22 读取保留 BC 抛异常式实现还是改 JsError，须行为判例；③ nested Instant 修复范围；④ completion/details 派生规则是否采用 BC 原行为还是更严格类型门；⑤ 银行 wire 载体领域归属由业务绑定裁定，不批量合并；⑥ 部分 renderer 回锚从 doc/hash 转 source pointer 的等价桥由公共 ledger owner 确认。
