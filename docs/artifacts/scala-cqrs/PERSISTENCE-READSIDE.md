# Family4：有限持久化与 JDBC 读投影合同

第六批显式入口为 `scala-cqrs-persistence-readside-v1`，目标身份 `scala-cqrs-persistence-readside@1`。**当前处于实施中，尚未完成生成／安装／整体运行验收。** 本页规定有限支持，不替代机器执行回执；全量 modular profile 的generator/approval仍为空。

## 职责与独立资格

沿用[family2](AGGREGATE-CORE.md)的kernel＋glue，不引入Play应用、HTTP、Saga/Monarch或生产journal默认值。

- kernel：原值、业务协议、Rules、CommandHelpers、EventHandler、State及计算port，不依赖Akka/JDBC/PB。
- glue：版本化frame、serializer注册、EventAdapter/SnapshotAdapter、显式Factory，以及JDBC Schema/Repository/Handler/Runner和已持久事件缓存读取接口。
- build、配置和生成测试另计；未运行sbt不得称build执行通过。

两项证据严格分开：**Actor持久化适配/serializer注册**与**JDBC读侧文件库跨JVM重放**。后者不证明生产Actor journal耐久性，不创建通用Akka journal插件。H2原生dialect验证不推广为MySQL或Mongo兼容。

## 唯一作者与技术绑定

配置作者树是唯一业务维护面；canonical/request/compiled是生成物。示例复用Warehouse-lite的业务事实，不为读侧引入新的warehouse身份字段，不复制event→state fold，也不生成ReservationIdentity算法。

新`persistence-readside-contract@1`显式依赖原七个产品：reference-layout@1、exact-value-types@1、exact-value-codecs@1、domain-decision@4、domain-dependencies@6、domain-folds@6、domain-external-events@2。两处external producer必须为空。

独立的`truthsrc.persistence-readside-binding/v1`通过project.documents/roles捕获。binding选择aggregate、wire注册、store/source身份、容量及一个实际state-map字段的索引映射；不承载任意Scala/SQL表达式或另一套业务模型。旧artifact-contract@3、journal-readside/v1及非空service.projections的拒绝边界不变。

有限支持为单context、单aggregate、一个map索引，map的key/value沿非递归nominal链解析到String；不支持任意read model、join、排序表达式或exact/numeric/record索引映射。SQL尺寸是显式存储容量，不是新增业务字段定义。超出支持范围必须拒绝，不能静默省略输出。

PID及resource由调用方明确提供，不透明地保留，首次持久关联后不允许冲突。本合同不能从payload中本来不存在的身份证明来源授权或仓库归属。

## Wire身份与兼容

技术frame包裹现有领域PB bytes，独立proto，不修改原领域PB字段布局。frame包含envelope版本、event/state角色、稳定type ID、wire版本、布局SHA及payload。

- serializer整数ID来自显式binding；manifest来自注册表，不取class simpleName，不反射找类。
- 只注册本族Frame，不绑定AnyRef或所有GeneratedMessage。
- decode先检查frame/manifest/角色/版本/layout/payload边界，再进入唯一领域parser/converter；未知type/version/role、错manifest、未知frame字段和坏bytes拒绝。
- SnapshotAdapter同样检查frame，不能因没有外层manifest忽略版本门。
- `truthsrc.persistence-wire-layout/v1`将每个持久化root的传递PB字段号、类型、容器/presence、领域ref及exact codec编成稳定描述；其SHA与技术binding中显式期望核对。来源位置或全局工具指纹不是wire布局身份。
- 产品静态准入只接受期望pin的形状；实际pin匹配属于producer lowering门。测试中的synthetic SHA绝不能成为真实兼容证据。布局变化不自动更新期望、不自动upcast或迁移旧数据。

静态readiness继续`static-contract-only`、`runnable=false`、`runtimeBindingVerified=false`；实际同样例测试单独计资格。

## 同事务更新与查询

JDBC机械层复用既有typed SQL、connection事务、namespace锁和session纪律，新版本按需增加有界事件读取和分区替换；旧兼容producer完整输出必须保持。

一个新事件在同一connection内完成：验证注册/身份与连续序号 → 原EventHandler → event row → state frame → 该PID的receipt索引分区 → checkpoint → commit。任何precommit异常不得留下partial state或提前推进offset。commit调用异常可能是未知结果，不能报告成必然未提交；重试通过已持久的精确重复事实核实。

重复旧序号只有在PID/resource/kind/source/manifest/bytes全部一致时幂等返回，不重fold；冲突payload、gap、乱序拒绝。namespace兼容键覆盖store/source/注册/layout/index与schema身份；同时检查实际数据库结构，不能只比较自由文本version。

receipt query按resource等值筛选，使用包含完整有序key的cursor，稳定keyset分页；这只是Repository接缝，不是family6 query service或授权接口。DDL初始化单独承诺幂等和不兼容拒绝，不承诺全局rollback或自动迁移。

## 有界来源、失败与关闭

source按PID列表页和连续事件页消费，不返回无界全历史Vector。同PID的并发catch-up复用同一已接受Future，限制总体pending/active和单页容量；foreign PID、oversize/non-progress/out-of-order/poison页失败可观察，不skip-and-advance。

committed checkpoint与observed frontier分开；空页只给该PID一次观察，不等于全局发现完成或整个读模型caught-up。周期失败不得吞掉。

initialize/start/shutdown结果幂等。关闭拒绝新工作，取消自有polling，继续排空已接受catch-up的内部页；内部工作不重新走已关闭的公共准入。shutdown超时明确`timedOut=true,drained=false`，之后不得追改为成功。只关闭自有任务，不关闭caller的DataSource/ActorSystem/source。

## 独立验收和来源

独立参考/oracle不由renderer输出制造，原Warehouse参考与业务断言保留。审阅后增加的边界断言与完整inventory锁必须记录真实固定时点，不能冒称全部早于实现冻结。必须分别验证HAND、最终writer生成及installed生成候选：

- 真实Akka SerializationExtension、PB bytes及版本拒绝；Factory真实使用两种adapter。
- 直接JDBC核event/state/index/checkpoint、第二connection隔离、索引写后commit前失败、实际commit后丢ACK、精确重复和身份冲突。
- 两PID/两namespace、cursor分页、过期/跨线程session、source失败、coalescing和drain。
- JVM A持久化事件及target前缀，JVM B以IFEXISTS只从文件库events读取，恢复旧target并重建全新target；不得重新注入原fixture掩盖持久化缺失。
- 缺库、不兼容schema/source/wire拒绝。正常重开不冒称强杀、断电或生产journal崩溃恢复。

所有负控制先有正控，精确命中预定编译/业务断言；任意非零退出或timeout不算负例成功。基础Node discovery不得启动JVM。

生成字段、adapter、wire注册/config、DDL/SQL参数及index映射必须由最终UTF-8 span回到作者或技术binding；通过现有唯一writer、ledger/anchors、graph/query链，保留MANUAL/retained和跨owner拒绝。installed-only项目必须完成validate＋roundtrip、compile/plan/generate/verify/query/view及真实JDBC lane；不依赖checkout作为隐藏实现。

## 当前状态与限制

已执行的历史门：离线H2供应核对、原生H2事务探针和正常跨JVM IFEXISTS重开；共享抽取前旧14完整计划942 entries及原根module-seams11 entries对账；182项产品测试、42项定向集成测试。HAND reference-core03与generated-core01分别通过11项独立测试及双JVM文件重放；生成候选含39个producer entries。

上述运行之后，又修正H2大小写比较、元数据表名匹配、Frame同名引用及session在commit前失效边界；**旧成功回执不覆盖这些新改动**。恢复窗口的installed-pack01已完成禁网pack/install、prefix移址及禁止读取checkout的生成/回锚consumer，三个子进程正常回收；其`runtimeVerified=false`，不等installed JVM验收。新增边界/负控制、installed真实运行、完整回归、当前能力及来源锁仍待闭合。本页不提前裁定整批完成。

生产闭包已开始变更，前批current06不能沿新全局指纹冒充current；原观察/失败保留，冻结后按实际重放形成新资格。银行fresh readside90秒失败、retry/backoff/deadline OPEN、R2、生产journal、HTTP/API、Saga/Monarch、真人上手及架构批准均不在本批完成口径。
