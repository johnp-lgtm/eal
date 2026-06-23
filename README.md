# Easy As Loans — website

A clean, single-page website for Easy As Loans, Adelaide finance brokers
(ACL 477976 · ABN 77 590 660 633).

Built as a plain static site — no build step, no frameworks. Just open
`index.html` in a browser, or host the folder anywhere (Netlify, Cloudflare
Pages, GitHub Pages, your own server).

## Structure

```
index.html          Home page (header, hero, reviews, why-us, process, FAQ, footer, multi-step form)
terms.html          Terms & Conditions (placeholder content)
privacy.html        Privacy Policy (placeholder content)
styles.css          All styling (brand colours + type from the style guide)
script.js           Finance form (multi-step) + modal logic
assets/             hero.jpg + reviews/ customer photos
admin/              Leads dashboard (login, sortable table, click-into detail)
functions/api/      /api/leads — Cloudflare Pages Function (save lead + email)
schema.sql          Database table for leads (Cloudflare D1)
CRM-SETUP.md        Step-by-step guide to turn on the CRM
eal_styleguide.pdf  The brand identity guidelines
```

## The finance form + CRM

The "Apply" buttons open a multi-step form (loan type, amount slider, term,
personal/business, car year for car loans, state, then contact details).

On completion the lead is POSTed as JSON to `/api/leads`, which saves it to a
database and emails a copy. You then view and manage leads at `/admin`.

**This needs a one-time setup on Cloudflare Pages — see [CRM-SETUP.md](CRM-SETUP.md).**
Until that's done, the form still works for previewing (it shows the success
message but won't store the lead).

## Brand

Pulled straight from `eal_styleguide.pdf`:

- **Purple** `#48206E` (primary)
- **Grey** `#58595B` (secondary)
- **Type:** Museo Sans (per the guide). As Museo Sans isn't a free web font,
  the site uses **Mulish** — a clean, geometric, close match — with Arial as
  the system fallback specified in the guide. To use the real Museo Sans,
  add the font files and update the `--font` variable in `styles.css`.

The logo is faithfully recreated as an SVG mark + live text so it recolours
cleanly (purple on white in the header, white reversed in the footer). To use
your official logo artwork instead, replace the `.logo` markup.

## Status

Done: phone (0402 083 863), email (info@easyasloans.com.au), customer photos,
hero banner, and the multi-step form UI. To change a photo later, see
`assets/reviews/README.txt`.

To do: complete the Cloudflare setup in [CRM-SETUP.md](CRM-SETUP.md) so leads
are stored and emailed, and finalise the legal pages.

### Legal pages

`terms.html` and `privacy.html` contain placeholder scaffolding only. As a
credit licensee you have specific obligations — please have the final wording
reviewed and approved before publishing.
