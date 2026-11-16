# composition-invocation-host：有界组合宿主的内容级差异规格

- artifactId / group：`composition-invocation-host`。
- 状态：`decision-required`。传统 strict 扩展有实际 Model/Builder/Template；JS legacy 有近似且可达的四文件实现；formal 银行链路中的同名 `invocation-host` 是**单步 Saga 调用宿主**，不是这套 invoke/await/invoke 组合宿主。不能用名称相同宣称对应完成，也不能说 JS 完全没有实现。
- 本次只检视源内容。没有生成、编译、测试、运行、服务、下载、发布或 Git 写入；没有新同输入输出。CC：`not-measured`，普通方法目标 ≤5。
- 首次检查及写入前检查时，本 diff 和 details 均不存在。只新增这两个分配文件；既有 diff（包括此前要求保留的15份）、baseline、catalog、应用、真源和锚不作修改。
- 固定 HEAD：BC `cc335eb1e0d0fae17bf092fd61b126040196ea70`；JS `bf104e16ab82ef39d7fa416d0997907d18a815ad`。HEAD 不替代文件指纹。

## 1. 来源、完整字节与四种材料

本文的 `M/B`、`T`、`R`、`D`、`J`、`P`、`A` 指下列**完整源文件**。长文件不裁剪保存；下面逐构造表给出顺序、分支和 RHS，不以链接替代内容说明。

|键|完整固定源与行锚|bytes|SHA-256|
|---|---|---:|---|
|M/B|[CompositionHostBuilder.scala，完整147行][mb]|9592|`64a5185e78b062b2d7241373efc06d81109f298e5e6db457028ea2560fe2716e`|
|T|[InvocationHostTemplate.scala，完整848行][t]|46611|`abc451d0a25acd8dcb8fd1f81bf04b55db91024a55dcdc17c88991213759be1b`|
|R|[composition-recovery.scala.tpl，完整314行][r]|19699|`1f2663f4fd1a60fda6419c6d87ee71025f78b7018d2abf561688da38034d29b9`|
|D|[composition-deployment.scala.tpl，完整325行][d]|19808|`06f8a44e3b1213f6963894e47f1b1c5d3b15959d15313e0234ad52903a67e445`|
|J|[legacy emit-invocation-host.mjs，完整511行][j]|28011|`135adb9c255c35297abd63955ec583dd22ab61083c785d109fa3df56d857d819`|
|JP|[legacy emit-invocation-plan.mjs，完整93行][jp]|4401|`9a186ea3c4d5b1d8792d434143cf1f2904e9dd79e4f818420b9a882a040a0ce1`|
|JS|[legacy emit-invocation-spec.mjs，完整239行][js]|14010|`525c57789a60cd1c16583187a5735edd5a13b598e55f75a4c573f4d4591b654e`|
|F|[formal render-invocation-host.mjs，完整48行][f]|12868|`72fb4b6e3e350f00c1b84d47e3f863b56572f91eae49a314c2487a96e28d808d`|
|P|[formal render-pipeline-invocation.mjs，完整51行][p]|13592|`772e29795c4513b530272d6642776042ab785a741e5b1b4be02a6aac541943ed`|
|A|[现存银行 bank_payment_hostHost.scala，完整132行][a]|11966|`e74f76532abdadc384d4fda34cad3d8896d34898c5996b3e3fa85758afa986c4`|

这些文件的本次只读 SHA/bytes 核对与 [baseline/index.json](../baseline/index.json) 相符。R/D 的 BC resource 原件未收入 `baseline/bc`；本次实际读取原件，分别与这里固定的 JS resource **整文件 bytes/SHA 相同**，所以 R/D 可以提供对应的固定完整内容；原件路径/SHA 仍单列于 §11 和 details.extraSources，不将其伪称已在 BC baseline 中。

|材料|可取得内容|不能声称的内容|
|---|---|---|
|`raw-scala`|M/B、T、R、D 的完整源；下文精确展开规则|没有本次执行生成的四份 Scala 文件；模板字符串不是一次执行回执|
|`approved-target`|用户批准的三层、命名、正常 imports、类型/身份保真与质量限制；下文明确覆盖项|D1–D8 未决，不能提供虚构的完整目标字节或假成功业务体|
|`actual-js`|A 的既有银行输出；J/JP/JS 的既有 legacy 模板|A 不是 Fab 组合输入的结果；未产生同输入比较|
|`curated-scala`|本制品在固定 `curated-scala` 索引中没有组合宿主/子计划/这两份 spec 的对应文件|不挪用 CreditBalance、classic Saga 或 `template/products/*` 作为本制品人工 golden；测试模板也不是运行证据|

## 2. 调度、基数、物理输出与归属

### 2.1 Scala 实际入口

[CodegenMain L62–76、119–146](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L62) 使用显式 `codegen.systemFile` + `codegen.systemBindings` 组装基础系统（与 `codegen.system` 互斥），`codegen.sagaExecutionV3` 取得 admitted token，`codegen.executionBinding` 才组装 composition。后二者都要求显式可读绝对文件，大小上限8 MiB。`semanticProductsFile` 在 [L183–188](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L183) 提前进入另一路，不是本制品入口。

[CQRSApplicationGenerator L252–270][dispatch] 在 `runCommon` 的传统层及 strict fixture-host 之后调用本 M/B/T；要求 `strict.isDefined` 且 `!multiProject`。没有 composition 参数时发射0份；合法单 composition 发射2份主源码 + 2份测试源码，scope/写领地可使实际写数小于计划数。非法 multi-project 是**拒绝**，不是静默 suppressed。

|变体|条件/计划基数|原始完整输出路径（`target` 为显式独占根）|归属与锚|
|---|---|---|---|
|host|composition admitted；1|`<target>/app/<hostPkg.replace('.', '/')>/<hostName>.scala`|`invocation-host` / pipeline；`pipeline:<pipelineId>`|
|child-plan|同上；1|`<target>/app/<hostPkg.replace('.', '/')>/<child.planObj>.scala`|同 kind；额外 `pipeline:<child.planId>`|
|recovery-spec|同上、single-project；1|`<target>/test/<hostPkg.replace('.', '/')>/FixtureCompositionSpec.scala`|只 parent pipeline key|
|deployment-spec|同上、single-project；1|`<target>/test/<hostPkg.replace('.', '/')>/FixtureCompositionDeploymentSpec.scala`|同上；内含 facts object、node main、suite 三个顶层构造|

`generateFiles` 顺序 host→child；`generateTestFiles` 顺序 recovery→deployment（[T L14–20][t-files]）。`CompositionHostModel` **不继承** ArtifactModel；writer 用 `FixtureFileModel(selfType, Set.empty)` 包裹：实际 `dependencies` 是空集合，不能因输出有 import 就说台账已收齐依赖。[writer L353–424][writer] 先记 ledger/deps/morphisms，再 scope 守卫；给内容前置 `CodegenMain` fingerprint header（模板自己的 generated header仍在），通过 territory 写入才收实际字节 SHA 与锚。testRoot 虽真实为 `test`，该 writer 的 `ledgerPath = s"app/$relative"` 非 strict-saga-module 特例路径会造成测试台账路径疑点，须在 D8 裁定，不能复制成正确设计。

### 2.2 已批准目标与尚未批准的拆分

唯一可确定的目标业务包层只有 `domain/application/infrastructure`。选定 **single-project `app`/`test`** 作为本制品同输入比较 profile，不拿 family 的 `modules/*/src/main/scala` 混签。

- 组合编排、应用 Actor 协议/状态：`<target>/app/<basePath>/application/services/transactor/<ResolvedHostName>.scala`。
- fixture 子计划：`<target>/app/<basePath>/application/services/transactor/<ResolvedChildPlanName>.scala`；无设备 I/O 的 fixture 变换不能泛化成银行业务。
- 两份 suite：`<target>/test/<basePath>/application/services/transactor/FixtureCompositionSpec.scala`、`FixtureCompositionDeploymentSpec.scala`（最后一份中的进程启动角色是否拆开见 D1）。
- **proposed、尚须 D1 裁定的物理拆分**：Mongo 观察适配器 `app/<basePath>/infrastructure/persistence/strategies/MongoCompositionChildJournal.scala`，应用观察端口 `app/<basePath>/application/services/transactor/CompositionChildJournal.scala`，装配 `app/<basePath>/infrastructure/bootstrap/CompositionBootstrap.scala`。不得把混合 class 整体搬进 application 就声称完成职责分层。端口终态/取消/重启方法形状未裁定，不伪造可用 API；raw 方法在 §4 均有迁移归属。
- Scala strict 的 `hostPkg = strictSiblingPackage(compositionModule.packageName, "composition")` 只是**追加**子包，并不查 `PackageLayout`。`strictIndependentNamespace` 甚至把传统三层列为 reserved（[TypeResolverDSL L30–49](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L30)）；不是现成符合目标的布局入口。JS 需要新布局绑定，不能要求修改 BC 原基准。
- 名称解析不得联动 `pidPrefix`、txid、childRunKey、stage cursor、PB 字段/消息、serializer ID/manifest、nominal identity、溢出语义。重命名之前必须将稳定身份与源码名分离；不从新名字反推旧 PID。

## 3. Model 与 Builder：完整字段和真实分支

### 3.1 Model 全文（M/B L11–36）

以下是原始声明，不是 proposed JS 接口。所有构造参数均无默认值；`Option` 并不意味着调用方可以省略参数。无泛型、型变、上下界、annotation、self-type、辅助构造器或方法体。

```scala
final case class CompositionHostModel(
    pipelineId: String, hostPkg: String, hostName: String, hostObjStem: String, pidPrefix: String,
    stepIds: Vector[String], splitStepId: String, awaitStepId: String, mergeStepId: String,
    splitModuleFqn: String, splitEntryFqn: String, splitHostObj: String,
    mergeModuleFqn: String, mergeEntryFqn: String, mergeHostObj: String,
    awaitPayloadSlots: Vector[(String, Boolean)], wafersSlot: String, childRunSlot: String,
    childCompletedCode: String, child: ChildPlanRender, triggerCtor: CommandCtor,
    splitCtorArgs: Vector[CtorArg], mergeCtorArgs: Vector[CtorArg],
    protocolFqn: String, replyFqn: String, specFaces: AggregateSpecFace)

final case class ChildPlanRender(planId: String, planObj: String, stageType: String, stateType: String,
                                 pidPrefix: String, stages: Vector[String], stateFields: Vector[(String, String, String)])

sealed trait CompositionArgSource
object CompositionArgSource {
  case object TransactionId extends CompositionArgSource
  final case class Input(slot: String) extends CompositionArgSource
  final case class Checkpoint(stepId: String, slot: String) extends CompositionArgSource
  final case class Seed(slot: String) extends CompositionArgSource
}
final case class CtorArg(param: String, source: CompositionArgSource, collection: Option[String])
final case class CommandCtor(fqn: String, args: Vector[CtorArg])
final case class AggregateSpecFace(entityKeyFqn: String, entityFqn: String,
                                   behaviorsFqn: String, eventHandlerFqn: String, commandFamilyFqn: String,
                                   queryCtor: String, stateField: String,
                                   seedPrepare: CommandCtor, seedCommit: CommandCtor)
```

|顺序/字段|实际推导与消费；JS所缺的结构|
|---|---|
|1 `pipelineId`|原 plan ID；注释/归属/锚，不用于新造身份|
|2 `hostPkg`|composition module package + `.composition`；四份文件 package/TypeRef/可见性尾段|
|3 `hostName`|去一次 `Module` 后加 `Host`；object/class/文件名/测试引用|
|4 `hostObjStem`|存 `hostStem`，T 未读取；保留原模型事实，不能说是已用依赖|
|5 `pidPrefix`|`strictKebab(hostStem)`；host PID 构造，不能随新 PascalCase 改写|
|6 `stepIds`|`plan.steps.map(_._1)`，顺序保真；activeStep/推进/报告|
|7–9 `splitStepId/awaitStepId/mergeStepId`|首/指定 await/尾；constant、匹配与输出 key|
|10–12 `splitModuleFqn/splitEntryFqn/splitHostObj`|resolver module FQN/已核 entrypoint/固定 `FixtureHost`；host import/start，spec singleton入口|
|13–15 `mergeModuleFqn/mergeEntryFqn/mergeHostObj`|同上，merge 端；不能把 entrypoint 当 module 名机械替后缀|
|16 `awaitPayloadSlots`|去除 operation/occurrence 的 `plan.inputs` 顺序；每项 Boolean = splitSaga 类型表中是否 `SagaTypeShape.Collection`；T 将类型压为 Vector[String]/String|
|17–19 `wafersSlot/childRunSlot/childCompletedCode`|原 plan 字段；CSV、checkpoint key、成功终态 code；其余 child result codes没有进入模型|
|20 `child`|七字段依次：plan ID、解析出的 planObj、固定 ChildStage、固定 ChildPlanState、绑定 PID prefix、stage顺序、state字段三元组|
|21 `triggerCtor`|split `CommandCtor`；T用其 FQN；其 args 与下面 splitCtorArgs重复存储|
|22–23 `splitCtorArgs/mergeCtorArgs`|按**triggerCmd.parameters**顺序保存；collection只记录 List/Vector/Seq；source为上面的四分支 ADT|
|24 `protocolFqn`|aggregateProtocol FQN；deployment token|
|25 `replyFqn`|取 aggregate **replyFamily.replies.head** 的 nested FQN，不是按 triggerCmd.replyToType 选择；D3|
|26 `specFaces`|九字段按声明顺序：aggregateRoot、entity、aggregateBehavior、entityEventHandler、commandFamily、首个只读 query 的 nested FQN、carried Map字段名、merge funding participant 的 Prepare/Commit seed ctor|
|`ChildPlanRender.stateFields` 的三元组|每个 `(name,type,initializerTag)`；Int→`("Int","zero")`，其他→`("Vector[String]","collection")`。这是明确的类型/默认槽，不是任意语言 body；T把zero→0，其余→st.wafers|
|`CtorArg.param/source/collection`|参数名保存但主 host 使用位置实参；`Seed`用于spec；只有List追加`.toList`，Vector/Seq/None不加转换|
|dependencies / note / anchor|Model没有这些字段；B也不返回依赖集合；writer以空集包装并另给pipeline keys。JS新Model必须显式收import依赖及文件依赖，不能照抄空依赖假装已闭合|

### 3.2 Builder 全分支账（[M/B L38–146][b-rules]）

文件 import 顺序：`{GeneratorContext, TypeRef}`（TypeRef本文件未使用）、`NamingConventions`、`net.imadz.meta._`、execution 的 `AdmittedSagaInputV3/CompositionBindingAdapter/SagaPhase/SagaTriggerSource/SagaTypeShape`。没有 Builder 内 I/O。失败通过 `fail(msg): Nothing = throw new IllegalStateException("composition face: " + msg)`；head/last 依赖上游 admission 不为空，绕过 admission 可产生集合异常。

|规则与范围|完整推导/分支、异常、顺序|
|---|---|
|B01 L41–48|`build(plan, token, ctx): CompositionHostModel`；首尾step；分别find invocation，否则 `invocation row missing: <id>`|
|B02 L49–60|按 sagaId 找 token.sagas.execution，否则 saga not admitted；definition.version 与 entrypoint 严格等；`face.args.map(slot -> type)` 与 admitted payload.args(slot,type) **有序相等**，ref不在这一步比较；分别先split后merge|
|B03 L61–67|resolver strictModule split/merge/composition；removeSuffix Module；strictSiblingPackage；strictNestedName Host；strictKebab。BC strictNestedName就是拼接，不自带去重复后缀规则|
|B04 L69–81|每Saga只取第一个trigger，无则fail；split必须Command(ref)，merge first trigger source必须相同；按source owner解析aggregate；reply取第一项；按source command查triggerCmd，缺任何一项fail|
|B05 L82–86|nested = strictNested(protocol,name).fqn；collection只匹配 `CustomType(name,_,_)` 且name∈List/Vector/Seq，否则None|
|B06 L87–100|遍历triggerCmd参数：参数名等于split trigger idempotency.sourceSlot则TransactionId（优先于args映射）；否则face.args按参数名find。ref以`input:`开头→Input(drop6)；其他按冒号保留空段split，必须恰好step/awaitStepId/wafersSlot→Checkpoint；未映射或其他checkpoint fail。记录collection，分别创建split/merge CommandCtor|
|B07 L102–108|merge participant resourceSlot必须有`to`；找其第一个step，再按指定phase找command.contractName；缺participant/step/phase各自fail|
|B08 L109–118|seed command name先strictSymbol，再aggregate命令查找；每参数collection非空→Seed(wafers)，否则名txid→Seed(txid)、resource→Seed(entityId)，否则fail。collection判定优先于参数名|
|B09 L119–129|首个isReadOnly query；stateRef解析ValueObject；必须有名carried且fieldType为CustomType("Map",_,_)；spec九面按resolver及seed Prepare/Commit组合。不核query其他参数是否仅replyTo、不核reply含state/error，这些是D3输入缺口|
|B10 L131–134|splitSaga.args.types→Map(id,shape)；plan.inputs去operation/occurrence；类型查不到也得到false而不是fail；非collection输出String，不能称通用nominal lowering|
|B11 L135–144|child state类型Int保留且zero；其他压Vector[String]/collection；planObj=`strictNestedName(strictPascal(planId),"Plan")`；固定stage/state/FixtureHost，按Model声明顺序构造；splitCtor用于triggerCtor，mergeCtor只取args|

上游 [CompositionBindingAdapter.scala 当前原件](../../../../backkend-codegen/src/main/scala/net/imadz/meta/execution/CompositionBindingAdapter.scala#L33)（SHA见§11）确实限定了有界 profile：

- L11–31：binding schema v1、Monarch `monarch-persistence/0.2.1` 与 `net.imadz:monarch-persistence_2.13:0.2.1`，Saga `net.imadz:saga-core:strict-runtime-binding-v1-SNAPSHOT`；输入面结构包含 invocations、child、inputs，无默认。
- L34–68：累积errors；对象/非空≤128字符字符串/有界数组/精确字符串/唯一ID/名字正则校验；slot数组≤16，保留slot/ref/type。
- L70–113：binding pipelines≤64，带childRuns的恰好1；canonical pipelines≤256且ID唯一；steps≤16且**恰好 invokeSaga/awaitChildRun/invokeSaga**，命名、执行种类和唯一step检查。
- L114–144：schema execution/v1；recovery必须host/exact/confirmed-prefix/reconcile-before-resume/single-writer，planVersion非空；inputs顺序与recovery.inputs逐项一致；三个并发数=1；maxItemsPerChunk为1..64整数；inputRef类型等。
- L147–185：invocation每项只能对应invoke step；Saga id/version/source、durable-intent-before-start、await-terminal、durable-source-stage、saga-version、reject-different-args、operation/occurrence ref和payloadCompatibility exact；args非空；只支持已声明input或末步读取`step:<await>:wafers`；覆盖每invoke恰好一次。
- L187–215：child启动/完成/身份/payloadCompatibility精确；payload必须carry input:wafers；results**恰好五种** succeeded/child-rejected/child-failed/recovery-required/outcome-unknown；仅成功code及wafers/childRun输出进入最终plan。其他结果code已读但未保留，不能宣称T按五种code渲染。
- L217–249：恰好1个child binding；planRef/runtime/journal prefix精确；stages 1..8唯一；stateFields恰好`wafers -> inputTypes(wafers), processedCount -> Int`且顺序固定；errors非空Left，否则Right。R却把stage cursor写死三项，D却把三个stage数量写死：admission范围与spec范围不能混为已对齐。

## 4. Template 全输出 construct / RHS 账

以下 `H` 对应host，`C` child，`S` recovery suite，`D` deployment文件。保持原始声明顺序，未特别列出的无默认参数；函数均无重载（test/public是不同方法名）、无type alias、无继承父构造参数或self-type。测试中泛型、curried/implicit参数在表中专列。表中名字如 `$w`、`${m.hostName}` 为**模板插值记法**，不是已生成的新Scala文件。

### 4.1 Template 入口和渲染槽

|范围|构造/RHS|
|---|---|
|T L1–20|package template.application.transactor；import CommandCtor/CompositionHostModel/CompositionArgSource/CtorArg，再TypeRef；object InvocationHostTemplate；两个generate方法返回Vector[(TypeRef,String)]，四个固定有序调用见§2|
|T L22|private pascal：只按`-`split、去空、每段首字符upper+余串，mkString；不同于JP的`[-_]`和BC strictPascal；下划线行为不能假称等价|
|T L24–33|argument：TransactionId→`txid`；Input(slot)→`st.<slot>`；Checkpoint(step,slot)→`state.checkpoints("<step>").outputs("<slot>").split(",").toVector`；Seed(slot)→slot；collection==Some(List)才拼`.toList`|
|T L35–47|payloadParams按awaitPayloadSlots给String/Vector[String]；payloadRefs按顺序逗号；拆split/merge FQN为pkg/object；`w=wafersSlot`；stateInits每字段zero→0，其余st.w；ctorLines每arg用argument、8空格、逗号换行。这些代码串局部槽属T，不是结构Model替代物|

### 4.2 Host imports、协议、身份与构造

[host完整段 T L48–242][t-host]。

H00原始import顺序完整如下，始终输出，不按dependencies计算/排序：

```scala
import akka.actor.typed.{ActorRef, ActorSystem, Behavior, Scheduler}
import akka.actor.typed.scaladsl.{ActorContext, Behaviors}
import akka.actor.typed.scaladsl.AskPattern._
import akka.cluster.sharding.typed.scaladsl.ClusterSharding
import akka.cluster.typed.{ClusterSingleton, SingletonActor}
import akka.contrib.persistence.mongodb.ScalaDslMongoReadJournal
import akka.persistence.query.PersistenceQuery
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import akka.stream.{KillSwitches, Materializer, SystemMaterializer, UniqueKillSwitch}
import akka.stream.scaladsl.{Keep, Sink}
import akka.util.Timeout
import net.imadz.common.CborSerializable
import net.imadz.infra.saga.strict.{CodecPin, Evidence, OperationIdentity, Phase, StrictSagaCoordinator, StrictState, StrictStatus, TransactionIdentity}
import net.imadz.monarch.persistence.PersistentMonarch
import ${splitPkg}.{${splitObj}, ${m.splitHostObj} => SplitFixtureHost}
import ${mergePkg}.{${mergeObj}, ${m.mergeHostObj} => MergeFixtureHost}
import scala.concurrent.{ExecutionContext, Future}
import scala.concurrent.duration._
import scala.util.{Failure, Success, Try}
```

OperationIdentity/Future在host输出未被使用；Lot reply/trigger仍FQN；不能声称原始Scala没有import债。目标import由依赖结构给出，移除未用项与正常无冲突简名是显式质量覆盖；alias SplitFixtureHost/MergeFixtureHost保留以消歧。

|ID / T行|完整构造、字段顺序与RHS|目标归属/处置|
|---|---|---|
|H01 48–85|generated头、package hostPkg；注释记录pipeline及split→await→merge、journal顺序、mirror非权威、失败不自动补偿/超时不判失败。object hostName；StepIds=输入有序Vector，SplitStep/AwaitStep/MergeStep各为原ID字符串|保留语义与ID；对象/文件名经名字模型|
|H02 87–96|sealed Command extends CborSerializable；BeginOperation(operation,occurrence,payload顺序,replyTo:ActorRef[OperationReply])；GetProgress(ActorRef[ProgressReport])；package-tail-private SagaPolled(stepId,Try[StrictSagaCoordinator.Reply])、AdvanceAfterCheckpoint(stepId)、OpenStep(stepId)、ChildObserved(Option[(String,String)])、ChildRefused(reason)、ChildProgressed(cursor)，均extends Command|应用Actor协议；typed replyTo仅有回复合同的命令，不给内部信号硬塞Reply|
|H03 98–112|sealed Event extends CborSerializable；OperationStarted(operation,occurrence,payload)、InvocationIntentPersisted(stepId,key)、IdentityObserved(stepId,transactionId,definitionName,definitionVersion:Int,argsDigest,definitionDigest,argsCodecId,argsCodecVersion:Int,planDigest)、StepCheckpointed(stepId,code,outputs:Map[String,String])、ChildProgressMirrored(cursor)、OperationConcluded(code)，均extends Event|应用流程journal，不是领域实体event；无ActorRef|
|H04 101–109|IdentityObserved注释；`toIdentity: TransactionIdentity = TransactionIdentity(transactionId,definitionName,definitionVersion,argsDigest,definitionDigest,CodecPin(argsCodecId,argsCodecVersion),planDigest)`|不能删digest/codec pin或重建假identity|
|H05 114–124|ComposedState(started:Option[OperationStarted],intents:Map[String,String],identities:Map[String,IdentityObserved],checkpoints:Map[String,StepCheckpointed],concluded:Option[OperationConcluded])；terminal=concluded.isDefined；activeStep先找有intent无checkpoint，否则找无intent的首step|纯事件状态；无state默认值|
|H06 126–128|OperationReply(accepted:Boolean,reason:String) extends CborSerializable；ProgressReport(started:Boolean,checkpoints:Vector[(String,String)],concluded:Option[String],childRunKey:Option[String])同marker|回复分组目标不能改变布尔/字符串合同为fake success|
|H07 130–144|txidFor=`"op-"+operation+"-"+stepId+"-"+occurrence`；childRunKey同式但AwaitStep；childPersistenceId=`child.pidPrefix+"/"+childRunKey`；persistenceIdFor先require operation/occurrence均非null非空，再`PersistenceId.ofUniqueId(pidPrefix+"/"+operation+"-"+occurrence)`|精确稳定身份冻结；不换成formal SHA策略|
|H08 146–155|private-tail TestHooks defaults：beforeEffect(String,String)=>Boolean=`(_,_)=>true`；beforeChildCheckpoint()=>Boolean=`()=>true`；recovered(Long,ComposedState)=>Unit=`(_,_)=>()`；stopped()=>Unit=`()=>()`。singletonName=SHA-256(PID.id UTF_8)，每byte `%02x`.format(b & 0xff)，前缀composition-|test seam默认放行不是业务成功。singleton名字及PID保持|
|H09 158–173|spawnClusterSingleton(system,sharding,splitCoordinator,mergeCoordinator,operation,occurrence)(implicit ec):ActorRef[Command]→test版本+TestHooks()；test版本增加hooks，`ClusterSingleton(system).init(SingletonActor(build(...,hooks),singletonName(...)))`|装配候选拆往infrastructure.bootstrap；调用次序保留|
|H10 175–198|behavior同六参数+implicit ec返回Behavior，build+空hooks；behaviorForTest增加beforeEffect，TestHooks(named beforeEffect)；private build增加hooks→Behaviors.setup，implicit Materializer=SystemMaterializer(system).materializer，再new host(ctx,system,sharding,split,merge,persistenceIdFor(...),hooks).receive()|禁止把test factory当运行入口默认注入|
|H11 201–211|class前intent-before-start注释；final class hostName(ctx:ActorContext[Host.Command],system:ActorSystem[_],sharding:ClusterSharding,splitCoordinator:ActorRef[StrictSagaCoordinator.Command],mergeCoordinator同型,val persistenceId:PersistenceId,hooks:Host.TestHooks)(implicit ec:ExecutionContext,mat:Materializer)|无父类、辅助构造器；具名同型参数排版不改实参身份|
|H12 212–225|import Host._；private implicit scheduler=system.scheduler；splitHost/mergeHost=new alias(system,sharding)；sagaReplySink=spawnAnonymous(ignore[StrictSagaCoordinator.Reply])；lotReplySink同法但replyFqn；beforeEffect=hooks.beforeEffect；`@volatile private var ownerClosed=false`；scheduledPolls=Map.empty[String,akka.actor.Cancellable]；childWatch=None:Option[UniqueKillSwitch]；childActor=None:Option[ActorRef[PersistentMonarch.Command[ChildPlan.ChildPlanState]]]|局部资源由host负责退出；不能删除reply sinks或var来刷FP指标|
|H13 227–242|receive():Behavior[Command]=EventSourcedBehavior[Command,Event,ComposedState](persistenceId,ComposedState(None,Map.empty,Map.empty,Map.empty,None),onCommand lambda,onEvent lambda)。RecoveryCompleted先hooks.recovered(lastSequenceNumber(ctx),state)再onRecovered；PostStop先ownerClosed=true，再cancel全部polls、shutdown childWatch、hooks.stopped()|退出顺序保留；新观察端口需等价取消合同D1|

### 4.3 Host 每个 command 分支、effects 与事件应用

[command段 T L244–379][t-commands]；[effects/event/recovery段 T L381–516][t-effects]。下面是每个分支的完整动作账，不能压成“调用Saga即可”。

|ID / T行|RHS / body（严格顺序）|
|---|---|
|H14 GetProgress 247–252|replyTo ! ProgressReport(started.isDefined,按StepIds过滤checkpoints并转(id,code) Vector,concluded.map(_.code),intents.get(AwaitStep))；Effect.none。读查询不持久化|
|H15 BeginOperation 254–269|PID不符→OperationReply(false,"operation does not match this persistence identity")、none；已started→false,"operation already started (single-writer)"、none；否则先造OperationStarted和split intent，一次`Effect.persist(started,intent)`，thenRun回复true/空reason，再第二个thenRun用更新state startSagaStep(SplitStep,s)。不是persist前回复|
|H16 OpenStep 271–284|未started/已有intent/terminal→none；AwaitStep→用started operation/occurrence造childRunKey，persist await intent，再startChildStep；其余sagaStep→造txidFor，persist其intent，再startSagaStep；未另检验stepId属于StepIds|
|H17 AdvanceAfterCheckpoint 286–292|只有该step已有checkpoint且非terminal，取index，若idx+1<size发OpenStep(next)；总返回none；没有在此直接外发效果|
|H18 SagaPolled 294–304|未started或该step已有checkpoint→none；Success(Status(s))：`s.identity.exists(_ => true) && s.identity.isDefined && !state.identities.contains(stepId)` 时persist IdentityObserved九字段，thenRun self重投同一SagaPolled；否则onSagaState。重复判断是raw债，不默称已简化；未检验poll状态是否匹配原args|
|H19 SagaPolled 305–318|Success(ConflictingIdentity) log.error+persist OperationConcluded("ConflictingIdentity")；其他Success log.warn+scheduleNextPoll+none；Failure(t) log.warn(t.getMessage)+重试poll+none。未答不是业务失败|
|H20 ChildRefused 320–328|非null reason含"already in state"→none继续观察；否则log.error，persist StepCheckpointed(AwaitStep,"ChildRejected",Map.empty) 与 OperationConcluded("ChildRejected")。字符串协议不是typed拒绝原因；D2|
|H21 ChildObserved(Some) 330–341|已await checkpoint或terminal→none；hook拒绝→none；成功code==m.childCompletedCode→runKey=intents.getOrElse(AwaitStep,"")，persist checkpoint(code,Map(wafersSlot->csv,childRunSlot->runKey))，thenRun self OpenStep(MergeStep)；其他code→persist空outputs checkpoint及同code concluded|
|H22 ChildObserved(None) 343|Effect.none，不造失败/成功|
|H23 ChildProgressed 345–348|await已checkpoint→none，否则persist ChildProgressMirrored(cursor)，即使mirror持久化也不参与状态决策|
|H24 onSagaState 351–379|非terminal→scheduleNextPoll+none。terminal：Succeeded→"Succeeded"；Aborted→evidence存在Confirmed且phase Prepare则"Compensated"，否则"Rejected"；RecoveryRequired→同字符串；其他terminal抛IllegalStateException。成功merge→persist checkpoint(MergeStep,"Succeeded",Map(txid->identity.transactionId或""))再concluded AllStepsSucceeded；成功非merge→persist checkpoint后self AdvanceAfterCheckpoint；其余stopCode→persist checkpoint空Map+concluded。不会自动compensate父流程|
|H25 startSagaStep 382–400|started缺失throw；txid=intents(stepId)；beforeEffect拒绝return；merge使用triggerCtor.fqn和mergeCtorArgs，否则同FQN和splitCtorArgs，两者最后都追加lotReplySink；按端调用module.from_commandTriggerStart(source,fixtureHost,sagaReplySink)；选coordinator，先`! start`后pollSaga。ctor参数顺序来自B，非模板猜from/to|
|H26 pollSaga 402–408|implicit Timeout(2.seconds)；coordinator.ask(r=>GetStatus(r)).onComplete(tried=>self SagaPolled(stepId,tried.map(r=>r:Reply)))；显式`()`. 非阻塞，不把超时当terminal|
|H27 scheduleNextPoll 410–417|取消相同step已有Cancellable；system.scheduler.scheduleOnce(200.millis,new Runnable{run():Unit=if(!ownerClosed)pollSaga(stepId,对应coordinator)})(ec)；scheduledPolls更新该key|
|H28 startChildStep 419–441|started缺失throw；runKey=intents(AwaitStep)；hook拒绝return；pid=childPersistenceId；initial按child.stateFields顺序，非Int用st.wafers/Int0；复用childActor或ctx.spawn(childPlan.behavior(PersistenceId.ofUniqueId(pid)),pid.replace('/','-'))并存Some；Timeout5s；ask StartRun(runKey,initial,replyTo)。Accepted→()；Rejected→self ChildRefused(reason)；其他成功warn；Failure仅warn unknown；最后watchChild(pid,csvOf(st.wafers))|
|H29 watchChild 446–462|childWatch非空不重复开流；PersistenceQuery.readJournalFor[ScalaDslMongoReadJournal](固定插件ID)，eventsByPersistenceId(pid,0L,Long.MaxValue)→viaMat(KillSwitches.single)(Keep.right)→toMat(Sink.foreach match)(Keep.left).run，存Some。RunCompleted→self ChildObserved(successCode,**调用时原始wafersCsv**)；RunFailedEvt→ChildObserved("ChildFailed",fe.reason)；StageDone→ChildProgressed(sd.cursor)；其他忽略。并未decode完成snapshot以生成新wafers|
|H30 csvOf 464|`private def csvOf(wafers:Vector[String]):String=wafers.mkString(",")`（形参实际为wafersSlot）；不改wire delimiter|
|H31 onEvent 466–474|started→copy(Some)；intent→intents+(stepId->key)；identity→identities+(observed.stepId->observed)；checkpoint→checkpoints+(checkpoint.stepId->checkpoint)；mirror→state原样；concluded→copy(Some)。纯函数，事件中无replyTo|
|H32 onRecovered 476–513|terminal先return；activeStep None→()；Some且started空→()；无intent：split→self BeginOperation(持久started全部payload,新ignore OperationReply sink)，其他→self OpenStep；有intent且await→先watchChild再startChildStep（同identity重发）；有intent且saga：有IdentityObserved→coordinator ! Attach(observed.toIdentity,sagaReplySink)，然后scheduleNextPoll；无identity→startSagaStep。H15与仅OperationStarted前缀组合的进展缺口见D6，不伪造成功恢复|

H14–H32 的原位置覆盖所有onCommand/onSagaState分支。目标可以按 `operation admission / saga observation / child observation / recovery` 提炼具名方法，但每个 guard、日志、persist批次、post-persist效果、抛错及取消点都需保留或有逐项裁定；不能改成 String/Any dispatcher来降低CC。

### 4.4 Child plan：每个循环与codec表达式

[完整 T L518–602][t-child]。

|ID / 行|构造与全部规则|
|---|---|
|C00 519–535|stageVals=stages.map(pascal)；stageCases按zip生成case symbol→原cursor；fieldNames/scalas两个局部值未用。encBody：字段名等wafersSlot或lowercase含wafer则st.field.mkString(",")，否则String.valueOf(st.field)；多于1段用` + ":" + `连接，否则直接mkString。wField取首个wafer字段；decTail对其余字段Int→`text.substring(sep+1).toInt`，其余→Vector.empty[String]；decArgs先wField解析，再decTail，**不是通用按原字段顺序decoder**|
|C01 536–540|stageRun有序zipWithIndex：第一项→state（吸收StartRun）；否则最后一项→state（fixture no equipment I/O）；每个中间项→state.copy(所有Int字段分别=state.wafers.size)。1个stage只走第一分支；2个stage无process；≥4个stage所有中间项都处理，与JP不同|
|C02 541–565|generated/package；imports按顺序 Behavior、PersistenceId、PersistentMonarch/RunObserver/StateCodec、PersistentMonarch.Command、ExecutionContext/Future；fixture与0.2.1持久化注释；object planObj；sealed trait stageType；companion object内每cursor一个case object extends stageType，再`chain:Seq[stageType]=Seq(同序symbols)`，stageName(s) match每case→原cursor，无catch-all|
|C03 567–581|final case class stateType(按字段三元组的name/type有序)，raw有空花括号body；companion `val codec:StateCodec[State]=StateCodec(enc=st=>(上面enc).getBytes(UTF_8),dec=bytes=>{text=new String(...UTF_8);sep=text.lastIndexOf(':');waferText=text.substring(0,sep);State(decArgs)})`；空wafers→Vector.empty[String]，否则逗号split.toVector；Int.toInt的失败/溢出行为保留，不改成吞错默认0|
|C04 583–589|private runStage(stage:Stage,state:State)(implicit ec:ExecutionContext):Future[State]=Future{stage match C01全部case}；显式at-least-once幂等责任注释；这是fixture算法，不是MANUAL设备实现|
|C05 591–600|behavior(pid:PersistenceId)(implicit ec):Behavior[Command[State]]=PersistentMonarch.behavior[Stage,State](pid,Stage.chain,(stage,state)=>runStage(stage,state),State.codec,stage=>Stage.stageName(stage),scala.None,RunObserver.nop[State])；七个位置参数及顺序必须保留|

此M/B/T没有`???`或MANUAL块，不能凭通用规则给它捏造占位实现；实际债是fixture语义、有限字符串codec、硬编码测试以及目标语言片段。依赖聚合的手写规则/Helper槽仍由其原制品负责，不由composition用空成功回执补齐。

### 4.5 Recovery suite 的模板推导与外层

[完整 T L628–848][t-spec]。imports原序为 ActorTestKit；ActorRef/ActorSystem；AskPattern._；ClusterSharding/EntityRef；Timeout；ConfigFactory；StrictSagaCoordinator/StrictStatus；split module+FixtureHost alias；merge module；Host自身；MongoClient；Document；Await/ExecutionContext；duration._。raw没有自动按import依赖去重（Host同包也显式import）。

|ID / 行|构造/RHS与参数默认|
|---|---|
|S00 629–636|拆split/merge FQN，f=specFaces，cmdFamily取最后段但未用；seedCtor(c,replyRef)拼`c.fqn(argument(c.args),replyRef)`，replyRef总最后|
|S01 637–655|beginArgs：name==wafersSlot→该局部参数；其他collection→Vector.empty[String]；scalar from→From、to→To、manifest→ManifestSeed，其他throw。occupierArgs：TransactionId→txid；Input(from/to/manifest)映射常量；Input(wafersSlot)→Vector("w-901","w-902")；其他source throw；List加toList|
|S02 656–663|按classpath resource path打开recovery模板；缺资源IllegalStateException；UTF_8 readAllBytes，finally close；HOST/SPLIT_ENTRY/MERGE_ENTRY/ENTITY_KEY/CHILD_PLAN/CHILD_STATE六token；`@([A-Z_]+)@`替换，quoteReplacement，未知token抛IllegalArgumentException|
|S03 664–708|generated/package/imports/“prefix truncation after writer termination”注释；`final class FixtureCompositionSpec extends AnyWordSpec with Matchers`；MongoHostPort从环境名SAGA_MONGO_HOSTPORT/default127.0.0.1:27017（只读源码，**本次未读运行环境**）；mongoUri插值；mongoReachable开Socket连2秒finally close，Throwable→false。常量ReconcileToken、SeedWafers四个w-00x、SplitWafers前2、ChildBaseWafers(w-101)、ManifestSeed、From/To，完整值见T/R/D|
|S04 709–731|freePort用ServerSocket(0)，finally关闭；compositionConfig(name,port,uri)以akka://name@127.0.0.1:port为seed，WARNING、cluster provider、canonical/bind hostname/port、seed nodes、jmx multi mbeans、journal/snapshot插件与RxMongo driver/mongouri；parseString(s triple string.stripMargin).withFallback(ConfigFactory.load())|
|S05 733–755|aggregateBehavior(entityId):Behavior[commandFamilyFqn]=EventSourcedBehavior(named persistenceId=PersistenceId(entityKey.entityTypeKey.name,entityId),emptyState=entity.empty(entityId),commandHandler=behaviors.apply,eventHandler=eventHandler.apply)；initSharding取system，init(Entity(key)(ctx=>aggregateBehavior(ctx.entityId)))并返回；waitClusterUp轮询成员size<1/20s，sleep100，require nonempty；entityRef用同key/entityId|
|S06 757–766|class implicit Timeout10s；askNow[Cmd,Res](kit,RecipientRef[Cmd])(f:ActorRef[Res]=>Cmd):Res，局部implicit system、Timeout15s，Await.result(ref.ask(f),15s)；carriedOf=askNow(queryCtor(replyTo)).state.<stateField>.keySet.toSet|
|S07 769–786|seedFunds(kit,sharding,entityId,txid,wafers=SeedWafers)：entityRef→Prepare ask→Commit ask→assert两个error空；spawnHost(...,audit:Option[(String,String)=>Boolean]=None)：implicit ec，两个entry.spawnClusterSingleton(system,sharding,ReconcileToken)，audit Some→behaviorForTest、None→behavior，kit.spawn(...,"composition-<operation>-<occurrence>")|
|S08 788–807|begin(...,wafers):OperationReply，局部system/ec，ask BeginOperation(原order和S01 seed) Await15s；progressOf同法GetProgress；awaitConcluded(...,maxSeconds:Int=60)，取report、while空终态且deadline有余 sleep150重查，assert defined，再返回report|
|S09 809|整份已替换R按原顺序内嵌；不是略去的黑箱，R账见下表|
|S10 811–843|E5：seed两端；启split coordinator/fixtureHost；txidFor(op-e5,occ-1,真实splitStepId)；造occupier(完整映射+replyProbe)，发from_commandTriggerStart；probe.awaitAssert至terminal，40s/500ms、单ask10s；spawn/begin同txid异wafers的host；awaitConcluded；**assert Rejected**而不是ConflictingIdentity；断言From余额种子不变。注释明确承接旧Saga terminal，不能推广为所有异args都安全，见D4|

### 4.6 被内嵌的 recovery resource：全部成员与用例

固定完整 [R L1–314][r]。R是class内部片段，不发package/import。所有辅助方法raw为private（D抽出时有去private步骤）；`JournalBatch`为private final case class。除表中默认值，其余无默认。

|R行/成员|完整RHS与副作用/分支|
|---|---|
|1–10 OwnedUris/dbNameOf/journalCollections/JournalBatch/number|OwnedUris=mutable.Set.empty[String]；dbNameOf=uri.split('/').last；journalCollections Await listCollectionNames10s→Vector→含journal过滤→sorted；JournalBatch(collection:String,document:Document,from:Long,to:Long,events:Vector[BsonDocument])；number=get(key).asNumber.longValue|
|11–29 batches(client,uri,pid)|按collection find(Document(pid)),Await10s；每document取events Bson array转Vector、from/to；require非空首pid正确、全部pid相同、sn向量==(from to to)；构造batch；全局sortBy from；展开sequence require==(1L to size)连续prefix；返回result|
|31–45 rawEvents/countJournal/eventsOf|rawEvents新MongoClient，batches事件.toJson，finally close；count=size.toLong；eventsOf implicit materializer，currentEventsByPersistenceId(pid,1L,Long.MaxValue).runWith(Sink.seq),Await15s，assert序号1..size，返回Vector[EventEnvelope]|
|47–58 stoppedWriter/assertPrefix|shutdownTestKit后require已terminated、OwnedUris.contains且dbName p16_composition_前缀；assertPrefix对raw bytes字符串向量==expected.take(keep)且size=keep；println P16_PREFIX包含实际prefix|
|62–92 truncateJournal(stopped,uri,pid,keep)|先require停写者/归属；MongoClient；抓before/expected；keep>0且<总事件；所有含snap集合不得有该pid快照；每batch按_id/pid/from/to过滤：from>keep deleteOne且deleted=1；跨keep batch按sn筛survivors，$set events及to，matched/modified都=1；其余不写；assertPrefix；finally close。不得对生产DB复用|
|94–102 hostPid/childPid/SplitSagaPid/MergeSagaPid/lotPid/durableEffects|分别Host PID、child PID、两个Entry.persistenceId.id、PersistenceId(EntityKey.name,entityId).id；durableEffects依次取split/merge/child(operation,occ-1)/From/To的rawEvents为Map|
|104–137 assertExactlyOnce|Mongo查含journal全部document，取strict-saga/前缀pids去重，assert恰两个；每端events非空，Started恰1且txid==Host.txidFor(operation,occ-1,step)；child RunStarted/Completed各1、StageDone cursors**固定 receive#0/process#1/finalize#2**；decode末snapshot断言wafers和processedCount；业务events取Product，以首元素txid筛，productPrefix恰四种 Reserve/Commit AddWafer/WaferRemoval Confirmed；查询From/To回归原种子；println计数说明。这是特定fixture oracle，不是普通生成合同|
|139–163 shardingOf/assertHostTrace|shardingOf=ClusterSharding(system)；host trace Start恰1且manifest/wafers等常量；每step intent/checkpoint各1且intent先；key等derived key；非await identity恰1且顺序夹在intent/checkpoint间；child outputs硬编码wafers/childRun正确；child checkpoint先于merge intent；concluded恰1|
|165–173 effectAudit(...,blocked=None,hit=None):(String,String)=>Boolean|每次effects之前查询host journal，assert对应intent已可见；hit foreach发送tuple；println send= !blocked.contains(step)；返回该Boolean。不从wall clock推断effect发生|
|175–195 recover/withCluster|recover(name,uri,operation)(body:(kit,sharding,host)=>Unit)：new kit/config/freePort，init/wait/spawn带effectAudit，body，finally shutdown；withCluster[T](name)(body:(kit,sharding,uri)=>T)：assume mongoReachable（canceled不是pass），uri=p16_composition_+nanoTime登记OwnedUris，建kit/init/wait/body，finally未terminated才shutdown；没有drop数据库|
|197–226 E0|live writer truncate拒绝；停写者后造三batch(1–2/3–5/6–7)与protected pid；unowned/keep0/keep7/missing pid拒绝且原bytes不变；keep4后exact prefix、protected不变、bounds(1–2/3–4)；malformed sn batch拒绝；client finally关闭|
|228–236 E1|seed两端；host带effectAudit；Begin accepted；AllStepsSucceeded；assertHostTrace与assertExactlyOnce|
|238–261 completedWindow(name,operation,cut:Any=>Boolean,expectedKeep:Option[Int])|完成一次；assertExactlyOnce；durableEffects非空；cut恰1个event，keep=sequenceNr.toInt并可比expectedKeep；停writer→truncate host→recover；终态成功；saga/child/business journal完整bytes不变；再次两类assert。Any仅测试cut predicate，不建议推广成业务dispatcher|
|263–282 E2/E3/E4|分别cut split IdentityObserved、await InvocationIntentPersisted、split InvocationIntentPersisted；expectedKeep=Some(3)/Some(5)/Some(2)，用completedWindow，验证reattach/child权威对账/同identity重发|
|284–303 E4b|effectAudit阻split并发送hit；Begin accepted；hit键精确；两个Saga+child journal计数0；保存host prefix；停writer；assertPrefix keep2；recover后成功、trace/effects精确|
|305–312 E6循环|三项(label,cut)：child-checkpoint、merge-intent、merge-identity；各注册独立测试，name去连字符，operation带原label，expectedKeep=None；同completedWindow完整算法，无空循环替代|

### 4.7 Deployment 模板组装与全部输出

[T L604–626][t-deployment]：`read(name)`取`/codegen/templates/<name>`资源，缺失throw、UTF_8、finally close；先读取R；facts=R开头至`private def stoppedWriter`前 + `private def hostPid`至`private def effectAudit`前，再正则将行首两个空格后的`private `去掉。因此D**不含**truncateJournal/withCluster/E用例，但含OwnedUris、journal facts及oracle。tokens含HOST、SPLIT_ENTRY、MERGE_ENTRY、ENTITY_KEY、CHILD_PLAN、CHILD_STATE、PACKAGE、PACKAGE_TAIL、FACTS、COMMAND_FAMILY、ENTITY、BEHAVIORS、EVENT_HANDLER、PROTOCOL、SEED_WAFERS；最后一项仅seedPrepare存在param==wafersSlot且List才wafers.toList，否则wafers。连续两次replace处理FACTS内token；未知token抛错，不忽略。

D原始import顺序：ActorTestKit；ActorRef/ActorSystem；AskPattern._；typed adapter._；ClusterSharding/EntityRef；Cluster；MemberStatus；Timeout；ConfigFactory；StrictSagaCoordinator/StrictState/StrictStatus；MongoClient；Document；play.api.libs.json._；java.nio.file Files/Path/Paths/StandardCopyOption；StandardCharsets；Await/ExecutionContext；duration._。顺序照固定文件保存，目标按依赖布局裁定；不要把Play JSON导入业务domain。

|D行/构造|RHS/完整分支|
|---|---|
|1–32 header/package/facts|generated by invocation-host:composition-deployment；package token；private[packageTail] object CompositionDeploymentFacts；7个fixture常量与S相同；插入上述选定R facts，R表中的方法体原样|
|34–63 aggregateBehavior/initSharding/entityRef/askNow/carriedOf/seedFunds/begin/progress|前三同S映射；askNow泛型、curried f、system/Timeout15s/Await15s；carriedOf**硬编码**PROTOCOL.GetLotState(...).state.carried；seedFunds按PROTOCOL.ReserveAddWafer再CommitAddWafer，各assert error空；begin固定operation,occ-1,From,To,SplitWafers,ManifestSeed,reply；progress GetProgress。与specFaces可变query/seed形状不完全一致|
|65–87 write/read/waitFile/awaitUp/identity|write(Path,JsValue) require不存在，写同名.tmp UTF8 prettyPrint，再ATOMIC_MOVE；read=Json.parse(readAllBytes)；waitFile每50ms直到deadline，require存在后读；awaitUp计MemberStatus.Up，40s每100ms，require数量恰count；identity JsonObject(processPid=ProcessHandle.current.pid,node=selfMember.uniqueAddress.toString,hostPid=hostPid(operation,occ-1))|
|88–117 freeze|读host typed/raw；Start恰1、split intent存在、无Concluded/merge journal；mode first-start→sequence恰1,2且split/child空；否则require child-completed：split checkpoint/identity、await intent存在，无await checkpoint/merge intent；split Started1+Succeeded、child Started1/Completed1/StageDone3；write frozen.json(identity+mode/sequenceNr/hostRaw/effectsRaw/mergeStarted0)，println|
|120–144 node/main入参与配置|object FixtureCompositionDeploymentNode import facts._；main(Array[String]):Unit；require args.length7；role/port/seed/uri/operation/mode/dir按序；role owner或successor，mode两个固定值；db p17_composition_前缀；name从seed截取；cluster、关闭Java序列化、loopback canonical/bind、seed、Mongo journal/snapshot/driver/uri config.withFallback；new kit|
|145–177 node初始化/hooks|implicit ec、initSharding、两个entry singleton；TestHooks beforeEffect在owner/first-start/split时freeze并false，其余true；beforeChildCheckpoint在owner/child-completed时freeze并false，其余true；recovered successor先require owner-stopped evidence，核seq/raw prefix/started&&!terminal，owner则seq0+empty；write role-recovered+println；stopped写role-stopped+println；spawnClusterSingletonForTest同operation/occ-1|
|178–183 owner branch|等待owner-recovered40s/frozen90s；duplicate begin被拒绝；写owner-duplicate；Await whenTerminated无限时长（由父测试持有并终止）|
|184–213 successor前半|awaitUp2；读owner回执40s，pid不同；尚无successor-recovered；SerializationExtension(classicSystem)；GetProgress、OperationReply、ProgressReport、BeginOperation四个消息逐个禁止JavaSerializer，serialize/manifest/id/deserialize equality；远程progress未started；mismatch operation拒绝且journal空；seed两端；Begin接受随后duplicate拒绝；等待frozen/owner-duplicate；写ready-to-terminate；等待successor-recovered90s|
|214–245 successor后半|reconcileSink；90s deadline；while未concluded：两个coordinator ask GetStatus，非terminal且有identity则Reconcile(identity,ReconcileToken,32,sink)，其余不动，TimeoutException仅忽略；sleep150刷新progress。断言AllStepsSucceeded、trace/effects；raw prefix保留；child-completed模式下split/child原bytes非空且不增；写result.json(identity/concluded/hostRaw/effectsRaw及固定计数)，println，再shutdownKit|
|246–249 catch|Throwable.printStackTrace→shutdown→sys.exit(1)；不是吞异常返回成功|
|252–264 suite/helpers|final class FixtureCompositionDeploymentSpec extends AnyFunSuite；import facts._；freePort同S；stop(Process)：若alive destroy；waitFor30s失败则destroyForcibly、waitFor并fail“forced cleanup; SIGTERM certification failed”|
|265–286 两模式循环/启动|each mode注册E-D；环境键default同S，仅模板读取；Socket连2秒；classpath必须含target与scala-2.13（要求Test/fork）；run=nanoTime；mkdir target/composition-deployment/<mode>-<run>绝对目录；operation/uri p17专属；两个freePort避相等/9000/2551；seed；java.home/bin/java；node(role,port) ProcessBuilder(java,-cp,classpath,PACKAGE.FixtureCompositionDeploymentNode,7args)，日志分role、merge stderr、start|
|287–318 父进程证明|先owner；successor=null；读original并核pid/seq0；启动successor；ready后核frozen owner pid、successor未恢复、raw prefix一致；写signal.json(SIGTERM+两个pid/port/uri)；owner.destroy；wait45s且exit0或143，owner-stopped必须存在；successor wait180s且exit0；核新processPid/node不同但hostPid和sequenceNr相同；result成功、Saga计数1,1/business4,4；写process-result(reaped=true/forcedCleanup=false)，println|
|319–324 finally/收尾|先stop successor（非null），finally stop owner；结束for与suite。目录/数据库不自动删除，不能拿“终于退出”代替清理台账|

## 5. JS三条真实路线与四层差距

### 5.1 legacy：实现存在，但不从 formal product producer 自动获得

[run-all L2298–2406][legacy-dispatch] 的真实路径：同时存在sagaExecutionBinding、sagaBinding、canonical.sagas非空→compileExecution(rawCanonical,binding)→找第一个childRuns composition→造inline model→J/JS→strictSourceEntries；最终只有全run-all无error才applyEntries。无composition时明确skip；异常记error并最终exitCode1。不是凭目录名判可达。

inline Model（L2334–2352）字段：pkg/specPkg=`fixture.composition`、hostName=`FabCompositionHost`、pipelineId=IR.id、pidPrefix=`fab-composition`、steps、split/merge引用、child(pkg/planId/planObj/stageType/stateType/pidPrefix/stages/stateFields)。planObj由child ID Pascal化，若不以Fab开头再前置Fab，末尾加Plan；saga moduleObj由entry尾名Entry→Module替换，**没有 BC admitted module resolver 的核对**。这与M的26字段不是同一个模型。

- J L17–29只require split/merge/child，await step用find(...).id，两个invoke取前两项；先调用JP生成child，再组host。
- J 的 H协议/身份/状态/效果/恢复主体与T结构相近，但 BeginOperation/OperationStarted写死from/to/wafers/manifest、LotReply FQN、StartTransfer和FabSplitSagaModule/FabMergeSagaModule。J L370–382单个wafersForStep及if切from/to，T L386–393是两套按模型CtorArg构造；不把这差异压成格式问题。
- J的child success固定`ChildCompleted`，T来自m.childCompletedCode；其余child行为同样有拒绝字符串与原wafers终态问题。
- JP L6–24有state/stage/plan默认名、cursors fallback(cursor||id||s)，至少1项；第一cursor返回state、第二cursor处理processedCount、其余返回state。BC是第一/所有中间/最后；两stage及四stage输入会产生结构行为差异。JP imports额外未用EventSourcedBehavior，state固定wafers/processedCount，T从有限state模型渲染。
- JS L20–24和L222–229硬编码Lot aggregate/entity/behavior/event/query/seed面；T外层spec大部分来自specFaces，但R/D仍有Lot专用oracle与命令名。JS还输出未用MergeFixtureHost/Sorts import、stateOf helper、seed局部`val import_ = LotProtocol`；T直接query/map，直接constructor。
- [saga-dsl/generate.mjs L87–146](../baseline/js/generators/saga-dsl/generate.mjs#L87) 的legacy/strict-contract API是**另一路**：strict-scala明确runtimeBlocked，仅contract JSON；不调用J/JS。因此不能把generic `generate --generator saga-dsl`宣称为组合host生成CLI。

### 5.2 formal 银行：复合文件包含必要行为，但不是四文件组合面

[generate-cli L92–101](../baseline/js/lib/products/generate-cli.mjs#L92) 显式注册producer；[play-service generate L16–27](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L16) 继承createEffectRegistry('2')；[produce-effect L6–25](../baseline/js/generators/scala-cqrs-application/produce-effect.mjs#L6) 继承applicationRegistry；[produce L17–30](../baseline/js/generators/scala-cqrs-application/produce.mjs#L17) 的finite-host-dsl明确组合 Definitions、InvocationHosts、Adapters、TechnicalPorts、HostIO、Verification。F按`entry.startOwner.kind`选择：pipeline→P；direct→F自己的body；其他fail。

child另由 [produce-child L10–22](../baseline/js/generators/scala-cqrs-application/produce-child.mjs#L10) 挂renderChildPlans/renderChildHosts。Play service这里继承effectRegistry而非childRegistry，不能从三个目录同时存在推断银行自动具备该完整child接线。

|层|BC composition|formal F/P 当前事实/必须保留或另属B的部分|
|---|---|---|
|Model|显式CompositionHostModel/子型；有界三step|F/P直接读products布局/Saga host/runtime/execution，在renderer内find、推导nominal、构造Scala串；无此26字段模型。其h/p/step是不同生命周期合同，不可直接强转|
|Builder|admitted version/entry/有序args/aggregate faces|P L9–32验证精确pipeline invocation、原始字段lineage、身份nominal textual/integer carrier、input/checkpoint可见性、原args顺序；这些真实拒绝分支不能为迁移模板而删除|
|Template|一个host管split/child/merge，child journal权威|P产生**一步invoke**；完整parent state编码Associated，再Start/Attach、Status exact identity校验、结果delivery、ack；没有T的BeginOperation/StepIds/子journal watcher四文件职责|
|产物|raw四文件未实跑|A为该formal P经wireHostIO后的现存成品；只可结构对照，不能拿它承诺Fab/银行行为同构|

P在其51行里拼了完整类，不能按源码行数说复杂度低。它的具体构造/循环RHS如下，A可直接观察最终插入后的差异：

|F/P或A位置|当前内容与目标处置|
|---|---|
|F15–24 / P12、33–34 / A1–28|pkg=packageFor(context)+`.application`；stem=id.replaceAll('-','_')，再Host造成bank_payment_hostHost；Request/Reply/Event/State同object内。A实际还插入AdmissionGranted/Admitted；State按原顺序original,args ByteString.EMPTY、operation空串、identity/result None、delivered/admitted=false。这里是流程持久化状态，不强塞到业务实体domain|
|F25–29 / P14–37 / A29–49|direct fromEntry按原input member映射；direct operationIdentity含association IDs；pipeline originalInput优先trigger args、idempotency映射或pipeline input，checkpoint必须Some否则throw；invocationArgs按runtime slots顺序；身份帧先所有UTF8段length int再bytes、SHA-256前缀sha256:，含Saga/context/version/pipeline/planVersion/step/operation/occurrence及iteration/chunk presence。classify区分Succeeded、Aborted有prepare evidence、RecoveryRequired有Uncertain。validStatus同时核argsBytes、txid、definitionName/version/digest、argsCodec.pin、argsDigest、已有identity及StrictSagaProtoConverters.stateToProto可编码。**全部是保护面，不换成raw的op-拼接或只看terminal**|
|P38–42 / A50–61|parent用Execution.codec.decode(state.original.toByteArray)；completed先取identity与original；循环h.results找invoke mapping/outcome，continue按step.writes顺序找result payload lineage构ctor，stop无参数；recovery-required/outcome-unknown→Pending，不冒充Completed；其他unknown→Conflict。A映射Succeeded(TxId(identity.transactionId))/Rejected/Compensated，两个pending|
|F30–38 / P43–47 / A63–69、95–100|Delivery trait按h.results顺序每结果一个方法(destination:真实nominal,event:真实domain event,identity):Future[Boolean]。原inline deliver按args或transaction-id造event，nominal txid保留wrapper，未知kind Future.failed；pipeToSelf失败/false为Delivered(...false)。wire后A改由HostIO.deliver负责完整authority对账，不许移植时丢失|
|F39 / P47 / A101–122|Invoke/Submit编码全部原输入、args、operation，已关联异bytes/identity→Conflict且none；pipeline已delivered terminal→completed；已有operation→observe；首次persist Associated后observe。Status invalid→Conflict none；valid→条件IdentityObserved+新的ResultIntent，persist后delivery/完成/Pending；Denied→等待；ConflictingIdentity→Conflict；Delivered true且当前kind匹配→persist ack后回复，其余等待。direct多ReceiveEntry→Submit和Observe未关联等待，direct Accepted(identity)/ResultRecorded有别于pipeline Completed|
|F39 / P47 / A123–129|事件fold依次Associated copy三值、IdentityObserved Some、ResultIntent Some+delivered=false、DeliveryAcknowledged true；wire加AdmissionGranted admitted=true。纯事件演进，不能改成command直接改持久state|
|[wireHostIO L5–22](../baseline/js/generators/scala-cqrs-application/render-host-io.mjs#L5) / A70–94、116–118|源码字符串replace改构造参数delivery→technical Installed，增加admitted字段/event/internal command；局部admissionPending=false/replies=Vector.empty；takeAdmissionReplies先copy、clear、reset，再spawn一次性广播reply actor；observe未admitted入队，只发一次admit，异常→保守拒绝，pipeToSelf带operation；admission成功persist AdmissionGranted后observe新state，拒绝none→Pending；过期Admitted none。此串补丁应转显式Model/Template construct，但语义不能删|
|F40–45 / P48–49|policy由technicalPorts role决定；direct另有external-event+occurrence-source两者同在才生成SubmitOccurrence/OccurrenceAdmitted及admitOccurrence，right转Submit，left等待；P不传occurrence。最终entry(pathFor(...Host.scala),text,'invocation-host',[h.source],footprint,deps)；pipeline deps=Execution+Definition，direct还含DomainConverters/domain event protocols。source、footprint、deps迁移必须一起跟随|

### 5.3 family：有真实接线，但不是classic/P15替代品

[generate-cli L45–63、92–101](../baseline/js/lib/products/generate-cli.mjs#L45) 注册 `scala-cqrs-saga-monarch-v1`，强制generate-project捕获外置实现；裸generate-products（包括plan）报SAGA_MONARCH_CAPTURE_REQUIRED。

[family generate L12–43](../baseline/js/generators/scala-cqrs-saga-monarch-v1/generate.mjs#L12) 核manifest、live实现上下文和八个精确products，经planProductSet后buildModels→implementationBuildInputs→render。[builder L35–76](../baseline/js/generators/scala-cqrs-saga-monarch-v1/build-models.mjs#L35) 要求host@3的v2 payload、固定R2 runtime、sha256-item-frame-v1、一个精确two-participant Saga、selected workflow及typed runs；maxActiveItems≤100，nonempty exact decimal/money descriptors拒绝；包当前为base.kernel/glue/root。它不是“读到了composition字段所以能替代P15”。

[render L12–30](../baseline/js/generators/scala-cqrs-saga-monarch-v1/render.mjs#L12) 使用protocol/codecs/saga/runtime/workflow/root六role模板和build artifacts，renderJobs+sagaMonarchSourceEntry做映射；[builder L385–398](../baseline/js/generators/scala-cqrs-saga-monarch-v1/build-models.mjs#L385) 明确artifact kind/deps/模块kernel→glue/ext→root。

已实读的 [rootTemplate完整112行](../baseline/js/generators/scala-cqrs-saga-monarch-v1/templates/root.mjs#L1) 生成显式system/namespace/ports/settings/ownership及run Leaves构造；reservations、run hosts、program、lazy WorkflowHost；recover先Saga reconcile再workflow reconcile；有run area才生成authorize→检查active job/blocked batch/items/reservation→reactivate/canResume→reconcile的recoverRuns/resumeRuns；close按CallerOwned不终止、ApplicationOwned终止并等whenTerminated；fromExternal从捕获implementation construction和constructor列表组ports/Leaves。**这套资源/批次/typed Run接口不是T的StepCheckpointed/Mongo eventsByPersistenceId协议**。本次没有把其他family模板当作本artifact的MBT，也不冒称已全审其内部。当前disposition=`not-wired`（相对于本P15有界组合合同），不是说family无消费者。

## 6. 真实 minus/plus：结构性对照，不是可应用补丁或同输入字节比较

### 6.1 legacy已有构造 → BC结构目标

minus逐字取 [J L365–388][j-start]，plus使用 [T L382–399][t-effects] 的**原模板插值记法**；不是为银行虚构Lot行为。模板侧须先有§3模型，不能直接在Scala产物留下`${...}`。

```diff
@@ startSagaStep：原始资料是两种模板，不是一次同输入生成 @@
   private def startSagaStep(stepId: String, state: ComposedState): Unit = {
     val st = state.started.getOrElse(throw new IllegalStateException("step start without a started operation"))
     val txid = state.intents(stepId)
     if (!beforeEffect(stepId, txid)) return
-    val wafersForStep: Vector[String] = stepId match {
-      case MergeStep =>
-        // Merge consumes the durable completed-child manifest, never a mirror.
-        state.checkpoints(AwaitStep).outputs("wafers").split(",").toVector
-      case _ => st.wafers
-    }
-    val source = new net.imadz.metarch.application.aggregates.LotProtocol.StartTransfer(
-      txid,
-      if (stepId == MergeStep) st.to else st.from,
-      if (stepId == MergeStep) st.from else st.to,
-      wafersForStep.toList,
-      st.manifest,
-      lotReplySink)
+    val source = if (stepId == MergeStep)
+      new ${m.triggerCtor.fqn}(
+${ctorLines(m.mergeCtorArgs)},
+        lotReplySink)
+    else
+      new ${m.triggerCtor.fqn}(
+${ctorLines(m.splitCtorArgs)},
+        lotReplySink)
     val start =
-      if (stepId == MergeStep) FabMergeSagaModule.from_commandTriggerStart(source, mergeHost, sagaReplySink)
-      else FabSplitSagaModule.from_commandTriggerStart(source, splitHost, sagaReplySink)
+      if (stepId == MergeStep) ${mergeObj}.from_commandTriggerStart(source, mergeHost, sagaReplySink)
+      else ${splitObj}.from_commandTriggerStart(source, splitHost, sagaReplySink)
     val coordinator = if (stepId == MergeStep) mergeCoordinator else splitCoordinator
     coordinator ! start
     pollSaga(stepId, coordinator)
   }
```

这只说明输入映射从硬编码移到B；不批准把所有ctor继续长FQN铺排。approved-target还要正常import/命名及D3 reply合同。raw没有named args，本制品目标将是否按CtorArg.param生成named args作为D3接口核验的一部分，不凭名字猜库方法参数。

### 6.2 现存银行 → 已批准命名/排版覆盖（不是P15语义替换）

minus来自 [A L1–16](../baseline/actual-js/app/example/bankwealth/application/bank_payment_hostHost.scala#L1)。plus展示已批准PascalCase/无HostHost/长参数换行与应用层落点；Execution同步名字/引用由唯一assembly owner协调，**本片段不是可直接编译的完整迁移**。稳定`bank-cash-payment-v1`、operation帧、PB/serializer等一字不动。

```diff
--- actual-js/app/example/bankwealth/application/bank_payment_hostHost.scala
+++ approved-target/app/example/bankwealth/application/services/transactor/BankPaymentHost.scala
@@ package、宿主名与应用Actor命令 @@
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
-  final case class Invoke(state: bank_cash_payment_v1Execution.State, replyTo: ActorRef[Reply]) extends Request
+  final case class Invoke(
+      state: BankCashPaymentV1Execution.State,
+      replyTo: ActorRef[Reply]
+  ) extends Request
   private final case class Observed(reply: StrictSagaCoordinator.Reply, replyTo: ActorRef[Reply]) extends Request
   private final case class Delivered(kind: String, ok: Boolean, replyTo: ActorRef[Reply]) extends Request
```

此hunk未尝试一次改齐A全部imports/协议分组；完整义务在§5表，不能据一个hunk签收整文件。这里也没有把domain event改成Actor command。A的`validStatus`完整RHS、admission/authority/delivery、typed nominal、ByteString wire边界留在自身合同，不被Fab成功路径替代。

### 6.3 raw-scala → approved-target 的有限偏差账

|编号|已批准的约束|本artifact落地边界|
|---|---|---|
|O1|业务根只三层|原hostPkg来自独立composition namespace，需明确布局绑定及D1 adapter/bootstrap拆分；不保留第四层或永久转发壳|
|O2|PascalCase/lowerCamelCase，无HostHost|源码名、stage对象名统一resolver；原stage cursor/PID/txid不随之改变；BC strictNestedName/JP pascal并非等价resolver|
|O3|正常imports/长行拆分|依赖模型收齐nested reply/command/child/runtime；去未用import，冲突alias保留；不对最终源码regex清理FQN|
|O4|CC≤5目标/短小行为组|raw onCommand/recovery与字符串renderer需职责分组；未测CC、不用删guard或无类型分发表达标|
|O5|完整实现槽诚实|本模板fixture逻辑保留为fixture；没有设备/银行真实实现。不将隐含Lot query/error/seed约定变成万能默认体|

## 7. 胶水与身份合同（依赖源码/声明不等于JAR可用）

|完整符号/来源|本制品实际需要的调用形状、语义与持有者|
|---|---|
|`akka.persistence.typed.scaladsl.EventSourcedBehavior` / `Effect`；Akka 2.6.20 scaffold|`EventSourcedBehavior[Command,Event,State](pid,empty,handler,fold)`；`Effect.none/persist(events...).thenRun`；RecoveryCompleted/PostStop/lastSequenceNumber。host负责persist与后续side effects，fold负责状态；不会因testkit源码存在就认为runtime可用|
|`akka.actor.typed.ActorRef/ActorSystem/Behavior/Scheduler`；`akka.actor.typed.scaladsl.ActorContext/Behaviors/AskPattern`|typed ask、spawn/ignore/self；scheduler2s/5s ask timeout、200ms重试；开始拒绝不persist。内部信号无replyTo；Begin/GetProgress明确replyTo；事件无ActorRef|
|`akka.cluster.typed.ClusterSingleton/SingletonActor`；`akka.cluster.sharding.typed.scaladsl.ClusterSharding`|singleton init build；两个fixture host构造接system/sharding；运行应用负责system生命周期，host只取消自己poll/watch，不擅自terminate caller system|
|`net.imadz.infra.saga.strict.StrictSagaCoordinator`|module.from_commandTriggerStart(source,host,replySink)产生Command；GetStatus(ActorRef[Reply])；Attach(TransactionIdentity,replySink)；测试Reconcile(identity,authorization,32,replySink)。Status/ConflictingIdentity/Denied等实际分支按各lane保留，不能把Attach替新Start或借timeout宣布失败|
|`net.imadz.infra.saga.strict.StrictState/StrictStatus/Evidence/Phase/TransactionIdentity/CodecPin`|terminal、status、identity、evidence；Confirmed(op,_)且op.phase==Prepare；TransactionIdentity六个标量加CodecPin和planDigest顺序见H04；formal还需argsBytes/Uncertain/StrictSagaProtoConverters校验。raw import OperationIdentity未消费|
|`<splitModuleFqn>.from_commandTriggerStart`、`<mergeModuleFqn>.from_commandTriggerStart`；`<splitPkg>.FixtureHost` / `<mergePkg>.FixtureHost`；entry FQN|strict-fixture-host依赖包的真实输出；默认构造(system,sharding)、entry.spawnClusterSingleton(system,sharding,ReconcileToken)、entry.persistenceId；模块方法准确source/reply泛型必须以fixture-host包裁定，无JAR/编译验证结论|
|`net.imadz.monarch.persistence.PersistentMonarch` / `StateCodec` / `RunObserver`|C05七参数behavior；StartRun(runKey,initial,ActorRef[RunReply])、Accepted/Rejected；RunCompleted/RunFailedEvt.reason/StageDone.cursor/snapshot；StateCodec(enc,dec)、codec.decode(snapshot)、RunObserver.nop。stage at-least-once，由业务fixture保证幂等；不能将child镜像视为authoritative|
|`akka.contrib.persistence.mongodb.ScalaDslMongoReadJournal` / `akka.persistence.query.PersistenceQuery` / stream APIs|插件ID `akka-contrib-mongodb-persistence-readjournal`；host live eventsByPersistenceId从0，spec currentEvents从1；KillSwitch owner为host。终态只从child journal，Mongo adapter拆分不改变offset或权威源|
|`net.imadz.common.CborSerializable`|H命令/事件/回复marker；scaffold可能同时携带common源码与common-core依赖，来源须由集成pin核对。不可扩大绑定至所有GeneratedMessage或把nominal类型alias掉|
|`org.mongodb.scala.MongoClient` / `Document` / BSON；`org.scalatest.wordspec.AnyWordSpec` / Matchers / AnyFunSuite；`play.api.libs.json`|仅测试Mongo查改/证据序列化/进程suite；R允许独占停止writer后的journal surgery，D只观察实际双JVM迁移；测试环境不达不能算passed|
|JDK MessageDigest/UTF_8/DataOutputStream、Files/Socket/ProcessBuilder|身份字节帧与CSV decoder语义固定；文件/网络/子进程只在特定测试/adapter边界，不能向domain泄漏|

依赖供给实际冲突必须显式保留：

1. [BC scaffold build.sbt L127–166](../baseline/bc/scaffold/build.sbt#L127) 默认common/monarch/saga均0.2；可选`codegen.candidate.sagaCore`及成对monarchCore/monarchPersistence unmanaged JAR。M/B上游准入却钉strict snapshot和Monarch0.2.1；T注释也是0.2.1。不能据这些声明认为默认0.2就提供同API。
2. scaffold Mongo RxMongo 3.0.8（L95–100）、mongo-scala-driver 4.11.0（L172）、ScalaTest3.2.15（L92），明确避免两套Mongo query classes冲突。
3. [formal generate-cli L114–125](../baseline/js/lib/products/generate-cli.mjs#L114) 要求显式file:/// repository，读取saga-core_2.13/0.3.0 JAR并核sha，pipeline另核monarch-core/monarch-persistence_2.13/0.3.0固定SHA。这是入口代码要求，不是本次已读/已验JAR。不能给它喂0.2.1以求模板相似。
4. family是冻结R2且不同typed Run/Workflow ABI；选择移植旧API还是适配当前供给是D2，未授权发布/升级/复制runtime。

跨制品不变条件仍适用：聚合 CommandHelper 必须在 `application.aggregates.behaviors`，具备 `toParam/createFailureReply/createSuccessReply`，经 `runReplyingPolicy`；domain参数/事件无ActorRef；失败不persist、成功persist/apply后thenReply读取新state；`replyWith`不等于`replyWithAndPublish`。本composition不直接使用CommandHelper，不能凭H15的thenRun回复替代上述聚合合同；也不能给所有内部host信号机械加replyTo。原有PB/PID/serializer/nominal/overflow身份不改。

## 8. 拟实施写集合、唯一组装owner与退役

以下全是**第二阶段 proposed**，本阶段一项也未写。逻辑owner：`composition-invocation-host`负责自己的结构模型和四个模板；**唯一跨文件assembly owner为集成者**，包括共享registry、F/P/HostIO拆分及old→new清单。不能同组与其他Saga/strict包同时编辑同一renderer。

|proposed路径（相对JS仓）|责任/复用/迁移|
|---|---|
|`generators/scala-cqrs-composition-invocation-host/model.mjs`（新）|显式对应§3的26字段/ChildPlanRender/CtorArg/CommandCtor/SpecFace；identity字段与symbols分开；增加结构化dependencies/source引用，不能一个content字符串包全部|
|`generators/scala-cqrs-composition-invocation-host/build-models.mjs`（新）|输入有界composition plan + admitted Saga/aggregate faces；B01–B11逐规则，解析失败保留。公开product适配输入如何供给见D7，不新建银行真源副本|
|`generators/scala-cqrs-composition-invocation-host/templates/host.mjs`（新）|H00–H32全部声明/body；D1选定后只装配应用职责，接口不猜；整文件imports/注释/顺序由其owning模板输出|
|`generators/scala-cqrs-composition-invocation-host/templates/child-plan.mjs`（新）|C00–C05；fixture限定明确，不给业务stage假实现|
|`generators/scala-cqrs-composition-invocation-host/templates/recovery-spec.mjs`（新）|S00–S10+R成员，fixture seeds/expected events单独数据，oracle不得复用被测算法|
|`generators/scala-cqrs-composition-invocation-host/templates/deployment-spec.mjs`（新）|D全部构造；避免substring拼resource事实所有权不清；两spec共享事实模型而非重复实现业务断言|
|`generators/scala-cqrs-composition-invocation-host/render.mjs`、`generate.mjs`、`generator.json`（新）|唯一四逻辑输出组装，最终格式后形成entries/footprint/deps/source。新增producer注册之前不能用这路径运行CLI|
|`generators/saga-dsl/emit-invocation-host.mjs`、`emit-invocation-plan.mjs`、`emit-invocation-spec.mjs`（集成者）|批准legacy兼容策略后adapt/delegate上述MBT，不能悄悄更换0.2.1/pins/PID；旧resource文件只有引用迁移、完整bytes基准签收后才可退役|
|`generators/run-all.mjs`（集成者）|替换L2318–2367 inline model/entry汇合，保留guard、skip/error、pipeline双锚及终端apply；不为本项重写整个run-all或恢复被阻generic strict-scala|
|`generators/scala-cqrs-application/render-invocation-host.mjs`、`render-pipeline-invocation.mjs`、`render-host-io.mjs`（集成者）|F/P是相邻B功能，不整段删成P15；若共享names/import/model抽取由一个owner先做输出不变分离。pipeline/direct/occurrence/admission/authority/delivery分别转结构槽，不能漏wire产生的代码|
|`lib/products/generate-cli.mjs`、调用profile manifest/registry（集成者）|D7裁定后登记真实入口；库族`lib/scala-target/naming.mjs`的resolveName/resolveNameSet/resolveArtifactPath复用，公共types/layout/writer归集成者，不在本组各复制safeName|

共享依赖：`shared-layout-types`、`shared-naming`、`shared-writer-anchors`、`strict-saga-module`、`strict-fixture-host`、`application-protocol`、`command-helper`、`aggregate-behavior`、nominal/codec/serialization供给与相邻execution/child-host组。`resolveName`对重复技术后缀会报TARGET_REDUNDANT_AFFIX并要求显式binding（[L63–73](../baseline/js/lib/scala-target/naming.mjs#L63)），不是自动删Host词；实施必须明确给`BankPaymentHost`的完整binding。`resolveArtifactPath`取profile module.sourceRoot；single-project目标必须先有明确profile，不能把多模块root偷换成app。

旧输出的退休义务：

- 首先为每个逻辑构造建立 `old path + symbol + identity + source key → new path + symbol` 表，附非同输入对照限制。A相邻输出的Host/Definition/TechnicalPorts/HostIO/Execution/serializer/caller引用是一组，不能只重命名Host。
- 将T的runtime/bootstrap/Mongo观察片段分配至D1选定owner；import、初始化、resource close、private-tail可见性、test hooks归属不能遗失；所有owned输出由唯一render文件集合与writer最终写入。
- writer在最终格式后算fingerprint/manifest/ledger/anchors；不预留旧offset，不新增作者@knowledge。BC parent/child双pipeline锚语义迁入JSentry来源；test path台账疑点D8单独修约。
- 未授权不修改银行现有输出、原catalog/.truthsrc/ledger/anchor；旧文件删除只通过批准owned输出退休计划，手写文件/原journal禁止自动清理。

## 9. fixture、完整文件对账与精确CLI形状（均未运行）

### 9.1 有限fixture矩阵

拟测试资产根：`docs/codegen-parity/fixtures/composition-invocation-host/`，**仅命名规格，本次不创建**。每套输入须有一个语义事实集，分别明确映射至BC canonical/systemBindings/admitted-v3/executionBinding与JS产品/选型；不吞类型、顺序、seed、result code或identity。

|fixture|所需证据|
|---|---|
|Fab-like bounded3|两admitted Saga、同一trigger、from/to/wafers/manifest、三stage receive/process/finalize、子state wafers/processedCount；双端四完整文件及依赖闭包，非银行演算；raw test oracle只适用这组|
|renamed-face|module/entry/command/reply改变，List与Vector payload对照；无Lot/Fab硬编码泄漏；D3多reply/query和D1布局必须事先裁定|
|invalid-admission|缺saga/version/entry mismatch/有序args mismatch/非法checkpoint/非command trigger/无carried Map/非法seed参数/multi-project/错runtime pin；明确拒绝，不写半成品|
|stage-boundaries|1、2、4个stage触发BC/legacy差异；先D5裁定是缩窄准入还是扩展spec，不制造与实际不同的expect|
|recovery-and-conflict|intent-before-send、IdentityObserved后Attach、intent无identity同key Start、child journal终态、非权威mirror、timeout unknown、duplicate/mismatch Begin、终态异args占用；R E0–E6及D两个mode只是候选用例源码，未执行|
|bank-regression-neighbor|使用已经选定的formal银行profile小依赖闭包保留A完整字段/identity帧/validStatus/authority/delivery/admission，不把整个银行workshop重跑，也不将其作为P15等价输入|

验收分别记账：完整文件集合及顺序/每construct与RHS/运行ABI和行为/命名三层import/复杂度/稳定再生成和回锚。可忽略项仅双方明确的generated版本来源头及确定的换行规则，须记录具体行；不能压平所有空白或删包名比较。无同输入实际输出时记`not-executed`而不是equal。

### 9.2 当前可定位的公开命令形状

只给未来授权时的命令，不执行。下例 `/absolute/owned/...` 表示将来由集成者选择的**绝对独占路径参数**，不是本次已存在的fixture事实，也不是新CLI flag。

**BC实际P15入口**（在BC仓作为工作目录；不传默认system，更不传semanticProductsFile）：

```bash
sbt \
  -Dcodegen.systemFile=/absolute/owned/composition-fixture/canonical.json \
  -Dcodegen.systemBindings=/absolute/owned/composition-fixture/system-bindings.json \
  -Dcodegen.sagaExecutionV3=/absolute/owned/composition-fixture/admitted-v3.json \
  -Dcodegen.executionBinding=/absolute/owned/composition-fixture/execution-binding.json \
  -Dcodegen.targetDir=/absolute/owned/composition-bc-raw \
  -Dcodegen.multiProject=false \
  -Dcodegen.ledger=/absolute/owned/composition-bc-raw/generation-ledger.json \
  "runMain net.imadz.codegen.CodegenMain"
```

该命令会启动sbt/JVM，可能解析/下载依赖及写sbt/Ivy/Coursier缓存、BC target；CodegenMain会mkdir、复制整个scaffold、生成基础系统与strict/fixture闭包、写app/protobuf/test/conf/build、可选ledger、knowledge-release与formal-semantics/anchor索引。它**不是只写四个文件**的CLI；本项作用域由最小输入闭包限制，无已核实`--artifact composition-invocation-host`开关。必须先授权这些副作用并固定离线供给，不能因为target新就判安全。candidate JAR的供给核验/消费构建另行决策，禁止本阶段publishLocal或自动补runtime。

**JS现有formal相邻链路**（[generate-cli L66–88](../baseline/js/lib/products/generate-cli.mjs#L66) 确认四个必填flag）：

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /absolute/owned/composition-fixture/formal-request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-application \
  --out /absolute/owned/composition-js-formal \
  --options-json /absolute/owned/composition-fixture/formal-options.json \
  --plan
```

`--plan`捕获JSON、编译产品/渲染plan、读取generator manifest与固定本地runtime JAR校验SHA，入口返回applied:false；不是runtime测试。去掉`--plan`进入[applyEntries L246–268](../baseline/js/src/core/generate.mjs#L246)，写计划文件、`truthsrc.ledger.json`、`anchors.json`，可能MANUAL合并，freshness检查不等锁/回滚；不执行生成的Scala测试、不自动服务启动。此命令当前只能验证F/P相邻合同，**不会自动获得T四文件**。

D7若选择新producer，则仍用相同公开命令flag，但`--generator`改为**尚未存在且尚未注册**的绝对 `generators/scala-cqrs-composition-invocation-host`。在注册/产品输入shape裁定前该命令会被registeredProductProducer拒绝，不能当成可运行验收步骤。

family的公开形状是：

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-project \
  --project /absolute/owned/family-fixture/truthsrc.project.json \
  --out /absolute/owned/family-candidate \
  --plan
```

此处仅说明family所需入口，非本artifact执行方案：会捕获项目作者/绑定/外置实现供给、计划产品；具体project层附带写面须由集成者复核其选定配置后批准，本文不声称“plan一定全局零写”。不允许用family的生成结果证明P15 parity。

legacy `generators/run-all.mjs <tree-dir> <out-dir> ...`是整工程编排而非本artifact scoped CLI；还可复制monarch JAR至out/lib，且L2403才统一apply strict entries；本项不安排其执行以规避副作用边界。不能捏造给它加`--plan`或`--artifact`。

### 9.3 后续必要行为与停止点

在选定完整离线classpath、独占Mongo DB/端口/进程、D1–D7裁定后，复用**确实由T产生**的suite名字 `FixtureCompositionSpec` / `FixtureCompositionDeploymentSpec`，单项目候选内命令形状为 `sbt "testOnly <resolvedHostPkg>.FixtureCompositionSpec"`，以及fork已配好时 `sbt "testOnly <resolvedHostPkg>.FixtureCompositionDeploymentSpec"`。resolvedHostPkg必须由批准target模型提供，不猜成fixture.composition。Play-service的现有testOnly被显式重定义为报错（generate.mjs L44），不能照抄给银行候选。

- 第一suite会启动ActorSystem/cluster、连接Mongo、创建p16专属DB，并在停止写者后修改其journal；cancel不可计成功，DB不自动drop。
- deployment会fork两个JVM、开loopback端口、写target/composition-deployment日志/证据、创建p17 DB、向**自己持有的owner进程**发SIGTERM并等待回收；forced cleanup必须失败。这里只读这些测试源码，未读实际进程参数/环境/日志。
- 改动依赖闭包一次集中编译；同输入生成/完整内容比对初始预算5分钟，编译/必要行为初始预算15分钟；只是调度预算，超过先停并回报已有证据，不扩大到全银行验收。
- 两次相同输入完整产物稳定，再变一个字段/映射核局部diff和作者→最终字节锚；内容与行为分别验收，不能以数量、编译绿或spec存在代替质量。

## 10. 未决项（具体阻断，不互相吞并）

|ID|需要裁定的内容/API|阻断范围与不允许的捷径|
|---|---|---|
|D1|raw独立composition package如何绑定三层；Mongo child journal观察的端口（终态、cursor、取消/重连）、bootstrap factory及private-tail TestHooks分界|决定最终完整物理文件集、imports和接口；本文列了候选路径但未假设已批准。不能整个mixed class挪包即签收|
|D2|BC准入Monarch0.2.1/strict snapshot、scaffold默认0.2、formal0.3.0、family R2究竟选哪个消费ABI；StartRun/RunCompleted/Rejected与typed Run桥是否版本化适配|JAR/API未实证即阻断实施/行为验收；不能发布新runtime、复制私有运行库或放宽pin|
|D3|reply应按triggerCmd.replyToType还是首reply？source ctor是否总有最后replyTo？query是否只一个replyTo且回复有state？seed是否error字段以及部署硬编码GetLotState/ReserveAddWafer/CommitAddWafer可泛化？|这些输入/接口必须由strict-fixture/aggregate合同给出；不能给domain payload加ActorRef，不能假造named参数或通用Reply|
|D4|异args同txid且既有终态**成功**时，raw Start回复被ignore、随后只GetStatus且无args核对是否可接受？E5只覆盖occupier拒绝，formal validStatus更严格|需要明确reject-different-args合同与真实runtime证据；不把E5 Rejected注释等同全冲突保护，也不能删formal防线|
|D5|准入1..8 stages与R/D固定3stage oracle如何统一？JP只第二stage处理，BC所有中间stage处理；五种child result code为何只保留success而其他hardcode/省略？|决定有限支持范围、oracle和模型字段；不把4stage变成3stage“通过”，不把unknown/recovery-required伪装失败终态|
|D6|恢复契约是否允许只保留OperationStarted而无split intent？raw会重新Begin但H15因started而拒绝；旧初始persist是原子批次，R又支持截断跨批至任意keep，现测试从keep2起|需要明确合法prefix集合或批准修复；源码可定位缺口不等实测故障。child watcher完成携带原wafers而非snapshot只适合不改集合fixture；真实child转换须另定输出来源|
|D7|public产品合同如何表达这一有界composition并接入新MBT：新registered producer还是existing producer的显式可区分variant；不能与已有single-invocation/family typed-run混签|决定generator.json/registry/输入fixture/CLI路径；新producer路径是proposed，formal精确对应当前为missing-counterpart，不让它默默降级legacy|
|D8|BC FixtureFileModel空deps、test writer ledgerPath的app前缀疑点、两lane双pipeline keys与最终文件split后锚如何对齐|唯一writer/assembly owner裁定；不能复制错误test路径、回填旧offset或手改catalog/ledger/anchors证明完成|

这些决策不阻止保存本内容规格；它们阻止把文档当成已实施/已验证或全族一致的结论。

## 11. 额外当前来源记录

只读、未复制/修改；下列原仓路径没有对应本次所读BC快照条目（guidance也保守登记）。资源R/D相同字节可由§1固定链接取回；adapter仅当前源码加SHA，不用HEAD冒充冻结字节。

|绝对路径|SHA-256|
|---|---|
|`/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen/src/main/scala/net/imadz/meta/execution/CompositionBindingAdapter.scala`|`03d27339a2bed4433ce4d3b289133d3c07cb149d37834ad5ca0f32ca6ab643ef`|
|`/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen/src/main/resources/codegen/templates/composition-recovery.scala.tpl`|`1f2663f4fd1a60fda6419c6d87ee71025f78b7018d2abf561688da38034d29b9`|
|`/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen/src/main/resources/codegen/templates/composition-deployment.scala.tpl`|`06f8a44e3b1213f6963894e47f1b1c5d3b15959d15313e0234ad52903a67e445`|
|`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/AGENTS.md`|`8bfd761390a6fc90b09663157f9d35b23c0c58b20c9f6a41dd5698450015d601`|
|`/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen/AGENTS.md`|`660668bdf6ccb02cf8d27ebdf2a977ce8d1e595b0d8fafc1f6aab2fa35350ff8`|
|`/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen/CLAUDE.md`|`5d1cb1236a225899eb9790c882c5d27bb850842a6cf57f9cef19b74c4a3a26f1`|
|`/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen/MAINLINE.md`|`c95fe1468a6f1657d8c7a0629f4dfe1cd9cbfa100a5f2194f4747cbde55de0a4`|

[mb]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/transactor/CompositionHostBuilder.scala#L1
[b-rules]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/transactor/CompositionHostBuilder.scala#L38
[t]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/InvocationHostTemplate.scala#L1
[t-files]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/InvocationHostTemplate.scala#L14
[t-host]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/InvocationHostTemplate.scala#L48
[t-commands]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/InvocationHostTemplate.scala#L244
[t-effects]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/InvocationHostTemplate.scala#L381
[t-child]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/InvocationHostTemplate.scala#L518
[t-spec]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/InvocationHostTemplate.scala#L628
[t-deployment]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/InvocationHostTemplate.scala#L604
[r]: ../baseline/js/generators/saga-dsl/templates/composition-recovery.scala.tpl#L1
[d]: ../baseline/js/generators/saga-dsl/templates/composition-deployment.scala.tpl#L1
[j]: ../baseline/js/generators/saga-dsl/emit-invocation-host.mjs#L1
[j-start]: ../baseline/js/generators/saga-dsl/emit-invocation-host.mjs#L365
[jp]: ../baseline/js/generators/saga-dsl/emit-invocation-plan.mjs#L1
[js]: ../baseline/js/generators/saga-dsl/emit-invocation-spec.mjs#L1
[f]: ../baseline/js/generators/scala-cqrs-application/render-invocation-host.mjs#L1
[p]: ../baseline/js/generators/scala-cqrs-application/render-pipeline-invocation.mjs#L1
[a]: ../baseline/actual-js/app/example/bankwealth/application/bank_payment_hostHost.scala#L1
[dispatch]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L252
[writer]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L353
[legacy-dispatch]: ../baseline/js/generators/run-all.mjs#L2298
