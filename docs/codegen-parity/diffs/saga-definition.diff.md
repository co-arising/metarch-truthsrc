# saga-definition（17）

## 范围与判定

**状态：missing-counterpart。** 传统 `runCommon` 的 `app.sagas.foreach` 每 SagaTransactor 一文件：`app/$base/application/services/transactor/<Base>SagaDefinition.scala`。`Base = meta.name.replace("SagaTransactor", "")`（raw 是全串 replace，不是仅 suffix）。[调度 L749](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L749)。raw 注释的 saga_v3 是 `net.imadz.infra.saga.dsl`；admitted strict-v3 是另一个 `net.imadz.infra.saga.strict` API，0.3 bridge 亦不能当同文件字节 counterpart。

## Scala Model / Builder

固定全文：[Model](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/transactor/SagaDefinitionModel.scala)、[Builder](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/transactor/SagaDefinitionBuilder.scala)、[Template](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/SagaDefinitionTemplate.scala)。

Model 顺序/类型，无默认：`selfType: TypeRef, sagaName: String, version: Int, argsType: TypeRef, argsFields: Seq[FieldDef], contextType: TypeRef, steps: Seq[DefinitionStepModel], needsMoneyHelper: Boolean, dependencies: Set[TypeRef]`。子型 `DefinitionStepModel(stepId: String, participantType: TypeRef, participantArgs: Seq[String], resilienceCode: String, stepGroup: Int)`。**participantArgs、resilienceCode 是 Scala 源码字符串例外**，不是全纯结构；未来模板拆分要将相应值/策略变成数据再渲染，不能把不安全串移个文件即算完成。

Builder 全分支：

- 包为 application.services.transactor.root；显式 context.name 或 meta.name；args 必填否则抛错；args 字段 resolve，保持顺序。
- `needsMoneyHelper` 当任何 participant 字段精确为 `StructRef("Money")` 且 args 有 amount、currency。每 participant 一逻辑 step，使用该 participant 第一 metadata step 的 stepId/resilience/group；没 step 抛错（stepId fallback 名并不能救此错）。原始 phase steps 由 participant 三 binding 承接，不是每 phase 一个 SagaStep。
- participant 字段全量映射（注意这里不像 ParticipantBuilder 过滤 Repository）：Money→`money`；CustomType Id 且来源 args 为 String→`Id.of(args.<mapped>)`；其他→`args.<mapped>`。argMappings 默认同名。
- resilience：ExponentialBackoff 仅取 maxRetries，其余 retry strategy 默认 3；timeout 两词转 duration；recovery 为 RetryIfOngoing/FailIfOngoing；circuitBreaker Some(maxFailures,callTimeout,resetTimeout) 或 None。并未编码指数 backoff 的全部字段。
- sagaName=baseName camel→kebab lowercase；version=meta.version。dependencies 是 participant 类型、context、participant 字段值类型，shouldImport；不是显式收集所有 args 字段类型。任意新 args 类型导入因此必须核查。

## 输出 construct / RHS 全账

| 顺序 | 产物内容 |
|---|---|
| 1 package/import | selfType.packageName。dependencies→package.name，合并固定项后 distinct.sorted。固定 `akka.actor.typed.ActorSystem`、`akka.actor.typed.Scheduler`、`akka.cluster.sharding.typed.scaladsl.EntityRef`、`net.imadz.common.CommonTypes.iMadzError`、`net.imadz.infra.saga.SagaTransactionCoordinator`、`net.imadz.infra.saga.StepExecutor.CircuitBreakerSettings`、`net.imadz.infra.saga.dsl.{ArgsCodec, RecoveryBehavior, ResiliencePolicy, SagaDefinition, SagaRegistry, SagaRunner, SagaStep}`、`net.imadz.common.Id`、`scala.concurrent.duration._`、`scala.concurrent.ExecutionContext`。 |
| 2 object/constants | declarative/pure participant 注释；object selfType.name；val Name=sagaName 字符串，val Version=Int。 |
| 3 args | nested `final case class Args(<ordered name: typeRef.name>)`；nested companion 的 `implicit val format: play.api.libs.json.Format[Args] = play.api.libs.json.Json.format[Args]`。FQN 是 raw 例外；没有 Args.of/toMoney helper。 |
| 4 definition | `def definition(implicit ec: ExecutionContext,scheduler: Scheduler): SagaDefinition[iMadzError,Context,Args]`；构造 named args 顺序 name,version,argsCodec,steps,preCheck,errorText,onResult,defaultResilience。codec=`ArgsCodec.playJson[Args]`。 |
| 5 steps lambda | 可选 `val money=Money(args.amount,java.util.Currency.getInstance(args.currency))`；Seq 按 participant 顺序，每个 `SagaStep("stepId", Participant(<args>), <full emitted resilience>, stepGroup=<group>)`。无持久 participant。 |
| 6 defaults | `preCheck=args=>Right(args)`；`errorText=e=>(e.code,e.message)`；`onResult=(args,result)=>Nil`；`defaultResilience=ResiliencePolicy.defaults`。raw 通过检查不等于已实现业务不变量/结果发布。 |
| 7 register | implicit 参数同 definition，返回同 SagaDefinition；顺序 `val defn=definition; SagaRegistry.register(defn); defn`，要求早于 sharding recovery。 |
| 8 runner | `def runner(system: ActorSystem[_], coordinatorRef: String=>EntityRef[SagaTransactionCoordinator.Command])(implicit ec:ExecutionContext,scheduler:Scheduler): SagaRunner[iMadzError,Args] = new SagaRunner(definition,coordinatorRef,system)`。不注册、不替用户启动 coordinator。 |

无 annotation/self-type/继承/辅助 ctor/MANUAL/???；空业务检查和 onResult=Nil 必须标明默认槽，不得写成 business-PASS。[人工 MoneyTransferSagaDefinition](../baseline/curated-scala/net/imadz/application/services/transactor/MoneyTransferSagaDefinition.scala) 额外有 Args.of/toMoney、金额大于零和不同账户校验、简化 resilience；不能默默用人工业务体替换 raw 基准。

## JS 四层、diff 与明确决定

legacy [emitLegacySagaSpec L158–225](../baseline/js/generators/saga-dsl/emit.mjs#L158) 已有 SagaDefinition/ArgsCodec/SagaRegistry，但 Args/context 顶层、steps inline builder、只有 maxRetries、显式 trusted-source preCheck/helpers、register 返回 Unit 且无 runner；不缺所有能力，而是 MBT/文件归属/完整字段错配。formal [renderDefinitions](../baseline/js/generators/scala-cqrs-application/render-host.mjs) 的 `kind: saga-definition` 实为 strict runtime，含 Ports、typed command映射、receipt codec、identity 检查、coordinator；新 [sagaTemplate](../baseline/js/generators/scala-cqrs-saga-monarch-v1/templates/saga.mjs) 是 StrictSagaCoordinator facade。[emit-strict](../baseline/js/generators/saga-dsl/emit-strict.mjs) 的 definition(host) 亦不是 classic。标签同名不构成 API 对等。

结构性对照（非同输入字节比较），minus 为 legacy 真模板，plus 为传统目标；不向银行植入凭空的 MoneyTransfer：

```diff
 object ${spec.objectName} {
-  def register()(implicit ec: ExecutionContext, scheduler: Scheduler): Unit =
-    SagaRegistry.register(definition)
+  def register(implicit ec: ExecutionContext, scheduler: Scheduler): SagaDefinition[iMadzError, Context, Args] = {
+    val defn = definition
+    SagaRegistry.register(defn)
+    defn
+  }
+  def runner(system: ActorSystem[_], coordinatorRef: String => EntityRef[SagaTransactionCoordinator.Command])(
+      implicit ec: ExecutionContext, scheduler: Scheduler): SagaRunner[iMadzError, Args] =
+    new SagaRunner(definition, coordinatorRef, system)
 }
```

决定：classic 显式新 target 才拆分 definition/participant/context，不将 formal strict Ports 改成 classic context；scope 只支持 strict 时继续 missing-counterpart。代码 PascalCase 与 lowerCamelCase 可改，但 **Name、Version、stepId、transactionId、DefinitionDigest/codec pin/PID 均不做名字美化迁移**。raw kebab(meta.name) 的危险需新模型把 stable name 与 code symbol 分开承载，兼容读旧值；不能随类改名重算既有身份。

## Glue 与实施槽

saga-core 的 `SagaDefinition[E,C,A]`、`SagaRegistry.register`、`ArgsCodec.playJson`、`SagaRunner`、`SagaStep`、ResiliencePolicy/RecoveryBehavior/CircuitBreakerSettings；common-core 的 iMadzError/Id；Play JSON Format/Json；Akka ActorSystem/Scheduler/EntityRef。查看 [curated DSL](../baseline/curated-scala/net/imadz/infra/saga/dsl/SagaDefinition.scala) 只证明固定源码接口，不证明当前消费 artifact；冻结版本/ABI 必须单独核，禁止 publishLocal/rebuild。context/repository/participants 归应用；真实错误、preCheck 与结果发布需要业务真源，不用 fake success。不以 `onResult=Nil` 推断结果已发布。

写集合 proposed：`generators/scala-cqrs-application/models/saga-definition.mjs`、`builders/saga-definition.mjs`、`templates/saga-definition.mjs`；adapt `generators/saga-dsl/emit.mjs` 的显式 classic 路由。definition family 独占该文件及 nested Args；participant/context 各自 owner。共享 types/names/layout、registry、produce 调度、manifest 与回锚由集成者迁移；legacy 原路径只在 manifest 确认覆盖且锚迁移后退役，strict `render-host.mjs` 留 strict 族，不双写同一路径。

## 验收与未决（未运行）

未来批准后，对同 metadata 全文件 `diff -u <bc> <js>`，覆盖全部 imports/ordered Args/steps/defaults/register/runner；与人工 preCheck 独立做业务验收。需决定 args 导入缺口、repository 字段过滤一致性、Money 特判适用范围、error/result 业务槽与 step 首条一致性门。验证真实消费 ABI、注册早于 recovery、args codec roundtrip、同 transaction 的行为，不能只看生成文本。普通方法 CC≤5，>10 拆分或逐方法例外；禁止 String/Any dispatcher。稳定字节与 anchors 同时验收。所有生成/构建/测试/服务/Git 均未执行；额外未入基线源码：无。
