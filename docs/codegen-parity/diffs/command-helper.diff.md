# command-helper：命令参数与回复胶水的内容规格

## 1. 身份、边界与证据等级

- artifact id / group：`command-helper`，传统清单第 10 族；状态：**`decision-required`**。
- 本文是已批准的文档阶段交付，不是生成器实现、同输入对账结果或运行验收。仅创建本文及 `details/command-helper.json`；不修改此前其他 diff、生产代码、银行生成物、真源、baseline、catalog、ledger 或 anchors。
- 固定 BC HEAD：`cc335eb1e0d0fae17bf092fd61b126040196ea70`；固定 JS HEAD：`bf104e16ab82ef39d7fa416d0997907d18a815ad`。准确内容身份以 [baseline/index.json](../baseline/index.json) 的 `source/snapshot/bytes/sha256` 为准，不能以 HEAD 替代工作树字节。
- 已完整读取本族 Model、Builder、Template；下文给出字段、分支、输出构造及 RHS 账，附录保留全文。运行库、调用者、现存输出均读冻结副本；没有额外读取未入 baseline 的生产源码，`extraSources=[]`。按要求读取的作者合同、布局标准、批准计划和仓库 AGENTS 是本次指令输入，不当成产品源码证据。
- **没有 fresh same-input outputs**。`raw-scala` 在本次可取得的是 MBT 的完整源字节与输出规则，不是新执行的产物；`curated-scala` 是人工完成参考；`actual-js` 是银行已有文件；`approved-target` 是已确认约束与有限参考示例，不是银行已完成实现。以下跨输入比较一律是结构性对照。
- 决策未定仍独立保存观察内容；不将未完成算法、缺少回复定义或缺少 JAR 能力写成成功。CC 状态为 `not-measured`。

### 1.1 固定全文与内容指纹

以下核心副本已只读核对 bytes/SHA，与 index 一致。这只是来源完整性检查。

|证据|固定全文（链接行号不是可变生产路径）|bytes|SHA-256|
|---|---|---:|---|
|M|[CommandHelperModel.scala][M]|1632|`28beb61c8e41ee35cb481eedeea2ca5004c73f7e7290f9d26584965621ab3fd0`|
|B|[CommandHelpersBuilder.scala][B]|7685|`6a46c0d8420639ec87352e1c26f20f2ac5bea541d8fc7b1e15af5e9218db44fb`|
|T|[CommandHelpersTemplate.scala][T]|3284|`999303df54f728e2096789493a7d07b3f8d41ed1b5d3f25b99b0589d02536d1c`|
|formal JS|[render-domain.mjs][J]|12461|`98181f044826dd2e45ec4179f030a2de2a47326601f3af9a153df2d96dc09e43`|
|legacy JS|[command-dsl/render.mjs][L]|4164|`46c7844cfcb50754807c3901c419b9a1f88eaf4d8d11a9610798c37574d98907`|
|family2 T|[templates/command-helpers.mjs][FT]|1493|`3178b2be12efb80a7af89970df2f72d21ccdd871110ff631ba29e84c0e747c3d`|
|人工参考|[CreditBalanceCommandHelpers.scala][C]|5746|`ec0c4f05e9398b8fd8aa1a93d6aafbe10a845e687bdffc27d3510e51a177d531`|
|common 实际库源码|[CommandHandlerReplyingBehavior.scala][G]|4380|`2af0b26def49ccf43a23413642fa92bae2233a605b9bb84690ce68e16b0f8852`|
|人工参考附带胶水|[curated CommandHandlerReplyingBehavior.scala][CG]|3654|`92ac1e9005ddf70d8665edea2211b1c06cf48374e51b0c765cabd2831a90eee4`|
|银行 CreditBalance|[完整现存文件][AC]|2124|`2ca13177769ec883420e90770ef16a8cdb68188311c4f31d6777fe6a80342203`|
|银行 FundOrder|[完整现存文件][AF]|5638|`fea12f848f3dc1c921ce2a4e38e8a7b364988c4e81d4dbee96e88819cb61090b`|
|银行 SipPlan|[完整现存文件][AS]|3639|`cea410364e9391c2bdc0d6047ebb5da86f5724d5243ab0b77b5d8c38e8077211`|

后三项原始位置分别是银行 `generated/current/app/example/bankwealth/domain/{CreditBalance,FundOrder,SipPlan}CommandHelpers.scala`，本文没有读取或更改它们的当前工作副本。

## 2. Scala 调度、输出基数与路径

传统入口：[CodegenMain.run L183–201](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L183) 先区分 `semanticProductsFile` 支路；本族属于另一个 `prepare → scaffold copy → CQRSApplicationGenerator.generate/generateAdmitted` 分支，[L232–250](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L232)。不能用 `template/products` 的实现替代这里的基准。

`runCommon` [L192–220](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L192) 构造 `GeneratorContext`，按 domain/application/infrastructure/interface 顺序调度。应用层逐 `app.aggregates` 顺序先 root、protocol、factory、behavior，再执行 [L660–678](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L660)。

|variant|精确条件|模型/计划输出|物理输出与状态|
|---|---|---|---|
|普通写命令|聚合 `metaCategory != "application.services.transactor"`，无可选中的 formal reply|每聚合一个 `CommandHelpersModel`；每个 `!isReadOnly` 命令一个 implicit object|enabled，未新生成|
|formal 单槽回复|同上；`formalSemantics.aggregates.find(_.aggregate == meta.name)` 存在、`guards.nonEmpty || emissions.nonEmpty`、且 `meta.replyFamily.replies.headOption` 存在|文件基数不变；该聚合全部写命令使用首回复及 `<Cmd>Params`|enabled，未新生成；不是“只要有 formalSemantics 就启用”|
|formal 缺首回复|formal guard/emission 在场，但回复族为空|`formalReplyName=None`，退回普通推断；不是单独强制报错|raw 行为必须暴露，目标是否拒绝见 D1/D5|
|只读混合|存在 `isReadOnly=true` 命令|只读命令无 helper；其余保持命令原顺序|helper suppressed；只读回复由 behavior 负责|
|无写命令|非 transactor 聚合，过滤后 helpers 为空|raw 仍构造一个 trait 文件，依赖仍加 `CommandHelper`|raw enabled-empty；目标是否抑制空文件见 D8|
|Saga/transactor|`metaCategory == "application.services.transactor"`|本族 Builder/Template 不调用，0 文件|suppressed，不能套用 legacy `sagaFace` 擅自恢复|
|scope 排除|writer 的 `currentScope.includes(attribution)` 为 false|writer 先记录 ledger/morphisms，随后 return|内容不写；不是 Builder 没运行|

命名：`NamingConventions.getCommandHelperNameFromAggregateName` [L589–590](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L589) = 去 `Aggregate` 后缀后的 base + `CommandHelpers`；`TypeResolverDSL.commandHelper` [L614–629](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L614) 固定 `application.aggregates.behaviors`，不是 domain。

物理根：[writeArtifact L359–412](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L359) 以 `selfType.packageName.replace('.', '/')` 和 `selfType.name + ".scala"` 定位。

- single：`<target>/app/<base-path>/application/aggregates/behaviors/<AggregateBase>CommandHelpers.scala`。
- raw multi：[targetModuleOf L331–349](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L331) 将 kind `command-helpers` 分给 `kernel`，所以是 `<target>/modules/kernel/src/main/scala/<base-path>/application/aggregates/behaviors/<AggregateBase>CommandHelpers.scala`。不要因其 application 职责而伪报 raw 路径为 glue。
- 本文首个拟验收 profile 为 single。银行未来完整文件路径相对于独占 `<target>` 为 `app/example/bankwealth/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala`、`FundOrderCommandHelpers.scala`、`SipPlanCommandHelpers.scala`；后两者与前者同目录。multi 目标模块裁定另见 D6，业务根包下面始终仅 domain/application/infrastructure 三层。
- writer attribution 精确为 `ArtifactAttribution("command-helpers", meta.name, "aggregate", List(meta.name))`。`noteIds` 与结构依赖入账；模板本身不发 `@knowledge`。fingerprint header 属 writer，不属于 Template 的 `sourceCode`。

## 3. Model 全字段与共享结构

[M L7–26][M] 有两个不同 case class，只有外层是 `ArtifactModel`。字段无可选性的地方不允许 JS 靠缺键猜默认。

|顺序|模型字段 / 类型|默认与来源|JS 对应差距 / 目标义务|
|---:|---|---|---|
|M1|`CommandHelpersModel.selfType: TypeRef`，`override val`|无默认；B12 命名/布局 resolver|formal 只有 `pkg/name` 局部字符串；应保留结构化 selfType|
|M2|`helpers: Seq[CommandHelperModel]`|无默认；B41 保序过滤命令|formal 是 emission commands，不是此模型；legacy 排字母，非 Scala 保序|
|M3|`dependencies: Set[TypeRef]`，`override val`|无默认；B133–139|formal `entry.deps` 是文件路径，不等于 import 类型集；二者都需保留|
|M4|`noteIds: Seq[String]`，`override val`|`Nil`；B141 = `meta.noteId.toSeq`|JS `knowledgeIds/source` 可映射但不可用源码名制造知识 ID|
|H1|`CommandHelperModel.name: String`|无默认；`cmd.name + "Helper"`|PascalCase implicit object 名；resolver 统一转义/碰撞处理|
|H2|`commandType: TypeRef`|无默认；`CommandRef(cmd.name)`|应用 Actor 命令，不是 domain event/request 共用载体|
|H3|`stateType: TypeRef`|无默认；`meta.stateRef`|domain Entity 内嵌 State；方法成功臂使用更新后的 State|
|H4|`paramType: TypeRef`|无默认；formal class / 单字段 / Tuple / Unit|不是无条件 `<Cmd>Params`，不夹带 ActorRef|
|H5|`replyType: TypeRef`|无默认；formal / behavior / legacy replyTo / Unit|必须对齐 ActorRef 的真实回复合同，不能无条件 `Reply(None)`|
|H6|`errorType: TypeRef`|无默认；`knownFrameworkTypes("iMadzError")`|目标保留；raw 模板方法形参却硬编码 `iMadzError`，见 D5|
|H7|`toParamLogic: String`|无默认；B73–94|明确源码字符串槽，不是假称完全结构化；不得扩张为整个文件 `content`|
|H8|`failureReplyLogic: String`|无默认；B115–119|明确源码字符串槽；不得吞掉错误或默认成功|
|H9|`successReplyLogic: String`|无默认；B110–114|明确源码字符串槽；需要时允许读取 State，而不是仅回传 Param|

[ArtifactModel L5–47](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L5) 的继承内容也保留：`fqn = selfType.packageName + "." + selfType.name`；`registerTo(registry) = registry.register(this)`；`morphisms = Nil`；`noteIds = Nil` 被外层覆盖。本族未重写注册以单独注册内部 helper，未声明成员级 noteIds/morphisms。单 helper 本身没有继承、默认值、annotation、状态或 I/O。

[TypeRef L4–72](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4) 的依赖合同：

- `name: String, packageName: String, typeParams: Seq[TypeRef] = Nil`；`fqn` 不含泛型参数，包空时为 name。
- `signature`：`Tuple` 后为数字且有 typeParams 时渲染 `(T1, T2, ...)`；否则非空参数为 `Name[T1, ...]`；无参为 name。此 Tuple 判据没有检查 package，不能自行写成另一个规则却称 raw 相同。
- `collectAllDependencies` 递归含自身；`shouldImport` 排除空包、当前包、精确 `scala`、精确 `java.lang`。本 Builder 对 Param/Reply 自己用 `expandTypeRefs`，不是对五个类型一律调用该方法。
- `parameterType(MetaType)` 委托 [TypeResolver L19–90](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala#L19)：primitive 常量；StructRef 经 nested owner 或 domain.values；CustomType 优先 framework map 并递归泛型，未知时保留包（旧 `net.imadz.domain.values` 特例改成当前 values 包）；未知 MetaType 回退 Any。`resolveMetaRef` [L93](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala#L93) 仍为 `???`，不得伪造完成实现。
- State 使用 [TypeResolverDSL L140–150](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L140)，真实结果是 Entity 的 FQN 下嵌套 State；不能照 TypeResolver 的旧注释称其总是独立 VO。Command/Reply 根据 symbol table owner 定位 Protocol，见 [L556–609](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L556)；无 owner 时回 application.aggregates。通用 `resolve(MetaRef)` [L1119–1151](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L1119) 另有 `SagaContextRef => ???`，保留为不支持槽，不构造假 Any 成功。

## 4. Builder 按实际执行顺序的分支账

完整源码见 [B][B] 与附录 B。下表是执行规则，不把源码历史注释中“可编译”“实测”等措辞当本轮证据。

|id / 行|输入、推导、分支和 RHS|影响 / 目标处理|
|---|---|---|
|B1 / 11–15|先 `pkg=layout.application.aggregates.behaviors`；解析 selfType、stateType、`knownFrameworkTypes("iMadzError")`|map 用 `apply`，缺框架键不会静默补类型|
|B2 / 18|`resolveByName[AggregateBehaviorMetadata](meta.behaviorRef.targetName)`|Option 无结果可继续；不据文件名猜 behavior|
|B3 / 22–25|查 exact `meta.name` 的 formal aggregate → guards 或 emissions 非空 → 回复族 headOption|仅回复**首项名字**；并未核验回复实际是否只有 error 槽|
|B4 / 28–36|有 behavior 时按 behaviors→flows 展平；每 flow 取 `replyMapping.successReplyRef` 用 resolver，键为 `flow.commandRef.targetName`，`.toMap`；无 behavior 为 `Map.empty`|同名 command 后出现 flow 覆盖前值；即使 formal 最终优先，此 map 仍先构造并解析；failureReplyRef 不参与选择|
|B5 / 41–46|`commands.filterNot(_.isReadOnly).map`；`command(CommandRef(cmd.name))`；formalName 映射为 `(rn, commandReply(CommandReplyRef(rn)))`|命令保输入次序；不按名排序|
|B6 / 47–50|内部 `if(cmd.isReadOnly)` 使用 `cmd.replyToType.map(resolve).getOrElse(any)`|在 B5 过滤后的正常集合中不可达；要记下，不能说 readonly Helper 已支持|
|B7 / 54–67|写命令依次选 formal reply、commandReplyMap、`cmd.parameters.find(_.name=="replyTo")`；最后只接受 `CustomType(_,_,args)` 且 args 非空，`args.head.asInstanceOf[MetaRef].targetName` → `resolve(StructRef(rawName))`；其他 None；全无则 Unit|不是按 `cmd.replyToType` 推断写命令；没核验 CustomType 确为 ActorRef；cast 可能失败；不与正式 typed replyTo 混签|
|B8 / 73–78|formalName 存在时 `paramsName=s"${cmd.name}Params"`；包/owner=`s"${layout.domain.invariants.root}.${meta.name}Rules"`；过滤名字为 replyTo 的参数，按原序 `command.<name>` 逗号拼接；body=`Params(args)`|不是 legacy `.domain.invariant.params.<Agg>RuleParams`；0 参数仍构造命名 Params()|
|B9 / 79–94|非 formal：排除 replyTo 后 1 参数 → resolver.parameterType 与 `command.p`；多参数 → tupleTypes、`tuple(tupleTypes)`、`(command.p1, command.p2, ...)`；无 payload → `TypeRef.Unit` 与 `()`|Tuple 顺序不能重排；`tuple` [L809–814](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L809) 空→scala.Unit，非空→scala.TupleN，但本多参数支路不传空|
|B10 / 96|`helperName = s"${cmd.name}Helper"`|raw 直接拼接，不做 command spelling 规范化|
|B11 / 106–109|`replyIsUnit = replyTypeRef.name == "Unit"`；`formalSingleSlot = formalReply.exists(_._2.name == replyTypeRef.name)`|都是 name 判据，不检查 FQN/构造器字段形状；名为 Unit 的非 Unit nominal 也可能误中|
|B12 / 110–114|success：Unit→`()`；formalSingleSlot→`Reply(None)`；param.name startsWith Tuple→`Reply(param._1, None)`；否则→`Reply(param, None)`|机械默认；不使用新 state；并不是 curated Deposit 的余额回复|
|B13 / 115–119|failure：Unit→`()`；formalSingleSlot→`Reply(Some(error))`；Tuple→`Reply(param._1, Some(error))`；否则→`Reply(param, Some(error))`|机械默认；位置实参需匹配真实 Reply 构造器，不保证任何回复类型均可编译|
|B14 / 121–129|构造 named arguments：name, commandType, stateType, paramType, replyType, errorType, toParamLogic, successReplyLogic, failureReplyLogic|模型定义 H8/H9 顺序是 failure 在 success 前；此处 named args 顺序不同不改变绑定|
|B15 / 133–139|`expandTypeRefs(t)=t +: t.typeParams.flatMap(expandTypeRefs)`；每 helper 收集 Set(Command,State,Error) 加展开 Param/Reply；按 pkg.shouldImport 过滤转 Set；最后强加 known CommandHelper|Command/State/Error 的泛型依赖没有递归展开；最后加 CommandHelper 不再走 shouldImport；不把 source string 中额外符号自动当已收集|
|B16 / 141|`CommandHelpersModel(selfType, helpers, dependencies, noteIds=meta.noteId.toSeq)`|只有聚合 noteId；无 helper body/source-field 定位细粒度输出|

另一个必须裁定的接口边缘：B84/B86 只看 `p.parameterType`，没有读取 `p.optional`；而 [AggregateProtocolBuilder L43–68](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateProtocolBuilder.scala#L43) 对 optional 应用命令字段加 `Option[T] = None`。非 formal 单字段 Helper 可能声明 T 却投影出 Option[T]；不能在“移植默认”时隐去该缺口（D2/D5）。

## 5. Template 输出 construct / RHS 账

[T][T] 是全文基准；它的重复 import 是生成器源码的重复，不会自动成为生成 Scala 的重复 import。

|顺序 / id|源位置|最终输出构造、签名、RHS 与顺序|JS/目标处理|
|---|---|---|---|
|T1|13、85|`package ${model.selfType.packageName}`|固定 application.aggregates.behaviors；package 不是从文件后处理猜出|
|T2|16–24、87|dependencies 转 List → 按 fqn 排序 → map fqn → 排除空串、`startsWith("scala")`、`startsWith("java.lang")` → distinct → imports|这是宽前缀过滤，比 TypeRef.shouldImport 更宽；不能默默把 `scala.concurrent` 等依赖删掉后宣称正确。目标冲突/导入规则由 shared owner 裁定|
|T3|69–77|先 traitComment：两行“胶水代码库… / 这里是 AI 填空的主要战场。”，再 `trait ${selfType.name} {`|无泛型、父类、主/辅构造器、self-type、annotation、companion、type alias、val/var/lazy 字段|
|T4|27–35、45|按 model.helpers 顺序循环；每个 `implicit object ${name} extends CommandHelper[Command.signature, State.signature, Param.signature, Reply.signature] {`|四类型参数按 T/S/P/R；没有 variance、上下界或父构造实参；不是一个 emit object|
|T5|46–50|`override def toParam(state: State.name, command: Command.name): Param.signature = {` → BEGIN MANUAL → `toParamLogic` + 尾注释 `// 机械骨架·自定义时改此行` → END MANUAL → `}`|单参数列表；无默认值/implicit 参数；body 原样插槽，不自动验证语义|
|T6|52–56|`override def createFailureReply(param: Param.signature)(error: iMadzError): Reply.name = {`，同样 MANUAL 包 `failureReplyLogic`|两个柯里化列表；errorType 没用来输出形参；Reply.name 丢泛型，列 D5|
|T7|58–62|`override def createSuccessReply(param: Param.signature)(state: State.name): Reply.name = {`，MANUAL 包 `successReplyLogic`|两个柯里化列表；新 state 由库 thenReply 提供，Template 自身不 persist/reply|
|T8|63–66、79–93|关闭每个 object；helper 字符串 `mkString("\n")`；放入 trait 空行间，关闭 trait；package/import/trait 再以源码字符串中的空行拼接，末尾 newline|完整比较保留这些空行与声明顺序；不使用压平空白 normalize|

必须保留的真实债务：B102 注释称机械骨架在 MANUAL **之外**，但 T47–61 明确把三个默认 body 放在 MANUAL **之内**。采用可观察模板行为记账，不能因注释而删除保护块。传统默认并非裸 `???`；`???` 仍可能来自共享 resolver/其他实现槽，不能统一替成 `()`、`None` 或假成功。本文件也没有 Rule 的执行、Event 的创建或 Actor 的生命周期代码。

## 6. raw-scala、人工参考与 approved-target 分账

### 6.1 有限偏差与未定部分

|面|raw-scala|人工 curated-scala|approved-target / 决策|
|---|---|---|---|
|布局|application.aggregates.behaviors|相同|必须相同；三层下无第四个 service/web/integration 层|
|三方法|有，body 为 B 的代码槽|有，body 人工完成|不可省略；body 来源/所有权需 D4 明确|
|Deposit|非 formal 单 Money 参数时，机械回复为 `Reply(param, OptionError)`|`CreditBalanceConfirmation(Some(error), Nil)` / `CreditBalanceConfirmation(None, state.accountBalance.values.toList)`|用户点名的余额回复语义必须保留；不能推广到基金/定投|
|formal|参数类位于 `<meta.name>Rules` 下；回复族首项的单 error 槽假设|不是此通用 formal 规则的证明|是否可用由真实 Params/Reply 模型裁定，D1/D2|
|声明顺序|metadata command 原序；无业务组标题|Direct / Reservation / Incoming Credit 分组，组内固定原文顺序|支持明确业务分组；不得由字母排序或 external/query/execution 机械分组取代作者顺序|
|MANUAL|三个方法各一块|参考无 MANUAL|缺省保留 raw 保护义务；是否采用外置手写实现捕获由 D4 决定，不趁迁移覆盖人工 body|
|类型/导入|name/signature 混用；依赖有限递归；前缀排除|具体非泛型样例|准确类型/导入是目标，通用修正规格由 D5/shared owner 固定；不将名义类型合并|

### 6.2 人工参考完整成员账

[完整人工文件 L1–95][C]，不是当前银行文件。公共 imports 按原文顺序是 `net.imadz.application.aggregates.CreditBalanceProtocol._`、`net.imadz.common.CommonTypes.{Id, iMadzError}`、`net.imadz.common.application.CommandHandlerReplyingBehavior.CommandHelper`、`net.imadz.domain.entities.CreditBalanceEntity._`、`net.imadz.domain.values.Money`。随后相同 trait 注释与 `trait CreditBalanceCommandHelpers`。

每行均为 `implicit object <Command>Helper extends CommandHelper[<Command>, CreditBalanceState, P, R]`。三个方法的签名形状同 T5–T7；以下给出所有 P/R 与完整表达式。

|行 / 组|Command；P；R|toParam|createFailureReply|createSuccessReply|
|---|---|---|---|---|
|17–24 / Direct|AddInitial；Money；CreditBalanceConfirmation|`command.initial`|`CreditBalanceConfirmation(Some(error), Nil)`|`CreditBalanceConfirmation(None, state.accountBalance.values.toList)`|
|26–33 / Direct|Withdraw；Money；CreditBalanceConfirmation|`command.change`|`CreditBalanceConfirmation(Some(error), Nil)`|`CreditBalanceConfirmation(None, state.accountBalance.values.toList)`|
|35–42 / Direct|Deposit；Money；CreditBalanceConfirmation|`command.change`|`CreditBalanceConfirmation(Some(error), Nil)`|`CreditBalanceConfirmation(None, state.accountBalance.values.toList)`|
|46–52 / Reservation|ReserveFunds；(Id, Money)；FundsReservationConfirmation|`(command.transferId, command.amount)`|`FundsReservationConfirmation(param._1, Some(error))`|`FundsReservationConfirmation(param._1, None)`|
|54–60 / Reservation|DeductFunds；Id；FundsDeductionConfirmation|`command.transferId`|`FundsDeductionConfirmation(param, Some(error))`|`FundsDeductionConfirmation(param, None)`|
|62–68 / Reservation|ReleaseReservedFunds；Id；FundsReleaseConfirmation|`command.transferId`|`FundsReleaseConfirmation(param, Some(error))`|`FundsReleaseConfirmation(param, None)`|
|72–78 / Incoming Credit|RecordIncomingCredits；(Id, Money)；RecordIncomingCreditsConfirmation|`(command.transferId, command.amount)`|`RecordIncomingCreditsConfirmation(param._1, Some(error))`|`RecordIncomingCreditsConfirmation(param._1, None)`|
|80–86 / Incoming Credit|CommitIncomingCredits；Id；CommitIncomingCreditsConfirmation|`command.transferId`|`CommitIncomingCreditsConfirmation(param, Some(error))`|`CommitIncomingCreditsConfirmation(param, None)`|
|88–94 / Incoming Credit|CancelIncomingCredit；Id；CancelIncomingCreditConfirmation|`command.transferId`|`CancelIncomingCreditConfirmation(param, Some(error))`|`CancelIncomingCreditConfirmation(param, None)`|

该参考没有 `InitializeAccount`、基金 TA/退款或 SipPlan Helper。不能把 `transferId` 与银行 `txid/resource` 静默对应。

### 6.3 已确认的 Deposit 目标示例（完整的单命令参考文件）

这是用于后续最小 fixture 的 **approved-target 参考切片**，语义取自 C35–42；按本族 raw 保护形式保留 MANUAL，类型/导入显式且长类型参数分行。不是本次执行生成的文件，也不是将银行已有七条命令替换为 Deposit。完整九命令参考仍是 C，不以此单例替代其他成员。

```scala
package net.imadz.application.aggregates.behaviors

import net.imadz.application.aggregates.CreditBalanceProtocol.CreditBalanceConfirmation
import net.imadz.application.aggregates.CreditBalanceProtocol.Deposit
import net.imadz.common.CommonTypes.iMadzError
import net.imadz.common.application.CommandHandlerReplyingBehavior.CommandHelper
import net.imadz.domain.entities.CreditBalanceEntity.CreditBalanceState
import net.imadz.domain.values.Money

/**
 * 胶水代码库：负责将 Command 转换为 Policy 参数，并将结果包装为 Reply。
 * 这里是 AI 填空的主要战场。
 */
trait CreditBalanceCommandHelpers {
  implicit object DepositHelper
      extends CommandHelper[
        Deposit,
        CreditBalanceState,
        Money,
        CreditBalanceConfirmation
      ] {
    override def toParam(state: CreditBalanceState, command: Deposit): Money = {
      // ==== BEGIN MANUAL ====
      command.change
      // ==== END MANUAL ====
    }

    override def createFailureReply(param: Money)(error: iMadzError): CreditBalanceConfirmation = {
      // ==== BEGIN MANUAL ====
      CreditBalanceConfirmation(Some(error), Nil)
      // ==== END MANUAL ====
    }

    override def createSuccessReply(param: Money)(state: CreditBalanceState): CreditBalanceConfirmation = {
      // ==== BEGIN MANUAL ====
      CreditBalanceConfirmation(None, state.accountBalance.values.toList)
      // ==== END MANUAL ====
    }
  }
}
```

相对 raw 的显式偏差只有：业务 body 采用用户指定参考；长泛型分行；只为该切片收集确定依赖；不在人工 body 后标“机械骨架”。不是对所有聚合的回复算法授权。raw 的通用默认仍完整保留在 B/T 账中。

## 7. JS 当前路由，不能按目录名推断

### 7.1 formal、legacy 与 family 实际接线

|lane|实读入口 / 符号 / 固定行|实际输出与差距|
|---|---|---|
|formal 银行 Play service|[registeredProductProducer L92–101][CLI] 注册 `scala-cqrs-play-service`；[generate.mjs L16–23](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L16) 继承 `createEffectRegistry('2')`，仅替 aggregate/invariant；[produce-effect L6–19](../baseline/js/generators/scala-cqrs-application/produce-effect.mjs#L6) 继承 `applicationRegistry`；[produce L17–29](../baseline/js/generators/scala-cqrs-application/produce.mjs#L17) 的 command-dsl 明确调用 `renderCommand`|CommandHelpers 仍由 J31–42 的事件构造 object 产生；不是 legacy 三方法 renderer|
|formal domain v1|[scala-cqrs-domain/generate L1–19](../baseline/js/generators/scala-cqrs-domain/generate.mjs#L1) 导入 command-dsl/produce；[produce L1–6](../baseline/js/generators/command-dsl/produce.mjs#L1) 也调用 `renderCommand`|`command-dsl` 目录中另有三方法 render，不代表 `produce` 调它|
|formal domain v2 / application profiles|[produce-v2 L10–16](../baseline/js/generators/scala-cqrs-domain/produce-v2.mjs#L10) 与 applicationRegistry 都把 command-dsl 绑定 renderCommand|共享 J 文件，不能只改 Play service wrapper 即声称修齐|
|legacy 独立 CLI|[emit.mjs L1–6](../baseline/js/generators/command-dsl/emit.mjs#L1) 读取 spec JSON → L.render → writeFileSync；[run-all L765–799](../baseline/js/generators/run-all.mjs#L765) 提供 paramDefs/confirmationType；[L2033–2047](../baseline/js/generators/run-all.mjs#L2033) 再把文件移到 behaviors|三方法近似实现真实存在；对 formal 是 **not-wired**，并非“完全没有 CommandHelper 实现”|
|family2 注册入口|[aggregate-core-v1/generate L11–23](../baseline/js/generators/scala-cqrs-aggregate-core-v1/generate.mjs#L11) 明确校验 `scala-cqrs-aggregate-core@1`；[build-models L18–28][FM] 声明 helpers role；[render L15–34](../baseline/js/generators/scala-cqrs-aggregate-core-v1/render.mjs#L15) 调 FT|MBT 已分文件，但内容依旧是 emit object；包 `domain.command`，module kernel，不是应用三方法 Helper|
|family 的下游复用|[persistence-readside build-models L87](../baseline/js/generators/scala-cqrs-persistence-readside-v1/build-models.mjs#L87) 调 aggregateModels；[render L14](../baseline/js/generators/scala-cqrs-persistence-readside-v1/render.mjs#L14) 调 aggregateProductionJobs|family2 修改会影响该闭包；这里确认的是直接调用，未把所有 family 目录推断为已消费此 Helper|

`generate-products` 的注册列表没有 `command-dsl` 独立目录；因此不能给它一个 `--generator .../command-dsl` 就冒充 formal 公共入口。`emit.mjs` 是 legacy 的另一条调用合同。

### 7.2 formal 的完整本族逻辑：J20–42

- Model 实际来源是 `products['reference-layout']` 中 kind=aggregate 的声明，以及 `domain-dependencies.commands/events/hosts`、`exact-value-types`。owner 判断 `ref.context == aggregate.context && ref.owner[0] == aggregate.id`。
- 命令与事件 protocol 在同一个 `domain/<Agg>Protocol.scala`，每命令字段按 `declaredSignature`，每事件按 `declaredSlots`；fields 取 `(row.ref ?? row.target).id` 与 `typeName`。这部分归 application-protocol/domain-entity 的拆分 owner，不能在本族丢失。
- helper 文件 package 为 `<pkg>.domain`，只有 `<Agg>Protocol._` import。先 emit `trait <Agg>Computations`，对匹配 commands 的 hosts 保序发 `def <symbol(h.id.id)>(state: <Agg>State, p: <Cmd>): <typeName(h.outputType)>`，无 body。
- 接着 companion `object <Agg>Computations`；仅 hosts.length=0 时输出 `val none: <Agg>Computations = new <Agg>Computations {}`，否则是空 object。银行三份都有 hosts，故没有 none。
- 再 `object <Agg>CommandHelpers`；每 command 发 `def emit<raw c.command.id>(state: <Agg>State, p: <symbol(command.id)>, hosts: <Agg>Computations): Vector[Event] = Vector(...)`。方法后缀使用 raw id，不是整个方法再走 resolver。
- Vector 项按 `c.events` 原序；每项构造 `symbol(e.event.id)(...)`；参数按 `e.slots` 原序逐个调用 `valueExpression(s.producer, layout, exact, options)`。空 events 得 `Vector()`。该调用可能引用 command、state、literal、host 等，不能替换为空事件来减少代码。
- entry kind=`command-helpers`；sources 顺序=aggregate source、command sources、host sources；deps 仅 protocol/state 文件；此 entry 没传 codeMappings。
- [naming.mjs L15–31](../baseline/js/generators/scala-cqrs-domain/naming.mjs#L15) 对 nominal 直接返回 values FQN；optional/sequence/map 递归为 Option/Vector/Map；entry 加固定 `// @generated by truthsrc scala-cqrs-domain:1` 头、去重 knowledgeIds、保留 footprint、merge=null。现有文件级 source 不等于三个新方法的成员锚点。
- [J57–88][J] 的 Rules 调 `Right(<Agg>CommandHelpers.emit<Cmd>(state,p,hosts))`，迁移必须同时变更该消费，不能把事件构造机械移进 application 而令 domain 反向依赖 application。

### 7.3 legacy 的每个规则与输出构造：L19–90

- defaults：`objectName || "Aggregate"`、`package || "generated.aggregate"`、`basePkg || pkg.replace(/\.application\.aggregates$/, "")`、`stateType || objName+"State"`、`paramDefs || {}`；commands 为 `spec.commands ?? []` 的副本，按 name 的 `<`/`>` 比较排序。
- `helperCmds = commands.filter(c => paramDefs[c.name])`；这是 truthy 判定（空数组也为 truthy），不是显式 isReadOnly。`c.fields` 在 helperFor 内没有消费。
- 每命令固定 `paramsType=<Cmd>Params`；reply=`confirmationType || <Cmd>Reply`；args 按 paramDefs 字段名顺序变为 `command.<scalaRef(field)>`，scalaRef 对源码列出的关键字集加反引号。
- `implicit object <Cmd>Helper extends CommandHelper[Cmd, State, Params, Reply]` → toParam=`Params(args)` → failure=`Reply(Some(error))` → success=`Reply(None)`，无 MANUAL。没有 State→Reply 的输入槽，没有 Unit/Tuple/单参数类型分支。
- imports 固定先 CommonTypes.iMadzError、CommandHelper；再 Protocol imports。非 sagaFace：全部已排序 commands、合成 Get<Agg>State、各 command reply、合成 Get<Agg>StateReply；sagaFace：只 helperCmds 的 commands/replies，但仍追加 Get<Agg>StateReply。未去重或证明所有合成 query 类型存在。
- 再 import Entity.State 与 `.domain.invariant.params.<Agg>RuleParams._`；固定 generated/knowledge-release 两行头；package=`pkg.behaviors`；traitComment 描述规则 VO；trait 内双换行分隔 helper。`files/notices` 局部变量未用于返回；函数返回完整 out 字符串。
- 独立 `parse.mjs` 的 command YAML→单命令 spec 只有 package/name/description/fields，见 [L5–17](../baseline/js/generators/command-dsl/parse.mjs#L5)；不能把它与 run-all 的聚合 spec 混同为一套已完整接线的 schema。

### 7.4 family2 的 Model/Builder/Template，不因“有 MBT”判齐

[FM 全文][FM] 中与本族有关的字段和规则：

1. artifact spec 精确为 `['helpers','command-helpers','command-helpers','domain.command',[],['CommandHelpers'],'kernel']`；命令派生命名 role=`emit-method`，prefix=`emit`，method=true。
2. `buildModels` 组合不变的 family1 kernel；拒绝 externalProducers 非空；headers 按 kernel aggregate/command 顺序建立 helper type 和 method tokens，再统一 `resolveNameSet`。
3. `artifact` 构造 `ref/role/kind/module/name/identifier/package/fqn/path/sources/refs/directDeps`。每 command 还有 `ref/source/base/params/ruleMethod/emitMethod/guards/emissions/sources/directDeps`。emissions 每项含 event ref/base/source/slots；slot 含 slot ref/field/source/producer/dependencies。
4. B155–168 检查事件属于同一聚合，slot 必须按实际字段顺序覆盖，producer 解析类型必须精确等于字段类型，依赖必须等于 producer 的 ordered references。B170–181 校验含 host input 的 command dependency closure。不能在应用 helper 重建时绕过这些保护。
5. B226 将 helper 依赖设为 protocol/state/computations 加各 emission producer directDeps；sources 为聚合、命令、emission 和 slot。B227 rules 依赖 helper。B237 要求所有事件有本地生产者；B238–245 检查路径碰撞、实际依赖路径及 kernel 不依赖 glue。
6. **没有** CommandHelperModel 的 replyType/errorType/三个 reply body；`params` 是纯规则参数，emissions 是领域事件构造。应保留这部分为 domain emission 角色，不把它删除后当三方法已替代。

[FT L3–26][FT] 的所有 emitted constructs：templateScope 以 helper artifact、protocol/state/computations 及 protocol commands/events 建 scope；输出 package/imports；`object <helpers.identifier>`；每 command 一个 emit 方法，参数依次 state/command/hosts，返回 `Vector[Protocol.Event]`；Vector 内按 emissions、slots 原序输出 syntax.value；0 emission，或只有 1 emission 且 slots≤1 且每 slot producer.op 为 ref/literal 时 inline；否则多行缩进并在非末 event 后加逗号；最后关闭 Vector/method/object。`out.append` 给 object、command、event、slot 各自附 source。没有 implicit object、CommandHelper 父类型、toParam、failure、success、MANUAL。其 import scope 与表达式基础设施可以复用，但不能假称逻辑等价。

## 8. 银行 actual-js 完整构造及 RHS 保留账

三份完整冻结文件见 [AC][AC]、[AF][AF]、[AS][AS]。它们不是本轮生成结果。以下账按文件输出顺序覆盖每个成员；所有 emit 方法的完整公共签名为：

```scala
def emit<Command>(state: <Agg>State, p: <Command>, hosts: <Agg>Computations): Vector[Event] = Vector(<下表构造表达式>)
```

这是模板循环记法，不是可执行 Scala。每行 `<Agg>/<Command>` 唯一展开方法名、两个业务类型与参数顺序；没有 overload/default/annotation/implicit/其他 body。所有 emit 都只是构造事件，无验证、持久化、回复或发布。迁移时表中 RHS 必须保持语义，去到 domain 规则/emission owner；并不抄到新的 application CommandHelper。

公共文件前缀依次为固定 generated 头、`package example.bankwealth.domain`、空行、`import <Agg>Protocol._`、Computations trait、空 Computations companion、CommandHelpers object，末尾闭合与换行。没有其他 imports、父类型或初始化语句。

### 8.1 CreditBalance

Computations [AC6–12][AC]：按顺序声明 `BalanceAfterCommitIncomingCredits(state: CreditBalanceState, p: CommitIncomingCredits)`、`BalanceAfterReleaseReservedFunds(..., p: ReleaseReservedFunds)`、`BalanceAfterReserveFunds(..., p: ReserveFunds)`，都返回 `example.bankwealth.domain.values.Money`，没有 body。方法名当前为 PascalCase，是需改源码命名但不可改端口稳定身份的项目。

|AC 行|Command|完整 Vector 元素 RHS|
|---:|---|---|
|14|InitializeAccount|`AccountInitialized(p.resource, p.currency, p.amount)`|
|15|ReserveFunds|`ReserveFundsConfirmed(p.txid, p.resource, p.amount, "CNY", hosts.BalanceAfterReserveFunds(state, p))`|
|16|DeductFunds|`DeductFundsConfirmed(p.txid, p.resource, p.amount)`|
|17|ReleaseReservedFunds|`ReleaseReservedFundsConfirmed(p.txid, p.resource, p.amount, "CNY", hosts.BalanceAfterReleaseReservedFunds(state, p))`|
|18|RecordIncomingCredits|`RecordIncomingCreditsConfirmed(p.txid, p.resource, p.amount)`|
|19|CommitIncomingCredits|`CommitIncomingCreditsConfirmed(p.txid, p.resource, p.amount, "CNY", hosts.BalanceAfterCommitIncomingCredits(state, p))`|
|20|CancelIncomingCredit|`CancelIncomingCreditConfirmed(p.txid, p.resource, p.amount)`|

### 8.2 FundOrder

Computations [AF6–11][AF]：`StableRefundOperationId(state: FundOrderState, p: RequestFundPurchaseRefund): example.bankwealth.domain.values.OperationId`；随后 `StableTaRequestId(state: FundOrderState, p: RegisterFundTASubmission): example.bankwealth.domain.values.TaRequestId`。二者无实现；不能换随机值、timestamp 或同一 String 类型来“简化”。

|AF 行|Command|完整 Vector 元素 RHS|
|---:|---|---|
|13|RequestFundPurchaseSettlement|`FundPurchaseSettlementRequested(p.operationId, p.fundOrderId, p.investorAccountId, p.fundCollectionAccountId, p.fundCode, p.amount)`|
|14|ReserveFundSubscription|`ReserveFundSubscriptionConfirmed(p.txid, p.resource, p.amount)`|
|15|ConfirmFundSubscriptionPayment|`FundSubscriptionPaymentConfirmed(p.txid, p.resource, p.amount)`|
|16|CancelCashFundSubscription|`CashFundSubscriptionCanceled(p.txid, p.resource, p.amount)`|
|17|RecordFundCashPaymentSucceeded|`FundCashPaymentSucceeded(p.txid, "succeeded")`|
|18|RecordFundCashPaymentRejectedBeforeEffects|`FundCashPaymentRejectedBeforeEffects(p.txid, "rejected-before-effects")`|
|19|RecordFundCashPaymentCompensated|`FundCashPaymentCompensated(p.txid, "compensated")`|
|20|RecordFundCashPaymentRecoveryRequired|`FundCashPaymentRecoveryRequired(p.txid, "recovery-required")`|
|21|RecordFundCashPaymentOutcomeUnknown|`FundCashPaymentOutcomeUnknown(p.txid, "outcome-unknown")`|
|22|RegisterFundTASubmission|`FundTASubmissionRegistered(p.fundOrderId, p.paymentTxId, hosts.StableTaRequestId(state, p))`|
|23|RecordFundTAAccepted|`FundTAAccepted(p.fundOrderId, p.paymentTxId, p.taRequestId, p.taReference, p.receiptId, p.receiptBody, p.fundCode, p.currency, "accepted")`|
|24|RecordFundTAConfirmed|`FundTASharesConfirmed(p.fundOrderId, p.paymentTxId, p.taRequestId, p.taReference, p.receiptId, p.receiptBody, p.fundCode, p.currency, p.shares, "confirmed")`|
|25|RecordFundTARejected|`FundTARejected(p.fundOrderId, p.paymentTxId, p.taRequestId, p.taReference, p.receiptId, p.receiptBody, p.fundCode, p.currency, p.reason, "rejected")`|
|26|RecordFundTAUnknown|`FundTAUnknown(p.fundOrderId, p.paymentTxId, p.taRequestId, p.taReference, p.receiptId, p.receiptBody, p.fundCode, p.currency, "unknown")`|
|27|RequestFundPurchaseRefund|`FundPurchaseRefundRequested(p.fundOrderId, p.paymentTxId, state.investorAccountId, state.fundCollectionAccountId, state.amount, hosts.StableRefundOperationId(state, p))`|
|28|RecordFundRefundSucceeded|`FundRefundSucceeded(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "succeeded")`|
|29|RecordFundRefundRejectedBeforeEffects|`FundRefundRejectedBeforeEffects(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "rejected-before-effects")`|
|30|RecordFundRefundCompensated|`FundRefundCompensated(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "compensated")`|
|31|RecordFundRefundRecoveryRequired|`FundRefundRecoveryRequired(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "recovery-required")`|
|32|RecordFundRefundOutcomeUnknown|`FundRefundOutcomeUnknown(p.refundTxId, p.refundOperationId, p.receiptId, p.receiptBody, "outcome-unknown")`|
|33|RecordCashRequestSource|`CashRequestSourceRecorded(p.original, p.source)`|

### 8.3 SipPlan

Computations [AS6–10][AS]：仅 `StableSipOccurrence(state: SipPlanState, p: TriggerSipInstallment): example.bankwealth.domain.values.SipOccurrence`，无 body。

|AS 行|Command|完整 Vector 元素 RHS|
|---:|---|---|
|12|CreateSipPlan|`SipPlanCreated(p.planId, p.config)`|
|13|AppendSipDueSlot|`SipDueSlotAppended(p.position, p.dueSlot)`|
|14|SealSipSchedule|`SipScheduleSealed(true)`|
|15|ReviseSipPlan|`SipPlanRevised(p.config, state.latestRevision)`|
|16|AdvanceSipClock|`SipClockAdvanced(p.tick)`|
|17|PauseSipPlan|`SipPlanPaused(p.tick)`|
|18|ResumeSipPlan|`SipPlanResumed(p.tick, state.pauseTick)`|
|19|ObserveSipDueSlot|`SipDueSlotObserved(p.position, p.dueSlot, "backlog")`|
|20|SkipPausedSipDueSlot|`SipPausedDueSlotSkipped(p.position, p.dueSlot, "skipped")`|
|21|AdvanceSkippedSipSlot|`SipSkippedSlotAdvanced(p.position, p.dueSlot)`|
|22|TriggerSipInstallment|`SipInstallmentTriggered(p.position, hosts.StableSipOccurrence(state, p))`|
|23|RecordSipInstallmentPending|`SipInstallmentPending(p.occurrence, "pending")`|
|24|RecordSipInstallmentOutcomeUnknown|`SipInstallmentOutcomeUnknown(p.occurrence, "outcome-unknown")`|
|25|RecordSipInstallmentRecoveryRequired|`SipInstallmentRecoveryRequired(p.occurrence, "recovery-required")`|
|26|RecordSipInstallmentRefundInProgress|`SipInstallmentRefundInProgress(p.occurrence, "refund-in-progress")`|
|27|RecordSipInstallmentSucceeded|`SipInstallmentSucceeded(p.occurrence, p.evidence, p.receiptId, p.receiptBody, "succeeded")`|
|28|RecordSipInstallmentFailed|`SipInstallmentFailed(p.occurrence, p.evidence, p.receiptId, p.receiptBody, "failed")`|
|29|RecordSipCreateIntent|`SipCreateIntentRecorded(p.intent, p.source)`|

这些事件及状态的业务含义不在本阶段改变；特别是 receipt、txid、OperationId、TaRequestId、SipOccurrence 名义身份、PB 字段号、PID、serializer manifest/绑定、Money 及 checked overflow 均不属于本 diff 的改写权限。

## 9. 实际 minus/plus：差在职责和 RHS，不是文件名

### 9.1 银行现存与指定参考的结构对照

下面 minus 逐字取自 [AC L13–21][AC]；plus 逐字取自 [C L46–52][C]，外层 trait 名为明确布局目标。**不同输入，非同输入字节比较，也不是可直接应用到银行的 patch。** 两者即使命令都叫 ReserveFunds，参数/事件/回复也不同；plus 没有声称替代银行其他七条 emit。minus 的所有事件构造必须按第 8 节迁入 domain owner，而新的银行回复仍需 D1。

```diff
--- actual-js/app/example/bankwealth/domain/CreditBalanceCommandHelpers.scala
+++ approved-target/curated-reservation-structure/CreditBalanceCommandHelpers.scala
@@ -13,9 +13,9 @@
-object CreditBalanceCommandHelpers {
-  def emitInitializeAccount(state: CreditBalanceState, p: InitializeAccount, hosts: CreditBalanceComputations): Vector[Event] = Vector(AccountInitialized(p.resource, p.currency, p.amount))
-  def emitReserveFunds(state: CreditBalanceState, p: ReserveFunds, hosts: CreditBalanceComputations): Vector[Event] = Vector(ReserveFundsConfirmed(p.txid, p.resource, p.amount, "CNY", hosts.BalanceAfterReserveFunds(state, p)))
-  def emitDeductFunds(state: CreditBalanceState, p: DeductFunds, hosts: CreditBalanceComputations): Vector[Event] = Vector(DeductFundsConfirmed(p.txid, p.resource, p.amount))
-  def emitReleaseReservedFunds(state: CreditBalanceState, p: ReleaseReservedFunds, hosts: CreditBalanceComputations): Vector[Event] = Vector(ReleaseReservedFundsConfirmed(p.txid, p.resource, p.amount, "CNY", hosts.BalanceAfterReleaseReservedFunds(state, p)))
-  def emitRecordIncomingCredits(state: CreditBalanceState, p: RecordIncomingCredits, hosts: CreditBalanceComputations): Vector[Event] = Vector(RecordIncomingCreditsConfirmed(p.txid, p.resource, p.amount))
-  def emitCommitIncomingCredits(state: CreditBalanceState, p: CommitIncomingCredits, hosts: CreditBalanceComputations): Vector[Event] = Vector(CommitIncomingCreditsConfirmed(p.txid, p.resource, p.amount, "CNY", hosts.BalanceAfterCommitIncomingCredits(state, p)))
-  def emitCancelIncomingCredit(state: CreditBalanceState, p: CancelIncomingCredit, hosts: CreditBalanceComputations): Vector[Event] = Vector(CancelIncomingCreditConfirmed(p.txid, p.resource, p.amount))
+trait CreditBalanceCommandHelpers {
+  implicit object ReserveFundsHelper extends CommandHelper[ReserveFunds, CreditBalanceState, (Id, Money), FundsReservationConfirmation] {
+    override def toParam(state: CreditBalanceState, command: ReserveFunds): (Id, Money) = (command.transferId, command.amount)
+
+    override def createFailureReply(param: (Id, Money))(error: iMadzError): FundsReservationConfirmation = FundsReservationConfirmation(param._1, Some(error))
+
+    override def createSuccessReply(param: (Id, Money))(state: CreditBalanceState): FundsReservationConfirmation = FundsReservationConfirmation(param._1, None)
+  }
 }
```

外层 package/import 的完整差距不能由该局部 hunk 代替：actual 属 domain、只导 Protocol；目标属 application.aggregates.behaviors，并需应用 Protocol Command/Reply、domain Entity.State/Param 依赖和 common CommandHelper/iMadzError。原 Computations trait/companion 也不应随新 Helper 整体迁到 application，须拆给 domain services 的具名计算端口。

### 9.2 legacy 的固定回复与目标 body 槽

minus 为 [L38–52][L] 的实际模板；plus 为拟实施的三方法模板结构（proposed），展示 H1–H9 的消费，不声称当前存在该函数。外围 package/import/trait 由 T1–T3 规则组装；类型 signature 的完整性属于 shared TypeRef 合同。新的 code-string 槽仅限 Scala 已有的三槽，不引入万能 source-content model。

```diff
--- legacy/generators/command-dsl/render.mjs
+++ proposed/generators/scala-cqrs-command-helper/templates/command-helpers.mjs
@@ -38,15 +38,21 @@
 const helperFor = (c) => {
-  const paramsType = `${c.name}Params`;
-  const replyType = c.confirmationType || `${c.name}Reply`;
-  const args = (paramDefs[c.name] || []).map((f) => `command.${scalaRef(f)}`).join(", ");
-  return `  implicit object ${c.name}Helper extends CommandHelper[${c.name}, ${stateType}, ${paramsType}, ${replyType}] {
-    override def toParam(state: ${stateType}, command: ${c.name}): ${paramsType} =
-      ${paramsType}(${args})
+  return `  implicit object ${c.name} extends CommandHelper[${c.commandType.signature}, ${c.stateType.signature}, ${c.paramType.signature}, ${c.replyType.signature}] {
+    override def toParam(state: ${c.stateType.signature}, command: ${c.commandType.signature}): ${c.paramType.signature} = {
+      // ==== BEGIN MANUAL ====
+      ${c.toParamLogic}
+      // ==== END MANUAL ====
+    }
 
-    override def createFailureReply(param: ${paramsType})(error: iMadzError): ${replyType} =
-      ${replyType}(Some(error))
+    override def createFailureReply(param: ${c.paramType.signature})(error: ${c.errorType.signature}): ${c.replyType.signature} = {
+      // ==== BEGIN MANUAL ====
+      ${c.failureReplyLogic}
+      // ==== END MANUAL ====
+    }
 
-    override def createSuccessReply(param: ${paramsType})(state: ${stateType}): ${replyType} =
-      ${replyType}(None)
+    override def createSuccessReply(param: ${c.paramType.signature})(state: ${c.stateType.signature}): ${c.replyType.signature} = {
+      // ==== BEGIN MANUAL ====
+      ${c.successReplyLogic}
+      // ==== END MANUAL ====
+    }
   }`;
 };
```

这个 hunk 中用 `.signature` 取代 raw T 的 `.name`/硬编码 Error，是类型完整性目标的显式偏差，不应回填冻结 Scala。长行仍须按第 6.3 节的目标格式渲染，不能把这份结构 hunk 当最终格式金样；D4/D5 未定之前不能据此启动修改。

## 10. 胶水、Actor 协议与副作用顺序

### 10.1 精确接口与来源

|符号|完整 import / 来源|所需 API、边界|
|---|---|---|
|CommandHelper|`net.imadz.common.application.CommandHandlerReplyingBehavior.CommandHelper`；[G16–23][G]|不变型 `[Command, State, Param, Reply]`；三个方法同第 5 节；Helper 自身不 persist|
|runReplyingPolicy|`net.imadz.common.application.CommandHandlerReplyingBehavior.runReplyingPolicy`；[G71–75][G]|`(rule: InvariantRule[E,S,P], helper: CommandHelper[C,S,P,R])(state:S, command:C): RunnablePolicyWithHelper[E,S,P,R,C]`|
|RunnablePolicyWithHelper|同 object 下；[G29–64][G]|case class 字段顺序 rule/helper/state/command；replyWith 与 replyWithAndPublish 两方法不等价|
|InvariantRule|`net.imadz.common.CommonTypes.InvariantRule`；[CommonTypes L15–17](../baseline/common/src/main/scala/net/imadz/common/CommonTypes.scala#L15)|`apply(state:S,param:P): Either[iMadzError,List[E]]`；与当前 JS `Either[String,Vector[Event]]` 不是同一接口|
|iMadzError|`net.imadz.common.CommonTypes.iMadzError`；[L11](../baseline/common/src/main/scala/net/imadz/common/CommonTypes.scala#L11)|`final case class iMadzError(code:String,message:String) extends Throwable with CborSerializable`；不能用通用空 message 猜业务映射|
|ActorRef|`akka.actor.typed.ActorRef`|只应用 Actor command 及 reply channel；不能注入纯 Params/Event|
|Effect|`akka.persistence.typed.scaladsl.Effect`|失败 reply 不 persist；成功 persist→event application→thenReply|
|Id / Money / Reply / State|`net.imadz.common.CommonTypes.Id`（UUID alias）；具体 fixture 的 domain.values.Money、Entity.State、application Protocol.Reply|名义值、金额算法与消息身份保留；不按相同字段合并类型|

核心执行 body 完整摘录自 G35–44，不是自行设计：

```scala
def replyWith(replyTo: ActorRef[Reply]): Effect[Event, State] = {
  val param = helper.toParam(state, command)
  rule(state, param).fold(
    error => Effect.reply(replyTo)(helper.createFailureReply(param)(error)),
    events => Effect.persist(events).thenReply(replyTo)(helper.createSuccessReply(param))
  )
}
```

顺序为提取 Param 一次 → 调 rule 一次 → Either.fold 选一臂。Left 调 failure constructor 并 reply，无 persist；Right 先持久化返回的完整 List 事件，由 event handler 更新 state，然后 Akka 将更新后 state 交给 `helper.createSuccessReply(param)`。不能提前执行 success helper 并捕获旧 state。空事件成功与失败不是同一个分支，是否允许必须由 rule/业务合同决定。

`replyWithAndPublish` G50–64 的 Right 在 persist 后追加 `thenRun { _: State => events.foreach(e => context.system.eventStream ! EventStream.Publish(e)) }`，再 thenReply；需要 implicit `akka.actor.typed.scaladsl.ActorContext[_]`。Left 相同但没有发布。没有显式业务需求不能把 `.replyWith` 改成 `.replyWithAndPublish`。

G78–86 另保留旧重载：`runReplyingPolicy(rule)(state,param)` 返回 `AwaitingReplyToRunnablePolicy`，其 `replyWith(replyTo)(leftConfirmationFactory,rightConfirmationFactory)` 采用相同 fold/persist/thenReply。不要用旧重载掩盖新 Helper 三方法缺失。

人工附带胶水 [CG35–67][CG] 有 helper 版 replyWith 及旧重载，**没有** G 的 replyWithAndPublish；这两份源码不能被当成相同字节或同一 JAR 能力。

### 10.2 真实消费供给尚未证明

- raw [BC scaffold/build.sbt L130–136](../baseline/bc/scaffold/build.sbt#L130) 声明 `"net.imadz" %% "common-core" % "0.2"`；Scala 2.13 下 artifact 名为 `common-core_2.13`。scaffold 还会复制 common 源面，[CodegenMain L203–225](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L203) 明示 multi relocation 包括 CommonTypes/CommandHandlerReplyingBehavior。必须查最终 classpath 的唯一供给，不据 sibling 存在就保证 jar 内 API。
- 当前 formal [domain/scaffold.mjs L9](../baseline/js/generators/scala-cqrs-domain/scaffold.mjs#L9) 生成 Akka 2.6.20、ScalaPB、ScalaTest 依赖；[application/render-build.mjs L7](../baseline/js/generators/scala-cqrs-application/render-build.mjs#L7) 加 saga-core 0.3.0，条件加 monarch-persistence 0.3.0。该显式追加不是 common-core 能力证明。
- [CLI114–139][CLI] 检查本地 saga/Monarch pins 及 service external roots，不检查本族所需 common JAR 三方法 API。本文未检查实际 jar、未发布/下载/升级。D3 必须给 exact coordinate/version/SHA 与所需签名的可消费证明；不得复制银行私有 CommandHelper 来绕过依赖。

### 10.3 调用者合同

[人工 CreditBalanceBehaviors L9–54](../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L9) `extends CreditBalanceCommandHelpers`；主入口按 direct/reserve/incomingCredit 的 `orElse` 顺序组合；每写命令 `runReplyingPolicy(rule, helper)(state, cmd).replyWith(cmd.replyTo)`；GetBalance 独立 `Effect.reply`。对应银行现状 [behavior template L47–65](../baseline/js/generators/scala-cqrs-play-service/templates/aggregate-behavior.mjs#L47) 则是 Execute(command,reply) 内嵌 match，Left→`Effect.none.thenRun(...Refused(code))`，Right→`Effect.persist(events).thenRun(...Accepted(events))`。虽 Right 也在 persist 后回复，但 Accepted(events) 不读取新 state，且无 Helper 合同，不能叫等价。

[protocol template L7–10、28–38](../baseline/js/generators/scala-cqrs-play-service/templates/aggregate-protocol.mjs#L7) 的 Execute/GetState 已有 typed ActorRef；application Protocol 又 alias 回 domain Aggregate.Request。不能说 JS 完全没有回复通道。目标是每个具有显式回复合同的**应用业务 Actor 命令**采用正确 `ActorRef[SpecificReply]`，Commands/Replies/Handler 分段；原 [AggregateProtocolBuilder L55–68](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateProtocolBuilder.scala#L55) 仅在 `cmd.replyToType` 声明时追加字段，且排在业务 baseFields 后。无合同不能合成万能 Reply；纯 domain Params/Event 不能携带 ActorRef；只读 query 不要求写 Helper。

## 11. 拟实施写集合、共享依赖和唯一装配所有者

**以下均是第二阶段候选写面，不是本阶段已写文件。** 仓库前缀统一是 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/`。本组生产代码独占 owner 名为 `command-helper`；跨文件最终 assembly owner 只有集成者 `protocol-behavior-integration`，不是多个包分别向同一路径 append。

### 11.1 本组拟新建（proposed）

1. `generators/scala-cqrs-command-helper/model.mjs`：对应 M1–M4、H1–H9 的显式数据合同；metadata source 单列，不用 content 替代模型。
2. `generators/scala-cqrs-command-helper/build-models.mjs`：按第 4 节规则与已裁定偏差构建参数/回复/依赖；业务 body 来源必须显式，缺失则诊断，不制造成功。
3. `generators/scala-cqrs-command-helper/templates/command-helpers.mjs`：只消费上述模型，依 T 顺序渲染 package/import/trait/implicit objects/三方法与保护块，返回内容和源区间；不持有 registry/writer。

拟复用现存 `resolveName`、`resolveNameSet`、`resolveArtifactPath`、`targetData`，实读 [scala-target/naming.mjs L41–118](../baseline/js/lib/scala-target/naming.mjs#L41)。其稳定身份分支禁止重命名，重复 affix 要显式 binding，不能退回逐模板 regex。当前接口接受 profile/name specs 而不是 Scala TypeRef；不能假称已经提供本族 signature/import API。

### 11.2 集成者协调写面，不由本组并发修改

|准确路径|split / move / replace 及调用方迁移|
|---|---|
|`generators/scala-cqrs-domain/render-domain.mjs`|拆 J31–42：Computations/emission 留 domain，三方法交新 builder/template；J88 Rules 的 emit 消费同步迁移。J20–30 protocol 与 J43–52 external bridge 保留各自 owner，不在本组顺手改|
|`generators/command-dsl/produce.mjs`、`generators/scala-cqrs-domain/produce-v2.mjs`、`generators/scala-cqrs-application/produce.mjs`|统一接入新的逻辑 helper producer；保留各 lane footprint/version，避免同一路径新旧双写|
|`generators/scala-cqrs-play-service/build-aggregate-models.mjs`、`aggregate-names.mjs`、`templates/aggregate-protocol.mjs`、`templates/aggregate-behavior.mjs`|command/param/reply 类型与 helpers 路径、behavior 继承和 `.replyWith` 接线；由 protocol/behavior owner 实施|
|`generators/command-dsl/render.mjs`、`generators/run-all.mjs`|legacy 单独 adapter 到同模型；命令排序/paramDefs/sagaFace/default/body 所有权先裁定；不无条件废弃所有 legacy 能力|
|`generators/scala-cqrs-aggregate-core-v1/build-models.mjs`、`render.mjs`、`templates/command-helpers.mjs`、`templates/rules.mjs`|原 helper 改明确 domain event-emission 角色；拟拆 `templates/event-emissions.mjs`（proposed，domain owner）。新应用 helper 走统一接口；保留 family 类型/slot/source/依赖准入，不将纯 kernel 指向 application actor glue|
|`generators/scala-cqrs-persistence-readside-v1/build-models.mjs`、`render.mjs`|仅因继承 family2 而需重新对账组合结果；是否需代码修改由确定接口差异决定，不能先全量重写|
|`lib/scala-target/naming.mjs`、`model.mjs`、`profiles.mjs`|shared owner 提供 BC 兼容 TypeRef/name/import/layout 合同；已有 buildTargetModel 不等于本族模型|
|`lib/products/generate-cli.mjs`、相关 `generator.json`、`src/core/product-plan.mjs`、`src/core/generate.mjs` / mappings / anchors|唯一集成者负责注册、product schema/版本、最终字节和路径/锚点迁移；本组只提交接口需求，不复制第二 writer|

旧→新产物的**职责**分派：

- 新三方法文件唯一目标为 application.aggregates.behaviors 的 `<Agg>CommandHelpers.scala`，由 command-helper renderer 产生一个 entry。
- 旧 `domain/<Agg>CommandHelpers.scala` 中 Computations → proposed `app/<base-path>/domain/services/<Agg>Computations.scala`；原 companion 的 `none` 条件也随其保留；是否合入既有 domain-service 端口由该 owner 决定。
- 原 emit 事件构造 → proposed `app/<base-path>/domain/invariant/<Agg>EventEmissions.scala` 或 Rules 内具名纯构造；D7 必须选择唯一形式。第 8 节的常量、state/host 调用和顺序必须保留，不创建“旧 domain CommandHelpers 转发壳”假装迁移完成。
- 除 domain Rules，application factory/aggregate/service 的 Computations imports、外置实现端口调用和引用图也要迁移。稳定 host id 不随源码 lowerCamelCase 改名。
- 新 entries 先确定最终格式，再登记 fingerprint/source spans。`knowledgeIds` 保留作者身份，不能新增 `@knowledge` 作者字段；旧 path 的 anchors/ledger 必须由 owned writer 迁移而非手改。
- [writer L185–190](../baseline/js/src/core/generate.mjs#L185) 对未再计划的旧 owned 文件可报告 RETAINED，不自动删除；[L246–267](../baseline/js/src/core/generate.mjs#L246) 的 recheck 不是锁/回滚。退役计划需列旧 path、owner、fingerprint、引用迁移、MANUAL 冲突，拒绝覆盖未拥有文件。新目标目录不能证明旧路径已清理。

依赖：`shared-layout-types`、`application-protocol`、`domain-entity`、`invariant-rule` / `aggregate-rules-formal`、`aggregate-behavior`、`glue-runtime-supply`、`writer-anchor-migration`。冲突面是 render-domain、application/produce、family build-models/render、shared registry/writer；只能由 assembly owner 串行集成或先无输出改变地拆文件。本阶段未创建新 generator/fixture/expected 文件。

## 12. 有限 fixture 与后续验收命令形状

### 12.1 拟建 fixtures（全部 proposed，当前未生成）

根路径 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/command-helper/`；不是第二业务真源，仅保存经批准的最小语义测试输入与适配说明。

|fixture|必须暴露的有限输入|验收输出/拒绝义务|
|---|---|---|
|`credit-balance`|同一份明确 Command/Param/Reply/State/Rule 定义分别适配 BC SystemMetadata 与 JS request；含用户 Deposit、新 state 余额回复；含 ReserveFunds tuple、Id、ReadOnly|完整 Helper 文件 + Protocol/Entity/Rules/Behaviors 依赖闭包；不能将银行 txid 偷换 transferId|
|`formal-single-slot`|guard/emission 在场且首回复只含 Option[iMadzError]；0/1/多字段 Params；排除 replyTo|检验 B3/B8/B12/B13 的真实 constructor shape；不是只比较名字|
|`resolution-edges`|仅只读、transactor、无 reply、重复 flow、optional 单字段、泛型嵌套与重名 import、非法 replyTo CustomType/非 MetaRef、Unit 名义冲突|raw 分支记录与目标拒绝/例外逐项对账；不把 `???` 或 Unit fallback 编译成功当行为完成|
|`bank-structural`|第 8 节三份固定输出作为迁移不丢 RHS 的证据|回复语义未定时仅 structural；不推导不存在的银行 Deposit fixture|
|`protected-body`|三个 MANUAL body 各有明确人工逻辑；顺序变化、重命名/冲突、重复生成|不得丢人工体；三个同名方法跨多个 implicit object 的稳定归属需精确定位，不仅凭最近 def 名猜|

### 12.2 公共 CLI 命令形状（均未执行，不是本阶段运行许可）

JS 实际支持的 flags 来自 [CLI66–88][CLI]：四个必填路径参数加可选 `--plan`；没有 `--artifact command-helper` 或 `--only-helper`。因此范围通过最小 request 的依赖闭包控制，而不是发明过滤 flag。下面路径均为拟验收专用目录，输入尚未落地；D1–D8 和供给/预算核准前不可执行。

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/command-helper/credit-balance/request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-play-service \
  --out /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/.rounds/command-helper-approved-implementation/js-first \
  --options-json /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/command-helper/credit-balance/options.json \
  --plan
```

- plan 仍捕获 request/options/manifest、执行产品图编译和 producer 规划，并读取/核验本地 runtime artifact 与 external source roots；它不是单文件模板打印。此入口本身没有源码编译/服务运行/下载行为。`--plan` 在 applyEntries 前返回，不写目标源码/ledger/anchors。
- 后续获准实生成仅去掉最后 `--plan`；**会写整个最小 profile 闭包**，包括生成器选中的 build/config/proto/测试支撑，不止 Helper，以及 `out/truthsrc.ledger.json`、`out/anchors.json`。[applyEntries L246–267](../baseline/js/src/core/generate.mjs#L246) 明确 mkdir/write/readback/写两份派生登记。产品图在本入口为内存编译，不能泛称整个 project CLI 都无旁路写入。
- 同输入第二次使用另一个独占 `js-second` 目标；两次完整文件清单和字节比较。相同目录增量重生另测 MANUAL/anchor 保护，不能拿新目录相同掩盖旧文件退役。
- 选 `scala-cqrs-aggregate-core-v1` family2 时应使用其明确 generator 目录及不同合法 options/request；不是改一个目录名即可消费 Play service fixture。需要外置实现 capture 的 profile 必须用 `generate-project`，CLI80 会拒绝 `generate-products`，见 D7；本文件不伪造该 project 配置。

BC 传统对应入口支持 `codegen.systemFile + codegen.systemBindings` 配对（与 `codegen.system` 互斥），不能改用 semanticProductsFile。后续形状为：

```bash
(
  cd /Users/zhongdj/Workspaces/mad-polaris/backkend-codegen &&
  sbt \
    -Dcodegen.systemFile=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/command-helper/credit-balance/canonical.json \
    -Dcodegen.systemBindings=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/command-helper/credit-balance/bindings.json \
    -Dcodegen.targetDir=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/.rounds/command-helper-approved-implementation/raw-scala \
    -Dcodegen.ledger=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/.rounds/command-helper-approved-implementation/raw-scala/scala-ledger.json \
    "runMain net.imadz.codegen.CodegenMain"
)
```

这里是**未来命令规格**，本次没有进入 BC 工作副本、没有运行 sbt。执行前重新读取该仓 CLAUDE/AGENTS/协调说明并核受影响 pins。此命令可能触发 sbt 编译、依赖解析/下载、仓库 target/cache 写入、JVM 子进程；CodegenMain 会创建目标、复制 scaffold、写完整最小 SystemMetadata 的制品、manifest，以及 formal 在场时 `formal-semantics.json`；显式 ledger 路径也会写。新 target 不能隔离 sbt 缓存或消除这些副作用；离线供给不足应阻断，不能顺手 publishLocal/下载/升级。

未选择现存可执行 helper 行为 suite，因此不编造 testOnly FQN。后续先固定真正 suite/命令、独占资源和只覆盖本依赖闭包的预算，才运行。初始调度预算生成/对账不超过 5 分钟、局部 JVM 编译/行为不超过 15 分钟，超时返回已有结果并停下；不是性能测量或放宽 deadline。

### 12.3 必须分别取得的证据

1. **同输入完整文件对账**：raw/approved/actual 各列文件清单；Helper package/import/trait/object/三方法/默认值/body/MANUAL/注释/空行逐项比；依赖 Protocol/Entity/Rule/Behavior 同一输入。只允许明确来源头、受控换行等有限白名单，不能压平全部空白。
2. **业务/接口**：失败 rule 不持久化且只回复一次；成功按事件顺序应用后 helper 读取新 State、回复一次；replyWith 不发生额外发布；replyWithAndPublish 的额外发布只在有授权的独立 fixture 测；规则 String/Vector→iMadzError/List 的映射不能吞内容。
3. **边界**：ActorRef 只在 application actor command；纯 Params/Event 无 ActorRef；read-only 无写 Helper；transactor 本族 suppressed；nominal/PB/PID/serializer/overflow 身份不变；不能通过 Any/String dispatcher 降复杂度。
4. **稳定生成/回锚**：两次同输入字节一致；一次局部字段/回复表达式变动产生局部 diff；最终格式之后再算 fingerprint/span，作者查询可回新位置；旧 owned 输出和人工块有冲突说明。
5. **质量**：生成器函数和生成 Scala 普通方法目标 CC≤5；6–10 逐方法解释，>10 重构或明确批准例外；普通嵌套≤2；不能用全局均值/文件数量声称达标。当前全部 `not-run` / `not-measured`，不宣称 parity 或 behavior 通过。

## 13. 具体未决项

|id|需要谁裁定什么|未裁定时的边界|
|---|---|---|
|D1|业务/Protocol owner 给银行每条写命令的 Reply 构造器、成功字段是否取新 State、失败 error.code/message 规则；特别是 InitializeAccount、TA/退款、定投并无 curated 对应|formal 新三方法 counterpart 缺少可实例化合同；不合成通用 Accepted/Reply(None)，不把 Deposit 余额逻辑泛化|
|D2|Rule/Helper owner 固定 BC formal `<meta.name>Rules.<Cmd>Params`、普通 Money/Id/Tuple、JS RuleParams 的映射；optional 字段与 0 参数、host 输入如何保留；`Either[String,Vector]` 如何对接 `Either[iMadzError,List]`|没有映射就不能实例化 CommandHelper 的不变型 Param；不得夹带 ActorRef 或丢 String 错误含义|
|D3|集成者选择实际可消费 common-core 或既有统一供给：坐标、版本、SHA、exact API、无重复 common classpath；不更换冻结 Saga/Monarch pins|源码存在不等于供给完成；禁止自动发布/下载或私有复制库|
|D4|集成者固定三 body 的所有权：raw MANUAL 保留还是已有 external implementation capture；跨多个 implicit object 的同名 def 如何唯一定位与迁移|不覆盖人工体；未授权 body 仍是显式实现槽，不能伪造成功|
|D5|shared/type owner 固定 raw 例外：泛型 `.name` 截断、hardcoded Error、宽 scala import 过滤、Optional 未传播、Unit/name 与 Tuple/name 判据、replyTo cast 与 unresolved `???` 的目标拒绝策略|保留 raw 账及诊断；不把旧缺陷宣传成必须照抄的成功，也不擅改冻结源|
|D6|layout owner 确定 multi physical module：raw command-helpers 在 kernel，而 Actor-facing 边界/现 family 分模块不同；同步依赖图与 source roots|首轮仅 single；不能悄悄把 raw 路径改 glue 并声称 1:1|
|D7|assembly owner 确定 formal/legacy/family 的统一模型接入与 domain emissions 最终 owner/path（Rules 内或独立 EventEmissions）、Computations 迁移、profile/product 版本及外置 capture 选择|可复用实现不等于 formal 已接通；禁止共享 renderer 多 owner 双写或删除 emit 语义|
|D8|模型/布局 owner 固定声明次序、业务组信息的输入位置，以及仅只读聚合 raw 空 trait 是否在目标抑制|不能按名字排序替换作者顺序；不能无记录改变文件基数|

上述未决项仅阻断对应实施/验收，不阻断本份观察规格保存；本次没有请求或取得测试、生成、运行或发布许可。

## 附录 A：Model 完整源码

对应 [M][M]。保持原定义与注释；本附录不是另一个可编辑生产源。

```scala
package net.imadz.codegen.scaffolding.cqrs.model.application


import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, TypeRef}

// Command Helper Trait 自身
case class CommandHelpersModel(
                                override val selfType: TypeRef,       // e.g. CreditBalanceCommandHelpers
                                helpers: Seq[CommandHelperModel],     // 内部的 implicit objects
                                override val dependencies: Set[TypeRef],
                                /** S7（EP §二 G1）：聚合号——台账 artifacts[] 文件级落点由此可查。 */
                                override val noteIds: Seq[String] = Nil
                              ) extends ArtifactModel

// 单个 Command Helper Object
case class CommandHelperModel(
                               name: String,                         // e.g. AddInitialHelper
                               commandType: TypeRef,                 // Command 类型 (T)
                               stateType: TypeRef,                   // State 类型 (S)
                               paramType: TypeRef,                   // Policy 参数类型 (P)
                               replyType: TypeRef,                   // Reply 类型 (R)
                               errorType: TypeRef,
                               toParamLogic: String,                 // toParam 实现代码
                               failureReplyLogic: String,            // createFailureReply 实现代码
                               successReplyLogic: String             // createSuccessReply 实现代码
                             )


```

## 附录 B：Builder 完整源码

对应 [B][B]。源码中的历史“可编译”断言不构成本轮编译证明；实际 MANUAL 位置以附录 C 为准。

```scala
package net.imadz.codegen.scaffolding.cqrs.builder.application

import net.imadz.codegen.scaffolding.cqrs.model.application.{CommandHelperModel, CommandHelpersModel}
import net.imadz.codegen.scaffolding.cqrs.{GeneratorContext, TypeRef}
import net.imadz.meta._
import net.imadz.codegen.structure.NamingConventions

object CommandHelpersBuilder {

  def build(meta: AggregateRootMetadata, ctx: GeneratorContext): CommandHelpersModel = {
    val pkg = ctx.layout.application.aggregates.behaviors
    val selfType = ctx.typeResolver.commandHelper(NamingConventions.getCommandHelperNameFromAggregateName(meta.name))

    val stateType = ctx.typeResolver.entityState(meta.stateRef)
    val errorType = ctx.knownFrameworkTypes("iMadzError")

    // 解析 Behavior Metadata 以获取 Command -> Reply 的映射关系
    val behaviorMeta = ctx.metaRegistry.resolveByName[AggregateBehaviorMetadata](meta.behaviorRef.targetName)

    // P4 形式路径：真源规则流在场（guards/emissions 非空）⇒ 写命令回复＝聚合回复族首回复
    //（error: Option[iMadzError] 单槽形制，与 runReplyingPolicy 两臂同形）。
    val formalReplyName: Option[String] =
      ctx.formalSemantics.flatMap(_.aggregates.find(_.aggregate == meta.name))
        .filter(a => a.guards.nonEmpty || a.emissions.nonEmpty)
        .flatMap(_ => meta.replyFamily.replies.headOption.map(_.name))

    // 构建映射表: CommandName -> ReplyType
    val commandReplyMap: Map[String, TypeRef] = behaviorMeta.map { bm =>
      bm.behaviors.flatMap(_.flows).map { flow =>
        // 获取成功时的回复类型
        val replyRef = flow.replyMapping.successReplyRef
        // 使用DSL解析回复类型
        val replyType = ctx.typeResolver.resolve(replyRef)
        flow.commandRef.targetName -> replyType
      }.toMap
    }.getOrElse(Map.empty)

    // P4 Slice 2：只读查询命令不产 helper——其回复（Get*StateReply(state)）由行为侧
    // ReadOnlyLogic 直接整状态构造；(param, error) 形态的 helper 对它无意义也构造不出
    //（整状态不在 helper 的参数域里）。
    val helpers = meta.commandFamily.commands.filterNot(_.isReadOnly).map { cmd =>
      // 自动解析 Command 类型（使用CommandRef以支持内嵌类）
      val cmdType = ctx.typeResolver.command(CommandRef(cmd.name))

      // 增强 Reply 类型推断逻辑
      val formalReply = formalReplyName.map(rn => (rn, ctx.typeResolver.commandReply(CommandReplyRef(rn))))
      val replyTypeRef = if (cmd.isReadOnly) {
        // ReadOnly 命令通常在定义时指定了 replyToType
        cmd.replyToType.map(ctx.typeResolver.resolve(_))
          .getOrElse(ctx.typeResolver.any)
      } else {
        // P4 形式路径（真源规则流在场）：回复＝聚合回复族（error: Option[iMadzError]），
        // 与 runReplyingPolicy 失败/成功臂同形——helper 成为活接线而非 Unit 骨架。
        formalReply.map(_._2).orElse {
          // Write 命令：优先从 Behavior 映射中查找
          commandReplyMap.get(cmd.name).orElse {
            // 兜底：尝试从 replyTo 参数推断 (兼容旧逻辑)
            cmd.parameters.find(_.name == "replyTo").flatMap { p =>
              p.parameterType match {
                case CustomType(_, _, args) if args.nonEmpty =>
                  val rawName = args.head.asInstanceOf[MetaRef].targetName
                  Some(ctx.typeResolver.resolve(StructRef(rawName)))
                case _ => None
              }
            }
          }
        }.getOrElse(ctx.typeResolver.unit) // 实在找不到就 Unit
      }

      // Params Logic (使用DSL风格解析参数类型)
      // P4 形式路径：规则参数＝<Agg>Rules.<Cmd>Params 命名类（InvariantRule 的 Param 不变型——
      // tuple 助手与规则参数类失配，r11b 实测），toParam 按命令参数序构造。
      val formalParamOpt = formalReplyName.map { _ =>
        val paramsName = s"${cmd.name}Params"
        val paramsType = TypeRef(paramsName, s"${ctx.layout.domain.invariants.root}.${meta.name}Rules")
        val args = cmd.parameters.filter(_.name != "replyTo").map(p => s"command.${p.name}").mkString(", ")
        (paramsType, s"$paramsName($args)")
      }
      val (paramType, toParamLogic) = formalParamOpt.getOrElse {
        if (cmd.parameters.exists(p => p.name != "replyTo")) {
          val payloadParams = cmd.parameters.filter(_.name != "replyTo")
          if (payloadParams.size == 1) {
            val p = payloadParams.head
            (ctx.typeResolver.parameterType(p.parameterType), s"command.${p.name}")
          } else {
            val tupleTypes = payloadParams.map(p => ctx.typeResolver.parameterType(p.parameterType))
            val tupleType = ctx.typeResolver.tuple(tupleTypes)
            val tupleArgs = payloadParams.map(p => s"command.${p.name}").mkString(", ")
            (tupleType, s"($tupleArgs)")
          }
        } else {
          (TypeRef.Unit, "()")
        }
      }

      val helperName = s"${cmd.name}Helper"

      // 机械回复骨架（2026-09-21 EP_Improvement_Engine 欠账⑦）：
      //   修复前此处 `val successLogic = "???"` / `val failureLogic = "???"` 把上面算好的
      //   构造表达式**丢弃**，模板只收到裸 `???`——87 个行为域的 createSuccessReply/
      //   createFailureReply 全不可填。修复：把真构造表达式喂给模板（不再用 ???）。
      //   ★ 这是**机械外壳**（可编译·语义默认），放 MANUAL 块**之外**——重生成自动更新；
      //   需要自定义语义（如按 error.code 分支）时才改 MANUAL 块。
      // ★ replyType=Unit 的判据是**回复类型**，不是 paramType——构造表达式是给 reply 用的：
      //   replyType=Unit → `()`（`Unit(x)` 非法·273 错实测）；replyType 是元组构造时取 param._1。
      val replyIsUnit = replyTypeRef.name == "Unit"
      // P4 形式路径回复族＝单槽 error: Option[iMadzError]（Reply(None)/Reply(Some(error))）；
      // 既有机械外壳（reply(error-值, Option) 两参形态）保持不变。
      val formalSingleSlot = formalReply.exists(_._2.name == replyTypeRef.name)
      val successLogic =
        if (replyIsUnit) "()"
        else if (formalSingleSlot) s"${replyTypeRef.name}(None)"
        else if (paramType.name.startsWith("Tuple")) s"${replyTypeRef.name}(param._1, None)"
        else s"${replyTypeRef.name}(param, None)"
      val failureLogic =
        if (replyIsUnit) "()"
        else if (formalSingleSlot) s"${replyTypeRef.name}(Some(error))"
        else if (paramType.name.startsWith("Tuple")) s"${replyTypeRef.name}(param._1, Some(error))"
        else s"${replyTypeRef.name}(param, Some(error))"

      CommandHelperModel(name = helperName,
        commandType = cmdType, stateType = stateType,
        paramType = paramType,
        replyType = replyTypeRef,
        errorType = errorType,
        toParamLogic = toParamLogic,
        successReplyLogic = successLogic,
        failureReplyLogic = failureLogic
      )
    }

    // 2026-08-21：递归展开 typeParams（List[Finding] 等嵌套值对象引用需进 import）
    def expandTypeRefs(t: TypeRef): Seq[TypeRef] = t +: t.typeParams.flatMap(expandTypeRefs)
    val dependencies = helpers.flatMap(h =>
      (Set(h.commandType, h.stateType, h.errorType) ++
        expandTypeRefs(h.paramType) ++ expandTypeRefs(h.replyType)).toSeq
    )
      .filter(t => t.shouldImport(pkg))
      .toSet + ctx.knownFrameworkTypes("CommandHelper")

    CommandHelpersModel(selfType, helpers, dependencies, noteIds = meta.noteId.toSeq)
  }
}

```

## 附录 C：Template 完整源码

对应 [T][T]。重复的 CommandHelpersModel import、`.name`/`.signature` 差别、固定 iMadzError 与 MANUAL 默认均刻意保留，以便与第 5 节一一核对。

```scala
package net.imadz.codegen.scaffolding.cqrs.template.application

import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.application.CommandHelpersModel

import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate
import net.imadz.codegen.scaffolding.cqrs.model.application.CommandHelpersModel

object CommandHelpersTemplate extends CodeTemplate[CommandHelpersModel] {

  def generate(model: CommandHelpersModel): String = {
    // 1. 构建包声明
    val pkgDecl = packageDecl(model.selfType.packageName)

    // 2. 构建导入声明
    val importList = model.dependencies.toList
      .sortBy(_.fqn)
      .map(_.fqn)
      .filterNot(t =>
        t.isEmpty || t.startsWith("scala") || t.startsWith("java.lang")
      )
      .distinct

    val importDecl = imports(importList: _*)

    // 3. 渲染每个 Helper Object
    val helpersCode = model.helpers
      .map { helper =>
        // 泛型参数：[T, S, P, R]
        val genericArgs = Seq(
          helper.commandType.signature,
          helper.stateType.signature,
          helper.paramType.signature,
          helper.replyType.signature
        ).mkString(", ")

        // T 是 Command, S 是 State, P 是 Param, R 是 Reply
        // ★ 手写区（2026-09-20 EP_Improvement_Engine；2026-09-21 修欠账⑦）：
        //   三方法体各包一个 MANUAL 块——本文件自称「AI 填空的主要战场」。MANUAL 块按最近
        //   前置 `def` 名锚定（WriteTerritory.DefAnchorRegex），重生成字节级保留。
        //   ★ 块内**默认值＝可编译的机械骨架**（不是裸 `???`）：开箱即编译；需要自定义语义
        //     （如按 error.code 分支）时人在块内改，重生成保留其编辑。
        //     修复前 successLogic/failureLogic 被 builder 丢弃成裸 `???` → 87 域不可填。
        s"""
  implicit object ${helper.name} extends CommandHelper[$genericArgs] {
    override def toParam(state: ${helper.stateType.name}, command: ${helper.commandType.name}): ${helper.paramType.signature} = {
      // ==== BEGIN MANUAL ====
      ${helper.toParamLogic} // 机械骨架·自定义时改此行
      // ==== END MANUAL ====
    }

    override def createFailureReply(param: ${helper.paramType.signature})(error: iMadzError): ${helper.replyType.name} = {
      // ==== BEGIN MANUAL ====
      ${helper.failureReplyLogic} // 机械骨架·自定义时改此行
      // ==== END MANUAL ====
    }

    override def createSuccessReply(param: ${helper.paramType.signature})(state: ${helper.stateType.name}): ${helper.replyType.name} = {
      // ==== BEGIN MANUAL ====
      ${helper.successReplyLogic} // 机械骨架·自定义时改此行
      // ==== END MANUAL ====
    }
  }
"""
      }
      .mkString("\n")

    // 4. 构建trait定义
    val traitComment = s"""/**
 * 胶水代码库：负责将 Command 转换为 Policy 参数，并将结果包装为 Reply。
 * 这里是 AI 填空的主要战场。
 */
"""

    val traitDef = s"""
$traitComment
trait ${model.selfType.name} {

$helpersCode

}
"""

    // 5. 构建完整源代码
    val sourceCode = s"""${pkgDecl.code}

${importDecl.code}

$traitDef
"""

    // 6. 生成代码
    sourceCode
  }
}

```

Template 所用 DSL 的确切输出是 [CodeGenerationDSL L13–22](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L13)：`PackageDeclaration.code = s"package $packageName"`；`ImportDeclaration.code = imports.sorted.map("import " + _).mkString("\n")`；入口工厂 [L109–110](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L109) 不额外分组或补 header。因此 T2 的导入最终还会排序一次。

[M]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/CommandHelperModel.scala#L1
[B]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/CommandHelpersBuilder.scala#L1
[T]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/CommandHelpersTemplate.scala#L1
[J]: ../baseline/js/generators/scala-cqrs-domain/render-domain.mjs#L20
[L]: ../baseline/js/generators/command-dsl/render.mjs#L19
[FT]: ../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/command-helpers.mjs#L1
[FM]: ../baseline/js/generators/scala-cqrs-aggregate-core-v1/build-models.mjs#L1
[C]: ../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L1
[G]: ../baseline/common/src/main/scala/net/imadz/common/application/CommandHandlerReplyingBehavior.scala#L1
[CG]: ../baseline/curated-scala/net/imadz/common/application/CommandHandlerReplyingBehavior.scala#L1
[AC]: ../baseline/actual-js/app/example/bankwealth/domain/CreditBalanceCommandHelpers.scala#L1
[AF]: ../baseline/actual-js/app/example/bankwealth/domain/FundOrderCommandHelpers.scala#L1
[AS]: ../baseline/actual-js/app/example/bankwealth/domain/SipPlanCommandHelpers.scala#L1
[CLI]: ../baseline/js/lib/products/generate-cli.mjs#L66
