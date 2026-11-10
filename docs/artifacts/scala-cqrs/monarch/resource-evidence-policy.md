# 资源证据与业务占位策略

类别：`resource-evidence-policy`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

定义哪些物理/业务证据足以释放或移交占位；区分本步执行许可与跨步骤持续物理占位。

## 输入与人工信息

area capacities/需求、carried claims、owner、证明类型与校验逻辑必须由领域适配者给出；库不能自动认证设备/资金安全。

## 生产与所有权

`monarch-r2`的具体释放/carry证明、纯分类和路由安全政策由应用手写实现，当前为`not-generated`。运行库提供ResourceEvidenceValidator接口及默认拒绝行为，但不能据此宣称领域安全策略已经实现。

尚未定位JS/BC原生R2业务政策producer或银行R2采用；P23手写金融证明不自动等同本接口。逐profile及接口/实现证据边界见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)，库测试和生成模板检查都不能替代独立业务oracle。

## 结构与命名

ResourceEvidenceValidator纯同步校验，默认拒绝；AreaDefinition/BatchCompletion表达资源规则，不把所有资源都当作短期锁。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

校验不做I/O、不在replay重新产生副作用；共享占位holder不可被拆散到不同路由目标。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

假释放证明、错owner/token/epoch、部分转移与保留占位、恢复时不误释放。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

R2资源证据接口与应用具体政策分开；R1不含本组资源域API，银行P23未采用R2。测试源码不是执行证据，默认拒绝不代表业务安全已获最终批准。

- `monarch:src/main/scala/net/imadz/monarch/persistence/resource/ResourceEvidenceValidator.scala` — `ResourceEvidenceValidator`。
- `monarch:src/main/scala/net/imadz/monarch/persistence/workflow/BatchModel.scala` — `AreaDefinition`。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；本页摘录不是生产认证。

## 第七批 Strict Saga / Monarch R2 生成入口

新增 `js-saga-monarch-r2-candidate-v1`，由 `scala-cqrs-saga-monarch-v1` 提供。此前“未建立原生生成”的描述保留为原基线，不能覆盖本段明确的新非银行入口。

- `workflow-program`：Finite R2 batch policy, original-item conservation, explicit release/whole Carry, query-only verification and typed inner Run mapping. Retry exhaustion and two-phase authorized recovery are explicit.

输入来自唯一作者树与显式技术/外置实现 bindings；运行库接口及内核仍由冻结制品提供。implemented 表示生成实现存在；资格仅由匹配实际输入的独立验收决定，旧28回执不改签。范围、两阶段恢复、重试耗尽与安装边界见[本族合同](../../SAGA-MONARCH-R2.md)。不表示银行迁移或架构批准。
