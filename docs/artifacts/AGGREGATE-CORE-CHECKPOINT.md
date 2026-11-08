# 第四批 family2 阶段检查点（阶段提交时历史快照）

日期：2026-11-08。用户要求先提交再压缩，本页记录阶段成果与未通过门，**不是第四批最终验收或架构批准**。详细合同见[AGGREGATE-CORE](scala-cqrs/AGGREGATE-CORE.md)。以下obs0、FAIL及待执行事项均描述阶段提交时状态；本页保留原阶段事实，不续写为后来运行回执。当前进度见[现行路线](STATUS-AND-IMPLEMENTATION-PLAN.md)。

## 已实现的有限交付

显式入口 `scala-cqrs-aggregate-core-v1`／manifest `scala-cqrs-aggregate-core@1`，复用family1及既有七产品。kernel生成纯decide、CommandHelpers及pre-event State的七种fold；glue包含独立ActorProtocol、Aggregate、Factory、Bootstrap及Actor-specific本地Repository。主样例完整24个source entries、28条writer记录、30个磁盘文件；独立reference22文件，独立oracle17文件／35案例，另有2个生成基线测试。

不支持的外部事件生产者整体验证拒绝；不默认选择PID、adapters或实现。完整四模块目标仍 `generator:null`、`approval:null`；银行仍消费原Play-service/P23入口。

## 实际验证（各组有重叠，不相加当独立覆盖）

| 检查 | 实际结果 |
|---|---|
| 最终参考版 | 32阶段、35独立案例、2正编译／8负编译、3成对行为变异控制通过 |
| 最终writer生成版 | 35阶段、同35独立＋2生成案例及同组控制通过 |
| 七fold Counter变体 | 10阶段、8案例＋指定sequential-state-fold变异拒绝通过 |
| 谓词／命名Counter变体 | 8阶段、16案例通过 |
| family1真实回归 | 参考22、生成22＋1；各2组编译控制通过 |
| 旧Warehouse回归 | 85固定源码、原七参考替换；参考／生成各24案例通过；PB leaf单列编译 |
| Parcel回归 | 34案例、7组编译控制通过；使用已记录的有限runner适配 |
| 两家族最终Node定向 | family2 105/105，family1 107/107，无跳过 |
| 原完整计划 | 原十二样例＋family1完整18-entry计划恒等 |
| 安装消费 | 本轮已有tarball离线安装／移址消费通过；最终台账变化后的安装重验仍待做 |
| 来源／文档 | 八仓3370来源通过；BC50／Play32精确旧摘要受控同步与副本对账通过；KB424文件、0错误、1既有新鲜度警告 |
| 银行source-only | source doctor元数据通过；validate 0hard，157原子roundtrip通过；runtimeVerified=false |
| 公共完整Node | **3638项：3611通过、12失败、15 opt-in跳过。仍为FAIL。** |

完整Node的12个失败均为原十二generation样例缺少现役观察：catalog暂为obs0，测试期望每个实际输入有一条current observation。没有改测试消红；1137份生产／测试来源执行前后字节一致。需真实登记新观察后重新执行完整回归。

最终四JVM路径共85进程，均reaped，无timeout／遗留组，租约释放。使用离线JDK11、Scala2.13.14、ScalaPB0.11.14、Akka2.6.20，175个供给文件／44个公共JAR；每进程禁网、独占写根。没有银行冻结JAR、服务或数据库参与。direct compiler不冒称sbt已执行。

运行期间主会受控刷新sources.lock／coverage，故附加整仓字节恒等检查不通过；实际执行输入／producer／verifier／供给pins保持。该已知文档元数据写入单独记录，未修改原回执或伪称整仓无变化。

## 能力台账仍待收口

catalog2.3.0：125类别、523变体、41 producer、534输出合同；新23个candidate变体。**现役observations为0**，原16条声明与回执保真转historical-not-current，不重签旧证据。源码存在、运行通过和正式观察登记是不同事实；当前派生资格仍为0，不表示已实现代码不可用。

观察登记配方只在本机round准备，不作为公共生成器发布。独立审阅发现四项缺口：只读预检的roundtrip临时写入、变异源码清单完整性、外部完整计划／元数据对账、负控制进程生命周期。修复及拒绝性验证正在独占配方中完成；尚未执行正式登记。Counter exact-codec未具备含生成测试的完整同样例观察合同，明确不借family1／Warehouse回执补签。

## 压缩后的剩余顺序

1. 接收并核验观察配方四项修复；用最新真实generated execution先check，再执行原十二＋family1／family2的真实新生成观察及同样例编译／行为关联。不重签旧回执。
2. 刷新中央文档摘要、coverage和能力矩阵；重跑完整Node、artifact与必要安装检查。构建定义只有生成资格，最终批准仍0。
3. 更新有限最终验收／银行续接，核四仓差异、保护hash与资源归还；再决定是否收口。此阶段提交不自动启动下一家族、银行服务或R2。

来源锁含82条BC／Play同步文档记录的合法bytes/SHA更新，其他3288记录不变；生产指纹仍 `27e2adb01830acda97803c84824e88fc1bbfd165c7a0345b9b23340f5ae524cd`。后续不能重跑原one-time source刷新或覆写已有exclusive日志／输出。

## 保护与非结论

保留原dirty／peer内容、旧Warehouse／Parcel／family1参考及历史receipt；不将BC mjs产物称为用户认可金样。controlled journal只验ACK时序，testkit重启不是跨JVM恢复，identity adapter不代表PB验证，空历史生成测试不是业务oracle。

完整port／实现／Bridge／root、外部授权结果桥、生产serializer／PB演进／存储、银行service02新读库90秒失败、R2、retry/backoff/deadline、技术options物理字段锚、材料渠道／真人上手及架构owner批准均独立未完。

本机续接材料：`.rounds/aggregate-core-8dxynixl/`中的`RESUME-PROGRESS.md`、`FINAL-JVM-RESULT.md`、`LEGACY-FINAL-RESULT.md`、`PUBLIC-FULL-RESULT.md`、`OBSERVATIONS-CONTRACT.md`及提交后新增的`COMMIT-HANDOFF.md`。这些本机路径不是公开下载渠道；旧失败证据全部保留。本次仅本地阶段提交，不推送／发布。
