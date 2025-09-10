/**
 * Google Maps Geocoding API integration for city validation
 * Validates cities in Germany, Switzerland, and Austria
 */

import { searchCities } from './city-data-service';

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
 * Get city suggestions for autocomplete using comprehensive city data
 * Searches through cities in Germany, Austria, and Switzerland
 */
export async function getCitySuggestions(query: string): Promise<string[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  try {
    // Use the local city data service to search for cities
    const citySuggestions = await searchCities(query.trim(), 10);
    
    // Return just the city names for the autocomplete
    return citySuggestions.map(city => city.name);
  } catch (error) {
    console.error('Error getting city suggestions:', error);
    
    // Fallback to a small set of popular cities if the service fails
    const fallbackCities = [
      'Berlin', 'Munich', 'Hamburg', 'Vienna', 'Zurich', 'Geneva', 'Basel', 'Salzburg', 'Graz', 'Innsbruck'
    ];
    
    const normalizedQuery = query.toLowerCase().trim();
    return fallbackCities
      .filter(city => city.toLowerCase().includes(normalizedQuery))
      .slice(0, 5);
  }
}