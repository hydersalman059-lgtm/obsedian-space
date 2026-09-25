import { createClient } from "npm:@supabase/supabase-js@2";


/* =========================================================
   ENVIRONMENT
========================================================= */

function supabaseUrl(): string {

    const url = Deno.env.get("SUPABASE_URL");

    if (!url) {
        throw new Error("SUPABASE_URL is missing.");
    }

    return url;
}


function anonKey(): string {

    const publishableKeysRaw =
        Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");

    if (publishableKeysRaw) {

        try {

            const publishableKeys =
                JSON.parse(publishableKeysRaw);

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

    const key =
        Deno.env.get("SUPABASE_ANON_KEY");

    if (key) {
        return key;
    }

    throw new Error(
        "SUPABASE_ANON_KEY / publishable key is missing."
    );
}


function serviceRoleKey(): string {

    const key =
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!key) {
        throw new Error(
            "SUPABASE_SERVICE_ROLE_KEY is missing."
        );
    }

    return key;
}


/* =========================================================
   PUBLIC CLIENT
========================================================= */

export function client() {

    return createClient(
        supabaseUrl(),
        anonKey()
    );
}


/* =========================================================
   SERVICE ROLE CLIENT
   Server-side only
========================================================= */

export function adminClient() {

    return createClient(
        supabaseUrl(),
        serviceRoleKey(),
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        }
    );
}


/* =========================================================
   USER TOKEN
========================================================= */

export function getBearerToken(
    req: Request
): string | null {

    const authorization =
        req.headers.get("Authorization");

    if (!authorization) {
        return null;
    }

    const token =
        authorization
            .replace(/^Bearer\s+/i, "")
            .trim();

    return token || null;
}


/* =========================================================
   AUTHENTICATED USER
========================================================= */

export async function userFrom(
    req: Request
) {

    const token =
        getBearerToken(req);

    if (!token) {
        return null;
    }

    try {

        const sb =
            client();

        const {
            data,
            error
        } =
            await sb.auth.getUser(token);

        if (error) {

            console.error(
                "Auth error:",
                error.message
            );

            return null;
        }

        return data.user || null;

    } catch (error) {

        console.error(
            "Authentication exception:",
            error
        );

        return null;
    }
}