# aggregate-rules-formal — 形式规则制品内容差异合同

## 1. 范围、状态与证据身份

- Artifact：`aggregate-rules-formal`，传统 Template 族序号 **11**；detail group 同名。
- 状态：**decision-required**。存在正式 JS 规则实现、legacy 近似实现和显式 family2 实现；不是“整个 JS 无规则”。多事件、计算端口、错误描述、供给接口及多模块落点尚不能由现有证据唯一决定。
- 本文只完成源内容检视和后续实施规格；没有执行生成、测试、typecheck、编译、运行、服务或下载。CC 为 **not-measured**。没有同输入的新 `raw-scala` / `actual-js` 输出；不能以源码推导冒充新生成证据。
- BC 固定 HEAD：`cc335eb1e0d0fae17bf092fd61b126040196ea70`；JS 固定 HEAD：`bf104e16ab82ef39d7fa416d0997907d18a815ad`。以 [baseline/index.json](../baseline/index.json) 的完整字节与 SHA-256 为文件身份，不以 HEAD 代替工作树字节。
- 首次及写入前检查均未发现本制品两个目标文件。本次只新增本 diff 与同名 details JSON；不触碰此前十五份 diff、其他人制品、baseline、生产源、银行输出、catalog、ledger、anchors 或 Git。
- 所读实现源码全部来自冻结 baseline，`extraSources = []`。仓库指引及本阶段合同/批准计划是工作指令，不是补充实现源码。未读密钥、凭据、运行进程参数/环境、对话记录或 agent.output。

### 1.1 固定全文来源

以下简称均指可取回全文的固定文件，后文用精确行号说明构造。M/B/T 全文另列于附录，不以链接代替内容分析。

|简称|固定文件|bytes|SHA-256|
|---|---|---:|---|
|M|[AggregateRulesModel.scala][M]|1735|`8f5d54684e4f4abfbb9dade5a335f19ecd1cd5061e95bb722ebba48573cb2b05`|
|B|[AggregateRulesBuilder.scala][B]|8691|`2a96b64a95eec149465147adfff3f34724fdbe33721e39c4b7a21fd4be2170d6`|
|T|[AggregateRulesTemplate.scala][T]|3488|`b897db889faae4906846476d00078a164cab2974d6b61c805dd7d9949479ac12`|
|J|[formal render-domain.mjs][J]|12461|`98181f044826dd2e45ec4179f030a2de2a47326601f3af9a153df2d96dc09e43`|
|E|[formal render-expressions.mjs][E]|8839|`7f4a43a04c6bf600fbdd14d29e7eff1d71a36fc69fd0b1abe09ef9cdcff90343`|
|L|[legacy invariant-dsl/render.mjs][L]|82440|`fb8a8bd8f67fed203c824eddba5e97668664db9f7ea9d9ce7724bb8ca8d543e3`|
|FB|[family2 build-models.mjs][FB]|19567|`a856e3ff09828d6bf802bfe85092c329816fc891adf476a0345393d6c8cc03de`|
|FT|[family2 templates/rules.mjs][FT]|1888|`0aa6e200c2dbff13175d018c7573bdfd3ff7e096fece1857bfc56edb6ebd43df`|
|A|[银行现存 invariant/CreditBalanceRules.scala][A]|9423|`03e1a70268cfafcb80e833c3df306dfb9b2f2c50bbec1a3d726af48039c82fa4`|
|AP|[银行现存 params/CreditBalanceRuleParams.scala][AP]|1253|`deeca0caf515bcdde8b532c8c7e191c88dfc6676da94f035a04f400e7d5285b7`|
|AW|[银行现存 domain/CreditBalanceRules.scala][AW]|2437|`f45512bb16df96379c502fa655187f0a1e385412bfd24df3dfa9f47fe7b22c6f`|
|C|[人工参考 LotRules.scala][C]|7788|`30d90ae60deba89ba4736cc430756d7fd7e8360d5464d7ea541d89a899ab1867`|

这些行已以只读 SHA/byte 比对确认匹配 index；这不是运行时验证。银行副本原来源是 `bank-wealth-demo/generated/current/app/...`，不是本轮生成结果。C 原来源是 BC `reference_project/app/net/imadz/FabSplitMergeDesign/domain/invariant/LotRules.scala`，归 **curated-scala**，不能因文件内部的 P4 注释便重标为本轮 raw 输出。

### 1.2 四个证据面不得混签

|证据面|实际可取得内容|本制品处理|
|---|---|---|
|`raw-scala`|完整 M/B/T、writer 和共享 resolver；本轮未生成具体业务文件|§2–4 列出条件与精确展开规则；没有 raw 产物字节证明|
|`approved-target`|用户三层、typed command、真正 Helper、纯 Params、表达与命名标准；默认沿用传统模板结构|§6 的已定目标和有限偏差；未定业务/API 不伪造整份银行 expected|
|`actual-js`|A/AP/AW 及真实 emit helper，完整冻结字节|§5 逐方法、逐 guard、成功 RHS 对账；附录 D 给完整 A|
|`curated-scala`|C 全文及 CreditBalance 人工 Helper|§5.4 单列逐 construct；不把 Lot 规则/Deposit 回复复制成银行统一算法|

## 2. Scala 可达链、输出基数与路径

入口为 [CodegenMain.prepare/run L62–82、175–201](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L62-L201)：显式 `codegen.systemFile` 与 `codegen.systemBindings` 经 `SerialCanonicalAdapter.assemble` 形成 system + formal semantics；二者必须同时提供，且与 `codegen.system` 互斥。`semanticProductsFile` 分支 L183–188 是不同生产链，不是本制品基准。

传统 `runCommon` → `generateApplicationLayer` → [CQRSApplicationGenerator L660–678](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L660-L678)：

1. 遍历 `app.aggregates`；**`meta.metaCategory != "application.services.transactor"`** 才进入 Helpers 与 formal Rules 段，不能漏掉此 Saga 排除条件。
2. 先写 CommandHelpers，再 `AggregateRulesBuilder.build(meta, ctx).foreach`；不是存在 formal 文档就无条件写 Rules。
3. Rules attribution 精确为 `ArtifactAttribution("rules-formal", meta.name, "aggregate", List(meta.name))`。
4. B 返回 Some 时每聚合 **一个** `<meta.name>Rules.scala`，内部含可解析命令的 Params/Rule 对。B 按命令 `flatMap`，一个命令失败不会阻止其他可解析命令输出；文件基数 0 或 1，规则成员数不是文件数。

|变体/抑制条件|结果|本轮证据状态|
|---|---|---|
|普通 aggregate，有匹配 formal aggregate，event family/state VO 可解析，至少一个非只读命令通过 B|1 个 Rules 文件；每个通过命令 1 Params + 1 Rule|源码 enabled，未 exercised|
|`application.services.transactor`|调度层不调用本 B/T|suppressed by dispatch|
|formal 缺省、没有同名 aggregate、event family/state metadata 缺失、全部命令只读|None，0 文件|suppressed by builder|
|命令无 produced event，任一 produced event 载荷不可解析，任一 guard 不支持/引用不成立|仅该命令消失；全部失败则 0 文件|partial/suppressed，非自动成功|
|无 guards 但有可解析事件|规则 apply 直接返回成功发射|enabled，未 exercised|
|`RuleModel.emission = None`|T 能渲染 `Right(Nil)`；正常 B 通过规则时不会形成此值|仅模板边界；不能作为缺业务默认|

[PackageLayout L27–29](../baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala#L27-L29) 指定 `ctx.layout.domain.invariants.root = <base>.domain.invariant`。`<base>` 是当前 module context 的 layout，不应猜成统一 `net.imadz`。

[writeArtifact/targetModuleOf L331–412](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L331-L412) 的真实物理路径：

- 单工程：`<target>/app/<base-as-path>/domain/invariant/<meta.name>Rules.scala`。
- **原始 multiProject 的 `rules-formal` 不在 `targetModuleOf` 的 `rules` 分支内**，走 None → `app` 兜底，故仍是 `<target>/app/<base-as-path>/domain/invariant/<meta.name>Rules.scala`，不是按名字推定的 `modules/kernel/...`。将其改到 kernel 是 D8 未决项。
- writer 用 `selfType.packageName.replace('.', '/')` 与 `selfType.name + ".scala"`；先记录依赖名、noteIds、morphisms，再执行 concern includes，可能 scope-skip；写前加 `fingerprintHeader`，经 territorial writer。源码 L393 还对非 strict-saga 的 ledger path 统一加 `app/`，不能把 ledger 路径当物理路径证明。
- 本制品没有第四业务层；选定单工程目标时银行落点明确为 `app/example/bankwealth/domain/invariant/CreditBalanceRules.scala`。新建实验目标根由集成者独占，不指向银行现用目录。

## 3. Model 与 Builder 全字段/全规则账

### 3.1 Model

M 的 package 虽在 `model.application`，输出职责仍为 domain invariant。`AggregateRulesModel extends ArtifactModel`，没有自定义构造器体或注册 override。

|顺序 / 字段|类型、默认值、来源|使用与 JS 差异|
|---|---|---|
|1 `selfType`|`override val TypeRef`，无默认；`TypeRef(meta.name + "Rules", rulesPkg)`|T package/object、writer 路径；formal J 只有 pkg/name 字符串|
|2 `eventType`|`TypeRef`，无默认；`ctx.typeResolver.eventFamily(meta.eventFamilyRef)`|T 使用 `.name` 作泛型和 List 元素，非 `.signature`；JS 用扁平 Protocol.Event|
|3 `stateType`|`TypeRef`，无默认；`entityState(meta.stateRef)`|T 使用 `.name`；JS Params 反而包含 state|
|4 `ownerType`|`TypeRef`，无默认；实体名 + eventType 容器包|成功 RHS 的 `ownerName.Event(...)`；不是 event family trait 的成员|
|5 `rules`|`Seq[RuleModel]`，无默认|保持通过命令的 metadata 顺序；不按名称排序|
|6 `dependencies`|`override val Set[TypeRef]`，无默认|T import 来源及 writer deps；J 现为 output path deps，不是 Scala type imports|
|7 `noteIds`|`override val Seq[String] = Nil`；B `meta.noteId.toSeq`|文件级知识来源；T 不直接输出此字段|

`RuleModel` 的六字段全部无默认：① `name: String`（cmd + Rule）；② `paramsName: String`（cmd + Params）；③ `paramFields: Seq[(String, TypeRef)]`（原命令参数顺序，排除名字精确为 replyTo 的参数）；④ `guards: Seq[GuardModel]`（源声明序）；⑤ `emission: Option[EmittedEvent]`（实际仅一个事件）；⑥ `comment: String`（B 合成说明，**不是直接保存真源 desc，且 T 完全未使用**）。参数无 defaultValue/optional flag/noteId/description 独立字段；可选性只能存在于 TypeRef 本身，不得凭空加默认 None。

`GuardModel(cond: String, onFail: String, errCode: String, desc: String)` 四字段均无默认；`cond` 是 Scala **代码字符串槽**，不是 AST。B 对 onFail/desc 的缺省值不等于 Model 构造默认。

[AggregateBehaviorModel.scala L42–44](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/AggregateBehaviorModel.scala#L42-L44) 提供共享子型全文：

```scala
case class EmittedEvent(name: String, args: Seq[String])
```

`args` 同样是已解析的位置实参代码字符串序列，无默认、无字段名、无事件 owner 字段。保留为 raw 债务槽，不扩大成整个文件 content 字符串模型。

[ArtifactModel L9–47](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L9-L47) 继承成员：`fqn = selfType.packageName + "." + selfType.name`；`registerTo(registry) = registry.register(this)`；`morphisms = Nil`；`noteIds = Nil` 被本 M override。没有成员级来源 span/anchor 自动补全。

[TypeSystem L4–73](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4-L73) 的 TypeRef 依赖：`name, packageName, typeParams: Seq[TypeRef] = Nil`；fqn 空包只返回 name；signature 对带参数的 Tuple数字名输出 `(T1, T2)`，其他泛型 `Name[T...]`，普通类型 name。`collectAllDependencies = Set(this) ++ 子参数递归`；`shouldImport` 排除空包、当前包、scala、java.lang。**B 并未调用递归收集方法**，只取顶层 paramTypes，这是真实差距 D2。

### 3.2 Builder 按执行顺序逐分支

以下对应 B 全文 L12–154，不用其“全部命令”注释替代实际控制流。

|ID / 固定行|精确输入、推导、分支、RHS|目标处理|
|---|---|---|
|B01 L12|`GuardForms = Set("money-positive", "money-sufficient", "map-contains", "map-absent", "collection-covered")`|有限支持，不偷换为任意 JS predicate 支持|
|B02 L15–22|`formalSemantics.toVector.flatMap(_.aggregates.find(_.aggregate == meta.name)).headOption`；无值 return None；按 eventFamilyRef/stateRef 的 targetName 在 registry resolve；任一无值 None；stateFieldNames = fields.map(name).toSet|formal context、元数据、state 都是显式输入，不靠业务名称猜测|
|B03 L23–24|emissions 的 key 只做 `e.event.replace('-', '_')`；guards 的 key 直接 g.command；两次 `.toMap` 同 key 后者覆盖|碰撞/重复输入不能通过新 resolver 悄悄合并，需诊断策略 D7|
|B04 L26–30|commands = 所有 `!isReadOnly`；空 None；按顺序 flatMap buildRule；rules 全空 None|保留逐命令失败事实，未来诊断不能替为成功|
|B05 L32–40|rulesPkg 取 domain.invariants.root；eventType 走 resolver；ownerFqn = eventType.packageName；ownerType 名称 = `meta.entityRef.targetName`，包 = ownerFqn 截到最后一个点前；stateType 走 resolver；selfName = `meta.name + "Rules"`|owner 名与 resolver 推导值可能不一致；包无点时 substring 可抛异常。不得称 build 对任何输入都返回 Option|
|B06 L42–47|paramTypes = rules 所有 paramFields 的 TypeRef set；usesMoneyOps = 任一 cond 文本 contains("MoneyOps")；合 eventType/stateType/ownerType/条件 MoneyOps，shouldImport(rulesPkg) 过滤；之后无条件加 knownFrameworkTypes("iMadzError")、`TypeRef("InvariantRule", "net.imadz.common.CommonTypes")`|MoneyOps 是字符串探测；框架 map 索引缺项可抛异常；无递归参数 import；依赖与代码槽需统一 D2|
|B07 L48–55|按 M 字段构造；noteIds = meta.noteId.toSeq|没有事件/guard 级 noteId 合并；不伪造来源|
|B08 L59–76|buildRule 参数含 cmd/family/emissionByBase/guardsByCommand/stateFields/stateFieldNames/meta/ctx；`stateFields`、`meta` 在此函数体未使用；paramNames = **全部** cmd.parameters 名，包括 replyTo；produced = family.events.filter(producedBy 引用 cmd.name)；空 None；全部 produced 都 resolveEmittedEvent，任一个 None 整命令 None|事件顺序来自 family.events，不来自 emissions map；先解析 emissions 再 guards|
|B09 L78–89|rawGuards 缺省 Vector.empty；map resolveGuard，任一个 None 整命令 None；payloadParams 才过滤 replyTo；comment 精确为 `<Cmd>: guards N, emission E1, E2 (truth-source formal path)`；Rule.name/paramsName 拼后缀；paramFields 调 parameterType；**emission = resolvedEvents.flatten.headOption**|校验了所有事件，却只保存/发出首个；不能把“全解析”误写为“全发射”。D1 阻断多事件迁移|
|B10 L95–108|raw 必须 obj；errCode 必须字符串（succeed-empty 也要求）；onFail 非字符串/缺省→reject；仅 reject/succeed-empty；desc 非字符串/缺省→空串；when 必须 obj、form 字符串且在 GuardForms；param(name) 要 `param.` 前缀且剩余完整名字在 paramNames；stateField(name) 要字符串且是 state 字段名|只校验名称成员关系，不验证 Money/map/collection 类型形状；replyTo 被判定可引用却不进入 Params，是 D7 输入闭包问题|
|B11 L109–121|五形见下表；yield 失败 None；成功 `GuardModel(cond, onFail, errCode, desc)`|不得排序 guards，不能将错误换为幂等成功|
|B12 L125–137|事件字段为空→`Some(EmittedEvent(ev.name, Nil))`，无需 emission 行；否则 bindings = emission.bindings.toMap 或空；按 `ev.fields.toVector` 字段序取绑定再 resolveExpr；任一空 None；args.flatten 构造 EmittedEvent|无载荷事件仍生成 `Event()`；不猜默认值，不做类型强转，不额外读取 clock|
|B13 L141–153|`param.x` 存在→`p.x`，否则 None；`receipt.s` 优先同名参数→p.s，否则仅在有 txid 且 s ∈ reservation/receiptId 时→`p.txid + ":receipt:s"`，其他 None；`literal:v` 总是双引号字符串，只替换反斜杠和双引号；其他前缀 None|receipt 后缀是身份语义，不改格式；literal 不按目标类型转换，LF 等未 escape；D3/D7 不得用 fake 业务值补齐|

五个成功条件精确 RHS（`a/k/c` 均为 param helper 产生的 `p.<field>`，`in/m` 为已验证存在的 state 字段名）：

|form|Builder cond 字符串|失败测试/短路含义|
|---|---|---|
|money-positive|`MoneyOps.isPositive($a.minorUnits)`|T 加 `!(...)`；非正数进入 onFail|
|money-sufficient|`state.$in.get($a.currency).exists(v => MoneyOps.compare(v.minorUnits, $a.minorUnits) >= 0)`|不存在 currency 或余额不足进入 onFail|
|map-contains|`state.$m.contains($k)`|不存在 key 进入 onFail|
|map-absent|`!state.$m.contains($k)`|T 去第一个 `!`；存在 key 进入 onFail|
|collection-covered|`$c.forall(state.$m.contains)`|有任何元素不在集合/map 中进入 onFail；空 collection 的 forall 语义保留|

类型解析支撑：[`TypeResolverDSL.entityState/eventFamily` L140–159](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L140-L159)，[`parameterType` L1150–1151](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L1150-L1151) 转调 TypeResolver。后者 [L19–93、95–149](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala#L19-L149) 包含 primitive、named/nested ref、CustomType 递归、旧 `net.imadz.domain.values` 包改写；一般 MetaRef fallback 是 `???`，最终其他分支可落 `Any`。这是 raw 解析债务，不批准在 JS 中复制 Any 兜底或实现该 Scala 占位。

## 4. Template 所有输出 construct / RHS / 顺序

T 全文附录 C；[CodeGenerationDSL L13–22、60–84、94–110](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L13-L110) 决定文件分隔与 object 展开。

|稳定构造 ID|输出顺序与精确规则|RHS / 缺省 / 副作用|
|---|---|---|
|T01 文件头|T 不发生成头；writer 另加 `// @generated by CodegenMain:<version>`，可另有 knowledge-release 行|header 不是规则实现；版本值未在本轮求取|
|T02 package|`package ${model.selfType.packageName}`|无 package object|
|T03 imports|`dependencies.toList.sortBy(_.fqn).map(_.fqn).distinct` → DSL imports.sorted，每行 `import <fqn>`；单组，后空行|没有 template 隐式额外 import；泛型依赖缺失不能用 wildcard 掩盖|
|T04 顶层 object|`object ${selfType.name} {`，extendsClause=None，implementsClause 默认 None|无父构造参数、annotation、self-type、generic、主/辅构造器、顶层 val 初始化|
|T05 固定注释|object 内先输出三行 P4 英文 doc comment，首行没有额外两空格缩进|完整文字见附录；不使用 Rule.comment；描述“reply success”只是说明，规则本身不回复 Actor|
|T06 循环及 Params|按 model.rules 原序，规则块之间 `\n\n`；先 `  final case class <Cmd>Params(...)`，字段以 `name: type.signature`、`, ` 连接；空字段为 `()`|无字段默认值、extends、自定义方法、ActorRef、隐式参数；不另输出显式 companion（编译器合成不算模板 construct）|
|T07 内嵌 Rule|Params 后空行；`  object <Cmd>Rule extends InvariantRule[EventName, StateName, ParamsName] {`|三泛型实参顺序固定；无上下界/型变声明；无 implicit/final 修饰|
|T08 apply|`    def apply(state: StateName, p: ParamsName): Either[iMadzError, List[EventName]] = {`|无 override；非 curried/implicit；state 在前；不读 Actor command、不持久化|
|T09 guard 循环|按 guards.zipWithIndex；首个 `      if`，后续 `      else if`；failureCond = cond 以 ! 起头则 drop(1)，否则 `!(cond)`|只在 B 的闭形条件集上可解释为保真反极性；不是任意字符串简化器|
|T10 失败 RHS|onFail 精确等于 succeed-empty → `Right(Nil)`；否则 `Left(iMadzError("<errCode>", "<escaped desc>"))`|errCode **未 escape**；desc 只转义 `\` 与 `"`；非空 desc 再输出 ` // <escaped desc>`；guard 失败后不求后续 guard、不构造事件|
|T11 成功 RHS|Some event 且 args 空：`Right(List(Owner.Event()))`；非空：`Right(List(Owner.Event(arg1, arg2)))`；None：`Right(Nil)`|实参原序位置调用，无 named args；一个事件，无 publish/persist；args 不额外 escape|
|T12 收尾|无 guards：六空格 + emissionExpr；有 guards：guardLines 换行再 `      else <emissionExpr>`；关 apply、Rule、顶层 object|文件顺序 package/import/object，用双换行连接，最后一个 `\n`|

本 T 不输出 trait、type alias、val/var/lazy val、implicit object、注解、MANUAL 区、外部查询或错误日志。它也不生成全聚合 `decide` dispatcher、`checkAggregate`、event postcondition、emit helper。不能把 legacy 或 family 的额外成员说成传统 T 的必需内容。

**占位与未完成槽保留范围**：本 T 的 guard/emission 正常路径没有 `???`，但无法构造规则的命令被 B 丢弃；相邻 [AggregateBehaviorTemplate L131–160](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateBehaviorTemplate.scala#L131-L160) 仍有 MANUAL apply 与全空 `???`。不能拿 T 的 `emission=None → Right(Nil)` 替换这些未实现行为。B 的代码字符串 cond/args 和未使用 comment 也不能隐去。

## 5. JS 接线、内容与真实差距

### 5.1 三条 lane：由调用证明，不由目录推断

|lane|真实入口 → producer → 输出|本制品结论|
|---|---|---|
|formal / 银行形态|[`generate-cli.registeredProductProducer` L92–101](../baseline/js/lib/products/generate-cli.mjs#L92-L101) 显式注册 scala-cqrs-domain、domain-v2、play-service；[`scala-cqrs-play-service/generate.mjs` L16–23](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L16-L23) 覆盖 invariant-dsl 调用 `renderInvariant(..., true)`|J L57–132 就是分层规则与薄壳的真实 renderer；银行 A/AP/AW 的构造与之相符。现存输出不是本轮运行，不能从文件头版本单独断言入口|
|formal / 非分层|[`invariant-dsl/produce.mjs` L1–5](../baseline/js/generators/invariant-dsl/produce.mjs#L1-L5)、[`produce-v2.mjs` L8–16](../baseline/js/generators/scala-cqrs-domain/produce-v2.mjs#L8-L16) 都指向 J，不指向同目录 render.mjs；v1 footprint decision3/folds4，v2 decision4/folds6|默认 layered=false，规则落 `.domain`；改正式通用实现时这些消费也须列入闭包|
|legacy|[`invariant-dsl/emit.mjs` L1–9](../baseline/js/generators/invariant-dsl/emit.mjs#L1-L9) 直接读 spec → `render(spec)` → mkdir/write；L 为真实被调函数|可显式调用，近似 InvariantRule/List/iMadzError；但不是 formal producer。不因 renderer 在普通目录就称它被银行使用|
|family2|generate-cli 显式注册 aggregate-core；[`aggregate-core-v1/generate.mjs` L11–23](../baseline/js/generators/scala-cqrs-aggregate-core-v1/generate.mjs#L11-L23) 要 profile `scala-cqrs-aggregate-core@1`，调用 FB → [`render.productionJobs` L15–24](../baseline/js/generators/scala-cqrs-aggregate-core-v1/render.mjs#L15-L24) → FT|确有结构化模型/模板，且反极性优于 J；未被 play-service invariant 分支调用。不是整条 family 已等价|

legacy L 的额外内容只作为接线/职责差异记录：L1303–1310 按有 paramDefs 的命令**字母排序**；L1085–1154 规则先 checkAggregate、可有端口构造器、支持 succeedEmpty 和多事件/forEach；L1317–1456 分 Rules 与 Params 两文件。L94 的 VO 固定表、L102–345 的业务例外/固定 anchors、L426–532 的事件启发式/defaultLiteral/Instant.now、L719–981 的散文 guard 翻译/skip、L1201–1297 的后置过滤，均不是可照搬的 formal 语义。可借鉴外壳，不复活 sentinel、猜默认或“跳过规则也成功”的行为。

### 5.2 formal J 的完整责任分割

|J 区间 / 成员|真实构造与 RHS|拟归属/处置|
|---|---|---|
|L1–19 imports、owner/fields/valuesPath/aggregateRows/renderAggregate|owner 按 context+owner[0] 判断；fields 依 typeName 拼 signature；valuesPath 对 nominal/optional/sequence/map 递归输出 VO path；aggregateRows 过滤 kind=aggregate；renderAggregate 转 buildStateModels→stateEntries|共享/Entity 责任；本 Rules 不删除、不代写|
|L20–30 renderCommand 协议|每聚合 `.domain.Protocol` 混合 sealed Command/Event、case class；sources 与 path deps|Protocol/Entity 组负责拆分，不由 Rules 整体搬到 application|
|L31–42 computations/helpers|host 方法签名；无 hosts 才生成 `Computations.none`；每命令 emit 通过 valueExpression 构造所有事件 Vector|事件构造应回到纯规则/领域服务；“CommandHelpers”名额归应用三方法胶水。计算端口迁移须 D4，不得删除 calls|
|L43–53 external bridge|外部 output→event，identity keys 转 Vector[String]，nominal textual 解包|独立 external event 制品，不能因同文件顺便改身份|
|L57–68 renderInvariant 准备|layout/decisions/folds/exact；同 aggregate 筛命令与事件；layered 决定包；始终准备 params/core/wrapper 字符串；ruleMappings/foldMappings/wrapperMappings 空数组|抽离模型及唯一 Rules assembly；fold/file 仍交 event-handler owner|
|L69–82 命令壳|signature 固定 `(state, p: Command, hosts)`；layered Params 是 `(state, command, hosts)`；规则名为 command id，返回 `Either[String, Vector[Event]]`；本地 vals 从 input 解包；wrapper FQN 转发；记录 wrapper span|与 B/T 的纯 payload Params、Rule object、错误类型、List、state 参数边界均不同；不只是格式问题|
|L83–90 guards/成功|每个 decision：`if (!(decision(predicate))) return Left(errCode)` 或 `Right(Vector.empty)`；最后 `Right(AggCommandHelpers.emitCmd(state,p,hosts))`；rule scope 与每 guard span|替换为有序 RuleModel + if/else-if；保留所有实际 predicate、onFalse、事件和 source，不经字符串 regex 清洗|
|L92–118 event fold|apply match events；set/put/remove/put-all/remove-all/integer-apply/money-apply；unknown throw；每 assignment 无条件 val nextN，再 state.copy 或无赋值 state|不是本 Rules 模板内容，split 后由 event-handler owner保留其语义。addExact/subtractExact 不能改 `+/-`|
|L119–132 entries|layered 发 coreRules、Params、domain wrapper；否则一份 domain Rules；ruleSources 含 aggregate/command/guards；event entries 另外发真实 handler 和 layered forwarding handler；返回两类合并数组|一文件可能由多个逻辑族共享生产源；本 artifact 只拥有 Rules 内容三旧文件→一目标文件的退役计划，不抢 EventHandler|

[`naming.mjs` L2–31](../baseline/js/generators/scala-cqrs-domain/naming.mjs#L2-L31)：symbol 仅验证/反引号，不把 PascalCase 方法改 lowerCamel；typeName nominal 直接 FQN，sequence=Vector；entry 注入固定 domain:1 头并将字符 span 转 UTF-8 bytes，携带 deps/knowledgeIds/productFootprint、merge=null。目标必须在最后排版后重新算 span，不能保留旧 offsets。

E 的决策 RHS 不能在拆分中丢失：L4–33 declaration 缺失抛 TypeError，descriptor 跟踪 exact nominal/member/map-lookup/add/subtract；L34–46 scalar/units/checked 保留单位 require；L47–60 ref/boolean/string/Long.parseLong/BigDecimal/member/text-value/not/exact-positive/isEmpty/nonEmpty/keys；L62–86 二元 collection-covered、exact-sufficient、checked-long 或 exact checkedAmount 算术、and/or/比较、map-lookup/all-equal/map-contains/map-get/contains，未支持操作抛 TypeError。L88–100 literal 按 primitive/nominal-record/exact/optional/sequence/map 递归；L102–114 valueExpression 包含 state/event/p ref、typed literal、`hosts.<method>(state,p)`、member、map-get、精确算术。**这些是 JS 比 BC 五形更宽的语义面**；不能为套 B 而删减成五种 guard 或丢失 host/多事件。

### 5.3 银行 A/AP/AW 的逐成员、完整 RHS 账

A 全文附录 D。header/package/import/object 为 A L1–8；imports 原序为 `.domain._`、`.domain.invariant.params.CreditBalanceRuleParams._`、`.domain.CreditBalanceProtocol._`。A 全部方法都返回 `Either[String, Vector[Event]]`，开头依次 `val state=input.state; val p=input.command; val hosts=input.hosts`；每个 guard 原顺序早 return。以下把共有表达式明确展开为记账符号（不是建议引入代码 dispatcher）：

- R：成功条件 `state.initialized && p.resource == state.id`，失败 `Left("LEDGER_RESOURCE")`。
- CNY：`p.amount.currency == "CNY"`，失败 `Left("LEDGER_CNY")`。
- POS：`p.amount.amount > BigDecimal("0.00")`，失败 `Left("LEDGER_POSITIVE")`。
- MATCH(m,code)：`!state.m.contains(p.txid) || { require(state.m(p.txid).currency == p.amount.currency, "exact units differ"); state.m(p.txid).amount == p.amount.amount }`；失败 `Left(code)`。保留 OR 短路，避免无 key 时 lookup；单位不符是 require 异常，不擅改为业务拒绝。
- EMPTY(m)：原成功条件 `!state.m.contains(p.txid)` 被外层再次取反；命中 key 时 `Right(Vector.empty)`。
- ABSENT(m,code)：同上正向 membership 命中时 `Left(code)`。
- PRESENT(m,code)：`state.m.contains(p.txid)` 不成立时 `Left(code)`。

|顺序 / A 行|guard 顺序（每项含其失败 RHS）|成功 RHS 与真实 emitted event 参数顺序|
|---|---|---|
|1 InitializeAccount L9–19|resource==state.id→ACCOUNT_ID；currency==CNY && amount.currency==currency→ACCOUNT_CURRENCY；!initialized || accountBalance.get(currency).contains(amount)→ACCOUNT_INIT_CONFLICT；!initialized 失败→空成功；amount.amount>=0.00→ACCOUNT_SEED_NONNEGATIVE|`Right(CreditBalanceCommandHelpers.emitInitializeAccount(state,p,hosts))` → `Vector(AccountInitialized(p.resource,p.currency,p.amount))`|
|2 ReserveFunds L20–35|R,CNY,POS；MATCH(committedOutgoing,LEDGER_COMMITTEDOUTGOING_MATCH)；MATCH(compensatedOutgoing,LEDGER_COMPENSATEDOUTGOING_MATCH)；MATCH(reservedAmount,LEDGER_RESERVEDAMOUNT_MATCH)；EMPTY(committedOutgoing), EMPTY(compensatedOutgoing), EMPTY(reservedAmount)；accountBalance.get(amount.currency).exists(_.compareSameUnit(amount)>=0)→LEDGER_SUFFICIENT|`Right(...emitReserveFunds(state,p,hosts))` → `Vector(ReserveFundsConfirmed(p.txid,p.resource,p.amount,"CNY",hosts.BalanceAfterReserveFunds(state,p)))`|
|3 DeductFunds L36–49|R,CNY,POS；MATCH(committedOutgoing,LEDGER_COMMITTEDOUTGOING_MATCH)；EMPTY(committedOutgoing)；ABSENT(compensatedOutgoing,LEDGER_NOT_COMPENSATED)；PRESENT(reservedAmount,LEDGER_PREPARED)；MATCH(reservedAmount,LEDGER_RESERVEDAMOUNT_MATCH)|`Right(...emitDeductFunds(state,p,hosts))` → `Vector(DeductFundsConfirmed(p.txid,p.resource,p.amount))`|
|4 ReleaseReservedFunds L50–62|R,CNY,POS；MATCH(compensatedOutgoing,LEDGER_COMPENSATEDOUTGOING_MATCH)；EMPTY(compensatedOutgoing)；ABSENT(committedOutgoing,LEDGER_NOT_COMMITTED)；MATCH(reservedAmount,LEDGER_RESERVEDAMOUNT_MATCH)|`Right(...emitReleaseReservedFunds(state,p,hosts))` → `Vector(ReleaseReservedFundsConfirmed(p.txid,p.resource,p.amount,"CNY",hosts.BalanceAfterReleaseReservedFunds(state,p)))`|
|5 RecordIncomingCredits L63–77|R,CNY,POS；MATCH(committedIncoming,LEDGER_COMMITTEDINCOMING_MATCH)；MATCH(compensatedIncoming,LEDGER_COMPENSATEDINCOMING_MATCH)；MATCH(incomingCredits,LEDGER_INCOMINGCREDITS_MATCH)；EMPTY(committedIncoming),EMPTY(compensatedIncoming),EMPTY(incomingCredits)|`Right(...emitRecordIncomingCredits(state,p,hosts))` → `Vector(RecordIncomingCreditsConfirmed(p.txid,p.resource,p.amount))`|
|6 CommitIncomingCredits L78–91|R,CNY,POS；MATCH(committedIncoming,LEDGER_COMMITTEDINCOMING_MATCH)；EMPTY(committedIncoming)；ABSENT(compensatedIncoming,LEDGER_NOT_COMPENSATED)；PRESENT(incomingCredits,LEDGER_PREPARED)；MATCH(incomingCredits,LEDGER_INCOMINGCREDITS_MATCH)|`Right(...emitCommitIncomingCredits(state,p,hosts))` → `Vector(CommitIncomingCreditsConfirmed(p.txid,p.resource,p.amount,"CNY",hosts.BalanceAfterCommitIncomingCredits(state,p)))`|
|7 CancelIncomingCredit L92–104|R,CNY,POS；MATCH(compensatedIncoming,LEDGER_COMPENSATEDINCOMING_MATCH)；EMPTY(compensatedIncoming)；ABSENT(committedIncoming,LEDGER_NOT_COMMITTED)；MATCH(incomingCredits,LEDGER_INCOMINGCREDITS_MATCH)|`Right(...emitCancelIncomingCredit(state,p,hosts))` → `Vector(CancelIncomingCreditConfirmed(p.txid,p.resource,p.amount))`|

事件 RHS 来源全文为 [银行 CreditBalanceCommandHelpers.scala L6–20](../baseline/actual-js/app/example/bankwealth/domain/CreditBalanceCommandHelpers.scala#L6-L20)。其三个 abstract computations 方法顺序是 CommitIncomingCredits、ReleaseReservedFunds、ReserveFunds；空 companion **没有**实例实现。本文不补这三个算法、不声称纯度/实现可用。

AP L7–13：上表七个同序 `final case class <Cmd>Params(state: CreditBalanceState, command: CreditBalanceProtocol.<Cmd>, hosts: CreditBalanceComputations)`，无默认值；package `.domain.invariant.params`、一个 `.domain._` import、object CreditBalanceRuleParams。AW L7–20：同序七个 PascalCase 转发 def，每个 `(state, p: <Cmd>, hosts)` 原序构造 AP Params，然后调用 FQN `.domain.invariant.CreditBalanceRules.<Cmd>`，不另做 guard/emit。三文件应完整比较，不只比较 A。

### 5.4 curated-scala 独立账

C 不等于 A 的同业务同输入原始输出。C 的 imports L3–8 原序为 LotEntity、LotEvents、LotState、InvariantRule、iMadzError、Vector；object LotRules 内 P4 注释，随后如下 **12 个 Params/Rule 对**。各 apply 一致为 `(state: LotState, p: <Cmd>Params): Either[iMadzError,List[LotEvents]]`；无持久化/reply。此表给出所有不同的字段和方法体，不把它当银行业务算法。

|C 行|Params 字段顺序|apply 全分支 RHS|
|---|---|---|
|14–22 ReserveWaferRemoval|txid:String,resource:String,wafers:Vector[String]|reservedRemovals.contains(txid)→Right(Nil)；否则 !wafers.forall(carried.contains)→Left(61003,该 guard 原英文 desc)；否则 List(LotEntity.ReserveWaferRemovalConfirmed(p.txid,p.txid+":receipt:reservation",p.wafers))|
|24–31 CommitWaferRemoval|txid,resource（String）|!reservedRemovals.contains→Left(61006,原 desc)；否则 List(CommitWaferRemovalConfirmed(p.txid,p.txid+":receipt:receiptId"))|
|33–40 ReleaseReservedWafer|txid,resource,wafers|!reservedRemovals.contains→Left(61006,原 desc)；否则 List(ReleaseReservedWaferConfirmed(p.txid,p.wafers))|
|42–49 ReserveAddWafer|txid,resource,wafers|reservedAdditions.contains→Left(61007,原 desc)，**不是空成功**；否则 List(ReserveAddWaferConfirmed(p.txid,p.txid+":receipt:reservation",p.wafers))|
|51–58 CommitAddWafer|txid,resource,wafers|!reservedAdditions.contains→Left(61008,原 desc)；否则 List(CommitAddWaferConfirmed(p.txid,p.txid+":receipt:receiptId",p.wafers))|
|60–67 CancelAddWafer|txid,resource|!reservedAdditions.contains→Left(61009,原 desc)；否则 List(CancelAddWaferConfirmed(p.txid))|
|69–75 StartTransfer|operationId:String,from:String,to:String,wafers:Vector[String],manifest:String|无 guards，Right(List(LotEntity.TransferRequested(p.operationId,p.from,p.to,p.wafers,p.manifest)))|
|77–84 RecordResultSucceeded|txid:String|sagaResults.contains→Right(Nil)；否则 Right(List(LotEntity.result_succeeded(p.txid)))|
|86–93 RecordResultRejectedBeforeEffects|txid:String|同一 membership 空成功；否则 result_rejected_before_effects(p.txid)|
|95–102 RecordResultCompensated|txid:String|同一 membership 空成功；否则 result_compensated(p.txid)|
|104–111 RecordResultRecoveryRequired|txid:String|同一 membership 空成功；否则 result_recovery_required(p.txid)|
|113–120 RecordResultOutcomeUnknown|txid:String|同一 membership 空成功；否则 result_outcome_unknown(p.txid)|

上表缩写为 `List(Event(...))` 的成功臂均精确包在 `Right(...)`，event owner 均为 LotEntity；String txid 引用均为 p.txid。每个失败消息及尾注释的完整英文保存在 [C 全文 L14–120][C]，不改写为银行错误说明。末五例保留源码 snake_case 事件名的参考例外；是否做 PascalCase 的源符号映射须 Entity/serializer owner 联动，不改稳定事件身份。

人工 [CreditBalanceCommandHelpers L35–42](../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L35-L42) 的 Deposit 成功是 `CreditBalanceConfirmation(None, state.accountBalance.values.toList)`，失败是 `CreditBalanceConfirmation(Some(error), Nil)`；raw [CommandHelpersBuilder L106–119](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/CommandHelpersBuilder.scala#L106-L119) formal 单槽回复是 `Reply(None)` / `Reply(Some(error))`。二者不相同，不能宣称 raw 默认体已满足 Deposit 业务。

### 5.5 family2 对照：已有能力、仍有不等价内容

FB 已全文读取（L1–180、181–248）。其规则相关模型不只是目录命名：

- L18–29 artifactsSpec 把 rules 放 `.domain.invariant` / kernel；helpers 放 `.domain.command` / kernel，不是用户要求的应用 Helper。
- L50–74 验证 options/packages/names/protobuf、姓名 override，构建 family1 kernel 与 serialization；拒绝 external producer。L76–118 预留名称、resolveNameSet、构建带 ref/role/kind/module/name/identifier/package/fqn/path/sources/refs/directDeps 的 artifact。
- L120–152 rowsByRef 校验完整声明覆盖、source 对应，ordinals 验证 guard 顺序与 `/guards/i`；onFalse 只允许 reject(errCode)/succeed-empty；predicate 经 expressionResolver，dependencies 精确核对，并累积 presentWhen 事实。
- L153–180 事件必须同聚合、不可重复、slots 与事件字段**实际顺序**一致；producer/declared slot type 精确相等；usedDependencies 包含 guard/slot 与 host 输入依赖；每命令包含 base/params/ruleMethod/emitMethod/guards/**emissions 数组**/sources/directDeps。
- L183–220 的 folds 为相邻 EventHandler 模型；L221–235 setDeps 使 rules 依赖 protocol/state/computations/ruleParams/helpers 与 command deps。L237 要每 event 有本地 producer；L238–246 拒绝路径碰撞、悬空 deps、kernel→glue；L247 返回 profile/kernel/serialization/aggregates/artifacts。

FT 完整构造顺序：① templateScope 收集 protocol/state/helpers/params wildcard/computations；② expressionSyntax 绑定 `params.state/command/hosts`；③结果仍 `Either[String,Vector[Protocol.Event]]`；④ package/import/object；⑤ `decide(state,command,hosts)` 模式匹配每 command，构造 Params 再调 ruleMethod；⑥每命令 lowerCamel method，guard 链：顶层 not 直接渲染 argument，否则否定 predicate，onFalse→Left(errCode)/空 Vector；⑦成功调用 helpers.emit；⑧关闭 method/object。它没有 `InvariantRule` object、iMadzError、List、payload-only Params；不是 raw T 的对等实现，但可复用 typed predicate/来源与 import 组织机制。不能为了接入而改 family1 的 nominal/PB/overflow 合同。

## 6. 明确目标、真实 diff 与允许偏差

### 6.1 已定目标

- 按 B/T 职责生成一个 domain.invariant `<Agg>Rules`，内嵌有序 payload-only `<Cmd>Params` 与 `<Cmd>Rule extends InvariantRule[Event,State,Param]`；state 作为 apply 第一个参数，不存 Params；domain Params/events **不含 ActorRef**。
- 事件和 state 的 owner 来自 domain Entity 制品；不新造永久 `.domain.Protocol`/`.domain.Rules` 转发壳。应用 Protocol Commands/Replies 与有明确回复合同的 Actor command 才生成 typed replyTo；规则不得自己猜通用 Reply。
- CommandHelper 归 `application.aggregates.behaviors`，含 toParam/createFailureReply/createSuccessReply；本制品输出 Rule/Params 符号供其消费，不占用 emit helper 的旧错误职责。
- 同业务 guard 顺序、短路、错误码、幂等无事件、所有事件及参数位置/求值顺序保留；不能将现存 JS 更宽语义压缩成 B 支持子集。guard AST 的反极性渲染消除双重否定，不对最终 Scala 做 regex。
- PascalCase 类型/object/file，lowerCamel 方法/参数；Rule 的 `apply` 已符合。不改变 PB 字段号、PID、serializer ID/binding、nominal identity、receipt 字符串格式和 addExact/subtractExact/精度/单位语义。

### 6.2 raw-scala → approved-target 有限偏差表

|raw 事实|已批准方向/尚需裁定|
|---|---|
|规则体使用 cond/args 代码字符串|作为 raw 明确槽保留；JS 使用 typed 表达式模型是目标，不准扩成 file content；如何表达多事件/host 是 D1/D4|
|imports 排序但顶层依赖不足|递归依赖、正常 imports 和同名冲突处理为目标；精确 shared API 由集成者固定，不擅改 BC|
|字段与长返回类型一行|目标可按用户长参数逐行；格式差异单列，不压平全文件空白|
|Rule.comment 未发出|raw 保持事实；是否增加规则说明/描述来源映射需 D3，不称原模板已提供|
|所有 resolvedEvents 校验、仅 headOption|raw 如实保留；目标不得丢 JS 事件。D1 决定升级模型或明确单事件准入，不擅发“等价”|
|multiProject rules-formal 落 app|D8 决定保留或显式修正到 kernel；不能将 family 的位置当 raw 默认|
|literal/errCode 转义不完整、引用仅验证名字|D3/D7 决定准入/渲染合同；不捏造有效业务输入或假绿|

### 6.3 actual-js → approved-target：确定性表达差异

**结构性对照，非同输入新生成字节比较**。minus 为 A L14–18 的准确现存内容；plus 仅落实用户已明确要求的布尔反极性与无多余括号，不表示整份 Rules/API 迁移完成。上下文和成功 RHS 不变。

```diff
--- actual-js/app/example/bankwealth/domain/invariant/CreditBalanceRules.scala
+++ approved-target-expression-only/app/example/bankwealth/domain/invariant/CreditBalanceRules.scala
@@ -14,5 +14,5 @@
     if (!(((p.currency == "CNY") && ((p.amount).currency == p.currency)))) return Left("ACCOUNT_CURRENCY")
     if (!((!(state.initialized) || ((state.accountBalance).get(p.currency)).contains(p.amount)))) return Left("ACCOUNT_INIT_CONFLICT")
-    if (!(!(state.initialized))) return Right(Vector.empty)
+    if (state.initialized) return Right(Vector.empty)
     if (!(((p.amount).amount >= BigDecimal("0.00")))) return Left("ACCOUNT_SEED_NONNEGATIVE")
     Right(CreditBalanceCommandHelpers.emitInitializeAccount(state, p, hosts))
```

用户点名 membership 的准确同类位置 A L30–34，保留原 guard 顺序及余额检查：

```diff
--- actual-js/app/example/bankwealth/domain/invariant/CreditBalanceRules.scala
+++ approved-target-expression-only/app/example/bankwealth/domain/invariant/CreditBalanceRules.scala
@@ -30,5 +30,5 @@
-    if (!(!((state.committedOutgoing).contains(p.txid)))) return Right(Vector.empty)
-    if (!(!((state.compensatedOutgoing).contains(p.txid)))) return Right(Vector.empty)
-    if (!(!((state.reservedAmount).contains(p.txid)))) return Right(Vector.empty)
+    if (state.committedOutgoing.contains(p.txid)) return Right(Vector.empty)
+    if (state.compensatedOutgoing.contains(p.txid)) return Right(Vector.empty)
+    if (state.reservedAmount.contains(p.txid)) return Right(Vector.empty)
     if (!((state.accountBalance).get((p.amount).currency).exists(_.compareSameUnit(p.amount) >= 0))) return Left("LEDGER_SUFFICIENT")
     Right(CreditBalanceCommandHelpers.emitReserveFunds(state, p, hosts))
```

根因定位：[J L83–88][J] 无条件再否定 + [E L53–60][E] 已返回 `!(...)`。family FT L17–20 已区分顶层 not，但银行 formal 路未接它。传统 T L56–60 的去壳仅适用其生成闭形 cond，不能当通用 Scala parse。

### 6.4 API/组织结构对照：不伪造银行失败消息

下列是**结构性跨业务对照，非同输入字节比较**。minus 为银行 A L36–49 的真实方法；plus 为 curated C L24–31 的真实完整 Params/Rule，展示默认目标的 `InvariantRule`/List/实体 owner 结构；**plus 不是 DeductFunds 的批准业务替换**。参数、错误码、receipt 和事件都属于 Lot，不可搬进银行。

```diff
--- actual-js/app/example/bankwealth/domain/invariant/CreditBalanceRules.scala
+++ curated-scala/net/imadz/FabSplitMergeDesign/domain/invariant/LotRules.scala
@@ -36,14 +24,8 @@
-  def DeductFunds(input: DeductFundsParams): Either[String, Vector[Event]] = {
-    val state = input.state
-    val p = input.command
-    val hosts = input.hosts
-    if (!((state.initialized && (p.resource == state.id)))) return Left("LEDGER_RESOURCE")
-    if (!(((p.amount).currency == "CNY"))) return Left("LEDGER_CNY")
-    if (!(((p.amount).amount > BigDecimal("0.00")))) return Left("LEDGER_POSITIVE")
-    if (!((!((state.committedOutgoing).contains(p.txid)) || { require(((state.committedOutgoing)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.committedOutgoing)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_COMMITTEDOUTGOING_MATCH")
-    if (!(!((state.committedOutgoing).contains(p.txid)))) return Right(Vector.empty)
-    if (!(!((state.compensatedOutgoing).contains(p.txid)))) return Left("LEDGER_NOT_COMPENSATED")
-    if (!((state.reservedAmount).contains(p.txid))) return Left("LEDGER_PREPARED")
-    if (!((!((state.reservedAmount).contains(p.txid)) || { require(((state.reservedAmount)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.reservedAmount)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_RESERVEDAMOUNT_MATCH")
-    Right(CreditBalanceCommandHelpers.emitDeductFunds(state, p, hosts))
+  final case class CommitWaferRemovalParams(txid: String, resource: String)
+
+  object CommitWaferRemovalRule extends InvariantRule[LotEvents, LotState, CommitWaferRemovalParams] {
+    def apply(state: LotState, p: CommitWaferRemovalParams): Either[iMadzError, List[LotEvents]] = {
+      if (!(state.reservedRemovals.contains(p.txid))) Left(iMadzError("61006", "No reserved removal found for this transaction.")) // No reserved removal found for this transaction.
+      else Right(List(LotEntity.CommitWaferRemovalConfirmed(p.txid, p.txid + ":receipt:receiptId")))
+    }
   }
```

完整银行目标方法要保留 §5.3 的每条 guard 和 event body，但还缺 errCode→message 的权威输入与 computation port/Params API 裁定；因此不填假 desc、不用 `???` 冒充已观察目标。`approved-target` 的完整 expected 文件仍是后续 D1–D8 裁定后的交付项，不能将此局部 diff 命名为 ready。

## 7. 胶水、默认槽与副作用边界

|完整符号 / 来源|所需合同与实际语义|供给状态|
|---|---|---|
|`net.imadz.common.CommonTypes.InvariantRule`|`trait InvariantRule[Event,State,Param] { def apply(state: State,param: Param): Either[iMadzError,List[Event]] }`；Param 不变型，tuple/另一个 Params 不等价|冻结 [CommonTypes L15–17](../baseline/common/src/main/scala/net/imadz/common/CommonTypes.scala#L15-L17)；不是 Jar 可用性证明|
|`net.imadz.common.CommonTypes.iMadzError`|`final case class iMadzError(code:String,message:String) extends Throwable with CborSerializable`；保留 code/message、不可用 String 悄悄替代|同文件 L11；银行 decision 产品只有 errCode 的显示输出，不证明有 message|
|`net.imadz.common.MoneyOps`|isPositive(String) 用 BigInt>0；compare(String,String) 用 BigInt.compare；shift(String,String,Int) 精确运算；B 仅用前两者|只找到已冻结 [JS scaffold-static MoneyOps L12–22](../baseline/js/generators/scaffold-static/app/net/imadz/common/MoneyOps.scala#L12-L22) 的源码供给证据；并不证明 BC/common-core 所消费 Jar 有它，也不授权复制私有库|
|`net.imadz.common.application.CommandHandlerReplyingBehavior.CommandHelper`|toParam(state,command)；createFailureReply(param)(error)；createSuccessReply(param)(state)|[common 源 L16–23](../baseline/common/src/main/scala/net/imadz/common/application/CommandHandlerReplyingBehavior.scala#L16-L23)；生成 Helper 必须在 application.aggregates.behaviors|
|`...CommandHandlerReplyingBehavior.runReplyingPolicy`|五泛型，`(rule,helper)(state,command)` 返回 RunnablePolicyWithHelper；`.replyWith(replyTo)` 先 toParam，再 rule.fold，Left→Effect.reply（不 persist），Right→Effect.persist(events).thenReply(replyTo)(helper.createSuccessReply(param))|[L29–75](../baseline/common/src/main/scala/net/imadz/common/application/CommandHandlerReplyingBehavior.scala#L29-L75)，thenReply 接收事件应用后的新 state；空事件成功也不能任意改为旧状态闭包|
|`RunnablePolicyWithHelper.replyWithAndPublish`|成功 persist 后 thenRun foreach EventStream.Publish，再 thenReply；失败只有 reply|与 replyWith 不同，不能换用来“补发”事件；发布次数必须另验|
|domain Entity owner 与 params VO|Owner.Event 构造必须与真实事件字段顺序/名义类型一致；state 只在 event application 演进|跨 artifact 符号合同，不从 FQN 文本猜嵌套 owner|
|纯 computations/领域服务端口|银行三个 BalanceAfter... 签名已观察，算法未在这份生成文件中实现|保留为 D4 显式依赖；不默许 I/O、不删除调用、不实现余额算法|

BC [scaffold/build.sbt L131](../baseline/bc/scaffold/build.sbt#L131) 声明 `"net.imadz" %% "common-core" % "0.2"`。这只说明该 scaffold 的坐标，不能证明最终消费者 Jar 与冻结 common 源相同；同包 scaffold 源的供给/覆盖也须实施前核清。JS play-service 的 [generate-cli L114–126](../baseline/js/lib/products/generate-cli.mjs#L114-L126) 校验显式本地 saga-core 0.3.0 及条件 Monarch pins，并未在该段证明 CommonTypes/MoneyOps 所需 ABI。此项阻断不通过 publishLocal/升级 runtime/私拷源码消除。

[AggregateBehaviorBuilder L167–214](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L167-L214)：formal 只补已有 groups 未覆盖的非只读命令，解析 guards/emissions 后构造 `PolicyBasedLogic(TypeRef(<Cmd>Rule,<pkg>.<Agg>Rules), helperType)`，组名 FormalRuleBehaviors。其判定代码与 B 重复，不应再在 JS 复制第三套。

[CommandHelpersBuilder L20–25、70–78](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/CommandHelpersBuilder.scala#L20-L78)：formalReplyName 依赖 guards/emissions 非空及首个回复存在；有 formalReplyName 才使用 `<Agg>Rules.<Cmd>Params`，按命令参数序构造。B 的规则可产条件与此并非完全一致（例如回复缺失、部分命令规则解析失败），须共用准入/diagnostics，不能拿规则文件出现当 Helper 链接成功。

## 8. 后续 JS 写集合、独占组装与迁移

**以下全是第二阶段 proposed，不是本轮写入授权。** 路径均相对 JS 仓库 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc`；本轮实际写面只有本文件及 details JSON。

|归属|拟修改/新建路径|具体职责|
|---|---|---|
|本 artifact owner|`generators/scala-cqrs-domain/models/aggregate-rules-model.mjs`（proposed new）|M 的结构字段/Rule/Guard/EmittedEvent 对应，保留显式代码槽身份与来源；D1 若扩 emission 必须版本化，不用 content 包整文件|
|本 artifact owner|`generators/scala-cqrs-domain/build-aggregate-rules-models.mjs`（proposed new）|从 admitted products 推导 Rule/Params、顺序/来源/类型依赖；unsupported 附命令级原因；不推断业务 desc/default/事件|
|本 artifact owner|`generators/scala-cqrs-domain/templates/aggregate-rules.mjs`（proposed new）|唯一 `<Agg>Rules.scala` 内容组装者；T01–T12 与经认可差异；不顺手输出 EventHandler/Protocol/Helper|
|本 artifact owner|`generators/scala-cqrs-domain/render-aggregate-rules.mjs`（proposed new）|将模型交模板、返回最终文件 entries/mappings；所有 formal 入口共用，不能各拼一份 Rules|
|集成者独占 shared 文件|`generators/scala-cqrs-domain/render-domain.mjs`、`render-expressions.mjs`、`produce-v2.mjs`、`generators/invariant-dsl/produce.mjs`、`generators/scala-cqrs-play-service/generate.mjs`|先 split 规则与 folds/command；再所有正式路指向唯一 owner。表达反极性 shared API、调用者参数由集成者固定，本组不并发写这些文件|
|family2 owner + 集成者|`generators/scala-cqrs-aggregate-core-v1/build-models.mjs`、`templates/rules.mjs`、`render.mjs`|借用 typed expression/import/来源能力或消费共同模型；不能将 family2 注册表直接塞进银行 profile。有限 family 无 external 的准入仍保留|
|公共接口 owner|`lib/scala-target/naming.mjs`、`lib/scala-target/model.mjs`、`lib/products/generate-cli.mjs`、`src/core/generate.mjs`（仅确有必要时）|单一 names/type/layout/writer/registry；本组只提出 deps/source/span 接口要求。当前没有批准新增 CLI flag|
|fixtures owner|`docs/codegen-parity/fixtures/aggregate-rules-formal/`、`docs/codegen-parity/expected/aggregate-rules-formal/`（proposed only）|同语义输入、独立 oracle、完整 expected 文件；本轮不创建这些路径|

依赖：`shared-layout-types`、`shared-expression-rendering`、`domain-entity`、`value-object`、`application-protocol`、`command-helper`、`aggregate-behavior`、`event-handler`、`shared-writer-anchors`。这些是接口依赖，不表示其他 diff 已审定或其他 owner 已完成。

唯一组装权：新 `templates/aggregate-rules.mjs` + entry adapter 负责本目标 Rules 的最终 bytes；`render-domain.mjs` 由集成者独占拆分，family2 由其 owner 迁接。禁止 invariant-rule 组、family2 组、本组同时登记同一物理文件；同一路若确有一般 invariant-rule 与 formal-rule 共存，集成者在同一 assembly 汇合有序成员并诊断同名冲突，不能“最后 writer 获胜”。

旧→新迁移清单（未来新目标，不手改 generated/current）：

1. `app/<base>/domain/invariant/<Agg>Rules.scala` 内容 replace 为唯一模型模板输出。
2. `app/<base>/domain/invariant/params/<Agg>RuleParams.scala` 中 payload Params move 到 Rules owner；按 D4 裁定计算端口参数；旧 wrapper Params 退役。
3. `app/<base>/domain/<Agg>Rules.scala` 的 forwarding defs 退役，不保留兼容空壳称完成。
4. `domain/<Agg>CommandHelpers.scala` 的事件构造迁回纯规则/领域服务；computations 与调用时序另交领域服务/应用胶水 owner；真正 `application/aggregates/behaviors/<Agg>CommandHelpers.scala` 由其制品生成。
5. application behavior imports/PolicyBasedLogic/Helper param type，protocol/entity owner imports，测试 fixture、生成配置、source query 输出定位一起迁移。PB/PID/serializer nominal identities 不由此重命名。
6. ledger kind 对应、旧 owned path 退役与 anchor span 重算经正式 writer/注册配置完成；只计划，不手改现 ledger/anchors，也不能以 merge=null 覆盖手写区。保留源 source.document/pointer、command/guard 顺序；最终格式完成后才算 fingerprint 与 UTF-8 offsets。

## 9. 验收计划与准确 CLI 形状（全部未执行）

### 9.1 fixtures 与对账对象

不造第二套银行真源。后续在独立 fixture 中从同一语义载体派生 BC formal canonical+bindings 与 JS product request；需逐字段记录类型/顺序/guard/error/事件绑定的映射，不能以两个不等价输入各编译成功代替对账。

|fixture|必查分支/完整输出|
|---|---|
|F1 formal 开/关|non-saga、saga、formal absent/aggregate absent/state/family 缺失、只读、部分失败/全部失败；预期文件 0/1 和 Params/Rule 对数|
|F2 五闭形 guards|reject/succeed-empty、无 guards、多个 guards 次序、MoneyOps 条件 import、无 payload event `Event()`；errCode 即使空成功也必须存在的 raw 行为|
|F3 emission/ref|所有事件字段位置、param/receipt 同名优先、receipt fallback 两种后缀、literal 反斜杠/引号/LF、缺绑定、多个事件（D1 前保持阻断）、replyTo 禁入 Params|
|F4 type/layout|嵌套 Option/List/Map/Vector nominal、同名 type、owner 解析、单/多工程；不得把 String/Any 或 FQN 铺满当 workaround|
|F5 银行结构观察|§5.3 七方法完整 guards+events+三个 computations 签名；新 state/reply、错误说明、端口供给缺口逐项补实证，不把 C 当银行 oracle|
|F6 assembly/来源|两次相同输入完整文件稳定；变更一条 guard 只产生可解释局部 diff；全部新位置 source query 可回到原作者；旧壳退休与手写内容保护|

比较至少包括：Rules 完整文件、旧 Params/wrapper 是否依计划退役、Entity/Protocol/Helpers/Behavior 依赖闭包；不是只对 rule count。原始 Scala 的生成头与明确选定的行尾差异可单列白名单，不能删除全部空白、包名、注释或 RHS 后比较。

### 9.2 JS 公开 CLI

来自 [generate-cli L66–88](../baseline/js/lib/products/generate-cli.mjs#L66-L88)：四个路径参数必须显式，允许 `--plan`；没有 `--artifact aggregate-rules-formal`、`--only-rules`、`--no-ledger` 一类 flag。下面使用 **proposed** fixture/新目标路径，不声称文件已存在。

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/aggregate-rules-formal/request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-domain-v2 \
  --out /Users/zhongdj/Workspaces/mad-polaris/aggregate-rules-formal-candidate-js \
  --options-json /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/aggregate-rules-formal/options.json \
  --plan
```

- `--plan` 仍捕获 request/options/generator manifest、编译 product graph/AST、构建全部该 fixture 闭包 entries（源码层，不是 Scala 编译）；L86 不调用 applyEntries，不写输出/ledger/anchors。它不是运行验证，也不证明旁路入口安全。
- 后续经授权去掉 `--plan` 才实际生成；[applyEntries L246–267](../baseline/js/src/core/generate.mjs#L246-L267) mkdir/write 所有 changed entries，复读比对，写目标根 `truthsrc.ledger.json` 与 `anchors.json`。无 rollback/锁保证；必须独占 out。
- 本 fixture 选择 domain-v2 是局部纯领域闭包，**不等于银行 play-service 路径通过**。银行接线验收另把 generator 精确改为 `.../generators/scala-cqrs-play-service` 并提供该 profile 的完整 request/options、既有本地 runtimeArtifact 与 externalSourceRoots；L114–139 会校验本地 Jar/目录。不能为过门下载、发布或调换 runtime pin。
- 若 D4 需要捕获外置实现，改走已存在 generate-project 契约并由集成者列出 project/graph/捕获写面；本组不猜它的附加 flag，也不在此阶段运行它。

### 9.3 BC 传统入口

BC 需在其仓库作为工作目录解析 scaffold。下列只记录以后执行的参数形状；`-Dcodegen.systemFile/systemBindings` 已实读，不能用 Examples 伪装 formal 开启。作用域由 fixture 只有该聚合及必要依赖来限定，不假设只生成一个制品。

```bash
sbt \
  -Dcodegen.systemFile=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/aggregate-rules-formal/bc-canonical.json \
  -Dcodegen.systemBindings=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/aggregate-rules-formal/bc-bindings.json \
  -Dcodegen.targetDir=/Users/zhongdj/Workspaces/mad-polaris/aggregate-rules-formal-candidate-bc \
  -Dcodegen.multiProject=false \
  "runMain net.imadz.codegen.CodegenMain"
```

工作目录必须为 `/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen`，由以后获准的执行者显式设置。本轮没有进入或写 BC 仓库。该命令会启动 sbt/JVM，可能编译/下载/写 target 与缓存，复制 scaffold，按 CQRS writer 写全依赖产物与台账；还可能执行版本检测。**不是只写隔离 app 就没有其他副作用**。必须由集成者批准离线供给、缓存/工作树写面、一次批末预算后才能执行；此文不授予下载/发布/服务权限。

### 9.4 必要行为与质量证据

后续复用受影响闭包的真实测试入口，具体 suite/runner 尚未为本 fixture 固定，因此不编造 `testOnly AggregateRulesFormalSpec`。要求独立 oracle 验证：guard 先后/短路、拒绝无 persist、幂等无事件、成功事件参数顺序、event application 更新状态、thenReply 读新 state、回复次数及 replyWith 没有意外发布；必要 codec/recovery 只覆盖本次接口依赖闭包。任何命令/资源/预算须另获实施批准。

普通方法 CC 目标 ≤5；6–10 逐方法说明，>10 重构或逐方法认可例外；普通嵌套目标 ≤2；sealed dispatch 单列，不能 String/Any dispatcher 刷分。度量工具/版本/Scala 口径未定，当前 **not-measured**。内容生成/比对初始预算 5 分钟、集中局部编译/行为初始预算 15 分钟，是计划停止点而非已有性能结果；超时返回现证据，不全量银行重跑。

## 10. 具体未决项

|ID|阻断点与必须决定的内容|
|---|---|
|D1 多事件|B 校验全部 produced、只保存 headOption；J/FB 发所有事件。目标是升级为有序 emissions 还是将传统对账仅限单事件？不得丢失 JS 已有事件；与 behavior/helper 同一次准入决定|
|D2 结构类型与导入|递归 TypeRef/import/collision API、事件 owner/State 名字与 Params nested owner 必须和 Entity/Helper 同一 resolver；raw B 顶层 paramTypes 不足不能原样充作正确目标|
|D3 错误与文本|JS onFalse 仅 errCode，iMadzError.message 的权威来源/缺省策略是什么？Rule.comment 是否输出？errCode/desc/literal 的 quote/backslash/LF 及注释换行如何准确编码？不能按错误码编故事或复制 Lot desc|
|D4 计算端口与 Params|银行三个 BalanceAfter... 仍是 abstract host calls；纯 payload Params 不得再塞 Actor command/state/hosts。选具名领域服务依赖的 Rule class、显式纯计算输入，还是其他已批准合同？调用发生在成功臂、一次求值/短路、Money.amount 与 raw minorUnits 表达如何保真必须逐项定义；不擅复制银行算法|
|D5 回复/规则准入一致性|无 replyFamily、空 formal guards/emissions、部分不可解析规则时 Helper 是否仍生成？typed replyTo 的实际回复合同必须明确，不能首回复猜测后称接通；只读命令不用写 Helper|
|D6 真实供给|最终消费者 CommonTypes/CommandHandlerReplyingBehavior/MoneyOps 来自哪个已冻结 artifact 或批准 scaffold？坐标/版本/ABI/hash 必须核对；不批准 runtime 升级、publishLocal 或新私有副本|
|D7 不可解析/不安全输入|重复 emissions/guards key 后写覆盖、被移除 replyTo 仍可绑定、owner substring 异常、仅名字不检查结构类型、literal 总当 String、TypeResolver ???/Any：后续选择显式拒绝诊断/有限支持，不默认成功或静默跳过；保留 raw 对照|
|D8 物理布局与共同文件 owner|raw multi `rules-formal` 落 app，family2 落 kernel；明确目标 profile 后由集成者决定修正是否列为已批准偏差，并协调 invariant-rule/formal-rule 同文件组装与旧输出退役|

保存本文不解决以上裁定，也不影响其他制品独立交付。此状态不是 implemented、ready、parity-PASS、behavior-PASS 或全覆盖认证。

## 附录 A. Model 完整固定源码

```scala
package net.imadz.codegen.scaffolding.cqrs.model.application

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, TypeRef}

/** P4 形式路径规则面（formal-semantics → runReplyingPolicy 规则流）：
  * 每个聚合一个 `<Agg>Rules.scala`（domain.invariant），params case class + 规则对象，
  * 与 js 侧 rules_domain_gen 输出同风格（规则＝纯 domain，不依赖 application/akka）。
  * 守卫按真源声明序求值（金主语义）；`succeed-empty`＝幂等空事件成功（Right(Nil)）；
  * 成功臂发射＝真源 bindings 的机械解析（p.<param> 相对引用）。 */
case class AggregateRulesModel(
    override val selfType: TypeRef, // object <Agg>Rules（domain.invariant）
    eventType: TypeRef, // <Agg>Events 族（规则泛型 Event 参数）
    stateType: TypeRef, // <Agg>State
    ownerType: TypeRef, // <Agg>Entity（事件值引用 owner object——Slice 2 教训）
    rules: Seq[RuleModel],
    override val dependencies: Set[TypeRef],
    override val noteIds: Seq[String] = Nil
) extends ArtifactModel

case class RuleModel(
    name: String, // <Cmd>Rule
    paramsName: String, // <Cmd>Params
    paramFields: Seq[(String, TypeRef)], // 命令参数序（replyTo 除外）
    guards: Seq[GuardModel], // 真源声明序＝求值序
    emission: Option[EmittedEvent], // 成功臂事件（载荷序位置实参）
    comment: String // 规则说明（真源 desc 原文）
)

/** 单条守卫的可渲染体：cond＝成功条件（真源 when 形式）的 Scala 布尔表达式；
  * onFail ∈ reject（Left(err)）| succeed-empty（Right(Nil) 幂等成功）。 */
case class GuardModel(cond: String, onFail: String, errCode: String, desc: String)
```

## 附录 B. Builder 完整固定源码

```scala
package net.imadz.codegen.scaffolding.cqrs.builder.application

import net.imadz.codegen.scaffolding.cqrs.model.application.{AggregateRulesModel, EmittedEvent, GuardModel, RuleModel}
import net.imadz.codegen.scaffolding.cqrs.{GeneratorContext, TypeRef}
import net.imadz.meta._

/** P4 形式路径规则构建器：真源 guards（结构化闭形）+ bindings（发射）→
  * `<Agg>Rules.scala` 模型。全部命令的守卫与发射均可机械解析才成体——
  * 任一失败＝命令级放弃保持 ??? 桩语义（不猜）。formalSemantics 缺省＝不发射（Examples 零漂移）。 */
object AggregateRulesBuilder {

  private val GuardForms = Set("money-positive", "money-sufficient", "map-contains", "map-absent", "collection-covered")

  def build(meta: AggregateRootMetadata, ctx: GeneratorContext): Option[AggregateRulesModel] = {
    val aggSemantics = ctx.formalSemantics.toVector
      .flatMap(_.aggregates.find(_.aggregate == meta.name)).headOption
    val agg = aggSemantics.getOrElse(return None)
    val eventFamily = ctx.metaRegistry.resolveByName[EventFamilyMetadata](meta.eventFamilyRef.targetName).getOrElse(return None)
    val stateFields = ctx.metaRegistry.resolveByName[ValueObjectMetadata](meta.stateRef.targetName)
      .map(_.fields).getOrElse(return None)
    val stateFieldNames = stateFields.map(_.name).toSet

    val emissionByBase = agg.emissions.map(e => (e.event.replace('-', '_'), e)).toMap
    val guardsByCommand = agg.guards.map(g => (g.command, g.guards)).toMap

    val commands = meta.commandFamily.commands.filter(!_.isReadOnly)
    if (commands.isEmpty) return None
    val rules = commands.flatMap(cmd =>
      buildRule(cmd, eventFamily, emissionByBase, guardsByCommand, stateFields, stateFieldNames, meta, ctx))
    if (rules.isEmpty) None
    else {
      val rulesPkg = ctx.layout.domain.invariants.root
      // 事件值引用走实体对象 owner（CreditBalanceEvents 只是 trait 类型名——Slice 2 教训）。
      // 嵌套族约定：族 TypeRef 的 packageName＝owner object 的 FQN——owner 的 import
      // 面是其容器包 + 对象名（import 到 object 自身，限定引用方可解析，r11c 实测）。
      val eventType = ctx.typeResolver.eventFamily(meta.eventFamilyRef)
      val ownerFqn = eventType.packageName
      val ownerType = TypeRef(meta.entityRef.targetName, ownerFqn.substring(0, ownerFqn.lastIndexOf('.')))
      val stateType = ctx.typeResolver.entityState(meta.stateRef)
      val selfName = meta.name + "Rules"
      // 依赖：事件 owner、族/状态、参数值类型、MoneyOps（money 守卫/折叠算术）、iMadzError
      val paramTypes = rules.flatMap(_.paramFields.map(_._2)).toSet
      val usesMoneyOps = rules.exists(r => r.guards.exists(g => g.cond.contains("MoneyOps")))
      val deps = (paramTypes + eventType + stateType + ownerType ++
        (if (usesMoneyOps) Some(TypeRef("MoneyOps", "net.imadz.common")) else None).toSeq).toSet
        .filter(_.shouldImport(rulesPkg)) + ctx.knownFrameworkTypes("iMadzError") +
        TypeRef("InvariantRule", "net.imadz.common.CommonTypes")
      Some(AggregateRulesModel(
        selfType = TypeRef(selfName, rulesPkg),
        eventType = eventType,
        stateType = stateType,
        ownerType = ownerType,
        rules = rules,
        dependencies = deps,
        noteIds = meta.noteId.toSeq))
    }
  }

  private def buildRule(
      cmd: SubordinateCommandMetadata,
      family: EventFamilyMetadata,
      emissionByBase: Map[String, net.imadz.meta.filesystem.FormalEmission],
      guardsByCommand: Map[String, Vector[ujson.Value]],
      stateFields: Seq[net.imadz.meta.FieldMetadata],
      stateFieldNames: Set[String],
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): Option[RuleModel] = {
    val paramNames = cmd.parameters.map(_.name).toSet
    val produced = family.events.filter(_.producedBy.exists(_.targetName == cmd.name))
    if (produced.isEmpty) return None
    // 发射解析（p.<param> 相对引用）——全产出事件全槽位可解析才成体
    val resolvedEvents = produced.map { ev =>
      resolveEmittedEvent(ev, emissionByBase.get(ev.name), paramNames)
    }
    if (resolvedEvents.exists(_.isEmpty)) return None
    // 守卫解析（闭形 → 可渲染条件）——任一行不可解析＝命令级放弃
    val rawGuards = guardsByCommand.getOrElse(cmd.name, Vector.empty)
    val resolvedGuards = rawGuards.map(resolveGuard(_, stateFieldNames, paramNames))
    if (resolvedGuards.exists(_.isEmpty)) return None
    val payloadParams = cmd.parameters.filter(_.name != "replyTo")
    val comment = s"${cmd.name}: guards ${resolvedGuards.flatten.size}, emission ${produced.map(_.name).mkString(", ")} (truth-source formal path)"
    Some(RuleModel(
      name = cmd.name + "Rule",
      paramsName = cmd.name + "Params",
      paramFields = payloadParams.map(p => (p.name, ctx.typeResolver.parameterType(p.parameterType))),
      guards = resolvedGuards.flatten,
      emission = resolvedEvents.flatten.headOption,
      comment = comment))
  }

  /** 真源结构化守卫 → GuardModel（cond＝成功条件的 Scala 布尔表达式）。
    * money 形式走 MoneyOps 字符串算术（Money 形状＝minorUnits/currency）。 */
  private def resolveGuard(raw: ujson.Value, stateFieldNames: Set[String], paramNames: Set[String]): Option[GuardModel] = {
    val obj = raw.objOpt.getOrElse(return None)
    val errCode = obj.get("errCode").flatMap(v => v.strOpt).getOrElse(return None)
    val onFail = obj.get("onFail").flatMap(v => v.strOpt).getOrElse("reject")
    if (onFail != "reject" && onFail != "succeed-empty") return None
    val desc = obj.get("desc").flatMap(v => v.strOpt).getOrElse("")
    val when = obj.get("when").flatMap(_.objOpt).getOrElse(return None)
    val form = when.get("form").flatMap(_.strOpt).getOrElse(return None)
    if (!GuardForms.contains(form)) return None
    def param(name: String): Option[String] =
      when.get(name).flatMap(_.strOpt).filter(_.startsWith("param."))
        .map(_.stripPrefix("param."))
        .filter(paramNames.contains).map("p." + _)
    def stateField(name: String): Option[String] =
      when.get(name).flatMap(_.strOpt).filter(stateFieldNames.contains)
    val cond: Option[String] = form match {
      case "money-positive" => param("amount").map(a => s"MoneyOps.isPositive($a.minorUnits)")
      case "money-sufficient" =>
        for { a <- param("amount"); in <- stateField("in") }
          yield s"state.$in.get($a.currency).exists(v => MoneyOps.compare(v.minorUnits, $a.minorUnits) >= 0)"
      case "map-contains" =>
        for { m <- stateField("map"); k <- param("key") } yield s"state.$m.contains($k)"
      case "map-absent" =>
        for { m <- stateField("map"); k <- param("key") } yield s"!state.$m.contains($k)"
      case "collection-covered" =>
        for { m <- stateField("map"); c <- param("collection") } yield s"$c.forall(state.$m.contains)"
    }
    cond.map(GuardModel(_, onFail, errCode, desc))
  }

  /** 事件发射行：载荷非空须全槽位绑定覆盖（载荷字段序位置实参）；空载荷＝无参发射。 */
  private def resolveEmittedEvent(
      ev: SubordinateDomainEventMetadata,
      emission: Option[net.imadz.meta.filesystem.FormalEmission],
      paramNames: Set[String]
  ): Option[EmittedEvent] =
    if (ev.fields.isEmpty) Some(EmittedEvent(ev.name, Nil))
    else {
      val bindings = emission.map(_.bindings.toMap).getOrElse(Map.empty[String, String])
      val args = ev.fields.toVector.map(f =>
        bindings.get(f.name).flatMap(expr => resolveExpr(expr, paramNames)))
      if (args.exists(_.isEmpty)) None
      else Some(EmittedEvent(ev.name, args.flatten))
    }

  /** 真源绑定表达式 → 规则内 Scala 实参（V13 词法）。param.x→p.x；receipt.s→命令同名参
    * （P4 真源已声明收据值起源＝param，此为兼容形态）；literal:v 转义字面量。 */
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
}
```

## 附录 C. Template 完整固定源码

```scala
package net.imadz.codegen.scaffolding.cqrs.template.application

import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.application.{AggregateRulesModel, RuleModel}
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

/** P4 形式路径规则文件（<mod>.domain.invariant.<Agg>Rules.scala）：
  * params case class + 规则对象（InvariantRule），守卫按真源声明序 if/else-if 链；
  * `succeed-empty` 守卫失败臂＝Right(Nil)（幂等空事件成功），`reject`＝Left(iMadzError)；
  * 成功臂＝Right(List(<owner>.<Event>(<args>)))——事件值引用走实体对象 owner（Slice 2 教训）。 */
object AggregateRulesTemplate extends CodeTemplate[AggregateRulesModel] {

  def generate(model: AggregateRulesModel): String = {
    val pkgDecl = packageDecl(model.selfType.packageName)

    val importDecl = imports(
      (model.dependencies.toList.sortBy(_.fqn).map(_.fqn).distinct): _*)

    val eventType = model.eventType.name
    val stateType = model.stateType.name
    val ownerName = model.ownerType.name
    val rulesBody = model.rules.map(r => renderRule(r, eventType, stateType, ownerName)).mkString("\n\n")

    val objectDef = ObjectDefinition(
      name = model.selfType.name,
      extendsClause = None,
      body =
        s"""|/** Formal-path rules from the truth tree (P4 state deepening; golden-master
            |  * semantics transcribed mechanically). Guards evaluate in declaration
            |  * order; succeed-empty failures reply success with no events. */
            |$rulesBody""".stripMargin
    )

    SourceFile(
      packageDecl = pkgDecl,
      importDecl = importDecl,
      definitions = Seq(objectDef)
    ).code
  }

  private def renderRule(rule: RuleModel, eventType: String, stateType: String, ownerName: String): String = {
    val paramsDef =
      rule.paramFields.map { case (n, t) => s"$n: ${t.signature}" }.mkString(", ")
    val paramsLine =
      if (paramsDef.isEmpty) s"final case class ${rule.paramsName}()"
      else s"final case class ${rule.paramsName}($paramsDef)"

    val emissionExpr = rule.emission.map { e =>
      if (e.args.isEmpty) s"Right(List($ownerName.${e.name}()))"
      else s"Right(List($ownerName.${e.name}(${e.args.mkString(", ")})))"
    }.getOrElse("Right(Nil)")

    val guardLines = rule.guards.zipWithIndex.map { case (g, i) =>
      val failure = if (g.onFail == "succeed-empty") "Right(Nil)"
      else s"""Left(iMadzError("${g.errCode}", "${escape(g.desc)}"))"""
      // 失败检查＝成功条件的否定；cond 以 ! 开头时直接剥壳（避免 !(!...) 双重否定）
      val failureCond = if (g.cond.startsWith("!")) g.cond.drop(1) else s"!(${g.cond})"
      val note = if (g.desc.nonEmpty) s" // ${escape(g.desc)}" else ""
      val prefix = if (i == 0) "      if" else "      else if"
      s"""$prefix ($failureCond) $failure$note"""
    }.mkString("\n")

    val body =
      if (rule.guards.isEmpty) s"      $emissionExpr"
      else s"""$guardLines
              |      else $emissionExpr""".stripMargin

    s"""  $paramsLine
       |
       |  object ${rule.name} extends InvariantRule[$eventType, $stateType, ${rule.paramsName}] {
       |    def apply(state: $stateType, p: ${rule.paramsName}): Either[iMadzError, List[$eventType]] = {
       |$body
       |    }
       |  }"""
  }

  private def escape(s: String): String = s.replace("\\", "\\\\").replace("\"", "\\\"")
}
```

## 附录 D. actual-js 银行规则完整固定内容

此处保留所有长行和现存缺陷，不当成目标排版。

```scala
// @generated by truthsrc scala-cqrs-domain:1
package example.bankwealth.domain.invariant

import example.bankwealth.domain._
import example.bankwealth.domain.invariant.params.CreditBalanceRuleParams._
import example.bankwealth.domain.CreditBalanceProtocol._

object CreditBalanceRules {
  def InitializeAccount(input: InitializeAccountParams): Either[String, Vector[Event]] = {
    val state = input.state
    val p = input.command
    val hosts = input.hosts
    if (!((p.resource == state.id))) return Left("ACCOUNT_ID")
    if (!(((p.currency == "CNY") && ((p.amount).currency == p.currency)))) return Left("ACCOUNT_CURRENCY")
    if (!((!(state.initialized) || ((state.accountBalance).get(p.currency)).contains(p.amount)))) return Left("ACCOUNT_INIT_CONFLICT")
    if (!(!(state.initialized))) return Right(Vector.empty)
    if (!(((p.amount).amount >= BigDecimal("0.00")))) return Left("ACCOUNT_SEED_NONNEGATIVE")
    Right(CreditBalanceCommandHelpers.emitInitializeAccount(state, p, hosts))
  }
  def ReserveFunds(input: ReserveFundsParams): Either[String, Vector[Event]] = {
    val state = input.state
    val p = input.command
    val hosts = input.hosts
    if (!((state.initialized && (p.resource == state.id)))) return Left("LEDGER_RESOURCE")
    if (!(((p.amount).currency == "CNY"))) return Left("LEDGER_CNY")
    if (!(((p.amount).amount > BigDecimal("0.00")))) return Left("LEDGER_POSITIVE")
    if (!((!((state.committedOutgoing).contains(p.txid)) || { require(((state.committedOutgoing)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.committedOutgoing)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_COMMITTEDOUTGOING_MATCH")
    if (!((!((state.compensatedOutgoing).contains(p.txid)) || { require(((state.compensatedOutgoing)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.compensatedOutgoing)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_COMPENSATEDOUTGOING_MATCH")
    if (!((!((state.reservedAmount).contains(p.txid)) || { require(((state.reservedAmount)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.reservedAmount)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_RESERVEDAMOUNT_MATCH")
    if (!(!((state.committedOutgoing).contains(p.txid)))) return Right(Vector.empty)
    if (!(!((state.compensatedOutgoing).contains(p.txid)))) return Right(Vector.empty)
    if (!(!((state.reservedAmount).contains(p.txid)))) return Right(Vector.empty)
    if (!((state.accountBalance).get((p.amount).currency).exists(_.compareSameUnit(p.amount) >= 0))) return Left("LEDGER_SUFFICIENT")
    Right(CreditBalanceCommandHelpers.emitReserveFunds(state, p, hosts))
  }
  def DeductFunds(input: DeductFundsParams): Either[String, Vector[Event]] = {
    val state = input.state
    val p = input.command
    val hosts = input.hosts
    if (!((state.initialized && (p.resource == state.id)))) return Left("LEDGER_RESOURCE")
    if (!(((p.amount).currency == "CNY"))) return Left("LEDGER_CNY")
    if (!(((p.amount).amount > BigDecimal("0.00")))) return Left("LEDGER_POSITIVE")
    if (!((!((state.committedOutgoing).contains(p.txid)) || { require(((state.committedOutgoing)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.committedOutgoing)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_COMMITTEDOUTGOING_MATCH")
    if (!(!((state.committedOutgoing).contains(p.txid)))) return Right(Vector.empty)
    if (!(!((state.compensatedOutgoing).contains(p.txid)))) return Left("LEDGER_NOT_COMPENSATED")
    if (!((state.reservedAmount).contains(p.txid))) return Left("LEDGER_PREPARED")
    if (!((!((state.reservedAmount).contains(p.txid)) || { require(((state.reservedAmount)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.reservedAmount)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_RESERVEDAMOUNT_MATCH")
    Right(CreditBalanceCommandHelpers.emitDeductFunds(state, p, hosts))
  }
  def ReleaseReservedFunds(input: ReleaseReservedFundsParams): Either[String, Vector[Event]] = {
    val state = input.state
    val p = input.command
    val hosts = input.hosts
    if (!((state.initialized && (p.resource == state.id)))) return Left("LEDGER_RESOURCE")
    if (!(((p.amount).currency == "CNY"))) return Left("LEDGER_CNY")
    if (!(((p.amount).amount > BigDecimal("0.00")))) return Left("LEDGER_POSITIVE")
    if (!((!((state.compensatedOutgoing).contains(p.txid)) || { require(((state.compensatedOutgoing)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.compensatedOutgoing)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_COMPENSATEDOUTGOING_MATCH")
    if (!(!((state.compensatedOutgoing).contains(p.txid)))) return Right(Vector.empty)
    if (!(!((state.committedOutgoing).contains(p.txid)))) return Left("LEDGER_NOT_COMMITTED")
    if (!((!((state.reservedAmount).contains(p.txid)) || { require(((state.reservedAmount)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.reservedAmount)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_RESERVEDAMOUNT_MATCH")
    Right(CreditBalanceCommandHelpers.emitReleaseReservedFunds(state, p, hosts))
  }
  def RecordIncomingCredits(input: RecordIncomingCreditsParams): Either[String, Vector[Event]] = {
    val state = input.state
    val p = input.command
    val hosts = input.hosts
    if (!((state.initialized && (p.resource == state.id)))) return Left("LEDGER_RESOURCE")
    if (!(((p.amount).currency == "CNY"))) return Left("LEDGER_CNY")
    if (!(((p.amount).amount > BigDecimal("0.00")))) return Left("LEDGER_POSITIVE")
    if (!((!((state.committedIncoming).contains(p.txid)) || { require(((state.committedIncoming)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.committedIncoming)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_COMMITTEDINCOMING_MATCH")
    if (!((!((state.compensatedIncoming).contains(p.txid)) || { require(((state.compensatedIncoming)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.compensatedIncoming)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_COMPENSATEDINCOMING_MATCH")
    if (!((!((state.incomingCredits).contains(p.txid)) || { require(((state.incomingCredits)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.incomingCredits)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_INCOMINGCREDITS_MATCH")
    if (!(!((state.committedIncoming).contains(p.txid)))) return Right(Vector.empty)
    if (!(!((state.compensatedIncoming).contains(p.txid)))) return Right(Vector.empty)
    if (!(!((state.incomingCredits).contains(p.txid)))) return Right(Vector.empty)
    Right(CreditBalanceCommandHelpers.emitRecordIncomingCredits(state, p, hosts))
  }
  def CommitIncomingCredits(input: CommitIncomingCreditsParams): Either[String, Vector[Event]] = {
    val state = input.state
    val p = input.command
    val hosts = input.hosts
    if (!((state.initialized && (p.resource == state.id)))) return Left("LEDGER_RESOURCE")
    if (!(((p.amount).currency == "CNY"))) return Left("LEDGER_CNY")
    if (!(((p.amount).amount > BigDecimal("0.00")))) return Left("LEDGER_POSITIVE")
    if (!((!((state.committedIncoming).contains(p.txid)) || { require(((state.committedIncoming)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.committedIncoming)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_COMMITTEDINCOMING_MATCH")
    if (!(!((state.committedIncoming).contains(p.txid)))) return Right(Vector.empty)
    if (!(!((state.compensatedIncoming).contains(p.txid)))) return Left("LEDGER_NOT_COMPENSATED")
    if (!((state.incomingCredits).contains(p.txid))) return Left("LEDGER_PREPARED")
    if (!((!((state.incomingCredits).contains(p.txid)) || { require(((state.incomingCredits)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.incomingCredits)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_INCOMINGCREDITS_MATCH")
    Right(CreditBalanceCommandHelpers.emitCommitIncomingCredits(state, p, hosts))
  }
  def CancelIncomingCredit(input: CancelIncomingCreditParams): Either[String, Vector[Event]] = {
    val state = input.state
    val p = input.command
    val hosts = input.hosts
    if (!((state.initialized && (p.resource == state.id)))) return Left("LEDGER_RESOURCE")
    if (!(((p.amount).currency == "CNY"))) return Left("LEDGER_CNY")
    if (!(((p.amount).amount > BigDecimal("0.00")))) return Left("LEDGER_POSITIVE")
    if (!((!((state.compensatedIncoming).contains(p.txid)) || { require(((state.compensatedIncoming)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.compensatedIncoming)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_COMPENSATEDINCOMING_MATCH")
    if (!(!((state.compensatedIncoming).contains(p.txid)))) return Right(Vector.empty)
    if (!(!((state.committedIncoming).contains(p.txid)))) return Left("LEDGER_NOT_COMMITTED")
    if (!((!((state.incomingCredits).contains(p.txid)) || { require(((state.incomingCredits)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.incomingCredits)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_INCOMINGCREDITS_MATCH")
    Right(CreditBalanceCommandHelpers.emitCancelIncomingCredit(state, p, hosts))
  }
}
```

[M]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/AggregateRulesModel.scala#L1-L31
[B]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateRulesBuilder.scala#L1-L155
[T]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateRulesTemplate.scala#L1-L78
[J]: ../baseline/js/generators/scala-cqrs-domain/render-domain.mjs#L1-L133
[E]: ../baseline/js/generators/scala-cqrs-domain/render-expressions.mjs#L1-L115
[L]: ../baseline/js/generators/invariant-dsl/render.mjs#L1-L1459
[FB]: ../baseline/js/generators/scala-cqrs-aggregate-core-v1/build-models.mjs#L1-L248
[FT]: ../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/rules.mjs#L1-L26
[A]: ../baseline/actual-js/app/example/bankwealth/domain/invariant/CreditBalanceRules.scala#L1-L105
[AP]: ../baseline/actual-js/app/example/bankwealth/domain/invariant/params/CreditBalanceRuleParams.scala#L1-L14
[AW]: ../baseline/actual-js/app/example/bankwealth/domain/CreditBalanceRules.scala#L1-L21
[C]: ../baseline/curated-scala/net/imadz/FabSplitMergeDesign/domain/invariant/LotRules.scala#L1-L121
