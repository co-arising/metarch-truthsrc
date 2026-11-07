# 认证授权合同与实现

类别：`authorization-policy`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

分离身份认证、租户/角色判定、CSRF与具体endpoint授权，不把声明某角色等于真实授权实现。

## 输入与人工信息

身份提供者、角色映射、token/密钥引用、有效期及操作权限是安全选择，不能生成默认放行。

## 生产与所有权

- `js-formal`：`renderService` 生成 Authority 合同和端点授权接线，不生成凭据、CSRF 或业务授权实现。
- `js-legacy`：`auth-dsl` 生成角色要求映射并消费认证库；这是较窄的代码生成，不是完整认证服务。
- `bank-p23`：`BankDemoAuthority` 是银行手写实现，拥有实际身份、凭据及 CSRF 决策。
- `di-poc`：现有 RoleGate/TokenService 是手写参考。即使位于 kernel，其源码仍依赖 Play/JWT，不能由模块名推断框架无关性。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

AuthAction/RoleGate/RoleResolver/TokenService/PasswordHashing/ApiError各有技术与纯合同部分；身份存储port另列。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

root认证adapter依赖kernel合同与外部identity实现；不把网络/driver塞进kernel。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

无凭证/错误角色/跨租户/过期token/CSRF和安全错误响应；示例认证不是生产金融认证。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。
