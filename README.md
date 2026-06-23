# Easy As Loans — website

A clean, single-page website for Easy As Loans, Adelaide finance brokers
(ACL 477976 · ABN 77 590 660 633).

Built as a plain static site — no build step, no frameworks. Just open
`index.html` in a browser, or host the folder anywhere (Netlify, Cloudflare
Pages, GitHub Pages, your own server).

## Structure

```
index.html         Home page (header, hero, reviews, why-us, process, FAQ, footer, finance form modal)
terms.html         Terms & Conditions (placeholder content)
privacy.html       Privacy Policy (placeholder content)
styles.css         All styling (brand colours + type from the style guide)
script.js          Finance form modal + validation
assets/reviews/    Customer photos (placeholders for now — see README there)
eal_styleguide.pdf The brand identity guidelines
```

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

## Before you go live — replace the placeholders

Search the project for these markers:

| Marker | What to replace |
| --- | --- |
| `PLACEHOLDER-PHONE` | Your real phone number (shown as `(08) 0000 0000`) |
| `PLACEHOLDER-EMAIL` | Your real email (shown as `hello@easyasloans.com.au`) |
| Customer photos | See `assets/reviews/README.txt` |
| `FORM_ENDPOINT` in `script.js` | Where finance enquiries should be sent |

### Making the finance form actually send

The form currently validates and shows a success message, but doesn't deliver
the enquiry anywhere yet. Open `script.js` and set `FORM_ENDPOINT` to a form
service URL (e.g. [Formspree](https://formspree.io), [Basin](https://usebasin.com),
or your own endpoint). Once set, submissions are POSTed there.

### Legal pages

`terms.html` and `privacy.html` contain placeholder scaffolding only. As a
credit licensee you have specific obligations — please have the final wording
reviewed and approved before publishing.
