# P15 批C（第 5 门第三段）：BC parity——组合面镜像到 BC 生成链

冻结：2026-10-25 · 依据：批准计划批C 段 · 前批：P13/P14（全绿未提交）

## §0 首动作已完成：BC fab 输入准入风险项勘探（差距清单定案）

BC 生成入口（CodegenMain.prepare）：`codegen.systemFile`（canonical JSON）+`codegen.systemBindings`（bindings JSON）→ **SerialCanonicalAdapter.assemble**（bounded profile 准入）；canonical 的 `sagas`/`pipelines`/`sessions` **不被 assemble 消费**——strict 执行面经独立 **AdmittedSagaInputV3** 槽（S6 先例：完整校验+精确 pins）。

**实证差距（fab bindings.json types × assemble 白名单）**：
1. ❌ `WaferSet (kind=collection)`、`ManifestRef (kind=manifest-reference)` → assemble 只认 id/text/money（"outside this gate's supported profile" 拒）——**修法**：BoundType dtype 段扩两 kind：collection → CustomType("Vector","scala.collection.immutable",Seq(element dtype))（elementType 必须 bound id/text+minItems/maxItems 正界校验）；manifest-reference → StringType（version 锚存在校验）。对齐 truthsrc P13 的 v3 可选能力面。
2. ✅ Lot stateFields dataType 全落 Map[…]/String/LotId（七字段无裸 WaferSet）——Map[K,V] 复合形态 assemble 已支持（P4 先例）。
3. ❌ fab 双 saga+组合管线 → 需构造 **AdmittedSagaInputV3 fab 输入**（准入 pins）——最大新工件；truthsrc 侧产 admitted input 的面（S6/P7 时代 v3 admitted JSON 形状）待接。
4. 模板面缺口：InvocationHostTemplate（新）+FixtureHostTemplate per-saga 化（P13 拆名的 BC 等价物）+FixtureCompositionSpec 发射。
5. scaffold：BC build.sbt 模板 monarch 双 jar 面（truthsrc lib/ unmanaged 路线已证）。

## §一 实施切分

1. **P15-1 准入链**：SerialCanonicalAdapter 扩 collection/manifest-reference（BC 侧新负例：kind 白名单外仍拒/elementType 未 bound 拒/bounds 非正拒）；AdmittedSagaInputV3 fab 双 saga 输入构造+准入测试。
2. **P15-2 模板**：InvocationHostTemplate（镜像 emit-invocation-host：IdentityObserved→Attach/journal 六事件族/镜像非权威/补偿≠阶段恢复）+FixtureHostTemplate per-saga 面+FixtureCompositionSpec（E1-E5·Mongo 截窗构造术同款——rxmongo per-batch 文档 $push/$slice）。
3. **P15-3 scaffold**：build.sbt monarch 双 jar（sha256 66223d37…/ba144dbc… 在案）+conf 面（monarch-proto serializer 随 jar reference.conf 自动注册——探针已证）。
4. **P15-4 验收**：BC fab 应用重产 E1-E5 parity（+P13 双 saga 24 parity）+BC 全量（789→N）+金样不动+三库零改动。

## §二 红线对照（继承全量）

不 commit/push/publish；不写共享 apps；金样字节恒等（BC 侧金样=ingested-app 恒等门不触——fab 是新增输入非替换）；digest 纪律（money/BC 存量钉点不动，fab 面新钉）；三库零改动；monarch jar=packageBin 取件；诚实标记保持。

## §三 状态

- §0 勘探完成（2026-10-25）；实施未开（等接续窗口）。
- 接续首动作：P15-1 SerialCanonicalAdapter 扩面（差距 1）——BC 仓 src/main/scala/net/imadz/meta/filesystem/SerialCanonicalAdapter.scala:82-98 BoundType dtype 段。
