import data from '../data/jobs.json';

export type JobType = 'job' | 'internship' | 'research';

export interface Job {
  title: string;
  domain: string;
  type: JobType;
  country?: string;
  city?: string;
  note?: string;
  applyUrl?: string;
}

export interface Company {
  slug: string;
  name: string;
  country: string;
  city: string;
  category: string;
  description: string;
  website: string;
  applyUrl: string;
  /** Openings announced in the review without a title. */
  moreOpenings?: number;
  jobs: Job[];
}

export interface Source {
  title: string;
  edition: string;
  author: string;
  publisher: string;
  totalAdvertised: number;
}

export type SectorId = 'wind' | 'sail' | 'routing' | 'engineering' | 'shipping' | 'research';

export const SECTORS: { id: SectorId; label: string }[] = [
  { id: 'wind', label: 'Wind propulsion' },
  { id: 'sail', label: 'Sail shipping' },
  { id: 'routing', label: 'Routing & weather' },
  { id: 'engineering', label: 'Naval & propulsion engineering' },
  { id: 'shipping', label: 'Shipping, data & services' },
  { id: 'research', label: 'Research & public sector' },
];

const SECTOR_BY_CATEGORY: Record<string, SectorId> = {
  'Wind propulsion': 'wind',
  'Sail cargo operator': 'sail',
  'Sail shipping': 'sail',
  'Performance & routing': 'routing',
  'Weather & routing': 'routing',
  'Naval architecture': 'engineering',
  Shipbuilder: 'engineering',
  'Hydrogen propulsion': 'engineering',
  'Electric propulsion': 'engineering',
  'Propulsion technology': 'engineering',
  'Marine technology': 'engineering',
  'Shipping operator': 'shipping',
  'Maritime SaaS': 'shipping',
  'Offshore data & analytics': 'shipping',
  'Classification & consulting': 'shipping',
  Investment: 'shipping',
  'Academic / Research': 'research',
  'Public sector': 'research',
};

export function sectorOf(company: Company): SectorId {
  return SECTOR_BY_CATEGORY[company.category] ?? 'shipping';
}

export interface JobListing extends Job {
  company: Company;
  id: string;
  sector: SectorId;
  effectiveCountry: string;
  effectiveCity: string;
  effectiveApplyUrl: string;
}

export const source: Source = (data as { source: Source }).source;
export const companies: Company[] = (data as { companies: Company[] }).companies;

export const allListings: JobListing[] = companies.flatMap((company) =>
  company.jobs.map((job, idx) => ({
    ...job,
    company,
    id: `${company.slug}-${idx}`,
    sector: sectorOf(company),
    effectiveCountry: job.country ?? company.country,
    effectiveCity: job.city ?? company.city,
    effectiveApplyUrl: job.applyUrl ?? company.applyUrl,
  }))
);

export const COUNTRIES: Record<string, string> = {
  BE: 'Belgium',
  CN: 'China',
  DE: 'Germany',
  DK: 'Denmark',
  ES: 'Spain',
  FI: 'Finland',
  FR: 'France',
  GB: 'United Kingdom',
  IN: 'India',
  NL: 'Netherlands',
  NO: 'Norway',
  SE: 'Sweden',
  SG: 'Singapore',
  US: 'United States',
  VN: 'Vietnam',
};

export function countryLabel(code: string): string {
  return COUNTRIES[code] ?? code;
}

export function uniqueCountries(): string[] {
  return [...new Set(allListings.map((l) => l.effectiveCountry))];
}

export const DOMAINS = ['Engineering', 'Business', 'Data & AI', 'Software', 'Consulting', 'Operations', 'Research'];

export function typeLabel(type: JobType): string {
  return { job: 'Full-time', internship: 'Internship', research: 'Research' }[type];
}

export function jobsByType(company: Company) {
  return {
    jobs: company.jobs.filter((j) => j.type === 'job'),
    internships: company.jobs.filter((j) => j.type === 'internship'),
    research: company.jobs.filter((j) => j.type === 'research'),
  };
}

export function totalsByType() {
  const totals = { job: 0, internship: 0, research: 0 };
  for (const l of allListings) totals[l.type]++;
  return totals;
}
