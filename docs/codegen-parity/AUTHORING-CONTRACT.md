# 第一阶段 diff 编制合同

这是已批准的文档/规格交付，不是生成器修改许可。只写本目录中分配的文档和示例；不修改两仓生产源码、银行生成物、原catalog、运行数据、任务状态或Git。不执行测试、编译、生成、服务、下载、发布；不创建worktree。

## 固定资料与引用

- `scala-artifacts.json` 给出39传统模板族的编号、Model/Builder/Template准确路径和固定副本。
- `baseline/index.json` 保存每个副本的原仓相对路径、bytes、SHA-256。`baseline/bc/`是真实Scala源码；`baseline/js/`是真实JS源码；`baseline/common/`是胶水源码；`baseline/curated-scala/`是人工完成参考；`baseline/actual-js/`是银行现存输出。不能改这些基线。
- 从 `diffs/foo.diff.md` 链接基线使用 `../baseline/...`；链接生产源码必须明确它是可变工作副本，不可替代固定副本。
- 传统 `CodegenMain.runCommon` 是本次MBT/布局基准；`template/products/*` 同样有JS坏味道，不拿它做设计金样。
- 39是Template族数，不是39文件；Bootstrap四变体、shared proto及其条件单列。同一JS文件可能承载多个逻辑族，必须列split/move/replace及文件组装owner。

## 每份 `<artifact-type>.diff.md` 必填内容

### 1. 范围、状态与来源

写明artifact id、Scala调度条件、预计输出基数和路径。区分原始Scala模板生成体、人工golden、用户明确覆盖标准、JS现存输出。状态只能是 `content-specification` / `decision-required` / `missing-counterpart`，不能因为本文存在就标implemented、parity-PASS或behavior-PASS。

### 2. Scala生产链与内容

逐个列 Model/Builder/Template/共享支撑/输出。Model的全部字段、顺序、类型、默认值、依赖和子型；Builder的实际分支、推导、解析与依赖收集；Template按输出从上到下列所有construct。
必须真实阅读对应文件。较小内容直接给代码；大内容完整固定文件链接 + 按construct覆盖表，不能只说“参考链接即可”。注意Scala自身的源码字符串槽、占位/默认body、MANUAL区、FQN或旧模板例外，不能假称全纯净。

### 3. 输出construct/RHS账

包括package、import完整规则/来源/顺序、注释分组；class/trait/object/case class、嵌套companion、type alias、val/var/lazy/implicit、annotation/self-type、泛型/上下界、继承/父构造实参、主辅构造器、method/overload、curried/implicit参数、返回类型和声明顺序。
逐项给出关键RHS/方法体/默认值及副作用顺序，禁止只列签名。构造器字段顺序、named args、`replyTo`、`thenReply`读新state等必须具体。
可按模板循环概括重复成员，但必须把该循环的输入、每个生成构造的内容和分支覆盖写清；不能把一组循环当作一个未解释黑箱。

### 4. JS当前实现与明确差距

同时定位formal银行链路和可复用legacy/新family实现，具体到文件/符号/行。比较Model、Builder、Template和产物四层。存在近似renderer但formal未调用，必须写成接线/职责错配，不说完全不存在。
至少一个带上下文的`diff`代码块：minus为真实JS例/模板，plus为明确目标例/Scala结构。输入不同则标“结构性对照，非同输入字节比较”；没有对应业务实例时不编造银行行为。
用户指定的示例优先：PascalCase/lowerCamelCase、无ServiceService/HostHost、无无意义nextN、正常imports、无双重否定、Actor commands typed replyTo且Commands/Replies分组、domain events/state分离、CommandHelper三方法与runReplyingPolicy、应用根下只三层。

### 5. 胶水与实现槽

每个依赖列完整import/符号、库来源、所需方法/类型和语义；不得以lib源码存在推断所消费JAR可用。Scala已有`???`/MANUAL算法时明确未完成业务槽，不能替换为fake success；人工golden体与raw模板差异写出来，不悄悄换基准。
`replyWith`≠`replyWithAndPublish`；纯domain参数/事件不能注入ActorRef。不能把addExact改`+`、合并名义类型或扩大serializer绑定来“降复杂度”。

### 6. 明确JS实施写集合与依赖

列应改/新建的JS路径（新建路径标proposed），复用函数、调用方/生成配置/回锚迁移和旧输出如何退役。公共names/type/layout/writer/registry由集成者管；不写会与其他包冲突的生产文件。

### 7. 验收与未决项

分别要求：同等输入产物完整文件对账、construct/RHS覆盖、必要真实接口/行为验证、命名/layout/复杂度、稳定生成与回锚。当前全部未运行。给出命令形状和副作用边界，不猜不存在的spec/CLI flag。
每个未决项必须是具体内容/API/业务语义，不用泛泛的“待完善”。普通方法CC≤5目标，>10需重构或逐方法认可例外；不通过String/Any dispatcher刷分。

## 每个分组额外交付 `details/<group>.json`

```json
{
  "group": "...",
  "artifactIds": ["..."],
  "diffs": [{
    "artifactId": "...",
    "file": "diffs/...diff.md",
    "status": "content-specification",
    "scalaVariants": [{"id":"...", "condition":"...", "outputPaths":["..."]}],
    "jsSources": [{"file":"generators/...", "symbols":["..."], "lane":"formal|legacy|family", "disposition":"replace|adapt|reuse|not-wired"}],
    "writeSet": ["..."],
    "dependsOn": ["shared-layout-types", "..."],
    "glue": ["full.symbol"],
    "openDecisions": ["specific decision"],
    "extraSources": ["原仓未入基线且本次实际读到的路径"]
  }],
  "generatorsModified": false,
  "runtimeExecuted": false
}
```

不要写`README.md`、`scala-artifacts.json`、`js-partition.*`、`assignment-map.json`、`layout-and-style.md`、`glue-dependencies.md`或别组的diff。集成者负责汇总。输出语言中文（代码/标识符保持原文）。
