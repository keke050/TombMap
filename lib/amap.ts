export type AmapNavMode = 'car' | 'walk' | 'bus' | 'ride';

export function buildAmapNavigationUrl(input: {
  lat: number;
  lng: number;
  name?: string | null;
  mode?: AmapNavMode;
  source?: string;
}) {
  const mode: AmapNavMode = input.mode ?? 'car';
  const source = (input.source ?? 'CombMap').trim() || 'CombMap';
  const name = (input.name ?? '').trim();

  const url = new URL('https://uri.amap.com/navigation');
  url.searchParams.set('to', `${input.lng},${input.lat}${name ? `,${name}` : ''}`);
  url.searchParams.set('mode', mode);
  url.searchParams.set('policy', '1');
  url.searchParams.set('src', source);
  url.searchParams.set('coordinate', 'gaode');
  url.searchParams.set('callnative', '1');
  return url.toString();
}

