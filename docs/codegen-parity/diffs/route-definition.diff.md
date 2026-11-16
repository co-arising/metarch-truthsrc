# route-definition：传统 routes 标记片段与 JS 三条接线的内容规格

## 1. 身份、状态与边界

- Artifact：`route-definition`，清单第 37 族；detail group 同为 `route-definition`。
- 状态：**`decision-required`**。传统 MBT 已逐文件实读；formal 银行缺少等同的 `codegen:controllers` 片段，legacy 有不同的 E301 标记片段，family 有不同的整文件 routes。不能把三者合称已经支持，也不把本文件当实现或行为通过证明。
- 固定检视 HEAD：BC `cc335eb1e0d0fae17bf092fd61b126040196ea70`；JS `bf104e16ab82ef39d7fa416d0997907d18a815ad`。文件身份以 [baseline/index.json](../baseline/index.json) 中的完整字节与 SHA-256 为准，不以 HEAD 替代工作树内容。
- 权威依据：[APPROVED-PLAN.md](../../../.rounds/prettify-generated-code-resume-20261115-cgr9lzlk/APPROVED-PLAN.md#L104-L146)、[AUTHORING-CONTRACT.md](../AUTHORING-CONTRACT.md#L13-L48)、[layout-and-style.md](../layout-and-style.md#L14-L64)。这里只读源码和已有银行输出，未执行测试、类型检查、编译、生成或运行时验证。
- 本轮仅新增本 diff 和 `details/route-definition.json`；未改基线、先前 15 份 diff、生产代码、真源、生成应用、catalog、ledger、anchors、Git 或任务状态。没有新建 fixture/expected 文件。

### 1.1 四种证据分开

| 证据面 | 本次取得的内容 | 不代表什么 |
|---|---|---|
| `raw-scala` | [Model 全文][M]、[Builder 全文][B]、[Template 全文][T]、[writer 全文][W]；下文完整 MBT 和逐构造账 | 没有新跑同输入 Scala 输出；手推样例不是实跑产物 |
| `approved-target` | 默认保留 raw 的路由选择、格式、标记；叠加三层布局、正常命名、共享领地保护；未裁定问题列 D1–D6 | 未存在可签收的完整同输入目标文件集；不凭本规格宣称可编译 |
| `actual-js` | [冻结银行 BankServiceLoader.scala 全文][BANK]，以及 formal/legacy/family 固定 emitter | 银行文件不是 family `conf/routes` 的实例；生成头也不等于调用链证据 |
| curated reference | 基线 index 的 `baseline/curated-scala/` 中没有 routes 或 controller 对应文件；本项为 `missing-counterpart` | 不以 CreditBalance 聚合参考、products 模板或其他制品的 golden 代替路由参考；未声称当前仓库所有目录都没有参考 |

本项已按 index 对账的核心字节身份如下；其他固定源的指纹可按所链接 snapshot 精确查回 index。

| 固定源 | bytes | SHA-256 |
|---|---:|---|
| [RoutesFragmentModel.scala][M] | 1450 | `653bbddf44270a31df19eb7a9088f47cf81213e8eaed87d44e33e62fc0091029` |
| [RoutesBuilder.scala][B] | 2922 | `c23541b6df9720928fd90b0db9622dc84562130f98b85d55803f426aa8e9f6f3` |
| [RoutesTemplate.scala][T] | 2275 | `4272ced844752343f859338d64c6a9263874618bbc2f985b3c060539b1217708` |
| [MarkerBlockWriter.scala][W] | 4026 | `6634ec9da4b6d0b58971a9161a863b77ef1136c5473ae3777af20bc4195ed365` |
| [CQRSApplicationGenerator.scala][CQRS] | 56458 | `af98d7ccb3f894fc0641096448d0508942900304a903dc682160a58724e90341` |
| [formal render-service.mjs][FORMAL] | 12954 | `c8d92119b3e98dc868ea7bc17b018fef4372f24621206d2d00d1af365de160de` |
| [formal render-service-pages.mjs][PAGES] | 7624 | `6c76511c60b1f79510526c3f7ea7642ba8c22870f06e446dd044467e90274c6f` |
| [legacy generate.mjs][LEGACY] | 17379 | `007cfe762df634cc654f86794d9de5cda78f76aaf740749638ad3627e69e74c4` |
| [family build-models.mjs][FM] | 9771 | `3588e1ac7cfb6ea5c9f0a180acd4446c9196556bd42a4c87b41e78454b6091e5` |
| [family templates/http.mjs][FT] | 7578 | `8b1910fabfb3448d8a7f0a6e92e815232d43844cde60a4a88e5af3cd7f0db33c` |
| [BankServiceLoader.scala][BANK] | 10379 | `12428f65ad1190f911102bd8bdf448aa6fd4c3017a9eeea301cab658a8eac3a0` |

### 1.2 调度、输出基数和物理根

传统链为 [CodegenMain.scala:183–241][MAIN] 的非 `semanticProductsFile` 分支 → [runCommon:203–215][DISPATCH] → [generateInterfaceLayer:1029–1064][INTERFACE]。顺序是先构建并写入全部 controller、条件发射 CommandDsl，再把同一批 `ControllerModel` 交给 `RoutesBuilder.build`。本 builder 不按 concern 再过滤 controllerModels。

令 `N = Σ controller.endpoints.count(e => e.gate.isDefined && e.skip.isEmpty)`。

| 变体 | 条件 | 本制品输出 | 状态 |
|---|---|---|---|
| gated fragment | `N > 0` | 一份逻辑标记块、N 条路由、至多一个 `<target>/conf/routes` 物理文件；不是每 controller 一文件 | enabled，source-observed，未实跑 |
| suppressed | `N == 0` | `None`；不调用 writer，不新建 routes、不删除既有块 | suppressed，未实跑 |
| single-project | `multiProjectMode=false` | `outputRoot` 是通常的 `<target>/app`；normalize 后取 parent，再接 `conf/routes` | 未实跑；不是按目录名 `app` 猜 |
| multi-project | `multiProjectMode=true` | `outputRoot` 就是 `<target>`；直接接 `conf/routes`，不是 `modules/kernel/conf/routes` | 未实跑 |
| create / replace / append / malformed | `N > 0` 后按目标文件及标记态分支 | 见 §4 writer；malformed 抛异常 | 各分支未实跑 |

[writeRoutesArtifact:1070–1087][ROUTE-WRITER] 是独立写入口，不走 `writeArtifact`、不加整文件生成指纹、不产生 routes 的 ledger 行。`RoutesFragmentModel.selfType=conf.routes` 是模型标识，不是 Scala 包或类。

[generateAggregateStateController:1004–1027][STATE-DISPATCH] 明说 state 路由归 Node `gen_api_layer` E301 块，不在这里写。不能把 legacy 的 state/vector/views 等所有行都自动算成本族 traditional marker 的输出。

## 2. Scala MBT 全文与逐字段账

以下三段为冻结 MBT 全文；保留原注释、字段顺序、代码字符串例外，不把它们重写成理想化实现。

### 2.1 Model 全文

来源 [RoutesFragmentModel.scala:1–19][M]。

```scala
package net.imadz.codegen.scaffolding.cqrs.model.infrastructure.api

import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, TypeRef}

/** S2-41 R7：routes 标记块 Model——Controller 批产路由片段（conf/routes 标记块内的行集）。
  * 行格式对齐 node 先例（gen_api_controllers builder.mjs:112 写行／tpl_views.mjs:63-64 读行）：
  * `<METHOD 补齐 9 列> <path>  controllers.<Controller>.<action>[(<params>)]`——逐端点组装归
  * RoutesBuilder；gate 声明端点才入集（gate=None 零路由行→Builder 返 None→不产 routes 文件·
  * 不碰既有 routes——零漂移红线）。
  * selfType 非 Scala 件（packageName="conf"／name="routes"——golden 快照位
  * golden_master/conf/routes；ProtoFileModel 非 .scala 件同款先例）。 */
case class RoutesFragmentModel(
                                routeLines: Seq[String],
                                override val selfType: TypeRef = TypeRef("routes", "conf"),
                                override val dependencies: Set[TypeRef] = Set.empty,
                                /** S7 #1c：routes 是共享领地（MarkerBlockWriter 部分合并）——不产台账行，
                                  * 本字段仅为与 ArtifactModel 同轴；号在控制器行上，不在此叠加。 */
                                override val noteIds: Seq[String] = Nil
                              ) extends ArtifactModel
```

| 顺序/成员 | 类型、默认值与真实使用 | JS 映射义务 |
|---|---|---|
| M1 `routeLines` | `Seq[String]`，必传；保留 controller 顺序及 endpoint 顺序；完整路由字符串在 Builder 生成 | 保留明确名为 `routeLines` 的源码槽例外；不能以一个完整 `content` 取代模型，也不能声称 Scala 已有结构化 Route AST |
| M2 `selfType` | `override val TypeRef = TypeRef("routes", "conf")`；`typeParams=Nil`；`fqn=conf.routes` | 非 Scala 文件身份；不能导出 `package conf` 或 `Routes.scala` |
| M3 `dependencies` | `override val Set[TypeRef] = Set.empty`；本 Builder 不增加任何依赖，Template 不消费它 | 与 JS 文件依赖 `controller.path`、产品 footprint 分账，不能伪造 Scala 的 imports |
| M4 `noteIds` | `override val Seq[String] = Nil`；明确共享领地，不重复 controller 知识号 | routes 段级映射要单独设计；不拿整文件台账覆盖手写领地 |
| 继承 | `ArtifactModel`；没有泛型、父构造实参、self-type、annotation、自定义 companion、重载或方法体 | 不额外生成运行时 class |
| 继承方法 | [ArtifactModel:9–47][AM]：`fqn=selfType.packageName + "." + selfType.name`；`registerTo(registry)=registry.register(this)`；`morphisms=Nil`；`noteIds=Nil` 被本模型覆盖 | Routes 写入口没有调用 `registerTo` 或普通制品记账漏斗；这些继承项不是 routes 文本 |

支撑类型见 [TypeSystem.scala:4–85][TS]。`TypeRef` 的字段是 `name:String`、`packageName:String`、`typeParams:Seq[TypeRef]=Nil`。routes 使用 `signature`：Tuple 名以 `Tuple` 开头、后缀全数字、参数非空时输出 `(T1, T2)`；其他有泛型时输出 `Name[T1, T2]`；否则输出 `name`，均递归使用参数 signature。它不输出 FQN。`collectAllDependencies=Set(this) ++ typeParams.flatMap(_.collectAllDependencies)`，`shouldImport` 排除空包/同包/scala/java.lang；routes 不调用后二者。

`FieldDef` 顺序为 `name`、`typeRef`、`defaultValue:Option[String]=None`、`comment:Option[String]=None`、`noteId:Option[String]=None`、`description:String=""`。本 Builder **只用 name/typeRef**，不会输出 FieldDef 的 defaultValue/comment/noteId/description。

### 2.2 Builder 全文

来源 [RoutesBuilder.scala:1–59][B]。

```scala
package net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.api

import net.imadz.codegen.scaffolding.cqrs.FieldDef
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.api.{
  ControllerModel,
  EndpointModel,
  RoutesFragmentModel
}

/** S2-41 R7：routes 片段 Builder——已建 ControllerModel 批产路由行（「生成的端点连不上 HTTP」
  * 的收口：控制器发射了方法但没人写路由行＝死代码）。
  * 行集口径＝控制器实际发射面：gate 声明（gate.isDefined）且非 skip 的端点——skip 端点控制器
  * 无方法即无路由；gate=None 端点＝存量 stub 面，不产行（渐进采纳红线：无 DSL 端点系统零路由
  * 行→None→不产 routes 文件·不碰既有 routes）。 */
object RoutesBuilder {

  def build(
      controllerModels: Seq[ControllerModel]
  ): Option[RoutesFragmentModel] = {
    val routeLines = controllerModels.flatMap(routesOf)
    if (routeLines.isEmpty) None else Some(RoutesFragmentModel(routeLines))
  }

  /** 单控制器的路由行（gate 声明且非 skip 的端点——与 ControllerTemplate active 端点同口径）。 */
  private def routesOf(model: ControllerModel): Seq[String] =
    model.endpoints
      .filter(e => e.gate.isDefined && e.skip.isEmpty)
      .map(routeLineOf(model, _))

  /** 路由行组装（node 先例实样对齐——ingested-app conf/routes 生成段）：
    * method 补齐 9 列（`POST     `／`GET      `）＋端点声明路径＋双空格＋
    * `controllers.<Controller>.<action>`。参数三形态：
    * 空＝无参方法无括号（node mergeConcepts 形态）；路径参数＝`(name: Type)`
    * （reference_project HomeController.deposit(userId: String, amount: Double) 形态）；
    * GET query 分页参数＝`(page: Int ?= 1, pageSize: Int ?= 20)`（node tpl_views.mjs:63
    * 固定默认值——pageGuard 契约 page>=1, 1<=pageSize<=200）。 */
  private def routeLineOf(model: ControllerModel, e: EndpointModel): String =
    s"${e.method.padTo(9, ' ')}${e.path}  controllers.${model.selfType.name}.${e.actionName}${routeParamsOf(e)}"

  private def routeParamsOf(e: EndpointModel): String =
    if (e.parameters.isEmpty) ""
    else
      e.parameters
        .map(p => s"${p.name}: ${p.typeRef.signature}${queryDefaultOf(e, p)}")
        .mkString("(", ", ", ")")

  /** GET 分页 query 参数默认值（page/pageSize Int→1/20——node 固定形态）；路径绑定参数
    * （path 含 `:name`）恒必填无默认（Play 路由语法：路径参数从路径段取值）。 */
  private def queryDefaultOf(e: EndpointModel, p: FieldDef): String = {
    val pathBound = e.path.contains(s":${p.name}")
    if (pathBound) ""
    else
      (p.name, p.typeRef.name) match {
        case ("page", "Int")     => " ?= 1"
        case ("pageSize", "Int") => " ?= 20"
        case _                   => ""
      }
  }
}
```

| 规则 | 实际输入、完整分支/RHS/顺序 | 目标与差距 |
|---|---|---|
| B1 `build` | `Seq[ControllerModel]` → `flatMap(routesOf)`；空返回 `None`，非空 `Some(RoutesFragmentModel(routeLines))`，其余模型字段取默认 | 同时保留空 controller、全无 gate、全 skip 的零写分支；现 family 无此抑制，legacy 恒压入 entry |
| B2 `routesOf` | `model.endpoints.filter(e => e.gate.isDefined && e.skip.isEmpty).map(...)` | 是 Option 存在性，非 gate 字符串真假值；`Some("")` 仍 isDefined，`skip=Some("")` 仍排除；上游合法性归 ControllerBuilder |
| B3 `routeLineOf` | method 右填空格至至少 9 字符，紧接原 path，然后两个空格，再 `controllers.` + `selfType.name` + `.` + `actionName` + 参数串 | 不 uppercase、不 kebab、不 regex、不 URL 改写、不 prepend `basePath`、不排序、不去重；不使用 selfType.packageName；超过 9 字符不截断 |
| B4 空参数 | `parameters.isEmpty` → `""` | 无 `()`；不能统一改成有括号 |
| B5 非空参数 | 原顺序逐项 `name + ": " + typeRef.signature + queryDefaultOf`，以 `", "` 分隔，外围 `()` | 无隐式/柯里化参数、无 body 字段注入、无 replyTo；名与类型由 ControllerModel 确定 |
| B6 路径绑定 | `e.path.contains(s":${p.name}")` 为真 → `""` | **子串判断，不是路径 token 解析**；例如 `:pageSize` 会使名为 page 的参数也判 pathBound。D2 不能静默修正 |
| B7 默认参数 | 非 pathBound 后 match `(p.name,p.typeRef.name)`；`page/Int → " ?= 1"`，`pageSize/Int → " ?= 20"`，其他 `""` | 注释称 GET，但函数**不检查 e.method**；POST 同名参数也带默认。不读取 `FieldDef.defaultValue`；不能称通用 query-default 支持 |
| B8 依赖和错误 | 无 ctx、TypeResolver、metadata 查询、显式异常、I/O 或去重冲突诊断；直接消费已建 controller model | 不能在本族复制 auth gate 解析器；声明/类型/可发射性由 controller 族交付。不能认为任意 signature 都有 Play binder |

输入边界是 [ControllerModel.scala:6–42][CM]：本族消费 `selfType`、`endpoints`，以及 endpoint 的 `method/path/actionName/parameters/gate/skip`。`gate:Option[String]=None`、`skip:Option[String]=None`。`basePath/injectedServices/dependencies/dslFlags/modulePkg/noteIds` 和 endpoint 的 `serviceMethod/returnType/gateKind/serves/reqVo/errorPayloads/idGuard/instantGuard/ctorArgs/addressing/readModel` **不由 RoutesBuilder 再解析**。这些字段的语义不能从 `audience`、port 名或目录名猜出；它们仍由 http-controller 合同拥有。

### 2.3 Template 全文

来源 [RoutesTemplate.scala:1–34][T]。

```scala
package net.imadz.codegen.scaffolding.cqrs.template.infrastructure.api

import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.api.RoutesFragmentModel

/** S2-41 R7：routes 标记块 Template——标记对＋路由行集渲染（golden 锚内容＝块全文）。
  * 标记格式对齐 node 先例（gen_api_controllers/index.mjs:97-98）：起始 `# >>> <name> (<note>) >>>`
  * ／结束 `# <<< <name> <<<`（ingested-app conf/routes 三块实样同构：gen_api_layer (E301)／
  * graph api (EP_Neo4j B3)／workbench feed api (E301-F…)——多生成器同文件按 name 分领地）。 */
object RoutesTemplate {

  /** 标记对（MarkerBlockWriter 段替换的检测/替换锚——文案恒定保证幂等复跑字节稳定）。
    * name＝EP/BACKLOG 词汇 `codegen:controllers`；note＝领地公约（段内勿手改·整段重生成）。 */
  val MarkerStart: String =
    "# >>> codegen:controllers (do not edit inside; regenerated) >>>"
  val MarkerEnd: String = "# <<< codegen:controllers <<<"

  /** 新建文件头注释（目标 routes 不存在时——指向生成器＋领地公约）。
    * 刻意不含 `@generated by` 指纹：routes 是共享领地（标记内生成器／标记外手写），整文件指纹
    * 会触发 gen_manifest KEEP/COVER 判定的 COVER 档（hasFingerprint＝前 8 行含 `@generated by`
    * ——gen_manifest.mjs:77/92）把段外手写领地整文件冲掉；标记块本身即生成器领地标识
    * （S2-41 合并策略：routes 豁免整文件指纹判定）。 */
  val NewFileHeader: Seq[String] = Seq(
    "# Routes — marker-block managed by CodegenMain (S2-41 R7):",
    "# inside the codegen:controllers markers below is generated territory (regenerated wholesale);",
    "# anything outside the markers is manual territory (never modified by the generator)."
  )

  /** 无标记文件尾追加时的一行提示（只在追加路径出现一次；后续复走标记对存在→段替换不重复追加）。 */
  val AppendNotice: String =
    "# The codegen:controllers block below is managed by CodegenMain (inside markers = generated; outside = manual)."

  def generate(model: RoutesFragmentModel): String =
    (MarkerStart +: model.routeLines :+ MarkerEnd).mkString("\n")
}
```

## 3. 输出 construct/RHS 账及完整目标形状

### 3.1 Template 从上到下的全部发射面

| ID | construct / RHS | 发射条件和位置 |
|---|---|---|
| T1 | `MarkerStart` 的完整常量见上 | 块第一行；不是整文件生成头 |
| T2 | `routeLines` 循环 | 每一条不修改、不 trim、不重新排序；其全部 method/path/controller/action/params/default 分支见 B1–B7 |
| T3 | `MarkerEnd` 的完整常量见上 | 块末行 |
| T4 | `generate` RHS：`(MarkerStart +: model.routeLines :+ MarkerEnd).mkString("\n")` | 行间 LF；**块末无额外 LF**。没有 escape、缩进和 import 处理 |
| T5 | `NewFileHeader` 三行，顺序固定 | Template 的 `generate` 本身不用；仅 writer 新建分支用 |
| T6 | `AppendNotice` 一行 | 仅 writer 无标记追加分支用，不每次复跑重复添加 |
| T7 | 不存在的 Scala construct | 产物不是 Scala 源：无 package/import/class/trait/object/case class/alias/val/var/lazy/implicit/annotation/self-type/泛型/继承/构造器/方法体/重载；它只引用 controller action，不声明它们 |

`ControllerTemplate` 的 raw stub 不能当目标成功实现：[renderStubEndpoint:72–83][STUB] 有 `TODO: Implement business logic calling ${e.serviceMethod}`，并返回 `Future.successful(Ok(Json.obj("message" -> "Not implemented yet")))`。RoutesBuilder 正好排除 `gate=None`，**不得为了让路由数量增加而把 stub 接上 HTTP**。本 MBT 无 `???` 或 `// ==== BEGIN MANUAL ====` 算法块；明确存在的债务是 `routeLines:Seq[String]` 槽和 Builder 中的源码字符串构造。标记外手写领地与 Scala MANUAL 方法体槽是两种不同机制。

### 3.2 中性 fixture 的完整文本形状（手推规格，未运行）

此例仅定义 routes 输入/输出，不宣称银行存在这些 controller 或业务；fixture 文件未创建。已建 `ControllerModel.selfType=TypeRef("RoutesProbeController", "controllers")`，按下表端点次序，所有非排除项 `gate=Some("fixtureGate")`、`skip=None`；`fixtureGate` 只是本 Builder 的非空 Option 测试值，不是已声明可运行 auth gate。

| method | path | actionName | parameters（顺序固定） | 输出 |
|---|---|---|---|---|
| GET | `/probe` | `ping` | 空 | 无括号 |
| POST | `/probe/:id` | `update` | `id:String` | 必填路径参数 |
| GET | `/probe/items` | `list` | `page:Int, pageSize:Int` | `?= 1, ?= 20` |
| GET | `/probe/:page` | `byPage` | `page:Int` | 无默认 |
| GET | `/probe/hidden` | `hidden` | 空；`gate=None` | 不输出 |
| POST | `/probe/skipped` | `skipped` | 空；`skip=Some("not emitted")` | 不输出 |

该输入的 **raw-scala 新建 writer 分支手推全文** 为下面 9 行加末尾 LF；也是当前无争议部分的 **approved-target**，两者在此例的有限差异集为空。没有凭注释添加 header 后空行。

```routes
# Routes — marker-block managed by CodegenMain (S2-41 R7):
# inside the codegen:controllers markers below is generated territory (regenerated wholesale);
# anything outside the markers is manual territory (never modified by the generator).
# >>> codegen:controllers (do not edit inside; regenerated) >>>
GET      /probe  controllers.RoutesProbeController.ping
POST     /probe/:id  controllers.RoutesProbeController.update(id: String)
GET      /probe/items  controllers.RoutesProbeController.list(page: Int ?= 1, pageSize: Int ?= 20)
GET      /probe/:page  controllers.RoutesProbeController.byPage(page: Int)
# <<< codegen:controllers <<<
```

这不是 `actual-js` 的同输入生成对账。raw-scala→approved-target 的其他差异只有已明确布局/命名覆盖以及 §9 请求裁定的边界，不能任意把 CodegenMain 文案改成 truthsrc，不能以格式化之名改变分页/路径绑定/HTTP 方法。

## 4. 共享 writer 的实际分支与陷阱

固定完整源 [MarkerBlockWriter.scala:20–70][W]；调用完整源 [writeRoutesArtifact:1070–1087][ROUTE-WRITER]。

| 分支 | raw 的完整关键操作顺序/RHS | 内容规格与未决点 |
|---|---|---|
| 路径解析 | `Paths.get(outputRoot).toAbsolutePath.normalize`；multi 用 root，single 用 `Option(root.getParent).getOrElse(root)`；resolve `conf`、`routes` | 不据路径字符串猜模式；single 的 parent 不存在时回退自身 |
| 参数传递 | `write(target, MarkerStart, MarkerEnd, generate(model), NewFileHeader, AppendNotice)` | 六参数顺序固定；writer 不知道 controller/业务语义 |
| 读目标 | `Files.exists` 后 `Files.readAllBytes`，UTF-8 解码；否则 None | 读/写错误传播，不以空成功掩盖 |
| 新建 | `Files.createDirectories(target.getParent)`；`(newFileHeader :+ block).mkString("\n") + "\n"`；UTF-8 `Files.write` | 注释说“头注释＋空行”，**实现没有额外空行**；无整文件 fingerprint |
| 找到标记对 | 首个 `indexOf(markerStart)`；从 start 后找首个 end；`Pattern.quote(start) + "[\\s\\S]*?" + Pattern.quote(end)`；`replaceFirst(Matcher.quoteReplacement(block))`；UTF-8 写 | 含两标记整段替换；有效 UTF-8 的段外文本保持，不进行内容相等零写判断；不能说原 writer 在重复块时 fail-fast |
| 完全无标记 | `text.replaceAll("\\s+$", "") + "\n\n" + appendNotice + "\n" + block + "\n"`；写入 | 会删除旧尾随空白，故“段外从不修改”文案有例外；D3 必须裁定，不包装成绝对字节保真 |
| 畸形 | 其余情况抛 `IllegalStateException`，消息含 target/start/end 位置及半标记诊断 | 单起/单止或没有 start 后 end 会拒绝；重复标记没有完整计数验证，若有合法首对就只替换第一对 |
| 写后 | writer 分支日志，再 `writeRoutesArtifact` 打印 routeLines.size 与 target | 日志不是路由接通/HTTP/业务成功证据；前面 controller 已写，失败不自动回滚批次 |

当前 JS 共用写器不是通用 BC marker writer：可变补充源 [merge.mjs:99–135][X-MERGE] 和 [apply-preflight.mjs:150–205][X-PREFLIGHT]（SHA 见 §10）。真实分支为 E301 固定常量；incoming 必须恰为一对 E301，重复/半标记拒绝；已有块 CRLF-normalized 相等则零写，替换时按目标主导换行风格；无标记时 trim 尾空白并可能**在文件最前面加 `# @generated by gen_api_layer:2026-08-26` 和 knowledge release**；目标缺失返回 `MISSING`，不新建。

所以只把 renderer 的标记换成 `codegen:controllers` 并传 `merge:'markers'` 会被现有 preflight 拒绝。直接转 `merge:null` 又会丢失共享领地语义。这是确切的共享接口缺口，不是模板常量替换工作。

还有更新协议冲突：[core generate:66–71,115–130][CORE] 对 `noLedger` 不记 ownership，但当前 preflight 在 markers 决策**之前**执行 update ownership 检查；既有无台账 shared routes 不能假定 `generate-project --update` 已可安全更新。D5 必须解决段所有权而不是篡改 ledger 或绕过检查。

## 5. JS 当前三条链：Model / Builder / Template / 产物分账

### 5.1 formal 银行链（实际冻结输出使用 pages 变体）

[registeredProductProducer:92–101][PRODUCT-CLI] 明确注册 `scala-cqrs-play-service`；[generate.mjs:59–70][FORMAL-GEN] 的 `play-service-dsl` 调用 `renderService`，不是 legacy emitter，也不是 family `routesTemplate`。

- Model：`artifact-contract` 的 selected service、service.endpoints、可选 service.pages；`serviceSelection` 要求一个 selected service deployment，options 恰含 `artifact/externalSourceRoots`，校验 artifact stem 和 bootstrap 名。
- Builder/Template 混在 [renderService:20–31,95–163][FORMAL]。endpoint 补 `name=symbol(port.ref.id)` 和 implementation；`hasPages=Object.hasOwn(service,'pages')` 决定使用 `renderPageLoader`。formal 没有 BC 的 `ControllerModel → Option[RoutesFragmentModel]`。
- 非 pages 变体：每 path 按 `/` 分段，冒号段替 `([^/]+)`，包 `^/…$`，参数取冒号后的名；输出六元 tuple `(method, regex.r, Vector(paramNames), audience, csrf, run)`；`Router.from` 用 method+regex 找第一条。没有 query 参数类型/默认值或 `conf/routes`。
- pages 变体：[renderPageLoader:20–28][PAGES] 同样构造 regex，输出具名 `Route`；aliases 用 endpointId 查 index，`apiActions(index).copy(pattern=..., page=true)`。不是 `gate`/`skip` 判断。
- 物理输出是 `app/<base>/service/<artifactId>Loader.scala` 等，由 [entry 返回清单:199–204][FORMAL] 写。冻结银行 [BankServiceLoader.scala:1–129][BANK] 是 pages 版本，头虽为 `scala-cqrs-domain:1`，接线结论来自入口/源码及匹配内容，而不是这个头。

#### 冻结银行复合文件逐 construct 处置账

下表对 [完整 129 行][BANK] 从上到下登记所有职责；这里不把删除一个 `Route` case class 等同迁完 controller/loader。

| 银行行 | construct 和完整 RHS/顺序规则 | 拆分目标/owner |
|---|---|---|
| 1–10 | 生成头；`package example.bankwealth.service`；依次 imports Play Application/Loader/BuiltInComponents、JSON wildcard、MVC wildcard、Router、ExecutionContext/Future、NonFatal、BankServiceService._ | 旧第四层必须退役；controller imports 归 http-controller，loader/components imports 归 application-bootstrap。routes 文件无这些 imports；不能整体搬入 application |
| 12–15 | `final class BankServiceLoader extends ApplicationLoader`；`load(context):Application = example.bankwealth.infrastructure.bootstrap.ApplicationBootstrap.load(context)` | bootstrap owner，目标 `app/example/bankwealth/infrastructure/bootstrap/BankServiceLoader.scala`；需统一配置迁移 |
| 16–24 | `BankServiceComponents(context, composition)` extends `BuiltInComponentsFromContext(context)`；implicit ec=executionContext；lazy httpFilters=Seq.empty；stop hook `Future(composition.close())`；pageRenderer 先 requireInstalled 再 composition.pages.get | bootstrap/lifecycle owner；候选目标同 bootstrap 子包，不由 route-definition 修改资源生命周期 |
| 25–27 | private final `Response(status:Int,value:JsValue)`；`Route(method:String,pattern:Regex,parameters:Vector[String],audience:String,csrf:Boolean,endpointId:String,page:Boolean,run:(Principal,JsValue)=>Future[Response])` | Route 数据派生归本族；Response/run/权限/页面职责归 controller 和服务适配。迁后不在 conf 中放 Scala case class |
| 28–31 | staticHeaders 的 no-store/nosniff/no-referrer；htmlHeaders 加完整 CSP；unavailableHtml=503 静态 HTML/MIME/headers；failure=Response(error.status,Json code) | HTTP/page owner，保留精确 header、MIME、状态和错误码，不因迁 routes 删除 |
| 32–46 | response：非 page→Status(value.status)(value.value)；page→renderer.render(endpointId,status,value)+HTML headers，NonFatal→unavailableHtml；staticPage：script/shell 各 MIME/headers；异常 script 503 空 JS，shell 503 HTML | controller/page owner；不能把页面异常改成成功 |
| 47–55 | generic invoke[I,O]：reads.reads；JsSuccess→endpoint.run→Right 时 Response(200,writes(result))、Left 时 failure；JsError→Future.successful(failure(InvalidRequest)) | controller typed endpoint adapter，非 routes 业务逻辑 |
| 56–71 | `apiActions=Vector(...)`，14 个 Route，见下表逐行值；lambda 均 `invoke(composition.bindings.<port>, principal, input)`；page=false | 本族取原 method/path/参数顺序；audience/csrf/endpointId/port 不得丢失，需 controller 输入桥接 D1 |
| 72–88 | 14 个 pageActions，分别 copy apiActions(0)…(13)，pattern `/api/v1` 改为 `/bank/v1` 且 page=true；actions=`apiActions ++ pageActions` | 顺序原样保存；不能把 aliases 误解为新增业务命令；controller page 适配与本族路由清单共同承担 |
| 89–95 | action(row, matched):Handler；非 page tolerantText(65536)，page 自定义 BodyParser 包装同一 parser，把 parser 左值转为 response(row,Response(status,invalid-request)) | HTTP parser owner；不可因改 Play routes 意外改变请求大小/HTML错误行为 |
| 96–117 | actionBuilder.async → Future.successful(()).flatMap composition.ready → authenticate → 检查 id/roles/audience → 条件 csrf → path 参数由 regex groups 取值 → GET body=JsNull，其他 decodeBody → 拼 path/query/body JSON → row.run；None=NotAuthenticated，其他=NotAuthorized；NonFatal=Unavailable；最后 map response | http-controller/application-service owner；需要接口及行为验证，不用字符串/Any dispatcher 代替类型化端点 |
| 120–128 | lazy router=Router.from；先 GET `/bank/v1` shell、再 GET `/bank/v1/client-script` script，均 parsers.empty；再 actions exists/find/regex match → action | 本族负责准确路由清单；bootstrap owner 负责注入生成 router。static routes 优先级不能随字母排序改变 |

14 条 API 路由原值及各自 alias（regex 捕获对应冒号参数；该表是现存输入形状的还原，不是目标 controller 命名批准）：

| 行/索引 | method / 原 API path | 参数顺序 | audience / csrf | endpointId → bindings 字段 |
|---|---|---|---|---|
| 57 / 0 | GET `/api/v1/accounts/me` | 空 | customer / false | account-me → BankAccountQuery |
| 58 / 1 | POST `/api/v1/cash-requests` | 空 | customer / true | cash-submit → BankCashSubmitPort |
| 59 / 2 | GET `/api/v1/cash-requests/:clientRequestId` | clientRequestId | customer / false | cash-original → BankCashOriginalQuery |
| 60 / 3 | GET `/api/v1/orders/:orderId` | orderId | customer / false | order-detail → BankOrderQuery |
| 61 / 4 | POST `/api/v1/sip-plans` | 空 | customer / true | sip-create → BankSipCreatePort |
| 62 / 5 | GET `/api/v1/sip-plans` | 空 | customer / false | sip-list → BankSipPlansQuery |
| 63 / 6 | GET `/api/v1/sip-plans/:planId` | planId | customer / false | sip-detail → BankSipPlanQuery |
| 64 / 7 | POST `/api/v1/sip-plans/:planId/revisions` | planId | customer / true | sip-revise → BankSipRevisePort |
| 65 / 8 | POST `/api/v1/sip-plans/:planId/pause` | planId | customer / true | sip-pause → BankSipPausePort |
| 66 / 9 | POST `/api/v1/sip-plans/:planId/resume` | planId | customer / true | sip-resume → BankSipResumePort |
| 67 / 10 | GET `/api/v1/sip-plans/:planId/occurrences` | planId | customer / false | sip-occurrences → BankSipOccurrencesQuery |
| 68 / 11 | GET `/api/v1/operations/pending` | 空 | operator / false | operations-pending → BankPendingOperationsQuery |
| 69 / 12 | POST `/api/v1/operations/:operationId/reconcile` | operationId | operator / true | operation-reconcile → BankReconcileExistingPort |
| 70 / 13 | POST `/api/v1/business-clock/tick` | 空 | operator / true | business-tick → BankBusinessTickPort |

每一 alias 的 method/parameters/audience/csrf/endpointId/run 沿用对应 API，唯一变化是上述前缀和 page=true。实际有 14+14+2 个路由匹配位置，不能称之为 raw Scala 的 N=30：传统 gate/skip/controller 输入尚未映射。

### 5.2 legacy：能从旧入口加载，但 formal 未接线

固定 [legacy generate.mjs:45–59,163–256][LEGACY] import controller/view/vector/state emitter，返回 entry；[manifest][LMAN] 声明 routes kind、`truthsrc/v0.3`，无 declaredProducts。[core plan:23–42][CORE] 按给定目录动态 import、调用两次检查确定性；[manifest loader:8–27][ML] 没有目录名退役拒绝。补充的 CLI parser 与 dispatcher（§10）允许显式 `generate --generator .../_deprecated/scala-cqrs-es-api`。结论限于**源码接线可达**，本次没执行，也不批准复活旧工具。`registeredProductProducer` 未注册该目录，故它不是 `generate-products`/formal `generate-project` 的可替换实现。

| 层 | 已观察的真实规则 | 与 BC 差距 |
|---|---|---|
| Model/Builder | [buildCommandModel:212–259][LB] 从解析自身 Protocol 的 cmd params 派生 tier/idp；VO-List 非白名单 skip、`isErrorReply===false` skip；`lowerCmd` 只首字母小写；routeLine 硬编码 POST、`/api/<kebab agg>/.../<kebab cmd>`、路径 id String | 不消费 BC EndpointMetadata 的显式 method/path/gate；不是逐字段同构 |
| 聚合集合 | [buildAggregateController:471–513][LBA] 遍历 proto.commands，skip 时 continue；每活动 ep.push(routeLine)，actions 同序 | 可复用“由实际 controller 发射面导出 routes”的职责，不复用银行无关硬编码表 |
| 行集装配 | generate 的 `routesLines=[]`，按 canonical aggregate 顺序 push controller model lines，然后 views，然后非空 vectorViews，然后 stateRoster（缺省 canonical.aggregates/[]） | 包含传统 `codegen:controllers` 之外的职责；开头“state 未移植”旧注释已被 230–243 的实际代码覆盖，不能沿用旧结论 |
| views | [views:64–91][LV] 每 v 两行；camel 由 key 的 kebab 词形成；GET list 固定 page/pageSize Int 1/20，GET item 固定 entityId:String；hasTenant/engine/singleKey 改 controller body，不改变两条路由形状 | list 的 path/action 间有 12 空格，非 BC 两空格；不能以 normalize 抹掉格式差 |
| vector | [vector:12–75][LVS] 每 v 首字母小写 viewVar；POST 固定 `/api/kb/semantic-search` → `<viewVar>Search`，无参数 | 多 v 会产生同 path 的行；本项不擅自去重或改变业务接口 |
| state | [state_api:13–21][LS] 每 aggregate：GET `/api/state/<kebab>/:id`→ `controllers.AggregateStateApiController.<camel>(id: String)` | 真实常量见链接；不是传统 RoutesBuilder 负责的 controllerModels |
| Template/entry | [generate:250–256][LEGACY] `path='conf/routes'`；E301 start + `routesLines.join('\n')` + E301 end；kind routes、category projection、node routes、families/deps=[]、merge markers、noLedger=true、release=kr??null | 无 None 抑制；标记名、release、无文件时不创建、append fingerprint 都与传统不同 |

### 5.3 family：已有 routes renderer，输出却是整文件

[registeredProductProducer:24,45–51,92–101][PRODUCT-CLI] 注册 `scala-cqrs-play-application-v1`，并要求 captured implementations，`generate-products` 在 80 行拒绝该 producer（包括 plan）。[family generate:10–39][FG] 检查固定 manifest、capture context、十产品闭包，再 buildModels/render；这是实接线，不因目录含 family 而猜测。

[build-models 全文][FM] 已实读。与 routes 有关的完整推导：

1. 从 api-contract/application-composition 重编译声明并 equal 对账；过滤 ownRoles 后调用 persistenceModels。
2. names 角色表把 controller/errors 设 root + `controllers`，但 scope 实为 `packageName + '.' + suffixPackage`，因此当前会形成 `<base>.controllers`；settings/application/components/loader 则 `<base>.composition`。这些是现状，不符合用户最终三层与顶层 controllers 约定。
3. `resolveNameSet/resolveArtifactPath(MODULAR_CANDIDATE)` 解析名字/路径，检查 overrides/ref 与 reserved；command method 从 API `c.id` 得到 lowerCamel resolver 结果、requestName 为 Request 后缀；拒绝保留方法名和 command/DTO 冲突。
4. command field 保留 request 顺序；carrier 沿 nominal 单字段链解析，拒绝缺失/循环/多字段 carrier；`resource=fields.find(location==='path')`。query 保存资源参数、原 path、query key/value；page/readiness 来源保存在 api。`sources=[api.source,composition.source,persistence.product.source]`。
5. 未建独立 RoutesFragmentModel；`routesTemplate` 直接从 commands/query/api 取值。这个综合 model 的其余持久化/服务生成不由本族复制。

[http.mjs:101–111][FT] 完整 routes 函数如下，全部 RHS/追加来源可见：

```js
export function routesTemplate(m, out) {
  for (const c of m.commands) out.append(`POST ${c.path.replace(':' + c.resource.field, ':resourceValue')} ${m.names.controller.fqn}.${c.method.identifier}(resourceValue: String)
`, [c.source]);
  const parameter = m.query.resourceParameter;
  out.append(`GET ${m.query.path.replace(':' + parameter, ':resourceValue')} ${m.names.controller.fqn}.query(resourceValue: String)
`, [m.query.source]);
  out.append(`GET ${m.api.page.path.replace(':' + parameter, ':resourceValue')} ${m.names.controller.fqn}.page(resourceValue: String)
`, [m.api.page.source]);
  out.append(`GET ${m.api.readinessPath} ${m.names.controller.fqn}.readiness
`, [m.api.source]);
}
```

| construct 次序 | 实际规则 | 目标差距 |
|---|---|---|
| commands 循环 | 每 command 一条 POST；只替换 path 第一次出现的 `:<resource.field>` 为 `:resourceValue`；调用 resolved method；参数恒 String | 不读取任意 method/gate/skip/parameters；不能直接复刻通用 BC 参数/default 合同 |
| query | GET；query.resourceParameter 单次 replace；固定 `.query(resourceValue: String)` | cursor/limit 等仍由 controller 从 request.queryString 解析，不能替换成 BC page/pageSize 算法 |
| page | GET；用同 query 参数名替换 page path；`.page(resourceValue: String)` | page 不是原始 Scala 不同 input 的自然等价物 |
| readiness | GET；原 readinessPath；`.readiness` 无括号 | 无 typed controller field 所列 gate；不能凭已有路由注入虚构门 |
| whitespace/source | method 后一空格、path 后一空格、每条末 LF；分别附 c/query/page/api source | BC 9 列/双空格/无块末 LF；需要最终字节后重定位 provenance |
| 文件组装 | [render:16–46][FR] `add('conf/routes','routes',[n.controller.path],routesTemplate)`；components directDeps 含 conf/routes；`applicationSourceEntry` | 当前每完整 model 一文件，命令数+3行，不是 None/片段 |
| entry | [entry:28–64][ENTRY] routes 前加 `# @generated by truthsrc scala-cqrs-play-application:1`，按 UTF-8 byteLength 累加 mappings，`merge:null` | 是整文件管理；去头后旧 offset 全失效；不能只改模板，遗漏 shared writer 和 update 协议 |

#### 带上下文的 actual-js → approved-target 结构 diff

以下 minus 是上述固定 family 函数的原文，plus 是 **提议的目标 Template 接口**，不是已实现 patch 或同输入输出比较。`m.routesFragment` 为 §7 的 proposed adapter 字段；来源 spans 由段装配 owner 的独立 sidecar 保持，D5 未定前不能拿这段代码接生产 writer。plus 不硬编码银行 controller，不发明业务成功结果。

```diff
--- actual-js/generators/scala-cqrs-play-application-v1/templates/http.mjs (lines 101-111)
+++ approved-target-proposal/generators/route-definition/templates/routes.mjs
@@ -101,11 +1,9 @@
 export function routesTemplate(m, out) {
-  for (const c of m.commands) out.append(`POST ${c.path.replace(':' + c.resource.field, ':resourceValue')} ${m.names.controller.fqn}.${c.method.identifier}(resourceValue: String)
-`, [c.source]);
-  const parameter = m.query.resourceParameter;
-  out.append(`GET ${m.query.path.replace(':' + parameter, ':resourceValue')} ${m.names.controller.fqn}.query(resourceValue: String)
-`, [m.query.source]);
-  out.append(`GET ${m.api.page.path.replace(':' + parameter, ':resourceValue')} ${m.names.controller.fqn}.page(resourceValue: String)
-`, [m.api.page.source]);
-  out.append(`GET ${m.api.readinessPath} ${m.names.controller.fqn}.readiness
-`, [m.api.source]);
+  const fragment = m.routesFragment;
+  if (fragment === null) return;
+  out.append([
+    '# >>> codegen:controllers (do not edit inside; regenerated) >>>',
+    ...fragment.routeLines,
+    '# <<< codegen:controllers <<<',
+  ].join('\n'));
 }
```

这是 **结构性对照，非同输入字节比较**：同一 ControllerModel 契约、family API 到 controller adapter、目标 entry 的 provenance 接口均需批准后才能生成实际完整文件。此 snippet 不负责 header、append、新文件、ownership、controller 重命名；这些不能被“模板已有”掩盖。

## 6. 胶水、布局与禁止变更面

| 完整符号/依赖 | 来源、接口和职责 | 证据边界 |
|---|---|---|
| `net.imadz.codegen.scaffolding.cqrs.model.infrastructure.api.ControllerModel/EndpointModel` | BC 自身；已解析的 controller 名、方法、路径、参数、gate、skip | http-controller 是输入唯一所有者；route-definition 不推断业务门 |
| `net.imadz.codegen.scaffolding.cqrs.TypeRef/FieldDef/ArtifactModel` | BC 自身；signature 和模型公共身份如 §2 | 不是生成应用运行库依赖 |
| `net.imadz.codegen.scaffolding.cqrs.MarkerBlockWriter.write` | BC 自身；六参数 Unit，负责读目标/三种写路径/拒绝畸形 | 不能拿 JS E301 merge API 当它的 drop-in replacement |
| `java.nio.file.Files/Path/Paths`、`java.nio.charset.StandardCharsets.UTF_8`、`java.util.regex.Pattern/Matcher` | JDK；文件合并边界、UTF-8、quoteReplacement | 没有数据库、actor 或网络副作用；仍有 filesystem writes，不是纯函数 |
| `controllers.<Controller>.<action>`、Play routes compiler/router | 目标框架根下 controller、每参数的 Play path/query binder；family components [loader:59][FL] 当前构造 `_root_.router.Routes(httpErrorHandler,new Controller(...))` | emitter 声明不证明控制器 ABI 或依赖 JAR 存在；Play 2.8.18 由 formal [generate:49–50][FORMAL-GEN] 源码指定，未查实 jar |
| `play.api.routing.Router`、`play.api.mvc.Handler/BodyParser/Result`、JSON、Future | 当前银行程序化 routing/HTTP adapter；需拆给 controller/bootstrap，不是 conf/routes 的 imports | 保留 auth/CSRF/readiness/parser/页面错误顺序；未验证运行行为 |
| `applyEntries`、`previewEntries`、`applicationSourceEntry`、`mergeRoutesBlock` | JS core 唯一写漏斗及 final-bytes 回锚 | 公共接口由集成者拥有，本包不直接写 ledger/anchors 或复制另一套 writer |

最终根包只允许 `domain/application/infrastructure`。`conf/routes` 在 Play 配置分区；controller 目标 `app/controllers/<Controller>.scala`（单/多模块均 framework root），不在 `<base>.api` 或 `<base>.controllers`。Loader/Components 归 `app/<basePath>/infrastructure/bootstrap/`。来源是 [PackageLayout:113–115][LAYOUT] 和用户覆盖标准，不照抄 family 的 `<base>.composition`。

路由本身没有 CommandHelper、持久化或回复动作；不为满足统一检查向路由参数塞 `ActorRef`。下游边界必须保持：CommandHelper 在 `application.aggregates.behaviors`，含 `toParam/createFailureReply/createSuccessReply`；typed replyTo 只由应用 Actor command 明确回复合同条件生成，纯 domain params/events 不含 ActorRef；失败不 persist，成功 persist/apply 后 thenReply 读取新 state；`replyWith` 不等于 `replyWithAndPublish`。本项不声称已验证这些跨制品行为。

本迁移不可改变 protobuf 字段号/名称身份、PID、serializer manifest/ID、nominal 类型、`addExact` 等溢出策略、稳定 endpoint/operation ID、端口 implementation/version、幂等键。正常 lowerCamel action/PascalCase controller 只是源码名映射，不能反推稳定业务 ID。

## 7. 后续 JS 写集合、共享依赖与唯一组装 owner

下表是 **下一阶段 proposed 工作集合**，不是本次写入授权。新路径明确为 proposed，未在当前树创建。路径相对 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc`。

| 文件/范围 | 处理 | owner 与接口 |
|---|---|---|
| `generators/route-definition/model.mjs`（proposed） | 新建 `RoutesFragmentModel` 对等数据；`routeLines/selfType/dependencies/noteIds` 默认与 §2 相同 | route-definition；不是完整 content 模型 |
| `generators/route-definition/build-models.mjs`（proposed） | 新建 `buildRoutesFragment(controllerModels)`；空返回 null；B1–B7 逐项实现；纯输入→模型 | route-definition；不读文件、不产生 ledger |
| `generators/route-definition/templates/routes.mjs`（proposed） | 新建纯片段 template，固定 T1–T6；header/notice作为 writer 输入，不混成 HTTP class | route-definition |
| `generators/route-definition/assembly.mjs`（proposed） | 将片段、controller 源映射及明确 profile 交给公共写模型，单次汇总 conf/routes | **唯一物理 `conf/routes` assembly owner：route-definition assembly**；其他制品只提供 route contribution/controller surface，不各自发同路径 entry |
| `generators/scala-cqrs-play-service/render-service.mjs` / `render-service-pages.mjs` | split routeRows/rows/aliases；typed controller、service port、page response、loader/lifecycle 各归其 owner；禁止 whole-file 覆盖 | 两个文件当前复合，先由集成者作不改输出的切分；之后 route-definition 只拿被分配 route adapter |
| `generators/scala-cqrs-play-service/generate.mjs` | 将正式 producer 接到同一 route assembly，与 controller/bootstrap 同批 | 集成者；不由多个 artifact 同时写 registry |
| `generators/scala-cqrs-play-application-v1/templates/http.mjs` / `build-models.mjs` / `render.mjs` | 抽出 routesTemplate；controller model 降低到共同端点面；停止 add 整文件 routes，改贡献；components 的依赖保留 | http-controller/应用装配 owner 与集成者协调；不能把原命令/page/readiness删掉后称复刻 |
| `src/core/merge.mjs` / `src/core/apply-preflight.mjs` / `src/core/generate.mjs` | shared marker 支持与 noLedger/ownership/update 冲突解决；保留 final-byte checks 和唯一 writer | shared-writer 集成者独占；新增 marker schema/API 未批准，D3/D5 |
| `generators/scala-cqrs-domain-kernel-v1/entry.mjs` | 不能再给 shared routes 注入整文件 header；段来源位置在最终装配之后计算 | shared provenance owner 独占，不影响其他 family 整文件策略 |
| `lib/products/generate-cli.mjs` / 已选 producer `generator.json` / 相关 project 配置 | 在现有正式 producer 内接入；没有提出可立即使用的新 `--artifact` CLI | 注册、产品版本、输入选型由集成者确认 D1/D6；本次不写 catalog/中央分区 |
| legacy `_deprecated/scala-cqrs-es-api/*` | 默认不改、不复活；若现役消费者被明确迁移，旧 E301 段按下述迁移程序处理 | 不是本包任意统一模板的授权 |

依赖为 `shared-layout-types`、`http-controller`、`command-endpoint-dsl`、`application-service`、`application-bootstrap`、`shared-marker-writer`、`shared-provenance`。复用 family 已导入的 `resolveName/resolveNameSet/resolveArtifactPath`，但先由公共 owner 校准到 BC package/name 合同；不能在 route template 另建 safeName/kebab resolver。

### 7.1 proposed 公共输入/输出约定

- 输入：**http-controller 提供**按输出顺序排列的完整 controller models；必要字段为已解析 `selfType`、endpoints 的 method/path/actionName/parameters/gate/skip。规范化 Option 表达（null 对 None，显式 present 对 Some）须保留空字符串语义，不能 JS truthiness 代替 isDefined。
- Builder 输出：`RoutesFragmentModel | null`；raw routeLines 字符串是明确保留的例外。源映射另以 `line ordinal → controller/endpoint source + parameter source` sidecar 给 assembly，不改变公共模型的默认 dependencies/noteIds。
- assembly 输出：每目标恰一个 conf/routes 写计划（或零个），携带 marker 身份、缺失文件策略、header/notice、最终内容和最终 byte spans。**这些是要求，不是当前 core 已接受的字段名**；D5 冻结 API 前不能构造臆测参数通过现有 writer。
- formal/pages/family 中没有等价 gate 或 controller 方法签名的端点，报告具体缺失并阻断该映射；不默认为 anonymous/tenant，不硬造通用 reply。

### 7.2 旧输出退役和引用迁移

1. 先固定原 route 清单、controller/action 对应、所有 aliases/static routes、认证/CSRF/JSON 错误面与生产源 SHA，再生成独占新目标；不动银行 current。
2. `BankServiceLoader.scala` 中不能仅去掉 Router.from 而留下失联 HTTP。http-controller、bootstrap、配置 `play.application.loader`、反向路由和 hand-written composition 调用方需要同一批有明确接口的迁移清单。
3. 对既有 E301 与新 codegen:controllers 两块，必须先裁定每条 route 的 owner 及重复 URL 优先级；不全局删 E301，因为里面还有 views/vector/state，后者非本族全权拥有。标记外手写行永远不能当旧产物删除。
4. 当前 family 整文件 header/ledger ownership 与新 shared 段 ownership 是不同类别，不能保留旧整文件 ownership 冒称迁移完成；通过公共 core 显式冲突/迁移流程处理，不能手工改 ledger/anchors。
5. 最终排版、插入位置、marker 合并确定后重算 fingerprint/mappings；旧位置回锚失效必须显示迁移，不复用旧 offsets，不新增作者 `@knowledge` 字段。

## 8. 后续验收输入、公开命令形状与副作用

**下面全部未运行；本次是文档阶段，不执行它们。** 不存在已批准 routes-only CLI；现有入口生成其 producer 的整个依赖闭包，不能声称只写 conf/routes。首先需要 D1/D6 的同语义 fixture 适配，且以下示意绝对 fixture 路径均为未来独占目录，并非已存在文件。

### 8.1 fixture 清单和对账内容

拟建 `docs/codegen-parity/fixtures/route-definition/`（proposed，未写）：

- `controller-surface`：§3.2 同一 ordered model 加两个 controller；覆盖空集合、Some 空字符串、skip 空字符串、无参数、多参数、泛型/tuple signature、FieldDef 默认被忽略。
- `pagination-boundary`：GET/POST 同名 page/pageSize、path `:page` / `:pageSize` 的子串边界、非 Int 类型；raw 与 D2 认可目标分别锁定。
- `shared-file`：目标不存在、无 markers 且有尾空白、成对 markers 且前后手写路由、半标记、重复/逆序、多生成器块、CRLF、相同输入二次生成。原 writer first-pair 行为与 proposed 严格拒绝不可混签。
- `formal-pages`：14 API+14 aliases+2 static 路由只作银行来源保真清单；实施时优先用非银行最小 semantic fixture 同构覆盖，不能从当前文件反编造缺失 domain/controller 合同。
- `family-closure`：command POST、query/page/readiness 三条、source mappings；明确 family API 到 ControllerModel 的适配，不拿任意 v0.3 canonical 送 formal 产品入口。

预期文件集按 fixture/profile：`<out>/conf/routes`，对应 `<out>/app/controllers/<Controller>.scala` 和受影响 bootstrap/config 引用；routes 内容 gate 是完整文件而不是只 grep 一行。suppressed 用例要对账文件不存在/既有文件原封不动；N>0 时核 method/path/action/参数/default/行序/markers/header/末 LF、marker 外保存和同文件其他块。

### 8.2 exact scoped CLI 形状

JS formal service 的请求式入口（真实 flags 见 [generateProductCli:66–88][PRODUCT-CLI]）：

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /Users/zhongdj/Workspaces/route-definition-acceptance/fixtures/formal-service/request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-play-service \
  --out /Users/zhongdj/Workspaces/route-definition-acceptance/out/js-formal \
  --options-json /Users/zhongdj/Workspaces/route-definition-acceptance/fixtures/formal-service/options.json \
  --plan
```

- plan 内存编译产品并生成计划；只读 request/options/manifest、明确本地 runtime repository 下 saga-core JAR 的 pin，以及存在 pipelines 时 Monarch pins，校验 externalSourceRoots 不与目标重叠；没有 artifact-only 参数。
- 获另行批准后去掉 `--plan` 才走 apply；除所有 producer 源文件，还写 `<out>/truthsrc.ledger.json` 与 `<out>/anchors.json`。本入口没有 project graph/.truthsrc 项目证据输出，不能与下一个命令混称。没有授权下载、发布 runtime；pin 缺失就停止。

Family 必须用 captured implementations 的项目入口（真实 flags/调用见 [projectCli:159–225][PROJECT]），不是把上一条 generator 目录换掉：

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-project \
  --project /Users/zhongdj/Workspaces/route-definition-acceptance/fixtures/family/truthsrc.project.json \
  --out /Users/zhongdj/Workspaces/route-definition-acceptance/out/js-family \
  --plan
```

- project 配置必须显式选 `scala-cqrs-play-application-v1` 及其真实十产品闭包。capture 会读取/validate/roundtrip/compile 作者树、derive/compile products、捕获声明的手写实现、toolEvidence 扫描工具源码；**即使 plan 也不是本阶段允许的纯文件读取命令**。
- plan 不打开写 graph store，不 apply 目标；但 roundtrip 临时文件和 implementation verifier 的传递副作用需按 D6 再核。已读 [implementation-evidence:28–46][X-IMPL] 只证明它调用 `verifyHandwrittenSources` 并对 SHA，而不是 Scala ABI/业务运行验证。
- 去掉 plan 会打开 projectGraphFile 所指定的 SQLite 存储并 publish anchors，写全部生成物、`.truthsrc/{canonical,request,compiled,inputs}.json`、ledger、anchors；graph 不一定位于新 out，必须登记解析后的绝对位置及 sidecar。`--update` 前先解决 D5，不能借新目录名忽略旁路写面。

legacy 接线辨别用的命令形状（不是建议恢复历史生成器）：

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate \
  --in /Users/zhongdj/Workspaces/route-definition-acceptance/fixtures/legacy/canonical.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/_deprecated/scala-cqrs-es-api \
  --out /Users/zhongdj/Workspaces/route-definition-acceptance/out/js-legacy \
  --options-json /Users/zhongdj/Workspaces/route-definition-acceptance/fixtures/legacy/options.json \
  --plan
```

plan 调两次 generator 比较 entries 并列路径，**不检查目标 marker merge**；apply 才经过 preflight。去掉 plan 会写该旧 producer 的所有 controller/support 文件、ledger、anchors，缺少既有 conf/routes 时该 entry 为 MISSING。不传伪造的 concern 名，不声称这个 plan 能验证 shared writer。

BC 的传统入口需在 BC 工作目录、另行批准的隔离环境中运行；目前没有已证实能够让该 fixture 同语义贯通的 system 注册项，故使用真实存在的 **输入槽形状**，实际 fixture adapter 是否能产生接口 metadata 是 D6 阻断项，不冒充 runnable 命令：

```bash
sbt \
  -Dcodegen.systemFile=/Users/zhongdj/Workspaces/route-definition-acceptance/fixtures/bc/canonical.json \
  -Dcodegen.systemBindings=/Users/zhongdj/Workspaces/route-definition-acceptance/fixtures/bc/bindings.json \
  -Dcodegen.targetDir=/Users/zhongdj/Workspaces/route-definition-acceptance/out/bc-single \
  -Dcodegen.ledger=/Users/zhongdj/Workspaces/route-definition-acceptance/out/bc-single/truthsrc.ledger.json \
  -Dcodegen.multiProject=false \
  "runMain net.imadz.codegen.CodegenMain"
```

- `systemFile/systemBindings` 配对、与 `codegen.system` 互斥；不用 Examples 默认，也不加 `semanticProductsFile` 切走传统链。multi 变体显式改 `multiProject=true` 和独立 `bc-multi` target/ledger，不凭目录名推断。
- 真实入口先 prepare/harness，再 mkdir/copy scaffold、可能搬 scaffold 文件、全传统链写入、知识 release manifest、formal-semantics 附件及显式 ledger；不是 routes-only。sbt/JVM 编译缓存、版本获取/子进程、依赖解析/潜在下载须独立核准，当前不执行。固定 [CodegenMain:192–249][MAIN] 的当前顺序优先于过时的“harness 前复制 scaffold”叙述。

### 8.3 验收门（均未运行）

1. 对同语义 fixture 的 raw-scala、approved-target、actual-js **完整文件集合**作内容对账；模板手推样例和不同业务 structural contrast 单列。允许差异必须逐项批准，不能压平所有空白。
2. 逐 construct/RHS 按 M1–M4/B1–B8/T1–T7 和 writer 分支回填实际证据；controller action 必须真实存在、签名和 Play binder 匹配；`conf/routes` 解析/反向路由与 router 注入需要真实受影响闭包编译，未来由集成者批末共用一次，不猜一个已存在的 test suite。
3. typed HTTP action、authorization、CSRF、path decoding、query/body、readiness、page aliases、static 路由优先级及 parser 错误的保真必须有真实接口/行为验证；不以 routes 字符串相等替代。失败不得变 200，不新增事件发布或持久化。
4. layout、PascalCase/lowerCamel、正常 imports、没有第四层、没有无意义 dispatch 包装；routes 自身没有 Scala imports 和 CC，不能报其 CC=0 当整体目标。JS 普通函数/相邻 Scala 方法 CC 目标 ≤5，6–10 逐方法说明，>10 重构或逐方法批准；当前 `not-measured`，不用 String/Any dispatcher 刷分。
5. 两次相同输入生成稳定；单一路由参数/源字段变更的局部 diff 和最终回锚（含手写前缀/CRLF）可解释；no gate 用例不抹掉已存在块。所有 fingerprint/offset 针对最终合并字节。
6. 生成/内容对账初始调度预算 5 分钟、受影响闭包编译/行为 15 分钟；是未来调度预算，不是测量。本项失败只阻断该接口/变体，不阻断独立 artifact 的文档保存，不启动银行全量验收。

## 9. 具体未决项与停止点

| ID | 待裁定的问题 | 当前已知与停止点 |
|---|---|---|
| D1 输入/端点桥接 | formal 的 endpointId/port/audience/csrf/page aliases 与 BC gate/skip/controller action/typed parameters 如何逐项对应？family 的 command/query/page/readiness 是否进入同一门模型，还是保留显式 profile contribution？ | 未有同语义 adapter；不把 audience 当 gate，不把 String 参数当 domain nominal。http-controller 与本族共同批准完整方法/path/source 表前，不产银行目标路由 |
| D2 raw 默认/路径债务 | 是否保留 raw `contains(':name')` 子串判断和不检查 method 的 page/pageSize 默认，还是批准 token-aware + GET-only 的有限偏差？自定义类型 binder/default 的声明面在哪？ | 先锁 raw 行为，不无声修复；扩展不能伪造缺失 metadata 或猜默认值 |
| D3 writer 语义 | 新标记何时用 BC create/append notice，是否保留 trim 尾白、first-pair 重复块语义？是否明确采用更严格重复标记拒绝与 CRLF 保真？CodegenMain 头文案是否逐字保留？ | 新目标无整文件 fingerprint、块外手写保护为确定要求；与 raw/legacy 的差异须单列批准，不能复用固定 E301 函数直接写 |
| D4 旧块与共享文件归属 | E301 的 DSL/view/vector/state 哪些迁入 codegen:controllers，哪些保留？同 URL 两块重叠和顺序如何处理？全 endpoint 消失仍保持旧块还是显式 retirement？ | raw None 是“不碰现存”，不是“删除所有旧行”；不能把整个 E301 或手写路由删掉。新 conf/routes 唯一 assembly owner 已指定，具体 contributions 待签 |
| D5 writer/ownership/provenance API | noLedger 的 shared 段如何支持 project --update ownership？如何携带新 marker/new-file/header 策略，并将 line sidecar 定位到 final merged bytes？family 旧整文件 ownership 如何显式迁移？ | 当前 checkRoutes 只认 E301，noLedger 无 ownership，applicationSourceEntry 恒整文件 header；公共 owner 冻结 API/拒绝规则前，模板 plus 仅结构规格，不可接入 |
| D6 同输入 fixture 与执行供应 | 哪种传统 CodegenMain 输入适配真实提供 interfaces.controllers？最小 controller/typed gate/Play 2.8.18 binder 闭包、family source capture 的传递副作用、graph 绝对路径、构建缓存/子进程/离线 pins 如何固定？ | 没有新同输入输出和 curated route golden；CLI 仅已证实参数形状。先核受影响 closure 和旁路写面，不执行全仓测试/生成来碰运气 |

## 10. 额外当前源清单（未复制、未修改）

以下源不在 baseline index，本次为查实入口/merge/副作用而读取。链接是**可变工作副本**，不可替代固定基线；SHA 明确标识本次实读字节。完整路径与 SHA 同存 details 的 extraSources/sourceFingerprints。

| 当前源绝对路径 | bytes | SHA-256 | 已读范围/用途 |
|---|---:|---|---|
| `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js` | 18463 | `5ef06f3e322b01ad5f9c472e923dc677182d771abce55023fb1e52d15398e970` | 1–240、259–308；公开 CLI dispatcher，不是进程参数快照 |
| `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/lib/execution/generate-cli.mjs` | 2407 | `b9f33e711730f1f6fcac9311e20ec3333531353ca65e588c4058bd106012fe66` | 全文；legacy flags/plan 解析 |
| `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/src/core/merge.mjs` | 7963 | `de9c0c65841f7abda8d359f7e932066511bce10cbb3ea6df588e21c8e37e93eb` | 全文；E301-only marker 合并 |
| `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/src/core/apply-preflight.mjs` | 11730 | `1d8af5eafee837a04b5bb2c3d08482db5fee0ada9f1814e6a62a69f1e7f70db4` | 全文；incoming marker/ownership/absent-target 分支 |
| `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/lib/project/implementation-evidence.mjs` | 2794 | `da6889091818f35bac0e3a62e04a862ee4268fef6f7b94cad6fed80cb637aa76` | 全文；project capture 的 source verifier 边界 |

本项交付结论仅为：源码内容规格已保存，**D1–D6 待裁定，formal 标记 counterpart 与 curated route reference 缺项明确**。没有运行结果、复杂度分数、实现完成或 parity/behavior PASS 声明。

[M]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/infrastructure/api/RoutesFragmentModel.scala#L1-L19
[B]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/api/RoutesBuilder.scala#L1-L59
[T]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/RoutesTemplate.scala#L1-L34
[W]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/MarkerBlockWriter.scala#L1-L70
[AM]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L5-L47
[TS]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4-L85
[CM]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/infrastructure/api/ControllerModel.scala#L6-L42
[CQRS]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala
[DISPATCH]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L203-L215
[INTERFACE]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L1029-L1064
[ROUTE-WRITER]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L1070-L1087
[STATE-DISPATCH]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L1004-L1027
[MAIN]: ../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L62-L249
[STUB]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/ControllerTemplate.scala#L72-L83
[LAYOUT]: ../baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala#L113-L115
[FORMAL]: ../baseline/js/generators/scala-cqrs-play-service/render-service.mjs#L1-L205
[PAGES]: ../baseline/js/generators/scala-cqrs-play-service/render-service-pages.mjs#L20-L133
[FORMAL-GEN]: ../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L1-L71
[BANK]: ../baseline/actual-js/app/example/bankwealth/service/BankServiceLoader.scala#L1-L129
[PRODUCT-CLI]: ../baseline/js/lib/products/generate-cli.mjs#L45-L145
[PROJECT]: ../baseline/js/lib/project/cli.mjs#L91-L225
[CORE]: ../baseline/js/src/core/generate.mjs#L23-L268
[ML]: ../baseline/js/src/core/manifest.mjs#L8-L27
[LEGACY]: ../baseline/js/generators/_deprecated/scala-cqrs-es-api/generate.mjs#L45-L267
[LMAN]: ../baseline/js/generators/_deprecated/scala-cqrs-es-api/generator.json#L1-L24
[LB]: ../baseline/js/generators/_deprecated/scala-cqrs-es-api/builders/controller.mjs#L212-L259
[LBA]: ../baseline/js/generators/_deprecated/scala-cqrs-es-api/builders/controller.mjs#L471-L513
[LV]: ../baseline/js/generators/_deprecated/scala-cqrs-es-api/templates/views.mjs#L64-L91
[LVS]: ../baseline/js/generators/_deprecated/scala-cqrs-es-api/templates/vector_search.mjs#L12-L75
[LS]: ../baseline/js/generators/_deprecated/scala-cqrs-es-api/templates/state_api.mjs#L13-L21
[FM]: ../baseline/js/generators/scala-cqrs-play-application-v1/build-models.mjs#L1-L116
[FG]: ../baseline/js/generators/scala-cqrs-play-application-v1/generate.mjs#L1-L42
[FR]: ../baseline/js/generators/scala-cqrs-play-application-v1/render.mjs#L16-L46
[FT]: ../baseline/js/generators/scala-cqrs-play-application-v1/templates/http.mjs#L101-L111
[FL]: ../baseline/js/generators/scala-cqrs-play-application-v1/templates/loader.mjs#L59
[ENTRY]: ../baseline/js/generators/scala-cqrs-domain-kernel-v1/entry.mjs#L28-L64
[X-MERGE]: ../../../src/core/merge.mjs#L99-L135
[X-PREFLIGHT]: ../../../src/core/apply-preflight.mjs#L150-L205
[X-IMPL]: ../../../lib/project/implementation-evidence.mjs#L28-L46
