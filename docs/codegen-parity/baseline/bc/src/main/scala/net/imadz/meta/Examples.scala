package net.imadz.meta

object Examples {

  // ... (Common Types) ...
  private val commonPackage = "net.imadz.common"
  private val idType = CustomType("Id", s"$commonPackage.CommonTypes")
  private val currencyType = CustomType("Currency", "java.util")
  private val pureMadzError = CustomType("iMadzError", s"$commonPackage.CommonTypes")
  private val errorOptionType = CustomType("Option", "scala", Seq(pureMadzError))
  private val futureType = CustomType("Future", "scala.concurrent")
  private val listType = CustomType("List", "scala.collection.immutable")

  private def listOf(dataType: DataType) = CustomType("List", "scala.collection.immutable", Seq(dataType))

  private val reservedMapType = CustomType("Map", "scala.collection.immutable", Seq(idType, StructRef("Money")))
  private val unitType = UnitType

  // 1.1 State & Value Objects
  private val moneyType = ValueObjectMetadata("Money", Seq(FieldMetadata("amount", BigDecimalType), FieldMetadata("currency", currencyType)), "金额值对象")
  private val moneyRef = StructRef("Money")
  private val listOfMoney = CustomType("List", "scala.collection.immutable", Seq(CustomType("Money", "net.imadz.banking.domain.values")))
  private val tupleIdMoneyType = CustomType("Tuple2", "scala", Seq(idType, moneyRef))
  private val creditBalanceState = ValueObjectMetadata("CreditBalanceState", Seq(
    FieldMetadata("userId", idType),
    FieldMetadata("accountBalance", CustomType("Map", "scala.collection.immutable", Seq(StringType, moneyRef)), true),
    FieldMetadata("reservedAmount", CustomType("Map", "scala.collection.immutable", Seq(idType, moneyRef)), true),
    FieldMetadata("incomingCredits", CustomType("Map", "scala.collection.immutable", Seq(idType, moneyRef)), true)
  ), "持有用户余额...")
  private val stateRef = EntityStateRef("CreditBalanceState")
  private val entityRef = EntityRef("CreditBalanceEntity")

  // 1.2 Domain Events
  private val eventFamilyRef = EventFamilyRef("CreditBalanceEvent")
  private val balanceChangedEvent = SubordinateDomainEventMetadata("BalanceChanged", Seq(FieldMetadata("update", moneyRef), FieldMetadata("timestamp", LongType)), true, "余额发生变动", Map("update" -> 1, "timestamp" -> 2))
  private val fundsReservedEvent = SubordinateDomainEventMetadata("FundsReserved", Seq(FieldMetadata("transferId", idType), FieldMetadata("amount", moneyRef)), true, "资金已预留", Map("transferId" -> 1, "amount" -> 2))
  private val fundsDeductedEvent = SubordinateDomainEventMetadata("FundsDeducted", Seq(FieldMetadata("transferId", idType), FieldMetadata("amount", moneyRef)), true, "资金已扣除", Map("transferId" -> 1, "amount" -> 2))
  private val reservationReleasedEvent = SubordinateDomainEventMetadata("ReservationReleased", Seq(FieldMetadata("transferId", idType), FieldMetadata("amount", moneyRef)), true, "预留已释放", Map("transferId" -> 1, "amount" -> 2))
  private val incomingCreditsRecordedEvent = SubordinateDomainEventMetadata("IncomingCreditsRecorded", Seq(FieldMetadata("transferId", idType), FieldMetadata("amount", moneyRef)), true, "入账资金已记录", Map("transferId" -> 1, "amount" -> 2))
  private val incomingCreditsCommittedEvent = SubordinateDomainEventMetadata("IncomingCreditsCommited", Seq(FieldMetadata("transferId", idType)), true, "入账资金已提交", Map("transferId" -> 1))
  private val incomingCreditsCanceledEvent = SubordinateDomainEventMetadata("IncomingCreditsCanceled", Seq(FieldMetadata("transferId", idType)), true, "入账资金已取消", Map("transferId" -> 1))

  private val updateAccountBalanceMethod = MethodMetadata("updateAccountBalance", Seq(ParameterMetadata("state", stateRef), ParameterMetadata("currency", currencyType), ParameterMetadata("updateMoney", moneyRef)), CustomType("Map", "scala.collection.immutable", Seq(StringType, moneyRef)), Right(BusinessLogic("按币种键把 updateMoney 累加到账户余额（币种不一致视为零）", referenceCode = Some("state.accountBalance + (currency.getCurrencyCode -> Money(currentBalance.amount + updateMoney.amount, currency))"))), isPrivate = true)

  private val creditBalanceEventHandler = EntityBehaviorMetadata("CreditBalanceEventHandler", eventFamilyRef, Seq(EventStateMutation(EventRef("BalanceChanged"), BusinessLogic("将余额变动累加到对应币种的账户余额", referenceCode = Some("state.copy(accountBalance = updateAccountBalance(state, event.update.currency, event.update))"))), EventStateMutation(EventRef("FundsReserved"), BusinessLogic("登记预留并立即扣减账户余额（防止预留期间超额支取）", referenceCode = Some("state.copy(accountBalance = updateAccountBalance(state, event.amount.currency, event.amount.copy(amount = -event.amount.amount)), reservedAmount = state.reservedAmount + (event.transferId -> event.amount))"))), EventStateMutation(EventRef("FundsDeducted"), BusinessLogic("转账提交后移除该笔预留", referenceCode = Some("state.copy(reservedAmount = state.reservedAmount - event.transferId)"))), EventStateMutation(EventRef("ReservationReleased"), BusinessLogic("转账回滚时释放该笔预留并回补账户余额", referenceCode = Some("state.copy(accountBalance = updateAccountBalance(state, event.amount.currency, event.amount), reservedAmount = state.reservedAmount - event.transferId)"))), EventStateMutation(EventRef("IncomingCreditsRecorded"), BusinessLogic("按转账 id 登记入账金额", referenceCode = Some("state.copy(incomingCredits = state.incomingCredits.updated(event.transferId, event.amount))"))), EventStateMutation(EventRef("IncomingCreditsCommited"), BusinessLogic("入账提交后贷记账户余额并移除该笔入账记录", referenceCode = Some("state.copy(accountBalance = updateAccountBalance(state, state.incomingCredits(event.transferId).currency, state.incomingCredits(event.transferId)), incomingCredits = state.incomingCredits - event.transferId)"))), EventStateMutation(EventRef("IncomingCreditsCanceled"), BusinessLogic("入账取消时移除该笔入账记录", referenceCode = Some("state.copy(incomingCredits = state.incomingCredits - event.transferId)")))), Seq(updateAccountBalanceMethod))

  private val addInitialOnlyOnceRule = InvariantRuleMetadata("AddInitialOnlyOnceRule", "初始金额只能添加一次", stateRef, moneyRef, eventFamilyRef, Seq(InvariantCondition("InitialConditionNotMeet", "60000", BusinessLogic("余额必须为0", referenceCode = Some("!state.accountBalance.values.exists(_.amount > 0)")))))
  private val depositRule = InvariantRuleMetadata("DepositRule", "存款校验", stateRef, moneyRef, eventFamilyRef, Seq(InvariantCondition("ChangeShouldBePositive", "60001", BusinessLogic("金额必须>0", referenceCode = Some("change.amount > 0")))))
  private val withdrawRule = InvariantRuleMetadata("WithdrawRule", "取款校验", stateRef, moneyRef, eventFamilyRef, Seq(InvariantCondition("NotEnoughBalance", "60002", BusinessLogic("余额需充足", referenceCode = Some("state.accountBalance.get(change.currency.getCurrencyCode).exists(change <= _)")))))
  private val reserveFundsRule = InvariantRuleMetadata("ReserveFundsRule", "资金预留校验", stateRef, tupleIdMoneyType, eventFamilyRef, Seq(InvariantCondition("ReservationCheck", "600xx", BusinessLogic("Delegate to TransferValidator", referenceCode = Some("transferValidator.validate(change._1, state.reservedAmount, state.accountBalance.get(change._2.currency.getCurrencyCode), change._2).isRight")))))
  private val deductFundsRule = InvariantRuleMetadata("DeductFundsRule", "资金扣除校验", stateRef, idType, eventFamilyRef, Seq(InvariantCondition("ReservationFound", "60006", BusinessLogic("Must have reserved funds", referenceCode = Some("state.reservedAmount.contains(change)")))))
  private val releaseReservedFundsRule = InvariantRuleMetadata("ReleaseReservedFundsRule", "资金释放校验", stateRef, idType, eventFamilyRef, Seq(InvariantCondition("ReservationFound", "60006", BusinessLogic("Must have reserved funds", referenceCode = Some("state.reservedAmount.contains(change)")))))
  private val recordIncomingCreditsRule = InvariantRuleMetadata("RecordIncomingCreditsRule", "入账记录校验 (Try)", stateRef, tupleIdMoneyType, eventFamilyRef, Seq(InvariantCondition("UniqueRecord", "60007", BusinessLogic("Id must be unique", referenceCode = Some("!state.incomingCredits.contains(change._1)")))))
  private val commitIncomingCreditsRule = InvariantRuleMetadata("CommitIncomingCreditsRule", "入账提交校验 (Confirm)", stateRef, idType, eventFamilyRef, Seq(InvariantCondition("RecordExists", "60008", BusinessLogic("Record must exist", referenceCode = Some("state.incomingCredits.contains(change)")))))
  private val cancelIncomingCreditRule = InvariantRuleMetadata("CancelIncomingCreditRule", "入账取消校验 (Cancel)", stateRef, idType, eventFamilyRef, Seq(InvariantCondition("RecordExists", "60009", BusinessLogic("Record must exist", referenceCode = Some("state.incomingCredits.contains(change)")))))

  private val transferValidator = DomainServiceMetadata("TransferValidator", "转账校验器", Seq(MethodMetadata("validate", Seq(ParameterMetadata("transferId", idType), ParameterMetadata("reservedAmount", reservedMapType), ParameterMetadata("fromBalance", CustomType("Option", "scala", Seq(moneyRef))), ParameterMetadata("transferAmount", moneyRef)), CustomType("Either", "scala.util", Seq(pureMadzError, unitType)), Right(BusinessLogic("校验预留不重复、转账金额为正、且不超过该币种可用余额（transferAmount ≤ fromBalance）", referenceCode = Some("if (reservedAmount.contains(transferId)) Left(DuplicateReservationError) else if (transferAmount.amount <= BigDecimal(0)) Left(InvalidTransferAmountError) else if (fromBalance.forall(_.amount < transferAmount.amount)) Left(InsufficientBalanceError) else Right(())"))))))

  // [RESTORED] Clean Commands & Replies (No aggregateOwner)
  private val creditBalanceReply = SubordinateCommandReplyMetadata("CreditBalanceConfirmation", Seq(ParameterMetadata("error", errorOptionType), ParameterMetadata("balances", listOfMoney)))
  private val fundsReservationReply = SubordinateCommandReplyMetadata("FundsReservationConfirmation", Seq(ParameterMetadata("transferId", idType), ParameterMetadata("error", errorOptionType)))
  private val fundsDeductionReply = SubordinateCommandReplyMetadata("FundsDeductionConfirmation", Seq(ParameterMetadata("transferId", idType), ParameterMetadata("error", errorOptionType)))
  private val fundsReleaseReply = SubordinateCommandReplyMetadata("FundsReleaseConfirmation", Seq(ParameterMetadata("transferId", idType), ParameterMetadata("error", errorOptionType)))
  private val recordReply = SubordinateCommandReplyMetadata("RecordIncomingCreditsConfirmation", Seq(ParameterMetadata("transferId", idType), ParameterMetadata("error", errorOptionType)))
  private val commitReply = SubordinateCommandReplyMetadata("CommitIncomingCreditsConfirmation", Seq(ParameterMetadata("transferId", idType), ParameterMetadata("error", errorOptionType)))
  private val cancelReply = SubordinateCommandReplyMetadata("CancelIncomingCreditConfirmation", Seq(ParameterMetadata("transferId", idType), ParameterMetadata("error", errorOptionType)))

  private val creditBalanceReplyFamily = CommandReplyFamilyMetadata("CreditBalanceReply", Seq(creditBalanceReply, fundsReservationReply, fundsDeductionReply, fundsReleaseReply, recordReply, commitReply, cancelReply))

  private val creditBalanceEventFamily = EventFamilyMetadata("CreditBalanceEvent", "...", Seq(balanceChangedEvent, fundsReservedEvent, fundsDeductedEvent, reservationReleasedEvent, incomingCreditsRecordedEvent, incomingCreditsCommittedEvent, incomingCreditsCanceledEvent))
  private val creditBalanceEntity = DomainEntityMetadata("CreditBalanceEntity", creditBalanceState, creditBalanceEventFamily)
  private val creditBalanceEntityRef = EntityRef("CreditBalanceEntity")

  private val creditBalanceReplyRef = CommandReplyRef("CreditBalanceConfirmation")
  private val fundsReservationReplyRef = CommandReplyRef("FundsReservationConfirmation")
  private val fundsDeductionReplyRef = CommandReplyRef("FundsDeductionConfirmation")
  private val fundsReleaseReplyRef = CommandReplyRef("FundsReleaseConfirmation")
  private val recordReplyRef = CommandReplyRef("RecordIncomingCreditsConfirmation")
  private val commitReplyRef = CommandReplyRef("CommitIncomingCreditsConfirmation")
  private val cancelReplyRef = CommandReplyRef("CancelIncomingCreditConfirmation")

  // [RESTORED] Clean Commands
  private val addInitialCmd = SubordinateCommandMetadata("AddInitial", Seq(ParameterMetadata("initial", moneyRef)), Some(creditBalanceReplyRef))
  private val depositCmd = SubordinateCommandMetadata("Deposit", Seq(ParameterMetadata("change", moneyRef)), Some(creditBalanceReplyRef))
  private val withdrawCmd = SubordinateCommandMetadata("Withdraw", Seq(ParameterMetadata("change", moneyRef)), Some(creditBalanceReplyRef))
  private val getBalanceCmd = SubordinateCommandMetadata("GetBalance", Seq.empty, Some(creditBalanceReplyRef), isReadOnly = true)

  private val reserveFundsCmd = SubordinateCommandMetadata("ReserveFunds", Seq(ParameterMetadata("transferId", idType), ParameterMetadata("amount", moneyRef)), Some(fundsReservationReplyRef))
  private val deductFundsCmd = SubordinateCommandMetadata("DeductFunds", Seq(ParameterMetadata("transferId", idType)), Some(fundsDeductionReplyRef))
  private val releaseReservedFundsCmd = SubordinateCommandMetadata("ReleaseReservedFunds", Seq(ParameterMetadata("transferId", idType)), Some(fundsReleaseReplyRef))

  private val recordIncomingCmd = SubordinateCommandMetadata("RecordIncomingCredits", Seq(ParameterMetadata("transferId", idType), ParameterMetadata("amount", moneyRef)), Some(recordReplyRef))
  private val commitIncomingCmd = SubordinateCommandMetadata("CommitIncomingCredits", Seq(ParameterMetadata("transferId", idType)), Some(commitReplyRef))
  private val cancelIncomingCmd = SubordinateCommandMetadata("CancelIncomingCredit", Seq(ParameterMetadata("transferId", idType)), Some(cancelReplyRef))

  private val creditBalanceCommandFamily = CommandFamilyMetadata("CreditBalanceCommand", "...", Seq(addInitialCmd, depositCmd, withdrawCmd, getBalanceCmd, reserveFundsCmd, deductFundsCmd, releaseReservedFundsCmd, recordIncomingCmd, commitIncomingCmd, cancelIncomingCmd))
  private val creditBalanceCommandFamilyRef = CommandFamilyRef("CreditBalanceCommand")
  private val addInitialCmdRef = CommandRef("AddInitial")
  private val depositCmdRef = CommandRef("Deposit")
  private val withdrawCmdRef = CommandRef("Withdraw")
  private val getBalanceCmdRef = CommandRef("GetBalance")
  private val reserveFundsCmdRef = CommandRef("ReserveFunds")
  private val deductFundsCmdRef = CommandRef("DeductFunds")
  private val releaseReservedFundsCmdRef = CommandRef("ReleaseReservedFunds")
  private val recordIncomingCmdRef = CommandRef("RecordIncomingCredits")
  private val commitIncomingCmdRef = CommandRef("CommitIncomingCredits")
  private val cancelIncomingCmdRef = CommandRef("CancelIncomingCredit")

  private val addInitialRuleRef = InvariantRuleRef("AddInitialOnlyOnceRule")
  private val depositRuleRef = InvariantRuleRef("DepositRule")
  private val withdrawRuleRef = InvariantRuleRef("WithdrawRule")
  private val reserveRuleRef = InvariantRuleRef("ReserveFundsRule")
  private val deductRuleRef = InvariantRuleRef("DeductFundsRule")
  private val releaseRuleRef = InvariantRuleRef("ReleaseReservedFundsRule")
  private val recordRuleRef = InvariantRuleRef("RecordIncomingCreditsRule")
  private val commitRuleRef = InvariantRuleRef("CommitIncomingCreditsRule")
  private val cancelRuleRef = InvariantRuleRef("CancelIncomingCreditRule")

  private val directBehavior = AggregateCommandHandlersMetadata(
    "DirectBehaviors",
    Seq(CommandHandlingFlow(addInitialCmdRef, invariantRef = addInitialRuleRef, ReplyMappingConfig(creditBalanceReplyRef, creditBalanceReplyRef)),
      CommandHandlingFlow(depositCmdRef, invariantRef = depositRuleRef, ReplyMappingConfig(creditBalanceReplyRef, creditBalanceReplyRef)),
      CommandHandlingFlow(withdrawCmdRef, invariantRef = withdrawRuleRef, ReplyMappingConfig(creditBalanceReplyRef, creditBalanceReplyRef))))

  private val reserveBehavior = AggregateCommandHandlersMetadata("ReserveBehaviors", Seq(CommandHandlingFlow(reserveFundsCmdRef, invariantRef = reserveRuleRef, ReplyMappingConfig(fundsReservationReplyRef, fundsReservationReplyRef)), CommandHandlingFlow(deductFundsCmdRef, invariantRef = deductRuleRef, ReplyMappingConfig(fundsDeductionReplyRef, fundsDeductionReplyRef)), CommandHandlingFlow(releaseReservedFundsCmdRef, invariantRef = releaseRuleRef, ReplyMappingConfig(fundsReleaseReplyRef, fundsReleaseReplyRef))))
  private val incomingBehavior = AggregateCommandHandlersMetadata("IncomingCreditBehaviors", Seq(CommandHandlingFlow(recordIncomingCmdRef, invariantRef = recordRuleRef, ReplyMappingConfig(recordReplyRef, recordReplyRef)), CommandHandlingFlow(commitIncomingCmdRef, invariantRef = commitRuleRef, ReplyMappingConfig(commitReplyRef, commitReplyRef)), CommandHandlingFlow(cancelIncomingCmdRef, invariantRef = cancelRuleRef, ReplyMappingConfig(cancelReplyRef, cancelReplyRef))))

  private val creditBalanceBehaviors = AggregateBehaviorMetadata(
    "CreditBalanceBehaviors",
    behaviors = Seq(directBehavior, reserveBehavior, incomingBehavior))

  private val creditBalanceRepoRef = AggregateRepositoryRef("CreditBalanceRepository")

  private val creditBalanceAggregate = AggregateRootMetadata(
    name = "CreditBalanceAggregate",
    description = "信用余额聚合根：管理账户余额、资金预留与入账记录，是存取款与转账的核心一致性边界。",
    identifier = FieldMetadata("userId", idType),
    entityRef = creditBalanceEntityRef,
    stateRef = stateRef,
    eventFamilyRef = eventFamilyRef,
    commandFamily = creditBalanceCommandFamily,
    replyFamily = creditBalanceReplyFamily,
    behaviorRef = AggregateBehaviorRef("CreditBalanceBehaviors"),
    repository = Some(creditBalanceRepoRef),
    persistenceConfig = PersistenceConfig("CreditBalance", ShardedTags("credit-balance-", 5)),
    // [NEW] 定义那两个特定的工厂方法
    factoryMethods = Seq(
      MethodMetadata(
        name = "createCreditBalanceWithoutBalance",
        parameters = Seq(ParameterMetadata("userId", idType)),
        returnType = CustomType("EntityRef", "akka.cluster.sharding.typed.scaladsl", Seq(CustomType("CreditBalanceCommand", ""))), // 这里的 Command 类型名后续会用到
        logic = Right(BusinessLogic("获取 EntityRef", referenceCode = Some("sharding.entityRefFor(CreditBalanceEntityKey, userId.toString)")))
      ),
      MethodMetadata(
        name = "createCreditBalanceWithDefaultBalance",
        parameters = Seq(ParameterMetadata("userId", idType), ParameterMetadata("initial", moneyRef)),
        returnType = futureType.copy(typeParameters = Seq(CustomType("Either", "", Seq(errorOptionType, CustomType("EntityRef", "akka.cluster.sharding.typed.scaladsl", Seq(CustomType("CreditBalanceCommand", ""))))))),
        logic = Right(BusinessLogic("初始化并返回", referenceCode = Some("createCreditBalanceWithoutBalance(userId).flatMap(ref => ref.ask[CreditBalanceConfirmation](replyTo => AddInitial(initial, replyTo)).map(conf => conf.error.map(Left(_)).getOrElse(Right(ref))))")))
      )
    ),
    implConfig = ImplementationConfig(Some(ProtoConfig(fileName = "credits.proto", imports = Seq("saga_v2.proto", "saga_participant.proto"))), Some(AkkaShardingBootstrap("credit-balance-", 5)))
  )

  private val monthlyTable = TableMetadata("monthly_income_and_expense_summary", Seq(ColumnMetadata("user_id", "VARCHAR(255)", true), ColumnMetadata("year", "INT", true), ColumnMetadata("month", "INT", true), ColumnMetadata("day", "INT", true), ColumnMetadata("income", "DECIMAL(19,2)"), ColumnMetadata("expense", "DECIMAL(19,2)")), "用户月度收支明细表")
  private val creditBalanceRepo = AggregateRepositoryMetadata("CreditBalanceRepository",
    AggregateRef("CreditBalanceAggregate"),
    Seq(QueryMethod("findCreditBalanceByUserId", Seq(ParameterMetadata("userId", idType)), CustomType("EntityRef", "akka.cluster.sharding.typed.scaladsl", Seq(creditBalanceCommandFamilyRef)), BusinessLogic("通过 Sharding 获取聚合根引用", referenceCode = Some("sharding.entityRefFor(CreditBalanceEntityKey, userId.toString)")))))
  private val monthlyRepo = ProjectionRepositoryMetadata("MonthlyIncomeAndExpenseSummaryRepository", monthlyTable, Seq(UpsertMethod("updateIncome", Seq(ParameterMetadata("userId", StringType), ParameterMetadata("amount", BigDecimalType), ParameterMetadata("year", IntType), ParameterMetadata("month", IntType), ParameterMetadata("day", IntType)), BusinessLogic("将当日收入累计计入指定日期的 income 列", referenceCode = Some("UPDATE monthly_income_and_expense_summary SET income = income + ? WHERE user_id = ? AND year = ? AND month = ? AND day = ?"))), UpsertMethod("updateExpense", Seq(ParameterMetadata("userId", StringType), ParameterMetadata("amount", BigDecimalType), ParameterMetadata("year", IntType), ParameterMetadata("month", IntType), ParameterMetadata("day", IntType)), BusinessLogic("将当日支出累计计入指定日期的 expense 列", referenceCode = Some("UPDATE monthly_income_and_expense_summary SET expense = expense + ? WHERE user_id = ? AND year = ? AND month = ? AND day = ?"))), QueryMethod("filterByPeriodLCRO", Seq(ParameterMetadata("userId", StringType), ParameterMetadata("startYear", IntType), ParameterMetadata("startMonth", IntType), ParameterMetadata("endYear", IntType), ParameterMetadata("endMonth", IntType)), CustomType("List", "", Seq(CustomType("Summary", ""))), BusinessLogic("按用户与年月区间查询月度收支汇总", referenceCode = Some("SELECT * FROM monthly_income_and_expense_summary WHERE user_id = ? AND year BETWEEN ? AND ? AND month BETWEEN ? AND ?")))))
  private val monthlyRepoRef = ProjectionRepositoryRef("MonthlyIncomeAndExpenseSummaryRepository")
  // [NEW] 读模型 schema（字段级推导边 = 血缘）：user_id ← 聚合身份，年/月/日 ← event.timestamp，income/expense ← event.update 按符号分向
  private val monthlyReadModelSchema = ReadModelSchema(
    fields = Seq(
      ReadModelField("user_id", StringType, AggregateIdentity, isKey = true),
      ReadModelField("year", IntType, ComputedField("从 event.timestamp 提取年份", Seq(DirectField("BalanceChanged", "timestamp"))), isKey = true),
      ReadModelField("month", IntType, ComputedField("从 event.timestamp 提取月份", Seq(DirectField("BalanceChanged", "timestamp"))), isKey = true),
      ReadModelField("day", IntType, ComputedField("从 event.timestamp 提取日", Seq(DirectField("BalanceChanged", "timestamp"))), isKey = true),
      ReadModelField("income", BigDecimalType, ComputedField("event.update.amount > 0 时取 amount，否则 0", Seq(DirectField("BalanceChanged", "update")))),
      ReadModelField("expense", BigDecimalType, ComputedField("event.update.amount < 0 时取 -amount，否则 0", Seq(DirectField("BalanceChanged", "update"))))
    ),
    identityKeys = Seq("user_id", "year", "month", "day")
  )
  private val monthlyProjection = ProjectionMetadata("MonthlyIncomeAndExpenseSummaryProjection", "CreditBalanceAggregate", Some(monthlyRepoRef),
    Seq(ProjectionEventHandlerMetadata("MonthlyIncomeAndExpenseSummaryProjection", "BalanceChanged", BusinessLogic("余额变动时按变动方向增量更新月度收支汇总（正向计 income、负向计 expense，日期取自 event.timestamp）", referenceCode = Some("if (event.update.amount > 0) \"UPDATE monthly_income_and_expense_summary SET income = income + ? WHERE user_id = ?\" else \"UPDATE monthly_income_and_expense_summary SET expense = expense + ? WHERE user_id = ?\"")))), Some(monthlyReadModelSchema))

  private val createCreditBalanceService = ApplicationServiceMetadata("CreateCreditBalanceService", "创建账户服务", Seq(creditBalanceRepoRef), Seq(ServiceMethod("createCreditBalance", Seq(ParameterMetadata("userId", idType), ParameterMetadata("initial", moneyRef)), futureType.copy(typeParameters = Seq(CustomType("Either", "", Seq(pureMadzError, listOfMoney)))), BusinessLogic("创建并初始化", referenceCode = Some("creditBalanceRepository.findCreditBalanceByUserId(userId).flatMap(_.ask[CreditBalanceConfirmation](replyTo => AddInitial(initial, replyTo))).map(conf => conf.error.map(Left(_)).getOrElse(Right(conf.balances)))")), Seq(addInitialCmdRef))))
  private val createCreditBalanceServiceRef = ApplicationServiceRef("CreateCreditBalanceService")
  private val depositService = ApplicationServiceMetadata("DepositService", "存款服务", Seq(creditBalanceRepoRef), Seq(ServiceMethod("requestDeposit", Seq(ParameterMetadata("userId", idType), ParameterMetadata("amount", moneyRef)), futureType.copy(typeParameters = Seq(creditBalanceReplyRef)), BusinessLogic("Ask Deposit", referenceCode = Some("creditBalanceRepository.findCreditBalanceByUserId(userId).flatMap(_.ask[CreditBalanceConfirmation](replyTo => Deposit(amount, replyTo)))")), Seq(depositCmdRef))))
  private val depositServiceRef = ApplicationServiceRef("DepositService")
  private val withdrawService = ApplicationServiceMetadata("WithdrawService", "取款服务", Seq(creditBalanceRepoRef), Seq(ServiceMethod("requestWithdraw", Seq(ParameterMetadata("userId", idType), ParameterMetadata("amount", moneyRef)), futureType.copy(typeParameters = Seq(creditBalanceReplyRef)), BusinessLogic("Ask Withdraw", referenceCode = Some("creditBalanceRepository.findCreditBalanceByUserId(userId).flatMap(_.ask[CreditBalanceConfirmation](replyTo => Withdraw(amount, replyTo)))")), Seq(withdrawCmdRef))))
  private val withdrawServiceRef = ApplicationServiceRef("WithdrawService")

  private val getBalanceQuery = QueryServiceMetadata(name = "GetBalanceQuery", description = "余额查询", repositories = Seq(creditBalanceRepoRef), structs = Seq(), methods = Seq(ServiceMethod(name = "fetchBalanceByUserId", parameters = Seq(ParameterMetadata("userId", idType)), returnType = futureType.copy(typeParameters = Seq(CustomType("Either", "scala.util", Seq(pureMadzError, listOfMoney)))), logic = BusinessLogic("Ask GetBalance", referenceCode = Some("creditBalanceRepository.findCreditBalanceByUserId(userId).flatMap(_.ask[CreditBalanceConfirmation](replyTo => GetBalance(replyTo))).map(conf => conf.error.map(Left(_)).getOrElse(Right(conf.balances)))")), invokes = Seq(getBalanceCmdRef))))
  private val getBalanceQueryRef = QueryServiceRef("GetBalanceQuery")
  private val getRecent12MonthsReport = QueryServiceMetadata(name = "GetRecent12MonthsIncomeAndExpenseReport", description = "报表查询", repositories = Seq(monthlyRepoRef), structs = Seq(ValueObjectMetadata("MonthlyIncomeAndExpense", Seq(FieldMetadata("year", IntType), FieldMetadata("month", IntType), FieldMetadata("incomeTotal", BigDecimalType), FieldMetadata("expenseTotal", BigDecimalType))), ValueObjectMetadata("Recent12MonthsIncomeAndExpenseReport", Seq(FieldMetadata("monthlySummaries", CustomType("List", "scala.collection.immutable", Seq(StructRef("MonthlyIncomeAndExpense"))))))), methods = Seq(ServiceMethod(name = "fetchByUserId", parameters = Seq(ParameterMetadata("userId", idType)), returnType = futureType.copy(typeParameters = Seq(StructRef("Recent12MonthsIncomeAndExpenseReport"))), logic = BusinessLogic("查询 Repo", referenceCode = Some("val now = java.time.LocalDate.now(); monthlyIncomeAndExpenseSummaryRepository.filterByPeriodLCRO(userId, now.getYear - 1, now.getMonthValue, now.getYear, now.getMonthValue)")))))
  private val getRecent12MonthsReportRef = QueryServiceRef("GetRecent12MonthsIncomeAndExpenseReport")

  private val sagaResilience = ResiliencePolicy("5 seconds", ExponentialBackoff("100 millis", 2.0, 5), Some(CircuitBreakerConfig(5, "30 seconds", "30 seconds")), RetryIfOngoing, Seq(ErrorRule("iMadzError", "60003", MarkAsNonRetryable), ErrorRule("iMadzError", "60004", MarkAsNonRetryable)))

  private val transactionResultConfirmation = SubordinateCommandReplyMetadata(
    "TransactionResultConfirmation",
    Seq(
      ParameterMetadata("transactionId", idType),
      // Option[String]
      ParameterMetadata("error", CustomType("Option", "", Seq(StringType)))
    )
  )

  private val initiateTransferCmd = SubordinateCommandMetadata(
    "InitiateMoneyTransferTransaction",
    Seq(
      ParameterMetadata("fromUserId", idType),
      ParameterMetadata("toUserId", idType),
      ParameterMetadata("amount", moneyRef)
    ),
    Some(CommandReplyRef("TransactionResultConfirmation"))
  )

  // 2. [v3] Saga 内部命令（触发 + 状态更新走 SagaRunner，不再有影子聚合协议）
  private val updateStatusCmd = SubordinateCommandMetadata(
    "UpdateMoneyTransferTransactionStatus",
    Seq(
      ParameterMetadata("id", idType),
      ParameterMetadata("newStatus", CustomType("TransactionResult", "net.imadz.infra.saga.SagaTransactionCoordinator"))
    ), Some(CommandReplyRef("TransactionResultConfirmation"))
  )

  // 3. Saga Command Family（触发命令与回复的载体）
  private val moneyTransferSagaCommandFamily = CommandFamilyMetadata(
    "MoneyTransferTransactionCommand", "Money Transfer Saga Commands",
    Seq(initiateTransferCmd, updateStatusCmd)
  )
  private val moneyTransferSagaCommandFamilyRef = CommandFamilyRef("MoneyTransferTransactionCommand")

  // [v3] Saga Context：参与者 PhaseAsk 通过 ctx 解析聚合 EntityRef
  private val moneyTransferContext = SagaContextMetadata(
    "MoneyTransferContext",
    Seq(
      FieldMetadata("creditBalanceRepository", creditBalanceRepoRef)
    ),
    "转账 Saga 上下文"
  )
  private val moneyTransferContextRef = SagaContextRef("MoneyTransferContext")

  // [v3] Saga Args：纯数据 case class，ArgsCodec.playJson 编码（字段须为 JSON 原生类型）
  private val moneyTransferArgs = SagaArgsMetadata(
    "TransferArgs",
    Seq(
      FieldMetadata("fromUserId", StringType),
      FieldMetadata("toUserId", StringType),
      FieldMetadata("amount", BigDecimalType),
      FieldMetadata("currency", StringType)
    ),
    "转账参数（JSON 编码）"
  )

  // [v3] 映射符号：命令参数 -> {transactionId | 参与者字段 | args 字段}，H001 校验未知符号
  private val mappingTransferId = Map("transferId" -> "transactionId")
  private val mappingTransferIdWithAmount = Map("transferId" -> "transactionId", "amount" -> "amount")

  private val moneyTransferSaga = SagaTransactorMetadata(
    name = "MoneyTransferSagaTransactor",
    version = 1,
    commandFamily = moneyTransferSagaCommandFamily,
    triggerCommandName = "InitiateMoneyTransferTransaction",
    args = Some(moneyTransferArgs),

    participants = Seq(
      SagaParticipantMetadata("FromAccountParticipant", AggregateRef("CreditBalanceAggregate"), List(
        FieldMetadata(name = "userId", fieldType = idType),
        FieldMetadata(name = "amount", fieldType = moneyRef)
      ), Map("userId" -> "fromUserId", "amount" -> "amount")),
      SagaParticipantMetadata("ToAccountParticipant", AggregateRef("CreditBalanceAggregate"), List(
        FieldMetadata(name = "userId", fieldType = idType),
        FieldMetadata(name = "amount", fieldType = moneyRef)
      ), Map("userId" -> "toUserId", "amount" -> "amount"))
    ),
    steps = Seq(
      SagaStepMetadata("reserve-amount-from-account", "FromAccountParticipant", SagaPhaseLogic(Some(CommandBinding(reserveFundsCmdRef, mappingTransferIdWithAmount)), None, None), sagaResilience, stepGroup = 1),
      SagaStepMetadata("record-incoming-amount-to-account", "ToAccountParticipant", SagaPhaseLogic(Some(CommandBinding(recordIncomingCmdRef, mappingTransferIdWithAmount)), None, None), sagaResilience, stepGroup = 1),
      SagaStepMetadata("commit-from-account", "FromAccountParticipant", SagaPhaseLogic(None, Some(CommandBinding(deductFundsCmdRef, mappingTransferId)), None), sagaResilience, stepGroup = 1),
      SagaStepMetadata("commit-to-account", "ToAccountParticipant", SagaPhaseLogic(None, Some(CommandBinding(commitIncomingCmdRef, mappingTransferId)), None), sagaResilience, stepGroup = 1),
      SagaStepMetadata("compensate-from-account", "FromAccountParticipant", SagaPhaseLogic(None, None, Some(CommandBinding(releaseReservedFundsCmdRef, mappingTransferId))), sagaResilience, stepGroup = 1),
      SagaStepMetadata("compensate-to-account", "ToAccountParticipant", SagaPhaseLogic(None, None, Some(CommandBinding(cancelIncomingCmdRef, mappingTransferId))), sagaResilience, stepGroup = 1)
    ),
    replyMetadata = Some(transactionResultConfirmation),
    context = Some(moneyTransferContext)
  )

  // [v3] SagaRunner 语义：txId 幂等 + statusOf 轮询；不再有 Saga 事务仓储
  private val moneyTransferService = ApplicationServiceMetadata("MoneyTransferService", "转账服务", Seq.empty, Seq(ServiceMethod("transfer", Seq(ParameterMetadata("from", idType), ParameterMetadata("to", idType), ParameterMetadata("amount", moneyRef)), futureType.copy(typeParameters = Seq(CommandReplyRef("TransactionResultConfirmation"))), BusinessLogic("Initiate Saga via SagaRunner", referenceCode = Some("moneyTransferSaga.runner(system, MoneyTransferSagaDefinition.coordinatorRef).run(from.toString, to.toString, Money(amount.amount, amount.currency)).map(_.fold(e => Left(e), r => Right(TransactionResultConfirmation(r.snapshot.transactionId, None))))")))))
  private val moneyTransferServiceRef = ApplicationServiceRef("MoneyTransferService")
  private val homeController = ControllerMetadata(name = "HomeController", basePath = "/", description = "主控制器", dependencies = Seq(getRecent12MonthsReportRef, monthlyRepoRef, creditBalanceRepoRef, getBalanceQueryRef, createCreditBalanceServiceRef, depositServiceRef, withdrawServiceRef, moneyTransferServiceRef), Seq(EndpointMetadata("GET", "/", "index", Seq.empty, None, CustomType("Result", "play.api.mvc"), BusinessLogic("渲染首页", referenceCode = Some("Ok(views.html.index())"))), EndpointMetadata("GET", "/balance/:userId", "getBalance", Seq(ParameterMetadata("userId", StringType)), None, futureType.copy(typeParameters = Seq(CustomType("Either", "scala.util", Seq(pureMadzError, listOfMoney)))), BusinessLogic("查询余额", referenceCode = Some("getBalanceQuery.fetchBalanceByUserId(userId)"))), EndpointMetadata("POST", "/deposit/:userId/:currency/:amount", "deposit", Seq(ParameterMetadata("userId", StringType), ParameterMetadata("currency", StringType), ParameterMetadata("amount", BigDecimalType)), None, futureType.copy(typeParameters = Seq(creditBalanceReplyRef)), BusinessLogic("存款", referenceCode = Some("depositService.requestDeposit(userId, Money(amount, Currency.getInstance(currency)))"))), EndpointMetadata("POST", "/withdraw/:userId/:currency/:amount", "withdraw", Seq(ParameterMetadata("userId", StringType), ParameterMetadata("currency", StringType), ParameterMetadata("amount", BigDecimalType)), None, futureType.copy(typeParameters = Seq(creditBalanceReplyRef)), BusinessLogic("取款", referenceCode = Some("withdrawService.requestWithdraw(userId, Money(amount, Currency.getInstance(currency)))"))), EndpointMetadata("POST", "/transfer/:fromUserId/:toUserId/:currency/:amount", "transfer", Seq(ParameterMetadata("fromUserId", StringType), ParameterMetadata("toUserId", StringType), ParameterMetadata("currency", StringType), ParameterMetadata("amount", BigDecimalType)), None, futureType.copy(typeParameters = Seq(creditBalanceReplyRef)), BusinessLogic("转账", referenceCode = Some("moneyTransferService.transfer(fromUserId, toUserId, Money(amount, Currency.getInstance(currency)))")))))

  // [S2-32 R5d] banking 门表 opt-in（范例系统主动采纳——banking 是生成器的 golden 样本系统，
  // 采纳门词表正是其职责；生产三元数据 gate=None 零改动红线不涉 banking）。三档声明驱动
  // （D6：名字即域根名——ControllerBuilder.tierOf 按两维语义布尔判定，零硬编码表）。
  private val bankingGates = Seq(
    GateDefinition("anonymous", requiresIdentity = false, requiresTenant = false),
    GateDefinition("global", requiresIdentity = true, requiresTenant = false),
    GateDefinition("tenant", requiresIdentity = true, requiresTenant = true)
  )

  // [S2-40 R6] banking 读侧视图注册（读半 opt-in——EP_Controller_ReadSide_Routes R6）。侦察判定：
  // ①查询注入源＝投影仓库（node ViewApiController 绑定 DecisionView 仓库族·findAll/findByIdentity
  // 契约；banking「余额」读＝GetBalanceQuery 聚合 ask 型查询服务——Future[Either,List[Money]] 逐用户
  // 形态与 ViewListDto[V] 列表契约（Future[List[V]]）不兼容，不硬造绑定）；banking 真正的读模型＝
  // MonthlyIncomeAndExpenseSummaryProjection（带 ReadModelSchema 字段级血缘）→ monthlyRepo。
  // ②viewKey 命名对齐 reference_project 支撑件桩（ViewKeys.MonthlyIncomeAndExpenseSummaries＋
  // CommandRoleMap.m 已注册同名键——发射引用可解析）。已知边界（如实入锚·R5d 先例同款）：
  // monthlyRepo 声明的方法集是 filterByPeriodLCRO（无 findAll/findByIdentity 标准读对）——发射按
  // node 读契约走 findAll()，方法集缺口属 banking 元数据边界归延伸批；行 DTO 字段（user_id 等）
  // 无 tenantId——tenantOf 过滤按 node 固定形态发射 `_.tenantId`。
  private val bankingViewKeys = Seq(
    ViewKeyDefinition(
      name = "monthly-income-expense-summaries",
      repository = ProjectionRepositoryRef("MonthlyIncomeAndExpenseSummaryRepository"),
      singleKey = false, // 复合键（user_id/year/month/day 四身份键）——item 端点＝compositeItem 400 契约
      description = "月度收支汇总读视图（BalanceChanged 投影）"
    )
  )

  // [S2-32 R5d] DSL 化 CreditBalance 控制器（黄金首锚对象）：deposit 写端点＝gate=tenant＋
  // serves=ServesCommand("Deposit")——命令直发形态 1（api.tenant.write＋ask 管线＋OkReceipt）。
  // 已知边界（如实入锚·发射规格 §六注记）：Deposit 命令无聚合同名 Id 参数（banking 命令族
  // 寻址外置先例）→ 寻址轴判定＝工厂发号（generatedId）；Req VO＝命令参数主轨推导
  // （change: Money——非 JSON 原生 VO 字段）；ask 回执类型走 <Cmd>Reply 约定名。
  // [S2-40 R6] 读半补齐：monthlySummaries 读端点＝gate=tenant＋serves=ServesView(
  // "monthly-income-expense-summaries")——读侧形态 5（api.tenant.read＋CommandRoleMap.of(vk)＋
  // pageGuard＋tenantOf 过滤＋ViewListDto 信封·ViewApiController 逐块对齐）。读写混载（同控制器
  // 写命令+读视图）＝最小增量组织形态（不新造读控制器元数据）；HomeController 保持 gate=None
  // 存量面零漂移（混合控制器改造归后续批拍板）。
  private val creditBalanceApiController = ControllerMetadata(
    name = "CreditBalanceApiController",
    basePath = "/api/v1/credit-balances",
    description = "CreditBalance 命令 API（DSL 形态示范——tenant 档）",
    dependencies = Seq.empty,
    Seq(
      EndpointMetadata(
        method = "POST",
        path = "/api/v1/credit-balances/deposit",
        actionName = "deposit",
        parameters = Seq.empty,
        requestBody = None,
        responseType = futureType.copy(typeParameters = Seq(creditBalanceReplyRef)),
        logic = BusinessLogic("存款", referenceCode = Some("repository.entityRef(generatedId).ask(replyTo => Deposit(req.change, replyTo))")),
        gate = Some(GateRef("tenant")),
        serves = Some(EndpointTarget.ServesCommand("Deposit"))
      ),
      EndpointMetadata(
        method = "GET",
        path = "/api/v1/credit-balances/monthly-income-expense-summaries",
        actionName = "monthlySummaries",
        parameters = Seq(ParameterMetadata("page", IntType), ParameterMetadata("pageSize", IntType)),
        requestBody = None,
        responseType = UnitType, // 读回执＝ViewListDto 信封（Template 固定发射·responseType 不消费）
        logic = BusinessLogic("查询月度收支汇总", referenceCode = Some("monthlyIncomeAndExpenseSummaryRepository.findAll()")),
        gate = Some(GateRef("tenant")),
        serves = Some(EndpointTarget.ServesView("monthly-income-expense-summaries"))
      )
    )
  )

  private val interfaces = InterfaceLayer(controllers = Seq(homeController, creditBalanceApiController))
  val bankingSystem: SystemMetadata = SystemMetadata("BankingSystem", Some("banking"), DomainLayer(valueObjects = Seq(moneyType), entities = Seq(creditBalanceEntity), services = Seq(transferValidator), invariants = Seq(addInitialOnlyOnceRule, depositRule, withdrawRule, reserveFundsRule, deductFundsRule, releaseReservedFundsRule, recordIncomingCreditsRule, commitIncomingCreditsRule, cancelIncomingCreditRule), behaviors = Seq(creditBalanceEventHandler)), ApplicationLayer(services = Seq(createCreditBalanceService, depositService, withdrawService, moneyTransferService), queries = Seq(getBalanceQuery, getRecent12MonthsReport), sagas = Seq(moneyTransferSaga), behaviors = Seq(creditBalanceBehaviors), aggregates = Seq(creditBalanceAggregate), repositories = Seq(monthlyRepo, creditBalanceRepo), gates = bankingGates, viewKeys = bankingViewKeys),
    InfrastructureLayer(repositories = Seq(monthlyRepo, creditBalanceRepo), projections = Seq(monthlyProjection)), interfaces)
}
