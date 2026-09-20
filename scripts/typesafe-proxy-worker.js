/**
 * TypeSafe JEV CORS Proxy - Cloudflare Worker
 *
 * A lightweight, transparent reverse proxy to enable browser access to TypeSafe JEV System One.
 *
 * ==============================================================================
 * PRIVACY & ZERO DATA COLLECTION GUARANTEES:
 * 1. NO PERSISTENT STORAGE:
 *    This worker uses NO KV namespaces, NO D1 databases, NO R2 buckets,
 *    NO Durable Objects, and NO cache storage bindings. Nothing is saved to disk.
 *
 * 2. NO LOGGING OR TELEMETRY:
 *    This worker does NOT log request contents, headers, tokens, or responses.
 *    No console.log, no telemetry, no tracking pixels, no analytics.
 *
 * 3. NO TOKEN RETENTION OR INSPECTION:
 *    The Authorization header (TypeSafe API key) is forwarded directly to
 *    TypeSafe's official endpoint in-flight and is never inspected, copied, or stored.
 *
 * 4. STATELESS IN-MEMORY STREAMING:
 *    Requests and responses pass through memory strictly for the duration of the
 *    HTTP transaction and are immediately discarded by the V8 isolate.
 * ==============================================================================
 *
 * Official Target: https://api.typesafe.ai/v1/systemone
 */

const TARGET_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

// Allowed origins: strictly the GitHub Pages deployment and local development
const ALLOWED_ORIGINS = [
  "https://erseco.github.io",
];

function isOriginAllowed(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow local development (e.g. http://localhost:8000 or http://127.0.0.1:8000)
  if (/^http:\/\/localhost(:\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
    return true;
  }
  return false;
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, X-Typesafe-Organization-ID",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");

    // Handle preflight OPTIONS request
    if (request.method === "OPTIONS") {
      if (!isOriginAllowed(origin)) {
        return new Response(
          JSON.stringify({ error: "Disallowed CORS origin. Only GitHub Pages (https://erseco.github.io) is permitted." }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    // Informational landing page for GET with explicit privacy guarantees
    if (request.method === "GET") {
      return new Response(
        JSON.stringify({
          service: "TypeSafe JEV CORS Proxy Worker",
          status: "ready",
          target: TARGET_ENDPOINT,
          allowed_origin: "https://erseco.github.io",
          privacy: {
            storage: "none",
            logging: "none",
            telemetry: "none",
            token_collection: "none",
            description: "Stateless pass-through proxy. No API keys, tokens, documents, questions, or responses are stored, logged, or collected."
          },
          usage: "Send POST requests with Authorization: Bearer <key> and Content-Type: application/json."
        }, null, 2),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...(origin && isOriginAllowed(origin) ? corsHeaders(origin) : {})
          }
        }
      );
    }

    // Check origin for POST requests
    if (!isOriginAllowed(origin)) {
      return new Response(
        JSON.stringify({ error: "Disallowed origin. Only https://erseco.github.io and local development are permitted." }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" }
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
      // Forward request headers directly without logging or storing
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

      // Read request body in-memory and forward directly
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
