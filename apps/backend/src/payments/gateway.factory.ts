import { config } from "../env.js";
import type { PaymentGateway } from "./gateway.interface.js";
import { SimulatedProvider } from "./providers/simulated.provider.js";
import { RazorpayProvider } from "./providers/razorpay.provider.js";
import { MockStripeProvider } from "./providers/stripe.provider.js";
import { CashOnDeliveryProvider } from "./providers/cod.provider.js";

// method overrides the configured gateway — COD never uses an online gateway.
export function getGateway(method?: string): PaymentGateway {
  if (method === "COD") return new CashOnDeliveryProvider();

  switch (config.payment.provider.toLowerCase()) {
    case "razorpay":
      return new RazorpayProvider();
    case "stripe":
      return new MockStripeProvider();
    default:
      return new SimulatedProvider();
  }
}
