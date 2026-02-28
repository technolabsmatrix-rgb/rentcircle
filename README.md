# RentCircle 🛍️

India's #1 Rental Platform — Frontend + Admin Portal

## Project Structure

```
rentcircle/
├── index.html              # HTML entry point
├── vite.config.js          # Vite bundler config
├── vercel.json             # Vercel deploy config (SPA routing + headers)
├── netlify.toml            # Netlify deploy config (alternative)
├── package.json
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx            # React entry point
    ├── App.jsx             # Router (/ = frontend, /admin = admin)
    ├── index.css           # Global reset styles
    └── pages/
        ├── Frontend.jsx    # Public storefront
        ├── Admin.jsx       # Admin portal (login: admin@rentcircle.in / admin123)
        └── NotFound.jsx    # 404 page
```

**Routes:**
- `yourdomain.com/` → Public store (browse, rent, plans, about, contact)
- `yourdomain.com/admin` → Admin portal (products, tags, orders, analytics)

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start dev server
npm run dev
# Opens at http://localhost:5173
```

---

## Deploy to Vercel (Recommended)

### Option A — Vercel CLI (fastest)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy (run from project root)
vercel

# Follow prompts:
# - Link to your Vercel account
# - Project name: rentcircle
# - Framework: Vite (auto-detected)
# - Build command: npm run build  (auto-detected)
# - Output dir: dist  (auto-detected)

# Deploy to production
vercel --prod
```

### Option B — GitHub + Vercel Dashboard

1. Push this project to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/rentcircle.git
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Import your GitHub repo
4. Vercel auto-detects Vite — click **Deploy**
5. Done! You get a `.vercel.app` URL instantly

### Add Your Custom Domain on Vercel

1. Vercel Dashboard → Your Project → **Settings → Domains**
2. Click **Add Domain** → type `rentcircle.in` → **Add**
3. Also add `www.rentcircle.in`
4. Vercel shows you DNS records to add:

| Type | Name | Value |
|------|------|-------|
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |

5. Go to your domain registrar (GoDaddy / Namecheap / BigRock etc.) → DNS Settings → Add above records
6. Wait 10–30 mins → SSL auto-provisions ✅

---

## Deploy to Netlify (Alternative)

### Option A — Drag & Drop

```bash
npm run build
```
Go to [app.netlify.com/drop](https://app.netlify.com/drop) → drag your `/dist` folder → live in 30 seconds.

Then: **Site Settings → Domain Management → Add custom domain**

### Option B — GitHub + Netlify

1. Push to GitHub (same steps as above)
2. [netlify.com](https://netlify.com) → **Add new site → Import from Git**
3. Select repo → Build command: `npm run build` → Publish dir: `dist`
4. Click **Deploy site**

---

## Environment Variables (Optional)

If you add a backend later, create `.env`:
```
VITE_API_URL=https://api.rentcircle.in
VITE_RAZORPAY_KEY=rzp_live_xxxxxxxxxx
```

Access in code: `import.meta.env.VITE_API_URL`

Never commit `.env` to Git — it's in `.gitignore`.

---

## Admin Access

URL: `yourdomain.com/admin`

```
Email:    admin@rentcircle.in
Password: admin123
```

⚠️ Change these credentials before going live!

---

## Build for Production

```bash
npm run build
# Output in /dist — upload this folder anywhere
```

Preview the production build locally:
```bash
npm run preview
# Opens at http://localhost:4173
```
