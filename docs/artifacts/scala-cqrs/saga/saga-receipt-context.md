# 严格回执上下文与参数血缘

类别：`saga-receipt-context`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

只向合法消费阶段提供已耐久提交的前置receipt，以typed lookup支持参与者参数血缘。不是任意map访问或最新内存结果。

## 输入与人工信息

producer/consumer phase、operation identity、expected codec及参数映射由计划声明。

## 生产与所有权

- `saga-strict`消费运行库的StrictReceiptContext：只有库提供的耐久前置回执查询上下文具备相应身份/阶段/codec检查，caller自造上下文仍不可用。
- `js-run-all-strict`生成的是args/receipt/context数据载体与消费接线，不是生成或替代运行时StrictReceiptContext。正式Definition中的`request.receipt`参数血缘也只是消费库能力的应用接线。

逐profile的库机制与生成receipt-data责任见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)。不能把生成carrier、普通map或内存结果当作已耐久回执；本次不迁移P23或批准业务运行。

## 结构与命名

OperationRequest.receipt和StrictReceiptContext；caller自造上下文默认不可用。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

校验前置receipt属于同一事务/正确阶段/codec，不能用后继或陌生参与者数据替代。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

错phase/错producer/漏receipt/codec不符和合法串行计划读取。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

运行库StrictReceiptContext与run-all生成receipt-data/carrier按profile分别解释。测试源码不等耐久回执行为验证；银行P23冻结，最终批准未授予。

- `saga:src/main/scala/net/imadz/infra/saga/strict/StrictReceiptContext.scala` — `StrictReceiptContext`。
- `saga:src/main/scala/net/imadz/infra/saga/strict/StrictSagaDefinition.scala` — `OperationRequest`。
- `js:generators/saga-dsl/emit-strict.mjs` — `emitStrictFiles`（数据载体，不是runtime context）。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；不将生成receipt接线升级为运行库实现。

### 类别依赖

`saga-wire`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
