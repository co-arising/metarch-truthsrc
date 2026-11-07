# 说明漂移与具名差异

日期：2026-11-07。本文记录文档纠正，不是修改应用行为的授权。已存在的代码不一致不能靠改说明变成通过。

| 旧说法或缺口 | 核到的事实 | 本目录处理 |
|---|---|---|
| Play31份或BC40份说明就是全部artifact | BC Scala、JS后处理、普通/retired emitter、多模块port、runtime公开接缝不在同一旧列表 | 从多个生产入口与实际源清单双向对账；旧文件名只是别名 |
| ArtifactRegistry是封闭类别枚举 | BC ArtifactRegistry管理已构建模型实例；另一个artifact_registry只描述fsm/关系/字段/血缘知识产物 | 不用它们作代码类别全集 |
| InvariantRule与Policy共用说明 | 前者是命令前决策，后者为事件到命令的反应 | 文档dispatch映到domain_invariant；保留独立Policy说明 |
| AggregateConverter映到saga_serializer或adapter | 领域↔PB转换与serializer路由、event/snapshot adapter职责不同 | 指向专用proto_converters说明 |
| Repository接口通用要求@ImplementedBy | 多模块kernel不能反向依赖glue/ext；root负责bind | 只在旧单模块变体描述注解，不推广为现行通则 |
| port、kernel-vo、port-binding全部或都没生成 | BC JS已发计算port/条件Bridge；应用flow port与部分binding仍为手写/补丁；kernel-vo是放置闭包 | 分别记录实际所有权/生成支持，不按名字推定 |
| di-poc五模块，proto在root，ext只依赖kernel | 当前build实际四模块，proto在glue，ext依赖kernel+glue | 以实际build/源码为当前变体，旧EP段落保留历史含义 |
| ledger路径缺失即源码缺失 | 旧app/modules、double-app、proto迁移和rolemap根放置造成路径漂移 | 显式同包根映射，保留原路径；同名不足以认定身份 |
| glue免测试 | 局部没有Test源不等于机制/事务无需验证 | 库/机制测试与应用集成仍要求真实证据 |
| 所有知识已经自动生成银行tools/手写实现 | tools由多轮工程编写，35手写是独立输入，映射仅显式关联 | 公共机制归属与开放实现单列，P1另做 |
| 所有Scala命名已规范 | `symbol()`只做词法合法性，renderer仍按ID换下划线拼后缀 | 保留实现差异，目标UpperCamel/lowerCamel在CONVENTIONS，P2另做 |
| 银行已与BC结构原样一致 | domain旧载体/facade、本地Repository、PB结构等为兼容变体 | 具名说明，不把facade存在或本地cache当sharding |
| R2库可用即JS/银行已升级 | R2公开WorkflowProgram/Operation/Resource/Inbox/Batch已存在；当前生成仍P23 | 新API说明完整，生成可用性标not-generated，禁止偷换冻结jar |
| 旧gen_function_specs说明叫FunctionContractSpec | 当前脚本实际写ContentFingerprintSpec.scala | 说明按实际输出，旧步骤标签不是类名证据 |
| 只扫描顶层32份generator manifest即可全覆盖 | generators/_deprecated还有嵌套旧入口与独立kind | 全层递归枚举并明确retired状态，不当成新项目默认 |

## 代码侧未在P0修复

- 银行P23新读库replay90秒未caught-up，完整service与人工session未通过。
- 当前Scala公开载体/方法的mixed命名及兼容跨层入口。
- 通用验证机制尚未从银行tools职责拆分回流；本目录工具只服务文档覆盖。
- BC多模块未统一原生建模的手写binding/桥及部分producer条件/硬编码。
- R2语言/语义/compiler/renderer/银行原生接线与独立验收。

这些状态写入类别的适用版本和来源，不能用新目录的零遗漏结果关闭它们。各类生成、来源、编译、运行和真人可用性是独立结论。
