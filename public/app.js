const C = window.OBSEDIAN_CONFIG || {};

const sb = supabase.createClient(
    C.SUPABASE_URL,
    C.SUPABASE_PUBLISHABLE_KEY,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    }
);

const $ = x => document.getElementById(x);

let session = null;
let currentSites = [];
let loading = false;


/* =========================
   AUTH / BOOT
========================= */

async function boot() {

    const {
        data: { session: currentSession }
    } = await sb.auth.getSession();

    session = currentSession;

    paint();

    sb.auth.onAuthStateChange(async (event, newSession) => {

        console.log("Auth event:", event);

        session = newSession;

        paint();

        if (event === "SIGNED_IN" && session) {
            await load();
        }
    });
}


/* =========================
   PAINT LOGIN / DASHBOARD
========================= */

function paint() {

    const loggedIn = !!session;

    $("login").classList.toggle("hidden", loggedIn);
    $("dash").classList.toggle("hidden", !loggedIn);

    if (loggedIn && !loading) {
        load();
    }
}


/* =========================
   GOOGLE / GITHUB
========================= */

async function oauth(provider) {

    const { error } = await sb.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: `${window.location.origin}/app/`
        }
    });

    if (error) {
        $("msg").textContent = error.message;
    }
}


$("google").onclick = () => oauth("google");
$("github").onclick = () => oauth("github");


/* =========================
   EMAIL + PASSWORD LOGIN
========================= */

$("passwordBtn").onclick = async () => {

    const email = $("email").value.trim();
    const password = $("password").value;

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

    $("passwordBtn").disabled = true;

    $("msg").textContent =
        "Signing in...";

    const { data, error } =
        await sb.auth.signInWithPassword({
            email,
            password
        });

    $("passwordBtn").disabled = false;

    if (error) {

        console.error(
            "Password login error:",
            error
        );

        $("msg").textContent =
            error.message;

        return;
    }

    session = data.session;

    $("msg").textContent =
        "Signed in successfully.";

    paint();
};


/* =========================
   EMAIL MAGIC LINK
========================= */

$("emailBtn").onclick = async () => {

    const email = $("email").value.trim();

    if (!email) {
        $("msg").textContent =
            "Please enter your email.";
        return;
    }

    $("emailBtn").disabled = true;

    $("msg").textContent =
        "Sending email link...";

    const { error } =
        await sb.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo:
                    `${window.location.origin}/app/`
            }
        });

    $("emailBtn").disabled = false;

    $("msg").textContent =
        error?.message ||
        "Email link sent. Please check your inbox.";
};


/* =========================
   PHONE OTP
========================= */

$("phoneBtn").onclick = async () => {

    const phone = $("phone").value.trim();

    if (!phone) {
        $("msg").textContent =
            "Please enter your phone number.";
        return;
    }

    $("phoneBtn").disabled = true;

    $("msg").textContent =
        "Sending OTP...";

    const { error } =
        await sb.auth.signInWithOtp({
            phone
        });

    $("phoneBtn").disabled = false;

    $("msg").textContent =
        error?.message ||
        "OTP sent.";
};


/* =========================
   LOGOUT
========================= */

$("logout").onclick = async () => {

    await sb.auth.signOut();

    session = null;
    currentSites = [];

    paint();
};


/* =========================
   PLAN / BILLING HELPERS
========================= */

function daysRemaining(endsAt) {

    if (!endsAt) return null;

    const ms =
        new Date(endsAt).getTime() -
        Date.now();

    return Math.max(
        0,
        Math.ceil(ms / 86400000)
    );
}


function isPlanExpired(sub) {

    if (!sub) return false;

    if (!sub.subscription_ends_at) {
        return false;
    }

    return (
        new Date(sub.subscription_ends_at) <=
        new Date()
    );
}


function openUpgrade() {

    const modal = $("upgradeModal");

    if (modal) {
        modal.classList.remove("hidden");
    }
}


function closeUpgrade() {

    const modal = $("upgradeModal");

    if (modal) {
        modal.classList.add("hidden");
    }
}


window.openUpgrade = openUpgrade;
window.closeUpgrade = closeUpgrade;


/* =========================
   LOAD DASHBOARD
========================= */

async function load() {

    if (!session || loading) {
        return;
    }

    loading = true;

    try {

        const u = session.user;

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
        ] = await Promise.all([

            sb
                .from("subscriptions")
                .select("*,plans(*)")
                .eq("user_id", u.id)
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                )
                .limit(1)
                .maybeSingle(),

            sb
                .from("websites")
                .select("*")
                .eq("user_id", u.id)
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                ),

            sb
                .from("approvals")
                .select("*")
                .eq("user_id", u.id)
                .order(
                    "created_at",
                    {
                        ascending: false
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


        const sub = subR.data;

        const sites =
            siteR.data || [];


        currentSites = sites;


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
                            <small>${s.url}</small>
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


        $("billing").innerHTML = sub
            ? `
                <div class="billing-summary">

                    <div>
                        <strong>${planName}</strong>

                        <span class="billing-status ${
                            expired
                                ? "expired"
                                : "active"
                        }">
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
                                        ${remainingDays}
                                        days remaining
                                    </b>

                                    <span>
                                        Free plan ·
                                        45-day trial
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
            : `
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

                            ${a.description || ""}

                            <br>

                            <small>
                                ${a.status}
                                ·
                                ${a.risk_level}
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

$("add").onclick = async () => {

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
            new URL(url).origin;

    } catch {

        alert(
            "Please enter a valid URL, for example https://example.com"
        );

        return;
    }


    const { error } =
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
                    new Date().toISOString()

            });


    if (error) {

        alert(error.message);

    } else {

        $("url").value = "";

        $("name").value = "";

        await load();
    }
};


/* =========================
   AI REPORT HELPERS
========================= */

function esc(value) {

    return String(value ?? "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


function severityClass(value) {

    return `report-${String(
        value || "info"
    ).toLowerCase()}`;
}


function renderList(
    items,
    empty = "No items found."
) {

    if (
        !Array.isArray(items) ||
        !items.length
    ) {

        return `
            <div class="report-empty">
                ${esc(empty)}
            </div>
        `;
    }


    return `
        <div class="report-list">

            ${
                items
                    .map(
                        (
                            item,
                            index
                        ) => {

                            if (
                                typeof item ===
                                "string"
                            ) {

                                return `
                                    <div class="report-row">

                                        <span
                                            class="report-index"
                                        >
                                            ${index + 1}
                                        </span>

                                        <div>
                                            ${esc(item)}
                                        </div>

                                    </div>
                                `;
                            }


                            const severity =
                                item.severity ||
                                item.priority ||
                                item.impact ||
                                "info";


                            const title =
                                item.title ||
                                item.name ||
                                item.action ||
                                item.issue ||
                                "Recommendation";


                            const description =
                                item.description ||
                                item.details ||
                                item.reason ||
                                item.evidence ||
                                "";


                            return `
                                <div class="report-row">

                                    <span
                                        class="report-index"
                                    >
                                        ${index + 1}
                                    </span>

                                    <div>

                                        <div
                                            class="report-row-title"
                                        >

                                            ${esc(title)}

                                            <span
                                                class="report-badge ${severityClass(
                                                    severity
                                                )}"
                                            >
                                                ${esc(
                                                    severity
                                                )}
                                            </span>

                                        </div>

                                        ${
                                            description
                                                ? `
                                                    <div
                                                        class="report-muted"
                                                    >
                                                        ${esc(
                                                            description
                                                        )}
                                                    </div>
                                                `
                                                : ""
                                        }

                                    </div>

                                </div>
                            `;
                        }
                    )
                    .join("")
            }

        </div>
    `;
}


function renderMetric(
    label,
    value,
    state = ""
) {

    return `
        <div
            class="report-metric ${
                state
                    ? `metric-${state}`
                    : ""
            }"
        >

            <small>
                ${esc(label)}
            </small>

            <strong>
                ${esc(value)}
            </strong>

        </div>
    `;
}


/* =========================
   AUDIT REPORT
========================= */

function renderAuditReport(data) {

    const result =
        data?.result ||
        data?.audit ||
        data ||
        {};


    const metrics =
        result.metrics ||
        {};


    const issues =
        result.issues ||
        result.recommendations ||
        [];


    const recommendations =
        result.recommendations ||
        [];


    const url =
        result.url ||
        data?.url ||
        currentSites[0]?.url ||
        "";


    const score =
        Number(
            result.score ??
            data?.score ??
            0
        );


    const issueCount =
        Array.isArray(issues)
            ? issues.length
            : 0;


    $("out").innerHTML = `

        <div class="report">

            <div class="report-hero">

                <div>

                    <div class="report-kicker">
                        SEO AUDIT ·
                        RULE-BASED ENGINE
                    </div>

                    <h2>
                        Website SEO Audit
                    </h2>

                    <div class="report-url">
                        ${esc(url)}
                    </div>

                </div>


                <div class="score-ring">

                    <strong>
                        ${esc(score)}
                    </strong>

                    <span>
                        / 100
                    </span>

                </div>

            </div>


            <div class="report-metrics">

                ${renderMetric(
                    "Pages crawled",
                    metrics.pages_crawled ??
                    metrics.pages ??
                    "—"
                )}

                ${renderMetric(
                    "Issues found",
                    issueCount,
                    issueCount
                        ? "bad"
                        : "good"
                )}

                ${renderMetric(
                    "Response time",
                    metrics.response_ms != null
                        ? `${metrics.response_ms} ms`
                        : "—"
                )}

                ${renderMetric(
                    "HTTP status",
                    metrics.status_code ??
                    "—"
                )}

            </div>


            <section
                class="report-section"
            >

                <h3>
                    Audit findings
                </h3>

                ${
                    renderList(
                        issues,
                        "No SEO issues were detected from the available crawl signals."
                    )
                }

            </section>


            <section
                class="report-section"
            >

                <h3>
                    Priority recommendations
                </h3>

                ${
                    renderList(
                        recommendations,
                        "No additional recommendations were generated."
                    )
                }

            </section>


            ${
                result.note
                    ? `
                        <div class="report-note">
                            ${esc(
                                result.note
                            )}
                        </div>
                    `
                    : ""
            }

        </div>
    `;
}


/* =========================
   STRATEGY REPORT
========================= */

function renderStrategyReport(data) {

    const result =
        data?.result ||
        data?.strategy ||
        data ||
        {};


    const url =
        result.url ||
        data?.url ||
        currentSites[0]?.url ||
        "";


    const renderBlock = (
        title,
        value
    ) => {

        const items =
            Array.isArray(value)
                ? value
                : [value];


        return `

            <section
                class="report-section"
            >

                <h3>
                    ${esc(title)}
                </h3>

                ${
                    renderList(
                        items.filter(Boolean)
                    )
                }

            </section>
        `;
    };


    $("out").innerHTML = `

        <div class="report">

            <div class="report-hero">

                <div>

                    <div class="report-kicker">
                        SEO STRATEGIST ·
                        RULE-BASED ENGINE
                    </div>

                    <h2>
                        30 / 60 / 90 Day SEO Strategy
                    </h2>

                    <div class="report-url">
                        ${esc(url)}
                    </div>

                </div>

            </div>


            ${
                renderBlock(
                    "Current situation",
                    result.current_situation
                )
            }


            <div class="report-columns">

                <div>
                    ${
                        renderBlock(
                            "Days 1–30",
                            result.days_30
                        )
                    }
                </div>

                <div>
                    ${
                        renderBlock(
                            "Days 31–60",
                            result.days_60
                        )
                    }
                </div>

                <div>
                    ${
                        renderBlock(
                            "Days 61–90",
                            result.days_90
                        )
                    }
                </div>

            </div>


            ${
                renderBlock(
                    "Content strategy",
                    result.content_strategy
                )
            }


            ${
                renderBlock(
                    "Priority actions",
                    result.priority_actions
                )
            }

        </div>
    `;
}


/* =========================
   WEEKLY REPORT
========================= */

function renderWeeklyReport(data) {

    const result =
        data?.result ||
        data?.report ||
        data ||
        {};


    const url =
        result.url ||
        data?.url ||
        currentSites[0]?.url ||
        "";


    $("out").innerHTML = `

        <div class="report">

            <div class="report-hero">

                <div>

                    <div class="report-kicker">
                        WEEKLY REPORT ·
                        RULE-BASED ENGINE
                    </div>

                    <h2>
                        Weekly SEO Health Report
                    </h2>

                    <div class="report-url">
                        ${esc(url)}
                    </div>

                </div>

            </div>


            <div class="report-metrics">

                ${renderMetric(
                    "HTTP status",
                    result.http_status ??
                    "—"
                )}

                ${renderMetric(
                    "Response time",
                    result.response_time_ms != null
                        ? `${result.response_time_ms} ms`
                        : "—"
                )}

                ${renderMetric(
                    "Open issues",
                    result.open_issues ??
                    "—"
                )}

                ${renderMetric(
                    "Health",
                    result.health ??
                    "—"
                )}

            </div>


            <section
                class="report-section"
            >

                <h3>
                    Issues to watch
                </h3>

                ${
                    renderList(
                        result.issues_to_watch
                    )
                }

            </section>


            <section
                class="report-section"
            >

                <h3>
                    Next actions
                </h3>

                ${
                    renderList(
                        result.next_actions
                    )
                }

            </section>


            ${
                result.note
                    ? `
                        <div class="report-note">
                            ${esc(
                                result.note
                            )}
                        </div>
                    `
                    : ""
            }

        </div>
    `;
}


/* =========================
   REPORT ROUTER
========================= */

function renderAgentReport(
    agentName,
    data
) {

    if (
        agentName ===
        "seo_auditor"
    ) {

        renderAuditReport(data);

    } else if (
        agentName ===
        "seo_strategist"
    ) {

        renderStrategyReport(data);

    } else {

        renderWeeklyReport(data);
    }
}


/* =========================
   AI AGENTS
========================= */

async function agent(
    agentName,
    task = ""
) {

    if (!currentSites[0]) {

        alert(
            "Add a website first"
        );

        return;
    }


    $("out").innerHTML = `

        <div class="report-loading">

            <div class="loader"></div>

            <strong>
                Analyzing
                ${esc(
                    currentSites[0].url
                )}…
            </strong>

            <span>
                Running the rule-based SEO
                engine and preparing your report.
            </span>

        </div>

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

                <div class="report-error">

                    You are not logged in.

                </div>

            `;

            return;
        }


        const response =
            await fetch(
                "/api/ai",
                {
                    method: "POST",

                    headers: {

                        "Authorization":
                            `Bearer ${currentSession.access_token}`,

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            agent:
                                agentName,

                            task,

                            provider:
                                "rule_based",

                            website_id:
                                currentSites[0].id,

                            context: {

                                url:
                                    currentSites[0].url

                            }

                        })
                }
            );


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


        if (
            !response.ok ||
            data?.error
        ) {

            $("out").innerHTML = `

                <div class="report-error">

                    <strong>
                        ${
                            esc(
                                data?.error ||
                                "Report generation failed"
                            )
                        }
                    </strong>

                    ${
                        data?.details
                            ? `
                                <div>
                                    ${esc(
                                        data.details
                                    )}
                                </div>
                            `
                            : ""
                    }

                </div>

            `;

            return;
        }


        renderAgentReport(
            agentName,
            data
        );


        await load();


    } catch (error) {

        console.error(
            "AI request error:",
            error
        );


        $("out").innerHTML = `

            <div class="report-error">

                <strong>
                    Report request failed
                </strong>

                <div>
                    ${esc(
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

$("audit").onclick = () =>
    agent(
        "seo_auditor",
        "Run the complete rule-based SEO audit."
    );


$("strategy").onclick = () =>
    agent(
        "seo_strategist",
        "Generate a 30/60/90 day SEO strategy from current crawl evidence."
    );


$("report").onclick = () =>
    agent(
        "weekly_report",
        "Generate a weekly SEO health report from current crawl evidence."
    );


/* =========================
   BILLING
========================= */

// Paid checkout buttons are handled
// by the Upgrade Modal below.


/* =========================
   UPGRADE MODAL
========================= */

document
    .querySelectorAll(
        "#upgradeModal [data-plan]"
    )
    .forEach(button => {

        button.onclick = async () => {

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


            button.disabled = true;


            button.textContent =
                "Opening checkout…";


            try {

                const response =
                    await fetch(
                        "/api/checkout",
                        {
                            method: "POST",

                            headers: {

                                Authorization:
                                    `Bearer ${currentSession.access_token}`,

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
                    billingCycle ===
                    "yearly"

                        ? "Choose yearly"

                        : "Choose monthly";
            }
        };
    });


$("upgradeClose")
    ?.addEventListener(
        "click",
        closeUpgrade
    );


$("upgradeModal")
    ?.addEventListener(
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


/* =========================
   SUPPORT
========================= */

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
        } = await sb
            .from(
                "support_tickets"
            )
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
                    new Date().toISOString()

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
   START
========================= */

boot();