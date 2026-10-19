package goldens.bootdsl

import com.google.inject.AbstractModule

class BankModule extends AbstractModule {
  override def configure(): Unit = {
  bind(classOf[OrderRepository]).to(classOf[OrderRepositoryImpl])
  }
}
