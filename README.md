# truthsrc

**把业务规则写在真源里，生成代码，并查清代码来自哪里。**

文件是唯一作者入口；本地知识图和生成代码都可以从它重建。先用一个 Counter
完成「编辑 → 生成 → 查回来源」，再学习系统、上下文和银行业务，不必先理解所有产品协议。

**推荐入口：[完成你的第一个 Counter](TUTORIAL.md)**。需要 Node、npm 和完整工具；
第一次练习不需要 Java、数据库服务、银行材料或独立知识服务。

```text
真实作者文件 → 编译、校验 → 本地知识图导出的 AST → 生成代码
     ↑                                        ↓
     └──────── 同图查询来源与最终代码 span ────────┘
```

## 代码产物与架构说明

[统一 artifactType 目录](docs/artifacts/README.md)解释每类内容的输入、生成/手写/运行库归属、结构、装配和验证。[Scala CQRS 专册](docs/artifacts/scala-cqrs/README.md)覆盖 BC 的 Scala 与 JS 最终产物、多模块 port/binding，以及 Saga/Monarch 的版本差异；[构建顺序](docs/artifacts/scala-cqrs/BUILD-ORDER.md)区分公共工具加工与仍需人提供的信息。目录随本地包分发，不把文档覆盖称为银行服务或 R2 消费通过。

[可选验证工具](docs/artifacts/tooling/verification-runner.md)提供文件取证/清单、协作租约、串行构建/独立验证/只读报告，以及受限进程、工作线程和工具归属API。[独立Catalog示例](scaffold/verification-project/README.md)把输入、builder、独立oracle与配置分开，消费安装后的公共闭环，不复制银行脚本。进程执行目前限定Darwin Seatbelt，基础source CLI不新增JDK/Docker要求。银行的实际输入、人工实现、目录与工具来源见[构建配方](../bank-wealth-demo/docs/BUILD-RECIPE.md)（该链接需要相邻银行源码）。

## Install the local CLI

### 环境与版本边界

- CLI 运行门槛为 **Node >=22.13.0**，使用无需启动 flag 的内置 `node:sqlite`，
  没有第三方 npm 运行依赖。先执行 `node --version` 和 `npm --version`。
- 已分别在 **22.13.0 与22.23.4** 实测CLI、Counter生成/更新、回锚与图导出；22.13.0定向16项通过，包含脱离源码目录的本地tarball离线安装。最低版本包从Node官方HTTPS取得并与官方SHA清单核对。
- 完整银行工具链另有平台和冻结供给要求，不能从 Counter 成功推断银行可运行。
- `truthsrc --help`、`truthsrc --version`、`truthsrc init --help` 不加载 SQLite，
  也不创建项目。旧 Node 执行业务命令会先显示升级提示。

以下二选一，只安装到自己选择的独立 prefix。示例面向 POSIX shell；替换
`/absolute/path/...` 为你实际取得的文件/源码路径。安装之前需已有 Node/npm 和完整包，
`--offline` 不代表能在没有软件的新机器凭空安装。

### A. 已取得完整本地 tgz（工具使用者）

当前不提供本轮的新 npm registry 发布或虚构的 Release 下载地址。拿到经确认的
本地包后执行；包内版本当前仍为 `0.5.0`，同一版本号不证明内容或远端发布状态相同。

```bash
PACKAGE="/absolute/path/to/madpolaris-truthsrc-0.5.0.tgz"
PREFIX="$HOME/.local/truthsrc-cli"
npm install --prefix "$PREFIX" --offline --ignore-scripts --no-audit --no-fund "$PACKAGE"
export PATH="$PREFIX/node_modules/.bin:$PATH"
truthsrc --version
truthsrc init --help
```

成功时显示包内版本与 init 用法。tarball 安装不依赖原源码目录继续存在。
如果找不到包或命令，先核对 `PACKAGE`、prefix 和 `PATH`，不要改全局 npm 配置或
使用管理员权限重试。包包含 `bin/lib/src/schema/generators/scaffold/mcp` 等运行资产，
不包含银行运行 JAR、工作数据库、凭据或历史构建缓存。

### B. 从正确源码分支安装（贡献者）

已有本地源码时，直接设置 `TOOL`；需要获取源码时，工作目录是你自己的工作区父目录：

```bash
git clone --branch execution-compiler-v1 https://github.com/zhongdj/metarch-truthsrc.git
cd metarch-truthsrc
TOOL="$(pwd -P)"
git branch --show-current
git rev-parse HEAD
```

需要具备仓库访问权限。已有 SSH 权限者可用
`git@github.com:zhongdj/metarch-truthsrc.git`；不要跳过主机校验。不使用浅克隆，
不假定 `main` 或远端分支已经包含当前新人实现。**本地提交与远端发布分开**；
交付时必须核对维护者实际给出的源码/包和配套提交，而非只看版本号或假定本地提交已经推送。

```bash
PREFIX="$HOME/.local/truthsrc-source-cli"
npm install --prefix "$PREFIX" --offline --ignore-scripts --no-audit --no-fund "$TOOL"
export PATH="$PREFIX/node_modules/.bin:$PATH"
truthsrc --version
truthsrc init --help
```

目录安装可能使用软链接，所以要保留源码。要制作可离开源码目录的本地包，
在该源码根执行以下命令，再按 A 安装输出的 **tgz 文件**，不是安装打包目录：

```bash
PACK_DIR="$(mktemp -d)"
npm pack --offline --ignore-scripts --pack-destination "$PACK_DIR"
printf '本地包目录：%s\n' "$PACK_DIR"
```

当前包文件名是 `madpolaris-truthsrc-0.5.0.tgz`。`npm pack` 不发布 registry；
安装失败时保留诊断，核对版本和包清单，不借用另一个已安装版本冒充本次成功。

## 开始练习

安装好后，进入你自己的练习区，按 [TUTORIAL.md](TUTORIAL.md) 的两步完成：

1. 创建 `counter-lab`，预览/生成，查一条 `SetCount` 规则，再用实际文件和行号反查。
2. 把 Counter 初值从 `0` 改为 `2`，看到旧输入过期，受控更新后重新互查，并导出只读 HTML 图。

教程明确告诉你编辑哪个文件、观察哪个成功字段、失败时如何保留已有数据。
项目命令默认仍输出 JSON；教程显式使用 `--format human`，只摘要实际结果，
不把大段计划源码塞进终端。格式选择不改变生成、写入或退出码。

## 什么是真源，什么是证据

- `truth/<system>/system.yaml` 和上下文内的 YAML 是作者入口；项目配置保存显式技术绑定。
  [AUTHORING.md](AUTHORING.md) 定义语法、身份、有限结构共享及微语法。
- 编译可生成 canonical 投影。`validate` 检查结构/关系，`roundtrip` 核验受支持格式的
  编译/分解恒等；不手改 canonical、完整请求或 compiled 产品。
- 项目生成在项目旁 `.truthsrc/knowledge.sqlite` 保存完整快照，通过图导出的 AST
  生成，并将最终代码锚写回同图。外置 `anchors.json` 是核验过的交换产物，不是第二真源。
- `status-project` 分开报告输入、代码和证据。`query-project --file ... --line ...`
  在命中经验证的最终字节区间时返回 `precision: span`；没有 span 的位置和 symbol-only
  查询保留 `file` / `candidates-only`。`next0` 不是永久知识 ID 或符号解析证明。
- `verify-project` 只读核验回锚；`view-project` 只向显式不存在的新文件导出静态 HTML。
  页面不是实时磁盘监控，关系边不是运行轨迹。变化后重新校验并导出新文件。
- Node-only 成功只证明所选真源、产品、生成和来源关联，不证明 Scala 已编译、银行已运行
  或金融行为已验收。命令合同与安全更新见 [PROJECT.md](PROJECT.md)。

## 接下来：银行与进阶

银行四条业务线是现金申购付款、模拟 TA、独立退款、有限定投。先看
[银行首页](https://github.com/MadPolaris/bank-wealth-demo/blob/feature/bank-wealth-truth-preview/README.md)
和[真源教程](https://github.com/MadPolaris/bank-wealth-demo/blob/feature/bank-wealth-truth-preview/docs/TRUTH-TUTORIAL.md)。
源码仓库为 `https://github.com/MadPolaris/bank-wealth-demo.git`，功能分支是
`feature/bank-wealth-truth-preview`，访问和配套交付权限需另核对。

| 目标 | 额外前置 |
|---|---|
| Counter 练习 | 完整工具 + Node/npm，无 JVM/服务 |
| 银行真源阅读/编译 | 对应银行源码 |
| 完整银行生成与代码互查 | 银行声明的六个冻结 JAR/POM；生成时不运行 JVM |
| 银行代码/服务验收 | 银行向导规定的冻结构建供给、JDK、独占存储和运行平台 |

银行现有 wrapper 仍依赖相邻工具源码，单独安装 CLI 不会消除该约束。材料未取得就停在
相应阶段，不能拼接旧服务回执宣称完整交付。runtime retry/backoff/deadline 债务仍单列。

- [生成器合同与手写隔离](CODEGEN.md)
- [完整作者格式参考](SCHEMA.md)
- [产品协议](PRODUCTS.md)
- [兼容范围](COMPATIBILITY.md)与[当前结构兼容](COMPATIBLE-COMPOSITION.md)
- [Agent 编辑合同](AGENTS.md)：每批作者修改结束时用实际树路径执行 validate 和 roundtrip。

## 定向开发检查

工作目录为工具源码根；只运行与修改相关的 Node suite，不默认启动相邻应用或服务：

```bash
npm run test:onboarding
node --test --test-concurrency=1 test/project-init.test.mjs test/project-cli.test.mjs test/code-mappings.test.mjs
```

测试成功不替代最低 Node、独立安装、代码构建、银行服务或真人新人可用性各自的验收。
历史验收只对其捕获版本和范围有效。

## License

[MIT](LICENSE)
