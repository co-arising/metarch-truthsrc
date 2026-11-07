# 耐久外部操作协调器

类别：`persistent-operation`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

保存原操作意图、发送/进行中/查证、预算与确证结果。此状态机由运行库提供，不生成应用私有副本。

## 输入与人工信息

冻结Request、真实ExternalOperationPort、OperationSettings和可靠journal，单操作单有效writer。

## 生产与所有权

由列出的生产者/实现提供。BC的Scala结构与JS最终写入者必须一起判断；同文件后续JS覆写时，最终台账行归最后写入者。当前银行兼容profile只按实际已有产物标识，不由旧文档推定能力。

目录状态：`implemented`；所有权：`library`。生成文件通过公共生成/更新通道维护；独立手写实现不是生成结果的可编辑副本。

## 结构与命名

Prepared/Dispatching/Ongoing/Reconciling/Blocked/Succeeded/Failed/RecoveryBlocked与协议/序列化；状态与业务操作不是同一层。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

Prepared和DispatchStarted提交后才调用外部；恢复先query同请求，不随超时盲发。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

外部账本/进程故障、live-call有限性、预算跨重启保存、已确证结果重复查询。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

适用：monarch-r1 / monarch-r2。R1/R2公开运行库有对应实现；当前银行生成仍锁P23，不宣称JS原生R2生成、兼容旧journal或生产认证。

- `monarch:src/main/scala/net/imadz/monarch/persistence/operation/PersistentOperation.scala` — `PersistentOperation`。
- `monarch:src/main/scala/net/imadz/monarch/persistence/operation/OperationProtocol.scala` — `OperationProtocol`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 类别依赖

`external-operation-connector`、`monarch-wire-settings`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
