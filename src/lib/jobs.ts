import data from '../data/jobs.json';

export type JobType = 'job' | 'internship' | 'research';

export interface Job {
  title: string;
  domain: string;
  type: JobType;
  country?: string;
  city?: string;
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
  jobs: Job[];
}

export interface Source {
  title: string;
  author: string;
  publisher: string;
  totalAdvertised: number;
}

export interface JobListing extends Job {
  company: Company;
  id: string;
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
    effectiveCountry: job.country ?? company.country,
    effectiveCity: job.city ?? company.city,
    effectiveApplyUrl: job.applyUrl ?? company.applyUrl,
  }))
);

export const COUNTRIES: Record<string, { name: string; flag: string }> = {
  FR: { name: 'France', flag: '🇫🇷' },
  GB: { name: 'United Kingdom', flag: '🇬🇧' },
  ES: { name: 'Spain', flag: '🇪🇸' },
  NL: { name: 'Netherlands', flag: '🇳🇱' },
  US: { name: 'United States', flag: '🇺🇸' },
  IN: { name: 'India', flag: '🇮🇳' },
  SG: { name: 'Singapore', flag: '🇸🇬' },
  FI: { name: 'Finland', flag: '🇫🇮' },
  SE: { name: 'Sweden', flag: '🇸🇪' },
  NO: { name: 'Norway', flag: '🇳🇴' },
  BE: { name: 'Belgium', flag: '🇧🇪' },
  DE: { name: 'Germany', flag: '🇩🇪' },
  CN: { name: 'China', flag: '🇨🇳' },
};

export function countryLabel(code: string): string {
  return COUNTRIES[code]?.name ?? code;
}

export function countryFlag(code: string): string {
  return COUNTRIES[code]?.flag ?? '';
}

export function uniqueCountries(): string[] {
  const set = new Set<string>();
  for (const listing of allListings) set.add(listing.effectiveCountry);
  return [...set].sort((a, b) => countryLabel(a).localeCompare(countryLabel(b)));
}

export function uniqueDomains(): string[] {
  return [...new Set(allListings.map((l) => l.domain))].sort();
}

export function uniqueTypes(): JobType[] {
  return [...new Set(allListings.map((l) => l.type))] as JobType[];
}

export function typeLabel(type: JobType): string {
  return { job: 'Job', internship: 'Internship', research: 'Research' }[type];
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
