# Codegen parity 公共接缝接口裁定

状态：**文档级收口；未实施、未获实施授权、未执行运行验收。** 本文与 [机器表](details/interface-decisions.json) 同属新文档，不修改 SHARED-SEAMS、其他 diff 或任何公共业务 schema。所有 pseudotype 仅供实现者讨论，不是可执行 JS、注册产品、现有公开 API 或已经生成的 expected。

## 本轮用户边界与主agent分工 U1

来源身份：以下区分用户原话与主agent工作分派；后者不冒充用户逐字授权，也不限制主agent在已批准范围内协调后续文档勘误。

> 用户：“下一阶段是同输入fixture/expected/接口裁定，仍不修改生成器。”
> 用户：“common package以已发布最新common-core为主（用户裁定），实施前实际锁定制品字节。”
> 用户：“3个退休外部源码槽继续blocked，不用B桶兜底；不重跑银行workshop/38，不提交推送。”
> 主agent分工（非用户原话）：本稿初次编写只新建 `INTERFACE-DECISIONS.md` 与 `details/interface-decisions.json`；不改生产源码、不自行再派代理；后续勘误由集成者协调。
> 主agent设计建议（非用户已批）：新classic先以single作为候选，multi单列；pseudotype只是文档，不新增公开API。common-core最新未完成进展见[消费交接](COMMON-CORE-CONSUMPTION-HANDOFF.md)。

## 来源与状态读法

以下编号的准确文件、读到的行段、SHA-256、原仓身份见机器表 `sources`。固定源码不等于当下工作副本，更不等于发布 JAR；既有文档是规格依据，不升级为源码/运行证据。

| 编号 | 来源身份与精确入口 |
|---|---|
| S1 | 固定 BC 源码：[TypeSystem.scala L4–85](baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4)；含 TypeRef 与 FieldDef |
| S2 | 固定 BC 源码：[ArtifactModel.scala L5–47](baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L5) |
| S3 | 固定 JS 源码：[naming.mjs L26–118](baseline/js/lib/scala-target/naming.mjs#L26) |
| S4 | 固定 JS 源码：[profiles.mjs L4–33](baseline/js/lib/scala-target/profiles.mjs#L4) |
| S5 | 固定 JS 源码：[model.mjs L9–33、46–61、99–148、151–213](baseline/js/lib/scala-target/model.mjs#L9) |
| S6 | 固定 JS 源码：[product-plan.mjs L8–57、70–103](baseline/js/src/core/product-plan.mjs#L8) |
| S7 | 固定 JS 源码：[generate.mjs L89–104、115–131、134–268](baseline/js/src/core/generate.mjs#L89) |
| S8 | 补充固定 JS 源码：[code-mappings.mjs L1–28](supplemental/js/src/core/code-mappings.mjs#L1)；身份来自 [supplemental/index.json L8–16](supplemental/index.json#L8)，不是原 baseline 成员 |
| D1 | 已有文档规格：[SHARED-SEAMS.md L21–152](SHARED-SEAMS.md#L21) |
| D2 | 用户质量约束与执行规格：[layout-and-style.md L14–83、94–113、150–172](layout-and-style.md#L14) |
| D3 | fixture 准入规格：[FIXTURE-AND-EXPECTED-CONTRACT.md L7–50、54–80、84–115](FIXTURE-AND-EXPECTED-CONTRACT.md#L7) |
| D4 | 文档编制授权：[AUTHORING-CONTRACT.md L3–11、20–48、73](AUTHORING-CONTRACT.md#L3) |
| D5 | 拟实施所有权文档：[ASSIGNMENT-MAP.md L9–35](ASSIGNMENT-MAP.md#L9)；不继承其中可能过时的缺稿计数 |
| D6 | 分区阻断规格：[js-partition.md L84–100](js-partition.md#L84) |
| D7 | 所有权修正提案及中央采纳的逐construct合同：[target-ownership-resolutions.md L5–7、16–20、49–59、70–85、94–118](details/target-ownership-resolutions.md#L5)；已采纳归属不等已经实施拆分 |
| D8 | 用户转述的未完成演进建议：[COMMON-CORE-CONSUMPTION-HANDOFF.md L1–46](COMMON-CORE-CONSUMPTION-HANDOFF.md#L1)；不是发布、制品字节或新API通过证据 |

`user-required` 是用户边界；`source-fact` 只说明固定源码实际接口；`integrator-proposed` 是本文选定的可讨论方案，仍待集成者/用户审定；`blocked-supply-or-semantics` 保持阻断。每项 admission check 都是**未来准入证据的具体定义，当前未执行**，不是新增测试任务或已经存在的自动门。普通方法 CC 全部 `not-measured`，工具/版本/口径未固定（D2 L150–164）。

## IF-00 — 写集合与供应边界

- **状态：user-required（docs-only边界）＋主agent分工（本稿初次写集合）。** 依据 U1、D4 L3–11、D5 L21–35。
- **合同：** 本稿作者初次只新建本文和机器表；不运行 generate/validate/roundtrip/编译/测试/typecheck/服务/下载/发布，不再自行调用子 agent/Workflow/任务工具，不做 Git/worktree 操作；不修改作者树、生成器、catalog、生成应用、`.truthsrc`、ledger、anchors、银行、基线或旧 15 稿。不补拷外部源码。主agent后续可在原docs-only授权内分工纠错；不把本稿作者的单次写集合反过来当用户对整个会话的新限制。
- **受影响/owner：** 全部 A/B 内容规格；本稿文档由指定作者与集成者协调维护。未来公共源码接缝由 `main-integrator` 协调，逐输出assemblyOwner不因此替换；common-core 演进由 `common-core-post-validation` 负责。
- **不变量：** 文档完成不等于实施批准、同输入通过、成员回锚通过或 expected 已生成；peer 正占用文件就停止，不覆盖。
- **Admission check：** 初次写前两路径均不存在；后续勘误先核已分配owner和字节。静态核对文档写集合、JSON、引用行段和来源指纹；该检查只能支持文档一致性，不能改变任何运行状态。

## IF-01 — 现有 API 的精确边界

- **状态：source-fact。** 依据 S1 L4–51、76–85；S2 L5–47；S3 L41–118；S4 L4–33；S5 L56–61、210–213；S6 L70–103；S8 L8–28。
- **合同：** 以下是固定源码中的签名；返回形状的说明不是新增 export。

```text
Scala:
TypeRef(name: String, packageName: String, typeParams: Seq[TypeRef] = Nil)
  fqn: String; signature: String
  collectAllDependencies: Set[TypeRef]
  shouldImport(currentPackage: String): Boolean
FieldDef(name: String, typeRef: TypeRef,
  defaultValue: Option[String] = None, comment: Option[String] = None,
  noteId: Option[String] = None, description: String = "")
ArtifactModel:
  selfType: TypeRef; dependencies: Set[TypeRef]
  fqn: String; registerTo(registry: ArtifactRegistry): ArtifactRegistry
  morphisms: Seq[net.imadz.meta.MappingMorphism] = Nil
  noteIds: Seq[String] = Nil

JS（对象成员及参数名按源码）:
resolveName({profile, knowledgeId, scope, space, spelling, binding, prefix, suffix})
  → 输入成员 + profile(id), name, identifier
resolveNameSet({profile, names, reserved}) → 按输入顺序的 resolved names
  names 每项不带 profile；reserved 每项为 {scope, space, name, reason}
resolveArtifactPath({profile, module, packageName, typeName}) → 相对 Scala 路径
  module 是 profile 内的 module.id，不是 module 对象
 targetProfile(id) → 已注册 profile
buildTargetModel(raw) → candidate target model
  raw 的顶层键为 schemaVersion/profile/contexts/values/ports/components/bindings
planProductSet({compilation, manifest: rawManifest, options = {}}, producerRegistry)
  → {plan, diagnostics}；失败可为 plan=null
validateCodeMappings(entry) → entry.codeMappings 或 []
finalMappingSpan(mapping, generated, finalBytes) → {start,end,text} 或 null
```

- **差异不能抹平：** S1 的 `packageName` 是单个字符串，无独立 nested-owner 字段；tuple 根据名字前缀/数字及非空参数推断。S2 的 `fqn` 直接拼 `packageName + "." + name`，与 S1 的空包名处理不同。这里仅记录实现差异，不推断某个产物已出错。S5 只接收 `MODULAR_CANDIDATE`，不是可直接承载 classic 的通用 MBT 模型。S4 的两个 profile 均 `approval: null`。
- **受影响/owner：** 全部 Scala 类型制品及 plan/mapping 消费方；`main-integrator` 维护复用边界，单制品 owner 不能扩展同名公共函数。
- **不变量：** IF-02 以后新增的文档记录不得冒充上述 API 输入，也不得直接塞进 `truthsrc.scala-target-model/v1`。
- **Admission check：** 对拟实施调用表逐项核对实际参数键、profile 限制、返回形状和来源版本；出现本文未列的新 export 必须另行明确实施变更，不以本文假定存在。

## IF-02 — TypeRef / FieldDef / Model 最小记录

- **状态：integrator-proposed。** 依据 S1 L4–51、76–85，S2 L9–47，D1 L52–64，D2 L77–83、166–172。这是对接记录，不是新的通用编译框架。
- **合同：** 以下 pseudotype 是各族 Builder→Model→文件 assembler 的最小交接面。族专有字段继续由该族固定 Model/diff 定义，不用 `content` 或任意键袋替代。

| 文档记录 | 字段、类型与缺省/约束 |
|---|---|
| `TypeRefDoc` | `form: named | tuple | parameter`；显式分支，不从 `name.startsWith("Tuple")` 猜目标语义 |
| named 分支 | `identity: 既有名义引用或明确技术符号身份`；`name: 已解析、不含反引号的完整类型名`；`packageName: 真实包名`；`owners: 有序实际容器名[]`；`typeParams: TypeRefDoc[]`；`definition: generated(logicalOutputId,declarationKey) | supplied(fqn,supplyRef) | builtin`。只有 owners/typeParams 可默认空数组 |
| tuple 分支 | `elements: 有序 TypeRefDoc[]`，首轮拟限 2–22 项；没有新的名义 identity/定义/FQN。1 项 tuple、不匹配 arity 不改写为另一类型 |
| parameter 分支 | `name: 已解析类型参数名`、`declaringScope: 该参数实际声明位置`；无 package/import/名义类型定义。上下界在声明它的族模型保留，参与依赖收集 |
| `FieldDefDoc` | `fieldKey: 原字段身份或 scoped synthetic-role`；`name: 已解析成员名`；`typeRef: TypeRefDoc`；`defaultValue: absent | structured(existingExpression,evidenceRef) | raw-reference(file,lines,sha256)`，缺省 absent；`comment: Optional[String]=None`；`noteId: Optional[既有知识ID]=None`；`description: String=""`；`source: 来源定位或明确 synthetic reason` |
| `ArtifactModelDoc<FamilyPayload>` | `artifactId`、`logicalOutputId`、`variantId`、`selfType: named TypeRefDoc`、`dependencies: 完整 TypeRefDoc 引用集合`、`fields: 按原构造顺序的 FieldDefDoc[]`、`nestedDeclarations: 有序实际嵌套模型/声明引用[]`、`morphisms: 原有映射记录[]`、`noteIds: 既有知识ID[]`、`familyPayload: 本族已列字段`。fields/nestedDeclarations/morphisms/noteIds 无内容时为空；不得为适配记录虚构业务字段 |

**派生而非第二真源：** named 的 FQN = 非空真实包 + owners + name；`signature` 在 IF-04 文件作用域中派生；依赖先递归展开类型参数、tuple、上下界等，再作导入决策。`Map[K,V]`/`Option[T]` 仍是有序参数化类型；同形 String carrier 不合并 identity。文档类型只覆盖上述普通接缝；存在本族额外类型形态时保留它的固定模型合同，不能降成任意源码字符串。

`defaultValue=absent` 不等于 Scala 表达式 `None`，也不等于 `null`；optional 性质由 typeRef 表达，不从有无默认值推断。raw-reference 仅保存原 Scala 槽的证据，**不是新产品允许任意源码的入口**：目标执行前须转换成已有结构表达或 IF-07 的明确实现；做不到就阻断该槽。`noteId=None` 可描述无独立知识来源的技术字段，不伪造 ID；文件知识归属从实际输入传播，不凭源码名反查。非类型文件（routes/config/build）不强装 selfType，直接走其族模型和 IF-05。

- **受影响/owner：** value-object、domain-entity、event-handler、invariant-rule、application-protocol、command-helper、各 service/repository/connector/proto/converter 及其嵌套类型；记录语义 owner=`main-integrator`，族字段 owner=各 artifact owner。
- **不变量：** 字段顺序、名义身份、缺省值与未完成槽可区分；Entity 直接拥有的 Event 不登记到虚构 EventFamily；Model/Builder 不写 ledger/anchors。
- **Admission check：** 用 D3 L28–38 的 F1 字段逐项填表；保留 raw 与人工回复差异。另以 D3 L57–62 的四名义 carrier、重复简名、nested Event、tuple 顺序、absent/`None` 两种默认逐项核对所有权与渲染预期；此处仅定义覆盖，不声称已有可执行 fixture。

## IF-03 — 名称与稳定身份

- **状态：user-required。** 依据 D2 L68–75；机制事实来自 S3 L41–74、83–118，S4 L12–26。
- **合同：** 类型/文件 PascalCase，成员 lowerCamelCase。使用 IF-01 的现有 resolver，Builder 提交完整 spelling/角色请求，Template 不自行 slug/replaceAll/拼后缀。明确 binding 是完整名字，prefix/suffix 必须为空。`BankService` 再加 `Service` 的当前结果是拒绝，不是自动去重；可用完整 `BankService` binding，不发明各模板的裁剪规则。
- **稳定空间：** knowledge/sql/protobuf/wire/persistence/operation/codec 不接受 binding/affix 改名；knowledge 的 spelling 与 knowledgeId 一致。源码名的变更不得反推或改变 PID、serializer manifest、operation ID、字段号和业务身份。关键字通过返回的 `identifier` 渲染；不支持的自动词法需要显式绑定。
- **受影响/owner：** 所有 A/B 中产生符号、文件或引用的输出；`main-integrator` 拥有命名/保留名汇总，各族提供业务 spelling 和真实作用域。
- **不变量：** 源码名与稳定身份两条链分离；类型/包的 NFC+大小写碰撞、成员作用域碰撞及实际文件碰撞都不靠覆盖解决。
- **Admission check：** 为完整文件名称集合保存 resolver 输入/结果对照；检查 repeated suffix、keyword、两个仅大小写不同的类型和显式 binding；再逐字比对稳定身份清单。只改源码名的案例不得导致该清单变化。

## IF-04 — 注册、nested owner 与 imports 的确定路线

- **状态：integrator-proposed。** 依据 S1 L31–51，S2 L18–21，D1 L54–62，D2 L77–83。
- **合同：** 先登记实际声明，再收齐依赖，再作文件级 imports；依赖集合不因同包、builtin 或最终使用 FQN 而删减。类型/term companion 只按该族真实声明对处理，不能通过反复注册覆盖消解冲突。
- **规则顺序：**
  1. `definition.generated` 唯一定位实际容器与落盘 owner；`supplied` 保持供应方准确 FQN，不按本项目 naming 改造。unknown owner 不猜。
  2. 收集字段、父类型/父构造实参、方法所有参数列表及返回值、上下界、annotation、self-type、结构 RHS 中的类型/符号引用。字符串 grep 不承担依赖发现。
  3. 无歧义 top-level 类型使用简名；外部包显式导入。同包、scala 根、java.lang、不需导入的 builtin 不发 import，但仍保留依赖。
  4. nested 类型的**身份登记**保留完整真实 owners，但源码呈现不强制保留 `Owner.` 前缀。A先遵守该族目标/用户示例：无冲突时显式导入真实嵌套成员并使用简名，例如 `import net.imadz.domain.entities.CreditBalanceEntity.CreditBalanceState` 后用 `CreditBalanceState`；用户指定的正常事件import同理。若该族目标明确要求Owner限定，或有实际名字冲突，再保留 `Owner.NestedType`／必要FQN；不能把完整owner元数据误当到处限定名的格式要求。
  5. 首轮**不新增自动 alias 命名器**：短名/owner 与本地声明冲突时，仅冲突的引用保留准确 FQN（必要时根限定）；已在该族 diff 明定的 alias 原样保留。其余引用仍用简名。不能解析的嵌套/path-dependent 形态阻断相关引用，不撒通配 import。
  6. A 按其目标 diff 的 import 分组/声明顺序；B 为 Scala/JDK、外部框架、项目依赖，组内确定排序去重。默认值/RHS 的依赖与签名相同待遇。
- **受影响/owner：** IF-02 全部类型制品，以及多逻辑族共文件、proto/converter 的准确符号登记；`main-integrator` 拥有文件作用域决议，各族提供引用事实。
- **不变量：** 一个实际声明只有一个 owner；名义类型不因同形合并；有限 FQN 只为歧义，不能成为全部输出的默认拼写。
- **Admission check：** 给定两包同名类型、同包类型、跨容器 Event、泛型中的 nested 类型与一个方法 RHS 依赖，产出“全部依赖→声明位置→源码拼写→import 行”四列表；验证没有虚构 companion、漏掉参数依赖或重复 import。这是所需具体产物，不是已运行检查。

## IF-05 — 完整 file assembler 唯一 owner

- **状态：integrator-proposed。** 依据 S5 L202–213，S6 L8、34–57、86–99，D1 L91–116，D5 L9–23，D7 L5–7、16–20、94–118。
- **合同：** 一个 canonical output path 对应一个中央分区登记的 `target.assemblyOwner`；族 owner 交结构贡献，不交可独立 apply 的文件片段。`main-integrator` 是共享**源文件写权/接线协调者**，不是把所有输出的逻辑assemblyOwner一律改成同名。独立新MBT实现仍按assignment-map分组，完整文件只有一次组装和一个entry；assembler是角色名称，不声称新增export。

```text
文档级匿名交接签名（不新增公开函数）:
FileAssemblyInput → Either[带来源的阻断说明[], PlannedEntry]

FileAssemblyInput = {
  path: canonical relative path,
  profileSelection: 已明确的 profile/variant 及物理根,
  producer: 现有 manifest 中的准确 id/version/声明,
  kind: 该 producer 已声明的一个 artifact kind,
  packageName: Scala 文件的真实包（非 Scala 文件按族合同）, 
  contributors: ordered [{logicalOutputId, constructKey, declarationOwner,
                          model, sourceEvidence}],
  declarationOrder: 该完整文件的显式 construct 顺序,
  importDecisions: IF-04 的完整文件决议,
  generatedDependencyPaths: 同一完整 plan 实际生成的路径[],
  knowledgeIds: 真实输入的非空唯一 ID[],
  mappingIntents: [{knowledgeKey, constructKey, scopeKey}],
  layoutContract: 目标 diff 与有限覆盖的定位
}
PlannedEntry = {
  path, content, kind, deps, knowledgeIds, productFootprint, merge,
  optional codeMappings
}
```

这是**新拟定的输入交接 + 现有 entry 出口**。入口记录不序列化到公共产品 schema；出口不能夹带 owner/model/sourceEvidence 等私有键。`deps` 仅为同 plan 生成路径，不能塞 JAR FQN 或外置实现文件来假满足完整依赖；这些仍在模型/供应合同中。`productFootprint` 是 producer 声明产品的完整有序 id/version，不是只列当前贡献者碰巧用到的产品；`merge=null`。`content` 必须是 package/import/全部声明/RHS/结尾均已排版的完整文件，不得含 `???`。同一路径不能由两个 producer 各发一次；S6 会拒绝它们。

**实际分配规则：** 每个 constructKey 在一个文件的一个词法声明 owner 下出现一次；引用另一个方法不等于拥有该方法声明。imports、注解、companion、初始化和生命周期也在贡献表中，不作为“最后随便补”的余项。已有 D7 的 Projection 单资源 owner、DomainConverters/条件 Parts 原 owner 不在本轮拆分；A/B 共处一文件不改变各自内容分类。D7 的 Play 可见性/接线仍只是提案，不借本文凭空公开 private 方法。

- **受影响/owner：** 全部共享物理文件；重点 formal-domain converters、formal-service journal source/handler、service/Play composition，以及 protocol/helper 等重布局输出。逐输出的逻辑assemblyOwner沿用中央分区；既有热点的源写权及集成接线为 `main-integrator`，新族 Model/Builder/Template 按明确分组独占。
- **不变量：** 所有 RHS 都有声明 owner；一个 path 一个 entry；同文件知识映射可多对一而不丢来源；不让生成器重写手写实现。
- **Admission check：** 对一个 A/B 共文件给出完整 contributors、顺序、依赖与 mappingIntents 表；逐 construct 覆盖 package 到最后一行，任何“双方各写同一个方法”或没有 owner 的初始化均不准入。完整 plan 的路径/producer/footprint 检查沿用 S6，不新造 writer。

## IF-06 — 结构表达式 purity 与 evaluation order

- **状态：integrator-proposed。** 依据 D1 L76–89，D2 L94–113；S5 L137–142、163–165 只证明其模型有 pure/future 和纯依赖约束，**不证明具体方法体已被验证为纯**。
- **合同：** 使用既有各族结构表达式与有限 renderer，不发明公共 expression schema。每次拟改写附审阅记录 `(原节点来源, 结果类型, 读取的值快照, 求值次数/顺序, 短路边界, 可能异常)`；记录属于文档/派生分析，不写入作者树。
- **确定规则：**
  - 将节点区分为 `pure-total`、`pure-may-fail`、`effectful-or-unknown` 的**审阅结论**。pure 不等于不抛错；求值次数、异常先后、短路均是可观察合同。
  - `!(!p)` 只对已知 Boolean、相同一次求值且无未知重载的 p 按结构化节点化简；不对最终源码 regex。未知节点原样保序，不跨边界重排；纯 domain 要求无法证明时阻断该 body。
  - 运算符按结构优先级/结合性加括号；`&&`/`||` 保持左到右短路，不能把 RHS 提前成 val；参数列表/curried 调用也不能重排为名字排序。
  - state.copy 的各 RHS 读取原合同的旧 state；输出具名实参时保留原 RHS 求值顺序，而非为了字段排版排序。如果原来某结果被复用/跨字段依赖，保留业务名局部 val 与原依赖顺序，不机械内联、复制求值或逐字段链式更新 state。
  - Long/decimal 从准确字符串与类型渲染，不经过 JS Number；保留边界负号、精度/舍入、名义类型和 `addExact` 的溢出语义。不凭减少临时变量/CC 改算术。
- **受影响/owner：** event-handler、invariant-rule、domain-service、command-helper、aggregate-behavior 及相关 B 决定体；公共 renderer 由 `main-integrator` 管，领域/业务 owner 给算法与独立 oracle。
- **不变量：** 值结果、事件顺序、异常顺序、求值次数与副作用位置不因风格变换改变；ActorRef/I/O/隐式时间不进入纯领域决定。
- **Admission check：** 针对 D3 L70–72 覆盖 `false && mayFail`、`true || mayFail`、两个可能失败的 RHS、共享一次求值的 put-all、旧 state 跨字段读取、Long 边界和溢出；逐例列原/目标求值轨迹及独立 oracle。没有这些轨迹时只准保持原语义，不宣称简化已通过。CC 仍未测。

## IF-07 — 手写实现槽只选一个 body owner

- **状态：integrator-proposed。** 依据 D1 L145–150，D2 L85–98、166–172，D3 L28–38、104–115，S5 L182–195，S6 L52–54。
- **合同：** 新 classic 未完成算法优先选择**外置手写实现**，模板只生成已明确的声明与显式接线，不把 raw `???`、MANUAL 空槽或 fake success 当算法。该选择是提案，不自动启用任何产品能力。已经存在的 MANUAL 兼容区保持其 owner/字节规则，不扩张成第二个算法定义面。

```text
文档级 MethodSlot = {
  slotKey: (logicalOutputId, 稳定成员身份),
  declarationOwner: 一个 artifact owner,
  implementationOwner: 一个业务/适配实现 owner,
  container: 实际声明容器引用,
  signature: {
    name: 已解析成员名,
    typeParameters: ordered [{name, lowerBound?, upperBound?}],
    parameterLists: ordered [{mode: explicit | implicit, parameters: FieldDefDoc[]}],
    resultType: TypeRefDoc
  },
  effectContract: 既有 port 的效果合同及 purity 依据,
  failureAndOrder: 拒绝/异常/事件或副作用先后合同,
  binding: 一个明确的外置实现身份/FQN及来源定位，未供应则 blocked,
  constructorLists: 按真实实现提供的依赖与 explicit/implicit 列表,
  oracleSource: 独立用例/BDD 的准确来源，未供应则 blocked
}
签名呈现 = def <name>[<已给的类型参数及上下界>]
                 (<第一组原参数>)(<后续组或 implicit 参数>): <实际 resultType>
```

不得把 curried/implicit 列表压平；by-name/vararg 等本族已有修饰必须在族签名合同保留，缺语义时不能伪装普通字段。当前 S5 port method 只定义单 `parameters` 与 `result(effect,valueType)`，因此上述多列表记录**不是可直接传给 buildTargetModel 的现有 schema**。若现有公开产品不能表达所需实现 capture/接线，相关包保持 blocked，由公共 owner 后续在授权内接入，不从本文生成新方法名。

**single owner 含义：** 声明 owner 与实现 owner 可以不同，但一个 slotKey 在选定 variant 下只绑定一个 body；根装配仅引用该实现，不另造默认实现。实现及其独立 BDD/oracle 属手写隔离面。raw F1 的类型级 ReplyMappingConfig 不足以推出逐命令回复算法（D3 L30–38）；缺算法就填 blocked，不能统一构造 `Right(empty)` 或把人工余额回复推广到全部命令。需要 live implementation 的现有产品只能沿 D3 L104–107 所述 project 路线讨论，不绕到 raw products 入口。

- **受影响/owner：** domain-service、application-service、query-service、external-connector-port、connector-implementation、invariant-rule/event-handler 的未完成 body；declaration owner=对应族，body/BDD owner=业务实施方，binding/装配 owner=`main-integrator`。
- **不变量：** 一槽一实现；实现源不被生成覆盖；公共声明没有 fake success；pure port 不靠注入隐式 I/O 实现。
- **Admission check：** 每个实际 slot 交完整 MethodSlot，并静态比对声明/实现的类型、所有参数列表、结果、构造依赖；两个绑定或零绑定均不能标就绪。逐方法用例与独立 oracle 必须有来源；F1 缺失的回复算法和实际供应未齐前，只能完成记录，不能开始该包运行。

## IF-08 — final-byte 映射与降级不冒充成员成功

- **状态：integrator-proposed。** 依据 S8 L3–28，S7 L91–104、183–215、243–267，D1 L118–132，D2 L166–172。
- **源码事实：** `codeMappings` 每项仅接受 knowledgeKey/span/scope，span 与 scope 均 `{start,end,text}`，UTF-8 字节区间为 start inclusive/end exclusive，end 必须大于 start；span 在 scope 内，knowledgeKey 属于 entry.knowledgeIds。同 key/start/end 重复拒绝。MANUAL 后 scope 文本必须在 finalBytes 唯一且相对文本仍精确相等，才能重定位；否则返回 null。现有 anchorInputs 对某知识 key 没有剩余 span 时只产生文件位置。
- **目标合同：** IF-05 完成命名/import/排版后，再从精确 content 计算映射；此后不得格式化。多作者→同成员保留每个已存在 knowledgeKey；同作者→多成员保留各自 span/scope。`morphisms` 不凭字段名机械变成 codeMappings，必须能定位到实际 construct 和已有作者 key。
- **降级裁定：** 保留现有 writer 行为，不新增不存在的返回字段；未来证据比对必须按**每个预期 mapping**逐一核 finalMappingSpan，不能只看该 key 是否还剩一个成功 span。一个 key 的两个成员只剩一个精确位置，也是局部丢失，不能冒称完整成员回锚通过。成员级包 admission 受阻；文件级 fallback 可作为诚实观察记录，不能补造旧 offset。
- **受影响/owner：** 所有多对一/拆文件的知识映射、MANUAL 合并文件及源码定位；最终内容及具体映射由中央逐输出 `target.assemblyOwner` 负责，族 owner 给 construct 来源；`main-integrator` 负责共享 writer/mapping 源实现的写权及集成协调，不取代逐输出 owner。
- **不变量：** 指纹对应最终字节；映射文本对应同一最终字节；UTF-8 byte 不混用 JS string index；不新增作者 `@knowledge` 字段。
- **Admission check：** 用非 ASCII 注释/字段说明、两个相同 scope 文本、一个被编辑 MANUAL scope、一 key 多成员逐项列 planned span→final span→exact/degraded；任一预期成员降级则该项不准入。两次实际同输入生成与局部变更定位仍是未来证据，当前均未执行。

## IF-09 — classic 保守 profile 路线

- **状态：integrator-proposed，不是用户已经批准默认切换。** 依据 U1，S4 L4–33，S5 L9–14、56–61、132–148、166–168，D1 L66–74、145–148，D2 L14–64，D3 L84–109。

| 选择 | 文档裁定 |
|---|---|
| 两个现有 profile | 保持准确 ID 与既有兼容语义，不原地改成 classic；legacy 的 domain Actor facade、candidate 的 `.composition`/root `src/main/scala` 不能标为符合新 classic |
| 新 classic single | **推荐未来新 classic 默认 single**：Scala 根 `app/`；应用协议 application.aggregates，纯 State/Events domain.entities，DI/装配 infrastructure.bootstrap；业务根仅三层。此名称是讨论标签，未分配/注册新 profile ID |
| 新 classic multi | 单列、显式 opt-in；Scala 根按 D2 的 `modules/<module>/src/main/scala/`，各模块名称/边/框架根由所选 fixture 的实际构建合同给出。没有该完整合同，不从 candidate 的 kernel/glue/ext/root 自动继承，也不把 single 输入偷偷搬成 multi |
| CLI/目标 | 使用既有 project 的 generator 选择合同；不发明 `--profile`。每次比较记录 generator/版本、profile、variant、全部物理根和新目标目录，不能只换 package 后称同输入 |

- **受影响/owner：** 所有路径、build/config/proto/routes/test 与 module 依赖；profile/入口 owner=`main-integrator`，各族只消费选择结果。
- **不变量：** 架构层与构建 sourceRoot 分离；顶层 controllers 是业务包外例外，不是第四层；两个旧 profile 不被静默重解释；multi 未明确前不扩大准入。
- **Admission check：** F1 同输入记录明确 single/multi，分别列 Scala/proto/conf/routes/build/test 完整路径集合；与 D3 L40–50 的 raw/curated/target/JS 四类资产分开对账。新 ID、注册和切换须另行批准；本文不提供虚构已可调用的 profile。

## IF-10 — old path 不等于 RETAINED 后自动退役

- **状态：integrator-proposed。** 依据 S7 L183–190、223–245，D1 L109–116，D2 L172，D5 L21–23，D7 L94–118。
- **合同：** 先以明确新 target 做候选比较；旧 target/银行/手写实现不动。重布局用以下文档行登记，不修改现有 ledger schema：

```text
RetirementRow = {
  oldPath, oldDeclarationOwner, oldFqnsAndMembers,
  newPathsAndDeclarations, affectedCallersAndRegistrations,
  oldOwnershipEvidence, oldFingerprintEvidence,
  stableIdentityDisposition: unchanged | separately-blocked,
  knowledgeMappingDisposition,
  disposition: retain-for-compatibility | candidate-replacement | approved-retirement,
  approvalEvidence
}
```

owner 在旧路径、引用方和新文件均有记录；空 newPaths 只有明确删除职责的批准才成立。新计划不含旧路径时，现有 owned apply 会报告 `RETAINED`，不是删除。新 target 没有旧文件也只说明候选干净，**不说明旧 target 已退役**。实现者不得发明 delete/retire CLI flag，不手改 ledger/anchors 或直接清 generated。实际退役的工具/批准窗口不在本文范围。

- **受影响/owner：** domain→application 协议、helper、DI、converter 等重布局的旧入口/调用方/注册，以及 shared output 的拆分；路径迁移协调 owner=`main-integrator`，旧输出/手写源码 owner 保留否决权。
- **不变量：** 持久化/wire/serializer 稳定身份不随 FQN 迁移隐式改变；兼容壳不是最终达标豁免；capture/recheck 不等于锁或跨文件回滚。
- **Admission check：** 候选计划无旧 owned 路径依赖；每个 oldPath 的调用方/注册/映射去向有实际证据，RETAINED 单列。需改变持久化源码名/manifest 的行在专门 ABI 裁定前保持 blocked。未获旧 owner 退役批准不得将 disposition 记为 approved-retirement。

## IF-11 — 三退休任意源码槽保持精确阻断

- **状态：blocked-supply-or-semantics。** 依据 U1、D6 L84–92。
- **合同：** `scala-cqrs-es-api/support-controller` 的任意 path/content；`scala-cqrs-es-projection/projection-handler` 的 supplied manualBlocks；`scala-cqrs-es-projection/projection-repository-impl` 的 implOverrides 整文件替换，三者均不能由模板或固定样本推出未知输入的完整内容。**不用 B/unknown 兜底，不主动复活入口。**
- **受影响/owner：** 上述三个逻辑输出；实际输入供应方拥有内容/语义，退休入口的集成 owner 才能组织后续分类；不阻断无关接口文档。
- **不变量：** “已导航到键”不等于“未知源码已审阅”，不宣称完整 A/B 总任务已通过。
- **Admission check：** 仅未来确有 fixture 消费时，由供应方给实际选中的完整 input/sidecar/override 字节及指纹、选择条件与逐 construct owner，再做分类和实现槽审定。本轮没有补拷授权，故维持 blocked。

## IF-12 — common-core 制品交接而非本线胶水设计

- **状态：blocked-supply-or-semantics（阻断实际供应，不重开用户此前给定的0.2源码身份）。** 依据 U1、D5 L28–29及[最新未完成通报](COMMON-CORE-CONSUMPTION-HANDOFF.md)。
- **合同：** 以已发布最新 common-core 为主；已知基准 `net.imadz:common-core_2.13:0.2` 不含 `withPost`，其参数名为 `rule`。用户转述 `common-core-post-validation` 正考虑下一版正式提供 post-validation/withPost、保留rule与publish且不照搬第五公开字段，**仍未完成，未提供新版本号/字节/最终API**。不得将0.2的限制说成永久禁止，也不提前调用下一版。业务postconditions、MoneyOps、auth分别按消费交接分账；本线不接管演进、调查JAR或发布。
- **受影响/owner：** 消费该库的 command-helper、aggregate-behavior、service/装配等；common-core 演进owner=`common-core-post-validation`，消费适配owner=`main-integrator`。新制品仍需对应供给方交接，不能把同FQN冲突源码与jar双供给。
- **不变量：** 固定源码快照不是已消费JAR证明；此前目录身份不保证并行演进后的live目录仍等于0.2；最新进展不是新版本已发布，本线不臆造签名/版本。
- **Admission check：** 等准确坐标、制品SHA/取得来源、可消费签名、post/persist/publish/reply顺序、case-class与旧overload兼容策略、唯一owner及同FQN排除结论；具体最小字段见消费交接。受影响包在实际供给锁定且另获实施授权前不得记为可运行，本文不代填发布或通过结论。

## 收口结果与剩余边界

本文选择了可执行的文档交接形状与确定处理路线：字段/名义身份和 owner 分离、完整文件唯一组装、冲突引用有限 FQN、保序表达式、单一手写 body、逐映射 final-byte 准入、classic single 的保守建议、old path 显式迁移记录。它们不是“以后统一”，也不是已经存在的统一 API。

仍需外部决定/供应的内容仅在相应包阻断：classic 新 profile 的批准/注册及 multi 实际构建合同；F1 逐命令回复/默认值/无损输入映射和各变体完整 expected；实际实现槽与独立 oracle；另线 common-core 冻结制品；三退休任意输入；旧路径具体迁移/ABI 与退役批准。D3 L40–50、111–115 明确这些资产尚未齐备；本文没有补齐、生成或验证它们。CC 全部未测。
