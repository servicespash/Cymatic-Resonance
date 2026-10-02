import type { IPaymentGateway } from "../gateway";
import type {
  PaymentInitiation,
  PaymentRequest,
  VerifiedPayment,
} from "../contracts";

interface FlutterwaveConfig {
  secretKey: string;
  baseUrl: string;
  webhookSecretHash: string;
}

interface FlutterwaveTransaction {
  id: number;
  tx_ref: string;
  flw_ref: string;
  amount: number;
  charged_amount: number;
  currency: string;
  status: string;
  app_fee?: number;
  merchant_fee?: number;
}

interface FlutterwaveResponse<T> {
  status: string;
  message: string;
  data: T;
}

function minorUnits(value: number): bigint {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Gateway returned an invalid monetary amount");
  }
  return BigInt(value);
}

export class FlutterwaveGateway implements IPaymentGateway {
  readonly provider = "FLUTTERWAVE";

  constructor(private readonly config: FlutterwaveConfig) {}

  async initiatePayment(
    request: PaymentRequest,
  ): Promise<PaymentInitiation> {
    if (request.amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error("Payment amount exceeds gateway-safe integer range");
    }

    const response = await fetch(`${this.config.baseUrl}/v3/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Number(request.amountMinor),
        currency: request.currency,
        email: request.customerEmail,
        phone_number: request.customerPhone,
        tx_ref: request.txRef,
        redirect_url: request.returnUrl,
        payment_options: "card,mobilemoneyuganda",
        meta: {
          tenant_id: request.tenantId,
          feature_key: request.featureKey,
          target_plan: request.targetPlan,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Flutterwave initiation failed: HTTP ${response.status}`);
    }

    const body =
      (await response.json()) as FlutterwaveResponse<{ link?: string }>;

    if (body.status !== "success") {
      throw new Error(body.message || "Flutterwave initiation failed");
    }

    return {
      provider: this.provider,
      providerReference: request.txRef,
      checkoutUrl: body.data.link,
      status: "PENDING",
    };
  }

  async verifyWebhook(
    request: Request,
    rawBody: string,
  ): Promise<VerifiedPayment | null> {
    const signature = request.headers.get("verif-hash");
    if (!signature || !this.constantTimeEqual(signature, this.config.webhookSecretHash)) {
      return null;
    }

    let payload: {
      event?: string;
      data?: FlutterwaveTransaction;
    };

    try {
      payload = JSON.parse(rawBody) as typeof payload;
    } catch {
      return null;
    }

    if (payload.event !== "charge.completed" || !payload.data) {
      return null;
    }

    return this.checkTransactionStatus(String(payload.data.id));
  }

  async checkTransactionStatus(
    transactionReference: string,
  ): Promise<VerifiedPayment | null> {
    const response = await fetch(
      `${this.config.baseUrl}/v3/transactions/${encodeURIComponent(
        transactionReference,
      )}/verify`,
      {
        headers: {
          Authorization: `Bearer ${this.config.secretKey}`,
        },
      },
    );

    if (!response.ok) return null;

    const body =
      (await response.json()) as FlutterwaveResponse<FlutterwaveTransaction>;

    const transaction = body.data;
    if (body.status !== "success" || transaction.status !== "successful") {
      return null;
    }

    return {
      provider: this.provider,
      providerReference: transaction.flw_ref,
      transactionReference: transaction.tx_ref,
      amountMinor: minorUnits(transaction.charged_amount),
      currency: transaction.currency as VerifiedPayment["currency"],
      status: "SUCCEEDED",
      providerFeeMinor: minorUnits(
        transaction.app_fee ?? transaction.merchant_fee ?? 0,
      ),
    };
  }

  private constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i += 1) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
}
