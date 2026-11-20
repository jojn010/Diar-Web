# Diar Web 1.0.1 — Keep exploring

- Prices use English digits and whole-dollar grouping in both languages, for example `$73,500`. Arabic/Persian digits entered in the price field normalize to English digits.
- Gentle, one-time fade/lift reveals for below-the-fold sections and cards. Visible content stays visible; reduced-motion, keyboard focus and observer-unavailable fallbacks are included.
- Every available property page ends with a compact “More homes to explore” section: up to three other published homes, matching sale/rent and type first, with working favorite buttons and a browse-all link. The current home and duplicate records are excluded. Empty inventory is explained honestly.

Verification: web/shared tests and executable JAR build passed; price/recommendation regressions, 183 EN/AR translation keys, desktop/mobile RTL layouts, price entry, scroll reveals, keyboard focus and mini-card navigation checked with isolated fixtures. CI runs five JavaScript regression tests in addition to 13 web and 6 shared JVM tests. Actual OS reduced-motion switching was not exercised. No database changes or Android changes are included. See QA.md for precise boundaries.

Includes the updated executable JAR. This remains a development preview; production hosting is not provisioned.

---

# Diar Web 1.0.0 — A home for every story

A Spring Boot companion to Diar Android, sharing the same Supabase accounts, listings, photos and private account favorites. Includes English/Arabic and RTL, responsive cream/teal/sage styling, real property browsing and filters, shared cards/details, owner management, and the three-step listing composer with one integer price, negotiability, sale/rent, type/floors, map/current-location choices and photo uploads.

The exact `Listing` and `Favorite` classes come from the Android repository's pinned `shared` JVM module. Android v1.4.0 adds cloud favorites, offline favorite retries and 30-second foreground sync. Guest favorites and unpublished phone homes stay local. The new favorites migration has been applied with owner-only RLS and verified in a rolled-back transaction.

Authentication tokens stay in server-side sessions; writes require CSRF and the user's own Supabase access token. No service-role key, database password, backend replacement, fake ratings, payment processing or owner-verification claims are included.

Verification: 13 web tests, 6 shared JVM tests, Android build/7 unit tests/lint, isolated English/Arabic browser publishing/editing/favorites/photo/map flows, packaged-JAR HTTP checks and live public reads/RLS checks passed. The Dockerfile also built successfully; its non-root runtime passed health, configuration and live public listing checks under a 512 MB memory limit. Emulator instrumentation and a real signed-in cross-client round trip remain unavailable. See QA.md for the precise test boundaries.

Includes executable JAR, Gradle wrapper, CI and Dockerfile. A public Java hosting deployment has not been created. The app is a development preview; review deployment/session/email/moderation limits in README.md before public use.
