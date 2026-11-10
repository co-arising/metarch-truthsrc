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

### 第三批有限 domain-kernel 候选

`js-domain-kernel-candidate-v1`（实际入口 `scala-cqrs-domain-kernel-v1`，manifest `scala-cqrs-domain-kernel:1`）为显式选择的有限实现；不切换旧入口或银行消费。Explicit authored defaults in pure state; no fold, snapshot compatibility or recovery claim.

实际来源为 `generators/scala-cqrs-domain-kernel-v1/templates/state.mjs#stateTemplate`；结构经 `buildModels`／`serializationModel`、有限 `render` 与逐职责模板，`sourceEntry` 记录来源，最终写入仍由 `src/core/generate.mjs#applyEntries` 承担。共享输出不重复算文件；完整范围见[有限合同](../DOMAIN-KERNEL.md)。

`implemented` 只表示上述代码确实存在。此登记阶段没有刷新观察或 source lock／coverage／矩阵，也没有编译、独立行为或最终审定通过声明；`approval:null`。真实证据必须绑定同一输入、全套最终产物字节及冻结工具指纹。 既有第二批14项 reference-only 资格不变；稳定外置 source 映射不恢复 inline `@knowledge`。

### 第四批有限 aggregate-core 候选（当前登记，非验收）

`js-aggregate-core-candidate-v1` 对应实际入口 `scala-cqrs-aggregate-core-v1`、manifest `scala-cqrs-aggregate-core@1`。沿原family1模板保留显式State默认值；State只是载体，事件演进由本族独立纯EventHandler承担，不能把初始化当恢复认证。

本页登记的物理输出为 `modules/kernel/src/main/scala/**/domain/*.scala`。实际来源为 `generators/scala-cqrs-domain-kernel-v1/templates/state.mjs#stateTemplate`；`generators/scala-cqrs-domain-kernel-v1/build-models.mjs#buildModels`。新入口组合复用的family1生产jobs和本族jobs，经 `generators/scala-cqrs-domain-kernel-v1/render.mjs#renderJobs` 与固定 `entry.mjs#aggregateSourceEntry` owner，最后由 `src/core/generate.mjs#applyEntries` 写入；复用指向原物理模板，不存在新族VO/PB复制模板。

冻结工具/来源指纹下，catalog当前实际登记20份观察（原12份样例generated；family1/family2各1份complete-plan generated及3份同样例源码generated/compiled/behavior-verified）。本页本族源码已取得同一Warehouse样例的generated、compiled、behavior-verified资格，包含实际生成的支持测试；只证明该冻结输入与最终产物字节，不推广至全profile，final-approved=0。原16条观察及74条变体引用已原样保入[历史索引](../../evidence/capability-domain-kernel-final-history.json)，原receipt路径/字节不动、不续签，其旧锁下的资格不算current；初/二/三批原验收仍保留。两类build只取得generated资格，不借源码编译/行为回执晋升。有限范围见[本族合同](../AGGREGATE-CORE.md)；无Bank、外部结果桥、完整四模块/服务或最终批准。

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

## 第六批有限 persistence-readside 候选登记

本类新增 `js-persistence-readside-candidate-v1`，由显式 `scala-cqrs-persistence-readside-v1`／`scala-cqrs-persistence-readside@1` 提供；模块为 `kernel`。本段只登记实际源结构，不宣称本批已完成或已编译。

实际输出合同（可覆盖同一物理文件中的不同职责，不按合同数冒充文件数）

- `domain-state`／`state`：Pure state carrier and explicit empty defaults; no Entity forwarding, event fold or recovery. 路径 `modules/kernel/src/main/scala/**/domain/*.scala`。

输入为唯一业务作者树、原七个 family2 产品及显式 persistence-readside 技术 binding；wire layout SHA 必须核对，不能自动重签。沿用 family2 kernel/glue 和唯一 writer；生成测试与独立 oracle 分开，sbt 定义存在不等任务执行。

本次登记移除旧 active evidence 引用，原24观察和旧回执在[独立历史索引](../../evidence/capability-persistence-readside-prior-current06-history.json)保真；新观察要在生产冻结后单独采集并通过原公共验证器。本段及目录 implemented 仅表示实现存在，当前 generated/compiled/behavior/final-approved 不由本配方晋升。范围与限制见[本族合同](../PERSISTENCE-READSIDE.md)。

读侧文件库重放不是生产 Actor journal 耐久性；不扩张为 MySQL、任意读模型、HTTP、银行/Saga/Monarch 或架构批准。

## 第八批有限 Play 应用入口

新增 `js-play-application-candidate-v1`，由 `scala-cqrs-play-application-v1` 提供。原先profile的缺口描述保留为对应历史，不覆盖本段的新有限入口。

- `domain-state`：Pure state carrier and explicit empty defaults; no Entity forwarding, event fold or recovery.

唯一作者和显式技术/外置实现bindings经过公共单writer；源码、真实编译、HTTP行为、安装与最终批准逐层记证。有限范围及不适用项见[本族合同](../PLAY-APPLICATION.md)；旧回执不重签，不表示银行或完整modular target已最终批准。
