# artifactType对齐清单 — 实现检查点15

**42个唯一生成族key＝39传统族＋3扩展族。不是生成文件数。**

| 状态 | 族数 |
|---|---:|
| 已完成限定raw验收 | 11 |
| 已实现，待最终验收 | 23 |
| 待逐族curated金样与用户认可 | 8 |

本检查点提交不改变验收结果；剩余31仍未完整闭合，`all31Closed=false`。机器版见[artifact-type-status.json](details/artifact-type-status.json)，实现及证据边界见[CLASSIC-V5-CHECKPOINT.md](CLASSIC-V5-CHECKPOINT.md)。

## 一、已完成限定raw验收（11族）

| # | artifactType | 职责 | 接受版本 |
|---:|---|---|---|
| 1 | `value-object` | 值对象 | @2 |
| 2 | `domain-entity` | 领域实体与State/Events | @1 |
| 3 | `event-handler` | 纯事件应用 | @2 |
| 4 | `invariant-rule` | 不变量规则 | @2 |
| 6 | `aggregate-root` | 聚合根 | @3 |
| 7 | `application-protocol` | Commands/Replies协议 | @1 |
| 8 | `aggregate-factory` | 聚合工厂 | @3 |
| 9 | `aggregate-behavior` | 聚合行为 | @1 |
| 10 | `command-helper` | 命令参数与回复胶水 | @1 |
| 12 | `aggregate-repository-port` | 聚合仓储端口 | @4 |
| 22 | `aggregate-repository-implementation` | 聚合仓储实现 | @4 |

## 二、已实现并集成，待最终验收（23族）

| # | artifactType | 职责 | owner |
|---:|---|---|---|
| 5 | `domain-service` | 领域服务 | domain-rules |
| 14 | `application-service` | 应用服务 | services-connectors |
| 15 | `query-service` | 查询服务 | services-connectors |
| 16 | `saga-participant` | classic Saga参与者 | classic-saga |
| 17 | `saga-definition` | classic Saga定义 | classic-saga |
| 18 | `saga-trigger-protocol` | Saga触发协议 | classic-trigger |
| 19 | `saga-trigger-entity` | Saga交易实体 | classic-trigger |
| 20 | `saga-trigger-root` | Saga触发根/Transactor | classic-trigger |
| 21 | `saga-trigger-behaviors` | Saga触发Behaviors | classic-trigger |
| 23 | `projection-repository-port` | 投影仓储端口 | projection-repositories |
| 24 | `projection-repository-implementation` | 投影仓储实现 | projection-repositories |
| 27 | `projection` | 投影运行装配 | projection-execution |
| 28 | `projection-handler` | 投影事件处理 | projection-execution |
| 29 | `protobuf-schema` | aggregate/shared Proto schema | serialization |
| 30 | `proto-converter` | Proto转换器 | serialization |
| 31 | `event-adapter` | 事件序列化适配 | serialization |
| 32 | `snapshot-adapter` | 快照序列化适配 | serialization |
| 33 | `saga-context` | classic Saga上下文 | classic-saga |
| 35 | `http-controller` | HTTP控制器 | api |
| 36 | `command-endpoint-dsl` | 命令端点DSL | api |
| 37 | `route-definition` | 完整routes文件与writer | api |
| 38 | `bootstrap` | 组件启动（四变体仍一族） | bootstrap |
| 39 | `application-bootstrap` | 全局应用启动 | bootstrap |

## 三、待逐族Scala金样，用户认可后才JS（8族）

| # | artifactType | 职责 | owner |
|---:|---|---|---|
| 11 | `aggregate-rules-formal` | formal聚合规则 | domain-rules |
| 13 | `external-connector-port` | 外部连接器端口 | services-connectors |
| 25 | `connector-implementation` | 外部连接器实现 | services-connectors |
| 26 | `projection-apply-event` | 条件性ApplyEvent | projection-execution |
| 34 | `aggregate-state-controller` | 聚合状态查询控制器 | api |
| 40 | `strict-saga-module` | 严格Saga模块 | strict-module |
| 41 | `strict-fixture-host` | 严格fixture生产/测试宿主 | strict-fixture |
| 42 | `composition-invocation-host` | 组合调用宿主 | composition |

## 真实观察与下一步

- 当前@5 core已真实exit0；baseline/timestamp-int的A→expected、B→expected、A↔B共六次完整比较全部52/52equal。每input49Scala＋2proto＋完整routes，actual另有ledger/anchors两个control。独立实际审计通过。
- 固定补充原轮43actual／42accepted／1failed／4unexecuted，独立只认证42项事实；原47未COMPLETE。失败Saga负例引用未知命令却期待不适用的owner诊断，原失败保留。
- 原Scala及已读合同不要求phase-command owner等于participant aggregate；不添加raw限制。已批准新5精确观察：未知命令拒绝＋最后4项，不重跑57、不刷新旧clock。
- 5项新预算及run尚不存在，适配器和起钟脚本fix14独立复审均已通过；**52项已有完整接受证据，但最后5项尚未执行，23族全部仍待综合最终验收**。
- 8族不再等待批量旧oracle开工：按表中库存顺序一次一族，先完整Plain FP+OO手写Scala＋真正ScalaCheck性质规格，向用户讲解并获得具体版本认可，才做对应JS。原八族raw expected缺口仍记OPEN，不用curated替代raw来源。

## 范围限制

原`???`、CommandFamily错误、重复imports及算法/类型缺陷保留；raw一致不等编译、类型闭包、ABI、OO/FP质量、ScalaCheck执行、复杂度或金融业务runtime通过。策略注释`policy-template`、另一链`semantic-products-route`、复制资产`static-scaffold`不充族数。历史catalog与旧接受回执不覆写。
