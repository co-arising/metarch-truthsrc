# 固定历史输入与发行适配

类别：`historical-source-adapter`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

按不可变revision读取历史作者/合同，保留历史语境并阻止当前checkout重建第二作者树。不是现役输入的默认后门。

## 输入与人工信息

固定Git对象/精确路径/字节清单与明确historical意图；缺对象失败，不联网fetch或回退HEAD。

## 生产与所有权

- `bank-p23`及本类别的`tooling`标签均指银行手写历史兼容工具，不是公共JS生成器。现役的是读取器，不是它读取的已退役作者树/资产。
- `historical-source.mjs`的`readHistoricalFile`/`historicalSnapshot`读取固定作者revision `675a9366`；`historical-assets.mjs`的`readHistoricalAsset`/`assertHistoricalCheckout`约束资产revision `4515b6b9`。两类来源不能互换或成为当前生成输入。
- P23冻结、旧失败journal与证据保持不动；历史读取不授权迁移运行库或重建第二作者真源。

来源与逐profile责任见[CAPABILITY-MATRIX.md](../CAPABILITY-MATRIX.md)，历史可读性不等当前业务通过。

## 结构与命名

历史读取器/旧发行runner与现役project wrapper分离。formal-inputs历史运输模板不作为当前生成前必写阶段。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

历史运行环境必须独立checkout/干净归档，不能拷旧秘密或改失败journal；版本目录退役不改API v1。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

对象/路径/模式/hash、缺对象/篡改/遍历拒绝与物理writer前置阻断。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

`bank-p23`与本类别`tooling`均是银行所有的读取器，不是公共生成能力。测试源码不等历史重放已执行；读取固定版本不能改变现役输入、冻结P23或最终验收结论。

- `bank:tools/historical-assets.mjs` — `readHistoricalAsset`、`assertHistoricalCheckout`。
- `bank:tools/historical-source.mjs` — `readHistoricalFile`、`historicalSnapshot`。

来源revision、摘要及处置见[sources.lock.json](../sources.lock.json)；作者与资产的固定revision分别解释。
