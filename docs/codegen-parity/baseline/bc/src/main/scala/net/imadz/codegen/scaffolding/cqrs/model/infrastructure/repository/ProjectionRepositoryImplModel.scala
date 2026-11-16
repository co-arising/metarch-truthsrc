package net.imadz.codegen.scaffolding.cqrs.model.infrastructure.repository


import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

case class ProjectionRepositoryImplModel(
                                          override val selfType: TypeRef,
                                          interfaceType: TypeRef,
                                          dtoType: TypeRef,               // DTO Case Class
                                          methods: Seq[JdbcMethodModel],
                                          override val dependencies: Set[TypeRef],
                                          // [M3 向量读模型] 向量 Impl 注入手写基建（真仓 infrastructure.persistence.vector）：
                                          // PgVectorStore（命名连接池 upsert/delete/search）＋OllamaEmbeddingClient（同步嵌入·可桩）；
                                          // 表路径（TableMetadata）不注入——scalikejdbc DB 单例直用（零漂移）
                                          injectedConstructorParams: Seq[FieldDef] = Nil,
                                          // [M3 向量读模型] 行 Map→DTO 映射等额外成员（向量 Impl 专用；表路径 None）
                                          extraMembers: Option[String] = None,
                                          /** S7（EP §二 G1）：台账 artifacts[] 文件级落点由此可查。 */
                                          override val noteIds: Seq[String] = Nil
                                        ) extends ArtifactModel

case class JdbcMethodModel(
                            name: String,
                            params: Seq[FieldDef],
                            returnType: TypeRef,
                            isFuture: Boolean,
                            bodyLogic: String
                          )

