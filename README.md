# Velic Consulting Jobs

A browsable mirror of the October 2026 review **"Job Opportunities — Maritime
Decarbonization & Wind Propulsion"** by Christophe Brière de La Hosseraye
([Velic Consulting](https://www.linkedin.com/in/brierechristophe)).

115 openings across 36 organisations — wind propulsion, sail shipping,
routing, hydrogen, naval architecture — on a hiring map with search.

🌐 **Live site:** https://guillaume-cozic.github.io/jobs-velic/

## Stack

- [Astro 4](https://astro.build) — static site generator
- Data file: `src/data/jobs.json`
- Hiring map rendered at build time (`src/lib/map.ts`) from Natural Earth
  coastlines (`world-atlas`) with `d3-geo`; a city must be listed in `PORTS`
  there to get a pin, otherwise it shows under "Beyond the frame"
- Vanilla JS filtering, deployed to GitHub Pages

## Local development

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # outputs dist/
```

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml` which builds the site
and publishes it to GitHub Pages.

## Credits

Data © Christophe Brière de La Hosseraye / Velic Consulting. This is an
unofficial open-source mirror to make the listings more browsable.
For each opportunity, please verify the role on the company's official site.
