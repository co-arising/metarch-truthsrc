# PersistentMonarch持久化宿主

类别：`monarch-checkpoint-host`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

持久化stage状态/完成游标并在恢复后接续执行。业务效果和checkpoint间隙可能重跑，不能据此称exactly-once。

## 输入与人工信息

稳定PID、stage列表、StateCodec与解释器、observer/确认政策显式提供。

## 生产与所有权

- `monarch-legacy`、`monarch-r1`、`monarch-r2`消费共享PersistentMonarch库；旧behavior/StartRun与versioned/managed API的保证分别判定。
- `js-formal`和`bc-semantic-products`确实生成有限业务Execution wrapper、StateCodec及execution proto，是`generate-wiring`，不是复制库内核。BC对应ProductExecution/ProductInvocationExecution模板链。
- `bank-p23`是生成wrapper加手写`BankRuntime`/directory actor owner的混合装配；实际仍调用旧`PersistentMonarch.behavior`，不能仅标为runtime-library或冒称R2。
- `js-legacy`的`monarch-dsl/emit.mjs`及`js-run-all-strict`的composition child-plan分别提供旧式应用wrapper，不能抹去已有生成能力，也不能向它们传播managed API保证。

逐profile的生产链、生命周期与证据级别见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)。P23冻结不因本次归属校准改变。

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

各库profile、JS/BC生成wrapper及bank手写actor owner分别按生产说明与矩阵解释。测试源码不是跨JVM恢复证据；P23仍用旧behavior，银行未采用R2，最终批准未由本页授予。

- `monarch:src/main/scala/net/imadz/monarch/persistence/PersistentMonarch.scala` — `behavior`、`versionedBehavior`、`managedBehavior`（按profile区分）。
- `js:generators/scala-cqrs-application/render-invocation-execution.mjs` — `renderInvocationExecution`。
- `js:generators/scala-cqrs-application/render-execution.mjs` — `renderExecutionPlans`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/products/ProductExecutionTemplate.scala` — `generate`。
- `bank:handwritten/scala/example/bankwealth/integration/BankRuntime.scala` — `ensureCash`、`ensureRefund`。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；库实现不算每业务生成。

### 类别依赖

`monarch-stage-engine`、`monarch-state-codec`、`monarch-wire-settings`。这些是职责依赖，不代替真实Scala import或执行顺序验证。

## 第七批 Strict Saga / Monarch R2 生成入口

新增 `js-saga-monarch-r2-candidate-v1`，由 `scala-cqrs-saga-monarch-v1` 提供。此前“未建立原生生成”的描述保留为原基线，不能覆盖本段明确的新非银行入口。

- `typed-run`：Pure fixed-step or single-operation managed Run generated reads/writes/outcomes, typed leaf adapters, six-field identity checks and bounded Host. Low-level reference facade is separate from declared Run generation.

输入来自唯一作者树与显式技术/外置实现 bindings；运行库接口及内核仍由冻结制品提供。implemented 表示生成实现存在；资格仅由匹配实际输入的独立验收决定，旧28回执不改签。范围、两阶段恢复、重试耗尽与安装边界见[本族合同](../../SAGA-MONARCH-R2.md)。不表示银行迁移或架构批准。
