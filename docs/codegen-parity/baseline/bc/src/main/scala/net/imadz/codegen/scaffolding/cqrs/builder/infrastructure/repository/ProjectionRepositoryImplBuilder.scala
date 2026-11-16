package net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.repository

import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.repository.{
  JdbcMethodModel,
  ProjectionRepositoryImplModel
}
import net.imadz.codegen.scaffolding.cqrs.{
  FieldDef,
  GeneratorContext,
  TypeRef,
  TypeResolver
}
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta._

/** 投影仓库 Impl 构建（2026-08-24 Task 45/46-71 模式）：
  * 标准方法集（upsert/findByIdentity/findBy<Id>/findAll）的 ScalikeJDBC 实现**确定性推导**——
  * 表名/列/类型全在元数据（TableMetadata + readModelSchema），生成完整实现代码；
  * 模板将其置于 MANUAL 区块内（用户可改、重生成 MERGE 保真）。
  * 类型约定：Instant ↔ BIGINT(epoch milli, null 安全)；List<*> ↔ JSON 文本(play-json)；其余直读直写。 */
object ProjectionRepositoryImplBuilder {

  // S2-82-B3：readExpr 需要 ctx 解析 List 内层类型（List[VO] ↔ as[List[VO]]——
  // 隐式 Reads 由 XxxTable companion 的 VO codecs 提供，Impl 经既有 import XxxTable._ 获得）
  private def readExpr(col: String, dt: DataType, ctx: GeneratorContext): String = dt match {
    case IntType                     => s"""rs.int("$col")"""
    case LongType                    => s"""rs.long("$col")"""
    case BooleanType                 => s"""rs.boolean("$col")"""
    case BigDecimalType              => s"""rsBigDecimal("$col")"""
    case CustomType("Instant", _, _) => s"""rs.longOpt("$col").map(java.time.Instant.ofEpochMilli)"""
    case CustomType("List", _, typeParams) =>
      val innerSig = typeParams.headOption
        .map(TypeResolver.resolve(_, ctx).signature)
        .getOrElse("String")
      s"""Json.parse(rs.string("$col")).as[List[$innerSig]]"""
    case CustomType("Id", _, _)      => s"""Id.of(rs.string("$col"))"""
    case _                           => s"""rs.string("$col")""" // String / 枚举字符串 / 兜底
  }

  private def bindExpr(field: String, dt: DataType): String = {
    val f = NamingConventions.scalaIdentifier(field) // Scala 关键字字段（type）→ 反引号
    dt match {
      case CustomType("Instant", _, _) =>
        s"view.$f.map(x => java.lang.Long.valueOf(x.toEpochMilli)).orNull"
      case CustomType("List", _, _) => s"""Json.toJson(view.$f).toString()"""
      case CustomType("Id", _, _)   => s"view.$f.toString"
      case _                        => s"view.$f"
    }
  }

  private def jsonUsed(fields: Seq[(String, DataType)]): Boolean =
    fields.exists { case (_, CustomType("List", _, _)) => true case _ => false }

  private def usesId(fields: Seq[(String, DataType)]): Boolean =
    fields.exists { case (_, CustomType("Id", _, _)) => true case _ => false }

  // S2-82-B3：List<VO> 列（内层非 String）——VO codecs 由 trait 侧 XxxTable companion 发射
  // （ProjectionRepositoryBuilder.voCodecs），本侧不再退 ??? 桩：bind/read 表达式对任意
  // 内层类型成立（Json.toJson / as[List[VO]]），隐式经 import XxxTable._ 进作用域。
  private def voListInnerDeps(
      fields: Seq[(String, DataType)],
      ctx: GeneratorContext
  ): Set[TypeRef] =
    fields.collect {
      case (_, CustomType("List", _, typeParams)) => typeParams
    }.flatten
      .flatMap(t => TypeResolver.resolve(t, ctx).collectAllDependencies)
      .toSet

  def build(
      meta: ProjectionRepositoryMetadata,
      ctx: GeneratorContext
  ): ProjectionRepositoryImplModel = {
    // S7（EP §二 G1）：repo Impl 的知识身份＝**投影号**（同 ProjectionRepositoryBuilder 的
    // projMeta 手法；本类无 projMeta·按 repositoryRef 反查投影——H016 保证引用名在册）。
    // 三条产出路径（table/vector/graph）共用本解析——单点解析、逐路透传。
    val projNoteIds: Seq[String] = ctx.metaRegistry
      .resolveAll[ProjectionMetadata]
      .find(_.repositoryRef.exists(_.targetName == meta.name))
      .flatMap(_.noteId)
      .toSeq
    meta.storageConfig match {
      case v: PgVectorTableMetadata => buildVector(meta, v, ctx, projNoteIds)
      case g: Neo4jGraphMetadata    => buildGraph(meta, g, ctx, projNoteIds)
      case m: MongoDocumentMetadata => buildMongo(meta, m, ctx, projNoteIds)
      case _                        => buildTable(meta, ctx, projNoteIds)
    }
  }

  /** [视图存储重设计 2026-10-08] Mongo 文档 Impl：注入手写基建 MongoViewStore（真仓
    * infrastructure.persistence.mongo·KnJournalStore 同款 org.mongodb.scala sync 驱动），
    * 方法体＝文档整取整写（play-json ↔ Document 单点转换在 store 侧——DTO 编解码经
    * Json.toJson/Json.parse，schema 演进免疫 guards 型事故）；decode 单行失败＝单行披露不炸集合。
    * offset 语义不动：JdbcProjection 仍持 ScalikeJdbcSession（offset 留 MySQL），handler 内
    * 阻塞调用 mongo（upsert 幂等承接 at-least-once 窗口）。 */
  private def buildMongo(
      meta: ProjectionRepositoryMetadata,
      m: MongoDocumentMetadata,
      ctx: GeneratorContext,
      projNoteIds: Seq[String]
  ): ProjectionRepositoryImplModel = {
    val pkg = ctx.layout.infrastructure.persistence.repositories.projection
    val selfType = ctx.typeResolver.projectionRepositoryImpl(
      s"${NamingConventions.getBaseName(meta.name)}MongoRepositoryImpl", pkg)

    val interfacePkg = ctx.layout.application.projection.repository.root
    val interfaceType =
      ctx.typeResolver.projectionRepositoryInterface(meta.name, interfacePkg)

    val dtoName = NamingConventions.getBaseName(meta.name)
    val dtoType = ctx.typeResolver.projectionDto(dtoName, interfacePkg)

    val mongoPkg = s"${ctx.basePackage}.infrastructure.persistence.mongo"
    val viewStore = TypeRef("MongoViewStore", mongoPkg)
    val collection = m.collection
    val keyField = m.keyField
    // [Phase 3·6合1 2026-10-09] kindValue 非空＝kind 判别式启用：写侧文档注 kind·键判等换 _id 复合
    // （"kv:自然键"——Mongo upsert 对 _id 等值过滤的 replacement 缺 _id 时自动继承过滤值）·
    // 读路径 kind 过滤（同形不设防＝静默混族）。空＝legacy 单视图形逐字节不变（已切 8 族零波及）。
    val kv = m.kindValue
    val keyCol = if (kv.nonEmpty) "_id" else keyField
    // 复合键串：拼接形（s"kv:$expr" 嵌在外层字符串模板里 $ 不会二次求值——字面串坑·拼接零歧义）
    def compositeKey(expr: String): String = if (kv.nonEmpty) s""""$kv:" + $expr""" else expr

    // DTO 字段（name + Scala DataType）：readModelSchema 血统（与表路径同源）
    val schemaFields: Seq[(String, DataType)] = ctx.metaRegistry
      .resolveByName[ProjectionMetadata](dtoName)
      .flatMap(_.readModelSchema)
      .map(_.fields.map(f => (f.name, f.dataType)))
      .getOrElse(Nil)

    // [视图存储重设计 2026-10-08] Document↔DTO 字段级转换（DTO 无 companion codec——序列化面
    // 全在 ViewWrites/手写 Impl，此处发显式 codec：Json.toJson 值域表达式/字段级读取表达式）。
    // 载体契约：MongoViewStore 收发 **JSON 串**（Document.toJson ExtendedJson）；本 Impl play-json
    // 解析后逐字段构造/读取——List 字段（ConceptDelta 等）codec 由 Table companion 血统 import 提供
    // （与表路径 Impl 的 as[List[VO]] 同源）。
    def mongoWriteExpr(f: (String, DataType)): String = {
      val fid = NamingConventions.scalaIdentifier(f._1)
      f._2 match {
        case CustomType("Instant", _, _) => s"""view.$fid.map(x => JsString(x.toString))"""
        // Id（=UUID）可为 null（ParkConcept sourceId/targetId 1228 行全 NULL 实锤）：
        // Json.toJson(null: UUID) NPE 毒死整条投影流——null 守卫归一 JsNull。
        // 括号必须：Json.obj("k" -> if (..) ..) 形 if 表达式在 2.13 解析炸（真仓 14 错实证）
        case CustomType("Id", _, _)      => s"""(if (view.$fid == null) JsNull else Json.toJson(view.$fid))"""
        case CustomType("List", _, _)    => s"""Json.toJson(view.$fid)"""
        case _                            => s"""Json.toJson(view.$fid)"""
      }
    }
    def mongoReadExpr(f: (String, DataType)): String = {
      val fid = NamingConventions.scalaIdentifier(f._1)
      val j = s"""(v \\ "${f._1}")"""
      f._2 match {
        case CustomType("Instant", _, _) =>
          s"""$j.asOpt[Long].map(java.time.Instant.ofEpochMilli).orElse($j.asOpt[String].map(java.time.Instant.parse))"""
        // 读侧对称：JsNull/缺字段/坏串 → null（as[Id] 遇 JsNull 抛异常会把整族行打成毒行）
        case CustomType("Id", _, _)      => s"""$j.asOpt[${ctx.typeResolver.resolve(f._2).signature}].getOrElse(null)"""
        case CustomType("List", _, tp) =>
          val innerSig = tp.headOption.map(t => TypeResolver.resolve(t, ctx).signature).getOrElse("String")
          s"""$j.asOpt[List[$innerSig]].getOrElse(Nil)"""
        case _ => s"""$j.as[${ctx.typeResolver.resolve(f._2).signature}]"""
      }
    }

    val kindEntry = if (kv.nonEmpty) s""",
      "kind" -> JsString("$kv")""" else ""
    val safeRowDef =
      if (kv.nonEmpty) s"""  /** [6合1 kind 判别式] decode 前 kind 门——同 collection 多视图列同形不设防＝静默混族读：
    * kind 不匹配按毒行跳过（与字段级 decode 失败同路径） */
  private def safeRowToView(json: String): Option[$dtoName] =
    for {
      v <- scala.util.Try(play.api.libs.json.Json.parse(json)).toOption
      k <- (v \\\\ "kind").headOption.flatMap(_.asOpt[String]) if k == "$kv"
      row <- scala.util.Try(rowToView(v)).toOption
    } yield row

"""
      else s"""  /** JSON 串 → DTO·毒行隔离 wrapper（S9 反例验证 2026-10-08：decode 失败＝单行披露跳过不炸集合——
    * guards 型全表 500 事故的 Mongo 路免疫面；对照 store 侧 docsToJsons 只挡 toJson 失败，本层挡字段级 decode 失败） */
  private def safeRowToView(json: String): Option[$dtoName] =
    scala.util.Try(rowToView(json)).toOption

"""
    val rowToViewDef =
      if (kv.nonEmpty) s"""  private def rowToView(v: play.api.libs.json.JsValue): $dtoName = $dtoName(
      ${schemaFields.map(f => s"""${NamingConventions.scalaIdentifier(f._1)} = ${mongoReadExpr(f)}""").mkString(",\n      ")})"""
      else s"""  private def rowToView(json: String): $dtoName = {
    val v = play.api.libs.json.Json.parse(json)
    $dtoName(
      ${schemaFields.map(f => s"""${NamingConventions.scalaIdentifier(f._1)} = ${mongoReadExpr(f)}""").mkString(",\n      ")})
  }"""
    val dtoToJson = s"""/** DTO → JSON 串（视图行整取整写——Mongo 文档载体；字段级显式 codec） */
  private def viewToJson(view: $dtoName): String =
    play.api.libs.json.Json.stringify(play.api.libs.json.Json.obj(
      ${schemaFields.map(f => s""""${f._1}" -> ${mongoWriteExpr(f)}""").mkString(",\n      ")}$kindEntry))

$safeRowDef$rowToViewDef"""

    val methods = meta.methods.map { mm =>
      val params = mm.parameters.map(p =>
        FieldDef(p.name, ctx.typeResolver.resolve(p.parameterType), noteId = p.noteId, description = p.description))
      val (returnType, isFuture) = mm match {
        case q: QueryMethod =>
          // count 型聚合（countByTenant）：元数据声明标量 Long——不包容器不包 List（ViewApi total 契约）
          if (q.returnType == LongType)
            (ctx.knownFrameworkTypes("Future").copy(typeParams = Seq(TypeRef.Long)), true)
          else {
            val returnsOption = q.returnType match {
              case CustomType("Option", _, _) => true
              case _ => false
            }
            val containerType =
              if (returnsOption) TypeRef("Option", "", Seq(dtoType))
              else ctx.knownFrameworkTypes("List").copy(typeParams = Seq(dtoType))
            (ctx.knownFrameworkTypes("Future").copy(typeParams = Seq(containerType)), true)
          }
        case _: UpsertMethod => (TypeRef.Unit, false)
      }
      val logic = mm.name match {
        case "upsert" =>
          // keyField 可能是 Id（java.util.UUID）型（CE/FM/RM/VO/UC/TSP/DoR各族 definitionId 等）——
          // MongoViewStore 收 String 键：.toString 归一（KP patchId 恰为 String 型躲过首犯）。
          // [6合1] kv 非空：键判等列换 _id＋复合键串 "kv:自然键"（upsert 对 _id 等值过滤自动继承）
          s"""viewStore.putDocument("$collection", "$keyCol", ${compositeKey(s"""view.$keyField.toString""")}, viewToJson(view))"""
        case "findByIdentity" =>
          s"""viewStore.findByKey("$collection", "$keyCol", ${compositeKey(s"""$keyField.toString""")}).map(_.flatMap(safeRowToView))"""
        case "findByTenantPaged" =>
          val kindCond = if (kv.nonEmpty) s"""Map("kind" -> "$kv")""" else "Map.empty"
          s"""viewStore.findByTenantPaged("$collection", tenantId, limit, offset, $kindCond).map(rows => rows.flatMap(safeRowToView).toList)"""
        case "countByTenant" =>
          // total 与 items 同源：safe 过滤后计数（毒行不计 total——decode 同源结构保证）；
          // kv 非空时 safeRowToView 自带 kind 门＝外族行不计数
          s"""viewStore.findAll("$collection").map(rows => rows.flatMap(safeRowToView).count(_.tenantId == tenantId))"""
        case "findAll" =>
          s"""viewStore.findAll("$collection").map(rows => rows.flatMap(safeRowToView).toList)"""
        case other =>
          // findBy<CatalogId> 等 id 维度查询：按声明参数逐个等值过滤（词表内通用形）
          // [6合1] kv 非空：conds 头插 kind 等值（同形不设防＝静默混族）
          val conds = (if (kv.nonEmpty) Seq(s""""kind" -> "$kv"""") else Nil) ++
            mm.parameters.map(p => s""""${p.name}" -> ${NamingConventions.scalaIdentifier(p.name)}""")
          val condsStr = conds.mkString(", ")
          s"""viewStore.findByFields("$collection", Map($condsStr)).map(rows => rows.flatMap(safeRowToView).toList)"""
      }
      JdbcMethodModel(mm.name, params, returnType, isFuture, logic)
    }

    val frameworkDeps = Set(
      ctx.knownFrameworkTypes("Future"),
      ctx.knownFrameworkTypes("ExecutionContext"),
      interfaceType,
      viewStore,
      ctx.knownFrameworkTypes("Json"),
      TypeRef("JsString", "play.api.libs.json")) ++
      // Id null 守卫的 JsNull（有 Id 字段才有——write 侧 if null JsNull）
      (if (schemaFields.exists { case (_, CustomType("Id", _, _)) => true case _ => false })
         Set(TypeRef("JsNull", "play.api.libs.json"))
       else Set.empty) ++
      // List<VO> 字段内层类型 import（ConceptDelta/RelationDelta 裸名引用——表路径 voListInnerDeps 同源）
      voListInnerDeps(schemaFields, ctx) ++
      schemaFields.flatMap { case (_, dt) => ctx.typeResolver.resolve(dt).collectAllDependencies }.toSet

    ProjectionRepositoryImplModel(
      selfType,
      interfaceType,
      dtoType,
      methods,
      frameworkDeps.filter(_.shouldImport(pkg)),
      injectedConstructorParams = Seq(FieldDef("viewStore", viewStore)),
      extraMembers = Some(dtoToJson),
      noteIds = projNoteIds
    )
  }

  /** [S2-65 图读模型] 图 Impl：静态委托 GraphMutationExecutor（object 单例——零构造器注入，
    * D0 裁决：四动词齐全·Strict 停车场语义唯一权威·租户链/CAS/复合键全在 Executor）。
    * 结构烧录：label/keyName/keySpace 前缀从卡 storage 声明进方法体（s"$keySpace:$key"）；
    * mergeEdge 按「可烧录边」（relationKey==nodeKey∧toKeyId 显式——与装配侧
    * graphRepositoryMethods 同规）烧 edgeType→(toLabel, toKeyName, toKeySpace 前缀) match，
    * 白名单外 edgeType fail-fast。LINKS 类语义边（relationKey≠nodeKey）＝manual-only 不进 match。 */
  private def buildGraph(
      meta: ProjectionRepositoryMetadata,
      g: Neo4jGraphMetadata,
      ctx: GeneratorContext,
      projNoteIds: Seq[String]
  ): ProjectionRepositoryImplModel = {
    val pkg = ctx.layout.infrastructure.persistence.repositories.projection
    val selfType = ctx.typeResolver.projectionRepositoryImpl(meta, pkg)
    val interfacePkg = ctx.layout.application.projection.repository.root
    val interfaceType = ctx.typeResolver.projectionRepositoryInterface(meta.name, interfacePkg)
    val dtoName = NamingConventions.getBaseName(meta.name)
    val dtoType = ctx.typeResolver.projectionDto(dtoName, interfacePkg)

    val graphPkg = s"${ctx.basePackage}.infrastructure.graph"
    val executor = TypeRef("GraphMutationExecutor", graphPkg)
    val ex = "GraphMutationExecutor"
    val strict = s"$ex.ExecutionMode.Strict"
    val label = g.nodeLabel
    val keyName = g.nodeKey
    val prefixedKey = (k: String) => s"""s"${g.keySpace}:$$$k""""

    val burnable = g.edgeMappings.filter(e => e.relationKey == g.nodeKey && e.toKeyId.trim.nonEmpty)

    def verbLogic(name: String): String = name match {
      case "upsertNode" =>
        s"""$ex.apply($ex.UpsertNode("$label", "$keyName", ${prefixedKey("key")}, props), $strict)"""
      case "updateNodeProps" =>
        s"""$ex.apply($ex.UpdateNodeProps("$label", "$keyName", ${prefixedKey("key")}, props), $strict)"""
      case "deleteNode" =>
        s"""$ex.apply($ex.DeleteNode("$label", "$keyName", ${prefixedKey("key")}, Some(tenantId)), $strict)"""
      case "mergeEdge" =>
        if (burnable.isEmpty)
          throw new IllegalArgumentException(
            s"graph repository ${meta.name} 声明 mergeEdge 但无可烧录边（relationKey==nodeKey∧toKeyId 显式）——装配侧 graphRepositoryMethods 与此处同规，请核对真源 storage.edgeMappings")
        val cases = burnable.map { e =>
          val toPrefix = if (e.toKeySpace.trim.isEmpty) "" else s"${e.toKeySpace}:"
          s"""    case "${e.edgeType}" => ("${e.toLabel}", "${e.toKeyId}", "$toPrefix")"""
        }.mkString("\n")
        s"""val (toLabel, toKeyName, toKeyPrefix) = edgeType match {
$cases
    case other => throw new IllegalArgumentException(s"edgeType '$$other' 不在 ${meta.name} edgeMappings 白名单")
}
$ex.apply(
  $ex.MergeEdge(edgeType, "$label", "$keyName", ${prefixedKey("fromKey")}, toLabel, toKeyName, s"$$toKeyPrefix$$toKey", Map("tenantId" -> tenantId)),
  $strict)"""
      case "mergeLinkTolerant" =>
        // CM-11（三可选参批 2026-10-05 固化）：容忍语义烧在手写 Impl（Strict+catch·词表外 LINKS 边）
        //   ——生成 Impl 落 ??? 占位（手写 override 接管·占位即诚实暴露未接线）
        "??? // CM-11：容忍语义手写面（GraphMutationExecutor Strict+catch·悬空端点弃置）"
      case other =>
        throw new IllegalArgumentException(
          s"graph repository ${meta.name} 出词表方法 '$other'——图动词面仅 upsertNode/updateNodeProps/deleteNode/mergeEdge/mergeLinkTolerant（出词表逻辑归 MANUAL handler·批E）")
    }

    val methods = meta.methods.map { m =>
      // 2026-09-23 EP_GenerationTime_Code_Anchors B4（断链修复）：`ParameterMetadata` 带 noteId，
      // 此前只搬 name/type ⇒ impl 侧方法参数到不了模板（本文件两处·table / vector 两路径）。
      val params = m.parameters.map(p =>
        FieldDef(p.name, ctx.typeResolver.resolve(p.parameterType), noteId = p.noteId, description = p.description))
      JdbcMethodModel(m.name, params, TypeRef.Unit, isFuture = false, verbLogic(m.name))
    }

    val methodDeps = methods.flatMap(_.params.flatMap(_.typeRef.collectAllDependencies))
    val dependencies = (Set(interfaceType, executor) ++ methodDeps).filter(_.shouldImport(pkg))

    ProjectionRepositoryImplModel(
      selfType,
      interfaceType,
      dtoType,
      methods,
      dependencies,
      noteIds = projNoteIds
    )
  }

  /** [M3 向量读模型] 向量 Impl：注入手写基建 PgVectorStore＋OllamaEmbeddingClient（真仓
    * infrastructure.persistence.vector·HTTP/池逻辑全在手写基建），方法体＝机械委托调用
    * （upsert 同步嵌入→行 upsert／delete→按 (sourceType,sourceId) 删／findByIdentity·search→
    * 行 Map→DTO 映射）。列名 camelCase→snake_case 与 DDL（gen_projection_ddl pgvector 方言）一致。 */
  private def buildVector(
      meta: ProjectionRepositoryMetadata,
      v: PgVectorTableMetadata,
      ctx: GeneratorContext,
      projNoteIds: Seq[String]
  ): ProjectionRepositoryImplModel = {
    val pkg = ctx.layout.infrastructure.persistence.repositories.projection
    val selfType = ctx.typeResolver.projectionRepositoryImpl(meta, pkg)

    val interfacePkg = ctx.layout.application.projection.repository.root
    val interfaceType =
      ctx.typeResolver.projectionRepositoryInterface(meta.name, interfacePkg)

    val dtoName = NamingConventions.getBaseName(meta.name)
    val dtoType = ctx.typeResolver.projectionDto(dtoName, interfacePkg)

    // DTO 字段（name + Scala 类型签名）：readModelSchema 血统（与接口 Builder 同源）
    val schemaFields: Seq[(String, DataType)] = ctx.metaRegistry
      .resolveByName[ProjectionMetadata](dtoName)
      .flatMap(_.readModelSchema)
      .map(_.fields.map(f => (f.name, f.dataType)))
      .getOrElse(Nil)

    def toSnake(s: String): String =
      s.replaceAll("([a-z0-9])([A-Z])", "$1_$2").toLowerCase
    val columns = schemaFields.map(f => toSnake(f._1))
    // 键字段（identityKeys＝字段名序列·声明序）；向量接口固定契约：键字段名与方法参数名同名
    val keyFields: Seq[String] = ctx.metaRegistry
      .resolveByName[ProjectionMetadata](dtoName)
      .flatMap(_.readModelSchema)
      .map(_.identityKeys)
      .getOrElse(Nil)
    val keyCols = keyFields.map(toSnake)

    val vectorPkg = s"${ctx.basePackage}.infrastructure.persistence.vector"
    val pgVectorStore = TypeRef("PgVectorStore", vectorPkg)
    val embeddingClient = TypeRef("OllamaEmbeddingClient", vectorPkg)
    val table = v.tableName
    val embeddingCol = v.embeddingColumn
    val embedField = schemaFields
      .find(f => toSnake(f._1) == "embed_text")
      .map(f => NamingConventions.scalaIdentifier(f._1))
      .getOrElse(schemaFields.head._1)

    val upsertLogic = s"""// 投影内同步嵌入（M3 拍板）：${embedField} → ${v.embedding.model}(${v.dims}d) → pgvector 行 upsert
val embedding = embeddingClient.embed(view.$embedField)
pgVectorStore.upsert(
  table = "$table",
  columns = Seq(
    ${schemaFields.map(f => s""""${toSnake(f._1)}" -> view.${NamingConventions.scalaIdentifier(f._1)}""").mkString(",\n    ")}),
  embeddingColumn = "$embeddingCol",
  embedding = embedding,
  keyColumns = Seq(${keyCols.map(c => s""""$c"""").mkString(", ")}))"""

    val deleteLogic = s"""// 删除事件折叠（fold 词表 view.delete）：sourceId 全局唯一，按 (sourceType, sourceId) 删行
pgVectorStore.delete(
  table = "$table",
  sourceType = sourceType,
  sourceId = sourceId)"""

    val identityLogic = s"""Future {
  pgVectorStore.findByKeys(
    table = "$table",
    keys = Map(${keyFields.map(f => s""""${toSnake(f)}" -> ${NamingConventions.scalaIdentifier(f)}""").mkString(", ")}),
    columns = ViewColumns)
    .map(rowToView)
}"""

    val searchLogic = s"""Future {
  pgVectorStore.search(
    table = "$table",
    tenantId = tenantId,
    queryEmbedding = queryEmbedding,
    k = k,
    sourceType = sourceType,
    columns = ViewColumns)
    .map(rowToView)
}"""

    val rowToView = s"""private val ViewColumns: Seq[String] = Seq(${columns.map(c => s""""$c"""").mkString(", ")})

  /** 行 Map（PgVectorStore 按列名返回）→ DTO 映射（embedding 列不出检索面） */
  private def rowToView(row: Map[String, Any]): $dtoName = $dtoName(
    ${schemaFields.map(f => s"""${NamingConventions.scalaIdentifier(f._1)} = row("${toSnake(f._1)}").asInstanceOf[${ctx.typeResolver.resolve(f._2).signature}]""").mkString(",\n    ")})"""

    val methods = Seq(
      JdbcMethodModel("upsert", Seq(FieldDef("view", dtoType)), TypeRef.Unit, false, upsertLogic),
      JdbcMethodModel("findByIdentity",
        Seq(FieldDef("tenantId", TypeRef.String), FieldDef("sourceType", TypeRef.String), FieldDef("sourceId", TypeRef.String)),
        ctx.knownFrameworkTypes("Future").copy(typeParams = Seq(TypeRef("Option", "", Seq(dtoType)))),
        true, identityLogic),
      JdbcMethodModel("delete",
        Seq(FieldDef("sourceType", TypeRef.String), FieldDef("sourceId", TypeRef.String)),
        TypeRef.Unit, false, deleteLogic),
      JdbcMethodModel("search",
        Seq(FieldDef("tenantId", TypeRef.String), FieldDef("queryEmbedding", TypeRef("Array", "", Seq(TypeRef("Float", "")))),
          FieldDef("k", TypeRef.Int), FieldDef("sourceType", TypeRef("Option", "", Seq(TypeRef.String)))),
        ctx.knownFrameworkTypes("Future").copy(typeParams = Seq(ctx.knownFrameworkTypes("List").copy(typeParams = Seq(dtoType)))),
        true, searchLogic)
    )

    val frameworkDeps = Set(
      ctx.knownFrameworkTypes("Future"),
      ctx.knownFrameworkTypes("ExecutionContext"),
      interfaceType,
      pgVectorStore,
      embeddingClient)

    ProjectionRepositoryImplModel(
      selfType,
      interfaceType,
      dtoType,
      methods,
      frameworkDeps.filter(_.shouldImport(pkg)),
      injectedConstructorParams = Seq(
        FieldDef("pgVectorStore", pgVectorStore),
        FieldDef("embeddingClient", embeddingClient)),
      extraMembers = Some(rowToView),
      noteIds = projNoteIds
    )
  }

  private def buildTable(
      meta: ProjectionRepositoryMetadata,
      ctx: GeneratorContext,
      projNoteIds: Seq[String]
  ): ProjectionRepositoryImplModel = {
    val pkg = ctx.layout.infrastructure.persistence.repositories.projection
    val selfType = ctx.typeResolver.projectionRepositoryImpl(meta, pkg)

    val interfacePkg = ctx.layout.application.projection.repository.root
    val interfaceType =
      ctx.typeResolver.projectionRepositoryInterface(meta.name, interfacePkg)

    // DTO Case Class Name
    val dtoName = NamingConventions.getBaseName(meta.name)
    val dtoType = ctx.typeResolver.projectionDto(dtoName, interfacePkg)

    // 字段（name + Scala DataType）：优先 readModelSchema（与接口 Builder 同源），兜底表列
    // storageMeta 仅 table 形状消费（列兜底）——mongo/vector/graph 形状 schemaFields 必非空不触达兜底
    val tableMeta = meta.storageConfig match {
      case t: TableMetadata => t
      case _ => TableMetadata(s"${dtoName.toLowerCase}_table", Nil)
    }
    val schemaFields: Seq[(String, DataType)] = ctx.metaRegistry
      .resolveByName[ProjectionMetadata](dtoName)
      .flatMap(_.readModelSchema)
      .map(_.fields.map(f => (f.name, f.dataType)))
      .filter(_.nonEmpty)
      .getOrElse(tableMeta.columns.map(c => (c.name, StringType)))

    val keyCols = tableMeta.columns.filter(_.isPrimaryKey).map(_.name).toList

    val methods = meta.methods.map { m =>
      val params = m.parameters.map(p =>
        FieldDef(p.name, ctx.typeResolver.resolve(p.parameterType), noteId = p.noteId, description = p.description)
      )

      val (returnType, isFuture) = m match {
        case q: QueryMethod =>
          val returnsOption = q.returnType match {
            case CustomType("Option", _, _) => true
            case _                          => false
          }
          val listType =
            ctx.knownFrameworkTypes("List").copy(typeParams = Seq(dtoType))
          val containerType =
            if (returnsOption) TypeRef("Option", "", Seq(dtoType)) else listType
          val futureType =
            ctx.knownFrameworkTypes("Future").copy(typeParams = Seq(containerType))
          (futureType, true)

        case u: UpsertMethod => (TypeRef.Unit, false)
      }

      val logic = m match {
        case u: UpsertMethod =>
          // 列名一律反引号：order/condition 等是 SQL 保留字（DDL gen_projection_ddl 同约定）
          val cols = schemaFields.map(f => s"`${f._1}`")
          val colList = cols.mkString(", ")
          val placeholders = schemaFields.map(_ => "?").mkString(", ")
          val updates = schemaFields
            .map(_._1)
            .filterNot(keyCols.contains)
            .map(c => s"`$c` = VALUES(`$c`)").mkString(", ")
          val binds = schemaFields
            .map { case (f, dt) => bindExpr(f, dt) }
            .mkString(",\n          ")
          s"""DB.localTx { implicit session =>
             |  sql\"\"\"INSERT INTO ${tableMeta.tableName}
             |        ($colList)
             |        VALUES ($placeholders)
             |        ON DUPLICATE KEY UPDATE $updates\"\"\"
             |    .bind(
             |          $binds
             |        )
             |    .update.apply()
             |}""".stripMargin

        case q: QueryMethod =>
          val terminal = q.returnType match {
            case CustomType("Option", _, _) => "headOption"
            case _                          => "list"
          }
          val selectCols = schemaFields.map(f => s"`${f._1}`").mkString(", ")
          val where = q.parameters match {
            case Nil => ""
            case ps  =>
              val cond = ps.map(p => s"`${p.name}` = ?").mkString(" AND ")
              s"\n              WHERE $cond"
          }
          val binds = q.parameters.map(p => p.name).mkString(", ")
          val mapBody = schemaFields
            .map { case (f, dt) => s"${NamingConventions.scalaIdentifier(f)} = ${readExpr(f, dt, ctx)}" }
            .mkString(",\n            ")
          val bindClause = if (binds.isEmpty) "" else s"\n          .bind($binds)"
          s"""Future {
             |      DB readOnly { implicit session =>
             |        sql\"\"\"SELECT $selectCols
             |              FROM ${tableMeta.tableName}$where\"\"\"$bindClause
             |          .map(rs => $dtoName(
             |            $mapBody
             |          ))
             |          .$terminal.apply()
             |      }
             |    }""".stripMargin
      }

      JdbcMethodModel(m.name, params, returnType, isFuture, logic)
    }

    val jsonDeps =
      if (jsonUsed(schemaFields)) Set(ctx.knownFrameworkTypes("Json")) else Set.empty
    val idDeps =
      if (usesId(schemaFields)) Set(TypeRef("Id", "net.imadz.common")) else Set.empty // object Id（Id.of）
    // S2-82-B3：List<VO> 列的内层 VO 类型 import（readExpr 的 as[List[VO]] 裸名引用）
    val voDeps = voListInnerDeps(schemaFields, ctx)
    val frameworkDeps = Set(
      ctx.knownFrameworkTypes("Future"),
      ctx.knownFrameworkTypes("ExecutionContext"),
      interfaceType
    ) ++ jsonDeps ++ idDeps

    val methodDeps =
      methods.flatMap(m => m.params.flatMap(_.typeRef.collectAllDependencies))

    val dependencies = (frameworkDeps ++ methodDeps ++ voDeps).filter(_.shouldImport(pkg))

    ProjectionRepositoryImplModel(
      selfType,
      interfaceType,
      dtoType,
      methods,
      dependencies,
      noteIds = projNoteIds
    )
  }
}
