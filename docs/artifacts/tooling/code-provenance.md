# 产物来源与覆盖清单

类别：`code-provenance`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

记录产物和输入声明/版本/来源关系，支持解释是谁生成/实现的；不是把文件hash充当永久知识身份。

## 输入与人工信息

真实作者位置、展开节点、producer/最后写者、输入与输出快照，未映射明确标识。

## 生产与所有权

- `tooling`：手写JS/BC工具派生source index、provenance及project-evidence；`captureProject`/`projectPlan`经同图AST和公共writer输出`.truthsrc/`输入快照，不生成业务行为。
- BC `gen_provenance.mjs`的名称/stem启发式不是精确作者pointer证明；staging provenance还需追到pipeline apply，不能省略最后写者。
- `js-formal`的设计source index来自`product-design-review/produce.mjs`，不是代码锚；`js-legacy`的invariant emitter在`.scala`目标留下的单行生成标记也不是规则实现。

逐profile的产物、来源和证据限制见[CAPABILITY-MATRIX.md](../CAPABILITY-MATRIX.md)。手写关系、派生映射及运行验收不能相互替代。

## 结构与命名

provenance/source-index、project-evidence快照及本目录派生覆盖/矩阵提供来源证据；sources.lock固定被核对的源码revision/摘要。锁定记录不等执行日志，宏可N:1映到作者位置，不能虚构子pointer。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

与输入捕获、图AST、代码映射和最终字节联合验证；手写relation是人工声明，不自动证明业务语义。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

缺来源/旧快照/错指针/一对多、跨版本和原文保真；不以总数相同代替逐项对账。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

tooling、formal设计索引和legacy标记的产物意义按profile分别解释。测试源码不等执行证据，来源一致不自动批准目标模板或业务行为。

- `bc:tools/gen_provenance.mjs` — `INPUTS`、`fs.writeFileSync(OUT`。
- `js:lib/source-index.mjs` — `buildSourceIndex`。
- `js:lib/project/cli.mjs` — `captureProject`、`projectPlan`。
- `js:lib/project/graph.mjs` — `projectKnowledgeAst`。
- `js:generators/product-design-review/produce.mjs` — `produce`。
- `js:src/core/generate.mjs` — `applyEntries`。

来源revision、摘要及处置见[sources.lock.json](../sources.lock.json)；不以文档索引代替实际源码/最终字节。
