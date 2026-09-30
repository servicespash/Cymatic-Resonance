import { createFileRoute } from "@tanstack/react-router";
import { createPaymentGateway } from "@/lib/revenue/provider";
import { settleVerifiedPayment } from "@/lib/revenue/settlement";

export const Route = createFileRoute("/api/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();

        try {
          const payment = await createPaymentGateway().verifyWebhook(
            request,
            rawBody,
          );

          if (!payment) {
            return Response.json(
              { error: "Invalid webhook" },
              { status: 401 },
            );
          }

          await settleVerifiedPayment(payment);

          return Response.json({ received: true });
        } catch (error) {
          console.error("[Payment webhook]", error);
          return Response.json(
            { error: "Webhook processing failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
