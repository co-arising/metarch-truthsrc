# 第四批：纯决策与有限聚合候选验收

日期：2026-11-08。**第四批按有限候选合同完成工程验收：实现、真实运行、回锚、现役观察、完整Node回归、离线安装、来源及保护门通过；架构最终批准仍为0。** 本页只验收显式 `scala-cqrs-aggregate-core-v1`／`scala-cqrs-aggregate-core@1` 的有限 no-external 候选，不是完整四模块应用、银行切流或架构最终批准。技术边界见[本族合同](scala-cqrs/AGGREGATE-CORE.md)；阶段提交时的 obs0／首次 FAIL 保留在[历史检查点](AGGREGATE-CORE-CHECKPOINT.md)。

## 有限交付

- kernel 复用 family1 单份值／纯协议／State／RuleParams／Computations，增加纯 decide、CommandHelpers 和读取同一 pre-event State 的七种 fold；glue 承载独立 ActorProtocol、Aggregate、Factory、Bootstrap、本地 Actor Repository 及真实 PB 转换。
- Warehouse-lite 完整计划为 **24 source entries：18 Scala＋1 proto＋3 build＋2生成测试**；最终 writer 28条记录，磁盘30文件。独立 reference 22文件，独立 oracle 17文件／35案例，不由模板生成金样。
- 唯一输入链仍为作者树→产品编译→trusted producer→完整 plan→final writer→ledger／anchors→同图 query/update。名称／作用域／portable路径和依赖闭包在写前检查，不维护第二份可编辑 request。
- guard 按 sourceOrdinal 短路；host 按真实 inputDependencies 传参，每 occurrence 求值。Long checked arithmetic，exact 不经 Double 或隐式舍入。fold 不重跑 decide／host，不返回半更新 State。
- 非空成功一次 persist 完整 Vector，ACK 后 Accepted；query／拒绝／空成功不 persist，恢复只 fold。Factory 的 PID、initial、hosts、adapters 显式注入；本地 Repository 成功 spawn 后占位，close 不 stop 已交付 Actor。
- 外部 producer 两产品必须一致且为空；没有本地 command producer 的事件拒绝。root 仅聚合 kernel/glue；完整 modular 目标仍 `generator:null`、`approval:null`。

## 真实验证

各行可能重叠，不能相加冒独立覆盖。

| 检查 | 实际结果 |
|---|---|
| 最终 reference-release07 | 32阶段／35独立案例，2正编译 fixture／8指定负编译／3成对行为变异通过 |
| 最终 aggregate-release-build03 | 35阶段／相同35独立＋2生成测试，同组控制通过 |
| operations-release-build06 | 10阶段／七fold的8案例＋指定 sequential-state-fold 变异拒绝通过 |
| predicates-release-build07 | 8阶段／16谓词及命名案例通过 |
| family1真实回归 | reference 22；generated 22＋1；各2组编译控制通过 |
| 旧Warehouse回归 | reference／generated各24，85固定源码、7独立参考替换；PB leaf单列编译 |
| Parcel回归 | 34案例／7组编译控制通过，使用已记录有限runner适配 |
| 两家族Node定向 | family2 105/105，family1 107/107，无跳过 |
| 原完整计划保护 | 原12样例及family1完整18-entry计划恒等，含正文／deps／maps／footprint／knowledgeIds |
| 回锚与演进 | 真实作者生成、纯行为及Actor源码正反查询，guard变更 stale→preview→update→fresh，repeat零源码写入；生成区篡改及跨owner更新拒绝 |
| 作者面复验 | Warehouse 0hard／1notice／11原子roundtrip；银行source doctor通过、0hard／157原子roundtrip，runtimeVerified=false |
| 完整Node首轮 | 3638：3611通过／12缺现役观察失败／15跳过，原FAIL保留 |
| 登记后完整Node close01 | 3638：3622通过／1观察回执安装路径失败／15跳过，1364源码／测试／包／文档文件前后相同 |
| 修正后完整Node close02 | **3638：3623通过／0失败／15既有opt-in跳过**；1386源码／测试／包／文档文件前后相同 |
| 最终artifact与离线安装 | artifact **68/68**；onboarding／verify／view **33/33**，含真实tarball离线安装、移址及installed-only family1/family2闭环，无跳过 |
| 文档来源与兼容副本 | local、八仓3370来源、BC50／Play32副本通过；实际受控改写BC16／Play11，只更新27条来源bytes/SHA，其余3343不变 |
| BC文档lint | 424 Markdown，0error／1既有warning（20文档缺freshness marker），未fix |

实际JVM使用离线 JDK11／Scala2.13.14／ScalaPB0.11.14／protoc3.21.9／Akka2.6.20，175供给文件／44公共JAR，不含银行P23。kernel目标classpath仅Scala标准库；Java/protoc逐进程禁网、独占写根和受限资源。最终85阶段进程已reaped、租约释放。**direct compiler通过不是sbt已执行。**

Node的15跳过来自既有 `TRUTHSRC_BC_ROOT`、`TRUTHSRC_BC_CONSUMER_MANIFEST`、`TRUTHSRC_BANK_ROOT` 外部opt-in，未启用，也不算覆盖。公共默认发现中的只读银行作者准入不等银行全仓测试。

## 能力台账与可移植性修正

catalog2.3.0仍为 **125类别／523变体／41producer／534输出合同**。**current02**已实际登记20条：旧十二样例各 generated 一条，两家族各 complete-plan generated 一条、同样例源码 generated／compiled／behavior 三条。后两层只关联真实外部 generated execution 的相同字节，登记配方本身不启动JVM。

当前机械资格：现役JS代码／装配应生成及producer已定位 **63类／95变体**；generated **62／93**，compiled **20／29**，behavior **20／29**，final-approved **0／0**。派生证据分母3／3、generated2／2，其余层级0。数字按类别／profile变体分别去重，不代表全部输入或全部目标已认证。

current01的八份family回执 `command` 含本机绝对路径，导致原安装可移植性测试失败；同样例字节与执行资格正确不能抵消安装失败。现已用 **current02** 实际重新运行十二样例和两份新作者snapshot的公共生成链，登记20份可移植观察，真实调用参数保留私有registration；非command字段及sample与原记录完全相同。原能力／安装路径suite **14/14通过**，随后完整close02 **3623通过／0失败／15跳过**。**原20份current01回执及510条引用保真存入[独立历史索引](evidence/capability-aggregate-core-current01-history.json)，没有改测试、覆写回执或重签旧16历史。**

- 本族23变体中1项是手写工具，不给generator自身授予生成代码资格。
- 两类build／layout只有生成资格；每样例3个build定义排除在源码compiled／behavior资格之外。
- Warehouse完整样例覆盖本producer20／21输出合同，合法没有exact codec。Ops虽有独立8／16行为验证，但缺包含生成支持测试的完整同样例sourceEvidence合同，故本族exact-value-codec观察明确excluded，不能借family1资格。
- 原16观察、74变体引用及receipt原路径／字节保真留history。producer整个声明（含notes）进入指纹；其登记时备注作为冻结快照保留，今日资格由观察及矩阵表达，不为改备注重签证据。

## 失败处置与证据边界

独立reference曾校正typed map key排序并增加a／aa／b固定PB bytes；实际按key-only编码字节无符号字典序，不按VO文本／receipt值。模板修正params.counter遮蔽后，旧12及family1字节不变。运行判定success/suites误入产物词汇，通过本族职责分离修复，未放宽scanner或伪造alias；完整phase恒等并真实复验。

观察准入的四项缺口（check临时roundtrip、54 pins／3 controls、external完整计划及4 metadata、negative lifecycle）在本机配方修复并独立拒绝性验证后，才执行真实check／record。真实exit1负控制不改装成成功回执。所有失败日志、候选与used marker保留；JVM期间曾受控写来源锁／coverage，不能声称那一窗口整仓字节恒等，实际执行输入pins保持。

固定参考／oracle／verifier在 `test/reference/aggregate-core/`。公共观察位于 `docs/artifacts/evidence/`；完整执行日志、调用参数和登记配方位于本机 `.rounds/aggregate-core-8dxynixl/` 与 `/private/tmp/aggregate-core-8dxynixl-*`。这些是本机证据路径，**不是公开下载渠道**；新clone不假定拥有临时回执或离线供给。

## 保护与非结论

阶段四HEAD：JS `e2c05c1a588c`、BANK `79d6b86ec198`、BC `95311aca65a3`、Play `f95e4b305e2b`。本次续接不自动提交／推送／发布。提交后及收尾保护核验通过：原102 dirty／peer内容、126保护文件、原16历史receipt和current01新增历史20份回执均保持；四HEAD未变、index空。最后一次独立current02复核代理因API中断未交付，不计通过；主对20便携回执、相同非command字段／sample、20旧回执／510引用及14个私有实际调用记录进行了只读字节核验，不能将它称为独立审阅。

controlled journal只验证ACK时序；testkit重启不是跨JVM恢复；identity adapters不是PB认证；空历史生成测试不是非空业务oracle；fold失败不回滚已持久化日志。exact结构eq由独立Scala预期验证，不用旧JS oracle不同单位的EXACT_UNIT错误为依据。

完整业务port／实现／Bridge／root、外部授权结果桥、生产serializer／PB演进／真实存储、银行service02全新读库90秒未追平、R2、retry/backoff/deadline OPEN、技术配置物理字段锚、材料渠道／真人上手／架构owner批准仍独立未完。Saga事务与Monarch编排不互相替代；本批不推导金融规则，不改银行作者／手写／固定测试／PB/PID/codec／P23。

有限候选工程验收不等所有模板“完美”、银行完整业务或项目整体交付，不自动启动下一家族。
