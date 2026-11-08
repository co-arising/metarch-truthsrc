# Family-2 纯决策与有限聚合生成合同

第四批入口 `scala-cqrs-aggregate-core-v1`，manifest身份 `scala-cqrs-aggregate-core@1`。这是[目标结构](TARGET-PROFILES.md)的有限no-external候选，复用[family1领域kernel](DOMAIN-KERNEL.md)，不是完整四模块应用或最终架构批准。实现存在、完整生成、真实编译、行为资格和最终批准分开；本页不充当运行回执。

## 职责与模块方向

| 层 | 本候选职责 | 明确排除 |
|---|---|---|
| kernel | 单份值/纯Command/Event/State/RuleParams/Computations；Rules与decide、CommandHelpers、事件fold | ActorRef、Effect、PB、框架、存储、副作用实现 |
| glue/application | Actor envelope、命令处理、Factory接口、Actor-specific Repository接口 | 将Akka类型伪装成kernel业务port |
| glue/infrastructure | Bootstrap和本地Actor缓存实现；PB/converter/exact codec | 根默认实现、生产journal选择、serializer注册 |
| build/test | kernel/glue构建、PB往返生成测试、空历史replay生成基线 | 业务组合根、完整应用/服务、生成金融oracle |

纯业务协议和Actor协议分别持有消息，不保留新domain Actor入口、Entity别名或绕回infrastructure的facade。`application.factories`是Factory的包，物理源码仍位于glue。root仅聚合两个构建子项目；没有ext实现或业务root binding。

## 唯一业务输入与技术选择

配置作者树是唯一业务编辑面。正常链路：作者validate/roundtrip → canonical与source-index → project request导出 → 完整产品编译 → trusted producer → 完整plan → final writer → ledger/anchors/同图查询。

复用七产品及版本：reference-layout@1、exact-value-types@1、exact-value-codecs@1、domain-decision@4、domain-dependencies@6、domain-folds@6、domain-external-events@2。没有第二份可编辑canonical/request，也不从散文猜方法体。

options仍只有`packages/names/protobuf`。names为qualified ref＋role＋最终完整技术名：保留family1角色，增加rules、command-helpers、event-handler、rule-method、emit-method、actor-protocol、aggregate、factory、bootstrap、actor-repository、local-actor-repository。未知、重复、悬空、错角色和未消费选择拒绝。名字不携带业务字段、默认值、类型定义或实现代码。

两处external producer产品必须一致且为空；任意非空外部生产者或没有本地command producer的事件都拒绝整个候选计划，不静默漏发入口、不伪造授权。外部结果桥属于后续合同。

## 纯decide、helper与fold

- `decide(state, command, hosts): Either[String, Vector[Event]]`分发到每命令的Rules方法；方法消费既有typed Params，包含完整state/command/hosts。
- 按sourceOrdinal短路执行guard。`reject(errCode)`和`succeed-empty`都不再调用后续guard/host；通过后才构造事件。异常、溢出、单位错误不是虚构业务拒绝或空成功。
- Computations只声明真实有序inputDependencies和输出类型。CommandHelpers按产品event/slot顺序构造事件，host每个实际表达式occurrence正常求值；依赖去重不意味着缓存调用结果。
- 谓词/value-expression限定于已准入语言；类型、presence dominance、Long与exact约束来自原产品工具，不重新解析为任意Scala或引入I/O/随机。
- Long使用checked算术；exact保precision/scale及单位，不通过Number/Double、不隐式舍入。名义值结构相等与金额比较分开，不能为了重用旧字符串renderer改变typed语义。
- fold支持set、put/remove、put-all/remove-all、money-apply、integer-apply。所有RHS读取同一pre-event State；无assignment保持State，其他字段不变；同一target重复赋值拒绝。`put-all`对声明keys写同一个value。
- fold不调用hosts或重新执行decide。纯fold失败不返回半更新State，但持久化后fold失败不意味着journal已回滚。

模型只保resolved refs/types/accessors、表达式树、名称、来源和依赖，模板负责Scala语法。原family1只接受原names角色；新增角色分流后再组合，不扩权原v1入口。

## Actor、工厂与资源所有权

ActorProtocol包含Execute/GetState与Accepted/Rejected，与纯Protocol隔离。query、拒绝和空成功无persist；非空事件Vector一次交给persist，成功回复在写确认后的`thenReply`中。恢复只fold，不重新计算hosts；写失败／拒绝和host异常不产生Accepted。

Factory/Bootstrap的`create[J]`显式接收Akka `PersistenceId`、initial、hosts、`EventAdapter[Event,J]`及`SnapshotAdapter[State]`。PID必须非null且不是空白，但不修改其实际字符串。无默认adapter、journal配置或serializer。测试identity adapter与真实PB byte往返属于不同测试门。

本地ActorRepository为泛型key缓存，identity/behavior/spawn由调用者提供。Handle保留PID和ActorRef；同key复用，不同key同PID拒绝，成功且非null的spawn后才登记。失败不会占用key/PID；get/close串行并拒绝callback重入。close幂等、清缓存、拒绝新lookup，但不stop既有Actor；ActorSystem和Actor生命周期仍由调用者owner管理。

不生成actor name编码、deathwatch/eviction/自动重建、分布式PID唯一性、业务重试/backoff/deadline或host exactly-once保证。没有从本地缓存推导跨JVM恢复能力。

## 来源、写入、演进与安装

基础生产jobs与本族jobs在emit前组成同一完整计划，统一检查portable路径、依赖缺失和环；不读取另一生成目录补依赖、不先生成再替换header或删除不合意文件。新owner header使用同一UTF-8 mapper，所有span包含最终header位移。

guard、event binding、fold assignment与Actor dispatch回到真实source指针，通过source-index回物理作者file/pointer/excerpt；紧凑scalar声明不会伪造不存在的子字段。无新增inline `@knowledge`。inline技术options仍仅受输入hash保护，不冒物理字段导航。

更新只能通过作者／技术输入→preview→受控apply。不同generator不能用update接管旧owner；generated篡改和MANUAL边界沿既有writer处理。重复零源码写入不等于零ledger/graph I/O；apply也不是全局事务回滚。

安装后的包包含新generator/scaffold，用现有project CLI完成独立非银行样例；test/reference和JVM验证工具不进入基础tarball，不新增基础CLI的JDK/Docker要求。

## 独立参考与资格边界

[Warehouse-lite参考](../../../test/reference/aggregate-core/project/)与[独立oracle](../../../test/reference/aggregate-core/oracle/)先于新行为模板建立。它仅保留quantity拒绝、显式ReservationIdentity和receipt fold，并新增显式receipt空成功guard；不称旧Warehouse已有相同幂等行为，不构成完整库存交易。旧Warehouse七份、Parcel十份和family1参考原文保留；BC mjs仍不属于用户认可金样。

验证区分：参考/最终writer生成源码两条真编译、纯规则/fold、延迟ACK/写失败、本地testkit恢复、Repository生命周期、真实ScalaPB bytes，以及安装/回锚。controlled journal只证明ACK时序；testkit同PID恢复不是跨JVM或真实数据库。生成replay空历史测试不证明非空业务正确，独立oracle不可省略。

能力观察必须绑定同一producer/channel/fingerprint/输入与完整源码sample；build仅有生成资格，直接compiler不冒称sbt执行。公共全局生产指纹变化使旧观察过期，保留原receipt并真实重跑，不能改旧hash续签。无自动架构批准。

完整port/实现/root、外部事件桥、PB演进/serializer/storage、银行新候选/完整service、R2、retry/backoff/deadline、技术配置物理锚和材料/真人上手仍独立未完，见[现行路线](../STATUS-AND-IMPLEMENTATION-PLAN.md)。
