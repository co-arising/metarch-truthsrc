# 代码回锚与同图关联

类别：`code-anchor`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

将最终代码字节/区间关联到展开知识节点，并支持正反查；多个节点可指同一宏声明。

## 输入与人工信息

真实source、renderer映射、最终写入内容与知识快照，不由同名符号推测语义同一。

## 生产与所有权

- `tooling`：手写公共writer/图适配器派生`anchors.json`及同图代码关联，链路包括`applyEntries`、`finalMappingSpan`、`writeAnchorsIndex`、`publishProjectAnchors`与`publishCodeAnchors`；索引不是业务源码producer。
- `js-retired`保留旧生成入口的锚记录来源，不使已退役入口重新成为现役producer。当前核心仍可提供锚机制，入口生命周期与机制生命周期分开。
- 展开节点到宏作者位置允许N:1；精确最终字节关联也不自动证明业务语义、编译或最终批准。

各profile及派生证据级别见[CAPABILITY-MATRIX.md](../CAPABILITY-MATRIX.md)，不以锚数量代替逐项来源核验。

## 结构与命名

anchors.json是交换/派生证据，项目锚回到同一逻辑知识图；JS暂停新增inline @knowledge，但回锚继续。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

MANUAL合并后重定位并核字节，歧义降级候选而非冒精确；graph缺/旧须拒绝假同步。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

UTF8 span、重名/歧义、跨快照、手改冲突与重开图正反查；文件级关联不冒symbol/type解析。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

当前tooling机制和retired入口关联分别记录在派生矩阵中。测试源码不等执行证据；锚一致性不自动批准模板、业务语义或完整服务。

- `js:src/core/anchors.mjs` — `planAnchors`、`writeAnchorsIndex`。
- `js:src/core/code-mappings.mjs` — `validateCodeMappings`、`finalMappingSpan`。
- `js:lib/project/graph.mjs` — `publishProjectAnchors`。
- `js:lib/knowledge-sqlite.mjs` — `publishCodeAnchors`。

来源revision、摘要及处置见[sources.lock.json](../sources.lock.json)；本页摘录不是生产认证。

### 类别依赖

`code-provenance`、`generation-ledger`、`knowledge-graph-ast`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
