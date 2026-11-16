// eventhandler_face.mjs — the event-handler state-projection rewrite (V4-10), ported from the
// production rules_domain_gen per-aggregate pass (lines 2031-2665). Where the skeleton face
// emits an identity EventHandler, rules_domain_gen REWRITES the file with lineage-driven
// projections: ④-layer fold vocabulary (fn:/keep:/patch:/append:/concat:/remove:/upsert:/
// memberPatch:/memberRemove:/memberUpsert:/memberAppend:/memberReplace:/memberCut:) is
// declaration-authoritative, then writtenBy lineage (type-compat mapped), then the status
// transition heuristics, then audit-field stems, then same-name payload fallback, then the
// version leg; unmapped fields degrade to a `// 待审:` review line per case (never silently
// dropped). Inputs are the canonical's EH-face slots attached by tools/augment-rules-canonical.mjs
// (fieldMeta ← ①层 fields template; fnSpecs ← functions.yaml; eventCauses ← stage-02 payload).
//
// NOT ported (unexercised by the corpus, mechanically verified 2026-10-15: grep SURGERY-KEEP
// over live behaviors/ = 0 hits): the on-disk [SURGERY-KEEP] case-block probe — a target-tree
// read at generation time, meaningless in plan()'s target-free contract until a corpus case
// exists. The per-aggregate review checklist (story/eventhandler_review.md) is an audit
// side-artifact, not a compared code artifact.
import { scalaSig, sigOf } from './datatype.mjs';
import { parse as parseWrittenBy } from './writtenby.mjs';
import { scalaRef } from './rules.mjs';

function noteAnchor(noteId, elementHashes, indent = '') {
  if (!noteId) return '';
  const clean = String(noteId).replace(/["'\n\r]/g, '');
  const h = elementHashes?.[clean];
  return `${indent}// @knowledge ${clean}${h ? '@' + h : ''}\n`;
}

const byTraitFq = (x, y) => {
  const fx = `${x.fqPkg}.${x.trait}`, fy = `${y.fqPkg}.${y.trait}`;
  return fx < fy ? -1 : fx > fy ? 1 : 0;
};

export function eventHandlerRulesModel(a, env) {
  const agg = a.name;
  const fm = a.fieldMeta;
  if (!fm) return null; // source [SKIP-EH]: no template metadata → no EH file

  // State authority = the EMITTED state (same derivation as rules_face: nature-excluded,
  // dataType → scalaSig). Event signatures from the canonical (the signature source).
  const excludedNatures = new Set(env.excludedStateFieldNatures ?? []);
  const stateParams = (a.stateFields ?? [])
    .filter((f) => !(f.nature && excludedNatures.has(f.nature)))
    .map((f) => ({ name: f.name, type: scalaSig(f.dataType ?? 'String') }));
  const stateTypes = Object.fromEntries(stateParams.map((p) => [p.name, p.type]));
  const eventSigs = (a.events ?? []).map((e) => ({
    name: e.name,
    noteId: e.noteId ?? null,
    params: (e.payloads ?? []).map((p) => ({ name: p.name, type: sigOf(p) })),
  }));
  // kn-export parity: the source's ehIdField is the fieldTree identifier OBJECT (not the name) —
  // the `fname === ehIdField` guards compare by identity and never fire, and the leg-6
  // ehSysFields exemption therefore does NOT cover the aggregate id (catalogId stays in the
  // payload 未映射 review line). Mirror verbatim off the fieldMeta slice.
  const ehIdField = fm.identifier;
  const ehStateFields = fm.stateFields ?? [];
  const ehStatusEnum = fm.statusEnum ?? [];
  const ehMetaByName = new Map(ehStateFields.map((f) => [f.name, f]));
  const voFind = (name) => (env.voCatalog ?? []).find((v) => v.name === name);

  // ports: the EH face takes the FULL union (rules-expr refs ∪ fold refs) — same union as the
  // root-face commandHandler signature (source aggPortTraits); apply params are trait-FQ sorted,
  // bare-trait typed (the import face carries the FQs).
  const portUnion = new Map();
  for (const p of a.foldPorts ?? []) portUnion.set(`${p.fqPkg}.${p.trait}`, p);
  for (const p of a.ports ?? []) portUnion.set(`${p.fqPkg}.${p.trait}`, p);
  const portAll = [...portUnion.values()].sort(byTraitFq).filter((p) => p.member);

  // writtenBy lineage: evName -> [{stateField, evField}] (parse-skipped forms mirrored verbatim)
  const wbByEvent = new Map();
  for (const f of ehStateFields) {
    for (const wb of f.writtenBy ?? []) {
      const p = parseWrittenBy(wb);
      if (!p.ok) continue;                         // 语法非法·跳过（可解性门另拦）
      const ev = p.segments[0].name;
      const field = p.segments[1]?.name;
      if (!field) continue;                        // 整事件（单段）·无字段粒度·fold 不直赋
      // 深成员路径（X.vo.mem / X.a[].b）：值在实体折叠内·非事件直出 → 不生成直赋表达式
      if (p.kind === 'member' || p.kind === 'nested-list-member') continue;
      if (!wbByEvent.has(ev)) wbByEvent.set(ev, []);
      wbByEvent.get(ev).push({ stateField: f.name, evField: field });
    }
  }
  // event→event causal pairs (S7 #3): effect event name → [{cause, consistency}]
  const eventCauses = new Map();
  for (const cz of a.eventCauses ?? []) {
    if (!eventCauses.has(cz.effect)) eventCauses.set(cz.effect, []);
    eventCauses.get(cz.effect).push({ cause: cz.cause, consistency: cz.consistency });
  }
  const noteIdOf = new Map(eventSigs.map((e) => [`event:${e.name}`, e.noteId]));

  // 状态←事件类型兼容表达式：同型直赋；String←Id 加 toString；List[X]←X 单值包装 List(...)；其余 null（不兼容）
  const ehCompat = (st, et, evField) => {
    const baseSt = (st || '').replace(/^List\[/, '').replace(/\]$/, '').trim();
    const baseEt = (et || '').replace(/^List\[/, '').replace(/\]$/, '').trim();
    if (st === et) return `event.${scalaRef(evField)}`;
    if (st === 'String' && et === 'Id') return `event.${scalaRef(evField)}.toString`;
    if (st.startsWith('List[') && baseSt === et) return `List(event.${scalaRef(evField)})`;
    return null;
  };

  const ehBody = [];
  for (const evSig of eventSigs) {
    const evName = evSig.name;
    const evParams = new Map(evSig.params.map((p) => [p.name, p]));
    const assigns = []; // {stateField, expr, via}
    const todos = [];
    // 0. ④层 folds 累积词汇（S2-46 G-3）：声明即权威。fn: 具名动词（Function 表 callExpr·fail-closed）、
    //    keep: 首写生效、patch: 事件值优先、append/concat/remove/upsert 列表算子、member* 元素级算子——
    //    裸 `event.x` 形态不进本环（writtenBy 同名载荷路径承载·源侧同静默跳过）。
    {
      const foldDecl = (a.folds ?? []).find((f) => f.event === evName);
      if (foldDecl) {
        for (const [sfName, sRaw] of Object.entries(foldDecl.assignments || {})) {
          const s = String(sRaw);
          const st = stateTypes[sfName];
          // fn: 具名动词独立分支（先判·非 vocab 链）——fail-closed：无规格/参数不在事件载荷皆 TODO，不静默
          if (s.startsWith('fn:')) {
            const fnId = s.slice(3).trim();
            const spec = (a.fnSpecs ?? {})[fnId];
            if (!st) todos.push(`${sfName}（fn:${fnId}：状态字段不在 Entity 签名·无法投影）`);
            else if (!spec || !spec.callExpr) todos.push(`${sfName}（fn:${fnId}：函数表无此规格或无 callExpr）`);
            else {
              const missing = [];
              const args = (spec.inputs ?? []).map((i) => {
                const rawFrom = String(i.from || '').split(/[（(]/)[0].trim(); // 去中文括注（真源注释形）
                // state: 前缀＝从聚合 state 取。**冒号后取字段名**（不是 split('.')——state:stateHash
                // 无点号，split('.') 会留下带前缀的整串 → stateTypes 查不到 → 假 TODO）。
                const isStateSrc = rawFrom.startsWith('state:');
                const f = isStateSrc
                  ? rawFrom.slice('state:'.length).trim().split('.').pop()   // 兼容 state:field / state:a.b
                  : rawFrom.split('.').pop();                                 // 事件源：末段＝载荷字段名
                if (isStateSrc) {
                  if (!f || stateTypes[f] === undefined) { missing.push(`${f || String(i.name)}（state 无此字段）`); return null; }
                  return `state.${scalaRef(f)}`;
                }
                if (!f || !evParams.has(f)) { missing.push(f || String(i.name)); return null; }
                return `event.${scalaRef(f)}`;
              });
              if (missing.length) todos.push(`${sfName}（fn:${fnId}：参数 ${missing.join('/')} 取不到——折叠只能吃事件载荷与聚合 state）`);
              else {
                // 债④（闭包形）：callExpr 的 Access 门读值段翻成 apply 参数直引——
                //   `<FQ>Access.<member>.<method>(...)` → `<member>.<method>(...)`（EventHandler 带参重载捕获）
                let ce = spec.callExpr;
                for (const pb of portUnion.values()) {
                  if (!pb.accessObj) continue;
                  ce = ce.replaceAll(`${pb.fqPkg}.${pb.accessObj}.${pb.member}.`, `${pb.member}.`);
                }
                assigns.push({ stateField: sfName, expr: ce.replace('{args}', args.join(', ')), via: `fn:${fnId}（Function 表 callExpr·port 接收者）` });
              }
            }
            continue;
          }
          // keep: 保留动词（外部系统捕获幂等）：state 现值非空则保留，否则取原值声明。
          // 语义＝「首次写入生效、后续同键重写不覆盖」——与 upsert 的「全量替换」相对。
          if (s.startsWith('keep:')) {
            const inner = s.slice(5).trim();
            if (!st) { todos.push(`${sfName}（keep: 状态字段不在 Entity 签名）`); continue; }
            let newVal = null;
            if (inner === 'event.timestamp') newVal = 'event.timestamp';
            else if (inner.startsWith('event.')) { const f = inner.slice(6); if (!evParams.has(f)) { todos.push(`${sfName}（keep:event.${f} 载荷无此字段）`); continue; } newVal = `event.${scalaRef(f)}`; }
            else if (inner.startsWith('literal:')) newVal = JSON.stringify(inner.slice(8));
            else { todos.push(`${sfName}（keep: 形态未支持 ${inner}——仅 event.x / literal:X）`); continue; }
            const sRef = `state.${scalaRef(sfName)}`;
            // 非空判定按类型（S1 终形）：String/List → Option(x).exists(_.nonEmpty)；其余 → Option(x).isDefined
            const nonEmpty = (st === 'String' || /^List\[/.test(st))
              ? `Option(${sRef}).exists(_.nonEmpty)`
              : `Option(${sRef}).isDefined`;
            assigns.push({ stateField: sfName, expr: `(if (${nonEmpty}) ${sRef} else ${newVal})`, via: `④层fold keep:${inner}` });
            continue;
          }
          // patch:（判例#18 手补重放）：事件值在则取事件值，否则保 state 现值（部分更新语义·
          // 与 keep: 的「state 非空保 state」对偶）。
          if (s.startsWith('patch:')) {
            const inner = s.slice(6).trim();
            if (!st) { todos.push(`${sfName}（patch: 状态字段不在 Entity 签名）`); continue; }
            if (!inner.startsWith('event.')) { todos.push(`${sfName}（patch: 形态未支持 ${inner}——仅 event.x）`); continue; }
            const pf = inner.slice(6);
            if (!evParams.has(pf)) { todos.push(`${sfName}（patch:event.${pf} 载荷无此字段）`); continue; }
            const evT = String(evParams.get(pf).type || '');
            const evRef = `event.${scalaRef(pf)}`;
            const sRef = `state.${scalaRef(sfName)}`;
            const expr = /^Option\[/.test(evT)
              ? `${evRef}.getOrElse(${sRef})`
              : (/^List\[/.test(evT) || /^List\[/.test(st))
                ? `(if (Option(${evRef}).exists(_.nonEmpty)) ${evRef} else ${sRef})`
                : evRef;
            assigns.push({ stateField: sfName, expr, via: `④层fold patch:${inner}` });
            continue;
          }
          let ef = null;
          let kind = null;
          if (s.startsWith('append:')) { ef = s.slice(7).replace(/^event\./, ''); kind = 'append'; }
          else if (s.startsWith('concat:')) { ef = s.slice(7).replace(/^event\./, ''); kind = 'concat'; }
          else if (s.startsWith('remove:')) { ef = s.slice(7).replace(/^event\./, ''); kind = 'remove'; }
          else if (s.startsWith('upsert:')) { ef = s.slice(7).replace(/^event\./, ''); kind = 'upsert'; }
          // finer 成员算子（细化批三批）：在列表元素的某个成员上做增删改——
          //   `memberRemove:<listField>.<keyMember>` / `memberUpsert:<l>.<k>[.<m>]` /
          //   `memberAppend|memberReplace|memberCut:<l>.<k>.<v>` / `memberPatch:<l>.<k>.<srcVO>`
          //   （补丁语义：源 VO 成员有值才改写·缺省不动）。全族键成员名与载荷字段名同名。
          else if (s.startsWith('memberPatch:')) { kind = 'memberPatch'; ef = s.slice(12); }
          else if (s.startsWith('memberRemove:')) { kind = 'memberRemove'; ef = s.slice(13); }
          else if (s.startsWith('memberUpsert:')) { kind = 'memberUpsert'; ef = s.slice(13); }
          else if (s.startsWith('memberAppend:')) { kind = 'memberAppend'; ef = s.slice(13); }
          else if (s.startsWith('memberReplace:')) { kind = 'memberReplace'; ef = s.slice(13); }
          else if (s.startsWith('memberCut:')) { kind = 'memberCut'; ef = s.slice(10); }
          const isMemberOp = kind && kind.startsWith('member');
          const efHead = (ef && !isMemberOp) ? ef.split('.')[0] : null;
          if (ef && st && (isMemberOp || (efHead && evParams.has(efHead)))) {
            const et = efHead ? evParams.get(efHead).type : '';
            const stBase = st.replace(/^List\[/, '').replace(/\]$/, '').trim();
            const evRef = `event.${scalaRef(ef)}`;
            // 类型感知（S2-46 G-3b）：Id 载荷 → List[String] 累积须 toString（KP.sessionIds 教训）
            const val = (stBase === 'String' && (et === 'Id' || String(et).startsWith('Id'))) ? `${evRef}.toString` : evRef;
            // null 安全基底：首事件折叠在空状态上（List 字段可能为 null）
            const base = `Option(state.${scalaRef(sfName)}).getOrElse(Nil)`;
            let expr = null;
            if (kind === 'append') expr = `${base} :+ ${val}`;
            else if (kind === 'concat') expr = `${base} ++ ${val}`;
            else if (kind === 'remove') {
              // remove 值支持点分路径——`remove:event.a.b`（b 为 a 的嵌套成员）按路径取值过滤
              const pathExpr = ef.includes('.')
                ? `event.${ef.split('.').map(scalaRef).join('.')}`
                : val;
              expr = `${base}.filter(_ != ${pathExpr})`;
            }
            else if (kind === 'upsert') {
              // VO 定义（raw 目录·knVoFind 同源）：成员按名从事件参数取值
              const vo = voFind(stBase);
              const voFields = vo && Array.isArray(vo.fields) ? vo.fields : null;
              // 路径键 `upsert:event.<载荷字段>.<keyMember>[.<nestedMember>]` / 裸键（键＝VO 首成员）
              const keyParts = ef.split('.');
              const efNested = keyParts.length > 1;                    // 载荷字段 / VO成员 / [嵌套成员]
              const efHeadName = keyParts[0];
              const efKeyMember = keyParts[1];
              const efNestedMember = keyParts[2];
              if (!voFields || !voFields.length) {
                todos.push(`${sfName}（④层fold upsert：VO "${stBase}" 不在 tpl.valueObjects——无法构造）`);
              } else if (efNested) {
                const evHead = evParams.get(efHeadName);
                if (!evHead) {
                  todos.push(`${sfName}（④层fold upsert：路径键首段 ${efHeadName} 不在 ${evName} 载荷）`);
                } else if (!voFields.some((f) => f.name === efKeyMember)) {
                  todos.push(`${sfName}（④层fold upsert：键成员 ${efKeyMember} 不在 VO ${stBase}）`);
                } else {
                  const evHeadIsVo = evHead.type === stBase || `List[${evHead.type}]` === stBase;
                  const keyValExpr = (() => {
                    if (efNestedMember) {
                      // 键取自载荷嵌套 VO 成员（event.vo.nested）：键类型＝嵌套成员类型
                      const nestedVo = voFind(evHead.type);
                      const nf = nestedVo && (nestedVo.fields || []).find((f) => f.name === efNestedMember);
                      const isUuid = nf ? String(nf.dataType).includes('UUID') : false;
                      const raw = `event.${scalaRef(efHeadName)}.${scalaRef(efNestedMember)}`;
                      return isUuid ? `${raw}.toString` : raw;
                    }
                    // 路径键：键值＝载荷对象里那个成员（event.fieldSpec.fieldName）——不是载荷对象本身
                    const raw = `event.${scalaRef(efHeadName)}.${scalaRef(efKeyMember)}`;
                    // 键成员 String (UUID) 而载荷成员为 Id → toString（H027 同款对齐）
                    const kv = voFields.find((f) => f.name === efKeyMember);
                    return String(kv && kv.dataType || '').includes('UUID') ? `${raw}.toString` : raw;
                  })();
                  let ctor = null;
                  if (evHeadIsVo) {
                    ctor = `event.${scalaRef(efHeadName)}`;
                  } else {
                    // 现构：VO 各成员「载荷同名 ∪ 嵌套 VO 成员」取值
                    const refs = voFields.map((f) => {
                      if (f.name === efKeyMember && efNestedMember) return keyValExpr; // 键成员取自嵌套
                      const ep = evParams.get(f.name);
                      if (ep) {
                        const memberIsUuid = String(f.dataType || '').includes('UUID');
                        const paramIsId = ep.type === 'Id' || String(ep.type).startsWith('Id');
                        const r = `event.${scalaRef(f.name)}`;
                        return (!memberIsUuid && paramIsId) ? `${r}.toString` : r;
                      }
                      return null;
                    });
                    if (refs.includes(null)) {
                      todos.push(`${sfName}（④层fold upsert 路径键：VO ${stBase} 成员 ${voFields.map((f) => f.name).join('/')} 有不在 ${evName} 载荷且非嵌套键成员者——无法现构）`);
                    } else {
                      ctor = `${stBase}(${refs.join(', ')})`;
                    }
                  }
                  if (ctor) {
                    expr = `${base}.filterNot(x => x.${scalaRef(efKeyMember)} == ${keyValExpr}) :+ ${ctor}`;
                  }
                }
              } else if (voFields[0].name !== efHeadName) {
                todos.push(`${sfName}（④层fold upsert：key 事件字段 ${efHeadName} ≠ VO 首成员 ${voFields[0].name}——键契约不匹配）`);
              } else {
                const memberRefs = voFields.map((f) => {
                  const ep = evParams.get(f.name);
                  if (!ep) return null;
                  // 类型对齐（H027 契约）：VO 成员 'String (UUID)' 经 DataTypeMapper → Scala Id——
                  // 与 Id 载荷天然同型直传；仅「非 UUID 成员 × Id 载荷」须 .toString
                  const memberIsUuid = String(f.dataType || '').includes('UUID');
                  const paramIsId = ep.type === 'Id' || String(ep.type).startsWith('Id');
                  const r = `event.${scalaRef(f.name)}`;
                  return (!memberIsUuid && paramIsId) ? `${r}.toString` : r;
                });
                if (memberRefs.includes(null)) {
                  todos.push(`${sfName}（④层fold upsert：VO ${stBase} 成员 ${voFields.map((f) => f.name).join('/')} 不全在 ${evName} 载荷——无法构造）`);
                } else {
                  const keyMemberIsUuid = String(voFields[0].dataType || '').includes('UUID');
                  const keyVal = (!keyMemberIsUuid && (et === 'Id' || String(et).startsWith('Id')))
                    ? `${evRef}.toString` : evRef;
                  const ctor = `${stBase}(${memberRefs.join(', ')})`;
                  expr = `${base}.filterNot(x => x.${scalaRef(voFields[0].name)} == ${keyVal}) :+ ${ctor}`;
                }
              }
            }
            if (expr) assigns.push({ stateField: sfName, expr, via: `④层fold ${kind}` });
          }

            // ── finer 成员算子：键成员与载荷字段同名——语法 `member*:<listField>.<keyMember>[.<third>]`
            if (kind && kind.startsWith('member')) {
              let expr = null;                       // finer 块自持（通用块的 expr 已随其块闭合）
              const parts = ef.split('.');
              const [listF, keyM, third] = parts;
              const stBaseM = st.replace(/^List\[/, '').replace(/\]$/, '').trim();
              const voDef = voFind(stBaseM);
              const voFlds = voDef && Array.isArray(voDef.fields) ? voDef.fields : null;
              const baseM = `Option(state.${scalaRef(sfName)}).getOrElse(Nil)`;
              // 键源解析——两条互斥来源：
              //   ① memberPatch：键在**载荷携带的 VO 对象**里（语法第三段＝载荷成员名，VO 类型由
              //      该载荷的声明类型反查——两者不同名，knVoFind(third) 会查不到）。
              //   ② 其余算子：键＝**顶层同名载荷**。
              const srcFieldName = kind === 'memberPatch' ? third : null;
              const srcFieldParam = srcFieldName ? evParams.get(srcFieldName) : null;
              const srcVoName = srcFieldParam ? String(srcFieldParam.type || '').trim() : null;
              const srcVoDef = srcVoName ? voFind(srcVoName) : null;
              const srcVoFlds = srcVoDef && Array.isArray(srcVoDef.fields) ? srcVoDef.fields : null;
              let keyRef = null;
              if (kind === 'memberPatch') {
                if (!srcFieldParam) todos.push(`${sfName}（④层fold memberPatch：载荷无源对象 ${srcFieldName || '?'}——形态不完整（${ef}））`);
                else if (!srcVoFlds) todos.push(`${sfName}（④层fold memberPatch：源对象 ${srcFieldName} 的类型 ${srcVoName || '?'} 不在签名）`);
                else if (!srcVoFlds.some((f) => f.name === keyM)) todos.push(`${sfName}（④层fold memberPatch：键成员 ${keyM} 不在源 VO ${srcVoName}）`);
                else keyRef = `event.${scalaRef(srcFieldName)}.${scalaRef(keyM)}`;
              } else if (evParams.has(keyM)) {
                keyRef = `event.${scalaRef(keyM)}`;
              } else {
                todos.push(`${sfName}（④层fold ${kind}：键载荷 ${keyM} 不在 ${evName} 载荷——键成员须与载荷字段同名）`);
              }
              if (!listF || !keyM || !voFlds) {
                todos.push(`${sfName}（④层fold ${kind}：形态不完整（${ef}）或 VO ${stBaseM} 不在签名）`);
              } else if (keyRef) {
                const keyParam = evParams.get(keyM);
                const keyMemberDef = voFlds.find((f) => f.name === keyM);
                const keyUuid = String(keyMemberDef && keyMemberDef.dataType || '').includes('UUID');
                const keyParamIsId = keyParam ? (keyParam.type === 'Id' || String(keyParam.type).startsWith('Id')) : false;
                const keyValM = (keyUuid && keyParamIsId) ? `${keyRef}.toString` : keyRef;
                if (kind === 'memberPatch') {
                  // 补丁改写：按同名成员逐位改写——源 VO 成员为 Option/List ⇒ 有值才动（getOrElse / 空表保现值），
                  // 非 Option 的成员（键本身·必填项）不参与改写。元素不存在 ⇒ map 空转＝不动。
                  // ⚠️ 括号形态陷阱：raw 目录字段用 `List<...>`／`Option<...>` 尖括号，Entity 签名用
                  //    方括号——本块读 raw 目录 ⇒ 两种都认。copy(...) 里是具名参数（左值＝成员名）。
                  const copies = [];
                  for (const f of voFlds) {
                    if (f.name === keyM) continue;                      // 键不改写
                    const sf = srcVoFlds.find((g) => g.name === f.name);
                    if (!sf) continue;                                   // 源 VO 无此成员 ⇒ 不可改
                    const isOpt = sf.optional === true || /^Option[<\[]/.test(String(sf.dataType || '').trim());
                    const isList = /^List[<\[]/.test(String(sf.dataType || '').trim());
                    if (!isOpt && !isList) continue;
                    const member = scalaRef(f.name);
                    const curRef = `x.${member}`;
                    const srcRef = `event.${scalaRef(srcFieldName)}.${scalaRef(f.name)}`;
                    copies.push(isOpt && !isList
                      ? `${member} = ${srcRef}.getOrElse(${curRef})`
                      : `${member} = (if (${srcRef}.isEmpty) ${curRef} else ${srcRef})`);
                  }
                  if (!copies.length) {
                    todos.push(`${sfName}（④层fold memberPatch：源 VO ${srcVoName} 与 ${stBaseM} 无可改写的同名 Option 成员——无法构造）`);
                  } else {
                    expr = `${baseM}.map(x => if (x.${scalaRef(keyM)} == ${keyValM}) x.copy(${copies.join(', ')}) else x)`;
                  }
                } else if (kind === 'memberRemove') {
                  expr = `${baseM}.filterNot(x => x.${scalaRef(keyM)} == ${keyValM})`;
                } else if (kind === 'memberUpsert' && !third) {
                  // 单段语法：把**载荷对象**追加/替换进键成员为 List[VO] 的元素成员里（paramSpec/payloadSpec 惯例）
                  const listMemberDef = voFlds.find((f) => /^List\[/.test(String(f.dataType || '')));
                  const pObjKey = evParams.has('paramSpec') ? 'paramSpec' : evParams.has('payloadSpec') ? 'payloadSpec' : null;
                  if (!listMemberDef || !pObjKey) {
                    todos.push(`${sfName}（④层fold memberUpsert 单段：VO ${stBaseM} 无 List 成员或载荷无 paramSpec/payloadSpec）`);
                  } else {
                    const innerOld = `Option(x.${scalaRef(listMemberDef.name)}).getOrElse(Nil)`;
                    const upd = `x.copy(${scalaRef(listMemberDef.name)} = ${innerOld} :+ event.${scalaRef(pObjKey)})`;
                    expr = `${baseM}.map(x => if (x.${scalaRef(keyM)} == ${keyValM}) ${upd} else x)`;
                  }
                } else if (kind === 'memberUpsert') {
                  // 三段语法：把载荷对象追加进该 List[VO] 成员；成员名同名载荷优先（向后兼容）
                  const listMemberDef2 = voFlds.find((f) => f.name === third);
                  const pObjKey2 = evParams.has(third) ? third
                    : evParams.has('paramSpec') ? 'paramSpec'
                    : evParams.has('payloadSpec') ? 'payloadSpec' : null;
                  if (!listMemberDef2 || !pObjKey2) {
                    todos.push(`${sfName}（④层fold memberUpsert：成员 ${third} 不在 VO ${stBaseM} 或载荷无 ${third}/paramSpec/payloadSpec）`);
                  } else {
                    const innerOld2 = `Option(x.${scalaRef(third)}).getOrElse(Nil)`;
                    const upd2 = `x.copy(${scalaRef(third)} = ${innerOld2} :+ event.${scalaRef(pObjKey2)})`;
                    expr = `${baseM}.map(x => if (x.${scalaRef(keyM)} == ${keyValM}) ${upd2} else x)`;
                  }
                } else {
                  // memberAppend / memberReplace / memberCut：更新既有元素内的 **List 型成员**（third）
                  const vMemberDef = third ? voFlds.find((f) => f.name === third) : null;
                  const vParam = third ? evParams.get(third) : null;
                  if (!third || !vMemberDef || !vParam) {
                    todos.push(`${sfName}（④层fold ${kind}：值成员/载荷 ${third || '?'} 缺失）`);
                  } else {
                    // 值表达式按**成员类型 × 载荷类型**对齐（以成员类型为准——载荷 List 标注少数失真）
                    const vVal = `event.${scalaRef(third)}`;
                    const innerOld = `Option(x.${scalaRef(third)}).getOrElse(Nil)`;
                    const vIsList = /^List\[/.test(String(vMemberDef.dataType || ''));
                    const pIsList = /^List\[/.test(String(vParam.type || ''));
                    const inner = kind === 'memberAppend'
                      ? (vIsList && pIsList ? `${innerOld} ++ ${vVal}` : `${innerOld} :+ ${vVal}`)
                      : kind === 'memberReplace'
                        ? (vIsList ? (pIsList ? vVal : `List(${vVal})`) : vVal)
                        : `${innerOld}.filterNot(_ == ${vVal})`;
                    const upd = `x.copy(${scalaRef(third)} = ${inner})`;
                    expr = `${baseM}.map(x => if (x.${scalaRef(keyM)} == ${keyValM}) ${upd} else x)`;
                  }
                }
              }
              // finer 算子自 push（外层 push 在 block 之前已执行·此处错过）
              if (expr) assigns.push({ stateField: sfName, expr, via: `④层fold ${kind}` });
            }
          }
        }
      }
      // 1. writtenBy 显式映射（血缘权威）
      for (const { stateField, evField } of wbByEvent.get(evName) || []) {
        const st = stateTypes[stateField];
        if (stateField === ehIdField) { continue; }
        if (assigns.some((x) => x.stateField === stateField)) continue; // ④层累积声明优先
        if (!st) {
          // ①层 writtenBy 引用 Entity 签名外字段（VO.Member 平铺残留）——无法投影·如实 TODO
          todos.push(`${stateField}：writtenBy ${evName}.${evField} 字段不在 Entity 签名（①层 VO.Member 残留·无法投影）`);
          continue;
        }
        if (evParams.has(evField)) {
          const et = evParams.get(evField).type;
          const expr = ehCompat(st, et, evField);
          if (expr) assigns.push({ stateField, expr, via: `writtenBy ${evName}.${evField}` });
          else todos.push(`${stateField}（writtenBy ${evName}.${evField} 类型不兼容 ${st}←${et}）`);
        } else {
          todos.push(`${stateField}（writtenBy ${evName}.${evField} 事件字段不存在）`);
        }
      }
      // 2. status 流转（STATE_TRANSITION）：显式裁决表 > 词干匹配枚举（endsWith）> 创建恢复类 → 激活态首值；
      //    null 裁决 = 明确不变（静默不写）；无裁决且无法判定 → TODO
      if (ehStatusEnum.length && stateTypes.status !== undefined && !assigns.some((x) => x.stateField === 'status')) {
        const overrideVal = fm.statusTransitions ? fm.statusTransitions[evName] : undefined;
        const bare = evName.replace(new RegExp('^' + agg), '');
        const stem = bare.replace(/(Created|Updated|Changed|Occurred)$/, '');
        const activeKinds = new Set(['Created', 'Onboarded', 'Registered', 'Resumed', 'Reactivated', 'Restored', 'Captured', 'Activated', 'Established', 'Accepted', 'Joined']);
        let statusVal = null;
        let statusVia = '';
        if (overrideVal !== undefined) {
          if (overrideVal !== null) { statusVal = overrideVal; statusVia = 'status 显式裁决（statusTransitions）'; }
          // null → 明确不变：不写也不 TODO
        } else {
          const direct = ehStatusEnum.find((v) => {
            const n = v.replace(/_/g, '').toLowerCase();
            const sx = stem.toLowerCase();
            return sx === n || sx.endsWith(n); // 词干可能带业务前缀（CatalogConflictDetected → conflictdetected）
          });
          if (direct) { statusVal = direct; statusVia = `status 词干匹配（${stem} → ${direct}）`; }
          else if (activeKinds.has(bare) || activeKinds.has(stem)) { statusVal = ehStatusEnum[0]; statusVia = `status 激活态（枚举首值 ${ehStatusEnum[0]}，${bare}）`; }
        }
        if (statusVal !== null && statusVal !== undefined) {
          // 终态单向防御：④层 terminalStates 声明级属性——历史事件重放不得把终态翻回。
          // statusVal 本身即终态时不包（幂等）。
          const bmTerm = a.terminalStates;
          const wrapped = Array.isArray(bmTerm) && bmTerm.length > 0 && !bmTerm.includes(statusVal);
          const statusExpr = wrapped
            ? `if (Set(${bmTerm.map((t) => `"${t}"`).join(', ')}).contains(state.status)) state.status else "${statusVal}"`
            : `"${statusVal}"`;
          assigns.push({ stateField: 'status', expr: statusExpr, via: statusVia + (wrapped ? '＋终态单向防御' : '') });
        }
        else if (overrideVal === undefined) todos.push(`status（${evName} → 枚举值无法判定）`);
      }
      // 3. 审计字段（SYSTEM_INJECTED）：同名载荷 > 词干专属（Archived→archivedAt）> 创建类 createdAt/By > 更新类 modifiedAt/By
      const ehStem = evName.replace(new RegExp('^' + agg), '').replace(/(Created|Updated|Changed|Occurred)$/, '');
      const ehStemField = ehStem.charAt(0).toLowerCase() + ehStem.slice(1);
      const ehCreateStems = new Set(['Created', 'Onboarded', 'Registered', 'Captured', 'Raised', 'Started', 'Accepted', 'Joined']);
      const ehUpdateStems = new Set(['Updated', 'Changed', 'Modified', 'Edited', 'Patched', 'Resolved', 'Released', 'Concluded', 'Submitted', 'Rejected', 'Approved', 'Blocked', 'Classified', 'Assigned', 'Evaluated', 'Answered', 'Completed', 'Scheduled', 'Published', 'Saved', 'Requested', 'Detected', 'Reactivated', 'Deleted', 'Skipped', 'Activated', 'Invited', 'Merged', 'Removed', 'Unparked', 'Deprecated', 'Established', 'Suspended', 'Resumed', 'Archived']);
      const ehIsCreate = ehCreateStems.has(ehStem);
      const ehIsUpdate = ehUpdateStems.has(ehStem);
      for (const f of ehStateFields) {
        const fname = f.name;
        const st = stateTypes[fname];
        if (fname === ehIdField || !st) continue;
        if (assigns.some((x) => x.stateField === fname)) continue;
        const atKind = /At$/.test(fname) && (st.startsWith('Instant') || st.endsWith('Instant'));
        const byKind = /By$/.test(fname) && st === 'String';
        if (!atKind && !byKind) continue;
        let via = null;
        let expr = null;
        if (evParams.has(fname)) { via = `审计同名载荷（${fname}）`; expr = ehCompat(st, evParams.get(fname).type, fname); if (!expr) { via = null; todos.push(`${fname}（审计同名载荷类型不兼容）`); } }
        else if (atKind && evParams.has('timestamp') && fname === `${ehStemField}At`) { via = `审计时间（词干专属 ${ehStemField}At）`; expr = 'event.timestamp'; }
        else if (byKind && evParams.has('triggeredBy') && fname === `${ehStemField}By`) { via = `审计操作人（词干专属 ${ehStemField}By）`; expr = 'event.triggeredBy'; }
        else if (atKind && evParams.has('timestamp') && fname === 'createdAt' && ehIsCreate) { via = '审计时间（创建类事件 timestamp → createdAt）'; expr = 'event.timestamp'; }
        else if (byKind && evParams.has('triggeredBy') && fname === 'createdBy' && ehIsCreate) { via = '审计操作人（创建类事件 triggeredBy → createdBy）'; expr = 'event.triggeredBy'; }
        else if (atKind && evParams.has('timestamp') && fname === 'modifiedAt' && ehIsUpdate) { via = '审计时间（更新类事件 timestamp → modifiedAt）'; expr = 'event.timestamp'; }
        else if (byKind && evParams.has('triggeredBy') && fname === 'modifiedBy' && ehIsUpdate) { via = '审计操作人（更新类事件 triggeredBy → modifiedBy）'; expr = 'event.triggeredBy'; }
        if (via) assigns.push({ stateField: fname, expr, via });
        else todos.push(`${fname}（审计字段，本事件无同名载荷/词干专属/创建更新类）`);
      }
      // 4. 同名载荷退化（schema 默认：无 writtenBy 的 PROPAGATED 等 → 事件载荷同名映射）
      for (const f of ehStateFields) {
        const fname = f.name;
        const st = stateTypes[fname];
        if (fname === ehIdField || !st) continue;
        if (assigns.some((x) => x.stateField === fname)) continue;
        if (/At$|By$/.test(fname)) continue; // 审计字段已处理
        const metaF = ehMetaByName.get(fname);
        if (metaF && (metaF.origin === 'DERIVED')) { todos.push(`${fname}（DERIVED：${metaF.derivation || '无公式'}）`); continue; }
        if (evParams.has(fname)) {
          const expr = ehCompat(st, evParams.get(fname).type, fname);
          if (expr) assigns.push({ stateField: fname, expr, via: '同名载荷退化（schema 默认）' });
          else todos.push(`${fname}（同名载荷类型不兼容）`);
        }
      }
      // 5. 版本字段（newVersion → version）
      if (stateTypes.version !== undefined && evParams.has('newVersion') && !assigns.some((x) => x.stateField === 'version')) {
        assigns.push({ stateField: 'version', expr: 'event.newVersion', via: '版本字段（newVersion → version）' });
      }
      // 6. payload 未映射 hint（审校线索：载荷字段未进入任何状态映射）
      const ehSysFields = new Set(['timestamp', 'triggeredBy', 'lastVersion', 'newVersion', ehIdField]);
      const unusedPayload = evSig.params.map((p) => p.name).filter((n) => !ehSysFields.has(n) && !assigns.some((x) => x.expr.endsWith('.' + n)));
      if (unusedPayload.length) todos.push(`payload 未映射: ${unusedPayload.join(', ')}`);
      // 组装 case
      const assignsStr = assigns.map((x) => `${scalaRef(x.stateField)} = ${x.expr}`).join(', ');
      ehBody.push(`${noteAnchor(noteIdOf.get(`event:${evName}`), env.elementHashes, '    ')}    case event: ${evName} =>`);
      // S7 #3：事件因果溯源注释——本 case 处理的事件由哪些事件引发（stage 02 @strong/@eventual）。
      //   落点＝被引发事件的处理器 case 块；不发 @knowledge 号（causedBy 是 event→event，发自身号
      //   会自环路假锚）。行首 `//` ⇒ 锚解析跳行 ⇒ 零图边、零锚位扰动。
      for (const cz of eventCauses.get(evName) || []) {
        ehBody.push(`      // 因果溯源: ${cz.cause}（${cz.consistency}）⇒ 本事件`);
      }
      if (assignsStr) ehBody.push(`      state.copy(${assignsStr})`);
      else ehBody.push(`      state // TODO: ${evName} 无确定映射（${todos.join('；') || '状态不变'}）`);
      if (todos.length) {
        ehBody.push(`      // 待审: ${todos.join('；')}`);
      }
      ehBody.push('');
    }
    // event imports in Entity (canonical) declaration order; fold upsert/memberUpsert VO imports
    // deduped in declaration order (source Set semantics)
    const ehImports = eventSigs.map((e) => `import net.imadz.metarch.domain.entities.${agg}Entity.${e.name}`).join('\n');
    const voImports = [...new Set(
      (a.folds ?? []).flatMap((f) => Object.entries(f.assignments ?? {}))
        .filter(([, v]) => { const s = String(v); return s.startsWith('upsert:') || s.startsWith('memberUpsert:'); })
        .map(([sf]) => (stateTypes[sf] || '').replace(/^List\[/, '').replace(/\]$/, '').trim())
    )].filter((v) => v && voFind(v))
      .map((v) => `import net.imadz.metarch.domain.values.${v}`).join('\n');
    const portTraitFqs = portAll.map((p) => `${p.fqPkg}.${p.trait}`);
    const portMembers = portAll.map((p) => p.member);
    return {
      agg,
      header: env.header,
      ehImports,
      voImports,
      portTraitFqs,
      portMembers,
      portParams: portAll.map((p) => `${p.member}: ${p.trait}`),
      requireLines: portMembers.map((mem) => `    require(${mem} != null, "${mem} 未绑定");`),
      body: ehBody,
      noteIds: [...new Set(eventSigs.map((e) => e.noteId).filter(Boolean))],
      causedBy: [...new Set(eventSigs.flatMap((e) => (eventCauses.get(e.name) || [])
        .map(() => e.noteId).filter(Boolean)))],
    };
}
