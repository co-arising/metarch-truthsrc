# 产品设计审阅产物

类别：`design-review-artifact`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

把显式五平面产品设计输出为模型/图/来源索引供讨论，不生成完整页面实现或自动批准设计。

## 输入与人工信息

角色、journey、页面反馈、数据水位、操作和风险等设计输入与approval状态须保持原文。

## 生产与所有权

- `js-formal`：`compileProductDesigns`编译设计，`product-design-review`的producer派生模型JSON、Mermaid平面图和source index，由公共writer写入。
- `bc-semantic-products`：独立的`ProductDesignBuilder`/`ProductDesignModel`/`ProductDesignTemplate`经`generateProducts`写出审阅产物；不能用JS源码冒作BC生产链。
- 两者都是`derive-evidence`，不是可运行页面或业务服务。作者的approval状态原样保留，输出图不授予最终批准。

逐profile的生产链和证据级别见[CAPABILITY-MATRIX.md](../CAPABILITY-MATRIX.md)。

## 结构与命名

model JSON、Mermaid plane图和source-index，文档产物标design-review-only/runnable=false。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

使用正式product-design profile和公共writer；图中步骤不因出现就变成可执行金融政策。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

设计完整保真、状态/顺序/来源、确定性和未知字段拒绝；图美观不等业务验收。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

`js-formal`与`bc-semantic-products`分别有独立生产链，不能用其中一方的implemented或测试源码证明另一方生成/编译。审阅状态与最终批准由显式流程决定，不由writer升级。

- `js:generators/product-design-review/generate.mjs` — `generate`。
- `js:generators/product-design-review/produce.mjs` — `produce`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/products/ProductDesignBuilder.scala` — `build`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/products/ProductDesignModel.scala` — `ProductDesignModel`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/products/ProductDesignTemplate.scala` — `generate`。

来源revision、摘要及处置见[sources.lock.json](../sources.lock.json)；设计产物不作运行认证。
