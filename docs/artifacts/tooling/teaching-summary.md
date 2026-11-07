# 普通generator教学摘要

类别：`teaching-summary`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

演示第三方generator的最小确定性接口，产生摘要而非银行服务。

## 输入与人工信息

聚合/字段等输入来自canonical，缺语义不补业务逻辑。

## 生产与所有权

`js-ordinary`是reference生命周期的教学producer：`generators/_template/generate.mjs`读取canonical并返回`aggregates/<name>.md`的`summary` entries数组，由核心writer写入。其实现是手写样例，输出责任是`derive-evidence`，不是应用`generate-code`，也不使用`ctx.emit`接口。

示例可实现最小合同而不产生可运行应用；新增第三方kind仍须声明，不能借此绕过正式产品准入。具体profile和证据级别见[CAPABILITY-MATRIX.md](../CAPABILITY-MATRIX.md)，教学输出不代表银行交付或最终模板批准。

## 结构与命名

_template/generate(ctx)返回summary entries，外部generator可按同合同定义自己的kind。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

公共writer负责路径和锚，摘要producer不自行写应用文件，不变成正式语义产品替代。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

两次计划一致、manifest/kind、路径安全与受控update；教学成功不等完整银行交付。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

`js-ordinary`保持reference教学定位，不能把样例implemented推广到formal服务、P23或R2。测试源码不等执行证据；摘要一致性不授予最终模板批准。

- `js:generators/_template/generate.mjs` — `generate`。
- `js:src/core/generate.mjs` — `plan`、`applyEntries`。

来源revision、摘要及处置见[sources.lock.json](../sources.lock.json)；本页摘录不是生产认证。
