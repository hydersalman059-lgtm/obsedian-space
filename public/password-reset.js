(function () {
    "use strict";

    let resetPanelCreated = false;

    function $(id) {
        return document.getElementById(id);
    }

    function getSupabase() {
        const C = window.OBSEDIAN_CONFIG || {};

        if (
            !window.supabase ||
            !C.SUPABASE_URL ||
            !C.SUPABASE_PUBLISHABLE_KEY
        ) {
            console.error(
                "Password reset: Supabase configuration unavailable."
            );

            return null;
        }

        return window.supabase.createClient(
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
    }

    const sb = getSupabase();

    if (!sb) {
        return;
    }

    /* =========================================================
       ADD FORGOT PASSWORD LINK
    ========================================================= */

    function addForgotPasswordLink() {

        const login = $("login");
        const password = $("password");

        if (!login || !password) {
            return false;
        }

        if ($("forgotPasswordLink")) {
            return true;
        }

        const link = document.createElement("button");

        link.type = "button";
        link.id = "forgotPasswordLink";

        link.textContent = "Forgot password?";

        link.style.cssText = `
            display:block;
            margin:10px 0 12px auto;
            padding:0;
            border:0;
            background:transparent;
            color:#6d28d9;
            font-size:14px;
            font-weight:700;
            cursor:pointer;
            text-decoration:underline;
        `;

        link.addEventListener(
            "click",
            requestPasswordReset
        );

        password.insertAdjacentElement(
            "afterend",
            link
        );

        return true;
    }

    /* =========================================================
       REQUEST PASSWORD RESET
    ========================================================= */

    async function requestPasswordReset() {

        const emailInput = $("email");
        const message = $("msg");

        if (!emailInput) {
            return;
        }

        const email =
            emailInput.value.trim();

        if (!email) {

            if (message) {
                message.textContent =
                    "Please enter your email address first.";
            }

            emailInput.focus();

            return;
        }

        if (message) {
            message.textContent =
                "Sending password reset email...";
        }

        try {

            const {
                error
            } =
                await sb.auth.resetPasswordForEmail(
                    email,
                    {
                        redirectTo:
                            window.location.origin +
                            "/app/"
                    }
                );

            if (error) {
                throw error;
            }

            if (message) {
                message.textContent =
                    "Password reset email sent. Please check your inbox.";
            }

        } catch (error) {

            console.error(
                "Password reset error:",
                error
            );

            if (message) {
                message.textContent =
                    error?.message ||
                    "Unable to send password reset email.";
            }
        }
    }

    /* =========================================================
       CREATE PASSWORD RESET PANEL
    ========================================================= */

    function createResetPanel() {

        if (resetPanelCreated) {
            return;
        }

        const login = $("login");
        const dash = $("dash");

        if (!login) {
            return;
        }

        const panel =
            document.createElement("div");

        panel.id =
            "passwordResetPanel";

        panel.style.cssText = `
            margin-top:20px;
            padding:22px;
            border:1px solid #e5e7eb;
            border-radius:14px;
            background:#ffffff;
        `;

        panel.innerHTML = `
            <h2 style="
                margin:0 0 8px;
                font-size:22px;
            ">
                Set a new password
            </h2>

            <p style="
                margin:0 0 18px;
                color:#667085;
            ">
                Enter your new password below.
            </p>

            <label style="
                display:block;
                margin-bottom:7px;
                font-weight:700;
            ">
                New password
            </label>

            <input
                id="resetNewPassword"
                type="password"
                autocomplete="new-password"
                placeholder="Minimum 8 characters"
                style="
                    width:100%;
                    box-sizing:border-box;
                "
            >

            <label style="
                display:block;
                margin:15px 0 7px;
                font-weight:700;
            ">
                Confirm password
            </label>

            <input
                id="resetConfirmPassword"
                type="password"
                autocomplete="new-password"
                placeholder="Re-enter your password"
                style="
                    width:100%;
                    box-sizing:border-box;
                "
            >

            <button
                id="updatePasswordButton"
                type="button"
                style="
                    width:100%;
                    margin-top:16px;
                "
            >
                Update password
            </button>

            <p
                id="resetPasswordMessage"
                style="
                    margin:14px 0 0;
                "
            ></p>
        `;

        login.appendChild(panel);

        resetPanelCreated = true;

        $("updatePasswordButton").addEventListener(
            "click",
            updatePassword
        );

        if (dash) {
            dash.classList.add("hidden");
        }

        login.classList.remove("hidden");
    }

    /* =========================================================
       SHOW RESET PANEL
    ========================================================= */

    function showResetPanel() {

        createResetPanel();

        const login = $("login");
        const dash = $("dash");

        if (login) {
            login.classList.remove("hidden");
        }

        if (dash) {
            dash.classList.add("hidden");
        }

        const panel =
            $("passwordResetPanel");

        if (panel) {
            panel.style.display =
                "block";
        }
    }

    /* =========================================================
       UPDATE PASSWORD
    ========================================================= */

    async function updatePassword() {

        const newPassword =
            $("resetNewPassword")?.value || "";

        const confirmPassword =
            $("resetConfirmPassword")?.value || "";

        const message =
            $("resetPasswordMessage");

        const button =
            $("updatePasswordButton");

        if (newPassword.length < 8) {

            message.textContent =
                "Password must contain at least 8 characters.";

            return;
        }

        if (newPassword !== confirmPassword) {

            message.textContent =
                "Passwords do not match.";

            return;
        }

        button.disabled = true;
        button.textContent = "Updating...";

        try {

            const {
                error
            } =
                await sb.auth.updateUser({
                    password:
                        newPassword
                });

            if (error) {
                throw error;
            }

            message.textContent =
                "Password updated successfully.";

            button.textContent =
                "Password updated";

            setTimeout(
                async function () {

                    try {
                        await sb.auth.signOut();
                    } catch (_) {
                    }

                    window.location.href =
                        "/app/";

                },
                1500
            );

        } catch (error) {

            console.error(
                "Password update error:",
                error
            );

            message.textContent =
                error?.message ||
                "Unable to update password.";

            button.disabled = false;
            button.textContent =
                "Update password";
        }
    }

    /* =========================================================
       AUTH STATE
    ========================================================= */

    sb.auth.onAuthStateChange(
        function (event) {

            if (
                event ===
                "PASSWORD_RECOVERY"
            ) {
                showResetPanel();
            }
        }
    );

    /* =========================================================
       INITIALISE
    ========================================================= */

    function initialise() {

        addForgotPasswordLink();

        /*
         * auth-ui.js builds/moves parts of the
         * authentication interface dynamically.
         *
         * Keep checking until the password field exists.
         */
        let attempts = 0;

        const timer =
            setInterval(
                function () {

                    attempts++;

                    if (
                        addForgotPasswordLink() ||
                        attempts >= 40
                    ) {
                        clearInterval(timer);
                    }

                },
                100
            );
    }

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialise
        );

    } else {

        initialise();
    }

})();