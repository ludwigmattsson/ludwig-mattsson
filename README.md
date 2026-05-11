# Ludwig Mattsson portfolio

This repo is an Astro rebuild of the Framer portfolio, wired for Pages CMS and GitHub Pages.

- Pages CMS config: `.pages.yml`
- Project content: `src/content/projects/*.md`
- Site settings: `src/content/site.json`
- Downloaded Framer media: `assets/`

The site is configured for the project Pages URL `https://ludwigmattsson.github.io/ludwig-mattsson/`. There is no `CNAME` file in this variant.

The Astro build creates real static project routes, so links like `/traton-design-system/` are generated as actual pages instead of depending on a Framer fallback.

## Local work

```bash
npm install
npm run dev
npm run build
```

The build copies the existing `assets/` folder into `dist/assets/` after Astro generates the pages.

## Pages CMS

Open `https://app.pagescms.org/`, sign in with GitHub, install/select this repository, then edit:

- `Projects` for portfolio entries, galleries, categories, and video embeds.
- `Site settings` for information page copy, clients, contact links, and recognition lists.

Saving in Pages CMS commits changes back to GitHub. The GitHub Actions workflow rebuilds and deploys the site.

## Publish

Push the committed repo to GitHub:

```bash
cd "/Users/ludwigmattsson/Library/CloudStorage/OneDrive-ScaniaCV/Desktop/portfolio 2025/ludwig-mattsson-repo-ready"
git push origin main
```

Then check the repository Actions tab. `.github/workflows/static.yml` runs `npm ci`, builds Astro, uploads `dist`, and deploys it to GitHub Pages. If the action says Pages is not configured, go to repository Settings > Pages and set Source to GitHub Actions.
