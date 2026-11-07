# 数据库连接与I/O基础适配

类别：`database-driver-adapter`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

隔离DataSource、JDBC连接/session与数据库driver的提供和消费，不决定银行资金/权限规则。连接池是否存在取决于具体适配；本页银行实例不是连接池，生成Repository也不自动提供池。

## 输入与人工信息

显式连接配置、凭据引用、池限制、事务与关闭owner；文档只记录引用不包含真实秘密。

## 生产与所有权

JS正式Play service的render-journal-repository.mjs消费projectionStore声明及调用方DataSource，生成的是JDBC Repository机制；build增强声明MySQL Connector/J依赖。它消费JDBC API/driver库，不生成DataSource、连接池或数据库driver实现。

bank-p23的BankJdbcDataSource是handwritten/scala中的外置手写适配，通过DriverManager打开连接，不是生成连接池；URL、凭据及连接生命周期由部署/宿主提供。不能把生成Repository、库实现和手写DataSource合并成同一种所有权。

各profile的库消费、装配与手写责任见[能力矩阵](../../CAPABILITY-MATRIX.md)。源码支持不等于本轮连接数据库、目标编译、资源测试或最终批准。

## 结构与命名

DataSource/ScalikeJdbcSession/Setup等位于glue或infrastructure；不能因多个模块需要它就搬到纯kernel。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

Repository中属于同一事务的操作必须使用同一Connection；连接与池（如有）的生命周期由实际owner统一管理。银行当前适配不提供池，不能从共享DataSource接口推定池关闭或排空语义。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

连接失败/事务回滚/关闭排空/资源泄露/权限约束；本地H2通过不能替代真实MySQL重放。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

主要实例：js-formal的库消费/Repository机制与bank-p23手写DataSource。当前来源没有生成连接池的证明，也不由数据库依赖声明推定连接成功。

- `bank:handwritten/scala/example/bankwealth/integration/BankJdbcDataSource.scala` — `BankJdbcDataSource`。
- `js:generators/scala-cqrs-play-service/render-journal-repository.mjs` — `renderJournalRepository`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。
