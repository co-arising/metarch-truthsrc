# 内容规格审阅勘误与实施读取顺序

最后更新：2026-11-16。状态：**静态文档勘误，不是生成器修改、业务政策批准或运行验收。**

原15份diff保持封存时字节，本页是其必须同时读取的更正。审阅原文保存在[四组内容审阅结果](details/saved-diff-content-review.json)。涉及的固定源码已由主集成定向复读；没有编译、测试或调用生成器验证。

## 1. value-object.diff.md:45：生成器转义与生成后RHS分开

[Raw Template:64–69](baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/ValueObjectTemplate.scala#L64)是Scala `s` 插值字符串；其中`\\`为字符串层转义。**生成后的Play JSON RHS是单反斜杠直接字段查找**：

```scala
(json \ "field").toOption.map(_.as[T]).getOrElse(default)
(json \ "field").as[T]
```

不是递归查找`json \\ "field"`。原稿将字符串源码转义混进输出账会改变API/语义，实施时以本页为准。此结论只是静态插值核对，不假称新生成字节或Play ABI已实测。

## 2. value-object.diff.md:55：exact必须分有单位与无单位

[render-values:11–27](baseline/js/generators/scala-cqrs-domain/render-values.mjs#L11)按descriptor决定两个分支：

| 项 | decimal（无unitMember） | unit-decimal（有unitMember） |
|---|---|---|
| 数值字段 | amountMember缺席则`value: BigDecimal` | 明确amountMember，例如`amount: BigDecimal` |
| 单位字段 | 无 | 追加声明unitMember: String |
| 构造校验 | checkedAmount；无单位Set检查 | checkedAmount＋显式单位白名单 |
| compareSameUnit | 方法仍存在，但只比较数值 | 先require单位相等，再比较 |
| plus/minus | 两个数值经checkedAmount，运算/结果再校验，只一个构造实参 | 同上，另检查/传递单位 |
| companion | 非null、UNNECESSARY scale、precision、UNLIMITED | 同样精度合同 |

银行[AmountDecimal.scala](baseline/actual-js/app/example/bankwealth/domain/values/AmountDecimal.scala)是无单位实物，不能把全部exact都概括为`amount+unit`。Money与AmountDecimal不合并，38/2是银行声明而非通用默认。

## 3. domain-entity.diff.md:45：事件superTypes是模板分支

[DomainEntityTemplate:73–79](baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/DomainEntityTemplate.scala#L73)实际消费`evt.superTypes`：空列表不发extends，非空按原序用`signature`和`with`连接。普通Builder给`Seq(familyTypeRef)`，所以普通产物继承Family；不能把这个常规输入说成Template永远忽略其它父类型或全部分支均固定Family。

## 4. domain-entity.diff.md:67：legacy empty默认值补齐

[aggregate-dsl/render:218–242](baseline/js/generators/aggregate-dsl/render.mjs#L218)只对**非首字段**求emptyDefault，optional优先返回None。其完整表：

| 类型/条件 | RHS |
|---|---|
| optional=true | `None`，先于类型分支 |
| Id | `net.imadz.common.Id.of("00000000-0000-0000-0000-000000000001")` |
| String | `""` |
| Int且字段名order | `1` |
| 其余Int（含version） | `0` |
| Long / Double / BigDecimal | `0L` / `0.0` / `BigDecimal("0")` |
| Boolean | `false` |
| List/Seq/Set/Vector | `Nil`（类型可用性仍需实际确认） |
| Map | `Map.empty` |
| Instant/未知 | `null` |

首字段直接透传；无字段时legacy `def empty=???`，与raw的省略分支不同。不能统一概括“非version数值都为0”而漏掉order:Int=1；也不把这些生成器默认值冒充业务政策。

## 5. aggregate-root.diff.md:117及所有同类验收措辞

`sbt compile`、`sbt test`仅分别描述构建/测试活动，**不是实际应用接口验证**。它们不能用来关闭typed wiring、分片寻址、持久化/回复、恢复、资源退出的运行证据义务。

本会话当前无运行许可；后续按实际选定fixture/profile取得公开CLI真实生成产物，并驱动真实应用入口观察。具体runner未定时标blocked，不造测试名/flag，也不以内部import-and-call代替。旧固定workshop例外不扩张为全仓CI。

## 6. saga-definition.diff.md:27–34：Args不是固定类型名

Raw Builder将`argsType = TypeRef(argsMeta.name,pkg)`传入模型；[Template:63–93](baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/SagaDefinitionTemplate.scala#L63)的以下位置都必须使用**同一个`argsType.name`**：

- 嵌套case class及companion名；
- `Format[ArgsType]` / `Json.format[ArgsType]`；
- `ArgsCodec.playJson[ArgsType]`；
- definition/register的`SagaDefinition[iMadzError,Context,ArgsType]`；
- runner的`SagaRunner[iMadzError,ArgsType]`。

原稿中的`Args`应理解为占位符，实施不得硬编码。人工MoneyTransfer参考实际是`TransferArgs`，与raw输入名称分别绑定，不混签。

## 7. 审阅上限与后续读取

- 原15份分四组审查；发现以上6项内容问题。序列化/投影组未报新增实质错误，但都保留了阅读范围、ABI未核、目标决策未定的限制。
- 没有“零问题即ready”的推论。所有已有未决项、source-local与jar所有权、同输入fixture/expected缺口继续存在。
- 后续实施者必须一起消费：具体diff＋本页＋[分类裁定](PARTITION-RESOLUTIONS.md)＋[共享接缝](SHARED-SEAMS.md)＋[胶水合同](glue-dependencies.md)。公共中央账应链接这些更正，不只把旧diff文件交给agent。
- 新增diff的行锚越界（将尾随换行计作额外空行）只做了引用更正，记录在[document-reference-corrections.json](details/document-reference-corrections.json)；不改任何基线字节或方法体。
