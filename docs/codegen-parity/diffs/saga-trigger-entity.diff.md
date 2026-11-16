# saga-trigger-entity：经典触发聚合的领域状态与事件

## 1. 范围、状态与证据边界

- Artifact：`saga-trigger-entity`，传统模板族序号 **19**；本次 detail 的 `group` 同名。
- 内容状态：**`missing-counterpart`**。Scala 侧内容已逐构造列明；已检查的 JS 正式链有持久调用宿主，family 链有严格 Saga bridge，但它们不是经典 `SagaTriggerEntityModel` 的同义实现。下列接口/语义问题另标 `decision-required`，不影响独立保存本规格。
- 固定 HEAD：BC `cc335eb1e0d0fae17bf092fd61b126040196ea70`；JS `bf104e16ab82ef39d7fa416d0997907d18a815ad`。HEAD 不替代工作树字节；以下引用均优先指向不可变副本。
- 这是源码内容检查，不是运行验证。本次没有测试、typecheck、编译、生成、runtime、服务、下载、Git 写入、真源批改或 validate/roundtrip。没有新鲜同输入输出，不能给出字节一致、行为通过或 parity 通过结论。
- 只创建本文件及 `details/saga-trigger-entity.json`；不修改既有 15 份 diff、其它制品、中央分区/目录、基线、业务应用、ledger 或 anchors。

### 1.1 四种材料不可混签

| 材料 | 本项实际取得的内容 | 可作何种结论 |
|---|---|---|
| `raw-scala` | 完整固定 Model/Builder/Template；§3 包含 Entity 模型、构建方法及完整模板源码 | 可确定模板表达式、构造顺序和已存在缺陷；**没有本次执行得到的完整 `.scala` 输出** |
| `approved-target` | §5 的完整参数化文件体及明确的命名/import/布局规则；未决语义不填默认成功 | 是目标内容规格，不是已生成或已编译文件；空 args、身份/类型冲突须先裁决 |
| `actual-js` | 银行既有 `bank_payment_hostHost.scala` 完整固定文件，131 行；§4.2 逐段记账 | 真实银行实例，但它是 strict pipeline invocation host，不是与经典 Saga 相同的输入 |
| `curated-scala` | 固定 `CreditBalanceEntity.scala` 全文；索引中没有 `*TransactionEntity*` 的同族人工完成文件 | 只可参考 State/Event 分组；不可把余额实体、SagaDefinition 或注释中提及的 Fab 文件当本族完整 golden |

权威说明：[AUTHORING-CONTRACT](../AUTHORING-CONTRACT.md#L13-L73)、[layout-and-style](../layout-and-style.md#L14-L64)、[APPROVED-PLAN](../../../.rounds/prettify-generated-code-resume-20261115-cgr9lzlk/APPROVED-PLAN.md#L104-L146)。原始 bytes/SHA 账在 [baseline/index.json](../baseline/index.json)；只提取了 `scala-artifacts.json` 的本行。

### 1.2 固定来源与指纹

下面 M/B/T/H/C 的 bytes 与 SHA 已以只读哈希对照固定索引；其余固定引用的完整身份也可由索引 `snapshot` 键取得。

| 键 | 固定全文与本项行锚 | bytes | SHA-256 |
|---|---|---:|---|
| M | [SagaTriggerModels.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/transactor/SagaTriggerModels.scala#L1-L71)，Entity 位于 L31–38 | 2982 | `c7331985fb13f32e0f8104fed9110893703eece551f03c7da031796a073db2f1` |
| B | [SagaTriggerBuilder.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/transactor/SagaTriggerBuilder.scala#L1-L158)，Entity 位于 L51–70 | 8368 | `43876918912c7a5c97e18a647821f1467c74f6ee0ed058906de4d76a25cfa664` |
| T | [SagaTriggerEntityTemplate.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/SagaTriggerEntityTemplate.scala#L1-L55) | 2442 | `914c4d4dc1ca86a9c0d3533d3251468917e33c3108c3837534c18d95811ece39` |
| H | [银行 bank_payment_hostHost.scala](../baseline/actual-js/app/example/bankwealth/application/bank_payment_hostHost.scala#L1-L131) | 11966 | `e74f76532abdadc384d4fda34cad3d8896d34898c5996b3e3fa85758afa986c4` |
| C | [人工 CreditBalanceEntity.scala](../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L1-L29) | 1259 | `c2e41213ec31561448256c2cec955ce589e7e0a39b721a11828c37ec6b3bd555` |

生产原址分别是 BC `src/main/scala/net/imadz/codegen/scaffolding/cqrs/...`、BC `reference_project/app/net/imadz/domain/entities/CreditBalanceEntity.scala`、银行 `generated/current/app/example/bankwealth/application/bank_payment_hostHost.scala`；这些可变文件没有拿来替代固定副本。

**额外当前源码**：仅为澄清未来 family CLI 的外置源码核验调用，读取了未入 baseline 的 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/lib/project/implementation-evidence.mjs`，2794 bytes，SHA-256 `da6889091818f35bac0e3a62e04a862ee4268fef6f7b94cad6fed80cb637aa76`，L1–47。它是可变工作副本，没有复制或修改；已登记 `extraSources`。L28–46 调用 `verifyHandwrittenSources`，返回文件级证据，不验证 Scala ABI。其委托函数的传递副作用不在本次实读闭包，见 D7。

## 2. 调度、输入与文件基数

### 2.1 真实 Scala 主链

1. [CodegenMain.scala L62–81、L183–201](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L62-L81)：传统入口选择 registry system，或成对 `systemFile/systemBindings`；与 `semanticProductsFile → generateProducts` 分支不同。固定源码的 `prepare` 先验证，L199–201 才创建目标/复制 scaffold；不得沿用旧描述误称本 HEAD 在 harness 前复制。
2. [CQRSApplicationGenerator.scala L192–220](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L192-L220)：构建 Context 后按 domain/application/infrastructure/interface 调度。
3. [同文件 L735–770](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L735-L770)：对每个 `app.sagas`，先 participants、definition，再 Protocol → **Entity** → Root → Behaviors。Entity 没有单独 `version == 3` 判断；注释的 `saga_v3` 不是条件代码。
4. L762–764 精确调用 `SagaTriggerBuilder.buildEntity(meta, ctx)`、`SagaTriggerEntityTemplate.generate(entModel)`、`writeArtifact`；归因是 `ArtifactAttribution("saga-trigger-entity", entModel.selfType.name, "saga", List(meta.name))`。

`SagaTransactorMetadata` 的真实定义见 [ArchitectMetadata.scala L477–500](../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L477-L500)。Entity 只消费 `name` 和 `args.fields`；不是从 `triggerCommandName`、steps、participants 或结果描述推测实体业务。`args` 默认 `None`；`SagaArgsMetadata(name, fields, description = "")` 的 name/description 不进入 Entity 输出。`version = 1`、`replyMetadata = None`、`context = None` 也不改变 Entity 模板。

### 2.2 输出基数和路径

设 `baseName = meta.name.replace("SagaTransactor", "")`，`basePackage = ctx.rootPackage + "." + ctx.moduleName`。

| 变体/条件 | 基数、路径 | 本次观测状态 |
|---|---|---|
| classic-present：`app.sagas` 中一条 metadata，`args = Some(...)`，前序生成未失败，scope/领地允许写 | 每条 **1** 个文件，`<target>/app/<basePackage 路径>/domain/entities/<baseName>TransactionEntity.scala` | 静态 enabled；未 exercised |
| no-sagas：`app.sagas` 为空 | 0 个本族文件 | suppressed 条件；没有编造空 Entity |
| missing-args：`args = None` | B:L54 抛异常；不是 0 文件成功，且主链可能已写更早的制品 | rejected；未运行 |
| empty-args：`Some(args)` 且 fields 为空 | B 没有拒绝；T 拼成 `TransactionInitiated(, timestamp: Long)`，pattern 为一个 `_` | 模板缺陷，是否更上游拒绝未验证；D2 |
| multiProject | `saga-trigger-entity` 没有列入 `targetModuleOf`，所以仍落 `<target>/app/.../domain/entities/...scala`，**不是自动 kernel** | raw 路径已定位；目标模块分配 D6 |
| scope/territory skip | writeArtifact 可只记账而不实际写，或由领地 writer 拒绝/保留 | 不能以模型数量声称写成数量 |

路径依据：[PackageLayout.scala L7–21](../baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala#L7-L21)、[GeneratorContext.scala L61–69、L255、L295–302](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L295-L302)、[writer L331–424](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L331-L424)。常规 Context 的业务根实际是 `net.imadz.<system.contextName 或 codegen>`，不能把银行 `example.bankwealth` 当 Scala 默认。

writer 先计算 package path/module prefix，记录 deps/noteIds/morphisms，再判断 scope，拼 `fingerprintHeader + content` 后交 territorial writer；strict `anchorRoot` 非空且确实写成才记录最终字节指纹/锚声明。本模型没有覆写 noteIds/morphisms。多模块 ledger 的 `app/$relative` 前缀也属于共享 writer 原行为，不在本族顺便修正。

## 3. Scala 的 Model / Builder / Template 完整内容账

### 3.1 本族 Model 和共享值类型

M:L31–38 的完整 Entity 定义如下，没有省略字段。

```scala
/** Entity：状态 + 事件（Initiated / Completed / Failed）。 */
case class SagaTriggerEntityModel(
    override val selfType: TypeRef,
    stateType: TypeRef,
    argsFields: Seq[FieldDef],
    statusType: TypeRef,
    dependencies: Set[TypeRef]
) extends ArtifactModel
```

| 顺序 | 字段/继承成员 | 类型、默认值、依赖语义 | JS 本族对应 |
|---:|---|---|---|
| 1 | `selfType` | `TypeRef`，必填；name 控制外层 object 与 filename，packageName 控制 package | missing；formal host 的 package/stem 不是该类型模型 |
| 2 | `stateType` | `TypeRef`，必填；使用 `.name`；事件族由该 name 的全局 `State → Event` replace 派生 | missing；现有 host 仅叫 `State` |
| 3 | `argsFields` | `Seq[FieldDef]`，必填且有序；只用于 Initiated 的字段与解构 arity，不复制到 State | formal 有 args 契约，但无该模型/事件映射 |
| 4 | `statusType` | `TypeRef`，必填；模板生成嵌套 sealed trait/companion | missing；字符串 `result` 不等于四分支 Status |
| 5 | `dependencies` | `Set[TypeRef]`，必填；imports 和文件依赖账输入 | formal entry 有文件 deps，但非这套 TypeRef 依赖 |
| 继承 | `fqn` | `selfType.packageName + "." + selfType.name` | shared resolver 待接 |
| 继承 | `registerTo(registry: ArtifactRegistry): ArtifactRegistry` | `registry.register(this)`；没有为嵌套 Status/State/Event 覆写注册 | 不得假称嵌套符号已单独注册 |
| 继承 | `morphisms` | `Seq[net.imadz.meta.MappingMorphism] = Nil` | 不伪造来源 |
| 继承 | `noteIds` | `Seq[String] = Nil` | 无作者 ID 透传，不能凭文件名补成事实 |

继承全文：[ArtifactModel.scala L5–47](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L5-L47)。共享子型全文：[TypeSystem.scala L4–85](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4-L85)。

- `TypeRef(name: String, packageName: String, typeParams: Seq[TypeRef] = Nil)`：`fqn` 在空 package 时只返回 name；signature 对有参数且名称为 `Tuple`+数字的类型输出 `(T1, T2, ...)`，其它有参数类型输出 `Name[T1, ...]`，否则 name。参数的 signature 递归计算。`collectAllDependencies = Set(this) ++ typeParams.flatMap(_.collectAllDependencies)` **存在但 B.buildEntity 未调用**。
- `shouldImport(currentPackage)` 对空包、同包、`scala`、`java.lang` 返回 false，其余 true；`scala.math.BigDecimal` 会导入。
- `FieldDef` 顺序：`name: String`、`typeRef: TypeRef`、`defaultValue: Option[String] = None`、`comment: Option[String] = None`、`noteId: Option[String] = None`、`description: String = ""`。B 只传前两项；T 也只读前两项。默认值源码串、字段版本注释、知识 ID、描述在此均不发射，不能宣称保留了这些元数据。
- `CodeTemplate[M <: ArtifactModel]` 唯一方法 `generate(model: M): String`，见 [CodeTemplate.scala L5–7](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/CodeTemplate.scala#L5-L7)。没有 runtime 接口继承。

#### 同文件其它模型的读取边界

已读 M 全文件；以下是共享文件其它模型的全部有序字段，均无构造参数默认值，均不由本 Entity 文件发射。它们不能因文件共享被本工作包覆盖。

| 模型 | 完整有序字段 |
|---|---|
| `SagaTriggerProtocolModel` L15–23 | `selfType: TypeRef`, `triggerCommands: Seq[SagaTriggerCommandModel]`, `confirmationType: TypeRef`, `statusCommandType: TypeRef`, `transactionResultType: TypeRef`, `tracingStepType: TypeRef`, `dependencies: Set[TypeRef]`；继承 ArtifactModel |
| `SagaTriggerCommandModel` L25–29 | `name: String`, `params: Seq[FieldDef]`, `handlerArgs: Seq[String]`；不继承 ArtifactModel。params 不含自动补的 replyTo；handlerArgs 是 params 名后加 replyTo |
| `SagaTriggerRootModel` L41–50 | `selfType: TypeRef`, `entityName: String`, `tagPrefix: String`, `commandType: TypeRef`, `coordinatorType: TypeRef`, `contextType: TypeRef`, `behaviorsType: TypeRef`, `dependencies: Set[TypeRef]`；继承 ArtifactModel |
| `SagaTriggerBehaviorsModel` L53–71 | `selfType: TypeRef`, `entityName: String`, `stateType: TypeRef`, `eventType: TypeRef`, `commandType: TypeRef`, `definitionType: TypeRef`, `argsType: TypeRef`, `argsFields: Seq[FieldDef]`, `triggerCommands: Seq[SagaTriggerCommandModel]`, `argsCtorExpr: String`, `confirmationType: TypeRef`, `statusCommandType: TypeRef`, `coordinatorType: TypeRef`, `contextType: TypeRef`, `transactionResultType: TypeRef`, `dependencies: Set[TypeRef]`；`argsCtorExpr` 是明确源码字符串槽，不是结构化表达式 AST；继承 ArtifactModel |

### 3.2 Builder：全部实际推导与分支

B:L51–70 全方法如下。

```scala
  def buildEntity(meta: SagaTransactorMetadata, ctx: GeneratorContext): SagaTriggerEntityModel = {
    val pkg = ctx.layout.domain.entities.root
    val baseName = meta.name.replace("SagaTransactor", "")
    val argsMeta = meta.args.getOrElse(throw new RuntimeException(s"Saga '${meta.name}' lacks args (v3)"))
    val argsFields = argsMeta.fields.map(f => FieldDef(f.name, ctx.typeResolver.resolve(f.fieldType)))
    val stateType = TypeRef(s"${baseName}TransactionState", pkg)
    val statusType = TypeRef(s"${baseName}Status", pkg)
    val deps = (argsFields.map(_.typeRef).toSet ++ Set(
      ctx.knownFrameworkTypes("CborSerializable"),
      ctx.typeResolver.resolve(CustomType("Id", "net.imadz.common"))
    )).filter(_.shouldImport(pkg))

    SagaTriggerEntityModel(
      selfType = TypeRef(s"${baseName}TransactionEntity", pkg),
      stateType = stateType,
      argsFields = argsFields,
      statusType = statusType,
      dependencies = deps
    )
  }
```

| 步骤 | 原始规则、所有分支/错误 | 目标处理 |
|---|---|---|
| B1 L52 | 使用 `layout.domain.entities.root` | 三层布局下原位保留；不放 application Entity 或第四层 kernel 包 |
| B2 L53 | Scala `String.replace` 删除所有 `SagaTransactor` 子串，不是只 stripSuffix；不调用 NamingConventions | raw 保留证据；统一命名 resolver 的等价/冲突边界 D3 |
| B3 L54 | `Some` 继续，`None` 抛指定 RuntimeException；未默认构造空 args | JS 应在模型准入失败；不得吞缺项 |
| B4 L55 | 按原 `fields` 顺序 `FieldDef(name, resolve(fieldType))`；没有排序、过滤、状态 nature 排除或 `resolveField(... optional ...)` | 不从命令/文本猜事件字段；保留字段名/名义类型和顺序 |
| B5 L56–57 | state/status 都用 domain entities **包级 TypeRef**；实际模板声明却嵌套在 Entity object | shared symbol/owner 模型必须记录嵌套拥有者，不能按这个 TypeRef 生成无效包级导入 |
| B6 L58–61 | 字段顶层 typeRef set 加 marker 和 Id，后按 shouldImport 过滤；无递归依赖收集、无冲突检测 | `Option[Money]` 等可丢内层 Money import；修复是显式 shared type 差异，不称 raw 已有 |
| B7 L63–69 | 五个 named args 按 Model 顺序构造；selfType=`<baseName>TransactionEntity` | 建结构模型而不是 `content` 全源码字段 |

`ctx.typeResolver.resolve(MetaType)` 委托 [TypeResolverDSL.scala L1115](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L1115) → [TypeResolver.scala L19–93](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala#L19-L93)。原始递归/兜底必须入账：基础类型逐项映射；EntityState/Event/Command/Aggregate/Repository/Service/ValueObject/Controller 等 refs 各走既有 resolver；StructRef 有 SymbolTable owner 时解析嵌套类型，否则 domain.values；CustomType **先按名字匹配已知框架类型并递归 typeArgs**，否则仅把旧 `net.imadz.domain.values` 包改为当前值包并递归；未覆盖 MetaRef 进入 `resolveMetaRef = ???`；少数 metadata 对象直接解析；最终兜底 `TypeRef("Any", "")`。不得把 `???` 或 Any 兜底移植成假成功。

因此 B6 中源码写的 `CustomType("Id", "net.imadz.common")` 在标准 Context 下实际解析为 `net.imadz.common.CommonTypes.Id`，不是必然导入 `net.imadz.common.Id`。依据 [GeneratorContext.scala L68–70、L264–276](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L264-L276)。marker 的依赖包受 frameworkPackage 控制，但 T 的 extends **硬编码** `_root_.net.imadz.common.CborSerializable`：非标准 frameworkPackage 会出现依赖/使用不一致，D4。

#### 共享 Builder 的其余方法与完整分支（防止误移植）

- B:L19 `coordinatorPkg = "net.imadz.infra.saga"`；Entity 不直接需要 coordinator。文件 imports 中 `TypeResolver` 没有在 buildEntity 内直接调用。
- `buildProtocol` L21–49：package 为 application.services.transactor；同一全局 replace 派生 baseName；先取所有不以 `Update` 开头的命令名为 set，再按 metadata 原顺序过滤命令并映射 params；每条 handlerArgs=`parameters.map(_.name) :+ "replyTo"`。confirmation=`<baseName>SagaConfirmation`；status 取第一个 `Update*` 名，否则 `Update<baseName>SagaStatus`。依赖是触发参数顶层 typeRef 加已解析 TransactionResult/TracingStep、ActorRef、CborSerializable 后过滤 shouldImport；构造 Model 依次传 selfType=`<baseName>SagaTransactorProtocol`、triggers、confirmation、status、两 runtime 类型、deps。没有依据 `triggerCommandName` 筛选，也没有递归收集。
- `buildRoot` L72–92：transactor root 包，protocol/behaviors 类型由 baseName 派生，behaviors 在 transactor.behaviors；context 有 `meta.context` 时 `sagaContext(c.name)`，否则 `sagaContext(meta.name)`；deps 只含 protocol/behaviors/context 后过滤，不自动补 coordinator。selfType=`meta.name`；entityName=`<baseName>Transaction`；tagPrefix=`baseName.toLowerCase`；command=`<baseName>SagaCommand`；coordinator resolve `SagaTransactionCoordinator`；后传 context/behaviors/deps。
- 私有 `argsCtorExpr` L94–112：只用 `triggers.headOption` 建参数名→typeRef map，否则空 map；第一个 typeRef.name 为 Money 的参数作为 moneyParam。按 argsFields 顺序匹配：①同名参数 Money 且字段名 amount → `amount.amount`；②同名 Money 且字段名 currency → `currency.currency.getCurrencyCode`；③args 字段 String 且同名参数 Id → `<name>.toString`；④其它同名参数 → `<name>`；⑤无同名但 amount 且存在 Money → `<moneyParam>.amount`；⑥无同名但 currency 且存在 Money → `<moneyParam>.currency.getCurrencyCode`；⑦剩余无匹配 → 裸字段名。最后 `mkString(", ")`。没有验证最终裸名存在；注释对 Money 拆分的概括不能代替上述 guard。该代码串槽仅属 Behaviors。
- `buildBehaviors` L114–157：behaviors 包与 root 包各取布局；args 缺失仍抛同异常，字段构建同 Entity；调用 buildProtocol/buildEntity；context 两分支同 Root；definition=`<baseName>SagaDefinition`。deps 为 protocol、entity.selfType、entity.stateType、definition、confirmation、context、transactionResult、EntityRef、ActorRef，加触发参数顶层 typeRef，再过滤 shouldImport。构造 M 表全部 16 个字段：selfType=`<baseName>SagaTransactorBehaviors`，entityName=`<baseName>Transaction`，state 来自 entity，event=`<baseName>TransactionEvent` 的 domain entities TypeRef，command/definition/args（argsMeta.name 在 root 包）、argsFields/triggers、上述源码字符串、confirmation/status/coordinator/context/result/deps。不能把这条调用闭包当本族实现许可。

### 3.3 原始 Template 全文

以下是 T 的完整源码，不是手工 golden，也没有运行模板。

```scala
package net.imadz.codegen.scaffolding.cqrs.template.application.transactor

import net.imadz.codegen.scaffolding.cqrs.model.application.transactor.SagaTriggerEntityModel
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

/** saga_v3 触发聚合 Entity 模板（**B·§13**）——极简状态（id/status）+ 事件携带业务意图。
  * golden 参考：playAkkaCQRS `FabSagaTransactionEntity`。 */
object SagaTriggerEntityTemplate extends CodeTemplate[SagaTriggerEntityModel] {
  def generate(model: SagaTriggerEntityModel): String = {
    import model._
    val imports = dependencies.map(_.fqn).toSeq.distinct.sorted.map(i => s"import $i").mkString("\n")
    val eventTypeName = stateType.name.replace("State", "Event")
    val eventParams = argsFields.map(f => s"${f.name}: ${f.typeRef.signature}").mkString(", ")
    // 事件 = argsFields 各参 + timestamp → applyEvent 通配元数须匹配
    val initiatedPattern = (argsFields.map(_ => "_") :+ "_").mkString(", ")

    s"""package ${selfType.packageName}

$imports

object ${selfType.name} {

  // --- State（极简：只记身份与状态；业务意图在事件里）---
  sealed trait ${statusType.name} extends _root_.net.imadz.common.CborSerializable
  object ${statusType.name} {
    case object New extends ${statusType.name}
    case object Initiated extends ${statusType.name}
    case object Completed extends ${statusType.name}
    case class Failed(reason: String) extends ${statusType.name}
  }

  case class ${stateType.name}(
    id: Option[String] = None,
    status: ${statusType.name} = ${statusType.name}.New
  ) extends _root_.net.imadz.common.CborSerializable {

    def applyEvent(event: $eventTypeName): ${stateType.name} = event match {
      case TransactionInitiated($initiatedPattern) =>
        copy(status = ${statusType.name}.Initiated)
      case TransactionCompleted(_, _) =>
        copy(status = ${statusType.name}.Completed)
      case TransactionFailed(_, reason, _) =>
        copy(status = ${statusType.name}.Failed(reason))
    }
  }

  // --- Events ---
  sealed trait $eventTypeName extends _root_.net.imadz.common.CborSerializable
  case class TransactionInitiated($eventParams, timestamp: Long) extends $eventTypeName
  case class TransactionCompleted(id: String, timestamp: Long) extends $eventTypeName
  case class TransactionFailed(id: String, reason: String, timestamp: Long) extends $eventTypeName
}
"""
  }
}
```

### 3.4 输出 construct / RHS / 顺序全账

`E` 表示 `${selfType.name}`、`S` 表示 `${stateType.name}`、`Z` 表示 `${statusType.name}`、`V` 表示 `stateType.name.replace("State", "Event")`。这些是上述真实模型变量的缩写，不是未实现业务体。

| ID / T 行 | 输出构造，完整规则与 RHS | 目标位置/处理 |
|---|---|---|
| T01 L11、17–19 | `package selfType.packageName`；dependencies→fqn→Seq→distinct→sorted→每行 `import fqn`，合为一个无分组 import 块 | E 文件头；不加入 ActorRef/Effect/ByteString；目标按 shared 冲突解析，保留确定顺序 |
| T02 L12–15 | V 全局替换 State；eventParams 逐字段 `name: signature`，逗号空格相连；initiatedPattern 有 `argsFields.size + 1` 个 `_` | 仅模板准备，不输出 val；禁止变成下标 nextN 或源码字符串业务模型 |
| T03 L21 | 外层 `object E {`，无父类型/构造参数/annotation/self-type | domain.entities；不可改为 Actor singleton |
| T04 L23–30 | State 注释；`sealed trait Z extends CborSerializable`；companion Z 内依次 `case object New`、`Initiated`、`Completed`、`case class Failed(reason: String)`，全部 extends Z；Failed 无默认值 | Z 是 E 的嵌套类型；保留四种不同状态身份 |
| T05 L32–35 | `case class S(id: Option[String] = None, status: Z = Z.New) extends CborSerializable`，严格先 id 后 status | 保留默认值与名义 S；无全局 singleton empty、无业务 args 快照 |
| T06 L37–44 | `def applyEvent(event: V): S = event match`；Initiated 解构 n+1 参数并 `copy(status = Z.Initiated)`；Completed 解构二参并 `copy(status = Z.Completed)`；Failed 解构三参绑定 reason 并 `copy(status = Z.Failed(reason))` | S 实例方法；只有 status 改变，id 始终保留；无守卫、时间调用、持久化/回复/发布、默认 catch-all |
| T07 L47–48 | Events 注释；`sealed trait V extends CborSerializable` | E 内；不是 application Commands 或 Replies |
| T08 L49 | `case class TransactionInitiated(argsFields 按顺序..., timestamp: Long) extends V`；args 的默认值/描述/noteId 不输出，timestamp 无默认值 | event n+1 个参数；不补交易 ID，不注入 ActorRef；空 args 和字段名 timestamp 冲突见 D2 |
| T09 L50 | `case class TransactionCompleted(id: String, timestamp: Long) extends V`；两参数无默认值 | id 不在 applyEvent 中抄入 state |
| T10 L51 | `case class TransactionFailed(id: String, reason: String, timestamp: Long) extends V`；三参数无默认值 | reason 原值入 Failed；不强制非空、不改成统一 generic outcome |
| T11 L52–55 | 闭合 E；返回多行 String，末尾换行 | 最终格式后才指纹/回锚 |

没有额外 type alias、显式 val/var/lazy/implicit、继承泛型/上下界、辅助构造器、方法重载、柯里化参数、初始化 I/O 或 MANUAL 块。case class 的编译器生成成员不冒充模板显式声明。**本 Entity 模板自身没有 `???`/body 槽**；上游 TypeResolver 的 `???`、同文件 Behaviors 的 argsCtorExpr 槽仍是明确债务，不被“本模板纯粹”掩盖。

特别注意：`S()` 的 id 为 None 并不是已证实 bug。经典消费者 [SagaTriggerBehaviorsTemplate.scala L53–60](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/SagaTriggerBehaviorsTemplate.scala#L53-L60) 明确 `emptyState = S(id = Some(id))`，eventHandler 为 `state.applyEvent(event)`；不能擅自把 applyEvent 改为 `copy(id = Some(event.id), ...)`。

## 4. JS 当前可达链与真实银行内容

### 4.1 formal / legacy / family 必须分开

| lane | 已核实际接线及完整固定源码 | 与本族的关系 |
|---|---|---|
| formal 银行服务 | [generate-cli L92–101](../baseline/js/lib/products/generate-cli.mjs#L92-L101) 注册 `scala-cqrs-play-service`；[service generate L16–26、L59–70](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L16-L26) 继承 `createEffectRegistry('2')`；[produce-effect L6–19](../baseline/js/generators/scala-cqrs-application/produce-effect.mjs#L6-L19) 继承 applicationRegistry；[produce L17–33](../baseline/js/generators/scala-cqrs-application/produce.mjs#L17-L33) 的 finite-host-dsl 调 definitions/invocation/adapters/ports/IO/verification | service 仅替换 aggregate/invariant 分支，未替换本 host 路径；不是按目录名推测 |
| formal direct host | [render-invocation-host L8–47](../baseline/js/generators/scala-cqrs-application/render-invocation-host.mjs#L8-L47)：pipeline 时委托；非 direct/pipeline 拒绝；direct 发 Request/Reply/Event/State+actor | 有近似“记录意图/终态”的职责，但事件是 Associated 等，不是经典三事件，模型缺失/职责混装 |
| formal pipeline host | [render-pipeline-invocation L7–50](../baseline/js/generators/scala-cqrs-application/render-pipeline-invocation.mjs#L7-L50)，随后 [wireHostIO L5–23](../baseline/js/generators/scala-cqrs-application/render-host-io.mjs#L5-L23) | H 实际对应此形态；State 加 admitted、事件加 AdmissionGranted、命令加 Admitted 来自后置字符串改写，不能只读第一层 renderer |
| legacy `saga-dsl` | [generate L87–147](../baseline/js/generators/saga-dsl/generate.mjs#L87-L147)：显式 legacy 模式拒绝含 Saga 产品的 canonical，要求完整 legacySagaSpecs，输出 `saga-legacy-source`；[emitLegacySagaSpec L158–225](../baseline/js/generators/saga-dsl/emit.mjs#L158-L225) 发 Args/Format/Context/Definition/Registry，不发本 Entity | 可经 [legacy generate CLI L259–278](../baseline/js/bin/truthsrc.js#L259-L278) 和 [core plan L23–41](../baseline/js/src/core/generate.mjs#L23-L41) 动态 import producer；但不在 formal registeredProductProducer 表中。不是银行正式 Entity 实现 |
| legacy strict-contract | `generate.mjs` L34–84 发 contract/phases/consumption JSON；L145 对 strict-scala 抛 runtimeBlocked | 没有可当本族 `.scala` counterpart 的输出，不能根据 `strict` 文件名称可运行 |
| legacy 历史 companion | [emitStrictHostFiles L1–21](../baseline/js/generators/saga-dsl/emit-strict-host.mjs#L1-L21)、[emitInvocationHostFiles L1–30](../baseline/js/generators/saga-dsl/emit-invocation-host.mjs#L1-L30) 是真实 export，后者要求 split/merge/child 并生产组合 host | 已核 formal/legacy generate 的 import/call 不调用它们；不是所有外部脚本都不可调用的全仓断言。本次只定位其声明和不同角色，没有用它们冒充完整 Entity 金样 |
| family `scala-cqrs-saga-monarch-v1` | [generate L12–37](../baseline/js/generators/scala-cqrs-saga-monarch-v1/generate.mjs#L12-L37) 强制捕获 implementations；[buildModels L35–76、L122–169、L385–398](../baseline/js/generators/scala-cqrs-saga-monarch-v1/build-models.mjs#L35-L76) → [render L12–29](../baseline/js/generators/scala-cqrs-saga-monarch-v1/render.mjs#L12-L29) → [sagaTemplate L5–134](../baseline/js/generators/scala-cqrs-saga-monarch-v1/templates/saga.mjs#L5-L134) | 真实注册家族，不是 legacy；仅 generate-project 接收 live capture。模型要求两参与者、五角色 request、positive Int、拒绝非空 exact decimal，不能代表银行 Money 或经典 Entity 的通用实现 |

family 模型有 values/request/result/support/artifacts，输出 protocol/codecs/saga/runtime/workflow/root 等；其 package 当前为 `.kernel/.glue/.root`（物理 module 和包不能混为一谈）。sagaTemplate 发持有 actor map 的 facade：association.ensure → StrictSagaCoordinator.Start；query Attach；classify 校验完整身份、证据和五种结果；publish/queryPublished 走结果端口。不发本族 `New/Initiated/Completed/Failed` State 与三事件。只能复用命名/结构化建模和 mapped writer 技术，不可把 strict 的 RecoveryRequired/OutcomeUnknown 降格为经典 Failed。

legacy emitter 也不是完全“无代码槽”：`prelude`、`helpers`、`mapReply`、`commandArgs`、preCheck/error 等是来源受校验的显式源码字符串；末尾 `onResult = (_, _) => Seq.empty` 是它的原有输出。不能复制这段默认作为银行触发完成实现。

### 4.2 银行完整文件构造与 RHS 账（H:L1–131）

H 的完整固定字节见 §1.2，不是从 renderer 重跑产生。下面所有区间按实际文件顺序列出，覆盖保留/拆分归属；对不存在的经典映射不填假值。

| H 行/构造 | 当前实际 RHS/副作用内容 | 处理归属 |
|---|---|---|
| 1–12 头部/object | generated header；`package example.bankwealth.application`；imports 顺序为 ActorRef/Behavior、Behaviors、PersistenceId、Effect/EventSourcedBehavior、ByteString、strict 通配、ExecutionContext/Future；`object bank_payment_hostHost` | formal-host assembly owner；改源名须保留稳定业务 ID；Entity 不接收这些 Actor/wire imports |
| 13–20 Commands/Replies | Request；Invoke(parent execution State, typed replyTo)；私有 Observed(strict Reply, replyTo)、Delivered(kind, ok, replyTo)；Reply；Pending/Conflict(reason)、Completed(parent pay_cash_purchaseResult) | 应用协议面，不搬入 domain entity；Completed reply 不等于经典 TransactionCompleted event |
| 21–28 Event/State | Event；Associated(original,args,operation)、IdentityObserved(identity)、ResultIntent(kind)、DeliveryAcknowledged(kind)、AdmissionGranted；私有 Admitted(denial,operation) 又混在这里；State 的七字段/默认见 §5.3 diff | 该宿主的持久关联/投递事实全部保留；不能“清理”为经典 id/status 后丢掉证据 |
| 29 originalInput | `BankPaymentOriginal(state.inputs.operation, fundOrderId, investorAccountId, fundCollectionAccountId, fundCode, amount)`，实参均取 inputs 相应字段 | 应用映射函数，完整父输入 lineage；不要从经典 args 猜替代 |
| 30 invocationArgs | `BankPaymentArgs(investorAccountId, fundOrderId, fundCollectionAccountId, amount)`，均为 inputs 原字段 | 保留顺序和名义类型，不转成普通 String 或同构 alias |
| 31–38 operationIdentity | ByteArrayOutputStream/DataOutputStream；固定 frame tokens `truthsrc-pipeline-invocation-v1`, `bankwealth`, 两处 `bank-cash-payment-v1`/`bank-v1-1`, `pay-cash-purchase`, operation.value, occurrence.value, iteration/absent, chunk/absent；逐 token 非空检查、UTF-8、writeInt(length) 再 write(bytes)，flush；返回 `sha256:`+SHA256 小写十六进制 | 完整顺序/编码/前缀冻结；不能随名称美化改 PID 或 hash |
| 39–45 terminalResults/classify | terminal 集合 succeeded/rejected-before-effects/compensated；Succeeded→Some succeeded；Aborted 按是否存在 Prepare 的 Confirmed evidence 分 compensated/rejected；RecoveryRequired 按 Uncertain 分 outcome-unknown/recovery-required；其余 None | strict 五结果合同；无合法经典三事件映射，D1 |
| 46–49 validStatus | 先 argsBytes 相等；identity.exists 内计算 args 的 SHA256（这里**无** sha256: 前缀），检查 transactionId=state.operation、definitionName、version=1、固定 definitionDigest `sha256:c13f703e76eaee9bfceeff701ecc5f41dd011d6db6890c6820a7faa944538f64`、codec.pin、argsDigest、旧 identity.forall、`Try(StrictSagaProtoConverters.stateToProto(status)).isSuccess` | 应用/技术验证，不移入纯 Entity；不能删末项来缩短表达式 |
| 50 parent | `bank_cash_payment_v1Execution.codec.decode(state.original.toByteArray)` | 恢复父 checkpoint，保留 codec/bytes |
| 51–62 completed | 先 `state.identity.get`、`originalInput(parent(state))`；按 kind：Succeeded(TxId(identity.transactionId))、Rejected、Compensated 三个 parent result；recovery/unknown→Pending；否则 Conflict | 应用回复映射；即使 original 局部未用于后续分支，删除可能移除 decode/异常，不能盲删 |
| 63–69 Delivery | 五方法 succeeded/rejected_before_effects/compensated/recovery_required/outcome_unknown，参数依次名义 FundOrderId destination、各自 FundOrderProtocol.BankPaymentResult* 事件、TransactionIdentity，返回 Future[Boolean] | 原有技术端口，不能换统一 Any/空成功；方法组正文见固定文件 |
| 70–80 apply、局部状态 | apply(persistenceId, coordinator ActorRef, technical Installed) → Behaviors.setup；require 三者有效；implicit ec=context.executionContext；admissionPending=false、admissionReplies=Vector.empty；takeAdmissionReplies 捕获队列→清空→pending=false→spawnAnonymous fanout 收一条 Reply 后停止 | 应用 actor 生命周期；局部可变并非领域模型 |
| 81–94 observe | 未 admitted：追加 replyTo；若未 pending，置 true，恢复 original，Try(HostIO.admit).getOrElse(Future.successful(false))，pipeToSelf 映射 Admitted(None 或错误文案, operation)；return。已 admitted：spawn 单次 reply adapter；有 identity→Attach，无→Start(operation,args,adapter) | 先 admission 再 coordinator；不可把 false 当完成成功 |
| 95–100 deliver | 恢复 original、取 identity；`HostIO.deliver(kind, original, identity, technical): Future[Boolean]`，pipeToSelf 成 Delivered(kind,value.getOrElse(false),replyTo) | 保留技术失败→未确认语义 |
| 101–109 Invoke handler | EventSourcedBehavior(PersistenceId.ofUniqueId(persistenceId),State(),...); 计算完整 original bytes、args codec bytes、operation；旧 operation/bytes 不符→none 后 Conflict；已 delivered terminal→none 后 completed；已关联→none 后 observe；首次→persist Associated 后 observe 新 state | 不能用 classical Initiated 代替 Associated 丢数据；none 分支无 persist |
| 110–115 Observed Status | invalidStatus→none 后 Conflict；否则 classify，若已有 terminal 则 next=None，否则过滤重复结果；首次 identity 事件加 next ResultIntent；persist(events) 后按新 state：未 delivered 的 result→deliver，已 delivered→completed，无 result→Pending | 保留先事件应用后读取 state；这不是 CommandHelper.replyWith 的等价证据 |
| 116–118 Admitted | None 且 operation 匹配、非空且未 admitted→persist AdmissionGranted，再 observe(s,takeAdmissionReplies())；Some reason 匹配未 admitted→none 后 fanout Pending；其它→none | admission 事实/队列处理不能遗漏 |
| 119–122 其它命令 | coordinator Denied→none/Pending；ConflictingIdentity→none/Conflict；Delivered(kind,true) 且当前 result 相符→persist DeliveryAcknowledged 后 completed；其它 Delivered→none/Pending 未确认 | 回复与持久化顺序保留；不能把传输失败视作业务 Failed |
| 123–129 event fold | Associated→copy original/args/operation；IdentityObserved→identity=Some；ResultIntent→result=Some,delivered=false；DeliveryAcknowledged→delivered=true；AdmissionGranted→admitted=true；其余字段由 copy 保留 | 当前宿主 event fold 的五分支；经典三分支不是其缩写 |
| 130–131 | 关闭 setup 与 object | 不隐藏其它本文件初始化逻辑 |

### 4.3 M/B/T/产物四层差距

- **Model**：formal 在 renderer 中读取 reference-layout/saga-host-contract/execution/runtime products；没有本族五字段模型。family 虽有真实结构模型，却是另一个八产品/strict workflow 合同。
- **Builder**：formal 包名、lowercase underscore stem、映射、身份 token、status 分支、deps 都与源码串接交织；B.buildEntity 的类型依赖/Status/事件 arity 无独立对等阶段。不能把“把 state 字符串搬到新文件”算 MBT。
- **Template**：formal 把应用命令/回复、持久关联事件/state、effect actor 装在一个 object，再 `wireHostIO` 文本替换；需停止在已渲染代码中注入新字段/事件/分支，但由唯一 host owner 完成，不由 Entity 分片并行改写同文件。
- **产物**：银行 H 有真实运行所需额外内容，当前并无 `<Base>TransactionEntity` 同输入文件。目标纯 Entity 的引入不能证明 host 业务等价。仅能做结构性对照，非同输入字节比较。

## 5. approved-target 与真实 minus/plus

### 5.1 本族完整目标文件体（参数化，不伪造银行实例）

适用条件：经典 args 非空、类型已准入、标准 `net.imadz.common.CborSerializable` 且无简名冲突；符号按共享命名已明确，嵌套拥有者已登记。以下保留原始 State/Status/Event 语义。变量均来自 §3 五字段 Model/T02，没有 `???` 或人工补业务返回值。`$imports` 是目标 resolver 的确定、去重、完整嵌套类型依赖输出；`$eventParams` 与 `$initiatedPattern` 遵循 §3 的有序规则，长字段列表由 formatter 逐行排版，不改变字段内容。

```scala
package ${selfType.packageName}

$imports

object ${selfType.name} {

  // --- State（极简：只记身份与状态；业务意图在事件里）---
  sealed trait ${statusType.name} extends CborSerializable
  object ${statusType.name} {
    case object New extends ${statusType.name}
    case object Initiated extends ${statusType.name}
    case object Completed extends ${statusType.name}
    case class Failed(reason: String) extends ${statusType.name}
  }

  case class ${stateType.name}(
    id: Option[String] = None,
    status: ${statusType.name} = ${statusType.name}.New
  ) extends CborSerializable {

    def applyEvent(event: $eventTypeName): ${stateType.name} = event match {
      case TransactionInitiated($initiatedPattern) =>
        copy(status = ${statusType.name}.Initiated)
      case TransactionCompleted(_, _) =>
        copy(status = ${statusType.name}.Completed)
      case TransactionFailed(_, reason, _) =>
        copy(status = ${statusType.name}.Failed(reason))
    }
  }

  // --- Events ---
  sealed trait $eventTypeName extends CborSerializable
  case class TransactionInitiated($eventParams, timestamp: Long) extends $eventTypeName
  case class TransactionCompleted(id: String, timestamp: Long) extends $eventTypeName
  case class TransactionFailed(id: String, reason: String, timestamp: Long) extends $eventTypeName
}
```

这里的 `TransactionFailed` 是已发生失败事实，`applyEvent` 消费它不等于命令失败分支可以 persist。Entity 内无回复方法。没有创建具体银行 args/状态设计；不能把该参数化全文宣称为取得了第三份可执行输出字节。

### 5.2 raw-scala → approved-target 的有限差异

以下是标准无冲突 marker 场景的真实源码构造差异，其它 body 均保持 §3.3。imports 中原有该 marker，故不扩大 serializer 绑定。Id 是否按“无使用”从依赖删除仍待 D4，不在此默认删去。

```diff
--- raw-scala/SagaTriggerEntityTemplate.scala
+++ approved-target/SagaTriggerEntityTemplate.scala
@@ -21,7 +21,7 @@
 object ${selfType.name} {
 
   // --- State（极简：只记身份与状态；业务意图在事件里）---
-  sealed trait ${statusType.name} extends _root_.net.imadz.common.CborSerializable
+  sealed trait ${statusType.name} extends CborSerializable
   object ${statusType.name} {
     case object New extends ${statusType.name}
     case object Initiated extends ${statusType.name}
@@ -32,7 +32,7 @@
   case class ${stateType.name}(
     id: Option[String] = None,
     status: ${statusType.name} = ${statusType.name}.New
-  ) extends _root_.net.imadz.common.CborSerializable {
+  ) extends CborSerializable {
 
     def applyEvent(event: $eventTypeName): ${stateType.name} = event match {
       case TransactionInitiated($initiatedPattern) =>
@@ -45,7 +45,7 @@
   }
 
   // --- Events ---
-  sealed trait $eventTypeName extends _root_.net.imadz.common.CborSerializable
+  sealed trait $eventTypeName extends CborSerializable
   case class TransactionInitiated($eventParams, timestamp: Long) extends $eventTypeName
   case class TransactionCompleted(id: String, timestamp: Long) extends $eventTypeName
   case class TransactionFailed(id: String, reason: String, timestamp: Long) extends $eventTypeName
```

其它显式差異：①统一 PascalCase/type 和 lowerCamelCase/member、禁止重复后缀，但稳定 ID 不变；②Builder 收集嵌套依赖，保留 TypeRef 的真实名义类型和 owner；③长构造参数按字段逐行，排版不改默认值/参数顺序；④普通方法 CC≤5 是目标 **not-measured**。非标准 frameworkPackage/冲突别名、空 args、来源字段如何补回不在此凭空决定。

### 5.3 actual-js → approved-target：只对可保真的片段给补丁

**结构性对照，非同输入字节比较。** 以下 minus 是 H:L23–29 的真实内容，plus 是对宿主保留字段的已明确逐行排版目标；它不是“用七字段 Host.State 替代经典 TransactionState”的实现。真实 classic 目标全文在 §5.1，缺同输入对应，不伪造银行三事件。此 diff 不能直接用于生产文件。

```diff
--- actual-js/app/example/bankwealth/application/bank_payment_hostHost.scala
+++ approved-target/retained-host-state-format.scala
@@ -23,7 +23,15 @@
   final case class IdentityObserved(identity: TransactionIdentity) extends Event
   final case class ResultIntent(kind: String) extends Event
   final case class DeliveryAcknowledged(kind: String) extends Event
   case object AdmissionGranted extends Event
   private final case class Admitted(denial: Option[String], operation: String) extends Request
-  final case class State(original: ByteString = ByteString.EMPTY, args: ByteString = ByteString.EMPTY, operation: String = "", identity: Option[TransactionIdentity] = None, result: Option[String] = None, delivered: Boolean = false, admitted: Boolean = false)
+  final case class State(
+    original: ByteString = ByteString.EMPTY,
+    args: ByteString = ByteString.EMPTY,
+    operation: String = "",
+    identity: Option[TransactionIdentity] = None,
+    result: Option[String] = None,
+    delivered: Boolean = false,
+    admitted: Boolean = false
+  )
   def originalInput(state: bank_cash_payment_v1Execution.State): example.bankwealth.domain.values.BankPaymentOriginal = example.bankwealth.domain.values.BankPaymentOriginal(state.inputs.operation, state.inputs.fundOrderId, state.inputs.investorAccountId, state.inputs.fundCollectionAccountId, state.inputs.fundCode, state.inputs.amount)
```

该局部补丁没有改掉原文件全部坏味道：命令/事件混排、下划线命名、HostHost、长 FQN、整体 actor 分发仍需 host/protocol owner 的独立规格。特别不能把 minus 中的 Associated/IdentityObserved/ResultIntent/DeliveryAcknowledged/AdmissionGranted 整组删掉，再加三个 classical 事件就称对齐。

### 5.4 curated reference 的单独定位

C 的完整 29 行包含：package、Id/Money imports；CreditBalanceEntity；formatter 注释；四字段 CreditBalanceState；`empty(userId)` 以四个构造实参（后三个 Map.empty）初始化；七种余额/预留/入账事件；`CreditBalanceEventHandler = (CreditBalanceState, CreditBalanceEvent) => CreditBalanceState`。`BalanceChanged` 的 timestamp 默认 `System.currentTimeMillis()` 是该人工参考的事实，但 **T 的 timestamp 无默认**，不予移入本族。C 没有本族 Status/经典三事件/applyEvent，既不能替本族验收，也不能要求本族照抄其 handler alias 或金额逻辑。T 注释提到 FabSagaTransactionEntity 只是引用线索；本次未读取该可变文件，不把它内容作为事实。

## 6. 胶水、保护面与语义未决

| 完整符号/类型 | 所需接口、来源与语义 | 本项边界 |
|---|---|---|
| `net.imadz.common.CborSerializable` | [固定 common 源码 L1–5](../baseline/common/src/main/scala/net/imadz/common/CborSerializable.scala#L1-L5) 是空 marker trait；用于 Z/S/V 三个 extends | 不代表 serialization 配置完整、PB 已有 converter 或消费 JAR 可用 |
| `net.imadz.common.CommonTypes.Id` | [CommonTypes.scala L9](../baseline/common/src/main/scala/net/imadz/common/CommonTypes.scala#L9) 为 UUID alias；标准 Context 的 Id 解析来源；Entity 当前不使用它作 state id | 不把原 `Option[String]` 改为 Option[Id]；不因同构 alias 改其它名义类型 |
| `scala.Option`、`scala.None`、`java.lang.String`、`scala.Long` | State 默认/事件字段；实际 args 另按已解析 TypeRef 导入 | 不生成时钟；timestamp 由 application 构造事件时提供 |
| `<base>.domain.entities.<Base>TransactionEntity.<State/Status/Event>` | companion 中嵌套 nominal types，`S.applyEvent(V): S` | Behaviors 持久化，再 eventHandler 调本方法；Entity 不调用 actor/repository |
| `net.imadz.infra.saga.SagaTransactionCoordinator` / `.StartSaga` / `.TransactionResult` | 经典消费者 [Behaviors T L65–108](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/SagaTriggerBehaviorsTemplate.scala#L65-L108) 先 persist 意图再 ask StartSaga；终态 persist 后 thenReply | 不属于 Entity dependencies；不要与 strict coordinator 混称同接口 |
| `net.imadz.infra.saga.strict.StrictSagaCoordinator` / `TransactionIdentity` / `StrictState` | formal/family host 的 Start/Attach/Status、完整身份和终态证据 | strict result 需要五态，不能将 nonterminal unknown 判为经典业务失败 |
| `net.imadz.common.application.CommandHandlerReplyingBehavior.CommandHelper` / `runReplyingPolicy` | 目标应用胶水的三个方法是 `toParam`、`createFailureReply`、`createSuccessReply`，位置 application.aggregates.behaviors | 本 Entity 不生成 Helper、replyTo、ActorRef；应用 Actor command 按明确回复合同条件性 typed replyTo，纯 args/events 不加 |

依赖坐标证据：[BC scaffold/build.sbt L127–147](../baseline/bc/scaffold/build.sbt#L127-L147) 默认 `net.imadz:common-core_2.13:0.2`、`net.imadz:saga-core_2.13:0.2` 等，且 scaffold 会复制 common 源码；[formal requireApplicationArtifact L4–8](../baseline/js/generators/scala-cqrs-application/generate.mjs#L4-L8) 则要求 `net.imadz:saga-core_2.13:0.3.0`、SHA `550fbd5cdb18a50d71a62f8f743d59f24ac1daa03f0aeb07c23c8355c2c0d862`。二者不是接口兼容证明。本次不读取/运行 JAR，不 publishLocal，不升级 runtime，不能据 sibling 源码称消费工件已有经典 API。

**失败与成功语义分层**：目标普通 command Helper 的业务拒绝不得 persist；成功先 persist/applyEvent，再 thenReply 读更新状态；`replyWith` 不增加发布，`replyWithAndPublish` 增加发布，不可互换。经典 Saga 终态通知是“记录已经发生的失败”的命令，因此会 persist TransactionFailed；这不构成对“业务拒绝不持久化”的例外泛化。原始经典 Behaviors 的 timeout→`TransactionResult(false, null, "start failed")` 与 tracing `Nil` 是它自己的未完成/简化槽，不可当 strict outcome unknown 的正确业务映射，也不由本 Entity 制造确认成功。

禁止改动：PB field number/message identity、PID、serializer ID/manifest/绑定范围、业务/Saga/definition/codec identity、哈希 frame 和前缀、名义类型、金额/overflow（没有 `addExact → +` 许可）。新布局不能留 domain 旧壳伪装迁移；也不能为了新 Entity 删除宿主恢复证据。

## 7. 后续 JS 实施写集合与唯一组装权

以下全是**下一阶段 proposed 工作面**，本次未创建或改动任何生产路径。先裁定 D1，防止错误把 classic 与 strict 作为同一个 product version。

### 7.1 Entity 独占 proposed 文件

前缀 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/`。

| proposed 路径 | 职责/明确接口要求 |
|---|---|
| `generators/scala-cqrs-saga-trigger-v1/models/entity.mjs` | 五字段 Entity 结构、FieldDef/TypeRef 引用和来源 sidecar；不得使用全文件 content 字段或 Any dispatcher |
| `generators/scala-cqrs-saga-trigger-v1/build-entity-model.mjs` | proposed `buildSagaTriggerEntityModel(meta, context)`；落实 B1–B7；context 由 shared owner 提供布局/类型/命名，返回模型或有源位置诊断，不写盘 |
| `generators/scala-cqrs-saga-trigger-v1/templates/entity.mjs` | proposed `sagaTriggerEntityTemplate(model, out)`；按 T01–T11 和批准差异 append；语法字符串限 Template；全字段 arity/默认/RHS 精确 |
| `test/codegen-parity/saga-trigger-entity.test.mjs` | proposed 结构模型、字段顺序、n+1 pattern、完整文件及纯 fold fixture；不得把此路径说成现成 test/spec |

### 7.2 共享文件、调用方、冲突与退役

唯一组装角色名定为 **`saga-trigger-family-integration`**（角色，不冒充已指派的某位并行 agent）。该 owner 唯一创建同 proposed 目录的 `generate.mjs`、`render.mjs`、`generator.json`，组装 Protocol/Entity/Root/Behaviors 四个文件和互相依赖；Entity owner 只供模型与模板，不各自拼一个重复的物理 Entity 文件。

- 公共注册/选择：`lib/products/generate-cli.mjs`、`lib/project/derive.mjs`、`lib/project/cli.mjs` 及产品 schema/version 由集成者按 D1 确认后接入；不复活 legacy 来绕 formal admission。当前 proposed generator **不存在也未注册**，不能从现有 CLI 成功产出本族。
- 共享命名/类型/布局：优先复用 [lib/scala-target/naming.mjs L41–118](../baseline/js/lib/scala-target/naming.mjs#L41-L118) 的 `resolveName`、`resolveNameSet`、`resolveArtifactPath`；后者受 profile.module.sourceRoot 约束，不可直接假定支持 BC single app。`lib/scala-target/model.mjs`、`profiles.mjs` 和 TypeRef/import 适配由 shared-layout-types owner 固定接口，本次未把未实读实现描述成可用等价物。
- formal 复合文件唯一 owner 是 **`formal-host-assembly`**：`generators/scala-cqrs-application/render-invocation-host.mjs`、`render-pipeline-invocation.mjs`、`render-host-io.mjs`、`produce.mjs` 及 play-service 继承接线。若 D1 要从现宿主分离纯实体，该 owner 先保字节切分，再统一替换 State/Event/fold 片段与所有调用，不允许多个制品同时文本替换同一 `Host.scala`。
- HostIO 的 `wireHostIO` 退役条件：admitted State 字段、AdmissionGranted、Admitted、admission 队列、分支和 event fold 已成为结构模型并有完整文件证据；不能只移除函数调用。
- serializers/PB/adapters owner 保持现有 host wire layout；在明确新名义协议/serializer 对照与旧 journal 策略前，**旧 host Event/State 不退役**。classic Entity 是 missing counterpart，不自动意味着旧 host 文件应删除。
- factory/root/behaviors/import consumers 必须引用 Entity object 内的类型；`stateType.packageName + "." + stateType.name` 不能当嵌套 FQN；不留下错误旧 domain forwarding 壳。
- writer/registry/ledger/anchors 的写入、owned outputs 退役/冲突报告由公共集成者单点负责；格式和名称最终稳定后再计算指纹及映射 span。不加新的作者 `@knowledge` 字段，不能伪造 M.noteIds。
- family `scala-cqrs-saga-monarch-v1` 的 strict 桥、身份 codec、结果投递模型不由本族直接 replace；若全局布局整改涉及它，另由 family owner 迁移且保留 ABI。`replyWithAndPublish` 不是迁移捷径。

`dependsOn`：`shared-layout-types`、`saga-trigger-protocol`、`saga-trigger-root`、`saga-trigger-behaviors`、`saga-definition`、`formal-host-assembly`、`shared-writer-anchors`、`serializer-identity-contract`。这表示接口/验收闭包，不宣称其它文件已完成。

## 8. Fixtures、公开 CLI 命令形状及副作用

### 8.1 最小 fixture 规格（均 proposed，未创建）

隔离输入根建议 `/Users/zhongdj/Workspaces/mad-polaris/codegen-parity-fixtures/saga-trigger-entity`，不放业务真源树，也不从银行散文猜产品。独立 output 根建议 `/Users/zhongdj/Workspaces/mad-polaris/codegen-parity-output/saga-trigger-entity`，与工具/fixture/共享应用互不包含。

| fixture | 必须固定的输入与预期 |
|---|---|
| classic-minimal | 显式 `DispatchSagaTransactor`、context=`parity`、args 顺序 `requestId: String`, `quantity: Int`；这些是**测试设计**，不是已有银行业务。BC/JS adapter 同时固定相同语义及其它家族必需元数据；预期本文件 `app/net/imadz/parity/domain/entities/DispatchTransactionEntity.scala`，内有 DispatchTransactionState/DispatchStatus/DispatchTransactionEvent；Initiated 解构 3 个通配 |
| missing/empty args | None 原始抛异常；空字段原始缺陷保留证据，目标按 D2 决定 reject 或 timestamp-only；不得先设为成功 |
| imports/nominal | args 含跨包 VO、`Option[VO]`、Tuple/Map；相同简名的两个包、字段名 timestamp、keywords；核 signature/owner/递归 deps/诊断；不合并名义类型 |
| naming | 正常后缀、中间出现 SagaTransactor、name 含 State、重复后缀、大小写文件碰撞；区分 raw replace 与批准 target；稳定 ID 完全不动 |
| pure-fold | New/Initiated/Completed/Failed 各原状态，三事件逐个应用；id 为 None 和 Some 均保留，reason 原值保留，timestamp/args 不进 State；无 I/O/时钟 |
| formal-retained-host | 保留 H 的完整七字段、五事件、五 fold，以及严格终态/关联/投递/admission 事实；检查 proposed Entity 不替换这些事实。仅结构/兼容性 fixture，不称与 classic 同输入 |
| variants/anchors | 无 Saga、两个 Saga、single/multi、scope skip；同输入两次稳定，改一个 args 字段只能影响合理局部与 n+1 pattern，锚随最终字节更新 |

需要先提供 BC SystemMetadata registry fixture 或确证 formal file adapter 会产出 `app.sagas` 的等价入口；当前未取得此桥接证据。不能直接把 JS eight-products family 输入套给 Scala classic。

### 8.2 后续可用 CLI 形状（本次全部未运行）

**BC**：已实读 CodegenMain 接受 JVM properties，不存在本项专用 `--artifact saga-trigger-entity`。在 `/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen` 工作目录运行的 scoped 形状为：

```bash
sbt -Dcodegen.systemFile=/Users/zhongdj/Workspaces/mad-polaris/codegen-parity-fixtures/saga-trigger-entity/bc-canonical.json \
  -Dcodegen.systemBindings=/Users/zhongdj/Workspaces/mad-polaris/codegen-parity-fixtures/saga-trigger-entity/bc-bindings.json \
  -Dcodegen.targetDir=/Users/zhongdj/Workspaces/mad-polaris/codegen-parity-output/saga-trigger-entity/raw-scala \
  "runMain net.imadz.codegen.CodegenMain"
```

此形状 flags 已存在，**两个 fixture 文件和 classic-adapter 能力尚待 D7**。若选择 registry `-Dcodegen.system=<显式已登记的最小 system>`，必须替代而非叠加 systemFile/systemBindings；不使用默认 Examples/`../banking-app`。该命令会启动 sbt/JVM、可能编译和触发依赖解析/缓存写、复制 scaffold、生成整个最小系统闭包而非仅 Entity、写目标及配置的 ledger；strict 路径还可能写 Saga 锚索引。还需固定版本头策略及本地依赖供给，不能以隔离 out 声称无旁路写入；本阶段不授权运行。

**JS formal**：现有服务链的有限输入观察入口：

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /Users/zhongdj/Workspaces/mad-polaris/codegen-parity-fixtures/saga-trigger-entity/formal-request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-play-service \
  --out /Users/zhongdj/Workspaces/mad-polaris/codegen-parity-output/saga-trigger-entity/actual-js \
  --options-json /Users/zhongdj/Workspaces/mad-polaris/codegen-parity-fixtures/saga-trigger-entity/formal-options.json \
  --plan
```

当前该选择只会走现有正式 host，不会产出 classic Entity。四个路径 flags 都必需，`--options-json` 是文件而非内联 JSON。未来只有 proposed producer `.../generators/scala-cqrs-saga-trigger-v1` 已注册且输入版本获准，才能用它替换 `--generator` 并取得本族产物。不得假造现成 producer 或额外 scope flag。

[generate-cli L66–88、L110–145](../baseline/js/lib/products/generate-cli.mjs#L66-L88) 的已知副作用界面：读取 request/options/manifest，编译产品并构建 plan；服务 profile 要读并核对本地 frozen runtime JAR、必要 Monarch JAR，检查外置源目录；`--plan` 不调用 applyEntries。移除 `--plan` 才应用目标文件及 `truthsrc.ledger.json`、`anchors.json`，依据 [applyEntries L246–268](../baseline/js/src/core/generate.mjs#L246-L268)；此入口没有 projectGraph 的持久化调用。不能因此声称普通 CLI plan 证明编译/业务正确。该次规格不执行这些读取 JAR 的命令。

**JS family**：`generate-products` 对 `scala-cqrs-saga-monarch-v1` 连 `--plan` 都会报 `SAGA_MONARCH_CAPTURE_REQUIRED`。实际公开命令形状是：

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-project \
  --project /Users/zhongdj/Workspaces/mad-polaris/codegen-parity-fixtures/saga-trigger-entity/family/truthsrc.project.json \
  --out /Users/zhongdj/Workspaces/mad-polaris/codegen-parity-output/saga-trigger-entity/family-js \
  --plan
```

project config 必须选择真实 family generator 和其完整八产品及 implementations；不是把 classic fixture 改个 generator 名就可运行。已知 [project/cli L91–144、L159–225](../baseline/js/lib/project/cli.mjs#L159-L225)：capture 阶段会 validate/roundtrip/compile author tree、读取 documents/tool inventory/外置实现；plan 前仍执行 `verifyImplementationSources`；plan 不开 SQLite store，但委托 verifier 的完整传递副作用尚未在本项封闭，D7。非 plan 则创建/更新 project graph SQLite、应用源文件、ledger/anchors 和 `.truthsrc/{canonical,request,compiled,inputs}.json`，发布 project anchors。**新 out 不隔离 project 旁 graph 或工具/临时目录**。本次不调用。

legacy `generate` 的能力定位仅见 §4.1，不另建议用它复活本族。无 test/typecheck/compile/runtime 命令被执行；未来测试 runner、依赖缓存和行为 suite 由实现者在 fixture 真正存在后明确，本规格不猜现成 spec 名。

## 9. 验收义务与精确未决项

### 9.1 后续验收（当前均未执行）

1. 同等语义输入先经双端显式 adapter 对账，再运行真正 CLI；分别保存 raw-scala、approved-target、actual-js **完整文件集合**，记录输入/输出 SHA 与有限差异白名单。不得 normalize 所有空白后称等价。
2. 对 M 五字段和继承、B1–B7、T01–T11，以及共享类型/命名债务逐项核 RHS；包含 n+1 arity、字段默认值缺省、失败 reason、id 不变、没有隐式时钟/ActorRef。
3. fold 是纯测试；与 Behaviors 集成另查持久化→应用事件→回复顺序；普通 Helper 拒绝不 persist、成功 thenReply 用新 state、回复次数与无意外发布。Saga 已发生失败事实的记录与业务拒绝区别必须有真实测试。
4. named types/import/三层布局/参数逐行、CC 目标≤5（6–10逐方法说明，>10重构或逐方法批准）、嵌套目标≤2；当前 complexity=`not-measured`，不靠 String/Any dispatcher、平均数或删 branch 压分。
5. 旧 strict host 的 PB/PID/serializer/codec/hash/结果状态保持；没有兼容方案时不触碰旧 journal。持久化/recovery/真实 jar ABI 验证要独立证据，源码读取不够。
6. 同输入两次字节稳定、局部变更及 source→新文件/成员的锚回查；缺 noteId 的来源不能人工伪造。owned 文件冲突要报告，不手动覆盖/删除生成目录。
7. 预算建议：生成/内容比对 5 分钟、批末一次局部 JVM/行为闭包 15 分钟，超过停止并返回已得信息；是未来调度预算，不是性能实测。本项不发起全银行或全仓 runtime 验收。

### 9.2 openDecisions

| ID | 具体决策/缺口 | 决策前必须保持 |
|---|---|---|
| D1 `classic-vs-strict-counterpart` | JS 新增独立 classic product/producer，还是对正式 host 拆纯实体并保留额外 durable model？严格五结果、关联/投递/admission 与经典三事件没有现成同义映射；family 也不是相同输入 | 状态 missing-counterpart；不删 H 七字段/五事件，不把 unknown/recovery 当 Failed，不称已接线 |
| D2 `args-admission` | 空 args 是合法 timestamp-only 意图还是拒绝？字段名 timestamp、重复 args、名称可作为 Scala 参数等由哪一准入层判定？raw B 未处理，T 空集逗号有缺陷 | 不静默补参数/丢字段；保留 raw 缺陷证据，禁止生成貌似成功的空模型 |
| D3 `source-name-vs-stable-id` | 全局 replace SagaTransactor/State 与 shared suffix resolver 行为不一致；嵌套状态/事件 TypeRef owner 及多个 Saga 同名事件如何登记 | 仅正常示例可按现有目标；异常名需显式绑定/拒绝，稳定 ID、PID、definition/codec 不改 |
| D4 `imports-marker-and-supply` | marker 硬编码与 frameworkPackage 是否只支持标准 net.imadz？Id 未使用是否从 deps/ledger 一并删？递归 imports、同名碰撞策略和消费 common JAR/scaffold 实际来源如何统一？ | 不修改 marker serializer 语义，不把 Id→String 视为通用 alias 合并，不宣称库接口已可用 |
| D5 `state-lifecycle` | raw applyEvent 可把终态再次变 Initiated，且从不采用 event.id；目标是否保持由 actor 初始 id + command guard 控生命周期，还是需要额外领域转换规则？ | 默认忠实保留三分支/id 不变；不得擅加 terminal guard、id 更新或幂等成功 |
| D6 `physical-profile-and-owner` | multiProject raw 对本 kind fallback app，目标是否将其明确归 kernel 物理 module？四件家族、symbol registry、serializer consumers 与唯一 assembly owner 的接口需确认 | 业务包仍仅 domain/application/infrastructure，不复制 family 的 .kernel/.glue/.root 包；不只改路径漏调用方 |
| D7 `same-input-cli-fixture-and-effects` | 尚无双端等价 classic fixture、formal file adapter 产出 app.sagas 的证明或本族 registered producer；未来命令的版本头/离线供给/委托 verifier 传递副作用与准确行为 runner 需封闭 | 只保留真实 CLI flags 的形状，不运行默认大系统，不声称 plan 全链零副作用，不伪造输出/测试通过 |

文档落盘只说明本族观察内容、差距和决策面已独立保存；不把缺少同输入产物或上述决定隐藏成实现完成。
