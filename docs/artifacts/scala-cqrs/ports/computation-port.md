# 纯领域计算端口

类别：`computation-port`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

定义可替换的领域计算接口，承载决策/冲突集/折叠所需方法，不是I/O服务或全局可变Access对象。

## 输入与人工信息

完整方法签名、输入输出类型、纯度和实际实现选择；callExpr本身不能推导所有方法，BC由functions ports声明补足。

## 生产与所有权

由列出的生产者/实现提供。BC的Scala结构与JS最终写入者必须一起判断；同文件后续JS覆写时，最终台账行归最后写入者。当前银行兼容profile只按实际已有产物标识，不由旧文档推定能力。

目录状态：`implemented`；所有权：`generated`。生成文件通过公共生成/更新通道维护；独立手写实现不是生成结果的可编辑副本。

## 结构与命名

kernel domain/service/ConceptDeltaAdjudicator等trait；BC JS已生成port，未表示所有端口族都有原生生成。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

签名类型在kernel闭包，ext实现经root注入，Rules/Behaviors/EventHandler闭包传递；kernel不import ext。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

签名闭包、纯函数实现、注入替身和缺依赖拒绝；不得恢复旧全局绑定门。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

适用：bc-multi / di-poc。单模块和多模块是放置/装配变体，不是两套业务事实。BANK P23兼容层与BC目标模板可能保留具名差异；没有把R2运行库能力写成当前银行生成支持。

- `bc:knowledge_base/design_docs/field_template/tools/rules_domain_gen.mjs` — `portDecls`。
- `dipoc:modules/kernel/src/main/scala/net/imadz/metarch/domain/service/ConceptDeltaAdjudicator.scala` — `ConceptDeltaAdjudicator`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

## 签名示例

```scala
trait ConceptDeltaAdjudicator {
  def hasConflicts(deltas: List[ConceptDelta], index: List[ConceptIndexEntry]): Boolean
  def applyDeltas(deltas: List[ConceptDelta], index: List[ConceptIndexEntry]): List[ConceptIndexEntry]
}
```

这里只摘录实际接口的两条方法；完整conflicts方法仍以来源文件为准。实现位于ext，经root绑定；不是把ext对象静态写进Rules。

### 类别依赖

`signature-value-closure`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
