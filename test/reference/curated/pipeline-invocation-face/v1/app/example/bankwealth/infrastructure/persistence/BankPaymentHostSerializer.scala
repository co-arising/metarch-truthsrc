package example.bankwealth.infrastructure.persistence

import akka.serialization.SerializerWithStringManifest
import example.bankwealth.infrastructure.process.BankPaymentHost
import net.imadz.infra.saga.strict.StrictSagaProtoConverters
import net.imadz.infra.saga.strict.proto.saga_strict.TransactionIdentityPO

/** Wire codec of the host event journal. Event identities stay the declared
  * protobuf shapes (the proto face owns the schema); the `operation` field of
  * the PB carries the result-kind wire for result events until the proto face
  * gains a dedicated kind slot (proto-family replacement). Unknown event
  * kinds refuse to deserialize. */
final class BankPaymentHostSerializer extends SerializerWithStringManifest {
  override val identifier: Int = 742000

  private val Manifest = "event-v1"

  override def manifest(value: AnyRef): String = {
    require(value.isInstanceOf[BankPaymentHost.Event], "host event required")
    Manifest
  }

  override def toBinary(value: AnyRef): Array[Byte] = {
    manifest(value)
    val pb = value match {
      case BankPaymentHost.AdmissionGranted =>
        example.bankwealth.infrastructure.hostproto.bankpaymenthostHostEventPB(kind = "admitted")
      case BankPaymentHost.Associated(original, args, operation) =>
        example.bankwealth.infrastructure.hostproto.bankpaymenthostHostEventPB(kind = "associated",
            original = original, args = args, operation = operation)
      case BankPaymentHost.IdentityObserved(identity) =>
        example.bankwealth.infrastructure.hostproto.bankpaymenthostHostEventPB(kind = "identity",
            identity = StrictSagaProtoConverters.identityToProto(identity).toByteString)
      case BankPaymentHost.ResultIntent(kind) =>
        example.bankwealth.infrastructure.hostproto.bankpaymenthostHostEventPB(kind = "result", operation = kind.wire)
      case BankPaymentHost.DeliveryAcknowledged(kind) =>
        example.bankwealth.infrastructure.hostproto.bankpaymenthostHostEventPB(kind = "delivered",
            operation = kind.wire)
    }
    pb.toByteArray
  }

  override def fromBinary(bytes: Array[Byte], manifest: String): AnyRef = {
    require(manifest == Manifest, "host event version required")
    val pb = example.bankwealth.infrastructure.hostproto.bankpaymenthostHostEventPB.parseFrom(bytes)
    pb.kind match {
      case "admitted" => BankPaymentHost.AdmissionGranted
      case "associated" => BankPaymentHost.Associated(pb.original, pb.args, pb.operation)
      case "identity" =>
          BankPaymentHost
              .IdentityObserved(StrictSagaProtoConverters
                  .identityFromProto(TransactionIdentityPO.parseFrom(pb.identity.toByteArray)))
      case "result" =>
        resultKind(pb.operation) match {
          case Some(kind) => BankPaymentHost.ResultIntent(kind)
          case None => refuse(pb.kind, pb.operation)
        }
      case "delivered" =>
        resultKind(pb.operation) match {
          case Some(kind) => BankPaymentHost.DeliveryAcknowledged(kind)
          case None => refuse(pb.kind, pb.operation)
        }
      case other => refuse(other, pb.operation)
    }
  }

  private def resultKind(wire: String): Option[BankPaymentHost.ResultKind] =
    BankPaymentHost.ResultKind.fromWire(wire)

  private def refuse(kind: String, payload: String): Nothing =
    throw new IllegalArgumentException(s"unknown host event kind \"$kind\" payload \"$payload\"")
}
