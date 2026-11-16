# saga-participant（16）

## 1. 范围、状态、路径

**状态：missing-counterpart。** 指传统 `runCommon → generateApplicationLayer → app.sagas × participants` 的 AskParticipant 文件，不是 strict 的 PhasePort。每 participant 一文件；`app/$base/application/services/transactor/<Participant>.scala`（`$base` 转目录）。重复 participant 名跨 saga 的输出碰撞须在规划期拒绝。调度见 [CQRSApplicationGenerator L735–770](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L735)。名称保留 participant 类型语义，目标 PascalCase；不改变 transaction/step/participant 持久身份。

本文中的“classic”是清单分类；固定源码注释虽称 `saga_v3`，实际 API 是 `net.imadz.infra.saga.dsl.AskParticipant`，**不是** `net.imadz.infra.saga.strict.StrictSagaDefinition`、admitted strict-v3 合同或 0.3 bridge。不能以 strict 已有同类职责宣布此族实现。

## 2. Scala MBT 全账

固定来源：[Model](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/transactor/SagaParticipantModel.scala)、[Builder](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/transactor/SagaParticipantBuilder.scala)、[Template](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/SagaParticipantTemplate.scala)。共享解析：[TypeResolver](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala)、[TypeResolverDSL](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala)。后者 `sagaParticipant` 使用 transactor root，不随意另建 `$base.saga`。

Model 字段按构造顺序，无默认值：`selfType: TypeRef, constructorParams: Seq[FieldDef], contextType: TypeRef, rules: ParticipantErrorRulesModel, askTimeout: String, prepareBinding/commitBinding/compensateBinding: Option[ParticipantPhaseAskModel], dependencies: Set[TypeRef]`。子型 `ParticipantErrorRulesModel(errorType: String,codes: Seq[String],retryable: Boolean)`；`ParticipantPhaseAskModel(commandType: TypeRef,replyType: TypeRef,commandArgs: Seq[String],repositoryFieldName: String,resultField: String,resultFieldIsString: Boolean)`。`FieldDef` 的顺序即用户字段顺序。

Builder 的完整决策：

1. 包来自 `layout.application.services.transactor.root`；context 优先显式 context.name，否则 transactor.name，由 resolver 求名。
2. 由 `interactsWith` 聚合解析 repository 类型并首字母小写得到字段名。constructor 过滤 MetaRef/DataType 名以 Repository 结尾的字段；其余保留声明顺序并 resolve。
3. 对 participantName 精确过滤 steps；每相位取首个已声明 command binding。取第一步 timeout，缺省 `5.seconds`；两词 duration 归一 millis/seconds/minutes/hours，其他原样。不能把这种字符串槽说成纯类型 AST。
4. 汇集这些 steps 的 errorRules；errorType 取首条或 `iMadzError`，codes 去重，retryable 只看首条 `MarkAsRetryable`。不一致依靠 H001，不能在迁移中悄悄应用首条吞掉冲突。
5. command metadata 必须存在、有 replyToType，reply metadata 必须有首个非 error result 字段，否则抛错。command 参数按声明顺序过滤大小写无关 replyto，映射默认同名；transactionId 对 Id 产生 `Id.of(txId)`，其他产生 `txId`，participant 字段保留名字，其他映射原样代码字符串。replyTo 由模板最后追加。
6. dependencies = ExecutionContext、typed Scheduler、iMadzError、context、所有相位 command/reply、constructor 字段递归依赖，最后 shouldImport(pkg)。仓库通过 context 访问，不作为 participant ctor 依赖注入。

## 3. 输出 construct / RHS（顺序即模板顺序）

| Construct | 完整生成规则/RHS |
|---|---|
| package/import | package=selfType.packageName。依赖转 `package.name` 排序去重；删去 brace import 已覆盖的 CommonTypes.Id、CommonTypes.iMadzError、ExecutionContext，再追加 `net.imadz.common.CommonTypes.{Id, iMadzError}`、`net.imadz.common.Id`、`net.imadz.infra.saga.SagaParticipant.SagaResult`、`net.imadz.infra.saga.dsl.{AskParticipant, ErrorAction, ErrorRules, PhaseAsk}`、`scala.concurrent.ExecutionContext`、`scala.concurrent.duration._`，distinct 后交 DSL。Scheduler 依赖导入仍可能与主构造 FQN 并存。 |
| 注释/object | pure-data never-journaled 注释；`object <Participant>`，先放 private val Rules，规避 Scala 2.13 super 构造 premature access。 |
| Rules | 无 codes：`ErrorRules.none[iMadzError]`；否则 `ErrorRules(business = { case <errorType>("code1" | "code2", _) => ErrorAction.Retryable/NonRetryable }, describe = e => s"${e.code}: ${e.message}")`。不是异常统统成功。 |
| case class/父类 | `case class P(<constructorParams>)(implicit ec: ExecutionContext, scheduler: akka.actor.typed.Scheduler) extends AskParticipant[iMadzError,String,Context](rules=P.Rules,askTimeout=<duration>)`。无 annotation/self-type/type alias/辅助构造器。 |
| 三个 override protected val | 按 prepare、commit、compensate；均 `Option[PhaseAsk[iMadzError,String,Context]]`，缺绑定为 None。 |
| Some binding | `PhaseAsk.ask[Cmd,Reply,iMadzError,String,Context](ref=ctx => ctx.repo.find<Base>ByUserId(<first ctor field or userId>), command=(txId,replyTo)=>Cmd(<mapped args>,replyTo), mapReply=r=>r.error.map(Left(_)).getOrElse(Right(SagaResult(<result>))))`。result 是 String 直接取，其他 `.toString`；find 名由 repositoryFieldName 去 Repository 再 capitalize 推导。 |

没有 MANUAL/???；**这不证明任意 metadata 正确**。第一个 ctor 字段被当作账户地址、repository 方法固定 ByUserId、首个 result 字段强转字符串、字符串映射和多 rule 首条策略均是实际限制。TypeResolver 的 MetaRef fallback 仍有 `???`，不得宣布整个解析器纯净。

人工例 [FromAccountParticipant](../baseline/curated-scala/net/imadz/application/services/transactor/FromAccountParticipant.scala) 的三个 PhaseAsk 是已完成业务绑定（ReserveFunds/DeductFunds/ReleaseReservedFunds），其 wildcard Protocol import、Scheduler 短名、两条完整 iMadzError 模式与 raw 拼法不同；不是 raw 字节金样。银行实际例没有同输入 AskParticipant，不能编造一个“已生成银行 participant”。

## 4. JS 四层差距和结构 diff

- legacy [emit.mjs L158–224](../baseline/js/generators/saga-dsl/emit.mjs#L158)：完整 spec 验证后在一个文件 inline `SagaStep.builder` 三相位，context 是 RecipientRef trait；无独立 Participant Model/Builder/Template/文件。
- formal [produce.mjs L29](../baseline/js/generators/scala-cqrs-application/produce.mjs#L29) 调 [renderDefinitions L12–58](../baseline/js/generators/scala-cqrs-application/render-host.mjs#L12)：输入 host/runtime products，匿名 PhasePort + typed technical ports + codecs；不是传统 participant 类。
- [emitStrictFiles](../baseline/js/generators/saga-dsl/emit-strict.mjs#L80) 内 model、renderFiles 混在单文件，host-binding traits/PhasePort 对应 strict 技术面；新 [saga-monarch sagaTemplate](../baseline/js/generators/scala-cqrs-saga-monarch-v1/templates/saga.mjs) 是 facade/strict coordinator，亦不可冒充 counterpart。

结构性对照，非同输入字节比较；minus 为 legacy 真模板，plus 为 raw Scala 目标形状，不更换运行时完成“兼容”。

```diff
 object ${spec.objectName} {
-          SagaStep
-            .builder[${spec.errorType}, ${spec.contextType}](${JSON.stringify(step.id)})
-            .inGroup(${step.group})
-            .withResilience(ResiliencePolicy(maxRetries = ${step.maxRetries}))
+          SagaStep("transfer-out", FromAccountParticipant(Id.of(args.fromUserId), money),
+            ResiliencePolicy(maxRetries = 5, timeoutPerAttempt = 5.seconds,
+              recovery = RecoveryBehavior.RetryIfOngoing, circuitBreaker = None), stepGroup = 1)
 }
+// 独立文件；bind 的命令/返回值来自已核 metadata，不是新增银行业务。
+case class FromAccountParticipant(userId: Id, amount: Money)(implicit ec: ExecutionContext, scheduler: Scheduler)
+    extends AskParticipant[iMadzError, String, MoneyTransferContext](
+      rules = FromAccountParticipant.Rules, askTimeout = 5.seconds) { /* 三个显式 PhaseAsk val */ }
```

## 5. Glue、决策与 JS 写集合

`akka.actor.typed.Scheduler`、`scala.concurrent.ExecutionContext` 提供 ask 执行；`net.imadz.infra.saga.dsl.AskParticipant/PhaseAsk` 要求上述五型参 ask 和三 optional bindings；`ErrorRules/ErrorAction` 分类业务错误，`SagaParticipant.SagaResult` 包装字符串；`CommonTypes.Id/iMadzError` 与 `net.imadz.common.Id.of` 必须同时解析；应用 repository 必须真实返回可 ask 的 typed ref。库来源分别 Akka、Scala、saga-core、common-core、生成应用。固定 [curated AskParticipant](../baseline/curated-scala/net/imadz/infra/saga/dsl/AskParticipant.scala) 是源码证据，不是已消费 JAR/可发布证明。**不 publishLocal、不 rebuild**。

明确决定：保持 traditional 和 strict 两条显式目标；traditional 要拆出此族，strict 保持 PhasePort。若集成范围只准 strict，此 id 继续 missing-counterpart，不强制替换严格语义。需拍板：以显式 resource accessor/result mapper 取代首字段/ByUserId/first-result 的 metadata 扩展，或限定输入且 fail-closed；不能靠自动猜测跨过。

实施提案（本次不改）：新增 proposed `generators/scala-cqrs-application/models/saga-participant.mjs`、`builders/saga-participant.mjs`、`templates/saga-participant.mjs`；legacy `generators/saga-dsl/emit.mjs` 仅在目标显式切 traditional 时调用新族，保留原 legacy 入口；formal `produce.mjs` 的接线由集成者管理，不把 strict finite-host 默认改成 classic。共享 names/types/layout/writer/registry 归集成者。输出 owner 为 participant family，definition 文件不重复声明 participant；退役旧 inline 面需旧新 manifest/anchors 一起迁移、不可无条件删文件。

## 6. 验收（全部未执行）

未来隔离目录内用等价 metadata 对 raw Scala 与 JS 输出做**完整文件 diff**（`diff -u <bc-file> <js-file>`），逐行核上述 import/ctor/三 PhaseAsk/RHS/None；人工例作为独立业务测试输入，不与 raw 混比。确认消费制品真的有泛型 API，验证 error→Left、result→SagaResult、typed replyTo、timeout/分类、缺 metadata 拒绝；另验重复名/ByUserId 假设。普通方法 CC≤5，>10 重构或逐方法例外；不用 String/Any dispatcher。后续生成必须批准后写独占 target，重跑文件字节/anchor 稳定，保持 txId/stepId 不变。本阶段未运行生成、构建、测试、服务或 Git。额外未入基线源码：无。
