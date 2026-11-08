# 第五批：有限多模块接缝候选验收

日期：2026-11-08。本页记录显式 `scala-cqrs-module-seams-v1`／`scala-cqrs-module-seams@1` 的有限工程结果：作者/严格产品、唯一writer、外置实现、四模块编译、独立业务、来源与演进、安装及公共回归。**不是完整CQRS应用、银行切换、发布或架构owner最终批准。** 完整modular target仍 `generator:null`、`approval:null`。技术合同见[MODULE-SEAMS](scala-cqrs/MODULE-SEAMS.md)，当前统计见[能力矩阵](CAPABILITY-MATRIX.md)。

## 交付范围

- 单context Parcel的业务值只在作者树定义，ports引用这些值；`module-seams-contract@1`和依赖它的`module-seams-composition@1`严格重建，不维护第二份可编辑canonical/request/model。
- 主样例 **7份生成生产Scala＋3份外置手写Scala**；另2份build、2份生成形状测试。project writer另写4份派生证据，ledger/anchors另计，不能把这些数量合称生成业务算法。
- kernel为值、closed sum、三port及条件Bridge，CapacityRule手写；glue的InMemoryRouteRepository和ext的DefaultQuoteFlow手写；root生成显式ParcelModule装配。保持`create(routes)(implicit executionContext): QuoteFlow`。
- Bridge仅同kernel纯委托；direct implements不生成冗余Bridge。四模块分别使用独立classpath，kernel仅Scala标准库，生产classpath不混compiler/ScalaTest。
- 每个外置源码根完整membership、身份、stat及bytes前后核验；原live capture提供准入能力，JSON/AST克隆不是能力。唯一writer沿用source-plan/v1、ownership/MANUAL/retained协议。
- generated最终UTF-8 span可反查作者或技术binding；外置手写仅独立file级来源，symbol/span/runtimeVerified均不认证，不写入generated anchors。三种输入变化均stale，经preview/update恢复current；移址后重新capture/generate，不保证旧绝对build路径原地可用。

## 真实执行结果

各行可能重叠，不能相加当独立覆盖。阶段数、案例数和物理文件数分开。

| 检查 | 结果与边界 |
|---|---|
| A/B合同与writer门 | 正式门通过；B修后64定向、724有界回归，旧14完整计划942 entries全等；作者validate和roundtrip通过 |
| C原参考／generated-mixed | 25／27执行阶段；每lane原34独立业务案例、七组编译正负控制及无production反例；mixed另2个形状测试 |
| C扩展控制 | 60阶段；构造顺序、显式/隐式EC、delegate签名、三模块缺实现、同模块shadow共10编译配对；两项runtime mutation必须精确命中指定断言 |
| 五作者变体 | 35阶段；split-parcel、all-separate、same-name-sum、same-name-root、direct；direct有独立小suite和未implements负例，不冒五组完整34案例 |
| D安装与演进 | 离线tarball安装、prefix移址、installed-only loader、公共生成/verify/query/view、重复零源码写及手写/合法binding名称/作者字段三输入stale-update通过 |
| installed真实混合编译 | 先60阶段；共享生命周期硬门修后以新身份再次60阶段通过 |
| 共享PB/Actor回归 | 硬门修后family1/family2 reference/generated四lane共93阶段通过 |
| C最终定向Node | 82/82通过，不替代公共完整回归 |
| 冻结后current06 | 旧12条件observer＋三family全新writer/编译/业务109阶段，登记24份新当前观察 |
| 完整Node full12 | 外层20分钟预算耗尽，FAIL；无完整TAP footer，不形成最终测试数；原回执保留 |
| 完整Node full17 | **4099项：4084通过、0失败、15 opt-in跳过、0取消、0todo**；串行，约25分40秒，无timeout；`allTestsPassed=false` |
| artifact专属套件 | **68/68**，无跳过，约66.46秒 |
| 完整onboarding组合 | **34/34**，无跳过，约136.85秒；含真实离线安装及移址消费 |
| BC文档门 | dispatch **2/2**；KB lint扫描424文件、0error、1既有warning（20个文档缺更新时间标记），未fix |
| 来源与兼容 | 公共expected-digest同步BC50/Play32；local、八仓3424来源、snapshots通过；仅82条受控来源变化，其余3342条保持 |

15项跳过均为既有外仓opt-in：BC bundle loader、实际BC树/Scala消费者、selected/legacy入口及exact迁移，以及当前银行项目检查；门控为`TRUTHSRC_BC_ROOT`、`TRUTHSRC_BC_CONSUMER_MANIFEST`、`TRUTHSRC_BANK_ROOT`。本轮不启用这些外仓执行，**跳过不计通过或银行覆盖**；只读八仓来源检查另有实际结果。不能把4099项写成4099通过。

full17的1477个文件、1828个输入成员在执行前后及封存复核时一致，index与runner未变；stdout/stderr摘要、实际命令、完整TAP及外层wait/reap记录对账通过。本文及最后状态文档属于测试完成后的文档收口，不追认为测试时已有；最后只读保护门对这些文档及锁的差异单独归因，不再运行测试。

## 供应、控制与来源资格

纯JVM lane使用已存在的离线JDK11／Scala2.13.14／ScalaTest3.2.15：11 JAR、2 parent POM、102供应文件，含75份JDK运行文件。不下载、不找protoc、不冒用旧PB/Actor供应清单。逐JVM禁网、512MiB/2CPU/120秒，使用共同独占运行位及不复用的used标记。原3份独立oracle的34个案例与原10份生产参考保持，不由renderer制造golden。

原七编译控制与扩展编译对均有正控；两业务变异必须先原指定案例通过、变异源码编译成功、恰好指定断言失败。超时、环境错误或任意exit1不是负例成功。full17的60分钟是整套Node外层预算，不更改测试自身/JVM预算或银行90秒readside门；Node外层普通spawn，进程测试各自使用sandbox，不宣称整套Node受OS级禁网认证。

catalog2.4.0为 **125类、536变体、42producer（15current/20legacy/7retired）**。新族11物理输出合同对应10生成类别，另3个handwritten变体routes为空；原14个modular reference-only保持。当前24观察中，旧12各generation，三family各generation-all/generation-code/compiled/behavior；同一代码样例的后三者按相同输入及artifact集合配对，build只具generation资格。

现役JS代码应生成/定位65类105变体，generated64类103变体，compiled与behavior各23类37变体，final-approved=0；派生证据generated2类2变体，不是全部3类完成。静态readiness仍static-contract-only、runnable=false、runtimeBindingVerified=false；实际样例执行不推广到任意产品输入。生产指纹为`9159c35c62faeb90e2712d9131e10510f27e6e25198af7066e9f69934b8a3374`。

## 失败保留与审阅

原current02的20观察/510引用继续[保真历史](evidence/capability-module-seams-prior-history.json)，不重新挂current。current05虽三族109阶段成功，登记时重复ID仍整体FAIL；current06用新身份、sample唯一ID及原条件observer重录，不覆盖05。初C runner缺sandbox、安装01/02非法version2、VM helper注入遗漏、lock02丢text-backed符号等失败均保留。

共享suite-rejection回调曾可覆盖生命周期失败，已加回调外error/signal硬门并复验旧JVM和installed lane。最后两次有界独立只读review检查mixed准入/编译/变异/安装与八份当前文档，未发现新增具体缺陷；不冒称全仓审计。末次静态字段对账代理没有交付，不计独立审阅，由主审阅最终脚本。full12预算FAIL、inspection16拍到另一已知运行组、首clearance20自身comm误判也原样保留；新当前清场记录通过后才续跑，不修改历史标志。

## 保护与收口边界

本轮续接基于JS `773ebec08f34`、BC `78c4a07816e6`、BANK `8f2629c25d94`、Play `2772c0665989`。`e-final19` 的local、八仓3424来源、兼容副本及四仓diff检查通过，但最后保护检查发现JS `.git/index` 原始字节变化，**该次终验为FAIL，保留原回执，不重跑或改签**。

JS index的SHA256从`488ad40ff6ae49c5968bb2cf8bff027650563404f7b7a11cf9ac8eecd5f5f8c6`变为`96524d6b0877a1768a383c0c9e9a25118e16f85185918e11cc45a6a557d50d8e`，大小仍256177 bytes、权限0644。独立诊断确认1856条暂存路径/blob/mode/stage语义与原基线一致，cached diff和unmerged为空。由于没有原index二进制及历史flags，**不能证明仅metadata变化，也不能确定写入者**；不宣称四仓index原始字节始终不变。

用户明确接受这一有限例外（本机`E-INDEX-ACCEPTANCE25.md`）：仅JS采用已捕获的新raw快照检查后续稳定性，仍严格核原暂存语义；其他三仓继续核原raw。新`e-final25`保持原102 dirty、126保护文件、20历史回执、24当前观察、3424来源、四HEAD及完整status保护，Git调用显式禁用`diff.autoRefreshIndex`并保留`--no-optional-locks`，不修改index或旧测试记录。最终有限收口以该新独占回执`passed=true`及主审裁定为条件；最终结果和裁定见本机`FINAL-HANDOFF.md`，不以本文预先声明机器检查成功。

公共观察在本目录evidence；独立源码/固定oracle/verifier在test/reference；原始日志、进程回执和收口配方在本机`.rounds/module-seams-r_ya32kf/`。ignored round与临时JVM目录不是公开下载渠道；新clone不假定已有离线供应。

不支持或不承诺：自动组合family2 Actor/持久化、任意DI/源码解析、PB/PID/codec演进、真实存储、外部事件授权、完整CQRS应用、Saga/Monarch集成或银行/R2切换。银行fresh readside90秒未追平与retry/backoff/deadline OPEN保持；Saga跨聚合事务不等Monarch编排。无提交、推送、发布或下一family自动启动。有限候选工程收口不等所有模板“完美”或架构owner批准。
