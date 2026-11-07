# Saga静态合同与阶段报告

类别：`saga-contract-report`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

输出Saga静态合同、阶段表和消费来源报告，供审阅/迁移。legacy模式的Scala确实存在，但属于应用context/definition/声明行为类别，不在本页算作报告，更不是已执行的资金事务。

## 输入与人工信息

原定义、版本、声明状态、来源以及静态编译合同；不能把runnable:false报告改成运行成功。

## 生产与所有权

- `js-contract-only`明确指`saga-dsl/generate.mjs`的`strict-contract`模式，派生contract/phases/consumption JSON，固定`readiness=contract-only`、`runnable=false`、`runtimeBindingVerified=false`。本类别旧`saga-strict`标签保留这条报告关联，不表示saga-core库在生成JSON。
- 旧`js-legacy` profile仅作reference-only历史关联，不在报告类别中计入Scala生成。legacy模式确实产生Args/Context/SagaDefinition/register源码，分别在[saga-legacy-context](saga-legacy-context.md)、[saga-transactor](saga-transactor.md)及[saga-legacy-behavior](saga-legacy-behavior.md)解释。
- `strict-scala`只在这个`generate` API内受阻；独立正式application及run-all strict producer确有Scala输出，不能把局部阻断扩大为整个工具链无strict生成能力。

逐profile的兼容标签、真实产物和证据级别见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)。报告通过不是运行验收或最终批准。

## 结构与命名

`contracts/sagas/<id>.contract.json`、`.phases.json`、`.consumption.json`分别承载合同、阶段表和静态消费报告，对应`saga-contract`、`saga-phase-table`、`saga-contract-ledger`。这些不是generation ledger或数据库journal；`saga-legacy-source`是另列的Scala产物。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

消费严格静态验证和显式导出入口，不允许查询报告顺带生成或启动服务。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

完整定义/顺序/来源保真、未知能力拒绝与输出确定性；静态结果不替代host验收。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

`js-contract-only`是显式JSON报告profile；旧`saga-strict`报告关联与`js-legacy` reference-only关联不扩展运行能力。测试源码不等报告生成已执行，更不能证明目标编译、业务行为或最终批准。

- `js:generators/saga-dsl/parse.mjs` — `compileSagaContract`。
- `js:generators/saga-dsl/generate.mjs` — `generate`、`buildStrictPlan`。
- `js:src/core/generate.mjs` — `applyEntries`。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；保留`runnable=false`，不重写为黄金批准。
