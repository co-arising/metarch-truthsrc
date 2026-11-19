#!/usr/bin/env node
// projection-apply-event (family 26) generator: emits the user-approved golden
// shape. Ruled invariants (2026-11-19/20): one kernel pure-function class per
// view (four judged forms, zero mechanism); per-view business-semantics traits
// generated as the face while the handwritten impls live in the infrastructure
// isolation zone and are never emitted; the bootstrap module binds face to impl;
// the judged input is fail-closed — degraded events, duplicate event names,
// persistenceId views mixing create-form events, delete keys other than exactly
// two pairs, ??? bodies, dead hooks and inline clock/identity semantics are all
// rejected (D-P08 + the 2026-11-20 walkthrough rulings). Acceptance is byte
// comparison against the approved golden bundle, never a self-declared pass.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseStrictJson } from '../lib/strict-json.mjs';

const fail = (code, message) => { throw Object.assign(new Error(code + ': ' + message), { code }); };
const text = (value, what) => {
  if (typeof value !== 'string' || value.length === 0) fail('FORMAL_INPUT', `${what} must be nonempty text`);
  return value;
};
const fieldsOf = (record, names, what) => {
  const missing = names.filter(n => !(n in record));
  if (missing.length) fail('FORMAL_INPUT', `${what} missing fields: ${missing.join(', ')}`);
};
const bannedField = (record, name, what) => {
  if (name in record) fail('FORMAL_INPUT', `${what}.${name} is a raw-only slot and is not a target form (2026-11-19/20 rulings)`);
};
const pascal = (value, what) => {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(value)) fail('FORMAL_INPUT', `${what} must be PascalCase`);
  return value;
};
const FORMS = ['create', 'updateOnly', 'delete', 'persistenceIdCreate'];
const HOOKS = ['emptyRow', 'stamped', 'text'];
const HOOK_LABELS = { emptyRow: '默认行', stamped: '时间戳', text: '文本' };
const COUNT_WORDS = { 1: '一', 2: '两', 3: '三', 4: '四' };
const KEYWORDS = new Set(['type', 'match', 'class', 'def', 'val', 'var', 'object', 'case']);
// The kernel face is business-only data flow: these raw-debt tokens never appear
// in a judged column value or delete expression (2026-11-20 walkthrough).
const BANNED_VALUE_TOKENS = ['???', 'Await', 'Instant.now', 'UUID', 'System', 'Thread', 'asInstanceOf', 'getClass', 'net.imadz.metarch'];
// Kernel-local helpers are the family's fixed pure mechanics, exact golden text.
const KERNEL_HELPERS = {
  upsertBy: `  /** keyed upsert：命中原位替换（slot 保留）·否则追加。 */
  private def upsertBy[A](list: List[A], item: A)(key: A => String): List[A] = {
    val k = key(item)
    val idx = list.indexWhere(a => key(a) == k)
    if (idx >= 0) list.updated(idx, item) else list :+ item
  }`,
};

const col = name => (KEYWORDS.has(name) ? '`' + name + '`' : name);
const simpleName = fqn => fqn.split('.').pop();
const checkValueText = (value, what) => {
  text(value, what);
  const hit = BANNED_VALUE_TOKENS.find(token => value.includes(token));
  if (hit) fail('FORMAL_INPUT', `${what} carries the raw-debt token ${JSON.stringify(hit)}; the kernel face is business-only data flow`);
  return value;
};

function checkInput(input) {
  fieldsOf(input, ['schemaVersion', 'basePackage', 'moduleName', 'views', 'supplied'], 'input');
  if (input.schemaVersion !== 'truthsrc.projection-apply-event-input/v1')
    fail('FORMAL_INPUT', 'unsupported schemaVersion');
  text(input.basePackage, 'basePackage');
  if (!input.basePackage.split('.').every(part => /^[a-z][a-zA-Z0-9]*$/.test(part)))
    fail('FORMAL_INPUT', 'basePackage must be dotted lowercase-root segments');
  pascal(input.moduleName, 'moduleName');
  if (!Array.isArray(input.views) || input.views.length === 0)
    fail('FORMAL_INPUT', 'views must be a nonempty array');
  const faceNames = new Set();
  for (const view of input.views) {
    fieldsOf(view, ['viewLabel', 'viewName', 'tableObject', 'kernelClass', 'semanticsFace', 'semanticsImpl', 'identityScheme', 'hooks', 'kernelHelpers', 'events'], 'view');
    text(view.viewLabel, 'view.viewLabel');
    pascal(view.viewName, 'view.viewName');
    pascal(view.tableObject, 'view.tableObject');
    pascal(view.kernelClass, 'view.kernelClass');
    pascal(view.semanticsFace, 'view.semanticsFace');
    pascal(view.semanticsImpl, 'view.semanticsImpl');
    if (view.identityScheme !== null && view.identityScheme !== 'persistenceId')
      fail('FORMAL_INPUT', 'view.identityScheme must be null or "persistenceId"');
    if (!Array.isArray(view.hooks) || view.hooks.length === 0)
      fail('FORMAL_INPUT', 'view.hooks must be a nonempty array');
    if (new Set(view.hooks).size !== view.hooks.length)
      fail('FORMAL_INPUT', 'view.hooks must not repeat a hook');
    for (const hook of view.hooks)
      if (!HOOKS.includes(hook)) fail('FORMAL_INPUT', `unknown hook ${hook}`);
    if (!Array.isArray(view.kernelHelpers))
      fail('FORMAL_INPUT', 'view.kernelHelpers must be an array');
    if (new Set(view.kernelHelpers).size !== view.kernelHelpers.length)
      fail('FORMAL_INPUT', 'view.kernelHelpers must not repeat a helper');
    for (const helper of view.kernelHelpers)
      if (!(helper in KERNEL_HELPERS)) fail('FORMAL_INPUT', `unknown kernel helper ${helper}`);
    if (!Array.isArray(view.events) || view.events.length === 0)
      fail('FORMAL_INPUT', 'view.events must be a nonempty array');
    const eventNames = new Set();
    const referencedHooks = new Set();
    const referencedHelpers = new Set();
    for (const event of view.events) {
      bannedField(event, 'applyExpr', `event ${event.name}`);
      bannedField(event, 'fieldPairs', `event ${event.name}`);
      bannedField(event, 'literalPairs', `event ${event.name}`);
      bannedField(event, 'droppedColumns', `event ${event.name}`);
      bannedField(event, 'body', `event ${event.name}`);
      fieldsOf(event, ['name', 'fqn', 'applyForm'], 'event');
      text(event.name, 'event name');
      if (!/^[A-Za-z][A-Za-z0-9]*$/.test(event.name))
        fail('FORMAL_INPUT', `event name ${event.name} must be a bare identifier`);
      if (eventNames.has(event.name))
        fail('FORMAL_INPUT', `duplicate event name ${event.name} (the judged input is fail-closed)`);
      eventNames.add(event.name);
      text(event.fqn, `event ${event.name} fqn`);
      if (event.fqn.includes('net.imadz.metarch'))
        fail('FORMAL_INPUT', `event ${event.name} fqn carries the raw hardcoded metarch prefix (explicit correction)`);
      if (!FORMS.includes(event.applyForm))
        fail('FORMAL_INPUT', `event ${event.name} applyForm ${JSON.stringify(event.applyForm)} is not one of ${FORMS.join('/')}; degraded is raw-only and rejected fail-closed (D-P08)`);
      if (view.identityScheme === 'persistenceId' && event.applyForm === 'create')
        fail('FORMAL_INPUT', `a persistenceId view rejects plain create-form events (raw mixed-shape nonexistent-existing defect, D-P08)`);
      const docNote = event.docNote === undefined ? undefined : text(event.docNote, `event ${event.name} docNote`);
      if (event.applyForm === 'delete') {
        fieldsOf(event, ['deletePairs'], `delete event ${event.name}`);
        if (!Array.isArray(event.deletePairs) || event.deletePairs.length !== 2)
          fail('FORMAL_INPUT', `delete event ${event.name} requires exactly two judged pairs (raw positional fill of missing keys becomes unreachable, D-P08)`);
        for (const pair of event.deletePairs) {
          fieldsOf(pair, ['name', 'expr'], 'deletePair');
          text(pair.name, 'deletePair name');
          checkValueText(pair.expr, `delete event ${event.name} key ${pair.name}`);
        }
      } else {
        fieldsOf(event, ['columns'], `event ${event.name}`);
        if (!Array.isArray(event.columns))
          fail('FORMAL_INPUT', `event ${event.name} columns must be an array`);
        if (event.applyForm === 'persistenceIdCreate') {
          fieldsOf(event, ['tenantEventField'], `persistenceIdCreate event ${event.name}`);
          text(event.tenantEventField, `event ${event.name} tenantEventField`);
          if (!/^e\.[A-Za-z][A-Za-z0-9]*$/.test(event.tenantEventField))
            fail('FORMAL_INPUT', `event ${event.name} tenantEventField must reference an event field (e.<field>)`);
        }
        if (event.applyForm === 'create' && event.columns.length === 0)
          fail('FORMAL_INPUT', `create event ${event.name} requires a nonempty judged column set`);
        const columnNames = new Set();
        for (const column of event.columns) {
          fieldsOf(column, ['name', 'value'], 'column');
          text(column.name, 'column name');
          if (!/^[A-Za-z][A-Za-z0-9]*$/.test(column.name))
            fail('FORMAL_INPUT', `column name ${column.name} must be a bare identifier`);
          if (columnNames.has(column.name))
            fail('FORMAL_INPUT', `duplicate column ${column.name} in event ${event.name}`);
          columnNames.add(column.name);
          checkValueText(column.value, `event ${event.name} column ${column.name}`);
          if (/sem\.emptyRow\b/.test(column.value)) referencedHooks.add('emptyRow');
          if (/sem\.stamped\(/.test(column.value)) referencedHooks.add('stamped');
          if (/sem\.text\(/.test(column.value)) referencedHooks.add('text');
          if (/upsertBy\(/.test(column.value)) referencedHelpers.add('upsertBy');
        }
      }
      if (event.applyForm === 'create' || event.applyForm === 'persistenceIdCreate')
        referencedHooks.add('emptyRow');
    }
    const declaredHooks = new Set(view.hooks);
    const missing = [...referencedHooks].filter(h => !declaredHooks.has(h));
    const dead = [...declaredHooks].filter(h => !referencedHooks.has(h));
    if (missing.length || dead.length)
      fail('FORMAL_INPUT', `view ${view.viewName} declared hooks must exactly equal the hooks its judged bodies reference (honest minimal face): missing [${missing}], dead [${dead}]`);
    const declaredHelpers = new Set(view.kernelHelpers);
    const missingHelpers = [...referencedHelpers].filter(h => !declaredHelpers.has(h));
    const deadHelpers = [...declaredHelpers].filter(h => !referencedHelpers.has(h));
    if (missingHelpers.length || deadHelpers.length)
      fail('FORMAL_INPUT', `view ${view.viewName} declared kernel helpers must exactly equal the helpers its judged bodies reference: missing [${missingHelpers}], dead [${deadHelpers}]`);
    if (faceNames.has(view.semanticsFace))
      fail('FORMAL_INPUT', `duplicate semantics face ${view.semanticsFace}`);
    faceNames.add(view.semanticsFace);
  }
  if (!Array.isArray(input.supplied))
    fail('FORMAL_INPUT', 'supplied must be an array of external frozen inputs');
  for (const row of input.supplied) {
    fieldsOf(row, ['role', 'path', 'sha256'], 'supplied entry');
    if (!/^[0-9a-f]{64}$/.test(row.sha256)) fail('FORMAL_INPUT', `supplied ${row.role} needs a sha256`);
  }
}

function renderTrait(base, view) {
  const hookList = view.hooks.map(h => HOOK_LABELS[h]).join(' / ');
  const minimal = view.hooks.includes('text') ? '' : '（本视图无文本钩子——诚实最小面）';
  const countWord = COUNT_WORDS[view.hooks.length];
  const defs = [];
  if (view.hooks.includes('emptyRow'))
    defs.push(view.identityScheme === 'persistenceId'
      ? `  def emptyRow(entityId: String, tenantId: String): ${view.viewName}`
      : `  def emptyRow: ${view.viewName}`);
  if (view.hooks.includes('stamped'))
    defs.push('  def stamped(raw: java.time.Instant): Option[java.time.Instant]');
  if (view.hooks.includes('text'))
    defs.push('  def text(raw: String): String');
  return `package ${base}.application.projection.handlers

import ${base}.application.projection.repository.${view.tableObject}.${view.viewName}

/** ${view.viewLabel}业务语义面：${hookList}${countWord}个业务语义钩子${minimal}。
  * 面由生成器发射；实现由手写隔离区所有，生成器永不创建或覆写。 */
trait ${view.semanticsFace} {
${defs.join('\n')}
}
`;
}

function renderFunction(base, view, event) {
  const simple = simpleName(event.fqn);
  const docNote = event.docNote ? `·${event.docNote}` : '';
  const doc = `  /** ${event.name} → ${view.viewName}（referenceCode 直译·方言 ${event.applyForm}${docNote}） */`;
  const columns = event.columns || [];
  const namedArgs = columns.map(c => `      ${col(c.name)} = ${c.value}`).join(',\n');
  let signature;
  let body;
  switch (event.applyForm) {
    case 'create':
      signature = `  def on${event.name}(existing: Option[${view.viewName}], e: ${simple}): ${view.viewName} =`;
      body = `    existing.getOrElse(sem.emptyRow).copy(\n${namedArgs}\n    )`;
      break;
    case 'updateOnly':
      signature = `  def on${event.name}(row: ${view.viewName}, e: ${simple}): ${view.viewName} =`;
      body = columns.length ? `    row.copy(\n${namedArgs}\n    )` : '    row';
      break;
    case 'delete': {
      signature = `  def on${event.name}(e: ${simple}): (String, String) =`;
      body = `    (${event.deletePairs[0].expr}, ${event.deletePairs[1].expr})`;
      break;
    }
    case 'persistenceIdCreate':
      signature = `  def on${event.name}(e: ${simple}, entityId: String): ${view.viewName} =`;
      body = `    sem.emptyRow(entityId, ${event.tenantEventField}).copy(\n${namedArgs}\n    )`;
      break;
    default:
      fail('FORMAL_INPUT', `unsupported form ${event.applyForm}`);
  }
  return `${doc}\n${signature}\n${body}`;
}

function renderKernel(base, view) {
  const imports = [
    'import javax.inject.{Inject, Singleton}',
    '',
    `import ${base}.application.projection.repository.${view.tableObject}.${view.viewName}`,
    ...view.events.map(event => `import ${event.fqn}`),
  ];
  const helperBlock = view.kernelHelpers.map(helper => KERNEL_HELPERS[helper]).join('\n\n');
  const functions = view.events.map(event => renderFunction(base, view, event)).join('\n\n');
  const bodyParts = [helperBlock, functions].filter(part => part.length > 0);
  return `package ${base}.application.projection.handlers

${imports.join('\n')}

/** ${view.viewName} 投影纯函数族（referenceCode 直译·方言判定已定）。
  * 业务语义（${view.hooks.map(h => HOOK_LABELS[h]).join('/')}）经构造注入的语义面委托——kernel 侧零机制。 */
@Singleton
final class ${view.kernelClass} @Inject()(sem: ${view.semanticsFace}) {

${bodyParts.join('\n\n')}
}
`;
}

function renderModule(base, input) {
  const faces = input.views.map(view => `import ${base}.application.projection.handlers.${view.semanticsFace}`);
  const impls = input.views.map(view => `import ${base}.infrastructure.projection.${view.semanticsImpl}`);
  const bindings = input.views.map(view =>
    `    bind(classOf[${view.semanticsFace}])\n      .to(classOf[${view.semanticsImpl}])`).join('\n');
  return `package ${base}.infrastructure.bootstrap

import com.google.inject.AbstractModule

${faces.concat(impls).join('\n')}

/** Infrastructure owns assembly: the kernel-facing semantics faces carry no
  * implementation reference, so the face-to-implementation bindings live here,
  * in the layer that can see both sides. */
final class ${input.moduleName} extends AbstractModule {
  override def configure(): Unit = {
${bindings}
  }
}
`;
}

function renderAll(input) {
  const base = input.basePackage;
  const outputs = {};
  for (const view of input.views) {
    outputs[`app/${base.split('.').slice(0, 1)[0]}/${base.split('.').slice(1).join('/')}/application/projection/handlers/${view.kernelClass}.scala`] = renderKernel(base, view);
    outputs[`app/${base.split('.').slice(0, 1)[0]}/${base.split('.').slice(1).join('/')}/application/projection/handlers/${view.semanticsFace}.scala`] = renderTrait(base, view);
  }
  outputs[`app/${base.split('.').slice(0, 1)[0]}/${base.split('.').slice(1).join('/')}/infrastructure/bootstrap/${input.moduleName}.scala`] = renderModule(base, input);
  return outputs;
}

export function generateProjectionApplyEvent(inputJson) {
  const input = parseStrictJson(Buffer.from(JSON.stringify(inputJson), 'utf8'));
  checkInput(input);
  return renderAll(input);
}

// Public CLI: node tools/gen-projection-apply-event.mjs <input.json> <output-dir>
if (process.argv[1] && process.argv[1].endsWith('gen-projection-apply-event.mjs')) {
  const [inputPath, outputDir] = process.argv.slice(2);
  if (!inputPath || !outputDir) fail('FORMAL_USAGE', 'usage: gen-projection-apply-event.mjs <input.json> <output-dir>');
  const raw = fs.readFileSync(inputPath);
  const input = parseStrictJson(raw);
  checkInput(input);
  const outputs = renderAll(input);
  fs.mkdirSync(outputDir, { recursive: true });
  const produced = [];
  for (const [relative, content] of Object.entries(outputs)) {
    const target = path.join(outputDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    produced.push({ path: relative, bytes: Buffer.byteLength(content), sha256: createHash('sha256').update(content).digest('hex') });
  }
  process.stdout.write(JSON.stringify({ produced }) + '\n');
}
