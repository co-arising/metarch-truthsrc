package goldens.conndsl

trait PaymentGateway {
  def charge: String
}

class StripeGateway extends PaymentGateway {
  def charge: String = ??? // TODO: connect to Stripe API
}
