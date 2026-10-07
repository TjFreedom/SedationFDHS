/**
 * Patient Education: server-rendered blog pages powered by Opinly.
 *
 *   /patient-education              article index (plus the existing patient guides)
 *   /patient-education/<slug>       a single article
 *   /patient-education/sitemap.xml  sitemap of the index and every article
 *
 * The site header, nav, footer and <head> assets are taken from the live
 * index.html at request time, so these pages always match the rest of the site.
 *
 * Environment variables (Netlify site settings):
 *   OPINLY_API_KEY        required to show articles (without it the index shows the guides only)
 *   OPINLY_CDN_NAMESPACE  this site's Opinly image namespace, used to build image URLs
 */
import { createOpinlyClient } from '@opinly/backend';
import {
  renderToHtml,
  buildMetadata,
  buildBlogPostingJsonLd,
  buildFaqJsonLd,
  buildBreadcrumbJsonLd,
  buildCollectionJsonLd,
  buildSitemapEntries,
  toSitemapXml,
  calculateReadingTime,
  imageUrl,
  postPath,
  escapeHtml,
  uriLooksSafe,
} from '@opinly/shared';

const SITE_URL = 'https://delawaresedation.com';
const BLOG_PREFIX = '/patient-education';
const SITE_NAME = 'Bear Glasgow Dental';
const SECTION_NAME = 'Patient Education';
const PHONE = '+13026130041';
const PHONE_DISPLAY = '(302) 613-0041';

const opinlyConfig = {
  imagesPrefix: `https://cdn.opinly.ai/${process.env.OPINLY_CDN_NAMESPACE || ''}`.replace(/\/$/, ''),
  siteUrl: SITE_URL,
  blogPrefix: BLOG_PREFIX,
  siteName: SITE_NAME,
};

// Existing hand-written guides on the site, listed on the index page.
const GUIDES = [
  { href: '/sleep-dentistry.html', icon: '&#128564;', title: 'IV Sedation (Sleep Dentistry)', text: 'How sleep dentistry works, who it helps, and what to expect before and after.' },
  { href: '/services.html', icon: '&#129658;', title: 'Comparing Sedation Options', text: 'Nitrous oxide, oral sedation, IV sedation and general anesthesia side by side.' },
  { href: '/pediatric-sedation-dentistry.html', icon: '&#129496;', title: 'Pediatric Sedation', text: 'Every level of sedation we offer for children, and how we choose the right one.' },
  { href: '/nitrous-oxide-for-children.html', icon: '&#128168;', title: 'Laughing Gas for Kids', text: 'The gentlest option for children: how nitrous oxide works and what it feels like.' },
  { href: '/childrens-dental-anxiety.html', icon: '&#128552;', title: 'If Your Child Is Scared', text: 'Practical help for fearful and anxious children before, during and after a visit.' },
  { href: '/pediatric-sedation-parents-guide.html', icon: '&#128214;', title: "Parent's Guide to Sedation", text: 'How to prepare your child, what happens on the day, and aftercare made simple.' },
  { href: '/special-needs-pediatric-dentistry.html', icon: '&#128153;', title: 'Special Needs Dentistry', text: 'Calm, unhurried dental care for children with special healthcare needs.' },
  { href: '/pediatric-dental-procedures-sedation.html', icon: '&#129463;', title: 'Procedures We Do Under Sedation', text: 'Which children\'s treatments are commonly done with sedation, and why.' },
];

// ---------- layout (borrowed from index.html) ----------

let layoutCache = null;

/** Make root-relative any link that is relative (so it works under /patient-education/...). */
const absolutize = (html) =>
  html
    .replace(/(href|src)="(?![a-z][a-z0-9+.-]*:|\/|#)/gi, '$1="/')
    .replace(/href="#/g, 'href="/#');

/** Mark the Patient Education nav links as the current section. */
const markCurrent = (html) =>
  html.replace(/<a href="\/patient-education">/g, '<a href="/patient-education" aria-current="page">');

async function getLayout(origin) {
  if (layoutCache) return layoutCache;
  const res = await fetch(`${origin}/index.html`);
  if (!res.ok) throw new Error(`index.html returned ${res.status}`);
  const page = await res.text();

  const head = (page.match(/<head>([\s\S]*?)<\/head>/i) || [])[1] || '';
  const headAssets = head
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\s+(name|property)="(description|keywords|robots|geo\.[^"]*|ICBM|og:[^"]*|twitter:[^"]*)"[^>]*>/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>/gi, '')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, '')
    .replace(/\n\s*\n+/g, '\n');

  const header = (page.match(/<header class="site-header"[\s\S]*?<\/header>/i) || [''])[0];
  const footer = (page.match(/<footer[\s\S]*?<\/footer>/i) || [''])[0];
  const scripts = (page.match(/<script src="[^"]*main\.js[^"]*"><\/script>/i) || [''])[0];

  layoutCache = {
    headAssets: absolutize(headAssets),
    header: markCurrent(absolutize(header)),
    footer: absolutize(footer),
    scripts: absolutize(scripts),
  };
  return layoutCache;
}

const STYLES = `
<style>
  .pe-meta { margin-top: 0.75rem; color: rgba(255,255,255,0.75); font-size: 0.95rem; }
  .pe-article { max-width: 760px; margin: 0 auto; font-size: 1.075rem; line-height: 1.75; color: var(--color-text); }
  .pe-article > * + * { margin-top: 1.1em; }
  .pe-article h2, .pe-article h3, .pe-article h4 { font-family: var(--font-display); color: var(--color-dark); line-height: 1.25; margin-top: 1.8em; }
  .pe-article h2 { font-size: 1.75rem; }
  .pe-article h3 { font-size: 1.35rem; }
  .pe-article a { color: var(--color-primary); text-decoration: underline; text-underline-offset: 2px; }
  .pe-article ul, .pe-article ol { padding-left: 1.4em; }
  .pe-article li + li { margin-top: 0.4em; }
  .pe-article img { max-width: 100%; height: auto; border-radius: var(--radius-md); }
  .pe-article figure { margin: 1.5em 0; }
  .pe-article figcaption { font-size: 0.9rem; color: var(--color-muted); margin-top: 0.4em; }
  .pe-article blockquote { border-left: 4px solid var(--color-accent); padding: 0.25em 0 0.25em 1em; color: var(--color-dark); font-style: italic; }
  .pe-article table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
  .pe-article th, .pe-article td { border: 1px solid var(--color-border); padding: 0.6em 0.8em; text-align: left; }
  .pe-article th { background: var(--color-primary-light); color: var(--color-dark); }
  .pe-hero-img { max-width: 960px; margin: 0 auto 2.5rem; }
  .pe-hero-img img { width: 100%; height: auto; border-radius: var(--radius-lg); box-shadow: var(--shadow-md); }
  .pe-faq { max-width: 760px; margin: 0 auto; }
  .pe-faq details { background: var(--color-white); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1rem 1.25rem; }
  .pe-faq details + details { margin-top: 0.75rem; }
  .pe-faq summary { font-weight: 600; color: var(--color-dark); cursor: pointer; }
  .pe-faq details p { margin-top: 0.75rem; }
  .pe-card-date { font-size: 0.85rem; color: var(--color-muted); margin-bottom: 0.4rem; }
  .pe-empty { text-align: center; color: var(--color-muted); max-width: 560px; margin: 0 auto; }
  .pe-pager { text-align: center; margin-top: 2rem; }
  .pe-disclaimer { max-width: 760px; margin: 2.5rem auto 0; font-size: 0.85rem; color: var(--color-muted); font-style: italic; }
</style>`;

/**
 * Link renderer. Opinly's default adds rel="nofollow" to every link, which would
 * tell search engines to ignore links to our own pages. Internal links stay plain;
 * external links open safely in a new tab.
 */
const renderLink = ({ mark, factory, child, key }) => {
  const href = String(mark.attrs?.href || '');
  if (!href || !uriLooksSafe(href)) return child;
  let external = false;
  try {
    external = /^https?:/i.test(href) && new URL(href).hostname.replace(/^www\./, '') !== new URL(SITE_URL).hostname;
  } catch {
    return child;
  }
  const props = external ? { href, rel: 'noopener', target: '_blank' } : { href };
  return factory.element('a', props, [child], key);
};

const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

function page(layout, { title, description, canonical, ogType = 'website', ogImage, publishedTime, modifiedTime, schema = [], body }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description || '');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <title>${t}</title>
  <meta name="description" content="${d}">
  <link rel="canonical" href="${canonical}">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:title" content="${t}">
  <meta property="og:description" content="${d}">
  <meta property="og:url" content="${canonical}">
  ${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : ''}
  ${publishedTime ? `<meta property="article:published_time" content="${publishedTime}">` : ''}
  ${modifiedTime ? `<meta property="article:modified_time" content="${modifiedTime}">` : ''}
  <meta property="og:locale" content="en_US">
  <meta name="twitter:card" content="summary_large_image">
${layout.headAssets}
  ${STYLES}
  ${schema.map(jsonLd).join('\n  ')}
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to main content</a>
  ${layout.header}
  <main id="main-content">
${body}
  </main>
  ${layout.footer}
  ${layout.scripts}
</body>
</html>`;
}

const breadcrumbHtml = (items) => `
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <ol>
            ${items.map((it, i) => (i === items.length - 1
              ? `<li aria-current="page">${escapeHtml(it.name)}</li>`
              : `<li><a href="${it.href}">${escapeHtml(it.name)}</a></li>`)).join('\n            ')}
          </ol>
        </nav>`;

const ctaSection = `
    <section class="section bg-light">
      <div class="container" style="text-align:center;">
        <div class="section-label">Questions About Sedation?</div>
        <h2>Talk With Our Team</h2>
        <p style="max-width:560px;margin:0.75rem auto 1.5rem;">Every patient is different. Call us or send a message and we will help you find the most comfortable option for you or your child.</p>
        <div class="cta-actions" style="justify-content:center;">
          <a class="btn btn-primary btn-lg" href="tel:${PHONE}">&#128222; ${PHONE_DISPLAY}</a>
          <a class="btn btn-outline btn-lg" href="/contact.html">Book a Visit</a>
        </div>
      </div>
    </section>`;

const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' });
  } catch {
    return '';
  }
};

const guideCards = () => GUIDES.map((g, i) => `
          <article class="option-card" aria-labelledby="guide-${i}">
            <div class="option-icon" aria-hidden="true">${g.icon}</div>
            <h3 id="guide-${i}">${g.title}</h3>
            <p>${g.text}</p>
            <p><a href="${g.href}">Read the guide &rarr;</a></p>
          </article>`).join('');

const postCards = (posts) => posts.map((p, i) => `
          <article class="option-card" aria-labelledby="post-${i}">
            <div class="pe-card-date">${formatDate(p.firstPublishedAt)}</div>
            <h3 id="post-${i}">${escapeHtml(p.title)}</h3>
            ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ''}
            <p><a href="${postPath(opinlyConfig, p)}">Read the article &rarr;</a></p>
          </article>`).join('');

// ---------- responses ----------

const CACHE_OK = {
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=600, stale-while-revalidate=86400',
};
const CACHE_SHORT = {
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'Netlify-CDN-Cache-Control': 'public, s-maxage=60',
};

const html = (body, status = 200, cache = CACHE_OK) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...cache } });

function getClient() {
  if (!process.env.OPINLY_API_KEY) return null;
  return createOpinlyClient({ apiKey: process.env.OPINLY_API_KEY, site: { siteUrl: SITE_URL, blogPrefix: BLOG_PREFIX } });
}

async function renderIndex(layout, opinly, cursor) {
  let posts = [];
  let nextCursor = null;
  let failed = !opinly;
  if (opinly) {
    try {
      const list = await opinly.posts({ limit: 12, cursor: cursor || undefined, sort: 'newest' });
      posts = list.data || [];
      nextCursor = list.has_more ? list.next_cursor : null;
    } catch (err) {
      console.error('Opinly posts() failed:', err);
      failed = true;
    }
  }

  const canonical = `${SITE_URL}${BLOG_PREFIX}`;
  const description = 'Patient education on sedation dentistry from Bear Glasgow Dental in Newark, Delaware: how each type of sedation works, what to expect, and guides for parents.';

  const articles = posts.length
    ? `<div class="options-grid">${postCards(posts)}
        </div>
        ${nextCursor ? `<div class="pe-pager"><a class="btn btn-outline" href="${BLOG_PREFIX}?cursor=${encodeURIComponent(nextCursor)}">More articles &rarr;</a></div>` : ''}`
    : `<p class="pe-empty">New articles are on the way. In the meantime, our patient guides below answer the questions we hear most.</p>`;

  const body = `
    <section class="page-hero">
      <div class="container">
        ${breadcrumbHtml([{ name: 'Home', href: '/' }, { name: SECTION_NAME }])}
        <h1>Patient Education</h1>
        <p class="page-hero-sub">Clear, practical answers about sedation dentistry, written for patients and parents. Learn how each option works, what to expect, and how to feel more comfortable at the dentist.</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-label">Latest Articles</div>
        <h2>From Our Team</h2>
        ${articles}
      </div>
    </section>

    <section class="section bg-light">
      <div class="container">
        <div class="section-label">Patient Guides</div>
        <h2>Start Here</h2>
        <div class="options-grid">${guideCards()}
        </div>
      </div>
    </section>
${ctaSection}`;

  const schema = [
    buildCollectionJsonLd({ name: `${SECTION_NAME} | ${SITE_NAME}`, description, url: canonical }),
    buildBreadcrumbJsonLd([{ name: 'Home', url: `${SITE_URL}/` }, { name: SECTION_NAME, url: canonical }]),
  ];

  // Paginated pages point their canonical at the first page and stay out of the index.
  const out = page(layout, {
    title: `${SECTION_NAME} | Sedation Dentistry | ${SITE_NAME}`,
    description,
    canonical,
    schema,
    body,
  });
  return html(cursor ? out.replace('content="index, follow,', 'content="noindex, follow,') : out, 200, failed ? CACHE_SHORT : CACHE_OK);
}

async function renderPost(layout, opinly, slug) {
  let post = null;
  if (opinly) {
    try {
      post = await opinly.post(slug);
    } catch (err) {
      console.error(`Opinly post(${slug}) failed:`, err);
      return renderNotFound(layout, CACHE_SHORT);
    }
  }
  if (!post) return renderNotFound(layout);

  const meta = buildMetadata({ type: 'post', data: post }, opinlyConfig);
  const canonical = meta.canonicalUrl || `${SITE_URL}${postPath(opinlyConfig, post)}`;
  const minutes = calculateReadingTime(post.content);
  const heroImage = post.titleFile?.fileKey ? imageUrl(post.titleFile.fileKey, opinlyConfig) : null;
  const faqs = Array.isArray(post.faqs) ? post.faqs.filter((f) => f.question && f.answer) : [];

  const metaLine = [
    post.author?.name ? `By ${escapeHtml(post.author.name)}` : null,
    formatDate(post.firstPublishedAt),
    `${minutes} min read`,
  ].filter(Boolean).join(' &middot; ');

  const body = `
    <section class="page-hero">
      <div class="container">
        ${breadcrumbHtml([{ name: 'Home', href: '/' }, { name: SECTION_NAME, href: BLOG_PREFIX }, { name: post.title }])}
        <h1>${escapeHtml(post.title)}</h1>
        ${post.description ? `<p class="page-hero-sub">${escapeHtml(post.description)}</p>` : ''}
        <p class="pe-meta">${metaLine}</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        ${heroImage ? `<figure class="pe-hero-img"><img src="${escapeHtml(heroImage)}" alt="${escapeHtml(post.titleFile.altText || post.title)}" loading="eager"></figure>` : ''}
        <article class="pe-article">
          ${renderToHtml(post.content, { config: opinlyConfig, marks: { link: renderLink }, onUnknown: () => {} })}
        </article>
        <p class="pe-disclaimer">This article is for general education and is not a substitute for advice from your dentist or physician. Please contact our office to discuss your own situation.</p>
      </div>
    </section>
${faqs.length ? `
    <section class="section bg-light">
      <div class="container">
        <div class="section-label">Common Questions</div>
        <h2 style="text-align:center;">Frequently Asked Questions</h2>
        <div class="pe-faq">
          ${faqs.map((f) => `<details><summary>${escapeHtml(f.question)}</summary><p>${escapeHtml(f.answer)}</p></details>`).join('\n          ')}
        </div>
      </div>
    </section>` : ''}

    <section class="section">
      <div class="container">
        <div class="section-label">Keep Reading</div>
        <h2>Patient Guides</h2>
        <div class="options-grid">${guideCards()}
        </div>
        <div class="pe-pager"><a class="btn btn-outline" href="${BLOG_PREFIX}">All patient education &rarr;</a></div>
      </div>
    </section>
${ctaSection}`;

  const schema = [
    buildBlogPostingJsonLd({
      title: post.title,
      description: post.description,
      content: post.content,
      firstPublishedAt: post.firstPublishedAt,
      modifiedAt: post.modifiedAt,
      author: post.author,
      imageFileKey: post.titleFile?.fileKey,
    }, opinlyConfig),
    buildBreadcrumbJsonLd([
      { name: 'Home', url: `${SITE_URL}/` },
      { name: SECTION_NAME, url: `${SITE_URL}${BLOG_PREFIX}` },
      { name: post.title, url: canonical },
    ]),
  ];
  if (faqs.length) schema.push(buildFaqJsonLd(faqs));

  return html(page(layout, {
    title: post.metaTitle || `${post.title} | ${SITE_NAME}`,
    description: post.metaDescription || meta.description || post.description,
    canonical,
    ogType: 'article',
    ogImage: heroImage || meta.ogImage,
    publishedTime: post.firstPublishedAt,
    modifiedTime: post.modifiedAt,
    schema,
    body,
  }));
}

function renderNotFound(layout, cache = CACHE_SHORT) {
  const body = `
    <section class="page-hero">
      <div class="container">
        ${breadcrumbHtml([{ name: 'Home', href: '/' }, { name: SECTION_NAME, href: BLOG_PREFIX }, { name: 'Not found' }])}
        <h1>Article Not Found</h1>
        <p class="page-hero-sub">We could not find that article. It may have moved. Browse all of our patient education below.</p>
        <div class="cta-actions"><a class="btn btn-primary btn-lg" href="${BLOG_PREFIX}">All Patient Education</a></div>
      </div>
    </section>`;
  const out = page(layout, {
    title: `Article Not Found | ${SITE_NAME}`,
    description: 'The article you were looking for could not be found.',
    canonical: `${SITE_URL}${BLOG_PREFIX}`,
    body,
  }).replace('content="index, follow,', 'content="noindex, follow,');
  return html(out, 404, cache);
}

async function renderSitemap(opinly) {
  let entries = [{ url: `${SITE_URL}${BLOG_PREFIX}`, lastModified: new Date() }];
  if (opinly) {
    try {
      const routes = await opinly.routes();
      // Only the index and individual articles exist on this site.
      const served = routes.filter((r) => r.type === 'post');
      entries = entries.concat(buildSitemapEntries(served, opinlyConfig));
    } catch (err) {
      console.error('Opinly routes() failed:', err);
    }
  }
  return new Response(toSitemapXml(entries), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', ...CACHE_OK },
  });
}

// ---------- handler ----------

export default async (req) => {
  const url = new URL(req.url);
  const rest = url.pathname.slice(BLOG_PREFIX.length).replace(/^\/+|\/+$/g, '');
  const opinly = getClient();

  if (rest === 'sitemap.xml') return renderSitemap(opinly);

  // Normalise /patient-education/ to /patient-education.
  if (rest === '' && url.pathname !== BLOG_PREFIX) {
    return Response.redirect(`${url.origin}${BLOG_PREFIX}${url.search}`, 301);
  }

  let layout;
  try {
    layout = await getLayout(url.origin);
  } catch (err) {
    console.error('Layout fetch failed:', err);
    return new Response('Patient Education is temporarily unavailable.', { status: 503 });
  }

  if (rest === '') return renderIndex(layout, opinly, url.searchParams.get('cursor'));
  if (rest.includes('/')) return renderNotFound(layout); // categories, authors, tags are not used on this site
  return renderPost(layout, opinly, rest);
};

export const config = {
  // Literal strings: Netlify reads this statically at build time.
  path: ["/patient-education", "/patient-education/*"],
};
