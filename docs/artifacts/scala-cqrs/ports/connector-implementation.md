# 外部连接器实现

类别：`connector-implementation`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

执行真正外部I/O，验证业务回执并实现端口。不因编译了adapter就认证对方系统的幂等/耐久性。

## 输入与人工信息

协议、认证凭据引用、超时/有界I/O池、外部ledger身份与证据规则由实际集成提供。

## 生产与所有权

由列出的生产者/实现提供。BC的Scala结构与JS最终写入者必须一起判断；同文件后续JS覆写时，最终台账行归最后写入者。当前银行兼容profile只按实际已有产物标识，不由旧文档推定能力。

目录状态：`implemented`；所有权：`mixed`。生成文件通过公共生成/更新通道维护；独立手写实现不是生成结果的可编辑副本。

## 结构与命名

基础ConnectorImpl骨架与手写MockTAClient分开标识；mock是教学模拟，不是真实银行/TA集成。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

消费内层port和共享driver机制；恢复按原Operation身份查证，未知不能换ID盲重发。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

断连/ACK丢失/重复请求/身份错配及外部账本核对；冻结金融预期不随adapter改写。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

适用：bc-single / bc-multi / bank-p23。单模块和多模块是放置/装配变体，不是两套业务事实。BANK P23兼容层与BC目标模板可能保留具名差异；没有把R2运行库能力写成当前银行生成支持。

- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/connector/ConnectorImplTemplate.scala` — `ConnectorImplTemplate`。
- `bank:handwritten/scala/example/bankwealth/bindings/MockTAClient.scala` — `MockTAClient`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 类别依赖

`external-connector-port`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
