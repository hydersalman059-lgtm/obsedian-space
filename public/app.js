const C = window.OBSEDIAN_CONFIG || {};

const sb = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_PUBLISHABLE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

const $ = x => document.getElementById(x);

let session = null;
let currentSites = [];
let loading = false;


/* =========================
   AUTH / REDIRECT HELPERS
========================= */

function getRequestedRedirect() {

    const params =
        new URLSearchParams(window.location.search);

    const redirect =
        params.get("redirect");

    /*
     * Only allow our own internal Admin route.
     */
    if (
        redirect === "/admin/" ||
        redirect === "/admin"
    ) {
        return "/admin/";
    }

    /*
     * If Admin login started before the query string
     * was available, recover the destination from
     * sessionStorage.
     */
    try {

        if (
            sessionStorage.getItem(
                "obsedian_admin_login"
            ) === "1"
        ) {
            return "/admin/";
        }

    } catch (_) {
        // Ignore storage errors.
    }

    return "/app/";
}


function authRedirectUrl() {

    return (
        window.location.origin +
        getRequestedRedirect()
    );
}


function rememberAdminLogin() {

    if (
        getRequestedRedirect() !== "/admin/"
    ) {
        return;
    }

    try {

        sessionStorage.setItem(
            "obsedian_admin_login",
            "1"
        );

    } catch (_) {
        // Ignore storage errors.
    }
}


function clearAdminLoginMarker() {

    try {

        sessionStorage.removeItem(
            "obsedian_admin_login"
        );

    } catch (_) {
        // Ignore storage errors.
    }
}


function goAfterLogin() {

    if (
        getRequestedRedirect() !== "/admin/"
    ) {
        return false;
    }

    clearAdminLoginMarker();

    window.location.replace(
        "/admin/"
    );

    return true;
}


function hasAuthCallback() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    return (
        params.has("code") ||
        window.location.hash.includes(
            "access_token="
        ) ||
        window.location.hash.includes(
            "refresh_token="
        )
    );
}


/* =========================
   AUTH / BOOT
========================= */

async function boot() {

    try {

        const {
            data,
            error
        } =
            await sb.auth.getSession();

        if (error) {

            console.error(
                "Supabase session error:",
                error
            );
        }

        session =
            data?.session || null;


        /*
         * If an already-authenticated user follows
         * the Admin login route, return to Admin.
         */
        if (
            session &&
            getRequestedRedirect() === "/admin/" &&
            (
                hasAuthCallback() ||
                new URLSearchParams(
                    location.search
                ).has("redirect")
            )
        ) {

            goAfterLogin();

            return;
        }


        paint();


        /*
         * Listen for:
         * - Password login
         * - Magic link
         * - OAuth
         * - Phone OTP
         * - Logout
         */
        sb.auth.onAuthStateChange(
            async (
                event,
                newSession
            ) => {

                console.log(
                    "Auth event:",
                    event
                );

                session =
                    newSession || null;


                if (
                    event === "SIGNED_IN" &&
                    session
                ) {

                    /*
                     * If authentication started
                     * from Admin, return there.
                     */
                    if (
                        goAfterLogin()
                    ) {
                        return;
                    }

                    paint();

                    if (!loading) {
                        await load();
                    }

                    return;
                }


                if (
                    event === "SIGNED_OUT"
                ) {

                    session = null;
                    currentSites = [];
                }


                paint();
            }
        );

    } catch (error) {

        console.error(
            "Authentication boot error:",
            error
        );

        session = null;

        paint();
    }
}


/* =========================
   PAINT LOGIN / DASHBOARD
========================= */

function paint() {

    const loggedIn =
        !!session;


    if ($("login")) {

        $("login").classList.toggle(
            "hidden",
            loggedIn
        );
    }


    if ($("dash")) {

        $("dash").classList.toggle(
            "hidden",
            !loggedIn
        );
    }


    if (
        loggedIn &&
        !loading
    ) {

        load();
    }
}


/* =========================
   GOOGLE / GITHUB
========================= */

async function oauth(
    provider
) {

    /*
     * Remember Admin destination
     * before leaving the page.
     */
    rememberAdminLogin();


    const {
        error
    } =
        await sb.auth.signInWithOAuth({

            provider,

            options: {

                redirectTo:
                    authRedirectUrl()

            }
        });


    if (
        error &&
        $("msg")
    ) {

        $("msg").textContent =
            error.message;
    }
}


if ($("google")) {

    $("google").onclick =
        () =>
            oauth("google");
}


if ($("github")) {

    $("github").onclick =
        () =>
            oauth("github");
}


/* =========================
   EMAIL + PASSWORD LOGIN
========================= */

if ($("passwordBtn")) {

    $("passwordBtn").onclick =
        async () => {

            const email =
                $("email").value.trim();

            const password =
                $("password").value;


            if (!email) {

                $("msg").textContent =
                    "Please enter your email.";

                return;
            }


            if (!password) {

                $("msg").textContent =
                    "Please enter your password.";

                return;
            }


            /*
             * Preserve Admin destination.
             */
            rememberAdminLogin();


            $("passwordBtn").disabled =
                true;

            $("msg").textContent =
                "Signing in...";


            try {

                const {
                    data,
                    error
                } =
                    await sb.auth.signInWithPassword({

                        email,

                        password

                    });


                if (error) {

                    console.error(
                        "Password login error:",
                        error
                    );

                    $("msg").textContent =
                        error.message ||
                        "Unable to sign in.";

                    return;
                }


                session =
                    data?.session || null;


                if (!session) {

                    $("msg").textContent =
                        "Login completed, but no session was returned.";

                    return;
                }


                $("msg").textContent =
                    "Signed in successfully.";


                /*
                 * Admin login:
                 *
                 * /app/?redirect=/admin/
                 *          ↓
                 *       /admin/
                 */
                if (
                    goAfterLogin()
                ) {
                    return;
                }


                paint();

            } catch (error) {

                console.error(
                    "Password login exception:",
                    error
                );

                $("msg").textContent =
                    error?.message ||
                    "Sign in failed.";

            } finally {

                $("passwordBtn").disabled =
                    false;
            }
        };
}


/* =========================
   EMAIL MAGIC LINK
========================= */

if ($("emailBtn")) {

    $("emailBtn").onclick =
        async () => {

            const email =
                $("email").value.trim();


            if (!email) {

                $("msg").textContent =
                    "Please enter your email.";

                return;
            }


            /*
             * Determine where the user should
             * return after clicking the email.
             */
            const destination =
                getRequestedRedirect();


            /*
             * Preserve Admin login state.
             */
            rememberAdminLogin();


            $("emailBtn").disabled =
                true;

            $("msg").textContent =
                "Sending email link...";


            try {

                const {
                    error
                } =
                    await sb.auth.signInWithOtp({

                        email,

                        options: {

                            emailRedirectTo:
                                window.location.origin +
                                destination

                        }

                    });


                if (error) {

                    console.error(
                        "Email magic-link error:",
                        error
                    );


                    if (
                        destination === "/admin/"
                    ) {

                        clearAdminLoginMarker();
                    }


                    $("msg").textContent =
                        error.message ||
                        "Unable to send email link.";

                    return;
                }


                $("msg").textContent =
                    "Email link sent. Please check your inbox.";

            } catch (error) {

                console.error(
                    "Email magic-link exception:",
                    error
                );

                $("msg").textContent =
                    error?.message ||
                    "Unable to send email link.";

            } finally {

                $("emailBtn").disabled =
                    false;
            }
        };
}


/* =========================
   PHONE OTP
========================= */

if ($("phoneBtn")) {

    $("phoneBtn").onclick =
        async () => {

            const phone =
                $("phone").value.trim();


            if (!phone) {

                $("msg").textContent =
                    "Please enter your phone number.";

                return;
            }


            rememberAdminLogin();


            $("phoneBtn").disabled =
                true;

            $("msg").textContent =
                "Sending OTP...";


            try {

                const {
                    error
                } =
                    await sb.auth.signInWithOtp({
                        phone
                    });


                $("msg").textContent =
                    error?.message ||
                    "OTP sent.";

            } catch (error) {

                console.error(
                    "Phone OTP error:",
                    error
                );

                $("msg").textContent =
                    error?.message ||
                    "Unable to send OTP.";

            } finally {

                $("phoneBtn").disabled =
                    false;
            }
        };
}


/* =========================
   LOGOUT
========================= */

if ($("logout")) {

    $("logout").onclick =
        async () => {

            await sb.auth.signOut();

            clearAdminLoginMarker();

            session = null;

            currentSites = [];

            paint();
        };
}


/* =========================
   PLAN / BILLING HELPERS
========================= */

function daysRemaining(
    endsAt
) {

    if (!endsAt) {
        return null;
    }

    const ms =
        new Date(
            endsAt
        ).getTime() -
        Date.now();

    return Math.max(
        0,
        Math.ceil(
            ms / 86400000
        )
    );
}


function isPlanExpired(
    sub
) {

    if (!sub) {
        return false;
    }

    if (
        !sub.subscription_ends_at
    ) {
        return false;
    }

    return (
        new Date(
            sub.subscription_ends_at
        ) <= new Date()
    );
}


function openUpgrade() {

    const modal =
        $("upgradeModal");

    if (modal) {

        modal.classList.remove(
            "hidden"
        );
    }
}


function closeUpgrade() {

    const modal =
        $("upgradeModal");

    if (modal) {

        modal.classList.add(
            "hidden"
        );
    }
}


window.openUpgrade =
    openUpgrade;

window.closeUpgrade =
    closeUpgrade;


/* =========================
   LOAD DASHBOARD
========================= */

async function load() {

    if (
        !session ||
        loading
    ) {
        return;
    }


    loading = true;


    try {

        const u =
            session.user;


        $("hello").textContent =
            "Welcome, " +
            (
                u.user_metadata?.full_name ||
                u.email ||
                "there"
            );


        const [
            subR,
            siteR,
            apR
        ] =
            await Promise.all([

                sb
                    .from("subscriptions")
                    .select("*,plans(*)")
                    .eq(
                        "user_id",
                        u.id
                    )
                    .order(
                        "created_at",
                        {
                            ascending:
                                false
                        }
                    )
                    .limit(1)
                    .maybeSingle(),

                sb
                    .from("websites")
                    .select("*")
                    .eq(
                        "user_id",
                        u.id
                    )
                    .order(
                        "created_at",
                        {
                            ascending:
                                false
                        }
                    ),

                sb
                    .from("approvals")
                    .select("*")
                    .eq(
                        "user_id",
                        u.id
                    )
                    .order(
                        "created_at",
                        {
                            ascending:
                                false
                        }
                    )
                    .limit(20)

            ]);


        if (subR.error) {

            console.error(
                "Subscription error:",
                subR.error
            );
        }


        if (siteR.error) {

            console.error(
                "Website error:",
                siteR.error
            );
        }


        if (apR.error) {

            console.error(
                "Approval error:",
                apR.error
            );
        }


        const sub =
            subR.data;


        const sites =
            siteR.data || [];


        currentSites =
            sites;


        $("badge").textContent =
            sub?.plans?.name ||
            "Free";


        $("stats").innerHTML = [

            [
                "Websites",
                sites.length
            ],

            [
                "Limit",
                sub?.plans?.max_websites ||
                0
            ],

            [
                "Status",
                sub?.status ||
                "—"
            ],

            [
                "Ends",
                sub?.subscription_ends_at
                    ? new Date(
                        sub.subscription_ends_at
                    ).toLocaleDateString()
                    : "—"
            ]

        ]
        .map(
            x =>
                `<div class="stat">
                    <small>${x[0]}</small><br>
                    <b>${x[1]}</b>
                </div>`
        )
        .join("");


        $("sites").innerHTML =

            sites
                .map(
                    s =>
                        `<div class="item">
                            <b>${s.name || s.url}</b><br>
                            <small>
                                ${s.url} · ${s.status}
                            </small>
                        </div>`
                )
                .join("")

            ||
            "<p>No websites yet.</p>";


        const planName =
            sub?.plans?.name ||
            "Free";


        const remainingDays =
            daysRemaining(
                sub?.subscription_ends_at
            );


        const expired =
            isPlanExpired(sub) ||
            sub?.status === "paused" ||
            sub?.status === "expired";


        $("billing").innerHTML =
            sub
                ? `
                <div class="billing-summary">

                    <div>

                        <strong>
                            ${planName}
                        </strong>

                        <span
                            class="billing-status ${
                                expired
                                    ? "expired"
                                    : "active"
                            }"
                        >
                            ${
                                expired
                                    ? "Expired / Paused"
                                    : sub.status
                            }
                        </span>

                    </div>

                    <p>

                        ${
                            sub.plans?.max_websites ||
                            0
                        }

                        website${
                            (
                                sub.plans?.max_websites ||
                                0
                            ) === 1
                                ? ""
                                : "s"
                        }

                        · ends

                        ${
                            sub.subscription_ends_at
                                ? new Date(
                                    sub.subscription_ends_at
                                ).toLocaleDateString()
                                : "—"
                        }

                    </p>

                    ${
                        planName === "Free" &&
                        !expired

                            ? `
                            <div class="trial-box">

                                <b>
                                    ${
                                        remainingDays
                                    }
                                    days remaining
                                </b>

                                <span>
                                    Free plan · 45-day trial
                                </span>

                            </div>
                            `

                            : ""
                    }

                    ${
                        planName === "Free" ||
                        expired

                            ? `
                            <button
                                class="upgrade-btn"
                                type="button"
                                onclick="openUpgrade()"
                            >
                                Upgrade Plan
                            </button>
                            `

                            : ""
                    }

                </div>
                `

                :

                `
                <div class="billing-summary">

                    <p>
                        No active plan found.
                    </p>

                    <button
                        class="upgrade-btn"
                        type="button"
                        onclick="openUpgrade()"
                    >
                        Choose a Plan
                    </button>

                </div>
                `;


        $("approvals").innerHTML =

            (apR.data || [])
                .map(
                    a =>
                        `<div class="item">

                            <b>
                                ${a.title}
                            </b>

                            <br>

                            ${
                                a.description ||
                                ""
                            }

                            <br>

                            <small>
                                ${
                                    a.status
                                }
                                ·
                                ${
                                    a.risk_level
                                }
                            </small>

                            ${
                                a.status === "pending"

                                    ? `
                                    <button
                                        onclick="approve('${a.id}')"
                                    >
                                        Approve
                                    </button>

                                    <button
                                        onclick="reject('${a.id}')"
                                    >
                                        Reject
                                    </button>
                                    `

                                    : ""
                            }

                        </div>`
                )
                .join("")

            ||
            "<p>No pending approvals.</p>";

    } finally {

        loading = false;
    }
}


/* =========================
   ADD WEBSITE
========================= */

if ($("add")) {

    $("add").onclick =
        async () => {

            if (!session) {

                alert(
                    "Please sign in first."
                );

                return;
            }


            const url =
                $("url").value.trim();


            const name =
                $("name").value.trim();


            if (!url) {

                alert(
                    "Please enter a website URL."
                );

                return;
            }


            let normalizedUrl;


            try {

                normalizedUrl =
                    new URL(
                        url
                    ).origin;

            } catch {

                alert(
                    "Please enter a valid URL, for example https://example.com"
                );

                return;
            }


            const {
                error
            } =
                await sb
                    .from("websites")
                    .insert({

                        user_id:
                            session.user.id,

                        url,

                        normalized_url:
                            normalizedUrl,

                        name,

                        status:
                            "pending",

                        next_crawl_at:
                            new Date()
                                .toISOString()

                    });


            if (error) {

                alert(
                    error.message
                );

            } else {

                $("url").value =
                    "";

                $("name").value =
                    "";

                await load();
            }
        };
}


/* =========================
   AI OUTPUT RENDERER
========================= */

function aiEscape(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function aiIsObject(value) {
    return value !== null && typeof value === "object";
}

function aiFormatInline(value) {
    if (value === null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") return value.toLocaleString();
    if (typeof value === "string") return aiEscape(value);
    return aiEscape(JSON.stringify(value));
}

function aiRenderValue(value, level = 0) {
    if (value === null || value === undefined) {
        return `<span class="ai-null">—</span>`;
    }

    if (typeof value !== "object") {
        return `<span class="ai-value">${aiFormatInline(value)}</span>`;
    }

    if (Array.isArray(value)) {
        if (!value.length) {
            return `<span class="ai-empty">No items</span>`;
        }

        return `<div class="ai-list">${value.map((item, index) => `
            <div class="ai-list-item">
                <div class="ai-index">${index + 1}</div>
                <div class="ai-list-content">${aiRenderValue(item, level + 1)}</div>
            </div>
        `).join("")}</div>`;
    }

    const entries = Object.entries(value);
    if (!entries.length) {
        return `<span class="ai-empty">No data</span>`;
    }

    return `<div class="ai-object">${entries.map(([key, child]) => {
        const label = key
            .replace(/_/g, " ")
            .replace(/\b\w/g, c => c.toUpperCase());

        const primitive = child === null || child === undefined ||
            typeof child !== "object";

        return `
            <div class="ai-field ${primitive ? "ai-field-primitive" : "ai-field-object"}">
                <div class="ai-key">${aiEscape(label)}</div>
                <div class="ai-field-value">${aiRenderValue(child, level + 1)}</div>
            </div>
        `;
    }).join("")}</div>`;
}

function aiRenderResult(data) {
    const root = $("out");
    if (!root) return;

    let value = data;

    if (typeof value === "string") {
        try {
            value = JSON.parse(value);
        } catch {
            root.innerHTML = `<div class="ai-card"><div class="ai-text">${aiEscape(value)}</div></div>`;
            return;
        }
    }

    if (!aiIsObject(value)) {
        root.innerHTML = `<div class="ai-card">${aiRenderValue(value)}</div>`;
        return;
    }

    const success = value.success !== false && !value.error;
    const provider = value.provider || value.raw_ai_result?.provider || "—";
    const agentName = value.agent || value.raw_ai_result?.agent || "AI agent";
    const website = value.website || value.url || "";
    const score = value.score;
    const audit = value.audit || {};
    const summary = audit.summary || {};
    const crawl = value.crawl || {};
    const metrics = audit.detailed_metrics || {};
    const warnings = summary.warnings || [];
    const critical = summary.critical_issues || [];
    const positive = summary.positive_signals || [];
    const technical = audit.technical_seo || [];
    const onPage = audit.on_page_seo || [];
    const content = audit.content || [];
    const actions = audit.prioritized_actions || [];

    const list = (items, emptyText = "None") => items.length
        ? `<ul class="ai-bullets">${items.map(item => `<li>${aiEscape(typeof item === "string" ? item : JSON.stringify(item))}</li>`).join("")}</ul>`
        : `<div class="ai-empty">${aiEscape(emptyText)}</div>`;

    const issueCards = items => items.length
        ? `<div class="ai-issues">${items.map(item => `
            <div class="ai-issue">
                <div class="ai-issue-head">
                    <strong>${aiEscape(item.issue || item.action || "Issue")}</strong>
                    ${item.severity ? `<span class="ai-severity">${aiEscape(item.severity)}</span>` : ""}
                    ${item.priority ? `<span class="ai-priority">Priority ${aiEscape(item.priority)}</span>` : ""}
                </div>
                ${item.evidence ? `<p><b>Evidence:</b> ${aiEscape(item.evidence)}</p>` : ""}
                ${item.reason ? `<p><b>Reason:</b> ${aiEscape(item.reason)}</p>` : ""}
                ${item.recommendation ? `<p><b>Recommendation:</b> ${aiEscape(item.recommendation)}</p>` : ""}
            </div>
        `).join("")}</div>`
        : `<div class="ai-empty">None</div>`;

    const metricEntries = Object.entries(metrics);
    const metricHtml = metricEntries.length
        ? `<div class="ai-metrics">${metricEntries.map(([key, val]) => `
            <div class="ai-metric">
                <span>${aiEscape(key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()))}</span>
                <strong>${aiFormatInline(val)}</strong>
            </div>
        `).join("")}</div>`
        : "";

    root.innerHTML = `
        <div class="ai-report">
            <div class="ai-report-header">
                <div>
                    <div class="ai-kicker">AI Operations Report</div>
                    <h3>${aiEscape(agentName)}</h3>
                    ${website ? `<a href="${aiEscape(website)}" target="_blank" rel="noopener noreferrer">${aiEscape(website)}</a>` : ""}
                </div>
                <div class="ai-status ${success ? "success" : "error"}">
                    ${success ? "Completed" : "Error"}
                </div>
            </div>

            <div class="ai-top-grid">
                ${score !== undefined ? `<div class="ai-score-card"><span>SEO Score</span><strong>${aiEscape(score)}<small>/100</small></strong></div>` : ""}
                <div class="ai-summary-card"><span>Provider</span><strong>${aiEscape(provider)}</strong></div>
                ${crawl.homepage_status !== undefined ? `<div class="ai-summary-card"><span>HTTP Status</span><strong>${aiEscape(crawl.homepage_status)}</strong></div>` : ""}
                ${crawl.response_time_ms !== undefined ? `<div class="ai-summary-card"><span>Response Time</span><strong>${aiEscape(crawl.response_time_ms)} ms</strong></div>` : ""}
            </div>

            ${summary.overall_observations?.length ? `
                <section class="ai-section">
                    <h4>Overview</h4>
                    ${list(summary.overall_observations)}
                </section>` : ""}

            ${critical.length ? `
                <section class="ai-section ai-danger-section">
                    <h4>Critical Issues</h4>
                    ${list(critical)}
                </section>` : ""}

            <section class="ai-section">
                <h4>Warnings</h4>
                ${list(warnings)}
            </section>

            <section class="ai-section ai-positive-section">
                <h4>Positive Signals</h4>
                ${list(positive)}
            </section>

            ${metricHtml ? `<section class="ai-section"><h4>Detailed Metrics</h4>${metricHtml}</section>` : ""}
            ${technical.length ? `<section class="ai-section"><h4>Technical SEO</h4>${issueCards(technical)}</section>` : ""}
            ${onPage.length ? `<section class="ai-section"><h4>On-Page SEO</h4>${issueCards(onPage)}</section>` : ""}
            ${content.length ? `<section class="ai-section"><h4>Content</h4>${issueCards(content)}</section>` : ""}
            ${actions.length ? `<section class="ai-section"><h4>Prioritized Actions</h4>${issueCards(actions)}</section>` : ""}

            <details class="ai-raw">
                <summary>View raw AI response</summary>
                <pre>${aiEscape(JSON.stringify(value, null, 2))}</pre>
            </details>
        </div>
    `;
}

function aiShowLoading(message = "AI agent running…") {
    const root = $("out");
    if (!root) return;
    root.innerHTML = `<div class="ai-loading"><span class="ai-spinner"></span>${aiEscape(message)}</div>`;
}

/* =========================
   AI AGENTS
========================= */

/*
 * Escape HTML before inserting AI/server data
 * into the visual result area.
 */
function aiEscape(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/*
 * Safely convert any value to readable text.
 */
function aiValue(value, fallback = "—") {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return fallback;
    }

    if (
        typeof value === "object"
    ) {
        try {
            return JSON.stringify(
                value,
                null,
                2
            );
        } catch {
            return String(value);
        }
    }

    return String(value);
}


/*
 * Get the current website URL.
 */
function getCurrentWebsiteUrl() {

    return (
        currentSites?.[0]?.url ||
        currentSites?.[0]?.normalized_url ||
        ""
    );
}


/*
 * Common AI result header.
 */
function aiResultHeader(
    title,
    subtitle,
    icon,
    gradient
) {

    return `
        <div
            class="ai-result-header"
            style="
                background:${gradient};
                color:#fff;
                padding:24px;
                border-radius:18px;
                margin-bottom:20px;
                box-shadow:0 12px 30px rgba(0,0,0,.12);
            "
        >

            <div
                style="
                    display:flex;
                    align-items:center;
                    gap:16px;
                "
            >

                <div
                    style="
                        width:58px;
                        height:58px;
                        border-radius:16px;
                        background:rgba(255,255,255,.18);
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        font-size:30px;
                        flex-shrink:0;
                    "
                >
                    ${icon}
                </div>

                <div>

                    <div
                        style="
                            font-size:24px;
                            font-weight:800;
                            line-height:1.2;
                        "
                    >
                        ${aiEscape(title)}
                    </div>

                    <div
                        style="
                            margin-top:6px;
                            opacity:.92;
                            font-size:14px;
                        "
                    >
                        ${aiEscape(subtitle)}
                    </div>

                </div>

            </div>

        </div>
    `;
}


/*
 * SEO strategy visual.
 *
 * IMPORTANT:
 * The interface should not claim that a real submission
 * happened unless the backend actually performs those
 * submissions. Therefore the UI describes the 25+ engine
 * network as an AI visibility / submission workflow.
 */
function renderSEOStrategy(
    data,
    websiteUrl
) {

    const engines = [
        "ChatGPT",
        "Google AI",
        "Gemini",
        "Claude",
        "Microsoft Copilot",
        "Perplexity",
        "Grok",
        "Meta AI",
        "DeepSeek",
        "Mistral",
        "You.com",
        "Phind",
        "Poe",
        "Brave AI",
        "Kagi",
        "Andi",
        "Kompas AI",
        "DuckDuckGo AI",
        "Bing AI",
        "Google Discover",
        "AI Overviews",
        "SearchGPT",
        "Character AI",
        "Qwen",
        "Le Chat"
    ];

    const engineColors = [
        "#7c3aed",
        "#2563eb",
        "#06b6d4",
        "#0f766e",
        "#16a34a",
        "#65a30d",
        "#eab308",
        "#f97316",
        "#ef4444",
        "#ec4899"
    ];

    const strategy =
        data?.strategy ||
        data?.result ||
        data?.output ||
        data?.data ||
        {};

    let keywordThemes = [];
    let opportunities = [];
    let contentBriefs = [];
    let internalLinks = [];

    if (
        typeof strategy === "object"
    ) {

        keywordThemes =
            strategy.keyword_themes ||
            strategy.keywords ||
            [];

        opportunities =
            strategy.page_opportunities ||
            strategy.opportunities ||
            [];

        contentBriefs =
            strategy.content_briefs ||
            strategy.briefs ||
            [];

        internalLinks =
            strategy.internal_linking ||
            strategy.internal_links ||
            [];
    }

    /*
     * Normalize arrays so the UI remains stable
     * even when the AI response uses another shape.
     */
    const normalizeArray = value => {

        if (
            Array.isArray(value)
        ) {
            return value;
        }

        if (
            typeof value === "string" &&
            value.trim()
        ) {
            return [
                value
            ];
        }

        return [];
    };

    keywordThemes =
        normalizeArray(
            keywordThemes
        );

    opportunities =
        normalizeArray(
            opportunities
        );

    contentBriefs =
        normalizeArray(
            contentBriefs
        );

    internalLinks =
        normalizeArray(
            internalLinks
        );


    return `

        ${aiResultHeader(
            "AI SEO Strategy",
            "30-day search visibility and AI discovery plan",
            "🚀",
            "linear-gradient(135deg,#7c3aed,#2563eb,#06b6d4)"
        )}

        <!-- WEBSITE -->
        <div
            style="
                padding:20px;
                border-radius:16px;
                background:
                    linear-gradient(
                        135deg,
                        #fff7ed,
                        #fef3c7,
                        #ecfeff
                    );
                border:1px solid #fde68a;
                margin-bottom:20px;
            "
        >

            <div
                style="
                    font-size:13px;
                    font-weight:700;
                    text-transform:uppercase;
                    letter-spacing:.08em;
                    color:#7c3aed;
                "
            >
                Website / Blog
            </div>

            <div
                style="
                    margin-top:8px;
                    font-size:18px;
                    font-weight:800;
                    color:#111827;
                    word-break:break-all;
                "
            >
                ${aiEscape(websiteUrl)}
            </div>

            <div
                style="
                    margin-top:8px;
                    color:#475569;
                    font-size:13px;
                "
            >
                Your website is being prepared for visibility
                across a network of 25+ AI and search discovery
                surfaces.
            </div>

        </div>


        <!-- AI ENGINE INFOGRAPHIC -->
        <div
            style="
                padding:22px;
                border-radius:18px;
                background:#0f172a;
                color:#fff;
                margin-bottom:20px;
                overflow:hidden;
                position:relative;
            "
        >

            <div
                style="
                    position:absolute;
                    width:220px;
                    height:220px;
                    border-radius:50%;
                    background:rgba(124,58,237,.25);
                    right:-80px;
                    top:-90px;
                "
            ></div>

            <div
                style="
                    position:absolute;
                    width:180px;
                    height:180px;
                    border-radius:50%;
                    background:rgba(6,182,212,.18);
                    left:-80px;
                    bottom:-100px;
                "
            ></div>


            <div
                style="
                    position:relative;
                    z-index:2;
                "
            >

                <div
                    style="
                        font-size:13px;
                        text-transform:uppercase;
                        letter-spacing:.1em;
                        color:#a5b4fc;
                        font-weight:800;
                    "
                >
                    AI Discovery Network
                </div>

                <div
                    style="
                        display:flex;
                        align-items:center;
                        gap:18px;
                        margin-top:12px;
                        flex-wrap:wrap;
                    "
                >

                    <div
                        style="
                            font-size:46px;
                            font-weight:900;
                            background:
                                linear-gradient(
                                    90deg,
                                    #c084fc,
                                    #38bdf8,
                                    #34d399,
                                    #facc15
                                );
                            -webkit-background-clip:text;
                            background-clip:text;
                            color:transparent;
                        "
                    >
                        25+
                    </div>

                    <div
                        style="
                            font-size:18px;
                            font-weight:700;
                        "
                    >
                        AI Engines & Discovery Surfaces
                    </div>

                </div>

                <div
                    style="
                        margin-top:18px;
                        display:grid;
                        grid-template-columns:
                            repeat(
                                auto-fit,
                                minmax(130px,1fr)
                            );
                        gap:10px;
                    "
                >

                    ${engines
                        .map(
                            (engine, index) => `
                                <div
                                    style="
                                        padding:10px 12px;
                                        border-radius:10px;
                                        background:
                                            linear-gradient(
                                                135deg,
                                                ${
                                                    engineColors[
                                                        index %
                                                        engineColors.length
                                                    ]
                                                },
                                                rgba(255,255,255,.12)
                                            );
                                        font-size:12px;
                                        font-weight:700;
                                        box-shadow:
                                            0 5px 15px
                                            rgba(0,0,0,.18);
                                    "
                                >
                                    ${aiEscape(engine)}
                                </div>
                            `
                        )
                        .join("")}

                </div>

            </div>

        </div>


        <!-- COLORFUL PROCESS INFOGRAPHIC -->
        <div
            style="
                display:grid;
                grid-template-columns:
                    repeat(
                        auto-fit,
                        minmax(180px,1fr)
                    );
                gap:14px;
                margin-bottom:20px;
            "
        >

            <div
                style="
                    padding:20px;
                    border-radius:16px;
                    background:
                        linear-gradient(
                            135deg,
                            #ede9fe,
                            #ddd6fe
                        );
                "
            >
                <div style="font-size:28px;">
                    🔎
                </div>

                <strong
                    style="
                        display:block;
                        margin-top:8px;
                        color:#5b21b6;
                    "
                >
                    01 · Discover
                </strong>

                <small>
                    Analyze your website and identify
                    important search topics.
                </small>
            </div>


            <div
                style="
                    padding:20px;
                    border-radius:16px;
                    background:
                        linear-gradient(
                            135deg,
                            #dbeafe,
                            #bfdbfe
                        );
                "
            >
                <div style="font-size:28px;">
                    🧠
                </div>

                <strong
                    style="
                        display:block;
                        margin-top:8px;
                        color:#1d4ed8;
                    "
                >
                    02 · Understand
                </strong>

                <small>
                    Build keyword, content and entity
                    opportunities.
                </small>
            </div>


            <div
                style="
                    padding:20px;
                    border-radius:16px;
                    background:
                        linear-gradient(
                            135deg,
                            #cffafe,
                            #a5f3fc
                        );
                "
            >
                <div style="font-size:28px;">
                    🤖
                </div>

                <strong
                    style="
                        display:block;
                        margin-top:8px;
                        color:#0e7490;
                    "
                >
                    03 · AI Visibility
                </strong>

                <small>
                    Prepare content for AI-powered
                    discovery and answer engines.
                </small>
            </div>


            <div
                style="
                    padding:20px;
                    border-radius:16px;
                    background:
                        linear-gradient(
                            135deg,
                            #dcfce7,
                            #bbf7d0
                        );
                "
            >
                <div style="font-size:28px;">
                    📈
                </div>

                <strong
                    style="
                        display:block;
                        margin-top:8px;
                        color:#15803d;
                    "
                >
                    04 · Grow
                </strong>

                <small>
                    Turn recommendations into a
                    measurable 30-day action plan.
                </small>
            </div>

        </div>


        <!-- STRATEGY CARDS -->
        <div
            style="
                display:grid;
                grid-template-columns:
                    repeat(
                        auto-fit,
                        minmax(240px,1fr)
                    );
                gap:16px;
            "
        >

            <div
                style="
                    padding:20px;
                    border-radius:16px;
                    background:#fff;
                    border:1px solid #e5e7eb;
                    box-shadow:0 6px 18px rgba(0,0,0,.05);
                "
            >

                <div
                    style="
                        color:#7c3aed;
                        font-size:13px;
                        font-weight:800;
                        text-transform:uppercase;
                    "
                >
                    Keyword Themes
                </div>

                <div
                    style="
                        margin-top:12px;
                        line-height:1.7;
                    "
                >

                    ${
                        keywordThemes.length
                            ? keywordThemes
                                .slice(0,8)
                                .map(
                                    item =>
                                        `<div
                                            style="
                                                padding:8px 0;
                                                border-bottom:
                                                    1px solid #f1f5f9;
                                            "
                                        >
                                            ${aiEscape(
                                                typeof item === "object"
                                                    ? (
                                                        item.keyword ||
                                                        item.theme ||
                                                        item.title ||
                                                        JSON.stringify(item)
                                                    )
                                                    : item
                                            )}
                                        </div>`
                                )
                                .join("")
                            : `
                                <div
                                    style="
                                        color:#64748b;
                                        font-size:13px;
                                    "
                                >
                                    AI-generated keyword themes
                                    will appear here.
                                </div>
                            `
                    }

                </div>

            </div>


            <div
                style="
                    padding:20px;
                    border-radius:16px;
                    background:#fff;
                    border:1px solid #e5e7eb;
                    box-shadow:0 6px 18px rgba(0,0,0,.05);
                "
            >

                <div
                    style="
                        color:#2563eb;
                        font-size:13px;
                        font-weight:800;
                        text-transform:uppercase;
                    "
                >
                    Page Opportunities
                </div>

                <div
                    style="
                        margin-top:12px;
                        line-height:1.7;
                    "
                >

                    ${
                        opportunities.length
                            ? opportunities
                                .slice(0,8)
                                .map(
                                    item =>
                                        `<div
                                            style="
                                                padding:8px 0;
                                                border-bottom:
                                                    1px solid #f1f5f9;
                                            "
                                        >
                                            ${aiEscape(
                                                typeof item === "object"
                                                    ? (
                                                        item.title ||
                                                        item.page ||
                                                        item.url ||
                                                        item.description ||
                                                        JSON.stringify(item)
                                                    )
                                                    : item
                                            )}
                                        </div>`
                                )
                                .join("")
                            : `
                                <div
                                    style="
                                        color:#64748b;
                                        font-size:13px;
                                    "
                                >
                                    Recommended page opportunities
                                    will appear here.
                                </div>
                            `
                    }

                </div>

            </div>


            <div
                style="
                    padding:20px;
                    border-radius:16px;
                    background:#fff;
                    border:1px solid #e5e7eb;
                    box-shadow:0 6px 18px rgba(0,0,0,.05);
                "
            >

                <div
                    style="
                        color:#059669;
                        font-size:13px;
                        font-weight:800;
                        text-transform:uppercase;
                    "
                >
                    Content Opportunities
                </div>

                <div
                    style="
                        margin-top:12px;
                        line-height:1.7;
                    "
                >

                    ${
                        contentBriefs.length
                            ? contentBriefs
                                .slice(0,8)
                                .map(
                                    item =>
                                        `<div
                                            style="
                                                padding:8px 0;
                                                border-bottom:
                                                    1px solid #f1f5f9;
                                            "
                                        >
                                            ${aiEscape(
                                                typeof item === "object"
                                                    ? (
                                                        item.title ||
                                                        item.topic ||
                                                        item.brief ||
                                                        JSON.stringify(item)
                                                    )
                                                    : item
                                            )}
                                        </div>`
                                )
                                .join("")
                            : `
                                <div
                                    style="
                                        color:#64748b;
                                        font-size:13px;
                                    "
                                >
                                    AI content briefs will appear
                                    here.
                                </div>
                            `
                    }

                </div>

            </div>

        </div>


        <!-- RAW RESULT -->
        <details
            style="
                margin-top:20px;
                background:#f8fafc;
                border:1px solid #e2e8f0;
                border-radius:12px;
                padding:14px;
            "
        >

            <summary
                style="
                    cursor:pointer;
                    font-weight:700;
                    color:#475569;
                "
            >
                View AI response data
            </summary>

            <pre
                style="
                    margin-top:14px;
                    white-space:pre-wrap;
                    word-break:break-word;
                    font-size:12px;
                    line-height:1.6;
                    max-height:500px;
                    overflow:auto;
                "
            >${aiEscape(
                JSON.stringify(
                    data,
                    null,
                    2
                )
            )}</pre>

        </details>

    `;
}


/*
 * SEO AUDIT RESULT
 */
function renderSEOAudit(
    data,
    websiteUrl
) {

    const audit =
        data?.audit ||
        data?.result ||
        data?.data ||
        {};

    const crawl =
        data?.crawl ||
        audit?.crawl ||
        {};

    const score =
        Number(
            data?.score ??
            audit?.score ??
            0
        );

    const warnings =
        audit?.summary?.warnings ||
        [];

    const positives =
        audit?.summary?.positive_signals ||
        [];

    const critical =
        audit?.summary?.critical_issues ||
        [];

    return `

        ${aiResultHeader(
            "SEO Website Audit",
            "Technical SEO, on-page SEO and website health analysis",
            "🔍",
            "linear-gradient(135deg,#0f766e,#0891b2,#2563eb)"
        )}


        <div
            style="
                display:grid;
                grid-template-columns:
                    repeat(
                        auto-fit,
                        minmax(180px,1fr)
                    );
                gap:16px;
                margin-bottom:20px;
            "
        >

            <div
                style="
                    padding:22px;
                    border-radius:16px;
                    background:
                        linear-gradient(
                            135deg,
                            #dcfce7,
                            #bbf7d0
                        );
                "
            >

                <div
                    style="
                        font-size:13px;
                        font-weight:800;
                        color:#166534;
                    "
                >
                    SEO SCORE
                </div>

                <div
                    style="
                        font-size:46px;
                        font-weight:900;
                        color:#15803d;
                        margin-top:5px;
                    "
                >
                    ${aiEscape(score)}
                </div>

                <small>
                    Overall observable score
                </small>

            </div>


            <div
                style="
                    padding:22px;
                    border-radius:16px;
                    background:
                        linear-gradient(
                            135deg,
                            #dbeafe,
                            #bfdbfe
                        );
                "
            >

                <div
                    style="
                        font-size:13px;
                        font-weight:800;
                        color:#1d4ed8;
                    "
                >
                    HTTP STATUS
                </div>

                <div
                    style="
                        font-size:34px;
                        font-weight:900;
                        color:#1d4ed8;
                        margin-top:8px;
                    "
                >
                    ${aiEscape(
                        crawl.homepage_status ??
                        "—"
                    )}
                </div>

            </div>


            <div
                style="
                    padding:22px;
                    border-radius:16px;
                    background:
                        linear-gradient(
                            135deg,
                            #fef3c7,
                            #fde68a
                        );
                "
            >

                <div
                    style="
                        font-size:13px;
                        font-weight:800;
                        color:#92400e;
                    "
                >
                    RESPONSE TIME
                </div>

                <div
                    style="
                        font-size:34px;
                        font-weight:900;
                        color:#b45309;
                        margin-top:8px;
                    "
                >
                    ${aiEscape(
                        crawl.response_time_ms ??
                        "—"
                    )} ms
                </div>

            </div>


            <div
                style="
                    padding:22px;
                    border-radius:16px;
                    background:
                        linear-gradient(
                            135deg,
                            #ede9fe,
                            #ddd6fe
                        );
                "
            >

                <div
                    style="
                        font-size:13px;
                        font-weight:800;
                        color:#6d28d9;
                    "
                >
                    WEBSITE
                </div>

                <div
                    style="
                        margin-top:8px;
                        font-weight:800;
                        color:#5b21b6;
                        word-break:break-all;
                    "
                >
                    ${aiEscape(
                        websiteUrl
                    )}
                </div>

            </div>

        </div>


        <div
            style="
                display:grid;
                grid-template-columns:
                    repeat(
                        auto-fit,
                        minmax(250px,1fr)
                    );
                gap:16px;
            "
        >

            <div
                style="
                    padding:20px;
                    border-radius:16px;
                    background:#fff;
                    border:1px solid #fecaca;
                "
            >

                <h3
                    style="
                        color:#dc2626;
                        margin-top:0;
                    "
                >
                    ⚠ Critical Issues
                </h3>

                ${
                    critical.length
                        ? critical
                            .map(
                                item =>
                                    `<div
                                        style="
                                            padding:9px 0;
                                            border-bottom:
                                                1px solid #fee2e2;
                                        "
                                    >
                                        ${aiEscape(
                                            typeof item === "object"
                                                ? (
                                                    item.issue ||
                                                    item.message ||
                                                    JSON.stringify(item)
                                                )
                                                : item
                                        )}
                                    </div>`
                            )
                            .join("")
                        : `
                            <div
                                style="
                                    color:#15803d;
                                    font-weight:700;
                                "
                            >
                                ✓ No critical issues detected.
                            </div>
                        `
                }

            </div>


            <div
                style="
                    padding:20px;
                    border-radius:16px;
                    background:#fff;
                    border:1px solid #fde68a;
                "
            >

                <h3
                    style="
                        color:#b45309;
                        margin-top:0;
                    "
                >
                    ⚠ Warnings
                </h3>

                ${
                    warnings.length
                        ? warnings
                            .map(
                                item =>
                                    `<div
                                        style="
                                            padding:9px 0;
                                            border-bottom:
                                                1px solid #fef3c7;
                                        "
                                    >
                                        ${aiEscape(item)}
                                    </div>`
                            )
                            .join("")
                        : `
                            <div
                                style="
                                    color:#15803d;
                                    font-weight:700;
                                "
                            >
                                ✓ No warnings detected.
                            </div>
                        `
                }

            </div>


            <div
                style="
                    padding:20px;
                    border-radius:16px;
                    background:#fff;
                    border:1px solid #bbf7d0;
                "
            >

                <h3
                    style="
                        color:#15803d;
                        margin-top:0;
                    "
                >
                    ✓ Positive Signals
                </h3>

                ${
                    positives.length
                        ? positives
                            .map(
                                item =>
                                    `<div
                                        style="
                                            padding:9px 0;
                                            border-bottom:
                                                1px solid #dcfce7;
                                        "
                                    >
                                        ${aiEscape(item)}
                                    </div>`
                            )
                            .join("")
                        : `
                            <div
                                style="
                                    color:#64748b;
                                "
                            >
                                No positive signals returned.
                            </div>
                        `
                }

            </div>

        </div>


        <details
            style="
                margin-top:20px;
                background:#f8fafc;
                border:1px solid #e2e8f0;
                border-radius:12px;
                padding:14px;
            "
        >

            <summary
                style="
                    cursor:pointer;
                    font-weight:700;
                "
            >
                View complete audit data
            </summary>

            <pre
                style="
                    margin-top:14px;
                    white-space:pre-wrap;
                    word-break:break-word;
                    font-size:12px;
                    max-height:600px;
                    overflow:auto;
                "
            >${aiEscape(
                JSON.stringify(
                    data,
                    null,
                    2
                )
            )}</pre>

        </details>

    `;
}


/*
 * WEEKLY EXECUTIVE REPORT
 */
function renderWeeklyReport(
    data,
    websiteUrl
) {

    const result =
        data?.report ||
        data?.result ||
        data?.data ||
        {};

    return `

        ${aiResultHeader(
            "Weekly AI Growth Report",
            "Executive overview of your website's current observable signals",
            "📊",
            "linear-gradient(135deg,#ea580c,#db2777,#7c3aed)"
        )}


        <div
            style="
                padding:22px;
                border-radius:18px;
                background:
                    linear-gradient(
                        135deg,
                        #fff7ed,
                        #fce7f3,
                        #ede9fe
                    );
                margin-bottom:20px;
            "
        >

            <div
                style="
                    font-size:13px;
                    text-transform:uppercase;
                    font-weight:800;
                    color:#7c3aed;
                "
            >
                Reporting Website
            </div>

            <div
                style="
                    font-size:20px;
                    font-weight:900;
                    margin-top:7px;
                    word-break:break-all;
                "
            >
                ${aiEscape(
                    websiteUrl
                )}
            </div>

        </div>


        <div
            style="
                display:grid;
                grid-template-columns:
                    repeat(
                        auto-fit,
                        minmax(180px,1fr)
                    );
                gap:15px;
                margin-bottom:20px;
            "
        >

            <div
                style="
                    padding:22px;
                    border-radius:16px;
                    background:#dbeafe;
                "
            >
                <div style="font-size:30px;">
                    🌐
                </div>
                <strong
                    style="
                        display:block;
                        margin-top:8px;
                        color:#1d4ed8;
                    "
                >
                    Website Signals
                </strong>
                <small>
                    Current crawl and observable website
                    information.
                </small>
            </div>


            <div
                style="
                    padding:22px;
                    border-radius:16px;
                    background:#dcfce7;
                "
            >
                <div style="font-size:30px;">
                    📈
                </div>
                <strong
                    style="
                        display:block;
                        margin-top:8px;
                        color:#15803d;
                    "
                >
                    Growth Signals
                </strong>
                <small>
                    Identify measurable opportunities
                    without inventing traffic data.
                </small>
            </div>


            <div
                style="
                    padding:22px;
                    border-radius:16px;
                    background:#fef3c7;
                "
            >
                <div style="font-size:30px;">
                    🎯
                </div>
                <strong
                    style="
                        display:block;
                        margin-top:8px;
                        color:#b45309;
                    "
                >
                    Next Actions
                </strong>
                <small>
                    Prioritize the most useful actions
                    for the coming week.
                </small>
            </div>


            <div
                style="
                    padding:22px;
                    border-radius:16px;
                    background:#f3e8ff;
                "
            >
                <div style="font-size:30px;">
                    🤖
                </div>
                <strong
                    style="
                        display:block;
                        margin-top:8px;
                        color:#7e22ce;
                    "
                >
                    AI Insights
                </strong>
                <small>
                    Convert available signals into
                    practical recommendations.
                </small>
            </div>

        </div>


        <div
            style="
                padding:20px;
                border-radius:16px;
                background:#111827;
                color:#fff;
            "
        >

            <h3
                style="
                    margin-top:0;
                    color:#f9a8d4;
                "
            >
                Executive Summary
            </h3>

            <div
                style="
                    line-height:1.8;
                    color:#e5e7eb;
                "
            >
                ${
                    typeof result === "string"
                        ? aiEscape(result)
                        : aiEscape(
                            result.summary ||
                            result.executive_summary ||
                            "The weekly report has been generated from currently available website signals."
                        )
                }
            </div>

        </div>


        <details
            style="
                margin-top:20px;
                background:#f8fafc;
                border:1px solid #e2e8f0;
                border-radius:12px;
                padding:14px;
            "
        >

            <summary
                style="
                    cursor:pointer;
                    font-weight:700;
                "
            >
                View complete report data
            </summary>

            <pre
                style="
                    margin-top:14px;
                    white-space:pre-wrap;
                    word-break:break-word;
                    font-size:12px;
                    max-height:600px;
                    overflow:auto;
                "
            >${aiEscape(
                JSON.stringify(
                    data,
                    null,
                    2
                )
            )}</pre>

        </details>

    `;
}


/*
 * Main renderer.
 */
function renderAIResult(
    agentName,
    data,
    websiteUrl
) {

    const output =
        $("out");

    if (!output) {
        return;
    }

    if (
        agentName ===
        "seo_strategist"
    ) {

        output.innerHTML =
            renderSEOStrategy(
                data,
                websiteUrl
            );

        return;
    }


    if (
        agentName ===
        "seo_auditor"
    ) {

        output.innerHTML =
            renderSEOAudit(
                data,
                websiteUrl
            );

        return;
    }


    if (
        agentName ===
        "executive_report"
    ) {

        output.innerHTML =
            renderWeeklyReport(
                data,
                websiteUrl
            );

        return;
    }


    /*
     * Fallback for future AI agents.
     */
    output.innerHTML = `
        <div
            style="
                padding:20px;
                background:#f8fafc;
                border-radius:16px;
            "
        >

            <h3>
                AI Result
            </h3>

            <pre
                style="
                    white-space:pre-wrap;
                    word-break:break-word;
                "
            >${aiEscape(
                JSON.stringify(
                    data,
                    null,
                    2
                )
            )}</pre>

        </div>
    `;
}


/*
 * Execute AI agent.
 */
async function agent(
    agentName,
    task,
    provider = "gemini"
) {

    if (!currentSites[0]) {

        alert(
            "Add a website first"
        );

        return;
    }


    const websiteUrl =
        getCurrentWebsiteUrl();


    $("out").innerHTML = `

        <div
            style="
                padding:30px;
                text-align:center;
                border-radius:18px;
                background:
                    linear-gradient(
                        135deg,
                        #eef2ff,
                        #ecfeff,
                        #f0fdf4
                    );
            "
        >

            <div
                style="
                    font-size:42px;
                    animation:
                        aiPulse 1.2s infinite;
                "
            >
                🤖
            </div>

            <h3
                style="
                    margin:12px 0 5px;
                "
            >
                AI is working…
            </h3>

            <p
                style="
                    color:#64748b;
                    margin:0;
                "
            >
                Preparing ${aiEscape(
                    agentName === "seo_auditor"
                        ? "SEO audit"
                        : agentName === "seo_strategist"
                            ? "SEO strategy"
                            : "weekly report"
                )}.
            </p>

        </div>

        <style>
            @keyframes aiPulse {
                0% {
                    transform:scale(1);
                    opacity:.65;
                }

                50% {
                    transform:scale(1.15);
                    opacity:1;
                }

                100% {
                    transform:scale(1);
                    opacity:.65;
                }
            }
        </style>
    `;


    try {

        const {
            data: {
                session:
                    currentSession
            }
        } =
            await sb.auth.getSession();


        if (!currentSession) {

            $("out").innerHTML = `
                <div
                    style="
                        padding:20px;
                        background:#fee2e2;
                        color:#991b1b;
                        border-radius:12px;
                    "
                >
                    You are not logged in.
                </div>
            `;

            return;
        }


        const response =
            await fetch(
                "/api/ai",
                {
                    method:
                        "POST",

                    headers: {

                        "Authorization":
                            `Bearer ${
                                currentSession.access_token
                            }`,

                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            agent:
                                agentName,

                            task,

                            provider,

                            website_id:
                                currentSites[0].id,

                            context: {

                                url:
                                    websiteUrl

                            }

                        })
                }
            );


        /*
         * Read as text first so server errors
         * can still be displayed.
         */
        const responseText =
            await response.text();


        let data;


        try {

            data =
                JSON.parse(
                    responseText
                );

        } catch {

            data = {

                error:
                    "Server returned a non-JSON response",

                http_status:
                    response.status,

                status_text:
                    response.statusText,

                response:
                    responseText

            };

        }


        if (!response.ok) {

            renderAIResult(
                agentName,
                data,
                websiteUrl
            );

            return;
        }


        /*
         * IMPORTANT:
         * Each AI agent now receives its own renderer.
         */
        renderAIResult(
            agentName,
            data,
            websiteUrl
        );


        /*
         * Refresh dashboard data after successful
         * AI operation.
         */
        await load();


    } catch (error) {

        console.error(
            "AI request error:",
            error
        );


        $("out").innerHTML = `

            <div
                style="
                    padding:22px;
                    border-radius:16px;
                    background:#fee2e2;
                    border:1px solid #fecaca;
                    color:#991b1b;
                "
            >

                <h3>
                    AI request failed
                </h3>

                <div>
                    ${aiEscape(
                        error?.message ||
                        String(error)
                    )}
                </div>

            </div>

        `;
    }
}


/* =========================
   AI BUTTONS
========================= */


/*
 * RUN AI AUDIT
 */
if ($("audit")) {

    $("audit").onclick =
        () =>
            agent(
                "seo_auditor",

                `
                Audit technical SEO, on-page SEO,
                content quality and observable performance.

                Return evidence-backed prioritized
                recommendations.

                Include:
                - SEO score
                - technical SEO
                - title and meta description
                - headings
                - images and ALT text
                - robots.txt
                - sitemap
                - structured data
                - HTTPS
                - performance signals
                - prioritized actions
                `,

                "gemini"
            );
}


/*
 * GENERATE SEO STRATEGY
 */
if ($("strategy")) {

    $("strategy").onclick =
        () =>
            agent(
                "seo_strategist",

                `
                Create a detailed 30-day SEO strategy.

                Include:

                1. Keyword themes
                2. Page opportunities
                3. Internal linking opportunities
                4. Content briefs
                5. Technical SEO actions
                6. AI search visibility opportunities
                7. Entity and topical authority opportunities
                8. Weekly implementation plan

                Clearly separate observed facts from
                recommendations and assumptions.

                The dashboard should visually present
                the website as being prepared for
                discovery across 25+ AI and search
                engines.
                `,

                "gemini"
            );
}


/*
 * GENERATE WEEKLY REPORT
 */
if ($("report")) {

    $("report").onclick =
        () =>
            agent(
                "executive_report",

                `
                Create a weekly executive website report.

                Include:

                1. Executive summary
                2. Current website signals
                3. SEO changes
                4. Content opportunities
                5. Technical issues
                6. AI visibility opportunities
                7. Recommended actions for the next 7 days

                Never invent traffic, ranking or revenue
                figures when those metrics are unavailable.
                `,

                "gemini"
            );
}

/* =========================
   BILLING
========================= */

/*
 * Paid checkout buttons are handled
 * by the Upgrade Modal below.
 */


/* =========================
   UPGRADE MODAL
========================= */

document
    .querySelectorAll(
        "#upgradeModal [data-plan]"
    )
    .forEach(
        button => {

            button.onclick =
                async () => {

                    const {
                        data: {
                            session:
                                currentSession
                        }
                    } =
                        await sb.auth.getSession();


                    if (!currentSession) {

                        alert(
                            "Please sign in first."
                        );

                        return;
                    }


                    const plan =
                        button.dataset.plan;


                    const billingCycle =
                        button.dataset.billing ||
                        "monthly";


                    button.disabled =
                        true;


                    button.textContent =
                        "Opening checkout…";


                    try {

                        const response =
                            await fetch(
                                "/api/checkout",
                                {

                                    method:
                                        "POST",

                                    headers: {

                                        "Authorization":
                                            `Bearer ${
                                                currentSession.access_token
                                            }`,

                                        "Content-Type":
                                            "application/json"

                                    },

                                    body:
                                        JSON.stringify({

                                            plan,

                                            billing_cycle:
                                                billingCycle

                                        })

                                }
                            );


                        const data =
                            await response.json();


                        if (
                            data?.checkout_url
                        ) {

                            window.location.href =
                                data.checkout_url;

                            return;
                        }


                        alert(
                            data?.message ||
                            "Checkout is not configured yet. Connect the Razorpay checkout endpoint before accepting payments."
                        );


                    } catch (error) {

                        alert(
                            error?.message ||
                            "Could not start checkout."
                        );


                    } finally {

                        button.disabled =
                            false;


                        button.textContent =
                            billingCycle === "yearly"
                                ? "Choose yearly"
                                : "Choose monthly";
                    }
                };
        }
    );


if ($("upgradeClose")) {

    $("upgradeClose")
        .addEventListener(
            "click",
            closeUpgrade
        );
}


if ($("upgradeModal")) {

    $("upgradeModal")
        .addEventListener(
            "click",
            event => {

                if (
                    event.target.id ===
                    "upgradeModal"
                ) {

                    closeUpgrade();
                }
            }
        );
}


/* =========================
   SUPPORT
========================= */

if ($("ticket")) {

    $("ticket").onclick =
        async () => {

            if (!session) {

                alert(
                    "Please sign in first."
                );

                return;
            }


            const {
                error
            } =
                await sb
                    .from("support_tickets")
                    .insert({

                        user_id:
                            session.user.id,

                        subject:
                            $("subject").value,

                        message:
                            $("support").value

                    });


            alert(
                error?.message ||
                "Ticket created"
            );
        };
}


/* =========================
   APPROVALS
========================= */

window.approve =
    async id => {

        await sb
            .from("approvals")
            .update({

                status:
                    "approved",

                approved_at:
                    new Date()
                        .toISOString()

            })
            .eq(
                "id",
                id
            )
            .eq(
                "user_id",
                session.user.id
            );


        await load();
    };


window.reject =
    async id => {

        await sb
            .from("approvals")
            .update({

                status:
                    "rejected"

            })
            .eq(
                "id",
                id
            )
            .eq(
                "user_id",
                session.user.id
            );


        await load();
    };




/* =========================
   AI OUTPUT STYLES
========================= */
(function injectAIOutputStyles() {
    if (document.getElementById("ai-output-styles")) return;
    const style = document.createElement("style");
    style.id = "ai-output-styles";
    style.textContent = `
        #out { white-space: normal !important; font-family: inherit; }
        .ai-report { display:grid; gap:18px; }
        .ai-report-header { display:flex; justify-content:space-between; gap:18px; align-items:flex-start; padding:20px; border:1px solid #e5e7eb; border-radius:16px; background:#fff; }
        .ai-kicker { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; opacity:.65; margin-bottom:5px; }
        .ai-report h3 { margin:0 0 7px; font-size:22px; }
        .ai-report a { color:#2563eb; word-break:break-all; }
        .ai-status { padding:7px 11px; border-radius:999px; font-size:12px; font-weight:700; white-space:nowrap; }
        .ai-status.success { background:#dcfce7; color:#166534; }
        .ai-status.error { background:#fee2e2; color:#991b1b; }
        .ai-top-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; }
        .ai-score-card,.ai-summary-card { border:1px solid #e5e7eb; border-radius:14px; padding:16px; background:#fff; }
        .ai-score-card span,.ai-summary-card span { display:block; font-size:12px; opacity:.65; margin-bottom:6px; }
        .ai-score-card strong { font-size:30px; }
        .ai-score-card small { font-size:14px; opacity:.55; }
        .ai-summary-card strong { font-size:18px; word-break:break-word; }
        .ai-section { padding:18px; border:1px solid #e5e7eb; border-radius:16px; background:#fff; }
        .ai-section h4 { margin:0 0 13px; font-size:16px; }
        .ai-bullets { margin:0; padding-left:20px; display:grid; gap:8px; }
        .ai-danger-section { border-color:#fecaca; background:#fffafa; }
        .ai-positive-section { border-color:#bbf7d0; background:#fafffb; }
        .ai-issues { display:grid; gap:10px; }
        .ai-issue { padding:14px; border:1px solid #e5e7eb; border-radius:12px; background:#fafafa; }
        .ai-issue-head { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:8px; }
        .ai-severity,.ai-priority { padding:3px 7px; border-radius:999px; font-size:11px; font-weight:700; background:#f3f4f6; }
        .ai-issue p { margin:6px 0 0; line-height:1.5; }
        .ai-metrics { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:9px; }
        .ai-metric { padding:10px 12px; border:1px solid #eee; border-radius:10px; background:#fafafa; display:flex; flex-direction:column; gap:4px; }
        .ai-metric span { font-size:11px; opacity:.6; text-transform:capitalize; }
        .ai-metric strong { word-break:break-word; }
        .ai-empty,.ai-null { opacity:.6; }
        .ai-raw { border:1px solid #e5e7eb; border-radius:14px; background:#f8fafc; padding:12px 14px; }
        .ai-raw summary { cursor:pointer; font-weight:700; }
        .ai-raw pre { margin:12px 0 0; max-height:500px; overflow:auto; white-space:pre-wrap; word-break:break-word; font-size:12px; }
        .ai-loading { display:flex; align-items:center; gap:10px; padding:20px; border:1px solid #e5e7eb; border-radius:14px; background:#fff; }
        .ai-spinner { width:16px; height:16px; border:2px solid #ddd; border-top-color:#2563eb; border-radius:50%; animation:aiSpin .8s linear infinite; }
        @keyframes aiSpin { to { transform:rotate(360deg); } }
        @media(max-width:650px) { .ai-report-header { flex-direction:column; } .ai-top-grid { grid-template-columns:1fr 1fr; } }
    `;
    document.head.appendChild(style);
})();

/* =========================
   START
========================= */

boot();