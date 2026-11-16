# common-core 演进通报与生成侧消费边界

状态：**用户转述的并行进展与逐项建议；`common-core-post-validation` 尚未完成。未提供新发布坐标、制品字节或最终 API，本线不声称新版本已发布、已验证或可消费。**

## 1. 来源与当前基准

- 用户此前裁定：common package 的不一致以已发布最新 common-core 为主；当时工作区 `common-core/` 对应 `net.imadz:common-core_2.13:0.2` 源码。固定旧源码/API证据见 [glue-dependencies.md](glue-dependencies.md)。这不是对并行修改后的 live 目录永久等于 0.2 的保证。
- 用户本次通报：另一 agent `common-core-post-validation` 正推进演进，大概会发布含 post-validation/`withPost` 的新版本，并逐项排除不应归入 common-core 的内容；**“还未完成”**。
- 下表记录的是用户转述的建议及本线的消费处理，不冒充该 agent 的最终结论、实际提交、API 审批或发布回执。本线未调查其工作树、未读取新 JAR、未执行发布或升级。

**版本限定：** “`withPost` 不在发布 API 中”目前只指已知的 **0.2**。新版本若正式提供该能力，经准确制品/接口交接后可重新审定消费；不能写成永久禁用，也不能仅凭此通报提前把生成目标改成调用 `withPost`。

## 2. 逐项建议与消费处理

| 差异 | 用户转述的建议 | 本线处理与尚需事实 |
|---|---|---|
| 事件产生后、persist 前校验 | 纳入下一版 common-core；属于通用命令处理编排，不长期藏在 scaffold 副本 | 登记为下一版候选能力；通用库只负责调用时机。最终输入、返回值、校验旧/候选 State 的关系、拒绝与异常处理等待真实 API；不从 scaffold 签名推定 |
| `withPost` 调用形式 | 可保留并正式提供，承接已有生成调用 | 0.2 路线不可调用；新版本路线待正式签名及与 publish 的组合合同。不得仅由同名断言源码或二进制兼容 |
| 第五个公开 case-class 字段 `post` | 不照搬；默认参数不等于二进制兼容 | 不将 scaffold 五字段结构作为目标。须明确 constructor、apply、copy、unapply/extractor、Product arity 及旧调用形式的兼容策略，不在此发明最终封装设计 |
| `policy` 替代 `rule` | 不回迁，保留发布 API 的 `rule` | 目标命名沿用 `rule`；named args、copy/extractor 与 positional 调用分别核，不能因位置调用相同而合并合同 |
| scaffold 缺 publish | 不照搬缺失；合并后同时支持校验与既有发布 | 保留 `replyWith` 与 `replyWithAndPublish` 的不同副作用；等待新 API 明确组合、顺序和重复配置行为，不静默丢失或新增发布 |
| `checkEventPostconditions`、各聚合规则 | 不进 common-core | 业务条件、错误定义、生成逻辑及其独立 oracle 留在业务/生成侧；通用库不能内置银行算法，也不能根据散文猜出条件 |
| `MoneyOps` | 另项处理，不绑进 helper 合并；纯函数也可能绑定特定金额表示 | 不因其包名为 common 自动纳入 jar；不复制进生成目标兜底。金额表示、单位、精度、舍入/溢出与共享 owner 单独裁定；缺依赖时只阻断实际引用闭包 |
| `common/auth/*` | 不进 common-core；转述称9文件与 auth-core 一致 | 归既有 auth-core 独立库，不能同 FQN source-copy 与 jar 双供给。**9文件一致性是本次转述事实，本线未独立比对**；具体消费版本/字节另核 |

以上不自动扩大本会话的生产写权限，也不替另一 agent 审批或执行发布。

## 3. 新版本交接所需最小事实

1. **身份**：准确 group/artifact/Scala 后缀/version、制品取得位置与 SHA-256、发布/供给是否已完成；只报版本意向或源码 HEAD 不够。未知版本目前记为未提供，不能自行命名为 0.3 或其它版本。
2. **公开 API**：`CommandHelper`、`runReplyingPolicy`、运行对象和 overload 的完整签名；`rule` 的参数名；`withPost` 的返回类型/链式调用合同；既有 constructor/apply/copy/extractor/Product 形状的处理结论。
3. **顺序与错误**：rule Left、rule Right(empty/nonempty)、post 拒绝、post 异常、persist 失败、publish 和 reply 各自发生顺序。消费方至少要求拒绝不 persist、不 publish，成功回复读取事件应用后的 State；异常策略不能未经合同自动折叠为业务拒绝。具体 post 回调参数和空事件处理不可从本表反推。
4. **组合**：post 与 `replyWith`／`replyWithAndPublish` 的组合、校验次数、发布事件集合与顺序、重复 `withPost` 是覆盖还是组合等必须有最终定义；不把 EventStream 误说成耐久 outbox。
5. **唯一供给**：目标工程哪些同 FQN scaffold/common 源应停止复制、哪些归 common-core、哪些归 auth-core、哪些是业务支撑；新 jar 与冲突源不能并存。发布成功不代表当前消费者已经切换 classpath。
6. **最小消费证据**：受影响生成路径与新 jar 的实际消费证据、必要真实接口观察。源码、类型检查、编译或测试结果各有边界，不单独代替运行观察；本窗口未执行这些步骤。

这些是一次性交接字段，不是为每个模板新增一轮银行验收。只影响 helper／behavior／相关服务与装配的依赖闭包，不重跑 workshop/38，不改固定银行身份、PB/PID、journal 或旧回执。

## 4. 文档合并顺序

- [glue-dependencies.md](glue-dependencies.md) 保留固定 0.2 与 scaffold 的历史对照；新增能力列为 pending handoff，不回写成旧制品曾支持。
- [ASSIGNMENT-MAP.md](ASSIGNMENT-MAP.md) 与 [INTERFACE-DECISIONS.md](INTERFACE-DECISIONS.md) 的消费准入指向本页；实际所选新制品尚未锁定，相关实施继续 blocked。
- 已保存 diff 中的 0.2 观察仍有效；若措辞是不带版本的永久禁止，以本页的版本限定澄清。待最终交接到达后，一次集中裁定受影响 diff/profile/fixture，不先行改生成器或复制 private helper。
- MoneyOps、auth 以及业务 postconditions 分账，不把 common 包路径当库所有权或发布能力证明。

**本线继续完成 docs-only 工作。** 演进实施与发布由 `common-core-post-validation` 负责；生成侧升级、真实消费者验证及任何发布另循对应授权。
