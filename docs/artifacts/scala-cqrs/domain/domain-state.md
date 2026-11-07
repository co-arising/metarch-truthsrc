# 领域状态载体

类别：`domain-state`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

持有聚合在某一事件序列后的状态值，不作为第二个命令处理入口。只有事件应用推进业务状态。

## 输入与人工信息

字段、可选性、集合键和初始化来自fold/实体知识。不能通过页面、数据库查询结果回写写侧状态。

## 生产与所有权

JS正式域生产链由buildStateModels → templates/aggregate-state.mjs#stateEntries从reference-layout、domain-folds、exact-value-types构造<Name>State.scala。layered Play service把empty转发给Entity；非layered目标直接在State侧生成初始化，不能要求每个profile都有额外Entity文件。

bank-p23的FundOrderState是当前兼容产物实例，不是新的手写生产者；其存在只证明被检查的源码快照，不表示本轮重新生成或恢复测试通过。BC的嵌套State布局在domain-entity职责下解释，不能从JS独立文件推定BC输出。

能力、生成责任与实例生命周期按profile分别记录，见[能力矩阵](../../CAPABILITY-MATRIX.md)。正式链中的共享subproducer不是一个独立验收目标，源码定位不构成编译或最终批准。

## 结构与命名

JS兼容形保留<Name>State.scala，empty转发Entity唯一初始化；BC通常把State嵌在Entity中。相同职责可有独立文件或嵌套类型。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

被规则、事件handler、快照adapter和查询端口消费；不得依赖运行时容器或直接打开数据源。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

检查空状态、每个事件的前后状态、旧快照兼容和recovery；不把新初始化用于篡改已有journal。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

主要实例：js-formal / bank-p23。layered与非layered的empty位置不同；银行快照保留兼容载体，不由此推定R2或JS多模块能力。共享subproducer引用不另算独立生成目标。

- `js:generators/scala-cqrs-domain/build-state-models.mjs` — `buildStateModels`。
- `js:generators/scala-cqrs-domain/templates/aggregate-state.mjs` — `stateEntries`。
- `js:generators/scala-cqrs-domain/render-domain.mjs` — `renderAggregate`。
- `bank:generated/current/app/example/bankwealth/domain/FundOrderState.scala` — `FundOrderState`，现有产物实例。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 类别依赖

`value-object`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
