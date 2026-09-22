import { createClient } from "npm:@supabase/supabase-js@2";

/* =========================================================
   SUPABASE KEY
========================================================= */

function getSupabaseKey(): string {
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

    const anonKey =
        Deno.env.get("SUPABASE_ANON_KEY");

    if (anonKey) {
        return anonKey;
    }

    throw new Error(
        "No Supabase publishable/anon key is available."
    );
}


/* =========================================================
   BASIC SUPABASE CLIENT
========================================================= */

export function client() {

    const supabaseUrl =
        Deno.env.get("SUPABASE_URL");

    if (!supabaseUrl) {
        throw new Error(
            "SUPABASE_URL is missing."
        );
    }

    return createClient(
        supabaseUrl,
        getSupabaseKey()
    );
}


/* =========================================================
   AUTHENTICATED USER CLIENT
========================================================= */

export function userClient(
    req: Request
) {

    const supabaseUrl =
        Deno.env.get("SUPABASE_URL");

    if (!supabaseUrl) {
        throw new Error(
            "SUPABASE_URL is missing."
        );
    }

    const authorization =
        req.headers.get(
            "Authorization"
        );

    if (!authorization) {
        return null;
    }

    const token =
        authorization.replace(
            /^Bearer\s+/i,
            ""
        ).trim();

    if (!token) {
        return null;
    }

    return createClient(
        supabaseUrl,
        getSupabaseKey(),
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
        authorization.replace(
            /^Bearer\s+/i,
            ""
        ).trim();

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
                error
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