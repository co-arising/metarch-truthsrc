package net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.proto

import net.imadz.codegen.scaffolding.cqrs.{GeneratorContext, TypeRef}
import net.imadz.codegen.structure.NamingConventions

/**
  * 统一管理 Scala 类型到 Proto 类型的映射逻辑
  */
object ProtoTypeMapper {

  /**
    * 将 Scala 类型引用转换为对应的 Proto 类型字符串
    *
    * @param t   Scala 类型引用
    * @param ctx 生成器上下文
    * @return Proto 类型字符串
    */
  def toProtoTypeString(t: TypeRef, ctx: GeneratorContext): String = {
    t.name match {
      case "String" | "Id" | "UUID" | "Currency" => "string"
      case "Int" => "int32"
      case "Long" | "Instant" => "int64"
      case "Double" | "BigDecimal" => "double"
      case "Boolean" => "bool"
      case "Option" if t.typeParams.nonEmpty =>
        val inner = toProtoTypeString(t.typeParams.head, ctx)
        s"optional $inner"
      case other =>
        val pkg = ctx.layout.infrastructure.proto.root
        s"$pkg.${other}PO"
    }
  }

  /**
    * 将 Scala 类型引用转换为对应的 Proto 字段定义
    *
    * @param name      字段名
    * @param scalaType Scala 类型引用
    * @param ctx       生成器上下文
    * @return (字段名, Proto 类型字符串)
    */
  def toProtoField(name: String, scalaType: TypeRef, ctx: GeneratorContext): (String, String) = {
    val protoType = toProtoTypeString(scalaType, ctx)
    (name, protoType)
  }

  /**
    * 将字段名转换为 Proto 风格的下划线命名
    *
    * @param s 驼峰命名的字段名
    * @return 下划线命名的字段名
    */
  def toSnakeCase(s: String): String = {
    NamingConventions.toSnakeCase(s)
  }

  /**
    * 将字段名转换为 Proto 风格的小写驼峰命名
    *
    * @param s 原始字段名
    * @return 小写驼峰命名的字段名
    */
  def toLowerCamel(s: String): String = {
    if (s.isEmpty) "" else s.head.toLower + s.tail
  }
}
