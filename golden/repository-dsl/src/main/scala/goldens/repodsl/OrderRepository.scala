package goldens.repodsl

trait OrderRepository {
  def findById(id: String): Option[OrderState]
}

class OrderRepositoryImpl extends OrderRepository {
  def findById(id: String): Option[OrderState] = ??? // TODO
}
