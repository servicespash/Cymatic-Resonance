import type {
  PaymentInitiation,
  PaymentRequest,
  VerifiedPayment,
} from "./contracts";

export interface IPaymentGateway {
  readonly provider: string;
  initiatePayment(request: PaymentRequest): Promise<PaymentInitiation>;
  verifyWebhook(
    request: Request,
    rawBody: string,
  ): Promise<VerifiedPayment | null>;
  checkTransactionStatus(
    transactionReference: string,
  ): Promise<VerifiedPayment | null>;
}
