# 历史Fab流程编排与动态路由

类别：`legacy-flow-orchestration`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

记录Play历史Fab动态流程、Route/OCAP决策、执行actor及阶段构造的职责，避免将已有代码因旧artifact清单没列出而漏掉。它不是当前Monarch R2的新workflow profile。

## 输入与人工信息

工艺路线、条件表达式、设备/lot选择、OCAP行为和恢复依据来自该演示的显式定义/实现；不能从银行四流反推。

## 生产与所有权

由列出的生产者/实现提供。BC的Scala结构与JS最终写入者必须一起判断；同文件后续JS覆写时，最终台账行归最后写入者。当前银行兼容profile只按实际已有产物标识，不由旧文档推定能力。

目录状态：`reference-only`；所有权：`handwritten`。生成文件通过公共生成/更新通道维护；独立手写实现不是生成结果的可编辑副本。

## 结构与命名

RouteDefinition/Compiler/Validator、DynamicFlowAssembler、FabPipelineProcessor/ExecutionActor、MetricResolver等分成数据、纯判定和编排适配，当前为手写演进而非JS正式产物。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

编排依赖Saga/设备adapter，状态与observer/UI事件分开；当前演示恢复边界必须按实际代码和独立测试判断，不据旧注释冒整个JVM保证。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

路由/条件、顺序/副作用、重复执行和恢复的独立业务场景；文档覆盖不宣称这些历史例子已经打通或等价R2。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

适用：play-legacy。单模块和多模块是放置/装配变体，不是两套业务事实。BANK P23兼容层与BC目标模板可能保留具名差异；没有把R2运行库能力写成当前银行生成支持。

- `play:app/net/imadz/application/chain/FabPipelineExecutionActor.scala` — `FabPipelineExecutionActor`。
- `play:app/net/imadz/domain/routing/RouteDefinition.scala` — `RouteDefinition`。
- `play:app/net/imadz/application/routing/OcapEngine.scala` — `OcapEngine`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。
