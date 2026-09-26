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
   GLOBAL STATE
========================================================= */

let session = null;
let currentSection = "dashboard";
let currentUsers = [];
let currentPlans = [];
let currentBranding = null;


/* =========================================================
   HELPERS
========================================================= */

const $ = (id) => document.getElementById(id);


function escapeHtml(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatDate(value) {

    if (!value) {
        return "—";
    }

    try {

        return new Date(value).toLocaleString(
            "en-IN",
            {
                dateStyle: "medium",
                timeStyle: "short"
            }
        );

    } catch {

        return value;
    }
}


function formatDateOnly(value) {

    if (!value) {
        return "—";
    }

    try {

        return new Date(value).toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );

    } catch {

        return value;
    }
}


function showMessage(message, type = "success") {

    let box = $("adminMessage");

    if (!box) {

        box = document.createElement("div");

        box.id = "adminMessage";

        box.style.position = "fixed";
        box.style.top = "20px";
        box.style.right = "20px";
        box.style.zIndex = "99999";
        box.style.maxWidth = "420px";
        box.style.padding = "14px 18px";
        box.style.borderRadius = "10px";
        box.style.fontSize = "14px";
        box.style.fontWeight = "600";
        box.style.boxShadow =
            "0 10px 30px rgba(0,0,0,.15)";

        document.body.appendChild(box);
    }

    box.textContent = message;

    box.style.background =
        type === "error"
            ? "#fee2e2"
            : "#dcfce7";

    box.style.color =
        type === "error"
            ? "#991b1b"
            : "#166534";

    box.style.border =
        type === "error"
            ? "1px solid #fecaca"
            : "1px solid #bbf7d0";

    clearTimeout(
        window.__adminMessageTimer
    );

    window.__adminMessageTimer =
        setTimeout(() => {

            box.remove();

        }, 4000);
}


function loading(message = "Loading...") {

    const content = $("content");

    if (!content) {
        return;
    }

    content.innerHTML = `
        <div class="card">
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}


/* =========================================================
   LOADING COMPATIBILITY
========================================================= */

function showLoading(message = "Loading...") {
    loading(message);
}



function errorBox(message) {

    const content = $("content");

    if (!content) {
        return;
    }

    content.innerHTML = `
        <div class="card">
            <h2>Error</h2>
            <p>${escapeHtml(message)}</p>
            <button id="retrySection">
                Retry
            </button>
        </div>
    `;

    const retry = $("retrySection");

    if (retry) {

        retry.onclick = () => {

            loadSection(
                currentSection
            );

        };
    }
}



/* =========================================================
   LOADING COMPATIBILITY
========================================================= */

function showLoading(message = "Loading...") {
    loading(message);
}

function formatDateTime(value) {
    return formatDate(value);
}


/* =========================================================
   AUTH
========================================================= */

async function getSession() {

    const result =
        await sb.auth.getSession();

    session =
        result?.data?.session || null;

    return session;
}


async function requireSession() {

    const current =
        await getSession();

    if (!current) {

        window.location.href =
            "/app/";

        return null;
    }

    return current;
}


/* =========================================================
   ADMIN API
========================================================= */

async function api(
    section,
    options = {}
) {

    const current =
        await requireSession();

    if (!current) {
        throw new Error(
            "Authentication required."
        );
    }

    const params =
        new URLSearchParams();

    params.set(
        "section",
        section
    );

    if (options.search !== undefined) {

        params.set(
            "search",
            options.search
        );
    }


    const url =
        `${window.OBSEDIAN_CONFIG.SUPABASE_URL}` +
        `/functions/v1/admin?` +
        params.toString();


    console.log(
        "Admin API request:",
        url
    );


    const response =
        await fetch(
            url,
            {
                method:
                    options.method || "GET",

                headers: {

                    Authorization:
                        `Bearer ${current.access_token}`,

                    apikey:
                        window.OBSEDIAN_CONFIG
                            .SUPABASE_PUBLISHABLE_KEY,

                    "Content-Type":
                        "application/json"
                },

                body:
                    options.body
                        ? JSON.stringify(
                            options.body
                        )
                        : undefined
            }
        );


    const raw =
        await response.text();


    let data = {};

    try {

        data =
            raw
                ? JSON.parse(raw)
                : {};

    } catch {

        data = {
            error: raw ||
                "Invalid server response."
        };
    }


    console.log(
        "Admin API status:",
        response.status
    );

    console.log(
        "Admin API response:",
        data
    );


    if (!response.ok) {

        throw new Error(
            data?.error ||
            data?.message ||
            `Request failed (${response.status})`
        );
    }


    return data;
}


/* =========================================================
   GENERIC ADMIN ACTION
========================================================= */

async function adminAction(
    action,
    payload = {}
) {

    const current =
        await requireSession();

    if (!current) {
        return null;
    }


    const url =
        `${window.OBSEDIAN_CONFIG.SUPABASE_URL}` +
        `/functions/v1/admin`;


    console.log(
        "Admin action:",
        action,
        payload
    );


    const response =
        await fetch(
            url,
            {
                method: "POST",

                headers: {

                    Authorization:
                        `Bearer ${current.access_token}`,

                    apikey:
                        window.OBSEDIAN_CONFIG
                            .SUPABASE_PUBLISHABLE_KEY,

                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({
                        action,
                        ...payload
                    })
            }
        );


    const raw =
        await response.text();


    let data = {};

    try {

        data =
            raw
                ? JSON.parse(raw)
                : {};

    } catch {

        data = {
            error: raw
        };
    }


    console.log(
        "Admin action status:",
        response.status
    );

    console.log(
        "Admin action response:",
        data
    );


    if (!response.ok) {

        throw new Error(
            data?.error ||
            data?.message ||
            `Action failed (${response.status})`
        );
    }


    return data;
}


/* =========================================================
   NAVIGATION
========================================================= */

function setActiveNav(
    section
) {

    document
        .querySelectorAll(
            ".admin-nav button"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.section ===
                        section
                );

            }
        );
}


function sectionTitle(
    section
) {

    const titles = {

        dashboard:
            "Admin Dashboard",

        users:
            "Users",

        websites:
            "Websites",

        subscriptions:
            "Subscriptions",

        payments:
            "Payments",

        ai:
            "AI Operations",

        approvals:
            "Approvals",

        support:
            "Support Tickets",

        audit:
            "Audit Logs",

        settings:
            "Settings"
    };

    return (
        titles[section] ||
        "Admin Panel"
    );
}


/* =========================================================
   LOAD SECTION
========================================================= */

async function loadSection(
    section
) {

    currentSection =
        section;

    setActiveNav(
        section
    );

    const title =
        $("pageTitle");

    if (title) {

        title.textContent =
            sectionTitle(
                section
            );
    }


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

                errorBox(
                    "Unknown admin section."
                );
        }

    } catch (error) {

        console.error(
            "Admin section error:",
            error
        );

        errorBox(
            error?.message ||
            "Unable to load admin section."
        );
    }
}


/* =========================================================
   DASHBOARD
========================================================= */

async function loadDashboard() {

    loading(
        "Loading dashboard..."
    );


    const data =
        await api(
            "dashboard"
        );


    const metrics =
        data.metrics || {};


    const logs =
        data.logs || [];


    const content =
        $("content");


    content.innerHTML = `

        <div class="stats">

            ${Object.entries(
                metrics
            )
                .map(
                    ([key, value]) => `

                    <div class="stat">

                        <small>
                            ${escapeHtml(
                                key
                            )}
                        </small>

                        <br>

                        <b>
                            ${escapeHtml(
                                value
                            )}
                        </b>

                    </div>

                `
                )
                .join("")}

        </div>


        <div class="card">

            <div class="admin-header">

                <div>

                    <h2>
                        Recent Audit Activity
                    </h2>

                    <p>
                        Latest administrative activity.
                    </p>

                </div>

                <button
                    id="dashboardRefresh"
                >
                    Refresh
                </button>

            </div>


            ${
                logs.length
                    ? `

                    <div class="admin-table-wrapper">

                        <table class="admin-table">

                            <thead>

                                <tr>

                                    <th>
                                        Time
                                    </th>

                                    <th>
                                        Action
                                    </th>

                                    <th>
                                        User
                                    </th>

                                    <th>
                                        Entity
                                    </th>

                                    <th>
                                        Details
                                    </th>

                                </tr>

                            </thead>

                            <tbody>

                                ${logs
                                    .map(
                                        log => `

                                        <tr>

                                            <td>
                                                ${formatDate(
                                                    log.created_at
                                                )}
                                            </td>

                                            <td>
                                                <span class="badge">
                                                    ${escapeHtml(
                                                        log.action ||
                                                        log.event ||
                                                        "—"
                                                    )}
                                                </span>
                                            </td>

                                            <td>
                                                ${escapeHtml(
                                                    log.user_id ||
                                                    "—"
                                                )}
                                            </td>

                                            <td>
                                                ${escapeHtml(
                                                    log.entity_id ||
                                                    log.entity_type ||
                                                    "—"
                                                )}
                                            </td>

                                            <td>
                                                ${escapeHtml(
                                                    JSON.stringify(
                                                        log.metadata ||
                                                        log.details ||
                                                        {}
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

                `
                    : `
                    <div class="empty">
                        No audit activity found.
                    </div>
                `
            }

        </div>
    `;


    const refresh =
        $("dashboardRefresh");

    if (refresh) {

        refresh.onclick =
            () =>
                loadSection(
                    "dashboard"
                );
    }
}


/* =========================================================
   USERS
========================================================= */

async function loadUsers() {

    loading(
        "Loading users..."
    );


    const content =
        $("content");


    content.innerHTML = `

        <div class="card">

            <div class="admin-header">

                <div>

                    <h2>
                        User Management
                    </h2>

                    <p>
                        Manage users, roles, plans and subscriptions.
                    </p>

                </div>

                <button
                    id="usersRefresh"
                >
                    Refresh
                </button>

            </div>


            <div
                style="
                    display:flex;
                    gap:10px;
                    flex-wrap:wrap;
                    margin-bottom:20px;
                "
            >

                <input
                    id="userSearch"
                    class="search-box"
                    placeholder="Search name, email, phone, role, plan..."
                >

                <button
                    id="userSearchButton"
                >
                    Search
                </button>

            </div>


            <div id="usersTable">
                Loading users...
            </div>

        </div>

    `;


    const renderUsers =
        async (
            search = ""
        ) => {

            const data =
                await api(
                    "users",
                    {
                        search
                    }
                );


            currentUsers =
                data.users || [];


            renderUsersTable(
                currentUsers
            );
        };


    $("usersRefresh").onclick =
        () =>
            renderUsers();


    $("userSearchButton").onclick =
        () =>
            renderUsers(
                $("userSearch")
                    .value
                    .trim()
            );


    $("userSearch").addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                renderUsers(
                    event.target.value
                        .trim()
                );
            }

        }
    );


    await renderUsers();
}


/* =========================================================
   USERS TABLE
========================================================= */

function renderUsersTable(
    users
) {

    const wrapper =
        $("usersTable");


    if (!wrapper) {
        return;
    }


    if (!users.length) {

        wrapper.innerHTML = `
            <div class="empty">
                No users found.
            </div>
        `;

        return;
    }


    wrapper.innerHTML = `

        <div class="admin-table-wrapper">

            <table class="admin-table">

                <thead>

                    <tr>

                        <th>
                            User
                        </th>

                        <th>
                            Role
                        </th>

                        <th>
                            Plan
                        </th>

                        <th>
                            Billing
                        </th>

                        <th>
                            Status
                        </th>

                        <th>
                            Websites
                        </th>

                        <th>
                            AI Runs
                        </th>

                        <th>
                            Subscription Ends
                        </th>

                        <th>
                            Created
                        </th>

                        <th>
                            Actions
                        </th>

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

                                    ${escapeHtml(
                                        user.billing_cycle ||
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
                                        user.websites ??
                                        0
                                    )}
                                </td>


                                <td>
                                    ${escapeHtml(
                                        user.ai_runs ??
                                        0
                                    )}
                                </td>


                                <td>

                                    ${formatDateOnly(
                                        user.subscription_ends_at
                                    )}

                                </td>


                                <td>

                                    ${formatDateOnly(
                                        user.created_at
                                    )}

                                </td>


                                <td>

                                    <button
                                        class="manage-user"
                                        data-user-id="${escapeHtml(
                                            user.id
                                        )}"
                                    >
                                        Manage
                                    </button>

                                </td>

                            </tr>

                        `
                        )
                        .join("")}

                </tbody>

            </table>

        </div>

    `;


    wrapper
        .querySelectorAll(
            ".manage-user"
        )
        .forEach(
            button => {

                button.onclick =
                    () =>
                        openUserManager(
                            button.dataset.userId
                        );

            }
        );
}


/* =========================================================
   USER MANAGER
========================================================= */

async function openUserManager(
    userId
) {

    const user =
        currentUsers.find(
            item =>
                item.id ===
                userId
        );


    if (!user) {

        showMessage(
            "User not found.",
            "error"
        );

        return;
    }


    let plans =
        currentPlans;


    if (!plans.length) {

        try {

            const data =
                await api(
                    "plans"
                );

            plans =
                data.plans || [];

            currentPlans =
                plans;

        } catch (error) {

            console.warn(
                "Unable to load plans:",
                error
            );
        }
    }


    const modal =
        document.createElement(
            "div"
        );


    modal.id =
        "userManagerModal";


    modal.style.position =
        "fixed";

    modal.style.inset =
        "0";

    modal.style.background =
        "rgba(0,0,0,.55)";

    modal.style.zIndex =
        "99998";

    modal.style.display =
        "flex";

    modal.style.alignItems =
        "center";

    modal.style.justifyContent =
        "center";

    modal.style.padding =
        "20px";


    modal.innerHTML = `

        <div
            style="
                background:#fff;
                width:min(650px,100%);
                max-height:90vh;
                overflow:auto;
                border-radius:16px;
                padding:24px;
                box-shadow:0 20px 60px rgba(0,0,0,.25);
            "
        >

            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:15px;
                    margin-bottom:20px;
                "
            >

                <div>

                    <h2 style="margin:0">
                        Manage User
                    </h2>

                    <p style="margin:6px 0 0">
                        ${escapeHtml(
                            user.email ||
                            user.full_name ||
                            user.id
                        )}
                    </p>

                </div>

                <button
                    id="closeUserManager"
                >
                    ×
                </button>

            </div>


            <div
                style="
                    display:grid;
                    grid-template-columns:1fr 1fr;
                    gap:16px;
                "
            >

                <label>

                    <strong>
                        Role
                    </strong>

                    <select
                        id="manageRole"
                        style="width:100%;padding:10px;margin-top:6px"
                    >

                        <option
                            value="user"
                            ${user.role === "user"
                                ? "selected"
                                : ""}
                        >
                            User
                        </option>

                        <option
                            value="admin"
                            ${user.role === "admin"
                                ? "selected"
                                : ""}
                        >
                            Admin
                        </option>

                    </select>

                </label>


                <label>

                    <strong>
                        Plan
                    </strong>

                    <select
                        id="managePlan"
                        style="width:100%;padding:10px;margin-top:6px"
                    >

                        ${
                            plans.length
                                ? plans
                                    .map(
                                        plan => `

                                        <option
                                            value="${escapeHtml(
                                                plan.id
                                            )}"
                                            ${
                                                plan.id ===
                                                user.plan_id
                                                    ? "selected"
                                                    : ""
                                            }
                                        >
                                            ${escapeHtml(
                                                plan.name ||
                                                plan.id
                                            )}
                                        </option>

                                    `
                                    )
                                    .join("")
                                : `

                                    <option
                                        value="${escapeHtml(
                                            user.plan_id ||
                                            "free"
                                        )}"
                                        selected
                                    >
                                        ${escapeHtml(
                                            user.plan_id ||
                                            "free"
                                        )}
                                    </option>

                                `
                        }

                    </select>

                </label>


                <label>

                    <strong>
                        Billing Cycle
                    </strong>

                    <select
                        id="manageBilling"
                        style="width:100%;padding:10px;margin-top:6px"
                    >

                        <option
                            value="free"
                            ${user.billing_cycle === "free"
                                ? "selected"
                                : ""}
                        >
                            Free
                        </option>

                        <option
                            value="monthly"
                            ${user.billing_cycle === "monthly"
                                ? "selected"
                                : ""}
                        >
                            Monthly
                        </option>

                        <option
                            value="yearly"
                            ${user.billing_cycle === "yearly"
                                ? "selected"
                                : ""}
                        >
                            Yearly
                        </option>

                    </select>

                </label>


                <label>

                    <strong>
                        Subscription Status
                    </strong>

                    <select
                        id="manageStatus"
                        style="width:100%;padding:10px;margin-top:6px"
                    >

                        <option
                            value="trial"
                            ${user.subscription_status === "trial"
                                ? "selected"
                                : ""}
                        >
                            Trial
                        </option>

                        <option
                            value="active"
                            ${user.subscription_status === "active"
                                ? "selected"
                                : ""}
                        >
                            Active
                        </option>

                        <option
                            value="paused"
                            ${user.subscription_status === "paused"
                                ? "selected"
                                : ""}
                        >
                            Paused
                        </option>

                        <option
                            value="cancelled"
                            ${user.subscription_status === "cancelled"
                                ? "selected"
                                : ""}
                        >
                            Cancelled
                        </option>

                    </select>

                </label>


                <label>

                    <strong>
                        Extend Subscription
                    </strong>

                    <input
                        id="manageDays"
                        type="number"
                        min="1"
                        value="30"
                        style="width:100%;padding:10px;margin-top:6px"
                    >

                    <small>
                        Number of days to add.
                    </small>

                </label>

            </div>


            <div
                style="
                    margin-top:20px;
                    padding:14px;
                    background:#f9fafb;
                    border-radius:10px;
                "
            >

                <strong>
                    Current subscription
                </strong>

                <br>

                Plan:
                ${escapeHtml(
                    user.plan_id ||
                    "free"
                )}

                <br>

                Status:
                ${escapeHtml(
                    user.subscription_status ||
                    "none"
                )}

                <br>

                Ends:
                ${formatDate(
                    user.subscription_ends_at
                )}

            </div>


            <div
                style="
                    display:flex;
                    justify-content:flex-end;
                    gap:10px;
                    flex-wrap:wrap;
                    margin-top:24px;
                "
            >

                <button
                    id="pauseUserSubscription"
                >
                    Pause
                </button>

                <button
                    id="resumeUserSubscription"
                >
                    Resume
                </button>

                <button
                    id="extendUserSubscription"
                >
                    Extend
                </button>

                <button
                    id="saveUserChanges"
                >
                    Save Changes
                </button>

            </div>

        </div>

    `;


    document.body.appendChild(
        modal
    );


    $("closeUserManager").onclick =
        () =>
            modal.remove();


    modal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                modal
            ) {

                modal.remove();
            }

        }
    );


    $("saveUserChanges").onclick =
        async () => {

            const role =
                $("manageRole")
                    .value;

            const planId =
                $("managePlan")
                    .value;

            const billingCycle =
                $("manageBilling")
                    .value;

            const status =
                $("manageStatus")
                    .value;


            if (
                role === "admin" &&
                user.role !== "admin"
            ) {

                const confirmed =
                    confirm(
                        "Grant administrator access to this user?"
                    );

                if (!confirmed) {
                    return;
                }
            }


            try {

                const button =
                    $("saveUserChanges");

                button.disabled =
                    true;

                button.textContent =
                    "Saving...";


                await adminAction(
                    "update_user",
                    {
                        user_id:
                            user.id,

                        role,

                        plan_id:
                            planId,

                        billing_cycle:
                            billingCycle,

                        status
                    }
                );


                showMessage(
                    "User updated successfully."
                );


                modal.remove();


                await loadUsers();

            } catch (error) {

                console.error(
                    error
                );

                showMessage(
                    error.message ||
                    "Unable to update user.",
                    "error"
                );

                const button =
                    $("saveUserChanges");

                if (button) {

                    button.disabled =
                        false;

                    button.textContent =
                        "Save Changes";
                }
            }
        };


    $("pauseUserSubscription").onclick =
        async () => {

            if (
                !confirm(
                    "Pause this user's subscription?"
                )
            ) {
                return;
            }


            try {

                await adminAction(
                    "pause_subscription",
                    {
                        user_id:
                            user.id
                    }
                );


                showMessage(
                    "Subscription paused."
                );


                modal.remove();

                await loadUsers();

            } catch (error) {

                showMessage(
                    error.message ||
                    "Unable to pause subscription.",
                    "error"
                );
            }
        };


    $("resumeUserSubscription").onclick =
        async () => {

            if (
                !confirm(
                    "Resume this user's subscription?"
                )
            ) {
                return;
            }


            try {

                await adminAction(
                    "resume_subscription",
                    {
                        user_id:
                            user.id
                    }
                );


                showMessage(
                    "Subscription resumed."
                );


                modal.remove();

                await loadUsers();

            } catch (error) {

                showMessage(
                    error.message ||
                    "Unable to resume subscription.",
                    "error"
                );
            }
        };


    $("extendUserSubscription").onclick =
        async () => {

            const days =
                Number(
                    $("manageDays")
                        .value
                );


            if (
                !Number.isInteger(days) ||
                days < 1
            ) {

                showMessage(
                    "Enter a valid number of days.",
                    "error"
                );

                return;
            }


            if (
                !confirm(
                    `Extend this subscription by ${days} day(s)?`
                )
            ) {
                return;
            }


            try {

                await adminAction(
                    "extend_subscription",
                    {
                        user_id:
                            user.id,

                        days
                    }
                );


                showMessage(
                    `Subscription extended by ${days} day(s).`
                );


                modal.remove();

                await loadUsers();

            } catch (error) {

                showMessage(
                    error.message ||
                    "Unable to extend subscription.",
                    "error"
                );
            }
        };
}


/* =========================================================
   WEBSITES
========================================================= */

async function loadWebsites() {

    loading("Loading websites...");

    try {

        const data = await api("websites");

        const websites = Array.isArray(data.websites)
            ? data.websites
            : [];

        $("content").innerHTML = `

            <div class="card">

                <div class="admin-header">

                    <div>
                        <h2>Websites</h2>

                        <p>
                            ${websites.length}
                            website record(s).
                        </p>
                    </div>

                    <button
                        id="websitesRefresh"
                        type="button"
                    >
                        Refresh
                    </button>

                </div>


                ${
                    websites.length
                        ? `

                    <div style="
                        display:flex;
                        gap:12px;
                        flex-wrap:wrap;
                        margin-bottom:18px;
                    ">

                        <input
                            id="websiteSearch"
                            class="search-box"
                            type="search"
                            placeholder="Search website name, URL or status..."
                            autocomplete="off"
                        >

                        <select
                            id="websiteStatusFilter"
                            style="
                                padding:12px;
                                border:1px solid #d1d5db;
                                border-radius:8px;
                                min-width:160px;
                            "
                        >
                            <option value="">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="pending">Pending</option>
                            <option value="error">Error</option>
                        </select>

                    </div>


                    <div
                        id="websiteResultCount"
                        style="
                            margin-bottom:12px;
                            color:#6b7280;
                            font-size:14px;
                        "
                    >
                        Showing ${websites.length} website(s)
                    </div>


                    <div class="admin-table-wrapper">

                        <table class="admin-table">

                            <thead>

                                <tr>

                                    <th>Name</th>

                                    <th>URL</th>

                                    <th>User ID</th>

                                    <th>Status</th>

                                    <th>Crawl Frequency</th>

                                    <th>Last Crawled</th>

                                    <th>Created</th>

                                    <th>Action</th>

                                </tr>

                            </thead>

                            <tbody id="websitesTableBody">

                                ${websites.map((site, index) => `

                                    <tr
                                        class="website-row"
                                        data-index="${index}"
                                        data-name="${escapeHtml(
                                            String(site.name || "")
                                        ).toLowerCase()}"
                                        data-url="${escapeHtml(
                                            String(site.url || "")
                                        ).toLowerCase()}"
                                        data-status="${escapeHtml(
                                            String(site.status || "")
                                        ).toLowerCase()}"
                                    >

                                        <td>
                                            <strong>
                                                ${escapeHtml(
                                                    site.name || "Untitled Website"
                                                )}
                                            </strong>
                                        </td>


                                        <td>

                                            ${
                                                site.url
                                                    ? `
                                                        <a
                                                            href="${escapeHtml(site.url)}"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style="
                                                                color:#7c3aed;
                                                                text-decoration:none;
                                                                word-break:break-all;
                                                            "
                                                        >
                                                            ${escapeHtml(site.url)}
                                                        </a>
                                                    `
                                                    : "—"
                                            }

                                        </td>


                                        <td>
                                            <small>
                                                ${escapeHtml(
                                                    site.user_id || "—"
                                                )}
                                            </small>
                                        </td>


                                        <td>

                                            <span class="badge">

                                                ${escapeHtml(
                                                    site.status || "—"
                                                )}

                                            </span>

                                        </td>


                                        <td>
                                            ${escapeHtml(
                                                site.crawl_frequency || "—"
                                            )}
                                        </td>


                                        <td>
                                            ${formatDate(
                                                site.last_crawled_at
                                            )}
                                        </td>


                                        <td>
                                            ${formatDateOnly(
                                                site.created_at
                                            )}
                                        </td>


                                        <td>

                                            <button
                                                type="button"
                                                class="website-view-btn"
                                                data-index="${index}"
                                            >
                                                View
                                            </button>

                                        </td>

                                    </tr>

                                `).join("")}

                            </tbody>

                        </table>

                    </div>

                `
                        : `

                    <div class="empty">

                        <h3>No websites found</h3>

                        <p>
                            No website records are currently available.
                        </p>

                    </div>

                `
                }

            </div>


            <!-- WEBSITE DETAILS MODAL -->

            <div
                id="websiteDetailsModal"
                style="
                    display:none;
                    position:fixed;
                    inset:0;
                    background:rgba(0,0,0,.55);
                    z-index:9999;
                    padding:20px;
                    overflow:auto;
                "
            >

                <div
                    style="
                        max-width:720px;
                        margin:60px auto;
                        background:#fff;
                        border-radius:14px;
                        padding:24px;
                        box-shadow:0 20px 60px rgba(0,0,0,.25);
                    "
                >

                    <div
                        style="
                            display:flex;
                            justify-content:space-between;
                            align-items:center;
                            gap:15px;
                            margin-bottom:20px;
                        "
                    >

                        <h2
                            id="websiteModalTitle"
                            style="margin:0;"
                        >
                            Website Details
                        </h2>

                        <button
                            id="websiteModalClose"
                            type="button"
                        >
                            ×
                        </button>

                    </div>


                    <div
                        id="websiteModalBody"
                    ></div>


                    <div
                        style="
                            margin-top:24px;
                            display:flex;
                            justify-content:flex-end;
                        "
                    >

                        <button
                            id="websiteModalCloseBottom"
                            type="button"
                        >
                            Close
                        </button>

                    </div>

                </div>

            </div>

        `;


        /* =====================================================
           REFRESH
        ===================================================== */

        const refreshButton =
            $("websitesRefresh");

        if (refreshButton) {

            refreshButton.onclick =
                () => loadWebsites();

        }


        /* =====================================================
           SEARCH + STATUS FILTER
        ===================================================== */

        const searchInput =
            $("websiteSearch");

        const statusFilter =
            $("websiteStatusFilter");

        const resultCount =
            $("websiteResultCount");


        function filterWebsites() {

            const search =
                String(
                    searchInput?.value || ""
                )
                    .trim()
                    .toLowerCase();

            const status =
                String(
                    statusFilter?.value || ""
                )
                    .trim()
                    .toLowerCase();


            const rows =
                document.querySelectorAll(
                    ".website-row"
                );


            let visibleCount = 0;


            rows.forEach(row => {

                const name =
                    row.dataset.name || "";

                const url =
                    row.dataset.url || "";

                const rowStatus =
                    row.dataset.status || "";


                const matchesSearch =
                    !search ||
                    name.includes(search) ||
                    url.includes(search) ||
                    rowStatus.includes(search);


                const matchesStatus =
                    !status ||
                    rowStatus === status;


                const visible =
                    matchesSearch &&
                    matchesStatus;


                row.style.display =
                    visible
                        ? ""
                        : "none";


                if (visible) {
                    visibleCount++;
                }

            });


            if (resultCount) {

                resultCount.textContent =
                    `Showing ${visibleCount} website(s)`;

            }

        }


        if (searchInput) {

            searchInput.addEventListener(
                "input",
                filterWebsites
            );

        }


        if (statusFilter) {

            statusFilter.addEventListener(
                "change",
                filterWebsites
            );

        }


        /* =====================================================
           MODAL
        ===================================================== */

        const modal =
            $("websiteDetailsModal");

        const modalBody =
            $("websiteModalBody");

        const modalTitle =
            $("websiteModalTitle");


        function closeWebsiteModal() {

            if (modal) {

                modal.style.display =
                    "none";

            }

        }


        const closeTop =
            $("websiteModalClose");

        const closeBottom =
            $("websiteModalCloseBottom");


        if (closeTop) {

            closeTop.onclick =
                closeWebsiteModal;

        }


        if (closeBottom) {

            closeBottom.onclick =
                closeWebsiteModal;

        }


        if (modal) {

            modal.addEventListener(
                "click",
                event => {

                    if (
                        event.target === modal
                    ) {

                        closeWebsiteModal();

                    }

                }
            );

        }


        /* =====================================================
           VIEW WEBSITE
        ===================================================== */

        document
            .querySelectorAll(
                ".website-view-btn"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        const index =
                            Number(
                                button.dataset.index
                            );


                        const site =
                            websites[index];


                        if (!site) {
                            return;
                        }


                        if (modalTitle) {

                            modalTitle.textContent =
                                site.name ||
                                "Website Details";

                        }


                        if (modalBody) {

                            modalBody.innerHTML = `

                                <div
                                    style="
                                        display:grid;
                                        grid-template-columns:
                                            minmax(150px,180px)
                                            1fr;
                                        gap:0;
                                        border:1px solid #e5e7eb;
                                        border-radius:10px;
                                        overflow:hidden;
                                    "
                                >

                                    <div style="
                                        padding:12px;
                                        background:#f9fafb;
                                        font-weight:600;
                                    ">
                                        Website ID
                                    </div>

                                    <div style="
                                        padding:12px;
                                        word-break:break-all;
                                    ">
                                        ${escapeHtml(
                                            site.id || "—"
                                        )}
                                    </div>


                                    <div style="
                                        padding:12px;
                                        background:#f9fafb;
                                        font-weight:600;
                                    ">
                                        Name
                                    </div>

                                    <div style="padding:12px;">
                                        ${escapeHtml(
                                            site.name ||
                                            "—"
                                        )}
                                    </div>


                                    <div style="
                                        padding:12px;
                                        background:#f9fafb;
                                        font-weight:600;
                                    ">
                                        URL
                                    </div>

                                    <div style="
                                        padding:12px;
                                        word-break:break-all;
                                    ">

                                        ${
                                            site.url
                                                ? `
                                                    <a
                                                        href="${escapeHtml(site.url)}"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        ${escapeHtml(site.url)}
                                                    </a>
                                                `
                                                : "—"
                                        }

                                    </div>


                                    <div style="
                                        padding:12px;
                                        background:#f9fafb;
                                        font-weight:600;
                                    ">
                                        User ID
                                    </div>

                                    <div style="
                                        padding:12px;
                                        word-break:break-all;
                                    ">
                                        ${escapeHtml(
                                            site.user_id ||
                                            "—"
                                        )}
                                    </div>


                                    <div style="
                                        padding:12px;
                                        background:#f9fafb;
                                        font-weight:600;
                                    ">
                                        Status
                                    </div>

                                    <div style="padding:12px;">
                                        <span class="badge">
                                            ${escapeHtml(
                                                site.status ||
                                                "—"
                                            )}
                                        </span>
                                    </div>


                                    <div style="
                                        padding:12px;
                                        background:#f9fafb;
                                        font-weight:600;
                                    ">
                                        Crawl Frequency
                                    </div>

                                    <div style="padding:12px;">
                                        ${escapeHtml(
                                            site.crawl_frequency ||
                                            "—"
                                        )}
                                    </div>


                                    <div style="
                                        padding:12px;
                                        background:#f9fafb;
                                        font-weight:600;
                                    ">
                                        Last Crawled
                                    </div>

                                    <div style="padding:12px;">
                                        ${formatDate(
                                            site.last_crawled_at
                                        )}
                                    </div>


                                    <div style="
                                        padding:12px;
                                        background:#f9fafb;
                                        font-weight:600;
                                    ">
                                        Created
                                    </div>

                                    <div style="padding:12px;">
                                        ${formatDate(
                                            site.created_at
                                        )}
                                    </div>


                                    <div style="
                                        padding:12px;
                                        background:#f9fafb;
                                        font-weight:600;
                                    ">
                                        Updated
                                    </div>

                                    <div style="padding:12px;">
                                        ${formatDate(
                                            site.updated_at
                                        )}
                                    </div>

                                </div>

                            `;

                        }


                        if (modal) {

                            modal.style.display =
                                "block";

                        }

                    }
                );

            });


    } catch (error) {

        console.error(
            "Websites section error:",
            error
        );


        $("content").innerHTML = `

            <div class="card">

                <div
                    style="
                        padding:25px;
                        text-align:center;
                    "
                >

                    <h2>
                        Unable to load websites
                    </h2>

                    <p>
                        ${
                            escapeHtml(
                                error?.message ||
                                "An unexpected error occurred."
                            )
                        }
                    </p>

                    <button
                        id="websitesRetry"
                        type="button"
                    >
                        Retry
                    </button>

                </div>

            </div>

        `;


        const retry =
            $("websitesRetry");

        if (retry) {

            retry.onclick =
                () => loadWebsites();

        }

    }

}


/* =========================================================
   SUBSCRIPTIONS
========================================================= */

async function loadSubscriptions() {

    loading(
        "Loading subscriptions..."
    );

    try {

        const data =
            await api(
                "subscriptions"
            );

        const subscriptions =
            Array.isArray(
                data?.subscriptions
            )
                ? data.subscriptions
                : [];


        $("content").innerHTML = `

            <div class="card">

                <div class="admin-header">

                    <div>

                        <h2>
                            Subscriptions
                        </h2>

                        <p>
                            ${subscriptions.length}
                            subscription record(s).
                        </p>

                    </div>


                    <button
                        id="subscriptionsRefresh"
                        type="button"
                    >
                        Refresh
                    </button>

                </div>


                ${
                    subscriptions.length
                        ? `

                    <div
                        style="
                            display:flex;
                            gap:12px;
                            flex-wrap:wrap;
                            margin-bottom:18px;
                        "
                    >

                        <input
                            id="subscriptionSearch"
                            class="search-box"
                            type="search"
                            placeholder="Search user, plan, provider or ID..."
                            autocomplete="off"
                        >


                        <select
                            id="subscriptionStatusFilter"
                            style="
                                padding:12px;
                                border:1px solid #d1d5db;
                                border-radius:8px;
                                min-width:160px;
                            "
                        >

                            <option value="">
                                All Statuses
                            </option>

                            <option value="trial">
                                Trial
                            </option>

                            <option value="active">
                                Active
                            </option>

                            <option value="cancelled">
                                Cancelled
                            </option>

                            <option value="expired">
                                Expired
                            </option>

                            <option value="past_due">
                                Past Due
                            </option>

                        </select>


                        <select
                            id="subscriptionPlanFilter"
                            style="
                                padding:12px;
                                border:1px solid #d1d5db;
                                border-radius:8px;
                                min-width:150px;
                            "
                        >

                            <option value="">
                                All Plans
                            </option>

                            ${[
                                ...new Set(
                                    subscriptions
                                        .map(
                                            sub =>
                                                String(
                                                    sub.plan_id || ""
                                                )
                                                    .trim()
                                            )
                                        .filter(Boolean)
                                )
                            ]
                                .sort()
                                .map(
                                    plan => `
                                        <option
                                            value="${escapeHtml(plan)}"
                                        >
                                            ${escapeHtml(plan)}
                                        </option>
                                    `
                                )
                                .join("")}

                        </select>

                    </div>


                    <div
                        id="subscriptionResultCount"
                        style="
                            margin-bottom:12px;
                            color:#6b7280;
                            font-size:14px;
                        "
                    >
                        Showing ${subscriptions.length}
                        subscription(s)
                    </div>


                    <div class="admin-table-wrapper">

                        <table class="admin-table">

                            <thead>

                                <tr>

                                    <th>
                                        User
                                    </th>

                                    <th>
                                        Plan
                                    </th>

                                    <th>
                                        Billing
                                    </th>

                                    <th>
                                        Status
                                    </th>

                                    <th>
                                        Provider
                                    </th>

                                    <th>
                                        Started
                                    </th>

                                    <th>
                                        Ends
                                    </th>

                                    <th>
                                        Updated
                                    </th>

                                    <th>
                                        Action
                                    </th>

                                </tr>

                            </thead>


                            <tbody id="subscriptionsTableBody">

                                ${subscriptions
                                    .map(
                                        (
                                            sub,
                                            index
                                        ) => {

                                            const searchable =
                                                [
                                                    sub.id,
                                                    sub.user_id,
                                                    sub.plan_id,
                                                    sub.billing_cycle,
                                                    sub.status,
                                                    sub.provider,
                                                    sub.provider_customer_id,
                                                    sub.provider_subscription_id,
                                                    sub.razorpay_order_id,
                                                    sub.razorpay_payment_id
                                                ]
                                                    .filter(Boolean)
                                                    .join(" ")
                                                    .toLowerCase();


                                            return `

                                                <tr
                                                    class="subscription-row"
                                                    data-index="${index}"
                                                    data-search="${escapeHtml(
                                                        searchable
                                                    )}"
                                                    data-status="${escapeHtml(
                                                        String(
                                                            sub.status ||
                                                            ""
                                                        ).toLowerCase()
                                                    )}"
                                                    data-plan="${escapeHtml(
                                                        String(
                                                            sub.plan_id ||
                                                            ""
                                                        ).toLowerCase()
                                                    )}"
                                                >

                                                    <td>

                                                        <strong>
                                                            ${escapeHtml(
                                                                sub.user_email ||
                                                                sub.email ||
                                                                sub.user_id ||
                                                                "—"
                                                            )}
                                                        </strong>

                                                        ${
                                                            sub.user_id
                                                                ? `
                                                                    <br>
                                                                    <small
                                                                        style="
                                                                            color:#6b7280;
                                                                            word-break:break-all;
                                                                        "
                                                                    >
                                                                        ${escapeHtml(
                                                                            sub.user_id
                                                                        )}
                                                                    </small>
                                                                `
                                                                : ""
                                                        }

                                                    </td>


                                                    <td>

                                                        <span
                                                            class="badge"
                                                        >
                                                            ${escapeHtml(
                                                                sub.plan_id ||
                                                                "—"
                                                            )}
                                                        </span>

                                                    </td>


                                                    <td>
                                                        ${escapeHtml(
                                                            sub.billing_cycle ||
                                                            "—"
                                                        )}
                                                    </td>


                                                    <td>

                                                        <span
                                                            class="badge"
                                                        >
                                                            ${escapeHtml(
                                                                sub.status ||
                                                                "—"
                                                            )}
                                                        </span>

                                                    </td>


                                                    <td>
                                                        ${escapeHtml(
                                                            sub.provider ||
                                                            "—"
                                                        )}
                                                    </td>


                                                    <td>
                                                        ${formatDate(
                                                            sub.started_at
                                                        )}
                                                    </td>


                                                    <td>
                                                        ${formatDate(
                                                            sub.subscription_ends_at
                                                        )}
                                                    </td>


                                                    <td>
                                                        ${formatDate(
                                                            sub.updated_at
                                                        )}
                                                    </td>


                                                    <td>

                                                        <button
                                                            type="button"
                                                            class="subscription-view-btn"
                                                            data-index="${index}"
                                                        >
                                                            View
                                                        </button>

                                                    </td>

                                                </tr>

                                            `;

                                        }
                                    )
                                    .join("")}

                            </tbody>

                        </table>

                    </div>

                `
                        : `

                    <div class="empty">

                        <h3>
                            No subscriptions found
                        </h3>

                        <p>
                            No subscription records are currently available.
                        </p>

                    </div>

                `
                }

            </div>


            <!-- SUBSCRIPTION DETAILS MODAL -->

            <div
                id="subscriptionDetailsModal"
                style="
                    display:none;
                    position:fixed;
                    inset:0;
                    background:rgba(0,0,0,.55);
                    z-index:9999;
                    padding:20px;
                    overflow:auto;
                "
            >

                <div
                    style="
                        max-width:760px;
                        margin:50px auto;
                        background:#fff;
                        border-radius:14px;
                        padding:24px;
                        box-shadow:0 20px 60px rgba(0,0,0,.25);
                    "
                >

                    <div
                        style="
                            display:flex;
                            align-items:center;
                            justify-content:space-between;
                            gap:15px;
                            margin-bottom:20px;
                        "
                    >

                        <h2
                            id="subscriptionModalTitle"
                            style="margin:0;"
                        >
                            Subscription Details
                        </h2>


                        <button
                            id="subscriptionModalClose"
                            type="button"
                        >
                            ×
                        </button>

                    </div>


                    <div
                        id="subscriptionModalBody"
                    ></div>


                    <div
                        style="
                            margin-top:24px;
                            text-align:right;
                        "
                    >

                        <button
                            id="subscriptionModalCloseBottom"
                            type="button"
                        >
                            Close
                        </button>

                    </div>

                </div>

            </div>

        `;


        /* =====================================================
           REFRESH
        ===================================================== */

        const refresh =
            $("subscriptionsRefresh");

        if (refresh) {

            refresh.onclick =
                () =>
                    loadSubscriptions();

        }


        /* =====================================================
           FILTERS
        ===================================================== */

        const searchInput =
            $("subscriptionSearch");

        const statusFilter =
            $("subscriptionStatusFilter");

        const planFilter =
            $("subscriptionPlanFilter");

        const resultCount =
            $("subscriptionResultCount");


        function filterSubscriptions() {

            const search =
                String(
                    searchInput?.value ||
                    ""
                )
                    .trim()
                    .toLowerCase();


            const status =
                String(
                    statusFilter?.value ||
                    ""
                )
                    .trim()
                    .toLowerCase();


            const plan =
                String(
                    planFilter?.value ||
                    ""
                )
                    .trim()
                    .toLowerCase();


            const rows =
                document.querySelectorAll(
                    ".subscription-row"
                );


            let visible =
                0;


            rows.forEach(
                row => {

                    const rowSearch =
                        row.dataset.search ||
                        "";

                    const rowStatus =
                        row.dataset.status ||
                        "";

                    const rowPlan =
                        row.dataset.plan ||
                        "";


                    const matchesSearch =
                        !search ||
                        rowSearch.includes(
                            search
                        );


                    const matchesStatus =
                        !status ||
                        rowStatus ===
                            status;


                    const matchesPlan =
                        !plan ||
                        rowPlan ===
                            plan;


                    const show =
                        matchesSearch &&
                        matchesStatus &&
                        matchesPlan;


                    row.style.display =
                        show
                            ? ""
                            : "none";


                    if (show) {
                        visible++;
                    }

                }
            );


            if (resultCount) {

                resultCount.textContent =
                    `Showing ${visible} subscription(s)`;

            }

        }


        if (searchInput) {

            searchInput.addEventListener(
                "input",
                filterSubscriptions
            );

        }


        if (statusFilter) {

            statusFilter.addEventListener(
                "change",
                filterSubscriptions
            );

        }


        if (planFilter) {

            planFilter.addEventListener(
                "change",
                filterSubscriptions
            );

        }


        /* =====================================================
           MODAL
        ===================================================== */

        const modal =
            $("subscriptionDetailsModal");

        const modalTitle =
            $("subscriptionModalTitle");

        const modalBody =
            $("subscriptionModalBody");


        function closeSubscriptionModal() {

            if (modal) {

                modal.style.display =
                    "none";

            }

        }


        $("subscriptionModalClose")
            ?.addEventListener(
                "click",
                closeSubscriptionModal
            );


        $("subscriptionModalCloseBottom")
            ?.addEventListener(
                "click",
                closeSubscriptionModal
            );


        if (modal) {

            modal.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        modal
                    ) {

                        closeSubscriptionModal();

                    }

                }
            );

        }


        /* =====================================================
           VIEW DETAILS
        ===================================================== */

        document
            .querySelectorAll(
                ".subscription-view-btn"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            const index =
                                Number(
                                    button.dataset.index
                                );


                            const sub =
                                subscriptions[
                                    index
                                ];


                            if (!sub) {
                                return;
                            }


                            if (modalTitle) {

                                modalTitle.textContent =
                                    "Subscription Details";

                            }


                            if (modalBody) {

                                modalBody.innerHTML = `

                                    <div
                                        style="
                                            display:grid;
                                            grid-template-columns:
                                                minmax(170px,190px)
                                                1fr;
                                            border:1px solid #e5e7eb;
                                            border-radius:10px;
                                            overflow:hidden;
                                        "
                                    >

                                        <div class="subscription-detail-label">
                                            Subscription ID
                                        </div>

                                        <div class="subscription-detail-value">
                                            ${escapeHtml(
                                                sub.id ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="subscription-detail-label">
                                            User ID
                                        </div>

                                        <div class="subscription-detail-value">
                                            ${escapeHtml(
                                                sub.user_id ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="subscription-detail-label">
                                            Plan
                                        </div>

                                        <div class="subscription-detail-value">
                                            ${escapeHtml(
                                                sub.plan_id ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="subscription-detail-label">
                                            Billing Cycle
                                        </div>

                                        <div class="subscription-detail-value">
                                            ${escapeHtml(
                                                sub.billing_cycle ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="subscription-detail-label">
                                            Status
                                        </div>

                                        <div class="subscription-detail-value">

                                            <span class="badge">
                                                ${escapeHtml(
                                                    sub.status ||
                                                    "—"
                                                )}
                                            </span>

                                        </div>


                                        <div class="subscription-detail-label">
                                            Provider
                                        </div>

                                        <div class="subscription-detail-value">
                                            ${escapeHtml(
                                                sub.provider ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="subscription-detail-label">
                                            Provider Customer ID
                                        </div>

                                        <div class="subscription-detail-value">
                                            ${escapeHtml(
                                                sub.provider_customer_id ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="subscription-detail-label">
                                            Provider Subscription ID
                                        </div>

                                        <div class="subscription-detail-value">
                                            ${escapeHtml(
                                                sub.provider_subscription_id ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="subscription-detail-label">
                                            Razorpay Order ID
                                        </div>

                                        <div class="subscription-detail-value">
                                            ${escapeHtml(
                                                sub.razorpay_order_id ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="subscription-detail-label">
                                            Razorpay Payment ID
                                        </div>

                                        <div class="subscription-detail-value">
                                            ${escapeHtml(
                                                sub.razorpay_payment_id ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="subscription-detail-label">
                                            Payment Amount
                                        </div>

                                        <div class="subscription-detail-value">
                                            ${escapeHtml(
                                                sub.payment_amount ??
                                                "—"
                                            )}
                                            ${
                                                sub.currency
                                                    ? `
                                                        ${escapeHtml(
                                                            sub.currency
                                                        )}
                                                    `
                                                    : ""
                                            }
                                        </div>


                                        <div class="subscription-detail-label">
                                            Last Payment
                                        </div>

                                        <div class="subscription-detail-value">
                                            ${formatDate(
                                                sub.last_payment_at
                                            )}
                                        </div>


                                        <div class="subscription-detail-label">
                                            Started
                                        </div>

                                        <div class="subscription-detail-value">
                                            ${formatDate(
                                                sub.started_at
                                            )}
                                        </div>


                                        <div class="subscription-detail-label">
                                            Subscription Ends
                                        </div>

                                        <div class="subscription-detail-value">
                                            ${formatDate(
                                                sub.subscription_ends_at
                                            )}
                                        </div>


                                        <div class="subscription-detail-label">
                                            Created
                                        </div>

                                        <div class="subscription-detail-value">
                                            ${formatDate(
                                                sub.created_at
                                            )}
                                        </div>


                                        <div class="subscription-detail-label">
                                            Updated
                                        </div>

                                        <div class="subscription-detail-value">
                                            ${formatDate(
                                                sub.updated_at
                                            )}
                                        </div>

                                    </div>

                                    <style>

                                        .subscription-detail-label {
                                            padding:12px;
                                            background:#f9fafb;
                                            border-bottom:1px solid #e5e7eb;
                                            font-weight:600;
                                        }

                                        .subscription-detail-value {
                                            padding:12px;
                                            border-bottom:1px solid #e5e7eb;
                                            word-break:break-word;
                                        }

                                    </style>

                                `;

                            }


                            if (modal) {

                                modal.style.display =
                                    "block";

                            }

                        }
                    );

                }
            );


    } catch (error) {

        console.error(
            "Subscriptions section error:",
            error
        );


        $("content").innerHTML = `

            <div class="card">

                <div
                    style="
                        padding:25px;
                        text-align:center;
                    "
                >

                    <h2>
                        Unable to load subscriptions
                    </h2>

                    <p>
                        ${escapeHtml(
                            error?.message ||
                            "An unexpected error occurred."
                        )}
                    </p>

                    <button
                        id="subscriptionsRetry"
                        type="button"
                    >
                        Retry
                    </button>

                </div>

            </div>

        `;


        $("subscriptionsRetry")
            ?.addEventListener(
                "click",
                () =>
                    loadSubscriptions()
            );

    }

}

/* =========================================================
   PAYMENTS
========================================================= */

async function loadPayments() {

    loading(
        "Loading payments..."
    );

    try {

        const data =
            await api(
                "payments"
            );

        const payments =
            Array.isArray(
                data?.payments
            )
                ? data.payments
                : [];


        $("content").innerHTML = `

            <div class="card">

                <div class="admin-header">

                    <div>

                        <h2>
                            Payments
                        </h2>

                        <p>
                            ${payments.length}
                            payment record(s).
                        </p>

                    </div>


                    <button
                        id="paymentsRefresh"
                        type="button"
                    >
                        Refresh
                    </button>

                </div>


                ${
                    payments.length
                        ? `

                    <div
                        style="
                            display:flex;
                            gap:12px;
                            flex-wrap:wrap;
                            margin-bottom:18px;
                        "
                    >

                        <input
                            id="paymentSearch"
                            class="search-box"
                            type="search"
                            placeholder="Search user, payment ID, order ID or plan..."
                            autocomplete="off"
                        >


                        <select
                            id="paymentStatusFilter"
                            style="
                                padding:12px;
                                border:1px solid #d1d5db;
                                border-radius:8px;
                                min-width:160px;
                            "
                        >

                            <option value="">
                                All Statuses
                            </option>

                            <option value="paid">
                                Paid
                            </option>

                            <option value="success">
                                Success
                            </option>

                            <option value="captured">
                                Captured
                            </option>

                            <option value="failed">
                                Failed
                            </option>

                            <option value="pending">
                                Pending
                            </option>

                            <option value="refunded">
                                Refunded
                            </option>

                            <option value="cancelled">
                                Cancelled
                            </option>

                        </select>


                        <select
                            id="paymentCurrencyFilter"
                            style="
                                padding:12px;
                                border:1px solid #d1d5db;
                                border-radius:8px;
                                min-width:130px;
                            "
                        >

                            <option value="">
                                All Currencies
                            </option>

                            ${[
                                ...new Set(
                                    payments
                                        .map(
                                            payment =>
                                                String(
                                                    payment.currency ||
                                                    ""
                                                )
                                                    .trim()
                                                    .toUpperCase()
                                        )
                                        .filter(Boolean)
                                )
                            ]
                                .sort()
                                .map(
                                    currency => `
                                        <option
                                            value="${escapeHtml(currency)}"
                                        >
                                            ${escapeHtml(currency)}
                                        </option>
                                    `
                                )
                                .join("")}

                        </select>

                    </div>


                    <div
                        id="paymentResultCount"
                        style="
                            margin-bottom:12px;
                            color:#6b7280;
                            font-size:14px;
                        "
                    >
                        Showing ${payments.length}
                        payment(s)
                    </div>


                    <div class="admin-table-wrapper">

                        <table class="admin-table">

                            <thead>

                                <tr>

                                    <th>
                                        User
                                    </th>

                                    <th>
                                        Plan
                                    </th>

                                    <th>
                                        Amount
                                    </th>

                                    <th>
                                        Currency
                                    </th>

                                    <th>
                                        Order ID
                                    </th>

                                    <th>
                                        Payment ID
                                    </th>

                                    <th>
                                        Payment Date
                                    </th>

                                    <th>
                                        Status
                                    </th>

                                    <th>
                                        Action
                                    </th>

                                </tr>

                            </thead>


                            <tbody id="paymentsTableBody">

                                ${payments
                                    .map(
                                        (
                                            payment,
                                            index
                                        ) => {

                                            const searchable =
                                                [
                                                    payment.id,
                                                    payment.user_id,
                                                    payment.plan_id,
                                                    payment.billing_cycle,
                                                    payment.status,
                                                    payment.currency,
                                                    payment.razorpay_order_id,
                                                    payment.razorpay_payment_id
                                                ]
                                                    .filter(Boolean)
                                                    .join(" ")
                                                    .toLowerCase();


                                            const currency =
                                                String(
                                                    payment.currency ||
                                                    ""
                                                )
                                                    .trim()
                                                    .toLowerCase();


                                            const status =
                                                String(
                                                    payment.status ||
                                                    ""
                                                )
                                                    .trim()
                                                    .toLowerCase();


                                            return `

                                                <tr
                                                    class="payment-row"
                                                    data-index="${index}"
                                                    data-search="${escapeHtml(
                                                        searchable
                                                    )}"
                                                    data-status="${escapeHtml(
                                                        status
                                                    )}"
                                                    data-currency="${escapeHtml(
                                                        currency
                                                    )}"
                                                >

                                                    <td>

                                                        <strong>
                                                            ${escapeHtml(
                                                                payment.user_email ||
                                                                payment.email ||
                                                                payment.user_id ||
                                                                "—"
                                                            )}
                                                        </strong>

                                                        ${
                                                            payment.user_id
                                                                ? `
                                                                    <br>
                                                                    <small
                                                                        style="
                                                                            color:#6b7280;
                                                                            word-break:break-all;
                                                                        "
                                                                    >
                                                                        ${escapeHtml(
                                                                            payment.user_id
                                                                        )}
                                                                    </small>
                                                                `
                                                                : ""
                                                        }

                                                    </td>


                                                    <td>

                                                        <span
                                                            class="badge"
                                                        >
                                                            ${escapeHtml(
                                                                payment.plan_id ||
                                                                "—"
                                                            )}
                                                        </span>

                                                    </td>


                                                    <td>

                                                        <strong>
                                                            ${escapeHtml(
                                                                payment.payment_amount ??
                                                                "—"
                                                            )}
                                                        </strong>

                                                    </td>


                                                    <td>
                                                        ${escapeHtml(
                                                            payment.currency ||
                                                            "—"
                                                        )}
                                                    </td>


                                                    <td>

                                                        <small
                                                            style="
                                                                word-break:break-all;
                                                            "
                                                        >
                                                            ${escapeHtml(
                                                                payment.razorpay_order_id ||
                                                                "—"
                                                            )}
                                                        </small>

                                                    </td>


                                                    <td>

                                                        <small
                                                            style="
                                                                word-break:break-all;
                                                            "
                                                        >
                                                            ${escapeHtml(
                                                                payment.razorpay_payment_id ||
                                                                "—"
                                                            )}
                                                        </small>

                                                    </td>


                                                    <td>
                                                        ${formatDate(
                                                            payment.last_payment_at
                                                        )}
                                                    </td>


                                                    <td>

                                                        <span
                                                            class="badge"
                                                        >
                                                            ${escapeHtml(
                                                                payment.status ||
                                                                "—"
                                                            )}
                                                        </span>

                                                    </td>


                                                    <td>

                                                        <button
                                                            type="button"
                                                            class="payment-view-btn"
                                                            data-index="${index}"
                                                        >
                                                            View
                                                        </button>

                                                    </td>

                                                </tr>

                                            `;

                                        }
                                    )
                                    .join("")}

                            </tbody>

                        </table>

                    </div>

                `
                        : `

                    <div class="empty">

                        <h3>
                            No payment records found
                        </h3>

                        <p>
                            No payments have been recorded yet.
                        </p>

                    </div>

                `
                }

            </div>


            <!-- PAYMENT DETAILS MODAL -->

            <div
                id="paymentDetailsModal"
                style="
                    display:none;
                    position:fixed;
                    inset:0;
                    background:rgba(0,0,0,.55);
                    z-index:9999;
                    padding:20px;
                    overflow:auto;
                "
            >

                <div
                    style="
                        max-width:760px;
                        margin:50px auto;
                        background:#fff;
                        border-radius:14px;
                        padding:24px;
                        box-shadow:0 20px 60px rgba(0,0,0,.25);
                    "
                >

                    <div
                        style="
                            display:flex;
                            align-items:center;
                            justify-content:space-between;
                            gap:15px;
                            margin-bottom:20px;
                        "
                    >

                        <h2
                            id="paymentModalTitle"
                            style="margin:0;"
                        >
                            Payment Details
                        </h2>


                        <button
                            id="paymentModalClose"
                            type="button"
                        >
                            ×
                        </button>

                    </div>


                    <div
                        id="paymentModalBody"
                    ></div>


                    <div
                        style="
                            margin-top:24px;
                            text-align:right;
                        "
                    >

                        <button
                            id="paymentModalCloseBottom"
                            type="button"
                        >
                            Close
                        </button>

                    </div>

                </div>

            </div>

        `;


        /* =====================================================
           REFRESH
        ===================================================== */

        const refresh =
            $("paymentsRefresh");

        if (refresh) {

            refresh.onclick =
                () => loadPayments();

        }


        /* =====================================================
           FILTERS
        ===================================================== */

        const searchInput =
            $("paymentSearch");

        const statusFilter =
            $("paymentStatusFilter");

        const currencyFilter =
            $("paymentCurrencyFilter");

        const resultCount =
            $("paymentResultCount");


        function filterPayments() {

            const search =
                String(
                    searchInput?.value ||
                    ""
                )
                    .trim()
                    .toLowerCase();


            const status =
                String(
                    statusFilter?.value ||
                    ""
                )
                    .trim()
                    .toLowerCase();


            const currency =
                String(
                    currencyFilter?.value ||
                    ""
                )
                    .trim()
                    .toLowerCase();


            const rows =
                document.querySelectorAll(
                    ".payment-row"
                );


            let visible =
                0;


            rows.forEach(
                row => {

                    const rowSearch =
                        row.dataset.search ||
                        "";

                    const rowStatus =
                        row.dataset.status ||
                        "";

                    const rowCurrency =
                        row.dataset.currency ||
                        "";


                    const matchesSearch =
                        !search ||
                        rowSearch.includes(
                            search
                        );


                    const matchesStatus =
                        !status ||
                        rowStatus ===
                            status;


                    const matchesCurrency =
                        !currency ||
                        rowCurrency ===
                            currency;


                    const show =
                        matchesSearch &&
                        matchesStatus &&
                        matchesCurrency;


                    row.style.display =
                        show
                            ? ""
                            : "none";


                    if (show) {
                        visible++;
                    }

                }
            );


            if (resultCount) {

                resultCount.textContent =
                    `Showing ${visible} payment(s)`;

            }

        }


        if (searchInput) {

            searchInput.addEventListener(
                "input",
                filterPayments
            );

        }


        if (statusFilter) {

            statusFilter.addEventListener(
                "change",
                filterPayments
            );

        }


        if (currencyFilter) {

            currencyFilter.addEventListener(
                "change",
                filterPayments
            );

        }


        /* =====================================================
           MODAL
        ===================================================== */

        const modal =
            $("paymentDetailsModal");

        const modalTitle =
            $("paymentModalTitle");

        const modalBody =
            $("paymentModalBody");


        function closePaymentModal() {

            if (modal) {

                modal.style.display =
                    "none";

            }

        }


        $("paymentModalClose")
            ?.addEventListener(
                "click",
                closePaymentModal
            );


        $("paymentModalCloseBottom")
            ?.addEventListener(
                "click",
                closePaymentModal
            );


        if (modal) {

            modal.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        modal
                    ) {

                        closePaymentModal();

                    }

                }
            );

        }


        /* =====================================================
           VIEW PAYMENT
        ===================================================== */

        document
            .querySelectorAll(
                ".payment-view-btn"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            const index =
                                Number(
                                    button.dataset.index
                                );


                            const payment =
                                payments[
                                    index
                                ];


                            if (!payment) {
                                return;
                            }


                            if (modalTitle) {

                                modalTitle.textContent =
                                    "Payment Details";

                            }


                            if (modalBody) {

                                modalBody.innerHTML = `

                                    <div
                                        style="
                                            display:grid;
                                            grid-template-columns:
                                                minmax(180px,200px)
                                                1fr;
                                            border:1px solid #e5e7eb;
                                            border-radius:10px;
                                            overflow:hidden;
                                        "
                                    >

                                        <div class="payment-detail-label">
                                            Payment Record ID
                                        </div>

                                        <div class="payment-detail-value">
                                            ${escapeHtml(
                                                payment.id ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="payment-detail-label">
                                            User ID
                                        </div>

                                        <div class="payment-detail-value">
                                            ${escapeHtml(
                                                payment.user_id ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="payment-detail-label">
                                            Plan
                                        </div>

                                        <div class="payment-detail-value">
                                            ${escapeHtml(
                                                payment.plan_id ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="payment-detail-label">
                                            Billing Cycle
                                        </div>

                                        <div class="payment-detail-value">
                                            ${escapeHtml(
                                                payment.billing_cycle ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="payment-detail-label">
                                            Amount
                                        </div>

                                        <div class="payment-detail-value">

                                            <strong>
                                                ${escapeHtml(
                                                    payment.payment_amount ??
                                                    "—"
                                                )}
                                            </strong>

                                            ${
                                                payment.currency
                                                    ? `
                                                        ${escapeHtml(
                                                            payment.currency
                                                        )}
                                                    `
                                                    : ""
                                            }

                                        </div>


                                        <div class="payment-detail-label">
                                            Status
                                        </div>

                                        <div class="payment-detail-value">

                                            <span class="badge">
                                                ${escapeHtml(
                                                    payment.status ||
                                                    "—"
                                                )}
                                            </span>

                                        </div>


                                        <div class="payment-detail-label">
                                            Razorpay Order ID
                                        </div>

                                        <div class="payment-detail-value">
                                            ${escapeHtml(
                                                payment.razorpay_order_id ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="payment-detail-label">
                                            Razorpay Payment ID
                                        </div>

                                        <div class="payment-detail-value">
                                            ${escapeHtml(
                                                payment.razorpay_payment_id ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="payment-detail-label">
                                            Last Payment
                                        </div>

                                        <div class="payment-detail-value">
                                            ${formatDate(
                                                payment.last_payment_at
                                            )}
                                        </div>


                                        <div class="payment-detail-label">
                                            Created
                                        </div>

                                        <div class="payment-detail-value">
                                            ${formatDate(
                                                payment.created_at
                                            )}
                                        </div>


                                        <div class="payment-detail-label">
                                            Updated
                                        </div>

                                        <div class="payment-detail-value">
                                            ${formatDate(
                                                payment.updated_at
                                            )}
                                        </div>

                                    </div>


                                    <style>

                                        .payment-detail-label {
                                            padding:12px;
                                            background:#f9fafb;
                                            border-bottom:1px solid #e5e7eb;
                                            font-weight:600;
                                        }

                                        .payment-detail-value {
                                            padding:12px;
                                            border-bottom:1px solid #e5e7eb;
                                            word-break:break-word;
                                        }

                                    </style>

                                `;

                            }


                            if (modal) {

                                modal.style.display =
                                    "block";

                            }

                        }
                    );

                }
            );


    } catch (error) {

        console.error(
            "Payments section error:",
            error
        );


        $("content").innerHTML = `

            <div class="card">

                <div
                    style="
                        padding:25px;
                        text-align:center;
                    "
                >

                    <h2>
                        Unable to load payments
                    </h2>

                    <p>
                        ${escapeHtml(
                            error?.message ||
                            "An unexpected error occurred."
                        )}
                    </p>

                    <button
                        id="paymentsRetry"
                        type="button"
                    >
                        Retry
                    </button>

                </div>

            </div>

        `;


        $("paymentsRetry")
            ?.addEventListener(
                "click",
                () =>
                    loadPayments()
            );

    }

}

/* =========================================================
   AI OPERATIONS
========================================================= */

async function loadAI() {

    loading(
        "Loading AI operations..."
    );


    const data =
        await api(
            "ai"
        );


    const runs =
        data.runs || data.ai_runs || [];


    $("content").innerHTML = `

        <div class="card">

            <div class="admin-header">

                <div>

                    <h2>
                        AI Operations
                    </h2>

                    <p>
                        ${runs.length}
                        AI run(s).
                    </p>

                </div>

                <button
                    id="aiRefresh"
                >
                    Refresh
                </button>

            </div>


            ${
                runs.length
                    ? `

                    <div class="admin-table-wrapper">

                        <table class="admin-table">

                            <thead>

                                <tr>

                                    <th>
                                        Agent
                                    </th>

                                    <th>
                                        Provider
                                    </th>

                                    <th>
                                        Model
                                    </th>

                                    <th>
                                        Status
                                    </th>

                                    <th>
                                        Tokens
                                    </th>

                                    <th>
                                        Cost
                                    </th>

                                    <th>
                                        Latency
                                    </th>

                                    <th>
                                        Created
                                    </th>

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
                                                    (
                                                        Number(
                                                            run.input_tokens ||
                                                            0
                                                        ) +
                                                        Number(
                                                            run.output_tokens ||
                                                            0
                                                        )
                                                    )
                                                )}
                                            </td>

                                            <td>
                                                ${escapeHtml(
                                                    run.estimated_cost ??
                                                    "—"
                                                )}
                                            </td>

                                            <td>
                                                ${escapeHtml(
                                                    run.latency_ms ??
                                                    "—"
                                                )} ms
                                            </td>

                                            <td>
                                                ${formatDate(
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

                `
                    : `
                    <div class="empty">
                        No AI runs found.
                    </div>
                `
            }

        </div>
    `;


    $("aiRefresh").onclick =
        () =>
            loadAI();
}


/* =========================================================
   APPROVALS
========================================================= */

async function loadApprovals() {

    loading(
        "Loading approvals..."
    );


    const data =
        await api(
            "approvals"
        );


    const approvals =
        data.approvals || [];


    $("content").innerHTML = `

        <div class="card">

            <div class="admin-header">

                <div>

                    <h2>
                        Approvals
                    </h2>

                    <p>
                        ${approvals.length}
                        approval record(s).
                    </p>

                </div>

                <button
                    id="approvalsRefresh"
                >
                    Refresh
                </button>

            </div>


            ${
                approvals.length
                    ? `

                    <div class="admin-table-wrapper">

                        <table class="admin-table">

                            <thead>

                                <tr>

                                    <th>
                                        Title
                                    </th>

                                    <th>
                                        User
                                    </th>

                                    <th>
                                        Status
                                    </th>

                                    <th>
                                        Risk
                                    </th>

                                    <th>
                                        Created
                                    </th>

                                </tr>

                            </thead>

                            <tbody>

                                ${approvals
                                    .map(
                                        item => `

                                        <tr>

                                            <td>
                                                ${escapeHtml(
                                                    item.title ||
                                                    "—"
                                                )}
                                            </td>

                                            <td>
                                                ${escapeHtml(
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
                                                ${escapeHtml(
                                                    item.risk_level ||
                                                    "—"
                                                )}
                                            </td>

                                            <td>
                                                ${formatDate(
                                                    item.created_at
                                                )}
                                            </td>

                                        </tr>

                                    `
                                    )
                                    .join("")}

                            </tbody>

                        </table>

                    </div>

                `
                    : `
                    <div class="empty">
                        No approval records found.
                    </div>
                `
            }

        </div>
    `;


    $("approvalsRefresh").onclick =
        () =>
            loadApprovals();
}


/* =========================================================
   SUPPORT TICKETS
========================================================= */

async function loadSupport() {

    loading(
        "Loading support tickets..."
    );

    try {

        const data =
            await api(
                "support"
            );

        const tickets =
            Array.isArray(
                data?.tickets
            )
                ? data.tickets
                : Array.isArray(
                    data?.support_tickets
                )
                    ? data.support_tickets
                    : [];


        $("content").innerHTML = `

            <div class="card">

                <div class="admin-header">

                    <div>

                        <h2>
                            Support Tickets
                        </h2>

                        <p>
                            ${tickets.length}
                            ticket(s).
                        </p>

                    </div>


                    <button
                        id="supportRefresh"
                        type="button"
                    >
                        Refresh
                    </button>

                </div>


                ${
                    tickets.length
                        ? `

                    <!-- FILTERS -->

                    <div
                        style="
                            display:flex;
                            gap:12px;
                            flex-wrap:wrap;
                            margin-bottom:18px;
                        "
                    >

                        <input
                            id="supportSearch"
                            class="search-box"
                            type="search"
                            placeholder="Search subject, user, ticket ID..."
                            autocomplete="off"
                        >


                        <select
                            id="supportStatusFilter"
                            style="
                                padding:12px;
                                border:1px solid #d1d5db;
                                border-radius:8px;
                                min-width:150px;
                            "
                        >

                            <option value="">
                                All Statuses
                            </option>

                            ${[
                                ...new Set(
                                    tickets
                                        .map(
                                            ticket =>
                                                String(
                                                    ticket.status ||
                                                    ""
                                                ).trim()
                                        )
                                        .filter(Boolean)
                                )
                            ]
                                .sort()
                                .map(
                                    status => `
                                        <option
                                            value="${escapeHtml(
                                                status.toLowerCase()
                                            )}"
                                        >
                                            ${escapeHtml(status)}
                                        </option>
                                    `
                                )
                                .join("")}

                        </select>


                        <select
                            id="supportPriorityFilter"
                            style="
                                padding:12px;
                                border:1px solid #d1d5db;
                                border-radius:8px;
                                min-width:150px;
                            "
                        >

                            <option value="">
                                All Priorities
                            </option>

                            ${[
                                ...new Set(
                                    tickets
                                        .map(
                                            ticket =>
                                                String(
                                                    ticket.priority ||
                                                    ""
                                                ).trim()
                                        )
                                        .filter(Boolean)
                                )
                            ]
                                .sort()
                                .map(
                                    priority => `
                                        <option
                                            value="${escapeHtml(
                                                priority.toLowerCase()
                                            )}"
                                        >
                                            ${escapeHtml(priority)}
                                        </option>
                                    `
                                )
                                .join("")}

                        </select>

                    </div>


                    <div
                        id="supportResultCount"
                        style="
                            margin-bottom:12px;
                            color:#6b7280;
                            font-size:14px;
                        "
                    >
                        Showing ${tickets.length}
                        ticket(s)
                    </div>


                    <!-- TABLE -->

                    <div class="admin-table-wrapper">

                        <table class="admin-table">

                            <thead>

                                <tr>

                                    <th>
                                        Subject
                                    </th>

                                    <th>
                                        User
                                    </th>

                                    <th>
                                        Category
                                    </th>

                                    <th>
                                        Status
                                    </th>

                                    <th>
                                        Priority
                                    </th>

                                    <th>
                                        Created
                                    </th>

                                    <th>
                                        Updated
                                    </th>

                                    <th>
                                        Action
                                    </th>

                                </tr>

                            </thead>


                            <tbody>

                                ${tickets
                                    .map(
                                        (
                                            ticket,
                                            index
                                        ) => {

                                            const searchable =
                                                [
                                                    ticket.id,
                                                    ticket.user_id,
                                                    ticket.subject,
                                                    ticket.title,
                                                    ticket.category,
                                                    ticket.status,
                                                    ticket.priority,
                                                    ticket.message
                                                ]
                                                    .filter(Boolean)
                                                    .join(" ")
                                                    .toLowerCase();


                                            const status =
                                                String(
                                                    ticket.status ||
                                                    ""
                                                )
                                                    .trim()
                                                    .toLowerCase();


                                            const priority =
                                                String(
                                                    ticket.priority ||
                                                    ""
                                                )
                                                    .trim()
                                                    .toLowerCase();


                                            return `

                                                <tr
                                                    class="support-row"
                                                    data-search="${escapeHtml(
                                                        searchable
                                                    )}"
                                                    data-status="${escapeHtml(
                                                        status
                                                    )}"
                                                    data-priority="${escapeHtml(
                                                        priority
                                                    )}"
                                                >

                                                    <td>

                                                        <strong>
                                                            ${escapeHtml(
                                                                ticket.subject ||
                                                                ticket.title ||
                                                                "—"
                                                            )}
                                                        </strong>

                                                        ${
                                                            ticket.id
                                                                ? `
                                                                    <br>

                                                                    <small
                                                                        style="
                                                                            color:#6b7280;
                                                                            word-break:break-all;
                                                                        "
                                                                    >
                                                                        ${escapeHtml(
                                                                            ticket.id
                                                                        )}
                                                                    </small>
                                                                `
                                                                : ""
                                                        }

                                                    </td>


                                                    <td>

                                                        <small
                                                            style="
                                                                word-break:break-all;
                                                            "
                                                        >
                                                            ${escapeHtml(
                                                                ticket.user_email ||
                                                                ticket.email ||
                                                                ticket.user_id ||
                                                                "—"
                                                            )}
                                                        </small>

                                                    </td>


                                                    <td>
                                                        ${escapeHtml(
                                                            ticket.category ||
                                                            "—"
                                                        )}
                                                    </td>


                                                    <td>

                                                        <span
                                                            class="badge"
                                                        >
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
                                                        ${formatDate(
                                                            ticket.created_at
                                                        )}
                                                    </td>


                                                    <td>
                                                        ${formatDate(
                                                            ticket.updated_at
                                                        )}
                                                    </td>


                                                    <td>

                                                        <button
                                                            type="button"
                                                            class="support-view-btn"
                                                            data-index="${index}"
                                                        >
                                                            View
                                                        </button>

                                                    </td>

                                                </tr>

                                            `;

                                        }
                                    )
                                    .join("")}

                            </tbody>

                        </table>

                    </div>

                `
                        : `

                    <div class="empty">

                        <h3>
                            No support tickets found
                        </h3>

                        <p>
                            There are currently no support tickets.
                        </p>

                    </div>

                `
                }

            </div>


            <!-- SUPPORT DETAILS MODAL -->

            <div
                id="supportDetailsModal"
                style="
                    display:none;
                    position:fixed;
                    inset:0;
                    background:rgba(0,0,0,.55);
                    z-index:9999;
                    padding:20px;
                    overflow:auto;
                "
            >

                <div
                    style="
                        max-width:800px;
                        margin:50px auto;
                        background:#fff;
                        border-radius:14px;
                        padding:24px;
                        box-shadow:0 20px 60px rgba(0,0,0,.25);
                    "
                >

                    <div
                        style="
                            display:flex;
                            align-items:center;
                            justify-content:space-between;
                            gap:15px;
                            margin-bottom:20px;
                        "
                    >

                        <h2
                            style="margin:0;"
                        >
                            Support Ticket
                        </h2>


                        <button
                            id="supportModalClose"
                            type="button"
                        >
                            ×
                        </button>

                    </div>


                    <div
                        id="supportModalBody"
                    ></div>


                    <div
                        style="
                            margin-top:24px;
                            text-align:right;
                        "
                    >

                        <button
                            id="supportModalCloseBottom"
                            type="button"
                        >
                            Close
                        </button>

                    </div>

                </div>

            </div>

        `;


        /* =====================================================
           REFRESH
        ===================================================== */

        $("supportRefresh")
            ?.addEventListener(
                "click",
                () =>
                    loadSupport()
            );


        /* =====================================================
           FILTERS
        ===================================================== */

        const searchInput =
            $("supportSearch");

        const statusFilter =
            $("supportStatusFilter");

        const priorityFilter =
            $("supportPriorityFilter");

        const resultCount =
            $("supportResultCount");


        function filterSupport() {

            const search =
                String(
                    searchInput?.value ||
                    ""
                )
                    .trim()
                    .toLowerCase();


            const status =
                String(
                    statusFilter?.value ||
                    ""
                )
                    .trim()
                    .toLowerCase();


            const priority =
                String(
                    priorityFilter?.value ||
                    ""
                )
                    .trim()
                    .toLowerCase();


            const rows =
                document.querySelectorAll(
                    ".support-row"
                );


            let visible =
                0;


            rows.forEach(
                row => {

                    const rowSearch =
                        row.dataset.search ||
                        "";

                    const rowStatus =
                        row.dataset.status ||
                        "";

                    const rowPriority =
                        row.dataset.priority ||
                        "";


                    const matchesSearch =
                        !search ||
                        rowSearch.includes(
                            search
                        );


                    const matchesStatus =
                        !status ||
                        rowStatus ===
                            status;


                    const matchesPriority =
                        !priority ||
                        rowPriority ===
                            priority;


                    const show =
                        matchesSearch &&
                        matchesStatus &&
                        matchesPriority;


                    row.style.display =
                        show
                            ? ""
                            : "none";


                    if (show) {
                        visible++;
                    }

                }
            );


            if (resultCount) {

                resultCount.textContent =
                    `Showing ${visible} ticket(s)`;

            }

        }


        searchInput?.addEventListener(
            "input",
            filterSupport
        );


        statusFilter?.addEventListener(
            "change",
            filterSupport
        );


        priorityFilter?.addEventListener(
            "change",
            filterSupport
        );


        /* =====================================================
           MODAL
        ===================================================== */

        const modal =
            $("supportDetailsModal");

        const modalBody =
            $("supportModalBody");


        function closeSupportModal() {

            if (modal) {

                modal.style.display =
                    "none";

            }

        }


        $("supportModalClose")
            ?.addEventListener(
                "click",
                closeSupportModal
            );


        $("supportModalCloseBottom")
            ?.addEventListener(
                "click",
                closeSupportModal
            );


        modal?.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    modal
                ) {

                    closeSupportModal();

                }

            }
        );


        /* =====================================================
           VIEW TICKET
        ===================================================== */

        document
            .querySelectorAll(
                ".support-view-btn"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            const index =
                                Number(
                                    button.dataset.index
                                );


                            const ticket =
                                tickets[index];


                            if (!ticket) {
                                return;
                            }


                            let messageHtml =
                                "";


                            const message =
                                ticket.message ||
                                ticket.description ||
                                ticket.body;


                            if (message) {

                                messageHtml = `

                                    <div
                                        style="
                                            margin-top:20px;
                                        "
                                    >

                                        <h3>
                                            Message
                                        </h3>

                                        <div
                                            style="
                                                background:#f8fafc;
                                                border:1px solid #e5e7eb;
                                                border-radius:10px;
                                                padding:15px;
                                                white-space:pre-wrap;
                                                word-break:break-word;
                                            "
                                        >
                                            ${escapeHtml(
                                                message
                                            )}
                                        </div>

                                    </div>

                                `;

                            }


                            if (modalBody) {

                                modalBody.innerHTML = `

                                    <div
                                        style="
                                            display:grid;
                                            grid-template-columns:
                                                minmax(180px,220px)
                                                1fr;
                                            border:1px solid #e5e7eb;
                                            border-radius:10px;
                                            overflow:hidden;
                                        "
                                    >

                                        <div class="support-detail-label">
                                            Ticket ID
                                        </div>

                                        <div class="support-detail-value">
                                            ${escapeHtml(
                                                ticket.id ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="support-detail-label">
                                            User ID
                                        </div>

                                        <div class="support-detail-value">
                                            ${escapeHtml(
                                                ticket.user_id ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="support-detail-label">
                                            Subject
                                        </div>

                                        <div class="support-detail-value">
                                            ${escapeHtml(
                                                ticket.subject ||
                                                ticket.title ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="support-detail-label">
                                            Category
                                        </div>

                                        <div class="support-detail-value">
                                            ${escapeHtml(
                                                ticket.category ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="support-detail-label">
                                            Status
                                        </div>

                                        <div class="support-detail-value">

                                            <span class="badge">
                                                ${escapeHtml(
                                                    ticket.status ||
                                                    "—"
                                                )}
                                            </span>

                                        </div>


                                        <div class="support-detail-label">
                                            Priority
                                        </div>

                                        <div class="support-detail-value">
                                            ${escapeHtml(
                                                ticket.priority ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="support-detail-label">
                                            Created
                                        </div>

                                        <div class="support-detail-value">
                                            ${formatDate(
                                                ticket.created_at
                                            )}
                                        </div>


                                        <div class="support-detail-label">
                                            Updated
                                        </div>

                                        <div class="support-detail-value">
                                            ${formatDate(
                                                ticket.updated_at
                                            )}
                                        </div>

                                    </div>


                                    ${messageHtml}


                                    <style>

                                        .support-detail-label {
                                            padding:12px;
                                            background:#f9fafb;
                                            border-bottom:1px solid #e5e7eb;
                                            font-weight:600;
                                        }

                                        .support-detail-value {
                                            padding:12px;
                                            border-bottom:1px solid #e5e7eb;
                                            word-break:break-word;
                                        }

                                    </style>

                                `;

                            }


                            if (modal) {

                                modal.style.display =
                                    "block";

                            }

                        }
                    );

                }
            );


    } catch (error) {

        console.error(
            "Support section error:",
            error
        );


        $("content").innerHTML = `

            <div class="card">

                <div
                    style="
                        padding:25px;
                        text-align:center;
                    "
                >

                    <h2>
                        Unable to load support tickets
                    </h2>

                    <p>
                        ${escapeHtml(
                            error?.message ||
                            "An unexpected error occurred."
                        )}
                    </p>


                    <button
                        id="supportRetry"
                        type="button"
                    >
                        Retry
                    </button>

                </div>

            </div>

        `;


        $("supportRetry")
            ?.addEventListener(
                "click",
                () =>
                    loadSupport()
            );

    }



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

    try {

        const data =
            await api(
                "audit"
            );

        const logs =
            Array.isArray(
                data?.logs
            )
                ? data.logs
                : Array.isArray(
                    data?.audit_logs
                )
                    ? data.audit_logs
                    : Array.isArray(
                        data?.data
                    )
                        ? data.data
                        : [];


        $("content").innerHTML = `

            <div class="card">

                <div class="admin-header">

                    <div>

                        <h2>
                            Audit Logs
                        </h2>

                        <p>
                            ${logs.length}
                            record(s).
                        </p>

                    </div>


                    <button
                        id="auditRefresh"
                        type="button"
                    >
                        Refresh
                    </button>

                </div>


                ${
                    logs.length
                        ? `

                    <!-- FILTERS -->

                    <div
                        style="
                            display:flex;
                            gap:12px;
                            flex-wrap:wrap;
                            margin-bottom:18px;
                        "
                    >

                        <input
                            id="auditSearch"
                            class="search-box"
                            type="search"
                            placeholder="Search action, user, entity, IP..."
                            autocomplete="off"
                        >


                        <select
                            id="auditActionFilter"
                            style="
                                padding:12px;
                                border:1px solid #d1d5db;
                                border-radius:8px;
                                min-width:170px;
                            "
                        >

                            <option value="">
                                All Actions
                            </option>

                            ${[
                                ...new Set(
                                    logs
                                        .map(
                                            log =>
                                                String(
                                                    log.action ||
                                                    log.event ||
                                                    log.name ||
                                                    ""
                                                ).trim()
                                        )
                                        .filter(Boolean)
                                )
                            ]
                                .sort()
                                .map(
                                    action => `
                                        <option
                                            value="${escapeHtml(
                                                action.toLowerCase()
                                            )}"
                                        >
                                            ${escapeHtml(action)}
                                        </option>
                                    `
                                )
                                .join("")}

                        </select>


                        <select
                            id="auditEntityFilter"
                            style="
                                padding:12px;
                                border:1px solid #d1d5db;
                                border-radius:8px;
                                min-width:170px;
                            "
                        >

                            <option value="">
                                All Entities
                            </option>

                            ${[
                                ...new Set(
                                    logs
                                        .map(
                                            log =>
                                                String(
                                                    log.entity_type ||
                                                    log.entity ||
                                                    log.kind ||
                                                    log.type ||
                                                    ""
                                                ).trim()
                                        )
                                        .filter(Boolean)
                                )
                            ]
                                .sort()
                                .map(
                                    entity => `
                                        <option
                                            value="${escapeHtml(
                                                entity.toLowerCase()
                                            )}"
                                        >
                                            ${escapeHtml(entity)}
                                        </option>
                                    `
                                )
                                .join("")}

                        </select>

                    </div>


                    <div
                        id="auditResultCount"
                        style="
                            margin-bottom:12px;
                            color:#6b7280;
                            font-size:14px;
                        "
                    >
                        Showing ${logs.length}
                        record(s)
                    </div>


                    <div class="admin-table-wrapper">

                        <table class="admin-table">

                            <thead>

                                <tr>

                                    <th>
                                        Time
                                    </th>

                                    <th>
                                        Action
                                    </th>

                                    <th>
                                        User
                                    </th>

                                    <th>
                                        Entity
                                    </th>

                                    <th>
                                        IP Address
                                    </th>

                                    <th>
                                        Action
                                    </th>

                                </tr>

                            </thead>


                            <tbody>

                                ${logs
                                    .map(
                                        (
                                            log,
                                            index
                                        ) => {

                                            const action =
                                                log.action ||
                                                log.event ||
                                                log.name ||
                                                "—";


                                            const entity =
                                                log.entity_type ||
                                                log.entity ||
                                                log.kind ||
                                                log.type ||
                                                "—";


                                            const searchable =
                                                [
                                                    log.id,
                                                    log.user_id,
                                                    log.user_email,
                                                    action,
                                                    entity,
                                                    log.entity_id,
                                                    log.ip_address,
                                                    log.ip,
                                                    log.user_agent,
                                                    JSON.stringify(
                                                        log.metadata ||
                                                        {}
                                                    )
                                                ]
                                                    .filter(Boolean)
                                                    .join(" ")
                                                    .toLowerCase();


                                            return `

                                                <tr
                                                    class="audit-row"
                                                    data-search="${escapeHtml(
                                                        searchable
                                                    )}"
                                                    data-action="${escapeHtml(
                                                        String(
                                                            action
                                                        )
                                                            .trim()
                                                            .toLowerCase()
                                                    )}"
                                                    data-entity="${escapeHtml(
                                                        String(
                                                            entity
                                                        )
                                                            .trim()
                                                            .toLowerCase()
                                                    )}"
                                                >

                                                    <td>
                                                        ${formatDateTime(
                                                            log.created_at
                                                        )}
                                                    </td>


                                                    <td>

                                                        <span
                                                            class="badge"
                                                        >
                                                            ${escapeHtml(
                                                                action
                                                            )}
                                                        </span>

                                                    </td>


                                                    <td>

                                                        <small
                                                            style="
                                                                word-break:break-all;
                                                            "
                                                        >
                                                            ${escapeHtml(
                                                                log.user_email ||
                                                                log.user_id ||
                                                                "—"
                                                            )}
                                                        </small>

                                                    </td>


                                                    <td>

                                                        ${escapeHtml(
                                                            entity
                                                        )}

                                                        ${
                                                            log.entity_id
                                                                ? `
                                                                    <br>
                                                                    <small
                                                                        style="
                                                                            color:#6b7280;
                                                                            word-break:break-all;
                                                                        "
                                                                    >
                                                                        ${escapeHtml(
                                                                            log.entity_id
                                                                        )}
                                                                    </small>
                                                                `
                                                                : ""
                                                        }

                                                    </td>


                                                    <td>

                                                        ${escapeHtml(
                                                            log.ip_address ||
                                                            log.ip ||
                                                            "—"
                                                        )}

                                                    </td>


                                                    <td>

                                                        <button
                                                            type="button"
                                                            class="audit-view-btn"
                                                            data-index="${index}"
                                                        >
                                                            View
                                                        </button>

                                                    </td>

                                                </tr>

                                            `;

                                        }
                                    )
                                    .join("")}

                            </tbody>

                        </table>

                    </div>

                `
                        : `

                    <div class="empty">

                        <h3>
                            No audit logs found
                        </h3>

                        <p>
                            No audit activity has been recorded yet.
                        </p>

                    </div>

                `
                }

            </div>


            <!-- AUDIT DETAILS MODAL -->

            <div
                id="auditDetailsModal"
                style="
                    display:none;
                    position:fixed;
                    inset:0;
                    background:rgba(0,0,0,.55);
                    z-index:9999;
                    padding:20px;
                    overflow:auto;
                "
            >

                <div
                    style="
                        max-width:850px;
                        margin:50px auto;
                        background:#fff;
                        border-radius:14px;
                        padding:24px;
                        box-shadow:0 20px 60px rgba(0,0,0,.25);
                    "
                >

                    <div
                        style="
                            display:flex;
                            align-items:center;
                            justify-content:space-between;
                            gap:15px;
                            margin-bottom:20px;
                        "
                    >

                        <h2
                            style="margin:0;"
                        >
                            Audit Log Details
                        </h2>


                        <button
                            id="auditModalClose"
                            type="button"
                        >
                            ×
                        </button>

                    </div>


                    <div
                        id="auditModalBody"
                    ></div>


                    <div
                        style="
                            margin-top:24px;
                            text-align:right;
                        "
                    >

                        <button
                            id="auditModalCloseBottom"
                            type="button"
                        >
                            Close
                        </button>

                    </div>

                </div>

            </div>

        `;


        /* =====================================================
           REFRESH
        ===================================================== */

        $("auditRefresh")
            ?.addEventListener(
                "click",
                () =>
                    loadAudit()
            );


        /* =====================================================
           FILTERS
        ===================================================== */

        const searchInput =
            $("auditSearch");

        const actionFilter =
            $("auditActionFilter");

        const entityFilter =
            $("auditEntityFilter");

        const resultCount =
            $("auditResultCount");


        function filterAudit() {

            const search =
                String(
                    searchInput?.value ||
                    ""
                )
                    .trim()
                    .toLowerCase();


            const action =
                String(
                    actionFilter?.value ||
                    ""
                )
                    .trim()
                    .toLowerCase();


            const entity =
                String(
                    entityFilter?.value ||
                    ""
                )
                    .trim()
                    .toLowerCase();


            const rows =
                document.querySelectorAll(
                    ".audit-row"
                );


            let visible =
                0;


            rows.forEach(
                row => {

                    const rowSearch =
                        row.dataset.search ||
                        "";

                    const rowAction =
                        row.dataset.action ||
                        "";

                    const rowEntity =
                        row.dataset.entity ||
                        "";


                    const matchesSearch =
                        !search ||
                        rowSearch.includes(
                            search
                        );


                    const matchesAction =
                        !action ||
                        rowAction ===
                            action;


                    const matchesEntity =
                        !entity ||
                        rowEntity ===
                            entity;


                    const show =
                        matchesSearch &&
                        matchesAction &&
                        matchesEntity;


                    row.style.display =
                        show
                            ? ""
                            : "none";


                    if (show) {
                        visible++;
                    }

                }
            );


            if (resultCount) {

                resultCount.textContent =
                    `Showing ${visible} record(s)`;

            }

        }


        searchInput?.addEventListener(
            "input",
            filterAudit
        );


        actionFilter?.addEventListener(
            "change",
            filterAudit
        );


        entityFilter?.addEventListener(
            "change",
            filterAudit
        );


        /* =====================================================
           MODAL
        ===================================================== */

        const modal =
            $("auditDetailsModal");

        const modalBody =
            $("auditModalBody");


        function closeAuditModal() {

            if (modal) {

                modal.style.display =
                    "none";

            }

        }


        $("auditModalClose")
            ?.addEventListener(
                "click",
                closeAuditModal
            );


        $("auditModalCloseBottom")
            ?.addEventListener(
                "click",
                closeAuditModal
            );


        modal?.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    modal
                ) {

                    closeAuditModal();

                }

            }
        );


        /* =====================================================
           VIEW DETAILS
        ===================================================== */

        document
            .querySelectorAll(
                ".audit-view-btn"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            const index =
                                Number(
                                    button.dataset.index
                                );


                            const log =
                                logs[index];


                            if (!log) {
                                return;
                            }


                            let metadataText =
                                "{}";


                            try {

                                metadataText =
                                    JSON.stringify(
                                        log.metadata ||
                                        {},
                                        null,
                                        2
                                    );

                            } catch {

                                metadataText =
                                    String(
                                        log.metadata ||
                                        {}
                                    );

                            }


                            if (modalBody) {

                                modalBody.innerHTML = `

                                    <div
                                        style="
                                            display:grid;
                                            grid-template-columns:
                                                minmax(180px,220px)
                                                1fr;
                                            border:1px solid #e5e7eb;
                                            border-radius:10px;
                                            overflow:hidden;
                                        "
                                    >

                                        <div class="audit-detail-label">
                                            Log ID
                                        </div>

                                        <div class="audit-detail-value">
                                            ${escapeHtml(
                                                log.id ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="audit-detail-label">
                                            Time
                                        </div>

                                        <div class="audit-detail-value">
                                            ${formatDateTime(
                                                log.created_at
                                            )}
                                        </div>


                                        <div class="audit-detail-label">
                                            Action
                                        </div>

                                        <div class="audit-detail-value">

                                            <span class="badge">
                                                ${escapeHtml(
                                                    log.action ||
                                                    log.event ||
                                                    log.name ||
                                                    "—"
                                                )}
                                            </span>

                                        </div>


                                        <div class="audit-detail-label">
                                            Kind
                                        </div>

                                        <div class="audit-detail-value">
                                            ${escapeHtml(
                                                log.kind ||
                                                log.type ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="audit-detail-label">
                                            User ID
                                        </div>

                                        <div class="audit-detail-value">
                                            ${escapeHtml(
                                                log.user_id ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="audit-detail-label">
                                            User Email
                                        </div>

                                        <div class="audit-detail-value">
                                            ${escapeHtml(
                                                log.user_email ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="audit-detail-label">
                                            Entity Type
                                        </div>

                                        <div class="audit-detail-value">
                                            ${escapeHtml(
                                                log.entity_type ||
                                                log.entity ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="audit-detail-label">
                                            Entity ID
                                        </div>

                                        <div class="audit-detail-value">
                                            ${escapeHtml(
                                                log.entity_id ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="audit-detail-label">
                                            IP Address
                                        </div>

                                        <div class="audit-detail-value">
                                            ${escapeHtml(
                                                log.ip_address ||
                                                log.ip ||
                                                "—"
                                            )}
                                        </div>


                                        <div class="audit-detail-label">
                                            User Agent
                                        </div>

                                        <div class="audit-detail-value">
                                            ${escapeHtml(
                                                log.user_agent ||
                                                "—"
                                            )}
                                        </div>

                                    </div>


                                    <div
                                        style="
                                            margin-top:20px;
                                        "
                                    >

                                        <h3>
                                            Metadata
                                        </h3>

                                        <pre
                                            style="
                                                background:#f8fafc;
                                                border:1px solid #e5e7eb;
                                                border-radius:10px;
                                                padding:15px;
                                                max-height:400px;
                                                overflow:auto;
                                                white-space:pre-wrap;
                                                word-break:break-word;
                                                font-size:13px;
                                            "
                                        >${escapeHtml(
                                            metadataText
                                        )}</pre>

                                    </div>


                                    <style>

                                        .audit-detail-label {
                                            padding:12px;
                                            background:#f9fafb;
                                            border-bottom:1px solid #e5e7eb;
                                            font-weight:600;
                                        }

                                        .audit-detail-value {
                                            padding:12px;
                                            border-bottom:1px solid #e5e7eb;
                                            word-break:break-word;
                                        }

                                    </style>

                                `;

                            }


                            if (modal) {

                                modal.style.display =
                                    "block";

                            }

                        }
                    );

                }
            );


    } catch (error) {

        console.error(
            "Audit section error:",
            error
        );


        $("content").innerHTML = `

            <div class="card">

                <div
                    style="
                        padding:25px;
                        text-align:center;
                    "
                >

                    <h2>
                        Unable to load audit logs
                    </h2>

                    <p>
                        ${escapeHtml(
                            error?.message ||
                            "An unexpected error occurred."
                        )}
                    </p>


                    <button
                        id="auditRetry"
                        type="button"
                    >
                        Retry
                    </button>

                </div>

            </div>

        `;


        $("auditRetry")
            ?.addEventListener(
                "click",
                () =>
                    loadAudit()
            );

    }

}











/* =========================================================
   SETTINGS
========================================================= */

async function loadSettings() {

    loading(
        "Loading settings..."
    );


    const data =
        await api(
            "settings"
        );


    const settings =
        data.settings || [];


    let branding =
        settings.find(
            item =>
                item.key ===
                "branding"
        );


    currentBranding =
        branding?.value || {

            brand_name:
                "Obsedian.Space",

            logo_url:
                "",

            primary_color:
                "#7c3aed",

            accent_color:
                "#f59e0b",

            support_email:
                ""
        };


    const content =
        $("content");


    content.innerHTML = `

        <div class="card">

            <div class="admin-header">

                <div>

                    <h2>
                        Branding Settings
                    </h2>

                    <p>
                        Manage the public brand identity.
                    </p>

                </div>

                <button
                    id="settingsRefresh"
                >
                    Refresh
                </button>

            </div>


            <div
                style="
                    display:grid;
                    grid-template-columns:
                        repeat(auto-fit,minmax(280px,1fr));
                    gap:20px;
                "
            >

                <div>

                    <label>
                        <strong>
                            Brand Name
                        </strong>

                        <input
                            id="brandName"
                            type="text"
                            value="${escapeHtml(
                                currentBranding.brand_name ||
                                ""
                            )}"
                            style="
                                width:100%;
                                box-sizing:border-box;
                                padding:12px;
                                margin-top:6px;
                            "
                        >

                    </label>


                    <label
                        style="
                            display:block;
                            margin-top:18px;
                        "
                    >

                        <strong>
                            Support Email
                        </strong>

                        <input
                            id="supportEmail"
                            type="email"
                            value="${escapeHtml(
                                currentBranding.support_email ||
                                ""
                            )}"
                            style="
                                width:100%;
                                box-sizing:border-box;
                                padding:12px;
                                margin-top:6px;
                            "
                        >

                    </label>


                    <label
                        style="
                            display:block;
                            margin-top:18px;
                        "
                    >

                        <strong>
                            Logo URL
                        </strong>

                        <input
                            id="logoUrl"
                            type="text"
                            value="${escapeHtml(
                                currentBranding.logo_url ||
                                ""
                            )}"
                            placeholder="https://..."
                            style="
                                width:100%;
                                box-sizing:border-box;
                                padding:12px;
                                margin-top:6px;
                            "
                        >

                    </label>


                    <label
                        style="
                            display:block;
                            margin-top:18px;
                        "
                    >

                        <strong>
                        Logo
                       </strong>

                        <input
                            id="logoFile"
                            type="file"
                            accept="image/*"
                            style="
                                display:block;
                                margin-top:8px;
                            "
                        >

                       <small>
    Choose a logo from your computer. PNG, JPG, WEBP or SVG, maximum 3 MB.
</small>

                    </label>

                </div>


                <div>

                    <label>

                        <strong>
                            Primary Color
                        </strong>

                        <div
                            style="
                                display:flex;
                                gap:10px;
                                align-items:center;
                                margin-top:6px;
                            "
                        >

                            <input
                                id="primaryColor"
                                type="color"
                                value="${escapeHtml(
                                    currentBranding.primary_color ||
                                    "#7c3aed"
                                )}"
                            >

                            <input
                                id="primaryColorText"
                                type="text"
                                value="${escapeHtml(
                                    currentBranding.primary_color ||
                                    "#7c3aed"
                                )}"
                                style="
                                    padding:10px;
                                    flex:1;
                                "
                            >

                        </div>

                    </label>


                    <label
                        style="
                            display:block;
                            margin-top:20px;
                        "
                    >

                        <strong>
                            Accent Color
                        </strong>

                        <div
                            style="
                                display:flex;
                                gap:10px;
                                align-items:center;
                                margin-top:6px;
                            "
                        >

                            <input
                                id="accentColor"
                                type="color"
                                value="${escapeHtml(
                                    currentBranding.accent_color ||
                                    "#f59e0b"
                                )}"
                            >

                            <input
                                id="accentColorText"
                                type="text"
                                value="${escapeHtml(
                                    currentBranding.accent_color ||
                                    "#f59e0b"
                                )}"
                                style="
                                    padding:10px;
                                    flex:1;
                                "
                            >

                        </div>

                    </label>


                    <div
                        style="
                            margin-top:24px;
                            padding:20px;
                            border:1px solid #e5e7eb;
                            border-radius:12px;
                            text-align:center;
                        "
                    >

                        <strong>
                            Logo Preview
                        </strong>

                        <div
                            id="logoPreview"
                            style="
                                min-height:100px;
                                display:flex;
                                align-items:center;
                                justify-content:center;
                                margin-top:12px;
                            "
                        ></div>

                    </div>

                </div>

            </div>


            <div
                style="
                    display:flex;
                    gap:10px;
                    margin-top:25px;
                    flex-wrap:wrap;
                "
            >

                <button
                    id="saveBranding"
                >
                    Save Branding
                </button>

                <button
                    id="resetBranding"
                >
                    Reset
                </button>

            </div>

        </div>


        <div class="card">

            <h2>
                Stored Settings
            </h2>

            ${
                settings.length
                    ? `

                    <div class="admin-table-wrapper">

                        <table class="admin-table">

                            <thead>

                                <tr>

                                    <th>
                                        Key
                                    </th>

                                    <th>
                                        Value
                                    </th>

                                    <th>
                                        Updated
                                    </th>

                                </tr>

                            </thead>

                            <tbody>

                                ${settings
                                    .map(
                                        setting => `

                                        <tr>

                                            <td>
                                                ${escapeHtml(
                                                    setting.key
                                                )}
                                            </td>

                                            <td>
                                                <pre
                                                    style="
                                                        white-space:pre-wrap;
                                                        margin:0;
                                                    "
                                                >${escapeHtml(
                                                    JSON.stringify(
                                                        setting.value,
                                                        null,
                                                        2
                                                    )
                                                )}</pre>
                                            </td>

                                            <td>
                                                ${formatDate(
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

                `
                    : `
                    <div class="empty">
                        No settings found.
                    </div>
                `
            }

        </div>

    `;


    renderLogoPreview();


    $("settingsRefresh").onclick =
        () =>
            loadSettings();


    $("logoFile").onchange =
        event => {

            const file =
                event.target.files?.[0];

            if (!file) {
                return;
            }


            const reader =
                new FileReader();


            reader.onload =
                () => {

                    $("logoUrl").value =
                        reader.result;

                    renderLogoPreview();
                };


            reader.readAsDataURL(
                file
            );
        };


    $("logoUrl").oninput =
        () =>
            renderLogoPreview();


    $("primaryColor").oninput =
        event => {

            $("primaryColorText")
                .value =
                event.target.value;
        };


    $("primaryColorText").oninput =
        event => {

            if (
                /^#[0-9A-Fa-f]{6}$/
                    .test(
                        event.target.value
                    )
            ) {

                $("primaryColor")
                    .value =
                    event.target.value;
            }
        };


    $("accentColor").oninput =
        event => {

            $("accentColorText")
                .value =
                event.target.value;
        };


    $("accentColorText").oninput =
        event => {

            if (
                /^#[0-9A-Fa-f]{6}$/
                    .test(
                        event.target.value
                    )
            ) {

                $("accentColor")
                    .value =
                    event.target.value;
            }
        };


   $("saveBranding").onclick =
    async () => {

        const button =
            $("saveBranding");

        const brandName =
            $("brandName")
                ?.value
                ?.trim() ||
            "";

        const logoUrl =
            $("logoUrl")
                ?.value
                ?.trim() ||
            "";

        const primaryColor =
            $("primaryColor")
                ?.value
                ?.trim() ||
            "";

        const accentColor =
            $("accentColor")
                ?.value
                ?.trim() ||
            "";

        const supportEmail =
            $("supportEmail")
                ?.value
                ?.trim() ||
            "";

        const logoFile =
            $("logoFile")
                ?.files?.[0] ||
            null;


        /* =====================================================
           VALIDATION
        ===================================================== */

        if (!brandName) {

            showMessage(
                "Brand name is required.",
                "error"
            );

            return;
        }


        if (
            !/^#[0-9a-fA-F]{6}$/
                .test(
                    primaryColor
                )
        ) {

            showMessage(
                "Primary color must be a valid HEX color.",
                "error"
            );

            return;
        }


        if (
            !/^#[0-9a-fA-F]{6}$/
                .test(
                    accentColor
                )
        ) {

            showMessage(
                "Accent color must be a valid HEX color.",
                "error"
            );

            return;
        }


        if (
            supportEmail &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
                .test(
                    supportEmail
                )
        ) {

            showMessage(
                "Please enter a valid support email.",
                "error"
            );

            return;
        }


        if (logoFile) {

            if (
                !logoFile.type.startsWith(
                    "image/"
                )
            ) {

                showMessage(
                    "Please select an image file.",
                    "error"
                );

                return;
            }


            if (
                logoFile.size >
                3 * 1024 * 1024
            ) {

                showMessage(
                    "Logo must be 3 MB or smaller.",
                    "error"
                );

                return;
            }

        }


        try {

            if (button) {

                button.disabled =
                    true;

                button.textContent =
                    "Saving...";

            }


            showMessage(
                "Saving branding settings..."
            );


            const current =
                await getSession();


            if (!current) {

                throw new Error(
                    "Your session has expired. Please log in again."
                );

            }


            /* =================================================
               CONVERT SELECTED LOGO TO DATA URL
            ================================================= */

            let logoDataUrl =
                "";


            if (logoFile) {

                logoDataUrl =
                    await new Promise(
                        (
                            resolve,
                            reject
                        ) => {

                            const reader =
                                new FileReader();


                            reader.onload =
                                () => {

                                    resolve(
                                        String(
                                            reader.result ||
                                            ""
                                        )
                                    );

                                };


                            reader.onerror =
                                () => {

                                    reject(
                                        new Error(
                                            "Unable to read the selected logo."
                                        )
                                    );

                                };


                            reader.readAsDataURL(
                                logoFile
                            );

                        }
                    );

            }


            /* =================================================
               SETTINGS ENDPOINT
            ================================================= */

            const url =
                `${window.OBSEDIAN_CONFIG.SUPABASE_URL}` +
                `/functions/v1/admin?section=settings`;


            const response =
                await fetch(
                    url,
                    {
                        method:
                            "POST",

                        headers: {

                            Authorization:
                                `Bearer ${current.access_token}`,

                            apikey:
                                window.OBSEDIAN_CONFIG
                                    .SUPABASE_PUBLISHABLE_KEY,

                            "Content-Type":
                                "application/json"

                        },

                        body:
                            JSON.stringify(
                                {
                                    action:
                                        "update_branding",

                                    branding: {

                                        brand_name:
                                            brandName,

                                        logo_url:
                                            logoUrl,

                                        primary_color:
                                            primaryColor,

                                        accent_color:
                                            accentColor,

                                        support_email:
                                            supportEmail

                                    },

                                    logo_data_url:
                                        logoDataUrl

                                }
                            )

                    }
                );


            const raw =
                await response.text();


            let data =
                {};

            try {

                data =
                    raw
                        ? JSON.parse(
                            raw
                        )
                        : {};

            } catch {

                data = {
                    error:
                        raw ||
                        "Invalid server response."
                };

            }


            if (!response.ok) {

                throw new Error(
                    data?.error ||
                    data?.message ||
                    `Unable to save settings (${response.status})`
                );

            }


            if (data?.error) {

                throw new Error(
                    data.error
                );

            }


            /* =================================================
               SUCCESS
            ================================================= */

            showMessage(
                "Branding settings saved successfully."
            );


            if (
                data?.setting?.value
            ) {

                currentBranding =
                    data.setting.value;

            } else {

                currentBranding = {

                    brand_name:
                        brandName,

                    logo_url:
                        data?.setting
                            ?.value
                            ?.logo_url ||
                        logoUrl,

                    primary_color:
                        primaryColor,

                    accent_color:
                        accentColor,

                    support_email:
                        supportEmail

                };

            }


            /* =================================================
               UPDATE LOGO URL AFTER UPLOAD
            ================================================= */

            if (
                data?.setting
                    ?.value
                    ?.logo_url
            ) {

                $("logoUrl").value =
                    data.setting
                        .value
                        .logo_url;

            }


            renderLogoPreview();


            /*
             * Reload settings from database
             * so the displayed values are guaranteed
             * to match the saved record.
             */

            await loadSettings();


        } catch (error) {

            console.error(
                "Save branding error:",
                error
            );


            showMessage(
                error?.message ||
                "Unable to save branding settings.",
                "error"
            );


        } finally {

            if (button) {

                button.disabled =
                    false;

                button.textContent =
                    "Save Branding";

            }

        }

    };
    
/* =========================================================
   LOGO PREVIEW
========================================================= */

function renderLogoPreview() {

    const preview =
        $("logoPreview");

    if (!preview) {
        return;
    }


    const logo =
        $("logoUrl")?.value
            ?.trim();


    const brand =
        $("brandName")?.value
            ?.trim() ||
        "Obsedian.Space";


    if (logo) {

        preview.innerHTML = `

            <div>

                <img
                    src="${escapeHtml(
                        logo
                    )}"
                    alt="Logo preview"
                    style="
                        max-width:220px;
                        max-height:100px;
                        object-fit:contain;
                    "
                    onerror="
                        this.style.display='none';
                        this.nextElementSibling.style.display='block';
                    "
                >

                <div
                    style="
                        display:none;
                        color:#b91c1c;
                    "
                >
                    Unable to load logo.
                </div>

                <div
                    style="
                        margin-top:10px;
                        font-weight:700;
                    "
                >
                    ${escapeHtml(
                        brand
                    )}
                </div>

            </div>

        `;

    } else {

        preview.innerHTML = `

            <div
                style="
                    font-size:24px;
                    font-weight:800;
                "
            >
                ${escapeHtml(
                    brand
                )}
            </div>

        `;
    }
}


/* =========================================================
   LOGOUT
========================================================= */

async function logout() {

    try {

        await sb.auth.signOut();

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

    } finally {

        window.location.href =
            "/app/";
    }
}


/* =========================================================
   NAV BUTTON EVENTS
   FIXED - DOM SAFE + EVENT DELEGATION
========================================================= */

function initializeAdminNavigation() {

    console.log(
        "Initializing Admin Navigation..."
    );


    /*
     * Event delegation:
     * We attach ONE listener to document.
     * This works even if navigation buttons
     * are rendered/replaced later.
     */

    if (
        window.__adminNavigationInitialized
    ) {
        console.log(
            "Admin Navigation already initialized."
        );

        return;
    }


    window.__adminNavigationInitialized =
        true;


    document.addEventListener(
        "click",
        function (event) {

            const button =
                event.target.closest(
                    ".admin-nav button"
                );


            /*
             * Click was not on an admin
             * navigation button.
             */

            if (!button) {
                return;
            }


            /*
             * Stop default button/form behavior.
             */

            event.preventDefault();

            event.stopPropagation();


            const section =
                button.getAttribute(
                    "data-section"
                );


            console.log(
                "Admin navigation clicked:",
                section
            );


            if (!section) {

                console.error(
                    "Admin navigation button is missing data-section:",
                    button
                );

                return;
            }


            /*
             * Load selected section.
             */

            loadSection(
                section
            );

        },
        false
    );


    console.log(
        "Admin Navigation initialized successfully."
    );
}


/*
 * Initialize after DOM is ready.
 */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeAdminNavigation
    );

} else {

    initializeAdminNavigation();

}
/* =========================================================
   LOGOUT BUTTON
========================================================= */

if ($("logout")) {

    $("logout").onclick =
        logout;
}


/* =========================================================
   AUTH STATE
========================================================= */

sb.auth.onAuthStateChange(
    (
        event,
        currentSession
    ) => {

        session =
            currentSession;


        if (
            event ===
                "SIGNED_OUT" ||
            !currentSession
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