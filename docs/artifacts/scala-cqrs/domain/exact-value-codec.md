# 精确金额与数值编解码

类别：`exact-value-codec`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

在领域精确值、wire与持久化表示之间建立明确映射，避免Double造成金额舍入和溢出。不是业务金额上限策略。

## 输入与人工信息

作者声明单位、精度/scale、合法币种、字段绑定与codec版本；Money的正数或金额上限由规则决定，不能用precision38替代业务裁决。

## 生产与所有权

JS正式链以exact-value-types/exact-value-codecs等typed产品为输入，由serialization.mjs#serializationModel与render-serialization.mjs#renderConverters形成Domain/Wire/PO转换，render-values.mjs#renderValues提供精确值类型。naming.mjs#typeName只是类型命名，不是codec生产者。

bank-p23的truthsrc.project.json#exactCodecs是输入绑定；DomainConverters.scala与domain/values/Money.scala才是被观察的产物实例，不能把配置列为实现。legacy run-all的strict Saga辅助路径可在model.moneyCodecName选中时输出Money codec，但不等于当前正式域codec或完整金融语义自动生成。

按profile分别记录输入、内容生成、兼容实例和证据，见[能力矩阵](../../CAPABILITY-MATRIX.md)。源码及现存快照未在本轮重新生成、编译、执行金额oracle或最终批准。

## 结构与命名

AmountDecimal/Money与Wire/PO分别命名；数值通过明确的整数最小单位文本或精确十进制转换。codec名和版本与Scala类名分离。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

被参数、消息、proto converter和strict Saga receipt消费；相同领域类型不能在不同边界静默选择不同精度。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

核roundtrip、超范围/错误币种/无效数值拒绝及实际边界编码，固定金融oracle不随codec实现改写。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

### 第三批有限 domain-kernel 候选

`js-domain-kernel-candidate-v1`（实际入口 `scala-cqrs-domain-kernel-v1`，manifest `scala-cqrs-domain-kernel:1`）为显式选择的有限实现；不切换旧入口或银行消费。Combined exact codec file, conditional on real descriptors; no banking-policy algorithm or bank receipt claim.

实际来源为 `generators/scala-cqrs-domain-kernel-v1/templates/exact-codecs.mjs#exactCodecsTemplate`；结构经 `buildModels`／`serializationModel`、有限 `render` 与逐职责模板，`sourceEntry` 记录来源，最终写入仍由 `src/core/generate.mjs#applyEntries` 承担。共享输出不重复算文件；完整范围见[有限合同](../DOMAIN-KERNEL.md)。

`implemented` 只表示上述代码确实存在。此登记阶段没有刷新观察或 source lock／coverage／矩阵，也没有编译、独立行为或最终审定通过声明；`approval:null`。真实证据必须绑定同一输入、全套最终产物字节及冻结工具指纹。 既有第二批14项 reference-only 资格不变；稳定外置 source 映射不恢复 inline `@knowledge`。

### 第四批有限 aggregate-core 候选（当前登记，非验收）

`js-aggregate-core-candidate-v1` 对应实际入口 `scala-cqrs-aggregate-core-v1`、manifest `scala-cqrs-aggregate-core@1`。沿原family1物理exact codec模板按真实descriptor条件生成；主Warehouse样例没有exact codec文件，不能为覆盖合同伪造产物。更大的ops/exact真实作者变体需独立完整sample链。

本页登记的物理输出为 `modules/glue/src/main/scala/**/infrastructure/serialization/ExactValueCodecs.scala`。实际来源为 `generators/scala-cqrs-domain-kernel-v1/templates/exact-codecs.mjs#exactCodecsTemplate`；`generators/scala-cqrs-domain-kernel-v1/build-models.mjs#buildModels`。新入口组合复用的family1生产jobs和本族jobs，经 `generators/scala-cqrs-domain-kernel-v1/render.mjs#renderJobs` 与固定 `entry.mjs#aggregateSourceEntry` owner，最后由 `src/core/generate.mjs#applyEntries` 写入；复用指向原物理模板，不存在新族VO/PB复制模板。

冻结工具/来源指纹下，catalog当前实际登记20份观察（原12份样例generated；family1/family2各1份complete-plan generated及3份同样例源码generated/compiled/behavior-verified）。本页本族exact-value-codec明确excluded于本次观察输出：Warehouse没有该文件，Ops仍缺包含实际生成支持测试的完整sourceEvidence合同；不借family1资格，final-approved=0。原16条观察及74条变体引用已原样保入[历史索引](../../evidence/capability-domain-kernel-final-history.json)，原receipt路径/字节不动、不续签，其旧锁下的资格不算current；初/二/三批原验收仍保留。两类build只取得generated资格，不借源码编译/行为回执晋升。有限范围见[本族合同](../AGGREGATE-CORE.md)；无Bank、外部结果桥、完整四模块/服务或最终批准。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

主要实例：js-formal / bank-p23；legacy run-all strict辅助codec见上文。领域codec、Saga专用codec与静态算术不是相互替代的合同；银行冻结oracle及既有bytes不因目录校准改变。

- `js:generators/scala-cqrs-domain/serialization.mjs` — `serializationModel`。
- `js:generators/scala-cqrs-domain/render-serialization.mjs` — `renderConverters`。
- `js:generators/scala-cqrs-domain/render-values.mjs` — `renderValues`。
- `bank:truthsrc.project.json` — `exactCodecs`，输入而非生产者。
- `bank:generated/current/app/example/bankwealth/infrastructure/serialization/DomainConverters.scala` — 现有转换产物实例。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

## 第六批有限 persistence-readside 候选登记

本类新增 `js-persistence-readside-candidate-v1`，由显式 `scala-cqrs-persistence-readside-v1`／`scala-cqrs-persistence-readside@1` 提供；模块为 `glue`。本段只登记实际源结构，不宣称本批已完成或已编译。

实际输出合同（可覆盖同一物理文件中的不同职责，不按合同数冒充文件数）

- `exact-value-codec`／`exact-value-codec`：One combined exact domain/wire/PO codec object per context, retaining descriptor IDs/versions; not one output per nested codec. 路径 `modules/glue/src/main/scala/**/infrastructure/serialization/ExactValueCodecs.scala`。

输入为唯一业务作者树、原七个 family2 产品及显式 persistence-readside 技术 binding；wire layout SHA 必须核对，不能自动重签。沿用 family2 kernel/glue 和唯一 writer；生成测试与独立 oracle 分开，sbt 定义存在不等任务执行。

本次登记移除旧 active evidence 引用，原24观察和旧回执在[独立历史索引](../../evidence/capability-persistence-readside-prior-current06-history.json)保真；新观察要在生产冻结后单独采集并通过原公共验证器。本段及目录 implemented 仅表示实现存在，当前 generated/compiled/behavior/final-approved 不由本配方晋升。范围与限制见[本族合同](../PERSISTENCE-READSIDE.md)。

读侧文件库重放不是生产 Actor journal 耐久性；不扩张为 MySQL、任意读模型、HTTP、银行/Saga/Monarch 或架构批准。

## 第七批 Strict Saga / Monarch R2 生成入口

新增 `js-saga-monarch-r2-candidate-v1`，由 `scala-cqrs-saga-monarch-v1` 提供。此前“未建立原生生成”的描述保留为原基线，不能覆盖本段明确的新非银行入口。

- `binary-codecs`：Explicit bounded binary frames, original identities, phase receipt domains and optional string-version typed Run codecs.

输入来自唯一作者树与显式技术/外置实现 bindings；运行库接口及内核仍由冻结制品提供。implemented 表示生成实现存在；资格仅由匹配实际输入的独立验收决定，旧28回执不改签。范围、两阶段恢复、重试耗尽与安装边界见[本族合同](../../SAGA-MONARCH-R2.md)。不表示银行迁移或架构批准。
