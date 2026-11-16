// literals.mjs — the Spec/Rules literal renderers, ported from rules_domain_gen lines 790-905.
// `voByName` is injected as a constructor parameter (Map VO-name → {params:[{name,type}]}): the
// source builds it by scanning the target repo's domain/values signatures; truthsrc receives it
// from the canonical's valueObjectSigs registry (Fork A — fixtures carry the raw inputs).
import crypto from 'node:crypto';
import { PLACEHOLDER } from './expr.mjs';

export function makeLiterals(voByName) {
  const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

  /** 确定性 name-based UUID（v3）：不同字符串 → 不同 UUID（Id 字段哨兵值映射，避免同值冲突） */
  function idFromString(s) {
    const h = crypto.createHash('md5').update(s).digest();
    h[6] = (h[6] & 0x0f) | 0x30;
    h[8] = (h[8] & 0x3f) | 0x80;
    const hex = [...h].map((x) => x.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function defaultLiteral(type) {
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
    if (voSig) {
      const args = voSig.params.map((p) => defaultLiteral(p.type)).join(', ');
      return `${t}(${args})`;
    }
    return 'null';
  }

  // Option[X] 交叉兜底的内型默认（零哨兵值——语义＝「未填」而非「填了占位」）
  function optionInnerDefault(inner) {
    const t = String(inner || 'String').trim();
    if (t === 'Id') return 'net.imadz.common.Id.of("00000000-0000-0000-0000-000000000000")';
    if (t === 'String') return '""';
    if (t === 'Boolean') return 'false';
    if (t === 'Int' || t === 'Integer') return '0';
    if (t === 'Long') return '0L';
    if (t === 'Double') return '0.0';
    if (t === 'BigDecimal') return 'BigDecimal(0)';
    if (t.startsWith('List[') || t === 'List') return 'Nil';
    return 'null';
  }

  /** 非空哨兵字面量（数组值给非 List 字段时：求值器「非空」语义 → 类型化非空值） */
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

  /**
   * domain 版字面量：null 保持 null（notNull 负例可触发）；占位 → 中性；数组给非 List 字段 →
   * 非空哨兵；Id 哨兵行需 net.imadz.common.Id.of 全限定（发射处 Id.of 已是 FQN 惯例）。
   */
  function literalFor(value, type) {
    const t = (type || 'String').trim();
    if (t.startsWith('Option[')) {
      const inner = t.slice(7, -1).trim();
      if (value === null || (typeof value === 'string' && PLACEHOLDER.has(value))) return 'None';
      return `Some(${literalFor(value, inner)})`;
    }
    if (value === null) {
      if (['Boolean', 'Int', 'Integer', 'Long', 'Double', 'BigDecimal'].includes(t)) return defaultLiteral(t);
      return 'null';
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return defaultLiteral(t);
      if (!(t.startsWith('List[') || t === 'List')) return nonNullLiteral(t);
      if (value.every((v) => PLACEHOLDER.has(String(v)))) return 'Nil';
      const elemType = t.startsWith('List[') ? t.slice(5, -1) : 'String';
      return 'List(' + value.map((v) => literalFor(v, elemType)).join(', ') + ')';
    }
    if (typeof value === 'boolean') return t === 'Boolean' ? String(value) : `"${value}"`;
    if (typeof value === 'number') return t === 'Int' || t === 'Integer' || t === 'Long' || t === 'Double' || t === 'BigDecimal' ? String(value) : `"${value}"`;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // 对象值（uniqueIn 元素等）：按 VO 签名字段顺序映射（字段缺失 → 类型默认）
      const voSig = voByName.get(t);
      if (voSig) {
        const args = voSig.params.map((p) => {
          const v = value[p.name];
          return v === undefined ? defaultLiteral(p.type) : literalFor(v, p.type);
        }).join(', ');
        return `${t}(${args})`;
      }
      return `"${JSON.stringify(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    const s = String(value);
    if (t.startsWith('List[') || t === 'List') {
      if (PLACEHOLDER.has(s)) return 'Nil';
      const elemType = t.startsWith('List[') ? t.slice(5, -1) : 'String';
      return `List(${literalFor(value, elemType)})`;
    }
    if (PLACEHOLDER.has(s)) return defaultLiteral(t);
    if (t === 'Id') {
      // refExists 负例哨兵（MISSING_REF/__OTHER__）→ null；非 UUID 哨兵 → 确定性 v3 UUID
      if (s === 'MISSING_REF' || s === '__OTHER__') return 'null';
      return UUID_RE.test(s) ? `net.imadz.common.Id.of("${s}")` : `net.imadz.common.Id.of("${idFromString(s)}")`;
    }
    if (t.includes('Instant')) return `Instant.parse("${s}")`;
    if (t === 'Int' || t === 'Integer') { const n = parseInt(s, 10); return Number.isNaN(n) ? '1' : String(n); }
    if (t === 'Boolean') return s === 'true' ? 'true' : 'false';
    if (t === 'BigDecimal') return `BigDecimal(${s})`;
    const voSig = voByName.get(t);
    if (voSig) {
      const args = voSig.params.map((p) => defaultLiteral(p.type)).join(', ');
      return `${t}(${args})`;
    }
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }

  return { UUID_RE, idFromString, defaultLiteral, optionInnerDefault, nonNullLiteral, literalFor };
}
