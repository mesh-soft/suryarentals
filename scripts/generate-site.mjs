import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "config", "site.json");
const distDir = path.join(root, "dist");
const assetDir = path.join(root, "assets");

const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const toSlug = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const exists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const placeholderSvg = (car) => {
  const initials = car.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760" role="img" aria-label="${escapeHtml(car.name)} image placeholder">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop stop-color="#0f172a"/>
      <stop offset="0.48" stop-color="#1f2937"/>
      <stop offset="1" stop-color="#7f1d1d"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="760" fill="url(#bg)"/>
  <path d="M242 474h716c31 0 57 25 57 57v37H185v-37c0-31 26-57 57-57Z" fill="#f8fafc" opacity=".94"/>
  <path d="M336 474l91-118c17-22 43-35 71-35h220c30 0 58 15 74 40l72 113H336Z" fill="#e2e8f0"/>
  <circle cx="342" cy="572" r="74" fill="#020617"/>
  <circle cx="342" cy="572" r="34" fill="#94a3b8"/>
  <circle cx="858" cy="572" r="74" fill="#020617"/>
  <circle cx="858" cy="572" r="34" fill="#94a3b8"/>
  <text x="600" y="186" text-anchor="middle" fill="#fff" font-family="Arial, sans-serif" font-size="86" font-weight="800">${escapeHtml(initials)}</text>
  <text x="600" y="264" text-anchor="middle" fill="#fee2e2" font-family="Arial, sans-serif" font-size="44" font-weight="700">${escapeHtml(car.name)}</text>
  <text x="600" y="684" text-anchor="middle" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="28">Replace with real photo in ${escapeHtml(car.images?.[0] ?? "assets/images/cars")}</text>
</svg>`;
};

const imageFor = async (car) => {
  const first = car.images?.[0];
  if (first && (await exists(path.join(root, first)))) return first;
  const fallback = `assets/images/cars/${toSlug(car.slug || car.name)}/placeholder.svg`;
  await writeText(path.join(distDir, fallback), placeholderSvg(car));
  return fallback;
};

const jsonLd = (config) => {
  const { site, packages, testimonials, faq } = config;
  return [
    {
      "@context": "https://schema.org",
      "@type": "AutoRental",
      name: site.name,
      description: site.description,
      telephone: site.phone,
      email: site.email,
      areaServed: `${site.city}, ${site.region}`,
      priceRange: "INR 2000-6000",
      url: site.baseUrl,
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "5",
        reviewCount: String(testimonials.length)
      },
      makesOffer: packages.cars.map((car) => ({
        "@type": "Offer",
        name: `${car.name} self drive rental`,
        priceCurrency: site.currency,
        price: car.pricing["12h"],
        availability: "https://schema.org/InStock",
        itemOffered: {
          "@type": "Car",
          name: car.name,
          vehicleSeatingCapacity: car.seats,
          fuelType: car.fuel,
          vehicleTransmission: car.transmission
        }
      })),
      review: testimonials.map((item) => ({
        "@type": "Review",
        author: { "@type": "Person", name: item.name },
        reviewRating: { "@type": "Rating", ratingValue: item.rating },
        reviewBody: item.text
      }))
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer
        }
      }))
    }
  ];
};

const render = async (config) => {
  const { site, booking, trustBadges, packages, testimonials, faq } = config;
  const carsWithImages = await Promise.all(
    packages.cars.map(async (car) => ({ ...car, primaryImage: await imageFor(car) }))
  );
  const cheapest = Math.min(...packages.cars.map((car) => car.pricing["12h"]));
  const heroImage = carsWithImages[0]?.primaryImage ?? "";

  const carOptions = carsWithImages
    .map((car) => `<option value="${escapeHtml(car.name)}">${escapeHtml(car.name)} - ${money(car.pricing["12h"])} / 12h</option>`)
    .join("");

  return `<!doctype html>
<html lang="en-IN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(site.name)} | Self Drive Car Rental in ${escapeHtml(site.city)}</title>
    <meta name="description" content="${escapeHtml(site.description)}">
    <meta name="keywords" content="${escapeHtml(site.keywords.join(", "))}">
    <meta name="robots" content="index, follow, max-image-preview:large">
    <link rel="canonical" href="${escapeHtml(site.baseUrl)}/">
    <meta property="og:title" content="${escapeHtml(site.name)}">
    <meta property="og:description" content="${escapeHtml(site.description)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${escapeHtml(site.baseUrl)}/">
    <meta property="og:image" content="${escapeHtml(site.baseUrl)}/${escapeHtml(heroImage)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="theme-color" content="#b91c1c">
    <link rel="preload" as="image" href="${escapeHtml(heroImage)}">
    <script type="application/ld+json">${JSON.stringify(jsonLd(config)).replaceAll("</", "<\\/")}</script>
    <style>
      :root {
        color-scheme: light;
        --ink: #111827;
        --muted: #5b6472;
        --line: #e5e7eb;
        --paper: #ffffff;
        --soft: #f7f7f4;
        --brand: #b91c1c;
        --brand-dark: #7f1d1d;
        --accent: #0f766e;
        --gold: #f59e0b;
        --shadow: 0 18px 50px rgba(17, 24, 39, .12);
      }
      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--ink);
        background: var(--soft);
        line-height: 1.5;
      }
      a { color: inherit; text-decoration: none; }
      img { display: block; width: 100%; height: auto; }
      .wrap { width: min(1160px, calc(100% - 32px)); margin: 0 auto; }
      .topbar {
        position: sticky;
        top: 0;
        z-index: 20;
        background: rgba(255,255,255,.92);
        border-bottom: 1px solid var(--line);
        backdrop-filter: blur(14px);
      }
      .nav { min-height: 70px; display: flex; align-items: center; justify-content: space-between; gap: 18px; }
      .brand { display: flex; flex-direction: column; gap: 2px; font-weight: 900; letter-spacing: 0; }
      .brand small { color: var(--brand); font-weight: 800; }
      .navlinks { display: flex; align-items: center; gap: 18px; color: var(--muted); font-size: 14px; }
      .navlinks a:hover { color: var(--brand); }
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 44px;
        padding: 0 18px;
        border-radius: 8px;
        border: 1px solid transparent;
        font-weight: 800;
        cursor: pointer;
        transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
      }
      .btn:hover { transform: translateY(-1px); }
      .btn-primary { background: var(--brand); color: #fff; box-shadow: 0 12px 28px rgba(185, 28, 28, .24); }
      .btn-secondary { background: #fff; border-color: var(--line); color: var(--ink); }
      .hero {
        min-height: calc(100svh - 70px);
        display: grid;
        align-items: center;
        padding: 58px 0 34px;
        background:
          linear-gradient(90deg, rgba(17, 24, 39, .88), rgba(17, 24, 39, .56) 48%, rgba(17, 24, 39, .10)),
          url("${escapeHtml(heroImage)}") center / cover no-repeat;
        color: #fff;
      }
      .hero-grid { display: grid; grid-template-columns: minmax(0, 1fr) 410px; gap: 42px; align-items: end; }
      .eyebrow { color: #fecaca; font-weight: 900; text-transform: uppercase; font-size: 13px; letter-spacing: .08em; }
      h1 { margin: 12px 0 18px; font-size: clamp(42px, 6vw, 82px); line-height: .96; max-width: 850px; letter-spacing: 0; }
      .lead { max-width: 670px; color: #f3f4f6; font-size: clamp(18px, 2.2vw, 24px); margin: 0 0 26px; }
      .hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 28px; }
      .quick-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; max-width: 760px; }
      .fact { border: 1px solid rgba(255,255,255,.22); background: rgba(255,255,255,.12); padding: 14px; border-radius: 8px; backdrop-filter: blur(12px); }
      .fact strong { display: block; font-size: 20px; }
      .fact span { color: #e5e7eb; font-size: 13px; }
      .booking-panel {
        background: rgba(255,255,255,.96);
        color: var(--ink);
        border-radius: 8px;
        padding: 22px;
        box-shadow: var(--shadow);
      }
      .booking-panel h2 { margin: 0 0 14px; font-size: 24px; }
      .form-grid { display: grid; gap: 12px; }
      label { display: grid; gap: 6px; color: var(--muted); font-size: 13px; font-weight: 800; }
      input, select, textarea {
        width: 100%;
        min-height: 44px;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 10px 12px;
        font: inherit;
        color: var(--ink);
        background: #fff;
      }
      textarea { min-height: 86px; resize: vertical; }
      section { padding: 76px 0; }
      .section-head { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
      .section-head h2 { margin: 0; font-size: clamp(30px, 4vw, 48px); line-height: 1.02; }
      .section-head p { margin: 0; max-width: 560px; color: var(--muted); }
      .badges, .fleet, .reviews, .faq { display: grid; gap: 16px; }
      .badges { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .badge, .car, .review, .faq-item {
        background: var(--paper);
        border: 1px solid var(--line);
        border-radius: 8px;
        box-shadow: 0 10px 32px rgba(17, 24, 39, .06);
      }
      .badge { padding: 22px; }
      .badge strong { display: block; font-size: 20px; margin-bottom: 6px; }
      .badge p, .review p, .faq-item p { color: var(--muted); margin: 0; }
      .fleet { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .car { overflow: hidden; display: grid; grid-template-rows: 220px 1fr; }
      .car-media { width: 100%; height: 220px; object-fit: cover; background: #111827; }
      .car-body { padding: 18px; display: grid; gap: 14px; }
      .car-title { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
      .car h3 { margin: 0; font-size: 22px; }
      .pill { border: 1px solid #d1fae5; color: #065f46; background: #ecfdf5; border-radius: 999px; padding: 5px 9px; font-size: 12px; font-weight: 900; white-space: nowrap; }
      .specs { display: flex; flex-wrap: wrap; gap: 8px; color: var(--muted); font-size: 13px; }
      .specs span { border: 1px solid var(--line); border-radius: 999px; padding: 5px 9px; background: #fafafa; }
      .rates { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .rate { background: #f9fafb; border: 1px solid var(--line); border-radius: 8px; padding: 12px; }
      .rate strong { display: block; font-size: 20px; }
      .rate span { color: var(--muted); font-size: 13px; }
      .reviews { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .review { padding: 22px; }
      .stars { color: var(--gold); font-size: 18px; letter-spacing: 2px; }
      .review strong { display: block; margin: 12px 0 6px; }
      .faq { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .faq-item { padding: 22px; }
      .faq-item h3 { margin: 0 0 8px; font-size: 18px; }
      .cta-band { background: #111827; color: #fff; }
      .cta-row { display: grid; grid-template-columns: 1fr auto; gap: 22px; align-items: center; }
      .cta-row h2 { margin: 0 0 8px; font-size: clamp(30px, 4vw, 50px); }
      .cta-row p { margin: 0; color: #d1d5db; }
      footer { padding: 28px 0; background: #fff; border-top: 1px solid var(--line); color: var(--muted); }
      .footer-row { display: flex; justify-content: space-between; gap: 18px; flex-wrap: wrap; }
      .floating-whatsapp {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 25;
        border-radius: 999px;
        padding: 14px 18px;
        background: #16a34a;
        color: #fff;
        box-shadow: 0 16px 34px rgba(22, 163, 74, .28);
        font-weight: 900;
      }
      @media (max-width: 980px) {
        .hero-grid, .cta-row { grid-template-columns: 1fr; }
        .booking-panel { max-width: 560px; }
        .fleet, .badges { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .reviews, .faq { grid-template-columns: 1fr; }
      }
      @media (max-width: 680px) {
        .navlinks a:not(.btn) { display: none; }
        .hero { min-height: auto; padding: 44px 0 28px; background-position: center; }
        .quick-facts, .fleet, .badges, .rates { grid-template-columns: 1fr; }
        .section-head { display: grid; }
        .car { grid-template-rows: 200px 1fr; }
        .car-media { height: 200px; }
        .floating-whatsapp { left: 16px; right: 16px; text-align: center; }
      }
    </style>
  </head>
  <body>
    <header class="topbar">
      <nav class="wrap nav" aria-label="Primary navigation">
        <a class="brand" href="#top"><span>${escapeHtml(site.name)}</span><small>${escapeHtml(site.city)} self drive rentals</small></a>
        <div class="navlinks">
          <a href="#fleet">Fleet</a>
          <a href="#rates">Rates</a>
          <a href="#reviews">Reviews</a>
          <a class="btn btn-primary" href="tel:${escapeHtml(site.phone)}">${escapeHtml(site.displayPhone)}</a>
        </div>
      </nav>
    </header>

    <main id="top">
      <section class="hero" aria-label="${escapeHtml(site.name)} booking hero">
        <div class="wrap hero-grid">
          <div>
            <div class="eyebrow">No hidden charges · Instant booking · Doorstep delivery</div>
            <h1>${escapeHtml(site.name)}</h1>
            <p class="lead">${escapeHtml(site.tagline)}</p>
            <div class="hero-actions">
              <a class="btn btn-primary" href="#booking">${escapeHtml(site.primaryCta)}</a>
              <a class="btn btn-secondary" href="tel:${escapeHtml(site.phone)}">${escapeHtml(site.secondaryCta)}</a>
            </div>
            <div class="quick-facts" aria-label="Package limits">
              <div class="fact"><strong>From ${money(cheapest)}</strong><span>12 hour self drive package</span></div>
              <div class="fact"><strong>${escapeHtml(packages.limits["12h"])}</strong><span>Included in 12 hour rentals</span></div>
              <div class="fact"><strong>${escapeHtml(packages.limits["24h"])}</strong><span>Included in 24 hour rentals</span></div>
            </div>
          </div>
          <form class="booking-panel" id="booking" ${booking.formEndpoint ? `action="${escapeHtml(booking.formEndpoint)}" method="post"` : ""}>
            <h2>Instant booking enquiry</h2>
            <div class="form-grid">
              <label>Your name<input name="name" autocomplete="name" required></label>
              <label>Mobile number<input name="phone" inputmode="tel" autocomplete="tel" required></label>
              <label>Car<select name="car" required>${carOptions}</select></label>
              <label>Package<select name="package" required><option value="12 hours">12 hours - ${escapeHtml(packages.limits["12h"])}</option><option value="24 hours">24 hours - ${escapeHtml(packages.limits["24h"])}</option></select></label>
              <label>Pickup date and time<input name="datetime" type="datetime-local" required></label>
              <label>Pickup area<input name="pickup" value="${escapeHtml(booking.defaultPickupArea)}" placeholder="Home, hotel, airport, office..."></label>
              <label>Notes<textarea name="notes" placeholder="Trip plan, delivery request, return time"></textarea></label>
              <button class="btn btn-primary" type="submit">Send enquiry on WhatsApp</button>
            </div>
          </form>
        </div>
      </section>

      <section>
        <div class="wrap badges">
          ${trustBadges.map((badge) => `<article class="badge"><strong>${escapeHtml(badge.title)}</strong><p>${escapeHtml(badge.text)}</p></article>`).join("")}
        </div>
      </section>

      <section id="fleet">
        <div class="wrap">
          <div class="section-head">
            <h2>Choose your self drive car</h2>
            <p>Every listed package is generated from <code>config/site.json</code>, so rate changes and new cars can be published fast.</p>
          </div>
          <div class="fleet" id="rates">
            ${carsWithImages
              .map(
                (car) => `<article class="car" id="${escapeHtml(toSlug(car.name))}" itemscope itemtype="https://schema.org/Car">
              <img class="car-media" src="${escapeHtml(car.primaryImage)}" alt="${escapeHtml(car.name)} self drive rental car" loading="lazy" width="1200" height="760" itemprop="image">
              <div class="car-body">
                <div class="car-title"><h3 itemprop="name">${escapeHtml(car.name)}</h3><span class="pill">${escapeHtml(car.category)}</span></div>
                <p>${escapeHtml(car.highlight)}</p>
                <div class="specs"><span>${escapeHtml(car.fuel)}</span><span>${escapeHtml(car.transmission)}</span><span>${escapeHtml(car.seats)} seats</span></div>
                <div class="rates">
                  <div class="rate"><strong>${money(car.pricing["12h"])}</strong><span>12 hours · ${escapeHtml(packages.limits["12h"])}</span></div>
                  <div class="rate"><strong>${money(car.pricing["24h"])}</strong><span>24 hours · ${escapeHtml(packages.limits["24h"])}</span></div>
                </div>
                <a class="btn btn-primary" href="#booking" data-car="${escapeHtml(car.name)}">Book ${escapeHtml(car.name)}</a>
              </div>
            </article>`
              )
              .join("")}
          </div>
        </div>
      </section>

      <section id="reviews">
        <div class="wrap">
          <div class="section-head">
            <h2>Customer reviews</h2>
            <p>Testimonials are editable in JSON. Replace these entries with exact Google review text when the public review link is available.</p>
          </div>
          <div class="reviews">
            ${testimonials
              .map((item) => `<article class="review" itemprop="review" itemscope itemtype="https://schema.org/Review">
                <div class="stars" aria-label="${escapeHtml(item.rating)} out of 5 stars">${"★".repeat(item.rating)}</div>
                <strong itemprop="author">${escapeHtml(item.name)}</strong>
                <p itemprop="reviewBody">${escapeHtml(item.text)}</p>
              </article>`)
              .join("")}
          </div>
        </div>
      </section>

      <section>
        <div class="wrap">
          <div class="section-head">
            <h2>Booking FAQs</h2>
            <p>Short, direct answers help customers, Google, and AI assistants understand the service quickly.</p>
          </div>
          <div class="faq">
            ${faq.map((item) => `<article class="faq-item"><h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p></article>`).join("")}
          </div>
        </div>
      </section>

      <section class="cta-band">
        <div class="wrap cta-row">
          <div>
            <h2>Need a car today?</h2>
            <p>Call ${escapeHtml(site.displayPhone)} or send a WhatsApp enquiry with your car, date, and pickup location.</p>
          </div>
          <a class="btn btn-primary" href="https://wa.me/${escapeHtml(site.whatsapp)}?text=${encodeURIComponent(`Hi ${site.name}, I want to book a self drive car.`)}">WhatsApp now</a>
        </div>
      </section>
    </main>

    <footer>
      <div class="wrap footer-row">
        <span>© ${new Date().getFullYear()} ${escapeHtml(site.name)}. Self drive car rental in ${escapeHtml(site.city)}, ${escapeHtml(site.region)}.</span>
        <span><a href="mailto:${escapeHtml(site.email)}">${escapeHtml(site.email)}</a> · <a href="tel:${escapeHtml(site.phone)}">${escapeHtml(site.displayPhone)}</a></span>
      </div>
    </footer>

    <a class="floating-whatsapp" href="https://wa.me/${escapeHtml(site.whatsapp)}?text=${encodeURIComponent(`Hi ${site.name}, I want to rent a self drive car.`)}" aria-label="Chat on WhatsApp">WhatsApp booking</a>

    <script type="application/json" id="site-config">${JSON.stringify(config).replaceAll("</", "<\\/")}</script>
    <script>
      const cfg = JSON.parse(document.getElementById("site-config").textContent);
      const form = document.getElementById("booking");
      document.querySelectorAll("[data-car]").forEach((button) => {
        button.addEventListener("click", () => {
          form.elements.car.value = button.dataset.car;
        });
      });
      form.addEventListener("submit", (event) => {
        if (cfg.booking.formEndpoint) return;
        event.preventDefault();
        const data = new FormData(form);
        const message = [
          "Hi " + cfg.site.name + ", I want to book a self drive car.",
          "Name: " + data.get("name"),
          "Phone: " + data.get("phone"),
          "Car: " + data.get("car"),
          "Package: " + data.get("package"),
          "Pickup date/time: " + data.get("datetime"),
          "Pickup area: " + (data.get("pickup") || "Not specified"),
          "Notes: " + (data.get("notes") || "None")
        ].join("\\n");
        window.location.href = "https://wa.me/" + cfg.site.whatsapp + "?text=" + encodeURIComponent(message);
      });
    </script>
  </body>
</html>`;
};

const copyAssets = async () => {
  if (await exists(assetDir)) {
    await fs.cp(assetDir, path.join(distDir, "assets"), { recursive: true });
  }
};

const writeText = async (filePath, text) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, text);
};

export const build = async () => {
  const config = JSON.parse(await fs.readFile(configPath, "utf8"));
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });
  await copyAssets();
  await writeText(path.join(distDir, "index.html"), await render(config));
  await writeText(path.join(distDir, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${config.site.baseUrl}/sitemap.xml\n`);
  await writeText(
    path.join(distDir, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${config.site.baseUrl}/</loc><priority>1.0</priority></url>\n</urlset>\n`
  );
  await writeText(
    path.join(distDir, "llms.txt"),
    `# ${config.site.name}\n\n${config.site.description}\n\nContact: ${config.site.displayPhone}, ${config.site.email}\n\nKey services:\n${config.packages.cars
      .map((car) => `- ${car.name}: ${money(car.pricing["12h"])} for 12 hours, ${money(car.pricing["24h"])} for 24 hours`)
      .join("\n")}\n`
  );
  console.log(`Built ${path.relative(root, distDir)}/index.html`);
};

const isDirectRun = import.meta.url === pathToFileURL(process.argv[1] || "").href;

if (isDirectRun) {
  await build();

  if (process.argv.includes("--watch")) {
    console.log("Watching config/site.json and assets...");
    fs.watch(configPath, build);
    fs.watch(assetDir, { recursive: true }, build);
  }
}
