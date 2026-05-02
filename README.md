# Surya Self Drive Car Rental Website

Config-driven single page website for Surya Self Drive Car Rental.

## Edit Content

Most website content lives in:

```text
config/site.json
```

Update this file for:

- car names, categories, seats, fuel, and transmission
- 12 hour and 24 hour prices
- kilometre limits
- testimonials
- FAQs
- phone, WhatsApp, email, city, and SEO details

## Add Car Images

Add real photos here:

```text
assets/images/cars/
```

Each car has its own folder. Example:

```text
assets/images/cars/thar/hero.jpg
assets/images/cars/thar/side.jpg
```

Then make sure the same paths are listed in `config/site.json`.

## Build

```bash
npm run build
```

The production website is generated in:

```text
dist/
```

Upload `dist/` to any static host such as Netlify, Vercel, Cloudflare Pages, GitHub Pages, or a normal cPanel hosting account.

## Preview Locally

```bash
npm run preview
```

Open:

```text
http://localhost:4173
```

`npm run preview` builds the site once, serves `dist/`, and watches `config/site.json` plus `assets/` for changes. Refresh the browser after saving JSON or replacing images.

## Local JSON Editor

Run:

```bash
npm run editor
```

Open:

```text
http://127.0.0.1:4180
```

This opens a local-only UI for editing `config/site.json`. If `npm run preview` is also running, refresh the preview browser tab after saving. Otherwise run:

```bash
npm run build
```

## Lead Capture

By default, the booking form opens WhatsApp with a pre-filled enquiry message.

To use a backend form service later, set `booking.formEndpoint` in `config/site.json`. The form will submit directly to that endpoint instead of WhatsApp.

## SEO Files

The build generates:

- `dist/index.html`
- `dist/robots.txt`
- `dist/sitemap.xml`
- `dist/llms.txt`

Update `site.baseUrl` in `config/site.json` before publishing so sitemap, canonical URL, and social metadata use the real domain.
