# 命令参数转换与处理助手

类别：`command-helper`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

BC侧把应用命令转换为规则参数；JS正式域侧提供命令到事件的类型化构造助手及显式注入计算接口，不能把两种形状混成同一toParam协议。它们都不应成为绕过规则的副作用后门。

## 输入与人工信息

由参数来源和声明的函数/port映射构建；缺来源不应按字段同名自动补齐语义。

## 生产与所有权

BC原生CommandHelpersBuilder/Template从application.aggregates（排除transactor）生成application/aggregates/behaviors/<Name>CommandHelpers.scala；Metarch选定pipeline还可由BC-owned rules_domain_gen.mjs依据rules/functions和实际签名后写。初始生产者、条件最终内容写入者及staging apply应分别记录，不能只列Node脚本或归给metarch-truthsrc。

JS正式render-domain.mjs#renderCommand消费domain-dependencies等typed产品，在domain/<Name>CommandHelpers.scala内生成Computations trait与命令到事件构造方法；计算业务体由调用方实现。legacy command-dsl另生成implicit CommandHelper/toParam与reply构造，retired scala-cqrs-es只是历史骨架。

能力与来源按profile分别记录，见[能力矩阵](../../CAPABILITY-MATRIX.md)。签名类型应满足接口模块可见性，但源码放置不证明递归闭包、调用编译或最终批准。

## 结构与命名

<Name>CommandHelpers或Computations，通常与规则/Behavior同族生成；保持public兼容签名时可保留薄桥。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

多模块目标要求签名可达类型在kernel中闭合；需要ext实现的函数通过port和装配根传入，而不是硬编码实现FQN。当前生成/import选择本身不是递归闭包检查的证明，JS单项目也不由此取得多模块保证。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

逐字段来源、重复/缺省/类型错配和真实Behavior调用，副作用依赖不得偷偷进入纯helper。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

### 第四批有限 aggregate-core 候选（当前登记，非验收）

`js-aggregate-core-candidate-v1` 对应实际入口 `scala-cqrs-aggregate-core-v1`、manifest `scala-cqrs-aggregate-core@1`。kernel/domain/command中的纯helper只按event/slot产品顺序构造声明事件；host实参遵循真实inputDependencies，同一表达式occurrence正常求值，不因deps去重缓存host。没有persist/reply。

本页登记的物理输出为 `modules/kernel/src/main/scala/**/domain/command/*.scala`。实际来源为 `generators/scala-cqrs-aggregate-core-v1/templates/command-helpers.mjs#commandHelpersTemplate`；`generators/scala-cqrs-aggregate-core-v1/build-models.mjs#buildModels`。新入口组合复用的family1生产jobs和本族jobs，经 `generators/scala-cqrs-domain-kernel-v1/render.mjs#renderJobs` 与固定 `entry.mjs#aggregateSourceEntry` owner，最后由 `src/core/generate.mjs#applyEntries` 写入；复用指向原物理模板，不存在新族VO/PB复制模板。

冻结工具/来源指纹下，catalog当前实际登记20份观察（原12份样例generated；family1/family2各1份complete-plan generated及3份同样例源码generated/compiled/behavior-verified）。本页本族源码已取得同一Warehouse样例的generated、compiled、behavior-verified资格，包含实际生成的支持测试；只证明该冻结输入与最终产物字节，不推广至全profile，final-approved=0。原16条观察及74条变体引用已原样保入[历史索引](../../evidence/capability-domain-kernel-final-history.json)，原receipt路径/字节不动、不续签，其旧锁下的资格不算current；初/二/三批原验收仍保留。两类build只取得generated资格，不借源码编译/行为回执晋升。有限范围见[本族合同](../AGGREGATE-CORE.md)；无Bank、外部结果桥、完整四模块/服务或最终批准。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

主要实例：bc-single / bc-multi / js-formal；legacy/retired另见上文。BC原生初始结构、BC条件后写与JS正式构造助手各自负责自己的输出，不以文件头或同名kind代替溯源。

- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/CommandHelpersTemplate.scala` — `CommandHelpersTemplate`。
- `bc:knowledge_base/design_docs/field_template/tools/rules_domain_gen.mjs` — `helpersFile`，条件后写。
- `js:generators/scala-cqrs-domain/render-domain.mjs` — `renderCommand`。
- `js:generators/command-dsl/render.mjs` — legacy `render`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 类别依赖

`rule-parameters`、`computation-port`。这些是职责依赖，不代替真实Scala import或执行顺序验证。

## 第六批有限 persistence-readside 候选登记

本类新增 `js-persistence-readside-candidate-v1`，由显式 `scala-cqrs-persistence-readside-v1`／`scala-cqrs-persistence-readside@1` 提供；模块为 `kernel`。本段只登记实际源结构，不宣称本批已完成或已编译。

实际输出合同（可覆盖同一物理文件中的不同职责，不按合同数冒充文件数）

- `command-helper`／`command-helpers`：Pure declared-event construction in product slot order; actual host parameters follow ordered inputDependencies. No persistence/replies or host memoization inferred from dependency deduplication. 路径 `modules/kernel/src/main/scala/**/domain/command/*.scala`。

输入为唯一业务作者树、原七个 family2 产品及显式 persistence-readside 技术 binding；wire layout SHA 必须核对，不能自动重签。沿用 family2 kernel/glue 和唯一 writer；生成测试与独立 oracle 分开，sbt 定义存在不等任务执行。

本次登记移除旧 active evidence 引用，原24观察和旧回执在[独立历史索引](../../evidence/capability-persistence-readside-prior-current06-history.json)保真；新观察要在生产冻结后单独采集并通过原公共验证器。本段及目录 implemented 仅表示实现存在，当前 generated/compiled/behavior/final-approved 不由本配方晋升。范围与限制见[本族合同](../PERSISTENCE-READSIDE.md)。

读侧文件库重放不是生产 Actor journal 耐久性；不扩张为 MySQL、任意读模型、HTTP、银行/Saga/Monarch 或架构批准。

## 第八批有限 Play 应用入口

新增 `js-play-application-candidate-v1`，由 `scala-cqrs-play-application-v1` 提供。原先profile的缺口描述保留为对应历史，不覆盖本段的新有限入口。

- `command-helper`：Pure declared-event construction in product slot order; actual host parameters follow ordered inputDependencies. No persistence/replies or host memoization inferred from dependency deduplication.

唯一作者和显式技术/外置实现bindings经过公共单writer；源码、真实编译、HTTP行为、安装与最终批准逐层记证。有限范围及不适用项见[本族合同](../PLAY-APPLICATION.md)；旧回执不重签，不表示银行或完整modular target已最终批准。
