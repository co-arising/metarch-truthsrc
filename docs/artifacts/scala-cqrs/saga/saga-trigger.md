# Saga触发协议与耐久门面

类别：`saga-trigger`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

把应用触发请求和事务启动/结果联系起来，持久化触发身份与必要状态，防止只靠临时callback丢失流程。

## 输入与人工信息

触发参数、回复/结果协议、身份关联和Saga owner需已定义。

## 生产与所有权

- `bc-single`通过SagaTriggerProtocol/Entity/Root/Behaviors四个模板生成可调用的legacy SagaRunner门面。实现存在但生命周期仍为legacy，不是strict协调内核。
- `bc-multi`四个`saga-trigger-*` kind都未被`targetModuleOf`映射；CodegenMain传project target为genRoot，writer的None分支以空prefix写`<target>/<package-path>/<name>.scala`。因此是`unmapped-project-root`的partial能力，不可写成已路由glue。
- `js-run-all-strict`生成独立strict Entry/Host触发门面，和BC四构件不是同一生产合同，也不复制事务状态机。

逐profile的实际路径、生产链与证据见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)。单/多模块放置缺口保留，不以文档校准修复运行时或批准模板。

## 结构与命名

SagaTrigger Protocol/Entity/Root/Behaviors是一组关联构件，按四种实际kind分别记录；不是额外一套Saga内核。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

依赖共享coordinator、应用Repository/Bootstrap；start与结果投递分别有提交边界。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

触发重放/同ID冲突/回复丢失与结果回传；独立测试不能省为文档链接有效。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

BC legacy四构件与JS run-all strict门面按profile分开；multi legacy的project-root fallback不是glue成功。测试源码不等触发/恢复行为证据，最终批准未授予。

- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/SagaTriggerProtocolTemplate.scala` — `generate`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/SagaTriggerEntityTemplate.scala` — `generate`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/SagaTriggerRootTemplate.scala` — `generate`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/SagaTriggerBehaviorsTemplate.scala` — `generate`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala` — `targetModuleOf`、`writeArtifact`。
- `js:generators/saga-dsl/emit-strict-host.mjs` — `emitStrictHostFiles`。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；本次不改模块路由或P23产物。
