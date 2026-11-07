# Scala 参考实现与开发范式

本工作继承经过打磨的 BC Scala `CodeTemplate`、结构模型及参考代码，不把 BC mjs 产物或当前 JS 输出自动认作金样。代码来源覆盖回答“谁产生它”，参考资格回答“这个设计是否有依据并经过验证”；catalog 的 `implemented` 不是设计批准。

## 目标

让 DDD、FP/OO、Akka、Event Sourcing/CQRS、洋葱架构和 TDD 落实为人和 agent 都容易理解、局部修改、独立测试与追溯的开发方式。结构应减少重复决策，不以更多目录、接口、测试数量或审批材料代替质量。语义判断、兼容承诺和架构例外不能由生成器自行批准。

## 当前切片与边界

首批是 service profile 的聚合层：领域 State/Entity、旧消息兼容入口、应用 Protocol/Behavior/Aggregate、Factory、本地 Repository、基础设施 Bootstrap。结构 builder 只构造类型、引用、字段、顺序、来源和依赖；模板负责 Scala 语法和实际文本位置，既有 writer/映射机制继续负责最终产物。

银行 P23 的 State/Event/Request/Reply、协议、PB/PID、codec、金融规则和 runtime pin 不因风格改进改变。旧 domain Actor 入口、Entity/Protocol 类型别名及具体本地 Repository 是兼容约束，不是新项目的标准洋葱分层。新样例的机械验收不等于用户批准全新架构，也不等于银行服务、序列化或 R2 消费验收。

## 参考资格

- **继承依据**：经过打磨且仍适用的 BC Scala 模板/参考代码，按具体职责和版本引用，不认定整个 `reference_project` 都有相同资格。
- **兼容参考**：为当前既定公开合同独立编写、可编译测试的参考形状，明确保留例外。新增样例是工程候选，执行通过后记录实际证据，不伪造人工签收。
- **新设计候选**：组件升级或原 mjs 未打磨部分，先开发参考实现及独立测试，后参数化为模板；没有合格参考时显示未认证，不自动创建金样消除失败。
- **现状回归快照**：用于证明未改变受保护输出，不是审定金样。不得用待验证生成器同时改写独立预期。

## 单次开发流程

1. 明确业务意图、适用 profile、允许修改的位置和独立验收预期。
2. 从成熟 Scala 设计提取职责与惯用结构；参考代码由独立作者实现，不从待验证 renderer 复制后盖章。
3. 先写测试并记录实际失败，再完成参考代码；纯规则不启动 Actor/数据库，Actor 测试使用独占 testkit。
4. 以参考代码约束模板；在独立输入上验证结构模型、输出、依赖和文本映射。保留有意义的名字、字面量、方法体和顺序，不能删除全部空白冒等价。
5. 验证最终生成计划，而不只验证某个中间 writer；修改后仍核所有冻结载体，编译和行为结果分别报告。
6. 记录来源、设计依据、兼容例外、执行证据及未覆盖范围。新参考的人工审定与机械通过分开。

## 验收维度

- 人/agent：能够从一个聚合定位决策、事件演进、协议、宿主和测试，不要求读完所有 renderer。
- 架构：领域决策/事件 fold 不依赖 Actor；持久化装配只在 Bootstrap；局部行为组职责清楚，顺序由模型提供。
- 质量/测试：拒绝、成功、查询、外部授权和 Repository 生命周期分别验证；不以字符串出现证明运行语义。
- 演进：当前兼容名字不全局驼峰化；命名策略和 wire/知识身份分离，新设计不暗中迁移旧载体。
- 追溯：模板在渲染时记录来源，重构后的 UTF-8 span 必须与真实输出一致；不恢复 inline `@knowledge`。

## 已实现的首批路径

- `generators/scala-cqrs-play-service/build-aggregate-models.mjs`按七种职责构造不可变模型，`aggregate-names.mjs`集中当前兼容名字/路径；`templates/aggregate-*.mjs`分别负责协议、行为、工厂、仓储和Bootstrap。`renderAggregateLayers`只组合模型、模板和既有entry/writer。
- `generators/scala-cqrs-domain/build-state-models.mjs`与`templates/aggregate-state.mjs`分离状态默认值模型和渲染。未分层profile保持原输出；当前service的State/Entity仅调整空行和别名排版，JVM载体不搬迁。
- 仓库`test/reference/aggregate-layers/`保存七份独立Warehouse参考源码、显式集成构建和独立测试；`npm run test:aggregate-reference`比较完整源码、模型、依赖及UTF-8来源映射，不删除空白或方法体后冒等价。参考源码随源码仓提供，不把完整测试/JVM工具打进基础CLI包。
- 新生成行为按external/query/execution职责组合，而非猜测业务分组。Payload别名隔离业务命令与Actor信封；原Rule方法、外部producer身份和消息构造名暂不重命名。

2026-11-07实际独立本地执行：参考版与生成版分别编译通过，各24测试成功。测试包括纯规则、完整外部结果状态、异常授权、Actor恢复、仓储身份/Behavior传递和延迟日志确认前不得回复。Identity adapter及关闭testkit序列化是显式隔离手段，不代表PB往返、真实JVM崩溃或银行完整服务通过。最初缺Akka serializer依赖的失败保留，补齐已缓存依赖后在新目录重跑。完整Node、安装及银行候选的后续结果由当次验收记录单独陈述。

首个P1回流是`lib/handwritten-provenance.mjs`：公共工具验证明确手写关联的完整文件/来源指纹，银行保留schema、35文件/54引用、关系政策与snapshot约束。公共验证不读取银行历史模块、不写代码或索引，不要求JDK/Docker，也不把声明关联当语义正确。其他运行/租约/工作坊机制尚未迁移。

## 后续仍未关闭

全量 renderer 的命名与结构、多模块 port/implementation/root binding、strict Saga 和 Monarch R2 新参考分别需要自己的证据。本切片不扩展运行库、业务政策或 BC 全仓切换。P1 公共工具归属、P3 银行目录和 P4 全服务/人工验收继续保持原成果目标；本页不是它们完成的回执。
