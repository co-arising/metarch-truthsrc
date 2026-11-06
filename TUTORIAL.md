# 从一条命令到生成文件，再查回真源

本教程只用本地 Node ≥22.5，不需要服务端发号、独立知识图服务或 BC 服务。
项目生成内置SQLite单文件知识仓库，通过图导出的AST生成，并将代码映射回同图。
支持的method/guard/fold位置按最终UTF-8字节验证；文本生成不等于应用运行成功。
本地CLI安装见 [README](README.md#install-the-local-cli)。

## 1. 唯一编辑入口

在工具仓执行，`../my-workshop` 必须不存在：

```bash
TOOL="$PWD/bin/truthsrc.js"
node "$TOOL" init ../my-workshop
PROJECT="$(cd ../my-workshop && pwd)/truthsrc.project.json"
OUT="$(cd ../my-workshop && pwd)/generated"
node "$TOOL" validate --tree ../my-workshop/truth/example
node "$TOOL" roundtrip --tree ../my-workshop/truth/example
node "$TOOL" compile-project --project "$PROJECT"
node "$TOOL" generate-project --project "$PROJECT" --out "$OUT" --plan
node "$TOOL" generate-project --project "$PROJECT" --out "$OUT"
```

编辑 `truth/example/contexts/example/aggregates/counter/`：
`aggregate.yaml` 声明标识与初始状态；`slices/set-count.slice.yaml` 声明
`SetCount` 命令、guard、`CountSet` 事件及 fold。系统和上下文声明解释
所有权，不是额外领域规则。不要编辑 `.truthsrc/canonical.json`、完整
request 或 compiled，它们可从作者输入重新生成。

## 2. 正向与反向查找

```bash
node "$TOOL" query-project --project "$PROJECT" --out "$OUT" --knowledge SetCount
node "$TOOL" query-project --project "$PROJECT" --out "$OUT" \
  --knowledge knowledge:example/example/fold/Counter/CountSet/count
node "$TOOL" query-project --project "$PROJECT" --out "$OUT" \
  --file app/example/domain/domain/CounterEventHandler.scala --symbol next0
node "$TOOL" status-project --project "$PROJECT" --out "$OUT"
```

反向命令的文件名以第一条输出中的实际 `locations[].file` 为准；不同
输出 profile 不共用猜测文件名。结果中的 `origins` 同时带真源文件、原子
对象 pointer、canonical pointer 和快照摘要。`current` 说明当前来源是否
仍相同。新增但尚未生成的知识出现在 `currentSelection`，状态为
`not-generated`，不套用旧快照中同位置的来源。`next0` 是生成局部位置，
不是永久知识 ID；符号查询明确返回
`candidates-only`，不能把整个文件的知识集合说成某一行的唯一来源。

从返回位置的 `span.start` 对应代码行使用 `--file ... --line <行号>`，会得到
已核最终字节的 `precision: span`。相邻fold分别关联自己的知识身份；没有可验证
span时仍返回候选。项目旁 `.truthsrc/knowledge.sqlite` 保存完整知识快照和回锚；
不要手改它，缺库/过期或不完整会明确诊断。生成/受控update是重建派生图的显式入口。

## 3. 做一次真实知识变更

将 Counter `aggregate.yaml` 中 count 的 `"default": "0"` 改为
`"default": "2"`。这是非银行教学模型的初始值变化，不是银行资金政策修改。

```bash
node "$TOOL" status-project --project "$PROJECT" --out "$OUT"
node "$TOOL" generate-project --project "$PROJECT" --out "$OUT" --update --plan
node "$TOOL" generate-project --project "$PROJECT" --out "$OUT" --update
node "$TOOL" status-project --project "$PROJECT" --out "$OUT"
```

第一次状态应为 inputs changed，而原文件可能仍与上次生成字节一致；这
两件事分开报告。预览列出实际 ADD/COVER/MERGE/IDENTICAL 和保留文件。
更新只允许同项目/生成器/类别上次成功拥有的文件，未修改部分才可替换。
直接手改生成方法后再 update 会拒绝，不提供 `--force` 绕过。

## 4. 手写与两个 agent 协作

将手写代码放在独立 `handwritten/`，以生成接口为边界。一个 agent 可实现
输入适配，另一个实现结果呈现；不要同时生成同一目录。领域决定仍在
slice，agent 不在适配层重新定义它。核心有 MANUAL 区块的旧模板也支持
保留合法块，但当前正式 producer 并不因此自动产生 MANUAL 区。
`test/teaching-loop.test.mjs` 集成两个独立agent完成的
`example/handwritten-collaboration/{request,presenter}.mjs`，从实际Counter
编译产品生成接口，改知识后再次生成并使用，确认两个手写模块字节不变。
核心 update 反例验证区外编辑和孤儿块拒绝。

## 5. 普通自定义生成器

```bash
node "$TOOL" init-generator ../my-generator
node "$TOOL" generate --in "$OUT/.truthsrc/canonical.json" \
  --generator ../my-generator --out ../my-generator-output --plan
node "$TOOL" generate --in "$OUT/.truthsrc/canonical.json" \
  --generator ../my-generator --out ../my-generator-output
```

这会生成每个聚合的 Markdown 摘要。普通 `generate()` 插件和正式
`generate-products` producer 登记是不同合同；不能把目录名写进 project
配置就获得正式产品能力。自定义输出可显式填写 `knowledgeIds`；核心只
认证实际文件字节，不猜源码行。不要为了这个例子修改 shipped producer。

## 6. Agent/MCP

将 MCP 服务配置为 `node /absolute/path/bin/truthsrc.js mcp`。调用
`project_status` 或 `project_sources`，传相同的 `project` 和 `out`。
`project_sources` 再传 `knowledge` 或 `file`，二选一。这两工具只读，与 CLI
共用实现，读取生成时建立的同一知识图。其他历史图查询仍可使用，但其名称节点不
替代有快照的精确来源关系。

## 银行进阶

银行教程在 `bank-wealth-demo/docs/TRUTH-TUTORIAL.md`，当前根配置是唯一
推荐入口，旧树/V1 冻结发行只用于迁移核对和历史复演。付款、TA、独立
退款、定投都保留，不把第一条教学切片当成完整银行范围。应用构建所需
JDK/sbt、冻结依赖和存储另列前置；retry/backoff/deadline 仍 OPEN。
