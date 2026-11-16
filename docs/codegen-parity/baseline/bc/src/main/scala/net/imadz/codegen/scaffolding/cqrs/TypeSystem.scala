package net.imadz.codegen.scaffolding.cqrs

// 1. 通用类型引用 (物理世界的原子)
case class TypeRef(
                    name: String, // e.g. "Money"
                    packageName: String, // e.g. "net.imadz.banking.domain.values"
                    typeParams: Seq[TypeRef] = Nil
                  ) {
  def fqn: String = if (packageName.isEmpty) name else s"$packageName.$name"

  def signature: String = {
    // 检查是否是 Scala 内建的 Tuple 类型
    val isTuple = name.startsWith("Tuple") &&
      name.drop("Tuple".length).forall(_.isDigit) &&
      typeParams.nonEmpty

    // 我们还可以加上 packageName == "scala" 作为额外的安全检查，尽管 Builder 应该保证这一点。

    if (isTuple) {
      // 如果是 TupleN，使用 (T1, T2, ...) 语法糖
      s"(${typeParams.map(_.signature).mkString(", ")})"
    } else if (typeParams.nonEmpty) {
      // 否则，使用 Name[T1, T2, ...] 泛型
      s"$name[${typeParams.map(_.signature).mkString(", ")}]"
    } else {
      // 普通类型
      name
    }
  }

  // [NEW] 递归收集所有依赖 (包括自身和泛型参数)
  def collectAllDependencies: Set[TypeRef] = {
    Set(this) ++ typeParams.flatMap(_.collectAllDependencies)
  }
  
  // [NEW] 统一判断一个类型是否需要被导入
  def shouldImport(currentPackage: String): Boolean = {
    // 基础类型没有包名，不需要导入
    if (packageName.isEmpty) return false
    
    // 当前包内的类型不需要导入
    if (packageName == currentPackage) return false
    
    // Scala根包的类型不需要导入
    if (packageName == "scala") return false
    
    // Java.lang包的类型不需要导入
    if (packageName == "java.lang") return false
    
    // 其他类型都需要导入
    true
  }
}

object TypeRef {
  // 常用基础类型预定义 (Scala / Java)
  val String = TypeRef("String", "")
  val Int = TypeRef("Int", "")
  val Long = TypeRef("Long", "")
  val Boolean = TypeRef("Boolean", "")
  val Unit = TypeRef("Unit", "")
  val Double = TypeRef("Double", "")
  val BigDecimal = TypeRef("BigDecimal", "scala.math")

  // 集合类型
  def List(inner: TypeRef): TypeRef = TypeRef("List", "", Seq(inner))

  def Option(inner: TypeRef): TypeRef = TypeRef("Option", "", Seq(inner))

  def Map(k: TypeRef, v: TypeRef): TypeRef = TypeRef("Map", "", Seq(k, v))

  val Nothing: TypeRef = TypeRef("Nothing", "scala")
}

// 2. 字段定义 (通用的 name: Type 结构)
case class FieldDef(name: String, typeRef: TypeRef,
                    defaultValue: Option[String] = None, // 新增
                    /** 2026-09-10 S2-82-B2：字段级版本标记透传（proto 尾注释发射） */
                    comment: Option[String] = None,
                    /** 2026-09-20 EP_Note_Tense_Knowledge_Id：字段稳定知识 ID 透传——
                      * 模板发射时随字段写回（Javadoc `@knowledge` 锚点），承载「这个字段来自哪个知识元素」。
                      * None＝合成字段（replyTo/技术参数等），本就无知识来源。 */
                    noteId: Option[String] = None,
                    /** 2026-09-20 注释发射：字段描述（②层 businessDef 透传）——`@param` 正文。 */
                    description: String = "")
