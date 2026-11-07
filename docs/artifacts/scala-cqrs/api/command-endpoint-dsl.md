# 命令端点组合DSL

类别：`command-endpoint-dsl`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

复用解码、授权、寻址、发送及回复映射的HTTP机械流程；不隐藏业务决策。

## 输入与人工信息

显式Protocol签名、身份解析、codec、权限和错误映射；不能用模糊词干匹配猜参数。

## 生产与所有权

- `bc-single`：BC Scala `CommandDslTemplate` 提供首轮结构；BC Node 的 `gen_api_controllers/index.mjs` 负责 API 后处理。`gen_api_layer.mjs` 只是兼容入口，不是最终模板/写入实现。
- `bc-multi`：同属 BC 生产链；API 签名扫描多拼了 `app/`，不能据模块开关认定接线完成。
- `js-formal`：`renderService` 生成 Endpoint/invoke/action 机制，由 `applyEntries` 写入；不生成独立 `CommandDsl.scala`，也不承诺旧 DSL ABI。
- `bc-semantic-products`：独立 Scala `ProductServiceTemplate` 生成对应服务端点装配，不是原生 JS 或 classic CommandDsl 的别名。
- `js-legacy`：保留 `api-dsl` 的端点代码；`js-retired`：退役 `scala-cqrs-es-api` 的旧 CommandDsl；`js-legacy-scaffold`：静态支持源码复制。三者均不能记为原生服务 producer。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

infrastructure/api/CommandDsl及Endpoint组合器，root/glue消费。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

将生成骨架和手写业务adapter分离；调用链仍保留可测试的端口边界和准确错误分类。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

解码/授权失败不发命令、同ID冲突、ask超时与实际回复映射。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。

### 类别依赖

`application-protocol`、`http-dto`、`authorization-policy`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
