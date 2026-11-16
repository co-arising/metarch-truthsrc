# classic @2：本包实施与验收范围

日期：2026-11-16。承接已完成的 [F1 四件](F1-IMPLEMENTATION-CLOSEOUT.md) 与 [逐字节优先合同](ACCEPTANCE-AND-FEEDBACK-CONTRACT.md)。本页登记本包范围，**此时实现已落盘、公开CLI验收尚在执行，不签PASS**。

## 同输入与源码族

新增目标 `generators/scala-cqrs-classic-v2/`，消费同一完整 `truthsrc.classic-architecture-input/v1` metadata；product为 `classic-architecture@2`、payload `/v2`、capability `classic-source-scaffold@2`。`@1` 的原四族目标仍存在，输出字节和合同须实际回归，不原地扩大它的范围。

| 族 | 当前两份输入中的完整源码件数 | 独立expected | 未迁签的义务 |
|---|---:|---|---|
| application-protocol / command-helper / aggregate-behavior / domain-entity | 4 | 原F1完整文件亦保存在新15件scope | 原查询占位与错误reply仍保留；不等目标业务回复已完成 |
| value-object | 1（Money） | 原CodegenMain实产361 bytes | defaults／Instant／>22／派生谓词等条件不是当前Money输入的双端覆盖 |
| invariant-rule | 9 | 原九件`RuleRule.scala`完整文件 | 规则logic只在注释／prompt、apply仍???；不等金融决定实现 |
| event-handler | 1 | 原CreditBalanceEventHandler全文 | 7个mutation＋1个helper；helper参考只进入prompt；formal fold不在此产品 |

本范围是**每输入15份完整Scala文件**，两份完整metadata为baseline和已固定的timestamp `LongType→IntType`变体。不是15业务用例、7/42覆盖率、108-file全项目、F2、银行应用或Plain FP最终通过。

## 独立资产与边界

- [新参考README](../../test/reference/classic-cqrs-v2/README.md)、[精确scope](../../test/reference/classic-cqrs-v2/scope.json)、[来源与库存](../../test/reference/classic-cqrs-v2/provenance.json)、[保存manifest](../../test/reference/classic-cqrs-v2/manifest.json)。
- 新两request位于 `test/fixtures/classic-cqrs-v2/`，只读引用原F1两metadata/options，不裁剪字段或补金融语义。
- 独立asset owner定点读取原Scala四套成功生成的15路径并核A/B原bytes，再保存两套30文件，共72067 bytes；没有用JS output回填expected。
- 原108regular-file清单中的另93件每套只inventory，未读取／复制payload。JS ledger/anchors仅inventory；所有其他额外文件须失败。
- 原F1、raw树、源码/classes和成功／失败回执均未改。金样保存不是@2运行证书。

## 接线和所有权

模型／Builder／Template分别承接固定Scala的结构、命名、类型和语法；共享assembly统一header/path、TypeRef source deps和文件级source ownership。业务参考字符串仅放原有限实现槽，不接受whole-file expected。

`@2` 特有的事件StructRef必须有声明和唯一实体owner；命令冒充结构、unknown tag、错误retained/Either和不明来源不能退成Any。占位仅trusted实现Symbol＋exact manifest＋唯一正确版本product＋exact non-runnable readiness通过；没有`allowPlaceholders`调用方开关。

当前planner要求所有本地deps在同一完整plan，按path排序写出，不承诺拓扑DAG、生成源码可编译或应用可运行。嵌套handler type alias归Entity文件，不能因短名相同误归独立handler object。

## 正在执行与后续

公开 `bin/truthsrc.js generate-products` 和 `tools/codegen-parity.mjs` 负责当前候选的真实反馈。先@1两套4件回归，再@2两输入各15件；差异修生成器，不改金样或actual。最终还须确定性、实际文件negative、严格准入／现役profile保护和独立质疑。每命令120秒，固定Node22.23.4，新独占out与报告，失败保留。

未运行tests/typecheck、内部import-and-call或JVM补样；没有下载、服务／容器、commit/push、shared app／作者树／旧generated写入。common0.2.1已发布且已有pins，本包不重查演进、不改历史raw以追新API。

完成时新增独立收口记录绑定实际候选pins及公开回执，不擦掉本页的实施前验收状态。#683更宽主线仍开放：其他族/条件/B、F2、curated用户target、Plain FP／ScalaCheck／CC、字段回锚与真实消费。
