package example.stockreservation.application.services.transactor

/** Generated fixture host family (strict-fixture-host): wire-level type alias
  * surface for the stock-transfer fixture. Every declared scalar is framed as
  * length-prefixed text on the fixture wire (F7 ruling: Integer and Enumeration
  * map to Text); this object keeps the module's type ids in wire order. Kebab
  * contract ids are rewritten to lowerCamel members (family ruling F3, same
  * symbol table as the module); the raw template would emit the ids verbatim
  * and fail scalac. Wire aliases are text, not the module's typed fields — the
  * codec layer owns the text-to-typed conversion. */
object types {

  type transactionId = String
  type warehouseId = String
  type sku = String
  type quantity = String
  type transferMode = String
  type transferId = String
}
