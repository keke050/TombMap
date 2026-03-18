import { hasPreciseCoords } from '../utils';
import { seedTombs } from './data';

export type SeedMarker = {
  id: string;
  lat: number;
  lng: number;
  name?: string;
};

type SeedMarkerOptions = {
  includeExternal: boolean;
  hasCoords: boolean;
  limit: number;
};

export const listSeedMarkers = ({ includeExternal, hasCoords, limit }: SeedMarkerOptions): SeedMarker[] => {
  const markers: SeedMarker[] = [];
  const max = Math.max(1, limit);

  for (let index = 0; index < seedTombs.length; index += 1) {
    const tomb = seedTombs[index];
    if (!tomb) continue;

    if (!includeExternal && tomb.level === 'external') continue;

    const lat = tomb.lat;
    const lng = tomb.lng;
    if (lat == null || lng == null) continue;

    if (hasCoords && !hasPreciseCoords(tomb)) continue;

    const name = tomb.name?.trim() || undefined;
    markers.push({ id: tomb.id, lat, lng, name });

    if (markers.length >= max) break;
  }

  return markers;
};

