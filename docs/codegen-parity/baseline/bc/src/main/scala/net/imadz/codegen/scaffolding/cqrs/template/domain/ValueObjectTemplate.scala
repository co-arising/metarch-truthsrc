package net.imadz.codegen.scaffolding.cqrs.template.domain

import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.domain.ValueObjectModel

import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate
import net.imadz.codegen.scaffolding.cqrs.template.KnowledgeAnchorDoc

object ValueObjectTemplate extends CodeTemplate[ValueObjectModel] {

  def generate(model: ValueObjectModel): String = {
    // 1. 构建包声明
    val pkgDecl = packageDecl(model.selfType.packageName)

    // 2. 构建导入声明
    // [FIX] Use shouldImport to filter dependencies for code generation
    val importDecl = imports(
      model.dependencies
        .filter(_.shouldImport(model.selfType.packageName))
        .toList
        .sortBy(_.fqn)
        .map(_.fqn)
        .distinct: _*
    )

    // 3. 构建类定义
    // BUG-016（批1-C 2026-09-06）：final case class（不可变性硬约束）＋Rich Model 逻辑体
    // （Builder 字段语义派生谓词；零派生时保留桩注释占位——不臆造业务逻辑）
    val classBody =
      if (model.logicMethods.nonEmpty) model.logicMethods.mkString("\n")
      else "  // Value Object Logic Stubs"
    val caseClassDef = finalCaseClass(
      name = model.selfType.name,
      // 批8 P2a（2026-09-30·单号 ep-tgc-7cells-20260930）：成员默认值发射（`= raw 表达式`）——
      // 与 AggregateRootTemplate.scala 同款写法；无默认成员零变化（既有 27 VO 产物逐字节稳定）。
      parameters = model.fields
        .map(f => s"${f.name}: ${f.typeRef.signature}${f.defaultValue.map(d => s" = $d").getOrElse("")}")
        .mkString(", "),
      body = classBody
    )

    // S2-82-B3（2026-09-11·用户拍板 companion implicit jsonFormats）：VO 自带
    // implicit jsonFormat——结构化列协议显性化（typed 视图列 repo 绑定/读端 API
    // Json.toJson 零 import 全域自动发现；嵌套 VO 经编译器跨 companion 解析，
    // 无手工排序）。Instant 字段 VO 附私有 Format[Instant]（ISO-8601 字符串——
    // play-json 无默认 Instant 格式；私有＝不泄漏全局隐式域）。
    val instantNeeded = model.fields.exists(f => f.typeRef.name == "Instant")
    // 批8 P2a（2026-09-30·单号 ep-tgc-7cells-20260930）：含默认值成员的 VO 改发 DefaultValues
    // 容错 reads——Json.format 宏对**缺字段**不认构造器默认（缺 key 即 path-error·play-json 2.9.3
    // javap 实证 using/DefaultValues 在位），须显式 `Json.using[MacroOptions with DefaultValues]`
    // 才回退构造器默认（fieldConceptId 等号槽的「JSON 容错读取」语义）。无默认值成员的 VO 零变化。
    val hasDefaults = model.fields.exists(_.defaultValue.isDefined)
    // 判例 #17 固化为发射规则（codegen-multi-project Stage 3·2026-10-04）：字段数超 22 时
    // play-json 宏无法派生（Scala Function22 上限——「No unapply or unapplySeq」编译红，
    // 24 槽 ConceptDelta 实证）。超限 VO 改发显式 reads/writes 手拼 OFormat（真仓手工终形同款：
    // 有默认值成员容错读——存量行缺新槽不炸；无默认成员必填读；writes 全量键）。
    // ≤22 字段 VO 仍走宏（既有产物逐字节零漂移）。
    // S2-100（2026-10-11·用户拍板容旧）：默认值成员读改两臂——**缺键→默认**（10-01 前旧格式
    // 行合法形状·读侧 upcaster）；**在键→严格解码**（asOpt 会把坏形守卫静默吞成默认值·洗掉
    // API 侧三槽契约 500 执法——10-08 双 500 判例；显式 null 同样拒收＝坏形面）。
    val manualFormat: Option[String] =
      if (model.fields.size <= 22) None
      else {
        val readsArgs = model.fields.map { f =>
          val t = f.typeRef.signature
          f.defaultValue match {
            case Some(d) => s"""        (json \\ "${f.name}").toOption.map(_.as[$t]).getOrElse($d)"""
            case None    => s"""        (json \\ "${f.name}").as[$t]"""
          }
        }.mkString(",\n")
        val writePairs = model.fields
          .map(f => s""""${f.name}" -> d.${f.name}""")
          .grouped(3)
          .map(_.mkString(", "))
          .mkString(",\n        ")
        Some(
          s"""  implicit val jsonFormat: play.api.libs.json.OFormat[${model.selfType.name}] = {
        |    import play.api.libs.json._
        |    val reads = new Reads[${model.selfType.name}] {
        |      override def reads(json: JsValue): JsResult[${model.selfType.name}] = JsSuccess(${model.selfType.name}(
        |$readsArgs))
        |    }
        |    val writes = new OWrites[${model.selfType.name}] {
        |      override def writes(d: ${model.selfType.name}): JsObject = Json.obj(
        |        $writePairs)
        |    }
        |    OFormat(reads, writes)
        |  }""".stripMargin
        )
      }
    val formatExpr =
      if (hasDefaults)
        s"play.api.libs.json.Json.using[play.api.libs.json.Json.MacroOptions with play.api.libs.json.Json.DefaultValues].format[${model.selfType.name}]"
      else
        s"play.api.libs.json.Json.format[${model.selfType.name}]"
    val formatLine = manualFormat.getOrElse(
      s"  implicit val jsonFormat: play.api.libs.json.OFormat[${model.selfType.name}] = $formatExpr")
    val companionBody = (
      (if (instantNeeded) Seq(
        "  private implicit val instantFormat: play.api.libs.json.Format[java.time.Instant] = play.api.libs.json.Format(",
        "    play.api.libs.json.Reads[java.time.Instant](js => js.validate[String].map(java.time.Instant.parse)),",
        "    play.api.libs.json.Writes[java.time.Instant](i => play.api.libs.json.JsString(i.toString)))"
      ) else Nil) :+
        formatLine
    ).mkString("\n")
    val companionDef = ObjectDefinition(name = model.selfType.name, body = companionBody)

    // 4. 构建源文件
    // VO 知识锚：概念级（2026-09-20）＋**成员级**（EP_GenerationTime_Code_Anchors P1 补）。
    // 两者**并进同一个注释块**——概念行走裸 `@knowledge <id>` 行，成员走 `@param … @knowledge` 行；
    // 分两块会被解析器跨块吞并、概念锚静默丢失（机制见 KnowledgeAnchorDoc 类注释）。
    // EP_Knowledge_Release_Version_Pin：两种行都附元素内容哈希（`<id>@<hash8>`·无 hash 则原样）。
    // S7 #2（#22）：概念注解行**只发自有利号**（`voOwnNoteId`）——台账侧的「携带者并集」
    // 是别的元素的便签号，发注解会被孤儿校验判「代码有真源无」；无自有号者源码零注解（如实不冒充）。
    val voDocLines =
      KnowledgeAnchorDoc.conceptLine(model.voOwnNoteId).toSeq ++ KnowledgeAnchorDoc.paramLines(model.fields)
    val voDoc =
      if (voDocLines.isEmpty) Nil
      else Seq(Definition.CommentBlock(KnowledgeAnchorDoc.block(voDocLines).stripSuffix("\n")))
    val sourceFile = SourceFile(
      packageDecl = pkgDecl,
      importDecl = importDecl,
      definitions = (voDoc :+ (caseClassDef: Definition)) :+ (companionDef: Definition)
    )

    // 5. 生成代码
    sourceFile.code
  }
}
