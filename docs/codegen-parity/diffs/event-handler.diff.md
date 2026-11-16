# event-handler：纯事件应用的内容级差异规格

## 1. 范围、证据等级与固定来源

- artifactId / group：`event-handler`；传统清单第 3 族。规格状态：**`decision-required`**。这是独立保存的文档规格，不是实现、编译、运行或行为通过的证明。
- JS 固定 HEAD：`bf104e16ab82ef39d7fa416d0997907d18a815ad`；BC 固定 HEAD：`cc335eb1e0d0fae17bf092fd61b126040196ea70`。实际字节身份以 [baseline/index.json](../baseline/index.json) 的 `source/snapshot/bytes/sha256` 为准；HEAD 不替代工作树字节。
- 权威计划：[APPROVED-PLAN.md](../../../.rounds/prettify-generated-code-resume-20261115-cgr9lzlk/APPROVED-PLAN.md)；作者合同：[AUTHORING-CONTRACT.md](../AUTHORING-CONTRACT.md)；用户覆盖：[layout-and-style.md](../layout-and-style.md)。只提取了 catalog 中 `id=event-handler` 的一行。
- 本次是源码内容检查。未执行测试、typecheck、编译、代码生成、runtime、服务、下载、图查询或 Git 写操作。没有修改真源树，因此不运行 validate/roundtrip；没有读取运行凭据、进程参数、环境、会话转写或 agent.output。
- 首次及写前检查两份分配文件均不存在。本轮写面仅本文及 `details/event-handler.json`，不改早先 15 份 diff、基线、生成应用或中央汇总。

### 1.1 四类证据不能混签

| 证据 | 本次可取得的内容 | 不能声称的事情 |
|---|---|---|
| `raw-scala` | 完整固定 Model / Builder / Template，下面逐构造还原生成规则 | **没有本次同输入的 raw Scala 完整生成文件**；不能把人工参考当 fresh output |
| `approved-target` | 用户批准的三层、纯 fold、正常依赖、无无意义 `nextN`，叠加传统模板结构 | Entity 名义类型搬迁、未匹配事件策略、代码槽接入尚有具体裁决，不能冒称最终 expected 已冻结 |
| `actual-js` | 银行现存 3 个核心 handler、旧路径转发壳和调用方的固定字节 | 不是对当前 renderer 新运行所得，也不是和 Scala 相同输入的字节对账 |
| `curated reference` | 人工完成的 `net.imadz` CreditBalance handler | 事件集合、Money、Currency 与银行例不同；不得把其算法当银行默认规则 |

以下对照一律是**结构性对照，非同输入字节比较**。展示完整银行实例的表达式目标，不补造缺失业务算法或成功结果。

### 1.2 完整文件入口与主要指纹

下列链接都是固定副本；链接中的行锚按副本行号。长文件保留完整链接，同时在后文提供逐构造/分支/RHS 账，不以链接代替内容解释。

| 角色 | 完整固定源 | bytes / SHA-256 |
|---|---|---|
| Model | [EntityBehaviorModel.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/domain/EntityBehaviorModel.scala#L1-L26) | 1015 / `82ed1a0943a0fe4a2afd2f28513575ebf963967c5cae07e7ab95d4430f2b1207` |
| Builder | [EntityBehaviorBuilder.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/EntityBehaviorBuilder.scala#L1-L354) | 13327 / `1f38a82acbfe56ccab91d18741f20eb911d6851153134264f9a55548d35e4a87` |
| Template | [EntityBehaviorTemplate.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/EntityBehaviorTemplate.scala#L1-L100) | 3711 / `59725ae168286fa5a2d13bc7d2fc5f3078e68c875342b8a1b76aca4056093a51` |
| formal 混合 renderer | [render-domain.mjs](../baseline/js/generators/scala-cqrs-domain/render-domain.mjs#L1-L133) | 12461 / `98181f044826dd2e45ec4179f030a2de2a47326601f3af9a153df2d96dc09e43` |
| legacy 混合 renderer | [aggregate-dsl/render.mjs](../baseline/js/generators/aggregate-dsl/render.mjs#L300-L808) | 58572 / `25a3fb8ca368109510f118a5f4ff6524ce481a64f004f8ed67bff8b6749f4aab` |
| family2 template | [event-handler.mjs](../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/event-handler.mjs#L1-L25) | 1562 / `63fcd1b8f7fb99f428c41ad514ec03e7bb3b091a0a39ba1e1f56b3786502081a` |
| 银行 CreditBalance 核心 | [CreditBalanceEventHandler.scala](../baseline/actual-js/app/example/bankwealth/domain/entities/behaviors/CreditBalanceEventHandler.scala#L1-L39) | 3201 / `a2adcb5d856f1c28a76462aa255af4eb6c80f72639eda07e31326e6fe74a590b` |
| 银行 FundOrder 核心 | [FundOrderEventHandler.scala](../baseline/actual-js/app/example/bankwealth/domain/entities/behaviors/FundOrderEventHandler.scala#L1-L148) | 11167 / `9b512de1c2010962b29adda6ae5efb330ad6bc7958ea4959e302abd6012b997b` |
| 银行 SipPlan 核心 | [SipPlanEventHandler.scala](../baseline/actual-js/app/example/bankwealth/domain/entities/behaviors/SipPlanEventHandler.scala#L1-L88) | 6714 / `1e83e6b6343008661c4811c48cdb01f691b990f7b14b131068320c812f9e6ee3` |
| 人工参考 | [CreditBalanceEventHandler.scala](../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L1-L58) | 2455 / `6af6ca27ed6b4c49559f35a5cd86850a2f24624044321c83d853c33c2e422534` |
| 银行入口配置 | [truthsrc.project.json](../baseline/bank/truthsrc.project.json#L278-L299) | 6434 / `ae42876f8cd46d75372378fc993595ecff5dd65755e98adc045ff22597c3e691` |

以上主要文件做过字节数/SHA 与索引的只读核对，结果相符；这不是生成一致性验证。其他固定依赖的完整 SHA 仍在同一 index。

### 1.3 Scala 调度、输出基数及条件

[CodegenMain.scala:183–241](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L183-L241) 的 `semanticProductsFile` 分支另走 `generateProducts`，**不是**本族金样。传统路径 `prepare → generate/generateAdmitted → runCommon → generateDomainLayer`；[runCommon:192–220](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L192-L220) 先建 context，再逐层生成。

[generateDomainLayer:543–555](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L543-L555) 对 `domain.behaviors` 逐项 `EntityBehaviorBuilder.build → EntityBehaviorTemplate.generate → writeArtifact`。没有“必须有 formal folds / 非空 handlers / 非空 helpers 才调度”的门。ledger kind 是 **`event-handlers`**（复数），schemaCategory 是 `entity`，schemaNode 是 `meta.name`；JS kind **`event-handler`**（单数）不能悄悄混同。

| variant | 条件 / 内容 | 计划文件数与完整路径 |
|---|---|---|
| traditional-single | `domain.behaviors` 每项，owner 可解析且 scope 包含归属 | 每项 1：`<target>/app/<base slash>/domain/entities/behaviors/<meta.name>.scala` |
| traditional-multi | 同上，`multiProject=true`；kind 查表为 kernel | 每项 1：`<target>/modules/kernel/src/main/scala/<base slash>/domain/entities/behaviors/<meta.name>.scala` |
| scope-suppressed | `currentScope.includes(attribution)==false` | 不写文件；Builder/Template 已执行，ledger 已先记账，并非“没生成模型” |
| reference-code / TODO | 单个 mutation 无可用 formal render | 同一文件中的分支，不增加文件；用 referenceCode 或 TODO + `state` |
| scalar-formal | 所有行可解析且非空，无 `put-all/remove-all` | 同一文件中的 `state.copy` |
| collection-formal | 任一行为 `put-all/remove-all`，整组走集合路径 | 同一文件；全组仅容许 put/remove/put-all/remove-all |
| helpers | helperMethods 非空 | 同一 object 内每项一个 private def；raw body 均为 `???` |

[writeArtifact:359–424](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L359-L424) 决定物理根、账本、fingerprint 与领地写入；[targetModuleOf:331–349](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L331-L349) 决定模块。计划基数为 `domain.behaviors.size`，实际写数还受 scope、异常及领地 KEEP 影响，不能保证 N 项就写 N 文件。以上分支本轮均 **未 exercised**。

## 2. Scala Model：全部字段、默认值与结构依赖

### 2.1 Model 完整源码

```scala
package net.imadz.codegen.scaffolding.cqrs.model.domain

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

case class EntityBehaviorModel(
    override val selfType: TypeRef, // e.g. behaviors.CreditBalanceEventHandler (Object)
    handlerTypeAlias: TypeRef, // e.g. entities.CreditBalanceEntity.CreditBalanceEventHandler (Type Alias)
    stateType: TypeRef, // [NEW] 显式引用 State 类型
    eventFamilyType: TypeRef, // [NEW] 显式引用 EventFamily 类型
    mutations: Seq[StateMutationModel], // 事件处理逻辑
    helperMethods: Seq[MethodModel], // 私有辅助方法
    override val dependencies: Set[TypeRef]
) extends ArtifactModel

case class StateMutationModel(
    eventType: TypeRef, // e.g. BalanceChanged
    logicCode: String, // e.g. "state.copy(...)"
    collectionFolds: Vector[net.imadz.meta.filesystem.FormalFoldRow] = Vector.empty
)

case class MethodModel(
    name: String,
    params: Seq[FieldDef],
    returnType: TypeRef,
    logicCode: String
)
```

| 顺序 / 字段 | 类型 / 默认 | Builder 来源；Template 消费；JS 对应差距 |
|---|---|---|
| E1 `selfType` | TypeRef，无默认，override val | 原 `meta.name` + behaviors 包；object/package/path；formal 临时 `pkg/name/eventPackage`，无独立模型 |
| E2 `handlerTypeAlias` | TypeRef，无默认 | EventFamily 去末尾 Event 再加 EventHandler；owner 为 Entity object；用于 import 和无参 apply 返回类型；formal/family2 没有该 alias 模型 |
| E3 `stateType` | TypeRef，无默认 | EntityStateRef；只经 dependencies 影响该 Template imports，lambda 参数不显式注类型；formal 直接 `<Aggregate>State` |
| E4 `eventFamilyType` | TypeRef，无默认 | EventFamilyRef；同样参与 imports；formal `Protocol.Event`，family2 protocol carrier，均非传统 Entity alias |
| E5 `mutations` | Seq[StateMutationModel]，无默认 | 按 `meta.handlers` 输入顺序；不能自动字母排序或按事件名猜 fold |
| E6 `helperMethods` | Seq[MethodModel]，无默认 | 按 metadata 方法顺序；formal/family2 此接口缺对应槽，不能当已支持 |
| E7 `dependencies` | Set[TypeRef]，无默认，override val | alias/state/family/event/helper 泛型闭包 + foldDeps；formal 只有物理 path deps，nominal 字符串 FQN 不等于 TypeRef |
| S1 `eventType` | TypeRef，无默认 | resolve StructRef；Template case 用 `.name` 而非 signature |
| S2 `logicCode` | String，无默认 | formal render / referenceCode / TODO；**真实源码字符串债**，不能称原始 Scala 完全结构化 |
| S3 `collectionFolds` | Vector[FormalFoldRow]，默认 Vector.empty | collection 分支把整组原行交 Template；非空时覆盖 S2 的实际输出 |
| H1 `name` | String，无默认 | 方法原名；Template 不调用 scalaIdentifier 处理方法名 |
| H2 `params` | Seq[FieldDef]，无默认 | 顺序保留；名字走 scalaIdentifier、类型走 signature、知识注释透传 |
| H3 `returnType` | TypeRef，无默认 | resolve ReturnType；Template signature |
| H4 `logicCode` | String，无默认 | 只放入 AI_PROMPT Description，**即使有 referenceCode 也不执行，body 仍 ???** |

[ArtifactModel.scala:5–47](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L5-L47) 的继承成员也计账：`fqn = selfType.packageName + "." + selfType.name`；`registerTo(registry) = registry.register(this)`；`morphisms = Nil`、`noteIds = Nil`。本 Model 不覆盖后两者，没有自身概念 noteId/anchor 字段；不能据 helper 参数注释声称整个 handler 已有完备知识映射。`StateMutationModel/MethodModel` 不继承 ArtifactModel，无额外成员。

[TypeSystem.scala:4–85](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4-L85)：TypeRef 顺序为 `name:String, packageName:String, typeParams:Seq[TypeRef]=Nil`；`fqn` 省略空包前缀，`signature` 对 TupleN 且非空参数出 `(T1, T2)`，其他泛型出 `Name[...]`，无参出 name。依赖递归包括自己及全部 typeParams。`shouldImport` 排除空包、同包、`scala`、`java.lang`。FieldDef 顺序为 `name,typeRef,defaultValue:Option[String]=None,comment:Option[String]=None,noteId:Option[String]=None,description:String=""`；本 Builder 仅赋 name/typeRef/noteId/description，本 Template 不输出参数 defaultValue/comment。

`FormalFoldRow` 定义不在冻结 index 中。本次只读补查了可变原仓文件 `/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen/src/main/scala/net/imadz/meta/filesystem/FormalSemantics.scala:27–44`，全文 SHA `42369c2847888cad4373572354c314479c57b8697e9596c76d66f48b76a4825e`，未复制到 baseline。字段依次是必填 `slot:String, op:String`，然后 `expr/key/value/delta:Option[String]=None`、`sign:Option[Int]=None`；`FormalFold(event:String, assignments:Vector[FormalFoldRow])` 两项无默认。其当前 DTO 形状只是补充来源，不能替代固定 Builder 的历史身份。

## 3. Scala Builder：逐规则、分支与每个 RHS

完整 [Builder](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/EntityBehaviorBuilder.scala#L1-L354) 已实读。以下 B 编号是本文构造标识，不是源码已有 enum。

| ID / 行 | 输入、顺序、分支与精确结果 |
|---|---|
| B01 / 28–73 | `build(meta,ctx)` 顺序：behaviorPkg → owning Entity → selfType → handler alias → state/event family → mutations/foldDeps → helpers → collectDependencies 与 foldDeps 并集 → 按 E1–E7 构造 Model；不是 Model 内装整文件 content |
| B02 / 75–87 | `resolveAll[DomainEntityMetadata].find(_.eventFamily.name == meta.eventFamilyRef.targetName)`；取首个匹配，不在此检查多 owner；无匹配抛 `RuntimeException("Cannot find owning DomainEntity for behavior: ... (EventFamily: ...)")` |
| B03 / 91–109 | State 用 `ctx.typeResolver.entityState(EntityStateRef(entityMeta.state.name))`；family 用 `eventFamily(EventFamilyRef(entityMeta.eventFamily.name))`；self 用 `entityBehaviorSelf(meta.name, behaviorPkg)`，不在这里自动 PascalCase |
| B04 / 113–128 | `efName.endsWith("Event")` 才 `dropRight(5)`，否则原名；`aliasName=baseName+"EventHandler"`；`entityObjectPath(entityMeta.name,ctx)` 为包+Entity对象；返回 TypeRef(aliasName, entityObjectPath) |
| B05 / 138–144 | stateFieldTypes 为 fields 的 name→fieldType `.toMap`；formalSemantics 转 Vector，找 aggregate 等于 `entityMeta.name.stripSuffix("Entity")`，headOption；folds 的 event 仅将 `-` 换 `_` 后 `.toMap`，无 formal 用空 Map；本地可变 Set 收 foldDeps，不能声称这里无 mutable |
| B06 / 145–148 | 按 handlers 顺序 resolve event；`foldsByBase.get(handler.eventRef.targetName)`；任一 assignment 的 op 为 put-all/remove-all 即整组 collectionFold，而非逐行选择 renderer |
| B07 / 149–159 | collection 分支先 `.find(_.name == eventType.name).get` 获取事件，缺失会失败；逐行 require state slot 已声明、op 属于四种 collection op、已有 key/value 表达式仅为 literal 或实际 event 字段。没有在这里验证缺 key/value 的存在性、集合元素类型、重复 slot；Template `.get` 仍可能失败。混入 set/money-apply 整组 require 失败 |
| B08 / 160–164 | collection 存在则 rendered=None；否则 `fold.flatMap(renderFold)`；logicCode 用 rendered 或 `generateMutationLogicCode(handler.logic)`；collectionFolds 原 assignments 或 Vector.empty；最终 `(mutations,deps.toSet)` |
| B09 / 177–186 | renderFold 的 eventFields 为该实体中同名 event 的 field map，找不到用空 Map。moneyShape 只接受 `StructRef(name)` 且该 VO 字段**名称集合恰为** `{minorUnits,currency}`，再 resolve 类型；不检查两字段类型或货币合同，其他 MetaType 返回 None |
| B10 / 187–204 | exprCode：`event.f` 必须存在；`literal:` 总是生成双引号字符串（转义反斜杠和引号），不是 Boolean/数字 literal；`state.f[event.k]` 匹配固定 regex，f 必须存在且 event.k 可解析，输出 `state.f(event.k)`；虽然 regex 含 param，param 分支明确 None；其他含裸 state.f 的形式亦 None |
| B11 / 205–213 | exprType：event 字段类型；或 `state.f[...]` 取 `CustomType(_,_,args)` 的第二型参（args.size==2）；此步不独立校验括号 key 是否可执行、也不限定 CustomType 名称为 Map；其他 None |
| B12 / 214–218 | set 且 expr=Some：已声明 slot + exprCode 成功 → `slot = code`；缺必要值/无法解析走 None |
| B13 / 219–221 | put 且 key/value=Some：slot 有效且两个 exprCode 成功 → `slot = state.slot + (keyCode -> valueCode)` |
| B14 / 222–224 | remove 且 key=Some：`slot = state.slot - keyCode` |
| B15 / 225–239 | money-apply 且 delta/sign=Some：delta 类型满足 moneyShape、slot 存在、delta 可渲染 → 加 Money 和 `TypeRef("MoneyOps","net.imadz.common")` 依赖；RHS 见下完整代码。此函数未检查 sign 必为 ±1，也未验证 slot 确实为对应 currency→Money Map |
| B16 / 240–245 | 未匹配 op/字段组合 → None；任一行 None 或 rows 空则整个 fold None，绝不部分 state.copy；否则按行顺序 `state.copy(\n        ...逗号换行...\n      )`。之前已加进 mutable deps 的 Money/MoneyOps 不会在整体失败时回滚 |
| B17 / 248–258 | fieldSlot 仅判 `stateFieldTypes.contains(slot)`；resolveEventType 调 `ctx.typeResolver.resolve(StructRef(eventName))` |
| B18 / 262–266 | mutation 的 `logic.referenceCode` 有值时 verbatim；无值为 `// TODO: ${logic.intent}\n      state\n`，是未实现业务槽的恒等 fallback，不是成功业务证明 |
| B19 / 270–280 | helperMethods 顺序 map；分别构造参数、解析 return、取逻辑，然后 MethodModel(name,params,returnType,logicCode) |
| B20 / 284–300 | 每个 param 仅 `FieldDef(p.name,resolve(p.parameterType),noteId=p.noteId,description=p.description)`；不读取 `optional/optionalWhen`。ReturnType 直接 resolve。MethodMetadata 的 `isPrivate/description` 不参与决策，Template 恒 private |
| B21 / 304–311 | helper `Either[String,BusinessLogic]` 的 Left → `// Error: $err`；Right 有 referenceCode → 原串，无 → `// TODO: ${intent}`；这是 prompt 内容，不是可执行方法体 |
| B22 / 315–333 | alias、state、family 各 collectAllDependencies，合并 mutationDeps、helperDeps，再按 behaviorPkg shouldImport；ctx 参数在这个方法体未使用 |
| B23 / 337–352 | mutationDeps 仅 eventType 递归闭包；helperDeps 为 returnType + params.typeRef 的递归闭包。**不会解析 logicCode 中任意 RHS 符号**；只有 money 特例经 foldDeps 补依赖 |

B15 实际生成的 RHS（`$slot/$dc/$money/$sign` 是原 Builder 的插值槽，不是填好业务的产物）：

```scala
$slot = {
            val key = $dc.currency
            val current = state.$slot.getOrElse(key, ${money.name}("0", key))
            state.$slot.updated(key, current.copy(minorUnits = MoneyOps.shift(current.minorUnits, $dc.minorUnits, $sign)))
          }
```

这里 `$dc` 会在 currency 与 minorUnits 位置重复出现；原有 `key/current` 有语义，不按“去 nextN”删除。不能把这条 minor-unit-string Map 算法移植成银行 `Money(amount:BigDecimal,currency:String)` 的默认算法。

### 3.1 共享 resolver 不是魔法成功门

- [PackageLayout.scala:18–21](../baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala#L18-L21)：唯一包来源 `<base>.domain.entities.behaviors`。
- [TypeResolverDSL.scala:140–159,222–223,965–967](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L140-L159)：MetaRef 重载转 TypeResolver；state 字符串重载根据 state 名反推 Entity 嵌套 owner；`entityBehaviorSelf` 原名原包 TypeRef；`entityObjectPath` 直接实体名拼 owner，不重命名。
- [NamingConventions.scala:521–522](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L521-L522)：state owner 先去 State，再去 Entity，再 domainEntityName；[scalaIdentifier:180–181](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L180-L181) 只为关键字加反引号。
- [TypeResolver.scala:19–90,95–148](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala#L19-L148)：基础类型逐项映射；StructRef 有 SymbolTable owner 则 resolveNestedType，否则 domain.values；CustomType 先 knownFrameworkTypes，再递归型参，特定旧 VO 包重定位；Entity owner / Aggregate owner / Saga / Query 分支不同。未知类型可落 Any，泛 MetaRef 的 `resolveMetaRef` 在 L93 仍为 `???`。不得把这些原始缺口包装成已验证的 resolver，也不能为目标低 CC 延续 Any 逃生通道。
- [ArchitectMetadata.scala:63–67,167–178,233–267,312–325](../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L233-L267)：EntityBehaviorMetadata helperMethods 默认 Nil；BusinessLogic invariants 默认 Nil/referenceCode 默认 None。本族不消费 BusinessLogic.invariants。共享上下文提供 registry/symbolTable/formalSemantics，不在此文件声明线程或资源生命周期。

## 4. Template：完整源与从上到下的构造账

### 4.1 完整固定 Template 源码

```scala
package net.imadz.codegen.scaffolding.cqrs.template.domain

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.model.domain.EntityBehaviorModel

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object EntityBehaviorTemplate extends CodeTemplate[EntityBehaviorModel] {

  def generate(model: EntityBehaviorModel): String = {
    // 1. 构建包声明
    val pkgDecl = packageDecl(model.selfType.packageName)

    // 2. 构建导入声明
    val importDecl = imports(
      model.dependencies.toList
        .sortBy(_.fqn)
        .map(_.fqn)
        .filterNot(p =>
          p.isEmpty || p == model.selfType.packageName || p.startsWith(
            "java.lang"
          )
        ) :+
        model.handlerTypeAlias.fqn // 显式导入类型别名
      : _*
    )

    // 3. 生成mutations代码
    val mutationsCode = model.mutations
      .map { m =>
        val code = if (m.collectionFolds.isEmpty) m.logicCode else {
          def expr(value: String): String = if (value.startsWith("literal:")) ujson.write(ujson.Str(value.drop(8))) else value
          val rows = m.collectionFolds.map { row =>
            val key = expr(row.key.get)
            row.op match {
              case "put" => s"${row.slot} = state.${row.slot} + ($key -> ${expr(row.value.get)})"
              case "remove" => s"${row.slot} = state.${row.slot} - $key"
              case "put-all" => s"${row.slot} = state.${row.slot} ++ $key.map(k => k -> ${expr(row.value.get)})"
              case "remove-all" => s"${row.slot} = state.${row.slot} -- $key"
              case _ => throw new IllegalArgumentException("unsupported collection fold")
            }
          }
          "state.copy(\n        " + rows.mkString(",\n        ") + "\n      )"
        }
        s"    case event: ${m.eventType.name} =>\n      $code"
      }
      .mkString("\n\n")

    // 4. 生成辅助方法代码 (注入 AI Prompt)
    val helpersCode = model.helperMethods
      .map { m =>
        val params =
          m.params.map(p => s"${NamingConventions.scalaIdentifier(p.name)}: ${p.typeRef.signature}").mkString(", ")

        // 2026-09-23 EP_GenerationTime_Code_Anchors B4（**形态③**）：辅助方法参数＝命令参数落点
        // （`EntityBehaviorBuilder:181` 早已透传 noteId），在 `def` 前补 `@param … @knowledge` 块。
        val fieldDoc = net.imadz.codegen.scaffolding.cqrs.template.KnowledgeAnchorDoc.fieldDoc(m.params, "  ")

        // 提取 logicCode 作为 Prompt 的一部分
        val logicDesc = m.logicCode

        s"""$fieldDoc  private def ${m.name}($params): ${m.returnType.signature} = {
    /*
    >>> AI_PROMPT_START
    Context: Domain Entity Helper Method
    Task: Implement logic for ${m.name}
    Description: $logicDesc
    Input Params: $params
    Return: ${m.returnType.signature}
    <<< AI_PROMPT_END
    */
    ???
  }"""
      }
      .mkString("\n\n")

    // 5. 构建apply方法代码
    val applyMethodCode =
      s"  def apply: ${model.handlerTypeAlias.name} = (state, event) => event match {\n$mutationsCode\n    case _ => state // 默认兜底，或者抛异常\n  }"

    // 6. 构建对象定义
    val behaviorObj = objectDef(
      name = model.selfType.name,
      body = s"$applyMethodCode\n\n$helpersCode"
    )

    // 7. 构建源文件
    val sourceFile = SourceFile(
      packageDecl = pkgDecl,
      importDecl = importDecl,
      definitions = Seq(behaviorObj)
    )

    // 8. 生成代码
    sourceFile.code
  }
}
```

Template 源自身重复导入三次 NamingConventions，这是源文件现状，不是被生成文件的 import 规则。

### 4.2 输出构造/RHS 顺序表

| ID | 输出构造及完整规则 | formal / 目标处理 |
|---|---|---|
| T01 | package 为 selfType.packageName。Template 本身不发 generated header | JS entry 层发固定头；目标 header 在共享 writer 定最终字节 |
| T02 | dependencies 转 List 按 fqn 排序→取 fqn→过滤空串、恰等包名、startsWith java.lang；**再追加 alias fqn**。DSL ImportDeclaration 又 `.sorted`，**没有 distinct**。alias 通常已在 deps 中，可能重复 import | 目标按用户正常 imports 要求去重、检测同名冲突并保留嵌套 owner；此去重是显式 raw 偏差，不能声称原模板已去重 |
| T03 | `object <selfType.name> { ... }`，无 extends/with、父构造参数、主辅构造器、self-type、注解、泛型、型变/上下界或嵌套 companion | 目标保留 object，不引 Actor/DI 到领域 |
| T04 | 第一个成员 `def apply: <handlerTypeAlias.name> = (state, event) => event match { ... }`；无空括号/显式形参/implicit 列表；返回值是函数 alias，不是 curried apply | formal 是双参方法，调用形状需与 Entity/Bootstrap 原子迁移 |
| T05 | mutations 顺序不排序；每项 `case event: <eventType.name> =>`，不是 case-class 解构；空 collectionFolds 就逐字插入 logicCode；分支间一空行 | 正常 fold 来自结构化输入；referenceCode/TODO 保留独立原始槽 |
| T06 | collection 非空：literal 值用 ujson JSON string 编码，其余原串；每行先 `row.key.get`；put 用 `state.slot + (key -> value)`；remove 用 `state.slot - key`；put-all 用 `state.slot ++ key.map(k => k -> value)`；remove-all 用 `state.slot -- key`；未知 op 抛 IllegalArgumentException；所有行按顺序一次 state.copy | 不把 JS put-all 的一次 value 求值改成 raw 的每 key 求值；见 EH-D3；不丢重复目标/缺值异常信息 |
| T07 | 所有 case 后固定 `case _ => state // 默认兜底，或者抛异常`，**实际没有抛异常** | formal/family2 无此 fallback；属于语义差异，不是排版；EH-D2 |
| T08 | apply 后两个换行，再 helperMethods 顺序；有 noteId 的参数在紧邻 def 的一个 Scaladoc 块中发 `@param <escaped name> [description]  @knowledge <annotated id>`；无 noteId 不编造，空列表无块 | helper 参数的 source mapping 不能用整个文件一个 span 替代 |
| T09 | `private def <m.name>(<按输入顺序 name: signature，逗号空格>): <return.signature> = { ... }`；始终 private、单参数列表、无默认值/泛型/implicit/overload 推导；空 params 发 `()` | Model.logicCode 只作为完整 prompt 的 Description；Input Params/Return 对应真实签名；最终 body `???`，非 logicCode |
| T10 | helpers 之间一空行；object body 为 apply + 两换行 + helpers（即使 helpers 为空也不条件修剪）；SourceFile package/import/object 以两个换行拼接，末尾一个 LF | 空列表的额外空白是 raw 事实；是否紧缩在有限白名单裁定，不用压平全部 whitespace 的 normalize |

[CodeGenerationDSL.scala:13–22,60–84,109–112](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L13-L112) 固定上述排版；[KnowledgeAnchorDoc.scala:32–61](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/KnowledgeAnchorDoc.scala#L32-L61) 委托 `CQRSApplicationGenerator.annotateKnowledge(Some(raw)).getOrElse(raw)` 决定注释中的版本标记。没有生成 val/var/lazy/implicit、type alias 定义、嵌套 trait/class/case class 或初始化 I/O；alias 的**定义属于 Entity 文件**，[DomainEntityTemplate.scala:85–101](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/DomainEntityTemplate.scala#L85-L101) 的 RHS 精确为 `(StateName, EventFamilyName) => StateName`。

**代码槽/手写隔离**：本 Template 不生成 `MANUAL` 标记。mutation referenceCode 可能携带手写源码，helper 则强制 `???`。后续不能默默把 prompt 变成默认成功，不能直接覆盖 curated 方法体；若选择外置实现捕获，先裁定其签名、纯性、来源、保护策略，不自行增加运行库副本。

## 5. JS 三条路线与四层差距

### 5.1 formal 银行确切调用链

1. 冻结银行 [project:278](../baseline/bank/truthsrc.project.json#L278-L299) 明确选择 `scala-cqrs-play-service`，非按文件夹猜测。
2. [generate-cli.mjs:92–101](../baseline/js/lib/products/generate-cli.mjs#L92-L101) 将这个实路径注册到 generatePlayService；[service generate:16–23,67–70](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L16-L70) 在 inherited `invariant-dsl` 分支**直接**调用 `renderInvariant(...,true)`。footprint 为 reference-layout@1、domain-decision@4、domain-folds@6、exact-value-types@1。
3. [render-domain:57–133](../baseline/js/generators/scala-cqrs-domain/render-domain.mjs#L57-L133) 同时装配 Rules、RuleParams、Rules wrapper、核心 EventHandler、EventHandler wrapper，**不能由几个 agent 同时改整个文件**。
4. 其他公开 formal 路线也消费同 renderer：[scala-cqrs-domain/generate:1–19](../baseline/js/generators/scala-cqrs-domain/generate.mjs#L1-L19) → [invariant-dsl/produce:1–6](../baseline/js/generators/invariant-dsl/produce.mjs#L1-L6)（domain-decision@3 / domain-folds@4）；[produce-v2:8–16](../baseline/js/generators/scala-cqrs-domain/produce-v2.mjs#L8-L16) 的 invariant-dsl 用 decision@4/folds@6、默认非 layered。只改 service 支路会留下共享旧行为。

### 5.2 formal emitter 全部 fold 构造

| 区域 | 实际输入 / 输出 / RHS |
|---|---|
| 6、14–15、58–61 | aggregates 来自 reference-layout declarations 的 kind=aggregate；事件来自 domain-folds.events，owner 仅比较 context 与 owner[0]；按过滤后原顺序。pkg 用 packages 精确绑定；name 仅 symbol 校验/关键字转义，不 CamelCase |
| 93–94 | layered 包为 `.domain.entities.behaviors`，否则 `.domain`；layered imports 固定 `<pkg>.domain._` 后 `<pkg>.domain.<Name>Protocol._`，非 layered 只 `<Name>Protocol._`；object + `def apply(state: NameState, input: Event): NameState = input match` |
| 95–112 | 每事件按 assignments 顺序，base=`state.<escaped target.id>`；set=render(value)；put=`base.updated(render(key),render(value))`；remove=`base - key`；put-all=`{ val keys = key; val item = value; base ++ keys.map(_ -> item) }`；remove-all=`base -- key`；integer-apply=`java.lang.Math.addExact/subtractExact(base,delta)`（sign===1 判 add，其他判 subtract）；money-apply=`base.plus/minus(delta)`；其他抛 TypeError |
| 109–115 | **每个 assignment 无条件**生成 `val next<i>: typeName(a.valueType) = value`，再一次 `state.copy(target0=next0,...)`；零 assignments 返回 state。记录 assignment span、event scope，未重新命名业务语义变量 |
| 117、125–130 | 无 catch-all。event core path 使用 raw `a.ref.id` 文件名；kind event-handler，deps 仅 protocol/state 两路径。layered 另写旧 `.domain.NameEventHandler` 的单方法转发壳，deps 增加核心文件 |
| naming.mjs:15–31 | nominal 返回完整 `<pkg>.domain.values.X`，optional/sequence/map 递归；entry 添加 `// @generated by truthsrc scala-cqrs-domain:1`，按 header+源码计算 UTF-8 字节 span，knowledgeIds 去重，保留 footprint，merge=null |

[render-expressions.mjs:88–115](../baseline/js/generators/scala-cqrs-domain/render-expressions.mjs#L88-L115) 是所有 RHS 的表达式来源，不能只搬外层 state.copy：

- ref 根据 kind 得 `state.` / `event.` / `p.`；literal 按 primitive（string/boolean/Long.parseLong/BigDecimal）、nominal exact decimal/unit-decimal、record 字段顺序、包装值、optional Some/None、sequence Vector、map Map 递归生成，其他 carrier 抛 TypeError。
- host 为 `hosts.<id>(state,p)`；member 为 `(argument).member`；map-get 为 `(map).get(key)`；add/subtract 根据 operand 类型出 Math exact 或 `.plus/.minus`；其他值 op 抛 TypeError。**不能因 render 函数支持 host 就声称 fold 合法接收 host**，需要上游 event scope admission。
- decision 的 `not`/比较等属于 Rules 工作包；本族只消费 valueExpression，不能顺手重写决策逻辑或删除 nominal 类型。

### 5.3 legacy 近似实现存在，但银行不调用

[aggregate-dsl/emit.mjs:5–10](../baseline/js/generators/aggregate-dsl/emit.mjs#L5-L10) 的公开旧入口加载 `render(spec)`，仅 `spec.entityDir` 存在才返回并写实体及 handler；handler 目标实际使用 **spec.entityDir**，不是仅 outDir。[render.mjs:99–101,247,1129–1131](../baseline/js/generators/aggregate-dsl/render.mjs#L1129-L1131) 给出 objName/entityPkg/字母序 orderedEvents 与输出条件。这条 legacy renderer **不是**同目录 produce.mjs 调用的 formal renderer。

legacy handler 的完整区域为 [300–808](../baseline/js/generators/aggregate-dsl/render.mjs#L300-L808)，其 Model/Builder/Template 尚混在一个 render 中，但存在传统 alias/闭包/Entity imports 的可比较实现，不能说 JS 完全没有：

| legacy 区域 | 保留其真实行为；不能直接当 formal 目标 |
|---|---|
| 340–346、358–394 | terminalStates 非空且 statusTransitions 空时，非终态 status literal 受旧终态 guard；每 slot 首次 addAssign 胜出；compat 支持同型、Id→String、标量→List，以及仅 writtenBy 阶段非 List 的 Option.getOrElse(state) |
| 397–424 | structured put/remove/put-all/remove-all 与 Scala Map 运算符近似；money-apply 使用 Money("0",key)、MoneyOps.shift，sign 缺省 1；未知 structured op **verbatim 未实现串**，不是 fail-closed |
| 425–580 | literal/status、event 兼容/整表非空携带、upsert VO 构造、memberPatch 的 Option/List/标量字段 copy、裸 state、fn declaredFunctions 接口、append/concat/remove/keep、path-key upsert、memberUpsert/memberRemove/memberAppend/Replace/Cut；缺 VO/方法/输入时保留 verbatim 并 fold-note。fn 去 Access 前缀后记录 portTrait/member；不能据此往纯 replay 接入 I/O |
| 581–669 | phase 0 显式 op/verb 顺序；1 writtenBy 按 stateFields；2 statusTransition；3 audit 同名/词干/创建更新；4 非 DERIVED 的同名 fallback；5 version=event.newVersion；按 phase 再字段/显式序排序；一次 state.copy 或 state。与 formal 的显式原序不同，不能照搬启发式 |
| 671–695 | 输出 event noteId、typed case、可选 causal 注释、copy、待审清单；待审顺序是 writtenBy→status→audit→phase4→未映射 payload；envelope 四字段排除；verbatim 不充当已消费 payload 证明 |
| 698–777 | handler blocks 按 orderedEvents；ports 从 fn 使用收集，规则侧另筛行为依赖；VO import 从可构造/可用 fold 推导；imports 顺序为事件、family、alias、state、排序 ports、首次出现 VO、可选 MoneyOps |
| 779–808 | generated/version 头、包、imports、状态投影说明、object；无 port 为 `def apply: Alias`；有 port 为 `def apply(member:Trait,...):Alias`，逐个 require 非 null 后捕获闭包；两者最后都是 `case _ => state`；foldNotes 返回 notices。不是 BC helperMethods 的 `private def ???` 接口 |

该分支只登记 `legacy/not-wired-to-bank`。不复活退役入口、不把它的业务猜测表并入 formal admission。

### 5.4 family2 已有直接 copy，但不是银行替代品

[generate-cli:97–98](../baseline/js/lib/products/generate-cli.mjs#L97-L98) 显式注册 `scala-cqrs-aggregate-core-v1`；[family generate:11–23](../baseline/js/generators/scala-cqrs-aggregate-core-v1/generate.mjs#L11-L23) 要求 profile `scala-cqrs-aggregate-core@1`。其完整 [build-models.mjs](../baseline/js/generators/scala-cqrs-aggregate-core-v1/build-models.mjs#L1-L248)、[render.mjs](../baseline/js/generators/scala-cqrs-aggregate-core-v1/render.mjs#L1-L35)、[expressions.mjs](../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/expressions.mjs#L1-L157) 与 event template 已实读。

- build L18–28：eventHandler 角色/kind 都是 event-handler，subpackage domain.entities.behaviors，module kernel，后缀 EventHandler。L50–118：copyImmutableData 输入、明确 options/packages/names/protobuf，复用 kernel 模型和名称碰撞规则，产物含 ref/role/kind/module/name/identifier/package/fqn/path/sources/refs/directDeps。
- L73–74 **拒绝全部 external producers**；L237 要求每个 event 有本地 command producer。因此不能把银行 formal service 无条件切到 family2。
- L183–219：事件按 base.protocol.events；assignments 按 sourceOrdinal 校核连续原序与 pointer；目标必须为同 aggregate 的 state-field、型别完全等同且不重复；白名单 set/put/remove/put-all/remove-all/money-apply/integer-apply；sign 必 ±1，integer 必 signed64，money 要 exact descriptor，collection 必 Map且 key/value 类型相符；依赖必须等于精确闭包；保留逐行 sources/directDeps。
- L221–245：eventHandler deps=protocol/state+全部 RHS 依赖，来源/refs 合并；禁止 path 碰撞、自依赖、kernel→glue；不等于 BC Model 七字段已齐，缺 alias/helperMethods/referenceCode 分支。
- render L15–24 注册每 aggregate 的 eventHandler job，L27–34 最终走 renderJobs/aggregateSourceEntry，并附 family build/tests；这是真接线，不只是有一个 templates 目录。
- template 完整输出顺序：templateScope 以 protocol/state 加 protocol Commands/Events wildcard 候选收 imports；package/imports→object→双参 apply(state,event:Protocol.Event)→事件循环。空 assignments 为 `case _: EventClass => state`；有赋值为 `case value: EventClass =>`；一项单行 copy，多项逐行 named args copy；无 fallback、无 helpers、无 alias 定义，append 同步附 sources。
- expressions L5–35：同名分组、排除 own name 冲突、可用 direct/wildcard 才简名，其他由 parent import 或 `_root_.FQN` 表达，imports 去重；不是全面移除限定符。
- expressions L140–154：fold 的 set/put/remove/exact arithmetic 同 formal；put-all 特别先求 keys，再 **即使 keys 为空也求 value 一次**，随后 foldLeft `.updated`。这是应保留的语义证据，不可用 raw `keys.map(k => value)` 偷换。

四层结论：formal 无独立 EntityBehaviorModel；family2 有严格结构模型但 API/输入子集不同；legacy 有接近的 alias/Entity imports但启发式语义不同；三者都不能凭“已有文件”宣布传统族一对一完成。

## 6. 实际完整文件、人工参考与目标实例

### 6.1 actual-js：CreditBalance 核心完整字节内容

```scala
// @generated by truthsrc scala-cqrs-domain:1
package example.bankwealth.domain.entities.behaviors

import example.bankwealth.domain._
import example.bankwealth.domain.CreditBalanceProtocol._

object CreditBalanceEventHandler {
  def apply(state: CreditBalanceState, input: Event): CreditBalanceState = input match {
    case event: AccountInitialized =>
      val next0: Boolean = true
      val next1: Map[String, example.bankwealth.domain.values.Money] = state.accountBalance.updated(event.currency, event.amount)
      state.copy(initialized = next0, accountBalance = next1)
    case event: ReserveFundsConfirmed =>
      val next0: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.reservedAmount.updated(event.txid, event.amount)
      val next1: Map[String, example.bankwealth.domain.values.Money] = state.accountBalance.updated(event.currency, event.available)
      state.copy(reservedAmount = next0, accountBalance = next1)
    case event: DeductFundsConfirmed =>
      val next0: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.reservedAmount - event.txid
      val next1: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.committedOutgoing.updated(event.txid, event.amount)
      state.copy(reservedAmount = next0, committedOutgoing = next1)
    case event: ReleaseReservedFundsConfirmed =>
      val next0: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.reservedAmount - event.txid
      val next1: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.compensatedOutgoing.updated(event.txid, event.amount)
      val next2: Map[String, example.bankwealth.domain.values.Money] = state.accountBalance.updated(event.currency, event.available)
      state.copy(reservedAmount = next0, compensatedOutgoing = next1, accountBalance = next2)
    case event: RecordIncomingCreditsConfirmed =>
      val next0: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.incomingCredits.updated(event.txid, event.amount)
      state.copy(incomingCredits = next0)
    case event: CommitIncomingCreditsConfirmed =>
      val next0: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.incomingCredits - event.txid
      val next1: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.committedIncoming.updated(event.txid, event.amount)
      val next2: Map[String, example.bankwealth.domain.values.Money] = state.accountBalance.updated(event.currency, event.available)
      state.copy(incomingCredits = next0, committedIncoming = next1, accountBalance = next2)
    case event: CancelIncomingCreditConfirmed =>
      val next0: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.incomingCredits - event.txid
      val next1: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.compensatedIncoming.updated(event.txid, event.amount)
      state.copy(incomingCredits = next0, compensatedIncoming = next1)
  }
}
```

旧路径完整 [转发壳](../baseline/actual-js/app/example/bankwealth/domain/CreditBalanceEventHandler.scala#L1-L9) 是：

```scala
// @generated by truthsrc scala-cqrs-domain:1
package example.bankwealth.domain

import CreditBalanceProtocol._

object CreditBalanceEventHandler {
  def apply(state: CreditBalanceState, input: Event): CreditBalanceState =
    example.bankwealth.domain.entities.behaviors.CreditBalanceEventHandler(state, input)
}
```

此壳没有新业务语义，退役不能只挪包。现有 [CreditBalanceEntity.scala:4–40](../baseline/actual-js/app/example/bankwealth/domain/entities/CreditBalanceEntity.scala#L4-L40) 的 State/Event/Events 实际仍是指回平铺 domain 类型的 alias/val，没有传统 `CreditBalanceEventHandler` type alias；[CreditBalanceBootstrap.scala:19–26](../baseline/actual-js/app/example/bankwealth/infrastructure/bootstrap/CreditBalanceBootstrap.scala#L19-L26) 已直接使用核心 `CreditBalanceEventHandler.apply`，并在外层 EventSourcedBehavior 持久化/适配。必须把 Entity/Protocol/Bootstrap 的类型迁移归同一次接口闭包，不在本文件制造永久转发兼容层。

### 6.2 其他银行核心的逐事件 RHS 账

3 个实际核心文件共有 **7 / 32 / 18** 个 typed case（源码行计数，不是覆盖率或 CC）。共同外壳与 CreditBalance 一样：固定头、behaviors 包、domain 通配 + 对应 Protocol 通配、object、双参 apply、没有 fallback/helpers。全部赋值按 `next0,next1,... → 一次 copy` 原序处理；所有未赋字段保持原 state。

下面紧凑记法仅为账表：`put(f,k,v)` 精确代表 `f = state.f.updated(k,v)`；`remove(f,k)` 代表 `f = state.f - k`；`inc(f)` 代表 `f = java.lang.Math.addExact(state.f, java.lang.Long.parseLong("1"))`。分号表示同一次 copy 的实参求值顺序，**不是顺次产生中间 state**。普通 `f = expression` 保留原 RHS。目标只在有单次求值保证时把这些 RHS 内联 named args，不改变运算符、值、身份或次序。

完整固定 [FundOrderEventHandler.scala](../baseline/actual-js/app/example/bankwealth/domain/entities/behaviors/FundOrderEventHandler.scala#L1-L148)：

| 行 / case | 原 RHS 依次为 |
|---|---|
| 9–16 FundPurchaseSettlementRequested | operationId=event.operationId；investorAccountId=event.investorAccountId；fundCollectionAccountId=event.fundCollectionAccountId；fundCode=event.fundCode；amount=event.amount；status="payment-requested" |
| 17–19 ReserveFundSubscriptionConfirmed | put(reservedSubscriptions,event.txid,event.amount) |
| 20–25 FundSubscriptionPaymentConfirmed | remove(reservedSubscriptions,event.txid)；put(committedSubscriptions,event.txid,event.amount)；selectedPaymentTxId=event.txid；status="payment-committed" |
| 26–29 CashFundSubscriptionCanceled | remove(reservedSubscriptions,event.txid)；put(compensatedSubscriptions,event.txid,event.amount) |
| 30–34 FundCashPaymentSucceeded | put(cashPaymentResults,event.txid,event.kind)；paymentOutcome=event.kind；put(cashPaymentFinalResults,event.txid,event.kind) |
| 35–39 FundCashPaymentRejectedBeforeEffects | 同上一行的三个 RHS，独立 case 不合并协议 |
| 40–44 FundCashPaymentCompensated | 同上三个 RHS，独立 case |
| 45–48 FundCashPaymentRecoveryRequired | put(cashPaymentResults,event.txid,event.kind)；paymentOutcome=event.kind，**不写 finalResults** |
| 49–52 FundCashPaymentOutcomeUnknown | 同上两个 RHS，独立 case |
| 53–56 FundTASubmissionRegistered | taRequestId=event.taRequestId；taStatus="submitted" |
| 57–62 FundTAAccepted | put(taReceipts,event.receiptId,event.receiptBody)；put(taReceiptOutcomes,event.receiptId,event.outcome)；taReference=event.taReference；taStatus=event.outcome |
| 63–69 FundTASharesConfirmed | 上一行四项之后，taConfirmedShares=event.shares |
| 70–76 FundTARejected | FundTAAccepted 四项之后，taRejectionReason=event.reason |
| 77–82 FundTAUnknown | FundTAAccepted 四项，独立 case |
| 83–86 FundPurchaseRefundRequested | refundOperationId=event.refundOperationId；refundOutcome="pending" |
| 87–91 FundRefundSucceeded | put(refundResultReceipts,event.receiptId,event.receiptBody)；refundOutcome=event.kind；put(refundFinalResults,event.refundTxId,event.kind) |
| 92–96 FundRefundRejectedBeforeEffects | 同上三个 RHS，独立 case |
| 97–101 FundRefundCompensated | 同上三个 RHS，独立 case |
| 102–105 FundRefundRecoveryRequired | put(refundResultReceipts,event.receiptId,event.receiptBody)；refundOutcome=event.kind，**不写 finalResults** |
| 106–109 FundRefundOutcomeUnknown | 同上两个 RHS，独立 case |
| 110–112 FundTAReceiptObserved | put(taObservedReceipts,event.receiptId,event.receiptBody) |
| 113–115 BankPaymentResultSucceeded | put(paymentObservedResults,event.txid,"succeeded") |
| 116–118 BankPaymentResultRejectedBeforeEffects | put(paymentObservedResults,event.txid,"rejected-before-effects") |
| 119–121 BankPaymentResultCompensated | put(paymentObservedResults,event.txid,"compensated") |
| 122–124 BankPaymentResultRecoveryRequired | put(paymentObservedResults,event.txid,"recovery-required") |
| 125–127 BankPaymentResultOutcomeUnknown | put(paymentObservedResults,event.txid,"outcome-unknown") |
| 128–130 BankRefundResultSucceeded | put(refundObservedResults,event.txid,"succeeded") |
| 131–133 BankRefundResultRejectedBeforeEffects | put(refundObservedResults,event.txid,"rejected-before-effects") |
| 134–136 BankRefundResultCompensated | put(refundObservedResults,event.txid,"compensated") |
| 137–139 BankRefundResultRecoveryRequired | put(refundObservedResults,event.txid,"recovery-required") |
| 140–142 BankRefundResultOutcomeUnknown | put(refundObservedResults,event.txid,"outcome-unknown") |
| 143–146 CashRequestSourceRecorded | cashRequestSource=event.source；put(cashRequestOriginals,"original",event.original) |

完整固定 [SipPlanEventHandler.scala](../baseline/actual-js/app/example/bankwealth/domain/entities/behaviors/SipPlanEventHandler.scala#L1-L88)：

| 行 / case | 原 RHS 依次为 |
|---|---|
| 9–15 SipPlanCreated | id=event.planId；initialized=true；put(revisions,(event.config).revision,event.config)；latestRevision=(event.config).revision；latestEffectiveSlot=(event.config).effectiveSlot |
| 16–21 SipDueSlotAppended | put(slots,event.position,event.dueSlot)；inc(scheduleCount)；lastDueSlot=event.dueSlot；put(intentAppendedDueSlots,event.dueSlot,event.position) |
| 22–24 SipScheduleSealed | scheduleSealed=event.`sealed`；保留关键字访问器 |
| 25–30 SipPlanRevised | put(revisions,(event.config).revision,event.config)；put(revisionEnds,event.previousRevision,(event.config).effectiveSlot)；latestRevision=(event.config).revision；latestEffectiveSlot=(event.config).effectiveSlot |
| 31–33 SipClockAdvanced | currentTick=event.tick |
| 34–37 SipPlanPaused | paused=true；pauseTick=event.tick |
| 38–41 SipPlanResumed | paused=false；put(pauseIntervals,event.pauseTick,event.tick) |
| 42–45 SipDueSlotObserved | put(slotDisposition,event.dueSlot,event.disposition)；inc(observedCount) |
| 46–49 SipPausedDueSlotSkipped | 同上两个 RHS，独立 case |
| 50–52 SipSkippedSlotAdvanced | inc(startCount) |
| 53–57 SipInstallmentTriggered | put(occurrences,(event.occurrence).dueSlot,event.occurrence)；put(occurrenceProgress,(event.occurrence).occurrenceId,"pending")；inc(startCount) |
| 58–60 SipInstallmentPending | put(occurrenceProgress,(event.occurrence).occurrenceId,event.outcome) |
| 61–63 SipInstallmentOutcomeUnknown | 同上一行 RHS，独立 case |
| 64–66 SipInstallmentRecoveryRequired | 同上一行 RHS，独立 case |
| 67–69 SipInstallmentRefundInProgress | 同上一行 RHS，独立 case |
| 70–75 SipInstallmentSucceeded | put(firstTerminals,(event.occurrence).occurrenceId,event.outcome)；put(occurrenceProgress,(event.occurrence).occurrenceId,event.outcome)；put(terminalReceiptBodies,event.receiptId,event.receiptBody)；inc(successTotal) |
| 76–81 SipInstallmentFailed | 前一行前三项；inc(failureTotal) 而非 successTotal |
| 82–86 SipCreateIntentRecorded | createIntent=event.source；put(sipCreateIntents,"original",event.intent)；createIntentDueSlots=((event.intent).request).dueSlots |

不得按本表相同 RHS 合并不同 nominal event 类；`OperationId/AccountId/TxId/TaRequestId/FundShare/PlanId/RevisionId/OccurrenceId` 等类型保留，不通过 alias 合并“去重复”。

### 6.3 curated reference：完整人工完成体（非 raw）

```scala
package net.imadz.domain.entities.behaviors

import net.imadz.common.CommonTypes.Id
import net.imadz.domain.entities.CreditBalanceEntity.{BalanceChanged, CreditBalanceEventHandler, CreditBalanceState}
import net.imadz.domain.values.Money

import java.util.Currency
import net.imadz.domain.entities.CreditBalanceEntity._

object CreditBalanceEventHandler {
  def apply: CreditBalanceEventHandler = (state, event) => event match {
    case BalanceChanged(updateMoney@Money(_, currency), _) =>
      state.copy(accountBalance = updateAccountBalance(state, currency, updateMoney))

    case FundsReserved(transferId, reserveAmount@Money(_, currency)) =>
      state.copy(
        accountBalance = updateAccountBalance(state, currency, reserveAmount.copy(amount = -reserveAmount.amount)),
        reservedAmount = state.reservedAmount + (transferId -> reserveAmount)
      )
    case FundsDeducted(transferId: Id, amount: Money) =>
      state.copy(
        reservedAmount = state.reservedAmount - transferId
      )
    case ReservationReleased(transferId, releaseAmount@Money(_, currency)) =>
      state.copy(
        accountBalance = updateAccountBalance(state, currency, releaseAmount),
        reservedAmount = state.reservedAmount - transferId
      )

    case IncomingCreditsRecorded(transferId, amount) =>
      state.copy(
        incomingCredits = state.incomingCredits + (transferId -> amount)
      )
    case IncomingCreditsCommited(transferId) =>
      state.copy(
        accountBalance= updateAccountBalance(state, state.incomingCredits(transferId).currency, state.incomingCredits(transferId)),
        incomingCredits = state.incomingCredits - transferId
      )
    case IncomingCreditsCanceled(transferId) =>
      state.copy(
        incomingCredits = state.incomingCredits - transferId
      )

  }

  private def updateAccountBalance(state: CreditBalanceState, currency: Currency, updateMoney: Money): Map[String, Money] = {
    val currentBalance = state.accountBalance.getOrElse(currency.getCurrencyCode, Money(BigDecimal(0), currency))
    state.accountBalance + (currency.getCurrencyCode -> (currentBalance + updateMoney).getOrElse(Money(BigDecimal(0), currency)))
  }

  private def defaultMoney(currency: Currency) = {
    Money(BigDecimal(0), currency)
  }

  private def originalMoney(balanceMap: Map[String, Money], currency: Currency): Money = {
    balanceMap.getOrElse(currency.getCurrencyCode, defaultMoney(currency))
  }
}
```

| 构造 | 与 raw 的明确区别 |
|---|---|
| imports | Id、Money、Currency 和 Entity selective + wildcard 混合顺序，不等于 raw 的全局排序/重复 alias，也不是要求目标照搬重复导入 |
| apply 的 7 case | 使用 constructor pattern，Money 绑定、Id 类型 pattern；事件名称与银行 Confirmed/AccountInitialized 不同；无 raw catch-all |
| updateAccountBalance | currentBalance 缺省 Money(BigDecimal(0),currency)，Money `+` 返回值再 getOrElse 零；此错误/缺省语义**只属于参考**，不等于 raw MoneyOps.shift，也不能替换银行 event.available |
| defaultMoney / originalMoney | 前者推断返回类型，后者显式 Map 参数与 Money 返回；真实 body 完成，不是 raw 的 AI_PROMPT/???；原名 `IncomingCreditsCommited` 的拼写不在本轮重命名 |

### 6.4 actual-js → approved-target 的真实 minus/plus

此 hunk 的 minus 来自 §6.1 L7–16；plus 仅应用用户已批准的 AccountInitialized 表达式改写，不借机更换协议或 fallback。它是完整目标文件中的一个构造差异，不是可 apply 到生成器 JS 的补丁。

```diff
--- actual-js/app/example/bankwealth/domain/entities/behaviors/CreditBalanceEventHandler.scala
+++ approved-target/app/example/bankwealth/domain/entities/behaviors/CreditBalanceEventHandler.scala
@@ -7,10 +7,12 @@
 object CreditBalanceEventHandler {
   def apply(state: CreditBalanceState, input: Event): CreditBalanceState = input match {
     case event: AccountInitialized =>
-      val next0: Boolean = true
-      val next1: Map[String, example.bankwealth.domain.values.Money] = state.accountBalance.updated(event.currency, event.amount)
-      state.copy(initialized = next0, accountBalance = next1)
+      state.copy(
+        initialized = true,
+        accountBalance =
+          state.accountBalance.updated(event.currency, event.amount)
+      )
     case event: ReserveFundsConfirmed =>
       val next0: Map[example.bankwealth.domain.values.TxId, example.bankwealth.domain.values.Money] = state.reservedAmount.updated(event.txid, event.amount)
       val next1: Map[String, example.bankwealth.domain.values.Money] = state.accountBalance.updated(event.currency, event.available)
       state.copy(reservedAmount = next0, accountBalance = next1)
```

下列是完整 **approved-target 结构实例的条件展开**：假设 EH-D1 由 Entity owner 提供传统嵌套 state/events/handler alias，EH-D2 选择保留 raw catch-all。展示完整源码与全部银行 RHS，而非宣称这些共享接口已存在或该 fallback 已获银行语义批准。若 EH-D2 改为穷尽匹配，删除最后 catch-all 必须作为一项明确 raw 偏差记录。名义类型搬迁需 serializer/converter owner 同时裁定；当前不能单独实施此文件。

```scala
package example.bankwealth.domain.entities.behaviors

import example.bankwealth.domain.entities.CreditBalanceEntity.AccountInitialized
import example.bankwealth.domain.entities.CreditBalanceEntity.CancelIncomingCreditConfirmed
import example.bankwealth.domain.entities.CreditBalanceEntity.CommitIncomingCreditsConfirmed
import example.bankwealth.domain.entities.CreditBalanceEntity.CreditBalanceEvent
import example.bankwealth.domain.entities.CreditBalanceEntity.CreditBalanceEventHandler
import example.bankwealth.domain.entities.CreditBalanceEntity.CreditBalanceState
import example.bankwealth.domain.entities.CreditBalanceEntity.DeductFundsConfirmed
import example.bankwealth.domain.entities.CreditBalanceEntity.RecordIncomingCreditsConfirmed
import example.bankwealth.domain.entities.CreditBalanceEntity.ReleaseReservedFundsConfirmed
import example.bankwealth.domain.entities.CreditBalanceEntity.ReserveFundsConfirmed

object CreditBalanceEventHandler {
  def apply: CreditBalanceEventHandler = (state, event) => event match {
    case event: AccountInitialized =>
      state.copy(
        initialized = true,
        accountBalance =
          state.accountBalance.updated(event.currency, event.amount)
      )

    case event: ReserveFundsConfirmed =>
      state.copy(
        reservedAmount = state.reservedAmount.updated(event.txid, event.amount),
        accountBalance = state.accountBalance.updated(event.currency, event.available)
      )

    case event: DeductFundsConfirmed =>
      state.copy(
        reservedAmount = state.reservedAmount - event.txid,
        committedOutgoing = state.committedOutgoing.updated(event.txid, event.amount)
      )

    case event: ReleaseReservedFundsConfirmed =>
      state.copy(
        reservedAmount = state.reservedAmount - event.txid,
        compensatedOutgoing = state.compensatedOutgoing.updated(event.txid, event.amount),
        accountBalance = state.accountBalance.updated(event.currency, event.available)
      )

    case event: RecordIncomingCreditsConfirmed =>
      state.copy(incomingCredits = state.incomingCredits.updated(event.txid, event.amount))

    case event: CommitIncomingCreditsConfirmed =>
      state.copy(
        incomingCredits = state.incomingCredits - event.txid,
        committedIncoming = state.committedIncoming.updated(event.txid, event.amount),
        accountBalance = state.accountBalance.updated(event.currency, event.available)
      )

    case event: CancelIncomingCreditConfirmed =>
      state.copy(
        incomingCredits = state.incomingCredits - event.txid,
        compensatedIncoming = state.compensatedIncoming.updated(event.txid, event.amount)
      )

    case _ => state // 默认兜底，或者抛异常
  }
}
```

目标路径为 `<new target>/app/example/bankwealth/domain/entities/behaviors/CreditBalanceEventHandler.scala`；另两份分别为同目录 `FundOrderEventHandler.scala`、`SipPlanEventHandler.scala`，RHS 由 §6.2 逐行保真展开，不用 CreditBalance 算法替代。若选 multi，则三份都在 `<new target>/modules/kernel/src/main/scala/example/bankwealth/domain/entities/behaviors/`，不得两种物理根混作同输入比较。

### 6.5 raw-scala → approved-target 的有限偏差清单

1. 包仍是 domain.entities.behaviors，object/alias-returning apply 与 case 原序默认沿用 raw；不因 JS 当前壳已在目标目录就免除类型所有权迁移。
2. imports 去重/冲突解析为显式质量覆盖，避免原 alias 追加重复；state/family 虽只用于依赖仍按原模型记录，不把长 FQN 反复铺到局部变量。
3. 简单赋值内联 state.copy 是用户明确要求；raw set/put 已能直接 copy，但其 literal 字符串规则不支持从名字推断 Boolean `true`，不能称银行 AccountInitialized 可直接由未适配 raw 同输入发出。
4. money-apply 的两种合同、integer-apply 的 BC 缺口、put-all 求值次数、fallback 策略都不是允许忽略的排版差异，见未决项。
5. helper `???`/prompt、mutation referenceCode/TODO 不“美化”为成功；只有明确外置实现或已审业务 body 才解除相应槽。
6. generated 头是 writer 差异；最终白名单必须逐项指定。不允许忽略 package/import/方法体、压平空白、删除 TODO 或靠同名测试数签收。

## 7. 胶水、纯性与协议保护

| 依赖 / 完整符号 | 所需 API / 来源 / 边界 |
|---|---|
| `<base>.domain.entities.<Entity>.<State/Event/HandlerAlias/EventClass>` | Entity owner 提供真实名义类型与 `(State,Event)=>State` alias；handler 只依赖领域层。不得向 State、领域 params、事件注入 ActorRef |
| `scala.collection.immutable.Map`、Scala case-class `copy` | `updated/+/-/++/--/map/foldLeft/getOrElse` 的顺序与空集合语义须保留；全部 RHS 读 pre-state，一次 copy 后才是新 state |
| `java.lang.Math.addExact/subtractExact`、`java.lang.Long.parseLong` | 当前 signed64 溢出/解析异常不能改成 `+/-` 环绕；SipPlan 具体位置见 §6.2 |
| `<base>.domain.values.<ExactType>.plus/minus` | 当前 JS nominal exact arithmetic；类型、precision/scale/unit 合同由 exact-value 模型决定。银行 project Money 为 unit-decimal、38/2、CNY；不换 minorUnits String 以求 raw 相似 |
| `net.imadz.common.MoneyOps.shift(a:String,b:String,sign:Int):String` | BC raw B15 所需。可见固定 JS scaffold [MoneyOps.scala:12–23](../baseline/js/generators/scaffold-static/app/net/imadz/common/MoneyOps.scala#L12-L23) 为 `(BigInt(a)+BigInt(b)*sign).toString`；这是源码参考，**不是 common-core JAR 包含该方法的证据**。BC scaffold [build.sbt:131](../baseline/bc/scaffold/build.sbt#L131) 声明 common-core 0.2；本轮不检 JAR、不发布、不升级 |
| `ujson.write/ujson.Str` | 只在 Scala 生成期将 literal 转成目标字符串；不应变成目标 handler 的 runtime import |
| `net.imadz.common.application.CommandHandlerReplyingBehavior.CommandHelper` | **不导入纯 handler**。应用的 helpers 位于 application.aggregates.behaviors，必须有 toParam/createFailureReply/createSuccessReply 三方法；不是领域 emit 函数集合 |
| `...CommandHandlerReplyingBehavior.runReplyingPolicy` | 固定 [common 源:16–75](../baseline/common/src/main/scala/net/imadz/common/application/CommandHandlerReplyingBehavior.scala#L16-L75)：toParam→rule.fold；失败 Effect.reply 不 persist；成功 Effect.persist(events).thenReply，helper 在 callback 读**应用事件之后的新 state** |
| `akka.persistence.typed.scaladsl.EventSourcedBehavior` | 当前 Bootstrap 用 eventHandler=CreditBalanceEventHandler.apply。handler 自身不 persist、不 reply、不 publish；函数型 apply/API 改动必须和 aggregate/bootstrap 调用者一次接线 |

`replyWith` 与 `replyWithAndPublish` 不等价：后者 persist 后 thenRun 遍历事件发布 EventStream，再 thenReply；不能以 fold 整洁度为由增删发布或回复次数。Actor 命令 typed replyTo **按应用回复合同条件追加**，不对所有领域事件/参数套 ActorRef；只读 query 不强制生成写命令 helper。

PB 字段号、persistence ID、serializer ID/manifest/bindings、nominal type 身份、幂等/operation ID、溢出及 money 单位均是保护面。若移动 event/state 的 JVM 类名影响现有 serializer，必须由跨制品 owner 给迁移合同，不能宽绑 `scalapb.GeneratedMessage` 或读取旧 journal 来洗绿。

## 8. 后续 JS 实施写集合、唯一装配 owner 与退役

本节全是**第二阶段 proposed 写集合**，本轮不实施。路径均相对 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/`；不是授权改银行 app。

### 8.1 本族独占实现

| 路径 / 状态 | 精确职责 |
|---|---|
| `generators/scala-cqrs-domain/models/entity-behavior.mjs`（proposed） | 显式 E1–E7、StateMutation、Method、FieldDef/TypeRef 合同；逻辑体区分 structured fold 与原始 code slot；不得用整个 content 字符串充当 Model |
| `generators/scala-cqrs-domain/builders/entity-behavior.mjs`（proposed） | owner/alias/state/family、稳定事件/assignment 原序、类型/依赖、source mapping 构建；逐项实现 B01–B23 或已裁定差异；不从故事散文或名称推业务值 |
| `generators/scala-cqrs-domain/templates/entity-behavior.mjs`（proposed） | 依 T01–T10 输出 package/import/object/apply/case/helpers；具名局部值仅用于求值一次/说明顺序；输出不是 String/Any dispatcher |
| `generators/scala-cqrs-domain/entry-event-handler.mjs`（proposed） | **本族唯一文件装配 owner**：完整 handler（头、imports、body、注释、codeMappings、deps、kind）；不让 Rules renderer 或 legacy renderer 再二次写同路径 |
| `test/codegen-parity-event-handler.test.mjs`（proposed） | 只覆盖本族 Model/Builder/Template + 完整文件/来源映射差异；本阶段不创建、不运行 |

建议接口形状是 `buildEntityBehaviorModels(context, shared) → models`、`entityBehaviorTemplate(model, out)`、`eventHandlerEntries(models, footprint, sharedWriter) → entries`，这是待集成者冻结的提案，不是声称现有导出。输入须显式携带 Entity owner/type refs、ordered mutations、RHS 已解析表达式及来源、helpers 的签名/逻辑槽，不能让 Template 反查原树。

### 8.2 集成者独占共享文件，不允许本族并行覆盖

| 当前文件 / 精确区域 | split / move / replace 与调用方 |
|---|---|
| `generators/scala-cqrs-domain/render-domain.mjs` L93–117、125–130 | split replay 与 foldMappings 到本族；L57–92/L118–124 Rules/Params/wrapper 留 invariant owner。wrapperMappings/ruleMappings 不丢；最终移除 EventHandler 旧壳输出，而不是删 Rules wrapper 冒充完成 |
| `generators/scala-cqrs-play-service/generate.mjs` L16–23 | service inherited invariant-dsl 调用拆分后的 Rules + 本族 entry；该文件唯一 owner 为集成者，不能由 event/rule/aggregate 各自整改 |
| `generators/invariant-dsl/produce.mjs`、`generators/scala-cqrs-domain/produce-v2.mjs` | 保留版本 footprint 的不同；接统一 entry，不仅修改银行 layered=true |
| `generators/scala-cqrs-domain/render-expressions.mjs` | valueExpression/literal 提供兼容 adapter，通用 precedence、TypeRef、精确数值规则由共享表达式 owner 管；本族不重写 Rules decision() |
| `generators/scala-cqrs-domain/naming.mjs`、`lib/scala-target/naming.mjs`、`lib/scala-target/model.mjs` | names/type/import/layout/writer 由集成者管理；复用实读的 resolveName/resolveNameSet/resolveArtifactPath/targetData，先补传统单/多 profile 与嵌套 type alias 语义。重复后缀在现 resolver 是拒绝并要求显式 binding，不是自动截断 |
| `generators/scala-cqrs-aggregate-core-v1/build-models.mjs`、`templates/event-handler.mjs`、`templates/expressions.mjs`、`render.mjs` | family2 owner adapt：借鉴严格 fold 模型/直接 copy，不无条件替换其无 external 子集；避免另一套 renderer 继续漂移；不能借 handler 迁移改变 family1 nominal base model |
| `generators/aggregate-dsl/render.mjs`、`emit.mjs` | legacy owner：保持旧入口边界并登记 alias/port 差异，不自动复活或切流；是否将来接统一 entry 单列批准 |
| `src/core/generate.mjs`、`lib/products/generate-cli.mjs`、各 generator.json | 公共注册/账本/回锚 owner。没有本族新增 CLI flag 或手写 ledger/anchors；若需新的 adapter 产品版本由此 owner 裁定 |

**唯一 assembly 约定**：每个 profile × aggregate 的核心文件最终只能有一个 entry，由 `entry-event-handler.mjs` 装配；文件内不能由多个 fragment owner 重复添加 imports/头。共享 `render-domain.mjs` 的初次无行为切分必须由集成者串行做，再交独占新文件。dependOn：`shared-layout-types`、`shared-expression-fold-semantics`、`domain-entity`、`application-protocol`、`aggregate-root`、`bootstrap`、`shared-writer-anchors`；接口/serializer 迁移未决时依赖 `proto-converter`、`event-adapter`、`snapshot-adapter` 的名义身份合同。conflictsWith：invariant-rule / command-helper / aggregate-behavior / family2 owners 的共享原文件写集合。

**退役与来源**：旧 `.domain.<Name>EventHandler` 没有作为永久 facade 保留的目标许可；先列真实调用方，再由 owned-output 流程退役。保留每个 event/assignment 的 document+pointer/sourceOrdinal，重排版后从最终 UTF-8 字节重新定位 spans，fingerprint/ledger/anchors 最后生成。当前 [applyEntries:185–190,246–267](../baseline/js/src/core/generate.mjs#L185-L267) 有 retained 旧输出记录，**不等于会自动删除旧文件**；退役方案必须明确，不能手工 rm 银行目录或靠 final-writer-wins 掩盖重复输出。不新增作者 `@knowledge` 字段。

## 9. 验收 fixture 与精确 CLI 形状（全部未运行）

### 9.1 必需的独立 fixture，不建立第二业务真源

以下路径均为 proposed；本阶段未创建 fixtures/expected，也没有 fresh same-input 输出。

| fixture | 必须观察的分支 / 独立 oracle |
|---|---|
| `docs/codegen-parity/fixtures/event-handler/credit-balance/` | 显式同输入适配成 Scala SystemMetadata/formal bindings 与 JS product request；7 个实际银行 case 的所有 RHS/顺序；AccountInitialized 去 nextN；不把 curated 7 个不同事件映射成它们 |
| `.../fold-operators/` | set 的 Boolean/string/nominal；put/remove；空/非空/重复 key 的 put-all/remove-all；value 求值一次及异常顺序；money 单位/精度；Long max/min 溢出不环绕；混合 collection/scalar 与重复 slot 拒绝策略 |
| `.../raw-slots/` | 无 owner；无 formal；空 assignments；不可解析 param；literal 转义；referenceCode；helper Left/Right无code/Right有code，param noteId/关键字/泛型/无参；raw `???` 不被测试成成功实现 |
| `.../non-bank-cross-types/` | 跨 context 同名类型、嵌套 owner/alias、imports 冲突、single/multi 根、nominal/PB/serializer 身份保护；不在银行应用上试迁移 |

CreditBalance fixture 同时应通过应用依赖闭包观察失败不 persist、成功 event handler 更新 state 后 thenReply 读新余额、一次回复及无意外发布。这些属于未来局部真实行为验证，不以当前文档代替。

### 9.2 公开命令形状与副作用

下面命令**仅供下一阶段批准后**使用。`/tmp/codegen-parity-event-handler/...` 是提议独占新目标，不是当前存在或已获执行许可。fixture/request/options 尚未落盘，不能直接执行。公开 generate-products 不接受 `--artifact event-handler`、`--only` 或 `--dry-run`，故用最小显式输入限制依赖闭包，而不是猜 flag。

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/event-handler/credit-balance/request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-domain-v2 \
  --out /tmp/codegen-parity-event-handler/js-single \
  --options-json /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/event-handler/credit-balance/options.json \
  --plan
```

[generate-cli:66–88,104–145](../baseline/js/lib/products/generate-cli.mjs#L66-L145)：四个路径 flag 必填且唯一，读取 request 及它声明的源文件、options、manifest，内存编译产品再渲染 plan；`--plan` 在 apply 前返回，**不写目标/ledger/anchors**，但并不是“只读目录不做生成”。删去 `--plan` 后写该 out 下的**整个 generator 产物集合**，以及 `truthsrc.ledger.json`、`anchors.json`；由 preflight 决定 KEEP/MERGE/COVER，非事务回滚。此入口自身不进行 sbt/runtime/网络下载/图写入；不能把未检查的完整 project/workshop 命令视为同样无旁路写入。

- 为检查银行实际入口接线，另用同形命令将 `--generator` 明确改为 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-play-service`，out 用独占 `/tmp/codegen-parity-event-handler/js-service`，options 必须是单独的 service fixture：显式 runtimeArtifact 的本地绝对 file URI、SHA 和 externalSourceRoots，不能复用 domain-only options。CLI L114–139 会只读核 JAR 字节及外置 source roots；执行产品全闭包包含 service/build/test/config 等，不是只写 handler。此项冻结供给未核，不运行、下载或 publishLocal。
- family2 同形命令选择 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-aggregate-core-v1` 与其专用 options/request/out；只使用无 external 的 fixture。该命令会计划 family1 kernel、family2 源码、build 和 generated-test，不能用来宣称银行 formal 支持。

Scala 传统链同输入适配优先使用现有 file slots（不是 products 支路）；显式 target 和 ledger，单工程模式。下列合法属性形状来自 CodegenMain L62–82；不同时传 `codegen.system`。用 shell 子作用域确定仓库目录，不靠会话 cwd。

```bash
(
  cd /Users/zhongdj/Workspaces/mad-polaris/backkend-codegen &&
  JAVA_OPTS='-Dcodegen.systemFile=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/event-handler/credit-balance/canonical.json -Dcodegen.systemBindings=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/event-handler/credit-balance/bc-bindings.json -Dcodegen.targetDir=/tmp/codegen-parity-event-handler/bc-single -Dcodegen.ledger=/tmp/codegen-parity-event-handler/bc-single/ledger.json' \
  sbt 'runMain net.imadz.codegen.CodegenMain'
)
```

本命令无 dry-run：读取源码/显式输入/scaffold；可能编译并写 BC target/project 构建缓存、sbt/依赖缓存及启动 JVM 子进程；是否下载取决于预先冻结的供给。CodegenMain 先 prepare/harness，再创建目标、复制 scaffold、逐族写源码/protobuf、release manifest、formal-semantics.json；ledger 路径显式指定，目标 fingerprint/领地写入由 CQRS writer 管。执行前必须单独批准这些写面与供给策略，不能因 target 在 /tmp 就声称只写 /tmp。当前阶段严格不执行此命令。两端适配不能丢字段/排序；BC 对 integer-apply/typed literal/JS exact money 的适配缺口先裁定，不靠旧 normalize 得到假齐。

### 9.3 验收义务与停止点

1. 同等输入完整文件集合对账：所有 package/import/comment/construct/签名/RHS/默认与路径，包含 scope/multi/空列表/代码槽分支，不止 AccountInitialized 摘录；raw、目标、actual-js、curated 分别保存。
2. 按 E/B/T 表逐构造核对；另对 §6 的所有事件和赋值保留顺序，独立 oracle 不调用 renderer 业务函数。
3. 稳定生成两次；一个 state 字段或 fold 行变化时仅合理局部 diff，query/source mapping 指向新 UTF-8 spans；旧路径退役与 nominal/serializer 迁移有显式冲突报告。
4. 实际 JVM 编译/纯 fold/应用回复验证集中到已批准的依赖闭包批末执行；目前没有命名并证实存在的本族行为 spec，不猜 `testOnly` 类名，不以 import-and-call 替代真实 CLI 产物。具体验证命令/供给须随 proposed fixture 落盘后冻结。
5. JS 和 Scala 普通方法目标 CC≤5；6–10 逐方法理由，>10 重构或逐方法审定例外；sealed ADT dispatch 单列原始值。当前 **`not-measured`**，7/32/18 case 不是测量结果。禁止 String/Any 表分发表刷分。普通嵌套目标≤2；具名 helpers 不采用 helper1/nextN 碎片化。
6. 未来初始调度预算：内容生成/比较 5 分钟、依赖闭包 JVM 编译/行为 15 分钟；是停止/汇报预算，不是性能承诺或本轮执行记录。缺输入/API/供给就停止，不启动服务、旧银行全量 workshop 或整仓 CI。

## 10. 具体未决项与 extraSources

| ID | 需裁定的具体内容 / 阻断面 |
|---|---|
| EH-D1 | Entity owner 的真实 nested State/EventFamily/HandlerAlias 名称、应用 Protocol 的仅命令回复拆分、现有 event JVM 类名与 serializer/converter 引用迁移。当前实体只是 alias facade；§6.4 的 `CreditBalanceEvent/CreditBalanceState/CreditBalanceEventHandler` 是传统合同的条件目标，不是假称当前符号存在。阻断最终 imports/API/名义身份冻结 |
| EH-D2 | raw 固定 `case _ => state` 对比 formal/family 无 fallback、curated 无 fallback：是否对目标穷尽已声明事件并拒绝未覆盖，还是按 raw 保留恒等？还须区别“合法空 fold”与“不可解析而退回 TODO state”；不得用后者吞业务变更 |
| EH-D3 | put-all 的 value 在空 key 时是否也须求值一次、异常与重复 key 次序如何保真；formal/family 明确一次，raw/legacy 在 map 回调每 key 求值。集合与 scalar 混合、重复 slot、缺 key/value 在目标的错误规则也需显式；不能静默转成部分成功 |
| EH-D4 | BC raw minorUnits-string currency→Money Map 的 money-apply，与 JS nominal Money.plus/minus、integer-apply、typed literal 不同。如何保真适配或批准独立扩展？common-core 0.2 实际供给是否含所需 API 未检查；不改变 38/2/CNY/Long 溢出身份，不发布库 |
| EH-D5 | helperMethods/referenceCode/AI_PROMPT 的输入载体及外置实现所有权；formal/family 缺 BC helper 槽。raw 有 referenceCode 的 helper 仍 ???，不能擅自改执行语义；是否允许受控直录或 generate-project 捕获，以及方法参数 noteId 的来源都须先定 |
| EH-D6 | 同输入 fixture 的 Scala file adapter 与 JS product adapter 如何表达全部 fold/owner/type/sourceOrdinal；single/multi profile、raw import 重复/空白/头的有限白名单、超限 dispatch 的具名业务组划分尚须冻结；当前无 fresh expected，不签内容齐或行为齐 |

补充来源只记录实际读取的基线外路径与全文 SHA，不复制/修改源文件。当前生产源码仅 `FormalSemantics.scala` 一项；其他为本任务指导文件，catalog 只读取了指定行。完整绝对路径/SHA 列在 [details/event-handler.json](../details/event-handler.json) 的 extraSources/sourcePins 中：

- `/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen/src/main/scala/net/imadz/meta/filesystem/FormalSemantics.scala`：`42369c2847888cad4373572354c314479c57b8697e9596c76d66f48b76a4825e`（只读 DTO 定义 L1–66；指纹是全文件）。
- 两仓已读 AGENTS/CLAUDE、BC MAINLINE/ARCHITECTURE/CORE_INDEX、作者合同、布局标准、清单及指定 APPROVED-PLAN 均作为指导来源单独登记，不把旧指引关于“纯函数/金样/测试通过”的叙述覆盖本次实读源码事实。

**交付边界**：观察到的 Model 字段、Builder 分支、Template 构造、三路线与银行 RHS 已逐项记账；EH-D1–D6 仍未决，fresh output、接口供给、复杂度及行为证据均未取得。本文保存不解除这些阻断，也不授权第二阶段生产改动。
