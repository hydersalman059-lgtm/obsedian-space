(function () {
    "use strict";

    function initMobileNavigation() {
        const toggle = document.getElementById("mobileNavToggle");
        const menu = document.getElementById("mobileNavMenu");
        const close = document.getElementById("mobileNavClose");
        const backdrop = document.getElementById("mobileNavBackdrop");

        if (!toggle || !menu || !backdrop) {
            return;
        }

        function setOpen(open) {
            document.body.classList.toggle("mobile-nav-open", open);
            toggle.setAttribute("aria-expanded", String(open));
            toggle.setAttribute(
                "aria-label",
                open ? "Close navigation menu" : "Open navigation menu"
            );
            menu.setAttribute("aria-hidden", String(!open));
            backdrop.setAttribute("aria-hidden", String(!open));
        }

        toggle.addEventListener("click", function () {
            setOpen(!document.body.classList.contains("mobile-nav-open"));
        });

        if (close) {
            close.addEventListener("click", function () {
                setOpen(false);
            });
        }

        backdrop.addEventListener("click", function () {
            setOpen(false);
        });

        menu.querySelectorAll("a").forEach(function (link) {
            link.addEventListener("click", function () {
                setOpen(false);
            });
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                setOpen(false);
            }
        });

        window.addEventListener("resize", function () {
            if (window.innerWidth > 1050) {
                setOpen(false);
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initMobileNavigation);
    } else {
        initMobileNavigation();
    }
})();
