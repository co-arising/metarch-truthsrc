# 第三批 family1 验收

日期：2026-11-08。公共完整回归已经结束：3528项、3513通过、15明确opt-in跳过、0失败。第三批有限工程门已通过，最终保护核验单独记录。新入口和参考均保持candidate；`approval:null`，未提交／推送／发布。

## 交付与资格

新增显式 `scala-cqrs-domain-kernel-v1`，完整manifest身份 `scala-cqrs-domain-kernel@1`，消费既有七项v2语义产品。五项核心职责：VO、exact codec、Command/Event、State、RuleParams；minimum computation签名、真实protobuf/converter、build/test为必要支撑，不称后续整个家族完成。合同见[领域kernel](scala-cqrs/DOMAIN-KERNEL.md)。

- 模型和逐职责模板分离，复用集中名称、类型／default准入和最终writer。
- 18个JS生成source entries：13份生产Scala、1份生成测试、1 proto、3构建定义；不是18类别。
- 独立参考含17个project文件：13份生产Scala、1 proto、3构建定义；外部oracle含22个ScalaTest案例及成对host编译控制。
- 无Actor、rule/fold/CommandHelpers业务方法、实现/根绑定、serializer/存储／恢复。银行选择及旧九入口不迁移。

## 实际执行

| 门 | 实际结果 | 限制 |
|---|---|---|
| 新作者来源 | 13 atoms；validate 0hard、1 V13H notice；roundtrip恒等；7 products 0diagnostics | notice保留，不是业务runtime认证 |
| 独立参考Scala/PB | reference-final04：12执行阶段、22独立测试、2组正负compiler控制通过 | sbt未执行；标准库kernel独立classpath |
| 最终writer生成版 | final-build02：14阶段、22独立oracle＋1 generated基础测试、2组compiler控制通过 | 同一最终代码／工具hash；构建定义不冒行为晋升 |
| 23字段真实变体 | 7阶段：kernel/PB/glue真编译，23个互异字段经ScalaPB bytes往返，hyphen identity kernel编译通过 | 独立新作者副本，不改固定参考 |
| 第二批保护 | Parcel final replay：原24阶段、34测试、7组正负控制通过，helper纳入hash | Parcel原10生产Scala保持 |
| family Node定向 | 最终107通过、0failed/skipped | 默认discovery不启动JVM |
| 既有target/exact/aggregate | 112通过、0failed/skipped | 原Warehouse／target合同保护 |
| 产物能力／来源 | 68通过；8仓3287来源检查通过 | 来源齐套不等所有输入语义通过 |
| 离线移址安装 | tarball实际pack/install/relocation：1通过 | 安装后非银行project源→writer→verify→reverse span成立；无checkout fallback；参考/JVM lane不入基础包 |
| 银行source-only | doctor＋validate wrapper含roundtrip通过：0hard、37notice、157 atoms，runtimeVerified:false | 未生成银行代码、未运行银行JVM/service |
| BC说明兼容 | BC50／Play32受控派生sync；BC KB lint exit0 | 不修改BC生成器或peer参考 |
| 公共完整回归 | 3528项：3513通过、15明确opt-in跳过、0失败；480963ms | skip不算覆盖；运行后仅测试scratch teardown和文档刷新，定向再次通过 |

编译供应是本机明确离线JDK11.0.11、Scala2.13.14、ScalaPB0.11.14、protoc3.21.9、ScalaTest3.2.15及完整依赖／includes；未下载，没有银行冻结JAR依赖。所有实际编译／native调用deny network，写限新独占目录，库和输入hash前后核对；public bounded process supervisor负责退出/超时/进程组。negative compiler必须正常exit1＋相应文件/symbol，环境错误不是成功红灯。

## 台账证据

catalog v2.2.0仍125类别，500变体、40manifest、513输出合同。新增13个candidate变体，没有覆写原14个reference-only资格。

当前有效回执：旧十二样例实际重放后的12份＋新候选4份：完整18-entry generated观察；完整15-file Scala/PB源闭包generated／compiled／behavior链。三个资格level使用相同输入、路径/kind/字节hash和工具fingerprint，构建定义被排除于编译/行为样例，不把direct compiler说成sbt build。

派生现役JS代码／装配：应生成63类／73变体，producer定位63／73，当前样例生成62／72，compiled 10类／10变体，behavior 10／10，final-approved 0。**10是新candidate route的职责集合，包含核心5及必要签名/PB/test支撑；不表示旧九入口或所有合法输入已经编译。** 独立参考回执不会计入该链。

历史初始12、第二批12和集成期16观察保留原路径/原字节；后两组过期原因分别记录，不重签旧工具指纹。当前public回执无作者绝对路径。代码或打包生产输入变化会使当前观察再过期。

## 回锚／演进

真实project plan/apply/verify完成；核心每份Scala所有mapping先核实际UTF8 bytes和canonical pointer，公开双向query选每artifact具名字段，含micro声明physical author mapping。合法default修改通过stale→update preview→apply→fresh→repeat0；generated区篡改、未知options拒绝，旧output不强覆写。

技术inline exactCodecs/names的物理JSON字段source navigation尚不成立；project hash和product证据保护它们，源码回查绑定真实domain/wire/PO声明，不伪造作者pointer。零源码写入与ledger/graph证据写入分别说明。

## 发现、修正与失败保留

- TDD初始entry/literal/model/render/项目未注册红灯真实保存。
- PB文件路径与独立参考不符：修candidate路径、显式portable context准入，没有改金样掩盖差异。
- Params嵌套type、builtin type、exact accessor/method local、converter event与PB/generated-test导入遮蔽补反例；支持合法qualified fallback，稳定PB和原ref保留。
- Parcel helper抽离后指纹遗漏修复并重跑；源staging与原始hash关联；write root加入author tree；owner/kind证据关联；Linux unit temp使用os.tmpdir；stored ZIP不保留整archive slice；typed map entry避免二次编码。
- 异步supervisor适配首跑因logs目录未预创建而preflight拒绝，无compiler执行；新目录修正后实际12/14阶段通过，旧FAIL保留。
- source登记的两个false writer-vocabulary匹配通过明确generated-test kind和分离过程expectation修正；run-all未因新family登记被误称产生新职责。没有放松公共vocabulary门。
- 高effort审阅递归扩展导致限流；七个父任务已停，取消未自动级联。错误/空结果不算审阅通过。实际确认的主线缺陷与修正写在本机dispositions中，未宣称全部递归审阅完成。
- 第一个final compiler命令错误使用已存在candidate根作为输出被拒绝，无覆盖；后续disjoint absent build实际通过。

## 未完成与保护边界

公共完整回归已结束，最终差异／hash保护核验另存真实结果。银行 `docs/DISK-CLEANUP.md` 期间追加了peer清理记录，本会话未编辑或执行清理，原样保留并排除于本批交付，不能冒称原全部文档零漂移。完整modular impl/root、PB演进/serializer/storage/recovery、银行candidate/service replay、R2、retry/backoff/deadline、技术配置physical回锚、材料发布及真人上手独立未完成。自动验收不替代架构owner批准。

本机完整证据在 `.rounds/domain-kernel-gak37aji/`。最终候选 `/private/tmp/domain-kernel-gak37aji-generated-final02/`，真实编译 `/private/tmp/domain-kernel-gak37aji-final-build02/`，所有失败目录保留。这些本机路径是本次可核材料，不是公开下载渠道或随包完整供应承诺。
