# 耐久外部操作协调器

类别：`persistent-operation`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

保存原操作意图、发送/进行中/查证、预算与确证结果。此状态机由运行库提供，不生成应用私有副本。

## 输入与人工信息

冻结Request、真实ExternalOperationPort、OperationSettings和可靠journal，单操作单有效writer。

## 生产与所有权

`monarch-r1`提供PersistentOperation协调器，`monarch-r2`保留并组合该机制；均由`monarch-persistence`运行库提供，不是生成的应用私有状态机。

真实ExternalOperationPort、冻结请求及证据政策仍由应用提供，未建立原生JS/BC具体业务生成链。P23生成EffectHost是另一宿主合同，不等已消费PersistentOperation，更不证明银行采用R2。

逐profile的库/应用边界见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)。技术重传/预算不关闭银行业务retry/backoff/deadline的OPEN项。

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

R1机制在R2保留，P23 EffectHost不与其合并。测试源码不等跨进程/外部账本行为已验证；银行未采用R2，业务OPEN项和最终批准边界不变。

- `monarch:src/main/scala/net/imadz/monarch/persistence/operation/PersistentOperation.scala` — `PersistentOperation`。
- `monarch:src/main/scala/net/imadz/monarch/persistence/operation/OperationProtocol.scala` — `OperationProtocol`。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；本页摘录不是生产认证。

### 类别依赖

`external-operation-connector`、`monarch-wire-settings`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
