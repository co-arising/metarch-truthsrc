# 第八批有限 Play 应用验收记录

本页记录 `scala-cqrs-play-application-v1`／`scala-cqrs-play-application@1` 的有限非银行 Warehouse-lite 输入。第八批按批准的有限合同完成工程收口；原全量回归的两项安装测试超时保留为失败，测试侧去除重复捕获后，受影响套件复验通过。`approval:null`，不宣称所有 profile、银行消费、运行库发布或最终架构批准。

## 已执行的资格

- `truthsrc-play-reference-10-g8monfFV`：独立参考真实sbt compile/Test compile，五段direct compiler，CodeSource、13生命周期断言、HTTP write/reopen/fresh、9故障组、5 journal组通过。独立参考不是新renderer生成的golden。
- `truthsrc-play-generated-02-g8monfFV`：公共capture/graph/plan/单writer得到64项project计划，实际sbt及同一HTTP/生命周期/故障/journal oracle通过。
- `truthsrc-play-installed-02-g8monfFV`：离线npm pack/install、prefix移址，consumer禁止读取源码仓；主样例和真实包名/命名变体各64项，所有最终span字节核验及关键controller/routes/Twirl反查通过。工具基本安装不要求JVM。
- `truthsrc-play-installed-main-01-g8monfFV` 与 `truthsrc-play-installed-renamed-01-g8monfFV`：各自独立源码/classes、真实sbt/独立compiler/CodeSource及完整运行oracle通过。变体改变应用包、多个技术名、命令方法名和作者route参数名，原PB/PID/serializer/business identity不变。Oracle仅适配经模型核验的ABI，预期不重写。
- `truthsrc-play-controls-01-g8monfFV`：去角色/resource/CSRF后准确触发对应oracle断言；kernel反向依赖、真实routes编译产物action签名和Twirl调用签名错误准确被Scala compiler拒绝。六个变异独立classes，不覆盖生成基线。
- `truthsrc-play-startup-03-g8monfFV`：9个启动/迟到Ready/实际Loader/授权/query/HTTP runtime终止断言通过。
- `truthsrc-play-release-control-02-g8monfFV`：正常释放关闭真实FileChannel；跳过release调用的变异准确触发`owned-resource-must-be-closed`，不能用假的drained报告过关。
- `truthsrc-play-suites-02-g8monfFV`：四个实际生成ScalaTest suite，6测试通过。
- `legacy-final-a2LGqU`：16份原完整producer结果/计划，992项逐字段恒等，不只是源码文字相同。

每个执行输出保留独占目录、原始日志、源/依赖/classes哈希和公共进程回执。跨JVM覆盖正常关闭后原journal＋原H2重开及独立新H2重建；不扩大到强杀断电、生产Mongo/MySQL或集群。

## 关键修复与保留失败

生命周期已同步参考/生成，取得资源即登记。释放动作由独立、有界清理执行器执行，不把H2 disposal排在已饱和的业务线程池后再由shutdownNow丢弃。关闭使用同一10000毫秒期限；runner失败和未完成清理均不能称为drained。同步admission supplier不再持有应用状态锁。初始化失败也终止Play HTTP actor runtime。

Typed ask真实抛出`java.util.concurrent.TimeoutException`；原仅捕获classic AskTimeoutException会误报500。现HTTP504明确表示结果未知，独立反例证明返回后仍可能写事件且没有自动重发。Authority依赖不可用映射503，未知异常500，正文均脱敏。UTF-8字节限制与游标、path及event输出合同一致。

失败回执保留原时态：reference04将sbt本工程模块误当外部Maven依赖；reference06测试预期错误使用`unavailable`而非合同`service-unavailable`；reference07暴露实际Typed ask映射缺陷；reference09的伪序号oracle错误假设独立参考runner.start同步追平，修为显式catchUp后reference10通过。安装01重复逐文件反查触及120秒；优化为全span字节核验＋关键入口反查后新安装02通过，未延长期限。

启动补验01/02分别保留Scala装箱和测试配置集合错误；03通过。release-control01真实负控已拒绝，但调用了仅接受成功进程的inspector，外层报告失败；02明确分开正/负进程语义。suites01内部6测试已通过，但ANSI输出不满足精确footer，02以ScalaTest `-oW`新运行通过。

台账准备曾误判query-service-port没有输出并删除manifest项，公共项目测试真实拒绝。按实际完整plan确认其为独立输出后恢复manifest原字节，并补齐台账合同；没有修改已验生成源码或给失败重签。

## 证据时态与统计边界

当前生产工具与安装02的production fingerprint必须逐字节一致；文档和测试后置修改不是先前运行输入。JournalOracle只追加独立参考start/catchUp ABI适配，原生成lane仍保留其实际执行源码与精确失败断言。资格基于原执行和同输入源码对账，不把checkout后来字节冒作原oracle。

64项project计划包含4项派生项目证据；53条输出职责合同、46种kind、47个category/profile变体是不同维度，不能当作文件数或完成类别数。复制样例后build.sbt的外置源码绝对根不同，台账对复制出的新build仅记generated；原installed build已通过sbt这一执行事实独立保留。源码、编译、行为及最终批准逐层分开，不凭`passed`标签推导全线完成。

## 批次边界

本批不更改银行P23、Saga/Monarch冻结JAR、旧journal或历史失败材料；不操作共享app/service/container，不创建worktree，不自动commit/push。HTTP验证使用独占127.0.0.1:0；Seatbelt localhost策略不是OS精确IPv4-loopback保证。SSR仅验证服务端输出/转义/链接/授权，不认证浏览器布局或a11y。

完整Node TAP、失败到修复复验、能力台账、八仓来源及兼容保护分别记账；资格和范围以本页最终收口段及机器证据为准。

## 第八批最终收口（2026-11-11）

- `catalog-s2ztnK`：catalog 2.7.0，125类／638变体／45 producer／36现役观察；原28观察及原catalog/lock/receipt按字节保真历史化。新增47个本族变体中46个有生成观察、44个达到同输入编译与行为层；exact-value-codec在所选输入没有适用产物，两个build/layout变体仅记generated，未人为补齐。
- `node-targeted-WR9Mtq`：能力与文档74/74通过。`node-full-NxJhSz`：完整默认发现4345项，4328通过、2失败、15既有opt-in跳过、0取消；原FAIL不重签。
- 两项失败均为旧module-seams/Saga安装consumer的120秒超时，pack/install已完成。修复仅在两个测试consumer：复用已完成的public plan/verification结果、在一次已认证capture上批量反查全部源码并保留真实按行query、每个作者/binding/implementation变更仍验证stale→update→fresh与roundtrip；不改生产、测试场景或120秒期限。`node-targeted-YtZzeD`复验2/2通过；这不是重跑整套全量绿。
- 两次中途复验按真实状态保留：`node-targeted-3gntKJ`为54/55，`node-targeted-lydTpI`为1/2，剩余均是Saga消费超时；独占旧安装包86.3秒通过不替代新pack验收。相同新pack临时目录的剖析在118.55秒进入最后作者变更的verifyProject后触及120秒。只读计量显示一次captureProject有5685次readdir，其中398次扫描1191项临时目录；这是重复路径准入开销的实证，不是业务失败或网络下载失败。最终Saga每次演进复用实际update的validation/roundtrip，取消重复预演捕获，以完整verifyProject.currentInputs检查新鲜度并保留最终statusProject复核。
- 最后`node-targeted-YtZzeD`真实打包安装测试：module-seams约91.2秒、Saga约100.6秒（含各自pack/install），两项均在各消费进程原120秒限制内完成。
- `compatibility-apply-U951qr`：BC50／Play32派生文档按先前SHA受控同步，八仓3655来源通过，BC98既有dirty保持。辅助检查为作者validate/roundtrip双绿、BC文档dispatch2/2、KB扫描424文档0错误/1项既有新鲜度汇总警告、40个JS语法及46个JSON解析通过。
- `qualification-i5828H`：120份真实进程回执、四个编译运行lane、安装及六项负控和四组补验重新对账通过；没有重跑JVM。`protection-0801C6`：27451文件＋2362元数据、28历史观察通过。
- 本节及[收口证据](evidence/play-application-eighth-qualification.json)是回归后的文档delta，不追认为原执行输入。中央文档、source lock和coverage由本次closeout回执登记，最后保护核单列；生产指纹仍为`68570a50d11da7db1e031bc3cd6a51468ea39b0f990e4d6bb12b21d9a4e7ccc0`。

原失败、数据、冻结制品和历史锚保留；没有commit/push、银行迁移、runtime发布或共享服务操作。

## 最后保护复核的索引偏差

`protection-Kmyxw3`最终严格字节门实际失败，唯一差异为JS `.git/index`：`0a24c558a880225d6462365d46a6cce836bb4e230a195374959a6442d74ae62f`变为`99d7c347e0fc5ba566edd224faed22cbc6db3d6cfab18079c4b63748d5262090`。原FAIL保留，不将它改写成通过，也没有重置或重写索引。

只读二进制解析及Git条目对账确认：2119条路径、文件模式、blob哈希与stage全部等于同一HEAD `617dd65fcfb5595f0698063d2e997e536b78e3c3`，暂存差异为空，无assume-valid/skip-worktree等特殊标志。索引原字节在最终安装测试前后仍一致，变化发生在测试后。写入者和原stat-cache字节未被证实，因此不声称全期原始索引字节保真；只确认暂存内容保持。

该偏差通过[独立索引对账记录](evidence/play-application-eighth-index-reconciliation.json)明确披露；最后保护核复查其它全部文件与八仓来源，并对当前索引重复进行内容核验。没有因Git元数据变化重跑已验JVM。
