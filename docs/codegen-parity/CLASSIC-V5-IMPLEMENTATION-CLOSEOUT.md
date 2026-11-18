# classic @5 实施收口 — 23族限定raw最终验收完成

## 结论

**PASS_SCOPED_RAW_BYTE_AND_BOUNDED_INTERFACE**。

23个新增生成族已完成所登记两份完整输入上的raw路径/字节及批准的有界公开接口验收。与原11族合计：**34族已限定raw验收，8族待逐族curated Scala金样**；`all31Closed=false`。

- [验收范围与23族清单](CLASSIC-V5-SCOPE.md)
- [完整42族最新机器状态](details/classic-v5-artifact-status.json)
- [最终接受记录及证据指纹](details/classic-v5-acceptance.json)
- [反馈、oracle裁定与原失败保留](CLASSIC-V5-FEEDBACK.md)

生产候选为 `3bdd8d9ea8978dd88a104cd4d4a213622aec1fdb`，分支 `fix/classic-cqrs-f1-byte-parity`。该提交原为实现检查点；最终验收是本次新记录，不倒签检查点，不改历史失败。

## 公开运行与有效义务

| 来源 | 实际执行 | 本次有效观察 | 结论 |
|---|---:|---:|---|
| 已审计core | 10 | 10 | 六次完整52/52equal、A/B及ledger，承接原独立实际审计 |
| 已审计补充原轮 | 43 | 42 | 承接42；错误oracle失败1仍保留，原轮exit2/BLOCKED |
| 新独占finish | 5 | 5 | 4项正确拒绝＋1项完整50路径合法抑制，外层真实exit0 |
| 合计 | **58** | **57** | 不是57次全新单轮全绿，不是原47补充轮COMPLETE |

每完整input的expected含49 Scala、2 protobuf、完整routes，共52件；两输入104件、228241 bytes。A→expected、B→expected、A↔B共六次完整比较全部52/52equal。此前208组expected/actual/view完整Buffer比较、ledger A/B及头部/import重数/LF/EOF/`???`证据随不变pins承接，不重新执行或从JS反填expected。

新5项直接经 `bin/truthsrc.js generate-products --plan`，无apply：

| 新观察 | 实际exit | rawPassed | 接受原因 |
|---|---:|---|---|
| unknown-saga-command | 2 | false | 精确未知command诊断、stdout空、noout |
| resolved-service-path-collision | 2 | false | 冻结路径冲突诊断、stdout空、noout |
| projection-source-aggregate | 2 | false | 未声明source aggregate拒绝、stdout空、noout |
| projection-identity-scheme | 2 | false | 未准入identity scheme拒绝、stdout空、noout |
| no-api-endpoint-gates | 0 | true | 完整50唯一路径、DSL/routes absent、localDeps闭合、applied=false/runnable=false、noout |

预期拒绝的rawPassed=false不是失败被洗成raw成功，而是非法输入拒绝检查按合同得到预期结果。所有5项真实positive PID及完整receipt/log闭合，无failed/unknown/unexecuted。

## 提交后身份与运行时点

旧起钟脚本要求旧HEAD，不能在检查点提交后直接运行。保留旧脚本与审查，新 `start-postcommit.py` 只改HEAD与新budget-review路径，独立复核确认只有这两处差异；adapter、contract与生产源码不变。

新15分钟固定预算起点为 `1794962778975`，deadline为 `1794963678975`；不刷新旧预算、无retry。5个CLI实际elapsed总7852 ms。completion/closeout文件时点距新预算约175535/181460 ms，不把文件mtime差当精确外层进程elapsed。

外层跟踪任务 `bdi9w71qo` 由主代理直接观察completed/exit0。parent-observation是该事实的转录，不是原child receipt。原finish completion/closeout继续保留 `acceptanceSigned=false`，它们只封存5项观察；本次综合接受由新的最终记录单独签署。

## 独立证据审计

详细只读实际审计认证2533份完整文件、165283977 bytes，并作完整最终recapture；含2500个contract唯一pins、615源码/runtime、261资产、44个零字节文件及2个binary。58份原始public receipt及116份logs的command/cwd/env-key/profile/cap/hash/positive PID/closed/reaped/group empty均闭合，文件/目录/祖先identity失败为0。

源码118目录、carry963目录与新run6目录的完整identity/member对账通过。新source-before/after各219671 bytes、893行、完整字节相等；所有5个输出target不存在。正常shipped同名模块按已登记role认证，不读取两个敏感历史baseline正文。

详细审计长返回体的开头被工具截断，**没有猜测其未见headline verdict，也没有读取full agent.output**。另一次只读综合synthesis认证12个primary绑定，基于已经明确返回的详细认证事实给出自身的最终 **PASS_SCOPED_RAW_BYTE_AND_BOUNDED_INTERFACE**。2533份文件与58份回执的完整认证未重复；此synthesis不冒称重新执行。

该synthesis的一处附属历史诊断literal误写为 `CLASSIC_SAGA_COMMAND_OWNER_MISSING`。新本机转录保留其原返回，另对原冻结223519-byte合同完整pin核准，权威literal实际是 `CLASSIC_OWNER_MISSING`。最终记录据原合同记账；没有修改原件、隐藏此差异或改变原失败的排除关系。

这些审查记录属于独立返回结果的转录，不是新process receipts。原进程证据保留在本机ignored `.rounds`，没有包装成新clone可portable运行回执。

## 原失败与未证范围

原 `supp.plan.saga-phase-command-owner` 仍accepted=false，实际 `CLASSIC_REFERENCE`，原预期 `CLASSIC_OWNER_MISSING`。新的未知command观察是独立语义裁定后的新义务，不retroaccept旧case。原Scala无phase owner等于participant aggregate的要求，不新增该raw限制。

原43项补充轮仍exit2/BLOCKED、42accepted、1failed、4unexecuted，无旧completion/closeout。更早公开诊断缺码失败及原预算亦原样保留。

产品仍为 `classic-scaffold-only`、`runnable: false`。本结论**不证明Scala编译、type closure、ABI、优秀Plain FP/OO、ScalaCheck执行、复杂度/CC、金融/业务runtime或银行消费通过**；原raw占位和类型/算法缺陷继续保留。

## 后续与Git边界

下一族为 `aggregate-rules-formal`。剩余8族一次一族先完整手写Scala金样与真正ScalaCheck性质规格，向用户讲解并取得具体版本认可后，才实施对应JS。当前8族金样/JS均未开始；原八族raw oracle缺口仍独立OPEN。

本次新增最终记录与导航按原批准本地交付边界保存；实际最终文档commit以Git结果为准，不预填SHA、不amend旧检查点、不push/merge/tag/release。不修改sharedapp、作者树、原expected/actual/journal/ledger/anchors或旧回执，不执行tests/typecheck/JVM、下载、服务、容器或历史cleanup。
