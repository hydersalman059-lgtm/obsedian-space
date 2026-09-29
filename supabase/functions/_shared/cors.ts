/*
 * OBSEDIAN.SPACE
 * Shared CORS helper
 *
 * Allows requests from both the custom production domain
 * and the Cloudflare Pages domain.
 *
 * Using "*" here is appropriate for these API calls because
 * authentication is performed with the Supabase Authorization
 * header rather than browser cookie credentials.
 */

export const cors = {
    "Access-Control-Allow-Origin": "*",

    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",

    "Access-Control-Allow-Methods":
        "GET, POST, PUT, PATCH, DELETE, OPTIONS",

    "Access-Control-Max-Age":
        "86400",

    "Vary":
        "Origin"
};


export function json(
    data: unknown,
    status = 200
): Response {

    return new Response(
        JSON.stringify(data),
        {
            status,

            headers: {
                ...cors,

                "Content-Type":
                    "application/json; charset=utf-8",

                "Cache-Control":
                    "no-store"
            }
        }
    );
}


export function optionsResponse(): Response {

    return new Response(
        null,
        {
            status: 204,

            headers:
                cors
        }
    );
}