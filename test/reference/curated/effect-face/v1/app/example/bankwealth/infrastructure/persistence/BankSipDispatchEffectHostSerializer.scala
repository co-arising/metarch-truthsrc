package example.bankwealth.infrastructure.persistence

import akka.serialization.SerializerWithStringManifest
import example.bankwealth.infrastructure.connectors.BankSipDispatchEffectHost

/** Wire codec of the effect-host event journal. Event identities stay the
  * declared protobuf shapes (the proto face owns the schema). Unknown event
  * kinds refuse to deserialize; the payload version is pinned. */
final class BankSipDispatchEffectHostSerializer extends SerializerWithStringManifest {
  override val identifier: Int = 744000

  private val Manifest = "effect-event-v1"

  override def manifest(value: AnyRef): String = {
    require(value.isInstanceOf[BankSipDispatchEffectHost.Event], "effect host event required")
    Manifest
  }

  override def toBinary(value: AnyRef): Array[Byte] = {
    manifest(value)
    val event = value match {
      case BankSipDispatchEffectHost.Intent(original, operation) =>
        example.bankwealth.infrastructure.effectproto.banksipdispatchEffectHostEventPB(version = Manifest,
            kind = "intent", original = original, operation = operation)
      case BankSipDispatchEffectHost.ObservationStored(observation) =>
        example.bankwealth.infrastructure.effectproto.banksipdispatchEffectHostEventPB(version = Manifest,
            kind = "observation", observation = observation)
      case BankSipDispatchEffectHost.RetryAuthorized(authorization, evidence) =>
        example.bankwealth.infrastructure.effectproto.banksipdispatchEffectHostEventPB(version = Manifest,
            kind = "retry", authorization = authorization, observation = evidence)
    }
    event.toByteArray
  }

  override def fromBinary(bytes: Array[Byte], manifest: String): AnyRef = {
    require(manifest == Manifest, "exact effect event manifest required")
    val event = example.bankwealth.infrastructure.effectproto.banksipdispatchEffectHostEventPB.parseFrom(bytes)
    require(event.version == Manifest, "exact effect event payload version required")
    event.kind match {
      case "intent" => BankSipDispatchEffectHost.Intent(event.original, event.operation)
      case "observation" => BankSipDispatchEffectHost.ObservationStored(event.observation)
      case "retry" => BankSipDispatchEffectHost.RetryAuthorized(event.authorization, event.observation)
      case other => throw new IllegalArgumentException(s"unknown effect event kind \"$other\"")
    }
  }
}
