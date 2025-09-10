/**
 * Google Maps Geocoding API integration for city validation
 * Validates cities in Germany, Switzerland, and Austria
 */

export interface CityValidationResult {
  isValid: boolean;
  formattedAddress?: string;
  city?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  error?: string;
}

const ALLOWED_COUNTRIES = ['DE', 'CH', 'AT']; // Germany, Switzerland, Austria
const COUNTRY_NAMES = {
  'DE': 'Germany',
  'CH': 'Switzerland', 
  'AT': 'Austria'
};

/**
 * Validates a city using Google Maps Geocoding API
 * @param cityName The city name to validate
 * @returns Promise with validation result
 */
export async function validateCityWithGoogleMaps(cityName: string): Promise<CityValidationResult> {
  if (!cityName || cityName.trim().length === 0) {
    return {
      isValid: false,
      error: 'City name is required'
    };
  }

  try {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key not found');
      return {
        isValid: false,
        error: 'Geocoding service not available'
      };
    }

    // Construct the geocoding URL
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', cityName.trim());
    url.searchParams.set('key', apiKey);
    url.searchParams.set('region', 'eu'); // Bias towards Europe
    
    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === 'ZERO_RESULTS') {
      return {
        isValid: false,
        error: 'City not found'
      };
    }

    if (data.status !== 'OK') {
      console.error('Geocoding API error:', data.status, data.error_message);
      return {
        isValid: false,
        error: 'Unable to validate city at this time'
      };
    }

    // Check if any result is in our allowed countries
    for (const result of data.results) {
      const countryComponent = result.address_components?.find(
        (component: any) => component.types.includes('country')
      );

      if (countryComponent && ALLOWED_COUNTRIES.includes(countryComponent.short_name)) {
        // Extract city name
        const cityComponent = result.address_components?.find(
          (component: any) => 
            component.types.includes('locality') || 
            component.types.includes('administrative_area_level_2') ||
            component.types.includes('sublocality')
        );

        return {
          isValid: true,
          formattedAddress: result.formatted_address,
          city: cityComponent?.long_name || cityName,
          country: COUNTRY_NAMES[countryComponent.short_name as keyof typeof COUNTRY_NAMES],
          countryCode: countryComponent.short_name,
          latitude: result.geometry?.location?.lat,
          longitude: result.geometry?.location?.lng
        };
      }
    }

    // No results in allowed countries
    return {
      isValid: false,
      error: 'City must be in Germany, Switzerland, or Austria'
    };

  } catch (error) {
    console.error('Error validating city:', error);
    return {
      isValid: false,
      error: 'Unable to validate city. Please check your internet connection.'
    };
  }
}

/**
 * Get city suggestions for autocomplete
 * This is a simple implementation that could be enhanced with a proper autocomplete service
 */
export async function getCitySuggestions(query: string): Promise<string[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  // For now, return common cities that start with the query
  // In a real implementation, you might use Google Places Autocomplete API
  const commonCities = [
    // Germany
    'Berlin', 'Munich', 'Hamburg', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Dortmund', 'Essen',
    'Bremen', 'Dresden', 'Hanover', 'Nuremberg', 'Duisburg', 'Bochum', 'Wuppertal', 'Bielefeld', 'Bonn', 'Münster',
    
    // Switzerland  
    'Zurich', 'Geneva', 'Basel', 'Lausanne', 'Bern', 'Winterthur', 'Lucerne', 'St. Gallen', 'Lugano', 'Biel',
    'Thun', 'Köniz', 'La Chaux-de-Fonds', 'Schaffhausen', 'Fribourg', 'Vernier', 'Chur', 'Neuchâtel', 'Uster',
    
    // Austria
    'Vienna', 'Graz', 'Linz', 'Salzburg', 'Innsbruck', 'Klagenfurt', 'Villach', 'Wels', 'Sankt Pölten', 'Dornbirn',
    'Steyr', 'Wiener Neustadt', 'Feldkirch', 'Bregenz', 'Leonding', 'Klosterneuburg', 'Baden', 'Wolfsberg', 'Leoben'
  ];

  const normalizedQuery = query.toLowerCase().trim();
  return commonCities
    .filter(city => city.toLowerCase().startsWith(normalizedQuery))
    .slice(0, 10); // Limit to 10 suggestions
}