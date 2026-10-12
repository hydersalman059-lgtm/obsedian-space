/*
 * Obsedian.Space — Existing Payment Reconciliation
 *
 * POST /api/reconcile-payment
 *
 * Requires the logged-in user's Supabase access token.
 * Only reconciles an order already associated with that user.
 * Checks the order and payment directly against Razorpay's API.
 * Never activates a subscription from browser-provided payment status.
 */

export async function onRequestPost(context) {
    const request = context.request;
    const env = context.env || {};

    try {
        const authHeader =
            request.headers.get("Authorization") || "";

        if (!authHeader.startsWith("Bearer ")) {
            return json({ error: "Unauthorized." }, 401);
        }

        const accessToken = authHeader.slice(7).trim();

        if (
            !env.SUPABASE_URL ||
            !env.SUPABASE_PUBLISHABLE_KEY ||
            !env.SUPABASE_SERVICE_ROLE_KEY ||
            !env.RAZORPAY_KEY_ID ||
            !env.RAZORPAY_KEY_SECRET ||
            !String(env.RAZORPAY_KEY_ID).startsWith("rzp_live_")
        ) {
            return json({
                error: "Live payment reconciliation is not configured."
            }, 503);
        }

        const body = await request.json().catch(() => null);
        const orderId = String(body?.order_id || "").trim();

        if (!/^order_[A-Za-z0-9]+$/.test(orderId)) {
            return json({ error: "Invalid Razorpay order ID." }, 400);
        }

        const base = String(env.SUPABASE_URL).replace(/\/+$/, "");

        /* Validate the logged-in Supabase user. */
        const userResponse = await fetch(
            `${base}/auth/v1/user`,
            {
                headers: {
                    apikey: env.SUPABASE_PUBLISHABLE_KEY,
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        if (!userResponse.ok) {
            return json({
                error: "Your login session is invalid or expired."
            }, 401);
        }

        const user = await userResponse.json();

        if (!user?.id) {
            return json({ error: "User not found." }, 401);
        }

        /*
         * Find only the subscription belonging to this user
         * and this exact Razorpay order.
         */
        const query = new URLSearchParams({
            user_id: `eq.${user.id}`,
            razorpay_order_id: `eq.${orderId}`,
            select: [
                "id",
                "user_id",
                "plan_id",
                "billing_cycle",
                "status",
                "razorpay_order_id",
                "razorpay_payment_id",
                "payment_amount",
                "currency",
                "subscription_ends_at"
            ].join(","),
            limit: "1"
        });

        const subscriptionResponse = await dbFetch(
            env,
            `/rest/v1/subscriptions?${query.toString()}`
        );

        if (!subscriptionResponse.ok) {
            console.error(
                "Reconciliation subscription lookup failed:",
                await subscriptionResponse.text()
            );

            return json({
                error: "Unable to look up the subscription."
            }, 500);
        }

        const subscriptions = await subscriptionResponse.json();
        const subscription = subscriptions?.[0];

        if (!subscription) {
            return json({
                error: "This order is not associated with your account."
            }, 404);
        }

        /* Idempotent: do not activate or extend a paid period twice. */
        if (
            subscription.status === "active" &&
            subscription.razorpay_payment_id
        ) {
            return json({
                success: true,
                already_active: true,
                message: "This subscription is already active."
            });
        }

        if (subscription.status !== "pending") {
            return json({
                error: "This subscription is not awaiting payment.",
                status: subscription.status
            }, 409);
        }

        const razorpayAuth =
            "Basic " +
            btoa(
                `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`
            );

        const razorpayHeaders = {
            Authorization: razorpayAuth
        };

        /*
         * Confirm the order directly with Razorpay.
         */
        const orderResponse = await fetch(
            `https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`,
            { headers: razorpayHeaders }
        );

        const order = await orderResponse.json().catch(() => ({}));

        if (!orderResponse.ok || order.id !== orderId) {
            console.error("Razorpay order lookup failed:", {
                status: orderResponse.status,
                code: order?.error?.code
            });

            return json({
                error: "Could not confirm this order with Razorpay."
            }, 502);
        }

        const expectedPaise = Math.round(
            Number(subscription.payment_amount || 0) * 100
        );

        const expectedCurrency =
            String(subscription.currency || "INR").toUpperCase();

        if (
            !expectedPaise ||
            Number(order.amount) !== expectedPaise ||
            String(order.currency || "").toUpperCase() !== expectedCurrency
        ) {
            return json({
                error: "The Razorpay order amount or currency does not match."
            }, 409);
        }

        /*
         * Retrieve Razorpay's recorded payments for this order.
         */
        const paymentsResponse = await fetch(
            `https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}/payments`,
            { headers: razorpayHeaders }
        );

        const paymentList =
            await paymentsResponse.json().catch(() => ({}));

        if (!paymentsResponse.ok) {
            console.error("Razorpay payments lookup failed:", {
                status: paymentsResponse.status,
                code: paymentList?.error?.code
            });

            return json({
                error: "Could not retrieve payments for this order."
            }, 502);
        }

        const payment = (paymentList.items || []).find(item =>
            item.order_id === orderId &&
            String(item.status || "").toLowerCase() === "captured" &&
            Number(item.amount) === expectedPaise &&
            String(item.currency || "").toUpperCase() === expectedCurrency
        );

        if (!payment) {
            return json({
                error: "Razorpay has not returned a captured payment matching this order and amount. No changes were made."
            }, 409);
        }

        /*
         * Compute the subscription term. If an existing paid
         * subscription was carried forward to this pending row,
         * extend from its end date instead of losing that term.
         */
        const now = new Date();
        let startDate = now;

        if (subscription.subscription_ends_at) {
            const previousEnd =
                new Date(subscription.subscription_ends_at);

            if (
                !Number.isNaN(previousEnd.getTime()) &&
                previousEnd > now
            ) {
                startDate = previousEnd;
            }
        }

        let termDays;

        if (subscription.billing_cycle === "monthly") {
            termDays = 30;
        } else if (subscription.billing_cycle === "yearly") {
            termDays = 365;
        } else {
            return json({
                error: "This subscription has an unsupported billing cycle."
            }, 409);
        }

        const endDate = new Date(startDate);
        endDate.setUTCDate(endDate.getUTCDate() + termDays);

        /*
         * Atomically claim the pending row: only update it while
         * it is still pending, protecting against concurrent webhook
         * processing.
         */
        const patchQuery = new URLSearchParams({
            id: `eq.${subscription.id}`,
            user_id: `eq.${user.id}`,
            status: "eq.pending"
        });

        const patchResponse = await dbFetch(
            env,
            `/rest/v1/subscriptions?${patchQuery.toString()}`,
            {
                method: "PATCH",
                headers: {
                    Prefer: "return=representation"
                },
                body: JSON.stringify({
                    status: "active",
                    provider: "razorpay",
                    started_at: startDate.toISOString(),
                    subscription_ends_at: endDate.toISOString(),
                    razorpay_payment_id: payment.id,
                    payment_amount: Number(payment.amount) / 100,
                    currency: payment.currency || "INR",
                    last_payment_at: now.toISOString(),
                    updated_at: now.toISOString()
                })
            }
        );

        if (!patchResponse.ok) {
            console.error(
                "Subscription activation failed:",
                await patchResponse.text()
            );

            return json({
                error: "The payment was captured, but subscription activation failed. Check the server logs."
            }, 500);
        }

        const updatedRows = await patchResponse.json();

        if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
            return json({
                error: "The subscription changed while reconciliation was running. Refresh the dashboard and check its status before retrying."
            }, 409);
        }

        /*
         * Expire the old active/trial rows after the paid row
         * has been successfully activated.
         */
        const oldQuery = new URLSearchParams({
            user_id: `eq.${user.id}`,
            id: `neq.${subscription.id}`,
            status: "in.(active,trial)"
        });

        const oldRowsResponse = await dbFetch(
            env,
            `/rest/v1/subscriptions?${oldQuery.toString()}`,
            {
                method: "PATCH",
                headers: {
                    Prefer: "return=minimal"
                },
                body: JSON.stringify({
                    status: "expired",
                    updated_at: now.toISOString()
                })
            }
        );

        if (!oldRowsResponse.ok) {
            console.error(
                "Could not expire older subscription rows:",
                await oldRowsResponse.text()
            );
        }

        /*
         * Record usage for the captured payment.
         * Failure to write this non-authoritative log must not
         * undo the subscription activation.
         */
        const usageResponse = await dbFetch(
            env,
            "/rest/v1/usage_events",
            {
                method: "POST",
                headers: {
                    Prefer: "return=minimal"
                },
                body: JSON.stringify({
                    user_id: user.id,
                    event_type: "subscription_payment",
                    provider: "razorpay",
                    units: 1,
                    metadata: {
                        order_id: orderId,
                        payment_id: payment.id,
                        plan_id: subscription.plan_id,
                        billing_cycle: subscription.billing_cycle,
                        amount: Number(payment.amount) / 100,
                        reconciliation: true
                    }
                })
            }
        );

        if (!usageResponse.ok) {
            console.error(
                "Could not write payment usage event:",
                await usageResponse.text()
            );
        }

        console.log("Captured Razorpay payment reconciled:", {
            order_id: orderId,
            payment_id: payment.id,
            user_id: user.id,
            subscription_id: subscription.id
        });

        return json({
            success: true,
            activated: true,
            payment_id: payment.id,
            amount: Number(payment.amount) / 100,
            currency: payment.currency || "INR",
            subscription_ends_at: endDate.toISOString(),
            message: "Captured payment verified and subscription activated."
        });

    } catch (error) {
        console.error(
            "Payment reconciliation error:",
            error?.message || error
        );

        return json({
            error: "Unable to reconcile this payment right now."
        }, 500);
    }
}

async function dbFetch(env, path, options = {}) {
    const base = String(env.SUPABASE_URL).replace(/\/+$/, "");

    return fetch(`${base}${path}`, {
        ...options,
        headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });
}

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store"
        }
    });
}