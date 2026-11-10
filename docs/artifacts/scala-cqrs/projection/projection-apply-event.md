# 读侧纯状态变换

类别：`projection-apply-event`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

把领域事件与旧读模型映射为新读模型或更新指令。它是投影中的纯部分，不拥有数据库事务/连接。

## 输入与人工信息

字段血缘、identity、create/updateOnly/delete、时间戳零值和空值容忍语义由合同决定。不能把严格decode前置后改变旧业务守卫含义。

## 生产与所有权

- `bc-single`：不生成独立纯 ApplyEvent 产物。`ProjectionBuilder` 仅在 `codegen.multiProject=true` 时填充 applyEvents，生成器仅在该集合非空时输出；single handler 内的更新代码不是这个独立产物。
- `bc-multi`：BC `ProjectionBuilder → ProjectionApplyEventTemplate` 生成纯变换，和 glue 的解码/存储机制分开。
- `js-formal`：原生 `render-journal-domain.mjs` 的 `renderJournalDomain` 才是纯函数 producer，公共写入器落盘；`viewrepo.mjs` 生成仓储，不是纯 ApplyEvent。
- legacy `smviews` 的内联变换属于 handler 机制，不能新增记作独立纯文件生成能力。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

<View>ApplyEvent或按族合并的纯函数；与PO decode和Repository执行分离，业务字段命名遵循真实类型，不添加临时技术别名污染统一语言。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

kernel纯函数只依赖领域Event/Row，glue ViewMachine读取旧行并执行写入。查无行时是否创建是显式规则。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

create与updateOnly两形、墓碑、复合键和存量脏数据容忍案例；纯函数测试不等真实投影事务验收。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。

### 类别依赖

`read-model`、`domain-protocol`。这些是职责依赖，不代替真实Scala import或执行顺序验证。

## 第六批有限 persistence-readside 候选登记

本类新增 `js-persistence-readside-candidate-v1`，由显式 `scala-cqrs-persistence-readside-v1`／`scala-cqrs-persistence-readside@1` 提供；模块为 `glue`。本段只登记实际源结构，不宣称本批已完成或已编译。

实际输出合同（可覆盖同一物理文件中的不同职责，不按合同数冒充文件数）

- `readside-handler`／`projection-handler`：Same-connection sequence/duplicate checks, existing domain EventHandler fold, event/state/index/checkpoint writes; does not duplicate business rules. 路径 `modules/glue/src/main/scala/**/infrastructure/readside/*.scala`。

输入为唯一业务作者树、原七个 family2 产品及显式 persistence-readside 技术 binding；wire layout SHA 必须核对，不能自动重签。沿用 family2 kernel/glue 和唯一 writer；生成测试与独立 oracle 分开，sbt 定义存在不等任务执行。

本次登记移除旧 active evidence 引用，原24观察和旧回执在[独立历史索引](../../evidence/capability-persistence-readside-prior-current06-history.json)保真；新观察要在生产冻结后单独采集并通过原公共验证器。本段及目录 implemented 仅表示实现存在，当前 generated/compiled/behavior/final-approved 不由本配方晋升。范围与限制见[本族合同](../PERSISTENCE-READSIDE.md)。

读侧文件库重放不是生产 Actor journal 耐久性；不扩张为 MySQL、任意读模型、HTTP、银行/Saga/Monarch 或架构批准。

## 第八批有限 Play 应用入口

新增 `js-play-application-candidate-v1`，由 `scala-cqrs-play-application-v1` 提供。原先profile的缺口描述保留为对应历史，不覆盖本段的新有限入口。

- `readside-handler`：Same-connection sequence/duplicate checks, existing domain EventHandler fold, event/state/index/checkpoint writes; does not duplicate business rules.

唯一作者和显式技术/外置实现bindings经过公共单writer；源码、真实编译、HTTP行为、安装与最终批准逐层记证。有限范围及不适用项见[本族合同](../PLAY-APPLICATION.md)；旧回执不重签，不表示银行或完整modular target已最终批准。
