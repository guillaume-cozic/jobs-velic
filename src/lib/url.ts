const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function url(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${BASE}${clean}`;
}
