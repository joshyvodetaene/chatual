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
 * Validates a city using the backend API
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
    // Use the backend endpoint for city validation
    const response = await fetch(`/api/geocode/validate?city=${encodeURIComponent(cityName.trim())}`);
    const data = await response.json();

    if (!response.ok) {
      return {
        isValid: false,
        error: data.message || 'Unable to validate city'
      };
    }

    // Map the backend response to our frontend interface
    if (data.isValid) {
      return {
        isValid: true,
        formattedAddress: data.suggestion || data.formattedAddress,
        city: data.suggestion || cityName,
        country: data.country,
        countryCode: data.countryCode,
        latitude: data.latitude,
        longitude: data.longitude
      };
    } else {
      return {
        isValid: false,
        error: data.message || 'City not found'
      };
    }

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