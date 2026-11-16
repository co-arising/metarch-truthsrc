# aggregate-repository-port — 聚合仓库应用端口内容规格

## 1. 范围、证据身份与结论

- artifact/group：`aggregate-repository-port`，传统清单 ordinal `12`。
- 文档状态：**decision-required**。正式银行路径确有 Repository 输出，但它是拥有本地 Actor 缓存的具体类；传统 Scala 对应物是带 `@ImplementedBy` 的 sharding 查询端口。family2 已经拆出端口，却仍是本地 Actor `get/close/Handle` 合同。不能用换目录或强制转换证明三者等价。
- 此次是源码内容检视；没有运行测试、类型检查、编译、生成、运行时或服务。没有新同输入双端产物；文中的差分为**结构性对照，非同输入字节比较**。不声明实现完成、可运行、parity-PASS 或行为通过。
- 固定 BC HEAD：`cc335eb1e0d0fae17bf092fd61b126040196ea70`；JS HEAD：`bf104e16ab82ef39d7fa416d0997907d18a815ad`。具体身份以 [baseline/index.json](../baseline/index.json) 的原路径、完整字节数和 SHA-256 为准；不是以 HEAD 覆盖工作副本差异。
- 只新建本 diff 和 `details/aggregate-repository-port.json`。既有 15 份 diff 不在写集合；不修改 baseline、生成应用、truth、catalog、ledger、anchors 或公共文档。本轮读取的比较源码均在 baseline 内，`extraSources=[]`。

### 1.1 固定完整源码与指纹

下列链接均指向可取回完整字节的冻结文件；行锚用于定位，不以片段替代全文。已全文读取本族 M/B/T，并逐项列账于第 2–4 节。

|来源|固定文件|bytes|SHA-256|
|---|---|---:|---|
|Scala Model|[AggregateRepositoryModel.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/AggregateRepositoryModel.scala#L1-L30)|1848|`5a8d2b8f0c362af0b40a396dbdf22ab49a8225178ffda050b8edbf410ee75e50`|
|Scala Builder|[AggregateRepositoryBuilder.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateRepositoryBuilder.scala#L1-L190)|6268|`4eb9eb888695fa9777c203f5144677b098b07285e102c2899f9d0ad783de5eee`|
|Scala Template|[AggregateRepositoryTemplate.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateRepositoryTemplate.scala#L1-L84)|3199|`c8b3bf0f17e7538325fb7d6bbe0166da8ed97bc8a34b7f12a463415ded60dbf6`|
|formal renderer|[aggregate-repository.mjs](../baseline/js/generators/scala-cqrs-play-service/templates/aggregate-repository.mjs#L1-L34)|1513|`2da01826f5232f9ea263f3a128de46b1fb5f0cbc67fede5500125f52c0c85c2d`|
|family2 builder|[build-models.mjs](../baseline/js/generators/scala-cqrs-aggregate-core-v1/build-models.mjs#L1-L248)|19567|`a856e3ff09828d6bf802bfe85092c329816fc891adf476a0345393d6c8cc03de`|
|family2 renderer|[repository.mjs](../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/repository.mjs#L1-L20)|3539|`4df99f3bc570cf8cccf2c16d179d3f208c68bdb75bef897b172889dce37bb422`|
|legacy standalone|[repository-dsl/emit.mjs](../baseline/js/generators/repository-dsl/emit.mjs#L1-L186)|6725|`e1a4db369a337c276764bce2a08c22f42156421fdf6f63edcc72811cd4e1a73f`|
|legacy MBT builder 容器|[models.mjs](../baseline/js/generators/_deprecated/scala-cqrs-es/builders/models.mjs#L212-L248)|21924|`26cea8e0268a0605ac5581fc954122b0b5d501c5a97276d7bd56afe5af7191f7`|
|legacy MBT template 容器|[scala.mjs](../baseline/js/generators/_deprecated/scala-cqrs-es/templates/scala.mjs#L148-L169)|9000|`dd6e64c14c3b6e95743f84d59254ca67b2b728cb8768f152b6afaf6ecfcca2f8`|
|curated Scala|[CreditBalanceRepository.scala](../baseline/curated-scala/net/imadz/application/aggregates/repository/CreditBalanceRepository.scala#L1-L14)|518|`e3cd76eab166ce2eb17128e3e5b6377198a15bfd10f16bd8e94a5c48c3a60a00`|
|actual-js CreditBalance|[CreditBalanceRepository.scala](../baseline/actual-js/app/example/bankwealth/application/aggregates/CreditBalanceRepository.scala#L1-L30)|1370|`561ca59e23b4a2e9f2dd474c3336761a6c28cc20fe87ee70812b472b851a1c42`|
|actual-js FundOrder|[FundOrderRepository.scala](../baseline/actual-js/app/example/bankwealth/application/aggregates/FundOrderRepository.scala#L1-L30)|1354|`d75f21d2b590f776397264a43d25c8330984029235c530b92ee7d56948fe96af`|
|actual-js SipPlan|[SipPlanRepository.scala](../baseline/actual-js/app/example/bankwealth/application/aggregates/SipPlanRepository.scala#L1-L30)|1346|`90efb72f869a41ae9e14e508671e1a6190b1b1543198fa22c3653d01f85ec543`|

### 1.2 调度、输出基数与路径

真实传统入口为 [CodegenMain.scala:183–242](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L183-L242) 的非 `semanticProductsFile` 分支，经 [runCommon:203–220](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L203-L220) 调用 application 层。

[application repositories 分派:682–700](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L682-L700) 遍历 `app.repositories`，**仅** `case m: AggregateRepositoryMetadata` 调用本 Builder/Template；其他 repository 不在此处输出。本族不是“每个 aggregate 无条件一份”，也不以 storage 是否配置或是否存在 query 为门槛。Builder 成功后，每条该类 metadata 计划一份 trait 文件；零声明则零份，重复目标名没有在本 Builder 内去重。

|变体|条件与状态|目标路径（`<target>` 为独占绝对目录，`<basePath>` 为业务包路径）|
|---|---|---|
|single/default|`AggregateRepositoryMetadata`；enabled，未执行|`<target>/app/<basePath>/application/aggregates/repository/<RepositoryName>.scala`|
|multi|同上且实际 multiProject 开启；enabled，未执行|`<target>/modules/kernel/src/main/scala/<basePath>/application/aggregates/repository/<RepositoryName>.scala`|
|query declarations|默认 entityRef 之后追加被接受的 QueryMethod；未以同输入执行|同一个文件，非新增文件族|
|knowledge present/absent|aggregate noteId/参数 noteId 有无控制注释；未以同输入执行|同一个文件；无号不编造号|
|其他 RepositoryMetadata|此分派 suppressed|零文件；Projection 不归本族|

[writer:331–412](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L331-L412) 的 attribution 为 `repository-iface / m.aggregate.targetName / aggregate / List(m.aggregate.targetName)`，multi 路由为 `kernel`；`selfType.packageName.replace('.', '/')` 与 `selfType.name + ".scala"` 决定路径。scope 守卫可能不写文件，领地策略可能 KEEP，不能把计划基数说成已写基数。writer 先记模型依赖、noteIds、morphisms，再判 scope，最终加 fingerprintHeader 后写；多模块 ledger 路径仍有原实现 `s"app/$relative"` 规则，不能照搬成正确的新物理布局。

raw 布局与用户三层规则在此 trait 包上相符；关联 DI 装配若产生 `$base.modules`，目标必须改归 `infrastructure.bootstrap`，但不是本端口写入职责。

## 2. Model：字段、默认值、继承与输入

### 2.1 全部结构字段

以下为完整结构签名（仅压缩缩进和历史注释；精确原字节见上表 M）。不是新增模型或新生成产物。

```scala
case class AggregateRepositoryModel(
    override val selfType: TypeRef,
    superInterface: TypeRef,
    isImplementedBy: TypeRef,
    aggregateType: TypeRef,
    methods: Seq[RepositoryMethodModel],
    override val dependencies: Set[TypeRef],
    override val noteIds: Seq[String] = Nil,
    noteId: Option[String] = None
) extends ArtifactModel

case class RepositoryMethodModel(
    name: String,
    parameters: Seq[FieldDef],
    returnType: TypeRef,
    logicIntent: String
)
```

|位置|字段/类型/默认|生产、消费及 JS 差距|
|---|---|---|
|M1|`selfType: TypeRef`，必填|repository resolver；决定文件名/package/trait/doc。formal 仅有 `names` 和路径，缺 TypeRef。|
|M2|`superInterface: TypeRef`，必填|Builder 传同一个 `selfType`；Template **不消费**，不输出 `extends selfType`。不得因字段名而新增父接口。|
|M3|`isImplementedBy: TypeRef`，必填|实现 resolver；Template 使用 `.name` 作为 `classOf[...]`，依赖集负责 import。formal 无注解。|
|M4|`aggregateType: TypeRef`，必填|用于 Javadoc 和 `Aggregate._` import；不是 trait 的基类。|
|M5|`methods: Seq[RepositoryMethodModel]`，必填|有序，合成 entityRef 永远首位，其后声明 QueryMethod 原顺序。formal/family2 固定 get/close，无此数组。|
|M6|`dependencies: Set[TypeRef]`，必填|递归方法类型、实现类型、Inject、ImplementedBy、aggregate；不同泛型 TypeRef 可投影成重复相同 FQN。不是文件路径 deps 的直接同义词。|
|M7|`noteIds: Seq[String] = Nil`|实际取被引用 aggregate 的 noteId.toSeq；writer 文件级索引。不是仓储 metadata.noteId。|
|M8|`noteId: Option[String] = None`|同一个 aggregate 来源，Template 容器概念注释。缺来源不凭仓库名制造。|
|RM1|`name: String`，无默认|entityRef 或 query.name；raw 方法名不做 scalaIdentifier 转义。|
|RM2|`parameters: Seq[FieldDef]`，无默认|保留顺序，single 非隐式参数列表；允许空列表并渲染 `()`。|
|RM3|`returnType: TypeRef`，无默认|使用完整 `.signature`，非统一 EntityRef；只有合成默认方法被固定为 EntityRef。|
|RM4|`logicIntent: String`，无默认|原 `query.logic.intent` 或固定 sharding 文案；只写 `// Logic:`，**不是实现源码/body**。|

[ArtifactModel:5–47](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L5-L47) 继承项亦保留：`fqn = selfType.packageName + "." + selfType.name`；`registerTo(registry) = registry.register(this)`，本模型没有嵌套注册 override；`morphisms: Seq[MappingMorphism] = Nil`；默认 `noteIds = Nil` 被此 case class 覆盖。生成出的 Scala trait 不继承生成器的 ArtifactModel。

[TypeSystem:4–85](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4-L85) 支撑合同：

- `TypeRef(name: String, packageName: String, typeParams: Seq[TypeRef] = Nil)`。FQN 在空 package 时为 name；signature 对 `Tuple` 后缀全数字且 typeParams 非空用 `(A, B)`，其他泛型用 `Name[A, B]`，否则 name；Tuple 判定不检查 Scala package。
- `collectAllDependencies = Set(this) ++ typeParams.flatMap(_.collectAllDependencies)`；`shouldImport` 依次排除空包、同包、精确 `scala`、精确 `java.lang`；其他保留。
- `FieldDef(name, typeRef, defaultValue: Option[String] = None, comment: Option[String] = None, noteId: Option[String] = None, description: String = "")`。本 Builder 只填 name/typeRef/noteId/description；Template 只消费这些，**不发 defaultValue/comment**，不能把通用 FieldDef 默认槽误变成方法缺省实参。
- 合成字段是 `FieldDef("id", TypeRef.String)`，即 `TypeRef("String", "", Nil)`，其他 FieldDef 槽保持默认。

### 2.2 上游 metadata 与被忽略字段

完整固定 [RepositoryMetadata / AggregateRepositoryMetadata / QueryMethod:758–813](../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L758-L813)：`AggregateRepositoryMetadata(name, aggregate: AggregateRef, methods: Seq[RepositoryMethod], storage: Option[StorageConfigMetadata] = None)`，`metaCategory = "application.aggregates.repository"`。`QueryMethod(name, parameters, returnType: DataType, logic: BusinessLogic)`；`UpsertMethod` 在该 Builder 被忽略。`storage` 也不参与端口构造，不能据 `storage=None` 推断本地 cache profile。

[ParameterMetadata:167–178](../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L167-L178) 还有 `optional=false`、`optionalWhen=""`，本 Builder **不读这两项**。optional 类型若要出现，必须在被 resolver 接受的 parameterType 中真实表达；不能自动给所有 query 参数加 Option，也不能声称已实现 optionalWhen 语义。

## 3. Builder：完整方法/分支/RHS 账

B 的完整 190 行固定于第 1 节；下表覆盖对象内全部 9 个方法和每个构造分支。Builder 源码的 imports 包括 `AggregateRepositoryModel/RepositoryMethodModel`、`FieldDef/GeneratorContext/TypeRef`、`NamingConventions`、`AggregateRepositoryMetadata/AggregateRootMetadata/QueryMethod`，这些不直接成为产物 imports。

|稳定项|位置|实际规则、RHS、异常与次序|目标约束|
|---|---|---|---|
|B1 `build`|[17–63](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateRepositoryBuilder.scala#L17-L63)|先 `pkg = ctx.layout.application.aggregates.repository`；`selfType = ctx.typeResolver.aggregateRepository(meta.name)`；再 `resolveAggregateType`，再 implementation，methods，dependencies；最后按 M1–M8 次序构造。前两个位置参数均 selfType。|JS 显式模型逐字段对应，不以整份 content 字符串代替。|
|B1 knowledge|同上 54–62|两次独立 `ctx.metaRegistry.resolveByName[AggregateRootMetadata](meta.aggregate.targetName).flatMap(_.noteId)`，第一份 `.toSeq`；没有使用 `meta.noteId`。|可复用单次已解析事实，但同输入来源不能改变；不新增作者 @knowledge。|
|B2 `resolveAggregateType`|[68–80](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateRepositoryBuilder.scala#L68-L80)|`ctx.metaRegistry.resolve[AggregateRootMetadata](meta.aggregate)`；None 抛 `IllegalStateException(s"AggregateRootMetadata '${meta.aggregate.targetName}' not found.")`；Some 返回 `(ctx.typeResolver.aggregateRoot(aggMeta.name), aggMeta.name)`。|缺引用必须失败，不以一个虚构 aggregate/泛型 ActorRef 填空。|
|B3 `resolveImplementationType`|[84–91](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateRepositoryBuilder.scala#L84-L91)|`getRepositoryImplNameFromInterfaceName(meta.name)` 先直接 `+ "Impl"`；再 `ctx.typeResolver.aggregateRepositoryImpl(implName)`。|记录两步而非随手 replace 后缀；重复技术后缀交共享 resolver。|
|B4 `buildRepositoryMethods`|[97–109](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateRepositoryBuilder.scala#L97-L109)|先 synthesize 默认方法；`meta.methods.flatMap { case q: QueryMethod => buildQueryMethod(q, ctx); case _ => None }.filter(_.name != "entityRef")`；`entityRefMethod +: declaredMethods`。声明 entityRef **先解析类型再被过滤**；非 Query 不解析。|除 entityRef 外不做同名去重/排序；需要保留该差异用例，不能让输入映射丢掉其他 overload。|
|B5 `synthesizeEntityRefMethod`|[112–126](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateRepositoryBuilder.scala#L112-L126)|`TypeRef(s"${aggName}CommandFamily", s"${aggregateType.packageName}.$aggName" + "Protocol")`；外包 `TypeRef("EntityRef", "akka.cluster.sharding.typed.scaladsl", Seq(commandFamily))`；name entityRef；参数仅 id:String；logicIntent 为下方原文。|aggName 是 registry 原名，未再剥 Aggregate 后缀。这与 aggregateRoot resolver 的归一化不一致，D2 需核协议实际类型，不得凭名猜测。|
|B6 `buildQueryMethod`|[130–142](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateRepositoryBuilder.scala#L130-L142)|始终 `Some(RepositoryMethodModel(query.name, buildMethodParameters(query,ctx), ctx.typeResolver.resolve(query.returnType), query.logic.intent))`；没有空意图 fallback，也没有读取 `logic` 的实现体。|只输出声明，不能生成假的 sharding 查询算法/成功返回。|
|B7 `buildMethodParameters`|[146–153](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateRepositoryBuilder.scala#L146-L153)|按 query.parameters 原顺序 map：`FieldDef(p.name, ctx.typeResolver.parameterType(p.parameterType), noteId=p.noteId, description=p.description)`。|名称、类型、来源、描述及顺序不丢失；没有 ActorRef 注入规则。|
|B8 `collectDependencies`|[157–177](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateRepositoryBuilder.scala#L157-L177)|先 methodDeps；baseDeps 为 `knownFrameworkTypes("Inject")` 与 `("ImplementedBy")`；`methodDeps ++ implementationType.collectAllDependencies ++ baseDeps + aggregateType`；最后 `.filter(_.shouldImport(pkg))`。`meta/selfType` 参数未被用到。|须区分未使用的 raw imports 与实际协议依赖；不漏返回泛型内部类型。|
|B9 `collectMethodDependencies`|[181–189](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateRepositoryBuilder.scala#L181-L189)|逐方法 `returnType.collectAllDependencies ++ parameters.flatMap(_.typeRef.collectAllDependencies)`，合并 `.toSet`。|import 碰撞/重复与文件级 deps 分开处理。|

B5 完整固定默认说明为：

```text
sharding 实体引用（聚合隐式契约——对齐 gen_api_layer entityRef，2026-08-28 终局原则）
```

共享解析依赖已定位到实际符号，而非名称推测：

- [PackageLayout:45–51、97–102](../baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala#L45-L51)：端口 `application.aggregates.repository`；实现 `infrastructure.repositories.aggregate`。
- [NamingConventions:57–67、180–224](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L180-L224)：`getBaseName` 按源码后缀顺序逐次去除，剥空时返回最后非空值；只做后缀处理，不自动 PascalCase；参数关键字加反引号。目标源码名才用统一 PascalCase/lowerCamelCase，稳定业务身份不改。
- [TypeResolverDSL:236–254](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L236-L254)、[463–470](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L463-L470)、[736–743](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L736-L743)：分别归一化 aggregate/repository/impl 名称并绑定对应 layout；查询 `resolve(metaType)` 和 `parameterType` 委托 [TypeResolver](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala#L19-L93)。
- TypeResolver 支持基础值、明确的 metadata refs、struct、递归 CustomType；已知框架类型优先于 CustomType 传入包，未知 CustomType 包为 `net.imadz.domain.values` 时重绑当前 domain.values。其 `case _ => TypeRef("Any", "")`、`resolveMetaRef = ???` 是真实 debt；不能复制成“任何输入都支持”。查询引用触发未实现分支时保留为阻断项 D3，不造正常返回。
- [GeneratorContext:68–89](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L68-L89) 把 Inject/ImplementedBy 解析为 `javax.inject.Inject` / `com.google.inject.ImplementedBy`。Map 索引若不含键会失败，不存在此 Builder 自行安装库的机制。

## 4. Template：按产物顺序逐构造/RHS 清单

完整源码见 [T:14–83](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateRepositoryTemplate.scala#L14-L83)。模板源码自身重复 import 了三次 NamingConventions，这是生成器源码的债；下表中的产物重复 import 则来自另一条真实规则，二者不要混淆。

|顺序/稳定项|来源|完整输出规则与 RHS/body|不应臆造的构造|
|---|---|---|---|
|T0 文件头|writer [100–113](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L100-L113)|Template 本身无头；writer 加 `// @generated by CodegenMain:${GeneratorVersion.value}\n`，有 release 才加第二行 `// @knowledge-release $knowledgeRelease\n`。|不把 JS 固定 domain:1 头伪称 BC 模板头；未运行不编造版本戳。|
|T1 package|T16；[DSL:13–15](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L13-L22)|`package ${model.selfType.packageName}`，后接空行。|无 package object。|
|T2 imports|T19–35|依赖集先按 fqn 排序并投影 fqn；排除空字符串、等于 self package 的字符串、`startsWith("java.lang")`；追加 `aggregateType.fqn + "._"`、`javax.inject._`、`com.google.inject.ImplementedBy`；DSL `imports.sorted.map("import " + _).mkString("\n")` 再全局排序。**没有 distinct、没有分组空行**。不同 TypeRef 泛型相同 FQN 可重复；ImplementedBy 通常固定重复两次。|不能说 raw 已排序去重或无 wildcard。目标去重不得丢真正被签名消费的嵌套类型。|
|T3 interface Javadoc|T61–64|两行正文 `${selfType.name}: Application Layer Repository Interface for ${aggregateType.name}` 与 `The abstraction for interacting with the Aggregate via sharding and persistence.`|不是业务逻辑实现。|
|T4 containerDoc|T57–60|`conceptLine(model.noteId).map(l => block(Seq(l))).getOrElse("")`；有号才额外注释块；`@knowledge id` 可带真实元素 hash，无 hash 原号。|不猜 hash，不制造 repository 便签；新作者格式不新增 @knowledge 字段。|
|T5 annotation|T52/65|`@ImplementedBy(classOf[${model.isImplementedBy.name}])`。注解依赖技术实现；D4 记录其与分层/模块的冲突。|无 @Singleton/@Inject 在 trait 上。|
|T6 trait|T66–70|`trait ${model.selfType.name} {`，空行，methodsCode，空行，`}`。没有泛型、extends、父构造器或 self-type。|`superInterface` 非父类；没有 companion、Handle、成员缓存、构造器。|
|T7 每方法参数锚|T38–46|按 model.methods 顺序；先 `KnowledgeAnchorDoc.fieldDoc(m.parameters, "  ")`；只对 noteId 有值的参数发 `@param escapedName [description]  @knowledge id[@hash]`，两空格缩进，空集合/无号返回空串。|不能因 description 非空而给无号参数造锚。|
|T8 每方法声明|T40–47|每参数 `${scalaIdentifier(p.name)}: ${p.typeRef.signature}`，以 `, ` 连接；`  def ${m.name}($params): ${m.returnType.signature}`。|无 default、varargs、curried/implicit 列表、上下界、method type params。m.name 原样而参数转义，raw 的不对称不能隐藏。|
|T9 每方法说明|T47–49|下一行精确 `  // Logic: ${m.logicIntent}`；方法段之间两个 `\n`。此说明为字符串槽，不作 Scala 表达式执行。|没有 `=`、`???`、MANUAL、return、Future.successful、persist、reply 或 I/O。无实现体是端口的正常抽象，不是待填空 body。|
|T10 完整拼接|T74–82|`${pkgDecl.code}\n\n${importDecl.code}\n\n$traitDefinition\n`；traitDefinition 本身以换行结尾，所以 raw 文件尾多一个换行。|不能全局压平空白来称字节对齐。|

[KnowledgeAnchorDoc:32–61](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/KnowledgeAnchorDoc.scala#L32-L61) 的 `block` 对空行集返回空串；否则 `/**`、逐行 ` * `、` */` 并尾随换行。`annotated` 调用 `CQRSApplicationGenerator.annotateKnowledge(Some(raw)).getOrElse(raw)`；因此模板依赖集中元素 hash 状态，不是完全无环境的函数。上方 Javadoc、可能第二个 concept block、annotation、trait 的顺序必须真实保留/显式裁定，不能凭解析器名称宣称新回锚已成立。

### 4.1 raw-scala、approved-target、curated 与 actual-js 分开

|面|有无可取得的实际产物字节|内容与边界|
|---|---|---|
|raw-scala|本次无同输入新生成文件；有完整冻结 M/B/T|默认 entityRef + QueryMethod 声明；重复 imports 和注解照实记录。以下静态展开是规格示例，不是运行回执。|
|approved-target|用户已批准三层、正常 imports、明确端口/实现分离；具体运行接口 D1/D2/D4 未裁定|采用本族传统 sharding 端口作为 A 对照；不能据示例授权银行从本地 actor 切 sharding。|
|curated-scala|有，518 bytes，完整文件如下|只有 `findCreditBalanceByUserId(userId: Id): EntityRef[CreditBalanceCommand]`，没有默认 entityRef；不能偷换为当前 raw 输出。|
|actual-js|有，三个文件，指纹见 1.1|都是本地 cache 具体类与 Handle；不是 trait，且 package 缺 repository 子包。|

**curated 完整源码**（保留真实方法/类型，不补默认方法）：

```scala
package net.imadz.application.aggregates.repository

import akka.cluster.sharding.typed.scaladsl.EntityRef
import com.google.inject.ImplementedBy
import net.imadz.application.aggregates.CreditBalanceProtocol.CreditBalanceCommand
import net.imadz.common.CommonTypes.Id
import net.imadz.infrastructure.repositories.aggregate.CreditBalanceRepositoryImpl

@ImplementedBy(classOf[CreditBalanceRepositoryImpl])
trait CreditBalanceRepository {

  def findCreditBalanceByUserId(userId: Id): EntityRef[CreditBalanceCommand]

}
```

**raw-scala 最小静态展开**：明确示例输入为 registry aggregate 名 `CreditBalance`、repository 名 `CreditBalanceRepository`、base `example.bankwealth`、`methods=Nil`、aggregate noteId=None、无 release。它不是读到的银行 metadata，也不是新运行产生的文件；不含 writer 动态版本头。单条抽象方法无需业务实现，故不放虚构 body。

```scala
package example.bankwealth.application.aggregates.repository

import akka.cluster.sharding.typed.scaladsl.EntityRef
import com.google.inject.ImplementedBy
import com.google.inject.ImplementedBy
import example.bankwealth.application.aggregates.CreditBalanceAggregate
import example.bankwealth.application.aggregates.CreditBalanceAggregate._
import example.bankwealth.application.aggregates.CreditBalanceProtocol.CreditBalanceCommandFamily
import example.bankwealth.infrastructure.repositories.aggregate.CreditBalanceRepositoryImpl
import javax.inject.Inject
import javax.inject._

/**
 * CreditBalanceRepository: Application Layer Repository Interface for CreditBalanceAggregate
 * The abstraction for interacting with the Aggregate via sharding and persistence.
 */
@ImplementedBy(classOf[CreditBalanceRepositoryImpl])
trait CreditBalanceRepository {

  def entityRef(id: String): EntityRef[CreditBalanceCommandFamily]
  // Logic: sharding 实体引用（聚合隐式契约——对齐 gen_api_layer entityRef，2026-08-28 终局原则）

}

```

注意该示例全局 lexicographic 顺序中 `example...` 在 `javax...` 前；不能照抄 legacy emitter 对 `net.imadz` 固定 corpus 的 import 次序当通用排序算法。

**approved-target 最小完整规格例**：只在已明确选择 sharding 合同与该 CommandFamily 时适用；去除最小例中未使用的 Aggregate、Aggregate._、Inject、javax.inject._ 并合并重复 ImplementedBy；外部框架与项目 imports 分组，保持声明/说明先后。不是 D1/D2/D4 的隐式裁决。

```scala
package example.bankwealth.application.aggregates.repository

import akka.cluster.sharding.typed.scaladsl.EntityRef
import com.google.inject.ImplementedBy

import example.bankwealth.application.aggregates.CreditBalanceProtocol.CreditBalanceCommandFamily
import example.bankwealth.infrastructure.repositories.aggregate.CreditBalanceRepositoryImpl

/**
 * CreditBalanceRepository: Application Layer Repository Interface for CreditBalanceAggregate
 * The abstraction for interacting with the Aggregate via sharding and persistence.
 */
@ImplementedBy(classOf[CreditBalanceRepositoryImpl])
trait CreditBalanceRepository {

  def entityRef(id: String): EntityRef[CreditBalanceCommandFamily]
  // Logic: sharding 实体引用（聚合隐式契约——对齐 gen_api_layer entityRef，2026-08-28 终局原则）

}
```

允许偏差只限本例已列 import 清理/分组、规范单个末尾换行、writer 版本头的独立对账。非最小 QueryMethod 场景必须按签名重新收集 dependencies，不能无条件删所有 Aggregate imports；method/param 名碰撞交共享 naming/type resolver。保留真实 noteId 来源映射，不能为美化删除锚。`@ImplementedBy` 当前保留以显露 D4；若裁定移至 bootstrap，则必须另更新该合同，不能悄悄删注解。

## 5. JS 实现：formal、legacy、family 的真实接线

### 5.1 formal 银行形态

调用证据为 [bin/truthsrc.js:184–189](../baseline/js/bin/truthsrc.js#L184-L189) → [registeredProductProducer:92–101](../baseline/js/lib/products/generate-cli.mjs#L92-L101) 的 `playService` 路径 → [scala-cqrs-play-service/generate.mjs:16–23,67–70](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L16-L23)，覆盖 `aggregate-dsl` 为 `renderAggregateLayers` → [render-aggregate-layers.mjs:10–29](../baseline/js/generators/scala-cqrs-play-service/render-aggregate-layers.mjs#L10-L29) 的 `repository` renderer。

完整 [buildAggregateModels](../baseline/js/generators/scala-cqrs-play-service/build-aggregate-models.mjs#L4-L41) 是共享复合 Builder：从 reference-layout 选 aggregate，按同 context 且 owner[0] 命令/外部 producer 归属；解析 names，`authority=external.length>0`，各 role 出自己的 artifact。仓库行恒为 `role:'repository', lookup:'owned-local-actor-cache'`，sources 仅 aggregate.source，deps 仅 protocol 路径，返回 copyImmutableData(models)。其 commands/external 分组服务其他制品，不是仓储 QueryMethod 列表。没有根据 storage 选择 sharding 的分支。

[aggregateNames:3–24](../baseline/js/generators/scala-cqrs-play-service/aggregate-names.mjs#L3-L24) 把仓库放 `application/aggregates/<ref.id>Repository.scala`，symbol 只验证/转义，不做 PascalCase 转换；`pathFor` 为 `app/<package path>/...`。renderer 只接受 lookup 上述常量，否则抛 `TypeError('unsupported aggregate repository lookup')`。

**actual-js CreditBalance 完整源码**（银行现存字节，非新生成）：

```scala
// @generated by truthsrc scala-cqrs-domain:1
package example.bankwealth.application.aggregates

import akka.actor.typed.{ActorRef, Behavior}
import CreditBalanceProtocol.Command

object CreditBalanceRepository {
  final case class Handle(persistenceId: String, ref: ActorRef[Command])
}
final class CreditBalanceRepository[K](identity: K => String, behavior: (K, String) => Behavior[Command],
    spawn: (String, Behavior[Command]) => ActorRef[Command]) extends AutoCloseable {
  import CreditBalanceRepository.Handle
  require(identity != null && behavior != null && spawn != null)
  private val handles = scala.collection.mutable.Map.empty[K, Handle]
  private val identities = scala.collection.mutable.Map.empty[String, K]
  private var closed = false
  def get(id: K): Handle = synchronized {
    require(!closed, "repository is closed")
    handles.getOrElseUpdate(id, {
      val pid = identity(id)
      require(pid != null && pid.nonEmpty, "explicit persistence identity required")
      require(!identities.contains(pid) || identities(pid) == id, "conflicting repository persistence identity")
      val ref = spawn(pid, behavior(id, pid))
      require(ref != null, "actor spawn returned no reference")
      identities.put(pid, id)
      Handle(pid, ref)
    })
  }
  def close(): Unit = synchronized { closed = true; handles.clear(); identities.clear() }
}
```

FundOrder 和 SipPlan 固定完整文件均已读取；相同模板的全部构造/RHS 相同，仅 package 内的 protocol/repository 名依各自 aggregate 改变。它们不是额外的 sharding/query 实例。

|顺序|actual-js 构造/完整语义|处理归属|
|---|---|---|
|J1|固定 generated 头；原 application.aggregates 包；ActorRef/Behavior 和简写同包 Protocol.Command imports|端口新路径、imports 由本族模型给出；头/最终字节映射由 assembly owner。|
|J2|object Repository 内 `final case class Handle(persistenceId: String, ref: ActorRef[Command])`|不能并入领域；与 cache 服务合同一起由 implementation/local-profile owner 承接，不可丢失。|
|J3|`final class Repository[K]`，三个按顺序构造参数 identity、behavior、spawn；`extends AutoCloseable`；成员 import Handle；一次合取 require 三参数非 null|是技术实例与生命周期职责；移入 infrastructure 的方案须先决定 D1，不是 raw trait 内容。|
|J4|`private val handles = mutable.Map.empty[K,Handle]`；`identities = mutable.Map.empty[String,K]`；`private var closed=false`|原实例私有、可变、有 monitor；不能移入纯领域模型。|
|J5 `get`|`synchronized` → require !closed → handles.getOrElseUpdate；已有 key 不再调用 callbacks；缺失时 identity(id) → 校验 pid 非 null/非空 → 校验 pid 无 owner 或 owner=id → **先 behavior(id,pid)，再 spawn(pid,behaviorResult)** → 校验 ref 非 null → identities.put(pid,id) → Handle(pid,ref)，随后 getOrElseUpdate 缓存结果|保留精确 callback 与可见副作用顺序；没有 key 非 null、behaviorResult 非 null、回入 guard。抛异常后的已发生 spawn 等副作用不能被假定自动回滚。|
|J6 `close`|同步块 `closed=true; handles.clear(); identities.clear()`，Unit；重复调用照样清空|未调用 actor stop/ActorSystem terminate；不得写成已实现生命周期终止。local-profile owner 不得在迁移时隐式新增或丢失停止副作用。|

### 5.2 legacy standalone：有相似 sharding 端口，不是 formal 可复用接线

[repository-dsl/emit.mjs:11–30,32–126,186](../baseline/js/generators/repository-dsl/emit.mjs#L11-L126) 是独立脚本，启动即读 `specPath`、mkdir outDir/traitDir/implDir 并最终 writeFileSync 两个 Scala 文件。`kind==='projection'` 走另一条 projection/MANUAL 分支，其他值走 aggregate；没有 strict kind 白名单。

- `pkg=spec.package || 'net.imadz.infrastructure.repositories'`；traitPkg/implPkg 缺省各为 `${pkg}.aggregate`；projectRoot 有值时目录为 `join(projectRoot,...pkg.split('.'))`，否则均为 outDir。它不自动提供符合三层的缺省包。
- aggregate 中 name/implName/cmdFamily/command 直接后缀拼接；`command` 局部未使用；aggregatePackage 缺省 `net.imadz.application.aggregates`。
- `traitStamp` truthy 选择历史 variantIface：用正则 `/66b5b602/` 决定 release 行及 aggregate 锚，有 aggNoteId 才拼锚；固定完整 import 列表含重复 ImplementedBy、Inject、wildcard；长说明、annotation、trait、默认 entityRef、Logic comment、结尾空行。该分支 **忽略 spec.methods**。
- 无 traitStamp：固定 `gen_api_layer:2026-08-26` 头；较少 imports；短中文 Javadoc；默认 entityRef 后可追加 `(spec.methods || []).map(m => def m.name(m.params): EntityRef[m.returnType])`。params 已是源码串，返回类型一律被外包 EntityRef，既无通用 TypeRef 递归也无方法参数锚。
- 同脚本还输出实现，方法体 `sharding.entityRefFor(NameAggregate.entityTypeKey, (m.idParam || 'id').toString)`；这些是实现族内容，不得在复用端口时顺便改写。projection 的 `???`/MANUAL 也非本族业务槽。

[其 manifest](../baseline/js/generators/repository-dsl/generator.json#L1) 使用 `entrypoint:'emit.mjs'`，缺少 core legacy loader 要求的 inputSchema/products/artifactKinds/output；[loadManifest:8–27](../baseline/js/src/core/manifest.mjs#L8-L27) 不提供此脚本的入口兼容。正式 products 白名单也未注册它。因此可说“独立脚本可调用，formal not-wired”，不能说 `generate-products --generator repository-dsl` 可用。

### 5.3 legacy MBT 容器：可由 legacy core 动态加载，但未接 formal

`_deprecated` 名称不是可达性证据。[src/core/generate.mjs:23–42](../baseline/js/src/core/generate.mjs#L23-L42) 在 manifest 通过且无 declaredProducts 时动态导入 `<generatorDir>/generate.mjs`；[该 manifest](../baseline/js/generators/_deprecated/scala-cqrs-es/generator.json#L1-L35) 提供 v0.3 inputSchema/products/artifactKinds。本次不执行入口，不保证任意 canonical 都可用。

[generate:67–93](../baseline/js/generators/_deprecated/scala-cqrs-es/generate.mjs#L67-L93) 对 `canonical.aggregates ?? []` 调 `repositoryModel`/`renderRepository`，端口输出 `modules/kernel/src/main/scala/<pkg>/application/aggregates/repository/<name>Repository.scala`，kind repository，deps `[a.name, nameAggregate, nameRepositoryImpl]`。formal 的 registeredProductProducer 未注册此目录。

[repositoryModel:212–248](../baseline/js/generators/_deprecated/scala-cqrs-es/builders/models.mjs#L212-L248) 的全部返回项为 `header/base/name/family/imports/implName/conceptAnchor/entityRefMethod/finders`：

- repo 缺省 `{}`；entityRefFamily/Import 可被 slot 覆盖，否则 commandFamilyOf(a) 与 protoFqn 推导。
- finders 缺省空；每个仅一个参数 `f.param.name: scalaSig(f.param.dataType)`；logic 缺省“通过 Sharding 获取聚合根引用”；cmdType 固定 `${name}Command`。
- importRows 按每个 EntityRef 使用加一个带 type-key 的条目，再加入重复 ImplementedBy、Inject、wildcard、aggregate/Protocol/impl；有 finders 才加 `${name}Command` 和 `${frameworkBase}.CommonTypes.Id`。这是 corpus 兼容规则，不是 BC 通用 QueryMethod 依赖推导。
- conceptAnchor 有 a.noteId 才 `a.noteId + env.anchor(a.noteId)`；entityRefMethod 是完整方法声明和 Logic 注释的源码字符串；imports 也是已渲染字符串。不能将这类代码串槽包装成严格结构化 MBT。

[renderRepository:148–169](../baseline/js/generators/_deprecated/scala-cqrs-es/templates/scala.mjs#L148-L169) 输出 header/package/imports/长 Javadoc/可选 concept/annotation/trait/entityRef；finders 非空逐个输出 def 与 Logic、双换行，否则直接闭合。没有泛型 trait、Handle、get/close，也没有 query 参数来源锚。`family` 解构后未消费。适合提供有限 legacy 对照，不自动复活或接入银行。

### 5.4 family2：真实独立端口，仍不是 EntityRef 仓库

[registeredProductProducer:97–98](../baseline/js/lib/products/generate-cli.mjs#L97-L98) 注册 aggregateCore；[generate:11–23](../baseline/js/generators/scala-cqrs-aggregate-core-v1/generate.mjs#L11-L23) 要求 `scala-cqrs-aggregate-core@1`，planProductSet → buildModels → render；[productionJobs:15–24](../baseline/js/generators/scala-cqrs-aggregate-core-v1/render.mjs#L15-L24) 同时发 repository / repositoryImplementation。formal play-service 分支未调用此 renderer。

模型相关全部规则：

- [artifactsSpec:18–28](../baseline/js/generators/scala-cqrs-aggregate-core-v1/build-models.mjs#L18-L28)：repository role/kind 为 actor-repository，包 application.aggregates，后缀 ActorRepository，module glue；实现包 infrastructure.repositories，前缀 Local + 后缀 ActorRepository，module glue。
- [50–119](../baseline/js/generators/scala-cqrs-aggregate-core-v1/build-models.mjs#L50-L119)：options 限 packages/names/protobuf；新 role binding 校验 ref kind/重复/未用；kernel model 只构造一次；externalProducers 非空直接拒绝。ActorRepository 保留 Handle 名；与标准类型、其他 artifact、portable name 作碰撞检查；经 resolveNameSet/resolveArtifactPath。artifact 全字段为 `ref, role, kind, module, name, identifier, package, fqn, path, sources, refs, directDeps`。
- [221–247](../baseline/js/generators/scala-cqrs-aggregate-core-v1/build-models.mjs#L221-L247)：repository directDeps 仅 actorProtocol，implementation 为 repository + actorProtocol；source/ref 汇总去重；所有 directDeps 必须是实际输出且不是自身；kernel 不得依赖 glue。返回不可变 targetData。它没有 storage/query/ImplementedBy/RepositoryMethodModel 语义。
- [profiles:16–24](../baseline/js/lib/scala-target/profiles.mjs#L16-L24) 的 glue 源根为 `modules/glue/src/main/scala`，所以缺省端口为 `modules/glue/src/main/scala/<basePath>/application/aggregates/<Name>ActorRepository.scala`，非传统 kernel/repository 位置。

family2 端口 renderer [repository.mjs:3–9](../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/repository.mjs#L3-L9) 的完整输出构造（用模板标识符表示循环输入，不假造现成银行文件）：

```scala
package <artifact.package>

import akka.actor.typed.ActorRef
import akka.persistence.typed.PersistenceId

trait <artifact.identifier>[K] {
  def get(key: K): <artifact.identifier>.Handle
  def close(): Unit
}

object <artifact.identifier> {
  final case class Handle(
    persistenceId: PersistenceId,
    ref: ActorRef[<actorProtocol.identifier>.Command]
  )
}
```

`importsFor` 的真实冲突分支见 [imports.mjs:3–25](../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/imports.mjs#L3-L25)：按 groups 收集，artifact.name/K/Handle 为保留名；冲突符号使用 `_root_.FQN` 且不发该 import；同组同包合并花括号；按输入组顺序，不等于 BC 全局排序。上面展示的是无冲突分支。`out.append` 对整段关联 `[a.source]`，不是 query 参数级 mapping。

同文件 implementation 的 RHS 不能因只接管 port 而丢失：三参数 identity/behavior/spawn 按顺序分别 require 非空；private var handles/pidOwners 初始 Map.empty，closed/inOperation=false；`serialized[A](body: => A)` 在 synchronized 内拒绝回入、设置 inOperation=true、`try body finally inOperation=false`；get 先检查 closed/key，再 match 命中/未命中；未命中计算 `PersistenceId`，检查 pid/id/trim 非空与 owner 冲突，求 behavior 并校验，再 spawn(key,pid,nextBehavior) 并校验，构造 Handle，依次更新 handles、pidOwners 后返回。close 通过 serialized，仅未 closed 时置位并清两 Map；源码明确 ActorSystem/已交付 ActorRefs 属调用方，不停止它们。它比 formal cache 多回入和返回值检查，也更换了 PID 的**类型**，不能当作无语义替换。

## 6. 真实 minus/plus 结构差分

minus 是第 5.1 节 actual-js CreditBalance 完整文件；plus 是第 4.1 节有条件的 sharding 目标例，暂保留 JS generated 头以独立观察业务构造变化。**无同输入新输出，非可直接 apply 的迁移 patch；D1/D2/D4 未定，禁止把本 diff 覆盖到银行。** `CreditBalanceCommandFamily` 是 B5 规则示例，不声称银行现有 Protocol 已提供该类型。

```diff
--- actual-js/app/example/bankwealth/application/aggregates/CreditBalanceRepository.scala
+++ approved-target/app/example/bankwealth/application/aggregates/repository/CreditBalanceRepository.scala
@@ -1,30 +1,20 @@
 // @generated by truthsrc scala-cqrs-domain:1
-package example.bankwealth.application.aggregates
+package example.bankwealth.application.aggregates.repository
 
-import akka.actor.typed.{ActorRef, Behavior}
-import CreditBalanceProtocol.Command
+import akka.cluster.sharding.typed.scaladsl.EntityRef
+import com.google.inject.ImplementedBy
 
-object CreditBalanceRepository {
-  final case class Handle(persistenceId: String, ref: ActorRef[Command])
-}
-final class CreditBalanceRepository[K](identity: K => String, behavior: (K, String) => Behavior[Command],
-    spawn: (String, Behavior[Command]) => ActorRef[Command]) extends AutoCloseable {
-  import CreditBalanceRepository.Handle
-  require(identity != null && behavior != null && spawn != null)
-  private val handles = scala.collection.mutable.Map.empty[K, Handle]
-  private val identities = scala.collection.mutable.Map.empty[String, K]
-  private var closed = false
-  def get(id: K): Handle = synchronized {
-    require(!closed, "repository is closed")
-    handles.getOrElseUpdate(id, {
-      val pid = identity(id)
-      require(pid != null && pid.nonEmpty, "explicit persistence identity required")
-      require(!identities.contains(pid) || identities(pid) == id, "conflicting repository persistence identity")
-      val ref = spawn(pid, behavior(id, pid))
-      require(ref != null, "actor spawn returned no reference")
-      identities.put(pid, id)
-      Handle(pid, ref)
-    })
-  }
-  def close(): Unit = synchronized { closed = true; handles.clear(); identities.clear() }
+import example.bankwealth.application.aggregates.CreditBalanceProtocol.CreditBalanceCommandFamily
+import example.bankwealth.infrastructure.repositories.aggregate.CreditBalanceRepositoryImpl
+
+/**
+ * CreditBalanceRepository: Application Layer Repository Interface for CreditBalanceAggregate
+ * The abstraction for interacting with the Aggregate via sharding and persistence.
+ */
+@ImplementedBy(classOf[CreditBalanceRepositoryImpl])
+trait CreditBalanceRepository {
+
+  def entityRef(id: String): EntityRef[CreditBalanceCommandFamily]
+  // Logic: sharding 实体引用（聚合隐式契约——对齐 gen_api_layer entityRef，2026-08-28 终局原则）
+
 }
```

删除号表示从**应用端口**移出，不授权删除 cache 的必要行为。implementation/local profile 的完整承接方案批准前，整个替换不可实施。尤其 `ActorRef[Command]` 不是 `EntityRef[CommandFamily]`，不允许 cast 或包一层同名空壳伪装实现。

## 7. 胶水、实现槽与保护面

|完整符号|来源/版本证据|本族需要的 API/语义；未核验边界|
|---|---|---|
|`akka.cluster.sharding.typed.scaladsl.EntityRef[T]`|BC [scaffold/build.sbt:10–22](../baseline/bc/scaffold/build.sbt#L10-L22) 声明 `com.typesafe.akka:akka-cluster-sharding-typed_2.13:2.6.20`|默认 entityRef 的精确返回类型；不能以普通 ActorRef 替换。此处未读取 JAR/编译，未声明实际供给已满足。|
|`com.google.inject.ImplementedBy`|BC [build.sbt:72](../baseline/bc/scaffold/build.sbt#L72) 使用 Play `guice`；[GeneratorContext:75](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L75)|注解以 `classOf[RepositoryImpl]` 指定实现；Guice/JSR-330 的精确解析版本需实施前固定，不猜 transitive jar 版本。|
|`javax.inject.Inject`、`javax.inject._`|raw Builder/Template 固定依赖|端口上未出现 Inject；最小目标去未用 import。实现的 Inject/Singleton 由实现族核对，不能据 source 存在推断 jar。|
|`<base>.application.aggregates.<Agg>Protocol.<Agg>CommandFamily`|B5 合成；应用协议族提供|必须是真实 actor command family。curated 的 `CreditBalanceCommand`、formal/family 的 `.Command` 与 raw `.CreditBalanceCommandFamily` 分账；不得合并名义类型洗平差异。|
|`<base>.infrastructure.repositories.aggregate.<Repo>Impl`|isImplementedBy + impl resolver|与本端口方法、泛型、参数顺序一致；[impl Template:35–41](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/repository/AggregateRepositoryImplTemplate.scala#L35-L41) 自己逐方法只发单参数 sharding.entityRefFor 体，不能从端口支持任意 QueryMethod 推出实现也支持任意 query。|
|`akka.cluster.sharding.typed.scaladsl.ClusterSharding` / `entityRefFor`|实现族模板中的真实调用|`sharding.entityRefFor(Aggregate.entityTypeKey, id.toString)` 归 infrastructure；本端口无该 body，不 spawn，不 persist，不 reply，不控制 actor 退出。|
|`net.imadz.common.CommonTypes.Id`|仅 curated 查询签名；BC [build.sbt:131](../baseline/bc/scaffold/build.sbt#L131) 声明 `net.imadz:common-core_2.13:0.2`|原样保留名义引用；不是把 Id 无条件 alias 为 String 的授权，也不证明当前消费者 JAR 提供完整 API。|
|`akka.actor.typed.ActorRef`、`Behavior` / `akka.persistence.typed.PersistenceId`|formal/family2 renderer|仅旧本地应用/基础设施合同。不得注入领域 params/events，PID 字节编码/唯一性与 lifecycle 归原 owner。|

本族 raw 没有业务 `???`/MANUAL body；`logicIntent` 是说明字符串槽。共享 TypeResolver 的 `???`/Any fallback 和 legacy 已渲染 imports/entityRefMethod 则是明确技术债，不能因此给端口补 fake success。

联动保护条件：CommandHelper 仍位于 `application.aggregates.behaviors`，保留 `toParam/createFailureReply/createSuccessReply`；typed replyTo 仅按明确回复合同追加到应用 actor commands，domain params/events 不含 ActorRef。repository 只给出引用，不替代 `runReplyingPolicy`：失败不 persist，成功 persist/apply 后 thenReply 读取新 state，`replyWith` 不等于带发布的 `replyWithAndPublish`。这些是协议/行为组依赖的验收条件，不是端口源码已验证的行为。本次不动 PB 字段号、PID/serializer identity、nominal type、addExact/overflow 语义。

## 8. 后续 JS 实施写集合、唯一组装所有者与迁移

以下仅为拟实施规格，不是本轮写权限。所有 JS 相对路径均以 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/` 为根。

### 8.1 本族独占拟新建模块（proposed，无独立 CLI 注册）

|路径|责任|
|---|---|
|`generators/scala-cqrs-aggregate-repository-port/model.mjs`|显式 AggregateRepositoryModel/RepositoryMethodModel 数据合同，8+4 字段及 FieldDef/TypeRef 的依赖/来源；禁止 content 整文件字符串槽。|
|`generators/scala-cqrs-aggregate-repository-port/build.mjs`|对应 B1–B9，输入采用集成者已裁定的 repository metadata adapter；建默认方法/有序 QueryMethod、解析依赖、保留来源；不做 I/O。|
|`generators/scala-cqrs-aggregate-repository-port/template.mjs`|对应 T1–T10；只消费 resolved model；返回源码及最终定位所需构造映射，不管理 actor、不写磁盘。|

### 8.2 共享容器由单一集成 owner 修改

唯一跨族 assembly owner 定义为 **`codegen-parity-integration`（集成角色）**。本族实施 owner 只交付上面三个模块和独占 fixture；下表所有共享路径由该集成角色串行修改，不能让 port、implementation、protocol、factory 多人同时写。

|现有路径|split/move/replace 计划与边界|
|---|---|
|`generators/scala-cqrs-play-service/build-aggregate-models.mjs`|replace repository 分支为本族 adapter；移出的 cache 模型交 implementation/local-profile owner；其他 6 roles 不在本族修改授权。|
|`generators/scala-cqrs-play-service/aggregate-names.mjs`|将端口路径绑定 repository 子包；impl/factory/protocol 的协调由公共 layout owner；不重命名稳定 identity。|
|`generators/scala-cqrs-play-service/render-aggregate-layers.mjs`|repository role 唯一调用新 template；复合文件其余角色/顺序保留；新路径只允许一条 entry，不双重 emit。|
|`generators/scala-cqrs-play-service/templates/aggregate-repository.mjs`|split：应用 trait 使用新本族 template；旧 J2–J6 的本地 cache 合同由实现族完整承接或明确退役。不能仅删除该文件让调用方丢能力。|
|`generators/scala-cqrs-play-service/generate.mjs`、`generator.json`|集成者固定 profile/产物 kind 和接线；当前 aggregate-repository 与 repository-iface 不是同一个已注册 vocabulary，迁移要显式。|
|`generators/scala-cqrs-aggregate-core-v1/build-models.mjs`、`render.mjs`、`templates/repository.mjs`|只有 D1 确认的 sharding profile 才接新模块；保留独立 local profile/实现语义。shared template 中 implementation 函数归另一族，不顺手删除。|
|`lib/scala-target/naming.mjs`、`model.mjs`、`profiles.mjs`|仅公共 owner 可改；复用已读 `resolveName/resolveNameSet/resolveArtifactPath`，需对齐 BC 后缀/包规则；TypeRef/signature/import 与模块依赖新增合同由公共 owner 审定。|
|`lib/products/generate-cli.mjs`、`src/core/generate.mjs`|仅集成 owner 管 registration/writer；本族不另造旁路。最终格式之后建立 fingerprint/codeMappings/anchors。|

legacy `_deprecated/scala-cqrs-es` 与 standalone repository-dsl 仅为参考/兼容边界，默认不改、不复活；如未来要求接入，另确认 manifest、输入与 profile，不通过隐藏调用 emit.mjs 绕开 writer。

依赖：`shared-layout-types`、`application-protocol`、`aggregate-repository-implementation`、`aggregate-root`（entityTypeKey）、`aggregate-factory`/bootstrap（实例与 lifecycle）、共享 writer/回锚集成。Guice annotation 造成 port→impl 类型依赖，不可由模块调度偷偷消除或造成 kernel/glue 循环。

旧输出退役清单至少包含 actual-js 三条旧 repository 路径；由新 author→entry 重新生成，不手改应用、不留 domain/application 同名转发壳。调用方迁移必须按真实 `new Repository[K](identity,behavior,spawn)`、`.get(...).ref`、`.get(...).persistenceId`、`.close()` 使用点逐一确认；本次没有把未知手写调用方编造成已迁移名单。若 sharding 被选中，原 cache 资源所有者、key→PID 编码、跨调用唯一性、停止边界均需明确结果，不能静默消失。

旧 entry 的 deps/knowledgeIds、更新后的实际文件与 codeMappings 均经唯一 writer 计算；[entry:25–31](../baseline/js/generators/scala-cqrs-domain/naming.mjs#L25-L31) 当前将 header 计入 byte offset，且 formal repo 没有 codeMappings；新字段/方法级 provenance 必须在最终格式后构造。不得手写 ledger/anchors，不假设换 path 会自动删除旧文件；[writer:187–190](../baseline/js/src/core/generate.mjs#L187-L190) 的 retained 行表明不再计划不等于删除。

## 9. Fixture 与验收合同（全部未运行）

拟独占资产根为 `docs/codegen-parity/fixtures/aggregate-repository-port/` 与 `expected/aggregate-repository-port/`，此轮不创建。这里的 fixtures 是工程对照资产，不是第二份业务真源。实现前确认 author→JS request 与 Scala metadata 的逐字段等价映射。

|fixture|必须检查的内容|
|---|---|
|最小 sharding|明确 base/name/command family，methods 空仍恰一条 entityRef；完整文件对账，不假造同名银行 query。|
|声明覆盖与过滤|声明 entityRef、非 Query 的 Upsert、两个有序 query/overload；entityRef 只一条且首位，声明 entityRef 解析后过滤这一顺序有记录。|
|字段/类型|空参数、多参数、关键字参数、嵌套泛型/tuple、同包/scala/java.lang 类型、同名类型冲突、重复 EntityRef 泛型 import；无默认参数自动注入。|
|来源|aggregate 无号/有号、有号无 hash/有 hash；parameter noteId/description 有无组合；容器与参数来源不伪造；参数变更能回到作者字段。|
|输入拒绝|aggregate 引用缺失；共享 resolver 不支持的 MetaRef；未定义返回/参数类型；optionalWhen 未定义语义不被静默当成支持。|
|命名|聚合名含既有 Aggregate/Repository 后缀、后缀剥空保护、关键字/大小写文件碰撞；协议 owner 和 CommandFamily 名须与真实 protocol 一致。|
|local compatibility|如果保留 local profile，formal/family2 各自完整 get/close、PID、失败/回入/资源边界分别保留；不将二者不同校验和 callback 签名混成同输入证明。|
|模块/DI|single 端口及其 impl 引用可解析；multi 的 kernel/glue/DI 依赖方向显式决定；不能以只编一个 trait 证明整体装配。|

验收分账：

1. **内容**：同等语义 fixture 通过两路真实 CLI 后，逐个完整文件比较路径/package/imports/注释/trait/所有 query 参数、返回类型与顺序；raw→approved 仅记录第 4.1 的有限排版/import 偏差。严禁 whitespace flatten、删除 package 或重写语义后再对账。
2. **接口与必要行为**：聚合协议及实现真实编译闭包集中核验；sharding 用真实固定供给验证 entityTypeKey/返回 family/ID 不漂移；本地 profile 检查 callback 次数、失败不提前保留 owner、close 与 actor ownership（每路按原合同，不伪称 formal 有 family2 的回入保护）。关联 actor behavior 才检验失败不 persist、成功 thenReply 新 state、无意外发布，本端口不自造该算法。
3. **稳定与回锚**：独占新输出连续两次相同输入字节稳定；再改单个参数描述/类型/来源，核局部 diff 和真实 author 查询定位；writer 最后基于最终字节记账。
4. **命名/布局/复杂度**：仅三层；port 在 application.aggregates.repository；OO 端口不承载缓存；普通 JS/Scala 方法 CC 目标 ≤5，6–10 逐方法说明，>10 先重构或逐方法批准例外，禁止 String/Any dispatcher 刷分。当前 **not-measured**，工具/版本/语法口径仍需固定，端口无 body 不代表相关 Builder 或实现 CC 达标。

### 9.1 精确公共 CLI 形状及副作用

**以下命令仅供下一获批执行阶段，未运行；输入路径为拟 fixture，不声称已经存在。** 当前没有 `--artifact aggregate-repository-port` 这种受支持 flag；“scoped”靠小 fixture 的实际依赖闭包，不靠猜参数。首次内容目标选 single project，multi 另核。

JS（已证实的公开 products flags，仅独占新输出）：

```sh
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/aggregate-repository-port/products.request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-play-service \
  --out /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/.rounds/aggregate-repository-port-acceptance/js-new \
  --options-json /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/aggregate-repository-port/js-options.json \
  --plan
```

[generate-cli:66–88,104–145](../baseline/js/lib/products/generate-cli.mjs#L66-L145) 要求四个路径 flag 全部显式；`--plan` 仍捕获 JSON、编译内存产品图、加载 manifest、渲染计划；对 play-service 会读取本地 `file:///...` Saga JAR 并核 SHA，有 pipeline 再核 Monarch，检查 externalSourceRoots 真实目录与 out disjoint。不是 runtime、不是下载。没有 `--plan` 才调用 `applyEntries`；当前 plan 不等于完整 apply-preflight。不得把新的目标目录视为输入/JAR读取都已获准，先冻结该闭包。

获准后去掉最后 `--plan`，写面为计划中的**全部**输出（不止 repository，含继承 generator 的 Scala/proto/build/test/config）及 out 下 `truthsrc.ledger.json`、`anchors.json`，调用 [applyEntries:246–268](../baseline/js/src/core/generate.mjs#L246-L268) 的 preflight、mkdir/write、回读与锚写；不会由这个入口启动 sbt/服务或发布依赖。本族拟新模块不是 registered producer，不能把 `--generator` 偷换为它。family2 对照需单独用已注册 `.../generators/scala-cqrs-aggregate-core-v1`、该 profile 精确 options/request 和 `family2-new` out；不能让含 external producers 的银行输入通过其 no-external gate。

Scala 传统完整 CLI（在 `/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen` 作为进程工作目录时；此轮未进入运行）：

```sh
sbt \
  -Dcodegen.systemFile=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/aggregate-repository-port/scala-canonical.json \
  -Dcodegen.systemBindings=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/aggregate-repository-port/scala-bindings.json \
  -Dcodegen.targetDir=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/.rounds/aggregate-repository-port-acceptance/bc-new \
  -Dcodegen.ledger=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/.rounds/aggregate-repository-port-acceptance/bc-new/generation-ledger.json \
  "runMain net.imadz.codegen.CodegenMain"
```

参数来自 [CodegenMain:62–81,169,199–251](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L62-L81)：systemFile 与 systemBindings 必须成对，不能同时指定 codegen.system；使用传统分支，不能加 semanticProductsFile 偷换基准。**D3 未解决前不能保证该 formal adapter 承载任意 QueryMethod fixture**；若不支持，先裁定现有 registry fixture 输入槽，不能发明 `-Dcodegen.system=AggregateRepositoryFixture` 当成已有注册。

该命令会有 sbt/JVM 编译、缓存/日志、潜在依赖解析或下载及子进程；要求单独批准离线供给与调度。CodegenMain 在当前固定版本先 prepare/harness，后 mkdir/copy scaffold，执行所有传统层与 protobuf/接口/bootstrap，写显式 ledger、knowledge manifest，formalSemantics 存在还写 JSON；非“只写 repository”。不设置严格 Saga 槽；不得默认写共享 banking-app/ingested-app。执行前还需单独读 BC 当时 AGENTS/CLAUDE/协调约定，不能据本文取得任何发布/服务权限。初轮生成/对账预算 5 分钟，集中编译/必要行为预算 15 分钟，均为调度上限建议而非性能实测。

## 10. 具体未决项与实施停止点

- **D1 — 执行模型与资源所有权**：A 的默认方法明确是 `entityRef(String): EntityRef[CommandFamily]`；银行 formal 是 `get[K]: Handle(String, ActorRef[Command])`，family2 为 `Handle(PersistenceId, ActorRef[Command])`。必须决定银行切 sharding 还是 local profile 单列，并给出 identity/behavior/spawn/get/close 调用方与 PID/资源迁移合同。没有合法 ActorRef→EntityRef 等价转换，不允许伪实现。
- **D2 — command family/源名归一化**：raw Builder 直接用 aggMeta.name 拼 `...Protocol/...CommandFamily`；curated 的 `CreditBalanceCommand` 与 formal 的 `.Command` 是不同现有合同。确定选定协议的真实 family 与有后缀 aggregate 名行为，再给出所有 query 的返回类型；不得用 type alias 合并名义类型或盲改 actor 协议。
- **D3 — QueryMethod 输入面与不完整解析**：formal/family2 模型没有通用 repository methods 输入，BC 端口能声明任意已解析 QueryMethod 而实现模板只见单参数 sharding 模式。需要明确 JS 产品/绑定承载方式、Scala 适配可达 fixture、optionalWhen 与 unsupported MetaRef 的拒绝策略；raw `???`/Any fallback 不可视为成功默认。
- **D4 — DI 与三层/模块依赖**：raw `@ImplementedBy(classOf[Impl])` 使 application 端口引用 infrastructure；multi 的端口 kernel / 实现 glue 可能与分层方向冲突。裁定保留传统注解的明确例外，还是把 binding 移至 infrastructure.bootstrap 并修订目标；本族无权自行去注解或复制库。
- **D5 — 供给与验证入口**：固定实际 EntityRef/Guice/JSR-330/common-core 消费 JAR 的坐标、字节/API，以及最小 fixture 的真实可运行接线、方法 CC 口径和工具。当前只有源码/声明证据，无下载/编译/行为结果；这些阻断实施验收，不阻断本内容文档保存。

保存本规格不使上述决定自动通过；各项应独立取得结果，不因其他 artifact 受阻而丢弃本族已经观察到的内容。
