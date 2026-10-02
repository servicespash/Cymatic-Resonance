import { FlutterwaveGateway } from "./providers/flutterwave";
import type { IPaymentGateway } from "./gateway";

const baseUrl = "https://api.flutterwave.com";

export function createPaymentGateway(): IPaymentGateway {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  const webhookSecretHash = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;

  if (!secretKey || !webhookSecretHash) {
    throw new Error("Payment gateway is not configured");
  }

  return new FlutterwaveGateway({
    secretKey,
    webhookSecretHash,
    baseUrl,
  });
}
