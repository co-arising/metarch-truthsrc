import { n, q, types } from './syntax.mjs';

export function sagaIdentityTemplate(m, out) {
  const t = types(m), cls = n(m.symbols.saga), codecs = n(m.symbols.codecs), req = n(m.request);
  out.append(`object ${cls} {
  val DefinitionName = ${q(m.saga.runtimeIdentity.name)}
  val DefinitionVersion = ${m.saga.runtimeIdentity.version}
  val DefinitionDigest = ${q(m.saga.definitionDigest)}
  def protobuf[A](codec: ${t.binaryCodec}[A]): PayloadCodec[A] = new PayloadCodec[A] {
    val pin = CodecPin(codec.pin.id, codec.pin.version)
    def encode(value: A): ByteString = ByteString.copyFrom(codec.encode(value).toArray)
    def decode(bytes: ByteString): Try[A] = codec.decode(bytes.toByteArray.toVector)
  }
  val argsCodec: PayloadCodec[${req}] = protobuf(${codecs}.request)
  val prepareCodec: PayloadCodec[${t.prepareReceipt}] = protobuf(${codecs}.prepare)
  val commitCodec: PayloadCodec[${t.commitReceipt}] = protobuf(${codecs}.commit)
  val compensateCodec: PayloadCodec[${t.compensateReceipt}] = protobuf(${codecs}.compensate)
  def kernel(id: TransactionIdentity): ${t.identity} = ${t.identity}(${n(m.transaction)}(id.transactionId), id.definitionName,
    id.definitionVersion, id.argsDigest, id.definitionDigest, ${t.codecIdentity}(id.argsCodec.id, id.argsCodec.version), id.planDigest)
  def runtime(id: ${t.identity}): TransactionIdentity = TransactionIdentity(id.transactionId.value, id.definitionName,
    id.definitionVersion, id.argsDigest, id.definitionDigest, CodecPin(id.argsCodec.id, id.argsCodec.version), id.planDigest)
  def kernel(id: OperationIdentity): ${t.phaseIdentity} = ${t.phaseIdentity}(kernel(id.transaction), id.participantId,
    ${n(m.field.resourceA.type)}(id.resource), id.stepId, id.phase match {
      case Phase.Prepare => ${t.phase}.Prepare
      case Phase.Commit => ${t.phase}.Commit
      case Phase.Compensate => ${t.phase}.Compensate
    })
  def expected(item: ${t.item}, request: ${req}): ${t.association} = {
    val buffer = new java.io.ByteArrayOutputStream; val out = new java.io.DataOutputStream(buffer)
    def text(value: String): Unit = {
      val bytes = value.getBytes(java.nio.charset.StandardCharsets.UTF_8); out.writeInt(bytes.length); out.write(bytes)
    }
    text("strict-saga-plan-v2"); out.writeInt(${m.saga.participants.length})
    Vector(${m.saga.participants.map(p => `(${q(p.stepId)}, ${q(p.participantId)}, request.${p.resourceField})`).join(', ')}).foreach {
      case (step, participant, resource) =>
        text(step); text(participant); text(resource.value); out.writeInt(3)
        Vector("prepare", "commit", "compensate").foreach(text); out.writeInt(3)
        Vector("prepare" -> prepareCodec.pin, "commit" -> commitCodec.pin, "compensate" -> compensateCodec.pin).foreach {
          case (phase, pin) => text(phase); text(pin.id); out.writeInt(pin.version)
        }
    }
    out.flush()
    val stable = ${codecs}.digest(${codecs}.item.encode(item))
    val identity = ${t.identity}(${n(m.transaction)}(${q(m.technical.identity.transactionPrefix)} + stable), DefinitionName, DefinitionVersion,
      ${codecs}.digest(${codecs}.request.encode(request)), DefinitionDigest, ${codecs}.request.pin,
      "sha256:" + ${codecs}.digest(buffer.toByteArray.toVector))
    ${t.association}(item, request, identity, ${q(m.technical.identity.resultPrefix)} + stable)
  }
}

`, [m.symbols.saga.source, ...m.sources]);
}
