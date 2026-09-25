import {
    client,
    adminClient,
    userFrom
} from "../_shared/auth.ts";

import {
    json,
    cors,
    optionsResponse
} from "../_shared/cors.ts";


Deno.serve(async (req) => {

    /* =====================================================
       CORS PREFLIGHT
    ===================================================== */

    if (req.method === "OPTIONS") {
        return optionsResponse();
    }


    /* =====================================================
       ONLY GET FOR NOW
    ===================================================== */

    if (req.method !== "GET") {

        return json(
            {
                error: "Method not allowed"
            },
            405
        );
    }


    /* =====================================================
       AUTHENTICATE USER
    ===================================================== */

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


    /* =====================================================
       ADMIN DATABASE CLIENT
    ===================================================== */

    let sb;

    try {

        sb =
            adminClient();

    } catch (error) {

        console.error(
            "Admin client error:",
            error
        );

        return json(
            {
                error:
                    "Admin server configuration error."
            },
            500
        );
    }


    /* =====================================================
       VERIFY ADMIN ROLE
    ===================================================== */

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
                    "Administrator profile not found.",
                user_id:
                    user.id
            },
            403
        );
    }


   if (profile.role !== "admin") {

    console.error(
        "Admin access denied:",
        {
            user_id: user.id,
            email: user.email,
            role: profile.role
        }
    );

    return json(
        {
            error: "Admin only",
            debug: {
                user_id: user.id,
                email: user.email || "",
                profile_role: profile.role || null
            }
        },
        403
    );
}


    /* =====================================================
       REQUEST PARAMETERS
    ===================================================== */

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

if (
    section ===
    "dashboard"
) {

    /* -------------------------------------------------
       ADMIN METRICS

       The requester has already been authenticated and
       verified as an administrator above.

       Use the service-role client here instead of calling
       admin_metrics(), because RPC calls can lose the
       browser JWT/auth.uid() context inside the Edge
       Function.
    ------------------------------------------------- */

    const [
        usersResult,
        websitesResult,
        subscriptionsResult,
        aiRunsResult,
        auditLogsResult
    ] = await Promise.all([

        /* USERS */
        adminDb
            .from("profiles")
            .select(
                "id, role",
                {
                    count: "exact",
                    head: false
                }
            ),

        /* WEBSITES */
        adminDb
            .from("websites")
            .select(
                "id",
                {
                    count: "exact",
                    head: true
                }
            ),

        /* SUBSCRIPTIONS */
        adminDb
            .from("subscriptions")
            .select(`
                id,
                plan_id,
                status,
                payment_amount,
                razorpay_payment_id
            `),

        /* AI RUNS */
        adminDb
            .from("ai_runs")
            .select(
                "id",
                {
                    count: "exact",
                    head: true
                }
            ),

        /* AUDIT LOGS */
        adminDb
            .from("audit_logs")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            )
            .limit(100)
    ]);


    /* -------------------------------------------------
       ERROR CHECKS
    ------------------------------------------------- */

    if (usersResult.error) {

        console.error(
            "Dashboard users metrics error:",
            usersResult.error
        );

        return json(
            {
                error:
                    "Unable to load dashboard users metrics.",
                details:
                    usersResult.error.message
            },
            500
        );
    }


    if (websitesResult.error) {

        console.error(
            "Dashboard websites metrics error:",
            websitesResult.error
        );

        return json(
            {
                error:
                    "Unable to load dashboard website metrics.",
                details:
                    websitesResult.error.message
            },
            500
        );
    }


    if (subscriptionsResult.error) {

        console.error(
            "Dashboard subscriptions metrics error:",
            subscriptionsResult.error
        );

        return json(
            {
                error:
                    "Unable to load dashboard subscription metrics.",
                details:
                    subscriptionsResult.error.message
            },
            500
        );
    }


    if (aiRunsResult.error) {

        console.error(
            "Dashboard AI metrics error:",
            aiRunsResult.error
        );

        return json(
            {
                error:
                    "Unable to load dashboard AI metrics.",
                details:
                    aiRunsResult.error.message
            },
            500
        );
    }


    if (auditLogsResult.error) {

        console.error(
            "Dashboard audit logs error:",
            auditLogsResult.error
        );

        return json(
            {
                error:
                    "Unable to load dashboard audit logs.",
                details:
                    auditLogsResult.error.message
            },
            500
        );
    }


    /* -------------------------------------------------
       USERS
    ------------------------------------------------- */

    const profiles =
        usersResult.data || [];


    const totalUsers =
        profiles.length;


    const totalAdmins =
        profiles.filter(
            profile =>
                profile.role ===
                "admin"
        ).length;


    /* -------------------------------------------------
       WEBSITES
    ------------------------------------------------- */

    const totalWebsites =
        websitesResult.count || 0;


    /* -------------------------------------------------
       SUBSCRIPTIONS
    ------------------------------------------------- */

    const subscriptions =
        subscriptionsResult.data || [];


    const totalSubscriptions =
        subscriptions.length;


    const activeSubscriptions =
        subscriptions.filter(
            subscription =>
                String(
                    subscription.status || ""
                ).toLowerCase() ===
                "active"
        ).length;


    const trialSubscriptions =
        subscriptions.filter(
            subscription =>
                String(
                    subscription.status || ""
                ).toLowerCase() ===
                "trial"
        ).length;


    const cancelledSubscriptions =
        subscriptions.filter(
            subscription =>
                String(
                    subscription.status || ""
                ).toLowerCase() ===
                "cancelled"
        ).length;


    const paidSubscriptions =
        subscriptions.filter(
            subscription => {

                const plan =
                    String(
                        subscription.plan_id || ""
                    ).toLowerCase();

                return (
                    plan !== "" &&
                    plan !== "free"
                );
            }
        ).length;


    /* -------------------------------------------------
       PAYMENTS
    ------------------------------------------------- */

    const paidRows =
        subscriptions.filter(
            subscription =>
                Boolean(
                    subscription.razorpay_payment_id
                )
        );


    const totalPayments =
        paidRows.length;


    const totalRevenue =
        paidRows.reduce(
            (
                total,
                subscription
            ) => {

                const amount =
                    Number(
                        subscription.payment_amount
                    ) || 0;

                return total + amount;

            },
            0
        );


    /* -------------------------------------------------
       AI RUNS
    ------------------------------------------------- */

    const totalAiRuns =
        aiRunsResult.count || 0;


    /* -------------------------------------------------
       METRICS OBJECT

       Keep simple key/value fields because the current
       admin.js dashboard automatically renders them.
    ------------------------------------------------- */

    const metrics = {

        total_users:
            totalUsers,

        total_admins:
            totalAdmins,

        total_websites:
            totalWebsites,

        total_subscriptions:
            totalSubscriptions,

        active_subscriptions:
            activeSubscriptions,

        trial_subscriptions:
            trialSubscriptions,

        cancelled_subscriptions:
            cancelledSubscriptions,

        paid_subscriptions:
            paidSubscriptions,

        total_ai_runs:
            totalAiRuns,

        total_payments:
            totalPayments,

        total_revenue:
            totalRevenue

    };


    /* -------------------------------------------------
       RETURN DASHBOARD
    ------------------------------------------------- */

    return json(
        {
            success: true,

            metrics,

            logs:
                auditLogsResult.data ||
                []
        }
    );
}

        /* =================================================
           WEBSITE COUNTS
        ================================================= */

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


        /* =================================================
           AI RUN COUNTS
        ================================================= */

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


        /* =================================================
           NEWEST SUBSCRIPTION PER USER
        ================================================= */

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


        /* =================================================
           AUTH USERS
        ================================================= */

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
                ] = authUser;
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


        /* =================================================
           COMBINE USER DATA
        ================================================= */

        let users =
            (profiles || [])
                .map((profile) => {

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
                            profile.full_name || "",

                        email:
                            authUser?.email || "",

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
                });


        /* =================================================
           SEARCH
        ================================================= */

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


        return json({

            success: true,

            users,

            total:
                users.length

        });
    }


    /* =====================================================
       UNKNOWN SECTION
    ===================================================== */

    return json(
        {
            error:
                "Unknown admin section.",
            section
        },
        400
    );

});