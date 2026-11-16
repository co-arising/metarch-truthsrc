# JS生成器重建计划：Scala ArtifactType逐项复刻与OO + Plain FP质量标准

## Context

用户否定当前JS生成代码质量，要求改以backend-codegen的Scala生成链为明确基准：
1. 从`CodegenMain`真实可达的Scala Model/Builder/Template链列出30+ ArtifactType。
2. 将JS生成输出按能够一一对应与不能对应分为A/B。
3. A逐项一比一复刻Scala的Model/Builder/Template模式和最终产物。
4. 从Scala A的实际风格总结OO + Plain FP整洁代码标准，以`bank-wealth-demo/generated-smells-by-artifactType.md`为反例来源约束B。
用户补充：必须逐项解释当前JS的A具体差在哪里，而不只是列对应名称或笼统评价风格。

这是新的生成器质量工作，替代旧relay续修计划的自动执行顺序。37已完成，38/组包/BC默认切流仍暂停。此阶段只规划，不修改产品代码、生成物、原任务状态或旧回执。

**批准后的第一交付边界**：先落地Scala清单、完整JS A/B分区、每个A及缺项的内容级diff文件、统一布局/OO + Plain FP标准与并发分工表；不在产出diff的同时修改生成器。后续按已审定diff并发修改JS是第二阶段，需先完成该工作包的内容/接口裁定。下面列出完整终点与执行顺序，不将规划批准解释为立即覆盖现有生成应用。

## 已核实基准与边界

- BC检视HEAD：`cc335eb1e0d0fae17bf092fd61b126040196ea70`；JS检视HEAD：`bf104e16ab82ef39d7fa416d0997907d18a815ad`。实施前固定实际源字节，HEAD不能代替未提交文件身份。
- BC有peer文档/参考产物变更（`.gitignore`、`AGENT_COORDINATION.md`、BACKLOG/PLANS、`PIPELINE-INVENTORY.md`、`EP_Business_Expression_P0.md`、`reference_project/app/semantic-products-play-service-pages/`）；JS原树观察干净。此工作不覆盖这些并行成果。
- 传统主链：`CodegenMain.scala:192`选定SystemMetadata → `CQRSApplicationGenerator.runCommon:203–220` → 分层builder/template → `writeArtifact:359`、`writeProto`、`writeRoutesArtifact:1070`。
- `CodegenMain.scala:183–188`的`semanticProductsFile → generateProducts`是另一路。其`template/products/ProductDomainTemplate.scala:171–187`也存在扁平Protocol、emit helper和nextN，**不得拿它当本次修复传统风格的金样**。完整入口清单仍登记该支路，不能漏报它。
- 未发现统一的`ArtifactType`枚举来列这30+项；实际类型来自`ArtifactModel`子型、Template调用、ledger kind和条件变体。`workflow/SkeletonGenerator.getArtifactTypeName`是部分描述映射，不是完整主链注册表。
- 传统分层链经去除注释后的调用枚举为**39个不同Template族**。BootstrapTemplate包含aggregate/saga coordinator/saga transactor/projection四个变体；ProtoTemplate有per-aggregate/shared VO变体。类别数、模板数与生成文件数分开，不用39冒称39文件。
- `PolicyBuilder/PolicyTemplate`调用在`CQRSApplicationGenerator.scala:575–583`已注释退役，不纳入活跃39；Node `rules_domain_gen`及`gen_api_layer`后处理另账。
- optional strict扩展另列：`StrictSagaModuleBuilder/Template`（StrictSagaGenerationPlan）、`FixtureHostBuilder/Template`（CQRS:231）、`CompositionHostBuilder/InvocationHostTemplate`（CQRS:258）。不与经典SagaParticipant/Definition/Trigger或新版products混签。
- 当前可直接参考的人工打磨样板在`reference_project/app/net/imadz/`；`VerificationSpecBase.scala:36–48`确指此根，但它的normalize会压平所有空白，因此只能复用文件读取机制，不能据该旧比较器证明本次格式一致。
- 基准已见例外：`CommandHelperModel.scala:23–25`本身存方法体字符串，`CommandHelpersBuilder.scala:73–119`含字符串构造；不能宣称Scala实际始终严格结构化。逐项记录，不在移植时把技术债扩大到其他模型。

## 第1步：传统Scala MBT明确清单

路径前缀 `C = backkend-codegen/src/main/scala/net/imadz/codegen/scaffolding/cqrs/`；表内M/B/T均相对C。省略的`.scala`统一补齐。表的序号是本次清点ID，不冒充项目已有enum。
`Model/Builder/Template`列用`子目录/Stem`表示文件路径，`→`后是模型class名与文件名不一致时的说明。

|#|Artifact族/输出职责|Model文件|Builder文件或方法|Template文件|CQRS调用行|
|---:|---|---|---|---|---:|
|1|value-object|model/domain/ValueObjectModel|builder/domain/ValueObjectBuilder|template/domain/ValueObjectTemplate|517|
|2|domain-entity（含State/Events）|model/domain/DomainEntityModel|builder/domain/DomainEntityBuilder|template/domain/DomainEntityTemplate|533|
|3|event-handler|model/domain/EntityBehaviorModel|builder/domain/EntityBehaviorBuilder|template/domain/EntityBehaviorTemplate|544|
|4|invariant-rule|model/domain/InvariantRuleModel|builder/domain/InvariantRuleBuilder|template/domain/InvariantRuleTemplate|560|
|5|domain-service|model/domain/DomainServiceModel|builder/domain/DomainServiceBuilder|template/domain/DomainServiceTemplate|585|
|6|aggregate-root|model/application/AggregateRootModel|builder/application/AggregateRootBuilder|template/application/AggregateRootTemplate|611|
|7|application-protocol（Commands/Replies）|model/application/AggregateProtocolModel；AggregateRootModel内CommandFamily/Command/Reply|builder/application/AggregateProtocolBuilder|template/application/AggregateProtocolTemplate|620|
|8|aggregate-factory|model/application/AggregateFactoryModel|builder/application/AggregateFactoryBuilder|template/application/AggregateFactoryTemplate|636|
|9|aggregate-behavior|model/application/AggregateBehaviorModel|builder/application/AggregateBehaviorBuilder|template/application/AggregateBehaviorTemplate|645|
|10|command-helper|model/application/CommandHelperModel → CommandHelpersModel/CommandHelperModel|builder/application/CommandHelpersBuilder|template/application/CommandHelpersTemplate|662|
|11|aggregate-rules-formal（有formal语义才发）|model/application/AggregateRulesModel|builder/application/AggregateRulesBuilder|template/application/AggregateRulesTemplate|671|
|12|aggregate-repository-port|model/application/AggregateRepositoryModel|builder/application/AggregateRepositoryBuilder|template/application/AggregateRepositoryTemplate|685|
|13|external-connector-port|model/application/ConnectorModel|builder/application/ConnectorBuilder|template/application/ConnectorTemplate|704|
|14|application-service|model/application/ApplicationServiceModel|builder/application/ApplicationServiceBuilder|template/application/ApplicationServiceTemplate|715|
|15|query-service|model/application/QueryServiceModel|builder/application/QueryServiceBuilder|template/application/QueryServiceTemplate|726|
|16|saga-participant（classic）|model/application/transactor/SagaParticipantModel|builder/application/transactor/SagaParticipantBuilder|template/application/transactor/SagaParticipantTemplate|740|
|17|saga-definition（classic）|model/application/transactor/SagaDefinitionModel|builder/application/transactor/SagaDefinitionBuilder|template/application/transactor/SagaDefinitionTemplate|749|
|18|saga-trigger-protocol|model/application/transactor/SagaTriggerModels → SagaTriggerProtocolModel|builder/application/transactor/SagaTriggerBuilder.buildProtocol|template/application/transactor/SagaTriggerProtocolTemplate|759|
|19|saga-trigger-entity|model/application/transactor/SagaTriggerModels → SagaTriggerEntityModel|builder/application/transactor/SagaTriggerBuilder.buildEntity|template/application/transactor/SagaTriggerEntityTemplate|762|
|20|saga-trigger-root|model/application/transactor/SagaTriggerModels → SagaTriggerRootModel|builder/application/transactor/SagaTriggerBuilder.buildRoot|template/application/transactor/SagaTriggerRootTemplate|765|
|21|saga-trigger-behaviors|model/application/transactor/SagaTriggerModels → SagaTriggerBehaviorsModel|builder/application/transactor/SagaTriggerBuilder.buildBehaviors|template/application/transactor/SagaTriggerBehaviorsTemplate|768|
|22|aggregate-repository-implementation|model/infrastructure/repository/AggregateRepositoryImplModel|builder/infrastructure/repository/AggregateRepositoryImplBuilder|template/infrastructure/repository/AggregateRepositoryImplTemplate|789|
|23|projection-repository-port|model/application/ProjectionRepositoryModel|builder/application/ProjectionRepositoryBuilder|template/application/ProjectionRepositoryTemplate|812|
|24|projection-repository-implementation|model/infrastructure/repository/ProjectionRepositoryImplModel|builder/infrastructure/repository/ProjectionRepositoryImplBuilder|template/infrastructure/repository/ProjectionRepositoryImplTemplate|827|
|25|connector-implementation|model/infrastructure/connector/ConnectorImplModel|builder/infrastructure/connector/ConnectorImplBuilder|template/infrastructure/connector/ConnectorImplTemplate|845|
|26|projection-apply-event（条件子产物）|model/application/ProjectionModel（ApplyEventFunction）|builder/application/ProjectionBuilder|template/application/ProjectionApplyEventTemplate|856,864|
|27|projection（source/provider/runtime装配）|model/application/ProjectionModel|builder/application/ProjectionBuilder|template/application/ProjectionTemplate|856,878|
|28|projection-handler|model/application/ProjectionModel → ProjectionHandlerModel|builder/application/ProjectionBuilder.buildHandlers|template/application/ProjectionHandlerTemplate|890–896|
|29|protobuf-schema（aggregate/shared变体）|model/infrastructure/proto/ProtoFileModel|builder/infrastructure/proto/AggregateRootProtoBuilder.build/buildShared|template/infrastructure/proto/ProtoTemplate|914,966|
|30|proto-converter|model/infrastructure/persistence/AggregateConverterModel|builder/infrastructure/persistence/AggregateConverterBuilder|template/infrastructure/persistence/AggregateConverterTemplate|930|
|31|event-adapter|model/infrastructure/persistence/AdapterModel|builder/infrastructure/persistence/AggregateAdapterBuilder.buildEventAdapter|template/infrastructure/persistence/EventAdapterTemplate|940|
|32|snapshot-adapter|model/infrastructure/persistence/AdapterModel|builder/infrastructure/persistence/AggregateAdapterBuilder.buildSnapshotAdapter|template/infrastructure/persistence/SnapshotAdapterTemplate|951|
|33|saga-context（classic）|model/application/transactor/SagaContextModel|builder/application/transactor/SagaContextBuilder|template/application/transactor/SagaContextTemplate|979|
|34|aggregate-state-controller|model/infrastructure/api/AggregateStateControllerModel|builder/infrastructure/api/AggregateStateControllerBuilder|template/infrastructure/api/AggregateStateControllerTemplate|1020|
|35|http-controller|model/infrastructure/api/ControllerModel|builder/infrastructure/api/ControllerBuilder|template/infrastructure/api/ControllerTemplate|1035|
|36|command-endpoint-dsl|model/infrastructure/api/CommandDslModel|builder/infrastructure/api/CommandDslBuilder|template/infrastructure/api/CommandDslTemplate|1048|
|37|route-definition（marker片段）|model/infrastructure/api/RoutesFragmentModel|builder/infrastructure/api/RoutesBuilder|template/infrastructure/api/RoutesTemplate|1061,1082|
|38|bootstrap（4个变体逐项子diff）|model/infrastructure/bootstrap/BootstrapModel|builder/infrastructure/bootstrap/BootstrapBuilder.buildAggregate/buildSagaCoordinator/buildSagaTransactor/buildProjection|template/infrastructure/bootstsrap/BootstrapTemplate|1141–1175|
|39|application-bootstrap|model/infrastructure/bootstrap/ApplicationBootstrapModel|builder/infrastructure/bootstrap/ApplicationBootstrapBuilder|template/infrastructure/bootstsrap/ApplicationBootstrapTemplate|1188|

说明：`bootstsrap`是实际目录拼写；不要根据正确英文拼出不存在路径。39族共享的Model子型/同一Builder多方法保留，不能为凑一一对应强行一文件一模型。正式清单再把每族路径/变体/固定来源指纹/输出角色存入机器表。

## 第2步：JS A/B分类方法与已确认接线

- 以`docs/artifacts/catalog.json`（观察v2.8.0，125 categories、45 producers）作导航，回到实际`lib/products/generate-cli.mjs:92–101`和legacy CLI的终端writer查证。125含工具/库/历史类别，不能全当需要改的生成器。
- 分类单位是**逻辑Artifact族/变体**；定位键：`producerId + entrypoint/profile + physicalOutputId + logicalRole + variant`。物理文件是容器，可以同时包含多个A逻辑制品和B支撑construct。不能强求一个Template=一个producer=一个filename。
- 每个复合文件记录完整源码指纹、成员/区间、各自目标文件/成员、split/merge/move disposition和唯一assembly owner；导入、注释分组、初始化语句也须归属，不得在拆分时丢弃。同一artifact有多个被消费实现须全登记，不能修一个却让银行仍走旧renderer。
- A：与上表目标职责/输入语义可逐项对应的逻辑JS制品，即使现实现职责错配仍归对应差距工作包，明确哪些construct应替换、哪些必要行为迁往别处。JS缺失的Scala族列`missing-counterpart`，**同样必须有独立diff规格**；不能从A清单移出去来掩盖缺项，也不假造现成实现。
- B：其余真实生成逻辑制品（如无经典对应的effect/child/workflow host、额外service composition/config/test support、tooling/TS输出等）；与strict扩展真正对应的需经过同样链路核验后才能归A，不能凭名称猜。B每项也有具体目标路径、标准、fixture及证据义务。数据/证据文件不套Scala包规则，但按BC工程的conf/build/proto/test分区规则安排。
- 历史retired目录只盘点可调用性与现有消费；不无故复活。只在legacy中存在而formal入口无对应的A标`legacy-only/not-wired`，不称全部已支持。
- 分类完成门：所有真实producer-output恰落A或B，另有声明未实现/退役状态与Scala缺项清单；每条都有输出路径与证据，不许unknown兜底。**本次计划期尚未完成全45 producers的最终逐输出A/B裁定；交付时须据实际内容完成，不编造数量。**

已实读的关键对应与差距：

|Scala族|当前JS位置|已证实差距|
|---|---|---|
|CommandHelpers|`scala-cqrs-domain/render-domain.mjs:31–42`；legacy `command-dsl/render.mjs:38–89`|formal只发emit事件；legacy才有implicit helper但固定Params/Some(error)/None，仍不等Scala完整reply/state映射。不是简单不存在，是正式接线和职责错配。|
|AggregateProtocol|`render-domain.mjs:25–27`＋`scala-cqrs-play-service/templates/aggregate-protocol.mjs:19–39`|Command/Event平铺domain；application用alias指回domain Request。外层Execute/GetState已有reply通道，但缺少与Scala逐业务Actor命令对应的replyTo/确认族。Scala `AggregateProtocolBuilder:54–68`按replyToType声明添加ActorRef；Template分Commands/Replies，事件归Entity。|
|AggregateBehavior|`scala-cqrs-play-service/build-aggregate-models.mjs:15–21`＋behavior template|按external/query/execution机械分组，内部payload再match；Scala按BehaviorGroup/PolicyBasedLogic组合`runReplyingPolicy(rule, helper)(state, cmd).replyWith(cmd.replyTo)`。|
|EntityBehavior|`render-domain.mjs:94–115`|无条件nextN、FQN类型标注；Scala `EntityBehaviorTemplate:31–49`按mutation直出state.copy/具名逻辑，不应假定每个assignment都要编号局部值。|
|Invariant/Rules|`render-domain.mjs:83–88`＋`render-expressions.mjs:56`|外层统一取反＋内层not导致`!(!(...))`；混合选择/推导/源码串接，缺少保真简化与优先级渲染。|
|Type/import支撑|`scala-cqrs-domain/naming.mjs:15–20`|nominal直接返回FQN字符串；Scala `TypeSystem.scala:4–51`将signature与fqn/import判断分离，依赖递归收集。|
|Aggregate/Factory/Repository布局|`scala-cqrs-play-service/aggregate-names.mjs:6–21`|Factory/Repository未进入factories/repository子包，保留domain Aggregate/Protocol/Helpers，adapter落serialization而非BC persistence。|
|B workflow命名|`scala-cqrs-application/render-invocation-execution.mjs:10`等|`id.replaceAll('-', '_')+'Execution'`；已有`lib/scala-target/naming.mjs:26–73`CamelCase/冗余后缀规则却未在该路径消费。|
|B service布局/命名|`scala-cqrs-play-service/render-service.mjs:32,39,199`|硬编码`.service`与`${name}Service`，输入BankService得到ServiceService；需按应用端口/基础设施Play装配拆职责与布局。|

JS新family generators有独立Model/Template文件不等于达成传统Scala结构；每条必须比较construct和RHS，不能拿“有build-models.mjs”代替复刻证明。

## 第3步：逐ArtifactType交付内容级diff规格（实施者的唯一领任务输入）

计划获准后创建 `metarch-truthsrc/docs/codegen-parity/`，此计划期不提前写这些文件。

```text
docs/codegen-parity/
  README.md                         # 范围/基准版本/状态/执行入口
  scala-artifacts.json              # Scala真实链路、39模板族与条件变体
  js-partition.json                 # 每个producer×output→A/B，及Scala缺项
  layout-and-style.md               # 所有产物的布局与OO + Plain FP标准
  glue-dependencies.md              # 实际胶水库签名/版本/副作用合同
  assignment-map.json               # diff依赖、写集合、可并发分组
  diffs/<artifact-type>.diff.md      # 每个A独立一份，不以主题汇总代替
  fixtures/<artifact-type>/         # 等价输入与来源说明，不建立第二业务真源
  baseline/<artifact-type>/         # 固定完整源字节和原始Scala产物；未运行则标明
  expected/<artifact-type>/         # 经认可的目标完整产物（包括必要多文件/变体）
```

`<artifact-type>.diff.md`的必填结构：
1. **身份与版本**：Scala+JS commit/工作树实际文件指纹、入口/profile、真实调用位置；参考是模板生成输出/手工golden/用户明确标准的哪一种；来源不同不得混签。
2. **Scala生产链完整路径与内容**：Model/Builder/Template/输出/关键shared helper和glue lib。小文件可全文；大文件按所有construct逐段覆盖并附完整文件固定引用，不只摘一个示例。
3. **Model逐字段对应表**：字段名、类型/泛型/可选性/默认值/顺序、dependencies、嵌套类型、note/anchor元数据；指出JS对应项缺失或错误放入代码字符串的地方。
4. **Builder逐规则对应表**：输入slot、类型/命名/包解析、推导顺序、command→param→reply映射、依赖收集、分支条件和异常，不能只比函数名称。
5. **产物内容组成表**：路径、package、import语句及分组顺序；class/trait/object/case class/type alias/val/method的全名、可见性、修饰词、泛型（含型变/上下界）、继承与父构造器实参、主/辅助构造器、参数列表（含隐式/柯里化）、返回类型、annotation/self-type、嵌套companion、重载、implicit/lazy成员、初始化语句、声明顺序、注释分组。每个成员有稳定标识、源位置、目标位置和处理结论，最后按完整文件对账，不能只靠摘录判齐。
6. **RHS与body逐项diff**：不仅签名；给出type alias等号右边、字段/默认值initializer、方法完整表达式/分支/调用链、事件构造/状态copy/错误处理/副作用顺序。用`构造位置 → Scala期望 → JS现状 → 修改位置`记录，附实际统一diff块（JS当前产物为minus，目标为plus）。生成器实现的Model/Builder/Template差异分别写，不把产物diff伪装成可直接应用到JS的patch。
7. **胶水合同**：import的完整库符号、坐标/版本、方法签名、谁持久化/谁回复/回复读取新旧哪个state、资源归属。库只在源码中存在不证明所消费jar具备能力；不复制一套库绕过依赖。
8. **当前差距与根因**：缺实现、实现偏离、入口未接通、表达/布局偏离或等价；来源到可见坏味道的确切代码行。没有等价输入或实际输出时标明未核验，不能编造PASS。
9. **修改任务**：准确JS写集合、所需shared接口、调用方/测试/ledger/anchor迁移、删除/替换范围及数据/协议保护面；每项都可独立交给agent执行，不以“改善风格”作任务。
10. **验收与并发**：fixture与公开CLI命令、expected文件集、construct/RHS/胶水行为/格式及复杂度标准；允许差异的有限白名单；dependsOn、conflictsWith、owner/writeSet、状态draft/ready/implemented/verified。

**准入门**：A每项和每个活跃Scala缺项必须有完整diff文件。无法定责、缺Scala参考或缺目标合同的条目标blocked，仅阻断相应工作包，不以stub填空；不开始其JS修改。B也要逐逻辑输出登记目标路径、规则、fixture，不能使用“其他”兜底漏文件。

**基准与目标分离**：每份diff明确保留`raw-scala`（传统链原始输出）、`approved-target`（用户标准/已认可例外合成的目标）、`actual-js`三份可取得的完整字节。分别展示raw-scala→approved-target的有限偏差与actual-js→approved-target的差距。默认目标等于原始Scala；用户已经明确的布局/命名/Helper示例等覆盖项记录为显式偏差，未裁定的变化不能自由发挥。固定引用须能取回准确字节（含未提交内容），不是只有HEAD加可变路径。每个模板族记录适用条件、输出基数和变体enabled/suppressed/missing/exercised，两个样板只能作为先行证明，不替代39族及变体覆盖。

## 复刻原则

- Scala的Model按实际字段/类型/层次复刻到JS显式结构；不得用一个`content`字符串代替整个模型。若Scala已有明确的`toParamLogic/failureReplyLogic/successReplyLogic`或`logicCode`槽，JS须对应记录其名字、来源与RHS，列为基准的代码槽例外；不能偷偷改模型合同，也不能把这种例外扩散到所有构造。
- Builder与Template的边界、每项派生规则、类型/命名解析顺序对应Scala；使用已存在可兼容的解析器，不擅自创造另一套架构。
- 同一语义fixture双端输出对账，保留命名、路径、成员顺序、API、分层及可见格式；允许忽略的来源头/换行等差异必须逐项列明，不能大范围删除空白/包名/代码后宣称一致。
- JS树→Scala输入的对应必须显式，不从业务散文猜默认值；源语义缺口不能通过模板硬编码补齐。
- Scala参考自身存在缺陷、非MBT例外或不安全行为时列为例外请求裁决；不擅改基准，也不以差距为借口降低A标准。
- 从最小代表切片先确认目标，再沿依赖图批量复刻全部A；最终清单逐项验收，不能只做一条样板就结束。
- 不手改`generated/`、`.truthsrc/`、ledger/anchors或共享应用。基准快照/金样是独立测试资产，不是新业务真源。

## B质量标准方向

基准要区分两层：**生成器实现的Model/Builder/Template分工**与**生成Scala代码的OO + Plain FP风格**，不能只把JS目录拆成三个就称完成。

| 规则 | 必须做到 | 反例/不能机械套用 |
|---|---|---|
| 有意义的OO边界 | 对象/trait封装不变式和稳定能力；依赖由显式参数/端口给出；方法与数据在合理职责内 | 不能为减少文件把领域/应用/基础设施揉成大类，也不为形式分层制造恒等壳 |
| 纯函数业务核心 | 决策返回明确结果；event application返回新状态；无隐式I/O、时间、全局可变配置 | 不为了“FP”引入万能解释器、异构字符串分发表或复杂类型体操 |
| 错误与状态类型化 | 正常拒绝用既有明确结果类型；有限业务状态用有意义的sealed ADT；边界错误有上下文 | 不能一刀切把所有require/throw删除；不能合并具有不同持久化语义的事件 |
| 可读表达 | 统一Scala命名、合理import、长参数逐行/命名实参、分支与回调分块、变量有业务名、空模板不输出 | 不只格式化长行却保留错误职责；不按字符数机械拆Part0/Part1 |
| 精确计算 | Money/精度/单位在明确边界校验；算术/舍入/溢出行为与合同一致 | 坏味道6.4的addExact→`+`不可直接采纳；默认值不能猜 |
| 类型与协议身份 | 区分domain/wire/persistence；保持PB字段号、PID、serializer ID、幂等身份 | 同构case class不等于可用type alias合并；不能擅自改成包级万能serializer绑定 |
| 一个事实一个派生源 | 共享元数据可统一驱动多份必要输出；抽取重复计算而非抹掉类型边界 | 独立oracle不与被测实现共用业务逻辑；代码重复量不是唯一质量尺度 |
| 显式适配与依赖 | 只在边界做codec、外部调用、资源生命周期；使用已有成熟API | 不用ByteString/String/Any作为领域内部万能载体来回编码 |
| 可变状态局部化 | 必要buffer/actor协调状态有局部所有权；持久化状态只经事件演进 | 不是全面禁止循环/局部var，也不是把可变状态藏到万能运行器 |

坏味道文档逐条分类为“直接改进表达”“需语义核验/基准批准”“不可照搬”。已知需防止误修：1.2/1.3名义类型与receipt合并、3.1/7.3删层、4.1事件合并、6.3/6.4状态/溢出改变、10.2以表替match、16.2/23.1宽泛serializer绑定。这里只指出改法可能改变合同，不提前认定原味道条目全部属实。

标准以Scala A的实读示例、B反例、人工样板认可和便宜确定的局部检查落地，不再创建大型通用审计框架。

## 用户明确指出的输出缺陷（逐项列入A差距与B禁止项）

1. `bank_cash_payment_v1Execution.scala`：稳定业务ID和Scala symbol没有分离。type/object/trait及对应文件用PascalCase，method/val/parameter用lowerCamelCase；保留原始业务ID在合同数据中，不能改变幂等键/持久化身份来换名。比较Scala NamingConventions/TypeResolver与JS当前符号派生。
2. `AccountInitialized`分支中的`val next0: Boolean = true; val next1: Map[String, ...Money] = ...; state.copy(...)`：缺乏源级表达。此简单例应直接生成命名`copy(initialized = true, accountBalance = state.accountBalance.updated(event.currency, event.amount))`。确实需要一次求值/依赖顺序/复用的临时值保留业务名，禁止不顾event fold语义全局内联。
3. 缺少`import example.bankwealth.domain.FundOrderProtocol.FundSubscriptionPaymentConfirmed`，类型引用到处FQN：复刻Scala依赖收集/符号解析/import冲突处理；正常无冲突场景使用简名，只有歧义时限定或别名，不用统一通配import掩盖缺失依赖。
4. `if (!(!((state.compensatedOutgoing).contains(p.txid)))) return Right(Vector.empty)`：表达式生成叠加否定及括号。应直接表达正向membership条件；在结构化表达式层按类型/优先级做保真渲染，不用生成后字符串regex全局替换。是否return、参数命名与规则层拆分，A按对应Scala模板，B按清晰控制流标准。

上述是用户指定必查样本，不以抽样修好这四项冒充全A完成，也不先假定对应Scala全部具备JS的业务扩展。

## 所有生成代码的布局合同（A/B同样适用）

以`backkend-codegen/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala`、`NamingConventions.scala`、`CQRSApplicationGenerator.writeArtifact/targetModuleOf`为布局依据；叠加用户最新明确约束：业务根包下只能有`domain/application/infrastructure`。不直接改Scala参考仓来迎合JS，也不迁共享应用。

```text
<base>/
  domain/
    values/
    entities/                     # Entity内部State/Events等按Scala目标
      behaviors/                  # EventHandler
    invariant/                    # Rules及参数按实际基准
    services/
    policy/
    events/                       # 仅基准使用时；不另建平铺Protocol
  application/
    aggregates/                   # Aggregate、Protocol（Commands/Replies）
      behaviors/                  # Behaviors、CommandHelpers
      factories/
      repository/                 # repository port
    services/
      transactor/
        behaviors/
    projection/
      handlers/
      repository/
    queries/
    connectors/
  infrastructure/
    bootstrap/
    persistence/
      converters/
      strategies/
    repositories/
      aggregate/
      projection/
      saga/
    connectors/
    proto/
```

- `example.bankwealth.service`、`.web`、`.integration`等平行层不允许在新生成目标中存在；旧手写实现移动是另一个明确写范围，不擅自改35手写/固定测试/旧候选。
- `BankServiceService`的服务端口/应用职责、HTTP/JSON/Play Loader、配置/装配拆开分别安置；不能将整个混合职责object移进application而继续引Play依赖。
- BC的`$base.modules`不是用户批准的第四层：用户三层约束优先，JS生成的DI装配归`infrastructure.bootstrap`（若需要更细子包，在diff中列明）；作为显式布局差异记录，不隐藏成逐字一致。
- BC在业务根包之外的`controllers`是框架顶层包，与`example.bankwealth`下禁止第四层不冲突；保留实际BC约定，不擅自新增`example.bankwealth.api`。conf/routes/build/protobuf/test物理根也遵照选定BC single/multi模式，不能把build module目录误当业务包层。
- 实施先建立旧→新文件路径/类型名/调用方清单，同步imports、构建源根、manifest、ledger、anchors和运行绑定。不能留一层旧domain壳来掩盖目录未迁移；不静默改变PB/PID/serializer身份，不能混用旧journal作新布局验证。

## 协议、CommandHelper与胶水的强制内容合同

已核Scala：
- `AggregateProtocolBuilder.scala:43–68`：在`cmd.replyToType`声明时，向应用Actor命令字段后追加`replyTo: ActorRef[Reply]`，不是所有命令无条件合成。依赖收集包括reply与泛型；`AggregateProtocolTemplate.scala:89–106`分Commands/Replies/Handler alias。本次目标的业务Actor命令必须明确其回复合同；原metadata缺失时在diff列为输入/目标差距，不偷偷补通用Reply。纯领域payload、规则参数、持久化事件不引入ActorRef。只读命令独立检查，不要求生成写命令专用CommandHelper（Builder:41明确排除isReadOnly）。
- `reference_project/app/net/imadz/application/aggregates/CreditBalanceProtocol.scala`：命令分组、每个命令明确replyTo，Replies单独分组；事件/state来自domain Entity，不把两类混平铺。
- `CommandHelpersBuilder.scala:11`与`TypeResolverDSL.commandHelper`：`application.aggregates.behaviors`；Model有command/state/param/reply/error五类型与三个方法体。
- `CommandHelpersTemplate.scala:45–62`：`implicit object XHelper extends CommandHelper[Command, State, Param, Reply]`，三个override不能缺少或只保留签名。
- `reference_project/app/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala:35–42`即用户Deposit样本，成功回复读**更新后的state**的余额。
- `common-core/src/main/scala/net/imadz/common/application/CommandHandlerReplyingBehavior.scala:16–44,71–75`：`toParam → rule.fold → 失败Effect.reply / 成功Effect.persist.thenReply`；不能以`emit*`事件构造函数冒充此胶水。
- `AggregateBehaviorTemplate.scala:79`与参考`CreditBalanceBehaviors.scala:19–54`：按业务行为组分解、`runReplyingPolicy(rule, helper)(state, cmd).replyWith(cmd.replyTo)`，继承Helpers trait；成功回执读取新状态，失败不得持久化。

diff必须区分“Scala模板原始生成体”与“人工完成的golden方法体”：当前Builder的默认回复不总等于用户Deposit参考。明确记录差异，用户点名的完整示例是该行为的要求；其余手写业务体不能被复制成所有领域的默认算法。若仅有`???`，记录为业务实现槽/外置实现义务，不用空成功返回伪装完成。A的基准冲突在diff审定时裁决，不由实施agent自由选择。

JS消费`common-core`等胶水必须核实际artifact坐标与API；sibling源码不等消费jar。复用现有库，不新增bank私有CommandHelper副本，也不默认批准运行库发布/升级。`replyWith`与`replyWithAndPublish`不能互换，后者增加EventStream发布副作用；验收覆盖失败不persist、成功应用事件后回复、回复次数和没有意外发布。

每个后续命令必须在diff写明全部写面/副作用（输出、graph、ledger、缓存、依赖发布/下载、子进程），新目标目录本身不能证明命令无旁路写入。实施/集成前只重核本次写集合及依赖pins；peer漂移时重定相应diff，不覆盖它。缺实际胶水jar或不兼容则阻断该项，不通过publishLocal、重建runtime或更换供给洗绿。

## 圈复杂度与OO + Plain FP质量门

用户要求生成代码达到优秀水平；同时约束修改的JS生成器代码，禁止靠一个复杂renderer把复杂度搬家。
- 普通函数/方法目标McCabe CC≤5；6–10必须有局部职责理由，>10不接受默认入库。直接条件/循环/catch/短路分支按选定工具口径计算，先固定工具与基线，不能用regex猜一个分数。
- 普通业务逻辑嵌套深度目标≤2；第三层先提炼具名子操作，超过3层须重构。规则组可用具名纯函数/业务行为分组与普通fold/组合表达。
- 全量sealed-ADT协议dispatch单列报告：优先依业务分组；每分支只做短而明确的类型化分发。确需超过阈值时必须有**逐方法**原因和覆盖证据，不允许全局`generated`豁免，也不转成String/Any表来降低分数。
- 复杂度门看每方法最大值、认知嵌套和实际代码，不看全项目平均数；不能用`helper1/helper2`碎片化或删校验/吞异常刷分。
- user样例的nextN/FQN/双重否定/平铺协议/缺replyTo/空emit-helper/错误包/重复后缀均为必须消失的失败样本。
- 语义型异常（Scala参考自身超限、保真表达必须的顺序/溢出/协议约束）在各diff明示。A先保留精确参考对照，按已批准质量偏差生成目标，不私自修改金样降低比较强度。

## 并发实施顺序与写入边界

1. **清单与diff阶段**：完成第1–3步文件与第4步标准。此阶段不改生成器；先展示所有A的差距总表和Protocol/CommandHelper/Behavior/Entity四份完整diff供用户检查粒度。余项同等内容要求；本次计划不声称这些diff已经写出。
2. **集成者先固定公共接口**：Scala式PackageLayout/命名、TypeRef/signature/import、structural model/表达式渲染、writer及anchor顺序。首选复用`lib/scala-target/naming.mjs`已有`resolveName/resolveNameSet/resolveArtifactPath`、`model.mjs`，补足兼容合同而非继续复制safeName。字段级来源映射在最终格式输出后定位；不添加新的@knowledge作者字段。
3. **按真实写集合分组并发移植A**：
   - domain/value/entity/event/rules组；
   - protocol/command-helper/behavior/aggregate/factory/repository组；
   - proto/converter/adapters组；
   - projection/query/repository组；
   - controller/command DSL/routes/connector/service组；
   - Saga/strict/bootstrap组按前置合同就绪后接入。
   一个ArtifactType多个variant仍由同owner负责。若跨组仍共享`render-domain.mjs`或registry文件，由集成者先作**只分离不改输出**的切分，或由同一agent串行处理，不允许冲突写。
4. 每个agent仅消费自己的diff、固定shared接口和批准依赖；可在批准执行阶段用用户允许的并发代理，但不创建worktree，不重做全仓审阅。交回改动、实际生成diff和未完成项；公共registry/catalog/project bindings/anchor集成由一个owner完成。
5. B按同一布局与整洁代码标准逐输出整改。A/B共享文件须安排单owner，不把B重命名/接口迁移造成的破坏当A无关问题。
6. 两个最小fixture（先CreditBalance含replyTo/Helper/命名State copy，再含跨类型协议与持久化的非银行例）通过后沿依赖闭包扩展全部A；最终再生成新银行目标并检查布局与内容。旧generated/current及37候选均不直接覆盖。

## 验证与时间控制

- 计划期只读；本阶段未执行构建/测试/生成/服务。两路探索502后不据缺结果编造完成；上游连接失败按用户要求重试，不作为代码缺陷。此前误建临时worktree均已自动移除。
- 每项diff的核心验收是**真实CLI生成产物的内容对照**，不是Node import-and-call或仅有单元测试。共享语义fixture分别适配Scala SystemMetadata与JS入口，适配不允许吞字段/默认值/排序；缺语义先阻断该项。
- 同一输入下逐文件检查路径、package、imports、声明及顺序、完整RHS/body、胶水调用与来源映射。比较只允许明确列出的生成版本头/平台换行等差异；禁止`.replaceAll("\\s+", " ")`这种压平代码的旧normalize或按AST相似掩盖分组/排版。
- 基础format/命名/import/CC检查在最终写盘与fingerprint/anchor定位之前；结果必须仍能从真实作者输入query到新位置。两次相同输入产物稳定，再用一个字段/规则变更检查合理局部diff和回锚。
- 复用`bin/truthsrc.js generate-products --request ... --generator ... --out <new> --options-json ...`或需外置实现捕获的`generate-project`；入口以`lib/products/generate-cli.mjs`实际选型。Scala用显式system/target的`CodegenMain`，隔离新目标，绝不采用默认banking-app或共享ingested-app。
- 初轮reference从已读`reference_project/app/net/imadz`与指定Scala模板核定；需要补实际生成时批量一次执行，不每个ArtifactType启动一次sbt。源代码build/测试义务与真实产物验证分账；本计划不授权全仓CI或重跑163分钟银行workshop。
- 必须有最小真实行为验证覆盖helper失败不persist、成功persist后thenReply读取新state、事件应用、必要codec/recovery边界；不能只用格式相同签收行为。先复用现有生成参考/fixture运行入口，命令/资源/时限在diff中具体列明。
- 一个改动只验证受影响的artifact依赖闭包；JVM编译集中到批末，多个分区共用一次结果；不把每个diff变成一个全量银行验收。
- 每批执行前列出预计耗时和停止点；建议生成/内容比对5分钟以内、局部编译/行为验证15分钟以内为初始**调度预算**（不是当前性能承诺，也不是放宽原单项deadline）。超出预算先返回已得结果与原因，不默默继续几个小时；收尾资源按原拥有者规则处理。

## 完成定义

- 第1步：39传统Template族及全部条件变体/扩展来源清单准确，inactive与Node后处理不混算。
- 第2步：所有实际JS输出完整A/B分区；各profile消费路径、声明未实现、Scala缺项可见。
- 第3步：**每个A一份完整内容级diff**，覆盖命名/结构/顺序/包/import/construct/RHS/body/glue/deps；没有空白待办冒充可实施规格。各diff批准后才并发改代码，最终每项都有真实生成与必要行为证据。
- 第4步：所有生成代码符合三层布局和OO + Plain FP标准，用户明确反例被纳入验证；B不因“没有Scala同款”免检。
- 不以39种模板存在、125 catalog行、编译绿或运行绿冒充内容对齐；不将新增过程步骤膨胀为181项式的长期backlog。
- 生成器修改、消费者接口迁移、银行运行验收、公开发布各自明确授权。无commit/push/tag/release、无runtime重发、无BC默认切流或共享应用写入。
