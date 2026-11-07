# 可查证外部效果宿主

类别：`effect-host`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

连接外部效果执行/查证和业务结果投递，不把TA受理当份额确认，也不把效果宿主等同Saga事务。

## 输入与人工信息

原operation身份、request、execute/query、结果分类、endpoint/codec/证据验证与唯一start owner。

## 生产与所有权

- `js-formal`的effect producer实际生成EffectHost、业务状态、EffectHostSerializer和effect proto，由`renderEffectHosts`/`renderEffectSupport`提供，不是只有手写壳。
- `bc-semantic-products`使用独立ProductEffectHostTemplate/ProductEffectSupportTemplate及`generateProducts`；不能用JS或银行源码充作BC producer。
- `bank-p23`混合消费生成host与手写BankTaEffectBindings的execute/query/reconcile/证据政策。真实外部adapter不是自动生成的领域正确性证明，P23 host也不是R1/R2 PersistentOperation。

逐profile责任及证据级别见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)。银行保持冻结，未采用R2；retry/backoff/deadline的OPEN项不因宿主存在而关闭。

## 结构与命名

<Name>EffectHost及独立proto/serializer；当前P23自有host机制不是R1引入、R2保留的PersistentOperation，也不是银行原生R2消费证明。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

真实外部adapter手写注入；unknown不投递成功/失败，结果与原请求关联。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

重复/冲突、外部已执行但ACK丢失、查询为空、结果交付确认及跨重启。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

JS/BC生成host与bank手写外部绑定按profile分别举证。测试源码不等效果查证或跨JVM行为验证；银行P23冻结、未采用R2，最终批准未授予。

- `js:generators/scala-cqrs-application/render-effect-hosts.mjs` — `renderEffectHosts`。
- `js:generators/scala-cqrs-application/render-effect-support.mjs` — `renderEffectSupport`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/products/ProductEffectHostTemplate.scala` — `generate`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/products/ProductEffectSupportTemplate.scala` — `generate`。
- `bank:handwritten/scala/example/bankwealth/bindings/BankTaEffectBindings.scala` — `BankTaEffectBindings`。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；宿主存在不关闭OPEN retry政策。
