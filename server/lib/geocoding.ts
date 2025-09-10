interface GoogleGeocodingResponse {
  results: Array<{
    formatted_address: string;
    address_components: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  }>;
  status: string;
}

interface CityValidationResult {
  isValid: boolean;
  formattedAddress?: string;
  country?: string;
  countryCode?: string;
  administrativeArea?: string;
  locality?: string;
  latitude?: number;
  longitude?: number;
  message?: string;
}

export async function validateCityWithGoogle(
  cityName: string, 
  allowedCountryCodes: string[] = ['DE', 'CH', 'AT']
): Promise<CityValidationResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    throw new Error('Google Maps API key not configured');
  }

  try {
    // Geocode the city name
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', cityName);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('language', 'en');
    
    const response = await fetch(url.toString());
    const data: GoogleGeocodingResponse = await response.json();
    
    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      return {
        isValid: false,
        message: `City "${cityName}" not found. Please check the spelling or try a different city.`
      };
    }

    // Get the first result (most relevant)
    const result = data.results[0];
    
    // Extract address components
    let country = '';
    let countryCode = '';
    let administrativeArea = '';
    let locality = '';
    
    for (const component of result.address_components) {
      if (component.types.includes('country')) {
        country = component.long_name;
        countryCode = component.short_name;
      } else if (component.types.includes('administrative_area_level_1')) {
        administrativeArea = component.long_name;
      } else if (component.types.includes('locality')) {
        locality = component.long_name;
      }
    }
    
    // Check if the city is in one of the allowed countries
    if (!allowedCountryCodes.includes(countryCode)) {
      const allowedCountryNames = allowedCountryCodes.map(code => {
        switch (code) {
          case 'DE': return 'Germany';
          case 'CH': return 'Switzerland';  
          case 'AT': return 'Austria';
          default: return code;
        }
      }).join(', ');
      
      return {
        isValid: false,
        formattedAddress: result.formatted_address,
        country,
        countryCode,
        administrativeArea,
        locality,
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        message: `"${cityName}" is located in ${country}, but we only accept cities from ${allowedCountryNames}.`
      };
    }

    return {
      isValid: true,
      formattedAddress: result.formatted_address,
      country,
      countryCode,
      administrativeArea,
      locality,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      message: `✓ Valid city: ${result.formatted_address}`
    };
    
  } catch (error: any) {
    console.error('Google Geocoding API error:', error);
    return {
      isValid: false,
      message: 'Unable to validate city due to a technical error. Please try again later.'
    };
  }
}