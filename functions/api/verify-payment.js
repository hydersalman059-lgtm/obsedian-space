/*
 * Obsedian.Space — Razorpay Checkout Signature Verification
 * Cloudflare Pages Function: POST /api/verify-payment
 *
 * This endpoint verifies the signature from Razorpay Checkout using the
 * order ID saved server-side, then confirms order, amount, currency, and
 * payment status against Razorpay's API. It does NOT activate a plan.
 * The signed payment.captured webhook remains the activation authority.
 */

export async function onRequestPost(context) {
    const request = context.request;
    const env = context.env || {};

    try {
        if (request.method !== "POST") {
            return json({ error: "Method not allowed." }, 405);
        }

        const authHeader = request.headers.get("Authorization") || "";
        if (!authHeader.startsWith("Bearer ")) {
            return json({ error: "Unauthorized." }, 401);
        }
        const accessToken = authHeader.slice(7).trim();

        const body = await request.json().catch(() => null);
        const requestedOrderId = String(body?.razorpay_order_id || "").trim();
        const paymentId = String(body?.razorpay_payment_id || "").trim();
        const checkoutSignature = String(body?.razorpay_signature || "").trim();

        if (!requestedOrderId || !paymentId || !checkoutSignature) {
            return json({ error: "Missing Razorpay payment verification fields." }, 400);
        }

        if (
            !env.SUPABASE_URL ||
            !env.SUPABASE_PUBLISHABLE_KEY ||
            !env.SUPABASE_SERVICE_ROLE_KEY ||
            !env.RAZORPAY_KEY_ID ||
            !env.RAZORPAY_KEY_SECRET ||
            !String(env.RAZORPAY_KEY_ID).startsWith("rzp_live_")
        ) {
            return json({ error: "Live payment verification is not configured." }, 503);
        }

        const userResponse = await fetch(
            `${trimSlash(env.SUPABASE_URL)}/auth/v1/user`,
            {
                headers: {
                    apikey: env.SUPABASE_PUBLISHABLE_KEY,
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        if (!userResponse.ok) {
            return json({ error: "Your login session is invalid or expired." }, 401);
        }

        const user = await userResponse.json();
        if (!user?.id) {
            return json({ error: "User account was not found." }, 401);
        }

        /* Retrieve the order ID from the database scoped to this user. */
        const subResponse = await supabaseFetch(
            env,
            `/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(user.id)}&razorpay_order_id=eq.${encodeURIComponent(requestedOrderId)}&select=id,user_id,plan_id,billing_cycle,status,razorpay_order_id,razorpay_payment_id,payment_amount,currency&limit=1`
        );

        if (!subResponse.ok) {
            console.error("Payment verification lookup failed:", await readResponseText(subResponse));
            return json({ error: "Unable to verify this payment order." }, 500);
        }

        const rows = await subResponse.json();
        const subscription = Array.isArray(rows) ? rows[0] : null;

        if (!subscription || subscription.razorpay_order_id !== requestedOrderId) {
            return json({ error: "This payment order does not belong to the signed-in user." }, 404);
        }

        if (
            subscription.status !== "pending" &&
            !(subscription.status === "active" && subscription.razorpay_payment_id === paymentId)
        ) {
            return json({ error: "This order is no longer awaiting payment." }, 409);
        }

        const trustedOrderId = subscription.razorpay_order_id;
        const expectedSignature = await hmacSha256(
            env.RAZORPAY_KEY_SECRET,
            `${trustedOrderId}|${paymentId}`
        );

        if (!timingSafeEqual(expectedSignature, checkoutSignature)) {
            return json({ error: "Razorpay Checkout signature is invalid." }, 400);
        }

        /* Verify the payment entity directly with Razorpay, not only the browser payload. */
        const razorpayAuth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
        const paymentResponse = await fetch(
            `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
            {
                method: "GET",
                headers: {
                    Authorization: `Basic ${razorpayAuth}`
                }
            }
        );

        const payment = await paymentResponse.json().catch(() => ({}));
        if (!paymentResponse.ok) {
            console.error("Razorpay payment lookup failed:", {
                status: paymentResponse.status,
                code: payment?.error?.code
            });
            return json({ error: "Unable to confirm payment status with Razorpay." }, 502);
        }

        const expectedPaise = Math.round(Number(subscription.payment_amount || 0) * 100);
        const expectedCurrency = String(subscription.currency || "INR").toUpperCase();

        if (
            payment.order_id !== trustedOrderId ||
            Number(payment.amount) !== expectedPaise ||
            String(payment.currency || "").toUpperCase() !== expectedCurrency
        ) {
            console.error("Razorpay payment/order details do not match the pending subscription.");
            return json({ error: "Payment details do not match this subscription order." }, 400);
        }

        if (!["captured", "authorized"].includes(String(payment.status || "").toLowerCase())) {
            return json({ error: "Razorpay has not confirmed a successful payment.", payment_status: payment.status || "unknown" }, 409);
        }

        /* Store only the real Checkout signature. Activation happens in the webhook. */
        const patchResponse = await supabaseFetch(
            env,
            `/rest/v1/subscriptions?id=eq.${encodeURIComponent(subscription.id)}&user_id=eq.${encodeURIComponent(user.id)}`,
            {
                method: "PATCH",
                headers: { Prefer: "return=minimal" },
                body: JSON.stringify({
                    razorpay_signature: checkoutSignature,
                    updated_at: new Date().toISOString()
                })
            }
        );

        if (!patchResponse.ok) {
            console.error("Could not save the Checkout signature:", await readResponseText(patchResponse));
            return json({ error: "Payment verified, but the verification record could not be saved." }, 500);
        }

        return json({
            success: true,
            verified: true,
            payment_status: String(payment.status || "").toLowerCase(),
            message: payment.status === "captured"
                ? "Payment verified. Waiting for the signed payment-captured webhook to finalize the subscription."
                : "Payment signature verified. Subscription activation waits for payment capture."
        });

    } catch (error) {
        console.error("Payment verification error:", error?.message || error);
        return json({ error: "Unable to verify the payment right now." }, 500);
    }
}

async function supabaseFetch(env, path, options = {}) {
    return fetch(`${trimSlash(env.SUPABASE_URL)}${path}`, {
        ...options,
        headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });
}

async function hmacSha256(secret, message) {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(message)
    );
    return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

async function readResponseText(response) {
    try { return await response.text(); } catch { return ""; }
}

function trimSlash(value) {
    return String(value || "").replace(/\/+$/, "");
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
