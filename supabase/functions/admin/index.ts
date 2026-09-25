```ts
import {
    client,
    adminClient,
    userFrom
} from "../_shared/auth.ts";

import {
    json,
    cors
} from "../_shared/cors.ts";


/* =========================================================
   ADMIN EDGE FUNCTION
========================================================= */

Deno.serve(async (req) => {

    /*
     * -----------------------------------------------------
     * CORS PREFLIGHT
     * -----------------------------------------------------
     */

    if (req.method === "OPTIONS") {

        return new Response(
            "ok",
            {
                status: 200,
                headers: cors
            }
        );
    }


    /*
     * -----------------------------------------------------
     * ONLY GET
     * -----------------------------------------------------
     */

    if (req.method !== "GET") {

        return json(
            {
                error: "Method not allowed"
            },
            405
        );
    }


    /*
     * -----------------------------------------------------
     * AUTHENTICATED USER
     * -----------------------------------------------------
     */

    const user =
        await userFrom(req);

    if (!user) {

        return json(
            {
                error: "Unauthorized"
            },
            401
        );
    }


    /*
     * -----------------------------------------------------
     * PRIVILEGED SERVER CLIENT
     * -----------------------------------------------------
     *
     * This client is ONLY inside the Edge Function.
     */

    let sb;

    try {

        sb =
            adminClient();

    } catch (error) {

        console.error(
            "Admin client initialization failed:",
            error
        );

        return json(
            {
                error:
                    "Admin server configuration is incomplete."
            },
            500
        );
    }


    /*
     * -----------------------------------------------------
     * VERIFY ADMIN ROLE
     * -----------------------------------------------------
     */

    const {
        data: profile,
        error: profileError
    } =
        await sb
            .from("profiles")
            .select(`
                id,
                full_name,
                phone,
                avatar_url,
                role,
                timezone,
                created_at,
                updated_at
            `)
            .eq("id", user.id)
            .maybeSingle();


    if (profileError) {

        console.error(
            "Admin profile lookup failed:",
            profileError
        );

        return json(
            {
                error:
                    "Unable to verify administrator account."
            },
            500
        );
    }


    if (!profile) {

        return json(
            {
                error:
                    "Administrator profile not found."
            },
            403
        );
    }


    if (profile.role !== "admin") {

        return json(
            {
                error:
                    "Admin only"
            },
            403
        );
    }


    /*
     * -----------------------------------------------------
     * QUERY PARAMETERS
     * -----------------------------------------------------
     */

    const url =
        new URL(req.url);

    const section =
        url.searchParams.get(
            "section"
        ) || "dashboard";

    const search =
        (
            url.searchParams.get(
                "search"
            ) || ""
        )
            .trim()
            .toLowerCase();


    /* =====================================================
       DASHBOARD
    ===================================================== */

    if (section === "dashboard") {

        const {
            data: metrics,
            error: metricsError
        } =
            await sb.rpc(
                "admin_metrics"
            );


        if (metricsError) {

            console.error(
                "Admin metrics error:",
                metricsError
            );

            return json(
                {
                    error:
                        "Unable to load admin metrics.",
                    details:
                        metricsError.message
                },
                500
            );
        }


        const {
            data: logs,
            error: logsError
        } =
            await sb
                .from("audit_logs")
                .select("*")
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                )
                .limit(100);


        if (logsError) {

            console.error(
                "Audit log error:",
                logsError
            );
        }


        return json(
            {
                success: true,
                section: "dashboard",
                metrics:
                    metrics || {},
                logs:
                    logs || []
            }
        );
    }


    /* =====================================================
       USERS
    ===================================================== */

    if (section === "users") {

        /*
         * -------------------------------------------------
         * PROFILES
         * -------------------------------------------------
         */

        const {
            data: profiles,
            error: profilesError
        } =
            await sb
                .from("profiles")
                .select(`
                    id,
                    full_name,
                    phone,
                    avatar_url,
                    role,
                    timezone,
                    created_at,
                    updated_at
                `)
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (profilesError) {

            console.error(
                "Profiles error:",
                profilesError
            );

            return json(
                {
                    error:
                        "Unable to load users."
                },
                500
            );
        }


        /*
         * -------------------------------------------------
         * SUBSCRIPTIONS
         * -------------------------------------------------
         */

        const {
            data: subscriptions,
            error: subscriptionsError
        } =
            await sb
                .from("subscriptions")
                .select(`
                    user_id,
                    plan_id,
                    billing_cycle,
                    status,
                    subscription_ends_at,
                    started_at,
                    created_at,
                    razorpay_order_id,
                    razorpay_payment_id,
                    payment_amount,
                    currency,
                    last_payment_at
                `);


        if (subscriptionsError) {

            console.error(
                "Subscriptions error:",
                subscriptionsError
            );

            return json(
                {
                    error:
                        "Unable to load subscriptions."
                },
                500
            );
        }


        /*
         * -------------------------------------------------
         * WEBSITES
         * -------------------------------------------------
         */

        const {
            data: websites,
            error: websitesError
        } =
            await sb
                .from("websites")
                .select(`
                    id,
                    user_id,
                    name,
                    url,
                    status,
                    created_at,
                    last_crawled_at
                `);


        if (websitesError) {

            console.error(
                "Websites error:",
                websitesError
            );

            return json(
                {
                    error:
                        "Unable to load websites."
                },
                500
            );
        }


        /*
         * -------------------------------------------------
         * AI RUNS
         * -------------------------------------------------
         */

        const {
            data: aiRuns,
            error: aiRunsError
        } =
            await sb
                .from("ai_runs")
                .select(`
                    user_id,
                    status,
                    created_at
                `);


        if (aiRunsError) {

            console.error(
                "AI runs error:",
                aiRunsError
            );

            return json(
                {
                    error:
                        "Unable to load AI statistics."
                },
                500
            );
        }


        /*
         * -------------------------------------------------
         * WEBSITE COUNTS
         * -------------------------------------------------
         */

        const websiteCounts:
            Record<string, number> = {};


        for (
            const website
            of websites || []
        ) {

            if (!website.user_id) {
                continue;
            }

            websiteCounts[
                website.user_id
            ] =
                (
                    websiteCounts[
                        website.user_id
                    ] || 0
                ) + 1;
        }


        /*
         * -------------------------------------------------
         * AI RUN COUNTS
         * -------------------------------------------------
         */

        const aiRunCounts:
            Record<string, number> = {};


        for (
            const run
            of aiRuns || []
        ) {

            if (!run.user_id) {
                continue;
            }

            aiRunCounts[
                run.user_id
            ] =
                (
                    aiRunCounts[
                        run.user_id
                    ] || 0
                ) + 1;
        }


        /*
         * -------------------------------------------------
         * NEWEST SUBSCRIPTION PER USER
         * -------------------------------------------------
         */

        const subscriptionMap:
            Record<string, any> = {};


        for (
            const sub
            of subscriptions || []
        ) {

            if (!sub.user_id) {
                continue;
            }

            const existing =
                subscriptionMap[
                    sub.user_id
                ];


            if (
                !existing ||
                new Date(
                    sub.created_at || 0
                ) >
                new Date(
                    existing.created_at || 0
                )
            ) {

                subscriptionMap[
                    sub.user_id
                ] = sub;
            }
        }


        /*
         * -------------------------------------------------
         * SUPABASE AUTH USERS
         * -------------------------------------------------
         *
         * IMPORTANT:
         * adminClient() is required here.
         */

        const authUsers:
            Record<string, any> = {};


        let authPage = 1;

        const authPerPage = 1000;


        while (true) {

            const {
                data: authResult,
                error: authError
            } =
                await sb.auth.admin.listUsers({
                    page:
                        authPage,
                    perPage:
                        authPerPage
                });


            if (authError) {

                console.error(
                    "Auth users error:",
                    authError
                );

                return json(
                    {
                        error:
                            "Unable to load authentication users.",
                        details:
                            authError.message
                    },
                    500
                );
            }


            for (
                const authUser
                of authResult.users || []
            ) {

                authUsers[
                    authUser.id
                ] =
                    authUser;
            }


            if (
                !authResult.users ||
                authResult.users.length <
                    authPerPage
            ) {

                break;
            }


            authPage++;
        }


        /*
         * -------------------------------------------------
         * COMBINE DATA
         * -------------------------------------------------
         */

        let users =
            (profiles || []).map(
                (profile) => {

                    const subscription =
                        subscriptionMap[
                            profile.id
                        ] || null;


                    const authUser =
                        authUsers[
                            profile.id
                        ] || null;


                    return {

                        id:
                            profile.id,

                        full_name:
                            profile.full_name ||
                            "",

                        email:
                            authUser?.email ||
                            "",

                        phone:
                            profile.phone ||
                            authUser?.phone ||
                            "",

                        role:
                            profile.role ||
                            "user",

                        timezone:
                            profile.timezone ||
                            "",

                        plan_id:
                            subscription?.plan_id ||
                            "free",

                        billing_cycle:
                            subscription?.billing_cycle ||
                            "free",

                        subscription_status:
                            subscription?.status ||
                            "none",

                        subscription_ends_at:
                            subscription?.subscription_ends_at ||
                            null,

                        started_at:
                            subscription?.started_at ||
                            null,

                        razorpay_order_id:
                            subscription?.razorpay_order_id ||
                            null,

                        razorpay_payment_id:
                            subscription?.razorpay_payment_id ||
                            null,

                        payment_amount:
                            subscription?.payment_amount ||
                            null,

                        currency:
                            subscription?.currency ||
                            "INR",

                        last_payment_at:
                            subscription?.last_payment_at ||
                            null,

                        websites:
                            websiteCounts[
                                profile.id
                            ] || 0,

                        ai_runs:
                            aiRunCounts[
                                profile.id
                            ] || 0,

                        created_at:
                            profile.created_at,

                        updated_at:
                            profile.updated_at
                    };
                }
            );


        /*
         * -------------------------------------------------
         * SEARCH
         * -------------------------------------------------
         */

        if (search) {

            users =
                users.filter(
                    (user) => {

                        const haystack = [

                            user.id,

                            user.full_name,

                            user.email,

                            user.phone,

                            user.role,

                            user.plan_id,

                            user.subscription_status

                        ]
                            .filter(Boolean)
                            .join(" ")
                            .toLowerCase();


                        return haystack.includes(
                            search
                        );
                    }
                );
        }


        return json(
            {
                success: true,
                section: "users",
                users,
                total:
                    users.length
            }
        );
    }


    /* =====================================================
       UNKNOWN SECTION
    ===================================================== */

    return json(
        {
            error:
                "Unknown admin section."
        },
        400
    );

});
```
