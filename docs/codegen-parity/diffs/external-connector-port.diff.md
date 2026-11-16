# external-connector-port：应用层外部连接器能力面

## 1. 范围、状态、证据分层

- Artifact ID / group：`external-connector-port`，传统清单第 13 项；本文件不接管 `connector-implementation`。
- 内容状态：**`decision-required`**。传统 Scala MBT 已逐文件阅读；legacy 有近似 emitter，formal 银行有不同语义的 TechnicalPorts，family 有独立 typed port renderer。**formal 中没有已核实的传统 ConnectorMetadata → ConnectorModel 对应入口**，此对应面为 `missing-counterpart`，不能写成“JS 完全没有端口”。
- 固定 HEAD：BC `cc335eb1e0d0fae17bf092fd61b126040196ea70`；JS `bf104e16ab82ef39d7fa416d0997907d18a815ad`。准确源字节以 [baseline/index.json](../baseline/index.json) 的 `source/snapshot/bytes/sha256` 为准，不以 HEAD 代替工作树身份。
- 本次只作源码内容检查。未测试、typecheck、编译、生成、运行、下载或操作服务；未改 truth、生成应用、baseline、catalog、ledger、anchor、Git 或此前 15 份 diff。没有新同输入输出；本文对照均不是同输入字节一致性证明。
- 本次已先检查两个分配文件均不存在，再独立创建。没有读取基线外的当前生产源码，`extraSources = []`；必读合同、计划及仓库指引是本次授权输入，不是额外生产来源。

| 证据面 | 本次可取得的内容 | 不能据此宣称的事项 |
|---|---|---|
| `raw-scala` | 下文完整 Model / Builder / Template 固定源码、调度与 writer 规则 | 没有新跑出来的 Connector Scala 完整产物，不伪造执行回执 |
| `approved-target` | 默认保留传统能力面；叠加三层布局、统一命名、依赖模型及明确的代码质量规则；未裁定事项见 D1–D8 | 不是已保存的 expected 编译产物；未决注解/输入接线不能悄悄视作批准 |
| `actual-js` | 银行固定 `bank_payment_hostTechnicalPorts.scala` 的完整 240 行；legacy `emit.mjs` 的真实输出模板 | 银行 TechnicalPorts 不等于 Node 工具连接器；legacy 模板不等于银行在用产物 |
| `curated-reference` | 固定 `CreditBalanceRepository.scala`，仅作 `@ImplementedBy` 应用端口的结构类比 | 基线索引未提供本族人工 Connector golden；不能拿仓储的 `EntityRef` 方法冒充连接器算法 |

### 1.1 主要固定字节

以下 SHA 已对相应固定文件重新计算并与索引一致；这只是文件身份检查。

| 源 | bytes | SHA-256 |
|---|---:|---|
| [ConnectorModel.scala][M] | 821 | `c865504f1a744bac5793da4eb974d83c14abcb494933d8a093ffcaea9ac47d61` |
| [ConnectorBuilder.scala][B] | 1670 | `be8c2cf7eb69dbb73ec2b86b910b93792766d0cc77e31d2d40935637f7caea7c` |
| [ConnectorTemplate.scala][T] | 1963 | `091fadf11eb1636c9f411794b8e9c16e90ce8a0c3ea9e4671fd51ff81b765811` |
| [legacy emit.mjs][LE] | 1635 | `c1d4290d23944e1d5ab7f0c8b5daa7d9bd3dc48f37342007ed7e0d7704b602e6` |
| [formal render-technical-ports.mjs][FT] | 7615 | `f1d09894cfbd40abacb68fbf59329c708373f530eb60b1df6b8cf4ffa44d9b09` |
| [银行 TechnicalPorts 全文件][BANK] | 53668 | `00acf25ce2f0688ea7ac6a9eacf89ccaa98f64dc7e72e0ff1c40bc03619b31ee` |
| [family build-models.mjs][FB] | 19378 | `c569e6e3f38db5ac6d74f77f7f7b97524bcdb683bb19be9caca13216b418fd37` |
| [family templates/scala.mjs][FTem] | 9338 | `69b6a821feb8bd97c709afd1e19b1fab37cea7d16892295e83ec04acc27eec1e` |
| [curated CreditBalanceRepository][CUR] | 518 | `e3cd76eab166ce2eb17128e3e5b6377198a15bfd10f16bd8e94a5c48c3a60a00` |

### 1.2 传统调度、基数与完整路径

关键位置的精确固定行锚：

- [传统分层调度 L192–220](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L192-L220)、[本族调度 L702–711](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L702-L711)、[多模块 kind 表 L331–349](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L331-L349)、[writer L359–412](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L359-L412)。
- [参数关键字处理 L171–181](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L171-L181)、[依赖/FieldDef L31–85](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L31-L85)、[imports 最终排序 L20–22](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L20-L22)。
- [formal 注册 L92–101](../baseline/js/lib/products/generate-cli.mjs#L92-L101)、[formal 角色 body 分支 L16–29](../baseline/js/generators/scala-cqrs-application/render-technical-ports.mjs#L16-L29)、[family port 模型 L104–110](../baseline/js/generators/scala-cqrs-module-seams-v1/build-models.mjs#L104-L110)、[family port template L53–57](../baseline/js/generators/scala-cqrs-module-seams-v1/templates/scala.mjs#L53-L57)。
- [银行抽象能力面 L7–68](../baseline/actual-js/app/example/bankwealth/application/bank_payment_hostTechnicalPorts.scala#L7-L68)、[银行安装/回调结构 L69–145](../baseline/actual-js/app/example/bankwealth/application/bank_payment_hostTechnicalPorts.scala#L69-L145)、[银行调用与校验 body L146–240](../baseline/actual-js/app/example/bankwealth/application/bank_payment_hostTechnicalPorts.scala#L146-L240)。

[CodegenMain.scala:183–192,232–241][CM] 区分独立 `semanticProductsFile` 支路与本族所在传统 `runCommon`。本族不以 `template/products/*` 为金样。

[runCommon:192–220][CQ] 建立 `GeneratorContext`，先 domain，再 application，再 infrastructure；[generateApplicationLayer:682–720][CQ] 中本族处在 repositories 之后、services 之前：

```scala
app.connectors.foreach { m =>
  val model = ConnectorBuilder.build(m, ctx)
  writeArtifact(
    model,
    ConnectorTemplate.generate(model),
    root,
    Some(ArtifactAttribution("connector-iface", m.name, "global", Nil))
  )
}
```

- `ApplicationLayer.connectors: Seq[ConnectorMetadata] = Nil`；不是从 `ExternalSystemMetadata.contracts` 自动生成连接器，二者元数据不同。
- 每条 connector 产生一个 trait 文件，即使 `methods` 为空仍有空 trait；connector 集合为空则本族输出零个。
- `writeArtifact` 处 `currentScope.includes(attribution)` 可跳过实际写入；它先记录 ledger/morphisms，再判断 scope。不能把模型构建次数当写成文件数。
- `selfType` 给出 package 与文件名。单工程 `outputRoot = <target>/app`，实际路径为 `<target>/app/<base-as-path>/application/connectors/<meta.name>.scala`。
- 多模块 [targetModuleOf:331–349][CQ] **没有登记 `connector-iface`**，落 `None`；[writer:366–377][CQ] 此时回退 `<target>/app/<base-as-path>/application/connectors/<meta.name>.scala`，不是臆测的 `modules/kernel/...`。
- `ConnectorImpl` 不由本循环顺带发出；[infrastructure:843–850][CQ] 独立遍历 `infra.connectors`。本族的 `@ImplementedBy` 不证明一定存在对应 impl 或返回 case class。
- 本族原布局已在三层内；不需要新增 `.integration`/`.service`/`.web`。若改变多模块归属，须连同 application→infrastructure 注解引用及模块依赖一起裁定（D2）。

| 变体 | 条件 | 本族文件集 | 当前证据状态 |
|---|---|---|---|
| `single-project` | connectors 非空、`multiProject=false`、scope 允许 | 上述 `app/.../application/connectors/<Name>.scala`，每 connector 一份 | 源码可达，未执行 |
| `multi-project-fallback` | 同上但 `multiProject=true` | 仍是 `app/.../application/connectors/<Name>.scala` | 源码可达，未执行 |
| `empty-methods` | 某 connector 的 methods 为 Nil | 一个带注释/注解的空 trait | 不得静默删掉已声明能力面；是否禁止空模型见 D7 |
| `no-connectors` | `connectors=Nil` | 无 | suppressed 条件已定位 |
| `scope-suppressed` | `currentScope.includes` 为 false | 不写该文件；此前已记录账项 | 不能把账项存在称作文件存在 |
| `script-param` | 方法 `scriptParam=Some(p)` / None | 同一文件中 `def m(p: String)` / `def m()` | 非额外文件族 |
| `knowledge-comment` | connector `noteId=Some(id)` / None | 可选一行知识注释；有 hash 时追加后缀 | 不合成 note ID；不是新作者字段 |

## 2. 完整传统 Model / Builder / Template

这里直接保留三份小文件全文，避免用类名推断内容。支撑大文件以固定全文件链接及后续逐构造账定位。

### 2.1 Model 全文（[L1–22][M]）

```scala
package net.imadz.codegen.scaffolding.cqrs.model.application

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

/** Connector 能力面模型（application 层）——与 AggregateRepositoryModel 同构：
  * trait + `@ImplementedBy(Impl)`。子进程机械不在本层（在 infrastructure impl 里）。 */
case class ConnectorModel(
    override val selfType: TypeRef,
    isImplementedBy: TypeRef,
    methods: Seq[ConnectorMethodModel],
    override val dependencies: Set[TypeRef],
    noteId: Option[String] = None
) extends ArtifactModel

/** Connector 方法：返回一个手写 case class（如 GateRunResult）。 */
case class ConnectorMethodModel(
    name: String,
    parameters: Seq[FieldDef],
    returnType: TypeRef,
    intent: String,
    noteId: Option[String] = None
)
```

### 2.2 Builder 全文（[L1–36][B]）

```scala
package net.imadz.codegen.scaffolding.cqrs.builder.application

import net.imadz.codegen.scaffolding.cqrs.model.application.{ConnectorMethodModel, ConnectorModel}
import net.imadz.codegen.scaffolding.cqrs.{FieldDef, GeneratorContext, TypeRef}
import net.imadz.meta.ConnectorMetadata

/** Connector 能力面 Builder（application 层）——镜像 AggregateRepositoryBuilder（去掉聚合特化）。
  * 方法返回类型用**名字**承载（元数据不做类型解析）——Builder 经 layout 解析成 application.connectors 包内的 TypeRef。 */
object ConnectorBuilder {

  def build(meta: ConnectorMetadata, ctx: GeneratorContext): ConnectorModel = {
    val pkg = ctx.layout.application.connectors.root
    val selfType = TypeRef(meta.name, pkg)

    val implName = net.imadz.codegen.structure.NamingConventions.connectorImplName(meta.name)
    val implType = TypeRef(implName, ctx.layout.infrastructure.connectors.root)

    // 方法返回类型：手写 case class，与 trait 同包（application.connectors）
    val methods = meta.methods.map { m =>
      val params = m.scriptParam.toSeq.map(p => FieldDef(p, TypeRef.String))
      ConnectorMethodModel(
        name = m.name,
        parameters = params,
        returnType = TypeRef(m.returnTypeName, pkg),
        intent = m.intent,
        noteId = meta.noteId
      )
    }

    val deps = (methods.flatMap(mm => mm.returnType.collectAllDependencies ++ mm.parameters.flatMap(_.typeRef.collectAllDependencies)).toSet
      ++ Set(implType, ctx.knownFrameworkTypes("ImplementedBy")))
      .filter(_.shouldImport(pkg))

    ConnectorModel(selfType, implType, methods, deps, meta.noteId)
  }
}
```

### 2.3 Template 全文（[L1–55][T]）

```scala
package net.imadz.codegen.scaffolding.cqrs.template.application

import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.scaffolding.cqrs.model.application.ConnectorModel
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate
import net.imadz.codegen.structure.NamingConventions

/** Connector 能力面模板（application 层）——镜像 AggregateRepositoryTemplate。
  * 产出：`@ImplementedBy(classOf[<Impl>]) trait <Name> { def m(...): R }`。 */
object ConnectorTemplate extends CodeTemplate[ConnectorModel] {

  def generate(model: ConnectorModel): String = {
    val pkgDecl = packageDecl(model.selfType.packageName)

    val importList = model.dependencies.toList
      .sortBy(_.fqn)
      .map(_.fqn)
      .filterNot(p => p.isEmpty || p == model.selfType.packageName || p.startsWith("java.lang"))
      .++(Seq("javax.inject._", "com.google.inject.ImplementedBy"))
      .distinct

    val importDecl = imports(importList: _*)

    val methodsCode = model.methods
      .map { m =>
        val params = m.parameters
          .map(p => s"${NamingConventions.scalaIdentifier(p.name)}: ${p.typeRef.signature}")
          .mkString(", ")
        s"  def ${m.name}($params): scala.concurrent.Future[${m.returnType.signature}]\n  // Logic: ${m.intent}"
      }
      .mkString("\n\n")

    val annotation = s"@ImplementedBy(classOf[${model.isImplementedBy.name}])"
    val anchor = net.imadz.codegen.scaffolding.cqrs.CQRSApplicationGenerator.annotateKnowledge(model.noteId)
      .map(id => s"/** @knowledge $id */\n").getOrElse("")
    val traitDefinition = s"""/**
 * ${model.selfType.name}: Application Layer Connector Interface
 * 调外部工具（Node 子进程）的能力面——子进程机械在 infrastructure impl 里（注入手写基建）。
 */
$anchor$annotation
trait ${model.selfType.name} {

$methodsCode

}
"""

    s"""${pkgDecl.code}

${importDecl.code}

$traitDefinition
"""
  }
}
```

## 3. Model 字段、输入槽与 Builder 规则账

### 3.1 Model 全字段与继承项（按构造顺序）

| 顺序/位置 | 类型与默认值 | 来源、语义及 JS 缺口 |
|---|---|---|
| `ConnectorModel.selfType` | `TypeRef`，无默认，override val | `TypeRef(meta.name, application.connectors)`；legacy 强行追加 Connector，formal 用 host id 派生名称 |
| `isImplementedBy` | `TypeRef`，无默认 | `TypeRef(meta.name + "Impl", infrastructure.connectors)`；不是输入里随便给的 class 字符串；formal/family 的普通 port 没有此字段 |
| `methods` | `Seq[ConnectorMethodModel]`，无默认 | 完整保持 meta.methods 顺序，不排序、不只取首条；legacy 直接把 params/returnType 当源码串 |
| `dependencies` | `Set[TypeRef]`，无默认，override val | 返回及参数递归依赖 + impl + ImplementedBy，再按当前包过滤；不是产物文件路径数组 |
| `noteId` | `Option[String] = None` | 来自 meta.noteId，驱动 trait 级注释 |
| `ConnectorMethodModel.name` | `String`，无默认 | 原样 m.name；raw 没有方法名转义/大小写变换 |
| `parameters` | `Seq[FieldDef]`，无默认 | 只支持 0 或 1 个 String script 参数；不是通用 method-signature 产品 |
| `returnType` | `TypeRef`，无默认 | `returnTypeName` 被当作同包类型名，不是已包 Future 的类型；Future 由模板加一层 |
| `intent` | `String`，无默认 | m.intent，发成方法后的 `// Logic:` 注释，不可执行 |
| method `noteId` | `Option[String] = None` | Builder 复制 connector noteId；本 Template 不消费它，不存在方法级独立知识锚 |
| 继承 `ArtifactModel.fqn` | `selfType.packageName + "." + selfType.name` | 与 TypeRef.fqn 对空包的处理并不完全相同 |
| 继承 `registerTo` | `registry.register(this)` | 无子模型注册 override；方法不是 ArtifactModel 子型 |
| 继承 `morphisms` / `noteIds` | 均 `Nil` | ConnectorModel 没有 override。**有 noteId 不等于 ledger.noteIds 自动非空** |

[TypeSystem.scala:4–85][TS] 的依赖子结构不能忽略：

- `TypeRef(name: String, packageName: String, typeParams: Seq[TypeRef] = Nil)`；`fqn` 空包直接 name，否则 `packageName.name`；`signature` 在 `Tuple` 数字后缀且 typeParams 非空时生成元组语法，否则有参数用 `Name[T1, T2]`，否则 name。
- `collectAllDependencies = Set(this) ++ typeParams.flatMap(_.collectAllDependencies)`；`shouldImport` 依次排除空包、当前包、`scala`、`java.lang`。
- `FieldDef(name, typeRef, defaultValue: Option[String]=None, comment: Option[String]=None, noteId: Option[String]=None, description: String="")`；本 Builder 仅传前两项，另外四项取默认。Template 只读 name/typeRef，**不输出参数默认值、注释、知识锚或 description**。
- 本 Builder 实际用的 `TypeRef.String = TypeRef("String", "")`；String 无 import。即便依赖工具支持泛型，`returnTypeName` 此处仍直接进入 `TypeRef.name`，不能称已经解析 `Option[Result]` 或 FQN。
- [ArtifactModel:5–47][AM]、[CodeTemplate:5–6][CT] 的 `M <: ArtifactModel` 是生成器泛型；生成出的 connector trait 本身没有类型参数。

### 3.2 原始元数据全输入槽

来源 [ArchitectMetadata.scala:1032–1066][META]；文档注释提及 TypeResolverDSL，但 **ConnectorBuilder 实际直接构造 TypeRef**，没有调用该 resolver。

| 元数据字段（声明顺序） | 默认 | 本族消费 |
|---|---|---|
| Connector `name` | 必填 | trait/file/impl 名称 |
| `description` | `""` | 未使用；模板总发固定说明 |
| `kind` | `"read"` | 未使用；Builder 不校验只读语义 |
| `methods` | `Nil` | 按序 map 全部方法 |
| `entryTemplate` | `None` | 未使用 |
| `timeoutMs` | `None` | 未使用，不会产生超时控制 |
| `noteId` | `None` | trait 及每个方法 Model 的 noteId |
| method `name` | 必填 | 原样方法名 |
| `returnTypeName` | 必填 | 同包返回类型名字 |
| `intent` | `""` | `// Logic: ` 后的原始文本 |
| `script` | `None` | port 不消费；属于 impl 默认调用槽 |
| `scriptParam` | `None` | Some 时一个 String 参数；None 时显式空括号 |
| `anchoredTo` | `None` | 本族不使用，不可当作已输出的锚 |

Connector 元数据 `metaCategory = "application.connectors"`；`ExternalSystemMetadata` 的 contracts/triggers 不属于此输入。不能从业务“接外部系统”几个字推导 script、返回类型或超时默认值。

### 3.3 Builder 逐规则与分支

| 稳定项 | 原始计算（[Builder][B]） | 移植要求/边界 |
|---|---|---|
| B01 包 | L12 `ctx.layout.application.connectors.root` | [PackageLayout:81–84][PL] 是 `<base>.application.connectors`；`GeneratorContext.basePackage = rootPackage + "." + moduleName`，layout 用此 base |
| B02 自身名 | L13 `TypeRef(meta.name,pkg)` | raw 不补 Connector 后缀；目标集中解析 PascalCase，不能让模板各做 suffix |
| B03 实现名/包 | L15–16 `connectorImplName(meta.name)` 和 infrastructure.connectors | [NamingConventions:69–70][NC] 确实只是 `connectorName + "Impl"`；必须与 impl owner 协同 |
| B04 方法序 | L19 遍历所有 meta.methods | 保持顺序；空集合产生空 methodsCode |
| B05 参数分支 | L20 `scriptParam.toSeq` | None→Nil，Some(p)→单个 FieldDef(p,String)；Some 空字符串 raw 不主动拒绝，不制造默认脚本实参 |
| B06 方法构造 | L21–27，named args 的顺序为 name/parameters/returnType/intent/noteId | returnType 属同包；intent 原样；noteId 是 connector 级复用 |
| B07 依赖闭包 | L30 所有返回/参数 collectAllDependencies→Set | 多方法返回相同类型去重；不能把方法参数遗漏 |
| B08 框架/实现依赖 | L31 `Set(implType, ctx.knownFrameworkTypes("ImplementedBy"))` | [GeneratorContext:68–75][GC] 映射到 `com.google.inject.ImplementedBy`；直接 Map apply，无本地 fallback |
| B09 import 可见性 | L32 `.filter(_.shouldImport(pkg))` | 同包返回类不导入，impl/Guice 保留；Future 并未进入这个 deps 集 |
| B10 最终构造 | L34 `ConnectorModel(selfType,implType,methods,deps,meta.noteId)` | 五字段顺序不变；不读盘、不写账、不生成方法 body |

没有本地类型存在性检查、同名冲突消解、script 与方法签名一致性验证，不能将上游可能的验证视为本 Builder 已经做过。目标应由共享 admission 报清楚这些问题（D4/D7），不要靠默认 `Future[Unit]` 洗掉缺类型输入。

## 4. 输出顺序、完整 RHS / body 与明确偏差

### 4.1 传统输出逐构造账

固定完整源码见 [Template][T]；基础 DSL 的 [PackageDeclaration/ImportDeclaration:13–22][DSL] 决定最终字节，不能只看 Template 第一轮排序。

| ID / 输出顺序 | 原始 construct 及完整生成规则 | RHS、默认值与目标处理 |
|---|---|---|
| C00 writer 头 | [CQ:411–412][CQ] `fingerprintHeader + content` 后交 `writeTerritorial` | 不是 Template 生成；版本/发布头由 writer 所有，不借删头隐藏比较差异 |
| C01 package | `package ${model.selfType.packageName}`，随后空行 | 由 `packageDecl(...).code`，无 package object |
| C02 imports | dependencies→按 fqn 排序→取 fqn→排除空字串、等于当前包、`startsWith("java.lang")`→追加 `javax.inject._` 与 `com.google.inject.ImplementedBy`→distinct→`imports(...).code` | **DSL 再对全部 import 字符串全局 sorted**，再每行加 `import `，以 `\n` 连接；无分组空行。一般是 Guice、javax、项目 impl 的字典序；同包返回类不导入；Future 以 FQN 输出 |
| C03 trait 说明 | 四行 `/**`、`${selfType.name}: Application Layer Connector Interface`、固定中文 Node 子进程说明、` */` | 不取 meta.description；不能把固定“Node 子进程”描述用于已裁定为普通支付端口的另一个族 |
| C04 optional anchor | `annotateKnowledge(model.noteId).map(id => s"/** @knowledge $id */\n").getOrElse("")` | [CQ:94–101][CQ] 有元素 hash 时 `id + "@" + hash`，无则 id；None 为空。位于说明之后、注解之前；没有方法级 anchor |
| C05 annotation | `@ImplementedBy(classOf[${model.isImplementedBy.name}])` | RHS 是实现类 `classOf`，不是实例构造；用 `.name` 而非 `.signature/.fqn`，依赖上面的 import。raw 明确存在 application 引用 infrastructure 的例外（D2） |
| C06 trait 开始 | `trait ${model.selfType.name} {`，下一空行 | 公有、非 sealed/final、无父类、无主辅构造参数、无 self-type、无类型参数/上下界 |
| C07 methods 循环 | 每个 m 依序输出 `  def ${m.name}(${params}): scala.concurrent.Future[${m.returnType.signature}]` | params 为 `scalaIdentifier(p.name) + ": " + p.typeRef.signature`，顺序保留，用 `, ` 连接。None 参数仍 `()`；无 curried/implicit 参数；无 override/overload 派生 |
| C08 每方法后注释 | 紧接下一行 `  // Logic: ${m.intent}`；方法之间 `\n\n` | **抽象方法无 `=`、无 body、无默认成功值、无调用副作用**；intent 是原始单行注释槽，换行未转义，不是算法；参数 FieldDef.defaultValue 不输出 |
| C09 trait 结束 | methods 后空行，`}`，traitDefinition 末尾 LF，外层字符串又有 LF | 对账保留实际空行/末尾换行，禁止全空白 normalize |
| C10 明确未产生 | 无 companion/object/type alias/val/var/lazy/implicit 成员/嵌套 case class/额外 annotation/初始化语句/资源注册 | 这些并非“略去”；Template 的输出构造到 C09 已结束。尤其不生成返回 case class 和 impl 算法 |

### 4.2 raw-scala → approved-target 的有限差异与保留面

1. **不改变角色**：一个具名应用能力 trait，impl 另在 infrastructure；无 IO 算法、默认成功或事件构造器。保留方法完整顺序、String script 参数分支、Future 返回层数和实际声明类型。
2. **统一名称**：类型/文件 PascalCase，方法与参数 lowerCamelCase；已有合法完整名不再补 `Connector`。关键字由 resolver 转义；稳定知识 ID、方法/端口业务 ID 不改。raw 的方法名原样、只转义参数是已观察例外，不宣称原基准已经满足所有命名规则。
3. **依赖表达**：目标共享 TypeRef 必须承载返回类型及泛型闭包；合法命名类不得退化到 String/Any。传统相同包返回类无需 import；方法外层 `scala.concurrent.Future` 是原始 FQN 例外。是否把这个短小族的 Future 改成 import 简名、删除未使用的 `javax.inject._` 并分组 imports，列 D6；在裁定前保留 C02 的准确 raw 格式，不擅称已获逐字例外批准。
4. **Guice 例外**：默认对照仍展示 `@ImplementedBy`，但不得说它符合严格 Onion 内层不 import 外层。拆到 modules/kernel 会造成依赖问题，D2 需决定保留传统注解例外还是由 `infrastructure.bootstrap` 显式绑定；不发第四层 modules 包。
5. **来源**：不得再添加作者 `@knowledge` 字段；现有 noteId 的渲染与 writer 侧来源模型分清。当前 Model 的 `noteIds=Nil` 与方法 noteId 未输出是事实，不自动修正为“已闭环”（D5）。
6. **协议保护**：本族不拥有 CommandHelper/Actor 协议或 domain Events。CommandHelper 仍在 `application.aggregates.behaviors`，有 `toParam/createFailureReply/createSuccessReply`；typed replyTo 只按回复合同进入应用 Actor commands，不能加进此 String 参数或 domain 参数/事件。调用方若涉及 actor 行为，失败不得 persist，成功 persist/apply 后 thenReply 读新 state，`replyWith` 与 `replyWithAndPublish` 不可互换。本族无权改这些合同。
7. 不更改 PB 字段号、PID、serializer ID/绑定、OperationIdentity/TransactionIdentity、名义类型身份或溢出算术。没有本族业务算法可据此宣布行为一致。

### 4.3 实际 minus / plus：legacy 模板 → 传统目标结构

**结构性对照，非同输入字节比较；不是可直接应用到生产 JS 的 patch。** minus 逐字取 [emit.mjs:30–42][LE]；plus 使用 [ConnectorTemplate:33–52][T] 的相同 trait 构造与其命名/import 模型。`model`、`importDecl`、`anchor` 是上述 Builder/Template 已逐项定义的元变量，不是缺失业务方法的占位实现。此处刻意保留 raw 的 DI/import 裁定点。

```diff
--- actual-js-template/generators/connector-dsl/emit.mjs
+++ approved-target-structure/external-connector-port
@@ -30,13 +30,15 @@
-const iface = `package ${pkg}
+const iface = `package ${model.selfType.packageName}
 
-import scala.concurrent.Future
+${importDecl.code}
 
 /**
- * ${ifaceName}: External system connector interface
+ * ${model.selfType.name}: Application Layer Connector Interface
+ * 调外部工具（Node 子进程）的能力面——子进程机械在 infrastructure impl 里（注入手写基建）。
  */
-trait ${ifaceName} {
+${anchor}@ImplementedBy(classOf[${model.isImplementedBy.name}])
+trait ${model.selfType.name} {
 
-${methods}
+${methodsCode}
 
 }
 `;
```

方法循环也必须改变，不能只改外壳：

```diff
--- actual-js-template/generators/connector-dsl/emit.mjs
+++ approved-target-rule/external-connector-port
@@ -18,3 +18,6 @@
-const methods = (spec.methods || []).map(m =>
-  `  def ${m.name}(${m.params || ""}): ${m.returnType || "Future[Unit]"}`
-).join("\n");
+const methodsCode = model.methods.map(m => {
+  const params = m.parameters
+    .map(p => `${scalaIdentifier(p.name)}: ${p.typeRef.signature}`)
+    .join(", ");
+  return `  def ${m.name}(${params}): scala.concurrent.Future[${m.returnType.signature}]\n  // Logic: ${m.intent}`;
+}).join("\n\n");
```

第二个 plus 是 Scala C07–C08 的 JS 语法化规格，不声称 `scalaIdentifier` 已存在于当前 JS 导出；实现应适配共享 `resolveName` 的 escaped identifier。`m.returnType` 必须是未包 Future 的 TypeRef；**不得把 legacy 的 `Future[Unit]` 直接当 returnTypeName 再包一层**。参数默认源码串不能静默解析成仅 String 参数。D1/D4 未裁定前只能做旧绑定迁移清单，不能自动迁移任意 legacy 输入。

## 5. 三条 JS 路径的真实内容与差距

### 5.1 legacy：`connector-dsl` 可直接执行，不是 formal producer

[parse.mjs:1–5][LP] 全部行为是读取 argv 中 binding 文件并原字节写 spec 文件，打印 `spec from binding`。无 schema/type/name 校验、无 tree AST 建模。`generator.json` 声明 `entrypoint=emit.mjs`、version `0.1.0`；其“1:1 restoration”注释不是本次结论。

[emit.mjs:1–64][LE] 的全部职责账：

| 区间 | 当前事实 | 对应差距/去向 |
|---|---|---|
| 6–11 | 导入 fs/path；取两位置参数；JSON.parse(readFileSync(specPath)); 递归 mkdir(outDir) | import 即开始文件 IO；MBT 不隔离，JSON 解析失败直接抛出；新模型/模板不得承担 writer |
| 13–16 | 默认 package `net.imadz.infrastructure.connectors`；`name=spec.name`；iface `${name}Connector`；impl `${name}ConnectorImpl` | port/impl 同包，能力面错误落 infrastructure；name 已含 Connector 会重复后缀 |
| 18–20 | methods 缺省 []；每方法 params 缺省空字串、returnType 缺省 `Future[Unit]`；直接拼签名、单换行 | 无 FieldDef、依赖、intent、noteId、Impl TypeRef；同步 returnType 也原样放行 |
| 22–28 | impl 每个方法同样签名，加 override，MANUAL 内 `???` | 属 `connector-implementation`；保留未实现槽，禁止换 Future.successful(()) |
| 30–42 | package、Future import、英文注释、trait、空行、全部 methods、右括号 | 无 `@ImplementedBy`，无知识注释，无独立返回类 |
| 44–60 | 同包；Inject/Singleton/ExecutionContext/Future 四 import；注释；`@Singleton class Impl @Inject() ()(implicit ec: ExecutionContext) extends Iface`；implMethods | 空注入构造 + implicit EC 不等于传统注入手写 runner；不得在 port 文件中混入 |
| 62–64 | 先写 `<outDir>/<Iface>.scala`，再 `<Impl>.scala`，然后 console.log | 一次两文件、平铺物理根；不走产品 writer，不写 ledger/anchors，也不承诺原子性/手写保护 |

[pipeline.mjs:60–99,120–134][PIPE] 虽在 ORDER 列出 connector-dsl、标 binding-driven，循环仅检查 emit 是否存在并记 queued，最终写 pipeline-manifest；没有调用 connector emitter。不能按 ORDER 名称宣称该总管已执行连接器。

### 5.2 formal 银行：TechnicalPorts 的接线与全成员内容账

可达链为 [generate-cli:92–101][CLI] 注册 `scala-cqrs-play-service` → [play-service generate:16–28,59–70][PS] 继承 `createEffectRegistry('2')` → [produce-effect:6–25][PE] 继承 `applicationRegistry` → [produce:17–29][PR] 的 `finite-host-dsl` → [renderTechnicalPorts:2–56][FT]。

这是实读调用关系，不是根据文件夹名判断。`connector-dsl` 不在 [registeredProductProducer][CLI] 的精确目录集合。`play-service` 也没有因为名字类似而调用 family 的 `portTemplate`。

**完整银行固定文件**为 [bank_payment_hostTechnicalPorts.scala:1–240][BANK]，已分两段读完。index 的 `repo=bank`、`source=generated/current/app/example/bankwealth/application/bank_payment_hostTechnicalPorts.scala`；对应原始绝对路径为 `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/generated/current/app/example/bankwealth/application/bank_payment_hostTechnicalPorts.scala`。本文只把固定 snapshot 作为事实引用，未读取当前生成目录。

为避免丢失复合文件的成员，定义以下**实际声明序列 P**（来自银行 L8–67；不是新业务设计）：

1. `BankPaymentEntry`、`BankPaymentAssociation`：各 `BankPaymentOriginal → Future[Boolean]`。
2. 依次 `n=0,1,2`，每个 n 内依次 `Prepare,Commit,Compensate`，每个阶段先 Execute 再 QueryPort：`BankPayment<n><Phase>Execute` 的参数为同前缀 `Input`，返回同前缀 `Receipt`；`BankPayment<n><Phase>QueryPort` 的参数为同前缀 `Query`，返回 `Option[同前缀 Receipt]`；两者最外层都是 Future。共 18 个声明，**不同 Receipt 不合并**。
3. 按 `Succeeded,RejectedBeforeEffects,Compensated,RecoveryRequired,OutcomeUnknown` 顺序，每个 outcome 先 `BankPayment<Outcome>Authority(BankPaymentOriginal): Future[BankPaymentResult]`，再 `BankPayment<Outcome>Delivery(BankPaymentResult): Future[Boolean]`。共 10 个声明。

P 共 30 项。上述业务类型的当前 FQN 统一前缀为 `example.bankwealth.domain.values.`；每条声明前的 role 注释依次为 entry、association、phase-execute/phase-query、authority/result-delivery。此文件**没有 external-submission、external-query、readside 或 deployment 实例**，不能拿银行样例宣称这些 renderer 分支已 exercised。

| ID / 银行行 | 真实 construct、完整 RHS 规则 | 本族处置/owner |
|---|---|---|
| J00 L1–7 | 固定 `// @generated by truthsrc scala-cqrs-domain:1`；package application；Future 与 strict 两 import；`trait bank_payment_hostTechnicalPorts` | 错误大小写/下划线来自 stem 派生，不改变 host ID 来修名字。作为结构差距，不直接变成 Node Connector |
| J01 L8–67 | 按 P 发 30 个抽象 def、原样 FQN、单一 input 参数；无 ActorRef/实现 body | 能力签名可作为 typed 模型迁移输入，但 role→ConnectorMethod 的语义映射 D1 尚未成立 |
| J02 L69–73 | companion；`required: Vector[(String,String,String)]` 每 P 一项 `(P,"bankwealth."+P,"bank-v1-1")`；`requireInstalled(actual)` 为 `require(actual != null && required.forall { case (port,id,version) => actual.get(port).contains(id -> version) }, "missing or mismatched required implementation")` | 运行绑定验证；不属于传统 connector trait；必须保留，不因抽象端口变短而删除 |
| J03 L74–108 | 两行安装所有权说明；`BindingOwnership(port,role,artifact,artifactVersion,implementation,implementationVersion,boundary)` 七 String 字段；vector 按 P 构造 | artifact 固定 `bank-payment-technical`，artifactVersion 和 implVersion 均 `bank-v1-1`，impl `bankwealth.`+P，boundary `handwritten-composition-root`；此表是静态义务，不证明授权/重放 |
| J04 L109 | `secretReferences: Vector[(String,String)] = Vector()` | 银行此文件没有 secret 值；保留符号引用协议，不采集凭据 |
| J05 L110 | `OperationNotExecuted(identity: OperationIdentity,evidence: String,safeToRetry: Boolean) extends RuntimeException(evidence)` | 父构造实参是 evidence；没有额外 body。不是普通 connector 的失败返回类型 |
| J06 L111 | `CompletionContext(original: BankPaymentOriginal,identity: TransactionIdentity)` | original/identity 顺序与名义类型保留 |
| J07 L112 | `Implementation[I,O](id:String,version:String,run:I=>Future[O],operation:(I,OperationIdentity)=>Future[O]=null,completion:(I,CompletionContext)=>Future[O]=null)` | I/O 均不变型，无上下界；两个 null 默认是当前技术债，不能删除要求的 callback 或改为假成功 |
| J08 L113–144 | `Bindings` 30 个字段按 P，类型 `Implementation[对应输入,对应未包Future的输出]` | 当前字段仍 PascalCase；新源码名与 P 字符串身份必须分开 |
| J09 L145–203 | `final class Installed private[bank_payment_hostTechnicalPorts](private val bindings: Bindings) extends bank_payment_hostTechnicalPorts`；逐 P 的 def body 均为 `bindings.P.run(input)` | 每 phase 方法后追加 `POperation(input,identity)`→`bindings.P.operation(input,identity)`；每 authority/delivery 后追加 `PCompletion(input,context)`→`bindings.P.completion(input,context)`；entry/association 无追加方法 |
| J10 L204–205 | `declarations: Map[String,(String,String)] = Map(P -> (bindings.P.id -> bindings.P.version), ...)`，按 P | 字符串键为真实业务端口身份，不得跟随 lowerCamelCase 改写 |
| J11 L206–239 | `install(bindings): Installed` 先 require bindings 非 null；按 P require 字段非 null、id 精确等于 `bankwealth.`+P、version 为 `bank-v1-1`、run 非 null；phase 额外 require operation，authority/delivery 额外 require completion；错误消息逐 P；最后 `new Installed(bindings)` | 保持短路/校验顺序，在全部校验后构造；不是运行 callback 的成功回执 |
| J12 L240 | companion 结束 | 没有隐藏 alias、其它字段、persist/thenReply 或后台资源启动 |

上述完整复合文件暂由 **formal TechnicalPorts assembly owner（集成者）** 独占。port 组不得删掉 J02–J11，也不能把整个 companion 搬到 application.connectors 后称职责已分离。未来若 D1 决定拆分，能力声明归本组；安装、identity callback、binding guards 归 connector 实现/host 装配所有者，消费迁移需一并批准。

**Formal renderer 的未被银行样例覆盖分支仍须登记**（[FT:3–54][FT]）：

- `field(ref)` 从 reference-layout 按 `key` 查；`nonNull` 对 nominal 逐 `.value` 递归，`textualValue` 同样拆 nominal wrapper；不能用 `.toString` 替代。
- 仅 selected artifact 参与 owner 匹配；同时比较 port ref/version、implementation port/id/version；候选不为 1 时抛 `TypeError('exact selected technical port owner required')`。
- 每 host 按 `technicalPorts` 顺序收 pin，stem 为 host.id 的 `-→_`；方法名取 port.ref.id 的同样替换再 `symbol`。包取 context 的 explicit package binding。
- installedRun 的 external-submission/external-query/readside 分支：先 require input 与所有 association key 非 null；调用 `bindings.method.run(input)` 一次；require 返回 Future 非 null；在 `pending.map` 内校验结果的原始 key 未改；submission 检查单 record，另外两种通过 `result.forall(record => record != null && sameKeys)`；用 `ExecutionContext.parasitic`，最后返回原 result。
- deployment 分支：从 input record 找 `secretRef` 类型；先校验 input、nominal 包装及值非 null，且其解包文本出现在 `secretReferences`，再调用 run；这里只是声明的符号引用，不读取 secret。
- 其它角色默认直接 run；authority/result-delivery 加 completion 方法；phase-execute/phase-query 加 operation 方法；install 要求对应 callback 非 null。模板循环输入/参数/默认值均如 J07–J11。
- `entry(...)` kind 为 `technical-port`，sources 只有 `[h.source]`；deps 仅对 pin 输入/输出**顶层** `form==='nominal'` 收 `domain/values/<id>.scala`，不是任意容器递归依赖。没有传 codeMappings，不能声称有逐方法 span。
- [naming.mjs:15–31][FN] 的 nominal 直接返回 FQN；path 为 `app/<pkg>/...`；entry 在正文前加固定 header，再按 UTF-8 bytes 计算可选 mapping span。当前 TechnicalPorts 没有利用这一可选成员映射槽。

### 5.3 family：module-seams typed ports 存在，但不是传统连接器已经接通

[generate-cli:45–63,92–101][CLI] 为 module-seams 注册了 `resolveImplementations`，因此 public `generate-products` 会在 L80 拒绝这个 producer，即便 `--plan`；必须走 captured `generate-project`。它不是 dead folder，也不是银行 play-service 的继承分支。

实际链为 [generate.mjs:13–44][FG] → [build-models.mjs][FB] → [render.mjs:13–18,57–58][FR] → [portTemplate:53–57][FTem]。已阅读 family Model/Builder 文件与模板全文；这里只裁定其中 port 逻辑及共享支撑，不接管 values/bridge/root/build/test 制品。

| 层 | 实际 port 模型/规则 | 对传统本族的差距 |
|---|---|---|
| admission | 精确两 product：module-seams-contract@1 与 module-seams-composition@1；同 canonical；replay compileProductSet 必须完整一致；调用 lowerModuleSeamsTarget | 不是任意 ConnectorMetadata 的入口；没有已验证的 scriptParam/intent/ImplementedBy 对应 |
| Model | port `{packageName,name,identifier,path,ref,source,methods}`；method `{id,ref,name,identifier,source,parameters,result}`；parameter `{id,ref,name,identifier,type,source}`；result `{effect,type,source}` | 有类型/来源结构，但没有 ConnectorModel 的 implType、intent、noteId、TypeRef import set |
| Builder | L104–110 target.ports 按序，contract 中按 ref 精确 select；方法按 id select；fields 按 id 配对；类型解析 nominal/port 查声明，容器递归；未解析类型 fail | 不是 BC 的“一个可选 String 参数、返回同包类型名”。不能把 typed record 降级为 String |
| 类型分支 | L71–87 primitive/technical 原样；nominal/port 附 symbol；component 附 singleton/generated；optional/sequence/map/either 递归；其它 fail | 保留所有业务类型；不能为凑 A 兼容性吞掉 effect/plain 分支 |
| 依赖 | L54–62 typePaths 递归 nominal/port、生成 component 及容器；L193–195 port directDeps 来自所有方法参数/返回值，去自身路径 | 这是文件依赖，不是 Scala import 依赖；两者必须各自有模型 |
| 共享检查 | L224–232 对所有生产/手写/support 符号碰撞与 NFC/大小写路径碰撞检查；render 再检查 kind、实际 deps 存在并闭包 | 不复制另一套检查；本族不能改它的全局集合或 shared owner |
| Template 输出 | package + 空行；`trait identifier {`；按 methods 发 `  def identifier(parameters): resultType`；每方法 LF；`}`+LF | 无注释/annotation/companion/body；method 参数一组、无默认/implicit；plain result 不包 Future，future 才包 |
| signature | [FTem:5–34][FTem] primitive String/Boolean/Long、ExecutionContext、nominal/port/component、Option/Vector/Map/Either 都采用 `_root_.` FQN；返回 future 用 `_root_.scala.concurrent.Future[...]` | 缺传统 import 排版，不能称“有 MBT 所以一比一” |
| writer | render 经 `moduleSeamsSourceEntry` 输出 source mappings/deps；generate 强制 live implementation capture，验证产品/options 未漂移 | 可复用源映射理念；不能 bypass capture 后用 import-and-call 冒充公开 CLI |

另外 [saga-monarch workflow:106–125][WF] 的 `connector(area): ExternalOperationPort` 创建带 connectorId/version、manifest 观察与 reservations 调用的 runtime adapter。它不是本族 `trait + @ImplementedBy + abstract Future methods`，本次不把其 runtime body 误归 ConnectorTemplate，也不批准修改。

## 6. curated 参考与实现槽/胶水

### 6.1 curated 全文，仅结构类比

[CreditBalanceRepository.scala:1–14][CUR]：

```scala
package net.imadz.application.aggregates.repository

import akka.cluster.sharding.typed.scaladsl.EntityRef
import com.google.inject.ImplementedBy
import net.imadz.application.aggregates.CreditBalanceProtocol.CreditBalanceCommand
import net.imadz.common.CommonTypes.Id
import net.imadz.infrastructure.repositories.aggregate.CreditBalanceRepositoryImpl

@ImplementedBy(classOf[CreditBalanceRepositoryImpl])
trait CreditBalanceRepository {

  def findCreditBalanceByUserId(userId: Id): EntityRef[CreditBalanceCommand]

}
```

它证明参考中确有应用端口→具体 infrastructure impl 的注解风格；**不证明连接器应该返回 EntityRef、不提供 GateRunResult 定义、不提供外部调用算法**。它没有 raw Connector 的固定注释或 javax wildcard，因此不把 curated 与 raw 合并成一份“相同输出”。

### 6.2 库与实现接口账

| 完整符号/依赖 | 来源与所需能力 | 已知/未知边界 |
|---|---|---|
| `scala.concurrent.Future[R]`、`java.lang.String` | Scala 标准库/JDK；抽象异步结果与可选脚本参数 | port 不调用 Future 构造，不消费 ExecutionContext；不能推断 blocking/timeout/retry 语义 |
| `com.google.inject.ImplementedBy` | Guice 注解，`classOf[<base>.infrastructure.connectors.<Name>Impl]` | [BC scaffold build.sbt:50,72](../baseline/bc/scaffold/build.sbt#L50) 选择 Scala 2.13.14、`libraryDependencies += guice`；未给本族单独 Guice artifact 版本或 jar SHA，未核 jar API/实例化 |
| `javax.inject._` | raw 硬编码 import | port 无 Inject/Singleton 构造；保留 raw 事实，是否移除见 D6 |
| `<base>.application.connectors.<returnTypeName>` | 声明应由手写 case class 提供，与 trait 同包 | `GateRunResult` 只在模型注释作例子，不代表已读到实际定义；没有默认 Unit、通用回执或自动 case class |
| `<base>.infrastructure.connectors.<Name>Impl` | 由 `connector-implementation` 独立生成或经批准的真实实现供应 | 名称契约需匹配；没有 impl metadata 时 port 仍输出引用，可能编译/装配缺项 |
| `<base>.infrastructure.process.<HelperName>` | [ConnectorImplBuilder:18–20][IB] 的手写 runner 依赖 | 本族不能生成或发布 runner；方法 body/API 返回类型须另核，不因名字为 runner 就假设可用 |
| `net.imadz.infra.saga.strict.OperationIdentity`、`TransactionIdentity` | 仅 formal TechnicalPorts companion 的既有身份合同 | [requireApplicationArtifact:4–8][AG] 要求 `net.imadz:saga-core_2.13:0.3.0`，SHA `550fbd5cdb18a50d71a62f8f743d59f24ac1daa03f0aeb07c23c8355c2c0d862`；CLI 会读本地 jar 对 pin，但本次没读/运行 jar。不能拿它替代 Guice port 的供应证明 |

### 6.3 必须显式保留的 raw 债务与跨族接口冲突

- port 本身没有 `???` 或 MANUAL，抽象 def 是能力声明，不是缺省实现失败。
- [ConnectorImplBuilder:24–40][IB] 却只取接口 `methods.headOption`，只生成一个方法且 **`parameters = Nil`**；无接口/无方法时回退 `(firstLower(connectorName),"ProcessResult")`。port 可以多方法且带 scriptParam，两侧并非已完全匹配。
- impl 默认 body 取第一个 helper：有 script 时 `$runner.run("$script")`，无 script 时 `$runner.run()`；无 helper 时精确为 `???`。script 是原样插入 Scala 字符串的代码槽，非已验证安全字符串表达式。
- [ConnectorImplTemplate:34–47][IT] 把 defaultBody 按行缩进放入 `BEGIN MANUAL` / `END MANUAL`；anchor 来源为 impl noteId。不能把 port 的 intent 当实现，不把默认 runner 调用当真实业务已经完成。
- D3 必须让实现组明确：多方法、带 String 参数、返回类 ABI 与注入 runner 是否可匹配。解决之前仍可独立保存本族文档；不能用 `Future.successful(null)`、空成功或省掉方法来宣称编译通过。
- formal 的 `.run/.operation/.completion` 是不同回调合同，phase-query 不等于 Node 只读脚本。不能把 OperationNotExecuted、Boolean 拒绝和基础设施异常混合成通用 `Either[String,Any]`。

## 7. 第二阶段拟写集合、唯一组装 owner 与迁移

**以下为未来实施规格，不是本次写许可。** 当前仅写本 diff 与 details JSON。全部 JS 路径相对 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/`。

### 7.1 本族拟新增路径（全部 proposed，D1/D4 决定接入方式后再创建）

| 路径 | 职责及精确边界 |
|---|---|
| `generators/scala-cqrs-connectors-v1/model.mjs` | 结构契约：逐字段保留 ConnectorModel/ConnectorMethodModel；TypeRef/FieldDef 复用共享结构；不得以整段 content 字符串代替模型 |
| `generators/scala-cqrs-connectors-v1/build-models.mjs` | B01–B10 的有限 adapter；消费经过 admission 的输入，保留 order/note/source；不写文件，不隐式读项目 |
| `generators/scala-cqrs-connectors-v1/templates/connector-port.mjs` | 只负责 C01–C09，import/identifier 已由模型解析；无业务 body、无 impl 输出 |
| `generators/scala-cqrs-connectors-v1/generate.mjs` | 有限 product producer，调用 builder/template，产 entries；本族唯一 port 文件装配入口；不自行写盘 |
| `generators/scala-cqrs-connectors-v1/generator.json` | D4 核定后的 profile/products/kinds；目前没有可合法宣称的既存注册 ID |

推荐复用 [resolveName/resolveNameSet/resolveArtifactPath:77–118][NAME]，但其 `TARGET_REDUNDANT_AFFIX` 会**拒绝**重复技术后缀，并非自动去重；显式 binding 是完整名称，不能再传 affix。兼容/新目标 profile 需共享 owner 固定。`resolveArtifactPath` 依据 profile 的 sourceRoot，不能硬接一个不存在的 module。

共享 TypeRef/import API 要补齐同包可见性、递归参数、重名歧义与 `Future` 的 effect 层。本族不能直接改 `lib/scala-target/model.mjs`；只申报所需合同，不假设该文件当前已提供 BC 等价 API。

### 7.2 集成者独占的共享/旧入口改动

| 路径/文件容器 | 未来动作及唯一 owner |
|---|---|
| `lib/products/generate-cli.mjs`、`lib/products/registry.mjs` | 集成者注册 D4 批准的新 contract/profile；保持已有 family 的 capture guard，不让任意目录被 caller JSON 导入 |
| `lib/project/derive.mjs` / project 配置集成 | 集成者在已裁定输入上建立 connector 元数据映射；不能把 reference-layout 或 artifact-contract 生硬 rename 成新输入 |
| `lib/scala-target/naming.mjs`、`lib/scala-target/model.mjs`、`lib/scala-target/profiles.mjs` | 共享 names/type/layout owner，先固定接口再并行消费，不由本组私建 safeName/类型字符串体系 |
| `src/core/generate.mjs` / writer、ledger、anchor | 共享 writer owner；最终格式→最终 bytes→fingerprint/mappings；旧路径退役要明确 owned plan，不能直接删除应用文件 |
| `generators/connector-dsl/emit.mjs` | **legacy port+impl 同一物理文件的唯一 assembly owner 为集成者**。先协调 split port/impl，再让 legacy 的可适配输入走新 port builder；不能由两个组分别覆盖整文件；impl MANUAL 仍由实现组保留 |
| `generators/connector-dsl/parse.mjs`、`generator.json` | 同 owner 处理 legacy binding 的显式迁移/拒绝说明；未迁移的任意 params/returnType 源码串不得静默“兼容” |
| `generators/scala-cqrs-application/render-technical-ports.mjs`、`produce.mjs` | formal composite owner 独占；D1 未批准前不修改。J00–J12 不等于本族均可删除；必须同时迁移 host/IO/verification 的 typed consumers |
| `generators/scala-cqrs-module-seams-v1/build-models.mjs`、`templates/scala.mjs` | family owner 独占；复用 typed signature 经验，不直接改 family 的 plain/future、root/capture、模块合同来迎合传统族 |

若后续 D1 同意把某些 formal 端口单独建模，候选物理路径为 `<target>/app/<base-as-path>/application/connectors/<ApprovedPortName>.scala`；实现为 `<target>/app/<base-as-path>/infrastructure/connectors/<ApprovedImplName>.scala`（后者另组）；DI/安装装配若需独立文件，归 `<target>/app/<base-as-path>/infrastructure/bootstrap/<ApprovedBindingsName>.scala`。这些符号尚未批准，不创建空文件或永久旧包转发壳，也不把银行 P 中 30 项强行归并成一个新的支付 connector。

同输入的目标 profile 默认选 BC 单工程。多模块若沿 raw 必须保留 root app fallback；若改成 `modules/<module>/src/main/scala`，模块名及依赖闭包在 D2 先裁定，不能同时声称它是 raw 字节复刻。

### 7.3 来源与旧输出退役的具体义务

1. 显式列出旧 `<name>Connector` / `<name>ConnectorImpl` 的全名、路径与新 selfType/implType，一对一确定，不根据稳定 ID 自动反推源码名。
2. 迁移所有 import、DI binding、constructor type、callsite、generated dependency path；formal 则连 hostDefinition、HostIO、verification 的 `Installed/Implementation/Bindings` 消费一起给 composite owner，不在本族独立改。
3. 确认旧文件中 MANUAL body 的 owner、方法锚与保留策略；缺实际实现供应时阻断，不代写银行代码。
4. 新文本最终格式确定后再产生字段/方法/文件映射与 fingerprint；`noteId` 与文件级 `noteIds` 区别须 D5 明示。不得把 trait 的 noteId 广播为每个独立方法的虚构来源。
5. `applyEntries` 的 retained 输出不代表自动删除旧文件，retirement 必须有独占 owned-output 清单和人工冲突报告；不能直接手工改 ledger/anchors。

## 8. 后续 fixture、公开 CLI 形状、副作用与验收

本节所有命令**本次均未运行**。fixture/expected 文件也未创建。不要从这些文字推断存在可运行同输入样板。

### 8.1 最小 fixture 与预期文件集合

拟议根：`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/external-connector-port/`，由后续授权方建立而非本次写入。

| fixture | 输入事实/需显式给出的数据 | 预期内容检查 |
|---|---|---|
| F1 零参数单方法 | 选定完整 PascalCase connector 名、lowerCamelCase 方法名、同包返回类名字、intent；scriptParam None；noteId None | 一份 app/application/connectors trait；def 有 `()`、一层 Future；无默认 Unit、无实现 body |
| F2 script-param + 多方法 | 至少两方法且声明顺序不同于字典序；Some("script") 与 None；独立返回类；显式 script 默认来源 | port 全部方法、String 参数无默认值；同时暴露原 impl 只首方法/parameters Nil 的冲突，不作为已编译 fixture |
| F3 来源/关键字/碰撞 | 真实 fixture 来源 ID、有/无元素 hash；参数关键字；非法名、重复完整名、返回类与 impl 简名冲突 | raw 与目标例外逐项对账；非法输入有明确诊断，不能自动发 `undefined` 或覆盖文件 |
| F4 空集合/空 methods/scope | connectors Nil；单 connector methods Nil；scope 排除该 connector；single 与 multi fallback | 文件数量、空 trait、scope-skip 与 ledger 记录分账 |
| F5 formal 对照 | 固定银行 P 只作只读结构样本；另选非银行 typed 输入承担 D1 的实际映射 | 保留 callbacks/operation identity/原始关联检查；不把 P 转成 Node 脚本输入，不复用被测实现当 oracle |

F1/F2 的返回类与实现必须由获批的独立 fixture 明确供应真实 ABI，不能仅造一个空 case class 让编译通过。预期主文件集合为 `<target>/app/<base>/application/connectors/<Name>.scala`；impl/返回类/DI 若参与编译，应在 fixture 清单按 owner 另列，不算本族新增文件数。没有可替代真实算法的通用 gate success。

### 8.2 已存在 CLI 的准确形状

**legacy 观察入口**（真实位置参数，不能加虚构 `--plan`）：

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/connector-dsl/emit.mjs \
  /absolute/approved-fixture/legacy-spec.json \
  /absolute/owned-new-target/legacy
```

副作用：读取 JSON、mkdir、直接先覆盖 iface 后覆盖 impl、stdout；不生成 graph/ledger/anchor；无内建事务或保留手写承诺。只能在空的独占目标后续运行；结果是 legacy 对照，不是批准目标。

**formal 文件产品入口**（[CLI:66–88][CLI] 四个参数都必填）：

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /absolute/approved-fixture/request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-connectors-v1 \
  --out /absolute/owned-new-target/connector-port \
  --options-json /absolute/approved-fixture/options.json \
  --plan
```

其中 `scala-cqrs-connectors-v1` 是**拟议路径，当前不存在已注册的本族入口**；D4 前该命令不是可成功执行的命令。形状来自真实 CLI，不能以想象补一个 `--artifact external-connector-port`。D4 后先跑 plan，核输出集合仅为批准闭包，再经另一次许可去掉 `--plan`。

- plan 捕获 request/options/manifest，执行产品编译与 source producer，返回内存 plan，不调用 applyEntries；不是运行时验证，也不是 no-work 操作。
- apply 会经 [src/core/generate:135–268][WR] 预检、生成文件写入、`truthsrc.ledger.json` 与 `anchors.json` 写入；先所有源文件，再 ledger，再 anchors，失败无回滚保证。此入口未显示 SQLite project graph 写入；不可把 project 入口的副作用混进来或漏掉 writer 的账项。
- 若选择现有 play-service producer，其 CLI 还读取并校验本地 saga/可能的 Monarch JAR、校验 externalSourceRoots；它产生整个 admitted service 闭包而非本族专用结果，不作为本族轻量重生成入口。

**family 复用若需捕获外置实现**，已有准确形状为：

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-project \
  --project /absolute/approved-fixture/truthsrc.project.json \
  --out /absolute/owned-new-target/module-seams-connector-review \
  --plan
```

[projectCli:159–224][PCLI] 会 capture/validate/roundtrip/compile 作者输入，存在 implementations 时，**plan 分支之前就调用 `verifyImplementationSources`**。本次未读取其非基线实现闭包，故不能保证无验证子进程/临时文件/编译缓存副作用；这是后续开窗前必须核定的停止点。非 plan 还会打开项目 SQLite graph、apply entries、发布 anchors，并在目标写 `.truthsrc/{canonical,request,compiled,inputs}.json`、ledger/anchors。新 out 不会自动隔离 project graph。此命令本次不需要、更不允许运行。

**BC 传统链形状**（须在 BC 独立仓、供应已批准可摄入 connector 的 fixture 后集中运行）：

```bash
sbt \
  -Dcodegen.systemFile=/absolute/approved-fixture/canonical.json \
  -Dcodegen.systemBindings=/absolute/approved-fixture/scala-bindings.json \
  -Dcodegen.targetDir=/absolute/owned-new-target/raw-scala-connectors \
  -Dcodegen.multiProject=false \
  -Dcodegen.ledger=/absolute/owned-new-target/raw-scala-connectors/connector-ledger.json \
  "runMain net.imadz.codegen.CodegenMain"
```

`systemFile/systemBindings` 是 [CodegenMain:62–80][CM] 的真实成对输入槽，与 `codegen.system` 互斥；本次**没有证据表明现有 adapter 已能从该 fixture 形成 ConnectorMetadata**，D4 必须先确认。不能假定任意 `ConnectorParitySystem` 可由 Standard registry 解析，不能采用默认 Examples/banking-app 冒充 scoped fixture。

BC 命令会启动 JVM/sbt，可能编译及解析/下载依赖、写仓内 target/cache，随后建新目标、复制 scaffold、发整个 fixture 的分层闭包、proto 目录、账项、发布 manifest/可选 formal-semantics。它没有本族专用 `--only` 开关；生成前必须把完整副作用/输入闭包及离线供应列入一次集中窗口。运行预算/停止点由执行者明确，不为每个 artifact 单独启动一次全仓生成。

### 8.3 验收矩阵（全部 not-run；复杂度 not-measured）

1. **同等输入完整文件对账**：固定 F1–F4 两端输入映射；分存 raw-scala、approved-target、actual-js。逐路径、package、imports、空行、annotation、声明顺序、每方法参数/返回类型/Logic 注释与全部文件尾对账。无业务实例时保持 missing，不伪造银行实例。唯一可忽略项须逐项批准，例如已明确的不同生成版本头；不压平全部空白。
2. **construct/RHS 对账**：C00–C10、B01–B10、全部 Model 字段，正式 renderer 另核 J00–J12 和四种未实例化的 installedRun 角色。每个参数/returnType/Future 包装及 default 都要有来源与期望；不能只比较 signature 个数。
3. **真实接口编译/装配**：由 connector-implementation owner 提供与 port 完全一致的方法列表、参数和结果 case class，核 Guice 实际供应及 classOf 可见性。当前多方法/scriptParam 冲突 D3 未解前不得宣称编译门可过。
4. **必要行为**：端口声明本身没有业务 body；应验证真实注入实现的成功/明确拒绝/失败传播及一次调用，无隐藏重试、无吞异常、无假成功。若迁 formal composite，独立测试 required id/version、callback 完整性、OperationIdentity/CompletionContext 传递、association gate 在 callback 前后的位置；本族不重跑全银行服务。
5. **协议/身份保护**：检查名义返回类、端口/实现 ID、版本、serializer/PB/PID 未变；不引 ActorRef 到 domain/端口脚本参数，不改 addExact。若触及 actor 调用方才按独立行为合同验证失败不 persist、成功 thenReply 新 state、回复次数及无意外 publish。
6. **表达/复杂度**：生成器与产物普通方法 CC 目标 ≤5；6–10 逐方法说明；>10 重构或逐方法裁定。`install` 的多短路校验与 renderer 的多角色分支必须逐方法测量，当前无分数。不得用 String/Any dispatcher、删校验或全局 generated 例外刷分。
7. **稳定性与回锚**：同输入两次 final bytes 相同；仅改一个 intent/参数输入得到合理局部 diff；最终字节后的来源映射仍指向真实作者，handwritten MANUAL 保留；退休路径与 retained 项不混淆。

## 9. 具体未决项

| ID | 必须裁定的内容 | 影响/默认停止点 |
|---|---|---|
| D1 输入语义与 formal counterpart | 本族只移植 BC Node 工具连接器，还是为 formal typed TechnicalPorts 提供独立映射？若映射，哪些 role、哪些输入/返回类对应一个 connector，哪些仍为 host/runtime 合同？ | 不能将银行 30 个 typed callbacks 压成零/一个 String 参数；传统 formal 对应面目前 missing |
| D2 DI 与模块依赖 | 保留 `@ImplementedBy(infrastructure Impl)` 的传统例外，还是在 `infrastructure.bootstrap` 显式绑定？multi 模式保留 root app fallback 还是批准新 module？ | 不擅自取消注解、不发第四业务层；未批准前禁止 module 搬迁 |
| D3 impl 签名不一致 | 原 impl 仅首方法、parameters Nil，与 port 的多方法/scriptParam 如何一致？由谁提供同包返回类和 runner.run ABI？ | 保存文档不受阻；实现/编译/装配验收阻断；保留 MANUAL/??? 槽，不返回假成功 |
| D4 公开输入与 CLI | 选择新的 versioned connector product，还是有限 module-seams adapter？真实 metadata 摄入路径能否从 fixture 生成所有字段？哪个 manifest/profile/registry owner 批准？ | 新 proposed producer 尚未注册，不能执行即预期成功；需冻结 fixture 与输入映射后进入实施 |
| D5 来源粒度 | 保持 raw trait noteId、方法 noteId 不输出及 `noteIds=Nil`，还是批准显式文件/方法来源补足？方法来源真实来自哪里？ | 不复制 connector noteId 冒充独立方法 ID，不新加作者知识字段 |
| D6 输出排版例外 | 是否批准去掉未使用 `javax.inject._`、以 Future import 简名替代 raw FQN、按共享分组规则重排 imports？ | 本文保留 raw 精确账；裁定写入有限差异白名单后再生成 expected |
| D7 有限输入诊断 | methods Nil 保留空 trait还是拒绝？非法/冲突标识符、非简单 returnTypeName、intent 含换行如何准入，而不静默改源？ | 必须有具名诊断与明确兼容面；不猜默认 Unit、script、timeout 或算法 |
| D8 family 验证副作用 | 若选择 generate-project 复用，`verifyImplementationSources` 的真实实现、子进程/临时文件/缓存路径与离线依赖 pins 是什么？ | 该被调实现未在此次基线索引中定位且本次未读当前文件；后续先记录新增来源 SHA 并核定完整写面，不能因为有 --plan 就运行 |

交付只表明本族观察与差异规格已独立保存；不代表实现、运行验证或 parity 通过。

[M]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/ConnectorModel.scala#L1
[B]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/ConnectorBuilder.scala#L1
[T]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/ConnectorTemplate.scala#L1
[AM]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L5
[CT]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/CodeTemplate.scala#L5
[TS]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4
[GC]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L35
[PL]: ../baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala#L81
[NC]: ../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L69
[DSL]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L13
[META]: ../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L1032
[CM]: ../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L62
[CQ]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L702
[IB]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/connector/ConnectorImplBuilder.scala#L13
[IT]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/connector/ConnectorImplTemplate.scala#L34
[LE]: ../baseline/js/generators/connector-dsl/emit.mjs#L1
[LP]: ../baseline/js/generators/connector-dsl/parse.mjs#L1
[PIPE]: ../baseline/js/generators/pipeline.mjs#L60
[FT]: ../baseline/js/generators/scala-cqrs-application/render-technical-ports.mjs#L2
[PR]: ../baseline/js/generators/scala-cqrs-application/produce.mjs#L17
[PE]: ../baseline/js/generators/scala-cqrs-application/produce-effect.mjs#L6
[PS]: ../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L16
[AG]: ../baseline/js/generators/scala-cqrs-application/generate.mjs#L4
[FN]: ../baseline/js/generators/scala-cqrs-domain/naming.mjs#L15
[CLI]: ../baseline/js/lib/products/generate-cli.mjs#L66
[PCLI]: ../baseline/js/lib/project/cli.mjs#L159
[WR]: ../baseline/js/src/core/generate.mjs#L135
[NAME]: ../baseline/js/lib/scala-target/naming.mjs#L77
[FB]: ../baseline/js/generators/scala-cqrs-module-seams-v1/build-models.mjs#L1
[FG]: ../baseline/js/generators/scala-cqrs-module-seams-v1/generate.mjs#L13
[FR]: ../baseline/js/generators/scala-cqrs-module-seams-v1/render.mjs#L13
[FTem]: ../baseline/js/generators/scala-cqrs-module-seams-v1/templates/scala.mjs#L1
[WF]: ../baseline/js/generators/scala-cqrs-saga-monarch-v1/templates/workflow.mjs#L106
[BANK]: ../baseline/actual-js/app/example/bankwealth/application/bank_payment_hostTechnicalPorts.scala#L1
[CUR]: ../baseline/curated-scala/net/imadz/application/aggregates/repository/CreditBalanceRepository.scala#L1
