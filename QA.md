# Verification

## Version 1.0.1 — 21 November 2026

- `./tools/check_web.sh` passed: 13 web tests, 6 shared JVM tests and executable JAR build.
- Price/recommendation assertions passed locally: English digits and whole-dollar grouping, current-home/duplicate exclusion, same-purpose/type ordering, maximum three cards, no collection mutation and empty inventory. Five Node test cases also run in CI. JavaScript syntax and all 183 EN/AR translation keys checked.
- Isolated browser QA passed in English and Arabic/RTL: prices on cards/details; Arabic price entry `٧٣٥٠٠` becoming `73500`; navigation from a mini card to a different detail page with scroll reset; current-home exclusion; scroll reveals settling to visible; keyboard focus revealing a card. No live listings were changed.
- Desktop layout (1265px document width) and mobile layout (375px document width in a 390px viewport) inspected with no horizontal overflow. Mini cards form a three-column desktop row and a single mobile column. This supersedes the initial release’s desktop visual QA limitation below.
- HTTP checks returned 200 for the fixture listing deep link, four-home inventory, JavaScript module and scroll script; the `.mjs` module has a JavaScript content type.
- Reduced-motion CSS and live preference handling are implemented; an actual browser/OS preference toggle was not exercised. No fresh Android, live authenticated cross-client or container test was needed or performed for these website-only changes. Initial integration/deployment limits below still apply.

## Initial release 1.0.0 — 20–21 November 2026

## Executed

- Spring Boot: 13 automated controller/service/image tests, plus 6 tests of the actual shared domain module. Tests use local fake transports and do not create live accounts or listings.
- Android v1.4.0: debug build, 7 unit tests, 6 shared tests and lint passed. Built a configured APK again after the offline checks.
- Browser walkthrough in an isolated in-memory QA server: sign-in, three-step publishing, sale/rent, villa/house/floors, map click, coordinate fallback, photo decoding/resizing preview, rejecting a fractional price, Arabic-digit price, negotiability, safe rendering of HTML-like descriptions, favorites after reload, Arabic editing, changed area/price/pin, My listings and deletion confirmation. All fixture listing changes were confined to the QA server.
- Arabic/RTL, translated validation, EN/AR navigation and mobile layout were inspected. All 178 translation keys exist in both languages. JavaScript syntax checked.
- The packaged executable JAR starts successfully; home, listing deep links, composer route, health endpoint and live public listing API returned HTTP 200. The actual existing Supabase listing loaded. The release JAR excludes the fixture server and local configuration.
- Live Supabase favorites migration applied. RLS is enabled and all three policies restrict access to the authenticated owner. A transaction tested owner add/read/remove, cross-account read/delete isolation and rejection of forged ownership, then rolled back. A final schema query confirmed RLS enabled, three policies and zero leftover favorites.
- The complete Dockerfile built successfully in Podman. Its non-root runtime started with a 512 MB limit; health, configured-session and live public listing endpoints returned HTTP 200.
- The website compiles the shared models from a pinned Git submodule, without requiring the Android SDK. No admin key or database password is used.

## Limits

- This session's installed Android emulator exited with host segmentation faults before connecting to adb, with three graphics configurations. Instrumented test APK compilation succeeded, but the emulator suite (including the three new favorite-sync regressions) could not execute. No physical phone was touched.
- A signed-in real Android ↔ website round trip has not been exercised. Live public reads and SQL ownership checks passed; authenticated website flows were tested with isolated fixtures and fake Supabase HTTP responses.
- Real browser geolocation was not granted or exercised. Interactive map clicks and manual coordinates were exercised.
- Browser visual QA used the in-app browser's 329px layout. Its viewport override did not take effect, and the alternate desktop-tab attempt was unavailable. Full-width visual QA should be repeated in a regular desktop browser before a public launch.
- Reopening the previous preview after the environment restarted was blocked by the browser URL policy on its internal error page. Packaged-JAR HTTP checks were repeated successfully.
- Production hosting/domain/HTTPS have not been provisioned. The JAR and Dockerfile are deployment artifacts, not a hosted public URL. Container verification is recorded in the release notes.
