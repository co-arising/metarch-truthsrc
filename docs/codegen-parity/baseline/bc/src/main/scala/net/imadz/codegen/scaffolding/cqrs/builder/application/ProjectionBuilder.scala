package net.imadz.codegen.scaffolding.cqrs.builder.application

import net.imadz.codegen.scaffolding.cqrs.{GeneratorContext, TypeRef}
import net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.proto.AggregateRootProtoBuilder
import net.imadz.codegen.scaffolding.cqrs.model.application.{
  ApplyEventFunction,
  ProjectionAggregateSource,
  ProjectionHandlerBuilder,
  ProjectionHandlerModel,
  ProjectionModel
}
import net.imadz.meta.{EventRef, ProjectionMetadata, ReadModelField, SubordinateDomainEventMetadata}

object ProjectionBuilder {
  def build(
      meta: ProjectionMetadata,
      ctx: GeneratorContext
  ): ProjectionModel = {
    val pkg = ctx.layout.application.projection.root
    val selfType = ctx.typeResolver.projection(meta.name)

    // 解析源聚合和仓库引用
    val sourceAggregate = resolveSourceAggregate(meta, ctx)
    val repoRef = resolveRepositoryRef(meta, ctx)

    // 获取事件家族相关类型
    val (eventFamilyProtoType, eventFamilyProtoImport) =
      resolveEventFamilyTypes(meta, ctx)

    // [M3 多聚合投影] sourceAggregates>1（如 KnowledgeSemanticView=Note+Concept）：
    // 事件信封 per-aggregate 不可混流 → 按聚合分别构建 handler（routable 对各聚合正确判定）
    // 并落 aggregateSources；handler 文件产出仍走 model.handlers 全集（CQRSApplicationGenerator）。
    val multiAggregates = if (meta.sourceAggregates.size > 1) meta.sourceAggregates else Nil
    val aggregateSources = multiAggregates.flatMap { aggName =>
      val (familyType, familyImport) = resolveEventFamilyTypes(meta.copy(sourceAggregate = aggName), ctx)
      val aggType = ctx.typeResolver.aggregateRoot(aggName)
      val aggHandlers = meta.handlers
        .filter { h => ctx.typeResolver.resolve(EventRef(h.eventName)).fqn.contains(s".${aggName}Entity.") }
        .map(hMeta => ProjectionHandlerBuilder.build(
          hMeta, meta.name, repoRef, familyType, familyImport, ctx, aggType))
      // 意图删除后 handlers 为空的聚合流不产流（空壳分发器 case _ => () 编译红·#4 Stage 意图迁移实证）——
      // 视图消费意图归零 ⇒ 该聚合流整体退场，不是空转占位。
      if (aggHandlers.isEmpty) None else Some(ProjectionAggregateSource(aggType, familyType, aggHandlers))
    }

    // 构建处理程序
    val handlers = if (aggregateSources.nonEmpty)
      aggregateSources.flatMap(_.handlers)
    else buildHandlers(
      meta,
      repoRef,
      eventFamilyProtoType,
      eventFamilyProtoImport,
      ctx,
      sourceAggregate
    )

    // 收集依赖
    val dependencies = collectDependencies(
      sourceAggregate,
      repoRef,
      handlers,
      eventFamilyProtoImport,
      ctx,
      pkg
    ) ++ aggregateSources.flatMap(s =>
      // 多聚合投影需要各聚合对象（.tags 枚举）＋各事件族 import
      Set(s.aggregate, s.protoEventType) ++ s.handlers.flatMap(_.dependencies))

    // M3（S4 P8）＋Phase 2 债①（方言 v2 全文本直译·2026-10-04）：
    // referenceCode 是可执行 Scala 表达式声明（金样语义灌回真源·land_debt1_golden_semantics）。
    // 方言四形：view.copy(...)（create）｜updateOnly(key): view.copy|row.copy|表达式（行签名）｜
    // view.delete(...)（键元组·壳直调 repo.delete）｜emptyRow(entityId, ...)（persistenceId 族）。
    // 直译＝标识符重写逐字保真（event.→e.·view.→row.·守卫/集合操作原样发射），不再正则抠键对
    // （键对法实锤三雷：幽灵 refCode 空串覆写行键·updateOnly 声明不消费·守卫方言丢列）。
    // 助手习语（ts/strOr/upsertBy）模板按需发射。图视图（graph.* 头）不归 ApplyEvent 面。
    val viewSchema: Seq[ReadModelField] = meta.readModelSchema.map(_.fields).getOrElse(Nil)
    val viewColumns: Set[String] = viewSchema.map(_.name).toSet
    // 列型口径与 Table 同一（dtoFieldsOf：Instant 缺省包 Option·S2 P5 判定法·emptyRow 批判例）
    val viewTypeOf: String => String = n =>
      viewSchema.find(_.name == n).map { f =>
        val t = ctx.typeResolver.resolve(f.dataType)
        if (t.name == "Instant" && f.nullable.getOrElse(true)) "Option[Instant]"
        else t.signature
      }.getOrElse("String")
    val updateOnlySet = meta.updateOnlyEvents.toSet
    val persistenceIdMode = meta.identityScheme.contains("persistenceId")
    val applyEvents = if (sys.props.get("codegen.multiProject").contains("true"))
      handlers.map { h =>
        val expr = h.logicCode.trim
        // updateOnly 声明集优先（金样 FKD remove 族形：refCode 头 view.copy( 但语义＝查无静默跳过
        // ⇒ 行签名 row.copy——effectiveForm 先行，重写基座按它定）
        val declaredUpdateOnly = updateOnlySet.contains(h.concreteEventName)
        // 方言头形分派（无 refCode→"???"·图视图→degraded 留痕）。`upsert by <key>:` 头＝
        // create 形键提示（land_sync 方言·UserLookup/Stage/Fsm 族·剥前缀取体）
        val upsertByHead = """^upsert by [^:]+:\s*""".r
        val (headForm, headBody) =
          if (!expr.nonEmpty || expr == "???") ("degraded", "")
          else if (expr.startsWith("updateOnly(")) ("updateOnly", expr.dropWhile(_ != ':').drop(1).trim)
          else if (expr.startsWith("view.delete(")) ("delete", expr)
          else if (expr.startsWith("emptyRow(")) ("persistenceIdCreate", expr)
          else if (upsertByHead.findFirstIn(expr).isDefined) ("create", upsertByHead.replaceFirstIn(expr, ""))
          else if (expr.startsWith("view.copy(")) ("create", expr)
          else ("degraded", "")
        val form =
          if (headForm == "degraded" && declaredUpdateOnly) "updateOnly"
          else if (headForm == "create" && declaredUpdateOnly) "updateOnly"
          else headForm
        val body =
          if (headForm == "degraded" && declaredUpdateOnly)
            // updateOnly 声明但 refCode 缺席/幽灵——行恒等函数（查无静默跳过·语义由壳承载）
            "row"
          else headBody
        // 标识符重写（顺序敏感：先 event.→e.，再按基座——create 族→getOrElse(emptyRow)/emptyRow(entityId)·
        // updateOnly→row.copy（行签名）·裸 view.→row.。create 形的 fold 自引用
        // row.<col>（原 view.<col>·列表列）金样语义＝existing.map(_.<col>).getOrElse(Nil)——
        // Option 拆包（金样 FKD upsertBy(existing.map(_.commands).getOrElse(Nil),…) 判例）
        val rewritten =
          if (body.isEmpty) ""
          else body
            .replace("event.", "e.")
            .replaceAll("""\bview\.copy\(""", "__CREATE_BASE__(")
            .replaceAll("""\bview\.""", "__SELF__")
            .replace("__CREATE_BASE__(", form match {
              case "create" => "existing.getOrElse(emptyRow).copy("
              case "updateOnly" => "row.copy("
              case _ if persistenceIdMode => "emptyRow(entityId, e.tenantId.toString).copy("
              case _ => "existing.getOrElse(emptyRow).copy("
            })
            .replaceAll("""__SELF__([A-Za-z_][A-Za-z0-9_]*)""", form match {
              case "updateOnly" => "row.$1"
              case _ => "row.$1" // 先统一 row.，fold 拆包在下一步按列型判定
            })
            .replaceAll("""emptyRow\(entityId, e\.tenantId\)(?!\.toString)""", "emptyRow(entityId, e.tenantId.toString)")
        // delete 形：view.delete(k = e.g, ...) → ("k", "e.g") 键元组（kernel 出键·壳执行）——
        // 元组型 (String, String)：Id 事件字段补 .toString（KS NoteRemoved ("note", e.noteId.toString) 判例）
        val deletePairs: Seq[(String, String)] =
          if (form == "delete")
            """([A-Za-z_][A-Za-z0-9_]*)\s*=\s*e\.([A-Za-z_][A-Za-z0-9_]*)\b(?!\.)(?!\.toString)""".r
              .findAllMatchIn(rewritten)
              .map { m =>
                val ef = m.group(2)
                val suffix = if (eventFieldIsId(ef, h.concreteEventName, ctx)) ".toString" else ""
                (m.group(1), s"e.$ef$suffix")
              }
              .toSeq
          else Nil
        // 类型适配（金样判例：String 列←Id 事件字段→.toString·Option[Instant] 列←Instant 字段→ts()）。
        // 判例（scala-cli 实证）：replaceAllIn 回调里 m.before 是**已替换中间串**——键名回看恒 None。
        // 修法＝顶层逗号切键对逐段判定（嵌套层深计括号·lambda 内 `= e.x` 不动——守卫方言逐字保真）。
        // updateOnly 也适配（KS NoteContentUpdated sourceId = e.noteId→.toString 判例）——
        // 行签名下 Pair 匹配同样成立。
        val adaptedBody =
          adaptKeyPairs(rewritten, h.concreteEventName, viewSchema, form == "create" || form == "persistenceIdCreate")(ctx)
        // 键对/字面量对保留（头注 helper 判定·模板 needsXxx 探针兼容）
        val rawPairs = """([A-Za-z_][A-Za-z0-9_]*)\s*=\s*event\.([A-Za-z_][A-Za-z0-9_]*)""".r
          .findAllMatchIn(expr).map(m => (m.group(1), m.group(2))).toList
        val fieldPairs = rawPairs
          .filter { case (vf, _) => viewColumns.isEmpty || viewColumns.contains(vf) }
          .map { case (vf, ef) => (vf, ef, viewTypeOf(vf)) }
        val literalPairs = """([A-Za-z_][A-Za-z0-9_]*)\s*=\s*("(?:[^"\\]|\\.)*"|\d+L?|true|false)\s*[,)]""".r
          .findAllMatchIn(expr).map(m => (m.group(1), m.group(2))).toList
          .filterNot(l => fieldPairs.exists(_._1 == l._1))
        ApplyEventFunction(
          eventName = h.concreteEventName,
          eventFqn = h.entityEventFqn,
          applyExpr = if (form == "degraded") None else Some(form),
          bodyExpr = adaptedBody,
          applyForm = form,
          fieldPairs = fieldPairs,
          literalPairs = literalPairs,
          droppedColumns = Nil,
          deletePairs = deletePairs,
          viewColumns = viewSchema.map(f => (f.name, ctx.typeResolver.resolve(f.dataType).signature))
        )
      }.toSeq
    else Nil

    ProjectionModel(
      selfType,
      sourceAggregate,
      eventFamilyProtoType,
      repoRef,
      handlers,
      dependencies.filter(_.shouldImport(pkg)).toSet,
      aggregateSources,
      noteIds = meta.noteId.toSeq,
      applyEvents = applyEvents,
      identityScheme = meta.identityScheme
    )
  }

  // ── Phase 2 债①直译引擎类型探针（create 形 Id→.toString/Instant→ts 补缀判定）──

  /** 键对级类型适配：顶层逗号切段（括号深计·lambda 体 `= e.x` 是守卫方言不动），每段
    * `vf = e.ef` 形按列型/事件型补缀：String 列←Id 字段→`.toString`·Option[Instant] 列←Instant
    * 字段→`ts(...)`。反引号字段（`type`）保真。 */
  private def adaptKeyPairs(body: String, eventName: String, viewSchema: Seq[ReadModelField], createForm: Boolean)(implicit ctx: GeneratorContext): String = {
    // 顶层逗号切段：深度计 ( ) 与反引号段
    def splitTop(s: String): Seq[String] = {
      val sb = new StringBuilder
      val out = scala.collection.mutable.ListBuffer[String]()
      var depth = 0
      var inBacktick = false
      for (c <- s) {
        if (c == '`') inBacktick = !inBacktick
        if (!inBacktick) {
          if (c == '(' || c == '[') depth += 1
          else if (c == ')' || c == ']') depth -= 1
        }
        if (c == ',' && depth == 0 && !inBacktick) { out += sb.result(); sb.clear() }
        else sb.append(c)
      }
      out += sb.result()
      out.toSeq
    }
    val Pair = """^(\s*)([A-Za-z_][A-Za-z0-9_]*|`[^`]+`)\s*=\s*e\.([A-Za-z_][A-Za-z0-9_]*)\s*$""".r
    // 对最外层 ".copy(" 开括号区间内的键对段适配（区间外=基座前缀·不动）
    val copyIdx = body.indexOf(".copy(")
    if (copyIdx < 0) body
    else {
      val open = copyIdx + ".copy(".length - 1
      var depth = 0
      var close = -1
      var i = open
      while (i < body.length && close < 0) {
        val c = body.charAt(i)
        if (c == '(') depth += 1
        else if (c == ')') { depth -= 1; if (depth == 0) close = i }
        i += 1
      }
      if (close < 0) body
      else {
        val inner0 = body.substring(open + 1, close)
        // create 形 fold 自引用拆包（金样判例）：`row.<listCol>` → `existing.map(_.<listCol>).getOrElse(Nil)`
        // （copy 区间内·List 列型限定——标量列无此形。updateOnly 行签名下 row.<col> 直用·不拆包）
        val listCols = viewSchema.collect {
          case f if { val t = ctx.typeResolver.resolve(f.dataType); t.signature.startsWith("List[") || t.signature.startsWith("Seq[") } => f.name
        }.toSet
        val inner = if (!createForm) inner0 else """\brow\.([A-Za-z_][A-Za-z0-9_]*)\b""".r.replaceAllIn(inner0, { m =>
          val c = m.group(1)
          if (listCols.contains(c)) s"existing.map(_.$c).getOrElse(Nil)" else m.matched
        })
        val adapted = splitTop(inner).map { seg =>
          seg.trim match {
            case Pair(_, vfRaw, ef) =>
              val vf = vfRaw.stripPrefix("`").stripSuffix("`")
              val colType = viewSchema.find(_.name == vf).map { f =>
                val t = ctx.typeResolver.resolve(f.dataType)
                if (t.name == "Instant" && f.nullable.getOrElse(true)) "Option[Instant]" else t.signature
              }
              // Scala 关键字反引号补缀（键名列名与事件字段名双侧——金样 `type` 判例：
              // 真源 refCode 键名原文无反引号·named-arg 必须反引号才合 named-arg 语法）
              val vfSafe = if (ScalaKeywords.contains(vf)) s"`$vf`" else vfRaw
              val efSafe = if (ScalaKeywords.contains(ef)) s"`$ef`" else ef
              colType match {
                case Some("String") | Some("") if eventFieldIsId(ef, eventName, ctx) => s"$vfSafe = e.$efSafe.toString"
                case Some("Option[Instant]") if eventFieldIsInstant(ef, eventName, ctx) => s"$vfSafe = ts(e.$efSafe)"
                // Controller 三可选参根治批 2026-10-05：事件载荷 Option → 同内型视图列兜底（Patch 事件族
                //   载荷直译 Option 后视图列仍非 Option——String→getOrElse("")·List[X]→getOrElse(Nil)·
                //   None 语义＝不改列。optionEventFieldType 返回**内型**签名（fieldType 不带 Option 包裹·
                //   Option 由 optional 槽另载）——与列型直接比）
                case Some(colSig) if eventFieldIsOption(ef, eventName, ctx) &&
                  (colSig.startsWith("List[") || colSig.startsWith("Seq[")) && colSig == optionEventFieldType(ef, eventName, ctx) =>
                  s"$vfSafe = e.$efSafe.getOrElse(Nil)"
                case Some("String") | Some("") if eventFieldIsOption(ef, eventName, ctx) => s"""$vfSafe = e.$efSafe.getOrElse("")"""
                case _ => s"$vfSafe = e.$efSafe"
              }
            case other => other.trim
          }
        }.mkString(", ")
        body.substring(0, open + 1) + adapted + body.substring(close)}
    }
  }

  /** Scala 保留字（事件字段名反引号补缀词表·type 判例） */
  private val ScalaKeywords = Set("type", "match", "class", "def", "val", "var", "object", "case", "if", "else", "while", "for", "return", "new", "extends", "with", "yield", "sealed", "trait", "import", "package")

  /** 视图列是否 String 标量（直译补 .toString 的目标列型） */
  private def viewTypeIsStringScalar(f: ReadModelField, ctx: GeneratorContext): Boolean = {
    val t = ctx.typeResolver.resolve(f.dataType)
    t.signature == "String" || t.signature.isEmpty
  }

  /** 视图列是否 Option[Instant]（ts() 包判定臂·口径与 Table dtoFieldsOf 同一） */
  private def viewTypeIsInstantOption(f: ReadModelField, ctx: GeneratorContext): Boolean = {
    val t = ctx.typeResolver.resolve(f.dataType)
    t.name == "Instant" && f.nullable.getOrElse(true)
  }

  /** 事件字段是否 Id 型（事件便签 fieldType 探针：UUID 惯例∪字段名 *Id 后缀） */
  private def eventFieldIsId(fieldName: String, eventName: String, ctx: GeneratorContext): Boolean =
    ctx.metaRegistry.resolveAll[SubordinateDomainEventMetadata]
      .find(_.name == eventName).flatMap(_.fields.find(_.name == fieldName))
      .map(f => ctx.typeResolver.resolve(f.fieldType).name == "Id" || fieldName.endsWith("Id"))
      .getOrElse(fieldName.endsWith("Id"))

  /** 事件字段是否 Instant 型（事件便签 fieldType 探针） */
  private def eventFieldIsInstant(fieldName: String, eventName: String, ctx: GeneratorContext): Boolean =
    ctx.metaRegistry.resolveAll[SubordinateDomainEventMetadata]
      .find(_.name == eventName).flatMap(_.fields.find(_.name == fieldName))
      .map(f => ctx.typeResolver.resolve(f.fieldType).name == "Instant")
      .getOrElse(fieldName == "timestamp")

  /** 事件字段是否 Option 包裹型（三可选参批 2026-10-05：Patch 事件族载荷 Option 直译后的视图列兜底判定）。
    * 判据＝FieldMetadata.optional 槽（AssemblyEngine 透传）——fieldType 是 DataTypeMapper 原始映射
    * （"String"）不带 Option 包裹，resolve().name 判恒 false（首跑实证）。 */
  private def eventFieldIsOption(fieldName: String, eventName: String, ctx: GeneratorContext): Boolean =
    ctx.metaRegistry.resolveAll[SubordinateDomainEventMetadata]
      .find(_.name == eventName).flatMap(_.fields.find(_.name == fieldName))
      .map(_.optional)
      .getOrElse(false)

  /** 事件字段的 Option 全签名（`Option[List[String]]` 等·三可选参批 List 内型兜底分支判定） */
  private def optionEventFieldType(fieldName: String, eventName: String, ctx: GeneratorContext): String =
    ctx.metaRegistry.resolveAll[SubordinateDomainEventMetadata]
      .find(_.name == eventName).flatMap(_.fields.find(_.name == fieldName))
      .map(f => ctx.typeResolver.resolve(f.fieldType).signature)
      .getOrElse("")

  /** 解析源聚合类型
    */
  private def resolveSourceAggregate(
      meta: ProjectionMetadata,
      ctx: GeneratorContext
  ): TypeRef = {
    ctx.typeResolver.aggregateRoot(meta.sourceAggregate)
  }

  /** 解析投影仓库引用
    */
  private def resolveRepositoryRef(
      meta: ProjectionMetadata,
      ctx: GeneratorContext
  ): TypeRef = {
    meta.repositoryRef
      .map(ctx.typeResolver.resolve(_))
      .getOrElse(
        throw new IllegalArgumentException(
          s"Projection ${meta.name} must specify a ProjectionRepositoryRef."
        )
      )
  }

  /** 解析事件家族相关的原型类型
    */
  private def resolveEventFamilyTypes(
      meta: ProjectionMetadata,
      ctx: GeneratorContext
  ): (TypeRef, TypeRef) = {
    val eventFamilyProtoType = AggregateRootProtoBuilder
      .getProtoEventFamilyType(meta.sourceAggregate, ctx)
    val eventFamilyProtoImport = AggregateRootProtoBuilder
      .getProtoEventUnionType(meta.sourceAggregate, ctx)

    (eventFamilyProtoType, eventFamilyProtoImport)
  }

  /** 构建投影处理程序
    */
  private def buildHandlers(
      meta: ProjectionMetadata,
      repoRef: TypeRef,
      eventFamilyProtoType: TypeRef,
      eventFamilyProtoImport: TypeRef,
      ctx: GeneratorContext,
      sourceAggregate: TypeRef
  ): Seq[ProjectionHandlerModel] = {
    meta.handlers.map(hMeta =>
      ProjectionHandlerBuilder.build(
        hMeta,
        meta.name,
        repoRef,
        eventFamilyProtoType,
        eventFamilyProtoImport,
        ctx,
        sourceAggregate
      )
    )
  }

  /** 收集所有依赖关系
    */
  private def collectDependencies(
      sourceAggregate: TypeRef,
      repoRef: TypeRef,
      handlers: Seq[ProjectionHandlerModel],
      eventFamilyProtoImport: TypeRef,
      ctx: GeneratorContext,
      pkg: String
  ): Set[TypeRef] = {
    // 收集 Handler 的类型，用于 Template 中的 createProjection 参数
    val handlerTypes = handlers.map(_.selfType)

    val directDeps = Set(sourceAggregate, repoRef) ++ handlerTypes

    val allDeps = handlers.flatMap(_.dependencies).toSet ++ directDeps ++
      Set(
        ctx.knownFrameworkTypes("Inject"),
        ctx.knownFrameworkTypes("ExecutionContext"),
        ctx.knownFrameworkTypes("Projection"),
        // 确保 ActorSystem 是 Typed
        ctx.knownFrameworkTypes("ActorSystem"),
        ctx.typeResolver.scalikeJdbcSession,
        ctx.typeResolver.scalikeJdbcSetup,
        ctx.typeResolver.mongoReadJournal,
        eventFamilyProtoImport
      )

    allDeps
      .flatMap(_.collectAllDependencies)
      .filter(_.shouldImport(pkg))
  }
}
