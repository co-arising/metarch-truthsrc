import { n, types, resultPayload } from './syntax.mjs';

/** Execution certificates are validated before R2 journals terminal evidence/releases grants. */
export function workflowEvidenceTemplate(m, out) {
  const t = types(m), codecs = n(m.symbols.codecs), saga = n(m.symbols.saga);
  const owners = m.workflow.technical.proofFormat === 'owner-certificates-v1';
  if (owners) out.append(`  private def b64(value: String): String = java.util.Base64.getEncoder.encodeToString(value.getBytes("UTF-8"))
  private def unb64(value: String): String = {
    val decoded = new String(java.util.Base64.getDecoder.decode(value), "UTF-8")
    require(b64(decoded) == value, "noncanonical certificate text"); decoded
  }
  private def owners(m: BatchManifest): Vector[String] =
    (Vector(m.operationKey) ++ m.items.flatMap(_.carried.map(_.ownerOperationKey))).distinct.sorted
  private def certificates(bytes: ByteString): (String, Map[String, String]) = {
    val lines = bytes.utf8String.split("\\n", -1).toVector
    require(lines.size > 1 && lines.head.matches("[0-9a-f]{64}"), "invalid certificate digest")
    val entries = lines.tail.map { row =>
      val parts = row.split(":", -1); require(parts.length == 2, "invalid certificate row")
      unb64(parts(0)) -> unb64(parts(1))
    }
    require(entries.map(_._1).distinct.size == entries.size && entries.map(_._1) == entries.map(_._1).sorted, "certificate owner set/order mismatch")
    lines.head -> entries.toMap
  }
`, m.sources);
  out.append(`  val resourceEvidence: ResourceEvidenceValidator = new ResourceEvidenceValidator {
    override def validate(grant: ResourceProtocol.Grant, proof: ResourceProtocol.Proof): Either[String, Unit] = Try {
      require(proof.operationKey == grant.ownerOperationKey, "release owner mismatch")
${owners ? `      val (digest, rows) = certificates(proof.evidence)
      val certificate = rows.getOrElse(grant.ownerOperationKey, throw new IllegalArgumentException("missing original owner certificate"))
      ports.evidence.release(grant.ownerOperationKey, digest, certificate).fold(e => throw new IllegalArgumentException(e), identity)` : `      val parts = proof.evidence.utf8String.split("\\n", -1)
      require(parts.length == 2, "release evidence envelope mismatch")
      ports.evidence.release(proof.operationKey, parts(0), parts(1)).fold(e => throw new IllegalArgumentException(e), identity)`}
    }.toEither.left.map(_.getMessage)
  }
  private def evidence(m: BatchManifest, r: Op.Request, bytes: ByteString): Op.Evidence = {
    val digest = ${codecs}.digest(bytes.toArray.toVector)
${owners ? `    val proof = owners(m).map(owner => b64(owner) + ":" + b64(ports.executionEvidence.certify(owner, bytes.toArray.toVector)))
    val payload = ByteString((Vector(digest) ++ proof).mkString("\\n"))` : `    val proof = ports.executionEvidence.certify(r.operationKey, bytes.toArray.toVector)
    require(!proof.contains("\\n"), "certificate outside explicit digest-proof-v1 format")
    val payload = ByteString(digest + "\\n" + proof)`}
    Op.Evidence(r.operationKey, r.fingerprint, r.ledgerEpoch, Some(r.effectKey), payload)
  }
  private def validateTerminal(m: BatchManifest, terminal: Op.Terminal): Either[String, ${t.manifestResult}] = Try {
    require(terminal.isInstanceOf[Op.Succeeded], "operation not successful")
    val r = operation(m); val e = terminal.evidence
    require(e.operationKey == r.operationKey && e.requestDigest == r.fingerprint && e.ledgerEpoch == r.ledgerEpoch &&
      e.taskId.contains(r.effectKey), "operation terminal identity mismatch")
    val digest = ${codecs}.digest(terminal.result.toArray.toVector)
${owners ? `    val (recordedDigest, rows) = certificates(e.payload)
    require(recordedDigest == digest && rows.keySet == owners(m).toSet, "terminal bytes/original owners mismatch")
    rows.foreach { case (owner, certificate) =>
      ports.evidence.release(owner, digest, certificate).fold(e => throw new IllegalArgumentException(e), identity)
    }` : `    val proof = e.payload.utf8String.split("\\n", -1)
    require(proof.length == 2 && proof(0) == digest, "operation terminal bytes mismatch")
    ports.evidence.release(r.operationKey, digest, proof(1)).fold(e => throw new IllegalArgumentException(e), identity)`}
    val result = ${codecs}.manifestResult.decode(terminal.result.toArray.toVector).get
    require(result.items.map(_.item).toSet == m.items.map(key(m, _)).toSet &&
      result.items.size == m.items.size && result.items.map(_.item).distinct.size == result.items.size, "manifest item conservation")
    result.items.foreach { entry =>
      val original = m.items.find(i => key(m, i) == entry.item).get
      val request = ${codecs}.request.decode(original.payload).get
      val association = ${saga}.expected(entry.item, request)
      require(entry.result.payload == ${resultPayload(m, 'association.saga.transactionId', 'request')} && entry.result.terminal,
        "nonterminal or changed original result payload")
      if (action(m.area) == "publish-result" || entry.delivery.nonEmpty) {
        val receipt = entry.delivery.getOrElse(throw new IllegalArgumentException("settle before result acknowledgement"))
        val envelope = ${t.resultEnvelope}(association.resultKey, association.saga, entry.result, ${codecs}.result.pin,
          ${codecs}.result.encode(entry.result))
        require(receipt.key == envelope.key && receipt.identity == envelope.identity && receipt.bytes == envelope.bytes,
          "result acknowledgement identity mismatch")
        ports.evidence.result(envelope, receipt).fold(e => throw new IllegalArgumentException(e), identity)
      }
    }
    result
  }.toEither.left.map(_.getMessage)
`, [m.workflow.source, ...m.sources]);
}
