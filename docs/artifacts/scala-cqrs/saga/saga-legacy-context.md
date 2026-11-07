# 旧Saga事务上下文

类别：`saga-legacy-context`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

承载旧TCC协调过程中需要的业务参数与上下文，不混用strict TransactionIdentity/receipt上下文。

## 输入与人工信息

上下文字段、参与者引用/重建及serializer规则由旧schema与架构元数据提供。

## 生产与所有权

由列出的生产者/实现提供。BC的Scala结构与JS最终写入者必须一起判断；同文件后续JS覆写时，最终台账行归最后写入者。当前银行兼容profile只按实际已有产物标识，不由旧文档推定能力。

目录状态：`implemented`；所有权：`mixed`。生成文件通过公共生成/更新通道维护；独立手写实现不是生成结果的可编辑副本。

## 结构与命名

<Saga>Context等旧定义；当前strict路径使用canonical args bytes与持久plan，不复制旧可变上下文设计。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

由旧transactor/step executor消费；旧journal不可直接交给strict namespace解析。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

上下文往返、参与者重建和旧事件恢复，不能把legacy字段升级为新保证。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

适用：saga-legacy / bc-single。旧Saga DSL/TCC与当前strict API是并列合同；不能把strict证据和恢复保证套用旧StepExecutor。

- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/SagaContextTemplate.scala` — `SagaContextTemplate`。
- `saga:src/main/scala/net/imadz/infra/saga/dsl/SagaDefinition.scala` — `SagaDefinition`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。
