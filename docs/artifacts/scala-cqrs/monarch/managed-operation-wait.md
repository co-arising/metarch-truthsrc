# 受管理的外部操作等待

类别：`managed-operation-wait`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

把Run当前stage的等待关联到同一个耐久Operation。本地scope/Promise可丢，Operation身份/结果不能丢。

## 输入与人工信息

稳定OperationKey/不可变Request、resolver、有界等待许可、查询设置显式提供。

## 生产与所有权

`monarch-r1`提供ManagedStageScope/managedBehavior库机制，`monarch-r2`继续保留该机制；两个profile均为`consume-library`，不是应用生成器。

当前正式JS/P23 Execution wrapper调用旧`PersistentMonarch.behavior`，不能宣称已经消费managed等待API。技术等待/查询预算不关闭银行业务retry/backoff/deadline的OPEN项。

逐profile及实际装配证据见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)。保持P23冻结；库机制测试与银行跨JVM业务恢复分开验收。

## 结构与命名

ManagedStageScope/ManagedOperations与managedBehavior；每stage最多一个外部操作，重复await只能是同请求。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

RunAwaiting提交后操作才进入耐久执行，确证终态后stage checkpoint；吞掉未确证等待不允许成功推进。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

重启重新挂接、解释器提前返回/改请求拒绝、预算与异步生命周期，未知结果不会当成业务失败。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

R1机制在R2中保留，不代表P23已消费managed API；具体profile见派生矩阵。测试源码不是执行证据，也不关闭OPEN业务retry项或授予最终批准。

- `monarch:src/main/scala/net/imadz/monarch/persistence/ManagedRunScope.scala` — `ManagedStageScope`。
- `monarch:src/main/scala/net/imadz/monarch/persistence/PersistentMonarch.scala` — `managedBehavior`。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；银行继续锁P23，未采用R2。

### 类别依赖

`persistent-operation`、`run-definition-submission`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
