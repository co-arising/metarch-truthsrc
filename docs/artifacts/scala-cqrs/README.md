# Scala CQRS 产物目录

本目录按职责管理Scala领域/应用/投影/接口、单/多模块、Saga和Monarch。类型身份、生成器kind和文件数分开。所有类别的当前实现、开放人工输入、回锚与验证边界都在对应页，不把库能力误写为已生成银行应用。

先读 [约定](CONVENTIONS.md)、[目标profile与命名合同](TARGET-PROFILES.md)、[构建顺序](BUILD-ORDER.md)和[参考实现与开发范式](REFERENCE-DEVELOPMENT.md)，再按需要进入类别。跨目标总目录、来源锁和漂移记录在[上一级](../README.md)；[能力合同](../CAPABILITY-CONTRACT.md)与[派生矩阵](../CAPABILITY-MATRIX.md)区分现役/旧式/退役、真实producer、样例生成、编译和最终审定。[原始盘点与实施路线](../STATUS-AND-IMPLEMENTATION-PLAN.md)保留校准前数字及后续模板路线。来源覆盖与金样资格是两回事：未经打磨的BC mjs产物不是设计基准。

第三批的显式 [领域kernel生成合同](DOMAIN-KERNEL.md) 覆盖值、纯协议、State、RuleParams及真实PB转换支撑；它是candidate的有限子集，不代表完整四模块应用或银行迁移。

第四批的显式 [有限aggregate-core合同](AGGREGATE-CORE.md) 对应 `scala-cqrs-aggregate-core-v1`／`scala-cqrs-aggregate-core@1`，catalog profile为 `js-aggregate-core-candidate-v1`。复用family1单份kernel值/协议与glue PB基础，加纯Rules/CommandHelpers/fold、独立ActorProtocol、真实Aggregate行为、Factory/Bootstrap及Actor-specific Repository接口/本地实现。kernel无Actor类型；root只聚合kernel/glue，未完成ext/业务root或外部结果桥。

catalog 2.3.0仍为125类/523变体、41个producer/534条输出合同，active observations=20：原12份样例generated，family1/family2各complete-plan generated及同样例源码generated/compiled/behavior-verified。第四批19项source职责取得同一Warehouse样例的三层资格，2项build职责仅generated；exact-value-codec明确excluded，artifact-generator仍handwritten。[原16声明历史](../evidence/capability-domain-kernel-final-history.json)不重签、不计current。主Warehouse源码24 entries含22参考生产文件与2生成测试（PB空State往返、空历史replay基线），支持测试纳入真实源码资格，但不当独立oracle；不由直接compiler通过推定sbt已执行。第四批按有限候选合同收口，完整回归、离线安装与来源门的实际结果见[第四批验收](../AGGREGATE-CORE-ACCEPTANCE.md)；无Bank、完整服务或最终批准，final-approved=0。

## 领域结构与纯行为

- [领域实体与状态初始化](domain/domain-entity.md) — `domain-entity`
- [领域命令与事件协议](domain/domain-protocol.md) — `domain-protocol`
- [纯领域服务与计算实现](domain/domain-service.md) — `domain-service`
- [领域状态载体](domain/domain-state.md) — `domain-state`
- [事件应用与领域行为](domain/event-handler.md) — `event-handler`
- [精确金额与数值编解码](domain/exact-value-codec.md) — `exact-value-codec`
- [领域不变式与命令决策](domain/invariant-rule.md) — `invariant-rule`
- [规则参数载体](domain/rule-parameters.md) — `rule-parameters`
- [值对象与签名类型](domain/value-object.md) — `value-object`

## 应用协议与用例

- [聚合命令行为](application/aggregate-behavior.md) — `aggregate-behavior`
- [聚合行为工厂接口](application/aggregate-factory.md) — `aggregate-factory`
- [聚合仓储实现](application/aggregate-repository-implementation.md) — `aggregate-repository-implementation`
- [聚合仓储接口](application/aggregate-repository-port.md) — `aggregate-repository-port`
- [聚合应用入口](application/aggregate-root.md) — `aggregate-root`
- [Actor命令与回复协议](application/application-protocol.md) — `application-protocol`
- [应用用例与业务流程服务](application/application-service.md) — `application-service`
- [命令参数转换与处理助手](application/command-helper.md) — `command-helper`
- [外部结果到领域事件桥](application/external-event-bridge.md) — `external-event-bridge`
- [历史Fab流程编排与动态路由](application/legacy-flow-orchestration.md) — `legacy-flow-orchestration`
- [查询与读模型组合服务](application/query-service.md) — `query-service`

## 端口、实现与多模块绑定

- [应用流程端口](ports/application-flow-port.md) — `application-flow-port`
- [纯领域计算端口](ports/computation-port.md) — `computation-port`
- [外部连接器实现](ports/connector-implementation.md) — `connector-implementation`
- [手写扩展实现](ports/extension-implementation.md) — `extension-implementation`
- [外部系统连接器接口](ports/external-connector-port.md) — `external-connector-port`
- [图存储查询与变更端口](ports/graph-store-port.md) — `graph-store-port`
- [身份存储端口](ports/identity-store-port.md) — `identity-store-port`
- [端口绑定与组合根模块](ports/port-binding-module.md) — `port-binding-module`
- [端口默认实现薄桥](ports/port-bridge.md) — `port-bridge`
- [端口签名类型闭包](ports/signature-value-closure.md) — `signature-value-closure`

## 投影与策略执行

- [图读侧适配与变更执行](projection/graph-projection.md) — `graph-projection`
- [策略Runner启动装配](projection/policy-bootstrap.md) — `policy-bootstrap`
- [反应式策略纯决策](projection/policy-decision.md) — `policy-decision`
- [策略事件处理装配壳](projection/policy-handler.md) — `policy-handler`
- [策略执行机制束](projection/policy-mechanics.md) — `policy-mechanics`
- [策略投影Runner](projection/policy-runner.md) — `policy-runner`
- [读侧纯状态变换](projection/projection-apply-event.md) — `projection-apply-event`
- [投影启动与注册](projection/projection-bootstrap.md) — `projection-bootstrap`
- [事件投影处理器](projection/projection-handler.md) — `projection-handler`
- [读侧仓储与事务实现](projection/projection-repository-implementation.md) — `projection-repository-implementation`
- [读侧仓储接口](projection/projection-repository-port.md) — `projection-repository-port`
- [ViewMachine与PolicyMachine共享机制](projection/projection-runtime-mechanism.md) — `projection-runtime-mechanism`
- [关系模式、DDL与索引](projection/projection-schema.md) — `projection-schema`
- [读模型与视图定义](projection/read-model.md) — `read-model`
- [读侧水位与生命周期监控](projection/readside-watchdog.md) — `readside-watchdog`
- [向量检索与嵌入适配](projection/vector-projection.md) — `vector-projection`

## HTTP、权限与页面

- [认证授权合同与实现](api/authorization-policy.md) — `authorization-policy`
- [命令端点组合DSL](api/command-endpoint-dsl.md) — `command-endpoint-dsl`
- [HTTP控制器与服务适配](api/http-controller.md) — `http-controller`
- [HTTP请求与响应DTO](api/http-dto.md) — `http-dto`
- [HTTP过滤器与健康端点](api/http-observability.md) — `http-observability`
- [页面renderer与客户操作视图](api/page-renderer.md) — `page-renderer`
- [命令角色与视图键映射](api/role-and-view-key-map.md) — `role-and-view-key-map`
- [路由定义与反向路由配置](api/route-definition.md) — `route-definition`
- [服务端口与组合合同](api/service-contract.md) — `service-contract`
- [服务Loader与生命周期装配](api/service-runtime.md) — `service-runtime`

## 持久化及序列化

- [数据库连接与I/O基础适配](persistence/database-driver-adapter.md) — `database-driver-adapter`
- [事件持久化适配器](persistence/event-adapter.md) — `event-adapter`
- [事件日志读取端口与适配](persistence/journal-port-adapter.md) — `journal-port-adapter`
- [领域与Protobuf转换器](persistence/proto-converter.md) — `proto-converter`
- [Protobuf线格式定义](persistence/protobuf-schema.md) — `protobuf-schema`
- [消息序列化器与manifest](persistence/protobuf-serializer.md) — `protobuf-serializer`
- [序列化注册与扩展](persistence/serialization-registration.md) — `serialization-registration`
- [快照持久化适配器](persistence/snapshot-adapter.md) — `snapshot-adapter`

## Saga旧式/严格事务

- [有限子运行与等待宿主](saga/child-run-host.md) — `child-run-host`
- [可查证外部效果宿主](saga/effect-host.md) — `effect-host`
- [Saga注册与启动装配](saga/saga-bootstrap.md) — `saga-bootstrap`
- [Saga静态合同与阶段报告](saga/saga-contract-report.md) — `saga-contract-report`
- [Saga耐久调用与结果交付宿主](saga/saga-invocation-host.md) — `saga-invocation-host`
- [旧Saga阶段执行行为](saga/saga-legacy-behavior.md) — `saga-legacy-behavior`
- [旧Saga事务上下文](saga/saga-legacy-context.md) — `saga-legacy-context`
- [旧Saga实体与状态](saga/saga-legacy-entity.md) — `saga-legacy-entity`
- [Saga参与者适配](saga/saga-participant.md) — `saga-participant`
- [Strict阶段执行与查证端口](saga/saga-phase-port.md) — `saga-phase-port`
- [严格回执上下文与参数血缘](saga/saga-receipt-context.md) — `saga-receipt-context`
- [Saga序列化与转换](saga/saga-serializer.md) — `saga-serializer`
- [Saga事务寻址实现](saga/saga-transaction-repository-implementation.md) — `saga-transaction-repository-implementation`
- [Saga事务仓储接口](saga/saga-transaction-repository-port.md) — `saga-transaction-repository-port`
- [Saga事务门面与声明](saga/saga-transactor.md) — `saga-transactor`
- [Saga触发协议与耐久门面](saga/saga-trigger.md) — `saga-trigger`
- [Saga持久化协议与参与者线格式](saga/saga-wire.md) — `saga-wire`
- [Strict事务协调内核](saga/strict-saga-coordinator.md) — `strict-saga-coordinator`
- [Strict Saga定义与固定计划](saga/strict-saga-definition.md) — `strict-saga-definition`

## Monarch阶段、R1与R2

- [有限批作业协调内核](monarch/batch-coordinator.md) — `batch-coordinator`
- [有限批定义与manifest](monarch/batch-definition.md) — `batch-definition`
- [耐久交接Inbox与Delivery](monarch/durable-inbox.md) — `durable-inbox`
- [外部操作连接器与证据验证](monarch/external-operation-connector.md) — `external-operation-connector`
- [受管理的外部操作等待](monarch/managed-operation-wait.md) — `managed-operation-wait`
- [PersistentMonarch持久化宿主](monarch/monarch-checkpoint-host.md) — `monarch-checkpoint-host`
- [生成的有限执行计划](monarch/monarch-execution-plan.md) — `monarch-execution-plan`
- [Monarch顺序阶段引擎与解释器](monarch/monarch-stage-engine.md) — `monarch-stage-engine`
- [Run状态与计划编码](monarch/monarch-state-codec.md) — `monarch-state-codec`
- [Monarch协议序列化与有限配置](monarch/monarch-wire-settings.md) — `monarch-wire-settings`
- [耐久外部操作协调器](monarch/persistent-operation.md) — `persistent-operation`
- [资源域准入与占位协调](monarch/resource-domain.md) — `resource-domain`
- [资源证据与业务占位策略](monarch/resource-evidence-policy.md) — `resource-evidence-policy`
- [版本化Run定义与提交信封](monarch/run-definition-submission.md) — `run-definition-submission`
- [WorkflowHost启动与激活](monarch/workflow-host-bootstrap.md) — `workflow-host-bootstrap`
- [WorkflowProgram业务适配](monarch/workflow-program.md) — `workflow-program`
- [工作流查询与有限恢复授权](monarch/workflow-query-reconcile.md) — `workflow-query-reconcile`

## 工程和生命周期装配

- [聚合持久化Bootstrap](project/aggregate-bootstrap.md) — `aggregate-bootstrap`
- [应用启动装配](project/application-bootstrap.md) — `application-bootstrap`
- [运行配置与资源引用](project/application-configuration.md) — `application-configuration`
- [业务时钟与演示初始化](project/business-clock-seed.md) — `business-clock-seed`
- [多模块布局与依赖方向](project/multi-module-layout.md) — `multi-module-layout`
- [工程构建与依赖配置](project/project-build.md) — `project-build`
- [运行资源所有者与目录](project/runtime-owner.md) — `runtime-owner`

## 独立测试与模拟

- [函数用例与参数化合同测试](verification/function-contract-test.md) — `function-contract-test`
- [生成的合同与结构测试](verification/generated-test.md) — `generated-test`
- [独立业务验收与恢复Oracle](verification/independent-business-oracle.md) — `independent-business-oracle`
- [服务测试配置与隔离支持](verification/service-test-configuration.md) — `service-test-configuration`
- [设备与场景模拟Actor](verification/simulation-actor.md) — `simulation-actor`
- [业务模拟器与外部证据夹具](verification/simulator-fixture.md) — `simulator-fixture`

## 版本阅读规则

当前银行P23、BC单模块/多模块、legacy Saga、strict Saga、Monarch R1/R2是各自的适用变体。没有对应生成器的运行库能力明确标not-generated；手写port/绑定按实际所有权说明。文档完整不等于全部变体已经被当前银行消费。
