(function () {

    "use strict";


    /* =====================================================
       CONFIGURATION
    ===================================================== */

    const SUPABASE_URL =
        window.OBSEDIAN_CONFIG?.SUPABASE_URL ||
        "https://ssfntnqcqvpexvnqvkus.supabase.co";


    const BRANDING_ENDPOINT =
        SUPABASE_URL +
        "/functions/v1/public-branding";


    /* =====================================================
       LOAD BRANDING
    ===================================================== */

    async function loadBranding() {

        try {

            const response =
                await fetch(
                    BRANDING_ENDPOINT +
                    "?v=" +
                    Date.now(),
                    {
                        method: "GET",
                        cache: "no-store"
                    }
                );


            if (!response.ok) {

                throw new Error(
                    "Branding API returned HTTP " +
                    response.status
                );
            }


            const data =
                await response.json();


            if (
                !data ||
                !data.success
            ) {

                throw new Error(
                    data?.error ||
                    "Invalid branding response."
                );
            }


            const branding =
                data.branding ||
                {};


            applyBranding(
                branding
            );


        } catch (error) {

            console.error(
                "[BRANDING] Unable to load branding:",
                error
            );

        }
    }


    /* =====================================================
       APPLY BRANDING
    ===================================================== */

    function applyBranding(
        branding
    ) {

        const brandName =
            branding.brand_name ||
            "Obsedian.Space";


        const logoUrl =
            branding.logo_url ||
            "";


        const primaryColor =
            branding.primary_color ||
            "";


        const accentColor =
            branding.accent_color ||
            "";


        /* -----------------------------------------------
           PAGE TITLE
        ----------------------------------------------- */

        if (brandName) {

            document.title =
                brandName;

        }


        /* -----------------------------------------------
           BRAND TEXT
        ----------------------------------------------- */

        document
            .querySelectorAll(
                ".brand-name, .app-brand-name, [data-brand-name]"
            )
            .forEach(
                element => {

                    element.textContent =
                        brandName;

                }
            );


        /* -----------------------------------------------
           LOGO IMAGES
        ----------------------------------------------- */

        if (logoUrl) {

            document
                .querySelectorAll(
                    ".brand img, .logo img, .app-brand-logo, img[data-brand-logo]"
                )
                .forEach(
                    image => {

                        image.src =
                            addCacheBust(
                                logoUrl
                            );

                        image.removeAttribute(
                            "srcset"
                        );

                        image.loading =
                            "eager";

                    }
                );


            /*
             * Fallback:
             * find image elements whose existing
             * source looks like a logo.
             */

            document
                .querySelectorAll(
                    "img"
                )
                .forEach(
                    image => {

                        const src =
                            image.getAttribute(
                                "src"
                            ) ||
                            "";

                        const alt =
                            image.getAttribute(
                                "alt"
                            ) ||
                            "";

                        if (
                            /logo/i.test(src) ||
                            /logo/i.test(alt)
                        ) {

                            image.src =
                                addCacheBust(
                                    logoUrl
                                );

                        }

                    }
                );

        }


        /* -----------------------------------------------
           CSS VARIABLES
        ----------------------------------------------- */

        if (primaryColor) {

            document.documentElement.style
                .setProperty(
                    "--primary-color",
                    primaryColor
                );

        }


        if (accentColor) {

            document.documentElement.style
                .setProperty(
                    "--accent-color",
                    accentColor
                );

        }


        /*
         * Make branding available globally.
         */

        window.OBSEDIAN_BRANDING =
            branding;


        /*
         * Notify other scripts/components.
         */

        window.dispatchEvent(
            new CustomEvent(
                "obsedian:branding",
                {
                    detail:
                        branding
                }
            )
        );
    }


    /* =====================================================
       CACHE BUST
    ===================================================== */

    function addCacheBust(
        url
    ) {

        if (!url) {
            return url;
        }


        const separator =
            url.includes("?")
                ? "&"
                : "?";


        return (
            url +
            separator +
            "v=" +
            Date.now()
        );
    }


    /* =====================================================
       START
    ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            loadBranding,
            {
                once: true
            }
        );

    } else {

        loadBranding();

    }

})();