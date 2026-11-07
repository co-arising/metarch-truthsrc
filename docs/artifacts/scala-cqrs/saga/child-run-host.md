# 有限子运行与等待宿主

类别：`child-run-host`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

为显式有限child-plan创建/附着子Run，保持父子身份、结果与取消边界，不等任意动态fork/join图引擎。

## 输入与人工信息

child计划、输入输出、fanout上限/顺序、confirmed-prefix与持久结果关联显式；不知道规模不能默认为无界。

## 生产与所有权

- `js-formal`须显式选择child产品profile，由`scala-cqrs-child-application`入口及child renderers生成ChildHost、ChildJournal和host proto；仅注册基础application generator不会激活child产品。
- `bc-semantic-products`由独立ProductChildHostTemplate/ProductChildPlanTemplate经`generateProducts`写出；`bc-strict`的旧composition与`js-run-all-strict`的fixture composition则生成各自Invocation Host/Monarch child Plan。
- 这些有限应用wrapper消费旧StartRun/journal合同，不是R2 PersistentInbox，也不复制Monarch协调内核。

逐profile的生产链和生命周期见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)。P23冻结及银行未采用R2的边界不变。

## 结构与命名

正式child profile输出`ChildHost.scala`（invocation-host）、`ChildJournal.scala`（execution-plan）及child host proto；旧composition另有Child Plan。父Execution消费旧StartRun/等待桥，R2 PersistentInbox是另一库能力，不能按名字合并保证。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

子任务终态、父级确认与整个作业完成是不同提交事实；observer不能承载唯一业务效果。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

父子两侧重启、同ID冲突、迟到结果、有限性与未知状态。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

formal child、独立BC semantic及旧strict/run-all composition按各自入口解释。测试源码不等父子恢复行为证据，生成wrapper不授予最终模板批准或R2保证。

- `js:generators/scala-cqrs-child-application/generate.mjs` — `generate`。
- `js:generators/scala-cqrs-application/render-child-hosts.mjs` — `renderChildHosts`。
- `js:generators/scala-cqrs-application/render-child-plans.mjs` — `renderChildPlans`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/products/ProductChildHostTemplate.scala` — `generate`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/products/ProductChildPlanTemplate.scala` — `generate`。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；银行P23冻结不变。
