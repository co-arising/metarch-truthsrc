package net.imadz.codegen.scaffolding.cqrs

import ujson._

import java.nio.file.{Files, Paths}

/** E5-WP1（2026-09-12）：关注点（Concern）增量参数——Schema 轴 × Flavor 轴两级词表＋生成台账。
  *
  * 用户裁决（设计输入）：
  *  - concern＝预设注册表：concerns.json 登记具名预设（稳定词表·per-project 配置），不做 CLI 自由组合；
  *  - Schema 轴（结构类）：aggregate / entity / valueObject / field / projection / saga / global——选「改了什么结构」；
  *  - Flavor 轴（寄生扩展类）：event-journal-suite（proto/converter/adapters）、
  *    materialized-read-model（projection/handler/repo）等——选「该结构落哪些制品面」；
  *  - 过滤策略＝B 先行：CodegenMain 保持全量生成；本文件落 ScopeFilter 守卫（choke point 内联·默认 All），
  *    但 gen_pipeline v1 不传 concern prop——Option A（真生成跳过）需 refill 前置于 rules 步的管线重排，另批。
  *
  * 台账（ledger）是本件核心产出：writeArtifact/writeProto 发射时逐文件记录
  * (kind, schemaNode, schemaCategory, families)；Node 侧 refillFromTarget 泛化＋gen_manifest
  * 据此判定 artifact 归属，取代 AGG_KNOWN 文件名启发式（顺带修复新聚合族漏登 bug）。
  * 扩展算法只在 Scala 实现一次（attribution 在发射点解析），Node 侧纯消费＝零双份逻辑。
  */
object ConcernVocabulary {

  /** Schema 轴词表（发射点 attribution 的 schemaCategory 取值域）。 */
  val SchemaCategories: Set[String] = Set(
    "aggregate", "entity", "valueObject", "field", "projection", "saga", "global"
  )
}

/** 单个生成制品的归属元数据——台账行 / ScopeFilter 判定的共同载荷。
  * deps＝Builder 声明的依赖制品名集（ArtifactModel.dependencies.map(_.name)·结构性）：
  * Node 侧编译闭包扩展的查表输入。 */
final case class ArtifactAttribution(
    kind: String,
    schemaNode: String,
    schemaCategory: String,
    families: List[String],
    deps: List[String] = Nil,
    /** EP_GenerationTime_Code_Anchors S7（EP §二 G1）：本制品承载的**知识元素 id**。
      * 由**模型自述**（`ArtifactModel.noteIds`）、漏斗处合流（与 `deps` 同一手法）——
      * 不在此处按 `(schemaCategory, schemaNode)` 回查名字（名字会撞·见 `ArtifactModel.noteIds` 注）。
      * 调用点**零改动**（默认 `Nil`）。 */
    noteIds: List[String] = Nil
)

/** 生成范围守卫。All＝现行行为（默认）；Concern＝按 (kind × category × families) 三元过滤。
  * families 为空的 attribution（全局/未归属制品：controller、command-dsl、application-bootstrap 等）
  * 判定规则：kind 与 category 命中即入 scope（任一族被选中时全局件随行——保守向，避免漏配线）。
  */
sealed trait ScopeFilter {
  def includes(a: ArtifactAttribution): Boolean
}

object ScopeFilter {
  case object All extends ScopeFilter {
    def includes(a: ArtifactAttribution): Boolean = true
  }

  final case class Concern(
      kinds: Set[String],
      categories: Set[String],
      wildcardCategories: Boolean,
      families: Set[String]
  ) extends ScopeFilter {
    private val wildcardKinds = kinds.contains("*")
    def includes(a: ArtifactAttribution): Boolean =
      (wildcardKinds || kinds.contains(a.kind)) &&
        (wildcardCategories || categories.contains(a.schemaCategory)) && {
          a.families.isEmpty || a.families.exists(families.contains)
        }
  }
}

/** 单条锚定声明——flavor 的**元素维度**（问题空间标记 → 该 flavor 管的元素）。
  * EP_Field_Nature_And_Concern_Anchors Phase 2：`artifactKinds` 答「产出什么制品」，
  * `anchors` 答「管哪些元素」；成员集由真源机械求出（见 ConcernMembers），不靠人肉列表。
  *
  * Phase 3(a)：`exclude` ＝该锚定元素的**处置面**（解决方案空间动作词表，见 ConcernAnchors.Exclusions）。
  *   与 `nature` 正交：`nature` 说「这是什么」（问题空间·领域专家可答），`exclude` 说「据此不生成什么」
  *   （解决方案空间·生成侧动作）——正是本 EP「名词在真源、动宾由生成侧推出」的落点。 */
final case class AnchorSpec(elementKind: String, nature: String, exclude: List[String] = Nil)

/** 锚定的**处置词表**与解析（EP Phase 3(a)：让声明有牙齿）。
  *
  * 处置面词表（`exclude` 取值域·首批）：
  *   - `aggregateColumn`：不进聚合状态列（该 nature 的字段不发射到实体 State/proto/converter）；
  *   - `eventPayload`   ：不进事件载荷（预留·首批未接线）。
  *
  * **泛化契约（EP §十）**：处置由「锚定 nature ＋ 显式 exclude」推出，不硬编码字段名——
  *   加第二个同类字段（如 `apiKey` 标 credential）时**无需改生成器代码**即被正确处置。 */
object ConcernAnchors {

  val Exclusions: Set[String] = Set("aggregateColumn", "eventPayload")

  /** 未登记 exclude 值 → Left（fail-fast·不静默忽略）。 */
  def validate(anchors: List[AnchorSpec]): Either[String, Unit] = {
    val bad = anchors.flatMap(_.exclude).filterNot(Exclusions.contains).distinct
    if (bad.nonEmpty) Left(s"未知 exclude 处置: ${bad.mkString(", ")}（词表: ${Exclusions.toList.sorted.mkString("/")}）")
    else Right(())
  }

  /** 命中「排除聚合状态列」的 nature 集（生成器据此过滤状态字段·与字段名无关）。
    * 元素种类限 `StateField`（VO 成员面另有处置路径·首批未接线）。 */
  def excludedStateFieldNatures(anchors: List[AnchorSpec]): Set[String] =
    anchors.filter(a => a.elementKind == "StateField" && a.exclude.contains("aggregateColumn")).map(_.nature).toSet
}

final case class FlavorSpec(name: String, artifactKinds: List[String], anchors: List[AnchorSpec] = Nil)

final case class ConcernSpec(name: String, schemaCategories: List[String], flavors: List[String])

final case class ConcernRegistry(
    flavors: Map[String, FlavorSpec],
    concerns: Map[String, ConcernSpec],
    familySets: Map[String, List[String]]
)

object ConcernRegistry {

  /** 解析 concerns.json（单一真源·Scala/Node 同源消费）。
    * 校验（shift-left）：concern 引用未登记 flavor → Left；schemaCategories 未知名 → Left；
    * familySets 引用不存在（族名校验在 CodegenMain 对 metadata 做这里不做）。
    */
  def parse(text: String): Either[String, ConcernRegistry] =
    try {
      val json = ujson.read(text)
      val obj = json.obj
      val flavors = obj.get("flavors").map(_.obj.map { case (k, v) =>
        k -> FlavorSpec(k, v("artifactKinds").arr.map(_.str).toList,
          v.obj.get("anchors").map(_.arr.map { a =>
            AnchorSpec(a("elementKind").str, a("nature").str,
              a.obj.get("exclude").map(_.arr.map(_.str).toList).getOrElse(Nil))
          }.toList).getOrElse(Nil))
      }.toMap).getOrElse(Map.empty)
      val concerns = obj.get("concerns").map(_.obj.map { case (k, v) =>
        k -> ConcernSpec(
          k,
          v("schemaCategories").arr.map(_.str).toList,
          v("flavors").arr.map(_.str).toList
        )
      }.toMap).getOrElse(Map.empty)
      val familySets = obj.get("familySets").map(_.obj.map { case (k, v) =>
        k -> v.arr.map(_.str).toList
      }.toMap).getOrElse(Map.empty)
      val unknownFlavors = concerns.values.flatMap(c => c.flavors).toSet -- flavors.keySet
      if (unknownFlavors.nonEmpty)
        return Left(s"concerns.json: concern 引用未登记 flavor: ${unknownFlavors.mkString(", ")}")
      val badCategories = concerns.values
        .flatMap(_.schemaCategories)
        .filter(c => c != "*" && !ConcernVocabulary.SchemaCategories.contains(c))
        .toSet
      if (badCategories.nonEmpty)
        return Left(
          s"concerns.json: 未知 schemaCategory: ${badCategories.mkString(", ")}（词表: ${ConcernVocabulary.SchemaCategories.mkString("/")}）"
        )
      Right(ConcernRegistry(flavors, concerns, familySets))
    } catch {
      case e: Exception => Left(s"concerns.json 解析失败: ${e.getMessage}")
    }
}

/** ScopeFilter 装配器：从 sys props（concern/families/scope-file）解析并组装 Concern 守卫。
  * 任一输入无效 → Left（CodegenMain fail-fast·照 unknown metadata class 的 exit 1 先例）。
  */
object ConcernScopeLoader {

  final case class Loaded(registry: ConcernRegistry, concernName: String, families: List[String], filter: ScopeFilter)

  def load(
      scopeFileOpt: Option[String],
      concernNameOpt: Option[String],
      familiesPropOpt: Option[String],
      knownFamilies: Set[String]
  ): Either[String, Option[Loaded]] = (concernNameOpt, familiesPropOpt) match {
    case (None, None) => Right(None)
    case _ =>
      for {
        scopeFile <- scopeFileOpt.toRight(
          "指定 -Dcodegen.concern/-Dcodegen.families 时必须同时指定 -Dcodegen.scope-file=<concerns.json 路径>"
        )
        text <- readScopeFile(scopeFile)
        registry <- ConcernRegistry.parse(text)
        concernName <- concernNameOpt.toRight("缺少 -Dcodegen.concern=<预设名>")
        concern <- registry.concerns.get(concernName).toRight(
          s"concerns.json 未登记 concern: $concernName（可用词表: ${registry.concerns.keySet.mkString(", ")}）"
        )
        families <- resolveFamilies(familiesPropOpt, registry, knownFamilies)
        kinds = concern.flavors.flatMap(registry.flavors(_).artifactKinds).toSet
        categories = concern.schemaCategories.toSet
        wildcard = concern.schemaCategories.contains("*")
      } yield Some(
        Loaded(
          registry,
          concernName,
          families,
          ScopeFilter.Concern(kinds, categories, wildcard, families.toSet)
        )
      )
  }

  private def readScopeFile(path: String): Either[String, String] =
    try Right(new String(Files.readAllBytes(Paths.get(path)), "UTF-8"))
    catch { case e: Exception => Left(s"读取 scope-file 失败: $path (${e.getMessage})") }

  private def resolveFamilies(
      familiesPropOpt: Option[String],
      registry: ConcernRegistry,
      knownFamilies: Set[String]
  ): Either[String, List[String]] =
    familiesPropOpt match {
      case None => Right(knownFamilies.toList.sorted)
      case Some(prop) =>
        prop.split(',').map(_.trim).filter(_.nonEmpty).toList match {
          case Nil => Right(Nil)
          case names =>
            val unknown = names.filter(n => !knownFamilies.contains(n) && !registry.familySets.contains(n))
            if (unknown.nonEmpty)
              Left(
                s"-Dcodegen.families 含未知聚合族: ${unknown.mkString(", ")}（metadata 已知族: ${knownFamilies.toList.sorted.mkString(", ")}；familySets: ${registry.familySets.keySet.mkString(", ")}）"
              )
            else Right(names.flatMap(n => registry.familySets.getOrElse(n, List(n))))
        }
    }

  /** EP Phase 3(a)：从 scope-file（concerns.json）装载**全部 flavor 的锚定处置面**——
    * 与 `--concern` 作用域**正交**：处置是 concerns.json 的常驻声明（「声明过性质即排除」是
    * 不随增量/全量模式变的常驻事实），故 CodegenMain 无论是否传 concern 都应施加。
    * 未给 scope-file / 文件缺失 → 空集（零行为变化）；未知 exclude → 忽略该条（不因处置声明炸生成，
    * 校验由 `--concern` 路径与 Node 侧强校验负责）。 */
  def loadExclusions(scopeFileOpt: Option[String]): Set[String] =
    scopeFileOpt match {
      case None => Set.empty
      case Some(path) =>
        try {
          ConcernRegistry.parse(new String(Files.readAllBytes(Paths.get(path)), "UTF-8")) match {
            case Right(reg) =>
              ConcernAnchors.excludedStateFieldNatures(reg.flavors.values.flatMap(_.anchors).toList)
            case Left(_) => Set.empty
          }
        } catch { case _: Exception => Set.empty }
    }
}

/** 生成台账写盘器：发射点 → (path, attribution) 行 → .codegen-ledger.json。
  * 仅当 -Dcodegen.ledger=<path> 给定时写（direct 模式默认零新文件·gen_pipeline 显式传 staging 路径）。
  */
/** 台账态射行——**模型声明的态射 ＋ 唯一漏斗盖的路径与宿主**。
  * 「谁在哪条关系上」（builder 说）与「落在哪个文件」（漏斗盖章）在此合流：
  * 模型自己不知道落盘路径，漏斗不知道关系语义——两端信息各出一半，故在漏斗处合成。
  */
final case class LedgerMorphismRow(path: String, consumer: String, m: net.imadz.meta.MappingMorphism)

final class GenerationLedger(pathOpt: Option[String]) {
  private val rows = scala.collection.mutable.ListBuffer[ujson.Obj]()
  private var fieldAnchors: Seq[FieldKnowledgeAnchor] = Nil
  private val morphismRows = scala.collection.mutable.ListBuffer[LedgerMorphismRow]();
  private var codegenPatches: Seq[(String, Seq[String])] = Nil

  /** 记一批态射（EP_GenerationTime_Code_Anchors S1）。**唯一调用点＝ writeArtifact 漏斗**
    * （它盖章 path 与宿主名）；builder 只在自己返回的模型上声明 `morphisms`，不碰台账。
    *
    * 与 `fieldAnchors` 的**一次性覆盖赋值**不同，本键是**逐制品累加**——
    * 因为它逐制品产生（每个模型各带自己的），而那两个是全局求解器一次性算出的。 */
  def recordMorphisms(path: String, consumer: String, ms: Seq[net.imadz.meta.MappingMorphism]): Unit =
    ms.foreach(m => morphismRows += LedgerMorphismRow(path, consumer, m))

  def record(path: String, a: ArtifactAttribution): Unit =
    rows += ujson.Obj(
      "path" -> path,
      "kind" -> a.kind,
      "schemaNode" -> a.schemaNode,
      "schemaCategory" -> a.schemaCategory,
      "families" -> ujson.Arr.from(a.families),
      "deps" -> ujson.Arr.from(a.deps),
      // EP_GenerationTime_Code_Anchors S7（G1）：文件级落点的**知识身份**——
      // 「这条知识落在哪些制品上」由此可答（此前只有 path/kind/families，无号）。
      "noteIds" -> ujson.Arr.from(a.noteIds)
    )

  /** 字段知识锚点（EP_Note_Tense_Knowledge_Id 末段）：一次性挂上，flush 时写入**顶层** `fieldAnchors` 键。
    * 顶层而非 artifacts[] 行内——`ledger_append.mjs` 的 upsert 只动 `doc.artifacts`，顶层键天然不被覆盖丢数据。 */
  def withFieldAnchors(as: Seq[FieldKnowledgeAnchor]): Unit = fieldAnchors = as

  /** S7 #1c 反向传递表：控制台（Scala 生成期）→ Node 步 → 台账 artifacts[] 行的挂号指令。
    *
    * 存在理由：号的真值在 Node 侧 `.ingest/metarch.json` 便签（Scala 侧的 `@knowledge` 形式是
    * 反向拼名，取号＝跨语言解释）；而写盘行（bootstrap 等）由 Scala 漏斗 record 在前。
    * 故 Scala 出具「哪行应挂哪些号」的指令表，Node 生成步（rules_domain_gen 尾部）代为 upsert——
    * 号本身的解析与 noteIds 表达**都归 Node 一侧**，Scala 不构造知识号。
    * 顶层键——`ledger_append.mjs` 只动 `doc.artifacts`，本键天然不被其覆盖（同 `fieldAnchors` 先例）。 */
  def withCodegenPatches(ps: Seq[(String, Seq[String])]): Unit = codegenPatches = ps

  def size: Int = rows.size

  def flush(): Option[String] = pathOpt.map { path =>
    val target = Paths.get(path)
    Option(target.getParent).foreach(Files.createDirectories(_))
    val json = ujson.Obj("version" -> 1, "artifacts" -> ujson.Arr.from(rows.toList))
    if (fieldAnchors.nonEmpty)
      json("fieldAnchors") = ujson.Arr.from(fieldAnchors.map(a =>
        ujson.Obj("owner" -> a.owner, "field" -> a.field, "role" -> a.role, "noteId" -> a.noteId)))
    if (morphismRows.nonEmpty)
      json("morphisms") = ujson.Arr.from(morphismRows.toList.map { r =>
        ujson.Obj(
          "path" -> r.path,
          "consumer" -> r.consumer,
          "member" -> r.m.member,
          // 落点消歧双键（S3）：成员**直接所属类型**＋成员自身 id——推送侧据此在同文件同名成员中精确择一
          "memberOwner" -> ujson.Str(r.m.memberOwner.getOrElse("")),
          "memberNoteId" -> ujson.Str(r.m.memberNoteId.getOrElse("")),
          "relation" -> r.m.relation.rel,
          "edgeKind" -> r.m.relation.edgeKind.id,
          "obligation" -> r.m.relation.obligation.id,
          "dimension" -> r.m.dimension.id,
          // ★ S7 #4（R1 收口）：落点形态——`member`（缺省·字段锚）｜`container`（容器锚·precision=容器级）。
          // 容器级行额外带 `containerFqn`（推送侧据此在该 FQN 的容器 code point 上挂边，
          // **不按名拼**——容器名换算（getEntityNameFromStateName）是生成器侧知识）。
          "landing" -> r.m.landing.id,
          "containerFqn" -> ujson.Str(r.m.containerFqn.getOrElse("")),
          // ★ 端点**完整**序列化（2026-09-23 S5 修正）：此前只写 fqn/name/category/noteId，
          // 把 FieldEndpoint 的 owner/ownerKind/field **丢了**——正是推送侧构造
          // \`fld:<kind>:<宿主>:<字段>\` 定位键所需的三样。载体有损＝下游只能猜，故按形态写全。
          // S3 追加第三形态 `path`（writtenBy 的事件载荷路径原文·解析归 Node 侧唯一实现）。
          "source" -> (r.m.source match {
            case f: net.imadz.meta.FieldEndpoint => ujson.Obj(
              "kind" -> "field", "fqn" -> f.fqn, "name" -> f.name, "category" -> f.category,
              "noteId" -> ujson.Str(f.noteId.getOrElse("")),
              "owner" -> f.owner, "ownerKind" -> f.ownerKind, "field" -> f.field)
            case c: net.imadz.meta.ConceptEndpoint => ujson.Obj(
              "kind" -> "concept", "fqn" -> c.fqn, "name" -> c.name, "category" -> c.category,
              "noteId" -> ujson.Str(c.noteId.getOrElse("")))
            case p: net.imadz.meta.PathEndpoint => ujson.Obj(
              "kind" -> "path", "fqn" -> p.fqn, "name" -> p.name, "category" -> p.category,
              "noteId" -> ujson.Str(p.noteId.getOrElse("")), "path" -> p.path)
          })
        )
      })
    if (codegenPatches.nonEmpty)
      json("codegenPatches") = ujson.Arr.from(codegenPatches.map { case (p, ids) =>
        ujson.Obj("path" -> p, "noteIds" -> ujson.Arr.from(ids)) })
    Files.write(target, ujson.write(json, indent = 1).getBytes("UTF-8"))
    path
  }
}

/** 锚定成员集的一行——元素的全限定指称。`name` 对聚合状态字段＝字段名，对 VO 成员＝`<VO>.<成员名>`
  * （限定避免与同名状态字段指称歧义）。`role` 原样透出（聚合字段 role=""·VO 成员 role="ValueObject.Member"）。 */
final case class ConcernMember(
    elementKind: String,
    nature: String,
    aggregate: String,
    field: String,
    role: String,
    name: String
)

/** flavor 锚定面的**机械成员集求解**（EP_Field_Nature_And_Concern_Anchors Phase 2）。
  *
  * 输入＝SystemMetadata（与生成器读同一真源）＋锚定谓词集（elementKind × nature）；
  * 输出＝命中的元素行集。**不靠人肉列表**——这是 Phase 2 的门。
  *
  * 元素来源两处（均已在 Phase 1 承载 `nature`）：
  *   - 聚合状态字段：`AggregateRootMetadata.stateRef → DomainEntityMetadata.state`（State 的 fields＝identifier + 领域状态字段）；
  *   - 值对象成员：`DomainLayer.valueObjects` 与 `ApplicationLayer.valueObjects` 的成员。
  * 归属：状态字段按「哪个聚合的 stateRef 指向该实体」回找聚合名；VO 成员按 VO 名归组。
  *
  * fail-fast：未知 elementKind → Left（词表 StateField|VoMember）。
  * 空集是**合法的负断言**（真源中无匹配元素），不报错。 */
object ConcernMembers {

  val ElementKinds: Set[String] = Set("StateField", "VoMember")

  def solve(system: net.imadz.meta.SystemMetadata, anchors: List[AnchorSpec]): Either[String, List[ConcernMember]] = {
    val bad = anchors.map(_.elementKind).filterNot(ElementKinds.contains).distinct
    if (bad.nonEmpty)
      return Left(s"未知 elementKind: ${bad.mkString(", ")}（词表: ${ElementKinds.toList.sorted.mkString("/")}）")

    // 状态实体 → 归属聚合名（aggregate.stateRef.targetName 指向实体状态名，如 UserState）
    val entityToAgg: Map[String, String] =
      system.application.aggregates.map(a => a.stateRef.targetName -> a.name).toMap
    // 状态名 → 状态字段（AssemblyEngine 组装时 state.fields 已含 identifier + 领域状态字段）
    val entityFields: Map[String, Seq[net.imadz.meta.FieldMetadata]] =
      system.domain.entities.map(e => e.state.name -> e.state.fields).toMap
    // 值对象成员（domain＋application 两侧并集）
    val voMembers: Seq[(String, net.imadz.meta.FieldMetadata)] =
      (system.domain.valueObjects ++ system.application.valueObjects).flatMap(vo => vo.fields.map(vo.name -> _))

    val stateFieldRows: List[ConcernMember] = anchors.filter(_.elementKind == "StateField").flatMap { a =>
      for {
        (entityName, fields) <- entityFields.toList
        agg = entityToAgg.getOrElse(entityName, entityName)
        f <- fields if f.nature == a.nature
      } yield ConcernMember("StateField", a.nature, agg, f.name, "", f.name)
    }
    val voMemberRows: List[ConcernMember] = anchors.filter(_.elementKind == "VoMember").flatMap { a =>
      voMembers.collect {
        case (vo, f) if f.nature == a.nature =>
          ConcernMember("VoMember", a.nature, vo, f.name, "ValueObject.Member", s"$vo.${f.name}")
      }.toList
    }
    // 稳定序：aggregate → name（输出可复算·diff 友好）
    Right((stateFieldRows ++ voMemberRows).distinct.sortBy(m => (m.aggregate, m.name)))
  }
}

/** CLI 薄壳：`sbt "runMain net.imadz.codegen.scaffolding.cqrs.ConcernMembersSolverMain --anchors <json> [--system <slot>]"`
  * 真实求解在 ConcernMembers（Scala）；Node 侧 tools/concern_members.mjs 是调用方（同 kn_graph_query 先例·单一实现）。
  * 结果以 `__CONCERN_MEMBERS__<json>` 单行前缀发射，便于在 sbt 噪声中定位。 */
object ConcernMembersSolverMain {

  def main(args: Array[String]): Unit = {
    def argOf(name: String): Option[String] = {
      val i = args.indexOf(name)
      if (i >= 0 && i + 1 < args.length) Some(args(i + 1)) else None
    }
    val payload =
      try {
        val anchorsJson = argOf("--anchors").getOrElse(
          throw new IllegalArgumentException("缺少 --anchors <json array>"))
        val systemName = argOf("--system").getOrElse("IngestedSystem")
        val anchors = ujson.read(anchorsJson).arr.map(a => AnchorSpec(a("elementKind").str, a("nature").str)).toList
        val system = net.imadz.meta.SystemMetadataRegistry
          .resolve(systemName, net.imadz.meta.SystemMetadataRegistry.Standard)
          .fold(err => throw new IllegalArgumentException(err), identity)
        ConcernMembers.solve(system, anchors) match {
          case Left(err) => ujson.Obj("error" -> err)
          case Right(ms) =>
            ujson.Obj(
              "members" -> ujson.Arr.from(ms.map { m =>
                ujson.Obj(
                  "elementKind" -> m.elementKind, "nature" -> m.nature, "aggregate" -> m.aggregate,
                  "field" -> m.field, "role" -> m.role, "name" -> m.name
                )
              }),
              "warnings" -> ujson.Arr()
            )
        }
      } catch {
        case e: Exception => ujson.Obj("error" -> s"${e.getClass.getSimpleName}: ${e.getMessage}")
      }
    println("__CONCERN_MEMBERS__" + ujson.write(payload))
  }
}
