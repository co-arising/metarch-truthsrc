# 外部连接器实现

类别：`connector-implementation`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

执行真正外部I/O，验证业务回执并实现端口。不因编译了adapter就认证对方系统的幂等/耐久性。

## 输入与人工信息

协议、认证凭据引用、超时/有界I/O池、外部ledger身份与证据规则由实际集成提供。

## 生产与所有权

BC由ConnectorImplBuilder → ConnectorImplTemplate消费SystemMetadata.infrastructure.connectors，输出infrastructure/connectors/<Name>Impl.scala骨架，实际包名由selfType控制；多模块当前落root，并非已提供glue里的完整外部实现。

JS legacy connector-dsl/emit.mjs按显式name/package/method signatures真正生成<name>Connector.scala和<name>ConnectorImpl.scala；实现方法仍为MANUAL ???，不是正式typed-product外部连接器。bank-p23的MockTAClient由手写集成提供并连接本地mock worker，不能冒充真实TA集成。

按profile区分骨架生成、手写模拟与真实I/O责任，见[能力矩阵](../../CAPABILITY-MATRIX.md)。本轮未运行worker、外部调用、编译或最终批准；源码产出合同不认证对方耐久性。

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

主要实例：BC单/多模块骨架、JS legacy connector-dsl与bank-p23手写mock。它们都不构成真实TA幂等性或耐久性认证，不能以生成能力名称替代外部证据。

- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/connector/ConnectorImplTemplate.scala` — `ConnectorImplTemplate`。
- `js:generators/connector-dsl/emit.mjs` — `implMethods`及文件写入。
- `bank:handwritten/scala/example/bankwealth/bindings/MockTAClient.scala` — `MockTAClient`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 类别依赖

`external-connector-port`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
