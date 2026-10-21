import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Exclude:
  //   _next        — Next.js internal assets
  //   api          — API routes (handled by Route Handlers, not i18n middleware)
  //   favicon.ico  — static asset
  //   *.*          — any file with an extension (images, fonts, etc.)
  //   sentry-tunnel — Sentry event proxy route (must reach the Route Handler
  //                   directly; wrapping it in the i18n middleware causes 404s)
  matcher: ["/((?!sentry-tunnel|_next|api|favicon.ico|.*\\..*).*)"],
};
