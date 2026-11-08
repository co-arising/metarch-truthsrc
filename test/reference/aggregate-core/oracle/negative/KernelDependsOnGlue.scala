package example.inventory.aggregatecore.reference.negative

// Compile this control with only kernel output and Scala standard library,
// NOT the glue/Akka classpath. Expected missing application/glue import.
import example.inventory.application.aggregates.WarehouseActorProtocol

object KernelDependsOnGlue {
  def broken(command: WarehouseActorProtocol.Command): WarehouseActorProtocol.Command = command
}
