# 纯领域计算端口

类别：`computation-port`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

定义可替换的领域计算接口，承载决策/冲突集/折叠所需方法，不是I/O服务或全局可变Access对象。

## 输入与人工信息

完整方法签名、输入输出类型、纯度和实际实现选择；callExpr本身不能推导所有方法，BC由functions ports声明补足。

## 生产与所有权

BC多模块的portDecls由BC-owned rules_domain_gen.mjs读取functions/ports等声明，在Metarch选定pipeline生成kernel trait与可选桥；不是raw Scala CodegenMain单独完成。其受限import列表不证明递归签名闭包。di-poc的ConceptDeltaAdjudicator是该形状的参考实例。

JS正式render-domain.mjs#renderCommand根据domain-dependencies.hosts、归属命令及outputType生成<Aggregate>CommandHelpers.scala内的Computations trait；只提供接口，只有无host方法时才有.none。JS legacy service-dsl/emit.mjs#emitPort也按kind=port生成trait和可选桥，但不在正式typed-product注册链，签名解析/import推断受限；retired scala-cqrs-es-rules的portDeclarations是历史路径。

各profile的接口生成、实例和缺口见[能力矩阵](../../CAPABILITY-MATRIX.md)。不能从生成接口推定算法实现、纯度检查、目标编译或最终批准；legacy文件头的rules_domain_gen字样也不改变JS实际写入者。

## 结构与命名

BC/di-poc可见kernel domain/service/ConceptDeltaAdjudicator等trait；JS正式形为domain/<Aggregate>CommandHelpers.scala内的<Aggregate>Computations，legacy service-dsl按spec.name发独立trait。不能用“JS已生成port”泛指所有端口族都有原生typed生成。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

多模块目标要求签名可达类型在kernel闭合，ext实现经root注入并传入Rules/Behaviors/EventHandler，kernel不import ext。现有port生成/import列表不证明该递归义务已执行；JS正式单项目同样由调用方提供Computations实例。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

签名闭包、纯函数实现、注入替身和缺依赖拒绝；不得恢复旧全局绑定门。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

### 第三批有限 domain-kernel 候选

`js-domain-kernel-candidate-v1`（实际入口 `scala-cqrs-domain-kernel-v1`，manifest `scala-cqrs-domain-kernel:1`）为显式选择的有限实现；不切换旧入口或银行消费。Minimal host signature only; real ordered inputs and outputs, no synthesized business implementation or root binding.

实际来源为 `generators/scala-cqrs-domain-kernel-v1/templates/params.mjs#computationsTemplate`；结构经 `buildModels`／`serializationModel`、有限 `render` 与逐职责模板，`sourceEntry` 记录来源，最终写入仍由 `src/core/generate.mjs#applyEntries` 承担。共享输出不重复算文件；完整范围见[有限合同](../DOMAIN-KERNEL.md)。

`implemented` 只表示上述代码确实存在。此登记阶段没有刷新观察或 source lock／coverage／矩阵，也没有编译、独立行为或最终审定通过声明；`approval:null`。真实证据必须绑定同一输入、全套最终产物字节及冻结工具指纹。 既有第二批14项 reference-only 资格不变；稳定外置 source 映射不恢复 inline `@knowledge`。

### 第四批有限 aggregate-core 候选（当前登记，非验收）

`js-aggregate-core-candidate-v1` 对应实际入口 `scala-cqrs-aggregate-core-v1`、manifest `scala-cqrs-aggregate-core@1`。沿原family1模板生成真实有序inputDependencies与返回类型的Computations接口；算法由调用者注入，接口不等于实现或root binding。

本页登记的物理输出为 `modules/kernel/src/main/scala/**/domain/ports/*.scala`。实际来源为 `generators/scala-cqrs-domain-kernel-v1/templates/params.mjs#computationsTemplate`；`generators/scala-cqrs-domain-kernel-v1/build-models.mjs#buildModels`。新入口组合复用的family1生产jobs和本族jobs，经 `generators/scala-cqrs-domain-kernel-v1/render.mjs#renderJobs` 与固定 `entry.mjs#aggregateSourceEntry` owner，最后由 `src/core/generate.mjs#applyEntries` 写入；复用指向原物理模板，不存在新族VO/PB复制模板。

冻结工具/来源指纹下，catalog当前实际登记20份观察（原12份样例generated；family1/family2各1份complete-plan generated及3份同样例源码generated/compiled/behavior-verified）。本页本族源码已取得同一Warehouse样例的generated、compiled、behavior-verified资格，包含实际生成的支持测试；只证明该冻结输入与最终产物字节，不推广至全profile，final-approved=0。原16条观察及74条变体引用已原样保入[历史索引](../../evidence/capability-domain-kernel-final-history.json)，原receipt路径/字节不动、不续签，其旧锁下的资格不算current；初/二/三批原验收仍保留。两类build只取得generated资格，不借源码编译/行为回执晋升。有限范围见[本族合同](../AGGREGATE-CORE.md)；无Bank、外部结果桥、完整四模块/服务或最终批准。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

主要实例：bc-multi / di-poc / js-formal及JS legacy service-dsl；retired路径见上文。端口生成不等于实现生成，且JS正式嵌入Computations与legacy独立trait有不同输入合同。

- `bc:knowledge_base/design_docs/field_template/tools/rules_domain_gen.mjs` — `portDecls`。
- `dipoc:modules/kernel/src/main/scala/net/imadz/metarch/domain/service/ConceptDeltaAdjudicator.scala` — `ConceptDeltaAdjudicator`。
- `js:generators/scala-cqrs-domain/render-domain.mjs` — `renderCommand`。
- `js:generators/service-dsl/emit.mjs` — `emitPort`，legacy路径。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 签名示例

```scala
trait ConceptDeltaAdjudicator {
  def hasConflicts(deltas: List[ConceptDelta], index: List[ConceptIndexEntry]): Boolean
  def applyDeltas(deltas: List[ConceptDelta], index: List[ConceptIndexEntry]): List[ConceptIndexEntry]
}
```

这里只摘录实际接口的两条方法；完整conflicts方法仍以来源文件为准。实现位于ext，经root绑定；不是把ext对象静态写进Rules。

### 类别依赖

`signature-value-closure`。这些是职责依赖，不代替真实Scala import或执行顺序验证。

### 第二批独立模块候选

`scala-cqrs-modular-candidate-v1`新增独立Parcel参考及纯目标合同，属于reference-only，不是现役生成入口。Typed pure capacity computation port over kernel-owned values. 结构、兼容差异及资格见[目标合同](../TARGET-PROFILES.md)；真实编译/行为结果单独记录，不把参考升级为生成器或最终金样。
