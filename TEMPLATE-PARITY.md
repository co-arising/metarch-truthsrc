# 完整文件模板参照：已实现项与未闭合项

最后更新: 2026-11-06

本轮参照 `backkend-codegen` 的普通 `CodegenMain` 加 JS 最终写者链，不将
`semanticProductsFile` 的提前返回分支当成完整管线。BC只读，没有运行其生成器或修改共享应用。

## 已有能力与本轮改动

| 家族 | 当前 TOOL | 本轮处理 |
|---|---|---|
| 精确值、状态、协议、事件 | 有完整生成与类型校验 | 保留公开类型、默认值和wire，不为目录对齐改冻结协议。 |
| 有序规则与领域参数 | 原本由 `domain/*Rules.scala` 直接决策 | service profile新增 `domain/invariant/*Rules.scala` 与 `domain/invariant/params/*RuleParams.scala`；旧方法签名作为薄兼容入口，actor真实调用到分层核心。参数/规则没有第二份手写模型。 |
| 事件fold | 完整、类型化、按前状态计算 | 保持行为，每个事件分支及独立fold输出同源精确代码映射。 |
| 持久化actor、factory | 已生成EventSourcedBehavior和create入口 | 保留原应用接口、PID和外部authority边界，没有假装迁成BC sharding repository。 |
| protobuf/converters/adapters | 独立PB、固定字段和manifest | 保留现有兼容方式；BC EventPO oneof并不与这些字节等价。 |
| Saga/pipeline/host/effect/technical port | 严格合同与完整有限宿主 | 沿用当前冻结runtime，不回退旧skeleton，不重发依赖。 |
| Play服务、路由、鉴权、JSON、页面端口 | 声明端点驱动，外置Factory与页面实现 | 保留实际已声明端点，不自动公开全部聚合状态。 |
| 外置知识映射/apply/ledger | 原仅文件级 | 新增renderer同源method/guard/event/fold半开UTF-8 span；MANUAL后重定位并核最终字节，回同一知识图。无新增inline `@knowledge`。 |

## 不能标为已完成的模板家族

1. **读侧投影/Repository/DDL自动生成**：银行当前6个read-model原子明确为说明性知识；
   正式service合同的 `projections` 为空。真实逻辑仍在手写 `BankReadside.scala`、
   `BankReadsideSchema.scala`，包括namespace事务锁、PID归属、连续checkpoint、
   重复正文校验、watermark及pending/期次连接。本轮没有把这些手写行为变成新的可执行
   真源合同；不能从文档字段猜SQL并宣布生成完成。既有运行能力不等于生成家族完成。
   当前producer对非空`service.projections`明确拒绝，防止有声明而无输出的静默缺失。
2. **BC完整应用分层/装配一致性**：BC的Entity内State/Event、application Command/Reply、
   独立Behaviors、sharding Repository/Bootstrap与当前银行公开签名不同。只搬包会破坏
   35个冻结手写文件及原序列化契约。本轮只安全提取规则参数/核心，不将其它差异全部豁免。
3. **BC完整最终产物字节对照**：没有执行BC普通Scala+JS文件管线为银行生成一份独立全量oracle。
   现有formal-product golden不能替代这一门。

上述缺口需要下一次实施先固定明确的可执行读侧/装配合同及兼容迁移范围；不是“不适用”。
用户授权自主实施两仓既定功能，不被扩成随意重写冻结手写应用或金融政策。

当前无独立executionSide policy、graph/vector读侧声明，因此对应BC生成阶段没有输入；
该零输出判定不覆盖关系型读侧。未来新增这些声明时必须重新验收，不能永久豁免。

## 参照位置

- BC `tools/gen_pipeline.mjs:466–535`：Scala、rules、projection handlers、policy、API、DDL、tests/functions、provenance/apply。
- BC `knowledge_base/design_docs/field_template/tools/rules_domain_gen.mjs:2698`：规则参数真实落点。
- BC `src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/DomainEntityTemplate.scala:44`：State/Event布局。
- BC `src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateProtocolTemplate.scala:33`：Command/Reply布局。
- TOOL `generators/scala-cqrs-domain/render-domain.mjs`：有序规则、参数兼容和精确映射。
- BANK `v1/handwritten/scala/example/bankwealth/readside/`：明确保留的手写读侧。

完整最小交付不能仅凭本轮压缩、图链或actor测试通过而标为完成；以 `MINIMAL-DELIVERY.md` 及
实际验收回执分别记录这些成果和剩余差距。
