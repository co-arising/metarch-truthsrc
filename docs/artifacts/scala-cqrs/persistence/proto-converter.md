# 领域与Protobuf转换器

类别：`proto-converter`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

实现Domain与PO的双向转换，包括精确值、事件、状态及集合；不同于serializer的manifest路由，也不同于adapter的事件/快照包装。

## 输入与人工信息

字段映射、精确数值、可选性、schema版本和错误策略来自明确合同。

## 生产与所有权

BC由AggregateConverterBuilder/Template消费application聚合及可达domain values，输出infrastructure/persistence/converters/<Name>ProtoConverters.scala，多模块放glue。

JS正式serialization.mjs#serializationModel → render-serialization.mjs#renderConverters消费domain字段、fold及exact-value-types/codecs，输出DomainConverters和按大小需要的PartN。legacy converter-dsl另生成ProtoConverters/Conv与List/Instant助手，run-all条件复制的PrimitiveConverter为静态支持；retired scala-cqrs-es是历史转换模板，不能与当前typed链互认能力。

按profile区分直接生成、静态支持和生命周期，见[能力矩阵](../../CAPABILITY-MATRIX.md)。converter不是serializer；定位生产源码不表示本轮PB往返、目标编译或最终批准。

## 结构与命名

BC <Name>ProtoConverters与<Type>Conv；JS DomainConverters及PartN拆分。PartN是编译/文件大小组织，不是新artifact类别。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

位于glue/infrastructure依赖领域及PB；legacy Saga参与者converter可能需Repository重建，strict receipt codec是独立合同。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

类型往返、缺字段/未知变体/集合顺序、精确金额、旧PB实例；文档dispatch必须指向本类，不能误指saga_serializer。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

### 第三批有限 domain-kernel 候选

`js-domain-kernel-candidate-v1`（实际入口 `scala-cqrs-domain-kernel-v1`，manifest `scala-cqrs-domain-kernel:1`）为显式选择的有限实现；不切换旧入口或银行消费。Actual PB converter only, not serializer/registration/storage/recovery.

实际来源为 `generators/scala-cqrs-domain-kernel-v1/templates/converters.mjs#convertersTemplate`；结构经 `buildModels`／`serializationModel`、有限 `render` 与逐职责模板，`sourceEntry` 记录来源，最终写入仍由 `src/core/generate.mjs#applyEntries` 承担。共享输出不重复算文件；完整范围见[有限合同](../DOMAIN-KERNEL.md)。

`implemented` 只表示上述代码确实存在。此登记阶段没有刷新观察或 source lock／coverage／矩阵，也没有编译、独立行为或最终审定通过声明；`approval:null`。真实证据必须绑定同一输入、全套最终产物字节及冻结工具指纹。 既有第二批14项 reference-only 资格不变；稳定外置 source 映射不恢复 inline `@knowledge`。

### 第四批有限 aggregate-core 候选（当前登记，非验收）

`js-aggregate-core-candidate-v1` 对应实际入口 `scala-cqrs-aggregate-core-v1`、manifest `scala-cqrs-aggregate-core@1`。沿原family1物理converter模板生成真实PB转换；非primitive map key按实际key-only编码字节排序而非VO文本或receipt值，独立参考已纠正，六个PB oracle用例在真实reference/generated双lane均已通过。没有serializer注册或生产存储保证。

本页登记的物理输出为 `modules/glue/src/main/scala/**/infrastructure/serialization/DomainConverters.scala`。实际来源为 `generators/scala-cqrs-domain-kernel-v1/templates/converters.mjs#convertersTemplate`；`generators/scala-cqrs-domain-kernel-v1/build-models.mjs#buildModels`。新入口组合复用的family1生产jobs和本族jobs，经 `generators/scala-cqrs-domain-kernel-v1/render.mjs#renderJobs` 与固定 `entry.mjs#aggregateSourceEntry` owner，最后由 `src/core/generate.mjs#applyEntries` 写入；复用指向原物理模板，不存在新族VO/PB复制模板。

冻结工具/来源指纹下，catalog当前实际登记20份观察（原12份样例generated；family1/family2各1份complete-plan generated及3份同样例源码generated/compiled/behavior-verified）。本页本族源码已取得同一Warehouse样例的generated、compiled、behavior-verified资格，包含实际生成的支持测试；只证明该冻结输入与最终产物字节，不推广至全profile，final-approved=0。原16条观察及74条变体引用已原样保入[历史索引](../../evidence/capability-domain-kernel-final-history.json)，原receipt路径/字节不动、不续签，其旧锁下的资格不算current；初/二/三批原验收仍保留。两类build只取得generated资格，不借源码编译/行为回执晋升。有限范围见[本族合同](../AGGREGATE-CORE.md)；无Bank、外部结果桥、完整四模块/服务或最终批准。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

主要实例：bc-single / bc-multi / js-formal；legacy/retired及静态支持见上文。BC放置变体不改变业务事实，JS PartN及共享subproducer也不代表额外独立功能或R2支持。

- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/persistence/AggregateConverterTemplate.scala` — `AggregateConverterTemplate`。
- `js:generators/scala-cqrs-domain/render-serialization.mjs` — `renderConverters`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 类别依赖

`protobuf-schema`、`domain-entity`、`exact-value-codec`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
