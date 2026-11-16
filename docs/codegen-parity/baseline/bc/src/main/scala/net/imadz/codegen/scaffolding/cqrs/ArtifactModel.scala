package net.imadz.codegen.scaffolding.cqrs

/** 所有代码生成模型的基类，包含了代码生成所需的通用信息
  */
trait ArtifactModel {

  /** 模型对应的类型引用
    */
  def selfType: TypeRef

  // Helper for unique identification (FQN)
  def fqn: String = selfType.packageName + "." + selfType.name

  /** 模型依赖的所有类型
    */
  def dependencies: Set[TypeRef]

  /** 将自身及嵌套 Artifact 注册到 Registry 默认实现只注册自己，有嵌套 Artifact 的子类可重写此方法
    */
  def registerTo(registry: ArtifactRegistry): ArtifactRegistry =
    registry.register(this)

  /** ★ 本制品承载/派生自的知识映射（EP_GenerationTime_Code_Anchors S1·默认空＝不承载）。
    *
    * 与 `dependencies` **同轴**：模型自述结构性事实、唯一写盘漏斗（`writeArtifact`）处记账——
    * 于是 **builder 保持纯函数**（不碰台账、不持状态），而「态射分类」由 builder **显式构造**，
    * 不待下游按名字反查（用户裁定：「在 builder 能显性给出，何必反查浪费感情」）。
    *
    * 为什么放这里而不是经 `GeneratorContext` 挂收集器：`ctx` 是不可变 case class，
    * 挂可变收集器会破坏其值语义且让 builder 变有副作用。
    *
    * 默认 `Nil` ⇒ 未承载的面**逐字节零改动**（golden master 不漂）。 */
  def morphisms: Seq[net.imadz.meta.MappingMorphism] = Nil

  /** ★ 本制品**落地所承载的知识元素 id**（EP_GenerationTime_Code_Anchors S7·默认空）。
    *
    * 与 `dependencies`/`morphisms` **同轴**：模型自述事实、唯一写盘漏斗（`writeArtifact`）处记账。
    * builder 手里本来就有它的 `meta`（`InvariantRuleBuilder.build(meta, ctx)` 一类），故**由模型报号**；
    * 不在漏斗处按名字回查——名字会撞（本仓既有判例：聚合名 == 角色名 `User`，`MetadataRegistry` 注释逐字）。
    *
    * 为什么需要它：台账 `artifacts[]` 是**文件级落点的权威索引**（961 条·`writeArtifact` 39 个调用点唯一漏斗），
    * 但它此前只有 `path/kind/schemaNode/schemaCategory/families`，**没有知识身份** ⇒
    * 「这条知识落在哪些制品上」问不出来（EP §二 G1）。补上这一列后**文件级**闭环成立，
    * 与**成员级**（`KnCodePoint`·靠 `@knowledge`）互补——两条粒度各有各的用处。
    *
    * 默认 `Nil` ⇒ 未承载的面**逐字节零改动**。 */
  def noteIds: Seq[String] = Nil
}
