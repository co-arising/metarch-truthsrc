# 关系模式、DDL与索引

类别：`projection-schema`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

生成关系模式、主键/唯一约束和索引，以及对应方言DDL。类型/索引不等同于业务政策。

## 输入与人工信息

表字段、精确类型、identity、namespace、dialect与保留策略由显式声明决定；不能静默drop已有表来让测试通过。

## 生产与所有权

- `bc-single` / `bc-multi`：BC Node `gen_projection_ddl.mjs` 等 DDL 后处理生成 SQL；模块资源打包需与 build 分开核对。
- `js-formal`：实际链为 `validateJournalReadside → journalStatements → renderJournalReadside → applyEntries`，输出 Schema.scala/SQL；不能把 `ddl-dsl/emit.mjs` 归作原生 producer。
- `js-legacy`：独立 `ddl-dsl` 提供 primitive DDL，`viewrepo` 另推导 SQL 表和 Mongo 索引。
- `js-retired`：退役 `scala-cqrs-es-ddl` 有关系型/pgvector 输出。各链的类型映射与输入合同不同，不是相互验证过的 golden master。DDL 生成也不是已执行建库。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

conf/sql/*.sql、<Store>Schema及独立Mongo索引定义；多模块资源位置服从实际build打包规则，非所有DDL都在kernel。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

与Repository写入字段/类型一致；schema初始化必须在使用前完成，启动数据库本身不等schema已建。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

新库建表、重复初始化、字段/约束对齐、坏schema负例；只比较DDL文本不证明应用已经使用。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。

### 类别依赖

`read-model`。这些是职责依赖，不代替真实Scala import或执行顺序验证。

## 第六批有限 persistence-readside 候选登记

本类新增 `js-persistence-readside-candidate-v1`，由显式 `scala-cqrs-persistence-readside-v1`／`scala-cqrs-persistence-readside@1` 提供；模块为 `glue`。本段只登记实际源结构，不宣称本批已完成或已编译。

实际输出合同（可覆盖同一物理文件中的不同职责，不按合同数冒充文件数）

- `readside-schema`／`projection-schema`：H2 schema initialization, precise metadata and namespace compatibility checks; no automatic migration. 路径 `modules/glue/src/main/scala/**/infrastructure/readside/*.scala`。
- `readside-ddl`／`projection-schema`：Explicit table/index DDL for namespace, events, state, selected map index and checkpoints. 路径 `modules/glue/src/main/resources/*.sql`。

输入为唯一业务作者树、原七个 family2 产品及显式 persistence-readside 技术 binding；wire layout SHA 必须核对，不能自动重签。沿用 family2 kernel/glue 和唯一 writer；生成测试与独立 oracle 分开，sbt 定义存在不等任务执行。

本次登记移除旧 active evidence 引用，原24观察和旧回执在[独立历史索引](../../evidence/capability-persistence-readside-prior-current06-history.json)保真；新观察要在生产冻结后单独采集并通过原公共验证器。本段及目录 implemented 仅表示实现存在，当前 generated/compiled/behavior/final-approved 不由本配方晋升。范围与限制见[本族合同](../PERSISTENCE-READSIDE.md)。

读侧文件库重放不是生产 Actor journal 耐久性；不扩张为 MySQL、任意读模型、HTTP、银行/Saga/Monarch 或架构批准。

## 第八批有限 Play 应用入口

新增 `js-play-application-candidate-v1`，由 `scala-cqrs-play-application-v1` 提供。原先profile的缺口描述保留为对应历史，不覆盖本段的新有限入口。

- `readside-schema`：H2 schema initialization, precise metadata and namespace compatibility checks; no automatic migration.
- `readside-ddl`：Explicit table/index DDL for namespace, events, state, selected map index and checkpoints.

唯一作者和显式技术/外置实现bindings经过公共单writer；源码、真实编译、HTTP行为、安装与最终批准逐层记证。有限范围及不适用项见[本族合同](../PLAY-APPLICATION.md)；旧回执不重签，不表示银行或完整modular target已最终批准。
