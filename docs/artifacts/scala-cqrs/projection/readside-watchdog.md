# 读侧水位与生命周期监控

类别：`readside-watchdog`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

观察投影水位、队列/错误与关闭状态，区分正在追平、失败、未初始化和已追平。不能通过延长timeout自动洗掉真实失败。

## 输入与人工信息

可信来源水位、checkpoint、超时/重试边界与诊断策略由运行合同提供。

## 生产与所有权

- `js-formal`：`renderJournalReadside` 生成通用发现、watch/poll、失效及 catch-up/关闭机制。
- `bank-p23`：手写 `BankReadside` 负责银行身份、ownership 与查询语义，并委托生成投影的 catchUp；这些业务责任不由通用 watchdog 推导。
- 两者均不能证明所有当前及未来 PID 已全局追平。已有 readiness/replay 失败记录必须保留，本轮不调整 deadline、retry 或 backoff 来改变结论。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

ProjectionTailWatchdog或生成Projection的ready/catchUp/shutdown接口；监控可在glue或宿主，不能推进金融业务状态。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

依赖查询/调度机制与实际checkpoint，不在查询页面偷偷reconcile或制造完成。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

新读库重放、停摆/毒事件/慢积压区分、停止排空；BANK当前replay90秒门仍失败，文档不修改该回执。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。
