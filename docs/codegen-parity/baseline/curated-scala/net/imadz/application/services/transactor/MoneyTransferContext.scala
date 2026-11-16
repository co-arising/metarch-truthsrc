package net.imadz.application.services.transactor

import net.imadz.application.aggregates.repository.CreditBalanceRepository

case class MoneyTransferContext(creditBalanceRepository: CreditBalanceRepository)
