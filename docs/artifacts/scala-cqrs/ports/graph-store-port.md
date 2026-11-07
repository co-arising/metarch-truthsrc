# 图存储查询与变更端口

类别：`graph-store-port`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

目标是隔离图操作与身份/租户边界，不能从同名节点自动推论关联。现存di-poc接口同时含领域操作和通用Cypher queryList，并非只暴露领域语义；tooling API则面向知识快照与代码回锚，不是应用Neo4j端口的同一实现。

## 输入与人工信息

节点/边操作、namespace、键和容错语义显式；JS知识图与应用Neo4j读侧为不同逻辑图，不共享身份假设。

## 生产与所有权

di-poc的GraphProjectionRepository是kernel内维护的trait，除节点/边操作外还暴露通用Cypher queryList；不能把它说成已生成的纯领域图门面。接口、ext实现和glue driver机制是不同所有权。

tooling的lib/knowledge-graph.mjs#KnowledgeGraphStore是手写API基类，未实现方法抛出adapter-not-implemented，由具体SqliteKnowledgeGraphStore适配器提供操作；它属于工具知识图，不是从业务作者树生成的Scala应用接口。

各profile分别记录接口可用性、具体实现与参考生命周期，见[能力矩阵](../../CAPABILITY-MATRIX.md)。源码扫描没有运行图数据库、重开测试、目标生成或最终批准。

## 结构与命名

GraphProjectionRepository接口在kernel，纯助手留伴生对象；实现ext，driver机制glue。JSKnowledgeGraphStore使用自己的嵌入式适配合同。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

消费者只依赖领域操作，root选择具体adapter；数据位置与查询空间必须明确。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

端口契约测试、租户/版本/缺失与重新打开后的完整性；不以图存在代替图内容正确。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

主要实例：di-poc维护的Scala接口与tooling手写知识图API。前者为POC参考，后者为当前工具库；两者不是同一业务图，也不是生成Scala应用图接口的证据。

- `dipoc:modules/kernel/src/main/scala/net/imadz/metarch/infrastructure/graph/GraphProjectionRepository.scala` — `trait GraphProjectionRepository`。
- `js:lib/knowledge-graph.mjs` — `KnowledgeGraphStore`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。
