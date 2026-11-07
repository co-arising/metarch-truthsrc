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
