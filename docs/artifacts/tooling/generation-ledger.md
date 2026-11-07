# 最终产物台账

类别：`generation-ledger`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

记录实际产物路径、kind、来源和所有权；Node后写同路径应替换为最后写者，不删除其他文件行。

## 输入与人工信息

来自成功写入的entries与最终指纹；不能由目录猜测或手改台账掩盖缺生成。

## 生产与所有权

- `tooling`：JS `applyEntries`及BC实际writer维护派生台账；实现本身手写，台账记录不能反向充当源代码生产者。
- BC legacy `appendRows`按path upsert `.codegen-ledger.json`；独立semantic `generateProducts`写`truthsrc.ledger.json`，两套格式/通道不能混同。
- `js-retired`保留旧入口经核心writer形成的台账关联，不复活该入口。`saga-contract-ledger`是静态合同消费报告，归[saga-contract-report](../scala-cqrs/saga/saga-contract-report.md)，不是本页输出台账，更不是journal。

各profile的writer与证据边界见[CAPABILITY-MATRIX.md](../CAPABILITY-MATRIX.md)。台账存在不自动证明实际生成、编译或最终验收。

## 结构与命名

truthsrc.ledger.json/.codegen-ledger.json，实例级path与类型目录的类别是不同概念。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

与manifest/actual source对账；di-poc旧app/modules路径大量漂移，需显式映射/保留原记录，不当作代码缺失或自动重写。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

同路径覆盖归属、metadata保真、孤儿/缺文件和手写区保护；旧台账存在不证明当前字节一致。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

tooling现役writer与retired入口关联分别保留。测试源码不是执行证据，旧台账也不自动证明今日字节或最终批准；不重签历史失败来获得通过。

- `js:src/core/generate.mjs` — `applyEntries`、`ownershipRows`。
- `bc:knowledge_base/design_docs/field_template/tools/ledger_append.mjs` — `appendRows`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala` — `generateProducts`。

来源revision、摘要及处置见[sources.lock.json](../sources.lock.json)；不同writer的台账格式保持各自合同。
