# 能力台账版本与证据合同

本合同只校准代码产物说明。它不改变业务作者schema，不选择新的Scala目标架构，也不批准任何模板为金样。

## 身份与所有权

`catalog.json`是唯一类别/变体/生产路径登记源。v2沿用类别ID和既有profile，并增加真实存在但未登记的生产通道；旧记录不因失配直接删除。适用profile、运行库版本、生成入口和物理文件分别计数。

- `schemaVersion: truthsrc.artifact-documentation/v2`及`version: 2.0.0`描述本次台账格式。v1仍可读取、校验文档，但`capabilities.calibrated`为false，能力统计为null；旧`implemented`不会推导出已生成或已编译。
- `variant.capability.lifecycle`区分current、legacy、retired和reference。当前分母只含current，旧式另列，退役和参考不计新模板完成率。
- `responsibility`区分generate-code、generate-wiring、derive-evidence、consume-library、handwritten和reference-only。生成测试源码属于generate-code；测试执行回执才是证据。
- `ownership`说明谁维护这一部分，不说明质量。`generate-wiring`只生成应用装配，不生成被调用的运行库内核；`consume-library`必须为library所有权，不可声明生成路径。
- `input`、具名阶段`implementation`、`rationale`和`gaps`分别记录输入、来源、职责边界和真实缺口。未知实现必须保留缺口，不能靠改成implemented隐藏。

来源引用的`symbol: "*"`明确表示整文件定位，适用于JSON/static资产和无具名顶层脚本。它不声称找到了某个符号。其他symbol按来源锁中的精确字符串复核；源码SHA变化依然失败。字符串定位不是AST语义证明。

## 生产入口及调用通道

`producers`逐项覆盖随包的39份manifest，包括正式产品profile、普通入口、直接旧式CLI和retired源码。每项记录manifest、版本、生命周期、输入、阶段和最后writer；无版本manifest写`unversioned`，不能借工具包版本冒充。

每个output合同有稳定ID、kind（无kind时为null）、相对路径选择器、实际形状、来源、条件、调用通道和处置：

- `manifest`：该入口本身的产出。
- `subproducer`：同目录中由另一正式profile调用的子生产者，不代表该manifest可直接产出。
- `auxiliary`：例如run-all独立helper，不是manifest主入口。
- `apply`/`project`：最终writer或项目wrapper的ledger、anchors和输入证据。
- `scaffold`/`init`/`pipeline`：分别是拷贝/补齐、教学初始化和队列清单，不伪装成业务renderer。

source-copy、binary-copy和marker处置保留真实产物来源，但不升级为原生模板能力。一个文件可以同时承担多个职责；多类共享同一output不是多份文件。反向覆盖检查要求每个output都有具名类别/profile处置；正向检查拒绝不存在的producer或output。

路径选择器只支持字面量、`*`和`**`。同时匹配kind及路径，不凭一个宽泛kind（例如`build`、`service-runtime`）认领所有类别。纯计划观察只覆盖此次实际产生的输出，条件分支未触发时不能冒称已观察。

## 证据层级与失效

能力层级是producer-located、generated、compiled、behavior-verified、final-approved。后四项使用显式观察记录和包内`evidence/*.json`回执。静态源码/测试文件存在不是执行回执；文档、来源check或Node生成器单测不能替代Scala编译、业务运行或人工审定。

回执声明实际命令、调用通道、输入摘要、输出路径/kind/字节摘要和检查结果。每个文件还显式声明实际观察的output合同；路径匹配只是准入条件，不能自动认领同路径下未执行的SQL/graph或其他条件分支。后续编译/行为必须绑定同一输入及同一整组生成源码，不能拼接不同样例或不同字节。failed/skipped保留，但不计通过。独立行为oracle及最终authority分别声明；没有发生的架构owner批准不得构造。维护者仍要核实真实运行日志：这些是可复核记录，不是对敌意维护者或主机的密码学认证。

producer指纹同时绑定生产合同、包内锁定来源及可分发工具输入摘要。工具根与现有project freshness一致：`lib/`、`src/`、`generators/`、`schema/`、`scaffold/`、`bin/truthsrc.js`和`package.json`；能力证据额外遵循package的显式负向排除，避免未随包的`.bak`历史造成源码仓与安装包误报。真实新增源码、删文件和schema/作者展开工具变化仍会使原证据过期。`docs/`中的台账/回执不参与工具输入摘要，避免回执自引用。安装路径不参与摘要，移址仍可核验。原project freshness未被本批改写。

`checkLocal()`实际核包内源码、完整工具摘要、回执与派生矩阵；不执行生成器、编译器、服务或历史PID探测。跨仓模式另外按原祖先revision和当前源码字节核全部外部源。外部源码未重验时仍明确`externalSourcesReverified:false`。

源码版本变化后，当前catalog只引用新的实际观察。先前12份回执保留原路径和字节，旧声明与当时工具摘要保存在`evidence/capability-v2-initial-history.json`；历史快照不是当前能力证明，也不是第二份人工维护类别目录。新ID和新回执必须来自实际重放，不能只替换旧fingerprint。第二批增加reference-only候选变体，catalog数据版本为2.1.0，schema仍是v2；不因此增加现役producer或模板通过数。

## 派生视图与维护

`CAPABILITY-MATRIX.md`由同一catalog、source lock与已验证回执派生，逐项列出全部变体及入口反向映射；checker拒绝手改漂移。`coverage.json`继续是来源/文档覆盖，不把它的通过当能力或模板质量通过。

本批只建立可信能力台账，不改变任何模板生成字节，不重签银行旧code/service回执。已记录的真实代码缺陷、完整service失败、R2下游未接入、retry/backoff/deadline OPEN和真人验收保持独立。
