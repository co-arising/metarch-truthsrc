# 有限批作业协调内核

类别：`batch-coordinator`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

持久化输入、封批、资源/交接、子结果分类、逐项execution/lineage和排空。库提供内核，应用不复制。

## 输入与人工信息

BatchDefinition、resource/inbox/ExecutionPort和有限设置；业务完成证明仍来自宿主/外部。

## 生产与所有权

`monarch-r2`消费`monarch-persistence`提供的`BatchCoordinator`、协议、状态及progress机制，责任为`consume-library`，不生成每个业务自己的协调器。

应用仍须提供具体BatchDefinition、输入源、配置和执行端口；已定位库实现不等已定位JS/BC原生R2 producer，更不等银行已接入。`InputClosed`、`Drained`与全部成功是不同事实。

逐profile的责任和证据级别见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)。银行保持P23冻结，R2能力不反向成为旧产物的恢复保证。

## 结构与命名

BatchProtocol/State/Coordinator/Progress/Serializer；Get提供已提交分页视图，InputClosed不等Drained，Drained不等全部成功。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

所有效果经Monarch Run/Operation，prepare/classify只纯映射；retry/route保留ItemId并增加相应execution。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

只失败子集重试、资源持有/移交、EOF后内部续行、Held不假排空、再次重启与总量守恒。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

`monarch-r2`提供本页库机制，R1不含BatchCoordinator；应用definition/输入是另一责任。银行保持P23冻结，未采用R2。测试源码不等行为验证，库存在不构成最终批准。

- `monarch:src/main/scala/net/imadz/monarch/persistence/batch/BatchCoordinator.scala` — `BatchCoordinator`。
- `monarch:src/main/scala/net/imadz/monarch/persistence/batch/BatchProgress.scala` — `BatchProgress`。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；本页摘录不是生产认证。

### 类别依赖

`batch-definition`、`resource-domain`、`durable-inbox`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
