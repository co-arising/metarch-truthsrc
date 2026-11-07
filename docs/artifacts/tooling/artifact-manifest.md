# 生成Manifest与产物计划

类别：`artifact-manifest`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

声明输入/producer/输出kind，形成可检查的文件/dependency计划以及写入处置。不把semantic product ID和代码artifact类别混成同一层。

## 输入与人工信息

generator版本、产品/能力、完整输入来源及目标路径，overwrite/MANUAL规则是显式技术政策。

## 生产与所有权

- `tooling`有两层责任：`generator.json`是维护者编写的输入/能力声明；`planProductSet`产生的source-product plan以及BC `gen_manifest.mjs`形成的staging-to-target处置计划才是派生证据。
- BC的ADD/COVER/MERGE/KEEP/DELETE计划不等于已apply，也不证明目标可编译；必须保留实际writer和最终处置。
- `js-starter-copy`只是复制并替换名称的starter manifest，属reference用途，不把手工声明重新分类为业务生成结果。

逐profile的声明、派生计划和证据边界见[CAPABILITY-MATRIX.md](../CAPABILITY-MATRIX.md)。计划通过不自动批准模板或业务交付。

## 结构与命名

generator.json/source-product-plan、BC manifest；同kind可对应多职责，目录元数据不反向限制第三方自定义kind。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

正式profile验证producer只能访问声明产品、依赖闭包完整；apply检查当前目标状态，不以旧plan担保写入时未变。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

未知/漏product、重复路径/大小写alias、依赖缺失、跨kind覆盖、源变化和非确定输出拒绝。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

适用profile按本页生产说明及派生矩阵解释，手写manifest、starter复制与派生计划不能合成一个状态。测试源码不等执行证据；计划/校验通过不自动授予最终模板批准。

- `js:src/core/manifest.mjs` — `loadManifest`。
- `js:src/core/product-plan.mjs` — `planProductSet`。
- `bc:knowledge_base/design_docs/field_template/tools/gen_manifest.mjs` — `manifest`。

来源revision、摘要及处置见[sources.lock.json](../sources.lock.json)；本页不作生成或运行认证。
