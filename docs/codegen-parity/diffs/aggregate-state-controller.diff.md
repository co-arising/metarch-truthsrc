# aggregate-state-controller：写侧聚合状态查询控制器内容规格

## 1. 范围、证据等级和状态

- Artifact：`aggregate-state-controller`，传统清单第 34 项；分组同名。
- 状态：`decision-required`。正式 JS 链缺少本族的已接线 counterpart；legacy 中有相当完整的实现，不能写成“JS 完全没有”。需要裁定的具体接口见第 9 节。
- 固定 HEAD：BC `cc335eb1e0d0fae17bf092fd61b126040196ea70`；JS `bf104e16ab82ef39d7fa416d0997907d18a815ad`。事实依据是冻结文件的完整字节，不是 HEAD 对可变工作副本的担保。
- 本文只有源码内容检视，没有执行生成、类型检查、编译、测试或运行时验证。普通方法 CC≤5 是目标，当前 `not-measured`。
- 仅新增本 diff 和 `details/aggregate-state-controller.json`；未修改生产代码、银行产物、真源、catalog、ledger、anchors、其他 diff 或既有 15 份交付。
- 依据：[编制合同](../AUTHORING-CONTRACT.md)、[布局标准](../layout-and-style.md)、[批准计划](../../../.rounds/prettify-generated-code-resume-20261115-cgr9lzlk/APPROVED-PLAN.md)。额外当前生产源码读取：无，`extraSources=[]`。

### 1.1 四种材料必须分开

| 材料 | 可取得内容 | 不能据此声称的结果 |
|---|---|---|
| `raw-scala` | 下文完整 M/B/T，以及 [dispatch][dispatch]、[writer][writer] 的冻结源码 | 没有本次同输入新生成的 `AggregateStateApiController.scala`，不能冒充有该文件的运行/编译结果 |
| `approved-target` | raw 结构与 RHS 为默认；叠加用户批准的正常 imports、排版、三层布局和名义类型保护；第 6 节给有限覆盖 | 尚无完整、已裁定、同输入的目标输出字节；第 9 节的语义选择不冒充已批准 |
| `actual-js` | [银行 Loader][bank-loader]、[银行 service contract][bank-service]、[银行 repository][bank-repo] 等完整存量文件；另有 [legacy state renderer][legacy-state] | 银行 Loader 的查询端口不等于本族；legacy 模板不是银行正式输出 |
| `curated-scala` | [Endpoint][curated-endpoint]、[CommandDsl / IdGuard][curated-dsl] 为相关人工参考 | 冻结索引未列本族人工 `AggregateStateApiController`；上述支撑文件不能充作本族 golden，且包名并不全部匹配 raw imports |

全文中所有比较均为**结构性对照，非同输入字节比较**。未运行的 fixture 不以缺失文件或零文件结果代替验收。

### 1.2 固定文件身份

下列 SHA-256 与 bytes 已只读核对 [baseline/index.json](../baseline/index.json)。其他固定链接的 bytes/SHA 亦由该索引承载。

| 来源 | bytes | SHA-256 |
|---|---:|---|
| [Model][model] | 1839 | `e82c7a61407d86ccfc945497d7d41ce83f16f6e0e59018ad65784d0e1bd20057` |
| [Builder][builder] | 3681 | `72ae20d5a0eca5356b9058077cea6d4d089a414680e48dbce73e2b4815848095` |
| [Template][template] | 5538 | `12ec14b353d3682a5c9ef36d66520a02e42daa9c81331babae6b95a3f04a7195` |
| [legacy state renderer][legacy-state] | 7239 | `994aeafda60a33c8fea86d1cbdc9cce5c6b8029b7fdb5953a2430c373ad2648f` |
| [legacy dispatcher][legacy-dispatch] | 17379 | `007cfe762df634cc654f86794d9de5cda78f76aaf740749638ad3627e69e74c4` |
| [formal service dispatcher][formal-dispatch] | 6076 | `2586f04d28833e9acd413a59bec9b559a02b0139470a1f48051d48f4e0882df7` |
| [formal service renderer][formal-service] | 12954 | `c8d92119b3e98dc868ea7bc17b018fef4372f24621206d2d00d1af365de160de` |
| [formal page loader renderer][formal-pages] | 7624 | `6c76511c60b1f79510526c3f7ea7642ba8c22870f06e446dd044467e90274c6f` |
| [family HTTP templates][family-http] | 7578 | `8b1910fabfb3448d8a7f0a6e92e815232d43844cde60a4a88e5af3cd7f0db33c` |
| [银行 Loader][bank-loader] | 10379 | `12428f65ad1190f911102bd8bdf448aa6fd4c3017a9eeea301cab658a8eac3a0` |
| [银行 service contract][bank-service] | 11451 | `a7e1c39c8211cc197b11d23b7b7d0faecbcb9a4b409d6bd30283b1a64c30e297` |
| [银行 repository][bank-repo] | 1370 | `561ca59e23b4a2e9f2dd474c3336761a6c28cc20fe87ee70812b472b851a1c42` |

## 2. 真实 Scala 调度、变体与输出边界

`CodegenMain.run` 的传统分支经过 `prepare`，不是 `semanticProductsFile → generateProducts` 支路。[CodegenMain:175–201][main] 显示准备完成后才创建目标、复制 scaffold；旧工作区说明不能取代本冻结版本。`runCommon` 的顺序是 domain → application → infrastructure → interface → 本控制器 → bootstraps，见 [CQRS:203–220][run-common]。

本族入口 [CQRS:1011–1027][dispatch] 的**实际过滤式**为

```scala
val aggregates = system.application.aggregates
  .filter(a => a.repository.isDefined &&
    a.commandFamily.commands.exists(_.name == s"Get${a.name}State"))
if (aggregates.isEmpty) return
val model = AggregateStateControllerBuilder.build(aggregates, ctx)
writeArtifact(
  model,
  AggregateStateControllerTemplate.generate(model),
  root,
  Some(ArtifactAttribution("controller", model.selfType.name, "global", Nil))
)
```

注释说需要只读命令/仓储/IdGuard，但这段 gate **只检查 repository presence 和命令名字**，不检查 `isReadOnly`、reply 字段、IdGuard 是否存在或状态序列化是否可用。不得把注释解释成已经有这些验证。

| 变体 | 条件 | 源码推导的文件基数/位置 | 当前证据 |
|---|---|---|---|
| `single-enabled` | 过滤后 N>0，scope 允许，写入领地接受 | 一份 `<target>/app/controllers/AggregateStateApiController.scala`，N 个方法、N 个 state writer、N 个 reply writer | 模板已读，未 exercised |
| `multi-enabled-root` | 同上，`multiProject=true` | 同一 `<target>/app/controllers/AggregateStateApiController.scala`；`controller → root`，不是 `modules/kernel` 或 `modules/glue` | [CQRS:331–378][writer]，未 exercised |
| `suppressed-no-eligible-aggregate` | N=0 | 零文件、零本族方法；不直接渲染空构造器 | 源码条件已观察，未执行 |
| `scope-or-territory-suppressed` | N>0 但 `currentScope.includes` 为 false，或领地 KEEP/拒写 | 不保证落盘；ledger 在 scope return 前已 record | [CQRS:379–425][writer]，不是“预览无副作用” |
| `writers-instant/id` | 全部 entries 的字段 signature 子串谓词满足 | 控制器级各零/一个共享 writer，顺序 Instant 再 Id | [Template:35–51][template]，四种组合未执行 |

每个可发射 endpoint 意向路由为 `GET /api/state/<routeSegment>/:id`，动作参数统一 `id: String`，不是以 `idParam` 替换 HTTP 路径参数名。**本 Scala 调度不写该路由**：[CQRS:1004–1007][dispatch] 明示交给 Node `gen_api_layer` 的 E301 块。`routeBase`、`routeSegment` 有结构意义，但该 Template 不读 `routeBase` 来写 routes。本项给 route owner 数据合同，不另写 routes 文件，也不把其他 RoutesTemplate 的一般 marker 路径误认成本族已接通。

## 3. raw-scala 完整 M/B/T

以下是冻结源文件全文（代码围栏不含 Read 工具行号）。不是重新生成的 Scala 业务产物。

### 3.1 Model 全文

来源 [AggregateStateControllerModel.scala:1–40][model]。

```scala
package net.imadz.codegen.scaffolding.cqrs.model.infrastructure.api

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

/** S1 聚合面（2026-09-27 用户拍板）：写侧聚合状态强一致查询控制器模型。
  *
  * 单控制器 `AggregateStateApiController`，每聚合一个方法：
  * `repository.entityRef(id).ask(GetState)` → 结果直接返回（implicit OWrites 序列化）。
  * auth 简化走 `api.global.read`。GET /api/state/<kebab-agg>/:id。
  *
  * 每聚合条目：
  * @param methodName   控制器方法名（camelCase 聚合基名，如 concept）
  * @param repository   仓库注入字段（name＝<X>Repository·typeRef＝仓库 trait）
  * @param entityTypeKey 聚合分片键（entityRefFor 用——经 repository.entityRef 封装）
  * @param getIdCommand GetState 命令类型（FQN 解析后的 TypeRef）
  * @param replyType    GetStateReply 类型
  * @param idParam      寻址参数名（聚合 identifier 字段名，如 conceptId）
  */
case class AggregateStateControllerModel(
    override val selfType: TypeRef,
    routeBase: String,
    entries: Seq[AggregateStateEndpointModel],
    override val dependencies: Set[TypeRef]
) extends ArtifactModel

case class AggregateStateEndpointModel(
    methodName: String,
    routeSegment: String,
    repository: FieldDef,
    getIdCommand: TypeRef,
    replyType: TypeRef,
    idParam: String,
    /** 状态字段形状（序列化面——controller 层逐字段 OWrites 的发射源；typeRef.signature 即 Scala 类型） */
    stateFields: Seq[FieldDef] = Nil,
    /** 状态类型（如 ConceptState——OWrites[X] 与 Json.toJson(s.<f>) 的目标类型） */
    stateType: Option[TypeRef] = None,
    /** 聚合知识 id（容器锚——清单/台账面） */
    noteId: Option[String] = None
)
```

### 3.2 Builder 全文

来源 [AggregateStateControllerBuilder.scala:1–72][builder]。

```scala
package net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.api

import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.api.{
  AggregateStateControllerModel,
  AggregateStateEndpointModel
}
import net.imadz.codegen.scaffolding.cqrs.{FieldDef, GeneratorContext, TypeRef}
import net.imadz.meta.{AggregateRootMetadata, CommandRef, DomainEntityMetadata}

/** S1 聚合面（2026-09-27 用户拍板）：AggregateStateApiController 装配器。
  *
  * 单控制器、每聚合一方法：`repository.entityRef(id).ask(GetState)` →
  * 结果直接返回（implicit OWrites[GetStateReply] 序列化）；auth 简化 `api.global.read`。
  * GetState 命令由 AssemblyEngine 技术合成（每聚合恒在——此处只做解析，不存在即编程错误）。
  *
  * 产物两条：控制器文件 + routes 行（复用 RoutesBuilder 的行形态，独立标记块）。 */
object AggregateStateControllerBuilder {

  /** camelCase：ConceptState → conceptState（方法名） */
  private def camel(s: String): String = s.head.toLower + s.tail

  /** kebab-case 路由段（与 gen_api_controllers/core.mjs kebab 同形）：
    * DoR → do-r（先例＝routes 既有 /api/do-r/:dorId/... 行）。 */
  private def kebab(s: String): String =
    s.replaceAll("([a-z0-9])([A-Z])", "$1-$2").toLowerCase

  def build(aggregates: Seq[AggregateRootMetadata], ctx: GeneratorContext): AggregateStateControllerModel = {
    val pkg = ctx.layout.infrastructure.api.root
    // Play 惯例：controller 落 controllers 包（与 ControllerTemplate 同位——Route 引用 controllers.<Name>）
    val controllerPkg = "controllers"
    val selfType = TypeRef("AggregateStateApiController", controllerPkg)

    val entries = aggregates.map { agg =>
      val base = agg.name.replaceAll("Aggregate$", "")
      val repoType = ctx.typeResolver.aggregateRepository(agg.name)
      val cmdName = s"Get${base}State"
      val cmdType = ctx.typeResolver.command(CommandRef(cmdName))
      // reply 解析：Get<X>StateReply 与命令同包（protocol 文件）
      val replyType = TypeRef(s"${cmdName}Reply", s"${ctx.layout.application.aggregates.root}.${base}Protocol")
      // 状态形状：实体元数据（stateRef → <X>Entity）→ 字段清单（controller 层 OWrites 发射源）
      // 与 DomainEntityBuilder 同口径：排除 nature 字段（如 credential 密钥——不入状态签名，序列化面同步排除）
      val stateType = ctx.typeResolver.entityState(agg.stateRef.targetName)
      val stateFields: Seq[FieldDef] =
        ctx.metaRegistry.resolveByName[DomainEntityMetadata](agg.entityRef.targetName)
          .map(e => e.state.fields
            .filterNot(f => f.nature.nonEmpty && ctx.excludedStateFieldNatures.contains(f.nature))
            .map(f => FieldDef(f.name, ctx.typeResolver.resolve(f.fieldType))))
          .getOrElse(Nil)
      AggregateStateEndpointModel(
        methodName = camel(base),
        routeSegment = kebab(base),
        repository = FieldDef(camel(repoType.name), repoType),
        getIdCommand = cmdType,
        replyType = replyType,
        idParam = agg.identifier.name,
        stateFields = stateFields,
        stateType = Some(stateType),
        noteId = agg.noteId
      )
    }

    val deps = (entries
      .flatMap(e => Seq(e.repository.typeRef, e.getIdCommand, e.replyType))
      ++ entries.flatMap(e => e.stateFields.flatMap(_.typeRef.collectAllDependencies))
      ++ entries.flatMap(e => e.stateType.toSeq.flatMap(_.collectAllDependencies)))
      .filter(_.shouldImport(controllerPkg))
      .toSet

    AggregateStateControllerModel(selfType, "/api/state", entries, deps)
  }
}
```

### 3.3 Template 全文

来源 [AggregateStateControllerTemplate.scala:1–111][template]。

```scala
package net.imadz.codegen.scaffolding.cqrs.template.infrastructure.api

import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.api.AggregateStateControllerModel
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

/** S1 聚合面（2026-09-27 用户拍板）：AggregateStateApiController 渲染。
  *
  * 每聚合一个方法：api.global.read()（auth 简化档）→ IdGuard 解析 :id →
  * repository.entityRef(id).ask(Get<X>State) → reply 直接返回。
  *
  * 序列化**收在本控制器**（用户裁决：Json 不进 domain/application 包）：
  * 每聚合私有 `writes<X>State: OWrites[<X>State]` 逐字段 Json.obj 手写——
  * 不依赖宏（>22 字段 case class 无合成 unapply，Json.format 宏走不通·实测 23 字段即炸）、
  * 无字段数上限；Instant/Id 等非基本类型的私有 Writes 定义在各 state writes **之前**（作用域可见性）。
  */
object AggregateStateControllerTemplate extends CodeTemplate[AggregateStateControllerModel] {

  def generate(model: AggregateStateControllerModel): String = {
    val importLines = (model.dependencies.toList.sortBy(_.fqn).map(_.fqn) ++ Seq(
      "java.time.Instant",
      "javax.inject.Inject",
      "javax.inject.Singleton",
      "net.imadz.common.CommonTypes.Id",
      "net.imadz.common.auth.Endpoint",
      "net.imadz.common.auth.ApiError",
      "net.imadz.metarch.infrastructure.api.IdGuard",
      "play.api.libs.json.{JsValue, Json, OWrites, Writes}",
      "play.api.mvc._",
      "scala.concurrent.ExecutionContext",
      "scala.concurrent.duration._"
    )).distinct
      .map(i => s"import $i")
      .mkString("\n")

    // 非基本类型 Writes：控制器级单份（26 聚合共享——Instant/Id 的私有隐式，定义在全部 state writes 之前）
    val anyInstant = model.entries.exists(_.stateFields.exists(_.typeRef.signature.contains("Instant")))
    val anyId = model.entries.exists(_.stateFields.exists(f => f.typeRef.signature.contains("Id") && f.typeRef.name != "String"))
    val sharedWriters =
      (if (anyInstant)
        """  // Instant → ISO-8601 串（用户裁决：序列化收 controller 层——不进 domain）
  //  null-safe：empty 状态的 Instant 中性值是 null（生成器 empty 工厂），写 JsNull 不炸（J-11：Option 组合子形）
  private implicit val s1InstantWrites: Writes[java.time.Instant] =
    (i: java.time.Instant) => play.api.libs.json.Json.toJson(Option(i).map(_.toString))
"""
       else "") +
        (if (anyId)
          """  // Id(UUID) → 串（同上·controller 层私有·null-safe）
  private implicit val s1IdWrites: Writes[net.imadz.common.CommonTypes.Id] =
    (i: net.imadz.common.CommonTypes.Id) => play.api.libs.json.Json.toJson(Option(i).map(_.toString))
"""
         else "")

    // 逐聚合：OWrites[XState]（Json.obj 逐字段手写——不走 Json.format 宏：>22 字段 case class 无合成 unapply）
    val writers = model.entries.map { e =>
      val st = e.stateType.getOrElse(e.replyType)
      val pairs = e.stateFields.map { f =>
        val t = f.typeRef.signature
        val id = net.imadz.codegen.structure.NamingConventions.scalaIdentifier(f.name)
        s""""${f.name}" -> play.api.libs.json.Json.toJson[$t](st.$id)"""
      }.mkString(",\n    ")
      s"""  /** S1 聚合面：${st.name} → JSON（逐字段手写·无字段数上限） */
  private val writes${st.name}: OWrites[${st.fqn}] = (st: ${st.fqn}) => play.api.libs.json.Json.obj(
    $pairs)
"""
    }.mkString("\n")

    val replyWriters = model.entries.map { e =>
      val st = e.stateType.getOrElse(e.replyType)
      s"""  /** S1 聚合面：${e.replyType.name} 信封（state 字段平铺）——implicit 供 DSL apply[T] 隐参取用 */
  private implicit val writes${e.replyType.name}: OWrites[${e.replyType.fqn}] =
    (r: ${e.replyType.fqn}) => (writes${st.name}: OWrites[${st.fqn}]).writes(r.state)"""
    }.mkString("\n")

    val methods = model.entries.map { e =>
      s"""  /** S1 聚合面：${e.routeSegment} 写侧状态强一致查询（Get<X>State → Reply·不产事件） */
  def ${e.methodName}(id: String): play.api.mvc.Action[play.api.mvc.AnyContent] =
    api.global.read().apply[${e.replyType.fqn}] {
      _ => {
        IdGuard.parse("${e.idParam}" -> id) match {
          case Right(Seq(${e.idParam}Cid)) =>
            ${e.repository.name}.entityRef(id).ask {
              (replyTo: akka.actor.typed.ActorRef[${e.replyType.fqn}]) => ${e.getIdCommand.fqn}(${e.idParam}Cid, replyTo)
            }.map(reply => Right(reply): Either[ApiError, ${e.replyType.fqn}])
          case Left(err) => scala.concurrent.Future.successful(Left(err): Either[ApiError, ${e.replyType.fqn}])
        }
      }
    }"""
    }.mkString("\n\n")

    s"""package ${model.selfType.packageName}

$importLines

/** AggregateStateApiController: S1 聚合面写侧强一致状态查询（每聚合 Get<X>State 直读·2026-09-27 生成范式）
  * 序列化收在 controller 层（用户裁决：domain/application 不引入 play-json）。 */
@Singleton
class ${model.selfType.name} @Inject() (api: Endpoint, ${model.entries.map(e => s"${e.repository.name}: ${e.repository.typeRef.fqn}").mkString(", ")}, val cc: ControllerComponents)(implicit ec: ExecutionContext) extends BaseController {

  override def controllerComponents: ControllerComponents = cc
  private implicit val timeout: akka.util.Timeout = akka.util.Timeout(5.seconds)

$sharedWriters
$writers
$replyWriters

$methods

}"""
  }
}
```

## 4. 逐字段、规则与输出 construct/RHS 账

### 4.1 Model：顺序就是合同

| ID / 顺序 | 字段、默认及依赖 | 当前 JS 对照 / 目标 |
|---|---|---|
| M1 | `selfType: TypeRef`，override，无默认 | legacy 固定 class/package；目标显式 TypeRef，保留 `controllers.AggregateStateApiController` |
| M2 | `routeBase: String`，无默认，Builder 给 `/api/state` | legacy routes 硬编码；目标模型保留，不谎称 Template 已消费 |
| M3 | `entries: Seq[AggregateStateEndpointModel]`，无默认，保留输入顺序 | legacy renderer 内部对象数组；目标移到 Builder，不按输出名重排 |
| M4 | `dependencies: Set[TypeRef]`，override，无默认 | legacy 内部 `Set<string>`；正式链无此模型；目标保留结构型依赖及嵌套参数 |
| E1 | `methodName: String`，无默认 | legacy `camel(base)`；目标 resolver 校验碰撞/关键字，但业务名与稳定身份分开 |
| E2 | `routeSegment: String`，无默认 | legacy `kebab(base)`；URL 不是可自由重命名的源码标识符 |
| E3 | `repository: FieldDef`，无默认 | legacy 拆成 `repoName/repoFqn`；目标 name+typeRef，不内嵌构造器整行字符串 |
| E4 | `getIdCommand: TypeRef`，无默认 | 名称虽然含 Id，真实用途是 `Get<X>State`；legacy `cmdFqn`，不可改成发写事件 |
| E5 | `replyType: TypeRef`，无默认 | legacy `replyFqn`；目标必须是有 `state` 成员的实际协议，不凭名制造 Reply |
| E6 | `idParam: String`，无默认 | legacy `a.identifier`；用于错误输入标签、局部 `<idParam>Cid`，HTTP 参数仍叫 id |
| E7 | `stateFields: Seq[FieldDef] = Nil` | legacy 默认 `a.stateFields ?? []`；顺序、筛选后的全部字段逐项发 JSON，不从名字猜字段 |
| E8 | `stateType: Option[TypeRef] = None` | legacy 总是合成 `${base}Entity.${base}State`；raw 模板 None 回退 replyType；目标需先判定该 fallback 是否可接受 |
| E9 | `noteId: Option[String] = None` | legacy `a.noteId ?? null`；raw template 不用它，外层 Model 也未提升为 noteIds |

[ArtifactModel:5–47][artifact-model] 的继承成员同样需要登记：`fqn = selfType.packageName + "." + selfType.name`；`registerTo(registry) = registry.register(this)`；`morphisms = Nil`；`noteIds = Nil`。本 Model 未 override 后两者。因此 endpoint.noteId 存在并不等于 raw 文件级 ledger/成员锚已承载它。Model 文档的 `entityTypeKey` **没有实际字段**；禁止照注释新增字段冒充原始合同。两 case class 没有自定义 companion、类型上下界、额外方法或源码 body 槽。

共享字段 [TypeSystem:4–85][type-system]：

- `TypeRef(name: String, packageName: String, typeParams: Seq[TypeRef] = Nil)`；`fqn` 不含类型参数；`signature` 对有参数的 TupleN 用 `(T1, T2)`，其他泛型用 `Name[T...]`，无参数用 name。
- `collectAllDependencies = Set(this) ++ typeParams.flatMap(_.collectAllDependencies)`；`shouldImport` 排除空包、当前包、`scala`、`java.lang`。
- `FieldDef` 顺序为 `name, typeRef, defaultValue: Option[String]=None, comment: Option[String]=None, noteId: Option[String]=None, description: String=""`。本 Builder 只传前两项，后四项全部默认；Template 只消费 name/typeRef，不发字段 default/comment/noteId/description。
- 标准 TypeRef 值/构造器有 String/Int/Long/Boolean/Unit/Double、`BigDecimal → scala.math`、List/Option/Map 的嵌套参数与 Nothing。不能用 `String` 或 `Any` 抹平 bank 的 AccountId/TxId/Money。

### 4.2 Builder：每个规则和分支

| ID | 固定源位置 | 完整规则及需保留/裁定的内容 |
|---|---|---|
| B1 | 20 | `camel = s.head.toLower + s.tail`，只改首字符；空字符串会失败，无空名 fallback |
| B2 | 24–25 | 仅在小写/数字→大写边界插 `-` 后整体小写；不是完整缩写分词算法，`DoR → do-r` |
| B3 | 28–31 | 读取 layout.api.root 到未使用的 `pkg`，实际强制 `controllerPkg="controllers"`；selfType 固定类名 |
| B4 | 33–39 | 原聚合顺序 map；只删名字末尾 `Aggregate`；repo resolver 使用原 agg.name；命令 `Get${base}State` 走 CommandRef resolver；reply 用 `${application.aggregates.root}.${base}Protocol` 直接拼 TypeRef，未通过 reply resolver |
| B5 | 42 | stateType 来自 `agg.stateRef.targetName`；[TypeResolverDSL:144–149][state-resolver] 将 State 放在 entity 嵌套 owner 中，不从 HTTP DTO 推导 |
| B6 | 43–48 | entityRef 名字按 `DomainEntityMetadata` 查 registry；找到时按 e.state.fields 原顺序，排除 `nature.nonEmpty && excludedSet.contains(nature)`；每项 `FieldDef(f.name, resolve(f.fieldType))`；未找到得到 Nil；不调用 resolveField(optional,...)，不额外读取 optional/default/noteId |
| B7 | 49–59 | 顺序组装 E1–E9；repo 字段名取实际 repoType.name 的首字母小写；idParam=agg.identifier.name；stateType 始终 Some；noteId=agg.noteId |
| B8 | 62–67 | repo/command/reply 三个 TypeRef 直接加入，不在这三项递归；stateFields、stateType 递归收依赖；先 shouldImport(controllers)，后 toSet；不把固定框架 imports 放入 Model.dependencies |
| B9 | 69 | `AggregateStateControllerModel(selfType, "/api/state", entries, deps)`；没有 I/O、注册、ledger 写入或本族业务实现字符串 |

支撑 resolver 的可见边界：

- [aggregateRepository:463–470][repo-resolver] 经 `NamingConventions.getBaseName`，返回 `application.aggregates.repository.<base>Repository`；getBaseName 的依次 suffix 剥离与 lastNonEmpty 回退见 [Naming:187–224][naming]，并非本 Builder 的单一 `Aggregate$` 替换。
- [TypeResolver:19–90][type-resolver] 解析基础类型、引用、泛型；CustomType 对 knownFrameworkTypes 优先，递归参数，默认 `net.imadz.domain.values` 重定位当前 domain.values；未知非 MetaRef 最后 `Any`。`resolveMetaRef` 在 93 行仍是 `???`，该真实共享未实现槽不能被文档抹掉。
- 命令解析 [TypeResolverDSL:556–580][command-resolver] 根据 symbol owner 的 Aggregate/Saga/Entity/Query/其他类型选包；owner 不存在时回退 application.aggregates 根，不抛“命令必然存在”。
- 字段 access 用 [Naming:172–181][naming] 的关键字反引号；字段 JSON key 保留原 name。raw 并没有完整字符串 literal 逃逸或方法/局部变量名校验。

重要基准冲突：dispatch 用 `Get${a.name}State`，Builder 用删 `Aggregate` 后的名字。带后缀聚合可以 gate 与解析不一致。必须分别记录，不擅自选择其中之一覆盖基准。

### 4.3 Template：从上到下的所有 emitted constructs

| ID | 输出位置 / 源行 | RHS、body、顺序及条件 | JS / 目标处置 |
|---|---|---|---|
| T0 | 文件头 | Template 从 `package ${selfType.packageName}` 开始；fingerprintHeader 由 writer 前置 | legacy state renderer 自带固定 TAG；目标由唯一 writer 负责真实来源头 |
| T1 | imports，19–33、90–92 | Model.dependencies 先按 fqn 排序，转 fqn，追加 11 个固定 import 字符串，distinct 保留第一次出现，再逐行 `import`；不是全量重新排序，也没有自动空行分组 | raw 完整清单见全文；目标动态 import/有限别名解析在格式与 fingerprint 前完成，不能删缺失依赖来编译 |
| T2 | 类文档、95–97 | 固定两行 S1 文档；`@Singleton`；`class` 非 final；类无泛型/self-type/其他父类 | 按原文保留语义说明，不把“强一致”注释当跨进程验证 |
| T3 | 主构造器，97 | 第一参数 `api: Endpoint`，之后 entries 顺序的 `repository.name: repository.typeRef.fqn`，最后 `val cc: ControllerComponents`；`@Inject()` 修饰构造器；第二列表 `(implicit ec: ExecutionContext)`；`extends BaseController` 无父构造实参 | 目标按行排版，repo 用解析后短名；无辅构造器、默认参数或资源获取 |
| T4 | 99 | `override def controllerComponents: ControllerComponents = cc` | 精确保留，不改为另一个 Controller 基类来藏差距 |
| T5 | 100 | `private implicit val timeout: akka.util.Timeout = akka.util.Timeout(5.seconds)` | 控制器级单份 5 秒；目标可 import Timeout，不改时限，不默认为配置读取 |
| T6 | shared writers 第一项，36、39–45 | anyInstant 为任一 state field signature 包含 `Instant`；true 才发注释和 `private implicit val s1InstantWrites: Writes[java.time.Instant] = (i: java.time.Instant) => Json.toJson(Option(i).map(_.toString))`；false 空串 | null 经 Option 为 JSON null，非 null 为 toString；不是 epoch milli，也不产生当前时间 |
| T7 | shared writers 第二项，37、46–51 | anyId 为 signature 含 `Id` 且 typeRef.name 不等于 String；true 发 `private implicit val s1IdWrites: Writes[net.imadz.common.CommonTypes.Id]`，同样 `Option(i).map(_.toString)` | 名字子串是 heuristic，不等于任意 nominal Id writer；保留精确条件账，目标类型级识别须 D4 裁定 |
| T8 | 所有 state writers，54–65 | 每 entry 取 `st=stateType.getOrElse(replyType)`；逐 field 原顺序生成 `"原name" -> Json.toJson[typeRef.signature](st.<scalaIdentifier(name)>)`，以逗号换行连接；`private val writes${st.name}: OWrites[st.fqn] = (st: st.fqn) => Json.obj(pairs)`；每项结尾换行，writer 之间再换行 | 不 implicit、不用宏、不把空字段补成默认状态；Nil 对应 Json.obj()；不在 domain/application 中注入 Play JSON |
| T9 | 所有 reply writers，67–72 | 每 entry 同样的 st fallback；`private implicit val writes${replyType.name}: OWrites[replyType.fqn] = (r: replyType.fqn) => (writes${st.name}: OWrites[st.fqn]).writes(r.state)` | 直接平铺 state JSON，不加 `state` wrapper，不输出整个 reply 元数据；需要真实 `.state` 合同 |
| T10 | 每 endpoint 文档/签名，74–77 | entries 原顺序；doc 插 routeSegment；`def methodName(id: String): Action[AnyContent]`；`api.global.read().apply[replyType.fqn]`，零显式 roles | 与 bank customer/operator/resource 授权不同，不能机械替换 |
| T11 | 方法 success，78–83 | 忽略 auth ctx；先 `IdGuard.parse("idParam" -> id)`；仅 `Right(Seq(idParamCid))` 分支：repo.entityRef 使用原始 String id，ask lambda 参数为 `ActorRef[replyType]`；命令实参顺序 `(解析Id, replyTo)`；Future.map 成 `Right(reply): Either[ApiError, Reply]` | typed ActorRef 只在应用命令/HTTP 边界；不把原 String 身份改为格式化 UUID；不使用 DB 投影冒充这次 actor read |
| T12 | 方法 failure，84–87 | `Left(err)` → `Future.successful(Left(err): Either[ApiError, Reply])`；未 ask，无本地 recover；没有 `Right(其他Seq)` 分支 | ask 超时/异常交外层 Endpoint，不能猜统一 503；IdGuard 的基数合同与部署 API 须核实 |
| T13 | 方法连接/收尾，88、102–108 | methods 间两个换行；shared→全部 state writers→全部 reply writers→全部 methods；最后空行和 `}`，raw 返回字符串没有额外末尾换行 | 初始化顺序不能把共享 implicit 移到使用者之后；最终换行差异必须列白名单 |

本族没有 emitted object/trait/case class/type alias/var/lazy val/overload/嵌套 companion、没有 MANUAL 块，也没有 `???` 或 command-helper 算法。T6–T12 的生成侧变量是 Template 局部源码字符串，不是 Model 业务 body 槽；不得以此把整个 JS Model 改成 `content`。共享 `TypeResolver.resolveMetaRef=???` 单独保留为不可假实现的阻断面。

## 5. JS 三条链的真实关系

### 5.1 formal 银行链：入口可达不等于本族可达

[registeredProductProducer:92–101][product-cli] 明确注册 `scala-cqrs-play-service` 与新 family；不注册 `_deprecated/scala-cqrs-es-api`。银行对应 producer [generate:59–70][formal-dispatch] 的 `play-service-dsl.produce` 调用 `renderService`、`renderJournalReadside`、`renderTestSupport`、`renderConfiguration`，继承链对 aggregate-dsl 用 `renderAggregateLayers`。这里没有调用 `renderStateApiController`。

[renderService:20–31,95–101,199–204][formal-service] 以 service artifact 的显式 HTTP endpoint/port 为输入；`hasPages` 为 true 时调用 [renderPageLoader:20–133][formal-pages]。银行存量具有 PageRenderer、apiActions/pageActions，不能拿无 pages 的另一 loader 分支冒充银行实际体。

- [银行 Loader:47–71][bank-loader]：`invoke` 先 `endpoint.reads.reads(input)`；成功才 `endpoint.run(principal,value)`；Right 用 `endpoint.writes`，Left 用 Failure，JsError=InvalidRequest。14 条 API route 明确是 accounts/me、cash requests、orders、sip plans、pending operations、reconcile 和 tick；这里没有 `/api/state/...`。
- [银行 Loader:89–128][bank-loader]：解析器 65536；等待 composition.ready；authenticate；按 audience 验角色；写请求另查 csrf；组装 path/query/body 的 Json；调用 row.run；recover Unavailable；page 分支另做 HTML 输出和安全 headers。**这些并非 raw state endpoint 的等价装饰，不能整段删除后宣称 parity。**
- [银行 service:44–60][bank-service]：`Endpoint[I,O]` 绑定外置 implementation/version、Reads/Writes、`(Principal,I)=>Future[Outcome[O]]`；`BankAccountQuery` 的输出是 `BankAccountResponse`，不是 `GetCreditBalanceStateReply`。本轮没读手写 BankServiceEndpoints，不推断它内部读 actor 还是 JDBC。
- [银行 aggregate:7–15][bank-aggregate]：已有 `GetState(replyTo: ActorRef[CreditBalanceState])`，没有 id 参数或 Reply envelope；[application protocol:9–28][bank-protocol] 用 alias 回指 domain。不能把 typed reply 已存在说成缺失；缺的是 BC 所要求的**类型/寻址/封装及层次**。
- [银行 behavior:16–19][bank-behavior]：query 为 `Effect.none.thenRun((s: State) => reply ! s)`；[repository:7–29][bank-repo] 为本地泛型 `get(id: K): Handle`、`Handle(persistenceId, ActorRef[Command])`，有 identity/spawn/close 的显式所有权。没有 `entityRef(String): EntityRef[Command]` 接口，禁止只改方法名套上 sharding 假象。

### 5.2 legacy：有本族的近似完整内容，但不是 formal 的接线

精确入口是 [legacy generate:230–256][legacy-dispatch]：

1. `canonical.stateRoster ?? canonical.aggregates ?? []`，不按 BC 的 repository/GetState gate 过滤。
2. stateNoteIds 为 map/filter/sort；不去重；有内容才放入 entry.noteIds。
3. 无论 roster 是否为空都 push `app/controllers/AggregateStateApiController.scala`；`kind=controller, schemaCategory=projection, families=[], deps=[]`，和 BC 的 category=global/结构依赖不同。
4. routes 在 view/vector 后追加 `stateRouteLines`；与其他 HTTP 路由合成一个 E301 marker entry，`merge=markers, noLedger=true`，不是本控制器独占 conf/routes。

[legacy manifest:1–24][legacy-manifest] 是 `truthsrc/v0.3` 输入、controller/routes kinds，未声明 formal declaredProducts；[legacy core plan:23–42][legacy-core] 可按给定目录动态 import generate、执行两次做字节稳定比较、再按 entry.path 排序。结论为**显式 legacy generate 调用路径存在**，不是因 `_deprecated` 文件夹名就判死代码；是否仍有特定现役消费者，本轮没有运行或消费者配置证据。formal registered producer 表没有它，因此不能直接用 generate-products 选这个目录。

legacy renderer [state_api:12–139][legacy-state] 的逐构造差距如下。

| legacy 位置 | 内容与 raw 对照 | 目标 |
|---|---|---|
| 12–17 | 固定 TAG `CodegenMain:225ed28b`/release 1.0.0；camel/kebab 本地实现；关键字集少了 BC 的 if/with/null/true/false，多了 then | 去硬编码来源头；共享 resolver 负责标识符，保留 URL 身份 |
| 20–22 | 每 aggregate 一行固定 GET route，直接使用 a.name，没有去 Aggregate 后缀 | endpoint 模型只派生一次，路由 assembly owner 消费同一模型 |
| 24–46 | renderer 内同时做 Model/Builder；base=a.name；state/protocol/repo 全固定 net.imadz.metarch；id=a.identifier；credential 固定排除；scalaSig 解析字符串；noteId 收集但 renderer 不发锚 | 独立结构 Model/Builder；不凭字符串拆成“MBT 三目录” |
| 50–72 | Set<string> 收 repo/cmd/reply/state；fields 用 depsOf(sig,net.imadz.common)；固定 imports 与 raw 相同 | 对齐 TypeRef/依赖递归及 shouldImport；unknown VO 不固定为 metarch |
| 74–87 | Instant 同 signature 子串；Id 用 `!sig.startsWith('String')`，不等于 raw 的 typeRef.name != String；两个 shared bodies 基本同 raw | 保留 null/ISO/string 语义，类型识别改动单列 D4 |
| 89–101 | state writer 名称固定 `writes${base}State`，状态没有 Option/fallback；reply 调 `.state` 平铺，其他 field emitter 与 raw 同类 | 用实际 state TypeRef 命名；碰撞检测、真实状态形状与 writer 义务 |
| 103–115 | endpoint 顺序、IdGuard→entityRef(raw id)→typed ask→Either 两分支与 raw 同形 | 可复用语义，不复制 metarch 包名/FQN 密集表达 |
| 117–139 | ctor 拼接、class、cc/timeout/shared/state/reply/method 顺序与 raw 对应 | 一个 controller assembly owner；空输入不可得到 `api: Endpoint, , val cc` |

共享 legacy 类型 helper 的实际内容不是黑箱：[scalaSig:56–73][legacy-types] 将 UUID 映射 Id，string/int/long/double/bool/decimal/instant/json/enum 等映射简单 signature，递归 List，空值默认 String，未知非空保留原串。[depsOf:15–29][legacy-deps] 递归 parseType；Id/iMadzError→framework CommonTypes，Instant→java.time，集合→scala.collection.immutable，基本类型等无 import，未知类型一律 metarch.domain.values。该 fallback 不能用于 bank 跨上下文 nominal types。

### 5.3 family：有 HTTP controller，不是 aggregate-state-controller

[generate.mjs:10–42][family-generate] 的 `scala-cqrs-play-application-v1` 通过固定 manifest、十产品闭包、外置 implementations capture，构造模型后调用 render。[render:16–46][family-render] 单独登记 controller、codec、queryService、routes、view、components 等 jobs。

[http.mjs:21–110][family-http] 实际是 `secured` + typed resource decode + command service + `receipts(id, after, limit)` 的分页读侧/controller/page/readiness。query/page 调 application.queries.receipts，不是 repository.ask(Get<X>State)。该 family 可复用结构 writer/来源映射经验，但不能把 receipts 查询改为全状态查询来填本族空缺，也不能宣称它已支持 S1。

## 6. 内容 diff 与 approved-target 的有限覆盖

### 6.1 JS Builder 实际规则 → raw/目标一致的排除规则

这是**生成器结构差异**，不是可直接应用的 production patch。minus 精确取自 [legacy state_api:39–43][legacy-state]；plus 是拟议 Builder 中显式传入 `excludedStateFieldNatures` 后的规则，与 [BC Builder:43–48][builder] 同义。保留未确定输入字段绑定问题，不能将裸 a.stateFields 当已批准的 formal 输入。

```diff
--- actual-js-legacy/templates/state_api.mjs
+++ approved-target/proposed-state-controller-builder-rule
@@
       stateFields: (a.stateFields ?? [])
-        .filter((f) => f.nature !== 'credential')
+        .filter((f) => !(f.nature && excludedStateFieldNatures.has(f.nature)))
         .map((f) => ({ name: f.name, id: id(f.name), sig: scalaSig(f.dataType) })),
       noteId: a.noteId ?? null,
```

这里 map 行是上下文，不表示目标继续永久采用 scalaSig 或本地 id；TypeRef/FieldDef 的最终模型按第 4 节，literal/name 转义由 shared owner 提供。credential 等排除集合必须与 Entity 同源，本文不检查任何真实敏感字段值。

### 6.2 emitted Scala 方法模式：真实 JS minus → 目标可读表达 plus

minus 是 [legacy state_api:103–115][legacy-state] 的实际 emitted-body 模式。plus 中 `${e.replyType.signature}`、`${e.getIdCommand.signature}` 等是第 4 节拟议结构模型的渲染槽，不是捏造出的 bank 类型，也不是现有 JS 已有 API。目标 imports 需事先解析 `ActorRef`、`Action`、`AnyContent`、`Future`、Reply/Command/Repository 简名；同名冲突时用确定别名/有限 FQN。这是**结构性对照，非同输入字节比较**，不作为可 apply 的 JS patch。

```diff
--- actual-js-legacy/generated-method-pattern
+++ approved-target/generated-method-pattern
@@
   /** S1 聚合面：${e.routeSegment} 写侧状态强一致查询（Get<X>State → Reply·不产事件） */
-  def ${e.methodName}(id: String): play.api.mvc.Action[play.api.mvc.AnyContent] =
-    api.global.read().apply[${e.replyFqn}] {
+  def ${e.methodName}(id: String): Action[AnyContent] =
+    api.global.read().apply[${e.replyType.signature}] {
       _ => {
         IdGuard.parse("${e.idParam}" -> id) match {
           case Right(Seq(${e.idParam}Cid)) =>
-            ${e.repoName}.entityRef(id).ask {
-              (replyTo: akka.actor.typed.ActorRef[${e.replyFqn}]) => ${e.cmdFqn}(${e.idParam}Cid, replyTo)
-            }.map(reply => Right(reply): Either[ApiError, ${e.replyFqn}])
-          case Left(err) => scala.concurrent.Future.successful(Left(err): Either[ApiError, ${e.replyFqn}])
+            ${e.repository.name}.entityRef(id).ask {
+              (replyTo: ActorRef[${e.replyType.signature}]) =>
+                ${e.getIdCommand.signature}(${e.idParam}Cid, replyTo)
+            }.map(reply => Right(reply): Either[ApiError, ${e.replyType.signature}])
+          case Left(err) =>
+            Future.successful(Left(err): Either[ApiError, ${e.replyType.signature}])
         }
       }
     }
```

保留 raw 的 positional command 参数顺序；不能未经 protocol 决定将 identifier 实参改成 `id = ...`（真实参数未必叫 id）。本例也没有把校验失败改为成功空状态，没有替换 repository 身份字符串。

### 6.3 raw-scala → approved-target 的覆盖清单

| 范围 | 明确批准的目标 / 尚需裁定 |
|---|---|
| 物理位置 | 保留 `app/controllers/AggregateStateApiController.scala`，controllers 是业务根外框架包；业务根只有 domain/application/infrastructure，不加 `<base>.api` 第四层 |
| imports/长行 | 使用 Model 确定的无歧义简名，长 ctor/字段写入/ask lambda 换行；保持声明/初始化顺序。不能把这种格式变化叫 raw 字节一致 |
| 共享 writers | `Writes[Instant]`、`Writes[Id]`、`Json.toJson` 可用 imports 简化；表达式 `Option(i).map(_.toString)` 不变。触发谓词是否升级为 nominal type 判断见 D4 |
| 状态字段 | 仍显式逐字段 Json.obj，不换成宏；字段排序、排除规则、JSON key、嵌套值、空值语义不变。>22 是模板注释解释的设计动机，本轮没做版本能力实测 |
| Reply | 仍以 `.state` 平铺；bank 是否需要这种 envelope/API 见 D2，不能给 existing Reply 偷加成员 |
| auth/错误 | raw 为 global.read、parse failure 返回 Left；bank 端口的角色/资源语义不能被 raw 覆盖，见 D3 |
| 基准技术债 | stateType=None fallback、registry miss→Nil、heuristic、gate 名称不一致、unused routeBase/noteId、FQN debt 全部留账，不借“美化”自由修语义 |

现有银行 [CreditBalanceState:4–8][bank-state] 有 AccountId、Boolean、`Map[String,Money]` 和六个 `Map[TxId,Money]`，共九字段。它的 id 不是本族可直接断言的 UUID Id；Map key 的 JSON codec 也不是一份 s1IdWrites 自动解决。因此本文**不提供伪造的 bank `GetCreditBalanceState(accountIdCid,replyTo)` 成品**，也不把 [银行 accounts/me route][bank-loader] 改为 `/api/state/credit-balance/:id`。这正是 D2/D4 的缺口，不妨碍保存已观察的完整规格。

## 7. 胶水与副作用边界

| 完整符号/来源 | 本族实际要求 | 证据、缺口与保护 |
|---|---|---|
| `net.imadz.common.auth.Endpoint`、`net.imadz.common.auth.ApiError` | `api.global.read().apply[T](ctx => Future[Either[ApiError,T]])(implicit OWrites[T]): Action[AnyContent]`；错误折叠和异步失败处理在外层 | raw imports 固定 common.auth；人工参考 [Endpoint:160–168][curated-endpoint] 签名同形但 package 是 `net.imadz.infrastructure.auth`，[finishImpl:129–134][curated-endpoint] recover 为 500 INTERNAL_ERROR。不能推断实际消费 common.auth JAR 行为相同 |
| `net.imadz.metarch.infrastructure.api.IdGuard` | `parse(pairs: (String,String)*): Either[ApiError,Seq[CommonTypes.Id]]` | 精确 FQN 的冻结 [scaffold-static CommandDsl:36–42][static-dsl] 真实存在；Try(pairs.map(Id.of(raw))).toEither，失败映射 `ApiError(400,"PARAM_INVALID", "invalid id: ...")`。它是静态支撑，不是 formal service 已调用证据；不能说库/实现完全缺失 |
| `net.imadz.common.CommonTypes.Id`、`net.imadz.common.Id.of` | 字段 writer 类型为 Id，parse 表达式用包级 Id.of；不是同一个 Scala 符号 | [curated CommonTypes:1–9][common-types] Id=UUID；须核消费版本的 Id.of 具体解析策略，不能先规范化再改变 actor/PID 寻址 |
| `akka.cluster.sharding.typed.scaladsl.EntityRef[Command]` | repository.entityRef(String) 后可 ask；lambda 的 typed ActorRef[Reply] 构造只读应用命令；controller 提供 5 秒 Timeout | [BC repository builder:entityRef][repo-builder] 是支撑合同；银行实际 local get/Handle 不同。不能用不安全 cast、通用 Execute 或复制新 registry 偷换模型 |
| `akka.actor.typed.ActorRef[Reply]`、`akka.util.Timeout` | replyTo 属应用 actor 命令及 HTTP ask 边界；超时不是业务成功 | raw 模板未发 ActorSystem/Scheduler/AskPattern import，不能给本地 ActorRef.ask 偷添隐式并称相同。所需完整适配见 D2 |
| `play.api.libs.json.{JsValue,Json,OWrites,Writes}` | `Json.toJson[T]` 的每字段 writer/Map key writer；reply writer 用 OWrites[State].writes(r.state) | Json 不进 domain/application；名义类型和持久化 serializer 独立，不扩大 `scalapb.GeneratedMessage` 绑定；无可用 writer 时阻断，不能返回空对象遮蔽字段 |
| `play.api.mvc._`、`javax.inject.Inject/Singleton` | BaseController、ControllerComponents、Action[AnyContent]；DI 传 Endpoint、repos、cc 与 implicit ExecutionContext | 不创建 actor/system、线程池、连接或 repository；本控制器无 close/stopHook，资源由外层装配管理 |
| `java.time.Instant`、`scala.concurrent.ExecutionContext`、`scala.concurrent.duration._`、`scala.concurrent.Future` | null-safe ISO 字符串；Future.map / successful；5.seconds | 不注入时间、不访问数据库、不持久化、不发事件；IdGuard 前后副作用顺序必须保留 |

依赖坐标只记录源码声明：[BC scaffold/build.sbt:10,128–136,187][build] 显示 Akka 2.6.20、`net.imadz %% common-core % 0.2`、`auth-core % 0.2` 和 play-json 2.9.3；[formal generator:45–50][formal-dispatch] 声明 Play 2.8.18 与 Akka 2.6.20 override。formal CLI 另核本地 `saga-core_2.13/0.3.0` SHA，并在 pipeline 存在时核 Monarch 两制品，[generate-cli:114–139][product-cli]。这些不是 common/auth JAR 已有需要 API 的证据；不发布/下载/重建 runtime 来“补绿”。

**与相邻写命令族的强制边界**：本项只读 query 不要求写命令 Helper。若依赖迁移涉及写命令，`CommandHelper` 必须位于 `application.aggregates.behaviors`，具备 `toParam/createFailureReply/createSuccessReply`，并走真实 `runReplyingPolicy` 合同；失败不 persist，成功 persist/apply 后 `thenReply` 读更新状态。`replyWith` 不等于 `replyWithAndPublish`。本控制器不得借移植新增发布或假 success，不把 ActorRef 放入纯 domain params/events。现有 [银行 behavior:40–44][bank-behavior] 的 persist/thenRun Accepted(events) 也不因此被本文认证为该 Helper 合同。

## 8. 后续实施写集合、owner 与退役

以下是**待批准实施计划**，本阶段没有写这些路径。路径相对 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc`。

| Owner / proposed 写路径 | 操作与责任 |
|---|---|
| 本族内容 owner：`generators/scala-cqrs-play-service/models/aggregate-state-controller.mjs`（proposed） | 建结构数据合同，M1–M4/E1–E9，不带整文件 content，不复制 shared TypeRef 系统 |
| 本族内容 owner：`generators/scala-cqrs-play-service/build-aggregate-state-controller.mjs`（proposed） | 显式接收已裁定的 eligible roster、类型/布局/排除集；产生模型、diagnostics 和 route contribution；B1–B9 来源可追踪；缺协议不补 stub |
| 本族唯一 controller assembly owner：`generators/scala-cqrs-play-service/templates/aggregate-state-controller.mjs`（proposed） | 独占完整控制器 package/import/class/所有 writer/所有 endpoint 的组装；按 T0–T13，不能每个聚合各写同一路径 |
| 集成 owner：`generators/scala-cqrs-play-service/generate.mjs`、`generator.json` | 在正式服务 profile 的显式契约通过后接入一次；登记闭包与输出 kinds，不私加当前不接受的 options key。新输入能力版本由 D1 决定 |
| 集成 owner：`generators/scala-cqrs-play-service/render-service.mjs`、`render-service-pages.mjs` | 只处理新 controller 与 HTTP root 装配的引用/冲突；拆分 service、framework loader、领域 DTO 职责由 HTTP/application-service 组共同审定，不由本族整体删除现有路由 |
| HTTP/routes 唯一 assembly owner | 消费每 endpoint 的 `(method=GET, path=routeBase+routeSegment+/:id, actionFqn, id:String)`；`conf/routes`/runtime router 二者的 profile 选择和组合唯一归集成 owner，不让本族再生成第二份完整 routes |
| legacy owner：`generators/_deprecated/scala-cqrs-es-api/templates/state_api.mjs`、`generate.mjs` | 精确标记可抽取内容、旧入口消费范围；未经消费者授权不删除/重启 legacy。正式链不应 import 整个 legacy producer 以顺带再生成其他 controller/routes |
| shared 集成 owner：`lib/scala-target/naming.mjs`、`model.mjs`、`profiles.mjs`、`lib/products/generate-cli.mjs`、`src/core/generate.mjs` | 名称/TypeRef/import/layout/writer/注册公共面，非本族并发独占写范围；具体补丁必须另行锁定 |

复用候选的实际 API 是 [naming.mjs:77–118][js-naming] 的 `resolveName`、`resolveNameSet`、`resolveArtifactPath`；前者区分 stable identities 与 Scala 标识符，后两者拒绝冲突、基于 profile sourceRoot 决定物理路径。要核其与 BC 的 camel/kebab/keyword 差异，不能直接把所有旧 URL 串喂给命名 resolver 改写。TypeRef/signature/import 的共享实现合同尚未由本文批准；不新增第二套字符串 regex 解析器。

依赖工作包：`shared-layout-types`、`shared-writer-anchors`、`application-protocol`、`domain-entity`、`aggregate-repository-port`、`aggregate-repository-implementation`、`command-endpoint-dsl`、`http-controller`、`route-definition`、`application-bootstrap`。bootstrap/DI 路径限定 `infrastructure.bootstrap`；repository interface 限定 `application.aggregates.repository`。本族不决定 PB/PID/serializer/nominal/overflow 变化。

旧产物策略：银行当前没有本族完整 controller 供直接 replace；只能在明确授权启用状态 API 后 ADD。不能删除 accounts/me/order/sip 等业务查询冒充迁移。若将来替换 legacy controller，先对同一路径已有 ownership、手写块、消费者 imports、路线冲突作计划；KEEP/手写拒写原样报告。不留错误 domain 包永久转发壳来假装应用协议已迁完。

来源/回锚：raw endpoint.noteId 尚未提升为文件 noteIds，而 legacy 已在外层收 stateNoteIds；目标须从真实来源对象导出映射，合成 GetState 本身不得造知识号。最终排版之后再生成 fingerprint、manifest、ledger 与 anchors。registry、catalog、回锚/ledger 的实际迁移由唯一集成 owner 的 pipeline 完成，不由本阶段手改，也不新增 `@knowledge` 作者字段。

## 9. 具体未决项

| ID | 必须裁定的内容/API | 未裁定时的行为 |
|---|---|---|
| D1 | formal 产品中哪一项显式声明“开放聚合写侧状态 HTTP API”、eligible roster/route/auth/排除集？同时确定 BC gate 原名与 Builder 去 Aggregate 后缀的冲突如何纳入对照，是否强制验证 isReadOnly/reply.state/repository 能力 | `missing-counterpart` 于 formal；不因 aggregate 存在就默认暴露全状态，不给现有 service.options 塞未接受字段 |
| D2 | `entityRef(String): EntityRef[Command]` 与 bank `get(K): Handle` 如何适配？状态命令是 BC `(Id,ActorRef[ReplyWithState])` 还是现有 `(ActorRef[State])`？identifier 是 UUID 还是 AccountId/PlanId 等名义值？ | 保留两边接口，不能 cast/加假 Reply；需要协议/repository owners 联合签定；不得改变 PID 或 raw-string addressing |
| D3 | 状态 API 是否仅供管理诊断、是否需要资源隔离？raw `global.read()` 与 bank audience/customer/operator 及资源鉴权不能默认等价；`Endpoint/ApiError` 的消费包与实际冻结 artifact API/异常码由谁供给？ | 不把人工 Endpoint 的包替换称为已可链接，不新增 public global 读面；未核部署不宣称 400/500/503 行为通过 |
| D4 | 泛型/nominal/Map-key JSON writers 的供给；Instant/Id 的字符串 contains heuristic 是否改为类型匹配；stateType=None、registry miss→Nil 是否应拒绝；是否允许空实体真的输出 `{}`；writer/member/literal 碰撞如何报告？ | 不丢字段、不用通用 String/Any、不造成功空状态；raw fallback 保留在基准，但目标缺失语义必须诊断 |
| D5 | 路由由 E301 marker 还是正式 runtime router 承载？新 `controllers.AggregateStateApiController` 谁注入、谁组合 router？保留现有 pages/CSRF/安全 headers 的责任边界是什么？ | controller 内容可单独审定，不能称 HTTP 已可达；不写第二份 conf/routes，也不覆盖其他 owners 的 loader |
| D6 | raw unused endpoint.noteId 如何合法进入目标 file/member mappings；目标导入冲突/格式与源码名策略、同输入 fixture 适配和真实 common/auth jar pins 何时冻结？ | 锚/字节/运行证据均未验；不能用文档存在、旧模型计数或旧 golden normalize 作 PASS |

D1–D6 不授权改变已有银行 API，也不阻断本份观察规格保存。无本族 MANUAL body 可补；上游 `resolveMetaRef=???` 等真实业务/技术槽仍须诚实处理。

## 10. 验收 fixture 与精确 CLI 形状（本阶段全部未运行）

### 10.1 fixture 与文件集合

未来拟放在本族测试资产目录，**本轮未创建**；不进入作者真源、不是第二套银行业务事实。

1. 仅一聚合、显式 repository/Get<X>State/reply.state/stateRef 的非银行最小输入；输入名字不带 Aggregate 后缀，先建立正例；输出只对账本 controller 及其真实依赖闭包，不用 bank 默认输入。
2. gate 阴性分别为无 repository、无匹配命令、空聚合集；加一个带 Aggregate 后缀的冲突例，只揭示 raw 行为，不提前选择“正确”分支。
3. 字段矩阵：无 Instant/Id、仅 Instant、仅 Id、二者都有；null/非 null；>22 字段；关键字字段；嵌套 Option/List/Map；含 nominal Map key；两种同名不同包类型；stateType=None、entityRef 查无、空字段；nature 排除集空/credential/其他值；保留字段顺序。
4. HTTP 行为闭包：鉴权拒绝不得 ask；非法 id 不 ask；合法 id 正确传 raw String repo key 与 typed 解析值；一次 ask 一次 reply；超时/失败的真实 Endpoint 错误；JSON 平铺、null、缺 writer 拒绝；只读不 persist、不 publish。
5. 如依赖实施同时碰写命令，另复用 protocol/helper 行为 fixture：失败不 persist、成功 apply 后 thenReply 读新 state，replyWith 不发布；不因只测本族就认证相邻写行为。

同输入文件集合对账包括完整 controller、route contribution 及接口依赖清单；比较路径、package、imports、全部 T0–T13 顺序/RHS、字段顺序和 JSON 值。生成版本头只有精确白名单允许差异；不使用压平全部空白的 normalize。两次相同输入最终字节稳定，然后改一字段验证局部 diff/回锚；普通方法 CC 目标≤5、6–10逐方法说明、>10先重构或批准例外，拒绝 String/Any dispatcher 刷分。

### 10.2 命令形状与未具备前置

以下 `/tmp/codegen-parity-aggregate-state-controller/inputs/*` 是**拟议隔离 fixture 文件名**，当前不存在可宣称已准备的输入或成功输出。实施阶段先在授权窗口固定输入、offline 依赖与新 target 所有权；本轮不能执行。没有 artifact-only CLI flag，因此“限定本项”靠小 fixture 的输入/依赖闭包，不虚构 `--artifact`。

**BC 传统 raw 路线**，工作目录必须是 `/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen`（届时先读该仓 AGENTS/CLAUDE），用真实 JVM properties，不伪装成 `--system` flags。

```bash
sbt \
  -Dcodegen.systemFile=/tmp/codegen-parity-aggregate-state-controller/inputs/bc-canonical.json \
  -Dcodegen.systemBindings=/tmp/codegen-parity-aggregate-state-controller/inputs/bc-bindings.json \
  -Dcodegen.targetDir=/tmp/codegen-parity-aggregate-state-controller/raw-scala \
  -Dcodegen.ledger=/tmp/codegen-parity-aggregate-state-controller/raw-scala-ledger.json \
  -Dcodegen.multiProject=false \
  "runMain net.imadz.codegen.CodegenMain"
```

`systemFile/systemBindings` 的互斥/必填见 [CodegenMain:62–81][main]，不能同时传 codegen.system；不得默认落 banking-app。此命令会启动 sbt/JVM，可能解析/下载依赖、写仓内 target/project target 及构建缓存，复制 scaffold，运行 harness，生成整个小输入闭包、配置/proto/ledger 等；不是只写 controller，也没有承诺无 Git 读取或旁路缓存。只能由集成者批末集中执行，禁止当前运行、publishLocal 或重建 runtime。

**JS formal public CLI**，待 D1–D6 及正式接线完成后才能让该命令包含本族；当前运行该命令不会因本文存在而新增本族。

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /tmp/codegen-parity-aggregate-state-controller/inputs/js-request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-play-service \
  --out /tmp/codegen-parity-aggregate-state-controller/actual-js-new \
  --options-json /tmp/codegen-parity-aggregate-state-controller/inputs/js-options.json \
  --plan
```

[generate-cli:66–88][product-cli] 要求四个显式 flag；plan 仍读取/编译产品、读取 generator manifest 和 frozen runtime jar SHA、核 externalSourceRoots 并调用 renderer，只是不 apply。真实落盘阶段使用同一形状去掉 `--plan`，不能添加不存在的 `--dry-run`。apply 由 [core:246–270][apply-writer] 写目标文件、`truthsrc.ledger.json`、`anchors.json`；不是只写 `app/controllers`。`generate-products` 这条直接链不创建 project graph，也不代表没有全闭包输出。当前未用任何这些命令作测试。

**legacy 对照入口形状**，仅在明确批准保留/比较该兼容输入时使用；不是 formal 接通证明。

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate \
  --in /tmp/codegen-parity-aggregate-state-controller/inputs/legacy-canonical.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/_deprecated/scala-cqrs-es-api \
  --out /tmp/codegen-parity-aggregate-state-controller/legacy-js-new \
  --plan
```

它会计划整个 API face、两次调用 generator 比较 entries，非本族专用；apply 时其他 controllers/global support、E301 marker、ledger/anchors 同在写面。不能在共享 app 上尝试。

family 不接受 generate-products 直接调用：[generate-cli:45–51,79–80][product-cli] 要求 generate-project 捕获外置实现，即使 `--plan` 也如此。实际公开形状是

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-project \
  --project /tmp/codegen-parity-aggregate-state-controller/inputs/family-project.json \
  --out /tmp/codegen-parity-aggregate-state-controller/family-js-new \
  --plan
```

该文件名只为说明形状，并不表示 family 已声明本族。项目链 [project/cli:159–220][project-cli] 在 plan 前也可校验 captured implementations；非 plan 还打开项目 SQLite graph、apply 并发布 anchors，且带项目派生输入/源码证据。其实现校验可能有自己的子进程/缓存写面，须另行固定批准，不能因 `--plan` 宣称零执行。因此这不是本族当前推荐补洞手段。

当前验收状态分别为：同输入完整字节 `not-run`；协议/JSON/HTTP/失败副作用 `not-run`；imports/layout/naming 自动门 `not-run`；CC `not-measured`；稳定生成/回锚 `not-run`。没有 production 修改，也没有 ready、parity-PASS 或 behavior-PASS 结论。

[model]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/infrastructure/api/AggregateStateControllerModel.scala#L1-L40
[builder]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/api/AggregateStateControllerBuilder.scala#L1-L72
[template]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/AggregateStateControllerTemplate.scala#L1-L111
[dispatch]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L1004-L1027
[writer]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L331-L425
[run-common]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L170-L220
[main]: ../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L12-L201
[artifact-model]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L5-L47
[type-system]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4-L85
[type-resolver]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala#L19-L148
[state-resolver]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L138-L150
[repo-resolver]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L461-L470
[command-resolver]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L554-L580
[naming]: ../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L166-L224
[repo-builder]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateRepositoryBuilder.scala#L1-L155
[build]: ../baseline/bc/scaffold/build.sbt#L128-L187
[legacy-state]: ../baseline/js/generators/_deprecated/scala-cqrs-es-api/templates/state_api.mjs#L1-L139
[legacy-dispatch]: ../baseline/js/generators/_deprecated/scala-cqrs-es-api/generate.mjs#L230-L266
[legacy-manifest]: ../baseline/js/generators/_deprecated/scala-cqrs-es-api/generator.json#L1-L24
[legacy-core]: ../baseline/js/src/core/generate.mjs#L20-L42
[legacy-types]: ../baseline/js/generators/_deprecated/scala-cqrs-es/builders/types.mjs#L34-L92
[legacy-deps]: ../baseline/js/generators/_deprecated/scala-cqrs-es-projection/builders/views.mjs#L11-L29
[formal-dispatch]: ../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L1-L71
[formal-service]: ../baseline/js/generators/scala-cqrs-play-service/render-service.mjs#L1-L205
[formal-pages]: ../baseline/js/generators/scala-cqrs-play-service/render-service-pages.mjs#L20-L133
[product-cli]: ../baseline/js/lib/products/generate-cli.mjs#L45-L145
[family-generate]: ../baseline/js/generators/scala-cqrs-play-application-v1/generate.mjs#L1-L42
[family-render]: ../baseline/js/generators/scala-cqrs-play-application-v1/render.mjs#L1-L47
[family-http]: ../baseline/js/generators/scala-cqrs-play-application-v1/templates/http.mjs#L21-L110
[bank-loader]: ../baseline/actual-js/app/example/bankwealth/service/BankServiceLoader.scala#L1-L129
[bank-service]: ../baseline/actual-js/app/example/bankwealth/service/BankServiceService.scala#L1-L99
[bank-repo]: ../baseline/actual-js/app/example/bankwealth/application/aggregates/CreditBalanceRepository.scala#L1-L30
[bank-aggregate]: ../baseline/actual-js/app/example/bankwealth/domain/CreditBalanceAggregate.scala#L1-L19
[bank-protocol]: ../baseline/actual-js/app/example/bankwealth/application/aggregates/CreditBalanceProtocol.scala#L1-L29
[bank-state]: ../baseline/actual-js/app/example/bankwealth/domain/CreditBalanceState.scala#L1-L8
[bank-behavior]: ../baseline/actual-js/app/example/bankwealth/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L1-L47
[curated-endpoint]: ../baseline/curated-scala/net/imadz/infrastructure/auth/Endpoint.scala#L1-L178
[curated-dsl]: ../baseline/curated-scala/net/imadz/infrastructure/api/CommandDsl.scala#L1-L49
[static-dsl]: ../baseline/js/generators/scaffold-static/app/net/imadz/metarch/infrastructure/api/CommandDsl.scala#L3-L42
[common-types]: ../baseline/curated-scala/net/imadz/common/CommonTypes.scala#L1-L9
[js-naming]: ../baseline/js/lib/scala-target/naming.mjs#L26-L118
[apply-writer]: ../baseline/js/src/core/generate.mjs#L246-L270
[project-cli]: ../baseline/js/lib/project/cli.mjs#L159-L220
