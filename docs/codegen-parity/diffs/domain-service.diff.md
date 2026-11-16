# domain-service：传统 Scala 领域服务对象的内容级差异规格

## 1. 身份、边界与证据状态

- artifact id / group：`domain-service`，清单 ordinal **5**。
- 文档状态：**`decision-required`**。formal 对应项另记 **`missing-counterpart`**；legacy 中存在近似 renderer，不能称整个 JS 仓库没有领域服务代码。
- 依据：[作者合同](../AUTHORING-CONTRACT.md#L1-L73)、[布局与风格](../layout-and-style.md#L16-L83)、[批准计划](../../../.rounds/prettify-generated-code-resume-20261115-cgr9lzlk/APPROVED-PLAN.md#L104-L146)。只提取了 `scala-artifacts.json` 的本行。
- 固定 HEAD：BC `cc335eb1e0d0fae17bf092fd61b126040196ea70`；JS `bf104e16ab82ef39d7fa416d0997907d18a815ad`。引用均指向固定副本，HEAD 不替代工作树字节。
- 本次只做源码内容阅读、索引提取和选定文件 SHA/bytes 对账。没有运行生成器、测试、typecheck、compile、validate、roundtrip、应用、服务或下载；没有 Git 写入。
- 首次及写入前均确认本 diff 和对应 details 不存在；只新建这两个文件，保留其他既有 diff。文档存在不是实现、编译、行为或 parity 通过的证据。

### 1.1 四个证据面，不混签

| 证据面 | 可取得内容 | 本文如何使用 |
|---|---|---|
| `raw-scala` | 完整传统 Model/Builder/Template、共享 DSL 与 writer；没有本次同输入执行产物 | §2 全文和 §3–4 的逐构造规则就是原始基准。`logicCode` 只进入注释，实际方法仍是 `???` |
| `approved-target` | raw 的结构合同叠加已批准三层布局、标识符/import/职责标准 | §6 给出明确目标和真实 minus/plus。未裁定业务体不变成成功实现；尚没有 expected 完整产物字节 |
| `actual-js` | 固定银行 `generated/current` 输出的副本，以及真实 JS renderer | §5 全文展示银行复合文件；它不是 TransferValidator 的同输入输出，也不是本族已实现的证明 |
| `curated-scala` | 人工完成的 `TransferValidatorDomainService.scala` | §4 单列全文与每个分支；不得悄悄用其业务体替换 raw 的注释和 `???` |

**所有跨输入比较均为结构性对照，非同输入字节比较。** 冻结索引的 `executedGenerators=false`、`runtimeExecuted=false` 与本次边界一致。缺少同输入产物不通过编造银行算法补齐。

### 1.2 固定文件身份

完整清单与其余支撑文件指纹见 [baseline/index.json](../baseline/index.json)。下列主证据已按该索引核对原字节；表中路径相对本目录上一级。

| 固定来源 | bytes | SHA-256 |
|---|---:|---|
| `baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/domain/DomainServiceModel.scala` | 851 | `7c08069ebc3b805ffda7dd944ebd2785aaac679bbfc072c98724d1766f51da20` |
| `baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/DomainServiceBuilder.scala` | 1562 | `cec8e30e2929b0d309eada8d8a06e3d75c8d70f861dbfe11110de400cf627f28` |
| `baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/DomainServiceTemplate.scala` | 1712 | `89d8e550a486ee75c5b3179076c080619f57e3e90d12ad080989e080de662584` |
| `baseline/curated-scala/net/imadz/domain/services/TransferValidatorDomainService.scala` | 742 | `c6b0ebb6031cf30d0ee46ddfcbcc755d4801cdf600ae488fc343197292272c85` |
| `baseline/js/generators/service-dsl/emit.mjs` | 10903 | `b9a2989d7e6573747d628b16f9fb31d46abed4a3c2ec37c91d333d1f8844e069` |
| `baseline/js/generators/run-all.mjs` | 117473 | `8e6534b94d13415ff67fc41431939374d28e8077c1a9e61a51b71fe421ae0f62` |
| `baseline/js/generators/scala-cqrs-domain/render-domain.mjs` | 12461 | `98181f044826dd2e45ec4179f030a2de2a47326601f3af9a153df2d96dc09e43` |
| `baseline/js/generators/scala-cqrs-domain-kernel-v1/templates/params.mjs` | 2075 | `24699f49680c3e02cb4116909adfdad5fbce48df80932554916508aba6da2d65` |
| `baseline/js/lib/products/generate-cli.mjs` | 11644 | `4b255346896f8f27534a90ed338d078b568c6f9d5a56a8b80f6e782001dd12f6` |
| `baseline/actual-js/app/example/bankwealth/domain/CreditBalanceCommandHelpers.scala` | 2124 | `2ca13177769ec883420e90770ef16a8cdb68188311c4f31d6777fe6a80342203` |

没有读取基线外的当前实现源码。额外阅读的仓库操作指引 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/AGENTS.md` 以 SHA `8bfd761390a6fc90b09663157f9d35b23c0c58b20c9f6a41dd5698450015d601` 登记在 details 的 `extraSources`，不是实现参考。真源树未改，因此此文档批次不触发真源编辑的 validate/roundtrip 要求。

## 2. Scala 生产链及完整 MBT

### 2.1 调度、基数与物理路径

入口为 [CodegenMain.scala:183–201](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L183-L201) 的传统分支：未选择 `codegen.semanticProductsFile`，先 `prepare`，然后 mkdir/copy scaffold；[231–249](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L231-L249) 决定 `genRoot` 并调用 CQRS。semantic-products 是另路，本文不拿 products 模板作金样。

[CQRSApplicationGenerator.scala:192–220](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L192-L220) 建立 context 后依次生成分层产物；[584–592](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L584-L592) 的实际本族调用为

```scala
domain.services.foreach { meta =>
  val model = DomainServiceBuilder.build(meta, ctx)
  writeArtifact(
    model,
    DomainServiceTemplate.generate(model),
    root,
    Some(ArtifactAttribution("domain-service", meta.name, "global", Nil))
  )
}
```

- 输入为 `system.domain.services`，按 Seq 顺序处理；每个服务候选一个 Scala 文件，不按 method 拆文件。
- 空 services：本族零文件。服务存在但 methods 为空：仍生成继承 marker 的空 object；raw 不自动省略。
- methods 的成功/错误 logic 分支不改变文件基数。没有专门的 enable flag、实体开关或依赖非空开关。
- 模型构建及模板执行之后，writer 仍可能因 scope 或领地策略不写文件；不能把候选数说成实际写入数。
- `kind=domain-service`，`schemaNode=meta.name`，`schemaCategory=global`，`families=Nil`。
- `TypeResolverDSL.domainService` 先 `getBaseName` 再加 `DomainService`，包为 `<base>.domain.services`，见 [415–422](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L415-L422)、[PackageLayout:23–25](../baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala#L23-L25)。
- single：`<target>/app/<base-as-path>/domain/services/<resolvedName>.scala`。
- **multi 的本族仍落 `<target>/app/<base-as-path>/domain/services/<resolvedName>.scala`**：`targetModuleOf` 明文把未登记的 domain-service 交回 `None`，writer 的 multi fallback 是 `app`，不是自动进入 `modules/kernel/src/main/scala`。见 [331–378](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L331-L378)。将它搬入 kernel 是待裁定的物理布局变化，不是 raw 对齐事实。
- 实际 `GeneratorContext.fromSystemMetadata` 固定 root/framework 为 `net.imadz`，module 为 `contextName.getOrElse("codegen")`，见 [280–302](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L280-L302)。[Examples 的 BankingSystem](../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L364) 选择 `banking`，因此候选为 `<target>/app/net/imadz/banking/domain/services/TransferValidatorDomainService.scala`；curated 的 `net.imadz.domain.services` 不是该入口的同路径执行输出。

变体账：`service-object/single` 和 `service-object/multi-root-fallback` 是同一个模板的物理布局变体；均源码可达、此次未 exercised。`empty-services` 为 suppressed；`empty-methods` 为 enabled 的空对象。formal JS 为 missing；legacy `kind=domain` 为 callable/not-wired-to-formal；`kind=port` 为不同职责，不能冒充变体等价。

### 2.2 Model 全文

固定 [DomainServiceModel.scala:1–21](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/domain/DomainServiceModel.scala#L1-L20)。保留原来的排版、字段顺序与代码槽。

```scala
package net.imadz.codegen.scaffolding.cqrs.model.domain


import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

case class DomainServiceModel(
                               override val selfType: TypeRef,
                               superInterface: TypeRef, // e.g. net.imadz.common.CommonTypes.DomainService
                               methods: Seq[DomainServiceMethodModel],
                               override val dependencies: Set[TypeRef]
                             ) extends ArtifactModel

case class DomainServiceMethodModel(
                               name: String,
                               parameters: Seq[FieldDef], // 使用 FieldDef 复用 name: Type 结构
                               returnType: TypeRef,
                               logicCode: String
                             )
```

### 2.3 Builder 全文

固定 [DomainServiceBuilder.scala:1–55](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/DomainServiceBuilder.scala#L1-L54)。`TypeResolver` import 虽未直接使用，也保留为源事实。

```scala
package net.imadz.codegen.scaffolding.cqrs.builder.domain

import net.imadz.codegen.scaffolding.cqrs.model.domain.{
  DomainServiceMethodModel,
  DomainServiceModel
}
import net.imadz.codegen.scaffolding.cqrs.{
  FieldDef,
  GeneratorContext,
  TypeResolver
}
import net.imadz.meta._

object DomainServiceBuilder {

  def build(
      meta: DomainServiceMetadata,
      ctx: GeneratorContext
  ): DomainServiceModel = {
    // 1. Self Type
    val pkg = ctx.layout.domain.services.root
    val selfType = ctx.typeResolver.domainService(meta.name)

    // 2. Super Interface (注入 DomainService)
    val superInterface = ctx.types.DomainService

    // 3. Methods
    val methods = meta.methods.map { m =>
      DomainServiceMethodModel(
        name = m.name,
        parameters = m.parameters.map(p =>
          FieldDef(p.name, ctx.typeResolver.resolve(p.parameterType), noteId = p.noteId, description = p.description)
        ),
        returnType = ctx.typeResolver.resolve(m.returnType),
        logicCode = m.logic.fold(
          err => s"// Error: $err",
          l => l.referenceCode.getOrElse(s"// TODO: ${l.intent}")
        )
      )
    }

    // 4. Dependencies
    val methodDeps = methods.flatMap { m =>
      m.returnType.collectAllDependencies ++ m.parameters.flatMap(
        _.typeRef.collectAllDependencies
      )
    }

    val allDeps = (methodDeps ++ superInterface.collectAllDependencies).toSet
    val dependencies = allDeps.filter(_.shouldImport(pkg))

    DomainServiceModel(selfType, superInterface, methods, dependencies)
  }
}
```

### 2.4 Template 全文

固定 [DomainServiceTemplate.scala:1–57](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/DomainServiceTemplate.scala#L1-L56)。三个重复的 `NamingConventions` import 是生成器源码的实际噪声，不是产物要复制的三条 import。

```scala
package net.imadz.codegen.scaffolding.cqrs.template.domain

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.model.domain.DomainServiceModel

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object DomainServiceTemplate extends CodeTemplate[DomainServiceModel] {

  def generate(model: DomainServiceModel): String = {
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

    // 3. 构建方法代码
    val methodsCode = model.methods
      .map { m =>
        val params = m.parameters
          .map(p => s"${NamingConventions.scalaIdentifier(p.name)}: ${p.typeRef.signature}")
          .mkString(", ")
        s"  def ${m.name}($params): ${m.returnType.signature} = {\n  /*\n    ${m.logicCode}\n    */\n    ???\n  }"
      }
      .mkString("\n\n")

    // 4. 构建对象定义
    val domainServiceObj = objectDef(
      name = model.selfType.name,
      extendsClause = model.superInterface.signature,
      body = methodsCode
    )

    // 5. 构建源文件
    val sourceFile = SourceFile(
      packageDecl = pkgDecl,
      importDecl = importDecl,
      definitions = Seq(domainServiceObj)
    )

    // 6. 生成代码
    sourceFile.code
  }
}
```

## 3. 字段、推导与输出构造账

### 3.1 Model 的每个字段及其依赖

共享类型全文固定在 [TypeSystem.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L1-L85)，基类全文在 [ArtifactModel.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L1-L48)。

| 稳定位置 | 顺序 / 类型 / 默认 | 实际含义及当前 JS 对照 |
|---|---|---|
| `model.selfType` | 1，`TypeRef`，无默认 | 包与对象/文件名的同一来源；legacy 分散在 `pkg/name`，formal 无本族模型 |
| `model.superInterface` | 2，`TypeRef`，无默认 | 恒由 `ctx.types.DomainService` 给出；legacy 可缺失而不输出 extends，不等价 |
| `model.methods` | 3，`Seq[DomainServiceMethodModel]`，无默认 | 保留顺序和重复；无自动去重/按名排序；legacy 默认为空数组 |
| `model.dependencies` | 4，`Set[TypeRef]`，无默认 | 参数、返回值、superInterface 的递归依赖，按当前 package 过滤；不扫描 logicCode |
| `methods[i].name` | 1，`String`，无默认 | 从 `MethodMetadata.name` 原样拷贝；raw 模板不做 method name 的 keyword 转义 |
| `methods[i].parameters` | 2，`Seq[FieldDef]`，无默认 | 保留声明顺序；没有命令专用 replyTo 或状态自动注入 |
| `methods[i].returnType` | 3，`TypeRef`，无默认 | 经 resolver；支持嵌套 typeParams 的签名与依赖 |
| `methods[i].logicCode` | 4，`String`，无默认 | 明确的代码/意图字符串槽，**不是可执行 body**；这是 raw 技术债例外 |
| `parameters[j].name` | `FieldDef` 1，`String` | Builder 拷贝原 name；Template 才以 `scalaIdentifier` 转义参数关键字 |
| `parameters[j].typeRef` | 2，`TypeRef` | `ctx.typeResolver.resolve(parameterType)`；不因 `optional=true` 自动包装 |
| `parameters[j].defaultValue` | 3，`Option[String]=None` | Builder 未赋值，Template 也不输出默认实参；不能把它误写成 `= None` |
| `parameters[j].comment` | 4，`Option[String]=None` | Builder 未赋值，Template 不消费 |
| `parameters[j].noteId` | 5，`Option[String]=None` | Builder 显式传 `p.noteId`，Template 不输出字段锚点 |
| `parameters[j].description` | 6，`String=""` | Builder 显式传描述，Template 不输出 `@param` |
| `TypeRef.name/packageName/typeParams` | 依次 `String/String/Seq[TypeRef]=Nil` | FQN 与 signature 分离，不能用单一 FQN 字符串代替递归类型模型 |
| `ArtifactModel.fqn` | 派生，`selfType.packageName + "." + selfType.name` | 注意与 TypeRef.fqn 的空包分支不是同一个实现 |
| `registerTo(registry)` | 默认 `registry.register(this)` | 此 model 不覆写，不自动注册独立 method artifact |
| `morphisms` / `noteIds` | 继承 `Nil` / `Nil` | 本族未覆写；方法参数 noteId 不等于文件级身份或实际回锚已完成 |

`DomainServiceMethodModel` 不继承 ArtifactModel，没有单独 selfType/dependencies/anchor 字段。两种 case class 都无类级泛型、型变、上下界、嵌套 companion 自定义体、annotation、self-type 或显式辅助构造器。

### 3.2 Builder 逐条规则、未消费输入与失败面

输入定义见 [ArchitectMetadata:304–325](../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L304-L325)、[ParameterMetadata:167–178](../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L167-L178)、[BusinessLogic:63–67](../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L63-L67)。

| 规则 ID / 源行 | RHS / 分支 / 顺序 | 目标要求 |
|---|---|---|
| B01 / 21–22 | 先取 `layout.domain.services.root`；再 resolver(meta.name) | 包与文件路径共用公共 layout，不在模板拼 `.domain.service` |
| B02 / 25 | `ctx.types.DomainService`；无条件 | 完整符号默认为 `net.imadz.common.CommonTypes.DomainService`；必须确认供给，不能假造本地替身 |
| B03 / 28–33 | 遍历 methods；先建 name，再按 parameters 顺序建 FieldDef；传 noteId/description | 不丢字段顺序、名义身份和来源；不增加 ActorRef |
| B04 / 34 | resolver(m.returnType) | 参数与返回类型用相同规则，不能只收集最外层类型 |
| B05a / 35–36 | `Left(err)` → `s"// Error: $err"` | 错误作为槽内容，不在这个 Builder 抛出，也不生成假成功 |
| B05b / 37 | `Right(l)` 且 `referenceCode=Some(code)` → code 原串，包括 `Some("")` | 不 trim、不把空串改成 intent，不执行 code |
| B05c / 37 | `Right(l)` 且 referenceCode=None → `s"// TODO: ${l.intent}"` | `BusinessLogic.invariants` 不消费；不能从 intent 猜算法 |
| B06 / 43–47 | 每方法：returnType.collectAllDependencies 联合各参数递归 dependencies | 顺序只影响构建过程；最终用 Set 表达结构依赖 |
| B07 / 49–50 | 再联合 superInterface 递归依赖，toSet，filter shouldImport(pkg) | 不从 body 文本抓 import；同名冲突与 FQN 重复见 D06 |
| B08 / 52 | positional `DomainServiceModel(selfType, superInterface, methods, dependencies)` | 保持构造字段顺序；函数自身不写文件/ledger |

未消费事实：DomainServiceMetadata.description、MethodMetadata.description/isPrivate、ParameterMetadata.optional/optionalWhen、BusinessLogic.invariants。`isPrivate=true` 仍会变成 public def；optional=true 但 parameterType 未显式 Option 时仍为裸类型。原始槽没有 MANUAL 标记、实现绑定、独立 oracle、错误类型强制或 purity 检查。这些是要记录/裁定的缺口，不是借移植自动补语义的许可。

类型解析委托链是 [TypeResolverDSL:1115](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L1115) → [TypeResolver.scala:19–149](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala#L19-L149)，不是 service Builder 内新造解析器：

- primitives：String/Int/Long/Boolean/Unit/Double 与 BigDecimal 分支；后者包 `scala.math`。
- entity state、event/family、command/family/reply、aggregate/entity/invariant/behavior/repository/application service/query/domain service/VO/controller ref 各交给对应 resolver；EntityBehaviorRef 使用 entities.behaviors。
- StructRef：symbolTable 有 owner 则走 nested resolver，否则 `<base>.domain.values`。
- CustomType：先查 [knownFrameworkTypes](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L68-L113)，命中时保留框架包并递归替换参数；未命中递归保留名称和包，唯旧默认包 `net.imadz.domain.values` 改为当前 values.root。已登记 Either/Option 使用 `scala`，Map/List 使用 `scala.collection.immutable`。
- 泛 MetaRef fallback `resolveMetaRef` 的实际 body 是 `???`；未知 MetaType fallback 为 `TypeRef("Any", "")`。这是源码未完成/过宽兜底，不允许悄悄宣传完整解析或用 Any 洗掉缺类型。
- metadata 对象的 DomainEntity/AggregateRoot/ValueObject 分支回转为相应 ref。nested resolver 区分 aggregate、saga、entity、query owner；无精确 metadata 时按 owner 后缀选择应用/领域包，无 symbol owner 时回退 values。跨 owner imports 不能按文件夹猜。

共享 `TypeRef.signature`：名字以 Tuple 开头、后续字符均为数字且 typeParams 非空时发 `(T1, T2, ...)`，并未核 arity 或 package；否则非空 typeParams 发 `Name[...]`，空则 name。`collectAllDependencies = Set(this) ++ typeParams.flatMap(...)`。`shouldImport` 对空包、同包、精确 `scala`、精确 `java.lang` 返回 false，其余 true。Template 后面还有较宽的 `startsWith("java.lang")` 排除，二者不能混为一条规则。

命名共享规则见 [NamingConventions:128](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L128)、[171–224](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L171-L224)：`getBaseName` 依固定列表逐次 strip suffix，剥空时返回最后非空值；不自动 PascalCase、不循环到固定点。列表顺序为 Aggregate、Controller、Entity、DomainService、Service、Factory、Behavior、Behaviors、RepositoryImpl、Policy、Handler、Adapter、Converter、Strategy、Bootstrap、SagaTransactionRepository、SagaTransactor、SagaTransaction、Repository、Query、Participant、Participant、Event、State、Context。再追加 DomainService。参数关键字集合命中才包反引号。目标统一 CamelCase/碰撞检查是已批准叠加，不可误说 raw 已完全实现。

### 3.3 从上到下的全部 emitted constructs / RHS

共享 DSL 的完整源码和具体构造见 [CodeGenerationDSL:13–22](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L13-L22)、[60–112](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L60-L112)。

| 构造 ID / 位置 | raw emitted 内容和 RHS | approved-target / 现存差距 |
|---|---|---|
| T01 / Template 15 | `package ${model.selfType.packageName}` | 保留 domain.services；业务根只 domain/application/infrastructure |
| T02 / 18–27 | dependencies.toList 按 fqn 排序，map fqn，排除空串、等于 self 包、以 java.lang 开头者；DSL ImportDeclaration 再排序后每行 `import ...` | A 默认保留此顺序；正常引用用简名。Set[TypeRef] 去重不等于 fqn 去重：不同泛型实例可能留下同 FQN import；目标稳定去重/冲突处理由 shared owner 裁定并记录 |
| T03 / SourceFile | package/import/object 三段之间 `\n\n`，即使 import 字串为空也保留段；结尾一个 `\n` | 禁止通过全空白 normalize 规避比较 |
| T04 / 40–44 | 单一 `object selfType.name extends superInterface.signature { ... }` | 不是 trait/class、无 @Singleton/@Inject、无 ctor 参数、无父构造实参、无 with、无 self-type |
| T05 / 30–37 | 对每个 method 原顺序生成一个 public def；重名不检查，可能形成 overload 或冲突 | 没有 private/override/final/implicit；不额外合成 helper、apply、执行入口 |
| T06 / 32–35 | 唯一普通参数列表；各项 `scalaIdentifier(p.name): p.typeRef.signature`，以 `, ` 分隔；零参数仍 `()` | 没有 curried/implicit 列表、默认值、varargs、by-name；参数/返回类型可含泛型，但 def 自身无类型参数 |
| T07 / 35 | method 名原样，返回类型 `m.returnType.signature`；接 ` = {` | 目标 lowerCamelCase/合法标识符需 name resolver；禁止换回稳定业务 ID |
| T08 / 35 | 完整 RHS 为换行 `  /*\n    ${m.logicCode}\n    */\n    ???\n  }` | logicCode 注释不是实现；`???` 是 Scala Predef 的未实现异常槽。code 多行时后续行不自动缩进，含 `*/` 的槽安全策略待裁定 |
| T09 / 37 | methods 以 `\n\n` 连接；无 methods 时 body 空串 | 不增加业务假实现或空成功 |
| T10 / DSL 69,83 | 对象闭括号，SourceFile 末尾换行 | writer 的来源头独立于模板 |
| T11 / writer | `fingerprintHeader + content`；无 release 一行 `// @generated by CodegenMain:${GeneratorVersion.value}`，有 release 再加 knowledge-release | 不把 legacy 硬编码 rules_domain_gen 日期和 1.0.0 当真实版本 |

此输出**没有** type alias、val/var/lazy val、annotation、嵌套 class/trait/object、companion、初始化语句、主/辅助构造器、继承泛型专用槽、抽象声明或 MANUAL 段。`logicCode` 文本能提及这些词不表示生成器真的把它们作为可执行构造发射。

writer 后置流程见 [379–424](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L379-L424)、[461–505](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L461-L505)：先按 dependencies 经 symbolTable 归宿主名、排序，record ledger 和 morphisms，再检查 scope；拼指纹后按领地 ADD/COVER/MERGE/KEEP 写。冻结已有路径拒写；无指纹手写文件默认 KEEP；`codegen.migrate` 可强制覆盖，但本规格不允许使用。raw 本族没有 MANUAL 块，人工把 `???` 填掉后仍留指纹并不自动获得保护。当前生成体 noteIds/morphisms 默认空，本族也不传 knowledgeKeys，不能声称方法/参数映射闭环已具备。

## 4. 人工参考与 raw 业务槽严格分离

固定 [TransferValidatorDomainService.scala:1–18](../baseline/curated-scala/net/imadz/domain/services/TransferValidatorDomainService.scala#L1-L17) 的完整内容为

```scala
package net.imadz.domain.services

import net.imadz.common.CommonTypes.{DomainService, Id, iMadzError}
import net.imadz.domain.values.Money

object TransferValidatorDomainService extends DomainService {
  def validate(transferId: Id, reservedAmount: Map[Id, Money], fromBalance: Option[Money], transferAmount: Money): Either[iMadzError, Unit] = {
    if (reservedAmount.contains(transferId)) Left(iMadzError("60008", "Already reserved"))
    else if (fromBalance.forall(_.amount < transferAmount.amount)) {
      Left(iMadzError("60003", "Insufficient balance for transfer"))
    } else if (transferAmount.amount <= BigDecimal(0)) {
      Left(iMadzError("60004", "Transfer amount must be positive"))
    } else {
      Right(())
    }
  }
}
```

| 参考构造 | 精确内容/顺序 | 与 raw 的区别 |
|---|---|---|
| C01 package/import | `net.imadz.domain.services`；CommonTypes 三符号组导入后 Money | raw Examples base 为 net.imadz.banking；raw 是逐 FQN import，还会由 Map 类型得到 immutable.Map import；没有同字节结论 |
| C02 object | `TransferValidatorDomainService extends DomainService` | 与 raw 的对象/marker 结构相同 |
| C03 方法签名 | validate；transferId、reservedAmount、fromBalance、transferAmount；Either[iMadzError, Unit] | 参数顺序和容器/名义类型不可合并或替换 |
| C04 首分支 | reservedAmount.contains(transferId) → Left(60008, Already reserved) | 已完成的领域拒绝，不是 throw 或持久化 |
| C05 次分支 | fromBalance.forall(_.amount < transferAmount.amount) → Left(60003, Insufficient balance for transfer) | None 时 forall 为 true；不是默认零余额；先于正金额检查 |
| C06 第三分支 | transferAmount.amount <= BigDecimal(0) → Left(60004, Transfer amount must be positive) | 保留 BigDecimal 和比较，不用 Double |
| C07 else | Right(()) | 仅通过上述分支才成功，无写状态/发事件/I/O/时间/随机数 |

[Examples.scala:57](../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L57) 的真实 `referenceCode` 则是下面这一个字符串；Builder 会原样放进注释，仍发 `???`：

```scala
if (reservedAmount.contains(transferId)) Left(DuplicateReservationError) else if (transferAmount.amount <= BigDecimal(0)) Left(InvalidTransferAmountError) else if (fromBalance.forall(_.amount < transferAmount.amount)) Left(InsufficientBalanceError) else Right(())
```

这与 curated 的**错误表示和校验优先级都不同**：raw referenceCode 在余额之前查金额；curated 在金额之前查余额。`fromBalance=None` 且金额非正时会暴露优先级差异。上述三个 Error 标识符在本族 Builder 没有依赖注册，不能猜测其定义并直接解注释执行。业务体采用哪一个、如何提供外置实现/逐方法独立测试，见 D02。不能将 curated 的完成状态扩散为所有服务的默认实现。

## 5. JS 的真实路线、四层差距及银行现存文件

### 5.1 路线账：依据调用，不依据目录名

| lane | 实读路径/符号 | 调用和 disposition |
|---|---|---|
| legacy 近似 object | [service-dsl/emit.mjs:176–204](../baseline/js/generators/service-dsl/emit.mjs#L176-L204) `emitDomainService`；[270–294](../baseline/js/generators/service-dsl/emit.mjs#L270-L294) `kind === "domain"` | CLI 可调用；`adapt`。它已有 object、可选 extends、logic 注释和 ???，不是完全缺模板 |
| legacy 默认/兄弟职责 | 同文件 33–88 application、96–170 query、206–268 port | 与本族共用一物理文件；不全文件覆盖。query/application 的 @Inject、Future/MANUAL/AI_PROMPT 不是 domain-service 构造 |
| legacy 当前 run-all 接线 | [run-all:69](../baseline/js/generators/run-all.mjs#L69)、[1781–1792](../baseline/js/generators/run-all.mjs#L1781-L1792) | `canonical.domainServices || []` 传 **kind:"port"**，不是 kind:"domain"；`adapt` 的是端口旁路，不能直接换成 object |
| legacy binding 入口 | [parse.mjs:1–5](../baseline/js/generators/service-dsl/parse.mjs#L1-L5)、[generator.json:1](../baseline/js/generators/service-dsl/generator.json#L1) | parse 只是把 binding 文件原字节写到 spec；manifest entrypoint=emit.mjs。注释中的“1:1 restoration”不是验证结果 |
| formal domain v1 | [scala-cqrs-domain/generate.mjs:1–20](../baseline/js/generators/scala-cqrs-domain/generate.mjs#L1-L20) `producerRegistry` | 只注册 aggregate/command/invariant/valueobject/proto/converter；没有 service-dsl |
| formal domain v2 | [produce-v2.mjs:10–17](../baseline/js/generators/scala-cqrs-domain/produce-v2.mjs#L10-L17) | command-dsl → renderCommand；仍未调用 emitDomainService |
| formal 银行兼容 Play | [play-service/generate:16–24,59–70](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L16-L70) → [createEffectRegistry:6–26](../baseline/js/generators/scala-cqrs-application/produce-effect.mjs#L6-L26) → [applicationRegistry:17–30](../baseline/js/generators/scala-cqrs-application/produce.mjs#L17-L30) | version=2 的 applicationRegistry 把 command-dsl 接至 renderCommand；Play 只替换 aggregate/invariant 的分层实现，保留 command renderer。这是 Computations/emit helper 的 formal 来源链；**没有传统独立服务 MBT** |
| family domain-kernel@1 | [generate:12–26](../baseline/js/generators/scala-cqrs-domain-kernel-v1/generate.mjs#L12-L26)、[build-models:271–310](../baseline/js/generators/scala-cqrs-domain-kernel-v1/build-models.mjs#L271-L310)、[render:18–47](../baseline/js/generators/scala-cqrs-domain-kernel-v1/render.mjs#L18-L47) | family 是显式注册可选 profile；输出 computations port，不是 DomainService object。`not-wired` 表示未接本族，不表示 family 不可调用 |
| formal 公共入口 | [generate-cli:66–101](../baseline/js/lib/products/generate-cli.mjs#L66-L101) `registeredProductProducer` | 根据 realpath allowlist 选 shipped producer；列表中没有 service-dsl。不能把 legacy 目录作为 `generate-products --generator` 参数后声称 formal 支持 |

冻结 actual-js 索引中没有 `domain/services/*DomainService.scala` 对应文件；对固定 JS generators、products 和 actual-js 的 `DomainService|domainService|domain-service|domainServices` 源码检索，命中主要为上述 legacy 与注释。**该观察只说明所读路线和冻结文件集，未编译作者树，也不宣称银行业务没有任何领域服务语义。**

### 5.2 legacy object 分支的全部规则

[emit.mjs:14–26](../baseline/js/generators/service-dsl/emit.mjs#L14-L26) 先读取 JSON spec；创建输出目录；`pkg=spec.package || "net.imadz.metarch.application"`，`name=spec.name`，`kind=spec.kind || "application"`。`scalaId(s)=s`，不转义任何关键字。

| 层 | 真实当前内容 | 差距及动作 |
|---|---|---|
| Model | loose spec；package/name/superInterface 字串，dependencies[].fqn，methods[].parameters[].typeRef 字串、returnType 字串、logicCode 字串 | 没有 selfType/递归 TypeRef/FieldDef 完整结构；保留 logicCode 单槽，不扩散成整个 content 的 Model |
| Builder | 没有本族独立 Builder；parse 原样复制 spec，renderer 自己取默认和拼签名 | 缺 ctx、命名、类型解析、logic.fold、递归依赖收集、元数据来源；新增对应结构化 Builder |
| Import | `(spec.dependencies || []).map(d=>d.fqn).filter(Boolean).sort().filter(p=>p && p!==pkg && !p.startsWith("java.lang"))` | 依赖完全相信调用者；不按 typeParams 收集；不去重；没有 scope/type 冲突解决 |
| Methods | `(spec.methods || [])` 原序；parameters 默认为 []；`${scalaId(p.name)}: ${p.typeRef}`；m.name/returnType 原串 | 单普通列表、无默认/implicit/curried/泛型方法，近似 raw，但类型信息/转义已失去 |
| Body | `/* ${m.logicCode || ""} */` 后 `???` | 缺 raw Left/Error 与 None/TODO 推导；空/falsy 行为不等价于 Scala Option；仍不能将 ??? 填成成功 |
| Object | superInterface truthy 才 extends；object name 不做命名 | raw 恒继承 DomainService；完整 technical suffix / PascalCase 应在 Builder 决定 |
| Source | 固定两行 rules_domain_gen 日期和 knowledge-release 1.0.0；package、imports、object；尾换行 | 假定的旧来源头不应保留为新供给身份，交唯一 writer；无 annotation、constructor、alias、val、companion、MANUAL |
| Writer | domain 分支设置 `${name}.scala` 后 `writeFileSync(join(outDir,fileName),output)` | 直接写，无 shared apply/ledger/anchor/所有权；只 port 对 `.scala` 输出参数有特殊处理，domain 不能用该契约 |

### 5.3 legacy port 不是 raw DomainService 的替身

[run-all:405–440](../baseline/js/generators/run-all.mjs#L405-L440) 的 runGen 先生成临时 spec，用 `execSync(node emit...)` 子进程执行；single 输出路径来自传给 runGen 的包。因此该调用实际文件位于 `<out>/app/<base>/domain/service/<spec.name>.scala`。spec.package 却可取 ds.fq 的包；它不同于 runGen 的 `${basePkg}.domain.service` 时存在文件路径/声明包偏离，不能只修一端。

实际 spec 拷贝规则：kind=port；package=ds.fq 去掉末段或 singular fallback；name=ds.fq 末段或 ds.name；传 fq、zh||""、testRef||null、valuesPkg=`<base>.domain.values`、methods||[]、bridge||null。emitPort 不使用 testRef 作为测试实现。

`emitPort` 全 construct/branch 账：

1. valuesPkg 有固定 metarch fallback；BUILTIN 集合为 List/Seq/Set/Map/Option/String/Int/Long/Boolean/Double/Float/Byte/Char/Short/Unit/Any/Nothing/BigDecimal。
2. `parseSig` 用 `^def\s+(\w+)\((.*)\):\s*(.+)$` 匹配，不匹配抛 `port method sig unparseable`；参数按逗号分割，按冒号拆名/型；零参数为空数组。它不是递归 Scala 参数/类型 parser，不能代替 TypeRef。
3. 对每个参数型和返回型按大写 token 正则取类型；first-use 顺序、seen Set 去重；内建略过；Js 前缀统一导入 `play.api.libs.json.{JsArray, JsValue}`，其余假定来自 valuesPkg。
4. 输出旧两行来源头、package、imports、包含 name/spec.zh 的 Javadoc、`trait name`；每方法发 `/** md.zh */` 与原 sig，无 RHS。
5. 仅 `spec.bridge && spec.bridge.fq && spec.bridge.target` 时加 bridge：类名取 bridge.fq 最后一段；**仍在同一文件/包**；object extends port trait；每个 override 原参数/返回型，RHS 是 `spec.bridge.target.method(argNames...)`，不验证 target 纯度或供给。
6. bridge.fq 的包不会生成第二文件；没有依赖注入、actor、persist/reply；JS main 的 port+outDir.endsWith(".scala") 直接写该文件并退出，其余走目录 writer。

这些构造分别属于端口合同、可选桥和 writer，而 raw 仅有 marker object 与未实现方法。不能把 port 方法默认实现成 `???`、把 bridge.target 替成新单例，或把 Play JSON 依赖带进新的纯领域服务来凑对应。其未来分类/接口处置见 D04。

### 5.4 actual-js 完整银行文件与逐构造账

固定 [CreditBalanceCommandHelpers.scala:1–22](../baseline/actual-js/app/example/bankwealth/domain/CreditBalanceCommandHelpers.scala#L1-L21)，这里只作为近邻职责/混合文件的实物证据。

```scala
// @generated by truthsrc scala-cqrs-domain:1
package example.bankwealth.domain

import CreditBalanceProtocol._

trait CreditBalanceComputations {
  def BalanceAfterCommitIncomingCredits(state: CreditBalanceState, p: CommitIncomingCredits): example.bankwealth.domain.values.Money
  def BalanceAfterReleaseReservedFunds(state: CreditBalanceState, p: ReleaseReservedFunds): example.bankwealth.domain.values.Money
  def BalanceAfterReserveFunds(state: CreditBalanceState, p: ReserveFunds): example.bankwealth.domain.values.Money
}
object CreditBalanceComputations {
}
object CreditBalanceCommandHelpers {
  def emitInitializeAccount(state: CreditBalanceState, p: InitializeAccount, hosts: CreditBalanceComputations): Vector[Event] = Vector(AccountInitialized(p.resource, p.currency, p.amount))
  def emitReserveFunds(state: CreditBalanceState, p: ReserveFunds, hosts: CreditBalanceComputations): Vector[Event] = Vector(ReserveFundsConfirmed(p.txid, p.resource, p.amount, "CNY", hosts.BalanceAfterReserveFunds(state, p)))
  def emitDeductFunds(state: CreditBalanceState, p: DeductFunds, hosts: CreditBalanceComputations): Vector[Event] = Vector(DeductFundsConfirmed(p.txid, p.resource, p.amount))
  def emitReleaseReservedFunds(state: CreditBalanceState, p: ReleaseReservedFunds, hosts: CreditBalanceComputations): Vector[Event] = Vector(ReleaseReservedFundsConfirmed(p.txid, p.resource, p.amount, "CNY", hosts.BalanceAfterReleaseReservedFunds(state, p)))
  def emitRecordIncomingCredits(state: CreditBalanceState, p: RecordIncomingCredits, hosts: CreditBalanceComputations): Vector[Event] = Vector(RecordIncomingCreditsConfirmed(p.txid, p.resource, p.amount))
  def emitCommitIncomingCredits(state: CreditBalanceState, p: CommitIncomingCredits, hosts: CreditBalanceComputations): Vector[Event] = Vector(CommitIncomingCreditsConfirmed(p.txid, p.resource, p.amount, "CNY", hosts.BalanceAfterCommitIncomingCredits(state, p)))
  def emitCancelIncomingCredit(state: CreditBalanceState, p: CancelIncomingCredit, hosts: CreditBalanceComputations): Vector[Event] = Vector(CancelIncomingCreditConfirmed(p.txid, p.resource, p.amount))
}
```

| 区间/构造 | 输入、RHS 与归属 | 处理结论 |
|---|---|---|
| 1–4 | 来源头、domain package、Protocol._ import，整个物理文件共用 | 唯一复合文件 assembly owner 负责拆分后的 imports/header/路径；本族不越权删除 |
| 6–10 | 三个 host 方法依次 CommitIncomingCredits、ReleaseReservedFunds、ReserveFunds；参数固定 state + domain command，返回 FQN Money；无 body | 不等于 validate/DomainService；需要实现者，首字母大写不符目标 lowerCamelCase；不能从 host 名猜具体算法 |
| 11–12 | 空 computations companion | 当前 hosts 非空；renderCommand 对 hosts 为空的另一分支才发 `val none = new ... {}`，本文件没有该 val |
| 14 | emitInitializeAccount → `Vector(AccountInitialized(p.resource, p.currency, p.amount))` | 事件构造职责，不归 service object |
| 15 | emitReserveFunds → Confirmed 的 txid/resource/amount/字面量 CNY/host 调用，依此顺序 | host 方法/名义返回型与事件字段次序须保留；不能替换成 TransferValidator.validate |
| 16 | emitDeductFunds → Confirmed(txid,resource,amount) | 无计算调用；不能误造领域服务方法 |
| 17 | emitReleaseReservedFunds → Confirmed(txid,resource,amount,CNY,hosts.BalanceAfterReleaseReservedFunds(state,p)) | 保留一次 host 求值与字段顺序，移动时做调用方迁移 |
| 18 | emitRecordIncomingCredits → Confirmed(txid,resource,amount) | 事件构造职责 |
| 19 | emitCommitIncomingCredits → Confirmed(txid,resource,amount,CNY,hosts.BalanceAfterCommitIncomingCredits(state,p)) | 计算合同与命令映射分开裁定 |
| 20 | emitCancelIncomingCredit → Confirmed(txid,resource,amount) | 无假定的返回 confirmation 或 persist |
| 全文件 | 无 typed replyTo、CommandHelper 泛型、toParam/failure/success、runReplyingPolicy | 这些必须由 command-helper/application 行为工作包重建，不把 emit* 当这三个方法 |

真实来源 [render-domain:20–42](../baseline/js/generators/scala-cqrs-domain/render-domain.mjs#L20-L42) 的循环先选 aggregate commands/events，生成 Protocol，然后选 command-key 匹配的 hosts；每 host 方法固定 state+p，输出型经 typeName；每 command 的 emit 按 `c.events` 与 `e.slots` 原序调用 valueExpression。`results.push(entry(...,'command-helpers',...,[protocol,statePath]))` 给整个复合文件记账，尚未按 Computations/service 拆逻辑 owner。Protocol 的 Commands/Events 和 optional ExternalEvents 的另一输出不是本族拥有的产物。

### 5.5 family 的近邻模型为何仍不能记作服务实现

family `buildModels` 给每 aggregate 建 `computations` artifact：role=computations、kind=domain-computations-port、包 `<base>.domain.ports`。host 按 owner(command) 过滤，参数改由 `host.inputDependencies` 的每个声明映射，保存 ref/command/version/stableIdentityContract/name/identifier/fqn/path/parameters/outputType/source/sources；集合再记 refs/directDeps。没有 `logicCode`、superInterface 或具体实现 body。不能把此 family 的输入参数合同等同于 formal 旧式 state+p。

[computationsTemplate:3–13](../baseline/js/generators/scala-cqrs-domain-kernel-v1/templates/params.mjs#L3-L13) 依次输出 package、由 `.ports` 换 `.values` 得来的 wildcard import、trait、每 method.identifier 的唯一参数列表和 outputType、闭括号；所有方法抽象，无 companion/marker/object/RHS。`productionJobs` 明确为每 aggregate 加这个 job。family 的物理/来源 writer 可借鉴，不代表传统服务已存在，也不授权把所有 host 合并为一个 String/Any dispatcher。

## 6. 明确目标与带上下文的真实差异

### 6.1 raw → approved-target 的有限变化

1. 目标仍是每 DomainServiceMetadata 一个 `<base>.domain.services.<ResolvedName>DomainService` object，恒继承 marker。只允许三层；本族不新造顶层 service/integration/web。
2. 保留所有方法/参数/返回型与顺序，TypeRef 的递归依赖/签名；名字由统一 resolver 给出 PascalCase/lowerCamelCase/关键字和碰撞处理，稳定知识/operation/persistence/wire ID 不参与重命名。已有完整技术后缀不能再追加。
3. raw 已有的 logicCode **保留注释槽及 `???`**。没有授权从散文或参考串生成可执行算法。业务完成必须是独立明确的实现义务，不能以 `Right(())`、`Right(Vector.empty)`、空对象或 `true` 代替。
4. 不自增 MANUAL 段来改变所有权。若采用外置实现保护或 MANUAL 策略，必须先决定对 object/singleton ABI、调用方与刷新行为的影响（D02）。
5. shared imports 默认按 A 的 fqn 次序；去重、冲突别名/有限 FQN 与长参数换行遵循明确目标字节。raw 已暴露的 optional/private/描述丢失不是获准修改语义；在 D03 固定策略后补负例。
6. raw single 布局可直接采用；multi 下本族 fallback 移至 kernel 没有在这里获准（D05）。framework marker 供给亦不能只因 sibling 源码存在就宣称 JAR 可消费。

### 6.2 legacy renderer → 对应 MBT Template 的源级结构 diff

minus 是固定 [emitDomainService 全函数:176–204](../baseline/js/generators/service-dsl/emit.mjs#L176-L204) 的真实源码；plus 是**proposed** `generators/service-dsl/templates/domain-service.mjs` 的模板形状，不是现存文件、可直接应用 patch、运行结果或业务完成体。plus 的 `TypeRef.signature/fqn` 表示与 Scala 相同的已解析结构属性；`scalaIdentifier` 是待 shared owner 固定的兼容接口（不是宣称已有 JS export）。名称的 CamelCase 决定在 Builder，而模板仅做既定标识符输出。缺少完整 TypeRef/model 输入时应在准入端拒绝，不能继续用 loose defaults。

**结构性对照，非同输入字节比较；本段保留 raw 的 method 排版与未实现 body。**

```diff
--- baseline/js/generators/service-dsl/emit.mjs
+++ proposed/generators/service-dsl/templates/domain-service.mjs
@@ -176,29 +1,26 @@
-function emitDomainService() {
-  const imports = (spec.dependencies || [])
+export function renderDomainService(model) {
+  const imports = [...model.dependencies]
     .map(d => d.fqn).filter(Boolean).sort()
-    .filter(p => p && p !== pkg && !p.startsWith("java.lang"));
+    .filter(p => p !== model.selfType.packageName && !p.startsWith("java.lang"));
   const importDecl = imports.map(i => `import ${i}`).join("\n");
 
-  const methods = (spec.methods || []).map(m => {
-    const params = (m.parameters || []).map(p => `${scalaId(p.name)}: ${p.typeRef}`).join(", ");
-    return `  def ${m.name}(${params}): ${m.returnType} = {
+  const methods = model.methods.map(m => {
+    const params = m.parameters
+      .map(p => `${scalaIdentifier(p.name)}: ${p.typeRef.signature}`).join(", ");
+    return `  def ${m.name}(${params}): ${m.returnType.signature} = {
   /*
-    ${m.logicCode || ""}
+    ${m.logicCode}
     */
     ???
   }`;
   }).join("\n\n");
 
-  const extendsClause = spec.superInterface ? ` extends ${spec.superInterface}` : "";
-
-  return `// @generated by rules_domain_gen:2026-10-04（port 声明面·债④余账批）
-// @knowledge-release 1.0.0
-package ${pkg}
+  return `package ${model.selfType.packageName}
 
 ${importDecl}
 
-object ${name}${extendsClause} {
+object ${model.selfType.name} extends ${model.superInterface.signature} {
 ${methods}
 }
 `;
 }
```

对应责任不是只改这个函数：Model 新建明确结构；Builder 实施 B01–B08 与来源；Template 只管 T01–T10；唯一 writer 管 T11、最终字节、manifest/ledger/anchors。上面的结构 diff 未自行增加 FQN 去重/冲突算法或格式器；D06/shared 接口决定后单列其有限输出差异，不能把它藏成“都和 Scala 一样”。

### 6.3 一个真实银行命名问题的有限目标 diff

minus 为实际银行文件 6–10 行；plus 只展示已批准的 import/方法命名目标，**不是批准把 Computations 变成 DomainService，也不是准许单独改生成文件**。实际改名需迁移上述三个 host 调用及外置实现，且保持稳定 host id/version/identity。

```diff
--- baseline/actual-js/app/example/bankwealth/domain/CreditBalanceCommandHelpers.scala
+++ approved-target/structural-example/CreditBalanceCommandHelpers.scala
@@ -4,7 +4,8 @@
 import CreditBalanceProtocol._
+import example.bankwealth.domain.values.Money
 
 trait CreditBalanceComputations {
-  def BalanceAfterCommitIncomingCredits(state: CreditBalanceState, p: CommitIncomingCredits): example.bankwealth.domain.values.Money
-  def BalanceAfterReleaseReservedFunds(state: CreditBalanceState, p: ReleaseReservedFunds): example.bankwealth.domain.values.Money
-  def BalanceAfterReserveFunds(state: CreditBalanceState, p: ReserveFunds): example.bankwealth.domain.values.Money
+  def balanceAfterCommitIncomingCredits(state: CreditBalanceState, p: CommitIncomingCredits): Money
+  def balanceAfterReleaseReservedFunds(state: CreditBalanceState, p: ReleaseReservedFunds): Money
+  def balanceAfterReserveFunds(state: CreditBalanceState, p: ReserveFunds): Money
 }
```

该局部例仍保留旧物理容器，只用于标明可见差距。最终 CommandHelpers 必须在 `application.aggregates.behaviors`，Computations 的归属/纯参数桥须先裁定 D04，不能把此局部例充当最终完整 expected 文件。

## 7. 胶水、实现槽与协议保护面

| 符号/来源 | 本族需要的 API/语义 | 供给边界 |
|---|---|---|
| `net.imadz.common.CommonTypes.DomainService` | 空 marker trait，无抽象方法、类型参数、构造参数；object extends 即可 | [固定 CommonTypes:7–21](../baseline/common/src/main/scala/net/imadz/common/CommonTypes.scala#L7-L21)。不是自动注入器，也不是 actor behavior |
| `net.imadz.common.CommonTypes.Id` | `type Id = java.util.UUID`；curated 参数和 Map key 使用 | 同文件 9；不因新银行也有 ID 值类就 alias 合并 |
| `net.imadz.common.CommonTypes.iMadzError` | `final case class iMadzError(code:String,message:String) extends Throwable with CborSerializable` | 同文件 11；curated 以 Left 返回它，不是直接抛异常。传递依赖 CborSerializable 不能省略供给审计 |
| `<base>.domain.values.Money` | 由方法签名引用的名义领域值；curated body 使用 `.amount` 与 BigDecimal 比较 | 不把银行 Money/AmountDecimal/Wire/PO 合一；body 依赖不是当前 Builder 从字符串自动发现的 |
| `scala.Predef.???` | raw 每个方法的唯一可执行 body，调用时未实现异常 | 即使签名可编译也不算可运行业务；不得写 success 代替 |
| GeneratorContext/TypeResolver/CodeGenerationDSL | 编译期结构、依赖、排版支撑，详 §3 | 不 import 到生成业务代码；不复制整套 Scala 支撑进银行私有代码 |

[BC scaffold/build.sbt:127–135](../baseline/bc/scaffold/build.sbt#L127-L135) 声明 `"net.imadz" %% "common-core" % "0.2"`（同组有 Monarch/Saga/auth）。[CodegenMain:201–215](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L201-L215) 还复制 scaffold，并在 multi 分支处理 CommonTypes 等本地源码；因此 marker 到底由哪个 source/JAR 提供、是否重复定义，需要后续选定 profile 的实际 classpath 核验。本次没有读取 JAR、解析本地缓存或批准 publishLocal/升级 runtime，不能将 `baseline/common` 当作消费能力证明。

本族本身不 persist、不 reply、不 publish、不启动资源。若领域服务由规则/Actor 行为调用，边界仍须满足全局合同：

- Actor-facing command 按明确 reply 合同条件添加 typed `replyTo`；不能把 ActorRef 加到领域参数、事件或本族纯方法参数。
- CommandHelper 归 `application.aggregates.behaviors`，有 `toParam`、`createFailureReply`、`createSuccessReply`，不是 emit* 集合。
- 规则失败不持久化；成功先持久化并应用事件，`thenReply` 的 success helper 读更新后的 state。
- `runReplyingPolicy(...).replyWith(...)` 与 `replyWithAndPublish(...)` 不等价，后者额外发布事件；领域服务抽取不能引入/删除此副作用。
- 本次没有这些行为的新运行证据；它们是与 command-helper/aggregate-behavior 的消费验收依赖，不能从 DomainService marker 推导。
- 不改 PB 字段号/包协议身份、PID、serializer ID/manifest/绑定范围、名义类型、幂等/operation ID 或溢出/舍入合同；`addExact` 不换成 `+`。本族原始未实现槽不授权填这些语义。

## 8. 后续 JS 写集合、文件组装 owner 与旧输出处置

以下均为**待另行批准的实施写集合**，本阶段没有改这些文件。所有 JS 路径根均为 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/`。

### 8.1 本族专属 proposed 文件

| 路径 | 责任/接口 |
|---|---|
| `generators/service-dsl/model/domain-service.mjs`（proposed） | DomainServiceModel/MethodModel 的结构工厂或只读数据约束；四主字段与四方法字段，FieldDef/TypeRef 复用 shared。禁止 content 大串字段 |
| `generators/service-dsl/builder/domain-service.mjs`（proposed） | `buildDomainServiceModel(meta, ctx)`；B01–B08；必要 source 身份侧载；logic.fold 三路不猜实现 |
| `generators/service-dsl/templates/domain-service.mjs`（proposed） | `renderDomainService(model)`；T01–T10；不读文件、不写盘、不做注册、不解析业务散文 |
| `generators/service-dsl/produce-domain.mjs`（proposed） | 仅负责已准入服务集合 → model/template → source entries；完整 path/kind/deps/sources/mappings。formal product id/version/输入 schema 待 D01，不能现在捏造已存在产品 |

专属服务文件的唯一内容 assembly owner 为 **domain-service 工作包**；每个输出完整 file 只组装一次。若同输出同时由 formal 与 legacy 触达，必须在 profile 层选择一个 owner，不能依赖 last-writer-wins。

### 8.2 集成者独占的共享改动面

| 已有路径 | 后续 disposition / 冲突面 |
|---|---|
| `generators/service-dsl/emit.mjs` | **split/adapt**：仅将 kind=domain 转到新 Builder/Template；保留 application/query/port 分支与其 CLI 行为，不能整文件覆盖。application-service/query-service 与 legacy port owner 共用此文件，由集成者单人装配 |
| `generators/service-dsl/generator.json`、`parse.mjs` | legacy ABI 是否仍接受 loose binding 要明确；不要仅因新 MBT 存在删除 binding pass-through |
| `generators/scala-cqrs-domain/produce-v2.mjs`、`generators/scala-cqrs-domain-v2/generator.json` | 若 D01 选择扩展此正式 lane，登记新 product footprint/producer；不能添加 manifest 名称却漏真实 registry |
| `generators/scala-cqrs-application/produce.mjs`、`generators/scala-cqrs-play-service/generate.mjs`、`generators/scala-cqrs-play-service/generator.json` | 将同一已批准服务 producer 接入银行正式消费闭包；不复刻另一份不同模板 |
| `lib/products/generate-cli.mjs` | 只有 D01 选择新的独立 producer 时才新增 allowlist；沿用现存目录时不无故修改。entrypoint 与生成配置由集成者决定 |
| `generators/run-all.mjs` | 保留 kind=port 的独立用途；若以后迁 singular path 必须同时迁 package/调用方/owned plan。不得直接改为 kind=domain |
| `generators/scala-cqrs-domain/render-domain.mjs` | 混合 Protocol/Computations/emit*/ExternalEvents 文件；**唯一 assembly owner 为集成者**。与 application-protocol/command-helper/invariant-rule/domain-service 等冲突；本族不抢写 |
| `lib/scala-target/naming.mjs`、`lib/scala-target/model.mjs` | shared-layout-types owner 独占；必要的新 TypeRef/import/layout 支撑路径亦由该 owner 固定，不由本族另造全局 resolver |
| `src/core/generate.mjs` 及其 writer/anchor 支撑 | 复用 source entries/applyEntries 的唯一最终字节漏斗；本族不自己 writeFileSync、不手写 ledger/anchor、不补新作者 @knowledge |

复用边界：已实读 [resolveName/resolveNameSet/resolveArtifactPath](../baseline/js/lib/scala-target/naming.mjs#L26-L118)。它区分源码名和稳定空间、检查 portable collisions；自动名字模式遇重复 suffix **报错要求完整绑定**，不是 BC getBaseName 的任意 strip。必须先固定兼容映射和 profile/module sourceRoot，不能调用同名函数后就声称命名等价。TypeRef 的 arbitrary CustomType/Tuple/owner import 能否由现有 shared model 无损承载尚未在此承诺；它是公共接口前置条件。

### 8.3 输入、输出、调用方和回锚迁移

- 独立领域服务仅在输入真实声明 service/object 语义时输出，不从所有 hosts 自动发新的单例。目标完整相对路径为 `app/<base-as-path>/domain/services/<ResolvedName>.scala`；获批 multi-kernel 后才可另记 `modules/kernel/src/main/scala/<base-as-path>/domain/services/<ResolvedName>.scala`。
- 银行三种 BalanceAfter* 目前只证明 host port 存在，尚不能给出一个获批的银行服务文件名/实现算法；因此不声称删 `CreditBalanceComputations` 或迁入某个虚构 service。
- 复合文件退役必须先列所有消费者（rules、emit helpers、application adapter、外置实现及测试），用同一 TypeRef/name mapping 改 imports/calls/signatures。只移动文件不算职责正确；必须避免未来 application Actor command 被 domain 服务反向依赖。
- 对 legacy port/bridge 保留方法签名、桥 target、调用顺序和实现所有权。schema 或接口不等价时报告冲突，不保留永久旧 domain 转发壳掩盖迁移，也不直接删除现有实现。
- 新文件 entries 要含类型依赖和完整输入 source 身份，记录 method/parameter/logic 槽位置；format/header 最终确定之后再算 span/fingerprint。`noteId` 被存于 FieldDef 不表示已有锚；新增字段/方法映射由集成者在公共 writer 统一实现。
- shared writer 会保留部分旧 owned 输出，不能把“本次不发”当作已删除；退役需要明确 owned-output 计划、冲突报告和引用归零证据。本阶段禁止 catalog/ledger/anchor/生成 app 写入。

## 9. 拟定 fixtures、精确 CLI 形状与后续验收

**本节命令全部未执行，且不属于本次授权。** 提议 fixture 文件也没有创建。没有猜测现成 Spec 名称或 `--artifact domain-service` 之类不存在的 flag。

### 9.1 最小输入与完整文件集合

提议目录 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/domain-service/`，仅作为测试输入/适配说明，不是第二份业务真源：

| fixture | 必需覆盖 |
|---|---|
| `transfer-validator` | 来源是固定 Examples:57 与 curated 文件，两者分别保存 raw 槽及人工实现证据；四参数、嵌套 Map/Option/Either、DomainService marker、Money/Id 名义依赖；禁止将两种校验优先级合并 |
| `logic-slots` | Left(error)、Right+None intent、Right+Some(code)、Some(空串)、多行串、含注释终止符；完整注释/??? 输出和准入决定 |
| `signature-order` | 多方法、零方法、零参数、顺序、Tuple、多层泛型、同包/scala/java.lang/跨 owner import、相同 FQN 不同 typeParams、同名类型冲突 |
| `input-loss-negative` | optional/optionalWhen、isPrivate、method/service description、FieldDef noteId/description 的未消费路径；不能 silent success |
| `names-and-paths` | 已带 DomainService/Service 后缀、keyword 参数/方法、大小写碰撞、single/multi fallback、不可解 MetaRef/Any fallback 的 raw 债与目标拒绝策略 |
| `host-port-not-service` | 保留当前 CreditBalance 三 host 参数/输出和七 emit RHS；证明端口不能自动提升为 object、ActorRef 不泄漏 domain；legacy bridge 存在/缺失两路另算 |

预期对账集合不仅是一个截段：每 fixture 的本族完整 Scala 文件（package/import/header/所有 method/body/尾换行）、必要共享依赖文件路径列表、source entry 与 method/parameter/slot mappings；raw-scala、approved-target、actual-js 分槽封存，缺输出的槽显式缺失。将 family computations/legacy bridge 归入本族与否须先裁定，不将其他 family 的全套 proto/build/tests 计为本族成果。

### 9.2 已知可调用的 legacy 内容捕获形状

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/service-dsl/emit.mjs \
  /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/domain-service/legacy-domain.spec.json \
  /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/.rounds/domain-service-approved-capture/legacy-domain
```

`legacy-domain.spec.json` 为 proposed、尚未存在，必须显式 kind=domain/package/name/dependencies/superInterface/methods；第二参数是目录不是 `.scala` 路径。此命令读取 spec，mkdir，覆盖目录中 `${name}.scala`，没有 shared writer 的 ownership/ledger/anchors，不启动 sbt、网络、服务或 child process。它只验证 legacy emitter 内容，**不能作为正式银行链路验收**。不得运行 `run-all.mjs` 来代替：其 compileTree、全项目生成、临时 spec 和 execSync 子进程超出本族范围。

### 9.3 formal 未来 scoped capture 的真实公开命令形状

在 D01 明确输入产品、由集成者将本族接入 domain-v2 且 fixtures 通过准入后，形状为

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/domain-service/request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-domain-v2 \
  --out /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/.rounds/domain-service-approved-capture/formal \
  --options-json /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/domain-service/options.json \
  --plan
```

- 四个值 flag 和 `--plan` 来自 [generate-cli:66–88](../baseline/js/lib/products/generate-cli.mjs#L66-L88)，不是虚构专属 CLI；本族 scope 靠只含服务及类型依赖的 request/manifest producer 闭包实现，不靠不存在的 artifact flag。
- **目前不能用该命令生成 DomainService**：当前 domain-v2 registry 没有 producer，request/options 亦尚未制定。命令是条件式精确形状，不是现成可通过配方；若 D01 选独立 producer，必须先真正注册再改 generator 路径。
- `--plan` 捕获 request/options/manifest，compileProductSet 在内存构建图 AST 并运行 admitted producer 得到 plan，返回 sources；未调用 applyEntries，不写源/ledger/anchors，也不等同 writer 的完整目标预检或运行验证。本阶段连 plan 也不运行。
- 获批真实捕获去掉且仅去掉 `--plan`。source entries 应限制在本族闭包；[applyEntries:246–268](../baseline/js/src/core/generate.mjs#L246-L268) 可 mkdir/写源，然后写 `<out>/truthsrc.ledger.json`、`<out>/anchors.json`，并读取/合并已有目标字节。不是新目录就“没有旁路状态”。代码没有为该 CLI 自动下载、发布、启动服务或 JVM；所选 producer 及依赖捕获仍要复核。
- 需要外置实现捕获的实现策略不能强塞到 generate-products；[generate-cli:45–63,79–80](../baseline/js/lib/products/generate-cli.mjs#L45-L80) 对部分 producers 明确要求 generate-project。服务对象是否采用该策略属于 D02/D01，不能编造一个已兼容的 `generate-project` config。

### 9.4 Scala 传统 CLI 的 scope 限制与形状

现有 `CodegenMain.main` 不解析 `--system/--target`；它从 JVM properties 读值。后续若能用已支持的 formal file adapter 承载“仅服务+类型”的同等输入，命令形状是

```bash
# 工作目录必须由执行者设为 /Users/zhongdj/Workspaces/mad-polaris/backkend-codegen
sbt \
  -Dcodegen.systemFile=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/domain-service/bc-canonical.json \
  -Dcodegen.systemBindings=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/domain-service/bc-bindings.json \
  -Dcodegen.targetDir=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/.rounds/domain-service-approved-capture/raw-scala \
  -Dcodegen.ledger=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/.rounds/domain-service-approved-capture/raw-scala/domain-service-ledger.json \
  "runMain net.imadz.codegen.CodegenMain"
```

`systemFile/systemBindings` 成对且与 `codegen.system` 互斥，证据 [CodegenMain:62–80](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L62-L80)。**未证明该 file adapter 当前可无损承载本族 methods/logic/dependencies**，也没有这些 fixture 文件；因此本配方的本族准入仍阻断，不能称可立即执行。替换为 `-Dcodegen.system=Examples` 虽是真实入口，却会生成 BankingSystem 的其他层及 scaffold，不是“只生成 domain-service”，不能作为本任务的默认补救。

副作用：sbt/JVM 子进程、BC `target/` 与构建/依赖缓存，可能依赖解析下载；目标 mkdir、完整 scaffold copy、传统各层 writer、显式 ledger、KnowledgeRelease manifest，以及 formal 输入存在时的 `formal-semantics.json`。scope 也不阻止所有 scaffold 操作。没有批准时不得执行或用 publishLocal/升级 runtime 消解供给问题。离线依赖与仅服务 fixture 的真实入口是 D07 前置。

### 9.5 验收项目与停止点

1. **输入等价**：固定两端服务/方法/参数/类型/顺序/默认与 logic 来源；缺语义先停 D01/D03/D07，不能按名称相似对账。
2. **完整产物内容**：按 T01–T11、B01–B08 和 Model 每字段逐项核对完整文件集；只允许逐项登记的来源头、明确换行/命名/layout 差异，禁止删除全部空白/包名后比较。
3. **胶水/行为**：核实际 common-core 或本地源码的唯一供给。raw ??? 的输出核对与业务可运行验收分账；只有 D02 获批真实实现才测试重复预留、None 余额、相等余额、金额正负/零及重叠失败优先级。每个 port 方法/实现要有独立 oracle，不复用待测逻辑算期望。
4. **跨层消费**：与 command-helper/aggregate-behavior 合批验证失败不 persist、成功 thenReply 新状态、回复次数、无意外 EventStream publish；不得为通过而把 ActorRef 混入 domain。
5. **稳定与回锚**：相同输入两次完整字节稳定，再改一参数类型或 logic 槽验证局部差异与 source→method/parameter 的最终位置；检查旧输出 retained/退役及外置手写不被覆盖。
6. **质量**：普通 JS/Scala 方法 CC 目标 ≤5；6–10逐方法解释，>10重构或获得逐方法例外；状态 **`not-measured`**。固定工具/版本/语法口径后才报分。不得 String/Any dispatcher、无意义 nextN、fake success 或删校验刷分。
7. 仅后续获准后安排：生成/完整内容比对初始预算 5 分钟，局部 JVM 编译与真实接口/行为 15 分钟，同依赖闭包合批；超时返回已得证据并停，不开启全银行全量验收。这里没有虚构已存在的测试 suite/运行命令；具体 runner 需和所选供给/实现合同一起批准。

## 10. 必须裁定的具体问题

| ID | 具体待决项 | 阻断范围 / 当前结论 |
|---|---|---|
| D01 | 哪个正式 versioned product 表达独立 DomainServiceMetadata 的 service identity、method order、FieldDef/TypeRef、logic 三路与 source；接入现存 domain-v2/Play 还是注册独立 family？ | formal counterpart missing；只证明 legacy renderer 存在。未定不编造 product id/version/schema 或可用 options |
| D02 | raw 的注释+??? 如何成为受保护的真实实现：保留骨架还是获批外置实现？TransferValidator 重叠拒绝优先级采用 Examples 还是 curated？错误值采用三个未解析 Error 符号还是 iMadzError code/message？ | 业务体/API/所有权阻断。不能泛化 curated Right(()) 或自行插 MANUAL |
| D03 | optional/optionalWhen、isPrivate、service/method description、parameter noteId/description：保持 raw 不发、以不支持输入拒绝，还是显式扩展模型和模板？ | 输入无损与来源映射阻断；不得 silent 丢 optional/private 语义后称 parity |
| D04 | 当前 state+command 的 Computations、family inputDependencies port、legacy trait+Bridge 哪些确属独立纯服务、哪些保留端口？拆分后纯参数与应用适配接口及外置实现谁拥有？ | 不批准按文件名合并/删层；保留三 host 与七 emit 的 RHS，CommandHelper 由应用工作包负责 |
| D05 | multi 下 domain-service 的 raw app fallback 是否显式改为 kernel；DomainService/iMadzError/Id 由哪个唯一 source/JAR、确切坐标/版本供给？ | 物理布局和消费 ABI 阻断；不发布或升级库，不把 source snapshot 当 JAR 可用证明 |
| D06 | shared TypeRef 对同 FQN 不同泛型、同名 owner 冲突、Tuple/未知 MetaRef/Any fallback 的兼容与拒绝策略；raw 方法名转义和 logicCode 中 `*/` 的目标策略是什么？ | 公共接口/安全排版前置；已批准正常简名和 CamelCase，但不擅改业务代码字符串 |
| D07 | 同一“仅服务+类型” fixture 如何通过 BC 真实公开入口与 JS formal 准入，且不扩大成整套 Examples/银行生成；后续离线 supply、runner 和 writer side effects 如何限界？ | 同输入完整文件/接口行为证据尚缺；不能用 Node import-and-call 代替正式 CLI 或声称 scoped fixture 已可运行 |

结论仅限本制品：传统完整 MBT 和 legacy/family/formal 差异已写成可审阅规格；上述内容/接口决定仍开放，实际生成、同输入字节和行为验证均未发生。
