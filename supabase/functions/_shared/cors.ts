export const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods":
        "GET, POST, PUT, DELETE, OPTIONS"
};

export function json(
    data: any,
    status = 200
) {
    return new Response(
        JSON.stringify(data),
        {
            status,
            headers: {
                ...cors,
                "Content-Type": "application/json"
            }
        }
    );
}
