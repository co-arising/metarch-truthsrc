# 生成的有限执行计划

类别：`monarch-execution-plan`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

将显式pipeline转换成有限stage列表、输入/输出、StateCodec和invocation桥；它消费引擎，不是引擎本身。

## 输入与人工信息

planVersion、stepID、输入输出来源、outcome分类和并发限制必须明确。未知副作用不能降低成纯stage。

## 生产与所有权

- `js-formal`由`renderExecutionPlans`/`renderInvocationExecution`生成业务stage、Request/Result/State、StateCodec及旧PersistentMonarch wrapper；`bank-p23`由银行作者树/绑定经该正式链消费，冻结边界不变。
- `bc-semantic-products`有独立ProductApplicationBuilder/Model及ProductExecutionTemplate/ProductInvocationExecutionTemplate，经`generateProducts`写出；不是引用JS renderer就获得BC能力。
- `js-legacy`的monarch-dsl直接emitter生成stage ADT/chain、业务state、JSON StateCodec和解释器；`js-run-all-strict`生成composition child Plan。它们保留旧入口/合同，不等正式R2支持。

这些是`generate-code`的应用产物，共享Monarch引擎仍由库提供。逐profile见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)；未建立原生R2生成或银行R2采用证据。

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

正式JS、bank-p23、独立BC semantic、legacy monarch-dsl及run-all composition按各自输入合同解释。测试源码不等生成/编译/行为证据；P23不升级R2，模板最终批准仍未授予。

- `js:generators/scala-cqrs-application/render-execution.mjs` — `renderExecutionPlans`。
- `js:generators/scala-cqrs-application/render-invocation-execution.mjs` — `renderInvocationExecution`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/products/ProductExecutionTemplate.scala` — `generate`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/products/ProductInvocationExecutionTemplate.scala` — `generate`。
- `js:generators/monarch-dsl/emit.mjs` — `emitStageType`、`emitStateType`、`emitInterpreter`。
- `js:generators/saga-dsl/emit-invocation-plan.mjs` — `emitMonarchPlan`。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；应用plan不等共享引擎。

### 类别依赖

`monarch-checkpoint-host`、`monarch-state-codec`、`saga-invocation-host`、`effect-host`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
