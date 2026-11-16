package net.imadz.codegen.scaffolding.cqrs.template.products

import net.imadz.codegen.scaffolding.cqrs.model.products._
import net.imadz.codegen.structure.NamingConventions

object ProductVerificationTemplate {
  def tests(model: ProductDomainModel): String = model.verificationCases.map { c =>
    val aggregate = model.aggregates.find(_.declaration.ref == c.aggregate).get
    val command = aggregate.commands.find(_.command == c.command).get
    val pkg = model.packages(c.aggregate.context); val name = NamingConventions.productSymbol(c.aggregate.id); val full = pkg + ".domain."
    def state(values: Vector[(String, net.imadz.meta.products.ImmutableJson)]): String = full + name + "State(" + aggregate.defaults.map(d => ProductDomainTemplate.literal(values.toMap.apply(d.target.id), d.valueType, model)).mkString(", ") + ")"
    val params = command.declaredSignature.map(d => ProductDomainTemplate.literal(c.parameters.toMap.apply(d.ref.id), d.valueType, model)).mkString(", ")
    val expected = if (c.expected.kind == "refused") full + name + "Aggregate.Refused(" + ujson.write(c.expected.code.get) + ")" else {
      val events = c.expected.events.map { e =>
        val event = aggregate.events.find(_.event == e.event).get
        full + name + "Protocol." + NamingConventions.productSymbol(e.event.id) + "(" + event.declaredSlots.map(d => ProductDomainTemplate.literal(e.slots.toMap.apply(d.ref.id), d.valueType, model)).mkString(", ") + ")"
      }
      full + name + "Aggregate.Accepted(Vector(" + events.mkString(", ") + "))"
    }
    "  test(" + ujson.write(c.id + ": actual command persistence and same-identity actor replay") + ") {\n" +
      "    val config = ConfigFactory.parseString(\"akka.actor.provider = local\").withFallback(PersistenceTestKitPlugin.config).withFallback(ConfigFactory.load())\n    val kit = ActorTestKit(config)\n" +
      "    try {\n      val pid = " + ujson.write("case/" + c.id) + "\n      val hosts = new " + full + name + "Computations {}\n      val initial = " + state(c.state) + "\n" +
      "      val ref = kit.spawn(" + full + name + "Aggregate(pid, initial, hosts))\n      val reply = kit.createTestProbe[" + full + name + "Aggregate.Reply]()\n" +
      "      ref ! " + full + name + "Aggregate.Execute(" + full + name + "Protocol." + NamingConventions.productSymbol(c.command.id) + "(" + params + "), reply.ref)\n      reply.expectMessage(" + expected + ")\n" +
      "      val probe = kit.createTestProbe[" + full + name + "State]()\n      ref ! " + full + name + "Aggregate.GetState(probe.ref)\n      probe.expectMessage(" + state(c.expected.state) + ")\n" +
      "      kit.stop(ref)\n      val recovered = kit.spawn(" + full + name + "Aggregate(pid, initial, hosts))\n      recovered ! " + full + name + "Aggregate.GetState(probe.ref)\n      probe.expectMessage(" + state(c.expected.state) + ")\n" +
      "    } finally kit.shutdownTestKit()\n  }\n"
  }.mkString
}
