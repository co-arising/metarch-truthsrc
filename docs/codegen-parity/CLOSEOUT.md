# 本轮文档收口与下一步决定

状态：**补缺、文档编制、独立复核和已发现勘误已收口；生成器实施未授权，实际同输入与运行验收未执行。** 本页是简明入口，详细来源、字段与RHS仍以各diff和机器表为准，不另建业务真源。

## 1. 已交付什么

| 交付 | 当前事实 | 边界 |
|---|---|---|
| Scala清单与JS分区 | 39传统＋3扩展；45 producers、641导航合同、591逻辑出现位置（A283/B308） | 38族仅部分对应，4 classic Trigger无对应；3个退休任意源码槽仍blocked，完整内容分区不能签通过 |
| 内容级diff | [application-service](diffs/application-service.diff.md)补齐后42/42份均保存，原15稿及852份固定基线不动 | 每份保留decision-required／missing等真实状态；不等目标已审定或实现完成 |
| 分工 | [assignment-map.json](assignment-map.json)重新装配为42制品／290独立写路径／132集成者路径／308 B逻辑项 | 旧277路径版及服务复核前290路径版均原样保留；共享源写权不取代逐输出assemblyOwner |
| F1输入 | [INPUT-MAPPING.md](fixtures/f1-credit-balance/INPUT-MAPPING.md)＋[mapping.json](fixtures/f1-credit-balance/mapping.json)：10命令、9写Helper、7事件、4状态字段，逐槽分开raw／curated／用户覆盖／候选 | raw与curated不是无损同输入，`lossless=false`；没有反推作者语义或批准九规则算法 |
| F1四件目标 | [TARGET-CONTRACT.md](expected/f1-credit-balance/TARGET-CONTRACT.md)＋[manifest.json](expected/f1-credit-balance/manifest.json)：Protocol／Helpers／Behaviors／Entity的完整成员、顺序、RHS与有限差异合同 | **4项expectedSha均null，4个计划Scala文件均未创建**；是目标合同，不是已冻结expected |
| F2输入 | [INPUT-MAPPING.md](fixtures/f2-warehouse/INPUT-MAPPING.md)＋[mapping.json](fixtures/f2-warehouse/mapping.json)：20项槽、14类目标文件角色、33项来源 | 没有传统BC无损adapter、实际历史wire bytes或完整expected；4个名义类型不合并，reserve identity fold不增加库存算法 |
| 覆盖反查 | [COVERAGE-MATRIX.md](fixtures/COVERAGE-MATRIX.md)＋[机器表](fixtures/coverage-matrix.json)：42族全列，32族173条structured条件、protobuf另2原名变体、其余9族原文条件 | 不是全部正交组合。F1候选18（四件＋14闭包）、F2候选8、并集19；不是覆盖率。B308项按197 fixture ID／292种完整metadata保留，全部未exercise |
| 公共接口 | [INTERFACE-DECISIONS.md](INTERFACE-DECISIONS.md)＋[机器表](details/interface-decisions.json)：13项字段／类型／命名／组装／表达式／实现槽／映射／profile／退役及供给合同 | 明确现有API、用户边界、集成者建议与待供给项；没有新增公共API或schema |
| common-core衔接 | [COMMON-CORE-CONSUMPTION-HANDOFF.md](COMMON-CORE-CONSUMPTION-HANDOFF.md)记录用户转述的`common-core-post-validation`下一版建议 | **尚未完成**，新坐标／字节／最终API未知；0.2不含withPost不是未来永久禁止，不提前消费 |

## 2. 复核具体纠正了什么

### application-service

- raw实际物理路径与multi台账多一层`app/app`分账，不把raw缺陷改写为目标要求。
- 补全`mergeManual`最近def名称、同名/匿名块出现序、新块保留和孤块拒写；不声称其按重载签名匹配。
- curated repository／bare factory返回EntityRef、初始化factory返回Future[Either]已知；未决收窄为与Examples的适配选择。
- 独立Function API并非当前调用链必需，D10移出阻断。
- Play Loader／Components生命周期恢复中央B归属，Bootstrap核心装配仍A；ResourceDirectory既定目标和owner明确，不另造trait。

对应两路原审阅及纠错后的独立复核分别保存在[首次workflow结果](details/fixture-design-workflow-results.json)与[局部纠错结果](details/targeted-corrections-workflow-results.json)。只读复核的“无剩余局部问题”不等于产品行为通过。

### F1／F2与覆盖矩阵

- Deposit点名三方法示例与AddInitial／Withdraw的curated候选分开；通用失败不persist、成功读新state不变。同形RHS不自动扩大授权。
- `userId`无默认表达式与Scala `None`分开；21个curated字段的来源指向独立Protocol声明，不再冒称PB合成来源。
- F2的HAND计数改为11份源码/配置＋1份旧ABI文档，补准userId来源引用；33项来源不变。
- F1补入TransferValidator最小依赖候选与已有helper-method-slots；173条条件的原ID/condition不改。proto名明确三层：raw输入`credits.proto`、传统Builder输出`credit_balance.proto`、curated历史引用`credits`。
- [覆盖裁定](details/coverage-review-resolutions.json)保留发现与修正理由；application-service新增writer说明已同步到覆盖矩阵，不改B分类或候选计数。

### 接口、来源与所有权

- 用户原话与主agent分工分开，不用内部提示制造用户授权；初次作者写集合不等整个会话权限。
- 类型身份保留真实nested owner；正常源码按目标显式import成员并用简名，不默认到处Owner/FQN。
- 完整文件内容与具体映射沿用中央`target.assemblyOwner`；main负责共享源码/writer/mapping写权与协调。
- common新进展纳入有身份的文档来源，不冒充发布证据；详情见[接口复核裁定](details/interface-review-resolutions.json)。

## 3. 文档核对与运行验证分账

- 静态核对：42份diff与分工hash一致；纠错后源写集合、B分配和其余41个制品记录未变。
- F1输入／F1目标／F2／接口／覆盖矩阵的来源记录分别为42／25／33／17／78；这是**引用记录数，非去重文件数**。来源字节、JSON指针与声明范围按[本轮静态收口记录](details/documentation-closeout-check.json)核对。
- 852份固定基线与原15稿仍按原索引/窗口字节保持；历史静态记录保留其时点，不反写成当前结果。
- **Runtime verification：SKIP — docs-only，无新增运行面。** 未执行生成、validate/roundtrip、编译、测试、typecheck、服务、数据库、银行workshop/38、真实JAR ABI、CC度量或回锚运行。未提交、推送、发布、创建worktree或清理运行数据。

## 4. 后续只做有实质内容的决定，不再补盘点数量

1. **先裁F1四件与输入槽。** 推荐继续保留raw独立证据，以当前curated为候选而非自动金样；集中决定AddInitial／Withdraw及六阶段回复、GetBalance投影、额外TransferConfirmation、State optional/default与事件时钟、包/命名/顺序和实现槽owner。逐项接受或拒绝后，才能冻结完整目标字节及建立双端无损adapter；不从金融散文推算法。
2. **按真实common交接调整受影响闭包。** 等`common-core-post-validation`给出实际发布/供给坐标、SHA、公开API和post/persist/publish/reply顺序；明确case-class/旧overload策略及同FQN唯一来源。业务postconditions留业务侧；MoneyOps另项；auth归auth-core。本线不接管发布。
3. **F2与其它变体不假托F1覆盖。** Warehouse先解决绑定/nominal/state/回复/FormalFold无损映射与真实wire语料；shared proto、投影、classic/strict/composition/API按矩阵补专属输入。三退休槽只在确有消费者时固定实际源码再分区，不主动复活。
4. **实施仍单独准入。** 有审定diff、输入/target、接口和实际供给后，按既有分工并行改新MBT文件；公共热点由集成者协调。真实公开CLI生成与必要接口观察集中到受影响闭包，不重跑整套银行来填文档证据。

本轮只结束文档编制与纠错，不把余下业务/接口/供给决定伪装为已解决，也不新开生成器实施或银行验收。
