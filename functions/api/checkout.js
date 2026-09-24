export async function onRequestPost(context) {
    try {
        const request = context.request;
        const env = context.env;

        const authHeader =
            request.headers.get("Authorization") || "";

        if (!authHeader.startsWith("Bearer ")) {
            return json(
                {
                    error: "Unauthorized"
                },
                401
            );
        }

        const accessToken =
            authHeader.substring(7);

        if (!accessToken) {
            return json(
                {
                    error: "Unauthorized"
                },
                401
            );
        }

        const body = await request.json();

        const plan =
            String(body?.plan || "").toLowerCase();

        const billingCycle =
            String(
                body?.billing_cycle || "monthly"
            ).toLowerCase();

        if (
            !["growth", "scale"].includes(plan)
        ) {
            return json(
                {
                    error: "Invalid plan."
                },
                400
            );
        }

        if (
            !["monthly", "yearly"].includes(
                billingCycle
            )
        ) {
            return json(
                {
                    error: "Invalid billing cycle."
                },
                400
            );
        }

        if (
            !env.SUPABASE_URL ||
            !env.SUPABASE_PUBLISHABLE_KEY
        ) {
            return json(
                {
                    error:
                        "Supabase configuration is missing."
                },
                500
            );
        }

        if (
            !env.RAZORPAY_KEY_ID ||
            !env.RAZORPAY_KEY_SECRET
        ) {
            return json(
                {
                    error:
                        "Razorpay is not configured."
                },
                500
            );
        }

        /*
         * ------------------------------------------
         * Validate Supabase user
         * ------------------------------------------
         */

        const userResponse =
            await fetch(
                `${env.SUPABASE_URL}/auth/v1/user`,
                {
                    method: "GET",
                    headers: {
                        apikey:
                            env.SUPABASE_PUBLISHABLE_KEY,
                        Authorization:
                            `Bearer ${accessToken}`
                    }
                }
            );

        if (!userResponse.ok) {
            return json(
                {
                    error:
                        "Invalid or expired login session."
                },
                401
            );
        }

        const user =
            await userResponse.json();

        const userId = user?.id;

        if (!userId) {
            return json(
                {
                    error: "User not found."
                },
                401
            );
        }

        /*
         * ------------------------------------------
         * Price configuration
         * ------------------------------------------
         */

        const prices = {
            growth: {
                monthly: 99,
                yearly: 1050
            },

            scale: {
                monthly: 200,
                yearly: 1990
            }
        };

        const amount =
            prices[plan][billingCycle];

        const amountPaise =
            amount * 100;

        /*
         * ------------------------------------------
         * Get plan from database
         * ------------------------------------------
         */

        const planResponse =
            await supabaseFetch(
                env,
                `/rest/v1/plans?name=eq.${encodeURIComponent(
                    capitalize(plan)
                )}&select=id,name,price_monthly_inr,price_yearly_inr,max_websites,term_days`
            );

        if (!planResponse.ok) {
            return json(
                {
                    error:
                        "Could not load subscription plan."
                },
                500
            );
        }

        const plans =
            await planResponse.json();

        const selectedPlan =
            plans?.[0];

        if (!selectedPlan) {
            return json(
                {
                    error:
                        "Subscription plan not found."
                },
                400
            );
        }

        /*
         * ------------------------------------------
         * Verify price against DB
         * ------------------------------------------
         */

        const dbAmount =
            billingCycle === "yearly"
                ? Number(
                    selectedPlan.price_yearly_inr
                )
                : Number(
                    selectedPlan.price_monthly_inr
                );

        if (
            Number(dbAmount) !==
            Number(amount)
        ) {
            return json(
                {
                    error:
                        "Plan price configuration mismatch."
                },
                500
            );
        }

        /*
         * ------------------------------------------
         * Create Razorpay Order
         * ------------------------------------------
         */

        const razorpayAuth =
            btoa(
                `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`
            );

        const receipt =
            `obs_${userId.substring(0, 8)}_${Date.now()}`;

        const orderResponse =
            await fetch(
                "https://api.razorpay.com/v1/orders",
                {
                    method: "POST",

                    headers: {
                        Authorization:
                            `Basic ${razorpayAuth}`,

                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        amount:
                            amountPaise,

                        currency:
                            "INR",

                        receipt,

                        notes: {
                            user_id:
                                userId,

                            plan:
                                plan,

                            billing_cycle:
                                billingCycle,

                            supabase_plan_id:
                                selectedPlan.id
                        }
                    })
                }
            );

        const order =
            await orderResponse.json();

        if (
            !orderResponse.ok ||
            !order?.id
        ) {
            console.error(
                "Razorpay order error:",
                order
            );

            return json(
                {
                    error:
                        "Unable to create Razorpay order."
                },
                502
            );
        }

        /*
         * ------------------------------------------
         * Store pending payment information
         * ------------------------------------------
         */

        const existingSubResponse =
            await supabaseFetch(
                env,
                `/rest/v1/subscriptions?user_id=eq.${userId}&select=id&order=created_at.desc&limit=1`
            );

        const existingSubs =
            existingSubResponse.ok
                ? await existingSubResponse.json()
                : [];

        if (
            existingSubs?.length
        ) {
            await supabaseFetch(
                env,
                `/rest/v1/subscriptions?id=eq.${existingSubs[0].id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Prefer":
                            "return=minimal"
                    },
                    body: JSON.stringify({
                        plan_id:
                            selectedPlan.id,

                        billing_cycle:
                            billingCycle,

                        razorpay_order_id:
                            order.id,

                        payment_amount:
                            amount,

                        currency:
                            "INR",

                        status:
                            "pending"
                    })
                }
            );
        }

        /*
         * ------------------------------------------
         * Return Checkout data
         * ------------------------------------------
         */

        return json({
            success: true,

            key_id:
                env.RAZORPAY_KEY_ID,

            order_id:
                order.id,

            amount:
                amountPaise,

            currency:
                "INR",

            plan,

            billing_cycle:
                billingCycle,

            customer: {
                email:
                    user.email || ""
            }
        });

    } catch (error) {
        console.error(
            "Checkout error:",
            error
        );

        return json(
            {
                error:
                    error?.message ||
                    "Checkout failed."
            },
            500
        );
    }
}


/* =========================================
   Helpers
========================================= */

async function supabaseFetch(
    env,
    path,
    options = {}
) {
    return fetch(
        `${env.SUPABASE_URL}${path}`,
        {
            ...options,

            headers: {
                apikey:
                    env.SUPABASE_SERVICE_ROLE_KEY,

                Authorization:
                    `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,

                "Content-Type":
                    "application/json",

                ...(options.headers || {})
            }
        }
    );
}


function capitalize(value) {
    return (
        value.charAt(0).toUpperCase() +
        value.slice(1)
    );
}


function json(data, status = 200) {
    return new Response(
        JSON.stringify(data),
        {
            status,

            headers: {
                "Content-Type":
                    "application/json",

                "Cache-Control":
                    "no-store"
            }
        }
    );
}