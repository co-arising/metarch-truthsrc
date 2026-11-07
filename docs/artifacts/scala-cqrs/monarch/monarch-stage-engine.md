# Monarch顺序阶段引擎与解释器

类别：`monarch-stage-engine`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

在Future上执行有限顺序stage queue，提供游标/插入阶段/generation fencing；它不是Saga跨聚合事务协调器。

## 输入与人工信息

宿主提供stage类型、解释器、状态和生命周期回调。插入阶段规则与幂等性由实际业务合同给出。

## 生产与所有权

`monarch-legacy`、`monarch-r1`和`monarch-r2`在本类别均消费`monarch-core`的共享执行机制；库实现不是每条业务流水线生成的源码。`MonarchTypes.scala`中的`StageInterpreter`和`LifecycleHooks`是接口依据，泛型参数`Stage`不能当作独立类型声明引用。

具体业务stage ADT、顺序及解释器实现归[monarch-execution-plan](monarch-execution-plan.md)或应用手写代码。库能力、应用生成与实际行为证据分别记录在[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)，不以R2库存在推断银行采用或跨JVM fencing。

## 结构与命名

Monarch/MonarchBuilder/StageError/CallbackHooks/AsyncCheckpointHooks以及本地RunLease/RunRegistry为库构件；每个业务流程不再生成一套引擎。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

core无Akka依赖；持久化由外层wrapper提供。本地generation guard不等跨JVM分布式fencing。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

阶段次序、resume cursor、动态插入、旧callback拒绝、有限生命周期；副作用幂等由宿主另验。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

monarch-legacy/R1/R2均在此引用库执行机制，业务stage定义另列。测试源码不等执行证据，generation guard不升级为跨JVM保证；本页不授予最终批准。

- `monarch-core:src/main/scala/net/imadz/monarch/Monarch.scala` — `Monarch`。
- `monarch-core:src/main/scala/net/imadz/monarch/MonarchTypes.scala` — `StageInterpreter`、`LifecycleHooks`。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；银行仍P23，未采用R2。
