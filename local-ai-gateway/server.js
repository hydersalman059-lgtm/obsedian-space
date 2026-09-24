const express = require("express");
const http = require("http");

const app = express();

const HOST = "127.0.0.1";
const PORT = 8787;

const OLLAMA_HOST = "127.0.0.1";
const OLLAMA_PORT = 11434;

const DEFAULT_MODEL = "qwen3:1.7b";

app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
    );

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

/* =========================================================
   OLLAMA HTTP CLIENT
========================================================= */

function callOllama(prompt, model = DEFAULT_MODEL) {

    return new Promise((resolve, reject) => {

        const body = JSON.stringify({
            model,
            prompt,
            stream: false,
           options: {
    temperature: 0.1,
    num_predict: 180,
    think: false
}
        });

        const started = Date.now();

        const request = http.request(
            {
                hostname: OLLAMA_HOST,
                port: OLLAMA_PORT,
                path: "/api/generate",
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    "Content-Length":
                        Buffer.byteLength(body)
                },

                timeout: 120000
            },

            response => {

                let raw = "";

                response.setEncoding("utf8");

                response.on(
                    "data",
                    chunk => {
                        raw += chunk;
                    }
                );

                response.on(
                    "end",
                    () => {

                        const duration =
                            Date.now() - started;

                        if (
                            response.statusCode < 200 ||
                            response.statusCode >= 300
                        ) {
                            return reject(
                                new Error(
                                    `Ollama HTTP ${response.statusCode}: ${raw}`
                                )
                            );
                        }

                        let data;

                        try {
                            data =
                                JSON.parse(raw);
                        } catch {
                            return reject(
                                new Error(
                                    "Invalid JSON received from Ollama."
                                )
                            );
                        }

                        resolve({
                            response:
                                data.response || "",

                            total_duration:
                                data.total_duration || 0,

                            eval_count:
                                data.eval_count || 0,

                            eval_duration:
                                data.eval_duration || 0,

                            gateway_duration:
                                duration
                        });
                    }
                );
            }
        );

        request.on(
            "timeout",
            () => {
                request.destroy();

                reject(
                    new Error(
                        "Ollama request timed out after 120 seconds."
                    )
                );
            }
        );

        request.on(
            "error",
            error => {
                reject(error);
            }
        );

        request.write(body);

        request.end();
    });
}

/* =========================================================
   URL
========================================================= */

function cleanUrl(value) {

    let url =
        String(value || "").trim();

    if (!url) {
        throw new Error(
            "Website URL is required."
        );
    }

    if (!/^https?:\/\//i.test(url)) {
        url =
            "https://" + url;
    }

    return new URL(url).toString();
}

/* =========================================================
   SEO HELPERS
========================================================= */

function extractTitle(html) {

    const match =
        html.match(
            /<title[^>]*>([\s\S]*?)<\/title>/i
        );

    return match
        ? match[1]
            .replace(/\s+/g, " ")
            .trim()
        : null;
}

function extractMetaDescription(html) {

    const match =
        html.match(
            /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i
        );

    return match
        ? match[1].trim()
        : null;
}

function extractCanonical(html) {

    const match =
        html.match(
            /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i
        );

    return match
        ? match[1].trim()
        : null;
}

function countTag(html, tag) {

    const regex =
        new RegExp(
            `<${tag}\\b`,
            "gi"
        );

    return (
        html.match(regex) || []
    ).length;
}

function extractImages(html) {

    const images =
        html.match(
            /<img\b[^>]*>/gi
        ) || [];

    let missingAlt = 0;

    for (const image of images) {

        const alt =
            image.match(
                /\balt\s*=\s*["']([^"']*)["']/i
            );

        if (
            !alt ||
            !alt[1].trim()
        ) {
            missingAlt++;
        }
    }

    return {
        total: images.length,
        missing_alt: missingAlt
    };
}

function extractLinks(
    html,
    baseUrl
) {

    const links =
        html.match(
            /<a\b[^>]+href\s*=\s*["'][^"']+["'][^>]*>/gi
        ) || [];

    const base =
        new URL(baseUrl);

    let total = 0;
    let internal = 0;
    let external = 0;

    for (const link of links) {

        const match =
            link.match(
                /href\s*=\s*["']([^"']+)["']/i
            );

        if (!match) {
            continue;
        }

        const href =
            match[1].trim();

        if (
            !href ||
            href.startsWith("#") ||
            href.startsWith("javascript:") ||
            href.startsWith("mailto:") ||
            href.startsWith("tel:")
        ) {
            continue;
        }

        try {

            const absolute =
                new URL(
                    href,
                    base.href
                );

            total++;

            if (
                absolute.hostname ===
                base.hostname
            ) {
                internal++;
            } else {
                external++;
            }

        } catch {
            // Ignore invalid links.
        }
    }

    return {
        total,
        internal,
        external
    };
}

function extractWordCount(html) {

    const text =
        html
            .replace(
                /<script[\s\S]*?<\/script>/gi,
                " "
            )
            .replace(
                /<style[\s\S]*?<\/style>/gi,
                " "
            )
            .replace(
                /<[^>]+>/g,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();

    return text
        ? text.split(" ").length
        : 0;
}

/* =========================================================
   CRAWLER
========================================================= */

async function crawlWebsite(url) {

    const started =
        Date.now();

    const response =
        await fetch(
            url,
            {
                redirect: "follow",
                headers: {
                    "User-Agent":
                        "ObsedianSEO/1.0"
                }
            }
        );

    const html =
        await response.text();

    const responseTime =
        Date.now() - started;

    const finalUrl =
        response.url || url;

    let robotsExists = false;

    try {

        const robots =
            await fetch(
                new URL(
                    "/robots.txt",
                    finalUrl
                )
            );

        robotsExists =
            robots.ok;

    } catch {}

    let sitemapExists = false;

    try {

        const sitemap =
            await fetch(
                new URL(
                    "/sitemap.xml",
                    finalUrl
                )
            );

        sitemapExists =
            sitemap.ok;

    } catch {}

    const images =
        extractImages(html);

    const links =
        extractLinks(
            html,
            finalUrl
        );

    return {

        homepage_status:
            response.status,

        response_time_ms:
            responseTime,

        title:
            extractTitle(html),

        meta_description:
            extractMetaDescription(html),

        canonical:
            extractCanonical(html),

        h1_count:
            countTag(html, "h1"),

        h2_count:
            countTag(html, "h2"),

        h3_count:
            countTag(html, "h3"),

        images_total:
            images.total,

        images_missing_alt:
            images.missing_alt,

        internal_links:
            links.internal,

        external_links:
            links.external,

        word_count:
            extractWordCount(html),

        https:
            finalUrl.startsWith(
                "https://"
            ),

        viewport:
            /<meta[^>]+name=["']viewport["']/i.test(
                html
            ),

        robots_exists:
            robotsExists,

        sitemap_exists:
            sitemapExists,

        json_ld_count:
            (
                html.match(
                    /application\/ld\+json/gi
                ) || []
            ).length
    };
}

/* =========================================================
   RULE ENGINE
========================================================= */

function analyze(crawl) {

    let score = 100;

    const findings = [];

    const positives = [];

    if (!crawl.title) {

        score -= 15;

        findings.push({
            issue:
                "Missing title tag",
            severity:
                "critical",
            recommendation:
                "Add a unique descriptive title tag."
        });

    } else {

        positives.push(
            "Title tag detected."
        );
    }

    if (!crawl.meta_description) {

        score -= 10;

        findings.push({
            issue:
                "Missing meta description",
            severity:
                "high",
            recommendation:
                "Add a unique meta description."
        });

    } else {

        positives.push(
            "Meta description detected."
        );
    }

    if (!crawl.canonical) {

        score -= 5;

        findings.push({
            issue:
                "Missing canonical tag",
            severity:
                "medium",
            recommendation:
                "Add an appropriate canonical URL."
        });

    } else {

        positives.push(
            "Canonical tag detected."
        );
    }

    if (crawl.h1_count === 0) {

        score -= 10;

        findings.push({
            issue:
                "Missing H1 heading",
            severity:
                "high",
            recommendation:
                "Add a clear primary H1 heading."
        });

    } else {

        positives.push(
            "H1 heading detected."
        );
    }

    if (
        crawl.images_missing_alt > 0
    ) {

        score -= 10;

        findings.push({
            issue:
                "Images missing alt text",
            severity:
                "medium",
            recommendation:
                "Add meaningful alt text to images."
        });

    } else if (
        crawl.images_total > 0
    ) {

        positives.push(
            "Images have alt attributes."
        );
    }

    if (
        crawl.response_time_ms > 2000
    ) {

        score -= 10;

        findings.push({
            issue:
                "Slow server response",
            severity:
                "high",
            recommendation:
                "Optimize server performance and caching."
        });

    } else if (
        crawl.response_time_ms > 1000
    ) {

        score -= 5;

        findings.push({
            issue:
                "Response time could be improved",
            severity:
                "medium",
            recommendation:
                "Consider caching and server optimization."
        });
    }

    if (!crawl.robots_exists) {

        score -= 5;

        findings.push({
            issue:
                "robots.txt not found",
            severity:
                "medium",
            recommendation:
                "Create a valid robots.txt file."
        });
    }

    if (!crawl.sitemap_exists) {

        score -= 5;

        findings.push({
            issue:
                "sitemap.xml not found",
            severity:
                "medium",
            recommendation:
                "Create and submit an XML sitemap."
        });
    }

    if (!crawl.viewport) {

        score -= 3;

        findings.push({
            issue:
                "Viewport meta tag missing",
            severity:
                "low",
            recommendation:
                "Add a responsive viewport meta tag."
        });
    }

    if (
        crawl.json_ld_count === 0
    ) {

        findings.push({
            issue:
                "No JSON-LD structured data detected",
            severity:
                "low",
            recommendation:
                "Consider adding relevant Schema.org structured data."
        });
    }

    if (
        crawl.https
    ) {

        positives.push(
            "HTTPS enabled."
        );

    } else {

        score -= 15;

        findings.push({
            issue:
                "HTTPS not enabled",
            severity:
                "critical",
            recommendation:
                "Enable HTTPS."
        });
    }

    score =
        Math.max(
            0,
            Math.min(
                100,
                score
            )
        );

    return {
        score,
        findings,
        positives
    };
}

/* =========================================================
   AI PROMPT
========================================================= */

function createPrompt(crawl, analysis) {

    const findings = analysis.findings
        .slice(0, 5)
        .map(item => ({
            issue: item.issue,
            severity: item.severity
        }));

    const evidence = {
        title: crawl.title,
        meta_description: crawl.meta_description,
        canonical: crawl.canonical,
        h1: crawl.h1_count,
        h2: crawl.h2_count,
        h3: crawl.h3_count,
        images_missing_alt: crawl.images_missing_alt,
        response_time_ms: crawl.response_time_ms,
        robots_exists: crawl.robots_exists,
        sitemap_exists: crawl.sitemap_exists,
        json_ld_count: crawl.json_ld_count,
        https: crawl.https,
        findings
    };

    return `
You are an SEO recommendation assistant.

Use ONLY the supplied evidence.

Return ONLY valid JSON.

Use exactly this format:

{
  "recommendations": [
    "recommendation 1",
    "recommendation 2",
    "recommendation 3"
  ]
}

Rules:
- exactly 3 recommendations
- each recommendation must be short
- each recommendation must be one sentence
- do not explain reasoning
- do not include a score
- do not mention traffic
- do not mention rankings
- do not mention backlinks
- do not mention analytics
- do not invent information
- no markdown

Evidence:
${JSON.stringify(evidence)}
`;
}

/* =========================================================
   HEALTH
========================================================= */

app.get(
    "/health",
    (req, res) => {

        res.json({
            success: true,
            service:
                "obsedian-local-ai-gateway",
            model:
                DEFAULT_MODEL,
            ollama:
                `http://${OLLAMA_HOST}:${OLLAMA_PORT}`
        });
    }
);

/* =========================================================
   DIRECT AI TEST
========================================================= */

app.post(
    "/api/ai",
    async (req, res) => {

        try {

            const prompt =
                String(
                    req.body?.prompt || ""
                );

            const model =
                req.body?.model ||
                DEFAULT_MODEL;

            if (!prompt) {

                return res.status(
                    400
                ).json({
                    success: false,
                    error:
                        "Prompt is required."
                });
            }

            console.log(
                "AI request received."
            );

            const result =
                await callOllama(
                    prompt,
                    model
                );

            console.log(
                `AI completed in ${result.gateway_duration}ms`
            );

            res.json({
                success: true,
                provider:
                    "ollama",
                model,
                response:
                    result.response,
                total_duration:
                    result.total_duration,
                eval_count:
                    result.eval_count,
                gateway_duration:
                    result.gateway_duration
            });

        } catch (error) {

            console.error(
                "AI error:",
                error
            );

            res.status(
                500
            ).json({
                success: false,
                error:
                    error.message
            });
        }
    }
);

/* =========================================================
   SEO AUDIT
========================================================= */

app.post(
    "/api/seo-audit",
    async (req, res) => {

        const started =
            Date.now();

        try {

            const url =
                cleanUrl(
                    req.body?.url
                );

            const model =
                req.body?.model ||
                DEFAULT_MODEL;

            console.log("");
            console.log(
                "================================"
            );
            console.log(
                `SEO AUDIT: ${url}`
            );
            console.log(
                "================================"
            );

            console.log(
                "1. Crawling website..."
            );

            const crawl =
                await crawlWebsite(
                    url
                );

            console.log(
                `Crawl completed: ${crawl.response_time_ms}ms`
            );

            console.log(
                "2. Running rule analysis..."
            );

            const analysis =
                analyze(crawl);

            console.log(
                `Local score: ${analysis.score}`
            );

            console.log(
                "3. Sending small prompt to Ollama..."
            );

            const prompt =
                createPrompt(
                    crawl,
                    analysis
                );

            const ai =
                await callOllama(
                    prompt,
                    model
                );

            console.log(
                `AI completed: ${ai.gateway_duration}ms`
            );

            const aiResult =
                parseAI(
                    ai.response
                );

            const latency =
                Date.now() -
                started;

            console.log(
                `TOTAL AUDIT TIME: ${latency}ms`
            );

            res.json({

                success: true,

                provider:
                    "ollama",

                model,

                agent:
                    "seo_auditor",

                website:
                    url,

                score:
                    analysis.score,

                latency_ms:
                    latency,

                crawl,

                audit: {

                    summary: {

                        overall_observations:
                            aiResult.overall_observations ||
                            [],

                        critical_issues:
                            aiResult.critical_issues ||
                            [],

                        positive_signals:
                            aiResult.positive_signals ||
                            []
                    },

                    technical_seo:
                        analysis.findings,

                    ai_recommendations:
                        aiResult.recommendations ||
                        [],

                    prioritized_actions:
                        analysis.findings
                            .slice(0, 8)
                            .map(
                                (item, index) => ({
                                    priority:
                                        index < 2
                                            ? 1
                                            : index < 5
                                                ? 2
                                                : 3,

                                    action:
                                        item.recommendation,

                                    reason:
                                        item.issue
                                })
                            )
                },

                raw_ai_result: {

                    response:
                        ai.response,

                    total_duration:
                        ai.total_duration,

                    eval_count:
                        ai.eval_count,

                    eval_duration:
                        ai.eval_duration,

                    gateway_duration:
                        ai.gateway_duration
                }
            });

        } catch (error) {

            console.error(
                "SEO audit error:",
                error
            );

            res.status(
                500
            ).json({
                success: false,
                error:
                    error.message
            });
        }
    }
);

/* =========================================================
   START
========================================================= */

app.listen(
    PORT,
    HOST,
    () => {

        console.log("");
        console.log(
            "======================================"
        );
        console.log(
            "Obsedian Local AI Gateway"
        );
        console.log(
            "======================================"
        );
        console.log(
            `Gateway: http://${HOST}:${PORT}`
        );
        console.log(
            `Ollama:  http://${OLLAMA_HOST}:${OLLAMA_PORT}`
        );
        console.log(
            `Model:   ${DEFAULT_MODEL}`
        );
        console.log(
            "SEO audit endpoint: /api/seo-audit"
        );
        console.log(
            "======================================"
        );
        console.log("");
    }
);