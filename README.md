# Ludwig Mattsson Portfolio

Astro portfolio with Pages CMS content editing and a static GitHub Pages deploy.

## Structure

- `src/pages` contains the public routes.
- `src/components` contains reusable rendering components.
- `src/content/projects` contains project content for Pages CMS.
- `src/content/site.json` contains site-wide info page and footer content.
- `assets/framerusercontent.com/images` contains the curated image library used by the site.
- `.pages.yml` configures Pages CMS.
- `.github/workflows/static.yml` builds and deploys `dist` to GitHub Pages.

## Commands

```bash
npm ci
npm run dev
npm run build
npm run preview:dist
npm run verify
```

`npm run build` copies only assets referenced by the generated site into `dist`, which keeps the GitHub Pages artifact smaller and avoids publishing unused Framer export files.

## Design Rule

Technical changes should preserve the current visual design. Do not change typography, spacing, image crops, layout rhythm, navigation, or project ordering unless the change is explicitly a design task.
