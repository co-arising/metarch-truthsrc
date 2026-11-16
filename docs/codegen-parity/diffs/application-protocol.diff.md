# application-protocol：Commands / Replies 内容级差异规格

## 1. 范围、证据身份与状态

- Artifact ID / group：`application-protocol`；Scala 清单序号 **7**。本文是文档阶段交付，状态 **`decision-required`**，不是实现、编译、行为或 parity 通过声明。
- 固定 HEAD：JS `bf104e16ab82ef39d7fa416d0997907d18a815ad`；BC `cc335eb1e0d0fae17bf092fd61b126040196ea70`。HEAD 只是仓库身份，以下固定文件字节及 [baseline/index.json](../baseline/index.json) 才是内容依据。
- 已读取本族完整 Scala Model、共享 Command 模型所在文件、完整 Builder、完整 Template；大支撑文件按相关区段读取。本文附完整 M/B/T 源码以及字段、分支、construct/RHS 账，不以文件名推断实现。
- **没有本轮同输入双端新生成物。** `raw-scala` 在本文指固定传统模板及其逐构造发射合同，不能冒称已取得 fresh raw 输出；`actual-js` 是银行已有输出；`curated-reference` 是人工完成的另一业务样板；`approved-target` 是用户已明确的结构/分层合同及其参考切片排版。后三者不得混签为同输入字节一致。
- 本轮未执行测试、typecheck、编译、生成、runtime、服务、下载或 Git 写入；未修改真源树、baseline、应用、catalog、ledger、anchors。仅写本 diff 与 `details/application-protocol.json`；已有其他 diff 不在写范围。
- 唯一额外读取的非 baseline 指引文件：`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/AGENTS.md`，SHA-256 `8bfd761390a6fc90b09663157f9d35b23c0c58b20c9f6a41dd5698450015d601`。未额外读取当前生产源码。指定 authoring/layout/plan/catalog 是本次控制文档，不当作生产输出证据。

### 1.1 核心固定来源

链接从本文出发均指向固定副本，行号也是副本行号。主 M/B/T、共享模型、两份实际输出、人工协议及表内 legacy/family 源的字节与 index 做了只读 SHA 对照；这不是 runtime 验证。

|角色|完整固定文件|bytes|SHA-256|
|---|---|---:|---|
|M|[AggregateProtocolModel.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/AggregateProtocolModel.scala#L1-L16)|739|`e44c087828ac85d4feaf83a4d061d181b8098c01aba24bc54af4140113628fbe`|
|共享 Command 模型|[AggregateRootModel.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/AggregateRootModel.scala#L1-L84)|2369|`20460e277768e97051dcb9ae695f00e35b7887948dfa05ec34f843a78f3cf6a9`|
|B|[AggregateProtocolBuilder.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateProtocolBuilder.scala#L1-L108)|4144|`fef186e632228c930f3c9c5db177653e4609f4b8baf50f8aacae09736640596d`|
|T|[AggregateProtocolTemplate.scala](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateProtocolTemplate.scala#L1-L126)|4692|`25fd60e6c669ef03b4d0b3165f34c8629c758276cb70328831407a37835d313a`|
|人工参考|[CreditBalanceProtocol.scala](../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L1-L40)|2768|`9f860bbafefdc4200d2f211c5c68524130892e022c5417535722afa33c767a54`|
|actual-js application|[CreditBalanceProtocol.scala](../baseline/actual-js/app/example/bankwealth/application/aggregates/CreditBalanceProtocol.scala#L1-L29)|1414|`32cd47bb368899f04a33b3496d15bf5be332a52e81d04a598eb6a2fc69768f18`|
|actual-js domain|[CreditBalanceProtocol.scala](../baseline/actual-js/app/example/bankwealth/domain/CreditBalanceProtocol.scala#L1-L21)|3158|`ec9931ed62f4e187f34200dadb464826ee773a4944fef6593eb1a2ab936f3d8c`|
|formal Template|[aggregate-protocol.mjs](../baseline/js/generators/scala-cqrs-play-service/templates/aggregate-protocol.mjs#L1-L40)|2577|`a1f2475858d54db53f35cfdf09308ff545616b821d473852ce3e05c787e56eeb`|
|legacy 复合 Builder 文件|[models.mjs](../baseline/js/generators/_deprecated/scala-cqrs-es/builders/models.mjs#L17-L102)|21924|`26cea8e0268a0605ac5581fc954122b0b5d501c5a97276d7bd56afe5af7191f7`|
|legacy 复合 Template 文件|[scala.mjs](../baseline/js/generators/_deprecated/scala-cqrs-es/templates/scala.mjs#L6-L48)|9000|`dd6e64c14c3b6e95743f84d59254ca67b2b728cb8768f152b6afaf6ecfcca2f8`|
|family2 Template|[actor-protocol.mjs](../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/actor-protocol.mjs#L1-L12)|1081|`66446bbe92ac8967eb56115e82d242c0d365dfdb8f862a225d2d4f77eb1c4fba`|

其他固定支撑的完整 bytes/SHA 可按本文链接路径在 index 查回，不用可变工作副本替代。银行固定项目的 `generator` 为 `scala-cqrs-play-service`，只提取该绑定，不展开配置：[truthsrc.project.json:278](../baseline/bank/truthsrc.project.json#L278)，文件 SHA `ae42876f8cd46d75372378fc993595ecff5dd65755e98adc045ff22597c3e691`。

### 1.2 调度、基数、路径和变体

真实传统入口：[CodegenMain.scala:175–201](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L175-L201) 的非 `semanticProductsFile` 分支 → `prepare` → 传统生成 → [CQRSApplicationGenerator.scala:203–220](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L203-L220) → [generateApplicationLayer:598–633](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L598-L633)。对每个 `app.aggregates`，先 Root，再 `AggregateProtocolBuilder.build(meta, ctx)`，再 `AggregateProtocolTemplate.generate`、`writeArtifact`。不按 `isReadOnly` 排除协议命令；没有“必须有写命令才生成协议”的门。

|变体 ID|条件及可达性|每聚合基数 / 输出|证据状态|
|---|---|---|---|
|`traditional-aggregate`|`app.aggregates` 的普通 metadata|1 个 `<Base>Protocol.scala`|源码启用；无本轮 fresh raw 文件|
|`traditional-transactor-attribution`|同一集合中 `meta.metaCategory == "application.services.transactor"`|仍 1 个 Protocol；`schemaCategory=saga`，否则 aggregate；kind 都是 `protocol`|不是另一个 Template，也不是 classic saga-trigger 族|
|`reply-to-present`|每条 `cmd.replyToType=Some(ref)`|该命令末字段追加 `replyTo: ActorRef[ResolvedReply]`|Builder 启用；原参数数可为 0|
|`reply-to-absent`|`replyToType=None`|不合成 replyTo，不合成默认 Reply|源码支持；目标 Actor 命令须由输入明确说明是否无回复|
|`handler-pair`|`stateType.zip(eventType)` 非空|1 个函数 type alias|传统 Builder 两者均 Some；模板单边缺失则抑制 alias|
|`inline-state-template-only`|手工给 Model.state=Some|额外 TransactionEvent/Status/State/companion|本 Builder 固定传 None，因此本主链 suppressed；含 `???`，非已实现 Saga 状态机|
|`scope-or-territory-suppressed`|writer concern 不含该 attribution；或领地 KEEP/冻结已有文件|实际写入可为 0|不能把构造 Model 次数当落盘数|

物理路径由 [writer:331–425](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L331-L425) 决定：

- single：`<target>/app/<base-as-path>/application/aggregates/<Base>Protocol.scala`。
- multi：kind `protocol` 路由 **kernel**，`<target>/modules/kernel/src/main/scala/<base-as-path>/application/aggregates/<Base>Protocol.scala`。family2 现状为 glue，不可把两者混称相同。
- 参考切片 single 的完整相对路径：`app/net/imadz/application/aggregates/CreditBalanceProtocol.scala`。
- 银行未来 single 目标：`app/example/bankwealth/application/aggregates/CreditBalanceProtocol.scala`；本文不写入 `generated/current`。业务根下面只允许 `domain/application/infrastructure`；协议保持 application.aggregates，不引入第四层。
- Scala 默认物理路径名来自 `getBaseName(meta.name) + "Protocol"`；命令/回复名来自 metadata 原值。PascalCase/lowerCamelCase 和文件碰撞校验由共同命名模型承接，不能顺手修改稳定业务 ID。

## 2. Model：字段、默认值、子型及依赖

### 2.1 本族结构逐字段账

字段顺序就是构造参数顺序；`—` 表示没有默认值，不是空串或 Nil。

|模型 / 顺序|字段 : 类型|默认|发射/后续使用|当前 formal 对应及缺口|
|---|---|---|---|---|
|AggregateProtocolModel 1|`selfType: TypeRef`（override val）|—|文件名、包、object 名|`names.protocol/package/paths.protocol` 分散，没有 TypeRef|
|2|`commandFamily: CommandFamilyModel`|—|trait、命令循环、alias 输入|只有 `aliases` 和 legacy Request，没有每业务命令模型|
|3|`replies: Seq[CommandReplyModel]`|—|按输入顺序定义全部 replies|只给 legacy.Reply type alias|
|4|`state: Option[StateModel]`|`None`|模板可选内联块|formal Entity 另文件，但其 Command/Event 仍平铺 domain；不得因此启用内联块|
|5|`stateType: Option[TypeRef]`|`None`|alias 左参数和 Effect 第二参数|hardcode `State` import|
|6|`eventType: Option[TypeRef]`|`None`|alias Effect 第一参数|hardcode `Event` import|
|7|`dependencies: Set[TypeRef]`（override val）|—|imports + writer ledger deps|`artifact.dependencies` 只有路径，不等于类型依赖树|
|8|`noteIds: Seq[String]`（override val）|`Nil`|writer 文件级知识落点|`artifact.sources` 经 entry 转 knowledgeIds；没有原模型字段同构|
|CommandFamilyModel 1–3|`name: String`, `commands: Seq[CommandModel]`, `superTypes: Seq[TypeRef]`|前两项 —；superTypes `Nil`|trait superTypes 用 `.name` 连接|formal 固定 `Command=Request`|
|CommandModel 1–3|`name: String`, `fields: Seq[FieldDef]`, `superTypes: Seq[TypeRef]`|前两项 —；superTypes `Nil`|fields 发射；superTypes 参与依赖，但模板最终忽略其 extendsClause|formal payload 参数在另一 renderer 中|
|CommandReplyModel 1–3|`name: String`, `fields: Seq[FieldDef]`, `superTypes: Seq[TypeRef]`|前两项 —；superTypes `Nil`|回复 case class 及实际 extends 列表|formal 无同构数据|
|StateModel 1–3|`name: String`, `fields: Seq[FieldDef]`, `selfType: TypeRef`|都 —|inline 分支仅使用 name/fields；selfType 不消费|非本主链输出，不能填造 State body|

[共享模型完整文件:40–54](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/AggregateRootModel.scala#L40-L54) 中其余 `AggregateRootModel`、`ShardingModel`、`StepsFactoryModel`、`ParticipantInstantiation`、`SagaStepModel` 属别族；已经读取整个文件，但它们不因共处文件而变成本 Protocol 的构造字段。`StateModel` 的真实定义见 [DomainEntityModel.scala:44](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/domain/DomainEntityModel.scala#L44)。

### 2.2 传递支撑的精确合同

[TypeSystem.scala:4–85](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4-L85)：

- `TypeRef(name: String, packageName: String, typeParams: Seq[TypeRef] = Nil)`。`fqn` 在包为空时等于 name，否则 `packageName + "." + name`。
- `signature`：name 以 `Tuple` 开始、其余字符全部是数字且 typeParams 非空时输出 `(T1, T2, ...)`；否则非空参数输出 `Name[T1, T2, ...]`；否则 name。递归使用子项 signature，不渲染 FQN。
- `collectAllDependencies = Set(this) ++ typeParams.flatMap(_.collectAllDependencies)`。`shouldImport(pkg)` 排除空包、当前包、`scala`、`java.lang`，其余 true；**不识别当前 object 的嵌套 self import，也不解决同名冲突**。
- `FieldDef` 全字段依次为 `name: String`, `typeRef: TypeRef`, `defaultValue: Option[String]=None`, `comment: Option[String]=None`, `noteId: Option[String]=None`, `description: String=""`。`defaultValue` 是明确的 Scala 源码字符串槽，不能宣称 raw 无代码字符串。协议 T 消费 name/type/default/noteId/description，不发射 comment。
- [ArtifactModel.scala:5–47](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L5-L47)：抽象 selfType/dependencies；`fqn = selfType.packageName + "." + selfType.name`；`registerTo(registry)=registry.register(this)`；`morphisms=Nil`；`noteIds=Nil`。本 Protocol 不覆写 registerTo，也没有自动注册全部 nested command/reply 的实现。
- `[CborSerializable]` 的来源是 `ctx.knownFrameworkTypes`，不是在 Template 里补 import；[GeneratorContext.scala:61–89](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L61-L89)、[FrameworkTypes:264–275](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L264-L275) 给出 `<frameworkPackage>.common.CborSerializable` 和 `akka.actor.typed.ActorRef`。

## 3. Builder：全部规则、分支与推导顺序

完整原文在附录 B；这里按执行顺序给出与 JS 的落差。

|ID / 固定行|输入 → 精确推导 / 分支 / 输出|处理结论|
|---|---|---|
|B01 / 18–20|pkg=`ctx.layout.application.aggregates.root`；name=`getBaseName(meta.name)+"Protocol"`；selfType=`TypeRef(name,pkg)`|用共享 layout/naming，不从银行当前 legacy 包反推|
|B02 / 25–35|**先** map `meta.replyFamily.replies`；r.name 原样；每 r.parameters 只 `FieldDef(f.name,resolve(f.parameterType))`；superTypes 单元素 CborSerializable|回复顺序独立于命令顺序；不用“命令中首次见到的回复名集合”替代。raw 不透传 reply 字段 optional/default/noteId/description，是可观察限制|
|B03 / 38–41|`ctx.typeResolver.commandFamily(meta.commandFamily.name)`|解析嵌套 owner，不一定当前包顶层类型|
|B04 / 43–52|按 `meta.commandFamily.commands` 顺序；每 parameter：optional=true → `Option(resolve(parameterType))`，`defaultValue=Some("None")`；否则 resolve 原类型、无默认；两支都透传 noteId/description|无 readonly 过滤；已有 Option 再 optional 会再包一层，raw 无幂等消包逻辑|
|B05 / 55–62|replyToType.map：resolve replyRef → framework ActorRef.copy(typeParams=Seq(replyType)) → `FieldDef("replyTo", actorRefType)`|None 不追加；合成字段没有默认、知识 ID 或描述。raw 未检查原参数已有 replyTo 的重名|
|B06 / 64–69|`CommandModel(cmd.name, baseFields ++ replyToField, Seq(commandFamilyType))`|末参数 replyTo，不能改前面业务字段名/顺序|
|B07 / 71–77|family.name 来自 metadata；commands=B06；family.superTypes=Seq(CborSerializable)|不要强制所有聚合都叫 Command|
|B08 / 80–85|依次汇集 reply 字段递归类型依赖、reply superTypes、command 字段递归类型依赖、command superTypes、family superTypes|既要 ActorRef 也要内层 Reply/业务泛型依赖；superTypes 本身只平铺，不递归其泛型|
|B09 / 88–89|stateType=Some(entityState(meta.stateRef))；eventType=Some(eventFamily(meta.eventFamilyRef))|先解决类型再加入依赖；handler 总是可构造，除非 resolver 抛错|
|B10 / 91–95|B08.filter(_.shouldImport(pkg)).toSet，再 union stateType/eventType 各自 shouldImport 结果|state/event 只加自身，不递归泛型；Effect 不在此 deps 中，是模板 FQN 例外|
|B11 / 97–106|按 M 的 8 个位置构造：selfType、family、replies、**None**、stateType、eventType、dependencies、`noteIds=meta.noteId.toSeq`|明确抑制内联状态；无 I/O、无持久化、无 reply 行为|

解析依赖不能略为“resolve types”：

1. [NamingConventions.scala:180–224](../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L180-L224)：字段关键字仅加反引号；getBaseName 顺序剥除 Aggregate/Controller/Entity/DomainService/Service/Factory/Behavior/Behaviors/RepositoryImpl/Policy/Handler/Adapter/Converter/Strategy/Bootstrap/SagaTransactionRepository/SagaTransactor/SagaTransaction/Repository/Query/Participant/Participant/Event/State/Context，剥空时返回 lastNonEmpty。不等于通用 PascalCase resolver。
2. [TypeResolverDSL.scala:171–195](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L171-L195) 的 commandFamily(String) 查 symbolTable 和 metaRegistry：Aggregate owner → aggregateProtocol.fqn 下；SagaTransactor → sagaProtocol；DomainEntity → domain.entities.owner；QueryService → application.queries.owner；其他 owner → application.aggregates.owner；无 owner → application.aggregates 顶层。commandReply(String) 同类分支见 [585–609](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L585-L609)。
3. [TypeResolver.scala:19–90](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala#L19-L90)：原始 String/Int/Long/Boolean/Unit/Double/BigDecimal；各 typed Ref 分派；StructRef 有 owner 走 nested、否则 domain.values；CustomType 命中 framework 时采用 framework TypeRef、递归 typeArgs，未命中则仅将旧 `net.imadz.domain.values` 映射为当前 layout.values 再递归；剩余 MetaRef 调 `resolveMetaRef`，其 body **`???`**；剩余未知类型回落 `TypeRef("Any", "")`。目标不能靠复制 Any fallback 吞掉输入缺口。
4. EntityStateRef 最终经 [DSL:144–149](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L144-L149) 指向 Entity 内 nested State，保留 State 后缀。EventFamilyRef 走 [resolveNestedType:95–148](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala#L95-L148)：按 Aggregate/Saga/Entity/Query owner 分类；无 owner 回退 VO 包。Aggregate owner 的这条旧分支仍采用 Aggregate 而非 Protocol 名；必须用真实 owner 信息核验，不能依据类型短名修 import。
5. [DSL resolve overload:1115–1144](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L1115-L1144) 还有 `SagaContextRef => ???`。这是共享原始债，不意味着本传统普通协议一定触发该槽，也不准编造成功实现。

## 4. raw-scala Template：从文件顶部到底部的 construct / RHS 账

完整原文在附录 C；本表说明模板循环中的每类发射及所有可选分支。

|ID / T 行|输出构造、顺序与完整 RHS / body 规则|raw 与目标的边界|
|---|---|---|
|T01 / 18|`package model.selfType.packageName`|目标同三层 application.aggregates|
|T02 / 21–23|dependencies.toList.sortBy(_.fqn).map(_.fqn).distinct；交给 imports|[DSL:20–22](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L20-L22) 再排序，逐行 `import `；注释声称补 Cbor，但无补入代码|
|T03 / 25–31|`renderFields` 对每字段：escaped name + `: ` + recursive type.signature + defaultValue 有值时 ` = ` + **原始代码串**；以 `, ` 连接|所有 command/reply/inline state 共用；空 fields 输出空串；不是默认值求值器|
|T04 / 112–122|顶层一个 `object selfType.name`，没有父类型/父构造参数|ObjectDefinition defaults extends/implements=None；没有 class、self-type 或对象构造参数|
|T05 / 89–92、34–35|正文先 `// Commands`；`sealed trait family.name extends ` + family.superTypes.map(_.name).mkString(" with ")|用 name 非 signature；空 superTypes 留悬空 extends（Builder 正常提供 Cbor）；泛型 supertype 不保真是 raw 限制|
|T06 / 42–55|commands 原序；先 fieldDoc，再 `case class c.name(renderFields(c.fields)) extends family.name`；类体为空，非 final|`extendsClause` 计算了 `(c.superTypes :+ selfType.copy(name=family.name)).distinct.map(_.name)...`，**未被使用**。不得声称 raw 发射所有 command superTypes|
|T07 / 45|`KnowledgeAnchorDoc.fieldDoc(c.fields,"  ")`|仅有 noteId 的字段有 `@param escapedName[ description]  @knowledge annotatedId`；合成 replyTo 不发；没有概念级 object 文档，也不给 reply 发 fieldDoc|
|T08 / 94–95、58–62|`// Replies` 后，replies 原序：`case class r.name(renderFields(r.fields)) extends r.superTypes.map(_.name).mkString(" with ")`|非 final、无类体；不声明统一 sealed Reply trait；未被命令使用的回复也保留；空 parent 同样有悬空 extends|
|T09 / 65–86|state=None → `""`；Some → 下面完整内联块|普通主链 suppressed；目标 State/Events 应在 domain Entity，不开启这个技术槽|
|T10 / 98–108|stateType.zip(eventType) 成对才发：`// CommandHandler type alias (moved from Aggregate to break circular dependency)`；alias 名 `family.name.replace("Command","CommandHandler")`；RHS=`(st.name, family.name) => akka.persistence.typed.scaladsl.Effect[ev.name, st.name]`|String.replace 全部替换，不是 JS 首个 replace；使用短名丢弃泛型参数；若 family 名不含 Command，alias 与 trait 可撞名，不能静默猜新名|
|T11 / 118–124|`SourceFile(pkgDecl, importDecl, Seq(objectDef)).code`|[DSL:60–84](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L60-L84)：object 开闭大括号/换行，package/import/definition 以两换行连接，文件末换行；raw 的空 state 槽仍留下空白行|
|T12 / writer|writer 在 content 前加 `// @generated by CodegenMain:<version>`；knowledgeRelease 非 null 再加一行|[CQRS:94–113](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L94-L113)；fingerprint/ledger/territory 不是 Template 自身内容|

T09 的**全部发射构造**，不是可运行实现：

```scala
// --- Inline State & Events ---
sealed trait TransactionEvent extends CborSerializable

sealed trait Status extends CborSerializable
object Status { case object New extends Status; case object Initiated extends Status; case object Prepared extends Status; case object Completed extends Status; case class Failed(reason: String) extends Status }

// 下两处 StateName/字段列表是模板的 state.name/renderFields(state.fields) 槽标记，非业务实例。
case class StateName(/* renderFields(state.fields) */, status: Status = Status.New) extends CborSerializable {
  def applyEvent(event: TransactionEvent): StateName = ???
}
object StateName {
  def empty(id: String): StateName = StateName(id = Some(id))
}
```

这里 `???` 是**原始模板事实**；`StateName` 注释块只解释模板参数，完整原始插值见附录 C，不作为目标代码。状态列表空时 raw 仍拼 `, status`；原状态含 status 或无兼容 id/default 字段时也没有防护。`Status.New` 是唯一额外默认，`empty` 仅传 `id=Some(id)`，不逐字段初始化。目标不将这些默认扩散为任意聚合算法。

[KnowledgeAnchorDoc.scala:31–61](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/KnowledgeAnchorDoc.scala#L31-L61) 对 noteId 调 `CQRSApplicationGenerator.annotateKnowledge(Some(raw)).getOrElse(raw)`；hash 不存在时保留原 ID，有时追加原 hash，不凭注释硬截成 8 位。描述非空才前置空格；空参数行集合返回空串，否则 `/**`、各 ` * ` 行、` */`、尾换行组成**一个紧邻声明的块**。这是原基准锚形态，不授权增加作者 `@knowledge` 字段。

### 4.1 确认不存在的本模板构造（范围仅 T 文件）

本主链协议没有 `val/var/lazy/implicit` 成员，没有 annotation、可见性修饰、类型参数/上下界、主辅构造器方法、重载、柯里化/implicit 参数、初始化 I/O、JSON format、persist 或 reply 调用。case class 主参数及生成语言自身的 companion 不等于模板显式 companion；只有 T09 显式 State companion 和 Status object。不得把 Helper、Aggregate 或 legacy factory 的 body 算在本族成功实现里。

## 5. JS 当前实现：formal、legacy、family 三路分账

### 5.1 formal 银行路线确实调用什么

[generate-cli.mjs:92–101](../baseline/js/lib/products/generate-cli.mjs#L92-L101) 注册 shipped `scala-cqrs-play-service`、domain、aggregate-core 等具体目录，不接受仅凭目录名推测的任意 producer。银行绑定选择 play-service。

可达链如下（均为固定源内容，不是本轮执行轨迹）：

1. [play-service/generate.mjs:16–27,59–70](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L16-L70) 继承 `createEffectRegistry('2')`，仅覆盖 aggregate-dsl/invariant-dsl 等特定点。
2. [produce-effect:6–19](../baseline/js/generators/scala-cqrs-application/produce-effect.mjs#L6-L19) 继承 `applicationRegistry(version)`；[produce:17–29](../baseline/js/generators/scala-cqrs-application/produce.mjs#L17-L29) 的 `command-dsl` **直接使用 renderCommand**。所以 formal 不走 `generators/command-dsl/render.mjs` 中的旧 renderer。
3. aggregate-dsl 覆盖到 [renderAggregateLayers:20–29](../baseline/js/generators/scala-cqrs-play-service/render-aggregate-layers.mjs#L20-L29)：buildAggregateModels → 按 role 选择 Template → entry；额外调用 layered renderAggregate。
4. Protocol 来自 [build-aggregate-models:4–42](../baseline/js/generators/scala-cqrs-play-service/build-aggregate-models.mjs#L4-L42) 的 role=protocol；模板为 [protocolTemplate:19–39](../baseline/js/generators/scala-cqrs-play-service/templates/aggregate-protocol.mjs#L19-L39)。**同文件名叫 legacyTemplate 的函数也在这条 formal 路线上被 role=legacy 调用**，不能归为不可达退休代码。

### 5.2 formal Model / Builder 逐输入规则

- layout.declarations 中筛 aggregate；每个 aggregate 的命令按 `ref.context` 相同且 `ref.owner[0]===aggregate.ref.id` 筛选；external 来自 domain-dependencies.externalProducers，同 owner 条件。
- `names=aggregateNames(ref,options)`；`commandSources=[aggregate.source,...commands.source]`；共享结构 `{aggregate,names,authority: external.length>0}`。
- protocol 模型额外字段**全部**为 `{role:'protocol',carrierOwner:'legacy',aliases,artifact}`。aliases 顺序固定 `Execute,GetState,Accepted,Refused` 后接 external 的 ingress 名。
- `artifact={kind:'application-protocol',path:paths.protocol,sources:commandSources,dependencies:[paths.legacy,paths.entity]}`。没有 commands 的业务参数列表、replyFamily、optional/default、noteId、TypeRef、replyToType、commandFamily.superTypes；不能用 `carrierOwner` 充当这些信息。
- 同一 Builder 还返回 legacy/behavior/aggregate/factory/bootstrap/repository；行为 groups 是可选 external、query、execution。这里只改 protocol 逻辑，不删除其他 role 的来源/依赖。
- [aggregate-names:3–29](../baseline/js/generators/scala-cqrs-play-service/aggregate-names.mjs#L3-L29)：name=`symbol(ref.id)`，pkg=`packageFor(context,options)`，legacy FQN=`pkg.domain.<name>Aggregate`。protocol 是 application/aggregates，但 Factory/Repository 路径仍缺 BC 的子包；helpers 路径仍 domain。externalNames 将 `-` 换 `_`，ingress=`Ingest`+symbol(id)，method=id，identity=id+`_identity`，不能随协议拆分改变 producer 身份。

### 5.3 formal Template 发射账（包括复合文件另一职责）

|函数/构造位置|现行完整规则与 RHS|目标处置|
|---|---|---|
|protocolTemplate package/import/object|application.aggregates；按固定次序 import Effect、`domain.entities.<name>Entity.{Event, State}`；object=`names.protocol`|保留职责位置，但 imports 应来自完整模型依赖|
|4 个基础 alias|`Command=legacy.Request`；`Reply=legacy.Reply`；`CommandPayload=pkg.domain.<name>Protocol.Command`；`CommandHandler=(State,Command)=>Effect[Event,State]`|前 3 个 replace；alias RHS 不能永远指回错误 domain carrier。handler 与真 State/Event/commandFamily 对齐|
|aliases 循环|每个 id 依次 `type id=legacy.id`、`val id: legacy.id.type = legacy.id`|不是业务 Actor 命令定义；替换时完整移交其调用方，不只删类型留 val|
|authority 条件|最后 `type ExternalAuthority=legacy.ExternalAuthority`|与外部接入端口 owner 协调；不能默默丢授权合同|
|legacyTemplate 的 domain object|import `akka.actor.typed.{ActorRef,Behavior}`、`<name>Protocol._`；sealed Request；`Execute(command:Command,replyTo:ActorRef[Reply])`；`GetState(replyTo:ActorRef[<name>State])`；sealed Reply；`Accepted(events:Vector[Event])`；`Refused(code:String)`|这些在 formal 被调用；Request/Reply/业务 Actor command 迁 application，domain 参数不能为了迁移注入 ActorRef|
|external 循环|`final case class <ingress>(output:typeName(outputType), authorization:String, replyTo:ActorRef[Reply]) extends Request`|typed ingress/授权必须保留明确责任；不能抹为普通写命令或假成功|
|authority trait|仅 authority=true 时 `trait ExternalAuthority { def authorize(producer:String,authorization:String,identity:Vector[String]):Boolean }`|属于端口迁移依赖，不复制为银行私有 helper|
|legacy apply|`def apply(persistenceId:String,initial:<name>State,hosts:<name>Computations[,authority:ExternalAuthority]):Behavior[Request] = pkg.infrastructure.bootstrap.<bootstrap>.create(persistenceId,initial,hosts[,authority])`|生命周期/装配属 aggregate/factory/bootstrap 包，Protocol 不承接 apply body|
|同物理文件的 Factory object|`def create(persistenceId,initial,hosts[,authority:<name>Aggregate.ExternalAuthority]):Behavior[<name>Aggregate.Request] = <name>Aggregate(persistenceId,initial,hosts[,authority])`|迁移归 aggregate-factory 组，不能由本族偷偷删除或改 PID|

### 5.4 domain `renderCommand` 的平铺协议和相邻输出

完整固定 [render-domain.mjs:1–56](../baseline/js/generators/scala-cqrs-domain/render-domain.mjs#L1-L56)：

- 每个 aggregate 同 owner 取 dependencies.commands/events；输出 `app/<pkg>/domain/<id>Protocol.scala`。
- package domain → object `<symbol(id)>Protocol` → `sealed trait Command` → `sealed trait Event` → commands 原序 `final case class <symbol(command.id)>(fields(declaredSignature)) extends Command` → events 原序 `final case class <symbol(event.id)>(fields(declaredSlots)) extends Event` → 关闭 object。
- `fields` 逐行用 `(r.ref ?? r.target).id` 经 symbol，类型用 typeName；不生成默认值/replyTo/确认族/CBOR/imports。
- [naming.mjs:15–31](../baseline/js/generators/scala-cqrs-domain/naming.mjs#L15-L31)：primitive string/boolean/integer/decimal → String/Boolean/Long/BigDecimal；nominal → 全 FQN domain.values；optional→Option，sequence→Vector，map→Map 递归。valuesPath 对 nominal/optional/sequence/map 递归收文件依赖；不是短名 import 解析。
- protocol entry 的 sources 顺序 aggregate、commands、events；类型文件依赖 Set 去重。`entry` 添加固定 domain generator header、sources 转 `source:<document>#<pointer>` knowledgeIds、productFootprint、merge:null；有 codeMappings 才换算 UTF-8 byte spans。当前 protocolTemplate 返回 string，因此其 renderAggregateLayers 路径没有成员 mappings。
- 同函数随后还发 Computations trait/object、`none`（仅无 hosts）、CommandHelpers 的 emit 方法，以及有 external 时的 ExternalEvents 构造/identity 方法；它们的 ownership 不能随抽走 protocol text 丢失。emit 的 RHS 是 `Vector(Event(slot valueExpression...),...)`，不是三方法 CommandHelper。原 rules/params 还用 domain Command（[render-domain:65–88](../baseline/js/generators/scala-cqrs-domain/render-domain.mjs#L65-L88)）；迁移时若仍把 Actor 命令当规则 param，领域就会反向依赖应用层。

### 5.5 legacy：近似传统结构确实存在，但不在 formal 接线上

[legacy generate:67–93](../baseline/js/generators/_deprecated/scala-cqrs-es/generate.mjs#L67-L93) 显式调用 `protocolModel(a,env)` → `renderProtocol` → emit。`generator.json` [2–35](../baseline/js/generators/_deprecated/scala-cqrs-es/generator.json#L2-L35) 声明 truthsrc/v0.3 及 protocol kind，没有 declaredProducts。公开 legacy `generate` 经 [bin:259–294](../baseline/js/bin/truthsrc.js#L259-L294) 到 [core plan:23–42](../baseline/js/src/core/generate.mjs#L23-L42)，按显式目录动态 import `generate.mjs`；这里只能说 loader 具备这一路调用形状，仍受 canonical/schema/manifest 门约束，未执行。formal `registeredProductProducer` 列表并未登记该 deprecated 路径。**不能仅凭 `_deprecated` 说不可调用，也不能凭 renderer 存在说银行已使用。**

本族完整函数及其所用前置 helper 均已实读 [models:17–102](../baseline/js/generators/_deprecated/scala-cqrs-es/builders/models.mjs#L17-L102)、[template:6–48](../baseline/js/generators/_deprecated/scala-cqrs-es/templates/scala.mjs#L6-L48)。

|阶段|实际规则、默认、分支|与 raw 差距|
|---|---|---|
|名字/包|baseOf=`${a.pkg ?? 'net.imadz'}.${a.ctxPackage ?? ''}.`；entity=`a.entity ?? name+'Entity'`；family=`a.commandFamily ?? name+'Command'`；handler=`family.replaceAll('Command','CommandHandler')`|ctxPackage 为空时这段字串有双点可能；不是 PackageLayout；Entity 名可定制但 State/Event 短名仍按 a.name|
|header/anchor|header 为 CodegenMain 版本，knowledgeRelease truthy 时加行；版本缺省生成日期；anchorRow 先 escape name，description 缺省空，noteId truthy 时加 env.anchor 后缀，否则 null|hash 来自 options.elementHashes，不是任意新 ID；不可将注释中的历史 byte-verified 当本轮事实|
|replyNameOf|c.reply 缺失或 `aggregate` → a.aggregateReply?.name，否则 c.name+Confirmation；string reply 直接用字符串；object reply 用 .name 或 fallback|**自行推断**回复，raw 只依 replyFamily/replyToType|
|commands|a.commands 缺省 []；c.name、extendsFamily；docRows=所有 parameters 的 anchorRow；参数 optional → Option[scalaSig] 并 default None；**无条件末追加 ActorRef[replyNameOf]**|不是 raw 的 conditional typed replyTo；可能重复已有 replyTo|
|replies|replyNames 遍历命令，首次名称去重；取第一个对应命令；字段取 aggregateReply.fields 或 c.reply.fields，缺省 `[{name:'error',type:'Option[iMadzError]'}]`|丢未使用但声明的回复；不能将默认错误字段当已批准业务合同|
|imports|command sig/typeImport、reply field type 经 typeDeps；强加 ActorRef、framework Cbor；self-qualified replies/family、Entity.nameEvent/nameState；renderImports(distinctFqn:true)|已有依赖整理可作移植素材，仍不是直接复制的充分条件|
|返回 Model 全字段|header/base/name/family/handlerAlias/imports/commands/replies|state/typeRef/dependencies/noteIds 的职责不齐，imports 已是文本|
|Template|paramDoc 只发 anchor truthy 行；Commands trait、命令原序；Replies 原序且固定 extends Cbor；Handler RHS 为 `(nameState,family)=>akka.persistence...Effect[nameEvent,nameState]`；无 inline state 分支|接近 raw 布局，但 reply 字段名未 escape、回复无默认输出；不能直接作为 formal 修复|
|writer 路由|emit 的 protocol→`modules/kernel/src/main/scala/<pkg>/application/aggregates/<name>Protocol.scala`；schemaCategory=aggregate、families=[a.name]、deps=[a.name,a.name+'Entity']|只是一条 legacy 路由，不是当前银行 single 输出|

### 5.6 family2：有独立 ActorProtocol，但还是 Execute 外壳

`generate-products` 注册 [aggregate-core](../baseline/js/lib/products/generate-cli.mjs#L94-L101)；[generate.mjs:11–23](../baseline/js/generators/scala-cqrs-aggregate-core-v1/generate.mjs#L11-L23) 要求 profile `scala-cqrs-aggregate-core@1`，消费固定 7 products（layout/exact types/decision/dependencies/folds/external events/codecs），经 buildModels → render。它是另一显式选择，不是 play-service 的 fallback。

[build-models.mjs](../baseline/js/generators/scala-cqrs-aggregate-core-v1/build-models.mjs#L1-L248) 已全文读取；本族相关行为如下：

- 先 targetData、严格 options keys=`packages,names,protobuf`；新 role name override 校验 kind、重复/unused；其余 name 交原 family1 buildKernelModels，只建一次、不改 base FQN/fields。
- external product 必须与 dependencies.externalProducers 相等，且非空就拒绝（73–74）；不能直接承接 formal external ingress。
- artifactsSpec 的 actorProtocol 为 role/kind `actor-protocol`，subpackage=`application.aggregates`，suffix=`ActorProtocol`，module=`glue`（22）。reserve Command/Reply/Execute/GetState/Accepted/Rejected 以及 standard names，resolveNameSet 后 resolveArtifactPath。
- artifact 的完整字段：ref/role/kind/module/name/identifier/package/fqn/path/sources/refs/directDeps；actorProtocol 的 deps 最终是 base.protocol/base.state；sources/refs 由 setDeps 以 base.source/base.ref 起始（221–229）。
- 中部 guard/emission/fold 构造会核 type/ref/sourceOrdinal/依赖与事件生产关系（139–218），这些是该 producer 准入闭包而非协议回复决策，未从中推导 per-command Reply。
- 末尾拒绝无本地生产者事件、portable 输出碰撞、不存在/self dep、kernel→glue dep（237–246）；返回 `{profile,kernel,serialization,aggregates,artifacts}`。目标迁层不能通过删除这些门使其看似可用。
- [render.productionJobs:15–24](../baseline/js/generators/scala-cqrs-aggregate-core-v1/render.mjs#L15-L24) 明确调用 actorProtocolTemplate；不是凭模板路径判断可达。

[actor-protocol.mjs:3–12](../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/actor-protocol.mjs#L3-L12) 的全部输出：package → importsFor 的 ActorRef、base.protocol、base.state → object → `sealed trait Command` → `final case class Execute(command:<protocol>.Command,replyTo:<ref>[Reply]) extends Command` → `final case class GetState(replyTo:<ref>[<state>]) extends Command` → `sealed trait Reply` → `Accepted(events:Vector[<protocol>.Event]) extends Reply` → `Rejected(code:String) extends Reply` → 关闭。**没有 per-command typed replyTo、CborSerializable、CommandHandler alias 或三方法 Helper。**

[importsFor:3–25](../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/imports.mjs#L3-L25) 对冲突名字返回 `_root_.FQN`，否则短名；同组多符号同包用花括号 import，保留组输入顺序；当前 package 内出现根名遮蔽时 import 加 `_root_.`。这是可复用机制候选，不等于 raw 的按 FQN 排序，也不能给普通域参数注入 ActorRef。

## 6. actual-js：银行已有完整协议内容及逐成员归属

### 6.1 application 文件（完整，未改）

```scala
// @generated by truthsrc scala-cqrs-domain:1
package example.bankwealth.application.aggregates

import akka.persistence.typed.scaladsl.Effect
import example.bankwealth.domain.entities.CreditBalanceEntity.{Event, State}

object CreditBalanceProtocol {

  type Command = example.bankwealth.domain.CreditBalanceAggregate.Request
  type Reply = example.bankwealth.domain.CreditBalanceAggregate.Reply
  type CommandPayload = example.bankwealth.domain.CreditBalanceProtocol.Command
  type CommandHandler = (State, Command) => Effect[Event, State]

  type Execute = example.bankwealth.domain.CreditBalanceAggregate.Execute
  val Execute: example.bankwealth.domain.CreditBalanceAggregate.Execute.type =
    example.bankwealth.domain.CreditBalanceAggregate.Execute

  type GetState = example.bankwealth.domain.CreditBalanceAggregate.GetState
  val GetState: example.bankwealth.domain.CreditBalanceAggregate.GetState.type =
    example.bankwealth.domain.CreditBalanceAggregate.GetState

  type Accepted = example.bankwealth.domain.CreditBalanceAggregate.Accepted
  val Accepted: example.bankwealth.domain.CreditBalanceAggregate.Accepted.type =
    example.bankwealth.domain.CreditBalanceAggregate.Accepted

  type Refused = example.bankwealth.domain.CreditBalanceAggregate.Refused
  val Refused: example.bankwealth.domain.CreditBalanceAggregate.Refused.type =
    example.bankwealth.domain.CreditBalanceAggregate.Refused
}

```

四对 type/val 的 RHS 全是对应 legacy 成员/companion，没有业务 body；CommandHandler 是唯一与目标职责近似的实际 alias。该文件本身没有 ActorRef import 不等于整个现系统没有回复通道：formal legacyTemplate 的 Execute/GetState 已有不同 typed 通道，缺的是**每业务命令**的合同。

### 6.2 domain 文件（完整，未改）

```scala
// @generated by truthsrc scala-cqrs-domain:1
package example.bankwealth.domain

object CreditBalanceProtocol {
  sealed trait Command
  sealed trait Event
  final case class InitializeAccount(resource: example.bankwealth.domain.values.AccountId, currency: String, amount: example.bankwealth.domain.values.Money) extends Command
  final case class ReserveFunds(txid: example.bankwealth.domain.values.TxId, resource: example.bankwealth.domain.values.AccountId, amount: example.bankwealth.domain.values.Money) extends Command
  final case class DeductFunds(txid: example.bankwealth.domain.values.TxId, resource: example.bankwealth.domain.values.AccountId, amount: example.bankwealth.domain.values.Money) extends Command
  final case class ReleaseReservedFunds(txid: example.bankwealth.domain.values.TxId, resource: example.bankwealth.domain.values.AccountId, amount: example.bankwealth.domain.values.Money) extends Command
  final case class RecordIncomingCredits(txid: example.bankwealth.domain.values.TxId, resource: example.bankwealth.domain.values.AccountId, amount: example.bankwealth.domain.values.Money) extends Command
  final case class CommitIncomingCredits(txid: example.bankwealth.domain.values.TxId, resource: example.bankwealth.domain.values.AccountId, amount: example.bankwealth.domain.values.Money) extends Command
  final case class CancelIncomingCredit(txid: example.bankwealth.domain.values.TxId, resource: example.bankwealth.domain.values.AccountId, amount: example.bankwealth.domain.values.Money) extends Command
  final case class AccountInitialized(resource: example.bankwealth.domain.values.AccountId, currency: String, amount: example.bankwealth.domain.values.Money) extends Event
  final case class ReserveFundsConfirmed(txid: example.bankwealth.domain.values.TxId, resource: example.bankwealth.domain.values.AccountId, amount: example.bankwealth.domain.values.Money, currency: String, available: example.bankwealth.domain.values.Money) extends Event
  final case class DeductFundsConfirmed(txid: example.bankwealth.domain.values.TxId, resource: example.bankwealth.domain.values.AccountId, amount: example.bankwealth.domain.values.Money) extends Event
  final case class ReleaseReservedFundsConfirmed(txid: example.bankwealth.domain.values.TxId, resource: example.bankwealth.domain.values.AccountId, amount: example.bankwealth.domain.values.Money, currency: String, available: example.bankwealth.domain.values.Money) extends Event
  final case class RecordIncomingCreditsConfirmed(txid: example.bankwealth.domain.values.TxId, resource: example.bankwealth.domain.values.AccountId, amount: example.bankwealth.domain.values.Money) extends Event
  final case class CommitIncomingCreditsConfirmed(txid: example.bankwealth.domain.values.TxId, resource: example.bankwealth.domain.values.AccountId, amount: example.bankwealth.domain.values.Money, currency: String, available: example.bankwealth.domain.values.Money) extends Event
  final case class CancelIncomingCreditConfirmed(txid: example.bankwealth.domain.values.TxId, resource: example.bankwealth.domain.values.AccountId, amount: example.bankwealth.domain.values.Money) extends Event
}

```

逐成员迁移责任（不能以相似名字合并名义类型）：

|实际行/构造|完整字段规则|目标 owner / 未决|
|---|---|---|
|5 / Command trait|无 parent|Actor 命令 family 归本族；纯 param 归 invariant/command-helper 接口，不把该 trait 连 ActorRef 一起搬回 domain|
|7 / InitializeAccount|resource:AccountId, currency:String, amount:Money|应用命令同业务字段和原序；Reply 类型/数据是 AP-D1，不将其猜成 AddInitial|
|8–13 / 其余六命令|每条依次 txid:TxId, resource:AccountId, amount:Money|各自 Actor 命令；不能替换为人工参考的 transferId:Id 或删除 amount/resource；各自 replyTo 待合同|
|6、14 / Event、AccountInitialized|trait 无 parent；event 字段 resource/currency/amount|domain-entity 组；不加 ActorRef，不合并 Reply|
|15、17、19 / ReserveFundsConfirmed、ReleaseReservedFundsConfirmed、CommitIncomingCreditsConfirmed|txid/resource/amount/currency/available|domain-entity；顺序、类型、构造 RHS 在引用方保持；available 不当作通用 Reply balance|
|16、18、20 / DeductFundsConfirmed、RecordIncomingCreditsConfirmed、CancelIncomingCreditConfirmed|txid/resource/amount|domain-entity；名义 Event 身份保留|

目标需要分别替换 application facade、拆分 domain Command/Event 混合文件，并迁规则参数引用。仅在 application 加几条 `type` alias 不能完成迁移；仅在 domain case class 上加 replyTo 会破坏内层依赖。

## 7. curated-reference 与 approved-target 分开

### 7.1 人工参考的精确成员账

[固定人工文件](../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L1-L40) 是 `net.imadz` 的 CreditBalance，而 actual-js 是 `example.bankwealth` 的银行模型；两者同名，不同输入。

- package=net.imadz.application.aggregates；imports 顺序 ActorRef、Effect、CborSerializable、CommonTypes.{Id,iMadzError}、Entity.{CreditBalanceEvent,CreditBalanceState}、Money；object=CreditBalanceProtocol。
- Commands 注释、CreditBalanceCommand extends CborSerializable；10 条命令按以下顺序。**最后一个字段**都为 ActorRef[表内回复]，前面字段无默认：AddInitial(initial:Money)→CreditBalanceConfirmation；Deposit(change:Money)→同；Withdraw(change:Money)→同；GetBalance()→同；ReserveFunds(transferId:Id,amount:Money)→FundsReservationConfirmation；DeductFunds(transferId:Id)→FundsDeductionConfirmation；ReleaseReservedFunds(transferId:Id)→FundsReleaseConfirmation；RecordIncomingCredits(transferId:Id,amount:Money)→RecordIncomingCreditsConfirmation；CommitIncomingCredits(transferId:Id)→CommitIncomingCreditsConfirmation；CancelIncomingCredit(transferId:Id)→CancelIncomingCreditConfirmation。
- Replies 注释；8 条独立 case class 均 extends CborSerializable：CreditBalanceConfirmation(error:Option[iMadzError],balances:List[Money])；其余 7 个按 FundsReservationConfirmation、FundsDeductionConfirmation、FundsReleaseConfirmation、RecordIncomingCreditsConfirmation、CommitIncomingCreditsConfirmation、CancelIncomingCreditConfirmation、TransferConfirmation 顺序，字段均 `(transferId:Id,error:Option[iMadzError])`。TransferConfirmation 虽没有上述命令直接使用，仍保留。
- Handler Type Definition 注释；`CreditBalanceCommandHandler = (CreditBalanceState,CreditBalanceCommand) => Effect[CreditBalanceEvent,CreditBalanceState]`。无方法 body、字段 initializer、实现算法；没有把 Event/State 放进应用 Protocol。

### 7.2 actual-js → 参考结构的真实统一 diff

下面的 minus/plus 由**两份已冻结源文件**计算，保留上下文；plus 是用户点名参考的 Scala 结构，不是本轮生成或同输入银行目标。它清楚展示目标结构方向，但**不能直接应用到银行**：包和 AddInitial/InitializeAccount、transferId/txid 等差异正说明 AP-D1 必须独立裁定。长行是人工原文，approved-target 的长参数折行规则在下一节，不把这个 diff 当最终格式通过证据。

```diff
--- actual-js/app/example/bankwealth/application/aggregates/CreditBalanceProtocol.scala
+++ curated-reference/app/net/imadz/application/aggregates/CreditBalanceProtocol.scala
@@ -1,29 +1,40 @@
-// @generated by truthsrc scala-cqrs-domain:1
-package example.bankwealth.application.aggregates
+package net.imadz.application.aggregates
 
+import akka.actor.typed.ActorRef
 import akka.persistence.typed.scaladsl.Effect
-import example.bankwealth.domain.entities.CreditBalanceEntity.{Event, State}
+import net.imadz.common.CborSerializable
+import net.imadz.common.CommonTypes.{Id, iMadzError}
+import net.imadz.domain.entities.CreditBalanceEntity.{CreditBalanceEvent, CreditBalanceState}
+import net.imadz.domain.values.Money
 
 object CreditBalanceProtocol {
 
-  type Command = example.bankwealth.domain.CreditBalanceAggregate.Request
-  type Reply = example.bankwealth.domain.CreditBalanceAggregate.Reply
-  type CommandPayload = example.bankwealth.domain.CreditBalanceProtocol.Command
-  type CommandHandler = (State, Command) => Effect[Event, State]
+  // --- Commands ---
+  sealed trait CreditBalanceCommand extends CborSerializable
 
-  type Execute = example.bankwealth.domain.CreditBalanceAggregate.Execute
-  val Execute: example.bankwealth.domain.CreditBalanceAggregate.Execute.type =
-    example.bankwealth.domain.CreditBalanceAggregate.Execute
+  case class AddInitial(initial: Money, replyTo: ActorRef[CreditBalanceConfirmation]) extends CreditBalanceCommand
+  case class Deposit(change: Money, replyTo: ActorRef[CreditBalanceConfirmation]) extends CreditBalanceCommand
+  case class Withdraw(change: Money, replyTo: ActorRef[CreditBalanceConfirmation]) extends CreditBalanceCommand
+  case class GetBalance(replyTo: ActorRef[CreditBalanceConfirmation]) extends CreditBalanceCommand
 
-  type GetState = example.bankwealth.domain.CreditBalanceAggregate.GetState
-  val GetState: example.bankwealth.domain.CreditBalanceAggregate.GetState.type =
-    example.bankwealth.domain.CreditBalanceAggregate.GetState
+  case class ReserveFunds(transferId: Id, amount: Money, replyTo: ActorRef[FundsReservationConfirmation]) extends CreditBalanceCommand
+  case class DeductFunds(transferId: Id, replyTo: ActorRef[FundsDeductionConfirmation]) extends CreditBalanceCommand
+  case class ReleaseReservedFunds(transferId: Id, replyTo: ActorRef[FundsReleaseConfirmation]) extends CreditBalanceCommand
 
-  type Accepted = example.bankwealth.domain.CreditBalanceAggregate.Accepted
-  val Accepted: example.bankwealth.domain.CreditBalanceAggregate.Accepted.type =
-    example.bankwealth.domain.CreditBalanceAggregate.Accepted
+  case class RecordIncomingCredits(transferId: Id, amount: Money, replyTo: ActorRef[RecordIncomingCreditsConfirmation]) extends CreditBalanceCommand
+  case class CommitIncomingCredits(transferId: Id, replyTo: ActorRef[CommitIncomingCreditsConfirmation]) extends CreditBalanceCommand
+  case class CancelIncomingCredit(transferId: Id, replyTo: ActorRef[CancelIncomingCreditConfirmation]) extends CreditBalanceCommand
 
-  type Refused = example.bankwealth.domain.CreditBalanceAggregate.Refused
-  val Refused: example.bankwealth.domain.CreditBalanceAggregate.Refused.type =
-    example.bankwealth.domain.CreditBalanceAggregate.Refused
-}
+  // --- Replies ---
+  case class CreditBalanceConfirmation(error: Option[iMadzError], balances: List[Money]) extends CborSerializable
+  case class FundsReservationConfirmation(transferId: Id, error: Option[iMadzError]) extends CborSerializable
+  case class FundsDeductionConfirmation(transferId: Id, error: Option[iMadzError]) extends CborSerializable
+  case class FundsReleaseConfirmation(transferId: Id, error: Option[iMadzError]) extends CborSerializable
+  case class RecordIncomingCreditsConfirmation(transferId: Id, error: Option[iMadzError]) extends CborSerializable
+  case class CommitIncomingCreditsConfirmation(transferId: Id, error: Option[iMadzError]) extends CborSerializable
+  case class CancelIncomingCreditConfirmation(transferId: Id, error: Option[iMadzError]) extends CborSerializable
+  case class TransferConfirmation(transferId: Id, error: Option[iMadzError]) extends CborSerializable
+
+  // --- Handler Type Definition ---
+  type CreditBalanceCommandHandler = (CreditBalanceState, CreditBalanceCommand) => Effect[CreditBalanceEvent, CreditBalanceState]
+}
```

### 7.3 approved-target：完整参考切片目标代码

以下是**文档中的目标示例**，不是新生成文件。业务字段全部取上述人工参考，不声称银行已有这些合同；其余聚合由第 2–4 节模型/循环规则生成，不硬编码余额回复。完整文件路径（single profile）为 `app/net/imadz/application/aggregates/CreditBalanceProtocol.scala`。header 由最终 writer 加入，示例不伪造 generatorVersion/hash。

```scala
package net.imadz.application.aggregates

import akka.actor.typed.ActorRef
import akka.persistence.typed.scaladsl.Effect
import net.imadz.common.CborSerializable
import net.imadz.common.CommonTypes.{Id, iMadzError}
import net.imadz.domain.entities.CreditBalanceEntity.{CreditBalanceEvent, CreditBalanceState}
import net.imadz.domain.values.Money

object CreditBalanceProtocol {
  // Commands
  sealed trait CreditBalanceCommand extends CborSerializable

  case class AddInitial(
      initial: Money,
      replyTo: ActorRef[CreditBalanceConfirmation]
  ) extends CreditBalanceCommand

  case class Deposit(
      change: Money,
      replyTo: ActorRef[CreditBalanceConfirmation]
  ) extends CreditBalanceCommand

  case class Withdraw(
      change: Money,
      replyTo: ActorRef[CreditBalanceConfirmation]
  ) extends CreditBalanceCommand

  case class GetBalance(
      replyTo: ActorRef[CreditBalanceConfirmation]
  ) extends CreditBalanceCommand

  case class ReserveFunds(
      transferId: Id,
      amount: Money,
      replyTo: ActorRef[FundsReservationConfirmation]
  ) extends CreditBalanceCommand

  case class DeductFunds(
      transferId: Id,
      replyTo: ActorRef[FundsDeductionConfirmation]
  ) extends CreditBalanceCommand

  case class ReleaseReservedFunds(
      transferId: Id,
      replyTo: ActorRef[FundsReleaseConfirmation]
  ) extends CreditBalanceCommand

  case class RecordIncomingCredits(
      transferId: Id,
      amount: Money,
      replyTo: ActorRef[RecordIncomingCreditsConfirmation]
  ) extends CreditBalanceCommand

  case class CommitIncomingCredits(
      transferId: Id,
      replyTo: ActorRef[CommitIncomingCreditsConfirmation]
  ) extends CreditBalanceCommand

  case class CancelIncomingCredit(
      transferId: Id,
      replyTo: ActorRef[CancelIncomingCreditConfirmation]
  ) extends CreditBalanceCommand

  // Replies
  case class CreditBalanceConfirmation(
      error: Option[iMadzError],
      balances: List[Money]
  ) extends CborSerializable

  case class FundsReservationConfirmation(
      transferId: Id,
      error: Option[iMadzError]
  ) extends CborSerializable

  case class FundsDeductionConfirmation(
      transferId: Id,
      error: Option[iMadzError]
  ) extends CborSerializable

  case class FundsReleaseConfirmation(
      transferId: Id,
      error: Option[iMadzError]
  ) extends CborSerializable

  case class RecordIncomingCreditsConfirmation(
      transferId: Id,
      error: Option[iMadzError]
  ) extends CborSerializable

  case class CommitIncomingCreditsConfirmation(
      transferId: Id,
      error: Option[iMadzError]
  ) extends CborSerializable

  case class CancelIncomingCreditConfirmation(
      transferId: Id,
      error: Option[iMadzError]
  ) extends CborSerializable

  case class TransferConfirmation(
      transferId: Id,
      error: Option[iMadzError]
  ) extends CborSerializable

  // CommandHandler type alias (moved from Aggregate to break circular dependency)
  type CreditBalanceCommandHandler =
    (CreditBalanceState, CreditBalanceCommand) => Effect[CreditBalanceEvent, CreditBalanceState]
}
```

目标没有主动增加 sealed Reply 总族，因为 raw 和人工参考都没有；每命令用其声明的具体 confirmation。是否需要一个额外总族是 AP-D1/API 决定，不通过 `Any` 或所有回复同一个 Record 糊过去。

### 7.4 raw-scala → approved-target 的有限偏差账

|项|raw|目标 / 授权边界|
|---|---|---|
|业务分层|本普通 Builder 已在 application.aggregates；T 有不启用的 inline State/Event 分支|普通目标继续引用 domain Entity；不把 suppressed 分支当必须复制的业务状态实现|
|import|全 FQN 排序、可能 self import；Effect 在 alias RHS 用 FQN|用户要求正常 imports、依赖建模；无冲突时 Effect 用 import/简名，移除仅为自身 nested type 引入的冗余 import须基于 owner；同名冲突用 alias/有限 FQN，由 shared resolver 定稿|
|排版|单行 case class；空可选块留下多空行|保留声明顺序、字段顺序、默认和 RHS，长字段列表逐行；分段 Commands/Replies/Handler；不依赖生成后 regex 格式化|
|conditional replyTo|只有 replyToType 非空追加|保持；Actor 业务输入必须明确回复合同，缺失不得 fallback Accepted；只读命令协议照发，不要求写命令 Helper|
|Reply 字段和 parent|raw 忽略 reply optional 等；command superTypes 未使用，parent 用 name|本文不自行修正为“更好的 raw”；超出现有代表切片的这些输入见 AP-D3，必须显式接受保真限制或批准变更|
|命名|原 metadata 名称；handler 全量 replace|统一 Pascal/lowerCamel 与冲突拒绝，不以更名修改 PB/PID/名义类型。无 Command 子串等 alias 边界见 AP-D4|
|header/anchor|raw CodegenMain 头、可选 release；字段文档按已有 noteId|JS producer 头不能假装 CodegenMain；头差异精确单列，内容/知识身份不 normalize 掉；没有字段来源则不造锚|
|源码债|FieldDef.defaultValue String；inline applyEvent=???；resolver fallback/???|保留为显式槽/不适用项；本普通协议无 MANUAL 区，不能新造空成功 body|

## 8. 胶水、接口和副作用合同

### 8.1 协议直接依赖

|完整符号|来源 / 已观察坐标|本族用途与限制|
|---|---|---|
|`akka.actor.typed.ActorRef[Reply]`|`com.typesafe.akka:akka-actor-typed_2.13:2.6.20`，BC [scaffold/build.sbt:10–18](../baseline/bc/scaffold/build.sbt#L10-L18)|应用命令的条件字段；本族不调用 send；不能泄漏到 domain param/event|
|`akka.persistence.typed.scaladsl.Effect[Event, State]`|`com.typesafe.akka:akka-persistence-typed_2.13:2.6.20`，[同文件:27–28](../baseline/bc/scaffold/build.sbt#L27-L28)|Handler alias 返回类型；Protocol 不决定 persist 顺序|
|`net.imadz.common.CborSerializable`|[common 固定 trait](../baseline/common/src/main/scala/net/imadz/common/CborSerializable.scala#L1-L5) 无成员；BC scaffold 声明 `net.imadz:common-core_2.13:0.2` [131](../baseline/bc/scaffold/build.sbt#L131)|command family/reply marker；源码存在不证明消费 JAR 的来源/绑定可用，不扩大 Jackson/serializer 范围|
|`net.imadz.common.CommonTypes.Id` / `iMadzError`|[CommonTypes.scala:7–17](../baseline/common/src/main/scala/net/imadz/common/CommonTypes.scala#L7-L17)：Id=UUID；iMadzError(code,message) extends Throwable with CborSerializable|人工切片的字段类型；不能把银行 TxId/AccountId alias 成 Id|
|`net.imadz.domain.entities.CreditBalanceEntity.CreditBalanceState` / `CreditBalanceEvent`、`net.imadz.domain.values.Money`|人工切片项目类型；domain-entity/value-object 组输出|须来自同一语义 fixture；银行实际 `State/Event` 短名与其不同，不能互换名称就宣称相同 ABI|

### 8.2 Protocol 与 Helper/Behavior 的连接不能缺体

[CommandHandlerReplyingBehavior.scala:16–75](../baseline/common/src/main/scala/net/imadz/common/application/CommandHandlerReplyingBehavior.scala#L16-L75) 的精确接口：

```scala
trait CommandHelper[Command, State, Param, Reply] {
  def toParam(state: State, command: Command): Param
  def createFailureReply(param: Param)(error: iMadzError): Reply
  def createSuccessReply(param: Param)(state: State): Reply
}
```

完整调用链为 `runReplyingPolicy(rule, helper)(state, command).replyWith(command.replyTo)`。rule 类型 `net.imadz.common.CommonTypes.InvariantRule[Event,State,Param]` 的 apply 返回 `Either[iMadzError,List[Event]]`，不是 JS 现行 `Either[String,Vector[Event]]`，需要明确错误、事件容器适配而非类型偷换。

- replyWith：**先** helper.toParam(state,command)；**再** rule(state,param).fold；失败 `Effect.reply(replyTo)(helper.createFailureReply(param)(error))`，没有 persist；成功 `Effect.persist(events).thenReply(replyTo)(helper.createSuccessReply(param))`，Akka 将事件应用后的新 state 传入成功工厂。
- replyWithAndPublish：成功 persist → thenRun 遍历 events 向 EventStream.Publish → thenReply；有额外发布，**不等于** replyWith。目标默认不能换成它，也不能用 `thenRun(_ => Accepted(events))` 冒充 thenReply。
- Helper 必须放 `application.aggregates.behaviors`，三个方法都存在。用户 Deposit 样本 [人工 Helper:35–42](../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L35-L42)：toParam=`command.change`；failure=`CreditBalanceConfirmation(Some(error),Nil)`；success=`CreditBalanceConfirmation(None,state.accountBalance.values.toList)`，成功用更新后的余额。这只属于该明确样本，不能给银行七条命令强加同一个余额回复。
- Scala [CommandHelperModel.scala:16–25](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/CommandHelperModel.scala#L16-L25) 自带 `toParamLogic/failureReplyLogic/successReplyLogic: String` 三个实现槽。这里不将它们改写成 fake Right/Accepted；不存在的业务算法、MANUAL 体由对应组单独列账。
- 本族只定义协议，失败不 persist、成功新 state、回复次数和不意外发布属于与 behavior/helper 联合验收的必需接口证据，不是假定协议排版完成即可证明。

formal CLI 目前只针对 application profile 明确检查本地 Saga/Monarch pins：[generate-cli:114–127](../baseline/js/lib/products/generate-cli.mjs#L114-L127)。它**不是** common-core 三方法 API 的已验证供应证据。common-core 版本、真实类路径中是否有重复 scaffold 定义、目标消费者使用哪份 CommandHandlerReplyingBehavior，均见 AP-D5；不得 publishLocal 或升级 runtime 洗绿。

## 9. 第二阶段拟实施写集合、唯一组装 owner 与退役顺序

本节只给未来工作范围，**本轮不写这些路径**。仓库根统一为 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc`；下面 JS 路径相对该根。不新增公共 CLI producer 名来规避现有 formal 路线。

|路径 / 逻辑面|动作与职责|唯一 owner / 冲突|
|---|---|---|
|`generators/scala-cqrs-application-protocol/model.mjs`（proposed）|显式 AggregateProtocol/CommandFamily/Command/Reply 结构及 FieldDef/TypeRef 引用；保留逐字段 source，不承载整份 content 字符串|application-protocol|
|`generators/scala-cqrs-application-protocol/build-model.mjs`（proposed）|按 B01–B11 从已裁定输入适配成 Model；resolve 依赖、conditional replyTo、原序、note/source；缺回复合同返回可定位诊断，不猜默认|application-protocol；依赖 AP-D1/D2 和 shared-types|
|`generators/scala-cqrs-application-protocol/template.mjs`（proposed）|按 T01–T12 的已批准覆盖发射、字段来源定位；本族目标文件唯一内容组装者|application-protocol；不能抢 domain Entity/Helper 发射|
|`generators/scala-cqrs-play-service/build-aggregate-models.mjs`|protocol role 改用新 Model；删除 carrierOwner=legacy 依赖，但其他 role 的 aggregate/authority/groups/source 不丢|集成者单独接线；与 aggregate-root/behavior/factory/repository 同文件冲突|
|`generators/scala-cqrs-play-service/templates/aggregate-protocol.mjs`|`protocolTemplate` replace/delegate；`legacyTemplate` split，将 Request/Reply 与 apply/Factory 分别交协议/aggregate-factory owner|**集成者**是现复合文件唯一编辑/拆分 owner；禁止两个包同时替换整文件|
|`generators/scala-cqrs-play-service/render-aggregate-layers.mjs`|接新渲染结果和 codeMappings，保留所有其他角色与 stateEntries|集成者负责物理 entries 的唯一装配，协议内容仍仅来自本族 Template|
|`generators/scala-cqrs-domain/render-domain.mjs`|split renderCommand 的业务参数/事件/Computations/emit/external bridge；事件移交 domain-entity，纯参数移交 invariant，三方法 Helper 另组|集成者先保输出切分；domain-entity/invariant-rule/command-helper 的共享冲突面|
|`generators/scala-cqrs-play-service/aggregate-names.mjs`、`generators/scala-cqrs-domain/naming.mjs`|适配统一名字/包/类型依赖/byte mapping，不各自复制 resolver|shared-layout-types owner，不由本族并发写|
|`generators/scala-cqrs-aggregate-core-v1/build-models.mjs`、`templates/actor-protocol.mjs`、`render.mjs`|family 接同语义模型的显式 adapter；保留 external 拒绝等独立约束，module 改动须 AP-D6；不得让 family 模板覆盖 formal 输出|family owner，经集成者单点接线；本族先给接口，不擅自修改整 family|
|`generators/_deprecated/scala-cqrs-es/builders/models.mjs`、`templates/scala.mjs`|作为语义/结构素材，默认保留退休路线；不直接复活、不新增 bank 调用|不进入本族实施写集合；若另批保兼容，由集成者另行批准|
|`generators/scala-cqrs-play-service/generate.mjs`、`generators/scala-cqrs-application/produce.mjs`、`lib/products/generate-cli.mjs`|核 registry/footprint/version 接线，避免 formal 仍走旧 command renderer；只改经批准必需部分|公共 registry/producer 配置由集成者唯一持有|
|`lib/scala-target/naming.mjs`、`lib/scala-target/model.mjs`、`src/core/generate.mjs`|共享 names/types/layout/writer 接口扩展及最终字节回锚；不是本族创建第二套公共库|shared owner；本族仅消费合同|

复用依据：[resolveName/resolveNameSet/resolveArtifactPath](../baseline/js/lib/scala-target/naming.mjs#L41-L118) 已有 knowledge/scope/space、stableIdentities 不许改名、明确 binding、重复 affix 拒绝、portable 碰撞。先与 BC 后缀规则核对，不声称直接换函数即可相同。importsFor 只是候选短名/冲突机制，TypeRef 的 signature/recursive deps 仍需共享接口补齐。

建议新模块接口（**proposed**，不是声称已有 API）：`buildAggregateProtocolModel(protocolInput, sharedContext)` 返回第 2 节全部字段及来源；`renderAggregateProtocol(model)` 返回 `{content, codeMappings}`。protocolInput 必须可表达 replyFamily（含未使用回复）、每命令 replyToType 的有/无、readonly、参数 optional/default/source、state/event owner；若 formal product 尚无这些槽，先 AP-D2 定版，不能从命令名、事件名或散文猜。

### 9.1 旧输出的处理不能只删文件

1. 建立旧 FQN/物理文件/成员 → 新位置列表，先固定协议输入，保留所有命令、事件、确认类型及来源身份。给每个 Protocol 一个唯一 assembly owner，不允许 domain producer 和 application producer 在同一路径 writer-wins。
2. 更新 application behavior、factory/repository/bootstrap、service/query/controller/host 的 Request/Execute/GetState/Accepted/Refused/ExternalAuthority 使用面；业务执行转直接 typed command 的调用方改造须与 aggregate-behavior 一起完成。
3. 规则参数须独立纯领域类型；CommandHelper 承接 command→param。Events/State 由 domain-entity 接收，adapter/converter/serializer 由其 owner 同步；不能因为移动 FQN 改 protobuf 字段号、wire 名、PID 或 serializer manifest/ID。
4. 不留永久错误 domain Aggregate/Protocol 转发壳。旧文件退役必须通过 owned 输出迁移计划，报告手写/KEEP/MANUAL 冲突；当前 writer 会保留部分旧行/文件，**不是自动删旧文件的迁移器**。
5. 原 sources/knowledgeIds/productFootprint/deps 一并迁移，最终格式确定后定位 UTF-8 spans，再计算 fingerprint/ledger/anchors。禁止沿用旧 offset；禁止新增作者 `@knowledge` 以掩盖映射缺口；原实际银行 `.truthsrc`/ledger/anchors 仍不在本轮编辑范围。

## 10. fixtures、精确 CLI 形状与后续验收

### 10.1 计划中的最小 fixture 集（本轮均未建立/执行）

统一 proposed 根：`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/application-protocol/`。这些是测试资产，不是第二业务真源。

|fixture|要固定的输入与完整输出断言|
|---|---|
|AP-F1 `credit-balance`|人工参考的 10 commands/8 replies、Id/Money/State/Event owner、GetBalance 只读；同语义适配 BC 与 JS；输出完整 Protocol、domain Entity/VO、必要 Helper/Behavior 依赖闭包，不把银行 input 当该 fixture|
|AP-F2 `reply-contract-edges`|显式无 replyTo、显式有 replyTo、0 业务参数、有 optional 参数 `Option[T]=None`、泛型 reply/参数、未使用但已声明回复、空 commands/replies；逐字段默认/序列/父类型检查|
|AP-F3 `names-and-imports`|字段 keyword、嵌套 owner、跨上下文同短名、已有技术后缀、portable 文件碰撞、family 名含两个 Command/不含 Command；保留稳定 ID，必要拒绝由 AP-D4 固定|
|AP-F4 `template-suppressed`|state None、state/event type 成对与单边缺失；inline Some 只核 raw 发射债，不宣称执行成功、不纳入普通目标启用|
|AP-F5 `bank-structural`|只捕获现有 7 命令及 7 事件原字段/顺序，补回复合同必须经 AP-D1；保留 AccountId/TxId/Money/PB/PID/serializer/overflow 身份；非同输入前不得给 bank parity 结论|
|AP-F6 `reply-behavior`|Deposit 失败不 persist；成功 fold 后余额进入 reply；只回一次；replyWith 不发布；replyWithAndPublish 单独断言；只读查询不生成写 Helper。使用已 pin common-core 接口，不 mock 成同名空 success|

每个 fixture 后续需四类文件账：`raw-scala` fresh 完整输出、`approved-target` 审定完整输出、`actual-js` fresh 完整输出、独立 curated-reference 指针。当前仅固定源和既有银行/人工文件可用，缺 fresh 字节不填占位文件冒充产物。

### 10.2 后续命令形状（仅记录，禁止在本轮运行）

formal 路线选 `scala-cqrs-play-service`，request 必须是经 AP-D2 审定且只含最小切片及该 profile 必需闭包的 files manifest；不是全量银行。现 CLI 没有 `--artifact application-protocol` flag，不能伪造。

```bash
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/application-protocol/credit-balance/request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-play-service \
  --out /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/.rounds/application-protocol-parity/js-new \
  --options-json /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/application-protocol/credit-balance/options.json \
  --plan
```

批准计划后实际生成使用**同四个显式参数，去掉 `--plan`**；第二次稳定生成改用另一个独占新 `--out .../js-repeat`。family2 对照明确将 `--generator` 改为 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-aggregate-core-v1`，配专用 options/request（其 external=0、modular、profile 限制独立），不是替代 formal 的结果。

- 参数依据 [generate-cli:66–88](../baseline/js/lib/products/generate-cli.mjs#L66-L88)：必须四个显式 flag，重复/未知/缺值拒绝；plan 会读 request 引用文件、options、generator manifest，内存编译 products/规划；formal application 检查本地 runtime repository 的 JAR/hash，play-service 检查 externalSourceRoots 真实存在且与 out 不相交。`--plan` 不调用 apply，不等于无读取或依赖检查。
- 实写调用 [applyEntries:246–267](../baseline/js/src/core/generate.mjs#L246-L267)：目标完整 entries（不限 Protocol，还包括该 profile 的相关 Scala/proto/config/build/test）→ mkdir/source 写 → byte 对照 → `truthsrc.ledger.json` → `anchors.json`。读取已有目标/ledger/anchors、处理 KEEP/MERGE/ownership；不是自动回滚事务。不要把新 out 当“只有一份 Scala 的副作用”。
- 该 `generate-products` 形状没有 graph 写回、publish、下载、sbt 或 runtime 子进程调用；它会调用内存 product 编译和 producer 规划。若未来改用 `generate-project` 捕获手写实现，必须另列其捕获、缓存/图/回执写面，不在本规格偷换命令。

BC 对照使用真实文件输入入口，避免默认 Examples/共享目标。以下在 `/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen` 仓库目录执行（**未执行**），fixture 两文件必须先经输入合同审定：

```bash
sbt \
  -Dcodegen.systemFile=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/application-protocol/credit-balance/bc-canonical.json \
  -Dcodegen.systemBindings=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/application-protocol/credit-balance/bc-bindings.json \
  -Dcodegen.targetDir=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/.rounds/application-protocol-parity/bc-new \
  -Dcodegen.multiProject=false \
  "runMain net.imadz.codegen.CodegenMain"
```

- 支持 flag 依据 [CodegenMain:62–80,169,192–201](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L62-L80)。systemFile/systemBindings 要成对且与 codegen.system 互斥；不传 semanticProductsFile，避免换成 products 模板路线。
- 输入限最小 fixture，但传统 generator 仍处理该 System 的各层和 scaffold，不是仅本族 writer。sbt 可写 BC 的 `target/`、`project/target/` 及依赖缓存，缺依赖可下载；CodegenMain 可复制 scaffold、写全部目标层及 ledger。明确另批授权和离线依赖检查，不用 `publishLocal`、BC 默认切流或原 bank target。
- JVM 编译/行为验证合并到 protocol/helper/behavior/entity 依赖闭包的批末一次窗口。**本阶段没有确定可运行的 AP-F6 测试 suite，因此不编造 `testOnly ...Spec` 命令。** owner 固定 suite/资源/耗时/停止点后才能执行；现 play-service 的生成配置还明确禁用 testOnly，不能照抄为支持命令（[generate:40–44](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L40-L44)）。

### 10.3 验收义务及当前状态

|检查|后续必须证明|当前|
|---|---|---|
|同输入完整文件集|path/package/import/declaration/字段顺序/default/RHS/body/注释分段，包含未使用 Reply 和条件抑制；允许差异仅逐项列 header 来源及本规格批准排版|未运行；无 fresh 同输入字节|
|construct/RHS|逐条对 B01–B11、T01–T12、current alias/ingress/Factory 分拆账；不是只看有多少类|源码内容规格，非执行覆盖|
|接口/行为|common-core 实际 artifact ABI、ActorRef 泛型、失败无 persist、成功新 state、回复一次、发布差异、参数无 ActorRef|未运行；AP-D5/AP-D7 阻断|
|身份保护|名义类型、字段顺序、PB 编号/类型、PID、serializer ID/manifest、addExact 等算术语义不因美化变化|仅约束；无编解码/恢复证据|
|质量|生成 JS 与 Scala 普通方法 CC 目标 ≤5，6–10逐方法说明，>10重构或逐方法批准；嵌套目标≤2；不能转 String/Any dispatcher 刷分|`not-measured`；未选测量工具/版本，不编分数|
|稳定性/回锚|两个独占目标同输入稳定；一个字段修改造成局部 diff；原知识 key 能查回最终位置；退役后无旧 owner 冲突|未运行|

初始调度预算：生成/内容比较 5 分钟、受影响 JVM/行为闭包 15 分钟，超时返回已有证据与原因；不是已测性能保证。不运行全量银行 workshop、全仓 CI、服务或数据库来替代这份内容账。

## 11. 具体未决项

- **AP-D1 / 回复业务合同**：银行 InitializeAccount、ReserveFunds、DeductFunds、ReleaseReservedFunds、RecordIncomingCredits、CommitIncomingCredits、CancelIncomingCredit 分别返回什么类型、哪些字段取原参数/错误/更新后状态？只读 GetState 保留原 State reply 还是独立 query reply？外部 ingress 的授权拒绝如何表示？不能从现 Accepted(Vector[Event])/Refused(String) 或人工 transferId:Id 猜答案。
- **AP-D2 / formal 输入接口**：由哪个已版本化产品/技术绑定显式承载 commandFamily、独立 replyFamily、replyToType（含明确无回复）、readonly、参数默认及 nested owner？BC 与 JS 最小 fixture 的同语义适配怎样不丢未使用 Reply/字段来源？本规格只提出适配所需槽，不发明已存在的 schema/CLI flag。
- **AP-D3 / raw 限制**：reply 字段 optional/default/noteId 在 B02 丢失；command superTypes 的 extendsClause 被 T 忽略；empty superTypes、泛型 parent、inline State 的 ???/status/id 假设怎样界定可接受输入或经批准改正？普通目标 inline suppressed 已明确，但异常输入不能声称完整支持。
- **AP-D4 / 名称与导入细节**：handler alias 全量 replace 对重复 Command/无 Command 的合同、同名跨 owner import、self nested import 的消除/别名，以及类型 signature 的泛型保留由 shared resolver 固定。未批准前不以重命名业务 ID、合并名义类型或放弃类型检查避冲突。
- **AP-D5 / 胶水供应**：目标实际消费哪一坐标/冻结字节的 common-core？是否与 scaffold 内同 FQN 定义重复？其 CommandHelper/runReplyingPolicy/thenReply 与本文固定 common 源 ABI 是否一致？源码或 Saga JAR pin 本身不是答案。
- **AP-D6 / 物理 profile 与 owner**：传统 protocol 的 multi=kernel、family2 actor-protocol 的 multi=glue 与银行 single=app 如何选择迁移 profile？哪个集成 owner 统一处理旧复合文件与所有调用方/来源 mapping？未定前不移动共享依赖或并发覆盖复合 renderer。
- **AP-D7 / 协议迁移兼容及验证入口**：事件/状态从 domain 平铺 Protocol 分离到 Entity 后，哪些 existing serializer/FQN/host/codec 引用需要显式兼容适配？允许更新源码身份与必须冻结的 PB/PID/manifest 边界、AP-F6 的实际 suite/资源须逐项确定；不可用广泛 serializer binding、旧 journal 或假 success 签收。

这些未决项只阻断本族对应实施/验收，不阻止本文独立保存，也不连带宣称其他族被阻断或完成。

## 附录 A. raw Scala Model 完整源码

来自上表 M，保留字段默认和原始注释。

```scala
package net.imadz.codegen.scaffolding.cqrs.model.application

import net.imadz.codegen.scaffolding.cqrs.model.domain.StateModel
import net.imadz.codegen.scaffolding.cqrs.{ArtifactModel, TypeRef}

case class AggregateProtocolModel(
    override val selfType: TypeRef,
    commandFamily: CommandFamilyModel,
    replies: Seq[CommandReplyModel],
    state: Option[StateModel] = None,
    stateType: Option[TypeRef] = None, // For CommandHandler type alias
    eventType: Option[TypeRef] = None, // For CommandHandler type alias
    override val dependencies: Set[TypeRef],
    /** S7（EP §二 G1）：聚合号——台账 artifacts[] 的文件级落点由此可查。 */
    override val noteIds: Seq[String] = Nil
) extends ArtifactModel
```

共享文件中的本族三个子模型（完整定义，原行 40–54）：

```scala
case class CommandFamilyModel(
    name: String,
    commands: Seq[CommandModel],
    superTypes: Seq[TypeRef] = Nil
)
case class CommandModel(
    name: String,
    fields: Seq[FieldDef],
    superTypes: Seq[TypeRef] = Nil
)
case class CommandReplyModel(
    name: String,
    fields: Seq[FieldDef],
    superTypes: Seq[TypeRef] = Nil
)
```

## 附录 B. raw Scala Builder 完整源码

```scala
package net.imadz.codegen.scaffolding.cqrs.builder.application

import net.imadz.codegen.scaffolding.cqrs.model.application._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.{FieldDef, GeneratorContext, TypeRef}
import net.imadz.meta._

object AggregateProtocolBuilder {

  def build(
      meta: AggregateRootMetadata,
      ctx: GeneratorContext
  ): AggregateProtocolModel = {
    // 1. Determine Package (Same as Aggregate Root for now, or use a specific protocol package if defined)
    // Using 'aggregates.root' to keep it close, or maybe 'aggregates.protocols' if we want separation.
    // Given the cycle issue, 'aggregates.root' is fine as long as they are different files.
    // But to be safe and clean, let's assume it lives alongside the Aggregate.
    val pkg = ctx.layout.application.aggregates.root
    val protocolName = s"${NamingConventions.getBaseName(meta.name)}Protocol"
    val selfType = TypeRef(protocolName, pkg)

    // 2. Process Replies (Moved from AggregateRootBuilder)
    // S1 聚合面（2026-09-27 用户裁决）：序列化不放 domain/application——Get<X>StateReply 的
    // OWrites 在 controller 层逐字段手写，此处不带 jsonFormat。
    val replies = meta.replyFamily.replies.map { r =>
      CommandReplyModel(
        name = r.name,
        fields = r.parameters.map(f =>
          FieldDef(f.name, ctx.typeResolver.resolve(f.parameterType))
        ),
        superTypes = Seq(
          ctx.knownFrameworkTypes("CborSerializable")
        )
      )
    }

    // 3. Process Commands (Moved from AggregateRootBuilder)
    val commandFamilyType =
      ctx.typeResolver.commandFamily(
        meta.commandFamily.name
      ) // This type will now be defined HERE

    val commands = meta.commandFamily.commands.map { cmd =>
      val baseFields = cmd.parameters.map(p =>
        if (p.optional)
          // Controller 三可选参根治批 2026-10-05：optional 参数 → Option[T] = None 直译
          //（真源语义保真·S0 scala-cli 复现通过；聚合状态零 optional 字段零涟漪）
          FieldDef(p.name, TypeRef.Option(ctx.typeResolver.resolve(p.parameterType)),
            defaultValue = Some("None"), noteId = p.noteId, description = p.description)
        else
          FieldDef(p.name, ctx.typeResolver.resolve(p.parameterType), noteId = p.noteId, description = p.description)
      )

      // ReplyTo Logic
      val replyToField = cmd.replyToType.map { replyRef =>
        val replyType = ctx.typeResolver.resolve(
          replyRef
        ) // Resolve generically, usually points to Reply in this file
        val actorRefType =
          ctx.knownFrameworkTypes("ActorRef").copy(typeParams = Seq(replyType))
        FieldDef("replyTo", actorRefType)
      }

      CommandModel(
        name = cmd.name,
        fields = baseFields ++ replyToField,
        superTypes = Seq(commandFamilyType)
      )
    }

    val commandFamily = CommandFamilyModel(
      name = meta.commandFamily.name,
      commands = commands,
      superTypes = Seq(
        ctx.knownFrameworkTypes("CborSerializable")
      )
    )

    // 4. Dependencies
    val deps =
      replies.flatMap(_.fields.flatMap(_.typeRef.collectAllDependencies)) ++
        replies.flatMap(_.superTypes) ++
        commands.flatMap(_.fields.flatMap(_.typeRef.collectAllDependencies)) ++
        commands.flatMap(_.superTypes) ++
        commandFamily.superTypes

    // State and Event types for CommandHandler type alias (must be before dependencies)
    val stateType = Some(ctx.typeResolver.entityState(meta.stateRef))
    val eventType = Some(ctx.typeResolver.eventFamily(meta.eventFamilyRef))

    val dependencies = deps.filter(_.shouldImport(pkg)).toSet ++
      stateType.toSet.filter(_.shouldImport(pkg)) ++
      eventType.toSet.filter(
        _.shouldImport(pkg)
      ) // Add State/Event types for CommandHandler imports

    AggregateProtocolModel(
      selfType,
      commandFamily,
      replies,
      None, // State
      stateType,
      eventType,
      dependencies,
      noteIds = meta.noteId.toSeq
    )
  }
}
```

## 附录 C. raw Scala Template 完整源码

重复 NamingConventions import、未使用 extendsClause、占位 body 都是原文事实；不是本规格建议新增的写法。

```scala
package net.imadz.codegen.scaffolding.cqrs.template.application

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.dsl.CodeGenerationDSL._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.FieldDef
import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.model.application.AggregateProtocolModel

import net.imadz.codegen.structure.NamingConventions
import net.imadz.codegen.scaffolding.cqrs.template.CodeTemplate
import net.imadz.codegen.scaffolding.cqrs.template.KnowledgeAnchorDoc

object AggregateProtocolTemplate extends CodeTemplate[AggregateProtocolModel] {

  def generate(model: AggregateProtocolModel): String = {
    // 1. Package Declaration
    val pkgDecl = packageDecl(model.selfType.packageName)

    // 2. Import Declaration
    val importList = model.dependencies.toList.sortBy(_.fqn).map(_.fqn).distinct
    // Add CborSerializable implicitly if not present, though dependencies should cover it
    val importDecl = imports(importList: _*)

    def renderFields(fields: Seq[FieldDef]): String = {
      fields
        .map(f =>
          s"${NamingConventions.scalaIdentifier(f.name)}: ${f.typeRef.signature}${f.defaultValue.map(d => s" = $d").getOrElse("")}"
        )
        .mkString(", ")
    }

    // 3. Command Family Trait
    val commandFamilyDef =
      s"  sealed trait ${model.commandFamily.name} extends ${model.commandFamily.superTypes.map(_.name).mkString(" with ")}"

    // 4. Commands
    // EP_GenerationTime_Code_Anchors P1（pm 面本体锚）：命令参数的知识 id **builder 早已透传**
    // （`AggregateProtocolBuilder:43` 把 `p.noteId` 放进 `FieldDef`），缺的一直只是这里发射——
    // 故 pm 面 `codeFqn` 长期恒 0（图上仅 3 条还是 FQN 构造错配生出的假锚）。
    // 无 noteId 的合成参数（replyTo／triggeredBy／tenantId）不发行，零漂移。
    val commandsCode = model.commandFamily.commands
      .map { c =>
        val fields = renderFields(c.fields)
        val doc = KnowledgeAnchorDoc.fieldDoc(c.fields, "  ")
        val extendsClause = (c.superTypes :+ model.selfType.copy(name =
          model.commandFamily.name
        )).distinct.map(_.name).mkString(" with ")
        // Note: model.commandFamily.name is technically the trait name, but here we can just use the name directly
        // However, generic extends approach:
        // Actually c.superTypes should already contain the family type from the builder.
        // Let's rely on what Builder prepared or simple logic:
        s"$doc  case class ${c.name}($fields) extends ${model.commandFamily.name}"
      }
      .mkString("\n")

    // 5. Replies
    val repliesCode = model.replies
      .map(r =>
        s"  case class ${r.name}(${renderFields(r.fields)}) extends ${r.superTypes.map(_.name).mkString(" with ")}"
      )
      .mkString("\n")

    // 6. State & Events (Optional)
    val stateCode = model.state
      .map { state =>
        val evName = "TransactionEvent" // Default for Saga
        s"""
  // --- Inline State & Events ---
  sealed trait $evName extends CborSerializable

  sealed trait Status extends CborSerializable
  object Status { case object New extends Status; case object Initiated extends Status; case object Prepared extends Status; case object Completed extends Status; case class Failed(reason: String) extends Status }

  case class ${state.name}(${renderFields(
            state.fields
          )}, status: Status = Status.New) extends CborSerializable {
    def applyEvent(event: $evName): ${state.name} = ???
  }

  object ${state.name} {
     def empty(id: String): ${state.name} = ${state.name}(id = Some(id))
  }
"""
      }
      .getOrElse("")

    // 7. Body
    val body = s"""
  // Commands
$commandFamilyDef
$commandsCode

  // Replies
$repliesCode

$stateCode
${model.stateType
        .zip(model.eventType)
        .map { case (st, ev) =>
          val handlerTypeName =
            model.commandFamily.name.replace("Command", "CommandHandler")
          s"""
  // CommandHandler type alias (moved from Aggregate to break circular dependency)
  type $handlerTypeName = (${st.name}, ${model.commandFamily.name}) => akka.persistence.typed.scaladsl.Effect[${ev.name}, ${st.name}]
"""
        }
        .getOrElse("")}
"""

    // 7. Object Definition
    val objectDef = ObjectDefinition(
      name = model.selfType.name,
      body = body
    )

    // 8. Source File
    val sourceFile = SourceFile(
      packageDecl = pkgDecl,
      importDecl = importDecl,
      definitions = Seq(objectDef)
    )

    sourceFile.code
  }
}
```
