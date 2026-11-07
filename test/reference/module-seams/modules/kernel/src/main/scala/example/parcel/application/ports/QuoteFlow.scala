package example.parcel.application.ports

import example.parcel.domain.QuoteError
import example.parcel.domain.values.{Quote, QuoteRequest}

import scala.concurrent.Future

trait QuoteFlow {
  def quote(request: QuoteRequest): Future[Either[QuoteError, Quote]]
}
