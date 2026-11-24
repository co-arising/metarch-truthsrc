package example.bankwealth.infrastructure.persistence

import akka.serialization.SerializerWithStringManifest
import example.bankwealth.application.integration.BankTaEffectHost

/** Wire codec of the effect-host event journal. Event identities stay the
  * declared protobuf shapes (the proto face owns the schema). Unknown event
  * kinds refuse to deserialize; the payload version is pinned. */
final class BankTaEffectHostSerializer extends SerializerWithStringManifest {
  override val identifier: Int = 744001

  private val Manifest = "effect-event-v1"

  override def manifest(value: AnyRef): String = {
    require(value.isInstanceOf[BankTaEffectHost.Event], "effect host event required")
    Manifest
  }

  override def toBinary(value: AnyRef): Array[Byte] = {
    manifest(value)
    val event = value match {
      case BankTaEffectHost.Intent(original, operation) =>
        example.bankwealth.infrastructure.effectproto.banktaeffectEffectHostEventPB(version = Manifest,
            kind = "intent", original = original, operation = operation)
      case BankTaEffectHost.ObservationStored(observation) =>
        example.bankwealth.infrastructure.effectproto.banktaeffectEffectHostEventPB(version = Manifest,
            kind = "observation", observation = observation)
      case BankTaEffectHost.RetryAuthorized(authorization, evidence) =>
        example.bankwealth.infrastructure.effectproto.banktaeffectEffectHostEventPB(version = Manifest,
            kind = "retry", authorization = authorization, observation = evidence)
    }
    event.toByteArray
  }

  override def fromBinary(bytes: Array[Byte], manifest: String): AnyRef = {
    require(manifest == Manifest, "exact effect event manifest required")
    val event = example.bankwealth.infrastructure.effectproto.banktaeffectEffectHostEventPB.parseFrom(bytes)
    require(event.version == Manifest, "exact effect event payload version required")
    event.kind match {
      case "intent" => BankTaEffectHost.Intent(event.original, event.operation)
      case "observation" => BankTaEffectHost.ObservationStored(event.observation)
      case "retry" => BankTaEffectHost.RetryAuthorized(event.authorization, event.observation)
      case other => throw new IllegalArgumentException(s"unknown effect event kind \"$other\"")
    }
  }
}
