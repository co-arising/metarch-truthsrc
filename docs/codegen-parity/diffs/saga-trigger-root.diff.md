# saga-trigger-root：经典 Saga 触发聚合的分片入口规格

## 1. 范围、状态与证据边界

- artifact id / group：`saga-trigger-root`；传统模板族序号 **20**。
- 内容状态：**`missing-counterpart`**。已定位并逐字段、逐规则、逐构造说明 Scala Root；当前检查的 JS formal、legacy、family 路线均不能作为该 Root 的等价实现。formal 有承担触发职责的复合 Host，不能说 JS 完全没有 Saga 触发能力。
- 以下为**源码内容检查**，不是生成、编译或运行验证。未产生新的同输入 Scala/JS 输出；未执行测试、typecheck、compile、generation、validate、roundtrip、服务或下载。复杂度为 `not-measured`，不是已达到 CC≤5。
- 固定 HEAD：JS `bf104e16ab82ef39d7fa416d0997907d18a815ad`；BC `cc335eb1e0d0fae17bf092fd61b126040196ea70`。实际字节以 [baseline/index.json](../baseline/index.json) 的 `snapshot / bytes / sha256` 为准，HEAD 不替代工作树字节。
- 本次只创建本文件与 `details/saga-trigger-root.json`。创建前两路径均不存在；没有覆盖已有 15 份 diff，没有改 baseline、生成器、生成应用、catalog、ledger、anchor、truth tree 或其他人的文档。
- 未读取 baseline 之外的当前生产源码，故 `extraSources = []`。仓库指引、作者合同、布局合同和批准计划是治理输入，不冒充生产源码证据。

### 1.1 调度、基数、路径及条件

[CodegenMain.run](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L183-L241) 的传统分支经 [runCommon](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L192-L220) 调用 application layer。[实际 Saga 循环](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L735-L771) 按以下顺序执行：所有 participants → definition → trigger protocol → trigger entity → **root** → behaviors。Root 在 L765–767 调用 `SagaTriggerBuilder.buildRoot`、`SagaTriggerRootTemplate.generate`、`writeArtifact`。

| 变体/条件 | 预计基数和输出 | 当前证据状态 |
|---|---|---|
| `classic-v3-context-explicit`：`app.sagas` 中一项，`meta.context = Some(c)` | 每项一个 `<target>/app/<base-path>/application/services/transactor/<meta.name>.scala`；context 由 `c.name` 解析 | Builder 分支已观察；未运行 |
| `classic-v3-context-fallback`：同上但 `meta.context = None` | 同一个 Root 路径；context 由 `meta.name` 解析 | 分支已观察；不证明对应 context 文件存在 |
| 无 Saga | 此族零文件 | 循环条件；未运行 |
| scope 不包含此 attribution | 模型/源码仍先构建，writer 登记后跳过写入 | suppressed 条件；未运行 |
| 上游 definition/entity 构建失败 | 不保证到达 Root；特别是 entity 的 `args=None` 会抛异常 | 不能以 `buildRoot` 自身不读 args 推断整个链可发射 |
| multi-project | 本 kind **未列入** `targetModuleOf`，走 `None` 兜底，仍是 `<target>/app/<base-path>/application/services/transactor/<meta.name>.scala` | 不擅写成 `modules/glue/...`；见 [L331–378](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L331-L378) |

Root 的 attribution 精确为 `ArtifactAttribution("saga-trigger-root", rootModel.selfType.name, "saga", List(meta.name))`。这是一个逻辑族，不是四个 trigger 文件总称。`semanticProductsFile → generateProducts`、strict module、InvocationHost、Monarch workflow application-root 都不是本次经典 Root 调度的替代路径。

`base` 的实际来源也不能猜：`GeneratorContext.fromSystemMetadata` 使用 `rootPackage="net.imadz"`、`moduleName=system.contextName.getOrElse("codegen")`，`basePackage = s"$rootPackage.$moduleName"`，参见 [L35–68](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L35-L68) 和 [L279–302](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L279-L302)。`Examples.bankingSystem` 的 context 是 `banking`，并不等于人工参考的 `net.imadz`。

### 1.2 固定全文与指纹

下列链接均指向本地固定全文，不是可变生产副本。MBT 全文件已经实际阅读；共享文件按相关区段阅读。

| 证据 | bytes | SHA-256 |
|---|---:|---|
| [M：SagaTriggerModels.scala 全文][M] | 2982 | `c7331985fb13f32e0f8104fed9110893703eece551f03c7da031796a073db2f1` |
| [B：SagaTriggerBuilder.scala 全文][B] | 8368 | `43876918912c7a5c97e18a647821f1467c74f6ee0ed058906de4d76a25cfa664` |
| [T：SagaTriggerRootTemplate.scala 全文][T] | 1367 | `f7d001fbe47ffbb3ba0e59c92f1e5341e4fbdfa558a98b9ac682779e56f1ad84` |
| [formal：renderInvocationHosts 全文][J-direct] | 12868 | `72fb4b6e3e350f00c1b84d47e3f863b56572f91eae49a314c2487a96e28d808d` |
| [formal：renderPipelineInvocation 全文][J-pipeline] | 13592 | `772e29795c4513b530272d6642776042ab785a741e5b1b4be02a6aac541943ed` |
| [formal：wireHostIO 所在全文][J-io] | 9135 | `ce7faee427ab7ebaafd26ef3b58334cd07e0c24709aa108743d1b061dc7177b7` |
| [actual-js：bank_payment_hostHost.scala 全文][BANK] | 11966 | `e74f76532abdadc384d4fda34cad3d8896d34898c5996b3e3fa85758afa986c4` |
| [family：build-models.mjs 全文][F-model] | 40309 | `d7a1e9fbe50bdfb8f1fb2f955f7c0144be68eb24a8a94127c54032df031c0bee` |
| [family：root.mjs 全文][F-root] | 8053 | `cc77ac08349b8c26e7aa9a7590cc0488c91948fd8f311dd8c57e86017fe1ef81` |
| [curated：MoneyTransferContext.scala][C-context] | 209 | `5c1e41741bf0110a1c1b871f41479fbbe0b6c7467acbfa35d365073e63f0f124` |
| [curated：MoneyTransferSagaTransactorBootstrap.scala][C-bootstrap] | 527 | `8d7594cbecd9a13f22488ce03bdd62920c60abd272f4fa77e845388129b7d771` |

本次对 MBT、两份 formal renderer、bank Host、family root、两份 curated 小文件做了只读 bytes/SHA 对照，与 index 相符。这只确定源码身份，不是业务验证结果。

## 2. Scala Model：逐字段、默认值、依赖和继承

### 2.1 本族完整 Model

原文 [M L40–50](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/transactor/SagaTriggerModels.scala#L40-L50)。本 case class 无泛型、无辅助构造器、无自定义 companion、无 body-string 字段、无 MANUAL 槽。

```scala
/** Root：entityTypeKey + tags + apply（把 coordinator / context 透传给 Behaviors）。 */
case class SagaTriggerRootModel(
    override val selfType: TypeRef,
    entityName: String, // 分片键名（如 "MoneyTransferTransaction"）
    tagPrefix: String,
    commandType: TypeRef,
    coordinatorType: TypeRef,
    contextType: TypeRef,
    behaviorsType: TypeRef,
    dependencies: Set[TypeRef]
) extends ArtifactModel
```

| 顺序 | 字段/类型 | 默认值 | Builder 来源 → Template 消费 | JS 当前情况 |
|---:|---|---|---|---|
| 1 | `override val selfType: TypeRef` | 无 | `TypeRef(meta.name,pkg)` → package、object、writer 文件名；协议 import 用 `selfType.name + "Protocol"` | formal 直接拼 `stem+'Host'`，没有独立 Root selfType |
| 2 | `entityName: String` | 无 | `baseName + "Transaction"` → `EntityTypeKey` 字面量 | bank Host 使用传入的 persistenceId，无此 sharding key |
| 3 | `tagPrefix: String` | 无 | `baseName.toLowerCase` → `Vector.tabulate(1)` 的前缀 | bank Host 无此 tags |
| 4 | `commandType: TypeRef` | 无 | `baseName + "SagaCommand"`，同 pkg → 两处 `.name` | formal 为复合对象内 `Request`，不是此类型 |
| 5 | `coordinatorType: TypeRef` | 无 | `resolve(CustomType("SagaTransactionCoordinator", coordinatorPkg))` → `.signature + ".Command"` | formal 为 `ActorRef[StrictSagaCoordinator.Command]`，协议/寻址均不同 |
| 6 | `contextType: TypeRef` | 无 | `meta.context.map(...).getOrElse(...)` → `ctx` 参数 `.signature` | formal 后处理改为 `TechnicalPorts.Installed`，不能结构同名替换 |
| 7 | `behaviorsType: TypeRef` | 无 | 独立 behaviors 子包 → 只用 `.name` 发射单次 `.apply` 调用 | formal 把行为体直接放 Host；family root 装配 workflow，不是此行为委托 |
| 8 | `dependencies: Set[TypeRef]` | 无 | protocol/behaviors/context 三项经 `shouldImport(pkg)` 过滤 → FQN 排序 import | formal entry 的 `deps` 是输出路径；不能冒充 Scala TypeRef 依赖集 |

依赖类型的实际定义见 [TypeSystem.scala L4–52](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4-L52)：`TypeRef(name:String, packageName:String, typeParams:Seq[TypeRef]=Nil)`；`fqn` 在空包时返回 name，否则连接包名；`signature` 对带参数 Tuple 输出 `(T1, T2)`，其他泛型输出 `Name[T1, T2]`，无参数输出 name。`collectAllDependencies` 递归收集自身和参数；**本 Root Builder 没有调用它**。`shouldImport` 排除空包、当前包、`scala`、`java.lang`。

继承 [ArtifactModel 全文](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L5-L47)：

- `fqn = selfType.packageName + "." + selfType.name`，与 TypeRef 的空包特判不同。
- `registerTo(registry) = registry.register(this)`，不注册 sibling trigger models。
- `morphisms: Seq[net.imadz.meta.MappingMorphism] = Nil`。
- `noteIds: Seq[String] = Nil`。
- Root 不覆盖以上默认值；没有自产 note/field anchor，不得伪造知识来源。writer attribution 不是新增作者字段。

### 2.2 同一 Model 文件的其他类型：读取边界与全部字段

它们不是 Root 的嵌套类型，也不是 Root 的输出成员。列出是为了准确区分共享文件的所有权，不在本包实现它们。

| 类型/源行 | 字段按原序（均无构造默认值） | 与本族关系 |
|---|---|---|
| `SagaTriggerProtocolModel` L15–23 | `selfType:TypeRef`, `triggerCommands:Seq[SagaTriggerCommandModel]`, `confirmationType:TypeRef`, `statusCommandType:TypeRef`, `transactionResultType:TypeRef`, `tracingStepType:TypeRef`, `dependencies:Set[TypeRef]` | 同为 ArtifactModel；拥有应用命令和回复 |
| `SagaTriggerCommandModel` L25–29 | `name:String`, `params:Seq[FieldDef]`, `handlerArgs:Seq[String]` | 非 ArtifactModel；params 不含 replyTo，handlerArgs 包含 replyTo |
| `SagaTriggerEntityModel` L32–38 | `selfType:TypeRef`, `stateType:TypeRef`, `argsFields:Seq[FieldDef]`, `statusType:TypeRef`, `dependencies:Set[TypeRef]` | 同为 ArtifactModel；拥有纯状态/事件 |
| `SagaTriggerBehaviorsModel` L53–71 | `selfType:TypeRef`, `entityName:String`, `stateType:TypeRef`, `eventType:TypeRef`, `commandType:TypeRef`, `definitionType:TypeRef`, `argsType:TypeRef`, `argsFields:Seq[FieldDef]`, `triggerCommands:Seq[SagaTriggerCommandModel]`, **`argsCtorExpr:String`**, `confirmationType:TypeRef`, `statusCommandType:TypeRef`, `coordinatorType:TypeRef`, `contextType:TypeRef`, `transactionResultType:TypeRef`, `dependencies:Set[TypeRef]` | `argsCtorExpr` 是真实源码表达式槽，不把全家族说成无 code-string |

`FieldDef` 的 defaults 为 `defaultValue=None, comment=None, noteId=None, description=""`，其前两字段为 `name:String,typeRef:TypeRef`，见 [L75–85](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L75-L85)。Root 自身不含 FieldDef。共享模型注释宣称 admin 直通等职责，不等于 Root 实现了这些职责。

## 3. Scala Builder：完整 buildRoot 与规则账

原文 [B L19、L72–92](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/transactor/SagaTriggerBuilder.scala#L72-L92)。依赖 `GeneratorContext`、`TypeRef`、`SagaTransactorMetadata`，无 I/O。

```scala
private val coordinatorPkg = "net.imadz.infra.saga"

def buildRoot(meta: SagaTransactorMetadata, ctx: GeneratorContext): SagaTriggerRootModel = {
  val pkg = ctx.layout.application.services.transactor.root
  val baseName = meta.name.replace("SagaTransactor", "")
  val protocolType = TypeRef(s"${baseName}SagaTransactorProtocol", pkg)
  val behaviorsType = TypeRef(s"${baseName}SagaTransactorBehaviors", ctx.layout.application.services.transactor.behaviors)
  val contextType = meta.context
    .map(c => ctx.typeResolver.sagaContext(c.name))
    .getOrElse(ctx.typeResolver.sagaContext(meta.name))
  val deps = Set(protocolType, behaviorsType, contextType).filter(_.shouldImport(pkg))

  SagaTriggerRootModel(
    selfType = TypeRef(meta.name, pkg),
    entityName = s"${baseName}Transaction",
    tagPrefix = baseName.toLowerCase,
    commandType = TypeRef(s"${baseName}SagaCommand", pkg),
    coordinatorType = ctx.typeResolver.resolve(CustomType("SagaTransactionCoordinator", coordinatorPkg)),
    contextType = contextType,
    behaviorsType = behaviorsType,
    dependencies = deps
  )
}
```

| 稳定规则 ID | 精确规则/分支/RHS | 保真要求及差距 |
|---|---|---|
| B01 | `pkg = ctx.layout.application.services.transactor.root` | [PackageLayout L54–65](../baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala#L54-L65) 为 `<base>.application.services.transactor`；behaviors 为其 `.behaviors` 子包，符合三层标准 |
| B02 | `meta.name.replace("SagaTransactor", "")` | 是替换**全部出现**，不是 `stripSuffix`；大小写敏感。非标准名称可能造成 selfType/protocol 引用不一致，列 D3，不静默改原始基准 |
| B03 | protocol 和 behaviors 名称均基于 B02；selfType 保留 meta.name | Template 的协议 import 却从 selfType 拼接，输入名称必须与整个家族一致 |
| B04 | `Some(context)` 用 `c.name`；`None` 用 `meta.name` | [sagaContext(String) L682–685](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L682-L685) 调 `getSagaContextName(getBaseName(name))` 后放同一 root 包；不是任意 context 的外部 FQN/fields 透传 |
| B05 | `getBaseName` 按固定 suffix 列表顺序逐次移除，若移除成空串则返回上个非空值；`getSagaContextName` 去末尾 SagaTransactor 再加 Context | [NamingConventions L187–240](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L187-L240)。不能把它和 B02 的全串 replace 混为同一个算法 |
| B06 | deps 只有 protocol、behaviors、context，并过滤 shouldImport | 正常布局下 protocol/context 同包被移除，留下 behaviors。framework import 不在 deps 中；commandType/coordinatorType 没有加入该 Set。ledger deps 也受此不完整集合影响 |
| B07 | `entityName = baseName + "Transaction"`; `tagPrefix = baseName.toLowerCase` | 不从 runtime definition id、bank host id、PID 反向推断。lowercase 未显式给 locale；新 resolver 不得藉此改变已冻结 tag/key 字面量 |
| B08 | coordinator 走 CustomType resolver | [TypeResolver L66–79](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala#L66-L79) 先查 knownFrameworkTypes 并递归解析参数，否则保留/修正包。此符号在 [GeneratorContext L151–154](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L151-L154) 明确映射到 `net.imadz.infra.saga.SagaTransactionCoordinator` |
| B09 | named args 按 Model 八字段顺序构造返回值 | 不验证重复 Root 文件名、ctx 实例存在、args 完整性或 runtime jar；不在此创建 actor 或注册 definition |

输入 [SagaTransactorMetadata L485–500](../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L485-L500) 的全字段为 `name, commandFamily, triggerCommandName, participants, steps, replyMetadata=None, version=1, args=None, context=None`。Root 只消费 `name/context.name`，其他字段由 sibling Builder 消费；不得在 JS Root 移植时偷偷以 `triggerCommandName` 代替 command family 扫描或引入业务结果默认值。

### 3.1 同一 Builder 文件其余规则，不并入 Root

| 方法/行 | 已观察的全部关键分支和推导 |
|---|---|
| `buildProtocol` L21–49 | root 包；同样全串 replace；取所有 command names 排除 `startsWith("Update")`，再按原 commands 顺序选中；每个参数经 resolver 构造 FieldDef；handlerArgs 为参数名顺序再追加 `replyTo`；confirmation 为 `<baseName>SagaConfirmation`；status 选首个 Update 名或 `Update<baseName>SagaStatus`。deps 为参数类型集合加 TransactionResult/TracingStep/ActorRef/CborSerializable 后 shouldImport；没有在这里递归展开参数泛型。返回七字段，TransactionResult/TracingStep 通过 knownFrameworkTypes 解析 nested owner。 |
| `buildEntity` L51–70 | domain.entities 包；args 缺失抛 `RuntimeException("Saga '<name>' lacks args (v3)")`；args.fields 原序 resolve 为 FieldDef；state `<baseName>TransactionState`、status `<baseName>Status`、self `<baseName>TransactionEntity`；deps=args 类型+CborSerializable+Id，经 shouldImport。 |
| `argsCtorExpr` L94–112 | 仅首个 trigger；无首项时参数表为空；首个类型名为 Money 的参数作为拆分候选。按 argsFields 原序：同名 Money 且字段 amount→`.amount`；同名 Money 且 currency→`.currency.getCurrencyCode`；目标 String/参数 Id→`.toString`；其他同名→字段名；无同名但 amount/currency 且存在 Money→对应拆分；否则仍输出字段名。最后 `mkString(", ")`。这是源码字符串债务，不保证最后的字段名已绑定。 |
| `buildBehaviors` L114–157 | behaviors/root 两包；args 缺失同样抛异常；调用 buildProtocol/buildEntity；context 同 B04；definition `<baseName>SagaDefinition`；argsType 使用 argsMeta.name；deps=protocol owner、entity owner、state、definition、confirmation、context、transactionResult、EntityRef、ActorRef，加 trigger 参数类型再 shouldImport。按 Model 顺序赋值，argsCtorExpr 使用上述首命令算法。Root 无权把这些字符串规则替换成通用成功。 |

## 4. Template：完整源码及输出 construct/RHS 账

完整原文 [T L1–36][T]，下列代码保持模板自身的静态 import、依赖排序和字符串插值。`CodeTemplate[M <: ArtifactModel]` 只要求 `generate(model:M):String`，见 [CodeTemplate.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/CodeTemplate.scala#L1-L7)。

```scala
package net.imadz.codegen.scaffolding.cqrs.template.application.transactor

import net.imadz.codegen.scaffolding.cqrs.model.application.transactor.SagaTriggerRootModel
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

/** saga_v3 触发聚合 Root 模板（**B·§13**）——分片键 + tags + apply 工厂。
  * golden 参考：playAkkaCQRS `FabSagaTransactor`。 */
object SagaTriggerRootTemplate extends CodeTemplate[SagaTriggerRootModel] {
  def generate(model: SagaTriggerRootModel): String = {
    import model._
    val imports = dependencies.map(_.fqn).toSeq.distinct.sorted.map(i => s"import $i").mkString("\n")
    val behaviorsSimple = behaviorsType.name

    s"""package ${selfType.packageName}

import akka.actor.typed.Behavior
import akka.cluster.sharding.typed.scaladsl.{EntityRef, EntityTypeKey}
import net.imadz.infra.saga.SagaTransactionCoordinator
import ${selfType.packageName}.${selfType.name}Protocol._
$imports

object ${selfType.name} {

  val entityTypeKey: EntityTypeKey[${commandType.name}] = EntityTypeKey("$entityName")
  val tags: Vector[String] = Vector.tabulate(1)(i => s"$tagPrefix-$$i")

  def apply(
    id: String,
    coordinator: EntityRef[${coordinatorType.signature}.Command],
    ctx: ${contextType.signature}
  ): Behavior[${commandType.name}] =
    $behaviorsSimple.apply(id, coordinator, ctx)
}
"""
  }
}
```

| construct ID / 输出顺序 | 原始 Scala 输出与完整 RHS/body | actual-js / 目标处置 |
|---|---|---|
| T00 生成准备 L10–12 | `import model._` 只作用于生成器；imports 对 dependencies 的 `.fqn` 去重、升序、逐个加 `import `、换行连接；behaviorsSimple 为 `.name` | JS 需结构依赖；不能把输出整文件存到 model.content |
| T01 package L14 | `package selfType.packageName`，之后一个空行 | bank 为 `.application`；Root 目标为 `.application.services.transactor` |
| T02 imports L16–20 | 固定顺序：`akka.actor.typed.Behavior`；`akka.cluster.sharding.typed.scaladsl.{EntityRef, EntityTypeKey}`；`net.imadz.infra.saga.SagaTransactionCoordinator`；`<self package>.<self name>Protocol._`；随后 T00 排序结果 | 不全局重排成另一套风格；固定项与动态项之间不做交叉去重。deps 为空时仍留插值位置的空行 |
| T03 顶层对象 L22 | `object selfType.name {` 后空行；public、非 final、无 extends/父实参/泛型/注解/self-type/构造器 | formal 复合 Host 与 family class+companion 均不相同 |
| T04 key L24 | `val entityTypeKey: EntityTypeKey[commandType.name] = EntityTypeKey("entityName")` | public eager val；运行时对象初始化求值；不是 PID，不得替换成 bank operation digest |
| T05 tags L25 | `val tags: Vector[String] = Vector.tabulate(1)(i => s"tagPrefix-$i")` | public eager val；严格一个元素 `tagPrefix-0`；外层 `$$i` 保留到输出成为 `$i`。不能改为五分片、hash 分片或直接宣称 journal 已打 tag |
| T06 factory L27–32 | 唯一非重载 public `def apply(id:String, coordinator:EntityRef[Coordinator.Command], ctx:Context):Behavior[Command] = BehaviorsName.apply(id, coordinator, ctx)`；一个普通参数组、无 implicit/default/type bounds | 参数顺序、引用身份和单次委托保留；Root 不复制事件处理或 I/O。formal 是 `ActorRef[StrictSagaCoordinator.Command]`，不可通过 import/alias 改造成此接口 |
| T07 结束 L33–34 | object 结束、结尾换行 | fingerprint/source mapping 在最终字节固定之后处理 |

本模板没有 type alias、trait、case class、嵌套 companion、`lazy/implicit/var`、handler match、异常捕获、构造默认值、MANUAL 或 `???`。这些“未输出”限定于已读完整 Root 模板，不扩展为整个 Scala 链的质量结论。唯一循环是 import 集合，以及输出代码中的 `Vector.tabulate(1)`；前者完整规则已列，后者参数和 RHS 已列。

### 4.1 writer 后处理不等于模板正文

[writeArtifact L366–415](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L366-L415) 依序求 package path/module prefix；把 Model.dependencies 经 symbol table 解析、排序后记 ledger；记录 noteIds/morphisms；scope 不匹配则返回；strict anchorRoot 存在且有 saga key 时 preflight；最后 `fingerprintHeader + content` 经 `writeTerritorial`。Root 没有在 Template 内发 `@generated`、`@knowledge` 或 hash。JS formal 的 [entry L25–31](../baseline/js/generators/scala-cqrs-domain/naming.mjs#L25-L31) 则添加固定 `// @generated by truthsrc scala-cqrs-domain:1`，并按最终 header 偏移 byte span。这两种来源头必须单独对账，不能与 T01–T07 混签。

## 5. raw-scala、approved-target、actual-js、curated 四栏分账

### 5.1 raw-scala：由固定源码静态展开的完整正文，不是新生成文件

固定 [Examples L208–287](../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L208-L287) 给出 `MoneyTransferSagaTransactor`、`context=Some(MoneyTransferContext)`；[Examples L364](../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L364) 的 context 为 banking。按前述 Model/Builder/Template 展开正文如下。没有执行生成器，没有补 fingerprint，没有把该展示冒充可取得的新 raw output artifact。

```scala
package net.imadz.banking.application.services.transactor

import akka.actor.typed.Behavior
import akka.cluster.sharding.typed.scaladsl.{EntityRef, EntityTypeKey}
import net.imadz.infra.saga.SagaTransactionCoordinator
import net.imadz.banking.application.services.transactor.MoneyTransferSagaTransactorProtocol._
import net.imadz.banking.application.services.transactor.behaviors.MoneyTransferSagaTransactorBehaviors

object MoneyTransferSagaTransactor {

  val entityTypeKey: EntityTypeKey[MoneyTransferSagaCommand] = EntityTypeKey("MoneyTransferTransaction")
  val tags: Vector[String] = Vector.tabulate(1)(i => s"moneytransfer-$i")

  def apply(
    id: String,
    coordinator: EntityRef[SagaTransactionCoordinator.Command],
    ctx: MoneyTransferContext
  ): Behavior[MoneyTransferSagaCommand] =
    MoneyTransferSagaTransactorBehaviors.apply(id, coordinator, ctx)
}
```

### 5.2 approved-target

对上述规范命名的 **经典输入**，Root 正文目标就是 §5.1：三层、正确 transactor 子包、两个 eager val、一个委托方法已经满足本族的结构要求。`raw-scala → approved-target` 的本例正文差异为 **零项**，不是实际字节比较的零差异结论。以下不得伪装为已批准变化：

1. 不把 `EntityRef[SagaTransactionCoordinator.Command]` 改为 strict ActorRef；不同 runtime 的选择为 D1/D2。
2. 不删除 `ctx`，即使现 behaviors 没使用它；删除会改公开 factory 合同。
3. 不改 `MoneyTransferTransaction`、`moneytransfer-0`、Behavior 的命令名或 persistence ID 规则。
4. 不把所有 key/tag 重新按 PascalCase 类型名计算。源码名整改与稳定身份是两套数据。
5. 不强制此 Root 进入 `application.aggregates`：经典模板明确是 `application.services.transactor`。普通聚合 CommandHelper 仍在 `application.aggregates.behaviors`。

非标准 meta.name、shared import 完整性、多模块 placement、strict bank adapter 是否另立变体仍有待裁定；本文件未填造一个“统一 Root”来掩盖差异。

### 5.3 actual-js：银行复合 Host，不是 §5.1 的同输入对照

完整 [bank_payment_hostHost.scala][BANK] 是现存固定输出。它使用 strict coordinator，父运行状态来自另一个完整文件 [bank_cash_payment_v1Execution.scala](../baseline/actual-js/app/example/bankwealth/application/bank_cash_payment_v1Execution.scala#L1-L67)，后者使用 PersistentMonarch，不是经典 trigger Root。

以下是真实减项/加项及上下文：只展示**已批准命名/包布局方向的局部结构投影**。这是“结构性对照，非同输入字节比较”，不是可应用补丁；该复合文件还必须按下一表分拆，不能只移动整个混合对象便宣称达标。`BankPaymentHost` 是源码名投影，不重命名 `bank-payment-host` 或 `bank-cash-payment-v1` 身份。

```diff
--- actual-js/app/example/bankwealth/application/bank_payment_hostHost.scala
+++ approved-target-structure/app/example/bankwealth/application/services/transactor/BankPaymentHost.scala
@@ -1,15 +1,15 @@
 // @generated by truthsrc scala-cqrs-domain:1
-package example.bankwealth.application
+package example.bankwealth.application.services.transactor
 
 import akka.actor.typed.{ActorRef, Behavior}
 import akka.actor.typed.scaladsl.Behaviors
 import akka.persistence.typed.PersistenceId
 import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
 import com.google.protobuf.ByteString
 import net.imadz.infra.saga.strict._
 import scala.concurrent.{ExecutionContext, Future}
 
-object bank_payment_hostHost {
+object BankPaymentHost {
   sealed trait Request
   final case class Invoke(state: bank_cash_payment_v1Execution.State, replyTo: ActorRef[Reply]) extends Request
   private final case class Observed(reply: StrictSagaCoordinator.Reply, replyTo: ActorRef[Reply]) extends Request
```

上面的 plus 故意没有假装已经完成依赖 import、协议拆分或生命周期迁移。经典 Root 的最终完整正文单独见 §5.1；不能用局部改名 diff 代替它。

#### 银行复合文件逐 construct/RHS 保存与归属账

以下逐段覆盖固定文件 L1–132。`split/adapt` 是后续设计处分，不是删除授权；所有稳定身份和已存在业务分支必须在严格 Host 自己的内容规格中保留。

| 源区段 / 成员 | 完整内容规则、关键 RHS/副作用顺序 | 与经典 Root 的对比及后续所有者 |
|---|---|---|
| L1–12 header/package/import/object | 固定来源头；package `example.bankwealth.application`；Akka typed、Behaviors、PersistenceId、Effect/EventSourcedBehavior、ByteString、strict 通配、ExecutionContext/Future，按原序；对象 `bank_payment_hostHost` | Root 只需 T02 imports；其余 import 随所属构造拆分。由 `saga-family-integrator` 负责复合文件，不能由本 Root 包删掉 |
| L13–20 Requests/Replies | Request；Invoke(parent State,replyTo)；private Observed(strict Reply,replyTo)、Delivered(kind,ok,replyTo)；Reply；Pending(reason)、Conflict(reason)、Completed(parent result) | application Actor 协议；typed replyTo 已存在，不能说 formal 无回复通道；不是经典 `<Base>SagaCommand` |
| L21–28 Events/State/admin callback | Associated(original,args,operation)、IdentityObserved(identity)、ResultIntent(kind)、DeliveryAcknowledged(kind)、AdmissionGranted；private Admitted(denial:Option[String],operation) 属 Request。State 原序 defaults：ByteString.EMPTY、ByteString.EMPTY、`""`、None、None、false、false | 不将包含 strict/wire 类型的整块硬挪进纯 domain；协议/持久化桥接须由 sibling owner 裁定。纯 domain params/events 不得注入 ActorRef |
| L29–30 input/args | `BankPaymentOriginal(operation,fundOrderId,investorAccountId,fundCollectionAccountId,fundCode,amount)`；`BankPaymentArgs(investorAccountId,fundOrderId,fundCollectionAccountId,amount)`，取自 parent.state.inputs | 有严格参数顺序和 nominal types，不能改为 generic Map；Root 无这些业务构造 |
| L31–38 operationIdentity | ByteArrayOutputStream → DataOutputStream；parts 为 `truthsrc-pipeline-invocation-v1, bankwealth, bank-cash-payment-v1, bank-v1-1, bank-cash-payment-v1, bank-v1-1, pay-cash-purchase, operation.value, occurrence.value, iteration, absent, chunk, absent`；逐 token require 非空、UTF-8、写长度再写 bytes、flush；SHA-256、两位十六进制、前缀 `sha256:` | 稳定身份保护面；不是 Root.entityTypeKey，不得迁成 `${baseName}Transaction` |
| L39–45 terminalResults/classify | terminal 集合 succeeded/rejected-before-effects/compensated。Succeeded→Some(succeeded)；Aborted 根据是否有 Prepare Confirmed 区分 compensated/rejected-before-effects；RecoveryRequired 根据 Evidence.Uncertain 区分 outcome-unknown/recovery-required；其他 None | strict runtime adapter/behavior；不得折叠失败/未知到成功 |
| L46–49 validStatus | argsBytes 必须相同；identity 存在；对 args bytes 算无前缀 SHA hex；transactionId、definitionName、version=1、固定 definitionDigest、argsCodec.pin、argsDigest 全相等；已知 identity 必须相同；`Try(StrictSagaProtoConverters.stateToProto(status)).isSuccess` | 有八类联合约束，不能在清理 Root 时省略，也不能把 classic TransactionResult 当 strict status |
| L50–62 parent/completed | parent=execution.codec.decode(original.toByteArray)；先 identity.get，再解 original；kind match：succeeded→Completed(Succeeded(TxId(identity.transactionId)))；rejected-before-effects→Rejected；compensated→Compensated；recovery-required/outcome-unknown→Pending(kind)；其他 Conflict(unmapped result kind) | 补偿/恢复语义保留；Root 不制造结果 |
| L63–69 Delivery | 五个方法按 succeeded、rejected_before_effects、compensated、recovery_required、outcome_unknown 顺序；各参数 `destination:FundOrderId, event:FundOrderProtocol.<对应 BankPaymentResult...>, identity:TransactionIdentity`，返回 Future[Boolean] | port 独立归属，不能变成 root.ctx 的同义名；方法的真实调用由 HostIO 承担 |
| L70–80 apply/opening/admission buffer | `apply(persistenceId:String, coordinator:ActorRef[StrictSagaCoordinator.Command], technical:bank_payment_hostTechnicalPorts.Installed):Behavior[Request]`；Behaviors.setup；require 三依赖有效；implicit ec=context.executionContext；`admissionPending=false`、`admissionReplies=Vector.empty`；takeAdmissionReplies 先捕获旧列表、清空并复位、spawn 一次接收 reply 后 fanout 并 stopped 的 actor | 与 T06 的完整差异：不是 EntityRef、不是 ctx；方法体不是单次 delegation，而是行为所有权。应拆行为，不能直接贴入经典 Root |
| L81–94 observe | 未 admitted：累积 replyTo；只在无 pending 时调用 `Try(HostIO.admit).getOrElse(Future.successful(false))`；pipeToSelf 将异常/false 转 Admitted(Some(reason))，成功转 None；提前 return。已 admitted：spawn strict reply adapter；有 identity→Attach，否则 Start(operation,args) | 不改 ask/start 成 classic StartSaga，不删除 admission 门 |
| L95–100 deliver | 解 original、取 identity；调用 `HostIO.deliver(kind,original,identity,technical):Future[Boolean]`；pipeToSelf，失败结果按 false 构造 Delivered | 不以 `true`/空回执替代真实 I/O |
| L101–109 Invoke 分支 | EventSourcedBehavior(PersistenceId.ofUniqueId(persistenceId),State(),handlers)。先 encode 整个 parent input、encode args、算 operation；既有 operation 且 input/args 不符→无 persist 回复 Conflict；delivered+terminal→无 persist 回复 completed；已关联→observe；首次→persist Associated 后 observe | 旧 journal/PID 不改变；root 拆分不得改变编码/验证/副作用次序 |
| L110–115 Observed(Status) | 无效 status→无 persist Conflict；有效时 classify；terminal 已存在则 next=None，否则排除重复 result；只有 identity 缺失才追加 IdentityObserved，随后可追加 ResultIntent；persist events 后按更新 state 决定 deliver/completed/Pending | 成功后读新 state 的行为有具体实现，不能用 classic 空 tracing 回复替换 |
| L116–122 其余命令 | Admitted(None) 且 operation 匹配、非空、未准入→persist AdmissionGranted 后 observe 并取待回复集合；Some(reason) 匹配且未准入→无 persist Pending；其他 Admitted→Effect.none；Denied→Pending；ConflictingIdentity→Conflict；Delivered(true) 且 kind 匹配→persist DeliveryAcknowledged 后 completed；其他 Delivered→Pending(delivery unacknowledged) | 失败不伪装成功；准入拒绝、coordinator 拒绝和投递失败不能合并 |
| L123–131 event handler/close | Associated copy 三字段；IdentityObserved copy identity=Some；ResultIntent copy result=Some,delivered=false；DeliveryAcknowledged copy delivered=true；AdmissionGranted copy admitted=true；结束 handlers/apply/object | event application 单独归属；Root 不拥有状态变迁 |

### 5.4 curated reference：没有对应 Root 固定输出

本次 index 对 `baseline/curated-scala/.../MoneyTransferSagaTransactor.scala` 的条目数为 0；对固定 curated 内容搜索 `object .*SagaTransactor|class .*SagaTransactor` 未命中。这个有限结论只针对已冻结的 curated 集合，不声称其他仓库不存在 Root，也不读取模板注释提及但未冻结的 Fab 文件来代替事实。

两份邻接 curated 文件全文如下，**不是 raw 模板的新输出**：

```scala
package net.imadz.application.services.transactor

import net.imadz.application.aggregates.repository.CreditBalanceRepository

case class MoneyTransferContext(creditBalanceRepository: CreditBalanceRepository)
```

```scala
package net.imadz.infrastructure.bootstrap

import akka.actor.typed.Scheduler
import net.imadz.application.services.transactor.MoneyTransferSagaDefinition

import scala.concurrent.ExecutionContext

/** saga_v3: registers the money-transfer saga definition on this node —
  * must run before sharding recovers any entity. */
trait MoneyTransferSagaTransactorBootstrap {

  def initMoneyTransferSagaTransactor(implicit ec: ExecutionContext, scheduler: Scheduler): Unit = {
    MoneyTransferSagaDefinition.register
    ()
  }
}
```

Context 是一个 repository 构造字段；Bootstrap 只有 implicit ec/scheduler 的注册方法、先 register 后 `()`，没有 Root entityTypeKey/tags/apply，也不创建 sharding entity。它们的包为 `net.imadz`，不可据此把 `Examples` 的 `net.imadz.banking` 默默改掉。

## 6. JS 三条路线：以调用证明可达，不按目录推断

### 6.1 formal：银行实际选择的路线

固定 [bank project L278–299](../baseline/bank/truthsrc.project.json#L278-L299) 明确 `generator="scala-cqrs-play-service"`、context package `example.bankwealth`、runtime coordinate/SHA 和手写源根。调用链为：

1. [registeredProductProducer L92–101](../baseline/js/lib/products/generate-cli.mjs#L92-L101) 的注册表选择 PlayService，不选择 legacy saga-dsl。
2. [PlayService.generate/registry L13–70](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L13-L70) 继承 `createEffectRegistry('2')`；只特别替换 aggregate/invariant 面，`finite-host-dsl` 沿继承链调用。
3. [createEffectRegistry L6–26](../baseline/js/generators/scala-cqrs-application/produce-effect.mjs#L6-L26) 委托 [applicationRegistry L17–33](../baseline/js/generators/scala-cqrs-application/produce.mjs#L17-L33)，后者 `finite-host-dsl` 调 `renderDefinitions, renderInvocationHosts, renderHostAdapters, renderTechnicalPorts, renderHostIO, renderHostVerification`。
4. [renderInvocationHosts L12–15](../baseline/js/generators/scala-cqrs-application/render-invocation-host.mjs#L12-L15) 若 startOwner.kind 为 pipeline 则转 `renderPipelineInvocation`；非 direct/pipeline 报错；direct 自行拼 Host。
5. pipeline renderer [L7–49][J-pipeline] 检查 pipeline/step/Saga 引用，推导完整 parent lineage、identity framing、result 映射，拼 compound text；[L48](../baseline/js/generators/scala-cqrs-application/render-pipeline-invocation.mjs#L48) 再用 `wireHostIO` 后处理；[entry](../baseline/js/generators/scala-cqrs-domain/naming.mjs#L23-L31) 发到 `app/<pkg>/application/<stem>Host.scala`，kind=`invocation-host`。

这里的 Model 是 products 中 `reference-layout / saga-host-contract / saga-runtime-contract / execution-contract` 的临时局部组合；Builder 的推导、检查、Template 拼接与 text patch 混在函数内。没有 `SagaTriggerRootModel` 的八字段层，也没有 Root key/tags/delegating apply。`wireHostIO` 的实际替换规则见 [L5–22](../baseline/js/generators/scala-cqrs-application/render-host-io.mjs#L5-L22)：Delivery 参数→Installed、null guard 替换、admitted 状态/命令/事件插入、observe 前插 admission buffer、定位并替换 deliver body（定位失败抛错）、插入 Admitted/可选 occurrence 分支、补 event fold。只改最初 renderer 会漏掉正式银行的最终方法签名和副作用。

direct 分支还存在 `Submit/Observe/ReceiveEntry`、完整原输入关联、可选 occurrence 接入；pipeline 分支保留父 checkpoint。二者是不同输入分支，不能只改 bank pipeline 后宣称 direct 也已对齐。旧 child family 的 [createChildRegistry L15–22](../baseline/js/generators/scala-cqrs-application/produce-child.mjs#L15-L22) 也复用 base finite-host 输出，后续共享拆分须登记此调用方。

### 6.2 legacy：有经典 Definition emitter，但没有 Root counterpart

[generators/saga-dsl/generate.mjs 全文](../baseline/js/generators/saga-dsl/generate.mjs#L87-L147) 在明确 `mode=legacy`、canonical 无 Saga 声明、提供完整 `legacySagaSpecs` 时，调用 `emitLegacySagaSpec`，输出 `src/main/scala/<package>/<objectName>.scala`，kind=`saga-legacy-source`。重复路径/声明会拒绝。strict-contract 只输出合同 JSON；该文件的 strict-scala 分支明确 runtimeBlocked，不代表其他 strict emitter 或 formal producer都不可用。

[emitLegacySagaSpec L158–226](../baseline/js/generators/saga-dsl/emit.mjs#L158-L226) 完整发射 Args case class/Play JSON Format、显式 prelude、Context trait 的 RecipientRef methods、Definition object/helpers、`definition(implicit ec,scheduler)` 和 `register()`。其 steps/phase 顺序为 prepare/commit/compensate，使用 SagaStep.builder/ref/command/mapReply，`onResult=(_,_)=>Seq.empty`；**不发 Root key/tags/apply**。输入的 preCheck/helpers/commandArgs 是真实 trusted source 槽，不能说 legacy 也是纯结构模型。此路线由 [core plan L23–41](../baseline/js/src/core/generate.mjs#L23-L41) 动态加载 generator 的终端链支持，及 emitter 自身 [CLI L242–264](../baseline/js/generators/saga-dsl/emit.mjs#L242-L264)；不在 formal registeredProductProducer 的表内。

结论：`legacy-only` 的近似点是经典 definition/context 支撑，不是 Root 已实现或待接线的 Root renderer；本工作不复活 legacy。

### 6.3 family：rootTemplate 可达，但逻辑角色不同

[generate-cli L45–63、L94–101](../baseline/js/lib/products/generate-cli.mjs#L45-L101) 注册 `scala-cqrs-saga-monarch-v1`，要求 live implementation capture，因此 `generate-products` 包括 `--plan` 都会拒绝该 producer，须 `generate-project`。家族 [generate L11–42](../baseline/js/generators/scala-cqrs-saga-monarch-v1/generate.mjs#L11-L42) 校验固定 manifest、八产品版本、live implementation context 后 `buildModels → implementationBuildInputs → render`；[render L12–29](../baseline/js/generators/scala-cqrs-saga-monarch-v1/render.mjs#L12-L29) 的 `root` role 确实绑定 `rootTemplate`。不是因为文件叫 root.mjs 就归本族。

已经读取的 family model 相关区段是 [L35–90](../baseline/js/generators/scala-cqrs-saga-monarch-v1/build-models.mjs#L35-L90)、[L157–176](../baseline/js/generators/scala-cqrs-saga-monarch-v1/build-models.mjs#L157-L176)、[L385–417](../baseline/js/generators/scala-cqrs-saga-monarch-v1/build-models.mjs#L385-L417)：固定 strict/R2 供给；两参与者顺序 TCC；拒绝非空 exact decimal descriptors；包派生 `.kernel/.glue/.root`；root symbol 来自 technical.root.id；role→kind 为 `application-root`；root.directDeps 只列 workflow.path；modules 为 kernel/glue/ext/root。它不是经典 Model 的字段映射。本文件未对整个 40309-byte 家族 Builder 的其他角色作完整规格声明。

已完整阅读 [rootTemplate L1–112][F-root]，其输出顺序和关键 body 如下，保留为 B/其他 owner 的职责，不用于覆盖 T04–T06：

| 顺序/分支 | 实际输出 |
|---|---|
| package/import | `m.packages.root`；ActorSystem；BatchProtocol/WorkflowHost；kernel/glue 通配；ExecutionContext/Future |
| class | `final class cls(system,namespace,ports,settings,ownership,每个 run 的 Leaves)(implicit ec)`；require namespace.nonEmpty |
| 初始化 | reservations=`new Saga(system,namespace,ports,settings)`；每个 run 一个 new Host(system,namespace,leaves)；program=new Workflow(reservations,ports,hosts...)；lazy workflow=new WorkflowHost(system,namespace+"/workflow",program,maxJobs,maxChildren) |
| recover | reservations.reconcile(item,authorization,maxInteractions).flatMap 后 workflow.reconcile(item.jobId,originalBatchId) |
| 有 run action 才输出 recoverRuns/resumeRuns/private recoverRunsStage | 分别 reactivate=true/false；AskPattern/ResourceProtocol/scheduler/timeout；先 authorizeRunRecovery，再查询原 job；校验非 Drained/RecoveryBlocked、原 batch membership/Blocked/reservation/delivery、items 的 Running identity；查询 Granted 原 resource owner/units；reactivate 或 canResume；Right(true)→reconcile，Right(false)→Current(view)，Left(reason)→Rejected；其他查询返回→Rejected；NonFatal→带消息 Rejected |
| close | CallerOwned→Future.successful(())；ApplicationOwned→system.terminate 后 whenTerminated.map(_=>()) |
| companion.fromExternal | system/namespace/directory/resourceA/resourceB/recoveryAuthorization，settings 默认 `Settings()`，ownership 默认依据 systemOwnership；implicit ec；逐 implementation 构造 object 引用或 new class 的分组实参；绑定 participant warehouseA/warehouseB 及 association/result/evidence/executionEvidence/recoveryAuthorization；无 runs 直接 new cls，有 runs 再绑定每个 typed leaf、按命名参数建 Leaves，最后 new cls |

这是一套应用生命周期/端口装配和恢复外观，不是经典 sharding Root。`.root/.kernel/.glue` 业务包与三层标准的整改归另包；物理 module 名可以保留，不应把它和业务包混淆。不能删 family 的 close/recovery 来“缩成经典 Root”。

## 7. 胶水、实现槽与不可越界语义

| 依赖/完整符号 | 所需接口、来源和精确职责 | 供给/未决边界 |
|---|---|---|
| `akka.actor.typed.Behavior` | Root 返回 `Behavior[<Base>SagaCommand]`，不是 Future 或 ActorRef | BC scaffold 的 Akka 版本为 2.6.20；没有加载 JAR 或执行编译 |
| `akka.cluster.sharding.typed.scaladsl.EntityTypeKey` | `EntityTypeKey[Command](entityName)`；构建 key，不注册实体 | `com.typesafe.akka:akka-cluster-sharding-typed_2.13:2.6.20`；实际类路径未核验 |
| `akka.cluster.sharding.typed.scaladsl.EntityRef` | `EntityRef[SagaTransactionCoordinator.Command]` factory 参数，逐引用透传 | 与 strict ActorRef 类型不同，不得用 Any/cast/alias 回避 |
| `net.imadz.infra.saga.SagaTransactionCoordinator.Command` | 经典 coordinator 协议；Root 不 send、不 ask。邻接行为使用 StartSaga | [curated coordinator L21–38](../baseline/curated-scala/net/imadz/infra/saga/SagaTransactionCoordinator.scala#L21-L38) 有 `sealed trait Command` 和 `StartSaga(transactionId,definitionName,definitionVersion,argsBytes,traceId="",singleStep=false,replyTo=None,completionReply=None)`；是源码证据，不是依赖供给证明 |
| `<base>.application.services.transactor.<Base>SagaTransactorProtocol._` | 提供 `<Base>SagaCommand`；命令/回复属于 application | 依赖 `saga-trigger-protocol`；不在 Root 重新定义协议 |
| `<base>.application.services.transactor.<Context>` | factory 的必需 ctx；传入而非 service locator 查询 | `saga-context` 必须真实产出对应类型；fallback 只有命名，不保证文件存在 |
| `<base>.application.services.transactor.behaviors.<Base>SagaTransactorBehaviors.apply` | `(id:String,coordinator:EntityRef[...Command],ctx:Context):Behavior[Command]`；Root 单次调用，原序、同一对象引用 | [behavior T L46–63](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/SagaTriggerBehaviorsTemplate.scala#L46-L63) 实际创建 EventSourcedBehavior；该文件由 sibling owner 维护 |

[scaffold/build.sbt L130–147](../baseline/bc/scaffold/build.sbt#L130-L147) 默认消费 `net.imadz:common-core_2.13:0.2` 和 `net.imadz:saga-core_2.13:0.2`，candidate saga JAR 替换默认关闭。formal 银行 [requireApplicationArtifact L4–8](../baseline/js/generators/scala-cqrs-application/generate.mjs#L4-L8) 固定 `net.imadz:saga-core_2.13:0.3.0`、SHA `550fbd5cdb18a50d71a62f8f743d59f24ac1daa03f0aeb07c23c8355c2c0d862`；CLI [L114–125](../baseline/js/lib/products/generate-cli.mjs#L114-L125) 读取 local JAR 字节核 hash。没有因 sibling 源码中有经典 Command 就声称上述 JAR 支持它；不得 publishLocal、重建/发布 runtime 或改 pins 来洗绿。

### 7.1 明确保留的 Scala 债务，不填假实现

- 本 Root 没有 `???`/MANUAL/body slot；但 shared behaviors Model 的 `argsCtorExpr` 是代码字符串槽，按 §3.1 原样记账。
- [behavior T L66–108](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/SagaTriggerBehaviorsTemplate.scala#L66-L108) 的真实体为：构造 args/TransactionInitiated（读取当前时间）→ persist 意图 → thenRun 使用旧 state.id fallback id → ArgsCodec.playJson.encode → context.ask StartSaga；ask failure 构造 `TransactionResult(successful=false,null,"start failed")`；status 回灌 persist Completed/Failed，再 thenReply 返回 Id、错误 Option 和 **Nil tracing**。空 tracing、null snapshot、首命令参数算法、ctx 没被消费都是已有边界，不能称业务完整。
- Root 的 tags 在该行为模板没有 `.withTagger` 接线；这里只记录 val，不声称事件日志已按它分类。
- 强制通用合同保持独立：`CommandHelper` 在 `application.aggregates.behaviors`，具备 `toParam/createFailureReply/createSuccessReply`；应用 Actor commands 按明确回复合同生成 typed replyTo，领域参数/事件不得带 ActorRef；普通 replying-policy 失败不 persist、成功 persist/apply 后由 thenReply 读更新 state；`replyWith` 与 `replyWithAndPublish` 的发布副作用不同。Root 没有这些调用，**不应为了展示合同而硬加 Helper**。经典 Saga 的终态 Failed 事件与普通规则拒绝不是同一类失败，是否增加前置拒绝、如何消除 null/空 tracing 必须交由 behaviors 合同裁定，而不是 Root 自行吞分支。
- 不改 protobuf 字段号/消息身份、PID、serializer ID/manifest、nominal type 区分、算术溢出语义。这里没有 addExact 运算，不能借此改父 execution 或其他 aggregate 的计算。

## 8. 后续 JS 实施写集合、唯一 owner 与迁移

**下表全部是第二阶段 proposed 写集合，不是本轮执行授权。** 当前只写两份文档。

| 路径（相对 JS 仓库） | disposition / owner | 明确任务 |
|---|---|---|
| `generators/scala-cqrs-application/model/saga-trigger-root.mjs` | proposed/new；`saga-trigger-root` | 八字段结构模型，TypeRef/deps/来源明确；不得存整文件 content 或伪造 actor 体 |
| `generators/scala-cqrs-application/build-saga-trigger-root.mjs` | proposed/new；`saga-trigger-root` | B01–B09；消费由集成者裁定的经典输入适配结果；源码名与稳定 key/tag 分开 |
| `generators/scala-cqrs-application/templates/saga-trigger-root.mjs` | proposed/new；`saga-trigger-root` | 仅 T01–T07 排版与渲染；实际依赖和正文都来自模型；不 patch 完成后的源码 |
| `generators/scala-cqrs-application/render-saga-trigger-root.mjs` | proposed/new；**该 Root 物理文件唯一 assembly owner** | build→template→一个 entry；key 为 artifact/variant/owner 而非猜路径；最终 header/format 后计算来源 span |
| `generators/scala-cqrs-application/produce.mjs`、`generators/scala-cqrs-application/generator.json`、`generators/scala-cqrs-play-service/generator.json` | proposed/adapt；仅 `saga-family-integrator` | 裁定经典 capability/product/profile 后接线；不能把 existing strict products 偷换为 classic；版本/产品变更由集成者登记 |
| `generators/scala-cqrs-application/render-invocation-host.mjs`、`render-pipeline-invocation.mjs`、`render-host-io.mjs`（后两文件在同目录） | proposed/split；仅 `saga-family-integrator` | 保留 §5.3 全量构造和 strict 语义；协议/状态/行为/技术 I/O 各交对应 owner；本 Root owner 不直接改三个共享文件 |
| `lib/products/generate-cli.mjs`、`lib/products/registry.mjs` | proposed/adapt-if-D1-requires；仅集成者 | 若新增正式 classic 路线，登记可达 producer/capability 与准入；不会因本文件存在就注册不存在的命令 |
| `lib/scala-target/naming.mjs`、共享 type/layout/writer 支撑 | dependency/reuse；集成者 | 复用 `resolveName/resolveNameSet/resolveArtifactPath`；先对齐 BC Layout/TypeRef 和冲突语义；不在本包复制第二套 resolver |
| `test/codegen-parity/saga-trigger-root.test.mjs`、`test/fixtures/codegen-parity/saga-trigger-root/` | proposed/new，后续授权后 | 仅此族模型/模板/入口文件集及局部 fixtures；当前并不存在本文件宣称的测试执行结果 |

`src/core/generate.mjs` 仍是唯一磁盘 writer，本包不自行 writeFile。`render-saga-trigger-root.mjs` 是 Root 的唯一文本/entry 组装点；它与负责拆复合 Host 的 `saga-family-integrator` 不同时写同一文件。其他三个 trigger artifacts、saga-context、bootstrap 各自独立规格；它们的 blockers 不阻止本份文档保存。

### 8.1 依赖与冲突

- `dependsOn`：`shared-layout-types`、`shared-naming`、`shared-writer-anchors`、`saga-trigger-protocol`、`saga-trigger-behaviors`、`saga-context`、经典/strict runtime 接口裁定、Saga 家族入口装配。
- 与 protocol/entity/behaviors、strict Host 和 B application-root 包在上述三个 formal renderer、registries、manifest、共享 naming/layout 上冲突；必须由集成者串行切分，禁止多个 owner 各改字符串片段。
- 复用现成 names API 时保留其真实行为：[naming L41–74](../baseline/js/lib/scala-target/naming.mjs#L41-L74) 对稳定身份拒绝重命名、冗余后缀报错而非静默去重；[L87–118](../baseline/js/lib/scala-target/naming.mjs#L87-L118) 检查 scoped/portable collision、按选定 module sourceRoot 求路径。不能用 `.replaceAll('-', '_')` 再追加 Host 继续制造 HostHost。

### 8.2 明确输出和旧文件退役边界

- 经典样例目标完整路径：`<new-target>/app/net/imadz/banking/application/services/transactor/MoneyTransferSagaTransactor.scala`。其完整正文为 §5.1；protocol/context/behaviors 是依赖文件，不把它们假称已经生成。
- formal bank 复合 Host 的建议源码名/位置投影是 `<new-target>/app/example/bankwealth/application/services/transactor/BankPaymentHost.scala`。**这是 strict Host 的迁移候选，不是经典 Root 的银行同款实例**。其 coordinator adapter、key/tag、PID 与业务分拆未定，不能拿 §5.1 的 MoneyTransfer 实现覆盖它。
- 旧路径 `app/example/bankwealth/application/bank_payment_hostHost.scala` 的退休必须同步 parent execution、service 装配、HostIO、technical ports、serializer 的类型引用；并单独证明 PB/PID/serializer 字面量保持不变。当前不宣称已完成这些消费者闭包扫描，不允许删除旧文件或留永久转发壳冒充迁移。
- final-byte entry 生成后才更新 manifest/ledger/anchor；检查一次源字段变更产生合理局部 diff，并能从原作者来源查询到新文件。现有 Root noteIds/morphisms 为空时不制造 `@knowledge`。
- 旧与新候选不混用 journal，不覆盖 shared generated/current、手写目录或其他人的候选。基准副本永远不参与退役。

## 9. scoped CLI、fixtures 与未执行的验收义务

### 9.1 fixture 设计（proposed，当前不创建）

| fixture | 必须固定的输入/输出/断言 |
|---|---|
| F1 经典显式 context | 冻结 Examples 的 MoneyTransfer metadata 与 GeneratorContext(`net.imadz.banking`)；预期 Root 八字段、T01–T07 和 §5.1 完整正文；上下游协议/context/behaviors 在依赖闭包独立发射 |
| F2 context fallback | 与 F1 相同但 Root 的 context=None；应解析 MoneyTransferContext；另行验证 missing actual context 文件的准入/诊断，不能自动构造空 Context |
| F3 命名与身份 | 合法标准名、无 SagaTransactor 后缀、重复内嵌后缀、portable name collision、explicit source-name binding；非标准输入的处理先过 D3，不改 entity key/tag/PID 来满足命名 |
| F4 deps/import | 同包 protocol/context 过滤、behaviors 导入、固定 import 顺序；framework deps 缺项和 nested protocol owner 分别记账；不依靠全局 import 编译侥幸通过 |
| F5 dispatch | 空 sagas、单个/多个唯一 saga、scope suppress、args 缺失导致 entity 前置失败、同路径冲突；writer 不产生重复 Root |
| F6 formal 严格 Host 保护 | 保留银行快照仅作为异输入结构/身份反例；direct 和 pipeline 两种 startOwner 都保留 admission/identity/result/delivery 分支；不是自动生成的银行经典 fixture |
| F7 family 路线排除 | 显式 family producer 仍消费自己的八产品/live implementations，rootTemplate 继续承担生命周期职责；不被误登记成 classic saga-trigger-root |

### 9.2 可核实的 CLI 形状与副作用

以下命令**本阶段全部未执行**。命名为 `fixtures` 的目录/JSON 是后续待创建并审批的独立输入，不是现存事实。不得直接复制固定 bank project 到新位置后假设相对 runtime/手写绑定仍成立。

**Scala 传统链：真实 scope 机制，不杜撰 `--artifact` flag。** 在 BC 仓库执行的命令形状：

```bash
sbt \
  -Dcodegen.system=Examples \
  -Dcodegen.targetDir=/absolute/isolated/saga-trigger-root/bc-output \
  -Dcodegen.scope-file=/absolute/isolated/saga-trigger-root/fixtures/concerns.json \
  -Dcodegen.concern=saga-trigger-root-content \
  -Dcodegen.families=saga-trigger-root-fixture \
  -Dcodegen.ledger=/absolute/isolated/saga-trigger-root/bc-ledger.json \
  "runMain net.imadz.codegen.CodegenMain"
```

对应 concerns 内容的**拟制合同**（只在本文展示，不写到磁盘）：

```json
{
  "flavors": {
    "saga-trigger-root-content": { "artifactKinds": ["saga-trigger-root"] }
  },
  "concerns": {
    "saga-trigger-root-content": {
      "schemaCategories": ["saga"],
      "flavors": ["saga-trigger-root-content"]
    }
  },
  "familySets": {
    "saga-trigger-root-fixture": ["MoneyTransferSagaTransactor"]
  }
}
```

依据 [CodegenMain L90–104](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L90-L104) 和 [ConcernScope L124–223](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ConcernScope.scala#L124-L223)：只给 scope-file 不会启用 concern；knownFamilies 收集聚合/投影，不直接含 Saga 名；这里通过显式 registry.familySets 展开为 Saga attribution.family，而不是给一个会被拒绝的裸 Saga 名。kind/category/family 三重匹配。此形状没有实际执行，整体 Examples harness 和 scope 之前执行的其他 Builder 仍可能阻断；不能把它称为保证只计算 Root 的入口。

副作用：sbt/JVM 子进程及工程 target/project 编译缓存，依赖缓存/可能解析下载；CodegenMain 先 prepare/harness，再创建显式 target、复制 scaffold；runCommon 创建 proto 目录、调用各层 Builder、writer；scope 守卫在 ledger 记录之后；随后 knowledge manifest，若有 formalSemantics 还写该文件。Root scope **不等于只有一个磁盘写文件**。不得用默认 banking-app/ingested-app，未经授权不得运行或下载。

**JS formal 内容候选：真实公开 products 入口。** D1 的输入/产品映射裁定后，在隔离最小 fixture 上使用以下形状；现有 strict bank payload 不会凭此命令自动产生 classic Root。

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /absolute/isolated/saga-trigger-root/fixtures/request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-play-service \
  --out /absolute/isolated/saga-trigger-root/js-output \
  --options-json /absolute/isolated/saga-trigger-root/fixtures/options.json \
  --plan
```

[generateProductCli L66–88](../baseline/js/lib/products/generate-cli.mjs#L66-L88) 的四个路径 flag 均必需；`--plan` 返回 plan/sources 不调用 applyEntries。读取/编译 request 的 products，读取 manifest/options，formal application 还读本地 runtime JAR 核 hash、service 外置目录；没有 `--artifact=saga-trigger-root`。**输入闭包**而不是不存在的 flag 实现范围控制。去掉 `--plan` 才进入真实 apply：写输出文件、`truthsrc.ledger.json` 和 `anchors.json`，参见 [applyEntries L246–268](../baseline/js/src/core/generate.mjs#L246-L268)。此 products 入口不等同 project graph 写入，也不自动执行 Scala 编译/测试；任何后续构建/供给行为仍须单列。

**family 接口核查用 project 入口，不能误用 products。** 若后续确需对 family 的排除/共享迁移做独立 fixture：

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-project \
  --project /absolute/isolated/saga-trigger-root/family-fixture/truthsrc.project.json \
  --out /absolute/isolated/saga-trigger-root/family-output \
  --plan
```

这不是 classic Root 验收替代命令。[captureProject L91–144](../baseline/js/lib/project/cli.mjs#L91-L144) 即使 plan 也会 validate/roundtrip/compile 作者树、捕获手写源；[projectCli L183–208](../baseline/js/lib/project/cli.mjs#L183-L208) 有 implementations 时在 plan 判断前调用 `verifyImplementationSources`。其实现和 `projectGraphFile` 定位支撑未在本次读取的冻结文件中提供，**不能保证 plan 没有验证子进程/临时产物，也不能给出一个猜测的 graph 绝对路径**；这是 D6 的执行前阻断项，不为补齐文档去读当前未冻结实现。非 plan 还打开项目 graph store，写 `.truthsrc/canonical.json/request.json/compiled.json/inputs.json`、生成文件、ledger/anchors 并发布 graph anchors。新 outDir 不隔离项目 graph；本轮禁止运行该命令。

### 9.3 验收义务分层（全部未运行）

1. **MBT 内容**：八 Model 字段及 inherited defaults、B01–B09、T00–T07 全部有对照；import 和声明顺序、完整 RHS/参数/default/body 逐文件比较。不能用去空白 normalize、签名相同或 AST 类似代替。
2. **同输入文件集**：先建立显式 Scala metadata ↔ JS request/options 的无损适配；空/单/多 Saga 与两个 context 分支分别覆盖。比较完整 output paths 和正文，版本头/平台换行等差异须逐项白名单。尚无同输入输出，此项保持未验证。
3. **真实接口**：冻结 JAR 先证明 classic Command/EntityRef 与对应 behaviors/context 的可编译依赖；不能 copy runtime 或升级库。Root 单次委托的 id/coordinator/ctx 引用、返回 Behavior 和 key/tag 字面量必须验证。
4. **真实行为**：本 Root 无 persist/reply；在最小依赖闭包验证由行为层负责的持久化/回复时序、拒绝不写、成功读新 state、一次回复和无意外 EventStream 发布。classic Saga 的终态失败记录与普通 replying-policy 的前置拒绝分别断言。不能因 Root 体只有一行而用 stub Behaviors.same 证明交易成功。
5. **OO/FP/复杂度**：目标普通方法 CC≤5、6–10 逐方法理由、>10 重构或逐方法审定；嵌套目标≤2。Root 的委托职责清晰，但当前不报实测数。formal/family 大方法的分支不能搬进 String/Any dispatcher 刷分。
6. **稳定和回锚**：同输入两次完整字节一致；一次字段/命名绑定变更的局部 diff；来源查询能落到最终字节；旧输出归属/拒绝冲突/退役计划可审计。不可后格式化却沿用旧 offsets。
7. **调度**：后续生成/内容比较暂定 5 分钟预算，最小接口/行为闭包 15 分钟预算；JVM 构建由集成者批末集中一次，不每族启动全银行验收。没有现成的本族独立行为 spec/runner 被本次确认，因此不编造 `testOnly` FQN；落实 D6 后才给真实运行命令。

## 10. 必须裁定的具体问题

| ID | 未决问题 | 阻断面 |
|---|---|---|
| D1 `classic-vs-strict-input` | 正式 JS 是否新增明确 classic Saga capability/profile 以复刻 T，还是先保持 strict Host 并另立结构适配变体？现 `saga-host-contract` 的 strict identity/result/admission 不能等同 `SagaTransactorMetadata(name,context)`；若新增，需要确定具体产品版本、input slots 和 generator 入口。 | 入口与输入适配；本族仍 missing-counterpart |
| D2 `coordinator-supply` | 消费的实际冻结 JAR 是否包含 `net.imadz.infra.saga.SagaTransactionCoordinator.Command` 及 v3 StartSaga API？若只有 strict coordinator，EntityRef/ActorRef、Context/Installed、协议结果如何保持边界？不授权发布/更换 pins。 | 编译/运行接口 |
| D3 `names-identities-imports` | 非标准 meta.name 的全串 replace 与 selfType+Protocol 拼接冲突应拒绝还是通过显式 source binding 修正？稳定 entityName/tagPrefix 如何输入并保持既有值？是否补齐 framework/protocol 的结构依赖而保持正常输出 import 字节？ | Builder/shared naming/ledger deps |
| D4 `bank-host-retirement` | 是否、何时批准严格银行 Host 拆分？protocol/event/state、admission、identity、delivery 及 serialization 各自目标类型/文件是谁；经典 key/tags 不得凭银行 operation id 合成。父 execution/服务/serializer 消费迁移需完整闭包。 | 银行迁移，不阻断独立经典规格保存 |
| D5 `classic-behavior-debt` | 经典 behaviors 的 argsCtorExpr 首命令假设、fallback ctx 文件、null failure snapshot、Nil tracing、未接 tags/未用 ctx 如何处置？Root 不自行补行为或删除参数。 | 与 protocol/entity/behaviors/context 的接口闭包 |
| D6 `acceptance-execution-boundary` | 同输入 request/options/metadata fixtures、真实本族行为 runner、精确离线供给以及 family project 的 implementation-evidence/graph/临时目录写面尚未固定；这些必须在运行前确认，当前没有成功或性能承诺。 | 后续执行授权与验收 |

本文件保存即交付本族的观察、内容约束和缺项，不意味着实现完成、可运行、ready 或 parity-PASS。

[M]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/transactor/SagaTriggerModels.scala#L1-L71
[B]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/transactor/SagaTriggerBuilder.scala#L1-L158
[T]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/SagaTriggerRootTemplate.scala#L1-L36
[J-direct]: ../baseline/js/generators/scala-cqrs-application/render-invocation-host.mjs#L1-L47
[J-pipeline]: ../baseline/js/generators/scala-cqrs-application/render-pipeline-invocation.mjs#L1-L50
[J-io]: ../baseline/js/generators/scala-cqrs-application/render-host-io.mjs#L1-L23
[BANK]: ../baseline/actual-js/app/example/bankwealth/application/bank_payment_hostHost.scala#L1-L131
[F-model]: ../baseline/js/generators/scala-cqrs-saga-monarch-v1/build-models.mjs#L1-L417
[F-root]: ../baseline/js/generators/scala-cqrs-saga-monarch-v1/templates/root.mjs#L1-L111
[C-context]: ../baseline/curated-scala/net/imadz/application/services/transactor/MoneyTransferContext.scala#L1-L5
[C-bootstrap]: ../baseline/curated-scala/net/imadz/infrastructure/bootstrap/MoneyTransferSagaTransactorBootstrap.scala#L1-L16
