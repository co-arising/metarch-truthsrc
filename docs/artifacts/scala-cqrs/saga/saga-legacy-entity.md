# 旧Saga实体与状态

类别：`saga-legacy-entity`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

记录旧协调器/阶段executor的状态和事件演进。它不是应用需要每次重新生成的通用引擎。

## 输入与人工信息

旧协议、状态图、retry/backoff和人工恢复规则由该运行库提供，应用只选择合法参数与参与者。

## 生产与所有权

由列出的生产者/实现提供。BC的Scala结构与JS最终写入者必须一起判断；同文件后续JS覆写时，最终台账行归最后写入者。当前银行兼容profile只按实际已有产物标识，不由旧文档推定能力。

目录状态：`implemented`；所有权：`library`。生成文件通过公共生成/更新通道维护；独立手写实现不是生成结果的可编辑副本。

## 结构与命名

SagaTransactionCoordinator/StepExecutor及事件handler；Play历史SagaEntity文档作为旧profile，不用来规定strict状态。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

由SagaRunner/参与者/旧persistence adapters组合；生成器不得复制一套稍有差异的运行内核。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

旧状态机/恢复/序列化测试；新strict测试不替代旧协议兼容验收。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

适用：saga-legacy。旧Saga DSL/TCC与当前strict API是并列合同；不能把strict证据和恢复保证套用旧StepExecutor。

- `saga:src/main/scala/net/imadz/infra/saga/SagaTransactionCoordinator.scala` — `SagaTransactionCoordinator`。
- `saga:src/main/scala/net/imadz/infra/saga/StepExecutor.scala` — `StepExecutor`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。
