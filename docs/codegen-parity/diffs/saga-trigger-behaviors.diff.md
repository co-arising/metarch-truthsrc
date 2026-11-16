# saga-trigger-behaviors：触发、终态回灌与回复的内容规格

## 1. 身份、范围与证据边界

- artifact id / group：`saga-trigger-behaviors`，传统清单 ordinal **21**。
- 状态：**`decision-required`**。已观察到的 MBT 内容在下文逐项登记；经典 `StartSaga` 触发行为在所核正式 JS 路径中为 **`missing-counterpart`**，但严格 Saga host 的相近职责确实存在，不能写成“JS 没有 Saga 行为”。
- 固定 JS HEAD：`bf104e16ab82ef39d7fa416d0997907d18a815ad`；BC HEAD：`cc335eb1e0d0fae17bf092fd61b126040196ea70`。实际字节以 [baseline/index.json](../baseline/index.json) 为准，不能用 HEAD 替代工作树字节。
- 这是源码内容检视，不是运行验证。没有执行生成、测试、typecheck、编译、服务或依赖下载；没有改真源、生产源码、生成目录、catalog、ledger、anchor 或 Git。仅保存本 diff 与对应 detail；不覆盖前 15 份 diff，也不改其他人的文件。
- 本文引用源码均为冻结副本。没有追加读取未入 baseline 的生产源码，因此 `extraSources=[]`。作者合同、布局标准、批准计划和仓库指引是本阶段指令，不是新的生产基准。

### 四种材料不能混签

| 材料 | 可取得内容 | 本文处理 |
|---|---|---|
| `raw-scala` | 实际 Model / Builder / Template 全文；下附模板全文 | 模板参数化生成体，不是本次 CLI 生成文件；保留源码字符串、空 tracing、`null` 及边界缺口 |
| `approved-target` | 用户三层布局、命名/import、OO + Plain FP、显式回复与身份保护约束，叠加下列已确定结构 | 未形成同输入完整目标文件；D1–D8 未裁定的 API/行为不得填写成实现。全文模板和逐构造目标表共同界定规格，不伪造 target 成功样例 |
| `actual-js` | 银行现存 `bank_payment_hostHost.scala`、`bank_cash_payment_v1Execution.scala` 的完整冻结字节 | 严格 Saga / Monarch 的结构性对照，**非同输入字节比较** |
| curated reference | `MoneyTransferSagaDefinition.scala` 与 coordinator / codec 固定源码 | 人工完成的定义及接口参考，不是本制品的新生成输出；冻结索引没有 `*SagaTransactorBehaviors`、`*SagaTransactorProtocol`、`*TransactionEntity` 对应人工文件。仅说明该索引范围，不推断其他仓库不存在 |

### 主要完整固定来源与指纹

以下文件均已实际阅读；前三项为整个文件。9 个列示副本的 bytes / SHA 与 index 进行了只读核对，一致；这不是生成器验收。

| 键 | 完整固定文件 | bytes | SHA-256 |
|---|---|---:|---|
| M | [SagaTriggerModels.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/transactor/SagaTriggerModels.scala#L1-L71) | 2982 | `c7331985fb13f32e0f8104fed9110893703eece551f03c7da031796a073db2f1` |
| B | [SagaTriggerBuilder.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/transactor/SagaTriggerBuilder.scala#L1-L158) | 8368 | `43876918912c7a5c97e18a647821f1467c74f6ee0ed058906de4d76a25cfa664` |
| T | [SagaTriggerBehaviorsTemplate.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/SagaTriggerBehaviorsTemplate.scala#L1-L113) | 5876 | `f478b038b386b60cd53c3cc42d0c683e92aefc57425a5830b88ef308ccb9c0e7` |
| JP | [render-pipeline-invocation.mjs](../baseline/js/generators/scala-cqrs-application/render-pipeline-invocation.mjs#L1-L50) | 13592 | `772e29795c4513b530272d6642776042ab785a741e5b1b4be02a6aac541943ed` |
| JD | [render-invocation-host.mjs](../baseline/js/generators/scala-cqrs-application/render-invocation-host.mjs#L1-L47) | 12868 | `72fb4b6e3e350f00c1b84d47e3f863b56572f91eae49a314c2487a96e28d808d` |
| JE | [render-invocation-execution.mjs](../baseline/js/generators/scala-cqrs-application/render-invocation-execution.mjs#L1-L56) | 10817 | `8e8ec58b3f36a9cb20f5a28369de47ecdaf85f79c1ca1761a9385337f289d9cf` |
| AH | [bank_payment_hostHost.scala](../baseline/actual-js/app/example/bankwealth/application/bank_payment_hostHost.scala#L1-L131) | 11966 | `e74f76532abdadc384d4fda34cad3d8896d34898c5996b3e3fa85758afa986c4` |
| AE | [bank_cash_payment_v1Execution.scala](../baseline/actual-js/app/example/bankwealth/application/bank_cash_payment_v1Execution.scala#L1-L67) | 8367 | `2e8d40cc640f32e56daae32250ff27a8d630f776d76ac3b8fb57029fe8258c0d` |
| C | [MoneyTransferSagaDefinition.scala](../baseline/curated-scala/net/imadz/application/services/transactor/MoneyTransferSagaDefinition.scala#L1-L71) | 3221 | `4b5bb1370d0fcb90a6a4eb2392fce7062b4aa70df77b52082bcc2042b7da626c` |

下文 M/B/T、AH/AE 等行号均指这些固定文件，不指可变工作副本。

## 2. 调度、基数、路径与边界

[CodegenMain.run:183–241](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L183-L241) 的 `semanticProductsFile` 先走独立 products 分支并返回；本项依据另一条传统 `prepare → generate → runCommon` 链。[runCommon:192–220](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L192-L220) 建 ctx，再生成 domain/application/infrastructure/interface。

[generateApplicationLayer:735–770](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L735-L770) 对 `app.sagas` **逐项**先生成 participants、definition，然后 protocol、entity、root，最后 `SagaTriggerBuilder.buildBehaviors(meta, ctx)` 与 `SagaTriggerBehaviorsTemplate.generate`。不是根据目录名推测可达性，也不是 optional strict host 支路。

| 变体/条件 | 尝试生成数 | 写入状态与路径 |
|---|---:|---|
| `app.sagas` 有 N 项，前置 builder 成功 | N | 每 Saga 一个 `<Base>SagaTransactorBehaviors.scala`；成员 trigger case 数等于非 `Update*` 命令数 |
| 无 Saga | 0 | suppressed，不创建空行为壳 |
| `meta.args=None` | 当前项抛异常 | `Saga '<name>' lacks args (v3)`；不是零字段 args，也不是隐式禁用 Saga |
| scope 不含本 attribution | 0 个本项源码写入 | 模型和源码先已计算；writer 先记账后 return。不能把 scope 当不执行 builder 的门 |
| 多项目模式 | 仍每 Saga 一个 | 当前 `targetModuleOf` 未登记 `saga-trigger-behaviors`，实际 fallback 是 `app/...`，**不是**自动进 `modules/glue` |

布局权威：[PackageLayout:54–65](../baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala#L54-L65)，writer [331–424](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L331-L424)。令 `baseName=meta.name.replace("SagaTransactor", "")`，`base` 为 ctx.layout.base：

- 单工程：`<target>/app/<base.replace('.', '/')>/application/services/transactor/behaviors/<baseName>SagaTransactorBehaviors.scala`。
- 当前 BC multi：相同 `app/...` fallback；ledger 的一般 `app/$relative` 前缀甚至可能呈 `app/app/...`，不能在本项宣称 module/ledger 已一致。
- 本项目标先明确使用 **single-project**。若日后 multi，要先裁定 kind→module 与 ledger 相对根，禁止悄悄替换。
- 业务根下只有 `domain/application/infrastructure`；本项不生成第四层。`CommandHelper` 如由其他制品消费，位于 `application.aggregates.behaviors`，不是本 transactor package，也不是 domain。
- 预期闭包至少包含 protocol、entity、root、definition、context、participant、运行库与 bootstrap。它们不是本项允许写的第二份实现。

## 3. Model 完整字段合同

### 3.1 本项精确声明

以下是 M:52–71 的完整本项声明（无构造参数默认值）：

```scala
/** Behaviors：命令处理器（触发→StartSaga→回灌 Status；admin→coordinator 直通道）。 */
case class SagaTriggerBehaviorsModel(
    override val selfType: TypeRef,
    entityName: String,
    stateType: TypeRef,
    eventType: TypeRef,
    commandType: TypeRef,
    definitionType: TypeRef, // <Saga>Definition（取 Name/Version/codec）
    argsType: TypeRef,       // <Saga>Args（构造 + encode）
    argsFields: Seq[FieldDef],
    triggerCommands: Seq[SagaTriggerCommandModel],
    /** 从触发命令参数构造 args 的表达式（如 `Money(...).amount, ..., currency`）——builder 算好。 */
    argsCtorExpr: String,
    confirmationType: TypeRef,
    statusCommandType: TypeRef,
    coordinatorType: TypeRef,
    contextType: TypeRef,
    transactionResultType: TypeRef,
    dependencies: Set[TypeRef]
) extends ArtifactModel
```

| 顺序 | 字段 / 类型 / 默认 | Builder 的精确值 | Template 消费与 JS 差距 |
|---:|---|---|---|
| 1 | `selfType: TypeRef`，无默认 | `<baseName>SagaTransactorBehaviors` + transactor.behaviors 包 | package/object、Protocol 名替换；JS host 名目前是 `id.replaceAll('-', '_')+'Host'` |
| 2 | `entityName: String`，无默认 | `<baseName>Transaction` | `PersistenceId(entityName,id)`、Entity owner import；不是 JS framed operation identity |
| 3 | `stateType: TypeRef` | `buildEntity.stateType` | emptyState、泛型、handler 参数、派生 event 名、nested 过滤 |
| 4 | `eventType: TypeRef` | `<baseName>TransactionEvent` + entities 包 | **未直接消费**；T 从 state 名 `.replace("State","Event")` 另算；不得因未用而省掉模型字段 |
| 5 | `commandType: TypeRef` | `<baseName>SagaCommand` + transactor.root | Behavior、EventSourcedBehavior、ActorContext；Protocol import 的 package |
| 6 | `definitionType: TypeRef` | `<baseName>SagaDefinition` + transactor.root | Args owner、Name、Version、注释；在 deps |
| 7 | `argsType: TypeRef` | `argsMeta.name` + transactor.root | 实际用 `Definition.Args`，不是包级 Args；没有独立 argsType import |
| 8 | `argsFields: Seq[FieldDef]` | 按 args 元数据顺序 resolve | 传给 argsCtorExpr；T 不直接遍历它；不应把 args 字段当 Actor command 字段 |
| 9 | `triggerCommands: Seq[SagaTriggerCommandModel]` | `buildProtocol.triggerCommands` | 所有触发 case；仅首项提供 initiateHandler 参数表 |
| 10 | `argsCtorExpr: String` | B:94–112 的逗号拼接表达式 | 同一串用于 Args 与 TransactionInitiated 的位置实参；**明确 code-string 技术债槽** |
| 11 | `confirmationType: TypeRef` | `<baseName>SagaConfirmation` + root | `ActorRef[Confirmation]`、status 回复、过滤包级错误 import |
| 12 | `statusCommandType: TypeRef` | 第一个 `Update*` 名，或 `Update<Base>SagaStatus` | update case、ask 的两个结果分支、update handler 参数 |
| 13 | `coordinatorType: TypeRef` | resolve `CustomType("SagaTransactionCoordinator", coordinatorPkg)` | **T 不消费其 signature**，硬编码 `SagaTransactionCoordinator.Command` 与 import |
| 14 | `contextType: TypeRef` | 显式 context.name，否则 meta.name，经 sagaContext resolver | `apply(..., ctx: Context)`；`ctx` 在 T 的后续 body **没有使用** |
| 15 | `transactionResultType: TypeRef` | protocol.transactionResultType | 进入 deps；T 的 ActorRef 与失败构造仍硬编码 `TransactionResult` |
| 16 | `dependencies: Set[TypeRef]` | 见 B6 | T 转成 fqn、nested 过滤、distinct/sorted；writer 另用于 ledger deps |

这些字段均无本地默认值；没有模型泛型、型变、上下界、注解、self-type、另一个 companion 或额外方法。`override val selfType` 以外是 case class 字段。JS 当前 host renderer 没有这个独立结构模型，输入 products/options 和源码拼接混在同一函数；family 的大模型也不是该 16 字段合同。

### 3.2 子型、同文件兄弟与共享默认值

M 全文件的其他声明如下，字段顺序不可交换，均无本地默认值：

| 声明 | 完整字段序列 | 与本项关系 |
|---|---|---|
| `SagaTriggerCommandModel` (25–29) | `name:String, params:Seq[FieldDef], handlerArgs:Seq[String]` | 唯一命令子模型；`params` 注释不含 replyTo；handlerArgs 是参数名后追加 `replyTo` |
| `SagaTriggerProtocolModel` (15–23) | `override val selfType:TypeRef, triggerCommands:Seq[SagaTriggerCommandModel], confirmationType:TypeRef, statusCommandType:TypeRef, transactionResultType:TypeRef, tracingStepType:TypeRef, dependencies:Set[TypeRef]` | buildBehaviors 实际调用 buildProtocol；extends ArtifactModel |
| `SagaTriggerEntityModel` (32–38) | `override val selfType:TypeRef, stateType:TypeRef, argsFields:Seq[FieldDef], statusType:TypeRef, dependencies:Set[TypeRef]` | buildBehaviors 实际调用 buildEntity；extends ArtifactModel |
| `SagaTriggerRootModel` (41–50) | `override val selfType:TypeRef, entityName:String, tagPrefix:String, commandType:TypeRef, coordinatorType:TypeRef, contextType:TypeRef, behaviorsType:TypeRef, dependencies:Set[TypeRef]` | 同文件兄弟与本项调用方，不是本项嵌套类型；extends ArtifactModel |

[TypeSystem.scala:4–85](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4-L85)：

- `TypeRef(name:String, packageName:String, typeParams:Seq[TypeRef]=Nil)`：fqn 在空包时为 name，否则 package+name；signature 对非空参数的数字尾 `TupleN` 输出 `(T1, T2)`，一般泛型输出 `Name[T1,T2]`，否则 name。递归 `collectAllDependencies=Set(this) ++ children`；`shouldImport` 排除空包、当前包、`scala`、`java.lang`。
- `FieldDef(name:String,typeRef:TypeRef,defaultValue:Option[String]=None,comment:Option[String]=None,noteId:Option[String]=None,description:String="")`。本 Builder 只填前两项，没有透传字段 default/comment/noteId/description，也没有用 optional 包装 resolver。不得据元数据存在这些信息声称本项输出了它们。
- [ArtifactModel.scala:5–47](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L5-L47)：抽象 `selfType/dependencies`；`fqn=selfType.packageName+"."+selfType.name`；`registerTo(registry)=registry.register(this)`；`morphisms:Seq[MappingMorphism]=Nil`；`noteIds:Seq[String]=Nil`。本模型没有 override 后两者，不能声称已具成员级回锚。

## 4. Builder 全规则账

完整文件见 B，下面包含所有函数及其分支。`buildRoot` 并非 buildBehaviors 的调用依赖，但同文件已实读且在链上先发射，故单列不漏记。

| ID / 固定行 | 实际规则、分支、顺序和返回值 | approved-target / JS 实施要求 |
|---|---|---|
| B0 / 1–19 | imports 包含模型通配、`FieldDef/GeneratorContext/TypeRef/TypeResolver`、`net.imadz.meta._`；object；`private val coordinatorPkg="net.imadz.infra.saga"` | 不冒称 Builder 完全不拼字符串；TypeResolver import 本文件未直接用 |
| B1 / 21–32 | protocol 包=root；baseName 是 **全字符串 replace**，非 stripSuffix；收集非 `startsWith("Update")` 名成 Set，再按原命令顺序 filter/map；每个参数 resolve；handlerArgs=原参数名序列 `:+ "replyTo"`；confirmation 固定合成；status 选首个 Update 名，否则合成 | `triggerCommandName`、命令 `replyToType`、read-only 标志、`replyMetadata` 均不参与该选择；D2/D3 不可通过默认通用 Reply 消解 |
| B2 / 33–48 | deps=触发参数的**直接 typeRef** + resolved TransactionResult、TracingStep + known ActorRef/CborSerializable；按 shouldImport(root) 过滤；返回七字段 protocol 模型 | 没有 collectAllDependencies 调用；泛型内 import 缺口需 shared TypeRef 裁定 |
| B3 / 51–70 | entity 包=domain.entities；args 缺失即 throw；args.fields 顺序映射为 FieldDef；State=`BaseTransactionState`、Status=`BaseStatus`；deps=args 的直接 typeRef + CborSerializable + resolved Id，再过滤；返回五字段 entity 模型 | domain args/events 无 ActorRef；不从应用 replyTo 倒灌 |
| B4 / 72–92 | root 包=root；Protocol/Behaviors TypeRef 分别根包/behaviors；context 显式或 meta.name fallback，经 sagaContext；deps 只有 protocol/behaviors/context 再过滤；selfType=原 meta.name；entityName=BaseTransaction；tagPrefix=baseName.toLowerCase；command、coordinator 另填 | Root 直接调用本项 apply；不要因命名美化改 entityName/tag/PID；缺少 known framework deps 不等于不存在硬编码 imports |
| B5 / 94–112 | argsCtorExpr 只看 `triggers.headOption`；paramByName 是首命令 params 转 Map（重名时 Map 后项覆盖），moneyParam 是首个 typeRef.name==Money 的参数；按 argsFields 顺序应用下列七条 match，再 `mkString(", ")` | 此串保留为受追踪槽，不将所有 member/body 变成字符串；多命令映射尚非逐命令 |
| B6 / 114–137 | behaviors 包与 root 包先取；args 缺失 throw；argsFields resolve；依次 buildProtocol、buildEntity；context fallback；definitionType；deps 固定集合加所有 trigger.params 直接类型，再 shouldImport(behaviors) | 不额外加入 argsFields、eventType、coordinatorType、commandType、statusCommandType；不得靠任意通配补齐依赖 |
| B7 / 139–156 | 按 §3 的 16 字段 named args 构造 SagaTriggerBehaviorsModel；argsCtorExpr 用同一个首命令结果 | JS 显式模型保留所有字段及来源，template 不重复从 products 推导业务映射 |

B5 七条按顺序精确为：

```scala
paramByName.get(af.name) match {
  case Some(pt) if pt.name == "Money" && af.name == "amount"   => s"${af.name}.amount"
  case Some(pt) if pt.name == "Money" && af.name == "currency" => s"${af.name}.currency.getCurrencyCode"
  case Some(pt) if af.typeRef.name == "String" && pt.name == "Id" => s"${af.name}.toString"
  case Some(_)                                                    => af.name
  case None if af.name == "amount" && moneyParam.isDefined         => s"${moneyParam.get}.amount"
  case None if af.name == "currency" && moneyParam.isDefined       => s"${moneyParam.get}.currency.getCurrencyCode"
  case None                                                        => af.name
}
```

注意前两条只检查命令类型和字段名，**不检查 args 字段确为 BigDecimal/String**；末条可能输出未绑定标识符；不能描述为完备类型适配。无触发时仍为各 args 字段裸名，且 T 会留多余逗号，非可用空模型。

B6 的完整依赖集合为：

```scala
(Set(
  TypeRef(s"${baseName}SagaTransactorProtocol", rootPkg),
  entity.selfType,
  entity.stateType,
  definitionType,
  protocol.confirmationType,
  contextType,
  protocol.transactionResultType,
  ctx.knownFrameworkTypes("EntityRef"),
  ctx.knownFrameworkTypes("ActorRef")
) ++ protocol.triggerCommands.flatMap(_.params.map(_.typeRef)))
  .filter(_.shouldImport(pkg))
```

共享推导不能猜：

- [TypeResolver:66–79](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala#L66-L79) 的 `CustomType` **先按 name 查询 knownFrameworkTypes**，存在则忽略传入包并递归 resolve typeArgs；否则 `net.imadz.domain.values` 重定向当前 values 包，其他包照填。这解释了 B 传 coordinatorPkg，但 TransactionResult/TracingStep 实际仍定位嵌套 owner。
- [GeneratorContext:166–173](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L166-L173) 明确将两者设为 `net.imadz.infra.saga.SagaTransactionCoordinator.{TransactionResult,TracingStep}`。不能误报它们必然是包级 import 错误。
- [TypeResolverDSL:682–685](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L682-L685) 先 `NamingConventions.getBaseName` 再 `getSagaContextName`。[NamingConventions:187–239](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L187-L239) 顺序剥技术后缀、若剥空则返回最后非空值；`getSagaContextName` 经 getSagaBaseName 后加 Context。此规则不同于本 Builder 的全局 `.replace("SagaTransactor","")`。
- 输入 [SagaTransactorMetadata:485–499](../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L485-L499) 的 version 默认 1、args/context 默认 None、replyMetadata 默认 None；participants/steps 属 definition/participant 生成，不在 T 里编排。

真实 Examples 对应：[197–287](../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L197-L287)。首触发为 `InitiateMoneyTransferTransaction(fromUserId:Id,toUserId:Id,amount:Money)`，args 顺序 `fromUserId:String,toUserId:String,amount:BigDecimal,currency:String`；B 的表达式是 `fromUserId.toString, toUserId.toString, amount.amount, amount.currency.getCurrencyCode`。status 名为 `UpdateMoneyTransferTransactionStatus`。元数据 reply 是 `TransactionResultConfirmation`，但本 family 合成为 `MoneyTransferSagaConfirmation`，不能宣称沿用了元数据确认名。

## 5. Template 全文及逐构造/RHS账

### 5.1 原始模板全文

以下保留 T 原始内容，不把它冒充经过用户覆盖后的实现；`$...` / `${...}` 是实际 Scala 字符串插值，不是本文填不出的业务值。

```scala
package net.imadz.codegen.scaffolding.cqrs.template.application.transactor

import net.imadz.codegen.scaffolding.cqrs.model.application.transactor.SagaTriggerBehaviorsModel
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

/** saga_v3 触发聚合 Behaviors 模板（**B·§13**）——v3 触发形态。
  *
  * golden 参考：playAkkaCQRS `FabSagaTransactorBehaviors`：
  *   触发命令 → persist(TransactionInitiated) → thenRun { StartSaga(txId, Name, Version, codec.encode(args), …) }
  *   statusCmd → persist(Completed/Failed) → 回复确认
  * 事务编排**不在**聚合里——交给共享 coordinator；参与者由引擎按定义重建。 */
object SagaTriggerBehaviorsTemplate extends CodeTemplate[SagaTriggerBehaviorsModel] {
  def generate(model: SagaTriggerBehaviorsModel): String = {
    import model._
    // 嵌套类型（State/Event/Confirmation）在各自**对象内**，包级 import 取不到——过滤掉，
    // 改以对象通配 import（见下）。其余依赖照发。
    val eventTypeName = stateType.name.replace("State", "Event")
    val nested = Set(stateType.name, eventTypeName, confirmationType.name, commandType.name)
    val imports = dependencies.map(_.fqn).filterNot(f => nested.exists(n => f.endsWith(s".$n"))).toSeq.distinct.sorted.map(i => s"import $i").mkString("\n")

    val triggerCases = triggerCommands.map { c =>
      s"          case cmd: ${c.name} => initiateHandler(state, ${c.handlerArgs.map("cmd." + _).mkString(", ")}, coordinator, context, id)"
    }.mkString("\n")

    s"""package ${selfType.packageName}

import akka.actor.typed.{ActorRef, Behavior, SupervisorStrategy}
import akka.cluster.sharding.typed.scaladsl.EntityRef
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior, RetentionCriteria}
import akka.util.Timeout
import scala.concurrent.ExecutionContext
import scala.concurrent.duration.DurationInt
import net.imadz.infra.saga.SagaTransactionCoordinator
import net.imadz.infra.saga.SagaTransactionCoordinator.{StartSaga, TransactionResult}
import net.imadz.infra.saga.dsl.ArgsCodec
import net.imadz.common.Id
import ${commandType.packageName}.${selfType.name.replace("Behaviors", "Protocol")}._
import ${stateType.packageName}.${entityName}Entity._
$imports

/** <Saga> 触发聚合：journal 业务意图 → StartSaga（v3 coordinator）→ 记录终态。
  * 步骤展开在 ${definitionType.name}，参与者由引擎重建；本聚合**不**编排步骤。 */
object ${selfType.name} {

  def apply(
    id: String,
    coordinator: EntityRef[SagaTransactionCoordinator.Command],
    ctx: ${contextType.signature}
  ): Behavior[${commandType.name}] =
    akka.actor.typed.scaladsl.Behaviors.setup { context =>
      implicit val ec: ExecutionContext = context.executionContext
      EventSourcedBehavior[${commandType.name}, $eventTypeName, ${stateType.name}](
        persistenceId = PersistenceId("$entityName", id),
        emptyState = ${stateType.name}(id = Some(id)),
        commandHandler = (state, command) => command match {
$triggerCases
          case cmd: ${statusCommandType.name} => updateStatusHandler(state, cmd)
        },
        eventHandler = (state, event) => state.applyEvent(event)
      ).withRetention(RetentionCriteria.snapshotEvery(numberOfEvents = 100, keepNSnapshots = 3))
        .onPersistFailure(SupervisorStrategy.restartWithBackoff(200.millis, 5.seconds, 0.1))
    }

  /** 触发：persist 意图 → StartSaga 交给 v3 coordinator（args 经 codec 编码）。 */
  private def initiateHandler(
    state: ${stateType.name},
    ${triggerCommands.headOption.map(c => c.params.map(p => s"${p.name}: ${p.typeRef.signature}").mkString(",\n    ")).getOrElse("")},
    replyTo: ActorRef[${confirmationType.name}],
    coordinator: EntityRef[SagaTransactionCoordinator.Command],
    context: akka.actor.typed.scaladsl.ActorContext[${commandType.name}],
    id: String
  )(implicit ec: ExecutionContext): Effect[$eventTypeName, ${stateType.name}] = {
    val args = ${definitionType.name}.${argsType.name}($argsCtorExpr)
    val event = TransactionInitiated($argsCtorExpr, System.currentTimeMillis())
    Effect.persist(event).thenRun { _ =>
      val transactionId = state.id.getOrElse(id)
      implicit val timeout: Timeout = 30.seconds
      val argsBytes = ArgsCodec.playJson[${definitionType.name}.${argsType.name}].encode(args)
      context.ask(coordinator, (ref: ActorRef[TransactionResult]) =>
        StartSaga(
          transactionId = transactionId,
          definitionName = ${definitionType.name}.Name,
          definitionVersion = ${definitionType.name}.Version,
          argsBytes = argsBytes,
          traceId = s"TRACE-$${transactionId.take(8)}",
          completionReply = Some(ref))
      ) {
        case scala.util.Success(result) => ${statusCommandType.name}(transactionId, result, replyTo)
        case scala.util.Failure(_)      => ${statusCommandType.name}(transactionId, TransactionResult(successful = false, null, "start failed"), replyTo)
      }
    }
  }

  /** 终态回灌：coordinator 的 TransactionResult → Completed / Failed。 */
  private def updateStatusHandler(
    state: ${stateType.name},
    cmd: ${statusCommandType.name}
  ): Effect[$eventTypeName, ${stateType.name}] = {
    val event = if (cmd.newStatus.successful)
      TransactionCompleted(cmd.id, System.currentTimeMillis())
    else
      TransactionFailed(cmd.id, Option(cmd.newStatus.failReason).getOrElse("Unknown Error"), System.currentTimeMillis())
    Effect.persist(event).thenReply(cmd.replyTo) { _ =>
      ${confirmationType.name}(_root_.net.imadz.common.Id.of(cmd.id),
        if (cmd.newStatus.successful) None else Option(cmd.newStatus.failReason),
        Nil)  // tracing：StepSpecSnapshot ≠ TracingStep·暂传空
    }
  }
}
"""
  }
}
```

### 5.2 构造、全部 RHS、顺序与目标处置

| ID / T 行 | 原始 emitted construct 与完整规则 | 目标处置 |
|---|---|---|
| T0 / 12–23 | Template object 继承 `CodeTemplate[SagaTriggerBehaviorsModel]`；generate 返回 String；局部 eventTypeName / nested / imports / triggerCases 的 RHS 见全文 | Model→Template，不把 products 读取混回 template；字符串槽仅 B5。nested 是按**尾名**过滤，有同名误过滤可能，交 shared resolver |
| T1 / 25–40 | package=selfType.packageName；固定 imports 顺序为 actor typed、EntityRef、PersistenceId、Effect/EventSourcedBehavior/RetentionCriteria、Timeout、ExecutionContext、DurationInt、coordinator、StartSaga/TransactionResult、ArgsCodec、Id、Protocol._、Entity._，最后 `$imports` | 记录原顺序；目标依三组 Scala/JDK、外部框架、项目依赖稳定排序/去重，保留有语义的 nested owner。固定与动态 import 之间 raw 没有去重，EntityRef/ActorRef/TransactionResult 可重复 |
| T2 / 42–44 | 文档注释的 `<Saga>` 是原样字面量；Definition 名插值；单个 public object，无 extends、父构造实参、注解或 self-type | 目标名称经共同 resolver；不得从名称生成新稳定 Saga ID |
| T3 / 46–52 | `apply(id:String,coordinator:EntityRef[SagaTransactionCoordinator.Command],ctx:Context):Behavior[Command]`；FQN Behaviors.setup；局部 `implicit val ec=context.executionContext` | application Actor 生命周期；ctx 当前未用，删参数/改装配均需 D4，不假称向 coordinator 透传 |
| T4 / 53–60 | `EventSourcedBehavior[Command,DerivedEventName,State]`；named args 顺序 persistenceId、emptyState、commandHandler、eventHandler；PID=`PersistenceId(entityName,id)`；State(id=Some(id))；每 trigger 的 `handlerArgs` 逐个加 cmd.；末 case 为 status；eventHandler=`state.applyEvent(event)` | 所有命令直接 typed case，不增加 Execute 二级巨型 match；无 wildcard/admin case，不虚构 admin 支持；保留 PID 字符串与事件状态边界 |
| T5 / 61–63 | `withRetention(snapshotEvery(numberOfEvents=100,keepNSnapshots=3))` 后 `.onPersistFailure(restartWithBackoff(200.millis,5.seconds,0.1))` | 常量/顺序都保留，除非明确另行裁定；未配置 tags/eventAdapter/snapshotAdapter/recovery signal，不声称已连通 |
| T6 / 65–73 | 第二段注释；private initiateHandler；参数顺序 state、**首个 trigger 的每个 p.name:p.typeRef.signature**、typed replyTo、coordinator、ActorContext、id；第二参数列表 `(implicit ec:ExecutionContext)`；返回 Effect[Event,State] | 全部参数无默认；首命令 params 为空/触发列表为空都会产生孤立逗号；其他 trigger 参数异构时错误复用同一 handler。D2 必须闭合 |
| T7 / 74–79 | 先 Args(argsCtorExpr)，再 TransactionInitiated(同一 expr,System.currentTimeMillis())，然后 persist(event).thenRun；回调忽略新 state，用闭包旧 state.id.getOrElse(id)；timeout=30.seconds；ArgsCodec.playJson[Definition.Args].encode(args) | 时间在 application 边界；表达式求值发生两次，不能无条件共用/重排以改变异常次数。persist 后才编码与 ask，编码异常可能留下只有意图的 journal；恢复/幂等见 D5 |
| T8 / 80–87 | context.ask 的 reply adapter `ActorRef[TransactionResult]`；StartSaga named args 顺序 transactionId、definitionName=Definition.Name、definitionVersion=Definition.Version、argsBytes、traceId=`TRACE-${transactionId.take(8)}`、completionReply=Some(ref) | 不是 StrictSagaCoordinator.Start；没有设置 start replyTo / singleStep，依运行库默认；不改 name/version/trace/PID 来适配另一引擎 |
| T9 / 88–92 | Success(result)→Status(transactionId,result,replyTo)；Failure(_)→Status(transactionId,TransactionResult(false,null,"start failed"),replyTo) | 实际把 timeout/ask 故障统一变成失败终态，不能称安全的 unknown 处理；`null` 是 raw 债务，不填 fake snapshot；D1/D5 |
| T10 / 95–103 | 第三段注释；private updateStatusHandler(state,cmd):Effect；successful true→Completed(cmd.id,currentTime)；false→Failed(cmd.id,Option(failReason).getOrElse("Unknown Error"),currentTime) | 没有检查 cmd.id 与 state.id，没有幂等/终态守卫；两分支都 persist 终态事件，不能套用“所有失败不 persist” |
| T11 / 104–108 | `Effect.persist(event).thenReply(cmd.replyTo){ _ => Confirmation(Id.of(cmd.id), if(successful) None else Option(failReason), Nil) }`；callback 接收事件应用后的 state 但原 body 忽略它 | raw 明确是 thenReply，不是手工 thenRun/Accepted；失败事件 reason 可能为 Unknown Error 而 reply.error=None，D6；空 tracing 是未完成转换槽。业务规则拒绝与观察到 Saga 失败是不同语义 |
| T12 / 109–113 | 依次闭合 method/object/插值字符串/generate/template object；生成文件尾换行 | 没有额外 type alias、case class、trait、companion、var/lazy val、构造器或重载；这些归其他文件，不按“惯例”添入 |

### 原始基准 → 批准目标的有限偏差

1. **确定的结构**：行为仍在 `application.services.transactor.behaviors`；Protocol 保持 application，Entity State/Events 保持 domain；普通类型 PascalCase、成员 lowerCamelCase；长参数分行；nested imports 经显式 TypeRef owner 去重，不反复铺 FQN。
2. **确定的保护面**：没有授权改 PB 包名/字段号、PID、serializer id/manifest/绑定范围、nominal type、overflow/decimal/单位。`Money` 拆量与币种不能转为任意字符串/Int，也不能引入 `addExact→+`。
3. **不能自动修正的 raw 内容**：B5 code-string、首 trigger 约束、元数据 reply 合成、ctx 未使用、persist→encode→ask、ask failure→false/null、status 无关联校验、空 tracing。全部成为显式 D 项；不会用 `???` 或空成功补实现。
4. 本 T **没有 `???` 或 MANUAL 块**。这不是 Scala 其他模板无债务的证明。若后续必须提供业务映射/错误策略，应形成具名外置槽、明确所有者及测试；不在 Model 中藏整份 `content`，也不伪造手写成功体。

## 6. JS 三条路径及银行完整构造分区

### 6.1 formal 路径：有严格 host，没有经典 MBT 的直接替身

公开 [registeredProductProducer:92–101](../baseline/js/lib/products/generate-cli.mjs#L92-L101) 枚举 application、child/effect、V2、play-service 与 family 等 shipped 路径。不是扫描目录自动注册。

银行可见输出的对应正式 producer 路径为：

1. [scala-cqrs-play-service/generate:16–27,59–70](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L16-L70) 继承 `createEffectRegistry('2')`，只特换 aggregate/invariant，host 仍委托 inherited。
2. [produce-effect:6–26](../baseline/js/generators/scala-cqrs-application/produce-effect.mjs#L6-L26) 继承 [applicationRegistry:17–33](../baseline/js/generators/scala-cqrs-application/produce.mjs#L17-L33)。`finite-host-dsl` 依次组装 definitions、invocationHosts、adapters、technicalPorts、HostIO、verification；`finite-execution-dsl` 组装 execution 与 verification。child registry [10–23](../baseline/js/generators/scala-cqrs-application/produce-child.mjs#L10-L23) 同样保留 host 的非测试产物。
3. JD:12–14 明确 `startOwner.kind==='pipeline'` 调 JP；`direct` 则走 JD 自己；其他 kind 报错。银行 AH 的 `Invoke(parent State)` 形态对应 JP，而不是 direct `Submit/Observe/ReceiveEntry`。
4. JP:7–32 在 renderer 内完成 parent pipeline/step/Saga pin 核对、完整 original lineage、args 顺序、nominal token 解包、framed identity 计算规则和 result mapping。JP:33–47 拼整个 Scala 文件；JP:48 调 [wireHostIO:5–22](../baseline/js/generators/scala-cqrs-application/render-host-io.mjs#L5-L22)，通过**源码字符串替换和切片**注入 admission、technical.Installed、delivery body 及 event fold，JP:49 返回唯一 host entry。
5. [renderExecutionPlans:6–9](../baseline/js/generators/scala-cqrs-application/render-execution.mjs#L6-L9) 对 invokeSaga / effect 分支调用 JE，生成 AE 这样的 PersistentMonarch 文件。不能把 Monarch plan 直接改为 Saga trigger object。

这是源码调用链与固定产物内容的对应，**没有本轮银行配置捕获或新鲜生成执行证明**。formal pin 在 [requireApplicationArtifact:4–8](../baseline/js/generators/scala-cqrs-application/generate.mjs#L4-L8) 为 `net.imadz:saga-core_2.13:0.3.0`、SHA `550fbd5cdb18a50d71a62f8f743d59f24ac1daa03f0aeb07c23c8355c2c0d862`；本轮未打开实际 JAR。

### 6.2 legacy 路径：明确存在，但不发射该行为

[generators/saga-dsl/generate.mjs](../baseline/js/generators/saga-dsl/generate.mjs#L87-L147) 为 canonical `truthsrc/v1` 的旧 producer，legacy 要求显式完整 `legacySagaSpecs`，不能降级跳过 canonical Saga。每 spec 输出 `src/main/scala/<package>/<objectName>.scala`，kind=`saga-legacy-source`；strict-contract 输出 JSON 合同，strict-scala 明确 `SAGA_RUNTIME_BINDING_UNVERIFIED`。

[emit.mjs:95–225](../baseline/js/generators/saga-dsl/emit.mjs#L95-L225) 校验显式字段/类型/步骤三阶段/参与者，再输出 Args+JSON Format、Context trait、Definition/steps/preCheck/errorText/onResult/register；`prelude/helpers/preCheck/commandArgs` 是被信任的 Scala 源字符串，并禁止 `???`/TODO。它**没有** Trigger `EventSourcedBehavior` / initiateHandler / updateStatusHandler。独立 `emitCli` [242–264](../baseline/js/generators/saga-dsl/emit.mjs#L242-L264) 可写单个 legacy 文件；formal 注册表没有 saga-dsl，不能把它描述成银行正式渲染器。strict 其他 emitter 文件不因同目录而推断为 generate.mjs 的调用目标。

### 6.3 family 路径：已接公共选择器，但不同协议/产品

[scala-cqrs-saga-monarch-v1/generate:12–46](../baseline/js/generators/scala-cqrs-saga-monarch-v1/generate.mjs#L12-L46) 要求 live implementation capture、八个精确 products、buildModels→implementationBuildInputs→render。公共 [generate-cli:45–63,79–80](../baseline/js/lib/products/generate-cli.mjs#L45-L80) 将其列为 implementation producer，直接 `generate-products` **连 --plan 也拒绝**，应通过 `generate-project`。

- [build-models:35–89](../baseline/js/generators/scala-cqrs-saga-monarch-v1/build-models.mjs#L35-L89)：host/workflow/runtime 闭包核对、固定供给、两参与者串行 TCC、positive Int 边界；exact decimal/money 非空被拒绝；package 目前是 `.kernel/.glue/.root`，**不等于用户三层包**。
- [162–176,385–398](../baseline/js/generators/scala-cqrs-saga-monarch-v1/build-models.mjs#L162-L176) 声明 protocol/codecs/saga/runtime/workflow/root 六容器；[返回模型](../baseline/js/generators/scala-cqrs-saga-monarch-v1/build-models.mjs#L385-L398) 有 sources/directDeps/路径碰撞检查。不能把这些大模型字段称作 SagaTriggerBehaviorsModel。
- [render:12–29](../baseline/js/generators/scala-cqrs-saga-monarch-v1/render.mjs#L12-L29) 角色表驱动 template，映射来源后 renderJobs；可复用思想，非完整复刻。
- [templates/saga:21–133](../baseline/js/generators/scala-cqrs-saga-monarch-v1/templates/saga.mjs#L21-L133)：生成 class facade，actor 缓存、association ensure/query、strict Start/Attach/Reconcile、证据校验、publication/queryPublished。它不是携带极简 State 的经典 trigger actor；publication 的 nonterminal 不投递、result receipt 校验与恢复义务不能删除。
- [templates/runtime:17–65](../baseline/js/generators/scala-cqrs-saga-monarch-v1/templates/runtime.mjs#L17-L65) 是 settings/ownership/RunFactories/CheckedRunFacade 与每 run runtime，不是本项 apply/handler。family 路径已接线，但没有证据显示银行 AH 消费此 renderer。

### 6.4 AH 完整文件的构造分区与保留义务

这张表分配 AH 的所有成员/初始化区间；它不是把不同输入强行合并后的目标实现。**assembly 唯一 owner 为后述 `saga-trigger-family-assembly`**，本项叶子只负责行为文件；其他角色通过独立 owner 返回 fragment/model，不能并发覆写一个 host 字符串。

| AH 行 / 稳定成员 | 实际 RHS/行为 | split/move/保留合同 |
|---|---|---|
| 1–12 头/package/import/object | generated 头、application 包、Akka/ByteString/strict/Future imports；`bank_payment_hostHost` | 头与 imports 由 assembly owner 统一形成最终字节；命名去双 Host 不能改变协议/PID。不是把混合文件整体搬包 |
| 13–20 Request/Reply | Invoke(parent State,typed replyTo)、private Observed/Delivered；Pending/Conflict/Completed(stepResult) | 应用 protocol，保留真实 reply ADT；非 domain 参数，不拿通用 Reply 替代 |
| 21–28 Event/State/Admitted | Associated(original,args,operation)、IdentityObserved、ResultIntent、DeliveryAcknowledged、AdmissionGranted；State 的 ByteString.EMPTY/空 operation/None/false 默认；Admitted 是内部 Request | 严格技术 association 事件不是经典 TransactionInitiated；domain/技术持久化分区需 D1/D7，不能无条件放纯 domain 或合并 wire identity |
| 29–30 originalInput/invocationArgs | 从 parent.inputs 按各自字段顺序构造 BankPaymentOriginal / BankPaymentArgs | 应用输入适配；full original 保留 fundCode，args 不含 fundCode；不得只保留 args 丢 original |
| 31–38 operationIdentity | UTF-8 各 token 前写 length，经 DataOutputStream.flush，再 SHA-256 lowercase hex，加 `sha256:` | 必要 strict 身份实现保留；token 顺序含 context、Saga id/version、pipeline id/version、step、operation、occurrence、iteration/chunk absent；不是 T 的 `state.id.getOrElse(id)` |
| 39–45 terminalResults/classify | succeeded/aborted/RecoveryRequired；已 Prepare 证据区分 compensated；Uncertain 区分 unknown；其他 None | 具名状态分类，不为了 CC 改 String/Any 表；nonterminal 不假造完成 |
| 46–49 validStatus | argsBytes、transactionId、definitionName/version/digest、argsCodec.pin、argsDigest、已知 identity 一致，且 stateToProto 的 Try 成功 | 校验必须保留，不能仅凭 result.successful 回复 |
| 50–62 parent/completed | parent 用 execution codec decode original；成功 TxId 封装；rejected/compensated 映射 step 结果；recovery/unknown 返回 Pending；unknown kind Conflict | return 类型不变，名义 TxId 不 alias 合并；无相同 raw counterpart |
| 63–69 Delivery | 五种结果分别 `(FundOrderId,各自事件类型,TransactionIdentity):Future[Boolean]` | port/implementation 归属明确；事件名与 payload 不能因同构合并 |
| 70–80 apply/局部 var/takeAdmissionReplies | require 四依赖；ec=context.executionContext；admissionPending=false、replies=Vector.empty；take 清空两局部值，spawn 一次广播回复后 stopped | actor 局部可变有所有者；去除字符串注入后仍保留此行为，不能变纯全局表 |
| 81–94 observe | 未 admitted 时收集 replyTo，仅一次 admission；Try 同步异常→Future(false)；pipeToSelf Admitted；否则 spawn 单次 adapter，将 strict Status送给自身；已有 identity→Attach，否则 Start | 严格 start/query/admission；不得替成无条件 StartSaga，亦不得把 admission failure 伪装业务终态 |
| 95–100 deliver | 从已保留 original/identity 调 HostIO.deliver；Future Boolean 结果 pipeToSelf Delivered，失败→false | delivery acknowledgement 独立于 Saga completed；不删除恢复/重复投递面 |
| 101–109 Invoke 分支 | 编码完整 parent、args、operation；冲突 Effect.none+Conflict；已完成且投递过则返回 completed；已关联则 observe；首次 persist Associated 后 observe 新 state | fail/no-persist 只适用于该拒绝路径，首次意图确实 persist |
| 110–115 Observed Status | invalid→none/Conflict；valid→仅首次 identity + 新 result intent；persist events 后用新 state deliver/completed/Pending | effects 顺序不得改写成构造 Accepted(events)；terminalResult 不退回非终态 |
| 116–122 其余 dispatch | admitted None 且 operation 匹配→persist AdmissionGranted 后 observe；拒绝→none/Pending；过时 Admitted→none；Denied→Pending；ConflictingIdentity→Conflict；匹配 true delivery→persist ack 后 completed；否则 Pending | 这些分支全部属于必要 strict 行为，不是经典 T 默认算法 |
| 123–131 event fold/闭合 | Associated 更新三字段；IdentityObserved 更新 identity；ResultIntent 更新 result 并 delivered=false；DeliveryAcknowledged true；AdmissionGranted admitted=true | state 仅经 event fold 演进；最终 assemble 要对账所有字段/RHS与闭合，不按行数缩减 |

AE 也已完整读取，作为 Monarch 边界账：1–12 imports/object；13–20 Inputs、单 step Request、Result ADT 五 outcome；21–23 State 的 `Option[TxId]=None`、Outputs、缺 predecessor 抛异常；24–27 PB codec 的 planversion=`bank-v1-1`、input0–6/output0 编解码及完整性 require；28–35 PureStages/Installed/install 非空守卫；36–54 behavior 内 Bridge/Promise，Completed→trySuccess、Conflict→tryFailure、Pending→20.millis 重发、PostStop→失败 promise；55–65 Vector plan、PersistentMonarch.behavior、成功 state.copy，四错误→各自 StageFailedException，unknown static step→Future.failed；66–68 闭合。这里任何协议、PB、plan/PID 身份、顺序或 pending 处理都不属于本项可删范围。

## 7. 真正的 minus/plus 差异（不是可应用生产补丁）

### 7.1 actual-js → approved-target 的确定排版投影

minus 精确来自 AH:63–72；plus 仅按批准标准分行，不替换 strict 协议，不伪造业务映射。这只是确定可做的一个构造投影，**不是完整目标文件，也不证明经典 A 内容对应**。

```diff
--- actual-js/app/example/bankwealth/application/bank_payment_hostHost.scala
+++ approved-target/behavior-fragment.scala
@@
   }
-  def apply(persistenceId: String, coordinator: ActorRef[StrictSagaCoordinator.Command], technical: bank_payment_hostTechnicalPorts.Installed): Behavior[Request] = Behaviors.setup { context =>
-    require(persistenceId != null && persistenceId.nonEmpty && coordinator != null && technical != null, "explicit owned pipeline invocation implementations required")
+  def apply(
+      persistenceId: String,
+      coordinator: ActorRef[StrictSagaCoordinator.Command],
+      technical: bank_payment_hostTechnicalPorts.Installed
+  ): Behavior[Request] = Behaviors.setup { context =>
+    require(
+      persistenceId != null && persistenceId.nonEmpty && coordinator != null && technical != null,
+      "explicit owned pipeline invocation implementations required"
+    )
     implicit val ec: ExecutionContext = context.executionContext
```

最终名称（不再 `bank_payment_hostHost`）、types owner 与 imports 要由 shared names / sibling protocol 裁定后完整生成，不能在这个 fragment 中留永久旧名桥接壳。

### 7.2 actual-js → raw-scala 结构对照，明确不等价

minus 为 AH:121–129 实际文本；plus 为 T:99–108 的真实参数化输出结构。`${confirmationType.name}` 是 T 的真实插值。此处比较的是“严格投递确认”与“经典终态回灌”两个不同输入/协议，不是同输入补丁；**不能照此删除银行 delivery 语义**。D1/D5/D6 决定哪条行为属于最终目标。

```diff
--- actual-js/bank_payment_hostHost.scala#L121-L129
+++ raw-scala/SagaTriggerBehaviorsTemplate.scala#L99-L108
@@
-      case Delivered(kind, true, replyTo) if state.result.contains(kind) => Effect.persist(DeliveryAcknowledged(kind)).thenRun((s: State) => replyTo ! completed(s, kind))
-      case Delivered(_, _, replyTo) => Effect.none.thenRun((_: State) => replyTo ! Pending("delivery unacknowledged"))
-    }, (state, event) => event match {
-      case Associated(original, args, operation) => state.copy(original = original, args = args, operation = operation)
-      case IdentityObserved(identity) => state.copy(identity = Some(identity))
-      case ResultIntent(kind) => state.copy(result = Some(kind), delivered = false)
-      case DeliveryAcknowledged(_) => state.copy(delivered = true)
-      case AdmissionGranted => state.copy(admitted = true)
-    })
+    val event = if (cmd.newStatus.successful)
+      TransactionCompleted(cmd.id, System.currentTimeMillis())
+    else
+      TransactionFailed(cmd.id, Option(cmd.newStatus.failReason).getOrElse("Unknown Error"), System.currentTimeMillis())
+    Effect.persist(event).thenReply(cmd.replyTo) { _ =>
+      ${confirmationType.name}(_root_.net.imadz.common.Id.of(cmd.id),
+        if (cmd.newStatus.successful) None else Option(cmd.newStatus.failReason),
+        Nil)  // tracing：StepSpecSnapshot ≠ TracingStep·暂传空
+    }
```

上下文由 §5 全文和 §6 完整文件链接/逐构造表提供；不能把这个 hunk 当作可编译的独立方法。raw→approved 的非排版差异全部保留在 D 项，不偷偷改成 true/Right(empty)/fake success。

## 8. 胶水、回复与未完成槽

| 完整符号 / 来源 | 所需接口与实际顺序 | 证据与边界 |
|---|---|---|
| `akka.actor.typed.{ActorRef,Behavior,SupervisorStrategy}`、`akka.actor.typed.scaladsl.{Behaviors,ActorContext}` | setup 提供 context.executionContext；ask 把 Future 回应映射应用 command | T 的方法调用证据；没有打开消费 JAR，泛型/API 可编译性未验证 |
| `akka.cluster.sharding.typed.scaladsl.EntityRef` | `EntityRef[SagaTransactionCoordinator.Command]` 由 root/app caller 注入，本项不创建或关闭 ActorSystem/coordinator | [Root T:24–32](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/SagaTriggerRootTemplate.scala#L24-L32) |
| `akka.persistence.typed.PersistenceId`、`akka.persistence.typed.scaladsl.{Effect,EventSourcedBehavior,RetentionCriteria}` | journal 意图后 ask；终态 journal 后 thenReply；state.applyEvent 实际演进 State；snapshot/restart 常量见 T5 | [Entity T:32–51](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/SagaTriggerEntityTemplate.scala#L32-L51) 只更新 status，不保存 args 到 State；不能宣称恢复时已有 args 可重发 |
| `net.imadz.infra.saga.SagaTransactionCoordinator.{Command,StartSaga,TransactionResult}` | `StartSaga(transactionId:String,definitionName:String,definitionVersion:Int,argsBytes:Array[Byte],traceId:String="",singleStep:Boolean=false,replyTo:Option[ActorRef[SagaStartReply]]=None,completionReply:Option[ActorRef[TransactionResult]]=None)`；`TransactionResult(successful:Boolean,snapshot:StatusSnapshot,failReason:String="")` | [curated coordinator:27–49,127](../baseline/curated-scala/net/imadz/infra/saga/SagaTransactionCoordinator.scala#L27-L49) / [result](../baseline/curated-scala/net/imadz/infra/saga/SagaTransactionCoordinator.scala#L126-L127)。T 只设 completionReply，未消费 Started/AlreadyRunning/AlreadyFinished/StartRejection；不能凭 signature 声称拒绝或重启必有终态回复 |
| `net.imadz.infra.saga.dsl.ArgsCodec` | `encode(a:A):Array[Byte]`、`decode(bytes:Array[Byte]):Try[A]`；playJson 要 implicit Format[A]，JSON UTF-8 | [curated codec:97–107](../baseline/curated-scala/net/imadz/infra/saga/dsl/SagaDefinition.scala#L97-L107)；嵌套 Args companion 提供 Format 是 definition 的义务 |
| `net.imadz.infra.saga.dsl.SagaRegistry` | `register[E,C,A](definition):Unit`；节点启动、sharding 恢复前注册；key=(name,version) | [curated:117–131](../baseline/curated-scala/net/imadz/infra/saga/dsl/SagaDefinition.scala#L117-L131)。本项不调用 register，不自动证明 bootstrap 完整 |
| `net.imadz.common.Id.of`、`net.imadz.common.CommonTypes.Id`、`...CborSerializable`、`...SagaTransactionCoordinator.TracingStep` | Id.of(cmd.id) 为确认身份；protocol 的 Confirmation 含 transactionId、error、tracing:List[TracingStep]=Nil；ActorRef 只在 trigger/status command | [Protocol T:30–47](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/SagaTriggerProtocolTemplate.scala#L30-L47)。domain State/Events 不加 ActorRef；Id nominal 合同不变 |
| `net.imadz.common.application.CommandHandlerReplyingBehavior.CommandHelper` 与 `runReplyingPolicy` | `toParam(state,command)`；`createFailureReply(param)(error:iMadzError)`；`createSuccessReply(param)(state)`；`replyWith` 失败 Effect.reply，无 persist，成功 persist.thenReply，**读取新 state** | [common 固定源码:16–75](../baseline/common/src/main/scala/net/imadz/common/application/CommandHandlerReplyingBehavior.scala#L16-L75)。这是邻接 aggregate-behavior/command-helper 的强制语义，不是本 T 已调用它。`replyWithAndPublish` 另加 EventStream.Publish，不可替换 replyWith |

BC scaffold [build.sbt:10–38,131–145](../baseline/bc/scaffold/build.sbt#L131-L145) 默认 `common-core` / `saga-core` 为 **0.2**，Akka 2.6.20；另有显式 candidate sagaCore 替换路径。formal JS 则固定 0.3.0 字节。curated 源码具备 StartSaga 接口，**不证明 0.2/0.3.0 被消费 JAR 具有同一接口**，更不构成 publishLocal/升级授权。

curated C 与 raw 的区别也必须保留：C 的 `TransferArgs.of/toMoney`、positive amount / different accounts 的 preCheck（40001/40002）、register 返回 defn、runner 封装是人工参考体。raw Behaviors 不调用这些方法、不复制 preCheck、不使用 runner；B5 独立产生四个位置实参。这些参考不能扩散成所有 Saga 的默认业务算法。

“失败不 persist”在这里须分层解释：**业务 invariant 拒绝**不 persist；**已启动 Saga 的真实失败终态记录**可以 persist TransactionFailed。raw 的 ask timeout 被当成真实终态是 D5，不能用前者口号掩盖，也不能把 strict Pending 改成终态失败。

## 9. 拟议 JS 写集合、装配 owner 与迁移

本节均为后续实施建议，不是本阶段写入授权。相对路径均以 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/` 为根。

### 叶子写集合（全部 proposed，新建而非本次已存在/已实现）

| 路径 | 唯一职责 |
|---|---|
| `generators/scala-cqrs-application/models/saga-trigger-behaviors.mjs` | §3 的结构模型/显式字段合同；argsCtorExpr 为具名来源槽，不是整份源码 |
| `generators/scala-cqrs-application/builders/saga-trigger-behaviors.mjs` | §4 的规则、输入映射、错误诊断与依赖收集；复用同族 protocol/entity 描述，不重复写 sibling 产物 |
| `generators/scala-cqrs-application/templates/saga-trigger-behaviors.mjs` | §5 的完整单文件发射与 source mapping fragment；禁止最终源码 regex 补行为 |
| `test/codegen-parity/saga-trigger-behaviors.test.mjs` | 模型/构造/RHS/fixture 分支义务；是 proposed spec，不能拿不存在测试名运行 |

### 共享文件不归本叶子直接写

- `lib/scala-target/naming.mjs`：复用 `resolveName/resolveNameSet/resolveArtifactPath`，[实际实现:49–118](../baseline/js/lib/scala-target/naming.mjs#L49-L118) stableIdentities 不允许 rename/affix，重复技术 suffix 会报错而非自动吞掉。公共 owner 要确定与 BC replace/getBaseName 的差别，不能各模板独立 safeName。
- shared TypeRef/layout/表达式/import/writer 由 `shared-layout-types` 与 writer owner 定义。所需结构是 package/name/typeParams/signature/dependencies/nestedOwner，以及显式代码槽 provenance；此接口需求不冒称现有 JS model 已等价。
- `generators/scala-cqrs-application/produce.mjs`、`generator.json`、`lib/products/generate-cli.mjs` 的新 producer/role 接入只归集成者。注册现有 formal profile 的默认切流未批准，D1/D8 前不能加隐式 fallback。
- `render-invocation-host.mjs`、`render-pipeline-invocation.mjs`、`render-host-io.mjs` 和 `render-invocation-execution.mjs` 是交叉共享写面。集成者要先只分离职责且保留输出，或同 owner 串行；本项不得删除 strict host、HostIO、Execution。
- family `build-models.mjs/templates/saga.mjs/templates/runtime.mjs` 为另一路所有者；只可复用已证明兼容的命名/来源机制，不把它们覆盖成 classic renderer。

### 唯一 assembly owner 与依赖

`assemblyOwner = saga-trigger-family-assembly`（集成角色，不是本次新启动的代理）；负责一次性组成 protocol/entity/root/behaviors 的名字、文件集合、imports、entry deps 与最终 source map。行为模板自身由 `saga-trigger-behaviors` 叶子 owner 负责；同物理文件不得有第二写入者。

`dependsOn`：`shared-layout-types`、`saga-trigger-protocol`、`saga-trigger-entity`、`saga-trigger-root`、`saga-definition`、`saga-context`、`glue-runtime-contract`、`writer-anchor-integration`。

`conflictsWith`：上述共享 render/registry 文件，以及 strict host / execution / family 的物理容器拆分；需串行集成，不通过另一层旧包转发壳消解。

迁移必须先建立旧→新文件/类型/调用方表：Root.apply、bootstrap、service/执行 host caller、Protocol/Event imports、HostIO/TechnicalPorts、adapters/PB/config serializer consumer、ledger dependency keys、anchor source pointers。**当前 AH/AE 不满足删旧条件**；strict 身份/证据/投递义务无 approved 接收 owner 时保留原输出。writer [prepareEntries:187–190](../baseline/js/src/core/generate.mjs#L187-L190) 对旧 owned 路径报告 RETAINED，不是自动删除；退役要独立计划、所有权确认和回锚重新定位。最终格式之后才能算 fingerprint/offset，不能沿用旧锚。

## 10. fixture、命令形状、验收与副作用

**以下全部未执行。** fixture/expected 尚未创建；本阶段不因文档新增而跑 validate/roundtrip。以后实现批才另行授权。

### 10.1 拟议最小 fixture 集

1. `classic-money-transfer`：从冻结 Examples:208–287 精确保留 Id/Id/Money→String/String/BigDecimal/String 的参数顺序与映射、显式 context、version=1、status 命名。适配器须说明原 `TransactionResultConfirmation` 到 family confirmation 的差异，不用银行输入冒充同输入。
2. 分支变体：无 Saga；args=None；无 Update 与多个 Update；零 trigger、首 trigger 零参数、两个同形/异形 trigger；B5 的七条 match；未绑定 args；泛型参数依赖与 nested type 同名冲突；显式/缺省 context；名字中间出现 SagaTransactor。
3. 状态/错误证据：正确 id 的成功和失败 status、id 不匹配、空/null failReason、重复 start/status、persist 后编码/ask 故障、ask timeout、重启窗口、多个 replyTo。D 项未定前只登记 raw 现象，不构造期望成功。
4. strict 对照：保留 AH/AE 的 original、association hash、Pending/Conflict、result intent/delivery ack；不是要求把此 fixture 自动转成 classic。

拟议资产路径（未写）：`docs/codegen-parity/fixtures/saga-trigger-behaviors/{request.json,options.json,concerns.json,fixture-map.json}` 与 `docs/codegen-parity/expected/saga-trigger-behaviors/`。同输入 adapter/map 需经 D8 审定，不能从业务散文补输入。

期望路径模板：`<new-target>/app/<base-path>/application/services/transactor/behaviors/<Base>SagaTransactorBehaviors.scala`。例如 fixture 明确选择 `base=example.parity`、`Base=MoneyTransfer` 后，单文件绝对目标可为 `/Users/zhongdj/Workspaces/mad-polaris-parity-saga-trigger-behaviors/js-a/app/example/parity/application/services/transactor/behaviors/MoneyTransferSagaTransactorBehaviors.scala`。此为拟议隔离 fixture 路径，**不是银行已生成事实或新的业务 ID**。

### 10.2 真实 CLI 形状与停止条件

源码锚：[generateProductCli:66–88](../baseline/js/lib/products/generate-cli.mjs#L66-L88)、[projectCli:159–225](../baseline/js/lib/project/cli.mjs#L159-L225)、[CodegenMain:174–251](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L174-L251)。没有 `--artifact saga-trigger-behaviors` 参数，不发明这个 flag。

下面绝对路径均为后续独占 fixture/target 的拟议位置；文件未准备或 D1/D8 未决时**停在文档，不运行**。

```bash
# JS：现有正式入口的 plan 形状；目前只会得到现有 strict host，不能证明本 A 已出现。
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /Users/zhongdj/Workspaces/mad-polaris-parity-saga-trigger-behaviors/fixture/request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-application \
  --out /Users/zhongdj/Workspaces/mad-polaris-parity-saga-trigger-behaviors/js-a \
  --options-json /Users/zhongdj/Workspaces/mad-polaris-parity-saga-trigger-behaviors/fixture/options.json \
  --plan

# family/外置实现：project 文件显式选择真实 shipped producer，不给 generate-products 强行塞 capture。
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-project \
  --project /Users/zhongdj/Workspaces/mad-polaris-parity-saga-trigger-behaviors/fixture/truthsrc.project.json \
  --out /Users/zhongdj/Workspaces/mad-polaris-parity-saga-trigger-behaviors/js-family-a \
  --plan

# BC：工作目录须为 /Users/zhongdj/Workspaces/mad-polaris/backkend-codegen。
# 选择真实 Examples slot；scope 只限定本 flavor，不改两仓真源。
sbt -Dcodegen.system=Examples -Dcodegen.multiProject=false \
  -Dcodegen.scope-file=/Users/zhongdj/Workspaces/mad-polaris-parity-saga-trigger-behaviors/fixture/concerns.json \
  -Dcodegen.concern=saga-trigger-behaviors -Dcodegen.families=trigger-saga \
  -Dcodegen.targetDir=/Users/zhongdj/Workspaces/mad-polaris-parity-saga-trigger-behaviors/bc-a \
  -Dcodegen.ledger=/Users/zhongdj/Workspaces/mad-polaris-parity-saga-trigger-behaviors/bc-a/.codegen-ledger.json \
  "runMain net.imadz.codegen.CodegenMain"
```

scope 文件的真实 schema 见 [ConcernRegistry/ConcernScopeLoader:124–221](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ConcernScope.scala#L124-L221)。拟议最小值如下，不是已写文件：

```json
{
  "flavors": { "trigger-behaviors": { "artifactKinds": ["saga-trigger-behaviors"] } },
  "concerns": { "saga-trigger-behaviors": { "schemaCategories": ["saga"], "flavors": ["trigger-behaviors"] } },
  "familySets": { "trigger-saga": ["MoneyTransferSagaTransactor"] }
}
```

这里用 familySets 是因为 CodegenMain 的 knownFamilies 主要取 aggregates/projections，而本 attribution 的 families 是 Saga 名；不能直接假定 `-Dcodegen.families=MoneyTransferSagaTransactor` 被接受。只取该 flavor 是**内容采集**，不宣称完整应用能编译；行为验证需 sibling 闭包一次性集中生成。

| 命令 | 真实读取/写入与副作用边界 |
|---|---|
| JS generate-products --plan | 捕获请求/options/manifest、编译产品/构造计划；相关 formal profile 读并核验本地 pinned Saga/Monarch JAR；不调用 applyEntries，不写目标 ledger/anchor。不是 runtime test |
| 同命令去 --plan（以后授权） | 写 plan entries（可能同时含源码、proto、config、生成测试、build），写 `<out>/truthsrc.ledger.json`、`<out>/anchors.json`；[applyEntries:246–268](../baseline/js/src/core/generate.mjs#L246-L268)。不是只写 Behaviors 一个文件，没有原子回滚承诺 |
| generate-project --plan | captureProject 本身执行 validate/roundtrip/compile、读取 tool/input/source roots；有 implementation capture 时在 plan 之前调用 `verifyImplementationSources`（可能有编译/子进程验证，须另列实际 supply/副作用，本文未读其缺失快照实现，不承诺纯读）；planOnly 不建 SQLite store/不 apply |
| generate-project 实跑 | 除 entries/ledger/anchors 外，写 `.truthsrc/{canonical,request,compiled,inputs}.json`，建立项目 graph store、发布 project anchors；graph 在输出目录外的具体路径由 projectGraphFile 合同决定，运行前必须明确，不因新 out 自动安全 |
| BC runMain | sbt/JVM 会用构建缓存，依赖不足可能下载，故供应未获许可时停；CodegenMain 会建 target、拷 scaffold，runCommon 建 proto 目录，writer 记账/指纹/territorial 写入，KnowledgeRelease manifest、条件 formal-semantics 等；scope 不阻止所有前置 builder/框架文件行为。只允许新独占 target，不能用默认 banking-app/共享 ingested-app |

重复生成使用另一个新目标 `js-b/bc-b`，而非本次覆盖旧生成物；改一字段/规则后检查局部 diff 与回锚。若选择 project --update，要单列 owned 写/保留动作，不把其副作用默认为允许。

### 10.3 验收账（均 not-run / not-measured）

- 等价输入成立后比较完整文件集合、路径、package/import、成员顺序、全部 RHS/body/default、16 模型字段及 B/T 各行；只白名单生成版本头和明确的换行差异，不压平空白。
- fixture 分支和缺口必须分别列 enabled/suppressed/missing/exercised；本轮只有 observed-source，没有 exercised-output。
- 必要接口检查覆盖实际被消费 JAR 的 StartSaga/Strict API、ArgsCodec Format、Id/CborSerializable 与 sibling Protocol/Entity；不升级/发布 runtime 洗绿。
- 必要行为检查覆盖业务拒绝无 persist、成功 persist 后 thenReply 的新 state、回复次数、无额外 EventStream 发布；本 Saga 则额外区分真实失败终态、timeout unknown、delivery pending、重启窗口。不能拿相似 Scala 签名当行为证明。
- 普通方法 CC 目标 **≤5**，6–10 逐方法解释，>10 需重构或明确逐方法例外；当前 **not-measured**。重点方法：B.argsCtorExpr、T commandHandler、AH observe/commandHandler、family classify。不得用 String/Any dispatcher 刷分。
- source map/ledger/anchor 由最终格式字节重算；来源身份不新增 @knowledge 作者字段，不复用旧偏移，不留旧包永久壳。
- scoped 生成/内容对比预算先按 5 分钟、批末必要接口/行为按 15 分钟调度；不是性能实测或运行授权。缺 fixture、API、供给、owner 任一项即停，不重跑全银行工作坊。

## 11. 明确未决项与阻断范围

| ID | 必须裁定的具体问题 | 当前证据/禁止默认值 |
|---|---|---|
| D1 | 本 A 最终消费经典 StartSaga/TransactionResult，还是在严格 Saga API 上保留相同 OO 结构？若两者保留，正式 profile 与 variant 如何显式选择？ | BC raw classic、formal/family strict 的身份、状态、证据、result delivery 不等价；不把 strict host 降级，JAR 供给另核 |
| D2 | 允许几个 trigger？零参数/零 trigger 如何诊断？异构触发命令是否逐命令 handler/args mapping？字段未绑定与 Money 名字特判如何类型化？ | B5 仅取首项；T6 孤立逗号/错参数可由源码推出；不发明所有命令共享算法 |
| D3 | 回复合同由 meta.replyToType/replyMetadata 还是固定 `<Base>SagaConfirmation` 承担？`Update*`、read-only、admin 的真实分类是什么？ | B 不读 triggerCommandName/reply 元数据；M 注释称 admin 直通，但 T 未实现 admin 通道；ActorRef 只能应用命令按明确合同生成 |
| D4 | `ctx: Context` 保持兼容但未用，还是明确注入 coordinator/definition 的上下文装配？若删除参数，Root/Bootstrap/caller 如何迁移？ | T3 不使用 ctx，禁止声称已透传；不要在 template 偷加 service locator |
| D5 | persist 意图后编码/ask 故障、timeout、重启、重复触发、错 id status 的状态机与回复语义是什么？ | raw timeout→false/null，state 不存 args，未见 recovery signal/幂等/关联守卫；strict Pending/Attach 不可丢 |
| D6 | failed null/空 failReason 的 event/reply 是否必须一致？StepSpecSnapshot→TracingStep 的转换由谁承担，还是明确批准空 tracing？ | raw event fallback Unknown Error、reply Option(null)=None、tracing Nil；保留槽，不填假结果 |
| D7 | nested TypeRef 的 owner/import、eventType 与派生名的单一权威、multi kind/ledger 根，以及 strict technical State/Events 分层怎么定？ | raw 尾名过滤/动态重复 import、未使用模型字段；family kernel/glue/root 不合三层；不能默改 PB/serializer 身份 |
| D8 | 同输入 fixture 的正式请求/Scala SystemMetadata 适配及 classic producer 注册由哪个已批准 profile 接收？公共 assembly owner 的共享接口与供给 pins 何时冻结？ | 目前没有 fresh raw/target 同输入产物，当前 CLI 只发已有 formal host；新 model/template 名字不是可达性证明 |

D 项只阻断相应实施/验收，不阻断本 artifact 的独立文档保存。本文状态不因保存而变成 implemented、ready、parity-PASS 或 behavior-PASS。
