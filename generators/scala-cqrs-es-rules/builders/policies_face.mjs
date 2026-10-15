// policies_face.mjs — the Policy face (V4-3 inc10), ported from rules_domain_gen's Policy 发射段
// (S2-44·2026-09-05, lines 2792-3240). Policy = event → command 领域语义（对偶 domain/invariant：
// Rules 吃 (State, Params) 产 Events；Policy 吃 Event 产 Params）。
//
// Attribution lives in tools/augment-rules-canonical.mjs (policies slot, per Fork A); everything
// below is the generator-side rendering pipeline:
//   • args: for each Params field, `bindings[field]` translates via bindingExpr (event./item./
//     literal:); unbound fields fall back to the E101 extension-slot default when the rendered
//     RuleParams signature declares one; still unresolved → the whole policy skips (宁缺勿造).
//   • Types: the Params side comes from the rendered RuleParams signature (paramSigs, passed in —
//     the source reads the file it wrote earlier in the same run); the event side is DERIVED from
//     the raw ②-layer payloads via normalize+scalaSig — the same mapping the skeleton generator
//     renders the Entity from, so the derived signature ≡ the generated one the source reads off
//     disk (entityEvtSigOf). The Id-vs-String wrapping (Id.of / .toString) keys off that pair.
//   • fanOut: `e.<field>.filter(item => <cond>).map(...)` — the predicate goes through the SAME
//     exprToScala lexicon as emitWhen conds; the Spec's sentinel is the DIFFERENTIATED pair built
//     by filterSentinel (eq/notEmpty over item.<field>, and/or 合取) + literalFor over the element
//     VO signature, with Id-wrapped fields forced to a parseable UUID (Id.of would otherwise throw
//     on the neutral "").
//   • The source's `scalaType` helper (line 2899) is dead code in the section — not ported.
import { scalaRef } from './rules.mjs';
import { exprToScala } from './expr.mjs';
import { makeLiterals } from './literals.mjs';

// --- RuleParams signature parsing (source's splitTopLevel + parseCaseClassSignature, lines 742-779)
// The policy section reads the ACTUAL <Cmd>Params signatures off the RuleParams file the same run
// wrote earlier (paramDefs order ≠ declared order — S2-46); truthsrc parses its own rendered
// rule-params content, which is the same bytes.
function splitTopLevel(s) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

export function parseRuleParamsSigs(src) {
  const re = /case class (\w+)\(((?:[^()]|\([^()]*\))*)\)(?: extends ([\w.]+))?/g;
  const out = new Map(); // <Cmd>Params → [{name, type, hasDefault, defaultValue}]
  let m;
  while ((m = re.exec(src)) !== null) {
    const params = splitTopLevel(m[2]).map((s) => s.trim()).filter(Boolean).map((seg) => {
      const eq = seg.indexOf('=');
      const noDefault = eq >= 0 ? seg.slice(0, eq).trim() : seg;
      const idx = noDefault.indexOf(':');
      const dflt = eq >= 0 ? seg.slice(eq + 1).trim() : null;
      return { name: noDefault.slice(0, idx).trim().replace(/`/g, ''), type: noDefault.slice(idx + 1).trim(), hasDefault: dflt !== null, defaultValue: dflt };
    });
    out.set(m[1], params);
  }
  return out;
}

// --- raw ②-layer dataType → Entity signature type ---------------------------------------------
// Mirrors extract-metarch-canonical's normalize (String (UUID) → string (uuid), List<X> →
// List[X′], JSON → String) composed with the skeleton's scalaSig ('string (uuid)'|'uuid' → Id).
// Derived sig ≡ the generated Entity case-class signature (golden-verified mapping).
const isUuid = (s) => /^string\s*\(uuid\)$/i.test(String(s).trim());
function normInner(dt) {
  const s = String(dt).trim();
  if (isUuid(s)) return 'Id';
  if (s === 'JSON') return 'String';
  return normalize(s);
}
function normalize(dt) {
  const s = String(dt).trim();
  let m = s.match(/^List<(.+)>$/);
  if (m) return `List[${normInner(m[1])}]`;
  m = s.match(/^(Seq|Set|Vector)<(.+)>$/);
  if (m) return `${m[1]}[${normInner(m[2])}]`;
  m = s.match(/^Map<(.+),(.+)>$/);
  if (m) return `Map[${normInner(m[1])}, ${normInner(m[2])}]`;
  return isUuid(s) ? 'string (uuid)' : s === 'JSON' ? 'String' : s;
}
const scalaSig = (dt) => (dt === 'string (uuid)' || dt === 'uuid' ? 'Id' : dt);
const deriveEvtSig = (evtPayloads) => new Map((evtPayloads ?? []).map(([name, rawDt]) => [name, scalaSig(normalize(rawDt))]));

// 事件载荷 → Params 字段表达式（方案 A 签名·identity 字段直取·fanOut 用 item / item.<字段>）
const bindingExpr = (decl) => {
  const s = String(decl).trim();
  if (s === 'item') return 'item';
  // item.<字段>：扇出元素字段。类型包装见 wrapItemExpr。
  if (s.startsWith('item.')) return `item.${scalaRef(s.slice(5))}`;
  if (s.startsWith('event.')) return `e.${scalaRef(s.slice(6))}`;
  if (s.startsWith('literal:')) return JSON.stringify(s.slice(8));
  return null; // 未知声明形态——宁缺勿造·该 policy 整体跳过
};

/** `item.<字段>` 的类型感知包装：源类型取**元素 VO 签名的源字段**（decl 里声明的那一个）——
 *  策略绑定常是改名映射（item.conceptName → Params.name），同名假设在此不成立。
 *  List 元素按元素类型逐项包装（item.noteIds: List[String] → List[Id]）。 */
const wrapItemExpr = (expr, decl, paramT, elemVoName, voByName) => {
  const voSig = elemVoName ? voByName.get(elemVoName) : null;
  const srcField = String(decl).slice(5);
  const srcT = (voSig && (voSig.params.find((x) => x.name === srcField) || {}).type) || null;
  if (!srcT) return expr;
  const idish = (t) => t === 'Id' || String(t).startsWith('Id');
  const listOf = (t) => { const m = /^List\[(.+)\]$/.exec(String(t).trim()); return m ? m[1].trim() : null; };
  const pElem = listOf(paramT); const sElem = listOf(srcT);
  if (pElem && sElem) {
    if (idish(pElem) && !idish(sElem)) return `${expr}.map(Id.of)`;
    if (!idish(pElem) && idish(sElem)) return `${expr}.map(_.toString)`;
    return expr;
  }
  if (idish(paramT) && !idish(srcT)) return `Id.of(${expr})`;
  if (!idish(paramT) && idish(srcT)) return `${expr}.toString`;
  return expr;
};

// policiesModel — one aggregate's policy face. `paramSigs` = parseRuleParamsSigs over the
// aggregate's rendered RuleParams content (the source reads that file off disk).
export function policiesModel(a, env, paramSigs) {
  const voByName = new Map((env.voSigs ?? []).map((v) => [v.name, v]));
  const { defaultLiteral, literalFor } = makeLiterals(voByName);
  const agg = a.name;
  const objects = [];
  const specTests = [];
  const evtImports = new Set();
  const paramsImports = new Set();
  // 规格哨兵里默认构造到的 VO——须补 values 包 import（2026-09-22 实证）。
  const voImports = new Set();
  const skipped = [];
  const cmdByName = new Map((a.commands ?? []).map((c) => [c.name, c]));

  for (const p of a.policies ?? []) {
    if (!p.evtHostAgg || !p.evtPayloads) { skipped.push(`${p.name}（事件签名未解析）`); continue; }
    const evtFieldTypes = new Map(p.evtPayloads);
    const ownCmd = cmdByName.get(p.cmdName);
    const fields = ownCmd ? new Map((ownCmd.parameters ?? []).map((x) => [x.name, x.dataType || 'String'])) : null;
    if (!fields) { skipped.push(`${p.name}（命令参数未解析）`); continue; }
    // 参数序＋类型以 RuleParams 实际签名为权威（fieldTree 序≠Params 序·S2-46 编译红实证）；
    // 事件载荷实型以 Entity 签名为权威（推导映射 ≡ 骨架生成器渲染映射）。
    const sig = paramSigs?.get(`${p.cmdName}Params`) ?? null;
    const evtSig = deriveEvtSig(p.evtPayloads);
    // 扇出元素 VO 名（Entity 签名 List[X] → X）：`item.<字段>` 的类型包装与过滤谓词的 item 类型都取它。
    const rawFan = p.fanOutOn ? p.fanOutOn.split('.').pop() : null;
    const evtFanT = (rawFan && evtSig.get(rawFan)) || '';
    const fanElemM = /^List\[(.+)\]$/.exec(String(evtFanT).trim());
    const elemVoName = fanElemM ? fanElemM[1].trim() : null;
    const fieldNames = sig ? sig.map((s) => s.name) : [...fields.keys()];
    const args = [];
    let unresolvable = false;
    for (const f of fieldNames) {
      const decl = p.bindings[f];
      let expr = decl !== undefined ? bindingExpr(decl) : null;
      // E101 扩展槽：未绑定但有声明默认值（扩展槽 = List.empty 族）→ 按默认值字面量发射。
      if (expr === null && sig) {
        const fd = sig.find((s) => s.name === f);
        if (fd && fd.hasDefault) expr = fd.defaultValue;
      }
      if (expr === null) { unresolvable = true; break; }
      // canonical 参数 dataType 已归一为 `string (uuid)`（源判 /\(UUID\)/）——大小写不敏感等价
      const paramT = sig ? (sig.find((s) => s.name === f) || {}).type : (/\(uuid\)/i.test(String(fields.get(f))) ? 'Id' : 'String');
      const evtT = evtSig.get(f) ?? null; // null＝非同名载荷/未知——直传由调用方类型定
      if (expr !== 'item' && /^e\./.test(expr)) {
        if (paramT === 'Id' && evtT && evtT !== 'Id' && !evtT.startsWith('Id')) expr = `Id.of(${expr})`;
        else if (paramT !== 'Id' && evtT && (evtT === 'Id' || evtT.startsWith('Id'))) expr = `${expr}.toString`;
      } else if (String(decl || '').startsWith('item.')) {
        expr = wrapItemExpr(expr, decl, paramT, elemVoName, voByName);
      }
      args.push({ field: f, expr, type: paramT });
    }
    if (unresolvable) { skipped.push(`${p.name}（绑定声明不可翻译：${JSON.stringify(p.bindings)}）`); continue; }
    evtImports.add(`net.imadz.metarch.domain.entities.${p.evtHostAgg}Entity.${p.evtName}`);
    paramsImports.add(`net.imadz.metarch.domain.invariant.params.${agg}RuleParams._`);
    const paramsCtor = (itemExpr) => `${p.cmdName}Params(${args.map((x) => x.expr === 'item' ? itemExpr : x.expr).join(', ')})`;
    const fanField = p.fanOutOn ? scalaRef(p.fanOutOn.split('.').pop()) : null;
    // fanOut item 包装（S2-46 签名驱动·UUID 统一 Id 纪律）：String 元素 → Id 参数才包 Id.of。
    let itemExpr = 'item';
    if (p.fanOutOn) {
      const itemArg = args.find((x) => x.expr === 'item');
      if (itemArg && elemVoName && elemVoName !== 'Id' && !elemVoName.startsWith('Id') && (itemArg.type === 'Id' || String(itemArg.type).startsWith('Id'))) itemExpr = 'Id.of(item)';
    }
    // 扇出过滤（info.fanOutWhere）→ `e.<field>.filter(item => <cond>).map(...)`。谓词用既有
    // 表达式词法（emitWhen.cond 同构·exprToScala 复用不新造）。
    let fanFilter = null;
    if (p.fanOutWhere) {
      if (!p.fanOutOn) throw new Error(`[FATAL] ${p.name}：声明了 fanOutWhere 却无 fanOutOn——过滤无对象可作用`);
      const ftr = exprToScala(p.fanOutWhere, {
        stateFields: new Set(), stateTypes: {}, paramFields: new Set(), paramTypes: {},
        aggName: null, cmdName: null, itemType: elemVoName, voByName,
      });
      if (!ftr || !ftr.cond) throw new Error(`[FATAL] ${p.name}：fanOutWhere 不可翻译（${JSON.stringify(p.fanOutWhere)}）——宁红勿猜·请用 patch_core machineSpec.expression 词法`);
      fanFilter = ftr.cond;
    }
    const fanChain = fanFilter ? `e.${fanField}.filter(item => ${fanFilter})` : `e.${fanField}`;
    const body = p.fanOutOn
      ? `    ${fanChain}.map(item => ${paramsCtor(itemExpr)})`
      : `    List(${paramsCtor()})`;
    objects.push(`
  /** ${p.name}：on(${p.evtName}) => emit(${p.cmdName})（真源 info.bindings·声明即权威） */
  object ${'PolicyOn' + p.cmdName} {
    val policyName = "${'PolicyOn' + p.cmdName}"
    val description = ${JSON.stringify(p.description || '')}
    val idempotencyKey = ${JSON.stringify(p.idempotencyKey || 'command-level')}

    def on(e: ${p.evtName}): List[${p.cmdName}Params] =
${body}
  }
`);
    // —— 过滤哨兵：带 fanOutWhere 的扇出必须用**差异化**元素 ——
    //   从谓词反推「满足 / 不满足」两份字段赋值：只支持 eq/notEmpty（及 and/or 合取）——
    //   其余形态 FATAL 宁红勿猜（宁可要作者简化谓词，也不要一个恒真的假测试）。
    const filterSentinel = (predicate) => {
      const eqs = [];
      const notEmpties = [];
      const walk = (e) => {
        if (!e || typeof e !== 'object') throw new Error(`[FATAL] fanOutWhere 元素不可解析：${JSON.stringify(e)}`);
        const [k, v] = Object.entries(e)[0];
        if (k === 'eq' && Array.isArray(v) && v[0] && typeof v[0].var === 'string' && v[0].var.startsWith('item.')) {
          eqs.push({ field: v[0].var.slice(5), rhs: v[1] });
        } else if (k === 'notEmpty' && v && typeof v.var === 'string' && v.var.startsWith('item.')) {
          // 集合非空谓词：List 的「非空/空」天然差异化（literalFor 把 [{}] 展开成 List(VO(默认…))、
          // [] 落成 Nil）。size/forall 等仍 FATAL 宁红勿猜。
          notEmpties.push({ field: v.var.slice(5) });
        } else if (k === 'and' && Array.isArray(v)) { v.forEach(walk); }
        else if (k === 'or' && Array.isArray(v)) {
          // 六路 or 谓词：sat＝全 notEmpty 非空＋eq 全满足；unsat＝eq 破坏位（__other__）短路整个
          // and。纯 or-of-notEmpty 时 unsat＝全空表。两态皆成立，同 and 递归。
          v.forEach(walk);
        }
        else throw new Error(`[FATAL] fanOutWhere 形态「${k}」不支持差异化哨兵——请用 eq/notEmpty（或 and/or 合取）`);
      };
      walk(predicate);
      if (!eqs.length && !notEmpties.length) throw new Error('[FATAL] fanOutWhere 未引用 item.<字段>——无法构造差异化哨兵');
      const sat = {}; const unsat = {};
      for (const { field, rhs } of eqs) {
        sat[field] = rhs;
        unsat[field] = typeof rhs === 'string' ? `${rhs}__other__`
          : typeof rhs === 'boolean' ? !rhs : Number(rhs) + 1;
      }
      for (const { field } of notEmpties) { sat[field] = [{}]; unsat[field] = []; }
      return { sat, unsat };
    };
    // 扇出元素里被策略体用 `Id.of(...)` 包过的字段 → 哨兵必须给**可解析的 UUID 串**（中性默认
    // String→"" 会在 on() 里炸 Invalid UUID string——ConceptDelta.contextId 实证）。
    const elemIdWrapped = {};
    if (elemVoName) {
      for (const x of args) {
        const e1 = /^Id\.of\(item\.([A-Za-z]\w*)\)$/.exec(String(x.expr));
        if (e1) { elemIdWrapped[e1[1]] = 'scalar'; continue; }
        const e2 = /^item\.([A-Za-z]\w*)\.map\(Id\.of\)$/.exec(String(x.expr));
        if (e2) elemIdWrapped[e2[1]] = 'list';
      }
    }
    const SENTINEL_UUID = '00000000-0000-0000-0000-000000000001';
    // 谓词字段优先（差异化的那一位不能被 UUID 覆盖——否则 A/B 两个元素又变成同值）
    const withIdSafe = (o) => {
      const out = { ...o };
      for (const [f, kind] of Object.entries(elemIdWrapped)) {
        if (f in out) continue;
        out[f] = kind === 'list' ? [SENTINEL_UUID] : SENTINEL_UUID;
      }
      return out;
    };
    let fanListLit = null;
    if (p.fanOutOn && fanFilter) {
      if (!elemVoName || !voByName.has(elemVoName)) {
        throw new Error(`[FATAL] ${p.name}：fanOutWhere 的扇出元素「${elemVoName}」非 VO 签名——无法构造差异化哨兵`);
      }
      const { sat, unsat } = filterSentinel(p.fanOutWhere);
      const vA = literalFor(withIdSafe(sat), elemVoName);
      const vB = literalFor(withIdSafe(unsat), elemVoName);
      for (const nm of voByName.keys()) {
        if (vA.includes(`${nm}(`) || vB.includes(`${nm}(`)) voImports.add(nm);
      }
      fanListLit = `List(${vA}, ${vB})`;
    }
    // 纯测试：构造最小事件（字段类型感知字面量——按 Entity 签名惯例：*Id/UUID→Id.of·String→"system"·
    // Instant→now·List→双元素哨兵）。正则判**原始 ②层 dataType**（String (UUID) 等源形）。
    const evFields = [...evtFieldTypes.keys()];
    const evLit = (f) => {
      const t = String(evtFieldTypes.get(f) || 'String').trim();
      if (/^Option\[/.test(t)) {
        const inner = t.slice(7, -1).trim();
        if (/UUID/.test(inner) || /Id$/.test(f)) return 'Some(Id.of("00000000-0000-0000-0000-000000000001"))';
        if (/String/.test(inner)) return 'Some("system")';
        if (/Integer|^Int$/.test(inner)) return 'Some(1)';
        if (/Instant/.test(inner)) return 'Some(java.time.Instant.now())';
        return 'None';
      }
      if (/^List</.test(t)) {
        const elem = t.slice(5, -1).trim();
        if (/UUID/.test(elem)) return 'List(Id.of("00000000-0000-0000-0000-000000000001"), Id.of("00000000-0000-0000-0000-000000000002"))';
        // VO 元素（如 List<ConceptDelta>）：走 VO 默认构造（宁缺勿造·硬造必编译红）。
        // 正则判原始形 List<…>，VO 注册表按元素名查（canonical valueObjectSigs 同名）。
        if (voByName.has(elem)) {
          const v = defaultLiteral(elem);
          for (const nm of voByName.keys()) if (v.includes(`${nm}(`)) voImports.add(nm);
          return `List(${v}, ${v})`;
        }
        // String 元素族但下游 Id.of(item)（fanOut 语义）→ 合法 UUID 字符串
        return 'List("00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002")';
      }
      if (/UUID/.test(t) || /Id$/.test(f)) return 'Id.of("00000000-0000-0000-0000-000000000001")';
      if (/String/.test(t)) return '"system"';
      if (/Integer|^Int$/.test(t)) return '1';
      if (/Instant/.test(t)) return 'java.time.Instant.now()';
      // VO 载荷：null 哨兵——policy 测试只覆盖 bindings 消费面（宁缺勿造）。
      return 'null';
    };
    const evArgs = evFields.map(evLit);
    // 带过滤的扇出：把扇出字段的哨兵换成**差异化双元素**（A 满足谓词 / B 不满足）。
    let fanExpect = null;
    if (fanListLit) {
      const pos = evFields.indexOf(rawFan);
      if (pos < 0) throw new Error(`[FATAL] ${p.name}：扇出字段 ${rawFan} 不在事件载荷中——无法替换哨兵`);
      evArgs[pos] = fanListLit;
      fanExpect = '1';
    }
    specTests.push(`    "${'PolicyOn' + p.cmdName} 反应" in {
      val results = ${agg}Policies.${'PolicyOn' + p.cmdName}.on(${p.evtName}(${evFields.map((f, i) => evArgs[i]).join(', ')}))
      results should not be empty
      results.size shouldBe ${fanExpect ?? (p.fanOutOn ? '2' : '1')} // ${fanListLit ? 'fanOutWhere 差异化哨兵：A 命中保留、B 滤除 → 1' : p.fanOutOn ? 'fanOut 集合默认字面量双元素（executable_cases 同构哨兵）' : '单元素（非扇出）'}
      results.foreach(p => p.triggeredBy should not be null)
    }
`);
  }
  return {
    header: env.headerPolicy,
    pkg: a.pkg ?? 'net.imadz',
    ctx: a.ctxPackage,
    agg,
    objects, // live `objects.join('\n')` — each entry opens with \n (two blank lines between objects)
    evtImports: [...evtImports],
    paramsImports: [...paramsImports],
    voImports: [...voImports],
    tests: specTests,
    skipped,
  };
}
