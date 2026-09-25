
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
   SETTINGS / BRANDING
========================================================= */

let currentBrandingSettings = {
    brand_name: "Obsedian.Space",
    logo_url: "",
    primary_color: "#7c3aed",
    accent_color: "#f59e0b",
    support_email: ""
};


/* =========================================================
   LOAD SETTINGS
========================================================= */

async function loadSettings() {

    $("pageTitle").textContent =
        "Settings";

    showLoading(
        "Loading branding settings..."
    );

    const data =
        await api(
            "settings"
        );

    const settings =
        data?.settings ||
        data?.data ||
        [];

    let branding = null;

    if (Array.isArray(settings)) {

        const brandingRecord =
            settings.find(
                item =>
                    item &&
                    item.key ===
                        "branding"
            );

        branding =
            brandingRecord?.value ||
            null;

    } else if (
        settings &&
        typeof settings === "object"
    ) {

        branding =
            settings.branding ||
            settings;

    }

    if (
        !branding ||
        typeof branding !== "object"
    ) {
        branding = {};
    }


    currentBrandingSettings = {

        brand_name:
            branding.brand_name ||
            "Obsedian.Space",

        logo_url:
            branding.logo_url ||
            "",

        primary_color:
            branding.primary_color ||
            "#7c3aed",

        accent_color:
            branding.accent_color ||
            "#f59e0b",

        support_email:
            branding.support_email ||
            ""
    };


    renderBrandingSettings(
        currentBrandingSettings
    );
}


/* =========================================================
   RENDER BRANDING SETTINGS
========================================================= */

function renderBrandingSettings(
    branding
) {

    const logoUrl =
        branding.logo_url ||
        "";

    const primaryColor =
        /^#[0-9a-f]{6}$/i.test(
            branding.primary_color
        )
            ? branding.primary_color
            : "#7c3aed";

    const accentColor =
        /^#[0-9a-f]{6}$/i.test(
            branding.accent_color
        )
            ? branding.accent_color
            : "#f59e0b";


    $("content").innerHTML = `

        <div class="card">

            <h2>
                Branding Settings
            </h2>

            <p>
                Manage your Obsedian.Space
                brand name, logo, colors and
                support email.
            </p>

        </div>


        <div class="card">

            <form
                id="brandingForm"
                autocomplete="off"
            >

                <!-- BRAND NAME -->

                <div
                    style="
                        margin-bottom:20px;
                    "
                >

                    <label
                        for="brandName"
                        style="
                            display:block;
                            font-weight:600;
                            margin-bottom:7px;
                        "
                    >
                        Brand Name
                    </label>

                    <input
                        id="brandName"
                        type="text"
                        value="${escapeHtml(
                            branding.brand_name
                        )}"
                        placeholder="Obsedian.Space"
                        maxlength="100"
                        style="
                            width:100%;
                            max-width:650px;
                            padding:12px;
                            border:1px solid #d1d5db;
                            border-radius:8px;
                            box-sizing:border-box;
                        "
                    >

                </div>


                <!-- LOGO -->

                <div
                    style="
                        margin-bottom:20px;
                    "
                >

                    <label
                        style="
                            display:block;
                            font-weight:600;
                            margin-bottom:10px;
                        "
                    >
                        Logo
                    </label>


                    <div
                        id="logoPreviewBox"
                        style="
                            width:220px;
                            min-height:120px;
                            border:1px dashed #d1d5db;
                            border-radius:10px;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            padding:15px;
                            background:#f9fafb;
                            margin-bottom:12px;
                            box-sizing:border-box;
                        "
                    >

                        ${
                            logoUrl
                                ? `
                                    <img
                                        id="logoPreview"
                                        src="${escapeHtml(
                                            logoUrl
                                        )}"
                                        alt="Logo preview"
                                        style="
                                            max-width:190px;
                                            max-height:90px;
                                            object-fit:contain;
                                        "
                                        onerror="
                                            this.style.display='none';
                                            document.getElementById('logoPreviewEmpty').style.display='block';
                                        "
                                    >

                                    <span
                                        id="logoPreviewEmpty"
                                        style="
                                            display:none;
                                            color:#6b7280;
                                        "
                                    >
                                        Logo preview unavailable
                                    </span>
                                `
                                : `
                                    <span
                                        style="
                                            color:#6b7280;
                                        "
                                    >
                                        No logo selected
                                    </span>
                                `
                        }

                    </div>


                    <div
                        style="
                            display:flex;
                            gap:10px;
                            flex-wrap:wrap;
                        "
                    >

                        <label
                            for="logoFile"
                            style="
                                display:inline-flex;
                                align-items:center;
                                justify-content:center;
                                padding:10px 16px;
                                border-radius:8px;
                                background:#7c3aed;
                                color:#fff;
                                cursor:pointer;
                                font-weight:600;
                            "
                        >
                            Select Logo
                        </label>

                        <input
                            id="logoFile"
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            style="display:none"
                        >

                        <button
                            type="button"
                            id="removeLogo"
                        >
                            Remove Logo
                        </button>

                    </div>


                    <small
                        style="
                            display:block;
                            margin-top:8px;
                            color:#6b7280;
                        "
                    >
                        PNG, JPG, WEBP or SVG.
                        Maximum 3 MB.
                    </small>

                </div>


                <!-- LOGO URL -->

                <div
                    style="
                        margin-bottom:20px;
                    "
                >

                    <label
                        for="logoUrl"
                        style="
                            display:block;
                            font-weight:600;
                            margin-bottom:7px;
                        "
                    >
                        Logo URL
                    </label>

                    <input
                        id="logoUrl"
                        type="url"
                        value="${escapeHtml(
                            logoUrl
                        )}"
                        placeholder="https://..."
                        style="
                            width:100%;
                            max-width:650px;
                            padding:12px;
                            border:1px solid #d1d5db;
                            border-radius:8px;
                            box-sizing:border-box;
                        "
                    >

                    <small
                        style="
                            display:block;
                            margin-top:6px;
                            color:#6b7280;
                        "
                    >
                        You can also enter an existing
                        public logo URL manually.
                    </small>

                </div>


                <!-- PRIMARY COLOR -->

                <div
                    style="
                        margin-bottom:20px;
                    "
                >

                    <label
                        style="
                            display:block;
                            font-weight:600;
                            margin-bottom:7px;
                        "
                    >
                        Primary Color
                    </label>


                    <div
                        style="
                            display:flex;
                            align-items:center;
                            gap:10px;
                            flex-wrap:wrap;
                        "
                    >

                        <input
                            id="primaryColorPicker"
                            type="color"
                            value="${primaryColor}"
                            style="
                                width:55px;
                                height:42px;
                                padding:2px;
                                cursor:pointer;
                            "
                        >

                        <input
                            id="primaryColor"
                            type="text"
                            value="${escapeHtml(
                                primaryColor
                            )}"
                            maxlength="7"
                            placeholder="#7c3aed"
                            style="
                                width:140px;
                                padding:10px;
                                border:1px solid #d1d5db;
                                border-radius:8px;
                            "
                        >

                    </div>

                </div>


                <!-- ACCENT COLOR -->

                <div
                    style="
                        margin-bottom:20px;
                    "
                >

                    <label
                        style="
                            display:block;
                            font-weight:600;
                            margin-bottom:7px;
                        "
                    >
                        Accent Color
                    </label>


                    <div
                        style="
                            display:flex;
                            align-items:center;
                            gap:10px;
                            flex-wrap:wrap;
                        "
                    >

                        <input
                            id="accentColorPicker"
                            type="color"
                            value="${accentColor}"
                            style="
                                width:55px;
                                height:42px;
                                padding:2px;
                                cursor:pointer;
                            "
                        >

                        <input
                            id="accentColor"
                            type="text"
                            value="${escapeHtml(
                                accentColor
                            )}"
                            maxlength="7"
                            placeholder="#f59e0b"
                            style="
                                width:140px;
                                padding:10px;
                                border:1px solid #d1d5db;
                                border-radius:8px;
                            "
                        >

                    </div>

                </div>


                <!-- SUPPORT EMAIL -->

                <div
                    style="
                        margin-bottom:24px;
                    "
                >

                    <label
                        for="supportEmail"
                        style="
                            display:block;
                            font-weight:600;
                            margin-bottom:7px;
                        "
                    >
                        Support Email
                    </label>

                    <input
                        id="supportEmail"
                        type="email"
                        value="${escapeHtml(
                            branding.support_email
                        )}"
                        placeholder="support@example.com"
                        style="
                            width:100%;
                            max-width:650px;
                            padding:12px;
                            border:1px solid #d1d5db;
                            border-radius:8px;
                            box-sizing:border-box;
                        "
                    >

                </div>


                <!-- ACTIONS -->

                <div
                    style="
                        display:flex;
                        gap:10px;
                        flex-wrap:wrap;
                        align-items:center;
                    "
                >

                    <button
                        type="submit"
                        id="saveBranding"
                    >
                        Save Branding Settings
                    </button>

                    <button
                        type="button"
                        id="reloadBranding"
                    >
                        Reload
                    </button>

                    <span
                        id="brandingMessage"
                        style="
                            display:none;
                            font-weight:600;
                        "
                    ></span>

                </div>

            </form>

        </div>

    `;


    bindBrandingEvents();
}


/* =========================================================
   BRANDING EVENTS
========================================================= */

function bindBrandingEvents() {

    const form =
        $("brandingForm");

    const logoFile =
        $("logoFile");

    const logoUrl =
        $("logoUrl");

    const removeLogo =
        $("removeLogo");

    const reloadBranding =
        $("reloadBranding");

    const primaryPicker =
        $("primaryColorPicker");

    const primaryInput =
        $("primaryColor");

    const accentPicker =
        $("accentColorPicker");

    const accentInput =
        $("accentColor");


    /* -----------------------------------------
       LOGO FILE PREVIEW
    ----------------------------------------- */

    logoFile?.addEventListener(
        "change",
        () => {

            const file =
                logoFile.files?.[0];

            if (!file) {
                return;
            }


            if (
                ![
                    "image/png",
                    "image/jpeg",
                    "image/webp",
                    "image/svg+xml"
                ].includes(
                    file.type
                )
            ) {

                alert(
                    "Please select PNG, JPG, WEBP or SVG."
                );

                logoFile.value = "";

                return;
            }


            if (
                file.size >
                3 * 1024 * 1024
            ) {

                alert(
                    "Logo must be smaller than 3 MB."
                );

                logoFile.value = "";

                return;
            }


            const reader =
                new FileReader();


            reader.onload =
                event => {

                    const box =
                        $("logoPreviewBox");

                    if (!box) {
                        return;
                    }

                    box.innerHTML = `

                        <img
                            id="logoPreview"
                            src="${event.target.result}"
                            alt="Logo preview"
                            style="
                                max-width:190px;
                                max-height:90px;
                                object-fit:contain;
                            "
                        >

                    `;

                };


            reader.readAsDataURL(
                file
            );

        }
    );


    /* -----------------------------------------
       REMOVE LOGO
    ----------------------------------------- */

    removeLogo?.addEventListener(
        "click",
        () => {

            if (logoFile) {
                logoFile.value = "";
            }

            if (logoUrl) {
                logoUrl.value = "";
            }


            const box =
                $("logoPreviewBox");

            if (box) {

                box.innerHTML = `

                    <span
                        style="
                            color:#6b7280;
                        "
                    >
                        No logo selected
                    </span>

                `;
            }

        }
    );


    /* -----------------------------------------
       PRIMARY COLOR SYNC
    ----------------------------------------- */

    primaryPicker?.addEventListener(
        "input",
        () => {

            if (primaryInput) {

                primaryInput.value =
                    primaryPicker.value;

            }

        }
    );


    primaryInput?.addEventListener(
        "input",
        () => {

            const value =
                primaryInput.value.trim();


            if (
                /^#[0-9a-fA-F]{6}$/
                    .test(value)
            ) {

                if (primaryPicker) {

                    primaryPicker.value =
                        value;

                }

            }

        }
    );


    /* -----------------------------------------
       ACCENT COLOR SYNC
    ----------------------------------------- */

    accentPicker?.addEventListener(
        "input",
        () => {

            if (accentInput) {

                accentInput.value =
                    accentPicker.value;

            }

        }
    );


    accentInput?.addEventListener(
        "input",
        () => {

            const value =
                accentInput.value.trim();


            if (
                /^#[0-9a-fA-F]{6}$/
                    .test(value)
            ) {

                if (accentPicker) {

                    accentPicker.value =
                        value;

                }

            }

        }
    );


    /* -----------------------------------------
       RELOAD
    ----------------------------------------- */

    reloadBranding?.addEventListener(
        "click",
        () => loadSettings()
    );


    /* -----------------------------------------
       SAVE
    ----------------------------------------- */

    form?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            await saveBrandingSettings();

        }
    );

}


/* =========================================================
   SAVE BRANDING
========================================================= */

async function saveBrandingSettings() {

    const saveButton =
        $("saveBranding");

    const message =
        $("brandingMessage");


    const brandName =
        $("brandName")?.value.trim() ||
        "";

    const logoUrl =
        $("logoUrl")?.value.trim() ||
        "";

    const primaryColor =
        $("primaryColor")?.value.trim() ||
        "";

    const accentColor =
        $("accentColor")?.value.trim() ||
        "";

    const supportEmail =
        $("supportEmail")?.value.trim() ||
        "";

    const logoFile =
        $("logoFile")?.files?.[0] ||
        null;


    /* -----------------------------------------
       VALIDATION
    ----------------------------------------- */

    if (!brandName) {

        showBrandingMessage(
            "Brand name is required.",
            true
        );

        return;
    }


    if (
        !/^#[0-9a-fA-F]{6}$/
            .test(primaryColor)
    ) {

        showBrandingMessage(
            "Primary color must be a valid HEX color.",
            true
        );

        return;
    }


    if (
        !/^#[0-9a-fA-F]{6}$/
            .test(accentColor)
    ) {

        showBrandingMessage(
            "Accent color must be a valid HEX color.",
            true
        );

        return;
    }


    if (
        supportEmail &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(supportEmail)
    ) {

        showBrandingMessage(
            "Please enter a valid support email.",
            true
        );

        return;
    }


    if (logoFile) {

        if (
            logoFile.size >
            3 * 1024 * 1024
        ) {

            showBrandingMessage(
                "Logo must be smaller than 3 MB.",
                true
            );

            return;
        }

    }


    try {

        if (saveButton) {

            saveButton.disabled =
                true;

            saveButton.textContent =
                "Saving...";

        }


        showBrandingMessage(
            "Saving branding settings...",
            false
        );


        /*
         * -------------------------------------------------
         * Upload logo if selected
         * -------------------------------------------------
         */

        let finalLogoUrl =
            logoUrl;


        if (logoFile) {

            const session =
                await getSession();


            if (!session) {
                return;
            }


            const fileExtension =
                getFileExtension(
                    logoFile.name,
                    logoFile.type
                );


            const fileName =
                `branding/logo-${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2)}.${fileExtension}`;


            const {
                error:
                    uploadError
            } =
                await sb.storage
                    .from("branding")
                    .upload(
                        fileName,
                        logoFile,
                        {
                            cacheControl:
                                "3600",
                            upsert:
                                false,
                            contentType:
                                logoFile.type
                        }
                    );


            if (uploadError) {

                console.error(
                    "Logo upload error:",
                    uploadError
                );

                throw new Error(
                    "Logo upload failed: " +
                    uploadError.message
                );

            }


            const {
                data:
                    publicUrlData
            } =
                sb.storage
                    .from("branding")
                    .getPublicUrl(
                        fileName
                    );


            finalLogoUrl =
                publicUrlData?.publicUrl ||
                "";

        }


        /*
         * -------------------------------------------------
         * Send branding update to Admin Function
         * -------------------------------------------------
         */

        const data =
            await api(
                "settings",
                {
                    action:
                        "save_branding",

                    brand_name:
                        brandName,

                    logo_url:
                        finalLogoUrl,

                    primary_color:
                        primaryColor,

                    accent_color:
                        accentColor,

                    support_email:
                        supportEmail
                }
            );


        if (
            data &&
            data.error
        ) {

            throw new Error(
                data.error
            );

        }


        currentBrandingSettings = {

            brand_name:
                brandName,

            logo_url:
                finalLogoUrl,

            primary_color:
                primaryColor,

            accent_color:
                accentColor,

            support_email:
                supportEmail

        };


        showBrandingMessage(
            "Branding settings saved successfully.",
            false
        );


        /*
         * Refresh logo URL field
         */

        if ($("logoUrl")) {

            $("logoUrl").value =
                finalLogoUrl;

        }


    } catch (error) {

        console.error(
            "Save branding error:",
            error
        );


        showBrandingMessage(
            error?.message ||
                "Unable to save branding settings.",
            true
        );


    } finally {

        if (saveButton) {

            saveButton.disabled =
                false;

            saveButton.textContent =
                "Save Branding Settings";

        }

    }

}


/* =========================================================
   BRANDING MESSAGE
========================================================= */

function showBrandingMessage(
    text,
    isError
) {

    const element =
        $("brandingMessage");

    if (!element) {
        return;
    }


    element.textContent =
        text;

    element.style.display =
        "inline-block";

    element.style.color =
        isError
            ? "#dc2626"
            : "#16a34a";

}


/* =========================================================
   FILE EXTENSION
========================================================= */

function getFileExtension(
    fileName,
    mimeType
) {

    const existing =
        String(
            fileName || ""
        )
            .split(".")
            .pop()
            .toLowerCase();


    if (
        [
            "png",
            "jpg",
            "jpeg",
            "webp",
            "svg"
        ].includes(existing)
    ) {

        return existing ===
            "jpeg"
            ? "jpg"
            : existing;

    }


    switch (mimeType) {

        case "image/png":
            return "png";

        case "image/jpeg":
            return "jpg";

        case "image/webp":
            return "webp";

        case "image/svg+xml":
            return "svg";

        default:
            return "png";

    }

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
