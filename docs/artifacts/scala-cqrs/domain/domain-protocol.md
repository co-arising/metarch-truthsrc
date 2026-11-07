# 领域命令与事件协议

类别：`domain-protocol`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

表达命令意图、事件事实和领域载荷。领域payload与携replyTo的Actor请求协议不同；不能把ActorRef塞进纯业务知识。

## 输入与人工信息

输入为命令参数、事件字段、错误/响应定义、顺序及稳定身份。一个字段属于请求还是已发生事实需要明确声明。

## 生产与所有权

BC此职责跨两个产物：AggregateProtocolBuilder/Template消费application聚合的commandFamily/replyFamily，DomainEntityTemplate承载domain事件。前者含ActorRef/reply协议，不能称作与JS等价的独立纯领域协议文件。

JS正式链由render-domain.mjs#renderCommand消费reference-layout、domain-dependencies及exact-value-types，输出domain/<Name>Protocol.scala的Command/Event载荷。legacy event-dsl/emit.mjs另生成继承CborSerializable的独立事件case class，类型映射受限，未知类型退为String；它不是typed正式协议的等价生产者。

能力和所有权按profile及具体输出判断，见[能力矩阵](../../CAPABILITY-MATRIX.md)。同一物理文件承担多项职责不应重复计为新产物；源码定位不是目标生成、编译、序列化验收或最终批准。

## 结构与命名

JS domain/<Name>Protocol保留Command/Event case classes；BC命令/回复通常在application Protocol、事件在Entity。领域协议与protobuf-schema是不同职责，旧aggregate_proto入口仍归线格式说明，不混入本页。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

命令经规则产生事件，事件只能由event application应用；协议被应用层封装，不反向调用外层实现。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

检查载荷、事件字段、消息边界与生成反查；不可因protocol文件存在就宣称序列化/路由已接通。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

### 第三批有限 domain-kernel 候选

`js-domain-kernel-candidate-v1`（实际入口 `scala-cqrs-domain-kernel-v1`，manifest `scala-cqrs-domain-kernel:1`）为显式选择的有限实现；不切换旧入口或银行消费。Pure declared command/event payloads only; no Actor request protocol or helpers.

实际来源为 `generators/scala-cqrs-domain-kernel-v1/templates/protocol.mjs#protocolTemplate`；结构经 `buildModels`／`serializationModel`、有限 `render` 与逐职责模板，`sourceEntry` 记录来源，最终写入仍由 `src/core/generate.mjs#applyEntries` 承担。共享输出不重复算文件；完整范围见[有限合同](../DOMAIN-KERNEL.md)。

`implemented` 只表示上述代码确实存在。此登记阶段没有刷新观察或 source lock／coverage／矩阵，也没有编译、独立行为或最终审定通过声明；`approval:null`。真实证据必须绑定同一输入、全套最终产物字节及冻结工具指纹。 既有第二批14项 reference-only 资格不变；稳定外置 source 映射不恢复 inline `@knowledge`。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

主要实例：bc-single / bc-multi / js-formal；legacy event-dsl另见上文。BC单/多模块是放置变体，不是另一个业务模型；正式链的共享subproducer也不是独立验收目标。

- `js:generators/scala-cqrs-domain/render-domain.mjs` — `renderCommand`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateProtocolTemplate.scala` — `AggregateProtocolTemplate`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/DomainEntityTemplate.scala` — `DomainEntityTemplate`。
- `js:generators/event-dsl/emit.mjs` — legacy独立事件输出。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 类别依赖

`value-object`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
