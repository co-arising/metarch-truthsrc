# Strict Saga定义与固定计划

类别：`strict-saga-definition`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

提供固定定义/args codec和确定的参与者计划，保证恢复不因代码/输入变化重写事务。

## 输入与人工信息

name/version/definitionDigest、canonical args、participant step/resource、每阶段codec需固定；definition必须为纯确定函数。

## 生产与所有权

- `saga-strict`由库提供不可变StrictSagaDefinition/participant API；具体业务definition与codec/port对象不由库猜测。
- `js-formal`的`renderDefinitions`生成Definition内argsCodec/fromTechnical/definition/coordinator及typed参与者；`bank-p23`消费这些接线并注入手写真实I/O。
- `bc-strict`使用StrictSagaModuleBuilder/Model/Template生成具体Module，`bc-semantic-products`使用ProductApplicationTemplate独立生成；`js-run-all-strict`另有旧run-all source链，不能混称一个producer。
- `saga-contract` JSON属于[saga-contract-report](saga-contract-report.md)的`js-contract-only`派生报告，不是可运行Scala definition，也不替代以上真实生成链。

逐profile的库/接线/证据边界见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)。本次不批准模板，不迁移P23或改变OPEN retry政策。

## 结构与命名

StrictSagaDefinition[A]、StrictParticipant[A]及生成StrictSagaModule；当前严格profile要求每参与者三TCC阶段，按序执行。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

由StrictSagaCoordinator消费，真实port对象必须符合已声明pin；新namespace是legacy迁移边界。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

计划digest、顺序/重复step、codec drift、args重编码与缺阶段反例。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

库定义接口、JS/BC生成接线及bank手写I/O按profile分开；合同JSON不计为可运行Scala。测试源码不等定义装配/恢复行为证据，最终批准未授予，P23冻结及OPEN业务政策不变。

- `saga:src/main/scala/net/imadz/infra/saga/strict/StrictSagaDefinition.scala` — `StrictSagaDefinition`。
- `js:generators/scala-cqrs-application/render-host.mjs` — `renderDefinitions`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/transactor/StrictSagaModuleBuilder.scala` — `build`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/transactor/StrictSagaModuleModel.scala` — `StrictSagaModuleModel`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/StrictSagaModuleTemplate.scala` — `generate`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/products/ProductApplicationTemplate.scala` — `generate`。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；新旧namespace边界不因文档修改而迁移。

### 类别依赖

`saga-phase-port`、`saga-receipt-context`、`exact-value-codec`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
