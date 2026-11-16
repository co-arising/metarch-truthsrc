package net.imadz.codegen.scaffolding.cqrs.builder.application.transactor

import net.imadz.codegen.scaffolding.cqrs._
import net.imadz.codegen.scaffolding.cqrs.model.application.transactor._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.execution._

object StrictSagaModuleBuilder {
  def build(pinned: PinnedSagaExecution, ctx: GeneratorContext): StrictSagaModuleModel = {
    val s = pinned.execution
    val r = ctx.typeResolver
    val n = NamingConventions
    val module = r.strictModule(s.contract.binding.module)
    def nested(stem: String, role: String): TypeRef = r.strictNested(module, n.strictNestedName(stem, role))
    def field(slot: SagaSlot): FieldDef = FieldDef(slot.slot, r.strictValue(s.args.types.find(_.id == slot.typeId).get.dataType))
    val addresses = s.contract.definition.payload.participants.map { p =>
      val binding = s.contract.binding.participants.find(_.participantId == p.id).get
      p.id -> StrictAddressModel(n.strictMember(n.strictSymbol(p.id), "Resource"), p.id, p.resourceSlot,
        r.strictValue(s.args.types.find(_.id == p.resourceType).get.dataType), binding.addressing)
    }.toMap
    val steps = s.schedule.prepare.map { id =>
      val p = s.participants.find(_.stepId == id).get
      val address = addresses(p.participantId)
      val phases = SagaPhase.all.map { phase =>
        val ph = p.phases.find(_.phase == phase).get
        val stem = n.strictPhaseStem(p.stepId, phase.wire)
        val reads = ph.inputs.collect { case SagaInput(_, _, SagaValueSource.StepReceipt(producerId, producerPhase, _)) =>
          (producerId, producerPhase)
        }.distinct.zipWithIndex.map { case ((producerId, producerPhase), index) =>
          val producer = s.participants.find(_.stepId == producerId).get
          val producerStem = n.strictPhaseStem(producerId, producerPhase.wire)
          val pin = pinned.pins.receiptCodecs.find(x => x.stepId == producerId && x.phase == producerPhase).get.codecs.runtimeCodec
          StrictReceiptReadModel(n.strictMember(producerStem, index.toString), producerId, producerPhase,
            producer.participantId, addresses(producer.participantId), nested(producerStem, "Receipt"),
            n.strictMember(producerStem, "Binding"), pin)
        }
        StrictPhaseModel(stem, n.strictMember(stem, "Binding"), nested(stem, "Input"), nested(stem, "Receipt"),
          ph.inputs.map(i => field(SagaSlot(i.slot, i.typeId))), ph.outputs.map(field), ph.inputs, reads,
          id, p.participantId, address, ph)
      }
      StrictStepModel(id, p.participantId, address, phases)
    }
    val triggers = s.triggers.map { t =>
      val source = t.declaration.source match {
        case SagaTriggerSource.Command(ref) => r.command(ref.command)
        case SagaTriggerSource.Event(ref) => r.event(ref.event)
      }
      StrictTriggerModel(n.strictMember(n.strictSymbol(t.declaration.id), "Trigger"), source, t)
    }
    val completions = s.completions.map { c =>
      StrictCompletionModel(n.strictMember(n.strictSymbol(c.kind.wire), "Completion"),
        nested(n.firstUpper(n.strictSymbol(c.kind.wire)), "CompletionInput"), r.event(c.event.event),
        c.inputs.map(i => field(SagaSlot(i.slot, i.typeId))), c)
    }
    val fields = s.args.slots.map(field)
    val deps = fields.map(_.typeRef).toSet ++ steps.flatMap(_.phases).flatMap(p => p.inputFields ++ p.outputFields).map(_.typeRef) ++
      triggers.map(_.sourceType) ++ completions.map(_.eventType) ++
      Set(r.strictRuntime("StrictSagaDefinition"), r.strictRuntime("StrictSagaCoordinator"), r.strictRuntime("PhasePort"))
    StrictSagaModuleModel(module, nested("", "Args"), fields, steps, triggers, completions, pinned, deps)
  }
}
