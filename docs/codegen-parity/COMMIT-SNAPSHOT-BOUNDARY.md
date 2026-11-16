# 提交与来源快照边界

本目录包含本轮调查、规格、固定源码与人工参考的证据，不是可运行Scala工程，也不是生产业务真源。实际代码验收状态以[F1实施收口](F1-IMPLEMENTATION-CLOSEOUT.md)为准。

## 不纳入版本控制的资料

- 仓根`.rounds/`：本机独占源码副本、构建缓存、JVM类、原始运行日志、进程/租约回执和负对照目录。其字节与退出码是本轮本机审计证据，不递归打包进提交。
- 本目录内`.rounds/`：误落的common消费核对原件保留在本机、不提交；[稳定JSON副本](details/common-core-021-pins.json)只保存制品指纹和公开接口核对信息，不含JAR/POM本体。
- 含疑似凭据或高熵配置secret的来源快照不纳入提交，不读取或复制其值。原工作区与已登记基线指纹保持不变；精确排除路径如下，亦由仓根`.gitignore`保护：
  - `baseline/js/generators/scaffold-static/application.conf`：已知高熵配置secret，不读取、不提交。
  - `baseline/js/generators/scala-cqrs-application/render-host-verification.mjs`：敏感引用未充分确认，保守排除。
  - 排除项的来源SHA/bytes与判断边界见[commit-snapshot-exclusions.json](details/commit-snapshot-exclusions.json)，只登记指纹，不保存命中值。

来源索引记录的“已在本机固定”不等于“每份快照都随Git提交”。被排除的原件只能在获准的本机审计环境读取；新clone若缺这类字节，必须明确BLOCKED，不从索引哈希推测内容，也不能用占位文件替代后称逐字节一致。

## 可复用的验收资产

`test/fixtures/classic-cqrs-f1/`与`test/reference/classic-cqrs-f1/`保存完整、无运行依赖的F1输入/四件raw金样及相对request/scope，实际公开CLI已复验。它们只承诺四件完整文件切片的字节回归，不承诺全部108文件生成工程或所有42族。

本目录中指向仓根`.rounds/`的链接是**本机证据位置**。提交只使规格、源码实现和可复用资产可取回，不把这类路径包装为portable运行回执。后续新候选仍需独立取证，不能迁签旧PASS。
