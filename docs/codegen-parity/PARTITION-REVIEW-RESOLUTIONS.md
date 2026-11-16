# 分区复核补充：具体实现、文件归属与暂缓拆分

最后更新：2026-11-16。状态：文档裁定，不是实施许可。与[分类裁定R01–R07](PARTITION-RESOLUTIONS.md)共同解释中央清单；分组原稿保留，中央以显式override为准。

## R08：Connector接口、委托实现、安装机制分别归属

实际[render-technical-ports:16–26、43–49](baseline/js/generators/scala-cqrs-application/render-technical-ports.mjs#L16)不只发声明，还生成具体Installed方法：输入/关联检查→callback→Future非空→结果关联检查，以及deployment的symbolic secretRef准入。

- typed外部提交/查询/部署方法签名：A/external-connector-port。
- 上述具体guarded委托方法体：A/connector-implementation；raw ConnectorImplTemplate本来就委托手写基础设施，不要求生成器自己实现外部后台。
- required/ownership/pins/Implementation/Bindings/install：B安装机制。
- 其它phase/authority/completion/宿主能力保留其原职责；readside关联检查不因有callback自动当外部Connector。

同一个Installed容器由一个technical assembler汇总，A独占对应方法区间，B不能再次声明“所有转发方法”。目标实现位于`infrastructure.connectors`，安装元数据位于`infrastructure.bootstrap`；应用Host应只依赖能力trait。构造可见性、依赖和具体接口仍须按diff审定。

## R09：build、Child schema与effect安装必须逐文件分配

1. runtime resolver、saga/Monarch/Akka/Play依赖及应用source roots属于`build.sbt`，不属于`project/plugins.sbt`。后者只放sbt插件及ScalaPB compilerplugin，launcher版本独立在`project/build.properties`。
2. Child每plan的execution schema与每context唯一的ChildHostEventPB不同基数、不同package；两份文件分别拥有字段/头/import，不把两者都写入execution目标。增加同context多plan的fixture义务，不改字段号。
3. EffectPorts是从现有execute/query/reconcile方法**签名提取的拟定能力trait**；当前并没有该trait。元数据、Bindings、Installed私有状态与委托、install/new都放EffectBindings装配端。Host.apply从具体Installed到能力接口的改动是待批准接口迁移，不是假装纯移包。

机器更正：[partition-review-overrides.json](details/partition-review-overrides.json)。

## TOR：只确定唯一owner，不强行批准新接口

完整[成员分配表](details/target-ownership-resolutions.md)与[机器更正](details/target-ownership-resolutions.json)覆盖8行。

### Projection

当前source-runtime与ingestion共居唯一`infrastructure.projection.<Store>Projection`。namespace/repository/materializer/serialization/killSwitch/maps/poll/closed/initialized/pendingWork/drained/shutdownResult和tracked/initialize/catchUp/watch/discover/start/shutdown/close仍由这一个实例持有；project/read/identity/payload为同类的独立逻辑方法，不另造Handler的资源副本。

这消除了“一份资源同时搬去Projection和Lifecycle”的文档歧义，但**并未批准最终A target继续偏离传统投影结构**。若要按raw拆应用projection/handler，先确定typed私有资源/transaction/tracked生命周期接口；未定则该工作包blocked，不以保留坏布局签收。

### Play

- Composition唯一拥有pages=None与完整requireInstalled（含renderer pin检查）。
- PageRenderer只拥有接口；它被引用不意味着pages成员搬过去。
- Controller唯一拥有Response/failure/invoke/action及parser错误转换callback。
- Pages拥有headers/unavailableHtml/response/staticPage呈现体，引用同一Response；不复制parser或renderer初始化。
- Routes/Components各自原owner保留。将private嵌套成员物理拆文件的可见性/接线仍未批准，不暗改public。

### Converter

当前所有nominal/exact/container/state/event节点由per-context DomainConverters唯一声明；Parts按原完整node-group确定归属。其共享owner已确定，不能在每aggregate分别复制。

当前`infrastructure.serialization/DomainConverters[PartN]`只是**来源与暂缓实施的准确责任位置**，不是对最终BC `infrastructure.persistence.converters/<Agg>ProtoConverters`目标的豁免。最终layout、公共ABI、共享类型转换提供方式与源级去PartN策略仍须在converter diff裁定。不得为了给每行填路径而发明可调用API，也不得据“retain”把FQN/机械Parts/重复helper当已达标。

## 临时写出补记

[roundtrip源码](supplemental/js/lib/roundtrip.mjs)在project capture的planOnly判断之前可建`os.tmpdir/truthsrc-rt-*`并反解作者树，再在finally清理自身parent。这是B瞬态校验产物，中央已单列`shared-project/roundtrip-temporary-tree`，不增加catalog的641分母；SQLite plan-memory不等整个project plan零文件写入。本轮没有实际运行roundtrip。

## 结论边界

已解决的是分类/唯一construct owner与明确待决位置，**不是所有target接口ready**。中央清单给出完整导航和当前可见逻辑项，同时保留3个任意外部源码槽，以及具体layout/API/fixture/依赖供给阻断。禁止用已保存591行或42份文档数量代替可实施规格及真实生成证据。
