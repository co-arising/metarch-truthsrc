package net.imadz.codegen.scaffolding.cqrs

import scala.reflect.ClassTag

/** NestedArtifactEntry: 用于存储嵌套 Artifact 的信息 */
case class NestedArtifactEntry(
    selfType: TypeRef,
    ownerType: TypeRef
)

/** ArtifactRegistry: 管理已构建的 ArtifactModel 与 MetadataRegistry 形成对称架构
  */
case class ArtifactRegistry(
    private val artifacts: Map[String, ArtifactModel] = Map.empty,
    private val nestedArtifacts: Map[String, NestedArtifactEntry] = Map.empty
) {

  /** 按名称查找 artifact（使用 selfType.name）
    */
  def resolve[T <: ArtifactModel](
      name: String
  )(implicit ct: ClassTag[T]): Option[T] = {
    artifacts.values
      .find(a => a.selfType.name == name && ct.runtimeClass.isInstance(a))
      .map(_.asInstanceOf[T])
  }

  /** 按 FQN 查找 artifact
    */
  def resolveByFqn(fqn: String): Option[ArtifactModel] = {
    artifacts.get(fqn)
  }

  /** 按 TypeRef 查找 artifact
    */
  def resolveByTypeRef(ref: TypeRef): Option[ArtifactModel] = {
    artifacts.get(ref.fqn)
  }

  /** 按类型查询所有匹配的 artifacts
    */
  def resolveAll[T <: ArtifactModel](implicit ct: ClassTag[T]): Seq[T] = {
    artifacts.values.collect {
      case a if ct.runtimeClass.isInstance(a) => a.asInstanceOf[T]
    }.toSeq
  }

  /** 注册新的 artifact（不可变，返回新实例）
    */
  def register(artifact: ArtifactModel): ArtifactRegistry = {
    val key = artifact.selfType.fqn
    copy(artifacts = artifacts + (key -> artifact))
  }

  /** 批量注册 artifacts
    */
  def registerAll(newArtifacts: Seq[ArtifactModel]): ArtifactRegistry = {
    val entries = newArtifacts.map(a => a.selfType.fqn -> a)
    copy(artifacts = artifacts ++ entries)
  }

  /** 注册嵌套 Artifact（如 EventFamily, Event, Command 等）
    */
  def registerNested(
      selfType: TypeRef,
      ownerType: TypeRef
  ): ArtifactRegistry = {
    val key = selfType.fqn
    val entry = NestedArtifactEntry(selfType, ownerType)
    copy(nestedArtifacts = nestedArtifacts + (key -> entry))
  }

  /** 按 FQN 查找嵌套 Artifact
    */
  def resolveNestedByFqn(fqn: String): Option[NestedArtifactEntry] = {
    nestedArtifacts.get(fqn)
  }

  /** 按 TypeRef 查找嵌套 Artifact
    */
  def resolveNestedByTypeRef(ref: TypeRef): Option[NestedArtifactEntry] = {
    nestedArtifacts.get(ref.fqn)
  }

  /** 查找某个 owner 下的所有嵌套 Artifact
    */
  def resolveNestedByOwner(ownerType: TypeRef): Seq[NestedArtifactEntry] = {
    nestedArtifacts.values.filter(_.ownerType.fqn == ownerType.fqn).toSeq
  }

  /** 获取所有已注册的 artifacts
    */
  def all: Seq[ArtifactModel] = artifacts.values.toSeq

  /** 获取所有已注册的嵌套 artifacts
    */
  def allNested: Seq[NestedArtifactEntry] = nestedArtifacts.values.toSeq

  /** 获取已注册的 artifact 数量
    */
  def size: Int = artifacts.size

  /** 获取已注册的嵌套 artifact 数量
    */
  def nestedSize: Int = nestedArtifacts.size
}

object ArtifactRegistry {
  val empty: ArtifactRegistry = ArtifactRegistry()
}
