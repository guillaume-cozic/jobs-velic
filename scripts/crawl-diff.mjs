#!/usr/bin/env node
// Compares a crawl result with src/data/jobs.json.
//
//   node scripts/crawl-diff.mjs <crawl.json>           print the report (Markdown tables)
//   node scripts/crawl-diff.mjs <crawl.json> --json    print the diff as JSON
//   node scripts/crawl-diff.mjs <crawl.json> --apply   write the changes into jobs.json
//   add --keep-expired to --apply to add new offers without removing expired ones
//
// Crawl file shape (written by the refresh-jobs skill):
// {
//   "crawledAt": "2026-11-02T10:00:00Z",
//   "companies": [
//     {
//       "slug": "airseas",
//       "status": "ok" | "unreachable" | "unverifiable" | "skip",
//       "sourceUrl": "https://…",            // page the list was read from
//       "reason": "LinkedIn login wall",     // when status is not ok
//       "jobs": [                            // every opening found, when status is ok
//         { "title": "…", "url": "…", "city": "…", "country": "FR",
//           "type": "job" | "internship" | "research", "domain": "Engineering", "note": "CDI" }
//       ]
//     }
//   ]
// }
// Only companies with status "ok" are compared and changed by --apply.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JOBS_FILE = path.join(ROOT, 'src/data/jobs.json');

const [crawlPath, mode, ...flags] = process.argv.slice(2);
const keepExpired = flags.includes('--keep-expired');
if (!crawlPath) {
  console.error('Usage: node scripts/crawl-diff.mjs <crawl.json> [--json|--apply]');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));
const crawl = JSON.parse(fs.readFileSync(crawlPath, 'utf8'));

// ---------- Title matching ----------

const NOISE = new Set([
  'f', 'h', 'm', 'x', 'fh', 'hf', 'fm', 'mf', 'hfx', 'fhx', 'cdi', 'cdd', 'stage', 'stagiaire',
  'internship', 'intern', 'alternance', 'apprentissage', 'apprenticeship', 'sta', 'alt', 'ref',
  'de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'pour', 'au', 'aux', 'un', 'une',
  'the', 'of', 'and', 'for', 'a', 'an', 'in', 'to', 'e', 'hybrid', 'remote',
]);

function tokens(title) {
  return new Set(
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\(e\)|·e|\.e\b/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((t) => t && !NOISE.has(t) && !/^\d{4,}$/.test(t))
  );
}

function similarity(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let common = 0;
  for (const t of A) if (B.has(t)) common++;
  const dice = (2 * common) / (A.size + B.size);
  // A short title fully contained in a longer one ("Chef de projet" vs "Chef de projet senior").
  const contained = common === Math.min(A.size, B.size) && common >= 2 ? 0.8 : 0;
  return Math.max(dice, contained);
}

const THRESHOLD = 0.6;

/** One-to-one greedy matching, best pairs first. */
function match(existing, found) {
  const pairs = [];
  existing.forEach((e, i) =>
    found.forEach((f, j) => {
      const s = similarity(e.title, f.title);
      // Same title as a CDI and as an internship: prefer the pair with the same contract type.
      const typePenalty = e.type && f.type && e.type !== f.type ? 0.05 : 0;
      if (s >= THRESHOLD) pairs.push({ i, j, s: s - typePenalty });
    })
  );
  pairs.sort((a, b) => b.s - a.s);
  const usedE = new Set();
  const usedF = new Set();
  const matched = [];
  for (const p of pairs) {
    if (usedE.has(p.i) || usedF.has(p.j)) continue;
    usedE.add(p.i);
    usedF.add(p.j);
    matched.push(p);
  }
  return {
    matched,
    expired: existing.map((e, i) => ({ e, i })).filter(({ i }) => !usedE.has(i)),
    added: found.map((f, j) => ({ f, j })).filter(({ j }) => !usedF.has(j)),
  };
}

// ---------- Diff ----------

const bySlug = new Map(crawl.companies.map((c) => [c.slug, c]));
const diff = data.companies.map((company) => {
  const c = bySlug.get(company.slug);
  if (!c) return { company, status: 'missing', reason: 'not in the crawl file' };
  if (c.status !== 'ok') return { company, status: c.status, reason: c.reason ?? '', sourceUrl: c.sourceUrl };
  const found = c.jobs ?? [];
  const m = match(company.jobs, found);
  return {
    company,
    status: 'ok',
    sourceUrl: c.sourceUrl,
    stillOpen: m.matched.map((p) => ({ existing: company.jobs[p.i], found: found[p.j], score: +p.s.toFixed(2) })),
    expired: m.expired.map(({ e }) => e),
    added: m.added.map(({ f }) => f),
  };
});

// ---------- Report ----------

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const link = (url, label = 'link') => (url ? `[${label}](${url})` : '');

function report() {
  const ok = diff.filter((d) => d.status === 'ok');
  const other = diff.filter((d) => d.status !== 'ok');
  const sum = (k) => ok.reduce((n, d) => n + d[k].length, 0);
  const out = [];

  out.push(`## Crawl of ${crawl.crawledAt?.slice(0, 10) ?? 'unknown date'}`, '');
  out.push(
    `Checked **${ok.length}/${diff.length}** companies · still open **${sum('stillOpen')}** · ` +
      `expired **${sum('expired')}** · new **${sum('added')}** · not checked **${other.length}**`,
    ''
  );

  out.push('### By company', '');
  out.push('| Company | Status | Still open | Expired | New | Source |', '|---|---|---:|---:|---:|---|');
  for (const d of diff) {
    const st = d.status === 'ok' ? 'checked' : d.status;
    const nums = d.status === 'ok' ? [d.stillOpen.length, d.expired.length, d.added.length] : ['—', '—', '—'];
    out.push(`| ${cell(d.company.name)} | ${st} | ${nums.join(' | ')} | ${link(d.sourceUrl)} |`);
  }
  out.push('');

  const added = ok.flatMap((d) => d.added.map((f) => ({ d, f })));
  out.push(`### New offers (${added.length})`, '');
  if (added.length) {
    out.push('| Company | Title | City | Type | Domain | Link |', '|---|---|---|---|---|---|');
    for (const { d, f } of added)
      out.push(`| ${cell(d.company.name)} | ${cell(f.title)} | ${cell(f.city ?? d.company.city)} | ${cell(f.type)} | ${cell(f.domain)} | ${link(f.url)} |`);
  } else out.push('_None._');
  out.push('');

  const expired = ok.flatMap((d) => d.expired.map((e) => ({ d, e })));
  out.push(`### Expired — no longer found on the source page (${expired.length})`, '');
  if (expired.length) {
    out.push('| Company | Title | Type |', '|---|---|---|');
    for (const { d, e } of expired) out.push(`| ${cell(d.company.name)} | ${cell(e.title)} | ${cell(e.type)} |`);
  } else out.push('_None._');
  out.push('');

  const fuzzy = ok.flatMap((d) => d.stillOpen.filter((s) => s.score < 1).map((s) => ({ d, s })));
  if (fuzzy.length) {
    out.push(`### Still open, matched on a different wording (${fuzzy.length}) — check these`, '');
    out.push('| Company | In jobs.json | On the site | Score |', '|---|---|---|---:|');
    for (const { d, s } of fuzzy)
      out.push(`| ${cell(d.company.name)} | ${cell(s.existing.title)} | ${cell(s.found.title)} | ${s.score} |`);
    out.push('');
  }

  if (other.length) {
    out.push(`### Not checked (${other.length}) — kept as they are`, '');
    out.push('| Company | Status | Reason |', '|---|---|---|');
    for (const d of other) out.push(`| ${cell(d.company.name)} | ${d.status} | ${cell(d.reason)} |`);
    out.push('');
  }
  return out.join('\n');
}

// ---------- Apply ----------

const JOB_KEYS = ['title', 'domain', 'type', 'city', 'country', 'note', 'applyUrl'];

function cleanJob(job, company) {
  const out = {};
  for (const k of JOB_KEYS) {
    const v = job[k];
    if (v === undefined || v === null || v === '') continue;
    if (k === 'city' && v === company.city) continue;
    if (k === 'country' && v === company.country) continue;
    if (k === 'applyUrl' && v === company.applyUrl) continue;
    out[k] = v;
  }
  return out;
}

function apply() {
  for (const d of diff) {
    if (d.status !== 'ok') continue;
    const company = d.company;
    const kept = d.stillOpen.map(({ existing, found }) =>
      // Keep our curated fields; take a direct posting URL when the crawl found one.
      cleanJob({ ...existing, applyUrl: existing.applyUrl ?? (found.url !== company.applyUrl ? found.url : undefined) }, company)
    );
    const added = d.added.map((f) =>
      cleanJob(
        {
          title: f.title,
          domain: f.domain ?? 'Business',
          type: f.type ?? 'job',
          city: f.city,
          country: f.country,
          note: f.note,
          applyUrl: f.url,
        },
        company
      )
    );
    const expired = keepExpired ? d.expired.map((e) => cleanJob(e, company)) : [];
    company.jobs = [...kept, ...expired, ...added];
    // The crawl lists every opening, so untitled ones from the review are no longer needed.
    if (!keepExpired) delete company.moreOpenings;
  }
  const total = data.companies.reduce((n, c) => n + c.jobs.length + (c.moreOpenings ?? 0), 0);
  data.source.totalAdvertised = total;
  data.source.lastChecked = (crawl.crawledAt ?? new Date().toISOString()).slice(0, 10);
  fs.writeFileSync(JOBS_FILE, format(data));
  console.log(`jobs.json updated: ${total} openings across ${data.companies.length} companies.`);
}

/** Same layout as the hand-written file: one job per line. */
function format(obj) {
  const json = JSON.stringify(obj, null, 2);
  return (
    json.replace(/"jobs": \[\n([\s\S]*?)\n {6}\]/g, (_, body) => {
      const jobs = JSON.parse(`[${body}]`);
      if (!jobs.length) return '"jobs": []';
      const lines = jobs.map((j) => '        ' + JSON.stringify(j).replace(/","/g, '", "').replace(/":"/g, '": "').replace(/^\{/, '{ ').replace(/\}$/, ' }'));
      return `"jobs": [\n${lines.join(',\n')}\n      ]`;
    }) + '\n'
  );
}

if (mode === '--apply') apply();
else if (mode === '--json') console.log(JSON.stringify(diff.map(({ company, ...rest }) => ({ slug: company.slug, ...rest })), null, 2));
else console.log(report());
