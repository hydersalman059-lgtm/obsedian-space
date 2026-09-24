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
            return json(
                {
                    error:
                        "Missing Razorpay signature"
                },
                401
            );
        }

        const secret =
            Deno.env.get(
                "RAZORPAY_WEBHOOK_SECRET"
            );

        if (!secret) {
            return json(
                {
                    error:
                        "Webhook secret not configured"
                },
                500
            );
        }

        /*
         * Verify HMAC-SHA256
         */

        const expected =
            await hmacSha256(
                secret,
                rawBody
            );

        if (
            !timingSafeEqual(
                expected,
                signature
            )
        ) {
            return json(
                {
                    error:
                        "Invalid webhook signature"
                },
                401
            );
        }

        const event =
            JSON.parse(rawBody);

        const eventName =
            event?.event;

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

                return json({
                    received: true
                });
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

                        razorpay_signature:
                            signature

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


async function hmacSha256(
    secret: string,
    message: string
) {

    const key =
        await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(
                secret
            ),
            {
                name:
                    "HMAC",
                hash:
                    "SHA-256"
            },
            false,
            ["sign"]
        );

    const signature =
        await crypto.subtle.sign(
            "HMAC",
            key,
            new TextEncoder().encode(
                message
            )
        );

    return [...new Uint8Array(signature)]
        .map(
            b =>
                b
                    .toString(16)
                    .padStart(2, "0")
        )
        .join("");
}


function timingSafeEqual(
    a: string,
    b: string
) {

    if (a.length !== b.length) {
        return false;
    }

    let result = 0;

    for (
        let i = 0;
        i < a.length;
        i++
    ) {
        result |=
            a.charCodeAt(i) ^
            b.charCodeAt(i);
    }

    return result === 0;
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