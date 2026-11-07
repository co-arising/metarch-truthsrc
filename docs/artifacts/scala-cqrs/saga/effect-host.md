# 可查证外部效果宿主

类别：`effect-host`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

连接外部效果执行/查证和业务结果投递，不把TA受理当份额确认，也不把效果宿主等同Saga事务。

## 输入与人工信息

原operation身份、request、execute/query、结果分类、endpoint/codec/证据验证与唯一start owner。

## 生产与所有权

由列出的生产者/实现提供。BC的Scala结构与JS最终写入者必须一起判断；同文件后续JS覆写时，最终台账行归最后写入者。当前银行兼容profile只按实际已有产物标识，不由旧文档推定能力。

目录状态：`implemented`；所有权：`mixed`。生成文件通过公共生成/更新通道维护；独立手写实现不是生成结果的可编辑副本。

## 结构与命名

<Name>EffectHost及独立proto/serializer；当前P23自有host机制不是Monarch R2 PersistentOperation已消费证明。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

真实外部adapter手写注入；unknown不投递成功/失败，结果与原请求关联。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

重复/冲突、外部已执行但ACK丢失、查询为空、结果交付确认及跨重启。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

适用：js-formal / bc-semantic-products / bank-p23。当前saga-core基线4352a317的strict API与银行P23消费有明确合同，Monarch R2不自动升级Saga政策或retry/backoff/deadline。

- `js:generators/scala-cqrs-application/render-effect-hosts.mjs` — `renderEffectHosts`。
- `bank:handwritten/scala/example/bankwealth/bindings/BankTaEffectBindings.scala` — `BankTaEffectBindings`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。
