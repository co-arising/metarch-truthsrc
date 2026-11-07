# 耐久交接Inbox与Delivery

类别：`durable-inbox`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

持久接管DeliveryId和不可变子RunSubmission，再按稳定身份启动/查询子任务。Accepted仅表示接管，不是业务完成。

## 输入与人工信息

Delivery身份、原提交fingerprint、RunSubmissionPort与有限DeliverySettings由宿主提供。

## 生产与所有权

`monarch-r2`的PersistentInbox/Delivery是`monarch-persistence`提供的库机制；应用提供不可变RunSubmission、路由和配置，不生成另一套inbox协调器。

P23生成ChildHost/ChildJournal仍消费旧StartRun路径，不因具有父子身份或等待语义就获得R2接管/交付保证。这里没有确立JS/BC原生R2生产链，也不宣称银行采用R2。

逐profile的库消费和应用责任见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)。库可用、应用装配及真实交付行为分别举证。

## 结构与命名

PersistentInbox/DeliveryProtocol/State/Client/Serializer是库机制；应用只提供路由和业务提交。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

ChildStartIntent与ChildTerminalRecorded分开持久化，父级用确证子终态结算，丢ACK不能制造第二子Run。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

接管前后/启动意图/子终态ACK各窗口、同ID冲突、预算耗尽与显式reconcile。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页PersistentInbox/Delivery/RunSubmission属于R2，不属于R1或P23 child wrapper。银行继续冻结P23、未采用R2；测试源码存在不等交接行为已验证，也不授予最终批准。

- `monarch:src/main/scala/net/imadz/monarch/persistence/delivery/PersistentInbox.scala` — `PersistentInbox`。
- `monarch:src/main/scala/net/imadz/monarch/persistence/delivery/DeliveryClient.scala` — `DeliveryClient`。
- `monarch:src/main/scala/net/imadz/monarch/persistence/RunSubmission.scala` — `RunSubmission`（R2）。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；不承诺旧journal迁移。

### 类别依赖

`run-definition-submission`、`monarch-wire-settings`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
