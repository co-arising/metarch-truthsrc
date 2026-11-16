# invariant-rule：传统 Scala 不变规则的内容级差异规格

## 1. 范围、状态与证据身份

- artifact id / group：`invariant-rule`；传统清单 ordinal：`4`。本文只负责这一制品，不改其他 diff、中央分区或胶水文档。
- 状态：**`decision-required`**。独立规则结构可明确规格化；可执行规则体、错误消息、host 注入及正式入口对 `???` 的拒绝之间仍有具体接口裁定。文档保存不代表实现、编译、行为验证或 parity 通过。
- 固定 HEAD：BC `cc335eb1e0d0fae17bf092fd61b126040196ea70`；JS `bf104e16ab82ef39d7fa416d0997907d18a815ad`。身份以 [baseline/index.json](../baseline/index.json) 的完整源字节和 SHA-256 为准，不以 HEAD 替代工作树字节。
- 依据：[作者合同](../AUTHORING-CONTRACT.md)、[布局标准](../layout-and-style.md)、[批准计划](../../../.rounds/prettify-generated-code-resume-20261115-cgr9lzlk/APPROVED-PLAN.md)。实际完整读取 Scala M/B/T；本轮仅源内容检视，未运行生成器、测试、typecheck、编译、服务或运行库。
- 第一次检查两个交付文件均不存在；创建前再次检查仍不存在。未修改既有十五份 diff。没有真源树批次，故本轮不运行 validate/roundtrip。

### 1.1 四种材料不可混签

| 材料 | 本轮可取得的内容 | 不可据此声称 |
|---|---|---|
| `raw-scala` | 下文全文 M/B/T，以及固定 writer/type/layout 支撑；规则体是禁用逻辑注释和 `???` | 没有新鲜同输入 Scala 生成文件；不得把人工参考当成该模板的实际生成体 |
| `approved-target` | 一规则一顶层 object、`InvariantRule[Event, State, Param]`、纯参数、明确错误/事件结果、正常 imports 和三层布局；保留未实现槽的事实 | 业务缺口未裁定，不能虚构完整银行目标文件或将默认 `true` 当通过 |
| `actual-js` | 已冻结的银行 `CreditBalanceRules.scala` 核心、转发壳、参数与事件构造 helper；下文逐构造账 | 它们不是本轮生成结果；不能推断对应当前全部输入或 runtime 成功 |
| `curated reference` | 手工完成的 Deposit / Withdraw / ReserveFunds 规则 | 不是 raw 模板输出，也不是当前银行 ReserveFunds 的同输入 oracle |

本轮所有输出对照均为**结构性对照，非同输入字节比较**。`raw-scala` 与 `approved-target` 的新鲜完整文件字节目前不存在，不能为满足表格而捏造。

### 1.2 固定全文与关键指纹

下表每个链接都指向完整冻结文件；行号为相应文件的真实行号。其他支撑文件亦通过后文固定链接定位。

| 面 | 固定文件 | bytes | SHA-256 |
|---|---|---:|---|
| M | [InvariantRuleModel.scala L1–22](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/domain/InvariantRuleModel.scala#L1-L21) | 876 | `f88b55bd4f45d64ec7e529e7063b89ddebd328107ec91e93e7942bfb73dd86a5` |
| B | [InvariantRuleBuilder.scala L1–73](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/InvariantRuleBuilder.scala#L1-L72) | 2065 | `6d0f5e29e33fba5b6d8669c0c74577728b50095c7b9a7142b4b5123a97ece0d7` |
| T | [InvariantRuleTemplate.scala L1–90](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/InvariantRuleTemplate.scala#L1-L89) | 2727 | `de5285cf72e959e415420ff0063d7f307b15f99fc06043e729e178314eaefd23` |
| formal renderer | [render-domain.mjs L1–134](../baseline/js/generators/scala-cqrs-domain/render-domain.mjs#L1-L133) | 12461 | `98181f044826dd2e45ec4179f030a2de2a47326601f3af9a153df2d96dc09e43` |
| formal expressions | [render-expressions.mjs L1–116](../baseline/js/generators/scala-cqrs-domain/render-expressions.mjs#L1-L115) | 8839 | `7f4a43a04c6bf600fbdd14d29e7eff1d71a36fc69fd0b1abe09ef9cdcff90343` |
| family M/B | [build-models.mjs L1–249](../baseline/js/generators/scala-cqrs-aggregate-core-v1/build-models.mjs#L1-L248) | 19567 | `a856e3ff09828d6bf802bfe85092c329816fc891adf476a0345393d6c8cc03de` |
| family T | [templates/rules.mjs L1–27](../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/rules.mjs#L1-L26) | 1888 | `0aa6e200c2dbff13175d018c7573bdfd3ff7e096fece1857bfc56edb6ebd43df` |
| legacy renderer | [invariant-dsl/render.mjs](../baseline/js/generators/invariant-dsl/render.mjs#L1-L1459) | 82440 | `fb8a8bd8f67fed203c824eddba5e97668664db9f7ea9d9ce7724bb8ca8d543e3` |
| 银行核心 | [domain/invariant/CreditBalanceRules.scala L1–106](../baseline/actual-js/app/example/bankwealth/domain/invariant/CreditBalanceRules.scala#L1-L105) | 9423 | `03e1a70268cfafcb80e833c3df306dfb9b2f2c50bbec1a3d726af48039c82fa4` |
| 银行转发壳 | [domain/CreditBalanceRules.scala L1–22](../baseline/actual-js/app/example/bankwealth/domain/CreditBalanceRules.scala#L1-L21) | 2437 | `f45512bb16df96379c502fa655187f0a1e385412bfd24df3dfa9f47fe7b22c6f` |
| 银行参数 | [CreditBalanceRuleParams.scala L1–15](../baseline/actual-js/app/example/bankwealth/domain/invariant/params/CreditBalanceRuleParams.scala#L1-L14) | 1253 | `deeca0caf515bcdde8b532c8c7e191c88dfc6676da94f035a04f400e7d5285b7` |
| 手工 Deposit | [DepositRule.scala L1–14](../baseline/curated-scala/net/imadz/domain/invariants/DepositRule.scala#L1-L13) | 643 | `bf8380933a957c9840269934cdc1a191775dc327ef0ad7614253390239604a8f` |

上表字节/SHA 已只读核对 index。生产源未复制或修改；基线外实际读取的控制文档及 SHA 列于 details 的 `extraSources`，不是新增业务真源。

## 2. Scala 调度、变体、路径与基数

真实传统链为 [CodegenMain.scala L175–241](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L175-L241) → [runCommon L170–220](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L170-L220) → [generateDomainLayer L511–574](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L511-L574)。`semanticProductsFile` 的另一路不作为本制品基准。

`domain.invariants.foreach` 按元数据顺序调用 `InvariantRuleBuilder.build(meta, ctx)` 和 `InvariantRuleTemplate.generate(model)`。没有 `formalSemantics`、只读命令或条件数大于零的制品级开关。attribution 为 `ArtifactAttribution("rules", meta.name, "aggregate", referencingFamilies(meta.subject.targetName, ctx))`。它与应用层 `AggregateRules` 族不是同一模板。

| 变体 | 条件 | 预计输出 | 当前证据 |
|---|---|---|---|
| `classic-single` | 传统链；每个 `domain.invariants` 成员；scope 包含该 attribution | `<target>/app/<base-path>/domain/invariant/<resolvedRuleName>.scala`，每元数据一个文件 | 源码 enabled；本轮未 exercised |
| `classic-multi` | 同上且 `multiProject=true` | `<target>/modules/kernel/src/main/scala/<base-path>/domain/invariant/<resolvedRuleName>.scala` | 源码 enabled；本轮未 exercised |
| `empty-invariants` | `domain.invariants` 空 | 本族零文件 | suppressed by empty iteration |
| `scope-excluded` | writer 的 `currentScope.includes(a)` 为 false | 该次调用不写源文件；记账发生在 skip 前 | suppressed；不能称未执行 Builder/Template |
| `empty-conditions` | 元数据存在但 `conditions` 空 | 仍产出 object/apply；无 private error；仍有 prompt/禁用注释/`???` | enabled，非成功空规则 |
| `referenceCode-present/absent` | 每个 condition 的 `referenceCode` 为 Some / None | 分别插入该字符串 / 字面字符串 `true`，都只在禁用注释中 | 内容分支，非两套文件 |

路径依据 [PackageLayout.scala L7–38](../baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala#L7-L38)、[targetModuleOf/writeArtifact L331–412](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L331-L412)。`<base>` 来自 `GeneratorContext.basePackage = s"$rootPackage.$moduleName"`，并非随意使用 JS context 名。单工程是本 diff 的银行比较物理 profile；多模块只单列，不能混比路径。

**命名例外**：[TypeResolverDSL.scala L371–380](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L371-L380) 注释说移除 `Rule`，但真实 [getBaseName L187–224](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L187-L224) 的 suffix 列表没有 `Rule`。所以 `Deposit` → `DepositRule`，`DepositRule` → `DepositRuleRule`。raw 账必须保留这一事实；目标按集中命名避免重复后缀，这是显式质量覆盖，不能声称 raw 已做到。

## 3. Scala M/B/T 全文与字段账

以下是完整源码内容，不是另造的等价伪码；空白展示不替代 §1 指纹。

### 3.1 Model 全文

```scala
package net.imadz.codegen.scaffolding.cqrs.model.domain


import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, TypeRef}

case class InvariantRuleModel(
                              override val selfType: TypeRef,
                              outputType: TypeRef,
                              subjectType: TypeRef,
                              triggerType: TypeRef,
                              superInterface: TypeRef,
                              conditions: Seq[InvariantConditionModel],
                              override val dependencies: Set[TypeRef]
                            ) extends ArtifactModel

case class InvariantConditionModel(
                            name: String,
                            errorCode: String,
                            errorMsg: String,
                            logicDescription: String
                          )
```

| 序号/字段 | 类型、默认值、来源 | 输出消费 / JS 对应差距 |
|---|---|---|
| M1 `selfType` | `override val TypeRef`；无默认；resolver 从 meta.name 推导 | package、object 名、文件路径；formal 当前只有 aggregate 名和字符串路径 |
| M2 `outputType` | `TypeRef`；无默认；resolve(meta.output) | `List[outputType.signature]` 和父接口第一类型实参；formal 固定 `Vector[Event]` |
| M3 `subjectType` | `TypeRef`；无默认；resolve(meta.subject) | apply 第一参类型及 firstLower 名；formal固定 `<Aggregate>State` |
| M4 `triggerType` | `TypeRef`；无默认；resolve(meta.trigger) | apply 第二参类型及 firstLower 名；formal 是装有 state/command/hosts 的 Params，而非这里的独立 Param |
| M5 `superInterface` | `TypeRef`；无默认；framework InvariantRule.copy(typeParams = Seq(output, subject, trigger)) | `extends InvariantRule[E,S,P]`；formal/family Rules object 都未实现该接口 |
| M6 `conditions` | `Seq[InvariantConditionModel]`；无默认，不自动设 Nil | 保留元数据顺序，先错误 val 循环再禁用逻辑循环；formal 的 `c.decisions` 是另一输入结构 |
| M7 `dependencies` | `override val Set[TypeRef]`；无默认 | imports 与 writer deps；formal用输出路径 deps，不是 TypeRef import 集合 |
| C1 `name` | `String`；无默认；c.name 原样 | `private val` 标识符、prompt 名表、禁用 Left 参数；不自动 lowerCamel 或转义 |
| C2 `errorCode` | `String`；无默认；c.errorCode 原样 | `iMadzError` 第一构造实参；不得改银行既有错误码 |
| C3 `errorMsg` | `String`；无默认；c.logic.intent | `iMadzError` 第二构造实参；formal onFalse 只有 errCode，不能凭 errCode 或银行散文猜消息 |
| C4 `logicDescription` | `String`；无默认于 Model；Builder 的兜底为 `"true"` | 明确源码字符串槽，只发射注释；不是 typed predicate AST，不能把字段名理解成普通描述 |

继承面见 [ArtifactModel.scala L5–47](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L5-L47)：`fqn = selfType.packageName + "." + selfType.name`，`registerTo(registry) = registry.register(this)`；`morphisms = Nil`，`noteIds = Nil`。本 Model 未覆盖后二者，没有 condition noteId/sourceOrdinal/业务 body 字段，没有嵌套制品注册覆盖。不可宣称它已有成员级来源账。

子型只有 `InvariantConditionModel`，没有 ADT 分支。两个 case class 都未写 `final`、泛型/型变/上下界、第二参数列表、隐式参数或显式 companion；Scala 编译器自动生成的 case-class 方法不等于模板额外发射的方法。

### 3.2 Builder 全文

```scala
package net.imadz.codegen.scaffolding.cqrs.builder.domain

import net.imadz.codegen.scaffolding.cqrs.model.domain.{
  InvariantRuleModel,
  InvariantConditionModel
}
import net.imadz.codegen.scaffolding.cqrs.{
  GeneratorContext,
  NestedTypeName,
  OwnerEntityName,
  TypeRef,
  TypeResolver
}
import net.imadz.meta._
import net.imadz.codegen.structure.NamingConventions

object InvariantRuleBuilder {
  def build(
      meta: InvariantRuleMetadata,
      ctx: GeneratorContext
  ): InvariantRuleModel = {
    val pkg = ctx.layout.domain.invariants.root
    val selfType = ctx.typeResolver.invariantRule(meta.name)

    // [FIX] Use TypeResolver.resolve to correctly handle Ref types (EntityStateRef, EventFamilyRef)
    val subjectType = ctx.typeResolver.resolve(meta.subject)
    val triggerType = ctx.typeResolver.resolve(meta.trigger)
    val outputType = ctx.typeResolver.resolve(meta.output)

    val baseRuleType = ctx.types.InvariantRule
    val implementedInterface = baseRuleType.copy(typeParams =
      Seq(outputType, subjectType, triggerType)
    )

    val conditions = meta.conditions.map { c =>
      InvariantConditionModel(
        name = c.name,
        errorCode = c.errorCode,
        errorMsg = c.logic.intent,
        // [FIX] 兜底为 "true"，保证编译通过
        logicDescription = c.logic.referenceCode.getOrElse("true")
      )
    }

    // 通过 SymbolTable 查找 subject（State）所属的 Entity
    val entityDeps: Set[TypeRef] =
      ctx.symbolTable.resolve(NestedTypeName(meta.subject.targetName)) match {
        case Some(OwnerEntityName(entityName)) =>
          Set(ctx.typeResolver.entity(entityName))
        case None =>
          Set.empty
      }

    val deps =
      implementedInterface.collectAllDependencies ++ Set(
        ctx.types.iMadzError
      ) ++ entityDeps

    val dependencies = deps.filter(t => t.shouldImport(pkg))

    InvariantRuleModel(
      selfType,
      outputType,
      subjectType,
      triggerType,
      implementedInterface,
      conditions,
      dependencies
    )
  }

}
```

### 3.3 Builder 分支和支撑解析账

| 顺序 / 原行 | 真实规则、RHS 与边界 | 拟移植责任 |
|---|---|---|
| B1 L22–23 | pkg 取 `layout.domain.invariants.root`；selfType 调 invariantRule(meta.name) | Builder消费集中 layout/name resolver；不在模板字符串中修 RuleRule |
| B2 L26–28 | subject → trigger → output 顺序解析；输入定义是 `subject: EntityStateRef`、`trigger: DataType`、`output: EventFamilyRef` | 三个独立 TypeRef，不能把 command/payload/param 合并 |
| B3 L30–33 | 复制 framework 类型并以 **output, subject, trigger** 为泛型次序 | 顺序不可变为 State, Param, Event |
| B4 L35–43 | 每个条件 name/code 原样；errorMsg 取 intent；referenceCode Some 时保留（含空字符串），None 时 `"true"` | raw 兼容槽必须具名保留，正式可执行规格另裁定 |
| B5 L46–52 | SymbolTable 按 subject.targetName 查 owner；Some 加 entity(owner)，None 空集 | 不能根据后缀臆造额外 owner；与 subject 自己的嵌套类型 import 不同 |
| B6 L54–59 | `implementedInterface.collectAllDependencies ++ Set(iMadzError) ++ entityDeps`，再 shouldImport(pkg) | 递归参数依赖与实体 owner 均不可丢；不扫描 logicDescription 追加依赖 |
| B7 L61–69 | 按 Model 七字段位置构造，无注册/写盘/事件生成/异常捕获 | JS只返回结构模型，不持有完整 Scala content |

输入元数据见 [ArchitectMetadata.scala L270–282](../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L270-L282)；`name/description/subject/trigger/output/conditions` 都没有构造默认，description 被本 Builder 忽略。`BusinessLogic(intent, invariants = Nil, referenceCode = None)` 见 [L63–67](../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L63-L67)；其中 invariants 也被忽略。

解析依赖必须保留以下实际分支，不将名称当事实：

1. [TypeResolverDSL.resolve L1115–1145](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L1115-L1145) 有 `MetaType` 与 `MetaRef` 两重载。subject/output 走 Ref delegate，trigger 的静态类型 DataType 走 MetaType；最终都进入 [TypeResolver.resolve L19–90](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala#L19-L90) 的相应分支。
2. EntityStateRef 最终调 `entityState(name)`，真实 RHS 是 `TypeRef(name, s"$entityPkg.$entityName")`，见 [DSL L144–150](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L144-L150)。entityName 为移除末尾 State、再移除 Entity、再加 Entity，见 [Naming L521–522](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L521-L522)。不要沿用 TypeResolver 中“独立 VO”的旧注释。
3. EventFamilyRef / EventRef → resolveNestedType：SymbolTable 有 owner 时按 owner metadata 分 Aggregate / SagaTransactor / DomainEntity / QueryService；取对应包和规范 owner 名；无已识别 metadata 时按 Aggregate、Transactor/Saga、Service/Query 后缀选包，否则 entities；没有 SymbolTable owner 时退 values 包。真实分支见 [TypeResolver L95–149](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala#L95-L149)。
4. trigger 的原始支持：String/Int/Long/Boolean/Unit/Double/BigDecimal；各种已列 MetaRef；StructRef 查 owner，有则 nested，无则 values；CustomType 先 knownFrameworkTypes，递归 typeArgs；未知 CustomType 保留名称和包，但把历史 `net.imadz.domain.values` 改为当前 values 包。元数据 DomainEntity/AggregateRoot/ValueObject 对象也有分支。未实现的 `resolveMetaRef = ???`、末端 `Any` 兜底属于共享解析债，不允许 JS 用 Any 来假装完全支持。
5. [TypeRef L4–52](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4-L52)：name/packageName 必填，typeParams 默认 Nil；fqn 只拼自身包/名；signature 对 `Tuple` + 数字且非空参数使用 `(T1, T2)`，否则 `Name[T...]` 或 name；dependencies 为自身并递归参数；shouldImport 排除空包、当前包、`scala`、`java.lang`。Set 去的是 TypeRef 相等，不保证不同泛型实例的同一 fqn 最终只出现一次。
6. [SymbolTable L4–44](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/SymbolTable.scala#L4-L44) 是具名 owner 映射，resolve=owners.get；构建/合并对重复 nested key 抛 IllegalArgumentException。Builder不吞这些异常。
7. FrameworkTypes 取 `frameworkPackage`，`InvariantRule` / `iMadzError` 的包为 `<frameworkPackage>.common.CommonTypes`，见 [GeneratorContext L264–270](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L264-L270)。模板却写死简名 iMadzError，这也是 TypeRef/import 合同的一部分。

### 3.4 Template 全文

```scala
package net.imadz.codegen.scaffolding.cqrs.template.domain

import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.domain.InvariantRuleModel
import net.imadz.codegen.structure.NamingConventions

import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object InvariantRuleTemplate extends CodeTemplate[InvariantRuleModel] {

  def generate(model: InvariantRuleModel): String = {
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
        ): _*
    )

    // 3. 渲染错误定义
    val errorsCode = model.conditions
      .map { c =>
        s"  private val ${c.name}: iMadzError = iMadzError(\"${c.errorCode}\", \"${c.errorMsg}\")"
      }
      .mkString("\n")

    // 4. 渲染规则检查逻辑
    val logicCode = model.conditions
      .map { c =>
        s"    // if (${c.logicDescription}) Left(${c.name}) // Raw logic injection disabled"
      }
      .mkString("\n    // else ")

    // 5. 参数名
    val stateParamName = NamingConventions.firstLower(model.subjectType.name)
    val triggerParamName = NamingConventions.firstLower(model.triggerType.name)

    // 6. 构建apply方法代码
    val applyMethodCode =
      s"""  def apply($stateParamName: ${model.subjectType.signature}, $triggerParamName: ${model.triggerType.signature}): Either[iMadzError, List[${model.outputType.signature}]] = {
    /*
    >>> AI_PROMPT_START
    Context: Invariant Rule Execution
    Task: Validate conditions and generate events
    Subject: $stateParamName
    Trigger: $triggerParamName
    Defined Conditions: ${model.conditions.map(_.name).mkString(", ")}
    Goal: If all validations pass (logic below), return Right(List(events...)).
    <<< AI_PROMPT_END
    */
    // Logic disabled for referenced variables mismatch
    /*
    $logicCode
    */
    
    // Result
    {
      // TODO: All conditions passed. Generate events.
      ???
    }
  }"""

    // 7. 构建对象定义
    val invariantRuleObj = objectDef(
      name = model.selfType.name,
      extendsClause = model.superInterface.signature,
      body = s"$errorsCode\n\n$applyMethodCode"
    )

    // 8. 构建源文件
    val sourceFile = SourceFile(
      packageDecl = pkgDecl,
      importDecl = importDecl,
      definitions = Seq(invariantRuleObj)
    )

    // 9. 生成代码
    sourceFile.code
  }

  private def firstLower(s: String): String = s.head.toLower + s.tail
}
```

## 4. raw 输出 construct / RHS / 顺序账与目标覆盖

[CodeTemplate L5–6](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/CodeTemplate.scala#L5-L6) 只约束 `M <: ArtifactModel` 和 `generate(model): String`。下表覆盖本 Template 发射的构造，不把 generate 内部局部变量误列为生成的 Scala 成员。

| ID / 顺序 | raw 输出与完整 RHS 规则 | approved-target / 与 JS 的对位 |
|---|---|---|
| T01 package | `package ${selfType.packageName}` | `<base>.domain.invariant`；不沿用 curated 的复数 invariants |
| T02 imports | dependencies → toList → sortBy fqn → map fqn → 去空串、等于自身包、startsWith java.lang；DSL imports 再按字串排序，逐行 `import <fqn>` | 集中 TypeRef/import resolver；保留嵌套 owner 和参数依赖；不靠 domain._ 掩盖缺依赖 |
| T03 容器 | `object ${selfType.name} extends ${superInterface.signature} { ... }` | 每规则一个顶层 object，不是每 aggregate 一个扁平 Rules 巨对象；泛型实参顺序 E,S,P；无父构造实参 |
| T04 错误循环 | 按 conditions 原序，逐项 `private val <name>: iMadzError = iMadzError("<errorCode>", "<errorMsg>")`，换行分隔 | 错误码/消息语义保留；val 使用 lowerCamel，引用同时迁移。原模板对引号/换行没有 escaping，不能冒充安全字符串渲染 |
| T05 方法签名 | public 非 override `def apply(firstLower(subject.name): subject.signature, firstLower(trigger.name): trigger.signature): Either[iMadzError, List[output.signature]]` | 两个纯参数；无 ActorRef、hosts 技术 bundle 或 command 包裹默认；同名参数/保留字/空名称需集中 resolver 拒绝或显式绑定 |
| T06 prompt | 完整多行 `AI_PROMPT_START/END`、Context、Task、Subject、Trigger、Defined Conditions（逗号空格连接 name）、Goal，见全文 | 是 raw 注释，不是执行；是否改为实现端口说明属 D1，不能因“美化”删除未完成事实 |
| T07 逻辑循环 | 每项生成 `// if (<logicDescription>) Left(<name>) // Raw logic injection disabled`，项间 `\n    // else `；整个 logicCode 再放 `/* ... */` 中 | 条件代码只是显式代码字符串债。不能当成已执行 reject-if-true，也不能反向解释为 JS pass-if-true |
| T08 Result body | `// Result` 后额外 `{ // TODO: All conditions passed. Generate events.\n ??? }` | 未实现槽原样记账；绝不能替换成 Right(Nil)、true 或假事件。formal 产品门当前拒绝 `???`，D1 阻断正式接线 |
| T09 结束/字节 | object body 为 errorsCode + 两换行 + applyMethodCode；SourceFile 按 package/import/definitions 以两换行拼接，末尾一换行 | 不使用压平空白比较；最终布局后再定位 byte offsets |
| T10 writer 外壳 | writer 增加 fingerprintHeader 后交 writeTerritorial，并按 attribution 写 ledger/deps；不是 Template 内容 | 来源头差异单列白名单，不能以该白名单忽略包、注释组或 RHS |

DSL 的精确 ObjectDefinition / SourceFile / imports RHS 见 [CodeGenerationDSL.scala L13–22](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L13-L22)、[L60–112](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L60-L112)。Template 末尾 private `firstLower(s)` 未被调用，也不发射；实际 NamingConventions.firstLower 空字符串返回空，否则只降首字母。它不是完整 lowerCamel tokenizer。

**不存在于本模板的构造**：class/trait/case class、嵌套 companion、type alias、var/lazy/implicit val、annotation、自类型、重载、辅助构造器、柯里化/隐式参数、额外泛型声明/上下界、初始化 I/O、事件应用、persist、reply、发布、MANUAL start/end marker。`???` 不是 MANUAL 区，不能假设生成器会保护后续直接手填的业务体。raw apply 一旦被调用会到未实现槽；本轮未调用。

## 5. JS 三条路径：可达性必须按调用而非目录推断

### 5.1 formal 银行路径与 formal domain v1/v2

[generate-cli.registeredProductProducer L92–101](../baseline/js/lib/products/generate-cli.mjs#L92-L101) 以 realpath 选择已导入 producer。银行所对应的 `scala-cqrs-play-service@1` 在 [generate.mjs L16–24](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L16-L24) **直接覆盖** inherited 的 `invariant-dsl`，调用 `renderInvariant(..., true)`；不调用 `invariant-dsl/render.mjs`。

formal domain v1 的 [generate.mjs L1–20](../baseline/js/generators/scala-cqrs-domain/generate.mjs#L1-L20) → [invariant-dsl/produce.mjs L1–6](../baseline/js/generators/invariant-dsl/produce.mjs#L1-L6) → `renderInvariant`（默认 layered=false）。formal domain v2 的 [generate.mjs L1–7](../baseline/js/generators/scala-cqrs-domain-v2/generate.mjs#L1-L7) → [produce-v2 L8–16](../baseline/js/generators/scala-cqrs-domain/produce-v2.mjs#L8-L16) 也调用同一函数且默认 false。版本 footprint 分别为 v1 decisions=3/folds=4；v2 和 service decisions=4/folds=6；不能只按头注 `scala-cqrs-domain:1` 判断所走 profile。

#### formal renderer 全规则分支账

以下行号均指 §1 的 `render-domain.mjs`；该文件全文已读。它同时发 command/event/helper/fold，不能把整个文件分给本制品覆盖。

| 区间 | 输入/分支/完整输出规则 | 拆分结论 |
|---|---|---|
| L1–16 | imports naming、decision/valueExpression、state models/templates；owner 为 context 相同且 owner[0] 等于 aggregate.id；aggregateRows 过滤 reference-layout declarations kind=aggregate；fields 按行输出 signature；valuesPath 递归 nominal/optional/sequence/map | 共用支撑由集成者保留，不随 rules 重写删除 |
| L57–64 | 输入 reference-layout/domain-decision/domain-folds/exact-value-types；每 aggregate 过滤 commands/events；派生 protocol/state/helper/params/core 路径；layered 决定 rules 包 | 当前基数按 aggregate，不是按 invariant metadata |
| L65–68 | params 固定 `.domain.invariant.params`，import domain._；rules layered 时依次 import domain._、RuleParams._、domain.Protocol._；否则 import Protocol._；wrapper 固定 domain | 三个 rules 物理容器的声明、imports 与来源都需归属 |
| L69–82 | 每 command：signature=(state, p, hosts)；layered 时生成 `<Command>Params(state, command, hosts)`；核心 `<Command>(input)` 拆 val state/p/hosts；wrapper 构造 Params 后 FQN 转发。非 layered 直接三参数方法 | 迁纯 Param 并消除永久 wrapper，需要调用方闭包；不是简单移动包 |
| L83–87 | 每 decision 原序：`if (!(decision(predicate))) return`；onFalse.kind=reject 则 `Left(JSON.stringify(errCode))`，否则 `Right(Vector.empty)`；记录 guard 源 span | 顺序、首个失败、succeed-empty 都是业务；不能把非reject当未知实现成功的目标规则 |
| L88–90 | 全部通过则 `Right(<Aggregate>CommandHelpers.emit<Command>(state,p,hosts))`；command scope 覆盖完整方法，guard mappings 共用该 scope | 事件构造应移入纯决策/具名领域计算，不能占用应用 CommandHelper 名义 |
| L93–117 | 同一函数还生成 EventHandler：逐 event match，逐 assignment set/put/remove/put-all/remove-all/integer-apply/money-apply；未知操作抛 TypeError；逐 val nextN 后 state.copy，无 assignment 则 state；维护 fold mappings | 归 event-handler，不由本 artifact 修改；不得因拆分丢弃这些分支或 addExact/subtractExact/plus/minus |
| L118–124 | layered 发核心、Params、wrapper 三条 kind=rules entries；非 layered 发一条 rules entry；deps 按相应 protocol/state/helper/params/core；来源含 aggregate、command、decision | 拟替换为每规则 entry 的最终文件集；不能只改代码而保留旧 path deps |
| L125–132 | 发一个 EventHandler，layered 另发 domain 转发 EventHandler；最后规则 entries 在前再 event entries | 文件组装唯一 owner，禁止本包/事件包各发一遍 |

[naming.mjs L15–31](../baseline/js/generators/scala-cqrs-domain/naming.mjs#L15-L31) 当前 TypeRef 被简化成类型字符串，nominal 为完整 FQN，sequence 为 Vector；`entry` 在 content 前加固定头，`span` 使用 `Buffer.byteLength(header + content.slice(...))`，knowledge key 为 `source:<document>#<pointer>`。这不是 Scala 的 TypeRef/import 模型；重排后必须重新生成 spans，不能复用旧字符偏移。

#### predicate 与事件 RHS 支撑不能在提取时丢掉

`render-expressions.mjs` 全文 L1–116 已读。以下是本制品调用的闭包，不以“双重否定”一条替代所有运算语义：

| 区间 | 真实分支 |
|---|---|
| L3–33 | JSON.stringify 字面量；declaration 无匹配抛 TypeError；exactType 按 nominal ref 查；descriptor 对 ref/member/map-lookup/add/subtract 传播精确类型；nodeType 对 ref/member/integer/decimal/map-lookup/算术分支推导；exactName 为领域值 FQN |
| L34–46 | child 递归；scalar 对 nominal 取 amountMember 或 value；units 对 unit-decimal 提取单位，算术递归；checked 将单位表达式去重，多于一个先 `require(unit0 == unitN, "exact units differ")` 再计算结果 |
| L47–61 | ref→state 或 p；boolean/string/integer(Long.parseLong)/decimal(BigDecimal)；member 加括号；unary text-value/not/exact-positive/is-empty/non-empty/map-keys；未知 unary 抛错 |
| L62–74 | collection-covered 为 right.forall(left.contains)；exact-sufficient 为 map.get(unit).exists(compareSameUnit>=0) 或直接 compareSameUnit；普通整数 add/subtract 用 Math.addExact/subtractExact；精确数逐 checkedAmount，必要时重建 nominal 并先验证单位 |
| L75–86 | and/or/equal/not-equal/less/less-equal/greater/greater-equal；精确比较走 scalar+checked；map-lookup 为直接索引；all-equal 为 forall；map-contains/map-get/contains；未知 binary 抛错 |
| L88–100 | literal 递归 primitive、精确 nominal、record、其它 nominal 包装、optional Some/None、sequence Vector、map Map(k -> v)；未知 carrier 抛错 |
| L102–114 | valueExpression 的 ref 区分 state/event/p；literal 委托上段；host=`hosts.<id>(state,p)`；member/map-get；primitive 算术仍 exact long，非 primitive 走 plus/minus；未知 value op 抛错 |

目标以结构化布尔表达式和优先级表示 `not(not(x))`，只在证明纯布尔语义后消除反向包装。不得对成品文本 regex 删除 `!`；不得移动 require/lookup 使原来短路不求值的分支变成必求值；不得把 exact 运算改 `+`。

### 5.2 legacy：近似 InvariantRule 已存在，但不是 formal 对应实现

- [invariant-dsl/generator.json L1](../baseline/js/generators/invariant-dsl/generator.json#L1) 指向 `emit.mjs`；[emit.mjs L3–9](../baseline/js/generators/invariant-dsl/emit.mjs#L3-L9) 读 spec → 调 `render(spec)` → mkdir/write files；若 outPath 是 `.scala` 另写入口注释文件。[parse.mjs L1–5](../baseline/js/generators/invariant-dsl/parse.mjs#L1-L5) 只是字节透传。
- [run-all.mjs L884–956](../baseline/js/generators/run-all.mjs#L884-L956) 显式登记 runGen("invariant-dsl", aggregates, domain.invariant, ..., mode=dir)。规则筛选为有 invariantRef guard，或 sagaBinding 下有 produces；按 command name 去重；传 rules/allCommands/paramDefs/aggregateRuleRefs/statusEnum/stateGates/stateFields/events/来源。该 legacy 调用证据不能推导 formal 会调用它。
- 已观察的 [render L1085–1154](../baseline/js/generators/invariant-dsl/render.mjs#L1085-L1154) 确有 `<Cmd>Rule extends InvariantRule[E,S,CmdParams]`：portParams 非空生成 class 构造注入，否则 nested object。apply 先 checkAggregate，再 guards；check→`if (!(cond)) err(code,desc)`，succeedEmpty→`if (cond) Right(Nil)`；skip 项不发射；可另加 idempotent；无事件/事件参数失败→`Left(iMadzError("GEN_SKIPPED", ...))`；emitWhen→固定 events ::: 条件 events；否则 listExprOf(events)。这是可执行启发式规则，不是传统模板 `???` 的同义物。
- [L1300–1356](../baseline/js/generators/invariant-dsl/render.mjs#L1300-L1356) 按有 paramDefs 的命令字母序生成嵌套规则，外围为 `<Aggregate>Rules`。包含生成头/knowledge-release、可能 Instant.now import、固定 CommonTypes、Entity 和嵌套成员、VO/Params/MoneyOps/技术 port imports、err/notNull/isMissingRef(String/Any)、checkAggregate、规则、postconditions。
- [L1411–1458](../baseline/js/generators/invariant-dsl/render.mjs#L1411-L1458) Params 按 command 字母序、字段原序，List 默认 List.empty，Option 不附默认；不带应用命令或 ActorRef。它比 formal 的 bundle 更接近纯参数，但仍不是对 M/B/T 的直接复刻。
- [L31–89](../baseline/js/generators/invariant-dsl/render.mjs#L31-L89) 的默认 generated.invariant/DomainEvent/DomainState、Pascal tokenizer、原始类型 mapping、字符串 escDesc 也与 BC 不同。此次对 legacy 做有边界的接线/输出区间检视，**未将其 1459 行启发式业务表审定为可复用算法**。不得移植其中 VO 静态表、工厂事件猜测、sentinel 判定或时间调用来“补齐银行语义”；默认只保留 legacy 路径，不无故复活或改变其消费者。

### 5.3 family：已有结构化 guard 和消双否定，但未接入银行 formal

[aggregate-core generate L11–23](../baseline/js/generators/scala-cqrs-aggregate-core-v1/generate.mjs#L11-L23) 只接收 `scala-cqrs-aggregate-core@1`；[render L15–34](../baseline/js/generators/scala-cqrs-aggregate-core-v1/render.mjs#L15-L34) 经 productionJobs 把 `rulesTemplate` 作为每 aggregate 的 rules job，随后统一 renderJobs。它是另一 registered producer；service 的 override 未调用它。

该 family 的 `build-models.mjs` 已全文读取，规则相关结构与支撑如下，不将 `base/kernel` 误称为 BC InvariantRuleModel：

| 区间 | Model/Builder 实际内容与分支 |
|---|---|
| L1–48 | targetData/name/path/profile/request/reference/expression/kernel/serialization imports；artifactsSpec 同时列 rules/helpers/event/actor/factory/bootstrap/repository；rules 在 domain.invariant/kernel；helpers 在 domain.command；标准名保留；source 校验 document/pointer，ordinals 必须完整从0连续并与 source pointer 对应；sameRefs 精确核对 |
| L50–75 | raw 仅 products/options；options 仅 packages/names/protobuf；新 name role override 与 base names 分开，拒绝错误 kind/重复 override；构建 kernel 一次、serialization 一次；声明 lookup 缺失拒绝；外部 producer 产品不一致或非空都拒绝 |
| L76–118 | 收集命名 reservation、portable 碰撞、标准类型/根包；每 aggregate 派生九种 artifact 和 rule/emit 方法 token；resolveNameSet 后 unused override 拒绝；artifact 字段为 ref/role/kind/module/name/identifier/package/fqn/path/sources/refs/directDeps=[] |
| L120–152 | rowsByRef 校验 kind、唯一、来源一致、全 declarations 覆盖；每 command decision 只有 command/source/decisions；guard 必须含 sourceOrdinal/ruleId/source/predicate/onFalse/dependencies；onFalse 仅 reject(errCode) 或 succeed-empty；表达式解析携带 known presence，依赖等于 predicate refs，逐 guard 更新 known |
| L153–181 | emissions 唯一且 event 属同 aggregate，slots 必须按声明字段全覆盖；valueType 与 producer.type 精确匹配；依赖精确；port 追加 host.inputDependencies；usedDependencies 核闭包；command model 保留 ref/source/base/params/ruleMethod/emitMethod/guards/emissions/sources/directDeps |
| L183–220 | event/assignment 子模型负责纯 fold：ordinal/source、target owner/type、禁止重复 target；set/put/remove/put-all/remove-all/money-apply/integer-apply 的 operand/type/sign/依赖逐分支检查；不是本规则模板需要搬入的状态应用逻辑 |
| L221–247 | setDeps 对 helpers/rules/event/actor 等分别汇总 directDeps/sources/refs；rules 依赖 protocol/state/computations/ruleParams/helpers 及 command 依赖；每 event 须有本地 producer；所有 artifact 路径 portable 唯一、deps 指向实际输出、kernel 不得指 glue；返回冻结的 profile/kernel/serialization/aggregates/artifacts |

`rulesTemplate` 全文（也是当前 family 的完整规则输出算法）：

```javascript
import { templateScope, expressionSyntax } from './expressions.mjs';

export function rulesTemplate(aggregate, model, out) {
  const a=aggregate,b=a.base;
  const scope=templateScope(a.rules,[b.protocol,b.state,a.helpers,{...b.ruleParams,wildcardOnly:true},b.computations],
    [{container:b.protocol,members:[...b.protocol.commands,...b.protocol.events]}, {container:b.ruleParams,members:b.ruleParams.params}]);
  const name=scope.reference, syntax=expressionSyntax(model,{state:'params.state',command:'params.command',hosts:'params.hosts',reference:name});
  const result='Either[String, Vector['+name(b.protocol)+'.Event]]';
  out.append('package '+a.rules.package+'\n\n'+scope.imports.join('\n')+'\n\n');
  out.append('object '+a.rules.identifier+' {\n',a.rules.sources);
  out.append('  def decide(\n    state: '+name(b.state)+',\n    command: '+name(b.protocol)+'.Command,\n    hosts: '+name(b.computations)+'\n  ): '+result+' = command match {\n');
  for(const c of a.commands) out.append('    case value: '+name(c.base)+' => '+c.ruleMethod.identifier+'('+name(c.params)+'(state, value, hosts))\n',[c.source]);
  out.append('  }\n');
  for(const c of a.commands) {
    out.append('\n  def '+c.ruleMethod.identifier+'(params: '+name(c.params)+'): '+result+' = {\n',[c.source]);
    c.guards.forEach((guard,index)=>{
      const p=guard.predicate;
      const failed=p.op==='not'?syntax.predicate(p.argument):'!('+syntax.predicate(p)+')';
      const failure=guard.onFalse.kind==='reject'?'Left('+JSON.stringify(guard.onFalse.errCode)+')':'Right(Vector.empty)';
      out.append('    '+(index?'else if':'if')+' ('+failed+') '+failure+'\n',[guard.source]);
    });
    out.append('    '+(c.guards.length?'else ':'')+'Right('+name(a.helpers)+'.'+c.emitMethod.identifier+'(params.state, params.command, params.hosts))\n',[c.source]);
    out.append('  }\n');
  }
  out.append('}\n');
}
```

顺序账：package/imports → object → `decide` command match（按 a.commands，case typed value→ruleMethod(Params(state,value,hosts))）→ 同序每命令 method → 同序 guards 的 if/else if → 有 guards 加 else、无 guards 直接 Right(helpers.emitMethod(...)) → 结束。`not` 顶层分支取 argument，确实避免 formal 的一层双否定；reject 仍为 String，succeed-empty 仍为 Vector.empty。没有 `extends InvariantRule`、私有 iMadzError 定义或两参数 apply，故不是内容一比一已完成。name/import/source 机制可评估复用，但新 family 的有限 no-external 入门条件不能原样套银行。

## 6. actual-js 银行完整样本与逐方法账

本节以 CreditBalance 的完整已冻结源为样本；**不声称已经逐文件审定 FundOrder/SipPlan 或整个银行的业务行为**。其他输入由 §5 模板循环规则和后续 fixture 门约束。

### 6.1 核心文件完整内容

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

### 6.2 文件组与每个方法的处理结论

| 构造 / 真实行 | 实际 RHS 与保留项 | 目标位置/处理 |
|---|---|---|
| 核心 package/import/object L1–8 | 固定生成头、单数 invariant、三条 import 的现顺序、无父接口的 CreditBalanceRules | 按输入规则拆顶层 object；import 模型计算，不保留扁平 domain._ 依赖 |
| InitializeAccount L9–19 | 三 val → ID → currency → 初始化冲突 → 已初始化空事件 → seed非负 → emitInitializeAccount | 候选 `app/example/bankwealth/domain/invariant/InitializeAccountRule.scala`；规则身份映射 D2 裁定后方可落地 |
| ReserveFunds L20–35 | 三 val → resource/CNY/positive → committed/compensated/reserved 金额一致（单位 require）→ 三个幂等空事件 → sufficient → emitReserveFunds | 候选 `.../domain/invariant/ReserveFundsRule.scala`；禁止将匹配检查移到幂等返回之后 |
| DeductFunds L36–49 | 三 val → resource/CNY/positive → committed 匹配 → committed 空事件 → 不可 compensated → prepared → reserved 匹配 → emitDeductFunds | 候选 `.../domain/invariant/DeductFundsRule.scala`；保留错误码和先后 |
| ReleaseReservedFunds L50–62 | 三 val → resource/CNY/positive → compensated 匹配 → compensated 空事件 → 不可 committed → reserved 匹配 → emitReleaseReservedFunds | 候选 `.../domain/invariant/ReleaseReservedFundsRule.scala`；不能添加并不存在的 prepared 检查 |
| RecordIncomingCredits L63–77 | 三 val → resource/CNY/positive → committed/compensated/incoming 匹配 → 对应三个空事件 → emitRecordIncomingCredits | 候选 `.../domain/invariant/RecordIncomingCreditsRule.scala` |
| CommitIncomingCredits L78–91 | 三 val → resource/CNY/positive → committed 匹配 → committed 空事件 → 不可 compensated → prepared → incoming 匹配 → emitCommitIncomingCredits | 候选 `.../domain/invariant/CommitIncomingCreditsRule.scala` |
| CancelIncomingCredit L92–104 | 三 val → resource/CNY/positive → compensated 匹配 → compensated 空事件 → 不可 committed → incoming 匹配 → emitCancelIncomingCredit | 候选 `.../domain/invariant/CancelIncomingCreditRule.scala`；不能把 Cancel 改 Commit 或制造退款行为 |
| 转发壳全文 L1–21 | 同序七个 PascalCase 方法 `(state: CreditBalanceState, p: <Command>, hosts: CreditBalanceComputations): Either[String,Vector[Event]]`，RHS 全为 `example.bankwealth.domain.invariant.CreditBalanceRules.<Command>(example.bankwealth.domain.invariant.params.CreditBalanceRuleParams.<Command>Params(state,p,hosts))` | 调用方迁到对应 rule 后，owned 输出计划退役 `app/example/bankwealth/domain/CreditBalanceRules.scala`；不永久保留 forwarding 壳 |
| Params 全文 L1–14 | package params / import domain._ / object；同序七个 `final case class <Command>Params(state, command: CreditBalanceProtocol.<Command>, hosts)`；字段顺序固定，无默认 | 纯参数投影字段与目标文件 D3 裁定；不得把 future ActorRef 从 application command 带进来 |

这里的 `.../` 只缩写表格重复目录；七个候选文件的完整公共前缀均为 `app/example/bankwealth/domain/invariant/`，不是任意包层。它们是**按当前七个 command 候选映射**，不是断言 Scala 元数据已有七条同名 invariant。

成功 RHS 的外部闭包已读 [CreditBalanceCommandHelpers.scala L6–20](../baseline/actual-js/app/example/bankwealth/domain/CreditBalanceCommandHelpers.scala#L6-L20)：

| helper | 完整事件列表 RHS（均为 Vector） |
|---|---|
| emitInitializeAccount | `AccountInitialized(p.resource, p.currency, p.amount)` |
| emitReserveFunds | `ReserveFundsConfirmed(p.txid, p.resource, p.amount, "CNY", hosts.BalanceAfterReserveFunds(state, p))` |
| emitDeductFunds | `DeductFundsConfirmed(p.txid, p.resource, p.amount)` |
| emitReleaseReservedFunds | `ReleaseReservedFundsConfirmed(p.txid, p.resource, p.amount, "CNY", hosts.BalanceAfterReleaseReservedFunds(state, p))` |
| emitRecordIncomingCredits | `RecordIncomingCreditsConfirmed(p.txid, p.resource, p.amount)` |
| emitCommitIncomingCredits | `CommitIncomingCreditsConfirmed(p.txid, p.resource, p.amount, "CNY", hosts.BalanceAfterCommitIncomingCredits(state, p))` |
| emitCancelIncomingCredit | `CancelIncomingCreditConfirmed(p.txid, p.resource, p.amount)` |

Computations trait 只有三个 `BalanceAfter*` 抽象方法，参数均 `(state, typed command)`、返回 Money FQN；companion 空。本轮没有读取其手写实现，不能虚构余额公式。迁移必须保留 host 调用时序/次数与事件实参次序；计算 port 的纯性及注入位置属于 D3。

### 6.3 实际 minus / 明确目标 plus

下列 hunk 的 minus 和上下文逐字来自银行核心 L29–35；plus 仅落实已批准的布尔表达式整洁度，不声称完成其余结构/API 迁移，也不是可用于生产生成目录的授权 patch。

```diff
--- actual-js/app/example/bankwealth/domain/invariant/CreditBalanceRules.scala
+++ approved-target-expression/app/example/bankwealth/domain/invariant/CreditBalanceRules.scala
@@ -29,7 +29,7 @@
     if (!((!((state.reservedAmount).contains(p.txid)) || { require(((state.reservedAmount)(p.txid)).currency == (p.amount).currency, "exact units differ"); (((state.reservedAmount)(p.txid)).amount == (p.amount).amount) }))) return Left("LEDGER_RESERVEDAMOUNT_MATCH")
-    if (!(!((state.committedOutgoing).contains(p.txid)))) return Right(Vector.empty)
-    if (!(!((state.compensatedOutgoing).contains(p.txid)))) return Right(Vector.empty)
-    if (!(!((state.reservedAmount).contains(p.txid)))) return Right(Vector.empty)
+    if (state.committedOutgoing.contains(p.txid)) return Right(Vector.empty)
+    if (state.compensatedOutgoing.contains(p.txid)) return Right(Vector.empty)
+    if (state.reservedAmount.contains(p.txid)) return Right(Vector.empty)
     if (!((state.accountBalance).get((p.amount).currency).exists(_.compareSameUnit(p.amount) >= 0))) return Left("LEDGER_SUFFICIENT")
     Right(CreditBalanceCommandHelpers.emitReserveFunds(state, p, hosts))
   }
```

控制流位置保持不变；前置金额一致校验仍先执行，后置余额判断仍在三个幂等返回之后。plus 仍有 Vector/String/旧 helper，故只是可审定的**表达式子对照**，最终一规则一文件的整体差距仍在 §4 / §8。

## 7. curated reference 单列，不替换 raw

手工 Deposit 完整文件如下，原包确为复数 `invariants`、原错误 val 确为大写，不能悄悄写成 raw 已符合目标：

```scala
package net.imadz.domain.invariants

import net.imadz.common.CommonTypes.{InvariantRule, iMadzError}
import net.imadz.domain.entities.CreditBalanceEntity.{BalanceChanged, CreditBalanceEvent, CreditBalanceState}
import net.imadz.domain.values.Money

object DepositRule extends InvariantRule[CreditBalanceEvent, CreditBalanceState, Money] {
  private val ChangeShouldBePositive: iMadzError = iMadzError("60001", "change 需要为正数")

  def apply(state: CreditBalanceState, change: Money): Either[iMadzError, List[CreditBalanceEvent]] =
    if (change.amount <= 0) Left(ChangeShouldBePositive)
    else Right(List(BalanceChanged(change)))
}
```

它有真实纯参数 Money、类型化错误、List 事件和完整 if/else；raw Template 对同样的概念并不会自动生成这个 body。与 actual 银行 ReserveFunds 更不是同一个业务动作。

两份补充手工参考也已全文读：

- [ReserveFundsRule.scala L1–26](../baseline/curated-scala/net/imadz/domain/invariants/ReserveFundsRule.scala#L1-L26)： imports CommonTypes(InvariantRule,Id,iMadzError)、Entity 的 event/state/FundsReserved、TransferValidatorDomainService、Money；object extends `InvariantRule[CreditBalanceEvent,CreditBalanceState,(Id,Money)]`；apply 解构 `(transferId,amount)`，currentBalance 用 `getOrElse(currency.getCurrencyCode, Money(BigDecimal(0),amount.currency))`；validate(transferId,reservedAmount,Some(currentBalance),amount) 的 Right→`Right(List(FundsReserved(...)))`，Left(code=60008)→Right(Nil)，其余 Left 原样传播。没有银行 source 中的 txid/resource/CNY/event 名合同，禁止移花接木。
- [WithdrawRule.scala L1–19](../baseline/curated-scala/net/imadz/domain/invariants/WithdrawRule.scala#L1-L19)： imports 与 Deposit 同组；`NotEnoughBalance = iMadzError("60002", "balance 不足扣减 或 扣减值应该为正数")`；apply 对 accountBalance.get(currencyCode).flatMap(withdrawAmount <= _).getOrElse(false)，true→`Right(List(BalanceChanged(withdrawAmount.copy(amount = -withdrawAmount.amount))))`，false→Left(NotEnoughBalance)。这个 body 不能从 raw 的 `logicDescription` 自动推断。

### 7.1 raw-scala → approved-target 的有限差异

| 面 | 保持 / 覆盖 / 未决 |
|---|---|
| 单数 invariant 包、顶层 object、E/S/P 类型参数、apply 两参、Either[iMadzError,List[E]] | 保持 raw 结构 |
| PascalCase 类型/文件与 lowerCamel 成员，重复 Rule 后缀，冲突与关键字 | 集中命名显式覆盖 raw；不得改业务 ID/errCode |
| imports | 保留 raw 依赖事实与确定次序；实际冲突处理由 shared resolver 合同补足，不能复制 curated wildcard/分组冒称逐字一致 |
| 注释和 `logicDescription` 代码槽 | raw 全量保存；不得默认为可执行，是否使用结构表达式或外置实现由 D1 裁定 |
| `???` 业务实现 | 不捏造；若目标要求可运行，必须提供独立可追溯实现和 oracle；缺口应拒绝 formal 生成 |
| curated 业务体 | 只作已知语义的参考样本；不普遍推广其金额/幂等算法 |

对手工参考做目标布局/成员名覆盖可精确表示为下列**参考适配 hunk**，不是 raw→运行成功的证明：

```diff
--- curated-scala/net/imadz/domain/invariants/DepositRule.scala
+++ approved-target-reference/app/net/imadz/domain/invariant/DepositRule.scala
@@ -1,4 +1,4 @@
-package net.imadz.domain.invariants
+package net.imadz.domain.invariant
 
 import net.imadz.common.CommonTypes.{InvariantRule, iMadzError}
 import net.imadz.domain.entities.CreditBalanceEntity.{BalanceChanged, CreditBalanceEvent, CreditBalanceState}
@@ -7,7 +7,7 @@
 object DepositRule extends InvariantRule[CreditBalanceEvent, CreditBalanceState, Money] {
-  private val ChangeShouldBePositive: iMadzError = iMadzError("60001", "change 需要为正数")
+  private val changeShouldBePositive: iMadzError = iMadzError("60001", "change 需要为正数")
 
   def apply(state: CreditBalanceState, change: Money): Either[iMadzError, List[CreditBalanceEvent]] =
-    if (change.amount <= 0) Left(ChangeShouldBePositive)
+    if (change.amount <= 0) Left(changeShouldBePositive)
     else Right(List(BalanceChanged(change)))
 }
```

## 8. 胶水、错误与副作用合同

### 8.1 真实库接口

[common/CommonTypes.scala L7–17](../baseline/common/src/main/scala/net/imadz/common/CommonTypes.scala#L7-L17) 的相关源码完整定义为：

```scala
final case class iMadzError(code: String, message: String) extends Throwable with CborSerializable

trait InvariantRule[Event, State, Param] {
  def apply(state: State, param: Param): Either[iMadzError, List[Event]]
}
```

完整符号是 `net.imadz.common.CommonTypes.InvariantRule`、`net.imadz.common.CommonTypes.iMadzError`，错误的序列化 marker 为 `net.imadz.common.CborSerializable`。当前 BC scaffold 声明 [build.sbt L127–147](../baseline/bc/scaffold/build.sbt#L127-L147) 的 `"net.imadz" %% "common-core" % "0.2"`（Scala 2.13 对应 `net.imadz:common-core_2.13:0.2`）；这不是 0.2.0 或 0.3.0 的默认批准。scaffold 拷贝本地 CommonTypes/CommandHandler 源的行为也见 CodegenMain L203–226。**源码存在不证明实际消费者 jar 的 API/类来源一致**；需在后续选定供给后核 classpath，不新增 bank 私有副本绕过它。

规则本身不持久化、不发送 ActorRef、不发布事件。业务规则返回事件，state 只由 event application 演进。

### 8.2 应用桥接不可被当前 emit helper 代替

[CommandHandlerReplyingBehavior.scala L16–75](../baseline/common/src/main/scala/net/imadz/common/application/CommandHandlerReplyingBehavior.scala#L16-L75) 的真实合同：

- `CommandHelper[Command,State,Param,Reply]`：`toParam(state,command): Param`；`createFailureReply(param)(error: iMadzError): Reply`；`createSuccessReply(param)(state): Reply`。
- 完整符号 `net.imadz.common.application.CommandHandlerReplyingBehavior.runReplyingPolicy` 接 `(rule,helper)(state,command)` 返回 `RunnablePolicyWithHelper`。
- `replyWith(replyTo)`：先 helper.toParam，后 rule.fold；失败为 `Effect.reply(replyTo)(helper.createFailureReply(param)(error))`，**不 persist**；成功为 `Effect.persist(events).thenReply(replyTo)(helper.createSuccessReply(param))`，thenReply 收到事件应用后的新 state。
- `replyWithAndPublish` 在 persist 后 thenRun 遍历 EventStream.Publish，再 thenReply；与 replyWith **不等价**。不得添加发布。
- 应用 CommandHelper 的目标位置固定 `<base>.application.aggregates.behaviors`，不是本规则目录；它做 command→param/error/state→reply，不是本节的 emit 事件集合。
- 只有声明回复合同的 application Actor command 才条件追加 typed `replyTo: ActorRef[Reply]`。domain Params/Events 永远不因此携带 ActorRef；只读 query 不要求生成写命令 Helper。

当前 domain actor renderer 仍在 [render-actor.mjs L21–25](../baseline/js/generators/scala-cqrs-domain/render-actor.mjs#L21-L25) 用 Rules 的 String/Vector 结果、失败 Effect.none.thenRun 发 Refused、成功 persist.thenRun 发 Accepted(events)。迁移不得将此冒称已是上述新 state reply 合同；相邻 aggregate/behavior/helper 包必须联动，本 diff 不写其生产文件。

## 9. 明确未来 JS 写集合、唯一组装 owner 与退役

**现在只写本 diff 和 details。** 以下均为第二阶段需再次授权的写集合，不代表已经创建或改动。

| 路径（相对 JS 仓） | 处置 / 唯一 owner | 明确内容 |
|---|---|---|
| `generators/scala-cqrs-domain/models/invariant-rule.mjs`（proposed） | 本制品 owner 新建 | 对应 M1–M7/C1–C4；结构及具名 raw-code 槽，不放完整 content；来源/typed executable body 扩展需 D1/D2 审定 |
| `generators/scala-cqrs-domain/builders/invariant-rule.mjs`（proposed） | 本制品 owner 新建 | B1–B7 映射；纯参数、typed deps、错误消息缺失显式拒绝；不复制 legacy 业务表 |
| `generators/scala-cqrs-domain/templates/invariant-rule.mjs`（proposed） | 本制品 owner 新建 | T01–T09、已批准命名/排版覆盖；模板仅负责 syntax；执行 body 不在此猜测 |
| `generators/scala-cqrs-domain/render-domain.mjs` | **集成者唯一组装 owner** | 先只分离不改字节；分离 renderInvariant 的规则与 event-handler；之后委托新 MBT，统一 entries/header/source/order/deps；相邻 command/state/fold 不归本包覆盖 |
| `generators/scala-cqrs-domain/render-expressions.mjs` | shared-expression owner / 集成者串行 | 类型/优先级/negation 表达接口；精确单位、短路和溢出不变；供规则与其他消费者共享 |
| `generators/invariant-dsl/produce.mjs`、`generators/scala-cqrs-domain/produce-v2.mjs` | 集成者 | formal v1/v2 producer 的拆分委托和版本 footprint；不能留下银行仍用旧实现 |
| `generators/scala-cqrs-play-service/generate.mjs` | 集成者 | service-1 override 统一接新规则 producer；原 fold 路由保留，不误改整条 service |
| `generators/scala-cqrs-aggregate-core-v1/build-models.mjs`、`generators/scala-cqrs-aggregate-core-v1/templates/rules.mjs`、`generators/scala-cqrs-aggregate-core-v1/render.mjs` | family owner，需另获并行授权 | 对齐可复用结构/表达接口；不凭其已有 renderer 就切 formal；有限 no-external 合同保留 |
| `lib/scala-target/naming.mjs`、`lib/scala-target/model.mjs` | shared-layout-types owner | TypeRef signature/import、规则 role 与 source name、三层路径/单多模块；本制品只提出接口，不抢改 |
| `generators/scala-cqrs-domain/generator.json`、`generators/scala-cqrs-domain-v2/generator.json`、`generators/scala-cqrs-play-service/generator.json`、`lib/products/generate-cli.mjs`、`lib/products/registry.mjs`、`src/core/product-plan.mjs`、`src/core/generate.mjs` | 集成者，仅在接口/生产声明确需改变时 | 保留公开入口、严格完整产品集、占有权/写盘规则；尤其不得简单删除 `???` 拒绝门 |

复用候选 [resolveName / resolveNameSet / resolveArtifactPath L26–118](../baseline/js/lib/scala-target/naming.mjs#L26-L118) 已有关键词、portable collision、稳定身份和技术后缀检查。它遇重复 affix 是拒绝并要求 explicit binding，**不是** BC getBaseName 的自动剥后缀算法；需固定兼容适配策略。

下游共享依赖：`shared-layout-types`、`shared-expression-rendering`、`shared-writer-anchors`、`domain-entity`、`value-object`、`event-handler`、`application-protocol`、`command-helper`、`aggregate-behavior`、`aggregate-root`；`aggregate-rules-formal` 同名 Rules 容器职责需单列，不能合并盖章。

退役/调用迁移必须成组执行：

1. 将 `domain/CreditBalanceRules.scala` 所有调用迁到目标 rule；覆盖 legacy domain actor、service aggregate behavior 及 family decide 各自实际调用，不做未知调用方的“自动全部替换”。
2. 从 `.domain.invariant.CreditBalanceRules` 拆七条候选 rule 后，不留它和 `.domain.CreditBalanceRules` 两个永久转发壳。
3. Params 由 D3 定义纯参数投影；rule 方法引用 Entity.State/Event；application commands 与 domain Param 分开。现有 `CreditBalanceCommandHelpers` 的事件构造由 domain decision/计算端口承接；应用 Helper 新文件由其 owner 实施。
4. 旧→新 owned 文件计划、consumer imports、编译根、entry deps、manifest 与 anchor 迁移由集成者独占组装。旧文件只有在对应 owned 内容一致且调用方已迁移时退役；保留手写实现和 MANUAL 合并，不能手删生成目录。
5. 保留 `source:<document>#<pointer>` 的作者来源，重建拆分后每方法/每 guard 的 scope/span；多对一/一对多来源真实表达，不新增 @knowledge 作者字段。最终排版字节后再算 fingerprint/anchors。
6. PB 字段号、persistence ID、serializer ID/manifest/绑定、事件名义类型、Money/精度/溢出身份均不在改名范围；不能让 case class→alias 或泛化 serializer 来降低工作量。

## 10. 关键未决项（阻断内容分别列明）

| ID | 需裁定的精确内容 | 不允许的代替方案 |
|---|---|---|
| D1 | raw apply 的 `???` / 注释 referenceCode 与正式可执行 body 的所有权。目标采用结构化 domain-decision + emissions，还是已捕获的纯实现端口？raw 兼容样本在哪个非 runnable fixture 保存？[product-plan L54](../baseline/js/src/core/product-plan.mjs#L54) 直接拒绝 content 中 `???`，故不能原样接正式 CLI | 删除拒绝门、把 None→true 激活、换 Right(Nil)/fake success |
| D2 | BC 一条 InvariantRuleMetadata 与 JS 每命令 guards/emissions 的身份映射、规则名/condition 名、errorMsg 来源和 reject/succeed-empty 的表达。BC 只有 name/code/intent/referenceCode，没有 JS 的完整 onFalse/emit 结构 | 用命令名/errCode 自动补 description，或把注释中 `if(cond) Left` 当相同谓词极性 |
| D3 | 纯 Param 的确切字段、顺序/默认与 host 计算接口。当前 Params 把 state/command/hosts 整包带入；至少三条 CreditBalance 成功事件需外置计算。顶层 object 与需注入实现的 class/port 怎么保持明确业务边界 | domain 依赖应用 Actor command；ActorRef 进入参数/事件；在 object 里 service locator 或虚构余额算法 |
| D4 | String/Vector → iMadzError/List 的调用闭包与错误消息合同；现有 Refused(code)、Accepted(events)、新 state reply 的 mapping 由谁提供。空事件幂等与失败不得混淆 | 更名类型而不改消费者；将 typed errors 全 stringify 或将所有成功回相同空结果 |
| D5 | 实际 common-core 供给坐标、JAR SHA、classpath 与本地 scaffold 同 FQN 的来源优先级；目标所需 RunnablePolicyWithHelper API 是否可用 | 以 sibling 源码替代 JAR 证明、publishLocal、重发/升级 runtime 或增加私有副本 |
| D6 | 标识符/字符串边界：已有 Rule 后缀、条件名称碰撞、参数名称相同、TupleN 参数名、引号/换行/注释终止符，采用拒绝还是 explicit binding/escaping；raw 特例保留在哪里 | 最终代码 regex 清洗、覆盖文件消解冲突、将错误码/业务 ID 跟随源码名重写 |
| D7 | 同输入最小 fixture 的双端正式输入槽与 expected 完整文件集。当前既无新鲜同输入输出，也无获准的 bank→BC InvariantRuleMetadata 映射；先决定单工程 profile，再收集 raw/目标/actual 三份文件 | 拿 curated 或 products 模板冒充传统 runCommon 的同输入结果 |

这些未决项仅阻断相关实施/验收，不阻断本制品的观察文档独立保存。

## 11. 后续 fixture 与验收合同（本轮均未运行）

### 11.1 最小 fixture，均为 proposed，非新业务真源

后续由 fixture owner 在批准后建立 `docs/codegen-parity/fixtures/invariant-rule/`：

1. `credit-balance-reference/`：从明确引用的 curated Deposit/Withdraw/ReserveFunds 语义适配两端输入；每个字段/condition 顺序/错误消息/事件构造和 tuple 参数都能回到原出处，不用银行同名规则替代。
2. `raw-slots/`：有/无 referenceCode、空 conditions、带 Rule 后缀、同名 subject/trigger、嵌套 EventFamilyRef、tuple/custom generic；expected 保留 raw 注释和 `???`，并要求正式 runnable profile 拒绝未实现体。
3. `ordered-guards/`：借用已观察的 CreditBalance ReserveFunds 结构并在 D2/D3 落定后给双端输入；覆盖两个错误同时为真时首错、已提交且金额不符、已补偿且金额一致的空事件、未通过 guard 时 host 不被调用、精确单位不一致与溢出。
4. `import-collision/`：不同 context 同名 VO、nested owner、reserved name、引号/换行描述；以集中 resolver 的批准结果为 expected，不能默默短名覆盖。

预期文件集合必须含规则本身及其真实 Entity/Param/值类型/计算端口/应用 helper 依赖闭包；不准用孤立无法编译的单文件冒充内容对账。主验收比较各完整文件路径、package、imports、全部构造及顺序、RHS/body、来源跨度；只允许明确生成头与平台换行差异，不采用去全部空白 normalize。

### 11.2 真实 scoped CLI 形状及副作用

以下命令只登记，**本阶段不执行**。尖括号项表示尚须批准并存在的隔离输入/输出路径，不是声称已有 fixture。无 `--artifact invariant-rule` 之类未存在的 flag；scope 由最小请求/系统及依赖闭包限定。

正式 JS，当前真实 CLI 的四个必填参数和 `--plan` 见 [generate-cli L66–88](../baseline/js/lib/products/generate-cli.mjs#L66-L88)、[bin/truthsrc.js L184–188](../baseline/js/bin/truthsrc.js#L184-L188)：

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /absolute/approved-fixtures/invariant-rule/request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-domain \
  --out /absolute/new-owned-candidates/invariant-rule-js \
  --options-json /absolute/approved-fixtures/invariant-rule/options.json \
  --plan
```

- 先按选定 manifest 的完整产品版本提供 request；formal v1/v2/family/service 不能互换相同 requirements。只有 D1–D7 相应项获准后，才登记去掉 `--plan` 的写盘运行。
- `--plan` 捕获请求/选项/manifest、内存 compileProductSet、planProductSet 内再编译核对并对每 producer 调两次，返回 prospective entries；不是 runtime/Scala 编译验证，也不提供手写实现捕获。implementationProducers 已明确要求 generate-project 的 profile 不能绕过其捕获门。
- 实写 `applyEntries` 会写该 target 的 source/build/test 等全部 planned entries，以及 `truthsrc.ledger.json`、`anchors.json`，见 [generate.mjs L246–267](../baseline/js/src/core/generate.mjs#L246-L267)。不是只写 rules；MANUAL/owned 冲突必须遵循 writer，且 recheck 不是锁或自动回滚。
- 此 command 形状没有选 graph-export/project tree，已读路径不包含 graph 写入或启动 JVM。不能把结论泛化到 generate-project/run-all；也不能由“新 out”推断所有其他入口无旁路副作用。
- 银行 service 对照须在后续独立预算使用 `--generator .../scala-cqrs-play-service` 和专用 request/options/out。该 profile 还读指定本地 `saga-core_2.13/0.3.0` JAR 并校验 SHA，存在 pipelines 时读 Monarch pins，并核 externalSourceRoots；见 [generate-cli L114–140](../baseline/js/lib/products/generate-cli.mjs#L114-L140)。没有供给就阻断，不下载或发布补绿。

传统 Scala 使用真实 JVM properties，不编造 `CodegenMain --system/--target` 参数。根据 [CodegenMain L62–81](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L62-L81)，显式文件槽形状为（在 BC 仓根，后续集中一次运行）：

```bash
sbt \
  -Dcodegen.systemFile=/absolute/approved-fixtures/invariant-rule/canonical.json \
  -Dcodegen.systemBindings=/absolute/approved-fixtures/invariant-rule/bindings.json \
  -Dcodegen.targetDir=/absolute/new-owned-candidates/invariant-rule-scala \
  -Dcodegen.ledger=/absolute/new-owned-evidence/invariant-rule-scala-ledger.json \
  -Dcodegen.generatorVersion=cc335eb1e0d0fae17bf092fd61b126040196ea70 \
  -Dcodegen.noGit=true \
  "runMain net.imadz.codegen.CodegenMain"
```

- D7 必须先确认该文件 adapter 会产生目标 `domain.invariants`；若只能落 `AggregateRules`，则要使用已明确注册且只含最小依赖闭包的 `-Dcodegen.system=<registered-name>`，不能假设一个未存在的 registry 名。两种输入互斥，不同时传；不使用默认 Examples 或 banking-app。
- 传统 CLI 没有此处证实的 plan/no-write 模式。准备通过后会 mkdir target、复制 scaffold、生成所有最小系统闭包的各层文件/Proto、写 knowledge release manifest，formal 槽还写 formal-semantics.json；多模块还会移动 scaffold 源。ledger 位置必须显式且其 writer 合同需实施前复核，不能依赖未知默认。
- sbt/JVM 可能写 BC 的 target/project 编译缓存和用户依赖缓存、解析或下载依赖；后续必须先固定离线供应和隔离策略，集中授权编译。生成器版本/noGit 属性只阻止 GeneratorVersion 自己探测 Git，不是对 sbt 全链路的无副作用保证，见 [GeneratorVersion L18–61](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorVersion.scala#L18-L61)。本轮未运行任何这些命令。

### 11.3 验收维度与停止点

| 门 | 后续必要证据 | 本轮状态 |
|---|---|---|
| 内容 | 同等输入两端完整文件集合与 §3/§4 的逐字段/construct/RHS 对账；有限覆盖差异独立记录 | not-run；仅源内容检视 |
| 规则语义 | 首错/短路、拒绝不构造事件或调用 host、succeed-empty、不匹配幂等、精确单位/溢出、事件顺序；独立 oracle 不共用 renderer 业务算法 | not-run |
| 应用胶水 | 失败不 persist；成功事件应用后 thenReply 读新 state；只回复一次；replyWith 不发布，replyWithAndPublish 单独核对；纯 Params 无 ActorRef | not-run，依赖相邻包与实际 jar |
| 命名/import/布局 | 三层，单数 invariant，top-level per-rule，lowerCamel 方法/val，无 RuleRule、无无理由 FQN/wrapper，无 domain→application | source contrast；not-measured |
| 复杂度 | 普通 JS/Scala 方法 CC 目标 ≤5；6–10逐方法解释；>10先重构或逐方法批准例外；嵌套目标≤2；固定工具/版本/Scala语法口径 | **not-measured**；不按 guard 数冒充 CC |
| 稳定生成/回锚 | 两次同输入完整字节相同；一个字段/guard 修改产生合理局部 diff；最终 byte offsets 可从原作者位置查询；旧 owned 文件安全退役 | not-run |

初始预算：源生成/文件对照 5 分钟，依赖闭包的集中 JVM 编译/必要行为 15 分钟；这是后续调度停止点，不是性能承诺。超时保存已得证据并停止，不扩为全银行长跑。不新建 String/Any dispatcher 刷 CC，不用测试数量或“所有模板存在”替代内容完成。当前结论仅为 **本制品差异规格已记录，实施仍受 D1–D7 的具体裁定约束**。
