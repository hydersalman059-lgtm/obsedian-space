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


    const data =
        await api(
            "subscriptions"
        );


    const subscriptions =
        data.subscriptions || [];


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
                >
                    Refresh
                </button>

            </div>


            ${
                subscriptions.length
                    ? `

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

                                </tr>

                            </thead>

                            <tbody>

                                ${subscriptions
                                    .map(
                                        sub => `

                                        <tr>

                                            <td>
                                                ${escapeHtml(
                                                    sub.user_id
                                                )}
                                            </td>

                                            <td>
                                                ${escapeHtml(
                                                    sub.plan_id ||
                                                    "—"
                                                )}
                                            </td>

                                            <td>
                                                ${escapeHtml(
                                                    sub.billing_cycle ||
                                                    "—"
                                                )}
                                            </td>

                                            <td>

                                                <span class="badge">
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
                                                ${formatDateOnly(
                                                    sub.started_at
                                                )}
                                            </td>

                                            <td>
                                                ${formatDateOnly(
                                                    sub.subscription_ends_at
                                                )}
                                            </td>

                                            <td>
                                                ${formatDate(
                                                    sub.updated_at
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
                        No subscriptions found.
                    </div>
                `
            }

        </div>
    `;


    $("subscriptionsRefresh").onclick =
        () =>
            loadSubscriptions();
}


/* =========================================================
   PAYMENTS
========================================================= */

async function loadPayments() {

    loading(
        "Loading payments..."
    );


    const data =
        await api(
            "payments"
        );


    const payments =
        data.payments || [];


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
                >
                    Refresh
                </button>

            </div>


            ${
                payments.length
                    ? `

                    <div class="admin-table-wrapper">

                        <table class="admin-table">

                            <thead>

                                <tr>

                                    <th>
                                        User
                                    </th>

                                    <th>
                                        Amount
                                    </th>

                                    <th>
                                        Currency
                                    </th>

                                    <th>
                                        Razorpay Order
                                    </th>

                                    <th>
                                        Payment ID
                                    </th>

                                    <th>
                                        Last Payment
                                    </th>

                                    <th>
                                        Status
                                    </th>

                                </tr>

                            </thead>

                            <tbody>

                                ${payments
                                    .map(
                                        payment => `

                                        <tr>

                                            <td>
                                                ${escapeHtml(
                                                    payment.user_id ||
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
                                                ${formatDate(
                                                    payment.last_payment_at
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
                        No payment records found.
                    </div>
                `
            }

        </div>
    `;


    $("paymentsRefresh").onclick =
        () =>
            loadPayments();
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
   SUPPORT
========================================================= */

async function loadSupport() {

    loading(
        "Loading support tickets..."
    );


    const data =
        await api(
            "support"
        );


    const tickets =
        data.tickets ||
        data.support_tickets ||
        [];


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
                >
                    Refresh
                </button>

            </div>


            ${
                tickets.length
                    ? `

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
                                                    "—"
                                                )}
                                            </td>

                                            <td>
                                                ${escapeHtml(
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
                                                ${formatDate(
                                                    ticket.created_at
                                                )}
                                            </td>

                                            <td>
                                                ${formatDate(
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

                `
                    : `
                    <div class="empty">
                        No support tickets found.
                    </div>
                `
            }

        </div>
    `;


    $("supportRefresh").onclick =
        () =>
            loadSupport();
}


/* =========================================================
   AUDIT
========================================================= */

async function loadAudit() {

    loading(
        "Loading audit logs..."
    );


    const data =
        await api(
            "audit"
        );


    const logs =
        data.logs || [];


    $("content").innerHTML = `

        <div class="card">

            <div class="admin-header">

                <div>

                    <h2>
                        Audit Logs
                    </h2>

                    <p>
                        Showing ${logs.length}
                        record(s).
                    </p>

                </div>

                <button
                    id="auditRefresh"
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
                                        Metadata
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
                        No audit logs found.
                    </div>
                `
            }

        </div>
    `;


    $("auditRefresh").onclick =
        () =>
            loadAudit();
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
                            Choose Logo
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
                            Select an image from your computer.
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

            const brandName =
                $("brandName")
                    .value
                    .trim();

            const logoUrl =
                $("logoUrl")
                    .value
                    .trim();

            const supportEmail =
                $("supportEmail")
                    .value
                    .trim();

            const primaryColor =
                $("primaryColor")
                    .value;

            const accentColor =
                $("accentColor")
                    .value;


            if (!brandName) {

                showMessage(
                    "Brand name is required.",
                    "error"
                );

                return;
            }


            try {

                const button =
                    $("saveBranding");

                button.disabled =
                    true;

                button.textContent =
                    "Saving...";


                await adminAction(
                    "save_branding",
                    {
                        branding: {

                            brand_name:
                                brandName,

                            logo_url:
                                logoUrl,

                            support_email:
                                supportEmail,

                            primary_color:
                                primaryColor,

                            accent_color:
                                accentColor
                        }
                    }
                );


                showMessage(
                    "Branding saved successfully."
                );


                await loadSettings();

            } catch (error) {

                console.error(
                    error
                );

                showMessage(
                    error.message ||
                    "Unable to save branding.",
                    "error"
                );

            } finally {

                const button =
                    $("saveBranding");

                if (button) {

                    button.disabled =
                        false;

                    button.textContent =
                        "Save Branding";
                }
            }
        };


    $("resetBranding").onclick =
        () => {

            $("brandName").value =
                "Obsedian.Space";

            $("logoUrl").value =
                "";

            $("supportEmail").value =
                "";

            $("primaryColor").value =
                "#7c3aed";

            $("primaryColorText").value =
                "#7c3aed";

            $("accentColor").value =
                "#f59e0b";

            $("accentColorText").value =
                "#f59e0b";

            renderLogoPreview();
        };
}


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
========================================================= */

document
    .querySelectorAll(
        ".admin-nav button"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    loadSection(
                        button.dataset.section
                    );

                }
            );

        }
    );


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