# 聚合应用入口

类别：`aggregate-root`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

定义聚合命令处理入口并组合状态、协议和行为。真正业务状态在事件应用演进；Actor注册和持久化接线由bootstrap负责。

## 输入与人工信息

聚合边界、身份、命令族、event handler和authority来源必须明确；不因任意entity存在就自动暴露HTTP。

## 生产与所有权

BC由AggregateRootBuilder/Template消费application.aggregates；多模块入口放kernel。旧SagaTransactor、inline-state、stepsFactory分支仍可有???，不能因Aggregate文件存在就称为strict Saga引擎实现。

JS正式Play service由templates/aggregate-factory.mjs#aggregateTemplate生成应用入口，aggregate-protocol.mjs#legacyTemplate保留domain兼容载体；非layered目标使用render-actor.mjs#renderActors。应用Aggregate的emitted kind可为aggregate-behavior，旧domain载体为aggregate，分类须结合model.role、路径和模板，不能只匹配kind。legacy aggregate-dsl和retired scala-cqrs-es另行记录。

各profile的入口、兼容载体和能力边界见[能力矩阵](../../CAPABILITY-MATRIX.md)。这些是源码级生产合同，不是本轮目标生成、运行或最终批准。

## 结构与命名

application/aggregates/<Name>Aggregate。JS额外保留domain/<Name>Aggregate的旧JVM载体兼容入口；它引用bootstrap是具名跨层兼容债，不能冒纯domain目标结构。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

入口依赖协议/领域合同；持久化由infrastructure装配。内层不依赖外层是目标规则，旧兼容facade必须单列且不能扩散。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

入口/Factory/Bootstrap实际消费链，authority检查、响应顺序与固定业务测试；不是多生成一层同名facade即符合架构。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

### 第四批有限 aggregate-core 候选（当前登记，非验收）

`js-aggregate-core-candidate-v1` 对应实际入口 `scala-cqrs-aggregate-core-v1`、manifest `scala-cqrs-aggregate-core@1`。glue/application/aggregates中单份Aggregate承担真实命令行为装配，与aggregate-behavior共用同一kind=aggregate、文件与sample；不再生成无逻辑Behaviors/facade或复制类别。

本页登记的物理输出为 `modules/glue/src/main/scala/**/application/aggregates/*.scala`。实际来源为 `generators/scala-cqrs-aggregate-core-v1/templates/aggregate.mjs#aggregateTemplate`；`generators/scala-cqrs-aggregate-core-v1/build-models.mjs#buildModels`。新入口组合复用的family1生产jobs和本族jobs，经 `generators/scala-cqrs-domain-kernel-v1/render.mjs#renderJobs` 与固定 `entry.mjs#aggregateSourceEntry` owner，最后由 `src/core/generate.mjs#applyEntries` 写入；复用指向原物理模板，不存在新族VO/PB复制模板。

冻结工具/来源指纹下，catalog当前实际登记20份观察（原12份样例generated；family1/family2各1份complete-plan generated及3份同样例源码generated/compiled/behavior-verified）。本页本族源码已取得同一Warehouse样例的generated、compiled、behavior-verified资格，包含实际生成的支持测试；只证明该冻结输入与最终产物字节，不推广至全profile，final-approved=0。原16条观察及74条变体引用已原样保入[历史索引](../../evidence/capability-domain-kernel-final-history.json)，原receipt路径/字节不动、不续签，其旧锁下的资格不算current；初/二/三批原验收仍保留。两类build只取得generated资格，不借源码编译/行为回执晋升。有限范围见[本族合同](../AGGREGATE-CORE.md)；无Bank、外部结果桥、完整四模块/服务或最终批准。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

主要实例：bc-single / bc-multi / js-formal；legacy/retired另见上文。保持BANK P23旧JVM载体的兼容债，不把它误写成纯domain目标或R2支持。

- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateRootTemplate.scala` — `AggregateRootTemplate`。
- `js:generators/scala-cqrs-play-service/templates/aggregate-factory.mjs` — `aggregateTemplate`。
- `js:generators/scala-cqrs-play-service/templates/aggregate-protocol.mjs` — `legacyTemplate`。
- `js:generators/scala-cqrs-domain/render-actor.mjs` — `renderActors`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 类别依赖

`application-protocol`、`aggregate-behavior`、`domain-entity`。这些是职责依赖，不代替真实Scala import或执行顺序验证。

## 第六批有限 persistence-readside 候选登记

本类新增 `js-persistence-readside-candidate-v1`，由显式 `scala-cqrs-persistence-readside-v1`／`scala-cqrs-persistence-readside@1` 提供；模块为 `glue`。本段只登记实际源结构，不宣称本批已完成或已编译。

实际输出合同（可覆盖同一物理文件中的不同职责，不按合同数冒充文件数）

- `aggregate-root`／`aggregate`：One application Aggregate assembles actual command behavior and pure fold. Same physical aggregate output/sample serves aggregate-root and aggregate-behavior; no extra facade or duplicated category/file. 路径 `modules/glue/src/main/scala/**/application/aggregates/*.scala`。

输入为唯一业务作者树、原七个 family2 产品及显式 persistence-readside 技术 binding；wire layout SHA 必须核对，不能自动重签。沿用 family2 kernel/glue 和唯一 writer；生成测试与独立 oracle 分开，sbt 定义存在不等任务执行。

本次登记移除旧 active evidence 引用，原24观察和旧回执在[独立历史索引](../../evidence/capability-persistence-readside-prior-current06-history.json)保真；新观察要在生产冻结后单独采集并通过原公共验证器。本段及目录 implemented 仅表示实现存在，当前 generated/compiled/behavior/final-approved 不由本配方晋升。范围与限制见[本族合同](../PERSISTENCE-READSIDE.md)。

读侧文件库重放不是生产 Actor journal 耐久性；不扩张为 MySQL、任意读模型、HTTP、银行/Saga/Monarch 或架构批准。
