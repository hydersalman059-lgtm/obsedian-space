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


    $("out").textContent =
        "AI agent running…";


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


        $("out").textContent =
            JSON.stringify(
                data,
                null,
                2
            );


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
   START
========================= */

boot();