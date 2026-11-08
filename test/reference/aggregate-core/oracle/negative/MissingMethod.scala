package example.inventory.aggregatecore.reference.negative

import example.inventory.domain.ports.WarehouseComputations

// Expected compile failure: concrete host omits reservationIdentity.
final class MissingMethod extends WarehouseComputations
