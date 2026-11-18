# classic @5 反馈裁定与原始失败保留

本文件记录问题与实际观察，不独立签署23族最终通过。最终结果由 [综合接受记录](details/classic-v5-acceptance.json) 与 [实施收口](CLASSIC-V5-IMPLEMENTATION-CLOSEOUT.md) 登记。

## 1. 公开诊断码呈现

原复制producer非法输入已经被正确拒绝且未创建target，但 `generate-products` 顶层只输出message，导致要求 `PRODUCT_PRODUCER` 的公开观察失败。

最小修复在 `bin/truthsrc.js` 的该命令catch读取 `error.diagnostic.code`，输出 `[FAIL] CODE: message`。无code时原message、exit2、成功输出及其它命令不变。所有typed errors（含旧product）stderr多显示顶层code是有意的公开兼容变化，不是只猜测当前@5路径。

新补充轮两个真实复制producer观察均已独立认证：exit2、rawPassed=false、stderr包含完整 `PRODUCT_PRODUCER` 及message、无目标写入、进程闭合。更早缺码失败回执不覆盖、不迁签。

## 2. Saga负例的oracle错置

原 `supp.plan.saga-phase-command-owner` 将phase command改为从未声明的 `SupplementMissingPhaseCommand`，却要求 `CLASSIC_OWNER_MISSING`。实际公开接口先返回 `CLASSIC_REFERENCE`，符合引用解析合同。

独立冻结Scala的builder、TypeResolverDSL及SagaValidator复核没有发现“phase-command owner必须等于participant.interactsWith”的要求。`CLASSIC_OWNER_MISSING` 对应nested owner缺失，不是该等式。因此本轮不新增owner一致性guard，不以错误fixture收紧raw输入域。

新独占观察 `finish.plan.unknown-saga-command` 使用完整原技术fixture，按独立语义裁定严格要求外层 `PRODUCT_PLAN`、单个内层 `CLASSIC_REFERENCE`、完整missing-command message、document/pointer、空related、exit2、rawPassed=false、stdout空且noout。实际结果：

```text
[FAIL] PRODUCT_PLAN: [{"code":"CLASSIC_REFERENCE","message":"unresolved CommandMetadata reference: SupplementMissingPhaseCommand","source":{"document":"classic-architecture","pointer":"/system"},"related":[]}]
```

原失败仍为失败；新观察不按新的oracle反签旧观察。跨owner typed receiver设计如有需要，应另立curated质量与业务/类型理由，不在此raw修复中推导。

## 3. 最后四项的实际公开观察

| 观察 | 实际结果 |
|---|---|
| service物理路径冲突 | exit2，`CLASSIC_REPOSITORY_PATH`，message要求ownership assembly前路径唯一，stdout空、noout |
| projection source aggregate不存在 | exit2，`CLASSIC_REFERENCE`，完整message指明 `SupplementMissingAggregate`，stdout空、noout |
| projection identity scheme未准入 | exit2，`CLASSIC_PROJECTION_IDENTITY`，message指明 `supplement-unadmitted-identity`，stdout空、noout |
| 合法API抑制 | exit0，applied=false、runnable=false，完整50唯一路径，DSL/routes absent，localDeps闭合，noout |

后两项原source locator标注纠正只写在新provenance：source aggregate拒绝发生在projection builder，identity scheme拒绝发生在scheme检查，不改旧合同或回执。静态可达审查与实际执行分别记账。

## 4. 验收器耗时问题

原43个公开CLI合计132.542秒，但父验收器的证据重复扫描耗去数十分钟。此前实测进程elapsed36:19、CPU99.7%，37次CLI合114.446秒、最长3.816秒。静态分析确认历史pins/inventories重复、祖先目录重复枚举、ownedDirs增长与多次终局全scan；没有profiler数据，不给单函数CPU占比。

主代理没有及时量化此开销，并在负例及准备门反复修复时继续使用笼统“待最终验收”描述，拖慢了交付。它不是生成器本身的正常耗时。

新批准的五项薄适配器保留每次当前source/assets/input的完整核验，旧carry证据只在准入和终局完整核对，不维护供每call反复扫描的旧negative副本。不跨call缓存hash、不用mtime替代字节、不修改公共helper、不重跑57项。

新5个CLI实际elapsed为1517、2464、1217、1151、1503 ms，总7852 ms。预算起点至completion/closeout文件mtime约175535/181460 ms；这些是文件时点差，不冒充精确外层进程elapsed。外层任务真实exit0，未刷新15分钟窗口。

## 5. 不制造全绿历史

实际执行总数为58＝10core＋原43supplement＋新5。有效义务为57＝10＋已审计42＋新5，明确保留原错误oracle失败1。

原补充轮保持exit2/BLOCKED、43actual、42accepted、1failed、4unexecuted，仍没有旧completion/closeout。新5完成的是修订后新合同义务，不把原47补充轮写成COMPLETE。不从更早33项补齐，不把承接52项说成新执行。

## 6. 仍开放的质量与八族路线

所有raw头部、imports重数、LF、EOF、`???` 与原算法/类型缺陷按原字节保留。字节一致不证明Scala编译、type closure、ABI、优秀OO/Plain FP、ScalaCheck、复杂度或金融/业务runtime。

八族对应JS尚未开始。按用户要求一次一族，先独立完整Scala金样及真正ScalaCheck性质规格，讲解后等待具体版本认可，才开始该族JS；curated不填补旧八族raw oracle缺口，`all31Closed=false`。

本机 `.rounds` 中原运行/预算/审查/失败保留，不forceadd、不清理；稳定文档是可提交的事实导航，不是portable原进程回执。
