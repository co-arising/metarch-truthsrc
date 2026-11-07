# Scala CQRS 产物约定

本页说明目标约定和具名实现差异，不声称所有当前代码已经满足目标。完整类别以本目录索引为准；语义产品版本、generator profile、runtime artifact版本分开选择。

[参考实现与开发范式](REFERENCE-DEVELOPMENT.md)区分成熟Scala设计、兼容参考候选与现状回归快照。BC mjs产物未经打磨检验，不在用户认可的金样范围；检查完整写入链是为了防止后处理破坏结构，不授予其设计权威。`implemented`和文档覆盖通过均不等于金样批准。

第二批已固定[目标profile与命名合同](TARGET-PROFILES.md)：现有`legacy-compatible`只保留显式旧绑定，新`modular-candidate`提供纯命名/结构模型及独立四模块参考。二者不是新的生成开关，本批未切换银行或改变当前renderer。实际结果见[第二批验收](../TARGET-PROFILE-ACCEPTANCE.md)。

## 层次与模块

- 领域：值、状态、事件、纯规则和事件fold，状态只在event application演进。
- 应用接口与逻辑：命令/回复、Repository/flow/计算port、use case和行为。
- 基础设施：持久化、serializer、driver、投影执行及外部I/O。
- 组合根：Play/controller、实际port绑定、配置与完整生命周期。

当前di-poc是四模块：`kernel`一库内再分结构/接口/逻辑；`glue → kernel`；`ext → kernel + glue`；`root → kernel + glue + ext`。protobuf线格式在glue。旧五模块与root proto的历史描述不是当前build规则。

kernel接口不能通过`@ImplementedBy`引用glue/ext类；root负责binding。合法纯实现的Bridge可同层存在；声明实现位于ext时不可在kernel生成Bridge。port签名递归可达的VO必须在内层闭合，不复制成两份业务类型。

包名不完全等于模块：di-poc仍有`infrastructure`包名的kernel接口，这是已存在的保包迁移，不代表接口拥有driver。当前银行P23还保留domain包的Actor/facade跨层兼容入口；文档把它列为兼容债，不推广为内层依赖外层的许可。

## 命名的五个空间

1. Scala类型/trait/object/case class：UpperCamelCase。
2. 成员/参数/普通函数：lowerCamelCase。
3. 包：通常小写，按选定包策略，不把业务版本ID直接当包片段。
4. SQL/protobuf/wire：按各自schema合同；proto包下划线可以是正确的线格式命名，不一律驼峰化。
5. 知识ID、交易/操作/PID、codec pin与协议版本：稳定身份，不随类名美化重铸。

当前JS `symbol()`只校验合法标识符/关键字，多个renderer把`-`替换为`_`后拼类型/成员后缀，导致`bank_cash_payment_v1Execution`、`Ingestbank_payment_result_succeeded`和`BankServiceService`。这些被记录为生成策略差异，P0不手改产物。后续统一命名需先定义碰撞/缩写/关键字和旧载体兼容方案。

## 所有权与版本

- **generated**：可由已声明输入+producer重建，经公共writer更新。
- **handwritten**：人/agent提供的算法、业务adapter、oracle或装配；不是仅凭truth可再生。
- **library**：Saga/Monarch等jar提供的内核；应用不复制生成第二套。
- **derived**：ledger、来源、锚、DDL/配置/测试等派生件仍须按实际来源说明。
- **mixed**：同职责在不同profile或同文件中有生成与手写部分；必须进一步核变体，不是任意覆盖许可。

`implemented`只说明列出的实现存在，`partial`是部分接线，`not-generated`表示库/宿主能力没有当前原生producer，`reference-only/retired`不作为新项目默认。特别是Monarch R2库已实现，当前银行仍P23；“host @2”不是“R2”。

## 测试与保证

glue无本地Test目录不是正确性豁免。纯规则、serializer、投影事务、HTTP、跨JVM各有独立验证；只给编译或文档链接通过不能报业务成功。JDBC offset exactly-once不等整个金融链路副作用exactly-once。Unknown/NotFound/timeout不能当成功、业务失败、安全重试或资源释放证据。

BC历史生成注释与JS外置代码映射是不同载体。JS暂停新增inline `@knowledge`，仍以最终字节/span回锚同一知识图；手写mapping只证明显式关联，不能冒自动语义认证。
