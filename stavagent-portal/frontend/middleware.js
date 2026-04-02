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
    return fetch(target, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    });
  }
}
