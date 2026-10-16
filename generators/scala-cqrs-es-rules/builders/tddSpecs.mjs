// tddSpecs.mjs — the behavior ExecutableSpec face (V4-21), ported from the production
// tdd_test_gen.mjs (EP_Stage07_Evaluator): per aggregate one
// test/net/imadz/metarch/behavior/<Agg>ExecutableSpec.scala driving the
// EventSourcedBehaviorTestKit over the aggregate's executable cases (given/when/then with the
// patchForCases completeness patch), plus the shared ExecutableSpecConfig.
//
// Signature authority: the canonical's OWN aggregates rows (commands/state/events with the same
// scalaSig mapping the skeleton face renders from — the engine parsed the generated files, which
// are byte-identical, so the two agree). The literal set is THIS tool's variant (bare Id.of — the
// spec file imports net.imadz.common.Id; the domain RulesSpec face's FQN-qualified variant is a
// different face and deliberately not shared). Port args (S2-98): the trait short names of the
// cmd/union port faces → canonical ports[].testRef ?? bridgeFq. SURGERY-KEEP awareness scans the
// SAME-RUN generated EventHandler content (byte-identical to the live tree the engine scanned).
import crypto from 'node:crypto';
import { patchForCases, gtNowFields, PLACEHOLDER, exprToScala } from './expr.mjs';
import { scalaRef, inputFieldOf } from './rules.mjs';
import { parse } from './writtenby.mjs';
// writtenby_lib's event/head-field accessors (segment accessors over the same grammar parse)
const parseWrittenBy = parse;
const eventOf = (path) => { const p = parse(path); return p.ok ? p.segments[0].name : null; };
const headFieldOf = (path) => { const p = parse(path); return p.ok && p.segments.length >= 2 ? p.segments[1].name : null; };
import { scalaSig } from '../../scala-cqrs-es/builders/types.mjs';

const sigOf = (f) => (f.optional ? `Option[${scalaSig(f.dataType)}]` : scalaSig(f.dataType));

// —— the tool's own literal set (tdd_test_gen.mjs lines 161-278 verbatim; bare Id.of) ——
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
function idFromString(s) {
  const h = crypto.createHash('md5').update(s).digest();
  h[6] = (h[6] & 0x0f) | 0x30;
  h[8] = (h[8] & 0x3f) | 0x80;
  const hex = [...h].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function defaultLiteral(type, voByName) {
  const t = type.trim();
  if (t === 'Id') return 'Id.of("00000000-0000-0000-0000-000000000001")';
  if (t === 'String') return '""';
  if (t === 'Int' || t === 'Integer') return '1';
  if (t === 'Long') return '1L';
  if (t === 'Boolean') return 'false';
  if (t === 'Double') return '1.0';
  if (t === 'BigDecimal') return 'BigDecimal(1)';
  if (t.startsWith('Instant') || t.endsWith('Instant')) return 'null';
  if (t.startsWith('List[') || t === 'List') return 'Nil';
  if (t.startsWith('Option[')) return 'None';
  if (t.startsWith('Map[')) return 'Map.empty';
  const voSig = voByName.get(t);
  if (voSig) return `${t}(${voSig.params.map((p) => defaultLiteral(p.type, voByName)).join(', ')})`;
  return 'null';
}
function nonNullLiteral(type) {
  const t = (type || 'String').trim();
  if (t === 'Id') return 'Id.of("00000000-0000-0000-0000-000000000001")';
  if (t.startsWith('Instant') || t.endsWith('Instant')) return 'Instant.parse("2026-01-02T00:00:00Z")';
  if (t === 'Int' || t === 'Integer') return '1';
  if (t === 'Long') return '1L';
  if (t === 'Boolean') return 'true';
  if (t === 'BigDecimal') return 'BigDecimal(1)';
  if (t.startsWith('List[') || t === 'List') return 'Nil';
  if (t.startsWith('Option[')) return `Some(${nonNullLiteral(t.slice(7, -1))})`;
  return '"X"';
}
function literalFor(value, type, voByName) {
  const t = (type || 'String').trim();
  if (t.startsWith('Option[')) {
    const inner = t.slice(7, -1).trim();
    if (value === null || (typeof value === 'string' && PLACEHOLDER.has(value))) return 'None';
    return `Some(${literalFor(value, inner, voByName)})`;
  }
  if (value === null) {
    if (['Boolean', 'Int', 'Integer', 'Long', 'Double', 'BigDecimal'].includes(t)) return defaultLiteral(t, voByName);
    return 'null';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return defaultLiteral(t, voByName);
    if (!(t.startsWith('List[') || t === 'List')) return nonNullLiteral(t);
    if (value.every((v) => PLACEHOLDER.has(String(v)))) return 'Nil';
    const elemType = t.startsWith('List[') ? t.slice(5, -1) : 'String';
    return 'List(' + value.map((v) => literalFor(v, elemType, voByName)).join(', ') + ')';
  }
  if (typeof value === 'boolean') return t === 'Boolean' ? String(value) : `"${value}"`;
  if (typeof value === 'number') return t === 'Int' || t === 'Integer' || t === 'Long' || t === 'Double' || t === 'BigDecimal' ? String(value) : `"${value}"`;
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const voSig = voByName.get(t);
    if (voSig) {
      const args = voSig.params.map((p) => {
        const v = value[p.name];
        return v === undefined ? defaultLiteral(p.type, voByName) : literalFor(v, p.type, voByName);
      }).join(', ');
      return `${t}(${args})`;
    }
    return `"${JSON.stringify(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  const s = String(value);
  if (t.startsWith('List[') || t === 'List') {
    if (PLACEHOLDER.has(s)) return 'Nil';
    const elemType = t.startsWith('List[') ? t.slice(5, -1) : 'String';
    return `List(${literalFor(value, elemType, voByName)})`;
  }
  if (PLACEHOLDER.has(s)) return defaultLiteral(t, voByName);
  if (t === 'Id') {
    if (s === 'MISSING_REF' || s === '__OTHER__' || s === '') return 'null';
    return UUID_RE.test(s) ? `Id.of("${s}")` : `Id.of("${idFromString(s)}")`;
  }
  if (t.includes('Instant')) return `Instant.parse("${s}")`;
  if (t === 'Int' || t === 'Integer') {
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? '1' : String(n);
  }
  if (t === 'Boolean') return s === 'true' ? 'true' : 'false';
  if (t === 'BigDecimal') return `BigDecimal(${s})`;
  const voSig = voByName.get(t);
  if (voSig) return `${t}(${voSig.params.map((p) => defaultLiteral(p.type, voByName)).join(', ')})`;
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function isDomainValueType(t, voByName) {
  const name = t.trim().replace(/^List\[/, '').replace(/\]$/, '').replace(/^Option\[/, '').replace(/\]$/, '');
  return voByName.has(name) || voByName.has(t.trim());
}

// R5 (S2-48 批3): audit-TS guard fields with no rule reference — inject on missing AND
// explicit null/'' (存量数据债); status NOT relaxed (patchForCases 刻意失败值).
const R5_TS_FIELD = { Context: 'discoveredAt', Relation: 'createdAt', ContextRelation: 'createdAt', Subdomain: 'classifiedAt' };

// SURGERY-KEEP scan over the same-run generated EventHandler content (the engine scanned the
// live tree's file — byte-identical, so the direct-assignment sets agree).
export function surgeryDirectOf(ehContent) {
  const surgDirect = new Map();
  if (!ehContent) return surgDirect;
  const skRe = /case event: (\w+) =>\r?\n[ \t]*\/\/ \[SURGERY-KEEP [^\]]+\]([\s\S]*?)\/\/ \[\/SURGERY-KEEP\]/g;
  let skm;
  while ((skm = skRe.exec(ehContent)) !== null) {
    const direct = new Set();
    for (const lm of skm[2].matchAll(/(\w+) = /g)) {
      const tail = skm[2].slice(lm.index + lm[0].length).trimStart();
      if (!tail.startsWith('if')) direct.add(lm[1]);
    }
    surgDirect.set(skm[1], direct);
  }
  return surgDirect;
}

export function tddSpecModel(a, env, { ehContent, eventNoteIds }) {
  const agg = a.name;
  const voByName = new Map((env.voCatalog ?? []).map((v) => [v.name, {
    name: v.name,
    params: (v.fields ?? []).map((f) => ({ name: f.name, type: scalaSig(f.dataType) })),
  }]));
  function defaultLiteralOf(type) { return defaultLiteral(type, voByName); }
  function literalForOf(value, type) { return literalFor(value, type, voByName); }

  const stateName = `${agg}State`;
  // the Entity face's credential-nature exclusion — the engine parsed the GENERATED state
  // signature, which never carries the excluded fields
  const excludedNatures = new Set(env.excludedStateFieldNatures ?? []);
  const stateParams = (a.stateFields ?? [])
    .filter((f) => !(f.nature && excludedNatures.has(f.nature)))
    .map((f) => ({ name: f.name, type: sigOf(f) }));
  const stateTypes = Object.fromEntries(stateParams.map((p) => [p.name, p.type]));
  const eventSigs = (a.events ?? []).map((e) => ({
    name: e.name,
    params: (e.payloads ?? []).map((p) => ({ name: p.name, type: sigOf(p) })),
  }));
  const evByName = new Map(eventSigs.map((e) => [e.name, e]));
  // commands with the synthesized replyTo parameter (the Protocol face appends it; the engine
  // parsed the generated file where it exists)
  const commands = (a.commands ?? []).map((c) => ({
    name: c.name,
    noteId: c.noteId ?? null,
    params: [
      ...(c.parameters ?? []).map((p) => ({ name: p.name, type: sigOf(p) })),
      ...(c.reply?.name ? [{ name: 'replyTo', type: `ActorRef[${c.reply.name}]` }] : []),
    ],
    behaviorModel: c.behaviorModel ?? null,
    preconditionRules: c.preconditionRules ?? [],
  }));
  const cmdByName = new Map(commands.map((c) => [c.name, c]));
  const replies = commands
    .filter((c) => c.params.some((p) => p.type.startsWith('ActorRef[')))
    .map((c) => ({ name: c.params.find((p) => p.type.startsWith('ActorRef[')).type.replace(/^ActorRef\[/, '').replace(/\]$/, '') }));

  const aggCases = a.executableCases ?? [];
  const aggRules = (a.aggregateRules ?? []).slice();
  const cmdRules = new Map();
  for (const c of commands) if (c.preconditionRules.length) cmdRules.set(c.name, c.preconditionRules);

  // writtenBy lineage → state-assertion rows (metaAgg = a.fieldMeta; kn-export rows carry no
  // VO-flattened members, so the engine's role filter is a no-op here)
  const metaAgg = a.fieldMeta ?? null;
  const wbByEvent = new Map();
  if (metaAgg) {
    for (const f of metaAgg.stateFields ?? []) {
      if (f.role === 'ValueObject.Member') continue;
      for (const wb of f.writtenBy ?? []) {
        const p = parseWrittenBy(wb);
        if (!p.ok) continue;
        const ev = eventOf(wb);
        const field = headFieldOf(wb);
        if (field === null) continue;
        const evSig = evByName.get(ev);
        if (!evSig) continue;
        const et0 = evSig.params.find((q) => q.name === field)?.type;
        const deep = p.segments.length >= 3;
        const et = et0 || (deep ? p.segments[1].name : 'String');
        const st = stateTypes[f.name] || 'String';
        if (!wbByEvent.has(ev)) wbByEvent.set(ev, []);
        wbByEvent.get(ev).push({ stateField: f.name, evField: field, evPath: p.segments.map((s) => s.name), st, et, deep });
      }
    }
  }

  const surgDirect = surgeryDirectOf(ehContent);

  // —— 规则归属（tdd_test_gen lines 405-435）——
  const cmdNames = new Set(commands.map((c) => c.name));
  const allAttributed = [...aggRules, ...[...cmdRules.values()].flat()];
  const implRuleIds = new Set(allAttributed.map((r) => r.id));
  // the attribution loop's translatability gate: a rule the domain face kept but exprToScala
  // rejects never entered the engine's cmdRules/aggRules → its cases take the 未实现 skip.
  const translatable = new Set();
  for (const rule of allAttributed) {
    const caseCmds = new Set(aggCases.filter((c) => c.ruleId === rule.id).map((c) => c.command));
    const inAgg = [...caseCmds].filter((c) => cmdNames.has(c));
    const ownerForCtx = caseCmds.size > 1 ? null : inAgg[0] ?? null;
    const ctx = {
      stateFields: new Set(stateParams.map((p) => p.name.replace(/`/g, ''))),
      paramFields: new Set(ownerForCtx ? (cmdByName.get(ownerForCtx)?.params ?? []).filter((p) => !p.type.startsWith('ActorRef[')).map((p) => p.name.replace(/`/g, '')) : []),
      stateTypes: Object.fromEntries(stateParams.map((p) => [p.name.replace(/`/g, ''), p.type])),
      paramTypes: Object.fromEntries(ownerForCtx ? (cmdByName.get(ownerForCtx)?.params ?? []).filter((p) => !p.type.startsWith('ActorRef[')).map((p) => [p.name.replace(/`/g, ''), p.type]) : []),
      aggName: agg, cmdName: ownerForCtx,
      inputField: inputFieldOf(rule.humanDescription),
    };
    if (exprToScala(rule.expression, ctx)) translatable.add(rule.id);
  }
  for (const rid of [...implRuleIds]) if (!translatable.has(rid)) implRuleIds.delete(rid);
  // the patcher sees ONLY the translatable attribution — the engine's cmdRules/aggRules were
  // built post-gate, so an untranslatable "other" rule never participated in neutralization
  // (IR_INV_CMD_002 判例: notMemberOf-via 不可翻译 → userId 不被 NOT_IN_SET 中和)
  const aggRulesT = aggRules.filter((r) => translatable.has(r.id));
  const cmdRulesOf = (cmdName) => (cmdRules.get(cmdName) ?? []).filter((r) => translatable.has(r.id));

  const tests = [];
  const usedTestNames = new Map();
  for (const tc of aggCases) {
    if (!implRuleIds.has(tc.ruleId)) {
      tests.push(`  // [SKIP] ${tc.ruleId}（未实现规则，用例 ${tc.type}）`);
      continue;
    }
    const bmDec = (cmdByName.get(tc.command)?.behaviorModel) ?? null;
    const isCmdLevel = (cmdRules.get(tc.command) ?? []).some((r) => r.id === tc.ruleId);
    const bmConsumed = bmDec && Array.isArray(bmDec.guards) && isCmdLevel
      ? (bmDec.noCommandRules
          ? 'noCommandRules'
          : (bmDec.guards.some((g) => g.kind === 'invariantRef' || g.errCode) && !bmDec.guards.some((g) => g.ref === tc.ruleId) ? 'guarded' : null))
      : null;
    if (bmConsumed) {
      tests.push(`  // [SKIP] ${tc.ruleId}（④层声明优先·检查未发射，用例 ${tc.type}）`);
      continue;
    }
    const cmd = cmdByName.get(tc.command);
    if (!cmd) {
      tests.push(`  // [SKIP] 命令 ${tc.command} 签名未找到（用例 ${tc.ruleId}）`);
      continue;
    }
    const replyType = cmd.params.find((p) => p.type.startsWith('ActorRef['))?.type
      .replace(/^ActorRef\[/, '').replace(/\]$/, '');
    const replySig = replies.find((r) => r.name === replyType);
    if (!replySig) {
      tests.push(`  // [SKIP] reply ${replyType} 签名未找到（用例 ${tc.ruleId}）`);
      continue;
    }

    const isPositive = tc.type === 'positive';
    const stateMap = {};
    for (const p of stateParams) stateMap[`${agg}.${p.name}`] = tc.given?.state?.[`${agg}.${p.name}`];
    const paramMap = {};
    const paramTypes = Object.fromEntries(cmd.params.filter((p) => !p.type.startsWith('ActorRef[')).map((p) => [p.name, p.type]));
    for (const p of cmd.params) {
      if (p.type.startsWith('ActorRef[')) continue;
      paramMap[`${tc.command}.${p.name}`] = tc.when?.params?.[`${tc.command}.${p.name}`];
    }
    const gtNowFieldsSet = new Set();
    for (const r of [...aggRulesT, ...cmdRulesOf(tc.command)]) {
      for (const f of gtNowFields(r.expression)) gtNowFieldsSet.add(f);
    }
    for (const f of gtNowFieldsSet) {
      const raw = tc.when?.params?.[`${tc.command}.${f}`];
      if (typeof raw === 'string') {
        const t = Date.parse(raw);
        if (!isNaN(t)) {
          paramMap[`${tc.command}.${f}`] = t >= Date.parse('2026-01-02T00:00:00Z') ? '__FUTURE__' : '__PAST__';
        }
      }
    }
    patchForCases(aggRulesT, cmdRulesOf(tc.command), stateMap, paramMap, agg, tc.command, tc.ruleId, isPositive, stateTypes, paramTypes);

    const r5Ts = R5_TS_FIELD[agg];
    const statusFallbackLit = (() => {
      const enumRule = [...aggRules].reverse().find((r) => {
        const e = r.expression;
        return e && e.in && e.in[0] && String(e.in[0].var).endsWith('.status');
      });
      if (enumRule) return `"${enumRule.expression.in[1][0]}"`;
      if (Array.isArray(metaAgg?.statusEnum) && metaAgg.statusEnum.length) return `"${String(metaAgg.statusEnum[0])}"`;
      return null;
    })();
    const stateArgs = stateParams.map((p) => {
      const v = stateMap[`${agg}.${p.name}`];
      if (p.name === 'status' && v === undefined && statusFallbackLit) return statusFallbackLit;
      if (r5Ts && p.name === r5Ts && (v === undefined || v === null || v === '')) return 'Instant.parse("2026-01-02T00:00:00Z")';
      return v === undefined ? defaultLiteralOf(p.type) : literalForOf(v, p.type);
    });
    const stateExpr = `${stateName}(${stateArgs.join(', ')})`;

    const cmdArgs = cmd.params
      .filter((p) => !p.type.startsWith('ActorRef['))
      .map((p) => {
        let v = paramMap[`${tc.command}.${p.name}`];
        if (p.name === 'triggeredBy') {
          if (v === undefined) v = '00000000-0000-0000-0000-000000000009';
          else if (v !== null && !UUID_RE.test(String(v))) v = '00000000-0000-0000-0000-000000000009';
        }
        if (v === undefined) return defaultLiteralOf(p.type);
        if (v === '__FUTURE__') return 'Instant.now().plusSeconds(86400)';
        if (v === '__PAST__') return 'Instant.now().minusSeconds(86400)';
        return literalForOf(v, p.type);
      });

    const baseTestName = `${tc.command} ${tc.type} ${tc.ruleId}`.replace(/"/g, "'");
    const nameSeen = usedTestNames.get(baseTestName) ?? 0;
    usedTestNames.set(baseTestName, nameSeen + 1);
    const testName = nameSeen === 0 ? baseTestName : `${baseTestName} #${nameSeen + 1}`;
    const cmdInvoke = `${tc.command}(${cmdArgs.join(', ')}, replyTo)`;

    if (isPositive) {
      const evAssert = Array.isArray(tc.then?.events)
        ? `\n      result.events.map(_.getClass.getSimpleName) shouldBe List(${tc.then.events.map((e) => `"${e}"`).join(', ')})`
        : tc.then?.event
        ? `\n      result.events.map(_.getClass.getSimpleName) should contain ("${tc.then.event}")`
        : '';
      const stateLit = Object.fromEntries(stateParams.map((p, i) => [p.name, stateArgs[i]]));
      const foldAssigns = (((a.folds ?? []).find((f) => f.event === tc.then?.event) ?? {}).assignments) ?? {};
      const wbLines = [];
      if (tc.then?.event) {
        const surg = surgDirect.get(tc.then.event);
        const wbSeen = new Set();
        for (const { stateField, evField, evPath, st, et, deep } of wbByEvent.get(tc.then.event) ?? []) {
          if (deep) continue;
          if (surg !== undefined && !surg.has(stateField)) continue;
          if (wbSeen.has(stateField)) continue;
          wbSeen.add(stateField);
          const fa = String(foldAssigns[stateField] ?? '');
          let rhs = null;
          if (/^(append|concat|remove):/.test(fa)) {
            const kind = fa.slice(0, fa.indexOf(':'));
            const ef = fa.slice(kind.length + 1).replace(/^event\./, '');
            const stBase = String(st).replace(/^List\[/, '').replace(/\]$/, '').trim();
            const val = (stBase === 'String' && (et === 'Id' || String(et).startsWith('Id')))
              ? `ev.${scalaRef(ef)}.toString` : `ev.${scalaRef(ef)}`;
            const baseLit = stateLit[stateField];
            const emptyBase = baseLit === undefined || baseLit === 'null' || baseLit === 'Nil' || baseLit === 'List()';
            if (kind === 'append') rhs = emptyBase ? `List(${val})` : `${baseLit} :+ ${val}`;
            else if (kind === 'concat') rhs = emptyBase ? val : `${baseLit} ++ ${val}`;
            else rhs = emptyBase ? 'Nil' : `${baseLit}.filter(_ != ${val})`;
          }
          if (rhs === null) {
            const stElem = String(st).startsWith('List[') ? String(st).replace(/^List\[/, '').replace(/\]$/, '').trim() : null;
            const compatible = st === et
              || (st === 'String' && (et === 'Id' || String(et).startsWith('Id')))
              || (stElem !== null && stElem === et)
              || (stElem === null && st === 'String' && String(et) !== 'Id');
            if (!compatible) continue;
            rhs = `ev.${scalaRef(evField)}`;
            if (st === 'String' && (et === 'Id' || String(et).startsWith('Id'))) rhs = `ev.${scalaRef(evField)}.toString`;
            else if (stElem !== null && stElem === et) rhs = `List(ev.${scalaRef(evField)})`;
          }
          wbLines.push(`        result.state.${scalaRef(stateField)} shouldBe ${rhs}`);
        }
      }
      const wbAssert = wbLines.length
        ? `\n      result.events.foreach {
        case ev: ${tc.then.event} =>
${wbLines.join('\n')}
        case _ =>
      }`
        : '';
      tests.push(`    "${testName}" in {
      val kit = kitFor(${stateExpr})
      val result = kit.runCommand[${replyType}](replyTo => ${cmdInvoke})
      result.reply.error shouldBe None${evAssert}${wbAssert}
    }`);
    } else {
      const errCode = tc.errorCode || tc.then?.errorCode;
      tests.push(`    "${testName}" in {
      val kit = kitFor(${stateExpr})
      val result = kit.runCommand[${replyType}](replyTo => ${cmdInvoke})
      result.reply.error.map(_.code) shouldBe Some("${errCode}")
    }`);
    }
  }

  // imports + header anchors + port args (S2-98: cmd face → Behaviors, union face → EventHandler)
  const specNoteIds = [...new Set(aggCases.flatMap((tc) => [
    tc.command ? cmdByName.get(tc.command)?.noteId ?? null : null,
    tc.then?.event ? eventNoteIds?.[tc.then.event] ?? null : null,
  ]).filter(Boolean))];
  const testRefOf = (p) => p.testRef ?? p.bridgeFq ?? null;
  const portArgs = (ports) => {
    if (!ports.length) return '';
    const refs = ports.map(testRefOf);
    return refs.some((r) => !r) ? '' : `(${refs.join(', ')})`;
  };
  const behArgs = portArgs((a.ports ?? []).slice().sort((x, y) => (`${x.fqPkg}.${x.trait}` < `${y.fqPkg}.${y.trait}` ? -1 : 1)));
  const ehArgs = portArgs((a.foldPorts ?? []).slice().sort((x, y) => (`${x.fqPkg}.${x.trait}` < `${y.fqPkg}.${y.trait}` ? -1 : 1)));
  const specHasPorts = Boolean(behArgs || ehArgs);
  const usesVO = stateParams.some((p) => isDomainValueType(p.type, voByName)) ||
    commands.some((c) => c.params.some((p) => isDomainValueType(p.type, voByName)));
  const valuesImport = usesVO ? 'import net.imadz.metarch.domain.values._\n' : '';
  const kr = env.knowledgeRelease ? `// @knowledge-release ${env.knowledgeRelease}\n` : '';
  // the tdd tool never carried the hash sidecar — its header anchors are BARE noteIds (live tree
  // + fresh sandbox run agree; the skeleton face's hashed anchors are a different face)
  const anchors = specNoteIds.map((nid) => `// @knowledge ${nid}\n`).join('');

  const spec = `// @generated by tdd_test_gen
${kr}${anchors}package net.imadz.metarch.behavior

import akka.actor.testkit.typed.scaladsl.ScalaTestWithActorTestKit
import akka.persistence.testkit.scaladsl.EventSourcedBehaviorTestKit
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.EventSourcedBehavior
import net.imadz.common.Id
import net.imadz.metarch.application.aggregates.${agg}Protocol._
import net.imadz.metarch.application.aggregates.behaviors.${agg}Behaviors
import net.imadz.metarch.domain.entities.${agg}Entity._
import net.imadz.metarch.domain.entities.behaviors.${agg}EventHandler
${valuesImport}import java.time.Instant
import org.scalatest.wordspec.AnyWordSpecLike
import org.scalatest.matchers.should.Matchers

/**
 * 求值器 Phase 2 TDD 测试骨架（tdd_test_gen.mjs 生成，${aggCases.length} 用例）。
 * 红态预期：行为实现为 ??? 桩 → NotImplementedError；绿态 = 按依赖队列填实现后本 Spec 即验收。
 * 状态字段缺失值 = 类型推导默认（status→"ACTIVE" 等）；如需精确前置状态，绿态阶段按需精化。
 */
class ${agg}ExecutableSpec extends ScalaTestWithActorTestKit(ExecutableSpecConfig.testConfig) with AnyWordSpecLike with Matchers {

  private def kitFor(state: ${stateName}): EventSourcedBehaviorTestKit[${agg}CommandFamily, ${agg}Event, ${stateName}] =
    EventSourcedBehaviorTestKit[${agg}CommandFamily, ${agg}Event, ${stateName}](
      system,
      EventSourcedBehavior${specHasPorts ? `[${agg}CommandFamily, ${agg}Event, ${stateName}]` : ''}(
        PersistenceId("${agg}", "t1"),
        state,
        ${agg}Behaviors.apply${behArgs},
        ${agg}EventHandler.apply${ehArgs}
      )
    )

  "${agg} executable cases" should {
    // 骨架标注：红态阶段行为实现为 ??? 桩 → NotImplementedError；绿态 = 填实现后本 Spec 即验收
${tests.join('\n')}
  }
}
`;
  return { agg, spec, caseCount: aggCases.length, noteIds: specNoteIds };
}

export const executableSpecConfig = (env) => {
  const kr = env.knowledgeRelease ? `// @knowledge-release ${env.knowledgeRelease}\n` : '';
  return `// @generated by tdd_test_gen
${kr}package net.imadz.metarch.behavior

import akka.persistence.testkit.scaladsl.EventSourcedBehaviorTestKit
import com.typesafe.config.{Config, ConfigFactory}

/**
 * 测试 ActorSystem 配置：CborSerializable → jackson-cbor 绑定（命令/事件经 Cbor 序列化）
 * + EventSourcedBehaviorTestKit 默认配置。
 * 2026-08-22：不合并时命令消息落入 DisabledJavaSerializer（allow-java-serialization=off），
 * 全部测试静默失败；不能整包加载 application.conf（会拉起 cluster/SBR，且 SagaSerializer
 * 缺 serialization-identifiers 报 ConfigException）。
 */
object ExecutableSpecConfig {
  val testConfig: Config = ConfigFactory
    .parseString("""
      akka.actor.serializers.jackson-cbor = "akka.serialization.jackson.JacksonCborSerializer"
      akka.actor.serialization-bindings."net.imadz.common.CborSerializable" = jackson-cbor
      akka.actor.allow-java-serialization = on
      akka.actor.warn-about-java-serializer-usage = off
    """)
    .withFallback(EventSourcedBehaviorTestKit.config)
    .resolve()
}
`;
};
