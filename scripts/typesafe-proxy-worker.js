/**
 * TypeSafe JEV CORS Proxy - Cloudflare Worker
 *
 * A lightweight, transparent reverse proxy to enable browser access to TypeSafe JEV System One.
 * Deploy this on your own Cloudflare Workers account.
 *
 * Official Target: https://api.typesafe.ai/v1/systemone
 */

const TARGET_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, X-Typesafe-Organization-ID",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "*";

    // Handle preflight OPTIONS request
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    // Informational landing page for GET
    if (request.method === "GET") {
      return new Response(
        JSON.stringify({
          service: "TypeSafe JEV CORS Proxy Worker",
          status: "ready",
          target: TARGET_ENDPOINT,
          usage: "Send POST requests with Authorization: Bearer <key> and Content-Type: application/json."
        }, null, 2),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders(origin)
          }
        }
      );
    }

    // Only POST is forwarded to TypeSafe System One
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: `Method ${request.method} not allowed. Only POST and OPTIONS are supported.` }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders(origin)
          }
        }
      );
    }

    try {
      // Forward request headers
      const forwardHeaders = new Headers();
      const authHeader = request.headers.get("Authorization");
      if (authHeader) {
        forwardHeaders.set("Authorization", authHeader);
      }
      forwardHeaders.set("Content-Type", "application/json");

      const orgHeader = request.headers.get("X-Typesafe-Organization-ID");
      if (orgHeader) {
        forwardHeaders.set("X-Typesafe-Organization-ID", orgHeader);
      }

      // Read JSON body
      const body = await request.text();

      // Forward to official TypeSafe System One endpoint
      const apiResponse = await fetch(TARGET_ENDPOINT, {
        method: "POST",
        headers: forwardHeaders,
        body: body,
      });

      // Prepare response headers with CORS
      const responseHeaders = new Headers(apiResponse.headers);
      const cors = corsHeaders(origin);
      for (const [key, value] of Object.entries(cors)) {
        responseHeaders.set(key, value);
      }

      return new Response(apiResponse.body, {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Proxy forwarding error", details: err.message }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders(origin)
          }
        }
      );
    }
  },
};
