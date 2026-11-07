# 第二批：目标profile与独立参考验收

日期：2026-11-07。起点是已完成第一批能力校准且未提交的工作树，JS HEAD `31a1480db11fbe611b11be38fcc90ae4570c03ba`，BANK HEAD `cf75af01b71607697548277f1ffbc04a27256ffd`。对应[原路线第二批](STATUS-AND-IMPLEMENTATION-PLAN.md#第二批固定目标profile命名规则和独立参考)。本页记录本批工程证据，不是新生成profile启用、最终金样批准或银行运行验收。

## 已交付的有限合同

- [目标profile与命名合同](scala-cqrs/TARGET-PROFILES.md)明确`scala-cqrs-legacy-compatible-v1`与`scala-cqrs-modular-candidate-v1`。前者要求显式原名字，后者是新项目推荐candidate；两者均没有新增generator manifest，不替换当前银行入口。
- 公共`lib/scala-target/{profiles,naming,model}.mjs`分开知识ID、Scala类型/成员/package与SQL/PB/wire/PID/operation/codec身份。处理缩写、关键字、显式Unicode绑定、scope冲突、可移植文件名、完整前后缀及保留成员。稳定身份原字节保留，不承担后端schema语法校验或冻结格式迁移。
- 结构模型验证record/sum/嵌套容器的完整签名值闭包、四模块依赖、纯Bridge、外置实现与root绑定。共享文件显式`fileStem`，不复制VO；不支持的类型不回退Any，输入不包含Scala代码体。模型只约束声明，不自动证明手写算法纯度。
- 原Warehouse七源码保持。新独立Parcel参考含**10份生产Scala、3份独立测试**，另有build/README/offline runner；它使用只读路线表和容量计算，不是生成器输出、银行金融oracle或另一棵业务canonical。
- catalog数据版本**2.1.0**，schema仍v2；125类别不变，新增**14个reference-only变体**后共**487变体**，39manifest及501输出合同不变。新变体无producer route/生成证据，不进入现役JS生成完成率。

## 实际验证

| 检查 | 已记录结果与边界 |
|---|---|
| 目标合同/参考Node | **38通过、0失败、0跳过**；包括独立审阅反例、路径/签名对照、CLI拒绝与防隐式JVM发现 |
| 独立Scala最终参考 | **34/34测试、3suite通过**；kernel20，root14；逐模块生产编译、分离测试classpath |
| 编译负例 | **7/7独立正负控制对通过**，另有无生产实现的红灯控制；错误退出必须含指定file/symbol，不接受环境错误/超时/信号 |
| Scala执行完整性 | **24阶段全部接受**；16参考输入、10工具链文件、32临时输入/反例前后SHA一致；网络拒绝、写入限新输出 |
| 当前生成观察 | **12份新回执**实际重放；输入及900条重叠样例artifact记录与首批相同。900不是900个独立文件；只生成计划，不apply/目标编译 |
| 银行source | doctor通过；validate **0 hard、37既有notice**；**157原子roundtrip通过**；runtimeVerified:false |
| Artifact定向/原聚合参考 | **68/68**目录与能力测试，**36/36**原聚合模型/完整源码/回锚对照；不是再次运行Warehouse JVM |
| 文档兼容同步 | BC50、Play32项均在核对原摘要后通过公共sync更新，未手改消费副本 |
| 公共完整`npm test` | **3418项：3403通过、15明确opt-in跳过、0失败**；993份源码/测试/生成输入前后SHA一致 |
| 离线移址安装 | 最终tarball安装后移动prefix，新的目标API、非银行模型/碰撞/稳定wire检查、原Counter及Catalog闭环通过；不回退作者checkout，不要求JVM |
| 跨仓来源 | **8仓3225来源**通过；比首批增加3公共模块和16独立参考文件，原来源祖先revision含义保留 |
| BC文档消费/KB | 定向Node **2通过**；424 Markdown、0错误、1项既有新鲜度警告（20文档），没有运行BC Scala |
| 最终保护/链接 | 五仓HEAD保持、index为空；**142文档/513本地文件链接**通过，`git diff --check`通过；见下方精确写面 |

公共15跳过仍是BC实际加载/Scala消费/迁移和actual-bank等显式opt-in，跳过不算通过。定向检查与完整回归有重叠，不相加当独立覆盖。完整回归后只更新验收/导航文字、来源文档摘要与本人协调行，没有改993份已验输入；最终再次检查来源/安装/保护，不冒称重新跑第二遍全量。

Scala实际环境为Darwin、AdoptOpenJDK11.0.11+9、Scala2.13.14、ScalaTest3.2.15；Node22.23.4。没有运行sbt，也没有下载依赖；build.sbt用于独立工程定义，实际验收使用显式离线direct compiler。未宣称最低Node22.13、原生Windows或其它JDK/Scala补丁已实测。

## 独立审阅与失败保留

- 首轮命名/模型测试在模块不存在时实际失败，后实现转绿。
- 独立审阅复现三项漏洞：role数组通过属性键转换绕过pure/Bridge检查、final JVM成员冲突、反引号reservation绕过。新增三失败测试后修复；第二次复核又确认保留成员不应限制method-local参数，正例失败后按实际scope修正。
- sum变体完整字段纳入闭包，显式共享源文件与大小写文件别名分别校验。
- 参考独立审阅没有发现行为错误；补强请求route ID与解析route ID不同的断言后，使用新scala02目录完整重跑34测试，不修改scala01结果。
- 验证脚本在Node全局test discovery下不会隐式启动JVM。日常Node通过不等于重跑Scala；实际Scala只有明确记录的两个隔离执行。
- 两次shell包装报临时ENOSPC时，真正命令日志已落盘并显示预期缺模块红灯；实查数据卷约50GiB可用，没有据此删除任何材料。
- 首次跨仓检查与新增验收页并行，来源3225文件全部一致，但新页尚未登记，返回UNREGISTERED_DOCUMENT而失败；随后纳入文档锁并重验通过，原失败保留，没有放宽检查。

## 证据新鲜度与资格

新增公共工具源码改变生产指纹。旧12回执保留原路径及字节，历史声明和原工具摘要固定在`evidence/capability-v2-initial-history.json`。当前catalog引用12份新ID观察；实际重放验证旧输入及artifact字节恒等，未替换旧fingerprint或把历史重新签成新结果。

现役JS代码/装配仍是61类producer已定位、60类样例生成；派生证据3类中2类样例生成。**现役生成器compiled、独立behavior与final-approved仍为0项新台账晋升**。Parcel的真实编译/行为是手写reference candidate证据，不冒充生成器目标通过；最终架构owner批准为空。BC mjs仍不是金样。

## 保护与剩余边界

本批不改既有generator/model/template、作者schema、银行truth/binding/手写/固定Scala测试、PB/PID/serializer/codec、P23/R2运行库、generated/current、ledger/anchors或旧回执。银行仅更新续接说明；BC/Play仅中央派生文档与本人协调行。没有启动银行JVM/数据库/HTTP/浏览器、清理历史或创建worktree；未commit/push/tag/publish。

相对本轮`before.json`，JS改变29份已有文件、新增38份（3公共模块、4测试/helper、16参考文件、2合同/验收页、12新观察和1历史声明），其余1476份保持；BANK仅`docs/TRUTHSRC-CONTINUATION.md`变化、472份保持；BC仅50派生说明/索引及本人协调行、11725份保持；Play32派生说明/索引、334份保持；di-poc1285份全部保持。原脏`.gitignore`/`.DS_Store`/缓存及前批未提交实现保留；不存在自动提交或工作区清理。

本批终点是目标合同、命名/结构验证及可执行独立参考，不是整个P2或所有模板完成。后续按既定六家族先值/精确类型/命令/事件/状态再逐步接入renderer和完整writer；不自动切换银行或把当前mixed名字全局驼峰化。完整service新SQL replay失败、90秒gate、R2下游、retry/backoff/deadline OPEN、材料公开取得及真人上手仍是独立开放门。

本机证据：`.rounds/target-profile-7au68o87/`中的`before.json`、`SCOPE.md`、`REVIEW-DISPOSITIONS.md`、`target-final-03.log`、`scala01.log`、`scala02.log`、`observation-run.json`、`observations-01.log`、`compat-sync.json`、`bank-source-validate.log`。完整Scala结果分别在`/private/tmp/target-profile-7au68o87-scala01/`、`scala02/`；这些是实际本机运行材料，不要求新clone或安装包依赖作者绝对路径。可复现源码/显式runner在`test/reference/module-seams/`，基础CLI包不带JVM测试工具。
