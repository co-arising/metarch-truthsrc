# classic @5 验收范围：23个新增生成族

## 验收对象

仓库 `metarch-truthsrc`，生产候选提交 `3bdd8d9ea8978dd88a104cd4d4a213622aec1fdb`，分支 `fix/classic-cqrs-f1-byte-parity`。本轮不再修改生成器；提交后的起钟身份调整只发生在本机独占准备副本。

本文件定义范围，不单独签署通过。最终结论见 [实施收口](CLASSIC-V5-IMPLEMENTATION-CLOSEOUT.md) 与 [接受记录](details/classic-v5-acceptance.json)。

## 23个新增 artifactType

| artifactType | MBT owner |
|---|---|
| `domain-service` | domain-rules |
| `application-service` | services-connectors |
| `query-service` | services-connectors |
| `saga-participant` | classic-saga |
| `saga-definition` | classic-saga |
| `saga-trigger-protocol` | classic-trigger |
| `saga-trigger-entity` | classic-trigger |
| `saga-trigger-root` | classic-trigger |
| `saga-trigger-behaviors` | classic-trigger |
| `projection-repository-port` | projection-repositories |
| `projection-repository-implementation` | projection-repositories |
| `projection` | projection-execution |
| `projection-handler` | projection-execution |
| `protobuf-schema` | serialization |
| `proto-converter` | serialization |
| `event-adapter` | serialization |
| `snapshot-adapter` | serialization |
| `saga-context` | classic-saga |
| `http-controller` | api |
| `command-endpoint-dsl` | api |
| `route-definition` | api |
| `bootstrap` | bootstrap |
| `application-bootstrap` | bootstrap |

`bootstrap` 的四种输出变体仍是一族。42个唯一生成族为39传统族＋3扩展族，不以物理文件数、调用数或空输出充族数。

## 原字节验收合同

两份已登记完整输入为 `baseline` 与 `timestamp-int`。每份独立 Scala 公开 `CodegenMain` expected 含52件：49 Scala、2 protobuf、完整 `conf/routes`；两份共104件、228241 bytes，位于 `test/reference/classic-cqrs-v5/`。

比较覆盖完整路径集合与全部 Buffer 字节，包括头部、imports及其重数、LF、EOF和原始 `???`。A→expected、B→expected、A↔B 不做片段比较，不只比较交集，不用JS actual反填expected。生成目录另有 `anchors.json` 与 `truthsrc.ledger.json` 两个control文件；它们不是两个额外生成族。raw ledger 的A/B字节另行核对，anchors不签署业务语义。

结构化 Model/Builder/Template 与集中resolver、naming、context、assembly的实现源码均随生产候选提交保存。Model不承载整份expected文件正文。

## 有效观察与承接方式

有效义务57项由三个不同来源组成：

1. 已独立实际审计的10项core：完整同输入生成、52件全路径/字节比较及A/B。
2. 已独立实际审计的42项补充：旧版本回归、负对照和非法输入准入观察。
3. 新独占窗口的5项公开 `generate-products --plan`：
   - 未声明Saga命令的精确拒绝；
   - service物理路径冲突拒绝；
   - 未声明projection source aggregate拒绝；
   - 未准入projection identity scheme拒绝；
   - 合法API抑制：完整50路径、DSL/routes不存在、localDeps闭合、non-runnable、applied=false、无目标写入。

承接52项不是重新执行52项。实际候选执行计数为58＝10＋原43＋新5；原43中有1项错误oracle失败，必须保留。不能称为“57次全新单轮全绿”，不能把原47项补充轮的exit2/BLOCKED改为COMPLETE。

原Saga负例要求的owner诊断与其未声明command输入不符。新的未知引用oracle依据独立冻结Scala及resolver合同裁定，不是接受任意拒绝或从actual反填expected。原Scala不要求phase-command owner等于participant所交互聚合，本轮不新增该限制。

## 保护与运行边界

615份源码/runtime、261份资产、118个源码目录及承接证据的完整pin、目录identity/member在新窗口消费前后复核。每个既有pin.bytes是读取硬上限，零字节及binary同样核对；receipt/metadata 8 MiB、logs 16 MiB、report 64 MiB，不截断。

公开CLI使用物理Node22.23.4与Darwin单层deny-network Seatbelt，仅可写本run的actual/runtime。SOURCE-only routes及历史证据不授予child正文读取权限。每次调用须真实positive PID、完整receipt/stdout/stderr、closed/reaped/group empty、无timeout/signal/output截断；预期拒绝的exit2/rawPassed=false原样保留。

新5项窗口固定15分钟，每项cap30秒，不刷新旧窗口、不retry、不扩矩阵、不新增生成器guard。本轮无JVM、tests/typecheck、私有产品import-and-call、业务服务或容器执行。

## 不在本结论内

产品仍为 `classic-scaffold-only`、`runnable: false`。原raw占位、类型/算法缺陷不因字节一致而修复；本结论不证明Scala编译、type closure、ABI、Plain FP/OO优秀质量、ScalaCheck、复杂度、金融或业务runtime、银行消费通过。

剩余8族保留独立curated金样路线：`aggregate-rules-formal`、`external-connector-port`、`connector-implementation`、`projection-apply-event`、`aggregate-state-controller`、`strict-saga-module`、`strict-fixture-host`、`composition-invocation-host`。一次一族先完整手写Scala与真正ScalaCheck性质规格，向用户讲解并获得具体版本认可后，才实施相应JS。curated不回填旧raw oracle缺口；`all31Closed=false`。

策略注释 `policy-template`、另一链 `semantic-products-route` 和复制资产 `static-scaffold` 不计生成族。
