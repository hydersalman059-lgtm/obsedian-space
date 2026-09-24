const sb = supabase.createClient(
    window.OBSEDIAN_CONFIG.SUPABASE_URL,
    window.OBSEDIAN_CONFIG.SUPABASE_PUBLISHABLE_KEY
);

const $ = (id) => document.getElementById(id);

let currentSection = "dashboard";

async function getSession() {

    const {
        data: { session }
    } = await sb.auth.getSession();

    if (!session) {
        location.href = "/app/";
        return null;
    }

    return session;
}

async function api(section, params = {}) {

    const session = await getSession();

    if (!session) return null;

    const query = new URLSearchParams({
        section,
        ...params
    });

    const response = await fetch(
        `/api/admin?${query.toString()}`,
        {
            headers: {
                Authorization:
                    `Bearer ${session.access_token}`
            }
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data?.error || "Admin request failed."
        );
    }

    return data;
}


/* -----------------------------------------
   Dashboard
----------------------------------------- */

async function loadDashboard() {

    $("pageTitle").textContent =
        "Admin Dashboard";

    const data =
        await api("dashboard");

    const metrics =
        data?.metrics || {};

    $("content").innerHTML = `

        <div class="stats">

            ${Object.entries(metrics)
                .map(([key, value]) => `
                    <div class="stat">
                        <small>
                            ${escapeHtml(
                                formatLabel(key)
                            )}
                        </small>

                        <br>

                        <b>
                            ${escapeHtml(
                                String(value ?? 0)
                            )}
                        </b>
                    </div>
                `)
                .join("")}

        </div>

        <div class="card">

            <h2>
                Recent Audit Logs
            </h2>

            <pre id="logs">
${escapeHtml(
    JSON.stringify(
        data?.logs || [],
        null,
        2
    )
)}
            </pre>

        </div>
    `;
}


/* -----------------------------------------
   Users
----------------------------------------- */

async function loadUsers() {

    $("pageTitle").textContent =
        "Users";

    $("content").innerHTML = `

        <div class="card">

            <input
                id="userSearch"
                class="search-box"
                placeholder="Search name, email, phone, plan..."
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

    searchInput.addEventListener(
        "input",
        () => {

            clearTimeout(timer);

            timer = setTimeout(
                () => refreshUsers(),
                300
            );
        }
    );

    await refreshUsers();
}


async function refreshUsers() {

    const search =
        $("userSearch")?.value || "";

    const data =
        await api("users", {
            search
        });

    renderUsers(
        data?.users || []
    );
}


function renderUsers(users) {

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

                    ${users.map(user => `

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
                                        user.role
                                    )}
                                </span>
                            </td>

                            <td>
                                ${escapeHtml(
                                    user.plan_id
                                )}
                            </td>

                            <td>
                                <span class="badge">
                                    ${escapeHtml(
                                        user.subscription_status
                                    )}
                                </span>
                            </td>

                            <td>
                                ${user.websites}
                            </td>

                            <td>
                                ${user.ai_runs}
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

                    `).join("")}

                </tbody>

            </table>

        </div>
    `;
}


/* -----------------------------------------
   Navigation
----------------------------------------- */

async function loadSection(section) {

    currentSection = section;

    document
        .querySelectorAll(
            ".admin-nav button"
        )
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.section === section
            );

        });

    try {

        if (section === "dashboard") {
            await loadDashboard();
            return;
        }

        if (section === "users") {
            await loadUsers();
            return;
        }

        $("pageTitle").textContent =
            formatLabel(section);

        $("content").innerHTML = `

            <div class="card">

                <h2>
                    ${escapeHtml(
                        formatLabel(section)
                    )}
                </h2>

                <p>
                    This module will be implemented
                    in the next Admin Panel step.
                </p>

            </div>

        `;

    } catch (error) {

        console.error(error);

        $("content").innerHTML = `

            <div class="card">

                <h2>
                    Error
                </h2>

                <p>
                    ${escapeHtml(
                        error.message
                    )}
                </p>

            </div>
        `;
    }
}


/* -----------------------------------------
   Helpers
----------------------------------------- */

function formatLabel(value) {

    return String(value)
        .replaceAll("_", " ")
        .replace(/\b\w/g, c =>
            c.toUpperCase()
        );
}


function formatDate(value) {

    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );
}


function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* -----------------------------------------
   Events
----------------------------------------- */

document
    .querySelectorAll(".admin-nav button")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => loadSection(
                button.dataset.section
            )
        );

    });


$("logout").onclick = async () => {

    await sb.auth.signOut();

    location.href = "/app/";
};


/* -----------------------------------------
   Start
----------------------------------------- */

loadSection("dashboard");