import { n, q, fqn, types, resultPayload } from './syntax.mjs';
import { workflowPolicyTemplate, workflowCompletionTemplate } from './workflow-policy.mjs';
import { workflowEvidenceTemplate } from './workflow-evidence.mjs';

export function workflowTemplate(m, out) {
  const t = types(m), codecs = n(m.symbols.codecs), runAreas = m.workflow.areas.filter(a => a.action.kind === 'run');
  const extra = m.runs.map(run => `, ${run.hostIdentifier}: ${n(run.symbol)}.Host`).join('');
  out.append(`package ${m.packages.glue}

import akka.util.ByteString
import net.imadz.monarch.persistence.batch._
import net.imadz.monarch.persistence.operation.{ExternalOperationPort, OperationProtocol => Op}
import net.imadz.monarch.persistence.resource.{ResourceEvidenceValidator, ResourceProtocol}
import net.imadz.monarch.persistence.workflow._
import ${m.packages.kernel}._
import scala.concurrent.{ExecutionContext, Future}
import scala.util.Try

final class ${n(m.symbols.workflow)}(reservations: ${n(m.symbols.saga)}, ports: ${t.applicationPorts}${extra})(implicit ec: ExecutionContext)
    extends WorkflowProgram {
`, m.sources);
  workflowPolicyTemplate(m, out);
  if (runAreas.length) {
    out.append(`  /** Read-only preflight: caller manifests are never sufficient recovery authority. */
  def authorizeRunRecovery(m: BatchManifest, authorization: String): Future[Unit] = Future {
    require(m != null && action(m.area) == "run", "recovery requires a declared Run area")
    val area = definition.byId(m.area)
    require(m.policyVersion == area.policyVersion && m.items.nonEmpty && m.items.size <= area.batch.maxItems,
      "recovery manifest policy/cardinality mismatch")
    require(m.items.map(_.itemId).distinct.size == m.items.size && m.items.map(_.sequence).distinct.size == m.items.size &&
      m.items.forall(i => i.area == m.area && i.payload.size <= definition.settings.maxItemBytes) &&
      m.items.map(_.compatibilityKey).distinct.size == 1, "recovery manifest item shape mismatch")
    require(BatchCodec.manifestFromBytes(BatchCodec.manifestToBytes(m)) == m, "recovery manifest roundtrip mismatch")
    m.items.map { item =>
      val request = ${codecs}.request.decode(item.payload).get
      require(${codecs}.request.encode(request) == item.payload, "noncanonical original request")
      ${n(m.symbols.saga)}.expected(key(m, item), request)
    }
  }.flatMap { expected =>
    Future.sequence(expected.map { association =>
      ports.associations.query(association.item).map { saved =>
        require(saved.contains(association), "durable original association missing or mismatched")
        ports.recoveryAuthorization.authorize(association.saga, authorization).fold(e => throw new IllegalArgumentException(e), _ => ())
      }
    }).map(_ => ())
  }
  /** One bounded pass; acceptance of reconciliation is not a committed Run terminal. */
  private def recoveryProgress(m: BatchManifest, authorization: String, reactivate: Boolean): Future[Either[String, Boolean]] =
    authorizeRunRecovery(m, authorization).flatMap { _ =>
      Future.sequence(m.items.map { item =>
        runItem(m.area, m.operationKey, key(m, item), ${codecs}.request.decode(item.payload).get, submit = false, reactivate = reactivate)
      }).map(items => Right(items.forall(_.result.terminal)): Either[String, Boolean])
    }.recover { case scala.util.control.NonFatal(e) => Left(Option(e.getMessage).getOrElse(e.getClass.getName)) }
  def reactivate(m: BatchManifest, authorization: String): Future[Either[String, Boolean]] =
    recoveryProgress(m, authorization, reactivate = true)
  def canResume(m: BatchManifest, authorization: String): Future[Either[String, Boolean]] =
    recoveryProgress(m, authorization, reactivate = false)
  private def runItem(area: String, outerOperationKey: String, itemId: ${t.item}, request: ${n(m.request)}, submit: Boolean,
      reactivate: Boolean = false): Future[${t.itemResult}] = {
    val association = ${n(m.symbols.saga)}.expected(itemId, request)
    val payload = ${resultPayload(m, 'association.saga.transactionId', 'request')}
    val saved = if (submit) ports.associations.ensure(association)
      else ports.associations.query(itemId).map(_.getOrElse(throw new IllegalArgumentException("durable original association missing")))
    saved.flatMap { confirmed =>
      require(confirmed == association, "durable original association mismatch")
      area match {
`, runAreas.map(a => a.source));
    for (const area of runAreas) {
      const mapping = area.runMapping, run = mapping.run, name = n(run.symbol);
      out.append(`      case ${q(area.id)} =>
        val input = ${fqn(run.protocol)}.Input(${mapping.inputs.map(row => `${row.identifier} = ${row.source === 'request' ? 'request' : 'association.saga.transactionId'}`).join(', ')})
        val runId = ${codecs}.identityDigest(Vector(${q(run.binding.run.definitionId)}.getBytes("UTF-8").toVector,
          ${codecs}.item.encode(itemId), outerOperationKey.getBytes("UTF-8").toVector))
        def mapped(code: String, value: ${n(m.result)}): ${t.sagaResult} = code match {
${mapping.outcomes.map(row => `          case ${q(row.code)} => ${t.sagaResult}.${row.name}(value)`).join('\n')}
          case _ => throw new IllegalArgumentException("undeclared Run outcome mapping")
        }
        val read = if (reactivate) ${run.hostIdentifier}.reconcile(runId, input)
          else if (submit) ${run.hostIdentifier}.ensure(runId, input) else ${run.hostIdentifier}.query(runId, input)
        read.map {
          case Left(reason) if reactivate => throw new IllegalArgumentException(reason)
          case Right(Some(${name}.Completed(state, output))) =>
            require(state.runId == runId && state.input == input, "Run original input mismatch")
            val value = output.${mapping.output.identifier}
            require(value.${m.result.requestField} == request && value.${m.result.transactionField} == association.saga.transactionId,
              "Run output changed original request or transaction identity")
            ${t.itemResult}(itemId, ${t.sagaResult}.${mapping.completedResult}(value), None)
          case Right(Some(${name}.Stopped(state, stepId, code, _))) =>
            require(state.runId == runId && state.input == input && stepId == ${q(run.steps[0].id)}, "Stopped Run original input/step mismatch")
            // Authored onStopped=original-item: no success output exists on this path.
            ${t.itemResult}(itemId, mapped(code, payload), None)
          case _ => ${t.itemResult}(itemId, ${t.sagaResult}.OutcomeUnknown(payload), None)
        }
`, [area.source, run.source, ...run.sources]);
    }
    out.append(`      case _ => Future.failed(new IllegalArgumentException("unknown typed Run area"))
      }
    }
  }
`, runAreas.map(a => a.source));
  }
  out.append(`  private def key(m: BatchManifest, i: Item): ${t.item} = ${t.item}(m.jobId, i.sequence, i.itemId)
  private def resultBytes(value: ${t.manifestResult}): ByteString = ByteString.fromArray(${codecs}.manifestResult.encode(value).toArray)
`, [m.workflow.source]);
  workflowEvidenceTemplate(m, out);
  out.append(`  def connector(area: String): ExternalOperationPort = {
    val (_, id, version, _) = pins(area)
    new ExternalOperationPort {
      val connectorId = id
      val connectorVersion = version
      private def observe(r: Op.Request, submit: Boolean, last: Option[Op.Evidence]): Future[Op.Observation] = {
        val m = manifest(r, area)
`, [m.workflow.source]);
  out.append(`        val reads = m.items.map { item =>
          val itemId = key(m, item); val request = ${codecs}.request.decode(item.payload).get
${runAreas.length ? '          if (action(area) == "run") runItem(area, r.operationKey, itemId, request, submit) else {\n' : ''}          val read = if (action(area) == "invoke-saga" && submit) reservations.start(itemId, request)
            else reservations.query(itemId)
          read.flatMap { result =>
            require(result.payload.${m.result.requestField} == request, "manifest original payload mismatch")
            if (action(area) == "publish-result" && result.terminal) {
              (if (submit) reservations.publish(itemId) else reservations.queryPublished(itemId)).map {
                case ${t.resultObservation}.Confirmed(receipt) => ${t.itemResult}(itemId, result, Some(receipt))
                case _ => ${t.itemResult}(itemId, ${t.sagaResult}.OutcomeUnknown(result.payload), None)
              }
            } else Future.successful(${t.itemResult}(itemId, result, None))
          }
${runAreas.length ? '          }\n' : ''}        }
        Future.sequence(reads).map { items =>
          if (!items.forall(_.result.terminal)) Op.Unknown("one or more original items are nonterminal")
          else {
            val bytes = resultBytes(${t.manifestResult}(items))
            val terminal = Op.Succeeded(bytes, evidence(m, r, bytes))
            validateTerminal(m, terminal).fold(e => throw new IllegalArgumentException(e), _ => ())
            Op.Confirmed(terminal)
          }
        }.recover { case scala.util.control.NonFatal(e) => Op.Unknown(e.getMessage) }
`, m.workflow.areas.map(a => a.source));
  out.append(`      }
      def submit(r: Op.Request): Future[Op.Observation] = observe(r, true, None)
      def query(r: Op.Request, last: Option[Op.Evidence]): Future[Op.Observation] = observe(r, false, last)
      override def validateEvidence(r: Op.Request, observation: Op.WithEvidence): Either[String, Unit] = observation match {
        case Op.Confirmed(terminal) => validateTerminal(manifest(r, area), terminal).map(_ => ())
        case _ => Left("only confirmed original item results provide evidence")
      }
    }
  }
`, [m.workflow.source]);
  workflowCompletionTemplate(m, out);
  out.append('}\n', [m.workflow.source]);
}
