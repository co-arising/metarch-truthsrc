# saga-context（33）

## 范围 / 状态 / 路径

**missing-counterpart**：传统每 `system.application.sagas` 一个 context，虽从 infrastructure 生成阶段调度，输出仍是 `app/$base/application/services/transactor/<Base>Context.scala`，不放 infrastructure 或新 `$base.context`。[调度 L975–987](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L975)。classic 清单里的 saga_v3 与 admitted strict-v3/0.3 bridge 分开；strict Host/Ports 并不是 repository context 的同名替身。

## Scala 完整生产链

[Model](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/transactor/SagaContextModel.scala)、[Builder](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/transactor/SagaContextBuilder.scala)、[Template](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/SagaContextTemplate.scala)、[TypeResolverDSL.sagaContext](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L682)、[CodeGenerationDSL](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala)。

Model 全字段按顺序：`selfType: TypeRef, fields: Seq[FieldDef], dependencies: Set[TypeRef]`；无 defaults/子 model。ArtifactModel 的 selfType 是文件名与 package 来源。

Builder：`pkg=context`、`transactorPkg=root` 两个局部值并未决定 selfType；实际 `ctx.typeResolver.sagaContext(meta.name)`，**不读取显式 context.name 定名**，与 Participant/DefinitionBuilder 优先 context.name 存在潜在分歧。userFields 取 context.fields 或 Nil，保持顺序 resolve。对所有 participants，通过 interactsWith.targetName 找 AggregateRootMetadata.repository；缺少即 `IllegalStateException("No repository for ...")`。requiredRepos 按类型 distinct；当 userFields 中已有相同 `typeRef.name` 时不补（不是按 FQN 判定），否则添加首字母小写仓库名。最终 `(userFields ++ missingRepoFields).distinct`；不自动注入 ClusterSharding。deps=requiredRepos + 用户字段递归依赖；此 builder 未做 shouldImport(pkg) 过滤。

Template 全 construct/RHS：先 package selfType.packageName；dependencies 转 package.name、sorted.distinct，交 imports DSL；fields 逐个 `${name}: ${typeRef.name}`，以逗号换行连接；唯一 `case class selfType.name(...)`，空 body；SourceFile 包/import/definition 拼接。没有 annotation/self-type/type alias/val var/method/继承/辅助构造器/companion/MANUAL/???。这里不含 runtime logic，不应人为添加 ActorRef 到纯领域参数；context 属应用层依赖容器。

固定人工例 [MoneyTransferContext](../baseline/curated-scala/net/imadz/application/services/transactor/MoneyTransferContext.scala) 完整体：

```scala
package net.imadz.application.services.transactor
import net.imadz.application.aggregates.repository.CreditBalanceRepository
case class MoneyTransferContext(creditBalanceRepository: CreditBalanceRepository)
```

它说明 repository context，不证明任何任意命名 metadata 都按预期生成。

## JS 四层差距与 diff

legacy [emit.mjs L171–197](../baseline/js/generators/saga-dsl/emit.mjs#L171) 从每 step 的 participantRef/protocolType 建 Map，按 ref 排序生成 `trait Context { def ref: RecipientRef[Protocol] }`；独立 model/builder/template 不存在，context 拼在 definition 文件。formal [render-host.mjs L26–38](../baseline/js/generators/scala-cqrs-application/render-host.mjs#L26) 是 `Ports { technical; installed; phase ports }`；[emit-strict.mjs L748–755](../baseline/js/generators/saga-dsl/emit-strict.mjs#L748) Host 带 codec/settings/contract/namespace 检查；新 saga-monarch 注入 ApplicationPorts。三者都存在、都不能代替 classic context。

结构性对照，非同输入字节比较。minus 为 legacy 真模板；plus 为已读人工例的目标结构，不新增银行业务：

```diff
 /** Context the steps resolve participant refs from. Wired by the app. */
-trait ${spec.contextType} {
-${context}
-}
+// 独立 application/services/transactor/MoneyTransferContext.scala
+case class MoneyTransferContext(creditBalanceRepository: CreditBalanceRepository)
```

明确决定：classic 独立 context 文件；strict 保留 Host 与 exact-resource resolver，不把 strict 读证据协议降级到 repository find。只有获准 classic target 才实施，否则保持 missing-counterpart。

## Glue / 写集合 / 验收

Glue 是每个完整 `<base>.application.aggregates.repository.<Aggregate>Repository` 类型（依赖字段可能跨 BC，必须按 TypeRef FQN），其 `find<Base>ByUserId` 由 Participant 使用。仓库接口/实现来自生成应用，不是 saga-core JAR。legacy `akka.actor.typed.RecipientRef` 和 strict `PayloadCodec/StrictSagaCoordinator.Settings` 属不同 ABI。库源码存在不证明消费制品有接口；不 publishLocal/rebuild。

proposed 写集合：`generators/scala-cqrs-application/models/saga-context.mjs`、`builders/saga-context.mjs`、`templates/saga-context.mjs`；适配 `generators/saga-dsl/emit.mjs` 的明确 classic 分支。context family 独占文件，definition 停止重复写 trait；调用方/registry/layout/naming/type-resolver/manifest/回锚由集成者协调。shared standards 本次不改。应用根只 domain/application/infrastructure，保留 BC 边界；稳定 saga Name/PID/digest 不因类型 PascalCase 改写。

具体未决：显式 context.name 与 meta.name 两处 resolver 不一致应使用哪个权威名；同 simple name 不同包仓库不能被去重误吞；required repo 与 user field 名碰撞要 fail-closed；类型参数必须由统一 renderer 完整发射，不能仅取 name 丢失泛型。验收未来 `diff -u <bc-context> <js-context>` 全文件、字段顺序/去重/导入和调用方连通；再以实际消费 ABI 验证 participant 可用 typed ref。普通方法 CC≤5，>10 重构或逐方法例外，不用 String/Any dispatcher。生成字节/anchors 稳定，旧 trait 原路径退役必须 manifest 明确。所有验收/生成/构建/测试/服务/Git 均未运行；额外未入基线源码：无。
