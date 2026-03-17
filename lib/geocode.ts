type GeoPoint = { lat: number; lng: number };

export const geocodeAddress = async (address: string, city?: string): Promise<GeoPoint | null> => {
  const key = process.env.AMAP_WEB_KEY;
  if (!key || !address) return null;

  const params = new URLSearchParams({
    key,
    address,
    city: city ?? ''
  });
  const url = `https://restapi.amap.com/v3/geocode/geo?${params.toString()}`;
  try {
    const response = await fetch(url, { next: { revalidate: 43200 } });
    if (!response.ok) return null;
    const data = (await response.json()) as any;
    if (data?.status !== '1') return null;
    const location = data?.geocodes?.[0]?.location;
    if (!location || typeof location !== 'string') return null;
    const [lng, lat] = location.split(',').map(Number);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
};
