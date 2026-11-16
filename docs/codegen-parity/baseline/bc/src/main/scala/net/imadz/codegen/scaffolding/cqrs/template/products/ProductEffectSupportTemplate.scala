package net.imadz.codegen.scaffolding.cqrs.template.products

import net.imadz.codegen.scaffolding.cqrs.model.products._
import net.imadz.codegen.structure.NamingConventions

object ProductEffectSupportTemplate {
  def generate(model: ProductApplicationModel): Vector[ProductSourceModel] = model.effectHosts.zipWithIndex.flatMap { case (h, index) =>
    val pkg = model.domain.packages(h.pipeline.ref.context)
    val stem = NamingConventions.strictSymbol(h.id) + "EffectHost"
    val pbName = stem.replace("_", "") + "EventPB"
    val pb = pkg + ".infrastructure.effectproto." + pbName
    val proto = s"""syntax = "proto3";
import "scalapb/scalapb.proto";
package $pkg.infrastructure.effectproto;
option (scalapb.options) = { flat_package: true };
message $pbName {
  string version = 1;
  string kind = 2;
  bytes original = 3;
  string operation = 4;
  bytes observation = 5;
  string authorization = 6;
}
"""
    val serializer = s"""package $pkg.application

import akka.serialization.SerializerWithStringManifest

final class ${stem}Serializer extends SerializerWithStringManifest {
  override val identifier: Int = ${744000 + index}
  def manifest(value: AnyRef): String = { require(value.isInstanceOf[$stem.Event], "effect host event required"); "effect-event-v1" }
  def toBinary(value: AnyRef): Array[Byte] = {
    manifest(value)
    val event = value match {
      case $stem.Intent(original, operation) => $pb(version = "effect-event-v1", kind = "intent", original = original, operation = operation)
      case $stem.ObservationStored(observation) => $pb(version = "effect-event-v1", kind = "observation", observation = observation)
      case $stem.RetryAuthorized(authorization, evidence) => $pb(version = "effect-event-v1", kind = "retry", authorization = authorization, observation = evidence)
    }
    event.toByteArray
  }
  def fromBinary(bytes: Array[Byte], manifest: String): AnyRef = {
    require(manifest == "effect-event-v1", "exact effect event manifest required")
    val event = $pb.parseFrom(bytes)
    require(event.version == "effect-event-v1", "exact effect event payload version required")
    event.kind match {
      case "intent" => $stem.Intent(event.original, event.operation)
      case "observation" => $stem.ObservationStored(event.observation)
      case "retry" => $stem.RetryAuthorized(event.authorization, event.observation)
      case _ => throw new IllegalArgumentException("unknown effect event kind")
    }
  }
}
"""
    Vector(ProductSourceModel("app/protobuf/" + NamingConventions.strictSymbol(h.id) + "_effect.proto", proto, "effect-proto", Vector(h.source), model.footprint),
      ProductSourceModel(NamingConventions.productPackagePath(pkg, "application/" + stem + "Serializer.scala"), serializer, "effect-serialization", Vector(h.source), model.footprint))
  }
  def config(model: ProductApplicationModel): String = model.effectHosts.zipWithIndex.map { case (h, i) =>
    val pkg = model.domain.packages(h.pipeline.ref.context); val stem = NamingConventions.strictSymbol(h.id) + "EffectHost"
    "akka.actor.serializers.effect" + i + " = " + ujson.write(pkg + ".application." + stem + "Serializer") + "\nakka.actor.serialization-bindings." + ujson.write(pkg + ".application." + stem + "$Event") + " = effect" + i + "\n"
  }.mkString
}
