# 固定历史输入与发行适配

类别：`historical-source-adapter`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

按不可变revision读取历史作者/合同，保留历史语境并阻止当前checkout重建第二作者树。不是现役输入的默认后门。

## 输入与人工信息

固定Git对象/精确路径/字节清单与明确historical意图；缺对象失败，不联网fetch或回退HEAD。

## 生产与所有权

由列出的生产者/实现提供。BC的Scala结构与JS最终写入者必须一起判断；同文件后续JS覆写时，最终台账行归最后写入者。当前银行兼容profile只按实际已有产物标识，不由旧文档推定能力。

目录状态：`implemented`；所有权：`handwritten`。生成文件通过公共生成/更新通道维护；独立手写实现不是生成结果的可编辑副本。

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

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

适用：bank-p23 / tooling。单模块和多模块是放置/装配变体，不是两套业务事实。BANK P23兼容层与BC目标模板可能保留具名差异；没有把R2运行库能力写成当前银行生成支持。

- `bank:tools/historical-assets.mjs` — `HISTORICAL_ASSET_REVISION`。
- `bank:tools/historical-source.mjs` — `historical`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。
