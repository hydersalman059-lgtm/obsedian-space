(function () {
    "use strict";

    const C = window.OBSEDIAN_CONFIG || {};

    if (
        !window.supabase ||
        !C.SUPABASE_URL ||
        !C.SUPABASE_PUBLISHABLE_KEY
    ) {
        console.error(
            "Authentication override: Supabase configuration unavailable."
        );
        return;
    }

    const auth = window.supabase.createClient(
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

    function $(id) {
        return document.getElementById(id);
    }

    function hideUnusedMethods() {

        const google = $("google");
        const phone = $("phone");
        const phoneBtn = $("phoneBtn");

        if (google) {
            google.style.display = "none";
        }

        if (phone) {
            phone.style.display = "none";

            const wrapper =
                phone.closest("div");

            if (wrapper) {
                wrapper.style.display = "none";
            }
        }

        if (phoneBtn) {
            phoneBtn.style.display = "none";
        }

        const description =
            document.querySelector("#login p");

        if (description) {
            description.textContent =
                "Sign in with your email, password, magic link, or GitHub.";
        }
    }

    function addForgotPassword() {

        const password =
            $("password");

        if (!password) {
            return;
        }

        if ($("forgotPasswordBtn")) {
            return;
        }

        const button =
            document.createElement("button");

        button.id =
            "forgotPasswordBtn";

        button.type =
            "button";

        button.textContent =
            "Forgot password?";

        button.style.cssText = `
            display:block;
            width:auto;
            margin:10px 0 6px auto;
            padding:6px 0;
            border:0;
            background:transparent;
            color:#6d28d9;
            font-weight:700;
            cursor:pointer;
            text-decoration:underline;
        `;

        password.parentNode.insertBefore(
            button,
            password.nextSibling
        );

        button.addEventListener(
            "click",
            requestPasswordReset
        );
    }

    async function requestPasswordReset() {

        const emailInput =
            $("email");

        const message =
            $("msg");

        if (!emailInput) {
            return;
        }

        const email =
            emailInput.value.trim();

        if (!email) {

            if (message) {
                message.textContent =
                    "Enter your email address first.";
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
                await auth.auth.resetPasswordForEmail(
                    email,
                    {
                        redirectTo:
                            window.location.origin +
                            "/app/?reset=1"
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

    function showResetPanel() {

        const login =
            $("login");

        const dash =
            $("dash");

        if (login) {
            login.classList.add("hidden");
        }

        if (dash) {
            dash.classList.add("hidden");
        }

        let panel =
            $("passwordResetPanel");

        if (!panel) {

            panel =
                document.createElement("section");

            panel.id =
                "passwordResetPanel";

            panel.className =
                "card";

            panel.style.cssText = `
                max-width:620px;
                margin:40px auto;
                padding:28px;
            `;

            panel.innerHTML = `
                <small style="
                    display:block;
                    margin-bottom:8px;
                    color:#6d28d9;
                    font-weight:800;
                ">
                    OBSEDIAN.SPACE
                </small>

                <h2 style="
                    margin:0 0 8px;
                ">
                    Set a new password
                </h2>

                <p style="
                    color:#667085;
                    margin-bottom:22px;
                ">
                    Enter your new password below.
                </p>

                <label style="
                    display:block;
                    margin-bottom:8px;
                    font-weight:700;
                ">
                    New password
                </label>

                <input
                    id="newPassword"
                    type="password"
                    autocomplete="new-password"
                    placeholder="Minimum 8 characters"
                >

                <label style="
                    display:block;
                    margin:16px 0 8px;
                    font-weight:700;
                ">
                    Confirm password
                </label>

                <input
                    id="confirmNewPassword"
                    type="password"
                    autocomplete="new-password"
                    placeholder="Re-enter your password"
                >

                <button
                    id="updatePasswordBtn"
                    type="button"
                    style="
                        margin-top:18px;
                        width:100%;
                    "
                >
                    Update password
                </button>

                <p
                    id="passwordResetMessage"
                    style="margin-top:14px;"
                ></p>
            `;

            document
                .querySelector("main")
                ?.appendChild(panel);

            $("updatePasswordBtn")
                .addEventListener(
                    "click",
                    updatePassword
                );
        }

        panel.classList.remove("hidden");
        panel.style.display = "block";
    }

    async function updatePassword() {

        const newPassword =
            $("newPassword")?.value || "";

        const confirmPassword =
            $("confirmNewPassword")?.value || "";

        const message =
            $("passwordResetMessage");

        const button =
            $("updatePasswordBtn");

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

        button.disabled =
            true;

        button.textContent =
            "Updating...";

        try {

            const {
                error
            } =
                await auth.auth.updateUser({
                    password:
                        newPassword
                });

            if (error) {
                throw error;
            }

            message.textContent =
                "Password updated successfully. Returning to sign in...";

            setTimeout(
                async function () {

                    try {
                        await auth.auth.signOut();
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

            button.disabled =
                false;

            button.textContent =
                "Update password";
        }
    }

    auth.auth.onAuthStateChange(
        function (event) {

            if (
                event ===
                "PASSWORD_RECOVERY"
            ) {
                showResetPanel();
            }
        }
    );

    function initialise() {

        hideUnusedMethods();
        addForgotPassword();

        const reset =
            new URLSearchParams(
                window.location.search
            ).get("reset");

        if (reset === "1") {
            showResetPanel();
        }
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