# Ludwig Mattsson static site

This folder is a static mirror of https://ludwigmattsson.com for GitHub Pages.

Deploy the contents of this directory as the site root. `index.html` is the entry point and local assets live under `assets/`.

This repo is prepared for the project Pages URL `https://ludwigmattsson.github.io/ludwig-mattsson/`. There is no `CNAME` file in this variant.

The original Framer analytics/editor URLs are intentionally left external or inactive because they are not needed for the public static site.

## Publish

Push the committed repo to GitHub:

```bash
cd "/Users/ludwigmattsson/Library/CloudStorage/OneDrive-ScaniaCV/Desktop/portfolio 2025/ludwig-mattsson-repo-ready"
git push origin main
```

Then check the repository Actions tab. The existing `.github/workflows/static.yml` workflow deploys the repo root to GitHub Pages. If the action says Pages is not configured, go to repository Settings > Pages and set Source to GitHub Actions.
