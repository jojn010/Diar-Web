# Diar Web

The Spring Boot companion to the [Diar Android app](https://github.com/jojn010/Diar), with the same cream, teal and sage palette, rounded property cards and subtle motion. English and Arabic/RTL are included, with responsive layouts and reduced-motion support.

## What works

- Browse actual Supabase listings, search by place/title and filter sale/rent or property type.
- Sign in or register with the same Supabase email/password accounts as Android.
- Publish through three steps: home/type/floors/area, current location or map pin, then one integer USD price, negotiable checkbox, photo and description. Rent prices are monthly.
- View and edit your own listings; deletion requires confirmation. Photo replacement cleans up the old object after a successful save.
- Save favorites to your account. Published listings, photos and favorites use the same Supabase project as Android. Browsing refreshes every 30 seconds and when the tab becomes visible; Refresh checks immediately. This is polling, not realtime.
- Open real location pins in Maps and copy a real listing permalink. No invented ratings, owner verification, availability guarantees, payments or messaging.

## Shared classes and database

`domain` is a Git submodule pinned to a tested commit of the Android repository. Both clients compile the **same actual Java `Listing` and `Favorite` classes** from `domain/shared`; there is no duplicated website entity/schema. `Listing` maps the existing snake_case database contract and validates whole-number prices, area, floors, property type and coordinates. Android adds its device-local cache wrapper around that contract.

Use the existing `public.listings` and public `listing-photos` bucket. Apply the SQL files in `domain/supabase/migrations` once in filename order. `202611200001_synced_favorites.sql` adds private `public.favorites` with `(user_id, listing_id)` as its composite primary key, cascading references and owner-only read/insert/delete policies. Never disable RLS. The migration is already applied to the project's configured Supabase instance.

Android v1.4.0 adds cloud favorites, a durable offline favorite queue and foreground refresh. Existing account favorites upload once; unpublished local homes and guest favorites remain private on the device. The website requires a successful server response to save a favorite or publish/edit a listing. Existing local Android homes are not automatically uploaded.

## Run locally

Use a full **JDK 25** (not a runtime-only Java install). Spring Boot 3.5 is used; application classes target Java 17, and shared classes target Java 11. The Gradle wrapper is included.

```bash
git clone --recurse-submodules https://github.com/jojn010/Diar-Web.git
cd Diar-Web
```

If already cloned, run `git submodule update --init domain`. The repository is private initially, so clone with your GitHub account.

Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in the shell or your IDE run configuration. Alternatively, create ignored `local.properties`:

```properties
supabase.url=https://YOUR_PROJECT_REF.supabase.co
supabase.publishableKey=YOUR_PUBLISHABLE_KEY
```

For this local workspace, the existing sibling `../diar/local.properties` is also read; an explicit website local file overrides it, and environment variables override both. No values are committed. **Use a publishable/legacy anon key, never a secret/service-role key or database password.**

```bash
./gradlew bootRun
```

Open [localhost:8080](http://localhost:8080). The default binding is loopback. Accounts, listings and photos use your configured live project; do not publish disposable QA data here. Signup follows your project's existing email-confirmation setting. Password recovery, social login and email deep links are not implemented.

## Build and verify

```bash
./tools/check_web.sh
java -jar build/libs/diar-web-1.0.0.jar
```

Tests use mocked controllers and a local fake Supabase HTTP server. They do not create users, send email or write to a live project. Coverage includes CSRF, server-side sessions, owner forgery, fractional prices, Arabic data, image validation/resizing, token refresh, favorites pagination/idempotency and failed-photo cleanup. Shared JVM tests cover database mapping and offline favorite merges. See [QA.md](QA.md) for the checks actually executed and their limits.

For isolated manual browser QA only:

```bash
./gradlew browserQa
```

Open [localhost:8081](http://localhost:8081). Sign in with `demo@example.invalid` / `demo-password`. This in-memory fixture server never contacts Supabase and is **not included in the release JAR**. Restarting it resets its fixtures. It is a test environment, not the actual website.

## Deploy to a Java host

This app needs a running JVM server. Static hosting and Cloudflare Workers/Sites cannot execute Spring Boot. No public production deployment or paid hosting has been created.

Deploy the executable JAR, or use the included Dockerfile on a host that supports Java/Docker. Initialize the Git submodule before building Docker. Configure:

- `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for the same project as Android.
- `BIND_ADDRESS=0.0.0.0` for a container/managed host and `PORT` for its assigned port.
- HTTPS at the host's reverse proxy and `COOKIE_SECURE=true`. For local HTTP Docker testing only, override it to `false`.
- A health check on `/api/health`. The endpoint checks the web process, not Supabase availability.

```bash
docker build -t diar-web .
docker run --rm -p 8080:8080 --env-file .env diar-web
```

Copy `.env.example` to an ignored `.env` and fill the public configuration first. Never place credentials in a Docker build argument, image or Git commit.

Sessions and refresh tokens live only in server memory behind an HttpOnly, SameSite cookie; passwords are not persisted. CSRF checks protect writes, CSP restricts script sources, and the backend forwards each user's own access token so Supabase RLS remains authoritative. Sessions end on server restart or after inactivity. Use one instance initially; distributed sessions and infrastructure hardening are required before scaling across instances. Configure Supabase email delivery/rate limits for your pilot group.

Exact published coordinates, listing details and uploaded photos are public, as disclosed before publishing. Maps use Leaflet 1.9.4 and OpenStreetMap tiles; their provider receives normal tile requests. Coordinates can be entered if tiles/geolocation are unavailable. Current location requires browser permission and HTTPS (localhost is permitted). Owner identity, misleading photos, duplicate listings and availability still require future product/moderation work.

## Assets

Property photography is reused from Diar's existing bundled Unsplash images (IDs `photo-1600596542815-ffad4c1539a9`, `photo-1600585154340-be6161a56a0c`, `photo-1600047509807-ba8f99d2cdde`). A missing listing photo is explicitly labeled **Sample photo**. Leaflet's license is included at `src/main/resources/static/assets/LEAFLET-LICENSE.txt`.
