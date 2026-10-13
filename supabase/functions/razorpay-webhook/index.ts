import { createClient } from
    "https://esm.sh/@supabase/supabase-js@2";

const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
    "Access-Control-Allow-Methods":
        "POST, OPTIONS"
};


Deno.serve(async (req) => {

    if (req.method === "OPTIONS") {
        return new Response(
            "ok",
            {
                headers: cors
            }
        );
    }

    if (req.method !== "POST") {
        return json(
            {
                error:
                    "Method not allowed"
            },
            405
        );
    }

    try {

        const rawBody =
            await req.text();

        const signature =
            req.headers.get(
                "x-razorpay-signature"
            );

        if (!signature) {
            console.warn("[razorpay-webhook] Rejected request: x-razorpay-signature header is missing.");
            return json(
                {
                    error:
                        "Missing Razorpay signature"
                },
                401
            );
        }

        /* This is the dedicated LIVE webhook secret from Razorpay Settings > Webhooks.
         * It is NOT the API Key Secret used by Checkout/order creation.
         */
        const secret =
            Deno.env.get(
                "RAZORPAY_WEBHOOK_SECRET"
            );

        if (!secret) {
            console.error("[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET is not configured.");
            return json(
                {
                    error:
                        "Webhook secret not configured"
                },
                500
            );
        }

        /*
         * Verify HMAC-SHA256 against the exact raw request body.
         * Do not parse/re-serialize JSON before signature verification.
         */
        const validSignature = await verifyHmacSha256(
            secret,
            rawBody,
            signature
        );

        if (!validSignature) {
            console.warn(
                "[razorpay-webhook] Signature verification failed. Ensure RAZORPAY_WEBHOOK_SECRET exactly matches the secret saved on this LIVE Razorpay webhook; do not use the Checkout API key secret.",
                {
                    signatureLength: signature.length,
                    rawBodyBytes: new TextEncoder().encode(rawBody).length,
                    secretConfigured: true
                }
            );
            return json(
                {
                    error:
                        "Invalid webhook signature. Check that the Supabase webhook secret matches the secret configured on the Razorpay webhook."
                },
                401
            );
        }

        const event =
            JSON.parse(rawBody);

        const eventName =
            event?.event;

        console.log("[razorpay-webhook] Signature verified; processing event:", eventName || "unknown");

        /*
         * --------------------------------------
         * PAYMENT CAPTURED
         * --------------------------------------
         */

        if (
            eventName ===
            "payment.captured"
        ) {

            const payment =
                event?.payload
                    ?.payment
                    ?.entity;

            if (!payment) {
                return json({
                    received: true
                });
            }

            const orderId =
                payment.order_id;

            const paymentId =
                payment.id;

            const amount =
                Number(payment.amount || 0) /
                100;

            /*
             * Payment/order information
             * comes from Razorpay.
             */

            const supabase =
                createClient(
                    Deno.env.get(
                        "SUPABASE_URL"
                    )!,
                    Deno.env.get(
                        "SUPABASE_SERVICE_ROLE_KEY"
                    )!
                );

            /*
             * Find pending subscription
             */

            const {
                data: subscription,
                error
            } =
                await supabase
                    .from(
                        "subscriptions"
                    )
                    .select(
                        "*,plans(*)"
                    )
                    .eq(
                        "razorpay_order_id",
                        orderId
                    )
                    .maybeSingle();

            if (error) {
                console.error(
                    error
                );

                return json(
                    {
                        error:
                            "Subscription lookup failed"
                    },
                    500
                );
            }

            if (!subscription) {
                console.error(
                    "Subscription not found for order:",
                    orderId
                );

                /* Retry delivery rather than acknowledge a paid order that is not recorded. */
                return json({
                    error: "Subscription not found for Razorpay order."
                }, 500);
            }

            /* Never activate a payment whose amount/currency differs from the saved order. */
            const expectedAmountPaise = Math.round(
                Number(subscription.payment_amount || 0) * 100
            );
            const actualAmountPaise = Number(payment.amount || 0);
            const expectedCurrency = String(subscription.currency || "INR").toUpperCase();
            const actualCurrency = String(payment.currency || "INR").toUpperCase();

            if (
                !expectedAmountPaise ||
                actualAmountPaise !== expectedAmountPaise ||
                actualCurrency !== expectedCurrency
            ) {
                console.error("Razorpay amount/currency mismatch for order:", orderId);
                return json({
                    error: "Payment amount or currency does not match the saved order."
                }, 400);
            }

            /*
             * Prevent duplicate processing.
             */

            if (
                subscription.razorpay_payment_id ===
                paymentId &&
                subscription.status ===
                "active"
            ) {
                return json({
                    received: true,
                    duplicate: true
                });
            }

            const now =
                new Date();

            let startDate =
                now;

            /*
             * Renewal:
             *
             * If the existing paid plan has
             * not expired, extend from its
             * current end date.
             */

            if (
                subscription.subscription_ends_at
            ) {

                const existingEnd =
                    new Date(
                        subscription.subscription_ends_at
                    );

                if (
                    existingEnd > now
                ) {
                    startDate =
                        existingEnd;
                }
            }

            const billingCycle =
                subscription.billing_cycle ||
                "monthly";

            const endDate =
                new Date(
                    startDate
                );

            if (
                billingCycle ===
                "yearly"
            ) {

                endDate.setUTCDate(
                    endDate.getUTCDate() +
                    365
                );

            } else {

                endDate.setUTCDate(
                    endDate.getUTCDate() +
                    30
                );
            }

            const {
                error:
                    updateError
            } =
                await supabase
                    .from(
                        "subscriptions"
                    )
                    .update({

                        status:
                            "active",

                        subscription_ends_at:
                            endDate.toISOString(),

                        razorpay_payment_id:
                            paymentId,

                        payment_amount:
                            amount,

                        currency:
                            payment.currency ||
                            "INR",

                        last_payment_at:
                            now.toISOString(),


                    })
                    .eq(
                        "id",
                        subscription.id
                    );

            if (updateError) {

                console.error(
                    updateError
                );

                return json(
                    {
                        error:
                            "Subscription activation failed"
                    },
                    500
                );
            }

            /*
             * This payment now owns the user's current paid term.
             * Expire older active/trial rows after carrying forward any
             * still-valid paid end date into this new subscription row.
             */
            const { error: supersededError } = await supabase
                .from("subscriptions")
                .update({
                    status: "expired",
                    updated_at: now.toISOString()
                })
                .eq("user_id", subscription.user_id)
                .neq("id", subscription.id)
                .in("status", ["active", "trial"]);

            if (supersededError) {
                /* Payment activation is already recorded; log without forcing repeated renewal. */
                console.error("Could not expire older subscription rows:", supersededError);
            }

            /*
             * Record payment usage/event.
             */

            await supabase
                .from(
                    "usage_events"
                )
                .insert({
                    user_id:
                        subscription.user_id,

                    event_type:
                        "subscription_payment",

                    provider:
                        "razorpay",

                    units:
                        1,

                    metadata: {
                        payment_id:
                            paymentId,

                        order_id:
                            orderId,

                        plan:
                            subscription.plans
                                ?.name,

                        billing_cycle:
                            billingCycle,

                        amount
                    }
                });

            console.log(
                "Subscription activated:",
                subscription.user_id,
                subscription.plans?.name,
                billingCycle,
                endDate.toISOString()
            );
        }

        /*
         * --------------------------------------
         * PAYMENT FAILED
         * --------------------------------------
         */

        if (
            eventName ===
            "payment.failed"
        ) {

            const payment =
                event?.payload
                    ?.payment
                    ?.entity;

            const orderId =
                payment?.order_id;

            if (orderId) {

                const supabase =
                    createClient(
                        Deno.env.get(
                            "SUPABASE_URL"
                        )!,
                        Deno.env.get(
                            "SUPABASE_SERVICE_ROLE_KEY"
                        )!
                    );

                await supabase
                    .from(
                        "subscriptions"
                    )
                    .update({
                        status:
                            "payment_failed"
                    })
                    .eq(
                        "razorpay_order_id",
                        orderId
                    )
                    .eq(
                        "status",
                        "pending"
                    );
            }
        }

        return json({
            received: true
        });

    } catch (error) {

        console.error(
            "Razorpay webhook error:",
            error
        );

        return json(
            {
                error:
                    "Webhook processing failed"
            },
            500
        );
    }
});


async function verifyHmacSha256(
    secret: string,
    rawBody: string,
    signatureHex: string
): Promise<boolean> {
    // SHA-256 HMAC signatures are 32 bytes represented by exactly 64 hex chars.
    if (!/^[a-f0-9]{64}$/i.test(signatureHex)) {
        return false;
    }

    const signatureBytes = new Uint8Array(32);
    for (let i = 0; i < signatureBytes.length; i++) {
        signatureBytes[i] = Number.parseInt(signatureHex.slice(i * 2, i * 2 + 2), 16);
    }

    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
    );

    return await crypto.subtle.verify(
        "HMAC",
        key,
        signatureBytes,
        new TextEncoder().encode(rawBody)
    );
}

function json(
    data: any,
    status = 200
) {

    return new Response(
        JSON.stringify(data),
        {
            status,

            headers: {
                ...cors,
                "Content-Type":
                    "application/json"
            }
        }
    );
}
