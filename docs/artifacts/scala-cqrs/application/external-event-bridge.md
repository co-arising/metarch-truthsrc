# 外部结果到领域事件桥

类别：`external-event-bridge`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

把受信外部结果转换为明确领域事件，同时保持producer身份、业务关联与authority。不是向聚合任意写事件的后门。

## 输入与人工信息

结果类型、事件字段血缘、可信producer、操作/订单关联以及冲突政策必须显式。

## 生产与所有权

JS正式载荷桥由render-domain.mjs#renderCommand读取domain-dependencies中外部producer及稳定身份声明，生成<Name>ExternalEvents.scala的结果到事件转换与身份提取。renderAggregate不写此转换；Ingest请求和authority行为是render-actor.mjs#renderActors或Play service behaviorTemplate的另一个产出面，不能把载荷桥当权限认证。

BC的对应能力属于codegen.semanticProductsFile选择的ProductDomainBuilder → ProductDomainTemplate路径，消费显式external producers/stableIdentityContract；不是旧SystemMetadata输入槽位自动获得的能力，也不能据此声称全部actor ingress已实现。

各profile的载荷生成、actor装配和宿主责任见[能力矩阵](../../CAPABILITY-MATRIX.md)。本轮源码核对不等于生成目标、执行安全测试或最终批准。

## 结构与命名

<Name>ExternalEvents与Ingest请求；当前Ingest加下划线ID的命名是既存生成差异，目标应由公共命名resolver处理。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

通过Aggregate authority核查后进入事件持久化；未知TA结果不能硬译成成功/失败，已Commit付款后的退款属于新事务。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

假producer/身份错配/同ID异正文/迟到结果及固定业务oracle，来源关联不替代权限验证。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

主要实例：js-formal / bc-semantic-products。两者均需明确产品目标；不能将payload转换等同actor ingress/authority完整接线，也不将BC语义产品能力扩展到旧输入槽位。

- `js:generators/scala-cqrs-domain/render-domain.mjs` — `renderCommand`，ExternalEvents载荷转换。
- `js:generators/scala-cqrs-domain/render-actor.mjs` — `renderActors`，非layered Ingest面。
- `js:generators/scala-cqrs-play-service/templates/aggregate-behavior.mjs` — `behaviorTemplate`，layered authority行为。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/products/ProductDomainTemplate.scala` — `external`，BC语义产品桥。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 类别依赖

`domain-protocol`、`application-protocol`、`authorization-policy`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
