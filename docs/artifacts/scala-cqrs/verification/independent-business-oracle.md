# 独立业务验收与恢复Oracle

类别：`independent-business-oracle`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

规定资金守恒、交易终态、恢复与权限的独立预期，不随新生成结果自适应改变。

## 输入与人工信息

由用户认可业务合同、反例和可信外部账本决定；金融预期不得从待验实现反推。

## 生产与所有权

- `bank-p23`：固定的业务 oracle suite 与恢复 main 是银行手写/冻结验证资产，不是生成器产物、生成证明或生成器 golden master。
- 源码可用只表示具备检查资产。真正执行、失败服务记录和跨 JVM 恢复证据另行保留，不能由存在断言文件升级为业务通过。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

test/scala固定suite/HTTP/恢复mains，恢复场景参数与生产源分离；一个测试文件可能验证多类artifact。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

显式挂载到新候选，actor/testkit、JDBC、HTTP/browser、跨JVM各自证据，不相加冒唯一覆盖。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

固定正负场景、新数据库重放、ACK丢失和重复副作用；不能加timeout/删assert/换jar消红。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。

### 第二批独立模块候选

`scala-cqrs-modular-candidate-v1`新增独立Parcel参考及纯目标合同，属于reference-only，不是现役生成入口。Independent pure-capacity, injected-flow and real-root-binding expectations; not bank or final architecture approval. 结构、兼容差异及资格见[目标合同](../TARGET-PROFILES.md)；真实编译/行为结果单独记录，不把参考升级为生成器或最终金样。
