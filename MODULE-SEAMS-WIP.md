# 第五批 module-seams — A静态完成／B修复回归检查点

日期：2026-11-08。按用户“先提交，然后给我一个压缩上下文的窗口”保存阶段成果。**这是A/B工作检查点，不是第五批整体验收、Scala编译证明、发布或架构最终批准。** C/D/E尚未完成，无银行运行切换。

## A：已完成的有限静态门

- 单context Parcel作者树在 `scaffold/module-seams-project/truth/module-seams`；8 VO唯一定义、3 ports；两个版本化产品 `module-seams-contract@1`、`module-seams-composition@1`，明确名义类型、构造参数组、条件Bridge和root选择。
- 作者validate无硬错误，roundtrip11个原子；lowering区分7份生成生产文件与3份外置手写声明。
- 原五项静态问题已修：Int/Integer名义类型误解析、project context未对账、旧非字符串schemaVersion的TypeError、role数组绕过、继承/自动成员冲突。新增105回归曾真实RED28pass/77fail；修后105＋102＋229＝436pass，独立限五项105/105。
- A结论不扩为Scala/JVM或任意完整CQRS应用能力。

## B：实现、三项修复与实际回归

显式入口 `generators/scala-cqrs-module-seams-v1/`，目标 `scala-cqrs-module-seams@1`。主样例11个producer entries＝7生产Scala＋2构建文件＋2形状测试；项目writer另加4份派生证据，ledger/anchors另列。

三手写实现 CapacityRule、InMemoryRouteRepository、DefaultQuoteFlow留在外置源根，不复制进生成输出、不计生成算法覆盖。root保持 `ParcelModule.create(routes)(implicit executionContext): QuoteFlow`。共享链路包含live capture、完整membership和字节重验、snapshot/AST/inputs对账、手写变化过期检查、独立file级来源、`--implementation`查询与verify/view；不升级source-plan/v1或通用writer。

### 本次三项修复

1. **T1合法VO文件互引**：family3局部按起点计算DFS可达依赖闭包，排除自身、保持首次发现顺序；模板前校验完整路径、portable冲突、kind及依赖目标。仍复用同一final-byte mapper，不改旧family1 `renderJobs`、不删真实依赖。
2. **T2支持测试FQN冲突**：两个suite迁到 `<context package>.verification`，集中名称解析器联合检查生产、手写声明和support，检查全部逻辑路径。业务sum名称与公开root API不变。
3. **S1query早退漏重验**：prior非verified时先关闭捕获再重算status；发现当前源变化时清空旧`currentSelection`。正常legacy无generation仍保留unknown与当前作者选择的既有含义。

### 实际测试与失败记录

- 新反例17项：修前7pass/10fail。其中几项是更严格的预检诊断断言，**不是10个独立业务缺陷**。
- 首次修后64项仅25pass/39fail：主新增路径检查误将 `target.files: string[]` 当成对象数组，正常生成被拒；query7项全过。保留失败日志，不改期望。
- 修正上述路径循环后，**64/64通过**，无skip/fail/cancel；自然close，三生产/三测试文件前后SHA相同。
- 两次有效的有界独立静态复核分别检查T1/T2与S1，未发现该范围阻断。不把异常结束、没有有效报告的其它代理算成审阅通过；静态审阅不冒称JVM执行。
- 新B回归已自然完成：**724/724通过**，无skip/fail/cancel/todo；module-seams406、family1 107、family2 105、scala-target38、旧project/handwritten/provenance68。七个子进程与外层runner均自然close code0/signalnull；整个运行前后源码库存保持。
- 同轮作者validate与roundtrip通过；从现行fixtures及真实generators重新构造旧14份完整request/options/manifest/compilation/result/plan，共**942 entries全等**。这是本次B后回归，不沿用A或缺失的旧B回归结果。

### 新旧计划的准确对账

历史 `b-template-plan01` 仅存条目摘要，缺历史merge与完整codeMappings，不能宣称历史完整映射全等。本次7份生产摘要全部相符；另以同一新捕获输入及build roots运行WIP HEAD两模块与当前实现，**7生产＋2构建的9个完整entries全等**，仅2个support按批准改变包/路径。两次公共producer完整结果确定。

该同输入对照是新的算法回归，不回填历史证据；不因byte摘要相同升级历史认证范围。

## 尚未完成／未验证

- B正式主门裁定与后续C入口合同尚未单独收口；本停点保存修复及有效回归，不自动进入C。
- C/D：四模块真实Scala编译、34独立业务案例、正负编译与mutation控制、安装后混合源码消费及适用旧JVM回归。
- E：producer/category登记、source lock/coverage/matrix、当前能力观察及中央文档／兼容副本同步。active observations仍0。
- 本停点没有完整Node全仓、完整artifact、onboarding或八仓source最终验收。新增producer及源码尚未同步catalog/source lock，现有artifact/freshness门可能因来源漂移失败；**不能用旧绿结果或重签旧receipt冒当前资格**。
- 新功能公开帮助、安装入口和教学文档未收口；源码存在不等于已发布交付包。

## 历史失败与资源边界

所有RED和中间失败保持。早期capture曾120秒spawnSync超时，无PID/reap记录，不能用当前无进程补签其历史回收。8MiB capture预算是stat先验／后验，不是敌对无限并发下的原子累计读取限额；不宣称FS锁或全局回滚。

此次B回归完成于2026-11-08T09:36:40Z，外层PID12170已自然关闭，提交前进程快照不见其它Node/Java/sbt。旧B-legacy01只留下初始化/runner、没有完成证据；新regression02不倒填该缺口。未启动服务、数据库、银行apply或R2。

## 保护与提交边界

- 本次仅三生产文件、两新增回归测试、本说明；BC协调板仅本人 `module-seams-20261108` 行，peer整板不混入提交。
- 原102项dirty、126份保护文件、20份历史观察receipt保持，原Parcel参考与oracle、P23/PB/PID/codec/journal不变。BC JS产物仍不作为用户认可金样。
- 本机当前进展：`.rounds/module-seams-r_ya32kf/B-FIXES-CURRENT.md`；提交后首读同目录 `B-FIXES-COMMIT-HANDOFF.md`。ignored round不是发布渠道。
- 旧exclusive脚本／输出不可重跑或覆盖；失败临时目录不为消红而删除。无push/tag/publish；后续提交需相应授权。
