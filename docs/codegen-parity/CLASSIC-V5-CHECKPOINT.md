# classic @4/@5实现检查点 — 2026-11-18

## 交付性质

用户要求现在提交当前成果。本次为**实现检查点，不是23族最终接受提交**。保存已实施源码、独立参考资产、明确公开接线与真实进度；不把未完成的续验签绿。

计数：11族COMPLETED_SCOPED_RAW、23族IMPLEMENTED_PENDING_ACCEPTANCE、8族NOT_STARTED_CURATED_GOLDEN；42唯一key，`all31Closed=false`。完整表见[ARTIFACT-TYPE-STATUS.md](ARTIFACT-TYPE-STATUS.md)。

@4此前已验未提交，其六仓储MBT、精确版本/target和十九件资产属于@5必要依赖；共享改动通过当前@1–4两input回归实际观测核准，但不把旧@4 PASS迁签到其它新域。@3 baseHEAD为2a06dd319690dcb6c8907821ea2bdaa942e293f1，当前branch为fix/classic-cqrs-f1-byte-parity。

## 当前实现

- `generators/scala-cqrs-classic-v5/mbt/`：domain/service/query、投影仓储与执行、序列化、API/routes、bootstrap、classic Saga及Trigger的结构Model/Builder/Template。
- `lib/classic-architecture/`：集中解析/naming/context/assembly、Scala集合迭代、source owner冲突及exact v4/v5 target。
- `bin/truthsrc.js`：仅generate-products分支呈现`error.diagnostic.code`和原message。所有typed-error（含旧product）stderr有意变为`[FAIL] CODE: message`；无码显示、成功输出、exit2和其它命令未变。两复制producer实际拒绝诊断已独立审计认证。
- `test/{fixtures,reference}/classic-cqrs-v{4,5}/`：独立完整输入/expected，不从JSactual反填；@5每input52文件，expected两套104raw件228241B。
- public replay/supplement工具纳入实现；它们依赖本机ignored round合同/预算，**不是新clone即有的portable运行证据包**。

## 实际公开结果

| 项目 | 结果 | 接受边界 |
|---|---|---|
| 新core10 | 真exit0，六52/52equal，独立actualauditPASS | 两完整输入的raw core，不等23final |
| 新补充原轮 | 真exit2，43actual42accepted1failed4unexecuted | 独立PASS_SCOPED_SETTLED_42_EVIDENCE，整体仍BLOCKED |
| 原Saga负例 | CLASSIC_REFERENCE拒未知命令；合同错误期待OWNER_MISSING | 原failure不改，不添加未被原Scala要求的owner等式 |
| 新5项finish | 已批准精确oracle/承接52事实/只补5 | NOT_STARTED，仍缺实际5观察＋综合独立审计 |

完整byte对账保留头部、import重数、LF、EOF、`???`。当前仍classic-scaffold-only、runnablefalse，不声明Scala编译、typeclosure、ABI、Plain FP+OO优秀金样、ScalaCheck或业务runtime通过。

## 验收器耗时问题

实测父补充进程36:19、CPU99.7%；37publicCLI合114.446秒，最长3.816秒。全43calls合132.542秒。独立静态分析确认累积pins/inventories、祖先目录重复枚举、ownedDirs增长及终局多次全scan放大；不是生成器慢，未profiler不能给函数占比。新5finish保留完整source/asset/identity/member校验，旧carry初末核，不跨call缓存，不再重跑原57。

## 下一步与用户门

临时adapter失败记账fix14与起钟脚本门禁的独立复审均已通过。提交后需先按真实新HEAD核准起钟脚本及审查记录的身份绑定，再执行已批准的新15分钟5项publicplan，随后综合独立审计，才登记23final；**本检查点没有启动这5项**。原sup47/BLOCKED不能制造COMPLETE；合并若通过将明确10＋42＋5有效义务与实际58exec含旧错误oracle失败1，不称57freshsingleallgreen。

后续8族从aggregate-rules-formal起一次一族，先完整手写Scala、PlainFP+OO职责与真正ScalaCheck性质规格、证据/未执行说明，逐份向用户讲解。**用户认可具体bytes/hash版本后才相应JS**，改变版本需再确认；不从JSactual造金样、不改@5raw含义。

## 提交/回执边界

本文件随实现检查点提交；真实commit SHA以Git及本机handoff15的post-commit记录为准，不预填SHA。不push、merge、tag、release或跨仓修改。.rounds中的运行、临时适配器、预算、失败和agent转录仍本机保留，不forceadd不删。参[COMMIT-SNAPSHOT-BOUNDARY.md](COMMIT-SNAPSHOT-BOUNDARY.md)。提交只使实现/参考资产/稳定事实可取回，不代表回执portable或最终验收通过。

原@4收口文档中“未提交”保持历史时态，不retroedit旧PASS/失败、journal、ledger或作者树。[checkpoint-evidence.json](details/classic-v5-checkpoint-evidence.json)提供精简指纹导航，不是进程receipt。
