# 旧Saga事务上下文

类别：`saga-legacy-context`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

承载旧TCC协调过程中需要的业务参数与上下文，不混用strict TransactionIdentity/receipt上下文。

## 输入与人工信息

上下文字段、参与者引用/重建及serializer规则由旧schema与架构元数据提供。

## 生产与所有权

- `bc-single`的SagaContextTemplate实际生成带应用repository引用的Context；运行库只消费泛型上下文C。`saga-legacy`在本类别是历史角色参考，不是假定一个库内具体Context。
- `bc-multi`保留真实路由缺口：`targetModuleOf`未映射`saga-context`，`writeArtifact`的None分支使用空prefix，落到`<target>/<package-path>/<name>.scala`，不是`modules/glue`；不能报告完整多模块接线。
- `js-legacy`保留显式spec的参考用途，但`generate(mode=legacy)`确实输出Args/Context/definition/register Scala；它不归静态报告。`play-legacy`是已有手写应用上下文。

逐profile的生命周期、产物与模块缺口见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)。strict canonical args/receipt不沿用legacy上下文语义。

## 结构与命名

<Saga>Context等旧定义；当前strict路径使用canonical args bytes与持久plan，不复制旧可变上下文设计。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

由旧transactor/step executor消费；旧journal不可直接交给strict namespace解析。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

上下文往返、参与者重建和旧事件恢复，不能把legacy字段升级为新保证。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

BC单/多模块、JS参考生成入口和Play手写实例按profile区分；multi模式的未映射路径缺口保留。测试源码不等生成/恢复已执行，也不授予最终批准。

- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/SagaContextTemplate.scala` — `generate`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala` — `targetModuleOf`、`writeArtifact`。
- `js:generators/saga-dsl/emit.mjs` — `emitLegacySagaSpec`。
- `saga:src/main/scala/net/imadz/infra/saga/dsl/SagaDefinition.scala` — `SagaDefinition`（消费上下文的库合同）。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；legacy上下文不升级为strict回执上下文。
