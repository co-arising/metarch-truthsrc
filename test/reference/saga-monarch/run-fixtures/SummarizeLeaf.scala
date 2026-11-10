package reference.inventory.ext

import reference.inventory.kernel.{ReservationResult, PureReviewRunProtocol}
import PureReviewRunProtocol.Summarize
import scala.concurrent.Future

final class SummarizeLeaf extends Summarize.Leaf {
  def apply(args: Summarize.Args): Future[Summarize.Outcome] =
    Future.successful(Summarize.Outcome.Done(Summarize.Values(ReservationResult(args.transactionId, args.request))))
}
