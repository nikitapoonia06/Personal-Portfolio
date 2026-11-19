/**
 * Cloudflare Worker: Web3Forms contact proxy.
 *
 * Required Worker secret:
 *   WEB3FORMS_ACCESS_KEY = a newly rotated Web3Forms access key
 *
 * Required Worker variable (comma-separated allowed origins):
 *   ALLOWED_ORIGINS = https://YOUR-GITHUB-USERNAME.github.io,http://127.0.0.1:5500,http://localhost:5500
 * You can also use the older ALLOWED_ORIGIN variable for one origin.
 *
 * Route:
 *   POST /api/contact
 */
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...JSON_HEADERS,
      "Access-Control-Allow-Origin": origin,
      "Vary": "Origin"
    }
  });
}

function validEmail(value) {
  return typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export default {
  async fetch(request, env) {
    const allowedOrigins = (env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || "")
      .split(",").map(value => value.trim()).filter(Boolean);
    const requestOrigin = request.headers.get("Origin") || "";
    const originAllowed = allowedOrigins.includes(requestOrigin);
    const responseOrigin = originAllowed ? requestOrigin : "null";

    if (request.method === "OPTIONS") {
      if (!originAllowed) return new Response(null, { status: 403, headers: { "Vary": "Origin" } });
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": responseOrigin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin"
        }
      });
    }

    if (!originAllowed) {
      return json({ success: false, message: "Request origin is not allowed." }, 403, responseOrigin);
    }

    const url = new URL(request.url);
    if (url.pathname !== "/api/contact" || request.method !== "POST") {
      return json({ success: false, message: "Not found." }, 404, responseOrigin);
    }

    if (!env.WEB3FORMS_ACCESS_KEY) {
      return json({ success: false, message: "Contact service is not configured." }, 503, responseOrigin);
    }

    const contentType = request.headers.get("Content-Type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return json({ success: false, message: "Unsupported request format." }, 415, responseOrigin);
    }

    const declaredLength = Number(request.headers.get("Content-Length") || 0);
    if (declaredLength > 12000) {
      return json({ success: false, message: "Message is too large." }, 413, responseOrigin);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ success: false, message: "Invalid request." }, 400, responseOrigin);
    }

    // Honeypot: silently accept bots without forwarding.
    if (typeof data.website === "string" && data.website.trim() !== "") {
      return json({ success: true }, 200, responseOrigin);
    }

    const name = typeof data.name === "string" ? data.name.trim() : "";
    const email = typeof data.email === "string" ? data.email.trim() : "";
    const reason = typeof data.reason === "string" ? data.reason.trim() : "";
    const message = typeof data.message === "string" ? data.message.trim() : "";

    const allowedReasons = new Set([
      "Internship / opportunity",
      "Creative collaboration",
      "Project / idea",
      "Just saying hello",
      "Something else"
    ]);

    if (name.length < 2 || name.length > 80 || /[<>]/.test(name) ||
        !validEmail(email) || !allowedReasons.has(reason) ||
        message.length < 10 || message.length > 5000) {
      return json({ success: false, message: "Please check the form fields and try again." }, 400, responseOrigin);
    }

    // The key is injected only here, on the server side. Never return it to the browser.
    const payload = {
      access_key: env.WEB3FORMS_ACCESS_KEY,
      name,
      email,
      subject: `Portfolio contact: ${reason}`,
      message: `Reason: ${reason}\n\n${message}`,
      from_name: "Nikita Poonia Portfolio"
    };

    try {
      const upstream = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await upstream.json().catch(() => ({}));
      if (!upstream.ok || result.success !== true) {
        return json({ success: false, message: "Delivery failed. Please try again later." }, 502, responseOrigin);
      }
      return json({ success: true, message: "Message sent!" }, 200, responseOrigin);
    } catch {
      return json({ success: false, message: "Contact service is temporarily unavailable." }, 502, responseOrigin);
    }
  }
};
