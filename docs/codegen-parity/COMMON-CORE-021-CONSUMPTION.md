# common-core 0.2.1：发布到达与本线字节核对

2026-11-16，用户已明确告知：**common-core 已发布0.2.1**。此前[进行中通报](COMMON-CORE-CONSUMPTION-HANDOFF.md)保留为历史时点，不能再据其中“尚未发布”阻塞本线。实际consumer迁移与运行语义验证仍单独记账。

## 已确认事实

| 项目 | 本线证据 |
|---|---|
| 发布状态 | 用户明确确认`common-core_2.13:0.2.1`已发布；本线未联网重复认证Central |
| 坐标 | 本地POM：`net.imadz:common-core_2.13:0.2.1` |
| JAR | 52559 bytes，SHA-256 `5461b82a00f04c813b570e925bfb801757aa4b7ebfff2806ca863b2766df4d4e` |
| POM | 4620 bytes，SHA-256 `438d773b9a74b5eaed35aa9de76bf664894be97da18441b1e12afa2c02da82ea` |
| 本地位置 | `/Users/zhongdj/Library/Caches/Coursier/v1/https/repo1.maven.org/maven2/net/imadz/common-core_2.13/0.2.1/` |
| 公开JVM接口 | `CommandHelper`三方法；helper/无helper两个`runReplyingPolicy` overload；helper对象有`withPost`、`replyWith`和`replyWithAndPublish` |
| 公开形状 | constructor/apply/copy四参数，extractor返回Tuple4，`rule` accessor存在；未见`policy/post` accessor |

`withPost`公开回调为`List[Event] => Option[iMadzError]`，返回同泛型helper运行对象。没有把该能力推广到无helper对象；无helper对象的同类withPost/publish API未在本次签名检查中观察到。

准确机器证据：[common-core-021-pins.json](details/common-core-021-pins.json)，为本轮核对记录的原字节稳定副本。误落在docs内`.rounds/`的原件保留在本机、不纳入提交；本机实施窗口的[消费报告](../../.rounds/f1-byte-parity-20261116/common-consumption/REPORT.md)也保留为本地审计入口。

## 不由这些事实推出

- JVM签名不证明Scala named args、柯里化参数分组、Product运行时arity或旧ABI兼容；也不证明重复withPost、post异常、空事件、persist/publish/reply顺序。消费这些能力时仍以正式交接与实际观察为准。
- 本地制品存在不等于所有生成器/共享应用已换classpath；同FQN源码与JAR必须只有一个供给owner。不能复制私有helper规避。
- MoneyOps、auth和业务postconditions仍归各自所有者，不因版本发布自动收进common。
- F1当前工作是固定历史Scala原始产物的字节复刻；历史raw/scaffold字节不得为追随新版本而改写。该scaffold明确非可运行、非新银行消费供给。

本线未改common源码、发布任何runtime、联网下载、编译或运行生成应用。0.2.1供给核对已完成到上述字节/公开签名边界，余项不能迁签成PASS。
