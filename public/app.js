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

/* =========================
   AUTH BUTTONS
========================= */

async function oauth(provider) {

    try {

        $("msg").textContent =
            "Connecting to " + provider + "...";

        const { error } =
            await sb.auth.signInWithOAuth({
                provider: provider,
                options: {
                    redirectTo:
                        window.location.origin + "/app/"
                }
            });

        if (error) {
            console.error("OAuth error:", error);
            $("msg").textContent = error.message;
        }

    } catch (error) {

        console.error("OAuth exception:", error);

        $("msg").textContent =
            error.message || "OAuth login failed.";
    }
}


/* =========================
   EMAIL + PASSWORD
========================= */

async function passwordLogin() {

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

    const button = $("passwordBtn");

    button.disabled = true;

    $("msg").textContent =
        "Signing in...";

    try {

        console.log("Starting password login:", email);

        const result =
            await sb.auth.signInWithPassword({
                email: email,
                password: password
            });

        console.log(
            "Supabase login response:",
            result
        );

        const data = result.data;
        const error = result.error;

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

        session = data.session;

        $("msg").textContent =
            "Signed in successfully.";

        paint();

    } catch (error) {

        console.error(
            "Password login exception:",
            error
        );

        $("msg").textContent =
            error.message ||
            "Sign in failed.";

    } finally {

        button.disabled = false;
    }
}


/* =========================
   EMAIL MAGIC LINK
========================= */

async function sendEmailLink() {

    const email =
        $("email").value.trim();

    if (!email) {

        $("msg").textContent =
            "Please enter your email.";

        return;
    }

    const button = $("emailBtn");

    button.disabled = true;

    $("msg").textContent =
        "Sending email link...";

    try {

        console.log(
            "Sending magic link:",
            email
        );

        const result =
            await sb.auth.signInWithOtp({
                email: email,

                options: {
                    emailRedirectTo:
                        window.location.origin +
                        "/app/"
                }
            });

        console.log(
            "Magic link response:",
            result
        );

        if (result.error) {

            console.error(
                "Magic link error:",
                result.error
            );

            $("msg").textContent =
                result.error.message;

            return;
        }

        $("msg").textContent =
            "Email link sent. Please check your inbox.";

    } catch (error) {

        console.error(
            "Magic link exception:",
            error
        );

        $("msg").textContent =
            error.message ||
            "Unable to send email link.";

    } finally {

        button.disabled = false;
    }
}


/* =========================
   PHONE OTP
========================= */

async function sendPhoneOtp() {

    const phone =
        $("phone").value.trim();

    if (!phone) {

        $("msg").textContent =
            "Please enter your phone number.";

        return;
    }

    const button = $("phoneBtn");

    button.disabled = true;

    $("msg").textContent =
        "Sending OTP...";

    try {

        console.log(
            "Sending phone OTP:",
            phone
        );

        const result =
            await sb.auth.signInWithOtp({
                phone: phone
            });

        console.log(
            "Phone OTP response:",
            result
        );

        if (result.error) {

            console.error(
                "Phone OTP error:",
                result.error
            );

            $("msg").textContent =
                result.error.message;

            return;
        }

        $("msg").textContent =
            "OTP sent. Please check your phone.";

    } catch (error) {

        console.error(
            "Phone OTP exception:",
            error
        );

        $("msg").textContent =
            error.message ||
            "Unable to send OTP.";

    } finally {

        button.disabled = false;
    }
}


/* =========================
   CONNECT BUTTONS
========================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        console.log(
            "Obsedian authentication initialized."
        );

        const passwordBtn =
            $("passwordBtn");

        const emailBtn =
            $("emailBtn");

        const phoneBtn =
            $("phoneBtn");

        const googleBtn =
            $("google");

        const githubBtn =
            $("github");


        if (passwordBtn) {
            passwordBtn.addEventListener(
                "click",
                passwordLogin
            );
        }

        if (emailBtn) {
            emailBtn.addEventListener(
                "click",
                sendEmailLink
            );
        }

        if (phoneBtn) {
            phoneBtn.addEventListener(
                "click",
                sendPhoneOtp
            );
        }

        if (googleBtn) {
            googleBtn.addEventListener(
                "click",
                function () {
                    oauth("google");
                }
            );
        }

        if (githubBtn) {
            githubBtn.addEventListener(
                "click",
                function () {
                    oauth("github");
                }
            );

        }

    }
);

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
                    <small>${esc(x[0])}</small><br>
                    <b>${esc(x[1])}</b>
                </div>`
        )
        .join("");


        $("sites").innerHTML =
            sites
                .map(
                    s =>
                        `<div class="item">
                            <b>${esc(s.name || s.url)}</b><br>
                            <small>${esc(s.url)}</small>
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

                        <strong>
                            ${esc(planName)}
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
                                    : esc(sub.status)
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


        /* =========================
           APPROVAL QUEUE
        ========================= */

        const approvalItems =
            apR.data || [];


        if (apR.error) {

            console.error(
                "Approval Queue error:",
                apR.error
            );


            $("approvals").innerHTML = `
                <div class="report-error">

                    <strong>
                        Could not load Approval Queue
                    </strong>

                    <div>
                        ${esc(
                            apR.error.message ||
                            "Unknown database error"
                        )}
                    </div>

                </div>
            `;


        } else if (!approvalItems.length) {

            $("approvals").innerHTML = `
                <div class="report-empty">
                    No pending approvals.
                </div>
            `;


        } else {

            $("approvals").innerHTML =

                approvalItems
                    .map(
                        item => {

                            return `
                                <div
                                    class="approval-item"
                                >

                                    <div
                                        class="approval-main"
                                    >

                                        <strong>
                                            ${esc(
                                                item.title ||
                                                "Pending approval"
                                            )}
                                        </strong>


                                        <div
                                            class="approval-description"
                                        >
                                            ${esc(
                                                item.description ||
                                                item.content ||
                                                "No description available."
                                            )}
                                        </div>


                                        <small>

                                            ${esc(
                                                item.category ||
                                                "General"
                                            )}

                                            ·

                                            ${esc(
                                                item.priority ||
                                                "normal"
                                            )}

                                        </small>

                                    </div>


                                    <div
                                        class="approval-actions"
                                    >

                                        <button
                                            class="approve-btn"
                                            type="button"
                                            data-id="${esc(item.id)}"
                                            onclick="approve('${esc(item.id)}')"
                                        >
                                            Approve
                                        </button>


                                        <button
                                            class="reject-btn"
                                            type="button"
                                            data-id="${esc(item.id)}"
                                            onclick="reject('${esc(item.id)}')"
                                        >
                                            Reject
                                        </button>

                                    </div>

                                </div>
                            `;
                        }
                    )
                    .join("")

                ||

                "<p>No pending approvals.</p>";
        }


    } catch (error) {

        console.error(
            "Dashboard load error:",
            error
        );


        if ($("approvals")) {

            $("approvals").innerHTML = `
                <div class="report-error">

                    <strong>
                        Dashboard loading error
                    </strong>

                    <div>
                        ${esc(
                            error.message ||
                            "Unknown error"
                        )}
                    </div>

                </div>
            `;
        }


    } finally {

        loading = false;

        if (
            typeof setLoading ===
            "function"
        ) {
            setLoading(false);
        }
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

    const audit =
        data?.audit ||
        {};

    const crawl =
        data?.crawl ||
        {};

    const summary =
        audit?.summary ||
        {};

    const metrics =
        audit?.detailed_metrics ||
        {};

    const technical =
        audit?.technical_seo ||
        [];

    const onPage =
        audit?.on_page_seo ||
        [];

    const content =
        audit?.content ||
        [];

    const actions =
        audit?.prioritized_actions ||
        [];

    const url =
        data?.url ||
        currentSites[0]?.url ||
        "";

    const score =
        Number(data?.score ?? 0);

    const criticalIssues =
        summary?.critical_issues ||
        [];

    const warnings =
        summary?.warnings ||
        [];

    const positiveSignals =
        summary?.positive_signals ||
        [];


    const totalIssues =
        criticalIssues.length +
        warnings.length;


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
                    crawl?.pages_crawled ??
                    crawl?.pages ??
                    1
                )}

                ${renderMetric(
                    "Issues found",
                    totalIssues,
                    totalIssues
                        ? "bad"
                        : "good"
                )}

                ${renderMetric(
                    "Response time",
                    crawl?.response_time_ms != null
                        ? `${crawl.response_time_ms} ms`
                        : "—"
                )}

                ${renderMetric(
                    "HTTP status",
                    crawl?.homepage_status ??
                    "—"
                )}

            </div>


            <section class="report-section">

                <h3>
                    Overall observations
                </h3>

                ${
                    renderList(
                        summary?.overall_observations ||
                        [],
                        "No observations available."
                    )
                }

            </section>


            <section class="report-section">

                <h3>
                    Critical issues
                </h3>

                ${
                    renderList(
                        criticalIssues,
                        "No critical issues detected."
                    )
                }

            </section>


            <section class="report-section">

                <h3>
                    Warnings
                </h3>

                ${
                    renderList(
                        warnings,
                        "No warnings detected."
                    )
                }

            </section>


            <section class="report-section">

                <h3>
                    Technical SEO
                </h3>

                ${
                    renderList(
                        technical,
                        "No technical SEO findings."
                    )
                }

            </section>


            <section class="report-section">

                <h3>
                    On-Page SEO
                </h3>

                ${
                    renderList(
                        onPage,
                        "No on-page SEO findings."
                    )
                }

            </section>


            <section class="report-section">

                <h3>
                    Content
                </h3>

                ${
                    renderList(
                        content,
                        "No content findings."
                    )
                }

            </section>


            <section class="report-section">

                <h3>
                    Priority Actions
                </h3>

                ${
                    renderList(
                        actions,
                        "No priority actions generated."
                    )
                }

            </section>


            <section class="report-section">

                <h3>
                    Positive Signals
                </h3>

                ${
                    renderList(
                        positiveSignals,
                        "No positive signals recorded."
                    )
                }

            </section>


            <section class="report-section">

                <h3>
                    Detailed Metrics
                </h3>

                <div class="report-detail-grid">

                    ${renderMetric(
                        "Title",
                        metrics.title ||
                        "Missing"
                    )}

                    ${renderMetric(
                        "Title length",
                        metrics.title_length ??
                        0
                    )}

                    ${renderMetric(
                        "Meta description",
                        metrics.meta_description
                            ? "Present"
                            : "Missing"
                    )}

                    ${renderMetric(
                        "Meta length",
                        metrics.meta_description_length ??
                        0
                    )}

                    ${renderMetric(
                        "H1 count",
                        metrics.h1_count ??
                        0
                    )}

                    ${renderMetric(
                        "H2 count",
                        metrics.h2_count ??
                        0
                    )}

                    ${renderMetric(
                        "H3 count",
                        metrics.h3_count ??
                        0
                    )}

                    ${renderMetric(
                        "Images",
                        metrics.image_count ??
                        0
                    )}

                    ${renderMetric(
                        "Missing ALT",
                        metrics.images_missing_alt ??
                        0
                    )}

                    ${renderMetric(
                        "Internal links",
                        metrics.internal_links ??
                        0
                    )}

                    ${renderMetric(
                        "Word count",
                        metrics.word_count ??
                        0
                    )}

                    ${renderMetric(
                        "HTTPS",
                        metrics.https
                            ? "Yes"
                            : "No"
                    )}

                    ${renderMetric(
                        "Viewport",
                        metrics.viewport
                            ? "Yes"
                            : "No"
                    )}

                    ${renderMetric(
                        "Charset",
                        metrics.charset
                            ? "Yes"
                            : "No"
                    )}

                    ${renderMetric(
                        "Noindex",
                        metrics.noindex
                            ? "Yes"
                            : "No"
                    )}

                    ${renderMetric(
                        "JSON-LD blocks",
                        metrics.structured_data_blocks ??
                        0
                    )}

                    ${renderMetric(
                        "robots.txt",
                        metrics.robots_exists
                            ? "Found"
                            : "Missing"
                    )}

                    ${renderMetric(
                        "sitemap.xml",
                        metrics.sitemap_exists
                            ? "Found"
                            : "Missing"
                    )}

                </div>

            </section>

        </div>

    `;
}


/* =========================
   STRATEGY REPORT
========================= */

function renderStrategyReport(data) {

    const audit =
        data?.audit ||
        {};

    const strategy =
        audit?.strategy ||
        {};

    const url =
        data?.url ||
        currentSites[0]?.url ||
        "";


    $("out").innerHTML = `

        <div class="report">

            <div class="report-hero">

                <div>

                    <div class="report-kicker">
                        YOUR URL SUBMITTED TO ·
                        25+ AI-AGENTS
                    </div>

                    <h2>
                        YOUR SEO Strategy CREATED AND SUBMITTED TO AI ENGINES
                    </h2>

                    <div class="report-url">
                        ${esc(url)}
                    </div>

                </div>

            </div>


            <section class="report-section">

                <h3>
                    Current Situation
                </h3>

                ${
                    renderList(
                        strategy.current_situation ||
                        []
                    )
                }

            </section>


            <div class="report-columns">

                <div>

                    <section class="report-section">

                        <h3>
                            Days 1–30
                        </h3>

                        ${
                            renderList(
                                strategy.days_30 ||
                                []
                            )
                        }

                    </section>

                </div>


                <div>

                    <section class="report-section">

                        <h3>
                            Days 31–60
                        </h3>

                        ${
                            renderList(
                                strategy.days_60 ||
                                []
                            )
                        }

                    </section>

                </div>


                <div>

                    <section class="report-section">

                        <h3>
                            Days 61–90
                        </h3>

                        ${
                            renderList(
                                strategy.days_90 ||
                                []
                            )
                        }

                    </section>

                </div>

            </div>


            <section class="report-section">

                <h3>
                    Content Strategy
                </h3>

                ${
                    renderList(
                        strategy.content_strategy ||
                        []
                    )
                }

            </section>


            <section class="report-section">

                <h3>
                    Priority Actions
                </h3>

                ${
                    renderList(
                        strategy.priority_actions ||
                        []
                    )
                }

            </section>

        </div>

    `;
}


/* =========================
   WEEKLY REPORT
========================= */

function renderWeeklyReport(data) {

    const audit =
        data?.audit ||
        {};

    const weekly =
        audit?.weekly_report ||
        {};

    const url =
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
                    weekly.http_status ??
                    "—"
                )}

                ${renderMetric(
                    "Response time",
                    weekly.response_time_ms != null
                        ? `${weekly.response_time_ms} ms`
                        : "—"
                )}

                ${renderMetric(
                    "Open issues",
                    weekly.open_issues ??
                    0
                )}

                ${renderMetric(
                    "Health",
                    weekly.current_health?.[0] ||
                    "Available"
                )}

            </div>


            <section class="report-section">

                <h3>
                    Current Health
                </h3>

                ${
                    renderList(
                        weekly.current_health ||
                        []
                    )
                }

            </section>


            <section class="report-section">

                <h3>
                    Issues to Watch
                </h3>

                ${
                    renderList(
                        weekly.issues_to_watch ||
                        [],
                        "No issues currently identified."
                    )
                }

            </section>


            <section class="report-section">

                <h3>
                    Next Actions
                </h3>

                ${
                    renderList(
                        weekly.next_actions ||
                        [],
                        "No immediate actions identified."
                    )
                }

            </section>

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