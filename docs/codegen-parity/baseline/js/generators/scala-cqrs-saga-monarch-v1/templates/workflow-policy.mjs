import { n, q, map, types } from './syntax.mjs';

export function workflowPolicyTemplate(m, out) {
  const workflow = m.workflow;
  out.append(`  val definition: BatchDefinition = BatchDefinition(${q(workflow.id)}, ${q(workflow.version)}, Vector(\n`, [workflow.source]);
  workflow.areas.forEach((area, i) => {
    const b = area.batch;
    // R2 groups every candidate batch by original compatibilityKey. Its one
    // serializable CountOrWait policy also represents hard-min compatibility batches.
    const policy = b.kind === 'single' ? 'BatchPolicy.single' : `BatchPolicy.CountOrWait(${b.maxItems}, ${b.maxWaitMillis}L, ${b.minItems}, ${b.allowPartialOnClose})`;
    out.append(`    AreaDefinition(${q(area.id)}, ${q(area.version)}, ${policy}, ${map(area.resources.map(r => [r.id, r.units]))}, parallelism = ${area.parallelism}, maxExecutions = ${area.maxExecutions})${i < workflow.areas.length - 1 ? ',' : ''}\n`, [area.source]);
  });
  out.append(`  ), BatchSettings(\n${Object.entries(workflow.settings).map(([key, value]) => `    ${key} = ${value}${key.endsWith('Millis') ? 'L' : ''}`).join(',\n')}))
  val capacities: Map[String, Int] = ${map(workflow.capacities.map(c => [c.id, c.units]))}
  private def pins(area: String): (String, String, String, String) = area match {
${workflow.areas.map(a => `    case ${q(a.id)} => (${q(a.operation.stepId)}, ${q(a.operation.connectorId)}, ${q(a.operation.connectorVersion)}, ${q(a.operation.ledgerEpoch)})`).join('\n')}
    case _ => throw new IllegalArgumentException("unknown area")
  }
  private def action(area: String): String = area match {
${workflow.areas.map(a => `    case ${q(a.id)} => ${q(a.action.kind)}`).join('\n')}
    case _ => throw new IllegalArgumentException("unknown area")
  }
  def operation(m: BatchManifest): Op.Request = {
    val (step, connector, version, epoch) = pins(m.area)
    require(m.policyVersion == definition.byId(m.area).policyVersion, "manifest policy version mismatch")
    Op.Request(m.operationKey, m.batchId, step, connector, version, epoch,
      BatchCodec.manifestToBytes(m), Some(m.reservationId))
  }
  private def manifest(r: Op.Request, area: String): BatchManifest = {
    val m = BatchCodec.manifestFromBytes(r.payload)
    require(m.area == area && r == operation(m), "operation original identity mismatch")
    require(m.items.nonEmpty && m.items.size <= definition.byId(area).batch.maxItems &&
      m.items.map(_.itemId).distinct.size == m.items.size && m.items.map(_.sequence).distinct.size == m.items.size &&
      m.items.forall(_.area == area) && m.items.map(_.compatibilityKey).distinct.size == 1, "manifest item shape mismatch")
    m
  }
`, [workflow.source]);
}

export function workflowCompletionTemplate(m, out) {
  const codecs = n(m.symbols.codecs), workflow = m.workflow;
  out.append(`  def complete(m: BatchManifest, terminal: Op.Terminal): Either[String, BatchCompletion] =
    validateTerminal(m, terminal).flatMap { result =>
      val decisions = result.items.map { entry =>
        val disposition: ItemDisposition = m.area match {
`, [workflow.source]);
  const disposition = (terminal, area) => {
    if (terminal.kind === 'retry') {
      const exhausted = area.action.retry.onExhausted;
      const final = exhausted.kind === 'fail' ? 'Failed' : 'Hold';
      return `if (m.items.find(_.itemId == entry.item.itemId).exists(i => i.execution + 1 >= ${area.maxExecutions} || i.lineage.size + 1 >= definition.settings.maxTransitions)) ItemDisposition.${final}(${q(exhausted.reason)}) else ItemDisposition.Retry(${terminal.delayMillis}L)`;
    }
    return terminal.kind === 'complete' ? `ItemDisposition.Completed(${codecs}.result.encode(entry.result))`
      : terminal.kind === 'route' ? `ItemDisposition.Route(${q(terminal.target)}, ${q(terminal.compatibilityKey)}, ${terminal.delayMillis}L)`
        : 'ItemDisposition.Hold("author policy holds terminal item")';
  };
  for (const a of workflow.areas) {
    const terminal = a.completion.terminal;
    if (terminal.kind === 'by-result') {
      const cases = terminal.cases.map(c => {
        const result = m.serialization.results.find(r => r.kind === c.result);
        return `            case _: ${types(m).sagaResult}.${result.name} => ${disposition(c.disposition, a)}`;
      }).join('\n');
      out.append(`          case ${q(a.id)} => entry.result match {\n${cases}\n            case _ => ItemDisposition.Hold("nonterminal result cannot settle")\n          }\n`, [a.source]);
    } else out.append(`          case ${q(a.id)} => ${disposition(terminal, a)}\n`, [a.source]);
  }
  out.append(`          case _ => throw new IllegalArgumentException("unknown completion area")
        }
        ItemDecision(entry.item.itemId, disposition)
      }
      val proof = terminal.evidence.payload.toArray.toVector
      val (resource, retain): (ResourceDisposition, Boolean) = m.area match {
`, [workflow.source]);
  for (const a of workflow.areas) {
    const expression = a.completion.resource === 'release' ? 'ResourceDisposition.Release(proof)'
      : `ResourceDisposition.Carry(m.reservationId + ${q(workflow.technical.carry.reservationSuffix)}, m.operationKey + ${q(workflow.technical.carry.ownerSuffix)}, definition.byId(m.area).resources, proof)`;
    out.append(`        case ${q(a.id)} => (${expression}, ${a.completion.retainCarried})\n`, [a.source]);
  }
  out.append(`        case _ => throw new IllegalArgumentException("unknown completion area")
      }
      val completion = BatchCompletion(decisions, resource, retainCarried = retain)
      BatchConservation.validate(m, completion, definition.byId, definition.settings.maxTransitions).toLeft(completion)
    }
  override def verifyRoute(item: Item, area: String): Either[String, Unit] = area match {
${workflow.areas.filter(a => a.verification).map(a => `    case ${q(a.id)} => ${codecs}.request.decode(item.payload).toEither.left.map(_.getMessage).map(_ => ())`).join('\n')}
    case _ => Left("area is not an explicitly declared query-only verification route")
  }
`, [workflow.source]);
}
