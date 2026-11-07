# ViewMachine与PolicyMachine共享机制

类别：`projection-runtime-mechanism`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

集中复用投影读取/纯更新/写入和策略四段循环，避免每个生成handler携一套机制。FailureVerdict、DlqBury属于协同运行机制。

## 输入与人工信息

调用方提供纯策略与有界I/O函数；机制本身不能知道某业务错误是否允许永久丢弃。

## 生产与所有权

- `bc-single` / `bc-multi`：ViewMachine/PolicyMachine/DlqBury/FailureVerdict 的现有实现来自 di-poc 手写代码；新 classic BC 目标的 scaffold 未建立这些 helper 的供应链，不能从既有应用存在反推生成承诺。
- `js-legacy`：旧 policyexec 的 `STATICS.shared` 经 run-all 复制共享机制，是静态代码/接线供应，不是业务知识推导。
- `js-formal`：原生可选 projection-store 由 `renderJournalReadside` 生成自身 journal 投影机制，产物身份和生命周期不同，不是生成上述同名 helper。
- Akka/JDBC 等运行库是依赖消费，不是这些模板生成的库。每条路径仍需实际 driver、资源与宿主装配。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

ViewMachine/PolicyMachine/DlqBury/FailureVerdict按真实模块归属。BC共享实现可能手写保留，JS旧pipeline可复制静态机制；都必须注明最后写者，不能冒自动知识推导。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

共享机制消费typed参数及错误分类，I/O在glue；纯FailureVerdict可在kernel。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

rollback/重试/DLQ/updateOnly/异常抛出及offset边界的机制测试；glue无局部Test目录不豁免这些验证。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。
