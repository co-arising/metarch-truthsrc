# ArtifactType 中央说明验收

日期：2026-11-07。范围：用户批准的P0说明收敛；不是银行完整服务、R2下游升级或后续目录/命名改造的验收。

## 已交付

- 中央维护入口`docs/artifacts/`；按用户追加要求，Scala CQRS、port/多模块、Saga和Monarch位于`scala-cqrs/`，其他语言与工具链证据分组。
- **125个职责类别、284个适用profile记录、154条类别依赖**；其中113个Scala类别。每类说明职责、输入/人工信息、生产所有权、结构命名、装配、回锚、验证和版本实例。类别不是Scala类/物理文件/语义产品数量。
- 递归覆盖39份manifest：10个正式产品profile、22个顶层旧式/普通入口、7个嵌套retired入口；无artifactKinds的emitter、Scala模板和静态资源也进入来源清点。
- 8个仓库共**3140个来源/实例文件**按指定范围记录、分类和SHA核对；当前锁中未分类为0，输出kind错配为0。完整性仅针对来源锁声明的版本和根目录，不声称任意未来或外部第三方artifact全覆盖。
- di-poc的1101台账行全部解释并定位：206原路径、864旧app前缀、28 protobuf根迁移、2 rolemap根放置、1 controller双app前缀；179个source-only文件有独立分类。没有改写旧台账，也没有用同名文件猜身份。
- BC 49份实质说明＋派生索引、Play31份＋索引由中央目录受控同步。旧入口可离线读取，不是空链接；MCP48项/Scala47项文档dispatch共享中央派生表，Adapter event/snapshot按实际属性选择。
- 修正InvariantRule/Policy、Converter/Serializer、Helper/Bootstrap错向、多模块@ImplementedBy/PB/依赖漂移。当前Scala mixed命名、兼容facade、银行重放失败、R2未消费等真实差异保留。

## 执行结果

| 验证 | 实际结果 |
|---|---|
| P0目录/覆盖/兼容/真实pure-plan测试 | 27通过；无JVM/服务启动 |
| 最后独立包安装与目录组合 | 34通过（含上述27与7项onboarding），tarball离线安装、prefix移动后检查可用 |
| 冻结源码的JS全量`npm test` | 3084项：3069通过、15跳过、0失败；前后源码/目录指纹一致 |
| BC真实仓`sbt compile`＋ArtifactDocumentationSpec | 编译通过，3测试通过 |
| MCP文档dispatch | 2测试通过 |
| BC知识库/计划索引 | 最终扫描424份Markdown，0error、1个既有freshness汇总warning |
| 本地／8仓完整来源／兼容副本 | 均通过，缺外部checkout会明确失败而非假绿 |
| Markdown本地链接、四仓diff检查 | 通过；本轮Git暂存区为空 |

测试集合有交集，不能相加当唯一覆盖。测试跳过维持既有条件，没有改断言或扩大权限使其变绿。

## 失败及审查保留

一次全量运行的Counter触发`tool changed before apply`：测试期间本轮文档工具仍在编辑，保护门正确拒绝。未放宽门，停止源码改动后以新日志完整重跑通过；失败原日志保留。

独立代码审阅指出并已修正：硬链接写入风险、兼容输出目录过宽、模板/static资源漏指纹、revision与自身提交循环、aggregate emitter职责漏映射、外部未分类项假绿、无artifactKinds/BC词汇检查不足。均补对应检查和反例。额外的独立全文内容代理遇到限流，未把它记作审阅通过；主集成完成目录/模型/来源核对。

## 可复核材料

本机独占材料根：`.rounds/artifact-docs-p0-n11xz3y9/`，不是安装包附件。

- `js-frozen-full-tests.log`及`frozen-test-source-before.json`/`after.json`：最后全量与指纹。
- `last-install-and-docs.log`：最后离线安装及目录验证。
- `bc-final-dispatch.log`：真实BC编译与3项测试。
- `bc-kb-index-refresh.log`：知识库/计划索引检查。
- `cross-final-after-refinement.json`、`final-doc-checks.json`：来源与兼容检查。
- `protected-final.json`：原脏文件/运行库/银行业务写面保护。
- `js-final-full-tests.log`：保留的Counter拒绝，不改成通过。

共享交付内容是中央目录、source lock、coverage、公共check/sync及自动化测试；本机日志不可当作clone自动附带的材料。无npm发布、commit、push或tag。

## 未纳入本批

P1公共工具职责回流、P2 Scala结构/命名、P3银行默认目录和P4完整服务/人工/材料分发仍按后续路线执行。Monarch R2实现继续独立规划；本批不改运行库、金融规则、PB/PID、journal、冻结JAR、生成源码或旧失败证据。di-poc完全只读。
