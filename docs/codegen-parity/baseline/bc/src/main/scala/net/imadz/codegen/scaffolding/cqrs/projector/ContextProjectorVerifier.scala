package net.imadz.codegen.scaffolding.cqrs.projector

import net.imadz.codegen.scaffolding.cqrs.model.domain._
import net.imadz.codegen.scaffolding.cqrs.model.application._
import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.api._
import net.imadz.codegen.scaffolding.cqrs.{
  FieldDef,
  GeneratorContext,
  TypeRef,
  TypeResolver
}
import net.imadz.meta.{DomainEntityMetadata, EventFamilyRef}

object ContextProjectorVerifier extends App {

  println(">>> Starting Context Projector Verification...")

  // Mock-like Context
  val mockContext = GeneratorContext(
    rootPackage = "net.imadz",
    frameworkPackage = "net.imadz.framework",
    moduleName = "example"
  )

  def verify(name: String)(block: => Unit): Unit = {
    try {
      println(s"\n--- Verifying $name ---")
      block
      println(s"    [OK] $name verified.")
    } catch {
      case e: Throwable =>
        println(s"    [FAILED] $name: ${e.getMessage}")
        e.printStackTrace()
    }
  }

  // 1. Domain Entity
  verify("Domain Entity") {
    val entityModel = DomainEntityModel(
      selfType = TypeRef("MyEntity", "net.imadz.domain"),
      state = StateModel(
        "MyState",
        Seq(FieldDef("bal", TypeRef("Int", "scala"))),
        TypeRef("net.imadz.domain.MyEntity", "MyState")
      ),
      eventFamily = EventFamilyModel(
        "MyEvents",
        TypeRef("MyEvents", "net.imadz.domain.MyEntity"),
        Seq(
          EventModel(
            "Created",
            TypeRef("Created", "net.imadz.domain.MyEntity.MyEvents"),
            Seq(FieldDef("id", TypeRef("String", "java.lang")))
          )
        )
      ),
      // identifierType removed as per definition
      dependencies = Set.empty
    )

    val bundle = ContextProver.prove(entityModel, mockContext)
    // println(bundle.renderMarkdown)

    assert(bundle.target.fileName == "MyEntity.scala")
    assert(bundle.dependencies.map(_.fileName).contains("MyState.scala"))
  }

  // 2. Aggregate Root
  verify("Aggregate Root") {
    val rootModel = AggregateRootModel(
      selfType = TypeRef("MyAggregate", "net.imadz.app"),
      commandFamilyType = TypeRef("MyCommands", "net.imadz.app"),
      stateType = TypeRef("MyState", "net.imadz.domain"),
      eventType = TypeRef("MyEvents", "net.imadz.domain"),
      behaviorObject = TypeRef("MyBehavior", "net.imadz.app"),
      sharding = ShardingModel("MyTypeKey", "MyTag", 3),
      inlineEvents = Nil,
      inlineState = None,
      stepsFactory = None,
      dependencies = Set.empty
    )

    val bundle = ContextProver.prove(rootModel, mockContext)
    println(bundle.renderMarkdown)

    assert(bundle.target.content.contains("trait MyAggregate"))
  }

  // 3. Controller
  verify("Controller") {
    val ctrlModel = ControllerModel(
      selfType = TypeRef("MyController", "net.imadz.infra"),
      basePath = "/api/v1",
      injectedServices = Nil,
      endpoints = Seq(
        EndpointModel(
          "GET",
          "/test",
          "testAction",
          Nil,
          "srv.do",
          TypeRef("String", "java.lang")
        )
      ),
      dependencies = Set.empty
    )

    val bundle = ContextProver.prove(ctrlModel, mockContext)
    println(bundle.renderMarkdown)

    assert(bundle.target.content.contains("/api/v1/test"))
  }

  println("\n>>> Verification Complete.")
}
