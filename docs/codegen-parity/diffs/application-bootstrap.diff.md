# application-bootstrap：应用总装配的内容级差异规格

## 1. 范围、证据等级与状态

- Artifact ID / detail group：`application-bootstrap`，传统清单 ordinal **39**。本文不接管 ordinal 38 的四种 `BootstrapTemplate` 产物。
- 状态：**`decision-required`**。传统总装配的字段、推导和发射合同已记录；formal 银行链路同路径的产物实际是 Play composition loader，不是传统 Guice 总装配。其必要行为不能直接删掉，且当前银行单聚合 bootstrap 是 object factory，不是可 mixin 的 sharding trait。接线、生命周期及输入映射需要裁定。
- 固定 BC HEAD：`cc335eb1e0d0fae17bf092fd61b126040196ea70`；固定 JS HEAD：`bf104e16ab82ef39d7fa416d0997907d18a815ad`。源字节身份以 [baseline/index.json](../baseline/index.json) 为准，不以 HEAD 推断工作副本内容。
- 权威计划：[APPROVED-PLAN.md](../../../.rounds/prettify-generated-code-resume-20261115-cgr9lzlk/APPROVED-PLAN.md#L104-L146)；遵循 [作者合同](../AUTHORING-CONTRACT.md) 和 [布局标准](../layout-and-style.md)。仅文档交付，不等于生成器实施批准。
- 本次读取了完整的本族 Model / Builder / Template，并读取冻结的真实银行输出、人工参考、formal / legacy / family 接线和必要支撑。本次没有生成同输入产物，没有执行测试、typecheck、编译、运行、服务、下载或 Git 写入；复杂度为 **`not-measured`**。
- 只写本文和 `details/application-bootstrap.json`；未写此前 15 份 diff 或任何其他分组文件。没有修改 baseline、生产源码、truth、生成应用、catalog、ledger 或 anchors。

### 1.1 四种材料不能互换

| 材料 | 可取得的完整内容 | 能说明什么 / 不能说明什么 |
|---|---|---|
| `raw-scala` | [M 全文][M]、[B 全文][B]、[T 全文][T]；下文也直接收录全文 | 是真实传统源代码，不是本轮运行生成的 Scala 文件。没有 fresh raw output 可供字节比较。 |
| `approved-target` | §6 的完整最小切片源码 + §3–5 的逐构造规则 + 有限覆盖项 | 继承传统 MBT、三层、正常 imports 和可读排版要求；具体全银行装配及 D1–D9 未决部分没有虚构完整可运行目标。 |
| `actual-js` | [银行 ApplicationBootstrap.scala 全文][BANK]；§5.1 直接收录 | 是 `generated/current` 的已有输出快照。不是同输入 fresh JS output；头上的 `scala-cqrs-domain:1` 不能代替调用链判断。 |
| curated reference | [人工 ApplicationBootstrap.scala 全文][GOLD]、[BootstrapModule.scala][GMOD] | 人工补全参考，不是 raw 模板执行结果，也不是银行产物。其初始化顺序、字段名及 scheduler 与 raw 有差别，单独对账。 |

本文所有 actual-js → approved-target 对照均为**结构性对照，非同输入字节比较**。未宣称 parity / behavior 验收通过。

### 1.2 主要冻结文件指纹

下表的 bytes / SHA-256 已对这些副本做只读字节核对，与索引一致。其余引用的冻结文件的原仓路径及指纹见索引；链接均指向不可变副本。

| 固定源 | bytes | SHA-256 |
|---|---:|---|
| [ApplicationBootstrapModel.scala][M] | 1344 | `50577fb1569708125144d23bfec3c1cd27b7476ce34dd1a6487f5a6f62368956` |
| [ApplicationBootstrapBuilder.scala][B] | 5024 | `feb954ccf8c64e51b97c04291f5e6a2a30e6431c3588afa3c678d4a7f2fc9ca4` |
| [ApplicationBootstrapTemplate.scala][T] | 3303 | `532ee3182f6821420ae0eb6c1dd4373aca2b7be7087ebbd306721ae25842946f` |
| [人工 ApplicationBootstrap.scala][GOLD] | 2488 | `a5b23d9f0b8ed9cedbc4c82afe76f63276e8184db808e1caa21c9210b836ba4b` |
| [银行 ApplicationBootstrap.scala][BANK] | 1111 | `387dce03602068da61b54ea63351137716416626779932fc228e47159a2f0a58` |
| [formal render-service.mjs][SERVICE] | 12954 | `c8d92119b3e98dc868ea7bc17b018fef4372f24621206d2d00d1af365de160de` |
| [legacy bootstrap-dsl/emit.mjs][LEGACY] | 14584 | `ec3f06fa358b3ede2e98a660ba485228e09c4de26577db6b1f98fa8bd83dbb3a` |
| [旧 builders/bootstrap.mjs][OLD-B] | 9256 | `3746535e4feb3c866abc5e6fefa1f18962a74352a477ce11fe55bcbe2c393500` |
| [旧 templates/persistence.mjs][OLD-T] | 9426 | `ba8d292e09fcb121fd6b4da9e9e0e58642d9d72b4894534728478f4918fe1f01` |
| [family build-models.mjs][FAM-B] | 9771 | `3588e1ac7cfb6ea5c9f0a180acd4446c9196556bd42a4c87b41e78454b6091e5` |
| [family templates/application.mjs][FAM-T] | 9379 | `646169495ae5016a4bab809a7d85929d9b541a51d3abca4dfcdddcac7a21d095` |
| [family templates/loader.mjs][FAM-L] | 3929 | `abc95ad5d5bf341e6b8931881561c783b5200021d2f0acb8d08a145f1cec0c99` |

## 2. 真实调度、变体、基数与物理路径

### 2.1 传统入口

[CodegenMain.scala:175–201][MAIN] 在没有 `codegen.semanticProductsFile` 时使用 `prepare` 的系统输入，然后复制 scaffold；`semanticProductsFile → generateProducts` 是独立支路，不能拿 products 模板替换本族基准。`prepare:62–81` 允许明确的 `codegen.system` registry 槽，或互斥的一对 `codegen.systemFile` / `codegen.systemBindings`。默认 `Examples` 不等于本次选定输入。

[runCommon:203–220][CQRS-RUN] 先生成各层及 state controller，再调用 `generateBootstraps`。[generateBootstraps:1134–1194][CQRS-BOOT] 先发聚合 / classic saga coordinator / 每 saga / projection 的 bootstrap，最后无条件构造一次 `ApplicationBootstrapBuilder.build(system, ctx, strictEntries)` 并调用本模板。它不是每聚合一个文件。

`writeArtifact` 的 attribution 是 `ArtifactAttribution("bootstrap", "ApplicationBootstrap", "global", Nil)`，不是 ledger kind `application-bootstrap`。在 [writer:359–424][WRITER] 中，scope 可在记录 ledger 后阻止实际写文件；territorial writer 也可能不写。因此这里的“1”指一次正常到达末尾的**计划发射基数**，不是保证实际写出。

| 变体 ID | 精确条件 | 计划构造 / 调用数 | 当前观察状态 |
|---|---|---|---|
| `classic-empty-strict` | `strictEntries` 为空，包括无 strict plan，或 multi-project 将 strict entries 抑制 | 1 个 class 文件；saga 注册 S 次，engine `S>0 ? 1 : 0` 次，aggregate A 次，projection P 次 | 源码存在；本轮未执行 |
| `strict-single` | single-project，admitted strict plan 恰给出 1 个 entry FQN | 同一文件追加 1 个 `strictSagaCoordinator` val 和 1 次 `installEventSource` | 源码存在；formal 银行总装配无该片段 |
| `strict-many` | single-project，strict entry 数 N>1 | 同一文件追加 N 对 val / install；变量 `strictSagaCoordinator0` 到 `strictSagaCoordinator(N-1)` | 源码存在；本轮未执行 |
| `multi-project` | `codegen.multiProject=true` | 仍发总装配，但 `strictEntryFqns=Seq.empty`；不能误读注释为“不发任何 bootstrap” | strict 接线 suppressed；总装配未执行 |
| `empty-traits` | A=0、S=0、P=0；strict entries 本身不贡献 traits | 仍尝试发 1 文件；raw 是 `extends  {`，不是合法的空装配类 | D3：需要拒绝或条件省略 extends 的裁定，不隐瞒 raw 缺陷 |

路径权威是 [PackageLayout:88–95][LAYOUT]、[TypeResolverDSL:1005–1020][RESOLVE-BOOT] 和 [targetModuleOf:331–349 / writer:371–378][WRITER]。

- raw / target 单工程：`<target>/app/<base 路径>/infrastructure/bootstrap/ApplicationBootstrap.scala`。
- raw / target BC multi-project：`<target>/modules/glue/src/main/scala/<base 路径>/infrastructure/bootstrap/ApplicationBootstrap.scala`。本族 kind=`bootstrap` 路由到 glue，不是 root composition 模块。
- 银行现存：`/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/generated/current/app/example/bankwealth/infrastructure/bootstrap/ApplicationBootstrap.scala`，本文只读取其冻结副本。
- §6 单切片的目标阅读路径：`/tmp/codegen-parity-application-bootstrap/js/app/example/bankwealth/infrastructure/bootstrap/ApplicationBootstrap.scala`，**是后续拟用隔离路径，当前未创建**。
- 注入器启动 module 是另一个胶水文件，raw 人工参考在 `<base>.modules.BootstrapModule`；三层覆盖要求迁为 `<base>.infrastructure.bootstrap.BootstrapModule`，单工程路径 `<target>/app/<base 路径>/infrastructure/bootstrap/BootstrapModule.scala`。该 module 不是本模板额外发射的文件。

## 3. raw-scala 完整生产源

以下三个代码块是固定源全文；保留原始缩进、注释、代码字符串槽和未使用 import。目录名 `bootstsrap` 是真实拼写。

### 3.1 Model 全文

来源：[ApplicationBootstrapModel.scala:1–19][M]。

```scala
package net.imadz.codegen.scaffolding.cqrs.model.infrastructure.bootstrap


import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

case class ApplicationBootstrapModel(
                                      override val selfType: TypeRef,
                                      traits: Seq[TypeRef],
                                      initCalls: Seq[String],
                                      injectedFields: Seq[FieldDef],
                                      /** P5: strict fixture entrypoints the bootstrap spawns as cluster
                                        * singletons (independent namespace; the reconcile token comes from
                                        * deployment configuration — no lenient default). Empty = no wiring. */
                                      strictEntries: Seq[String] = Nil,
                                      override val dependencies: Set[TypeRef],
                                      /** S7 #1c（EP §二 G1）：全局装配件·无单一母元素——收录**全部**聚合号
                                        * （装配件声明「此文件涉及哪些知识」；口径见 .codegen-ledger.json 行）。 */
                                      override val noteIds: Seq[String] = Nil
                                    ) extends ArtifactModel
```

### 3.2 Builder 全文

来源：[ApplicationBootstrapBuilder.scala:1–135][B]。

```scala
package net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.bootstrap

import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.bootstrap.ApplicationBootstrapModel
import net.imadz.codegen.scaffolding.cqrs.{
  FieldDef,
  GeneratorContext,
  TypeRef,
  TypeResolver
}
import net.imadz.meta._
import net.imadz.codegen.structure.NamingConventions

object ApplicationBootstrapBuilder {

  def build(
      system: SystemMetadata,
      ctx: GeneratorContext,
      strictEntries: Seq[String] = Nil
  ): ApplicationBootstrapModel = {
    val pkg = ctx.layout.infrastructure.bootstrap
    val selfType = ctx.typeResolver.applicationBootstrap

    val aggregates = system.application.aggregates
    val sagas = system.application.sagas
    val projections = system.infrastructure.projections

    var extraDeps = scala.collection.mutable.Set[TypeRef]()
    var importOnlyDeps = scala.collection.mutable.Set[TypeRef]()
    var initCalls = scala.collection.mutable.Buffer[String]()

    // 1. [v3] Saga Init: per-saga definition registration + engine coordinator sharding.
    //    Participants are pure data (never journaled) — no serialization strategies.
    sagas.foreach { sagaMeta =>
      // SagaDefinition is an object used by the trait's init method — import
      // only, never a Guice-injected constructor param.
      importOnlyDeps += TypeRef(
        s"${sagaMeta.name.replace("SagaTransactor", "")}SagaDefinition",
        ctx.layout.application.services.transactor.root
      )
      initCalls += s"init${sagaMeta.name}(ec, system.scheduler)"
    }
    if (sagas.nonEmpty) {
      val sagaMeta = sagas.head
      // Executor-factory context: built from the first participant's aggregate repo.
      // The context type is referenced inline in the initSagaEngine call — import
      // only; the instance is constructed here, not injected.
      val participantMeta = sagaMeta.participants.head
      val aggName = participantMeta.interactsWith.targetName
      val repoRef = ctx.metaRegistry
        .resolveByName[AggregateRootMetadata](aggName)
        .flatMap(_.repository)
        .getOrElse(throw new IllegalStateException(s"Repo not found"))
      val repoType = ctx.typeResolver.resolve(repoRef)
      extraDeps += repoType
      importOnlyDeps += ctx.typeResolver.sagaContext(
        sagaMeta.context.map(_.name).getOrElse(sagaMeta.name)
      )
      val repoParam = repoType.name.head.toLower + repoType.name.tail
      val contextName =
        sagaMeta.context.map(_.name).getOrElse(s"${sagaMeta.name}Context")
      initCalls += s"initSagaEngine(sharding, $contextName($repoParam), system)"
    }

    // 2. Aggregates Init
    // 2026-08-21 摄入侧适配：调用名与 BootstrapTemplate 的 targetName 一致（<Base>Aggregate）
    aggregates.foreach { meta =>
      val aggName = NamingConventions.aggregateRootName(NamingConventions.getBaseName(meta.name))
      initCalls += s"${NamingConventions.getAggregateInitMethodNameFromAggregateName(aggName)}(sharding)"
    }

    // 3. Projections Init
    projections.foreach { meta =>
      val repoRef = meta.repositoryRef.get
      val repoType = ctx.typeResolver.resolve(repoRef)
      extraDeps += repoType
      val repoParam = repoType.name.head.toLower + repoType.name.tail
      initCalls += s"${NamingConventions.getProjectionInitMethodName(meta.name)}(system, sharding, $repoParam)"
    }

    val frameworkFields = Seq(
      FieldDef("classicSystem", ctx.typeResolver.classicActorSystem),
      FieldDef("sharding", ctx.knownFrameworkTypes("ClusterSharding"))
    )

    val repoFields = extraDeps
      .map { t =>
        FieldDef(t.name.head.toLower + t.name.tail, t)
      }
      .toSeq
      .sortBy(_.name)

    val injectedFields = frameworkFields ++ repoFields

    val frameworkDeps = Set(
      ctx.knownFrameworkTypes("Inject"),
      ctx.knownFrameworkTypes("Singleton"),
      ctx.typeResolver.actorSystem,
      ctx.typeResolver.actorSystemTyped,
      ctx.knownFrameworkTypes("adapter"),
      ctx.typeResolver.executionContext,
      ctx.typeResolver.extendedActorSystem
    )

    val allTraits = (aggregates.map(m =>
      ctx.typeResolver.bootstrap(
        s"${NamingConventions.getAggregateBaseName(m.name)}Bootstrap"
      )
    ) ++
      (if (sagas.nonEmpty)
         Seq(ctx.typeResolver.sagaCoordinatorBootstrap)
       else Nil) ++
      sagas.map(m => ctx.typeResolver.bootstrap(s"${m.name}Bootstrap")) ++
      projections.map(m =>
        ctx.typeResolver.bootstrap(
          NamingConventions.getBootstrapNameFromProjectionName(m.name)
        )
      )).distinct

    // [FIX] 移除了 Context 的依赖，因为不再需要手动构建
    val dependencies =
      (frameworkDeps ++ allTraits ++ extraDeps ++ importOnlyDeps ++ frameworkFields.map(
        _.typeRef
      ))
        .filter(t => t.shouldImport(pkg))

    ApplicationBootstrapModel(
      selfType,
      allTraits,
      initCalls.toSeq,
      injectedFields,
      strictEntries,
      dependencies
    )
  }
}
```

### 3.3 Template 全文

来源：[ApplicationBootstrapTemplate.scala:1–93][T]。

```scala
package net.imadz.codegen.scaffolding.cqrs.template.infrastructure.bootstsrap

import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.bootstrap.ApplicationBootstrapModel
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object ApplicationBootstrapTemplate
    extends CodeTemplate[ApplicationBootstrapModel] {
  def generate(model: ApplicationBootstrapModel): String = {
    import model._

    // 1. 构建包声明
    val pkgDecl = packageDecl(selfType.packageName)

    // 2. 构建导入声明
    val baseImports = dependencies
      .filterNot(_.name == "ActorSystem")
      .map(d => s"${d.packageName}.${d.name}")
      .toSeq
      .sorted
      .distinct

    val akkaImports = Seq(
      "akka.actor.typed.scaladsl.adapter._",
      "akka.actor.ExtendedActorSystem",
      "akka.actor.ActorSystem", // Classic
      "akka.actor.typed.{ActorSystem => TypedActorSystem}",
      "javax.inject.{Inject, Singleton}"
    )

    val importDecl = imports((baseImports ++ akkaImports).distinct: _*)

    // 3. 构建类继承的traits
    val traitsExtends =
      if (model.traits.isEmpty) ""
      else model.traits.map(_.name).mkString(" with ")

    // 4. 构建注入的字段
    val injections = model.injectedFields
      .map(f => s"${f.name}: ${f.typeRef.name}")
      .mkString(",\n  ")

    // 5. 构建初始化块
    val initBlock = model.initCalls.mkString("\n  ")

    // 6. 构建类体
    // P5: strict saga coordinator wiring — one cluster singleton per strict fixture
    // entry; the reconcile token is deployment configuration (missing key fails the
    // start honestly, never a lenient default).
    // P12: the deployment-face event-stream source rides the shared journal — it
    // triggers the saga from persisted events and owns the terminal result publication.
    val strictWiring = model.strictEntries.zipWithIndex.map { case (entryFqn, i) =>
      val valName = if (model.strictEntries.size == 1) "strictSagaCoordinator" else s"strictSagaCoordinator$i"
      s"""  // strict saga coordinator (independent namespace; explicit deployment reconcile token)
  private val $valName: akka.actor.typed.ActorRef[net.imadz.infra.saga.strict.StrictSagaCoordinator.Command] =
    $entryFqn.spawnClusterSingleton(system, sharding,
      classicSystem.settings.config.getString("net.imadz.strict-saga.reconcile-token"))

  // deployment-face event-stream source: the shared journal's live event stream
  // triggers the saga from persisted events and owns the terminal result publication
  $entryFqn.installEventSource(system, sharding, $valName)""".stripMargin
    }.mkString("\n\n")

    val classBody = s"""
  // 隐式转换环境
  private implicit val system: TypedActorSystem[Nothing] = classicSystem.toTyped
  private implicit val ec: scala.concurrent.ExecutionContext = system.executionContext

  // Initializations
  $initBlock
$strictWiring
"""

    // 7. 构建完整源代码
    val sourceCode = s"""${pkgDecl.code}

${importDecl.code}

/**
 * ApplicationBootstrap: 应用引导类，负责初始化所有CQRS组件
 */
@Singleton
class ApplicationBootstrap @Inject()($injections) extends $traitsExtends {

$classBody

}
"""

    // 8. 生成代码
    sourceCode
  }
}
```

## 4. 逐字段、Builder 分支和输出 construct / RHS 账

### 4.1 Model 全字段（按构造器顺序）

| ID | 字段 / 默认 | raw 语义与依赖 | JS 对应和目标 |
|---|---|---|---|
| M1 | `override val selfType: TypeRef`，无默认 | `ApplicationBootstrap` + `ctx.layout.infrastructure.bootstrap`；模板 package 来自它，但 class 名字硬编码 | formal `startupPath` / package 字符串，没有本族 TypeRef；目标独立结构字段 |
| M2 | `traits: Seq[TypeRef]`，无默认 | 按聚合、可选 coordinator、每 saga、projection 顺序 distinct；同包 traits 后来从 dependencies 过滤，不是不存在依赖 | formal 缺失；legacy 有字符串数组；目标保留有序 TypeRef，文件依赖不能仅靠 import 推断 |
| M3 | `initCalls: Seq[String]`，无默认 | **Scala 代码字符串槽**；由 B 生成完整调用源码，T 原样按顺序串接 | 不以“传统完全无源码串”美化；JS 必须保留逐调用来源/实参证据，不用一个 `content` 字符串代替整个 Model |
| M4 | `injectedFields: Seq[FieldDef]`，无默认 | classicSystem、sharding 固定在前，再仓储字段 lower-first 后排序 | formal 是 `load(context)` 的局部变量，非此构造器；legacy 多为签名字符串，需结构化 |
| M5 | `strictEntries: Seq[String] = Nil` | 完整 entrypoint FQN；空数组无 wiring，顺序原样；不在 B 中去重、校验或收集成 TypeRef | legacy DSL 已有；formal 总装配无对应；目标仅从明确 admitted 输入取得，不由目录名或银行 saga 名猜 |
| M6 | `override val dependencies: Set[TypeRef]`，无默认 | framework、traits、repo、importOnly、frameworkFields 的并集经 shouldImport | formal entry.deps 是三个输出路径，不能等同 Scala 类型依赖；两种依赖都要保留 |
| M7 | `override val noteIds: Seq[String] = Nil` | 注释称全聚合号；**B 未传第七个参数，实际为 Nil** | 不能按注释声称回锚已闭合；D7 决定真实来源集合 |

[TypeSystem.scala:4–85][TYPES]：`TypeRef(name: String, packageName: String, typeParams: Seq[TypeRef] = Nil)`；`fqn` 对空包返回 name，否则 `package.name`；`signature` 对 TupleN 且有 typeParams 输出 tuple 语法，对其他泛型输出 `Name[args]`，否则 name；`collectAllDependencies` 递归包括自己和泛型参数；`shouldImport` 排除空包、当前包、`scala`、`java.lang`。**本族 B 没有调用 collectAllDependencies，T 的注入只取 `.name`，不取 `.signature`**，不能用共享类型系统存在来宣称本族已支持所有嵌套泛型。

`FieldDef` 完整顺序是 `name: String`、`typeRef: TypeRef`、`defaultValue: Option[String]=None`、`comment: Option[String]=None`、`noteId: Option[String]=None`、`description: String=""`。B 只传前两个；T 只消费前两个且忽略类型参数。默认表达式、注释、字段 noteId / description 不是本族的已发射能力。

[ArtifactModel.scala:5–47][ARTIFACT] 的继承成员也要区分：`fqn = selfType.packageName + "." + selfType.name`；`registerTo(registry) = registry.register(this)`，没有本族嵌套制品注册；`morphisms=Nil`；`noteIds=Nil` 默认被本 case class 同默认覆盖。本族没有额外 Model 子型、类型参数、sealed ADT 或内嵌模型；strict 项是字符串，不是子模型。

### 4.2 Builder 全规则（执行顺序）

| ID / B 行 | 输入 → 完整规则 / RHS | 必须保留 / 未决 |
|---|---|---|
| B1 / 15–25 | 参数 `(system, ctx, strictEntries=Nil)`；依次取 bootstrap package、selfType、`system.application.aggregates` / `.sagas`、`system.infrastructure.projections` | 没有按 name 排序，没有排除只读聚合或空 projection |
| B2 / 27–29 | 新建 mutable Set `extraDeps` / `importOnlyDeps` 与 Buffer `initCalls`，局部使用 | 不是全局缓存；不是 I/O；不复制成共享可变注册状态 |
| B3 / 33–41 | 对每个 saga（原顺序）：importOnly 加 `${name.replace("SagaTransactor", "")}SagaDefinition`，包为 `application.services.transactor.root`；追加 `init${name}(ec, system.scheduler)` | `String.replace` 不是仅移除末尾；definition 是 object，不注入构造器；所有注册排在 engine 之前 |
| B4 / 42–53 | 仅 sagas 非空：选 `sagas.head` 的 `participants.head`；从 `interactsWith.targetName` 查 `AggregateRootMetadata`，取 `.repository`，无 repo 抛 `IllegalStateException("Repo not found")`，解析 repo TypeRef | 空 participants 会先在 `.head` 失败；后续 saga 的 context/repo 不自动合并；D2 |
| B5 / 54–61 | repo 进 extraDeps；importOnly 加 `sagaContext(context.name 或 saga.name)`；参数名 `repoType.name.head.toLower + tail`；调用构造器的 name 却是 `context.name 或 saga.name + "Context"`；追加 `initSagaEngine(sharding, Context(repoParam), system)` | resolver 的 context 基名归一化与 inline 字符串并非同一算法；显式 context 缺省时可能不一致；D2。没有多个仓储的 named args，也不注入 context |
| B6 / 66–69 | 对每个 aggregate：`aggregateRootName(getBaseName(meta.name))`，随后 `getAggregateInitMethodNameFromAggregateName(aggName)` 加 `(sharding)` | init 名不是直接 `${meta.name}`；应复用 naming，不改稳定 entity/PID |
| B7 / 72–78 | 每 projection 用 `.repositoryRef.get`，解析 repo，加入 extraDeps；lower-first repo 参数；追加 `${getProjectionInitMethodName(meta.name)}(system, sharding, repoParam)` | 缺 repo 不回退空实现；projection 调用仍按输入顺序 |
| B8 / 80–92 | `frameworkFields = [classicSystem: classicActorSystem, sharding: known ClusterSharding]`；extraDeps 转 FieldDef，按字段名排序；连接两组 | Set 按完整 TypeRef 去重而非参数名；不同包同短名仍可能生成同名注入，排序不解决冲突；D5 |
| B9 / 94–102 | frameworkDeps 精确为 Inject、Singleton、actorSystem、actorSystemTyped、adapter、executionContext、extendedActorSystem | actorSystem 与 classicActorSystem 同为 `akka.actor.ActorSystem`；typed TypeRef 是 `ActorSystem[Nothing]`；不要凭未使用 import 扩大运行依赖 |
| B10 / 104–117 | traits：每 aggregate `${getAggregateBaseName(name)}Bootstrap`；S>0 追加 `SagaTransactionCoordinatorBootstrap`；每 saga `${name}Bootstrap`；每 projection `getBootstrapNameFromProjectionName(name)`；最后 `.distinct` | trait 名使用 getAggregateBaseName（只去 Aggregate 后缀），与 B6 多后缀 getBaseName 不同；不得偷偷改变顺序或把重复 init 同时删掉 |
| B11 / 119–124 | 并集 `frameworkDeps ++ allTraits ++ extraDeps ++ importOnlyDeps ++ frameworkFields.map(_.typeRef)` 后 `.filter(_.shouldImport(pkg))` | “移除了 Context 的依赖”注释已与 B55 的实际 importOnly context 不符；以表达式为准。strictEntries 没有加入该并集 |
| B12 / 126–133 | 以位置参数依次传 selfType、allTraits、initCalls.toSeq、injectedFields、strictEntries、dependencies，noteIds 留默认 | 没有 MANUAL 注入、成功回执、业务算法补全或 schema 修改 |

命名精确来源：[NamingConventions:167–224,238–259][NAMES-BASE]、[575–600][NAMES-BOOT]。`getBaseName` 依次试移除 Aggregate、Controller、Entity、DomainService、Service、Factory、Behavior、Behaviors、RepositoryImpl、Policy、Handler、Adapter、Converter、Strategy、Bootstrap、SagaTransactionRepository、SagaTransactor、SagaTransaction、Repository、Query、Participant、Participant、Event、State、Context；中途剥空返回最后非空值。`getAggregateBaseName` 只移除末尾 Aggregate；`aggregateRootName(base)=base+"Aggregate"`；projection bootstrap / init 只去末尾 Projection；`sagaContext(name)` 先 getBaseName 再 getSagaContextName，最终进 transactor 包。不能将这些差别概括成一个随意正则。

### 4.3 Template 每个发射 construct / RHS（从上到下）

| ID / T 行 | raw 完整发射规则 | 目标及 formal 差距 |
|---|---|---|
| T1 / 12–13,75 | `packageDecl(selfType.packageName)` → `package <pkg>` | package 三层位置已相同，不能据此说职责相同 |
| T2 / 16–31,77 | dependencies 排除所有短名恰为 ActorSystem 的项；映射 `packageName.name`，sorted、distinct；合并五个固定 import 再 distinct；[DSL ImportDeclaration:20–22][DSL] **再次排序全部**，每项加 `import `，用换行连接 | 不是 framework imports 追加在末尾的最终顺序；去重按完整字符串，所以 `javax.inject.Inject` 与 `javax.inject.{Inject, Singleton}` 并存，`adapter` 与 `adapter._` 并存。approved 仅保留必要无歧义 imports；类型身份不变 |
| T3 / 79–82 | 固定三行 ScalaDoc，`ApplicationBootstrap: 应用引导类，负责初始化所有CQRS组件`，随后 `@Singleton` | formal object 无该注解；它不等于 eager 实例化，需 module / 显式 owner |
| T4 / 33–41,83 | 固定 `class ApplicationBootstrap @Inject()(<fields>) extends <traits> {`；不是 final / case class；fields 每个 `name: typeRef.name`，以 `,\n  ` 连接；traits 取 `.name` 用 ` with ` 连接，空时给空串但 extends 仍存在 | 主构造器无 val/var 参数、无默认、无 auxiliary / curried / implicit 参数、无父构造器实参。D3 空 traits；D5 泛型和碰撞 |
| T5 / 64–67,85 | 空行和 `// 隐式转换环境`；`private implicit val system: TypedActorSystem[Nothing] = classicSystem.toTyped`，随后 `private implicit val ec: scala.concurrent.ExecutionContext = system.executionContext` | typed conversion 与 dispatcher 取值顺序保留；可将 ec 类型用已导入简名表达，不能新建另一 ActorSystem 冒充转换 |
| T6 / 43–44,69–70 | `// Initializations`；`initCalls.mkString("\n  ")` 原样嵌入 | 无新的 wrapper 方法、返回值或 Future 等待；构造器初始化顺序是 B3 所有 saga 注册 → B5 一个 engine → B6 聚合 → B7 projection；空 init 也留注释/空白 |
| T7 / 52–57 | strictEntries `zipWithIndex`；1 个用 `strictSagaCoordinator`，多个用从 0 开始下标；每项注释后 `private val <name>: akka.actor.typed.ActorRef[net.imadz.infra.saga.strict.StrictSagaCoordinator.Command] = <entryFqn>.spawnClusterSingleton(system, sharding, classicSystem.settings.config.getString("net.imadz.strict-saga.reconcile-token"))` | ActorRef 是基础设施协调器 handle，不是 domain 参数/事件。无 token 默认，无 try/catch，无懒初始化；每项到此才读配置，先前普通 init 已经发生 |
| T8 / 59–62 | 每项再发两行 event-stream 注释，然后 `<entryFqn>.installEventSource(system, sharding, <name>)`；项间 `\n\n`；空 entries 发空串 | 必须在其 spawn 后；不是全部 spawn 完才统一 install；返回的 kill switch 被丢弃，见 D4，不得称已有关闭协议 |
| T9 / 71–91 | strictWiring 跟在全部 initCalls 后；保留 classBody 的首尾换行和外层空白，闭合 class，末尾换行；返回 sourceCode String | Template 本身不加 fingerprint、不写文件。writer 另加头；不能沿用旧 offsets |

本族发射的成员集合是一个 class、两个 private implicit val、有条件的 N 个 private val、顺序初始化表达式。**没有** companion、嵌套 class/trait/object、type alias、重载、annotation 参数、self-type、型变/上下界、lazy val、可变运行字段、方法声明或公开 `load`。生成器的 `generate/build` 方法不属于产物成员。

### 4.4 raw import 的完整算法实例（aggregate-only 切片）

无 saga / projection、只有同包 `CreditBalanceBootstrap` 时，B 的 same-package filter 去除 trait，T 加固定 imports，DSL 最终排序得到以下完整 raw import 集合；这是源规则推演，未生成文件。

```scala
import akka.actor.ActorSystem
import akka.actor.ExtendedActorSystem
import akka.actor.typed.scaladsl.adapter
import akka.actor.typed.scaladsl.adapter._
import akka.actor.typed.{ActorSystem => TypedActorSystem}
import akka.cluster.sharding.typed.scaladsl.ClusterSharding
import javax.inject.Inject
import javax.inject.Singleton
import javax.inject.{Inject, Singleton}
import scala.concurrent.ExecutionContext
```

有 classic saga 时再加入 B3 的 definition import、B5 的 context / repo；有 projection 时加入其 repo imports。定义注册实际封装在另一个 trait，raw 保留了总装配处未直接使用的 definition import。strict 类型 / entrypoint 在 T 中直接写 FQN，不因 dependencies 自动生成 import。目标正常 imports 的覆盖不得改变这些符号所代表的类型或实现身份。

## 5. 当前 JS 三条路线与人工参考

### 5.1 formal 银行实际文件全文和逐语句账

[真实银行快照:1–25][BANK]。

```scala
// @generated by truthsrc scala-cqrs-domain:1
package example.bankwealth.infrastructure.bootstrap

import play.api.{Application, ApplicationLoader}
import scala.util.control.NonFatal
import example.bankwealth.service.{BankServiceConfiguration, BankServiceComponents}
import example.bankwealth.service.BankServiceService._

object ApplicationBootstrap {
  def load(context: ApplicationLoader.Context): Application = {
    BankServiceConfiguration.validate(context.initialConfiguration)
    val factory = context.environment.classLoader.loadClass("example.bankwealth.integration.BankServiceFactory").getDeclaredConstructor().newInstance().asInstanceOf[Factory]
    require(factory.implementation == "example.bankwealth.integration.BankServiceFactory" && factory.version == "bank-v1-service-1", "composition factory pin mismatch")
    val composition = factory.create(context)
    try {
      requireInstalled(composition)
      new BankServiceComponents(context, composition).application
    } catch { case NonFatal(error) =>
      context.lifecycle.stop()
      composition.close()
      throw error
    }
  }
}
```

其 formal 可达链不是由文件夹推定：[registeredProductProducer:92–101][PRODUCT-CLI] 明确注册 `scala-cqrs-play-service`；[generate.mjs:59–70][SERVICE-GEN] 的 `play-service-dsl.produce` 调用 `renderService`，并继续生成 readside/test/config support。`renderService:20–31` 做单 selected artifact / service、factory FQN、endpoint 唯一性检查，且 **service.projections.length 非零会拒绝该 renderer**，不可说它已发传统 projection 总装配。

| JS construct / 固定行 | 输入、RHS、顺序、归属结论 |
|---|---|
| S1，SERVICE:5–18,21–31 | `serviceSelection(products,options)` 要求 service options 精确为 artifact/externalSourceRoots、一条 selected complete service、可用 identifier；`packageFor` 从 context 包绑定取得 pkg，name=`symbol(artifact.artifact.id)`；按 service.bootstrap.ref 找明确实现，不猜工厂 |
| S2，SERVICE:164–169 | startup package 与 raw 相同层；imports 固定 Play / NonFatal / service Configuration+Components / `${name}Service._`；通配带入 Factory、Composition、requireInstalled；这些是 B 的 HTTP/runtime 胶水，非 CQRS 总装配类型依赖 |
| S3，SERVICE:171–176 / BANK:9–14 | object；公开 `load(Context): Application`。依次校验配置 → classLoader 反射无参构造并 cast Factory → 比对 implementation **且** version → factory.create(context)。这四步在 try 外；失败时不能声称已执行下方清理 |
| S4，SERVICE:177–179 / BANK:15–17 | try 内先 `requireInstalled(composition)`，后 `new Components(context,composition).application`。`requireInstalled`（SERVICE:89–92）验证 composition/authority/bindings 非 null、每 endpoint 实现/version/reads/writes/run、可选 page renderer；不是空 success |
| S5，SERVICE:180–183 / BANK:18–21 | 只 catch NonFatal；依次 `context.lifecycle.stop()`、`composition.close()`、重新 throw 原变量。stop 的异步结果不等待；close 若抛出会遮盖原 error，且没有 finally/suppressed 策略；D4 需要明确，而非借迁移宣称修复 |
| S6，SERVICE:188–204 | path=`pathFor(pkg,'infrastructure/bootstrap/ApplicationBootstrap.scala')`；kind=`service-runtime`、sources=`[artifact.source]`、footprint=serviceFootprint、deps=Service/Loader/Configuration 三个文件路径；startup 没传成员 codeMappings |
| S7，[entry:23–31][ENTRY] | pathFor 固定 `app/`；entry 加固定 `scala-cqrs-domain:1` 头、knowledgeIds 去重、productFootprint、merge=null；若有 codeMappings 才按 header 长度转 UTF-8 span。说明银行头与真正 producer 不一致的来源，不更改旧头来冒充新证据 |
| S8，SERVICE:101–119，[pages:40–48][PAGES] | 有无 pages 的 Loader 均调用此 object.load；Components 注册 `applicationLifecycle.addStopHook(() => Future(composition.close()))`。改 class 后两个 loader 调用都必须迁移，不能只处理无 pages 支路 |

**四层差距**：formal 没有本族七字段 Model；Builder 的工作是 service artifact/factory/endpoint 选择；Template 发 object+load 而非注入式 trait 总装配；产物同路径但接口、依赖与副作用完全不同。不是“改名就一比一”。

[银行 CreditBalanceBootstrap.scala:14–26][BANK-AGG] 是 `object CreditBalanceBootstrap extends CreditBalanceAggregateFactory`，实现 `create(persistenceId: String, initial: State, hosts: CreditBalanceComputations): Behavior[Command]`，用 `PersistenceId.ofUniqueId(persistenceId)`、明确 hosts 和 event/snapshot adapters。它没有 `initCreditBalanceAggregate(sharding)`。不能立刻把该 object 当 trait 继承，更不能为套 raw 模板把原持久化身份切换成 `PersistenceId(entityTypeKey.name,entityId)`。这是 D1 的真实接口阻断。

### 5.2 legacy bootstrap-dsl：有接近实现，但 formal 未调用

[emit.mjs:259–363][LEGACY] 实际存在 `emitApplicationBootstrap()`；[run-all.mjs:1880–2030][RUN-ALL] 有明确 spec 落盘和 `execSync(node emit.mjs ...)` 调用。该 producer 不在 formal `registeredProductProducer` 列表，所以这是 legacy 路，不是银行 formal 已用的 MBT。

| legacy construct / 行 | 已观察的规则与差距 |
|---|---|
| 全局 spec / 15–23 | JSON 读入、立即 mkdir(outDir)；package 默认 `net.imadz.infrastructure.bootstrap`、basePkg 默认 `net.imadz.metarch`、kind 默认 aggregate，firstLower 改首字符。没有独立强类型本族 Model |
| 输入派生 / 260–272 | aggTraits/viewTraits 各复制后排序；遍历每 aggregate 的 aggPorts，以 **param 名**去重构造 ports；view 生成 `${firstLower(v)}Repository: ${v}Repository`。不是 BC input-order calls 或 TypeRef-set 注入 |
| imports / 274–290 | 固定 classic/Extended/adapter/typed alias/ClusterSharding/三个 inject 字符串/ExecutionContext，加每 view repo，整体排序；有 ports 时在组合 inject 后插 `${basePkg}.domain.service.${p.type}`，不再排序 | 
| 构造器 / 292–303 | classicSystem 在模板固定发；paramLines 先 sharding、各 repo，有 ports 就拼在最后一行尾；traits 是 agg 再 view；无 classic saga coordinator / definitions / context 推导 |
| calls / 304–314 | agg 先、view 后；每 agg 只传自己的 ports，projection 传 system/sharding/repo。它支持显式 domain-service ports，是 raw 本族没有的输入扩展，不得删除必要 hosts |
| strict / 320–331 | `spec.strictEntries || []`；val 命名、FQN、getString key、spawn/install 顺序与 raw 对应；但 admitted 来源由 run-all 的 sagaBinding 映射 entrypoint 并 filter(Boolean)，不是本族内验证 |
| 发射 / 333–356 | 固定旧 CodegenMain 头 / release 头；class @Inject + traits；同样会在空 traits 产生裸 extends；typed system/ec；initCalls 后条件空行+strictWiring；无生命周期关闭 |
| writer / 239–250,359–365 | 先按 kind 计算 traitContent，即使 skipTrait；`!skipTrait` 写 trait，`!skipApp` 写 ApplicationBootstrap，输出日志。不是 applyEntries 的 owned 写漏斗 |
| caller / RUN-ALL:1887–1914,1947,1974,2000–2029 | ModelCatalog ports、额外 views、PauseProject 排除带明确 PHASE1/golden 转录表；最终 appSpec skipTrait=true，写 specs 后子进程发射；sagaBinding 时不加 metarch extra views。不可将这些 corpus 表移植为银行真源 |

可复用的是已核实的 strict 循环形状与每个初始化构造的表达经验；不能直接复用裸 CLI emitter（导入即读 argv / 写文件），也不能采信文件注释中的“1:1”作为本轮验收。

### 5.3 `_deprecated/scala-cqrs-es`：legacy core 可尝试调用，不因目录名判定不可达

[旧 generate:16,23,171–176][OLD-G] 明确调用 `applicationBootstrapModel(canonical)` → `renderApplicationBootstrap(appBoot,env)`。其 [generator.json:2–35][OLD-MANIFEST] 声明 `inputSchema=truthsrc/v0.3`、kind=`application-bootstrap`，没有 declaredProducts。通用 [legacy plan:23–42][CORE-PLAN] 通过 generatorDir 动态 import，manifest loader 不按 `_deprecated` 路径禁用。因此可由 legacy `generate --in --generator --out` 尝试进入；这不是已验证该路径整个依赖闭包能运行，也没有被 formal 注册选中。

| 构造 / 源行 | 完整相关规则 / 差距 |
|---|---|
| Model 输入 / OLD-B:133–138 | canonical.aggregates 默认 [] 原顺序；projectionViews 默认 [] 按 name 排序；portFaces 从 foldPorts/ports 分别按 trait FQN 排序，选有 all ports 的 aggregates；allPorts 直接 flatMap、不去重 |
| init / OLD-B:139–145 | aggregate `init${a.name}Aggregate(sharding[, all members])`，随后 views `init${v.name}Projection(system,sharding,${decap(v.name)}Repository)`；无 classic saga / strict |
| fields / OLD-B:146–150 | repo 签名字符串排序；injectedFields=[classicSystem,sharding,...repoFields]；injectionsTail 是最后一个 repo（可加 ports）。当无 views 时 tail 是 undefined，不是有效的通用空仓储合同 |
| imports / OLD-B:152–172 | base+extra Set 去重并排序，再在第一个 projection.repository import 前插 allPorts imports；没有该 anchor 时 findIndex=-1，仍以 slice(-1) 拼接；这是语料补丁，不是类型依赖 resolver |
| Model 全返回 / OLD-B:174–181 | `kind='application'`、`name='ApplicationBootstrap'`、固定 `pkg='net.imadz.metarch.infrastructure.bootstrap'`、imports、traits（agg后view）、injectedFields、injectionsTail、initCalls；没有 strictEntries/dependencies TypeRef/noteIds 字段 |
| Template / OLD-T:69–72 | injections=`injectedFields.slice(0,-1).join(',\n  ')` + 有字段就追加 tail；body 与 raw 的 system/ec/init 对应；headerOf(env)+package/importLines+固定 ScalaDoc+@Singleton+class；同样无条件 extends，没有 strict loop |
| output / OLD-G:171–176 | 固定 `app/net/imadz/metarch/infrastructure/bootstrap/ApplicationBootstrap.scala`，kind=`application-bootstrap`，schemaCategory=`aggregate`、schemaNode=`ApplicationBootstrap`，families/deps/noteIds 都为空；不能套用 BC 的 global/bootstrap 归因 |

结论是 **legacy-only / not-wired**，不是“JS 完全没有 ApplicationBootstrap renderer”，更不是批准复活旧语料默认行为。

### 5.4 新 family 应用装配：真实注册、职责相近但并非同一运行合同

[formal registry:24,45–51,92–101][PRODUCT-CLI] 注册 `scala-cqrs-play-application-v1`；其 producer 要求 implementation capture，`generate-products` 包括 `--plan` 都拒绝该 producer，必须由 `generate-project` 提供 live capture。故它是另一条明确可选的 family lane，不是银行 service lane 的隐式 replacement。

已实读其完整 [build-models][FAM-B]、[generate][FAM-G]、[render][FAM-R]、[application template][FAM-T] 和 [loader template][FAM-L]。

- Model/Builder：从 persistence family 闭包再加 `api-contract`、`application-composition`；重编译 declaration 对比 complete lowering；显式 packages/names/protobuf options；names 用 `resolveNameSet`；返回 api、composition、persistence、names、commands、resource、query、view、sources（FAM-B:32–109）。装配相关角色 settings/application/closeReport/lifecycle/components/loader 位于 **`<context>.composition`、module root**（21–28），不是三层批准位置。API/controller及 carrier 构造属于该 family 的其他输出，不冒认本族字段。
- Writer：FAM-R:29–40 将 settings、closeReport、lifecycle、application-root、components、loader、conf 分开输出，有明确 directDeps；application-root 不是 `ApplicationBootstrap.scala`。
- 生成器：FAM-G:10–40 验证固定 manifest、plain captured context、exact ten-product closure；通过 implementationBuildInputs 后 render；ProductError / TypeError 变 diagnostics，其他异常抛出。不能把捕获成功当 Scala ABI 成功。

相关产物完整构造及 RHS 顺序如下，不以“另有 lifecycle”略掉要保留的行为。

| family 输出 / 行 | 与本族接缝相关的完整内容账 |
|---|---|
| settings / FAM-T:3–35 | case class 字段 journal/readside Path、namespace、freshJournal/freshReadside；validate 的 location 校验非 null/absolute/normalize/控制字符与分号反斜杠、逐祖先非 symlink、父目录；两路径不重叠；namespace 长度；fresh/existing 模式；existing journal 的 CURRENT/manifest 内容和文件；readside .mv.db 和 symlink。此本地存储合同不是银行 Mongo/MySQL |
| application 构造器 / 38–62 | final class private ctor，顺序为 settings、directory、authority、domainSystem、private executor、private pool、private repository[String]、readside、source、runner、commands、queries、lifecycleSystem、resources；ec 从 lifecycleSystem；readyFlag/closing/failure=false，admitted=0，empty=Promise[Unit]()，closingResult=None |
| safe / 63–64 | 对 by-name Future 取 Option，null 变 failed IllegalStateException，NonFatal 变 failed Future；不是总成功 |
| register / 65–70 | resources.register("requests") 设置 closing=true/readyFlag=false，admitted=0 时完成 empty，再返回 empty.future |
| startup / 71–81 | runner.start → source.persistenceIds(None,pageSize) → 串行 foldLeft catchUp；ready.transform 在未 closing/failure 时设 readyFlag，否则失败；startup 失败设 failure、close、返回 Failed；runner.failure 回调设 failure、readyFlag=false |
| admit / 82–91 | accepting 同步判断 readyFlag && !closing && !failure；admit 超过 maxPending 或不可接收返回 Left(Unavailable)，否则计数+1 → safe(work) → parasitic onComplete 计数-1并在 closing 且清空时完成 Promise |
| close / 92–101 | synchronized，closingResult.getOrElse 内设 closing/readyFlag，可能完成 empty，调 resources.close，将同一个 Future 缓存为 Some 后返回；不是 raw 本族具备的 API |
| companion.open 前置 / 103–114 | settings.validate；require hosts/authority/lifecycleSystem 非 null；directory.declared → lifecycle → fixed pool executor → 注册 executor → blockingEc/lifecycleEc；typed parameters、返回具名 application 类型 |
| companion.open try / 115–142 | 建 H2 pool，注册 dispose，maxConnections=4；配置 local ActorSystem、LevelDB、本地 snapshot 禁 Java serialization；journal/snapshot 目录由 settings 派生；new owned ActorSystem，注册 terminate/whenTerminated；repo 用 directory 中的 **既有 persistenceId** 与 factory/empty/hosts，spawn resource-index actor；注册 repository/source/readside；构造 readside/source/runner；最后 new application，注入新 CommandService/QueryService |
| companion.open catch / 143–148 | NonFatal 时 Await resources.close，期限 closeMillis+1000 ms；report.failures 与 cleanup 异常加 suppressed；再 throw 原 error。不能在移植为 raw 时删掉这些清理职责 |
| closeReport / 154–159 | final case class `(drained: Boolean, failures: Vector[String])`，没有默认值 |
| loader / FAM-L:3–29 | 从声明 config keys 构造 settings 并校验；new 明确 authority.symbol、host.symbol；new Components；try components.application，NonFatal 交 initializationFailed |
| components / FAM-L:30–62 | BuiltInComponentsFromContext；ec、httpFilters 空、httpErrorHandler；initializationFailed 用总 deadline 顺序 Await lifecycle.stop 与 actorSystem.terminate、捕获并加 suppressed，抛 IllegalArgumentException；service=open，失败走相同清理；stopHook 根据 report.drained 成功/失败；router.Routes+controller |
| config / FAM-L:63–73 | 指向 names.loader.fqn；配置模板使用环境占位符与 fresh flags=false；没有读取任何真实凭据或环境值。本次未使用这些配置启动应用 |

这些生命周期机制与原银行 object.load 的职责可形成 B 类迁移约束，但其 local actors / H2 / LevelDB 不能用于“顺手替换”银行存储、sharding 或 classic Saga。family package 迁入三层由 family 装配 owner 负责，不在本文的 A renderer 中复制第二套资源管理器。

### 5.5 人工参考独立账（不是 raw）

[GOLD:1–52][GOLD] 的完整文件固定保存，以下覆盖其声明及执行内容，非只列链接。

| 构造 | 人工参考内容 / 与 raw 差异 |
|---|---|
| package/imports 1–11 | `net.imadz.infrastructure.bootstrap`；typed ActorSystem、adapter._、ClusterSharding；CreditBalanceRepository、MonthlyIncomeAndExpenseSummaryRepository、MoneyTransferContext；inject 组合与 ExecutionContext 分组。classic 参数用 FQN，没有 raw TypedActorSystem alias / ExtendedActorSystem 等冗余 import |
| ScalaDoc / class 13–28 | “系统的总启动入口”及三类组件说明；@Singleton，class ApplicationBootstrap @Inject；参数顺序 classicSystem: akka.actor.ActorSystem、sharding、creditBalanceRepository、**monthlyRepository**；extends CreditBalanceBootstrap with SagaTransactionCoordinatorBootstrap with MoneyTransferSagaTransactorBootstrap with MonthlyIncomeAndExpenseBootstrap |
| implicit vals 30–33 | system: ActorSystem[Nothing]=classicSystem.toTyped；ec: ExecutionContext=system.executionContext；**另有 scheduler: akka.actor.typed.Scheduler=system.scheduler**，raw 无此 val |
| init 35–49 | 带四组说明注释；`initMoneyTransferSagaTransactor` 使用隐式 ec/scheduler；然后 `initCreditBalanceAggregate(sharding)`；再 `initSagaEngine(sharding, MoneyTransferContext(creditBalanceRepository), system)`；最后 `initMonthlySummaryProjection(system, sharding, monthlyRepository)` |
| 尾表达式 51 | `println` 的字符串内容是固定原文件上的成功启动日志（含非 ASCII 图形字符）；raw 不发日志。该日志既不是 ready Future，也不能作为恢复完成证据；本目标不新增它 |
| eager module | [GMOD:7–15][GMOD] 的 configure=`bind(classOf[ApplicationBootstrap]).asEagerSingleton()`；@Provides `provideExtendedSystem(system: ActorSystem): ExtendedActorSystem = system.asInstanceOf[ExtendedActorSystem]`。包 net.imadz.modules 不符合本轮三层覆盖，需明确迁移，不把人工 module 算本模板产物 |

关键冲突：raw 顺序是**注册 → engine → aggregate → projection**，人工参考是**注册 → aggregate → engine → projection**。两者都要求注册先于 sharding recovery；后两者的相对先后不能由移植 agent 自行换序。D2 保留这个裁定点。人工 monthlyRepository 也不能作为任意 repository 参数默认名。

## 6. approved-target、真实 diff 与有限覆盖

### 6.1 已明确的目标和没有批准的部分

本族职责是 `infrastructure.bootstrap` 内的 CQRS **总装配 class**，不是把所有 Play/runtime 构造移入一个同名 object。Model 维持 M1–M7 结构；Builder 遵循 B1–B12，已知不足按 D 项阻断而非猜算法；Template 发 T1–T9 的明确构造。正常 imports、PascalCase class / lowerCamelCase 字段、显式分组与多行参数是用户标准覆盖。三层归属已批准；Guice 与当前显式 factory composition 的整合方式尚未批准。

下例是 **aggregate-only / single-project 内容切片**：仅选择 `CreditBalanceAggregate`，无 saga、projection、strict entries。名字来自已核实 BC bootstrap 合同；不包含银行全部模型，不声称现存 object 可用作 trait。完整源码用于看清目标所有成员；不含虚构规则实现、确认成功或新增持久化行为。

```scala
package example.bankwealth.infrastructure.bootstrap

import akka.actor.ActorSystem
import akka.actor.typed.scaladsl.adapter._
import akka.actor.typed.{ActorSystem => TypedActorSystem}
import akka.cluster.sharding.typed.scaladsl.ClusterSharding
import javax.inject.{Inject, Singleton}
import scala.concurrent.ExecutionContext

/**
 * ApplicationBootstrap: 应用引导类，负责初始化所有CQRS组件
 */
@Singleton
class ApplicationBootstrap @Inject()(
    classicSystem: ActorSystem,
    sharding: ClusterSharding
) extends CreditBalanceBootstrap {

  // 隐式转换环境
  private implicit val system: TypedActorSystem[Nothing] = classicSystem.toTyped
  private implicit val ec: ExecutionContext = system.executionContext

  // Initializations
  initCreditBalanceAggregate(sharding)
}
```

这个切片在 D1 完成前是**内容规格**，不是可直接应用于 bank/current 的替换文件。全银行的 aggregate/saga/projection/hosts 闭包未由同输入适配器固定，因此没有编造一个“完整银行 approved output”。

raw → 上例的有限差异：删除未用 ExtendedActorSystem 与非通配 adapter import；只留 inject 组合 import；已导入的 ExecutionContext 使用简名；构造器/空行排版；**不改变 typed system 的 RHS、初始化调用、顺序或参数**。有 strict 时如以 imports 简化 ActorRef / StrictSagaCoordinator，必须依共享 TypeRef 冲突规则，保留 Command 类型及原 entry FQN 身份，不能 broad binding。

### 6.2 actual-js → approved-target：完整有上下文的结构差异

minus 是 §5.1 的真实完整银行文件；plus 是 §6.1 的完整最小切片，只有来源头未放入 target（由 writer 另行确定）。这是**结构性对照，非同输入字节比较，也不是可 apply 到银行的 patch**。minus 里的 load 职责必须按 §6.3 移交，不能删除后假称等价。

```diff
--- actual-js/app/example/bankwealth/infrastructure/bootstrap/ApplicationBootstrap.scala
+++ approved-target/aggregate-only/app/example/bankwealth/infrastructure/bootstrap/ApplicationBootstrap.scala
@@ -1,24 +1,25 @@
-// @generated by truthsrc scala-cqrs-domain:1
 package example.bankwealth.infrastructure.bootstrap
 
-import play.api.{Application, ApplicationLoader}
-import scala.util.control.NonFatal
-import example.bankwealth.service.{BankServiceConfiguration, BankServiceComponents}
-import example.bankwealth.service.BankServiceService._
+import akka.actor.ActorSystem
+import akka.actor.typed.scaladsl.adapter._
+import akka.actor.typed.{ActorSystem => TypedActorSystem}
+import akka.cluster.sharding.typed.scaladsl.ClusterSharding
+import javax.inject.{Inject, Singleton}
+import scala.concurrent.ExecutionContext
 
-object ApplicationBootstrap {
-  def load(context: ApplicationLoader.Context): Application = {
-    BankServiceConfiguration.validate(context.initialConfiguration)
-    val factory = context.environment.classLoader.loadClass("example.bankwealth.integration.BankServiceFactory").getDeclaredConstructor().newInstance().asInstanceOf[Factory]
-    require(factory.implementation == "example.bankwealth.integration.BankServiceFactory" && factory.version == "bank-v1-service-1", "composition factory pin mismatch")
-    val composition = factory.create(context)
-    try {
-      requireInstalled(composition)
-      new BankServiceComponents(context, composition).application
-    } catch { case NonFatal(error) =>
-      context.lifecycle.stop()
-      composition.close()
-      throw error
-    }
-  }
+/**
+ * ApplicationBootstrap: 应用引导类，负责初始化所有CQRS组件
+ */
+@Singleton
+class ApplicationBootstrap @Inject()(
+    classicSystem: ActorSystem,
+    sharding: ClusterSharding
+) extends CreditBalanceBootstrap {
+
+  // 隐式转换环境
+  private implicit val system: TypedActorSystem[Nothing] = classicSystem.toTyped
+  private implicit val ec: ExecutionContext = system.executionContext
+
+  // Initializations
+  initCreditBalanceAggregate(sharding)
 }
```

### 6.3 被移出的 construct 必须有唯一接收者

以下是 **proposed split/move**，不是已生成的新文件。输出 package 只有 domain/application/infrastructure 三层；HTTP adapter 留基础设施，业务服务端口另归 application.services。

| 现有 source/member | 拟目标完整路径（相对明确 target） | 处理义务 / owner |
|---|---|---|
| ApplicationBootstrap.load 的 S3–S5 | `<target>/app/example/bankwealth/infrastructure/bootstrap/BankServiceLoader.scala` 中的 loader 入口 | service-composition owner；保留配置校验、工厂身份/version 核对、create、requireInstalled、Components 构造及失败清理的每一步；D1/D4 决定 DI 与显式 factory 交接 |
| `.service.BankServiceLoader`，含 pages / 无 pages 两支 | 同上 `BankServiceLoader.scala` | 迁移调用方，不再调用已退役 object.load；不留永久第四层转发壳 |
| `.service.BankServiceComponents` | `<target>/app/example/bankwealth/infrastructure/bootstrap/BankServiceComponents.scala` | 移动 Play host 与 stop hook；业务/端口/HTTP DTO 不能整体塞进 ApplicationBootstrap；service owner 管装配 |
| `.service.BankServiceConfiguration` | `<target>/app/example/bankwealth/infrastructure/bootstrap/BankServiceConfiguration.scala` | 配置验证职责保留；conf/service.conf 的 loader FQN 和生成测试 support 引用同步，不能仅读新 package |
| `.service.BankServiceService` 中 Factory / Composition / requireInstalled | `<target>/app/example/bankwealth/infrastructure/bootstrap/BankServiceComposition.scala`（proposed） | 按职责提取；无 `ServiceService`。其他 Authority/Failure/Endpoint/Bindings/HTTP codec 属 service/API 分组，不由本族吞并；拆分接口等待服务组合同 |
| `class ApplicationBootstrap` + imports / 所有 init | `<target>/app/example/bankwealth/infrastructure/bootstrap/ApplicationBootstrap.scala` | **application-assembly-integrator 是唯一物理 assembly owner**；本族提供 MBT，各 bootstrap owner 只提供 typed 接口/依赖数据 |
| raw `$base.modules.BootstrapModule` | `<target>/app/<base 路径>/infrastructure/bootstrap/BootstrapModule.scala` | 若 D1 选择 Guice eager owner才接入；module 归集成者，不能多个路径同时启动同一装配 |

`example.bankwealth.integration.BankServiceFactory` 当前同时参与反射与 pin 字符串。它不是自动可重命名字段；外置实现 symbol、稳定 implementation identity/version、配置 pin 的迁移需 owner 显式批准。本文不读或修改银行手写实现，也不捏造它的 boot 行为。三层标准不是授权将持久化 / contract 身份统一换名。

## 7. 胶水、真实接口与不可抹除的债务

| 依赖 / 完整符号 | 需要的接口和语义 | 来源 / 供应边界 |
|---|---|---|
| `akka.actor.ActorSystem`、`akka.actor.typed.ActorSystem`、`akka.actor.typed.scaladsl.adapter._` | 注入 classicSystem，`.toTyped` 转已有系统，typed `.executionContext` / `.scheduler`；不能改成新建本地 ActorSystem | [TypeResolver:119–130][RESOLVE-ACTOR]、T；冻结 scaffold Akka `2.6.20` 声明，不代表已验证实际 JAR |
| `akka.cluster.sharding.typed.scaladsl.ClusterSharding` | 注入同一个 sharding，传给所有 init；本 class 不自行创建 / terminate 它 | raw frameworkField 与 [BootstrapTemplate:89–97][BOOT-T] |
| `javax.inject.Inject`、`javax.inject.Singleton`；`com.google.inject.AbstractModule` / `Provides` | constructor DI、singleton scope；eager 必须有 `bind(...).asEagerSingleton()` 或明确单一构造 owner；@Singleton 本身不是启动命令 | scaffold 有 guice；精确传递 javax.inject/Guice 制品版本和 runtime classpath 本次未解析，D8 |
| `scala.concurrent.ExecutionContext` | private implicit ec 指向 system.executionContext，传 saga registration 与 strict 接口；无自建执行器 | Scala library；scaffold scalaVersion `2.13.14` 是生成应用声明，不等于 BC 工具自身版本 |
| `<base>.infrastructure.bootstrap.<AggregateBase>Bootstrap` | raw `def init<AggregateName>(sharding: ClusterSharding): Unit`，内部 sharding.init；本族只调用，不负责命令决策、事件持久化 | [BootstrapBuilder:15–91][BOOT-B] / [Template:72–114][BOOT-T]；银行现对象 ABI 不相同，D1 |
| `<base>.infrastructure.bootstrap.<SagaName>Bootstrap`、`<base>.application.services.transactor.<Base>SagaDefinition` | `def init<SagaName>(implicit ec: ExecutionContext, scheduler: akka.actor.typed.Scheduler): Unit`，body `Definition.register; ()`；本族显式传 `(ec,system.scheduler)` | [BOOT-T:155–166][BOOT-T]；Definition object 是 import-only，不应被 Guice 注入 |
| `<base>.infrastructure.bootstrap.SagaTransactionCoordinatorBootstrap` | `initSagaEngine[C](sharding,context:C,system: akka.actor.typed.ActorSystem[_],globalTimeout: FiniteDuration=5.minutes): Unit`；取 ec、Timeout(30.seconds)、extendedSystem，构造 StepExecutor 与 coordinator sharding | [BOOT-T:125–151][BOOT-T]。本族调用省略第四参，真实默认 5.minutes；不要私改超时、重试、PID |
| `net.imadz.infra.saga.StepExecutor`、`net.imadz.infra.saga.SagaTransactionCoordinator` | 被上述 trait 消费。executor 的 PID=`saga-executor-$name`，coordinator=`saga-coordinator-${entityContext.entityId}`；StepExecutor defaultMaxRetries=5 / initialRetryDelay=100.millis / CircuitBreakerSettings(5,30.seconds,30.seconds) | 是依赖闭包行为，不是本族重新实现点；[scaffold:130–147][BUILD-PINS] 默认 `net.imadz:saga-core_2.13:0.2`，可显式候选 JAR覆盖；formal service admission 校验另一 `0.3.0` pinned JAR。不得据 sibling 源码默认兼容 |
| `<base>.application.aggregates.repository.<Repo>` / `<base>.application.projection.repository.<Repo>` | repoType 由 metadata / resolver 取得，构造器注入；context 用 first saga 的 first participant repo 构造；projection init 接受 repo 实例 | 不在本族 new infrastructure repo；不能按短名折叠两个 nominal repository 类型 |
| `<base>.infrastructure.bootstrap.<ProjectionBase>Bootstrap` | `init<ProjectionBase>Projection(system: ActorSystem[_],sharding: ClusterSharding,repository:<Repo>): Unit`；转发 `ShardedDaemonProcess(...).init` | [BOOT-T:169–217][BOOT-T]；单/多源 tags、ProjectionBehavior.Stop 由 #38 负责，不能以 fake Unit 替换 |
| `akka.actor.typed.ActorRef[net.imadz.infra.saga.strict.StrictSagaCoordinator.Command]` + 明确 entry FQN | `spawnClusterSingleton(system: ActorSystem[_],sharding:ClusterSharding,reconcileToken:String)(implicit ec:ExecutionContext): ActorRef[...]` | [FixtureHostTemplate:634–640][STRICT]，require token 非 null/nonempty，new FixtureHost，ClusterSingleton.init(SingletonActor(SagaModule.behavior(...),既有名称))；命名空间不能改 |
| 明确 entry FQN `.installEventSource` | `(system,sharding,coordinator)(implicit ec): akka.stream.UniqueKillSwitch`；从共享 durable journal 驱动 trigger / terminal result publication；raw 总装配丢弃返回值 | [FixtureHostTemplate:647–695][STRICT]，创建具名 replySink、PersistenceQuery Mongo allEvents 流；“install once per system”是接口前提，不是本文测得保证。D4 谁持有 kill switch / 失败如何关闭 |
| `play.api.ApplicationLoader.Context`、`Application`、`scala.util.control.NonFatal`、generated `Factory/Composition` | 属原 formal load 链，Factory 的 create(Context):Composition、implementation/version、Composition extends AutoCloseable，ready:Future[Unit]；构造/关闭行为迁到服务装配胶水 | [SERVICE:79–92,171–183][SERVICE]；不能把它们删掉以凑 raw class，也不将 Play 类型注入 domain |

### 7.1 代码槽和未完成项的界限

- 本族 raw MBT 没有 `???` 或 MANUAL 业务块；但 **`initCalls` 是完整 Scala 调用字符串**，strict entry FQN 是未经本 Builder 校验的字符串，injected FieldDef 的 defaultValue 本来可以承载代码字符串而本 T 忽略它。不能宣称全结构化 / 泛型完整覆盖。
- 空 traits 的非法 extends、first participant / repo `.get`、context 名推导分歧、同短名碰撞是实际源规则的边界，不能用 `()`、空集合、恒真/成功回执绕过。
- raw 本族没有 ready/close/错误恢复协议；调用某个 init 返回并不等于 projection ready 或业务已恢复。人工 println 也不提供这种证明。
- 不属于本族的 CommandHelper / behavior / domain body 留在对应手写隔离与规格中。本族禁止构造“启动即成功”的业务事件或回复。
- 强制边界随依赖保留：`CommandHelper` 在 `application.aggregates.behaviors`，必须有 `toParam` / `createFailureReply` / `createSuccessReply`；`replyTo` 只对有明确回复合同的应用 Actor command 条件发射；领域 params/events 不得加 ActorRef。错误不 persist；成功 persist/apply 后 `thenReply` 读取新 state；`replyWith` 与增加 EventStream 发布的 `replyWithAndPublish` 不可互换。本族不发这些方法，验收不能由其启动成功替代。
- 不改 PB 字段号、PID、serializer ID/绑定、名义类型、overflow/精度规则，不用 String/Any dispatcher 或 `addExact → +` 降复杂度。

## 8. 后续 JS 实施写集合、共享接口和唯一组装 owner

以下均为**拟实施集合**，本阶段一个也没有修改或创建。路径以 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/` 为仓库根，精确相对位置列在表内。

| 文件 | disposition / 所有权 | 工作内容 |
|---|---|---|
| `generators/scala-cqrs-play-service/models/application-bootstrap.mjs` | **proposed**，本族 | 明确 M1–M7；TypeRef、FieldDef 由 shared contract 提供；输入/类型依赖/文件依赖/来源分开；保留命名的 initCalls 代码槽例外，禁止整个 file content 当 Model |
| `generators/scala-cqrs-play-service/build-application-bootstrap.mjs` | **proposed**，本族 | 对应 B1–B12；适配已裁定的 aggregate/saga/projection/strict 元数据，按约定诊断空 traits / 缺 repo / 冲突；不能从 business prose 推导 context 或回复 |
| `generators/scala-cqrs-play-service/templates/application-bootstrap.mjs` | **proposed**，本族 | 对应 T1–T9；不读文件、不碰运行时、不写 ledger；保留精确初始化副作用顺序 |
| `generators/scala-cqrs-play-service/render-application-bootstrap.mjs` | **proposed**，本族 | builder→template→唯一 entry；为同包 traits 也记录输出路径 directDeps；最终格式后才建 codeMappings |
| `generators/scala-cqrs-play-service/render-service.mjs` | split/replace，**application-assembly-integrator 唯一共享文件写者** | 抽离 164–188 的 A 路径占用；将 load 完整职责交 service composition 接收者；199–204 的返回 entries 不得丢 config/port/loader；多个分组只提交接口提案 |
| `generators/scala-cqrs-play-service/generate.mjs` | adapt，集成者 | 接通本族 renderer，保障一物理路径唯一 producer；非 pages/pages 的生成闭包共用总装配输入，不两次构造 |
| `generators/scala-cqrs-play-service/generator.json` | adapt，集成者 | 在所需输入字段 / product 版本获准后显式声明，不偷偷使用未声明的 raw bootstrap spec；兼容/拒绝旧 profile 由 D6 决定 |
| `generators/scala-cqrs-play-service/render-service-pages.mjs` | adapt，service owner 经集成者 | loader 调用迁移，page renderer 契约和 stop hook 不丢；不是本族可并行直写文件 |
| `generators/scala-cqrs-play-service/render-configuration.mjs`、`render-test-support.mjs`（同目录） | dependency，service owner | `.service` 路径和启动引用迁移；本文未实读这两文件，不声称其所有内部修改点已经核定；实施前按 source pins 复核 |
| `generators/bootstrap-dsl/emit.mjs` / `generators/run-all.mjs` | not-wired，当前不写 | 不直接搬 shell emitter / PHASE1 corpus 表；若迁移 legacy 消费另案批准，不能让它覆盖 formal 目标 |
| `generators/_deprecated/scala-cqrs-es/builders/bootstrap.mjs` / `templates/persistence.mjs` | not-wired，当前不写 | 只作结构对照，保留历史用途；不为本族复活、删除或顺带修其 zero-view bug |
| `generators/scala-cqrs-play-application-v1/build-models.mjs` / `templates/application.mjs` / `templates/loader.mjs` / `render.mjs` | family dependency，family owner | 三层布局与 composition/lifecycle 接口另组迁移；禁止把 local storage runtime 默认切成 classic sharding，或反向替换银行 |

公共依赖由集成者管理而非并发者各建一份：

1. `shared-layout-types`：TypeRef 的 fqn/signature/params/import 冲突合同；FieldDef 完整字段；source-root 单/多工程选择。应兼容 BC `PackageLayout` / `TypeSystem`，先审定再接入。
2. `shared-naming`：复用 [lib/scala-target/naming.mjs:26–118][JS-NAMES] 的 `resolveName` / `resolveNameSet` / `resolveArtifactPath`，并适配本族 BC 命名细节。当前重复 suffix 会要求 explicit binding（不是自动清洗 ServiceService）；stableIdentities 禁改名。不得复制一个 `safeName`。
3. `shared-writer-anchors`：统一 entry、product footprints、文件级/成员级来源、最终 bytes→fingerprint→span→ledger→anchor 次序；[applyEntries:246–267][APPLY] 是写漏斗，不由新 T 自行 writeFileSync。
4. `bootstrap`（#38）：提供可被 mixin 的 trait 名与 init signatures、hosts 义务、classic/strict 运行身份保护。银行现在的 object factory 必须先定接口，不能假定可直接混入。
5. `saga-context` / `saga-definition` / `saga-participant`、`projection-repository-port`：明确 context 构造器及仓储引用，解决 D2。import-only definitions 不可变成 injected singleton 参数。
6. `service-composition`：承接原 load/Factory/Components/ready/close；应用装配唯一 owner 不得重复启动/关闭共享系统。family runtime 为单独输入/目标 profile。

文件退役顺序：先固定调用方和 owned 文件清单 → 提供新 MBT + 接收 load 的胶水 → 同一 owned generation plan 更新所有引用 → 完整文件集比较并明确旧文件移除策略 → 重建最终 anchors。不得直接改 generated/current 或删除手写工厂；writer 现有可达性并不证明它能自动安全删除旧路径，删除需独立受控计划。原 `.service` 层不以转发壳永久保留。

## 9. 后续 fixture、真实 CLI 形状与副作用

**以下命令只供下一阶段审定使用，本轮未执行。** 输入目录、expected 和验证 suite 尚未创建；没有 `--artifact application-bootstrap` 这个已证实 flag。最小作用域来自输入闭包，不是虚构 CLI 过滤器。D6 未关闭时，formal 入口不会凭这些命令自动获得传统总装配能力。

### 9.1 拟 fixture 矩阵

拟资料根 `/tmp/codegen-parity-application-bootstrap/inputs/`，独立于作者业务树及工具源码；后续持久 fixture 位置由集成者批准，本文不创建。

| fixture | 明确输入 / 边界 | 必核结果 |
|---|---|---|
| F1 aggregate-only | 一个 CreditBalanceAggregate、single profile、无 saga/projection/strict；原始 metadata 到 JS 的字段映射需 D6 审定 | §6 完整文件 + #38 接口；包/import/class/ctor/implicit vals/init 与路径一致 |
| F2 ordered composition | 至少两个刻意非字母序 aggregates；两个 projections 共享一个 repo，另有不同 repo | init/traits 输入顺序与 repo 参数排序分账；Set 去重与 directDeps；不从字母排序推演副作用顺序 |
| F3 classic saga | 一 saga / 多 saga；显式 context 与缺省 context；first participant 与另一个仓储；缺 repo / 空 participants 负例 | 所有 definition 注册先于任何 sharding；context 类型名/构造器/资源闭包、raw与人工顺序冲突可见，不接受挑第一个掩盖第二个 |
| F4 strict | strict entries=0/1/2、重复 entry、token 缺失；single/multi 切换 | singleton 命名、逐项 spawn→install，固定配置 key；multi 抑制 strict wiring；相同 namespace/PID 保持；没有真实 token 写 fixture |
| F5 model edge | 空 traits；同短名不同包 repo；泛型 TypeRef / FieldDef default/comment/noteId；异常输入 | D3/D5 指定的拒绝或发射规则，不静默丢字段，raw已不支持的情况不假称默认等价 |
| F6 formal service 接缝 | 有/无 pages，factory pin mismatch、create 失败、requireInstalled 失败、Components.application 失败、close 失败 | load 接收者 / stop hook 单 owner；每一步成功和失败次序、等待/异常保留合同按 D4 执行 |
| F7 provenance | 两次相同输入，再改一个 aggregate/projection 或 entry source | 完整文件集稳定；仅预期局部 diff；source→新路径与最终 span 可查询；不能沿用旧 header offsets |

### 9.2 JS formal service 入口（已存在 flag 形状）

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /tmp/codegen-parity-application-bootstrap/inputs/products.request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-play-service \
  --out /tmp/codegen-parity-application-bootstrap/js \
  --options-json /tmp/codegen-parity-application-bootstrap/inputs/service.options.json \
  --plan
```

来源 [generateProductCli:66–88][PRODUCT-CLI]，四个带值参数均必须显式提供。正式产生内容时只移除 `--plan`，其他路径不变；第二次稳定性运行用另一明确空目标 `.../js-repeat`。本次未构造这些 JSON，也未声称当前 manifest 接受 F1。

副作用边界：plan 捕获 JSON/request、compileProductSet、校验本地 runtime JAR SHA 与 externalSourceRoots、调用 renderer；不调用 applyEntries。非 plan 写所有闭包 entries（不止本族，可能有 build/config/tests），再写 `<out>/truthsrc.ledger.json` 和 `<out>/anchors.json`；无 project graph 发布路径。不能把产物中的 build.sbt 当此命令已经执行 sbt。没有授权下载缺少的 JAR / publishLocal；缺 pin 即停止，不更换 runtime 洗绿。

### 9.3 family 入口只能另案使用 generate-project

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-project \
  --project /tmp/codegen-parity-application-bootstrap/family-input/truthsrc.project.json \
  --out /tmp/codegen-parity-application-bootstrap/family-js \
  --plan
```

project 文件须明确选择 `scala-cqrs-play-application-v1`，并含它要求的十产品闭包和 owner-declared implementations。此命令**不是本族已可用的 A 验收命令**；用于明确 family 现有路径及副作用。

[projectCli:91–145,159–204][PROJECT] 即使 --plan 也 captureProject、validateTree、roundtrip、compile、全工具源码 evidence、implementation capture 与 verifyImplementationSources；不能称“只看一个文件，零成本”。plan 不创建 Sqlite store；非 plan 另写 projectGraphFile 对应知识图并 publishProjectAnchors，除此之外写 generated 输出/ledger/anchors。roundtrip 及未在本文完整展开的间接 helper 可能有临时工作，需要在实施前固定路径预算；**本阶段因文档-only 没有运行其中任何命令**。

为识别 implementation evidence 的意义，额外只读了未入基线的当前文件 `lib/project/implementation-evidence.mjs`（SHA 见 §11）；它验证声明的文件来源/字节，明确 `symbolVerified=false`、`spanVerified=false`、`runtimeVerified=false`，不能据该函数名字宣称编译或运行验证。其下游手写来源 verifier 的全部副作用未在本族展开；因此不以 --plan 作为允许绕过本阶段禁止执行的理由。

### 9.4 BC 传统命令（只列正确参数形状）

```bash
(
  cd /Users/zhongdj/Workspaces/mad-polaris/backkend-codegen &&
  sbt \
    -Dcodegen.systemFile=/tmp/codegen-parity-application-bootstrap/inputs/canonical.json \
    -Dcodegen.systemBindings=/tmp/codegen-parity-application-bootstrap/inputs/bc-bindings.json \
    -Dcodegen.targetDir=/tmp/codegen-parity-application-bootstrap/bc \
    -Dcodegen.multiProject=false \
    -Dcodegen.ledger=/tmp/codegen-parity-application-bootstrap/bc/.codegen-ledger.json \
    "runMain net.imadz.codegen.CodegenMain"
)
```

这是 mutually exclusive system-file 槽，不同时设置 `codegen.system`。canonical 与 bindings 必须能保真表达相同 fixture，不能将 JS 产品请求直接充当 BC SystemMetadata。strict F4 另显式提供 `-Dcodegen.sagaExecutionV3=/tmp/codegen-parity-application-bootstrap/inputs/strict-v3.json`；没有数据/供给审定时不补空 token。multi profile 单独运行到另一新目标，并设置 true。

BC **没有本族专属单文件执行 flag**；runCommon 生成输入闭包，其 scaffold、routes/proto、ledger、knowledge release manifest、formal-semantics、可能的 strict anchors 都是写面；sbt 另有仓内 target/project target、依赖缓存/可能下载及 JVM 子进程。即使新 target 也非零旁路写；后续需集中一次生成/编译并有依赖供应批准。禁止使用默认 banking-app / 共享 ingested-app、禁止 raw direct/dry-run 猜测，当前未运行。

### 9.5 验收门（全部未运行）

1. 对每个 fixture 的**完整文件集**进行路径/源根/package/import/注解/字段/traits/所有 RHS/顺序与最终格式比较；raw、有限批准差异、actual-js 分开存证。不压平空白，不把不同业务输入当 byte diff。
2. 内容账逐条关联 M1–M7、B1–B12、T1–T9、S1–S8；strict 0/1/N、empty-traits、multi suppression 必须单列，不能只检查主样例。source-content inspection 不替代 runtime。
3. 接口检查覆盖 classic init signatures、typed/classic ActorSystem、context 构造器、repo 注入和 strict entry 两个方法；固定实际 JAR 坐标/哈希后才可集中 compile。不能以 sibling 源码可读证明所消费 JAR 可用。
4. 必要行为验证：全局一次装配、registration 在 sharding 前、重复构造禁止/明确隔离、token 缺失失败与已启动资源处理、每项 spawn 后 install、正常关闭 / 失败关闭次数、原始异常保留。原 command/helper 行为仍需其专属最小 actor testkit 证据，启动文件不能代签。
5. 普通方法/JS函数 CC 目标 ≤5，6–10逐方法说明，>10重构或单项认可；当前 **not-measured**，不编造工具版本/分数。不用 string dispatch、Any 或把分支藏进散碎 helper 刷分。
6. 两次生成稳定、一个来源字段变化的局部差异、owned 退役与回锚更新。统一 writer 在最终格式后计算 spans/fingerprints；同包 traits 不从 ledger 依赖中漏掉。
7. 专属行为 suite 和实际编译命令 selector 尚未固定（D9）；本文没有猜一个不存在的测试类。后续由该闭包 owner 固定 suite 和一次集中的 sbt 命令、储存隔离/资源所有权及停止点后才运行。初始调度预算为生成/内容比对 5 分钟，局部编译/行为 15 分钟，超时返回已得证据，不启动银行全量验收。

## 10. 具体未决项

| ID | 裁定内容 | 不允许的替代 |
|---|---|---|
| D1 | **总装配 ABI / 唯一 owner**：formal 银行当前 object.load + 显式 Factory/Composition，聚合 bootstrap 是 object.create(persistenceId,initial,hosts)；选择如何提供传统 class/mixin init，同时保留 hosts、外置实现与原 persistenceId。是否 Guice eager、由谁构造 class、服务 Factory 何时交出已有系统必须一起确定 | 把 object 当 trait、在 ctor 再 new ActorSystem、重复 init、切换 PID 构造形式、删除 load/ready/close |
| D2 | **classic saga context 与顺序**：多 saga 是否允许 first-saga/first-participant 单 repo context；缺省 context resolver 与 inline name 不一致如何处理；raw engine-before-aggregate 与人工 aggregate-before-engine 选哪一项 | 自动拼万能 context，默默换序，选第一个但对外声称多 saga 都可运行 |
| D3 | **空 traits**：全空或 strict-only 输入应拒绝、抑制总装配还是发无 extends 的合法 class；此项是对 raw 的显式差异 | 保留非法 extends 却说可用、补虚构 NoopBootstrap |
| D4 | **生命周期 / partial startup**：strict kill switch 由谁保留/关闭；token 读取前普通 init 已有副作用；bank factory/create 位于 try 外、stop Future 未等待、close 可遮盖原异常。批准的失败/关闭语义和 raw 保真白名单须具体确定 | 默认加成功、吞异常、重复 close、将 installEventSource 变 replyWithAndPublish |
| D5 | **类型/命名输入域**：injectedFields 仅 `.name`、依赖非递归、repo 参数同短名碰撞、aggregate trait/init 两种基名算法、FieldDef 默认/注释字段未发射；明确拒绝条件或批准 signature/import alias 修正 | 合并 nominal types、自动覆盖同名字段或任意去后缀 |
| D6 | **formal 输入与 profile**：哪份已批准产品/技术绑定提供有序 aggregates/sagas/projections、context/repository refs、strict entries；是在 service producer 增版还是显式 profile。当前单 selected service renderer 与最小 A fixture并非天然同输入 | 未声明 options 下塞任意源码、从目录名猜可达、将 legacy spec 当正式产品、悄悄默认切到 family |
| D7 | **来源与旧文件退役**：raw noteIds 注释要求与实际 Nil 不符；formal 是 artifact source 单锚；确定聚合/投影/saga/strict entry 的来源并集、同包 trait directDeps、迁移后的旧 path 清理和最终 span | 手改 ledger/anchors、添加新 @knowledge 作者字段、沿用旧字节 offset |
| D8 | **实际胶水供应**：scaffold 的 saga-core/common-core 0.2、候选 JAR 开关与 formal pinned 0.3.0 不是同一供应；Guice/Inject、classic与strict entry API、仓储构造器须核实际消费制品 | 自行 publishLocal / runtime 重发 / 换 dependency pin，以源码存在证明 JAR ABI |
| D9 | **后续验证 selector 与 shared API**：固定最小同输入适配、可用测试 suite、shared TypeRef/layout/writer 接口、复杂度工具/版本与方法级口径 | 编造 testOnly 类名、宣称有现成 CLI artifact flag、用未测 CC 分数或总计数签收 |

文档保存不等待其他组，但 D1–D9 未关闭的实施/接口变更不能开始。观察内容与待裁定建议均已分别标明，没有用缺 counterpart 的位置填空成功。

## 11. extraSources（不复制、不修改）

生产链的额外当前源码仅一份；它不在 frozen index，链接明确为**可变工作副本**，不能作为固定 HEAD 的替身。

- [当前 `lib/project/implementation-evidence.mjs:28–46`](../../../lib/project/implementation-evidence.mjs#L28-L46)，绝对路径 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/lib/project/implementation-evidence.mjs`，2794 bytes，SHA-256 `da6889091818f35bac0e3a62e04a862ee4268fef6f7b94cad6fed80cb637aa76`；仅用于限定 generate-project implementation evidence 的证据含义。
- 进入工作区/仓库所读指引也透明登记：`/Users/zhongdj/Workspaces/mad-polaris/CLAUDE.md`，SHA-256 `d820979410916e446a0d4559fa8d3ca654468dab7459529fd919e49b38cb0ff3`；`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/AGENTS.md`，SHA-256 `8bfd761390a6fc90b09663157f9d35b23c0c58b20c9f6a41dd5698450015d601`。

未读取秘密、凭据值、进程实参/环境、transcripts 或 agent.output。模板中的配置 key 和环境变量占位符仅作为源文本观察，不读取实际值。

## 固定引用索引

[M]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/infrastructure/bootstrap/ApplicationBootstrapModel.scala#L1-L19
[B]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/bootstrap/ApplicationBootstrapBuilder.scala#L1-L135
[T]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/bootstsrap/ApplicationBootstrapTemplate.scala#L1-L93
[MAIN]: ../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L48-L201
[CQRS-RUN]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L170-L288
[CQRS-BOOT]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L1134-L1194
[WRITER]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L331-L424
[LAYOUT]: ../baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala#L88-L142
[TYPES]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4-L85
[ARTIFACT]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L5-L47
[DSL]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L13-L22
[RESOLVE-ACTOR]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L113-L130
[RESOLVE-BOOT]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L1005-L1020
[NAMES-BASE]: ../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L167-L259
[NAMES-BOOT]: ../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L575-L600
[BOOT-B]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/bootstrap/BootstrapBuilder.scala#L15-L236
[BOOT-T]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/bootstsrap/BootstrapTemplate.scala#L72-L217
[STRICT]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/FixtureHostTemplate.scala#L610-L695
[BUILD-PINS]: ../baseline/bc/scaffold/build.sbt#L127-L147
[GOLD]: ../baseline/curated-scala/net/imadz/infrastructure/bootstrap/ApplicationBootstrap.scala#L1-L52
[GMOD]: ../baseline/curated-scala/net/imadz/modules/BootstrapModule.scala#L1-L18
[BANK]: ../baseline/actual-js/app/example/bankwealth/infrastructure/bootstrap/ApplicationBootstrap.scala#L1-L25
[BANK-AGG]: ../baseline/actual-js/app/example/bankwealth/infrastructure/bootstrap/CreditBalanceBootstrap.scala#L1-L29
[SERVICE]: ../baseline/js/generators/scala-cqrs-play-service/render-service.mjs#L1-L205
[SERVICE-GEN]: ../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L1-L71
[PAGES]: ../baseline/js/generators/scala-cqrs-play-service/render-service-pages.mjs#L20-L52
[ENTRY]: ../baseline/js/generators/scala-cqrs-domain/naming.mjs#L1-L31
[PRODUCT-CLI]: ../baseline/js/lib/products/generate-cli.mjs#L45-L145
[PROJECT]: ../baseline/js/lib/project/cli.mjs#L91-L204
[CORE-PLAN]: ../baseline/js/src/core/generate.mjs#L23-L42
[APPLY]: ../baseline/js/src/core/generate.mjs#L235-L268
[LEGACY]: ../baseline/js/generators/bootstrap-dsl/emit.mjs#L1-L365
[RUN-ALL]: ../baseline/js/generators/run-all.mjs#L1880-L2030
[OLD-B]: ../baseline/js/generators/_deprecated/scala-cqrs-es/builders/bootstrap.mjs#L12-L181
[OLD-T]: ../baseline/js/generators/_deprecated/scala-cqrs-es/templates/persistence.mjs#L67-L73
[OLD-G]: ../baseline/js/generators/_deprecated/scala-cqrs-es/generate.mjs#L146-L178
[OLD-MANIFEST]: ../baseline/js/generators/_deprecated/scala-cqrs-es/generator.json#L1-L36
[FAM-B]: ../baseline/js/generators/scala-cqrs-play-application-v1/build-models.mjs#L1-L116
[FAM-G]: ../baseline/js/generators/scala-cqrs-play-application-v1/generate.mjs#L1-L42
[FAM-R]: ../baseline/js/generators/scala-cqrs-play-application-v1/render.mjs#L16-L47
[FAM-T]: ../baseline/js/generators/scala-cqrs-play-application-v1/templates/application.mjs#L1-L159
[FAM-L]: ../baseline/js/generators/scala-cqrs-play-application-v1/templates/loader.mjs#L1-L73
[JS-NAMES]: ../baseline/js/lib/scala-target/naming.mjs#L26-L118
