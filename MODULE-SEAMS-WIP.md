# 第五批 module-seams — C/D已执行，E当前观察检查点

日期：2026-11-08。按用户“先提交，然后给我一个压缩上下文的窗口”停止新增实施，保存本地检查点，未推送。**第五批整体验收尚未完成，不能称完整CQRS生成器、发布或架构最终批准。**

## 已完成的工程与执行

- A有限作者/合同门与B正式门通过。两版本化产品 `module-seams-contract@1`、`module-seams-composition@1`；单context Parcel，7份生成生产Scala、3份外置手写实现，另2build/2shape测试。独立参考和原oracle保持。
- B的文件互引、support FQN和query捕获三项修复已在 `f631bc296682` 提交。修后64定向、724有界回归、旧14完整计划942entries全等；作者validate/roundtrip通过。历史摘要不能冒完整历史maps。
- C新增test-only纯JVM供应和执行接缝。11个离线JAR、102份供应文件含75份JDK运行文件；原PB默认接口保留。POM读取与严格mutation谓词从旧helper提取，旧exports保留。
- C主样例reference25＋generated-mixed27阶段通过：四模块分别编译，每lane原34业务测试、七组编译正负控制及无production反例；mixed另2个生成形状测试。三手写不计生成算法。
- C扩展60阶段通过：构造参数顺序、显式/隐式EC、委托member/参数/结果、三模块缺实现、同模块shadow共10组编译配对；Bridge参数和root路由注入两项精确业务变异必须命中指定失败断言。
- 五个真实作者变体35阶段通过：split Parcel、全部records分文件、业务sum/support同短名、root/support同短名、direct实现无Bridge。direct另有实际行为与未implements port的编译负控，不伪造Bridge以跑原34。
- D离线pack/install、移址prefix和installed-only loader通过；回锚/query/view、重复零源码写、手写/合法装配输入名称/作者签名三类stale→显式update均通过。
- installed mixed60阶段通过；之后生命周期硬门窄修，再次以新身份完成installed60阶段。旧family1/family2 reference/generated四lane93阶段真实回归通过。所有相应JVM均有生命周期回执，外层自然close、组空、租约归还。
- 最终该窄修定向Node **82/82通过**；这是有限suite，不是完整公共Node通过。

## E：已登记，当前观察已重录

- catalog **2.4.0：125类、536变体、42个producer**。新增module-seams的11个输出合同、10个类别生成变体和3个手写维护变体；原14个modular reference-only变体保持，最终批准仍0。
- `docs/artifacts/scala-cqrs/MODULE-SEAMS.md`、13个相关类别页和PROJECT说明已补齐；package增加有限测试入口。
- JS来源锁1112文件；当前生产指纹为 `9159c35c62faeb90e2712d9131e10510f27e6e25198af7066e9f69934b8a3374`。
- 新current06实际重新执行旧12样例的条件化observer和三个候选家族的作者→最终writer→匹配编译/独立业务链。三个generated lane共109阶段通过；登记 **24份新的当前观察**，本地目录检查通过。build只具生成观察，不随direct compiler自动晋级。
- 旧20观察及其receipt保持原路径/字节，不重新挂current。完整modular target仍 `generator:null`、`approval:null`，银行/R2未切换。

## 失败历史与审阅处理

- C第一份Node runner漏OS sandbox，启动前拒绝，不冒作RED；新接口真实RED8为2pass/6fail，修后47/71/74/75/81等中间回归分别记录。
- D安装01/02失败：主新测试将固定version1改为2，公共入口正确报invalid。改为合法root输入名称变更，未放宽规则/断言，03通过。
- 有限静态review发现suite-rejection回调可覆盖生命周期失败。共享helper新增不可覆盖的error/signal硬门；当前实际严格回调本身已拒绝这类失败。修后82中1失败来自旧VM表达式测试漏注入新helper，补接线后82/82通过。未伪称此硬门另跑过旧生产RED。
- lock02只采声明符号，漏旧text-backed引用符号而失败；lock03按既有口径核实际源码文本，候选目录通过后写入。
- current05三族109阶段通过，但最后观察ID重复被拒写；旧12条件化observer也需复用原实现。current06采用sample唯一ID与既有observer全新重录，未覆盖或重签05。
- 多次代理上游拒绝/限流不计实施或review完成；结果按实际落盘和进程回执核定。有效review范围限baseline执行器、mixed输入准入、纯JVM/PB接口，不冒全量独立审计。

## 此检查点未完成的门

- 完整公共Node、最终artifact专属suite与完整onboarding组合未执行；`e-full-node01.mjs`只是准备，未启动。
- BC50/Play32兼容副本仅prepare与保护预检通过，**尚未apply**；八仓source/snapshots最终验证未执行。不要把本地目录通过冒八仓通过。
- C/D正式最终裁定、E中央总状态/兼容同步、最终有界审阅与整批验收仍待续接。没有最终架构批准或发布。

## 保护、资源与续接

提交前新preflight08核原102dirty、126protected、20历史receipt保持；2466个非本次修改watch无漂移，四仓HEAD/index一致。仅JS本会话文件及BC本人心跳/运行位两行列入提交；BC peer整板不混提交，银行与Play不提交。

current06外层PID76993自然close0/组空，提交预检只见核验自身Node，`shared-jvm-leases/jvm-slot`已释放。旧usedmarkers、失败目录与exclusive回执保留，所有已用配方不可重跑。capture不是FS锁，apply无全局回滚保证。

最新压缩续接入口：`.rounds/module-seams-r_ya32kf/CD-E-COMMIT-HANDOFF.md`。旧B提交交接不再是当前工程停点。ignored rounds是本机证据，不是发布渠道。

不动银行作者/binding/输出/graph/anchors、P23/PB/PID/codec/journal、共享apps、服务/DB、runtime或R2。银行fresh readside90秒失败和retry/backoff/deadline OPEN独立保留。后续commit/push需对应授权。
