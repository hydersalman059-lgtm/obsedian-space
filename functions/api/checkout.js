/*
 * Obsedian.Space — Razorpay Live Checkout Order
 * Cloudflare Pages Function: POST /api/checkout
 *
 * Required Cloudflare Pages production variables/secrets:
 * SUPABASE_URL
 * SUPABASE_PUBLISHABLE_KEY
 * SUPABASE_SERVICE_ROLE_KEY
 * RAZORPAY_KEY_ID          (must begin rzp_live_)
 * RAZORPAY_KEY_SECRET      (secret; server-side only)
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
        if (!accessToken) {
            return json({ error: "Unauthorized." }, 401);
        }

        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object") {
            return json({ error: "Invalid request body." }, 400);
        }

        const planSlug = String(body.plan || "").trim().toLowerCase();
        const billingCycle = String(body.billing_cycle || "monthly").trim().toLowerCase();

        if (!["growth", "scale"].includes(planSlug)) {
            return json({ error: "Invalid plan." }, 400);
        }

        if (!["monthly", "yearly"].includes(billingCycle)) {
            return json({ error: "Invalid billing cycle." }, 400);
        }

        if (
            !env.SUPABASE_URL ||
            !env.SUPABASE_PUBLISHABLE_KEY ||
            !env.SUPABASE_SERVICE_ROLE_KEY
        ) {
            console.error("Checkout: required Supabase variables are missing.");
            return json({ error: "Checkout server configuration is incomplete." }, 500);
        }

        if (
            !env.RAZORPAY_KEY_ID ||
            !env.RAZORPAY_KEY_SECRET ||
            !String(env.RAZORPAY_KEY_ID).startsWith("rzp_live_")
        ) {
            console.error("Checkout: live Razorpay credentials are not configured.");
            return json({ error: "Live Razorpay is not configured yet." }, 503);
        }

        /* Validate the user's Supabase access token server-side. */
        const userResponse = await fetch(
            `${trimSlash(env.SUPABASE_URL)}/auth/v1/user`,
            {
                method: "GET",
                headers: {
                    apikey: env.SUPABASE_PUBLISHABLE_KEY,
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        if (!userResponse.ok) {
            return json({ error: "Your login session is invalid or expired. Please sign in again." }, 401);
        }

        const user = await userResponse.json();
        const userId = user?.id;
        if (!userId) {
            return json({ error: "User account was not found." }, 401);
        }

        /* The database is the source of truth for prices. */
        const planName = planSlug.charAt(0).toUpperCase() + planSlug.slice(1);
        const planResponse = await supabaseFetch(
            env,
            `/rest/v1/plans?name=eq.${encodeURIComponent(planName)}&active=eq.true&select=id,name,price_monthly_inr,price_yearly_inr,max_websites,term_days&limit=1`
        );

        if (!planResponse.ok) {
            console.error("Checkout plan lookup failed:", await readResponseText(planResponse));
            return json({ error: "Unable to load the selected subscription plan." }, 500);
        }

        const plans = await planResponse.json();
        const selectedPlan = Array.isArray(plans) ? plans[0] : null;
        if (!selectedPlan) {
            return json({ error: "The selected subscription plan is unavailable." }, 400);
        }

        const amountRupees = Number(
            billingCycle === "yearly"
                ? selectedPlan.price_yearly_inr
                : selectedPlan.price_monthly_inr
        );

        if (!Number.isSafeInteger(amountRupees) || amountRupees <= 0) {
            console.error("Checkout: invalid plan price in database:", selectedPlan.id);
            return json({ error: "The selected plan has an invalid price configuration." }, 500);
        }

        const amountPaise = amountRupees * 100;
        const now = new Date();

        /*
         * If the user already has a current paid subscription, preserve its
         * end date in the new pending row. The webhook will extend from this
         * date after the new payment is captured. Trial subscriptions are
         * intentionally not carried forward into the paid term.
         */
        let currentPaidEnd = null;
        const activeSubResponse = await supabaseFetch(
            env,
            `/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(userId)}&status=eq.active&subscription_ends_at=gt.${encodeURIComponent(now.toISOString())}&select=subscription_ends_at&order=subscription_ends_at.desc&limit=1`
        );

        if (activeSubResponse.ok) {
            const activeRows = await activeSubResponse.json();
            const futureEnd = Array.isArray(activeRows) ? activeRows[0]?.subscription_ends_at : null;
            if (futureEnd && new Date(futureEnd) > now) {
                currentPaidEnd = futureEnd;
            }
        } else {
            /* Do not fail checkout solely because a user has no active paid plan. */
            console.warn("Checkout: active-subscription lookup did not succeed.");
        }

        const receipt = `obs_${String(userId).slice(0, 8)}_${Date.now()}`;
        const razorpayAuth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);

        const orderResponse = await fetch(
            "https://api.razorpay.com/v1/orders",
            {
                method: "POST",
                headers: {
                    Authorization: `Basic ${razorpayAuth}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    amount: amountPaise,
                    currency: "INR",
                    receipt,
                    notes: {
                        user_id: userId,
                        plan: planSlug,
                        billing_cycle: billingCycle,
                        supabase_plan_id: selectedPlan.id
                    }
                })
            }
        );

        const order = await orderResponse.json().catch(() => ({}));
        if (!orderResponse.ok || !order?.id) {
            console.error("Razorpay order creation failed:", {
                status: orderResponse.status,
                code: order?.error?.code,
                description: order?.error?.description
            });
            return json({ error: "Razorpay could not create the payment order." }, 502);
        }

        /*
         * Create a dedicated pending subscription row for this order.
         * Do not change an existing active/trial row before money is captured.
         */
        const pendingSubscription = {
            user_id: userId,
            plan_id: selectedPlan.id,
            billing_cycle: billingCycle,
            status: "pending",
            provider: "razorpay",
            razorpay_order_id: order.id,
            payment_amount: amountRupees,
            currency: "INR",
            subscription_ends_at: currentPaidEnd,
            updated_at: now.toISOString()
        };

        const subscriptionResponse = await supabaseFetch(
            env,
            "/rest/v1/subscriptions",
            {
                method: "POST",
                headers: {
                    Prefer: "return=representation"
                },
                body: JSON.stringify(pendingSubscription)
            }
        );

        if (!subscriptionResponse.ok) {
            console.error(
                "Could not save the pending subscription:",
                await readResponseText(subscriptionResponse)
            );
            /* No checkout data is returned, so the customer cannot pay this orphaned order. */
            return json({ error: "Unable to prepare the subscription for payment. Please retry." }, 500);
        }

        return json({
            success: true,
            key_id: env.RAZORPAY_KEY_ID,
            order_id: order.id,
            amount: amountPaise,
            amount_rupees: amountRupees,
            currency: "INR",
            plan: planSlug,
            plan_name: selectedPlan.name,
            billing_cycle: billingCycle,
            customer: {
                name: user.user_metadata?.full_name || "",
                email: user.email || ""
            }
        });

    } catch (error) {
        console.error("Checkout error:", error?.message || error);
        return json({ error: "Unable to start checkout right now. Please try again." }, 500);
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
