package net.imadz.codegen.scaffolding.cqrs

// 1. 强类型定义 (Value Class 零运行时开销)
case class NestedTypeName(name: String) extends AnyVal
case class OwnerEntityName(name: String) extends AnyVal

// 2. 符号表封装
case class SymbolTable(private val owners: Map[NestedTypeName, OwnerEntityName] = Map.empty) {

  // 查表逻辑
  def resolve(nested: NestedTypeName): Option[OwnerEntityName] = owners.get(nested)

  // 合并逻辑 (带冲突检测)
  def ++(other: SymbolTable): SymbolTable = {
    // 找出冲突的 Key
    val duplicates = owners.keySet.intersect(other.owners.keySet)
    if (duplicates.nonEmpty) {
      throw new IllegalArgumentException(s"Duplicate nested types detected during merge: ${duplicates.map(_.name).mkString(", ")}")
    }
    copy(owners = owners ++ other.owners)
  }
}

object SymbolTable {
  val empty = SymbolTable()

  // 3. 优雅的 DSL 支持
  // 允许写法: "CreditBalanceState" belongsTo "CreditBalanceEntity"
  implicit class SymbolTableDSL(val nested: String) extends AnyVal {
    def belongsTo(owner: String): (NestedTypeName, OwnerEntityName) =
      NestedTypeName(nested) -> OwnerEntityName(owner)
  }

  // 工厂方法 (带冲突检测)
  def of(entries: (NestedTypeName, OwnerEntityName)*): SymbolTable = {
    // 检查重复 Key
    val grouped = entries.groupBy(_._1)
    val duplicates = grouped.filter(_._2.size > 1).keys

    if (duplicates.nonEmpty) {
      throw new IllegalArgumentException(s"Duplicate nested types defined in SymbolTable: ${duplicates.map(_.name).mkString(", ")}")
    }

    SymbolTable(entries.toMap)
  }
}
