# Saga耐久调用与结果交付宿主

类别：`saga-invocation-host`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

冻结调用原文、启动关联、阶段结果与结果交付，连接Monarch步骤和严格Saga。宿主不替代事务协调内核。

## 输入与人工信息

输入/transaction ID derivation、owner、结果分类、outcome producer和receipt确认都需显式。

## 生产与所有权

由列出的生产者/实现提供。BC的Scala结构与JS最终写入者必须一起判断；同文件后续JS覆写时，最终台账行归最后写入者。当前银行兼容profile只按实际已有产物标识，不由旧文档推定能力。

目录状态：`implemented`；所有权：`mixed`。生成文件通过公共生成/更新通道维护；独立手写实现不是生成结果的可编辑副本。

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

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

适用：saga-strict / bc-strict / js-formal / bank-p23。当前saga-core基线4352a317的strict API与银行P23消费有明确合同，Monarch R2不自动升级Saga政策或retry/backoff/deadline。

- `js:generators/scala-cqrs-application/render-invocation-host.mjs` — `renderInvocationHosts`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/InvocationHostTemplate.scala` — `InvocationHostTemplate`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 类别依赖

`strict-saga-coordinator`、`strict-saga-definition`、`external-event-bridge`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
