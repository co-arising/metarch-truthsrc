# saga-trigger-protocol：经典 Saga 触发聚合协议内容规格

## 1. 范围、证据等级与固定来源

- artifact/group：`saga-trigger-protocol`；清单 ordinal **18**。
- 状态：**decision-required**。经典 MBT 内容已定位；当前 JS 有真实的触发/回复协议，但没有本经典协议的同合同、同输入对应产物。这个缺项记为 `missing-counterpart`，不能把 strict host 或 family 的同名 `protocol` 当作实现证明。
- 固定检视 HEAD：BC `cc335eb1e0d0fae17bf092fd61b126040196ea70`；JS `bf104e16ab82ef39d7fa416d0997907d18a815ad`。内容身份以 [baseline/index.json](../baseline/index.json) 的完整副本、bytes、SHA-256 为准，不以 HEAD 代替工作树字节。
- 本文仅作源码内容检视。没有运行生成器、编译、测试、typecheck、runtime、服务或下载；没有编辑真源、生成应用、catalog、ledger、anchors 或其他人的 diff；原有 15 份 diff 不在本次写集合。
- 权威依据为 [AUTHORING-CONTRACT](../AUTHORING-CONTRACT.md)、[布局标准](../layout-and-style.md) 和 [批准计划](../../../.rounds/prettify-generated-code-resume-20261115-cgr9lzlk/APPROVED-PLAN.md)。本批没有真源树修改，不执行 validate/roundtrip。

### 1.1 固定全文与指纹

下列链接均指向冻结全文；`#Lx-Ly` 是该副本的源码行号。MBT 三文件已完整实读；大型调用方按本文引用的有界区段实读。其他支撑文件的完整指纹由 index 中同名 snapshot 行提供。

|角色|完整固定文件|bytes|SHA-256|
|---|---|---:|---|
|Model（四件共用）|[SagaTriggerModels.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/transactor/SagaTriggerModels.scala#L1-L71)|2982|`c7331985fb13f32e0f8104fed9110893703eece551f03c7da031796a073db2f1`|
|Builder（四件共用）|[SagaTriggerBuilder.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/transactor/SagaTriggerBuilder.scala#L1-L158)|8368|`43876918912c7a5c97e18a647821f1467c74f6ee0ed058906de4d76a25cfa664`|
|Template|[SagaTriggerProtocolTemplate.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/SagaTriggerProtocolTemplate.scala#L1-L51)|1800|`656729b7dda1265fa45e1d766c62a5a590ac68321d8202802107a63ea28b3055`|
|原始示例输入，不是新输出|[Examples.scala](../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L199-L287)|41607|`aaa4fbe90fa903e4e133014276506c2d18781c599a27385e8948ada9e8ebdeb3`|
|银行实际复合 host|[bank_payment_hostHost.scala](../baseline/actual-js/app/example/bankwealth/application/bank_payment_hostHost.scala#L1-L131)|11966|`e74f76532abdadc384d4fda34cad3d8896d34898c5996b3e3fa85758afa986c4`|
|银行实际调用方|[bank_cash_payment_v1Execution.scala](../baseline/actual-js/app/example/bankwealth/application/bank_cash_payment_v1Execution.scala#L1-L67)|8367|`2e8d40cc640f32e56daae32250ff27a8d630f776d76ac3b8fb57029fe8258c0d`|
|formal pipeline renderer|[render-pipeline-invocation.mjs](../baseline/js/generators/scala-cqrs-application/render-pipeline-invocation.mjs#L1-L50)|13592|`772e29795c4513b530272d6642776042ab785a741e5b1b4be02a6aac541943ed`|
|formal direct renderer|[render-invocation-host.mjs](../baseline/js/generators/scala-cqrs-application/render-invocation-host.mjs#L1-L47)|12868|`72fb4b6e3e350f00c1b84d47e3f863b56572f91eae49a314c2487a96e28d808d`|

上述八项本次只读计算 bytes/SHA，与 index 一致；这是内容身份检查，不是行为验证。

### 1.2 四种材料不得混签

|材料|本制品可取得的内容|不得声称|
|---|---|---|
|`raw-scala`|完整冻结 M/B/T；§4.3 是对冻结 Examples 中一个 Saga 的**人工静态展开**，没有执行模板|不是新生成、可编译或完整链运行证据|
|`approved-target`|原始成员合同叠加已批准的三层布局、imports/命名、显式应用命令回复合同要求；§4.4 是保留 raw API 的排版目标全文；§9 的接口问题仍待裁定|不是批准把银行 strict 语义降级到 classic 的许可证|
|`actual-js`|上表银行冻结完整文件，§6 按协议和剩余成员分账|不是同输入 raw-scala 的输出，不是新鲜度或运行成功证明|
|curated reference|index 中 `curated-scala/.../application/services/transactor/` 有 `FromAccountParticipant.scala`、`MoneyTransferContext.scala`、`MoneyTransferSagaDefinition.scala`、`ToAccountParticipant.scala`，没有本 TriggerProtocol 的完整人工参考；模板注释提到 `FabSagaProtocol`，不构成该文件已被捕获的证据|不能把 MoneyTransfer Definition 或模板注释当作 TriggerProtocol 金样；不能虚构一个 bank golden|

## 2. Scala 调度、基数与文件所有权

入口为 [CodegenMain.scala:192–241](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L192-L241) 的传统 `generate`/共用层调用，不是 `semanticProductsFile → generateProducts`（同文件 183–188）。[runCommon:203–220](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L203-L220) 调用 application 层；[735–770](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L735-L770) 对 **每个 `app.sagas` 元素**，按 participant → definition → protocol → entity → root → behaviors 顺序处理。

本族准确调用为 759–761：

```scala
val protoModel = SagaTriggerBuilder.buildProtocol(meta, ctx)
writeArtifact(protoModel, SagaTriggerProtocolTemplate.generate(protoModel), root,
  Some(ArtifactAttribution("saga-trigger-protocol", protoModel.selfType.name, "saga", List(meta.name))))
```

没有 `triggerCommands.nonEmpty`、`replyMetadata.nonEmpty` 或 `triggerCommandName` 的额外调度条件。前面的 participant/definition 构建失败会阻止到达本调用，不保证缺 args 的完整链会走到这里。单独 `buildProtocol` 不要求 args；后续 Entity/Behaviors 要求 args。

- 正常计划基数：每个可到达的 Saga **一个 `.scala` 文件**；不是每命令一文件。内容为一个 object、一个命令 sealed trait、`N` 个非 Update 触发 case class、一个状态命令、一个确认 case class。
- `app.sagas = Nil`：0 文件，`suppressed`。
- 非空 Saga 且 N=0：Template 仍发命令 trait、状态命令、确认；不是空模板自动抑制。Behaviors 的首命令参数拼接另有缺口，不能称该变体可执行。
- `enabled` 只表示源分支可达；本次所有变体 `exercised=false`。
- [PackageLayout:54–65](../baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala#L54-L65) 给定 `<base>.application.services.transactor`；业务根下面没有第四层。
- 单工程：`<target>/app/<base as path>/application/services/transactor/<Base>SagaTransactorProtocol.scala`。
- **原始多模块也回落到相同 `app/` 路径**：`saga-trigger-protocol` 不在 [targetModuleOf:331–349](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L331-L349) 的 case 中，返回 None；[writeArtifact:366–377](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L366-L377) 选择 `app`。不能凭 application 包推断它已经落 `modules/glue/src/main/scala`。
- [writeArtifact:388–424](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L388-L424)：先按模型 dependencies 和 symbol table 记 ledger，再检查 scope；通过后加 `fingerprintHeader`、调用 territorial writer；仅 strict anchorRoot 非空且真实写成时收集 anchors。`schemaNode=protoModel.selfType.name`，`families=List(meta.name)`，不是自动以真实 Saga id 作为 schemaNode。本族模型没有 noteIds/morphisms 覆盖。

## 3. Model 与 Builder 的逐项合同

### 3.1 本族完整模型声明

原文 [Model:14–29](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/transactor/SagaTriggerModels.scala#L14-L29)：

```scala
/** Protocol：触发命令（带 replyTo）+ 状态回灌命令 + admin 命令 + 确认回复。 */
case class SagaTriggerProtocolModel(
    override val selfType: TypeRef,
    triggerCommands: Seq[SagaTriggerCommandModel],
    confirmationType: TypeRef,
    statusCommandType: TypeRef,
    transactionResultType: TypeRef,
    tracingStepType: TypeRef,
    dependencies: Set[TypeRef]
) extends ArtifactModel

case class SagaTriggerCommandModel(
    name: String,
    params: Seq[FieldDef],       // 参数（不含 replyTo·模板自动补）
    handlerArgs: Seq[String]     // 处理器实参名（params + replyTo）——模板经 `cmd.<名>` 解构
)
```

|顺序/字段|类型与默认值|原始来源/用途|JS 应有的结构位置|
|---|---|---|---|
|M1 `selfType`|`override val TypeRef`，无默认|`<Base>SagaTransactorProtocol` + transactor 包；文件/object 的名字|独立 protocol model 的 TypeRef；不能把 host 的 `text` 作为模型|
|M2 `triggerCommands`|`Seq[SagaTriggerCommandModel]`，无默认|保留源命令顺序；排除名字以 Update 开头者|有序数组，不能按 id 排序或 Set 去重|
|M3 `confirmationType`|`TypeRef`，无默认|固定 `<Base>SagaConfirmation`，不是 `meta.replyMetadata`|显式 confirmation TypeRef，输入与声明回复矛盾见 D1|
|M4 `statusCommandType`|`TypeRef`，无默认|第一个 Update 名，缺失时合成 `Update<Base>SagaStatus`|显式状态命令与角色；不从银行 `Observed` 名称猜同义|
|M5 `transactionResultType`|`TypeRef`，无默认|解析 `CustomType("TransactionResult", coordinatorPkg)`|保留真实 runtime owner 与 signature|
|M6 `tracingStepType`|`TypeRef`，无默认|解析 `CustomType("TracingStep", coordinatorPkg)`|保留名义类型；不可替换成 StepSpecSnapshot|
|M7 `dependencies`|`Set[TypeRef]`，无默认|参数的直接 typeRef + 两个 runtime 类型 + ActorRef + Cbor marker，过滤 shouldImport|显式依赖集，排序/去重为 renderer 前可追踪结构|
|C1 `name`|`String`，无默认|命令原名|类型名，不是稳定业务 id 的替代|
|C2 `params`|`Seq[FieldDef]`，无默认|仅参数名、resolve 后类型；此序列不含自动 replyTo|纯参数与 transport 字段分离|
|C3 `handlerArgs`|`Seq[String]`，无默认|`parameters.map(_.name) :+ "replyTo"`|Protocol Template 不消费；Behaviors 逐项发 `cmd.<名>`；不是任意方法体|

共享 [FieldDef:76–85](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L76-L85) 的全部有序字段为 `name: String`、`typeRef: TypeRef`、`defaultValue: Option[String] = None`、`comment: Option[String] = None`、`noteId: Option[String] = None`、`description: String = ""`。Builder 只传前两项，故后四项全取默认；Template 即使拿到这些字段，也只读 name/typeRef，不发默认/注释/字段锚。

输入 [ParameterMetadata:167–178](../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L167-L178) 的 `optional=false`、`optionalWhen=""`、`noteId=None`、`description=""` 在本 Builder **均不消费**；不能声称 optional 会自动变 Option。输入 [SubordinateCommandMetadata:352–370](../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L352-L370) 的 `replyToType`、`isReadOnly=false`、`description`、`isSystemCommand=false`、`noteId=None` 也不参与本族派生。

[ArtifactModel 全文](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L1-L48) 的继承义务：`selfType`/`dependencies` 抽象；`fqn = selfType.packageName + "." + selfType.name`；`registerTo(registry) = registry.register(this)`；`morphisms = Nil`、`noteIds = Nil`。本模型没有额外成员、body 字符串、annotation、自类型或泛型参数，也没有重写上述默认值。

共享 TypeRef 的顺序为 `name: String`、`packageName: String`、`typeParams: Seq[TypeRef] = Nil`；[TypeSystem:9–51](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L9-L51) 定义：空 package 的 fqn 为 name，否则 `package.name`；signature 对有参数的 `Tuple`+数字名使用 `(T1, T2)`，其他泛型使用 `Name[T1, T2]`，无参数为 name；`collectAllDependencies = Set(this) ++ typeParams.flatMap(_.collectAllDependencies)`；shouldImport 排除空包/同包/scala/java.lang。**本 Builder 没有调用 collectAllDependencies**，嵌套参数依赖漏收是 raw 债务，不是目标允许漏 import。

### 3.2 共享文件其他模型的全部字段（不取得其他制品所有权）

以下全为无默认值的 case class 主构造字段，顺序与 [Model:31–71](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/transactor/SagaTriggerModels.scala#L31-L71) 一致，各自 extends ArtifactModel。列出它们是因为本族依赖共享文件，不表示本文规格替代其他三个 diff。

|模型|全部字段及类型，按声明顺序|
|---|---|
|`SagaTriggerEntityModel`|`override val selfType: TypeRef`; `stateType: TypeRef`; `argsFields: Seq[FieldDef]`; `statusType: TypeRef`; `dependencies: Set[TypeRef]`|
|`SagaTriggerRootModel`|`override val selfType: TypeRef`; `entityName: String`; `tagPrefix: String`; `commandType: TypeRef`; `coordinatorType: TypeRef`; `contextType: TypeRef`; `behaviorsType: TypeRef`; `dependencies: Set[TypeRef]`|
|`SagaTriggerBehaviorsModel`|`override val selfType: TypeRef`; `entityName: String`; `stateType: TypeRef`; `eventType: TypeRef`; `commandType: TypeRef`; `definitionType: TypeRef`; `argsType: TypeRef`; `argsFields: Seq[FieldDef]`; `triggerCommands: Seq[SagaTriggerCommandModel]`; **`argsCtorExpr: String`**; `confirmationType: TypeRef`; `statusCommandType: TypeRef`; `coordinatorType: TypeRef`; `contextType: TypeRef`; `transactionResultType: TypeRef`; `dependencies: Set[TypeRef]`|

### 3.3 本族 Builder 完整方法与规则

[Builder:17–49](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/transactor/SagaTriggerBuilder.scala#L17-L49) 的实际代码如下，不把注释中的“去后缀”当作实现。

```scala
object SagaTriggerBuilder {

  private val coordinatorPkg = "net.imadz.infra.saga"

  def buildProtocol(meta: SagaTransactorMetadata, ctx: GeneratorContext): SagaTriggerProtocolModel = {
    val pkg = ctx.layout.application.services.transactor.root
    val baseName = meta.name.replace("SagaTransactor", "")
    val triggerNames = meta.commandFamily.commands.map(_.name).filterNot(_.startsWith("Update")).toSet
    val triggers = meta.commandFamily.commands
      .filter(c => triggerNames.contains(c.name))
      .map(c => SagaTriggerCommandModel(c.name, c.parameters.map(p => FieldDef(p.name, ctx.typeResolver.resolve(p.parameterType))), c.parameters.map(_.name) :+ "replyTo"))
    val confirmation = TypeRef(s"${baseName}SagaConfirmation", pkg)
    val statusCmd = TypeRef(
      meta.commandFamily.commands.map(_.name).find(_.startsWith("Update")).getOrElse(s"Update${baseName}SagaStatus"),
      pkg
    )
    val deps = (triggers.flatMap(_.params.map(_.typeRef)).toSet ++ Set(
      ctx.typeResolver.resolve(CustomType("TransactionResult", coordinatorPkg)),
      ctx.typeResolver.resolve(CustomType("TracingStep", coordinatorPkg)),
      ctx.knownFrameworkTypes("ActorRef"),
      ctx.knownFrameworkTypes("CborSerializable")
    )).filter(_.shouldImport(pkg))

    SagaTriggerProtocolModel(
      selfType = TypeRef(s"${baseName}SagaTransactorProtocol", pkg),
      triggerCommands = triggers,
      confirmationType = confirmation,
      statusCommandType = statusCmd,
      transactionResultType = ctx.typeResolver.resolve(CustomType("TransactionResult", coordinatorPkg)),
      tracingStepType = ctx.typeResolver.resolve(CustomType("TracingStep", coordinatorPkg)),
      dependencies = deps
    )
  }
}
```

此代码块展示本族方法的完整 body；共享 object 中另外四个方法的全文见上方 Builder 固定链接，全部分支/RHS 在下表独立登记。

|规则|源行|准确派生/分支/依赖与目标处理|
|---|---:|---|
|B1 包/基名|22–23|包取 layout；`replace("SagaTransactor", "")` 删除所有匹配片段，不只末尾。`NamingConventions.getSagaTransactorProtocol` 实际给 `<Base>Protocol`（[233–235](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L228-L239)），本 Builder **不用它**；JS 不能盲换 resolver 改 API。|
|B2 触发集合|24–27|从全部 command names 排除 startsWith Update，再回到原 Seq 过滤；Set 不会去重第二遍中的重复命令。忽略 `meta.triggerCommandName`；保留所有非 Update 命令，包括 isReadOnly 标记者。|
|B3 参数/实参|27|每参按 `(p.name, resolve(p.parameterType))` 建 FieldDef；handlerArgs 始终追加 replyTo。无字段冲突、重复 replyTo、关键字或类型同名检查。参数 optional/source metadata 被丢弃。|
|B4 确认|28|总是 `<Base>SagaConfirmation`；不读 replyMetadata、命令 replyToType 或原 commandFamily.name。|
|B5 状态命令|29–32|只取**第一个** Update 命令的名字；其参数/回复合同完全不读；没找到才合成名字。其他 Update 被整体遗漏。状态 case class 的 id 类型由 Template 硬编码 String。|
|B6 依赖|33–38|参数直接类型集合并 TransactionResult/TracingStep/ActorRef/CborSerializable；shouldImport 过滤；不递归、不引入确认/状态类型 import。|
|B7 返回|40–48|按 M1–M7 named args 构造；runtime 类型再 resolve 一次；没有写盘、registry 注册或手写回调。|
|B8 类型解析|支撑文件|[TypeResolver:19–90](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala#L19-L93)：原始基本类型、各具名 ref、StructRef 查 symbol owner/否则 values 包；CustomType **优先按 name 命中 knownFrameworkTypes**并递归参数，否则仅对 `net.imadz.domain.values` 重映射；未匹配退 Any，`resolveMetaRef` 为 `???`。这是明确未实现槽；不能把 Any fallback 当成功。|
|B9 runtime owner|支撑文件|[GeneratorContext:166–173](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L166-L173) 已把 TransactionResult/TracingStep 指到 `net.imadz.infra.saga.SagaTransactionCoordinator`。故不能只看 coordinatorPkg 就误报它们被发成包级 import。|

### 3.4 共用 Builder 剩余方法逐分支登记

|方法/源行|全部计算与输出规则（全文仍以冻结 Builder 为准）|
|---|---|
|`buildEntity` 51–70|pkg=domain.entities.root；同样 replace 基名；`meta.args.getOrElse(throw new RuntimeException(s"Saga '${meta.name}' lacks args (v3)"))`；按 args.fields 顺序 resolve 为 FieldDef；state=`<Base>TransactionState`、status=`<Base>Status`；deps=args 直接类型 + CborSerializable + resolve(CustomType("Id","net.imadz.common"))，再 shouldImport；selfType=`<Base>TransactionEntity`；named args 分别传 stateType/argsFields/statusType/deps。|
|`buildRoot` 72–92|pkg=transactor.root；protocol=`<Base>SagaTransactorProtocol`；behaviors=`<Base>SagaTransactorBehaviors` 放 behaviors 子包；context 有值则 `ctx.typeResolver.sagaContext(c.name)`，否则 `.sagaContext(meta.name)`；deps **仅** protocol/behaviors/context 经 shouldImport。返回 selfType=TypeRef(meta.name,pkg)、entityName=`<Base>Transaction`、tagPrefix=baseName.toLowerCase、commandType=`<Base>SagaCommand`、coordinatorType=resolve(SagaTransactionCoordinator)、上述 context/behaviors/deps。coordinatorType 不在所建 deps 中。|
|`argsCtorExpr` 96–112|只看 `triggers.headOption`；paramByName 来自首命令参数 map 或 Map.empty；moneyParam 是首命令第一个 typeRef.name==Money 的参数名。按 argsFields 顺序匹配：同名参数 Money 且 args 名 amount→`amount.amount`；Money 且 args 名 currency→`currency.currency.getCurrencyCode`；args String 且同名参数 Id→`<name>.toString`；其他同名→`<name>`；无同名但 args 名 amount 且存在 moneyParam→`<money>.amount`；currency 同条件→`<money>.currency.getCurrencyCode`；其他无同名→仍输出 `<name>`。最后 `mkString(", ")`。参数 meta 本身未使用；最终是明确的 Scala **源码字符串槽**，fallback 可能成为未绑定标识符。|
|`buildBehaviors` 114–138|pkg=transactor.behaviors；rootPkg=transactor.root；同样 args 必填/字段解析；调用 buildProtocol/buildEntity；context 分支同 buildRoot；definition=`<Base>SagaDefinition`。deps 为 Protocol、entity.selfType、entity.stateType、definition、protocol.confirmationType、context、protocol.transactionResultType、EntityRef、ActorRef，加全部触发参数直接类型；shouldImport 过滤。|
|`buildBehaviors` 139–156|返回字段顺序即 §3.2：self `<Base>SagaTransactorBehaviors`；entityName `<Base>Transaction`；state 来自 entity；event `<Base>TransactionEvent` 在 domain entities；command `<Base>SagaCommand`；definition；argsType=argsMeta.name 在 rootPkg；argsFields；protocol.triggerCommands；argsCtorExpr(上述首命令规则)；confirmation/status 来自 protocol；resolve(SagaTransactionCoordinator)；context；protocol.transactionResultType；deps。|

因此“共享 Builder 完整阅读”不等于本族拥有其 Entity/Root/Behaviors 实施。特别是多个触发命令参数不同时，Behaviors 以首命令参数生成一个 initiateHandler；新增 Protocol 多命令验收必须连同此消费者核验，不能只通过声明文件。

## 4. Template 全文、输出顺序与 RHS 账

### 4.1 完整原始 Template

以下是冻结 Template 的完整源码，不是经美化后的伪原文。

```scala
package net.imadz.codegen.scaffolding.cqrs.template.application.transactor

import net.imadz.codegen.scaffolding.cqrs.model.application.transactor.SagaTriggerProtocolModel
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

/** saga_v3 触发聚合 Protocol 模板（**B·§13**）——触发命令 + 状态回灌命令 + 确认回复。
  * golden 参考：playAkkaCQRS `FabSagaProtocol`。 */
object SagaTriggerProtocolTemplate extends CodeTemplate[SagaTriggerProtocolModel] {
  def generate(model: SagaTriggerProtocolModel): String = {
    import model._
    val baseName = selfType.name.replace("SagaTransactorProtocol", "")
    val cmdFamily = s"${baseName}SagaCommand"

    val imports = dependencies.map(_.fqn).toSeq.distinct.sorted.map(i => s"import $i").mkString("\n")

    val triggerCases = triggerCommands.map { c =>
      val ps = (c.params.map(p => s"    ${p.name}: ${p.typeRef.signature}") :+ s"    replyTo: ActorRef[${confirmationType.name}]").mkString(",\n")
      s"""  case class ${c.name}(
$ps
  ) extends $cmdFamily"""
    }.mkString("\n\n")

    s"""package ${selfType.packageName}

import akka.actor.typed.ActorRef
$imports

object ${selfType.name} {

  // --- Commands ---
  sealed trait $cmdFamily extends _root_.net.imadz.common.CborSerializable

$triggerCases

  // 内部：接收 saga coordinator 的异步终态
  case class ${statusCommandType.name}(
    id: String,
    newStatus: ${transactionResultType.signature},
    replyTo: ActorRef[${confirmationType.name}]
  ) extends $cmdFamily

  // --- Replies ---
  case class ${confirmationType.name}(
    transactionId: _root_.net.imadz.common.CommonTypes.Id,
    error: Option[String],
    tracing: List[${tracingStepType.signature}] = Nil
  ) extends _root_.net.imadz.common.CborSerializable
}
"""
  }
}
```

共享 [CodeTemplate.scala:5–6](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/CodeTemplate.scala#L5-L6) 只要求 `CodeTemplate[M <: ArtifactModel].generate(model: M): String`。这个上界属于生成器，不是生成 Scala 协议的泛型。

### 4.2 逐 construct 与 RHS（模板从上到下）

|稳定项|Template 行|raw-scala 全部内容规则|approved-target/实际差距|
|---|---:|---|---|
|T0 局部模型计算|10–21|import model._；baseName 再全量 replace SagaTransactorProtocol；cmdFamily=`<Base>SagaCommand`；dependencies→fqn→distinct→sorted→每行 import；每条命令构造完整参数列表，并在尾部追加 replyTo；命令块以双换行连接|推导移到 JS Builder；Template 仅按有序 model 渲染。不得改变字段序或把 handlerArgs 当 body。|
|T1 package|23|`package selfType.packageName` 后空行|保留 application.services.transactor；physical module 决策另账。|
|T2 imports|25–26|先固定 `import akka.actor.typed.ActorRef`，随后整个按 fqn 排序的 dependencies；通常会**重复 ActorRef**；Cbor import 会存在但正文仍写 `_root_`|目标整体去重，框架/项目分组；递归补全无歧义依赖；同名冲突不能静默缩名。|
|T3 object|28–29|`object selfType.name {`，随后空行，无 extends/构造器/初始化块|独立 Protocol object；不是 host/runtime 混合 object。|
|T4 Commands 组|30–31|固定注释；`sealed trait <Base>SagaCommand extends _root_.net.imadz.common.CborSerializable`；无 body、方法或 type alias|保留 trait/标记；缩名仅在 import 无歧义时。|
|T5 触发 case class 循环|16–21、33|输入 triggerCommands，按原序；**不是 final**；参数按 params 原序，每行四空格 `name: signature`，再 `replyTo: ActorRef[confirmationType.name]`；`extends cmdFamily`；无 field default、body、annotation、隐式参数、MANUAL 区|ActorRef 仅对已确立回复合同的应用 Actor 命令生成。raw 无条件追加是基准例外，不得照搬为“所有 domain 参数也追加”。|
|T6 状态注释/命令|35–40|固定中文注释；公开 `case class statusCommandType.name(id: String, newStatus: transactionResultType.signature, replyTo: ActorRef[confirmationType.name]) extends cmdFamily`；此顺序固定，全部无默认值|“内部”只是注释，**并非 private**。保留 raw API 作比较；与 strict Observed 的可见性/结果类型不同，不能直接改名互换。|
|T7 Replies 组|42|固定 `// --- Replies ---`|保留分组；不合入 Events。|
|T8 确认|43–47|`case class confirmationType.name(transactionId: _root_.net.imadz.common.CommonTypes.Id, error: Option[String], tracing: List[tracingStepType.signature] = Nil) extends _root_.net.imadz.common.CborSerializable`|仅 tracing 有默认 RHS **Nil**；error 无 `= None`，transactionId 也无默认；不引入成功布尔或把 nominal TxId 合并为此 Id。|
|T9 文件结尾|48–49|关闭 object，并保留终止换行|fingerprint/anchor 以排版后的最终字节计算。|

Template 不生成 admin 命令（尽管 Model 注释提及），也不生成 Handler alias、Entity State/Events、reply helper、JSON codec、PB、PID、serializer、val/var/lazy/implicit、重载、辅助构造器、自类型、annotation、业务方法或回复副作用。case class 编译器自动合成的 companion/copy 等不冒充模板显式构造。不能为凑“所有 Protocol 一样”添加这些不存在的成员。

### 4.3 raw-scala：冻结 Examples 的人工静态展开全文

不是一次新运行。取 [Examples:208–230、260–286](../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L208-L286) 的 `MoneyTransferSagaTransactor`；`contextName=banking`（364），[GeneratorContext:295–299](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L295-L299) 因而选 `net.imadz.banking`。原 metadata 的 `TransactionResultConfirmation`、`MoneyTransferTransactionCommand`、状态参数 Id 没有被 Builder 原样采用，展开如实保留这个差异。未包含运行期 writer 才添加的 fingerprintHeader。

```scala
package net.imadz.banking.application.services.transactor

import akka.actor.typed.ActorRef
import akka.actor.typed.ActorRef
import net.imadz.banking.domain.values.Money
import net.imadz.common.CborSerializable
import net.imadz.common.CommonTypes.Id
import net.imadz.infra.saga.SagaTransactionCoordinator.TracingStep
import net.imadz.infra.saga.SagaTransactionCoordinator.TransactionResult

object MoneyTransferSagaTransactorProtocol {

  // --- Commands ---
  sealed trait MoneyTransferSagaCommand extends _root_.net.imadz.common.CborSerializable

  case class InitiateMoneyTransferTransaction(
    fromUserId: Id,
    toUserId: Id,
    amount: Money,
    replyTo: ActorRef[MoneyTransferSagaConfirmation]
  ) extends MoneyTransferSagaCommand

  // 内部：接收 saga coordinator 的异步终态
  case class UpdateMoneyTransferTransactionStatus(
    id: String,
    newStatus: TransactionResult,
    replyTo: ActorRef[MoneyTransferSagaConfirmation]
  ) extends MoneyTransferSagaCommand

  // --- Replies ---
  case class MoneyTransferSagaConfirmation(
    transactionId: _root_.net.imadz.common.CommonTypes.Id,
    error: Option[String],
    tracing: List[TracingStep] = Nil
  ) extends _root_.net.imadz.common.CborSerializable
}
```

### 4.4 approved-target：已批准表达覆盖后的完整结构示例

以下保留 raw 的全部类型身份、构造顺序、字段与 Nil 默认，仅作明确的 imports/简名覆盖。**它不是对 D1 的业务回复映射裁定**；真正接入时必须有显式确认合同才可发该 Actor 命令。完整银行接口不能由此例推导。没有 fresh same-input outputs，本文只作结构性对照。

```scala
package net.imadz.banking.application.services.transactor

import akka.actor.typed.ActorRef

import net.imadz.banking.domain.values.Money
import net.imadz.common.CborSerializable
import net.imadz.common.CommonTypes.Id
import net.imadz.infra.saga.SagaTransactionCoordinator.TracingStep
import net.imadz.infra.saga.SagaTransactionCoordinator.TransactionResult

object MoneyTransferSagaTransactorProtocol {

  // --- Commands ---
  sealed trait MoneyTransferSagaCommand extends CborSerializable

  case class InitiateMoneyTransferTransaction(
    fromUserId: Id,
    toUserId: Id,
    amount: Money,
    replyTo: ActorRef[MoneyTransferSagaConfirmation]
  ) extends MoneyTransferSagaCommand

  // 内部：接收 saga coordinator 的异步终态
  case class UpdateMoneyTransferTransactionStatus(
    id: String,
    newStatus: TransactionResult,
    replyTo: ActorRef[MoneyTransferSagaConfirmation]
  ) extends MoneyTransferSagaCommand

  // --- Replies ---
  case class MoneyTransferSagaConfirmation(
    transactionId: Id,
    error: Option[String],
    tracing: List[TracingStep] = Nil
  ) extends CborSerializable
}
```

raw→target 的有限白名单：重复 ActorRef 删除；imports 分组空行；三个 `_root_` 类型引用改为已导入的同一符号。此例不改 package、API、visibility、default、继承、结果语义。泛型依赖补全/冲突诊断属于一般目标规则，并非此例观测到的另一个产物差异。

## 5. JS 当前链路：formal、legacy、family 分别追踪

### 5.1 formal 银行路线

[registeredProductProducer:92–101](../baseline/js/lib/products/generate-cli.mjs#L92-L101) 实际注册了 application、application-v2、child/effect 各版、play-service 与新 family 等函数，**不含 saga-dsl**。不能从目录名字推断路由。

银行样式对应 [scala-cqrs-play-service/generate.mjs:16–26、59–70](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L16-L70)：它继承 `createEffectRegistry('2')`；后者 [produce-effect:6–25](../baseline/js/generators/scala-cqrs-application/produce-effect.mjs#L6-L25) 继承 `applicationRegistry(version)`；[produce:17–33](../baseline/js/generators/scala-cqrs-application/produce.mjs#L17-L33) 的 `finite-host-dsl` 调用 `renderDefinitions`、`renderInvocationHosts`、adapters、technical ports、HostIO、verification。play-service 改 productFootprint，但此 host renderer 不被 aggregate/invariant 的 override 替换。child 分支 [produce-child:10–22](../baseline/js/generators/scala-cqrs-application/produce-child.mjs#L10-L22) 同样继承 finite-host renderer，再替换测试/执行计划闭包。旧生成文件头写 `scala-cqrs-domain:1` 不能单凭头确定最终入口；上述结论来自调用链和冻结输出内容吻合，不宣称已查到本次银行 request/执行回执。

[renderInvocationHosts:12–24](../baseline/js/generators/scala-cqrs-application/render-invocation-host.mjs#L12-L24) 按 `h.entry.startOwner.kind`：

- `pipeline`：调用 `renderPipelineInvocation`。
- `direct`：生成 `Submit(original, replyTo)`、`Observe(replyTo)`、private Observed/Delivered；回复为 Accepted/Waiting/Conflict/ResultRecorded。随后 27 行还生成 `ReceiveEntry(input, replyTo)`。
- 其他 kind：`APPLICATION_HOST` 拒绝，不是静默略过。

[renderPipelineInvocation:7–50](../baseline/js/generators/scala-cqrs-application/render-pipeline-invocation.mjs#L7-L50) 直接消费 products/options，查 pipeline、step.invokeSaga、runtime、layout；12 行用 `replaceAll('-', '_')` 构造 host/execution 类型名，34 行把 Request/Reply/Event/State 全拼入同一个 `text`，最后 48 行调用 `wireHostIO`，49 行给 writer entry。没有与 M1–M7 对等的 protocol model；输入验证/推导/字符串模板/输出组装混在一起。

银行实际文件中的 `AdmissionGranted`、`Admitted`、admitted state 以及 technical 参数不是 34 行模板的原始成员：[wireHostIO:5–22](../baseline/js/generators/scala-cqrs-application/render-host-io.mjs#L5-L22) 在最终文本上 replace/slice 插入它们，并以 `HostIO.deliver` 替换交付 body。只拆第一段 text 会丢失这些真实构造。

### 5.2 legacy 两条不同路线

1. **core legacy producer**：[src/core/generate.mjs:23–41](../baseline/js/src/core/generate.mjs#L23-L41) 按 manifest 动态导入 `generate.mjs`，拒绝 declaredProducts 型 producer，并对两次返回 entry 做确定性检查。`saga-dsl/generator.json` 允许的 kind 仅 legacy source/三个 contract JSON 类别。
   - [saga-dsl/generate:116–146](../baseline/js/generators/saga-dsl/generate.mjs#L116-L146)：legacy 需要完整 `legacySagaSpecs` 且不能降级 canonical.sagas；strict-contract 生成 contract/phases/consumption JSON，标 `runnable:false`；该入口的 strict-scala 明确抛 `SAGA_RUNTIME_BINDING_UNVERIFIED`。
   - [emitLegacySagaSpec:158–225](../baseline/js/generators/saga-dsl/emit.mjs#L158-L225) 发 Args case class+JSON Format、Context RecipientRef 方法、SagaDefinition/steps/preCheck/errorText/onResult/register。其 `command[Reply]((txId,replyTo)=>...)` 是**参与者调用构造**，不是触发聚合协议声明。显式 trusted source 槽为 prelude/helpers/preCheck/preCheckError/各 phase.commandArgs；不能用这些槽绕过本族模型。
2. **standalone run-all strict/composition 路线**：不能因为上面的 strict-scala 被拒就称全部 strict emitters 不可达。[run-all:33–46](../baseline/js/generators/run-all.mjs#L33-L46) 检查位置参数后建 output/scratch 并 compileTree；[2182–2207](../baseline/js/generators/run-all.mjs#L2182-L2207) 在 sagaBinding+canonical.sagas 非空时调用 emitStrictFiles/emitStrictHostFiles；[2298–2362](../baseline/js/generators/run-all.mjs#L2298-L2362) 另在 execution binding 存在时调用 emitInvocationHostFiles。
   [emit-invocation-host:63–96](../baseline/js/generators/saga-dsl/emit-invocation-host.mjs#L63-L96) 有 `BeginOperation(..., replyTo: ActorRef[OperationReply])`、`GetProgress` 和进度内部命令，但还有 composition checkpoints/child run 身份；run-all 2334–2351 的实际 model 是 `fixture.composition/FabCompositionHost`。它是另一复合家族，不是 classic SagaTriggerProtocol，不迁入银行来冒充对应。

### 5.3 新 family（不是银行 formal host 的同一 renderer）

[scala-cqrs-saga-monarch-v1/generate:12–35](../baseline/js/generators/scala-cqrs-saga-monarch-v1/generate.mjs#L12-L35) 要求八个固定 products 与 live implementation capture，先 buildModels 再 render；[generate-cli:58–62、79–80](../baseline/js/lib/products/generate-cli.mjs#L58-L80) 明确该 producer 必须走 generate-project，`generate-products` 连 `--plan` 也拒绝。

[build-models:35–76](../baseline/js/generators/scala-cqrs-saga-monarch-v1/build-models.mjs#L35-L76) 要求恰两参与者串行 TCC、五个 request roles、完整五种结果、固定 runtime supply，拒绝非空 exact decimal/money descriptors；package 当前为 `.kernel/.glue/.root`。这些是业务包，不等于 module source root；目标三层规则要求另案迁移，不能保留为第四/第五层。

[build-models:157–175、385–398](../baseline/js/generators/scala-cqrs-saga-monarch-v1/build-models.mjs#L157-L175) 将 protocol 定义为文件容器并合并多种 nominal values、request/result、ports/support；[render:12–29](../baseline/js/generators/scala-cqrs-saga-monarch-v1/render.mjs#L12-L29) 唯一模板映射 `protocol: kernelTemplate`。完整 [kernelTemplate:5–108](../baseline/js/generators/scala-cqrs-saga-monarch-v1/templates/kernel.mjs#L5-L108) 按序输出有界 nominal wrappers、request/result、codec/transaction/phase/item/association 类型、五种 SagaResult、phase receipts/commands、participant observations/ports、association/result/evidence/recovery ports、application ports、Future facade、BinaryCodec，再循环 [runProtocolTemplate:4–86](../baseline/js/generators/scala-cqrs-saga-monarch-v1/templates/run-protocol.mjs#L4-L86)。后者是 Input/Output/State/Steps/按 port 的 Outcome、pure Leaf 或持久操作 Request/Evidence/Observation/Leaf，不是带 ActorRef 的经典命令族。

这一路已有结构模型和 nominal 协议，不能写“JS 从未有 Model/Template”；但它没有 M3/M4/M5/M6 的经典含义，也没有 classic `Update…Status/…SagaConfirmation`，且不能把纯领域 phase commands 加 ActorRef 来满足应用协议要求。本文只判定接线和协议职责，不把相关大 family 的全部实现冒认成本文已做一对一内容审查。

## 6. actual-js 完整文件的有序责任账与真实 diff

完整银行 host 原文见 §1；以下表使未放入 Protocol 的构造仍有去向，避免“拆协议”等于删行为。行号均指 `bank_payment_hostHost.scala`。目标中的新名称/路径只描述 source ownership，持久化类型搬迁必须先通过 D2/D6。

|现有成员，源行|完整 RHS/分支或明确类型合同|处理归属|
|---|---|---|
|文件头/package/imports 1–10|generated header；`.application`；ActorRef/Behavior、Behaviors、PersistenceId、Effect/EventSourcedBehavior、ByteString、strict 通配、ExecutionContext/Future|协议只取实际必要 imports；runtime/persistence imports 随行为迁移，header/注释均由唯一 assembly owner 维护|
|object/Request 12–16|`bank_payment_hostHost`; Request sealed；Invoke(State, ActorRef[Reply])；private final Observed(StrictSagaCoordinator.Reply, ActorRef[Reply])；private final Delivered(String,Boolean,ActorRef[Reply])|触发/内部回复处理职责存在；不能把 Observed 换成 classic TransactionResult 而不适配|
|Reply 17–20|sealed Reply；final Pending(reason:String)、Conflict(reason:String)、Completed(result: execution.pay_cash_purchaseResult)，无默认/body|保留三种语义；Pending 不可改成功，Completed 不是 classic Confirmation 的同构名义类型|
|Events 21–27|Associated(original:ByteString,args:ByteString,operation:String)、IdentityObserved(TransactionIdentity)、ResultIntent(kind:String)、DeliveryAcknowledged(kind:String)、AdmissionGranted；随后 private Admitted(denial:Option[String],operation:String) 属 Request|事件/持久状态不进目标 Protocol；Admitted 须在应用行为协议/同文件可访问的私有边界保留，不能变成领域 event|
|State 28|original/args=`ByteString.EMPTY`，operation=`""`，identity/result=`None`，delivered/admitted=`false`，字段顺序固定|基础设施持久 association state，不伪装纯 domain State；不能改变 serializer 绑定/默认字节|
|originalInput 29|依次从 inputs 取 operation、fundOrderId、investorAccountId、fundCollectionAccountId、fundCode、amount，构造 `BankPaymentOriginal`|明确 boundary adapter，保留完整 original 与顺序|
|invocationArgs 30|依次 investorAccountId、fundOrderId、fundCollectionAccountId、amount 构造 `BankPaymentArgs`|Saga args adapter；不注入 ActorRef|
|operationIdentity 31–38|ByteArrayOutputStream/DataOutputStream；按原 Vector 帧写非空 token 的 UTF-8 长度+字节；flush；返回 `"sha256:" + SHA-256(...).iterator.map(b => f"${b & 0xff}%02x").mkString`；token 含 `truthsrc-pipeline-invocation-v1`、bankwealth、两个 bank-cash-payment-v1、两个 bank-v1-1、pay-cash-purchase、operation/occurrence.value、iteration/absent、chunk/absent|永久身份保护面，所有 token、顺序、大小写、摘要前缀均不变；不归本族改写|
|terminalResults/classify 39–45|终态 Set 为 succeeded/rejected-before-effects/compensated；Succeeded→succeeded；Aborted 看是否有 Prepare Confirmed 决定 compensated/rejected；RecoveryRequired 看 Evidence.Uncertain 决定 outcome-unknown/recovery-required；其他 None|strict 结果分类，不能压缩到 successful:Boolean 而丢恢复态|
|validStatus 46–49|argsBytes 相等；identity 存在；对 args 计算 SHA-256；逐一核 transactionId、definitionName、definitionVersion=1、完整 definitionDigest、argsCodec.pin、argsDigest、既有 identity.forall 相等、Try(stateToProto).isSuccess|身份和 codec 防线保留；definitionDigest 原串在冻结全文 48 行，不能重算成另一合同|
|parent/completed 50–62|parent=execution.codec.decode(original.toByteArray)；completed 取 identity.get、originalInput(parent(state))；succeeded→Completed(Succeeded(TxId(identity.transactionId)))；rejected/compensated→对应 Completed；recovery/unknown→对应 Pending；其他 Conflict("unmapped result kind")|结果 adapter；上述 nominal TxId 不等 CommonTypes.Id；不要制造转换或 fake success|
|Delivery 63–69|五方法 succeeded/rejected_before_effects/compensated/recovery_required/outcome_unknown；每个依序 `(destination: FundOrderId,event: FundOrderProtocol.BankPaymentResult<对应结果>,identity: TransactionIdentity): Future[Boolean]`|外部 delivery 端口单列；protocol 拆分不删除这组完整接口|
|apply 70–80|入参 `(persistenceId:String, coordinator:ActorRef[StrictSagaCoordinator.Command], technical:bank_payment_hostTechnicalPorts.Installed)`→Behavior[Request]；Behaviors.setup；require 四者有效；implicit ec=context.executionContext；admissionPending=false；admissionReplies=Vector.empty；takeAdmissionReplies 捕获旧 Vector，再清空并 reset false，spawn 一次广播后 stopped 的 actor|应用/基础设施行为 owner，局部可变状态不得移到纯领域|
|observe 81–94|未 admitted：追加 replyTo；仅首次启动 admission、Try(HostIO.admit).getOrElse(Future.successful(false))；pipeToSelf 生成 Admitted(None 或拒绝字符串,operation)；return。已 admitted：spawn 一次 Strict reply adapter→self Observed；有 identity Attach，无 identity Start(operation,args,adapter)|不能因隐藏辅助命令而删 admission gate；权威回复来源严格保留|
|deliver 95–100|从 parent 取 original、identity.get；HostIO.deliver(kind,original,identity,technical):Future[Boolean]；pipeToSelf→Delivered(kind,value.getOrElse(false),replyTo)|只在完成真实交付确认后回复；失败不是空成功|
|EventSourcedBehavior/Invoke 101–109|PID=`ofUniqueId(persistenceId)`，State()；encode parent/input args/operation；既有且不同完整输入→none+Conflict；已交付终态→none+completed；既有操作→none+observe；否则 persist Associated 后 observe|这些是 durable host 行为，不是 classic 协议的可删除“样板”|
|Observed 110–115|无效 status→none+Conflict；否则 classify，终态已定则 next=None，否则过滤重复 result；identity 首见产生 IdentityObserved，加 next ResultIntent；persist 后按新 state 的 result/delivered 决定 deliver/completed/Pending|保持 persist→新 state 回调；不在 Protocol 中编码这些分支|
|Admitted/其他回复 116–122|匹配操作且尚未 admitted 的 None→persist AdmissionGranted 后 observe(takeAdmissionReplies)；Some(reason)→none+Pending；其他 Admitted→none；Denied→Pending；ConflictingIdentity→Conflict；Delivered(true)且 kind 相同→persist DeliveryAcknowledged 后 completed；其余 Delivered→Pending|拒绝不得转成功；不把所有非成功都称领域 rule failure；仍保留必要持久意图/进展|
|event fold 123–129|Associated copy original/args/operation；IdentityObserved copy Some(identity)；ResultIntent copy Some(kind),delivered=false；DeliveryAcknowledged copy delivered=true；AdmissionGranted copy admitted=true|只由 event application 变持久 state；不可合并有不同身份的 event|
|结束 130–131|闭合 setup 与 object|唯一 assembly owner 负责完整文件重组|

### 6.1 actual-js → approved-target 的统一 diff

**结构性对照，非同输入字节比较，也不是可直接应用到银行文件的 patch。** minus 是银行冻结 host 的 **L1–L20 原文协议前段**；plus 是 §4.4 完整 classic 示例。该 host 剩余 111 行已在上表保留并分责；不能因本 hunk 不含它们就删除。缺少语义映射 D1/D2 时不得执行迁移。

```diff
--- actual-js/app/example/bankwealth/application/bank_payment_hostHost.scala (L1-L20)
+++ approved-target/app/net/imadz/banking/application/services/transactor/MoneyTransferSagaTransactorProtocol.scala
@@ -1,20 +1,36 @@
-// @generated by truthsrc scala-cqrs-domain:1
-package example.bankwealth.application
+package net.imadz.banking.application.services.transactor
 
-import akka.actor.typed.{ActorRef, Behavior}
-import akka.actor.typed.scaladsl.Behaviors
-import akka.persistence.typed.PersistenceId
-import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
-import com.google.protobuf.ByteString
-import net.imadz.infra.saga.strict._
-import scala.concurrent.{ExecutionContext, Future}
+import akka.actor.typed.ActorRef
+
+import net.imadz.banking.domain.values.Money
+import net.imadz.common.CborSerializable
+import net.imadz.common.CommonTypes.Id
+import net.imadz.infra.saga.SagaTransactionCoordinator.TracingStep
+import net.imadz.infra.saga.SagaTransactionCoordinator.TransactionResult
 
-object bank_payment_hostHost {
-  sealed trait Request
-  final case class Invoke(state: bank_cash_payment_v1Execution.State, replyTo: ActorRef[Reply]) extends Request
-  private final case class Observed(reply: StrictSagaCoordinator.Reply, replyTo: ActorRef[Reply]) extends Request
-  private final case class Delivered(kind: String, ok: Boolean, replyTo: ActorRef[Reply]) extends Request
-  sealed trait Reply
-  final case class Pending(reason: String) extends Reply
-  final case class Conflict(reason: String) extends Reply
-  final case class Completed(result: bank_cash_payment_v1Execution.pay_cash_purchaseResult) extends Reply
+object MoneyTransferSagaTransactorProtocol {
+
+  // --- Commands ---
+  sealed trait MoneyTransferSagaCommand extends CborSerializable
+
+  case class InitiateMoneyTransferTransaction(
+    fromUserId: Id,
+    toUserId: Id,
+    amount: Money,
+    replyTo: ActorRef[MoneyTransferSagaConfirmation]
+  ) extends MoneyTransferSagaCommand
+
+  // 内部：接收 saga coordinator 的异步终态
+  case class UpdateMoneyTransferTransactionStatus(
+    id: String,
+    newStatus: TransactionResult,
+    replyTo: ActorRef[MoneyTransferSagaConfirmation]
+  ) extends MoneyTransferSagaCommand
+
+  // --- Replies ---
+  case class MoneyTransferSagaConfirmation(
+    transactionId: Id,
+    error: Option[String],
+    tracing: List[TracingStep] = Nil
+  ) extends CborSerializable
+}
```

可确立的差距是 protocol 独立性、Commands/Replies 分组、命名及 imports 模型；**不是“银行没有 replyTo”**。银行 Invoke/Observed/Delivered 已带 typed replyTo；也不能说 classic 的三字段 Confirmation 已保留 strict 的五结果、身份、交付确认、pending/recovery 语义。`HostHost`/下划线类名的表达整改不得连带重命名运行身份或 PB。

## 7. 胶水与真实接口边界

|完整符号/来源|本族所需合同与证据|限制|
|---|---|---|
|`akka.actor.typed.ActorRef[Reply]`|仅应用命令字段的静态通道；classic 此文件不发送消息；scaffold akkaVersion=2.6.20，见 [build.sbt:10–18](../baseline/bc/scaffold/build.sbt#L10-L18)|未检查消费 JAR API；不注入 domain params/events。|
|`net.imadz.common.CborSerializable`|[冻结 marker 全文](../baseline/common/src/main/scala/net/imadz/common/CborSerializable.scala#L1-L5) 是空 trait；command family/confirmation 继承|marker 不是 serializer 注册完成证据；不能扩大为所有 GeneratedMessage 接收。|
|`net.imadz.common.CommonTypes.Id` 与 `net.imadz.common.Id.of`|[CommonTypes:7–27](../baseline/common/src/main/scala/net/imadz/common/CommonTypes.scala#L7-L27)：Id 是 UUID alias；of 用 UUID.fromString，gen 用 randomUUID；此 Protocol 只用 alias，Behaviors 会 of(cmd.id)|银行 operationIdentity 的 sha256 字符串不能冒充 UUID；**不改 identity**，先解决适配/独立 profile 决策。|
|`net.imadz.infra.saga.SagaTransactionCoordinator.TransactionResult`|[人工参考 runtime:127–141](../baseline/curated-scala/net/imadz/infra/saga/SagaTransactionCoordinator.scala#L127-L141)：`(successful:Boolean,snapshot:StatusSnapshot,failReason:String="") extends CborSerializable`；snapshot 不是 engine State|这里只证明固定源码接口，不证明 BC 默认 saga-core:0.2 或 JS 冻结 0.3.0 JAR 含同一接口。|
|`net.imadz.infra.saga.SagaTransactionCoordinator.TracingStep`|[同文件:67–80](../baseline/curated-scala/net/imadz/infra/saga/SagaTransactionCoordinator.scala#L67-L80) 按序 stepNumber:Int、stepId:String、stepType:String、phase:String、participant:String、status:String、retries:Int、maxRetries:Int、timeoutInMillis:Long、retryWhenRecoveredOngoing:Boolean、circuitBreakerOpen:Boolean、error:Option[ErrorInfo]；Confirmation 的 List 元素类型|没有把 StepSpecSnapshot 转换成它的实现证据；不能造空 tracing 声称可观察性完成。|
|`SagaTransactionCoordinator.StartSaga`（邻接消费）|[同文件:31–38](../baseline/curated-scala/net/imadz/infra/saga/SagaTransactionCoordinator.scala#L31-L38)：transactionId/definitionName/definitionVersion/argsBytes；traceId=""、singleStep=false、replyTo=None、completionReply=None|Protocol 不调用它；Behaviors 负责 persist 意图→ask→状态命令。classic 与 `strict.StrictSagaCoordinator.Start/Attach` 不同 API。|
|`net.imadz.common.application.CommandHandlerReplyingBehavior.CommandHelper` / `runReplyingPolicy`|[common:16–44、71–75](../baseline/common/src/main/scala/net/imadz/common/application/CommandHandlerReplyingBehavior.scala#L16-L75)：`toParam(state,command)`、`createFailureReply(param)(error)`、`createSuccessReply(param)(state)`；失败 Effect.reply、不 persist；成功 persist.thenReply，在应用事件后的 state 上构建回执|此 classic TriggerProtocol/TriggerBehaviors 并不自动使用它；若引入聚合 policy adapter，Helper 归 application.aggregates.behaviors，而不是 transactor Protocol 或 domain。|
|`RunnablePolicyWithHelper.replyWithAndPublish`|[common:50–63](../baseline/common/src/main/scala/net/imadz/common/application/CommandHandlerReplyingBehavior.scala#L50-L63) 在 persist 后向 EventStream 发布，再 thenReply|**replyWith != replyWithAndPublish**；不可借迁移增加发布。|

BC scaffold 默认消费 [common-core/saga-core:0.2](../baseline/bc/scaffold/build.sbt#L127-L150)，另有显式 candidate JAR 替换支路；formal JS [requireApplicationArtifact:4–8](../baseline/js/generators/scala-cqrs-application/generate.mjs#L4-L8) 锁 `net.imadz:saga-core_2.13:0.3.0`、SHA `550fbd5cdb18a50d71a62f8f743d59f24ac1daa03f0aeb07c23c8355c2c0d862`，并由 [generate-cli:114–126](../baseline/js/lib/products/generate-cli.mjs#L114-L126) 读取本地 JAR 字节核 pin。本文没有读取/运行 JAR，也不授权 publishLocal、升级 runtime 或换 pin。

### 7.1 raw 未完成/代码槽不得掩盖

- Protocol M/T 本身没有 `???`、MANUAL、业务 body 字符串；不能为了“移植纯度”隐去共享代码的债务。
- TypeResolver 的 `resolveMetaRef = ???` 和 Any fallback 已在 B8 登记。
- `SagaTriggerBehaviorsModel.argsCtorExpr: String` 与 Builder 七种分支是明确源码槽；不能把它推广为整个 protocol `content` 字符串。
- 邻接 [SagaTriggerBehaviorsTemplate:66–108](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/SagaTriggerBehaviorsTemplate.scala#L66-L108)：先构造 Args、TransactionInitiated(System.currentTimeMillis)，persist 后 StartSaga；ask 失败造 `TransactionResult(successful=false, null, "start failed")`；状态处理对成功/失败都 persist Completed/Failed，thenReply 的 state 参数被 `_` 丢弃，tracing 固定 Nil。它没有因保留 raw 字节就自动符合本阶段的故障/未知态目标。
- **失败不 persist** 是领域 rule 拒绝分支合同，不应错误解释为 durable Saga 不能记 TransactionFailed/交付进度。ask 超时≠权威终态失败，是否替换该 raw fallback 是具体行为决策 D5，不能改成空成功。
- 没有可把未实现业务逻辑替换成 true、Right(empty)、Accepted(empty) 的许可；纯领域计算的 addExact/精度/名义值身份保持不动。

## 8. 第二阶段拟实施写集合、组装 owner 与迁移

以下均为**后续拟写**，本阶段没有写它们。所有 JS 相对路径以 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/` 为根。公共文件由集成者独占，本文不创建 registry/catalog/glue/assignment。

### 8.1 本族独立文件（全部 proposed）

|拟新建绝对路径|责任|
|---|---|
|`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-application/models/saga-trigger-protocol.mjs`|M1–M7、C1–C3 的结构模型；区分 pure 参数、transport reply contract、源映射；不存整个文件 content。|
|`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-application/builders/saga-trigger-protocol.mjs`|显式输入适配→类型/命名/包解析→有序命令/状态/确认→依赖；D1/D3 缺语义时返回具体诊断，不按名字猜银行确认。|
|`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-application/templates/saga-trigger-protocol.mjs`|T1–T9 的完整 rendering；没有 I/O、状态判定或 host 整体拼接。|
|`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-application/render-saga-trigger-protocol.mjs`|**独立 classic Protocol 文件唯一 assembly owner**；仅接 model/template/shared writer entry，确保每个物理 Protocol 一次组装。|

### 8.2 共享/调用方写面（仅由集成者或关联 owner 串行处理）

|已有路径|disposition 与精确边界|
|---|---|
|`generators/scala-cqrs-application/render-invocation-host.mjs`|adapt/split；direct Request/Reply 与应用内部命令有职责相近面，但不能移成 classic 相同 API，须先选 D2。|
|`generators/scala-cqrs-application/render-pipeline-invocation.mjs`|adapt/split；保留完整 parent input/strict 身份/状态/交付，Protocol 之外不得删。这个复合 host 的**唯一组装 owner 定为 Saga 集成者**，不是四个 trigger artifact 各自写一段。|
|`generators/scala-cqrs-application/render-host-io.mjs`|adapt；将 5–22 的后置字符串插入转成共享结构 model 的显式命令/state/behavior contribution；声明顺序与所有分支均须保留。|
|`generators/scala-cqrs-application/produce.mjs`、`generator.json`；`lib/products/generate-cli.mjs`|公共 registry/manifest owner 接线；classic producer 是否作为 formal 独立明确变体尚待 D2/D8。不能偷偷使银行仍跑旧 renderer 或使 legacy strict-scala 封禁失效。|
|`generators/scala-cqrs-application/render-invocation-execution.mjs`|调用方 owner 将 host Request/Reply imports 和 Invocation bridge 迁移；保留 Promise 完成/失败/Pending 20.millis 重试/PostStop 故障，见实际 [execution:31–65](../baseline/actual-js/app/example/bankwealth/application/bank_cash_payment_v1Execution.scala#L31-L65)。重命名源码不改 pipeline/step/PID/PB 常量。|
|`lib/scala-target/naming.mjs`、`lib/scala-target/model.mjs`、`lib/scala-target/profiles.mjs`|shared-layout-types owner；优先复用已读 [resolveName/resolveNameSet/resolveArtifactPath:77–118](../baseline/js/lib/scala-target/naming.mjs#L77-L118)，先对齐 BC 特有命名与三层布局，不复制 replaceAll。TypeRef/import 扩充由共享 owner 固定接口；本文未把 model.mjs 的能力当作已核实满足。|
|`src/core/generate.mjs` 及其 writer/mapping 合同|继续唯一终端写入；本族提供最终字节/依赖/source mappings，不直接写文件、不自建第二 ledger。公共 owner 处理 retirement/ownership；不得由本族手改 anchors。|
|`generators/scala-cqrs-saga-monarch-v1/*`、`generators/saga-dsl/*`、`generators/run-all.mjs`|not-wired-to-classic；不纳入本族直接改写，更不把 family pure 协议改成 Actor 命令；各自 owner 处理其他质量问题。|

### 8.3 文件/名义类型与回锚迁移边界

- classic 目标固定为 `<target>/app/<base path>/application/services/transactor/<Base>SagaTransactorProtocol.scala`。若 D6 批准多模块专用落点，另定义 `<target>/modules/glue/src/main/scala/<base path>/application/services/transactor/<Base>SagaTransactorProtocol.scala`，明确是 raw writer 例外，不能两边同时发。
- 银行相近协议的候选路径为 `<new-target>/app/example/bankwealth/application/services/transactor/BankPaymentSagaTransactorProtocol.scala`，**proposed，名称与 API 仍待 D2**；不是本文凭空定义了一份银行确认/Update 命令。旧 `bank_payment_hostHost.scala` 只有在每个成员映射、消费者、serializer/持久类型方案就绪后才可退役。
- 依赖顺序：shared-layout-types → 本族显式输入/回复合同 → Protocol → saga-trigger-behaviors/root 的 imports/构造点 → serializer/调用方/fixtures → writer 最终字节与回锚。saga-definition/context 与 runtime API pin 是并行前置，不由本族复制实现。
- 每个源命令、参数、status/confirmation 角色映射至新完整文件的最终行/列；合成 replyTo 没有作者 note 时不能伪造 @knowledge。原始构造没有字段锚，不代表可以冒用旧 offset。格式稳定后才计算 fingerprint 和 anchors。
- 旧→新文件/类型清单必须包含内部 Admitted/Observed/Delivered 和相应 actor 访问范围；保留旧 domain 转发壳并不算三层迁移完成。变动的 serializer manifest/class identity 不是排版白名单；没有批准兼容方案就停止迁移，不扩大绑定。

## 9. 具体未决项

|ID|需要作出的实际选择/缺口|阻断范围|
|---|---|---|
|D1 回复与命令家族来源|raw 忽略 `commandFamily.name`、`replyMetadata` 和每命令 replyToType；Examples 实际声明 TransactionResultConfirmation，却发 MoneyTransferSagaConfirmation。目标需裁定保留 classic 合成 API 并提供显式绑定，还是按 metadata 恢复声明 API。缺回复合同的非 Update 命令不能自动获得通用 Reply。|JS 输入模型、Actor 命令签名、现有消费者；文档不阻断保存。|
|D2 classic 与 strict 的并存/适配|bank host 的 Pending/Conflict/Completed、五结果分类、交付确认、sha256 操作身份不能无损直接映成 classic `(UUID,Option[String],List[TracingStep])`。要单独 classic profile，还是明确版本化 adapter/更丰富目标回复？未获选择。|银行切流及 producer 接线；不能删除 strict 行为。|
|D3 trigger/status 选择与多个命令|是否保留全字符串 replace、所有非 Update=trigger、仅首 Update、首 trigger 的 args 映射？Update 前缀可能是业务命令；参数同名 replyTo、N=0、多触发异构参数尚无明确 admission/dispatch 合同。|边界 fixture、Builder 规则；需要明确诊断或语义化角色，不能默默忽略。|
|D4 实际 runtime/classpath|BC common/saga 0.2、curated runtime、JS frozen strict 0.3.0 的实际 API 供给未验证；`Id`=UUID 与 strict TxId 的类型及取值不兼容，不得合并 nominal types 或改身份。|编译与接线，不允许本任务发布/升级 runtime。|
|D5 状态失败与 tracing|raw ask Failure 造 null snapshot 失败结果、回复 tracing=Nil；权威超时/未知态不得被推断成失败或成功。StepSpecSnapshot→TracingStep 映射与是否应保留丰富状态需 behaviors/runtime owner 定义。|行为验收与回复内容，不能标 body 已完成。|
|D6 物理路径与持久类型|classic 多模块原来落 app，是否显式迁 glue；银行内部命令/事件 State 拆文件的 private 访问域、serializer class/manifest 兼容如何保留？|布局迁移/退役，不允许只改包名后绕 serializer。|
|D7 字段 metadata/依赖|Parameter.optional/optionalWhen/noteId/description 被 raw 丢弃；嵌套泛型依赖只收外层；目标如何在不擅改 API 的前提下传递可选性与来源？imports 递归补全已是质量要求，输入语义变化须单独批准。|非简单参数 fixture 与回锚；不得以 Any 绕过。|
|D8 同输入 CLI fixture 入口|没有冻结的 JS classic 输入适配，也未证明 BC formal 文件适配能派生本 classic SagaTransactorMetadata。必须明确同一语义 fixture 的 BC registry/文件适配与 JS producer 变体；不能拿 strict/products 链替代 runCommon。|同输入生成与完整字节对账；当前仅结构性对照。|

## 10. 后续验收：范围、fixture、命令形状与副作用

**全部未运行。** CC 目标 ≤5，状态 `not-measured`；6–10 逐方法说明，>10 先重构或逐方法批准例外；普通嵌套目标≤2。不能用 String/Any dispatcher、删分支或平均值压低数字。纯声明 Protocol 不能替代 Builder/renderer/消费者的复杂度核查。

### 10.1 必需 fixture（全部 proposed，当前不创建）

固定目录建议 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/saga-trigger-protocol/`，只作测试适配资产，不建立第二业务真源。

1. `classic-single`：冻结 Examples 转账输入的完整 adapter；触发字段 fromUserId/toUserId/amount、状态 UpdateMoneyTransferTransactionStatus、固定顺序、Nil 默认及 D1 的明确回复选择；携带所需 Definition/Context/args/participants 依赖。
2. `status-fallback`：没有 Update；raw 必须产生 Update<Base>SagaStatus；目标按 D3 选择明确支持或诊断。
3. `commands-boundary`：0/1/2 个 trigger、多 Update、真正名为 Update 的业务命令、replyToType 缺失、readOnly、已有 replyTo 参数、大小写/关键字碰撞；不要只数文件。
4. `types-and-origin`：跨包 Id/Money、同名类型冲突、Option/List/嵌套泛型、参数 optional/noteId；记录 raw 漏导入/丢 metadata 与目标有限变更，不改 nominal、PB、serializer 身份。
5. `strict-bank-preservation`：只消费冻结银行输入/输出 lineage 的批准适配，不发明余额或基金交易结果；验证 Pending/Conflict/Completed、admission 和交付语义仍在指定所有者。没有输入时此 fixture 标缺失，不能以本例完成它。
6. `non-bank-classic`：独立的同语义非银行源，校验 generic layout/类型接口，不把新 family 的 Int 限定 TCC 自动视为 classic fixture。

完整对账集：每 Saga 一个 Protocol 及消费者闭包；分别保存 raw-scala、approved-target、actual-js 的**完整**文件、path/package/import/member 顺序/完整 RHS/body/default。只允许已列 imports/来源头/明确换行差异，不压平所有空白。两次同输入稳定，单字段变更仅影响合理闭包，作者查询能定位新最终字节。状态 `enabled/suppressed/missing/exercised` 分开记。

### 10.2 精确公开 CLI 形状（仅后续批准后使用）

以下路径是提议中的独占 fixture/output，不表示它们已经存在或已可生成本族。每个命令都只展示已在冻结源码证实的 flag；没有 `--artifact`、猜测 spec 名或 `--dry-run`。

**JS 先行产品计划**，在 D8 决定接入 application producer 且 fixture request/options 已获批准之后：

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/saga-trigger-protocol/classic-single/request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-application \
  --out /Users/zhongdj/Workspaces/mad-polaris/codegen-parity-scratch/saga-trigger-protocol/js-single \
  --options-json /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/saga-trigger-protocol/classic-single/options.json \
  --plan
```

[generate-cli:66–88](../baseline/js/lib/products/generate-cli.mjs#L66-L88) 会 capture request/options、内存 compile products、读 manifest；application 分支还会读本地 pinned runtime JAR。plan 不 apply、不写 graph/ledger/anchors；非 `--plan` 才调用 applyEntries，写所选闭包的 Scala/proto/build/config/测试输出、`truthsrc.ledger.json`、`anchors.json`。**当前 application producer 没有本 classic variant，命令并不能凭空产出它**；product/manifest 适配未定就保持阻断，不改现有 options 拼假合同。

**需要外置实现捕获/作者回锚时**才改走已存在的 project CLI，而不是给上述命令添加未支持参数：

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-project \
  --project /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/saga-trigger-protocol/classic-single/truthsrc.project.json \
  --out /Users/zhongdj/Workspaces/mad-polaris/codegen-parity-scratch/saga-trigger-protocol/js-project \
  --plan
```

[project/cli:159–224](../baseline/js/lib/project/cli.mjs#L159-L224)：captureProject 包含 validate/roundtrip/编译输入；有 implementations 时即使 plan 也核外置源码并调用 verifyImplementationSources（其验证器执行细节本次未追读，不视作无副作用沙箱）。plan 不创建 SQLite store；实际 apply 会写 target 的 `.truthsrc/{canonical,request,compiled,inputs}.json`、生成文件、ledger/anchors，并在**项目派生的 graph 路径（可能在 target 外）**更新 SQLite 图和回锚；不能仅因 out 是新目录宣称完全隔离。执行前要列具体 graph 路径和实现验证器的子进程/缓存写面。family 强制此入口并不证明它能接受 classic fixture。本阶段两种命令都不执行。

**BC 传统 CLI 形状**，在 D8 先确认最小 formal adapter 能产生非空 `application.sagas` 后，从 BC 仓库工作目录调用：

```bash
sbt \
  -Dcodegen.systemFile=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/saga-trigger-protocol/classic-single/bc-canonical.json \
  -Dcodegen.systemBindings=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/saga-trigger-protocol/classic-single/bc-bindings.json \
  -Dcodegen.targetDir=/Users/zhongdj/Workspaces/mad-polaris/codegen-parity-scratch/saga-trigger-protocol/bc-single \
  -Dcodegen.ledger=/Users/zhongdj/Workspaces/mad-polaris/codegen-parity-scratch/saga-trigger-protocol/bc-ledger.json \
  "runMain net.imadz.codegen.CodegenMain"
```

此形状来自 [CodegenMain:62–80、192–250](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L62-L80)；不能同时传 `codegen.system`，也不传 semanticProductsFile/sagaExecutionV3 来偷换链。**同输入 classic 文件适配仍缺失，不能承诺这个 fixture 已能通过；若必须 registry slot，先批准具名 fixture 入口，不能编造不存在的 system。** `codegen.concern/families` 的已知集合是 aggregates/projections，不把 Saga id 当作已有 artifact 过滤 flag。

BC 实跑会启动 sbt/JVM（可能解析/下载依赖并写仓库 target、sbt/Ivy/Coursier 缓存），做 harness，复制 scaffold，生成整个最小系统闭包，写显式 ledger、knowledge-release/formal-semantics 等产物；不是只写一个 Protocol 的 CLI。当前未运行，后续统一在批末、既定依赖供给和独占目录下安排，不默认运行银行、publishLocal 或服务。无已确认本族行为测试 CLI，因此不编造 `testOnly` 类名；由 behaviors/runtime owner 先提交真实 suite 和资源边界再执行。

### 10.3 必需行为/接口证据与停止点

- 检查 Actor 命令的 replyTo 是否确为声明的 confirmation 类型、只出现一次、位于正确参数尾；缺合同应阻断，不把 query/domain params/events 全改为 ActorRef。
- 本族不实现 CommandHelper；若依赖聚合 policy，必须实际覆盖 toParam、失败不 persist、成功 persist 后 thenReply 读取新 state、回复次数和没有意外 EventStream 发布。不能以本 Protocol 编译替代该证据。
- classic 状态 adapter：合法 UUID 与非法/strict 摘要身份、ask failure/unknown、status 真实性、tracing 实际来源；不以 `null`/Nil 或默认 false 消除未决项。
- 银行相关闭包：完整原输入冲突、Attach/Start 身份、Pending 重试、admission gate、交付确认再 completed、原 event/PID/PB/serializer 字节身份保持；不能仅测格式。
- 先生成/内容对账预算 5 分钟、批末局部编译/行为预算 15 分钟只是后续调度预算，不是性能测量或本次运行承诺。遇到 D1–D8 任一不满足、依赖 pin 漂移、未知额外写面就停止并返回已取得证据；本制品文档仍独立保存，不等其他制品解除阻断。

## 11. extraSources 与本次写入边界

本次没有读取任何未冻结的生产源码。为使规范输入也可追溯，以下未在 baseline 中的已读文档按当前内容 SHA 登记（scala-artifacts 只提取了本族一行，没有 dump 全目录）。没有复制或修改这些来源。

|绝对路径|SHA-256|
|---|---|
|`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/AGENTS.md`|`8bfd761390a6fc90b09663157f9d35b23c0c58b20c9f6a41dd5698450015d601`|
|`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/AUTHORING-CONTRACT.md`|`9c827000f1e864b6a86a04a855df4853a4457b854bd5b2f0bfff14b1ce9514a9`|
|`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/layout-and-style.md`|`bc8d0f3325a0f67a7c23ff4af6bc5f5b9c23b6caaf8aa12d1f93189c7a911d13`|
|`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/.rounds/prettify-generated-code-resume-20261115-cgr9lzlk/APPROVED-PLAN.md`|`1b4f806ff64088d0c1eb481b8ae423cd2059d74b45192795a6609204d51cfd0c`|
|`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/scala-artifacts.json`|`b778bb11e6c879bcb2adc3161e2583204df7faafa97a077d8f2c6039e091cb0d`|

仅本文件与 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/details/saga-trigger-protocol.json` 是本轮交付写面。`generatorsModified=false`、`runtimeExecuted=false`；没有 implemented、ready、parity-PASS 或全覆盖声明。
