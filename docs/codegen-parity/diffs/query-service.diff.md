# query-service：查询应用服务的内容级差异规格

## 1. 范围、证据等级与状态

- artifactId / group：`query-service`；传统清单序号 **15**，不是已有运行时枚举。
- 文档状态：**decision-required**。传统 MBT 有明确来源；legacy 有近似 query emitter，但银行 formal 路径缺少传统 QueryService 的输入→模型→服务类接线（该对应项为 `missing-counterpart`）；family 有真实、已接线的有限 receipts 查询实现，不能称 JS 完全没有查询服务。
- 本次只做源码内容检查。没有执行生成、测试、类型检查、编译、运行、服务、下载、Git 写操作；没有修改真源、生成应用、baseline、catalog、ledger、anchor、其他 diff 或既有十五份交付。下文的验收全部 **not-run**，复杂度 **not-measured**。
- JS 固定 HEAD：`bf104e16ab82ef39d7fa416d0997907d18a815ad`；BC 固定 HEAD：`cc335eb1e0d0fae17bf092fd61b126040196ea70`。HEAD 不代替工作树字节，以 [baseline/index.json](../baseline/index.json) 中的 source、bytes、SHA-256 为准。
- 权威计划：[APPROVED-PLAN.md](../../../.rounds/prettify-generated-code-resume-20261115-cgr9lzlk/APPROVED-PLAN.md#L104-L146)；局部合同：[AUTHORING-CONTRACT.md](../AUTHORING-CONTRACT.md)、[layout-and-style.md](../layout-and-style.md)。本文没有另立中央分区或胶水规格。

### 1.1 四类材料不混签

|材料|本次取得的内容|不能据此声称|
|---|---|---|
|`raw-scala`|完整固定 Model、Builder、Template 与其实际构造规则；见 §2–4|没有本次同输入 Scala 运行生成的完整产物；不能把人工样板冒充 raw 输出|
|`approved-target`|传统结构 + 已批准三层、名称、imports、依赖方向标准；显式差异与待裁定项在 §5|没有生成后的目标字节，也没有获准实现所有新增 API；未决项不得偷偷落实|
|`actual-js`|固定银行现存 `BankServiceService.scala`、`BankJournalReadsideRepository.scala`；以及固定 formal / legacy / family 源码|银行输出不是本次运行结果；family 模板不是银行正在消费的同输入产物|
|`curated-scala`|人工完成的 `GetBalanceQuery.scala` 与 `GetRecent12MonthsIncomeAndExpenseReport.scala`，全文及 RHS 在 §7|手写 ask、错误映射、时间窗口不是 raw Builder 自动实现，不能推广成银行默认算法|

### 1.2 核心固定文件指纹

下列文件本次读取，并将 bytes / SHA 与 index 作了源码字节核对；这是内容身份核对，不是运行验证。其余固定支撑的完整指纹可按本文链接的 snapshot 键在 index 取得。

|固定完整来源|bytes|SHA-256|
|---|---:|---|
|[QueryServiceModel.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/QueryServiceModel.scala#L1-L37)|1424|`13e8231b2f74b17ec2fa172089d53c3ef17dd5695b4642290d15e5e0ede120d2`|
|[QueryServiceBuilder.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/QueryServiceBuilder.scala#L1-L76)|2953|`da55f7371098efe9617e8fc01556fb4f88c5369a97f2cfb732a6aefd4fdf55ac`|
|[QueryServiceTemplate.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/QueryServiceTemplate.scala#L1-L150)|4500|`ccb898355b2af33d930275f9eb9edaaedf89594255a8715fb68e0da033d4adc5`|
|[legacy emit.mjs](../baseline/js/generators/service-dsl/emit.mjs#L1-L295)|10903|`b9a2989d7e6573747d628b16f9fb31d46abed4a3c2ec37c91d333d1f8844e069`|
|[family build-models.mjs](../baseline/js/generators/scala-cqrs-play-application-v1/build-models.mjs#L1-L117)|9771|`3588e1ac7cfb6ea5c9f0a180acd4446c9196556bd42a4c87b41e78454b6091e5`|
|[family services.mjs](../baseline/js/generators/scala-cqrs-play-application-v1/templates/services.mjs#L1-L68)|3994|`2be4378ff0cc163625e83c9a3b614563ab7a1f9ecb0331deea89ebfe3e86e493`|
|[银行 BankServiceService.scala](../baseline/actual-js/app/example/bankwealth/service/BankServiceService.scala#L1-L100)|11451|`a7e1c39c8211cc197b11d23b7b7d0faecbcb9a4b409d6bd30283b1a64c30e297`|
|[银行 BankJournalReadsideRepository.scala](../baseline/actual-js/app/example/bankwealth/infrastructure/projection/BankJournalReadsideRepository.scala#L1-L210)|13691|`fa44484e41391c2fe31a8dfaac7c42a635df5ebdbf58ebd5540ea326f2d371ca`|
|[人工 GetBalanceQuery.scala](../baseline/curated-scala/net/imadz/application/queries/GetBalanceQuery.scala#L1-L25)|871|`e2c4b5bfb7f8fafc8ca91e217dfef8fd796c112d4eb64f4d2b39d7f152bb52cb`|
|[人工 GetRecent12MonthsIncomeAndExpenseReport.scala](../baseline/curated-scala/net/imadz/application/queries/GetRecent12MonthsIncomeAndExpenseReport.scala#L1-L37)|1556|`3a76673a9b252611a405c860cd9f019cbc15f3059f20ad34c0a443a634cef8c2`|

### 1.3 调度、基数和完整目标路径

[CodegenMain.scala:183–192](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L183-L192) 将 semantic-products 支路与传统 prepare 分开；本制品基准是传统 `runCommon` → [generateApplicationLayer](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L203-L212) → [app.queries.foreach](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L724-L733)。每个 `QueryServiceMetadata` 一次 `build`、一次 `generate`、一次 `writeArtifact`，attribution 为 `("query-service", meta.name, "global", Nil)`。不以 repository 数或 method 数增加文件数；没有按 `invokes` / `isReadOnly` 筛 query 的分支。

|变体|条件与基数|路径及证据状态|
|---|---|---|
|`query-class`|`app.queries` 每元素 1 类文件；空列表 0；methods 可以为空|`<target>/app/<base-path>/application/queries/<queryServiceName(getBaseName(meta.name))>.scala`；模板存在，fresh output 未取得|
|`query-with-structs`|同一 query 的 `structsCode.nonEmpty`；一个 companion，按 structs 顺序含 N 个 DTO，不另增文件|同一文件，object 在 class 前；空 structs 抑制 object|
|`timeout-model-branch`|直接交给 Template 的 dependencies 含任意短名 `Timeout` 时发 askTimeout；否则无此成员|同一文件；**正常 QueryServiceBuilder 在最终过滤中删除 Timeout，因此此分支在该生产链受抑制**；不是“凡有 invokes 就会启用”|
|`multi-project-fallback`|传统 `multiProject=true`|[targetModuleOf:331–349](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L331-L349) 未登记 `query-service`，仍落 `<target>/app/<base-path>/application/queries/<Name>.scala`，不应虚写为 `modules/kernel` 或 `modules/glue`|

[writeArtifact:359–424](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L359-L424) 用 selfType 包名转路径、selfType.name 加 `.scala`；先记 ledger/deps/morphisms，再判断 scope，最后加 fingerprint、走 territorial writer。scope 或领地拒绝会使实际写入少于理论 query 数。本模型继承空知识槽，不能声称已有逐 query 知识回锚。默认目标物理 profile 采用上述单工程 `app/` 路径；family 当前的 `modules/glue/src/main/scala/<base-path>/infrastructure/web/<Prefix>QueryService.scala` 是另一 profile，模块落点须 Q6 裁定。

## 2. Scala MBT 完整源码与模型账

以下内嵌固定源码保留实际代码字符串、注释、重复 import 和占位；不是修正后的实现。空行不作为本内嵌展示的字节回执，精确字节取 §1.2 固定文件。

### 2.1 Model 全文

```scala
package net.imadz.codegen.scaffolding.cqrs.model.application


import net.imadz.codegen.scaffolding.cqrs.model.domain.ValueObjectModel
import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

// --- Model 定义 ---

/**
 * 查询服务模型 (Read Side / Aggregate Ask)
 * @param selfType e.g. GetBalanceQuery
 * @param methods Query 方法
 * @param structs DTOs 定义在伴生对象中 (仅 Projection Query 需要)
 * @param dependencies 依赖集合
 */
case class QueryServiceModel(
                              override val selfType: TypeRef,
                              methods: Seq[QueryServiceMethodModel],
                              structs: Seq[ValueObjectModel],
                              override val dependencies: Set[TypeRef]
                            ) extends ArtifactModel

/**
 * 查询服务方法模型
 * 与 ApplicationServiceMethodModel 结构相似，但更侧重于查询逻辑和返回 DTO
 */
case class QueryServiceMethodModel(
                                    name: String,
                                    parameters: Seq[FieldDef],
                                    returnType: TypeRef,
                                    bodyLogic: String, // 核心业务逻辑代码
                                    invokesCommands: Seq[TypeRef] // 调用的 Command 类型 (用于 Ask Pattern)
                                  )

// --- Builder 实现 ---
```

|Model 顺序/字段|类型、默认、来源、实际消费者|JS 必须表达的差距|
|---|---|---|
|QueryServiceModel.1 `selfType`|`TypeRef`，无默认，override；`ctx.typeResolver.queryService(meta.name)`；决定包、类、companion、文件|legacy 只有 `spec.package/name`；family 有 names.queryService，但按另一命名/模块角色解析|
|.2 `methods`|`Seq[QueryServiceMethodModel]`，无默认；保留输入顺序|不能退化为一个全文件 content 字符串；family 目前固定一个 receipts 方法|
|.3 `structs`|`Seq[ValueObjectModel]`，无默认；保留输入顺序|legacy 扁平 `name/fields/extendsReadModel` 不等结构化 VO 模型|
|.4 `dependencies`|`Set[TypeRef]`，无默认；并非仅 repositories；含方法、struct、framework 类型|要分清 import 依赖与注入依赖；不能从依赖字符串猜整个模型|
|Method.1 `name`|`String`，无默认，原样 `m.name`；模板方法名没有调用 scalaIdentifier|目标 lowerCamelCase 与关键字处理由集中名字模型承担；原始行为列为差异|
|.2 `parameters`|`Seq[FieldDef]`，无默认；name + parameterType 解析，输入顺序|禁止从逗号分割源码重建嵌套类型；目前 legacy 接受 typeRef 字符串|
|.3 `returnType`|`TypeRef`，无默认；模板输出 signature，不强制 Future|不能把所有 query 返回统一包一层 Future 或 Outcome|
|.4 `bodyLogic`|`String`，无默认；referenceCode 或 `// TODO: ${intent}`|**代码字符串债务**；Template 仅作 Description，不执行；不是已实现的 query|
|.5 `invokesCommands`|`Seq[TypeRef]`，无默认；来自 `m.invokes`|仅贡献依赖，不生成 ask、replyTo、timeout 或命令调用；legacy/family 无此通用模型槽|

共享与嵌套字段必须一并保真：

- [ArtifactModel.scala:5–47](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L5-L47)：`fqn = selfType.packageName + "." + selfType.name`；`registerTo(registry) = registry.register(this)`，QueryService 未 override 嵌套注册；`morphisms: Seq[MappingMorphism] = Nil`、`noteIds: Seq[String] = Nil`。因此 companion structs 的知识 ID 不能自动冒充 query 自身 ID。
- [TypeSystem.scala:4–52,76–85](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4-L85)：`TypeRef(name, packageName, typeParams = Nil)`；fqn 省略空 package 前缀；signature 在 `Tuple` + 数字尾缀 + 非空参数时为 `(T1, T2)`，其余有参数为 `Name[...]`，无参数为短名。`collectAllDependencies = Set(this) ++ typeParams.flatMap(...)`。`FieldDef(name, typeRef, defaultValue=None, comment=None, noteId=None, description="")`，此 query 参数构造仅传前两项。
- [ValueObjectModel.scala:7–24](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/domain/ValueObjectModel.scala#L7-L24)：字段顺序为 `selfType: TypeRef`、`fields: Seq[FieldDef]`、`dependencies: Set[TypeRef]`（三者无默认）、`logicMethods: Seq[String] = Nil`、`voNoteIds: Seq[String] = Nil`、`voOwnNoteId: Option[String] = None`；override `noteIds = voNoteIds`。QueryServiceTemplate **只消费 selfType.name、fields 的 name/typeRef.signature、dependencies 中的短名 ReadModel**；不发 logicMethods、字段默认/注释/描述/知识号、voOwnNoteId 或 companion methods。
- 输入 [QueryServiceMetadata / ServiceMethod](../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L444-L466)：query 的 name、description、repositories、structs、methods 均无默认；metaCategory 固定 `application.queries`。ServiceMethod 的 name、parameters、returnType、logic 无默认，invokes 默认 Nil，fullQualifiedName 为 `AppService.${name}`。query description 未进入此 Model。
- [BusinessLogic:63–67](../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L63-L67) 的 invariants 默认 Nil，referenceCode 默认 None；Builder 不消费 invariants。[ParameterMetadata:167–178](../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L167-L178) 的 optional=false、optionalWhen=""、noteId=None、description="" 被本 Builder 忽略；**optional=true 不在此处自动产生 Option**，只能由 parameterType 本身已含 Option 表达。不可为了“兼容”悄悄补语义。

### 2.2 Builder 全文

```scala
package net.imadz.codegen.scaffolding.cqrs.builder.application

import net.imadz.codegen.scaffolding.cqrs.builder.domain.ValueObjectBuilder
import net.imadz.codegen.scaffolding.cqrs.model.application.{QueryServiceMethodModel, QueryServiceModel}
import net.imadz.codegen.scaffolding.cqrs.{FieldDef, GeneratorContext, TypeRef}
import net.imadz.meta.QueryServiceMetadata

object QueryServiceBuilder {

  def build(meta: QueryServiceMetadata, ctx: GeneratorContext): QueryServiceModel = {
    // 1. 类型解析
    // QueryService 应该位于 application.queries 包
    val pkg = ctx.layout.application.queries.root

    val selfType = ctx.typeResolver.queryService(meta.name)

    // 2. Struct/DTO Models (内部 DTOs)
    val structModels = meta.structs.map(ValueObjectBuilder.build(_, ctx))

    // 3. 依赖解析 (Repositories Refs)
    val resolvedDeps = meta.repositories.map(ctx.typeResolver.resolve(_))

    // 4. 方法转换
    val methods = meta.methods.map { m =>
      // a. 参数
      val parameters = m.parameters.map(p => FieldDef(p.name, ctx.typeResolver.parameterType(p.parameterType)))

      // b. 返回类型
      val returnType = ctx.typeResolver.resolve(m.returnType)

      // c. 调用命令 (用于 Ask 逻辑)
      val invokedCommands = m.invokes.map(ctx.typeResolver.resolve(_))

      QueryServiceMethodModel(
        name = m.name,
        parameters = parameters,
        returnType = returnType,
        bodyLogic = m.logic.referenceCode.getOrElse(s"// TODO: ${m.logic.intent}"),
        invokesCommands = invokedCommands
      )
    }

    // 5. 依赖收集
    val methodDeps = methods.flatMap { m =>
      m.returnType.collectAllDependencies ++
        m.parameters.flatMap(_.typeRef.collectAllDependencies) ++
        m.invokesCommands.flatMap(_.collectAllDependencies)
    }

    val structDeps = structModels.flatMap(_.dependencies).toSet ++
      structModels.flatMap(_.fields.flatMap(_.typeRef.collectAllDependencies)).toSet

    val frameworkDeps = Set(
      ctx.knownFrameworkTypes("Inject"),
      ctx.knownFrameworkTypes("Timeout"),
      ctx.knownFrameworkTypes("ExecutionContext"),
      ctx.knownFrameworkTypes("Future"),
      ctx.knownFrameworkTypes("ReadModel")
    )

    val allDeps = (resolvedDeps.toSet ++ methodDeps.toSet ++ structDeps ++ frameworkDeps).toSet

    // [FIX] 优化过滤器：只过滤掉当前包、空的包、以及 java.lang (基础类)
    // scala 包只过滤根包 (TypeRef.Int 等)，保留 scala.concurrent 等子包
    val dependencies = allDeps.flatMap(_.collectAllDependencies)
      .filterNot { t =>
        t.packageName.isEmpty ||
          t.packageName == pkg ||
          t.packageName == "java.lang" ||
          t.packageName == "scala" // 只过滤 scala 根包，保留 scala.concurrent/collection
      }
      .filterNot(_.name == "Timeout") // Timeout 单独处理
    QueryServiceModel(selfType, methods, structModels, dependencies.toSet)
  }
}
```

### 2.3 Builder 逐规则、分支与共享依赖

|位置|完整规则和边界|实施义务|
|---|---|---|
|B1 L13–15|pkg 取 layout.application.queries.root；selfType 走 resolver|不能用 spec.package 默认 application 顶层代替；[PackageLayout:77–79](../baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala#L77-L79) 已是目标三层|
|B2 L18|每个 struct 调 ValueObjectBuilder，无“只有 projection query 才允许”的运行分支|模型注释不是 gate；保持 structs 顺序及空列表行为|
|B3 L21|repositories 的每个 MetaRef 调 resolve；此时仍是 Seq，后续转 Set|仓储引用未单独存入 Model；模板靠所有 dependencies 的名称后缀选注入项，属于真实缺陷面|
|B4 L24–40|逐方法：参数 FieldDef→返回类型→invokes→bodyLogic。Some(referenceCode) 即使空串也用空串；None 才拼 TODO+intent|不能执行 referenceCode；bodyLogic 不做语义解析，保留未实现槽；不制造问询成功|
|B5 L44–48|收集返回类型、所有参数类型、所有 invokedCommand 类型及其递归泛型依赖|无 imports 从 method body 文本反推；referenceCode 中额外出现类型不会自动进依赖|
|B6 L50–51|structModels.dependencies 并上所有字段递归依赖；不自动加入 struct selfType|内部 DTO 自身类型只在被其他字段/返回类型引用并解析时可能进入依赖|
|B7 L53–59|Inject / Timeout / ExecutionContext / Future / ReadModel 五个框架键无条件查 Map|Map 查键不是安全 get；[GeneratorContext](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L68-L75) 提供 Inject/Future，[L112–113](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L112-L113) 提供 Timeout/EC，[L204–207](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L204-L207) 的 ReadModel 使用 frameworkPackage，不一概硬编码业务包|
|B8 L61–73|合并各 Set，再递归收依赖；剔空包、当前 query 包、java.lang、scala 根包，再剔所有短名 Timeout|scala.concurrent 等在 Builder 留下，但 Template 另有更宽过滤；同 query 包的仓储等还可能被过滤而失去注入；不能把该过滤当正确依赖注入模型|

共享分支不是黑箱：

1. [TypeResolverDSL.queryService:545–552](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L545-L552) 先 `getBaseName(conceptName)`，再 `queryServiceName(baseName)`。后者为 `baseName + "Query"`，不是 `QueryService`。[NamingConventions:187–224](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L187-L224) 依次尝试剥离 Aggregate、Controller、Entity、DomainService、Service、Factory、Behavior、Behaviors、RepositoryImpl、Policy、Handler、Adapter、Converter、Strategy、Bootstrap、SagaTransactionRepository、SagaTransactor、SagaTransaction、Repository、Query、Participant、Participant、Event、State、Context；仅一轮，剥空则返回 lastNonEmpty。它不是通用 PascalCase 转换器。目标需集中 resolver 检查名字，而不是扩大这张剥后缀表来改业务身份。
2. [TypeResolverDSL:1115–1151](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L1115-L1151)：`resolve(MetaType)` 和 parameterType 委托 TypeResolver；`resolve(MetaRef)` 对仓储/服务/结构体等用相应专用 resolver，CommandRef 等委托 nested 解析；SagaContextRef 分支本身 `???`。本 query Builder 没有额外 try/catch 或 fail-closed 声明。
3. [TypeResolver.scala 全文](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala#L14-L150)：primitive 分支、known framework CustomType 分支、泛型递归、默认 domain.values 包重定位、StructRef 有 owner/无 owner 两分支；未知 MetaType fallback `Any`，未匹配 MetaRef 的 `resolveMetaRef` 为 `???`。Query-owned StructRef 在 nested 解析时使用规范化后的 Query 名；GeneratorContext 将 query.structs 名和返回类型尾段收入 owner 表（[L331–335](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L331-L335)）。不能隐去未知引用债务，不能在 JS 用 Any 自动吞掉不可解析输入。
4. [ValueObjectBuilder 全文](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/ValueObjectBuilder.scala#L12-L124)：selfType 名尾 State 用 entityState 保留 State 并定位实体嵌套类型，否则 valueObject 先 getBaseName 再 domain.values；字段保序、TypeResolver.resolveField(optional) 包 Option、透传 defaultValue/noteId/description，comment 仍默认 None；dependencies 为字段递归集合，不剔同包。logicMethods 按顺序拼 completion、collections、selfLoop、details 再 distinct：resolvedAt/appliedAt/confirmedAt/recordedAt → `def is<Stem>: Boolean = Option(field).isDefined`；List → `def has<field.capitalize>: Boolean = Option(field).exists(_.nonEmpty)`；同时有 source/target → `def isSelfLoop: Boolean = source == target`（实现未检查注释所说的单值类型）；description/details → `Option(field).exists(_.nonEmpty)`。这些字符串以及 voNoteIds/voOwnNoteId 虽进 struct model，却全部不被 query renderStruct 发射。不得用 VO 主模板的输出冒充 query 的内嵌 DTO。

## 3. Template 全文与逐 construct / RHS 账

### 3.1 完整原始 Template

```scala
package net.imadz.codegen.scaffolding.cqrs.template.application

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.model.application.QueryServiceModel
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.model.domain.ValueObjectModel

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object QueryServiceTemplate extends CodeTemplate[QueryServiceModel] {

  // Helper to render ValueObject as companion object DTO
  private def renderStruct(model: ValueObjectModel): String = {
    val fields = model.fields
      .map(f => s"${NamingConventions.scalaIdentifier(f.name)}: ${f.typeRef.signature}")
      .mkString(", ")

    val extendsReadModel = model.dependencies.exists(_.name == "ReadModel")
    val extendsClause = if (extendsReadModel) " extends ReadModel" else ""

    s"  case class ${model.selfType.name}($fields)$extendsClause"
  }

  def generate(model: QueryServiceModel): String = {
    // 1. 构建包声明
    val pkgDecl = packageDecl(model.selfType.packageName)

    // 2. 构建导入声明
    val baseImports = model.dependencies.toList
      .sortBy(_.fqn)
      .map(_.fqn)
      .filterNot(t =>
        t == "javax.inject.Inject" || t == "scala.concurrent.ExecutionContext" || t == "akka.util.Timeout"
      )
      .filterNot(t => t.startsWith("scala") || t.startsWith("java.lang"))
      .distinct

    val additionalImports = Seq(
      "javax.inject.Inject",
      "scala.concurrent.ExecutionContext",
      "scala.concurrent.Future",
      "akka.util.Timeout"
    )

    val importDecl = imports((baseImports ++ additionalImports): _*)

    // 3. 构建伴生对象（用于DTO/Struct定义）
    val structsCode = model.structs.map(renderStruct).mkString("\n\n")

    val companionObject: Option[ObjectDefinition] = if (structsCode.nonEmpty) {
      Some(
        ObjectDefinition(
          name = model.selfType.name,
          body = structsCode
        )
      )
    } else None

    // 4. 构建构造函数参数（依赖项）
    val deps = model.dependencies
      .filterNot(t =>
        t.name == "Inject" || t.name == "Timeout" || t.name == "ExecutionContext" || t.name == "Singleton"
      )
      .filterNot(t =>
        t.packageName.startsWith("scala") || t.packageName.startsWith("java")
      )
      .filter { t =>
        t.name.endsWith("Repository") ||
        t.name.endsWith("Factory") ||
        t.name.endsWith("Service") ||
        t.name.endsWith("Query")
      }

    val constructorArgs = deps
      .map { dep =>
        val paramName = dep.name.head.toLower + dep.name.tail
        s"$paramName: ${dep.name}"
      }
      .mkString(",\n    ")

    val availableDeps =
      deps.map(d => d.name.head.toLower + d.name.tail).mkString(", ")

    // 5. 构建服务方法
    val methodsCode = model.methods
      .map { m =>
        val params = m.parameters
          .map(p => s"${NamingConventions.scalaIdentifier(p.name)}: ${p.typeRef.signature}")
          .mkString(", ")
        val returnSig = m.returnType.signature

        val logicDesc = m.bodyLogic.replace("\n", " ").trim

        s"""
  /**
   * ${m.name}
   */
  def ${m.name}($params): $returnSig = {
    /*
    >>> AI_PROMPT_START
    Context: Query Service (Read Side)
    Task: Implement query logic for '${m.name}'
    Description: $logicDesc
    Available Repos/Services: $availableDeps
    Input Params: $params
    Return: $returnSig
    <<< AI_PROMPT_END
    */
    ???
  }
"""
      }
      .mkString("\n")

    // 6. 构建Timeout定义
    val hasTimeout = model.dependencies.exists(_.name == "Timeout")
    val timeoutDefinition = if (hasTimeout) {
      "\n  implicit val askTimeout: Timeout = Timeout(30 seconds)\n  import scala.concurrent.duration.DurationInt\n  import scala.language.postfixOps"
    } else ""

    // 7. 构建类定义
    val classDef = s"""/**
 * ${model.selfType.name}: Query Service
 */
class ${model.selfType.name} @Inject() (${constructorArgs}) (implicit val ec: ExecutionContext) {
$timeoutDefinition

$methodsCode
}
"""

    // 8. 构建完整源代码
    val companionCode = companionObject.map(_.code).getOrElse("")
    val sourceCode = s"""${pkgDecl.code}

${importDecl.code}

$companionCode

$classDef
"""

    // 9. 生成代码
    sourceCode
  }
}
```

### 3.2 输出顺序账（含不发射的构造）

|稳定构造 ID / 源码行|原始输出、完整 RHS / 条件|目标/差距处理|
|---|---|---|
|T01 / L29,137|`package <selfType.packageName>`；无运行 initializer|application.queries；纯 DTO 不迁到第四层|
|T02 / L32–48,139|依赖按 fqn 排序、取 fqn，剔三项固定 import，再剔任何 startsWith("scala") / startsWith("java.lang")，distinct；附加 Inject、EC、Future、Timeout。**最后 CodeGenerationDSL.ImportDeclaration.code 再对全列表排序**，因此不是“框架 imports 最后”|[DSL:13–22](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L13-L22) 是最终顺序。原始常态 imports 包含未必使用的 Timeout/ReadModel；非 Future/EC 的 scala 子包依赖也会被删。目标需最小修复，不用通配遮盖缺依赖；Q3|
|T03 / L51–60,136,141|structs.map(renderStruct).mkString("\n\n")；非空才 `object <selfType.name> { ... }`；ObjectDefinition 的 extendsClause/implementsClause 默认为 None|[DSL:60–70](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L60-L70) 原样拼 object；没有 companion 导入通配自动插入、annotation、type 参数或父构造实参|
|T04 / L16–24|每个 struct 发 `  case class <struct.selfType.name>(<escapedField>: <signature>, ...)`；字段有序；空字段为 `()`；仅当 **该 struct 的 dependencies** 有短名 ReadModel 才加 ` extends ReadModel`|不是依据整个 Query 的 frameworkDeps，也不是读取 ValueObjectMetadata 的“read model”标记。没有 final、字段默认、body、logicMethods、额外 extends / with、序列化 codec；Q4|
|T05 / L125–128|类 Scaladoc `* <name>: Query Service`；`class <name> @Inject() (<constructorArgs>) (implicit val ec: ExecutionContext) {`|无 @Singleton / final / extends / 泛型 / self-type / 辅构造器。保留与人工/global 和 family 的差异，不混成统一已批准接口|
|T06 / L63–82|从全部 dependencies 选：短名非 Inject/Timeout/EC/Singleton，包前缀非 scala/java，短名尾缀 Repository/Factory/Service/Query；`dep.name.head.toLower + dep.name.tail` 作参数名，类型仅 `dep.name`；Set.map 后 `mkString(",\n    ")`|没有 sort，没有 `.signature`，可能丢泛型；集合迭代顺序不是按 metadata.repositories 声明序的合同。名字未 escape；同名不同包、业务 DTO 尾缀误命中、同包仓储过滤、空 deps 为 `()` 都须建 fixture；Q3|
|T07 / L84–85|Available Repos/Services 由同一 deps 集合 lowercase-first 的名字 `mkString(", ")`|不是调用清单，不触发任何 repository。需与新注入模型同源，不能不同次排序造成提示与参数错配|
|T08 / L119–122,129|hasTimeout 时先 `implicit val askTimeout: Timeout = Timeout(30 seconds)`，后两条类内 import：DurationInt、postfixOps；false 时空串|Builder 已删除 Timeout，正常 raw 不发；单独 Template fixture 才覆盖 true。import 在 initializer 之后的顺序也不能伪装成已经编译通过。Q1 决定 ask-only 技术输入与合法 import 顺序|
|T09 / L88–101|methods 保序，空列表不发方法；每方法先 name Scaladoc，再 `def <m.name>(<escaped parameter>: <signature>, ...): <return signature> = {`|无 override、method type params、curried/implicit 参数、默认参数、overload 合并或 visibility；重复签名不在此层拦截。FieldDef 的非 name/typeRef 字段不发|
|T10 / L95,102–111|`bodyLogic.replace("\n", " ").trim` 作为 Description，依次 Context、Task、Description、Available Repos/Services、Input Params、Return；首尾 AI_PROMPT markers|referenceCode 中换行被压平；它仍然是说明文本，不是 RHS；原始未转义注释结束符。不要将 marker 当可执行 AI 服务或手写保留块|
|T11 / L112–116|每方法实际 RHS 恒为 `{ /*上述提示*/ ??? }`；方法串本身前后有换行，成员间再 mkString("\n")|`???` 是真实未实现槽，会抛 NotImplementedError；**本模板没有 BEGIN/END MANUAL**。不能改成 Nil / Future.successful(Right(empty)) 伪装实现；Q2|
|T12 / L132–147|关闭 class；source 按 package、空行、imports、空行、companion（可为空）、空行、class 拼接并返回。模板无 I/O；写盘由 writeArtifact 负责|无额外 object、trait、alias、val/var/lazy、implicit 除 ec/条件 askTimeout；不得为了补齐类别虚构成员或初始化副作用|

模板自身重复导入 `NamingConventions` 四次，且类体/方法/DTO 都含源码字符串。记录的是现实基准，不宣称传统生成器没有字符串债务。完整文件对账不能用压平全部空白的 normalize 代替以上顺序与分组。

## 4. JS 的三条真实入口与四层差异

### 4.1 formal：银行服务链，不等于传统 QueryService

[registeredProductProducer:92–101](../baseline/js/lib/products/generate-cli.mjs#L92-L101) 精确按已注册目录 realpath 选 producer。`scala-cqrs-play-service` → [generate.mjs:16–70](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L16-L70) 的 `play-service-dsl` → renderService + renderJournalReadside + test support + configuration。它没有调用 `service-dsl/emitQueryService` 或 family queryServiceTemplate。

[render-service.mjs 全文](../baseline/js/generators/scala-cqrs-play-service/render-service.mjs#L1-L205) 的实际输入为 artifact-contract.deployment.service；serviceSelection 要求显式 artifact/externalSourceRoots、一条 selected service、合法类名 stem；renderService 拒绝 service.projections 非空（L22），但另一个 renderer 可处理 projectionStore，二者不是同一字段。endpoint 由 port ref + implementation/version + input/output type 得出；这不是 `QueryServiceMetadata.methods/repositories/structs/invokes`。

[银行完整现存服务文件](../baseline/actual-js/app/example/bankwealth/service/BankServiceService.scala#L1-L100) 内容归属表：

|区间|实际 construct / RHS|本包 disposition 与唯一责任边界|
|---|---|---|
|L1–9|旧 generated header；`example.bankwealth.service`；Play ApplicationLoader/JSON/HTTP imports，Future；`object BankServiceService`|错误第四层和重复 Service 后缀属共享 service 容器拆分；不能整文件搬 application.queries|
|L10–22|Principal private[service](id, roles)，Authority.authenticate/csrf；Failure.status/code；六个 case objects 的状态/代码为 400/invalid-request、401/not-authenticated、403/not-authorized、404/not-found、409/request-conflict、503/service-unavailable；`Outcome[A] = Either[Failure,A]`|HTTP/鉴权与应用结果拆分归 service/http owner；本 query 不擅自改状态或名义失败类型|
|L23–43|decodeBody：JsonFactory 开 STRICT_DUPLICATE_DETECTION；parser.nextToken 循环维护 depth/roots，约束 depth 0..64 且单根，最终 depth=0；Json.parse；finally close；NonFatal→Left(InvalidRequest)|必要安全/资源行为不能因拆 query 被删除；不属于 query 算法|
|L44–61|Endpoint[I,O](implementation,version,reads,writes,run)，其中 run 为 `(Principal,I) => Future[Outcome[O]]`；Bindings 原声明顺序 14 项|7 个名称为 Query 的 binding 只声明 Endpoint，不存在查询方法 body、仓储构造器或 companion DTO|
|L62–79|PageRenderer 四属性加 render(endpointId,status,JsValue)；Composition extends AutoCloseable，authority/bindings/ready，pages 默认 None；Factory.create(ApplicationLoader.Context)|页面/生命周期/装配归其他 owner；Query 不拥有 close 或服务器启动|
|L80–98|完整 composition 非 null 检查；按 14 个 endpoint 顺序检查 implementation/version、reads/writes/run；installedPages 再检查非 null、具体实现及版本 1|不把 requireInstalled 删掉以掩盖调用迁移；改名必须由共享 assembly owner 同步 binding 与外置实现合同|

7 个现存查询 binding 的输入输出必须原样列清（均在 `example.bankwealth.domain.values`，不是本文发明的 DTO）：

|binding（L47–58）|输入|输出|
|---|---|---|
|BankAccountQuery|BankAccountKey|BankAccountResponse|
|BankCashOriginalQuery|BankCashRequestKey|BankCashRequestResponse|
|BankOrderQuery|BankOrderKey|BankOrderResponse|
|BankSipPlansQuery|BankPlanPageKey|BankSipPlanPage|
|BankSipPlanQuery|BankPlanKey|BankSipPlanResponse|
|BankSipOccurrencesQuery|BankOccurrencePageKey|BankSipOccurrencePage|
|BankPendingOperationsQuery|BankPendingPageKey|BankPendingResponse|

其余 7 项 BankCashSubmitPort、BankSipCreatePort、BankSipRevisePort、BankSipPausePort、BankSipResumePort、BankReconcileExistingPort、BankBusinessTickPort 必须留给对应写侧/操作 owner，不得被归并成只读 query。binding 的 run 是外置函数，此次没有读取外置 BankServiceEndpoints，也没有证据把任一端点实现成 GetBalanceQuery。

[renderJournalReadside:215–260](../baseline/js/generators/scala-cqrs-play-service/render-journal-readside.mjs#L215-L260) 在没有 projectionStore 时返回 []；有时 validate store，检查 PID kind 长度、companion 名冲突、query equality 参数与 after 冲突，再发 Schema/Repository/Projection/Domain/SQL。这里仍没有传统 query-service 类。

[银行 repository 全文](../baseline/actual-js/app/example/bankwealth/infrastructure/projection/BankJournalReadsideRepository.scala#L1-L210) 证明“有 JDBC 查询”而非“有 QueryService”。本制品只消费其对应端口，不接管实现。查询相关完整 RHS 边界如下：

- L11–20：Row、Payload、State、Owner、Occurrence、Pending 名义类型及 SHA-256 `hash(value)` 保留；不 alias 合并，不改 PID digest。
- L22–67：namespace/dataSource 校验；bindOne 对 None、Some 递归、bytes、Long、Int、Boolean、String 分支，其他抛异常；bind 用 index+1；query 执行并逐 ResultSet 行建 Vector，result/statement finally close；initialize schema/version 写操作属于基础设施，绝不能自动成为 query 的初始化调用。
- L68–100：read→transaction(writable=false)，write→true；repeatable-read、autoCommit=false，writable 才锁版本；f(session) 后 commit；NonFatal rollback、rollback 异常 addSuppressed、rethrow；session.finish 与 connection.close。只读方法仍有事务/resource 副作用，不是纯领域计算。
- L101–120：requirePage 验 limit>0、limit≤Int.MaxValue、after∈[0,Int.MaxValue]；decodeRow 的 observed 用 wasNull；row/owners 使用 namespace+hash(pid) select、headOption，再校验原始 pid 防摘要碰撞。
- L133–138：event 先 row(pid) 校验 identity，再按 namespace/hash/sequence 查 Payload。
- L169–172：streamPage 先 requirePage，再按 kind/account/principal（NULL 或匹配）过滤，`ORDER BY resource_id,pid_key LIMIT ? OFFSET ?`，参数顺序 namespace/kind/account/principal/limit/after。
- L184–189：queryOccurrenceby_plan 先 requirePage，再 namespace/plan_key/owner_account 过滤，`ORDER BY due_slot,plan_key LIMIT ? OFFSET ?`，ResultSet 逐名读取六字段构造 Occurrence。
- L202–207：queryPendinglisting 先 requirePage，按 namespace，`ORDER BY operation_id,flow,operation_key LIMIT ? OFFSET ?`，按声明十字段构造 Pending（四个可空字符串包 Option）。
- L122–132、139–168、173–183、191–201 的 ensureRow/append/observe/invalidate/invalidateAll/put/delete 均属写侧基础设施；append 的 `Math.addExact(current.last, 1L)`、checkpoint/observed 规则保留，不能因为查询拆分顺便简化成 `+`。它们不应迁入 query-service。

### 4.2 legacy：近似模板确实存在，但不是 formal 接线

- [emit.mjs:14–26](../baseline/js/generators/service-dsl/emit.mjs#L14-L26) 直接读两个 argv 的 spec/outDir，mkdir；pkg 缺省 `net.imadz.metarch.application`，kind 缺省 application，`scalaId = s => s`。这不是完整 Builder。
- [emitQueryService:96–170](../baseline/js/generators/service-dsl/emit.mjs#L96-L170) 是独立分支；[L270–294](../baseline/js/generators/service-dsl/emit.mjs#L270-L294) 明确 `kind === "query"` 才调用，写 `join(outDir, name + ".scala")`。仅 kind=port 有 outDir 直接指向 `.scala` 文件的特殊路径。
- [run-all.mjs:1781–1792](../baseline/js/generators/run-all.mjs#L1781-L1792) 的唯一 service-dsl 调用明确为 `kind: "port"`，不是 query。[pipeline.mjs:78–100,120–135](../baseline/js/generators/pipeline.mjs#L78-L135) 把 service-dsl 记为 binding-driven、只排 queued 并写 manifest，不证明执行 query。独立 `emit.mjs <spec> <dir>` 可达，不代表银行 CLI 会选择它。

|legacy query 构造（按源码）|与 raw 的真实对应/差异|
|---|---|
|L97–119 deps/imports/constructor/availableDeps|过滤后缀与 raw 相似，但输入已是 flat spec，无递归 dependency builder；deps 是数组保序且不去重，raw 是 Set；imports 对合并后 Set 排序；参数类型只短名，沿袭泛型丢失问题|
|L121–126 structs|`s.fields[].typeRef` 字符串，`s.extendsReadModel` 布尔直接控制 extends；raw 是 struct.dependencies.name 检查。scalaId 不转义关键字；companion 尾部 `\n\n` 与 raw 空行组合不同|
|L128–149 methods|按 spec.methods 保序；parameters/returnType 是字符串；bodyLogic falsy 变空串，然后仅换行压平+trim；raw Builder 的 TODO fallback 未实现；完整 prompt 与 `???` 存在，无 MANUAL|
|L151–153 timeout|spec.dependencies 直接含 Timeout 可触发；不经过 raw Builder 的删除。故类似模板不能证明生产链逐字一致|
|L155–169 outer file|另加 rules_domain_gen 与 knowledge-release 两行固定旧头；类 @Inject、implicit val ec 与 raw 类似；pkg/name 由 spec 不规范化；所有功能都在混合 emitter 内，无对应 Model/Builder 职责隔离|

### 4.3 family：有限 receipts query 的完整内容与接线

[generate-cli:45–51,92–101](../baseline/js/lib/products/generate-cli.mjs#L45-L101) 将 `scala-cqrs-play-application-v1` 注册为需要实现源捕获的 producer；不是仅因目录有 family 字样。`generate-products` 对它明确抛 `APPLICATION_CAPTURE_REQUIRED`，包括 --plan；需 generate-project。[family generate.mjs:10–40](../baseline/js/generators/scala-cqrs-play-application-v1/generate.mjs#L10-L40) 检查完整 manifest、plain context、implementations/outDir、精确十 product 闭包，再 buildModels → implementationBuildInputs → render。不能把它写成银行 formal 已接通。

family Builder 全部相关规则：[build-models.mjs 全文](../baseline/js/generators/scala-cqrs-play-application-v1/build-models.mjs#L1-L117)。

- L9–31：products 为 persistenceIds 加 api-contract/application-composition；roles 中 queries 是 kernel/application.api，queryService 是 glue/infrastructure.web；不是 BC application.queries。
- L32–47：targetData、object 形状检查；重建 canonical API declaration（删 source）；compileApiContract 后 equal，否则拒绝；compileApplicationComposition 后 equal，否则拒绝；分离本族 names 再调用 persistenceModels，不能跳过这些准入来只渲染一个文件。
- L48–70：prefix 为 protocol.name 去末尾 Protocol；package 为 persistence.context.package；每 role override 至多一个且 ref 必须等于 api.aggregate；knowledgeId 是 `api:<id>:<role>`；suffix 默认技术后缀，binding 显式时 suffix 为空；收集已有 domain declarations 和框架保留名，resolveNameSet，resolveArtifactPath 得到完整 module/root 路径。
- L71–87：named 调 resolveName，并拒绝 Object/Product 继承成员；carrier 逐 nominal ref 查单字段 VO、检查缺失/循环/非单字段，保留每层 fqn/accessor/path，最后记录 primitive。不能把 nominal 链 alias 成字符串。
- L88–102：同时构造 commands，校验 command/event 模型、方法保留名、DTO 字段及 request 名碰撞；虽然不属 query，当前是共享函数，拆分时不能丢掉或由两个 owner 改同一段。
- L103–109：query 输出 key/value 通过 named 解析，冲突拒绝；query 保留完整 api.query，再附 key/value 和 keyCarrier/valueCarrier；resource 来自 api.resource.valueType 的 carrier；view 的命名与路径另属 HTTP；sources 为 API、composition、persistence。
- L111–116：resolveApplicationTarget 要求 complete compilation/no diagnostics；返回 sourceRoots/handwritten/model，供项目捕获接线。此模型不是 QueryServiceModel 的 methods/structs/repositoryRefs 列表。

查询 Template 的整个函数（固定源 [services.mjs:44–67](../baseline/js/generators/scala-cqrs-play-application-v1/templates/services.mjs#L44-L67)）如下。它确有实际行为，不能为追 raw 的 `???` 把行为删掉。

```javascript
export function queryServiceTemplate(m, out) {
  out.append(`package ${m.names.queryService.package}

import ${m.names.api.fqn}._
import scala.concurrent.{ExecutionContext, Future, blocking}
import scala.util.control.NonFatal

final class ${m.names.queryService.identifier}(repository: ${m.persistence.names.repository.fqn}, directory: ${m.names.directory.fqn},
    blockingEc: ExecutionContext) extends ${m.names.queries.fqn} {
  require(repository != null && directory != null && blockingEc != null)
  override def receipts(resource: ${scalarType(m.resource)}, after: Option[ReceiptPosition], limit: Int): Future[Outcome[ReceiptPage]] = {
    if (limit < 1 || limit > ${m.query.maxPageSize}) return Future.successful(Left(InvalidRequest))
    directory.find(${unwrap(m.resource, 'resource')}) match {
      case None => Future.successful(Left(MissingResource))
      case Some(binding) => Future(blocking {
        val page = repository.byResource(binding.envelopeResource, after.map(c => ${m.persistence.names.cursor.fqn}(c.mapKey, c.pidKey)), limit)
        Right(ReceiptPage(page.rows.map(row => ReceiptItem(row.${m.persistence.index.keyMember}, row.${m.persistence.index.valueMember})),
          page.next.map(c => ReceiptPosition(c.mapKey, c.pidKey))))
      })(blockingEc).recover { case NonFatal(_) => Left(Unavailable) }(blockingEc)
    }
  }
}
`, [m.query.source, m.query.indexSource, m.composition.source]);
}
```

|构造/调用序|原始完整行为约束|移植不得丢失的区别|
|---|---|---|
|package/import/class|使用 names.queryService.package；API wildcard；EC/Future/blocking/NonFatal；final class，三个显式构造参数，extends queries.fqn；没有 @Inject、implicit ec、companion|当前 repository 是基础设施具体类型，directory 也是 infrastructure.web；只搬包会产生 application→infrastructure 反向依赖，需 Q5 端口裁定|
|require|构造时三个参数非 null；无其他初始化|不能靠空依赖 + 后置补齐假成功|
|receipts signature|resource 保留 nominal 最外层 fqn（否则 string→String / integer→Long / boolean→Boolean），after: Option[ReceiptPosition]，limit: Int；Future[Outcome[ReceiptPage]]|[syntax:4–12](../baseline/js/generators/scala-cqrs-play-application-v1/templates/syntax.mjs#L4-L12) unwrap 按 carrier.chain 顺序 `.accessor`；不抹名义身份|
|limit guard|先 limit<1 或 > maxPageSize → Future.successful(Left(InvalidRequest))，不调用 directory/repository|不能让非法 page 触发 JDBC|
|directory lookup|之后同步 directory.find(unwrapped resource)；None→Future.successful(Left(MissingResource))|查找在 Future 外，原始此处抛异常不由后面的 recover 捕获；不能无记录改变故障合同|
|Some branch|Future(blocking {...})(blockingEc)，repository.byResource(binding.envelopeResource, after.map(c=>cursor(c.mapKey,c.pidKey)),limit)|使用 envelopeResource 而非 resourceId；游标字段顺序 mapKey,pidKey 必须保持；after 转换在 Future 内|
|page mapping|Right(ReceiptPage(page.rows.map(row=>ReceiptItem(row.keyMember,row.valueMember)), page.next.map(c=>ReceiptPosition(c.mapKey,c.pidKey))))|rows 顺序与 next cursor 不重排；空页允许怎样返回须保留所消费 repository 合同，不硬填成功|
|recover|Future 上 NonFatal→Left(Unavailable)，recover 也显式 blockingEc|阻塞 executor 生命周期由装配拥有，query 不关闭它；fatal 异常不吞|
|source mapping|out.append 同时关联 query.source、query.indexSource、composition.source|字节重排后重新计算，不沿用旧 span|

[api.mjs:27–31,46–56](../baseline/js/generators/scala-cqrs-play-application-v1/templates/api.mjs#L27-L56) 中，ReceiptPosition(mapKey:String,pidKey:String)、ReceiptItem(keyCarrier,valueCarrier)、ReceiptPage(rows:Vector[ReceiptItem],next:Option[ReceiptPosition]) 在 API object；queries trait 仅声明 receipts。Outcome 是 `Either[Failure,A]`（[L9–23](../baseline/js/generators/scala-cqrs-play-application-v1/templates/api.mjs#L9-L23)）。这些不是 raw 的 companion ReadModel DTO，不能直接 alias 或合并。

[render.mjs:16–46](../baseline/js/generators/scala-cqrs-play-application-v1/render.mjs#L16-L46) 明确把 queries-port 与 query-service 分两份文件；query-service 的 directDeps 为 queries.path、directory.path、persistence repository.path；application-root 依赖它。共享 services.mjs 还承载 commandServiceTemplate，唯一组装 owner 必须先分离，两位实施者不能并改。

### 4.4 四层横向结论

|层|raw Scala|formal 银行|legacy|family|
|---|---|---|---|---|
|Model|selfType + methods + structs + Set[TypeRef]|endpoint contract，非查询方法模型|flat spec，类型多为字符串|API/composition/persistence/names/carriers 的有限大模型|
|Builder|repository/DTO/参数/return/invokes 解析，递归 dependencies|serviceSelection + endpoint 选型；projectionStore 独立|query emitter 内临时筛选，无同等依赖 lowering|strict product 重编译对账和名称检查完善，但并非传统查询输入语义|
|Template|有 DTO/类/提示；实际方法 ???|混合 Service object/Play loader；无传统 query 类|非常近似的独立 emitQueryService，但转义/依赖/默认/空行差异存在|真实 receipts + 阻塞 JDBC 适配，需保行为地拆边界|
|产物|本次未取得 fresh raw|固定两个银行文件可读，但不是同输入 query class|没有本次 fresh query 输出|没有本次 fresh family 输出，更不能当银行样本|

## 5. approved-target、真实 minus/plus 与有限偏差

### 5.1 raw → target 的显式规则

|项|已批准方向|尚不能自由选的部分|
|---|---|---|
|布局|查询应用职责在 `<base>.application.queries`；repository port 在 application，技术实现 infrastructure；业务根仅 domain/application/infrastructure|family 物理 module、旧类/调用方迁移由 Q5/Q6 固定；不整搬 Play 对象|
|命名|类型/文件 PascalCase，成员 lowerCamelCase，参数关键字合法转义；传统 Query 后缀避免重复技术后缀|不能把 port ID、endpoint ID、PID 当源码名统一重写；bodyLogic 中自由源码不得 regex 自动重命名|
|imports|递归类型模型，正常简名、冲突诊断、确定顺序；保留完整依赖|raw 的 startsWith(scala) 删除、Set 构造器顺序、泛型截断须 Q3 的有限差异表，不能假称原样字节对齐|
|DTO|保留字段顺序、nominal 身份、source 映射；不引 ActorRef 到 domain 参数/事件|default/optional/ReadModel/logicMethods 原始遗漏是 Q4，不能未经裁定调用 VO 主模板补齐|
|body|保留原始 `bodyLogic` 说明槽及 `???` 的事实；真实业务实现/外置实现单列|未批准把 referenceCode 自动执行，或把人工 error→Nil 复制到银行；Q2|
|query 与写侧|query 不要求写命令 Helper；应用 actor 命令只按明确 reply 合同有 typed replyTo|CommandHelpers 仍在 application.aggregates.behaviors，toParam/createFailureReply/createSuccessReply 与 runReplyingPolicy 是写侧独立合同；不在本包伪造一个 Helper|

### 5.2 真实结构性 diff：legacy 字段/参数模板 → Scala 目标构造

这是 **结构性对照，非同输入字节比较**；minus 为固定 JS 模板原文，plus 为固定 Scala Template 对应规则。两端实现语言不同，此块不是可直接 apply 的 JS patch，更不是已生成产物。它具体说明为什么“legacy 自称 1:1”仍不够；plus 使用的 scalaIdentifier/signature 是目标应复刻的语义，不批准复制一份任意类型字符串解释器。

来源：[legacy L121–130](../baseline/js/generators/service-dsl/emit.mjs#L121-L130)、[Scala L16–24](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/QueryServiceTemplate.scala#L16-L24)、[L88–95](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/QueryServiceTemplate.scala#L88-L95)。

```diff
--- actual-js-template/service-dsl/emit.mjs (struct construct)
+++ approved-target-structure/QueryServiceTemplate.scala (renderStruct)
@@ -1,5 +1,9 @@
-  const structs = (spec.structs || []).map(s => {
-    const fields = (s.fields || []).map(f => `${scalaId(f.name)}: ${f.typeRef}`).join(", ");
-    const ext = (s.extendsReadModel ? " extends ReadModel" : "");
-    return `  case class ${s.name}(${fields})${ext}`;
-  }).join("\n\n");
+  private def renderStruct(model: ValueObjectModel): String = {
+    val fields = model.fields
+      .map(f => s"${NamingConventions.scalaIdentifier(f.name)}: ${f.typeRef.signature}")
+      .mkString(", ")
+
+    val extendsReadModel = model.dependencies.exists(_.name == "ReadModel")
+    val extendsClause = if (extendsReadModel) " extends ReadModel" else ""
+
+    s"  case class ${model.selfType.name}($fields)$extendsClause"
--- actual-js-template/service-dsl/emit.mjs (method construction)
+++ approved-target-structure/QueryServiceTemplate.scala (method construction)
@@ -1,6 +1,12 @@
-  const methods = (spec.methods || []).map(m => {
-    const params = (m.parameters || []).map(p => `${scalaId(p.name)}: ${p.typeRef}`).join(", ");
-    const logicDesc = (m.bodyLogic || "").replace(/\n/g, " ").trim();
-    return `
+    val methodsCode = model.methods
+      .map { m =>
+        val params = m.parameters
+          .map(p => s"${NamingConventions.scalaIdentifier(p.name)}: ${p.typeRef.signature}")
+          .mkString(", ")
+        val returnSig = m.returnType.signature
+
+        val logicDesc = m.bodyLogic.replace("\n", " ").trim
+
+        s"""
   /**
    * ${m.name}
```

以上 context 中的 `/** ... ${m.name}` 是两端相同的实际输出片段；实际方法末尾两端仍是 `???`。这不是“补齐了查询实现”。DTO extendsReadModel 的 raw 判定即使有问题，也须先显示差异再由 Q4 裁决。

### 5.3 family 的可明确布局差异（非整包实施补丁）

仅比较 [build-models.mjs:17–20](../baseline/js/generators/scala-cqrs-play-application-v1/build-models.mjs#L17-L20) 的 **包归属槽**，保留当前技术后缀与 module 以避免本块擅自裁定 Q6。此 plus 的 package 是批准目标；单改该行 **不能交付**，必须先解决 application 不依赖具体 JDBC/directory 的 Q5。其余行只是上下文，不授权本包修改 commandService。

```diff
--- actual-js/family/build-models.mjs
+++ approved-target/package-slot-only/build-models.mjs
@@ -17,4 +17,4 @@
   ['codec', 'http-codec', 'HttpCodec', 'glue', 'infrastructure.web'],
   ['commandService', 'command-service', 'CommandService', 'glue', 'infrastructure.web'],
-  ['queryService', 'query-service', 'QueryService', 'glue', 'infrastructure.web'],
+  ['queryService', 'query-service', 'QueryService', 'glue', 'application.queries'],
   ['journalSource', 'journal-source', 'JournalSource', 'glue', 'infrastructure.web'],
```

最终 traditional-target 为 `<target>/app/<base-path>/application/queries/<Base>Query.scala`。family 若继续独立多模块，其对应完整候选路径为 `<target>/modules/<Q6选定模块>/src/main/scala/<base-path>/application/queries/<Q6选定源码名>.scala`；这里的两个槽是明确未决接口，不是已经存在的文件。没有合法依据给七个银行 endpoint 各填一个方法名/仓储/body，所以不捏造“银行实际 output → 完整可运行 target”的 diff。

## 6. Glue：调用、库来源与保护面

|完整符号 / 来源|需要的接口及真实语义|证据/限制|
|---|---|---|
|`javax.inject.Inject`|类主构造器注解|raw 无 @Singleton；BC [scaffold/build.sbt:72–78](../baseline/bc/scaffold/build.sbt#L72-L78) 声明 guice / Akka；具体 javax.inject artifact 版本/解析结果本次未读取，不假报 jar 可用|
|`scala.concurrent.ExecutionContext`、`Future`|raw 第二参数列表 `implicit val ec`；人工 global；family 显式 blockingEc|三个合同不能混同；Scala scaffold [L50](../baseline/bc/scaffold/build.sbt#L50) 为 2.13.14；没有执行 implicit resolution/编译|
|`akka.util.Timeout`、`scala.concurrent.duration.DurationInt`、`scala.language.postfixOps`|raw Template 条件 initializer `Timeout(30 seconds)`；人工用于 EntityRef.ask|BC akkaVersion 2.6.20（[L10–38](../baseline/bc/scaffold/build.sbt#L10-L38)）；normal Builder 丢 Timeout，是生成接线问题，不以 sibling 源码证明 jar 行为|
|`net.imadz.common.CommonTypes.ReadModel`、`.Id`|ReadModel marker；Id 为 UUID alias|[common 固定源码:7–17](../baseline/common/src/main/scala/net/imadz/common/CommonTypes.scala#L7-L17)；BC [build.sbt:127–135](../baseline/bc/scaffold/build.sbt#L127-L135) 声明 common-core_2.13 0.2。仅有源码与依赖声明，不是所消费 JAR API 验证|
|`net.imadz.application.aggregates.repository.CreditBalanceRepository.findCreditBalanceByUserId`|`Id => EntityRef[CreditBalanceCommand]`|[固定 port:9–14](../baseline/curated-scala/net/imadz/application/aggregates/repository/CreditBalanceRepository.scala#L9-L14)；人工 query 的 ask 不是任意 repository 都能提供|
|`akka.cluster.sharding.typed.scaladsl.EntityRef.ask`；`CreditBalanceProtocol.GetBalance`|所需合同是给 `ActorRef[CreditBalanceConfirmation]` 构造 GetBalance，再取 Future confirmation；人工用 `.ask(GetBalance)`|[Protocol:18,29](../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L15-L29) 提供 typed replyTo/余额。Akka JAR 方法精确签名和版本解析仍需后续闭包验证，未复制 library|
|`MonthlyIncomeAndExpenseSummaryRepository.filterByPeriodLCRO`|`(String,Int,Int,Int,Int) => Future[List[MonthlyIncomeAndExpenseSummary]]`；表行字段 userId/income/expense/year/month|[固定接口文件](../baseline/curated-scala/net/imadz/application/projection/repository/MonthlyIncomeAndExpendsSummaryRepository.scala#L8-L23) 文件名有 Expends，声明是 Expense；不猜不存在的拼写路径。query 不应调用同接口的 updateIncome/updateExpense|
|family `${m.names.directory.fqn}.find`|`String => Option[ResourceBinding]`；ResourceBinding 的 resourceId/persistenceId/envelopeResource 不能互换|[authority.mjs:29–36](../baseline/js/generators/scala-cqrs-play-application-v1/templates/authority.mjs#L29-L36)；目标应显式只读应用端口，具体命名/所有者见 Q5|
|family `${m.persistence.names.repository.fqn}.byResource`|`(resource:String, after:Option[Cursor], limit:Int) => Page`；当前同步方法验 identity/page、after 非 null，然后 access(_.byResource(...))|[repository.mjs:78–82](../baseline/js/generators/scala-cqrs-persistence-readside-v1/templates/repository.mjs#L78-L82)；不能改成不等待结果的 Future 外壳或丢 cursor identity；基础设施实现不归本包|
|`scala.concurrent.blocking`、`scala.util.control.NonFatal`|family Future 中阻塞 JDBC、非致命故障→Unavailable|query 不启动/关闭数据库或 executor，不负责 event-source 生命周期|

写侧保护规则虽非本制品产物，迁移调用方时仍必须满足：CommandHelper 在 `application.aggregates.behaviors`，有 toParam/createFailureReply/createSuccessReply；应用 actor command 按回复合同条件追加 typed replyTo；domain params/events 没有 ActorRef。失败不得持久化，成功必须 persist/apply 后由 thenReply 读取新 state。`replyWith` 与带 EventStream 发布的 `replyWithAndPublish` 不等价。本 query 不生成这些行为，也不能把只读 ask 当作写命令的通用替代。PB 字段号、PID、serializer ID/manifest/binding、nominal type、精度与溢出身份均不在允许差异中。

## 7. 人工参考全文：不是 raw，也不自动成为银行算法

### 7.1 GetBalanceQuery

[完整固定来源](../baseline/curated-scala/net/imadz/application/queries/GetBalanceQuery.scala#L1-L25)。

```scala
package net.imadz.application.queries

import akka.util.Timeout
import net.imadz.application.aggregates.CreditBalanceProtocol.GetBalance
import net.imadz.application.aggregates.repository.CreditBalanceRepository
import net.imadz.common.CommonTypes.Id
import net.imadz.domain.values.Money

import javax.inject.Inject
import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.Future
import scala.concurrent.duration.DurationInt
import scala.language.postfixOps

class GetBalanceQuery @Inject()(creditBalanceRepository: CreditBalanceRepository) {

  implicit val askTimeout: Timeout = Timeout(30 seconds)

  def fetchBalanceByUserId(userId: Id): Future[List[Money]] =
    creditBalanceRepository.findCreditBalanceByUserId(userId)
      .ask(GetBalance)
      .map(confirmation => confirmation.error.map(_ => Nil).getOrElse(confirmation.balances))

}
```

完整行为序：找 EntityRef → ask(GetBalance) → map confirmation。error=Some 时返回 Nil；error=None 才返回 balances；未见 recover，Future 的 timeout/失败不在此体变成 Nil。它没有 raw 的 implicit ec 构造参数/提示注释/ReadModel import；有正常 Builder 不会发出的 askTimeout。**error→Nil 会混合“拒绝”和“空余额”的展示结果，不能擅自作为全部业务默认错误处理**。应用查询的具体错误/超时合同见 Q2/Q7。

### 7.2 GetRecent12MonthsIncomeAndExpenseReport

[完整固定来源](../baseline/curated-scala/net/imadz/application/queries/GetRecent12MonthsIncomeAndExpenseReport.scala#L1-L37)。

```scala
package net.imadz.application.queries

import net.imadz.application.projection.repository.MonthlyIncomeAndExpenseSummaryRepository
import net.imadz.application.queries.GetRecent12MonthsIncomeAndExpenseReport.{MonthlyIncomeAndExpense, Recent12MonthsIncomeAndExpenseReport}
import net.imadz.common.CommonTypes.{Id, ReadModel}

import java.time.{LocalDate, YearMonth}
import javax.inject.Inject
import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.Future

object GetRecent12MonthsIncomeAndExpenseReport {

  case class MonthlyIncomeAndExpense(year: Int, month: Int, incomeTotal: BigDecimal, expenseTotal: BigDecimal)

  case class Recent12MonthsIncomeAndExpenseReport(monthlySummaries: List[MonthlyIncomeAndExpense]) extends ReadModel
}

class GetRecent12MonthsIncomeAndExpenseReport @Inject()(repository: MonthlyIncomeAndExpenseSummaryRepository) {

  def fetchByUserId(userId: Id): Future[Recent12MonthsIncomeAndExpenseReport] = {
    val now = LocalDate.now()
    val untilYearMonth = YearMonth.from(now)
    val startFromYearMonth = untilYearMonth.minusMonths(11)

    val startFromYear = startFromYearMonth.getYear
    val startFromMonth = startFromYearMonth.getMonthValue
    val untilYear = untilYearMonth.getYear
    val untilMonth = untilYearMonth.getMonthValue

    repository.filterByPeriodLCRO(userId.toString, startFromYear, startFromMonth, untilYear, untilMonth)
      .map(xs => Recent12MonthsIncomeAndExpenseReport(
        xs.map(x => MonthlyIncomeAndExpense(x.year, x.month, x.income, x.expense))
      ))
  }
}
```

|构造|与 raw / target 必须分账的内容|
|---|---|
|object、两个 case class|顺序 MonthlyIncomeAndExpense → Recent12MonthsIncomeAndExpenseReport；四字段 year/month/incomeTotal/expenseTotal；后者 List[MonthlyIncomeAndExpense] 并 extends ReadModel。raw VO builder 并不因 DTO 是报告自动赋 ReadModel 依赖|
|imports/class|引用自己的 companion 两 DTO；global EC；参数名 repository 而非 raw 根据类型得 monthlyIncomeAndExpenseSummaryRepository；类名没有 Query 后缀。仅 `meta.name` 取此名走 raw resolver 会加 Query，不能说人工文件逐字由该路径生成|
|fetchByUserId body|一次 LocalDate.now，再 YearMonth.from、minusMonths(11)，顺序取起止年月，以 userId.toString + 四 Int 调仓储；map 原序 rows→报告 DTO，无排序补月份、无汇率、无金额重算|
|语义边界|时间依赖在 application 内，不是纯 domain 算法；LCRO 的实际区间语义不能仅凭方法名与“12个月”标题认定，需明确是否包含当前月及边界；不改 minusMonths(11) 洗成看似正确的另一算法|

## 8. 第二阶段建议写集合、共用接口、唯一组装 owner

**以下均为 proposed 工作范围，不是本阶段修改许可。** 新模块不冒充已注册 producer；公共入口选型、项目输入绑定和字段映射先由集成者裁定 Q2/Q5/Q6/Q8。

### 8.1 独占 query-service 实现面

仓库根 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc`，以下为建议绝对路径：

|路径|disposition / 唯一 owner|具体职责|
|---|---|---|
|`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/query-service/model.mjs`|proposed；query-service owner|显式 QueryServiceModel/Method/Struct/Field/TypeRef 对应结构；bodyLogic 是命名的原始说明槽，不是全文件 content；来源 sidecar 不写回作者树|
|`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/query-service/build-models.mjs`|proposed；query-service owner|逐 B1–B8 lowering；记录被 raw 忽略的字段及已批准差异；读侧调用/DTO/依赖必须来自显式输入；不能按 Bank*Query 名猜行为|
|`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/query-service/templates/query-service.mjs`|proposed；query-service owner|按 T01–T12 输出结构与格式；保留 skeleton 槽，不造假成功；只用已固定的 naming/type/layout 接口|
|`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/query-service/render.mjs`|proposed；query-service owner|组装 query 单文件、members、directDeps、source mappings；格式固定后计算 spans；不自行写文件/ledger/graph|
|`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-play-application-v1/templates/query-service.mjs`|proposed split；query-service owner，集成者先从共享文件无改字节拆出|承接现有 receipts 的所有 guard/body/error/executor 规则；Q5 后才迁 application port；不得用 raw 的 ??? 覆盖现成有限行为|

### 8.2 共享写面只能由集成者串行拥有

|现有绝对路径|建议处理/assembly owner|
|---|---|
|`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/service-dsl/emit.mjs`|service-family 集成者独占；只抽 query 分支并改其调用，不动 application/domain/port 分支；旧 direct CLI 兼容或退役须明示|
|`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-play-application-v1/templates/services.mjs`|play-application 集成者独占；迁走 queryServiceTemplate；commandServiceTemplate 原语义留原 owner；不并行编辑共享 import/closure|
|`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-play-application-v1/build-models.mjs`|play-application 集成者独占 role/module/names 与共享模型整合；query owner 提供明确模型合同|
|`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-play-application-v1/render.mjs`|play-application 集成者是唯一 query 文件 job 装配者；更新 template import、directDeps、application-root 依赖|
|`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-play-application-v1/templates/api.mjs` 与 `.../templates/application.mjs`|API/应用装配集成者；决定 DTO/queries port 身份，更新 new queryService 与 controller 消费，不由 query owner 偷改|
|`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-play-service/generate.mjs`、`.../render-service.mjs`|formal service 集成者；只有显式 QueryService 输入接口完成后才能接调用。原 BankServiceService 的 HTTP/鉴权/页面/写端点分别迁移，不能因 query 缺项整文件替换|
|`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/lib/products/generate-cli.mjs`|registry 集成者；Q8 若需新 producer 才改；不得让本包假设新目录自动可用|
|`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/lib/scala-target/naming.mjs`、`.../model.mjs`、`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/src/core/generate.mjs`|公共 names/types/layout/writer owner；本包仅消费，不另创全局词法/文件写入系统|

复用候选 [resolveName/resolveNameSet/resolveArtifactPath](../baseline/js/lib/scala-target/naming.mjs#L26-L118)：显式完整 binding、不许冗余 affix、Scala keyword identifier、可移植文件碰撞诊断；这与 BC getBaseName 不是同一算法，需明确 adapter。TypeRef 支撑需提供 name/package/typeParams、signature、递归依赖、同名冲突处理、构造参数有序模型；没有现成 API 名/返回 shape 的部分由公共 owner 固定，本包不能先拼字符串绕过。

依赖闭包：`shared-layout-types`、`shared-writer-provenance`、`value-object`（内嵌 DTO 模型，不等输出模板）、`aggregate-repository-port`、`application-protocol`（ask 变体）、`projection-repository-port`、`projection-repository-implementation`（family 读端口适配）、`application-service`、`http-controller`、`application-bootstrap`。冲突面由上表单 owner 串行整合；本包只交自己的 diff/details，未修改任何对方文件。

旧输出退役条件：先列每个旧 FQN/文件/调用方→新 FQN/文件映射；源码名与业务 ref ID 分开；controller/API/bootstrap、外置实现声明、build module roots 和 directDeps 同步迁；仅由 owned writer 计划识别旧生成文件，不直接删除银行现存 app 或覆盖手写实现。MANUAL/外置 body 原内容须保留并重新定位，最终 bytes 再生成 fingerprint/mappings/ledger/anchors。不能留错误 domain/.service 转发壳当完成，也不能把现场 .truthsrc 手工补到“绿”。

## 9. Scoped fixtures、公开 CLI 形状与验收义务

### 9.1 fixtures（全部 proposed，当前没有新文件）

建议源根 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/query-service/`；它是验证材料，不是第二业务真源。本阶段未创建。

|fixture|明确输入/分支|需要的完整输出|
|---|---|---|
|`empty`|零 query；以及一个 query 无 method/struct/注入项，两种输入分开|零文件；或一个 `app/<base>/application/queries/<Name>Query.scala`，无 companion/askTimeout，仍核固定 imports/implicit ec|
|`aggregate-ask`|CreditBalance 的 Id、Money、GetBalance typed reply、repository 引用；bodyLogic=referenceCode 与 None/intent 分两变体|一份 raw skeleton，另列经认可的手写/外置实现；不能把人工输出当 raw；Query + Protocol + Repository 真实接口闭包|
|`projection-structs`|两层 companion DTO、嵌套 Future/List/Option/Tuple；read-model marker 有无、字段 default/optional/知识号/logicMethods 逐项标注|单个 query 文件，顺序/类型/同伴 imports 完整核对；Q4 未裁定字段不能“默认忽略通过”|
|`dependency-boundaries`|同名异包、同包 repository、泛型 repository、名字带 Repository 的 DTO、关键字参数 `type`、超过四依赖、两个 method、缺失引用|验证构造器选择/排序/类型参数与诊断；不凭少量依赖的偶然 Set 顺序签收|
|`timeout-model`|同一 explicit model dependencies 有/无 Timeout；另保留正常 Builder 会删除 Timeout 的样本|区分 Template true/false 与生产 Builder 抑制；不谎报 ask runtime 可用|
|`family-receipts`|完整十产品、显式 sourceRoots/handwritten；limit=0、1、max、max+1；missing resource、cursor/next、repository failure|API/queries port/query impl/repository/目录端口/装配全闭包；输入同源、oracle 独立；不是把当前银行强制转换成 family|

### 9.2 精确命令形状（只记录，当前一条也不运行）

以下路径是 **拟建隔离 fixture/输出**，不存在的输入不是事实占位成功。真实生产参数解析来源：[generateProductCli:66–88](../baseline/js/lib/products/generate-cli.mjs#L66-L88)、[projectCli:159–224](../baseline/js/lib/project/cli.mjs#L159-L224)、[CodegenMain:62–80](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L62-L80)。没有 `--artifact query-service` 这种已存在的 flag；范围必须由最小输入闭包控制，不能跑全银行后说是单制品验收。

**formal 已有公开入口的形状**（Q8 未解决前它仍不会产生传统 query class）：

```sh
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/query-service/formal/request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-play-service \
  --out /Users/zhongdj/Workspaces/mad-polaris/query-service-verification/formal \
  --options-json /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/query-service/formal/options.json \
  --plan
```

--plan 内存编译/渲染及捕获；读取 manifest、request 文档、options、显式本地 runtime JAR 与 externalSourceRoots，核 jar SHA/目录形状。已有路径还可能要求 Monarch pins（[generate-cli:114–139](../baseline/js/lib/products/generate-cli.mjs#L114-L139)）。去掉 --plan 才经 applyEntries 写输出、`truthsrc.ledger.json`、`anchors.json`，见 [core writer:246–268](../baseline/js/src/core/generate.mjs#L246-L268)。此入口没有 project graph/.truthsrc evidence 写面；不包含 Scala 编译/服务启动/依赖下载动作。**新 outDir 并不能免除前述旁路读取和 pins 要求。**

**family 必须走项目捕获入口**：

```sh
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-project \
  --project /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/query-service/family/truthsrc.project.json \
  --out /Users/zhongdj/Workspaces/mad-polaris/query-service-verification/family \
  --plan
```

无 --generator / --options-json；这些由项目配置选择，不能给此 CLI 发不存在的选项。--plan 仍捕获/检查明确声明的手写源码，做完整 inventory/SHA/来源指针核对，但不是 Scala ABI/行为验证（见 §10 extraSources）；不创建 SQLite store。去掉 --plan 会打开配置对应的 project graph SQLite（须 Q8 明确隔离路径），生成应用文件、`.truthsrc/canonical.json` / `request.json` / `compiled.json` / `inputs.json`，再写 ledger/anchors 并发布 project anchors。普通首次验收不加 --update；再生验收另用已有 `--update --plan` 预览 owned 差异。未记录编译/运行子进程为该命令内建行为；不得把“verifyImplementationSources”名字误读成会编译 Scala。

**legacy 只用于独立模板对照，不能代替正式消费验收**：

```sh
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/service-dsl/emit.mjs \
  /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/query-service/legacy/query-spec.json \
  /Users/zhongdj/Workspaces/mad-polaris/query-service-verification/legacy/app/net/imadz/application/queries
```

spec.kind 必须 query；传的是目录。该 emitter 无 --plan，直接 mkdir/写 `<name>.scala`，没有统一 owned writer/ledger/anchor；因此只允许未来隔离对照，不用 run-all/pipeline 扩大闭包或执行全仓编译。

**BC 传统文件入口形状**，工作目录明确为 `/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen`，先由该仓 owner 固定等价输入是否能通过文件 adapter；若不能表达 QueryServiceMetadata，Q8 阻断，不 invent registry slot：

```sh
sbt \
  -Dcodegen.systemFile=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/query-service/bc/canonical.json \
  -Dcodegen.systemBindings=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/query-service/bc/bindings.json \
  -Dcodegen.targetDir=/Users/zhongdj/Workspaces/mad-polaris/query-service-verification/raw-scala \
  "runMain net.imadz.codegen.CodegenMain"
```

这些 -D 是实际读取的 properties，互斥 `codegen.system`；不走 semanticProductsFile 分支，不使用默认 banking-app。sbt 会产生 BC build/target/project 缓存并可能解析/下载依赖、起 JVM；CodegenMain 还会创建 target、复制 scaffold，然后生成其他必要闭包/ledger/fingerprint。不能称只写一个 Query 文件，也不能以新目录授权这些副作用。本次全部禁止；未来要先固定离线 supply、时间预算与唯一 JVM 批次（非每 artifact 起一次）。

### 9.3 验收分账

1. **同输入完整文件对账**：双端输入 adapter 明确参数/DTO/默认/依赖/顺序，取得 raw-scala、approved-target、actual-js 的完整文件集。当前只有固定源与历史银行输出。对账路径、package、imports、annotations、object/class 顺序、参数列表、完整 RHS 与空行；仅生成来源头/平台换行可申请逐项白名单，不能压平所有空白。
2. **construct/RHS**：逐 M/B/T ID 与 §4 family 分支做定位；特别捕获 Timeout 被滤掉、ReadModel 判定、optional/default 遗漏、构造器注入误选、unknown ref 的 ???/Any。保留 raw 缺陷不能作为批准目标正确性的证据。
3. **真实接口/行为**：取得匹配 Akka/common-core JAR 的接口证据再集中编译受影响闭包；ask-only 无写事件、超时/拒绝/空值区分；投影查询明确页界/cursor/order/错误；family 非法 limit 和 missing resource 不读仓储，repository NonFatal→Unavailable、executor 不被 query 关闭。人工时间窗口另外用固定 clock/input 的独立 oracle 验证，不能复制被测 body 造 expected。
4. **命名/layout/质量**：只有三个业务层；query 不 import Play/HTTP/JDBC 具体实现；无重复技术后缀、无无意义 nextN/双重否定、合法 imports/nominal identity。普通方法 CC 目标 ≤5，6–10逐方法说明，>10重构或逐方法批准；未固定工具口径前写 not-measured，不用 String/Any dispatcher 降分。
5. **稳定性/回锚**：两次同输入完整字节一致；一字段/一 method 变更产生合理局部 diff；query 的原作者输入可定位新文件/member；格式化在最终 fingerprint/span 前；外置实现仅文件级证据不能冒称 symbol/span/runtime verified。旧文件 retirement 与各调用方同时对账。
6. **边界**：本包无 validate/roundtrip 义务，因为未改真源树；没有代码变更，故当前不跑编译/行为门。后续仅局部闭包，初始生成/对账预算 ≤5 分钟、集中编译/行为 ≤15 分钟只是调度预算；超时返回已取得证据，不启动银行全量/数据库/服务洗绿。

## 10. 具体未决项与额外来源

|ID|需要裁定的具体内容|当前局部状态|
|---|---|---|
|Q1|Timeout 应由显式 ask 技术合同驱动，还是保留 raw 抑制？30 seconds 是否只属人工参考？有 timeout 时 imports 应移到 initializer 前，不能继续依赖原顺序的未验代码|decision-required|
|Q2|bodyLogic/referenceCode 仅提示，还是显式外置实现合同？谁拥有每个方法 body、如何保留编辑区/来源、空缺如何阻断而不是生成假成功？|decision-required|
|Q3|注入项应从 repositories 显式有序建模，还是忠实 legacy 后缀筛选？同名冲突、泛型、同包依赖、scala 子包 imports 如何列为有限 raw 偏差？|decision-required|
|Q4|Query companion DTO 的 ReadModel 身份、字段 defaults/optional/note metadata/logicMethods 是有意抑制还是需批准补齐；怎样不误用 standalone VO 模板并保 nominal 类型？|decision-required|
|Q5|family receipts 的同步 read-port、resource-directory port、cursor/page 类型分别由谁拥有？保留 Future(blocking)(blockingEc) 在 application，还是把 I/O executor 移入 infra adapter？directory 同步异常是否保持原合同？|decision-required|
|Q6|传统 Query 后缀 vs family QueryService 显式绑定如何迁；family 物理 module 选哪个，如何避免 application→infrastructure 循环，并同步 application-root/API/controller 的名与路径？|decision-required|
|Q7|人工 error→Nil 和 LocalDate.now/LCRO 边界是否仅参考实例；银行七个 Query endpoint 各自的业务方法、结果/拒绝/超时、仓储与一致性来源是什么？不能从 Endpoint 泛型推算法|missing-counterpart（银行具体方法映射）|
|Q8|formal query 输入 product/adapter 与唯一 producer 装配点是什么？BC 文件 adapter 是否可承载同等 QueryServiceMetadata？等价 fixtures、family 隔离 SQLite graph 路径、输出集合须先固定；旧 legacy query direct CLI 是保留还是退役？|decision-required|

### extraSources

为确认 `generate-project --plan` 是否会编译/写盘，读取了两份 baseline/index 未包含的当前 JS 支撑源码，仅登记路径与读取时 SHA，不复制、不修改，不用它们替换固定 MBT。以下链接是**可变工作副本**，SHA 是本次证据身份；不是固定 baseline 链接：

1. `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/lib/project/implementation-evidence.mjs`，2794 bytes，SHA-256 `da6889091818f35bac0e3a62e04a862ee4268fef6f7b94cad6fed80cb637aa76`；[L27–47](../../../lib/project/implementation-evidence.mjs#L27-L47) 逐 root 调 verifyHandwrittenSources、核 SHA，返回 file-level evidence，runtimeVerified=false；不是编译器。
2. `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/lib/handwritten-provenance.mjs`，9833 bytes，SHA-256 `83f68ba4082a0c7677de3aff8552e01f0f191aa64a64062b6b2067df6fbf57d0`；[L19–70](../../../lib/handwritten-provenance.mjs#L19-L70) 检查文件系统形状、完整遍历和哈希；[L118–167](../../../lib/handwritten-provenance.mjs#L118-L167) 来源指针+inventory 前后核对，调用 anchor plan 的验证而非写入函数；symbol/span/runtime 不由此认证。

这两份当前支撑若漂移，后续只重核相应 CLI 副作用说明，不重写本次固定 Scala/JS 模板基准。本文是单制品保存的规格与阻断点，不表示 implemented、ready、parity-PASS 或 behavior-PASS。
