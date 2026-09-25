
/* =========================================================
   OBSEDIAN.SPACE
   ADMIN PANEL
   Complete Admin Frontend
========================================================= */

"use strict";

/* =========================================================
   SUPABASE
========================================================= */

const sb = supabase.createClient(
    window.OBSEDIAN_CONFIG.SUPABASE_URL,
    window.OBSEDIAN_CONFIG.SUPABASE_PUBLISHABLE_KEY
);


/* =========================================================
   HELPERS
========================================================= */

const $ = (id) => document.getElementById(id);

let currentSection = "dashboard";
let currentRequest = 0;


/* =========================================================
   AUTH SESSION
========================================================= */

async function getSession() {

    try {

        const {
            data,
            error
        } = await sb.auth.getSession();

        if (error) {

            console.error(
                "Supabase session error:",
                error
            );

            redirectToLogin();

            return null;
        }

        const session =
            data?.session || null;

        if (!session) {

            redirectToLogin();

            return null;
        }

        return session;

    } catch (error) {

        console.error(
            "Session exception:",
            error
        );

        redirectToLogin();

        return null;
    }
}


/* =========================================================
   LOGIN REDIRECT
========================================================= */

function redirectToLogin() {

    try {

        sessionStorage.setItem(
            "obsedian_admin_login",
            "1"
        );

    } catch (error) {
        console.warn(error);
    }

    const loginUrl =
        "/app/?redirect=/admin/";

    console.log(
        "No admin session. Redirecting to:",
        loginUrl
    );

    window.location.replace(
        loginUrl
    );
}


/* =========================================================
   ADMIN EDGE FUNCTION API
========================================================= */

async function api(
    section,
    params = {}
) {

    const session =
        await getSession();

    if (!session) {
        return null;
    }

    const supabaseUrl =
        window.OBSEDIAN_CONFIG.SUPABASE_URL;

    const publishableKey =
        window.OBSEDIAN_CONFIG
            .SUPABASE_PUBLISHABLE_KEY;

    const query =
        new URLSearchParams({
            section,
            ...params
        });

    const endpoint =
        `${supabaseUrl}/functions/v1/admin?${query.toString()}`;

    console.log(
        "Admin API request:",
        endpoint
    );

    let response;

    try {

        response =
            await fetch(
                endpoint,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${session.access_token}`,

                        "apikey":
                            publishableKey,

                        "Content-Type":
                            "application/json"
                    }
                }
            );

    } catch (error) {

        console.error(
            "Admin API network error:",
            error
        );

        throw new Error(
            "Unable to connect to the Admin server."
        );
    }

    const raw =
        await response.text();

    console.log(
        "Admin API status:",
        response.status
    );

    console.log(
        "Admin API response:",
        raw
    );

    let data = null;

    try {

        data =
            raw
                ? JSON.parse(raw)
                : null;

    } catch (error) {

        console.error(
            "Admin API returned non-JSON:",
            raw
        );

        throw new Error(
            `Admin server returned an invalid response (HTTP ${response.status}).`
        );
    }

    if (!response.ok) {

        const message =
            data?.error ||
            data?.message ||
            `Admin request failed with HTTP ${response.status}.`;

        throw new Error(
            message
        );
    }

    if (
        data &&
        data.error
    ) {

        throw new Error(
            data.error
        );
    }

    return data;
}


/* =========================================================
   GENERIC LOADING
========================================================= */

function showLoading(
    title = "Loading..."
) {

    $("content").innerHTML = `
        <div class="card">
            <h2>${escapeHtml(title)}</h2>

            <p>
                Please wait while the requested
                admin data is being loaded.
            </p>
        </div>
    `;
}


/* =========================================================
   GENERIC ERROR
========================================================= */

function showError(
    error,
    section
) {

    const message =
        error?.message ||
        "Unable to load this section.";

    $("content").innerHTML = `
        <div class="card">

            <h2>
                Error
            </h2>

            <p>
                ${escapeHtml(message)}
            </p>

            <button
                type="button"
                id="retrySection"
            >
                Retry
            </button>

        </div>
    `;

    const retry =
        $("retrySection");

    if (retry) {

        retry.addEventListener(
            "click",
            () => loadSection(section)
        );
    }
}


/* =========================================================
   DASHBOARD
========================================================= */

async function loadDashboard() {

    $("pageTitle").textContent =
        "Admin Dashboard";

    showLoading(
        "Loading dashboard..."
    );

    const data =
        await api(
            "dashboard"
        );

    const metrics =
        data?.metrics || {};

    const metricEntries =
        Object.entries(metrics);

    $("content").innerHTML = `

        <div class="stats">

            ${
                metricEntries.length
                    ? metricEntries
                        .map(
                            ([key, value]) => `
                                <div class="stat">

                                    <small>
                                        ${escapeHtml(
                                            formatLabel(key)
                                        )}
                                    </small>

                                    <br>

                                    <b>
                                        ${escapeHtml(
                                            String(
                                                value ?? 0
                                            )
                                        )}
                                    </b>

                                </div>
                            `
                        )
                        .join("")
                    :
                        `
                            <div class="card">
                                <p>
                                    No dashboard metrics available.
                                </p>
                            </div>
                        `
            }

        </div>


        <div class="card">

            <h2>
                Recent Audit Logs
            </h2>

            <pre id="logs">${escapeHtml(
                JSON.stringify(
                    data?.logs || [],
                    null,
                    2
                )
            )}</pre>

        </div>
    `;
}


/* =========================================================
   USERS
========================================================= */

async function loadUsers() {

    $("pageTitle").textContent =
        "Users";

    $("content").innerHTML = `

        <div class="card">

            <input
                id="userSearch"
                class="search-box"
                placeholder="Search name, email, phone, plan..."
                autocomplete="off"
            >

        </div>

        <div class="card">

            <div id="usersTable">
                Loading users...
            </div>

        </div>
    `;

    const searchInput =
        $("userSearch");

    let timer;

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            () => {

                clearTimeout(timer);

                timer =
                    setTimeout(
                        () => refreshUsers(),
                        300
                    );
            }
        );
    }

    await refreshUsers();
}


/* =========================================================
   REFRESH USERS
========================================================= */

async function refreshUsers() {

    const search =
        $("userSearch")?.value || "";

    const data =
        await api(
            "users",
            {
                search
            }
        );

    renderUsers(
        data?.users || []
    );
}


/* =========================================================
   RENDER USERS
========================================================= */

function renderUsers(
    users
) {

    if (!users.length) {

        $("usersTable").innerHTML = `
            <div class="empty">
                No users found.
            </div>
        `;

        return;
    }

    $("usersTable").innerHTML = `

        <div class="admin-table-wrapper">

            <table class="admin-table">

                <thead>

                    <tr>
                        <th>User</th>
                        <th>Role</th>
                        <th>Plan</th>
                        <th>Status</th>
                        <th>Websites</th>
                        <th>AI Runs</th>
                        <th>Expiry</th>
                        <th>Registered</th>
                    </tr>

                </thead>

                <tbody>

                    ${users
                        .map(
                            user => `

                                <tr>

                                    <td>

                                        <strong>
                                            ${escapeHtml(
                                                user.full_name ||
                                                "Unnamed User"
                                            )}
                                        </strong>

                                        <br>

                                        <small>
                                            ${escapeHtml(
                                                user.email ||
                                                "No email"
                                            )}
                                        </small>

                                        ${
                                            user.phone
                                                ? `
                                                    <br>
                                                    <small>
                                                        ${escapeHtml(
                                                            user.phone
                                                        )}
                                                    </small>
                                                `
                                                : ""
                                        }

                                    </td>


                                    <td>
                                        <span class="badge">
                                            ${escapeHtml(
                                                user.role ||
                                                "user"
                                            )}
                                        </span>
                                    </td>


                                    <td>
                                        ${escapeHtml(
                                            user.plan_id ||
                                            "free"
                                        )}
                                    </td>


                                    <td>
                                        <span class="badge">
                                            ${escapeHtml(
                                                user.subscription_status ||
                                                "none"
                                            )}
                                        </span>
                                    </td>


                                    <td>
                                        ${escapeHtml(
                                            String(
                                                user.websites ??
                                                0
                                            )
                                        )}
                                    </td>


                                    <td>
                                        ${escapeHtml(
                                            String(
                                                user.ai_runs ??
                                                0
                                            )
                                        )}
                                    </td>


                                    <td>
                                        ${formatDate(
                                            user.subscription_ends_at
                                        )}
                                    </td>


                                    <td>
                                        ${formatDate(
                                            user.created_at
                                        )}
                                    </td>

                                </tr>

                            `
                        )
                        .join("")}

                </tbody>

            </table>

        </div>
    `;
}


/* =========================================================
   WEBSITES
========================================================= */

async function loadWebsites() {

    $("pageTitle").textContent =
        "Websites";

    showLoading(
        "Loading websites..."
    );

    const data =
        await api(
            "websites"
        );

    const websites =
        data?.websites ||
        data?.data ||
        [];

    $("content").innerHTML = `

        <div class="card">

            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:12px;
                flex-wrap:wrap;
            ">

                <div>

                    <h2>
                        Websites
                    </h2>

                    <p>
                        ${websites.length}
                        website(s) registered.
                    </p>

                </div>

                <button
                    type="button"
                    id="refreshWebsites"
                >
                    Refresh
                </button>

            </div>

        </div>


        <div class="card">

            <div id="websitesTable">

                ${renderWebsitesHtml(websites)}

            </div>

        </div>
    `;

    $("refreshWebsites")?.addEventListener(
        "click",
        () => loadWebsites()
    );
}


/* =========================================================
   RENDER WEBSITES
========================================================= */

function renderWebsitesHtml(
    websites
) {

    if (!websites.length) {

        return `
            <div class="empty">
                No websites found.
            </div>
        `;
    }

    return `

        <div class="admin-table-wrapper">

            <table class="admin-table">

                <thead>

                    <tr>
                        <th>Website</th>
                        <th>User</th>
                        <th>Status</th>
                        <th>Frequency</th>
                        <th>Last Crawled</th>
                        <th>Next Crawl</th>
                        <th>Created</th>
                    </tr>

                </thead>

                <tbody>

                    ${websites
                        .map(
                            website => `

                                <tr>

                                    <td>

                                        <strong>
                                            ${escapeHtml(
                                                website.name ||
                                                website.normalized_url ||
                                                website.url ||
                                                "Unnamed"
                                            )}
                                        </strong>

                                        ${
                                            website.url
                                                ? `
                                                    <br>
                                                    <small>
                                                        ${escapeHtml(
                                                            website.url
                                                        )}
                                                    </small>
                                                `
                                                : ""
                                        }

                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            website.user_email ||
                                            website.user_id ||
                                            "—"
                                        )}
                                    </td>

                                    <td>
                                        <span class="badge">
                                            ${escapeHtml(
                                                website.status ||
                                                "unknown"
                                            )}
                                        </span>
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            website.crawl_frequency ||
                                            "—"
                                        )}
                                    </td>

                                    <td>
                                        ${formatDateTime(
                                            website.last_crawled_at
                                        )}
                                    </td>

                                    <td>
                                        ${formatDateTime(
                                            website.next_crawl_at
                                        )}
                                    </td>

                                    <td>
                                        ${formatDate(
                                            website.created_at
                                        )}
                                    </td>

                                </tr>
                            `
                        )
                        .join("")}

                </tbody>

            </table>

        </div>
    `;
}


/* =========================================================
   SUBSCRIPTIONS
========================================================= */

async function loadSubscriptions() {

    $("pageTitle").textContent =
        "Subscriptions";

    showLoading(
        "Loading subscriptions..."
    );

    const data =
        await api(
            "subscriptions"
        );

    const subscriptions =
        data?.subscriptions ||
        data?.data ||
        [];

    $("content").innerHTML = `

        <div class="card">

            <h2>
                Subscriptions
            </h2>

            <p>
                ${subscriptions.length}
                subscription record(s).
            </p>

        </div>

        <div class="card">

            <div id="subscriptionsTable">

                ${renderSubscriptionsHtml(
                    subscriptions
                )}

            </div>

        </div>
    `;
}


/* =========================================================
   RENDER SUBSCRIPTIONS
========================================================= */

function renderSubscriptionsHtml(
    subscriptions
) {

    if (!subscriptions.length) {

        return `
            <div class="empty">
                No subscriptions found.
            </div>
        `;
    }

    return `

        <div class="admin-table-wrapper">

            <table class="admin-table">

                <thead>

                    <tr>
                        <th>User</th>
                        <th>Plan</th>
                        <th>Billing</th>
                        <th>Status</th>
                        <th>Provider</th>
                        <th>Started</th>
                        <th>Ends</th>
                    </tr>

                </thead>

                <tbody>

                    ${subscriptions
                        .map(
                            subscription => `

                                <tr>

                                    <td>
                                        ${escapeHtml(
                                            subscription.user_email ||
                                            subscription.user_id ||
                                            "—"
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            subscription.plan_id ||
                                            "—"
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            subscription.billing_cycle ||
                                            "—"
                                        )}
                                    </td>

                                    <td>
                                        <span class="badge">
                                            ${escapeHtml(
                                                subscription.status ||
                                                "—"
                                            )}
                                        </span>
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            subscription.provider ||
                                            "—"
                                        )}
                                    </td>

                                    <td>
                                        ${formatDate(
                                            subscription.started_at
                                        )}
                                    </td>

                                    <td>
                                        ${formatDate(
                                            subscription.subscription_ends_at
                                        )}
                                    </td>

                                </tr>
                            `
                        )
                        .join("")}

                </tbody>

            </table>

        </div>
    `;
}


/* =========================================================
   PAYMENTS
========================================================= */

async function loadPayments() {

    $("pageTitle").textContent =
        "Payments";

    showLoading(
        "Loading payments..."
    );

    const data =
        await api(
            "payments"
        );

    const payments =
        data?.payments ||
        data?.data ||
        [];

    $("content").innerHTML = `

        <div class="card">

            <h2>
                Payments
            </h2>

            <p>
                ${payments.length}
                payment record(s).
            </p>

        </div>

        <div class="card">

            <div id="paymentsTable">

                ${renderPaymentsHtml(
                    payments
                )}

            </div>

        </div>
    `;
}


/* =========================================================
   RENDER PAYMENTS
========================================================= */

function renderPaymentsHtml(
    payments
) {

    if (!payments.length) {

        return `
            <div class="empty">
                No payment records found.
            </div>
        `;
    }

    return `

        <div class="admin-table-wrapper">

            <table class="admin-table">

                <thead>

                    <tr>
                        <th>User</th>
                        <th>Order ID</th>
                        <th>Payment ID</th>
                        <th>Amount</th>
                        <th>Currency</th>
                        <th>Status</th>
                        <th>Last Payment</th>
                    </tr>

                </thead>

                <tbody>

                    ${payments
                        .map(
                            payment => `

                                <tr>

                                    <td>
                                        ${escapeHtml(
                                            payment.user_email ||
                                            payment.user_id ||
                                            "—"
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            payment.razorpay_order_id ||
                                            "—"
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            payment.razorpay_payment_id ||
                                            "—"
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            payment.payment_amount ??
                                            "—"
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            payment.currency ||
                                            "INR"
                                        )}
                                    </td>

                                    <td>
                                        <span class="badge">
                                            ${escapeHtml(
                                                payment.status ||
                                                "—"
                                            )}
                                        </span>
                                    </td>

                                    <td>
                                        ${formatDateTime(
                                            payment.last_payment_at
                                        )}
                                    </td>

                                </tr>
                            `
                        )
                        .join("")}

                </tbody>

            </table>

        </div>
    `;
}


/* =========================================================
   AI OPERATIONS
========================================================= */

async function loadAI() {

    $("pageTitle").textContent =
        "AI Operations";

    showLoading(
        "Loading AI operations..."
    );

    const data =
        await api(
            "ai"
        );

    const runs =
        data?.ai_runs ||
        data?.runs ||
        data?.data ||
        [];

    $("content").innerHTML = `

        <div class="card">

            <h2>
                AI Operations
            </h2>

            <p>
                ${runs.length}
                AI run(s).
            </p>

        </div>

        <div class="card">

            <div id="aiTable">

                ${renderAIHtml(runs)}

            </div>

        </div>
    `;
}


/* =========================================================
   RENDER AI
========================================================= */

function renderAIHtml(
    runs
) {

    if (!runs.length) {

        return `
            <div class="empty">
                No AI runs found.
            </div>
        `;
    }

    return `

        <div class="admin-table-wrapper">

            <table class="admin-table">

                <thead>

                    <tr>
                        <th>Agent</th>
                        <th>Provider</th>
                        <th>Model</th>
                        <th>Status</th>
                        <th>Input Tokens</th>
                        <th>Output Tokens</th>
                        <th>Cost</th>
                        <th>Latency</th>
                        <th>Created</th>
                    </tr>

                </thead>

                <tbody>

                    ${runs
                        .map(
                            run => `

                                <tr>

                                    <td>
                                        ${escapeHtml(
                                            run.agent ||
                                            "—"
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            run.provider ||
                                            "—"
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            run.model ||
                                            "—"
                                        )}
                                    </td>

                                    <td>
                                        <span class="badge">
                                            ${escapeHtml(
                                                run.status ||
                                                "—"
                                            )}
                                        </span>
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            String(
                                                run.input_tokens ??
                                                0
                                            )
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            String(
                                                run.output_tokens ??
                                                0
                                            )
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            String(
                                                run.estimated_cost ??
                                                0
                                            )
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            String(
                                                run.latency_ms ??
                                                0
                                            )
                                        )} ms
                                    </td>

                                    <td>
                                        ${formatDateTime(
                                            run.created_at
                                        )}
                                    </td>

                                </tr>
                            `
                        )
                        .join("")}

                </tbody>

            </table>

        </div>
    `;
}


/* =========================================================
   APPROVALS
========================================================= */

async function loadApprovals() {

    $("pageTitle").textContent =
        "Approvals";

    showLoading(
        "Loading approvals..."
    );

    const data =
        await api(
            "approvals"
        );

    const approvals =
        data?.approvals ||
        data?.data ||
        [];

    $("content").innerHTML = `

        <div class="card">

            <h2>
                Approvals
            </h2>

            <p>
                ${approvals.length}
                approval record(s).
            </p>

        </div>

        <div class="card">

            ${renderApprovalsHtml(
                approvals
            )}

        </div>
    `;
}


/* =========================================================
   RENDER APPROVALS
========================================================= */

function renderApprovalsHtml(
    approvals
) {

    if (!approvals.length) {

        return `
            <div class="empty">
                No approval records found.
            </div>
        `;
    }

    return `

        <div class="admin-table-wrapper">

            <table class="admin-table">

                <thead>

                    <tr>
                        <th>Type</th>
                        <th>User</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Updated</th>
                    </tr>

                </thead>

                <tbody>

                    ${approvals
                        .map(
                            item => `

                                <tr>

                                    <td>
                                        ${escapeHtml(
                                            item.type ||
                                            item.kind ||
                                            item.action ||
                                            "—"
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            item.user_email ||
                                            item.user_id ||
                                            "—"
                                        )}
                                    </td>

                                    <td>
                                        <span class="badge">
                                            ${escapeHtml(
                                                item.status ||
                                                "—"
                                            )}
                                        </span>
                                    </td>

                                    <td>
                                        ${formatDateTime(
                                            item.created_at
                                        )}
                                    </td>

                                    <td>
                                        ${formatDateTime(
                                            item.updated_at
                                        )}
                                    </td>

                                </tr>
                            `
                        )
                        .join("")}

                </tbody>

            </table>

        </div>
    `;
}


/* =========================================================
   SUPPORT
========================================================= */

async function loadSupport() {

    $("pageTitle").textContent =
        "Support";

    showLoading(
        "Loading support tickets..."
    );

    const data =
        await api(
            "support"
        );

    const tickets =
        data?.support_tickets ||
        data?.tickets ||
        data?.data ||
        [];

    $("content").innerHTML = `

        <div class="card">

            <h2>
                Support Tickets
            </h2>

            <p>
                ${tickets.length}
                ticket(s).
            </p>

        </div>

        <div class="card">

            ${renderSupportHtml(
                tickets
            )}

        </div>
    `;
}


/* =========================================================
   RENDER SUPPORT
========================================================= */

function renderSupportHtml(
    tickets
) {

    if (!tickets.length) {

        return `
            <div class="empty">
                No support tickets found.
            </div>
        `;
    }

    return `

        <div class="admin-table-wrapper">

            <table class="admin-table">

                <thead>

                    <tr>
                        <th>Subject</th>
                        <th>User</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Created</th>
                        <th>Updated</th>
                    </tr>

                </thead>

                <tbody>

                    ${tickets
                        .map(
                            ticket => `

                                <tr>

                                    <td>
                                        ${escapeHtml(
                                            ticket.subject ||
                                            ticket.title ||
                                            "No subject"
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            ticket.user_email ||
                                            ticket.user_id ||
                                            "—"
                                        )}
                                    </td>

                                    <td>
                                        <span class="badge">
                                            ${escapeHtml(
                                                ticket.status ||
                                                "—"
                                            )}
                                        </span>
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            ticket.priority ||
                                            "—"
                                        )}
                                    </td>

                                    <td>
                                        ${formatDateTime(
                                            ticket.created_at
                                        )}
                                    </td>

                                    <td>
                                        ${formatDateTime(
                                            ticket.updated_at
                                        )}
                                    </td>

                                </tr>
                            `
                        )
                        .join("")}

                </tbody>

            </table>

        </div>
    `;
}


/* =========================================================
   AUDIT LOGS
========================================================= */

async function loadAudit() {

    $("pageTitle").textContent =
        "Audit Logs";

    showLoading(
        "Loading audit logs..."
    );

    const data =
        await api(
            "audit"
        );

    const logs =
        data?.logs ||
        data?.audit_logs ||
        data?.data ||
        [];

    $("content").innerHTML = `

        <div class="card">

            <h2>
                Audit Logs
            </h2>

            <p>
                Showing ${logs.length}
                record(s).
            </p>

        </div>

        <div class="card">

            ${renderAuditHtml(logs)}

        </div>
    `;
}


/* =========================================================
   RENDER AUDIT
========================================================= */

function renderAuditHtml(
    logs
) {

    if (!logs.length) {

        return `
            <div class="empty">
                No audit logs found.
            </div>
        `;
    }

    return `

        <div class="admin-table-wrapper">

            <table class="admin-table">

                <thead>

                    <tr>
                        <th>Event</th>
                        <th>Kind</th>
                        <th>User</th>
                        <th>Entity</th>
                        <th>Created</th>
                    </tr>

                </thead>

                <tbody>

                    ${logs
                        .map(
                            log => `

                                <tr>

                                    <td>
                                        ${escapeHtml(
                                            log.event ||
                                            log.action ||
                                            log.name ||
                                            "—"
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            log.kind ||
                                            log.type ||
                                            "—"
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            log.user_email ||
                                            log.user_id ||
                                            "—"
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            log.entity_id ||
                                            log.entity ||
                                            "—"
                                        )}
                                    </td>

                                    <td>
                                        ${formatDateTime(
                                            log.created_at
                                        )}
                                    </td>

                                </tr>
                            `
                        )
                        .join("")}

                </tbody>

            </table>

        </div>
    `;
}


/* =========================================================
   SETTINGS
========================================================= */

async function loadSettings() {

    $("pageTitle").textContent =
        "Settings";

    showLoading(
        "Loading settings..."
    );

    const data =
        await api(
            "settings"
        );

    const settings =
        data?.settings ||
        data?.data ||
        [];

    $("content").innerHTML = `

        <div class="card">

            <h2>
                System Settings
            </h2>

            <p>
                ${Array.isArray(settings)
                    ? settings.length
                    : Object.keys(settings || {}).length
                }
                setting record(s).
            </p>

        </div>

        <div class="card">

            ${renderSettingsHtml(settings)}

        </div>
    `;
}


/* =========================================================
   RENDER SETTINGS
========================================================= */

function renderSettingsHtml(
    settings
) {

    if (
        !settings ||
        (
            Array.isArray(settings) &&
            !settings.length
        ) ||
        (
            !Array.isArray(settings) &&
            !Object.keys(settings).length
        )
    ) {

        return `
            <div class="empty">
                No settings found.
            </div>
        `;
    }

    if (Array.isArray(settings)) {

        return `

            <div class="admin-table-wrapper">

                <table class="admin-table">

                    <thead>

                        <tr>
                            <th>Key</th>
                            <th>Value</th>
                            <th>Updated</th>
                        </tr>

                    </thead>

                    <tbody>

                        ${settings
                            .map(
                                setting => `

                                    <tr>

                                        <td>
                                            ${escapeHtml(
                                                setting.key ||
                                                setting.name ||
                                                setting.id ||
                                                "—"
                                            )}
                                        </td>

                                        <td>
                                            ${escapeHtml(
                                                formatSettingValue(
                                                    setting.value
                                                )
                                            )}
                                        </td>

                                        <td>
                                            ${formatDateTime(
                                                setting.updated_at
                                            )}
                                        </td>

                                    </tr>
                                `
                            )
                            .join("")}

                    </tbody>

                </table>

            </div>
        `;
    }

    return `

        <div class="admin-table-wrapper">

            <table class="admin-table">

                <thead>
                    <tr>
                        <th>Setting</th>
                        <th>Value</th>
                    </tr>
                </thead>

                <tbody>

                    ${Object.entries(settings)
                        .map(
                            ([key, value]) => `

                                <tr>

                                    <td>
                                        <strong>
                                            ${escapeHtml(
                                                key
                                            )}
                                        </strong>
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            formatSettingValue(
                                                value
                                            )
                                        )}
                                    </td>

                                </tr>
                            `
                        )
                        .join("")}

                </tbody>

            </table>

        </div>
    `;
}


/* =========================================================
   SECTION ROUTER
========================================================= */

async function loadSection(
    section
) {

    currentSection =
        section;

    currentRequest++;

    const requestId =
        currentRequest;

    document
        .querySelectorAll(
            ".admin-nav button"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.section === section
                );

            }
        );

    try {

        switch (section) {

            case "dashboard":

                await loadDashboard();

                break;


            case "users":

                await loadUsers();

                break;


            case "websites":

                await loadWebsites();

                break;


            case "subscriptions":

                await loadSubscriptions();

                break;


            case "payments":

                await loadPayments();

                break;


            case "ai":

                await loadAI();

                break;


            case "approvals":

                await loadApprovals();

                break;


            case "support":

                await loadSupport();

                break;


            case "audit":

                await loadAudit();

                break;


            case "settings":

                await loadSettings();

                break;


            default:

                throw new Error(
                    "Unknown admin section."
                );
        }

        if (
            requestId !== currentRequest
        ) {
            return;
        }

    } catch (error) {

        if (
            requestId !== currentRequest
        ) {
            return;
        }

        console.error(
            "Admin section error:",
            error
        );

        showError(
            error,
            section
        );
    }
}


/* =========================================================
   FORMAT LABEL
========================================================= */

function formatLabel(
    value
) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "_",
            " "
        )
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );
}


/* =========================================================
   FORMAT DATE
========================================================= */

function formatDate(
    value
) {

    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "—";
    }

    return date.toLocaleDateString(
        undefined,
        {
            year:
                "numeric",

            month:
                "short",

            day:
                "numeric"
        }
    );
}


/* =========================================================
   FORMAT DATE + TIME
========================================================= */

function formatDateTime(
    value
) {

    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "—";
    }

    return date.toLocaleString(
        undefined,
        {
            year:
                "numeric",

            month:
                "short",

            day:
                "numeric",

            hour:
                "2-digit",

            minute:
                "2-digit"
        }
    );
}


/* =========================================================
   FORMAT SETTING VALUE
========================================================= */

function formatSettingValue(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {
        return "—";
    }

    if (
        typeof value === "object"
    ) {

        try {

            return JSON.stringify(
                value
            );

        } catch (error) {

            return String(
                value
            );
        }
    }

    return String(
        value
    );
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


/* =========================================================
   NAVIGATION EVENTS
========================================================= */

document
    .querySelectorAll(
        ".admin-nav button"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    const section =
                        button.dataset.section;

                    if (!section) {
                        return;
                    }

                    loadSection(
                        section
                    );

                }
            );

        }
    );


/* =========================================================
   LOGOUT
========================================================= */

if (
    $("logout")
) {

    $("logout").addEventListener(
        "click",
        async () => {

            try {

                await sb.auth.signOut();

            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );
            }

            window.location.href =
                "/app/";
        }
    );
}


/* =========================================================
   AUTH STATE LISTENER
========================================================= */

sb.auth.onAuthStateChange(
    (
        event,
        session
    ) => {

        if (
            event ===
                "SIGNED_OUT" ||
            !session
        ) {

            window.location.href =
                "/app/";
        }

    }
);


/* =========================================================
   START ADMIN PANEL
========================================================= */

loadSection(
    "dashboard"
);
