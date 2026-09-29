import {
    adminClient
} from "../_shared/auth.ts";

import {
    cors
} from "../_shared/cors.ts";


/* =========================================================
   OBSEDIAN.SPACE
   PUBLIC BRANDING API
========================================================= */

Deno.serve(
    async (req) => {

        /* -----------------------------------------------
           CORS PREFLIGHT
        ----------------------------------------------- */

        if (req.method === "OPTIONS") {

            return new Response(
                null,
                {
                    status: 204,
                    headers: cors
                }
            );
        }


        /* -----------------------------------------------
           ONLY GET
        ----------------------------------------------- */

        if (req.method !== "GET") {

            return new Response(
                JSON.stringify({
                    error:
                        "Method not allowed"
                }),
                {
                    status: 405,
                    headers: {
                        ...cors,
                        "Content-Type":
                            "application/json"
                    }
                }
            );
        }


        try {

            /* -------------------------------------------
               SERVICE ROLE CLIENT
            ------------------------------------------- */

            const sb =
                adminClient();


            /* -------------------------------------------
               LOAD BRANDING SETTING
            ------------------------------------------- */

            const {
                data,
                error
            } =
                await sb
                    .from("settings")
                    .select(
                        "key,value,updated_at"
                    )
                    .eq(
                        "key",
                        "branding"
                    )
                    .maybeSingle();


            if (error) {

                console.error(
                    "Public branding query error:",
                    error
                );

                return new Response(
                    JSON.stringify({
                        error:
                            "Unable to load branding settings."
                    }),
                    {
                        status: 500,
                        headers: {
                            ...cors,
                            "Content-Type":
                                "application/json"
                        }
                    }
                );
            }


            const branding =
                data?.value &&
                typeof data.value ===
                    "object"
                    ? data.value
                    : {};


            /* -------------------------------------------
               NORMALIZED RESPONSE
            ------------------------------------------- */

            return new Response(
                JSON.stringify({

                    success: true,

                    branding: {

                        brand_name:
                            branding.brand_name ||
                            "Obsedian.Space",

                        logo_url:
                            branding.logo_url ||
                            "",

                        primary_color:
                            branding.primary_color ||
                            "#7c3aed",

                        accent_color:
                            branding.accent_color ||
                            "#f59e0b",

                        support_email:
                            branding.support_email ||
                            ""

                    },

                    updated_at:
                        data?.updated_at ||
                        null

                }),
                {
                    status: 200,
                    headers: {
                        ...cors,
                        "Content-Type":
                            "application/json; charset=utf-8",

                        "Cache-Control":
                            "public, max-age=60"
                    }
                }
            );

        } catch (error) {

            console.error(
                "Public branding error:",
                error
            );

            return new Response(
                JSON.stringify({
                    error:
                        error?.message ||
                        "Unable to load branding."
                }),
                {
                    status: 500,
                    headers: {
                        ...cors,
                        "Content-Type":
                            "application/json"
                    }
                }
            );
        }
    }
);