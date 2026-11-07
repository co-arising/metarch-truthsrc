# 设备与场景模拟Actor

类别：`simulation-actor`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

为历史Fab演示提供设备区、场景和观测事件，不是生产设备安全控制器。

## 输入与人工信息

模拟状态、时间、动作和事件来源必须明确，实际设备/账本证据另行验证。

## 生产与所有权

- `play-legacy`：EquipmentAreaActor、FabSimulationScenario 等来自历史 Play 手写实现，在本目录仅作 reference-only。
- 未建立这些具体 Fab actor 的原生 JS/BC producer；不能因为它们参与演示，就声称生成了模拟运行库或验证了真实设备行为。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

EquipmentAreaActor、场景模型、MeasurementClassifier、SimulationEvent/Envelope与publisher；有状态模拟和纯分类分开。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

通过正常应用/actor接口连接流程，不把UI广播当业务持久化完成；模拟重启能力不自动证明真实JVM/外部服务恢复。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

设备状态转移、故障/重复/时钟、场景结果与实际持久化边界；不将模拟器类别误作已生成runtime。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。
