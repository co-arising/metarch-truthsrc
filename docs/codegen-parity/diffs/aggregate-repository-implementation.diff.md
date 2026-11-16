# aggregate-repository-implementation：聚合仓储实现内容规格

## 1. 身份、边界与证据状态

- Artifact / group：`aggregate-repository-implementation`，传统目录第 22 族。
- 状态：**`decision-required`**。传统 sharding 目标可明确描述；formal 银行和 family2 的实际合同却是本地 Actor 缓存，不能将换包名当作同义实现。formal 的经典 sharding 对应项为 **`missing-counterpart`**；legacy 有近似实现，不能写成 JS 完全不存在。
- 固定 HEAD：BC `cc335eb1e0d0fae17bf092fd61b126040196ea70`；JS `bf104e16ab82ef39d7fa416d0997907d18a815ad`。源码字节以 [baseline/index.json](../baseline/index.json) 的 `source/snapshot/bytes/sha256` 为准，不用 HEAD 代替工作树身份。
- 本次只做源码内容检查。未执行生成、编译、测试、typecheck、运行或服务；没有新鲜的同输入双端产物。下面的差异是**结构性对照，非同输入字节比较**。
- 首次检查时两个分配文件均不存在；只创建本文件与 `details/aggregate-repository-implementation.json`。不改基线、源码、生成应用、truth、catalog、ledger、anchors，不触碰此前 15 份 diff 或其他人的交付。
- 权威范围为 [APPROVED-PLAN.md](../../../.rounds/prettify-generated-code-resume-20261115-cgr9lzlk/APPROVED-PLAN.md)、[作者合同](../AUTHORING-CONTRACT.md)、[布局标准](../layout-and-style.md)。[SHARED-SEAMS.md](../SHARED-SEAMS.md) 是补读的接口草案，不是新 profile 已获准的证明；当前文件的 SHA 列于详情。

### 1.1 四类来源必须分开

| 来源 | 本项实际拥有的证据 | 不允许据此推断 |
|---|---|---|
| `raw-scala` | 完整 Model、Builder、Template，以及 writer/类型解析固定源码；下文逐构造解释 | 没有本轮执行得到的 `CreditBalanceRepositoryImpl.scala` 原始生成文件，不能把手工样板改名为 raw |
| `approved-target` | 已确定的三层布局、M/B/T 职责、类型/命名/回锚规范；默认沿用 raw 的 sharding 实现 | 下文 sharding 示例是条件目标文本，不代表银行已批准迁到 ClusterSharding；D1–D6 未决 |
| `actual-js` | 银行冻结的 CreditBalance、FundOrder、SipPlan 三个完整仓储文件，以及正式 renderer | 产物头写 `scala-cqrs-domain:1` 不代表实际由哪个入口调度；入口必须沿调用链核对 |
| `curated reference` | 人工 `CreditBalanceRepositoryImpl` 和配套 port | `case class`、`Id`、`findCreditBalanceByUserId`、旧 key 名不能偷换为本次 raw 模板规则 |

### 1.2 主证据指纹

下列都是固定副本；本次已核对 M/B/T、formal/legacy/family repository 源码及三个银行仓储的 bytes/SHA 与 index 一致。其余支撑文件以 index 行为完整身份记录。

| 固定文件 | bytes | SHA-256 |
|---|---:|---|
| [M：AggregateRepositoryImplModel.scala][M] | 1300 | `e9fc2a296bcd78b21017c28ab6e37d81eb7734cf4d9c619adc390080416d0d0a` |
| [B：AggregateRepositoryImplBuilder.scala][B] | 3263 | `2ee4a5e708d144dcaa7254b1f23c27205e3578cc63f1a0819d3f94f954834ada` |
| [T：AggregateRepositoryImplTemplate.scala][T] | 1822 | `96e0a18d3d388b971b4a76769043367f060dfd0abba0c1e8c1fb86e938090d02` |
| [formal repositoryTemplate][JT] | 1513 | `2da01826f5232f9ea263f3a128de46b1fb5f0cbc67fede5500125f52c0c85c2d` |
| [legacy emit.mjs][LEG] | 6725 | `e1a4db369a337c276764bce2a08c22f42156421fdf6f63edcc72811cd4e1a73f` |
| [family2 repository.mjs][FAM] | 3539 | `4df99f3bc570cf8cccf2c16d179d3f208c68bdb75bef897b172889dce37bb422` |
| [银行 CreditBalanceRepository.scala][ACT] | 1370 | `561ca59e23b4a2e9f2dd474c3336761a6c28cc20fe87ee70812b472b851a1c42` |
| [银行 FundOrderRepository.scala][ACT-F] | 1354 | `d75f21d2b590f776397264a43d25c8330984029235c530b92ee7d56948fe96af` |
| [银行 SipPlanRepository.scala][ACT-S] | 1346 | `90efb72f869a41ae9e14e508671e1a6190b1b1543198fa22c3653d01f85ec543` |
| [人工 CreditBalanceRepositoryImpl.scala][CUR] | 678 | `9338005301a48f67caca1e18cdeab6091d1ecfbe812ec6573acaa76914d9267a` |

## 2. Scala 真实生产链、条件与完整源码

### 2.1 调度及输出基数

[CodegenMain.scala L183–201](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L183) 先区分 `semanticProductsFile` 支路；本项只对传统 `prepare → CQRSApplicationGenerator.generate/generateAdmitted → runCommon` 负责。`template/products/*` 不是这里的金样。

[runCommon L192–220](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L192) 建 `GeneratorContext`，依次 domain、application、infrastructure、interface、state controller、bootstraps。[本项 dispatch L786–802][DISPATCH] 对 `system.infrastructure.repositories` 中每个 `AggregateRepositoryMetadata` 调用 B、T、`writeArtifact`；不是直接对每个 application aggregate 无条件输出，也没有 storage/sharding 类型的局部分支。

- 计划基数：每个上述 metadata 一个实现文件；方法数为 `1 + QueryMethod 中名称不为 entityRef 的数量`，前提是 Builder 未在 `.head` 或 resolver 处失败。
- 无 repository metadata：本项 0 文件。`ProjectionRepositoryMetadata` 属于另一个分支，不计本项。
- `scope` 在 writer 内决定是否实际写入；领地策略还可能 KEEP。不能把 template 被调用次数当作实际写成次数。
- attribution 精确为 `ArtifactAttribution("repository-impl", m.aggregate.targetName, "aggregate", List(m.aggregate.targetName))`。
- 单工程完整路径：`<target>/app/<base path>/infrastructure/repositories/aggregate/<RepositoryBase>RepositoryImpl.scala`。
- 多工程完整路径：`<target>/modules/glue/src/main/scala/<base path>/infrastructure/repositories/aggregate/<RepositoryBase>RepositoryImpl.scala`。来自 [targetModuleOf L331–349 / writer L359–425][WRITER] 的 `repository-impl → glue`。
- `RepositoryBase` 从 `meta.name` 解析，聚合协议名从 `meta.aggregate.targetName` 解析，不能假定两者名字相同。
- raw 有 single/multi 两种物理根，无两个内容模板。本轮都 `not-exercised`；scope/KEEP 是写入状态，不是新模板族。

### 2.2 Model 完整定义

[M L1–26][M] 原始定义如下；仅代码块中的缩进为便于阅读重排，精确空白以固定文件为准，所有成员和注释意义保留。

```scala
package net.imadz.codegen.scaffolding.cqrs.model.infrastructure.repository

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, TypeRef}

case class AggregateRepositoryImplModel(
    override val selfType: TypeRef,
    interfaceType: TypeRef,
    entityTypeKey: String,          // e.g. CreditBalanceEntityTypeKey
    aggregateType: TypeRef,         // e.g. CreditBalanceAggregate (Protocol Object)
    methods: Seq[ShardedMethodModel],
    override val dependencies: Set[TypeRef],
    /** S7（EP §二 G1）：台账 artifacts[] 文件级落点由此可查。 */
    override val noteIds: Seq[String] = Nil
) extends ArtifactModel

// [FIX] Rename SimpleShardedMethodModel -> ShardedMethodModel
case class ShardedMethodModel(
    name: String,
    paramName: String,
    paramType: TypeRef,
    returnType: TypeRef
)
```

| 序号 / 字段 | 类型、默认与实际用途 | JS 对应要求/现状 |
|---|---|---|
| M1 `selfType` | `TypeRef`，必填；package/class/file 名来源 | formal 只有 `names`/`paths.repository`，没有 Impl selfType；新增结构字段，不塞整文件 content |
| M2 `interfaceType` | `TypeRef`，必填；父 trait 简名与依赖 | formal class 直接 `extends AutoCloseable`；family 有 `a.repository`，合同却是泛型 `get/close` |
| M3 `entityTypeKey` | `String`，必填；Builder 计算但 T **不读取** | 保留 raw 字段与 unused 事实；不得拿这个字符串替换 `.entityTypeKey`，否则可能选错符号 |
| M4 `aggregateType` | `TypeRef`，必填；B 实際指向 application Aggregate；T 用其 `.name` 访问 key | M 注释称 Protocol Object 不足以改变真实解析规则 |
| M5 `methods` | `Seq[ShardedMethodModel]`，无默认；顺序有意义 | 不能用固定 `get` 代替 metadata query + 合成 entityRef |
| M6 `dependencies` | `Set[TypeRef]`，必填；生成 imports，writer 记 deps | formal `artifact.dependencies` 是文件路径，不是完整类型引用；两层都需要，不可混用 |
| M7 `noteIds` | `Seq[String] = Nil`；B 从聚合 registry noteId 得到 0/1 元素 | 当前 `[aggregate.source]` 可复用来源，不发明 repository 作者便签 |
| S1–S4 `name/paramName/paramType/returnType` | `String/String/TypeRef/TypeRef`，全部必填；一个参数，没有参数列表或 body slot | target 在 raw 支持域先忠实表达；多参问题由 D2 裁定，不能偷偷丢参 |

[ArtifactModel L5–47](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L5) 继承项也计入模型合同：`fqn = selfType.packageName + "." + selfType.name`；`registerTo(registry) = registry.register(this)`；`morphisms = Nil`，本子型不 override；`noteIds` 基类默认 Nil 被本模型同名字段覆盖。`ShardedMethodModel` 不继承 ArtifactModel，没有来源/body/default 元数据。没有别的模型子型、泛型形参或可选字段。

`TypeRef(name, packageName, typeParams = Nil)` 的 [完整定义 L4–73][TYPE]：`fqn` 对空 package 只返回 name；`signature` 对带参数的数字 `TupleN` 发 `(T1, T2)`，其他泛型发 `Name[T1, T2]`，否则发 name；依赖递归包含自身与所有 typeParams；`shouldImport` 排除空包、当前包、精确 `scala`、精确 `java.lang`。不是忽略所有 `scala.*`，也不是通用 alias/conflict resolver。

### 2.3 Builder 完整源码

[B L1–85][B]：

```scala
package net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.repository

import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.repository.{
  AggregateRepositoryImplModel,
  ShardedMethodModel
}
import net.imadz.codegen.scaffolding.cqrs.{
  GeneratorContext,
  TypeRef,
  TypeResolver
}
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.{AggregateRepositoryMetadata, AggregateRootMetadata, QueryMethod}

object AggregateRepositoryImplBuilder {

  def build(
      meta: AggregateRepositoryMetadata,
      ctx: GeneratorContext
  ): AggregateRepositoryImplModel = {
    // 1. Package & Type
    val pkg = ctx.layout.infrastructure.persistence.repositories.aggregate
    val selfType = ctx.typeResolver.aggregateRepositoryImpl(meta)

    val interfaceType = ctx.typeResolver.aggregateRepository(meta.name)

    // [FIXED] 2. Aggregate Protocol
    // 强制指向 Aggregate 包 (application.aggregates)，而不是依赖 TypeResolver 自动解析 (可能误判为 domain.values)
    val aggType = ctx.typeResolver.aggregateRoot(meta.aggregate.targetName)

    val entityTypeKey = NamingConventions.entityTypeKeyName(aggType.name)

    // 3. Methods
    // R6（泳道终局原则·2026-08-28 用户裁决）：entityRef 为 sharding 型聚合的隐式契约——与 trait 侧同步合成，
    // 置于首位（ImplTemplate 已内建 sharding.entityRefFor 方法体）；元数据声明的同名方法由合成位取代。
    val aggBaseName = aggType.name.stripSuffix("Aggregate") // ConceptAggregate → Concept（Protocol/CommandFamily 命名基）
    val commandFamily = TypeRef(
      s"${aggBaseName}CommandFamily",
      s"${aggType.packageName}.$aggBaseName" + "Protocol"
    )
    val entityRefMethod = ShardedMethodModel(
      name = "entityRef",
      paramName = "id",
      paramType = TypeRef.String,
      returnType = TypeRef("EntityRef", "akka.cluster.sharding.typed.scaladsl", Seq(commandFamily))
    )
    val methods = entityRefMethod +: meta.methods.collect { case q: QueryMethod =>
      val param = q.parameters.head
      ShardedMethodModel(
        name = q.name,
        paramName = param.name,
        paramType = ctx.typeResolver.resolve(param.parameterType),
        returnType = ctx.typeResolver.resolve(q.returnType)
      )
    }.filter(_.name != "entityRef")

    // 4. Dependencies
    val deps = Set(
      ctx.knownFrameworkTypes("Inject"),
      ctx.knownFrameworkTypes("ClusterSharding"),
      ctx.knownFrameworkTypes("EntityRef"),
      aggType,
      interfaceType
    ) ++ methods.flatMap(m =>
      m.paramType.collectAllDependencies ++ m.returnType.collectAllDependencies
    )

    val dependencies = deps.filter(t => t.shouldImport(pkg))

    AggregateRepositoryImplModel(
      selfType,
      interfaceType,
      entityTypeKey,
      aggType,
      methods,
      dependencies,
      // S7（EP §二 G1）：repo Impl 的知识身份＝**聚合号**（repo 是聚合的派生容器·
      // 真源 0 条 repository 便签——实名核实后挂聚合；AggregateRef 只揣名，故经 registry 解引用）
      noteIds = ctx.metaRegistry
        .resolveByName[AggregateRootMetadata](meta.aggregate.targetName)
        .flatMap(_.noteId)
        .toSeq
    )
  }
}
```

### 2.4 Builder 全规则、例外与依赖账

| 顺序 | 真实输入/分支/RHS | 输出与需要保留的区别 |
|---|---|---|
| B1 L22 | `layout.infrastructure.persistence.repositories.aggregate` | 实际值是 `<base>.infrastructure.repositories.aggregate`，**不是** `.infrastructure.persistence.repositories.aggregate`；见 [PackageLayout L88–103][LAYOUT] |
| B2 L23、25 | `aggregateRepositoryImpl(meta)`、`aggregateRepository(meta.name)` | [DSL L736–750](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L736) 前者先 `getBaseName(meta.name)`，再调用另一个再次 `getBaseName` 的 overload；后者 [L463–469](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L463) 基名加 Repository；不擅改 raw 两次剥后缀为一次 |
| B3 L29 | `aggregateRoot(meta.aggregate.targetName)` | [DSL L236–243](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L236) `getBaseName → +Aggregate`，包固定 application.aggregates；本步不检查聚合对象已在 registry 中 |
| B4 L31 | `entityTypeKeyName(aggType.name)` | [Naming L72–75](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L72) 是追加 `EntityTypeKey`；CreditBalanceAggregate 得 `CreditBalanceAggregateEntityTypeKey`，不是 curated 的 `CreditBalanceEntityTypeKey`；T 忽略它 |
| B5 L36–46 | 从解析后的 aggregate 名剥尾 `Aggregate`；合成 Protocol 内 `<AggBase>CommandFamily` | 第一个方法恒为 `entityRef(id: String): EntityRef[<AggBase>CommandFamily]`；EntityRef framework TypeRef 同时存在无泛型基础依赖和带泛型方法依赖 |
| B6 L47–55 | 仅 collect `QueryMethod`；读取 `q.parameters.head`；解析首参数与返回类型；最后过滤同名 entityRef | 非 QueryMethod（如 UpsertMethod）忽略；零参 `.head` 失败；多参只保留第一参数；同名 entityRef **先求 head/resolve 再过滤**，不能声称零参同名方法会安全跳过；其余查询保持元数据顺序且不去重 |
| B7 L58–68 | 五个 base deps 并方法参数/返回类型递归依赖，再 shouldImport | `Singleton` 不在该 Set，由 T 补；集合不同 TypeRef 可以有同一 fqn，T 再按字符串 distinct |
| B8 L70–82 | 按 M 字段顺序构造，noteIds 使用 registry `resolveByName[AggregateRootMetadata](targetName).flatMap(_.noteId).toSeq` | 未找到或没有 noteId 得 Nil，不是伪造来源；这个 lookup 不等于 B3 的命名解析已校验引用存在 |

输入 [ArchitectMetadata L758–813](../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L758) 明确 `AggregateRepositoryMetadata(name, aggregate, methods, storage = None)`。B 不读取 storage。`QueryMethod(name, parameters, returnType: DataType, logic: BusinessLogic)` 的 `logic` 被忽略，T 给每个 query 同一种 sharding RHS；不能以名字是 Query 就推断是数据库查询。`ParameterMetadata` 的 [optional=false、optionalWhen=""、noteId=None、description="" L167–178](../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L167) 也不进入 Impl 模型。

命名 [getBaseName L187–224](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L187) 按固定 suffix 列表顺序各剥一次，剥空回退最后非空值，并非通用分词或循环到稳定点；目标复用集中 naming 时必须对 repository/aggregate 角色做明确输入映射，不能顺手改业务 ID。

`ctx.typeResolver.resolve(MetaType)` 转调 [TypeResolver L19–93](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala#L19)：基础类型直接映射；引用交各角色 resolver；StructRef 有 symbol owner 时走 nested resolution，否则 domain.values；CustomType 命中 framework 名就采用 framework 包并递归参数，否则仅将旧 `net.imadz.domain.values` 改为当前值包并递归；metadata 实体/聚合/VO 转相应引用。未列出的 MetaType 回退 `Any`，未专门处理的 MetaRef 进入 **`resolveMetaRef = ???`**。nested 解析 [L95–148](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala#L95) 按 registry owner 类别/后缀回退，最后可落 domain.values。这里是 raw 共享技术债，不是实现代码槽许可；不能把它移植成假成功 `Any` 查询。

与 port 的具体冲突需要双端裁定：[AggregateRepositoryBuilder L97–152](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateRepositoryBuilder.scala#L97) 为 query 保存**全部** parameters，使用 `parameterType`，还保存 `logic.intent`；Impl 只用 head/resolve。port 合成 family 使用 registry `aggMeta.name`，Impl 使用解析后 stripSuffix 的名字。聚合 metadata 名含技术后缀时，两端不能未经 fixture 就宣称一致。

### 2.5 Template 完整源码

[T L1–63][T]：

```scala
package net.imadz.codegen.scaffolding.cqrs.template.infrastructure.repository

import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.repository.AggregateRepositoryImplModel

import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object AggregateRepositoryImplTemplate
    extends CodeTemplate[AggregateRepositoryImplModel] {

  def generate(model: AggregateRepositoryImplModel): String = {
    // 1. 构建包声明
    val pkgDecl = packageDecl(model.selfType.packageName)

    // 2. 构建导入声明
    val additionalImports = Seq(
      "javax.inject.Inject",
      "javax.inject.Singleton",
      "akka.cluster.sharding.typed.scaladsl.ClusterSharding"
    )

    val importList = (model.dependencies.toList
      .sortBy(_.fqn)
      .map(_.fqn)
      .filterNot(p =>
        p.isEmpty || p == model.selfType.packageName || p.startsWith(
          "java.lang"
        )
      )
      .++(additionalImports))
      .distinct

    val importDecl = imports(importList: _*)

    // 3. 构建方法代码
    val methodsCode = model.methods
      .map { m =>
        val typeKeyRef = s"${model.aggregateType.name}.entityTypeKey"
        s"  override def ${m.name}(${m.paramName}: ${m.paramType.name}): ${m.returnType.signature} =\n    sharding.entityRefFor($typeKeyRef, ${m.paramName}.toString)"
      }
      .mkString("\n\n")

    // 4. 构建完整源代码
    val sourceCode = s"""${pkgDecl.code}

${importDecl.code}

/**
 * ${model.selfType.name}: Aggregate Repository Implementation
 * Implementation of ${model.interfaceType.name} interface
 */
@Singleton
class ${model.selfType.name} @Inject() (sharding: ClusterSharding) extends ${model.interfaceType.name} {

$methodsCode

}
"""

    // 5. 生成代码
    sourceCode
  }
}
```

### 2.6 输出 construct / RHS 按声明顺序记账

| ID / 来源 | 原始输出、完整 RHS/规则 | approved-target 处理 |
|---|---|---|
| T0 writer | [fingerprintHeader L111–113](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L111)：`// @generated by CodegenMain:${GeneratorVersion.value}`；knowledgeRelease 非 null 时再一行 `// @knowledge-release ...` | 属 writer，不硬编码旧 release/hash；仅来源头差异可单独列白名单 |
| T1 L13、44 | `package ${selfType.packageName}`，随后空行 | Impl 放 infrastructure.repositories.aggregate；不生成第四层 |
| T2 L16–33、46 | deps 按 fqn 排序取 fqn；排除空字符串、等于自身 package 字符串、`startsWith("java.lang")`；追加 Inject/Singleton/ClusterSharding；distinct | **最后还会排序一次**：[CodeGenerationDSL L20–22](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L20) 将整个列表 sorted 后逐行加 `import `。raw 无分组空行、无合并 braces。不能遗漏第二次排序 |
| T3 L48–51 | 四行 Scaladoc：实现类名 + `Aggregate Repository Implementation`；`Implementation of <interface> interface` | 保留角色说明；raw 没有成员级 @knowledge 注释，不假装 noteIds 自动变成注释 |
| T4 L52 | `@Singleton` | 注解来自 javax.inject；不是 object 单例，也不是 case class |
| T5 L53 | 非 final、非 case 的 `class <Impl> @Inject() (sharding: ClusterSharding) extends <Interface> {` | 一个普通主构造器参数、无 val/var/default；父类型用 name 无泛型实参，无父构造实参。目标可按行排版，不自动添加泛型 K 或 AutoCloseable |
| T6 L36–41、55 | 遍历每个 `methods`，按序发 `override def name(paramName: paramType.name): returnType.signature =`，下一行 `sharding.entityRefFor(<Aggregate>.entityTypeKey, paramName.toString)`；方法之间一个空行 | 每个方法 RHS 都是取得 typed EntityRef，不是 ask、send、persist、reply、publish 或数据库 I/O。参数用 `.name` 会丢泛型，而返回用 `.signature`，D2 不得隐瞒 |
| T7 L57–58 | 类右括号、末尾换行；空方法模型仍有类内空行 | 正常 B 至少一个方法；独立传空模型属于模板级边界，不称正常产物 |

本 Template 没有 trait/object/companion/type alias/字段 initializer/辅助构造器/方法重载合成/curried 或 implicit 参数/上下界/self-type/lazy 成员/初始化块/MANUAL/`???`。这只描述本文件；共享 TypeResolver 的 `???` 仍须保留为未完成依赖。模板源码字符串属于 T 的渲染职责，M 不存 body 字符串。对 query 的业务 `logic` 丢弃和 generic 参数丢失是 raw 的明确限制，不可用 `Right(empty)`、空 success 或在生成代码塞 `???` 掩盖。

writer [L388–425][WRITER] 从模型 dependencies 经 symbolTable 记账，记 noteIds/morphisms 后才 scope 判断，真实写盘前加 fingerprint，再按领地策略写入。这里的模型来源为文件级，不能据此声称已完成所有成员级精确回锚。

## 3. 人工参考与 raw 的有限偏差

[人工文件 L1–14][CUR] 完整内容：

```scala
package net.imadz.infrastructure.repositories.aggregate

import akka.cluster.sharding.typed.scaladsl.{ClusterSharding, EntityRef}
import net.imadz.application.aggregates.{CreditBalanceAggregate, CreditBalanceProtocol}
import net.imadz.application.aggregates.repository.CreditBalanceRepository
import net.imadz.common.CommonTypes.Id

import javax.inject.Inject

case class CreditBalanceRepositoryImpl @Inject()(sharding: ClusterSharding) extends CreditBalanceRepository {

  override def findCreditBalanceByUserId(userId: Id): EntityRef[CreditBalanceProtocol.CreditBalanceCommand] =
    sharding.entityRefFor(CreditBalanceAggregate.CreditBalanceEntityTypeKey, userId.toString)
}
```

配套 [curated port L1–14](../baseline/curated-scala/net/imadz/application/aggregates/repository/CreditBalanceRepository.scala#L1) 是 `@ImplementedBy(classOf[CreditBalanceRepositoryImpl]) trait CreditBalanceRepository`，仅声明 `findCreditBalanceByUserId(userId: Id): EntityRef[CreditBalanceCommand]`。

| 项目 | raw | curated | 本规格处理 |
|---|---|---|---|
| 类与 DI | `@Singleton class ... @Inject() (...)` | `case class ... @Inject()(...)`，无 Singleton | 默认按 raw，不自动复制 case class 的 Product/copy/apply 等 ABI |
| 方法 | 合成 entityRef 首位，然后所有受支持 QueryMethod | 只有 `findCreditBalanceByUserId` | 不把旧人工方法当银行现有 metadata；D2 确认每条实际 query |
| 参数/返回 | `String` / `<Base>CommandFamily` 为合成项 | `Id` / `CreditBalanceProtocol.CreditBalanceCommand` | 不能把 `Command` 与 `CommandFamily` 名义协议折叠或随意扩大 Actor 接收类型 |
| key selector | `<Aggregate>.entityTypeKey` | `<Aggregate>.CreditBalanceEntityTypeKey` | 必须与 aggregate-root/Bootstrap owner 一起裁定；M.entityTypeKey 字符串不是第三种可随意挑选的 selector |
| imports/格式 | 单条全局排序；一个长 class 行 | braces imports、项目 imports、空行、Inject | 不是同输入字节差异。只把目标显式多行排版计入有限偏差，不宣称原文件等价 |

## 4. JS 当前三条路线及职责差距

### 4.1 formal 银行链路：有 repository renderer，但不是经典 sharding Impl

固定入口证据：

1. [bin/truthsrc.js L184–187](../baseline/js/bin/truthsrc.js#L184) 的 `generate-products` 调用 `generateProductCli`。
2. [generate-cli L92–101][CLI] 通过 generator 目录 realpath 映射 `generatePlayService`；不是看目录名推断。
3. [scala-cqrs-play-service/generate.mjs L16–23、59–70][JGEN] 为 inherited `aggregate-dsl` 调 `renderAggregateLayers`，manifest 必须是 `scala-cqrs-play-service@1`。
4. [render-aggregate-layers L1–30][JLAYER] 注册 `repository: repositoryTemplate`，逐模型调用并转 entry；它的 `legacy` role 是同一 formal producer 输出中的兼容 carrier，**不是** repository-dsl 独立 legacy CLI。
5. [build-aggregate-models L4–41][JB] 从 reference-layout 的 aggregate declarations 派生，固定 `role: 'repository', lookup: 'owned-local-actor-cache'`；来源只有 aggregate.source，文件依赖只有 protocol 路径。
6. [aggregate-names L6–24][JN] 的 repository 路径为 `application/aggregates/<ref.id>Repository.scala`，名称用 symbol(ref.id)，没有 interface/implementation 分离。配置选择不会在这里产生 ClusterSharding 分支。

formal 模型字段不只是文件名：`shared = {aggregate, names, authority: external.length > 0}`；repository 加 `role/lookup/artifact`，`artifact = {kind:'aggregate-repository', path, sources:[aggregate.source], dependencies:[paths.protocol]}`。T 只读取 lookup、names.name/package/protocol，authority 不参与仓储方法。`copyImmutableData(models)` 返回模型；不应把这个机制改成 mutable 隐式 registry。

[formal T L1–34][JT] 先检查 lookup，不匹配即 `TypeError('unsupported aggregate repository lookup')`。其完整银行实例为：

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

[FundOrder][ACT-F]、[SipPlan][ACT-S] 全文件亦已读取：保持上述所有参数、body、默认、顺序，只将 `CreditBalance` 类型/Protocol/Handle owner 替换为各自名字。它们不是新生成 fixture，也不能据三个相似文件证明其他聚合输入都被覆盖。

#### formal 复合文件逐构造的去向（不允许只删除缓存来刷复杂度）

| 实际位置 | 构造 / 全 body 或 RHS | 对经典 A 的处理与保留义务 |
|---|---|---|
| L1–5 | writer 头、application.aggregates package、ActorRef/Behavior imports、Protocol.Command import | writer 头由共享 owner；Impl package/import 改按 T1/T2；typed Command 来源交协议 owner |
| L7–9 | companion `Handle(String, ActorRef[Command])` | raw A 无此构造；若 D1 保留 local contract，Handle 仍由对应 local port 拥有，不能删除/换成 EntityRef alias |
| L10–13 | `final class ...[K]`，identity→behavior→spawn 三个函数参数，AutoCloseable，局部 Handle import；三函数非 null require | A 改为单一 ClusterSharding DI；这些 callback 的资源所有权不是可保真移除的排版；需另保 local 实现职责 |
| L14–16 | mutable maps 初始化为空；closed=false | local cache 私有状态；不搬进 domain，不在 sharding Impl 复制一份多余缓存 |
| L17–20 | synchronized；拒绝 closed；getOrElseUpdate 命中返回已有 Handle，miss 才调用 identity | 不可声称等同 sharding.entityRefFor；重复 key 的 identity/spawn 调用次数属于 local 行为合同 |
| L21–26 | PID 非 null/nonempty；冲突 PID 拒绝；先 `behavior(id,pid)` 再 `spawn(pid,...)`，ref 非 null 后写 identities，再 Handle | `.toString` sharding entity ID 不等于已持久化 PID；拒绝次序与异常前/后占有关系不可在迁移中丢失 |
| L27–29 | getOrElseUpdate 完成 handles 写入；close 在锁内先 closed=true、再 clear 两张 map | close 没有 stop Actor/System。不得添加“会停止 Actor”或删除 lifecycle 义务 |
| L30 | class 结束，无其他成员 | raw A 本身不实现 AutoCloseable，必须在 D1 解释谁继续持有/释放原资源 |

只在冻结的 `actual-js/app/example/bankwealth` 和 `scala-cqrs-play-service` 源范围搜索了 `Repository[K]`、`new ...Repository`、`Repository.Handle`、`repository.get/close`；命中仓储定义和另外的 JDBC projection repository，没有得到本地 aggregate repository 的具体业务调用点。**这个有限范围的未命中不是整个应用无人使用的证明**，尤其外置手写源码不在这次读取范围。退役须补确切调用方清单，不能以此删文件。

### 4.2 legacy：已有近似 sharding emitter，但未接入 formal

[repository-dsl/generator.json](../baseline/js/generators/repository-dsl/generator.json#L1) 声明 `entrypoint: emit.mjs`，其 [parse.mjs](../baseline/js/generators/repository-dsl/parse.mjs#L1) 仅复制 binding 文本。真实可调用方式是 [emit L6–13][LEG] 的 `node emit.mjs <spec.json> <out-dir>`，顶层读 JSON 并写文件。

不能将该 manifest 直接当公开 `generate-products` producer：注册列表 [CLI L94–100][CLI] 不含它；旧 `generate` [bin L259–278](../baseline/js/bin/truthsrc.js#L259) 进入 [src/core/generate.mjs L23–42][APPLY]，要求 `generate.mjs` 导出的 `generate(ctx)`，不是 manifest 中 `emit.mjs` 的直接执行模型。这里确定的是“不在所读两条现代调用链中”，不臆断历史外部脚本全部不可用。

| 位置 | legacy 的精确规则 | 对应差距 |
|---|---|---|
| L20–38 | package 默认 `net.imadz.infrastructure.repositories`；trait/impl 缺省均 `${pkg}.aggregate`；有 projectRoot 则按包路径，否则两文件落 outDir；name 直接拼 Repository/Impl/CommandFamily；aggregatePackage 默认 `net.imadz.application.aggregates` | 显式包配置可接近 BC；默认 port 分层仍错；没有 TypeRef/naming 输入模型 |
| L39–93 | 同文件生成 port；traitStamp truthy 时选历史 variant，正则 `66b5b602` 控制 release/聚合知识注释；该 variant 有重复 ImplementedBy import。默认 variant 有 entityRef 并遍历 methods | 是历史兼容分支，不是当前 raw golden；port 属另一制品，不由本项顺便重写 |
| L95–98 | `spec.methods || []` 按序发每个 override；参数是原始 `m.params` 字符串；返回固定包裹 `EntityRef[m.returnType]`；ID 用 `m.idParam || 'id'`；都 `.toString` | 不等 raw 返回 TypeRef.signature，也不去掉声明的 entityRef，可能与合成项重复；raw 没有 `params` 任意源码槽，不扩大债务 |
| L100–122 | 固定伪历史头 CodegenMain:225ed28b + release 1.0.0；impl 包；ClusterSharding、EntityRef、Inject、Singleton、Aggregate、Protocol.CommandFamily、port imports；Scaladoc；Singleton class/Inject(sharding)；entityRef 首位调用 `<name>Aggregate.entityTypeKey`；随后 methodBlocks | 结构最近的近似 renderer，可提炼 sharding 构造，但不复制硬编码来源头/字符串型参数模型 |
| L124–127、186 | 同时 writeFileSync port、impl；kind==='projection' 才切 projection，否则均 aggregate | 不经过正式 ownership/ledger/anchor writer；不得在新入口以子进程运行该脚本绕过唯一 apply |
| L129–184 | projection 路有 MANUAL/`???` | 明确不属本项；保留事实，不能因为当前 aggregate 路无 stub 就声称此 emitter 所有输出完整 |

### 4.3 family2：Model/Template 分离存在，合同仍不是 sharding

真实路线为 [CLI L97–98][CLI] 的 `generateAggregateCore` → [generate.mjs L11–23](../baseline/js/generators/scala-cqrs-aggregate-core-v1/generate.mjs#L11) 的 `scala-cqrs-aggregate-core@1` / producer `aggregate-core` → [buildModels L18–27、50–75、102–138、221–247][FB] → [productionJobs L15–24](../baseline/js/generators/scala-cqrs-aggregate-core-v1/render.mjs#L15) 的 `repositoryImplementation` → [repositoryImplementationTemplate L11–20][FAM]。formal Play Service 的已读 registry 没有调用这个 renderer，不能混为同一路修复。

family2 所读模型要求 products 版本 `reference-layout@1/exact-value-types@1/domain-decision@4/domain-dependencies@6/domain-folds@6/domain-external-events@2/exact-value-codecs@1`；buildModels 明确拒绝 external producers。这不是任意银行输入的无条件替代方案。

| 模型/模板区域 | 已观测字段、推导和完整构造规则 | 与 raw 的不同 |
|---|---|---|
| FB L26–27 | repository role `actor-repository`，application.aggregates，后缀 ActorRepository；implementation role `local-actor-repository`，kind actor-repository-implementation，infrastructure.repositories，前缀 Local、后缀 ActorRepository，module glue | 有分离，但缺 `.repository` / `.aggregate` 细包；名字及泛型 API 不同 |
| FB L91–118、136–138 | 显式 name override 角色检查、保留字/portable 冲突；resolveNameSet(MODULAR_CANDIDATE)；artifact 保存 ref/role/kind/module/name/identifier/package/fqn/path/sources/refs/directDeps | 可复用结构身份与碰撞机制；不是以 `content` 代替 Model |
| FB L221–247 | 实现 directDeps = port + actorProtocol；来源 = base.source；全计划校验路径冲突、deps 实际存在、kernel 不依赖 glue；返回 targetData | sharding A 还需 Aggregate/key 与 port 的依赖，不能只改输出 import 忘改 deps |
| FAM L3–9 | port trait `[K] { def get(key:K): Repository.Handle; def close():Unit }`；companion Handle 两字段依次为 PersistenceId、ActorRef[ActorProtocol.Command] | 不是 EntityRef 接口；PersistenceId 名义类型不能扁平换 String |
| FAM L11–19 imports | `importsFor` 依组提供 ActorRef/Behavior、PersistenceId、actor/port、port.Handle，保留 K/A | [importsFor L3–21](../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/imports.mjs#L3) 同名冲突用 `_root_.FQN`，同包组合 braces，否则逐项；不等 raw sorted 单 import 规则 |
| FAM L19 构造 | `final class <Local>[K](identity:K=>PersistenceId, behavior:(K,PersistenceId)=>Behavior[Command], spawn:(K,PersistenceId,Behavior[Command])=>ActorRef[Command]) extends Port[K]`；三个独立非 null require | local actor 生命周期能力，不能静默退役 |
| FAM L19 状态 | `private var handles = Map.empty[K,Handle]`、`pidOwners = Map.empty[String,K]`、`closed=false`、`inOperation=false` | 与 formal mutable Map 不同；不能用“同样缓存”忽略重入屏障 |
| FAM L19 serialized | `private def serialized[A](body: => A): A = synchronized`；inOperation 则抛 IllegalStateException；置 true；`try body finally inOperation=false` | by-name 泛型控制流及 finally 必须保留，不以去锁降 CC |
| FAM L19 get | serialized 内先拒绝 closed，再 require key 非 null；handles.get match Some→原 Handle / None→identity；pid 非 null、pid.id 非 null/trim 非空；pidOwners 存在则抛；behavior 后 require 非 null；spawn 后 require 非 null；构造 Handle；依次更新 handles、pidOwners；返回 handle | 全部 callback 成功才登记所有权；各异常、调用次数和可重试状态不能用 sharding 假等价覆盖 |
| FAM L19 close | serialized；若尚未 closed，先置 true，再两张 Map 置空；注释 ActorSystem 和已交付 ActorRefs 属 caller | 没有停止 Actor；再次 close 不重复清表；重入时依 serialized 拒绝 |
| FAM 尾部 | 结束 class，out.append 内容并关联 `[a.source]` | 来源 mapping/writer 可复用；没有 @Singleton、@Inject、EntityRef 或 entityRefFor |

## 5. approved-target 与真实 minus/plus

### 5.1 本项已确定的目标及有限偏差

目标的 classic-sharding 分支默认复刻 B/T：application port 与 infrastructure Impl 分离，`@Singleton class`、注入 ClusterSharding、合成 entityRef 首位、明确 QueryMethod 顺序，方法直接委托 `entityRefFor`。方法不接收业务 command，不创造回复、更不构造领域事件。

raw → approved-target 仅可先确定：

1. impl 的原 package 已符合三层要求，不额外插入 `.persistence`；port 必须 `.application.aggregates.repository`。
2. 长 class/参数按行排版，保留 class/annotation/构造参数/父类型和 RHS，不把 class 改 case class/final 以追随另一路。
3. source 名由统一 naming 解析，稳定 ID 不改；imports 保留 raw 的明确规则，碰撞或泛型损失需要 D2/D3 的有限修正，不在 renderer 中正则洗代码。
4. `entityTypeKey` 未使用字段、仅首参数、参数 `.name`、TypeResolver `???`/Any 回退分别记录；没有批准以 fake success 修补。

**D1 sharding profile 获准、D3 的 Protocol/port/Aggregate key 接口固定之后**，对 `base=example.bankwealth`、repository/aggregate base 均为 `CreditBalance`、无附加 query 的纸面目标完整正文如下。它不是银行现有输出，也不是本轮运行 raw 得到的文件；不存在新鲜同输入 raw/target 对账证据。

目标路径为 `app/example/bankwealth/infrastructure/repositories/aggregate/CreditBalanceRepositoryImpl.scala`（single），或 `modules/glue/src/main/scala/example/bankwealth/infrastructure/repositories/aggregate/CreditBalanceRepositoryImpl.scala`（multi）。来源头由 writer 单独负责，这里不伪造生成器版本。

```scala
package example.bankwealth.infrastructure.repositories.aggregate

import akka.cluster.sharding.typed.scaladsl.ClusterSharding
import akka.cluster.sharding.typed.scaladsl.EntityRef
import example.bankwealth.application.aggregates.CreditBalanceAggregate
import example.bankwealth.application.aggregates.CreditBalanceProtocol.CreditBalanceCommandFamily
import example.bankwealth.application.aggregates.repository.CreditBalanceRepository
import javax.inject.Inject
import javax.inject.Singleton

/**
 * CreditBalanceRepositoryImpl: Aggregate Repository Implementation
 * Implementation of CreditBalanceRepository interface
 */
@Singleton
class CreditBalanceRepositoryImpl @Inject() (
    sharding: ClusterSharding
) extends CreditBalanceRepository {

  override def entityRef(id: String): EntityRef[CreditBalanceCommandFamily] =
    sharding.entityRefFor(CreditBalanceAggregate.entityTypeKey, id.toString)

}
```

以上模型的 **raw 纸面展开**与这段正文的唯一区别是 class 头按 T5 单行发射：

```diff
 @Singleton
-class CreditBalanceRepositoryImpl @Inject() (sharding: ClusterSharding) extends CreditBalanceRepository {
+class CreditBalanceRepositoryImpl @Inject() (
+    sharding: ClusterSharding
+) extends CreditBalanceRepository {
 
   override def entityRef(id: String): EntityRef[CreditBalanceCommandFamily] =
     sharding.entityRefFor(CreditBalanceAggregate.entityTypeKey, id.toString)
```

这是同一纸面模型的 raw 格式与目标格式对照，不冒充生成执行。任何额外 query 均按 T6 完整循环展开，不能从该单方法示例推断默认查询语义。

### 5.2 actual-js → 条件 classic 目标的完整内容差异

minus 精确取自 [实际银行 CreditBalanceRepository L2–30][ACT]；plus 是 §5.1 的明确条件目标。来源头不在 hunk 内，另由 writer 的有限头部规则处理。**改变的是 repository contract，不是可直接应用到生产的补丁**；删除的 local 生命周期构造仍须按 §4.1/D1 分配，不意味着授权丢掉它们。

```diff
--- actual-js/app/example/bankwealth/application/aggregates/CreditBalanceRepository.scala
+++ approved-target/app/example/bankwealth/infrastructure/repositories/aggregate/CreditBalanceRepositoryImpl.scala
@@ -2,29 +1,23 @@
-package example.bankwealth.application.aggregates
+package example.bankwealth.infrastructure.repositories.aggregate
 
-import akka.actor.typed.{ActorRef, Behavior}
-import CreditBalanceProtocol.Command
+import akka.cluster.sharding.typed.scaladsl.ClusterSharding
+import akka.cluster.sharding.typed.scaladsl.EntityRef
+import example.bankwealth.application.aggregates.CreditBalanceAggregate
+import example.bankwealth.application.aggregates.CreditBalanceProtocol.CreditBalanceCommandFamily
+import example.bankwealth.application.aggregates.repository.CreditBalanceRepository
+import javax.inject.Inject
+import javax.inject.Singleton
 
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
+/**
+ * CreditBalanceRepositoryImpl: Aggregate Repository Implementation
+ * Implementation of CreditBalanceRepository interface
+ */
+@Singleton
+class CreditBalanceRepositoryImpl @Inject() (
+    sharding: ClusterSharding
+) extends CreditBalanceRepository {
+
+  override def entityRef(id: String): EntityRef[CreditBalanceCommandFamily] =
+    sharding.entityRefFor(CreditBalanceAggregate.entityTypeKey, id.toString)
+
 }
```

## 6. 胶水与语义保护面

| 完整符号/来源 | 本项需要的 API/能力 | 证据和未决边界 |
|---|---|---|
| `akka.cluster.sharding.typed.scaladsl.ClusterSharding` | 注入一个已由 bootstrap 管理的实例；使用 `entityRefFor`，输入 key 与字符串 entityId，结果为匹配命令族的 EntityRef | raw T 的真实调用；本次未读取 Akka JAR，不能声称实际解析的 overload/二进制供给已验证 |
| `akka.cluster.sharding.typed.scaladsl.EntityRef[T]` / `EntityTypeKey[T]` | `T` 必须与 Aggregate key、port、Protocol 命令族一致；调用形状为 `sharding.entityRefFor(Aggregate.entityTypeKey, id.toString)` | EntityRef 是 sharding 引用，不是 `ActorRef` 的源码 alias；本项不造 key、不注册 sharding、不创建 ActorSystem |
| `javax.inject.Inject` / `javax.inject.Singleton` | 构造器注入和 scope 注解 | [GeneratorContext L73–109](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L73) 是名字映射，不证明注入配置和运行依赖已存在 |
| `<base>.application.aggregates.repository.<Repo>Repository` | 与 Impl 精确一致的 `entityRef` 及附加 query 签名；可能由 port 的 ImplementedBy 装配 | 交 `aggregate-repository-port` owner；不能在 Impl 文件再写一个不同 trait 来凑编译 |
| `<base>.application.aggregates.<Agg>Aggregate.entityTypeKey` / `<Agg>Protocol.<AggBase>CommandFamily` | 真实定义、可访问类型、准确 owner | D3 同时约束 aggregate-root/application-protocol/bootstrap；不得用 `Any` 或虚构 alias 兼容 |
| `net.imadz.common.CommonTypes.Id`（仅 curated） | `type Id = java.util.UUID`；curated `userId.toString` | [CommonTypes L7–9](../baseline/common/src/main/scala/net/imadz/common/CommonTypes.scala#L7) 只说明源码 alias；不把所有 ID 强制迁 UUID；raw 合成参数是 String |
| local 的 `akka.actor.typed.ActorRef` / `Behavior`；family 的 `akka.persistence.typed.PersistenceId` | cache callbacks、typed Handle、caller-owned 生命周期 | D1 保留原能力或另立明确 local 实现；不得把 PID 重算为新 key、字符串格式或生成名称 |

供给坐标可从 [BC scaffold/build.sbt L10–38、72–80](../baseline/bc/scaffold/build.sbt#L10) 确认声明为 `com.typesafe.akka:akka-cluster-sharding-typed_2.13:2.6.20`，并有 Play `guice`、`clusterSharding` 依赖；JS formal [generate.mjs L45–50][JGEN] 也固定 Akka overrides 2.6.20 / Play 2.8.18。`javax.inject` 的最终解析版本、银行目标实际 JAR 集、bootstrap 可注入绑定本次未读取，不能借 sibling 源码存在证明消费可用。缺供给就阻断本项，不 `publishLocal`、不下载、不重发 runtime。

本仓储仅定位引用。它不应该拥有 CommandHelper 或业务回复逻辑。依赖闭包仍须遵守已批准规则：CommandHelper 在 `application.aggregates.behaviors`，有 `toParam/createFailureReply/createSuccessReply`；仅具有明确回复合同的 application Actor commands 追加 typed replyTo，domain param/event 不带 ActorRef；失败不 persist，成功 persist/apply 后 thenReply 使用更新 state；`replyWith` 不等于增加发布的 `replyWithAndPublish`。这些不是本 Impl 方法额外生成的行为，也不能由本项宣称已验。

PB 字段号/包与 wire 身份、PID、serializer ID/manifest/绑定范围、业务名义类型和 overflow 语义全部保护。本项没有金额运算，无须也不允许以 `addExact → +`、合并事件/名义类型来简化依赖。

## 7. 拟实施写集合、共享依赖与唯一组装 owner

以下都是**第二阶段拟写**，本次未创建/修改。路径相对 JS 仓库 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc`；不是对当前两文件写边界的扩张。

| 路径 | 处置/职责 | owner 与冲突 |
|---|---|---|
| `generators/scala-cqrs-play-service/models/aggregate-repository-implementation.mjs`（proposed） | 定义 M1–M7、S1–S4 的显式结构及 raw 支持域；没有全文件 content/body 通用逃生槽 | 本制品 owner，待公共 TypeRef API 冻结 |
| `generators/scala-cqrs-play-service/build-aggregate-repository-implementation.mjs`（proposed） | 从获准 repository contract 构建模型、合成 entityRef、解析 query、收集类型/文件 deps、关联 aggregate 来源；不碰写盘 | 本制品 owner；D1/D2/D4 阻断 |
| `generators/scala-cqrs-play-service/templates/aggregate-repository-implementation.mjs`（proposed） | classic-sharding 完整文件唯一内容 assembler：T0 外包 writer，其余 T1–T7 由本模板一次输出 | **同一 Impl 物理文件唯一 assembly owner = 本制品 owner**；不能同时让 port/legacy/family renderer 写同一目标 |
| `generators/scala-cqrs-play-service/templates/aggregate-repository.mjs` | 当前复合 local 输出拆分/退役的入口；D1 决定是否保留独立 local template | 共享切分由集成者先做；本项不直接删 Handle/get/close |
| `generators/scala-cqrs-play-service/build-aggregate-models.mjs`、`aggregate-names.mjs`、`render-aggregate-layers.mjs` | 扩展新模型调用、port/impl 路径、依赖；从已确定接缝接入新 template，移走旧复合文件生成职责 | 共享 aggregate 组装 owner = 集成者，避免与 port/factory/protocol 并发冲突 |
| `generators/scala-cqrs-play-service/generate.mjs`、`generator.json`；`lib/products/generate-cli.mjs` | profile/producer/declared kinds 与显式选择注册；当前 CLI 不加虚构 flags | 集成者独占；新 profile 名和是否扩展现有 producer 由 D4 决定 |
| `generators/repository-dsl/emit.mjs` | 只可作为 legacy sharding 构造参考；不直接在正式入口启动其 writeFileSync；默认不修改/复活旧入口 | legacy owner 与集成者确认兼容范围后才另批变化 |
| `generators/scala-cqrs-aggregate-core-v1/templates/repository.mjs`、`build-models.mjs`、`render.mjs` | local family 接口保留；必要布局适配单独做，不能以本项 classic A 名义无条件改为 sharding | family owner；共享 template 同时发 port 与 Impl，先分职责再实施 |
| `lib/scala-target/naming.mjs`、`profiles.mjs`、`model.mjs`；`src/core/product-plan.mjs`、`generate.mjs` | 共享 naming/TypeRef/layout、final bytes、deps、plan/apply；本项提需求不发明替代框架 | shared-layout-types / shared-entry-writer owner = 集成者 |

复用接口按 [naming.mjs L77–118](../baseline/js/lib/scala-target/naming.mjs#L77) 的 `resolveName/resolveNameSet/resolveArtifactPath`，完整 binding 不再追加 suffix，冗余 affix 会拒绝而非自动修剪。Family `importsFor` 的 collision 处理可提供需求依据，但它不是 raw import 排序的直接替身。正式 `entry`/`applyEntries` 和 family 的 `out.append`/renderJobs 各保持唯一写入口；二者 source mapping 适配由共享 owner 固定。

依赖工作包：`shared-layout-types`、`shared-entry-writer`、`shared-source-mappings`、`aggregate-repository-port`、`aggregate-root`、`application-protocol`、`aggregate-factory`、`bootstrap`。CommandHelper/behavior 属必要行为闭包，不应被 repository 顺便实现。

迁移次序：先确定 contract/profile → 冻结 port/protocol/key 符号 → 生成文件旧→新路径和所有构造去向 → 同步调用方/DI/bootstrap/构建源根 → 由唯一组装者生成完整新 plan → 校验最终 bytes 与 deps → 最后计算 fingerprint/anchor。新候选不得覆盖银行 current 或共享应用。旧 apply [L187–190][APPLY] 对 owned、未再计划的文件报告 RETAINED，不自动删除；退役必须另有 ownership 核验和引用迁移，不手改 ledger/anchor，也不留旧 domain/application 转发壳伪装迁移完成。

## 8. fixture、公开 CLI 形状和验收边界

### 8.1 后续 fixture 清单（proposed，当前均未创建/执行）

fixture 根拟为 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/aggregate-repository-implementation/`；是获准输入的比较资产，不是第二业务真源。

| fixture | 完整要点 / 要观察的结果 |
|---|---|
| F1 classic-minimal | 一个 CreditBalance repository metadata，空 methods；同一语义经 BC metadata/JS contract 适配；验证合成 entityRef、精确 family/key/import/class/路径。没有同输入输出前不得把 §5 升格成 gold |
| F2 single-query | 一个显式 query，参数为具名 ID、返回准确 `EntityRef[对应命令族]`；保留 query 排序、.toString；curated 文件只作 API 参考，不推导未给的业务实现 |
| F3 input edges | QueryMethod 零参、多参、声明同名 entityRef（含零参）、非 QueryMethod、重复 query 名、非 EntityRef 返回、泛型参数、optional 参数；记录 raw head/丢参/忽略 logic 与目标拒绝或扩展的具体裁决，不让不合法 query 默认跑 sharding |
| F4 names/types/source | repository 名与 aggregate 名不同、aggregate 已有 Aggregate 后缀、同名类型冲突、嵌套命令族、noteId 有/无、scope 排除；核对 port/impl family 一致与文件/成员映射；不合并名义类型 |
| F5 local-preservation | formal/family 分别覆盖同 key 缓存、不同 key 同 PID、callback 异常、close 后 get；family 另测 null key/behavior、trim 空 PID、重入与 finally 复位；只在 D1 保留 local 分支时验，不能冒充 classic fixture |
| F6 physical-layout | F1 分别 single 与 multi 完整输出集合；Impl 在 glue、port 所属物理模块依批准 profile；禁止将 sourceRoot 差异压掉比较 |

每次只用该 fixture 的聚合依赖闭包，不全跑银行。F1 之外的 sharding query 输入支持范围必须先定 D2；不编造“默认 findById 实现”。

### 8.2 已存在 CLI 的准确命令形状（仅规格，禁止本轮执行）

JS 现有 formal 入口只有明确四路径参数和可选 `--plan`，见 [generateProductCli L66–88][CLI]。以下 fixture/options/out 都是拟定的新绝对路径，文件内容和新 sharding profile 接入尚未获准；**按当前 producer 实际运行仍生成 local cache，不会因为目标目录叫 parity 就变为 classic**。

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/aggregate-repository-implementation/request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-play-service \
  --out /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/.parity-candidates/aggregate-repository-implementation/js-single \
  --options-json /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/aggregate-repository-implementation/options.json \
  --plan
```

- `--plan` 捕获 request、options、manifest，内存编译 products 并规划；此 CLI 分支不调用 apply，也**不等于** `previewEntries` 的磁盘覆盖预检。读取本地运行库 pin 和 externalSourceRoots 的校验仍发生，[generate-cli L114–139][CLI] 不能省略。
- 后续批准真实生成时以相同四路径去掉 `--plan`，不是加不存在的 `--artifact`/`--dry-run`。请求本身限一个聚合及依赖；producer 还会产生 build/config/test 等声明输出，所以不是只写一个 Scala 文件的命令。
- [applyEntries L246–267][APPLY] 会 mkdir、写全部 accepted 目标、`truthsrc.ledger.json`、`anchors.json`；回锚可能文件级 fallback。所读公开 generate-products 链没有启动服务/下载/外部生成子进程的调用；不据此推广到 generate-project 或自定义历史 emitter。
- family2 比较仍使用这个四参数 CLI，但 `--generator` 换为绝对目录 `.../generators/scala-cqrs-aggregate-core-v1`，配 family 的 request/options 与独立 out；它是 local 合同比较，不是 classic 验收。legacy emitter 不作为目标验收入口。

BC 传统文件输入形状来自 [CodegenMain L62–81、175–253](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L62)。下面在 `/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen` 作为执行目录的后续批次使用；所有文件均为拟定 fixture，尚未证明 formal adapter 能表达 D2 的每个输入，D4 必须先补这份映射。显式 systemFile/systemBindings 是 system 输入选择，不混用 `codegen.system` 或默认 Examples。

```bash
sbt \
  -Dcodegen.systemFile=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/aggregate-repository-implementation/bc-canonical.json \
  -Dcodegen.systemBindings=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/aggregate-repository-implementation/bc-bindings.json \
  -Dcodegen.targetDir=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/.parity-candidates/aggregate-repository-implementation/bc-single \
  -Dcodegen.multiProject=false \
  -Dcodegen.ledger=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/.parity-candidates/aggregate-repository-implementation/bc-ledger.json \
  "runMain net.imadz.codegen.CodegenMain"
```

BC 没有本项专用 raw CLI flag。范围通过仅含该聚合闭包的 fixture 限定；该命令仍启动 sbt/JVM、可能编译并解析/下载依赖、写 sbt/cache/target、复制 scaffold、生成关联源码/proto/routes/bootstrap、flush ledger、写 release manifest，有 formal semantics 时写 `formal-semantics.json`；不是只写 Impl，也不是只读。多工程单独 `codegen.multiProject=true` 与新 target。必须由集成者先批准实际依赖供给、所有写面/时限，不能在本轮执行、不能默认写 banking-app/ingested-app。

### 8.3 验收义务（全部 `not-run`）

1. **同输入完整文件对账**：双端输入适配列出 repository name、aggregate ref、每个 query 顺序/全参数/返回/logic/来源；比较 raw、有限偏差后的 target、actual-js；整文件包括头部规则、package、imports、空行、注解、class、每个方法/body 和路径。只白名单明确来源头/已批准换行差异，不使用压平所有空白的 normalize。
2. **construct/RHS 核查**：逐 M/B/T 行及 §4 local 构造去向；泛型/可选/零参/多参不能漏；未支持输入明确诊断，不以 fake success 补齐。
3. **真实接口/行为**：后续受限 sharding fixture 观察 entityRef 的类型与 key/entityId 对应，repository 不直接持久化、回复或发布；同/不同 ID 的定位与 query adapter 合同正确。local 保留分支按 F5 独立验。CommandHelper 的失败/新 state reply/无意外 publish 测试由依赖闭包共用，不能仅凭这个单行 RHS 签收。
4. **命名/layout/复杂度**：普通方法 CC 目标 ≤5，6–10 逐方法解释，>10 先重构/单独批准；JS Builder 与 Scala 产物都计。工具/版本/语法口径未定，当前 `not-measured`。不以 String/Any dispatcher、删锁/删校验、全项目平均数刷分。
5. **稳定生成与回锚**：同输入两次完整产物稳定；一个 query 参数/来源变更只产生合理局部 diff；final bytes 后再 fingerprint/span；公开 query 能定位新文件及已提供成员映射，文件级 fallback 单列。旧路径 RETAINED 不能算迁移完成。
6. **资源/预算**：后续生成与内容比较初始调度预算 5 分钟，局部编译/行为闭包 15 分钟；不是已测性能或测试命令承诺。当前没有已定位且证明专测本契约的 suite/runner，因此不虚构 `testOnly` 类名；D6 决定离线真实验证命令后再运行，超时返回已得证据不扩成全银行验收。

## 9. 精确未决项

| ID | 必须裁定的内容/API | 阻断什么；当前可交付什么 |
|---|---|---|
| D1 | formal 银行/现有 local profile 是否继续保留 caller-owned actor cache，并另增显式 classic-sharding profile，还是有独立授权迁移到 ClusterSharding？若保留 local，其 Handle/get/close/callback/异常/重入能力由哪个明确实现拥有，旧路径如何退役？ | 阻断直接将 §5 diff 应用于银行；经典目标内容和 local 去向账已交付，不擅选部署模型 |
| D2 | QueryMethod 支持域如何处理零参、多参、optional、泛型参数、非 EntityRef 返回、logic、重复/同名 entityRef，以及 TypeResolver 的 `???`/Any fallback？选择受限明确拒绝还是经批准扩展模型/模板，并与 port 全参数合同一致。 | 阻断通用 query 实施；无附加 query 的 T6 结构仍明确。不得直接沿用 raw 缺陷并声称语义正确 |
| D3 | port/Impl 合成命令族命名来源统一为何？Aggregate 暴露的准确 selector 是 `.entityTypeKey` 还是历史命名 key？保留 raw unused entityTypeKey 字段还是经批准结构化替换？ | 阻断 key/Protocol/API 连线；不改变 key 的稳定值、PID 或 serializer 身份 |
| D4 | 新经典 profile 的注册 ID、single/multi 物理根、repository metadata/query 的公开输入绑定在哪里？如何从同一 fixture 映射 BC formal/registry 输入和 JS product，且不发明公共业务 schema？ | 阻断真实同输入生成；现有 CLI 形状与 side effects 已定位。family2 有模板不等 formal 已接入 |
| D5 | 实际供给中的 Akka 2.6.20 sharding typed JAR、javax.inject 解析版本及 ClusterSharding DI/bootstrap 初始化接口能否满足精确类型？外置调用方是否依赖当前 Handle/get/close？ | 阻断声称可编译/可运行与旧输出删除；不下载、不发布、不借源码存在作证 |
| D6 | 本项受限真实 sharding/local fixture 的 runner、准确命令、离线供给、资源/停止点与 CC 工具口径；MANUAL/文件级 fallback 的成员回锚如何验收？ | 阻断行为/复杂度/稳定回锚通过结论；当前保留 not-run / not-measured，不造 suite 或通过记录 |

本文完成的是一个可复核的独立制品内容规格，不是 implementation、ready、parity-PASS 或 behavior-PASS；其他制品阻断不妨碍保存本项观察及裁决请求。

[M]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/infrastructure/repository/AggregateRepositoryImplModel.scala#L1
[B]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/repository/AggregateRepositoryImplBuilder.scala#L1
[T]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/repository/AggregateRepositoryImplTemplate.scala#L1
[TYPE]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4
[LAYOUT]: ../baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala#L88
[DISPATCH]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L786
[WRITER]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L331
[JT]: ../baseline/js/generators/scala-cqrs-play-service/templates/aggregate-repository.mjs#L1
[JB]: ../baseline/js/generators/scala-cqrs-play-service/build-aggregate-models.mjs#L4
[JN]: ../baseline/js/generators/scala-cqrs-play-service/aggregate-names.mjs#L6
[JLAYER]: ../baseline/js/generators/scala-cqrs-play-service/render-aggregate-layers.mjs#L1
[JGEN]: ../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L16
[CLI]: ../baseline/js/lib/products/generate-cli.mjs#L66
[APPLY]: ../baseline/js/src/core/generate.mjs#L1
[LEG]: ../baseline/js/generators/repository-dsl/emit.mjs#L1
[FAM]: ../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/repository.mjs#L1
[FB]: ../baseline/js/generators/scala-cqrs-aggregate-core-v1/build-models.mjs#L18
[ACT]: ../baseline/actual-js/app/example/bankwealth/application/aggregates/CreditBalanceRepository.scala#L1
[ACT-F]: ../baseline/actual-js/app/example/bankwealth/application/aggregates/FundOrderRepository.scala#L1
[ACT-S]: ../baseline/actual-js/app/example/bankwealth/application/aggregates/SipPlanRepository.scala#L1
[CUR]: ../baseline/curated-scala/net/imadz/infrastructure/repositories/aggregate/CreditBalanceRepositoryImpl.scala#L1
