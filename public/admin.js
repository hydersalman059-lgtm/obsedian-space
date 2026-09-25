```javascript
/* =========================================================
   OBSEDIAN.SPACE
   ADMIN PANEL
========================================================= */


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

const $ = (id) =>
    document.getElementById(id);

let currentSection = "dashboard";


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
   REDIRECT TO LOGIN
========================================================= */

function redirectToLogin() {

    sessionStorage.setItem(
        "obsedian_admin_login",
        "1"
    );

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
   DASHBOARD
========================================================= */

async function loadDashboard() {

    $("pageTitle").textContent =
        "Admin Dashboard";


    $("content").innerHTML = `

        <div class="card">

            <h2>
                Loading dashboard...
            </h2>

            <p>
                Please wait while admin statistics
                are being loaded.
            </p>

        </div>

    `;


    const data =
        await api(
            "dashboard"
        );


    const metrics =
        data?.metrics || {};


    $("content").innerHTML = `

        <div class="stats">

            ${Object.entries(metrics)
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


    searchInput.addEventListener(
        "input",
        () => {

            clearTimeout(
                timer
            );


            timer =
                setTimeout(
                    () => refreshUsers(),
                    300
                );

        }
    );


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
                            Status
                        </th>

                        <th>
                            Websites
                        </th>

                        <th>
                            AI Runs
                        </th>

                        <th>
                            Expiry
                        </th>

                        <th>
                            Registered
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
                        .join("")
                    }

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


    $("content").innerHTML = `

        <div class="card">

            <div style="
                display:flex;
                gap:12px;
                align-items:center;
                justify-content:space-between;
                flex-wrap:wrap;
            ">

                <div>

                    <h2 style="margin:0 0 6px;">
                        Website Management
                    </h2>

                    <p style="margin:0;">
                        Monitor websites connected to
                        Obsedian.Space accounts.
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

            <input
                id="websiteSearch"
                class="search-box"
                placeholder="Search website, URL, user ID, status..."
                autocomplete="off"
            >

        </div>


        <div class="card">

            <div id="websitesTable">

                Loading websites...

            </div>

        </div>

    `;


    const searchInput =
        $("websiteSearch");


    let timer;


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            () => {

                clearTimeout(
                    timer
                );


                timer =
                    setTimeout(
                        () => refreshWebsites(),
                        300
                    );

            }
        );

    }


    $("refreshWebsites")?.addEventListener(
        "click",
        () => refreshWebsites()
    );


    await refreshWebsites();
}


/* =========================================================
   REFRESH WEBSITES
========================================================= */

async function refreshWebsites() {

    const search =
        $("websiteSearch")?.value || "";


    const container =
        $("websitesTable");


    if (container) {

        container.innerHTML = `

            <div class="empty">

                Loading websites...

            </div>

        `;

    }


    const data =
        await api(
            "websites",
            {
                search
            }
        );


    renderWebsites(
        data?.websites || []
    );
}


/* =========================================================
   RENDER WEBSITES
========================================================= */

function renderWebsites(
    websites
) {

    const container =
        $("websitesTable");


    if (!container) {
        return;
    }


    if (!websites.length) {

        container.innerHTML = `

            <div class="empty">

                No websites found.

            </div>

        `;

        return;
    }


    container.innerHTML = `

        <div class="admin-table-wrapper">

            <table class="admin-table">

                <thead>

                    <tr>

                        <th>
                            Website
                        </th>

                        <th>
                            Owner
                        </th>

                        <th>
                            Status
                        </th>

                        <th>
                            Verification
                        </th>

                        <th>
                            Crawl
                        </th>

                        <th>
                            Last Crawled
                        </th>

                        <th>
                            Next Crawl
                        </th>

                        <th>
                            Created
                        </th>

                    </tr>

                </thead>


                <tbody>

                    ${websites
                        .map(
                            website => {

                                const status =
                                    website.status ||
                                    "unknown";


                                const verification =
                                    website.verified_at
                                        ? "Verified"
                                        : "Not verified";


                                return `

                                    <tr>

                                        <td>

                                            <strong>

                                                ${escapeHtml(
                                                    website.name ||
                                                    "Unnamed Website"
                                                )}

                                            </strong>

                                            <br>

                                            <small>

                                                ${escapeHtml(
                                                    website.url ||
                                                    website.normalized_url ||
                                                    "No URL"
                                                )}

                                            </small>

                                            ${
                                                website.normalized_url &&
                                                website.normalized_url !== website.url
                                                    ? `

                                                        <br>

                                                        <small>

                                                            ${escapeHtml(
                                                                website.normalized_url
                                                            )}

                                                        </small>

                                                    `
                                                    : ""
                                            }

                                        </td>


                                        <td>

                                            <small>

                                                ${escapeHtml(
                                                    website.owner_email ||
                                                    website.user_email ||
                                                    website.user_id ||
                                                    "Unknown"
                                                )}

                                            </small>

                                        </td>


                                        <td>

                                            <span class="badge">

                                                ${escapeHtml(
                                                    status
                                                )}

                                            </span>

                                        </td>


                                        <td>

                                            <span class="badge">

                                                ${escapeHtml(
                                                    verification
                                                )}

                                            </span>

                                            ${
                                                website.verified_at
                                                    ? `

                                                        <br>

                                                        <small>

                                                            ${formatDate(
                                                                website.verified_at
                                                            )}

                                                        </small>

                                                    `
                                                    : ""
                                            }

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

                                `;
                            }
                        )
                        .join("")
                    }

                </tbody>

            </table>

        </div>

    `;
}


/* =========================================================
   GENERIC PLACEHOLDER
========================================================= */

function loadPlaceholder(
    section
) {

    $("pageTitle").textContent =
        formatLabel(
            section
        );


    $("content").innerHTML = `

        <div class="card">

            <h2>

                ${escapeHtml(
                    formatLabel(
                        section
                    )
                )}

            </h2>


            <p>

                This module will be implemented
                in the next Admin Panel step.

            </p>

        </div>

    `;
}


/* =========================================================
   NAVIGATION
========================================================= */

async function loadSection(
    section
) {

    currentSection =
        section;


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

        /*
         * Dashboard
         */

        if (
            section ===
            "dashboard"
        ) {

            await loadDashboard();

            return;
        }


        /*
         * Users
         */

        if (
            section ===
            "users"
        ) {

            await loadUsers();

            return;
        }


        /*
         * Websites
         */

        if (
            section ===
            "websites"
        ) {

            await loadWebsites();

            return;
        }


        /*
         * Other sections
         */

        loadPlaceholder(
            section
        );

    } catch (error) {

        console.error(
            "Admin section error:",
            error
        );


        $("content").innerHTML = `

            <div class="card">

                <h2>
                    Error
                </h2>


                <p>

                    ${escapeHtml(
                        error?.message ||
                        "Unable to load this section."
                    )}

                </p>


                <button
                    type="button"
                    id="retrySection"
                >
                    Retry
                </button>

            </div>

        `;


        $("retrySection")?.addEventListener(
            "click",
            () => loadSection(section)
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
        new Date(
            value
        );


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
        new Date(
            value
        );


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
                () => {

                    loadSection(
                        button.dataset.section
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

            location.href =
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

        /*
         * If the user signs out in another tab,
         * return to login.
         */

        if (
            event ===
                "SIGNED_OUT" ||
            !session
        ) {

            location.href =
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
```
