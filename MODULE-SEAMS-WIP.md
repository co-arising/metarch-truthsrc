# 第五批 module-seams — A 完成／B 未收口工作检查点

日期：2026-11-08。用户要求“先提交，然后给我一个压缩上下文的窗口”。本检查点保存本会话已落盘的 A/B 工作，**不是第五批验收、全仓绿色状态、Scala 编译证明或架构最终批准**。无发布或银行运行切换。

## 已完成与实际验证

### A：有限静态门完成

- 单 context Parcel 作者树位于 `scaffold/module-seams-project/truth/module-seams`；8 VO 唯一定义，3 ports；两个版本化产品 `module-seams-contract@1`、`module-seams-composition@1`，明确名义类型、构造参数组、条件 Bridge 与 root 选择。
- 实际作者 validate 硬错误为空、roundtrip 11 个原子通过；完整静态产品与 lowering 得到7个生成生产文件模型及3个外置手写声明。
- 初次 A 定向102与相关229通过后，独立审阅找到5项问题，均已窄修：名义 Int/Integer 误解析、project context 未对账、旧非字符串 schemaVersion 的 TypeError、role 数组绕过、继承/自动成员冲突。
- 修复新增105条回归，真实 RED 为28 pass/77语义 fail；修后105＋102＋229＝436 pass、0 fail/skip。独立限范围复验105/105，未发现相同绕过。
- A修后重新对账14个旧样例完整 request/options/manifest/compilation/result/plan，共942 entries 全等。此结果属于 A 修后时点，**不能当作 B 共享接线后的旧回归**。

### B：实现已落盘，尚有缺陷

- 显式生成入口 `generators/scala-cqrs-module-seams-v1/`，目标 `scala-cqrs-module-seams@1`。
- 固定样例完整 producer plan 为11 entries：7份生产Scala、2份构建文件、2份生成形状测试，172 mappings。项目 writer 另外加入4份 `.truthsrc` 派生证据，ledger/anchors另列。
- 三份手写 CapacityRule / InMemoryRouteRepository / DefaultQuoteFlow 留在各自 `handwritten/{kernel,glue,ext}`；不复制入生成输出、不计生成覆盖。root保持 `ParcelModule.create(routes)(implicit executionContext): QuoteFlow`。
- 共享接线包括 live implementation capture、相对options与绝对build路径分离、snapshot/AST/inputs对账、手写变化的过期检查、独立file级来源证据、`--implementation`查询以及验证/视图展示。source-plan/v1及通用writer协议未升级。
- capture 定向127/127；独立24个探针无捕获范围阻断。template定向47/47，使用真实capture而非mock。
- 项目集成首轮8项中7pass/1fail：主测试误用 `/src/main/scala/` 筛选漏掉根 `src/main/scala/.../ParcelModule.scala`。修正两处筛选、增加独立7路径全等并保持期望7后，第二轮8/8通过，源码前后无漂移。未修改producer来消除此测试错误。

## B 已确认的3项问题（本次不修复）

1. **合法VO文件分组被文件DAG误拒。** 只把 Parcel 分到独立文件会产生文件互引，而名义类型图无环。新族误用旧 `renderJobs` 的DAG假设。拟在family3局部求可达依赖闭包、排除self并保留真实互引；现有writer只记录deps，无需改协议。不能删deps或改作者绕过。
2. **生成形状测试与生产类型的FQN冲突。** 新增合法同名 sum `ModuleSeamsValueShapeSpec` 后，suite与生产trait在同包同名。拟将support测试放独立技术包并联合检查所有生成/手写声明的FQN及portable路径，不删除测试或重命名业务sum。
3. **缺失/无效历史证据的query早退遗漏关闭current capture。** `lib/project/query.mjs` 的 `prior.state !== 'verified'` 分支没有调用 `closeCapture`；受控作者保存后仍可返回旧 `currentSelection`。实际状态是unknown，不是虚构verified代码。拟关闭捕获、重算status，重验失败时不暴露旧当前选择，保持旧查询语义。

模板独立审阅的两个问题属于泛化变体；固定样例8/8不抵消它们。共享独立审阅8探针中1个确认反例；捕获的“无阻断”不代表整个B通过。

## 未完成／未验证

- B上述3项修复及新反例、修后完整项目和旧入口回归、B有限收口。
- 旧B回归任务只留下初始化源码清单、计划pin和runner；未发现完成报告或测试日志，**没有可计的 B 后14计划／family1／family2／旧project回归结果**。
- C/D：真正四模块Scala编译、独立业务oracle、正负编译和变异控制、安装后完整消费、适用旧JVM回归。
- E：producer/category登记、当前source lock/coverage/matrix与文档同步、观察重新生成及适用同样例资格；当前active observations仍0。
- 完整Node、完整artifact、onboarding、八仓source门未在本停点重跑。当前新增producer及工具源码尚未同步能力catalog/source lock，**现有artifact/freshness门可能因登记和来源漂移失败，这是WIP，不允许沿用旧校验结果宣布通过**。旧锁与历史回执没有为了提交而重签。
- 新功能帮助/公开教学导航与最终接口文档仍需收口。现有源码是可继续工作的实现，不是已发布交付包。

## 历史失败与资源事实

所有RED/中间失败保留。capture曾发生120秒 `spawnSync` 超时，只留ETIMEDOUT和15-byte TAP头，没有PID/reap证明；不能用当前无Node来补签历史回收，也未清理可能的旧输出。其8MiB预算是stat先验与后验检查，不是恶意无限并发插入下的原子累计读取限额；源根需协调，不能宣称FS锁或回滚。

本次停点检查仅见检查进程本身，没有其他Node/JVM。两个旧task的停止调用返回No task found；本报告不将它冒称成功取消，以上结论来自实际文件与进程检查。未操作服务、数据库、共享生成应用、银行apply、R2或已冻结制品。

## 保护与续接

- 本次只提交本会话源码/样例/测试和本说明；BC协调板只提交本人 `module-seams-20261108` 一行，peer板保留；银行/Play无本次提交。
- 原102个dirty文件、126份保护文件、20份历史观察回执继续保持；先前3个A草稿现已实现并验证，属于本次源码提交，不再单独保留为未提交草稿。
- 原Parcel独立参考与oracle、旧generator（除共享entry新增固定owner）、source-plan/writer、P23/PB/PID/codec/journal均保持对应边界。BC JS产物不作为用户认可金样。
- 本机续接入口：`.rounds/module-seams-r_ya32kf/WIP-COMMIT-HANDOFF.md`。该目录是ignored证据，不是发布渠道；本说明提供仓内可见的状态与已知缺陷。
- 下一步只修上述3项并补RED/GREEN，再验B旧输入/图/来源/所有权；不得重开已完成A五项审计或用新guard无限滚动。随后按批准计划进入C/D/E。
- 不重跑任何已消费的exclusive捕获/退休/提交脚本，不删除失败或改历史pin。后续commit/push需要相应授权；本次无push/tag/publish。
