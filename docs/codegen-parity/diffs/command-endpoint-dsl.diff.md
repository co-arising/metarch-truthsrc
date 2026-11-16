# command-endpoint-dsl：HTTP 信封与边界解析支撑件内容规格

## 1. 身份、交付状态与证据边界

- artifact id / group：`command-endpoint-dsl`；传统清单序号 **36**。它是一个文件中的 `OkReceipt`、`ViewListDto`、`ViewItem`、`IdGuard`、`InstantGuard`，**不是** Actor `CommandHelpers`，也不是 `Endpoint` 授权 DSL 本身。
- 状态：**`decision-required`**。Scala 内容已逐项登记；formal 银行链路缺少这个五件套的对应发射，legacy 有近似完整实现，family 有不同的 HTTP DTO 合同。接线与 wire 语义须裁定，不能标为已实施或验收通过。
- 固定 HEAD：BC `cc335eb1e0d0fae17bf092fd61b126040196ea70`；JS `bf104e16ab82ef39d7fa416d0997907d18a815ad`。实际源字节以 [baseline/index.json](../baseline/index.json) 的 `source/snapshot/bytes/sha256` 为准，HEAD 不代替工作副本身份。
- 本文遵循 [AUTHORING-CONTRACT](../AUTHORING-CONTRACT.md)、[布局标准](../layout-and-style.md) 和 [批准计划](../../../.rounds/prettify-generated-code-resume-20261115-cgr9lzlk/APPROVED-PLAN.md)。仅检查源内容；没有执行生成、测试、类型检查、编译、运行、服务、下载或 Git 写操作；没有修改真源树，因此没有运行 validate/roundtrip。
- **不存在新鲜的双端同输入输出**。下文的比较是结构性对照，不是同输入字节对账。`raw-scala` 是固定模板中的字符串，不冒称本轮实际生成文件；`curated-scala` 是独立人工参考；`approved-target` 是依照已批准格式标准展开的目标内容规格；`actual-js` 是固定银行现存输出。
- 本次只新建本 diff 与 `details/command-endpoint-dsl.json`；创建前两文件均不存在。不改既有十五份 diff、其他分组、基线、catalog、ledger、anchors 或任何生成应用。

### 1.1 固定完整来源与指纹

以下链接均可取回完整源文件；后文的源码展开和逐构造账不能用链接本身代替。其他固定支撑文件的 bytes/SHA 见 index 的同路径项。

|来源|完整固定文件 / 精确锚点|bytes|SHA-256|
|---|---|---:|---|
|Scala Model|[CommandDslModel.scala L1–13](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/infrastructure/api/CommandDslModel.scala#L1-L13)|870|`0bb312d15a29c0ff110c48315477446e04909f7787f29a27113e1172b41fe075`|
|Scala Builder|[CommandDslBuilder.scala L1–32](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/api/CommandDslBuilder.scala#L1-L32)|1744|`4d27833e110839a15ac6e67b3e0dcda4280d3188fa5b9f3bbbcafc7a6b8a8589`|
|Scala Template|[CommandDslTemplate.scala L1–65](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/CommandDslTemplate.scala#L1-L65)|3864|`49d83f977b5a7f707d47ecc4636bf8234f90924ea78f8041db83f3038aeedfa3`|
|人工参考|[CommandDsl.scala L1–49](../baseline/curated-scala/net/imadz/infrastructure/api/CommandDsl.scala#L1-L49)|3008|`c460aae58612dbe4da5b4ab801b03af7d85b8e65802a24ac51bc55b4e7c5b2e2`|
|legacy 动态 renderer|[scala.mjs L77–128](../baseline/js/generators/_deprecated/scala-cqrs-es-api/templates/scala.mjs#L77-L128)|6852|`a364caf0c918caddcc9524e29155783ce29582b21ce3cfff5b10ee5f6976aefe`|
|legacy 静态副本|[scaffold-static CommandDsl.scala L1–49](../baseline/js/generators/scaffold-static/app/net/imadz/metarch/infrastructure/api/CommandDsl.scala#L1-L49)|2819|`97030c32d861fff6e5f555b8ad8f5b975a53c0ec89592aca49bbc3c6429344fe`|
|formal renderer|[render-service.mjs L1–205](../baseline/js/generators/scala-cqrs-play-service/render-service.mjs#L1-L205)|12954|`c8d92119b3e98dc868ea7bc17b018fef4372f24621206d2d00d1af365de160de`|
|银行现存合同|[BankServiceService.scala L1–99](../baseline/actual-js/app/example/bankwealth/service/BankServiceService.scala#L1-L99)|11451|`a7e1c39c8211cc197b11d23b7b7d0faecbcb9a4b409d6bd30283b1a64c30e297`|
|银行现存 HTTP 宿主|[BankServiceLoader.scala L1–129](../baseline/actual-js/app/example/bankwealth/service/BankServiceLoader.scala#L1-L129)|10379|`12428f65ad1190f911102bd8bdf448aa6fd4c3017a9eeea301cab658a8eac3a0`|
|family Builder|[build-models.mjs L1–116](../baseline/js/generators/scala-cqrs-play-application-v1/build-models.mjs#L1-L116)|9771|`3588e1ac7cfb6ea5c9f0a180acd4446c9196556bd42a4c87b41e78454b6091e5`|
|family API Template|[templates/api.mjs L1–56](../baseline/js/generators/scala-cqrs-play-application-v1/templates/api.mjs#L1-L56)|2503|`630669e0bcae3fd4f43481094da95efea6386c15f6dfa874fc8d9b9865005529`|

MBT 三文件、legacy 两份正文、银行两文件的读取字节已与 index 对应 SHA/bytes 核对；这只是资料身份核对，不是代码验证。

唯一额外读取的现行生产源码不在 baseline 中，未复制、未修改：

- `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/lib/execution/generate-cli.mjs`，2407 bytes，SHA-256 `b9f33e711730f1f6fcac9311e20ec3333531353ca65e588c4058bd106012fe66`；[可变工作副本 L5–44](../../../lib/execution/generate-cli.mjs#L5-L44)。用途仅为核实 legacy CLI 接受任意显式 generator 路径及参数检查；不能把此链接当作固定副本。本次写入前再次核对 SHA 未变。

## 2. Scala 调度、基数和精确路径

生产链为 [CodegenMain.prepare/run L58–81、183–242](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L58-L81) 选择传统 `SystemMetadata`，再经 [runCommon L192–215](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L192-L215) 的 domain → application → infrastructure → interface。`semanticProductsFile` 分支在 CodegenMain L183–188 提前返回，不是本项传统基准。

[generateInterfaceLayer L1029–1063](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L1029-L1063) 的顺序严格为：先逐 Controller build/write，再调用 `CommandDslBuilder.build(interfaces).foreach`，最后 RoutesBuilder。若前面的 Controller 构建抛错，并不能保证随后支撑件已生成。

|变体|判定和基数|完整输出路径（相对目标工程根）|本轮证据状态|
|---|---|---|---|
|`gate-declared-single`|任一 `interfaces.controllers` 的任一 endpoint 满足 `gate.isDefined`；整个 InterfaceLayer **一份**，不是每端点/每聚合一份|`app/net/imadz/infrastructure/api/CommandDsl.scala`|条件源码已观察；未执行|
|`gate-declared-multi-root`|同一判定；`targetModuleOf("command-dsl") == Some("root")`；一份|`app/net/imadz/infrastructure/api/CommandDsl.scala`，**不是** `modules/kernel/src/main/scala/...`|条件源码已观察；未执行|
|`gate-none`|无 controllers、无 endpoints 或全部 `gate=None`；零份|无新增文件；不等于自动删除旧文件|suppressed 条件已观察；未执行|

只要有 gate 声明，静态正文的五个成员族一起发射；不按读/写、UUID/Instant 是否实际用到再裁五件套。只读 gated endpoint 也能触发整个文件；不是“只有写命令才需要”。gate 的有效性、controller 的 skip 和实际端点发射不是该 Builder 的条件。

[writer L331–424](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L331-L424) 使用 `model.selfType.packageName.replace('.', '/')` 与 `selfType.name + ".scala"`。单工程的 `outputRoot` 已是 target/app；多工程 outputRoot 是 target，root 面追加 app。该 kind 的 attribution 精确为 `ArtifactAttribution("command-dsl", "CommandDsl", "global", Nil)`。依赖名经 `currentSymbolTable.resolve(NestedTypeName(...))`、回退原名、排序后入账；默认落 `ApiError`。Model 的 `morphisms` 和 `noteIds` 都是 Nil，未生成字段级知识来源。

原 writer 先记 ledger/morphisms，再判断 scope，再加 fingerprintHeader，再按 territory 写入。多工程 root 的物理相对路径已经以 `app/` 开头，而 L393 仍为非 strict kind 加 `app/` 前缀，存在 `app/app/...` 台账表达风险；本项如实记录，不把它复制为 JS 目标，也不在此修共享 writer。`writeTerritorial` L461–501 的 ADD/COVER、MANUAL MERGE、纯手写 KEEP 与显式 migrate 分支是独立保护面；本模板本身没有 MANUAL 区。

## 3. Model / Builder / Template 全内容责任账

### 3.1 Model：全部声明和继承默认

以下为 Model 的全部非注释源码；注释和原始空白仍由上面的完整固定文件保留。

```scala
package net.imadz.codegen.scaffolding.cqrs.model.infrastructure.api

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, TypeRef}

case class CommandDslModel(
                            override val selfType: TypeRef,
                            override val dependencies: Set[TypeRef]
                          ) extends ArtifactModel
```

|顺序/字段或依赖|类型、默认值、来源和实际作用|JS 对应/目标|
|---|---|---|
|M1 `selfType`|必填 `TypeRef`；无构造器默认；Builder 给 `TypeRef("CommandDsl", "net.imadz.infrastructure.api")`；用于文件身份和路径，不是生成一个名叫 CommandDsl 的 object|legacy 直接拼 entry.path，正文另硬编码 package；formal 无此模型。拟建显式 selfType，不用整个 content 字符串替代|
|M2 `dependencies`|必填 `Set[TypeRef]`；无构造器默认；仅 `TypeRef("ApiError", "net.imadz.common.auth")`|legacy 此 entry 为 `deps: []`；没有同等结构依赖；目标分别记录 raw dependencies 与实际渲染所需外部类型|
|M3 inherited `fqn`|[ArtifactModel L5–21](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L5-L21)：`selfType.packageName + "." + selfType.name`；registerTo 调 `registry.register(this)`，默认不注册子制品|不能因为 selfType 叫 CommandDsl 就给正文包上一层 object|
|M4 inherited `morphisms`|[ArtifactModel L23–33](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L23-L33)：`Seq[MappingMorphism] = Nil`，本 Model 未覆盖|不可发明 command 来源映射|
|M5 inherited `noteIds`|[ArtifactModel L35–47](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L35-L47)：`Seq[String] = Nil`，本 Model 未覆盖|全局支撑件不是任意银行 command 的知识载体|
|M6 TypeRef 子结构|[TypeSystem L4–51](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4-L51)：`name: String`、`packageName: String`、`typeParams: Seq[TypeRef] = Nil`；fqn 处理空包；signature 支持 TupleN 与递归泛型；collectAllDependencies 包括自身及泛型；shouldImport 排除空包、当前包、scala、java.lang|本项两个 TypeRef 均无泛型，Builder 不调用递归收集或 import resolver；不能写成“它已自动收集了 Play/Java 依赖”|

Model 没有 endpoint 列表、业务字段列表、clock、错误文本槽、writes 配置、代码体字段或额外子型；不能为了声称结构化，悄悄改变 Scala 的输入合同。

### 3.2 Builder：全部非注释源码和规则

```scala
package net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.api

import net.imadz.codegen.scaffolding.cqrs.TypeRef
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.api.CommandDslModel
import net.imadz.meta.InterfaceLayer

object CommandDslBuilder {
  val CommandDslPackage: String = "net.imadz.infrastructure.api"

  def build(interfaces: InterfaceLayer): Option[CommandDslModel] =
    if (hasGateDeclaration(interfaces))
      Some(
        CommandDslModel(
          selfType = TypeRef("CommandDsl", CommandDslPackage),
          dependencies = Set(TypeRef("ApiError", "net.imadz.common.auth"))
        )
      )
    else None

  private def hasGateDeclaration(interfaces: InterfaceLayer): Boolean =
    interfaces.controllers.exists(_.endpoints.exists(_.gate.isDefined))
}
```

|规则|输入/分支/顺序/结果|必须保留的区别|
|---|---|---|
|B1 输入|[InterfaceLayer L950–953](../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L950-L953)：`valueObjects: Seq[ValueObjectMetadata] = Nil`、必填 `controllers: Seq[ControllerMetadata]`|valueObjects 不参与条件，不能凭存在接口 VO 触发|
|B2 端点声明|[ControllerMetadata / EndpointMetadata L819–840](../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L819-L840)：controller.endpoints；endpoint.gate 为 `Option[GateRef] = None`|`method/path/actionName/parameters/requestBody/responseType/logic/serves/errorPayloads` 均不由本 Builder 解读|
|B3 常量|公开 `val CommandDslPackage: String`，固定 RHS `"net.imadz.infrastructure.api"`|显式例外：不用 PackageLayout，也不从业务包派生|
|B4 条件|外层 exists、内层 exists、`gate.isDefined`，按集合原顺序短路；空集合 false|不解析 gate 引用，不按 skip 过滤，不要求至少一个命令或 Saga|
|B5 true|先构造指定 selfType/dependencies，再 Some(model)|最多一个 Model，不为每个 matching gate 重复发射|
|B6 false|None|无新 entry；不做旧文件删除|
|B7 依赖与异常|无 ctx、无 TypeResolver、无 naming DSL、无 I/O、无 catch/额外校验；固定 ApiError 一项|上游无效 metadata 的异常不可被包装为成功；不得补默认 gate|

### 3.3 Template 本体和全部 emitted constructs

[Template L10–15](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/CommandDslTemplate.scala#L10-L15) 的本体只有 `object CommandDslTemplate`、`def generate(model: CommandDslModel): String = content` 与 `private val content: String = """..."""`。**generate 不读取 model**，没有循环、元数据分支、import 排序器、类型简化器或 Scala 代码 AST。它是有意保留的整段静态源码字符串例外；这不是 Model 存整个 content，也不证明传统链完全没有字符串技术债。

下面是 raw-scala 字符串的**全部非注释构造与方法体**；完整源码（含 provenance、Scaladoc、注释标记、空行和末尾换行）见固定 Template L15–64，未另造 raw 生成文件。

```scala
package net.imadz.infrastructure.api

import net.imadz.common.auth.ApiError

final case class OkReceipt(aggregateId: String, decisionView: play.api.libs.json.JsValue)
object OkReceipt {
  implicit val writes: play.api.libs.json.OWrites[OkReceipt] = (r: OkReceipt) => play.api.libs.json.Json.obj(
    "status" -> "ok",
    "aggregateId" -> r.aggregateId,
    "events" -> play.api.libs.json.Json.arr(),
    "occurredAt" -> new java.time.format.DateTimeFormatterBuilder().appendInstant(3).toFormatter.format(java.time.Instant.now()),
    "decisionView" -> r.decisionView)
}

final case class ViewListDto[V](view: String, total: Int, page: Int, pageSize: Int, items: Seq[V])
object ViewListDto {
  implicit def writes[V](implicit w: play.api.libs.json.Writes[V]): play.api.libs.json.OWrites[ViewListDto[V]] =
    (dto: ViewListDto[V]) => play.api.libs.json.Json.obj(
      "view" -> dto.view, "total" -> dto.total, "page" -> dto.page, "pageSize" -> dto.pageSize,
      "items" -> play.api.libs.json.Json.toJson(dto.items))
}

final case class ViewItem[V](item: V)
object ViewItem {
  implicit def writes[V](implicit w: play.api.libs.json.Writes[V]): play.api.libs.json.OWrites[ViewItem[V]] =
    (vi: ViewItem[V]) => play.api.libs.json.Json.obj("item" -> play.api.libs.json.Json.toJson(vi.item))
}

object IdGuard {
  def parse(pairs: (String, String)*): Either[ApiError, Seq[net.imadz.common.CommonTypes.Id]] =
    scala.util.Try(pairs.map { case (_, raw) => net.imadz.common.Id.of(raw) }).toEither
      .left.map(t => ApiError(400, "PARAM_INVALID", s"invalid id: ${Option(t.getMessage).getOrElse(t.getClass.getName)}"))
}

object InstantGuard {
  def parse(pairs: (String, String)*): Either[ApiError, Seq[java.time.Instant]] =
    scala.util.Try(pairs.map { case (_, raw) => java.time.Instant.parse(raw) }).toEither
      .left.map(t => ApiError(400, "PARAM_INVALID", s"must be ISO-8601 instant: ${Option(t.getMessage).getOrElse(t.getClass.getName)}"))
}
```

逐项账的 T 行号均指完整固定 Template，而不是上述去注释展示；对应人工参考的正文行号等于 T 行号减 14。

|稳定 construct id / 源锚点|完整 raw 内容及 RHS/调用规则|approved-target / JS 处理|
|---|---|---|
|C00 头、包、import，[T15–24](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/CommandDslTemplate.scala#L15-L24)|两行来源/包适配注释；固定 package；唯一显式 import `net.imadz.common.auth.ApiError`；Scaladoc 三项描述成功信封、读信封和边界翻译。`@generated` 指纹由外部 writer 前置，不在 content 内|保持 provenance 与生成版本头分离；正常 imports 是明确格式覆盖，不声称 raw 已具备。静态副本另带 `@knowledge-release 1.0.0`，不可挪为所有目标的默认业务版本|
|C01 OkReceipt 构造，[T26](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/CommandDslTemplate.scala#L26)|顶层 `final case class`；字段顺序 `aggregateId: String`、`decisionView: JsValue`；均无默认；无显式父类|保留 nominal class、字段名/顺序/类型；不是领域确认协议，不补 ActorRef|
|C02 OkReceipt companion，[T27–34](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/CommandDslTemplate.scala#L27-L34)|顶层同名 object；`implicit val writes: OWrites[OkReceipt]` 初始化为 typed lambda `r`；Json.obj 参数依次 status→aggregateId→events→occurredAt→decisionView。`status="ok"`；events 每次 `Json.arr()`；时间每次写 JSON 时创建 DateTimeFormatterBuilder、appendInstant(3)、toFormatter、format(Instant.now())；不在 object 初始化时固定时间|全链和顺序保持；无 clock 注入、无事件数组业务填充。不得把空 events 当成业务已完成证明，也不能把此处 now 偷改为领域 event timestamp|
|C03 ViewListDto 构造，[T36](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/CommandDslTemplate.scala#L36)|顶层 `final case class ViewListDto[V]`，V 无型变/上下界；字段依次 `view: String,total: Int,page: Int,pageSize: Int,items: Seq[V]`，无默认|保留 Int 和 Seq，不改 Long/Vector/cursor DTO；没有分页范围校验，不加 require|
|C04 ViewListDto.writes，[T37–42](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/CommandDslTemplate.scala#L37-L42)|`implicit def writes[V](implicit w: Writes[V]): OWrites[ViewListDto[V]]`；lambda dto；Json.obj 键依次 view,total,page,pageSize,items；最后 `Json.toJson(dto.items)` 使用隐式元素 Writes。不是 val，也不是 JSON Reads|保留方法级 V、独立 implicit 参数列表、返回 OWrites 及每次调用构造 lambda 的位置|
|C05 ViewItem 构造，[T44](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/CommandDslTemplate.scala#L44)|顶层 `final case class ViewItem[V](item: V)`；无型变/界限/默认|不能与 ViewListDto 或其他银行响应 alias 合并|
|C06 ViewItem.writes，[T45–48](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/CommandDslTemplate.scala#L45-L48)|`implicit def writes[V](implicit w: Writes[V]): OWrites[ViewItem[V]]`；typed lambda vi；`Json.obj("item" -> Json.toJson(vi.item))`|仅单键 wrapper，不能直接返回 item JSON 丢掉外层|
|C07 IdGuard 与注释，[T50–55](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/CommandDslTemplate.scala#L50-L55)|顶层 object；注释明确类型位 `CommonTypes.Id`、表达式位 `Id.of`。`parse(pairs: (String,String)*)` 返回 `Either[ApiError,Seq[CommonTypes.Id]]`；Try 包住整个 pairs.map，忽略 tuple 第一项，只对 raw 调 `net.imadz.common.Id.of(raw)`；toEither 后只映射 Left；`ApiError(400,"PARAM_INVALID",s"invalid id: ${Option(t.getMessage).getOrElse(t.getClass.getName)}")`|名字虽叫 IdGuard，但未检查 pairs 名、未 trim、未去重、无 size bound；遇非致命解析异常停止并返回单个错误，不返回成功前缀。空 pairs 得 Right(empty Seq)。不能改 String/Boolean/Map 返回值或改变 UUID 语义|
|C08 InstantGuard 与注释，[T58–62](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/CommandDslTemplate.scala#L58-L62)|顶层 object；`parse(pairs: (String,String)*)` → `Either[ApiError,Seq[java.time.Instant]]`；Try 包整个 map；raw 调 `java.time.Instant.parse`；toEither.left.map；错误为 400/PARAM_INVALID，消息前缀精确 `must be ISO-8601 instant: `，同一 getMessage/getClass fallback|不改 LocalDateTime、epoch 默认、UTC 文本重写或异常信息格式；不是 JSON body validator|
|C09 收尾及缺省构造，[T63–65](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/CommandDslTemplate.scala#L63-L65)|最后关闭 InstantGuard；content 字符串有末尾换行；随后关闭生成器 object。输出没有 `object CommandDsl`，没有显式继承/父构造实参、annotation、self-type、type alias、辅助构造、overload、var、lazy、private 成员、initialize block 或 MANUAL/`???`|不得因文件名包裹 namespace，也不生成空业务实现；Scala case class 编译器合成方法不是模板显式发射成员|

本表涵盖静态发射所有非注释语法与全部 RHS；T15–24、T51–52、T59 的注释独立列账。源码中的注释历史声称“逐字对齐”，只记录其来历，不把旧声明升级为本轮验证结果。

## 4. raw-scala、人工参考与 approved-target 分开

### 4.1 人工参考不是新生成输出

人工 [CommandDsl.scala L3–49](../baseline/curated-scala/net/imadz/infrastructure/api/CommandDsl.scala#L3-L49) 的包、唯一 import、五件套及 RHS 与 raw 字符串对应；其 L1–2 仍描述“本仓无再生成管线”，raw T15–16 则说明 R5c 起由 CodegenMain 发射。两种 provenance 不能混抄。这里没有像 CommandHelpers 那样由人工补完的算法体；但仍不能由此推断所消费 auth/common JAR 已验证。

### 4.2 允许的目标覆盖与未授权变化

1. 默认固定包位和完整文件路径仍为 `net.imadz.infrastructure.api` / `app/net/imadz/infrastructure/api/CommandDsl.scala`。这是 infrastructure 下真实需要的 api 子包；[PackageLayout L113–115](../baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala#L113-L115) 的 `infrastructure.api.root = "controllers"` 是 Controller 位置，**不能**机械套用到本支撑文件。不要新增 `example.bankwealth.api` 第四层，也不要为了银行包一致性擅自更改固定 controller import。
2. 已批准的正常 import/长字段逐行排版应用于本项：Play/Java/Scala 类型使用明确简名；类型位 `CommonTypes.Id` 与 term 位 `Id.of` 要避免错误 owner。目标以 `CommonTypes`、`Id` 两个明确 import 保留 owner；不通过 type alias 合并它们。
3. 只在展示的换行/import 位置有格式差异；C01–C08 的类型、字段顺序、方法种类、lambda、键顺序、异常范围、消息、appendInstant(3) 和每次写入取当前时间不变。无新 API、校验、时间依赖注入、缓存或成功算法。
4. provenance 头由集成 writer 输出，不照搬 legacy 日期/knowledge-release；原静态正文的来源和类型/表达式边界注释仍需保留其事实含义。下面给的是完整可审阅的目标非注释正文，头部最终字节由共享 writer 合同裁定，不能称其是已有 expected 文件。

### 4.3 目标正文（一个文件，所有成员体）

```scala
package net.imadz.infrastructure.api

import java.time.Instant
import java.time.format.DateTimeFormatterBuilder
import scala.util.Try

import play.api.libs.json.{JsValue, Json, OWrites, Writes}

import net.imadz.common.{CommonTypes, Id}
import net.imadz.common.auth.ApiError

final case class OkReceipt(
    aggregateId: String,
    decisionView: JsValue
)

object OkReceipt {
  implicit val writes: OWrites[OkReceipt] = (r: OkReceipt) =>
    Json.obj(
      "status" -> "ok",
      "aggregateId" -> r.aggregateId,
      "events" -> Json.arr(),
      "occurredAt" -> new DateTimeFormatterBuilder()
        .appendInstant(3)
        .toFormatter
        .format(Instant.now()),
      "decisionView" -> r.decisionView
    )
}

final case class ViewListDto[V](
    view: String,
    total: Int,
    page: Int,
    pageSize: Int,
    items: Seq[V]
)

object ViewListDto {
  implicit def writes[V](implicit w: Writes[V]): OWrites[ViewListDto[V]] =
    (dto: ViewListDto[V]) =>
      Json.obj(
        "view" -> dto.view,
        "total" -> dto.total,
        "page" -> dto.page,
        "pageSize" -> dto.pageSize,
        "items" -> Json.toJson(dto.items)
      )
}

final case class ViewItem[V](item: V)

object ViewItem {
  implicit def writes[V](implicit w: Writes[V]): OWrites[ViewItem[V]] =
    (vi: ViewItem[V]) => Json.obj("item" -> Json.toJson(vi.item))
}

object IdGuard {
  def parse(pairs: (String, String)*): Either[ApiError, Seq[CommonTypes.Id]] =
    Try(pairs.map { case (_, raw) => Id.of(raw) }).toEither
      .left.map(t =>
        ApiError(
          400,
          "PARAM_INVALID",
          s"invalid id: ${Option(t.getMessage).getOrElse(t.getClass.getName)}"
        )
      )
}

object InstantGuard {
  def parse(pairs: (String, String)*): Either[ApiError, Seq[Instant]] =
    Try(pairs.map { case (_, raw) => Instant.parse(raw) }).toEither
      .left.map(t =>
        ApiError(
          400,
          "PARAM_INVALID",
          s"must be ISO-8601 instant: ${Option(t.getMessage).getOrElse(t.getClass.getName)}"
        )
      )
}
```

`ApiError` 三个实参的既有调用顺序保持；其真实消费版本的字段名尚待核验，不在本阶段猜测 named args。此处同类型 String 字段以多行声明辨识，调用方的 `OkReceipt` 应使用已知字段名 `aggregateId = ...`、`decisionView = ...`，该 Controller 调整属于其 owner。

## 5. JS 实际入口、Model/Builder/Template/产物四层差距

### 5.1 不能按目录名判断可达性

|lane|实际调用链与内容|本项处置|
|---|---|---|
|formal 银行 profile|[registeredProductProducer L92–101](../baseline/js/lib/products/generate-cli.mjs#L92-L101) 显式登记 `scala-cqrs-play-service`。其 [generate.mjs L16–70](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L16-L70) 继承 effect registry，替换 aggregate/invariant，增加 `play-service-dsl`，调用 renderService / journal-readside / test-support / configuration。`renderService` 的输出列表 L199–204 没有 CommandDsl 五件套|`missing-counterpart` 是 **formal 此职责** 的状态，不是全仓不存在。不能修 legacy 后宣称银行已消费|
|legacy 动态 API|[generate.mjs L45–59、133–161](../baseline/js/generators/_deprecated/scala-cqrs-es-api/generate.mjs#L133-L161) 直接 import/call `renderCommandDsl(fp)`；全局 entries.push 无 gate 条件。输出 `modules/kernel/src/main/scala/${pkgPath}/infrastructure/api/CommandDsl.scala`，pkgPath 来自首聚合 pkg/ctxPackage，正文却固定 `net.imadz.metarch.infrastructure.api`|renderer 是可复用内容来源，但路径、条件、deps、schemaCategory 与 BC 不同。该目录虽叫 `_deprecated`，legacy core 并未因此拒绝它；不自动复活为 formal|
|legacy 调用入口的证据|固定 [bin/truthsrc.js L259–301](../baseline/js/bin/truthsrc.js#L259-L301) 调 `generatorCliArgs` 后进 [core.plan L23–42](../baseline/js/src/core/generate.mjs#L23-L42)；额外现行 parser L6–34 接受显式路径、没有 retired 名称过滤；[manifest loader L8–27](../baseline/js/src/core/manifest.mjs#L8-L27) 只检查 manifest 结构，实际 legacy [manifest L1–24](../baseline/js/generators/_deprecated/scala-cqrs-es-api/generator.json#L1-L24) 无 declaredProducts|可沿 legacy 显式路径到 generator 的源码可达结论成立；实际运行/输入准入未执行。`generate-products` 的固定 registry 不登记它，不能通过 formal 入口选它|
|legacy 静态复制|[run-all L2157–2174](../baseline/js/generators/run-all.mjs#L2157-L2174) 仅在 `sagaBinding` truthy 时遍历 scaffold-static/app 并 copy 全部支撑文件，包含本五件套|另一真实发射路径，条件是 Saga binding，不是 gate。copy 本身不构建 CommandDslModel、不收集依赖，不与 formal registry 混签|
|同名 `command-dsl`|[generators/command-dsl/render.mjs L19–91](../baseline/js/generators/command-dsl/render.mjs#L19-L91) 按 command/paramDefs 输出 `trait <Agg>CommandHelpers`，内有 toParam/createFailureReply/createSuccessReply|不是 HTTP 信封 counterpart；本项不占用/改写此目录，不把它改成“CommandDsl”后破坏 Actor helper|
|family `scala-cqrs-play-application-v1`|[generate.mjs L10–35](../baseline/js/generators/scala-cqrs-play-application-v1/generate.mjs#L10-L35) 要求 exact ten-product closure 和 live captured implementations；[render.mjs L16–46](../baseline/js/generators/scala-cqrs-play-application-v1/render.mjs#L16-L46) 独立调 api/commands/queries/codec/services/controller/errors/routes/loader。registry 登记了它，但 [generate-cli L45–51、79–80](../baseline/js/lib/products/generate-cli.mjs#L45-L51) 要求走 generate-project，不能绕过捕获直接 generate-products|有 Model/Builder/Template，但 DTO 合同不是这五件套；`not-wired`/接口差异，不以“family 已有 API”冒称对应完成|

### 5.2 四层逐项比较

|层|Scala raw|legacy 动态/静态|formal 银行 / family|
|---|---|---|---|
|Model|只有 selfType、dependencies；继承 Nil 来源|动态只有 `fp` 参数，entry 路径/分类与正文分离；静态是文件 bytes|formal 混合 artifact/service/endpoints/implementation 行；无本项模型。family buildModels 返回 api/composition/persistence/names/commands/resource/query/view/sources，不是 CommandDslModel|
|Builder|exists gate；固定 FQN；ApiError dependency|动态无 gate 条件，全局一次；静态 sagaBinding 才复制。两者都不同于 gate=None 零漂移|formal serviceSelection 要唯一 selected service，检查 canonical external roots、artifact symbol、bootstrap implementation、端点 port 唯一，不推导 BC gate。family 先重编译比较 api/composition，再解析 carrier/name，不能从这些检查猜出 gate.isDefined|
|Template|固定一文件，三个 final case class 与五个 object|legacy `renderCommandDsl` 的 C01–C08 RHS 同形，OCC_EXPR 在 [scala.mjs L7–8](../baseline/js/generators/_deprecated/scala-cqrs-es-api/templates/scala.mjs#L7-L8) 是代码字符串；Scala 插值 `${...}` 在 JS 模板中转义后保留。静态副本不是 builder/template 分离|formal renderService 大字符串包括认证、错误、decodeBody、endpoint、binding、composition；family apiTemplate 发 Failure/Outcome/CommandResult/requests/ReceiptPage，均不是把 BC 五件套写对了|
|产物|gate 触发的 root/app 固定文件|legacy 动态 kernel 路径与硬编码 package 可能分离；静态 net.imadz.metarch 包；无 fresh 输出|银行现存是 `example.bankwealth.service`，文件/对象 `BankServiceService`；没有在已检查 baseline/actual-js 的 Scala 文件中匹配到这五个类名。该范围的搜索不证明真实真源树没有 gate 或其他仓库没有支撑件|

family 的具体差异不能只看文件名：[apiTemplate L9–31](../baseline/js/generators/scala-cqrs-play-application-v1/templates/api.mjs#L9-L31) 发八个固定 failure case object（InvalidRequest、NotAuthenticated、NotAuthorized、CsrfDenied、MissingResource、Unavailable、OutcomeUnknown、InternalFailure）及 `DomainRejected(code)`，`Outcome[A]=Either[Failure,A]`，协变 `CommandResult[+A]`、`Applied[A](event:A)`、`NoChange extends CommandResult[Nothing]`；每个 `m.commands` 发 request case class，字段来自 c.fields；最后 `ReceiptPosition(mapKey,pidKey)`、以 key/value carrier 派生字段的 `ReceiptItem`、`ReceiptPage(rows:Vector[ReceiptItem],next:Option[ReceiptPosition])`。commandsTemplate 的每条命令返回 `Future[Outcome[CommandResult[c.event.fqn]]]`，queriesTemplate 返回 `Future[Outcome[ReceiptPage]]`。没有五件套/implicit writes/UUID guard。cursor 分页与 raw page/pageSize/total 不能机械互换；Applied/NoChange 不能折叠为总是 OkReceipt。

### 5.3 银行现存复合文件的成员归属与 RHS 保留

已完整读取两个固定银行文件，下面按其真实顺序列职责交接，不将整个 service 文件当本项可删除范围。

|固定来源范围|实际构造与关键 RHS|本项归属/后续 owner|
|---|---|---|
|BankServiceService L1–8|生成头、`.service` 包、Play ApplicationLoader/JSON/RequestHeader/Result、Future imports|混合文件 assembly owner 管；三层拆分不能整体平移后称完成|
|L9–14|`object BankServiceService`；`Principal private[service](id,roles)`；Authority 两个异步 authenticate/csrf 方法|安全与应用边界另项保留；不能从名字重复后缀直接改 implementation 身份|
|L15–22|sealed Failure 的 status/code；六 case objects 分别 400/401/403/404/409/503 与固定 kebab code；Outcome alias|当前错误合同没有 ApiError.message/payload；迁移要 D2，不删 error 分支|
|L23–43|decodeBody 新建 Jackson JsonFactory 并启 STRICT_DUPLICATE_DETECTION；parser 循环计 depth/roots，限制 depth 0..64、唯一 root、结束完整；finally close；NonFatal → Left(InvalidRequest)|不是 IdGuard/InstantGuard 替代品；必须迁移到 HTTP 解码职责或保留，不能因 raw 没有就删除|
|L44–61|Endpoint[I,O] 依次 implementation/version/reads/writes/run；run `(Principal,I)=>Future[Outcome[O]]`；Bindings 的十四个业务端点保持原顺序和各自 nominal 输入输出|HTTP controller / application-service 适配共同拥有。名字、类型和固定 implementation pins 不由本项更改|
|L62–79|PageRenderer 的 implementation/version/shell/script/render；Composition extends AutoCloseable，有 authority/bindings/ready/pages=None；Factory 有 implementation/version/create(context)|页面、生命周期及装配归其他职责；保留所有 body/default，不用空 Composition 假装接通|
|L80–98|requireInstalled 先非 null composition/authority/bindings；逐十四端点检查完整值、精确 implementation/version、reads/writes/run；取 installedPages 后检查 renderer 名与版本|全部交给装配 owner，不能用五件套替换；重复长 guard 的重构须保留每条 pin|
|BankServiceLoader L12–29|Loader 调 infrastructure.bootstrap.ApplicationBootstrap；Components 父构造 context；ec=executionContext，httpFilters=Seq.empty；stopHook Future(composition.close())；pageRenderer 先 requireInstalled 再 pages.get；Response、Route 与静态安全 headers|完整 HTTP 宿主与资源顺序归 controller/bootstrap owner；这里没有新增资源注册|
|L30–55|unavailableHtml；failure 只 Json.obj(code)；response 区分 page/API、页面异常降级；staticPage 区分 shell/script；invoke 先 Reads，Right → `Response(200, endpoint.writes.writes(result))`，Left → failure，JsError → InvalidRequest|真实成功结果由 endpoint 写出，不是 `OkReceipt(id,JsNull)`。五件套不能替代此成功合同而不裁定 D2|
|L56–88|十四 apiActions 各保留 method/path params/audience/csrf/endpointId；pageActions 按十四行 copy 为 `/bank/v1/...` 且 page=true；actions=apiActions++pageActions|路由/页面 owner；不压为 String/Any dispatcher，不借此改路由身份|
|L89–119|page 与 API parser 都限 65536；ready → authenticate → audience → 可选 csrf → path/query/body → row.run；失败各自短路；NonFatal→Unavailable；最后 response|原安全边界和效果顺序必须保留；本项 parse guard 只能放在已确定边界，不能提前绕过认证或把 JSON 解码范围删掉|
|L120–129|静态页面和脚本 GET 分支优先，其后 method+regex 搜索并 action|RouteDefinition/controller owner，本文不改它|

## 6. 带上下文的实际内容 diff

### 6.1 actual-js legacy 支撑正文 → approved-target（结构性对照）

minus 来自固定 **JS 静态副本**，不是银行本轮生成件；plus 来自 §4.3。下列为局部内容 diff，服务于内容审定，不是可直接应用到 JS 生产源码的补丁；完整构造/其余 RHS 见 C00–C09 与两份全文。

```diff
--- actual-js-legacy/scaffold-static/app/net/imadz/metarch/infrastructure/api/CommandDsl.scala
+++ approved-target/app/net/imadz/infrastructure/api/CommandDsl.scala
@@ package and imports @@
-package net.imadz.metarch.infrastructure.api
+package net.imadz.infrastructure.api
+
+import java.time.Instant
+import java.time.format.DateTimeFormatterBuilder
+import scala.util.Try
+
+import play.api.libs.json.{JsValue, Json, OWrites, Writes}
 
+import net.imadz.common.{CommonTypes, Id}
 import net.imadz.common.auth.ApiError
@@ OkReceipt declaration and complete writes body @@
-final case class OkReceipt(aggregateId: String, decisionView: play.api.libs.json.JsValue)
+final case class OkReceipt(
+    aggregateId: String,
+    decisionView: JsValue
+)
+
 object OkReceipt {
-  implicit val writes: play.api.libs.json.OWrites[OkReceipt] = (r: OkReceipt) => play.api.libs.json.Json.obj(
-    "status" -> "ok",
-    "aggregateId" -> r.aggregateId,
-    "events" -> play.api.libs.json.Json.arr(),
-    "occurredAt" -> new java.time.format.DateTimeFormatterBuilder().appendInstant(3).toFormatter.format(java.time.Instant.now()),
-    "decisionView" -> r.decisionView)
+  implicit val writes: OWrites[OkReceipt] = (r: OkReceipt) =>
+    Json.obj(
+      "status" -> "ok",
+      "aggregateId" -> r.aggregateId,
+      "events" -> Json.arr(),
+      "occurredAt" -> new DateTimeFormatterBuilder()
+        .appendInstant(3)
+        .toFormatter
+        .format(Instant.now()),
+      "decisionView" -> r.decisionView
+    )
 }
@@ IdGuard.parse complete body; existing explanatory comment remains separately accounted @@
-  def parse(pairs: (String, String)*): Either[ApiError, Seq[net.imadz.common.CommonTypes.Id]] =
-    scala.util.Try(pairs.map { case (_, raw) => net.imadz.common.Id.of(raw) }).toEither
-      .left.map(t => ApiError(400, "PARAM_INVALID", s"invalid id: ${Option(t.getMessage).getOrElse(t.getClass.getName)}"))
+  def parse(pairs: (String, String)*): Either[ApiError, Seq[CommonTypes.Id]] =
+    Try(pairs.map { case (_, raw) => Id.of(raw) }).toEither
+      .left.map(t =>
+        ApiError(
+          400,
+          "PARAM_INVALID",
+          s"invalid id: ${Option(t.getMessage).getOrElse(t.getClass.getName)}"
+        )
+      )
 }
```

来源锚点：[静态副本 L3–19](../baseline/js/generators/scaffold-static/app/net/imadz/metarch/infrastructure/api/CommandDsl.scala#L3-L19)、[L36–42](../baseline/js/generators/scaffold-static/app/net/imadz/metarch/infrastructure/api/CommandDsl.scala#L36-L42)。动态 renderer 同段源位见 [L78–118](../baseline/js/generators/_deprecated/scala-cqrs-es-api/templates/scala.mjs#L78-L118)，其中 `OCC_EXPR` 必须保留精确原表达式，不换成预先求值的 JS 时间。

### 6.2 raw-scala → approved-target 的有限差异

raw 的 package 已经正确，**没有**上一 diff 的 `.metarch` 删除；只有 import 简化、多行排版和明确的 provenance/header 管理覆盖。具体如下，未列项保持 C01–C08 的完整 body：

```diff
--- raw-scala/CommandDslTemplate.scala::content
+++ approved-target/CommandDsl.scala
@@ unchanged package; explicit dependency imports @@
 package net.imadz.infrastructure.api
 
+import java.time.Instant
+import java.time.format.DateTimeFormatterBuilder
+import scala.util.Try
+
+import play.api.libs.json.{JsValue, Json, OWrites, Writes}
+
+import net.imadz.common.{CommonTypes, Id}
 import net.imadz.common.auth.ApiError
@@ ViewItem writes RHS is retained through import resolution @@
 final case class ViewItem[V](item: V)
+
 object ViewItem {
-  implicit def writes[V](implicit w: play.api.libs.json.Writes[V]): play.api.libs.json.OWrites[ViewItem[V]] =
-    (vi: ViewItem[V]) => play.api.libs.json.Json.obj("item" -> play.api.libs.json.Json.toJson(vi.item))
+  implicit def writes[V](implicit w: Writes[V]): OWrites[ViewItem[V]] =
+    (vi: ViewItem[V]) => Json.obj("item" -> Json.toJson(vi.item))
 }
```

来源：[Template L17–19](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/CommandDslTemplate.scala#L17-L19)、[L44–48](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/CommandDslTemplate.scala#L44-L48)。不能用这两处格式 diff 证明 formal 银行合同等价；银行的不同 wire shape 已在 §5 单列。

## 7. 胶水、默认值与副作用合同

|完整符号 / 来源|本项需要的 API 与语义|供给状态及验证义务|
|---|---|---|
|`net.imadz.common.auth.ApiError`|三个参数 `400, "PARAM_INVALID", message` 的构造调用；Controller 另需 badRequest、错误到 HTTP 的翻译|[BC scaffold build L130–135](../baseline/bc/scaffold/build.sbt#L130-L135) 声明 `net.imadz:auth-core_2.13:0.2`、`common-core_2.13:0.2`，不代表实际消费 JAR 已核。固定人工 [ApiError L16–35](../baseline/curated-scala/net/imadz/infrastructure/auth/ApiError.scala#L16-L35) 在 **另一个包** `net.imadz.infrastructure.auth`，不能拿来证明所需 common.auth ABI。D3 阻断，禁止复制这个参考类去掩盖依赖缺口|
|`net.imadz.common.CommonTypes.Id`、`net.imadz.common.Id.of`|[CommonTypes.scala L7–27](../baseline/common/src/main/scala/net/imadz/common/CommonTypes.scala#L7-L27)：类型 alias `UUID`；`of(value:String):Id = UUID.fromString(value)`|源码已实读，JAR 未检。保留 Id 类型位与 Id object 表达式位；不改 ID 格式/名义协议，也不新增容错 UUID 算法|
|`play.api.libs.json.JsValue/OWrites/Writes/Json`|OWrites 的 lambda 实现；Json.obj/arr/toJson；Seq 元素使用隐式 Writes[V]；没有 Reads|BC scaffold [L182–187](../baseline/bc/scaffold/build.sbt#L182-L187) override play-json 2.9.3；[L50](../baseline/bc/scaffold/build.sbt#L50) Scala 2.13.14。目标依赖闭包与 SAM/implicit 编译尚未核验|
|`scala.util.Try`、Either.LeftProjection、Option|Try 包围整个 map，捕获其非致命异常；toEither 左映射；Option(message).getOrElse(className) 只在 message 为 null 时 fallback|不能扩大为吞所有 Throwable，也不能把两个 guards 合成丢失不同消息前缀的无类型 dispatch|
|`java.time.Instant.parse/now`、`java.time.format.DateTimeFormatterBuilder`|ISO Instant 解析；每次序列化取 now；appendInstant(3) 是三位小数精度格式要求，不是业务时间精度调整|没有注入 Clock，序列化运行结果天然随时间变化。稳定生成检查的是源码字节，不能要求重复 JSON 时间完全一样|
|`net.imadz.common.auth.Endpoint` 及 Controller glue|[ControllerTemplate imports L134–211](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/ControllerTemplate.scala#L134-L211) 按实际 endpoint 选 IdGuard/InstantGuard/OkReceipt/ViewListDto/ViewItem；[askBody L541–556](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/ControllerTemplate.scala#L541-L556) 先 repository.entityRef.ask，之后 reply.error.fold 成 Right(OkReceipt(entity,JsNull)) 或 Left(ApiError.badRequest)|支撑件不是鉴权实现，也不发起 ask。Controller 的 JsNull 是 raw 现状，不补造 decisionView 查询结果|
|Actor helper 与 persistence（间接依赖，不是本文件 import）|[CommandHandlerReplyingBehavior L16–44、50–75](../baseline/common/src/main/scala/net/imadz/common/application/CommandHandlerReplyingBehavior.scala#L16-L75)：toParam → rule.fold；失败 Effect.reply、不 persist；成功 Effect.persist.thenReply，用事件应用后的新 state；replyWithAndPublish 额外 thenRun 发布 EventStream|HTTP OkReceipt 不能替代这个回复链。应用 Actor command 仅按明确 reply 合同附 typed replyTo；domain params/events 无 ActorRef。CommandHelper 仍在 `application.aggregates.behaviors` 且三方法完整。不得用 `emit*`/空成功/thenRun(accepted) 冒充此合同|

本项 raw 没有 `???` 或 MANUAL body，不能凭模板族通用印象编造这些槽。它真实存在的技术债是固定源码字符串、model 未被模板使用、依赖只登记 ApiError、完整 FQN 以及 HTTP 序列化直接读时钟。相邻 Controller 的默认 `JsNull`、其他 artifact 的业务 `???`/MANUAL 则必须继续作为各自明确实现槽保留；本项不把它们填成假成功。

两个 guards 的调用顺序由 Controller 决定：[guardWrapped L577–598](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/ControllerTemplate.scala#L577-L598) 和写端点组装是 IdGuard 外层、InstantGuard 内层，Left 直接 `Future.successful(Left(err))`，不进入 ask。不得以“合并 parse 更简洁”改变第一个返回错误或触发业务动作。

## 8. 第二阶段 JS 写集合、共享接口与唯一组装 owner（均未实施）

以下是**拟议写面**，不是本阶段授权。生产仓路径均相对 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc`。

### 8.1 独占实现文件

|拟议路径|职责/具体内容|依赖/限制|
|---|---|---|
|`generators/command-endpoint-dsl/model.mjs`（proposed 新建）|显式 `CommandDslModel` shape：selfType、dependencies；保留无构造默认的事实、继承来源为空的含义；固定支撑成员不是 runtime 业务输入|不使用已有 `generators/command-dsl`，不把全部 content 填 Model|
|`generators/command-endpoint-dsl/build-model.mjs`（proposed 新建）|把经批准的接口投影转为 gate 存在判定；false 返回无模型，true 返回单模型；固定包位和 ApiError dependency；单独收集目标渲染所需 TypeRefs/imports|输入中 gate 的正式产品表示与 presence 规则须先裁 D1。不能把 audience、csrf、Saga binding 或 POST 当 gate|
|`generators/command-endpoint-dsl/template.mjs`（proposed 新建）|唯一输出 §4.3 正文；保留 C00–C09 稳定 construct；排版和注释在 fingerprint 前完成；允许静态模板，不引入无类型万能解释器|内容复用 legacy renderCommandDsl 的算法/RHS，不从 `_deprecated` 模块连带引入 rolemap 输出|
|`generators/command-endpoint-dsl/produce.mjs`（proposed 新建）|只组装本文件 entry；与 raw 对应的 logical role、selfType、依赖、条件、source footprint 明确；返回 [] 或一条，不写磁盘|不能未经 registry 接入声称此目录可被 CLI 调用；不创建虚假的 generator.json 来绕过产品准入|
|`test/command-endpoint-dsl-content.test.mjs`（proposed 新建）|模型 gate 变体、文本/RHS、字节稳定、输出 cardinality 的局部规格|是未来测试槽，不是已存在或已通过的 suite|

拟议接口边界为 `buildCommandDslModel(interfaces)`、`renderCommandDsl(model)`、`produceCommandDsl(context)`，名称只是该独占模块建议；D1 决定 interfaces 来源前不冻结为已发布 API。`model.selfType` 是结构引用，`model.dependencies` 与原始单项依赖账可追踪；完整渲染 imports 必须经公共 TypeRef/import resolver，而不是生成后 regex 替换。是否把增加的外部引用纳入结构 dependencies 还是独立 renderDependencies，由 shared-types owner 定案，不篡改 raw 的两字段模型事实。

### 8.2 共享/调用方写面：仅由集成者串行处理

- **唯一物理文件 assembly owner：`controller-api-integration`（角色名，拟议）**。该 owner 对 `app/net/imadz/infrastructure/api/CommandDsl.scala` 的 package、imports、provenance、五件套与最终 entry 负责，其他 artifact 不再次发同路径。
- `generators/scala-cqrs-play-service/generate.mjs`、`generator.json`：formal owner 才可在选定接口产品与版本后接入 produce；不得无条件给每个银行服务加 BC 五件套。
- `generators/scala-cqrs-play-service/render-service.mjs`、`render-service-pages.mjs`：与 http-controller / application-service / bootstrap owner 共享。仅在 D2 明确逐 endpoint adapter 后消费支撑件；decodeBody、Authority、Failure、Bindings、Pages 和 lifecycle 不能随本项被删除。此项 **不独占整个复合文件**。
- `generators/scala-cqrs-play-application-v1/build-models.mjs`、`render.mjs`、`templates/api.mjs` 及其 `generator.json`：family owner 负责显式版本的条件适配，不把 ReceiptPage/CommandResult 改成 nominal alias；family 当前必需 live implementations，不能取消这个准入。
- `generators/api-dsl/emit.mjs`：legacy controller owner 核定 import 和成功返回包位；固定 [L67–68](../baseline/js/generators/api-dsl/emit.mjs#L67-L68)、[L182–190](../baseline/js/generators/api-dsl/emit.mjs#L182-L190) 可见部分完整 FQN 固定 metarch、另一个 import 从 basePkg 派生，不能只改支撑文件留下调用方错包。
- `generators/_deprecated/scala-cqrs-es-api/templates/scala.mjs`、`generate.mjs` 与 `generators/run-all.mjs`、`generators/scaffold-static/app/net/imadz/metarch/infrastructure/api/CommandDsl.scala`：仅在 legacy 消费退役策略批准后停止重复发射或改为同一实现适配；本项不要求复活 retired profile、不改其其他 ViewKeys/CommandRoleMap 输出。静态复制条件不能默改成整个 supportRoot 不复制而误删其他支撑类。
- `lib/scala-target/naming.mjs` 的 [resolveName / resolveNameSet / resolveArtifactPath L77–118](../baseline/js/lib/scala-target/naming.mjs#L77-L118) 可复用：前者区分 Scala 与稳定身份，中者负责作用域/portable 碰撞，后者按 profile 模块源根组路径。固定 CommandDsl 包不是从业务名称推导；profile/root 对齐须由公共 layout owner 提供，不能盲用 family kernel 源根。
- `lib/products/generate-cli.mjs`、产品准入/生成配置、公共 layout/types、`src/core/generate.mjs` writer、registry、catalog、ledger/anchor 集成属于集成者，不属于本 artifact 的并行实现写权限。当前没有可直接使用的独立 `--artifact command-endpoint-dsl` 参数。

### 8.3 路径退役和来源映射

- legacy 动态 `modules/kernel/src/main/scala/<pkgPath>/infrastructure/api/CommandDsl.scala`、legacy 静态 `app/net/imadz/metarch/infrastructure/api/CommandDsl.scala` → BC root `app/net/imadz/infrastructure/api/CommandDsl.scala`。迁移必须同步所有 import/完整 FQN 和 source root，不保留旧包永久转发壳假称完成。
- 现存银行 `BankServiceService` 与 `BankServiceLoader` **不是**这两条旧路径的同义替身，不能本项整文件退役。三层拆分与服务后缀修正由它们的完整内容规格定责，实施前保留十四条端点和 implementation pins。
- raw 全局件 noteIds/morphisms 为空；不把任意命令 anchor 指到这个技术文件。若 formal 产品有真实 source footprint，登记产品级来源与固定 construct mapping；具体来源身份见 D5。
- 在最终格式/import 确定后才算 fingerprint/anchor；[core anchorInputs L91–104](../baseline/js/src/core/generate.mjs#L91-L104) 根据 final bytes 求 mapping span。旧文件退役须拥有权计划和调用方清单；[core L187–190](../baseline/js/src/core/generate.mjs#L187-L190) 对不再计划的 owned rows 标 RETAINED，并非自动删除，不能仅改变 entry.path 就声称旧文件已清干净。
- PB 字段号、PID、serializer ID/manifest、名义领域类型和溢出语义不在本项变更范围；不扩大 serializer 绑定，不改 addExact，不通过 String/Any 分发降低 CC。

## 9. 验收 fixture、公开 CLI 形状与副作用边界

**本节全部未运行**。示例路径是第二阶段拟建的隔离工程，不是已经存在的文件或已批准执行命令。不能使用旧银行 generated/current、共享 ingested-app、默认 banking-app；不得为本项重跑全银行 workshop。

### 9.1 最小输入矩阵与 expected 文件集合

拟议 fixture 根：`/Users/zhongdj/Workspaces/mad-polaris/command-endpoint-dsl-parity-fixture`，由集成者一次建设，两端 adapter 明确字段来源，不维护第二份业务真源。

|fixture|输入/检查|本 artifact expected|
|---|---|---|
|`no-gate`|controllers 为空；另测 controller 有 endpoint 但 gate=None；valueObjects 非空不影响；已有文件的保留单列 writer 测试|零新增 CommandDsl 文件；不混称删除|
|`one-gate`|一个具备合法 gate/serves/typed reply 合同的最小端点；保留完整 BC endpoint metadata|单工程 `app/net/imadz/infrastructure/api/CommandDsl.scala`，内容为 C00–C09 + 认可覆盖|
|`many-gates`|跨两个 controllers、重复需要同五件套；混入 gate=None；包含只读 gate|仍只有一个完整文件；不得缩成部分五件套或两份|
|`multi-root`|同一 gate 输入选择 BC multi 模式，核对 root/app 与 ledger physical path|同一路径；不可误进 modules/kernel|
|`guard-order`|两个合法 UUID、一个非法 UUID；合法/非法 Instant；空 pairs；名字不同但 raw 相同|Right 保序、单次失败无成功前缀；精确 400/PARAM_INVALID 与两个消息前缀；端点 Id 失败不执行 Instant/ask，Instant 失败不 ask|
|`json-shapes`|OkReceipt 的任意 JsValue、空/非空 ViewListDto 与自定义 Writes[V]、ViewItem 嵌套值|精确键/类型/顺序；events 空数组是 raw 合同；occurredAt 在写入时生成、三位小数；ViewItem 保留 item wrapper；无分页新增校验|
|`formal-negative`|仅 audience/csrf/Saga binding，无获准 gate 投影；只读 family cursor / Applied-NoChange 合同|不得静默推导 gate 或把业务结果包装为无条件 ok；返回内容/接口缺口而非 fake success|

双端完整文件比较包括头部来源白名单、package/import 分组、成员/字段顺序和全部 RHS；只允许明确批准的生成器版本头与平台换行差异，不 flatten 全部空白。两次同输入源码字节稳定；一处 gate 从 None 改为 Some 时只产生预期本项及其 controller/routes 依赖变化，并核对应作者来源可查到新文件位置。固定银行输出不是同输入 fixture。

### 9.2 真实 CLI 形状（不是本阶段执行许可）

**JS formal，沿现有注册 producer，待 D1 接线后才可能产出本项：**

```sh
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /Users/zhongdj/Workspaces/mad-polaris/command-endpoint-dsl-parity-fixture/js/request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-play-service \
  --out /Users/zhongdj/Workspaces/mad-polaris/command-endpoint-dsl-parity-js \
  --options-json /Users/zhongdj/Workspaces/mad-polaris/command-endpoint-dsl-parity-fixture/js/options.json \
  --plan
```

四个值参数和 `--plan` 均由固定 [generate-cli L66–88](../baseline/js/lib/products/generate-cli.mjs#L66-L88) 支持。这里的 options 必须满足真实 local runtimeArtifact SHA 校验与 service.externalSourceRoots 目录/不重叠检查（L114–139），不能发明空 options 绕过。`--plan` 捕获文件、内存编译产品与生成 entries；不 apply、不写源/ledger/anchors，**不是**本次许可的“纯文本读取”。去掉 `--plan` 后 [applyEntries L246–267](../baseline/js/src/core/generate.mjs#L246-L267) 创建输出目录、写计划源/构建配置等全部 entries、写 `truthsrc.ledger.json` 和 `anchors.json`；没有 artifact-only 输出过滤。该路径不自动发布 project graph。

**family 或需要外置实现捕获时只可用 project 入口：**

```sh
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-project \
  --project /Users/zhongdj/Workspaces/mad-polaris/command-endpoint-dsl-parity-fixture/family/truthsrc.project.json \
  --out /Users/zhongdj/Workspaces/mad-polaris/command-endpoint-dsl-parity-family \
  --plan
```

project config 选择实际 `scala-cqrs-play-application-v1`，不是新造未注册目录。[project/cli L91–144](../baseline/js/lib/project/cli.mjs#L91-L144) 读 tree/documents/tool evidence，validate、roundtrip、compile、捕获实现；[L183–208](../baseline/js/lib/project/cli.mjs#L183-L208) **即使 --plan 仍调用 verifyImplementationSources**。本轮没有读该调用的全部实现闭包，不能保证其无子进程/临时目录/编译副作用；在获准执行前必须逐一固定证据命令、资源、供给与写面。非 plan 还写输出 `.truthsrc/{canonical,request,compiled,inputs}.json`（L217–224）、ledger/anchors，以及由 projectGraphFile 选定的 SQLite graph 和回锚。新 out 不等于旁路无写入。本文不猜 graph 的确切路径，也不承诺该未核闭包零下载。

**Scala 传统输入/目标显式指定的形状：**

在 `/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen` 为工作目录，由集成者批末一次执行以下命令形状（未执行；fixture adapter 与供给尚未建立）。

```sh
sbt \
  -Dcodegen.systemFile=/Users/zhongdj/Workspaces/mad-polaris/command-endpoint-dsl-parity-fixture/bc/canonical.json \
  -Dcodegen.systemBindings=/Users/zhongdj/Workspaces/mad-polaris/command-endpoint-dsl-parity-fixture/bc/bindings.json \
  -Dcodegen.targetDir=/Users/zhongdj/Workspaces/mad-polaris/command-endpoint-dsl-parity-bc \
  -Dcodegen.generatorVersion=cc335eb1e0d0fae17bf092fd61b126040196ea70 \
  -Dcodegen.noGit=true \
  -Dcodegen.ledger=/Users/zhongdj/Workspaces/mad-polaris/command-endpoint-dsl-parity-bc/truthsrc.ledger.json \
  "runMain net.imadz.codegen.CodegenMain"
```

[CodegenMain L62–81](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L62-L81) 要求 systemFile/systemBindings 成对且与 codegen.system 互斥；不能再加 `codegen.semanticProductsFile` 转去 products。D4 必须先证明该 file adapter 实际保留合法 endpoint.gate；若做不到，本命令不构成本项验收，需另经批准提供可达的 SystemMetadata fixture，而不是虚构 registry 名。multi 变体另加确有源码支持的 `-Dcodegen.multiProject=true`，使用另一个新 target。

副作用：sbt/JVM 和编译缓存、可能依赖解析/下载；CodegenMain 会 mkdir、复制 scaffold、multi 时移动 common 文件、写整个最小 SystemMetadata 依赖闭包、知识 release manifest、formal-semantics（若有）及显式 ledger。没有本项专用 filter，不宣称只写一个 Scala 文件。[GeneratorVersion L18–20、35–61](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorVersion.scala#L18-L61) 的 explicit pin + noGit 避免生成器探测 Git/日期，但不保证 sbt/plugin 不发生其他 I/O。冻结供给不足就阻断，不 publishLocal、不重建 runtime、不调整 pins 洗绿。

**局部接口/行为验收**：拟建隔离 Play fixture 的 `test/codegenparity/CommandEndpointDslContractSpec.scala`（proposed），含 §9.1 的 JSON/guard/Controller 短路案例。其真实 suite 建好后，在该隔离工程使用有效 sbt 命令形状 `sbt "testOnly codegenparity.CommandEndpointDslContractSpec"`，不是声称现有此 suite。Actor helper 的失败不 persist、成功事件应用后 thenReply、回复次数和无意外发布，复用其 owner 的最小 persistence testkit 闭包，不为本项启动银行 DB/服务或另建运行库副本。

建议未来调度预算：内容生成/完整对账 5 分钟、共同依赖闭包编译与局部行为 15 分钟；超过先交回阻塞与已得证据，不默默扩到全仓。普通 JS/Scala 方法 CC 目标 ≤5，6–10 逐方法理由，>10 先重构或明确批准例外；嵌套目标 ≤2。**CC = not-measured**，工具、版本和 Scala 口径尚未固定；不从这里的行数或函数数量伪造分数。

## 10. 具体未决项与停止点

|ID|须作的内容/API 决策|未决定时的边界|
|---|---|---|
|D1 formal gate 投影|哪个已准入产品/版本提供 BC `InterfaceLayer.controllers[].endpoints[].gate` 的 presence 与引用身份？要不要新显式产品版本？formal audience/csrf、family api-contract、legacy sagaBinding 都不等于它|不无条件接 registry，不在 options 偷塞布尔 gate，不声称 formal 已支持|
|D2 wire/业务结果适配|哪些端点明确选用 `status/aggregateId/events=[]/occurredAt(now)/decisionView`；哪些保持银行各 nominal response？现有 Failure.code 如何映射 ApiError.errorCode/message/payload？family Applied/NoChange、cursor ReceiptPage 如何保留，而不是被 wrapper 抹掉？|默认只复刻 BC 内容，不批量改变银行或 family HTTP 合同；保留实际 Writes/result、错误、安全和路由顺序|
|D3 实际胶水供给|核定所消费 `net.imadz.common.auth.ApiError` 的 constructor/JSON Result API、common Id/CommandHelper 的实际 JAR 字节与依赖闭包；scaffold source 与 JAR 同时在 classpath 时唯一供给是谁？|没有真实 ABI 证据就阻断接口验收；不同 FQN 的 curated ApiError 不算证明，不升级/发布/复制替身|
|D4 同输入可达 fixture|BC formal file adapter 能否保留合法 gate 并通过 controller harness？JS adapter 是否逐字段保留 gate、reply、字段/端点顺序而非从散文推断？单/多模块 fixture 的最小完整闭包是什么？|本轮只有源码结构对照，无同输入产物/行为证明；不能用无 gate 的绿色生成冒充本项 exercising|
|D5 来源/退役/writer 接缝|global support 的正式 productFootprint/source identity、渲染额外依赖槽、最终 provenance 头、旧路径 owned 退役如何由唯一 assembly owner 固定？legacy 动态和 saga 静态是否仍有需保留消费者？|保留 raw Nil noteIds，不编造业务 anchor；不删除旧副本、不新增 alias 壳、不多 owner 同路径写入|

固定包 `net.imadz.infrastructure.api` 当前作为与 BC/controller 一致的目标保留；若未来要按 context 参数化，必须同时裁定 controller imports、多个 context 是否共享同一五件套及完整路径迁移，不能作为本规格的隐式自由选择。

上述决策仅阻断本 artifact 的相应实施/验收，并不阻止本份已观察内容独立交付。保存文档不意味着 ready、parity-PASS、behavior-PASS 或运行成功。
