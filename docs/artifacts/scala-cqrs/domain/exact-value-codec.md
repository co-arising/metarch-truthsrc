# 精确金额与数值编解码

类别：`exact-value-codec`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

在领域精确值、wire与持久化表示之间建立明确映射，避免Double造成金额舍入和溢出。不是业务金额上限策略。

## 输入与人工信息

作者声明单位、精度/scale、合法币种、字段绑定与codec版本；Money的正数或金额上限由规则决定，不能用precision38替代业务裁决。

## 生产与所有权

由列出的生产者/实现提供。BC的Scala结构与JS最终写入者必须一起判断；同文件后续JS覆写时，最终台账行归最后写入者。当前银行兼容profile只按实际已有产物标识，不由旧文档推定能力。

目录状态：`implemented`；所有权：`generated`。生成文件通过公共生成/更新通道维护；独立手写实现不是生成结果的可编辑副本。

## 结构与命名

AmountDecimal/Money与Wire/PO分别命名；数值通过明确的整数最小单位文本或精确十进制转换。codec名和版本与Scala类名分离。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

被参数、消息、proto converter和strict Saga receipt消费；相同领域类型不能在不同边界静默选择不同精度。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

核roundtrip、超范围/错误币种/无效数值拒绝及实际边界编码，固定金融oracle不随codec实现改写。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

适用：js-formal / bank-p23。单模块和多模块是放置/装配变体，不是两套业务事实。BANK P23兼容层与BC目标模板可能保留具名差异；没有把R2运行库能力写成当前银行生成支持。

- `js:generators/scala-cqrs-domain/naming.mjs` — `typeName`。
- `bank:truthsrc.project.json` — `exactCodecs`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。
