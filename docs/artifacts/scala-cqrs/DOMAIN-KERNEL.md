# Family-1 领域 kernel 生成合同

第三批合同，目标入口 `scala-cqrs-domain-kernel-v1`，manifest 身份 `scala-cqrs-domain-kernel@1`。它消费第二批 `scala-cqrs-modular-candidate-v1` 的命名和源根约定，**不是完整四模块应用，也没有最终架构批准**。真实执行及有效能力证据以批次验收／catalog 为准；本页不是 passed 回执。

## 有限职责

- kernel：名义值（包括单份声明的 wire/PO 表示）、纯 Command/Event、显式默认 State、RuleParams、必要的纯计算接口。
- glue：精确 domain↔wire/PO 转换、protobuf schema、ScalaPB converter。
- 构建与生成测试：仅 kernel/glue，没有业务组合根、服务或运行库复制。

五项核心类别是 `value-object`、`exact-value-codec`、`domain-protocol`、`domain-state`、`rule-parameters`。计算接口、protobuf/converter、build/test 是本家族的必要依赖，不能因此宣称后续完整 port/持久化家族完成。

不生成 Actor、决定/事件 fold 方法、CommandHelpers、实现 adapter、Repository、serializer/注册、数据库、恢复流程或 root binding。没有业务实现的接口仍是明确开放接缝，不用 Any、null、抛异常占位或伪默认实现填补。

## 唯一业务来源与输入

作者树经现有 project capture、validate/roundtrip 和 canonical/source-index，导出并编译既有产品：reference-layout@1、exact-value-types@1、exact-value-codecs@1、domain-decision@4、domain-dependencies@6、domain-folds@6、domain-external-events@2。

生成器消费编译后的产品；不重复读取／猜测散文、不增加作者业务 schema，也不要求另一份手写完整 request。State 默认值、Command 参数、Event slots、host inputDependencies 和 exact 约束均来自已有准入产品。

技术 options 只有：

```js
{
  packages: [{ context: 'counter', package: 'example.counter' }],
  names: [
    // { ref: {context, kind, owner, id}, role: 'value', name: 'CompleteName' }
  ],
  protobuf: [{
    context: 'counter', package: 'example.counter.protobuf',
    messages: [
      // { ref: {context, kind, owner, id}, role: 'value'|'state'|'event', name: 'StableMessage' }
    ]
  }]
}
```

每个 context/package、每个 PB 根消息明确绑定；Scala override 是完整最终名字，不再拼技术后缀。未知、重复、未消费的选择拒绝。names 不允许字段、默认值、函数体或新类型定义。它们不构成第二个领域模型。

## 名称与类型

类型 UpperCamelCase，成员 lowerCamelCase，复用 [目标合同](TARGET-PROFILES.md) 的 acronym、关键字、Unicode 显式绑定和 portable 碰撞规则。完整符号表同时处理声明、构造、成员访问、返回类型和源路径，不做全局字符串替换。

qualified refs、声明顺序、wire/PO身份、codec id/version 不由 Scala 名字重铸。PB 根消息名显式稳定；容器消息由 PB 根及固定结构路径得到，不使用 Scala override。固定 layout 的 field 号码/presence 规则不变；**该有限 v1 不保证重排字段的跨版本 schema 兼容**。

名义类型必须声明且引用闭合，递归或未知目标能力拒绝，不回退 Any。值只定义一次，不能为模块编译复制一个 kernel/glue 版本。kernel 对 PB/框架无依赖，glue 指向 kernel。

RuleParams 每个命令包含 state、完整 command、hosts。计算接口的方法来自 host descriptor 的输入依赖顺序及结果类型，没有算法／绑定；接口编译通过不证明业务实现正确。

## 精确转换与序列化

精确值沿用已准入 precision/scale/单位和两个文本格式：fixed-decimal-text、minor-units-text。禁止二进制浮点中转和隐式舍入；数值 constructor 检查与 canonical 文本检查是不同边界，不能混为相同词法限制。

转换测试至少区分：domain↔明确 wire/PO、实际 ScalaPB message↔bytes，以及 bytes↔domain。状态往返必须使用真实 `toByteArray`／`parseFrom`，constructor、copy 或手写 PB stand-in 都不是替代。

可选、序列、map 的容器载体保留明确 presence；None、Some(None)、空集合不互相塌缩。必需子消息缺失、非法 presence、重复 map key 和非法 exact 文本拒绝。版本 pin 的语义准入不等于已实现任意线上协议版本识别。

## 最终写入与知识回查

所有 source entries 经已有完整计划和最终 writer，提供精确依赖、product footprint、ownership、source associations 和实际 UTF-8 code spans。新 generator 写新独占输出，不能使用 update 绕过旧 generator 所有权。

业务字段的 `source:<canonicalId>#<pointer>` 通过 source-index declaration/subtree 映射返回原作者字段或紧凑声明。代码行、展开知识和物理作者 excerpt 必须来自同一代生成证据。没有新增 inline `@knowledge`。

**技术配置导航限制：** 当前 inline exactCodecs/naming options 受 project 文件 hash 和编译产品证据保护，但不因此取得物理配置字段的 source navigation。转换源码回到真实领域/wire/PO声明，不伪造 `source:project` pointer。

零源码写入不等于零 ledger/graph 证据写入；plan、update 预览、实际 apply 的副作用分别说明。

## 兼容与验收口径

原九个 Scala 生成入口、原 Counter 默认项目和银行 P23 选择不变。银行 carrier/PB/PID/runtime/金融规则不随此 candidate 改名。Warehouse 和 Parcel 独立参考保留；BC mjs 不属于用户认可的金样。

每个 category × target × producer/version × sample 分别记录实际生成、编译和独立行为。reference 编译不嫁接给生成器，节点来源齐套不等整个服务通过，自动检查不授予最终批准。构建定义被直接 compiler 消费不等 sbt task 已执行。

同一生成样例的输出路径、kind、全部字节 hash、输入和工具 fingerprint 必须在生成／编译／行为回执间一致。生产工具变化使旧观察过期；创建新真实观察，保留旧回执，不重签。

后续边界仍包括完整 ports/impl/root、serializer/storage/recovery、银行新候选及完整 service、R2、retry/backoff/deadline、材料取得和真人上手。参见 [现行路线](../STATUS-AND-IMPLEMENTATION-PLAN.md)。
