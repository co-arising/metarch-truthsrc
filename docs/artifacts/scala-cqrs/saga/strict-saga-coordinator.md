# Strict事务协调内核

类别：`strict-saga-coordinator`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

持久化事务决定、阶段证据和恢复状态，驱动严格Prepare/Commit/Compensate。库负责内核，应用不生成第二套。

## 输入与人工信息

已固定Definition、真实阶段port、有限interaction设置和ReconcileAuthorizer；业务重试/backoff需下游合同实际实现。

## 生产与所有权

`saga-strict`消费saga-core的StrictSagaCoordinator及StrictState/StrictEvent共享状态机，责任为`consume-library`。应用生成Definition/Module/Host是在装配该库，不是生成每笔业务私有的严格协调内核。

库的interaction/查证机制与业务retry/backoff/deadline分别判定，银行对应政策保持OPEN；旧StepExecutor的重试能力也不能证明strict已追平。逐profile和证据级别见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)。P23冻结及银行未采用Monarch R2的结论不变。

## 结构与命名

StrictSagaCoordinator的事件/状态/命令在库内，应用提供factory/bootstrap。已作Commit决定不能改为abort。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

未知先查证，RecoveryRequired与人工授权不等业务失败；技术核实不得换交易ID制造第二笔。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

确定决定、恢复期间再次崩溃、receipt身份、unknown与安全未执行路径；不能从旧StepExecutor重试代码推断strict已追平。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页`saga-strict`是运行库能力，银行P23消费合同仍冻结；Monarch R2不自动升级Saga或retry/backoff/deadline。测试源码不等协调行为证据，最终批准未授予。

- `saga:src/main/scala/net/imadz/infra/saga/strict/StrictSagaCoordinator.scala` — `StrictSagaCoordinator`。
- `saga:src/main/scala/net/imadz/infra/saga/strict/StrictSagaModel.scala` — `StrictState`、`StrictEvent`。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；应用接线不算内核生成。

### 类别依赖

`strict-saga-definition`、`saga-wire`、`saga-serializer`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
