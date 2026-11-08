# 事件日志读取端口与适配

类别：`journal-port-adapter`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

为恢复和读侧提供namespace限定的日志读取，不允许把读取回调升级为修改journal的接口。

## 输入与人工信息

日志插件、事件/envelope形状、PID namespace、当前读取/持续订阅选择是技术输入。

## 生产与所有权

bank-p23的BankJournal/BankJournalEnvelope与BankPersistenceJournal是外置手写合同和实现；后者包装PersistenceQuery及namespace限定的轮询流。生成器不拥有该银行日志适配体。

JS正式Play service的render-journal-readside.mjs#renderProjection按显式service.projectionStore及流/存储元数据，真实生成infrastructure/projection/<Store>Projection.scala中的Journal trait和Envelope。它提供读侧所需端口与载体，不生成PersistenceQuery实现；BankReadside负责把手写BankJournal适配进去。

各profile的接口生成、手写实现和接缝见[能力矩阵](../../CAPABILITY-MATRIX.md)。接口可生成不等于日志读取、恢复订阅、目标编译或最终批准已在本轮执行。

## 结构与命名

BankJournal/BankPersistenceJournal/BankJournalEnvelope分别是手写端口、实现和载体；生成读侧<Store>Projection对象另含Journal与Envelope，经BankReadside适配。两组合同不能因同样叫Journal就当成一个生成器拥有的文件。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

被读侧projection、可信receipt查询和恢复消费；必须按原业务身份读取，不能以新namespace空日志解释旧请求未执行。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

PID隔离、顺序/offset、恢复读取/订阅、错误不可用与停止行为。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

主要实例：bank-p23手写日志适配及js-formal生成Journal/Envelope。生成的端口/载体与PersistenceQuery实现分别拥有来源，不能将二者合称全部生成。

- `bank:handwritten/scala/example/bankwealth/integration/BankJournal.scala` — `BankJournal / BankJournalEnvelope`。
- `bank:handwritten/scala/example/bankwealth/integration/BankPersistenceJournal.scala` — `BankPersistenceJournal`。
- `js:generators/scala-cqrs-play-service/render-journal-readside.mjs` — `renderProjection / renderJournalReadside`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

## 第六批有限 persistence-readside 候选登记

本类新增 `js-persistence-readside-candidate-v1`，由显式 `scala-cqrs-persistence-readside-v1`／`scala-cqrs-persistence-readside@1` 提供；模块为 `glue`。本段只登记实际源结构，不宣称本批已完成或已编译。

实际输出合同（可覆盖同一物理文件中的不同职责，不按合同数冒充文件数）

- `readside-event-source`／`event-source`：Bounded EventSource interface and JDBC reader of already persisted event-cache rows. No Akka journal plugin, external-event authority or production journal durability claim. 路径 `modules/glue/src/main/scala/**/infrastructure/readside/*.scala`。

输入为唯一业务作者树、原七个 family2 产品及显式 persistence-readside 技术 binding；wire layout SHA 必须核对，不能自动重签。沿用 family2 kernel/glue 和唯一 writer；生成测试与独立 oracle 分开，sbt 定义存在不等任务执行。

本次登记移除旧 active evidence 引用，原24观察和旧回执在[独立历史索引](../../evidence/capability-persistence-readside-prior-current06-history.json)保真；新观察要在生产冻结后单独采集并通过原公共验证器。本段及目录 implemented 仅表示实现存在，当前 generated/compiled/behavior/final-approved 不由本配方晋升。范围与限制见[本族合同](../PERSISTENCE-READSIDE.md)。

读侧文件库重放不是生产 Actor journal 耐久性；不扩张为 MySQL、任意读模型、HTTP、银行/Saga/Monarch 或架构批准。
