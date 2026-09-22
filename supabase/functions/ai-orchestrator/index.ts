import {
    userFrom,
    userClient
} from "../_shared/auth.ts";

import {
    json,
    cors
} from "../_shared/cors.ts";

/* =========================================================
   HELPERS
========================================================= */

function cleanUrl(value: string): string {
    let url = value.trim();

    if (!/^https?:\/\//i.test(url)) {
        url = "https://" + url;
    }

    return new URL(url).toString();
}


function extractTag(html: string, tag: string): string | null {
    const regex = new RegExp(
        `<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,
        "i"
    );

    const match = html.match(regex);

    if (!match) return null;

    return match[1]
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
}


function extractMeta(
    html: string,
    name: string
): string | null {

    const regex1 = new RegExp(
        `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["'][^>]*>`,
        "i"
    );

    const regex2 = new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["'][^>]*>`,
        "i"
    );

    const match =
        html.match(regex1) ||
        html.match(regex2);

    return match ? match[1].trim() : null;
}


function extractCanonical(html: string): string | null {

    const regex1 =
        /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i;

    const regex2 =
        /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i;

    const match =
        html.match(regex1) ||
        html.match(regex2);

    return match ? match[1].trim() : null;
}


function getText(html: string): string {

    return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


function countMatches(
    html: string,
    regex: RegExp
): number {

    return (html.match(regex) || []).length;
}


function extractLinks(
    html: string,
    baseUrl: string
): string[] {

    const links: string[] = [];

    const regex =
        /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;

    let match;

    while (
        (match = regex.exec(html)) !== null
    ) {

        const href = match[1];

        if (
            href.startsWith("#") ||
            href.startsWith("mailto:") ||
            href.startsWith("tel:") ||
            href.startsWith("javascript:")
        ) {
            continue;
        }

        try {

            const url =
                new URL(
                    href,
                    baseUrl
                ).toString();

            links.push(url);

        } catch {
            // Ignore invalid URLs
        }
    }

    return [
        ...new Set(links)
    ];
}


function extractImages(html: string) {

    const images: {
        src: string;
        alt: string | null;
    }[] = [];

    const regex =
        /<img\b([^>]*)>/gi;

    let match;

    while (
        (match = regex.exec(html)) !== null
    ) {

        const attributes =
            match[1];

        const srcMatch =
            attributes.match(
                /src=["']([^"']+)["']/i
            );

        const altMatch =
            attributes.match(
                /alt=["']([^"']*)["']/i
            );

        if (srcMatch) {

            images.push({
                src: srcMatch[1],
                alt:
                    altMatch
                        ? altMatch[1]
                        : null
            });
        }
    }

    return images;
}


/* =========================================================
   FETCH PAGE
========================================================= */

async function fetchPage(url: string) {

    const started =
        Date.now();

    try {

        const response =
            await fetch(
                url,
                {
                    method: "GET",
                    redirect: "follow",

                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (compatible; ObsedianSpaceBot/1.0; +https://obsedian.space)",

                        "Accept":
                            "text/html,application/xhtml+xml"
                    }
                }
            );

        const html =
            await response.text();

        return {

            ok:
                response.ok,

            status:
                response.status,

            finalUrl:
                response.url,

            html,

            contentType:
                response.headers.get(
                    "content-type"
                ) || "",

            responseTimeMs:
                Date.now() - started

        };

    } catch (error) {

        return {

            ok: false,

            status: 0,

            finalUrl: url,

            html: "",

            contentType: "",

            responseTimeMs:
                Date.now() - started,

            error:
                error instanceof Error
                    ? error.message
                    : String(error)

        };
    }
}


/* =========================================================
   TEXT FILE FETCH
========================================================= */

async function fetchTextFile(url: string) {

    try {

        const response =
            await fetch(
                url,
                {
                    method: "GET",
                    redirect: "follow",

                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (compatible; ObsedianSpaceBot/1.0)"
                    }
                }
            );

        return {

            ok:
                response.ok,

            status:
                response.status,

            text:
                await response.text()

        };

    } catch {

        return {

            ok: false,

            status: 0,

            text: ""

        };
    }
}


/* =========================================================
   PAGE ANALYSIS
========================================================= */

function analyzePage(
    url: string,
    html: string,
    responseTimeMs: number
) {

    const title =
        extractTag(
            html,
            "title"
        );

    const description =
        extractMeta(
            html,
            "description"
        );

    const canonical =
        extractCanonical(
            html
        );

    const h1Count =
        countMatches(
            html,
            /<h1\b[^>]*>/gi
        );

    const h2Count =
        countMatches(
            html,
            /<h2\b[^>]*>/gi
        );

    const h3Count =
        countMatches(
            html,
            /<h3\b[^>]*>/gi
        );

    const images =
        extractImages(
            html
        );

    const imagesWithoutAlt =
        images.filter(
            image =>
                !image.alt ||
                !image.alt.trim()
        ).length;

    const links =
        extractLinks(
            html,
            url
        );

    const text =
        getText(
            html
        );

    const wordCount =
        text
            ? text.split(/\s+/).length
            : 0;

    const viewport =
        /<meta[^>]+name=["']viewport["']/i
            .test(html);

    const charset =
        /<meta[^>]+charset=/i
            .test(html);

    const noindex =
        /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i
            .test(html) ||

        /<meta[^>]+content=["'][^"']*noindex[^"']*["'][^>]+name=["']robots["']/i
            .test(html);

    const structuredData =
        countMatches(
            html,
            /<script[^>]+type=["']application\/ld\+json["']/gi
        );

    const https =
        url.startsWith(
            "https://"
        );

    return {

        title: {
            value:
                title,

            exists:
                !!title,

            length:
                title?.length || 0
        },

        meta_description: {

            value:
                description,

            exists:
                !!description,

            length:
                description?.length || 0
        },

        canonical: {

            value:
                canonical,

            exists:
                !!canonical
        },

        headings: {

            h1:
                h1Count,

            h2:
                h2Count,

            h3:
                h3Count
        },

        images: {

            total:
                images.length,

            missing_alt:
                imagesWithoutAlt
        },

        links: {

            total:
                links.length
        },

        content: {

            word_count:
                wordCount
        },

        technical: {

            https,

            viewport,

            charset,

            noindex,

            structured_data_blocks:
                structuredData,

            response_time_ms:
                responseTimeMs
        }

    };
}


/* =========================================================
   CRAWLER
========================================================= */

async function crawlWebsite(
    websiteUrl: string
) {

    const root =
        new URL(
            websiteUrl
        );

    const homepage =
        await fetchPage(
            root.toString()
        );

    const analysis =
        homepage.ok
            ? analyzePage(
                homepage.finalUrl,
                homepage.html,
                homepage.responseTimeMs
            )
            : null;


    const robots =
        await fetchTextFile(
            new URL(
                "/robots.txt",
                root.origin
            ).toString()
        );


    const sitemap =
        await fetchTextFile(
            new URL(
                "/sitemap.xml",
                root.origin
            ).toString()
        );


    let internalLinks: string[] = [];


    if (homepage.ok) {

        internalLinks =
            extractLinks(
                homepage.html,
                homepage.finalUrl
            )
            .filter(link => {

                try {

                    return (
                        new URL(
                            link
                        ).hostname ===
                        root.hostname
                    );

                } catch {

                    return false;
                }

            })
            .slice(
                0,
                10
            );
    }


    return {

        website: {

            requested_url:
                websiteUrl,

            final_url:
                homepage.finalUrl,

            hostname:
                root.hostname

        },

        homepage: {

            fetched:
                homepage.ok,

            status:
                homepage.status,

            content_type:
                homepage.contentType,

            response_time_ms:
                homepage.responseTimeMs,

            error:
                homepage.error ||
                null,

            analysis

        },

        robots: {

            exists:
                robots.ok,

            status:
                robots.status,

            content:
                robots.text.slice(
                    0,
                    10000
                )

        },

        sitemap: {

            exists:
                sitemap.ok,

            status:
                sitemap.status,

            content:
                sitemap.text.slice(
                    0,
                    10000
                )

        },

        internal_links:
            internalLinks

    };
}


/* =========================================================
   GEMINI — INTERACTIONS API
========================================================= */

async function gemini(
    prompt: string
) {

    const apiKey =
        Deno.env.get(
            "GEMINI_API_KEY"
        );

    if (!apiKey) {
        throw new Error(
            "GEMINI_API_KEY is not configured."
        );
    }

    const model =
        "gemini-3.6-flash";

    const endpoint =
        "https://generativelanguage.googleapis.com/v1beta/interactions";

    const response =
        await fetch(
            endpoint,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",
                    "x-goog-api-key":
                        apiKey
                },

                body:
                    JSON.stringify({
                        model,
                        input: prompt
                    })
            }
        );

    const raw =
        await response.text();

    let data: any = null;

    try {
        data =
            raw
                ? JSON.parse(raw)
                : null;
    } catch {
        data = null;
    }

    if (!response.ok) {
        throw new Error(
            data?.error?.message ||
            data?.message ||
            `Gemini Interactions request failed with HTTP ${response.status}`
        );
    }

    if (
        data?.status &&
        data.status !== "completed"
    ) {
        throw new Error(
            `Gemini interaction status: ${data.status}`
        );
    }

    return data;
}


/* =========================================================
   GEMINI TEXT
========================================================= */

function extractGeminiText(
    result: any
): string {

    /* Current Interactions API convenience/raw response */
    if (
        typeof result?.output_text ===
        "string"
    ) {
        return result.output_text;
    }

    if (
        Array.isArray(
            result?.outputs
        )
    ) {

        const outputParts =
            result.outputs
                .map(
                    (item: any) =>
                        typeof item?.text === "string"
                            ? item.text
                            : ""
                )
                .filter(
                    (value: string) =>
                        value.length > 0
                );

        if (outputParts.length) {
            return outputParts.join("\n");
        }
    }

    /* Raw Interaction timeline response */
    if (
        Array.isArray(
            result?.steps
        )
    ) {

        const parts: string[] = [];

        for (
            const step
            of result.steps
        ) {

            if (
                Array.isArray(
                    step?.content
                )
            ) {

                for (
                    const content
                    of step.content
                ) {

                    if (
                        typeof content?.text ===
                        "string"
                    ) {

                        parts.push(
                            content.text
                        );
                    }
                }
            }
        }

        if (parts.length) {
            return parts.join("\n");
        }
    }

    return JSON.stringify(
        result
    );
}


/* =========================================================
   MAIN
========================================================= */

Deno.serve(
    async req => {

        /* CORS */

        if (
            req.method ===
            "OPTIONS"
        ) {
            return new Response(
                "ok",
                {
                    headers: cors
                }
            );
        }

        /* AUTH */

        const user =
            await userFrom(
                req
            );

        if (!user) {
            return json(
                {
                    error:
                        "Unauthorized"
                },
                401
            );
        }
        /* =========================================================
           AUTHENTICATED SUPABASE CLIENT
        ========================================================= */

        const sb =
            userClient(req);

        if (!sb) {

            return json(
                {
                    error:
                        "Unauthorized"
                },
                401
            );
        }

        /* REQUEST */

        let body: any;


        try {

            body =
                await req.json();

        } catch {

            return json(
                {
                    error:
                        "Invalid JSON request."
                },
                400
            );
        }


        const provider =
            body.provider ||
            "gemini";

        const agent =
            body.agent ||
            "seo_auditor";


        /* SUBSCRIPTION */

        const {
            data:
                entitlement,

            error:
                entitlementError

        } =
            await sb.rpc(
                "current_entitlement"
            );


        if (entitlementError) {

            console.error(
                entitlementError
            );

            return json(
                {
                    error:
                        "Could not verify subscription.",

                    details:
                        entitlementError.message

                },
                500
            );
        }


        const ent =
            entitlement?.[0];


        if (
            !ent ||

            ![
                "trial",
                "active"
            ].includes(
                ent.status
            ) ||

            (
                ent.ends_at &&
                new Date(
                    ent.ends_at
                ) <= new Date()
            )
        ) {

            return json(
                {
                    error:
                        "subscription_paused"
                },
                402
            );
        }


        /* WEBSITE */

        let websiteUrl =
            body.context?.url ||
            body.url;


        if (!websiteUrl) {

            return json(
                {
                    error:
                        "Website URL is required."
                },
                400
            );
        }


        try {

            websiteUrl =
                cleanUrl(
                    websiteUrl
                );

        } catch {

            return json(
                {
                    error:
                        "Invalid website URL."
                },
                400
            );
        }


        /* CRAWL */

        console.log(
            "Starting crawl:",
            websiteUrl
        );


        const started =
            Date.now();


        let crawl;


        try {

            crawl =
                await crawlWebsite(
                    websiteUrl
                );

        } catch (error) {

            console.error(
                error
            );

            return json(
                {
                    error:
                        "Website crawl failed.",

                    details:
                        error instanceof Error
                            ? error.message
                            : String(error)

                },
                502
            );
        }


        /* =================================================
           SAVE CRAWL PAGE
        ================================================= */

        const page =
            crawl.homepage;


        const pageAnalysis =
            page.analysis;


        if (
            page.fetched &&
            pageAnalysis
        ) {

            const {
                error:
                    crawlInsertError
            } =
                await sb
                    .from(
                        "crawl_pages"
                    )
                    .insert({

                        website_id:
                            body.website_id,

                        url:
                            crawl.website.final_url,

                        status_code:
                            page.status,

                        title:
                            pageAnalysis
                                .title
                                ?.value ||
                            null,

                        meta_description:
                            pageAnalysis
                                .meta_description
                                ?.value ||
                            null,

                        canonical_url:
                            pageAnalysis
                                .canonical
                                ?.value ||
                            null,

                        word_count:
                            pageAnalysis
                                .content
                                ?.word_count ||
                            0,

                        h1_count:
                            pageAnalysis
                                .headings
                                ?.h1 ||
                            0,

                        image_count:
                            pageAnalysis
                                .images
                                ?.total ||
                            0,

                        internal_link_count:
                            pageAnalysis
                                .links
                                ?.total ||
                            0,

                        load_ms:
                            page.response_time_ms,

                        noindex:
                            pageAnalysis
                                .technical
                                ?.noindex ||
                            false,

                        raw_signals: {

                            h2_count:
                                pageAnalysis
                                    .headings
                                    ?.h2 ||
                                0,

                            h3_count:
                                pageAnalysis
                                    .headings
                                    ?.h3 ||
                                0,

                            missing_alt:
                                pageAnalysis
                                    .images
                                    ?.missing_alt ||
                                0,

                            https:
                                pageAnalysis
                                    .technical
                                    ?.https ||
                                false,

                            viewport:
                                pageAnalysis
                                    .technical
                                    ?.viewport ||
                                false,

                            charset:
                                pageAnalysis
                                    .technical
                                    ?.charset ||
                                false,

                            structured_data_blocks:
                                pageAnalysis
                                    .technical
                                    ?.structured_data_blocks ||
                                0,

                            robots_exists:
                                crawl.robots
                                    .exists,

                            sitemap_exists:
                                crawl.sitemap
                                    .exists
                        },

                        crawled_at:
                            new Date()
                                .toISOString()

                    });


            if (crawlInsertError) {

                console.error(
                    "crawl_pages insert error:",
                    crawlInsertError
                );
            }
        }


        /* =================================================
           AI PROMPT
        ================================================= */

        const task =
            body.task ||
            "Perform a technical SEO audit.";


        const prompt = `

You are an Obsedian.Space SEO auditor.

Analyze ONLY the evidence provided below.

Never invent:
- traffic
- rankings
- conversions
- backlinks
- Google Search Console data
- Google Analytics data
- Core Web Vitals
- indexed pages

If information is unavailable, explicitly say:
"Not available from this crawl."

Return VALID JSON ONLY.

Use this structure:

{
  "summary": {
    "overall_observations": [],
    "critical_issues": [],
    "warnings": [],
    "positive_signals": []
  },

  "technical_seo": [
    {
      "issue": "",
      "severity": "critical|high|medium|low|info",
      "evidence": "",
      "recommendation": ""
    }
  ],

  "on_page_seo": [
    {
      "issue": "",
      "severity": "critical|high|medium|low|info",
      "evidence": "",
      "recommendation": ""
    }
  ],

  "content": [
    {
      "issue": "",
      "severity": "critical|high|medium|low|info",
      "evidence": "",
      "recommendation": ""
    }
  ],

  "prioritized_actions": [
    {
      "priority": 1,
      "action": "",
      "reason": ""
    }
  ]
}

Task:

${task}

Website evidence:

${JSON.stringify(
    crawl,
    null,
    2
)}

`;


        /* =================================================
           OPENAI
        ================================================= */

        let aiResult: any;


        try {

            if (
                provider !==
                "gemini"
            ) {

                return json(
                    {
                        error:
                            "Only Gemini is currently enabled."
                    },
                    400
                );
            }


            aiResult =
                await gemini(
                    prompt
                );

        } catch (error) {

            console.error(
                "OpenAI error:",
                error
            );

            return json(
                {
                    error:
                        "AI provider request failed.",

                    details:
                        error instanceof Error
                            ? error.message
                            : String(error)

                },
                502
            );
        }


        /* =================================================
           EXTRACT RESULT
        ================================================= */

        const outputText =
            extractGeminiText(
                aiResult
            );


        const auditJson =
            normalizeAuditShape(
                normalizeAuditJson(
                    outputText
                )
            );


        /* =================================================
           CALCULATE SCORE
        ================================================= */

        let score = 100;


        const criticalCount =
            (
                auditJson
                    ?.summary
                    ?.critical_issues ||
                []
            ).length;


        const warningCount =
            (
                auditJson
                    ?.summary
                    ?.warnings ||
                []
            ).length;


        const highCount =
            [
                ...(Array.isArray(
                    auditJson
                        ?.technical_seo
                )
                    ? auditJson
                        .technical_seo
                    : []),

                ...(Array.isArray(
                    auditJson
                        ?.on_page_seo
                )
                    ? auditJson
                        .on_page_seo
                    : []),

                ...(Array.isArray(
                    auditJson
                        ?.content
                )
                    ? auditJson
                        .content
                    : [])
            ]
                .filter(
                    (item: any) =>
                        item?.severity ===
                        "high"
                ).length;


        score -=
            criticalCount *
            15;


        score -=
            warningCount *
            5;


        // High-severity issues that were not
        // duplicated in summary.critical_issues
        // still affect the audit score.
        score -=
            highCount *
            5;


        score =
            Math.max(
                0,
                Math.min(
                    100,
                    score
                )
            );


        /* =================================================
           SAVE AUDIT
        ================================================= */

       const auditId = crypto.randomUUID();

const { error: auditError } =
    await sb
        .from("audits")
        .insert({
            id: auditId,

            website_id:
                body.website_id,

            user_id:
                user.id,

            score,

            technical:
                auditJson.technical_seo || [],

            seo:
                auditJson.on_page_seo || [],

            content:
                auditJson.content || [],

            performance: {
                response_time_ms:
                    page.response_time_ms,

                https:
                    pageAnalysis
                        ?.technical
                        ?.https || false
            },

            research: {},

            evidence: {
                crawl,

                source:
                    "website_crawler",

                generated_at:
                    new Date().toISOString()
            }
        });

if (auditError) {
    console.error(
        "audits insert error:",
        auditError
    );

    return json(
        {
            error:
                "Audit could not be saved.",

            details:
                auditError.message
        },
        500
    );
}

                   

        /* =================================================
           SAVE RECOMMENDATIONS
        ================================================= */

        const recommendations =
            Array.isArray(
                auditJson
                    ?.prioritized_actions
            )
                ? auditJson
                    .prioritized_actions
                : [];


        for (
            const item
            of recommendations
        ) {

            const title =
                item.action ||
                "SEO improvement";


            const description =
                item.reason ||
                "";


            const priorityNumber =
                Number(
                    item.priority ||
                    5
                );


            let priority =
                "medium";


            if (
                priorityNumber <= 1
            ) {

                priority =
                    "critical";

            } else if (
                priorityNumber <= 2
            ) {

                priority =
                    "high";

            } else if (
                priorityNumber <= 4
            ) {

                priority =
                    "medium";

            } else {

                priority =
                    "low";
            }


            const {
                error:
                    recommendationError
            } =
                await sb
                    .from(
                        "recommendations"
                    )
                    .insert({

                        website_id:
                            body.website_id,

                        user_id:
                            user.id,

                        category:
                            "SEO",

                        title,

                        description,

                        priority,

                        impact:
                            priority ===
                            "critical"
                                ? "high"
                                : priority ===
                                  "high"
                                    ? "high"
                                    : "medium",

                        effort:
                            "medium",

                        evidence:
                            {

                                crawl_url:
                                    websiteUrl,

                                reason:
                                    description

                            },

                        status:
                            "open"

                    });


            if (
                recommendationError
            ) {

                console.error(
                    "recommendation insert error:",
                    recommendationError
                );
            }
        }


        /* =================================================
           SAVE AI RUN
        ================================================= */

        const latency =
            Date.now() -
            started;


        const {
            error:
                aiRunError
        } =
            await sb
                .from(
                    "ai_runs"
                )
                .insert({

                    user_id:
                        user.id,

                    website_id:
                        body.website_id ||
                        null,

                    agent,

                    provider,

                    model:
                        "gemini-3.6-flash",

                    status:
                        "completed",

                    input_tokens:
                        aiResult
                            ?.usage
                            ?.input_tokens ||
                        0,

                    output_tokens:
                        aiResult
                            ?.usage
                            ?.output_tokens ||
                        0,

                    estimated_cost:
                        0,

                    latency_ms:
                        latency,

                    result:
                        aiResult

                });


        if (aiRunError) {

            console.error(
                "ai_runs insert error:",
                aiRunError
            );
        }


        /* =================================================
           USAGE EVENT
        ================================================= */

        const {
            error:
                usageError
        } =
            await sb
                .from(
                    "usage_events"
                )
                .insert({

                    user_id:
                        user.id,

                    event_type:
                        "ai_run",

                    provider,

                    units:
                        1,

                    metadata: {

                        agent,

                        website_id:
                            body.website_id ||
                            null,

                        audit_id:
                            auditRecord
                                ?.id ||
                            null

                    }

                });


        if (usageError) {

            console.error(
                "usage_events insert error:",
                usageError
            );
        }


        /* =================================================
           FINAL RESPONSE
        ================================================= */

        return json({

            success:
                true,

            provider,

            agent,

            website:
                websiteUrl,

            audit_id:
                auditRecord
                    ?.id ||
                null,

            score,

            crawl: {

                homepage_status:
                    crawl.homepage
                        .status,

                response_time_ms:
                    crawl.homepage
                        .response_time_ms,

                title:
                    pageAnalysis
                        ?.title
                        ?.value ||
                    null,

                meta_description:
                    pageAnalysis
                        ?.meta_description
                        ?.value ||
                    null,

                h1_count:
                    pageAnalysis
                        ?.headings
                        ?.h1 ||
                    0,

                images_missing_alt:
                    pageAnalysis
                        ?.images
                        ?.missing_alt ||
                    0,

                robots_exists:
                    crawl.robots
                        .exists,

                sitemap_exists:
                    crawl.sitemap
                        .exists

            },

            audit:
                auditJson,

            raw_ai_result:
                aiResult

        });

    }
);
