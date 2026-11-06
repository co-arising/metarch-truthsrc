# 你的第一个 Counter：生成一次，再修改一次

本教程只用一个自有项目 `counter-lab`。先按 [README 的安装步骤](README.md#install-the-local-cli)
安装 `truthsrc`，准备 Node **>=22.13.0**（22.13.0和22.23.4均已做本地安装与Counter闭环实测）。
不需要 Java、银行材料、数据库服务或知识服务器。

目标是亲自回答三个问题：**我编辑哪里？代码在哪里？怎样查回真实来源？**
Node-only 练习不证明 Scala 已编译或业务已执行。

## 第一步：第一次生成与互查

**工作目录：** 你自己的练习区父目录。`counter-lab` 必须不存在。

```bash
truthsrc init counter-lab --format human
cd counter-lab
truthsrc generate-project --project truthsrc.project.json --out generated --plan --format human
truthsrc generate-project --project truthsrc.project.json --out generated --format human
truthsrc status-project --project truthsrc.project.json --out generated --format human
truthsrc query-project --project truthsrc.project.json --out generated --knowledge SetCount --format human
```

### 观察结果

- `init` 已运行 validate 和 roundtrip，但不生成代码。
- 预览只显示计划项/路径摘要，不写 `generated` 或项目知识库；不是文本 diff。
- 实际生成创建代码、派生证据和项目旁 `.truthsrc/knowledge.sqlite`。
- 状态应显示 `inputs=current`、`evidence=verified`、`synchronized=true`。
  它们只描述当前来源与文件，不是运行认证。
- 正查能看到真实作者文件、知识身份和代码位置。请求级 `precision=file` 不否定其中
  某个位置的已验证 span；两者是不同层级。没有命中精确行时不能把候选当唯一来源。

打开这些文件对照：

| 文件/位置 | 作用 |
|---|---|
| `truth/example/contexts/example/aggregates/counter/aggregate.yaml` | 你编辑的聚合与初始状态 |
| `truth/example/contexts/example/aggregates/counter/slices/set-count.slice.yaml` | `SetCount`、guard、`CountSet` 和 fold |
| 正查返回的 `locations[].file`，相对于 `generated/` | 实际生成的代码 |
| `truthsrc.project.json` | 显式项目/生成器配置，不是另一份业务模型 |

不要编辑 canonical、完整 request、compiled、ledger、anchors 或 SQLite。

### 从实际源码行反查

`span.start/end` 是半开 **UTF-8 字节偏移**，不是行号；`next0` 也不是永久知识身份。
下面这个小脚本从刚生成的真实 span 计算行号，再调用同一个公开 CLI 反查。
仍在 `counter-lab` 执行，不需要安装任何库：

```bash
node --input-type=module <<'NODE'
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const base = ['--project', 'truthsrc.project.json', '--out', 'generated'];
const forward = JSON.parse(execFileSync('truthsrc', [
  'query-project', ...base, '--knowledge', 'SetCount', '--format', 'json',
], { encoding: 'utf8' }));
const location = forward.result.flatMap(row => row.locations).find(loc =>
  loc.file.endsWith('CounterRules.scala') && loc.verification.spanVerified &&
  loc.freshness === 'current-bytes' && loc.span.text.startsWith('  def SetCount('));
if (!location) throw new Error('没有当前已核验的 SetCount span；先检查 status，不猜行号。');
const bytes = readFileSync(join('generated', location.file));
const line = bytes.subarray(0, location.span.start).toString('utf8').split('\n').length;
console.log(`实际代码位置：${location.file}:${line}`);
process.stdout.write(execFileSync('truthsrc', [
  'query-project', ...base, '--file', location.file, '--line', String(line), '--format', 'human',
], { encoding: 'utf8' }));
NODE
```

成功时反查是 `state=mapped`、`precision=span`，来源包含 `SetCount` 的真实声明。
同一行可能同时属于方法和其内规则，span 精确不等于只能有一个知识身份。

### 看一张本地图

```bash
truthsrc verify-project --project truthsrc.project.json --out generated --format human
truthsrc view-project --project truthsrc.project.json --out generated --html counter-map.html --knowledge SetCount --format human
```

`verify-project` 的 `passed=true` 只表示该输入/代码快照的回锚门通过。
在浏览器打开输出的 `counter-map.html`。它是内嵌内容的只读静态快照，不启动服务；
不会在你修改磁盘后自动更新，也不会将未执行的代码/服务验收显示为通过。
HTML 目标必须不存在；不用同一文件名覆盖旧导出。

**失败时安全恢复：** init 目标已存在就换一个不存在的自有目录，不删除原目录。
如果生成失败，先看完整错误与输出目录；晚期写入失败可能留下部分新文件。
检查配置/作者语法和所有权，保留冲突，不能通过手改 ledger、删除 generated 或强制覆盖消红。
查询/验证/导出不会替你重建缺失的图；确认来源与所有权后再显式预览生成。

## 第二步：改一次，看到过期，再恢复一致

**前置：** 第一步完成；仍在自己的 `counter-lab`，不是工具 scaffold 或银行工作区。

在编辑器打开：

```text
truth/example/contexts/example/aggregates/counter/aggregate.yaml
```

仅把 count 字段的 `"default": "0"` 改成 `"default": "2"`。
这是 Counter 的初始值变化，不是银行资金规则变化。

```bash
truthsrc status-project --project truthsrc.project.json --out generated --format human
truthsrc generate-project --project truthsrc.project.json --out generated --update --plan --format human
truthsrc generate-project --project truthsrc.project.json --out generated --update --format human
truthsrc status-project --project truthsrc.project.json --out generated --format human
truthsrc query-project --project truthsrc.project.json --out generated --knowledge SetCount --format human
truthsrc verify-project --project truthsrc.project.json --out generated --format human
truthsrc view-project --project truthsrc.project.json --out generated --html counter-map-updated.html --knowledge SetCount --format human
```

### 怎样确认真的发生了变化

1. 第一次 status 显示 `inputs=changed`、`synchronized=false`。代码可能仍为 `unchanged`，
   因为它还是上次生成的字节；**输入变了**和**生成文件被手改了**是两回事。
2. `--update --plan` 显示实际更新动作。human 摘要省略源码正文，JSON 保留完整计划。
   它不写代码，也不是文本 diff。
3. update 后状态恢复 `current/verified/true`。在生成的 Counter 初始状态代码中确认值为 2，
   再执行第一步的实际行号反查脚本，不能沿用猜测的固定行号。
4. 打开新的 HTML；旧 `counter-map.html` 保持旧快照，不自动变成新结果。
5. 再运行一次相同的 `generate-project --update --format human`，未改输入应显示
   `written=0`。这证明幂等生成，不证明 Scala 运行结果。

更新只替换同一项目/生成器拥有且基线未被篡改的生成文件；合法 MANUAL 块会保留，
但当前 producer 不因此自动产生手写区。范围外/不再生成的旧文件会明确保留，不自动删除。

**发生冲突怎么办：** 先保存自己的差异到一个新的 patch，确认应修改作者输入还是合法
手写区。保留冲突目录，使用新自有候选验证改法；不修改证据来伪造所有权。
非法作者语法则修复编辑的 YAML，再重新预览。没有并发锁或跨文件回滚，不能同时生成同一目录。

## 你现在可以继续什么

- 用 [AUTHORING.md](AUTHORING.md) 理解系统/上下文、身份、结构共享和真实来源 pointer。
- 用 [PROJECT.md](PROJECT.md) 查阅 JSON、人读输出、精度、只读边界和更新合同；
  `truthsrc help <command>` 可以单独查看参数。
- 自定义生成器、手写协作和进一步产品能力见 [CODEGEN.md](CODEGEN.md)。普通 `generate`
  不是 `generate-project` 的别名。
- [银行业务与材料入口](README.md#接下来银行与进阶) 单独说明付款、TA、退款、定投和冻结供给。
  Counter 的成功不会替代银行代码、服务或真人可用性验收。
