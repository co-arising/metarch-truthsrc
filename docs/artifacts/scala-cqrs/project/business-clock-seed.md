# 业务时钟与演示初始化

类别：`business-clock-seed`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

为有限演示提供显式业务时间推进和可信种子输入；不是生产调度或随启动重复充值。

## 输入与人工信息

时钟/种子请求、身份、授权与重复策略由demo合同决定；时间必须能被测试控制。

## 生产与所有权

由列出的生产者/实现提供。BC的Scala结构与JS最终写入者必须一起判断；同文件后续JS覆写时，最终台账行归最后写入者。当前银行兼容profile只按实际已有产物标识，不由旧文档推定能力。

目录状态：`implemented`；所有权：`handwritten`。生成文件通过公共生成/更新通道维护；独立手写实现不是生成结果的可编辑副本。

## 结构与命名

BankBusinessClock/BankSeedAuthority等手写组件，生成端提供其消费协议而不猜业务金额。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

所有业务改变仍经过正常命令/事件链，不能直接改state或DB bypass。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

重复/冲突seed、未授权推进、跨重启期次与时钟稳定性。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

适用：bank-p23。单模块和多模块是放置/装配变体，不是两套业务事实。BANK P23兼容层与BC目标模板可能保留具名差异；没有把R2运行库能力写成当前银行生成支持。

- `bank:handwritten/scala/example/bankwealth/integration/BankBusinessClock.scala` — `BankBusinessClock`。
- `bank:handwritten/scala/example/bankwealth/integration/BankSeedAuthority.scala` — `BankSeedAuthority`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。
