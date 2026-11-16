package net.imadz.codegen.scaffolding.cqrs.template

import net.imadz.codegen.scaffolding.cqrs.FieldDef
import net.imadz.codegen.structure.NamingConventions

/** 知识注释渲染（共享一件·拆成「行」与「块」两级，便于单块内混合概念行与字段行）。
  *
  * 渊源：`EP_Note_Tense_Knowledge_Id` 末段（用户裁决 A 法）在 `DomainEntityTemplate` 内先落了一版局部实现；
  * `EP_GenerationTime_Code_Anchors` P1 把同形态扩到 rm（读模型 DTO）／pm（命令参数）／vo（值对象成员）三面——
  * 该形态是 `tools/kn_push_code_anchors.mjs` 的**解析契约**（2026-09-23 A1 起为「一个注释块 ＋ 紧邻下一条声明」的真块配对）：
  *   - **形态①**：`@param … @knowledge` 行 + 块后紧跟 `case class` → 字段锚（成员级）；
  *   - **形态③**：`@param … @knowledge` 行 + 块后紧跟 `def` → **方法参数锚**（`pkg.<宿主类型>.<方法名>.<参数名>`）——
  *     工厂/仓库/服务/行为/端点等「字段进方法参数」的面靠它（那些模板没有 `case class`，形态① 结构上认不出）；
  *   - 裸 `@knowledge` 行 + 块后紧跟 `object`/`trait`/`class` → 概念锚（`pkg.<类型名>`）。
  * 三形态共用本渲染件：`paramLines` 出字段/参数行、`conceptLine` 出概念行、`block` 组装块。
  * 复制多份必然漂移，故提到模板层共享一处。**置于 template 层**因为本层是唯一允许字符串插值的层。
  *
  * 发射规则（与旧局部实现逐字节等价，零漂移）：
  *   - 有 `noteId` 的字段发一行 `@param <name> <描述>  @knowledge <noteId>@<hash8>`；
  *     描述给人读、id 给机器读（grep 一个 id 得「哪些代码点位属同一知识元素」）。
  *   - **无 `noteId`（合成/注入字段）不发射**——本无知识来源，不编造。
  *   - 无可发射行时返回空串。
  *
  * **单块纪律（vo 面踩过的坑）**：解析器取「紧跟 `case class` 的**那一个**注释块」。两个块相邻时，
  * 正则 `\/\*\*([\s\S]*?)\*\/\s*case class` 会因为懒匹配跨块扩张，把前一块一并吞进同一次匹配；
  * 而「块内无 `@param` 才算概念锚」的判据随即失效 ⇒ **概念锚被静默吃掉**。
  * 故概念锚与字段锚**必须并进同一个块**，概念行走裸 `@knowledge <id>` 行（由解析器单独识别）。
  */
object KnowledgeAnchorDoc {

  /** 元素级内容哈希后缀包装（`<id>@<hash8>`；EP_Knowledge_Release_Version_Pin）。 */
  private def annotated(raw: String): String =
    net.imadz.codegen.scaffolding.cqrs.CQRSApplicationGenerator
      .annotateKnowledge(Some(raw))
      .getOrElse(raw)

  /** 字段行（不含缩进与块框）：`@param <name> <描述>  @knowledge <id>@<hash8>`。 */
  def paramLines(fields: Seq[FieldDef]): Seq[String] =
    fields.flatMap { f =>
      f.noteId.map { raw =>
        val desc = if (f.description.nonEmpty) s" ${f.description}" else ""
        s"@param ${NamingConventions.scalaIdentifier(f.name)}$desc  @knowledge ${annotated(raw)}"
      }
    }

  /** 概念行（不含缩进与块框）：裸 `@knowledge <id>@<hash8>`——「整个制品出自哪条便签」。 */
  def conceptLine(noteId: Option[String]): Option[String] =
    noteId.map(raw => s"@knowledge ${annotated(raw)}")

  /** 注释块（开注释符＋逐行星号行＋收注释符＋尾随换行）；`lines` 为空返回空串。 */
  def block(lines: Seq[String], indent: String = ""): String =
    if (lines.isEmpty) ""
    else (s"$indent/**" +: lines.map(l => s"$indent * $l") :+ s"$indent */").mkString("\n") + "\n"

  /** 字段注释块——`DomainEntityTemplate`（状态类）／`ProjectionRepositoryTemplate`（读模型 DTO）／
    * 命令参数落点共用。
    *
    * @param indent 块缩进——加在开注释符行、逐行星号行、收注释符行三者的行首（与随后的 `case class` 同级）
    */
  def fieldDoc(fields: Seq[FieldDef], indent: String = ""): String =
    block(paramLines(fields), indent)
}
