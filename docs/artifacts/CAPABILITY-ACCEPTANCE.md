# 生成能力台账校准验收

日期：2026-11-07。基线：工具`31a1480db11fbe611b11be38fcc90ae4570c03ba`，银行`cf75af01b71607697548277f1ffbc04a27256ffd`，均包含此前未提交的公共验证闭环。该批落实[实施路线第一批](STATUS-AND-IMPLEMENTATION-PLAN.md#第一批校准全量能力台账先得到可信分母)，不是剩余模板、推荐架构或银行完整service验收。

## 范围与实际数字

- 原**125类、284变体、39manifest**全部核对；原类别/profile身份保留。
- 类别仍**125**，说明仍**125份**。补入**189条**原来漏登或需分开的profile/调用通道，现**473条变体**；不是新增189种ArtifactType，也不是实现189个模板。
- **39个入口、501份输出合同**具备正反向映射。入口包含10正式产品profile、2普通入口、20旧式入口和7退役入口；同一输出可以承担多种职责，不按类别引用次数重算文件。
- 当前细分统计由[能力矩阵](CAPABILITY-MATRIX.md)派生，合同见[版本与证据说明](CAPABILITY-CONTRACT.md)。不能继续用旧“66项implemented”当准确生成覆盖。

| 有限范围 | 已界定应生成类别 | producer已定位 | 本批样例已生成 | 新台账有效编译 | 新台账独立行为 | 最终审定 |
|---|---:|---:|---:|---:|---:|---:|
| 现役JS代码/装配 | 61 | 61 | 60 | 0 | 0 | 0 |
| 现役JS派生证据 | 3 | 3 | 2 | 0 | 0 | 0 |
| 旧式JS代码/装配 | 65（71变体） | 65 | 0 | 0 | 0 | 0 |

现役代码尚未观察的是普通TypeScript入口；派生证据尚未观察的是独立Saga contract-only入口。它们的实现来源已定位，本批没有为获得更高数字强行执行所有旧式/普通入口。旧式范围与现役范围可能共享类别，不能相加当作总类别数。当前分母是已界定的现役生成责任，不是后续尚未决定的新推荐profile的全量能力承诺；library、手写、退役和拷贝不进入现役原生模板完成率。

“新台账编译/行为为0”指没有将旧报告拼接为此版本下全部类别的晋升证据，不是否定已存在的聚合参考24+24、银行Actor64/Readside47等历史实测。七份聚合参考仍是工程候选；本批未发生最终架构owner批准。

## 六项原缺口的处置

1. **projection-repository-port**：登记旧式`generateViewRepos/renderTrait`、独立repository DSL和retired projection路径；当前正式JDBC Repository是具体实现，不伪称等价的中立Repository trait。
2. **role-and-view-key-map**：区分`api-dsl`、`auth-dsl`、retired API及run-all静态拷贝；记录实际未知键fallback，不把生成映射当作完整授权正确性。
3. **saga-bootstrap**：JS正式Definition中的coordinator/fromTechnical装配成立；运行库工厂、BC旧式bootstrap、strict Module与银行手写spawn分别归属。
4. **saga-participant**：JS真实生成StrictParticipant/PhaseBinding应用装配，不生成库中的类型实现；BC旧模板为legacy，不能替strict背书。
5. **saga-serializer**：保留真实生成的HostSerializer/host proto，并把StrictSagaSerializer/legacy converter单独标为library。原问题是混淆职责，不是没有JS代码，也不是应把运行库复制生成。
6. **serialization-registration**：明确正式scaffold/build、child/effect扩展及Play重定位的应用配置写者；与运行库JAR自带reference.conf分开。

全量核验还修正了Factory类/trait差异、具体本地Repository的共享职责、漏登的服务/计算port/bridge/journal接口、R1/R2边界、条件模板/实际最后写者及BC未完成的多模块职责。BC的未完成方法、默认值、反向依赖、module build和postprocessor路径问题仍是代码债，本批只纠正说明和台账，没有改变生成代码使其消失。

## 实际验证

| 检查 | 结果与边界 |
|---|---|
| 公共完整`npm test` | **3376项：3361通过、15明确opt-in跳过、0失败**；捕获的973份源码/测试/生成输入在执行前后SHA一致 |
| Artifact定向 | **66通过、0失败、0跳过**，包含schema拒绝、来源/兼容及纯生成观察；与完整回归重叠，不相加 |
| 真正生成观察 | **12份新回执**：覆盖10正式入口，另有页面与显式非银行journal条件样例；仅纯计划源码，不apply、不开JVM、不代表任意输入全覆盖 |
| 安装消费 | 离线tarball安装并移动prefix后，v2校验、原Counter和Catalog验证闭环通过；不要求BC/银行checkout或真实JAR |
| 跨仓来源 | **8仓3206份**来源字节/符号/责任对账通过；比原3181增加25份实际输入/目录工具来源 |
| 兼容说明 | BC50文件、Play32文件经精确原摘要公共sync更新并检查通过；BC文档dispatch Node **2通过** |
| BC知识库 | 424份Markdown，0错误，1项既有新鲜度警告；未改无关历史文档来消警告 |
| 银行作者入口 | source doctor通过，validate **0 hard**、37项既有notice，**157原子roundtrip通过**；不是业务执行/服务通过 |
| 文档导航 | 125类别八个必需章节与179条本地文件链接通过；平面兼容副本把跨中央目录链接转换为可解释的公共包定位 |

公共15跳过仍为BC实际消费/迁移和actual-bank等显式opt-in；没有因此取得对应路径新验收。本批执行平台Node22.23.4/Darwin，未重验最低Node22.13或原生Windows。BC只变说明副本，没有运行Scala编译。

## 防止虚高及证据失效

独立审阅确认并由反例修复：重叠路径不能自动批准未执行条件输出；不同输入或源码字节不能拼接生成/编译/行为链；未随包`.bak`不能使安装包误报source drift。显式回执按调用通道和每文件合同归属验证，后续质量证据必须保持同一完整样例。旧版implemented只兼容读取，不自动获得v2能力统计。

普通对象上的passed字段不参与证据晋升；通过真实回执读取/验证才能派生统计。回执仍是维护者控制的可复核记录，不是敌意主机下的密码学真实性。源码定位和文件hash不能证明任意语义正确。

初次广域mapping审阅和一个文档代理发生422通信失败，不计审阅通过。主集成按实际文件、定向复核、反例及回归收口；失败输出与首次红灯日志保留，没有因失败扩大为无限审阅批次。

## 保护和未完成门

生成器/model/template、业务tree/binding、银行手写/固定Scala测试、runtime制品、PB/PID/codec、生成目录、ledger/anchors和历史回执未改。原`.gitignore`、`.DS_Store`和Python缓存保留。仅JS目录工具/说明/测试、BC/Play文档副本与协调行、银行续接说明属于本批写面。未commit、push、tag或publish。

当前教学输出继续是工具指纹changed；本批未apply或重签旧构建/服务证据。完整service新读库replay失败、90秒gate、人工会话未执行、R2下游未接入、retry/backoff/deadline OPEN、供给公开取得与独立真人验收均未关闭。

下一批仍按既定路线固定目标profile、命名和独立多模块参考，再按依赖家族改善模板；本批没有提前宣布其完成。

本机日志与保护证据：`.rounds/artifact-capability-c2yty4ke/`中的`before.json`、三份类别audit、`audit-entrypoints.json`、`REVIEW-DISPOSITIONS.md`、`catalog-tests-02.log`、`public-full-01.log`、`regression-inputs-before.json`、`installed-01.log`、`cross-repo-01.json`、`bc-play-sync-result-01.log`及`bank-source-validate.log`。这些日志不是安装包或新clone的必备外部路径；生成观察回执随中央目录分发。
