# 知识服务重建与查询适配

类别：`truth-rebuild-adapter`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

连接既有服务的知识日志、读侧重建和查询职责，区别于本地文件编译器。

## 输入与人工信息

服务知识空间/版本/权限、读取和重放流程由应用合同提供，不混用file-graph/tenant-graph。

## 生产与所有权

`di-poc`是reference范围的手写应用集成，实际仓库为`/Users/zhongdj/Workspaces/di-poc`。`TruthProjectionRebuilder`、`KnJournalService`等实现位于`modules/ext`，不是公共JS工具模块或自动生成的知识服务。

glue存储和root HTTP壳是独立依赖，不能把ext职责扩展为整个服务已就绪。本页只定位源码；没有读取知识journal、执行重放或验证部署，也不使服务成为本地文件优先闭环的前置条件。

逐profile的责任、模块与证据级别见[CAPABILITY-MATRIX.md](../CAPABILITY-MATRIX.md)。

## 结构与命名

ext中的TruthCanonicalJson/ProjectionSource/Rebuilder/MetarchRebuild及KnJournal/Reason服务；底层存储机制在glue，HTTP壳在root。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

消费kernel契约和glue存储，不将知识服务强加给JS本地最小使用；不是当前银行所需组件。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

空间隔离、重放完整性/权限/错误回报，与业务运行日志分离。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

`di-poc`仅说明ext中的手写应用参考实现，不代表公共JS或银行已经消费。测试源码不等服务执行/重放证据，也不构成最终批准。

- `dipoc:modules/ext/src/main/scala/net/imadz/metarch/truth/TruthProjectionRebuilder.scala` — `TruthProjectionRebuilder`。
- `dipoc:modules/ext/src/main/scala/net/imadz/metarch/application/kb/KnJournalService.scala` — `KnJournalService`。

来源revision、摘要及处置见[sources.lock.json](../sources.lock.json)；本页不读取知识journal或认证当前部署。
