# connector-implementation：注入手写基建的 Connector 实现

## 1. 范围、状态与证据身份

- Artifact：`connector-implementation`，传统清单第 25 族；detail group 同名。
- 文档状态：`decision-required`。传统 Scala 的完整 MBT 已读；formal JS 对应的 **ConnectorImpl 制品缺项**，但有 legacy emitter 和不同语义的技术端口/bridge，不能写成“JS 完全没有委托能力”。
- 本文是源码内容规格，不是实现、编译、行为或 parity 通过证明。没有新鲜的同输入双端输出；下文 diff 均注明结构性对照。
- 固定 JS HEAD：`bf104e16ab82ef39d7fa416d0997907d18a815ad`；固定 BC HEAD：`cc335eb1e0d0fae17bf092fd61b126040196ea70`。实际源字节以 [baseline/index.json](../baseline/index.json) 的 snapshot/bytes/SHA-256 为准，不以 HEAD 替代工作树内容。
- 遵循 [AUTHORING-CONTRACT](../AUTHORING-CONTRACT.md)、[layout-and-style](../layout-and-style.md) 和 [APPROVED-PLAN](../../../.rounds/prettify-generated-code-resume-20261115-cgr9lzlk/APPROVED-PLAN.md)。只写本文及本组 detail；不修改此前 15 份 diff 或任何其他组文件。
- 本次没有读 baseline 以外的当前生产源码；`extraSources=[]`。读取了要求的合同/计划及仓库 `AGENTS.md`。没有真源树编辑、生成、测试、typecheck、编译、运行、服务、下载或 Git 写操作；因此不执行 validate/roundtrip。

### 1.1 四种参照不可混签

|参照|本次实际取得的内容|不能推断的内容|
|---|---|---|
|`raw-scala`|下节完整 Model/Builder/Template 固定源；writer、metadata、layout、type 支撑的固定源|没有一次本制品的 fresh CodegenMain 产物；源码推导不能伪称已生成字节|
|`approved-target`|传统结构加用户已定三层、命名、正常 imports、隔离手写实现的要求；未决例外见 D1–D7|未生成完整目标文件；多方法、脚本参数、runner ABI 等不能擅定|
|`actual-js`|legacy emitter 全文；formal 技术端口 renderer；银行现存 `bank_payment_hostTechnicalPorts.scala` 全文已分段阅读|银行技术端口不是 Scala Node 工具 Connector 的同输入实例，也不是其成功行为证明|
|`curated-scala`|对固定 `baseline/curated-scala/` 的 `Connector\|NodeSubprocessRunner\|ProcessResult\|GateRunResult` 搜索无命中；索引也未列本族 Connector 文件|不将 CreditBalance 的人工业务体移作 Connector 金样；不扩大成“整个 BC 仓库没有人工 Connector”|

### 1.2 关键固定字节

以下文件的实际 bytes/SHA 已只读重算并与 index 对上。这不是运行时验证。其他引用的固定支撑文件由同一 index 定位。

|固定文件|bytes|SHA-256|
|---|---:|---|
|[ConnectorImplModel.scala][M]|1061|`0bda07d63be7c2fb6902a54478a05ac48ba166022b5981b651697ab2908f282e`|
|[ConnectorImplBuilder.scala][B]|2605|`5ddff821d006b87baef80a16b24a6bf4e5409e4a45c413ba4a4badee21ba5412`|
|[ConnectorImplTemplate.scala][T]|2779|`aed09862e1dc7c09f49a2f124d9ab9ec3d1a47f41732992e6bec0bd0b1f130e5`|
|[legacy emit.mjs][LE]|1635|`c1d4290d23944e1d5ab7f0c8b5daa7d9bd3dc48f37342007ed7e0d7704b602e6`|
|[legacy parse.mjs][LP]|188|`c8e60cf298f9703024e46b7c6ef3662bc87e88de67489da799ccbce31fa8b80f`|
|[legacy generator.json][LM]|122|`e18fd22584bc193a71381c12a6e5e40fb87d9207a5f7fc19d654b9851441ae84`|
|[formal render-technical-ports.mjs][RT]|7615|`f1d09894cfbd40abacb68fbf59329c708373f530eb60b1df6b8cf4ffa44d9b09`|
|[family templates/scala.mjs][FT]|9338|`69b6a821feb8bd97c709afd1e19b1fab37cea7d16892295e83ec04acc27eec1e`|
|[products/generate-cli.mjs][CLI]|11644|`4b255346896f8f27534a90ed338d078b568c6f9d5a56a8b80f6e782001dd12f6`|
|[银行 payment 技术端口][BANK]|53668|`00acf25ce2f0688ea7ac6a9eacf89ccaa98f64dc7e72e0ff1c40bc03619b31ee`|

## 2. Scala 调度、基数和物理落点

入口是 [CodegenMain.scala L183–242](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L183-L242) 的传统 system 路径，不是 `semanticProductsFile → generateProducts`。`runCommon` [L192–220](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L192-L220) 创建 context，按 domain/application/infrastructure/interfaces 顺序调度。

本族 [CQRSApplicationGenerator.scala L843–852](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L843-L852) 精确调用为：

```scala
infra.connectors.foreach { m =>
  val model = ConnectorImplBuilder.build(m, ctx)
  writeArtifact(
    model,
    ConnectorImplTemplate.generate(model),
    root,
    Some(ArtifactAttribution("connector-impl", m.name, "global", Nil))
  )
}
```

`N = system.infrastructure.connectors.size`，MBT 调用及计划文件基数为 N，不是全系统一份。无 connectors 时本族为 0；接口在 application 层独立生成，不能当成本族的第二文件。writer 的 scope、领地 KEEP/MERGE 等会影响实际写入，N 不是“成功写成 N 个”的声明。

|变体/条件|raw 输出路径（相对于显式 target）|本次证据状态|
|---|---|---|
|single-project；每个 `ConnectorImplMetadata`|`app/<base-as-path>/infrastructure/connectors/<meta.name>.scala`|源码可达；未实跑|
|multi-project；相同 metadata|仍是 `app/<base-as-path>/infrastructure/connectors/<meta.name>.scala`|`targetModuleOf` 未登记 `connector-impl`，走 `None → app`；不能自行写成 glue 模块|
|有 helper、首方法有 script|同上；注入所有 helper；首 helper 执行 `run("<script>")`|条件 enabled，未 exercised|
|有 helper、首方法无 script，或接口/方法未解析出|同上；首 helper 执行 `run()`|条件 enabled，ABI 待确认|
|无 helper|同上；无显式构造参数；方法体 `???`|占位分支，不是成功实现|
|`infra.connectors` 为空|不产本族文件|suppressed 条件|

路径依据 [writer L331–378](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L331-L378)。目标默认沿用上述 single-project 形状；如实施方选 multi-module，必须先裁定 D6，不能假称 BC 已将本族映射到 `modules/glue/src/main/scala`。

生成类位于 `<base>.infrastructure.connectors`，接口位于 `<base>.application.connectors`。helper 位于已有 [PackageLayout.scala L105–111](../baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala#L105-L111) 的 `<base>.infrastructure.process`，**这是手写外域，不是第四个业务层**。对应物理位置为选定外置源根下 `<base-as-path>/infrastructure/process/<helper>.scala`，本生成器不创建该文件。装配若需生成应属 `infrastructure.bootstrap`，不能新增 `<base>.modules` 或 `.composition` 平行层。

## 3. 完整 Scala MBT 原文

以下保持 raw 源码，不先替其修错。原文中的 Node 名称是基准注释示例，不证明当前银行有此实现。

### 3.1 Model 全文

固定 [ConnectorImplModel.scala L1–24][M]。

```scala
package net.imadz.codegen.scaffolding.cqrs.model.infrastructure.connector

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

/** Connector 实现模型（infrastructure 层）——镜像 ProjectionRepositoryImplModel：
  * `injectedConstructorParams` 承载手写基建（NodeSubprocessRunner 等）的注入位。 */
case class ConnectorImplModel(
    override val selfType: TypeRef,
    interfaceType: TypeRef,
    methods: Seq[ConnectorImplMethodModel],
    injectedConstructorParams: Seq[FieldDef] = Nil,
    override val dependencies: Set[TypeRef],
    noteId: Option[String] = None
) extends ArtifactModel

/** 生成的 impl 方法：机械委托给注入的手写基建（真实调用写在 MANUAL 块）。 */
case class ConnectorImplMethodModel(
    name: String,
    parameters: Seq[FieldDef],
    returnType: TypeRef,
    // 手写基建调用表达式（生成物缺省；MANUAL 块里可改）。如 `nodeSubprocessRunner.run("scripts/kb_lint.mjs")`
    defaultBody: String,
    anchorNoteId: Option[String] = None
)
```

### 3.2 Builder 全文

固定 [ConnectorImplBuilder.scala L1–49][B]。

```scala
package net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.connector

import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.connector.{ConnectorImplMethodModel, ConnectorImplModel}
import net.imadz.codegen.scaffolding.cqrs.{FieldDef, GeneratorContext, TypeRef}
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.ConnectorImplMetadata

/** Connector 实现 Builder（infrastructure 层）——镜像 ProjectionRepositoryImplBuilder.buildVector：
  * 注入手写基建（helperNames → infrastructure.process 包的 TypeRef）作为构造参数。
  * 方法体 = 机械委托（生成物缺省）；真实调用在 MANUAL 块（重生成字节保留）。 */
object ConnectorImplBuilder {

  def build(meta: ConnectorImplMetadata, ctx: GeneratorContext): ConnectorImplModel = {
    val pkg = ctx.layout.infrastructure.connectors.root
    val selfType = TypeRef(meta.name, pkg)
    val ifaceType = TypeRef(meta.connectorName, ctx.layout.application.connectors.root)

    // 手写基建注入参数（如 NodeSubprocessRunner）——坐落在 infrastructure.process 手写外域
    val helpers = meta.helperNames.map { h =>
      FieldDef(NamingConventions.firstLower(h), TypeRef(h, ctx.layout.infrastructure.process.root))
    }

    // 方法：与接口面同名同签名；返回类型经 ctx 回查接口元数据（单一真源·不猜）
    val iface = ctx.metaRegistry.resolveByName[net.imadz.meta.ConnectorMetadata](meta.connectorName)
    val (methName, retName) = iface.flatMap(_.methods.headOption)
      .map(m => (m.name, m.returnTypeName))
      .getOrElse((NamingConventions.firstLower(meta.connectorName), "ProcessResult"))
    val runnerName = helpers.headOption.map(_.name)

    val methods = Seq(ConnectorImplMethodModel(
      name = methName,
      parameters = Nil,
      returnType = TypeRef(retName, ctx.layout.application.connectors.root),
      // 生成物缺省体：委托注入的 runner，脚本＝机制真源（不写死）。缺 runner 则 ??? 待手写。
      defaultBody = runnerName.map { r =>
        iface.flatMap(_.methods.headOption).flatMap(_.script)
          .map(s => s"""$r.run("$s")""").getOrElse(s"$r.run()")
      }.getOrElse("???"),
      anchorNoteId = meta.noteId
    ))

    val deps = (helpers.map(_.typeRef).toSet
      ++ methods.flatMap(m => m.returnType.collectAllDependencies)
      ++ Set(ifaceType, ctx.knownFrameworkTypes("Inject"), ctx.knownFrameworkTypes("Singleton")))
      .filter(_.shouldImport(pkg))

    ConnectorImplModel(selfType, ifaceType, methods, helpers, deps, meta.noteId)
  }
}
```

### 3.3 Template 全文

固定 [ConnectorImplTemplate.scala L1–65][T]。

```scala
package net.imadz.codegen.scaffolding.cqrs.template.infrastructure.connector

import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.connector.ConnectorImplModel
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate
import net.imadz.codegen.structure.NamingConventions

/** Connector 实现模板（infrastructure 层）——镜像 ProjectionRepositoryImplTemplate：
  * `@Singleton class X @Inject()(handwrittenRunner) extends XConnector`，每方法一个 MANUAL 块。
  *
  * 注入式构造必须 `@Inject()`（Guice 对无注解多参构造不实例化——9000 CreationException 实证）。
  * MANUAL 块按最近前置 `def` 名锚定（WriteTerritory.DefAnchorRegex）——重生成字节级保留手写调用。 */
object ConnectorImplTemplate extends CodeTemplate[ConnectorImplModel] {

  def generate(model: ConnectorImplModel): String = {
    val pkgDecl = packageDecl(model.selfType.packageName)

    val hasInjectedCtor = model.injectedConstructorParams.nonEmpty
    val constructorParams = if (hasInjectedCtor)
      "(" + model.injectedConstructorParams.map(p => s"${p.name}: ${p.typeRef.signature}").mkString(", ") + ")"
    else ""

    val baseImports = model.dependencies.toList
      .sortBy(_.fqn).map(_.fqn)
      .filterNot(p => p.isEmpty || p == model.selfType.packageName || p.startsWith("java.lang"))

    val importList = (baseImports ++ Seq(
      s"${model.interfaceType.packageName}.${model.interfaceType.name}",
      "scala.concurrent.{ExecutionContext, Future}",
      "javax.inject.Singleton"
    ) ++ (if (hasInjectedCtor) Seq("javax.inject.Inject") else Nil)).distinct
    val importDecl = imports(importList: _*)

    val methodsCode = model.methods
      .map { m =>
        val params = m.parameters
          .map(p => s"${NamingConventions.scalaIdentifier(p.name)}: ${p.typeRef.signature}").mkString(", ")
        val anchor = net.imadz.codegen.scaffolding.cqrs.CQRSApplicationGenerator.annotateKnowledge(m.anchorNoteId)
          .map(id => s"    // @knowledge $id\n").getOrElse("")
        val body = m.defaultBody.split("\n").map(l => s"    $l").mkString("\n")
        s"""  override def ${m.name}($params): scala.concurrent.Future[${m.returnType.signature}] = {
    // ==== BEGIN MANUAL ====
$anchor$body
    // ==== END MANUAL ====
  }"""
      }
      .mkString("\n\n")

    s"""${pkgDecl.code}

${importDecl.code}

/**
 * ${model.selfType.name}: Connector Implementation
 * 机械委托给注入的手写基建（子进程机械在手写区·不在此生成物）。
 */
@Singleton
class ${model.selfType.name}${if (hasInjectedCtor) " @Inject() " else ""}$constructorParams extends ${model.interfaceType.name} {

$methodsCode

}
"""
  }
}
```

## 4. Model 字段/default/dependency 对应账

顺序是 case class 构造参数顺序，不按字母重新排序。

|稳定项|类型、默认、raw 来源/用途|JS 当前对应与目标|
|---|---|---|
|M1 `selfType`|`TypeRef`，必填、override；`TypeRef(meta.name, infrastructure.connectors.root)`|legacy 仅 `${name}ConnectorImpl` 源码串；目标结构化名称/package，不再无条件重复后缀|
|M2 `interfaceType`|`TypeRef`，必填；name=`meta.connectorName`，package=`application.connectors.root`|legacy 把 iface/impl 放同 pkg；目标保留两个 TypeRef 和跨包 import|
|M3 `methods`|`Seq[ConnectorImplMethodModel]`，必填、保序；raw Builder 总是一个元素|legacy `spec.methods || []` 全遍历；formal 是按 host 的 pin 循环，不是此字段；多方法差异须 D1|
|M4 `injectedConstructorParams`|`Seq[FieldDef] = Nil`；按 helperNames 顺序，所有 helper 均成为构造参数|legacy 没有 helper 参数、只有空括号及 implicit ec；目标逐个保留，不把它们转换为全局 locator|
|M5 `dependencies`|`Set[TypeRef]`，必填、override；helper 顶层类型、返回类型递归依赖、iface、Inject、Singleton，最后 shouldImport|legacy 固定四 import；formal typeName 输出 FQN，缺本族依赖模型；目标需要依赖集合而非补字符串|
|M6 `noteId`|`Option[String] = None`；model 保存 `meta.noteId`|Template **不直接读** model.noteId，不发 class-level knowledge；不得因字段存在宣称文件锚已打通|
|MM1 `name`|`String` 必填；首接口方法名，或 firstLower(connectorName)|legacy m.name 原文；目标具名、lowerCamelCase；改源码名不得改 operation/knowledge 身份|
|MM2 `parameters`|`Seq[FieldDef]` 必填；Builder 固定 `Nil`，Template 支持非空循环|不能把模板能力冒称 Builder 已传 scriptParam；D1 决定合法输入子集或修复|
|MM3 `returnType`|`TypeRef` 必填，表示 Future **内层**结果；当前用应用 connector 包包装 retName|legacy m.returnType 是包含 Future 的完整源码串并默认 Future[Unit]；不能直接再次包装而生成 Future[Future[R]]|
|MM4 `defaultBody`|`String` 必填；runner.run(script)、runner.run() 或 `???`|这是明确的 Scala code-string 技术债槽；目标保留来源/责任，不用整个文件 content 取代结构模型|
|MM5 `anchorNoteId`|`Option[String] = None`；Builder 将 impl noteId 传给唯一方法|legacy 不含锚；formal `[h.source]` 为 host 级来源，不是方法级 noteId|

共享子型与继承也有内容义务：

- [TypeSystem.scala L4–52](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4-L52)：`TypeRef(name: String, packageName: String, typeParams: Seq[TypeRef] = Nil)`；`fqn` 为空包时只取 name，否则 `package.name`。`signature`：Tuple 名字以 `Tuple` 起始、其余字符全数字且 typeParams 非空时用 `(T1, T2)`；否则有泛型用 `Name[T1, T2]`，无泛型只用 name。`collectAllDependencies = Set(this) ++ typeParams.flatMap(_.collectAllDependencies)`；`shouldImport` 排除空包、当前包、`scala`、`java.lang`。
- [FieldDef L76–85](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L76-L85) 全字段依次为 `name: String`、`typeRef: TypeRef`、`defaultValue: Option[String]=None`、`comment: Option[String]=None`、`noteId: Option[String]=None`、`description: String=""`。本族两个参数循环只渲染 name/typeRef；不渲染 defaultValue、comment、字段 noteId 或 description。当前 helpers 只传前两项，因此后四项保留默认；扩展字段不得凭此宣称已支持参数默认值或字段锚。
- [ArtifactModel.scala L5–47](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L5-L47)：继承 `fqn = selfType.packageName + "." + selfType.name`，`registerTo(registry) = registry.register(this)`；`morphisms=Nil`、`noteIds=Nil`。ConnectorImplModel 未 override 后两者，单数 noteId **不等于** writer 使用的 noteIds。
- [GeneratorContext.scala L21–22、68–75](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L21-L75)：resolveByName 的实际查找表达式是 `metas.find(m => m.name == name && m.isInstanceOf[T]).map(_.asInstanceOf[T])`；本族没有另建 registry。框架类型表 Inject/Singleton 分别指向 `javax.inject.Inject`/`javax.inject.Singleton`。

### 4.1 输入 metadata 的有效/未消费字段

固定 [ArchitectMetadata.scala L1032–1076](../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L1032-L1076)：

|输入|全部声明字段/default|本族实际消费|
|---|---|---|
|`ConnectorImplMetadata`|`name`、`connectorName` 必填；`helperNames: Seq[String]=Nil`、`noteId: Option[String]=None`；metaCategory=`infrastructure.connectors`|四字段均读；不生成 HandwrittenInfraMetadata 的实现|
|`ConnectorMetadata`|`name`；`description=""`、`kind="read"`、`methods=Nil`、`entryTemplate=None`、`timeoutMs=None`、`noteId=None`；metaCategory=`application.connectors`|resolveByName 按 name 找，随后只取 methods.headOption；description/kind/entryTemplate/timeoutMs/接口 noteId 不参与 impl 方法体|
|`ConnectorMethodMetadata`|`name`、`returnTypeName`；`intent=""`、`script=None`、`scriptParam=None`、`anchoredTo=None`|只消费首方法的 name/returnTypeName/script；忽略 intent/scriptParam/anchoredTo|
|`HandwrittenInfraMetadata`|`name`；`description=""`、`noteId=None`；metaCategory=`infrastructure.handwritten`|本族不查该 metadata 验证 runner.run ABI；有名称并不证明方法真实存在|

## 5. Builder 逐规则/分支账

下表行号均指固定 [Builder][B]，必须保留“注释承诺”和“代码行为”的差别。

|项/源行|实际计算、分支及副作用|目标处理|
|---|---|---|
|B1 L14–16|从 layout 得 impl pkg；selfType 原样用 meta.name；ifaceType 原样用 connectorName，不调用通用 TypeResolverDSL|保留两层边界；统一命名模型适配，不谎称原 Builder 已使用复杂类型解析器|
|B2 L19–21|helperNames.map；参数名 firstLower(h)，类型为 process.root 下 h；没有去重/冲突/关键字检查|目标保持声明顺序，新增名称准入由 shared owner 定义；重复 helper/同名应在写前拒绝，不以覆盖消解|
|B3 L24–27|iface resolveByName；只取 headOption。无 iface 或无首方法统一 fallback `(firstLower(connectorName), "ProcessResult")`|raw 如实保留。是否允许 fallback 是 D1；不能声称“接口找不到一定在此抛错”|
|B4 L28|runnerName=helpers.headOption.map(_.name)|注入多个 helper 但默认只调用第一个；其他 helper 不是多方法路由表|
|B5 L30–34|无条件构造单个 method；parameters=Nil；retName 强制放 application.connectors 包|与接口生成器全 methods/scriptParam 的行为有实际不对齐，D1 阻断多方法/参数场景|
|B6 L35–38，runner+script|body 精确为 `$r.run("$s")`；不转义 s，不读取 entryTemplate 或 timeoutMs|未知脚本不是常量替代；script 含引号/反斜线/换行的 admitted 范围及字面量保真方案见 D2|
|B7 L35–38，runner 无 script|body 精确为 `$r.run()`；无方法时也走此分支|无参重载是否存在是外置 ABI 决策，不改成空成功|
|B8 L38，无 runner|body=`???`|调用时的未实现槽，不能替成 `Future.successful(())` 或 `Right(empty)`|
|B9 L39|method.anchorNoteId=impl meta.noteId|不是接口首方法 anchoredTo；不增加新作者 @knowledge 字段|
|B10 L42–45|helper `.typeRef` 顶层 set + 每个方法 returnType 递归 deps + iface、Inject、Singleton，再按 shouldImport(pkg) 过滤|没有参数依赖收集（当前参数 Nil），helper 泛型也非递归；未来扩展不得漏掉嵌套依赖|
|B11 L44|Inject 与 Singleton 无论 helpers 是否为空都放入 dependencies|raw 的无 helper 输出仍会有 Inject import；不要误把 Template 的条件 append 当成唯一来源|
|B12 L47|按 M1…M6 顺序传入 model；没有 I/O、runner 调用、ledger 写入或 artifact 注册动作|Builder 只推导；defaultBody 是延迟待渲染代码，不在生成时执行|

`firstLower` 只是首字母小写，不是 PascalCase/lowerCamelCase 分词器；[NamingConventions L157–181](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L157-L181) 的 `scalaIdentifier` 也只为集合内关键词加反引号。本族 class/method 名未调用它；构造参数也未调用它。目标不能通过保留不合法原标识符或修改稳定业务 ID 来回避命名规则。

### 5.1 与接口制品必须共同裁定的真实矛盾

[ConnectorBuilder.scala L15–34](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/ConnectorBuilder.scala#L15-L34) 遍历 **全部** `meta.methods`；`scriptParam.toSeq` 生成 `FieldDef(p, TypeRef.String)`；impl 名通过 [NamingConventions.scala L70](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L70) 得 `connectorName + "Impl"`。接口 [Template L24–41](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/ConnectorTemplate.scala#L24-L41) 输出 `def method(params): scala.concurrent.Future[R]` 和 `@ImplementedBy(classOf[Impl])`。

因此不能把 impl Builder 的“同名同签名”注释当作事实：两个方法时只实现第一个；scriptParam 存在时 impl 仍无参数；impl metadata.name 可以不同于接口推导的 `connectorName + "Impl"`。本文既不修 BC，也不暗改 approved-target；这些属于 D1/D3 的输入或接口裁决。

## 6. Template 输出 construct / RHS 顺序账

原文第 3.3 节和本表合读，不能以链接替代 RHS。

|顺序/稳定位置|raw 输出规则与完整 RHS/槽|approved-target 与缺口|
|---|---|---|
|T1 package|`package ${model.selfType.packageName}`；DSL 的 packageDecl.code 直接插值|保持 infrastructure.connectors；不能输出与 iface 同包|
|T2 imports 输入|dependencies.toList 按 fqn 排序→fqn→排除空串、等于当前包、以 java.lang 起始者；append iface FQN、`scala.concurrent.{ExecutionContext, Future}`、`javax.inject.Singleton`；有 ctor 再 append `javax.inject.Inject`；distinct|不能仅照抄四个硬编码 import；不递归抓源码里的 FQN 充当依赖收集|
|T3 imports 最终顺序|[CodeGenerationDSL L20–22](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L20-L22) **再次 imports.sorted**，每项前置 `import `，以单换行连接；不是 append 后保序、也不是 Scala/框架/项目三组|A 默认保留该确定顺序；不凭 B 的分组要求把 A 基准悄悄改掉。原有 unused ExecutionContext/无 ctor 时 Inject 仍明确记债|
|T4 文档注释|空行后 `/**`；` * <selfName>: Connector Implementation`；下一行固定中文“机械委托…”；` */`|保留职责说明，不声称生成物拥有子进程机制|
|T5 类注解|总是 `@Singleton` 独立一行|该注解不保证所需注入绑定已存在|
|T6 类声明|`class <selfName>`，非 final/abstract/case；无类型参数/上下界；extends `<interfaceType.name>`，无父构造实参|不添加多余 companion、BaseConnector 或万能 dispatcher|
|T7 主构造，有 helper|在类名后插入 ` @Inject() `，随后 `(<p.name>: <p.typeRef.signature>, ...)`；每个 FieldDef 按原序，原名未 escape；没有 val/var/private/implicit/default|保留真实 helper 注入；长参数按用户排版要求可换行但不得重排。没有 `(implicit ec: ExecutionContext)`|
|T8 主构造，无 helper|ctor 字符串空，不发 `()`，无 `@Inject()`；`class X extends I {`|不能从 legacy 无条件注入空 ctor 复制假依赖|
|T9 methods loop|`model.methods.map` 原序，成员间 `\n\n`；每个都有下面 T10–T14|raw Builder 只给一个，但 Template 的泛用 Seq 非黑箱|
|T10 参数列表|每字段 `${scalaIdentifier(p.name)}: ${p.typeRef.signature}`，`, ` 连接，空 Seq 得 `()`；一个非 implicit 参数组|没有默认参数、柯里化或可变参数；已有 FieldDef defaultValue 在此不消费|
|T11 override/返回|`  override def ${m.name}($params): scala.concurrent.Future[${m.returnType.signature}] = {`|有已导入 Future 且无歧义时目标用 `Future[R]`，是“正常 import”显式格式覆盖；不能改 effect、内层名义类型或包装层数|
|T12 MANUAL 起始|方法体首行四空格 `// ==== BEGIN MANUAL ====`|保留可识别标记；不当成“有标记即受保护”——必须接 writer|
|T13 锚/完整 body|若 anchorNoteId 有值：annotateKnowledge 结果渲染四空格 `// @knowledge <id>\n`；否则空串。之后 `defaultBody.split("\n").map(l => "    " + l).mkString("\n")`|body 的每一行均来自明确源码槽；不自动变成 async、recover 或成功回执。注释在 MANUAL **内部**，合并旧块时不能假设自动更新知识后缀|
|T14 MANUAL 结束/方法闭合|换行四空格 `// ==== END MANUAL ====`，再两空格 `}`|marker 配对、def 名和出现序参与旧块匹配，迁名必须有映射或明确冲突|
|T15 类闭合/文件结尾|类内方法前后各空行；顶层 `}`；末尾换行|整文件格式比较不得把空白压平|
|T16 非本模板构造|无嵌套 object/trait/case class/type alias、辅助构造、self-type、lazy/implicit val、var、继承类型参数、额外初始化语句或重载派生|不能拿 formal Installed/Bindings/OperationContext 整套替入本族并称逐项复刻|

生成后的方法副作用精确为：进入方法→执行 MANUAL 中的 body。raw 默认要么一次直接 `runner.run(...)` 并原样返回其结果，要么求值 `???`。没有 `map`、`recover`、重试、日志、timeout、Effect.persist、thenReply、EventStream publish 或关闭资源逻辑。`???` 会在求值处未实现失败，不应被描述为一个已构造的失败 Future。

文件外的 writer 顺序与源代码正文分账：

1. [writeArtifact L388–412](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L388-L412) 先记录 deps/noteIds/morphisms，scope 判断后加 fingerprintHeader 并进入领地写入；不能把 ledger 记录等同文件已写。
2. [L94–113](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L94-L113) 的 annotateKnowledge 只在已有 hash 表中取到时追加 `@hash`；fingerprintHeader 为 `// @generated by CodegenMain:<version>\n`，可另有 knowledge-release 行。没有来源就不造 hash/noteId。
3. [writeTerritorial L461–500](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L461-L500) 处理冻结/ADD/COVER/MERGE/KEEP。`mergeManual` [L99–180](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/WriteTerritory.scala#L99-L180) 以最近 def 名分桶、同名按出现序、无名按桶内序；旧块无落点拒写，新方法保留新默认块。`DefAnchorRegex` 只识别 `[A-Za-z_][A-Za-z0-9_]*` 方法名；关键字反引号/重载迁移不是自动正确。

## 7. JS 当前链路：formal、legacy、family 分别定位

### 7.1 legacy：有完整字符串 emitter，但不是当前公共 generator 合同

固定 [emit.mjs L1–64][LE] 全文如下。它的“1:1 restoration”只是文件注释，不能覆盖上面的内容差距。

```javascript
#!/usr/bin/env node
// === connector-dsl emitter — 1:1 restoration of old codegen ===
// Generates: <Name>Connector (trait) + <Name>ConnectorImpl
// Usage: node emit.mjs <spec.json> <out-dir>

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const [specPath, outDir] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
mkdirSync(outDir, { recursive: true });

const pkg = spec.package || "net.imadz.infrastructure.connectors";
const name = spec.name;
const ifaceName = `${name}Connector`;
const implName = `${name}ConnectorImpl`;

const methods = (spec.methods || []).map(m =>
  `  def ${m.name}(${m.params || ""}): ${m.returnType || "Future[Unit]"}`
).join("\n");

const implMethods = (spec.methods || []).map(m =>
  `  override def ${m.name}(${m.params || ""}): ${m.returnType || "Future[Unit]"} = {
    // ==== BEGIN MANUAL ====
    ???
    // ==== END MANUAL ====
  }`
).join("\n\n");

const iface = `package ${pkg}

import scala.concurrent.Future

/**
 * ${ifaceName}: External system connector interface
 */
trait ${ifaceName} {

${methods}

}
`;

const impl = `package ${pkg}

import javax.inject.Inject
import javax.inject.Singleton
import scala.concurrent.ExecutionContext
import scala.concurrent.Future

/**
 * ${implName}: ${ifaceName} implementation
 */
@Singleton
class ${implName} @Inject() ()(implicit ec: ExecutionContext) extends ${ifaceName} {

${implMethods}

}
`;

writeFileSync(join(outDir, `${ifaceName}.scala`), iface);
writeFileSync(join(outDir, `${implName}.scala`), impl);
console.log(`emitted ${ifaceName}.scala, ${implName}.scala`);
```

`parse.mjs` [L1–5][LP] 的全部逻辑是从 CLI 取三个位置量 `const [_, b, o] = process.argv.slice(1)`，`writeFileSync(o, readFileSync(b, "utf8"))`，打印 `spec from binding`；不是 Connector metadata Builder。`generator.json` [L1][LM] 精确为：

```json
{"name":"connector-dsl","version":"0.1.0","baseline":"new","entrypoint":"emit.mjs","golden":"../../golden/connector-dsl"}
```

可达性证据不是文件夹名字：

- direct `node emit.mjs spec out` 是上述真实入口，读 JSON→mkdir→先写 iface→写 impl→console；没有 MANUAL merge、fingerprint、ledger 或 anchor。重复调用会直接覆盖目标同名文件，即使旧文件已有 MANUAL 算法。
- [src/core/manifest.mjs L8–26](../baseline/js/src/core/manifest.mjs#L8-L26) 的公共 legacy manifest 要求 inputSchema/products/artifactKinds/output；此 JSON 缺这些字段。[src/core/generate.mjs L23–41](../baseline/js/src/core/generate.mjs#L23-L41) 固定 import `generate.mjs`、调用导出 generate，不消费这里的 `entrypoint: emit.mjs`。所以不能声称 `truthsrc generate --generator connector-dsl` 已打通。
- formal [registeredProductProducer L92–101][CLI] 白名单没有 connector-dsl；也不能把它塞到 `generate-products` 就认为可运行。

|MBT/产物层|legacy 事实|相对传统目标|
|---|---|---|
|Model|松散 spec，package/name/methods；m.params/m.returnType 是任意源码串|缺 self/interface TypeRef、helpers、deps、独立结果类型、noteId；不能以改文件名当复刻|
|Builder|`||` 默认包、后缀拼接、methods 全遍历、默认参数串空、返回 `Future[Unit]`|与 BC 首方法/ProcessResult/runner 默认规则不同；显式对账，不能吞多方法退化成一个|
|Template|同包 trait+impl；四条固定 imports；无条件空 `@Inject()` 和 implicit ec；每方法 `???`|保留 `???` 未实现状态，补真实机械委托数据才能替换；移除凭空 EC 构造依赖|
|Writer|两个 `writeFileSync`，输出不含 package 子目录|拆分后端口/实现各自布局并交给公共 writer；原始直接写入不应成为 formal 路径|

### 7.2 formal 银行路径：TechnicalPorts 是近似职责，不是本族实现

精确调用链：

1. [generate-cli L17、92–101][CLI] 注册 `scala-cqrs-play-service`。
2. [play-service/generate.mjs L16–24、59–70](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L16-L70) 继承 `createEffectRegistry('2')`，仅 aggregate/invariant 等在此替换；没有插入 connector-dsl。
3. [produce-effect.mjs L6–19](../baseline/js/generators/scala-cqrs-application/produce-effect.mjs#L6-L19) 继承 applicationRegistry；[produce.mjs L17–33](../baseline/js/generators/scala-cqrs-application/produce.mjs#L17-L33) 的 `finite-host-dsl` 调用 `renderTechnicalPorts`。
4. renderer [L2–56][RT] 按 `saga-host-contract.hosts` 输出 `technical-port` 文件，路径经 `pathFor(pkg, 'application/'+stem+'TechnicalPorts.scala')`；`stem=h.id.replaceAll('-', '_')`。这解释银行现存路径与符号，不靠目录名猜入口。

该 renderer 没有本族独立的 Model/Builder/Template；它把查找 selected artifacts、pin/owner 推导、类型命名、字符串正文和 entry 元数据放在同一个函数中。以下按完整循环规则列出其产物构造与保留义务，避免把混合文件一删了之。

|JS 源行/construct|完整规则/RHS 与目标归属|
|---|---|
|L3–11 查找|field 按 reference-layout declaration 的 key 找；nonNull 对 nominal 递归 `.value`，textualValue 同样解包；selected 限 artifact.status=`selected`；owner 同时核 port ref/version 与 implementation ref/id/version，数量不等 1 抛 `exact selected technical port owner required`。此严格绑定不等 BC helperNames|
|L12–15 输出/pins|每 host 一个文件；pkg=packageFor(saga.ref.context)；pins 按 h.technicalPorts 顺序，pin 从 selected artifacts.ports 找同 ref/version，method=symbol(port.id.replaceAll('-', '_'))|
|L30–34 顶层 trait|package=`<pkg>.application`；import Future、strict 的 OperationIdentity/TransactionIdentity；`trait <stem>TechnicalPorts`；每 pin 一条 role 注释，`def <method>(input: <pin.inputType>): Future[<pin.outputType>]`。类型由 typeName，nominal 发 FQN|
|L35 required/校验|companion object；`required: Vector[(String,String,String)]` 按每 pin 的 port.id/implementation.id/version；`requireInstalled(actual)` 要求 actual 非 null 且每个 required 的 actual.get(port).contains(id -> version)|
|L36–39 所有权/符号引用|两行“手写装配、非行为证明”注释；BindingOwnership 七个 String 字段按 port/role/artifact/artifactVersion/implementation/implementationVersion/boundary 顺序；bindingOwnership 每 pin 写 owner 的 id/version 及固定 `handwritten-composition-root`；secretReferences 仅 deployment role 收集 owner.deployment.secretRefs 的 id/provider（不是读取秘密值）|
|L40–42 支撑类型|`OperationNotExecuted(identity: OperationIdentity,evidence:String,safeToRetry:Boolean) extends RuntimeException(evidence)`；`CompletionContext(original:<entry.inputType>,identity:TransactionIdentity)`；`Implementation[I,O](id:String,version:String,run:I=>Future[O],operation:(I,OperationIdentity)=>Future[O]=null,completion:(I,CompletionContext)=>Future[O]=null)`；Bindings 每 pin 一个 `Implementation[inputType,outputType]` 字段|
|L43–46 Installed|`final class Installed private[<stem>TechnicalPorts](private val bindings: Bindings) extends <stem>TechnicalPorts`；每 pin 一条 def，body 由 installedRun 决定，不用 MANUAL|
|L17–23 external-submission/external-query/readside|keys 来自 h.association.inputKeys；先 require input 非 null 且每个 key 通过递归 nonNull；`val pending=bindings.<method>.run(input)`；require pending 非 null；`pending.map` 检查 result 非 null。submission 将 result 绑定为 record 并逐 key 与 input 相等；query/readside 用 result.forall，record 非 null 且逐 key 相等；最后原样返回 result，显式 ExecutionContext.parasitic。顺序与校验不得在拆分时丢掉|
|L24–28 deployment/普通分支|deployment 先要求 input、secretRef 及解包值均满足符号引用登记，再调用 bindings.method.run(input)；其他 role 直接调用 bindings.method.run(input)。这些不是通用 Node runner 默认算法|
|L47–48 额外方法|authority/result-delivery 加 `<method>Completion(input,context)`，直接 `.completion(input, context)`；phase-execute/phase-query 加 `<method>Operation(input,identity)`，直接 `.operation(input, identity)`。不能只保留 run 而丢两种上下文|
|L50 declarations|Installed 内 val，Map 每 pin 的稳定 port.id → bindings.method.id -> version|
|L51–53 install|先 require bindings 非 null；按 pin 顺序要求对象非 null、id/version 精确一致、run 非 null；authority/result-delivery 再要求 completion 非 null，phase-execute/phase-query 再要求 operation 非 null；最后 `new Installed(bindings)`|
|L54 entry|kind=`technical-port`；sources=`[h.source]`；footprint 原传；deps 只从顶层 input/output type.form=`nominal` 生成 domain/values 路径并去重，不递归可选/集合类型；不冒充完整 TypeRef import 收集|

银行 [完整固定文件 L1–240][BANK] 与上述规则可作结构对应。其局部清单是：entry/association 2 项；`BankPayment{0,1,2}{Prepare,Commit,Compensate}{Execute,QueryPort}` 18 项；`{Succeeded,RejectedBeforeEffects,Compensated,RecoveryRequired,OutcomeUnknown}{Authority,Delivery}` 10 项，共 30 pin。字段/方法顺序即该文件实际顺序：

- L1–68：generated header、package/import、trait 和 30 个方法；返回类型保留各名义输入/receipt，以及 query 的 `Option[Receipt]`。
- L69–112：companion、required、requireInstalled、注释、BindingOwnership 与 30 行所有权、空 `secretReferences=Vector()`、OperationNotExecuted、CompletionContext、Implementation 的两个 null 默认槽。
- L113–144：Bindings，30 字段与 trait pin 一一同序。
- L145–205：Installed，30 个 run 转发、18 个 Operation 转发、10 个 Completion 转发，然后 declarations。没有本例的 external-submission/query/readside/deployment 分支；不能因这份 payment 文件没出现就删 renderer 的其他分支。
- L206–240：install，先总体 require，再 30 个 binding require，最后 new Installed。

它的输入/操作身份/回调绑定与 Scala `ConnectorImplMetadata` 不同。**本族实施不得把银行整个 TechnicalPorts 替成无参 runner.run()**。该复合文件暂不迁移；是否拆端口与基础设施 Installed，由其唯一 formal assembly owner 在 D4 决策后完成另一个有范围的包，不由本族 owner 顺手删改。现有 FQN、PascalCase 方法/字段、snake_case 类型名是可见表达差距，身份字符串仍原样保护。

### 7.3 family：有 bridge，不是 formal 的 ConnectorImpl 接线

- [module-seams-v1/generate.mjs L13–44](../baseline/js/generators/scala-cqrs-module-seams-v1/generate.mjs#L13-L44) 要求完整 manifest 和 live implementation capture，调用 buildModels→implementationBuildInputs→render。formal CLI 虽注册该 producer，但 [generate-cli L45–63、79–80][CLI] 要求它走 generate-project；不能直接用 generate-products 绕过 capture。
- [build-models.mjs L112–146](../baseline/js/generators/scala-cqrs-module-seams-v1/build-models.mjs#L112-L146) 将 port 方法匹配为 resolvedMethod（校验 port/method identity，附 delegateMember、mappingSource），bridge 的 delegate 来自 implementation id，delegate 字段经 resolveNameSet 避免与 method 冲突；只有 delegate.construction=`class` 才 injected，object 直接静态引用。
- [render.mjs L13–30](../baseline/js/generators/scala-cqrs-module-seams-v1/render.mjs#L13-L30) 明确 role=`bridge`→bridgeTemplate、kind=`module-seams-bridge`；不是名为 connector 的目录推论。
- [templates/scala.mjs L19–34、58–72][FT] 输出 package；`final class <bridge>`；若注入，`(private val <delegate>: <FQN>)`；extends port FQN；逐 method 发 override、全部参数、resultType（effect=future 才包 Future），body 为 `this.<delegate>.<delegateMember>(<parameters in order>)` 或 object FQN 调用。没有 @Singleton、@Inject、MANUAL、script/defaultBody、noteId 注释、BC import 排序。
- 共享 [scala-target/model.mjs L9–14、161–180](../baseline/js/lib/scala-target/model.mjs#L9-L180) 将 bridge 限在 kernel、domain.ports、一个 pure-implementation 依赖，且不许 bridge 消费 effectful port。因此它是纯计算桥接参考，不可直接赋予 Node I/O 语义。
- [play-application-v1/generate.mjs L23–34](../baseline/js/generators/scala-cqrs-play-application-v1/generate.mjs#L23-L34) 与 [render.mjs L16–46](../baseline/js/generators/scala-cqrs-play-application-v1/render.mjs#L16-L46) 是独立十产品闭包/API/服务/运行装配路径。其显式 add/named 列表没有本族 ConnectorImpl；不因它有 application-root 就推断已消费 legacy connector emitter。

结论仅限已追踪链路：legacy 独立脚本有近似输出；formal 银行调用技术端口机制；family 有受不同合同约束的 bridge。这三者都不是已经实现的本族 MBT 替身。

## 8. raw-scala → approved-target 与实际 diff

### 8.1 允许的目标差异与不得偷改的范围

1. 已批准业务根三层。本族 Scala 的 application.connectors/infrastructure.connectors 本来符合；helper 的 infrastructure.process 仍在第三层，明确是手写源目录。接口的 `@ImplementedBy` 是否继续使用见 D3，不能以目录改好代替 DI 一致性。
2. self/interface/helper 类型以及文件用 PascalCase、方法/参数 lowerCamelCase；使用共享 resolver，避免 `ConnectorConnectorImpl`。稳定 operation/implementation/knowledge ID、脚本内容、名义结果类型不改。
3. 无歧义的 `scala.concurrent.Future[R]` 目标写成已导入的 `Future[R]`，属于用户正常 imports 要求的显式覆盖；其 Future effect 不变。原始 imports 排序和原始 unused 项仍记录，不用清洗后的串替代 raw。
4. 长构造参数/方法签名目标逐行排版；模型仍是 ordered FieldDef，不重排同类型参数、不引入隐式 ec。
5. `defaultBody`、MANUAL 以及 `???` 是明确保留槽；没有获准的 runner ABI/业务实现就没有可以宣称成功的目标 RHS。目标不发假回执，不把缺失的 ProcessResult 改成 Unit。
6. D1–D7 没裁定的差异不能提前记成“已批准完整行为”。尤其不能为迁移把多个方法压成首个、把 scriptParam 忽略、把 OperationIdentity/CompletionContext 擦掉。

### 8.2 实际 minus/plus：legacy 模板正文与目标结构

**结构性对照，非同输入字节比较，非可直接应用的生产补丁。** minus 是 [emit.mjs L44–60][LE] 内真实 Scala 模板正文（不含外围 JS 赋值）。plus 是第 3.3 节 BC Template 的完整类级展开式；`pkgDecl/importDecl/constructorParams/methodsCode` 的具体规则已经在 T1–T15 给出，`methodsCode` 使用目标的 Future 简名覆盖。`${...}` / `$...` 表示已有 Scala 模板槽，不是虚构银行业务或生成成功文件。

```diff
--- actual-js/legacy-emit.mjs:Scala-impl-template
+++ approved-target/ConnectorImpl:template-expansion
@@ -1,16 +1,14 @@
-package ${pkg}
+${pkgDecl.code}
 
-import javax.inject.Inject
-import javax.inject.Singleton
-import scala.concurrent.ExecutionContext
-import scala.concurrent.Future
+${importDecl.code}
 
 /**
- * ${implName}: ${ifaceName} implementation
+ * ${model.selfType.name}: Connector Implementation
+ * 机械委托给注入的手写基建（子进程机械在手写区·不在此生成物）。
  */
 @Singleton
-class ${implName} @Inject() ()(implicit ec: ExecutionContext) extends ${ifaceName} {
+class ${model.selfType.name}${if (hasInjectedCtor) " @Inject() " else ""}$constructorParams extends ${model.interfaceType.name} {
 
-${implMethods}
+$methodsCode
 
 }
```

方法级相同边界的真实正文对照，minus 是 [emit L23–27][LE] 的原文，plus 是 [Scala Template L41–45][T] 加已声明的 Future 简名覆盖；不是把所有默认体替成实现。

```diff
--- actual-js/legacy-emit.mjs:per-method-template
+++ approved-target/ConnectorImpl:per-method-template
@@ -1,5 +1,5 @@
-  override def ${m.name}(${m.params || ""}): ${m.returnType || "Future[Unit]"} = {
+  override def ${m.name}($params): Future[${m.returnType.signature}] = {
     // ==== BEGIN MANUAL ====
-    ???
+$anchor$body
     // ==== END MANUAL ====
   }
```

这里 `$body` 的合法 raw RHS 集合**仅**是 B6–B8 的 runner.run(script)、runner.run()、`???`，或者明确保留的已有 MANUAL 内容。没有 helper 的分支仍是 `???`。`$anchor` 只来自已有 noteId/hash，不从方法名编造。

raw-scala 与目标的有限 import 表达差异另账：

```diff
--- raw-scala/ConnectorImplTemplate.scala:L41
+++ approved-target/ConnectorImpl:method-return-expression
@@ -1,2 +1,2 @@
-  override def ${m.name}($params): scala.concurrent.Future[${m.returnType.signature}] = {
+  override def ${m.name}($params): Future[${m.returnType.signature}] = {
     // ==== BEGIN MANUAL ====
```

其余行为没有获准隐式变化。银行 actual-js 固定全文在 [BANK][BANK]，其对本族的比较结论是“输入/责任不等价、不可据此造 Node Connector 文件”，不是给它打一个会删绑定/回执合同的补丁。

## 9. 胶水、资源和实现槽合同

|完整符号/来源|需要的实际接口/语义|本次证据和阻断|
|---|---|---|
|`javax.inject.Singleton`、`javax.inject.Inject`|Singleton 类注解；helper 非空才有 constructor @Inject；真实 DI 容器需能构造 helper|BC [scaffold/build.sbt L50、72](../baseline/bc/scaffold/build.sbt#L50-L72) 指定 Scala 2.13.14、`libraryDependencies += guice`；未核实际 javax.inject/Guice JAR 坐标/字节，不能据源码 import 称已可加载|
|`scala.concurrent.Future`、`scala.concurrent.ExecutionContext`|Future[R] 是调用结果；raw 仅导入 EC，没有注入 EC 或调度 Future 运算|若 runner.run 自身需要隐式 EC，则现 raw 构造不提供；D2 要核外置 ABI，而不是照 legacy 随手加 implicit 参数|
|`<base>.application.connectors.<connectorName>`|必须与 impl 的方法集合、参数、Future 内层返回类型一致|接口模型由另族拥有；D1/D3 共同裁定|
|`<base>.application.connectors.<returnTypeName>`，fallback 为 `<base>.application.connectors.ProcessResult`|名义手写结果类；不能与同构 result/receipt alias 合并|这里只是 TypeRef，未观察其实现；未创建假的 case class 或空成功|
|`<base>.infrastructure.process.<helperName>`|defaultBody 对第一个 helper 调 `run(script: String)` 或 `run()`，且结果应符合 Future[R]；其余 helper 只被注入|外置源/发布库的签名、超时、故障、进程启动/关闭和测试义务均需单独确认；本文没有调用真实工具|
|`com.google.inject.ImplementedBy`（端口伴随依赖）|接口指向具体 `connectorName + "Impl"`|不是 impl 模板自己的 import；不能忽略 D3 类名一致性，也不能私自改成另一套绑定框架|
|`net.imadz.codegen.scaffolding.cqrs.CQRSApplicationGenerator.annotateKnowledge`、`WriteTerritory.mergeManual`|生成期锚注释/手写块保存，不是生成应用运行库|用共享 writer 对接最终字节；现 legacy 两次 writeFileSync 没有此保护|
|`net.imadz.infra.saga.strict.OperationIdentity`、`TransactionIdentity`|只属于 formal TechnicalPorts 的 operation/completion 传递|[generate-cli L114–125][CLI] 对 formal 应用路径读取本地 `net/imadz/saga-core_2.13/0.3.0` JAR 并比 SHA，带 pipelines 再核 Monarch pins；这是 CLI 源码事实，本文没有读取或验证这些 JAR，也没有批准升级|

本族不直接消费 `common-core` CommandHelper；BC scaffold 的 `common-core % 0.2` 不能被拿来推断任一版本有全部命令胶水能力。本族也不是聚合命令处理器：

- `CommandHelper` 仍由其 owner 放在 `application.aggregates.behaviors`，保留 `toParam/createFailureReply/createSuccessReply`；不能把 connector method 转成 helper 空壳。
- typed replyTo 仅按明确合同用于 application Actor commands；不向 connector 的纯领域参数/事件注入 ActorRef。
- 若外部调用完成后进入聚合行为，失败不 persist，成功 persist/apply 后的 thenReply 读取更新 state，仍是聚合行为/胶水的义务。Connector 本身的 Future 完成不能证明这些。
- `replyWith` 不等于 `replyWithAndPublish`；不得因“调用成功”而额外发布事件。
- 不改变 protobuf 字段号/包身份、PID、serializer ID/绑定范围、nominal 类型、幂等/operation 身份或 overflow 行为。本文不存在把 `addExact` 换 `+` 的授权。

## 10. 拟实施写集合、共享接口和唯一 owner

以下均为第二阶段候选，**本阶段没有写这些路径**。相对路径均以 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/` 为根；标 proposed 的文件不是现有实现。这样可以独立保存本族规格，而不抢其他组的源文件。

### 10.1 本族独占候选

|路径/状态|职责及输入输出|
|---|---|
|`generators/scala-cqrs-connectors-v1/connector-implementation/model.mjs`（proposed）|M1–M6/MM1–MM5 的结构合同、ordered FieldDef、TypeRef、明确 defaultBody 槽及来源；不放整文件 content|
|`generators/scala-cqrs-connectors-v1/connector-implementation/build-model.mjs`（proposed）|实现 B1–B12 经裁定的输入范围；显式接口 lookup、helper 顺序、返回类型、依赖；拒绝未支持的语义，不默默截断方法|
|`generators/scala-cqrs-connectors-v1/connector-implementation/template.mjs`（proposed）|只渲染 T1–T15 与已批准差异；返回结构化 source entry 所需正文/位置片段，不自行写盘|
|`test/codegen-parity-connector-implementation.test.mjs`（proposed）|对应第 11 节 fixture 的模型/构造/RHS/拒绝性与 MANUAL 保护断言；当前不存在且未运行，不能作为既有测试名调用|
|`docs/codegen-parity/fixtures/connector-implementation/`（proposed）|经批准后保存无银行业务的双端语义适配、来源对照；本阶段未创建任何 fixture|
|`docs/codegen-parity/expected/connector-implementation/`（proposed）|经 CLI 真生成/审定后的完整文件集合，raw/target 分开，不复制当前银行作“同输入金样”|

### 10.2 仅集成者/共享 owner 可写的依赖集合

- `generators/scala-cqrs-connectors-v1/generate.mjs`、`generator.json`（均 proposed）：**唯一 Connector 文件组装 owner = `connector-assembly-integrator`**。负责完整 iface+impl plan、重复路径检查、dependencies/footprint、最终字节→fingerprint/anchor。外部端口组拥有 iface Model/Builder/Template，本族只拥有 impl 子目录；二者不得分别注册同一物理文件。
- `lib/products/generate-cli.mjs`、`lib/products/registry.mjs`、`lib/project/derive.mjs` 及 proposed `lib/products/connector-contract.mjs`：产品 schema/version、metadata 映射和正式路由的共同接入，属于 D4。不能在本族模板内偷偷消费散文或继续直读第二份 spec；connector-dsl 的旧 manifest 不符合此合同。
- `lib/scala-target/naming.mjs` 的 [resolveName L77–82、resolveNameSet L87–109、resolveArtifactPath L111–119](../baseline/js/lib/scala-target/naming.mjs#L77-L119) 可以复用；需要明确 profile/完整绑定/稳定身份与碰撞范围。其 repeated suffix 分支是拒绝而不是自动删字，调用方不可猜它会去重成功。
- `lib/scala-target/model.mjs` 是当前共享结构设施，但已有 rolePackages/bridge 约束不能直接冒充 Connector layout。TypeRef/signature/import 冲突处理以及 `infrastructure.connectors/process`、`application.connectors` 的 shared layout 扩展由 `shared-layout-types` owner 定义；不要每组新写 safeName/typeName。
- `src/core/generate.mjs`、`src/core/apply-preflight.mjs`、`src/core/code-mappings.mjs`、`src/core/anchors.mjs`：公共 writer/归属/最终字节回锚机制仅由 `shared-writer-anchors` owner 接续。本族提供 source/knowledge mapping 数据，不直接改 ledger/anchors。
- `generators/connector-dsl/emit.mjs`：若保留 direct 兼容工具，其 iface+impl 同文件源码的拆分/替换仅由上述 Connector assembly owner 负责。本族不在另一个 agent 同时修改 iface 时改整份 emitter。旧 `parse.mjs` 的 binding copy 不能升级成事实源；退役或受限兼容需要 D4。
- `generators/scala-cqrs-play-service/generate.mjs`、`generators/scala-cqrs-application/produce.mjs`、`render-technical-ports.mjs`：**银行复合文件唯一 owner = `formal-technical-ports-assembly-integrator`**；当前不在本族写集合。若决定拆分，必须携带第 7.2 节每个 construct/role 和全部回调/RHS，不让另一个制品以相同路径覆盖。
- `generators/scala-cqrs-module-seams-v1/*` 与 `scala-cqrs-play-application-v1/*` 只作为独立 family 的复用/限制参照，本族不修改其 pure bridge/evidence gate。

依赖顺序：`shared-layout-types` → `external-connector-port` 的接口/结果类型与 D1/D3 → `external-implementation-capture` 的 runner ABI/所有权 → 本族 MBT → `connector-assembly-integrator` → `shared-writer-anchors`。与 external-connector-port/shared writers/formal TechnicalPorts owner 的共同文件修改必须串行归单 owner，不凭不同 artifact 名允许冲突写。

### 10.3 退役与回锚迁移

1. 先为每个旧物理 iface/impl 文件核可消费入口和所有权。legacy direct 输出无 generated 指纹，不能当作默认可 COVER 文件；含 MANUAL 时须捕获原块，迁名须明确映射，否则 fail closed。
2. 老 iface（默认 infrastructure.connectors）→ application.connectors；老 impl → infrastructure.connectors；同步服务调用方 imports、@ImplementedBy、注入构造和 build 源根。不留旧包永久转发壳掩盖错误布局。
3. 输出只写新隔离 target；旧银行 TechnicalPorts/手写实现不删不移动，除非 D4 后另列迁移清单。旧输出 RETAINED 不等已退役。
4. 先确定最终格式与 MANUAL merge 字节，之后更新 fingerprint、ledger file ownership、成员 source spans、anchor。noteId/morphisms 缺口需 D5，不凭类名反推知识身份；不得给作者树添加 @knowledge 补洞。
5. shared writer 的 [prepareEntries L187–190](../baseline/js/src/core/generate.mjs#L187-L190) 将旧未计划 owner 文件列为 RETAINED；它不是自动删除器。移除旧输出需显式受控计划，不能以重新生成暗中清理。

## 11. 后续验收 fixture、CLI 形状和副作用

**本节全部未运行。** CC=`not-measured`，普通方法目标 ≤5，6–10 逐方法说明，>10 先重构或获逐方法例外；不以 String/Any dispatcher、删 guard 或平均分达标。普通嵌套目标 ≤2。

### 11.1 无银行语义的 proposed fixture 集合

每个 fixture 显式提供 implName、connectorName、全部接口方法及其顺序、返回名义类型、helperNames 顺序、script/scriptParam、noteId/已有 hash；同时声明 single/multi profile。BC 与 JS adapter 的字段表须逐项相等，不能各自从文字猜默认值。

|fixture id|需要观察的完整文件/拒绝内容|
|---|---|
|`one-helper-script`|一个方法、一个 helper、固定 script；interface/impl 两文件（接口归另族）+独立手写结果/runner 的供给清单。检查 ctor/@Inject/import/Future 内层类型、一次 run(script)、noteId|
|`one-helper-no-script`|run() 分支；只有真实外置 ABI 声明无参重载才能进入行为验证；不存在则明确阻断|
|`no-helper`|无显式 ctor/@Inject，raw 仍有 Inject import；`???` 原样可见，不计为已完成业务实现|
|`two-helpers`|参数依次保留；raw 只第一个 helper 被 body 引用；不用额外 helper 推断新操作|
|`empty-or-unresolved-interface`|记录 raw fallback 与端口不满足风险；target 按 D1 拒绝或明确限定兼容，不造 ProcessResult 实现|
|`two-methods-script-param`|raw 仅首方法、Nil 参数与完整接口冲突的回归；D1 未定前不得把忽略后者作为验收成功|
|`name-type-boundaries`|重复后缀、关键词、大小写文件碰撞、同名类型冲突、复合返回名、script 含引号/换行/反斜线；命名失败不改稳定 ID；字面量变化不改变 script 值|
|`manual-evolution`|无 note、有 note、有 hash；已有两块、插入新方法、移除/改名/重载块。旧 body 字节保存，孤儿拒绝，不虚称注释自动刷新|
|`profile-and-zero`|空 connectors 为 0；single 和 raw multi 的 app fallback 分开断言；multi 改 glue 的目标只有经 D6 批准后另存 expected|

完整对账包括文件路径集合、package/imports及顺序、类/构造参数、方法顺序/参数/返回类型、MANUAL 每一行、调用实参、默认值、锚位置、fingerprint 头。仅允许白名单逐项豁免生成器版本头差异、明确平台换行差异、已批准 Future 简名/长参数排版；不得压平所有空白。两次相同输入 byte-stable；一个脚本/方法字段改动后的局部 diff 与 source→code 查询需独立验证。

### 11.2 已存在入口的精确命令语法与当前限制

下列绝对 fixture/输出路径均为**拟用新资产/隔离目录**，本次未创建，也不声称命令现在可完成本族。语法取自已读入口；没有虚构 `--artifact`、`--scope connector` 或过滤某个 spec 的新 flag。

**A. 现有 legacy direct 脚本的单族对照入口**（输入只包含拟定 Connector fixture；不是 formal 验收替代品）：

```sh
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/connector-dsl/emit.mjs \
  /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/connector-implementation/legacy-spec.json \
  /tmp/codegen-parity-connector-implementation/legacy
```

副作用精确到已读脚本：读取 spec JSON；递归 mkdir out；直接写两个 Scala 文件（覆盖同名旧文件）；打印 stdout。没有图/ledger/anchor/缓存/依赖下载/子进程实现调用；也没有 MANUAL 保存。必须先选不存在的新 out，禁止对既有生成应用使用。

**B. 后续正式产品路线的 CLI 形状**，producer 目录是 proposed，D4 注册前会在 registeredProductProducer 阻断；request/options 同样必须先经审定创建，不能现在伪造：

```sh
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/connector-implementation/request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-connectors-v1 \
  --out /tmp/codegen-parity-connector-implementation/formal \
  --options-json /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/connector-implementation/options.json \
  --plan
```

[generateProductCli L66–88][CLI] 支持且要求这四个值参数，唯一 plan 开关是 `--plan`。如 producer 选择 live 外置实现 capture，则该入口连 plan 都不适用，要用 C。已读流程里 --plan 读取输入/manifest、内存 compileProductSet/生成 plan，不调用 applyEntries；非 plan 则写生成 entries、`truthsrc.ledger.json`、`anchors.json`，走 final-bytes/ownership 预检；这条产品入口不自动打开 project SQLite 图。若复用现有 application producer，还会读取其冻结 runtime JAR 与外置目录进行校验；未授权下载或 publishLocal。新 Connector producer 的 side-effect 契约须固定为纯 plan，不能把 runner.run 带到生成阶段。

**C. 需要真实外置实现捕获时的现有项目入口形状**：

```sh
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-project \
  --project /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/connector-implementation/truthsrc.project.json \
  --out /tmp/codegen-parity-connector-implementation/project \
  --plan
```

[project/cli.mjs L91–144](../baseline/js/lib/project/cli.mjs#L91-L144) 即使 plan 也 captureProject、validateTree、roundtrip、compileTreeWithSources、derive/compile products、source hashing。L183–188 在存在 implementations 时还调用 `verifyImplementationSources`；其导入的 `lib/project/implementation-evidence.mjs` **未包含于本次 baseline**，本次没有转读当前源码，因此不宣称该验证无子进程/无额外写面。D7 要在执行前另捕其 SHA/核 side effects，不能把 `--plan` 当成零执行保证。

L190–208 的非 plan 路径打开 projectGraphFile 对应 SQLite store、生成/写 source entries、ledger/anchors、publishProjectAnchors，finally close；L217–224 还把 `.truthsrc/canonical.json`、`request.json`、`compiled.json`、`inputs.json` 作为证据 entries。plan 不创建该 store，不调用 apply；`--update` 会改变既有 owner 输出，初轮不使用。项目图路径位于 out 以外的可能性必须在批准运行清单中明确，不能因 `/tmp` target 就称隔离所有写面。

**D. Scala 同等语义 fixture 的真实入口形状**（下面 `systemFile/systemBindings` 是已有参数；fixture 能否装配出 connectors 仍须 D4 确认，不伪称已存在可生成输入）：

```sh
sbt \
  -Dcodegen.systemFile=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/connector-implementation/bc-system.json \
  -Dcodegen.systemBindings=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/connector-implementation/bc-bindings.json \
  -Dcodegen.targetDir=/tmp/codegen-parity-connector-implementation/raw-scala \
  -Dcodegen.ledger=/tmp/codegen-parity-connector-implementation/raw-scala-ledger.json \
  "runMain net.imadz.codegen.CodegenMain"
```

工作目录必须显式选择 `/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen` 并先遵其 CLAUDE/AGENTS 与资源约定；本次没有进入/运行该仓。参数互斥/配对来源为 [CodegenMain L62–81](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L62-L81)，ledger 属性来源 [runCommon L179–182](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L179-L182)。若文件 adapter 无法表达该 fixture，应由集成者明确注册 fixture system 后使用已有 `-Dcodegen.system` 槽，不能冒称某个目前不存在的注册名已可用。

它不是只写一个 Scala 文件的轻量命令：sbt/JVM 可编译、解析或下载依赖、写 target/cache；CodegenMain 先 prepare/harness，再 mkdir/copy scaffold、整 system 的传统各族、proto 目录、ledger、release manifest，存在 formalSemantics 时还写 formal-semantics.json。无 artifact-only 开关可据此宣称自动 scoped；**范围靠只含本族依赖闭包的获准 fixture 控制**。真实生成和 JVM 验证应由集成者批末集中一次，不在每个制品重复跑。

### 11.3 真实接口/行为证据与停止点

- 首先完成 D1/D2/D3 的 ABI：真实 Future[R]、runner.run 两种重载、构造参数、DI/手写绑定、所有权和释放路径。基准无 helper 的占位 fixture 只用于 raw 内容检查，不能进入成功业务证据。
- 以独立的手写测试 runner 捕获调用次数/脚本参数/返回结果，分别覆盖返回值原样传递、失败 Future 原样传播、同步抛错的实际合同；不能用 emitter 自己生成同一个 stub 作业务 oracle。
- 不在本制品测试启动真实 Node 工具、银行服务、数据库或外部 TA。若将来获准验证进程边界，需另列命令、超时、进程归属/关闭及 JAR pins；本阶段没有该许可。
- 计划预算：文件生成/完整内容对账先按 5 分钟窗口，批末局部 JVM/接口验证按 15 分钟窗口；是调度停止点，不是当前测量。未取得批准或预算超出就保存已得证据并停止，不能扩成全银行回归。

## 12. 具体未决项

|ID|必须由相应 owner 裁定的具体问题|阻断面|
|---|---|---|
|D1|保真 profile 是否只允许“恰一个无 scriptParam 的接口方法”；还是批准修复 raw 首方法/Nil 参数缺陷？无接口/空方法是否拒绝而非 ProcessResult fallback？若扩展，逐方法 helper/脚本/实参映射从哪个明确输入提供？|接口一致性、多方法 fixture、target 完整产物|
|D2|`helperNames.head` 的真实 `run()`/`run(String)` ABI、Future 内层类型、隐式参数、同步/异步异常与资源关闭归属是什么？script 中特殊字符的 admitted 范围/结构化字面量编码如何保真？|机械委托 RHS 与真实接口验证；不可填 fake success|
|D3|impl metadata.name 与接口固定 `connectorName + "Impl"` 不一致时拒绝还是更改端口绑定合同？继续使用 @ImplementedBy 还是显式 root binding，所消费 Guice/javax.inject 制品是哪一 pin？|DI、类名、端口组依赖；不能仅凭源码注解放行|
|D4|新增正式 Connector product/schema 与入口怎样映射 Scala metadata；BC file adapter 是否能表达全部字段？legacy direct 保留还是退役？银行 TechnicalPorts 继续独立 B 责任还是另立 typed connector adapter？|正式可达性、fixture 入参、共用 emitter/registry 的唯一 owner；不得自动把银行 30 pin 转无参 Node 调用|
|D5|单数 noteId、方法 anchorNoteId、ArtifactModel 默认 noteIds/morphisms 及 JS host 级 source 如何映到同一来源合同？命名变化/重载/反引号后 MANUAL def 锚及旧注释 hash 如何保真？|稳定再生、方法级回锚、避免孤儿手写块|
|D6|本族多模块目标是否保留 raw app fallback，或经批准进入某个基础设施模块？需哪个 module sourceRoot 和依赖边？|物理路径、build 根、完整文件比较；不得混用 single/multi 输出|
|D7|选择 capture 路线前补 `implementation-evidence.mjs` 的固定字节与子进程/临时文件/缓存边界；同输入 raw/target/actual 文件还未产生，CC 工具/版本/口径也未固定|公开 CLI 可执行批准与证据；文档存在不等通过|

这些决策只阻断对应实施/验收，不阻止本族文档独立保存。此次结果是已保存的内容规格与明确的缺口，不是 ready、implemented 或 parity-PASS。

[M]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/infrastructure/connector/ConnectorImplModel.scala#L1-L24
[B]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/connector/ConnectorImplBuilder.scala#L1-L49
[T]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/connector/ConnectorImplTemplate.scala#L1-L65
[LE]: ../baseline/js/generators/connector-dsl/emit.mjs#L1-L64
[LP]: ../baseline/js/generators/connector-dsl/parse.mjs#L1-L5
[LM]: ../baseline/js/generators/connector-dsl/generator.json#L1
[RT]: ../baseline/js/generators/scala-cqrs-application/render-technical-ports.mjs#L1-L56
[FT]: ../baseline/js/generators/scala-cqrs-module-seams-v1/templates/scala.mjs#L1-L72
[CLI]: ../baseline/js/lib/products/generate-cli.mjs#L1-L146
[BANK]: ../baseline/actual-js/app/example/bankwealth/application/bank_payment_hostTechnicalPorts.scala#L1-L240
