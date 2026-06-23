# Easy As Loans — CRM setup guide

This site comes with its own little CRM. When someone completes the finance
form, the lead is:

1. **saved to a database**, and
2. shown in a **password-protected dashboard** at `/admin` where you can sort
   the leads and click any one to see every detail (and mark it New →
   Contacted → Qualified → Won/Lost), and
3. **emailed** to `cristian.r@savvy.com.au` as a backup.

It all runs on **Cloudflare Pages** (free tier) — one platform that hosts the
website, the form's API, and the database together, so there are no secret keys
sitting in the public website code.

You only have to set this up **once**. It takes about 15–20 minutes. You don't
need to be technical — just follow along.

---

## What you'll end up with

- Website live at a Cloudflare URL (and your own domain when you're ready)
- A dashboard at `https://your-site/admin`
- Every lead saved, searchable, and emailed to you

---

## Step 1 — Create a free Cloudflare account

Go to <https://dash.cloudflare.com/sign-up> and sign up. It's free.

## Step 2 — Connect this repository

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages →
   Connect to Git**.
2. Authorise GitHub and choose the `johnp-lgtm/eal` repository.
3. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave blank)*
   - **Build output directory:** `/`
4. Click **Save and Deploy**. Your site goes live at a `*.pages.dev` URL.

## Step 3 — Create the leads database (D1)

1. In the dashboard: **Workers & Pages → D1 → Create database**.
2. Name it `easyasloans-leads` and create it.
3. Open the new database → **Console** tab, paste the contents of
   [`schema.sql`](schema.sql) from this repo, and run it. (This creates the
   `leads` table.)

## Step 4 — Connect the database to the site

1. Go to your Pages project → **Settings → Functions → D1 database bindings**.
2. Add a binding:
   - **Variable name:** `DB`
   - **D1 database:** `easyasloans-leads`
3. Save.

## Step 5 — Set your passwords & email settings

In your Pages project → **Settings → Environment variables**, add these
(use the **Encrypt** option for each so they're stored securely):

| Name | Value | Notes |
| --- | --- | --- |
| `ADMIN_PASSWORD` | *(a strong password you choose)* | Used to log in at `/admin` |
| `LEAD_EMAIL_TO` | `cristian.r@savvy.com.au` | Where lead emails are sent |
| `RESEND_API_KEY` | *(see Step 6)* | Enables the email backup |
| `LEAD_EMAIL_FROM` | `Easy As Loans <onboarding@resend.dev>` | Change to your domain once verified |

## Step 6 — Turn on email (Resend)

The email backup uses [Resend](https://resend.com) (generous free tier).

1. Sign up at <https://resend.com>.
2. Create an **API key** and paste it into the `RESEND_API_KEY` variable above.
3. For testing you can leave `LEAD_EMAIL_FROM` as `onboarding@resend.dev`.
   For production, verify your `easyasloans.com.au` domain in Resend and set
   `LEAD_EMAIL_FROM` to something like `Easy As Loans <leads@easyasloans.com.au>`.

> Email is optional and best-effort — if it's ever misconfigured, the lead is
> still saved to the dashboard. Nothing is lost.

## Step 7 — Redeploy and test

1. In your Pages project → **Deployments → Retry deployment** (so it picks up
   the new bindings and variables).
2. Visit your live site, complete the finance form.
3. Visit `https://your-site/admin`, log in with `ADMIN_PASSWORD`, and you should
   see the lead. Click it to see everything captured. Check the inbox for the
   email copy.

---

## Using the dashboard

- **Search** by name, email, mobile, state or loan type.
- **Sort** by clicking any column heading.
- **Filter** by status.
- **Click a lead** to open the detail panel — call/email buttons are right
  there, and you can change the status (New, Contacted, Qualified, Won, Lost).

## Your custom domain

In your Pages project → **Custom domains**, add `easyasloans.com.au` and follow
the DNS prompts. (If your domain's DNS is already on Cloudflare this is a couple
of clicks.)

## Security notes

- The dashboard is protected by `ADMIN_PASSWORD` over HTTPS. Use a strong one.
- For extra protection you can later put the `/admin` path behind
  **Cloudflare Access** (free for small teams) so it requires a verified email
  login as well.
- The website form has a hidden "honeypot" field to catch spam bots.

## Want to use a different host or CRM instead?

This is portable. The form simply POSTs JSON to `/api/leads`. If you'd rather
send leads to HubSpot, Airtable, Zoho, GoHighLevel, etc., tell me and I'll point
the form (or the function) at it instead.
