# Saga耐久调用与结果交付宿主

类别：`saga-invocation-host`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

冻结调用原文、启动关联、阶段结果与结果交付，连接Monarch步骤和严格Saga。宿主不替代事务协调内核。

## 输入与人工信息

输入/transaction ID derivation、owner、结果分类、outcome producer和receipt确认都需显式。

## 生产与所有权

- `js-formal`由`renderInvocationHosts`及配套adapters生成Host/HostIO/serializer，真实I/O由消费者提供；`bank-p23`再由手写BankRuntime/directory拥有actor身份、缓存和生命周期。
- `bc-semantic-products`有独立ProductInvocationHostTemplate生产链；`bc-strict`的fixture Host/Entry与composition InvocationHostTemplate是另一路合同，不能混同两类生成。
- `js-run-all-strict`保留独立strict source/fixture composition入口；本类别`saga-strict`兼容标签没有唯一Host producer，只作reference-only，不代表库会生成应用host。
- 生成的Host不是StrictSagaCoordinator内部状态机，后者始终由运行库提供。

逐profile的生产链、模块与证据见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)。P23冻结、银行未采用R2及OPEN retry政策保持不变。

## 结构与命名

<Name>Host/HostIO/HostSerializer与Definition/TechnicalPorts组合；当前下划线名字是生成债，不允许直接改冻结类消红。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

使用共享strict coordinator，结果未知与终态分开；持久化交付后才能推进父Run，临时observer不拥有唯一业务副作用。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

启动/结果ACK丢失、同ID异body、确认重放、actor/JVM不同级别恢复分别验收。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

完整profile及reference-only兼容标签见本页生产说明与矩阵；不能把库标签当作独立Host producer。测试源码不等actor/JVM恢复证据；P23冻结，最终模板批准未授予。

- `js:generators/scala-cqrs-application/render-invocation-host.mjs` — `renderInvocationHosts`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/products/ProductInvocationHostTemplate.scala` — `generate`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/products/ProductHostIOTemplate.scala` — `generate`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/FixtureHostTemplate.scala` — `generateFiles`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/InvocationHostTemplate.scala` — `generateFiles`。
- `js:generators/saga-dsl/emit-strict-host.mjs` — `emitStrictHostFiles`。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；真实I/O和actor owner仍须独立实现。

### 类别依赖

`strict-saga-coordinator`、`strict-saga-definition`、`external-event-bridge`。这些是职责依赖，不代替真实Scala import或执行顺序验证。

## 第七批 Strict Saga / Monarch R2 生成入口

新增 `js-saga-monarch-r2-candidate-v1`，由 `scala-cqrs-saga-monarch-v1` 提供。此前“未建立原生生成”的描述保留为原基线，不能覆盖本段明确的新非银行入口。

- `strict-saga-bridge`：Two-resource serial TCC definition and typed phase bridges consuming fixed Strict Saga artifact; original association, query, result delivery and authorized bounded recovery.
- `application-root`：Typed construction of captured external providers and Run Leaves/Hosts, caller-owned lifecycle and finite authorized recovery/resume of original batches.

输入来自唯一作者树与显式技术/外置实现 bindings；运行库接口及内核仍由冻结制品提供。implemented 表示生成实现存在；资格仅由匹配实际输入的独立验收决定，旧28回执不改签。范围、两阶段恢复、重试耗尽与安装边界见[本族合同](../../SAGA-MONARCH-R2.md)。不表示银行迁移或架构批准。
