# Monarch协议序列化与有限配置

类别：`monarch-wire-settings`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

提供Run/Operation/Resource/Delivery/Batch各自wire、converter、serializer和资源/预算限制；不与应用业务StateCodec合并。

## 输入与人工信息

库固定协议ID/版本，上层只能在允许范围选择设置，不能提高任意限额绕过wire ceiling。

## 生产与所有权

由列出的生产者/实现提供。BC的Scala结构与JS最终写入者必须一起判断；同文件后续JS覆写时，最终台账行归最后写入者。当前银行兼容profile只按实际已有产物标识，不由旧文档推定能力。

目录状态：`implemented`；所有权：`library`。生成文件通过公共生成/更新通道维护；独立手写实现不是生成结果的可编辑副本。

## 结构与命名

legacy E1/S1与扩展E2/S2、Run/Operation/Resource/Delivery/Batch不同manifest系列；只绑定具体Wire不绑定内部callback命令。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

配置从reference.conf及对应子配置读取，版本/connector/codecs不兼容时RecoveryBlocked而非静默丢字段。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

每族wire往返/上限、旧终态结果缺失、超限分页与配置漂移；现有候选不可原版本重发。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

适用：monarch-legacy / monarch-r1 / monarch-r2。R1/R2公开运行库有对应实现；当前银行生成仍锁P23，不宣称JS原生R2生成、兼容旧journal或生产认证。

- `monarch:src/main/protobuf/monarch.proto` — `syntax`。
- `monarch:src/main/protobuf/operation.proto` — `syntax`。
- `monarch:src/main/protobuf/resource.proto` — `syntax`。
- `monarch:src/main/protobuf/delivery.proto` — `syntax`。
- `monarch:src/main/protobuf/batch.proto` — `syntax`。
- `monarch:src/main/scala/net/imadz/monarch/persistence/ProtocolLimits.scala` — `ProtocolLimits`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。
