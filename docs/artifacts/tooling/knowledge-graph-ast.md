# 知识图与代码生成AST

类别：`knowledge-graph-ast`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

承载展开知识/顺序/身份/作者映射，通过存储抽象导出完整AST供Codegen实际消费。图不是另一可编辑业务真源。

## 输入与人工信息

当前作者+技术选择确定性编译，知识与锚分别事务发布，版本/完整性可核。

## 生产与所有权

`tooling`负责派生知识snapshot/AST，而`KnowledgeGraphStore`抽象和`SqliteKnowledgeGraphStore`适配器是手写实现。`captureProject`、`buildKnowledgeSnapshot`、`publishSnapshot`、`exportKnowledgeAst`与`projectKnowledgeAst`构成项目图消费链；抽象类的存在不是存储已工作或生成已发生的证据。

旧普通display graph与项目SQLite snapshot图的合同分别保留，不能传播同图一致性保证。图/AST派生不批准其承载的业务决策，代码锚发布也不是再次编辑作者树。

逐profile的责任和证据级别见[CAPABILITY-MATRIX.md](../CAPABILITY-MATRIX.md)。

## 结构与命名

KnowledgeGraphStore及SQLite适配，AST/代码映射依赖领域接口不绑定SQL；旧普通显示graph与项目snapshot图保证不同。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

Codegen不能验图后又绕回旧树；同图加锚不改变知识AST，生成输出目录不同仍可能共享项目图。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

入图/导出对账、关闭重开、源变化过期、缺节点/顺序/身份拒绝和确定性；不启动Neo4j作为基本前提。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本类别`tooling`的派生AST与手写存储实现分开。测试源码存在不证明关闭重开或同图生成已经执行，图/AST校验不授予最终模板批准。

- `js:lib/knowledge-graph.mjs` — `KnowledgeGraphStore`、`buildKnowledgeSnapshot`、`exportKnowledgeAst`。
- `js:lib/knowledge-sqlite.mjs` — `SqliteKnowledgeGraphStore`、`publishSnapshot`。
- `js:lib/project/graph.mjs` — `projectKnowledgeAst`。

来源revision、摘要及处置见[sources.lock.json](../sources.lock.json)；本页摘录不是生产认证。
