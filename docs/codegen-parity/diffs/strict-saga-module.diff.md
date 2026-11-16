# strict-saga-module：严格 Saga 模块的内容级差异规格

## 1. 身份、范围与证据等级

- artifact / group：`strict-saga-module`，属于 optional strict 扩展，不计入传统 39 个 Template 族，也不是 classic `SagaDefinition`、`SagaParticipant`、fixture-host 或 composition-host。
- 状态：**decision-required**。formal 已有 Strict runtime 定义桥，legacy 有接近本模板的 renderer；不是“JS 完全没有 Saga”。完整 MBT、Host 合同和目标布局尚不能据现有三个入口互相替代。
- 固定 HEAD：BC `cc335eb1e0d0fae17bf092fd61b126040196ea70`；JS `bf104e16ab82ef39d7fa416d0997907d18a815ad`。实际内容以 [baseline/index.json](../baseline/index.json) 的 bytes/SHA 与固定副本为准，不用 HEAD 代替源字节。
- 编制依据：[批准计划](../../../.rounds/prettify-generated-code-resume-20261115-cgr9lzlk/APPROVED-PLAN.md)、[AUTHORING-CONTRACT](../AUTHORING-CONTRACT.md)、[layout-and-style](../layout-and-style.md)。它们是指导，不替代冻结技术源码。
- 本文仅源内容检查。没有执行生成、编译、测试、typecheck、runtime、服务、下载或 Git 写入；没有改变真源、baseline、catalog、ledger、anchor 或已有其他 diff。
- **没有新鲜同输入产物**。下文 raw-scala 是完整原始 MBT 源码及其逐构造展开规则，不冒称已取得一次实际生成的 Scala 文件；approved-target 是批准的质量规则叠加本规格，未取得完整目标字节；actual-js 是已有银行文件的冻结副本。所有跨输入例子均为结构性对照。

### 1.1 固定来源与全文

下列主证据的 bytes / SHA-256 已在本次只读检查中与索引核对。正文附完整 M/B/T 源码；较大的 JS/银行文件通过完整固定副本加构造表呈现，不从名称推测内容。

|角色|固定全文|bytes|SHA-256|
|---|---|---:|---|
|Scala Model|[StrictSagaModuleModel.scala][M]|2236|`c6deab95a8d17f01152e945a956cad793d4dd595041b93a9715d8f5e35beb85e`|
|Scala Builder|[StrictSagaModuleBuilder.scala][B]|3735|`2b447a70f4831c647c2a8c82244321a68b0ce8c26d12c953334ff30df6b9d70f`|
|Scala Template|[StrictSagaModuleTemplate.scala][T]|20540|`a5d7be540f7606bb4a941dc0e7cb0f2e84609b874c5dd85177cbf1d38343d70d`|
|准入/调度|[StrictSagaGenerationPlan.scala][P]|7484|`3f97c916b2ecc633cb81410c8c8c969ca69f396d609049617719e884a7a2c89b`|
|formal renderer|[render-host.mjs][F]|11819|`967603cfd42ded77f05fca391c440059fefac279d01a4cce488baab629631d3a`|
|legacy renderer|[emit-strict.mjs][L]|58063|`1310405535eb10c07330f75d32f101a7e7fbf5186f6d03e8978ccc572f3a5c12`|
|family 模型（本次只查相关段，不宣称审核整个家族）|[build-models.mjs][FM]|40309|`d7a1e9fbe50bdfb8f1fb2f955f7c0144be68eb24a8a94127c54032df031c0bee`|
|family Saga 模板|[templates/saga.mjs][FT]|8293|`69653d2f9a4f7946eb848925f3a4994c8df5bbce3c0c96bd9a8da03b7de34f50`|
|银行 actual-js|[bank_payment_hostDefinition.scala][A]|60585|`d6e52d2c8f31202fc8692ff51da4a52e15dd763b9629de8b0be187d1a8fbc816`|
|银行编排旁证|[bank_cash_payment_v1Execution.scala][AX]|8367|`2e8d40cc640f32e56daae32250ff27a8d630f776d76ac3b8fb57029fe8258c0d`|
|人工参考，非 strict|[MoneyTransferSagaDefinition.scala][C]|3221|`4b5bb1370d0fcb90a6a4eb2392fce7062b4aa70df77b52082bcc2042b7da626c`|

### 1.2 四类资料不混签

|面|实际内容|本文用途 / 限制|
|---|---|---|
|raw-scala|下文完整 M/B/T，模块是一个 `object`，含 Args、所有合同、Host 抽象方法、phase/trigger/completion 桥、definition/behavior|是逐构造主基准；自身使用 FQN、长行、模板源码字符串，不能称完全无技术债|
|approved-target|仅三业务层；类型 PascalCase、成员 lowerCamelCase；结构化 types/imports；Host 义务与原有失败顺序保真|允许明确的布局/命名/排版偏差；namespace 与显式 binding.module 冲突见 D1，不能偷偷改写 pin/digest|
|actual-js|银行 `bank_payment_hostDefinition` + 关联 TechnicalPorts；编排另在 `bank_cash_payment_v1Execution`|确有 `StrictSagaDefinition/PhasePort`，但并非 raw 的完整 Host 模块；不能将 Monarch 编排 object 当 strict module|
|curated reference|`MoneyTransferSagaDefinition`：TransferArgs + Play JSON、两个并行组 step、金额/同账户 preCheck、register、runner|classic DSL，仅可参考命名/分组；不是 strict金样，无 strict 的 codec pin、durable receipt input、HostRequirements、ReconcileAuthorizer 合同|

人工参考 [C:L18–70][C] 的关键 RHS 为 `Name = "money-transfer"`、`Version = 1`、`ArgsCodec.playJson[TransferArgs]`、`ResiliencePolicy(maxRetries = 5)`、`preCheck` 正金额且不同账户才 `Right(args)`，否则两个不同 iMadzError；`onResult = (args, result) => Nil`，`register` 先求 definition 再 `SagaRegistry.register(defn)`，runner 用 `new SagaRunner(definition, coordinatorRef, system)`。这些算法不移植成 strict 默认行为，也不以人工体覆盖 raw。

## 2. Scala 调度、基数、路径与真实写边界

1. [CodegenMain:L117–130](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L117-L130) 仅在显式 `codegen.sagaExecutionV3` 时，读取绝对、可读、regular file，前后限制 8 MiB；`AdmittedSagaInputV3.fromBytes(bytes, system)` 必须成功，实际 base 校验且 sagas 非空。
2. [CodegenMain:L183–197](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L183-L197) 的 semantic-products 是另一分支；strict 使用 `StrictSagaGenerationPlan.prepare`，要求显式实际 `codegen.targetDir`，拒绝 `codegen.direct=true`。
3. [Plan:L44–99][P44] 构造每 saga 一个 Model，验证 FQN 不改写、独立 namespace、base 输出/嵌套名/成员/字段碰撞、允许的 input source；随后生成完整 source。安全路径拒绝 target 根目录、保护仓库、符号链接、硬链接输出、非目录祖先。
4. [CQRS:L150–168](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L150-L168) 再校验 plan 对实际 base/target/multi；[L203–250](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L203-L250) 先走普通各层/bootstraps，再 `plan.models.zip(plan.sources)`，`writeArtifact(... kind="strict-saga-module", schemaNode=sagaId, schemaCategory="saga", families=participants.aggregate.targetName.distinct)`。
5. 同一循环随后另调用 FixtureHostBuilder/Template；single 模式另出其 test。**本族一个模块不等于整条 CLI 只写一个文件**，fixture-host、bootstrap 与其他层另有 owner；本文不代写其规格。
6. [writer:L359–424](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L359-L424) 收 Model.dependencies，按 symbol table 解析 ledger deps，记 morphisms/noteIds 后 scope 可跳过；真正写入前加 fingerprintHeader、检查 territory；只对成功写入的 strict 文件读取最终字节 fingerprint、收集 `saga:<id>` 回锚。

|变体|条件|本族预计文件数|raw 输出路径|本次 exercise|
|---|---|---:|---|---|
|single|admitted v3 非空，multi=false，scope 接受该 attribution|每 admitted saga 1|`<target>/app/<binding.module.package path>/<binding.module object>.scala`|not-run|
|multi|同上，multi=true|每 admitted saga 1|`<target>/modules/glue/src/main/scala/<binding.module.package path>/<binding.module object>.scala`|not-run|
|suppressed|strict slot 缺席，或 writer scope 排除本族|0|无|not-run；不是缺源码|
|invalid|空 sagas、准入/路径/名称/source 不合法|不应形成可用 strict 计划|拒绝发生在 prepare；不能保证其他 CLI 错误均事务回滚|not-run|

目标物理根必须显式二选一，首个对账 fixture 选 single；批准目标完整路径模式是 `<target>/app/<base path>/application/services/transactor/<ModuleName>.scala`，multi 对应 `<target>/modules/glue/src/main/scala/<base path>/application/services/transactor/<ModuleName>.scala`。DI/启动装配归 `<target>/app/<base path>/infrastructure/bootstrap/<ModuleName>Bootstrap.scala`（仅实际需要时由 bootstrap owner 生成），不新增第四层。

**D1：raw 独立 namespace 与三层规则直接冲突。** [TypeResolverDSL:L46–49](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L46-L49) 恰好禁止 domain/application/infrastructure/modules/api 及 runtime/common 的包和后代；[Plan:L63–65][P44] 又要求 `selfType.fqn == binding.module.dottedPath`。因此不能说把 raw object 移进 application 就仍满足原准入。用户已经批准三层方向，但显式模块 FQN、映射契约及可能影响的定义摘要必须经同等输入适配/迁移裁定；不改 BC 基线，也不改稳定 persistence ID 或伪造旧摘要。

## 3. Model 全字段、默认值和依赖

以下是完整 [M:L1–28][M]，不是简化模型。

```scala
package net.imadz.codegen.scaffolding.cqrs.model.application.transactor

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}
import net.imadz.meta.execution._

/** Structural IR only. Technical FQNs describe required host bindings, not Scala expressions. */
final case class StrictAddressModel(member: String, participant: String, resourceSlot: String,
                                    resourceType: TypeRef, addressing: SagaAddressing)
final case class StrictReceiptReadModel(local: String, producerStep: String, producerPhase: SagaPhase,
                                        producerParticipant: String, producerAddress: StrictAddressModel,
                                        receiptType: TypeRef, codecMember: String, pin: SagaRuntimeCodec)
final case class StrictPhaseModel(stem: String, member: String, inputType: TypeRef, receiptType: TypeRef,
                                  inputFields: Vector[FieldDef], outputFields: Vector[FieldDef],
                                  inputs: Vector[SagaInput], reads: Vector[StrictReceiptReadModel],
                                  stepId: String, participantId: String, address: StrictAddressModel,
                                  technical: SagaPhaseExecution)
final case class StrictStepModel(stepId: String, participantId: String, address: StrictAddressModel,
                                 phases: Vector[StrictPhaseModel])
final case class StrictTriggerModel(member: String, sourceType: TypeRef, execution: SagaTriggerExecution)
final case class StrictCompletionModel(member: String, inputType: TypeRef, eventType: TypeRef,
                                       fields: Vector[FieldDef], execution: SagaCompletionExecution)
final case class StrictSagaModuleModel(override val selfType: TypeRef, argsType: TypeRef,
                                       argsFields: Vector[FieldDef], steps: Vector[StrictStepModel],
                                       triggers: Vector[StrictTriggerModel], completions: Vector[StrictCompletionModel],
                                       pinned: PinnedSagaExecution, override val dependencies: Set[TypeRef])
    extends ArtifactModel {
  def phases: Vector[StrictPhaseModel] = steps.flatMap(_.phases)
}
```

所有 7 个 case class 字段均必填、无构造默认值，无泛型参数/上下界/型变，无 annotation/self-type/辅构造。只 Module 继承 ArtifactModel；其它不是 ArtifactModel 子类。字段顺序以上述源码为准，尤其 Phase 的 inputs/reads 不可合并，ReceiptRead 的生产者身份/codec pin 不得从消费者反推。

|模型字段组（顺序如源码）|来源和消费|JS 对应/差距|
|---|---|---|
|Address 五字段|参与者 ID、args resource slot、真实 resource TypeRef、完整 addressing；输出地址 contract 与 Host 方法|legacy addressMembers 携带一些字段但 Host 一律 `resource: String`；formal 直接投影 `.value`，缺 AddressContract|
|ReceiptRead 八字段|按每 phase 的生产者 step/phase 去重；local 与 producer address、receipt type、binding member、runtime pin 一起保留|legacy 内联每个字段的 receipt 读取，无等价独立 read 模型；formal 同样在 command 参数字符串中解码|
|Phase 十二字段|stem/member 两源码名；input/receipt 类型；有序 FieldDef/input/source/read；step/participant/address；完整 technical execution|legacy 混入 evidence、txidSlot、fixture wire、pin 常量与 host/spec 推导；formal `pf` 直接在 renderer 读 product，无本族结构模型|
|Step 四字段|按 schedule.prepare 排序；phase 顺序来自 SagaPhase.all|legacy 按 payload group 数字 sort；family 只允许两参与者 serial closure|
|Trigger 三字段|member、命令/事件解析后的 sourceType、完整 execution|legacy 额外拒绝非同名 source-slot 映射；formal definition 无本族 trigger contract/map/start|
|Completion 五字段|member、嵌套 inputType、领域 eventType、有序字段、完整 execution|legacy 额外反查唯一 publication command；formal 的 completion 属旁路 Host/TechnicalPorts，不是此模块 map-only 方法|
|Module 八字段|selfType、Args 类型与字段、steps/triggers/completions、完整 pinned execution、dependencies|formal 外部名义 `type Args = BankPaymentArgs` 不能无裁定替换为新的嵌套 case class；pinned 不能只保留几个 flags|
|派生 `phases`|每次 `steps.flatMap(_.phases)`；没有 cached/lazy|顺序不可根据 renderer 查找重排|

共享定义 [ArtifactModel:L5–47](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L5-L47)：`fqn = selfType.packageName + "." + selfType.name`；`registerTo(registry) = registry.register(this)`；继承 `morphisms: Seq[MappingMorphism] = Nil`、`noteIds: Seq[String] = Nil`。本 Model 没有覆盖这些 defaults，也没有内嵌注释/anchor 字段；Saga 知识身份由 writer attribution 加入，不能虚构 @knowledge。

共享 [TypeSystem:L4–85](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4-L85)：

- `TypeRef(name: String, packageName: String, typeParams: Seq[TypeRef] = Nil)`；fqn 对空包特殊处理；signature 有 Tuple 糖/泛型递归；collectAllDependencies 递归含自身；shouldImport 排除空包、当前包、scala、java.lang。
- `FieldDef(name, typeRef, defaultValue: Option[String] = None, comment: Option[String] = None, noteId: Option[String] = None, description: String = "")`。Builder 只传前二字段。Template.fields **仅输出 name/type**，不发 default/comment/noteId/description；这是实际边界，不可说默认体已经实现。
- 本模板 `tpe` 不调用 signature 或 shouldImport：直接 fqn 递归拼参数；Model.dependencies 也不驱动 imports。目标补递归依赖/import 解析属于明确风格覆盖，不隐瞒 raw 债务。
- `argsType`、ReceiptRead.receiptType 虽构造，模板分别硬用 `Args`、借 Host codec 类型推导，未直接读这两个 TypeRef 字段；仍须保留模型，不据此任意删掉。

## 4. Builder 全源码与规则账

完整 [B:L1–61][B] 如下。

```scala
package net.imadz.codegen.scaffolding.cqrs.builder.application.transactor

import net.imadz.codegen.scaffolding.cqrs._
import net.imadz.codegen.scaffolding.cqrs.model.application.transactor._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.execution._

object StrictSagaModuleBuilder {
  def build(pinned: PinnedSagaExecution, ctx: GeneratorContext): StrictSagaModuleModel = {
    val s = pinned.execution
    val r = ctx.typeResolver
    val n = NamingConventions
    val module = r.strictModule(s.contract.binding.module)
    def nested(stem: String, role: String): TypeRef = r.strictNested(module, n.strictNestedName(stem, role))
    def field(slot: SagaSlot): FieldDef = FieldDef(slot.slot, r.strictValue(s.args.types.find(_.id == slot.typeId).get.dataType))
    val addresses = s.contract.definition.payload.participants.map { p =>
      val binding = s.contract.binding.participants.find(_.participantId == p.id).get
      p.id -> StrictAddressModel(n.strictMember(n.strictSymbol(p.id), "Resource"), p.id, p.resourceSlot,
        r.strictValue(s.args.types.find(_.id == p.resourceType).get.dataType), binding.addressing)
    }.toMap
    val steps = s.schedule.prepare.map { id =>
      val p = s.participants.find(_.stepId == id).get
      val address = addresses(p.participantId)
      val phases = SagaPhase.all.map { phase =>
        val ph = p.phases.find(_.phase == phase).get
        val stem = n.strictPhaseStem(p.stepId, phase.wire)
        val reads = ph.inputs.collect { case SagaInput(_, _, SagaValueSource.StepReceipt(producerId, producerPhase, _)) =>
          (producerId, producerPhase)
        }.distinct.zipWithIndex.map { case ((producerId, producerPhase), index) =>
          val producer = s.participants.find(_.stepId == producerId).get
          val producerStem = n.strictPhaseStem(producerId, producerPhase.wire)
          val pin = pinned.pins.receiptCodecs.find(x => x.stepId == producerId && x.phase == producerPhase).get.codecs.runtimeCodec
          StrictReceiptReadModel(n.strictMember(producerStem, index.toString), producerId, producerPhase,
            producer.participantId, addresses(producer.participantId), nested(producerStem, "Receipt"),
            n.strictMember(producerStem, "Binding"), pin)
        }
        StrictPhaseModel(stem, n.strictMember(stem, "Binding"), nested(stem, "Input"), nested(stem, "Receipt"),
          ph.inputs.map(i => field(SagaSlot(i.slot, i.typeId))), ph.outputs.map(field), ph.inputs, reads,
          id, p.participantId, address, ph)
      }
      StrictStepModel(id, p.participantId, address, phases)
    }
    val triggers = s.triggers.map { t =>
      val source = t.declaration.source match {
        case SagaTriggerSource.Command(ref) => r.command(ref.command)
        case SagaTriggerSource.Event(ref) => r.event(ref.event)
      }
      StrictTriggerModel(n.strictMember(n.strictSymbol(t.declaration.id), "Trigger"), source, t)
    }
    val completions = s.completions.map { c =>
      StrictCompletionModel(n.strictMember(n.strictSymbol(c.kind.wire), "Completion"),
        nested(n.firstUpper(n.strictSymbol(c.kind.wire)), "CompletionInput"), r.event(c.event.event),
        c.inputs.map(i => field(SagaSlot(i.slot, i.typeId))), c)
    }
    val fields = s.args.slots.map(field)
    val deps = fields.map(_.typeRef).toSet ++ steps.flatMap(_.phases).flatMap(p => p.inputFields ++ p.outputFields).map(_.typeRef) ++
      triggers.map(_.sourceType) ++ completions.map(_.eventType) ++
      Set(r.strictRuntime("StrictSagaDefinition"), r.strictRuntime("StrictSagaCoordinator"), r.strictRuntime("PhasePort"))
    StrictSagaModuleModel(module, nested("", "Args"), fields, steps, triggers, completions, pinned, deps)
  }
}
```

|稳定规则 ID / 源行|完整规则、顺序与失败|目标/JS 处理|
|---|---|---|
|B01 / 10–15|先取 execution、resolver、naming；strictModule(binding.module)；nested owner 是 module.fqn；slot.typeId 在 args.types 中 find.get 后 strictValue|保留显式 module 绑定，D1 裁定 namespace；不从业务 ID 猜 target 包|
|B02 / 16–20|逐 definition participant 找 technical binding 和 resource type；participant ID 为 Map key；成员 `strictMember(strictSymbol(id), "Resource")`|JS 建 AddressModel，不以 `String` 代替真实 TypeRef，不以 first participant 推断全部地址|
|B03 / 21–26|schedule.prepare 决定 step 顺序；按 stepId 找 participant execution；每个 SagaPhase.all 找完整 phase；stem=首字母大写的 strict step + strict phase|不把 numeric group 排序当 schedule 的通用替身；命名与 stable ID 分离|
|B04 / 27–36|只收 StepReceipt；按 producerId/producerPhase distinct，保留首次顺序并 zipWithIndex；定位生产者 participant/address/Receipt 类型/runtime receipt pin/member|同 phase 多 slot 共读一次；不得把 receipt-field 与 step-receipt wire 文本混同|
|B05 / 37–42|分别构造 Input/Receipt 类型、inputs 对应字段、outputs 字段；完整 inputs/reads/technical 进入 Phase；Step 包含四字段|Builder 不在 model 塞最终 source；formal 技术适配另归 host owner|
|B06 / 43–49|Command trigger 用 r.command(ref.command)；Event 用 r.event(ref.event)；member 由 trigger declaration.id 生成；保留整个 execution|不截取 source 的第一个参数；不添加同名映射限制|
|B07 / 50–54|Completion member 从 kind.wire；Input 名首字母大写 strict kind + CompletionInput；event 用 r.event；fields 来自 inputs|只建 map-only 完成接口，不能添加假 publication success|
|B08 / 55–59|Args fields 原序；deps=Args types ∪ 各 phase input/output types ∪ trigger source types ∪ completion event types ∪ StrictSagaDefinition/StrictSagaCoordinator/PhasePort|raw 没单独加入 completion input types、address type、ActorRef/Behavior/PersistenceId/ExecutionContext/Try 等，也未递归 collect；目标统一补实际所需依赖，不假称 raw 收集齐全|
|B09 / 全体 lookup|find.get、Map.apply 依赖前置准入；没有 fallback/default/占位类型；Builder 不自行输出诊断或吞错|补诊断时保留拒绝性，不改成空 steps、空 receipt、默认 pin=1|

共享命名 [NamingConventions:L7–27](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L7-L27) 的 raw `strictSymbol` 仅 `-→_`，拒绝非法字符/关键字；strictPhaseStem 只首字母大写；strictMember 只首字母小写后拼 role，不去重复技术后缀。目标 CamelCase 是用户覆盖，不是 raw 原本已有。`strictValue` [TypeResolverDSL:L30–43](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L30-L43) 经 resolve 后拒绝 any/Double，不能用所有非 Money 都 String 的分支替代。

## 5. Template 按最终输出顺序的 construct / RHS 账

完整原模板在附录；以下表逐一定位其所有输出族和条件。模板循环只是展开规则，不是省略成员。没有 fresh 展开文件，本文不将源码中的 `$...` 误当业务实现占位。

### 5.1 头部、常量与合同声明

|构造 ID|原模板行 / 构造|RHS、字段与顺序规则|approved-target 处理|
|---|---|---|---|
|T01|[183–194][T183] package/import/comment|package=selfType.packageName；imports **依序** ActorRef+Behavior、PersistenceId、`net.imadz.infra.saga.strict._`、ExecutionContext+Future、Try；候选/未 runtime verified/Host 义务注释完整保留|包按 D1；无歧义项目类型用 import + 简名；不删诚实注释|
|T02|195 object|`object selfType.name`，无继承/构造参数|源码名 PascalCase，不改 runtime identity|
|T03|196–204 九个 val|Name=runtimeIdentity.name；Version=pins.runtimeVersion；DefinitionDigest=execution.definitionDigest；ArgsPin=pins.argsCodec.runtimeCodec；CandidateArtifact=target.artifact；ArtifactStatus=target.artifactStatus；UpstreamRunnable=s.runnable；UpstreamRuntimeBindingVerified=s.runtimeBindingVerified；UpstreamBlocked=s.blocked 原序字符串 Vector|不由生成成功重写 flags；不造候选坐标默认值|
|T04|205–208|`final case class Args(argsFields)`；`TriggerStart(transactionId: String,args: Args)`；AddressContract 六 String 字段按附录；每 distinct step address 一 val，参数为 participant/resourceSlot/addressing.resourceType/aggregate.targetName/resolver.dottedPath/`exact-resource`|Args/纯输入不含 ActorRef；现存名义 Args 对接见 D2|
|T05|209–215|ValueSource(kind,slot,producerStep,producerPhase) 全 String；SlotContract(slot,typeId)；InputContract(slot,typeId,source)；ConfirmationContract(aggregate,event,mapperFqn,outputs)；QueryContract(mapperFqn,mode,identity,results)；ReceiptContract(mapperFqn,version,durable,identity,compatibility,evidence)；IdempotencyContract(mapperFqn,identity,payloadConflict,attempt)|字段类型/顺序如附录，不以通用 Map[String,Any] 替代|
|T06|216–223|PhaseContract 16 字段按附录：step→participant→phase→portFqn→commandMapperFqn→aggregate→command→inputs→outputs→confirmation→query→receipt→idempotency→contractCodecId→contractCodecVersion→receiptPin；TriggerContract 9 字段；CompletionContract 5；TypeContract 4|保留完整技术合同，不只保留 port 名字或一个 content 字符串|
|T07|224–231|sealed ValueShape；依序 BoundedText、BooleanShape(case object)、IntegerShape、EnumerationShape、ValueObjectShape、MoneyShape；存在 collection **或** manifest 时两个额外 final case class SequenceShape/ManifestRefShape 一并输出；RequiredTypes: Vector[TypeContract]|不是总发两个额外 shape；类型身份不合并|
|T08|232–233|ArgsCodecContract(mapperFqn,id,version,compatibleVersions,runtimePin)；RequiredArgsCodec 参数=s.args.codec mapper/id/version/compatibleVersions/ArgsPin|合约版本 String 与 runtime Int pin 分开|
|T09|234–239|HostRequirements 19 字段按附录；RequiredHost 从 host capabilities、totalDeadline、admission 三上限、manifest.durable、businessInvariants、八个固定安全 wire 值、resilience 四数值构造|不写死 durableManifest=true/backoff=0/maxReconcile=32|
|T10|[240–256][T240] Host / checkedArgsCodec|Host 首四方法见下，之后 addresses→phases→triggers→completions 的 Host 成员；checkedArgsCodec 有序检查见下|abstract 实现义务保留，不提供空 body/恒真通过|

以上 case class 均无默认值、annotation、自类型、显式 companion、辅构造、泛型/上下界；ValueShape 子型才有 extends，父构造无实参。没有 var/lazy/implicit object 或显式 type alias。模板输入 TypeRef 可带泛型，输出唯一显式方法泛型使用 runtime 类型实参；`implicit ec` 在 phasePort、definition、behavior 的第二参数表，不是隐式全局依赖。

### 5.2 类型形状、source 与 technical RHS 的完整分支

[Template:L11–72][T11] 的生成侧 helper 是输出合同的一部分：`text` 用 ujson.Str + escapeUnicode=true；`id` 调 scalaIdentifier；`tpe` 递归 FQN 和 `[...]`；fields 仅以 `, ` 拼 `id(name): tpe(typeRef)`；pin=`CodecPin(quoted id, version)`。strings/inputs 输出 `Vector(...)`，保留输入顺序。

|规则|分支 / 完整 RHS|
|---|---|
|TypeContract|`TypeContract(t.id, t.canonicalType, t.implementation.dottedPath, shape)`，各字符串用 text；原序逗号换行|
|Id / Text / Bool / Integer|`BoundedText("id",min,max)` / `BoundedText("text",min,max)` / `BooleanShape` / `IntegerShape(minL,maxL)`|
|Enumeration / ValueObject|`EnumerationShape(Vector(quoted values...))`；`ValueObjectShape(Vector(SlotContract(field.slot,field.typeId)...))`|
|Money|`MoneyShape(scale,precision,codec.dottedPath,"ISO-4217","minor-unit-string")`；pattern 中其余两字段被 `_` 丢弃，不能声称发射为可配置 currency/encoding|
|Collection|根据 element type ID 查 args.types，缺失抛 `Missing collection element`；仅 Id/Text 可成 elementShape，其它抛 `Collection element must be bounded text`；`SequenceShape(elementShape,min,max)`|
|ManifestReference|readable=true 才 `ManifestRefShape(version)`；否则抛 `Unreadable manifest reference`|
|InputContract 全五 source|Args→`ValueSource("args",slot,"","")`；SourceField→`("source-field",slot,"","")`；ReceiptField→`("receipt-field",slot,"","")`；TransactionId→`("transaction-id","","","")`；StepReceipt→`("step-receipt",slot,step,phase.wire)`|
|PhaseContract technical|step/participant/Phase.runtimeName；port、commandMapper FQN；command owner.targetName/contractName；全部 inputs/outputs；Confirmation 的 event owner/name、mapper 和 outputs；Query 固定 read-only 加 identity/results.wire；Receipt mapper/version/durable/identity.wire 加 exact、reservation-decision-effect-reconciliation；Idempotency mapper/identity.wire 加 reject、excluded；contract codec id/version 和真正 runtime pin|
|phase input expression|Args→`request.args.<slot>`；TransactionId→`request.identity.transaction.transactionId`；StepReceipt→对应去重 read.local 的 slot；其余抛 `Unsupported phase value source`|
|completion input expression|TransactionId→`identity.transactionId`；Args→`args.<slot>`；其余抛 `Unsupported completion source`|

### 5.3 Host 与 phase 全体生成循环

Host 首先声明：`argsCodec: PayloadCodec[Args]`（注释带 canonical mapper/version）、`settings: StrictSagaCoordinator.Settings`（显式 budget，不猜默认）、`requireImplemented(requirements: HostRequirements, types: Vector[TypeContract], argsCodec: ArgsCodecContract): Unit`、`requireIndependentNamespace(persistenceId: PersistenceId): Unit`。随后每 address 输出 contract getter 与 `def member(resource: tpe(resourceType)): String`，注明纯 exact-resource/no I/O；每 phase/trigger/completion 输出各自 Binding getter。

`checkedArgsCodec(host)` 严格依次执行：host 与 host.argsCodec 非空检查 → `host.requireImplemented(RequiredHost, RequiredTypes, RequiredArgsCodec)` → 所有 address contract 相等检查 → `val codec = host.argsCodec` → `codec.pin == ArgsPin` → 返回 codec。它不证明宿主方法实现真实性，也不执行 deadline/admission 算法。

[Template:L73–117][T73] 对 `m.phases = steps.flatMap(_.phases)` 中每项依序生成以下构造。

|ID|每 phase 构造|完整 body / 规则|
|---|---|---|
|T11|Input、Receipt case classes|各 FieldDef 原序；不附 ActorRef/defaultValue；输出 Slot 类型来自 strictValue|
|T12|`val memberContract: PhaseContract`|完整 tech(p)，见上表；不能只记签名|
|T13|`trait <stem>HostBinding`|contract、receiptCodec、querySafety 三 getter；execute(identity: OperationIdentity,input: Input): Future[PhaseOutcome[Receipt]]；query 同签名；均抽象，不生成实现|
|T14|`private def memberPort(host: Host)(implicit ec)`|返回 PhasePort[Args,Receipt]；捕获 binding；先检查 non-null+contract 相等；捕获 codec；检查 non-null+runtime pin；检查 querySafety==DeclaredReadOnly；之后 new PhasePort|
|T15|匿名 PhasePort.receiptCodec|每次读取时 require `binding.receiptCodec eq codec`，再 require contract 未漂移，最后返回捕获 codec；不是只首次校验|
|T16|匿名 PhasePort.querySafety|RHS=`binding.querySafety`，不硬写新的安全状态|
|T17|`private def input(request)`|`Future.fromTry(Try { ... })`；先校验 stepId、participantId、phase 与 consumer resource=host resolver(args.resourceSlot)；再逐 read 取前序 receipt；最后 Input(每项 source expression)，失败不可执行 binding|
|T18|每 read 的 val|`request.receipt(OperationIdentity(request.identity.transaction, producerParticipant, host.producerAddress.member(request.args.producerResourceSlot), producerStep, Phase.producerPhase), producer runtime pin, host.producerBinding.receiptCodec).get`；按 producer pair 去重，局部名为 strictMember(producerStem,index.toString)|
|T19|execute / query|分别 `input(request).flatMap(value => binding.execute(request.identity,value))` / `.query(...)`；不新造 ConfirmedReceipt，也不把异常包装成成功|

### 5.4 Trigger、Completion、definition、behavior 的完整循环

|ID / 源|生成体|完整 RHS / 顺序|
|---|---|---|
|T20 / [118–139][T118]|每 trigger 的 memberContract|TriggerContract(declaration.id, source.owner.targetName, idempotency.sourceSlot, idempotency.typeId, 全部 args InputContract, argsMapper, idempotencyMapper, `saga-version`, `reject-different-args`)|
|T21|每 trigger 的 Binding trait|`contract: TriggerContract`；`map(source: tpe(sourceType)): TriggerStart`；“Whole typed trigger”注释保留，命令/事件两分支 source 完整传入|
|T22|`memberStart(source,host,replyTo: ActorRef[StrictSagaCoordinator.Reply]): StrictSagaCoordinator.Start`|binding 非空且 contract 相等 → mapped=binding.map(source) → mapped/transactionId 非空且 ID nonEmpty → checkedArgsCodec → encode args → bytes 非空且 decode→encode 的 Try.get 结果等于 bytes → codec pin 再检查 → `StrictSagaCoordinator.Start(mapped.transactionId,bytes,replyTo)`；只构造命令，不在这里 spawn/send/persist|
|T23 / [140–160][T140]|每 completion 的 Input / Contract / Binding|Input 字段原序；CompletionContract(kind.wire,event owner,event contractName,mapper,全部 inputs)；Binding 的 contract getter 和 map(identity: TransactionIdentity,input): eventType|
|T24|`memberEvent(identity,args,host): eventType`|先核 definitionName/version/digest；取 binding；核 non-null+contract；`binding.map(identity,Input(transactionId/args fields...))`；**不检查 durable status、不发布**，注释明确这些是 host 义务|
|T25 / [161–182][T161]|definition 的 participant Vector 元素|每 m.steps 一个 StrictParticipant[Args](stepId,participantId,host.address.member(args.resourceSlot),Map(每 phase `Phase.runtimeName -> PhaseBinding(memberPort(host))`))；顺序不换成字母序|
|T26 / [264–268][T264]|`definition(host)(implicit ec): StrictSagaDefinition[Args]`|codec=checkedArgsCodec(host)；`StrictSagaDefinition[Args](Name,Version,DefinitionDigest,codec,args => Vector(participants...))`；phase port 构造在此 args lambda 中，不凭空提前/后移验证时机|
|T27 / [269–275][T264]|`behavior(persistenceId: PersistenceId,host,authorizer)(implicit ec)`|检查 PID/authorizer 非空 → `host.requireIndependentNamespace(persistenceId)` → settings=host.settings → settings 非空且 interactionTimeout.toMillis 等于 execution.coordinator.interactionTimeoutMs → `StrictSagaCoordinator(persistenceId,definition(host),authorizer,settings)`；无默认 PID/budget|
|T28|闭合与空循环|phase/trigger/completion 各 `mkString("\n\n")`；空集合不额外造 stub；最终 object 关闭、末尾换行。import ActorRef 即使无 trigger 仍在 raw；目标可按确实依赖移除但须列有限差异|

本模板没有 `???`、MANUAL 区或业务算法 body 字符串字段；**抽象 Host/Binding 就是未实现槽**，不意味着任务遗漏，也不授权生成 fake mapper、空成功、`requireImplemented = ()`。模板本身确实持有 `tech/source/phaseCode/...` Scala 源码字符串，属于 Template 职责；不把这个例外扩张成 Model.content。

## 6. JS formal / legacy / family：真实接线与差距

### 6.1 formal 银行链路

可达链不是由文件夹名推断：

- [registeredProductProducer:L92–101](../baseline/js/lib/products/generate-cli.mjs#L92-L101) 注册 `scala-cqrs-play-service`。
- [service generate:L16–26,67–70](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L16-L26) 继承 `createEffectRegistry('2')`，aggregate/invariant 才单独替换，其他保留 implementation.produce。
- [produce-effect:L6–18](../baseline/js/generators/scala-cqrs-application/produce-effect.mjs#L6-L18) 继承 applicationRegistry；[produce:L17–33](../baseline/js/generators/scala-cqrs-application/produce.mjs#L17-L33) 的 `finite-host-dsl` 明确依次调用 renderDefinitions、InvocationHosts、HostAdapters、TechnicalPorts、HostIO、HostVerification。
- [renderDefinitions:L12–58][F] 实際发 `application/<host-id_underscores>Definition.scala`，kind=`saga-definition`，并依赖 DomainConverters 和 domain Protocol。这是 strict runtime bridge 的形式，不是 classic SagaDefinition 族的实现等价证明。

|formal 构造（完整 renderer 顺序）|银行 actual 对应|与 raw 的具体差距 / 不得丢失的内容|
|---|---|---|
|F01 layout、hosts、saga lookup、field/idValue/phase/method 推导（F15–24）|A2–12 package/name/Args alias|只接受 direct/pipeline startOwner；匹配 sagaId/version；名称 `-→_`；没有 Module/Phase/ReceiptRead 结构模型；`let text` 混合 Builder/Template|
|F02 argsCodec（F25）|A13–17|pin=BankPaymentArgs/1；PB encode→toByteString、PB parse→DomainConverters decode 包 Try；raw 是注入 canonical codec，不能删现有 PB 表示或重造其名义 Args|
|F03 Ports（F26–28）|A18–30|technical:Installed、installed Map，加 3 participants × 3 phases typed PhasePort；没有 Host.requireImplemented、地址/phase 全合同、typed trigger/map-only completion|
|F04 fromTechnical（F29–39）|A31–91|new Ports 捕获 objects/declarations；每 phase execute 从 command 参数构造 typed Input，再调用 `...ExecuteOperation(input,identity)`；成功 map ConfirmedReceipt；OperationNotExecuted 仅身份一致且非空 evidence 才 NotExecuted，其余 Unknown。query 七个身份分量构造 typed Query，Some→Confirmed，None→Unknown，相同异常处理。**不能丢弃这些证据规则换成恒成功**|
|F05 每 phase codec/check/command/bind（F40–50）|A92–352，9 个相同结构循环|codec runtime id/version 原样；check 的七项 txid/definition-version/args-digest/participant/resource/step/phase 精确比较，名义值按 idValue 解包；command 使用 domain Protocol，transaction-id 名义包裹，producer receipt 从实际 producer identity/codec 读取；bind 先检 underlying codec/querySafety，再包装 execute/query，所有结果身份相等且 Confirmed 另检查 receipt 字段|
|F06 definition（F51–54）|A353–371|注入对象/声明一致，requireInstalled；9 个 installed binding vals；定义 name=`bank-cash-payment-v1`、version=1、完整 sha256 digest；Vector 顺序 reserve-investor-funds→credit-fund-collection→reserve-cash-fund-order，资源 investorAccountId→fundCollectionAccountId→fundOrderId，均 `.value`|
|F07 coordinator（F55）|A372–375|String PID nonempty→PersistenceId.ofUniqueId；settings timeout 来自产品，reconcile budget **硬编码32**；raw Host.settings 不猜 budget 且有独立 namespace guard|
|F08 entry（F56–58）|冻结文件头和物理路径|entry source=[h.source]、footprint、deps；必须由唯一 writer 后定位 anchor，不在 renderer 里改已有 ledger|

银行完整 output 是 [A][A]；不是只贴一种 phase。九个循环中 receipt 类型按 `BankPayment{0,1,2}{Prepare,Commit,Compensate}Receipt`；codec id 分别为 `bank-payment-` + 原 step ID + `-` + 原 phase，全部 runtime version=1。命令序列分别 `ReserveFunds/DeductFunds/ReleaseReservedFunds`、`RecordIncomingCredits/CommitIncomingCredits/CancelIncomingCredit`、`ReserveFundSubscription/ConfirmFundSubscriptionPayment/CancelCashFundSubscription`。Args/receipt 的名义类型和 PB/converter 必须保持，不因字段同构与 raw nested case class 合并。

关联 [TechnicalPorts 全文](../baseline/actual-js/app/example/bankwealth/application/bank_payment_hostTechnicalPorts.scala#L7-L240) 有抽象手写回调、required id/version、BindingOwnership、OperationNotExecuted、CompletionContext、Implementation 的 operation/completion null 默认及 install 分支非空校验；它属于独立 host 适配写集合，不把这些默认 null 悄悄变“已完成”。本文不授权替换手写实现。

### 6.2 legacy 有近似 renderer，且 core 与 run-all 不同

- [saga-dsl/generate:L87–146](../baseline/js/generators/saga-dsl/generate.mjs#L87-L146)：explicit legacy 只消费完整 legacySagaSpecs 且不可吞 canonical sagas；strict-contract 对 compiler 完整 IR 作 stableJson 等值验证，输出 contract/phases/consumption JSON；`strict-scala` **明确 runtimeBlocked**。其 `planStrictSagaIR` 也只返回合同计划。
- [run-all:L2176–2214](../baseline/js/generators/run-all.mjs#L2176-L2214)：当 sagaBinding && canonical.sagas.length，compileSagas→lowerSagaRuntimeBindingV3→emitStrictFiles→emitStrictHostFiles/SpecFiles；strictSourceEntries 使用实际 path、content、saga knowledgeId、definitionDigest。这条 legacy orchestration 确实接通 `emit-strict`，不能因为 core strict-scala 阻断就说 renderer 不可达。
- [run-all:L2216–2256](../baseline/js/generators/run-all.mjs#L2216-L2256) 可复制指定 jar 到 out/lib、修改 build.sbt；不是只产单模块的纯 CLI。正式 product registry 中并没有把 `saga-dsl/emit-strict.mjs` 作为 shipped product producer 注册。

已完整阅读 [L:L1–946][L]，其中真正本族是 renderFiles 的 sagaModule 部分；其余 types/wire/money/argsCodec 是另一组输出，必须保持唯一装配 owner。

|legacy 范围|观察内容|与 raw 差距 / 拆分归属|
|---|---|---|
|L23–71|私有 keyword/name/string/source helpers；step receipt 归 receipt-field wire|目标复用公共 resolver；StepReceipt 与 ReceiptField 在 raw 是两个 constructor/wire，不可混写|
|L80–149|默认 basePkg/header；types/shape/bounds、money-last wire 限制；所有 id/text/manifest→String、collection→Vector[String]，只第一个 Money FQN；mapper/entry 尾段解析|strictValue 不是这种折叠；不将 fixture wire 限制扩大到通用 module；不得再以 alias 合并名义类型|
|L151–224|canonical aggregate face/只读 query 推断；step 按 numeric group sort；phase 从 declaration×technical 拼接|是 fixture-host 推导，不等 schedule.prepare；当前模块也被这些非模块条件耦合|
|L226–354|prepare evidence writtenBy、terminal marker/key、Money lineage/fold 检查；额外输出必须与 input 同名；inputShapes 重复 property；pinId 拼 step-phase-receipt，pinVersion 条件两支都1|保留证据检查在 fixture-host owner；模块只用实际 admitted pin，不用1兜底，不复制重复 property|
|L356–407|trigger 限定 source: 且同名；completion 反查唯一 producing publication command|raw 仅抽象 map，不具这些限制；迁往 fixture-host/spec 模型而非丢掉|
|L409–468|强制第二 step funding seed；capability allowlist；publication 默认第一 step；resourceMembers 带占位注释；混合 model.saga 与 faces/evidence/fixture 字段|普通 strict module 不应因无 fundingSeed 就无法建模；不能把占位 resourceMembers 当已完成结构事实|
|L479–539|shapeExpr 少 Enumeration/ValueObject branch；bool/integer renderer 有，但 args shapeOf 不接受；phaseContract 中 contract codec 写 pinId/receipt-v1/runtime1|raw 所有 shape 分支与 contract/runtime pins 要独立保真；不能凭“存在 bool renderer”推断支持任意 bool slot|
|L541–600|phase binding 接口接近 raw；reads=[]，producer receipt 逐 input 直接内联查读，pin version=1；consumer resource 来自 resourceInput|raw 有去重 read model/local、实际 producer pin；输入求值次数变化不能被格式化隐藏|
|L602–649|trigger / completion 大体与 raw 同形；含未使用 decl/rawTriggerIdOf 返回 null；完整 source/pin/contract guards 仍存在|提取 actual declaration 一次到 Builder，保留 Start canonical codec checks、completion map-only 顺序|
|L651–687|participants 按已建 phases 分组；addresses 来自全部 payload participants，Host resource 一律 String；manifest 固定 true，backoff `??0`|raw addresses 来自 steps distinct、resourceType 真实；durable/backoff来自 execution，不添加默认|
|L689–788|固定 imports/合同声明/Host/definition/behavior 与 raw 最接近；runtimeVersion 可 fallback；CandidateArtifact/ArtifactStatus/ArgsRuntimeVersion 有默认；SequenceShape/ManifestRefShape 无条件发|都须按本族字段/条件清单替换；readiness flags 原样透传这点保留|
|L790–946|types.scala；StrictWire length-prefixed ByteString；可选 MoneyCodec；ArgsCodec 顺序 decode chain；返回 module/types/wire/optional money/args codec 文件集合|本族只拥有 module 片段。wire、Money、ArgsCodec、types 有独立 ABI/overflow/编码合同，不能为了模块移植静默替换|

### 6.3 family 显式产品链：注册但不是银行 formal 的自动替代

[generate-cli:L45–63,92–101](../baseline/js/lib/products/generate-cli.mjs#L45-L63) 注册 `scala-cqrs-saga-monarch-v1`，且要求 captured implementations；直接 generate-products（包括 --plan）被 `SAGA_MONARCH_CAPTURE_REQUIRED` 拒绝，必须 generate-project。其 [generate:L12–43](../baseline/js/generators/scala-cqrs-saga-monarch-v1/generate.mjs#L12-L43) 要求 exact eight product requirements、固定 manifest、live capture，再 planProductSet→buildModels→implementationBuildInputs→render。

[FM:L35–100][FM] 明确固定 runtime、identity strategy、两参与者 serial schedule、正 Int role，拒绝非空 exact-money descriptors；包硬编码 `<base>.kernel/.glue/.root`，因此也不符合批准的三业务层。不是可以直接接银行三个 participants/Money 的 generic strict module。

[render:L12–29](../baseline/js/generators/scala-cqrs-saga-monarch-v1/render.mjs#L12-L29) 唯一调度 protocol/codecs/saga/runtime/workflow/root 六角色和 build/config；[FM:L385–398](../baseline/js/generators/scala-cqrs-saga-monarch-v1/build-models.mjs#L385-L398) saga role kind=`saga-bridge`，directDeps 为 protocol、codecs、runtime。模型/文件有分层不等于本族 MBT 已齐。

完整 [sagaTemplate][FT] 及 [identity](../baseline/js/generators/scala-cqrs-saga-monarch-v1/templates/saga-identity.mjs#L3-L51)、[phases](../baseline/js/generators/scala-cqrs-saga-monarch-v1/templates/saga-phases.mjs#L4-L71) 已实读：

|family 输出顺序|实际构造/RHS与本族关系|
|---|---|
|imports → identity object|DefinitionName/Version/Digest；protobuf codec adapter；args/三 receipt codecs；kernel/runtime 身份转换；expected 用 DataOutputStream 写 `strict-saga-plan-v2`、参与者/phase/codec pin，计算 planDigest、item-derived txid/result key；不可为命名整改改其 framing|
|final class + private runtime fields|ActorSystem/namespace/applicationPorts/settings/implicit ec；scheduler、timeout=interactionTimeout+1.second；mutable actors Map、capacity guard；actor PID=`namespace + "/saga/" + transactionId`，systemActorOf；这些是 lifecycle host 责任，不是 raw 的纯 definition 模块|
|phase bridges|checked Either；outcome 区分 Confirmed/SafeAbsent/NotFound/Unknown/Rejected；producer 用 first:Boolean 限定两个参与者；prepared/committedFirst 读 durable receipt 并验证 evidence；各 phase 构造 typed command，query/execute 分支；definition 固定两 participant|
|authorizer / association / classify|authorize 委托；association 必须持久记录匹配；classify 验证 identity/args/participant/codec/evidence；Succeeded 必须 commit decision+prepare/commit confirmed；Aborted 必须 compensate 或安全 absence；其余 RecoveryRequired/OutcomeUnknown|
|start/query/reconcile/publish|先 associations.ensure 再 ask Start；Attach；授权及 budget 后 Reconcile；publication 仅 terminal，validate receipt identity/key/bytes；Unknown delivery 后 query。不允许替成 raw completionEvent 就删 durable publication|

结论是 **相关的 family bridge 可参考 API 使用，但完整 strict-module counterpart 仍未接入该 family**，要保留 family 支撑职责与有限输入界限。本文不改家族源码或扩大其支持范围。

## 7. 真实 minus / plus 对照与批准偏差

### 7.1 银行 actual-js → raw 风格目标的 coordinator 接口

**结构性对照，非同输入字节比较，也不是可直接应用的生产 patch。** minus 是 [A:L371–376](../baseline/actual-js/app/example/bankwealth/application/bank_payment_hostDefinition.scala#L371-L376) 的真实现存源码。plus 是 [T:L269–275][T264] 的 Host-bound 结构，保留该 actual 的 timeout 数值1000，仅用于解释 D2/D3 必须补齐的 Host/definition 合同；没有编造任何宿主实现，也不声称两 API 已兼容。

```diff
--- actual-js/app/example/bankwealth/application/bank_payment_hostDefinition.scala
+++ approved-target/app/example/bankwealth/application/services/transactor/BankPaymentSagaModule.scala
@@ -371,6 +371,16 @@
   }
-  def coordinator(persistenceId: String, ports: Ports, authorizer: ReconcileAuthorizer)(implicit ec: ExecutionContext): Behavior[StrictSagaCoordinator.Command] = {
-    require(persistenceId != null && persistenceId.nonEmpty && authorizer != null, "explicit identity and reconciliation authorizer required")
-    StrictSagaCoordinator(PersistenceId.ofUniqueId(persistenceId), definition(ports), authorizer, StrictSagaCoordinator.Settings(scala.concurrent.duration.Duration(1000, "millis"), 32))
+  def behavior(
+      persistenceId: PersistenceId,
+      host: Host,
+      authorizer: ReconcileAuthorizer
+  )(implicit ec: ExecutionContext): Behavior[StrictSagaCoordinator.Command] = {
+    require(persistenceId != null && authorizer != null, "explicit persistence id and authorizer required")
+    host.requireIndependentNamespace(persistenceId)
+    val settings = host.settings
+    require(
+      settings != null && settings.interactionTimeout.toMillis == 1000,
+      "coordinator timeout pin mismatch"
+    )
+    StrictSagaCoordinator(persistenceId, definition(host), authorizer, settings)
   }
 }
```

目标名称 `BankPaymentSagaModule` 是本规格候选，待 D1 显式 binding 决定；不是发现了一个同名银行文件。Plus 中 `Host` 的全部抽象义务已在第5节明确；现有 `Ports` 不能只重命名就满足它。PID 从 String→PersistenceId 的转换归调用方，必须维持原唯一 ID 的字节；不允许趁接口迁移换 namespace。移除32意味着输入必须显式提供相同或另获批准的 budget，不是默认提高/降低。

### 7.2 真实银行命名的有限表达整改

以下片段不改变 BankPaymentArgs 的 nominal 身份、PB、pin 或 codec body，仅展示头部命名/import 的确定目标；完整文件其他构造仍需第5、6节逐项处理，不能以这一个 hunk 签收全文件。

```diff
--- actual-js/app/example/bankwealth/application/bank_payment_hostDefinition.scala
+++ approved-target/app/example/bankwealth/application/services/transactor/BankPaymentSagaModule.scala
@@ -1,5 +1,5 @@
 // @generated by truthsrc scala-cqrs-domain:1
-package example.bankwealth.application
+package example.bankwealth.application.services.transactor
 
 import akka.actor.typed.Behavior
 import akka.persistence.typed.PersistenceId
@@ -8,6 +8,8 @@
 import scala.concurrent.{ExecutionContext, Future}
 import scala.util.Try
 
-object bank_payment_hostDefinition {
-  type Args = example.bankwealth.domain.values.BankPaymentArgs
+import example.bankwealth.domain.values.BankPaymentArgs
+
+object BankPaymentSagaModule {
+  type Args = BankPaymentArgs
   val argsCodec: PayloadCodec[Args] = new PayloadCodec[Args] {
```

这个 alias 是 existing bank Args 的引用，**不批准把不同 nominal types 合成一个 alias**。raw `final case class Args(...)` 与 bank alias 的差别仍由 D2 决定；两个对照片段不是一个已完成目标文件。

### 7.3 raw-scala → approved-target 的有限差异清单

1. raw 独立 binding.module namespace → 三层内 application.services.transactor；必须先 D1，不能在 Scala 金样里偷改。
2. raw strict `-→_`、首字母规则 → 类型 PascalCase、成员 lowerCamelCase；保留 step/participant/codec/operation 等稳定 wire ID。明确提供 source symbol binding；不从新名字反推 ID。
3. raw FQN 递归输出与固定 imports → TypeRef 依赖驱动的简名/import，冲突用别名或有限 FQN；长字段/参数逐行，易错位置参数可 named args，求值/检查顺序不变。
4. raw 示例注释、完整合同、八个安全 wire 值、guards、抽象实现槽、runtime 身份/pins 均保留。不能为“Plain FP”删除 I/O 边界、变成 String/Any dispatcher。
5. raw 为 nested Args/Receipt 与 formal 外置 nominal type 存在接口差异；不作为自动允许白名单，D2 单独批准。
6. header/换行差异只能明确列工具来源头、平台 LF；不压平全文件空白，也不借旧 VerificationSpecBase.normalize 验格式。

## 8. 胶水合同、实现槽与安全保护面

以下均为模板实际要求/调用面；**不是已检查所消费 JAR 的 ABI 证明**。

|完整符号 / 来源|需要的 API / 行为|责任与缺口|
|---|---|---|
|`akka.actor.typed.ActorRef`, `Behavior`；`akka.persistence.typed.PersistenceId`|trigger Start 的 typed replyTo；behavior 返回 `Behavior[StrictSagaCoordinator.Command]`；显式 PersistenceId|仅应用 Actor-facing 接口含 ActorRef；Args/Input/Receipt/领域 event 不引入它。Akka Scala scaffold pin=2.6.20，不由源码存在推断 classpath|
|`scala.concurrent.ExecutionContext`, `Future`；`scala.util.Try`|`Future.fromTry(Try{identity checks; receipt.get; Input(...)})`，再 flatMap execute/query|先失败输入再不调用 port；Future 不是事件持久化证明|
|`net.imadz.infra.saga.strict.CodecPin`, `PayloadCodec[A]`|pin(id,Int version)、encode、decode 返回 Try；canonical encode/decode roundtrip；codec 实例 `eq` 防替换|host 提供真实 codec；维持 PB 字段号、编码/版本，不复刻一套私有 codec 来洗绿|
|`net.imadz.infra.saga.strict.TransactionIdentity`, `OperationIdentity`, `OperationRequest[A]`|事务定义身份、step/participant/resource/phase；`request.receipt(producerIdentity,pin,codec).get`|消费 coordinator 持久 receipt，非现场猜 handle；runtime 源/JAR 未在本次重验证|
|`net.imadz.infra.saga.strict.Phase`, `QuerySafety`, `PhasePort[A,R]`, `PhaseOutcome[R]`, `PhaseBinding[A]`, `StrictParticipant[A]`|三 phase；DeclaredReadOnly；receiptCodec/querySafety/execute/query；typed phase map|execute/query 的 durable 实现由 Host；生成合同相等不证明 mapper ABI 或 query 安全|
|`net.imadz.infra.saga.strict.StrictSagaDefinition[A]`|`(Name,Version,DefinitionDigest,codec,args => Vector[StrictParticipant[A]])`|构造定义不等于执行；schedule、资源、pin 原样|
|`net.imadz.infra.saga.strict.StrictSagaCoordinator` 的 Command/Reply/Start/Settings|Start(txid,bytes,replyTo)；Settings.interactionTimeout；apply(pid,definition,authorizer,settings)|behavior 委托 coordinator，host 明确 reconcile budget/namespace；持久化在 runtime，不在本模板新增 Effect.persist|
|`net.imadz.infra.saga.strict.ReconcileAuthorizer`|显式注入 coordinator；不能 null；授权逻辑不是模板默认实现|formal/family 已有技术义务，不能换成总是授权|
|每个 `binding.module`、port/mapper/codec/resolver FQN|Phase/Trigger/Completion/Address 合同记录完整 FQN；Host trait 承接对应具体方法|FQN 只是要求，不代表可反射调用/可执行；completionEvent 返回事件值，独立 observer 必须看 matching durable result 并幂等发布|

[BC scaffold:L127–147](../baseline/bc/scaffold/build.sbt#L127-L147) 默认 `net.imadz:saga-core_2.13:0.2`；显式 `codegen.candidate.sagaCore` 才移除它并加入 unmanaged JAR。相反，formal [generate-cli:L114–125](../baseline/js/lib/products/generate-cli.mjs#L114-L125) 要求 `options.runtimeArtifact.repository` 为本地 file URL，并核 `net/imadz/saga-core_2.13/0.3.0/saga-core_2.13-0.3.0.jar` 的实际 SHA；相关 pipeline 还核 Monarch pins。两条 supply 不等价，本次没有读/验证这些 JAR，不批准 publishLocal 或换供给。模板 CandidateArtifact 是输入宣告，不是依赖解析结果。

相邻聚合胶水的硬约束仍生效，但不是往 StrictPhaseModel 增加无关字段：CommandHelper 位于 `application.aggregates.behaviors`，完整实现 `toParam/createFailureReply/createSuccessReply`；Actor 命令按明确回复合同条件生成 typed replyTo；domain param/event 不含 ActorRef；失败不 persist，成功 persist/apply 后 thenReply 读新 state；`replyWith` 不等于增加发布的 `replyWithAndPublish`。本模块不产生这种 Helper，也没有自己的 thenReply，不能据 strict source 对这些行为签收。参与者命令适配必须依赖该包的最终 API，不把 domain Protocol 直接加 ActorRef 来凑接口。

禁止的“简化”：改变 codec pin/version、PB 字段编号/消息身份、serializer manifest/绑定范围、PID/幂等键、definition/plan digest framing；把 Money/receipt 名义身份 alias 合并；把 addExact 换成 `+`；将 Unknown/NotFound 当成功或安全未执行；吞掉 receipt `.get` 的失败；把 completionEvent 调用直接当幂等发布成功。

## 9. 拟实施写集合、拆分与唯一装配 owner

以下全是**下一实施阶段的 proposed 写集合**，此次没有创建/修改其中任何文件。各路径相对 JS 仓根 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc`；不是授权去写共享生成应用。

|路径 / 物理 owner|处理|本族交付内容与边界|
|---|---|---|
|`generators/saga-dsl/strict-module/model.mjs`（proposed，本族）|new|显式七种结构模型，字段/顺序对应第3节；TypeRef、FieldDef、完整 pinned/source 引用；不允许整文件 content 字段|
|`generators/saga-dsl/strict-module/build-model.mjs`（proposed，本族）|new|`buildStrictSagaModuleModel(admitted, targetContext)` 为 proposed 接口；逐项 B01–B09；名字、类型、imports、read 去重在 Builder 层解决；错误输出不降级空模型|
|`generators/saga-dsl/strict-module/render.mjs`（proposed，本族）|new|只消费结构模型，按 T01–T28 发本族一文件；字符串转义/类型/表达式通过固定 shared 合同，不在这里再读产品找 producer|
|`generators/saga-dsl/strict-module/adapt-formal.mjs`（proposed，本族，经 D2 才可实施）|new|formal reference-layout/host/runtime products→本族输入的显式映射；不能丢证据身份、pin、startOwner 或假造 trigger/completion|
|`generators/saga-dsl/emit-strict.mjs`（**集成者唯一物理 owner**）|split/adapt|先只分离 module 片段 L508–788 和其结构派生；fixture evidence/wire/types/codec 留原 owner；经输入/输出逐字节对账后调用本族 renderer。与 fixture-host 包串行，不让两代理各改半个文件|
|`generators/scala-cqrs-application/render-host.mjs`（**集成者唯一物理 owner**）|split/replace 部分|完整 Definition 文件由集成者组装；本族提供结构 definition/phase/Host 合同；F04 技术调用/异常转换和 F05 额外身份验证迁到明确 host-adapter 责任，不能消失；codec 仍由 persistence/codec owner 保持 PB ABI|
|`generators/scala-cqrs-application/produce.mjs`, `generators/scala-cqrs-application/produce-effect.mjs`, `generators/scala-cqrs-play-service/generate.mjs`（集成者）|adapt 接线|保持 formal finite-host 被真实选择，明确替换/迁移后的完整文件集合；禁止只修 legacy 让银行仍走旧 renderer|
|`generators/run-all.mjs`（集成者）|adapt legacy 调用|只在保留 legacy 消費且裁定后接同一 module renderer；不复活 core 中被阻断的 strict-scala mode|
|`lib/scala-target/naming.mjs` / target profile / TypeRef-import-layout 共享接口（集成者）|reuse/adapt|已读的 `resolveName/resolveNameSet/resolveArtifactPath` 可复用，必须先补足 raw strict mapping 与目标 CamelCase/三层关系；不让本族另造 safeName/import patcher|
|`lib/products/generate-cli.mjs`, `src/core/generate.mjs`（集成者）|原则上 reuse；新增 profile 时才另审 registry 改动|writer 唯一装配 owner，最终字节之后 fingerprint/manifest/anchors；本族不写 ledger/anchor，不扩正式 producer 支持口径|
|family `scala-cqrs-saga-monarch-v1/*`|本族不直接修改|仅登记相关 API/职责；若复用必须保留两 participant/positive Int 限制及 lifecycle/publication 身份，其 owner 另审，不在本族偷偷扩大|

公共依赖顺序：`shared-layout-types` → `application-protocol` / `command-helper` / `aggregate-behavior`（参与者 Actor 接口）→ 本族与 `fixture-host`（Host/技术 adapter 接缝）→ `bootstrap`/`application-bootstrap`（启动装配）。持久化 `protobuf-schema`、`proto-converter`、serializer/writer/anchor owner 是保护面依赖，不是本族的直接写面。

唯一文件组装责任明确：新 strict-module 三层逻辑由本族实现；**最终每个 module 文件、旧 render-host/emit-strict 复合文件及 registry 接线均由集成者单 owner 收敛**。其他 owner 只提供结构片段/API，不并发追加 import/header。没有另一条“临时”写盘捷径。

命名迁移须列旧→新源码符号表，连同所有调用方一起改：raw `Name/Version/DefinitionDigest/ArgsPin/CandidateArtifact/ArtifactStatus/UpstreamRunnable/UpstreamRuntimeBindingVerified/UpstreamBlocked/RequiredTypes/RequiredArgsCodec/RequiredHost` 按批准 lowerCamelCase 目标成为 `name/version/definitionDigest/argsPin/candidateArtifact/artifactStatus/upstreamRunnable/upstreamRuntimeBindingVerified/upstreamBlocked/requiredTypes/requiredArgsCodec/requiredHost`，仅源码标识符改变，值完全不变。Phase/Trigger/Completion/HostBinding 类型按 PascalCase、对应 member/port/start/event 按 lowerCamelCase；不得因包含数字索引把 producer read 的一求值语义丢掉。

旧输出退役仅在新 owned-target 生成计划中登记 old path→new path、import/调用方、manifest 与 source anchor 迁移。不得人工删除银行 `app/` 中旧文件，不留永久 domain forwarding shell；手写回调迁移另授权。若旧/新 nominal Args 与 Receipt 不可安全映射，D2 阻断对应输出迁移而非写双定义。

## 10. Fixture、公开 CLI 命令形状与未运行的验收义务

### 10.1 拟 fixture 集合（此次不创建）

目录提案 `docs/codegen-parity/fixtures/strict-saga-module/`。这些是比较资产，不是第二业务真源；当前无新鲜 fixture 展开字节，以下是需构造的输入合同，不伪造执行结果。

|fixture|必须覆盖的输入/观察|限制|
|---|---|---|
|`serial-two`|完整 admitted v3 + 等价 BC base/technical bindings + JS request/options；两个 participant 各 prepare/commit/compensate，显式 runtime pins **至少一个不为1**，resource nominal type；两 input 读取同一 producer receipt 不同 slot|核 schedule、producer identity、单次解码、字段顺序；不能直接把现存三参与者银行或 family 两仓库业务当同输入|
|`trigger-completion`|至少 command/event 两 trigger、完整幂等 source、非首位字段和不同名映射；args/txid 两 completion source；matched durable-result publication 由独立 host oracle|module 只生成 map；不得为运行成功伪造 mapper 或 publish receipt|
|`shape-matrix`|Id/Text/Bool/Integer/Enumeration/ValueObject/Money/Collection/ManifestReference；无 collection/manifest 时不输出两个额外 shape，有任一时一起输出；non-String resource|这是 Template/Builder 覆盖输入要求，不宣称当前 FixtureHostBuilder 准入能接纳全部；不支持的 shape 应独立阻断，而非删基准分支|
|`rejection-matrix`|缺类型/producer pin、非法 namespace/冲突名、错误 phase/completion source、collection 非 bounded text、unreadable manifest、重复 field、非绝对/链接 target|核源级/生成前拒绝；运行接口核 contract/codec 替换、consumer/producer identity 错、canonical codec 不一致、timeout 不符|
|`empty-optional` / `multi`|triggers/completions 空集合、single 与 multi 同语义 profile|空循环不造业务；multi 只改变物理根，不能改架构层或事件编码|

### 10.2 当前真实 CLI 形状（仅文档，不执行）

路径带 `<...>` 的是未来显式绝对输入/独占输出的形状变量，不是声称已有 fixture；没有发明 `--artifact strict-saga-module` 或不存在的 filter。作用域靠**最小 fixture 产品闭包**限制，不能保证 CLI 只出一个文件。

**formal product 计划/写入**（工作目录任意，所有路径绝对；使用现存 shipped producer）：

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /<owned-fixture>/strict-saga-module/serial-two/request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-play-service \
  --out /<owned-output>/strict-saga-module/js-single \
  --options-json /<owned-fixture>/strict-saga-module/serial-two/options.json \
  --plan
```

移除且仅移除 `--plan` 为实际 apply，须再次授权。依据 [generate-cli:L66–88](../baseline/js/lib/products/generate-cli.mjs#L66-L88)：请求/options/manifest 与产品闭包读取、编译/计划；读取/核对本地 runtime JAR 和 service.externalSourceRoots。`--plan` 不调用 apply；实际 apply 写全部计划产物以及 output 的 `truthsrc.ledger.json`、`anchors.json`，MANUAL merge 和最终 fingerprints 由 [core:L243–268](../baseline/js/src/core/generate.mjs#L243-L268) 处理，非事务回滚。此直接入口没有 project Graph 持久化步骤、没有 sbt/runtime 执行步骤；不因此声称后续构建不下载。**现有 producer 仍输出 formal 旧结构，只能作为 current capture，D2/D6 接线完成前不能当目标验收。**

**family / captured implementation 路由**只能用现存 `generate-project`，配置内选择 generator，不把不存在的 `--generator` 加进去：

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-project \
  --project /<owned-fixture>/strict-saga-module/family-reference/truthsrc.project.json \
  --out /<owned-output>/strict-saga-module/family-reference \
  --plan
```

依据 [project CLI:L91–144](../baseline/js/lib/project/cli.mjs#L91-L144)、[L161–224](../baseline/js/lib/project/cli.mjs#L161-L224)：capture 会 validate/roundtrip/compile 作者输入，抓取手写 implementation sources、whole-tool fingerprints；存在 implementations 时在 `--plan` 返回前仍调用 `verifyImplementationSources`。因此不能称 family `--plan` 是无子进程/无 typecheck 的纯只读命令。本次未进一步审计该 verifier 的运行输出/缓存位置，**执行前须补齐其准确子进程、缓存、超时与资源写面清单，D6 未决，当前不授权运行此命令**。实际 project apply 还写 output `.truthsrc/{canonical,request,compiled,inputs}.json`、ledger/anchors，并创建/更新 project Graph SQLite 和发布 anchors；本阶段均禁止。该 family-reference 仅接口对照，不充当银行通用 strict module 验收。

**BC 同等输入捕获**（工作目录必须显式为 `/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen`，进入前另读其 AGENTS/CLAUDE；当前未进入/运行）：

```bash
sbt \
  -Dcodegen.systemFile=/<owned-fixture>/strict-saga-module/serial-two/canonical.json \
  -Dcodegen.systemBindings=/<owned-fixture>/strict-saga-module/serial-two/system-bindings.json \
  -Dcodegen.sagaExecutionV3=/<owned-fixture>/strict-saga-module/serial-two/saga-execution-v3.json \
  -Dcodegen.targetDir=/<owned-output>/strict-saga-module/bc-single \
  -Dcodegen.ledger=/<owned-output>/strict-saga-module/bc-single/generation-ledger.json \
  -Dcodegen.multiProject=false \
  "runMain net.imadz.codegen.CodegenMain"
```

这些 systemFile/systemBindings 与 `codegen.system` 互斥，不省略 target 退回默认 banking-app。原 CLI 无本族-only flag；它会建 target、复制 scaffold、写各层/strict/fixture-host/test/bootstrap、ledger 与 strict anchors；sbt 本身可能写 BC target/project target、工具缓存并解析/下载依赖，须实施期单独批准离线供给/写根清单和批末集中 JVM 窗口。该命令不是文档阶段授权，也不是 runtime 验证命令；不使用 publishLocal。multi 对照仅将 `codegen.multiProject=true` 并换独立输出根，不叠写 single。

### 10.3 验收账（全部 not-run / not-measured）

1. 同等输入双端公开 CLI 生成后的**完整文件集合**与最终字节对账：package、imports/注释分组、字段/成员/嵌套声明顺序、所有 RHS、body/默认值/调用顺序；同时保存 raw/target/actual，不能只比一个 hunk。
2. 每个 T01–T28、B01–B09、Model 全字段须有 source→model→construct 对应；unsupported branch 不能用合并成“类型处理”隐藏。字节白名单仅明确 header/LF/已批准布局命名/import/排版，不抹除空白比较。
3. 真实接口/行为验证独立于源相似度：错误 binding/codec drift/identity/receipt/timeout 导致 fail-closed；无 execute/query 副作用越过 input 失败；trigger 完整 source/idempotency/canonical bytes；completion 只 map，不自动发布；Host 独立 durable-result observer 幂等发布；Unknown 不被当作 terminal success；真实 jar 的 typed API/serializer/PID/codec 兼容。
4. 相邻聚合最小行为验证仍要求 Helper 失败无 persist、成功 thenReply 读取更新 state、reply 次数及无意外发布；不能用本族“只构造 Start”替代这些验证。
5. 普通 JS/Scala 方法 CC 目标 **≤5，not-measured**；6–10 逐方法解释，>10 先拆职责或经逐方法例外批准；普通嵌套≤2。固定工具/版本/口径前不报分数，不把 ADT/phase 分支搬进 String/Any 表刷分。
6. 两次相同输入生成稳定；改一个显式 slot/source 时局部差异合理；最终 bytes 定型之后 fingerprint/ledger/anchor，再从原作者 query 回到新源码，旧路径可追踪退役。
7. 先核写集合/依赖 pins/并行漂移；建议生成与比较≤5分钟、集中局部 JVM≤15分钟是未来调度预算，不是已测性能。缺接口、缺 supply、输入不等价时停止该项，不补 stub、不全量重跑银行。

### 10.4 具体未决项

- **D1 namespace/FQN**：三层目标与 raw strictIndependentNamespace 相斥；明确新 module FQN、旧 source symbol mapping、准入适配和 definitionDigest 处理；不改变 PID/稳定身份作为绕过。
- **D2 formal→raw 语义/名义类型适配**：bank Args/Receipt 为外置 nominal + PB，而 raw 为 nested case class；formal product 还多 evidence identity/installation，raw 要全 Address/Phase/Trigger/Completion/HostRequirements。哪些输入明确提供、哪些合法缺席、哪些需要显式 mapper，必须字段级裁定，不复制 family 有限两参与者模板。
- **D3 Host 实现与 runtime supply**：谁提供 canonical Args/Receipt codec、Host.settings 的 maxReconcileInteractions、requireImplemented/namespace、全部 Binding mapper、durable completion observer；实际 JAR 坐标/SHA/API 与 source 要求尚未重核。硬编码32不能当默认合同。
- **D4 基准例外**：raw dependencies 漏递归/若干类型，FQN 模板不消费 deps；shape Money 的 currency/encoding 固定，FieldDef default/comment 不发；Plan reserved nested 名列表未包含可选 SequenceShape/ManifestRefShape。哪些仅表达修正、哪些需要准入变更须逐项批准，不能在 JS 私自修 baseline 语义后宣称逐字一致。
- **D5 fixture 可达性**：完整 shape/多 producer-read/非同名 trigger 参数的 module fixture 是否能穿过后续 FixtureHostBuilder；若不能，必须有明确 scoped public generation/admission 合同，不能通过私有 import-and-call 冒充 CLI 同输入验收。
- **D6 公共接线/执行写面**：formal finite-host 与 reusable module 如何共用、legacy 是否继续消费、family 是否仅保留有限 bridge；现有 CLI 没本族独立选择器。captured implementation verifier 的具体子进程/缓存写面未读明，不允许将 generate-project --plan 宣称零副作用并运行。

文档可以独立交付；以上未决项阻断相应实施/验收，不阻断其它 artifact 写自己的规格。没有 implemented、ready、parity-PASS、behavior-PASS 或“全部已覆盖”的结论。

## 附录 A：完整 raw Scala Template 源码

与 [T:L1–279][T] 对应；保留实际源代码插值、类型/字符串槽和输出顺序。此段是生成器原始源码，不是已运行生成出的银行模块，也不是 approved-target 的已实现文件。

```scala
package net.imadz.codegen.scaffolding.cqrs.template.application.transactor

import net.imadz.codegen.scaffolding.cqrs.{FieldDef, TypeRef}
import net.imadz.codegen.scaffolding.cqrs.model.application.transactor._
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.execution._

/** Real strict runtime API; named technical mappers remain mandatory host obligations. */
object StrictSagaModuleTemplate extends CodeTemplate[StrictSagaModuleModel] {
  private def text(s: String): String = ujson.write(ujson.Str(s), escapeUnicode = true)
  private def id(s: String): String = NamingConventions.scalaIdentifier(s)
  private def tpe(t: TypeRef): String =
    t.fqn + (if (t.typeParams.isEmpty) "" else t.typeParams.map(tpe).mkString("[", ", ", "]"))
  private def fields(fs: Vector[FieldDef]): String = fs.map(f => id(f.name) + ": " + tpe(f.typeRef)).mkString(", ")
  private def pin(p: SagaRuntimeCodec): String = s"CodecPin(${text(p.id)}, ${p.version})"

  def generate(m: StrictSagaModuleModel): String = {
    val s = m.pinned.execution
    val addresses = m.steps.map(_.address).distinct
    val typeContracts = s.args.types.map { t =>
      val shape = t.shape match {
        case SagaTypeShape.Id(min, max) => s"BoundedText(\"id\", $min, $max)"
        case SagaTypeShape.Text(min, max) => s"BoundedText(\"text\", $min, $max)"
        case SagaTypeShape.Bool => "BooleanShape"
        case SagaTypeShape.Integer(min, max) => s"IntegerShape(${min}L, ${max}L)"
        case SagaTypeShape.Enumeration(values) => values.map(text).mkString("EnumerationShape(Vector(", ", ", "))")
        case SagaTypeShape.ValueObject(fs) => fs.map(f => s"SlotContract(${text(f.slot)}, ${text(f.typeId)})").mkString("ValueObjectShape(Vector(", ", ", "))")
        case SagaTypeShape.Money(scale, precision, codec, _, _) => s"MoneyShape($scale, $precision, ${text(codec.dottedPath)}, \"ISO-4217\", \"minor-unit-string\")"
        case SagaTypeShape.Collection(element, min, max) =>
          val elementShape = s.args.types.find(_.id == element).map(_.shape).getOrElse(throw new IllegalArgumentException("Missing collection element")) match {
            case SagaTypeShape.Id(a, b) => s"BoundedText(\"id\", $a, $b)"
            case SagaTypeShape.Text(a, b) => s"BoundedText(\"text\", $a, $b)"
            case _ => throw new IllegalArgumentException("Collection element must be bounded text")
          }
          s"SequenceShape($elementShape, $min, $max)"
        case SagaTypeShape.ManifestReference(true, version) => s"ManifestRefShape(${text(version)})"
        case _: SagaTypeShape.ManifestReference => throw new IllegalArgumentException("Unreadable manifest reference")
      }
      s"TypeContract(${text(t.id)}, ${text(t.canonicalType)}, ${text(t.implementation.dottedPath)}, $shape)"
    }.mkString("Vector(", ",\n    ", ")")
    def strings(xs: Seq[String]): String = xs.map(text).mkString("Vector(", ", ", ")")
    def inputContract(i: SagaInput): String = {
      val source = i.source match {
        case SagaValueSource.Args(slot) => s"ValueSource(\"args\", ${text(slot)}, \"\", \"\")"
        case SagaValueSource.SourceField(slot) => s"ValueSource(\"source-field\", ${text(slot)}, \"\", \"\")"
        case SagaValueSource.ReceiptField(slot) => s"ValueSource(\"receipt-field\", ${text(slot)}, \"\", \"\")"
        case SagaValueSource.TransactionId => "ValueSource(\"transaction-id\", \"\", \"\", \"\")"
        case SagaValueSource.StepReceipt(step, phase, slot) => s"ValueSource(\"step-receipt\", ${text(slot)}, ${text(step)}, ${text(phase.wire)})"
      }
      s"InputContract(${text(i.slot)}, ${text(i.typeId)}, $source)"
    }
    def inputs(xs: Vector[SagaInput]): String = xs.map(inputContract).mkString("Vector(", ", ", ")")
    def tech(p: StrictPhaseModel): String = {
      val x = p.technical
      s"""PhaseContract(${text(p.stepId)}, ${text(p.participantId)}, Phase.${x.phase.runtimeName}, ${text(x.port.dottedPath)},
    ${text(x.commandMapper.dottedPath)}, ${text(x.command.owner.targetName)}, ${text(x.command.contractName)},
    ${inputs(x.inputs)}, ${x.outputs.map(o => s"SlotContract(${text(o.slot)}, ${text(o.typeId)})").mkString("Vector(", ", ", ")")},
    ConfirmationContract(${text(x.confirmation.event.owner.targetName)}, ${text(x.confirmation.event.contractName)}, ${text(x.confirmation.mapper.dottedPath)}, ${inputs(x.confirmation.outputs)}),
    QueryContract(${text(x.query.mapper.dottedPath)}, "read-only", ${strings(x.query.identity.map(_.wire))}, ${strings(x.query.results.map(_.wire))}),
    ReceiptContract(${text(x.receipt.mapper.dottedPath)}, ${text(x.receipt.version)}, ${x.receipt.durable}, ${strings(x.receipt.identity.map(_.wire))}, "exact", "reservation-decision-effect-reconciliation"),
    IdempotencyContract(${text(x.idempotency.mapper.dottedPath)}, ${strings(x.idempotency.identity.map(_.wire))}, "reject", "excluded"),
    ${text(x.codecs.contractCodec.id)}, ${text(x.codecs.contractCodec.version)}, ${pin(x.codecs.runtimeCodec)})"""
    }
    def source(i: SagaInput, p: StrictPhaseModel): String = i.source match {
      case SagaValueSource.Args(slot) => s"request.args.${id(slot)}"
      case SagaValueSource.TransactionId => "request.identity.transaction.transactionId"
      case SagaValueSource.StepReceipt(step, phase, slot) =>
        val read = p.reads.find(r => r.producerStep == step && r.producerPhase == phase).get
        s"${read.local}.${id(slot)}"
      case _ => throw new IllegalArgumentException("Unsupported phase value source")
    }
    val phaseCode = m.phases.map { p =>
      val reads = p.reads.map { r =>
        s"""        val ${r.local} = request.receipt(
          OperationIdentity(request.identity.transaction, ${text(r.producerParticipant)},
            host.${r.producerAddress.member}(request.args.${id(r.producerAddress.resourceSlot)}), ${text(r.producerStep)}, Phase.${r.producerPhase.runtimeName}),
          ${pin(r.pin)}, host.${r.codecMember}.receiptCodec).get"""
      }.mkString("\n")
      val input = p.inputs.map(source(_, p)).mkString(", ")
      s"""  final case class ${p.inputType.name}(${fields(p.inputFields)})
  final case class ${p.receiptType.name}(${fields(p.outputFields)})
  val ${p.member}Contract: PhaseContract = ${tech(p)}
  trait ${p.stem}HostBinding {
    def contract: PhaseContract
    def receiptCodec: PayloadCodec[${p.receiptType.name}]
    def querySafety: QuerySafety
    def execute(identity: OperationIdentity, input: ${p.inputType.name}): Future[PhaseOutcome[${p.receiptType.name}]]
    def query(identity: OperationIdentity, input: ${p.inputType.name}): Future[PhaseOutcome[${p.receiptType.name}]]
  }
  private def ${p.member}Port(host: Host)(implicit ec: ExecutionContext): PhasePort[Args, ${p.receiptType.name}] = {
    val binding = host.${p.member}
    require(binding != null && binding.contract == ${p.member}Contract, "technical phase binding mismatch")
    val codec = binding.receiptCodec
    require(codec != null && codec.pin == ${pin(p.technical.codecs.runtimeCodec)}, "phase receipt codec pin mismatch")
    require(binding.querySafety == QuerySafety.DeclaredReadOnly, "read-only durable query required")
    new PhasePort[Args, ${p.receiptType.name}] {
      def receiptCodec: PayloadCodec[${p.receiptType.name}] = {
        require(binding.receiptCodec eq codec, "host receipt codec replacement")
        require(binding.contract == ${p.member}Contract, "technical phase binding drift")
        codec
      }
      def querySafety: QuerySafety = binding.querySafety
      private def input(request: OperationRequest[Args]): Future[${p.inputType.name}] = Future.fromTry(Try {
        require(request.identity.stepId == ${text(p.stepId)} && request.identity.participantId == ${text(p.participantId)} &&
          request.identity.phase == Phase.${p.technical.phase.runtimeName} &&
          request.identity.resource == host.${p.address.member}(request.args.${id(p.address.resourceSlot)}), "consumer identity mismatch")
$reads
        ${p.inputType.name}($input)
      })
      def execute(request: OperationRequest[Args]): Future[PhaseOutcome[${p.receiptType.name}]] =
        input(request).flatMap(value => binding.execute(request.identity, value))
      def query(request: OperationRequest[Args]): Future[PhaseOutcome[${p.receiptType.name}]] =
        input(request).flatMap(value => binding.query(request.identity, value))
    }
  }"""
    }.mkString("\n\n")
    val triggerCode = m.triggers.map { tr =>
      val e = tr.execution
      s"""  val ${tr.member}Contract = TriggerContract(${text(e.declaration.id)}, ${text(e.declaration.source.owner.targetName)},
    ${text(e.declaration.idempotency.sourceSlot)}, ${text(e.declaration.idempotency.typeId)}, ${inputs(e.declaration.args)},
    ${text(e.binding.argsMapper.dottedPath)}, ${text(e.binding.idempotencyMapper.dottedPath)}, "saga-version", "reject-different-args")
  trait ${NamingConventions.firstUpper(tr.member)}Binding {
    def contract: TriggerContract
    // Whole typed trigger, including the explicit idempotency source; never first/drop remaining.
    def map(source: ${tpe(tr.sourceType)}): TriggerStart
  }
  def ${tr.member}Start(source: ${tpe(tr.sourceType)}, host: Host, replyTo: ActorRef[StrictSagaCoordinator.Reply]): StrictSagaCoordinator.Start = {
    val binding = host.${tr.member}
    require(binding != null && binding.contract == ${tr.member}Contract, "trigger binding mismatch")
    val mapped = binding.map(source)
    require(mapped != null && mapped.transactionId != null && mapped.transactionId.nonEmpty, "stable host idempotency transaction id required")
    val codec = checkedArgsCodec(host)
    val bytes = codec.encode(mapped.args)
    require(bytes != null && codec.decode(bytes).map(codec.encode).get == bytes, "canonical trigger args required")
    require(codec.pin == ArgsPin, "args codec drift")
    StrictSagaCoordinator.Start(mapped.transactionId, bytes, replyTo)
  }"""
    }.mkString("\n\n")
    val completionCode = m.completions.map { c =>
      val values = c.execution.inputs.map { i => i.source match {
        case SagaValueSource.TransactionId => "identity.transactionId"
        case SagaValueSource.Args(slot) => s"args.${id(slot)}"
        case _ => throw new IllegalArgumentException("Unsupported completion source")
      }}.mkString(", ")
      s"""  final case class ${c.inputType.name}(${fields(c.fields)})
  val ${c.member}Contract = CompletionContract(${text(c.execution.kind.wire)}, ${text(c.execution.event.owner.targetName)},
    ${text(c.execution.event.contractName)}, ${text(c.execution.mapper.dottedPath)}, ${inputs(c.execution.inputs)})
  trait ${NamingConventions.firstUpper(c.member)}Binding {
    def contract: CompletionContract
    def map(identity: TransactionIdentity, input: ${c.inputType.name}): ${tpe(c.eventType)}
  }
  // Explicit mapping only: the host must observe the matching durable result and publish idempotently.
  def ${c.member}Event(identity: TransactionIdentity, args: Args, host: Host): ${tpe(c.eventType)} = {
    require(identity.definitionName == Name && identity.definitionVersion == Version && identity.definitionDigest == DefinitionDigest, "completion identity mismatch")
    val binding = host.${c.member}
    require(binding != null && binding.contract == ${c.member}Contract, "completion binding mismatch")
    binding.map(identity, ${c.inputType.name}($values))
  }"""
    }.mkString("\n\n")
    val participantCode = m.steps.map { p =>
      val bindings = p.phases.map(ph => s"Phase.${ph.technical.phase.runtimeName} -> PhaseBinding(${ph.member}Port(host))").mkString(", ")
      s"""      StrictParticipant[Args](${text(p.stepId)}, ${text(p.participantId)}, host.${p.address.member}(args.${id(p.address.resourceSlot)}), Map($bindings))"""
    }.mkString(",\n")
    val addressContracts = addresses.map(a => s"  val ${a.member}Contract = AddressContract(${text(a.participant)}, ${text(a.resourceSlot)}, ${text(a.addressing.resourceType)}, ${text(a.addressing.aggregate.targetName)}, ${text(a.addressing.resolver.dottedPath)}, \"exact-resource\")").mkString("\n")
    val addressChecks = addresses.map(a => s"    require(host.${a.member}Contract == ${a.member}Contract, \"exact resource binding mismatch\")").mkString("\n")
    val hostMembers = addresses.flatMap(a => Vector(
      s"    def ${a.member}Contract: AddressContract",
      s"    def ${a.member}(resource: ${tpe(a.resourceType)}): String // pure exact-resource addressing; no I/O")) ++
      m.phases.map(p => s"    def ${p.member}: ${p.stem}HostBinding") ++
      m.triggers.map(t => s"    def ${t.member}: ${NamingConventions.firstUpper(t.member)}Binding") ++
      m.completions.map(c => s"    def ${c.member}: ${NamingConventions.firstUpper(c.member)}Binding")
    val collectionShapes = if (s.args.types.exists(t => t.shape.isInstanceOf[SagaTypeShape.Collection] || t.shape.isInstanceOf[SagaTypeShape.ManifestReference]))
      "\n  final case class SequenceShape(element: ValueShape, minItems: Int, maxItems: Int) extends ValueShape\n  final case class ManifestRefShape(version: String) extends ValueShape" else ""
    val blockers = s.blocked.map(text).mkString("Vector(", ", ", ")")
    val hostRequirements = s"""HostRequirements(${strings(s.host.capabilities.map(_.capability))}, ${s.host.totalDeadline.totalTimeoutMs},
    ${s.host.admission.maxParticipants}, ${s.host.admission.maxInFlight}, ${s.host.admission.maxItemsPerChunk},
    ${s.host.admission.manifest.durable}, ${strings(s.host.businessInvariants)},
    "durable-before-commit", "durable-before-compensate", "forward-recovery", "reconcile-before-resume",
    "confirmed-reservations", "empty-release-and-fence", "stable-operation", "authorized-reconciliation-evidence",
    ${s.contract.definition.payload.resilience.maxAttempts}, ${s.contract.definition.payload.resilience.phaseTimeoutMs},
    ${s.contract.definition.payload.resilience.queryTimeoutMs}, ${s.contract.definition.payload.resilience.backoffMs})"""
    s"""package ${m.selfType.packageName}

import akka.actor.typed.{ActorRef, Behavior}
import akka.persistence.typed.PersistenceId
import net.imadz.infra.saga.strict._
import scala.concurrent.{ExecutionContext, Future}
import scala.util.Try

/** Generated/buildable candidate; NOT runtime verified. No production dependency is selected.
  * Host adapters must implement all named technical mappers and durable outcomes; FQN is not an ABI.
  * Independent strict persistence namespace, admission/deadline enforcement and idempotent completion
  * publication remain host obligations. Upstream blocked/readiness flags are not rewritten. */
object ${m.selfType.name} {
  val Name = ${text(s.runtimeIdentity.name)}
  val Version = ${m.pinned.pins.runtimeVersion}
  val DefinitionDigest = ${text(s.definitionDigest)}
  val ArgsPin = ${pin(m.pinned.pins.argsCodec.runtimeCodec)}
  val CandidateArtifact = ${text(s.target.artifact)}
  val ArtifactStatus = ${text(s.target.artifactStatus)}
  val UpstreamRunnable = ${s.runnable}
  val UpstreamRuntimeBindingVerified = ${s.runtimeBindingVerified}
  val UpstreamBlocked = $blockers
  final case class Args(${fields(m.argsFields)})
  final case class TriggerStart(transactionId: String, args: Args)
  final case class AddressContract(participant: String, resourceSlot: String, resourceType: String, aggregate: String, resolverFqn: String, mode: String)
$addressContracts
  final case class ValueSource(kind: String, slot: String, producerStep: String, producerPhase: String)
  final case class SlotContract(slot: String, typeId: String)
  final case class InputContract(slot: String, typeId: String, source: ValueSource)
  final case class ConfirmationContract(aggregate: String, event: String, mapperFqn: String, outputs: Vector[InputContract])
  final case class QueryContract(mapperFqn: String, mode: String, identity: Vector[String], results: Vector[String])
  final case class ReceiptContract(mapperFqn: String, version: String, durable: Boolean, identity: Vector[String], compatibility: String, evidence: String)
  final case class IdempotencyContract(mapperFqn: String, identity: Vector[String], payloadConflict: String, attempt: String)
  final case class PhaseContract(step: String, participant: String, phase: Phase, portFqn: String,
    commandMapperFqn: String, aggregate: String, command: String, inputs: Vector[InputContract], outputs: Vector[SlotContract],
    confirmation: ConfirmationContract, query: QueryContract, receipt: ReceiptContract, idempotency: IdempotencyContract,
    contractCodecId: String, contractCodecVersion: String, receiptPin: CodecPin)
  final case class TriggerContract(id: String, aggregate: String, idempotencySource: String, idempotencyType: String,
    args: Vector[InputContract], argsMapperFqn: String, idempotencyMapperFqn: String, scope: String, conflict: String)
  final case class CompletionContract(kind: String, aggregate: String, event: String, mapperFqn: String, inputs: Vector[InputContract])
  final case class TypeContract(id: String, canonicalType: String, implementationFqn: String, shape: ValueShape)
  sealed trait ValueShape
  final case class BoundedText(kind: String, minLength: Int, maxLength: Int) extends ValueShape
  case object BooleanShape extends ValueShape
  final case class IntegerShape(minimum: Long, maximum: Long) extends ValueShape
  final case class EnumerationShape(values: Vector[String]) extends ValueShape
  final case class ValueObjectShape(fields: Vector[SlotContract]) extends ValueShape
  final case class MoneyShape(scale: Int, precision: Int, codecFqn: String, currency: String, encoding: String) extends ValueShape$collectionShapes
  val RequiredTypes: Vector[TypeContract] = $typeContracts
  final case class ArgsCodecContract(mapperFqn: String, id: String, version: String, compatibleVersions: Vector[String], runtimePin: CodecPin)
  val RequiredArgsCodec = ArgsCodecContract(${text(s.args.codec.mapper.dottedPath)}, ${text(s.args.codec.id)}, ${text(s.args.codec.version)}, ${strings(s.args.codec.compatibleVersions)}, ArgsPin)
  final case class HostRequirements(capabilities: Vector[String], totalDeadlineMs: Int, maxParticipants: Int,
    maxInFlight: Int, maxItemsPerChunk: Int, durableManifest: Boolean, businessInvariants: Vector[String],
    commitDecision: String, abortDecision: String, afterCommit: String, unknown: String, compensation: String,
    cancelBeforePrepare: String, retryIdentity: String, manualRecovery: String,
    maxAttempts: Int, phaseTimeoutMs: Int, queryTimeoutMs: Int, backoffMs: Int)
  val RequiredHost = $hostRequirements
  trait Host {
    def argsCodec: PayloadCodec[Args] // canonical codec: ${s.args.codec.mapper.dottedPath}, ${s.args.codec.version}
    def settings: StrictSagaCoordinator.Settings // explicit reconcile budget; no guessed default
    // Fail closed when deadline/admission/retry/capability or named mapper ABI implementation is unavailable.
    // Returning normally is a host declaration, not runtime certification by generated code.
    def requireImplemented(requirements: HostRequirements, types: Vector[TypeContract], argsCodec: ArgsCodecContract): Unit
    def requireIndependentNamespace(persistenceId: PersistenceId): Unit
${hostMembers.mkString("\n")}
  }
  private def checkedArgsCodec(host: Host): PayloadCodec[Args] = {
    require(host != null && host.argsCodec != null, "host canonical args codec required")
    host.requireImplemented(RequiredHost, RequiredTypes, RequiredArgsCodec)
$addressChecks
    val codec = host.argsCodec
    require(codec.pin == ArgsPin, "args codec pin mismatch")
    codec
  }

$phaseCode

$triggerCode

$completionCode

  def definition(host: Host)(implicit ec: ExecutionContext): StrictSagaDefinition[Args] = {
    val codec = checkedArgsCodec(host)
    StrictSagaDefinition[Args](Name, Version, DefinitionDigest, codec, args => Vector(
$participantCode))
  }
  def behavior(persistenceId: PersistenceId, host: Host, authorizer: ReconcileAuthorizer)(implicit ec: ExecutionContext): Behavior[StrictSagaCoordinator.Command] = {
    require(persistenceId != null && authorizer != null, "explicit persistence id and authorizer required")
    host.requireIndependentNamespace(persistenceId)
    val settings = host.settings
    require(settings != null && settings.interactionTimeout.toMillis == ${s.coordinator.interactionTimeoutMs}, "coordinator timeout pin mismatch")
    StrictSagaCoordinator(persistenceId, definition(host), authorizer, settings)
  }
}
"""
  }
}
```

## 固定引用索引

所有技术源码来自 baseline；此次没有读取未入 baseline 的额外当前生产源，`extraSources = []`。强制阅读的 AGENTS/作者合同/布局标准/批准计划属于本任务给定指导，不以可变指导替代固定技术证据。

[M]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/transactor/StrictSagaModuleModel.scala#L1-L28
[B]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/transactor/StrictSagaModuleBuilder.scala#L1-L61
[T]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/StrictSagaModuleTemplate.scala#L1-L279
[T11]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/StrictSagaModuleTemplate.scala#L11-L72
[T73]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/StrictSagaModuleTemplate.scala#L73-L117
[T118]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/StrictSagaModuleTemplate.scala#L118-L139
[T140]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/StrictSagaModuleTemplate.scala#L140-L160
[T161]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/StrictSagaModuleTemplate.scala#L161-L182
[T183]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/StrictSagaModuleTemplate.scala#L183-L239
[T240]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/StrictSagaModuleTemplate.scala#L240-L256
[T264]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/StrictSagaModuleTemplate.scala#L264-L275
[P]: ../baseline/bc/src/main/scala/net/imadz/codegen/StrictSagaGenerationPlan.scala#L1-L101
[P44]: ../baseline/bc/src/main/scala/net/imadz/codegen/StrictSagaGenerationPlan.scala#L44-L99
[F]: ../baseline/js/generators/scala-cqrs-application/render-host.mjs#L1-L59
[L]: ../baseline/js/generators/saga-dsl/emit-strict.mjs#L1-L946
[FM]: ../baseline/js/generators/scala-cqrs-saga-monarch-v1/build-models.mjs#L35-L100
[FT]: ../baseline/js/generators/scala-cqrs-saga-monarch-v1/templates/saga.mjs#L1-L134
[A]: ../baseline/actual-js/app/example/bankwealth/application/bank_payment_hostDefinition.scala#L1-L376
[AX]: ../baseline/actual-js/app/example/bankwealth/application/bank_cash_payment_v1Execution.scala#L1-L67
[C]: ../baseline/curated-scala/net/imadz/application/services/transactor/MoneyTransferSagaDefinition.scala#L1-L71
