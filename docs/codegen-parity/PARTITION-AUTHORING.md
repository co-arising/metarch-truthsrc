# JS 逻辑制品分区编制合同

状态：第一阶段文档编制，补充 [AUTHORING-CONTRACT.md](AUTHORING-CONTRACT.md)。最后更新：2026-11-16。

## 1. 范围与所有权

只写分配的 `partition/<group>.json` 和 `partition/<group>.md`。集成者独占 `js-partition.json` / `js-partition.md` / `assignment-map.json` 等中央文件。不改原 catalog、baseline、生产源码、作者树、生成应用、ledger/anchors、其它分组。无生成/编译/测试/typecheck/服务/下载/Git操作/worktree，不再派生代理或任务。

固定输入为 `baseline/js/docs/artifacts/catalog.json`，45个producer、641条producer-output合同是导航与覆盖账，不是641个物理文件，也不是641个独立逻辑制品。必须读对应真实producer/renderer/terminal writer内容；不能复制catalog描述当源码核验。`baseline/index.json`提供源文件完整字节与SHA。需要补充未捕获源码时只读准确路径，登记路径/SHA；集成者另存补充基线，不改原852文件。

## 2. 分类单位

- 一个逻辑制品由 `producer/profile + output + role + variant + construct范围` 定位。同一物理文件可有多个A/B条目。
- A：与 `scala-artifacts.json` 中传统39族或单列3扩展有真实职责对应；实现糟糕/缺接线仍列对应差距。同一族可有不同入口的多份实现，必须全部列出。
- B：其它真实生成内容（包括生成测试、配置、证据、独立编排/宿主等）。B也有明确目标、职责、fixture和质量规则；不使用笼统“其它代码”兜底。
- 纯domain command payload不因名为Command就变Actor协议；应用Actor Request、纯参数、Event必须分别定位。必要时一个Protocol拆多个逻辑条目。
- Scala缺项由集成者统一按42族反查；不伪造JS对应，不将缺项移到B以改善覆盖数字。
- `retired/legacy/registered/current`是可调用/生命周期维度，不是A/B。保留retired源码分区，但不复活它。catalog声明、真实可调用、formal继承子producer、family候选与银行实际选择分别标记。
- `template/products/*`、Node后处理与静态scaffold不混入传统39族计数。只有同名没有同职责不构成A。

## 3. 每个分组JSON

允许为具体内容增加字段，不允许省略对应义务：

```json
{
  "schemaVersion": "codegen-parity.partition-fragment/v1",
  "group": "owned-group",
  "catalog": "baseline/js/docs/artifacts/catalog.json",
  "producerIds": ["..."],
  "sources": [{
    "file": "baseline/js/generators/.../render.mjs",
    "originalFile": "generators/.../render.mjs",
    "sha256": "...",
    "readCoverage": "full",
    "symbols": [{"name": "render", "lines": "1-42"}]
  }],
  "producers": [{
    "id": "...",
    "lifecycle": "current|legacy|retired",
    "registration": "product-profile|ordinary|legacy|retired",
    "entrypoints": [{"file": "...", "symbol": "...", "lines": "...", "callability": "...", "conditions": ["..."]}],
    "bankConsumption": {"status": "selected|inherited|not-selected|not-applicable", "evidence": ["准确路径/行与继承关系"]}
  }],
  "logicalOutputs": [{
    "id": "group/semantic-role/variant",
    "classification": "A|B",
    "scalaArtifact": "42族id或null",
    "role": "具体职责",
    "variant": "具体条件变体",
    "catalogRefs": [{"producerId": "...", "outputId": "...", "channel": "manifest|subproducer|..."}],
    "current": {
      "paths": ["真实表达式或可解释的路径模式，不照抄**"],
      "sources": [{"file": "baseline/js/...", "symbol": "...", "lines": "..."}],
      "constructs": ["文件头/import/成员/初始化/资源操作等明确范围"],
      "conditions": ["..."],
      "reachability": "入口→registry→renderer→writer",
      "sharedPhysicalOutput": "跨逻辑项的同一文件容器，或null"
    },
    "target": {
      "paths": ["目标文件模式，A参照Scala；B也给明确位置"],
      "disposition": "retain|adapt|split|move|replace|retire",
      "constructDisposition": [{"current": "成员/区间", "target": "文件/成员", "action": "...", "reason": "..."}],
      "assemblyOwner": "唯一建议owner",
      "qualityRules": ["layout-and-style的具体章节"]
    },
    "fixture": {"id": "建议的共享语义fixture id", "requiredConditions": ["变体触发条件"], "status": "specified-not-executed"},
    "dependsOn": ["shared-layout-types等实际依赖"],
    "openDecisions": ["明确接口/语义问题，不能以unknown分类兜底"]
  }],
  "catalogCoverage": [{
    "producerId": "...",
    "outputId": "...",
    "logicalIds": ["对应一或多个逻辑项"],
    "declarationStatus": "implemented|declared-unimplemented|retired-callable|derived-evidence",
    "evidence": ["准确源码行与条件"]
  }],
  "uncataloguedOutputs": [],
  "extraSources": [{"file": "原仓相对路径", "repo": "js|bc|bank|common", "sha256": "...", "reason": "..."}],
  "unresolvedCoverage": [],
  "generatorModified": false,
  "runtimeExecuted": false
}
```

`catalogCoverage`逐条保留输入组内全部producer-output id（同id若真重复须加ordinal辨别）。可复用同一逻辑项表达相同renderer在不同profile被继承，但必须精确列每个catalogRef并核profile差异，不能把版本1/2或银行覆盖路由误并。

## 4. 内容与证据纪律

1. 实际读生成器入口与renderer的完整相关内容，按每个`entry`/模板输出/复合文件成员分类。读取大文件按区间完成，不把grep命中当全内容审查。
2. 每个catalog输出必须能回指逻辑项；发现真实写出但catalog没列的，另记`uncataloguedOutputs`并同样分A/B。发现只声明未发出则给负证据，不能假装有文件。
3. 多角色物理文件拆分必须包含import、trait/companion、类型别名、方法体、初始化/资源管理，不只挑最显眼成员。不能丢B以让A形似。
4. 包规则与质量约束适用于所有Scala产物；生成测试有测试根，配置/JSON/proto/证据不是Scala业务包但仍要正确物理归属。
5. B目标内容是建议规范，不虚构用户已批准所有新接口/算法。不改变PB字段、PID、serializer、摘要、名义类型、溢出行为或独立oracle。必要语义变化明确阻断实施。
6. 银行实际消费用现存配置与真实继承链证据，不依据catalog observation绿灯或目录名字。未选family不等退役；源码可达不等运行验证。
7. 分组Markdown给出核心拆分、缺接线、基准例外、B具体目标、未决项及可读业务路径，不再复制几百行机器账。
8. 本阶段无实际同输入生成或运行；来源/覆盖的机械对账只证明文档指向和清单覆盖，不能标parity-PASS/behavior-PASS。
