# 生成的有限执行计划

类别：`monarch-execution-plan`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

将显式pipeline转换成有限stage列表、输入/输出、StateCodec和invocation桥；它消费引擎，不是引擎本身。

## 输入与人工信息

planVersion、stepID、输入输出来源、outcome分类和并发限制必须明确。未知副作用不能降低成纯stage。

## 生产与所有权

由列出的生产者/实现提供。BC的Scala结构与JS最终写入者必须一起判断；同文件后续JS覆写时，最终台账行归最后写入者。当前银行兼容profile只按实际已有产物标识，不由旧文档推定能力。

目录状态：`implemented`；所有权：`generated`。生成文件通过公共生成/更新通道维护；独立手写实现不是生成结果的可编辑副本。

## 结构与命名

<Pipeline>Execution、Request/Result/State/Outputs及execution proto；当前下划线混合命名是生成策略债。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

使用Saga/effect/child host或纯port，confirmed-prefix和未知结果不能被跨过。R2库存在不代表此renderer已使用managed API。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

源码计划确定性、输入输出关联、坏outcome拒绝、真执行/恢复分层验证。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

适用：js-formal / bank-p23。单模块和多模块是放置/装配变体，不是两套业务事实。BANK P23兼容层与BC目标模板可能保留具名差异；没有把R2运行库能力写成当前银行生成支持。

- `js:generators/scala-cqrs-application/render-execution.mjs` — `renderExecutionPlans`。
- `js:generators/scala-cqrs-application/render-invocation-execution.mjs` — `renderInvocationExecution`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 类别依赖

`monarch-checkpoint-host`、`monarch-state-codec`、`saga-invocation-host`、`effect-host`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
