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

async function agent(
    agent,
    task,
    provider = "gemini"
) {

    if (!currentSites[0]) {

        alert(
            "Add a website first"
        );

        return;
    }


    aiShowLoading();


    try {

        const {
            data: {
                session:
                    currentSession
            }
        } =
            await sb.auth.getSession();


        if (!currentSession) {

            $("out").textContent =
                JSON.stringify(
                    {
                        error:
                            "You are not logged in."
                    },
                    null,
                    2
                );

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

                            agent,

                            task,

                            provider,

                            website_id:
                                currentSites[0].id,

                            context: {

                                url:
                                    currentSites[0].url

                            }

                        })

                }
            );


        /*
         * Read the response as TEXT first.
         *
         * This allows us to display useful
         * Cloudflare/server errors even when
         * the server does not return JSON.
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


        aiRenderResult(data);


        if (response.ok) {

            await load();
        }


    } catch (error) {

        console.error(
            "AI request error:",
            error
        );


        $("out").textContent =
            JSON.stringify(
                {

                    error:
                        "AI request failed",

                    details:
                        error?.message ||
                        String(error)

                },
                null,
                2
            );
    }
}


/* =========================
   AI BUTTONS
========================= */

if ($("audit")) {

    $("audit").onclick =
        () =>
            agent(
                "seo_auditor",

                "Audit technical SEO, on-page SEO, content quality and observable performance. Return evidence-backed prioritized recommendations.",

                "gemini"
            );
}


if ($("strategy")) {

    $("strategy").onclick =
        () =>
            agent(
                "seo_strategist",

                "Create a 30-day SEO strategy with keyword themes, page opportunities, internal linking and content briefs. Mark assumptions.",

                "gemini"
            );
}


if ($("report")) {

    $("report").onclick =
        () =>
            agent(
                "executive_report",

                "Create a weekly executive report template based on currently available website signals. Never invent traffic or rankings.",

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