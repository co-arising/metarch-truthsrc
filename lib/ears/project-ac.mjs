// Projection 1 (Style E): Deterministic read-only PM-friendly plain-language AC (.md).
import { createHash } from 'node:crypto';

function formatExprCompact(expr) {
  if (!expr) return '';
  switch (expr.kind) {
    case 'var': return expr.name;
    case 'string': return `"${expr.value}"`;
    case 'number': return expr.value;
    case 'boolean': return String(expr.value);
    case 'none': return 'none';
    case 'member': return `${formatExprCompact(expr.object)}.${expr.field}`;
    case 'index': return `${formatExprCompact(expr.collection)}[${formatExprCompact(expr.index)}]`;
    case 'call': return `${expr.name}(${expr.args.map(formatExprCompact).join(', ')})`;
    case 'host': return `@host(${expr.name})`;
    case 'neg': return `-${formatExprCompact(expr.argument)}`;
    case 'arith': return `${formatExprCompact(expr.left)} ${expr.op} ${formatExprCompact(expr.right)}`;
    case 'compare': return `${formatExprCompact(expr.left)} ${expr.op} ${formatExprCompact(expr.right)}`;
    case 'not': return `not ${formatExprCompact(expr.argument)}`;
    case 'binary': return `${formatExprCompact(expr.left)} ${expr.op} ${formatExprCompact(expr.right)}`;
    case 'emptiness': return `${formatExprCompact(expr.target)} is ${expr.check}`;
    case 'in': {
      const target = formatMembershipTarget(expr.target);
      return `${formatExprCompact(expr.element)} in ${target}`;
    }
    case 'quantifier':
      return `${expr.quantifier} ${expr.variable} in ${formatExprCompact(expr.collection)} : ${formatExprCompact(expr.body)}`;
    default: return '';
  }
}

function formatMembershipTarget(target) {
  if (target.kind === 'set') return `{${target.elements.map(formatExprCompact).join(', ')}}`;
  if (target.kind === 'interval') {
    const l = target.leftInclusive ? '[' : '(';
    const r = target.rightInclusive ? ']' : ')';
    return `${l}${formatExprCompact(target.min)}..${formatExprCompact(target.max)}${r}`;
  }
  return formatExprCompact(target);
}

function buildLabelMap(spec) {
  const map = new Map();
  for (const p of spec.where) {
    map.set(p.name, p.label || p.name);
  }
  for (const ext of spec.externs) {
    map.set(ext.name, ext.label || ext.name);
  }
  return map;
}

function renderConditionNatural(expr, labelMap, lang) {
  if (!expr) return '';
  if (expr.kind === 'var' && labelMap.has(expr.name)) {
    const phrase = labelMap.get(expr.name);
    return lang === 'zh' ? `“${phrase}”` : `"${phrase}"`;
  }
  if (expr.kind === 'call' && labelMap.has(expr.name)) {
    const phrase = labelMap.get(expr.name);
    return lang === 'zh' ? `“${phrase}”` : `"${phrase}"`;
  }
  if (expr.kind === 'not') {
    const inner = renderConditionNatural(expr.argument, labelMap, lang);
    return lang === 'zh' ? `不满足${inner}` : `not (${inner})`;
  }
  if (expr.kind === 'binary') {
    const left = renderConditionNatural(expr.left, labelMap, lang);
    const right = renderConditionNatural(expr.right, labelMap, lang);
    if (lang === 'zh') return expr.op === 'and' ? `${left}且${right}` : `${left}或${right}`;
    return `${left} ${expr.op} ${right}`;
  }
  if (expr.kind === 'emptiness') {
    const target = `\`${formatExprCompact(expr.target)}\``;
    if (lang === 'zh') return expr.check === 'empty' ? `${target}为空` : `${target}非空`;
    return `${target} is ${expr.check}`;
  }
  return `\`${formatExprCompact(expr)}\``;
}

function renderActionNatural(action, lang) {
  const isProhibit = action.modality === 'SHALL_NOT';
  let verbPrefix;
  if (lang === 'zh') {
    verbPrefix = isProhibit ? '禁止' : '必须';
  } else {
    verbPrefix = isProhibit ? 'SHALL NOT ' : 'SHALL ';
  }
  switch (action.kind) {
    case 'reject':
      return lang === 'zh'
        ? `${verbPrefix}拒绝请求并返回 \`${action.code}\``
        : `${verbPrefix}reject request with \`${action.code}\``;
    case 'emit':
      return lang === 'zh'
        ? `${verbPrefix}发射事件 \`${action.event}\``
        : `${verbPrefix}emit \`${action.event}\``;
    case 'transition':
      return lang === 'zh'
        ? `${verbPrefix}将 \`${formatExprCompact(action.path)}\` 状态迁移至 \`${formatExprCompact(action.value)}\``
        : `${verbPrefix}transition \`${formatExprCompact(action.path)}\` to \`${formatExprCompact(action.value)}\``;
    case 'succeed-empty':
      return lang === 'zh'
        ? `${verbPrefix}幂等空成功（不产生新事件）`
        : `${verbPrefix}succeed-empty (idempotent no-op)`;
    case 'keep':
      return lang === 'zh'
        ? `${verbPrefix}维持 \`${formatExprCompact(action.expr)}\``
        : `${verbPrefix}keep \`${formatExprCompact(action.expr)}\``;
    case 'pin':
      return lang === 'zh'
        ? `${verbPrefix}依据 (${action.inputs.join(', ')}) 固定 \`${action.artifact}\``
        : `${verbPrefix}pin \`${action.artifact}\` from (${action.inputs.join(', ')})`;
    case 'dispatch':
      return lang === 'zh'
        ? `${verbPrefix}派发 \`${action.target}\``
        : `${verbPrefix}dispatch \`${action.target}\``;
    case 'respond': {
      const extra = action.constraint ? ` (\`${formatExprCompact(action.constraint)}\`)` : '';
      return lang === 'zh'
        ? `${verbPrefix}响应 \`${action.response}\`${extra}`
        : `${verbPrefix}respond \`${action.response}\`${extra}`;
    }
    case 'expose':
      return lang === 'zh'
        ? `${verbPrefix}在读模型 \`${action.view}\` 中展示 \`${formatExprCompact(action.constraint)}\``
        : `${verbPrefix}expose \`${action.view}\` as \`${formatExprCompact(action.constraint)}\``;
    case 'supply':
      return lang === 'zh'
        ? `${verbPrefix}由 \`${action.subject}\` 携带字段 ${action.fields.map(f => `\`${f}\``).join('、')}`
        : `${verbPrefix}allow \`${action.subject}\` to supply ${action.fields.map(f => `\`${f}\``).join(', ')}`;
    default:
      return '';
  }
}

function renderRuleAc(rule, idx, labelMap, lang) {
  const parts = [];
  if (rule.clauses.whereOpt) {
    const txt = renderConditionNatural(rule.clauses.whereOpt, labelMap, lang);
    parts.push(lang === 'zh' ? `当启用${txt}` : `where ${txt}`);
  }
  if (rule.clauses.whileExpr) {
    const txt = renderConditionNatural(rule.clauses.whileExpr, labelMap, lang);
    parts.push(lang === 'zh' ? `当处于${txt}` : `while ${txt}`);
  }
  if (rule.clauses.ifExpr) {
    const txt = renderConditionNatural(rule.clauses.ifExpr, labelMap, lang);
    parts.push(lang === 'zh' ? `如果${txt}` : `if ${txt}`);
  }
  if (rule.clauses.whenEvent) {
    let cond = '';
    if (rule.clauses.whenCond) {
      const rendered = renderConditionNatural(rule.clauses.whenCond, labelMap, lang);
      cond = lang === 'zh' ? `且${rendered}` : ` and ${rendered}`;
    }
    const evPrefixZh = rule.clauses.whenTriggerKind === 'event' ? '事件 ' : '';
    const evPrefixEn = rule.clauses.whenTriggerKind === 'event' ? 'event ' : '';
    parts.push(lang === 'zh' ? `当收到${evPrefixZh}\`${rule.clauses.whenEvent}\`${cond}` : `when ${evPrefixEn}\`${rule.clauses.whenEvent}\`${cond}`);
  }

  const sep = lang === 'zh' ? '，' : ', ';
  const actionsText = rule.actions
    .map(a => renderActionNatural(a, lang))
    .join(lang === 'zh' ? '，并' : ' and ');

  let postText = '';
  if (rule.post.length > 0) {
    const updates = rule.post.map(p => {
      const lhs = p.target.segments.join('.') + (p.target.index ? `[${formatExprCompact(p.target.index)}]` : '');
      return `\`${lhs}' = ${formatExprCompact(p.value)}\``;
    }).join(lang === 'zh' ? '、' : ', ');
    postText = lang === 'zh' ? `，并更新状态 ${updates}` : `, updating ${updates}`;
  }

  let condClause;
  if (parts.length > 0) {
    condClause = `${parts.join(sep)}${lang === 'zh' ? '，系统' : ', the system '}`;
  } else {
    condClause = lang === 'zh' ? '系统恒' : 'The system always ';
  }
  const endPunct = lang === 'zh' ? '。' : '.';
  return `- **AC-${idx + 1} \`[${rule.id}]\`**：${condClause}${actionsText}${postText}${endPunct}`;
}

export function projectStyleE(spec, { sourceFile = '<input>', sourceText = '', lang = 'zh' } = {}) {
  const sourceSha256 = createHash('sha256').update(sourceText || JSON.stringify(spec.canonicalForm ?? spec)).digest('hex');
  const labelMap = buildLabelMap(spec);
  const lines = [
    `<!-- AUTO-GENERATED BY co-arising EARS 1.0 (READ-ONLY PROJECTION — DO NOT EDIT) | source: ${sourceFile} | sha256: ${sourceSha256} -->`,
    '',
    lang === 'zh'
      ? `# 功能规约：${spec.target}（只读投影，真源：\`${sourceFile}\`）`
      : `# Functional Specification: ${spec.target} (Read-Only Projection, Source: \`${sourceFile}\`)`,
    '',
    lang === 'zh'
      ? `> 层级：\`${spec.layer}\` ｜ 类型：\`${spec.kind}\` ｜ SMT 理论：\`${spec.theory?.logic ?? 'QF_AUFLIA'}\``
      : `> Layer: \`${spec.layer}\` | Kind: \`${spec.kind}\` | SMT Logic: \`${spec.theory?.logic ?? 'QF_AUFLIA'}\``,
    '',
  ];

  if (spec.axioms.length > 0) {
    lines.push(lang === 'zh' ? '## 全局公理（Axioms）' : '## Global Axioms', '');
    for (const ax of spec.axioms) {
      if (ax.kind === 'invariant') {
        lines.push(`- **\`[${ax.id}]\`**：${lang === 'zh' ? '恒成立 ' : 'ALWAYS '}\`${formatExprCompact(ax.expr)}\``);
      } else {
        const desc = ax.actions.map(a => renderActionNatural(a, lang)).join(lang === 'zh' ? '且' : ' and ');
        lines.push(`- **\`[${ax.id}]\`**：${lang === 'zh' ? '恒成立：' : 'ALWAYS: '}${desc}`);
      }
    }
    lines.push('');
  }

  lines.push(lang === 'zh' ? '## 验收标准（Acceptance Criteria）' : '## Acceptance Criteria', '');
  spec.rules.forEach((rule, idx) => {
    lines.push(renderRuleAc(rule, idx, labelMap, lang));
  });
  lines.push('');

  return {
    format: 'style-e-ac',
    lang,
    sourceFile,
    sourceSha256,
    content: lines.join('\n'),
  };
}
