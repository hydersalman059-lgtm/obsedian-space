(function () {
    "use strict";

    let authClient = null;

    function createClient() {
        if (authClient) {
            return authClient;
        }

        const config = window.OBSEDIAN_CONFIG || {};

        if (
            !window.supabase ||
            !config.SUPABASE_URL ||
            !config.SUPABASE_PUBLISHABLE_KEY
        ) {
            return null;
        }

        authClient = window.supabase.createClient(
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

        return authClient;
    }

    function requestedAuthDestination() {
        const params = new URLSearchParams(window.location.search);

        return params.get("redirect") === "/admin/"
            ? "/admin/"
            : "/app/";
    }

    function isRecoveryCallback() {
        const hash = window.location.hash || "";
        const search = window.location.search || "";

        return (
            /(?:^|[&#])type=recovery(?:&|$)/i.test(hash) ||
            /(?:^|[?&])type=recovery(?:&|$)/i.test(search)
        );
    }

    function setMessage(element, text, kind) {
        if (!element) {
            return;
        }

        element.className = "auth-message";
        element.textContent = text || "";

        if (kind) {
            element.classList.add(kind);
        }
    }

    function makeAuthClient() {
        const client = createClient();

        if (!client) {
            throw new Error(
                "Authentication configuration is unavailable."
            );
        }

        return client;
    }

    function initAuthUI() {
        const card = document.getElementById("login");
        if (!card) {
            return;
        }

        const client = createClient();

        /*
         * Keep the existing, working dashboard authentication code intact,
         * but expose only the requested public methods in the sign-in UI.
         */
        const existingPanel = document.createElement("div");
        existingPanel.className = "login-panel";
        existingPanel.id = "loginFormPanel";

        Array.from(card.children).forEach(function (child) {
            existingPanel.appendChild(child);
        });

        /* Remove methods the user does not want visible in the sign-in form. */
        [
            "google",
            "phone",
            "phoneBtn"
        ].forEach(function (id) {
            const element = document.getElementById(id);
            if (element) {
                element.remove();
            }
        });

        const description = existingPanel.querySelector("p");
        if (description) {
            description.textContent =
                "Sign in with your email, password, magic link, or GitHub.";
        }

        const githubButton = document.getElementById("github");
        if (githubButton) {
            githubButton.textContent = "Continue with GitHub";
            githubButton.type = "button";
        }

        /* Forgot-password link */
        const passwordInput = document.getElementById("password");
        if (passwordInput) {
            const forgot = document.createElement("button");
            forgot.type = "button";
            forgot.id = "forgotPasswordBtn";
            forgot.className = "auth-text-button";
            forgot.textContent = "Forgot password?";
            forgot.setAttribute("aria-controls", "forgotPasswordPanel");

            passwordInput.insertAdjacentElement("afterend", forgot);
        }

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
                A confirmation email may be required before your first sign-in.
            </div>
        `;

        const forgotPanel = document.createElement("div");
        forgotPanel.className = "forgot-panel hidden";
        forgotPanel.id = "forgotPasswordPanel";
        forgotPanel.innerHTML = `
            <h2>Reset your password</h2>
            <p>Enter your account email and we'll send you a secure password-reset link.</p>

            <label for="resetEmail">Email address</label>
            <input
                id="resetEmail"
                type="email"
                autocomplete="email"
                placeholder="you@example.com"
                maxlength="160"
            >

            <div class="signup-actions">
                <button id="sendResetBtn" type="button">Send reset link</button>
                <button id="backToSignInBtn" type="button" class="secondary-action">
                    Back to sign in
                </button>
            </div>

            <p id="resetMessage" class="auth-message" aria-live="polite"></p>
        `;

        const recoveryPanel = document.createElement("div");
        recoveryPanel.className = "forgot-panel hidden";
        recoveryPanel.id = "recoveryPanel";
        recoveryPanel.innerHTML = `
            <h2>Set a new password</h2>
            <p>Choose a new password for your Obsedian.Space account.</p>

            <label for="newPassword">New password</label>
            <input
                id="newPassword"
                type="password"
                autocomplete="new-password"
                placeholder="Minimum 8 characters"
            >

            <label for="confirmNewPassword">Confirm new password</label>
            <input
                id="confirmNewPassword"
                type="password"
                autocomplete="new-password"
                placeholder="Re-enter your new password"
            >

            <div class="signup-actions">
                <button id="updatePasswordBtn" type="button">Update password</button>
            </div>

            <p id="recoveryMessage" class="auth-message" aria-live="polite"></p>
        `;

        card.appendChild(tabs);
        card.appendChild(existingPanel);
        card.appendChild(signupPanel);
        card.appendChild(forgotPanel);
        card.appendChild(recoveryPanel);

        const tabButtons = tabs.querySelectorAll("[data-auth-tab]");

        function showOnlyLoginArea() {
            existingPanel.classList.remove("hidden");
            signupPanel.classList.add("hidden");
            forgotPanel.classList.add("hidden");
            recoveryPanel.classList.add("hidden");
        }

        function showSignupArea() {
            existingPanel.classList.add("hidden");
            signupPanel.classList.remove("hidden");
            forgotPanel.classList.add("hidden");
            recoveryPanel.classList.add("hidden");

            document.getElementById("signupName")?.focus();
        }

        function showForgotArea() {
            existingPanel.classList.add("hidden");
            signupPanel.classList.add("hidden");
            forgotPanel.classList.remove("hidden");
            recoveryPanel.classList.add("hidden");

            const email = document.getElementById("email")?.value?.trim() || "";
            const resetEmail = document.getElementById("resetEmail");
            if (resetEmail && email) {
                resetEmail.value = email;
            }

            resetEmail?.focus();
        }

        function showRecoveryArea() {
            existingPanel.classList.add("hidden");
            signupPanel.classList.add("hidden");
            forgotPanel.classList.add("hidden");
            recoveryPanel.classList.remove("hidden");

            document.getElementById("newPassword")?.focus();
        }

        function setMode(mode) {
            const signup = mode === "signup";

            if (signup) {
                showSignupArea();
            } else {
                showOnlyLoginArea();
            }

            tabButtons.forEach(function (button) {
                button.classList.toggle(
                    "active",
                    button.dataset.authTab === mode
                );
            });
        }

        tabButtons.forEach(function (button) {
            button.addEventListener("click", function () {
                setMode(button.dataset.authTab);
            });
        });

        const forgotButton = document.getElementById("forgotPasswordBtn");
        if (forgotButton) {
            forgotButton.addEventListener("click", showForgotArea);
        }

        const backButton = document.getElementById("backToSignInBtn");
        if (backButton) {
            backButton.addEventListener("click", function () {
                showOnlyLoginArea();
                tabButtons.forEach(function (button) {
                    button.classList.toggle(
                        "active",
                        button.dataset.authTab === "login"
                    );
                });
            });
        }

        /* Signup */
        const signupButton = document.getElementById("signupBtn");
        const signupMessage = document.getElementById("signupMessage");

        if (signupButton && signupMessage) {
            signupButton.addEventListener("click", async function () {
                const name = document.getElementById("signupName")?.value.trim() || "";
                const email = document.getElementById("signupEmail")?.value.trim() || "";
                const password = document.getElementById("signupPassword")?.value || "";
                const confirm = document.getElementById("signupConfirm")?.value || "";

                setMessage(signupMessage, "", null);

                if (name.length < 2) {
                    setMessage(signupMessage, "Please enter your full name.", "error");
                    return;
                }

                if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
                    setMessage(signupMessage, "Please enter a valid email address.", "error");
                    return;
                }

                if (password.length < 8) {
                    setMessage(signupMessage, "Password must be at least 8 characters.", "error");
                    return;
                }

                if (password !== confirm) {
                    setMessage(signupMessage, "Passwords do not match.", "error");
                    return;
                }

                let clientInstance;
                try {
                    clientInstance = makeAuthClient();
                } catch (error) {
                    setMessage(signupMessage, error.message, "error");
                    return;
                }

                signupButton.disabled = true;
                signupButton.textContent = "Creating account…";
                setMessage(signupMessage, "Creating your account…", null);

                try {
                    const destination = requestedAuthDestination();

                    const { data, error } = await clientInstance.auth.signUp({
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
                        setMessage(
                            signupMessage,
                            error.message || "Unable to create the account.",
                            "error"
                        );
                        return;
                    }

                    if (data?.session) {
                        setMessage(
                            signupMessage,
                            "Account created. Opening your workspace…",
                            "ok"
                        );
                        return;
                    }

                    setMessage(
                        signupMessage,
                        "Account created. Check your email to confirm the account, then sign in.",
                        "ok"
                    );

                    const loginEmail = document.getElementById("email");
                    const loginPassword = document.getElementById("password");

                    if (loginEmail) {
                        loginEmail.value = email;
                    }
                    if (loginPassword) {
                        loginPassword.value = "";
                    }
                } catch (error) {
                    console.error("Signup error:", error);
                    setMessage(
                        signupMessage,
                        error?.message || "Unable to create the account.",
                        "error"
                    );
                } finally {
                    signupButton.disabled = false;
                    signupButton.textContent = "Create free account";
                }
            });
        }

        /* Password reset request */
        const sendResetButton = document.getElementById("sendResetBtn");
        const resetMessage = document.getElementById("resetMessage");

        if (sendResetButton && resetMessage) {
            sendResetButton.addEventListener("click", async function () {
                const email = document.getElementById("resetEmail")?.value.trim() || "";

                setMessage(resetMessage, "", null);

                if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
                    setMessage(resetMessage, "Please enter a valid email address.", "error");
                    return;
                }

                let clientInstance;
                try {
                    clientInstance = makeAuthClient();
                } catch (error) {
                    setMessage(resetMessage, error.message, "error");
                    return;
                }

                sendResetButton.disabled = true;
                sendResetButton.textContent = "Sending…";
                setMessage(resetMessage, "Sending your password-reset email…", null);

                try {
                    const { error } = await clientInstance.auth.resetPasswordForEmail(
                        email,
                        {
                            redirectTo:
                                window.location.origin + "/app/"
                        }
                    );

                    if (error) {
                        setMessage(
                            resetMessage,
                            error.message || "Unable to send the reset email.",
                            "error"
                        );
                        return;
                    }

                    setMessage(
                        resetMessage,
                        "Password-reset email sent. Please check your inbox.",
                        "ok"
                    );
                } catch (error) {
                    console.error("Password reset error:", error);
                    setMessage(
                        resetMessage,
                        error?.message || "Unable to send the reset email.",
                        "error"
                    );
                } finally {
                    sendResetButton.disabled = false;
                    sendResetButton.textContent = "Send reset link";
                }
            });
        }

        /* Set a new password after recovery-link callback */
        const updatePasswordButton = document.getElementById("updatePasswordBtn");
        const recoveryMessage = document.getElementById("recoveryMessage");

        if (updatePasswordButton && recoveryMessage) {
            updatePasswordButton.addEventListener("click", async function () {
                const password = document.getElementById("newPassword")?.value || "";
                const confirm = document.getElementById("confirmNewPassword")?.value || "";

                setMessage(recoveryMessage, "", null);

                if (password.length < 8) {
                    setMessage(
                        recoveryMessage,
                        "Password must be at least 8 characters.",
                        "error"
                    );
                    return;
                }

                if (password !== confirm) {
                    setMessage(
                        recoveryMessage,
                        "Passwords do not match.",
                        "error"
                    );
                    return;
                }

                let clientInstance;
                try {
                    clientInstance = makeAuthClient();
                } catch (error) {
                    setMessage(recoveryMessage, error.message, "error");
                    return;
                }

                updatePasswordButton.disabled = true;
                updatePasswordButton.textContent = "Updating…";
                setMessage(recoveryMessage, "Updating your password…", null);

                try {
                    const { error } = await clientInstance.auth.updateUser({
                        password
                    });

                    if (error) {
                        setMessage(
                            recoveryMessage,
                            error.message || "Unable to update the password.",
                            "error"
                        );
                        return;
                    }

                    setMessage(
                        recoveryMessage,
                        "Password updated successfully. You can now sign in with your new password.",
                        "ok"
                    );

                    await clientInstance.auth.signOut();

                    window.setTimeout(function () {
                        window.location.replace("/app/");
                    }, 1200);
                } catch (error) {
                    console.error("Update password error:", error);
                    setMessage(
                        recoveryMessage,
                        error?.message || "Unable to update the password.",
                        "error"
                    );
                } finally {
                    updatePasswordButton.disabled = false;
                    updatePasswordButton.textContent = "Update password";
                }
            });
        }

        /* Recovery-link detection */
        if (client) {
            client.auth.onAuthStateChange(function (event) {
                if (event === "PASSWORD_RECOVERY") {
                    showRecoveryArea();
                }
            });

            if (isRecoveryCallback()) {
                window.setTimeout(function () {
                    showRecoveryArea();
                }, 150);
            }
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initAuthUI);
    } else {
        initAuthUI();
    }
})();
