---
name: refresh-jobs
description: Re-crawl the careers pages of every company in src/data/jobs.json to find new openings and openings that have closed, show a review table (new / expired / still open / not checked), and only after the user approves, update jobs.json. Use when the user asks to refresh, re-crawl, update or check the job listings.
---

# Refresh the job listings

Goal: compare what each company's careers page shows **today** with `src/data/jobs.json`,
show the differences in tables, and change `jobs.json` only once the user approves.

All files below are relative to the project root (`/home/guillaume/www/maritime`).

## 1. Prepare

1. Read `src/data/jobs.json`. For each company, note `slug`, `name`, `city`, `country`,
   `category`, `website`, `applyUrl`, any per-job `applyUrl`, and the current job titles.
2. Read `sources.json` next to this file: for each company it gives the job-list page found in
   earlier crawls (`listUrl`), how to read it (`kind`), the wording of closed postings
   (`closedText`), search `keywords` for large groups, and `notes`. Pass each company's entry
   to its subagent. A company missing from it is new: the subagent finds its source.
3. Pick the crawl folder: `.crawl/<YYYY-MM-DD>/` (today's date). It is gitignored. The crawl
   file is `.crawl/<YYYY-MM-DD>/crawl.json`.

## 2. Crawl in parallel

Split the companies into batches of about 6 and launch one `general-purpose` subagent per
batch **in a single message**, so they run at the same time. Give each subagent the batch
(every field above plus the current titles) and the brief below, word for word.

> **Brief for each crawl subagent**
>
> For each company, find the list of openings it advertises **today** and return one JSON
> object per company. Use WebFetch (and WebSearch when a page cannot be read).
>
> Where to look, in order:
> 0. The company's `sources` entry, when given: start from `listUrl` and follow its `kind`
>    (`html`: fetch it; `js`: the page needs a browser, search for another readable copy;
>    `api`: call the endpoint as described in `notes`; `rss`: replace the keywords;
>    `postings`: open each posting URL; `none`: no public list, report `unverifiable` unless
>    you find a real source). A posting showing `closedText` is closed.
> 1. Every per-job `applyUrl`, then the company `applyUrl`.
> 2. If that is a LinkedIn post or company page, a `mailto:` link, or a page with no job list,
>    try the company website's careers page: `/careers`, `/jobs`, `/carrieres`, `/carriere`,
>    `/recrutement`, `/emploi`, `/join-us`, or a link in the site footer.
> 3. Job platforms are fine to read: Welcome to the Jungle, Teamtailor, Workday, BambooHR
>    (`<sub>.bamboohr.com/careers/list` returns JSON), Zoho Recruit, WeRecruit, Lever,
>    Greenhouse (`boards-api.greenhouse.io/v1/boards/<company>/jobs`), Recruitee, Jobteaser.
> 4. If the page is rendered by JavaScript and comes back empty, search the web for
>    `"<company name>" careers` or `site:<domain> jobs`, then fetch what you find.
>
> Large groups (Maersk, CMA CGM, Bureau Veritas, Royal Caribbean, Bpifrance, TotalEnergies,
> DGAMPA and similar): do not list their whole job board. Check whether **each listed
> posting** is still open, and only add new roles that are clearly in scope: maritime
> decarbonization, wind-assisted propulsion, energy efficiency, vessel performance, alternative
> marine fuels, maritime sustainability.
>
> Status rules, be strict:
> - `"ok"`: you saw the company's current list of openings (or, for a large group, every
>   listed posting's page) and are confident it is complete. `jobs` holds **every** opening
>   in scope you found, including ones that are already in our list. A posting page that says
>   closed, expired, "no longer accepting applications", or returns 404 means that opening is
>   gone: leave it out of `jobs`.
> - `"unverifiable"`: login wall (LinkedIn), JavaScript page you could not read, only a
>   social post, or anything you are not confident about. Explain why in `reason`.
> - `"unreachable"`: the site is down or every URL failed. Give the error in `reason`.
>
> Never guess or invent a title. Copy titles as written on the site, without "(F/H)", "H/F",
> "F/M" and similar suffixes. Put contract or practical details in `note` (for example "CDI",
> "CDD", "Hybrid", "Ref. 2026-2235", "6 months").
>
> For each job, set:
> - `type`: `"job"` (permanent or fixed-term), `"internship"` (internship, apprenticeship,
>   alternance, thesis), or `"research"` (PhD, post-doc).
> - `domain`: one of `Engineering`, `Business`, `Data & AI`, `Software`, `Consulting`,
>   `Operations`, `Research`.
> - `city` and `country` (ISO 2-letter code) when they differ from the company's.
> - `url`: the direct posting URL when there is one.
>
> Return **only** a JSON array, one object per company in your batch:
>
> ```json
> [
>   {
>     "slug": "airseas",
>     "status": "ok",
>     "sourceUrl": "https://careers.werecruit.io/fr/airseas",
>     "jobs": [
>       { "title": "Projeteur électrique", "type": "job", "domain": "Engineering", "note": "CDI", "url": "https://…" }
>     ]
>   },
>   { "slug": "bluefins", "status": "unverifiable", "sourceUrl": "https://www.linkedin.com/…", "reason": "LinkedIn post, login wall", "jobs": [] }
> ]
> ```

## 3. Merge and compare

1. Merge every subagent's array into one file and write it with the Write tool:
   `{"crawledAt": "<now, ISO 8601>", "companies": [ …all objects… ]}` at `.crawl/<date>/crawl.json`.
   Check that every slug from `jobs.json` is present; add `{"slug": "…", "status": "unreachable",
   "reason": "subagent returned nothing", "jobs": []}` for any that is missing.
2. Run:
   ```bash
   node scripts/crawl-diff.mjs .crawl/<date>/crawl.json
   ```
   It prints Markdown tables: a summary per company, **new offers**, **expired offers**,
   offers matched on a different wording (to double-check), and companies **not checked**.
   It does not change anything.

## 4. Show the report and ask

Paste the script's tables into your reply as they are (they render as Markdown), then add at
most three short lines: anything surprising, for example a company whose list came back empty,
a suspicious match, or a site that blocked the crawl.

Then ask the user with AskUserQuestion what to apply:
- **Apply everything (Recommended)**: add the new offers and remove the expired ones.
- **Only add the new offers**: keep the expired ones in place.
- **Change nothing**: stop here.

The user may also want to drop specific lines. Edit the crawl file to match (remove a found job
to treat it as expired, add one back to keep it, or set a company's `status` to `"skip"` to
leave it untouched), then run the report again and show it before applying.

Do not edit `jobs.json` before the user answers.

## 5. Apply

```bash
node scripts/crawl-diff.mjs .crawl/<date>/crawl.json --apply                  # everything
node scripts/crawl-diff.mjs .crawl/<date>/crawl.json --apply --keep-expired   # only add new offers
```

The script only touches companies with status `ok`: it keeps the curated fields of offers that
are still open, removes expired offers, adds new ones, updates `source.totalAdvertised` and sets
`source.lastChecked`. Companies that were not checked stay exactly as they were.

Then:
1. Run `npm run build` and make sure it passes.
2. If a new offer is in a city that is not in `PORTS` in `src/lib/map.ts`, it shows under
   "Beyond the frame" on the map. Tell the user which cities, and offer to add pins for those
   that are inside the map frame (Bay of Biscay to Denmark).
3. Update `sources.json`: when a subagent read a better job-list page than the one recorded
   (its `sourceUrl` for a company with status `ok`), store it as `listUrl` with the right
   `kind`, and add anything learned to `notes` or `closedText`. Add an entry for every new
   company. Set `lastUpdated` to today.
4. Show `git diff --stat` and a one-line summary (for example "+6 new, −4 expired, 9 companies not checked").
5. Do not commit or push unless the user asks. Pushing to `main` deploys the site.
   When committing, include `.claude/skills/refresh-jobs/` but never `.claude/settings.local.json`.
