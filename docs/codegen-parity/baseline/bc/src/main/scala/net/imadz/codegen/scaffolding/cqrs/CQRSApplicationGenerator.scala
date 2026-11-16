package net.imadz.codegen.scaffolding.cqrs

import net.imadz.codegen.infra.FileSystem
import net.imadz.codegen.scaffolding.cqrs.builder.application._
import net.imadz.codegen.scaffolding.cqrs.builder.application.transactor._
import net.imadz.codegen.scaffolding.cqrs.builder.domain._
import net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.api.{
  AggregateStateControllerBuilder,
  CommandDslBuilder,
  ControllerBuilder,
  RoutesBuilder
}
import net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.bootstrap.{
  ApplicationBootstrapBuilder,
  BootstrapBuilder
}
import net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.persistence.{
  AggregateAdapterBuilder,
  AggregateConverterBuilder
}
import net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.proto.AggregateRootProtoBuilder
import net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.connector.ConnectorImplBuilder
import net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.repository.{
  AggregateRepositoryImplBuilder,
  ProjectionRepositoryImplBuilder
}
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.proto.ProtoFileModel
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.api.RoutesFragmentModel
import net.imadz.codegen.scaffolding.cqrs.template.application._
import net.imadz.codegen.scaffolding.cqrs.template.application.transactor.{
  FixtureHostTemplate,
  SagaContextTemplate,
  SagaDefinitionTemplate,
  SagaParticipantTemplate,
  SagaTriggerBehaviorsTemplate,
  SagaTriggerEntityTemplate,
  SagaTriggerProtocolTemplate,
  SagaTriggerRootTemplate
}
import net.imadz.codegen.scaffolding.cqrs.template.domain._
import net.imadz.codegen.scaffolding.cqrs.template.infrastructure.api.{
  AggregateStateControllerTemplate,
  CommandDslTemplate,
  ControllerTemplate,
  RoutesTemplate
}
import net.imadz.codegen.scaffolding.cqrs.template.infrastructure.bootstsrap.{
  ApplicationBootstrapTemplate,
  BootstrapTemplate
}
import net.imadz.codegen.scaffolding.cqrs.template.infrastructure.persistence.{
  AggregateConverterTemplate,
  EventAdapterTemplate,
  SnapshotAdapterTemplate
}
import net.imadz.codegen.scaffolding.cqrs.template.infrastructure.proto.ProtoTemplate
import net.imadz.codegen.scaffolding.cqrs.template.infrastructure.connector.ConnectorImplTemplate
import net.imadz.codegen.scaffolding.cqrs.template.infrastructure.repository.{
  AggregateRepositoryImplTemplate,
  ProjectionRepositoryImplTemplate
}
import net.imadz.meta._

import java.nio.file.{Files, Paths}

/** AppGenerator: 代码生成器的总装车间。
  */
object CQRSApplicationGenerator {

  // E5-WP1（2026-09-12）：关注点增量参数——单次 generate 运行的作用域守卫与生成台账。
  // B 策略（用户裁决）：默认 All（零行为变化）；gen_pipeline v1 不传 concern prop，
  // 台账仅当 -Dcodegen.ledger=<path> 给定时落盘（gen_pipeline 显式传 staging 路径）。
  private var currentScope: ScopeFilter = ScopeFilter.All
  private var currentLedger: GenerationLedger = new GenerationLedger(None)
  /** 多项目模式（codegen-multi-project M2a）：true ⇒ writeArtifact 按 kind 查表注入 modules/<m>/ 前缀。
    * 默认 false＝单项目模式零漂移（golden master/真仓现行布局全不变）。 */
  private var multiProject: Boolean = sys.props.get("codegen.multiProject").contains("true")
  // E5-WP1：deps 归主解析用（嵌套类型名 → 拥有者元数据名）——SymbolTable 在 fromSystemMetadata 装配
  private var currentSymbolTable: SymbolTable = SymbolTable.empty
  // EP_Knowledge_Release_Version_Pin（2026-09-21·合并环节）：本次生成所依据的知识发布版本标签。
  // 取自导出物 meta.knowledgeRelease（'none' ＝ 无已发布版本·显式标注非静默）；null ＝ 未提供（不发第二行）。
  private var knowledgeRelease: String = null
  // 元素级内容哈希（noteId → hash8）——`@knowledge <noteId>@<hash8>` 的元素级轴；null/空 ＝ 不发
  private var elementHashes: Map[String, String] = Map.empty
  // P8（2026-10-24）：strict saga 制品的回锚收集。anchorRoot＝本次 strict 生成的根（plan.target），
  // 仅 strict 路径置位——legacy generate() 恒 null（零行为变化·legacy saga 不入锚）；saga 制品的
  // 落点相对该根记录（单项目 app/ 与 test/ 两侧都在根内）。definitionDigest 侧表来自 admitted
  // 契约（SagaExecutionMetadata 第 4 字段），逐 location 随锚发射＝跨管线对账钉。
  private var anchorRoot: java.nio.file.Path = null
  private var sagaDefinitionDigests: Map[String, String] = Map.empty
  private val sagaAnchorDeclarations =
    scala.collection.mutable.LinkedHashMap.empty[String, scala.collection.mutable.LinkedHashSet[java.nio.file.Path]]
  private val anchorWriteFingerprints = scala.collection.mutable.LinkedHashMap.empty[java.nio.file.Path, String]
  /** 元素 hash 后缀（形如 `@ab12cd34`），无则空串——四处 @knowledge 发射点共用。 */
  def elementHashSuffix(noteId: String): String =
    if (noteId == null) "" else elementHashes.get(noteId).map(h => s"@$h").getOrElse("")

  /** 给 @knowledge 的 noteId 追加元素内容哈希（`<noteId>@<hash8>`）——元素级轴。
    * 无 hash（该 id 不在导出物哈希表·如概念级 id）或 none → 原样返回（保真·不臆造）。 */
  def annotateKnowledge(noteId: Option[String]): Option[String] =
    noteId.map(id => id + elementHashSuffix(id))

  /** 文件指纹头（gen_manifest 的 KEEP/COVER 判定依据·无指纹＝纯手写永不覆盖）。
    * EP_Knowledge_Release_Version_Pin：第二行记知识发布版本（'@knowledge-release <tag>'）——
    * 一次生成一个版本（全产物一致）；knowledgeRelease==null 时只发第一行（零行为变化·向后兼容）。
    *
    * ★ 2026-09-24（EP §19.4「生成器版本载体」收尾）：第一行的 `<ver>` 由**硬编码日期**改为
    * `GeneratorVersion.value`（＝生成器仓库生成时刻 git 短号·回退日期）——G 的第二个参数落地，
    * 「同一知识两个生成器版本产出不同代码」可对账。commit 号不参与任何比对（指纹判据只看
    * `@generated by` 行前缀·见 WriteTerritory.FingerprintMark），零行为变化。 */
  private def fingerprintHeader: String =
    if (knowledgeRelease == null) s"// @generated by CodegenMain:${GeneratorVersion.value}\n"
    else s"// @generated by CodegenMain:${GeneratorVersion.value}\n// @knowledge-release $knowledgeRelease\n"

  def generate(
      system: SystemMetadata,
      outputRoot: String,
      scope: ScopeFilter = ScopeFilter.All,
      excludedStateFieldNatures: Set[String] = Set.empty,
      knowledgeReleaseTag: String = null,
      elementHashById: Map[String, String] = Map.empty,
      formalSemantics: Option[net.imadz.meta.filesystem.FormalSemantics] = None
  ): Unit = runCommon(system, outputRoot, scope, excludedStateFieldNatures, knowledgeReleaseTag, elementHashById, None, formalSemantics)

  /** Opt-in product source plan; reuses territory writes and actual-byte file anchors. */
  private[codegen] def generateProducts(plan: net.imadz.codegen.SemanticProductsGenerationPlan): Unit = {
    require(plan != null && !Files.exists(plan.target, java.nio.file.LinkOption.NOFOLLOW_LINKS), "new exclusive product target required")
    Files.createDirectories(plan.target)
    val declarations = scala.collection.mutable.LinkedHashMap.empty[String, scala.collection.mutable.LinkedHashSet[java.nio.file.Path]]
    val fingerprints = scala.collection.mutable.LinkedHashMap.empty[java.nio.file.Path, String]
    val rows = plan.entries.map { entry =>
      val path = SagaAnchorIndex.preflightPath(plan.target, plan.target.resolve(entry.path))
      val accepted = writeTerritorial(path.toString, entry.content)
      require(accepted, "required product source was not written: " + entry.path)
      val fingerprint = SagaAnchorIndex.fingerprint(Files.readAllBytes(path))
      fingerprints(path) = fingerprint
      entry.sources.foreach { source =>
        val key = "source:" + source.document + "#" + source.pointer
        declarations.getOrElseUpdate(key, scala.collection.mutable.LinkedHashSet.empty) += path
      }
      ujson.Obj("path" -> entry.path, "kind" -> entry.kind, "fingerprint" -> fingerprint,
        "productFootprint" -> ujson.Arr.from(entry.footprint.map(p => ujson.Obj("id" -> p.id, "version" -> p.version))),
        "knowledgeIds" -> ujson.Arr.from(entry.sources.map(s => "source:" + s.document + "#" + s.pointer)),
        "deps" -> ujson.Arr.from(entry.dependencies))
    }
    Files.write(plan.target.resolve("truthsrc.ledger.json"), (ujson.write(ujson.Obj("generator" -> "codegen-main", "entries" -> ujson.Arr.from(rows)), indent = 2) + "\n").getBytes(java.nio.charset.StandardCharsets.UTF_8))
    SagaAnchorIndex.writeKnowledgeKeys(plan.target, declarations, Map.empty, "semantic-products-1", fingerprints.toMap)
  }

  /** Independent admitted v3 dispatch; never drops sagas into legacy generate. */
  def generateAdmitted(
      system: SystemMetadata, outputRoot: String, plan: net.imadz.codegen.StrictSagaGenerationPlan,
      scope: ScopeFilter = ScopeFilter.All, excludedStateFieldNatures: Set[String] = Set.empty,
      knowledgeReleaseTag: String = null, elementHashById: Map[String, String] = Map.empty,
      formalSemantics: Option[net.imadz.meta.filesystem.FormalSemantics] = None,
      composition: Option[net.imadz.meta.execution.CompositionBindingAdapter.CompositionFacePlan] = None
  ): Unit = {
    require(plan != null, "strict saga generation plan is required")
    require(outputRoot != null, "strict saga output root is required")
    val root = Paths.get(outputRoot)
    require(root.isAbsolute, "strict saga output root must be absolute")
    val expectedRoot = if (plan.multiProject) plan.target else plan.target.resolve("app")
    require(root.normalize == expectedRoot, "strict saga output root must match the planned source root")
    plan.validateAgainst(system, plan.target, plan.multiProject)
    val priorMode = multiProject
    try runCommon(system, expectedRoot.toString, scope, excludedStateFieldNatures, knowledgeReleaseTag, elementHashById, Some(plan), formalSemantics, composition)
    finally multiProject = priorMode
  }

  private def runCommon(
      system: SystemMetadata, outputRoot: String, scope: ScopeFilter,
      excludedStateFieldNatures: Set[String], knowledgeReleaseTag: String,
      elementHashById: Map[String, String], strict: Option[net.imadz.codegen.StrictSagaGenerationPlan],
      formalSemantics: Option[net.imadz.meta.filesystem.FormalSemantics] = None,
      composition: Option[net.imadz.meta.execution.CompositionBindingAdapter.CompositionFacePlan] = None
  ): Unit = {
    strict.foreach(p => multiProject = p.multiProject)
    println(s"🚀 Starting Code Generation for system: ${system.name}...")
    currentScope = scope
    currentLedger = new GenerationLedger(sys.props.get("codegen.ledger"))
    knowledgeRelease = knowledgeReleaseTag
    elementHashes = elementHashById
    // P8：锚状态按本次运行重置（strict 置位 / legacy 清空——同 JVM 多次生成的测试面不串run）
    anchorRoot = strict.map(_.target.normalize).orNull
    sagaDefinitionDigests = strict
      .map(_.models.map(m => ("saga:" + m.pinned.execution.sagaId) -> m.pinned.execution.definitionDigest).toMap)
      .getOrElse(Map.empty)
    sagaAnchorDeclarations.clear()
    anchorWriteFingerprints.clear()
    if (knowledgeRelease != null) println(s"📌 Knowledge release: $knowledgeRelease（元素哈希 ${elementHashes.size} 条）")

    val ctx0 = GeneratorContext.fromSystemMetadata(system, formalSemantics)
    currentSymbolTable = ctx0.symbolTable
    val ctx = ctx0.copy(scope = scope, excludedStateFieldNatures = excludedStateFieldNatures)

    // 确保 Proto 输出目录存在 (Play 约定: app/protobuf；多项目模式 proto 归 glue·POC-3.2 判例)
    val protoDir = if (multiProject) Paths.get(outputRoot, "modules/glue/src/main/protobuf") else Paths.get(outputRoot, "protobuf")
    if (!Files.exists(protoDir)) Files.createDirectories(protoDir)

    // 字段知识锚点（EP_Note_Tense_Knowledge_Id 末段）：发射前一次性挂上台账，flush 写顶层 fieldAnchors 键——
    // 「这个生成侧字段出自哪个知识元素」由此可查（真源便签 noteId → 代码字段）。
    currentLedger.withFieldAnchors(FieldKnowledgeAnchors.solve(system))
    // 分层生成
    generateDomainLayer(system.domain, ctx, outputRoot)
    generateApplicationLayer(system.application, ctx, outputRoot)
    generateInfrastructureLayer(
      system,
      ctx,
      outputRoot,
      protoDir.toString
    ) // 传入 protoDir
    generateInterfaceLayer(system.interfaces, ctx, outputRoot)
    // S1 聚合面（2026-09-27 用户拍板）：写侧 GetState 强一致查询控制器——每聚合一个
    // GET /api/state/<agg>/:id 方法（ClusterSharding entityRef.ask(GetState) → 直接返回）。
    generateAggregateStateController(system, ctx, outputRoot)
    // P5: single-project mode only — multi-project glue modules carry no bootstrap
    // wiring (declared boundary; the verification emission targets the standalone app).
    val strictEntryFqns = if (multiProject) Seq.empty
      else strict.map(p => p.models.map(m => m.pinned.execution.contract.binding.engine.entrypoint.dottedPath)).toSeq.flatten
    generateBootstraps(system, ctx, outputRoot, strictEntryFqns)
    strict.foreach { plan =>
      val seenEntryOutputs = scala.collection.mutable.LinkedHashSet.empty[String]
      plan.models.zip(plan.sources).foreach { case (model, source) =>
        writeArtifact(model, source,
          outputRoot, Some(ArtifactAttribution("strict-saga-module", model.pinned.execution.sagaId, "saga",
            model.pinned.execution.contract.definition.payload.participants.map(_.aggregate.targetName).distinct.toList)))
        // P4 Slice 2: the fixture-host family — the concrete Host implementation that
        // discharges the emitted module's Host obligations, derived mechanically from
        // the same admitted contract plus the aggregate metadata (state-query face,
        // writtenBy evidence lineage). Emissions, not readiness: flags stay untouched.
        val hostModel = FixtureHostBuilder.build(model.pinned, model, ctx)
        val hostFiles = FixtureHostTemplate.generateFiles(hostModel)
        val entryFqn = hostModel.packagePath + "." + hostModel.entryName
        if (!seenEntryOutputs.add(entryFqn))
          throw new IllegalStateException(s"strict fixture entry collision: $entryFqn is the binding entrypoint of more than one saga module")
        hostFiles.foreach { case (selfType, content) =>
          writeArtifact(FixtureFileModel(selfType, hostModel.dependencies), content, outputRoot,
            Some(ArtifactAttribution("strict-fixture-host", model.pinned.execution.sagaId, "saga",
              model.pinned.execution.contract.definition.payload.participants.map(_.aggregate.targetName).distinct.toList)))
        }
        // P5: the emitted business-safety verification spec lives in the sbt test layout.
        if (!multiProject) {
          val testRoot = Paths.get(outputRoot).getParent.resolve("test").toString
          FixtureHostTemplate.generateTestFiles(hostModel).foreach { case (selfType, content) =>
            writeArtifact(FixtureFileModel(selfType, hostModel.dependencies), content, testRoot,
              Some(ArtifactAttribution("strict-fixture-host", model.pinned.execution.sagaId, "saga",
                model.pinned.execution.contract.definition.payload.participants.map(_.aggregate.targetName).distinct.toList)))
          }
        }
      }
    }
    // P15 composition face: the InvocationPipelineHost family (host + monarch
    // child plan + E1–E5 acceptance spec) rides the admitted strict face; the
    // builder cross-checks every invocation entrypoint against the v3 token.
    composition.foreach { plan =>
      require(strict.isDefined, "the composition face requires the admitted strict face")
      require(!multiProject, "the composition face targets the standalone single-project app")
      val model = builder.application.transactor.CompositionHostBuilder.build(plan, strict.get.admitted, ctx)
      val files = template.application.transactor.InvocationHostTemplate.generateFiles(model)
      files.foreach { case (selfType, content) =>
        val keys = Set("pipeline:" + plan.pipelineId) ++
          (if (selfType.name == model.child.planObj) Set("pipeline:" + model.child.planId) else Set.empty[String])
        writeArtifact(FixtureFileModel(selfType, Set.empty), content, outputRoot,
          Some(ArtifactAttribution("invocation-host", plan.pipelineId, "pipeline", Nil)), keys)
      }
      val testRoot = Paths.get(outputRoot).getParent.resolve("test").toString
      template.application.transactor.InvocationHostTemplate.generateTestFiles(model).foreach { case (selfType, content) =>
        writeArtifact(FixtureFileModel(selfType, Set.empty), content, testRoot,
          Some(ArtifactAttribution("invocation-host", plan.pipelineId, "pipeline", Nil)), Set("pipeline:" + plan.pipelineId))
      }
    }
    // S7 #1c 合流点：控制台 → 台账的反向传递表落盘（见 bootstrapNoteIdPatches 注释）。
    // 必须位于 flush 之前（flush 一落盘，Node 侧随即 upsert 本表）。
    currentLedger.withCodegenPatches(bootstrapNoteIdPatches(system, ctx))

    // E5-WP1：台账落盘（仅当 -Dcodegen.ledger 给定；staging 根由 gen_pipeline 传入）
    currentLedger.flush().foreach { p =>
      println(s"📒 Generation ledger: ${currentLedger.size} artifacts → $p")
    }

    // P8：saga 锚索引落盘（有 saga 制品才写·输出根同 knowledge-release.json 惯例）——
    // 与 js 管线（truthsrc saga-dsl）的索引同格式分属两仓，查询侧（truthsrc queryAnchorsIndex）
    // 跨索引联合，互不合并。
    if (sagaAnchorDeclarations.nonEmpty) {
      val file = SagaAnchorIndex.writeKnowledgeKeys(anchorRoot, sagaAnchorDeclarations, sagaDefinitionDigests,
        GeneratorVersion.value, anchorWriteFingerprints.toMap)
      val count = sagaAnchorDeclarations.values.map(_.size).sum
      println(s"⚓ Saga anchor index: $count locations → $file")
    }

    println(s"✅ Generation Complete for ${system.name}!")
  }

  /** E5-WP1：反向引用扫描——聚合全引用面（identifier/实体/状态/事件族/行为/命令参数/事件字段）
    * 中出现的 targetName → 归属族。VO/实体/行为等无 owning-aggregate 反向引用的 domain 制品
    * 据此获得 family 归属（台账行 + Concern 过滤共用；扩展算法只在 Scala 实现一次）。 */
  private def referencingFamilies(
      nodeName: String,
      ctx: GeneratorContext
  ): List[String] = {
    val aggregates = ctx.metaRegistry.resolveAll[AggregateRootMetadata]
    def refTargets(t: MetaType): List[String] = t match {
      case r: MetaRef => List(r.targetName)
      case _ => Nil
    }
    aggregates.flatMap { agg =>
      val eventFamily =
        ctx.metaRegistry.resolveByName[EventFamilyMetadata](agg.eventFamilyRef.targetName)
      val refs: List[String] =
        refTargets(agg.identifier.fieldType) ++
          List(
            agg.entityRef.targetName,
            agg.stateRef.targetName,
            agg.eventFamilyRef.targetName,
            agg.behaviorRef.targetName
          ) ++
          agg.commandFamily.commands.flatMap { c =>
            c.parameters.flatMap(p => refTargets(p.parameterType)) ++
              c.replyToType.map(_.targetName).toList
          } ++
          eventFamily.toList.flatMap(ef =>
            ef.events.flatMap(e => e.fields.flatMap(f => refTargets(f.fieldType)))
          )
      if (refs.contains(nodeName)) List(agg.name) else Nil
    }.distinct.sorted.toList
  }

  // ── targetModule 查表（EP_Module_Layering_Phase2·codegen-multi-project M1）──
  // 映射权威＝di-poc 现布局对账（2026-10-03 机械推导·100% rename 证据）；ext 生成器不产。
  // None＝单项目模式（现行行为·零漂移）——gen_pipeline --multi-project 开启后才有模块前缀。
  private def targetModuleOf(kind: String): Option[String] = {
    if (!multiProject) return None
    Some(kind match {
      // kernel（领域·纯函数）
      case "vo" | "entity" | "event-handlers" | "rules" | "aggregate" | "protocol" |
           "behavior" | "behavior-skeleton" | "command-helpers" | "repository-iface" |
           "projection-repo-iface" |
           "projection-apply-event" => "kernel"
      // projection（投影 object：sourceProvider/createProjection/组合分发器）＝机制件 → glue
      case "projection" => "glue"
      // glue（框架适配·免测试）
      case "projection-handler" | "projection-repo-impl" | "bootstrap" | "converter" |
           "event-adapter" | "snapshot-adapter" | "repository-impl" => "glue"
      // root（Play 壳·controllers/routes/conf）
      case "controller" | "command-dsl" | "rolemap" => "root"
      case "strict-saga-module" | "strict-fixture-host" => "glue"
      // 未登记 kind（domain-service/connector 等 Examples 侧）→ 单项目兜底
      case _ => return None
    })
  }

  // --- Helper: 通用 Scala 文件写入 ---
  /** Per-file view over a FixtureHostModel: writeArtifact paths derive from selfType,
    * ledger deps ride the host model's structural set. */
  private final case class FixtureFileModel(selfType: TypeRef, dependencyRefs: Set[TypeRef]) extends ArtifactModel {
    override def dependencies: Set[TypeRef] = dependencyRefs
  }

  private def writeArtifact(
      model: ArtifactModel,
      content: String,
      outputRoot: String,
      attribution: Option[ArtifactAttribution] = None,
      knowledgeKeys: Set[String] = Set.empty
  ): Unit = {
    val packagePath = model.selfType.packageName.replace('.', '/')
    // 多项目模式：模块前缀 = modules/<m>/app/...（root 模块即原 app/...·app 源目录语义不变）
    // 布局＝modules/<m>/src/main/scala/<pkg>（sbt 约定·di-poc 实形）；outputRoot＝targetDir（multi）
    // 单项目模式：outputRoot 即 app 目录——前缀空串（零漂移）；multi 的 root 面（controller 等）
    // 也不加模块（app/ 原位·Play 壳约定）。targetModuleOf 返回 None 的兜底同理。
    val modulePrefix = if (!multiProject) ""
      else attribution.flatMap(a => targetModuleOf(a.kind)) match {
        case Some(m) if m != "root" => s"modules/$m/src/main/scala"
        case _                      => "app"
      }
    val filePath = Paths
      .get(outputRoot, modulePrefix, packagePath, s"${model.selfType.name}.scala")
      .toString
    // E5-WP1：Scope 守卫（choke point·默认 All 零行为变化；Option A 真跳过预留——
    // 启用需 refill 前置于 rules 步的管线重排，见计划「不做」节）
    attribution.foreach { a =>
      // deps＝该制品 Builder 声明的 Scala 依赖（ArtifactModel.dependencies·结构性而非文本 import）。
      // Node 侧编译闭包扩展纯查表：in-scope ∪ 传递 deps 闭包（converter→Protocol 等同节点跨 flavor
      // 依赖连带提升，否则真仓编译红——2026-09-12 用户指出的缺口）。
      // deps 归主解析：嵌套类型名（Protocol 文件内的 command/event case class 等）经
      // SymbolTable 解析到拥有者元数据名——Node 闭包按 ledger schemaNode 回映即可连带
      // 该节点的全部制品（粗粒度保守向：多拉不漏拉）。
      val deps = model.dependencies
        .map(t => currentSymbolTable.resolve(NestedTypeName(t.name)).map(_.name).getOrElse(t.name))
        .toList
        .sorted
      val relative = Paths.get(outputRoot).relativize(Paths.get(filePath)).toString
      val ledgerPath = if (a.kind == "strict-saga-module" && multiProject) relative else s"app/$relative"
      // S7（EP §二 G1）：`noteIds` 与 `deps` 同手法——**模型自述**（`ArtifactModel.noteIds`）、漏斗处合流。
      // 台账 `artifacts[]` 由此成为**文件级落点的完整索引**（含知识身份）。
      currentLedger.record(ledgerPath, a.copy(deps = deps, noteIds = model.noteIds.toList))
      // ★ S1（EP_GenerationTime_Code_Anchors）：模型**声明的态射**在此记账。
      // 唯一漏斗在这儿给它们盖章 `path` 与宿主名——模型自己不知道落盘路径，漏斗不知道关系语义，
      // 两端信息各出一半，故在漏斗处合流（builder 因此保持纯函数）。
      currentLedger.recordMorphisms(ledgerPath, model.selfType.name, model.morphisms)
      if (!currentScope.includes(a)) {
        println(s"🎛  [SCOPE-SKIP] ${a.schemaCategory}/${a.schemaNode} 的 ${a.kind} 不在关注点范围内——跳过生成")
        return
      }
    }
    // 2026-08-23 生成补丁管线：指纹头注入（gen_manifest 的 KEEP/COVER 判定依据；
    // 无指纹 = 纯手写文件，永不覆盖）
    val anchorKeys = knowledgeKeys ++ attribution.filter(_.schemaCategory == "saga").map(a => "saga:" + a.schemaNode)
    if (anchorRoot != null && anchorKeys.nonEmpty)
      SagaAnchorIndex.preflightPath(anchorRoot, Paths.get(filePath).normalize)
    val fingerprinted = fingerprintHeader + content
    val written = writeTerritorial(filePath, fingerprinted)
    // P8：回锚收集——只记 strict 运行中真实写成的 saga 制品（anchorRoot 仅 strict 置位，
    // legacy generate() 恒 null 零行为变化；scope-skip 在上方已 return、拒绝领地/KEEP written=false）。
    if (written && anchorRoot != null) {
      if (anchorKeys.nonEmpty) {
        val path = Paths.get(filePath).normalize
        val fingerprint = SagaAnchorIndex.fingerprint(Files.readAllBytes(path))
        anchorWriteFingerprints(path) = fingerprint
        anchorKeys.toVector.sorted.foreach { key =>
          sagaAnchorDeclarations.getOrElseUpdate(key, scala.collection.mutable.LinkedHashSet.empty) += path
        }
      }
    }
  }

  // --- Helper: Proto 文件写入 (扁平化到 app/protobuf) ---
  private def writeProto(
      model: ProtoFileModel,
      content: String,
      protoDir: String,
      attribution: Option[ArtifactAttribution] = None
  ): Unit = {
    // 直接写入 protoDir，忽略包路径
    val filePath = Paths.get(protoDir, model.fileName).toString
    attribution.foreach { a =>
      // S7（EP §二 G1）：proto 走独立写盘口（不写 .scala）——`noteIds` 须与此前 writeArtifact
      // 同合流（2026-09-23 实测缺口：27 行 proto 全 0 号，模型有 noteIds 而此处没抄）。
      // 多项目模式 protoDir 已含 modules/glue 前缀——台账路径照实拼（POC-3.2 判例：线格式簇全在 glue）。
      val protoRel = Paths.get(protoDir).relativize(Paths.get(filePath)).toString
      currentLedger.record(
        s"app/protobuf/$protoRel",
        a.copy(noteIds = model.noteIds.toList)
      )
      if (!currentScope.includes(a)) {
        println(s"🎛  [SCOPE-SKIP] ${a.schemaCategory}/${a.schemaNode} 的 ${a.kind} 不在关注点范围内——跳过生成")
        return
      }
    }
    val fingerprinted = fingerprintHeader + content
    writeTerritorial(filePath, fingerprinted)
    println(s"📜 Generated Proto: $filePath")
  }

  /** S2-48 批1（2026-09-05）：领地四模式写盘——ADD 新建／MERGE 保 MANUAL 块换外壳／
    * COVER 指纹文件覆盖（原行为）／KEEP 纯手写拒写（codegen.migrate=true 放行）。
    * 判定原语＝gen_manifest.mjs C1-C5 的写盘时刻化（此前只在 staging 补丁管线生效，
    * CodegenMain 直跑完全绕过——182 个 handler MANUAL 块被冲 ??? 的结构性根源）。
    * 详见 WriteTerritory 类注释。
    * P8：返回值＝是否由本次生成落盘（拒绝领地/KEEP 拒写＝false）——回锚只记真实写成的文件。 */
  private def writeTerritorial(filePath: String, fingerprinted: String): Boolean = {
    import WriteTerritory._
    // S2-48 挂账⑥(b)：R6-Ⅰ 冻结领地——路径级拒写（内容判定之前；解冻＝R6-Ⅱ 显式批）。
    // 2026-09-10 B2 修正「三翼矛盾」：api 翼发射段已退役（R6-Ⅰ 注记），repo trait 引擎侧
    // CodegenMain 独家发射——冻结若连首填 ADD 也拒，新聚合族 trait 无人发射（CemEdge 等 4 族
    // 「is not a member of package repository」×4 编译红实证）。语义收敛为「护存量·放首填」：
    // 已有文件（含手写/历史生成）恒拒写；目标不存在＝首填，放行留痕。gen_manifest FROZEN_RULES 同步。
    if (WriteTerritory.isFrozenTerritory(filePath)) {
      val existingFrozen = FileSystem.read(filePath)
      if (existingFrozen.isDefined) {
        println(
          s"🧊 [FROZEN] $filePath 属 R6-Ⅰ 冻结领地（ingested-app repos frozen until R6-Ⅱ）——拒绝写盘"
        )
        return false
      }
      FileSystem.write(filePath, fingerprinted).unsafeRun()
      println(s"🧊 [FROZEN·首填] $filePath 属冻结领地且目标不存在——首填放行（此后恒拒写护存量）")
      return true
    }
    val existing = FileSystem.read(filePath)
    judge(existing) match {
      case AddMode | CoverMode =>
        FileSystem.write(filePath, fingerprinted).unsafeRun()
        true
      case MergeMode =>
        val merged =
          mergeManual(existing.get, fingerprinted, Paths.get(filePath))
        FileSystem.write(filePath, merged).unsafeRun()
        println(s"🛡  MERGE: MANUAL 手写块字节级保留 → $filePath")
        true
      case KeepMode =>
        if (sys.props.getOrElse("codegen.migrate", "false").toBoolean) {
          FileSystem.write(filePath, fingerprinted).unsafeRun()
          println(
            s"⚠️  [KEEP→migrate] $filePath 无指纹无 MANUAL——codegen.migrate 显式接管覆盖"
          )
          true
        } else {
          println(
            s"🛡  [KEEP] $filePath 无指纹头也无 MANUAL 块——判定为纯手写文件，拒绝覆盖" +
              s"（-Dcodegen.migrate=true 可放行）"
          )
          false
        }
    }
  }

  // ==========================================
  // Layer 1: Domain
  // ==========================================
  private def generateDomainLayer(
      domain: DomainLayer,
      ctx: GeneratorContext,
      root: String
  ): Unit = {
    domain.valueObjects.foreach { meta =>
      val model = ValueObjectBuilder.build(meta, ctx)
      writeArtifact(
        model,
        ValueObjectTemplate.generate(model),
        root,
        Some(
          ArtifactAttribution(
            "vo",
            meta.name,
            "valueObject",
            referencingFamilies(meta.name, ctx)
          )
        )
      )
    }
    domain.entities.foreach { meta =>
      val model = DomainEntityBuilder.build(meta, ctx)
      writeArtifact(
        model,
        DomainEntityTemplate.generate(model),
        root,
        Some(
          ArtifactAttribution("entity", meta.name, "entity", referencingFamilies(meta.name, ctx))
        )
      )
    }
    domain.behaviors.foreach { meta =>
      val model = EntityBehaviorBuilder.build(meta, ctx)
      writeArtifact(
        model,
        EntityBehaviorTemplate.generate(model),
        root,
        Some(
          ArtifactAttribution(
            "event-handlers",
            meta.name,
            "entity",
            referencingFamilies(meta.eventFamilyRef.targetName, ctx)
          )
        )
      )
    }
    domain.invariants.foreach { meta =>
      val model = InvariantRuleBuilder.build(meta, ctx)
      writeArtifact(
        model,
        InvariantRuleTemplate.generate(model),
        root,
        Some(
          ArtifactAttribution(
            "rules",
            meta.name,
            "aggregate",
            referencingFamilies(meta.subject.targetName, ctx)
          )
        )
      )
    }
    // S2-46（2026-09-05）PolicyBuilder/PolicyTemplate 退役：domain/policy 语义面由 Node 侧
    // rules_domain_gen Policy 发射段承接（<Agg>Policies.scala·纯反应对象·S2-44 拍板）；
    // 本段曾发 PolicyOn*.scala Runner 形态 ??? 死桩——真仓 S2-44 已删 5 桩，本批新增 2 policy
    // （DoR通过后请求合并知识/立项后创建目录版本）令死桩复活为 8 个，故整段停发射。
    // Runner 接线（eventsByTag→Policy.on→组信封 ask）归 BUG-015 批落地。
    // domain.policies.foreach { meta =>
    //   val model = PolicyBuilder.build(meta, ctx)
    //   writeArtifact(model, PolicyTemplate.generate(model), root)
    // }
    domain.services.foreach { meta =>
      val model = DomainServiceBuilder.build(meta, ctx)
      writeArtifact(
        model,
        DomainServiceTemplate.generate(model),
        root,
        Some(ArtifactAttribution("domain-service", meta.name, "global", Nil))
      )
    }
  }

  // ==========================================
  // Layer 2: Application
  // ==========================================
  private def generateApplicationLayer(
      app: ApplicationLayer,
      ctx: GeneratorContext,
      root: String
  ): Unit = {
    // 1. Aggregates
    app.aggregates.foreach { meta =>
      val aggAttribution = meta.metaCategory match {
        case "application.services.transactor" =>
          ArtifactAttribution("saga-participant", meta.name, "saga", List(meta.name))
        case _ => ArtifactAttribution("aggregate", meta.name, "aggregate", List(meta.name))
      }
      // Root
      val model = AggregateRootBuilder.build(meta, ctx)
      writeArtifact(
        model,
        AggregateRootTemplate.generate(model),
        root,
        Some(aggAttribution)
      )

      // [NEW] Protocol
      val protocolModel = AggregateProtocolBuilder.build(meta, ctx)
      writeArtifact(
        protocolModel,
        AggregateProtocolTemplate.generate(protocolModel),
        root,
        Some(
          ArtifactAttribution(
            "protocol",
            meta.name,
            if (meta.metaCategory == "application.services.transactor") "saga" else "aggregate",
            List(meta.name)
          )
        )
      )

      // [FIX] Factory (Now Enabled)
      val factoryModel = AggregateFactoryBuilder.build(meta, ctx)
      writeArtifact(
        factoryModel,
        AggregateFactoryTemplate.generate(factoryModel),
        root,
        Some(aggAttribution)
      )

      // Behavior
      val behaviorModel = AggregateBehaviorBuilder.build(meta, ctx)
      writeArtifact(
        behaviorModel,
        AggregateBehaviorTemplate.generate(behaviorModel),
        root,
        Some(
          ArtifactAttribution(
            "behavior-skeleton",
            meta.name,
            if (meta.metaCategory == "application.services.transactor") "saga" else "aggregate",
            List(meta.name)
          )
        )
      )

      // Helpers (Skip for Saga)
      if (meta.metaCategory != "application.services.transactor") {
        val helpersModel = CommandHelpersBuilder.build(meta, ctx)
        writeArtifact(
          helpersModel,
          CommandHelpersTemplate.generate(helpersModel),
          root,
          Some(ArtifactAttribution("command-helpers", meta.name, "aggregate", List(meta.name)))
        )
        // P4 formal-path rules（<Agg>Rules.scala）：真源 guards+bindings 可机械解析才发射；
        // formalSemantics 缺省＝不发射（Examples 零漂移）。
        AggregateRulesBuilder.build(meta, ctx).foreach { rulesModel =>
          writeArtifact(
            rulesModel,
            AggregateRulesTemplate.generate(rulesModel),
            root,
            Some(ArtifactAttribution("rules-formal", meta.name, "aggregate", List(meta.name)))
          )
        }
      }
    }

    // 2. Repositories
    app.repositories.foreach {
      case m: AggregateRepositoryMetadata =>
        val model = AggregateRepositoryBuilder.build(m, ctx)
        writeArtifact(
          model,
          AggregateRepositoryTemplate.generate(model),
          root,
          Some(
            ArtifactAttribution(
              "repository-iface",
              m.aggregate.targetName,
              "aggregate",
              List(m.aggregate.targetName)
            )
          )
        )
      case _ =>
    }

    // 2b. Connectors（2026-09-20 EP_Improvement_Engine）：调外部工具的能力面 trait（@ImplementedBy）
    app.connectors.foreach { m =>
      val model = ConnectorBuilder.build(m, ctx)
      writeArtifact(
        model,
        ConnectorTemplate.generate(model),
        root,
        Some(ArtifactAttribution("connector-iface", m.name, "global", Nil))
      )
    }

    // 3. Services
    app.services.foreach { meta =>
      val model = ApplicationServiceBuilder.build(meta, ctx)
      writeArtifact(
        model,
        ApplicationServiceTemplate.generate(model),
        root,
        Some(ArtifactAttribution("application-service", meta.name, "global", Nil))
      )
    }

    // 4. Queries
    app.queries.foreach { meta =>
      val model = QueryServiceBuilder.build(meta, ctx)
      writeArtifact(
        model,
        QueryServiceTemplate.generate(model),
        root,
        Some(ArtifactAttribution("query-service", meta.name, "global", Nil))
      )
    }

    // 5. Sagas (v3: AskParticipant participants + declarative SagaDefinition
    //    + v3 trigger aggregate family — Protocol/Entity/Root/Behaviors, §13;
    //    NOT the v2 shadow aggregate)
    app.sagas.foreach { meta =>
      meta.participants.foreach { pMeta =>
        val pModel = SagaParticipantBuilder.build(pMeta, meta, ctx)
        writeArtifact(
          pModel,
          SagaParticipantTemplate.generate(pModel),
          root,
          Some(ArtifactAttribution("saga-participant", pMeta.name, "saga", List(meta.name)))
        )
      }

      val defModel = SagaDefinitionBuilder.build(meta, ctx)
      writeArtifact(
        defModel,
        SagaDefinitionTemplate.generate(defModel),
        root,
        Some(ArtifactAttribution("saga-definition", meta.name, "saga", List(meta.name)))
      )

      // 5b. saga_v3 触发聚合家族（B·§13）——触发命令 → journal 意图 → StartSaga(v3 coordinator)。
      //     与 v2 影子聚合不同：不编排步骤（步骤在 SagaDefinition），参与者由引擎重建。
      val protoModel = SagaTriggerBuilder.buildProtocol(meta, ctx)
      writeArtifact(protoModel, SagaTriggerProtocolTemplate.generate(protoModel), root,
        Some(ArtifactAttribution("saga-trigger-protocol", protoModel.selfType.name, "saga", List(meta.name))))
      val entModel = SagaTriggerBuilder.buildEntity(meta, ctx)
      writeArtifact(entModel, SagaTriggerEntityTemplate.generate(entModel), root,
        Some(ArtifactAttribution("saga-trigger-entity", entModel.selfType.name, "saga", List(meta.name))))
      val rootModel = SagaTriggerBuilder.buildRoot(meta, ctx)
      writeArtifact(rootModel, SagaTriggerRootTemplate.generate(rootModel), root,
        Some(ArtifactAttribution("saga-trigger-root", rootModel.selfType.name, "saga", List(meta.name))))
      val behModel = SagaTriggerBuilder.buildBehaviors(meta, ctx)
      writeArtifact(behModel, SagaTriggerBehaviorsTemplate.generate(behModel), root,
        Some(ArtifactAttribution("saga-trigger-behaviors", behModel.selfType.name, "saga", List(meta.name))))
    }
  }

  // ==========================================
  // Layer 3: Infrastructure
  // ==========================================
  private def generateInfrastructureLayer(
      system: SystemMetadata,
      ctx: GeneratorContext,
      root: String,
      protoDir: String
  ): Unit = {
    val infra = system.infrastructure
    val app = system.application

    // 1. Repositories Impl
    infra.repositories.foreach {
      case m: AggregateRepositoryMetadata =>
        val model = AggregateRepositoryImplBuilder.build(m, ctx)
        writeArtifact(
          model,
          AggregateRepositoryImplTemplate.generate(model),
          root,
          Some(
            ArtifactAttribution(
              "repository-impl",
              m.aggregate.targetName,
              "aggregate",
              List(m.aggregate.targetName)
            )
          )
        )
      case m: ProjectionRepositoryMetadata =>
        // E5-WP1 宽归属根修（EP_Artifacts_Attribution_Closure P1·2026-09-14）：repo 制品归属＝        // 引用它的投影的 effectiveAggregates（每视图一 repo·repositoryRef 反查——H016 保证引用名在册、
        // H036 保证 repositoryRef 非空）。原 projectionFamilyNames 全域并集是过度保守——84 件 repo 制品
        // 单行列 23 族并列，artifact_impact 只能阈值切分宽归属。无引用回退全域并集（防御分支·合法元数据不走）。
        val projectionFamilies = {
          val referencing = infra.projections.filter(_.repositoryRef.exists(_.targetName == m.name))
          if (referencing.isEmpty) projectionFamilyNames(ctx)
          else referencing.flatMap(_.effectiveAggregates).distinct.sorted.toList
        }
        val interfaceModel = ProjectionRepositoryBuilder.build(m, ctx)
        writeArtifact(
          interfaceModel,
          ProjectionRepositoryTemplate.generate(interfaceModel),
          root,
          Some(
            ArtifactAttribution(
              "projection-repo-iface",
              m.name,
              "projection",
              projectionFamilies
            )
          )
        )

        val implModel = ProjectionRepositoryImplBuilder.build(m, ctx)
        writeArtifact(
          implModel,
          ProjectionRepositoryImplTemplate.generate(implModel),
          root,
          Some(
            ArtifactAttribution(
              "projection-repo-impl",
              m.name,
              "projection",
              projectionFamilies
            )
          )
        )
    }

    // 1b. Connectors Impl（2026-09-20 EP_Improvement_Engine）：注入手写基建·机械委托（MANUAL 块）
    infra.connectors.foreach { m =>
      val model = ConnectorImplBuilder.build(m, ctx)
      writeArtifact(
        model,
        ConnectorImplTemplate.generate(model),
        root,
        Some(ArtifactAttribution("connector-impl", m.name, "global", Nil))
      )
    }

    // 2. Projections & Handlers
    infra.projections.foreach { meta =>
      val model = ProjectionBuilder.build(meta, ctx)
      // M3（S4 P8）：kernel ApplyEvent 纯函数族——多项目模式追加发射（单项目 Nil 零漂移）
      if (model.applyEvents.nonEmpty) {
        val applyEventModel = model.copy(selfType = model.selfType.copy(
          packageName = s"${model.selfType.packageName}.handlers",
          name = s"${model.selfType.name}ApplyEvent"))
        writeArtifact(
          applyEventModel,
          net.imadz.codegen.scaffolding.cqrs.template.application.ProjectionApplyEventTemplate.generate(model),
          root,
          Some(
            ArtifactAttribution(
              "projection-apply-event",
              meta.name,
              "projection",
              meta.effectiveAggregates.toList
            )
          )
        )
      }
      writeArtifact(
        model,
        ProjectionTemplate.generate(model),
        root,
        Some(
          ArtifactAttribution(
            "projection",
            meta.name,
            "projection",
            meta.effectiveAggregates.toList
          )
        )
      )

      model.handlers.foreach { hModel =>
        // S7（EP §二 G1）：handler 的知识身份＝所属投影号——builder 不收 ProjectionMetadata，
        // 由本调用点（meta 在手）在漏斗前补齐（与 builder 自述同轴·同一台账列）。
        val stamped = hModel.copy(noteIds = meta.noteId.toSeq)
        writeArtifact(
          stamped,
          ProjectionHandlerTemplate.generate(stamped),
          root,
          Some(
            ArtifactAttribution(
              "projection-handler",
              hModel.selfType.name,
              "projection",
              meta.effectiveAggregates.toList
            )
          )
        )
      }
    }

    // 3. Protobuf & Adapters & Serializers
    // 3.1 Standard Aggregates
    app.aggregates.foreach { aggMeta =>
      // [FIX] Write to protoDir
      val protoModel = AggregateRootProtoBuilder.build(aggMeta, ctx)
      writeProto(
        protoModel,
        ProtoTemplate.generate(protoModel),
        protoDir,
        Some(
          ArtifactAttribution(
            "proto",
            aggMeta.name,
            if (aggMeta.metaCategory == "application.services.transactor") "saga" else "aggregate",
            List(aggMeta.name)
          )
        )
      )

      // [FIX] 生成 Aggregate Converters (补全)
      val converterModel = AggregateConverterBuilder.build(aggMeta, ctx)
      writeArtifact(
        converterModel,
        AggregateConverterTemplate.generate(converterModel),
        root,
        Some(
          ArtifactAttribution("converter", aggMeta.name, "aggregate", List(aggMeta.name))
        )
      )

      val eventAdapter = AggregateAdapterBuilder.buildEventAdapter(aggMeta, ctx)
      writeArtifact(
        eventAdapter,
        EventAdapterTemplate.generate(eventAdapter),
        root,
        Some(
          ArtifactAttribution("event-adapter", aggMeta.name, "aggregate", List(aggMeta.name))
        )
      )

      val snapshotAdapter =
        AggregateAdapterBuilder.buildSnapshotAdapter(aggMeta, ctx)
      writeArtifact(
        snapshotAdapter,
        SnapshotAdapterTemplate.generate(snapshotAdapter),
        root,
        Some(
          ArtifactAttribution("snapshot-adapter", aggMeta.name, "aggregate", List(aggMeta.name))
        )
      )
    }

    // 3.1b 共享 VO proto（跨聚合共享分量·单文件收口·无共享分量则不产文件）
    //   2026-09-22 根修：旧机制只支持**单向**跨聚合 VO 复用——两聚合互相引用对方 VO 时
    //   两个 proto 互相 import，protoc「File recursively imports itself」拒编译；且属主被迁到
    //   「不引用该 VO」的聚合时该 VO 一处都不发射（静默丢失）。共享收口同时消灭两者。
    AggregateRootProtoBuilder.buildShared(ctx).foreach { sharedModel =>
      writeProto(
        sharedModel,
        ProtoTemplate.generate(sharedModel),
        protoDir,
        Some(ArtifactAttribution("proto", "shared_value_objects", "aggregate", Nil))
      )
    }

    // 3.2 Sagas (v3: Context only — engine, journal proto and adapters live in saga-core;
    //    participants are pure data and never journaled, so there are no saga
    //    protos, converters, adapters or serialization strategies)
    app.sagas.foreach { sagaMeta =>
      val contextModel = SagaContextBuilder.build(sagaMeta, ctx)
      writeArtifact(
        contextModel,
        SagaContextTemplate.generate(contextModel),
        root,
        Some(
          ArtifactAttribution("saga-context", sagaMeta.name, "saga", List(sagaMeta.name))
        )
      )
    }
  }

  /** E5-WP1：投影族集全域并集——ProjectionRepository 反查无引用时的防御回退（P1 根修后
    * 常规路径走 repositoryRef 反查，本函数仅防御分支在册）。 */
  private def projectionFamilyNames(ctx: GeneratorContext): List[String] =
    ctx.metaRegistry.resolveAll[ProjectionMetadata]
      .flatMap(_.effectiveAggregates)
      .distinct
      .sorted
      .toList

  // ==========================================
  // Layer 4: Interfaces
  // ==========================================

  /** S1 聚合面（2026-09-27 用户拍板）：AggregateStateApiController 生成。
    * 聚合全集驱动（Get<X>State 命令已由 AssemblyEngine 技术合成进每聚合命令族）。
    * 路由行**不在此写**——归 gen_api_layer 的 E301 块（apply_manifest MERGE_MARKERS 只合并该块，
    * 独立标记块会被「块外保真」丢弃·2026-09-27 实测），Node 侧从本控制器文件反推行集。
    * Gate-2 前置门（2026-10-23）：模板消费 Get<X>State 只读命令、聚合仓储与手写
    * metarch IdGuard 支撑件——仅发射真实声明了这些前置的聚合；最小真源 profile
    * （无合成命令/仓储）不生成引用未声明基建的控制器（未知项不生成）。 */
  private def generateAggregateStateController(
      system: SystemMetadata,
      ctx: GeneratorContext,
      root: String
  ): Unit = {
    val aggregates = system.application.aggregates
      .filter(a => a.repository.isDefined &&
        a.commandFamily.commands.exists(_.name == s"Get${a.name}State"))
    if (aggregates.isEmpty) return
    val model = AggregateStateControllerBuilder.build(aggregates, ctx)
    writeArtifact(
      model,
      AggregateStateControllerTemplate.generate(model),
      root,
      Some(ArtifactAttribution("controller", model.selfType.name, "global", Nil))
    )
  }

  private def generateInterfaceLayer(
      interfaces: InterfaceLayer,
      ctx: GeneratorContext,
      root: String
  ): Unit = {
    val controllerModels = interfaces.controllers.map { meta =>
      val model = ControllerBuilder.build(meta, ctx)
      writeArtifact(
        model,
        ControllerTemplate.generate(model),
        root,
        Some(ArtifactAttribution("controller", meta.name, "aggregate", Nil))
      )
      model
    }

    // S2-32 R5c（P2）：CommandDsl 信封支撑件——DSL 控制器 import 面的信封族落地
    // （与 controller 同批；gate 声明存在才发射——gate=None 系统零新文件·零漂移红线；
    // 同源覆盖等价：生成到已有手放版的工程不破坏）
    CommandDslBuilder.build(interfaces).foreach { model =>
      writeArtifact(
        model,
        CommandDslTemplate.generate(model),
        root,
        Some(ArtifactAttribution("command-dsl", model.selfType.name, "global", Nil))
      )
    }

    // S2-41 R7：routes 标记块——Controller 批产路由片段（生成的端点连不上 HTTP 的收口）。
    // gate 声明端点才产行（gate=None 系统＝零路由行→None→不产 routes 文件·不碰既有
    // routes——零漂移红线）；写盘走 MarkerBlockWriter 三路径部分合并（非 writeArtifact
    // 整文件模式——routes 是共享领地，整文件指纹头会触发 gen_manifest COVER 档冲掉段外手写行）。
    RoutesBuilder.build(controllerModels).foreach { model =>
      writeRoutesArtifact(model, root, multiProject)
    }
  }

  /** routes use the actual generation mode, never a directory-name heuristic.
    * Single: outputRoot is the Scala source root (normally target/app).
    * Multi-project: outputRoot is already the project root (target).
    */
  private[codegen] def writeRoutesArtifact(
      model: RoutesFragmentModel,
      outputRoot: String,
      multiProjectMode: Boolean
  ): Unit = {
    val root = Paths.get(outputRoot).toAbsolutePath.normalize
    val projectRoot = if (multiProjectMode) root else Option(root.getParent).getOrElse(root)
    val target = projectRoot.resolve("conf").resolve("routes")
    MarkerBlockWriter.write(
      target,
      RoutesTemplate.MarkerStart,
      RoutesTemplate.MarkerEnd,
      RoutesTemplate.generate(model),
      RoutesTemplate.NewFileHeader,
      RoutesTemplate.AppendNotice
    )
    println(s"🛣  Generated routes fragment: ${model.routeLines.size} routes → $target")
  }

  // ==========================================
  // Bootstrap
  // ==========================================
  /** S7 #1c（EP §二 G1）：bootstrap 面的知识号——**跨两语言分工**。
    *
    * 文件路径写在 Scala（自述），但**号的真值在 Node 侧**：`.ingest/metarch.json` 便签的
    * `noteId` 是真源；Scala 侧 `AggregateRootMetadata` / `ProjectionMetadata` 的 noteId 来自
    * 装配期注入（未必与便签同步）；且 Scala 侧 `.scala` 源里 `@knowledge` 写的是**反向拼名**
    * （`getBaseName` 加回 `Repository`），解释它需要 Node 侧的命名知识。故号一律由 Node 侧
    * （rules_domain_gen `CodegenLedgerPatch` 段）按本表**回填**——Scala 只声明「哪行应挂什么」。
    * `AggregateRootMetadata.noteId` 恒等于便签号时两法等价，但为保证唯一口径，统一走 Node。
    *
    * 序列稳定（排序＋去重）保证台账逐字节可复现。 */
  private[codegen] def bootstrapNoteIdPatches(
      system: SystemMetadata,
      ctx: GeneratorContext
  ): Seq[(String, Seq[String])] = {
    // 候选名集合：**任一实例**带号即进行（resolveAll 可能返回多个同名实例——空壳＋真元数据；
    // 首实例未必带号，Node 侧解引用以便签/历任行为准，故此处只做「是否在册」的门控）。
    val aggNames = ctx.metaRegistry.resolveAll[AggregateRootMetadata]
      .filter(_.noteId.isDefined).map(_.name).toSet
    val projNames = ctx.metaRegistry.resolveAll[ProjectionMetadata]
      .filter(_.noteId.isDefined).map(_.name).toSet
    // 载荷传**名**（非号）：两套 id 空间虽在本型上实测同值，但边界（漂移时）应为「名 → 号」
    // 的显式解析，故 Scala 侧不预解析号；Node 侧解引用（先查台账前任行·回落便签索引）。
    val base = ctx.layout.infrastructure.bootstrap.replace('.', '/')
    val entries =
      system.application.aggregates.flatMap { meta =>
        if (!aggNames.contains(meta.name)) Nil
        else {
          val st = ctx.typeResolver.aggregateBootstrap(meta)
          Seq(s"app/$base/${st.name}.scala" -> Seq(meta.name))
        }
      } ++
      system.infrastructure.projections.flatMap { meta =>
        if (!projNames.contains(meta.name)) Nil
        else {
          val st = ctx.typeResolver.bootstrap(s"${meta.name}Bootstrap", ctx.layout.infrastructure.bootstrap)
          Seq(s"app/$base/${st.name}.scala" -> Seq(meta.name))
        }
      }
    println(s"📮 codegenPatches 挂号表：${entries.size} 行（聚合 ${aggNames.size}＋投影 ${projNames.size}）→ 台账顶层键（Node 侧 rules 步消费）")
    entries.sortBy(_._1)
  }

  private def generateBootstraps(
      system: SystemMetadata,
      ctx: GeneratorContext,
      root: String,
      strictEntries: Seq[String] = Nil
  ): Unit = {
    system.application.aggregates.foreach { meta =>
      val model = BootstrapBuilder.buildAggregate(meta, ctx)
      writeArtifact(
        model,
        BootstrapTemplate.generate(model),
        root,
        Some(ArtifactAttribution("bootstrap", meta.name, "aggregate", List(meta.name)))
      )
    }

    if (system.application.sagas.nonEmpty) {
      val coordModel =
        BootstrapBuilder.buildSagaCoordinator(system.application.sagas, ctx)
      writeArtifact(
        coordModel,
        BootstrapTemplate.generate(coordModel),
        root,
        Some(ArtifactAttribution("bootstrap", coordModel.selfType.name, "saga", Nil))
      )
    }

    system.application.sagas.foreach { meta =>
      val model = BootstrapBuilder.buildSagaTransactor(meta, ctx)
      writeArtifact(
        model,
        BootstrapTemplate.generate(model),
        root,
        Some(ArtifactAttribution("bootstrap", meta.name, "saga", List(meta.name)))
      )
    }

    system.infrastructure.projections.foreach { meta =>
      val model = BootstrapBuilder.buildProjection(meta, ctx)
      writeArtifact(
        model,
        BootstrapTemplate.generate(model),
        root,
        Some(
          ArtifactAttribution(
            "bootstrap",
            meta.name,
            "projection",
            meta.effectiveAggregates.toList
          )
        )
      )
    }

    val appBootstrapModel = ApplicationBootstrapBuilder.build(system, ctx, strictEntries)
    writeArtifact(
      appBootstrapModel,
      ApplicationBootstrapTemplate.generate(appBootstrapModel),
      root,
      Some(ArtifactAttribution("bootstrap", appBootstrapModel.selfType.name, "global", Nil))
    )
  }
}
