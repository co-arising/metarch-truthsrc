# application-service：应用方法、实现槽与真实调用链的内容级差异

状态：**decision-required**。传统编号 **14 / application-service**；这是第一阶段内容规格，不是 implemented、parity-PASS、behavior-PASS 或实施许可。生成、编译、测试、typecheck、真实应用接口及圈复杂度（CC）均未运行。

## 1. 范围、来源与生成条件

遵循 [作者合同](../AUTHORING-CONTRACT.md)、[R01/R06/R07](../PARTITION-RESOLUTIONS.md)、[Play 唯一成员 owner 裁定](../PARTITION-REVIEW-RESOLUTIONS.md)、[共享接缝](../SHARED-SEAMS.md)、[胶水合同](../glue-dependencies.md)、[fixture 合同](../FIXTURE-AND-EXPECTED-CONTRACT.md)及[内容勘误](../CONTENT-REVIEW-CORRECTIONS.md)。本轮仅局部纠正已分配的本文及 [details](../details/application-service.json)，依据[有限审阅结果](../details/fixture-design-workflow-results.json)的 `result.results[0].primary` / `[1].primary` 六项意见回查固定来源；不修改中央装配、其它 diff、固定资料或生产代码。编辑权是主集成者分工，不把 agent 分派语句标作用户逐字原话或实施授权；固定源码为 source-fact，既定质量要求为 user-required，候选实现为 proposed，三者分账。原 6 proposed / 32 shared 条件写集合不变。

### 1.1 四种事实不能混签

| 来源层 | 固定证据 | 本文使用边界 |
|---|---|---|
| raw Scala MBT | [Model](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/ApplicationServiceModel.scala)、[Builder](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/ApplicationServiceBuilder.scala)、[Template](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/ApplicationServiceTemplate.scala)，三文件全文实读 | 传统 `runCommon`，不是 `template/products/*`；未执行模板取得新产物 |
| raw 元数据 | [Examples.scala L185–189、290](../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L185) | 有 referenceCode 不等模板执行它；函数、返回值及依赖按其真实输入描述 |
| curated Scala | [CreateCreditBalanceService](../baseline/curated-scala/net/imadz/application/services/CreateCreditBalanceService.scala)、[DepositService](../baseline/curated-scala/net/imadz/application/services/DepositService.scala)、[WithdrawService](../baseline/curated-scala/net/imadz/application/services/WithdrawService.scala)、[MoneyTransferService](../baseline/curated-scala/net/imadz/application/services/MoneyTransferService.scala)，四文件全文实读 | 人工完成参考，不冒称由 raw Builder/Template 产生，也不是现银行算法 |
| actual JS 银行输出 | [BankServiceService.scala](../baseline/actual-js/app/example/bankwealth/service/BankServiceService.scala)，全文实读；[固定项目选择](../baseline/bank/truthsrc.project.json) | 是 HTTP contract/安装/生命周期复合物，不是经典业务应用服务的同输入输出 |
| user-required 质量要求（非实施裁定） | PascalCase/lowerCamelCase、无 ServiceService/HostHost、业务根仅三层、具名依赖、完整 RHS 与手写隔离 | 这些已给定的质量约束不等具体业务方法、classic/family8 ABI、完整 expected 字节已经获批 |

来源身份由 [scala-artifacts.json](../scala-artifacts.json)及[原 baseline 索引](../baseline/index.json)固定：BC HEAD `cc335eb1e0d0fae17bf092fd61b126040196ea70`。核心文件读取字节数及 SHA-256 为：

| 文件 | bytes | SHA-256 |
|---|---:|---|
| ApplicationServiceModel.scala | 986 | `19e673c7aa7de8964c4d82d7ca5ec0939bd7310142f4560a7c5d0bc162a6ee76` |
| ApplicationServiceBuilder.scala | 2119 | `087675af9f553fda84533c3e226a87356260daed3a4bbf080cffab266f5bb06e` |
| ApplicationServiceTemplate.scala | 3228 | `afe3693dd25c9268d6ee11f0d02d981d264a6e050fa73bac233f6f96202ac548` |
| service-dsl/emit.mjs | 10903 | `b9a2989d7e6573747d628b16f9fb31d46abed4a3c2ec37c91d333d1f8844e069` |
| family8 templates/services.mjs | 3994 | `2be4378ff0cc163625e83c9a3b614563ab7a1f9ecb0331deea89ebfe3e86e493` |
| actual-js BankServiceService.scala | 11451 | `a7e1c39c8211cc197b11d23b7b7d0faecbcb9a4b409d6bd30283b1a64c30e297` |

源码仅取固定 baseline/supplemental；原始源码与补充索引均不重写。不以可变工作副本填补缺失证据。

### 1.2 调度、基数、路径

[runCommon L192–209](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L192)依次进入 domain/application/infrastructure；[应用层 L702–729](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L702)在 connector 后、query 前遍历 **`app.services`**：build → generate → `writeArtifact`，attribution 为 `("application-service", meta.name, "global", Nil)`。

| 变体 | 条件 | 候选输出 |
|---|---|---|
| single | 传统入口，`app.services` 每个元素 | 每服务 1 个 `<target>/app/<basePath>/application/services/<resolvedName>.scala` |
| multi/root fallback | `multiProject=true`；`targetModuleOf` 未登记 application-service，返回 None | 仍每服务 1 个 `<target>/app/<basePath>/application/services/<resolvedName>.scala`，**不是自动进入 kernel/glue** |
| 无服务 | `app.services.isEmpty` | 0 |
| 空 methods | 服务存在、`methods.isEmpty` | 仍 1 个带注入构造器的空 class |
| 有 ActorSystem | 最终 model.dependencies 有 `name == "ActorSystem"` | 同文件增加 `private val system = classicSystem.toTyped`，不额外产文件 |

`base` 来自 `GeneratorContext.basePackage = rootPackage + "." + moduleName`；`fromSystemMetadata` 固定 root/framework 为 net.imadz，module 为 `system.contextName.getOrElse("codegen")`。[PackageLayout L40–65](../baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala#L40)规定 `.application.services`。这是 raw 路径推导，不拿 curated 的 `net.imadz.application.services` 反推 raw context。

上表是候选**实际文件路径**，不是 ledgerPath。按 [CodegenMain L232–241](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L232)和 [writeArtifact L366–400](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L366)逐层分账：

| raw 变体 | outputRoot / modulePrefix | relative（相对 outputRoot） | ledgerPath（record 与 recordMorphisms 共用） |
|---|---|---|---|
| single | `<target>/app` / 空串 | `<basePath>/application/services/<ResolvedServiceName>.scala` | `app/<basePath>/application/services/<ResolvedServiceName>.scala` |
| multi/root fallback | `<target>` / `app` | `app/<basePath>/application/services/<ResolvedServiceName>.scala` | `app/app/<basePath>/application/services/<ResolvedServiceName>.scala` |

raw 仅在 `a.kind == "strict-saga-module" && multiProject` 时直接使用 relative；本族不满足该例外，故 multi 台账额外拼一层 `app/`。**这是固定 raw writer 缺陷，不是目标目录要求**；两种实际文件仍均为 `<target>/app/<basePath>/application/services/...`。保留缺陷证据，不偷改 raw、target 或 ledger，也不把台账路径当真实落盘证据。

候选文件数不等实际写成数：scope/领地/KEEP 可以阻止写入；解析错误可以提前失败。同名服务可能撞路径，不能以“foreach N 次”证明 N 个不同文件。注册编号、manifest 或源码存在都不等当前输入触发。

## 2. Scala 模型：全字段、类型、缺省与函数支撑

### 2.1 两个 Model 的完整字段顺序

```scala
case class ApplicationServiceModel(
  override val selfType: TypeRef,
  methods: Seq[ApplicationServiceMethodModel],
  override val dependencies: Set[TypeRef]
) extends ArtifactModel

case class ApplicationServiceMethodModel(
  name: String,
  parameters: Seq[FieldDef],
  returnType: TypeRef,
  bodyLogic: String = "???",
  invokesCommands: Seq[TypeRef]
)
```

除 `bodyLogic` 外，以上字段**均无默认值**，包括其后的 `invokesCommands`。没有 superInterface、constructorDependencies 独立字段、description、注解、方法修饰符、显式泛型、参数组、重载身份或 private helper 模型。`bodyLogic` 是源码字符串槽，但本模板不消费它。

[ArtifactModel](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala)的继承项：`fqn = selfType.packageName + "." + selfType.name`；`registerTo(registry)` 默认只注册自身；`morphisms: Seq[MappingMorphism] = Nil`、`noteIds: Seq[String] = Nil`。本族不 override，不因此生成嵌套类型或知识锚。

### 2.2 Parameter / Function 的真实承载

本链的函数元数据是 **ServiceMethod**，参数是 **ParameterMetadata → FieldDef**，不是另一个已接线的通用 Function AST。[ArchitectMetadata L435–465](../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L435)和[L63–67、167–178](../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L63)的全部槽如下。

| 类型 | 字段（源码顺序） | 缺省与实际消费 |
|---|---|---|
| ApplicationServiceMetadata | `name: String, description: String, dependencies: Seq[DataType], methods: Seq[ServiceMethod]` | 均无默认；metaCategory=`application.services`；description 不进入 Model |
| ServiceMethod | `name: String, parameters: Seq[ParameterMetadata], returnType: DataType, logic: BusinessLogic, invokes: Seq[CommandRef]` | 仅 invokes 默认 Nil；metaCategory=`service.methods`；FQN=`AppService.<name>`，不是唯一重载身份 |
| BusinessLogic | `intent: String, invariants: Seq[String], referenceCode: Option[String]` | 后两项默认 Nil/None；Builder 只选 referenceCode 或 intent，不执行 invariants |
| ParameterMetadata | `name: String, parameterType: MetaType, optional: Boolean, optionalWhen: String, noteId: Option[String], description: String` | 后四项默认 false/空串/None/空串；optional/optionalWhen 在本 Builder 不消费 |
| FieldDef | `name: String, typeRef: TypeRef, defaultValue: Option[String], comment: Option[String], noteId: Option[String], description: String` | 后四项默认 None/None/None/空串；Builder 只传 name/typeRef/noteId/description；Template 只读 name/typeRef |

[Builder L26–45](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/ApplicationServiceBuilder.scala#L26)完整接通 **ServiceMethod → ApplicationServiceMethodModel**，参数经 **ParameterMetadata → FieldDef**。独立同名 Function AST 不在这条现有调用链中，不是必需支撑或源码证据阻塞。D10 已移至非阻塞澄清；除非另有明确指定的独立 Function API 需求，不补拷、不继续寻找另一份 Function 文件，也不据此声称支持未指定 API。

### 2.3 TypeRef 与解析规则

[TypeSystem.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala)全文：`TypeRef(name: String, packageName: String, typeParams: Seq[TypeRef] = Nil)`；fqn 无泛型，无包时直接 name。signature 在 name 以 Tuple 开头、其余字符都是数字、且 typeParams 非空时发 `(T1, T2, ...)`，**没有 package/元数一致性检查**；其余泛型发 `Name[T1, ...]`，否则短 name。没有 FunctionN→箭头专门分支；若输入为 CustomType FunctionN，只按一般泛型处理。

`collectAllDependencies = Set(this) ++ 所有 typeParams 递归依赖`。`shouldImport` 对空包、当前包、精确 scala、精确 java.lang 返回 false，其余 true。内置 String/Int/Long/Boolean/Unit/Double 为无包；BigDecimal 为 scala.math；List/Option/Map 工厂为无包泛型；Nothing 为 scala。

[TypeResolver](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala)及 [TypeResolverDSL L534–541、1115–1151](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L534)：

- selfType 用 `applicationService(meta.name)`，先 `getBaseName` 再加 `Service`，包从 layout 取。
- parameterType 委托 `TypeResolver.resolve`，**不是** `resolveField(optional)`；optional=true 不自动得到 Option。
- primitive、EntityState、Command/Reply、aggregate/repository/service/VO 等按实际分支解析；CommandRef 的 invokes 可走 MetaRef overload，不能把所有 resolve 调用都假定为同一分支。
- CustomType 先按简单名查 knownFrameworkTypes；命中时使用其包并递归 typeArgs；未命中时保留包（旧 `net.imadz.domain.values` 重定位到当前 values 包）并递归。
- nested type 依赖 symbolTable/metadata owner；查不到可退到 domain.values。未知 MetaRef helper 本身为 `???`；未知 MetaType 最后退 Any。不能以这些 fallback 证明类型准入正确。
- [GeneratorContext L68–113](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L68)的 Inject/Singleton 是 javax.inject，Future 是 scala.concurrent，ActorSystem 是 **akka.actor.typed**；Template 构造器却改为 classic system，见下文。
- [NamingConventions L157–223](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L157)：firstLower 只降首字符；scalaIdentifier 仅对其列举关键字加反引号；getBaseName 按固定后缀列表单次遍历、剥空回最后非空值，非通用递归去重。不能据此承诺所有 ServiceService 都已修正。

## 3. Builder 全规则及损失边界

| 规则 | 实际动作与顺序 | 必须显露的差距 |
|---|---|---|
| B01 | 取 `pkg=ctx.layout.application.services.root`，解析 selfType | 不读取业务 body 推导服务名或文件数量 |
| B02 | `meta.dependencies.map(ctx.typeResolver.resolve(_))` | 这里仅解析根节点；不像 methodDeps，再对显式依赖调用 collectAllDependencies |
| B03 | 按 methods、parameters 原 Seq 顺序构造 FieldDef | optional/optionalWhen 丢失；noteId/description 搬入后未发射；没有参数默认值推导 |
| B04 | resolve method.returnType | 不自动包 Future/Either；返回类型照输入，不猜业务错误模型 |
| B05 | resolve `m.invokes` 得到 invokesCommands | 注释虽说用于 Ask，实际仅为依赖输入，**没有 ask body 构造** |
| B06 | `bodyLogic = m.logic.referenceCode.getOrElse(s"// TODO: ${m.logic.intent}")` | Some(空串)仍是空串；None 得 TODO 注释；invariants 不消费；Builder 常规调用不会使用 Model 的默认 `???` |
| B07 | 每方法收集返回值、参数、invokes 的递归依赖，再与 resolvedDeps、Inject/Singleton 合并为 Set | 方法类型也会误入后续按后缀猜注入的集合；依赖/注入/导入未分层 |
| B08 | allDeps.filter(_.shouldImport(pkg)).toList.distinct → 再转 Set，构造 Model | **先删同包类型导致同包 Service 注入及结构依赖丢失**；显式依赖原顺序也丢失，不等保序构造器合同 |

Model 与 Builder 都没有求时钟、造 ID、银行资金运算或执行命令的动作。Builder 并不自动生成 `Timeout`、`Scheduler`、repository 查询、错误映射、publish、重试或关闭钩子。

## 4. Raw Template：按输出顺序的 construct/RHS 账

以下覆盖 [Template L12–99](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/ApplicationServiceTemplate.scala#L12)的全部输出分支；[CodeGenerationDSL L13–22](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L13)决定最终 import 顺序。

| 顺序 | construct | 完整规则 / RHS |
|---|---|---|
| T01 | package | `package ${model.selfType.packageName}`；不自行变包 |
| T02 | baseImports | dependencies.toList → sortBy(fqn) → map(fqn) → distinct；去精确 Inject、Singleton、scala.concurrent.ExecutionContext；再去所有以 `scala` 或 `java.lang` 开头的字符串 |
| T03 | additionalImports | 恒加 `javax.inject.{Inject, Singleton}`、`scala.concurrent.{ExecutionContext, Future}`、`akka.actor.typed.scaladsl.adapter._`，即使未用也加 |
| T04 | 最终 imports | `imports(base ++ additional).code` 对整个 Seq 再字典排序、每行 `import `、以换行连接；**不是 base 一组后固定三行**。DSL 不额外 distinct，不做冲突 alias |
| T05 | 注入构造参数 | 遍历 dependencies Set；去简单名 Inject/Singleton/ExecutionContext；去 packageName 以 scala/java 开头者；仅名尾 Repository/Factory/Service/Query/Connector 或精确 ActorSystem；普通发 `firstLower(name): name`，ActorSystem 特判 `classicSystem: akka.actor.ActorSystem`；用 `,\n    `连接 |
| T06 | class 与注解 | `@Singleton` 换行，`class <selfType.name> @Inject() (`构造参数`) (implicit ec: ExecutionContext) {`；非 final、非 case class、无 extends/with、无父构造实参；ec 没有 val/private |
| T07 | 条件字段 | 原 model.dependencies 任何项简单名为 ActorSystem 就发 `private val system = classicSystem.toTyped`；不是 implicit，不派生 scheduler/ec，不拥有 ActorSystem 创建/关闭 |
| T08 | methods 循环 | methods 原 Seq 顺序；每方法参数原 Seq 顺序，`scalaIdentifier(p.name): p.typeRef.signature` 以逗号空格连接；method name 不做 scalaIdentifier，返回 `m.returnType.signature` |
| T09 | 每个方法的完整 body | 统一大括号内三行 `// ==== BEGIN MANUAL ====`, `???`, `// ==== END MANUAL ====`；**不读取 bodyLogic，也不读取 invokesCommands 发命令** |
| T10 | 文件结束 | methods 用两个换行分隔，class 关闭后保留模板字符串既有空行/换行；sourceCode 自己拼 package/import/class，并非调用 SourceFile.code |
| T11 | writer 后置头 | 模板无 generated/knowledge 头；writeArtifact 在模板外 prepend `// @generated by CodegenMain:<GeneratorVersion>`，knowledgeRelease 非 null 时再加其行 |

本 raw 输出**没有** companion、嵌套 trait/object/case class、type alias、var/lazy val、self-type、主构造以外的构造器、override/private 方法、method 泛型或上下界、curried method 参数组、method implicit 参数、method 默认实参。多个同名 ServiceMethod 会机械输出多次 def，但没有重载冲突验证/独立 MANUAL 身份。class 的 implicit EC 是独立构造参数组，不应误记作方法参数组。

`bodyLogic` 的缺省与最终 RHS 是两件事：即使 referenceCode 是完整算法、甚至空字符串，T09 仍是 `???`；调用此槽会抛未实现错误，不能称空成功。既有 MANUAL 可能由 writer 合并带回业务体，但那是手写来源，不是本 Template 生成算法。

### 4.1 Source-copy / writer 对最终字节的影响

[CodegenMain L199–242](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L199)先 mkdir/copy scaffold，multi 再搬 13 份 common 源至 kernel/glue；single 的 genRoot 是 `<target>/app`，multi 是 target。故传统入口不是无副作用预览。

[writeArtifact L359–412](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L359)由 selfType 定完整文件路径，先以 §1.2 的 ledgerPath 记 dependencies/noteIds/morphisms 再 scope 检查，再 prepend 头并进入 [writeTerritorial L461–505](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L461)。Add/Cover 写新字节，Merge 调 `mergeManual`，Keep 默认拒写（显式 codegen.migrate 可覆盖，**本文不批准**）；冻结领地有自己的首填/护存量分支。不能把 ledger 行存在当实际文件写成。

[WriteTerritory.mergeManual L109–179](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/WriteTerritory.scala#L109)的真实匹配/拒写规则（source-fact，不是未来实现设计）：

| 顺序 | raw 规则与边界 |
|---|---|
| M01 前置 | `manualRanges(existing)` 为空即抛 IllegalStateException；incoming 没有完整 MANUAL 块也抛错拒写，不把旧手写体直接丢弃 |
| M02 锚 | `anchorOf` 在块起点前取最近**匹配 DefAnchorRegex 的 def 名字**；不是 Scala AST/参数签名/重载身份。该正则只取 `def name(` 形态的名字，不以词法方法作用域区分同名块 |
| M03 对应 | 旧具名块按名字分桶，各桶按出现序消费；无匹配 def 前缀的匿名块另按出现序消费。incoming 按块顺序遍历，用旧块覆盖相应区间，块外保留 incoming |
| M04 新块 | 新块无旧块可匹配（包括同名桶已耗尽）时保留 incoming 原块；本模板的新块仍是未完成 `???`，不是自动业务实现 |
| M05 拒写 | 消费后任一旧具名块或匿名块仍无落点即抛错；普通方法删除/改名造成孤块已有拒写保护。`writeTerritorial` 仅在 merge 返回后写文件；拒写不撤销此前台账记录 |

同名重载重排而块数不变时，出现序仍可能把旧业务体配到另一签名，不能称重载安全；D02 仅保留未来唯一实现/回锚身份裁定，不再把上述既有规则当未知。固定支撑为 `WriteTerritory.scala`，12087 bytes，SHA-256 `03d52b6dee8c7870aa16fb6e38fb96755de2fa111e0e0e985aacd5eb0030ec20`，与 baseline/index.json 对应项一致；未执行 merge。

## 5. JS 可达链与逐层差距

### 5.1 legacy-application/service/application：近似 renderer 已存在，但非正式银行接线

[service-dsl/emit.mjs L14–88、270–294](../baseline/js/generators/service-dsl/emit.mjs#L14)是真实独立 CLI。`kind` 缺省 application；除 query/domain/port 外也落 application。`parse.mjs` 仅复制 binding 原字节，**不是** TypeResolver/Builder；[generator.json](../baseline/js/generators/service-dsl/generator.json)的 `entrypoint=emit.mjs/version=0.1.0` 不等于 product allowlist 注册。

| 层 | legacy 实现 | 与 raw/目标差距 |
|---|---|---|
| Model 输入 | 普通 spec 的 package/name/dependencies/methods；dep 同时要 name/packageName/fqn，参数 typeRef 与 returnType 都直接字符串插值 | 无 TypeRef 递归身份、没有固定结构验证；fqn 与 name/packageName 可不一致；不能传对象后让 `[object Object]` 冒充类型 |
| Builder | 没有独立 Builder；emitter 内过滤依赖 | 不解析 metadata、optional、invokes 或源码来源；不收集方法类型依赖，只信调用者给的列表 |
| imports | 与 raw 相同排除/固定 imports；最终 Set 去重后 sort | raw 仅 base distinct，此处全量 distinct；只在受约束输入下可能一致，不可概称 1:1 |
| constructor | 相同 suffix 白名单与 ActorSystem classic 特判；按 spec 数组顺序 | raw 来自 Set 无明确排序；legacy 保留重复注入项，不因 imports Set 去重而消失；仍丢泛型，用简单 name |
| class/fields | 同样 @Singleton/@Inject/implicit ec；extraFields 取**过滤后的 deps** | raw 判断原 model.dependencies；有不合格名为 ActorSystem 的输入时两者不同 |
| methods/body | 同样逐方法 MANUAL `???`，bodyLogic/invokes 不消费 | `scalaId = s => s`，参数关键字未转义；无语义生成，method 默认/注释同样未发射 |
| header/writer | 固定 `rules_domain_gen:2026-10-04` 与 release `1.0.0`；mkdir + writeFileSync | 不代表真实 producer/release；独立 emitter 无公共 MANUAL 合并/ledger/anchors；只有 port 分支支持 outDir 为完整 `.scala` 文件 |

[run-all L1781–1792](../baseline/js/generators/run-all.mjs#L1781)实际从 domainServices 传 **kind=port**，不是调用这个应用服务分支。该 port 的计算声明按 R01 属 domain-service 部分 A，bridge 按 B；不能把它们算本族方法完成。

### 5.2 正式银行：有 service 名称，不等 ApplicationService 实现

固定项目的 generator=`scala-cqrs-play-service`，service artifact=`bank-service`，packages 指向 example.bankwealth，外置源根来自项目配置（静态配置为相对路径；公共调用还需转换/验证实际绝对根）。[公开 allowlist L92–145](../baseline/js/lib/products/generate-cli.mjs#L92)选择具体 producer，验证冻结 runtime jar pin/外置根；本文没有读 jar、捕获外置目录或运行准入。

实际链为 [play-service/generate L16–70](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L16) → [createEffectRegistry](../baseline/js/generators/scala-cqrs-application/produce-effect.mjs) → [applicationRegistry](../baseline/js/generators/scala-cqrs-application/produce.mjs)；Play 覆盖 aggregate/invariant 并加 `play-service-dsl`。这个 registry **没有接 service-dsl 的 emitApplicationService，也没有调用 family8 commandServiceTemplate**。

[serviceSelection/renderService](../baseline/js/generators/scala-cqrs-play-service/render-service.mjs)的触发：options.service 只能有 artifact/externalSourceRoots；必须恰好一个选中的完整 service deployment；artifact ID 须能成为 bounded 非关键字 stem；有 service.projections 时该 renderer 显式拒绝；bootstrap 必须是声明的合格 FQN factory；一个 port 只能对应一个 HTTP endpoint。hasPages 决定页面合同/Loader 分支。名称仍 `artifact stem + Service`，因此真实产物出现 **BankServiceService**。

正式产物没有经典应用服务的 methods/constructor/body 模型。它安装 `Endpoint[I,O].run` 回调；生成器不知道回调内实际业务。把 entire BankServiceService 归 A 或将它改成 DepositService，都会吞掉其它 owner 的职责。

#### 5.2.1 复合文件逐成员 A/B 与唯一装配 owner

以下逻辑 owner 沿中央 `formal-service/*`；**全部相关物理文件由 `play-http-assembly` 单一装配**，源码热点写权仍 main-integrator。特别按 [js-partition.json](../js-partition.json) 的精确 id `formal-service/application-bootstrap/play`（A）与 `formal-service/play-loader/lifecycle`（B）分开，两行 `target.assemblyOwner` 均为 `play-http-assembly`，不修改中央分区。目标路径是中央职责位置，不是新公开 ABI 的批准；private[service]/嵌套可见性拆迁仍 blocked。

| 当前完整成员/构造 | 分类与唯一逻辑承接 | 目标位置（相对目标工程） |
|---|---|---|
| BankServiceService 头/package/import/object 边界 | assembler，不重复算一个 A；拆后各完整文件各发一次头/import | 由以下输出各自需要的引用推导 |
| Principal(id,roles)、Authority.authenticate/csrf、Failure.status/code、六个 Failure object、Outcome alias | B `http-contract/security-json` | `app/<basePath>/infrastructure/connectors/http/<Service>HttpContract.scala` |
| decodeBody 全体 | 同一 B；JsonFactory→STRICT_DUPLICATE_DETECTION→parser token 循环→depth 0..64/单 root 检查→Json.parse；finally close；NonFatal→InvalidRequest | 同 HttpContract；不因有方法 body 自动归 application-service |
| Endpoint 的 implementation/version/Reads/Writes/run 五字段、Bindings 的十四个 typed Endpoint 成员 | B `http-contract/endpoint-bindings`；run 是 Function2 值槽，不是已实现业务服务 | `app/<basePath>/infrastructure/connectors/http/<Service>EndpointBindings.scala` |
| PageRenderer 的 implementation/version/shell/script/render 声明 | B `page-contract/renderer` | `app/<basePath>/infrastructure/connectors/http/<Service>PageRenderer.scala` |
| Composition extends AutoCloseable、authority/bindings/ready、`pages=None`；Factory 的 implementation/version/create；**完整 requireInstalled** | B `service-composition/factory-contract` | `app/<basePath>/infrastructure/bootstrap/<Service>Composition.scala` |
| requireInstalled 的各 endpoint 检查、val installedPages、page pin require | 仍由上一 Composition owner 独占，不转给 PageRenderer；先非空总检，再按端点顺序验证 implementation/version/reads/writes/run，最后 renderer pin | 同 Composition |
| ApplicationBootstrap.load：配置验证→反射 factory→pin→create；try 内 requireInstalled→Components.application；catch lifecycle.stop→close→rethrow | A `formal-service/application-bootstrap/play` / `application-bootstrap`；factory 创建仍在 try 外，不扩大 cleanup 覆盖 | `app/<basePath>/infrastructure/bootstrap/ApplicationBootstrap.scala`；assemblyOwner=`play-http-assembly` |
| Components 的 Response/failure/invoke/action 与 parser 错误转换 callback | A `http-controller/actions`，不是本族；保留 reads→run→结果转换及 ready/auth/role/CSRF/parse 的顺序 | `app/controllers/<Service>Controller.scala` |
| Route/路由行、apiActions/pageActions/actions、router 选择 | A `route-definition`；private 嵌套类型对 controller 的引用由 assembler 一次接好 | `conf/routes` 及 controller 所需源码，不双写同成员 |
| 页面 staticHeaders/htmlHeaders/unavailableHtml/response/staticPage | B `page-delivery/http-presentation`；消费同一 Response，不再复制 parser 或 renderer 初始化 | `app/controllers/<Service>Pages.scala` |
| Loader.load 委托、Components extends BuiltInComponentsFromContext 壳、implicit EC、空 httpFilters、stop hook；有 pages 时 requireInstalled→pages.get 的 pageRenderer 初始化 | B `formal-service/play-loader/lifecycle`；不归 A/application-bootstrap，也不搬去 PageRenderer trait；action/router 另归各 A owner | `app/<basePath>/infrastructure/bootstrap/<Service>Loader.scala` 和 `app/<basePath>/infrastructure/bootstrap/<Service>Components.scala`；assemblyOwner=`play-http-assembly` |

页面生成源码全文见 [render-service-pages.mjs](../baseline/js/generators/scala-cqrs-play-service/render-service-pages.mjs)。其 stop hook 是 `Future(composition.close())`；接口/调用存在不证明 close 已完整 drain。本文只保留这些真实职责，不接管生命周期。**当前正式银行分支的本族独立 counterpart 仍 missing-counterpart**，而不是“所有 JS 都缺应用服务”。

### 5.3 family8：真实 command-service/port 已存在，非正式银行的当前 producer

完整实读 [build-models](../baseline/js/generators/scala-cqrs-play-application-v1/build-models.mjs)、[services template](../baseline/js/generators/scala-cqrs-play-application-v1/templates/services.mjs)、[API/commands template](../baseline/js/generators/scala-cqrs-play-application-v1/templates/api.mjs)、[generate](../baseline/js/generators/scala-cqrs-play-application-v1/generate.mjs)、[render](../baseline/js/generators/scala-cqrs-play-application-v1/render.mjs)。

触发必须有固定 manifest、完整 **ten-product closure**（persistence 基础加 api-contract/application-composition）、精确重新 lowering 相等的 API/技术装配、live implementations 与 outDir。`generate-products` 对要求 implementation capture 的 producer 包括 plan 都拒绝；需走 generate-project。注册 family8 不等银行已选它。

#### 模型 / Builder

返回模型完整顶层字段顺序为 `api, composition, persistence, names, commands, resource, query, view, sources`；不是 ApplicationServiceModel 的直译。options 只接受 packages/names/protobuf，沿 MODULAR_CANDIDATE 解析名字和物理模块。

- roles 中 commands 是 kernel/application.api，commandService 是 glue/infrastructure.web；这是**当前**位置。中央目标分别为 kernel/application.services 与 glue/application.services，不误写为现状。
- names 每项带 resolved name/identifier、module/package/fqn/path；API aggregate 必须与 override.ref 一致，继承成员/framework 保留名及冲突被拒绝；method 的 execute/close 等也明确禁用。
- `commands = api.commands.map`：查同 ref 的 domain command/event，否则拒绝；每项保留 c 原声明并增加 method/requestName/domain/event/fields/results/resource。fields 每项保留 f、命名结果、carrier 和所绑定 domain field；results 同理绑定 event slot；resource 选 path 字段。
- carrier 从 nominal 外到内解析单字段值对象，检查缺失/循环/非单字段；记录 `{primitive, chain:[{fqn,accessor,path}]}`。不把独立名义类型合并。
- query 保存原 query 与命名 key/value、keyCarrier/valueCarrier；view 为派生视图名/路径；sources 为 API/composition/persistence 来源。`scalarType` 返回最外 carrier FQN（否则 String/Long/Boolean），`unwrap` 按 chain 顺序读 accessor，见 [syntax.mjs](../baseline/js/generators/scala-cqrs-play-application-v1/templates/syntax.mjs)。

#### 输出 construct / RHS

| 顺序/分支 | 完整规则 |
|---|---|
| service imports | 依次 typed ActorSystem/Scheduler、AskPattern._、java TimeoutException、akka Timeout、API._、EC/Future、duration._、NonFatal；依赖类型大量直接 FQN，尚非共同 import 模型 |
| service class | `final class <CommandService>(repository: <Repository>[String], directory: <Directory>, system: ActorSystem[_], askMillis: Int) extends <Commands>`；无 @Inject/@Singleton、无 implicit ctor list |
| 构造执行 | 先 require repository/directory/system 非 null 且 `0 < askMillis <= 5000`；再 private implicit ec=`system.executionContext`、scheduler=`system.scheduler`、timeout=`Timeout(askMillis.millis)` |
| helper 类型 | `private def execute[A <: <Protocol>.Event](resource: <nominal>, command: <Protocol>.Command)(select: PartialFunction[<Protocol>.Event,A]): Future[Outcome[CommandResult[A]]]`；两个显式参数组及真实上界，不用 Any/String dispatcher |
| helper 初段 | key=`unwrap(resource)`；`directory.find(key).isEmpty` → `Future.successful(Left(MissingResource))`，在 try **之前**，不 ask |
| ask | try 内 `repository.get(key).ref.ask[<ActorProtocol>.Reply](<ActorProtocol>.Execute(command, _))`；typed replyTo 由 ask lambda 提供，纯 domain command 本身无 ActorRef |
| 成功与拒绝 | Accepted(events) 且空 → Right(NoChange)；Accepted(Vector(event)) 且 selector 定义 → Right(Applied(select(event)))；Rejected(code) → Left(DomainRejected(code))；其它（含多事件/不匹配事件）→ Left(InternalFailure) |
| Future 失败 | TimeoutException → Left(OutcomeUnknown)，其它 NonFatal → Left(InternalFailure)；不能把超时当“确定没执行” |
| 同步失败 | try 范围内 IllegalStateException → Future Left(Unavailable)；不是捕获整个方法所有异常，directory.find 在范围外 |
| 每业务方法 | methods 按 m.commands 顺序输出 override def Request→Future typed Outcome；domain command 实参按 **domain.fields** 顺序，从 c.fields 的绑定映射取 request 字段；selector 为 `case event: <exact Event> => event`，不重做领域决定 |
| Commands 文件 | package、Future、API._；trait；逐命令同样 typed Request/Outcome 签名，**无 RHS**；无 Actor replyTo，不是 application-protocol |
| API 邻居 | Failure/Outcome/CommandResult[+A]/Applied/NoChange、Request DTO、ReceiptPosition/Item/Page 属其它 API/DTO 构造；不是本族私造同名副本 |

该 helper 的 Event 上界、PartialFunction、多个返回臂均来自固定源码。错误/Unknown/NoChange 是该 API 合同，不能替 raw 任意返回类型或 classic iMadzError；NoChange 不是 `???` 的兜底。它只转发命令并翻译 actor 回复，持久化/事件应用/新 state 回复由 aggregate owner 负责。

[render L20–27](../baseline/js/generators/scala-cqrs-play-application-v1/render.mjs#L20)分别安排完整文件 jobs：commands(kind application-service-port, dep API)、commandService(kind application-service, deps commands/directory/aggregate.repository)；共用 services.mjs 的 queryServiceTemplate 归 query-service，不可被本族覆盖。唯一 owner 为 `family-readside-play/command-service/assembly` 与 `family-readside-play/command-service-port/assembly`，每个文件只有一个 source entry。

D05 的 Directory 接缝已有中央归属：[js-partition.json](../js-partition.json) 的 **`family-readside-play/resource-directory`（B）**，当前为 `modules/glue/src/main/scala/<basePath>/infrastructure/web/<Aggregate>Directory.scala`，目标已定为 **`modules/kernel/src/main/scala/<basePath>/application/services/<Aggregate>ResourceDirectory.scala`**；精确 assemblyOwner 是 **`family-readside-play/resource-directory/assembly`**。[固定 directoryTemplate L18–38](../baseline/js/generators/scala-cqrs-play-application-v1/templates/authority.mjs#L18)承载 ResourceBinding 三标识、bounded/唯一性约束、find/byPid 和按 composition.resources 声明序构造的 declared，不含 Play I/O。不是缺少待发明的新 Directory trait；仍需该 owner 协同审定最终 ABI 与所有消费者/FQN/构造接线，不能只搬 CommandService。JSON dependsOn 对此 logical id 的引用是**接口协同依赖，不是生成 artifact deps 或反向依赖环**，不扩大 6 proposed / 32 shared 写集合。

### 5.4 其它真实可达 producer（不是同源合并，也不复活退休入口）

| 逻辑对应 | 固定源码、触发与 construct/RHS | 分类、目标与唯一 owner |
|---|---|---|
| module-seams flow | [buildModels L104–111、193–195](../baseline/js/generators/scala-cqrs-module-seams-v1/build-models.mjs#L104)、[portTemplate/resultType L19–34、53–57](../baseline/js/generators/scala-cqrs-module-seams-v1/templates/scala.mjs#L19)、[generate](../baseline/js/generators/scala-cqrs-module-seams-v1/generate.mjs)：完整 contract/composition@1 与 live capture；role=flow（不是按 QuoteFlow 名硬编码）；trait、方法原序、effect=future 才包 Future，否则纯返回；_root_ FQN、无 imports、无 body | 部分 A/application-service，声明级；`modules/kernel/src/main/scala/<basePath>/application/services/<FlowPortName>.scala`；`family-seams-saga.seams-port-assembly` |
| module-seams bridge/root | 同[scala.mjs L58–97](../baseline/js/generators/scala-cqrs-module-seams-v1/templates/scala.mjs#L58)：bridge 按方法/实参顺序委托给 delegate/object；root 按显式构造参数组 new/apply，再返回 resultIdentifier，不执行 flow 业务方法 | B；各为 `family-seams-saga.seams-bridge-assembly`、`family-seams-saga.seams-root-assembly`；不能算完整 ApplicationBootstrap 或生成了算法 |
| legacy policy mechanics | [policyexec.mjs L98–129、232–265、355–366](../baseline/js/generators/policy-dsl/policyexec.mjs#L98)，[run-all L2055–2065](../baseline/js/generators/run-all.mjs#L2055)：policy+executionSide；首 invokes/triggers；缺命令/事件/entityIdField 拒绝，generate=false 不关闭执行侧；object，private implicit 10s Timeout；`execute(sharding)(implicit ec): Params => Future[Either[iMadzError,Unit]]`；entityRefFor(key,p.id.toString)→ask→Reply(None)/Reply(Some(e)) 两臂；排 dataType 以 ActorRef 开头的参数后末尾加 `_`，reply 名拼 CmdReply | R07 部分 A；中央暂记 `app/<basePath>/application/projection/policy/<Command>Mechanics.scala`，与目标 services 收敛仍 D07，不暗自改中央；owner `legacy-orchestration/policy/sharding-mechanics/assembler` |
| retired command-dispatch | [retired generate L40–95、150–177、253–258](../baseline/js/generators/_deprecated/scala-cqrs-es-policy-exec/generate.mjs#L40)：canonical aggregate policies.executionSide，验证 cmd.parameters/reply.name/entityIdField/evtHostAgg/evtPayloads；显式旧 generatorDir 经 legacy plan 可达；同样 object/10s/curried execute/entityRefFor/ask/None-Some 映射，但排参条件为 name!=replyTo，reply 来自 cmd.reply.name，release 来自 canonical | 部分 A；目标 `app/<basePath>/application/services/<Cmd>PolicyCommandService.scala`；`retired-seven/policy-exec/command-dispatch-assembler`；存在不授权复活 |
| 两种 policy 邻居 | legacy handlerFile/retired renderHandler 是 decode→decide→execute→dispose/bury 的投递；policyFile/renderPolicy 是决定/处置适配，不是 read/apply/write 投影事务 | B；分别保留 delivery-handler/execution-decision 与 envelope-handler/decision-disposal 的独立 assembler，不重复占 mechanics 成员 |

legacy 与 retired mechanics 都假设单 error 字段 Reply 解构，未生成一般回复字段映射/失败 Future 恢复；不能照它们给银行任意命令配置通用 `Right(())`。退休 **support-controller 任意 path/content、projection manualBlocks、implOverrides 三槽仍全部 blocked**；已读固定样本不覆盖任意输入，不用 B 兜底，也不报“638 已完整”。

## 6. 明确 minus / plus：结构性对照，不是同输入字节比较

### 6.1 legacy 模板到 classic 方法结构（不是可以直接应用的源码补丁）

minus 是真实 [emit.mjs L61–68](../baseline/js/generators/service-dsl/emit.mjs#L61)，plus 是按 raw 方法模板与 Examples Deposit 签名具体化的 **Scala 结构目标例**。两侧层级/输入不同，**结构性对照，非同输入字节比较**。plus 保留未完成槽，专用于 raw 内容讨论，不是允许产品准入输出 `???`；实施方法体仍受 D01/D02 阻断。

```diff
-  const methods = (spec.methods || []).map(m => {
-    const params = (m.parameters || []).map(p => `${scalaId(p.name)}: ${p.typeRef}`).join(", ");
-    return `  def ${m.name}(${params}): ${m.returnType} = {
-    // ==== BEGIN MANUAL ====
-    ???
-    // ==== END MANUAL ====
-  }`;
-  }).join("\n\n");
+  def requestDeposit(userId: Id, amount: Money): Future[CreditBalanceConfirmation] = {
+    // ==== BEGIN MANUAL ====
+    ???
+    // ==== END MANUAL ====
+  }
```

plus 的 Id/Money/Confirmation 必须由实际 owner imports 解析，不靠字符串扫描推导类型；完整文件的 annotation/ctor/import/method 顺序见 T01–T11。它**不表示 raw 会采用 curated 的 ask body**，更不表示银行已有 requestDeposit 业务实例。参数 keyword 的真实修正合同是 `scalaId` 恒等 → 共享 resolver 的 escaped identifier；不能为此另发明一份关键字表。

### 6.2 真实银行 composite 的 B 字段拆分目标例

minus 为 [BankServiceService L44–48](../baseline/actual-js/app/example/bankwealth/service/BankServiceService.scala#L44)的原文截段；plus 明确是 EndpointBindings 目标片段，保持同一 Endpoint 类型/字段顺序/函数语义，仅由共享名字/import/文件 owner 收敛。不是全文件删除其余十三个成员，完整循环必须全量保留。**结构性对照，非同输入完整文件字节比较；可见性/FQN 迁移尚待 D06。**

```diff
   final case class Endpoint[I, O](implementation: String, version: String, reads: Reads[I], writes: Writes[O],
     run: (Principal, I) => Future[Outcome[O]])
   final case class Bindings(
-    BankAccountQuery: Endpoint[example.bankwealth.domain.values.BankAccountKey, example.bankwealth.domain.values.BankAccountResponse],
-    BankCashSubmitPort: Endpoint[example.bankwealth.domain.values.BankCashSubmit, example.bankwealth.domain.values.BankCashAcknowledgement],
+    bankAccountQuery: Endpoint[BankAccountKey, BankAccountResponse],
+    bankCashSubmitPort: Endpoint[BankCashSubmit, BankCashAcknowledgement],
```

plus 位于 `infrastructure/connectors/http/BankServiceEndpointBindings.scala` 对应目标，imports 正常引入四个名义类型；Principal/Outcome 从单一 HttpContract owner 引用。完整方法体、installation pins、wire IDs 与业务 port refs 不改；旧 `.service` 不是获准保留的第四层。**此 diff 的字段是 B，不借它给 application-service 的 A 覆盖充数。**

### 6.3 curated 并不等 raw 目标算法

- Deposit/Withdraw：无 @Singleton、无 implicit EC 构造参数；各有 `implicit val askTimeout = Timeout(30 seconds)`；直接 `repository.findCreditBalanceByUserId(userId).ask(Deposit/Withdraw(amount,_))`，返回原 Confirmation，无通用 Left/Right 包装、无 recover。
- curated [CreditBalanceRepository L9–12](../baseline/curated-scala/net/imadz/application/aggregates/repository/CreditBalanceRepository.scala#L9)已明确 `findCreditBalanceByUserId(userId: Id): EntityRef[CreditBalanceCommand]`，**不是 Future[EntityRef]**。Examples L185–189 的 referenceCode 却使用 `find...flatMap(_.ask...)`，与这份 curated 接口不一致；本 Template 又根本不发 referenceCode。已知事实不能合并成已验证实现，D07 待决的是目标合同选择/适配，不是 curated 源码未定位。
- Create：注入 **factory**，不是 raw example 的 repo。[固定 factory L19–30](../baseline/curated-scala/net/imadz/application/aggregates/factories/CreditBalanceAggregateFactory.scala#L19)中，`createCreditBalanceWithoutBalance(userId: Id): EntityRef[CreditBalanceCommand]` 直接 entityRefFor；`createCreditBalanceWithDefaultBalance(userId: Id, initial: Money): Future[Either[iMadzError, EntityRef[CreditBalanceCommand]]]` 先取得 EntityRef 再 ask(AddInitial)，confirmation.error 映射 Left，否则 Right(entityRef)。服务单参数重载取 bare EntityRef 后 fetch；两参数重载 flatMap/Either.fold，Left 返回 Future Left，Right 才 fetch；private fetch ask(GetBalance.apply)，按 confirmation.error 映射 Left，否则 Right(balances)。有 overload/private helper/global EC，raw Model 不表达这些结构槽。
- MoneyTransfer：额外 TransferSubmission case class、companion StartAckWindow=2.seconds、ApplicationService/Saga bootstrap 继承；classic→typed，隐式 EC/Scheduler，runner 从 coordinatorRef 构造；transfer 先 Id.gen，再 runner.run、submission，再 firstCompletedOf：快速完成/快速 SagaStartRejectedException/其它中途失败与 2s timer；statusOf 委托 runner。返回 submission 不等资金已完成。raw MoneyTransfer dependencies 为空、参数 from/to、return TransactionResultConfirmation/referenceCode 另有形状，不能自动填成 curated。

以上 RHS 只说明四份固定参考的职责；不复制它们作为正式银行实现或声称恢复、超时、幂等已实测。

## 7. 目标、胶水与实施槽合同

### 7.1 本族目标的有限要求

1. 经典 single 类目标在 `app/<basePath>/application/services/<ResolvedServiceName>.scala`，先保留注入 class 的内容规格；multi 应否移入 glue 由 D05 明确，raw fallback 单列保留。
2. Builder 输出结构化 selfType、全部方法/参数/返回值、完整结构依赖、**独立有序注入依赖**及明确实现来源；Template 负责语法，不把整文件 content 或银行算法塞入 Builder。
3. 结构依赖先完整收集，再按文件作用域计算 imports；simple-name 冲突应拒绝或有限 alias；构造器用真实泛型 signature，不用 suffix 白名单冒充注入权限。
4. 复用 resolveName/resolveNameSet/resolveArtifactPath；完整 binding 与 affix 拒绝合同遵循 SHARED-SEAMS。类型 PascalCase、成员 lowerCamelCase，关键字正确引用。不得改 knowledge/operation/PID/protobuf/codec 身份；不会靠正则删 ServiceService 或无意义 nextN 刷指标。
5. `???`、MANUAL、referenceCode、typed 外置实现必须有不同来源状态。正式 product-plan 明确拒绝 `???`；选择未完成 classic 服务时应在准入报告缺实现，不能改成 Future.successful(Right(()))/空 DTO，不能放宽准入门。
6. 本族不负责把纯 Event/Param 注入 ActorRef；真实 Actor command 依 explicit reply 合同生成 typed replyTo，并由 application-protocol 提供 Commands/Replies 分组；CommandHelper 三方法与 runReplyingPolicy 属相邻 owner，不在服务内复制持久化逻辑。

### 7.2 精确胶水归属

| import / 符号 | 来源与必需 API/语义 | 目标限制 |
|---|---|---|
| `javax.inject.{Inject, Singleton}` | raw annotation / DI 构造入口；scaffold/Play 依赖闭包 | 注解不等实例 eager 创建；family8 显式装配不能假称相同 DI 模型 |
| `scala.concurrent.{ExecutionContext, Future}` | raw implicit ctor EC、方法声明；family8 system.executionContext 与 Future.map/recover | 不偷偷改成 global EC 或阻塞等待 |
| `akka.actor.ActorSystem` 与 `akka.actor.typed.scaladsl.adapter._` | raw 注入 classic、`classicSystem.toTyped` | type ref 的 typed ActorSystem 与 ctor classic 分开；不是创建第二个 system |
| `akka.actor.typed.{ActorSystem,Scheduler}`, `akka.actor.typed.scaladsl.AskPattern._`, `akka.util.Timeout` | family8 typed system、scheduler、timeout、ref.ask | 当前 0<askMillis<=5000 是其合同，不替换 curated 30s/raw 无 timeout；异常语义逐臂保留 |
| `java.util.concurrent.TimeoutException`, `scala.util.control.NonFatal`, `scala.concurrent.duration._` | family8 recover/同步 catch 与 millis | Timeout→OutcomeUnknown 非业务拒绝；catch 范围不扩大后假称等价 |
| `net.imadz.common.CommonTypes.{ApplicationService,Id,iMadzError}` | [CommonTypes.scala](../baseline/common/src/main/scala/net/imadz/common/CommonTypes.scala)：marker trait、UUID alias、case class error(code,message) extends Throwable with CborSerializable | raw Template **不 extends ApplicationService**；curated MoneyTransfer 使用 marker；是否统一继承是有限覆盖 D03，不是假称 raw 已有 |
| `net.imadz.common.Id` | UUID.fromString / randomUUID | 不替银行名义 ID 或替调用者猜 txId |
| `net.imadz.common.application.CommandHandlerReplyingBehavior` | 共同胶水边界；发布 helper 的 `(rule,helper,state,command)`、replyWith、replyWithAndPublish | 本服务不调用；不发明 withPost/policy named API；replyWith 不等发布，成功回复读事件应用后新 state 归 aggregate owner |
| `<AggregateRepository>`, `<Commands>`, `<ActorProtocol>`, `<Api>` | 对应本工程唯一生成 owner，不是 common jar 的统一服务 SPI | 指明 nominal 类型与返回 shape；Directory 当前在 glue/infrastructure.web，但已分配 `family-readside-play/resource-directory` → kernel/application.services/`<Aggregate>ResourceDirectory`，owner=`family-readside-play/resource-directory/assembly`；D05 仅保留最终 ABI/所有消费者闭合，不新造能力 trait |
| Play ApplicationLoader/Reads/Writes/RequestHeader/Result、Jackson parser | 正式 HTTP/composition B/A 邻接文件的框架胶水 | 不带入经典纯应用方法模型；decode/CSRF/pin/关闭职责按 §5.2 owner |

**已裁定的供给事实**：用户给定工作区 common-core/ 即 `net.imadz:common-core_2.13:0.2` 已发布制品对应源码，发布制品优先；本文未读 jar。`withPost`/`policy` 只属 BC scaffold 分歧，不是目标发布 API。[胶水合同](../glue-dependencies.md)已记录 source-copy 的同 FQN 遮蔽；本族只提出“移除冲突 source-copy/确定唯一 classpath owner”的依赖，不调查演进、不改 glue、不发布运行库。raw scaffold 0.2 与正式银行冻结 Saga/Monarch 0.3.0 不是同一个版本证据。

## 8. 具体未来 JS 写集合与单一写权

以下均为**未来条件写集合，实施未授权**；本次只写两份文档。新路径采用相邻 query-service 工作包的 `model.mjs/build-models.mjs/templates/render.mjs` 命名，避免另造同义目录树。

### 8.1 本组 proposed 新文件

| 路径 | 职责 |
|---|---|
| `generators/application-service/model.mjs` | 经典服务结构记录，保留全部 raw 字段与已批准的来源/注入区别，不存整文件字符串 |
| `generators/application-service/build-models.mjs` | 类型、名字、方法、实现来源和依赖组装；不猜银行 body |
| `generators/application-service/templates/application-service.mjs` | T01–T11 的目标语法；raw 仅讨论槽与可执行 typed implementation 分开 |
| `generators/application-service/render.mjs` | 完整文件 job/source entry，按最终字节一次回锚 |
| `generators/scala-cqrs-play-application-v1/templates/command-service.mjs` | 从 services.mjs 分离本族 command body，query 留 query owner |
| `generators/scala-cqrs-play-application-v1/templates/commands.mjs` | 从 api.mjs 分离本族声明；DTO/Failure/query port 留各 owner |

新目录本身不建立另一公开 producer；是否接现有 formal producer 或注册独立 producer 是 D01，未裁定前不创建 generator.json、不声称存在 CLI flag。

### 8.2 existing/shared：全部 main-integrator

- legacy 入口拆分：`generators/service-dsl/emit.mjs`、`generators/service-dsl/parse.mjs`、`generators/service-dsl/generator.json`、`generators/run-all.mjs`。不可连带覆盖 domain/query/port 分支；旧单独 emitter 写盘的保留/退役需显式说明。
- family8：`generators/scala-cqrs-play-application-v1/build-models.mjs`、`render.mjs`、`generate.mjs`、`generator.json`、`templates/services.mjs`、`templates/api.mjs`、`templates/application.mjs`；从同一 model 与文件 job 接线，不能两个 owner 竞写一个文件。
- 正式 Play 及继承 registry（仅选定接线方案才改）：`generators/scala-cqrs-play-service/render-service.mjs`、`render-service-pages.mjs`、`generate.mjs`、`generator.json`；`generators/scala-cqrs-application/produce.mjs`、`produce-effect.mjs`。HTTP/B 细分按其它 diff 承接，本族不拥有整 Play renderer。
- 其它 consumer 的条件适配：`generators/scala-cqrs-module-seams-v1/build-models.mjs`、`templates/scala.mjs`、`render.mjs`；`generators/policy-dsl/policyexec.mjs`、`generators/_deprecated/scala-cqrs-es-policy-exec/generate.mjs`。退休文件列为兼容/拒绝/退役协调面，不是复活授权。
- 共享 names/type/profile/admission/writer/mapping：`lib/scala-target/naming.mjs`、`lib/scala-target/profiles.mjs`、`lib/scala-target/model.mjs`、`lib/products/generate-cli.mjs`、`lib/products/registry.mjs`、`src/core/product-plan.mjs`、`src/core/generate.mjs`、`src/core/code-mappings.mjs`、`generators/scala-cqrs-domain-kernel-v1/entry.mjs`、`render.mjs`。优先复用；列入依赖不意味着必须修改每个文件，所有现有公共接口均由集成者独占。

### 8.3 调用方、旧输出与回锚迁移

主集成者提供旧→新 path/FQN/member 映射，统一更新 Controller、Composition/Factory、family8 application constructor、policy delivery、typed implementations 及 generation config；业务实现与其独立 BDD/oracle 仍属手写隔离，不因为由 Agent 写过就变模板领地。

旧 `.service/BankServiceService.scala` 不能整体移成 ApplicationService；按 §5.2 拆逻辑项，保留十四个 binding 的身份、pins、来源和所有 callback。old name 的源码调用、private 范围、imports、配置引用全部在同一候选计划闭合后，才决定旧输出退役。

共享 [product-plan](../baseline/js/src/core/product-plan.mjs)要求完整 deps 与两次 detached plan 一致，禁止 `???`、路径 alias；[generate L134–268](../baseline/js/src/core/generate.mjs#L134)负责 capture/preflight/final bytes/apply/ledger/anchors，旧 owned 文件不在新 plan 时 **RETAINED，不自动删除**。不可手改 ledger、清理 current 或 rm 旧文件“完成迁移”。

[applicationSourceEntry/mappedEntry](../baseline/js/generators/scala-cqrs-domain-kernel-v1/entry.mjs#L28)先 header、逐 chunk 累积 UTF-8 byte spans；[补充 code-mappings](../supplemental/js/src/core/code-mappings.mjs)校验真实字节、scope 包含及 MANUAL 后唯一重定位。先定完整文件/格式再记 span/fingerprint；失配 fallback 到文件级位置不能称成员级回锚已通过；不新增 @knowledge 作者字段。

## 9. 验收规格（当前全部未执行）

### 9.1 必要输入/expected 矩阵

| fixture 维度 | 必须对账的内容，不用计数代替 |
|---|---|
| raw 基本/空集合 | 0 服务/1 服务/多服务、0 方法/多方法、返回非 Future/嵌套 Future/Either；每文件头、实际路径与 ledgerPath 分账（multi 的 app/app raw 缺陷）、完整 imports/construct/RHS |
| 参数/函数 | keyword、泛型/tuple/FunctionN、同名 overload、optional/optionalWhen、noteId/description/default/comment、referenceCode None/Some(空)/Some(代码)；验证未消费槽不能被偷偷当已实现 |
| 注入/类型 | 同包 service、跨包同名、泛型 Repository、仅方法类型符合 suffix、无依赖、有 classic/typed/custom ActorSystem、scala.concurrent.Promise/java 包；分别定位 raw 缺陷与 target 的有限修正 |
| 手写边界 | 首填无实现拒绝；获准独立实现后完整 body 来源与测试；raw MANUAL 最近匹配 def 名/同名及匿名出现序、新块 incoming、无 markers/旧块孤立拒写、同名重载重排错配与未来身份保护分账；不覆盖非本组源码 |
| family8 | missing resource 不 ask；Accepted 空/一匹配/多/不匹配；Rejected、timeout unknown、Future NonFatal、同步 closed repo；domain 字段顺序不同于 DTO 字段时仍正确绑定；名义 carrier 不丢 |
| 其它 A | module-seams pure/future 返回与无 RHS 区别；legacy vs retired 的 reply/参数过滤差异和缺 metadata 拒绝；每文件唯一 owner |
| composite | pages 有/无、十四个 endpoint 与各类型/角色/pin、decode 单 root/重复键/深度及 parser close、private 迁移/停止 owner、同一错误及 Response 不复制 |
| 稳定性/回锚 | 同输入两次完整文件字节相等；一个方法/字段变更只影响其闭包；公开 query 能定位新成员，手写与保留路径正确报告 |

遵循 FIXTURE 合同，保存 **raw 输入+raw 实际输出、curated 原字节、用户有限覆盖后的完整 expected、新 JS 公开 CLI 实际输出**；每份附来源 SHA/profile/input mapping/variant。比较 raw→target、actual JS→target 两份完整 diff，不抹 package/空白后假称字节 parity。

当前没有 application-service 专属双端无损 adapter、全部变体 expected 或 runner。F1 是 classic CreditBalance 参考，不自动覆盖这些服务/重载/Saga；family8 Warehouse 与现银行也不是其同输入。上述缺口必须裁定后才能生成，不能为了 fixture 方便修改旧固定资料。

### 9.2 已知命令形状及副作用边界

以下仅说明真实公开入口，**未执行**，不发明专属 spec/CLI flag：

```bash
# generator 由显式项目配置选择；family8/module-seams 必须使用 live project capture
node /absolute/tool/bin/truthsrc.js generate-project \
  --project /absolute/owned-project/truthsrc.project.json \
  --out /absolute/new-target --plan

# 仅用于不要求 live implementation capture 的已注册 producer，例如现 formal Play
node /absolute/tool/bin/truthsrc.js generate-products \
  --request /absolute/derived-request-manifest.json \
  --generator /absolute/tool/generators/scala-cqrs-play-service \
  --out /absolute/new-target --options-json /absolute/options.json --plan

# 仅 legacy renderer 的明确 spec 对照，不冒充公共生成闭环
node /absolute/tool/generators/service-dsl/emit.mjs \
  /absolute/owned-application-service-spec.json /absolute/new-legacy-output

# BC 传统入口；实际是生成，不是 preview，必须在另获准窗口使用
JAVA_OPTS="-Dcodegen.system=Examples -Dcodegen.targetDir=/absolute/new-target" \
  sbt "runMain net.imadz.codegen.CodegenMain"
```

project plan 会 live capture/内存编译/roundtrip 临时目录；product plan 读 manifest/request/options，现 Play 还核本地冻结 runtime jar 和外置根。legacy emitter 直接 mkdir/write；BC 可写 target、scaffold、ledger、manifest、formal-semantics 及 sbt/依赖缓存。真正 apply 会写源文件与 ledger/anchors，失败不保证回滚。以上都不是本次文档研究可以执行的命令；中央装配脚本也只阅读其格式，未运行。

未来集中一个最小闭包验证真实方法调用/typed ask/错误结果及必要生命周期，不逐模板重复启动 sbt。编译/tests/typecheck 不能替真实接口观察；不运行旧银行 workshop37/38 来给新候选签证。

CC 普通方法目标≤5；6–10需逐方法解释，>10需重构或逐方法认可例外。execute/decodeBody/requireInstalled 是需要实际度量的具体方法，不杜撰数字；不能用 String/Any dispatcher、反射或 helper1/nextN 降表面分数。度量工具/版本/口径和行宽等沿中央合同，当前 **CC not-measured**。

## 10. 具体未决项与有限偏差

| ID | 未决内容 / 影响 |
|---|---|
| D01 | 经典 application-service 的 formal product/输入适配/producer 接线，以及 typed 外置实现准入；当前正式银行 counterpart 缺失，legacy 注册不补这个缺口 |
| D02 | bodyLogic/referenceCode 的保留方式、未实现拒绝与 MANUAL/外置实现的唯一所有权；raw 最近匹配 def 名/同名出现序及孤块拒写已知（M01–M05），待裁定未来 overload/改名唯一身份与回锚保护，不能关闭 `???` 准入门或自动搬 curated 银行算法 |
| D03 | raw 不继承 ApplicationService、不消费 description/invariants/optional/default/注释/notes、方法名未转义的逐项有限覆盖；raw 与 target 分别保存，不能静默“修正基线” |
| D04 | raw 先过滤依赖导致同包注入丢失、Set 构造顺序、显式泛型子依赖未递归、constructor 丢泛型、简单名冲突、scala/java 前缀粗过滤、ActorSystem 两处判断不一致；统一结构依赖/注入/import 合同由共享 owner 裁定 |
| D05 | classic multi fallback 的目标模块归属；family8 的 `family-readside-play/resource-directory` 已定 kernel/application.services/`<Aggregate>ResourceDirectory`，assemblyOwner=`family-readside-play/resource-directory/assembly`，仅最终 ABI/所有消费者闭合待审；不得只搬 CommandService、另造 Directory trait 或改变 typed timeout/Unknown 语义 |
| D06 | Play 每个嵌套类型/成员拆分后的 private 可见性、单一 HttpContract/EndpointBindings/Composition/Response 接口和全部调用方更新；owner 已定不等 public ABI 已准；BankServiceService 旧路径退役仍需计划 |
| D07 | legacy policy Mechanics 暂列 projection.policy 与本族目标 services 的有限迁移、单 error Reply 假设；curated repo/无余额 factory 的 bare EntityRef、有初始余额 factory 的 Future[Either] 已知，待决的是与 Examples flatMap 不一致时的目标合同选择/适配及 curated Saga 返回体差异；不是接口源码未定位，拒绝含糊通用成功 |
| D08 | 已发布 common-core:0.2 优先规则下消除 scaffold 同 FQN 遮蔽；actual classpath/字节尚未核；本组不调查演进或改发布接口 |
| D09 | service 专属无损双端 fixture、每变体完整 expected、实际接口 runner 和 CC 工具/口径尚未冻结；没有同输入就仅报告结构对照 |
| R-blocked | 三退休任意源码槽（support-controller path/content、projection manualBlocks、implOverrides）持续 blocked，不以 B 或样本推全称 |

### 10.1 非阻塞澄清（不计入 openDecisions）

**D10 / resolvedClarifications**：现有 `ServiceMethod → ApplicationServiceMethodModel` 与 `ParameterMetadata → FieldDef` 支撑链完整。独立 Function API 未被这条链调用，条件性的另一份 AST 不构成本族阻塞；没有另行明确 API 需求就无需补拷或继续寻找。澄清不表示任意 Function API 已支持，也不解除其它实施门。

结论：本族 raw 内容、近似 legacy、正式银行缺接线、family8 实际 typed 调用、其它部分 A 及复合文件 B 均已分账；文档交付不解除上述实施门，不改变中央结论或任何运行验收状态。common 演进由用户另派 agent，发布制品字节仍未锁；本轮未调查或修改 glue，CC 仍未测。
