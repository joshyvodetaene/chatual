interface GeocodeResult {
  latitude: number;
  longitude: number;
  display_name: string;
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
}

export async function geocodeLocation(locationText: string): Promise<GeocodeResult | null> {
  if (!locationText || locationText.trim().length === 0) {
    return null;
  }

  try {
    // Use Nominatim (OpenStreetMap) geocoding service - free and no API key required
    const encodedLocation = encodeURIComponent(locationText.trim());
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedLocation}&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Chatual-App/1.0 (https://chatual.app)', // Required by Nominatim
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Geocoding request failed: ${response.status}`);
    }

    const data: NominatimResponse[] = await response.json();

    if (data.length === 0) {
      return null; // No results found
    }

    const result = data[0];
    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      display_name: result.display_name,
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

export function isValidCoordinates(lat: string | number, lng: string | number): boolean {
  const latitude = typeof lat === 'string' ? parseFloat(lat) : lat;
  const longitude = typeof lng === 'string' ? parseFloat(lng) : lng;
  
  return (
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}