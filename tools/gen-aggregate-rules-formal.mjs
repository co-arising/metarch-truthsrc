#!/usr/bin/env node
// aggregate-rules-formal generator: emits the user-approved v3 golden shape.
// Guard-object rules (OCP): named guard objects with CC=2 each, a fixed
// evaluation machine (apply CC=2), and a separate reserve event constructor.
// Acceptance is byte comparison against the approved golden bundle, never
// a self-declared pass.
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
const scalaString = value => '"' + value.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"') + '"';

function checkInput(input) {
  fieldsOf(input, ['schemaVersion', 'basePackage', 'values', 'entity', 'identity', 'rules'], 'input');
  if (input.schemaVersion !== 'truthsrc.aggregate-rules-formal-input/v1')
    fail('FORMAL_INPUT', 'unsupported schemaVersion');
  text(input.basePackage, 'basePackage');
  if (!input.basePackage.split('.').every(part => /^[a-z][a-zA-Z0-9]*$/.test(part)))
    fail('FORMAL_INPUT', 'basePackage must be dotted lowercase-root segments');
}

function renderValues(input) {
  const v = input.values;
  const alphabet = v.checker.identifierAlphabet;
  const extra = alphabet.extra;
  const extraVector = `Vector(${extra.map(ch => `'${ch}'`).join(', ')})`;
  const charVector = [
    ...alphabet.ranges.map(([lo, hi]) => `('${lo}' to '${hi}')`),
    extraVector,
  ].join(' ++ ');
  const nominal = v.nominal.map(row => {
    let requireExpr;
    let requireMessage = row.requireMessage;
    if (row.check === 'identifier') requireExpr = `ValueChecks.identifier(value)`;
    else if (row.check === 'reservation') requireExpr = `ValueChecks.reservation(value)`;
    else if (row.check === 'nonNullBounded') requireExpr = `value != null && value.length <= ${row.maximum}`;
    else fail('FORMAL_INPUT', 'unknown nominal check: ' + row.check);
    return `final case class ${row.name}(value: String) {\n  require(${requireExpr}, ${scalaString(requireMessage)})\n}`;
  }).join('\n\n');
  return `package ${input.basePackage}.domain.values

private[${'values'}] object ${v.checker.objectName} {
  private val identifierCharacters: Set[Char] =
    (${charVector}).toSet

  private def bounded(value: String, maximum: Int): Boolean =
    value != null && value.nonEmpty && value.length <= maximum

  def identifier(value: String): Boolean =
    bounded(value, ${v.checker.identifierMaximum}) && value.forall(identifierCharacters.contains)

  private def printableAscii(character: Char): Boolean = character >= ' ' && character <= '~'

  def reservation(value: String): Boolean =
    bounded(value, ${v.checker.reservationMaximum}) && value.forall(printableAscii)
}

${nominal}
`;
}

function renderEntity(input) {
  const e = input.entity;
  const record = e.storedRecord;
  const recordFields = record.fields.map(f => `      ${f.name}: ${f.type}`).join(',\n');
  const recordRequires = record.requires.map(r => {
    const [expression, message] = r.split('|');
    return `    require(${expression}, ${scalaString(message)})`;
  }).join('\n');
  const state = e.state;
  const stateFields = state.fields.map(f => `      ${f.name}: ${f.type}`).join(',\n');
  const stateRequires = state.requires.map(r => {
    const [expression, message] = r.split('|');
    return `    require(${expression}, ${scalaString(message)})`;
  }).join('\n');
  const events = e.events.cases.map(c => {
    const fieldLines = c.fields.map(f => `      ${f.name}: ${f.type}`).join(',\n');
    const multiline = c.fields.length > 1;
    const rendered = multiline
      ? `  final case class ${c.name}(\n${fieldLines}\n  ) extends ${e.events.trait}`
      : `  final case class ${c.name}(${c.fields.map(f => `${f.name}: ${f.type}`).join(', ')}) extends ${e.events.trait}`;
    return rendered;
  }).join('\n\n');
  return `package ${input.basePackage}.domain.entities

import ${input.basePackage}.domain.values._

object ${e.objectName} {
  final case class ${record.name}(
${recordFields}
  ) {
${recordRequires}
  }

  final case class ${state.name}(
${stateFields}
  ) {
${stateRequires}
  }

  sealed trait ${e.events.trait}

${events}
}
`;
}

function renderIdentity(input) {
  const id = input.identity;
  const args = id.arguments.map(a => `      ${a.name}: ${a.type}`).join(',\n');
  const impl = id.implementation;
  const importedTypes = [...new Set([id.resultType, ...id.arguments.map(a => a.type)])].filter(t => t !== 'Long').sort();
  const partsVector = id.arguments
    .map(a => a.type === 'Long' ? `${a.name}.toString` : `${a.name}.value`)
    .join(', ');
  return `package ${input.basePackage}.domain.services

import ${input.basePackage}.domain.values.{${importedTypes.join(', ')}}

${id.docComment}
trait ${id.traitName} {
  def ${id.methodName}(
${args}
  ): ${id.resultType}
}

object ${impl.objectName} extends ${id.traitName} {
  override def ${id.methodName}(
${args}
  ): ${id.resultType} = {
    val parts = Vector(${partsVector})
    ReservationId(parts.map(part => s"\${part.length}:$part").mkString(${scalaString(impl.formatVersion + '|')}, ${scalaString(impl.segmentSeparator)}, ""))
  }
}
`;
}

function guardRejectionBody(guard) {
  const p = guard.predicate;
  const some = `Some(${guard.rejection})`;
  switch (p.kind) {
    // Rejection-natural predicates: the failing condition reads first.
    case 'positive-long':
      return `if (p.${p.field} <= 0L) ${some} else None`;
    case 'map-absent':
      return `if (state.${p.map}.contains(p.${p.key})) ${some} else None`;
    // Sufficiency/coverage predicates: the passing condition reads first.
    case 'collection-covered':
      return `if (p.${p.collection}.forall(state.${p.container}.contains)) None else ${some}`;
    case 'quantity-sufficient':
      return `if (state.${p.map}.get(p.${p.key}).exists(_ >= p.${p.quantity})) None else ${some}`;
    default:
      fail('FORMAL_INPUT', 'unknown guard predicate: ' + p.kind);
  }
}

function renderRules(input) {
  const r = input.rules;
  const adt = r.rejectionAdt;
  const rejectionCases = adt.cases.map(c =>
    `    case object ${c.name} extends ${adt.sealedAbstract}(\n      ${scalaString(c.code)}, ${scalaString(c.message)}\n    )`
  ).join('\n');
  const [reserve, confirm] = r.commands;
  const guardObjects = reserve.rule.guards.map(g => {
    return `  private object ${g.objectName} extends ${reserve.rule.guardTrait} {\n    def rejection(state: StockReservationState, p: ${reserve.params.name}): Option[${adt.sealedAbstract}] =\n      ${guardRejectionBody(g)}\n  }`;
  }).join('\n\n');
  const guardVector = `  private val ${reserve.rule.guardsVector}: Vector[${reserve.rule.guardTrait}] =\n    Vector(${reserve.rule.guards.map(g => g.objectName).join(', ')})`;
  const success = reserve.success;
  const computationArgs = success.computation.arguments.join(', ');
  const eventPrefix = `${input.entity.objectName}.`;
  const emissionList = success.emissions.map(em => {
    const slotArgs = em.slots.map(s => s.value).join(', ');
    const singleLine = `${eventPrefix}${em.event}(${slotArgs})`;
    // Prettify convention: keep one line within 100 columns, otherwise wrap
    // the argument list with the qualifier on the opening line.
    return singleLine.length + 8 > 100
      ? `        ${eventPrefix}${em.event}(\n          ${slotArgs}\n        )`
      : `        ${singleLine}`;
  }).join(',\n');
  const reserveMethod = `    private def ${success.method}(state: StockReservationState, p: ${reserve.params.name}): List[StockReservationEvents] = {\n      val reservationId = ${success.computation.portMethod}(${computationArgs})\n      List(\n${emissionList}\n      )\n    }`;
  return `package ${input.basePackage}.domain.invariant

import ${r.productionInterface}

import ${input.basePackage}.domain.entities.StockReservationEntity
import ${input.basePackage}.domain.entities.StockReservationEntity.{StockReservationEvents, StockReservationState}
import ${input.basePackage}.domain.services.ReservationIdentity
import ${input.basePackage}.domain.values._

object ${r.objectName} {
  sealed abstract class ${adt.sealedAbstract}(val code: String, val message: String) {
    final def ${adt.adapterMethod}: iMadzError = iMadzError(code, message)
  }

  object ${adt.sealedAbstract} {
${rejectionCases}
  }

  import ${adt.sealedAbstract}._

  final case class ${reserve.params.name}(
${reserve.params.fields.map(f => `      ${f.name}: ${f.type}`).join(',\n')}
  )

  final case class ${confirm.params.name}(
${confirm.params.fields.map(f => `      ${f.name}: ${f.type}`).join(',\n')}
  )

  ${reserve.rule.guardTraitDoc}
  private sealed trait ${reserve.rule.guardTrait} {
    def rejection(state: StockReservationState, p: ${reserve.params.name}): Option[${adt.sealedAbstract}]
  }

${guardObjects}

  ${reserve.rule.guardsVectorDoc}
${guardVector}

  final class ${reserve.rule.name}(${reserve.rule.constructorDependency.parameterName}: ${reserve.rule.constructorDependency.type})
      extends InvariantRule[StockReservationEvents, StockReservationState, ${reserve.params.name}] {
    override def apply(
        state: StockReservationState,
        p: ${reserve.params.name}
    ): Either[iMadzError, List[StockReservationEvents]] =
      ${reserve.rule.guardsVector}.iterator.map(_.rejection(state, p)).collectFirst { case Some(rejection) =>
        Left(rejection.toError)
      }.getOrElse(Right(${success.method}(state, p)))

${reserveMethod}
  }

  object ${confirm.rule.name}
      extends InvariantRule[StockReservationEvents, StockReservationState, ${confirm.params.name}] {
    override def apply(
        state: StockReservationState,
        p: ${confirm.params.name}
    ): Either[iMadzError, List[StockReservationEvents]] =
      state.reservations.get(p.requestId) match {
        case None => Left(ReservationMissing.toError)
        case Some(reservation) =>
          if (reservation.reservationId != p.reservationId) Left(ReservationIdentityMismatch.toError)
          else if (state.confirmedRequests.contains(p.requestId)) Right(Nil)
          else Right(List(StockReservationEntity.ReservationConfirmed(p.requestId, p.reservationId)))
      }
  }
}
`;
}

const RENDERERS = {
  'values/ReservationValues.scala': renderValues,
  'entities/StockReservationEntity.scala': renderEntity,
  'services/ReservationIdentity.scala': renderIdentity,
  'invariant/StockReservationRules.scala': renderRules,
};

export function generateFormalRules(inputJson) {
  const input = parseStrictJson(Buffer.from(JSON.stringify(inputJson), 'utf8'));
  checkInput(input);
  const outputs = {};
  for (const [suffix, render] of Object.entries(RENDERERS)) {
    outputs[`app/${input.basePackage.split('.').slice(0, 1)[0]}/${input.basePackage.split('.').slice(1).join('/')}/domain/${suffix}`] = render(input);
  }
  return outputs;
}

// Public CLI: node tools/gen-aggregate-rules-formal.mjs <input.json> <output-dir>
if (process.argv[1] && process.argv[1].endsWith('gen-aggregate-rules-formal.mjs')) {
  const [inputPath, outputDir] = process.argv.slice(2);
  if (!inputPath || !outputDir) fail('FORMAL_USAGE', 'usage: gen-aggregate-rules-formal.mjs <input.json> <output-dir>');
  const raw = fs.readFileSync(inputPath);
  const input = parseStrictJson(raw);
  checkInput(input);
  fs.mkdirSync(outputDir, { recursive: true });
  const produced = [];
  for (const [suffix, render] of Object.entries(RENDERERS)) {
    const relative = `app/${input.basePackage.split('.').slice(0, 1)[0]}/${input.basePackage.split('.').slice(1).join('/')}/domain/${suffix}`;
    const target = path.join(outputDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const content = render(input);
    fs.writeFileSync(target, content);
    produced.push({ path: relative, bytes: Buffer.byteLength(content), sha256: createHash('sha256').update(content).digest('hex') });
  }
  process.stdout.write(JSON.stringify({ produced }) + '\n');
}
