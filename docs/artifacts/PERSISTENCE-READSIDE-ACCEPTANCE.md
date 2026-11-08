# 第六批有限持久化／JDBC读投影验收进度

本页是结果记录，**不是整批最终完成裁定**。生成链和reference/generated/installed运行交付单元已通过；完整Node、跨仓副本／来源与最终保护须在同一候选上完成后再收口。

## 已通过的有限运行

| 门 | 真实结果 | 原始执行身份 |
|---|---|---|
| 唯一作者、严格产品及初集成 | 产品182通过，初集成42通过；作者validate与roundtrip | product02 / integration01 |
| 修后定向生成与安装 | 31通过／0失败／0跳过 | integration02 |
| 独立参考 | 14独立测试、双JVM文件重放，9阶段 | reference-core05 |
| 离线安装与移址 | 885包成员、39producer条目／45最终文件；consumer拒checkout读取 | installed-pack02 |
| 安装后真实运行 | 44阶段均符合预期 | installed-core02 |
| 最终checkout生成与运行 | 602捕获输入含bin；39条目／45文件；894运行输入保持；44阶段 | generated-source04 / generated-core04 |
| 旧计划恒等 | 14样例942条目、原根module11条目；不归一化路径冒相等 | legacy-plans04 |
| 当前能力 | 28新观察；旧12生成、三个旧族重新执行、本族复用有效运行 | persistence-readside-current01 |

44阶段包含14项独立oracle，默认和Frame同名变体各4项shape，6对运行时正负控制，3项编译正控、2项编译负控和1项同名ABI编译正控，以及跨JVM文件重放。36进程exit0，8个预期拒绝进程exit1；后者仍保存failed process receipt，通过的是精确负控制断言，不是把失败改签为进程成功。JVM保持120秒、512MiB、2CPU及OS禁网，实际wait/reap与共同运行位归还均单列核验。

## 作者、wire与事务边界

Warehouse Reserve/Commit、guard/fold和ReservationIdentity port保持原语义；binding仅选技术registry/store/source/容量/现有state-map索引。版本化Frame包裹原PB，稳定type/version/layout与manifest先验证后decode，serializer只绑定本族Frame。未知能力拒绝，没有任意SQL/Scala正文或业务身份猜测。

真实H2文件库用同connection原子写event/state/index/checkpoint，precommit失败回滚；commit抛异常可能结果未知，以精确重复重试核提交事实。JVM A持久事件源和旧target前缀，JVM B以IFEXISTS读取既有事件续旧target及重建新target，不重造历史事件。来源缓存不是生产Akka journal。

## 来源与证据

当前catalog2.5.0的125类别/571变体/43producer与来源锁、能力矩阵由公开工具验证。本族新增35变体/34输出合同，39物理producer条目；schema Scala与DDL SQL分别登记，build/config/SQL不进入Scala编译子集。条件exact-value-codec在本样例未出现，不登记其运行资格。原24观察/544引用在[版本化历史](evidence/capability-persistence-readside-prior-current06-history.json)保留。生成UTF-8 spans经单一writer、graph/ledger/anchors回到作者和技术binding；不恢复inline @knowledge。

本地执行原始目录为 `/private/tmp/persistence-readside-<执行身份后缀>/`；其内容是本机审计材料，不是远端可下载或可迁移的运行认证。可分发的类别/来源/能力观察在本公共目录；最终回执不以Git HEAD替代完整工作树指纹。

## 保留失败与修复

reference-core01供应分类预检失败、core02测试helper名称遮蔽、core04 H2设置误判、最初onboarding evidence映射判空失败均保留。H2实测默认IGNORECASE无行、FALSE为0、TRUE为1；只修实际检查，不把fixture改为规避输入。既有VARCHAR_IGNORECASE列仍拒绝。

catalog-prep01/05和current-readside-preflight08/09是独占准备／消费接口失败，后继新身份修复；不覆盖旧结果。Provider限流不是测试成功或工程完成。默认Node发现新增显式工具只跳过其运行入口，显式JVM断言/限额保留；新锁在实施后、执行前固定，不能冒称所有oracle早于实现冻结。

## 尚未完成的收口门

- 一次完整Node默认发现回归（串行，60分钟外层；每测试原期限不变，skip独立报告）。
- BC/Play仅固定说明副本的expected-digest同步、八仓来源／本地／snapshots及BC文档门。
- 四仓index／HEAD／原dirty、历史／失败／来源精确保护与本批最终交接。

不包括生产Actor journal、断电强杀恢复、MySQL/Mongo、历史迁移、完整四模块、API/页面、Saga/Monarch、银行replay/R2或真人签收；final-approved为0。不得自动进入下一族或提交／推送／发布。
