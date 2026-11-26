// Projection 2 (Style B): Deterministic read-only DMN Decision Table Markdown view.
import { createHash } from 'node:crypto';

function exprKey(expr) {
  if (!expr) return '';
  switch (expr.kind) {
    case 'var': return expr.name;
    case 'string': return `"${expr.value}"`;
    case 'number': return expr.value;
    case 'boolean': return String(expr.value);
    case 'member': return `${exprKey(expr.object)}.${expr.field}`;
    case 'index': return `${exprKey(expr.collection)}[${exprKey(expr.index)}]`;
    case 'call': return `${expr.name}(${expr.args.map(exprKey).join(', ')})`;
    case 'host': return `@host(${expr.name})`;
    case 'neg': return `-${exprKey(expr.argument)}`;
    case 'arith': return `${exprKey(expr.left)} ${expr.op} ${exprKey(expr.right)}`;
    case 'compare': return `${exprKey(expr.left)} ${expr.op} ${exprKey(expr.right)}`;
    case 'in': return `${exprKey(expr.element)} in ${expr.target.kind === 'interval' ? '[..]' : exprKey(expr.target)}`;
    case 'emptiness': return `${exprKey(expr.target)} is ${expr.check}`;
    case 'not': return `not ${exprKey(expr.argument)}`;
    case 'binary': return `(${exprKey(expr.left)} ${expr.op} ${exprKey(expr.right)})`;
    case 'quantifier': return `${expr.quantifier} ${expr.variable} in ${exprKey(expr.collection)} : ${exprKey(expr.body)}`;
    default: return '';
  }
}

function collectAtomicLiterals(expr, out = []) {
  if (!expr) return out;
  if (expr.kind === 'binary' && expr.op === 'and') {
    collectAtomicLiterals(expr.left, out);
    collectAtomicLiterals(expr.right, out);
    return out;
  }
  if (expr.kind === 'not') {
    if (expr.argument.kind === 'var' || expr.argument.kind === 'call') {
      out.push({ col: exprKey(expr.argument), value: 'false' });
      return out;
    }
    if (expr.argument.kind === 'in') {
      out.push({ col: `${exprKey(expr.argument.element)} in ${exprKey(expr.argument.target)}`, value: 'false' });
      return out;
    }
    out.push({ col: exprKey(expr.argument), value: 'false' });
    return out;
  }
  if (expr.kind === 'compare' && (expr.op === '==' || expr.op === '!=')) {
    const col = exprKey(expr.left);
    const rhs = exprKey(expr.right);
    out.push({ col, value: expr.op === '==' ? rhs : `!= ${rhs}` });
    return out;
  }
  if (expr.kind === 'emptiness') {
    out.push({ col: exprKey(expr.target), value: expr.check });
    return out;
  }
  if (expr.kind === 'boolean') return out;
  out.push({ col: exprKey(expr), value: 'true' });
  return out;
}

function formatOutcome(rule) {
  const parts = rule.actions.map(action => {
    const neg = action.modality === 'SHALL_NOT' ? 'NOT ' : '';
    switch (action.kind) {
      case 'reject': return `${neg}reject request with ${action.code}`;
      case 'emit': return `${neg}emit ${action.event}`;
      case 'transition': return `${neg}transition ${exprKey(action.path)} -> ${exprKey(action.value)}`;
      case 'succeed-empty': return `${neg}succeed-empty`;
      case 'keep': return `${neg}keep ${exprKey(action.expr)}`;
      case 'pin': return `${neg}pin ${action.artifact} from (${action.inputs.join(', ')})`;
      case 'dispatch': return `${neg}dispatch ${action.target}`;
      case 'respond': return `${neg}respond ${action.response}${action.constraint ? ` (${exprKey(action.constraint)})` : ''}`;
      case 'expose': return `${neg}expose ${action.view} as ${exprKey(action.constraint)}`;
      default: return '';
    }
  });
  if (rule.post.length > 0) {
    parts.push(`post: ${rule.post.map(p => `${p.target.segments.join('.')}'`).join(', ')}`);
  }
  return parts.join(' + ');
}

function escapeCell(text) {
  return String(text).replaceAll('|', '\\|');
}

function renderGroupTable(commandName, rules) {
  const columns = [];
  const colSet = new Set();
  const rowMaps = rules.map(rule => {
    const lits = collectAtomicLiterals(rule.rawGuard);
    const map = new Map();
    for (const lit of lits) {
      if (!colSet.has(lit.col)) {
        colSet.add(lit.col);
        columns.push(lit.col);
      }
      map.set(lit.col, lit.value);
    }
    return { rule, map };
  });

  const lines = [];
  if (commandName) {
    lines.push(`## Command: \`${commandName}\``, '');
  }
  const header = ['Rule ID', ...columns.map(c => `\`${escapeCell(c)}\``), 'Outcome'];
  lines.push(`| ${header.join(' | ')} |`);
  lines.push(`| ${header.map(() => '---').join(' | ')} |`);

  for (const { rule, map } of rowMaps) {
    const cells = [
      `\`${rule.id}\``,
      ...columns.map(col => (map.has(col) ? `\`${escapeCell(map.get(col))}\`` : 'any')),
      `\`${escapeCell(formatOutcome(rule))}\``,
    ];
    lines.push(`| ${cells.join(' | ')} |`);
  }
  lines.push('');
  return lines.join('\n');
}

export function projectStyleB(spec, { sourceFile = '<input>', sourceText = '' } = {}) {
  const sourceSha256 = createHash('sha256').update(sourceText || JSON.stringify(spec.canonicalForm ?? spec)).digest('hex');
  const groups = new Map();
  for (const rule of spec.rules) {
    const cmd = rule.command ?? '*';
    if (!groups.has(cmd)) groups.set(cmd, []);
    groups.get(cmd).push(rule);
  }

  const lines = [
    `<!-- AUTO-GENERATED BY co-arising EARS 1.0 (READ-ONLY DMN TABLE — DO NOT EDIT) | source: ${sourceFile} | sha256: ${sourceSha256} -->`,
    '',
    `# Decision Table: ${spec.target}`,
    '',
    `> Source: \`${sourceFile}\` | Layer: \`${spec.layer}\` | SMT Logic: \`${spec.theory?.logic ?? 'QF_AUFLIA'}\``,
    '',
  ];

  const multiCmd = groups.size > 1;
  for (const [cmd, groupRules] of groups) {
    lines.push(renderGroupTable(multiCmd ? cmd : null, groupRules));
  }

  return {
    format: 'style-b-dmn-table',
    sourceFile,
    sourceSha256,
    content: lines.join('\n'),
  };
}
