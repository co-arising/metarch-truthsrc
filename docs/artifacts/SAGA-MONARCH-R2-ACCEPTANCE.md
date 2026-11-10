# 第七批 Strict Saga / Monarch R2 有限验收

最后更新：2026-11-10。结论：新非银行入口已完成有限工程验收；不是完整 CQRS 应用、银行迁移、运行库发布或架构 owner 最终批准。

## 职责

入口为 `scala-cqrs-saga-monarch-v1`，target 为 `scala-cqrs-saga-monarch@1`。唯一库存作者树生成两资源串行 TCC、typed result port、纯/managed Run、有限 R2 batch/workflow 和组合根。生成的是应用接缝，不是 Saga/Monarch 内核。完整支持与拒绝边界见[本族合同](SAGA-MONARCH-R2.md)。

## 输入与人工信息

作者是 `scaffold/saga-monarch-project/truth/saga-monarch`，技术绑定与外置实现独立捕获。27 atoms 的 validate 与 roundtrip 双绿，八产品严格编译；不编辑 canonical/request、ledger 或 anchors。固定消费 monarch-persistence `0.3.0-dev.r2-20261106-dc168f96fa62`、monarch-core `0.2.1`、Strict Saga `0.2.1-p23.20261027.1`，制品未重建或替换。

## 生产与所有权

公共 capture → source-index → 产品 → 同图 AST → plan → writer → 回锚形成闭环。kernel/glue/ext/root 分别编译，外置代码不进入生成所有权。D11 离线安装与 prefix 移址后无 checkout fallback；当前四样本重生成与已验 installed 的源字节一致，旧安装包只比当前少文档分类变化，旧 pack fingerprint 没有改签。

## 结构与命名

typed Run 消费完整 reads/writes/outcomes，codec 保留字符串版本及语义帧；操作身份包含原 run/step/key。命名覆盖样例的四模块与18个独立行为测试通过，显式 codec/definition/wire 不变。非法类型、缺实现、冲突名称、错误资源/收据身份、unsupported deadline 等在生成前拒绝。

## 依赖与装配

R2负责durable operation、批次和资源；Strict Saga负责事务决定与补偿。冷query不激活Run；recoverRuns与resumeRuns分开受理和耐久终态。Retry耗尽明确fail/hold，成功子集不重做；资源许可不表示库存占用。build文件只有generated资格，没有执行sbt。

## 回锚与更新

最终UTF-8 spans双向定位作者和binding；作者、binding、实现变化导致stale，显式update后fresh，再生零源码写。新增外置实现保护、跨owner拒绝及未声明MANUAL块拒绝与通用writer共73项定向回归通过。兼容文档由公共工具同步BC50／Play32，未写它们的业务或生成源码。

## 验证

- 独立reference合同42个必选case已覆盖；38个正例、8项编译变异及30个保留恢复窗口分项记录。
- installed主样例18、retry8、pure4、carry2独立行为通过；当前主样例补齐28恢复窗口／84 JVM，每窗原journal前缀与第三读字节保持。
- installed补充20个正例、八项指定变异断言、serializer注册正例1／缺绑定负控2通过。丢leaf ACK及dueAt/预算的generated与installed双lane均通过。
- 完整Node一次执行：4314项，4269通过、30失败、15跳过。原失败完整保留；7个受影响suite随后在正确执行条件下178项全部通过，生产输入未变。**没有把完整FAIL重签为全绿，也没有为换包装重跑JVM。**
- 回归失败分为过时的全局“无R2生成入口”断言／纯模块依赖图夹具、手动验收入口未跳过默认Node发现，以及本轮错误外层sandbox阻止原测试本地fixture/自有sandbox。修复只更新非银行/银行分离断言、显式v2纯依赖预加载、手动入口发现门和运行器条件，未放宽产品或负控断言、未提高原超时。
- 15项既有外仓opt-in跳过不计通过。精确逐项结果、原失败hash和影响复验见[机器证据](evidence/saga-monarch-seventh-qualification.json)。
- 来源及保护：八仓3585个source检查通过；历史15955文件、2361元数据和原28条观察保持。后置本页/导航更新仅改变文档hash与coverage，不追认为早先运行输入。

## 版本与实例

catalog2.6.0登记125类、591变体、44个producer；28现役观察=12既有formal生成＋16本族分层观察。本族20变体中19项代码／装配取得同输入generated/compiled/behavior，build1项仅generated；final-approved为0。此前28观察已[保真历史化](evidence/capability-saga-monarch-prior28-history.json)；旧family1–4运行事实保留，未重放的旧指纹不称current。

注册负控首轮被运行库fallback补回、命名harness首轮从工具内scaffold capture被拒绝，以及此前D阶段真实失败均保留原时态。测试journal是固定SerializedValidationJournal，不宣称生产LevelDB/Mongo、断电/脑裂或任意输入语义。到本批有限终点停止，不自动提交、发布、第八批或银行迁移。
