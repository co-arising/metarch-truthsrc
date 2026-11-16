package net.imadz.codegen.scaffolding.cqrs

object TypeFactory {

  // 泛型构造器
  def generic(base: TypeRef, args: TypeRef*): TypeRef = base.copy(typeParams = args)

  // 常用类型
  def option(inner: TypeRef): TypeRef = generic(TypeRef("Option", "scala"), inner)
  def list(inner: TypeRef): TypeRef = generic(TypeRef("List", "scala.collection.immutable"), inner)
  
  def future(inner: TypeRef)(implicit ctx: GeneratorContext): TypeRef = 
    generic(TypeRef("Future", "scala.concurrent"), inner)

  // 领域特定组合：Future[Either[iMadzError, T]]
  def serviceResult(resultType: TypeRef)(implicit ctx: GeneratorContext): TypeRef = {
    val errorType = ctx.scaffolding.iMadzError
    val eitherType = TypeRef("Either", "scala")
    future(generic(eitherType, errorType, resultType))
  }
  
  // 事件处理组合：Either[iMadzError, List[Event]]
  def handlerResult(eventType: TypeRef)(implicit ctx: GeneratorContext): TypeRef = {
    val errorType = ctx.scaffolding.iMadzError
    val eitherType = TypeRef("Either", "scala")
    generic(eitherType, errorType, list(eventType))
  }
}
