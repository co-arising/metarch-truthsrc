# 服务端口与组合合同

类别：`service-contract`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

提供typed Endpoint、Authority、Composition和Factory，使生成服务外壳与银行手写业务实现组合。

## 输入与人工信息

endpoint输入输出、implementation/version、ready与close、页面renderer能力显式声明。

## 生产与所有权

- `js-formal`：原生 `scala-cqrs-play-service@1` 的 `renderService` 生成 Endpoint/Authority/Composition/Factory 合同与 pin 检查，再经 `applyEntries` 写入。
- `bc-semantic-products`：独立 Scala `ProductServiceBuilder → ProductServiceTemplate` 生成自己的服务合同；不是 native JS 的复用或 classic BC API 的别名。
- 两条生产链均消费显式 implementation/version pin。应用提供实际 Composition、Factory、Authority 及端口行为；生成 ready/close 合同只规定义务，不证明安装实现已通过运行验收。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

当前<Name>Service对象及Factory/Composition；BankServiceService的重复后缀为既存命名债，文档不冒称规范目标。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

loader核对实际实现对象/版本，待ready后提供服务，失败清理由owner负责；不能只填声明而不注入真实对象。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

缺实现/版本漂移/ready失败/close行为、端口调用及真实源清单。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。

### 类别依赖

`http-dto`、`application-flow-port`。这些是职责依赖，不代替真实Scala import或执行顺序验证。

## 第八批有限 Play 应用入口

新增 `js-play-application-candidate-v1`，由 `scala-cqrs-play-application-v1` 提供。原先profile的缺口描述保留为对应历史，不覆盖本段的新有限入口。

- `api-dto`：Pure typed command DTOs, results, failures and keyset query carriers.

唯一作者和显式技术/外置实现bindings经过公共单writer；源码、真实编译、HTTP行为、安装与最终批准逐层记证。有限范围及不适用项见[本族合同](../PLAY-APPLICATION.md)；旧回执不重签，不表示银行或完整modular target已最终批准。
