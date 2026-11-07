# 知识图与代码生成AST

类别：`knowledge-graph-ast`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

承载展开知识/顺序/身份/作者映射，通过存储抽象导出完整AST供Codegen实际消费。图不是另一可编辑业务真源。

## 输入与人工信息

当前作者+技术选择确定性编译，知识与锚分别事务发布，版本/完整性可核。

## 生产与所有权

由列出的生产者/实现提供。BC的Scala结构与JS最终写入者必须一起判断；同文件后续JS覆写时，最终台账行归最后写入者。当前银行兼容profile只按实际已有产物标识，不由旧文档推定能力。

目录状态：`implemented`；所有权：`derived`。生成文件通过公共生成/更新通道维护；独立手写实现不是生成结果的可编辑副本。

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

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

适用：tooling。单模块和多模块是放置/装配变体，不是两套业务事实。BANK P23兼容层与BC目标模板可能保留具名差异；没有把R2运行库能力写成当前银行生成支持。

- `js:lib/knowledge-graph.mjs` — `KnowledgeGraphStore`。
- `js:lib/project/graph.mjs` — `projectKnowledgeAst`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。
