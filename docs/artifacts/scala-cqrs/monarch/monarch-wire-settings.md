# Monarch协议序列化与有限配置

类别：`monarch-wire-settings`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

提供Run/Operation/Resource/Delivery/Batch各自wire、converter、serializer和资源/预算限制；不与应用业务StateCodec合并。

## 输入与人工信息

库固定协议ID/版本，上层只能在允许范围选择设置，不能提高任意限额绕过wire ceiling。

## 生产与所有权

- `monarch-legacy`消费库的旧E1/S1/R1格式；manifest字符串`R1`不是里程碑R1。
- `monarch-r1`增加E2/S2、Run/Operation协议及serializer，并保留旧reader；`monarch-r2`在其上增加Resource/Delivery/Batch协议。不能用当前R2工作树字节替代先前冻结制品证据。
- 各profile的通用wire/serializer/reference设置均为`consume-library`；应用配置绑定是装配，具体业务StateCodec和宿主proto属于独立应用产物。

逐profile及来源证据见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)。银行仍锁P23，不借格式说明授权旧journal迁移或原版本重发。

## 结构与命名

legacy E1/S1/R1、里程碑R1的E2/S2及Run/Operation、R2的Resource/Delivery/Batch是不同格式族；旧manifest `R1`不等里程碑R1。只绑定具体Wire，不绑定内部callback命令。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

配置从reference.conf及对应子配置读取，版本/connector/codecs不兼容时RecoveryBlocked而非静默丢字段。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

每族wire往返/上限、旧终态结果缺失、超限分页与配置漂移；现有候选不可原版本重发。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

legacy、R1、R2协议按各自引入范围及冻结制品解释；当前源码不是历史制品摘要的替代。测试源码不等往返已执行或旧journal可迁移；银行P23不升级，最终批准未授予。

- `monarch:src/main/scala/net/imadz/monarch/persistence/MonarchSerializer.scala` — `MonarchSerializer`。
- `monarch:src/main/scala/net/imadz/monarch/persistence/RunProtocolSerializer.scala` — `RunProtocolSerializer`（R1起）。
- `monarch:src/main/scala/net/imadz/monarch/persistence/operation/OperationSerializer.scala` — `OperationSerializer`（R1起）。
- `monarch:src/main/protobuf/monarch.proto`、`operation.proto` — R1对应协议；resource/delivery/batch三个schema为R2扩展。
- `monarch:src/main/resources/reference.conf` — `serialization-bindings`。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；wire名称不等里程碑名称。
