# 规则参数载体

类别：`rule-parameters`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

把规则所需state、command和明确依赖组织为类型化参数，减少隐式全局访问。不是与Command重复维护的业务模型。

## 输入与人工信息

参数来源由命令、状态和依赖声明确定；缺字段不能由生成器补业务默认。

## 生产与所有权

BC独立RuleParams文件来自Metarch选定pipeline的BC-owned rules_domain_gen.mjs，输入包括编译真源、rules/functions与实际Protocol/Entity签名；不是raw Scala InvariantRuleTemplate自动提供的通用输出。单/多模块仅改变该路径的放置。

JS正式render-domain.mjs#renderInvariant仅在layered Play service生成domain/invariant/params/<Name>RuleParams.scala；非layered调用直接传state/command/hosts，没有独立参数文件。该文件的emitted kind可仍为rules，不能把类别名当作必有独立kind。legacy invariant-dsl按非空paramDefs生成Params，retired rules overlay另行记录。

按profile和目标选择判断生成责任及文件形状，见[能力矩阵](../../CAPABILITY-MATRIX.md)。这是源码生产能力说明，不是本轮参数调用已编译、测试或最终批准的证据。

## 结构与命名

domain/invariant/params/<Name>RuleParams.scala中的各CommandParams；可嵌套对象，生成类型必须与调用顺序一致。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

规则参数依赖领域类型；需跨模块port的签名类型遵循kernel闭包。Behavior必须按真实签名构造而非另猜字段顺序。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

参数构造、字段顺序、默认值保真与规则调用编译；针对同类型换序需语义测试而非仅编译。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

### 第三批有限 domain-kernel 候选

`js-domain-kernel-candidate-v1`（实际入口 `scala-cqrs-domain-kernel-v1`，manifest `scala-cqrs-domain-kernel:1`）为显式选择的有限实现；不切换旧入口或银行消费。Per-command (state, command, hosts), with typed declarations retained; no decision implementation.

实际来源为 `generators/scala-cqrs-domain-kernel-v1/templates/params.mjs#paramsTemplate`；结构经 `buildModels`／`serializationModel`、有限 `render` 与逐职责模板，`sourceEntry` 记录来源，最终写入仍由 `src/core/generate.mjs#applyEntries` 承担。共享输出不重复算文件；完整范围见[有限合同](../DOMAIN-KERNEL.md)。

`implemented` 只表示上述代码确实存在。此登记阶段没有刷新观察或 source lock／coverage／矩阵，也没有编译、独立行为或最终审定通过声明；`approval:null`。真实证据必须绑定同一输入、全套最终产物字节及冻结工具指纹。 既有第二批14项 reference-only 资格不变；稳定外置 source 映射不恢复 inline `@knowledge`。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

主要实例：BC单/多模块的条件rules路径与JS正式layered service；legacy/retired另见上文。独立Params文件取决于目标选择，不能由类别名推定所有profile都生成。

- `bc:knowledge_base/design_docs/field_template/tools/rules_domain_gen.mjs` — `paramsFile`。
- `js:generators/scala-cqrs-domain/render-domain.mjs` — `renderInvariant`，layered参数分支。
- `js:generators/invariant-dsl/render.mjs` — legacy `paramDefs`/Params输出。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 类别依赖

`value-object`、`domain-state`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
