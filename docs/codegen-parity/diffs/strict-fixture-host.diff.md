# strict-fixture-host：严格 Saga 示例宿主制品规格

状态：`decision-required`。formal 对应关系另记 `missing-counterpart`，不是“JS 完全没有实现”。这是源内容检视与拟实施合同，不是生成、编译或运行证明。最后更新：2026-11-16。

## 1. 身份、边界与可取得的证据

- artifact id / detail group 均为 `strict-fixture-host`；它是 optional strict 扩展，不计入传统 39 Template 族，也不与 classic Saga、products invocation host 混签。
- 固定 HEAD：BC `cc335eb1e0d0fae17bf092fd61b126040196ea70`；JS `bf104e16ab82ef39d7fa416d0997907d18a815ad`。实际源身份以 [baseline/index.json](../baseline/index.json) 的完整 bytes/SHA 为准。
- 依据 [AUTHORING-CONTRACT](../AUTHORING-CONTRACT.md)、[布局标准](../layout-and-style.md) 和 [批准计划](../../../.rounds/prettify-generated-code-resume-20261115-cgr9lzlk/APPROVED-PLAN.md)。本次只创建本 diff 和 `details/strict-fixture-host.json`，不触碰先前 15 份 diff、其它制品、基线、真源、生成目录或共享登记。
- 首次检查与写前检查均未发现这两个文件。未创建 worktree/task/subagent；未执行测试、typecheck、compile、生成、运行、服务、下载或 Git 写入。
- 以下 `M/B/T` 是全文固定文件，不是名称推测。已分段实读 M 1–120、B 1–439、T 1–1654；T 间接加载的六个资源模板也已全文读，见 §7。后者不在 BC baseline，按原路径和 SHA 单列，未复制或修改。

|证据|完整源与行锚|bytes / SHA-256|
|---|---|---|
|M|[FixtureHostModel.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/transactor/FixtureHostModel.scala#L1-L120)|7818 / `30b2e46fe3755f98a438ab4442f6cabf72c250cddf532755f4f427eb59e1678a`|
|B|[FixtureHostBuilder.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/transactor/FixtureHostBuilder.scala#L1-L439)|31373 / `0085cb2699098a4c371299e88fc2f5f255c370c8c14548e0e013d40460b4e38e`|
|T|[FixtureHostTemplate.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/FixtureHostTemplate.scala#L1-L1654)|109034 / `b592d85c1b96ad5ef605bcfc4bf6a781dbd632a857bd843ddc63b1b2ebc5a59b`|
|legacy model/codec/module 容器|[emit-strict.mjs](../baseline/js/generators/saga-dsl/emit-strict.mjs#L1-L946)|58063 / `1310405535eb10c07330f75d32f101a7e7fbf5186f6d03e8978ccc572f3a5c12`|
|legacy host/entry|[emit-strict-host.mjs](../baseline/js/generators/saga-dsl/emit-strict-host.mjs#L1-L442)|29660 / `e517f8edfe4068874c8ab4b4f7efd39dcde9f5dfc6ee5f93d920880c417085de`|
|legacy safety/deployment 容器|[emit-strict-spec.mjs](../baseline/js/generators/saga-dsl/emit-strict-spec.mjs#L1-L996)|60411 / `e809d430ac859290fc0c5778f2a01298b13e6cbb8b9cf33d06652a9daf066a9e`|
|actual-js，银行技术端口桥所在文件|[bank_payment_hostDefinition.scala](../baseline/actual-js/app/example/bankwealth/application/bank_payment_hostDefinition.scala#L1-L80)|60585 / `d6e52d2c8f31202fc8692ff51da4a52e15dd763b9629de8b0be187d1a8fbc816`|
|actual-js，银行 invocation actor，非本族同义物|[bank_payment_hostHost.scala](../baseline/actual-js/app/example/bankwealth/application/bank_payment_hostHost.scala#L1-L131)|11966 / `e74f76532abdadc384d4fda34cad3d8896d34898c5996b3e3fa85758afa986c4`|

上述九个主证据的当前固定副本 bytes/SHA 与 index 逐项相符；这是文件内容校对，不是代码验证。

### 1.1 四种材料严格分开

|材料|本项实际取得的内容|能说明什么 / 不能说明什么|
|---|---|---|
|`raw-scala`|M/B/T 全文；六个附加资源；调用/writer 源|可以完整说明模板会如何构造源码；**没有本轮同输入 Scala 输出文件**，不能把模板内字符串标成新生成结果|
|`approved-target`|本规格逐构造保真要求，加用户三层、命名、imports、Helper/回复顺序约束|布局与 strict namespace admission 存在真实冲突，需 D1；没有完整可执行目标字节集，不虚构 expected 文件|
|`actual-js`|上述冻结银行输出；legacy renderer 源另列|银行有 technical PhasePort 与 invocation actor，不是 BC 二参与者 fixture 的同一输入；下面均为结构性对照|
|curated reference|[CreditBalanceCommandHelpers.scala 1–95](../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L1-L95)，5746 bytes，SHA `ec0c4f05e9398b8fd8aa1a93d6aafbe10a845e687bdffc27d3510e51a177d531`|人工完成的 Helper 胶水参考，**不是 FixtureHost golden**。其 ReserveFunds 回复为 `FundsReservationConfirmation(transferId,error)`，不能冒充本模板假设的单字段 `CreditBalanceReply(error)`|

在 index 的 curated 文件清单中未列出本族 FixtureHost/FixtureSafetySpec；此结论限于该冻结清单，不是全仓、历史或运行能力的负断言。未查图、未执行语义门，不声称业务真源缺失。

## 2. 真实调度、变体与输出基数

[CodegenMain 62–82、117–131、183–241](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L62-L241) 的 traditional 分支才到这里：可选 `codegen.sagaExecutionV3` 经 `AdmittedSagaInputV3.fromBytes(bytes, system)` 与实际 base 校验；有 strict token 时要求显式实际 `codegen.targetDir`、拒绝 direct；`semanticProductsFile` 分支提前 return，不调用本族。

[StrictSagaGenerationPlan 44–99](../baseline/bc/src/main/scala/net/imadz/codegen/StrictSagaGenerationPlan.scala#L44-L99) 构造 module，校验 namespace、nested/member 名、路径、symlink/hardlink、保护仓范围；它预先渲染的是 **StrictSagaModule**，不是全部 fixture 文件。随后 [CQRS runCommon 221–249](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L221-L249) 对 `plan.models.zip(plan.sources)` 每行执行：写 module → `FixtureHostBuilder.build` → `generateFiles` → 检查 entryFqn 重复 → 逐文件 `writeArtifact(FixtureFileModel(...))` → single-project 才写两份 test。后置失败可能已有 scaffold/module 写入，不能称整族原子事务。

设 `T` 为显式隔离目标根，`P` 为 `module.selfType.packageName.replace('.', '/')`，`A/M/E` 为 argsCodecName/moneyCodecName/entryName。以下是完整路径公式，不是仅给层名。

|variant|真实条件|raw-scala 输出集合（有序）|状态|
|---|---|---|---|
|suppressed|没有 strict plan|0 个本族文件|条件已读；未生成|
|money-single|strict；`moneyCodecName.nonEmpty`；`!multiProject`|`T/app/P/types.scala`；`T/app/P/M.scala`（同文件含 StrictWire）；`T/app/P/A.scala`；`T/app/P/FixtureHost.scala`；`T/app/P/E.scala`；`T/test/P/FixtureSafetySpec.scala`；`T/test/P/FixtureDeploymentNode.scala`|5 production + 2 test；未 exercised|
|collection-single|strict；money 名为空；args 有 FixtureCollectionShape；`!multiProject`|同上但 `M.scala` 换成 `T/app/P/StrictWire.scala`；两份 test 来自 bounded-collection 资源|5 + 2；未 exercised|
|strict-multi|strict；`multiProject`|相同五个 production 文件，根为 `T/modules/glue/src/main/scala/P/`；没有本族 test|5 + 0；bootstrap strict entry 也被 suppress|
|其它组合|money+collection，或纯 text 无 money/collection|production 选择只看 money 名，test 选择只看 args collection；并非被完整分类验证的第三种成功 profile|D4，不能伪造可用变体|

依据 [T 15–33](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/FixtureHostTemplate.scala#L15-L33)、[writer 331–396](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L331-L396)。五 production 文件并不包含上游 `SagaModule.scala`；常见“七文件族”注释与实际 module+fixture+test 的计数口径不同。多 saga 还需对共享 `FixtureHost/types/StrictWire/ArgsCodec` 路径逐一检重；目前 `seenEntryOutputs` 只拒绝 entryFqn 重复，不能据此断言其它文件无碰撞。

### 2.1 approved-target 的布局约束与未决冲突

- 用户明确：业务根下面只能是 `domain/application/infrastructure`；FixtureHost 是技术宿主，不能塞入 domain，也不能新建业务根第四层 `.fixture`。
- **但 raw admission 明确拒绝这三个层**：[TypeResolverDSL 46–49](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L46-L49) 把 `ctx.layout.domain.root/application.root/infrastructure.root/modules.root`、`controllers`、runtime/common 包全列为 strict 禁区；[StrictSagaGenerationPlan 63–65](../baseline/bc/src/main/scala/net/imadz/codegen/StrictSagaGenerationPlan.scala#L63-L65) 又要求 module FQN 不被重写。因此不能声称简单搬到 infrastructure 就能继续通过原 BC admission。
- D1 裁定候选：新的明确 profile 把技术 fixture 包放在 `<base>.infrastructure.bootstrap.strict.<fixtureScope>`，同包五文件目标为 `T/app/<basePath>/infrastructure/bootstrap/strict/<fixtureScope>/{Types,A,M或StrictWire,FixtureHost,E}.scala`，test 为 `T/test/<basePath>/infrastructure/bootstrap/strict/<fixtureScope>/{FixtureSafetySpec,FixtureDeploymentNode}.scala`；multi 则 production 前缀改 `T/modules/glue/src/main/scala/`。这里的 `Types` 是 PascalCase 要求下的**待绑定迁移**，不是已获准改写 `TypeContract.implementationFqn = ...types.*`。不得保留旧包转发壳掩盖迁移。
- 同包 fixture 是技术演示聚合，不应以它证明所有业务类都能整包搬到 infrastructure。上游 module、业务 Actor Protocol、Entity、CommandHelpers 的 owner 各自处理：Protocol 在 `application.aggregates`，State/Events 在 domain Entity，Helpers 在 `application.aggregates.behaviors`。DI 在 `infrastructure.bootstrap`，不采用 raw `$base.modules`。

## 3. Model 全字段、默认值、依赖与代码槽

以下字段顺序严格依 M，`无`表示没有 case-class 参数默认值，不表示 nullable 或可省略。所有 case class 均 `final`，无型变/上界/隐式参数/注解/self-type/辅助构造器；FixtureHostModel 继承 ArtifactModel。FixtureWireShape 是 sealed trait，text/money 为 case object。

### 3.1 子模型

|模型 / M 行|按构造参数顺序的全部字段（类型；默认值）|消费与 JS 对照|
|---|---|---|
|FixtureCollectionShape 14|`minItems:Int, maxItems:Int, minLength:Int, maxLength:Int`；均无|wire/trigger 元素边界；legacy shape 仅字符串，trigger bounds 仅数量，缺少这四项的独立同型记录|
|FixtureTypeAlias 18|`id:String, targetFqn:String, money:Boolean, collection:Boolean=false`|types 别名；legacy `{id,fqn,money}` 无 collection flag，以 fqn 字符串承载|
|FixtureAggregateFace 24–35|全部 String，顺序 `base, protocolFqn, aggregateKeyFqn, commandsFamilyFqn, replyFqn, queryCommandFqn, queryReplyFqn, behaviorsFqn, eventHandlerFqn, entityFqn`；均无|host 每 face ask/query，test 构造 aggregate；legacy 有近似 face 加 eventsFamily，但 renderer 实取 faces[0]|
|FixturePrepareValueEvidence 37|`mapField:String, valueSlot:String`；无|Prepare 重读精确 Money；legacy 同名对象近似对应|
|FixtureTerminalEvidence 38|`liveMap:String, markerMap:String, oppositeMap:String`；无|终态排斥对立/并存事实；legacy 同名对象对应|
|FixturePhasePort 40–61|String 顺序 `stem, stepId, participantId, phaseRuntime, faceBase, inputType, receiptType, pinId`；`pinVersion:Int`；`commandExpr:String, receiptExpr:String`；`receiptFields:Vector[(String,FixtureWireShape)]`；`evidenceMapField:Option[String]`；`txidSlot:String, commandName:String`；`commandSlots:Vector[String]`；`commandSlotShapes:Vector[(String,FixtureWireShape)]`；`resourceSlotName:String`；`prepareValueEvidence:Option[FixturePrepareValueEvidence]=None`；`terminalEvidence:Option[FixtureTerminalEvidence]=None`。其余无默认|commandExpr/receiptExpr 是明确的 Scala 源码字符串债；不能称 Model 全无源码槽。legacy 输入相位对象 + inline command/receipt 拼接，pinVersion 实固定 1；需显式结构，不把整个 Host content 放进 Model|
|FixtureTriggerModel 63–73|`member:String, contractMember:String, bindingType:String, sourceFqn:String, sourceIsCommand:Boolean, idempotencyField:String, argSources:Vector[(String,Option[(Int,Int)])], moneySlots:Vector[String], collectionSlots:Vector[(String,FixtureCollectionShape)]=Vector.empty`；其余无默认|argSources 包括 money/collection 的 `(slot,None)`，并非将其从 Args 顺序删除；legacy `{slot,bounds,shape}` 加 moneySlots，缺 element bounds|
|FixtureCompletionModel 75–85|全部无默认：`member:String, contractMember:String, bindingType:String, inputType:String, kindWire:String, eventFqn:String, eventFamilyFqn:String, eventArgs:Vector[String], publicationCommandFqn:String`|mapper 顺序来自 execution.inputs；legacy slots 对应，family 由第一 face 拼出，不独立建 eventFamilyFqn|

### 3.2 FixtureHostModel 的全部 30 个参数

来源 [M 87–120](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/transactor/FixtureHostModel.scala#L87-L120)。

|序|字段 / 类型 / 默认值|Builder RHS 与现存 JS 对应|
|---:|---|---|
|1|`override val selfType:TypeRef`；无|`TypeRef("FixtureHost",pkg)`；JS 用固定文件名，未独立 TypeRef|
|2|`packagePath:String`；无|module.selfType.packageName；JS pkg|
|3|`moduleType:TypeRef`；无|module.selfType；JS moduleObj+pkg 分离字符串|
|4|`argsCodecName:String`；无|binding codec mapper 尾段；JS 同|
|5|`argsPinId:String`；无|pinned.pins.argsCodec.runtimeCodec.id；JS 从 binding.codec.id 取|
|6|`argsPinVersion:Int`；无|pinned.pins.argsCodec.runtimeCodec.version；JS runtimeBinding.saga.argsCodec.runtimeVersion，缺省 1|
|7|`moneyCodecName:String`；无|首个 Money codec dottedPath 尾段，缺 money 为 `""`；JS 缺省 null|
|8|`entryName:String`；无|engine.entrypoint 尾段；JS 同|
|9|`argsFqn:String`；无|literal `"SagaModule.Args"`；JS moduleObj.Args|
|10|`argsFields:Vector[(String,FixtureWireShape)]`；无|s.args.slots 顺序；JS name/typeId/shape 记录|
|11|`typeAliases:Vector[FixtureTypeAlias]`；无|整个类型表顺序；JS 整表，但 Money FQN 构造不同|
|12|`faces:Vector[FixtureAggregateFace]`；无|participant aggregate 首现去重顺序；JS 也构造数组，host/spec 不逐 face 消费|
|13|`phases:Vector[FixturePhasePort]`；无|module.phases.map；JS steps.flatMap(phases)|
|14|`triggers:Vector[FixtureTriggerModel]`；无|module.triggers.map；JS payload.triggers.map|
|15|`completions:Vector[FixtureCompletionModel]`；无|module.completions.map；JS payload.completions.map|
|16|`capabilities:Vector[String]`；无|required capability 名；JS caps；T 的实现声明实际不用这一字段回声|
|17|`supportedCapabilities:Vector[String]`；无|固定十项 + collection 两项；JS host 输出的是 m.caps，不是完整 supported 集合|
|18|`businessInvariants:Vector[String]`；无|host.businessInvariants；JS 直接拿 payload.invariants|
|19|`safetyChecks:Vector[(String,String)]`；无|八项枚举→wire 常量，见 §4；JS safetyWire 固定常量|
|20|`interactionTimeoutMs:Int`；无|contract.definition.payload.resilience.phaseTimeoutMs；JS saga.coordinatorSettings.interactionTimeoutMs|
|21|`resourceMembers:Vector[String]`；无|module.phases.address.member 首现去重；JS 同名字段是 steps 去重后的 **number 占位**，真正发射改读 addressMembers|
|22|`namespacePrefix:String`；无|`"strict-saga"`；JS 同；这是 PID 保护面，不随 package 改名|
|23|`publicationSlot:String`；无|第一 step.address.resourceSlot；无 step 失败；JS 第一 step.resourceSlot|
|24|`publicationFaceBase:String`；无|第一 step 的第一 phase 的 face.base；缺 step/phase 失败；JS publicationFace 字符串，但 host/entry 使用第一 face|
|25|`fundingSeedEvents:Vector[(String,Vector[(String,FixtureWireShape)])]`；无|第二 step Prepare+Commit event FQN 与 **outputs**；JS 带 slots 之外另取真实 payloads|
|26|`dependencyRefs:Set[TypeRef]`；无|module + faces Protocol/Aggregate + completions event 类型；JS model 无同型依赖集合|
|27|`fundingEventFields:Vector[(String,Vector[(String,Boolean)])]=Vector.empty`|有 collection 时真实事件 fields，List/Vector 为 true；T collection 仅取其 event FQN 的 head/last，布尔字段并未逐字段驱动构造|
|28|`fundingCommands:Vector[(String,Vector[(String,FixtureWireShape)])]=Vector.empty`|有 collection 时第二 step Prepare/Commit 命令 FQN+inputs；T collection 主要取 FQN，资源仍有固定参数顺序|
|29|`preparedField:String=""`|ports.headOption.evidenceMapField 或 `""`；collection spec 的 `@PREPARED_FIELD@`|
|30|`phaseCollections:Map[String,Vector[String]]=Map.empty`|各 port 的 collection slot 名；T 没有消费此字段|

`override def dependencies: Set[TypeRef] = dependencyRefs` 是方法，不是额外的构造参数。

[ArtifactModel 9–47](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L9-L47) 的继承默认同时保留：`fqn = selfType.packageName + "." + selfType.name`；`registerTo(registry)=registry.register(this)`；`morphisms=Nil`、`noteIds=Nil`。本 M 未覆写后两者，也没有 field note/anchor 元数据。writer 的 saga attribution 与这些空默认不是同一来源。

[TypeRef 4–51](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4-L51) 是 `name,packageName,typeParams=Nil`；fqn/简名 signature 分开，TupleN 带参渲染 tuple，其它带参渲染 `Name[...]`；dependencies 递归包含自身及参数；空包/同包/scala/java.lang 不 import。**本 T 并未调用通用 import 解析器**，而是固定 imports + face 字符串 + 方法体 FQN；迁移时须记录这一真实例外。

## 4. Builder 逐规则与拒绝分支账

全文 B 的顺序如下，未列为“通用语义已验证”。`fail` 都抛 `IllegalStateException("fixture host derivation: ...")`；局部 `.get/head` 仍可能先抛集合异常，不能把所有路径描述成带上下文的 fail-closed。

|B 行 / 稳定规则 ID|实际推导、顺序、分支与完整约束|实施要求|
|---|---|---|
|33–45 / B01|SupportedCapabilities 按顺序为 durable-commit-decision、durable-abort-decision、typed-nonterminal-unknown、safe-status-reattach、receipt-reconciliation、participant-idempotency-query、pinned-definition-codec、manual-evidence-authorization、cancel-before-prepare-fencing、durable-manifest。八个 wireOf overload 各只匹配一个枚举：DurableBeforeCommit→durable-before-commit；DurableBeforeCompensate→durable-before-compensate；ForwardRecovery→forward-recovery；ReconcileBeforeResume→reconcile-before-resume；ConfirmedReservations→confirmed-reservations；EmptyReleaseAndFence→empty-release-and-fence；StableOperation→stable-operation；AuthorizedReconciliationEvidence→authorized-reconciliation-evidence|不能把 required caps 当 supported caps；枚举扩展需要显式分支|
|47–94 / B02|s=pinned.execution；pkg=module.selfType.packageName；moduleRef literal SagaModule。shapeOf 从 args.types 按 id 找：Id/Text/ManifestReference→Text；Collection 必须 elementType 命中 bounded Id/Text，并携带 item/text 四 bounds；Money→Money；其余失败。boundsOf Id/Text→声明 bounds，Money/Collection→None，ManifestReference→(1,128)，其余失败。checkOrder 从第一个 Money 起不准出现非 Money。argFieldRef 要 module.argsFields 的某字段对应 args slot 且 typeId 匹配，否则失败。aliases：text→String，collection→Vector[String]，money→argFieldRef.fqn|Money nominal 类型从实际已解析字段锚定，不按 type id 猜类名；整个 args/type 顺序保留|
|96–104 / B03|args codec / entry 使用 lastSegment；money 选第一个 Money codec（无则空），只取最后段。三个非空名必须匹配 `[A-Za-z_][A-Za-z0-9_]*`。lastSegment 434–438 要 `0 < lastDot < lastIndex`，否则失败|原 regex 未拒 Scala keyword；不要声称完整命名安全。package 等价性也未在这里验证，列 D1|
|106–139 / B04|participants.aggregate.targetName 去重→registry AggregateRootMetadata；base=getBaseName；Protocol 与 Aggregate.entityTypeKey 用 layout；reply 取 replyFamily.replies.headOption；query 取 commands.find(isReadOnly)；其 replyToType 必须存在。behavior/EventHandler/Entity 路径分别来自 application.aggregates.behaviors、domain.entities.behaviors/root；stateFieldsOf 与 eventFamilyOf 都按 metadata 引用解析，缺项失败|“第一 reply / 第一 readonly”不是 proof 唯一适用 query；D3 要输入协议裁定|
|143–152 / B05|keyMetaOf 对 `CustomType(_,_,Seq(key,_*))` 就返回 key（不是仅 Map），其它 None。phaseByStem 建 map 但未消费；stepPrepareKey/stepPrepareValue 为函数局部 mutable Maps|不能称 Builder 严格无可变数据；保留顺序前提、避免误把 Option(None)==None 当已证实相同 txid map|
|153–179 / B06|按 module.phases 顺序：取 technical command owner face；必须找到 TransactionId input；receiptFields 由 outputs，checkOrder；outputs 每个 slot 必须同名出现在 inputs。command metadata 用 `.get` 寻；commandExpr 按 **tech.inputs** 顺序（不是重排 command.parameters）拼 `input.slot`，仅目标参数 `CustomType("List",...)` 且 wire 是 collection 才加 `.toList`，最后追加 replyTo。receiptExpr=`SagaModule.Receipt(input.output1,...)`。resourceSlotName 是第一个 Args source==该 phase.address.resourceSlot 的 input|前置 admission 必须确保 inputs 顺序与 command 参数相符；不凭注释把顺序当已重新排序；未匹配 resource 时失败|
|191–210 / B07|Prepare：stateFields.find(writtenBy contains confirmationEvent+"."+txidSlot)，记录 keyMeta；Commit/Compensate：先有同 step prepare key，marker 分别 committed/compensated；要求 name+writtenBy+keyMeta 三条件的 hits 恰 1；其它 phase→None|Prepare 普通分支是 find，不是唯一性校验；顺序不可将 terminal 提到 prepare 前|
|211–240 / B08|Prepare 且存在 Money input 才建 value evidence。Money input 恰 1；同名/同 type Money output 必须有；同 event.txid lineage 候选恰 1；carrier 必须 `Map[key,value]` 等于 command txid/Money 参数 MetaType。formal semantics 对 base 名匹配恰 1；该 event/carrier fold row 恰 1 且 op=put、key=event.txidSlot、value=event.valueSlot；emissions 中 txid/Money bindings 分别严格等于单项 `(slot,param.slot)`。然后缓存该 step evidence|是精确值证据，不只是 contains；无 formal semantics 不能回退猜实现|
|241–288 / B09|非 Prepare 且该 step 有 Money evidence：prepare 恰 1；live field 恰 1；formal semantics 恰 1；同时校验 Commit 与 Compensate 各恰 1。每对必须同 aggregate/address、单一同 slot/type txid、单一同 resource slot、仅 txid 同 type output；marker 恰 1、类型=liveType、lineage=terminalEvent.txid；fold 恰 1，own marker 恰一 put(key=event.txid,value=state.live[event.txid])，live 恰一 remove(key=event.txid)，不得写 opposite；emission txid 恰一 param origin。记录 live/own/opposite|保持 txid-only terminal receipt，不扩展成全 payload proof；这是受限 profile 的存在/冲突观察，不是分布式 fencing|
|289–294 / B10|按 M 的全部字段序构造 FixturePhasePort；pinId/version 来自 tech.codecs.runtimeCodec；inputType/receiptType 带 moduleRef|pin 不可固定 1；源码 slot 单列，不扩大为万能 content|
|296–315 / B11|trigger 每 arg 必须 SourceField，且 src.slot==arg.slot；argSources 顺序=decl.args，boundsOf；moneySlots 按 shape 筛选，collectionSlots 携四 bounds；bindingType `SagaModule.`+firstUpper(member)+`Binding`；sourceIsCommand 看具体 SagaTriggerSource.Command|保留全部 trigger，不静默只发第一个 mapper；entry 另选首个 command 是另一限制|
|318–336 / B12|completion owner Aggregate 必须有；eventFamilyFqn=c.eventType.packageName+agg.eventFamilyRef.targetName；event 必须在 family；`event.producedBy.size==1` 才有 publicationCommandFqn；eventArgs=c.execution.inputs.map(_.slot)，kindWire=c.execution.kind.wire|不是按 RecordResult 名字猜 producer；构造字段顺序仍依 admission 对齐|
|342–357 / B13|强制第二 step 存在，取该 step Prepare、Commit；确认 event 必须能解析；fundingSeedEvents 使用 entity FQN+eventName 与 phase.outputs（checkOrder）|即使 multi 不发 test，Builder 仍强制第二 step；非二参与者资金/wafer例不可冒充普适 fixture|
|360–379 / B14|safetyChecks 八项顺序固定；capabilities=host.capabilities.map；supported 在 args 有 collection 时追加 bounded-collection-args/args-anchored-manifest；unsupported 非空失败。dependencyRefs=module.selfType ∪ 每 face Protocol ∪ 每 face Aggregate ∪ completion event TypeRef|dependencies 并未包含全部 runtime、codec、behavior/test import；JS 需区分文件依赖与源码 import，不回声填表|
|381–431 / B15|按 §3.2 的 RHS 构造 Host；namespace 固定 strict-saga；publication 是第一 step 的第一 phase face。collection-only extra data 从第二 step 真实 event.fields 标 List/Vector，fundingCommands 筛 Prepare/Commit；preparedField 取首 port evidence 或空；phaseCollections 收每 port collection names|fundingEventFields 的完整数据不等于模板完整消费。Builder 的未消费字段仍有账，不能当实现成功|

命名依赖 [NamingConventions 8–27](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L8-L27) 仍保留 strict 连字符→下划线，strictPhaseStem 只 firstUpper；不是用户要求的全 PascalCase resolver。`getBaseName` 属传统后缀去除；不能照搬“strict 名不用剥 suffix”来保留 HostHost。稳定 step/participant/codec/PID 值不参与源码重命名。

## 5. Template production 构造与 RHS 顺序

下文按输出顺序列完整构造；循环是模板循环，不是省略某类方法。`m/p/t/c` 指 §3 的实际模型。完整源码始终为 T；例中 `$...` 为模板插值，非凭空业务数据。

### 5.1 调度与 types / wire / args

来源 [T 15–295](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/FixtureHostTemplate.scala#L15-L295)。

|构造 ID / T 行|声明顺序、RHS、分支与处理|
|---|---|
|T00 / 15–33|generateFiles 先根据 moneyCodecName 选一份 wire 文件，再按 types→wire→ArgsCodec→Host→Entry 拼 Vector。moduleType.name!=SagaModule 时对 **production content 全文**做 `replaceAll("\\bSagaModule\\b",name)`；TypeRef 不替换；test dispatch 没有这次总替换。generateTestFiles 有 args collection→两个 renderCollectionSpec，否则 safety+deployment。不能把文本替换债说成 TypeRef 已全建模|
|T01 / 73–93|q 只外包双引号，不 escape；camel 直接 charAt(0).toLower+substring，无空值防护；simple 取最后点后。types 文件只有 package、合同说明、`object types`；aliases 按输入顺序逐个 `type id = targetFqn`（money），否则 collection=`Vector[String]`，否则=`String`。没有 import；不是新造名义 alias 合并权|
|T02 / 96–114|money alias targetFqn distinct 必须恰一，否则 IllegalStateException。文件 package→ByteString→strict.{CodecPin,PayloadCodec}→scala.util.{Failure,Success,Try}→wire 文档→`object StrictWire`→`implicit final class StrictWireOps(private val a:ByteString) extends AnyVal`，`++(b)=a.concat(b)`|
|T03 / 116–143|lengthPrefixed(String):ByteString：UTF8 bytes→new Array(4+len)→高到低四个 byte（>>>24/16/8/0 &0xff）→utf8.copyToArray(out,4)→ByteString.copyFrom(out)。readPrefixed(bytes,count):Try[(Vector[String],ByteString)]：Try 包 toByteArray、offset=0、Vector.newBuilder、i=0；while i<count，require offset+4<=length，位移/or 解 len，require offset+4+len<=length，new String UTF8，offset+=4+len，i+=1；返回 fields.result 和剩余 ByteString。没有显式 len>=0，也没有 REPORT decoder；不拿另一分支更强检查冒充本分支|
|T04 / 145–167|随后文件中间 `import StrictWire._`，文档，`object moneyCodecName extends PayloadCodec[moneyFqn]`。override pin=`CodecPin(moneyCodecName,1)`；encode=lengthPrefixed(minorUnits) ++ lengthPrefixed(currency)；decode=decodeWithRest.flatMap：leftover.empty→Success(money)，其它 Failure(IllegalArgumentException，要求恰两字段无尾字节)。decodeWithRest=readPrefixed(bytes,2).flatMap：Vector(minorUnits,currency),rest→Success((moneyFqn(minorUnits,currency),rest))；其它 Failure。**不做 Money 算法/单位转换或成功伪造**|
|T05 / 170–218|无 money 的 StrictWire 文件：package→ByteString→scala.util.Try；StrictWireOps(private val value).++(other)=value.concat(other)。lengthPrefixed 先 require value!=null，再 ByteBuffer.allocate(4+utf8.length).putInt(length).put(utf8).array。readPrefixed 使用 offset+4 检查、ByteBuffer.getInt、offset+=4、require length>=0 && length<=remaining；UTF8 decoder 对 malformed/unmappable 均 REPORT；累加 fields/offset/i，返回余量。lengthPrefixedAll 要 values!=null && size<=64，再以四字节 size 为初值 foldLeft concat 每项 lengthPrefixed。readPrefixedAll 要 bytes.size>=4，count 为前四 byte int，require 0<=count<=64，然后 flatMap readPrefixed(bytes.substring(4),count)。64 是技术常量，不等于每 contract 的 maxItems|
|T06 / 220–245|ArgsCodec 文件 package→ByteString→strict.{CodecPin,PayloadCodec}→scala.util.{Failure,Success,Try}→StrictWire._→包含 mapperFqn/runtime pin/字段序的说明；`final class argsCodecName extends PayloadCodec[argsFqn]`，override pin=CodecPin(argsPinId,argsPinVersion)；encode=encodeChain（缩进替换）；decode 有 collection 用 decodeFields，否则 decodeChain|
|T07 / 247–268|splitWire 分别 collect Text/Money 名。decodeChain 生成 `StrictWire.readPrefixed(bytes,textCount).flatMap { case (Vector(texts...),rest0) => ... }`；每 Money slot 按顺序 `moneyCodec.decodeWithRest(restI).flatMap { case (field,restI+1) =>`；末端 rest.empty→Success(resultType(texts++money 按序参数))，否则 Failure(`what wire: trailing bytes after the declared fields`)；按 Money 数关闭 braces，再关首 flatMap。无 Money 使用 rest0；无 Text 模式 Vector()|
|T08 / 270–295|decodeFields 对每 `(field,shape)`：首 source=bytes，否则 restN；Text→readPrefixed(source,1) 匹配 Vector(field)；Collection→readPrefixedAll；Money→decodeWithRest；flatMap 携 restN+1；末端若 fields 空用 bytes，否则末 rest，empty→Success(resultType(原字段序))，否则同尾字节 Failure；每 field 关 brace。encodeChain 按原字段顺序 text lengthPrefixed(value.field)、money codec.encode(value.field)、collection lengthPrefixedAll(value.field)，以 ` ++\n        ` 连接。empty encode 拼出空字符串不是合法业务默认，D4|

### 5.2 FixtureHost.scala

来源 [T 298–552](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/FixtureHostTemplate.scala#L298-L552)。

imports **按 raw 顺序**：`akka.actor.typed.{ActorSystem,Scheduler}`；`akka.actor.typed.scaladsl.AskPattern._`；`akka.cluster.sharding.typed.scaladsl.ClusterSharding`；`akka.persistence.typed.PersistenceId`；`akka.util.Timeout`；`com.google.protobuf.ByteString`；`net.imadz.infra.saga.strict._`；每 face 协议包 `{baseAggregate,baseProtocol}`（不显式排序/去重）；`scala.concurrent.{ExecutionContext,Future}`；`scala.util.{Failure,Success,Try}`；`StrictWire._`。项目 FQN 在 helper 签名/体内仍可能重复，raw 不等于 imports 已整洁。

|构造 ID / T 行|完整成员/循环规则与 body|
|---|---|
|H01 / 349–365|说明先声明 generated fixture、非认证；execute/prepare/query/terminal 语义与 ask failure→Unknown 注释；仅任一 phase 有 terminalEvidence 时插 Money evidence 限制说明。`object FixtureHost` 内两个 val：SupportedCapabilities:Set[String]=Set(m.supportedCapabilities 按序 q)；DeclaredInvariants:Set[String]=Set(m.businessInvariants)。无方法、无懒初始化|
|H02 / 367–379|`final class FixtureHost(system:ActorSystem[_],sharding:ClusterSharding)(implicit ec:ExecutionContext) extends module.Host`；先 import module._；private val canonicalArgsCodec=new argsCodecName；private implicit askTimeout=Timeout(settings.interactionTimeout)，askScheduler=system.scheduler；override argsCodec 返回同一个对象；override settings 每次构造 `StrictSagaCoordinator.Settings(FiniteDuration(interactionTimeoutMs,TimeUnit.MILLISECONDS),32)`|
|H03 / 382–399|requireImplemented(requirements:HostRequirements,types:Vector[TypeContract],argsCodec:ArgsCodecContract):Unit 按序：unsupported=requirements.capabilities.filterNot(SupportedCapabilities)，require empty；八项 safetyChecks `requirements.field==expected` 用 && 拼；六个 positive 项 totalDeadline/maxParticipants/maxInFlight/maxAttempts/phaseTimeout/queryTimeout；durableManifest；businessInvariants.forall(DeclaredInvariants)；argsCodec.runtimePin==指定 pin；types.ids.toSet==别名 ids 集合。不校验所有 TypeContract 内容/mapper ABI、不运行证明。requireIndependentNamespace(PersistenceId):Unit 仅 require id.startsWith(namespacePrefix+"/")|
|H04 / 300–320，401–403|每 face 三个 private 方法，按 face 输入顺序：lowerBaseEntityRef(id:String):EntityRef[Protocol.CommandsFamily]=sharding.entityRefFor(aggregateKeyFqn,id)；lowerBaseReplyAsk(id,construct:ActorRef[Protocol.Reply]=>Protocol.CommandsFamily):Future[Reply]=entityRef(id).ask(construct)；lowerBaseStateAsk(id):Future[QueryReply]=entityRef(id).ask(replyTo=>Protocol.Query(replyTo))。每 resource member 两个 override：`memberContract:AddressContract=SagaModule.memberContract`，`member(resource:String):String=resource`。资源方法原字符串含 margin `|`，由整个 renderHost 最终 `.stripMargin` 去除；抽离模板时必须保留这个格式处理顺序|
|H05 / 414–426，496–511|每 phase 生成 `def lowerStemBinding:module.UpperStemHostBinding = new ... { ... }`。先可选 observe；后 private val codec=new PayloadCodec[receiptType]；override pin=CodecPin(pinId,pinVersion)，encode/decode 按 T07/T08，decode 构造使用 simple(receiptType)。再 contract=module.lowerStemBindingContract；receiptCodec=codec；querySafety=DeclaredReadOnly；execute(identity,input):Future[PhaseOutcome[receiptType]]；query 同签名。匿名实现中无额外默认成功|
|H06 / 427–442|Prepare Money observe(identity,input,absent:=>PhaseOutcome):Future：stateAsk(input.resourceSlotName).map view；若 committed.contains(txid) OR compensated.contains(txid)→Unknown MONEY_PREPARE_TERMINAL_FACT；否则 live.get(txid)：Some(durable) 且 durable/inputMoney 非 null，minorUnits/currency 字符串精确相等→ConfirmedReceipt(identity,receiptExpr，其中 input.moneySlot 被 durable 替换)；其它 Some→Unknown MONEY_PREPARE_PAYLOAD_CONFLICT；None→按名参数 absent。recover 全异常→Unknown(`phase evidence query failed: ...`)。字符串 `.replace` 仍是技术债，不是结构化 receipt constructor|
|H07 / 443–458|terminal observe：stateAsk(resourceSlot).map；opposite.contains(txid) OR (ownMarker.contains(txid) AND live.contains(txid))→Unknown MONEY_TERMINAL_FACT_CONFLICT；否则 ownMarker.get：Some 非 null 且 minorUnits/currency 非 null/nonempty→ConfirmedReceipt(identity,原 receiptExpr txid-only)；其它 Some→Unknown MONEY_TERMINAL_FACT_UNAVAILABLE；None→absent；recover 同 H06|
|H08 / 459–474|query 优先 Prepare value evidence：observe(absent=NotExecuted `durable Prepare state has no transaction fact (controlled profile only)`,safeToRetry=true)；其次 terminal evidence：observe(absent=NotExecuted `durable aggregate state has no terminal fact for this phase (controlled profile only)`,true)；否则有 evidenceMap：**stateAsk(input.resource)**，contains→原 receiptExpr Confirmed，无→NotExecuted（raw s-string 是 `... txid $input.txidSlot` 的插值形状，不能改称全 identity proof）；recover→Unknown；没有 map→Future.successful(Unknown，no durable phase-mark evidence/fail-degraded)。D3/D5|
|H09 / 475–495|execute 同优先序。Prepare Money：replyAsk(input.resourceSlot,replyTo=>commandExpr).flatMap：Reply(None)→observe(absent=Unknown MONEY_PREPARE_ACK_WITHOUT_FACT)；Reply(Some(error))→observe(absent=NotExecuted error.code/message、no events persisted、safeToRetry=true)；recover→Unknown Prepare interaction failed。terminal 同形，成功缺事实为 MONEY_TERMINAL_ACK_WITHOUT_FACT，拒绝文案带 controlled profile，recover terminal interaction failed。普通 phase：**replyAsk(input.resource)**.map，None→Confirmed 原 receipt，Some(error)→NotExecuted(true)，**本分支没有 recover**；不能据 class 文档宣称所有 ask failure 都被转 Unknown|
|H10 / 514–542|每 trigger def member=new module.binding：contract=module.contractMember；map(source:sourceFqn):module.TriggerStart。先所有 Text `(slot,Some(min,max))` 的非 null/length bounds require；然后 collection 非 null、size min/max、每元素非 null/length min/max；再 Money 非 null、currency 非 null/nonempty require；最后 TriggerStart(source.idempotencyField,module.Args(argSources 每项 source.slot，collection 加 .toVector))。其它 shape 不额外检查。包括 event trigger，sourceIsCommand 只影响 entry 选择|
|H11 / 545–552|每 completion def member=new module.binding：contract=module.contractMember；map(identity:TransactionIdentity,input:inputType):eventFqn=`eventFqn(input.arg1,...input.argN)`，顺序=eventArgs；identity 参数在该 mapper 本体未用，不能添加伪身份校验或 publication 副作用。host 类随后关闭|

### 5.3 StrictSagaEntry.scala 与 FixtureReconcileAuthorizer

来源 [T 556–747](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/FixtureHostTemplate.scala#L556-L747)。构建期选首个 command trigger（没有则 IllegalStateException），首个 completion.eventFamily（没有则失败），publicationFace 按 m.publicationFaceBase 查（无则失败）；kindMember map 决定 status 分支；所有 completion 均进入 dispatch；eventTriggers=非 command 的全部。

Imports 原序：`akka.actor.typed.{ActorRef,ActorSystem,Scheduler}`；AskPattern._；Behaviors；ClusterSharding；`akka.cluster.typed.{ClusterSingleton,SingletonActor}`；`akka.contrib.persistence.mongodb.ScalaDslMongoReadJournal`；PersistenceQuery；EventEnvelope；PersistenceId；`akka.stream.{KillSwitches,Materializer,SystemMaterializer,UniqueKillSwitch}`；`akka.stream.scaladsl.{Keep,Sink}`；Timeout；strict._；每 face Protocol；`scala.concurrent.{ExecutionContext,Future}`；`scala.concurrent.duration._`。

|构造 ID / 行|声明 / RHS / 副作用顺序|
|---|---|
|E01 / 610–645|说明→object entryName；`val NamespacePrefix=namespacePrefix`；`def persistenceId=PersistenceId.ofUniqueId(s"$NamespacePrefix/${SagaModule.Name}")`。spawn(system,sharding,reconcileToken)(implicit ec):ActorRef[Coordinator.Command]：require token 非 null/nonempty→new FixtureHost→system.systemActorOf(SagaModule.behavior(pid,host,FixtureReconcileAuthorizer(token)),s"${SagaModule.Name}-strict-saga-coordinator")。spawnClusterSingleton 同 guard/host，但 ClusterSingleton(system).init(SingletonActor(同 behavior,同 name))。start(coordinator,host,source:首 command sourceFqn,replyTo:ActorRef[Coordinator.Reply]):Start=`SagaModule.triggerMemberStart(source,host,replyTo)`；coordinator 参数未使用|
|E02 / 647–697|installEventSource(system,sharding,coordinator)(implicit ec):UniqueKillSwitch：new host→implicit Materializer→命名 replySink actor（任何 Reply 返回 Behaviors.same）→coordinatorJournalId→PersistenceQuery(system).readJournalFor[ScalaDslMongoReadJournal](固定 readjournal id)→allEvents→viaMat(KillSwitches.single)(Keep.right)→toMat(Sink.foreach[EventEnvelope])(...Keep.left).run。coordinator PID envelope：仅 Succeeded/Aborted，implicit scheduler/Timeout(15.seconds)，ask GetStatus；Status(state) 且 terminal 时 publishCompletion.failed.foreach stderr；其它快照/事件 ()；GetStatus failure stderr。其它 PID envelope：每 eventTrigger 类型匹配 coordinator ! triggerStart(ev,host,replySink)，其它 ()。不是 durable offset projection；没有 completion 重试持久队列、没有 stream failure 自愈；KillSwitch 生命周期由调用方持有|
|E03 / 699–703|status(coordinator)(implicit timeout,scheduler,ec):Future[StrictState]：ask GetStatus.map，Status→state，其它 IllegalStateException unexpected reply|
|E04 / 708–717|completionEvent(identity,args,host,state):Option[eventFamilyFqn]：state.status match；若声明 succeeded 才发 Succeeded→Some(succeeded)；只有 compensated 和 rejected-before-effects 都声明时才发 Aborted→检测任意 Evidence.Confirmed(op,_) 且 op.phase==Prepare，Some(compensated 或 rejected-before-effects)；若声明 recovery-required 才发 RecoveryRequired→Some(recovery-required)；其它 None。kind.map 对每 completion kind→module.memberEvent(identity,args,host)，其它 IllegalStateException。即使声明 outcome-unknown，raw statusMatch 也没有自动产生它的分支|
|E05 / 725–734|publishCompletion(sharding,host,state)(implicit timeout,scheduler,ec):Future[publicationFace.replyFqn]：state.identity.getOrElse 抛错→host.argsCodec.decode(state.argsBytes).get→completionEvent.getOrElse 抛错→sharding.entityRefFor(publicationFace.aggregateKey,args.publicationSlot)→event match 每 completion 类型→entityRef.ask(replyTo=>publicationCommandFqn(identity.transactionId,replyTo))；其它抛 unmapped。eventArgs 并不转传进 publication command，命令构造固定 txid+replyTo；reply 原样返回，**不检查 error**。必须校验输入契约，不声称任何 completion command 形状可用|
|E06 / 737–746|object 后 `final case class FixtureReconcileAuthorizer(expected:String) extends ReconcileAuthorizer`；authorize(identity,token):Either[String,String]：null token/expected 各变 Array.emptyByteArray，否则 UTF8；expectedBytes.length>0 && MessageDigest.isEqual(provided,expectedBytes)→Right("fixture-reconciler")，否则 Left("reconciliation token mismatch")。identity 本体未用，无 I/O；这不是生产认证服务，不迁移测试 token 为默认配置|

## 6. Test 产物账：完整 emission，不是已经测试通过

### 6.1 money FixtureSafetySpec

来源 [T 751–1359](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/FixtureHostTemplate.scala#L751-L1359)，插入资源见 §7。renderSafetySpec 构建期必须有 publication face、唯一 Money FQN、首 phase、command trigger、恰一个非 identity/source/money 的目标 text slot；否则抛异常。startArgExpr 按 idempotency→opId、Money→amount、publication→From、other→To 匹配。sourceHelpers 仅首 step 的 phases；slot 必须 txid/resource/Money，分别参数 txid:String/id:String/amount:moneyFqn，否则抛错；按 commandSlots 顺序发送 Protocol.command(...,replyTo)。funding seed 每 Text output 用 txid、每 Money 用 SeedAmount，其它 shape 抛错。publication 用 completions.head，不能据此假定它必定 succeeded。

raw imports 顺序为 ActorRef/ActorSystem/Behavior/Scheduler；AskPattern._；ActorTestKit；ClusterSharding/Entity/EntityRef；Cluster；PersistenceId；PersistenceTestKit；Timeout；Config/ConfigFactory；strict.{Evidence,Phase,StrictSagaCoordinator,StrictState,StrictStatus}；typed.scaladsl.adapter._；AnyFunSuite；随后五个 project imports（Protocol+Aggregate 同句、Entity、Behaviors、EventHandler）；最后 Await/ExecutionContext、duration._。class `FixtureSafetySpec extends AnyFunSuite` 没有显式主构造参数或 companion。

|构造 ID / T 行|按 emission 顺序的成员及完整结果义务|
|---|---|
|S01 / 842–864|说明分 A/B/C/D、testkit 与 Mongo、非手写；private val Money=moneyFqn companion；Currency="XTS"；SeedAmount=Money("100000",Currency)；From="alice"；To="bob"；ReconcileToken 为模板测试常量，不是本次读取任何凭证|
|S02 / 866–892|singleNodeConfig():Config=parseString(local,WARNING,testkit journal/snapshot class/plugin).withFallback(ConfigFactory.load)。clusterConfig(port,seeds):Config 同 testkit+cluster、127.0.0.1 artery canonical/bind、端口参数、seed-nodes、multi-mbeans；raw 有重复 journal/plugin 行。保留原配置内容账，不以当前用户环境替换|
|S03 / 894–946|aggregateBehavior(entityId):Behavior[Commands]=EventSourcedBehavior(named persistenceId=PersistenceId(entityTypeKey.name,id),emptyState=Entity.empty(id),commandHandler=Behaviors.apply,eventHandler=EventHandler.apply)。seedFunds 在 spawn 前 PersistenceTestKit.persistForRecovery(pid,Vector(seedEvents))。askNow[Cmd,Res](kit,RecipientRef[Cmd])(f:ActorRef[Res]=>Cmd):Res 设 implicit system、Timeout(10s)，Await.result(ref.ask(f),10s)。stateOf=ask query.state；balance=BigInt(state.accountBalance(Currency).minorUnits)。initSharding 构造、init(Entity(key)(ctx=>aggregateBehavior(ctx.entityId)))、返回 sharding；entityRef=entityRefFor。awaitMembers 30s/200ms 轮询 members.size>=n，否则 require。awaitTerminal 60s/200ms 轮询 status（每次 Await 10s），terminal 或 RecoveryRequired 或 deadline 停，返回 state，不替调用方 assert 成功|
|S04 / 948–998|startSaga 建 host/probe/source，再 `coordinator ! entry.start(...)`；source 构造是 **额外 opId + startArgs + reply probe**，若 argSources 本身含 identity 会重复，D3。MongoHostPort 从模板环境键取默认 localhost:27017；mongoUri(db) 字符串；mongoReachable 创建 Socket，connect timeout 2000，finally close，Throwable→false。mongoClusterConfig 真实 Mongo journal/snapshot、RxMongo driver+uri+cluster 参数，fallback load。seedFundsByCommands 固定 RecordIncomingCredits(txid,"deployment-seed",SeedAmount,replyTo)→assert no error→CommitIncomingCredits(txid,"deployment-seed",replyTo)→assert no error。然后插 sourceHelpers。这些硬编码不由 fundingCommands 驱动|
|S05 / 1004–1057|A1：seed a1→Prepare 100→error empty，balance 99900，reservedAmount(tx).minorUnits=100→Commit→error empty，balance 99900，committed=100，reserved 不含 tx。A2：Prepare 50→Compensate→error empty，balance 100000，compensated=50，reserved 不含 tx。A3：两次 Prepare 30，replay.error empty、reserved=30、balance99970；两次第一 completion publication command(tx-result,replyTo) 均 no error；sagaResults(tx-result)=第一 completion.kind 且 size=1。每测试 finally shutdownTestKit|
|S06 / 1061–1081|assertPublished 设 system/ec/Timeout10s→Await publishCompletion→assert error empty→发起账户 sagaResults(identity.txid)==expectedKind。awaitPublished 30s/200ms 轮询 state.sagaResults（初 Map.empty），末 assert 指定 kind；不会主动调用发布|
|S07 / 1083–1119|B1 cluster/freePort→init/await1→seed From/To→singleton→start 100→await→Succeeded、99900/100100→assertPublished succeeded。B2 同过程金额999999→Aborted、100000/100000→assertPublished rejected-before-effects。每 finally shutdown|
|S08 / 1121–1124|依次插 money-prepare-evidence、money-terminal-evidence、money-prepare-terminal-barrier、money-incoming-positive 的**完整类内文本**；包含 imports、helper、测试循环，不能只计四个空 slot；详见 §7|
|S09 / 1127–1172|C1 cluster→seed→spawn 非 singleton→start20→sleep250ms→classic PoisonPill；again=null，20s/200ms spawn 重试 catch Throwable；require again 非 null→status identity required→Reconcile(identity,token,32,probe)→awaitTerminal→assert terminal 或 RecoveryRequired。Succeeded 99980/100020；Aborted 双100000；否则仅 assert RecoveryRequired；finally shutdown。sleep 不是确定中途崩溃屏障，不能宣称 JVM 重启证明|
|S10 / 1176–1205|D1 assume Mongo reachable→run-scoped DB nanoTime→两个 ActorTestKit 同 seed/uri→各 init/await2→通过命令给双账户 seed→双 singleton init→从 B start100→Succeeded，跨节点余额99900/100100→A assertPublished；finally B 再 A shutdown|
|S11 / 1207–1236|D2 assume Mongo→独立 DB/cluster→seed→singleton→installEventSource **先于** aggregate trigger command→require reply.error empty→await Succeeded/identity.txid==opId→余额→awaitPublished，禁止手动 publish 代替源；finally shutdown|
|S12 / 1238–1278|D3 assume Mongo 与 java.class.path 含 target/scala-2.13（要求 Test/fork）→DB/port/seedAddr→mkdir target/deployment-face→ProcessBuilder java -cp testclasspath package.FixtureDeploymentNode（redirect log/stderr）→seed；30s/200ms Socket 等 bind→join(args opId/From/To/100)→wait180s，assert done/exit0→读 join log（finally close）→assert D3-RESULT Succeeded/opId、alice99900/bob100100；finally join.destroy，seed.destroy+wait10s。不是本轮运行许可|
|S13 / 1280–1283|freePort():Int 使用 ServerSocket(0)，try localPort finally close；只是预选端口，不是租约|
|S14 / 1285–1345|D4 与 D3 同配，另 tailOf 读取/关闭日志；启动 failover 节点→60s/25ms 等 D4-STARTED→seed.destroy（源码说明 SIGTERM/graceful leave，不是断电）→wait30s→join.wait180s→assert exit0、D4-RESULT/opId/余额/ledger=succeeded；finally 清理。不能把注释中的 failover 词当所有崩溃模型证明|
|S15 / 1347–1358|最后 production conf 测试 ConfigFactory.load，断言 journal plugin、snapshot plugin、RxMongo driver 字符串，mongouri hasPath；仅 parse，不实例化 journal；class 关闭|

### 6.2 money FixtureDeploymentNode

来源 [T 1418–1653](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/FixtureHostTemplate.scala#L1418-L1653)。构建期从 publication face、Money、首 command trigger、唯一 otherSlot 推 startArgs（idempotency→opId/Money→amount/publication→from/other→to，其它失败）。

Imports 顺序为 ActorSystem/Behavior；Behaviors；AskPattern._；ClusterSharding/Entity/EntityRef；Cluster；PersistenceId；Timeout；Config/ConfigFactory；strict.{StrictSagaCoordinator,StrictState,StrictStatus}；Protocol、Aggregate、Entity、Behaviors、EventHandler 各一句；Await/ExecutionContext；duration._。无 class，只有 `object FixtureDeploymentNode`。

|构造 ID / T 行|完整 body / 默认值与次序|
|---|---|
|N01 / 1460–1474|说明/usage→Money companion、Currency XTS、SeedAmount100000、测试 ReconcileToken 四 private vals|
|N02 / 1476–1506|main(args:Array[String]):Unit 在 try **之前** require args.length>=4，取 role/port.toInt/seedAddr/uri；try 内 parse Mongo+cluster config/fallback；systemName 从 seedAddr 在 @ 前倒序取字母数字再倒序；implicit ActorSystem[Nothing](Behaviors.empty,systemName,config)，ec；init sharding aggregate；spawnClusterSingleton|
|N03 / 1507–1543|role seed→Await.result(system.whenTerminated,Duration.Inf)。join→require8→awaitMembers2→fund From/To 固定 seed-d3 ids→取 opId/from/to/amountMinor→Money(...,XTS)→Timeout15s→installEventSource→ask aggregate trigger（同 extra opId+startArgs）→require reply.error empty；90s/300ms status 轮询（Await15s）→require terminal+Succeeded→balance双账户→awaitLedger succeeded→打印 D3-RESULT→require99900/100100→terminate/Await.ready15s/sys.exit0|
|N04 / 1544–1600|failover 与 join 初始化相同但 seed-d4 ids；60s/25ms status gate，Await3s/catch Throwable→null，require identity→print D4-STARTED；命名 reconcileSink 吞 Reply；150s/300ms status loop，Await5s/catch→null，有 nonterminal identity 就发送 Reconcile(token,32,sink)；require terminal+Succeeded→余额/awaitLedger→D4-RESULT ledger=succeeded→require balances→terminate/Await.ready/exit0。未知 role IllegalArgumentException；外层 catch Throwable printStackTrace/exit1。不将生产进程生命周期隐藏在纯函数层|
|N05 / 1602–1617|awaitMembers 同30s/200ms；entityRef=sharding.entityRefFor；aggregateBehavior 同四 named args EventSourcedBehavior；返回 Commands Behavior|
|N06 / 1621–1650|fund(system,sharding,id,txid)：implicit system/Timeout15s，先 RecordIncomingCredits(...SeedAmount) Await15s/require error empty，再 CommitIncomingCredits Await15s/require。balance：query Await15s，BigInt(state.accountBalance(XTS).minorUnits)。awaitLedger：Timeout15s、30s deadline、Map.empty、200ms轮询 query.state.sagaResults，最后 require expectedKind；关闭 object|

## 7. 外置资源也是 Template 内容，不能从账中消失

这些源是额外当前只读材料，**不冒充冻结 BC 副本**。绝对路径 + SHA 记录在 detail.extraSources；后续先检查字节未漂移，才能复用本段。P19/P20 的字节还恰等冻结 JS 同名资源（可用固定链接），P21/P22 不等，不能替换 BC 来源。

|资源 ID|原路径（完整内容）|SHA-256 / bytes|
|---|---|---|
|R1|[/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen/src/main/resources/codegen/templates/bounded-collection-FixtureSafetySpec.scala.tpl](/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen/src/main/resources/codegen/templates/bounded-collection-FixtureSafetySpec.scala.tpl#L1-L571)|`9bf0de74ea6ee867f5eedb851dc6a6d4ce10060d110763893d99f3b4f7cdf72f` / 34734|
|R2|[/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen/src/main/resources/codegen/templates/bounded-collection-FixtureDeploymentNode.scala.tpl](/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen/src/main/resources/codegen/templates/bounded-collection-FixtureDeploymentNode.scala.tpl#L1-L217)|`c8fcde0fb8ac9e77d597a5c958de9636dd2009ff8f1e9db69fee98e74e3e2ce0` / 13341|
|R3|[/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen/src/main/resources/codegen/templates/money-prepare-evidence.scala.tpl](/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen/src/main/resources/codegen/templates/money-prepare-evidence.scala.tpl#L1-L269)；[同字节冻结 JS 副本](../baseline/js/generators/saga-dsl/templates/money-prepare-evidence.scala.tpl#L1-L269)|`d8054bd55326fbc6441ddce2ac05d2536fdb6b44f0326a760941ea6a26c2141e` / 17252|
|R4|[/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen/src/main/resources/codegen/templates/money-terminal-evidence.scala.tpl](/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen/src/main/resources/codegen/templates/money-terminal-evidence.scala.tpl#L1-L268)；[同字节冻结 JS 副本](../baseline/js/generators/saga-dsl/templates/money-terminal-evidence.scala.tpl#L1-L268)|`8fab37329b1a8b269fcc7acbf178c405db088a3dd33abd73be3acc00773afc6a` / 20764|
|R5|[/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen/src/main/resources/codegen/templates/money-prepare-terminal-barrier.scala.tpl](/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen/src/main/resources/codegen/templates/money-prepare-terminal-barrier.scala.tpl#L1-L144)|`962cb3b873aaa9157ae899af560969aef4e4d33e42dcce98254504be6de659c8` / 9819|
|R6|[/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen/src/main/resources/codegen/templates/money-incoming-positive.scala.tpl](/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen/src/main/resources/codegen/templates/money-incoming-positive.scala.tpl#L1-L100)|`2be68a34dfef0a922dd54a6f2bc4f5860b1a7d4bcebf21b707df67383de008ed` / 6841|

### 7.1 collection 资源替换和逐构造内容

[T 35–71](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/FixtureHostTemplate.scala#L35-L71)：publication face/首 command trigger/首 phase.stepId；phase(source,kind) 用“是否属于首 step”布尔条件寻找，缺失抛 IllegalArgumentException。values 的全键：PACKAGE、ENTRY、ENTITY、BEHAVIORS、EVENT_HANDLER、PROTOCOL_PACKAGE、PROTOCOL_NAME、AGGREGATE_NAME、COMMAND_FAMILY、REPLY、TRIGGER_NAME、QUERY_NAME、FUND_PREPARE_EVENT、FUND_COMMIT_EVENT、FUND_PREPARE_COMMAND、FUND_COMMIT_COMMAND、FUND_PREPARE_NAME、FUND_COMMIT_NAME、SOURCE_PREPARE_COMMAND、SOURCE_COMMIT_COMMAND、SOURCE_COMPENSATE_COMMAND、TARGET_COMPENSATE_COMMAND、SOURCE_PREPARE_HELPER、SOURCE_COMMIT_HELPER、SOURCE_COMPENSATE_HELPER、TARGET_PREPARE_HELPER、TARGET_COMMIT_HELPER、TARGET_COMPENSATE_HELPER、PUBLICATION_COMMAND、PREPARED_FIELD。值分别取模型对应 face/FQN/首末 funding/phase stem camel，PUBLICATION_COMMAND 必须找 succeeded completion。打开对应 `/codegen/templates/bounded-collection-<name>.scala.tpl`，require stream!=null，UTF8 readAllBytes，finally close；Map.foldLeft 对 `@KEY@` 做 String.replace；require 无剩余 `@[A-Z_]+@`；最后**全文件 `.replace(".toList", ".toVector")`**。因此 raw 实际 emitted collection calls 是 Vector，不可只读资源文本就断言 List。

|范围|逐构造/RHS 与 S/N 的有界重复关系|
|---|---|
|R1 1–81|generated header、package；imports 与 S 相同（project import 以 placeholders）；class FixtureSafetySpec extends AnyFunSuite；private vals SeedWafers=Vector(w-001…w-004)、SplitWafers=w-001/w-002、ChildBaseWafers=w-101、ManifestSeed=manifest-seed-v1、From=parent-lot、To=child-lot、测试 token。singleNodeConfig/clusterConfig 与 S02 同语义；aggregateBehavior 与 S03 相同 named args。不得把这些 wafer 常量换成银行数据|
|R1 85–193|seedFunds(kit,id,txid,wafers:Vector[String]=SeedWafers) persistForRecovery 两事件，参数依次 txid/seed-reservation或seed-receiptId/wafers；最终 `.toVector`。askNow/stateOf/initSharding/entityRef/awaitMembers/awaitTerminal 同 S03；carriedOf=state.carried.keySet.toSet，替代 balance；startSaga 固定 trigger(opId,From,To,wafers,ManifestSeed,replyProbe)。Mongo/uri/reachability/config 同 S04；seedFundsByCommands 带 wafers 默认值，prepare+commit 都 `(txid,"deployment-seed",wafers,replyTo)`；六个 phase helpers：source prepare/compensate 带 wafers、source commit不带；target prepare/commit带、compensate不带；均 askNow，类型来自替换表|
|R1 197–250|A1 Prepare SplitWafers→carried=Seed−Split、prepared contains；Commit→committed contains、prepared absent，carried 不再变。A2 Prepare+Compensate→carried=Seed、compensated contains、prepared absent。A3重复 Prepare→no error、prepared contains、carried=Seed−Split；两次 PUBLICATION_COMMAND→no error、sagaResults succeeded且 size1。finally shutdown|
|R1 254–338|assertPublished/awaitPublished 同 S06；B1 From Seed、To ChildBase，saga Split→Succeeded，From Seed−Split，To ChildBase∪Split，published succeeded；B2 w-404→Aborted，两边原集合，published rejected-before-effects；B3 target 预存 FUND_PREPARE_EVENT(op-b3,seed-reservation,Split)，source Prepare 后 target 拒绝→Aborted、source Seed、source.compensated contains，published compensated。此 fixture 拒绝机制不套用 Money 同额已 Prepare 情况（P19 已另改为显式 pre-dispatch refusal）|
|R1 342–450|C1 同 S09 PoisonPill/respawn/Reconcile，成功集合差/并，Aborted 原集合，RecoveryRequired 单独；D1双节点真实命令资金入口（To用 ChildBase）、跨节点集合断言/手动 assertPublished；D2 eventSource先安装→aggregate trigger→Succeeded identity/opId/集合→awaitPublished。配置、等待、finally 顺序同 S10/S11|
|R1 452–571|D3/D4 完整 ProcessBuilder/端口轮询/等待/日志/清理同 S12/S14；node 末参 wafer CSV `w-001,w-002`，结果检查 from-carried=2、to-carried=3，D4另 ledger succeeded；freePort 在 D4 **之后**，最后 conf parse 断言与 S15相同。没有把此顺序假装等于 money 的 freePort位置|
|R2 1–71|header/package；imports 比 money Node 多 Scheduler，项目 Protocol+Aggregate 同一句；object；八个 wafer/manifest/from/to/token 常量同 R1。main require4、parse args、try config、systemName、ActorSystem/ec、sharding、singleton 同 N02|
|R2 72–167|seed 无限等待；join/failover 要8个参数，fund From SeedWafers / To ChildBaseWafers；wafers=args(7).split(',').toVector，require nonempty；trigger固定 opId/from/to/wafers/ManifestSeed/replyTo；join90s status；failover60s gate+150s reconciliation；carriedOf 两集合/awaitLedger；D3/D4 输出计数，assert真实集合等 Seed−Split / ChildBase∪Split；terminate/Await/exit；unknown role throw，catch print/exit1。保留资源中的缩进异常和 `$$state` 文案债，不以格式化掩盖字节差|
|R2 169–217|awaitMembers同 N05；entityRef/aggregateBehavior同 N05；fund 带 wafers，无默认，prepare/commit 两次 Ask15s；carriedOf 查询 state.carried.keySet.toSet；awaitLedger 同 N06；object 关闭。所有 `.toList` 最终变 `.toVector`|

### 7.2 money 类内四个资源的完整成员/循环账

[T 1361–1415](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/FixtureHostTemplate.scala#L1361-L1415) 四个 render helper 都打开资源→require stream→UTF8 readAllBytes/finally close→Map.foldLeft 替换→require 无 unresolved slot。R3 替换 MODULE/ENTITY/AGGREGATE/MONEY；R4 加 COMMANDS；R5 加 RULES/RULE_PARAMS，两者都取 `domainPrefix.invariant.<base>Rules`；R6 同 R5但无 AGGREGATE。domainPrefix 按 `.entities.` 截断。这些是依赖真实规则接口的源码槽，不是任意领域测试 DSL。

|范围 / 构造|完整循环条件、body 与验收结果（未运行）|
|---|---|
|R3 1–43|类内 import strict.{ConfirmedReceipt,NotExecuted,OperationIdentity,OperationRequest,PhaseBinding,PhaseOutcome,PhasePort,StrictSagaDefinition,TransactionIdentity,Unknown} 和 Future；p19Events 从 testkit journal filter 六个固定 CreditBalance event 子型的 txid，其余false；p19Identity 建 digest=`sha256:`+64个0，TransactionIdentity(txid,Name,Version,digest,DefinitionDigest,argsCodec.pin,digest)，OperationIdentity source/target、resource、reserve-source/target、Prepare。p19Refusal 原 definition.copy(participants)：只 target Prepare 换 new PhasePort，receiptCodec/querySafety委托 binding；execute attempts.incrementAndGet→Future.successful(NotExecuted(P19_TEST_PRE_DISPATCH_REFUSAL,true))，**不派发 target 命令**；query委托真实 binding，participant.phases.updated(Prepare,PhaseBinding(port))|
|R3 45–70|B3 使用 p19Refusal，seed双账户；记录target state→coordinator strict-saga/p19-b3→Start70→Aborted；attempts1、target tx events空且 state不变、source balance100000/compensated70→assertPublished compensated；finally shutdown|
|R3 72–116|source∈{true,false}：seed、identity、局部 execute/query 委托相应 Prepare；first execute30→Confirmed；state/events保存且 events1；execute/query同额==first；按 source/target typed receipt比较 codec bytes 与 durable reservedAmount/incomingCredits。conflict∈{31 XTS,30 USD,030 XTS}：query和execute均 Unknown MONEY_PREPARE_PAYLOAD_CONFLICT；events/state不变。finally shutdown|
|R3 118–147|source×commit 两布尔四组合：Prepare30→Confirmed；对应四种 terminal execute→Confirmed；Prepare query→Unknown MONEY_PREPARE_TERMINAL_FACT；journal不新增；finally shutdown|
|R3 149–187|conflict∈false/true 分别注册测试：target预先Prepare70/71，Start70；equal→Succeeded，仅一次 RecordIncomingCreditsConfirmed，余额99930/100070、published succeeded；conflict→RecoveryRequired、Uncertain冲突前缀、target journal保持、source reserved70无compensated、target incoming71；finally shutdown|
|R3 189–268|conflict两测试：held Promise 保留 source Prepare ACK；wrapped execute 计数，真实 binding 发20或21，Confirmed时 durable.trySuccess然后 held.future；query始终用request.amount并记录 queried Promise。替换 source Prepare；Start20→await真实durable、journal1/state=receipt；await RecoveryRequired/Uncertain→kit.stop→同pid spawn→GetStatus identity/status保持→Reconcile token32→query evidence。conflict→Unknown、仍RecoveryRequired、source无新增target空、99979/100000；equal→Confirmed精确 OperationIdentity/receipt、Succeeded、source Prepare事件一次、99980/100020、发布；executes始终1；finally fail held/shutdown。不是制造成功 Saga history|
|R4 1–48|p20Port(host,source,commit)(implicit ec):PhasePort[Args,String]：phase选择；anonymous PayloadCodec[String] 的 pin/encode/decode 四分支分别委托四个真实 terminal receipt codec（String txid↔具体 Receipt），不改变实际 wire；外 new PhasePort receiptCodec=codec，DeclaredReadOnly；private invoke 取 txid、source/target资源、identity.copy(phase)，四分支各 binding/input，query布尔选 query/execute，map Confirmed receipt.txid、NotExecuted原样、Unknown原样；execute/query转 invoke(false/true)。这是测试适配，不准把生产 nominal receipts 合并 String|
|R4 50–86|source×commit 四组合：Prepare30，terminal.execute==Confirmed(txid)，events2、ownMarker amount、live absent；balance sourcecommit99970/targetcommit100030/其它100000；重复execute/query相等；codec(txid)==StrictWire.lengthPrefixed(txid)；opposite query/execute均Unknown MONEY_TERMINAL_FACT_CONFLICT；state/events不变|
|R4 88–142|synthetic(id):empty/failure→empty；live-only→两live maps；both→两terminal；commit-live/compensate-live→own+live；null/bad marker→null 或 Money空minor；其余own marker。synthetic actor Query failure时 Promise+stopped，正常query返回 synthetic state，四terminal command回None，其它unhandled；四port遍历：empty/live-only query=NotExecuted(true)，false-ACK execute=Unknown ACK_WITHOUT_FACT；both/live→CONFLICT，null/bad→UNAVAILABLE；failure query→Unknown query failed。明确 synthetic 不是 runtime durable evidence|
|R4 144–268|六元组 `(source,commit,conflict)`=(T,T,F),(F,T,F),(T,F,F),(F,F,F),(T,T,T),(T,F,T)。wrapped terminal执行真实选中或对立port，持有ACK、计数/queried。targetPrepare：source场景显式 pre-dispatch NotExecuted；非source场景真实 Prepare但持有ACK；仅Compensate场景替换target Prepare。Start20；非commit且非source等待target真实prepare→GetStatus确认无commitDecision且Prepare pending→Abort并确认abortRequested。await durable txid/RecoveryRequired、decision/evidence正确、marker真实、事件前态保存；kit.stop/spawn/GetStatus全态相等；Reconcile后 conflict保持RecoveryRequired/前态/journal；否则 Confirmed(txid)、Succeeded或Aborted、成功99980/100020否则双100000；选中participant journal不再增；Commit两确认各1且无补偿，Compensate release1/cancel按source为0或1且无commit；Evidence.Confirmed bytes准确，executes1，发布相应kind；finally关闭两个held Promise/shutdown|
|R5 1–21|p21AllEvents=整个pid journal.toVector；p21PrepareCommand source选 ReserveFunds/RecordIncomingCredits；p21TerminalCommand source×commit四命令；p21Fund 真实RecordIncomingCredits+CommitIncomingCredits、均error.empty；p21Amounts=30XTS、31XTS、30YTS、0XTS、-1XTS、not-minor XTS|
|R5 23–54|source×commit四测试：fund→Prepare30→terminal→events(tx)2/journal4；own marker30/opposite absent/live两者absent；balance三分支同R4；late(ref)遍历全部p21Amounts，Prepare error=60011(commit)或60012，state/journal不变；stop/recover同journal再late|
|R5 56–90|real Host四组合，真实Prepare+terminal；保存typed receiptBytes/state/journal；六金额的Prepare query/execute均Unknown TERMINAL_FACT，不重开事实；terminal query仍相同 Confirmed且 bytes不变|
|R5 92–122|source×commit×terminalFirst八组合：同一线程对同ref按顺序发terminal/Prepare或反向；terminalFirst第二reply必须60011/60012；live-repeat-first source成功、target60007，然后terminal成功；events2/journal4，own marker/live消失/余额正确。无sleep假装mailbox证明|
|R5 124–144|synthetic rule precedence：base两live+balance；states owncommit→60011、compensated→60012、both→60011、nullcommit→60011、badcompensated→60012；source两值×states×六Money要求Left(expected)；base source live重复=Right(Nil)，target live=Left60007。直接规则测试不等于宿主运行|
|R6 1–36|commit×minor∈{0,-1}四测试：真实fund后journal2；rejected(ref)：RecordIncomingCredits60004、不改state/journal、tx events空；Commit60008、Cancel60009且仍不变；stop/recover再rejected；同txid改Money30成功，incoming30；terminal commit/compensate成功→balance100030/100000、own marker30/opposite absent/live空、events2/journal4|
|R6 38–84|real Host target Prepare 两个非法minor：query NotExecuted(identity,true,无transaction fact)，execute拒绝含60004，再query同absence，state/journal不变；改30→Confirmed typed receipt(txid,amount)，incoming30、balance仍100000、events1/journal3；repeat execute/query相同；改0/-1后execute/query均Unknown PAYLOAD_CONFLICT且state/journal/原codec bytes保持|
|R6 86–100|synthetic RecordIncomingCreditsRule 优先级：empty60004、live60007、committed60011、compensated60012、both60011；每state×{0,-1}返回对应Left；正常amount30→Right(List(RecordIncomingCreditsConfirmed(txid,amount)))。R5/R6 raw 使用规则本身嵌套 Params；JS 用独立 RuleParams，必须连规则制品一起定接口|

## 8. JS 三条可达链与四层差异

### 8.1 formal 银行链

[generate-cli 92–101](../baseline/js/lib/products/generate-cli.mjs#L92-L101) 通过 shipped directory realpath 选择 producer，不能凭文件夹名推断消费。[play-service generate 16–29、59–70](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L16-L70) 继承 createEffectRegistry('2')；[produce-effect 6–19](../baseline/js/generators/scala-cqrs-application/produce-effect.mjs#L6-L19) 委托 applicationRegistry；[produce 17–33](../baseline/js/generators/scala-cqrs-application/produce.mjs#L17-L33) 的 finite-host-dsl 实际合成 Definitions / InvocationHosts / HostAdapters / TechnicalPorts / HostIO / Verification。其中 [renderDefinitions 全文 1–59](../baseline/js/generators/scala-cqrs-application/render-host.mjs#L1-L59) 是 typed injected ports 的桥，不是调用 emitStrictHostFiles。

- Model：products `reference-layout/saga-host-contract/saga-runtime-contract/...`，不是 FixtureHostModel。host 包括任意 participants、完整 nominal receipt/query identity、external installed declarations；不能倒灌成固定 CreditBalance fields。
- Builder：render 内混合 resolve field、nominal unwrap/wrap、identity part mapping、command param projection、preceding receipt lookup；input source仅 transaction-id/args直接取，其余 producer receipt需存在，否则 fail。
- Template：一个 Definition object 中混合 Args alias、PB args/receipt codecs、Ports、fromTechnical、每 phase check/command/bind、definition/coordinator。actual bank第一三参与者九phase声明位于 Definition 18–29；execute/recover 39、query/recover40 的真实语义是 `Some(receipt)→Confirmed`、`None→Unknown`，只有携匹配 identity/非空 evidence 的 OperationNotExecuted 才变 NotExecuted，不能用 BC contains(false) 直接替换。
- 输出：raw bank package `example.bankwealth.application`，underscore method/type 名和长 FQN，PB codec与类型身份是保护面。`bank_payment_hostHost` 已持久化 Associated/IdentityObserved/ResultIntent/DeliveryAcknowledged/AdmissionGranted；完整父输入 bytes/operation hash、Attach/Start、delivery ACK后persist再reply不能随 fixture移植丢失。它主要属于 invocation 扩展，**本族不取得该文件生产写权**。

### 8.2 legacy/run-all

[run-all 2176–2214](../baseline/js/generators/run-all.mjs#L2176-L2214) 在 sagaBinding 且 canonical.sagas 非空时 compileSagas→lowerSagaRuntimeBindingV3→emitStrictFiles→emitStrictHostFiles→emitStrictSpecFiles→strictSourceEntries；production根 app，test根 test。另一方面 [saga-dsl/generate 137–146](../baseline/js/generators/saga-dsl/generate.mjs#L137-L146) 的 core pipeline **仍拒绝 strict-scala**；strict-contract只发JSON合同、phases、consumption且 runtimeBindingVerified=false。二者不是互相矛盾的运行结果，而是不同入口。

|层|legacy 可复用的真实内容|与 BC 的精确差异|
|---|---|---|
|Model/Builder|emit-strict 80–468 重建 faces/phases/triggers/completions，211前后查 state lineage，264–335确实有Money prepare/terminal证据验证|basePkg默认 net.imadz.metarch；Money FQN按 type id猜；query用无参数且无produces识别而不是isReadOnly/replyToType；type key用regex字符串；pinId重拼、pinVersion恒1；inputShapes重复键343–344；resourceMembers=number占位；缺dependencyRefs与完整collection bounds|
|Host template|emit-strict-host 61–116保留Money exact/re-read/unknown branches，非空实现，不是stub|faces[0]贯穿helpers/command/publication；所有collection命令一律.toList，而BC仅目标List参数才转换；receipt pin恒1；m.caps回声为SupportedCapabilities；collection只检size不检元素；普通query无BC None-evidence分支；普通execute同样无recover|
|Files/codec|emit-strict 790–944 真实types/StrictWire/optional money/ArgsCodec|money时StrictWire独立一份，因此本族 production是6而BC5；读wire仍宽松，collection count未0..64 guard，UTF8非REPORT；args/receipt全逐字段flatMap，BC noncollection合并text-run；模板空args明确fail，BC空encode不合法。不能为“少文件”默认合并所有wire实现|
|Tests|emit-strict-spec 13–176 有money/fab分族、真实资源加载、seed/helpers、固定StartTransfer|fabFamily=`!money && collection`，BC只看collection；第一face；seed使用真实payloads而BC money使用outputs；P21/P22 RULE_PARAMS指独立 `.invariant.params.<base>RuleParams`。与BC资源类型/参数容器差异需保真迁移；没有本轮生成test字节对账|

### 8.3 family route

[family generate 12–46](../baseline/js/generators/scala-cqrs-saga-monarch-v1/generate.mjs#L12-L46) 要 exact manifest/八个 products、live implementations+absolute outDir；buildModels→implementationBuildInputs→render。它在 generate-cli 注册，但 `generate-products` 会按 [45–63、79–80](../baseline/js/lib/products/generate-cli.mjs#L45-L80) 的 captureRequired 拒绝，需 generate-project 捕获源码，**不能误列为公开任意 request 入口可用**。

[render 12–29](../baseline/js/generators/scala-cqrs-saga-monarch-v1/render.mjs#L12-L29) 的 role集合为 protocol/codecs/saga/runtime/workflow/root，另build/config，由renderJobs输出；不存在根据目录名字自动补FixtureHost的规则。[saga-phases 4–71](../baseline/js/generators/scala-cqrs-saga-monarch-v1/templates/saga-phases.mjs#L4-L71) 是相近但不同的两仓库 participant bridge：Confirmed需validate，SafeAbsent需ports.evidence.absence，NotFound→Unknown，Unknown原样，Rejected→Rejected；prepare/commit从持久化receipt读取、核 identity/handle/证据；execute/query调用外部 typed Warehouse ports，而非sharding CreditBalance state-query。这个 stronger absence/nominal合同不得被fixture的safeToRetry=true覆盖；family 独立保留，不本轮改写。

### 8.4 真实 minus/plus，限定为结构性对照

**不是同输入字节比较，不是可直接 apply 的完整生成器 patch。** 下例 minus 是 [legacy host 117–127](../baseline/js/generators/saga-dsl/emit-strict-host.mjs#L117-L127) 原模板内容；plus 是 [BC T 496–506](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/FixtureHostTemplate.scala#L496-L506) 要求的“从已承认 pinVersion 发射”目标规则，以同一 JS 模板变量写法呈现。上下文保留原先 codec/contract；Builder 也须同时把 `p.pinVersion` 改为真实输入 runtime pin，不能仅改renderer留下恒1。

```diff
--- actual-js-template/generators/saga-dsl/emit-strict-host.mjs
+++ approved-target-template/strict-fixture-host/phase-binding
@@
 ${valueObserver}${terminalObserver}    private val codec: PayloadCodec[${m.moduleObj}.${p.receiptType}] = new PayloadCodec[${m.moduleObj}.${p.receiptType}] {
-      override val pin: CodecPin = CodecPin(${jstr(p.pinId)}, 1)
+      override val pin: CodecPin = CodecPin(${jstr(p.pinId)}, ${p.pinVersion})
       override def encode(value: ${m.moduleObj}.${p.receiptType}): ByteString =
 ${encodeBody}
       override def decode(bytes: ByteString): Try[${m.moduleObj}.${p.receiptType}] =
 ${decodeBody}
     }
     override def contract: PhaseContract = ${m.moduleObj}.${p.contractMember}
     override def receiptCodec: PayloadCodec[${m.moduleObj}.${p.receiptType}] = codec
```

第二处是实际集合wire防护差异。minus取 [emit-strict 830–832](../baseline/js/generators/saga-dsl/emit-strict.mjs#L830-L832)，plus逐字来自 [BC T 205–210](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/FixtureHostTemplate.scala#L205-L210) 去掉模板 margin 后的 raw-scala。**这是 raw-scala 目标候选，不是已批准更改现有编码profile的patch**；D4须决定边界上拒绝行为，不能静默改 pin/旧载荷兼容性。

```diff
--- actual-js-template/StrictWire.scala
+++ raw-scala-structure/StrictWire.scala
@@
   /** P13 bounded scalar collection: 4-byte element count + per-element length prefix. */
-  def lengthPrefixedAll(values: Vector[String]): ByteString =
-    values.foldLeft(lengthHeader(values.length))((acc, v) => acc.concat(lengthPrefixed(v)))
+  def lengthPrefixedAll(values: Vector[String]): ByteString = {
+    require(values != null && values.size <= 64, "bounded collection required")
+    values.foldLeft(ByteString.copyFrom(java.nio.ByteBuffer.allocate(4).putInt(values.size).array())) {
+      case (bytes, value) => bytes.concat(lengthPrefixed(value))
+    }
+  }
```

银行现物不提供同名 StrictWire 或同输入 FixtureHost；不编造一个银行 typed command成功分支来填 minus。`bank_payment_hostDefinition` 的PB编码、名义BankPayment0/1/2 Receipt和 `bank_payment_hostHost.operationIdentity` 长度前缀+SHA-256算法原样保留，命名/import改善由相应 owner 在不动这些身份的前提下做。

## 9. 胶水、实现义务与原始模板债

|依赖 / 完整符号面|本族所需接口与副作用合同|供给事实与阻断|
|---|---|---|
|`net.imadz.infra.saga.strict.PayloadCodec[A]`, `CodecPin`|`pin`, `encode(A):ByteString`, `decode(ByteString):Try[A]`；args/receipt pin及canonical bytes不得漂移|BC [scaffold 127–147](../baseline/bc/scaffold/build.sbt#L127-L147) 默认 saga-core/common-core=0.2；可选 `codegen.candidate.sagaCore` unmanaged JAR替换。源模板有调用不证明默认JAR支持strict|
|`PhaseOutcome[A]`, `ConfirmedReceipt`, `NotExecuted`, `Unknown`, `OperationIdentity`, `TransactionIdentity`, `QuerySafety.DeclaredReadOnly`, `PhasePort`, `PhaseBinding`, `StrictSagaDefinition`|phase identity贯穿execute/query；Only confirmed可使用receipt；超时不等absence；controlled profile safe absence不可外推生产；PhasePort input/receipt由上游module桥接|formal [requireApplicationArtifact 4–8](../baseline/js/generators/scala-cqrs-application/generate.mjs#L4-L8) 固定 `net.imadz:saga-core_2.13:0.3.0`、SHA `550fbd5cdb18a50d71a62f8f743d59f24ac1daa03f0aeb07c23c8355c2c0d862`；CLI还实际读本地jar核SHA。本次未读jar、未证ABI，不新增publishLocal/升级授权|
|`StrictSagaCoordinator`, `StrictState`, `StrictStatus`, `StrictEvent`, `Evidence`, `ReconcileAuthorizer`|Settings(FiniteDuration,32)；Start/GetStatus/Status/Reconcile；spawn与singleton二选一部署；terminal map、PID前缀、授权Right principal/Left原因|raw E status未将outcome-unknown映射；formal/family语义不同，D6；不得改变strict PID或用fixture token作生产默认|
|`akka.actor.typed.{ActorRef,ActorSystem,Scheduler,Behavior}`；AskPattern；ClusterSharding/EntityRef；PersistenceId；EventSourcedBehavior/Effect|Actor command按reply合同有typed replyTo；domain param/event无ActorRef。host ask成功依赖实际aggregate durable回复，不是host自己persist领域事件|Akka 2.6.20 为源build pin；本轮未加载artifact。单字段Reply/无参Query都须真实协议支持，不能调用现有curated其它形状假装等价|
|`net.imadz.common.application.CommandHandlerReplyingBehavior.CommandHelper` 与 `runReplyingPolicy`|Helper三方法：toParam(state,command)、createFailureReply(param)(error)、createSuccessReply(param)(state)。[源码 16–44、71–75](../baseline/common/src/main/scala/net/imadz/common/application/CommandHandlerReplyingBehavior.scala#L16-L75)：toParam→rule.fold；error Effect.reply（不persist）；events Effect.persist.thenReply，用事件应用后的state回复|curated Deposit成功是 `CreditBalanceConfirmation(None,state.accountBalance.values.toList)`，failure Some(error),Nil；这是人工体，不是fixture通用回复。Helpers必须application.aggregates.behaviors；上游 `???`/MANUAL业务槽保留为显式实施义务，不制造总None成功|
|同库 `RunnablePolicyWithHelper.replyWithAndPublish`|[50–63](../baseline/common/src/main/scala/net/imadz/common/application/CommandHandlerReplyingBehavior.scala#L50-L63) 成功persist→thenRun逐事件EventStream.Publish→thenReply；`replyWith`没有publish|本Entry消费Mongo readjournal，不得因此擅自给所有aggregate helper增加EventStream发布；两个API不等价|
|`com.google.protobuf.ByteString`；JDK UTF8/ByteBuffer/MessageDigest|concat非++（由本族implicit ops提供）；Money以minorUnits/currency字符串，无浮点/四舍五入；query只读取值；token恒时比较|PB字段号/serializer manifest/ID/binding范围、名义Money/Receipt、addExact/溢出行为全部保护；不绑定整个scalapb.GeneratedMessage“解决”类型迁移|
|Mongo ReadJournal、PersistenceQuery、KillSwitches、SystemMaterializer、Sink/Keep|allEvents触发、GetStatus、completion publication，KillSwitch归安装调用方；源失效会缺trigger/publish，stderr不是恢复机制|[scaffold 95–107](../baseline/bc/scaffold/build.sbt#L95-L107) 指RxMongo并警告双driver类冲突；无实例/连接验证；不能在普通unit验收偷启Mongo|
|ActorTestKit/PersistenceTestKit、ConfigFactory、AnyFunSuite、ProcessBuilder/Socket|S/R/N完整test生命周期按§6/7；testkit与真实Mongo分层；D类显式assume会cancel而不是pass；process/log/DB属于独占验收资源|ScalaTest3.2.15、Akka testkit源依赖已见；D3/D4是产生子JVM/日志/数据库的未来命令，不是本轮动作|

### 9.1 需要明确保留/裁定的原始债

1. M 本族没有 `???`/MANUAL body，但有 commandExpr/receiptExpr；B有FQN拼接、`.get`、局部mutable Maps；T有全文module名替换、receipt字符串replace、collection全文toList→toVector、字符串builder。不能宣称 raw 全纯净，亦不能借此在JS造整个content字段。
2. T resourceDefs 的内部字符串带 margin `|`，没有局部 `.stripMargin`，而是在外层 Host 字符串插值完成后统一去 margin；这是需要保留的处理顺序，不据此声称原输出有残留 `|`。拆分 renderer 后也必须对最终字节做完整对账。
3. 普通execute失败没有recover；普通query固定input.resource，Money observer却用resourceSlotName；q不escape；case-class回复仅匹配一个error字段；completion publish固定txid+replyTo，且所有事件从单publication entity发；需D3/D5。
4. 原式 `types` 小写object、strict下划线符号、hardcoded CreditBalance/StartTransfer/funding/error码/wafer常量、test有null/while/Throwable/polling。普通方法CC≤5为目标，当前 **not-measured**；不能删错误分支、转String/Any表或用全局generated例外刷分。

## 10. 拟实施写集合、唯一组装 owner 与迁移

本节路径均为将来第二阶段的建议，不是本次生产写许可。相对路径以 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/` 为根；本次实际只写 §1 两个文档。

|路径|disposition / owner|内容责任|
|---|---|---|
|`generators/strict-fixture-host/model.mjs`（proposed）|新建；strict-fixture-host owner|§3全部字段/默认/shape/引用结构，保留两个明确代码slot，不存整个content；required/supported分开；provenance为外置结构，不向作者加@knowledge|
|`generators/strict-fixture-host/build-model.mjs`（proposed）|新建；本族owner|§4逐规则；输入统一已admitted strict module + aggregate metadata + formal semantics，不能用bank散文补默认；明确profile限制/拒绝原因|
|`generators/strict-fixture-host/templates/{types,wire,args-codec,host,entry,safety-spec,deployment-node}.mjs`（proposed，七个明确文件）|新建；本族owner|§5–7完整construct与RHS；wire两分支不强行合成不兼容profile；tests专用模型参数来自同一Builder但oracle不共用业务计算|
|`generators/strict-fixture-host/render-files.mjs`（proposed）|新建；**本族物理文件集合唯一 assembly owner**|5 production+按条件2 test的装配/次序/单owner与碰撞；最终字节再交writer。接线点不得再次独立拼文件|
|`generators/saga-dsl/emit-strict-host.mjs`、`emit-strict-spec.mjs`|adapt→委托新族；共享切口由集成者先切分|退役重复host/spec renderer，兼容旧调用返回 `{name,content}` 只是入口适配，非旧包生成壳|
|`generators/saga-dsl/emit-strict.mjs`|split；**strict module owner + 集成者唯一写**|把fixture model/types/wire/ArgsCodec 从module复合容器拆出；StrictSagaModule本体、版本、pins、输入receipt桥归上游owner，本族不并行抢写|
|`generators/run-all.mjs`|adapt；集成者|保留legacy入口可达事实，消费单一装配结果，不继续把旧wire+新wire重复append；不要将strict-scala封禁的另一路无审定解锁|
|`generators/scala-cqrs-application/produce.mjs`、`render-host.mjs`、`generators/scala-cqrs-play-service/generate.mjs`、`lib/products/generate-cli.mjs`|formal接线 **D2之后**；集成者|新fixture profile与已有bank technical host职责分开；不得用本族覆盖PB Definition/InvocationHost/TechnicalPorts；明确注册options/input映射后才接公开CLI|
|`lib/scala-target/naming.mjs`、共享TypeRef/layout/import/writer接口|reuse/adapt；shared-layout-types与writer owner|复用resolveName/resolveNameSet/resolveArtifactPath的已登记API，适配BC命名规则需shared裁定；本族消费解析结果，不再写safeName。上述API仅按合同推荐，本项未独立重审实现|
|family `scala-cqrs-saga-monarch-v1/*`|not-wired；不在本族写集合|保持typed external participant+fenced absence语义；新fixture不擅自抢其role/协议|

依赖次序：`shared-layout-types` → `strict-saga-module`（module/pins/typed bindings/namespace裁定）与 `application-protocol` / `command-helper` / `aggregate-behavior` / `domain-entity` / `event-handler` / `aggregate-rules-formal` → 本族 → `application-bootstrap` + single writer/anchor integration。与 strict composition host、bootstrap、run-all/shared registries 有冲突，由集成者独占，不能各agent同时编辑。

旧输出退役步骤：先列 profile×旧FQN/路径×新FQN/路径×所有imports/callers（包括fixture specs、bootstrap、type implementationFqn、args mapper、entrypoint）→明确保留wire/PID/serializer身份→单owner生成计划列ADD/MOVE/DELETE与手写冲突→更新配置/依赖/归属→按最终格式字节计算fingerprint/ledger/anchors。旧文件的清理必须经 owned writer，不能手删银行app或留永久旧domain转发类。本次不写任何catalog/ledger/anchor迁移文件。

## 11. 独立 fixtures、未来命令形状与副作用

### 11.1 需要的同等输入（均 proposed，当前没有新输出）

fixture根建议 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/strict-fixture-host/`，本阶段**不创建**。每套同时固定：BC formal canonical+system bindings+admitted v3；JS对应request/options或legacy tree/bindings/runtimeBinding；字段序/类型/pin/phase order/lineage/producedBy不可在适配中消失。

- `money-two-step`：真实Money map、六phase、readonlyquery、单字段reply、command+event trigger、五completion、第二step funding、全部formal folds；成功、guard拒绝、相同/不同Money重试、ACK丢失/actor recovery、terminal conflicts；用于 P19–P22，不借用银行三参与者PB输入冒称等价。
- `bounded-collection-two-step`：无Money，item/text bounds、manifest reference，真实List或Vector命令参数、prepare/terminal marker；两资源及A/B/C/D emission必须对账。具体参数容器由D4裁定。
- `pin-and-shape-negative`：非1 runtime receipt/args pin；多face；无query/多reply；outputs无同名input；Money/text乱序；重复lineage；缺formal put/remove；publication多producer；不支持capability；module同包多saga碰撞；D1禁区、money+collection、text-only/empty args。失败应在写盘前报告，不补空实现。

只有 approved-target完整文件集、raw同输入输出、JS同输入输出均取得后才做逐文件字节/construct/RHS对账。有限白名单仅明确生成来源头和平台换行，不能压平所有空白、FQN、类型名、方法体或日志文本。

### 11.2 公开 CLI 形状（全部未执行）

为避免猜不存在的参数，以下只列已读入口支持的 flags。绝对路径中的 fixture/output 是**未来拟建资产**，并不声称现在存在。生成预算先5分钟，局部编译/行为预算15分钟；超过返回已得证据，D部署另行资源授权。

**formal 内容计划/写盘入口**（D2未定之前，此命令只会走现有 finite-host，不会神奇发出FixtureHost）：

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/strict-fixture-host/money-two-step/request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-application \
  --out /tmp/codegen-parity-strict-fixture-host/js-formal \
  --options-json /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/strict-fixture-host/money-two-step/options.json \
  --plan
```

[generate-cli 66–88、110–145](../baseline/js/lib/products/generate-cli.mjs#L66-L145)：plan仍读/解析request/options/manifest、compileProductSet、生成内存计划，查本地runtime JAR bytes，可能因profile条件检查Monarch JAR；不apply、不执行服务/编译。移除 `--plan` 才 [applyEntries 246–268](../baseline/js/src/core/generate.mjs#L246-L268)：创建目标目录、逐entry写源/配置等、readback核final bytes→写 `truthsrc.ledger.json`→`anchors.json`；无全局事务回滚。不是给任意generator路径注册权限。family的captureRequired要generate-project，此处不捏造它的参数或一个尚不存在的strict-fixture-host generator CLI。

**legacy 当前真正调用本族的入口形状**：

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/run-all.mjs \
  /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/strict-fixture-host/money-two-step/tree \
  /tmp/codegen-parity-strict-fixture-host/js-legacy \
  --package example.strictfixture \
  --saga-binding /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/strict-fixture-host/money-two-step/bindings.json \
  --saga-runtime-binding /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/strict-fixture-host/money-two-step/runtime-binding.json
```

这**不是只生成一个Host的窄命令**，而是同fixture完整传统闭包；没有受证 `--artifact strict-fixture-host` / `--dry-run`。已读 [run-all 15–46](../baseline/js/generators/run-all.mjs#L15-L46) 会mkdir输出、mkdtemp系统tmp spec、compileTree，模块引入execSync；[2141–2224](../baseline/js/generators/run-all.mjs#L2141-L2224) 写build/project/conf/routes/gitignore、copy support classes，并在显式 `--saga-core-jar` 时复制jar到lib。本项未逐个重审run-all所有execSync子步骤，因此**此命令的完整旁路写面/子进程闭包仍是D9执行前阻断**，不能因out在/tmp称无旁路；当前不运行、不下载。

**BC raw 同fixture入口形状**（在 `/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen` 作为工作目录的未来专门执行窗口；所有属性同一次JAVA_OPTS，不读当前env）：

```bash
JAVA_OPTS='-Dcodegen.systemFile=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/strict-fixture-host/money-two-step/canonical.json -Dcodegen.systemBindings=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/strict-fixture-host/money-two-step/system-bindings.json -Dcodegen.sagaExecutionV3=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/strict-fixture-host/money-two-step/saga-execution-v3.json -Dcodegen.targetDir=/tmp/codegen-parity-strict-fixture-host/bc-raw' \
  /usr/local/bin/sbt 'runMain net.imadz.codegen.CodegenMain'
```

formalFile与`codegen.system`互斥，不能同时给Examples骗取真实Money formal semantics。已读 CodegenMain 会运行harness、scaffold copy、全部传统生成、knowledge-release manifest、formal-semantics.json，CQRS可能写ledger和saga anchors；sbt可能编译/写target/解析依赖/子进程，须预先固定离线供给与缓存写范围。不得省target，不得使用共享应用，不因该命令是raw对照而修改BC生产源迎合D1。

**后续局部行为过滤**：在获准的隔离raw单工程中可用 `sbt 'testOnly <已裁定fixture包>.FixtureSafetySpec -- -z "P19 exact Prepare"'`；这是已读实际测试名的命令模板，不是声称该包/测试已生成。collection可筛 `-z "A1 aggregate conservation"`。不要在bank play-service目标照搬：它的 [generate 41–44](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L41-L44) 显式禁testOnly，要求独立runner。D1–D4部署测试会开Socket/actor/Mongo DB、D3/D4启动两个JVM、写target/deployment-face；它们不在普通文档/局部unit许可范围。

### 11.3 验收分账

1. Source-content：M字段/default/dependency，B规则/异常顺序，T production+test+resources构造/RHS，本文逐项登记；仍有D项，不标“全部覆盖且可交付”。
2. 同输入完整文件对账：五/七文件集合及module依赖，money的StrictWire共文件/JS独立文件，生产/测试root、注释/import顺序、full bodies，当前未运行。
3. 真实接口/行为：Actor typed replyTo；Helper失败无persist/回复一次；成功persist/apply后thenReply读取新state；无意外EventStream发布；Money exact/terminal冲突/未知不误判absence；codec pin/bytes；readonly evidence query；publication error处理；当前未验证JAR或运行。
4. 可读性：类型PascalCase、方法lowerCamelCase、无HostHost、正常imports；三层；长参数按行和named args；plain FP保真，不移除nominal类型/溢出或把dispatcher改String/Any。CC普通方法目标≤5，6–10逐方法解释，>10先重构或逐项审定；所有当前数值 `not-measured`。
5. 稳定性/回锚：同输入两次字节稳定；一字段/规则变化产生合理局部diff，旧输出owned退役，最终字节后再定位anchors。未创建新@knowledge作者字段，未手写catalog/ledger/anchors，当前全部未运行。

## 12. 精确开放决策

|ID|必须裁定的接口/语义，不以“待完善”代替|
|---|---|
|D1 namespace/名称|raw strict admission拒绝业务三层，用户目标又只准三层；明确新profile/admission归属及module/codec/entry/type implementationFqn迁移规则；是否允许fixture独立非业务根作raw-only比较；`types`→`Types`与phase PascalCase的源码名/绑定FQN必须同时裁定，PID/codec/业务ID不改|
|D2 formal owner|现有formal finite-host是PB+external technical ports，不调用fixture renderer。是新增明确fixture profile还是仅维护legacy对照？注册产品/配置字段/输入适配/唯一assembly由谁签收；不擅自改银行Host/Definition|
|D3 admitted fixture shape|单字段Reply、readonly query无额外参数、tech.inputs==command顺序、resource slot是否必须名resource、completion command是否只接txid+replyTo、同publication face/event family、trigger额外opId，哪些成为显式准入约束，哪些真正需泛化；curated Reply不同，不能直接替换|
|D4 wire/集合profile|money+collection时BC money StrictWire没有All方法，而test走collection；text-only/empty形状缺可用test/encode。应拒绝还是扩展？List/Vector原模板全局替换与Builder条件转换不一致；64上限、UTF8 REPORT/长度拒绝、wire物理共文件策略是否成为目标；保持现有有效载荷/pin身份，拒绝行为改变要显式|
|D5 raw缺陷处理|普通execute无recover、普通query的input.resource/错误插值、q不escape、重复路径：先取得raw完整字节定位后批准有限修正，不能偷偷把修正版标成原始模板|
|D6 completion语义|raw outcome-unknown从未被statusMatch选中，RecoveryRequired是否应区分Uncertain；event source只处理Succeeded/Aborted；publishCompletion返回含error的reply但调用方可能只看Future失败。选择哪些映射/重试责任，不造空成功|
|D7 scope/证据强度|controlled map absence→NotExecuted(true)是否仅限fixture？bank technical/family fenced SafeAbsent不可降级；禁止将恢复-required/Unknown转换成safe absence。需要明确生产禁用边界|
|D8 artifact供给|BC默认0.2、可选candidate与JS冻结0.3.0并非已证ABI相等；固定哪些已存在artifact坐标/SHA/方法供给用于后续同输入fixture。缺JAR能力就阻断，不发布runtime洗绿|
|D9 执行闭包|legacy run-all完整execSync/旁路写路径和BC optional ledger/anchor路径在执行前须由集成者收敛；目前仅提供已读CLI形状与已知副作用，不授权运行；新目标目录不能替代此审查|
|D10 测试专属性|是否只承认CreditBalance money和wafer两个fixture；将hardcoded event/error/funding/规则参数容器显式列为fixture输入或测试asset，而非任意业务算法；P21/P22 BC/JS资源差异按对应rules制品裁定|

本文件独立保存，不等待其它制品解除阻断；保存状态与实现/内容一致性/运行结论完全分开。
