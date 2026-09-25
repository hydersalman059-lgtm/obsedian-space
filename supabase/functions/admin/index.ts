import {
    adminClient,
    userFrom
} from "../_shared/auth.ts";

import {
    json,
    cors
} from "../_shared/cors.ts";


/* =========================================================
   OBSEDIAN.SPACE
   ADMIN EDGE FUNCTION
========================================================= */

Deno.serve(async (req) => {

    /* =====================================================
       CORS
    ===================================================== */

    if (req.method === "OPTIONS") {
        return new Response(
            "ok",
            {
                status: 200,
                headers: cors
            }
        );
    }


    /* =====================================================
       GET ONLY
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
       AUTHENTICATED USER
    ===================================================== */

    const user = await userFrom(req);

    if (!user) {
        return json(
            {
                error: "Unauthorized"
            },
            401
        );
    }


    /* =====================================================
       SERVICE ROLE CLIENT
    ===================================================== */

    let sb;

    try {

        sb = adminClient();

    } catch (error) {

        console.error(
            "Admin client error:",
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


    /* =====================================================
       VERIFY ADMIN
    ===================================================== */

    const {
        data: profile,
        error: profileError
    } = await sb
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
        .eq(
            "id",
            user.id
        )
        .maybeSingle();


    if (profileError) {

        console.error(
            "Admin profile error:",
            profileError
        );

        return json(
            {
                error:
                    "Unable to verify administrator account.",
                details:
                    profileError.message
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
                error: "Admin only"
            },
            403
        );
    }


    /* =====================================================
       PARAMETERS
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

    if (section === "dashboard") {

        const [
            usersResult,
            websitesResult,
            subscriptionsResult,
            aiRunsResult,
            approvalsResult,
            adsResult,
            supportResult,
            auditResult
        ] = await Promise.all([

            sb
                .from("profiles")
                .select(
                    "id,role",
                    {
                        count: "exact",
                        head: false
                    }
                ),

            sb
                .from("websites")
                .select(
                    "id",
                    {
                        count: "exact",
                        head: true
                    }
                ),

            sb
                .from("subscriptions")
                .select(
                    "id,plan_id,status,payment_amount,razorpay_payment_id"
                ),

            sb
                .from("ai_runs")
                .select(
                    "id",
                    {
                        count: "exact",
                        head: true
                    }
                ),

            sb
                .from("approvals")
                .select(
                    "id",
                    {
                        count: "exact",
                        head: true
                    }
                )
                .eq(
                    "status",
                    "pending"
                ),

            sb
                .from("ad_campaigns")
                .select(
                    "id",
                    {
                        count: "exact",
                        head: true
                    }
                ),

            sb
                .from("support_tickets")
                .select(
                    "id",
                    {
                        count: "exact",
                        head: true
                    }
                ),

            sb
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


        if (usersResult.error) {
            return json(
                {
                    error:
                        "Unable to load dashboard users.",
                    details:
                        usersResult.error.message
                },
                500
            );
        }


        if (websitesResult.error) {
            return json(
                {
                    error:
                        "Unable to load dashboard websites.",
                    details:
                        websitesResult.error.message
                },
                500
            );
        }


        if (subscriptionsResult.error) {
            return json(
                {
                    error:
                        "Unable to load dashboard subscriptions.",
                    details:
                        subscriptionsResult.error.message
                },
                500
            );
        }


        if (aiRunsResult.error) {
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


        const users =
            usersResult.data || [];

        const subscriptions =
            subscriptionsResult.data || [];


        const activeSubscriptions =
            subscriptions.filter(
                s =>
                    String(
                        s.status || ""
                    ).toLowerCase() ===
                    "active"
            ).length;


        const trialSubscriptions =
            subscriptions.filter(
                s =>
                    String(
                        s.status || ""
                    ).toLowerCase() ===
                    "trial"
            ).length;


        const paidSubscriptions =
            subscriptions.filter(
                s =>
                    String(
                        s.plan_id || ""
                    ).toLowerCase() !==
                    "free"
            ).length;


        const payments =
            subscriptions.filter(
                s =>
                    Boolean(
                        s.razorpay_payment_id
                    )
            );


        const revenue =
            payments.reduce(
                (
                    total,
                    payment
                ) =>
                    total +
                    (
                        Number(
                            payment.payment_amount
                        ) || 0
                    ),
                0
            );


        return json(
            {
                success: true,

                section:
                    "dashboard",

                metrics: {

                    total_users:
                        users.length,

                    total_admins:
                        users.filter(
                            u =>
                                u.role ===
                                "admin"
                        ).length,

                    total_websites:
                        websitesResult.count ||
                        0,

                    total_subscriptions:
                        subscriptions.length,

                    active_subscriptions:
                        activeSubscriptions,

                    trial_subscriptions:
                        trialSubscriptions,

                    paid_subscriptions:
                        paidSubscriptions,

                    total_payments:
                        payments.length,

                    total_revenue:
                        revenue,

                    total_ai_runs:
                        aiRunsResult.count ||
                        0,

                    pending_approvals:
                        approvalsResult.count ||
                        0,

                    ad_campaigns:
                        adsResult.count ||
                        0,

                    support_tickets:
                        supportResult.count ||
                        0
                },

                logs:
                    auditResult.data ||
                    []
            }
        );
    }


    /* =====================================================
       USERS
    ===================================================== */

    if (section === "users") {

        const {
            data: profiles,
            error: profilesError
        } = await sb
            .from("profiles")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (profilesError) {

            return json(
                {
                    error:
                        "Unable to load users.",
                    details:
                        profilesError.message
                },
                500
            );
        }


        const {
            data: subscriptions,
            error: subscriptionsError
        } = await sb
            .from("subscriptions")
            .select("*");


        if (subscriptionsError) {

            return json(
                {
                    error:
                        "Unable to load subscriptions.",
                    details:
                        subscriptionsError.message
                },
                500
            );
        }


        const {
            data: websites
        } = await sb
            .from("websites")
            .select(
                "user_id"
            );


        const {
            data: aiRuns
        } = await sb
            .from("ai_runs")
            .select(
                "user_id"
            );


        const websiteCounts: Record<
            string,
            number
        > = {};


        const aiCounts: Record<
            string,
            number
        > = {};


        for (
            const website of websites || []
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


        for (
            const run of aiRuns || []
        ) {

            if (!run.user_id) {
                continue;
            }

            aiCounts[
                run.user_id
            ] =
                (
                    aiCounts[
                        run.user_id
                    ] || 0
                ) + 1;
        }


        const subscriptionMap:
            Record<string, any> = {};


        for (
            const sub of subscriptions || []
        ) {

            if (!sub.user_id) {
                continue;
            }

            const old =
                subscriptionMap[
                    sub.user_id
                ];


            if (
                !old ||
                new Date(
                    sub.created_at || 0
                ) >
                new Date(
                    old.created_at || 0
                )
            ) {

                subscriptionMap[
                    sub.user_id
                ] = sub;
            }
        }


        const authUsers:
            Record<string, any> = {};


        let page = 1;


        while (true) {

            const {
                data,
                error
            } =
                await sb.auth.admin.listUsers(
                    {
                        page,
                        perPage: 1000
                    }
                );


            if (error) {

                return json(
                    {
                        error:
                            "Unable to load authentication users.",
                        details:
                            error.message
                    },
                    500
                );
            }


            for (
                const authUser
                of data.users || []
            ) {

                authUsers[
                    authUser.id
                ] = authUser;
            }


            if (
                !data.users ||
                data.users.length <
                    1000
            ) {
                break;
            }


            page++;
        }


        let users =
            (
                profiles || []
            ).map(
                profile => {

                    const sub =
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
                            sub?.plan_id ||
                            "free",

                        billing_cycle:
                            sub?.billing_cycle ||
                            "free",

                        subscription_status:
                            sub?.status ||
                            "none",

                        subscription_ends_at:
                            sub?.subscription_ends_at ||
                            null,

                        started_at:
                            sub?.started_at ||
                            null,

                        websites:
                            websiteCounts[
                                profile.id
                            ] || 0,

                        ai_runs:
                            aiCounts[
                                profile.id
                            ] || 0,

                        created_at:
                            profile.created_at,

                        updated_at:
                            profile.updated_at
                    };
                }
            );


        if (search) {

            users =
                users.filter(
                    user => {

                        const value = [

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


                        return value.includes(
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
       SUBSCRIPTIONS
    ===================================================== */

    if (
        section ===
        "subscriptions"
    ) {

        const {
            data,
            error
        } = await sb
            .from("subscriptions")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (error) {

            return json(
                {
                    error:
                        "Unable to load subscriptions.",
                    details:
                        error.message
                },
                500
            );
        }


        return json(
            {
                success: true,
                section,
                subscriptions:
                    data || []
            }
        );
    }


    /* =====================================================
       PAYMENTS
    ===================================================== */

    if (
        section ===
        "payments"
    ) {

        const {
            data,
            error
        } = await sb
            .from("subscriptions")
            .select(`
                id,
                user_id,
                plan_id,
                billing_cycle,
                status,
                razorpay_order_id,
                razorpay_payment_id,
                payment_amount,
                currency,
                last_payment_at,
                created_at,
                updated_at
            `)
            .not(
                "razorpay_payment_id",
                "is",
                null
            )
            .order(
                "last_payment_at",
                {
                    ascending: false
                }
            );


        if (error) {

            return json(
                {
                    error:
                        "Unable to load payments.",
                    details:
                        error.message
                },
                500
            );
        }


        return json(
            {
                success: true,
                section,
                payments:
                    data || []
            }
        );
    }


    /* =====================================================
       AI OPERATIONS
    ===================================================== */

    if (
        section ===
        "ai"
    ) {

        const {
            data,
            error
        } = await sb
            .from("ai_runs")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            )
            .limit(500);


        if (error) {

            return json(
                {
                    error:
                        "Unable to load AI operations.",
                    details:
                        error.message
                },
                500
            );
        }


        return json(
            {
                success: true,
                section,
                ai_runs:
                    data || []
            }
        );
    }


    /* =====================================================
       WEBSITES
    ===================================================== */

    if (
        section ===
        "websites"
    ) {

        const {
            data,
            error
        } = await sb
            .from("websites")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (error) {

            return json(
                {
                    error:
                        "Unable to load websites.",
                    details:
                        error.message
                },
                500
            );
        }


        return json(
            {
                success: true,
                section,
                websites:
                    data || []
            }
        );
    }


    /* =====================================================
       APPROVALS
    ===================================================== */

    if (
        section ===
        "approvals"
    ) {

        const {
            data,
            error
        } = await sb
            .from("approvals")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (error) {

            return json(
                {
                    error:
                        "Unable to load approvals.",
                    details:
                        error.message
                },
                500
            );
        }


        return json(
            {
                success: true,
                section,
                approvals:
                    data || []
            }
        );
    }


    /* =====================================================
       SUPPORT
    ===================================================== */

    if (
        section ===
        "support"
    ) {

        const {
            data,
            error
        } = await sb
            .from("support_tickets")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (error) {

            return json(
                {
                    error:
                        "Unable to load support tickets.",
                    details:
                        error.message
                },
                500
            );
        }


        return json(
            {
                success: true,
                section,
                tickets:
                    data || []
            }
        );
    }


    /* =====================================================
       AUDIT LOGS
    ===================================================== */

    if (
        section ===
        "audit"
    ) {

        const {
            data,
            error
        } = await sb
            .from("audit_logs")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            )
            .limit(500);


        if (error) {

            return json(
                {
                    error:
                        "Unable to load audit logs.",
                    details:
                        error.message
                },
                500
            );
        }


        return json(
            {
                success: true,
                section,
                logs:
                    data || []
            }
        );
    }


    /* =====================================================
       SETTINGS
    ===================================================== */

    if (
        section ===
        "settings"
    ) {

        const {
            data,
            error
        } = await sb
            .from("settings")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (error) {

            return json(
                {
                    error:
                        "Unable to load settings.",
                    details:
                        error.message
                },
                500
            );
        }


        return json(
            {
                success: true,
                section,
                settings:
                    data || []
            }
        );
    }


    /* =====================================================
       UNKNOWN
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