// core.mjs — ported verbatim from the production gen_api_controllers/core.mjs: table-driven
// constants + identifier helpers shared by the controller builder and templates. Zero fs, zero
// Scala text assembly (decisions live in builder, text assembly in templates).

export const SCALA_KEYWORDS = new Set(['type', 'class', 'def', 'val', 'var', 'object', 'trait', 'package', 'import', 'case', 'match', 'else', 'then', 'yield', 'while', 'return', 'throw', 'new', 'extends', 'with', 'final', 'sealed', 'abstract', 'lazy', 'override', 'implicit', 'private', 'protected', 'this', 'super', 'try', 'catch', 'finally', 'for', 'do']);

/** Scala 标识符位反引号（关键字字段：`type` 等——BUG-005 约定） */
export const id = (name) => (SCALA_KEYWORDS.has(name) ? `\`${name}\`` : name);

export const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** occurredAt 统一时戳表达式（逐字对齐 CommandResults.ok 的 appendInstant(3) 格式） */
export const OCC_EXPR = 'new java.time.format.DateTimeFormatterBuilder().appendInstant(3).toFormatter.format(java.time.Instant.now())';

// ── 门档位表（D6 统一门词表·B5-L L2 改名：tier 值＝域根名＝文档用语——api.<tier> 零映射直发）──
//   'anonymous' —— 免登录：无 token 无 session，身份自证走 body（register；五步编排下沉手写 RegisterUserFlow·D3）
//   'global'    —— 仅用户态：已登录、无租户承诺（onboard/accept——命令自身产生或携带租户上下文；空 roles＝scope 兜底·D1）
//   'tenant'    —— 租户态：认证＋租户双门卫（默认档）
// GateRef 合法域 fail-fast：表值漂移即装配红（对齐 resolveIdentityStoreHook 先例——H053 生成侧实现）
export const GATE_NAMES = new Set(['anonymous', 'global', 'tenant']);
export const BOOTSTRAP_TIERS = {
  User: { RegisterUser: 'anonymous' },
  Tenant: { OnboardTenant: 'global' },
  OrganizationMember: { AcceptTenantInvitation: 'global' },
};
export const tierOf = (agg, cmdName) => {
  const tier = (BOOTSTRAP_TIERS[agg] || {})[cmdName] || 'tenant';
  if (!GATE_NAMES.has(tier)) throw new Error(`[gen_api_controllers] ${agg}.${cmdName}: 门档位 '${tier}' 不在统一门词表（anonymous|global|tenant）——H053 fail-fast`);
  return tier;
};

/** Id 边界防护参数集（IdGuard 组成输入）：路径 Id＋body Id；
 *  tenant 档 tenantId＝会话注入位排除；global 档聚合同名 tenantId＝工厂发号排除（onboard）；
 *  非 聚合同名 tenantId（accept 的 body 契约）保持入 Guard。 */
export const idRefsOf = (cmd, idp, tier, agg) => cmd.params.filter((p) => {
  if (tier === 'tenant' && p.name === 'tenantId' && p !== idp) return false;
  if (tier === 'global' && p.name === 'tenantId' && p.name.toLowerCase() === `${agg.toLowerCase()}id`) return false;
  return (p === idp && !idp.fromBody) || /^Id$/.test(p.type);
});

// 绑定名（Scala 标识符位）：关键字字段绑定名加 Param 后缀（case 模式里反引号标识符语义是「匹配既有值」
// 而非新绑定器——2026-08-26 编译实证）。
export const bindNameOf = (p) => (SCALA_KEYWORDS.has(p.name) ? `${p.name}Param` : p.name);

export const cidNameOf = (p) => `${p.name.replace(/[iI]d$/, '') || p.name}Cid`;

export const indent2 = (l) => (l.trim() === '' ? l : `  ${l}`);

/** M2：Req VO 字段类型映射（JSON 原生类型；Id/Instant 以 String 入 VO，边界由 Guard 转换） */
export const reqTypeOf = (p) => (
  // D3b（T 权威·Option 边界·EP_Mech_Key_Retirement）：Option 内型同纪律映射——
  // Option[Id]→Option[String]（ctor 逐元素 Id.of＝List[Id] 纪律 0/1 元素特例）·Option[Instant]→Option[String]。
  // 两分支须先于 /Instant/ 裸测（'Option[Instant]' 含 Instant 子串会被首分支误吃）。
  /^Option\[Id\]$/.test(p.type) ? 'Option[String]'
  : /^Option\[Instant\]$/.test(p.type) ? 'Option[String]'
  : /^Id$/.test(p.type) || /Instant/.test(p.type) ? 'String'
  // List[Id]（UUID 名单·S2-48 批3 uuid-unify 后形态）：Req 面序列化为 String 数组（List[String]），
  // 与 Id 同一序列化边界纪律（domain 内 Id·边界 String）。
  : /^List\[Id\]$/.test(p.type) ? 'List[String]'
  : p.type);
