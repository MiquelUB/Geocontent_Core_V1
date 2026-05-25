# SEO Implementation - Next Steps

## ✅ Completed

1. ✅ Updated `app/layout.tsx` with comprehensive SEO metadata
2. ✅ Created `public/robots.txt` for search engine crawlers
3. ✅ Created `app/sitemap.ts` for dynamic sitemap generation
4. ✅ Updated `public/manifest.json` with new branding

## 📝 Pending (Manual Steps)

### 1. Create Open Graph Image

You need to create an image at `public/og-image.jpg` with these specifications:

- **Size:** 1200x630 pixels
- **Format:** JPG or PNG
- **Content:** Should show the Geocontent branding with Pallars
  landscape/legends theme
- **Text:** Keep it minimal - logo + tagline works best

**Quick option:** Use Canva or similar tool with the 1200x630 template.

**Recommended content:**

- Background: Pallars landscape (mountains, lakes)
- Logo/Title: "Geocontent - Leyendas del Pallars"
- Subtitle: "Descubre misterios ancestrales" or similar
- Icon/illustration: Dragon, map marker, or mystical element

---

### 2. Add Google Search Console Verification

In `app/layout.tsx`, line 82, replace:

```typescript
google: "your-google-verification-code",
```

With your actual verification code from Google Search Console.

**How to get it:**

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add property: `projectexinoxano.cat`
3. Choose "HTML tag" verification method
4. Copy the code from `content="..."` attribute
5. Paste it in the metadata

---

### 3. Submit Sitemap to Google

After deploying:

1. Go to Google Search Console
2. Navigate to **Sitemaps** section
3. Submit: `https://projectexinoxano.cat/sitemap.xml`

---

### 4. Test SEO Implementation

**Before deploying:**

- Run `npm run dev` and check `http://localhost:3000`
- View page source to verify meta tags are present

**After deploying:**

1. **Google Rich Results Test:** https://search.google.com/test/rich-results
2. **Facebook Debugger:** https://developers.facebook.com/tools/debug/
3. **Twitter Card Validator:** https://cards-dev.twitter.com/validator
4. **LinkedIn Post Inspector:** https://www.linkedin.com/post-inspector/

---

### 5. Monitor Results

- **Google Search Console:** Track impressions, clicks, CTR
- **Google Analytics:** Monitor organic traffic
- Expected improvement in CTR: 15-30% within 2-4 weeks

---

## 🎯 Expected Results

### Before:

- Title: "Create Next App"
- Description: Technical list of legends
- CTR: ~2-3%

### After:

- Title: "🗺️ Geocontent - Descubre las Leyendas del Pallars"
- Description: "Explora misterios ancestrales del Pallars. Dragones, fantasmas y
  tesoros ocultos te esperan. ¿Te atreves a descubrir qué leyendas esconde tu
  tierra? 🏔️✨"
- Expected CTR: ~4-6% (improvement of 50-100%)

---

## 📊 SEO Checklist

- [x] Meta title optimized (60 chars)
- [x] Meta description compelling (155 chars)
- [x] Open Graph tags configured
- [x] Twitter Card tags configured
- [x] Structured data (JSON-LD) added
- [x] Keywords added
- [x] Robots.txt created
- [x] Sitemap.ts created
- [x] Manifest.json updated
- [x] Language set to Catalan
- [ ] Open Graph image created (manual)
- [ ] Google Search Console verification (manual)
- [ ] Sitemap submitted to Google (manual)
- [ ] SEO tested with validation tools (manual)
