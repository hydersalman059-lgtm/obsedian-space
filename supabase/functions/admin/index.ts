import { client, userFrom } from "../_shared/auth.ts";
import { json, cors } from "../_shared/cors.ts";

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: cors });
    }

    if (req.method !== "GET") {
        return json({ error: "Method not allowed" }, 405);
    }

    const u = await userFrom(req);

    if (!u) {
        return json({ error: "Unauthorized" }, 401);
    }

    const sb = client();

    const { data: profile, error: profileError } = await sb
        .from("profiles")
        .select("id, full_name, phone, avatar_url, role, timezone, created_at, updated_at")
        .eq("id", u.id)
        .single();

    if (profileError || profile?.role !== "admin") {
        return json({ error: "Admin only" }, 403);
    }

    const url = new URL(req.url);
    const section = url.searchParams.get("section") || "dashboard";
    const search = (url.searchParams.get("search") || "").trim().toLowerCase();

    /*
     * ----------------------------------------------------
     * DASHBOARD
     * ----------------------------------------------------
     */

    if (section === "dashboard") {
        const { data: metrics, error: metricsError } =
            await sb.rpc("admin_metrics");

        if (metricsError) {
            console.error(metricsError);

            return json({
                error: "Unable to load admin metrics."
            }, 500);
        }

        const { data: logs, error: logsError } = await sb
            .from("audit_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(100);

        if (logsError) {
            console.error(logsError);
        }

        return json({
            metrics: metrics || {},
            logs: logs || []
        });
    }

    /*
     * ----------------------------------------------------
     * USERS
     * ----------------------------------------------------
     */

    if (section === "users") {

        /*
         * Get profiles
         */

        const { data: profiles, error: profilesError } = await sb
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
            .order("created_at", { ascending: false });

        if (profilesError) {
            console.error(profilesError);

            return json({
                error: "Unable to load users."
            }, 500);
        }

        /*
         * Get subscriptions
         */

        const { data: subscriptions, error: subscriptionsError } =
            await sb
                .from("subscriptions")
                .select(`
                    user_id,
                    plan_id,
                    billing_cycle,
                    status,
                    subscription_ends_at,
                    started_at,
                    created_at
                `);

        if (subscriptionsError) {
            console.error(subscriptionsError);

            return json({
                error: "Unable to load subscriptions."
            }, 500);
        }

        /*
         * Get websites
         */

        const { data: websites, error: websitesError } =
            await sb
                .from("websites")
                .select("user_id");

        if (websitesError) {
            console.error(websitesError);

            return json({
                error: "Unable to load website statistics."
            }, 500);
        }

        /*
         * Get AI runs
         */

        const { data: aiRuns, error: aiRunsError } =
            await sb
                .from("ai_runs")
                .select("user_id");

        if (aiRunsError) {
            console.error(aiRunsError);

            return json({
                error: "Unable to load AI statistics."
            }, 500);
        }

        /*
         * Build counts
         */

        const websiteCounts: Record<string, number> = {};
        const aiRunCounts: Record<string, number> = {};

        for (const website of websites || []) {
            if (!website.user_id) continue;

            websiteCounts[website.user_id] =
                (websiteCounts[website.user_id] || 0) + 1;
        }

        for (const run of aiRuns || []) {
            if (!run.user_id) continue;

            aiRunCounts[run.user_id] =
                (aiRunCounts[run.user_id] || 0) + 1;
        }

        /*
         * Keep the newest subscription per user.
         */

        const subscriptionMap: Record<string, any> = {};

        for (const sub of subscriptions || []) {

            if (!sub.user_id) continue;

            const existing = subscriptionMap[sub.user_id];

            if (
                !existing ||
                new Date(sub.created_at || 0) >
                    new Date(existing.created_at || 0)
            ) {
                subscriptionMap[sub.user_id] = sub;
            }
        }

        /*
         * Supabase Auth users
         *
         * Email is not stored in profiles.
         */

        const authUsers: Record<string, any> = {};

        let authPage = 1;
        const authPerPage = 1000;

        while (true) {

            const {
                data: authResult,
                error: authError
            } = await sb.auth.admin.listUsers({
                page: authPage,
                perPage: authPerPage
            });

            if (authError) {
                console.error(authError);

                return json({
                    error: "Unable to load authentication users."
                }, 500);
            }

            for (const authUser of authResult.users || []) {
                authUsers[authUser.id] = authUser;
            }

            if (
                !authResult.users ||
                authResult.users.length < authPerPage
            ) {
                break;
            }

            authPage++;
        }

        /*
         * Combine everything
         */

        let users = (profiles || []).map((profile) => {

            const subscription =
                subscriptionMap[profile.id] || null;

            const authUser =
                authUsers[profile.id] || null;

            return {
                id: profile.id,

                full_name:
                    profile.full_name || "",

                email:
                    authUser?.email || "",

                phone:
                    profile.phone || authUser?.phone || "",

                role:
                    profile.role || "user",

                timezone:
                    profile.timezone || "",

                plan_id:
                    subscription?.plan_id || "free",

                billing_cycle:
                    subscription?.billing_cycle || "free",

                subscription_status:
                    subscription?.status || "none",

                subscription_ends_at:
                    subscription?.subscription_ends_at || null,

                started_at:
                    subscription?.started_at || null,

                websites:
                    websiteCounts[profile.id] || 0,

                ai_runs:
                    aiRunCounts[profile.id] || 0,

                created_at:
                    profile.created_at,

                updated_at:
                    profile.updated_at
            };
        });

        /*
         * Search
         */

        if (search) {
            users = users.filter((user) => {

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

                return haystack.includes(search);
            });
        }

        return json({
            success: true,
            users,
            total: users.length
        });
    }

    return json({
        error: "Unknown admin section."
    }, 400);
});