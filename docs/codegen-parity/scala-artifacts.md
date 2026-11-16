# 传统 Scala 制品清单：39 模板族与 3 项扩展

最后更新：2026-11-16。状态：**来源与调度清单；不是42份内容规格已审定，也不是生成器对齐通过。**

机器表：[scala-artifacts.json](scala-artifacts.json)。完整固定字节与SHA：[baseline/index.json](baseline/index.json)。BC基准HEAD为`cc335eb1e0d0fae17bf092fd61b126040196ea70`；含未提交内容时以索引中的字节副本为准，不以HEAD替代文件身份。

## 1. 清点口径

- 传统路径为`CodegenMain`选定`SystemMetadata` → `CQRSApplicationGenerator.runCommon` → 各层Builder/Template → writer。
- **39是不同Template族数**，不是现有统一ArtifactType enum、不是输出文件数、不是所有动态变体的数量。
- 3项strict/composition扩展另列，不与经典Saga家族混签。此处“经典”指本次传统Scala链，不代表项目不存在后续v3 Saga机制。
- Model可在另一族文件中定义，Builder可有多个方法；不能强行整理成一个物理文件对应一个模型。
- 所有下表路径相对于固定目录`baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/`，后缀均为`.scala`。`bootstsrap`是实际目录拼写。
- 每个族的完整构造、RHS、方法体、输入规则与目标覆盖在独立diff中。链接存在不代表内容已审定；暂缺链接表示待补文档，不可略掉该族。

## 2. 39族的M/B/T与调度条件

调度源：[CQRSApplicationGenerator.scala](baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L511)。行号按固定副本。

| # | 族与diff | Model | Builder | Template | 实际调度/基数 |
|---:|---|---|---|---|---|
| 1 | [value-object](diffs/value-object.diff.md) | `model/domain/ValueObjectModel` | `builder/domain/ValueObjectBuilder` | `template/domain/ValueObjectTemplate` | L516–530；每`domain.valueObjects`一个 |
| 2 | [domain-entity](diffs/domain-entity.diff.md) | `model/domain/DomainEntityModel` | `builder/domain/DomainEntityBuilder` | `template/domain/DomainEntityTemplate` | L532–542；每`domain.entities`一个，含State/Events |
| 3 | [event-handler](diffs/event-handler.diff.md) | `model/domain/EntityBehaviorModel` | `builder/domain/EntityBehaviorBuilder` | `template/domain/EntityBehaviorTemplate` | L543–558；每`domain.behaviors`一个 |
| 4 | [invariant-rule](diffs/invariant-rule.diff.md) | `model/domain/InvariantRuleModel` | `builder/domain/InvariantRuleBuilder` | `template/domain/InvariantRuleTemplate` | L559–574；每`domain.invariants`一个 |
| 5 | [domain-service](diffs/domain-service.diff.md) | `model/domain/DomainServiceModel` | `builder/domain/DomainServiceBuilder` | `template/domain/DomainServiceTemplate` | L584–592；每`domain.services`一个 |
| 6 | [aggregate-root](diffs/aggregate-root.diff.md) | `model/application/AggregateRootModel` | `builder/application/AggregateRootBuilder` | `template/application/AggregateRootTemplate` | L604–617；每`app.aggregates`一个 |
| 7 | [application-protocol](diffs/application-protocol.diff.md) | `model/application/AggregateProtocolModel`；Command子型在`AggregateRootModel` | `builder/application/AggregateProtocolBuilder` | `template/application/AggregateProtocolTemplate` | L619–633；每聚合一个Commands/Replies容器 |
| 8 | [aggregate-factory](diffs/aggregate-factory.diff.md) | `model/application/AggregateFactoryModel` | `builder/application/AggregateFactoryBuilder` | `template/application/AggregateFactoryTemplate` | L635–642；每聚合一个 |
| 9 | [aggregate-behavior](diffs/aggregate-behavior.diff.md) | `model/application/AggregateBehaviorModel` | `builder/application/AggregateBehaviorBuilder` | `template/application/AggregateBehaviorTemplate` | L644–658；每聚合一个 |
| 10 | [command-helper](diffs/command-helper.diff.md) | `model/application/CommandHelperModel`，定义`CommandHelpersModel/CommandHelperModel` | `builder/application/CommandHelpersBuilder` | `template/application/CommandHelpersTemplate` | L660–668；跳过`metaCategory == application.services.transactor`的聚合，内部还排除只读命令 |
| 11 | [aggregate-rules-formal](diffs/aggregate-rules-formal.diff.md) | `model/application/AggregateRulesModel` | `builder/application/AggregateRulesBuilder` | `template/application/AggregateRulesTemplate` | L669–679；同上非Saga聚合，build返回Some才发 |
| 12 | [aggregate-repository-port](diffs/aggregate-repository-port.diff.md) | `model/application/AggregateRepositoryModel` | `builder/application/AggregateRepositoryBuilder` | `template/application/AggregateRepositoryTemplate` | L682–700；`app.repositories`中`AggregateRepositoryMetadata` |
| 13 | [external-connector-port](diffs/external-connector-port.diff.md) | `model/application/ConnectorModel` | `builder/application/ConnectorBuilder` | `template/application/ConnectorTemplate` | L702–711；每`app.connectors`一个 |
| 14 | [application-service](diffs/application-service.diff.md) | `model/application/ApplicationServiceModel` | `builder/application/ApplicationServiceBuilder` | `template/application/ApplicationServiceTemplate` | L713–722；每`app.services`一个 |
| 15 | [query-service](diffs/query-service.diff.md) | `model/application/QueryServiceModel` | `builder/application/QueryServiceBuilder` | `template/application/QueryServiceTemplate` | L724–733；每`app.queries`一个 |
| 16 | [saga-participant](diffs/saga-participant.diff.md) | `model/application/transactor/SagaParticipantModel` | `builder/application/transactor/SagaParticipantBuilder` | `template/application/transactor/SagaParticipantTemplate` | L738–747；每Saga的每participant一个 |
| 17 | [saga-definition](diffs/saga-definition.diff.md) | `model/application/transactor/SagaDefinitionModel` | `builder/application/transactor/SagaDefinitionBuilder` | `template/application/transactor/SagaDefinitionTemplate` | L749–755；每`app.sagas`一个 |
| 18 | [saga-trigger-protocol](diffs/saga-trigger-protocol.diff.md) | `model/application/transactor/SagaTriggerModels`中的`SagaTriggerProtocolModel` | `builder/application/transactor/SagaTriggerBuilder.buildProtocol` | `template/application/transactor/SagaTriggerProtocolTemplate` | L759–761；每Saga一个 |
| 19 | [saga-trigger-entity](diffs/saga-trigger-entity.diff.md) | 同文件中的`SagaTriggerEntityModel` | `SagaTriggerBuilder.buildEntity` | `template/application/transactor/SagaTriggerEntityTemplate` | L762–764；每Saga一个 |
| 20 | [saga-trigger-root](diffs/saga-trigger-root.diff.md) | 同文件中的`SagaTriggerRootModel` | `SagaTriggerBuilder.buildRoot` | `template/application/transactor/SagaTriggerRootTemplate` | L765–767；每Saga一个 |
| 21 | [saga-trigger-behaviors](diffs/saga-trigger-behaviors.diff.md) | 同文件中的`SagaTriggerBehaviorsModel` | `SagaTriggerBuilder.buildBehaviors` | `template/application/transactor/SagaTriggerBehaviorsTemplate` | L768–770；每Saga一个 |
| 22 | [aggregate-repository-implementation](diffs/aggregate-repository-implementation.diff.md) | `model/infrastructure/repository/AggregateRepositoryImplModel` | `builder/infrastructure/repository/AggregateRepositoryImplBuilder` | `template/infrastructure/repository/AggregateRepositoryImplTemplate` | L787–802；`infra.repositories`中Aggregate类型 |
| 23 | [projection-repository-port](diffs/projection-repository-port.diff.md) | `model/application/ProjectionRepositoryModel` | `builder/application/ProjectionRepositoryBuilder` | `template/application/ProjectionRepositoryTemplate` | L803–825；同列表中Projection类型；并非从app.repositories无条件产生 |
| 24 | [projection-repository-implementation](diffs/projection-repository-implementation.diff.md) | `model/infrastructure/repository/ProjectionRepositoryImplModel` | `builder/infrastructure/repository/ProjectionRepositoryImplBuilder` | `template/infrastructure/repository/ProjectionRepositoryImplTemplate` | L827–840；与Projection port同一个metadata输入 |
| 25 | [connector-implementation](diffs/connector-implementation.diff.md) | `model/infrastructure/connector/ConnectorImplModel` | `builder/infrastructure/connector/ConnectorImplBuilder` | `template/infrastructure/connector/ConnectorImplTemplate` | L843–852；每`infra.connectors`一个 |
| 26 | [projection-apply-event](diffs/projection-apply-event.diff.md) | `model/application/ProjectionModel`与`ApplyEventFunction` | `builder/application/ProjectionBuilder` | `template/application/ProjectionApplyEventTemplate` | L856–875；`model.applyEvents.nonEmpty`才产生；selfType派生handlers子包和ApplyEvent后缀 |
| 27 | [projection](diffs/projection.diff.md) | `model/application/ProjectionModel` | `builder/application/ProjectionBuilder` | `template/application/ProjectionTemplate` | L856、876–888；每`infra.projections`一个 |
| 28 | [projection-handler](diffs/projection-handler.diff.md) | `model/application/ProjectionModel`中的`ProjectionHandlerModel` | `ProjectionBuilder`生成handlers | `template/application/ProjectionHandlerTemplate` | L890–907；每model.handlers一个；调度处补projection noteIds |
| 29 | [protobuf-schema](diffs/protobuf-schema.diff.md) | `model/infrastructure/proto/ProtoFileModel` | `builder/infrastructure/proto/AggregateRootProtoBuilder.build/buildShared` | `template/infrastructure/proto/ProtoTemplate` | L912–927每聚合一个；L962–973按共享分量可额外产生一个shared VO文件 |
| 30 | [proto-converter](diffs/proto-converter.diff.md) | `model/infrastructure/persistence/AggregateConverterModel` | `builder/infrastructure/persistence/AggregateConverterBuilder` | `template/infrastructure/persistence/AggregateConverterTemplate` | L929–938；每聚合一个模型输出 |
| 31 | [event-adapter](diffs/event-adapter.diff.md) | `model/infrastructure/persistence/AdapterModel` | `builder/infrastructure/persistence/AggregateAdapterBuilder.buildEventAdapter` | `template/infrastructure/persistence/EventAdapterTemplate` | L940–948；每聚合一个 |
| 32 | [snapshot-adapter](diffs/snapshot-adapter.diff.md) | 同`AdapterModel` | `AggregateAdapterBuilder.buildSnapshotAdapter` | `template/infrastructure/persistence/SnapshotAdapterTemplate` | L950–959；每聚合一个 |
| 33 | [saga-context](diffs/saga-context.diff.md) | `model/application/transactor/SagaContextModel` | `builder/application/transactor/SagaContextBuilder` | `template/application/transactor/SagaContextTemplate` | L975–988；每Saga一个；Saga引擎journal/proto/adapters留运行库，不为participant发持久化家族 |
| 34 | [aggregate-state-controller](diffs/aggregate-state-controller.diff.md) | `model/infrastructure/api/AggregateStateControllerModel` | `builder/infrastructure/api/AggregateStateControllerBuilder` | `template/infrastructure/api/AggregateStateControllerTemplate` | L1016–1026；先筛repository存在且声明Get\<Agg\>State命令；非空合集一个controller |
| 35 | [http-controller](diffs/http-controller.diff.md) | `model/infrastructure/api/ControllerModel` | `builder/infrastructure/api/ControllerBuilder` | `template/infrastructure/api/ControllerTemplate` | L1034–1043；每`interfaces.controllers`一个 |
| 36 | [command-endpoint-dsl](diffs/command-endpoint-dsl.diff.md) | `model/infrastructure/api/CommandDslModel` | `builder/infrastructure/api/CommandDslBuilder` | `template/infrastructure/api/CommandDslTemplate` | L1045–1055；接口gate条件成立、build返回Some才发 |
| 37 | [route-definition](diffs/route-definition.diff.md) | `model/infrastructure/api/RoutesFragmentModel` | `builder/infrastructure/api/RoutesBuilder` | `template/infrastructure/api/RoutesTemplate` | L1061–1086；有效controller路由非空，MarkerBlockWriter合并共享conf/routes片段 |
| 38 | [bootstrap](diffs/bootstrap.diff.md) | `model/infrastructure/bootstrap/BootstrapModel` | `builder/infrastructure/bootstrap/BootstrapBuilder`的4个方法 | `template/infrastructure/bootstsrap/BootstrapTemplate` | L1140–1186；aggregate、saga coordinator、saga transactor、projection分别计变体 |
| 39 | [application-bootstrap](diffs/application-bootstrap.diff.md) | `model/infrastructure/bootstrap/ApplicationBootstrapModel` | `builder/infrastructure/bootstrap/ApplicationBootstrapBuilder` | `template/infrastructure/bootstsrap/ApplicationBootstrapTemplate` | L1188–1194；一次应用装配，额外接strictEntries |

## 3. 必须独立记账的变体

### Bootstrap四变体

| 变体 | Builder | 基数与条件 |
|---|---|---|
| aggregate | `buildAggregate(meta, ctx)` | 每application aggregate一个 |
| saga-coordinator | `buildSagaCoordinator(system.application.sagas, ctx)` | sagas非空时一份，不是每Saga重复一份 |
| saga-transactor | `buildSagaTransactor(meta, ctx)` | 每Saga一个 |
| projection | `buildProjection(meta, ctx)` | 每infra projection一个 |

上述仍是一个Template族。每个变体的父类型、构造参数、内部成员和初始化副作用在[bootstrap diff](diffs/bootstrap.diff.md)单列，不以一份aggregate样例覆盖四种。

### Proto与Projection

- Proto的`build(aggMeta, ctx)`和`buildShared(ctx)`两种产物共享Template；后者为Option，不能无条件制造空shared文件。
- Projection的`applyEvents`条件子产物、主projection、多个handler是三种不同逻辑职责；共享Model/Builder不等于同一输出文件。
- 字节对账必须区分selected单工程与multi-project物理根；`modules/kernel`等构建根不是新的业务包层。

### 模板分支不等于当前Builder可达

Raw AggregateRootTemplate等包含历史inline/Saga/null fallback分支。清单登记模板内容面，diff还须证明当前Builder是否提供相应字段；不能把`???`分支当已实现，也不能删除模型中未被模板消费的槽来假造一致。

## 4. 单列的3项扩展

| 扩展 | Model文件 | Builder文件 | Template文件 | 调用/边界 |
|---|---|---|---|---|
| [strict-saga-module](diffs/strict-saga-module.diff.md) | `model/application/transactor/StrictSagaModuleModel.scala` | `builder/application/transactor/StrictSagaModuleBuilder.scala` | `template/application/transactor/StrictSagaModuleTemplate.scala` | `StrictSagaGenerationPlan`与CQRS严格计划路径；不等于classic SagaDefinition |
| [strict-fixture-host](diffs/strict-fixture-host.diff.md) | `model/application/transactor/FixtureHostModel.scala` | `builder/application/transactor/FixtureHostBuilder.scala` | `template/application/transactor/FixtureHostTemplate.scala` | CQRS L231–248；显式host计划 |
| [composition-invocation-host](diffs/composition-invocation-host.diff.md) | **`CompositionHostModel`在Builder文件中定义** | `builder/application/transactor/CompositionHostBuilder.scala` | `template/application/transactor/InvocationHostTemplate.scala` | CQRS L258–269；composition host；不可猜一个不存在的Model文件路径 |

这些文件的固定字节可在[索引](baseline/index.json)按原路径取回；机器表中的扩展行与39族行结构不同，读取程序不得假定都有相同`scala.model`对象。

## 5. 与本清单分开的路径

- `PolicyBuilder/PolicyTemplate`在传统调度L575–583已注释退役；Node `rules_domain_gen`是另一种生产路径，不纳入活跃39族。
- `CodegenMain`的`semanticProductsFile → generateProducts`另账；其`ProductDomainTemplate`也有平铺Protocol/emit/nextN，不能作为本次风格合格依据。
- 静态scaffold复制、Node `gen_api_layer`后处理、库源与生成测试各自记账，不冒充传统Scala MBT模板族。
- `SkeletonGenerator.getArtifactTypeName`只是部分描述映射；catalog类别数、ledger kind数与本文清点单位不同。

## 6. 对齐的判定方法

1. `raw-scala`保存传统模板真实规则；未运行生成的条目标明未运行。
2. `curated-scala`只是人工完成的参考，不假装所有方法体都由raw模板产生。
3. `approved-target`默认等于raw，用户指定三层布局、清晰命名/import、真实CommandHelper、低复杂度等作为明确覆盖。新增业务算法或库版本不可自行批准。
4. `actual-js`同时追formal、legacy、family与当前银行选择；同一JS复合文件可拆成多个A/B逻辑项。
5. 每个A和Scala缺项均有独立diff。完整内容、RHS、胶水、副作用和跨文件业务阅读路径核准后，才进入对应实施包。

本文补齐人读清单，不改变原始852文件基线，不执行生成/编译/测试/运行，也不自动批准后续部署或Git操作。
