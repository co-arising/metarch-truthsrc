package net.imadz.codegen.scaffolding.cqrs.builder.application

import net.imadz.codegen.scaffolding.cqrs.builder.domain.ValueObjectBuilder
import net.imadz.codegen.scaffolding.cqrs.model.application.{QueryServiceMethodModel, QueryServiceModel}
import net.imadz.codegen.scaffolding.cqrs.{FieldDef, GeneratorContext, TypeRef}
import net.imadz.meta.QueryServiceMetadata

object QueryServiceBuilder {

  def build(meta: QueryServiceMetadata, ctx: GeneratorContext): QueryServiceModel = {
    // 1. 类型解析
    // QueryService 应该位于 application.queries 包
    val pkg = ctx.layout.application.queries.root

    val selfType = ctx.typeResolver.queryService(meta.name)

    // 2. Struct/DTO Models (内部 DTOs)
    val structModels = meta.structs.map(ValueObjectBuilder.build(_, ctx))

    // 3. 依赖解析 (Repositories Refs)
    val resolvedDeps = meta.repositories.map(ctx.typeResolver.resolve(_))

    // 4. 方法转换
    val methods = meta.methods.map { m =>
      // a. 参数
      val parameters = m.parameters.map(p => FieldDef(p.name, ctx.typeResolver.parameterType(p.parameterType)))

      // b. 返回类型
      val returnType = ctx.typeResolver.resolve(m.returnType)

      // c. 调用命令 (用于 Ask 逻辑)
      val invokedCommands = m.invokes.map(ctx.typeResolver.resolve(_))

      QueryServiceMethodModel(
        name = m.name,
        parameters = parameters,
        returnType = returnType,
        bodyLogic = m.logic.referenceCode.getOrElse(s"// TODO: ${m.logic.intent}"),
        invokesCommands = invokedCommands
      )
    }

    // 5. 依赖收集
    val methodDeps = methods.flatMap { m =>
      m.returnType.collectAllDependencies ++
        m.parameters.flatMap(_.typeRef.collectAllDependencies) ++
        m.invokesCommands.flatMap(_.collectAllDependencies)
    }

    val structDeps = structModels.flatMap(_.dependencies).toSet ++
      structModels.flatMap(_.fields.flatMap(_.typeRef.collectAllDependencies)).toSet

    val frameworkDeps = Set(
      ctx.knownFrameworkTypes("Inject"),
      ctx.knownFrameworkTypes("Timeout"),
      ctx.knownFrameworkTypes("ExecutionContext"),
      ctx.knownFrameworkTypes("Future"),
      ctx.knownFrameworkTypes("ReadModel")
    )

    val allDeps = (resolvedDeps.toSet ++ methodDeps.toSet ++ structDeps ++ frameworkDeps).toSet

    // [FIX] 优化过滤器：只过滤掉当前包、空的包、以及 java.lang (基础类)
    // scala 包只过滤根包 (TypeRef.Int 等)，保留 scala.concurrent 等子包
    val dependencies = allDeps.flatMap(_.collectAllDependencies)
      .filterNot { t =>
        t.packageName.isEmpty ||
          t.packageName == pkg ||
          t.packageName == "java.lang" ||
          t.packageName == "scala" // 只过滤 scala 根包，保留 scala.concurrent/collection
      }
      .filterNot(_.name == "Timeout") // Timeout 单独处理
    QueryServiceModel(selfType, methods, structModels, dependencies.toSet)
  }
}
