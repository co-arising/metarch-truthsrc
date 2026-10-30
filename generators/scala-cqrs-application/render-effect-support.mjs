import { entry, packageFor, pathFor } from '../scala-cqrs-domain/naming.mjs';
export function effectConfig({ products, options }) {
  return products['effect-host-contract'].hosts.map((h, i) => {
    const pkg = packageFor(h.pipeline.ref.context, options), name = h.id.replaceAll('-', '_') + 'EffectHost';
    return 'akka.actor.serializers.effect' + i + ' = ' + JSON.stringify(pkg + '.application.' + name + 'Serializer') + '\nakka.actor.serialization-bindings.' + JSON.stringify(pkg + '.application.' + name + '$Event') + ' = effect' + i + '\n';
  }).join('');
}
export function renderEffectSupport({ products, options }, footprint) {
  return products['effect-host-contract'].hosts.flatMap((h, index) => {
    const pkg = packageFor(h.pipeline.ref.context, options), name = h.id.replaceAll('-', '_') + 'EffectHost', pbName = name.replaceAll('_', '') + 'EventPB';
    const protoPath = 'app/protobuf/' + h.id.replaceAll('-', '_') + '_effect.proto', pb = pkg + '.infrastructure.effectproto.' + pbName;
    const proto = `syntax = "proto3";
import "scalapb/scalapb.proto";
package ${pkg}.infrastructure.effectproto;
option (scalapb.options) = { flat_package: true };
message ${pbName} {
  string version = 1;
  string kind = 2;
  bytes original = 3;
  string operation = 4;
  bytes observation = 5;
  string authorization = 6;
}
`;
    const serializer = `package ${pkg}.application

import akka.serialization.SerializerWithStringManifest

final class ${name}Serializer extends SerializerWithStringManifest {
  override val identifier: Int = ${744000 + index}
  def manifest(value: AnyRef): String = { require(value.isInstanceOf[${name}.Event], "effect host event required"); "effect-event-v1" }
  def toBinary(value: AnyRef): Array[Byte] = {
    manifest(value)
    val event = value match {
      case ${name}.Intent(original, operation) => ${pb}(version = "effect-event-v1", kind = "intent", original = original, operation = operation)
      case ${name}.ObservationStored(observation) => ${pb}(version = "effect-event-v1", kind = "observation", observation = observation)
      case ${name}.RetryAuthorized(authorization, evidence) => ${pb}(version = "effect-event-v1", kind = "retry", authorization = authorization, observation = evidence)
    }
    event.toByteArray
  }
  def fromBinary(bytes: Array[Byte], manifest: String): AnyRef = {
    require(manifest == "effect-event-v1", "exact effect event manifest required")
    val event = ${pb}.parseFrom(bytes)
    require(event.version == "effect-event-v1", "exact effect event payload version required")
    event.kind match {
      case "intent" => ${name}.Intent(event.original, event.operation)
      case "observation" => ${name}.ObservationStored(event.observation)
      case "retry" => ${name}.RetryAuthorized(event.authorization, event.observation)
      case _ => throw new IllegalArgumentException("unknown effect event kind")
    }
  }
}
`;
    return [{ ...entry(protoPath, proto, 'effect-proto', [h.source], footprint), content: proto },
      entry(pathFor(pkg, 'application/' + name + 'Serializer.scala'), serializer, 'effect-serialization', [h.source], footprint, [protoPath, pathFor(pkg, 'application/' + name + '.scala')])];
  });
}
