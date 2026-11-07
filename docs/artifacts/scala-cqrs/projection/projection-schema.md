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
