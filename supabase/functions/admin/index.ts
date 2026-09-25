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
       REQUEST METHOD
    ===================================================== */

    if (!["GET", "POST"].includes(req.method)) {
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
       SETTINGS WRITE
    ===================================================== */

    if (req.method === "POST") {

        if (section !== "settings") {
            return json(
                {
                    error: "POST is only supported for settings."
                },
                405
            );
        }

        let body: any;

        try {
            body = await req.json();
        } catch (_error) {
            return json(
                {
                    error: "Invalid JSON request body."
                },
                400
            );
        }

        if (body?.action !== "update_branding") {
            return json(
                {
                    error: "Unsupported settings action."
                },
                400
            );
        }

        const incoming =
            body?.branding &&
            typeof body.branding === "object"
                ? body.branding
                : {};

        const {
            data: existingSetting,
            error: existingError
        } = await sb
            .from("settings")
            .select("value")
            .eq("key", "branding")
            .maybeSingle();

        if (existingError) {
            return json(
                {
                    error: "Unable to read current branding settings.",
                    details: existingError.message
                },
                500
            );
        }

        const existing =
            existingSetting?.value &&
            typeof existingSetting.value === "object"
                ? existingSetting.value
                : {};

        const branding = {
            ...existing,
            brand_name:
                String(incoming.brand_name ?? existing.brand_name ?? "Obsedian.Space")
                    .trim()
                    .slice(0, 120),
            logo_url:
                String(incoming.logo_url ?? existing.logo_url ?? "")
                    .trim()
                    .slice(0, 2000),
            primary_color:
                String(incoming.primary_color ?? existing.primary_color ?? "#7c3aed")
                    .trim(),
            accent_color:
                String(incoming.accent_color ?? existing.accent_color ?? "#f59e0b")
                    .trim(),
            support_email:
                String(incoming.support_email ?? existing.support_email ?? "")
                    .trim()
                    .slice(0, 320)
        };

        const hexColor = /^#[0-9a-fA-F]{6}$/;

        if (!hexColor.test(branding.primary_color)) {
            return json(
                { error: "Primary color must be a valid 6-digit hex color." },
                400
            );
        }

        if (!hexColor.test(branding.accent_color)) {
            return json(
                { error: "Accent color must be a valid 6-digit hex color." },
                400
            );
        }

        if (branding.support_email &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(branding.support_email)) {
            return json(
                { error: "Please enter a valid support email address." },
                400
            );
        }

        /* -----------------------------------------------------
           Optional logo upload
        ----------------------------------------------------- */

        const logoDataUrl =
            typeof body?.logo_data_url === "string"
                ? body.logo_data_url
                : "";

        if (logoDataUrl) {

            const match = logoDataUrl.match(
                /^data:(image\/(?:png|jpeg|jpg|webp|svg\+xml));base64,(.+)$/i
            );

            if (!match) {
                return json(
                    {
                        error:
                            "Unsupported logo format. Use PNG, JPG, WEBP or SVG."
                    },
                    400
                );
            }

            const contentType = match[1].toLowerCase();
            const base64 = match[2];

            let binary: Uint8Array;

            try {
                const decoded = atob(base64);
                binary = new Uint8Array(decoded.length);

                for (let i = 0; i < decoded.length; i++) {
                    binary[i] = decoded.charCodeAt(i);
                }
            } catch (_error) {
                return json(
                    { error: "Unable to decode the uploaded logo." },
                    400
                );
            }

            if (binary.byteLength > 3 * 1024 * 1024) {
                return json(
                    { error: "Logo must be 3 MB or smaller." },
                    400
                );
            }

            const extension =
                contentType === "image/svg+xml"
                    ? "svg"
                    : contentType === "image/jpeg" || contentType === "image/jpg"
                        ? "jpg"
                        : contentType.split("/")[1];

            const path =
                `logos/${crypto.randomUUID()}.${extension}`;

            /* Ensure the public branding bucket exists. */
            try {
                const { data: existingBucket } =
                    await sb.storage.getBucket("branding");

                if (!existingBucket) {
                    await sb.storage.createBucket(
                        "branding",
                        { public: true }
                    );
                }
            } catch (bucketError) {
                console.warn(
                    "Branding bucket check/create warning:",
                    bucketError
                );
            }

            const storage =
                sb.storage.from("branding");

            const { error: uploadError } =
                await storage.upload(
                    path,
                    binary,
                    {
                        contentType,
                        upsert: true,
                        cacheControl: "3600"
                    }
                );

            if (uploadError) {
                console.error(
                    "Branding logo upload error:",
                    uploadError
                );

                return json(
                    {
                        error:
                            "Unable to upload the logo. Make sure the Supabase Storage bucket 'branding' exists and is public.",
                        details:
                            uploadError.message
                    },
                    500
                );
            }

            const {
                data: publicUrlData
            } = storage.getPublicUrl(path);

            branding.logo_url =
                publicUrlData.publicUrl;
        }

        const {
            data: saved,
            error: saveError
        } = await sb
            .from("settings")
            .upsert(
                {
                    key: "branding",
                    value: branding,
                    updated_at: new Date().toISOString()
                },
                {
                    onConflict: "key"
                }
            )
            .select("key,value,updated_at")
            .single();

        if (saveError) {
            console.error(
                "Branding save error:",
                saveError
            );

            return json(
                {
                    error: "Unable to save branding settings.",
                    details: saveError.message
                },
                500
            );
        }

        return json(
            {
                success: true,
                section: "settings",
                message: "Branding settings saved successfully.",
                setting: saved
            }
        );
    }


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
            .select("key,value,updated_at")
            .order(
                "key",
                {
                    ascending: true
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