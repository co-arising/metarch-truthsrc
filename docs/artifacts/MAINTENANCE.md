# 文档目录校验器维护

公共命令默认只读；兼容同步只有显式`--write --expected <绝对路径JSON>`才写，而且只允许BC/Play各自固定artifact文档目录、`.md`与派生索引。硬链接/symlink、未知目标和摘要漂移拒绝，不能借目录配置覆写应用源码。

## 修改目录

1. 修改对应类别Markdown；需要新职责时在catalog声明稳定ID、别名、profile、实际sourceRefs和依赖。
2. 更新相关来源的完整清点；源路径与所有发射点保持记录，模板/静态文件不能仅因后缀不是mjs而漏掉。
3. 复核`sourceRefs`的真实符号及最终writer，更新sources.lock相应指纹。对真实代码漂移先解释，不把新的错误实现自动升为正确目标。
4. 用`coverageSummary(catalog, lock)`重新派生coverage，运行local/cross-repo与兼容快照检查。输出应保存到新的维护窗口；不得手写pass字段。
5. 同步旧入口时先清点目标原字节，`expected`必须精确覆盖所有将写文件。保留旧source基线和失败回执，不使用全仓reset/stash。

清点/校验函数在`lib/artifact-docs/`：`discoverSources`、`sourceFacts`、`emittedKinds`、`classifySource`、`verifySourceReferences`、`reconcileInstance`、`coverageSummary`。这些函数不运行被扫描的生成器。动态输出需要具名职责合同并用已有pure-plan fixture核验，不仅正则计数。

## 版本语义

sources.lock的revision是捕获基线，不要求HEAD永远等于该值，否则目录自己的提交会造成无法收敛的自引用。完整检查要求基线是当前HEAD祖先，同时逐文件/清单/SHA核对当前字节；新增生产源、删文件、模板或输出kind漂移仍会失败。报告同时列baselineRevision和actualRevision。与基线无关的分支拒绝，来源对象不会被自动fetch。

本地包检查没有外部Git/仓库前置，只能报告包内source与文档一致，以及外部锁中是否已知有未分类项。`externalSourcesReverified:false`不可省略；跨仓缺源则不能通过。

## 能力台账v2

[能力合同](CAPABILITY-CONTRACT.md)规定生命周期、职责、生产入口/输出通道和证据层级。[能力矩阵](CAPABILITY-MATRIX.md)是派生视图，不能独立手改。v1只兼容读取原文档登记，不从旧implemented推导能力统计。v2新增producer或输出时必须同时更新相关变体routes；删除映射、未解释的新manifest、无来源的entry/writer、错误的library归属都会拒绝。

生成观察用实际输入与输出摘要，只有执行后才登记generated；目标编译、独立行为及最终owner批准分别有自己的证据，不能借Node源码测试或现有golden晋升。来源锁的`productionToolSha256`与现有project freshness覆盖相同工具根，使schema、作者展开库及package变化也能使旧证据过期。`*`定位表示整文件，不假装符号精度。

维护后用`renderCapabilityMatrix(catalog, lock, verifiedObservations)`派生矩阵，再刷新documents摘要和coverage。回执必须先经`validateObservation`或`inspectCapabilityObservations`核验；普通对象上的passed字段不能成为统计依据。改变工具后创建新的真实观察，不重签旧运行材料。

## 不做的事

- 不把校验器变成可执行任意外部代码的文档生成平台。
- 不让业务仓维护另一套compiler/anchor/模板。
- 不把固定示例清单当未来所有generator的白名单；第三方入口仍按原开放合同。
- 不以`misc`、大目录豁免、反复刷新baseline或更改oracle消除未知类别。
- 不清理source/数据库/journal，不启动服务或发布制品。
