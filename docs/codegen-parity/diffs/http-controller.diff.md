# http-controller：传统 Controller MBT 与 JS HTTP 边界内容规格

## 1. 身份、范围与证据等级

- Artifact id / detail group：`http-controller`，传统清单第 35 族。文档状态：**decision-required**。存在可比实现，但正式银行链没有传统 `ControllerModel → ControllerBuilder → ControllerTemplate` 的等价接线；不是“JS 完全没有 controller”。
- 本文只固定内容规格，不修改生产代码、作者树、生成应用、catalog、ledger 或 anchor；未运行生成、测试、类型检查、编译或服务。普通方法 CC 目标 ≤5，当前 **not-measured**。
- 固定 HEAD：BC `cc335eb1e0d0fae17bf092fd61b126040196ea70`；JS `bf104e16ab82ef39d7fa416d0997907d18a815ad`。准确字节以 [baseline/index.json](../baseline/index.json) 的 source/snapshot/bytes/SHA-256 为准，而非仅以 HEAD 代替工作树身份。
- 遵循 [AUTHORING-CONTRACT](../AUTHORING-CONTRACT.md)、[layout-and-style](../layout-and-style.md) 和 [批准计划](../../../.rounds/prettify-generated-code-resume-20261115-cgr9lzlk/APPROVED-PLAN.md)。只写本 diff 与 `details/http-controller.json`；此前 15 份 diff 不在写集合。
- 初次检查两份指定文件均不存在，写前再次确认不存在。未读取额外的当前生产源码；`extraSources=[]`。根/本仓指引与本次规格文档不是额外生产源码。

### 1.1 四份材料严格分开

| 材料 | 本次可取得内容 | 可以断言 / 不可以断言 |
|---|---|---|
| `raw-scala` | 完整固定 [Model][M]、[Builder][B]、[Template][T] 及其实际调用链 | 本文逐字段、规则、construct/RHS 记账；**没有新鲜同输入的原始 Scala 生成文件**，不能冒充已取得 raw 输出字节 |
| `approved-target` | raw 的内容合同叠加已批准的三层布局、命名、imports/MBT/类型化边界要求；未决语义列 D01–D12 | 已批准的是规则；尚无经裁定的完整目标文件。本文代码差分是局部目标规格，不是运行结果 |
| `actual-js` | 固定的银行 [BankServiceLoader.scala][BANK-L] 与 [BankServiceService.scala][BANK-S] | 是现存产物，不是本次生成；与 Scala 输入不同，只作**结构性对照，非同输入字节比较** |
| `curated reference` | [Endpoint.scala][C-ENDPOINT]、[ApiError.scala][C-ERROR]、[CommandDsl.scala][C-DSL] 等人工/历史适配参考 | `baseline/index.json` 中 `baseline/curated-scala/` 下以 `Controller.scala` 结尾的条目查询结果为空；没有本族人工 controller 金样。参考的包名/API 不可冒充当前消费 JAR |

主要完整字节指纹（本次只读 SHA/bytes 对账与 index 相符，不是生成验证）：

| 固定文件 | bytes | SHA-256 |
|---|---:|---|
| [ControllerModel.scala][M] | 11765 | `299bf59238a3a160777201d594ebf7eba310d635399ac7b281280afd7e1a3f93` |
| [ControllerBuilder.scala][B] | 39684 | `37fdb4322e229c55aa26540e8e8308cfe682c0af7f0bdea46ae5a1e91fdab430` |
| [ControllerTemplate.scala][T] | 35969 | `cce8e32e0139d8d447812498dad894130d10cbffe9d38df179be687dbd73e123` |
| [BankServiceLoader.scala][BANK-L] | 10379 | `12428f65ad1190f911102bd8bdf448aa6fd4c3017a9eeea301cab658a8eac3a0` |
| [BankServiceService.scala][BANK-S] | 11451 | `a7e1c39c8211cc197b11d23b7b7d0faecbcb9a4b409d6bd30283b1a64c30e297` |

以上链接提供完整源码；以下不是链接替代内容，而是其逐构造合同。M/B/T 行号均指固定副本，未把注释的“逐字节一致/已验证”转述成本次结论。

### 1.2 调度、基数与物理路径

[CodegenMain L176–253](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L176-L253) 中 `semanticProductsFile` 分支提前返回；本族基准是其余输入经 `prepare → generate → runCommon` 的传统链，不是 `template/products`。`runCommon` 在 [L203–215](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L203-L215) 依次生成 domain/application/infrastructure/interface，之后另发 aggregate-state-controller。

[generateInterfaceLayer L1029–1063](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L1029-L1063)：按 `interfaces.controllers` 原顺序逐个 `ControllerBuilder.build(meta, ctx)`，随后 `ControllerTemplate.generate(model)`、`writeArtifact(... ArtifactAttribution("controller", meta.name, "aggregate", Nil))`。返回的 model 集合另供 RoutesBuilder；CommandDslBuilder 也另属一族。

- 正常每个 ControllerMetadata **1 个 Scala 文件**；端点、Req/payload companion 不另拆文件。没有 controller metadata 为 0 文件；生成异常可能已写前序文件，不承诺事务回滚。
- `ctx.typeResolver.controller(meta.name)` 经 [TypeResolverDSL L434–442](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L434-L442) 调 `getBaseName → controllerName`。后者为 `baseName + "Controller"`（[NamingConventions L560](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L560)）。前者按有序技术后缀列表剥除、剥空返回最后非空值（[L183–224](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L183-L224)），不直接等于 `${agg}ApiController`。
- [PackageLayout L113–115](../baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala#L113-L115)：controller 包是业务根之外的 **`controllers`**。single profile 的 root 是 `<target>/app`，multi profile 的 `controller` kind 被分到 root，仍为 **`<target>/app/controllers/<resolvedControllerName>.scala`**；不是 `modules/root/src/main/scala`（[writer L331–378](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L331-L378)）。这是确定的本族目标路径公式，不新增 `<base>.api/.web/.service` 第四层。
- `writeArtifact` 还解析 dependencies、记录 noteIds/morphisms、执行 scope 守卫（L379–405）并处理指纹/写盘；模板本身不写文件。本次未触发上述写面。

| variant id | 实际条件与产物内容 | 基数 / 本次 exercised |
|---|---|---|
| `legacy-stub` | `dslFlags.aggHasDsl=false`，走 `generateLegacyController`，**全部 endpoints** 渲染 stub | 每 controller 1 文件；未生成 |
| `dsl-command-path` | 至少一个 non-skip gate；tenant 档命令含聚合 identity 的 Id 参数，Path；typed ask | 同文件的方法；未生成 |
| `dsl-command-factory` | active tenant/global command 无 pathKey，Factory；可有 empty-body / Id / Instant guard | 同文件；未生成 |
| `dsl-conflict` | command errorPayloads 非空，单聚合单投影约定；查重后 ask | 同文件并追加 payload VO；未生成 |
| `dsl-flow-anonymous` | anonymous + ServesUseCase + requestBody；一次 Flow 委托 | 同文件；未生成 |
| `dsl-view` | tenant/global + ServesView；list/item/singleKey 规则 | 同文件并按需放 helper；未生成 |
| `mixed` | DSL controller 中夹 `gate=None` | DSL 骨架内保留旧 stub 方法；未生成 |
| `skip` | VO-List / read-only command 被 Builder 标 skip | **只有 DSL 路径过滤 skip**；全 skip 导致 aggHasDsl=false 后反走 stub，D05，不能声称所有 skip 都 suppressed |
| `rejected` | 悬空 gate/command/view/repository、多聚合、多投影、匿名读或匿名命令直发、非匿名 Flow 等 | 抛异常；无成功产物保证 |

## 2. Model：全部字段、子型、默认值和依赖

### 2.1 ControllerModel（[M L6–20](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/infrastructure/api/ControllerModel.scala#L6-L20)）

下表顺序即主构造器顺序；无默认处是必填，JS 不得把整个文件 `content` 当模型。

| 顺序 / 字段 | 精确类型、默认值 | 使用位置 / JS 对应缺口 |
|---|---|---|
| 1 `override val selfType` | `TypeRef`，必填 | package/class/path；formal service 用 pkg/name 字符串混在 renderer；family 有 names.controller，可适配 |
| 2 `basePath` | `String`，必填 | B 传 meta.basePath；T 不消费。保留给路由等消费者，不得误加到每个方法 path |
| 3 `injectedServices` | `Seq[FieldDef]`，必填 | 有序 constructor/injection imports；formal Composition/Bindings 不能无损充当这个序列 |
| 4 `endpoints` | `Seq[EndpointModel]`，必填 | 保留 metadata 顺序；legacy actions/reqVos 是预展开的不同模型 |
| 5 `override val dependencies` | `Set[TypeRef]`，必填 | import/ledger；T DSL 并非简单全量输出该 Set，见 §4 |
| 6 `dslFlags` | `DslFlags = DslFlags()` | aggregate DSL 分支与 empty Reads；后两 flags T 没有直接读 |
| 7 `modulePkg` | `Option[String] = None` | DSL 模块 auth 包；B 总传 Some(ctx.basePackage)，T None 回退 net.imadz |
| 8 `override val noteIds` | `Seq[String] = Nil` | writer 文件级知识关联，不在 T 发 `@knowledge` |

继承 [ArtifactModel L5–47](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L5-L47)：`fqn = selfType.packageName + "." + selfType.name`；`registerTo(registry)=registry.register(this)`；`morphisms: Seq[MappingMorphism]=Nil` 未 override；noteIds override 如上。无额外嵌套 artifact 注册、模板 annotation 或 member-anchor 魔法。

### 2.2 EndpointModel（[M L22–42](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/infrastructure/api/ControllerModel.scala#L22-L42)）

| 顺序 | 字段 | 精确类型 / 默认 | T 消费 |
|---:|---|---|---|
| 1 | method | `String`，必填 | stub 注释；非 DSL 路由逻辑不在此 T |
| 2 | path | `String`，必填 | stub 注释；没有自动解析 `:id` |
| 3 | actionName | `String`，必填 | 方法名，B 原样透传 |
| 4 | parameters | `Seq[FieldDef]`，必填 | stub `.typeRef.name`；DSL `.signature`；Path 寻址取首参名 |
| 5 | serviceMethod | `String`，必填 | 仅 stub 的 TODO / 注释，不实际调用 |
| 6 | returnType | `TypeRef`，必填 | 依赖；T 输出仍固定 Action，不直接输出该返回类型 |
| 7 | gate | `Option[String]=None` | 是否 active；具体门名经 B 定 tier，但 T 使用固定 tenant/global/anonymous 根 |
| 8 | gateKind | `Option[GateKind]=None` | 端点形态分派 |
| 9 | serves | `Option[ServesTarget]=None` | Command / UseCase / View |
| 10 | reqVo | `Option[ReqVo]=None` | write 类型、Req 声明、Flow 参数、查重键 |
| 11 | errorPayloads | `Seq[ErrorPayloadVo]=Nil` | 首项用于 conflict；全体用于 VO 声明 |
| 12 | idGuard | `Option[GuardSpec]=None` | 外层 IdGuard.parse |
| 13 | instantGuard | `Option[GuardSpec]=None` | 内层 InstantGuard.parse |
| 14 | ctorArgs | `Seq[CtorArgRef]=Nil` | 命令构造实参，原参数顺序 |
| 15 | addressing | `Option[Addressing]=None` | Path / Factory；T 未声明时 entityExpr 也回退 generatedId |
| 16 | readModel | `Option[ViewReadModel]=None` | read helpers / repository / DTO import |
| 17 | skip | `Option[String]=None` | DSL 过滤；legacy 不过滤 |

### 2.3 全部关联词表（[M L48–141](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/infrastructure/api/ControllerModel.scala#L48-L141)）

| 类型 | 完整形状、顺序与默认 |
|---|---|
| `sealed trait GateKind` + companion | `case object Anonymous`、`Global`、`Tenant`，分别承载 (false,false)/(true,false)/(true,true) |
| `sealed trait ServesTarget` + companion | `final case class Command(command: String)`；`UseCase(useCase: String, flowMethod: Option[String]=None, flowArgs: Seq[String]=Nil)`；`View(viewKey: String)` |
| `final case class ReqVo` | `reqName: String, reqFields: Seq[FieldDef], hasEmptyBody: Boolean, explicit: Boolean=false` |
| `final case class ErrorPayloadVo` | `errorCode: String, payloadName: String, payloadFields: Seq[(String,String)], conflictMessage: Option[String]=None`；第二 tuple 成员是表达式字符串，不是已类型化 AST |
| `final case class GuardSpec` | `pairs: Seq[(String,String)], binds: Seq[String]`，均必填；pairs 第二成员是取值表达式源码槽 |
| `sealed trait CtorArgRef` | 抽象 `def paramName: String` |
| CtorArgRef 的全部 `final case class` | `FromPathId(paramName: String, bindName: String)`；`FromSessionUser(paramName: String, gateKind: GateKind)`；`FromSessionTenant(paramName: String)`；`FromGeneratedId(paramName: String)`；`FromGuard(paramName: String, bindName: String)`；`FromInstantGuard(paramName: String, bindName: String)`；`FromBody(paramName: String)`；`FromBodyOptional(paramName: String)`；均无默认 |
| `sealed trait Addressing` + companion | `case object Path`、`Factory`；没有 body business key / deterministic composite key 变体 |
| `sealed trait ViewForm` + companion | `case object ListView`、`ItemView` |
| `final case class ViewReadModel` | `viewKey: String, constName: String, rowType: TypeRef, repository: FieldDef, form: ViewForm, singleKey: Boolean`，均必填 |
| `final case class DslFlags` | `aggHasDsl: Boolean=false, aggHasEmptyBody: Boolean=false, needsParkRepo: Boolean=false, needsRegisterFlow: Boolean=false` |

[TypeSystem L4–85](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4-L85) 的共享依赖必须保持：

- `TypeRef(name: String, packageName: String, typeParams: Seq[TypeRef]=Nil)`；fqn 空包直接 name；signature 对 `Tuple`+数字且非空参数输出 `(T1, T2)`，其他泛型 `Name[T1, T2]`，普通为 name。collectAllDependencies 包括自身和递归类型参数；shouldImport 排除空包/同包/scala/java.lang。
- `FieldDef(name: String, typeRef: TypeRef, defaultValue: Option[String]=None, comment: Option[String]=None, noteId: Option[String]=None, description: String="")`。本 B 的 FieldDef 构造只传前两项，余项默认；本 T 不发 FieldDef default/comment/noteId/description。不得推称 Req 自动生成 `=None`。
- `TypeRef` 常量 String/Int/Long/Boolean/Unit/Double 空包，BigDecimal 在 scala.math；List/Option/Map 是空包带泛型。字段默认字符串槽是共享类型的实际债务，不扩散成整份源码槽。

**四层差异**：formal 的 service endpoints 只有 port/inputType/outputType/audience/csrf 等接口信息，没有上述 gates/serves/ctor/guard/readModel；family 的 api/commands/resource/query/composition 是有限业务的另一模型，不是此模型的别名；legacy 的 sig/reqFields/ctorArgsDsl/entityExprRaw/dvExpr/guard pairs 已是源码文本。实现须保留各字段来源，不能删掉无法映射的字段后宣称 MBT 对齐。

## 3. Builder：每个规则、分支、解析与依赖

B 全文 891 行已分段读取。下表按 B 源码次序列出函数；注释与实码不同处以实码为准。JS 对应与目标落点见 §5/§8，不能把这一表直接当已完成移植。

| B 位置 / 规则 | 实际输入 → 决策 / RHS / 失败分支 |
|---|---|
| [L28–83 build](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/api/ControllerBuilder.scala#L28-L83) | 先读取 `pkg=ctx.layout.infrastructure.api.root`（局部未再使用），selfType 由 resolver；buildEndpoints；ownerNoteIds 从 endpoints.serves 的 Command 反查聚合，distinctBy name、取 noteId、distinct；readModel 反查投影 noteIds；构建 metadata services 与 dependencies；算 flags；仅 aggHasDsl=true backfill；ControllerModel 位置参数前六项，modulePkg=Some(ctx.basePackage)，noteIds=(owner++view).distinct。解析不到知识号留空；不能给 gate=None 凭空补聚合号 |
| [L87–115 buildEndpoints](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/api/ControllerBuilder.scala#L87-L115) | 对 meta.endpoints map；六旧字段分别 epMeta.method/path/actionName、buildEndpointParameters、logic.intent、resolveResponseType；DSL 的全部十一字段逐项复制，不重排 |
| [L124–182 DslAxis/buildDslAxis](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/api/ControllerBuilder.scala#L124-L182) | 内部 private final DslAxis 顺序同 Endpoint DSL 字段，全 Option None / Seq Nil；gate None 直接全默认，无 serves/req 解析。Some gate 先 tierOf，再 toServesTarget/error payload；Command 找不到抛 IllegalArgumentException；找到 deriveCommandAxis；View deriveViewAxis（该分支不把上面 errorPayloads 填回）；其余 UseCase/缺 serves 填 gate/kind/serves/显式 requestBody/errorPayloads |
| [L188–224 tierOf/resolveCommand](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/api/ControllerBuilder.scala#L188-L224) | 从 registry.resolveByName[GateDefinition] 取两布尔三档；(false,true) IllegalStateException；未注册 H053 IllegalArgumentException。命令反查所有 AggregateRootMetadata，各取首个同名 command，再 headOption；没有聚合限定 disambiguation |
| [L226–275 deriveCommandAxis](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/api/ControllerBuilder.scala#L226-L275) | skip 有值只携 gate/kind/serves/errorPayloads/skip，不推导 Req/guards/ctor/addressing。否则 tenant 才查参数：Id 且 name equalsIgnoreCase aggregate.identifier.name，作为 pathKey；有 key Path，否则 Factory。先 strictFields；requestBody 优先显式 Req，否则 derive；idGuard/instantGuard/ctorArgs 同时派生，skip=None |
| [L288–342 deriveViewAxis](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/api/ControllerBuilder.scala#L288-L342) | ViewKeyDefinition 缺失 H052；Anonymous 拒绝；Item 且复合键且非 Tenant 拒绝；ProjectionRepositoryMetadata ref 缺失拒绝；repo TypeRef=projectionRepository(repo.name)；baseName=getBaseName(repo.name)；rowType=projectionDtoType(baseName, `${baseName}Table`, application.projection.repository.root)。constName 由 viewKey `split('-').filter(nonEmpty)` 每段首字母大写、其余原样；repository 字段名仅类型名首字符小写；返回 gate/kind/View/readModel，不创建 Req |
| [L347–374 viewNoteIdsFor/viewFormOf](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/api/ControllerBuilder.scala#L347-L374) | 按 readModel.repository.typeRef.name 找同名且属于 ProjectionRepositoryMetadata 的 DomainDrivenMetadata，再找首个 repositoryRef.targetName 相同 ProjectionMetadata，取 noteId.toSeq；解不到空。View 签名仅精确顺序 `(page:Int,pageSize:Int)` 或 `(entityId:String)`，其余抛错；optional 等附加元数据不参与该匹配 |
| [L378–392 skipOf/isVoListParam](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/api/ControllerBuilder.scala#L378-L392) | 优先任一 `CustomType("List",_,_)` 参数；只有参数恰 `Seq(StringType)` 的 List 不 skip。其他 List（包括 List[Id]）skip；其次 command.isReadOnly skip；否则 None。与 legacy VO whitelist/查询 Reply 检测不同 |
| [L400–447 strictFields/Req](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/api/ControllerBuilder.scala#L400-L447) | 保序 filterNot：triggeredBy；tenant 档 tenantId；global 档同 identity 名且 Id；pathKey。空 strictFields → ReqVo("play.api.libs.json.JsObject",Nil,true,false)；非空 → command.name+"Req"，FieldDef(scalaId(name),reqTypeOf)，hasEmptyBody=false。explicit CustomType 只保 typeName；其他 DataType 用 getClass.getSimpleName；两者 reqFields=Nil、empty=false、explicit=true（原 package/泛型未保留） |
| [L451–474 reqTypeOf/jsonTypeOf](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/api/ControllerBuilder.scala#L451-L474) | String/Int/Long/Double/Boolean/BigDecimal 对应 TypeRef；CustomType 名为 Id 或包含 Instant → String；非空 List 递归首类型参数；其余 CustomType 保 name/package 丢 typeParams；MetaRef 用 targetName 空包；其余抛不支持。parameter.optional 再套 Option(mapped)，不产生 defaultValue |
| [L478–521 idGuardOf/instantGuardOf](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/api/ControllerBuilder.scala#L478-L521) | Id 候选只 exact CustomType Id；排除 tenant tenantId（除 pathKey）及 global identity；pairs=(参数名, pathKey ? "id" : `req.${scalaId(name)}`)，binds=cidNameOf；空 None。Instant 从 strictFields 按名称包含 Instant 筛选，pairs=req.field，binds=instantBindOf。B 注释说 Instant 外层，但 T 实码是 **Id 外、Instant 内** |
| [L524–548 ctorArgsOf](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/api/ControllerBuilder.scala#L524-L548) | 对完整 command.parameters 保序、首命中：pathKey→FromPathId；triggeredBy→FromSessionUser(kind)；tenant tenantId→FromSessionTenant（不检验其实际类型）；global identity Id→FromGeneratedId；Id→FromGuard；Instant→FromInstantGuard；optional→FromBodyOptional；其余 FromBody。optional Id/Instant 优先命中 guard，不能推称已支持 Option guard |
| [L553–604 serves/error](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/api/ControllerBuilder.scala#L553-L604) | ServesCommand/ServesView 原名；ServesUseCase 可解析才取 flowMethod/flowArgs，解不到 None/Nil。ErrorPayloadVo 保 errorCode/payloadFields；名为 underscore 分词、每词首大写余小写；conflictMessage 遍历全系统 invariant conditions，首个 errorCode 相同取 logic.intent，无命中 None。该 intent 后来进入字符串 literal，需要转义审定 |
| [L608–615 flags](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/api/ControllerBuilder.scala#L608-L615) | aggHasDsl=存在 gate 且 skip 空；aggHasEmptyBody=non-skip req.hasEmptyBody；needsParkRepo=任一 errorPayloads 非空（含 skip）；needsRegisterFlow=任一 UseCase（含 skip）。T 不直接使用后两个 flag，backfill 重新筛 active |
| [L625–685 backfill](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/api/ControllerBuilder.scala#L625-L685) | active=有 gate 且无 skip；命令属主 distinct，0→无 repository，1→FieldDef("repository",aggregateRepository)，>1 抛错。parkViewRepositoryOf；viewRepo 按 typeRef.name distinctBy；Flow useCase distinct 后 `<lowerFirst>Flow: <useCase>Flow`，位于 application.root。删 metadata services 中与 repo/park/view **短类型名**相同者。最终顺序 repository、parkRepo、viewRepoDefs、flowServices、remainingServices；park 与 view 列表间并没有统一 distinct。protocolDeps 用 getBaseName(agg.name)+Protocol，application.aggregates.root；deps 是旧集并新 repo/park/view/flow/protocol（没有删除被替换 service 的旧 deps） |
| [L691–731 parkViewRepositoryOf](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/api/ControllerBuilder.scala#L691-L731) | errorPayload active command 属主 distinct；空 None，否则首个；若不在 commandAggregates 抛错。effectiveAggregates 含 agg.name 的 projection 必须恰一个且 repositoryRef 存在，0/多/缺 ref 均抛错；按 ref.targetName resolver 构 TypeRef（不再 resolve 仓库元数据），字段首字母小写 |
| [L736–771 词法 helpers](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/api/ControllerBuilder.scala#L736-L771) | SCALA_KEYWORDS 具体为 `type class def val var object trait package import case match else then yield while return throw new extends with final sealed abstract lazy override implicit private protected this super try catch finally for do`。scalaId 命中加反引号；bindNameOf 命中加 Param；cidNameOf 去 `[iI]d$` 后加 Cid，剥空则保原名再加 Cid；instantBindOf=bindNameOf+Instant；Id overload 检查 exact CustomType("Id",_,_)；Instant 名 contains。词表与集中 NamingConventions 不完全相同，D04 |
| [L775–809 普通参数/注入](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/api/ControllerBuilder.scala#L775-L809) | Endpoint parameters 每项 FieldDef(p.name,resolve(p.parameterType))，忽略 optional/default/描述；响应 resolve(epMeta.responseType)；meta.dependencies 每项 resolve 并类型名首字符小写为字段名；空类型名无特设分支，head 会失败 |
| [L813–890 dependencies](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/api/ControllerBuilder.scala#L813-L890) | 基础 framework key 共八个：ControllerComponents/BaseController/Action/AnyContent/Request/Json/ExecutionContext/Future，按 Map 索引取值（缺 key 不回退）。并 parameters、returnType、injectedServices 的 collectAllDependencies.toSet；filterNot 空白 package，或 name 为 Any/String/Int/Long/Boolean/Unit，或 package 为 scala/java.lang。未递归收 reqVo/guards/payload/read row 的类型；DSL imports 再选择子集，不能认定通用依赖集完整 |

以上包含原始 Builder 的代码字符串债务：serviceMethod=logic.intent、payload 来源表达式/冲突文案、GuardSpec 的 `req.field`、显式 Req 名；不存在“Builder 完全不产生源码文本”的事实。目标按命名槽保留/类型化，不新增整端点 `logicCode` 逃避建模。

## 4. Template：按最终文件顺序的 construct/RHS 账

### 4.1 全文件骨架与 imports（[T L20–223](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/ControllerTemplate.scala#L20-L223)）

| 输出顺序 / construct | raw-scala 的完整规则 | approved-target 处理 |
|---|---|---|
| 0 分支 | `generate = if(model.dslFlags.aggHasDsl) generateDslController else generateLegacyController` | 保留显式变体；全 skip 退回 stub 缺陷 D05 单列 |
| 1 package | `packageDecl(model.selfType.packageName).code`；共享 helper 返回 `package $packageName` | 固定顶层 controllers |
| 2 legacy imports | dependencies 每个用 `packageName.name`，先 sorted，再追加 javax.inject._ / play.api.mvc._ / play.api.libs.json._ / scala.concurrent.ExecutionContext | 随后 **ImportDeclaration.code 再整体 sorted**，不是源码拼接次序；不去重，基础 Future 由 dependencies 供应。目标是否保留重复见 D04 |
| 2 DSL imports | 见下一表的全部条件；末尾 `.distinct`；共享 imports 最后整体 sorted | 无歧义简名；无额外通配遮盖缺依赖。空 import 是 raw 缺陷，不允许凭注释漏记 |
| 3 类注释 | `/**` + ` * <name>: API Controller for <name.replace("Controller", "")>` + ` */` | 名称来源保持；replace 删除全部匹配字串，不仅尾缀 |
| 4 类声明 | legacy：`class Name @Inject() (injectedServices..., val cc: ControllerComponents)(implicit ec: ExecutionContext) extends BaseController`；injections 内用 `.typeRef.name`，逗号换行四空格。DSL：先 `api: Endpoint`，再 services，末 `val cc`，一行 join；类前 `@Singleton` | 长参数按行排版；不擅加 final、泛型、父构造参数或 auxiliary constructor。legacy 无 services 时留下 leading comma，是 D04 |
| 5 公共成员 | `override def controllerComponents: ControllerComponents = cc` | 不改为另一个无依据的父类/依赖获取方式 |
| 6 DSL timeout | `private implicit val timeout: akka.util.Timeout = akka.util.Timeout(5.seconds)` | 只定义 ask timeout；不能代替 actor 生命周期/交付保证 |
| 7 DSL emptyBodyReads | flag 为真时带原注释，`private implicit val emptyBodyReads: play.api.libs.json.Reads[play.api.libs.json.JsObject] = play.api.libs.json.Reads(_ => play.api.libs.json.JsSuccess(play.api.libs.json.Json.obj()))` | 任何已解析的合法 JSON 值变空对象，不是“只接受 {}”；业务适用范围须由输入确定 |
| 8 read helpers | 无 active read 不发；否则依序 pageGuard、tenantList、globalList、tenantItem、globalItem、compositeItem，按需要裁剪 | 全文 §4.3，不能删安全/错误分支以降 CC |
| 9 endpoints | legacy 全 endpoints；DSL 只 skip.isEmpty；各块两换行。DSL 中无 gateKind → stub；anonymous UseCase → Flow；任何 kind Command → command renderer（内部拒 Anonymous）；任何 kind View → view renderer；余组合抛 IllegalArgumentException | 顺序不改为 command 名排序；不以泛型 Execute/string dispatcher 替代方法 |
| 10 闭类 | DSL 在 endpointTexts 后 `}`；无 VO 追加一个换行，有 VO 两换行后 VO 块再一个换行 | 最终 bytes 确定后再定位 anchor |
| 11 Req 声明循环 | 全 endpoints 中 non-skip reqVo，去 explicit 和 empty-body，distinctBy reqName 保首次；按 reqFields 顺序 `name: typeRef.signature`；`final case class Req(...)` + 顶层 `object Req { implicit val reads: play.api.libs.json.Reads[Req] = play.api.libs.json.Json.reads }` | 没有 `=None`、嵌套自定义 Reads、字段注释；同名不同形状当前静默首胜，目标需拒绝或明确合并 D04 |
| 12 payload 声明循环 | non-skip 全 errorPayloads，distinctBy payloadName；**每字段都 String**，名字未 scalaId 转义；`final case class Payload(...)` + 顶层 companion `implicit val format: play.api.libs.json.OFormat[Payload] = play.api.libs.json.Json.format` | 不可合并不同名义 VO；payload 实际类型缺声明是 D07 |

共享 [CodeGenerationDSL L13–22、109–110](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L13-L22)：`ImportDeclaration.code = imports.sorted.map("import " + _).mkString("\n")`。**没有过滤空字符串**。T.groupImport 全 false 对 net.imadz 返回 `""`，非 net.imadz 返回 `${pkg}.`，所以“空组不发射”的注释不等于最后不输出 `import `。global-only 或 read-only 等变体必须作为反例 fixture。

DSL import 输入明细（[T L134–212](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/ControllerTemplate.scala#L134-L212)）：

| 来源/组 | 判断与精确成员 |
|---|---|
| 基础 | `javax.inject.{Inject, Singleton}` |
| protocol | dependencies 中 name.endsWith("Protocol") → `d.fqn + "._"`，Set 来源；最终字典序 |
| services | 每 injectedServices.typeRef，通过 shouldImport(currentPkg) → fqn |
| read row | active reads 的 rowType.packageName distinct，排除等于 currentPkg，**导入 Table owner**，不是行 class fqn |
| stub | endpoints 中 gate 空且 skip 空：参数和 returnType 递归依赖，shouldImport 后 fqn |
| `net.imadz.common.auth` | ApiError：hasCommandAsk 或 hasRead；Endpoint：恒真；CommandRoleMap/ViewKeys 恒 false；单成员无 braces、多成员保持列表次序 |
| `<modulePkg或net.imadz>.infrastructure.auth` | CommandRoleMap：active tenant command 或 active tenant read；ViewKeys：hasRead；其余 false |
| `net.imadz.infrastructure.api` | IdGuard/InstantGuard：相应 guard 存在；OkReceipt：Command 或 Flow；ViewListDto：list；ViewItem：single-key item |
| JSON | 有 composite item：`play.api.libs.json.{JsObject, JsValue, Json, OWrites}`；否则 `{JsValue, Json}` |
| 其他 | `play.api.mvc._`、`scala.concurrent.ExecutionContext`、`scala.concurrent.Future`、`scala.concurrent.duration._` |

Controller 不发自身 companion/type alias/var/lazy/self-type/额外继承/上下界/方法重载。read helpers 有 `[V]` 及第二个 implicit 参数列表；composite helper 有 local implicit val。Req/payload companion 在类外，不能为了“聚合文件”挪到类内破坏宏可见性。

### 4.2 endpoint 全 body、构造实参和调用顺序

| construct / T 锚点 | raw RHS / body 的精确内容与顺序 |
|---|---|
| [stub L73–84](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/ControllerTemplate.scala#L73-L84) | 注释 method/path；`def actionName(params): Action[AnyContent] = Action.async { implicit request =>`；先 `// TODO: Implement business logic calling serviceMethod` 与 `// serviceMethod(...)`，后 `Future.successful(Ok(Json.obj("message" -> "Not implemented yet")))`。**没有实际业务调用**；不是成功实现、无 MANUAL marker，不能用此返回验收业务 |
| [write L384–441](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/ControllerTemplate.scala#L384-L441) | serves 必须提取 command，reqVo 必须有 reqName，否则抛错；generatedId 仅 addressing==Factory。IdGuard 包 InstantGuard 包 askBody；有 errorPayloads 再在最外面 dedup。Tenant 声明 `api.tenant.write[Req](CommandRoleMap.ofCommand("Cmd"): _*)`，handler `(ts, req)`；Global `api.global.write[Req]()`，handler `(gc, req)`；Anonymous 抛错。方法返回 FQN `play.api.mvc.Action[play.api.mvc.AnyContent]`，接 `.apply[OkReceipt] { ... }`；注释按档位并可追加 `＋409 查重前置 typed payload` |
| [dedup L450–499](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/ControllerTemplate.scala#L450-L499) | parkRepoFieldName 取 injectedServices 首个 packageName.endsWith("application.projection.repository")；缺失抛错。payload=errorPayloads.head；keyFields=reqFields 排除 `name==Option && packageName.isEmpty`，空则抛错。谓词依序：每严格字段 `v.field == req.field`，首个 FromPathId 的 `v.paramName.toString != entityExpr`，Tenant 的 `v.tenantId == ts.tenantId`，用 ` && ` 拼。`repo.findAll().flatMap { all => val conflict=all.find(predicate); if(conflict.isDefined) Future.successful(Left(ApiError.conflict(code,message,Payload(payloadFields.map(_._2)顺序实参)))) else handler }`。message 默认 code；没有 soft-delete 条件、没有事务唯一性保证；多 payload 只有首个参与查重，不能称全处理 |
| [Flow L505–535](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/ControllerTemplate.scala#L505-L535) | 缺 UseCase 或 requestBody Req 抛错；flowService=useCase 首字母小写+Flow；flowMethod=声明或 `register`；参数优先 flowArgs.map(`body.${scalaIdOf(a)}`)，其次 Req fields 的 `body.name`，再整体 `body`。`api.anonymous.write[Req].apply[OkReceipt] { (req, body) => flowService.flowMethod(args) }`。应用 Flow 的真实方法体不在 controller，不得生成假成功占位 |
| [ask L541–557](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/ControllerTemplate.scala#L541-L557) | Factory 时在 guard 内先 `val generatedId = java.util.UUID.randomUUID().toString`；`repository.entityRef(entityExpr).ask { (replyTo: akka.actor.typed.ActorRef[CmdReply]) => Cmd(ctorArgsOf(e), replyTo) }.map { reply => reply.error.fold[Either[ApiError, OkReceipt]](Right(OkReceipt(entityExpr, play.api.libs.json.JsNull)))(e => Left(ApiError.badRequest(e.code,e.message))) }`。CmdReply 是拼名假设，非从 replyToType 解析；零 ctorArgs 会生成 `Cmd(, replyTo)`，D03/D04 |
| [ctor L560–575](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/ControllerTemplate.scala#L560-L575) | FromPathId/FromGuard/FromInstantGuard → bind；SessionUser Tenant→ts.userId、Global→gc.userId、Anonymous→抛错；SessionTenant→`net.imadz.common.Id.of(ts.tenantId)`；GeneratedId→`net.imadz.common.Id.of(generatedId)`；Body→req.escapedName；BodyOptional→`req.escapedName.getOrElse("")`。逗号空格连接、末尾再追加 replyTo。不能把此默认空串写成所有 Option 的正确业务值 |
| [guard L580–605](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/ControllerTemplate.scala#L580-L605) | Some guard → `Guard.parse("name" -> value, ... ) match { case Right(Seq(binds...)) => body; case Left(err) => Future.successful(Left(err)) }`，内部非空行加两空格；None 原 body；没有 Right 其他长度兜底。pairs/binds 按序对应。Path entityExpr=parameters.headOption.name.getOrElse("id")，其余 generatedId；注意 idGuard 的路径表达式固定 "id"，首参不叫 id 时可能不一致 |
| [signature/empty L608–619](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/ControllerTemplate.scala#L608-L619) | 无参数方法无 `()`；有参数用原名和 typeRef.signature 括号连接。emptyBodyReads initializer 见 §4.1 |
| [Req/payload/keywords L623–668](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/ControllerTemplate.scala#L623-L668) | 两组尾部循环见 §4.1；T 自持 SCALA_KEYWORDS，完全与 B 私有列表相同；scalaIdOf 命中才反引号。不能假定它会修复已传入的所有名称或转义文案/source expressions |

**副作用顺序**：Endpoint 认证/授权/JSON →（若声明）投影查重 → Id parse → Instant parse →（Factory）发 UUID → entityRef.ask → reply.error fold。查重早于 guard，且只是投影查询；不据此证明强一致唯一约束。HTTP 层不持久化事件，不应把 `Effect.persist` 搬到这里。

### 4.3 读端点及 helper 的完整结构

[T L253–378](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/ControllerTemplate.scala#L253-L378) 发 helper 的选择表与正文如下。下面仅把模板中的 Scala 字符串展开为可读代码，内容是 **raw**，不是已生成/已验证输出。

```scala
/** 分页参数门卫（契约保留：page>=1, 1<=pageSize<=200） */
private def pageGuard(page: Int, pageSize: Int): Option[ApiError] =
  if (page < 1 || pageSize < 1 || pageSize > 200) Some(ApiError(400, "PARAM_INVALID", "page>=1, 1<=pageSize<=200 required")) else None

/** 租户作用域 list（R1 隔离：tenantOf(v)==ts.tenantId 过滤——Ctx 化，.get 灭绝） */
private def tenantList[V](vk: String, page: Int, pageSize: Int, all: Future[List[V]], tenantOf: V => String)(implicit w: play.api.libs.json.Writes[V]): play.api.mvc.Action[play.api.mvc.AnyContent] =
  api.tenant.read(CommandRoleMap.of(vk): _*).apply[ViewListDto[V]] { ts =>
    pageGuard(page, pageSize).fold[Future[Either[ApiError, ViewListDto[V]]]](
      all.map { list =>
        val scoped = list.filter(v => tenantOf(v) == ts.tenantId)
        Right(ViewListDto(vk, scoped.size, page, pageSize, scoped.sortBy(_.toString).slice((page - 1) * pageSize, page * pageSize)))
      }
    )(e => Future.successful(Left(e)))
  }

/** 全局身份视图 list（User 族，Altair 拍板——跨租户可见不过滤；scope=global 已控） */
private def globalList[V](vk: String, page: Int, pageSize: Int, all: Future[List[V]])(implicit w: play.api.libs.json.Writes[V]): play.api.mvc.Action[play.api.mvc.AnyContent] =
  api.global.read().apply[ViewListDto[V]] { _ =>
    pageGuard(page, pageSize).fold[Future[Either[ApiError, ViewListDto[V]]]](
      all.map { list =>
        Right(ViewListDto(vk, list.size, page, pageSize, list.sortBy(_.toString).slice((page - 1) * pageSize, page * pageSize)))
      }
    )(e => Future.successful(Left(e)))
  }

/** 租户作用域 item（单键视图） */
private def tenantItem[V](vk: String, entityId: String, fetch: Future[Option[V]], tenantOf: V => String)(implicit w: play.api.libs.json.Writes[V]): play.api.mvc.Action[play.api.mvc.AnyContent] =
  api.tenant.read(CommandRoleMap.of(vk): _*).apply[ViewItem[V]] { ts =>
    fetch.map(dOpt => dOpt.filter(v => tenantOf(v) == ts.tenantId)
      .map(d => Right(ViewItem(d)))
      .getOrElse(Left(ApiError(404, "VIEW_ITEM_NOT_FOUND", s"view=${vk} id=${entityId}")))
  }

/** 全局身份视图 item（单键，不过滤） */
private def globalItem[V](vk: String, entityId: String, fetch: Future[Option[V]])(implicit w: play.api.libs.json.Writes[V]): play.api.mvc.Action[play.api.mvc.AnyContent] =
  api.global.read().apply[ViewItem[V]] { _ =>
    fetch.map(dOpt => dOpt.map(d => Right(ViewItem(d)))
      .getOrElse(Left(ApiError(404, "VIEW_ITEM_NOT_FOUND", s"view=${vk} id=${entityId}")))
  }

/** 复合键视图 item（F2 刻意契约）：by-id 语义化 400，不回退随机挂 */
private def compositeItem(vk: String): play.api.mvc.Action[play.api.mvc.AnyContent] = {
  implicit val jsObjSelf: OWrites[JsObject] = identity
  api.tenant.read(CommandRoleMap.of(vk): _*).apply[JsObject] { _ =>
    Future.successful(Left(ApiError.badRequest("PARAM_INVALID", "复合键视图需列表查询后取行")))
  }
}
```

- helper 选择：active read 中 tenant list→tenantList；非 tenant list→globalList；tenant single item→tenantItem；非 tenant single item→globalItem；复合 item→compositeItem；只有 list 需要 pageGuard。B 已拒 anonymous 和非 tenant composite，但 T 保有独立错误防线。
- `renderViewReadEndpoint` 缺 readModel 抛错；rowShort=`rowType.packageName.split('.').last + "." + rowType.name`；viewRef=`ViewKeys.constName`；repoField=readModel.repository.name。
- List Tenant：`tenantList[Table.Row](viewRef,page,pageSize,repo.findAll(),_.tenantId)`；List 其余：globalList 同参去 tenantOf；Item Tenant single：`tenantItem[Table.Row](viewRef,entityId,repo.findByIdentity(entityId),_.tenantId)`；其余 single：globalItem；composite：`compositeItem(viewRef)`，不查 repository。
- 注释逐端点含 actionName、ServesView(viewKey)、tenant/global scope 与 list/item/composite 的描述；方法 `def actionName${sigOf(e)}: play.api.mvc.Action[play.api.mvc.AnyContent] = helperCall`，无新重载。
- `all`/`fetch` 是 **按值 Future 参数**，调用 helper 前就求值 `repo.findAll/findByIdentity`；不能声称验证 page/身份成功后才发查询。list 全量内存过滤、toString 排序、Int 乘法 slice；DB 分页、稳定业务排序、超大 page 的溢出处理均是未决变更 D08，不偷改原算术语义。

## 5. JS 的真实三条路线与四层差距

### 5.1 formal 银行链：HTTP 藏在 service loader，不能只移动整个类

证据链：

1. [registeredProductProducer L92–101](../baseline/js/lib/products/generate-cli.mjs#L92-L101) 显式注册 `scala-cqrs-play-service`；[generate.mjs L59–70](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L59-L70) 的 `play-service-dsl` 调 renderService、readside、test-support、configuration。
2. [render-service L5–31](../baseline/js/generators/scala-cqrs-play-service/render-service.mjs#L5-L31)：必须一个 selected service artifact，service 选项只有 artifact/externalSourceRoots；映射 endpoint.port.ref.id 为名字，查实现；每 explicit port 仅一个 HTTP endpoint，声明 JDBC projections 时此 renderer 拒绝。
3. [L32–94](../baseline/js/generators/scala-cqrs-play-service/render-service.mjs#L32-L94) 在一个字符串内定义 service contract；[L95–163](../baseline/js/generators/scala-cqrs-play-service/render-service.mjs#L95-L163) 构造 regex 路由与 loader。`hasPages` 走 [renderPageLoader 全文][JS-PAGES]，不是无页模板。
4. [L164–204](../baseline/js/generators/scala-cqrs-play-service/render-service.mjs#L164-L204) 同时产 ApplicationBootstrap、service.conf、application.conf、Service.scala 和 Loader.scala entries。该复合文件跨 HTTP、应用端口、生命周期、配置，须单 owner 拆分。

现存银行是 hasPages 形态。以下固定完整文件逐 construct 归属，未把 DTO/port 绑定推断为等价的聚合 Command。

| actual-js 位置 | 全部 construct / RHS 或循环规则 | 目标职责与 disposition |
|---|---|---|
| [Loader L1–20][BANK-L] | generated header；package example.bankwealth.service；Play/json/mvc/Router/concurrency/NonFatal/BankServiceService._ imports；BankServiceLoader.load 转发 infrastructure.bootstrap.ApplicationBootstrap；BankServiceComponents(context,composition) extends BuiltInComponentsFromContext；implicit ec=executionContext；lazy httpFilters=Seq.empty；stopHook Future(composition.close()) | Loader/Components/stopHook 属 infrastructure.bootstrap，**不属 controller 文件**；imports 随使用者重算，保持关闭所有权 |
| Loader L21–46 | pageRenderer 初始化 requireInstalled 然后 pages.get；private final Response(status,value)、Route(method,pattern,parameters,audience,csrf,endpointId,page,run)；staticHeaders 三项 no-store/nosniff/no-referrer，htmlHeaders 加原 CSP；unavailableHtml 503 HTML；failure 映射 error.status/code；response 按 page 渲染 JSON/HTML，NonFatal→unavailableHtml；staticPage script/shell 分支及 503 fallback | HTTP/page adapter 分离，不能在 application 继续引 Play；page 行为交页面 owner，不能丢掉 CSP/错误映射/初始化先后 |
| Loader L47–55 | invoke[I,O]：reads(input)；JsSuccess→endpoint.run→Right 200 writes / Left failure；JsError→InvalidRequest | 与 BC gate→ask 不是同一种业务接口；提炼明确 endpoint 方法的 HTTP decoding/adaptation，不硬改为 CmdReply |
| Loader L56–71 | 14 个 Route，准确全集见下一表 | method/path/audience/csrf/endpointId 保持；方法名由绑定 resolver 转 lowerCamel，route 不改业务身份 |
| Loader L72–88 | pageActions 按 0–13 索引 copy apiActions，pattern 改 /bank/v1 同资源路径、page=true；actions=apiActions++pageActions | 路由 owner 管单一 assembly，页面别名无权删除；禁靠索引重排掩盖语义 |
| Loader L89–119 | parser API tolerantText(65536)，page 用 BodyParser 包装同 parser 并转换 parser error；actionBuilder.async；Future.successful(())→composition.ready→authenticate→验证 id 非空/roles 非空且含 audience→条件 csrf（false 为 Future.successful(true)）；失败 403 csrf-denied；构造 path 参数、GET JsNull 否则 decodeBody；失败映射，成功构造 `{path,query数组,body}`，row.run(Principal(...),input)；None 401，其他 403；NonFatal→Unavailable；最后 response | 正式边界的全部前置与结果转换必须有承接者；从 raw 直接复制三档 Endpoint 会丢 csrf、ready 和现有 wire 合同，D01/D02 |
| Loader L120–129 | router 优先 GET /bank/v1 shell、GET /bank/v1/client-script；其余 actions.exists→find.get→pattern.findFirstMatchIn.get→action | 路由登记归 route-definition；不把这一 String/JsValue dispatcher 当目标低 CC 的替代机制 |
| [Service L1–22][BANK-S] | package/imports；BankServiceService object；Principal private[service](id,roles)；Authority.authenticate/ csrf；Failure(status,code)；InvalidRequest 400、NotAuthenticated 401、NotAuthorized 403、MissingResource 404、RequestConflict 409、Unavailable 503；Outcome[A]=Either[Failure,A] | 移除重复 Service 后缀须更新调用方；纯结果/授权值与 RequestHeader adapter 分开，不整个 object 搬 application |
| Service L23–43 | decodeBody：Jackson JsonFactory 开 STRICT_DUPLICATE_DETECTION；parser token loop，depth/roots 初始化 0，struct start/end 增减，require depth 0..64 且 roots==1，结束 require 完整单值；Right(Json.parse(text))；finally parser.close；NonFatal→InvalidRequest | HTTP codec owner 保留重复键、嵌套/单根拒绝与释放，不能用 Json.parse 一行替换洗掉安全行为 |
| Service L44–61 | Endpoint[I,O](implementation,version,Reads[I],Writes[O],run:(Principal,I)=>Future[Outcome[O]])；Bindings 14 项，类型全集保留于完整固定文件 | 应用 port/HTTP codec 边界拆分；当前 PascalCase 字段是真实命名差距，不改 port ref 身份 |
| Service L62–79 | PageRenderer implementation/version/shell/script/render(endpointId,status,value)；Composition extends AutoCloseable，authority/bindings/ready/pages=None；Factory implementation/version/create(ApplicationLoader.Context) | 页面/装配 owner 承接，不纳入 ControllerModel 字段以扩大职责 |
| Service L80–99 | requireInstalled：非 null composition/authority/bindings；14 项逐个校验非空、implementation FQN、version `bank-v1-service-1`、reads/writes/run 非空；installedPages=pages，再检 `example.bankwealth.web.BankBrowserPages` 与 version `1` | pin 身份不能因包名整理静默改变；外置实现迁移另批授权，校验不可删 |

银行 14 项登记（Loader L57–70；Bindings 类型见 Service L47–60；每个 page alias 同位置转换 `/api/v1`→`/bank/v1`）：

| endpointId / binding | method/path | audience / csrf |
|---|---|---|
| account-me / BankAccountQuery | GET /api/v1/accounts/me | customer / false |
| cash-submit / BankCashSubmitPort | POST /api/v1/cash-requests | customer / true |
| cash-original / BankCashOriginalQuery | GET /api/v1/cash-requests/:clientRequestId | customer / false |
| order-detail / BankOrderQuery | GET /api/v1/orders/:orderId | customer / false |
| sip-create / BankSipCreatePort | POST /api/v1/sip-plans | customer / true |
| sip-list / BankSipPlansQuery | GET /api/v1/sip-plans | customer / false |
| sip-detail / BankSipPlanQuery | GET /api/v1/sip-plans/:planId | customer / false |
| sip-revise / BankSipRevisePort | POST /api/v1/sip-plans/:planId/revisions | customer / true |
| sip-pause / BankSipPausePort | POST /api/v1/sip-plans/:planId/pause | customer / true |
| sip-resume / BankSipResumePort | POST /api/v1/sip-plans/:planId/resume | customer / true |
| sip-occurrences / BankSipOccurrencesQuery | GET /api/v1/sip-plans/:planId/occurrences | customer / false |
| operations-pending / BankPendingOperationsQuery | GET /api/v1/operations/pending | operator / false |
| operation-reconcile / BankReconcileExistingPort | POST /api/v1/operations/:operationId/reconcile | operator / true |
| business-tick / BankBusinessTickPort | POST /api/v1/business-clock/tick | operator / true |

### 5.2 legacy：相似 renderer 真实存在，但不是 formal 银行路由

- [run-all L1296–1318](../baseline/js/generators/run-all.mjs#L1296-L1318) 确认 `api-dsl` 面；sagaBinding 时明确 skip。[L1661–1755](../baseline/js/generators/run-all.mjs#L1661-L1755) 的 apiBuildAggregateController 从 canonical commands/scalaSigPD 建 IR，聚合和命令按 codepoint 排序，写 spec、`execSync(node api-dsl/emit.mjs spec ctrlDir)`、清临时 routes.fragment、聚合 routeLines。与 BC metadata 原顺序不同；不能把该脚本的历史 golden 注释当本次证据。
- [api-dsl/emit.mjs 全文][JS-LEGACY-T] 是可从 run-all 调到的文本/文件发射器；`mode=viewkeys` 是另一制品，正常写 `<Agg>ApiController.scala` 及条件 routes.fragment。formal `registeredProductProducer` 没有注册它。
- [`_deprecated/scala-cqrs-es-api/generate.mjs` L59–200](../baseline/js/generators/_deprecated/scala-cqrs-es-api/generate.mjs#L59-L200) 仍导出 generate：自身 protocolModel/renderProtocol→parseProtocol→buildAggregateController→renderControllerFile，输出 app/controllers。legacy core [plan L23–42](../baseline/js/src/core/generate.mjs#L23-L42) 是动态 import generate.mjs、检查 manifest 再双次生成比较；因此该代码有旧接口候选可调用性，不是“文件夹叫 deprecated 所以不可达”。但它不在 formal 注册表，也未在本次执行旧入口；不主张银行消费它。

完整旧 [Builder][JS-OLD-B] 已读；完整旧 [Controller assembly Template][JS-OLD-T] 已读。其数据/规则差异不是纯排版：

| JS-old B 位置 | 实际规则 / 与 Scala 原始差异 |
|---|---|
| L19–39 parseProtocol | regex 读 case class 参数并按逗号、冒号拆，去反引号和默认值，识别 Option；去 replyTo；reply=CmdReply；reply error 字段检测、缺省 true；entityTypeKey regex 或 agg。不是从类型化 Metadata 出发 |
| L44–50 strictFields | 去 triggeredBy、tenant tenantId、global 同名 Id、path key；identity 是 `${agg.toLowerCase()}id` 命名规则，不是 Aggregate.identifier |
| L62–184 LANE_A_ADDRESSING | ModelCatalog/Relation/ContextRelation/KnowledgePatch/Concept/Note/OrganizationMember/FieldModelDefinition/ReadModelDefinition/CemEdge/ValueObjectDefinition/UseCaseDefinition/TruthSourceProvenance/RoleCommandBinding/FsmDefinition/WorkTicket 的命令表；r2/r3 body key、httpKey 合成 Req key、r2c 复合确定 UUID。完整各项在固定源码；Scala Addressing 只有 Path/Factory，不能用它覆盖并改变已有 identity |
| L187–205 常量 | VO whitelist：SubmitKnowledgePatch、EvaluateDoR、SubmitDoRFindings、ProposeFsmDefinition、UpdateFsmElements、CreateWorkTicket、UpdateWorkTicketItems、DeclareReadModel、PatchAggregateStatus、DeclareValueObject、DeclareFieldModel；bare scalar String/Id/Boolean/Int/Long/Double/BigDecimal/Instant/UUID；Flow 表 DoR.RequestDoR→requestDoRFlow.request、bodyFields workshopId |
| L212–259 buildCommandModel 前段 | List[String]/List[Id] 不属 VO-list，其余看 whitelist；tierOf；tenant 同名 Id 为 path；lane 表优先，未配置用 SYSTEM_GENERATED Id 为 r1；r2c 键数不齐拒绝；多 List 无键标 multiTarget；query reply=false skip；SYSTEM_QUERIED 不入 body；sig/POST routeLine 在 Builder 已拼字符串 |
| L263–299 Flow | scoped Flow 校验 bodyFields 数量、返回 Flow IR；RegisterUser 特判 userId→username，flowService=registerUserFlow，method=register；BC 用 ServesUseCase，不能将 RegisterUser 硬编码移植为银行行为 |
| L302–350 Req/ctor | reqFieldsSrc 可加 synthetic httpKey；optional `=None`；EstablishConcept kind/description 特判 getOrElse；tenantId 按实际 Id/String 决定转换；Option[Id] map(Id.of)，其余含 Id/Instant 的 Option 拒绝；List[Id] map(Id.of)；未知 SYSTEM_GENERATED 非 Id 拒绝；SYSTEM_QUERIED 用 q.field；普通字段直传。BC FromBodyOptional 统一空串明显不同 |
| L351–410 address/guards/result | 优先 r2Key、r2c、httpKey、path、generatedId；r2c 用 nameUUIDFromBytes、组件用 ` + ":" + ` 串接及 UTF-8，Id/String/session 分支；r1 不入 IdGuard，httpKey 入，r2c Id 补齐；依赖列表收 VO，result 带 sig/routeLine/ctorArgsDsl/entityExprRaw/dvExpr/guards/flags/laneAAddressing/enrich 代码槽。不得重写复合键摘要格式 |
| L415–468 view/topo | DecisionView 后缀过滤、key 排序，repoParam、fields、tenant/singleKey/global、mongo/mysql 轴；topoSortVos 从可选字段 metadata 剥 List/Option/Set/Seq，排序 DFS、环跳过、无 callback 字母序。这不是 BC ViewKeyDefinition 查表模型 |
| L471–514 aggregate assembly | actions/reqVos/skipped/routes/valuesImports；flags 由具体命令名或 Flow 表决定；每 command skip 则 continue；Req 收 reads，Establish 增 ConceptNameTaken(existingConceptId:String) format；topo 赋各 VO 的 voItemTypes；返回 ctrlName/flags/dslCount。T 里嵌套 Reads 已退役，所以不能认为 topo 仍产生嵌套 Reads |

legacy emitter 的输出顺序：header→package controllers→固定 imports→注释/@Singleton/class(api条件,repository,Park/Register/DoR/Enricher条件,cc)(implicit ec)→controllerComponents→timeout→条件 emptyBodyReads→actions→闭类→Req/payload companions。`renderDslEndpoint` 优先 flowDelegate，其次 establish409，最后标准 tier；askBody 可外包 enricher.flatMap；Id 在 Instant 外；409 固定 `(contextId,name)`、self exclusion、removedAt.isEmpty、可选 tenant 条件；Flow 有 scoped 与 anonymous；源里 OkReceipt 多处硬编码 `net.imadz.metarch.infrastructure.api`。这比 BC 的形状有扩展、有偏离，不能称“1:1 restoration”即已满足本任务。

### 5.3 family：新的独立 MBT 可达，但不是银行 formal service 的实现

[generate-cli L45–64、92–101](../baseline/js/lib/products/generate-cli.mjs#L45-L64) 注册 `scala-cqrs-play-application-v1`，且要求 `generate-project` 的 captured implementations，连 generate-products --plan 也拒绝。其 [generate L10–40](../baseline/js/generators/scala-cqrs-play-application-v1/generate.mjs#L10-L40) 检查完整 fixed manifest、live capture context、精确 ten-product closure，再 buildModels→render。

- [build-models 全文][F-M] 的顺序：detach/shape 检查→由 declaration 重编 api/composition 并 equal→复用 persistence models→按 17 个 roles 解析命名与 reserved→named 成员保留字→carrier 递归剥 nominal 单字段且检环→commands 从 domain command/event 逐 ref 对应、request/result carrier 与 path resource→重名拒绝→query key/value 命名拒碰撞→view/source 汇总。字段并非 ControllerModel：返回 `{api, composition, persistence, names, commands, resource, query, view, sources}`；没有 gateKind/errorPayloads/ReqVo/ctorArgs 的一般模型。
- roles 中 controller/errors scope 为 `packageName + '.controllers'`，root composition scope 为 `<base>.composition`；由 [L51–70][F-M] 形成 FQN/path。controller 虽叫 root module，当前包仍 **不是顶层 controllers**。`application.api`、`infrastructure.web` 是其余角色的实际子包，不因目录存在就推定与传统职责一致。
- [render L16–46](../baseline/js/generators/scala-cqrs-play-application-v1/render.mjs#L16-L46) 明确 `named('controller','controller',[application,codec,view],controllerTemplate)`，conf/routes 在下一项，http-errors/view/components/loader 为别的 jobs；唯一物理装配者是该 render，而非每个模板自己写文件。
- [http.mjs 全文][F-T] 的 controller 发射顺序与 RHS：package/imports→`final class Controller(cc,application)(implicit ec) extends AbstractController(cc)`→error=Status(codec.status)(code JSON)→secured→body→每 command 方法→receipts→query→page→readiness。secured 使用 byteString(bodyBytes)，application.admit→authenticate→operator 或 read-only reader 且 resource 授权→write 时 csrf→codec.resource→directory.find→operation；最后 fold/error、区分 AuthorityUnavailable/NonFatal、设置 no-store/nosniff/CSP。body 检 content-type/UTF-8/query 空、严格 UTF-8 decode→codec.decodeBody.flatMap(decode)→run。command 循环按 c.method，body decode 后 application.commands 调用并 codec result→Ok。receipts 拒非空 body、codec.query→queries.receipts；query JSON page；page 取 limit 默认 pageSize、resource path URL encode、next cursor、Twirl；readiness 根据 application.accepting 200/503。没有三档 Endpoint，也没有本模板直接 CmdReply ask。
- 同文件 `errorsTemplate` 映射 413/404/其他 client code 与 server 500；`routesTemplate` command POST、query GET、page GET、readiness GET；`viewTemplate` HTML escaping、receipt rows/empty/next。上述只在集成 owner 切分时保留边界，本族不改别组模板。

**结论限定**：formal 银行是混合职责/接线缺口；legacy 有较近三档 DSL，但文本 IR、业务特判与 ABI 债务明显；family 有独立结构模型和薄 controller，但有限 API 与权限/生命周期/wire 合同不同。没有任何一路已证明与传统全部变体等价。

## 6. 真实 minus/plus 差分与 raw 偏差账

### 6.1 actual JS 模板 → approved-target 的无业务改写局部

minus 精确来自 [api-dsl/emit.mjs L64–70](../baseline/js/generators/api-dsl/emit.mjs#L64-L70)；plus 使用 Scala [T L550–555](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/ControllerTemplate.scala#L550-L555) 的简名结构，但**保留 JS 自己的 ep.reply、dvExpr 与零参数逗号防护**。这是生成器模板片段的真实差分，不是假造银行同输入输出，也不是可以直接 apply 的全文件实施 patch。

```diff
--- actual-js/generators/api-dsl/emit.mjs
+++ approved-target/askBody-template-fragment
@@
     `        repository.entityRef(${ep.entityExprRaw}).ask {`,
     `          (replyTo: akka.actor.typed.ActorRef[${ep.reply}]) => ${ep.cmdName}(${ep.ctorArgsDsl ? `${ep.ctorArgsDsl}, ` : ""}replyTo)`,
     `        }.map { reply =>`,
-    `          reply.error.fold[Either[net.imadz.common.auth.ApiError, net.imadz.metarch.infrastructure.api.OkReceipt]](`,
-    `            Right(net.imadz.metarch.infrastructure.api.OkReceipt(${ep.entityExprRaw}, ${ep.dvExpr}))`,
-    `          )(e => Left(net.imadz.common.auth.ApiError.badRequest(e.code, e.message)))`,
+    `          reply.error.fold[Either[ApiError, OkReceipt]](`,
+    `            Right(OkReceipt(${ep.entityExprRaw}, ${ep.dvExpr}))`,
+    `          )(e => Left(ApiError.badRequest(e.code, e.message)))`,
     `        }`,
```

前提：Builder 已给出与该语义相同、无冲突的 ApiError/OkReceipt TypeRef imports；不能只改字符串把不同 package 的同名类型偷换。BC raw 将 decisionView 固定 JsNull，JS 可能有真实 view key；后者不得为了“像 Scala”无条件擦除（D02）。typed replyTo 只在 app Actor command 明确回复合同后成立，不注入 HTTP DTO/领域 params/events。

### 6.2 raw-scala → approved-target：允许与未决严格分开

| raw 行为 | 已批准目标 / 裁定边界 |
|---|---|
| controller package=controllers | 原样保留。family `<base>.controllers` 与 formal `<base>.service` HTTP 职责需要移出；业务根只 domain/application/infrastructure |
| 一行长构造器、嵌套 FQN 到处出现 | 按完整字段顺序逐行排版；TypeRef imports 去重复/冲突处理；不是删字段或泛型 |
| raw stub 返回 Ok("Not implemented yet") | 作为明确未实现槽保留在 raw。不能宣称已实现。正式目标采用什么明确失败/外置 handler 合同由 D06 裁定，不制造成功 body |
| raw empty import、空 injection leading comma、零参 Cmd(,replyTo)、不完整关键字/显式 VO import | 属可定位的基准缺陷 D04。要求形成有限语法修复白名单与独立反例，不静默宣称原模板正确 |
| raw skip 全量失效、CmdReply 拼名、getOrElse("")、首个 conflict payload | D03/D05/D07，属于类型/业务语义裁定，不能仅以 CC/排版为名自动变化 |
| raw Flow `register` / requestBody / 代码字符串槽 | 保留可追溯槽；真实 Flow 方法实现/文案/表达式必须有输入或手写承接，不能普遍生成 RegisterUser 算法 |
| raw list 全量查询、toString 排序、Int 索引、按值 Future | D08，目标改动需明确 repository API 与行为，不在本文擅改数据库/溢出身份 |

## 7. 胶水合同、版本与所有权

| 符号完整名 / 来源 | 本族需要的签名/语义 | 证据与限制 |
|---|---|---|
| `javax.inject.Inject`, `javax.inject.Singleton`; `play.api.mvc.BaseController`, `ControllerComponents`, `Action`, `AnyContent` | DI ctor、cc accessor、Action.async；JSON body parsing 由 Endpoint 使用 Play parser | raw 依赖与 import 实读；[scaffold build L50、128–135](../baseline/bc/scaffold/build.sbt#L128-L135) 是 Scala 2.13.14、net.imadz common-core/auth-core **0.2** 坐标，不是 0.2.0，也不是已核 JAR |
| `scala.concurrent.Future`, `ExecutionContext`; `scala.concurrent.duration._`; `akka.util.Timeout`; `akka.actor.typed.ActorRef` | Future map/flatMap、隐式 ec、5.seconds ask timeout、ActorRef[声明 Reply] | Akka 2.6.20 由 [build L10–38](../baseline/bc/scaffold/build.sbt#L10-L38) 固定；本次未运行解析或检查 jar 内容 |
| `<base>.application.aggregates.repository.<ResolvedRepository>` | `entityRef(String)` 返回支持 `.ask(ActorRef[Reply] => Command)` 的引用；Reply 必须有 `error: Option[iMadzError]` 才可该 fold | B/T 只假设接口，未证每个聚合都满足；D03 的 mandatory 接缝；controller 不负责 persistence |
| `<base>.application.aggregates.<Base>Protocol._` | 使用 application command/reply，domain state/event 保持在 domain | replyTo 按协议声明条件生成，不是 HTTP 层补 universal Reply；不扩大 serializer 范围 |
| `net.imadz.common.auth.Endpoint`, `net.imadz.common.auth.ApiError` | tenant/global `write[R](roles*)(implicit Reads[R]).apply[T]((Ctx,R)=>Future[Either[ApiError,T]])(implicit OWrites[T])`；read.apply 同类；anonymous.write 无认证；ApiError.badRequest/conflict | raw imports 是 common.auth；curated Endpoint/ApiError 实际 **net.imadz.infrastructure.auth**，不是同一个 FQN；[C-ENDPOINT L160–218][C-ENDPOINT] 显示签名，仅供语义参考。不能用其存在证明 common.auth jar 可用，D09 |
| `<module>.infrastructure.auth.CommandRoleMap`, `ViewKeys` | `ofCommand(String): 可展开 String 序列`、`of(vk)`、每个 constName 的 String key | B/T 需要生成支撑；不能硬塞银行 customer/operator 到 tenantRole 或任意改稳定 view key，D01 |
| `net.imadz.infrastructure.api.IdGuard/InstantGuard` | `parse((String,String)*): Either[ApiError,Seq[Id/Instant]]`；Try 映射 400 PARAM_INVALID | [C-DSL L36–48][C-DSL] 展示 exact API；Id.of 与 CommonTypes.Id 名义/alias 边界保持；Option[String] 不能直接当 String |
| `net.imadz.infrastructure.api.OkReceipt` | `OkReceipt(aggregateId:String, decisionView:JsValue)` + OWrites | [C-DSL L12–20][C-DSL] 实际 writes 输出 status="ok"、aggregateId、events=[]、occurredAt=Instant.now() 毫秒格式、decisionView；这是 HTTP envelope，不是事件已发布或完整业务 receipt，不能替换银行响应名义类型 |
| `net.imadz.infrastructure.api.ViewListDto[V]`, `ViewItem[V]` | `(view,total,page,pageSize,items)` 与 `(item)`，implicit Writes[V]→OWrites 信封 | [C-DSL L22–34][C-DSL]；不等价于 family cursor ReceiptPage |
| `<base>.application.projection.repository.<Repo>` / `<Repo>Table.<Row>` | `findAll(): Future[List[Row]]`，`findByIdentity(String): Future[Option[Row]]`，tenant row 必须 `.tenantId: String` | B 注释明确存在未声明这些方法的实际仓库边界；本次未声称供应完整。不能拿任意 query/分页 port 填位 |
| `<base>.application.<UseCase>Flow` | 当前默认 `register(body)` 或声明 flowMethod/有序 body args；返回 Future[Either[ApiError,OkReceipt]] 才符合 T | 方法体是手写应用编排义务，未自动实现；是否将 HTTP ApiError/OkReceipt 泄入应用替换为纯结果是 D10 |
| `play.api.libs.json.Reads/OWrites/OFormat/Writes/Json/JsNull/JsObject/JsSuccess/JsValue` | Req Json.reads、payload Json.format、empty Reads、泛型信封序列化 | import/implicit 可见性必须验证完整文件；不得把 MANUAL/unknown 字段用 JsValue 通配兜底 |
| `net.imadz.common.application.CommandHandlerReplyingBehavior.CommandHelper` / `runReplyingPolicy` | toParam；createFailureReply(param)(error)；createSuccessReply(param)(state)；失败 reply 不 persist；成功 persist.thenReply 使用应用事件后的 State | [common L16–75](../baseline/common/src/main/scala/net/imadz/common/application/CommandHandlerReplyingBehavior.scala#L16-L75)。Helpers 属 application.aggregates.behaviors，不在 controller 或 domain。replyWithAndPublish 另有 eventStream.Publish，**不等于 replyWith**；HTTP ask 不可补发事件或构造假确认 |

只有后续受限接口/行为验证才能说明当前 jar/生成端口与上述调用相容。不得 publishLocal、下载/升级 runtime 或复制私有 CommandHelper 来绕过阻断。

## 8. 后续 JS 实施写集合、共享接口与唯一 assembly owner

以下是**第二阶段 proposed 写集合**，不是本轮实际写集合。未裁定 D01–D12 前不得开始；本轮只保存本文及 detail。

### 8.1 本族拟独占实现文件

以现役 formal producer 内部接线为优先，不捏造一个已经注册的 controller-only CLI producer：

1. `generators/scala-cqrs-play-service/models/http-controller.mjs`（proposed）：显式 Controller/Endpoint/Req/Guard/CtorArg/Read/DslFlags model；每字段对应 §2，来源 metadata 独立保存；不放完整 content。
2. `generators/scala-cqrs-play-service/build-http-controller-models.mjs`（proposed）：§3 的解析与依赖规则；formal port 不能映射 Command/UseCase 时返回具名缺口，不猜聚合/Reply。
3. `generators/scala-cqrs-play-service/templates/http-controller.mjs`（proposed）：唯一 controller **文件 assembly owner**；按 §4 输出 class/method/Req/payload，一次返回最终源码与来源位置。write/read/guard 辅函数按职责命名，不分成 helper1/Part0。
4. `generators/scala-cqrs-play-service/render-http-controllers.mjs`（proposed）：把最终模型/源码变为 entry，目标 `app/controllers/<ResolvedControllerName>.scala`，directDeps 来自模型；只做 entry 适配，不二次重写 package/import。

### 8.2 共享文件只能由集成 owner 串行修改

| 路径 / 拟处理 | owner 与依赖 |
|---|---|
| `generators/scala-cqrs-play-service/render-service.mjs` | 集成 owner：split 混合 Service/Loader/Bootstrap；仅把 HTTP 文本改为调用本族；port/配置/装配按各自 diff 承接。不能由本族整文件搬家 |
| `generators/scala-cqrs-play-service/render-service-pages.mjs` | 同一集成 owner + 页面合同 owner：page aliases、安全 headers、错误 HTML、renderer pin 分离；controller 不暗改 |
| `generators/scala-cqrs-play-service/generate.mjs`, `generator.json` | 集成 owner：注册 render entry/完整 productFootprint/版本；保持其他 inherited producer 行为，明确是否新增 controller metadata product，不伪造现有字段 |
| `generators/scala-cqrs-play-application-v1/build-models.mjs`, `render.mjs`, `templates/http.mjs` | family owner：适配共同 controller model/layout 时显式 profile 保留；http.mjs 的 errors/routes/view 与 controller 拆开职责，原物理 writer 仍由 render 单一注册，不并行覆盖 |
| `generators/api-dsl/emit.mjs`, `generators/run-all.mjs` | legacy owner：是否复用新 model/template 或保持兼容 profile 由 D11 决定；不要只改 formal 让 legacy 继续错包，也不要未经消费核定删除 |
| `_deprecated/scala-cqrs-es-api/{builders/controller.mjs,templates/controller.mjs,generate.mjs}` | 历史实现导航/适配候选，不默认复活；formal 不依赖它。若有仍消费旧接口，由独立兼容迁移处理 |
| `lib/scala-target/naming.mjs`、共享 TypeRef/layout/model/表达式接口 | shared-layout-types owner。复用 resolveName/resolveNameSet/resolveArtifactPath/targetData；[naming L64–74](../baseline/js/lib/scala-target/naming.mjs#L64-L74) 遇重复 suffix 是拒绝并要求 explicit binding，不是自动去重；BC 后缀剥除语义需适配 |
| `lib/products/generate-cli.mjs`, `src/core/product-plan.mjs`, `src/core/generate.mjs` | registry/writer owner。不增加猜测的 CLI `--artifact http-controller`。最终字节→fingerprint→owned manifest/ledger/anchor；旧文件删除必须显式所有权与引用迁移 |

共享接口的最小合同：

- naming/layout 接口返回 symbol、identifier、package、完整 path，business ID/operation ID/port ref/PID/PB number/serializer identity 是不同字段，不从源码名反推。
- TypeRef 返回 signature/fqn/递归 dependencies 与 import 冲突决议；guard/payload/source expression 是命名的已验证槽，不能在 T 再猜类型。
- protocol/repository owner 提供 command 的参数顺序、replyToType、reply error 读取合同与 entityRef 类型；helper/behavior owner 提供新 state 回复语义。
- routes owner 从同一 active EndpointModel 列表取得 method/path/signature，负责 `conf/routes` 单一组装，不能让 controller writer 整文件覆盖 routes。
- external implementation owner 提供 Flow/HTTP adapter/codec/authority 的明确方法、版本与消费位置；controller 不复制手写实现。
- 迁移旧 `app/example/bankwealth/service/BankServiceLoader.scala` 等必须拆 construct 后更新 loader 配置、imports、Bindings 调用方、页面别名、来源映射与 ownership；**当前这些路径不改**。不存在把全部类整体放 application 的快捷验收。

冲突依赖：`shared-layout-types`、`application-protocol`、`aggregate-repository-port`、`command-helper`、`aggregate-behavior`、`command-endpoint-dsl`、`route-definition`、`application-service`、`query-service`、`projection-repository-port`、`application-bootstrap`，以及页面/授权适配器合同。每个新 controller 文件唯一 owner 是本族；共享 loader/registry/writer 只有集成 owner。

## 9. Fixture、精确 CLI 形状及副作用边界（当前全部未运行）

### 9.1 拟 fixture 矩阵

以下是待批准创建的测试资产，不是新业务真源；本轮没有写 fixtures/expected。

| fixture id | 必须显式提供的输入与 oracle | 比较/拒绝点 |
|---|---|---|
| HC01 legacy/mixed | 无 gate controller + mixed controller，参数泛型/default、serviceMethod、空 injectedServices | 完整 stub 字节、未实现提示；空 injection/泛型名损失不能隐藏 |
| HC02 tenant-path | 单聚合、明确 identity Id、tenant gate、triggeredBy/tenantId/body scalar、已声明 Reply | 参数顺序、path id guard、session 注入、ask reply type、失败 no persist/成功新 state reply |
| HC03 global-factory/empty | 全局身份创建 + 零 body 命令 + 零 command payload | UUID 仅创建语义、empty JSON、empty ctor comma、global 空 import |
| HC04 guards/options | Id+Instant、keyword 参数、Option[String/Int/Id/Instant]、List[String]/List[Id]/VO-list | 精确 bad-input 400、Id 外 Instant 内；未支持 Option/List 不靠空串/无条件 map 洗过 |
| HC05 conflict | 单投影、必填键与 optional 非键、path self exclusion、tenant 过滤；多 errorCode/soft-delete/多投影负例 | conflict payload 来源/类型、查询顺序、命中不 ask、非原子预查事实；D07 未解不得称通过 |
| HC06 flow | anonymous UseCase explicit Req，flowMethod/flowArgs 的声明、默认/整 body 变体 | 外置真实 Flow 签名；非匿名 Flow 与缺 body 的生成拒绝；不伪造注册业务 |
| HC07 views | tenant/global list、single item、tenant composite；缺仓库方法、匿名、global composite、错误参数序负例 | helper 最小集合及顺序、page bounds、404/400、filter/排序/分页与 eager Future 语义 |
| HC08 shape/dependency | repeated VO name 不同 shape、跨包同名 TypeRef、unknown gate/view/command、multi-aggregate、全部 skip | 明确诊断、无默默选错类型；full raw 缺陷与目标修复白名单 |
| HC09 formal-bank-contract | 只把 §5 的 14 个现有 HTTP 合同作为迁移保护输入，实际 author→port/command 对应须另提供 | 14 API+14 aliases+shell/script、不变 method/path/audience/csrf/wire DTO/pin；不从 bank 示例编造 BC metadata |
| HC10 family-nonbank | family 现有有限 api/composition 的等价声明适配、独立 oracle | captured handwritten 实现、resource auth、bodyBytes、UTF-8/media type、cursor/page/readiness 保留；不得把它称银行样例 |

共同 oracle：一次按 raw 固定 MBT 生成、一份 approved-target 的有限差异清单、一份 actual-js；完整文件集合/路径、imports、声明/顺序、body/default/RHS、所有启用/抑制/拒绝变体分别核对。两次相同输入稳定，再单字段变更检查局部 diff 与真实作者位置回锚。只可明确豁免生成来源头/平台换行；不压平空白、不用 AST 相似替代格式/顺序。

### 9.2 CLI 命令形状

下列是**未来授权窗口的命令模板**；绝对 `/absolute/...` 是要求执行者填入经批准 fixture/新目标的参数位置，**不表示文件现在存在**。没有声称某个未有的 spec/flag 可运行。当前不执行任何一条。

**formal service 的公开 product 入口**（四个 flag 均必填，源码 [generate-cli L66–88](../baseline/js/lib/products/generate-cli.mjs#L66-L88)）：

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /absolute/approved-hc-fixture/request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-play-service \
  --out /absolute/new-owned-hc-js-output \
  --options-json /absolute/approved-hc-fixture/options.json \
  --plan
```

- 去掉 `--plan` 才 apply。plan 也编译 product set、读取 generator/options/request、runtimeArtifact 本地仓库文件并校验冻结 saga/条件 Monarch JAR、检查 externalSourceRoots（[L110–140](../baseline/js/lib/products/generate-cli.mjs#L110-L140)），不能当“不碰任何依赖”的文档命令。
- 当前没有 controller-only flag；闭包大小由最小合法 fixture/product set 决定。该 producer 仍会计划依赖闭包的 domain/aggregate/build/config 等输出；实施前列完整计划。直接 import 调 renderer 不代替公开 CLI 证据。
- apply 写新 target entries、`truthsrc.ledger.json`、`anchors.json`，含 MANUAL 合并及最终字节核对（[writer L243–268](../baseline/js/src/core/generate.mjs#L243-L268)）；该 generate-products 分支不调用 project graph publication。不是只写 controller 一个文件。

**family 入口必须 project capture**（不能用 generate-products 绕过）：

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-project \
  --project /absolute/approved-hc-family-fixture/truthsrc.project.json \
  --out /absolute/new-owned-hc-family-output \
  --plan
```

- project 内 generator 必须显式 `scala-cqrs-play-application-v1`。[project/cli L91–144](../baseline/js/lib/project/cli.mjs#L91-L144) 会 validate、roundtrip、compileTree、编 product、捕获 implementations/整个工具源码证据；这也是本次不运行它的原因。
- [L182–208](../baseline/js/lib/project/cli.mjs#L182-L208)：有 captured implementation 时 plan 也会 `verifyImplementationSources`，其外部验证执行/临时写面必须在后续窗口单独审定，本文没有读取或运行该模块，不能承诺 --plan 零子进程。非 plan 会打开 project graph SQLite store、apply 输出/ledger/anchors、publishProjectAnchors；故新 out 目录不隔离 project graph 的写面。缺显式边界时停止，不用 --update。

**Scala 传统链的公开入口**（后续仅在 BC 仓执行；本次没有进入/操作 BC 工作副本）：

```bash
sbt \
  -Dcodegen.systemFile=/absolute/approved-hc-fixture/canonical.json \
  -Dcodegen.systemBindings=/absolute/approved-hc-fixture/bindings.json \
  -Dcodegen.targetDir=/absolute/new-owned-hc-scala-output \
  -Dcodegen.ledger=/absolute/new-owned-hc-scala-output/generation-ledger.json \
  "runMain net.imadz.codegen.CodegenMain"
```

- [CodegenMain L62–80](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L62-L80) 要求 systemFile/systemBindings 成对且与 codegen.system 互斥；canonical/bindings 必须真的能表达 fixture 的 ControllerMetadata，否则 D12 阻断，不能从散文猜。也可用一个**已实际存在且被核定**的 SystemMetadata 槽，不能发明 `HttpControllerParitySpec`/system 类名。
- single profile 是本轮 controller 文件比较的默认选择；multi 若另测明确加 `-Dcodegen.multiProject=true`，controller 仍 root app。不能使用默认 ../banking-app，不加 semanticProductsFile，不用 pipeline defaults。
- prepare 后会创建目标、复制 scaffold，multi 还移动 common 文件，生成完整最小 system 依赖闭包、proto、ledger、knowledge release manifest、条件 formal-semantics；sbt/JVM 本身可能写 target/缓存并解析或下载依赖，须离线供给/资源 owner 批准后统一批末一次执行。本次**没有运行、下载、发布**。未经复核 GenerationLedger/KnowledgeRelease 的旁路配置前不得把该模板当零旁路执行许可。

验收分账：源级 MBT/construct 检查；真实 CLI 完整字节对账；真实 glue 接口与必要行为；命名/layout/import；每方法 CC/嵌套；稳定生成/回锚。预算建议生成/对账 5 分钟、集中局部编译/行为 15 分钟，超时交回已得证据，非性能承诺。普通方法 CC≤5、6–10逐方法说明、>10先重构或具名例外；两侧都不以 String/Any dispatcher/平均分刷门。

## 10. 必须裁定的具体事项

| id | 未决内容 / 阻断对象 |
|---|---|
| D01 | 银行 14 个 port-based endpoint 如何显式映射 BC ControllerMetadata/ServesTarget？customer/operator、csrf 与 tenant/global/anonymous 不是同轴。选择 port adapter 扩展还是 metadata 正式补充，不能自动推导门档 |
| D02 | wire 结果采用银行 nominal DTO/Failure(code) 还是 BC OkReceipt/ApiError(errorCode,message,payload)？decisionView 的真实 key/JsNull、状态码/HTML aliases/ready 前置/重复 JSON key 限制必须逐项保留或获得兼容变更批准 |
| D03 | CmdReply 命名和 `.error` 是否真实由 application protocol/repository 提供？replyToType 缺失、read-only reply 与无 error reply 必须如何拒绝/分派；controller 不擅补 universal Reply |
| D04 | raw 语法/依赖修复白名单：空 import、leading comma、零 ctor comma、generic `.name` 损失、显式 requestBody 类型/包/泛型丢失、Req 依赖遗漏、keyword 词表/文案转义、同名 VO/同名短 repo、park/view 重复注入。哪些作为已批准质量要求的具体修复，需固定 exact expected |
| D05 | 全部端点 skip 时是否生成无端点 controller 或不生成文件？raw 会退回 legacy stub 并发全部 skip；必须与 routes/ledger owner 同一裁定，不能只过滤方法造成 dangling route |
| D06 | 无 gate stub 的明确未实现合同：保留仅 raw 对照；正式目标选择拒绝生成、外置 handler 槽还是明确失败响应？不得继续用 Ok("Not implemented yet") 当业务成功 |
| D07 | errorPayload 的类型/多 errorCode 分派、唯一键/soft-delete 的声明源、投影预查与领域强一致约束分别由谁保证？不能把每个必填 body 字段都当唯一键，不能只用 payload.head 冒称多个 conflict 已支持 |
| D08 | ViewRepository 是否实际提供 findAll/findByIdentity 与 Row.tenantId？按值 Future 提前查询、内存分页/toString 排序、Int 索引溢出是否保留 raw 或批准新的接口；不得静默切换存储/排序 |
| D09 | raw common.auth Endpoint/ApiError 与 curated infrastructure.auth 的 FQN 不一致，消费 `net.imadz:common-core_2.13:0.2` / `auth-core_2.13:0.2` 的实际 API 供应未核。缺 jar 接口时阻断，不升级/发布运行库洗绿 |
| D10 | Option/Id/Instant 的 wire→domain 默认语义、tenantId 实际 Id/String、Path 首参名与固定 idGuard 表达式、Flow requestBody/method/参数/返回值合同须固定。FromBodyOptional 统一空串和 Flow 默认 register 不能作为银行通用算法 |
| D11 | formal/legacy/family 的目标 profile 是否共享此一般 ControllerModel，或保留可验证兼容分支？旧 r2/r3/httpKey/r2c/enricher/VO-list 白名单与 family resource/cursor/readiness 无 Scala 一般对应，必须单列扩展，不能删除或通过目录改名假称接线完成 |
| D12 | 同输入最小 fixture 的作者/BC binding 表达能力、生成目标文件完整清单、外置实现验证 CLI/临时写面与共享 imports/layout/writer 接口尚需集成者固定。没有现成同输入字节，不允许以本文件存在签 parity 或 readiness |

PB 字段号、PID、serializer manifest/绑定范围、名义类型、业务 key/复合键字节和 overflow 语义均是保护面。本族不写或迁移它们。上述未决项只阻断相关实施，不阻断本份观察与规格独立保存。

[M]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/infrastructure/api/ControllerModel.scala
[B]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/api/ControllerBuilder.scala
[T]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/ControllerTemplate.scala
[BANK-L]: ../baseline/actual-js/app/example/bankwealth/service/BankServiceLoader.scala
[BANK-S]: ../baseline/actual-js/app/example/bankwealth/service/BankServiceService.scala
[C-ENDPOINT]: ../baseline/curated-scala/net/imadz/infrastructure/auth/Endpoint.scala
[C-ERROR]: ../baseline/curated-scala/net/imadz/infrastructure/auth/ApiError.scala
[C-DSL]: ../baseline/curated-scala/net/imadz/infrastructure/api/CommandDsl.scala
[JS-PAGES]: ../baseline/js/generators/scala-cqrs-play-service/render-service-pages.mjs
[JS-LEGACY-T]: ../baseline/js/generators/api-dsl/emit.mjs
[JS-OLD-B]: ../baseline/js/generators/_deprecated/scala-cqrs-es-api/builders/controller.mjs
[JS-OLD-T]: ../baseline/js/generators/_deprecated/scala-cqrs-es-api/templates/controller.mjs
[F-M]: ../baseline/js/generators/scala-cqrs-play-application-v1/build-models.mjs
[F-T]: ../baseline/js/generators/scala-cqrs-play-application-v1/templates/http.mjs
