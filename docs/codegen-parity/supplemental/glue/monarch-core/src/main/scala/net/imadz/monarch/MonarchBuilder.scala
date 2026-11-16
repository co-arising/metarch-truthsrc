package net.imadz.monarch

import scala.concurrent.{ExecutionContext, Future}

/** Fluent builder for assembling a generation-guarded [[Monarch]] engine.
  *
  * Eliminates boilerplate and recursive naming bugs in anonymous [[LifecycleHooks]]
  * implementations, providing clean separation between execution, progress
  * observation, and failure/recovery interception.
  *
  * {{{
  * val monarch = Monarch.builder[BankStage, BankChainState[Item, Raw]]
  *   .namingStages(stage => BankStage.stageName(stage))
  *   .withExecution((stage, state) => BankChain.runStage(stage, state, pipeline))
  *   .onFailure((cursor, err, state) => ocapInterceptor(cursor, err, state))
  *   .withGenerationGuard(() => RunRegistry.isFresh(key, gen))
  *   .onStageStart(cursor => observer.onStageStart(cursor))
  *   .onStageCompleteWithMeta((cursor, state, meta) => observer.onStageComplete(cursor, meta, Some(state)))
  *   .build()
  * }}}
  */
final class MonarchBuilder[Stage, State] private (
    private val interpreterOpt: Option[(Stage, State, ExecutionContext) => Future[State]],
    private val nameOfOpt: Option[Stage => String],
    private val stagesToInit: Option[Seq[Stage]],
    private val startHook: String => Unit,
    private val completeHook: (String, State, Map[String, String]) => Unit,
    private val failedHook: (String, StageError) => Unit,
    private val resolvedHook: (String, StageError, State) => Unit,
    private val failureInterceptorOpt: Option[(String, StageError, State, ExecutionContext) => Future[State]],
    private val runTokenFn: () => Boolean,
    private val completeCheckpoint: (String, State, Map[String, String]) => Future[Unit],
    private val resolvedCheckpoint: (String, StageError, State) => Future[Unit],
    private val checkpointEnabled: Boolean
) {

  def namingStages(nameOf: Stage => String): MonarchBuilder[Stage, State] =
    copy(nameOfOpt = Some(nameOf))

  def withStages(stages: Seq[Stage]): MonarchBuilder[Stage, State] =
    copy(stagesToInit = Some(stages))

  def withExecution(interpreter: (Stage, State) => Future[State]): MonarchBuilder[Stage, State] =
    copy(interpreterOpt = Some((st, s, _) => interpreter(st, s)))

  def withExecutionEc(interpreter: (Stage, State, ExecutionContext) => Future[State]): MonarchBuilder[Stage, State] =
    copy(interpreterOpt = Some(interpreter))

  def onStageStart(hook: String => Unit): MonarchBuilder[Stage, State] =
    copy(startHook = hook)

  def onStageComplete(hook: (String, State) => Unit): MonarchBuilder[Stage, State] =
    copy(completeHook = (c, s, _) => hook(c, s))

  def onStageCompleteWithMeta(hook: (String, State, Map[String, String]) => Unit): MonarchBuilder[Stage, State] =
    copy(completeHook = hook)

  def onStageFailed(hook: (String, StageError) => Unit): MonarchBuilder[Stage, State] =
    copy(failedHook = hook)

  def onStageResolved(hook: (String, StageError, State) => Unit): MonarchBuilder[Stage, State] =
    copy(resolvedHook = hook)

  def onFailure(interceptor: (String, StageError, State) => Future[State]): MonarchBuilder[Stage, State] =
    copy(failureInterceptorOpt = Some((c, e, s, _) => interceptor(c, e, s)))

  def onFailureEc(interceptor: (String, StageError, State, ExecutionContext) => Future[State]): MonarchBuilder[Stage, State] =
    copy(failureInterceptorOpt = Some(interceptor))

  def withGenerationGuard(runToken: () => Boolean): MonarchBuilder[Stage, State] =
    copy(runTokenFn = runToken)

  /** Separate durable progress from observation and business failure handling. */
  def withCheckpoints(
      complete: (String, State, Map[String, String]) => Future[Unit],
      resolved: (String, StageError, State) => Future[Unit]
  ): MonarchBuilder[Stage, State] =
    copy(completeCheckpoint = complete, resolvedCheckpoint = resolved, checkpointEnabled = true)

  def build(): Monarch[Stage, State] = {
    val interpFn = interpreterOpt.getOrElse(
      throw new IllegalArgumentException("MonarchBuilder requires an execution interpreter via withExecution")
    )
    val nameFn = nameOfOpt.getOrElse((stage: Stage) => String.valueOf(stage))

    val interpreter = new StageInterpreter[Stage, State] {
      override def run(stage: Stage, state: State)(implicit ec: ExecutionContext): Future[State] =
        interpFn(stage, state, ec)
    }

    val startFn = startHook
    val completeFn = completeHook
    val failedFn = failedHook
    val resolvedFn = resolvedHook
    val checkpointCompleteFn = completeCheckpoint
    val checkpointResolvedFn = resolvedCheckpoint
    val hooks: LifecycleHooks[Stage, State] =
      if (!checkpointEnabled) new CallbackHooks(nameFn, startFn, completeFn, failedFn, resolvedFn)
      else new CheckpointCallbackHooks(nameFn, startFn, completeFn, failedFn, resolvedFn,
        checkpointCompleteFn, checkpointResolvedFn)

    val interceptor = failureInterceptorOpt.map { fi =>
      new FailureInterceptor[Stage, State] {
        override def intercept(cursor: String, error: StageError, state: State)(implicit ec: ExecutionContext): Future[State] =
          fi(cursor, error, state, ec)
      }
    }

    val engine = new Monarch[Stage, State](
      interpreter = interpreter,
      hooks = hooks,
      failureInterceptor = interceptor,
      runToken = runTokenFn
    )

    stagesToInit.foreach(engine.initialize)
    engine
  }

  private def copy(
      interpreterOpt: Option[(Stage, State, ExecutionContext) => Future[State]] = this.interpreterOpt,
      nameOfOpt: Option[Stage => String] = this.nameOfOpt,
      stagesToInit: Option[Seq[Stage]] = this.stagesToInit,
      startHook: String => Unit = this.startHook,
      completeHook: (String, State, Map[String, String]) => Unit = this.completeHook,
      failedHook: (String, StageError) => Unit = this.failedHook,
      resolvedHook: (String, StageError, State) => Unit = this.resolvedHook,
      failureInterceptorOpt: Option[(String, StageError, State, ExecutionContext) => Future[State]] = this.failureInterceptorOpt,
      runTokenFn: () => Boolean = this.runTokenFn,
      completeCheckpoint: (String, State, Map[String, String]) => Future[Unit] = this.completeCheckpoint,
      resolvedCheckpoint: (String, StageError, State) => Future[Unit] = this.resolvedCheckpoint,
      checkpointEnabled: Boolean = this.checkpointEnabled
  ): MonarchBuilder[Stage, State] =
    new MonarchBuilder(
      interpreterOpt, nameOfOpt, stagesToInit,
      startHook, completeHook, failedHook, resolvedHook,
      failureInterceptorOpt, runTokenFn, completeCheckpoint, resolvedCheckpoint, checkpointEnabled
    )
}

object MonarchBuilder {
  def empty[Stage, State]: MonarchBuilder[Stage, State] =
    new MonarchBuilder[Stage, State](
      interpreterOpt = None,
      nameOfOpt = None,
      stagesToInit = None,
      startHook = _ => (),
      completeHook = (_, _, _) => (),
      failedHook = (_, _) => (),
      resolvedHook = (_, _, _) => (),
      failureInterceptorOpt = None,
      runTokenFn = () => true,
      completeCheckpoint = (_, _, _) => Future.successful(()),
      resolvedCheckpoint = (_, _, _) => Future.successful(()),
      checkpointEnabled = false
    )
}
