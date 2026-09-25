```ts
import { createClient } from "npm:@supabase/supabase-js@2";


/* =========================================================
   SUPABASE URL
========================================================= */

function getSupabaseUrl(): string {

    const url =
        Deno.env.get("SUPABASE_URL");

    if (!url) {
        throw new Error(
            "SUPABASE_URL is missing."
        );
    }

    return url;
}


/* =========================================================
   PUBLIC / PUBLISHABLE KEY
========================================================= */

function getPublishableKey(): string {

    const publishableKeysRaw =
        Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");

    if (publishableKeysRaw) {

        try {

            const publishableKeys =
                JSON.parse(
                    publishableKeysRaw
                );

            if (publishableKeys?.default) {
                return publishableKeys.default;
            }

        } catch (error) {

            console.error(
                "Could not parse SUPABASE_PUBLISHABLE_KEYS:",
                error
            );
        }
    }

    const publishableKey =
        Deno.env.get(
            "SUPABASE_PUBLISHABLE_KEY"
        );

    if (publishableKey) {
        return publishableKey;
    }

    const anonKey =
        Deno.env.get(
            "SUPABASE_ANON_KEY"
        );

    if (anonKey) {
        return anonKey;
    }

    throw new Error(
        "No Supabase publishable/anon key is available."
    );
}


/* =========================================================
   SERVICE ROLE / SECRET KEY
========================================================= */

function getServiceRoleKey(): string {

    /*
     * Prefer the existing variable used by this project.
     */

    const serviceRole =
        Deno.env.get(
            "SUPABASE_SERVICE_ROLE_KEY"
        );

    if (serviceRole) {
        return serviceRole;
    }

    /*
     * Support Supabase's newer secret-key naming as well.
     */

    const secretKey =
        Deno.env.get(
            "SUPABASE_SECRET_KEY"
        );

    if (secretKey) {
        return secretKey;
    }

    /*
     * Legacy fallback.
     */

    const serviceRoleLegacy =
        Deno.env.get(
            "SERVICE_ROLE_KEY"
        );

    if (serviceRoleLegacy) {
        return serviceRoleLegacy;
    }

    throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY is missing."
    );
}


/* =========================================================
   NORMAL CLIENT
========================================================= */

export function client() {

    return createClient(
        getSupabaseUrl(),
        getPublishableKey(),
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        }
    );
}


/* =========================================================
   PRIVILEGED ADMIN CLIENT
 *
 * NEVER expose this client to browser code.
 * This function runs only inside Supabase Edge Functions.
========================================================= */

export function adminClient() {

    return createClient(
        getSupabaseUrl(),
        getServiceRoleKey(),
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        }
    );
}


/* =========================================================
   USER CLIENT
 *
 * Uses the Authorization bearer token supplied by
 * the logged-in browser user.
========================================================= */

export function userClient(
    req: Request
) {

    const authorization =
        req.headers.get(
            "Authorization"
        );

    if (!authorization) {
        return null;
    }

    const token =
        authorization
            .replace(
                /^Bearer\s+/i,
                ""
            )
            .trim();

    if (!token) {
        return null;
    }

    return createClient(
        getSupabaseUrl(),
        getPublishableKey(),
        {
            global: {
                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            },
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        }
    );
}


/* =========================================================
   GET AUTHENTICATED USER
========================================================= */

export async function userFrom(
    req: Request
) {

    const authorization =
        req.headers.get(
            "Authorization"
        );

    if (!authorization) {
        return null;
    }

    const token =
        authorization
            .replace(
                /^Bearer\s+/i,
                ""
            )
            .trim();

    if (!token) {
        return null;
    }

    try {

        const sb =
            client();

        const {
            data: {
                user
            },
            error
        } =
            await sb.auth.getUser(
                token
            );

        if (error) {

            console.error(
                "Auth error:",
                error.message
            );

            return null;
        }

        return user;

    } catch (error) {

        console.error(
            "Authentication exception:",
            error
        );

        return null;
    }
}
```
