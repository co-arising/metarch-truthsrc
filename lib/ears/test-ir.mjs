// Deterministic language-agnostic TestIR compiled from verified EARS AST + Z3 witnesses + BMC.
import { createHash } from 'node:crypto';

function formatOutcomeSummary(rule) {
  return rule.actions.map(a => {
    const prefix = a.modality === 'SHALL_NOT' ? 'forbid ' : '';
    switch (a.kind) {
      case 'reject': return `${prefix}reject ${a.code}`;
      case 'emit': return `${prefix}emit ${a.event}`;
      case 'transition': return `${prefix}transition -> ${a.value?.value ?? ''}`;
      case 'succeed-empty': return `${prefix}succeed-empty`;
      case 'keep': return `${prefix}keep invariant`;
      case 'pin': return `${prefix}pin ${a.artifact}`;
      case 'dispatch': return `${prefix}dispatch ${a.target}`;
      case 'respond': return `${prefix}respond ${a.response}`;
      case 'expose': return `${prefix}expose ${a.view}`;
      default: return a.kind;
    }
  }).join(' and ');
}

function toSlug(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/gu, '$1-$2')
    .replace(/[^A-Za-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
    .toLowerCase();
}

export function buildTestIr(spec, smtResult, { sourceFile = '<input>', sourceText = '' } = {}) {
  const sourceSha256 = createHash('sha256').update(sourceText || JSON.stringify(spec.canonicalForm ?? spec)).digest('hex');
  const [aggregateOrStory, ...sliceParts] = spec.target.split('.');
  const sliceName = sliceParts.join('.') || null;
  const witnessByRule = new Map((smtResult?.checks?.witnesses ?? []).map(w => [w.ruleId, w]));

  const commandGroups = new Map();
  for (const rule of spec.rules) {
    const cmd = rule.command ?? spec.target;
    if (!commandGroups.has(cmd)) commandGroups.set(cmd, []);
    commandGroups.get(cmd).push(rule);
  }

  const scenarios = [];
  for (const [command, rules] of commandGroups) {
    const ruleIds = rules.map(r => r.id);
    const examples = rules.map(rule => {
      const w = witnessByRule.get(rule.id);
      return {
        ruleId: rule.id,
        pattern: rule.pattern,
        witness: w?.model ?? {},
        outcome: formatOutcomeSummary(rule),
        actions: rule.actions,
        post: rule.post.map(p => ({
          target: p.target.segments.join('.'),
          indexed: Boolean(p.target.index),
        })),
      };
    });

    const tags = [
      ...ruleIds.map(id => `@spec:${id}`),
      smtResult?.logic === 'QF_NIA' ? '@z3-witness:QF_NIA' : '@z3-witness',
    ];

    scenarios.push({
      id: `${toSlug(command)}-oracle`,
      kind: spec.layer === 'application' ? 'application' : 'outline',
      command,
      title: `${spec.target} — ${command} behavior & boundary oracle`,
      ruleIds,
      tags,
      examples,
    });
  }

  for (const prop of smtResult?.bmc?.properties ?? []) {
    scenarios.push({
      id: prop.id,
      kind: 'bmc',
      command: spec.target,
      title: prop.description,
      ruleIds: [prop.setterRuleId, prop.consumerRuleId].filter(Boolean),
      tags: [
        ...[prop.setterRuleId, prop.consumerRuleId].filter(Boolean).map(id => `@spec:${id}`),
        `@bmc:${prop.steps}-step`,
      ],
      bmc: {
        steps: prop.steps,
        status: prop.status,
        passed: prop.passed,
      },
      examples: [],
    });
  }

  const testIr = {
    schemaVersion: 'co-arising.test-ir/v1',
    meta: {
      sourceFile,
      sourceSha256,
      canonicalSha256: spec.canonicalSha256,
      kind: spec.kind,
      layer: spec.layer,
      target: spec.target,
      aggregate: spec.kind === 'slice' ? aggregateOrStory : null,
      slice: sliceName,
      story: spec.kind === 'story' ? toSlug(spec.target) : null,
      solver: smtResult?.solver ?? 'z3',
      logic: smtResult?.logic ?? spec.theory?.logic ?? 'QF_AUFLIA',
      verified: Boolean(smtResult?.passed),
    },
    scenarios,
  };

  testIr.sha256 = createHash('sha256').update(JSON.stringify(testIr)).digest('hex');
  return testIr;
}
