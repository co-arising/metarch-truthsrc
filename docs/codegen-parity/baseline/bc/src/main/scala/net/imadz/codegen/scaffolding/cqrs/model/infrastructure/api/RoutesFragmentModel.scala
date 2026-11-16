package net.imadz.codegen.scaffolding.cqrs.model.infrastructure.api

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, TypeRef}

/** S2-41 R7：routes 标记块 Model——Controller 批产路由片段（conf/routes 标记块内的行集）。
  * 行格式对齐 node 先例（gen_api_controllers builder.mjs:112 写行／tpl_views.mjs:63-64 读行）：
  * `<METHOD 补齐 9 列> <path>  controllers.<Controller>.<action>[(<params>)]`——逐端点组装归
  * RoutesBuilder；gate 声明端点才入集（gate=None 零路由行→Builder 返 None→不产 routes 文件·
  * 不碰既有 routes——零漂移红线）。
  * selfType 非 Scala 件（packageName="conf"／name="routes"——golden 快照位
  * golden_master/conf/routes；ProtoFileModel 非 .scala 件同款先例）。 */
case class RoutesFragmentModel(
                                routeLines: Seq[String],
                                override val selfType: TypeRef = TypeRef("routes", "conf"),
                                override val dependencies: Set[TypeRef] = Set.empty,
                                /** S7 #1c：routes 是共享领地（MarkerBlockWriter 部分合并）——不产台账行，
                                  * 本字段仅为与 ArtifactModel 同轴；号在控制器行上，不在此叠加。 */
                                override val noteIds: Seq[String] = Nil
                              ) extends ArtifactModel
