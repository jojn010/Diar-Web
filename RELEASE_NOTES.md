# Diar Web 1.0.0 — A home for every story

A Spring Boot companion to Diar Android, sharing the same Supabase accounts, listings, photos and private account favorites. Includes English/Arabic and RTL, responsive cream/teal/sage styling, real property browsing and filters, shared cards/details, owner management, and the three-step listing composer with one integer price, negotiability, sale/rent, type/floors, map/current-location choices and photo uploads.

The exact `Listing` and `Favorite` classes come from the Android repository's pinned `shared` JVM module. Android v1.4.0 adds cloud favorites, offline favorite retries and 30-second foreground sync. Guest favorites and unpublished phone homes stay local. The new favorites migration has been applied with owner-only RLS and verified in a rolled-back transaction.

Authentication tokens stay in server-side sessions; writes require CSRF and the user's own Supabase access token. No service-role key, database password, backend replacement, fake ratings, payment processing or owner-verification claims are included.

Verification: 13 web tests, 6 shared JVM tests, Android build/7 unit tests/lint, isolated English/Arabic browser publishing/editing/favorites/photo/map flows, packaged-JAR HTTP checks and live public reads/RLS checks passed. The Dockerfile also built successfully; its non-root runtime passed health, configuration and live public listing checks under a 512 MB memory limit. Emulator instrumentation and a real signed-in cross-client round trip remain unavailable. See QA.md for the precise test boundaries.

Includes executable JAR, Gradle wrapper, CI and Dockerfile. A public Java hosting deployment has not been created. The app is a development preview; review deployment/session/email/moderation limits in README.md before public use.
