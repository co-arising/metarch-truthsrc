# PersistentMonarch持久化宿主

类别：`monarch-checkpoint-host`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

持久化stage状态/完成游标并在恢复后接续执行。业务效果和checkpoint间隙可能重跑，不能据此称exactly-once。

## 输入与人工信息

稳定PID、stage列表、StateCodec与解释器、observer/确认政策显式提供。

## 生产与所有权

由列出的生产者/实现提供。BC的Scala结构与JS最终写入者必须一起判断；同文件后续JS覆写时，最终台账行归最后写入者。当前银行兼容profile只按实际已有产物标识，不由旧文档推定能力。

目录状态：`implemented`；所有权：`library`。生成文件通过公共生成/更新通道维护；独立手写实现不是生成结果的可编辑副本。

## 结构与命名

旧behavior/StartRun与新versionedBehavior/managedBehavior是不同API保证；当前P23生成Execution仍调用旧behavior。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

依赖Monarch core和journal；observer用于诊断/显示，不承载唯一业务副作用。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

checkpoint ACK、恢复游标、旧代回调/重复执行窗口与真实幂等性；不得用actor重启代替JVM恢复证明。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

适用：monarch-legacy / monarch-r1 / monarch-r2 / bank-p23。单模块和多模块是放置/装配变体，不是两套业务事实。BANK P23兼容层与BC目标模板可能保留具名差异；没有把R2运行库能力写成当前银行生成支持。

- `monarch:src/main/scala/net/imadz/monarch/persistence/PersistentMonarch.scala` — `PersistentMonarch`。
- `js:generators/scala-cqrs-application/render-invocation-execution.mjs` — `PersistentMonarch.behavior`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 类别依赖

`monarch-stage-engine`、`monarch-state-codec`、`monarch-wire-settings`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
