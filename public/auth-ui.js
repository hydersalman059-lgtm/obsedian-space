(function () {
    "use strict";

    function createClient() {
        const config = window.OBSEDIAN_CONFIG || {};

        if (!window.supabase || !config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY) {
            return null;
        }

        return window.supabase.createClient(
            config.SUPABASE_URL,
            config.SUPABASE_PUBLISHABLE_KEY,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            }
        );
    }

    function requestedAuthDestination() {
        const params = new URLSearchParams(window.location.search);
        return params.get("redirect") === "/admin/"
            ? "/admin/"
            : "/app/";
    }

    function initAuthUI() {
        const card = document.getElementById("login");
        if (!card) {
            return;
        }

        /*
         * Keep the existing login implementation untouched.
         * We simply move its existing controls into a wrapper so
         * the new sign-in / sign-up tabs can switch the interface.
         */
        const existingPanel = document.createElement("div");
        existingPanel.className = "login-panel";
        existingPanel.id = "loginFormPanel";

        Array.from(card.children).forEach(function (child) {
            existingPanel.appendChild(child);
        });

        const tabs = document.createElement("div");
        tabs.className = "auth-tabs";
        tabs.innerHTML = `
            <button type="button" class="auth-tab active" data-auth-tab="login">
                Sign in
            </button>
            <button type="button" class="auth-tab" data-auth-tab="signup">
                Create account
            </button>
        `;

        const signupPanel = document.createElement("div");
        signupPanel.className = "signup-panel hidden";
        signupPanel.id = "signupPanel";
        signupPanel.innerHTML = `
            <h2>Create your account</h2>
            <p>Start your Obsedian.Space workspace with a free 45-day website trial.</p>

            <label for="signupName">Full name</label>
            <input
                id="signupName"
                type="text"
                autocomplete="name"
                placeholder="Your full name"
                maxlength="100"
            >

            <label for="signupEmail">Email address</label>
            <input
                id="signupEmail"
                type="email"
                autocomplete="email"
                placeholder="you@example.com"
                maxlength="160"
            >

            <label for="signupPassword">Password</label>
            <input
                id="signupPassword"
                type="password"
                autocomplete="new-password"
                placeholder="Minimum 8 characters"
            >

            <label for="signupConfirm">Confirm password</label>
            <input
                id="signupConfirm"
                type="password"
                autocomplete="new-password"
                placeholder="Re-enter your password"
            >

            <div class="signup-actions">
                <button id="signupBtn" type="button">Create free account</button>
            </div>

            <p id="signupMessage" class="signup-message" aria-live="polite"></p>

            <div class="auth-note">
                Email confirmation may be required before your first sign-in,
                depending on the Supabase Auth settings for this project.
            </div>
        `;

        card.appendChild(tabs);
        card.appendChild(existingPanel);
        card.appendChild(signupPanel);

        const tabButtons = tabs.querySelectorAll("[data-auth-tab]");

        function setMode(mode) {
            const signup = mode === "signup";

            existingPanel.classList.toggle("hidden", signup);
            signupPanel.classList.toggle("hidden", !signup);

            tabButtons.forEach(function (button) {
                button.classList.toggle(
                    "active",
                    button.dataset.authTab === mode
                );
            });

            if (signup) {
                document.getElementById("signupName")?.focus();
            }
        }

        tabButtons.forEach(function (button) {
            button.addEventListener("click", function () {
                setMode(button.dataset.authTab);
            });
        });

        const signupButton = document.getElementById("signupBtn");
        const message = document.getElementById("signupMessage");

        if (!signupButton || !message) {
            return;
        }

        signupButton.addEventListener("click", async function () {
            const name = document.getElementById("signupName").value.trim();
            const email = document.getElementById("signupEmail").value.trim();
            const password = document.getElementById("signupPassword").value;
            const confirm = document.getElementById("signupConfirm").value;

            message.className = "signup-message";
            message.textContent = "";

            if (name.length < 2) {
                message.classList.add("error");
                message.textContent = "Please enter your full name.";
                return;
            }

            if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
                message.classList.add("error");
                message.textContent = "Please enter a valid email address.";
                return;
            }

            if (password.length < 8) {
                message.classList.add("error");
                message.textContent = "Password must be at least 8 characters.";
                return;
            }

            if (password !== confirm) {
                message.classList.add("error");
                message.textContent = "Passwords do not match.";
                return;
            }

            const client = createClient();

            if (!client) {
                message.classList.add("error");
                message.textContent = "Authentication configuration is unavailable.";
                return;
            }

            signupButton.disabled = true;
            signupButton.textContent = "Creating account…";
            message.className = "signup-message";
            message.textContent = "Creating your account…";

            try {
                const destination = requestedAuthDestination();

                const { data, error } = await client.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: name
                        },
                        emailRedirectTo:
                            window.location.origin + destination
                    }
                });

                if (error) {
                    message.classList.add("error");
                    message.textContent =
                        error.message || "Unable to create the account.";
                    return;
                }

                if (data?.session) {
                    message.classList.add("ok");
                    message.textContent =
                        "Account created. Opening your workspace…";
                    return;
                }

                message.classList.add("ok");
                message.textContent =
                    "Account created. Check your email to confirm the account, then sign in.";

                document.getElementById("email").value = email;
                document.getElementById("password").value = "";

            } catch (error) {
                console.error("Signup error:", error);
                message.classList.add("error");
                message.textContent =
                    error?.message || "Unable to create the account.";
            } finally {
                signupButton.disabled = false;
                signupButton.textContent = "Create free account";
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initAuthUI);
    } else {
        initAuthUI();
    }
})();
