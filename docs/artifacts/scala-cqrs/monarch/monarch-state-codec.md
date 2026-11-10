# Run状态与计划编码

类别：`monarch-state-codec`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

将业务Run状态编码为耐久bytes并按固定codec版本恢复，不能用mutable闭包替代耐久输入。

## 输入与人工信息

状态模型、canonical bytes、版本兼容和大小限制需要明确；大文件使用可靠不可变引用和摘要。

## 生产与所有权

- `monarch-r1`/`monarch-r2`：库定义`StateCodec[S]`接口；具体应用编码与版本政策由消费者拥有，尚无对应原生生成实现。`not-generated`仅限定这些profile，不是全类别结论。
- `js-formal`、`bank-p23`、`bc-semantic-products`已经生成有限业务Execution中的StateCodec及execution proto；JS来自execution renderers，BC来自ProductExecution/ProductInvocationExecution模板。
- `js-legacy`的monarch-dsl emitter生成JSON StateCodec；`js-run-all-strict`的child Plan也有具体业务状态编码。两者是旧式应用生成，不是R2协议编码器。

逐profile的接口、生成实现和证据级别见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)。P23 codec、PB、PID及冻结载体不在本次修改范围。

## 结构与命名

库提供`StateCodec[S]`接口；具体类型编码由应用拥有，可以由正式JS/BC有限Execution producer生成，也可以由消费者手写。P23生成codec不能据名称提升为R1/R2版本化Run的原生生成实现。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

R1/R2版本化Run将具体codec与RunDefinition.codecVersion及journal绑定；P23旧behavior wrapper按其已有StateCodec/持久化合同消费，不能替它补写版本化API保证。存储路径存在不证明跨重启仍可读。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

往返、坏bytes/未知版本、丢字段拒绝和恢复后相同state；不得用新codec重签旧receipt。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

R1/R2具体codec义务与P23/JS/BC已有生成codec分开记录。测试源码不等实际wire/recovery证据；银行冻结载体不变，未采用R2，最终批准仍未授予。

- `monarch:src/main/scala/net/imadz/monarch/persistence/StateCodec.scala` — `StateCodec`（库接口）。
- `js:generators/scala-cqrs-application/render-execution.mjs` — `renderExecutionPlans`。
- `js:generators/scala-cqrs-application/render-invocation-execution.mjs` — `renderInvocationExecution`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/products/ProductExecutionTemplate.scala` — `generate`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/products/ProductInvocationExecutionTemplate.scala` — `generate`。
- `js:generators/monarch-dsl/emit.mjs` — `emitStateType`。
- `js:generators/saga-dsl/emit-invocation-plan.mjs` — `emitMonarchPlan`。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；RunSubmission仅属R2提交接口，不是R1具体codec来源。

## 第七批 Strict Saga / Monarch R2 生成入口

新增 `js-saga-monarch-r2-candidate-v1`，由 `scala-cqrs-saga-monarch-v1` 提供。此前“未建立原生生成”的描述保留为原基线，不能覆盖本段明确的新非银行入口。

- `binary-codecs`：Explicit bounded binary frames, original identities, phase receipt domains and optional string-version typed Run codecs.

输入来自唯一作者树与显式技术/外置实现 bindings；运行库接口及内核仍由冻结制品提供。implemented 表示生成实现存在；资格仅由匹配实际输入的独立验收决定，旧28回执不改签。范围、两阶段恢复、重试耗尽与安装边界见[本族合同](../../SAGA-MONARCH-R2.md)。不表示银行迁移或架构批准。
