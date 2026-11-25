package example.bankwealth.modules

import akka.actor.{ActorSystem, ExtendedActorSystem}
import com.google.inject.{AbstractModule, Provides}
import example.bankwealth.infrastructure.bootstrap.ApplicationBootstrap

final class BootstrapModule extends AbstractModule {
  override def configure(): Unit = {
    bind(classOf[ApplicationBootstrap]).asEagerSingleton()
  }

  @Provides
  def provideExtendedSystem(system: ActorSystem): ExtendedActorSystem =
    system.asInstanceOf[ExtendedActorSystem]
}
