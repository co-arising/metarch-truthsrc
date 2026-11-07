# 旧Saga实体与状态

类别：`saga-legacy-entity`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

记录旧协调器/阶段executor的状态和事件演进。它不是应用需要每次重新生成的通用引擎。

## 输入与人工信息

旧协议、状态图、retry/backoff和人工恢复规则由该运行库提供，应用只选择合法参数与参与者。

## 生产与所有权

`saga-legacy`消费saga-core的SagaTransactionCoordinator/StepExecutor及其事件状态机制，责任为`consume-library`。BC scaffold保留静态runtime源码提供方式，但复制公共库源码不是按每个业务生成一个私有协调状态机。

Play历史实体文档是旧架构参考，不定义strict内核。逐profile和证据边界见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)；库实现/测试源码存在不证明当前应用编译、恢复或最终验收。

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

`saga-legacy`是旧运行库合同；当前strict API和旧DSL/TCC分别举证，不能交叉套用恢复保证。测试源码不等执行证据，最终批准未授予。

- `saga:src/main/scala/net/imadz/infra/saga/SagaTransactionCoordinator.scala` — `SagaTransactionCoordinator`。
- `saga:src/main/scala/net/imadz/infra/saga/StepExecutor.scala` — `StepExecutor`。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；BC静态runtime提供不算按业务生成。
