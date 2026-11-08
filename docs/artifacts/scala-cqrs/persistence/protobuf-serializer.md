# 消息序列化器与manifest

类别：`protobuf-serializer`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

按serializer ID/manifest路由消息并转换bytes。稳定身份和未知版本拒绝是协议要求，不是任意模板已达成的保证；它也不是业务事件生成器。JS当前按context位置派生ID的限制必须纳入演进检查。

## 输入与人工信息

被序列化的具体wire类型、ID、manifest和合法版本由协议明确；不能把带Promise/内部callback的所有Command一并绑定。

## 生产与所有权

BC单/多模块在CodegenMain复制静态scaffold/conf/serialization.conf，绑定Akka库的akka.remote.serialization.ProtobufSerializer与PB类型。这是库消费和配置复制，不是生成ScalaPbSerializer源码；di-poc glue中的自定义ScalaPbSerializer只是独立维护参考，不能用其GeneratedOneof/旧协议能力证明raw BC支持。

JS正式DomainProtoSerializer及可选PartN由render-adapters.mjs#renderAdapters基于serializationModel直接生成，不是renderConverters。其identifier按741000 + context位置派生，跨版本稳定性尚未证明；host/child/effect专用serializer是所选应用profile的另一路生成，不能与域serializer或runtime库混称同一产物。

各profile的代码生成、外部库责任和配置见[能力矩阵](../../CAPABILITY-MATRIX.md)。本轮没有执行Akka序列化、目标编译或最终批准，源码来源也不证明配置已在消费进程生效。

## 结构与命名

DomainProtoSerializer、HostSerializer、ScalaPbSerializer与分片PartN；具体注册在serialization.conf/reference.conf。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

依赖PB和converter，不能用类改名暗中改变旧持久化身份。不同runtime库的serializer保持自己的版本合同。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

实际Akka序列化往返、manifest/ID冲突、未知类型/损坏bytes拒绝与旧JVM载体兼容。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

主要实例：BC单/多模块消费Akka库，JS正式生成DomainProtoSerializer；di-poc自定义ScalaPbSerializer仅作独立维护参考。它不属于BC生成器的输出，也不能证明BC已具有相同oneof兼容行为。

- `bc:scaffold/conf/serialization.conf` — `akka.actor.serializers.proto / serialization-bindings`，静态库绑定。
- `bc:src/main/scala/net/imadz/codegen/CodegenMain.scala` — scaffold复制接线。
- `js:generators/scala-cqrs-domain/render-adapters.mjs` — `renderAdapters`，DomainProtoSerializer实际生产者。
- `dipoc:modules/glue/src/main/scala/net/imadz/common/serialization/ScalaPbSerializer.scala` — 自定义参考实现，不归BC生成。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 类别依赖

`protobuf-schema`、`proto-converter`。这些是职责依赖，不代替真实Scala import或执行顺序验证。

## 第六批有限 persistence-readside 候选登记

本类新增 `js-persistence-readside-candidate-v1`，由显式 `scala-cqrs-persistence-readside-v1`／`scala-cqrs-persistence-readside@1` 提供；模块为 `glue`。本段只登记实际源结构，不宣称本批已完成或已编译。

实际输出合同（可覆盖同一物理文件中的不同职责，不按合同数冒充文件数）

- `persistence-runtime`／`persistence-runtime`：Versioned frame validation and event/state encode/decode dispatch through the existing DomainConverters ABI; explicit wire-registration rows, not a journal implementation. 路径 `modules/glue/src/main/scala/**/infrastructure/persistence/*.scala`。
- `persistence-serializer`／`serializer`：Application SerializerWithStringManifest for the registered Frame only; no AnyRef/GeneratedMessage blanket binding. 路径 `modules/glue/src/main/scala/**/infrastructure/persistence/*.scala`。

输入为唯一业务作者树、原七个 family2 产品及显式 persistence-readside 技术 binding；wire layout SHA 必须核对，不能自动重签。沿用 family2 kernel/glue 和唯一 writer；生成测试与独立 oracle 分开，sbt 定义存在不等任务执行。

本次登记移除旧 active evidence 引用，原24观察和旧回执在[独立历史索引](../../evidence/capability-persistence-readside-prior-current06-history.json)保真；新观察要在生产冻结后单独采集并通过原公共验证器。本段及目录 implemented 仅表示实现存在，当前 generated/compiled/behavior/final-approved 不由本配方晋升。范围与限制见[本族合同](../PERSISTENCE-READSIDE.md)。

读侧文件库重放不是生产 Actor journal 耐久性；不扩张为 MySQL、任意读模型、HTTP、银行/Saga/Monarch 或架构批准。
