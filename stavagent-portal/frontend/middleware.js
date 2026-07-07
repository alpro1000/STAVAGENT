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
    const hasBody = !['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(request.method);

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

    // Cap buffered bodies (CWE-400) — Vercel's own request limits sit lower,
    // this is an explicit guard so the proxy never relies on them implicitly.
    const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10 MB
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (hasBody && contentLength > MAX_BODY_SIZE) {
      return new Response('Payload too large', { status: 413 });
    }

    const body = hasBody ? await request.arrayBuffer() : undefined;

    return fetch(target, {
      method: request.method,
      headers,
      body,
    });
  }
}
