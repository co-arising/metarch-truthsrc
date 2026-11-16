# aggregate-factory：分片引用工厂与 Behavior 构造端口的内容级差异

## 1. 身份、边界与状态

- artifactId / group：`aggregate-factory`；传统模板族编号 8。
- 状态：**`decision-required`**。Scala 对应实现存在，JS legacy 也有接近的 sharding/ask renderer；银行 formal 与 family2 的同名制品却是 `Behavior` 构造端口。不能把它们仅移动目录后称为同一职责，也不能将 legacy 未接线说成 JS 完全没有实现。
- 本文是源码内容规格，不是运行验证。未执行生成、测试、typecheck、编译、服务、下载或 Git 写操作；未修改生产源码、生成应用、真源、catalog、ledger、anchors 或 baseline。其他已有 diff 不在写集合内。
- 固定 HEAD：BC `cc335eb1e0d0fae17bf092fd61b126040196ea70`；JS `bf104e16ab82ef39d7fa416d0997907d18a815ad`。以下引用全部指向固定副本，工作树字节身份另由 [baseline/index.json](../baseline/index.json) 给出，不以 HEAD 替代。
- 指引：[AUTHORING-CONTRACT](../AUTHORING-CONTRACT.md)、[layout-and-style](../layout-and-style.md)、[批准计划](../../../.rounds/prettify-generated-code-resume-20261115-cgr9lzlk/APPROVED-PLAN.md)。本次没有真源批次，不运行 validate/roundtrip。
- `extraSources = []`：本次实际读取的产品源码均来自 baseline，没有读取基线之外的当前产品源码。

### 1.1 四种材料不能混签

| 材料 | 可取得的内容 | 本文用途及限制 |
|---|---|---|
| `raw-scala` | [完整 Model][M]、[完整 Builder][B]、[完整 Template][T]；下文附全文和逐规则账 | 传统主链事实。**没有新运行的同输入 Scala 输出**；模板展开规则不冒充实跑文件 |
| `curated-reference` | [CreditBalanceAggregateFactory 完整人工参考][C] | 人工实现的两方法、`AddInitial(initial, _)` 和 `confirmation.error` 合同。不是当前 Builder 的输出证明，也不是银行 formal 输入 |
| `approved-target` | 本文 §4 的完整模板输出规则及 §6 的具体结构示例 | 三层布局、MBT 分工及固定 raw 默认是已批准要求；D1–D7 未决项仍阻断相应实施。具体样例不是当前银行业务规格或已生成 expected |
| `actual-js` | 银行三个现存 Factory 完整文件，见 §5.2 | 分别核实无 authority / 有 authority 变体。与 curated/目标只有结构性对照，**非同输入字节比较** |

### 1.2 调度、基数与路径

[CodegenMain.run][MAIN] 的非 `semanticProductsFile` 分支进入传统 `CQRSApplicationGenerator.generate/runCommon`；[application 调度][DISPATCH] 按 `app.aggregates.foreach`，依次生成 Root、Protocol、Factory、Behavior。Factory 没有独立 enabled 开关，也不按 `meta.factoryMethods` 数量生成多个类。`factoryMethods` 仅影响初始化方法名。

| Scala 变体 | 条件、方法数量 | 文件与观察状态 |
|---|---|---|
| `bare-reference-only` | 聚合存在；`commands.find(c => !c.isReadOnly && c.parameters.nonEmpty)` 为 None | 每聚合 1 文件、1 方法；源码支持，未实跑 |
| `reference-and-initialize` | find 命中，且所选命令有 `replyToType` | 同一个文件 2 方法，先裸引用后 ask 初始化；源码支持，curated 只证明参考有这两个方法 |
| `initialization-missing-reply` | find 命中但该命令没有 `replyToType` | Builder 抛 `IllegalStateException`，不是静默省略、生成 `???` 或返回假成功；本工厂无成功产物，此前 Root/Protocol 可能已写出 |
| `no-aggregate-or-scope-suppressed` | 没有聚合，或 writer 的 scope 排除 attribution | 无 Factory 落盘；scope 检查在 build/render 之后，不能认为能绕过初始化命令缺回复错误 |

物理根与业务包分开：

- 普通 single-project：`<target>/app/<base-path>/application/aggregates/factories/<FactoryName>.scala`。
- BC multi-project：普通 `aggAttribution.kind = "aggregate"` 由 [targetModuleOf/writeArtifact][WRITER] 路由到 `<target>/modules/kernel/src/main/scala/<base-path>/application/aggregates/factories/<FactoryName>.scala`，**不是凭 Factory 机制职责猜为 glue**。
- `meta.metaCategory == "application.services.transactor"` 时，此调度仍调用同一 Factory Builder，但 attribution 是 `saga-participant`；当前 `targetModuleOf` 没有该 kind，multi 回退 `<target>/app/...`。这不是另一个模板，也不能隐去该分支。
- `selfType.name` 来自 `getFactoryNameFromAggregateName`，不是简单照抄原始 `meta.name`。
- 银行当前输出是 `app/example/bankwealth/application/aggregates/{CreditBalance,FundOrder,SipPlan}AggregateFactory.scala`。目标目录分别为 `app/example/bankwealth/application/aggregates/factories/CreditBalanceAggregateFactory.scala`、`.../FundOrderAggregateFactory.scala`、`.../SipPlanAggregateFactory.scala`。这里只确认目标路径；银行三者初始化方法、回复与 sharding 注册合同仍需 D1/D2/D3 裁定。
- family2 当前 physical root 为 `modules/glue/src/main/scala/`，逻辑包是 `<base>.application.factories`，也不等于 BC 的 `<base>.application.aggregates.factories`。选 single/multi 时必须在 fixture 中明确，不靠忽略路径实现“对齐”。

### 1.3 核心字节身份

下列副本 bytes/SHA-256 本次只读对照了 index；这不是生成或行为门。

| 来源 | bytes | SHA-256 |
|---|---:|---|
| [M][M] | 1662 | `33e2bbb4fb5a44cc46694930e4f7582958080e2ff925137ea606f82547172ac7` |
| [B][B] | 10071 | `4ab2b1f8dca64623b7b4dbfa8af7cb2289bbc9ca24e1fb8a0c7a0f5513c1163a` |
| [T][T] | 2971 | `b54ab0387af9bb2d4c4e9ab66939a5462c7b55c532dc5dd6e486945506c6a52b` |
| [curated Factory][C] | 1510 | `693b1a9844f06b437fdf9b4986028b21205c698dbe1c592aabd0fa6c4053d0a3` |
| [formal templates][J-T] | 1165 | `f2e631d5de231d53f313a228c5321410e4e625767467931bf4fa9ff6dad881f4` |
| [formal models][J-B] | 3000 | `c8635d726883a673801ab4d053005de8a3462913ba79c617813bc130270538c3` |
| [family2 Factory][F-T] | 992 | `dd3226939a38e33ec587a6a970dbd67253957a69c4621ba48fc48cebfe8d41bb` |
| [family2 models][F-B] | 19567 | `a856e3ff09828d6bf802bfe85092c329816fc891adf476a0345393d6c8cc03de` |
| [legacy DSL render][L-DSL] | 58572 | `25a3fb8ca368109510f118a5f4ff6524ce481a64f004f8ed67bff8b6749f4aab` |
| [legacy ES models][L-B] | 21924 | `26cea8e0268a0605ac5581fc954122b0b5d501c5a97276d7bd56afe5af7191f7` |
| [legacy ES templates][L-T] | 9000 | `dd6e64c14c3b6e95743f84d59254ca67b2b728cb8768f152b6afaf6ecfcca2f8` |
| [actual CreditBalance][A-C] | 483 | `670db6f6e0d19690e640e2b6940c95cd623c08ccbb205a9c045b9a09001f74d0` |
| [actual FundOrder][A-F] | 487 | `4385e9eaa346184e5001c35e82f9279f126607afc3d4f6b42e9f500a8af9fd96` |
| [actual SipPlan][A-S] | 453 | `5cb872ef32f140e2c5db83518ccfdc1fcf25f1df3772ee158bbf6d2601ac0145` |

## 2. Scala Model：全部字段、默认值与依赖

[M:1–29][M] 的两个 case class 全文见附录 A。没有 nested companion、泛型上下界、sealed 子型或额外实现成员；`FactoryMethodModel` 不继承 `ArtifactModel`。

| 序号 | 字段 / 类型 / 默认值 | Builder 来源与使用者 | JS 差距 |
|---|---|---|---|
| M1 | `override val selfType: TypeRef`，无默认 | `ctx.typeResolver.aggregateFactory(meta)`；决定包、类名和文件路径 | formal 只有 `names` 字符串集合，无完整 TypeRef |
| M2 | `aggregateType: TypeRef`，无默认 | `aggregateRoot(meta.name)`；Template 固定 import 与 key qualifier | formal 没有作为类型依赖，只构造 Behavior 端口 |
| M3 | `entityTypeKey: String`，无默认 | Builder 固定 `"entityTypeKey"`；Template 字符串替换成 `<Aggregate>.entityTypeKey` | formal/family Factory 没有 sharding key；不可从 persistenceId 猜 |
| M4 | `commandFamily: TypeRef`，无默认 | `commandFamily(meta.commandFamily.name)`；用于返回型与 body | formal 用 application alias `Command`；不是同一个协议结构 |
| M5 | `factoryMethods: Seq[FactoryMethodModel]`，无默认 | `Seq(refMethod) ++ initMethodOpt`；Template 保序 map | formal 单一 abstract `create`；family 单一泛型 abstract `create[J]` |
| M6 | `override val dependencies: Set[TypeRef]`，无默认 | §3 B10；不是字符串 import 列表，也不是文件 deps | formal artifact.dependencies 仅路径，不能替代 TypeRef 收集 |
| M7 | `override val noteIds: Seq[String] = Nil` | `meta.noteId.toSeq`；writer 文件级落点 | formal 通过 `[aggregate.source]` 形成 source pointer knowledgeIds；不能无损自动等同 noteId |
| FM1 | `name: String`，无默认 | 裸方法名或 factory metadata 第一个带参方法名/回退名 | 应有显式方法模型，不把全文塞 `content` |
| FM2 | `parameters: Seq[FieldDef]`，无默认 | ID + 全业务参数/同名 ID 替代，保序 | formal 只有固定 `persistenceId, initial, hosts, authority?` |
| FM3 | `returnType: TypeRef`，无默认 | `EntityRef[CF]` 或 `Future[Either[iMadzError, EntityRef[CF]]]` | `Behavior[Command]` 不等价 |
| FM4 | `bodyLogic: String`，无默认 | B4/B9 直接拼 Scala 源码 | **raw 明确代码字符串债务**；JS 可保留对应具名槽，不扩大为整文件字符串 Model |
| FM5 | `isInitialization: Boolean = false` | init 显式 true；裸方法走默认；当前 Template 不读取此标志 | 不能声称标志会切换 askTimeout/imports；以 methods 实际构造为准 |

共享模型 [TypeSystem:4–85][TYPE]：

- `TypeRef(name: String, packageName: String, typeParams: Seq[TypeRef] = Nil)`；`fqn` 是包非空时的 `packageName + "." + name`。`signature` 对 `Tuple`+数字且非空参数生成 `(T1, T2)`，其他有参数生成 `Name[T1, T2]`，否则 `name`。依赖递归包含自身及所有泛型参数。
- `shouldImport(currentPackage)` 排除空包、当前包、`scala`、`java.lang`；不是排除所有 `scala.*`。`Option` Builder 用 `TypeRef.Option`，其 packageName 为空，仍递归收集内型。
- `FieldDef` 的完整顺序：`name: String`、`typeRef: TypeRef`、`defaultValue: Option[String] = None`、`comment: Option[String] = None`、`noteId: Option[String] = None`、`description: String = ""`。本 Builder 不填写 `comment`；ID 不携带 identifier 的其他默认值；optional 业务参数设 `Some("None")`。**当前 Template 只渲染 name/type，丢弃 defaultValue，因此产物没有 `= None`**。不能因 Builder 注释声称方法已输出默认值。
- [ArtifactModel:5–47][ART] 的继承合同：`fqn = selfType.packageName + "." + selfType.name`；`registerTo(registry) = registry.register(this)`；`morphisms = Nil`；默认 `noteIds = Nil` 被 M7 覆盖。本模型没有覆写注册以注册子方法。

## 3. Builder：完整规则与分支账

[B 全文][B] 见附录 B；下表覆盖 build 及每个 private 方法，顺序对应源码。

| ID / 位置 | 输入、完整推导与分支 | 目标约束 / 未决项 |
|---|---|---|
| B1 `build` 18–64 | 先取 `ctx.layout.application.aggregates.factories`、selfType、aggregateType、commandFamily、常量 `entityTypeKey`；依次解析 ID、所有 replies、所有 commands；建 ref、可选 init；收集依赖；按 M1–M7 顺序返回模型 | Builder 不做 I/O；formal 必须单独建立同职责模型，不继续拿 `shared` 当 Factory 完整模型 |
| B2 `resolveIdField` 69–78 | `parameterType(meta.identifier.fieldType)`；字段名用 `meta.identifier.name`，透传 identifier.noteId/description | 不硬编码 `userId` 或 `Id`；键 RHS 原样 `.toString`，不改变 UUID/名义身份 |
| B3 `resolveReplyTypes` 82–89；`resolveCommandTypes` 93–101 | replies 按 `replyFamily.replies` 全量 `resolve(CommandReplyRef(x.name))`；commands 以 commandFamily 前置，再全量 `command(CommandRef(x.name))` | 即使某命令未被初始化使用，也在 raw deps 中；不能把“只导入 init 命令”冒称 raw |
| B4 `buildCreateRefMethod` 105–123 | `EntityRef` known type 复制，typeParams=`Seq(commandFamily)`；`getBaseName(meta.name)`；方法名 `create${base}WithoutBalance`；参数仅 ID；返回型 EntityRef；body **`clusterSharding.entityRefFor(entityTypeKey, <id>.toString)`** | 是取得引用，不是创建业务余额或 persist；`WithoutBalance` 是 raw 命名，非所有领域都有 Balance，改名需 D5 |
| B5 `buildInitializationMethodOption` 127–150 | 按原 commands 顺序 `.find(!isReadOnly && parameters.nonEmpty)`；未找到返回 None；找到则建一个方法 | 不排序、不按事件名识别创建、不按 factory metadata 选择 command。仅有 replyTo 的参数列表也会先命中；D2 |
| B6 `determineInitializationMethodName` 154–164 | `getAggregateBaseName(meta.name)`；`factoryMethods.find(_.parameters.nonEmpty).map(_.name)`，否则 `create${base}WithInitialValue` | factory method 的参数内容和 body 不被消费，也未校验它与所选 command 对应 |
| B7 `buildCreateWithInitialMethod` 170–193 | 移除名字恰等于 `replyTo` 的参数；以名字判断 `hasIdParam`；逐参数 `optional` 则 `Option[parameterType]`、`defaultValue=Some("None")`，否则裸型；透传 noteId/description；同名 ID 存在则只用业务参数，否则前置聚合 ID | 原参数顺序保留；同名 ID 的类型可以与裸引用 ID 不同，raw 没有校验；optional ID 会用 Option.toString，不能悄悄替它 unwrap；D2/D4 |
| B8 195–212 | `replyToType.getOrElse(throw new IllegalStateException("Command ... must specify a reply type for factory initialization."))`；解析 `CommandReplyRef(replyRef.targetName)`；返回型 `Future[Either[iMadzError, EntityRef[CF]]]` | 没有 `error` 字段的 Reply 不受本 Builder 验证，却会被 body 访问；D3。不能合成通用 Reply 掩盖缺元数据 |
| B9 214–255 | cmdName=`cmdMeta.name`；若 hasIdParam，askParams=methodParams，否则 askParams=paramDefs，排除仅用于定位的额外 ID。参数 RHS 用 `scalaIdentifier(p.name)`，尾追加 `_`，逗号空格连接。body 先取 entityRef，再 ask，等待 confirmation，读 error：Some → `Left.apply[iMadzError, EntityRef[CF]]`，None → `Right(entityRef)` | 方法体全文见附录。没有 recover、重试、事件发布或 persist；ask 的 Future 失败不会变成领域 Left。`Right` 不是无条件成功，只在实际 confirmation.error 为 None 后产生 |
| B10 `collectDependencies` 260–289 | commonDeps 空；init 存在时递归收集其所有参数类型、返回型，再加入 bare Future/Either/iMadzError；ref 参数与返回型也递归收集；并入全部 commands/replies，最后 `.filter(_.shouldImport(pkg))` | Set 去重依据完整 TypeRef，包括 typeParams；typed Future 与 bare Future 可同时存在，落成同一 FQN 的两条 import。aggregateType/Inject/ClusterSharding/Timeout/EC/duration 另由 Template 加入，并非 dependencies 已完整含有 |

### 3.1 类型与命名支撑的真实边界

- [TypeResolverDSL:633–646][RES-FACTORY]：Factory 使用 `getFactoryNameFromAggregateName(meta.name)` → `aggregateFactoryName(getAggregateBaseName(name))`；`getAggregateBaseName` 仅移除尾部 `Aggregate`。相反 [aggregateRoot:236–242][RES-AGG] 与 B4 使用 `getBaseName`，它按固定后缀列表顺序删除，遇剥空返回最后非空值。[NamingConventions:171–224,258–265][NAMES] 保留了这两套不同规则，不能宣称已统一 PascalCase resolver。
- [commandFamily:171–195][RES-CF] 先查 `NestedTypeName` 的 owner：Aggregate → AggregateProtocol；SagaTransactor → sagaProtocol；DomainEntity → domain.entities 的 owner；QueryService → application.queries 的 owner；其他已知 owner → application.aggregates 的 owner；无 owner → application.aggregates 根。Reply/Command 的 MetaRef 通过 [TypeResolver:19–90][RESOLVE] 分发到相应 resolver，不能按同名字符串假设都位于同一个 protocol。
- `parameterType` 是 [TypeResolverDSL:1150–1151][RES-PARAM] 对 `TypeResolver.resolve` 的委托；CustomType 使用 knownFrameworkTypes 时覆盖包并递归 typeArgs，否则仅对历史 `net.imadz.domain.values` 包重定向。未知 MetaRef 的 [resolveMetaRef:93][RESOLVE] 仍是 `???`，总兜底为 `TypeRef("Any", "")`。这是共享源的显式未实现/弱类型槽，不是本 Factory 已支持任意类型的证据；不能迁成 `Any` dispatcher 来“通过”。
- [FrameworkTypes:264–276][FRAMEWORK] 的 `Id`/`iMadzError` 分别是 `<frameworkPkg>.common.CommonTypes.Id/iMadzError`；只有 frameworkPkg=`net.imadz` 时才是本文参考 import。不得把项目 package 与 framework package 混同。

## 4. Template：输出 construct、RHS 与顺序

[T:1–81][T] 全文见附录 C。模板文件自身第 3、5、8 行重复 import `NamingConventions` 是生成器源码现状，不是生成产物必须有三个同样 import。

| 顺序 / 稳定 construct | raw-scala 输出及全部规则 | approved-target 处理 |
|---|---|---|
| T0 来源头（writer） | Template 不产 fingerprint；[writer:411–412][WRITER] 外加 `fingerprintHeader + content` | 来源头与 artifact 输出字节分账；JS 不能伪造旧 CodegenMain hash |
| T1 package | `package ${model.selfType.packageName}`，后空行 | `<base>.application.aggregates.factories`；三层下的子包，不创建第四业务层 |
| T2 imports | 先 dependencies.toList 按 fqn 排序、取 fqn，滤空串/等于 self package/startsWith("java.lang")；追加 Inject、ClusterSharding、Timeout、duration._、ExecutionContext、aggregateType.fqn；`imports` 的 [ImportDeclaration.code:20–22][DSL] 再对**全部字符串**排序，每条 `import `，以 LF 连接；不分组、不去重 | raw 的最终排序不是“先 deps 再固定组”。目标需正常 imports 与冲突处理；完全重复 FQN 的去重记录为明确表达偏差，D4 确认字节白名单，不删除必要 nested owner qualifier |
| T3 类注释 | 两行正文依次为 `${selfType.name}: Aggregate Factory for ${aggregateType.name}`、`Creates and manages aggregate instances via cluster sharding` | 保留意义与顺序；无虚构业务说明或概念 noteId |
| T4 class / 构造器 | `class ${selfType.name} @Inject() (clusterSharding: ClusterSharding)(implicit ec: ExecutionContext)`；普通 class，非 final/case/trait/object；无父类、type params、自类型、主参数默认值、辅助构造器 | 保留可注入 sharding 与显式 EC，不抄 curated 的 global EC；长签名允许按明确目标分行 |
| T5 implicit val | 类体首项 `implicit val askTimeout: Timeout = Timeout(10.seconds)`，后空行；不论是否有 init 都发 | 保留 10 秒 raw 默认，不擅自改成 curated 的 30 秒；不是 lazy，也不外置成未批准配置 |
| T6 每方法的参数锚 | 按 model.factoryMethods 顺序；`KnowledgeAnchorDoc.fieldDoc(m.parameters, "  ")`；只对 noteId 存在的字段发 `@param <escaped-name> <description?>  @knowledge <annotated-id>`，包块与 `def` 紧邻；空集合不发；不使用 FieldDef.comment | [KnowledgeAnchorDoc:32–61][DOC] 的 hash 后缀由 annotateKnowledge 决定；不要从输入臆造 noteId。source pointer 与 noteId 映射由共享 writer/anchor owner 裁定 |
| T7 方法签名 | `def ${m.name}(${parameters.map(escapedName + ": " + type.signature).mkString(", ")}): ${returnType.signature}`；public、单参数列表、无隐式方法参数、无类型参数；参数顺序原样 | method name raw 未 escape；参数 defaultValue **未发射**；不擅加 `= None`，D4/D5 |
| T8 body 槽修正 | `keyRef = aggregateType.name + "." + entityTypeKey`；`fixedLogic = m.bodyLogic.replace(model.entityTypeKey, keyRef)`；嵌入 `{\n    <fixedLogic>\n  }` | 这是全字符串替换，不是 AST name resolution；已有长 qualifier/同名字段/字符串字面量都可能受影响，D5。目标应只限定 key 引用，但不是批准悄悄改 raw |
| T9 裸引用 RHS | `clusterSharding.entityRefFor(Aggregate.entityTypeKey, identifier.toString)`；返回 `EntityRef[CommandFamily]` | 不 spawn actor、不发送初始化命令、不 register sharding、不 persist；同 ID 的名义类型和 toString 语义保留 |
| T10 初始化局部值 | `val entityRef: EntityRef[CF] = clusterSharding.entityRefFor[CF](Aggregate.entityTypeKey, idArg.toString)` | `entityRef` 是后续 ask 和成功值共享的具名一次求值，不是应删除的 nextN |
| T11 ask / yield | `for { confirmation <- entityRef.ask[Reply](Command(allCommandParams..., _)) } yield { confirmation.error.map(Left.apply[iMadzError, EntityRef[CF]]).getOrElse(Right(entityRef)) }`，零业务参数时为 `Command(_)` | `_` 是 typed ask 的 reply actor 注入；不要求外部 factory 调用者传 replyTo；命令必须有确切回复合同，不往领域参数/事件中补 ActorRef |
| T12 文件闭合 | 方法间 `\n\n`，methods 后空行、类 `}`、尾 LF | 不产生 alias、companion、额外 overload、annotation、MANUAL block、default business event 或 serializer 登记 |

本 Factory M/B/T **没有 `???` 或 MANUAL 业务方法体**；存在的是明确 `bodyLogic` 源码槽和共享 TypeResolver 的 `???`。后续依赖的 Helper/Rule 若还有 `???`/MANUAL，不在 Factory 中替它们补“成功”；必须原样显示为实现义务。Factory 不能通过吞异常、空 Reply 或 `Future.successful(Right(entityRef))` 提前完成初始化。

### 4.1 raw → approved 的有限偏差账

1. Factory 的三层包本来正确；变化针对当前 JS 的错误子包/职责，不改 raw 包。业务根下只允许 domain/application/infrastructure；raw 的 `$base.modules` 属其他装配制品，目标归 infrastructure.bootstrap，本工厂不新增此包。
2. 参数/构造器长行分行、重复 import 去重及冲突处理按统一质量标准；具体 raw-import 重复次数必须留在对照账，不能压平所有空白后假称逐字一致。
3. raw 的 `WithoutBalance`、10 秒、普通 class、implicit EC、初始化选择顺序、optional 参数不发默认值及 error→Either body，未裁定前均不随意“现代化”。尤其不把 curated case class/global/30 秒当默认。
4. lexical key replace、关键字 id RHS 未 escape、未知 type fallback 的修复需精确 D5 决策和 fixture；没有用伪实现替代。

## 5. JS：formal、legacy、family 分别定位

### 5.1 真正调用链，不以目录名推 reachability

| lane | 固定入口与调用 | Factory 结论 |
|---|---|---|
| formal 银行 service | [registeredProductProducer:92–101][CLI] 注册 `scala-cqrs-play-service`；[generate:16–23,59–70][J-GEN] 将 inherited registry 中 `aggregate-dsl` 替换为 `renderAggregateLayers`；[renderAggregateLayers:20–29][J-RENDER] map models.role→template→entry | 确实调用 `factoryTemplate`；不是 legacy `aggregate-dsl/render.mjs`。entry header 虽写 domain:1，也不能反推只经过 domain generator |
| formal service 内 `role: legacy` | [buildAggregateModels:24–27][J-B] 和 [legacyTemplate:3–16][J-PROTOCOL] | 当前可达，发 domain 混合文件内 `object <A>AggregateFactory.create`，转发 `<A>Aggregate.apply`，再转 infrastructure bootstrap；这个 role 叫 legacy 不表示未调用 |
| 其他 versioned domain/application 路由 | [produce:20–22][J-PRODUCE] / [aggregate-dsl/produce:1–7][J-DSL-PRODUCE] 调 `renderActors`；[render-actor:27–30][J-ACTOR] 同文件尾发 domain Factory object | Behavior 转发壳；没有 Inject、EntityRef、ask。与真正 standalone legacy renderer 分开登记 |
| legacy standalone DSL | [emit.mjs:5–8][L-EMIT] import `render`，读 spec 后直接写 `result.files`，其中 factory 在 [render:1016–1131][L-DSL] | 有 sharding/ask class，但 formal produce 没有 import 此 render；不能说银行正在消费此正确形状 |
| legacy ES | [generate:67–93][L-GEN] 按 canonical.aggregates 调 factoryModel→renderFactory；[manifest][L-MANIFEST] 声明 `factory` kind、truthsrc/v0.3。通用 [legacy plan:23–41][APPLY] 动态加载指定目录 generate.mjs | 通用 legacy 入口源码具备调用条件；formal registeredProductProducer 列表不含它。未试跑当前 CLI 的其他准入，因此不宣称默认可用或应复活 |
| family2 | [generate:11–23][F-GEN] 要求 `scala-cqrs-aggregate-core@1`；[render.productionJobs:15–24][F-RENDER] 每 aggregate 明确调 factoryTemplate | 当前显式注册的 family 路由，不是银行 service 替代实现；仍是 Behavior 构造端口 |
| family6/8 消费 | [persistence-readside productionJobs:13–23][P-RENDER] 复用 family2 jobs，并额外登记同 kind 的 PersistenceFactory；[play-application render:1,16–17][PA-RENDER] 消费 persistence jobs；二者均在 [CLI:97–98][CLI] 注册 | 同一 kind 不等于同一逻辑族。PersistenceFactory 是 codec/bootstrap 装配，见 §5.5，不可错算成 BC sharding Factory 已补齐 |

### 5.2 银行实际输出全文

[CreditBalance][A-C]（无 authority）

```scala
// @generated by truthsrc scala-cqrs-domain:1
package example.bankwealth.application.aggregates

import akka.actor.typed.Behavior
import example.bankwealth.application.aggregates.CreditBalanceProtocol.Command
import example.bankwealth.domain.CreditBalanceComputations
import example.bankwealth.domain.entities.CreditBalanceEntity.State

trait CreditBalanceAggregateFactory {

  def create(persistenceId: String, initial: State, hosts: CreditBalanceComputations): Behavior[Command]
}
```

[FundOrder][A-F]（有 authority）

```scala
// @generated by truthsrc scala-cqrs-domain:1
package example.bankwealth.application.aggregates

import akka.actor.typed.Behavior
import example.bankwealth.application.aggregates.FundOrderProtocol._
import example.bankwealth.domain.FundOrderComputations
import example.bankwealth.domain.entities.FundOrderEntity.State

trait FundOrderAggregateFactory {

  def create(persistenceId: String, initial: State, hosts: FundOrderComputations, authority: ExternalAuthority): Behavior[Command]
}
```

[SipPlan][A-S]（无 authority）

```scala
// @generated by truthsrc scala-cqrs-domain:1
package example.bankwealth.application.aggregates

import akka.actor.typed.Behavior
import example.bankwealth.application.aggregates.SipPlanProtocol.Command
import example.bankwealth.domain.SipPlanComputations
import example.bankwealth.domain.entities.SipPlanEntity.State

trait SipPlanAggregateFactory {

  def create(persistenceId: String, initial: State, hosts: SipPlanComputations): Behavior[Command]
}
```

三个文件没有方法 RHS/default/注释分组/伴生对象/其他成员。abstract create 的实现位于 bootstrap；[实际 CreditBalanceBootstrap:14–26][A-BOOT] 先 require，再 `EventSourcedBehavior`，其中 `PersistenceId.ofUniqueId(persistenceId)`、initial、commandHandler、eventHandler、eventAdapter、snapshotAdapter 均有真实职责。这些不能随接口替换被删除。

### 5.3 formal Model / Builder / Template 的逐 construct 账

[buildAggregateModels 全文][J-B] 不只是按名字推断：

1. `layout = products['reference-layout']`；按 declaration.ref.kind 取 aggregate，按 context 且 owner[0] 匹配 commands/external producers；`aggregateNames` 取得 names/paths。
2. `shared = {aggregate, names, authority: external.length > 0}`。Factory 模型只有 shared、role=`factory` 和 artifact。它没有 ID 类型、reply Family、factoryMethods、bodyLogic、依赖 TypeRef 或 timeout 模型。
3. Factory artifact 精确为 `kind: 'aggregate-factory', path: paths.factory, sources: [aggregate.source], dependencies: [paths.protocol, paths.entity, paths.helpers]`；helpers 路径在 [aggregate-names:6–22][J-NAMES] 仍是 domain/CommandHelpers。没有来自 command 参数的成员级来源。
4. 返回完整 models 经 `copyImmutableData`。`commandSources`、行为 groups、aliases 属同一 shared builder 的其他 role，Factory 不消费它们；拆分不得把它们错误丢弃。
5. `aggregateNames` 用 `symbol(ref.id)`，是安全字符串/关键字 escape 检查，并不自动 PascalCase；路径却用原 `ref.id`。`pathFor` 固定 app 根；`entry` 先加 `// @generated by truthsrc scala-cqrs-domain:1`，再基于 header+content 算 byte spans，[naming:23–31][J-NAMING]。

当前 [aggregate-factory.mjs 全文][J-T] 有**两个逻辑制品**，均须定 owner：

```javascript
export function aggregateTemplate(model) {
  const { name, package: pkg, protocol } = model.names;
  const authority = model.authority ? ', authority: ExternalAuthority' : '';
  const argument = model.authority ? ', authority' : '';
  return `package ${pkg}.application.aggregates

import ${pkg}.application.aggregates.${protocol}.${model.authority ? '_' : 'CommandHandler'}
import ${pkg}.domain.${name}Computations

object ${name}Aggregate {

  def commandHandler(hosts: ${name}Computations${authority}): CommandHandler =
    behaviors.${name}Behaviors(hosts${argument})
}
`;
}

export function factoryTemplate(model) {
  const { name, package: pkg, protocol } = model.names;
  const authority = model.authority ? ', authority: ExternalAuthority' : '';
  return `package ${pkg}.application.aggregates

import akka.actor.typed.Behavior
import ${pkg}.application.aggregates.${protocol}.${model.authority ? '_' : 'Command'}
import ${pkg}.domain.${name}Computations
import ${pkg}.domain.entities.${name}Entity.State

trait ${name}AggregateFactory {

  def create(persistenceId: String, initial: State, hosts: ${name}Computations${authority}): Behavior[Command]
}
`;
}
```

| JS construct | 实际规则/RHS | 处置 |
|---|---|---|
| `aggregateTemplate` 全体 | application.aggregates object；protocol import 在 authority 时 `_`，否则 CommandHandler；hosts/authority 传给 `behaviors.<A>Behaviors` | 非本 Factory 产物；由集成者拆出至 aggregate-root owner，不能删除其 imports/body |
| `factoryTemplate.package` | application.aggregates，无 factories | move 到 factories，但仅移动不解决职责 |
| imports 顺序 | Behavior → protocol `Command`/`_` → domain Computations → entity.State；不排序，无依赖解析 | replace 为 §4 TypeRef import 模型 |
| trait/create | no constructor、no body；fixed 参数依次 persistenceId:String、initial:State、hosts:Computations，authority 分支最后追加 ExternalAuthority；return Behavior[Command] | 当前 bootstrap 构造端口另有职责，D1 先定其承接；目标 class 使用 sharding+EC，不直接消费 hosts/State |
| domain companion `Factory.create` | [legacyTemplate:14–16][J-PROTOCOL] 与 `renderActors` 均为 `Aggregate(persistenceId, initial, hosts, authority?)` 转发；formal 的 Aggregate.apply 再调 Bootstrap.create | 需引用迁移及旧输出退役；禁止保留 domain 永久壳来假装分层完成 |

### 5.4 legacy 的近似能力与偏差

[ES factoryModel:250–315][L-B] / [renderFactory:171–194][L-T] 是实际结构对象与 renderer，不是空占位：

| 规则/输出 | legacy ES 实际内容 | 与本次 BC 固定源差异 |
|---|---|---|
| 输入/default | name、commandFamilyOf、env.frameworkBase；identifier=`a.identifier ?? 'id'`；ID noteId 由同名 stateField 得到；`type='Id'`、固定 framework import | BC 用 meta.identifier 的真实 fieldType/noteId/description |
| init 选择 | 第一个有 parameters 且非 readOnly；无候选 **throw** | BC 无候选只保留裸方法 |
| init 名 | factoryMethods 首个 `params.length>0` 名，否则去 Aggregate 后缀后的 WithInitialValue | raw 字段是 parameters；adapter 必须显式对应 |
| 参数 | filter replyTo，optional→Option，无默认，保留 noteId；同名 ID 替代；askArgs escape 后尾 `_` | 与 raw 产物无 `= None` 接近，但描述全部置空；不是完整 FieldDef |
| reply | `replyNameOf(a, initCmd)` | 不等于明确的 cmd.replyToType 元数据验证，必须保留真实 reply contract |
| 两方法模型 | refMethod/initMethod 各有 name/docRows/params/ret/body；bare key 用 `${name}Aggregate.entityTypeKey`，init 同样；`confirmation.error.map(Left...).getOrElse(Right(entityRef))` | 无独立 selfType/aggregateType/TypeRef deps；name 已含 Aggregate 时拼接规则可能不同 |
| imports | 固定 ClusterSharding/EntityRef/Timeout/Inject/aggFqn；所有 commands/replies/family；error/EC/Future/Future(key='dup')/duration._；再遍历 methodParams 的 typeDeps | 固定重复 Future 是历史兼容策略，不是当前通用类型依赖算法；裸引用 ID 的依赖不能因同名 command ID 替代而漏掉 |
| renderer | header + base/application.aggregates.factories；imports；类注释；普通 @Inject class+implicit EC；10 秒；固定输出 refMethod 后 initMethod；参数 doc→def→body | 有内容可移植，但 formal 未调用；不是采用它整个 generate profile 的授权 |

[standalone aggregate-dsl Factory 区间:1016–1131][L-DSL] 的事实也不能省略：

- initCmd 是 commands 复制后按 name 排序的第一个，**不是 BC 原序首个非只读且带参**；直接使用 initCmd.name，未提供 no-init 分支。identifier 缺失合成 lower-first objName+Id，ID 类型固定 Id。
- `sigOfF` 用 scalaSig，再包 optional Option；initParams 取 fields，全量保序，没有该区间的 replyTo 名过滤。hasIdParam 决定方法参数是否额外前置 ID、ask 是否传 ID。
- factoryDocLines 只取 noteId，使用 qref/kh(noteId,elementHash)，没有 description；bare def 的 ID 名与定位 RHS 没用 qref。
- import 构造逐 method2Params 用正则识别大写 type token：List signature 单列计数；Id 跳过；Instant→java.time.Instant；primitive/Option/Unit 跳过；Map/Seq/Set/Vector→scala.collection.immutable；其他→valuesPkg。固定 sharding/inject/common/aggregate import；每命令加 command/reply；sagaFace 分支使用 replyTypeOf，否则 `<Command>Reply` 并添加合成 GetState command；GetStateReply/family 始终加；Future 两次；每种 List signature 一次 List；末尾 sort。
- 输出依次为固定旧来源头 `CodegenMain:225ed28b`、knowledge-release 1.0.0、`${pkg}.factories`、imports、同样 class 注释、Inject+EC、10 秒、裸引用方法、固定 `create${objName}WithInitialValue` ask 方法；body 与 error→Either 结构一致。**不能把这些硬编码历史头搬进新生成器**。
- `return.files` 中 protocol/aggregate/behaviors/factory 共同组装，entity/eventHandler 由 spec.entityDir 条件决定；单一物理 renderer 的 factory 区间只能由 assembly owner 切分，不能本组覆盖整文件。

### 5.5 family2 与 PersistenceFactory

[family2 factoryTemplate 全文][F-T]：

```javascript
import { importsFor, named, library } from './imports.mjs';

export function factoryTemplate(aggregate, model, out) {
  const a = aggregate, artifact = a.factory;
  const { names: n, text } = importsFor(artifact, [
    [library('behavior', 'akka.actor.typed.Behavior')],
    [library('eventAdapter', 'akka.persistence.typed.EventAdapter'), library('pid', 'akka.persistence.typed.PersistenceId'), library('snapshotAdapter', 'akka.persistence.typed.SnapshotAdapter')],
    [named('actor', a.actorProtocol)], [named('protocol', a.base.protocol)], [named('state', a.base.state)], [named('hosts', a.base.computations)],
  ], ['J']);
  out.append(`package ${artifact.package}\n\n${text}\n\ntrait ${artifact.identifier} {\n  def create[J](\n    persistenceId: ${n.pid},\n    initial: ${n.state},\n    hosts: ${n.hosts},\n    eventAdapter: ${n.eventAdapter}[${n.protocol}.Event, J],\n    snapshotAdapter: ${n.snapshotAdapter}[${n.state}]\n  ): ${n.behavior}[${n.actor}.Command]\n}\n`, [a.source]);
}
```

逐层事实：

- [build-models:18–28,50–118,136–138,221–247][F-B] 的 factory role 是 `['factory','factory','aggregate-factory','application.factories',[],['AggregateFactory'],'glue']`；names override 要匹配 aggregate kind；使用 resolveNameSet/reserved，路径 resolveArtifactPath，artifact 中有 ref/role/kind/module/name/identifier/package/fqn/path/sources/refs/directDeps。无 FactoryMethodModel。
- 同一完整 Builder 先组合 unchanged kernel/serialization，要求 externalProducers 与 domain-external-events 一致并拒绝任何 external producer；commands/events 的严格表达式验证亦是准入前置。Factory 没有 authority 变体，不能拿它直接替 FundOrder。
- Factory 的 directDeps 精确为 base.protocol、base.state、base.computations、actorProtocol；sources=[base.source]、refs=[base.ref]，bootstrap 反过来依赖 Factory。最终检查 portable path collision、依赖实际输出存在、kernel 不得依赖 glue。
- Template 顺序是 package、imports、trait、`create[J]` 五参数、Behavior 返回型、闭合。J 无上下界；没有 RHS、构造器、默认值、超时、ask 或 sharding。typed PersistenceId 和 adapter 参数是必要的接缝，不应删掉来追近表面签名。
- [importsFor:3–25][F-IMPORT] 以 artifact.name/J 为 reserved；不同 FQN 简名冲突则对应使用 `_root_.<fqn>` 并省该 import；同一组内去重，同包多条合并 braces，其他按传入组顺序；包遮蔽时 import 加 `_root_.`。不是 BC 全局 sort。可复用冲突检测思想，不直接宣称 byte-compatible。
- [PersistenceFactory 的 key 分支:105–109,149–157][P-T] 先发 package（来源 registrations），无 import，随后 object，`create(persistenceId: akka.persistence.typed.PersistenceId, initial: <stateFqn>, hosts: <computationsFqn>): akka.actor.typed.Behavior[<actorProtocolFqn>.Command]`。body 先 `require(persistenceId != null && initial != null && hosts != null, "persistence factory arguments required")`，再 `<bootstrapFqn>.create[<frameFqn>](persistenceId, initial, hosts, new <eventAdapter>, new <snapshotAdapter>)`；方法来源 product.source+aggregate.source。其 role 为 `persistence-factory`/后缀 `PersistenceFactory`，包 infrastructure.persistence。它是额外装配制品，不是本族所需 `EntityRef`/ask 方法，不能因为 ledger kind 同叫 aggregate-factory 而合并或删去 serializer/adapter 身份。

## 6. 真实 minus/plus 与完整参考

### 6.1 actual-js → approved-target 的结构性对照

下方 minus 是 [实际 CreditBalance Factory][A-C] 的全部原文。plus 是**参考身份 `net.imadz` 的结构示例**：采用 raw 的普通 class、explicit EC、10 秒、`Aggregate.entityTypeKey`，采用 curated 的具名两方法及 AddInitial body。它明确展示目标职责，不表示银行参数/初始化合同已经确定。不同包、不同输入，**不是 rename patch，也非同输入字节 diff**；完整银行 expected 受 D1–D3 阻断。

```diff
--- actual-js/app/example/bankwealth/application/aggregates/CreditBalanceAggregateFactory.scala
+++ approved-target-example/app/net/imadz/application/aggregates/factories/CreditBalanceAggregateFactory.scala
@@ -1,12 +1,45 @@
-// @generated by truthsrc scala-cqrs-domain:1
-package example.bankwealth.application.aggregates
+package net.imadz.application.aggregates.factories
 
-import akka.actor.typed.Behavior
-import example.bankwealth.application.aggregates.CreditBalanceProtocol.Command
-import example.bankwealth.domain.CreditBalanceComputations
-import example.bankwealth.domain.entities.CreditBalanceEntity.State
+import akka.cluster.sharding.typed.scaladsl.ClusterSharding
+import akka.cluster.sharding.typed.scaladsl.EntityRef
+import akka.util.Timeout
+import javax.inject.Inject
+import net.imadz.application.aggregates.CreditBalanceAggregate
+import net.imadz.application.aggregates.CreditBalanceProtocol.AddInitial
+import net.imadz.application.aggregates.CreditBalanceProtocol.CreditBalanceCommand
+import net.imadz.application.aggregates.CreditBalanceProtocol.CreditBalanceConfirmation
+import net.imadz.common.CommonTypes.Id
+import net.imadz.common.CommonTypes.iMadzError
+import net.imadz.domain.values.Money
+import scala.concurrent.ExecutionContext
+import scala.concurrent.Future
+import scala.concurrent.duration._
 
-trait CreditBalanceAggregateFactory {
+/**
+ * CreditBalanceAggregateFactory: Aggregate Factory for CreditBalanceAggregate
+ * Creates and manages aggregate instances via cluster sharding
+ */
+class CreditBalanceAggregateFactory @Inject() (
+    clusterSharding: ClusterSharding
+)(implicit ec: ExecutionContext) {
+  implicit val askTimeout: Timeout = Timeout(10.seconds)
 
-  def create(persistenceId: String, initial: State, hosts: CreditBalanceComputations): Behavior[Command]
+  def createCreditBalanceWithoutBalance(userId: Id): EntityRef[CreditBalanceCommand] = {
+    clusterSharding.entityRefFor(CreditBalanceAggregate.entityTypeKey, userId.toString)
+  }
+
+  def createCreditBalanceWithDefaultBalance(
+      userId: Id,
+      initial: Money
+  ): Future[Either[iMadzError, EntityRef[CreditBalanceCommand]]] = {
+    val entityRef: EntityRef[CreditBalanceCommand] = clusterSharding
+      .entityRefFor[CreditBalanceCommand](CreditBalanceAggregate.entityTypeKey, userId.toString)
+    for {
+      confirmation <- entityRef.ask[CreditBalanceConfirmation](AddInitial(initial, _))
+    } yield {
+      confirmation.error
+        .map(Left.apply[iMadzError, EntityRef[CreditBalanceCommand]])
+        .getOrElse(Right(entityRef))
+    }
+  }
 }
```

上述 import 只针对展示的已知方法合同；raw 在真实 meta 下会收集全 commands/replies，并可能产生重复 Future。不得拿该较短 import 集合替代 §3/4 的完整依赖规则。来源头不伪造，实际 writer 的头需在最终 fixture 另存原字节。示例没有编造 noteIds；有真实来源字段时必须按 T6 发射或用批准的 source mapping 定位。

### 6.2 curated-reference 全文与 raw 的不同

[C:1–34][C]：

```scala
package net.imadz.application.aggregates.factories

import akka.cluster.sharding.typed.scaladsl.{ClusterSharding, EntityRef}
import akka.util.Timeout
import net.imadz.application.aggregates.CreditBalanceProtocol.{AddInitial, CreditBalanceCommand, CreditBalanceConfirmation}
import net.imadz.application.aggregates.CreditBalanceAggregate.CreditBalanceEntityTypeKey
import net.imadz.common.CommonTypes.{Id, iMadzError}
import net.imadz.domain.values.Money

import javax.inject.Inject
import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.Future
import scala.concurrent.duration.DurationInt
import scala.language.postfixOps

case class CreditBalanceAggregateFactory @Inject()(clusterSharding: ClusterSharding) {
  implicit val askTimeout: Timeout = Timeout(30 seconds)

  def createCreditBalanceWithoutBalance(userId: Id): EntityRef[CreditBalanceCommand] =
    clusterSharding.entityRefFor(CreditBalanceEntityTypeKey, userId.toString)

  def createCreditBalanceWithDefaultBalance(userId: Id, initial: Money): Future[Either[iMadzError, EntityRef[CreditBalanceCommand]]] = {
    val entityRef: EntityRef[CreditBalanceCommand] = clusterSharding
      .entityRefFor[CreditBalanceCommand](CreditBalanceEntityTypeKey, userId.toString)
    for {
      confirmation <- entityRef.ask[CreditBalanceConfirmation](AddInitial(initial, _))
    } yield {
      confirmation.error
        .map(Left.apply[iMadzError, EntityRef[CreditBalanceCommand]])
        .getOrElse(Right(entityRef))
    }
  }

}
```

| construct | raw | curated | 本文目标取值 |
|---|---|---|---|
| class | 普通 class | case class，因而有 case-class 语义 | raw，不额外加入 product/equality/copy |
| EC | 第二参数列表 implicit ec | import global | raw，执行上下文由依赖注入 |
| timeout | `Timeout(10.seconds)` | `Timeout(30 seconds)` + postfixOps | raw 10 秒；更改时单独裁定 |
| key | aggregateType.name + `.entityTypeKey` | import `CreditBalanceEntityTypeKey` 简名 | raw 的符号访问方式，**不改变 key 的稳定字符串**；参考符号不证明银行已注册 key |
| 方法名 | metadata 首带参名称，或 WithInitialValue | WithDefaultBalance | 只在明确匹配 reference fixture 时使用该名，不泛化到银行 |
| 参数/回复 | 元数据驱动 | userId:Id、initial:Money、CreditBalanceConfirmation | 仅作结构示例，不发明 FundOrder/SipPlan 业务 |
| imports/格式 | 全局排序、可重复、裸方法 braces | 手工分组/brace imports、expression body | 实际字节分别保留；表达偏差明确记录 |

## 7. 胶水、语义保护与实现槽

| 依赖（完整符号） | 需要的接口与副作用 | 供给/证据边界 |
|---|---|---|
| `akka.cluster.sharding.typed.scaladsl.ClusterSharding`、`EntityRef`、`EntityTypeKey` | `entityRefFor[M](EntityTypeKey[M], String): EntityRef[M]`；`EntityRef.ask[Reply]` 接受 `ActorRef[Reply] => M` 并返回 Future；Factory 取得引用及发送初始化命令，注册和 actor 生命周期由 bootstrap 管理 | raw 消费用法见 B9；[BC scaffold][BUILD] 使用 Akka 2.6.20。实际二进制方法、隐式要求和 sharding 注册需后续真实接口验证；本次未检查 jar |
| `akka.util.Timeout`、`scala.concurrent.duration._` | `Timeout(10.seconds)`，裸引用-only 也发；ask 超时表现为 Future 失败 | 不能自动 recover 为 iMadzError 或 Right；10→30 是语义差异 |
| `scala.concurrent.Future`、`ExecutionContext`、`scala.Either/Left/Right` | for/map 在注入 EC 上运行；error Option.map→Left，None→Right(entityRef) | Scala 标准库；不借全局 EC 隐藏依赖 |
| `javax.inject.Inject` | 构造器注入 ClusterSharding；implicit EC 是额外 Scala 构造参数 | BC scaffold 有 Play/Guice 依赖，但具体 inject 供给版本及 DI 可实例化性本次未验证；不能仅凭注解证明装配成功 |
| `<base>.application.aggregates.<A>Aggregate.entityTypeKey` | typed command family 的现存 key；Factory 只引用 | Root/Bootstrap 联合提供；现有银行 application Aggregate 主要是 commandHandler wrapper，不能凭模板需要就宣称 key 存在 |
| `<base>.application.aggregates.<A>Protocol.<InitCommand>/<Reply>/<CommandFamily>` | InitCommand 业务参数顺序后有 typed replyTo；Reply 有 `error: Option[iMadzError]`（raw body 实际假设） | D3：必须与 protocol/helper 同裁，不能把 `Refused(code: String)` 自动等同 iMadzError |
| `net.imadz.common.CommonTypes.Id/iMadzError`（frameworkPkg 可变） | ID 的名义/UUID 合同保留；error 是确认到 Either 的原值 | [common 源][COMMON-TYPES] 的 Id=UUID、iMadzError(code,message) 仅证明源码；[scaffold:130–135][BUILD] 消费 `net.imadz:common-core_2.13:0.2`。sibling HEAD 不证明该 jar 包含最新 API |
| `net.imadz.common.application.CommandHandlerReplyingBehavior.CommandHelper`、`runReplyingPolicy` | command→param、失败 reply、成功 updated-state reply，位于 application.aggregates.behaviors 的项目 Helpers；Factory 不自己实现规则 | [固定 common 源:16–75][REPLY] 给出三方法和调用顺序；actual formal emission helper 不可代替。供给 jar/重复 scaffold 类选择由 D6 决定，不新增银行私有副本 |

必须保持的跨制品顺序与边界：

1. 只对有明确回复合同的**应用 Actor 命令**追加 `ActorRef[Reply]`。纯领域 param/event 没有 ActorRef。Factory 的 `_` 只能填这个已声明的参数，不能给无 replyTo 命令制造隐式回复。
2. `CommandHelper.toParam(state, command)` → rule；失败 `Effect.reply(...createFailureReply...)`，**不 persist**；成功 `Effect.persist(events).thenReply(...createSuccessReply...)`，读应用事件后的 **新 State**。Factory 等 confirmation 后读 error，不直接计算余额或复制事件。
3. `replyWith` 与 `replyWithAndPublish` 不等价：后者另经 thenRun 发布 EventStream。Factory ask 不能隐式选择后者，也不能用 `thenRun(_ => Accepted(events))` 冒充成功新状态回复。
4. 当前 bootstrap 的 `PersistenceId.ofUniqueId`、family 的 typed PersistenceId/adapter 参数、protobuf 字段号、serializer ID/manifest/绑定范围、名义 VO 类型及 `addExact` 等溢出语义全部保留。迁到 ClusterSharding 并不授权换 journal identity 或用老 journal 试跑新布局。
5. 原始方法体槽及共享 `???` 诚实保留。除 Factory 观察到的确认处理外，不虚构基金、定投、初始化事件或业务成功判断。

## 8. 拟实施写集合、依赖及唯一组装 owner

**以下均为下一阶段 proposed 写集合，不是本次写许可。** 本次实际只写本 diff 与 `details/aggregate-factory.json`。

### 8.1 本族私有新增文件（proposed）

以 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/` 为根：

| proposed 路径 | 责任 |
|---|---|
| `generators/scala-cqrs-play-service/models/aggregate-factory-model.mjs` | 显式 M1–M7/FM1–FM5/FieldDef/TypeRef 合同；只保留具名 bodyLogic 例外，不存整文件 content |
| `generators/scala-cqrs-play-service/builders/aggregate-factory-builder.mjs` | 对照 B1–B10；输出 immutable 结构；按已裁定 metadata adapter 消费 ID/reply/方法顺序，不猜业务 |
| `generators/scala-cqrs-play-service/templates/aggregate-reference-factory.mjs` | 独立 Factory renderer，对照 T1–T12；由 shared names/types/layout/doc 支撑；不负责 ledger |
| `test/codegen-parity/aggregate-factory.test.mjs` | proposed，内容与负例 fixture 的局部门；不是现成已运行 suite |
| `docs/codegen-parity/fixtures/aggregate-factory/`、`expected/aggregate-factory/` | proposed fixture/expected，见 §9；本阶段不创建，不是第二份业务真源 |

### 8.2 公共/跨制品改动：只由集成 owner 组装

唯一组装 owner 定义为 **`aggregate-assembly-integrator`（职责名，尚未声称已指派人员）**。它拥有复合文件的切分、caller 接线、imports 合并、entry/path/footprint 更新与旧输出退役；Factory 私有实现 owner 不同时修改这些文件。

| 已有路径 / consumer | 准确 split/move/replace 行为 | 依赖/冲突 |
|---|---|---|
| `generators/scala-cqrs-play-service/templates/aggregate-factory.mjs` | split：aggregateTemplate 1–16 保留到 aggregate-root 负责的新文件；factoryTemplate 18–33 经 D1 后换成独立 reference renderer；不得一并覆盖 object Aggregate 的 body/imports | aggregate-root |
| `generators/scala-cqrs-play-service/build-aggregate-models.mjs` | factory role 的结构由私有 Builder 产生；更新 sources/dependencies；其他 6 role 保留 | protocol/behavior/bootstrap/repository 同文件 |
| `generators/scala-cqrs-play-service/render-aggregate-layers.mjs` | 更新 import/role dispatch；只此一处为 formal Factory 调用 owner；artifact entries 不另造第二 writer | writer、aggregate-root |
| `generators/scala-cqrs-play-service/aggregate-names.mjs` | factory 子包与路径交 shared resolver；其他 role 的迁移由其包 owner 协同，不在此包擅改 | shared-layout-types |
| `generators/scala-cqrs-play-service/templates/aggregate-protocol.mjs` | domain Factory 转发对象与应用 alias 迁移；去旧 domain 壳需所有引用先改 | application-protocol、aggregate-root |
| `generators/scala-cqrs-play-service/templates/aggregate-bootstrap.mjs` | 旧 `extends <A>AggregateFactory` 是 Behavior construction 接口；D1 后确定是否保留为独立、正名的 bootstrap capability；sharding registry/DI 注册由 bootstrap owner | bootstrap、PID 保护 |
| `generators/scala-cqrs-domain/render-actor.mjs`、`scaffold.mjs` | 其他 versioned lane 的 domain Factory wrapper/调用者同步退役或明示保留 legacy profile；不是只修银行 service | domain/application profile owners |
| `generators/scala-cqrs-aggregate-core-v1/build-models.mjs`、`templates/factory.mjs`、`render.mjs` | family Factory 作为 Behavior 构造端口不能直接套 reference class；先 D1/D7 决定逻辑身份，再适配同一个 Factory model 或分离另一个有真实职责的制品 | family2、family6/8、typed PID/adapter |
| `generators/scala-cqrs-persistence-readside-v1/templates/persistence.mjs`、`render.mjs` | PersistenceFactory 仅登记为装配调用者/额外角色，保持 codec 与 adapter 参数；如 shared partition 更名须唯一 owner 完成 | persistence/converter/serializer owners |
| `generators/aggregate-dsl/render.mjs`、`generators/_deprecated/scala-cqrs-es/builders/models.mjs` / `templates/scala.mjs` | 本轮仅作可复用算法参考。若继续供给，统一共享 Factory core 或标明 legacy 行为；不因移植而复活旧 generator | legacy assembly owner，默认不改 |

共享依赖的接口需求（不是虚构已有 API）：

- `lib/scala-target/naming.mjs` 的 [resolveName/resolveNameSet/resolveArtifactPath][SHARED-NAMES] 可复用；stable identity 与源码名字分离，新增规则由集成者对齐 BC getBaseName/getAggregateBaseName，不在本包复制多套 safeName。
- `lib/scala-target/model.mjs` 和 shared TypeRef/import/layout 支撑由 shared-layout-types owner 定义兼容面：至少 `name/packageName/typeParams/signature/dependencies`、碰撞处理、FieldDef 默认与来源。未声称当前 model.mjs 已满足 BC 全部语义。
- `src/core/generate.mjs` 的 `applyEntries` 是唯一最终 writer；final bytes→fingerprint→codeMappings/anchor 顺序不能颠倒。若新路径退役，必须基于 owned plan、保留 MANUAL、报告冲突；当前 writer 会保留未计划的旧路径，不是自动垃圾回收。
- `lib/products/generate-cli.mjs`、profile manifests、catalog/partition/assignment、生成配置与 project bindings 的注册调整只由集成者处理。本包不得直接修改它们，更不手改 ledger/anchors。

目标调用者闭包至少包括：Aggregate Root 的 key、Protocol 的 command/reply family、Helpers/Behaviors 的确认协议、Bootstrap 的 sharding 或 local lifecycle、repository 获取引用/缓存接口，以及上层 service 传入的 hosts/authority。完整调用者集合须在下一阶段按最终 owner 接口展开，不假称本次检索已覆盖所有消费点。

## 9. 验收设计与准确 CLI 形状（均未执行）

### 9.1 fixture 集合与完整文件对账

独立 fixture 预定位置为 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/aggregate-factory/`；本次未创建。共用同一语义描述分别适配 BC 的 canonical+bindings 与 JS request+options，保留字段顺序、reply Family、factoryMethods、identifier 类型与来源，不能按散文补值。

| fixture | 必须观察的内容 |
|---|---|
| `reference-credit-balance` | curated 的 userId/Id、AddInitial(initial:Money)、具体 Confirmation.error、显式 factory method 名；确保 adapter 确认元数据选择，不因类同名就当银行输入 |
| `bare-only` | 空命令、只读命令、非只读但零参数时无初始化；仍有 ref 方法/10 秒/EC；不得像 legacy ES 一律 throw |
| `ordered-init` | 至少两个可选命令、前置 read-only；保持 metadata 顺序而不是字母排序；factoryMethods 命名选择与 command 选择分别核对 |
| `identifier-and-params` | 多参数、无同名 ID/有同名 ID、同名不同类型、optional 参数/optional ID、业务参数仅 replyTo；签名/ask 参数顺序及是否额外 ID 逐项查 |
| `missing-or-incompatible-reply` | replyToType 缺失必须拒绝；Reply 无 error 字段、不是 Option[iMadzError]、命令 replyTo 不在预期位置时不生成伪成功，按 D3 的准入处理 |
| `naming-types-source` | keyword ID、名称含 entityTypeKey、重复技术后缀、嵌套泛型、同名 TypeRef 冲突、无 noteId/有 description+noteId；默认值渲染与来源 byte span |
| `bank-structural-only` | 当前三文件冻结不变；authority 与无 authority 两分支；正式银行 expected 在 D1–D3 裁定前缺失 |
| `family-identity` | family2/PersistenceFactory 的 typed PID、J、event/snapshot adapters 和 no-external 准入不能被 reference Factory 覆盖 |

完整输出集合不止 Factory：为 Factory 编译/行为所需的 Protocol、Aggregate key、Bootstrap、Entity、Rule/Helpers/Behaviors、VO/error 供给及 build 根必须一起登记。Factory 本身每聚合一个文件，bare/init 是同文件方法变体，不另生第二文件。记录 `raw-scala`、`approved-target`、`actual-js` 三份完整文件集，curated 独立保留；仅允许逐项批准的来源头/换行/明确格式偏差，不做全空白 normalize。

### 9.2 JS 公开 CLI：只限定已存在 flag

在未来 fixture 和审批就绪后，formal service 的命令形状如下；这些 proposed 路径尚未创建，不是现在可运行承诺。

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/aggregate-factory/reference-credit-balance/request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-play-service \
  --out /Users/zhongdj/Workspaces/mad-polaris/aggregate-factory-parity-candidate/js-single \
  --options-json /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/aggregate-factory/reference-credit-balance/options.json \
  --plan
```

- [CLI:66–88][CLI] 精确支持 `--request --generator --out --options-json --plan`。不支持 `--artifact aggregate-factory`；作用域靠最小 request 和实际 profile 的依赖闭包，不假造 flag。plan 编译产品并渲染整 plan，只是不 apply，不能认为没有计算成本。
- 去掉 `--plan` 才会写候选的 app/build/conf/test 等 entries、`truthsrc.ledger.json`、`anchors.json`；当前只读阶段两种都不执行。
- [CLI:114–139][CLI] service 还读取并 hash 本地固定 `saga-core_2.13:0.3.0` jar；有 pipelines 时另核 Monarch jar；验证 externalSourceRoots 是已有、非 symlink、与 output 分离的绝对目录。未读 jar，本次无 runtime 供给认证。缺依赖/目录必须停止，不能下载或 publishLocal 洗绿。
- 此 `generate-products` 路径本身读取输入、内存 compileProductSet、生成 plan，非 apply 分支没有图/ledger/cache 落盘；apply 的写面由 [applyEntries:246–268][APPLY] 确认。它不运行 Scala 编译/服务，但生成的文件可包括编译/测试入口；不能把两者混同。
- family2 的对照替换 generator 为绝对 `.../generators/scala-cqrs-aggregate-core-v1`，request/options 使用 `family-identity/` 对应 schema，out 为 `/Users/zhongdj/Workspaces/mad-polaris/aggregate-factory-parity-candidate/js-family2`，四个必填 flag 与 `--plan` 相同。若为 family8 捕获外置实现，CLI 明确要求 `generate-project`，不拿上述命令冒充可执行入口；该捕获/项目配置由其 owner 另裁，本族不扩范围。

### 9.3 BC 传统主链 CLI

[CodegenMain:62–75,174–250][MAIN] 明确支持文件输入与绑定。未来在 BC 仓库 cwd 执行的完整形状（本次未执行）为

```bash
(
  cd /Users/zhongdj/Workspaces/mad-polaris/backkend-codegen &&
  sbt \
    -Dcodegen.systemFile=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/aggregate-factory/reference-credit-balance/canonical.json \
    -Dcodegen.systemBindings=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/aggregate-factory/reference-credit-balance/bindings.json \
    -Dcodegen.targetDir=/Users/zhongdj/Workspaces/mad-polaris/aggregate-factory-parity-candidate/bc-single \
    -Dcodegen.multiProject=false \
    "runMain net.imadz.codegen.CodegenMain"
)
```

这里明确选择 file-system system slot，**不再同时传 `-Dcodegen.system`**，因为源码将二者设为互斥。不用默认 Examples/banking-app；不用 semanticProductsFile，因为它不是本族传统 MBT。multi-project 的未来独立对照仅将 true 与新 bc-multi 输出根成对替换，不混合根。

副作用：sbt/JVM 启动，可能构建生成器并触及 BC target/project target、sbt/Ivy/Coursier 缓存及依赖解析/网络；CodegenMain 先 prepare，再 mkdir/copy scaffold，可能移动 multi scaffold；传统 writer 写 app 或 modules、fingerprint、ledger/相关回执；CodegenMain 还写 knowledge-release manifest、formal-semantics.json。**新 output 不能保证没有仓库/缓存旁路写入**。运行前须按仓库协调协议批准闭包和离线供给；本次不调用、不下载、不发布。

### 9.4 各门与停止点

- 内容门：逐文件路径、包、完整 imports/重复项、类/构造器/implicit/default、方法参数顺序、两个完整 RHS、例外/异常、来源落点；不能仅比签名。
- 接口/行为门（未来集中执行）：真实 Akka sharding + reply 合同；bare 不发初始化消息；init 恰发送所选命令、参数正确；Some(error) 返回同一 error 的 Left，None 才返回同一 entityRef；超时/基础设施失败保持失败；Helper 失败不 persist、成功 thenReply 读新状态、回复一次且没有意外发布。先冻结 jar/fixture，再确定具体 suite 命令；没有现成 suite 名时不编造。
- 保护门：PB/PID/serializer/nominal/overflow 字节和语义未漂；外部 authority、typed adapters 不丢；旧产物的引用迁移、owned 退役和 MANUAL 冲突可说明。
- 稳定门：两次相同输入最终文件稳定；一个字段/规则的受控变更只带来必要局部 diff；query 到最终 byte spans，不在格式化前盖旧 fingerprint。
- 命名/复杂度门：普通方法 CC≤5 目标；6–10 逐方法解释；>10 拆清职责或逐方法批准例外。当前 **`not-measured`**，未确定工具/版本；不报分数、不把分支搬成 String/Any 表刷分。
- 初始调度预算：生成/内容比对闭包 5 分钟内、批末局部编译/行为 15 分钟内；这是未来预算而非性能实测。缺输入/jar/语义裁定即停，不启动全银行 runtime/workshop。

## 10. 精确未决项

| ID | 必须裁定的具体问题 | 阻断范围 |
|---|---|---|
| D1 lifecycle / 接口替换 | 目标是 BC ClusterSharding 引用工厂，但银行现接口/Bootstrap 管 local Behavior 和 unique PID，family 还携带 J/adapter。谁继续拥有 Behavior creation、如何正名/迁移调用者、是否实际启用 sharding 注册？需不改变既有 PID 的设计；不能将 trait→class 当无行为变化 | formal/family 接线、bootstrap/repository、完整银行 expected |
| D2 initialization 输入 | 银行每聚合哪个命令是初始化？保留 raw first eligible heuristic 还是要求显式 factory-command 绑定？同名 ID 类型不同/optional ID/仅 replyTo 参数如何准入？metadata method 名与 command 不匹配时拒绝还是解释？ | init 变体、canonical/request adapter；不影响已观察 bare 算法记账 |
| D3 reply 形状 | 各初始化命令的 typed replyTo/Reply.error:Option[iMadzError] 从哪个权威输入获得？当前 Accepted/Refused(code:String) 与 raw error Either 不能互换；是否扩正式产品合同，缺字段必须如何拒绝？ | protocol/helper/behavior/factory 联合接口 |
| D4 defaults / import 字节 | optional 的 FieldDef.defaultValue=Some("None") 但 raw 产物不发默认值：目标保留 raw 还是批准修正？重复 Future 的表达清理与 import 冲突规则如何进入有限白名单？ | optional fixture、最终 expected/import 精确对账 |
| D5 lexical / names / 类型缺口 | bodyLogic 全字符串 replace、定位 ID RHS 未 escape、method name 未 escape、getBaseName 与 getAggregateBaseName 不同、WithoutBalance 跨领域命名和未知类型 `???`/Any 兜底：哪些作为兼容债保留，哪些批准为拒绝/结构化改写？ | 命名边界/类型边界负例；不允许自行填逻辑 |
| D6 glue / 供给 | 实际消费的是 common-core_2.13:0.2 jar、生成 scaffold 同名实现，还是其他冻结供给？哪份实际有 CommandHelper 三方法和所需 replyWith 语义？Guice/EC/sharding 接口的实际供给与注册如何证明？ | 编译/行为门；不授权 runtime 发布或本地副本 |
| D7 profile / ownership / source mapping | 首轮 single profile 已明确作为对照选择，但 family multi 的 glue Factory 与 BC kernel Factory 如何归属同一目标？noteId 与 source pointer 的方法参数映射、多个近似/装配 Factory 的逻辑 identity 和唯一 writer 接入需要集成者冻结；不得仅合并 kind | family6/8 接缝、回锚、退役计划 |

本文保存的结果是：本族源码合同、结构差异和实施边界已独立落档；仍缺同输入生成文件和上述接口裁定，不宣称 ready、implemented、parity-PASS 或 behavior-PASS。

## 附录 A：raw Scala Model 完整源码

来源 [M:1–31][M]。保留原字段、注释与默认值。

```scala
package net.imadz.codegen.scaffolding.cqrs.model.application


import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, FieldDef, TypeRef}

// 聚合根工厂模型
case class AggregateFactoryModel(
                                  override val selfType: TypeRef, // e.g. CreditBalanceAggregateFactory
                                  aggregateType: TypeRef, // e.g. CreditBalanceAggregate (用于引用 Protocol)

                                  // 核心 Sharding/Akka 配置
                                  entityTypeKey: String, // e.g. CreditBalanceEntityTypeKey
                                  commandFamily: TypeRef, // e.g. CreditBalanceCommand

                                  // 工厂方法
                                  factoryMethods: Seq[FactoryMethodModel],

                                  override val dependencies: Set[TypeRef],
                                  /** S7（EP §二 G1）：聚合号——台账 artifacts[] 文件级落点由此可查。 */
                                  override val noteIds: Seq[String] = Nil
                                ) extends ArtifactModel

case class FactoryMethodModel(
                               name: String, // 方法名，如 createCreditBalanceWithDefaultBalance
                               parameters: Seq[FieldDef], // 输入参数，如 userId: Id, initial: Money
                               returnType: TypeRef, // 返回类型
                               bodyLogic: String, // 方法体代码 (这里是重点)
                               isInitialization: Boolean = false // 是否是 Akka Ask 初始化的特殊方法
                             )

```

## 附录 B：raw Scala Builder 完整源码

来源 [B:1–291][B]。注释中的历史声称保留为原文，事实以代码为准（特别是 optional 默认值）。

```scala
package net.imadz.codegen.scaffolding.cqrs.builder.application

import net.imadz.codegen.scaffolding.cqrs.model.application.{
  AggregateFactoryModel,
  FactoryMethodModel
}
import net.imadz.codegen.scaffolding.cqrs.{FieldDef, GeneratorContext, TypeRef}
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.{
  AggregateRootMetadata,
  CommandReplyRef,
  CommandRef,
  SubordinateCommandMetadata
}

object AggregateFactoryBuilder {

  def build(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): AggregateFactoryModel = {
    val pkg = ctx.layout.application.aggregates.factories
    val selfType = ctx.typeResolver.aggregateFactory(meta)
    val aggregateType = ctx.typeResolver.aggregateRoot(meta.name)
    val commandFamily = ctx.typeResolver.commandFamily(meta.commandFamily.name)
    val entityTypeKey = "entityTypeKey"

    // 解析基础类型和字段
    val idField = resolveIdField(meta, ctx)
    val repliesType = resolveReplyTypes(meta, ctx)
    val commandsType = resolveCommandTypes(meta, commandFamily, ctx)

    // 构建工厂方法
    val refMethod =
      buildCreateRefMethod(meta, idField, commandFamily, entityTypeKey, ctx)
    val initMethodOpt = buildInitializationMethodOption(
      meta,
      idField,
      commandFamily,
      entityTypeKey,
      ctx
    )
    val factoryMethods = Seq(refMethod) ++ initMethodOpt

    // 收集依赖
    val dependencies = collectDependencies(
      commandsType,
      repliesType,
      initMethodOpt,
      refMethod,
      ctx,
      pkg
    )

    AggregateFactoryModel(
      selfType,
      aggregateType,
      entityTypeKey,
      commandFamily,
      factoryMethods,
      dependencies,
      noteIds = meta.noteId.toSeq
    )
  }

  /** 解析 ID 字段
    * 2026-08-21 摄入侧适配：id 名用聚合 identifier（原硬编码 'userId'，Session/Workgroup 等聚合不适用）
    */
  private def resolveIdField(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): FieldDef = {
    val idType = ctx.typeResolver.parameterType(meta.identifier.fieldType)
    // 2026-09-23 EP_GenerationTime_Code_Anchors B4（断链修复）：标识符字段**本身也是知识元素**
    // （真源 `fieldModel.identifier` 26/26 全带 noteId），此前只搬 name/type ⇒ 该 id 到不了模板。
    // 带上后模板可在 `def` 前发**形态③** 方法参数锚（`pkg.Factory.createX.<参数>  @knowledge <id>`）。
    FieldDef(meta.identifier.name, idType, noteId = meta.identifier.noteId, description = meta.identifier.description)
  }

  /** 解析回复类型
    */
  private def resolveReplyTypes(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): Seq[TypeRef] = {
    meta.replyFamily.replies.map(x =>
      ctx.typeResolver.resolve(CommandReplyRef(x.name))
    )
  }

  /** 解析命令类型
    */
  private def resolveCommandTypes(
      meta: AggregateRootMetadata,
      commandFamily: TypeRef,
      ctx: GeneratorContext
  ): Seq[TypeRef] = {
    commandFamily +: meta.commandFamily.commands.map(x =>
      ctx.typeResolver.command(CommandRef(x.name))
    )
  }

  /** 构建创建引用方法 (裸引用)
    */
  private def buildCreateRefMethod(
      meta: AggregateRootMetadata,
      idField: FieldDef,
      commandFamily: TypeRef,
      entityTypeKey: String,
      ctx: GeneratorContext
  ): FactoryMethodModel = {
    val entityRefType =
      ctx.knownFrameworkTypes("EntityRef").copy(typeParams = Seq(commandFamily))
    val aggNameBase = NamingConventions.getBaseName(meta.name)

    FactoryMethodModel(
      name = s"create${aggNameBase}WithoutBalance",
      parameters = Seq(idField),
      returnType = entityRefType,
      bodyLogic =
        s"""clusterSharding.entityRefFor($entityTypeKey, ${idField.name}.toString)"""
    )
  }

  /** 构建初始化方法选项 查找第一个非只读且带参数的命令作为初始化命令
    */
  private def buildInitializationMethodOption(
      meta: AggregateRootMetadata,
      idField: FieldDef,
      commandFamily: TypeRef,
      entityTypeKey: String,
      ctx: GeneratorContext
  ): Option[FactoryMethodModel] = {
    val initCommandOpt = meta.commandFamily.commands.find(c =>
      !c.isReadOnly && c.parameters.nonEmpty
    )

    initCommandOpt.map { initialCommandMeta =>
      val methodName = determineInitializationMethodName(meta)
      buildCreateWithInitialMethod(
        meta,
        initialCommandMeta,
        idField,
        commandFamily,
        entityTypeKey,
        ctx,
        methodName
      )
    }
  }

  /** 确定初始化方法名称
    */
  private def determineInitializationMethodName(
      meta: AggregateRootMetadata
  ): String = {
    val aggNameBase = NamingConventions.getAggregateBaseName(meta.name)

    // 查找 Factory Metadata 中第一个带参数的方法名作为初始化方法名
    meta.factoryMethods
      .find(m => m.parameters.nonEmpty)
      .map(_.name)
      .getOrElse(s"create${aggNameBase}WithInitialValue") // 默认回退方法名
  }

  /** 构建带初始值的创建方法 (Ask 初始化)
    * 2026-08-21 摄入侧适配：初始化命令多参数（OnboardTenant/CreateConcept 等），
    * 工厂方法参数 = id + 全部业务参数，ask 时全量传递（原假设单业务参数）
    */
  private def buildCreateWithInitialMethod(
      meta: AggregateRootMetadata,
      cmdMeta: SubordinateCommandMetadata,
      idField: FieldDef,
      commandFamily: TypeRef,
      entityTypeKey: String,
      ctx: GeneratorContext,
      methodName: String
  ): FactoryMethodModel = {
    // 解析业务参数（排除 replyTo）
    // 2026-08-21 摄入侧适配：创建命令常携带同名 id 参数（String，如 CreateConcept.conceptId），
    // 与聚合标识（Id 类型）重名——命令参数含同名 id 时以其为准（工厂参数不再叠加 Id 参数），
    // 聚合定位 key 用同名参数值；无同名 id 时（bankingSystem 形态）idField 承担定位
    val businessParams = cmdMeta.parameters.filterNot(_.name == "replyTo")
    val hasIdParam = businessParams.exists(_.name == idField.name)
    val paramDefs = businessParams.map { p =>
      // Controller 三可选参根治批 2026-10-05：optional 参数方法签名翻 Option[T]=None（ask 直通命令 Option 字段）
      if (p.optional)
        FieldDef(p.name, TypeRef.Option(ctx.typeResolver.parameterType(p.parameterType)),
          defaultValue = Some("None"), noteId = p.noteId, description = p.description)
      else
        FieldDef(p.name, ctx.typeResolver.parameterType(p.parameterType), noteId = p.noteId, description = p.description)
    }
    val methodParams = if (hasIdParam) paramDefs else idField +: paramDefs

    // 解析回复类型
    val replyRef = cmdMeta.replyToType.getOrElse(
      throw new IllegalStateException(
        s"Command ${cmdMeta.name} must specify a reply type for factory initialization."
      )
    )
    val replyType =
      ctx.typeResolver.resolve(CommandReplyRef(replyRef.targetName))

    // 构建返回类型
    val entityRefType =
      ctx.knownFrameworkTypes("EntityRef").copy(typeParams = Seq(commandFamily))
    val eitherType = ctx.typeResolver.either(
      ctx.knownFrameworkTypes("iMadzError"),
      entityRefType
    )
    val returnType =
      ctx.knownFrameworkTypes("Future").copy(typeParams = Seq(eitherType))

    // 生成方法体
    val cmdName = cmdMeta.name
    // ask 只传命令参数（含同名 id 时用参数值；无同名 id 时定位 key 由 entityRefFor 承担，不进 ask）
    val askParams = if (hasIdParam) methodParams else paramDefs
    val body = generateInitializationMethodBody(
      commandFamily,
      entityTypeKey,
      idField.name,
      cmdName,
      askParams,
      replyType
    )

    FactoryMethodModel(
      name = methodName,
      parameters = methodParams,
      returnType = returnType,
      bodyLogic = body,
      isInitialization = true
    )
  }

  /** 生成初始化方法体
    */
  private def generateInitializationMethodBody(
      commandFamily: TypeRef,
      entityTypeKey: String,
      idArgName: String,
      cmdName: String,
      paramDefs: Seq[FieldDef],
      replyType: TypeRef
  ): String = {
    val askArgs = (paramDefs.map(p => NamingConventions.scalaIdentifier(p.name)) :+ "_").mkString(", ")
    s"""|val entityRef: EntityRef[${commandFamily.name}] = clusterSharding
         |      .entityRefFor[${commandFamily.name}]($entityTypeKey, $idArgName.toString)
         |    for {
         |      confirmation <- entityRef.ask[${replyType.name}]($cmdName($askArgs))
         |    } yield {
         |      confirmation.error
         |        .map(Left.apply[iMadzError, EntityRef[${commandFamily.name}]])
         |        .getOrElse(Right(entityRef))
         |    }""".stripMargin
  }

  /** 收集所有依赖关系
    */
  private def collectDependencies(
      commandsType: Seq[TypeRef],
      repliesType: Seq[TypeRef],
      initMethodOpt: Option[FactoryMethodModel],
      refMethod: FactoryMethodModel,
      ctx: GeneratorContext,
      pkg: String
  ): Set[TypeRef] = {
    // 基础依赖（当前为空）
    val commonDeps = Set.empty[TypeRef]

    // 初始化方法相关依赖
    val initDeps = initMethodOpt.toSet.flatMap { (method: FactoryMethodModel) =>
      method.parameters.flatMap(_.typeRef.collectAllDependencies) ++
        method.returnType.collectAllDependencies ++
        Set(
          ctx.knownFrameworkTypes("Future"),
          ctx.knownFrameworkTypes("Either"),
          ctx.knownFrameworkTypes("iMadzError")
        )
    }

    // 裸引用方法（createXxxWithoutBalance）：参数（identifier 类型 Id）+ 返回 EntityRef[CommandFamily] 都要进 import
    val refDeps = refMethod.parameters.flatMap(_.typeRef.collectAllDependencies) ++
      refMethod.returnType.collectAllDependencies

    // 过滤需要导入的依赖
    (commandsType.toSet ++ repliesType.toSet ++ commonDeps ++ initDeps ++ refDeps)
      .filter(_.shouldImport(pkg))
  }
}
```

## 附录 C：raw Scala Template 完整源码

来源 [T:1–82][T]。

```scala
package net.imadz.codegen.scaffolding.cqrs.template.application

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.model.application.AggregateFactoryModel

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate

object AggregateFactoryTemplate extends CodeTemplate[AggregateFactoryModel] {

  def generate(model: AggregateFactoryModel): String = {
    // 1. 构建包声明
    val pkgDecl = packageDecl(model.selfType.packageName)

    // 2. 构建导入声明
    val importList = model.dependencies.toList
      .sortBy(_.fqn)
      .map(_.fqn)
      .filterNot(p =>
        p.isEmpty || p == model.selfType.packageName || p.startsWith(
          "java.lang"
        )
      )
      .++(
        Seq(
          "javax.inject.Inject",
          "akka.cluster.sharding.typed.scaladsl.ClusterSharding",
          "akka.util.Timeout",
          "scala.concurrent.duration._",
          "scala.concurrent.ExecutionContext",
          model.aggregateType.fqn // 导入 Aggregate Object
        )
      )

    val importDecl = imports(importList: _*)

    // 3. 构建工厂方法
    val methods = model.factoryMethods
      .map { m =>
        val params = m.parameters
          .map(p => s"${NamingConventions.scalaIdentifier(p.name)}: ${p.typeRef.signature}")
          .mkString(", ")
        // 2026-09-23 EP_GenerationTime_Code_Anchors B4（**形态③**）：工厂方法参数是知识元素的落点
        // （聚合标识符／初始化命令参数），有 noteId 者在此发 `@param … @knowledge` 块——
        // 解析器认「注释块后**紧跟 `def`**」这一形态（本模板无 case class，形态① 结构上认不出）。
        // 无 noteId（合成/注入）时返回空串，零漂移。
        val fieldDoc = net.imadz.codegen.scaffolding.cqrs.template.KnowledgeAnchorDoc.fieldDoc(m.parameters, "  ")
        // [FIX] 引用 EntityTypeKey 时加上 Aggregate 前缀
        val keyRef = s"${model.aggregateType.name}.${model.entityTypeKey}"
        // 替换 bodyLogic 中的 key 引用 (如果 Builder 传过来的是短名)
        val fixedLogic = m.bodyLogic.replace(model.entityTypeKey, keyRef)

        s"""$fieldDoc  def ${m.name}($params): ${m.returnType.signature} = {
    $fixedLogic
  }"""
      }
      .mkString("\n\n")

    // 4. 构建完整源代码
    val sourceCode = s"""${pkgDecl.code}

${importDecl.code}

/**
 * ${model.selfType.name}: Aggregate Factory for ${model.aggregateType.name}
 * Creates and manages aggregate instances via cluster sharding
 */
class ${model.selfType.name} @Inject() (clusterSharding: ClusterSharding)(implicit ec: ExecutionContext) {
  implicit val askTimeout: Timeout = Timeout(10.seconds)

$methods

}
"""

    // 5. 生成代码
    sourceCode
  }
}
```

## 固定来源索引（链接均可取得全文，行锚指向本族读取位置）

[M]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/AggregateFactoryModel.scala#L1-L30
[B]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateFactoryBuilder.scala#L1-L290
[T]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateFactoryTemplate.scala#L1-L81
[C]: ../baseline/curated-scala/net/imadz/application/aggregates/factories/CreditBalanceAggregateFactory.scala#L1-L34
[MAIN]: ../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L62-L250
[DISPATCH]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L598-L645
[WRITER]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L331-L419
[TYPE]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4-L85
[ART]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L5-L47
[DSL]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L13-L22
[DOC]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/KnowledgeAnchorDoc.scala#L32-L61
[RES-FACTORY]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L633-L646
[RES-AGG]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L236-L254
[RES-CF]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L171-L212
[RES-PARAM]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L1148-L1151
[RESOLVE]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala#L19-L93
[NAMES]: ../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L171-L265
[FRAMEWORK]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L264-L276
[BUILD]: ../baseline/bc/scaffold/build.sbt#L10-L135
[COMMON-TYPES]: ../baseline/common/src/main/scala/net/imadz/common/CommonTypes.scala#L1-L16
[REPLY]: ../baseline/common/src/main/scala/net/imadz/common/application/CommandHandlerReplyingBehavior.scala#L16-L86
[J-T]: ../baseline/js/generators/scala-cqrs-play-service/templates/aggregate-factory.mjs#L1-L33
[J-B]: ../baseline/js/generators/scala-cqrs-play-service/build-aggregate-models.mjs#L1-L42
[J-NAMES]: ../baseline/js/generators/scala-cqrs-play-service/aggregate-names.mjs#L1-L30
[J-NAMING]: ../baseline/js/generators/scala-cqrs-domain/naming.mjs#L1-L32
[J-RENDER]: ../baseline/js/generators/scala-cqrs-play-service/render-aggregate-layers.mjs#L1-L30
[J-GEN]: ../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L16-L70
[J-PROTOCOL]: ../baseline/js/generators/scala-cqrs-play-service/templates/aggregate-protocol.mjs#L3-L39
[J-PRODUCE]: ../baseline/js/generators/scala-cqrs-application/produce.mjs#L18-L29
[J-DSL-PRODUCE]: ../baseline/js/generators/aggregate-dsl/produce.mjs#L1-L7
[J-ACTOR]: ../baseline/js/generators/scala-cqrs-domain/render-actor.mjs#L4-L30
[A-C]: ../baseline/actual-js/app/example/bankwealth/application/aggregates/CreditBalanceAggregateFactory.scala#L1-L12
[A-F]: ../baseline/actual-js/app/example/bankwealth/application/aggregates/FundOrderAggregateFactory.scala#L1-L12
[A-S]: ../baseline/actual-js/app/example/bankwealth/application/aggregates/SipPlanAggregateFactory.scala#L1-L12
[A-BOOT]: ../baseline/actual-js/app/example/bankwealth/infrastructure/bootstrap/CreditBalanceBootstrap.scala#L1-L28
[CLI]: ../baseline/js/lib/products/generate-cli.mjs#L66-L145
[APPLY]: ../baseline/js/src/core/generate.mjs#L20-L269
[L-DSL]: ../baseline/js/generators/aggregate-dsl/render.mjs#L1016-L1131
[L-EMIT]: ../baseline/js/generators/aggregate-dsl/emit.mjs#L1-L10
[L-B]: ../baseline/js/generators/_deprecated/scala-cqrs-es/builders/models.mjs#L250-L315
[L-T]: ../baseline/js/generators/_deprecated/scala-cqrs-es/templates/scala.mjs#L171-L194
[L-GEN]: ../baseline/js/generators/_deprecated/scala-cqrs-es/generate.mjs#L25-L93
[L-MANIFEST]: ../baseline/js/generators/_deprecated/scala-cqrs-es/generator.json#L1-L36
[F-B]: ../baseline/js/generators/scala-cqrs-aggregate-core-v1/build-models.mjs#L1-L248
[F-T]: ../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/factory.mjs#L1-L11
[F-GEN]: ../baseline/js/generators/scala-cqrs-aggregate-core-v1/generate.mjs#L1-L24
[F-RENDER]: ../baseline/js/generators/scala-cqrs-aggregate-core-v1/render.mjs#L1-L35
[F-IMPORT]: ../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/imports.mjs#L1-L25
[P-RENDER]: ../baseline/js/generators/scala-cqrs-persistence-readside-v1/render.mjs#L1-L30
[P-T]: ../baseline/js/generators/scala-cqrs-persistence-readside-v1/templates/persistence.mjs#L105-L157
[PA-RENDER]: ../baseline/js/generators/scala-cqrs-play-application-v1/render.mjs#L1-L28
[SHARED-NAMES]: ../baseline/js/lib/scala-target/naming.mjs#L26-L118
