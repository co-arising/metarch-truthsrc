# aggregate-rules-formal v2 — 质量执行未通过，暂不作为金样展示

## 当前结论

**BLOCKED / NOT_QUALITY_ACCEPTED。** 用户要求先通过Scala编译、ScalaCheck及Plain FP/OO圈复杂度门，再展示金样。本版本尚不满足；不请求用户认可，不开始JS，不推进其余七族。

原v1完整保留。本目录继承v1业务设计，在独立v2中修复类型检查和测试辅助结构，新增Scalameta AST度量与真正ScalaCheck质量规格。原34族raw接受不变，`all31Closed=false`。

## 已真实执行与未执行

固定工具链：JDK11、Scala2.13.14、真实common-core0.2.1接口JAR、ScalaCheck1.16.0、Scalameta4.7.7及有限缓存供给。没有下载、运行库发布或同包CommonTypes stub。

执行根：
`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/.rounds/aggregate-rules-formal-quality-20261118-01/`

|候选attempt|实际执行|结果|
|---|---|---|
|01|domain编译；性质/检查器编译|domain退出0；检查器缺Position/prettyprinters导入，退出1|
|02|domain编译；性质/检查器编译；AST度量|两次编译退出0；度量退出1，52个未支持匿名函数节点、25处测试辅助代码超限|
|03|编译前准入|同一15分钟预算不足，0次JVM调用，未运行|

共5次实际JVM调用，原进程记录的elapsedMs合计27785ms。大部分窗口时间耗在主会话修订测试辅助代码，并非编译器执行；不以此推测后续性能。

attempt02报告13个源文件、580个作用域。生产domain 37个已登记scope的最高CC为5、控制嵌套为2；**整体AST报告仍失败且匿名函数登记不完整，不能据此称生产完整质量门已通过**。

本轮后续修订增加匿名函数scope、重构若干长断言/生成前提、将13个业务负对照分开登记。最新源码与attempt02字节不同，尚未重新编译或测量；不把旧编译结果转签给新源码。

ScalaCheck业务性质、分析器性质、三个seed、13个业务负对照：**全部NOT_RUN**。候选质量PASS、用户金样认可、JS实施：均未发生。

## 复杂度控制合同

- 真实Scalameta Scala213 AST，不用正则数case，不用ScalaCheck充当parser。
- 逐method/closure/匿名函数/partial function、初始化、父构造参数和默认值记录源码位置与原数。
- 父scope包含closure决策增量；closure也单列，不重复添加其基础1。else-if按同层，真实控制嵌套另计。
- domain默认CC≤5、控制嵌套≤2；测试辅助默认相同，不用项目平均值。
- `quality-policy.json`与`scope-exceptions.tsv`是待收敛的实现输入，不是用户已认可的逐scope高复杂度例外。当前存在测试/语法分发的拟议例外，尚未取得最终度量与独立认可；**不得以此降低阈值洗绿**。
- PlainFP/OO结构门拒绝声明的可变状态、时间/I/O/外层依赖、无类型兜底等。仅语法检查不能证明任意注入实现纯度；仍需要行为性质与具体依赖审阅。

## 剩余工作

1. 收敛作用域身份与例外，仅保留明确合理的有限语法/场景分发；普通辅助方法优先重构，不能给整文件豁免。
2. 完成分析器计数性质与非法结构负例，核完整文件/scope/性质名单，防止漏项或删测通过。
3. 核最新源码、入口和策略身份后申请新的独立质量执行范围；旧15分钟budget不延长、不刷新，attempt01–03原件不覆盖。
4. 最新完整源码编译、AST门、三个seed的ScalaCheck及逐名负对照全部实际通过，独立证据核对后，再交用户看该具体版本。

本目录文件是未验候选，不是可交付金样。身份见manifest.json；实际与未执行状态见review-status.json。原v1的技术设计讲解在相邻v1/README.md，不构成本v2质量证据。
