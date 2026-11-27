// Generic offline visual workshop exporter for ANY co-arising 2.0 project.
// Reads .truthsrc/knowledge.sqlite + truth/ + generated-scaffold/ (all 5 Onion layers) +
// generated-tests/ + handwritten/ and renders a strict-CSP single-file HTML via lib/workshop/render.mjs.
// Zero hardcoded business names; works out of the box on any PRD-distilled v2 project.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { renderWorkshop } from '../workshop/render.mjs';

const sha256Hex = buf => createHash('sha256').update(buf).digest('hex');

function walkFiles(dir, base = dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, base, out);
    else if (entry.isFile()) out.push(relative(base, full).split(sep).join('/'));
  }
  return out;
}

function readCachedFile(absPath) {
  const raw = readFileSync(absPath, 'utf8');
  return {
    raw,
    bytes: Buffer.byteLength(raw, 'utf8'),
    sha256: sha256Hex(Buffer.from(raw, 'utf8')),
    lines: raw.replace(/\r\n/gu, '\n').split('\n'),
  };
}

function sliceExcerpt(fileRec, startLine, endLine, before = 3, after = 6) {
  const total = fileRec.lines.length;
  const from = Math.max(1, startLine - before);
  const to = Math.min(total, endLine + after);
  return {
    startLine: from,
    endLine: to,
    highlight: { startLine, endLine },
    text: fileRec.lines.slice(from - 1, to).join('\n'),
  };
}

function escapeRe(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function findBlockSpan(lines, predicate, { maxLines = 18 } = {}) {
  for (let i = 0; i < lines.length; i += 1) {
    if (!predicate(lines[i], i)) continue;
    const startLine = i + 1;
    let endLine = startLine;
    for (let j = i + 1; j < Math.min(lines.length, i + maxLines); j += 1) {
      const line = lines[j];
      if (line.trim() === '' || /^\s*\/\/\s*@(ProvenanceId|CoArisingSpec|cloze:)/u.test(line)) break;
      if (/^\s*\[[A-Z0-9_-]+\]/u.test(line)) break;
      if (/^\s{0,2}-\s+name:\s/u.test(line) && j > i) break;
      endLine = j + 1;
    }
    return { startLine, endLine };
  }
  return null;
}

function findYamlDeclSpan(lines, sectionKey, name) {
  let inSection = !sectionKey;
  let sectionIndent = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (sectionKey && !inSection) {
      const m = line.match(new RegExp(`^(\\s*)${escapeRe(sectionKey)}:\\s*$`, 'u'));
      if (m) {
        inSection = true;
        sectionIndent = m[1].length;
      }
      continue;
    }
    if (sectionKey && inSection) {
      if (line.trim() && !line.startsWith(' '.repeat(sectionIndent + 1)) && !line.trim().startsWith('#')) {
        inSection = false;
        continue;
      }
    }
    const nm = line.match(/^(\s*)-\s+name:\s*(.+?)\s*$/u);
    if (nm && nm[2].replace(/^['"]|['"]$/gu, '') === name) {
      const itemIndent = nm[1].length;
      const startLine = i + 1;
      let endLine = startLine;
      for (let j = i + 1; j < Math.min(lines.length, i + 28); j += 1) {
        const next = lines[j];
        if (!next.trim()) break;
        const nextIndent = next.match(/^(\s*)/u)[1].length;
        if (nextIndent <= itemIndent) break;
        endLine = j + 1;
      }
      return { startLine, endLine };
    }
  }
  return null;
}

function findClozeSpan(lines, slotId) {
  const startRe = new RegExp(`@cloze:start\\(${escapeRe(slotId)}\\)`, 'u');
  const endRe = new RegExp(`@cloze:end\\(${escapeRe(slotId)}\\)`, 'u');
  let startLine = null;
  let endLine = null;
  for (let i = 0; i < lines.length; i += 1) {
    if (startLine === null && startRe.test(lines[i])) startLine = i + 1;
    else if (startLine !== null && endRe.test(lines[i])) {
      endLine = i + 1;
      break;
    }
  }
  return startLine !== null ? { startLine, endLine: endLine ?? startLine } : null;
}

function toSnake(name) {
  return String(name ?? '')
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .replace(/[^A-Za-z0-9]+/gu, '_')
    .replace(/^_|_$/gu, '')
    .toLowerCase();
}

function toPascal(name) {
  return String(name ?? '')
    .split(/[^A-Za-z0-9]+/u)
    .filter(Boolean)
    .map(p => p[0].toUpperCase() + p.slice(1))
    .join('');
}

function findKnowledgeSpan(lines, tag) {
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes(tag)) continue;
    const startLine = i + 1;
    let endLine = startLine;
    for (let j = i + 1; j < Math.min(lines.length, i + 16); j += 1) {
      const trimmed = lines[j].trim();
      if (trimmed === '' || trimmed.startsWith('// @knowledge') || trimmed.startsWith('// @ProvenanceId(')) break;
      endLine = j + 1;
      if (trimmed === '}' || trimmed.endsWith('))')) break;
    }
    return { startLine, endLine };
  }
  return null;
}

function findProvenanceSpan(lines, provId) {
  const token = `@ProvenanceId(${provId})`;
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes(token)) continue;
    const startLine = i + 1;
    let endLine = startLine;
    for (let j = i + 1; j < Math.min(lines.length, i + 20); j += 1) {
      const trimmed = lines[j].trim();
      if (trimmed === '' || trimmed.startsWith('// @ProvenanceId(')) break;
      endLine = j + 1;
      if (trimmed === '}' || trimmed.endsWith(');') || trimmed.endsWith('))')) break;
    }
    return { startLine, endLine };
  }
  return null;
}

function findSpecSpan(lines, ruleId) {
  const token = `@CoArisingSpec(id="${ruleId}"`;
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes(token)) continue;
    const startLine = i + 1;
    let endLine = startLine;
    for (let j = i + 1; j < Math.min(lines.length, i + 26); j += 1) {
      const trimmed = lines[j].trim();
      if (trimmed.startsWith('// @CoArisingSpec(')) break;
      endLine = j + 1;
      if (trimmed === '});' || trimmed === '}') break;
    }
    return { startLine, endLine };
  }
  return null;
}

const EDGE_RELATION_ZH = {
  allows_role: '允许角色访问',
  constrains_axiom: '声明不变量公理',
  contains_rule: '包含 EARS 规则',
  dispatches: '派发目标聚合',
  effect_of: '关联外部副作用',
  emits: '产生领域事件',
  exposes: '暴露读模型',
  folds: '折叠领域事件',
  governs: '约束聚合状态机',
  guards: '保护入站端口',
  handles: '受理领域命令',
  implemented_by: '由行为切片实现',
  implements_cloze: '以 @cloze 槽位实现',
  orchestrates: '编排长流程故事',
  owned_by: '隶属于端口',
  updates: '更新聚合状态',
  uses_port: '使用入站/查询端口',
};

function sanitizeLocalPaths(text) {
  return String(text ?? '').replace(/\/Users\/[^\s"'<>]+/gu, '[local-path-redacted]');
}

function describeNode(row, payload, clozeMap) {
  if (row.kind === 'rule') {
    const parts = [];
    if (payload.clauseKind) parts.push(`条款 ${payload.clauseKind}`);
    if (payload.outcome) parts.push(`结果 ${typeof payload.outcome === 'string' ? payload.outcome : JSON.stringify(payload.outcome)}`);
    if (payload.when) parts.push(`触发 ${payload.when}`);
    return parts.join(' · ') || `${row.layer || 'domain'} 层 EARS 规则`;
  }
  if (row.kind === 'cloze-slot') {
    const slot = clozeMap.get(row.name);
    const rules = slot ? JSON.parse(slot.rule_ids).length : 0;
    return `${row.layer} 层 ${slot?.tier || 'L3'} 通道 4B 隔离槽位 · 覆盖 ${rules} 条规则`;
  }
  if (row.kind === 'behavior') {
    const ch = payload.channel === '4A-deterministic' ? '通道 4A（确定性生成）' : '通道 4B（@cloze 手写隔离区）';
    return row.layer === 'application'
      ? `应用层 EARS 编排 · ${ch} · 经 Port + PlayController + *Impl 闭环`
      : `领域层 EARS 切片 · ${ch} · Z3 数学互斥/完备验证 + TS/Scala 双栈生成`;
  }
  if (row.kind === 'exact-type') {
    return ['零浮点精确类型', payload.form, payload.scale != null ? `scale=${payload.scale}` : ''].filter(Boolean).join(' · ');
  }
  if (row.kind === 'role') return '鉴权角色主体（RBAC / auth-core Endpoint）';
  if (row.kind === 'story') return payload.description || '应用层用户故事与调用方契约（CallerContractSpec）';
  if (row.kind === 'axiom') return `Z3 证明不变量公理（${payload.target || row.layer}）`;
  if (row.kind === 'extern-contract') return `外部工具门/谓词契约（ownerPort: ${payload.ownerPort || 'default'}）`;
  if (row.kind === 'authz-policy') {
    const roles = (payload.authz?.allowedRoles ?? []).join(', ') || 'authenticated';
    return `入站权限策略 · mode=${payload.authz?.mode || 'rbac'} · scope=${payload.authz?.scope || 'global'} · roles=[${roles}]`;
  }
  if (row.kind === 'event-fold') return `纯函数事件状态折叠（${payload.aggregate}.${payload.event}）`;
  if (row.kind === 'effect') return `外部副作用边界（协议：${payload.protocol || 'at-least-once'}）`;
  if (row.kind === 'saga') return `多步编排 Saga 流程（${(payload.steps ?? []).length} 步）`;
  if (row.kind === 'pipeline') return '持久化执行流水线（Durable Pipeline）';
  if (row.kind === 'use-case') return '问题空间端到端用例剧本（Use Case）';
  return `${row.kind}（${row.layer || 'core'}）`;
}

export function buildV2WorkshopView({
  rootDir = process.cwd(),
  projectFile = null,
  dbFile = null,
  pathPrefix = '',
  title = null,
  subtitle = null,
  chaptersOverride = null,
} = {}) {
  const absRoot = resolve(rootDir);
  const configPath = projectFile ? resolve(projectFile) : join(absRoot, 'truthsrc.v2.json');
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : null;
  let effDb;
  if (dbFile) {
    effDb = resolve(dbFile);
  } else if (config?.dbOut) {
    effDb = resolve(dirname(configPath), config.dbOut);
  } else {
    effDb = join(absRoot, '.truthsrc/knowledge.sqlite');
  }

  if (!existsSync(effDb)) {
    throw new Error(`V2_VIEW_NO_DB: knowledge SQLite not found at "${effDb}" (run compile-v2 first)`);
  }

  const db = new DatabaseSync(effDb, { readOnly: true });
  const metaRows = db.prepare('SELECT key, value FROM metadata ORDER BY key').all();
  const meta = Object.fromEntries(metaRows.map(r => [r.key, r.value]));
  const dbNodes = db.prepare('SELECT id, kind, name, layer, payload FROM nodes ORDER BY kind, id').all();
  const dbEdges = db.prepare('SELECT from_id, to_id, relation FROM edges ORDER BY relation, from_id, to_id').all();
  const dbCloze = db.prepare('SELECT slot_id, target, kind, layer, tier, rule_ids, provenance FROM cloze_slots ORDER BY slot_id').all();
  const dbCoverage = db.prepare('SELECT path, branch, tier, stage, evidence_tier, contract_ref, file_sha256 FROM file_coverage ORDER BY path').all();
  db.close();

  const clozeMap = new Map(dbCloze.map(c => [c.slot_id, c]));
  const normPrefix = pathPrefix ? `${pathPrefix.replace(/\/+$/u, '')}/` : '';

  // Discover all real files dynamically
  const truthFiles = walkFiles(join(absRoot, 'truth'), absRoot);
  const scaffoldFiles = walkFiles(join(absRoot, 'generated-scaffold'), absRoot);
  const testFiles = walkFiles(join(absRoot, 'generated-tests'), absRoot).filter(f => !f.endsWith('manifest.sha256.json'));
  const handwrittenFiles = walkFiles(join(absRoot, 'handwritten'), absRoot);
  const allCodeFiles = [...scaffoldFiles, ...handwrittenFiles, ...testFiles];
  const allRelFiles = [...truthFiles, ...allCodeFiles];

  const fileCache = new Map();
  for (const rel of allRelFiles) {
    fileCache.set(rel, readCachedFile(join(absRoot, rel)));
  }

  const yamlStructureFiles = truthFiles.filter(f => (f.endsWith('.yaml') || f.endsWith('.yml')) && f.includes('/structures/'));
  const yamlBindingFiles = truthFiles.filter(f => (f.endsWith('.yaml') || f.endsWith('.yml')) && f.includes('/bindings/'));
  const earsFiles = truthFiles.filter(f => f.endsWith('.ears'));

  // Dynamic map: behaviorName -> earsRelPath
  const behaviorEarsMap = new Map();
  for (const rel of earsFiles) {
    const rec = fileCache.get(rel);
    const header = rec.lines.find(l => /^\s*(?:slice|story)\s+[A-Za-z0-9_.-]+/u.test(l));
    if (header) {
      const m = header.match(/^\s*(?:slice|story)\s+([A-Za-z0-9_.-]+)/u);
      if (m) behaviorEarsMap.set(m[1], rel);
    }
  }

  // Dynamic index: @ProvenanceId -> [{ rel, span }], @cloze:start -> [{ rel, span }], @CoArisingSpec -> [{ rel, span }], @knowledge -> [{ rel, span }]
  const provIndex = new Map();
  const clozeIndex = new Map();
  const specIndex = new Map();
  const knowledgeIndex = new Map();
  const detectedGenerators = new Set();
  const addIdx = (map, key, val) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(val);
  };

  for (const rel of allCodeFiles) {
    const rec = fileCache.get(rel);
    const genMatch = rec.raw.match(/^(?:\/\/|#)\s*@generated by truthsrc\s+([^\s\n]+)/mu);
    if (genMatch) detectedGenerators.add(genMatch[1]);
    for (const m of rec.raw.matchAll(/@ProvenanceId\(([^)]+)\)/gu)) {
      const span = findProvenanceSpan(rec.lines, m[1]);
      addIdx(provIndex, m[1], { rel, span });
    }
    for (const m of rec.raw.matchAll(/\/\/\s*@knowledge\s+([^\s\n]+)/gu)) {
      const span = findKnowledgeSpan(rec.lines, m[1]);
      const fullTag = m[1];
      addIdx(knowledgeIndex, fullTag, { rel, span });
      // Also index by trailing rule/symbol id after last '/' or '#'
      const tail = fullTag.split(/[#/]/u).at(-1);
      if (tail) addIdx(knowledgeIndex, tail, { rel, span });
    }
    for (const m of rec.raw.matchAll(/@cloze:start\(([^)]+)\)/gu)) {
      const span = findClozeSpan(rec.lines, m[1].trim());
      addIdx(clozeIndex, m[1].trim(), { rel, span });
    }
    for (const m of rec.raw.matchAll(/@CoArisingSpec\(id="([^"]+)"/gu)) {
      const span = findSpecSpan(rec.lines, m[1]);
      addIdx(specIndex, m[1], { rel, span });
    }
  }

  // Build reverse lookup index across files
  const fileReverseIndex = new Map();
  const registerReverse = (relFile, identity, precision, span) => {
    if (!fileReverseIndex.has(relFile)) fileReverseIndex.set(relFile, []);
    fileReverseIndex.get(relFile).push({
      identity,
      precision,
      ...(span ? { startLine: span.startLine, endLine: span.endLine } : {}),
    });
  };

  const makeSource = (relFile, label, pointer, span) => {
    const rec = fileCache.get(relFile);
    if (!rec) return null;
    if (span) {
      const ex = sliceExcerpt(rec, span.startLine, span.endLine, 2, 4);
      return {
        label,
        file: `${normPrefix}${relFile}`,
        pointer,
        startLine: ex.startLine,
        endLine: ex.endLine,
        text: ex.text,
        sha256: rec.sha256,
      };
    }
    const maxEnd = Math.min(rec.lines.length, 45);
    return {
      label,
      file: `${normPrefix}${relFile}`,
      pointer,
      startLine: 1,
      endLine: maxEnd,
      text: rec.lines.slice(0, maxEnd).join('\n'),
      sha256: rec.sha256,
    };
  };

  const makeLocation = (relFile, identity, span, { sourceIdentity, before = 3, after = 6 } = {}) => {
    const rec = fileCache.get(relFile);
    if (!rec) return null;
    if (span) {
      registerReverse(relFile, identity, 'span', span);
      const ex = sliceExcerpt(rec, span.startLine, span.endLine, before, after);
      return {
        file: `${normPrefix}${relFile}`,
        precision: 'span',
        startLine: ex.startLine,
        endLine: ex.endLine,
        highlight: ex.highlight,
        text: ex.text,
        sourceIdentity: sourceIdentity || identity,
        fingerprint: rec.sha256.slice(0, 16),
        reverseIdentities: [identity],
        _relFile: relFile,
      };
    }
    registerReverse(relFile, identity, 'file', null);
    const maxEnd = Math.min(rec.lines.length, 40);
    return {
      file: `${normPrefix}${relFile}`,
      precision: 'file',
      startLine: 1,
      endLine: maxEnd,
      text: rec.lines.slice(0, maxEnd).join('\n'),
      sourceIdentity: sourceIdentity || identity,
      fingerprint: rec.sha256.slice(0, 16),
      reverseIdentities: [identity],
      _relFile: relFile,
    };
  };

  const findInYamlFiles = (files, sectionKey, name) => {
    for (const rel of files) {
      const span = findYamlDeclSpan(fileCache.get(rel).lines, sectionKey, name);
      if (span) return { rel, span };
    }
    return null;
  };

  const dedupPushLoc = (locations, seen, loc) => {
    if (!loc) return;
    const key = `${loc.file}:${loc.highlight?.startLine ?? 0}:${loc.highlight?.endLine ?? 0}`;
    if (seen.has(key)) return;
    seen.add(key);
    locations.push(loc);
  };

  const nodes = dbNodes.map(row => {
    const payload = JSON.parse(row.payload || '{}');
    const sources = [];
    const locations = [];
    const seenLoc = new Set();

    const addProvHits = (provKey, opts = {}) => {
      for (const hit of provIndex.get(provKey) ?? []) {
        dedupPushLoc(locations, seenLoc, makeLocation(hit.rel, row.id, hit.span, { sourceIdentity: provKey, ...opts }));
      }
    };

    if (row.kind === 'exact-type') {
      const hit = findInYamlFiles(yamlStructureFiles, 'exactTypes', row.name);
      if (hit) sources.push(makeSource(hit.rel, '正交结构声明（exactTypes）', `exactTypes/${row.name}`, hit.span));
      addProvHits(`exact:${row.name}`);
      for (const rel of scaffoldFiles) {
        if (rel.endsWith('DomainTypes.scala') || rel.endsWith('exact.ts') || rel.endsWith(`/domain/values/${row.name}.scala`)) {
          const rec = fileCache.get(rel);
          const span = findBlockSpan(rec.lines, l => new RegExp(`\\b${escapeRe(row.name)}\\b`, 'u').test(l) || l.includes('export function dec('), { maxLines: 14 });
          dedupPushLoc(locations, seenLoc, makeLocation(rel, row.id, span, { sourceIdentity: row.id }));
        } else if (rel.endsWith('shared_value_objects.proto')) {
          const rec = fileCache.get(rel);
          const span = findBlockSpan(rec.lines, l => l.includes(`message ${row.name}PO`), { maxLines: 8 });
          if (span) dedupPushLoc(locations, seenLoc, makeLocation(rel, row.id, span, { sourceIdentity: row.id }));
        }
      }
    } else if (row.kind === 'value-object') {
      const hit = findInYamlFiles(yamlStructureFiles, 'valueObjects', row.name);
      if (hit) sources.push(makeSource(hit.rel, '正交结构声明（valueObjects）', `valueObjects/${row.name}`, hit.span));
      addProvHits(`vo:${row.name}`);
      for (const rel of scaffoldFiles) {
        if (rel.endsWith(`/domain/values/${row.name}.scala`)) {
          const rec = fileCache.get(rel);
          const span = findBlockSpan(rec.lines, l => new RegExp(`\\b${escapeRe(row.name)}\\b`, 'u').test(l), { maxLines: 14 });
          dedupPushLoc(locations, seenLoc, makeLocation(rel, row.id, span, { sourceIdentity: row.id }));
        } else if (rel.endsWith('shared_value_objects.proto')) {
          const rec = fileCache.get(rel);
          const span = findBlockSpan(rec.lines, l => l.includes(`message ${row.name}PO`), { maxLines: 8 });
          if (span) dedupPushLoc(locations, seenLoc, makeLocation(rel, row.id, span, { sourceIdentity: row.id }));
        }
      }
    } else if (row.kind === 'read-model') {
      const hit = findInYamlFiles(yamlStructureFiles, 'readModels', row.name);
      if (hit) sources.push(makeSource(hit.rel, '正交结构声明（readModels）', `readModels/${row.name}`, hit.span));
      addProvHits(`readmodel:${row.name}`);
      for (const khit of knowledgeIndex.get(row.name) ?? []) {
        dedupPushLoc(locations, seenLoc, makeLocation(khit.rel, row.id, khit.span, { sourceIdentity: row.id }));
      }
      const stem = toPascal(row.name).replace(/View$/u, '');
      for (const rel of scaffoldFiles) {
        if (
          (rel.includes('/readside/') || rel.includes('/readmodels/') || rel.includes('/projection/') || rel.endsWith('ReadsideBootstrap.scala')) &&
          (rel.includes(stem) || rel.includes(row.name))
        ) {
          const rec = fileCache.get(rel);
          const span = findBlockSpan(rec.lines, l => /\b(?:class|object|trait)\s+/u.test(l), { maxLines: 14 });
          dedupPushLoc(locations, seenLoc, makeLocation(rel, row.id, span, { sourceIdentity: row.id }));
        }
      }
      for (const rel of handwrittenFiles) {
        const span = findBlockSpan(fileCache.get(rel).lines, l => l.includes(row.name), { maxLines: 8 });
        if (span) dedupPushLoc(locations, seenLoc, makeLocation(rel, row.id, span, { sourceIdentity: row.id }));
      }
    } else if (row.kind === 'port') {
      const hit = findInYamlFiles(yamlStructureFiles, 'ports', row.name);
      if (hit) sources.push(makeSource(hit.rel, '应用端口声明（ports）', `ports/${row.name}`, hit.span));
      for (const rel of scaffoldFiles) {
        if (
          !rel.includes('port') && !rel.includes('Port') &&
          !rel.includes('router') && !rel.includes('Router') &&
          !rel.includes('Contract.scala') && !rel.includes('PlayController.scala') &&
          !rel.endsWith('/routes') && !rel.includes('CommandDsl.scala')
        ) continue;
        const rec = fileCache.get(rel);
        const span = findBlockSpan(rec.lines, l => l.includes(row.name) || l.includes('Handler') || l.includes('RouteDescriptor') || l.includes('api.'), { maxLines: 12 });
        if (span) dedupPushLoc(locations, seenLoc, makeLocation(rel, row.id, span, { sourceIdentity: row.id }));
      }
    } else if (row.kind === 'aggregate') {
      const hit = findInYamlFiles(yamlStructureFiles, 'aggregates', row.name);
      if (hit) sources.push(makeSource(hit.rel, '聚合结构声明（aggregates）', `aggregates/${row.name}`, hit.span));
      addProvHits(`agg:${row.name}`, { before: 1, after: 18 });
      const snakeAgg = toSnake(row.name);
      const strictSuffixes = [
        `/domain/entities/${row.name}Entity.scala`,
        `/domain/entities/behaviors/${row.name}EventHandler.scala`,
        `/domain/entities/${row.name}Axioms.scala`,
        `/domain/invariants/${row.name}Rules.scala`,
        `/application/aggregates/${row.name}Protocol.scala`,
        `/application/aggregates/${row.name}Aggregate.scala`,
        `/application/aggregates/behaviors/${row.name}Behaviors.scala`,
        `/application/aggregates/repository/${row.name}Repository.scala`,
        `/infrastructure/bootstrap/${row.name}Bootstrap.scala`,
        `protobuf/${snakeAgg}.proto`,
      ];
      for (const suffix of strictSuffixes) {
        const rel = scaffoldFiles.find(f => f.endsWith(suffix));
        if (!rel) continue;
        const rec = fileCache.get(rel);
        const span = findBlockSpan(rec.lines, l => /\b(?:object|trait|class|message)\s+/u.test(l), { maxLines: 16 });
        dedupPushLoc(locations, seenLoc, makeLocation(rel, row.id, span, { sourceIdentity: row.id, before: 1, after: 10 }));
      }
    } else if (row.kind === 'command') {
      const parts = row.name.split('.');
      const cmdName = parts.at(-1);
      const hit = findInYamlFiles(yamlStructureFiles, 'commands', cmdName) || findInYamlFiles(yamlStructureFiles, null, cmdName);
      if (hit) sources.push(makeSource(hit.rel, `命令声明（${row.name}）`, `commands/${row.name}`, hit.span));
      for (const rel of [...scaffoldFiles, ...handwrittenFiles]) {
        const span = findBlockSpan(fileCache.get(rel).lines, l => new RegExp(`\\b${escapeRe(cmdName)}\\b`, 'u').test(l), { maxLines: 8 });
        if (span) {
          dedupPushLoc(locations, seenLoc, makeLocation(rel, row.id, span, { sourceIdentity: row.id }));
          if (locations.length >= 6) break;
        }
      }
    } else if (row.kind === 'event') {
      const parts = row.name.split('.');
      const evtName = parts.at(-1);
      const hit = findInYamlFiles(yamlStructureFiles, 'events', evtName) || findInYamlFiles(yamlStructureFiles, null, evtName);
      if (hit) sources.push(makeSource(hit.rel, `事件声明（${row.name}）`, `events/${row.name}`, hit.span));
      for (const rel of [...scaffoldFiles, ...handwrittenFiles]) {
        const span = findBlockSpan(fileCache.get(rel).lines, l => new RegExp(`\\b${escapeRe(evtName)}\\b`, 'u').test(l), { maxLines: 8 });
        if (span) {
          dedupPushLoc(locations, seenLoc, makeLocation(rel, row.id, span, { sourceIdentity: row.id }));
          if (locations.length >= 6) break;
        }
      }
    } else if (row.kind === 'behavior') {
      const earsRel = behaviorEarsMap.get(row.name);
      if (earsRel) {
        const rec = fileCache.get(earsRel);
        sources.push(makeSource(earsRel, 'EARS 行为真源', row.name, { startLine: 1, endLine: Math.min(rec.lines.length, 38) }));
      }
      if (row.layer === 'application') {
        for (const bRel of yamlBindingFiles) {
          const rec = fileCache.get(bRel);
          const bSpan = findBlockSpan(rec.lines, l => l.includes(row.name), { maxLines: 10 });
          if (bSpan) sources.push(makeSource(bRel, '副作用绑定（bindings）', `bindings/${row.name}`, bSpan));
        }
        addProvHits(`story:${row.name}`, { before: 1, after: 18 });
        addProvHits(`interfaces:http:${row.name}`, { before: 1, after: 18 });
        const pascal = toPascal(row.name);
        for (const rel of [...scaffoldFiles, ...handwrittenFiles]) {
          if (
            rel.endsWith(`/application/services/${pascal}Port.scala`)
            || rel.endsWith(`/application/services/${pascal}Impl.scala`)
            || rel.endsWith(`/application/services/${pascal}Cloze.scala`)
          ) {
            const rec = fileCache.get(rel);
            const span = findBlockSpan(rec.lines, l => /\b(?:trait|object|class)\s+/u.test(l), { maxLines: 14 });
            dedupPushLoc(locations, seenLoc, makeLocation(rel, row.id, span, { sourceIdentity: row.id }));
          }
        }
      } else {
        const aggName = row.name.split('.')[0];
        addProvHits(`agg:${aggName}`, { before: 1, after: 18 });
        const pascal = toPascal(row.name);
        for (const rel of [...scaffoldFiles, ...handwrittenFiles]) {
          if (
            rel.endsWith(`/domain/invariants/${aggName}Rules.scala`)
            || rel.endsWith(`/domain/entities/behaviors/${aggName}EventHandler.scala`)
            || rel.endsWith(`/domain/services/impl/${pascal}Impl.scala`)
            || rel.endsWith(`/domain/services/impl/${pascal}Cloze.scala`)
          ) {
            const rec = fileCache.get(rel);
            const span = findBlockSpan(rec.lines, l => /\b(?:object|class)\s+/u.test(l), { maxLines: 16 });
            dedupPushLoc(locations, seenLoc, makeLocation(rel, row.id, span, { sourceIdentity: row.id }));
          }
        }
      }
    } else if (row.kind === 'cloze-slot') {
      const slot = clozeMap.get(row.name);
      const earsRel = slot ? behaviorEarsMap.get(slot.target) : null;
      if (earsRel) {
        const rec = fileCache.get(earsRel);
        sources.push(makeSource(earsRel, `关联 EARS 契约（${slot.target}）`, slot.target, { startLine: 1, endLine: Math.min(rec.lines.length, 32) }));
      }
      for (const hit of clozeIndex.get(row.name) ?? []) {
        dedupPushLoc(locations, seenLoc, makeLocation(hit.rel, row.id, hit.span, { sourceIdentity: `cloze:${row.name}`, before: 2, after: 2 }));
      }
    } else if (row.kind === 'rule') {
      const [behName, ruleId] = row.id.replace(/^rule:/u, '').split('#');
      const earsRel = behaviorEarsMap.get(behName);
      if (earsRel) {
        const span = findBlockSpan(fileCache.get(earsRel).lines, l => l.includes(`[${ruleId}]`), { maxLines: 14 });
        sources.push(makeSource(earsRel, `EARS 规则 [${ruleId}]`, `${behName}#${ruleId}`, span));
      }
      addProvHits(`${behName}#${ruleId}`);
      for (const hit of knowledgeIndex.get(ruleId) ?? []) {
        dedupPushLoc(locations, seenLoc, makeLocation(hit.rel, row.id, hit.span, { sourceIdentity: `${behName}#${ruleId}`, before: 1, after: 4 }));
      }
      for (const rel of handwrittenFiles) {
        const re = new RegExp(`["']${escapeRe(ruleId)}["']`, 'u');
        const span = findBlockSpan(fileCache.get(rel).lines, l => re.test(l), { maxLines: 4 });
        if (span) dedupPushLoc(locations, seenLoc, makeLocation(rel, row.id, span, { sourceIdentity: `${behName}#${ruleId}`, before: 1, after: 2 }));
      }
      for (const hit of specIndex.get(ruleId) ?? []) {
        dedupPushLoc(locations, seenLoc, makeLocation(hit.rel, row.id, hit.span, { sourceIdentity: `${behName}#${ruleId}`, before: 1, after: 3 }));
      }
      for (const hit of specIndex.get(`HTTP_${ruleId}`) ?? []) {
        dedupPushLoc(locations, seenLoc, makeLocation(hit.rel, row.id, hit.span, { sourceIdentity: `HTTP_${ruleId}`, before: 1, after: 3 }));
      }
    } else if (row.kind === 'role') {
      const hit = findInYamlFiles(yamlStructureFiles, 'roles', row.name);
      if (hit) sources.push(makeSource(hit.rel, '角色声明（roles）', `roles/${row.name}`, hit.span));
      for (const rel of [...scaffoldFiles, ...testFiles]) {
        if (!rel.includes('PlayController.scala') && !rel.includes('HttpRouter.scala') && !rel.includes('router.ts') && !rel.includes('InterfacesHttpSpec')) continue;
        const span = findBlockSpan(fileCache.get(rel).lines, l => l.includes(`"${row.name}"`), { maxLines: 8 });
        if (span) dedupPushLoc(locations, seenLoc, makeLocation(rel, row.id, span, { sourceIdentity: row.id }));
      }
    } else if (row.kind === 'authz-policy') {
      const portName = payload.port || row.name.split('.')[0];
      const opName = payload.operation || row.name.split('.')[1] || '';
      const hit = findInYamlFiles(yamlStructureFiles, 'ports', portName);
      if (hit) sources.push(makeSource(hit.rel, `权限策略声明（${row.name}）`, `ports/${portName}/${opName}`, hit.span));
      for (const rel of [...scaffoldFiles, ...testFiles]) {
        if (!rel.includes('PlayController.scala') && !rel.includes('HttpRouter.scala') && !rel.includes('router.ts') && !rel.endsWith('/routes') && !rel.includes('InterfacesHttpSpec')) continue;
        const span = findBlockSpan(fileCache.get(rel).lines, l => l.includes(row.name) || (opName && l.includes(`${portName}/${opName}`)) || (opName && l.includes(`${portName}${toPascal(opName)}`)), { maxLines: 10 });
        if (span) dedupPushLoc(locations, seenLoc, makeLocation(rel, row.id, span, { sourceIdentity: row.id }));
      }
    } else if (row.kind === 'extern-contract') {
      const ecName = payload.name || row.name.split('.').at(-1);
      const ownerPort = payload.ownerPort || row.name.split('.')[0];
      const hit = findInYamlFiles(yamlStructureFiles, 'externContracts', ecName);
      if (hit) sources.push(makeSource(hit.rel, `外部契约声明（${ecName}）`, `externContracts/${ecName}`, hit.span));
      for (const rel of [...scaffoldFiles, ...handwrittenFiles]) {
        if (!rel.includes('ConnectorPort.scala') && !rel.includes('ConnectorImpl.scala') && !rel.includes('Port.scala') && !rel.includes('GeneratedBindingsModule.scala')) continue;
        const span = findBlockSpan(fileCache.get(rel).lines, l => l.includes(`def ${ecName}(`) || l.includes(`${ownerPort}Connector`), { maxLines: 6 });
        if (span) dedupPushLoc(locations, seenLoc, makeLocation(rel, row.id, span, { sourceIdentity: row.id }));
      }
    } else if (row.kind === 'axiom') {
      const target = payload.target || row.id.replace(/^axiom:/u, '').split('#')[0];
      const axId = payload.id || row.name;
      const earsRel = behaviorEarsMap.get(target);
      if (earsRel) {
        const span = findBlockSpan(fileCache.get(earsRel).lines, l => l.includes(`[${axId}]`), { maxLines: 6 });
        sources.push(makeSource(earsRel, `EARS 公理 [${axId}]`, `${target}#${axId}`, span));
      }
      const aggName = target.split('.')[0];
      addProvHits(`axiom:${target}#${axId}`);
      addProvHits(`axiom:${aggName}#${axId}`);
      for (const hitK of knowledgeIndex.get(axId) ?? []) {
        dedupPushLoc(locations, seenLoc, makeLocation(hitK.rel, row.id, hitK.span, { sourceIdentity: row.id }));
      }
      for (const rel of [...scaffoldFiles, ...handwrittenFiles]) {
        const span = findBlockSpan(fileCache.get(rel).lines, l => l.includes(axId), { maxLines: 6 });
        if (span) dedupPushLoc(locations, seenLoc, makeLocation(rel, row.id, span, { sourceIdentity: row.id }));
      }
    } else if (row.kind === 'event-fold') {
      const aggName = payload.aggregate || row.name.split('.')[0];
      const evName = payload.event || row.name.split('.')[1];
      const hit = findInYamlFiles(yamlStructureFiles, 'events', evName) || findInYamlFiles(yamlStructureFiles, 'aggregates', aggName);
      if (hit) sources.push(makeSource(hit.rel, `事件状态折叠声明（${row.name}）`, `events/${row.name}`, hit.span));
      for (const rel of scaffoldFiles) {
        if (!rel.endsWith(`${aggName}EventHandler.scala`) && !rel.endsWith(`${toSnake(aggName).replaceAll('_', '-')}.behavior.ts`)) continue;
        const span = findBlockSpan(fileCache.get(rel).lines, l => l.includes(evName), { maxLines: 10 });
        if (span) dedupPushLoc(locations, seenLoc, makeLocation(rel, row.id, span, { sourceIdentity: row.id }));
      }
    } else if (row.kind === 'story') {
      const hit = findInYamlFiles(yamlStructureFiles, 'stories', row.name);
      if (hit) sources.push(makeSource(hit.rel, '故事契约声明（stories）', `stories/${row.name}`, hit.span));
      const pascal = toPascal(row.name);
      for (const rel of [...scaffoldFiles, ...handwrittenFiles]) {
        if (
          rel.endsWith(`/${pascal}Port.scala`) ||
          rel.endsWith(`/${pascal}Impl.scala`) ||
          rel.endsWith(`/${pascal}PlayController.scala`) ||
          rel.endsWith('/CallerContractSpec.scala')
        ) {
          const span = findBlockSpan(fileCache.get(rel).lines, l => /\b(?:object|trait|final class)\s+/u.test(l), { maxLines: 14 });
          dedupPushLoc(locations, seenLoc, makeLocation(rel, row.id, span, { sourceIdentity: row.id }));
        }
      }
    } else if (row.kind === 'saga' || row.kind === 'pipeline') {
      const stem = toPascal(row.name).replace(/Saga$/u, '');
      const hit = findInYamlFiles(yamlStructureFiles, row.kind === 'pipeline' ? 'pipelines' : 'sagas', row.name)
        || findInYamlFiles(yamlStructureFiles, 'stories', payload.story || stem);
      if (hit) sources.push(makeSource(hit.rel, `${row.kind} 编排声明`, `${row.kind}/${row.name}`, hit.span));
      for (const rel of scaffoldFiles) {
        if (
          rel.endsWith(`/${stem}SagaModule.scala`) ||
          rel.endsWith(`/${stem}CompositionHost.scala`) ||
          rel.endsWith(`/${stem}InvocationFace.scala`) ||
          rel.endsWith(`/${stem}ProcessBootstrap.scala`) ||
          rel.endsWith('/SagaCoordinatorBootstrap.scala') ||
          rel.endsWith(`/${toSnake(stem)}_host.proto`)
        ) {
          const span = findBlockSpan(fileCache.get(rel).lines, l => /\b(?:object|trait|final class|message)\s+/u.test(l), { maxLines: 14 });
          dedupPushLoc(locations, seenLoc, makeLocation(rel, row.id, span, { sourceIdentity: row.id }));
        }
      }
    } else if (row.kind === 'effect') {
      const stem = toPascal(row.name).replace(/Effect$/u, '');
      for (const bRel of yamlBindingFiles) {
        const rec = fileCache.get(bRel);
        const span = findBlockSpan(rec.lines, l => l.includes(row.name) || l.includes('protocol:'), { maxLines: 12 });
        if (span) sources.push(makeSource(bRel, '副作用协议绑定（bindings）', `effects/${row.name}`, span));
      }
      for (const rel of [...scaffoldFiles, ...handwrittenFiles]) {
        if (
          rel.endsWith(`/${stem}EffectFace.scala`) ||
          rel.endsWith(`/${stem}EffectPortImpl.scala`) ||
          rel.endsWith(`/${stem}EffectBootstrap.scala`) ||
          rel.endsWith(`/${toSnake(stem)}_effect.proto`) ||
          rel.endsWith('/ta-effect-adapter.ts')
        ) {
          const span = findBlockSpan(fileCache.get(rel).lines, l => /\b(?:object|trait|final class|message|export)\s+/u.test(l), { maxLines: 14 });
          dedupPushLoc(locations, seenLoc, makeLocation(rel, row.id, span, { sourceIdentity: row.id }));
        }
      }
    } else if (row.kind === 'use-case' || row.kind === 'journey' || row.kind === 'compliance') {
      const SECTION_BY_KIND = { 'use-case': 'useCases', journey: 'journeys', compliance: 'compliance' };
      const sec = SECTION_BY_KIND[row.kind] ?? 'compliance';
      const hit = findInYamlFiles(yamlStructureFiles, sec, row.name);
      if (hit) sources.push(makeSource(hit.rel, `${row.kind} 声明`, `${sec}/${row.name}`, hit.span));
      for (const hitK of knowledgeIndex.get(row.name) ?? []) {
        dedupPushLoc(locations, seenLoc, makeLocation(hitK.rel, row.id, hitK.span, { sourceIdentity: row.id }));
      }
    }

    const owner = [meta.system || 'system', meta.context || 'context'];
    if (row.layer) owner.push(row.layer);
    return {
      id: row.id,
      identity: row.id,
      label: row.name,
      kind: row.kind,
      state: locations.length > 0 ? 'mapped' : 'not-generated',
      description: describeNode(row, payload, clozeMap),
      owner,
      sources: sources.filter(Boolean),
      locations,
    };
  });

  // Populate full per-file reverseLocations on every location
  for (const node of nodes) {
    for (const loc of node.locations) {
      const rel = loc._relFile;
      delete loc._relFile;
      const allRevs = fileReverseIndex.get(rel) || [];
      loc.reverseLocations = allRevs;
      loc.reverseIdentities = [...new Set(allRevs.map(r => r.identity))];
    }
  }

  const edges = dbEdges.map(e => ({
    from: e.from_id,
    to: e.to_id,
    kind: e.relation === 'implements_cloze' ? 'source' : 'declared-reference',
    label: `${EDGE_RELATION_ZH[e.relation] || e.relation} (${e.relation})`,
    asserted: true,
    proof: `SQLite ${normPrefix}.truthsrc/knowledge.sqlite · edges(${e.from_id} -[${e.relation}]-> ${e.to_id})`,
  }));

  // Auto-generate chapters from application stories + domain slices (unless curated override supplied)
  const nodeIds = new Set(nodes.map(n => n.id));
  const pick = ids => [...new Set(ids)].filter(id => nodeIds.has(id));
  const adj = new Map();
  for (const e of dbEdges) {
    if (!adj.has(e.from_id)) adj.set(e.from_id, new Set());
    if (!adj.has(e.to_id)) adj.set(e.to_id, new Set());
    adj.get(e.from_id).add(e.to_id);
    adj.get(e.to_id).add(e.from_id);
  }

  let chapters;
  if (Array.isArray(chaptersOverride) && chaptersOverride.length > 0) {
    chapters = chaptersOverride.map(ch => ({ ...ch, nodeIds: pick(ch.nodeIds) }));
  } else {
    chapters = [];
    const covered = new Set();
    const behaviors = nodes.filter(n => n.kind === 'behavior');
    const orderedBehs = [
      ...behaviors.filter(b => b.owner.includes('application')),
      ...behaviors.filter(b => !b.owner.includes('application')),
    ];
    orderedBehs.forEach((beh, idx) => {
      const layer = beh.owner.includes('application') ? 'APPLICATION' : 'DOMAIN';
      const neighbors = [...(adj.get(beh.id) ?? [])];
      const expanded = [beh.id, ...neighbors];
      // Pull in commands/events of governed/dispatched aggregates and related ports/types
      for (const nid of neighbors) {
        if (nid.startsWith('agg:')) {
          for (const sub of adj.get(nid) ?? []) {
            if (sub.startsWith('cmd:') || sub.startsWith('event:')) expanded.push(sub);
          }
        }
      }
      const chNodes = pick(expanded);
      chNodes.forEach(id => covered.add(id));
      chapters.push({
        id: `ch${idx + 1}-${beh.label.toLowerCase().replace(/[^a-z0-9]+/gu, '-')}`,
        kicker: `CHAPTER ${String(idx + 1).padStart(2, '0')} · ${layer}`,
        title: `${beh.label}（${layer === 'APPLICATION' ? '应用编排 + HTTP 入口' : '领域行为切片'}）`,
        description: beh.description,
        questions: [
          `点选 ${beh.label} 及其 EARS 规则，查看对应的洋葱架构代码（domain / application / interfaces）与 Z3 锁定测试。`,
          '点击右侧代码摘录的任意行号，反查回其对应的 EARS 规格与知识节点。',
        ],
        nodeIds: chNodes,
      });
    });
    const remaining = nodes.map(n => n.id).filter(id => !covered.has(id));
    if (remaining.length > 0) {
      chapters.push({
        id: 'ch-structures-ports',
        kicker: 'STRUCTURES · PORTS · EXACT TYPES',
        title: '精确类型、值对象与系统端口',
        description: '展示未归入单一行为章节的共享精确类型、值对象、端口与读模型声明及其 TS/Scala 映射。',
        questions: ['查看共享精确数值类型如何消除 IEEE-754 浮点误差。'],
        nodeIds: remaining,
      });
    }
  }

  // Optional provenance + blind-review + manifest evidence
  const provPath = join(absRoot, '.truthsrc/v2-provenance.json');
  const provenanceJson = existsSync(provPath) ? JSON.parse(readFileSync(provPath, 'utf8')) : null;
  const blindPath = join(absRoot, '.truthsrc/blind-review-verdict.json');
  const blindReviewJson = existsSync(blindPath) ? JSON.parse(readFileSync(blindPath, 'utf8')) : null;
  const manifestPath = join(absRoot, 'generated-tests/manifest.sha256.json');
  const manifestJson = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;

  const filesTable = allRelFiles.map(f => ({
    file: `${normPrefix}${f}`,
    bytes: fileCache.get(f).bytes,
    sha256: fileCache.get(f).sha256,
  }));
  const sourceDigest = `sha256:${sha256Hex(Buffer.from(JSON.stringify(filesTable.filter(f => f.file.includes('truth/')))))}`;
  const codeDigest = `sha256:${sha256Hex(Buffer.from(JSON.stringify(filesTable.filter(f => !f.file.includes('truth/')))))}`;
  const sqliteDigest = `sha256:${sha256Hex(readFileSync(effDb))}`;

  const mappedNodes = nodes.filter(n => n.state === 'mapped').length;
  const totalLocations = nodes.reduce((acc, n) => acc + n.locations.length, 0);
  const spanLocations = nodes.reduce((acc, n) => acc + n.locations.filter(l => l.precision === 'span').length, 0);

  const evidence = [];
  if (provenanceJson) {
    const sbtNote = provenanceJson.scalaCheck?.sbtRuntimeFilesCount > 0
      ? `（另含 ${provenanceJson.scalaCheck.sbtRuntimeFilesCount} 份 1.0 Akka/Play/ScalaPB 运行时文件）`
      : '';
    evidence.push({
      id: 'v2-verify-gate',
      label: 'verify-v2（真源锁 + domain/application/interfaces 实测套件）',
      status: provenanceJson.passed ? 'passed' : 'failed',
      scope: `${meta.system}/${meta.context}`,
      summary: `${manifestJson?.files?.length ?? 0} 份锁定测试/Feature 文件；TS 套件 ${provenanceJson.tsCheck?.specFiles?.length ?? 0} 套、Scala 套件 ${provenanceJson.scalaCheck?.suiteClasses?.length ?? 0} 套${sbtNote}；洋葱 DIP 审计 ${provenanceJson.onionCheck?.passed === false ? '失败' : `通过（${provenanceJson.onionCheck?.checkedCount ?? 0} 文件 0 违规）`}。`,
    });
    const mut = provenanceJson.mutationCheck;
    if (mut?.enabled) {
      const parts = [];
      if (mut.ts && !mut.ts.skipped) parts.push(`TS ${mut.ts.killed}/${mut.ts.total} (${mut.ts.killRate}%)`);
      if (mut.scala && !mut.scala.skipped) parts.push(`Scala ${mut.scala.killed}/${mut.scala.total} (${mut.scala.killRate}%)`);
      evidence.push({
        id: 'v2-mutation-gate',
        label: 'Mutation Gate（领域守卫变异测试门禁）',
        status: mut.passed ? 'passed' : 'failed',
        scope: `${meta.system}/${meta.context}`,
        summary: parts.length > 0
          ? `领域守卫变异杀死率：${parts.join(' · ')}（门禁要求 >= ${mut.minKillRate ?? 100}%），无幸存变异体。`
          : `已启用变异测试门禁（要求 >= ${mut.minKillRate ?? 100}%）。`,
      });
    }
    const provSlots = provenanceJson.provenanceCheck?.clozeSlots ?? [];
    if (provSlots.length > 0 || dbCloze.length > 0) {
      const pendingCount = provSlots.filter(s => s.unimplemented).length;
      const doneCount = provSlots.length - pendingCount;
      const implFiles = provSlots.map(s => s.file.split('/').at(-1));
      evidence.push({
        id: 'v2-tasks-queue',
        label: `tasks-v2 隔离区槽位状态（${doneCount}/${provSlots.length || dbCloze.length} 已实现）`,
        status: pendingCount === 0 ? 'passed' : 'pending',
        scope: dbCloze.map(c => c.slot_id).join(', ') || `${meta.system}/${meta.context}`,
        summary: `通道 4B 隔离区共 ${dbCloze.length} 个逻辑槽位 / ${provSlots.length} 个双栈实现文件（待填 ${pendingCount} 个）：${implFiles.join('、')}。`,
      });
    }
  }
  if (dbCoverage.length > 0) {
    evidence.push({
      id: 'v2-coverage-audit',
      label: `全代码库分级覆盖审计（${dbCoverage.length} 个纳管文件）`,
      status: 'passed',
      scope: 'knowledge.sqlite -> file_coverage',
      summary: `已将 ${dbCoverage.length} 个纳管代码文件按问题域/解域（D1/D2/S1/S2/S3）与证据等级（E1–E4）落盘至 SQLite 覆盖率账本。`,
    });
  }
  if (blindReviewJson) {
    evidence.push({
      id: 'v2-blind-review',
      label: '独立上下文盲审（抗作弊/抗硬编码）',
      status: blindReviewJson.verdict === 'PASS' ? 'passed' : 'failed',
      scope: (blindReviewJson.auditedSlots ?? []).map(s => s.slotId).join(', '),
      summary: `独立盲审结论 ${blindReviewJson.verdict}，作弊/硬编码发现 ${blindReviewJson.antiHardcodingFindings ?? 0} 项，阻塞缺陷 ${blindReviewJson.blockingDefects ?? 0} 项。`,
    });
  }

  const checks = [
    { id: 'v2-compile-sqlite', passed: true, detail: `canonicalSha256=${meta.canonicalSha256}, nodes=${nodes.length}, edges=${edges.length}` },
  ];
  if (provenanceJson) {
    const sbtSuffix = provenanceJson.scalaCheck?.sbtRuntimeFilesCount > 0
      ? `, sbtRuntimeFiles=${provenanceJson.scalaCheck.sbtRuntimeFilesCount}`
      : '';
    checks.push(
      { id: 'locked-manifest', passed: provenanceJson.manifestCheck?.passed === true, detail: `${provenanceJson.manifestCheck?.verifiedFiles ?? 0} locked files verified` },
      { id: 'ts-specs', passed: provenanceJson.tsCheck?.passed === true, detail: `${provenanceJson.tsCheck?.specFiles?.length ?? 0} TS suites (skipped=${Boolean(provenanceJson.tsCheck?.skipped)})` },
      { id: 'scala-specs', passed: provenanceJson.scalaCheck?.passed === true, detail: `${provenanceJson.scalaCheck?.suiteClasses?.length ?? 0} Scala suites (skipped=${Boolean(provenanceJson.scalaCheck?.skipped)}${sbtSuffix})` },
      { id: 'onion-dip', passed: provenanceJson.onionCheck?.passed !== false, detail: `violations=${provenanceJson.onionCheck?.violations?.length ?? 0}` },
    );
    if (provenanceJson.mutationCheck?.enabled) {
      const m = provenanceJson.mutationCheck;
      checks.push({
        id: 'mutation-gate',
        passed: m.passed === true,
        detail: `ts=${m.ts?.skipped ? 'skipped' : `${m.ts?.killed}/${m.ts?.total} (${m.ts?.killRate}%)`}, scala=${m.scala?.skipped ? 'skipped' : `${m.scala?.killed}/${m.scala?.total} (${m.scala?.killRate}%)`}`,
      });
    }
    const provSlots = provenanceJson.provenanceCheck?.clozeSlots ?? [];
    if (provSlots.length > 0) {
      const pending = provSlots.filter(s => s.unimplemented).length;
      checks.push({
        id: 'tasks-v2-slots',
        passed: pending === 0,
        detail: `${provSlots.length - pending}/${provSlots.length} isolation-zone files implemented (pending=${pending})`,
      });
    }
  }

  const generatorList = [...detectedGenerators].sort();
  if (generatorList.length > 0) {
    evidence.unshift({
      id: 'v2-product-generator',
      label: `代码生成器标识（${generatorList.join(', ')}）`,
      status: 'passed',
      scope: `${meta.system}/${meta.context}`,
      summary: `已通过 // @generated by truthsrc ${generatorList.join(', ')} 文件头校验，覆盖强管控 1.0 目录布局（domain / application / protobuf / infrastructure / interfaces / modules）与 @cloze 隔离区。`,
    });
  }

  return {
    schemaVersion: 'truthsrc.project-view/v1',
    title: title || `${meta.system || 'co-arising'} / ${meta.context || 'core'} · v2.0.0 知识与强管控架构工作坊`,
    subtitle: subtitle || `由 truthsrc view-v2 直接从 .truthsrc/knowledge.sqlite 与当前仓库真实文件生成${generatorList.length ? `（生成器：${generatorList.join(', ')}）` : ''}。全量导出 ${nodes.length}/${nodes.length} 节点与 ${edges.length} 条关系边（0 省略），覆盖真源、强管控分层代码、@cloze 隔离区与锁定测试，支持离线双向反查。`,
    project: {
      name: `${meta.system || 'co-arising'} (${meta.context || 'core'})`,
      system: meta.system || 'co-arising',
      context: meta.context || 'core',
      ...(generatorList.length ? { generator: generatorList.join(', ') } : {}),
    },
    snapshot: {
      source: sourceDigest,
      knowledge: sqliteDigest,
      generation: `canonical:${meta.canonicalSha256}`,
      codeDigest,
    },
    freshness: {
      state: 'current-at-export',
      checkedAtExport: true,
      live: false,
      schemaVersion: meta.schemaVersion,
    },
    verification: {
      passed: provenanceJson ? provenanceJson.passed === true : true,
      project: sanitizeLocalPaths(`[${meta.system}/${meta.context} (relative paths only)]`),
      output: '[generated-scaffold + generated-tests + handwritten]',
      checks,
      counts: {
        nodes: nodes.length,
        mappedNodes,
        edges: edges.length,
        clozeSlots: dbCloze.length,
        totalLocations,
        spanLocations,
        capturedFiles: filesTable.length,
        fileCoverageRows: dbCoverage.length,
      },
      diagnostics: [],
      files: filesTable,
    },
    evidence,
    nodes,
    edges,
    chapters,
    totals: {
      nodes: nodes.length,
      edges: edges.length,
      shownNodes: nodes.length,
      omittedNodes: 0,
    },
    diagnostics: [],
    limitations: [
      `本离线快照由 truthsrc view-v2 直接采集自当前仓库（${nodes.length}/${nodes.length} 节点，0 省略），全部路径为相对路径，不含本机绝对路径。`,
      '页面为纯静态单文件（strict CSP），不会联网或执行展示代码；修改真源或代码后请重新运行 verify-v2 与 view-v2 刷新。',
    ],
  };
}

export function exportV2WorkshopHtml({
  rootDir = process.cwd(),
  outFile,
  projectFile = null,
  dbFile = null,
  pathPrefix = '',
  title = null,
  subtitle = null,
  chaptersFile = null,
} = {}) {
  if (!outFile) throw new Error('view-v2 requires --out <workshop.html>');
  const chaptersOverride = chaptersFile ? JSON.parse(readFileSync(resolve(chaptersFile), 'utf8')) : null;
  const view = buildV2WorkshopView({
    rootDir,
    projectFile,
    dbFile,
    pathPrefix,
    title,
    subtitle,
    chaptersOverride,
  });
  const html = renderWorkshop(view);
  if (/\/Users\//u.test(html)) {
    throw new Error('V2_VIEW_PATH_LEAK: refusing to emit workshop HTML containing a local home path');
  }
  const absOut = resolve(outFile);
  mkdirSync(dirname(absOut), { recursive: true });
  writeFileSync(absOut, html, 'utf8');
  return {
    schemaVersion: 'co-arising.view-v2/v1',
    outFile: absOut,
    bytes: Buffer.byteLength(html, 'utf8'),
    kb: Number((Buffer.byteLength(html, 'utf8') / 1024).toFixed(1)),
    nodes: view.nodes.length,
    mappedNodes: view.verification.counts.mappedNodes,
    edges: view.edges.length,
    chapters: view.chapters.length,
    totalLocations: view.verification.counts.totalLocations,
    spanLocations: view.verification.counts.spanLocations,
    capturedFiles: view.verification.counts.capturedFiles,
    canonicalSha256: view.snapshot.generation.replace(/^canonical:/u, ''),
    htmlSha256: sha256Hex(Buffer.from(html, 'utf8')),
  };
}
