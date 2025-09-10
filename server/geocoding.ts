import fetch from 'node-fetch';

export interface GoogleMapsGeocodeResult {
  results: Array<{
    formatted_address: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
    address_components: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
  }>;
  status: string;
}

export interface CityValidationResult {
  isValid: boolean;
  suggestion?: string;
  country?: string;
  countryCode?: string;
  message?: string;
}

const DACH_COUNTRIES = ['DE', 'CH', 'AT'];
const COUNTRY_NAMES = {
  'DE': 'Germany',
  'CH': 'Switzerland',
  'AT': 'Austria'
};

/**
 * Validate if a city exists in Germany, Switzerland, or Austria using Google Maps Geocoding API
 */
export async function validateCityInDACH(cityName: string): Promise<CityValidationResult> {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.error('Google Maps API key not configured');
    return {
      isValid: false,
      message: 'City validation service is not available'
    };
  }

  try {
    // First, try to geocode the city name
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cityName)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(geocodeUrl);
    const data = await response.json() as GoogleMapsGeocodeResult;

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      return {
        isValid: false,
        message: `City "${cityName}" not found. Please check the spelling and try again.`
      };
    }

    // Check if any result is in a DACH country
    for (const result of data.results) {
      const countryComponent = result.address_components.find(
        component => component.types.includes('country')
      );

      if (countryComponent && DACH_COUNTRIES.includes(countryComponent.short_name)) {
        const localityComponent = result.address_components.find(
          component => component.types.includes('locality') || 
                      component.types.includes('administrative_area_level_2') ||
                      component.types.includes('administrative_area_level_1')
        );

        return {
          isValid: true,
          suggestion: localityComponent?.long_name || result.formatted_address,
          country: COUNTRY_NAMES[countryComponent.short_name as keyof typeof COUNTRY_NAMES],
          countryCode: countryComponent.short_name,
          message: `Found: ${localityComponent?.long_name || result.formatted_address} in ${COUNTRY_NAMES[countryComponent.short_name as keyof typeof COUNTRY_NAMES]}`
        };
      }
    }

    // If we found results but none in DACH countries
    const firstResult = data.results[0];
    const countryComponent = firstResult.address_components.find(
      component => component.types.includes('country')
    );

    return {
      isValid: false,
      message: `"${cityName}" was found in ${countryComponent?.long_name || 'another country'}, but only cities in Germany, Switzerland, and Austria are allowed.`
    };

  } catch (error) {
    console.error('Google Maps API error:', error);
    return {
      isValid: false,
      message: 'Unable to validate city. Please try again later.'
    };
  }
}