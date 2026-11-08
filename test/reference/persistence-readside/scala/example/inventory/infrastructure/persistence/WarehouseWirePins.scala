package example.inventory.infrastructure.persistence

// Actual REAL aggregateCoreFixture/family2 serialization layouts, independently
// checked against the unchanged original inventory_domain.proto + converter.
// Evidence: .rounds/persistence-readside-7ci6expr/wire-layout-diagnostic.json
object WarehouseWirePins {
  val reserved: String = "1eccd9ea9c05f5be946f4004559f989bcacdc380c543e4f8fd3c31888e8d7384"
  val committed: String = "52f2395e2b6abfa6dafaaea866918efe3ec022ff5835981f6c18e80bbdaa8c80"
  val state: String = "fe21099de54414f4a08cdf8342f685ed8941569876f11f5ae3bfa54cda2b5ba7"
}
