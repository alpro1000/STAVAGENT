/**
 * Vercel Edge Middleware — runs BEFORE filesystem and rewrites.
 *
 * Routes klasifikator.stavagent.cz → URS Matcher Cloud Run service.
 * Without this, Vercel serves Portal's dist/index.html for the root path
 * because filesystem check happens before rewrites in vercel.json.
 */

const URS_BACKEND = 'https://urs-matcher-service-1086027517695.europe-west3.run.app';

export const config = {
  matcher: '/:path*',
};

export default async function middleware(request) {
  const url = new URL(request.url);

  if (url.hostname === 'klasifikator.stavagent.cz') {
    const target = `${URS_BACKEND}${url.pathname}${url.search}`;
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

    // POSTs through this proxy used to die with MIDDLEWARE_INVOCATION_FAILED
    // ("TypeError: fetch failed"): forwarding request.headers verbatim sends
    // connection-specific headers (host, content-length, connection) that
    // conflict with the outbound fetch, and streaming request.body needs
    // duplex support. Buffer the body (URS payloads are JSON/small files)
    // and strip the per-connection headers instead.
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('content-length');
    headers.delete('connection');
    headers.delete('transfer-encoding');

    const body = hasBody ? await request.arrayBuffer() : undefined;

    return fetch(target, {
      method: request.method,
      headers,
      body,
    });
  }
}
