# Surulere for Continuity — deployment guide

## What is included

- `index.html`: public campaign website and volunteer registration form
- `admin.html`: private volunteer administration interface
- `api/`: Vercel serverless endpoints for registration, live counts and administrator access
- `index-5.html`: retained reference copy from the repository; `index.html` is the active homepage
- `.env.example`: names of the required environment variables, with no secret values

## Important: preserve the existing database

This website is connected to the existing Supabase project. Do not create a new Supabase project, reset the database, delete tables, or run a fresh schema migration when deploying this interface update. Existing volunteer records and registration numbers must remain untouched.

## Vercel deployment

1. Open the existing Vercel project connected to this GitHub repository.
2. Keep the existing project, production domain, build settings and environment variables.
3. Deploy the reviewed branch or merge the reviewed change into the configured production branch.
4. Confirm the deployment is ready before assigning the production domain.

The website is a static HTML homepage with Vercel serverless functions under `api/`. No new framework or database is required for this counter change.

## Required Vercel environment variables

Set these in Vercel Project Settings → Environment Variables. Use the existing values already configured for the working production site; do not replace them with new credentials.

- `SUPABASE_URL` — existing Supabase project URL
- `SUPABASE_ANON_KEY` — existing public/anon key used by the public count and registration endpoints
- `SUPABASE_SERVICE_ROLE_KEY` — existing service-role key used only by the protected administrator endpoint
- `VOLUNTEER_ADMIN_PASSWORD` — administrator sign-in password
- `ADMIN_SESSION_SECRET` — long random secret used to sign administrator sessions

Never put the service-role key, administrator password or session secret in frontend HTML, public GitHub files, or a shared ZIP containing real credentials. The `.env.example` file contains names only.

## Verification checklist

- Homepage loads on desktop and mobile.
- The registration counter obtains its value from `GET /api/count` and displays six digits (for example, `000004`).
- A test registration receives the next sequential registration number.
- The administrator can sign in at `/admin.html`.
- The administrator register shows the total, latest records and registration numbers.
- CSV export preserves leading zeroes in registration numbers.
- Existing volunteer records remain present.
- The candidates, record, projects, news and volunteer sections load.

Use a clearly identified test registration only when authorised. Remove test records only through an agreed, audited process; do not reset or truncate the production register.
