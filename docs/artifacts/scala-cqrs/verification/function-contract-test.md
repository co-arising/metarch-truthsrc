# 函数用例与参数化合同测试

类别：`function-contract-test`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

从独立函数用例声明生成测试，检验具体输入/预期与函数合同，不把函数源码自己当oracle。

## 输入与人工信息

case输入、expected和函数签名及真实实现定位；缺预期不能生成恒真断言。

## 生产与所有权

- `bc-single` / `bc-multi`：BC Node `tools/gen_function_specs.mjs` 生成的是 `ContentFingerprintSpec`；脚本日志中的 FunctionContractSpec 不是实际文件名。multi 不因生成文件存在就获得 Test 源根接通保证。
- `js-legacy` 是旧类别的兼容参考；`js-retired` 对应确实存在的退役 `scala-cqrs-es-function-specs` producer，它从 `options.functionSpecs` 生成 Scala 测试条目。迁移说明“无替代”不等于没有历史生成代码。
- 这些输出属于生成的测试代码（generate-code），不是 derive-evidence 或测试执行回执。空 cases/缺失 `then.output` 可能没有有效断言，不能称作 oracle 覆盖。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

ContentFingerprintSpec及每case标记，测试在独立Test源目录。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

消费已存在函数与用例真源；库函数、业务函数与未实现桩分别记录，不能自动执行任意输入代码。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

正/负/边界用例、参数顺序、预期来源和实际测试执行回执。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。
