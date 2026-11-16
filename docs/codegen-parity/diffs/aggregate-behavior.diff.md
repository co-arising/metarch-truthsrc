# aggregate-behavior — 传统聚合行为组的内容级差异规格

## 1. 身份、边界与证据状态

- artifactId / group：`aggregate-behavior`；传统清单 ordinal：`9`。规格状态：**`decision-required`**。观察到对应实现，但 formal 的业务命令/回复、计算端口适配和外部入站分支不能仅凭改排版裁定；不是“完全没有 renderer”。
- 固定 JS HEAD：`bf104e16ab82ef39d7fa416d0997907d18a815ad`；固定 BC HEAD：`cc335eb1e0d0fae17bf092fd61b126040196ea70`。字节身份以 [baseline/index.json](../baseline/index.json) 的 `source/snapshot/bytes/sha256` 为准，不以 HEAD 覆盖工作副本差异。
- 授权依据：[AUTHORING-CONTRACT](../AUTHORING-CONTRACT.md)、[layout-and-style](../layout-and-style.md)、[APPROVED-PLAN](../../../.rounds/prettify-generated-code-resume-20261115-cgr9lzlk/APPROVED-PLAN.md)。本文不修改这些文件。
- 本次只读源内容并保存本文及 `details/aggregate-behavior.json`；未执行测试、typecheck、编译、生成、runtime、服务、下载或 Git 写操作。未改变 truth，因此不需要、也没有执行 validate/roundtrip。已有 diff 均不写入；没有把旧 workflow 的 null 结果算作成功。
- **不存在本轮同输入双端生成文件**。下面 `raw-scala` 是完整生产 MBT 和其可判定发射合同；`curated-reference` 是人工参考；`approved-target` 是已批准规则约束下的目标规格和明确标注的参考实例；`actual-js` 是银行现存输出的冻结字节。结构性对照不等于同输入字节一致或运行有效。

### 1.1 主来源指纹与完整固定链接

下表列出的主 MBT 已全文阅读；附录另将主源码展开，正文逐字段/规则/construct 给出解释。支撑文件通过固定链接与精确行号定位，不指向可变生产目录。

|键|完整固定文件|bytes|SHA-256|
|---|---|---:|---|
|M|[AggregateBehaviorModel.scala L1–44](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/AggregateBehaviorModel.scala#L1-L44)|2548|`db5dfd528c14edc01a1badc84bf64d49d3dbf4de054060fd55213c6c0d03b2dd`|
|B|[AggregateBehaviorBuilder.scala L1–354](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L1-L354)|15859|`18fbec829c7443ae61c17cc11e13d2ef394832d6066a515c3711a71b0937f341`|
|T|[AggregateBehaviorTemplate.scala L1–183](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateBehaviorTemplate.scala#L1-L183)|8682|`8e01fd549619334ed21a5eb78f5bbd2aa9889f93d8af94d18ea5233d3456410e`|
|JB|[formal build-aggregate-models.mjs L1–42](../baseline/js/generators/scala-cqrs-play-service/build-aggregate-models.mjs#L1-L42)|3000|`c8635d726883a673801ab4d053005de8a3462913ba79c617813bc130270538c3`|
|JT|[formal aggregate-behavior.mjs L1–72](../baseline/js/generators/scala-cqrs-play-service/templates/aggregate-behavior.mjs#L1-L72)|3251|`67258519bda190fe1deee08dd66357a6800bd8c2723960361b767db4fdeb86d5`|
|L|[legacy aggregate-dsl/render.mjs（完整文件；行为段 L943–1014）](../baseline/js/generators/aggregate-dsl/render.mjs#L943-L1014)|58572|`25a3fb8ca368109510f118a5f4ff6524ce481a64f004f8ed67bff8b6749f4aab`|
|F|[family aggregate.mjs L1–16](../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/aggregate.mjs#L1-L16)|1828|`731bf3e5b158ec4158b9043072e2d9be97ad22ebd3065683bc6c3ef02f06417c`|
|R|[curated CreditBalanceBehaviors.scala L1–57](../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L1-L57)|2615|`ee01261c6fbe640134dbcbc3c764882e8d5c2fd91897191a1048ad22e81d3d96`|
|J-CB|[actual CreditBalanceBehaviors.scala L1–48](../baseline/actual-js/app/example/bankwealth/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L1-L47)|2013|`deceb1bdca765d235a69c4f8d5a701a9c7275443cb4c95492887267a1caa2722`|
|J-FO|[actual FundOrderBehaviors.scala L1–135](../baseline/actual-js/app/example/bankwealth/application/aggregates/behaviors/FundOrderBehaviors.scala#L1-L134)|10144|`ace178ff3d8334f4c24ed7991fa2ab8e123667a7a44156296168713aaf214450`|
|J-SP|[actual SipPlanBehaviors.scala L1–70](../baseline/actual-js/app/example/bankwealth/application/aggregates/behaviors/SipPlanBehaviors.scala#L1-L69)|3208|`6202376ae985f7dcbf6a14c6a22d3be74d3d56a466e5b1b0eb6b402cfec124f0`|

主来源字节长度和 SHA 已用只读散列对照 index；这不是生成或行为验证。

### 1.2 调度、基数、变体与目标路径

真实传统入口：[CodegenMain L183–201](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L183-L201) 的非 `semanticProductsFile` 分支，先 `prepare`，再 scaffold copy；[runCommon L192–220](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L192-L220) 调用 application layer。不是 `template/products` 分支。

[application layer L603–679](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L603-L679) 对 `app.aggregates` 每项依次发 Root、Protocol、Factory、Behavior；Behavior 不以“是否有 flows”为调度开关。B 的解析异常会先阻断；[writeArtifact L359–412](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L359-L412) 另受 scope/领地限制。归属 `kind="behavior-skeleton"`，schemaCategory 在 `metaCategory == "application.services.transactor"` 时为 saga，否则 aggregate；其后 Helpers 才条件跳过 Saga。不能从该跳过条件推断 Behavior 的 `commandHelpers=None`：B L74 **始终 Some**。

|变体|真实条件与结果|生产可达性 / 当前证据|
|---|---|---|
|policy-groups|有非只读 flow，按元数据组/flow 顺序发 policy 分支|Builder 可达；curated 展示业务组合，未做同输入生成|
|query-group|任意 `isReadOnly`；必须有 `replyToType`；尾加 `QueryBehaviors`|可与其他组同文件；Get*StateReply 有机械 body，其他 reply body 是 `???`|
|transient-fallback|全部既有写组均无 handler；逐个匹配 Run/Complete/Fail + base|可达；不是必须凑齐三命令；本次银行冻结输出没有该形式|
|formal-rule-group|存在同名 formal aggregate，未被既有组覆盖的非只读命令，事件/守卫全可解析|尾加 `FormalRuleBehaviors`；无可解析 handler 时不加组|
|empty-apply-slot|有 Helpers，但 `funcCalls` 空或所有组无 handler|仍发一个文件；MANUAL apply 内 `???`，不是空成功|
|without-helpers / context|T 接收 `commandHelpers=None`；context Some 或 repository/Any fallback|模板分支存在，但本次传统 B 不构造该输入。保留合同，不宣称经典 Saga 已从此入口到达|
|scope-suppressed|writer scope 不包含 attribution|writer 记录归属后可跳过写入；与空 handler 不同|

输出基数：每个成功构造且允许写入的 aggregate **1 个 `<Base>Behaviors.scala`**，组/命令多少不增加文件数。单工程完整模式为 `<target>/app/<base-as-path>/application/aggregates/behaviors/<Base>Behaviors.scala`；多工程 `behavior-skeleton → kernel`，完整模式为 `<target>/modules/kernel/src/main/scala/<base-as-path>/application/aggregates/behaviors/<Base>Behaviors.scala`（[module map L331–349](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L331-L349)）。模板无 Helpers 并不自动改变 `selfType` 包/文件。

本项先行参考选 **single-project**；示例目标路径 `<new-target>/app/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala`。银行未来同层完整路径分别为 `<new-target>/app/example/bankwealth/application/aggregates/behaviors/{CreditBalance,FundOrder,SipPlan}Behaviors.scala`；花括号仅表示这三个已观察文件，不声称已决定每个文件的新业务回复。多模块是另一个显式 fixture，不与 single-profile 字节混签。

## 2. Model 逐字段及依赖合同

完整源码在附录 A。M 的源码注释“Production Ready”只是原文，不能用作本次状态。主 case class 无自定义方法/构造器重载，继承 `ArtifactModel`；`selfType` 是模型字段，不是生成 Scala 的 self-type annotation。

|顺序 / 字段|准确类型、默认|使用与 JS 差距|
|---|---|---|
|1 `override val selfType`|`TypeRef`，无默认|B resolver 得 Behaviors 类型；T package/object；writer 文件名。JB 以 `names`/`artifact.path` 拆存，不是同构 TypeRef|
|2 `aggregateType`|`TypeRef`，无默认|用来推 Protocol wildcard、handler alias 名及无 Helpers 分支 PID；B 已指 application，M 的 domain 示例注释陈旧|
|3 `stateType`|`TypeRef`，无默认|所有 handler/apply/thenReply/state 构造；formal 硬编码 Entity 的 `State` alias|
|4 `eventType`|`TypeRef`，无默认|`Effect[Event,State]` 和暂态事件 owner；formal 硬编码 `Event` alias|
|5 `commandType`|`TypeRef`，无默认|B 放入 command family，而非注释示意单个 Withdraw；T PF 入参/Behavior 泛型|
|6 `commandHelpers`|`Option[TypeRef]`，**无默认**|B 永远 `Some(commandHelpers)`；T 取 `.name` 为父 trait 或切无 Helpers actor 分支。formal object 不继承 helper|
|7 `behaviorGroups`|`Seq[BehaviorGroupModel]`，无默认|保持顺序，控制 orElse 优先级；formal 是固定 external/query/execution，缺业务组名与 HandlerLogic|
|8 `override val dependencies`|`Set[TypeRef]`，无默认|B 的具体集合见 B16；imports 与 ledger；formal 是文件路径数组且 import 字符串另拼|
|9 `override val noteIds`|`Seq[String] = Nil`|B `meta.noteId.toSeq`；writer 记文件级归属；不是 template 新增 @knowledge|
|10 `contextType`|`Option[TypeRef] = None`|B 未赋值；T 控制 sagaContext 参数/arg；formal 对应的是 authority/hosts，不可当同义字段|

子型/支持结构（无隐含默认）：

- `BehaviorGroupModel(name: String, handlers: Seq[CommandHandlerModel])`，输入顺序就是发射顺序。
- `CommandHandlerModel(commandType: TypeRef, logic: HandlerLogic, groupName: String = "default")`；T 只消费前两项，`groupName` 不控制分组方法名。
- `sealed trait HandlerLogic`；`PolicyBasedLogic(policy: TypeRef, helper: TypeRef)`、`ReadOnlyLogic(replyType: TypeRef)`、`TransientCommandLogic(eventName: String, eventArgs: String)`。最后一项 `eventArgs` 是明确的**源码字符串槽**，不是纯结构表达式。
- `EmittedEvent(name: String, args: Seq[String])` 不是 HandlerLogic；B formal admission 暂用，其解析结果只用来判断是否可接规则，没有由 T 直接发射这批 events。`args` 也包含代码字符串。
- [ArtifactModel L5–47](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L5-L47)：继承 `fqn = selfType.packageName + "." + selfType.name`、`registerTo(registry)=registry.register(this)`、`morphisms=Nil`；M 覆盖 noteIds，未覆盖 morphisms。formal `sources/codeMappings` 不应伪造此处没有的成员级 Scala 来源。
- [TypeRef L4–52](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4-L52)：`name/packageName/typeParams=Nil`；fqn 无泛型；signature 可输出 Tuple 语法、泛型或简名；`collectAllDependencies` 递归；`shouldImport` 排除空包/当前包/scala/java.lang。**本 B 未调用递归收集，本 T 多处用 `.name` 而非 `.signature`**，不能说该族已完全解决泛型/import。

## 3. Builder 全规则账（按源码顺序）

以下 Bxx 均链接到同一固定 [完整 B](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala)。全文见附录 B。不存在从命名推导未观察算法的补充。

|稳定键 / 源位置|输入 → RHS、分支与输出|目标处理 / JS 当前关系|
|---|---|---|
|B01 [L23–79](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L23-L79)|先 behaviors 包/selfType，五基础类型，再 registry behavior。写命令 `filter(!_.isReadOnly)`，构写组；读命令 `filter(_.isReadOnly)` 非空则尾加 query；再追加 formal；随后 dependencies、CommandRef(family.name)、按 M 字段位置构造，noteIds 具名，context 缺省|JS 应分显式模型与构建，不允许 content 代替模型。元数据/组序缺口 D1|
|B02 [L83–97](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L83-L97)|aggPkg 为 application.aggregates.root；`aggregateType(aggregateRootName(getBaseName(meta.name)), aggPkg)`；依次 commandHelper(meta)、entityState(stateRef)、eventFamily(eventFamilyRef)、entity(entityRef.targetName)，返回五元组|不可沿用 domain Aggregate 作为 protocol owner|
|B03 [L101–113](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L101-L113)|`resolveByName[AggregateBehaviorMetadata](behaviorRef.targetName)`；缺失抛 `IllegalStateException("Failed to resolve behavior metadata for aggregate '…'. Expected behavior metadata '…' not found in registry.")`|不以空组掩盖缺 metadata；formal 没有此输入槽|
|B04 [L117–139](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L117-L139)|逐 groupMeta；flows.flatMap(buildCommandHandler)；保留每个组名，包括空组。只要任一组有 handler 就返回全部原组。全部空才尝试 transient；非空则**替换全部组**为 `<getBaseName(meta.name)>TransientBehaviors`，否则保留原空组|不是每个未覆盖命令都跑 transient；不自作主张删除空组|
|B05 [L142–161](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L142-L161)|TransientVerbs 按 `Run→RunStarted, Complete→RunCompleted, Fail→RunFailed`。base=`getBaseName(meta.name).replaceAll("Aggregate$", "")`；每个 verb 对非只读命令 find 精确 `verb+base`；eventName=`base+suffix`；Run args=`cmd.id, "", cmd.triggeredBy, java.time.Instant.now()`；其余=`cmd.id, cmd.result, cmd.triggeredBy, java.time.Instant.now()`；groupName=verbCmd|未校验必须三件套、事件存在/字段/类型，也不是注释中的 state.result。保留原槽，是否采用需 D4；时钟位于应用命令边界，不搬到纯领域|
|B06 [L167–186](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L167-L186)|formalSemantics.toVector 中找 aggregate==meta.name，headOption。emissions 以 event.replace('-','_') 为 key，guards 以 command 为 key，toMap 对重键以后项为准；eventFamily registry 可无；state VO fields 缺省 Vector.empty；covered 为已有 handler.commandType.name 集合。按命令原序过滤 readOnly/covered，再 flatMap B07；空不发组，否则单个 FormalRuleBehaviors|覆盖不是按业务ID对象，而是名字；可能与 JS 名称 resolver 不同。不能把 formal 与 legacy rule schemas 默认为等价|
|B07 [L190–215](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L190-L215)|无 family→None；paramNames 为全部 cmd.parameters 名；produced 按 family.events 顺序筛 producedBy.targetName==cmd.name；零事件→None；任一 emission None→None；guards 缺省空 Vector，任一 B09 None→None。成功只构 `PolicyBasedLogic(TypeRef(cmd.name+"Rule", domain.invariants.root+"."+meta.name+"Rules"), commandHelper(cmd.name+"Helper"))`，cmdType=command(CommandRef(cmd.name))，groupName=cmd.name|rule name 是裸成员，owner 放 package，用 member import，而非再次限定对象。emission/guard 解析体没有塞进 behavior；应与 rules-formal 组共享 admission 结果，避免漂移|
|B08 [L217–229](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L217-L229)|事件无 fields→Some(EmittedEvent(ev.name,Nil))；否则 emission.bindings.toMap 或空 map，逐字段取 binding 并 B10 解析；任一缺→None，全部成功按字段序 args.flatten|无字段事件即使 emission 不在也可通过；不是推测默认 event payload|
|B09 [L231–251](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L231-L251)|raw 必须 obj；errCode 必须 str；onFail 非 str/缺省得到 reject，仅 reject/succeed-empty；when 必须 obj、form 必须 str 且在五项集合。param(key) 要 `param.` 前缀并在 paramNames；stateField(key) 要直接命中 state fields。money-positive=amount；money-sufficient=amount AND in；map-contains/map-absent=map AND key；collection-covered=map AND collection。ok→Some(())，否则 None|只做形状/引用可判定性，不执行业务守卫、不核 Money 类型。禁止以此签收规则算法|
|B10 [L253–266](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L253-L266)|param.x 存在→`p.x`；receipt.slot 若同名参数存在→`p.slot`，否则仅 txid 存在且 slot 属 reservation/receiptId→`p.txid + ":receipt:<slot>"`；literal: 后文本先转义反斜杠/双引号并加引号；其他 None|固定 receipt 字符串是身份/业务债，不为“统一风格”改成 hash 或新格式|
|B11 [L270–288](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L270-L288)|仅 mutatingCommands.find(name==flow.commandRef.targetName) 才产 handler；cmdMeta 值未使用；rule=invariantRule(flow.invariantRef.targetName)；helper=`commandRef.targetName+"Helper"`，commandType=resolver command(flow.commandRef)，groupName 同命令名|不读 flow 的成功/失败 reply mapping；那是 CommandHelpersBuilder 的职责。B 此处不验证 replyTo|
|B12 [L292–311](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L292-L311)|每只读命令先 resolve command；replyToType.map(resolve)，缺失抛 `IllegalStateException("Read-only command '<name>' must define a reply type")`；handler logic=ReadOnlyLogic(replyType)，groupName=QueryBehaviors；返回同名组|读命令不产写 Helper；T 非 Get*StateReply 保留 ???，不能随便回复整个 state|
|B13 [L325–332](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L325-L332)|framework map 直接索引 runReplyingPolicy 与 Effect；缺 key 会失败。logicDeps：policy→Set(p,h)，readonly→Set(reply)，其他→空|无 transient event/Reply 类型递归收集；不要谎称 deps 完备|
|B14 [L334–338](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L334-L338)|所有 command 都 resolve（包括未被 handler 覆盖的）并加 family；不是只收已有 cases|未覆盖命令仍可能被 import；imports 不证明已处理|
|B15 [L340–342](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L340-L342)|aggregateProtocol(meta)，用 Protocol 依赖断开 Aggregate 环；collectDependencies 的 aggregateType 入参未使用|formal protocol alias 仍指 legacy domain carrier，尚未形成该方向|
|B16 [L343–353](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L343-L353)|Set(protocol,state,event,runReplyingPolicy,Effect,entity) ++ 全 commands/family ++ logicDeps，再 `filter(_.shouldImport(pkg))`。没有 commandHelpers trait/context/repository 的显式加入，也没有 typeParams 递归|JS 新结构收齐真正依赖须列为显式修复，而非声称逐字 raw。同包 helper 靠继承可见；repo Any fallback 不能凭空补库|

支撑解析的精确限制：

- [PackageLayout L27–29、L45–51](../baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala#L27-L51) 是 **`.domain.invariant` 单数**，curated 使用 `.domain.invariants` 复数；二者分开。目标遵循已批准 layout 单数，不修改参考文件。
- [NamingConventions L187–224](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L187-L224) 按有序 suffix 列表剥离并保留最后非空值，不是无限反复剥离；[L258–260](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L258-L260) getAggregateBaseName 只 removeSuffix Aggregate；[L589–591](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L589-L591) helper trait 为此基名加 CommandHelpers。
- [TypeResolverDSL L371–379](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L371-L379) invariantRule=getBaseName+Rule；注释说去 Rule，但 getBaseName 实际 suffix 列表未列 Rule，故不能保证任何输入都去重。BC 也不是毫无命名债。
- [L446–459](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L446-L459) aggregateBehavior(meta) 先 getAggregateBaseName 再 aggregateBehavior(String) 的 getBaseName；[L614–624](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L614-L624) commandHelper 固定 behaviors 包。
- [TypeResolver L19–93](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala#L19-L93) 包括递归 CustomType、已知框架类型优先、`net.imadz.domain.values` 重定向、未知分支 Any 和 `resolveMetaRef=???`；[L95–148](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala#L95-L148) 嵌套 owner 按 metadata 分类/名称 fallback。此处未执行 registry 解析，不能臆造某个 fixture 的最终全部 imports。

**空洞诊断要精确**：B07 的不可解析命令被 flatMap 丢弃，而非自动生成每命令 `case … => ???`。如果别的 handler 存在，T 会调用部分函数 `.apply(command)`，未覆盖命令可能不匹配；只有整组全空才出现 apply 级 ???。raw 注释“命令保持 ???”不等于逐命令实发结果。D5 要裁定安全准入/显式实现槽，不能吞掉命令后回复 Accepted。

## 4. Template 发射账：构造、顺序、全部 RHS

完整 T 在附录 C。源码的重复 NamingConventions import 是**生成器源码**的重复，不是产物重复来源。产物顺序始终 package → imports → 单 object（apply 部分在前、组方法在后）；T 内先计算 groupsCode 不改变此顺序。

|稳定键 / T 位置|完整构造与规则 / RHS|目标约束|
|---|---|---|
|T01 L12|`toCamelCase(s)=s.head.toLower+s.tail`；空串会失败，既不分词也不做保留字处理|目标统一 resolver；名字修复不可改 source identity|
|T02 L16–36|package=`selfType.packageName`。baseImports=`dependencies.toList.sortBy(_.fqn).map(_.fqn).distinct`。aggregateType.name endsWith SagaTransactor 时 import `commandType.packageName._`，否则对 **整个 aggregateType.fqn** `.replace("Aggregate","Protocol")` 后加 `._`。再追加固定 runReplyingPolicy、duration wildcard|D6：对象名替代不能误替包内单词；raw 规则保留对照|
|T03 / DSL|[ImportDeclaration L20–22](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L20-L22) 对最终列表再 `.sorted`，**不去重**。runReplyingPolicy 常同时来自 dependencies 和 additionalImports，故 raw 可重复 import。没有 Scala/JDK/框架/项目分组注释|approved-target 去重、有来源的 normal imports，A 的排序/分组在本表固定，不以 wildcard 掩盖缺 deps；正文参考实例用显式 rule imports|
|T04 L38–56|extendsClause=`commandHelpers.map(_.name).getOrElse("")`；handler alias 名=`aggregateType.name+"CommandHandler"`；commandTypeName=`commandType.name`。context Some→`sagaContext: ctx.name`，None→从 Set.find(name.endsWith Repository) 取名否则 Any；arg 相应 sagaContext/repo；eventObjFqn=`eventType.packageName`；ctxName 计算后未使用|不得把 Any fallback 变万能 dispatcher；repo 多候选次序没保障，D4|
|T05 L59–75|按 behaviorGroups 顺序、其 handlers 顺序。AI_PROMPT 文字依次 Context/Task(command name)/State/Available(dependencyArg)/Expected Result；仅 readonly/transient 输出它，policy 分支不输出|prompt 说 Available repo 不表示正常 `(state)` 分支有 repo 参数|
|T06 L77–79|policy case 完整为 `case cmd: C => runReplyingPolicy(P, H)(state, cmd).replyWith(cmd.replyTo)`，P/H 用 `.name`，不构造 `new`、不注入 hosts|保留 typed 对象式规则合同；若规则依赖 hosts，须先解决 D2，不能丢依赖|
|T07 L80–88|readonly reply.name startsWith Get 且 endsWith StateReply→`ReplyType(state)`；否则 `???`；完整 body 为 AI_PROMPT 后 `Effect.reply(cmd.replyTo)(replyExpr)`|不 persist；非标准查询必须给真实 mapping，不推广 state 通配成功|
|T08 L89–94|transient body：AI_PROMPT；`Effect.persist(eventType.packageName.EventName(eventArgs)).thenReply(cmd.replyTo)((_: StateType) => CmdNameReply(None))`；`case _` 的 HandlerLogic renderer 返回空串|不同于 M 注释的“无业务回复”；命令事件/回执身份不变，构造类型待 D4|
|T09 L99–107|有 Helpers：每组 `private def lowerFirstGroup(state: State): PartialFunction[Command, Effect[Event, State]] = { cases }`。无 Helpers：依次 state、FQN ActorContext[Command]、FQN EntityRef[SagaTransactionCoordinator.Command]、dependencyParam。cases 用换行，groups 也用单换行拼接|无隐式/柯里化方法参数、无泛型 bounds；这些方法的泛型只在返回类型。同名/空组不私自删除|
|T10 L110–127|无 Helpers 时仅发 `def apply(id: String, coordinator: EntityRef[...], dependencyParam): Behavior[Command]`；`Behaviors.setup { context => implicit val ec: ExecutionContext = context.executionContext; EventSourcedBehavior[Command,Event,State](persistenceId=PersistenceId(aggregateType.name.replace("SagaTransactor", "")+"Transaction",id), emptyState=State(id=Some(id)), commandHandler=(state,cmd)=>lowerFirst(headGroup)(state,context,coordinator,arg).apply(cmd), eventHandler=(state,event)=>state.applyEvent(event)).onPersistFailure(SupervisorStrategy.restartWithBackoff(200.millis,5.seconds,0.1)) }`|**只调用第一组，不组合其余组；groups 空会 head 失败。** 此 actor 分支主 B 不构造。PID 两参数和后缀不改，不能移作普通聚合默认算法|
|T11 L129–146|有 Helpers：funcCalls 为各 `group(state)`；hasHandlers=exists(nonEmpty)。二者都满足→`type AggregateNameCommandHandler = (State, Command) => Effect[Event, State]`；`def apply: Alias = (state, command) => { BEGIN MANUAL; first.orElse(tail1)… .apply(command); END MANUAL }`|orElse 左优先，含空组；MANUAL 归最近 def apply。默认链与手写保留块是两种来源|
|T12 L147–163|不满足 T11→同一 type alias/def apply/MANUAL，含两行原 TODO，RHS=`???`|不是抛异常替代方案、不是真实业务实现，更不是 `Effect.none` 或空事件成功|
|T13 L166–181 / DSL|ObjectDefinition(name=selfType.name, extendsClause=Some(helper name) iff 非空, body=`applyMethod+"\n"+groupsCode`)；不设 implementsClause。SourceFile 只有此 definition。[DSL L60–84](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L60-L84)：object braces/body、parts 用双换行拼接再尾换行|无 class/trait/case class、无 companion、无 annotation/self-type/字段/secondary constructor。无 Helpers 支路的局部 implicit ec 是唯一此类 val；普通分支没有 lazy/var/implicit 成员。别族 CommandHelpers 的 implicit objects 不归本文件|
|T14 / writer|T 返回 `sourceFile.code`；[writer L406–412](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L406-L412) 另加 fingerprintHeader 后 territorial write，noteIds/deps/morphisms 是 writer 归属|格式完成后再 fingerprint / anchor，不保留旧偏移|

## 5. JS 三条真实路线与四层差距

### 5.1 formal 银行路线（不是仅根据目录名判断）

[generate-cli L92–101](../baseline/js/lib/products/generate-cli.mjs#L92-L101) 注册 `scala-cqrs-play-service`；[service generate L16–23](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L16-L23) 从 `createEffectRegistry('2')` 继承并**覆盖 producer id `aggregate-dsl`**，调用 `renderAggregateLayers`；[renderAggregateLayers L10–29](../baseline/js/generators/scala-cqrs-play-service/render-aggregate-layers.mjs#L10-L29) 按 role 选 behaviorTemplate 并由 `entry` 组装。继承 producer 的名字不说明它调用 legacy 同名目录的 render。

JB 的完整构建次序如下，不以“有 build 文件”代替 MBT 对齐：

1. 从 `reference-layout.declarations` 筛 aggregate；`owns(ref)` 精确 context 相同且 owner[0]==aggregate.id。
2. 按 declarations 顺序筛 command，按 domain-dependencies.externalProducers 顺序筛外部 producer。
3. `aggregateNames` 计算 names/paths；commandSources 为 aggregate.source 后接 command.source；shared={aggregate,names,authority:external.length>0}。
4. groups 顺序固定为可选 external（producer id/names/outputType/source）、query、execution（command ref/source）。没有 B 的 groupMeta.name、policy/helper TypeRef 或 reply mapping。
5. aliases 固定 Execute/GetState/Accepted/Refused，再接 ingress names。返回 roles 的顺序为 legacy/protocol/behavior/aggregate/factory/bootstrap/repository；behavior 与 aggregate 两个物理文件均标 `kind='aggregate-behavior'`，必须用 role/path 区分，不能一条 kind 算一个族。
6. behavior.artifact.sources 是 commandSources 加所有 external sources；deps 是 protocol/entity/rules/helpers 和可选 external。`copyImmutableData(models)` 形成不可变数据。path deps 不能代替 TypeRef/import 模型。

[aggregateNames L3–24](../baseline/js/generators/scala-cqrs-play-service/aggregate-names.mjs#L3-L24) 的 behavior 路径已在正确三层内，但 helpers 指向 `.domain`、rules 指平铺 domain wrapper、protocol 依赖 legacy domain carrier；必须迁依赖而非只移动 Behaviors。`externalNames` L27–30 用 id 的 `-→_` 再前加 Ingest，产生 `Ingestbank_…`；改源码名不能改 authorize 的 producer id/identity key。

JT 输出构造账（整个 72 行已读）：

|位置|实际完整规则|与目标的内容差异|
|---|---|---|
|L3–19|从 names 解 name/package/protocol；authority 后缀可选；calls 由 group.kind 映到固定三个方法；package；imports 固定 Effect、app Protocol wildcard、Entity `{Event, State}`、domain Computations/Payload alias/Rules/可选 ExternalEvents；object 无继承；apply(hosts[,authority]): CommandHandler = lambda，按 calls 顺序 orElse|参数依赖要保留且类型化；继承 Helpers 缺失；长 FQN/alias 布局由其他族共同迁移|
|L20–37|codeMappings=[]；external 组依次生成 ingress(output,authorization,reply)。`!authority.authorize(JSON.stringify(id),authorization,ExternalEvents.identity(output))`→none.thenRun(reply ! Refused("external-authority-denied"))；else persist(ExternalEvents.method(output)).thenRun(reply ! Accepted(Vector(ExternalEvents.method(output))))|相同 event constructor 调用两次；授权先于 persist。不是 Scala policy 的现成 counterpart；D3 不允许删授权或伪装普通成功|
|L38–44|query PF 无 state 参数，GetState(reply)→Effect.none.thenRun((s:State)=>reply ! s)|不持久化，但未用标准 Effect.reply；回复类型为 state，不能自动换 GetBalanceConfirmation|
|L45–68|execution PF(state,hosts)；外 Execute(command,reply)；内 command match；逐命令 `case p: Payload.symbol(id) => Rules.symbol(id)(state,p,hosts)`；decision match：Left(code)→none.thenRun(Refused(code))；Right(events)→persist(events).thenRun(Accepted(events))|回复返回 events，并没有调用 helper 读新 state。**不是声称 thenRun 在 persist 之前执行**；问题是回执 RHS/模型不等价。未单独处理 empty events|
|L27–35、L51–57|每 external case / 每 command case 用 content.length 记 span，scope=span；命令构造、失败成功统一尾部不各有独立 source mapping|迁移必须保留并重定位命令来源；共享 tail 来源策略需明确|
|L69–71|不认识的 group.kind 抛 TypeError；返回 `{content:content+'}\n',codeMappings}`|不是万能无类型 dispatcher；目标同样拒绝未知 logic|

[entry L25–31](../baseline/js/generators/scala-cqrs-domain/naming.mjs#L25-L31) 添加固定 `// @generated by truthsrc scala-cqrs-domain:1`，由 JS string offsets 转为含 header 的 UTF-8 byte span；写入 kind/deps/knowledgeIds/productFootprint/merge:null。因此银行文件头写 domain **不代表**没有经 play-service behaviorTemplate。后续格式化若在 entry 之后进行会使 spans 失效。

共享 [renderCommand L20–53](../baseline/js/generators/scala-cqrs-domain/render-domain.mjs#L20-L53) 发 domain Command/Event、Computations 与 emit* CommandHelpers；[renderInvariant L57–91](../baseline/js/generators/scala-cqrs-domain/render-domain.mjs#L57-L91) 规则返回 `Either[String, Vector[Event]]`，layered Params 甚至包 state/command/hosts，再经 domain wrapper。它不是 `InvariantRule[Event,State,Param]` 的 `Either[iMadzError,List[Event]]`；不能只替换 `.thenRun` 为 `runReplyingPolicy` 而忽略接口。

### 5.2 legacy-only 近似 renderer

[aggregate-dsl/emit.mjs L3–10](../baseline/js/generators/aggregate-dsl/emit.mjs#L3-L10) 直接 import `./render.mjs`，解析 spec，写 result.files，实体可写到独立 `spec.entityDir`。这是证实可调用的 legacy CLI，**不走 formal registeredProductProducer**。同目录 [produce.mjs L1–7](../baseline/js/generators/aggregate-dsl/produce.mjs#L1-L7) 实际调用的是 `renderAggregate` 与 `renderActors`，并不 import 该 legacy render，不能用目录归属推出接线。

L 的行为相关 Builder/Template 在同一巨型函数：

- [L99–120](../baseline/js/generators/aggregate-dsl/render.mjs#L99-L120)：objectName 或 pascal(name) 默认 Aggregate；package 默认 generated.aggregate，state/event 默认 `<obj>State/Event`；family=`<obj>CommandFamily`，handlerFamily=`<obj>CommandHandlerFamily`；handled 是 commandHandlers.command 集合。命令非 Get 前、Get 后，两区按 codepoint name 排序，与 B 的组/flow 顺序不同。
- [L705–720](../baseline/js/generators/aggregate-dsl/render.mjs#L705-L720)：从 handlerPortMembers 取 member/fqn/trait；对 command.decision/emissionBindings 的 JSON 字符串查 `member.` 或 `member(`，形成 cmdPortRefs；behaviorPorts 为被命令引用的 ports。该文本依赖推导不是结构 TypeRef。
- [L943–982](../baseline/js/generators/aggregate-dsl/render.mjs#L943-L982)：invariantPackage 或 `${pkg}.invariant`；仅有 handled 才 import Rules。sagaFace && queryCommands.has(name) 优先→Effect.reply(cmd.replyTo)(Get<obj>StateReply(state))；否则 handled→`runReplyingPolicy(rule, nameHelper)(state,cmd).replyWith(cmd.replyTo)`。rule 有 ports 时是 `new <obj>Rules.<cmd>Rule(portMembers...)`，否则对象 member；未 handled→typed wildcard case、AI_PROMPT(repo)、`???`。
- [L984–1014](../baseline/js/generators/aggregate-dsl/render.mjs#L984-L1014)：固定两行生成头；pkg.behaviors；Effect/runReplyingPolicy/Protocol wildcard/Entity event/state/条件 rules+ports imports；Javadoc（withPost 说明不等于此文件调用 withPost）；object extends CommandHelpers；本地 `<obj>AggregateCommandHandler` alias；有 ports 时 apply 逐项 require 非 null 并捕获闭包，无则参数less apply；唯一 defaultBehaviors(state[,ports]) 中放上述 cases。无 B 的多业务组 orElse、formal admission、transient fallback、apply MANUAL。
- [legacy CommandHelper L38–89](../baseline/js/generators/command-dsl/render.mjs#L38-L89) 的三个方法是真实近似，但固定 Params 投影与 Some(error)/None 回复，不能拿它证明用户 Deposit 更新后余额回复已完成。

处置：`adapt / not-wired`，可借结构与既有 ports 接法，不整文件搬运，不复活旧 writer；legacy 全文件同时装 Entity/Protocol/Aggregate/EventHandler/Factory，唯一组装 owner 见第 9 节。

### 5.3 family 路线（可达但职责合并）

[registered producer L97–101](../baseline/js/lib/products/generate-cli.mjs#L97-L101) 明确注册 aggregate-core；[generate L11–23](../baseline/js/generators/scala-cqrs-aggregate-core-v1/generate.mjs#L11-L23) 要求 profile `scala-cqrs-aggregate-core@1`，先 buildModels 再 render；[productionJobs L15–24](../baseline/js/generators/scala-cqrs-aggregate-core-v1/render.mjs#L15-L24) 输出 aggregateTemplate，没有独立 Behaviors job。

[family build-models L18–29](../baseline/js/generators/scala-cqrs-aggregate-core-v1/build-models.mjs#L18-L29) 把 helper 放 domain.command / kernel、aggregate 放 application.aggregates / glue；[L64–74](../baseline/js/generators/scala-cqrs-aggregate-core-v1/build-models.mjs#L64-L74) 复用 kernel、明确拒绝 externalProducers；[L139–181](../baseline/js/generators/scala-cqrs-aggregate-core-v1/build-models.mjs#L139-L181) 以显式 guards/emissions/slots/依赖闭包构模型；[L221–247](../baseline/js/generators/scala-cqrs-aggregate-core-v1/build-models.mjs#L221-L247) 收 sources/refs/directDeps，检查实际输出、方向与 portable path collision。不是完全缺结构模型，但仍未对应 M 的行为组/Helper 契约。

F 的完整 emitted body：object；`commandHandler(hosts)` 返回 `(State, ActorProtocol.Command) => Effect[Protocol.Event,State]`；先 require(hosts!=null)，再 `(state,envelope)=>envelope match`；GetState→`Effect.none[…].thenReply(replyTo)(_=>state)`；Execute→Rules.decide(state,command,hosts)；Left→none.thenReply(Rejected(code))；Right 且 events.isEmpty→none.thenReply(Accepted(events))；Right 非空→persist(events).thenReply(Accepted(events))。imports 由 importsFor 决定，actorProtocol wildcard 插在第一个 import 后。其 thenReply 已存在，但成功 lambda 忽略新 state，仍是 events reply；不得把 family 这一点说成 formal 已修复。

[family command-helpers L3–26](../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/command-helpers.mjs#L3-L26) 仍是 emit 方法 `Vector[Event]`，inline 条件为零事件或唯一事件至多一个 ref/literal slot，不是 CommandHelper trait。

共享消费还可由源码调用证实：[persistence-readside productionJobs L1–15](../baseline/js/generators/scala-cqrs-persistence-readside-v1/render.mjs#L1-L15) 调 aggregateProductionJobs(m.family)；[play-application render L1–17](../baseline/js/generators/scala-cqrs-play-application-v1/render.mjs#L1-L17) 再调 productionJobs(m.persistence)。修改 family aggregate 的行为体会影响这些消费；它们不因此成为银行 formal play-service 的实际 renderer。

## 6. 四份视图与结构性 diff

### 6.1 raw-scala 与 curated-reference 不混签

raw 已确定的是附录 M/B/T，**raw-scala 具体生成文件未运行取得**。以下差异不是排版猜测：

|项目|raw-scala|curated-reference|approved-target 处理|
|---|---|---|---|
|alias|对象内 `CreditBalanceAggregateCommandHandler`|从 Protocol import 的 `CreditBalanceCommandHandler`|先保留 raw 本地 alias；其退役必须同 Protocol/Root 统一裁定 D6|
|apply|MANUAL 内默认 orElse 链|无 MANUAL 的直接表达式|保留 raw MANUAL 所有权，格式上按行组合；不能覆盖用户手写块|
|读命令|独立 QueryBehaviors，非 Get*StateReply 为 ???|GetBalance 在 direct 组，回余额列表|此具体参考已给 body；不扩散为所有银行查询算法；其他输入仍走 B12/D5|
|rule imports|domain.invariant 单数；具体 TypeRef deps + 两个 additionalImports|domain.invariants._ 复数|target 单数；去重，正常 imports；不修改 curated 原件|
|transient|应用侧 Instant.now / thenReply CmdReply(None)|无暂态命令样本|不制造银行暂态例，也不把此分支算 exercised|
|helper 业务体|[CommandHelpersBuilder L106–119](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/CommandHelpersBuilder.scala#L106-L119)：Unit→()；formal 单槽→Reply(None/Some(error))；tuple→Reply(param._1,...)；其他→Reply(param,...)|Deposit success→CreditBalanceConfirmation(None,state.accountBalance.values.toList)|用户指定此 Deposit 样本的体必须保留；raw 默认不等于该体，不替所有 reply 猜实现|

**curated-reference 完整内容**（固定 R，保持原包和原算法，不称生成结果）：

```scala
package net.imadz.application.aggregates.behaviors

import akka.persistence.typed.scaladsl.Effect
import net.imadz.application.aggregates.CreditBalanceProtocol._
import net.imadz.common.application.CommandHandlerReplyingBehavior.runReplyingPolicy
import net.imadz.domain.entities.CreditBalanceEntity._
import net.imadz.domain.invariants._

object CreditBalanceBehaviors extends CreditBalanceCommandHelpers {

  // --- 主入口 ---
  def apply: CreditBalanceCommandHandler = (state, command) =>
    directBehaviors(state)
      .orElse(reserveBehaviors(state))
      .orElse(incomingCreditBehaviors(state))
      .apply(command)

  // --- 行为分组 1: 直接操作 (Direct) ---
  private def directBehaviors(state: CreditBalanceState): PartialFunction[CreditBalanceCommand, Effect[CreditBalanceEvent, CreditBalanceState]] = {
    case cmd: AddInitial =>
      runReplyingPolicy(AddInitialOnlyOnceRule, AddInitialHelper)(state, cmd).replyWith(cmd.replyTo)

    case cmd: Withdraw =>
      runReplyingPolicy(WithdrawRule, WithdrawHelper)(state, cmd).replyWith(cmd.replyTo)

    case cmd: Deposit =>
      runReplyingPolicy(DepositRule, DepositHelper)(state, cmd).replyWith(cmd.replyTo)

    case GetBalance(replyTo) =>
      Effect.reply(replyTo)(CreditBalanceConfirmation(None, state.accountBalance.values.toList))
  }

  // --- 行为分组 2: 预留资金 (Reserve) ---
  private def reserveBehaviors(state: CreditBalanceState): PartialFunction[CreditBalanceCommand, Effect[CreditBalanceEvent, CreditBalanceState]] = {
    case cmd: ReserveFunds =>
      runReplyingPolicy(ReserveFundsRule, ReserveFundsHelper)(state, cmd).replyWith(cmd.replyTo)

    case cmd: DeductFunds =>
      runReplyingPolicy(DeductFundsRule, DeductFundsHelper)(state, cmd).replyWith(cmd.replyTo)

    case cmd: ReleaseReservedFunds =>
      runReplyingPolicy(ReleaseReservedFundsRule, ReleaseReservedFundsHelper)(state, cmd).replyWith(cmd.replyTo)
  }

  // --- 行为分组 3: 入账处理 (Incoming Credit) ---
  private def incomingCreditBehaviors(state: CreditBalanceState): PartialFunction[CreditBalanceCommand, Effect[CreditBalanceEvent, CreditBalanceState]] = {
    case cmd: RecordIncomingCredits =>
      runReplyingPolicy(RecordIncomingCreditsRule, RecordIncomingCreditsHelper)(state, cmd).replyWith(cmd.replyTo)

    case cmd: CommitIncomingCredits =>
      runReplyingPolicy(CommitIncomingCreditsRule, CommitIncomingCreditsHelper)(state, cmd).replyWith(cmd.replyTo)

    case cmd: CancelIncomingCredit =>
      runReplyingPolicy(CancelIncomingCreditRule, CancelIncomingCreditHelper)(state, cmd).replyWith(cmd.replyTo)
  }

}
```

逐 construct：R L1 package；L3–7 五 imports；L9 单 object extends helper；L12–16 入口 direct→reserve→incoming 顺序；L19–31 的三个 write cases + 一个只读 case；L34–43 reserve 三写；L46–55 incoming 三写；没有额外状态、构造器、事件定义、发布或 actor setup。这是固定参考中的 **9 个 policy cases + 1 个 query case**，并非银行 J-CB 的 7 个写命令。

### 6.2 approved-target：已确定约束的完整参考实例

下面只实例化上面的 **curated CreditBalance 输入**：按批准布局改 rule 包为单数、按长类型换行、保留 raw alias/MANUAL。它是规格示例，不是已取得的 CLI 输出，也不是给银行凭空新增 Deposit/AddInitial/Withdraw。组的业务体逐个来自 R；未被此参考定义的业务需 D1/D2/D3，不能把此文件复制到银行完成迁移。

```scala
package net.imadz.application.aggregates.behaviors

import akka.persistence.typed.scaladsl.Effect
import net.imadz.application.aggregates.CreditBalanceProtocol._
import net.imadz.common.application.CommandHandlerReplyingBehavior.runReplyingPolicy
import net.imadz.domain.entities.CreditBalanceEntity._
import net.imadz.domain.invariant.{
  AddInitialOnlyOnceRule,
  CancelIncomingCreditRule,
  CommitIncomingCreditsRule,
  DeductFundsRule,
  DepositRule,
  RecordIncomingCreditsRule,
  ReleaseReservedFundsRule,
  ReserveFundsRule,
  WithdrawRule
}

object CreditBalanceBehaviors extends CreditBalanceCommandHelpers {
  type CreditBalanceAggregateCommandHandler =
    (CreditBalanceState, CreditBalanceCommand) =>
      Effect[CreditBalanceEvent, CreditBalanceState]

  // --- 主入口 ---
  def apply: CreditBalanceAggregateCommandHandler = (state, command) => {
    // ==== BEGIN MANUAL ====
    directBehaviors(state)
      .orElse(reserveBehaviors(state))
      .orElse(incomingCreditBehaviors(state))
      .apply(command)
    // ==== END MANUAL ====
  }

  // --- 直接操作 ---
  private def directBehaviors(
      state: CreditBalanceState
  ): PartialFunction[CreditBalanceCommand, Effect[CreditBalanceEvent, CreditBalanceState]] = {
    case cmd: AddInitial =>
      runReplyingPolicy(AddInitialOnlyOnceRule, AddInitialHelper)(state, cmd).replyWith(cmd.replyTo)
    case cmd: Withdraw =>
      runReplyingPolicy(WithdrawRule, WithdrawHelper)(state, cmd).replyWith(cmd.replyTo)
    case cmd: Deposit =>
      runReplyingPolicy(DepositRule, DepositHelper)(state, cmd).replyWith(cmd.replyTo)
    case GetBalance(replyTo) =>
      Effect.reply(replyTo)(CreditBalanceConfirmation(None, state.accountBalance.values.toList))
  }

  // --- 预留资金 ---
  private def reserveBehaviors(
      state: CreditBalanceState
  ): PartialFunction[CreditBalanceCommand, Effect[CreditBalanceEvent, CreditBalanceState]] = {
    case cmd: ReserveFunds =>
      runReplyingPolicy(ReserveFundsRule, ReserveFundsHelper)(state, cmd).replyWith(cmd.replyTo)
    case cmd: DeductFunds =>
      runReplyingPolicy(DeductFundsRule, DeductFundsHelper)(state, cmd).replyWith(cmd.replyTo)
    case cmd: ReleaseReservedFunds =>
      runReplyingPolicy(ReleaseReservedFundsRule, ReleaseReservedFundsHelper)(state, cmd).replyWith(cmd.replyTo)
  }

  // --- 入账处理 ---
  private def incomingCreditBehaviors(
      state: CreditBalanceState
  ): PartialFunction[CreditBalanceCommand, Effect[CreditBalanceEvent, CreditBalanceState]] = {
    case cmd: RecordIncomingCredits =>
      runReplyingPolicy(RecordIncomingCreditsRule, RecordIncomingCreditsHelper)(state, cmd).replyWith(cmd.replyTo)
    case cmd: CommitIncomingCredits =>
      runReplyingPolicy(CommitIncomingCreditsRule, CommitIncomingCreditsHelper)(state, cmd).replyWith(cmd.replyTo)
    case cmd: CancelIncomingCredit =>
      runReplyingPolicy(CancelIncomingCreditRule, CancelIncomingCreditHelper)(state, cmd).replyWith(cmd.replyTo)
  }
}
```

此例没有改 Reply 的名义身份，没有把 Helper 事件工厂挪来充数；apply 链后调用 `.apply(command)` 的 raw 覆盖义务仍在。普通方法 CC 目标 ≤5、嵌套目标 ≤2，**not-measured**。dispatch 例外逐方法审定，不凭此 3 组就宣布通过。

### 6.3 actual-js：CreditBalance 完整冻结输出

```scala
// @generated by truthsrc scala-cqrs-domain:1
package example.bankwealth.application.aggregates.behaviors

import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.application.aggregates.CreditBalanceProtocol._
import example.bankwealth.domain.entities.CreditBalanceEntity.{Event, State}
import example.bankwealth.domain.{CreditBalanceComputations, CreditBalanceProtocol => Payload, CreditBalanceRules}

object CreditBalanceBehaviors {

  def apply(hosts: CreditBalanceComputations): CommandHandler = (state, command) =>
    queryBehavior
      .orElse(executionBehavior(state, hosts))
      .apply(command)

  private def queryBehavior: PartialFunction[Command, Effect[Event, State]] = {
    case GetState(reply) =>
      Effect.none.thenRun((s: State) => reply ! s)
  }

  private def executionBehavior(state: State, hosts: CreditBalanceComputations): PartialFunction[Command, Effect[Event, State]] = {
    case Execute(command, reply) =>
      val decision = command match {
        case p: Payload.InitializeAccount =>
          CreditBalanceRules.InitializeAccount(state, p, hosts)
        case p: Payload.ReserveFunds =>
          CreditBalanceRules.ReserveFunds(state, p, hosts)
        case p: Payload.DeductFunds =>
          CreditBalanceRules.DeductFunds(state, p, hosts)
        case p: Payload.ReleaseReservedFunds =>
          CreditBalanceRules.ReleaseReservedFunds(state, p, hosts)
        case p: Payload.RecordIncomingCredits =>
          CreditBalanceRules.RecordIncomingCredits(state, p, hosts)
        case p: Payload.CommitIncomingCredits =>
          CreditBalanceRules.CommitIncomingCredits(state, p, hosts)
        case p: Payload.CancelIncomingCredit =>
          CreditBalanceRules.CancelIncomingCredit(state, p, hosts)
      }

      decision match {
        case Left(code) =>
          Effect.none.thenRun((_: State) => reply ! Refused(code))
        case Right(events) =>
          Effect.persist(events).thenRun((_: State) => reply ! Accepted(events))
      }
  }
}
```

三个实际文件均全文阅读。除以下循环输入/可选 external 外，全部 package/import/object/apply/query/execute/decision/RHS 与第 5.1 节 JT 表一致，没有未登记的 companion 或初始化副作用：

|实际文件及区间|全部命令 / producer 顺序（每项调用规则见 JT）|
|---|---|
|J-CB L21–45|InitializeAccount、ReserveFunds、DeductFunds、ReleaseReservedFunds、RecordIncomingCredits、CommitIncomingCredits、CancelIncomingCredit；无 external；query GetState|
|J-FO L80–132|RequestFundPurchaseSettlement、ReserveFundSubscription、ConfirmFundSubscriptionPayment、CancelCashFundSubscription、RecordFundCashPaymentSucceeded、RecordFundCashPaymentRejectedBeforeEffects、RecordFundCashPaymentCompensated、RecordFundCashPaymentRecoveryRequired、RecordFundCashPaymentOutcomeUnknown、RegisterFundTASubmission、RecordFundTAAccepted、RecordFundTAConfirmed、RecordFundTARejected、RecordFundTAUnknown、RequestFundPurchaseRefund、RecordFundRefundSucceeded、RecordFundRefundRejectedBeforeEffects、RecordFundRefundCompensated、RecordFundRefundRecoveryRequired、RecordFundRefundOutcomeUnknown、RecordCashRequestSource|
|J-FO L17–73|11 个 external producer，顺序为 bank-payment-result-{compensated,outcome-unknown,recovery-required,rejected-before-effects,succeeded}，bank-refund-result-{compensated,outcome-unknown,recovery-required,rejected-before-effects,succeeded}，bank-ta-receipt-observation。每项 case=`Ingest`+id.replace('-','_')；authorize 原 id 不变，identity=`id.replace('-','_')+'_identity'`，method 同转换名；失败/成功 body 完整按 JT external 行；apply 顺序 external/query/execution|
|J-SP L21–67|CreateSipPlan、AppendSipDueSlot、SealSipSchedule、ReviseSipPlan、AdvanceSipClock、PauseSipPlan、ResumeSipPlan、ObserveSipDueSlot、SkipPausedSipDueSlot、AdvanceSkippedSipSlot、TriggerSipInstallment、RecordSipInstallmentPending、RecordSipInstallmentOutcomeUnknown、RecordSipInstallmentRecoveryRequired、RecordSipInstallmentRefundInProgress、RecordSipInstallmentSucceeded、RecordSipInstallmentFailed、RecordSipCreateIntent；无 external|

### 6.4 带真实上下文的 minus/plus

**结构性对照，非同输入字节比较，不是可 apply 的生成器 patch。** minus 精确取 J-CB L9–19；plus 取上面目标参考的入口/alias。目标的三个组使用 curated 输入，不能把缺少的 actual commands 当作已迁移或可删除。命令级变化下面单独对照。

```diff
--- actual-js/app/example/bankwealth/application/aggregates/behaviors/CreditBalanceBehaviors.scala
+++ approved-target-example/app/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala
@@ -9,11 +19,14 @@
-object CreditBalanceBehaviors {
+object CreditBalanceBehaviors extends CreditBalanceCommandHelpers {
+  type CreditBalanceAggregateCommandHandler =
+    (CreditBalanceState, CreditBalanceCommand) =>
+      Effect[CreditBalanceEvent, CreditBalanceState]
 
-  def apply(hosts: CreditBalanceComputations): CommandHandler = (state, command) =>
-    queryBehavior
-      .orElse(executionBehavior(state, hosts))
+  // --- 主入口 ---
+  def apply: CreditBalanceAggregateCommandHandler = (state, command) => {
+    // ==== BEGIN MANUAL ====
+    directBehaviors(state)
+      .orElse(reserveBehaviors(state))
+      .orElse(incomingCreditBehaviors(state))
       .apply(command)
-
-  private def queryBehavior: PartialFunction[Command, Effect[Event, State]] = {
-    case GetState(reply) =>
-      Effect.none.thenRun((s: State) => reply ! s)
+    // ==== END MANUAL ====
   }
```

同名 ReserveFunds 的窗口也仍为**不同业务输入的结构性对照**；不能推定两边参数/reply/规则语义一致。minus 精确 J-CB L26–29，plus 是目标参考 reserve 组中同两命令的完整 case body：

```diff
--- actual-js/executionBehavior/command-match
+++ approved-target-example/reserveBehaviors
@@ -26,4 +52,4 @@
-        case p: Payload.ReserveFunds =>
-          CreditBalanceRules.ReserveFunds(state, p, hosts)
-        case p: Payload.DeductFunds =>
-          CreditBalanceRules.DeductFunds(state, p, hosts)
+    case cmd: ReserveFunds =>
+      runReplyingPolicy(ReserveFundsRule, ReserveFundsHelper)(state, cmd).replyWith(cmd.replyTo)
+    case cmd: DeductFunds =>
+      runReplyingPolicy(DeductFundsRule, DeductFundsHelper)(state, cmd).replyWith(cmd.replyTo)
```

该 diff 不掩盖尾部实际 RHS：actual `Left(code) => none.thenRun(Refused(code))` / `Right(events) => persist(events).thenRun(Accepted(events))` 要被第 7 节完整 helper 语义取代，而不是把原 events 结果硬转换成余额确认。由于 D1/D2 未决，当前不能列银行完整 approved-target 逐命令回执文件。

## 7. 胶水与接口：精确符号、顺序和供给限制

### 7.1 必需合同

[common CommandHandlerReplyingBehavior L16–75](../baseline/common/src/main/scala/net/imadz/common/application/CommandHandlerReplyingBehavior.scala#L16-L75)（4380 bytes，SHA `2af0b26def49ccf43a23413642fa92bae2233a605b9bb84690ce68e16b0f8852`）与 [CommonTypes L11–17](../baseline/common/src/main/scala/net/imadz/common/CommonTypes.scala#L11-L17) 为冻结源码证据。

```scala
trait CommandHelper[Command, State, Param, Reply] {
  def toParam(state: State, command: Command): Param
  def createFailureReply(param: Param)(error: iMadzError): Reply
  def createSuccessReply(param: Param)(state: State): Reply
}

trait InvariantRule[Event, State, Param] {
  def apply(state: State, param: Param): Either[iMadzError, List[Event]]
}

// runReplyingPolicy(rule, helper)(state, command) 构成的对象中：
val param = helper.toParam(state, command)
rule(state, param).fold(
  error => Effect.reply(replyTo)(helper.createFailureReply(param)(error)),
  events => Effect.persist(events).thenReply(replyTo)(helper.createSuccessReply(param))
)
```

完整符号及角色：

|import / 类型|来源与所需能力|责任与限制|
|---|---|---|
|`net.imadz.common.application.CommandHandlerReplyingBehavior.runReplyingPolicy`|源码函数 `[Event,State,Param,Reply,Command](rule:InvariantRule[Event,State,Param], helper:CommandHelper[Command,State,Param,Reply])(state:State,command:Command): RunnablePolicyWithHelper[...]`|先转 param，再运行 rule；无规则异常转换逻辑，不能悄悄吞异常|
|`net.imadz.common.application.CommandHandlerReplyingBehavior.CommandHelper`|同源码三方法，如上；helper 在 `application.aggregates.behaviors`|不是 domain emit* 的别名；不得把 ActorRef 加入 Param/Event|
|`net.imadz.common.CommonTypes.InvariantRule` / `iMadzError`|`iMadzError(code:String,message:String)` case class extends Throwable with CborSerializable；规则返回 List|formal String→error 的 message 来源、Vector→List 顺序保真待 D2，不填空串伪造业务解释|
|`akka.persistence.typed.scaladsl.Effect`|Akka typed persistence 2.6.20 的 reply/persist/thenReply（本次未核消费 jar）|失败不 persist；成功持久化并应用所有事件后，thenReply 把**更新后的 State**交 helper；同一 param 保留；回复次数应一次|
|`akka.actor.typed.ActorRef[Reply]`|应用 Protocol 字段的 typed 通道|[AggregateProtocolBuilder L43–68](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateProtocolBuilder.scala#L43-L68) 只在 metadata.replyToType 存在时**追加**于基础参数之后；本 B/T 使用 replyTo 却不补协议，缺失须报决策，不给全体 command 合成通用 Reply|
|`<base>.application.aggregates.<Base>Protocol._`|Commands / Replies / handler alias|actual [CreditBalanceProtocol L9–28](../baseline/actual-js/app/example/bankwealth/application/aggregates/CreditBalanceProtocol.scala#L9-L28) 是 alias+val 转发 domain carrier；迁移须修真实 carrier 和 callers，不能留永久壳|
|`<base>.domain.entities.<Base>Entity` 的 state/event|纯事件应用；normal behavior 不创建 actor/state 初值|必须和 domain-entity/event-handler 组对齐；不把 ActorRef、HTTP/编码引入域层|
|无 Helpers 支路使用的 FQN|`akka.actor.typed.Behavior`、`akka.actor.typed.scaladsl.Behaviors/ActorContext`、`akka.cluster.sharding.typed.scaladsl.EntityRef`、`akka.persistence.typed.PersistenceId`、`akka.persistence.typed.scaladsl.EventSourcedBehavior`、`akka.actor.typed.SupervisorStrategy`、`net.imadz.infra.saga.SagaTransactionCoordinator.Command`、`scala.concurrent.ExecutionContext`、`scala.concurrent.duration._`|T10 中全部参数/RHS 已登记。该分支消费何种 Saga runtime 坐标/API 未确定；不把 sibling 的存在当 JAR 保证，不在本 artifact 私建 coordinator|

`replyWithAndPublish(replyTo)(implicit ActorContext[_])` 在成功臂 persist 后 thenRun 逐事件向 `context.system.eventStream ! EventStream.Publish(e)`，再 thenReply；失败直接 reply。**比 replyWith 多了发布副作用**，本 T 使用 replyWith；不能无条件改为 AndPublish。

[common L78–86](../baseline/common/src/main/scala/net/imadz/common/application/CommandHandlerReplyingBehavior.scala#L78-L86) 另有旧 overload：`runReplyingPolicy(rule)(state,param)` 返回 AwaitingReplyToRunnablePolicy，`replyWith(replyTo)(leftFactory,rightFactory)`；不要把它和 helper overload 混签。

用户指定 Deposit Helper 的精确方法体来自 [curated Helpers L35–42](../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L35-L42)：toParam=`command.change`；failure=`CreditBalanceConfirmation(Some(error),Nil)`；success=`CreditBalanceConfirmation(None,state.accountBalance.values.toList)`。此 success 中 state 是 thenReply 提供的新 state，而不是 apply 入口闭包捕获的旧值。这里只解释依赖，不改 command-helper 的文件。

### 7.2 源码供给不等于消费制品

- BC [scaffold/build.sbt L10、L50、L127–136](../baseline/bc/scaffold/build.sbt#L127-L136) 默认声明 Scala 2.13.14、Akka 2.6.20、`net.imadz:common-core_2.13:0.2` 等；后续候选开关另属 build 配置。CodegenMain 还复制 scaffold common 源并在 multi 模式搬迁，不能仅凭依赖坐标判断类实际来自哪个编译输入。
- JS [applicationBuild L3–8](../baseline/js/generators/scala-cqrs-application/render-build.mjs#L3-L8) 加 `saga-core_2.13:0.3.0` 及有 pipeline 才加 monarch-persistence；[generate-cli L114–139](../baseline/js/lib/products/generate-cli.mjs#L114-L139) 对 selected runtime 本地 JAR 验 pin，并检查 service external roots。**这些检查不是 common-core helper API 的验证**。
- 本次不读取已安装 jar、不下载、不 publishLocal、不升级 runtime；`common-core` 目标来源、坐标、SHA、是否与 scaffold 同名类冲突均是 D7 的实施前置，不生成 bank 私有 CommandHelper 副本绕过它。

## 8. 未决项（逐项约束，不能作为空泛待办）

|ID|具体必须裁定的内容|阻断范围|
|---|---|---|
|D1|formal 的 reference-layout/domain-decision/dependencies 没有 B 所需 BehaviorGroup/CommandHandlingFlow 与逐命令 success/failure reply mapping。银行 7/21/18 个现存命令分别采用什么业务组、纯 Param、具名 Reply、reply 字段顺序？现有 Accepted(events) 的 callers 如何迁移？GetState 保持整状态回复还是另有明确 query reply？|银行完整 approved-target 与输入产品适配；不能按命令名前缀猜分组，也不向树加临时第二真源|
|D2|`Either[String,Vector[Event]]`+`Rules.command(state,p,hosts)` 如何适配 `InvariantRule[...,Param]`？iMadzError.message 来源是什么？有计算 ports 的规则是显式构造 rule 捕获 hosts（legacy 有先例）还是另一已批准接口？Helper 的三个方法从哪里取得完整 RHS？|typed policy 行为及其 tests；不得删除 hosts、注入 Any 或编造空成功|
|D3|FundOrder 11 个授权入站分支不在传统 HandlerLogic 中：保留独立类型化 application behavior component，还是扩展结构 logic variant？authorize 的输入顺序、原 producer id、identity keys、拒绝码、事件次数/次序与 Reply 必须保持；是否把两次纯事件构造合为一次须核纯度/求值语义|FundOrder 部分 missing-counterpart；不阻断保存普通 policy 规格；外部分支未定前不能整文件覆盖|
|D4|raw transient 仅按名称、未查事件签名/Reply，并注入 Instant.now；Model 注释与实际回复不一致。是否准入此机械体、以何种显式时间/回执 metadata 约束？无 Helpers actor 支路在本 B 不可达，是否保留为未接通变体而不新增公共入口？repo/context 类型与首组-only行为如何处理？|transient/actor 分支；PID、reply 与失败条件不得擅改|
|D5|部分命令不可解析时当前 flatMap 丢 handler；全空 apply 为 ???、非标准 query 为 ???。目标是拒绝缺行为输入还是具名外置实现槽？空组/重叠 handler/orElse 优先序与未覆盖命令必须显式检验，不能默默 Effect.none|缺语义 fixture 与 handler 覆盖；raw 占位证据保留|
|D6|本地 `AggregateNameCommandHandler` 与 Protocol alias 的唯一声明归属；raw `.name`/全FQN replace/重复 import/非递归 deps 的修复白名单；single/multi profile 的实际 module 归属统一；MANUAL apply 再生成的保留、碰撞报告与业务组结构变化怎样协调|与 protocol/root/shared-types/ writer 联动；本文示例默认保留 raw 本地 alias/MANUAL|
|D7|能提供所需 helper overload 的真实冻结 common-core 坐标/SHA/API与类来源；不得把 sibling 源码或 saga-core pin 当供给证据|真实编译/行为验证；不授权 runtime 发布或依赖重供|
|D8|同一语义 fixture 的 Scala metadata/file-binding 与 JS product request 映射，尤其 formal 无 BusinessGroup/Reply input 时如何保真；确定哪个现有行为 suite 可复用，或批准新的具名 suite 后再给其可执行 FQN|同输入完整对账/真实 actor oracle；没有现成同输入结果，不能贴 parity-PASS|

## 9. 第二阶段拟写集合、共享所有权与迁移

本节是**后续提案**，本次仅写两份规格文件。JS 路径都相对 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc`；新建项显式 proposed。没有在本轮修改 catalog、assignment、中央 glue 或其他 diff。

### 9.1 本项专属 Model/Builder/Template（proposed）

|拟路径|职责|
|---|---|
|`generators/scala-cqrs-play-service/models/aggregate-behavior.mjs`（proposed）|显式 AggregateBehaviorModel、BehaviorGroupModel、CommandHandlerModel 与可判别 logic variants；对应 M 字段顺序/默认/来源，不用 content 字符串装整文件。保留 raw eventArgs 为注明的代码槽，新的 domain 表达式不能借此扩散|
|`generators/scala-cqrs-play-service/build-aggregate-behavior-model.mjs`（proposed）|构建单 aggregate 的行为模型；输入已审定的 group/command/reply/rule/helper/ports contracts + shared resolver；D1/D2 未决前不假造输入字段已存在|
|`generators/scala-cqrs-play-service/templates/aggregate-behavior.mjs`（replace）|只渲染已建模型，负责 T01–T14 的已批准目标形式、完整 RHS、注释与 source mappings；不在模板里猜 Reply 或业务分组|
|`test/codegen-parity-aggregate-behavior.test.mjs`（proposed）|字段/默认、各 B/T 分支、命令覆盖、分组顺序、完整文件/UTF-8 mappings 的定向 fixtures；这不是现成测试名，本次不创建/执行|

输出文件的 **唯一 assembly owner = `aggregate-behavior`**：`<Base>Behaviors.scala` 的 package/imports/object/alias/apply/MANUAL/groups 都由同一个 template 组装，不许 Helper owner 或 external owner分别写同一物理文件。external component 若需拆出，应由 D3 明确其完整目标路径/owner 后作为依赖引入；未决时不遗漏其内容。

### 9.2 集成者共享写面（仅登记依赖，不由本项并发写）

- `generators/scala-cqrs-play-service/build-aggregate-models.mjs`：单一 application-aggregate 集成 owner，把 behavior role 的构建转交本项 builder；其他六 roles 保留各自 owner。`artifact.kind` 相同的 aggregate role 不能被误替。
- `generators/scala-cqrs-play-service/render-aggregate-layers.mjs`：同一集成 owner，保留唯一 role dispatch/entry；不能出现旧新两个 writer 抢路径。
- `generators/scala-cqrs-play-service/aggregate-names.mjs`、`lib/scala-target/naming.mjs`、`lib/scala-target/model.mjs`、`lib/scala-target/profiles.mjs`：shared-layout-types owner。复用已读 `resolveName/resolveNameSet/resolveArtifactPath/targetData`；当前 model 支持 value/port/component，不是现成 AggregateBehaviorModel。显式维护 TypeRef signature/FQN/import/nested owner/冲突选择，不继续复制 safeName。
- `generators/scala-cqrs-domain/render-domain.mjs`：domain/protocol/helper 集成 owner，拆 Command/Event、rule wrapper、Computations 和 emit* 后迁入各族合适文件。纯 event emission 可以归 rules 实现，但不能命名成 application CommandHelper 三方法的替代物。
- `generators/scala-cqrs-play-service/templates/aggregate-protocol.mjs`、`templates/aggregate-factory.mjs`、`templates/aggregate-bootstrap.mjs`、`templates/aggregate-repository.mjs`：协议/root/factory/repository owner 迁实际 typed commands 和 callers，保留 hosts/authority 注入，不永久保留 domain carrier 转发壳。
- `generators/scala-cqrs-aggregate-core-v1/build-models.mjs`、`render.mjs`、`templates/aggregate.mjs`：family aggregate owner **split** commandHandler 的逻辑行为体，是否共用本 MBT 由 D1/D2/模块合同裁定；不能 formal 修完后宣称 family 同步。persistence-readside/play-application 两条已证实消费也纳入依赖闭包。
- `generators/aggregate-dsl/render.mjs`：legacy composite assembly owner **adapt/split** L943–1014；其余 Protocol/Entity/Factory/EventHandler 片段归相应 artifact，不能删除同文件其他逻辑。`emit.mjs` 不作为新正式写入口；legacy 保持 opt-in，何时退役由消费清单裁定。
- `generators/scala-cqrs-play-service/generate.mjs`、`generator.json`、`lib/products/generate-cli.mjs`、`src/core/product-plan.mjs`：公共 registry/product owner 决定新增 group/reply binding 的 admitted product footprint、producer version 与 profile，不虚构当前有对应 flag/product。
- `generators/scala-cqrs-domain/naming.mjs` 的 entry 与 `src/core/generate.mjs`：writer/anchor owner；最终格式之后重算 span 与 fingerprints；按实际 written-only/ownership 合同迁回锚，不能手编 ledger/anchors。

### 9.3 文件退役与 fixtures

1. 文件级迁移以旧 producer/profile/path/role → 新完整 path/owner 清单驱动。本行为文件目前路径已经正确，不应因目录修复删整个文件；domain carrier/helpers/rules wrapper 的退役是跨族迁移，不是一行 `mv`。
2. 更新全部调用方 commandHandler/apply 的类型及 ports 注入；保留 CommandHelper 泛型的名义类型。PB field numbers、PID、serializer ids/manifests/绑定范围、外部 producer id、receipt identity、Money 及 checked arithmetic 都不在改名许可内。
3. 默认生成 MANUAL apply 与用户保留体分别对账；任何保留体仍调用旧 wrapper 时报告冲突，不覆盖、不给永久兼容壳洗绿。[applyEntries L246–267](../baseline/js/src/core/generate.mjs#L246-L267) 是唯一写入口；当前 retained 机制不是自动删除旧文件，退役需要单独 approved owned plan。
4. proposed fixture 根：`docs/codegen-parity/fixtures/aggregate-behavior/`；本次不创建。至少：curated CreditBalance（direct/reserve/incoming、Deposit 新 state reply、只读独立）；非银行 nominal/cross-type 泛型+多 group；缺 metadata/readonly reply/unknown emission/unsupported guard；全空及部分未覆盖；transient Run/Complete/Fail 的独立子集；无 Helpers 的两个 context 子分支（只测模板合同，不假称主入口支持）；FundOrder external 的授权与身份保持单独 fixture。
5. proposed expected 根：`docs/codegen-parity/expected/aggregate-behavior/`，保存 raw-scala、approved-target、actual-js 三组完整文件与**有限差异清单**；curated 原件独立引用。fixture 不是新业务真源；每个语义输入字段/默认/顺序、来源 document/pointer 必须对照，不能改输入凑 expected。

依赖顺序：`shared-layout-types → application-protocol + command-helper + domain-entity/event-handler + invariant-rule/aggregate-rules-formal → aggregate-behavior → aggregate-root/factory/bootstrap callers → writer/anchor integration`。其中接口先审定，不要求别的 blocked artifact 写完才保存本规格。

## 10. 后续 scoped CLI、副作用与验收义务（本次全部未运行）

### 10.1 真实 CLI 形状，不伪造 artifact 过滤 flag

以下 `/absolute/...` 是必须由集成者审批后替换的 **参数槽**，不是已存在 fixture 的事实。scope 靠单聚合最小 request/显式 bindings 与所需依赖闭包，而不是不存在的 `--artifact aggregate-behavior`。不能把旧全量银行 request 当局部验收。

formal JS（CWD 可任意；路径均须绝对）

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /absolute/approved-fixtures/aggregate-behavior/formal.request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-play-service \
  --out /absolute/owned-new-targets/aggregate-behavior/formal \
  --options-json /absolute/approved-fixtures/aggregate-behavior/formal.options.json \
  --plan
```

- flags 精确来自 [generateProductCli L66–88](../baseline/js/lib/products/generate-cli.mjs#L66-L88)：四项全部 required，另可 `--plan`；不是 `--dry-run`。
- `--plan` 仍读取 request/options/manifests，内存 compileProductSet、调用 generator，读取并 hash 已固定 runtime JAR；formal service 验 externalSourceRoots 目录/不重叠。它不调用 applyEntries、不创建代码/ledger/anchor；也不证明所有 output paths 已经过最终 writer 的 apply preflight。
- 移除唯一 `--plan` 后才 apply：在新 out 写**整个最小依赖闭包**（不只 Behaviors，可能含 build/conf/proto/tests 等）及 `truthsrc.ledger.json`、`anchors.json`，执行碰撞/所有权/MANUAL 合并/最终字节核对；无自动旧输出删除。所读源码段没有为该 product CLI 启动 sbt、runtime/service 或下载；未执行不构成无副作用实证。
- 若改用 family2，generator 路径须显式换为 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-aggregate-core-v1`，request/options 也必须是该 profile 的独立已批准映射（严格 keys packages/names/protobuf）。不能用这个替换来绕过 formal route 验收；external 输入按已读 family builder 会被拒绝。
- 需要捕获外置实现的 play-application 等 producer 会拒绝 generate-products **包括 plan**（[implementationProducers L45–64、L79–80](../baseline/js/lib/products/generate-cli.mjs#L45-L80)）；那是 generate-project 另一个审批写面，不在本项偷偷切入口。

Scala raw（仅第二阶段，CWD 明确为 `/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen`；新目标不可为 banking-app/ingested-app）

```bash
sbt \
  -Dcodegen.systemFile=/absolute/approved-fixtures/aggregate-behavior/scala.canonical.json \
  -Dcodegen.systemBindings=/absolute/approved-fixtures/aggregate-behavior/scala.bindings.json \
  -Dcodegen.targetDir=/absolute/owned-new-targets/aggregate-behavior/raw-scala \
  -Dcodegen.ledger=/absolute/owned-new-targets/aggregate-behavior/raw-scala-ledger.json \
  -Dcodegen.generatorVersion=cc335eb1e0d0fae17bf092fd61b126040196ea70 \
  -Dcodegen.noGit=true \
  "runMain net.imadz.codegen.CodegenMain"
```

- [CodegenMain L62–82](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L62-L82) file/bindings 必须成对，与 `codegen.system` 互斥；本形状显式选 file system slot，不隐式 Examples。不带 semanticProductsFile，确保传统 MBT。
- [GeneratorVersion L35–61](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorVersion.scala#L35-L61) pin/noGit 防默认 git/date 探测。sbt 本身仍可能编译、写 BC target/project target、解析或下载依赖、启动 JVM；这些必须后续单独授权与固定供应，不因新输出目录而声称完全隔离。
- 已读 CodegenMain 是 **prepare/harness 成功后** mkdir/copy scaffold；不沿用旧“validation 之前先创建目标”的描述。runCommon 可创建 protobuf 目录、写各族/归属 ledger；本命令不是行为族专用 generator。输入准备/缓存、同输入适配与生成预算合并安排；本阶段不创建输入、不调用 Node truth compile。
- D8 未选出既有真实 actor suite；本文**不猜一个存在的 FQN 或添加 CLI flag**。后续确定复用 suite 或批准 proposed suite 后，才能把 `sbt "testOnly <approved-suite-FQN>"` 替换成可执行定向命令；此处是未决验证入口，不是当前可运行证明。

### 10.2 内容 / 接口 / 行为分账

|验收面|后续必须收集的局部证据|当前|
|---|---|---|
|同等输入完整文件|Scala/JS input adapter 字段、默认、排序逐项映射；raw/target/actual 全文件路径、package、imports、成员顺序/RHS 对账；允许差异仅本规格明确的 header/profile/格式/布局与批准业务样本偏差|未运行；D1/D8|
|construct/RHS|M 全字段、B01–B16、T01–T14；每个逻辑分支各 fixture；未知/缺命令不可静默遗漏；MANUAL、代码字符串槽可见|源码检查已记录，不宣称自动 coverage|
|接口|协议 command 参数保序、条件 ActorRef[Reply] 追加；纯 Param/Event 无 ActorRef；实际 common-core overload、error/List 与 JS String/Vector、hosts 接口编译匹配|未验证；D2/D7|
|行为|toParam/rule 各一次；失败无 persist、无 event application；成功事件按序应用后 reply 读新 state、一次回复；right-empty 不制造事件；readonly 不持久化；replyWith 不发布；AndPublish 单独正负对照；未接线保持显式阻断|未运行|
|外部入站|11 个 producer authorize 先执行，失败码/零事件，成功事件与 identity 保真，回复 contract 不随重命名改变；不将多个名义消息合并|未运行；D3|
|命名/布局/质量|三业务层、Helpers 在 behaviors、type/file PascalCase 与方法 lowerCamelCase；无复制 safeName、ServiceService/HostHost；必要业务临时量不能变无意义 nextN；方法 CC≤5 目标，6–10逐方法理由、>10重构/个别批准；不以 String/Any dispatcher 刷分|CC `not-measured`，非质量通过|
|稳定/回锚|相同输入两次完整字节一致；UTF-8最终 bytes 重算 span；单字段/规则更改只产生合理局部 diff；source document/pointer 回查新 path/member；MANUAL 冲突明确报告|未运行|
|保护面|不改 PB/PID/serializer/nominal/overflow、producer id、receipt 组成；新目标不碰银行现有 app/.truthsrc/ledger/anchors；不运行服务和旧 journal|本阶段无此类写入/运行|

初轮生成/文件对账建议预算 ≤5 分钟，集中受影响闭包编译/行为 ≤15 分钟，均只是后续调度预算；超时停止报告已得内容。不要为本 artifact 运行全银行 workshop 或全仓 CI。本文保存只代表观察与规格交付，**不代表 implemented、ready、parity-PASS 或 behavior-PASS**。

## 附录 A. Model 完整源码

以下保留 raw 源码的字段注释、默认值和代码槽；字节级空行/缩进仍以 M 固定文件为准。

```scala
package net.imadz.codegen.scaffolding.cqrs.model.application


import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, TypeRef}

// ===========================================
// 1. Model Definitions (Production Ready)
// ===========================================

case class AggregateBehaviorModel(
                                   override val selfType: TypeRef, // e.g. application...CreditBalanceBehaviors
                                   aggregateType: TypeRef, // e.g. domain...CreditBalanceAggregate (用于引用 Protocol)
                                   stateType: TypeRef, // e.g. CreditBalanceState
                                   eventType: TypeRef, // e.g. CreditBalanceEvent
                                   commandType: TypeRef, // e.g. Withdraw
                                   commandHelpers: Option[TypeRef],
                                   behaviorGroups: Seq[BehaviorGroupModel],
                                   override val dependencies: Set[TypeRef],
                                   /** S7（EP §二 G1）：聚合号——台账 artifacts[] 文件级落点由此可查。 */
                                   override val noteIds: Seq[String] = Nil,
                                   contextType: Option[TypeRef] = None
                                 ) extends ArtifactModel

case class BehaviorGroupModel(name: String, handlers: Seq[CommandHandlerModel])

case class CommandHandlerModel(commandType: TypeRef, logic: HandlerLogic, groupName: String = "default")

sealed trait HandlerLogic

case class PolicyBasedLogic(policy: TypeRef, helper: TypeRef) extends HandlerLogic

case class ReadOnlyLogic(replyType: TypeRef) extends HandlerLogic

/** 门/gate 暂态命令的可判定体（EP_Improvement_Engine 欠账⑦）。
  *
  * 判据＝命令名匹配 `Run|Complete|Fail<Agg>` 三件套（refining 未产 invariant→命令流，但暂态已建模：
  * `RunStarted → status=RUNNING → RunCompleted/FAILED`）。这类命令只持久化事件、无业务回复。
  * eventArgs＝事件构造参数字面量（Run 用 `id, "", triggeredBy, java.time.Instant.now()`；
  * Complete/Fail 用 `id, state.result, ...`）。 */
case class TransientCommandLogic(eventName: String, eventArgs: String) extends HandlerLogic

/** 形式路径发射行（事件名 + 已解析的位置实参）。P4 起由规则流消费
  * （守卫 + 发射装进 <Cmd>Rule 的成功臂）——直接 persist 的 EmissionLogic 已被取代移除。 */
case class EmittedEvent(name: String, args: Seq[String])
```

## 附录 B. Builder 完整源码

```scala
package net.imadz.codegen.scaffolding.cqrs.builder.application

import net.imadz.codegen.scaffolding.cqrs.model.application._
import net.imadz.codegen.scaffolding.cqrs.{
  GeneratorContext,
  TypeRef,
  TypeResolver
}
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.{
  AggregateBehaviorMetadata,
  AggregateRootMetadata,
  CommandHandlingFlow,
  CommandRef,
  EventFamilyMetadata,
  InvariantRuleRef,
  SubordinateCommandMetadata,
  ValueObjectMetadata
}

object AggregateBehaviorBuilder {

  def build(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): AggregateBehaviorModel = {
    val pkg = ctx.layout.application.aggregates.behaviors
    val selfType = ctx.typeResolver.aggregateBehavior(meta)

    // 解析基础类型
    val (aggregateType, stateType, eventType, entityType, commandHelpers) =
      resolveBaseTypes(meta, ctx)

    // 解析行为元数据
    val behaviorMetadata = resolveBehaviorMetadata(meta, ctx)

    // 构建行为组
    val mutatingCommands = meta.commandFamily.commands.filter(!_.isReadOnly)
    val writeBehaviorGroups =
      buildWriteBehaviorGroups(meta, behaviorMetadata, mutatingCommands, ctx)

    val readOnlyCommands = meta.commandFamily.commands.filter(_.isReadOnly)
    val behaviorGroups = if (readOnlyCommands.nonEmpty) {
      writeBehaviorGroups :+ buildQueryBehaviorGroup(readOnlyCommands, ctx)
    } else {
      writeBehaviorGroups
    }
    // P4 形式路径规则组（formal-semantics 桥）：invariant→命令流未覆盖、但真源
    // guards+bindings 可机械解析的变更命令，走 runReplyingPolicy 规则流——规则体在
    // <Agg>Rules.scala（AggregateRulesBuilder 同源解析），行为侧只接线。
    val allBehaviorGroups = behaviorGroups ++ buildFormalRuleGroups(meta, behaviorGroups, ctx)

    // 收集依赖
    val dependencies = collectDependencies(
      allBehaviorGroups,
      aggregateType,
      stateType,
      eventType,
      entityType,
      meta,
      ctx,
      pkg
    )
    val commandRef =
      ctx.typeResolver.commandFamily(CommandRef(meta.commandFamily.name))

    // 构建并返回模型
    AggregateBehaviorModel(
      selfType,
      aggregateType,
      stateType,
      eventType,
      commandRef,
      Some(commandHelpers),
      allBehaviorGroups,
      dependencies,
      noteIds = meta.noteId.toSeq
    )
  }

  /** 解析基础类型引用
    */
  private def resolveBaseTypes(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): (TypeRef, TypeRef, TypeRef, TypeRef, TypeRef) = {
    val aggPkg = ctx.layout.application.aggregates.root
    // 2026-08-21 摄入侧适配：聚合名不带 Aggregate 后缀（bankingSystem 手工元数据自带）；
    // 统一经命名规范解析为 <Base>Aggregate，保证模板的 replace("Aggregate","Protocol") 逻辑一致
    val aggregateType = ctx.typeResolver.aggregateType(NamingConventions.aggregateRootName(NamingConventions.getBaseName(meta.name)), aggPkg)
    val commandHelpers = ctx.typeResolver.commandHelper(meta)
    val stateType = ctx.typeResolver.entityState(meta.stateRef)
    val eventType = ctx.typeResolver.eventFamily(meta.eventFamilyRef)
    val entityType = ctx.typeResolver.entity(meta.entityRef.targetName)

    (aggregateType, stateType, eventType, entityType, commandHelpers)
  }

  /** 解析行为元数据
    */
  private def resolveBehaviorMetadata(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): AggregateBehaviorMetadata = {
    ctx.metaRegistry
      .resolveByName[AggregateBehaviorMetadata](meta.behaviorRef.targetName)
      .getOrElse(
        throw new IllegalStateException(
          s"Failed to resolve behavior metadata for aggregate '${meta.name}'. " +
            s"Expected behavior metadata '${meta.behaviorRef.targetName}' not found in registry."
        )
      )
  }

  /** 构建写入行为组，包含所有非只读命令的处理程序
    */
  private def buildWriteBehaviorGroups(
      meta: AggregateRootMetadata,
      behaviorMetadata: AggregateBehaviorMetadata,
      mutatingCommands: Seq[SubordinateCommandMetadata],
      ctx: GeneratorContext
  ): Seq[BehaviorGroupModel] = {
    val groups = behaviorMetadata.behaviors.map { groupMeta =>
      val handlers =
        groupMeta.flows.flatMap(buildCommandHandler(_, mutatingCommands, ctx))
      BehaviorGroupModel(groupMeta.name, handlers)
    }
    // 门/gate 暂态补全（EP_Improvement_Engine 欠账⑦）：refining 未产 invariant→命令流时，
    // behaviorMetadata.behaviors 为空 → 上面循环一次都不跑，行为体落到 ???。若命令族含
    // Run<Agg>/Complete<Agg>/Fail<Agg> 三件套（暂态已建模 RunStarted→…→RunCompleted/FAILED），
    // 按可判定体发射——**不猜**：命令名直接对应事件名（RunX→XRunStarted …），事件参数按实体形状算。
    val hasFlows = groups.exists(_.handlers.nonEmpty)
    if (hasFlows) groups
    else {
      val transient = buildTransientHandlers(meta, mutatingCommands, ctx)
      if (transient.nonEmpty) Seq(BehaviorGroupModel(s"${NamingConventions.getBaseName(meta.name)}TransientBehaviors", transient))
      else groups
    }
  }

  /** 门/gate 暂态命令体：动词→事件后缀（Run→RunStarted / Complete→RunCompleted / Fail→RunFailed）。 */
  private val TransientVerbs = Seq("Run" -> "RunStarted", "Complete" -> "RunCompleted", "Fail" -> "RunFailed")

  private def buildTransientHandlers(
      meta: AggregateRootMetadata,
      mutatingCommands: Seq[SubordinateCommandMetadata],
      ctx: GeneratorContext
  ): Seq[CommandHandlerModel] = {
    // 聚合基名（去 Aggregate 后缀）＝命令/事件前缀（RunGateKbLint → GateKbLintRunStarted）
    val base = NamingConventions.getBaseName(meta.name).replaceAll("Aggregate$", "")
    TransientVerbs.flatMap { case (verb, evSuffix) =>
      val verbCmd = s"$verb$base"
      mutatingCommands.find(_.name == verbCmd).map { _ =>
        val eventName = s"$base$evSuffix"
        val args =
          if (verb == "Run") """cmd.id, "", cmd.triggeredBy, java.time.Instant.now()"""
          else "cmd.id, cmd.result, cmd.triggeredBy, java.time.Instant.now()"
        CommandHandlerModel(ctx.typeResolver.command(CommandRef(verbCmd)), TransientCommandLogic(eventName, args), verbCmd)
      }
    }
  }

  /** P4 形式路径规则组（formal-semantics 桥）：对 invariant→命令流未覆盖的变更命令，
    * 走 runReplyingPolicy(<Cmd>Rule, <Cmd>Helper) 规则流——规则/守卫/发射由
    * AggregateRulesBuilder 同源机械解析（任一命令不可解析＝该命令保持 ??? 桩语义，不猜）。
    * formalSemantics 缺省（Examples/既有入口）＝零行为变化。 */
  private def buildFormalRuleGroups(
      meta: AggregateRootMetadata,
      existingGroups: Seq[BehaviorGroupModel],
      ctx: GeneratorContext
  ): Seq[BehaviorGroupModel] = {
    val aggSemantics = ctx.formalSemantics.toVector.flatMap(_.aggregates.find(_.aggregate == meta.name))
    aggSemantics.headOption.toSeq.flatMap { agg =>
      val emissionByBase = agg.emissions.map(e => (e.event.replace('-', '_'), e)).toMap
      val guardsByCommand = agg.guards.map(g => (g.command, g.guards)).toMap
      val eventFamilyOpt = ctx.metaRegistry.resolveByName[EventFamilyMetadata](meta.eventFamilyRef.targetName)
      val stateFields = ctx.metaRegistry
        .resolveByName[ValueObjectMetadata](meta.stateRef.targetName)
        .map(_.fields).getOrElse(Vector.empty)
      val covered = existingGroups.flatMap(_.handlers).map(_.commandType.name).toSet
      val handlers = meta.commandFamily.commands
        .filter(!_.isReadOnly).filterNot(c => covered(c.name))
        .flatMap(cmd => resolveRuleHandler(cmd, eventFamilyOpt, emissionByBase, guardsByCommand, stateFields, meta, ctx))
      if (handlers.isEmpty) Nil else Seq(BehaviorGroupModel("FormalRuleBehaviors", handlers))
    }
  }

  /** 单命令规则接线：守卫与发射全部可机械解析才成体（与 AggregateRulesBuilder 同一判据），
    * 否则命令级放弃（不猜）。规则引用带对象限定名（CreditBalanceRules.<Cmd>Rule）。 */
  private def resolveRuleHandler(
      cmd: SubordinateCommandMetadata,
      eventFamilyOpt: Option[EventFamilyMetadata],
      emissionByBase: Map[String, net.imadz.meta.filesystem.FormalEmission],
      guardsByCommand: Map[String, Vector[ujson.Value]],
      stateFields: Seq[net.imadz.meta.FieldMetadata],
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): Option[CommandHandlerModel] = {
    val family = eventFamilyOpt.getOrElse(return None)
    val paramNames = cmd.parameters.map(_.name).toSet
    val produced = family.events.filter(_.producedBy.exists(_.targetName == cmd.name))
    if (produced.isEmpty) return None
    val resolvedEvents = produced.map(ev =>
      resolveEmittedEvent(ev, emissionByBase.get(ev.name), paramNames))
    if (resolvedEvents.exists(_.isEmpty)) return None
    val resolvedGuards = guardsByCommand.getOrElse(cmd.name, Vector.empty).map(resolveGuard(_, stateFields.map(_.name).toSet, paramNames))
    if (resolvedGuards.exists(_.isEmpty)) return None
    // 与 AggregateRulesBuilder 输出对齐的规则引用：裸成员名 + 对象路径作包——
    // 成员 import（<pkg>.<Agg>Rules.<Cmd>Rule）已把名字带进作用域；对象名本身
    // 不随成员 import 入域，限定引用会 not found（r11 首轮实测）。
    val ruleType = TypeRef(s"${cmd.name}Rule", s"${ctx.layout.domain.invariants.root}.${meta.name}Rules")
    val helperType = ctx.typeResolver.commandHelper(s"${cmd.name}Helper")
    val cmdType = ctx.typeResolver.command(CommandRef(cmd.name))
    Some(CommandHandlerModel(cmdType, PolicyBasedLogic(ruleType, helperType), cmd.name))
  }

  private def resolveEmittedEvent(
      ev: net.imadz.meta.SubordinateDomainEventMetadata,
      emission: Option[net.imadz.meta.filesystem.FormalEmission],
      paramNames: Set[String]
  ): Option[net.imadz.codegen.scaffolding.cqrs.model.application.EmittedEvent] =
    if (ev.fields.isEmpty) Some(net.imadz.codegen.scaffolding.cqrs.model.application.EmittedEvent(ev.name, Nil))
    else {
      val bindings = emission.map(_.bindings.toMap).getOrElse(Map.empty[String, String])
      val args = ev.fields.toVector.map(f =>
        bindings.get(f.name).flatMap(expr => resolveExpr(expr, paramNames)))
      if (args.exists(_.isEmpty)) None
      else Some(net.imadz.codegen.scaffolding.cqrs.model.application.EmittedEvent(ev.name, args.flatten))
    }

  private def resolveGuard(raw: ujson.Value, stateFieldNames: Set[String], paramNames: Set[String]): Option[Unit] = {
    val obj = raw.objOpt.getOrElse(return None)
    obj.get("errCode").flatMap(v => v.strOpt).getOrElse(return None)
    val onFail = obj.get("onFail").flatMap(v => v.strOpt).getOrElse("reject")
    if (onFail != "reject" && onFail != "succeed-empty") return None
    val when = obj.get("when").flatMap(_.objOpt).getOrElse(return None)
    val form = when.get("form").flatMap(_.strOpt).getOrElse(return None)
    if (!Set("money-positive", "money-sufficient", "map-contains", "map-absent", "collection-covered").contains(form)) return None
    def param(name: String): Boolean =
      when.get(name).flatMap(_.strOpt).filter(_.startsWith("param."))
        .map(_.stripPrefix("param.")).exists(paramNames.contains)
    def stateField(name: String): Boolean =
      when.get(name).flatMap(_.strOpt).exists(stateFieldNames.contains)
    val ok = form match {
      case "money-positive" => param("amount")
      case "money-sufficient" => param("amount") && stateField("in")
      case "map-contains" | "map-absent" => stateField("map") && param("key")
      case "collection-covered" => stateField("map") && param("collection")
    }
    if (ok) Some(()) else None
  }

  private def resolveExpr(expr: String, paramNames: Set[String]): Option[String] = {
    if (expr.startsWith("param.")) {
      val p = expr.stripPrefix("param.")
      if (paramNames.contains(p)) Some("p." + p) else None
    } else if (expr.startsWith("receipt.")) {
      val slot = expr.stripPrefix("receipt.")
      if (paramNames.contains(slot)) Some("p." + slot)
      else if (paramNames.contains("txid") && Set("reservation", "receiptId").contains(slot))
        Some("p.txid + \":receipt:" + slot + "\"")
      else None
    } else if (expr.startsWith("literal:")) {
      Some("\"" + expr.stripPrefix("literal:").replace("\\", "\\\\").replace("\"", "\\\"") + "\"")
    } else None
  }

  /** 构建单个命令处理程序
    */
  private def buildCommandHandler(
      flow: CommandHandlingFlow,
      mutatingCommands: Seq[SubordinateCommandMetadata],
      ctx: GeneratorContext
  ): Option[CommandHandlerModel] = {
    mutatingCommands.find(_.name == flow.commandRef.targetName).map { cmdMeta =>
      val cmdType = ctx.typeResolver.command(flow.commandRef)
      // 行为体的 MANUAL 默认体（PolicyBasedLogic）——生成一个开箱可编译的机械骨架：
      //   把命令转成 param（走 CommandHelper.toParam）→ 跑 policy → 持久化事件或回错误。
      //   与 CommandHelpers 的机械骨架同族（2026-09-21 EP_Improvement_Engine 欠账⑦）：
      //   生成的 partial function 分支里，policy 名取自真源 invariantRef，不是猜的。
      val ruleType = ctx.typeResolver.invariantRule(flow.invariantRef.targetName)
      val helperName = s"${flow.commandRef.targetName}Helper"
      val helperType = ctx.typeResolver.commandHelper(helperName)

      val logic = PolicyBasedLogic(ruleType, helperType)
      CommandHandlerModel(cmdType, logic, flow.commandRef.targetName)
    }
  }

  /** 构建查询行为组，包含所有只读命令的处理程序
    */
  private def buildQueryBehaviorGroup(
      readOnlyCommands: Seq[SubordinateCommandMetadata],
      ctx: GeneratorContext
  ): BehaviorGroupModel = {
    val handlers = readOnlyCommands.map { cmd =>
      val cmdType = ctx.typeResolver.command(CommandRef(cmd.name))

      val replyType = cmd.replyToType
        .map(ctx.typeResolver.resolve(_))
        .getOrElse(
          throw new IllegalStateException(
            s"Read-only command '${cmd.name}' must define a reply type"
          )
        )

      CommandHandlerModel(cmdType, ReadOnlyLogic(replyType), "QueryBehaviors")
    }

    BehaviorGroupModel("QueryBehaviors", handlers)
  }

  /** 收集所有依赖关系
    */
  private def collectDependencies(
      behaviorGroups: Seq[BehaviorGroupModel],
      aggregateType: TypeRef,
      stateType: TypeRef,
      eventType: TypeRef,
      entityType: TypeRef,
      meta: AggregateRootMetadata,
      ctx: GeneratorContext,
      pkg: String
  ): Set[TypeRef] = {
    val runReplyingPolicy = ctx.knownFrameworkTypes("runReplyingPolicy")
    val effect = ctx.knownFrameworkTypes("Effect")

    val logicDeps = behaviorGroups.flatMap(_.handlers).flatMap {
      case CommandHandlerModel(_, PolicyBasedLogic(p, h), _) => Set(p, h)
      case CommandHandlerModel(_, ReadOnlyLogic(r), _)       => Set(r)
      case _                                                 => Set.empty
    }

    val commandFamilyDep =
      ctx.typeResolver.commandFamily(CommandRef(meta.commandFamily.name))
    val commandDepends = meta.commandFamily.commands.map(cmd =>
      ctx.typeResolver.command(CommandRef(cmd.name))
    ) ++ Seq(commandFamilyDep)

    // [FIX] Use Protocol instead of Aggregate to break circular dependency
    val protocolType = ctx.typeResolver.aggregateProtocol(meta)

    (Set(
      protocolType, // Use Protocol instead of Aggregate
      stateType,
      eventType,
      runReplyingPolicy,
      effect,
      entityType
    ) ++
      commandDepends.toSet ++ logicDeps)
      .filter(_.shouldImport(pkg))
  }
}
```

## 附录 C. Template 完整源码

```scala
package net.imadz.codegen.scaffolding.cqrs.template.application

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.model.application._

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object AggregateBehaviorTemplate extends CodeTemplate[AggregateBehaviorModel] {
  private def toCamelCase(s: String) = s.head.toLower + s.tail

  def generate(model: AggregateBehaviorModel): String = {
    // 1. 构建包声明
    val pkgDecl = packageDecl(model.selfType.packageName)

    // 2. 构建导入声明
    val baseImports =
      model.dependencies.toList.sortBy(_.fqn).map(_.fqn).distinct
    // [FIX] Import Protocol instead of Aggregate to break circular dependency
    val aggregateImport =
      if (model.aggregateType.name.endsWith("SagaTransactor")) {
        s"${model.commandType.packageName}._"
      } else {
        // Use Protocol instead of Aggregate to avoid cycle
        val protocolFqn =
          model.aggregateType.fqn.replace("Aggregate", "Protocol")
        s"$protocolFqn._"
      }
    val additionalImports = Seq(
      aggregateImport,
      "net.imadz.common.application.CommandHandlerReplyingBehavior.runReplyingPolicy",
      "scala.concurrent.duration._"
    )
    val importDecl = imports((baseImports ++ additionalImports): _*)

    val extendsClause = model.commandHelpers.map(_.name).getOrElse("")
    val handlerTypeName = s"${model.aggregateType.name}CommandHandler"
    val commandTypeName = model.commandType.name

    // [FIX] 参数名称与 Root 保持一致 (sagaContext vs repo)
    val dependencyParam = model.contextType match {
      case Some(ctx) => s"sagaContext: ${ctx.name}"
      case None      =>
        val repoType = model.dependencies
          .find(_.name.endsWith("Repository"))
          .map(_.name)
          .getOrElse("Any")
        s"repo: $repoType"
    }
    val dependencyArg =
      if (model.contextType.isDefined) "sagaContext" else "repo"

    val eventObjFqn = model.eventType.packageName
    val ctxName = model.contextType.map(_.name).getOrElse("Any")

    // 3. 构建behavior groups方法
    val groupsCode = model.behaviorGroups
      .map { g =>
        val cases = g.handlers
          .map { h =>
            val cmdName = h.commandType.name

            // AI Prompt 构建
            val aiPrompt =
              s"""      /*
      >>> AI_PROMPT_START
      Context: Command Handler
      Task: Handle command '$cmdName'
      State: ${model.stateType.name}
      Available: $dependencyArg
      Expected Result: Return Effect.persist(event) or Effect.reply
      <<< AI_PROMPT_END
      */"""

            h.logic match {
              case PolicyBasedLogic(p, helper) =>
                s"    case cmd: $cmdName => runReplyingPolicy(${p.name}, ${helper.name})(state, cmd).replyWith(cmd.replyTo)"
              case ReadOnlyLogic(replyType) =>
                // S1 聚合面（2026-09-27）：只读命令的标准机械体＝直接回当前状态（不产事件）。
                // Get<X>State 形态＝Get<X>StateReply(state)——Effect.reply 强一致（akka typed read 命令先例）。
                val replyExpr = if (replyType.name.startsWith("Get") && replyType.name.endsWith("StateReply"))
                  s"${replyType.name}(state)"
                else "???"
                s"""    case cmd: $cmdName =>
$aiPrompt
      Effect.reply(cmd.replyTo)($replyExpr) """
              case TransientCommandLogic(eventName, eventArgs) =>
                // 门/gate 暂态命令（EP_Improvement_Engine 欠账⑦）：持久化事件 **并回复**。
                //   ★ 必须 thenReply（EP §15 实测）：saga 参与者经 ask 调本命令——无回复则 ask
                //     永不完成 → 步骤 CircuitBreaker 超时（54s 假失败）。reply 类型＝<Cmd>Reply(error=None)。
                s"    case cmd: $cmdName =>\n$aiPrompt\n      Effect.persist($eventObjFqn.$eventName($eventArgs)).thenReply(cmd.replyTo)((_: ${model.stateType.name}) => ${cmdName}Reply(None))"
              case _ => ""
            }
          }
          .mkString("\n")

        val params =
          if (model.commandHelpers.isEmpty)
            s"(state: ${model.stateType.name}, context: akka.actor.typed.scaladsl.ActorContext[${commandTypeName}], coordinator: akka.cluster.sharding.typed.scaladsl.EntityRef[net.imadz.infra.saga.SagaTransactionCoordinator.Command], $dependencyParam)"
          else
            s"(state: ${model.stateType.name})"

        s"  private def ${toCamelCase(g.name)}$params: PartialFunction[${commandTypeName}, Effect[${model.eventType.name}, ${model.stateType.name}]] = {\n$cases\n  }"
      }
      .mkString("\n")

    // 4. 构建apply方法
    val applyMethod = if (model.commandHelpers.isEmpty) {
      s"""
  def apply(id: String, coordinator: akka.cluster.sharding.typed.scaladsl.EntityRef[net.imadz.infra.saga.SagaTransactionCoordinator.Command], $dependencyParam): akka.actor.typed.Behavior[${commandTypeName}] = {
    akka.actor.typed.scaladsl.Behaviors.setup { context =>
      implicit val ec: scala.concurrent.ExecutionContext = context.executionContext
      akka.persistence.typed.scaladsl.EventSourcedBehavior[$commandTypeName, ${model.eventType.name}, ${model.stateType.name}](
        persistenceId = akka.persistence.typed.PersistenceId("${model.aggregateType.name
          .replace("SagaTransactor", "")}Transaction", id),
        emptyState = ${model.stateType.name}(id = Some(id)),
        commandHandler = (state, cmd) => ${toCamelCase(
          model.behaviorGroups.head.name
        )}(state, context, coordinator, $dependencyArg).apply(cmd),
        eventHandler = (state, event) => state.applyEvent(event)
      )
      .onPersistFailure(akka.actor.typed.SupervisorStrategy.restartWithBackoff(200.millis, 5.seconds, 0.1))
    }
  }
"""
    } else {
      val funcCalls =
        model.behaviorGroups.map(g => s"${toCamelCase(g.name)}(state)")
      // 有命令被处理（无论 policy/只读/暂态）⇒ 发射接线的 orElse 链；全空才退 ??? 桩。
      val hasHandlers = model.behaviorGroups.exists(_.handlers.nonEmpty)
      if (funcCalls.nonEmpty && hasHandlers) {
        val logicChain =
          funcCalls.tail.map(call => s".orElse($call)").mkString("")
        // ★ MANUAL 块（2026-09-21 EP_Improvement_Engine 欠账⑦）：`def apply` 是**人手写行为体**
        //   的挂点（默认＝生成器拼的 orElse 链）。此前无标记 → 重生成整文件 COVER → 手写必丢。
        //   块按最近 `def` 名（apply）锚定；重生成保留人手写体，生成链仅作默认。
        s"""
  type $handlerTypeName = (${model.stateType.name}, ${commandTypeName}) => Effect[${model.eventType.name}, ${model.stateType.name}]
  def apply: $handlerTypeName = (state, command) => {
    // ==== BEGIN MANUAL ====
    ${funcCalls.head}${logicChain}.apply(command)
    // ==== END MANUAL ====
  }
"""
      } else {
        // 空行为流（工作坊 refining 未产出 invariant→命令流、且无只读命令）：
        // 生成可编译占位处理器（骨架哲学，与 H021 同类的 ??? 桩——行为侧 TDD 补全时接入）。
        // ★ MANUAL 块（2026-09-21 EP_Improvement_Engine 欠账⑦）：此前此分支**无标记** →
        //   重生成整文件 COVER → 手写行为体必丢（87 域实测）。块按最近 `def` 名（apply）锚定，
        //   重生成字节级保留人手写体。默认 `???` 与骨架哲学一致（不冒充已接线）。
        s"""
  type $handlerTypeName = (${model.stateType.name}, ${commandTypeName}) => Effect[${model.eventType.name}, ${model.stateType.name}]
  def apply: $handlerTypeName = (state, command) => {
    // ==== BEGIN MANUAL ====
    // TODO: 行为流未接线（无 invariant→命令流，且无只读命令）——行为侧补全；
    //        典型体：runReplyingPolicy(<Rule>, <Cmd>Helper)(state, cmd).replyWith(cmd.replyTo)
    ???
    // ==== END MANUAL ====
  }
"""
      }
    }

    // 5. 构建对象定义
    val objectDef = ObjectDefinition(
      name = model.selfType.name,
      extendsClause = if (extendsClause.nonEmpty) Some(extendsClause) else None,
      body = s"$applyMethod\n$groupsCode"
    )

    // 6. 构建源文件
    val sourceFile = SourceFile(
      packageDecl = pkgDecl,
      importDecl = importDecl,
      definitions = Seq(objectDef)
    )

    // 7. 生成代码
    sourceFile.code
  }
}
```
