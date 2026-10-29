// Build-time map: projects real coastlines (Natural Earth via world-atlas)
// and the hiring cities, so the page ships a static SVG with no runtime library.
import { geoConicConformal, geoGraticule10, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import countries50m from 'world-atlas/countries-50m.json';
import { allListings } from './jobs';

export const MAP_WIDTH = 800;
export const MAP_HEIGHT = 720;

/** Map pins: a pin groups several listing cities that sit a few km apart. */
const PORTS: Record<string, { coords: [number, number]; side: 'left' | 'right' }> = {
  Nantes: { coords: [-1.553, 47.218], side: 'right' },
  'Saint-Nazaire': { coords: [-2.214, 47.273], side: 'left' },
  'La Rochelle': { coords: [-1.151, 46.16], side: 'left' },
  'La Teste-de-Buch': { coords: [-1.146, 44.633], side: 'left' },
  Bordeaux: { coords: [-0.579, 44.838], side: 'right' },
  Brest: { coords: [-4.486, 48.39], side: 'left' },
  Auray: { coords: [-2.98, 47.668], side: 'left' },
  Etel: { coords: [-3.2, 47.657], side: 'left' },
  Caen: { coords: [-0.371, 49.183], side: 'right' },
  'Le Havre': { coords: [0.108, 49.494], side: 'left' },
  Paris: { coords: [2.352, 48.857], side: 'right' },
  Marseille: { coords: [5.37, 43.296], side: 'right' },
  Barcelona: { coords: [2.173, 41.385], side: 'right' },
  London: { coords: [-0.128, 51.507], side: 'right' },
  Birmingham: { coords: [-1.89, 52.486], side: 'left' },
  Ghent: { coords: [3.717, 51.054], side: 'left' },
  Zeewolde: { coords: [5.541, 52.33], side: 'right' },
  Cologne: { coords: [6.96, 50.938], side: 'right' },
  Hamburg: { coords: [9.993, 53.551], side: 'right' },
  Aarhus: { coords: [10.203, 56.163], side: 'left' },
  Copenhagen: { coords: [12.568, 55.676], side: 'left' },
  Landskrona: { coords: [12.83, 55.871], side: 'right' },
};

/** Listing city → map pin. Cities missing here are listed as "beyond the frame". */
const CITY_TO_PORT: Record<string, string> = {
  'Saint-Herblain': 'Nantes',
  Courbevoie: 'Paris',
  'La Défense': 'Paris',
  Talence: 'Bordeaux',
  'Sant Cugat del Vallès': 'Barcelona',
};

export function portOf(city: string): string | null {
  const port = CITY_TO_PORT[city] ?? city;
  return PORTS[port] ? port : null;
}

const projection = geoConicConformal()
  .parallels([44, 54])
  .rotate([-3.5, 0])
  .fitExtent(
    [
      [16, 16],
      [MAP_WIDTH - 16, MAP_HEIGHT - 16],
    ],
    {
      type: 'MultiPoint',
      coordinates: [
        [-5.5, 41.2],
        [13.5, 41.2],
        [13.5, 56.4],
        [-5.5, 56.4],
      ],
    }
  )
  .clipExtent([
    [0, 0],
    [MAP_WIDTH, MAP_HEIGHT],
  ]);

const path = geoPath(projection);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const topo = countries50m as any;
const round = (d: string | null) => (d ?? '').replace(/(\d+\.\d)\d+/g, '$1');

export const mapPaths = {
  graticule: round(path(geoGraticule10())),
  land: round(path(feature(topo, topo.objects.land as never) as never)),
  borders: round(path(mesh(topo, topo.objects.countries as never, (a, b) => a !== b) as never)),
};

export interface MapPin {
  port: string;
  x: number; // % of map width
  y: number; // % of map height
  side: 'left' | 'right';
  total: number;
}

const totals = new Map<string, number>();
for (const l of allListings) {
  const port = portOf(l.effectiveCity);
  if (port) totals.set(port, (totals.get(port) ?? 0) + 1);
}

export const pins: MapPin[] = [...totals.entries()]
  .map(([port, total]) => {
    const [x, y] = projection(PORTS[port].coords) ?? [0, 0];
    return {
      port,
      x: +((x / MAP_WIDTH) * 100).toFixed(2),
      y: +((y / MAP_HEIGHT) * 100).toFixed(2),
      side: PORTS[port].side,
      total,
    };
  })
  // Small pins last so they stay clickable on top of big ones.
  .sort((a, b) => b.total - a.total);

export const onMapCount = [...totals.values()].reduce((a, b) => a + b, 0);

/** Cities outside the map frame, with their opening counts. */
export const offMap: { city: string; total: number }[] = (() => {
  const counts = new Map<string, number>();
  for (const l of allListings) {
    if (!portOf(l.effectiveCity)) counts.set(l.effectiveCity, (counts.get(l.effectiveCity) ?? 0) + 1);
  }
  return [...counts.entries()].map(([city, total]) => ({ city, total })).sort((a, b) => b.total - a.total);
})();
