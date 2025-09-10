import type { CountryCode } from '@/data/cities';

export interface GeocodeResult {
  display_name: string;
  latitude: number;
  longitude: number;
  country_code: string;
  is_valid_dach_city: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  suggestion?: string;
  country?: string;
  message?: string;
}

/**
 * Validate if a city exists in Germany, Switzerland, or Austria using Google Maps Geocoding API
 */
export async function validateCityInDACH(cityName: string): Promise<ValidationResult> {
  if (!cityName.trim()) {
    return { isValid: false, message: 'Please enter a city name' };
  }

  try {
    const response = await fetch(`/api/geocode/validate?city=${encodeURIComponent(cityName)}`);
    
    if (!response.ok) {
      throw new Error('Failed to validate city');
    }

    const data = await response.json();
    
    return {
      isValid: data.isValid,
      suggestion: data.suggestion,
      country: data.country,
      message: data.message
    };
  } catch (error) {
    console.error('City validation error:', error);
    return { 
      isValid: false, 
      message: 'Unable to validate city. Please check your internet connection.' 
    };
  }
}

/**
 * Get country name from country code
 */
export function getCountryName(countryCode: string): string {
  const countryNames: Record<string, string> = {
    'DE': 'Germany',
    'CH': 'Switzerland', 
    'AT': 'Austria'
  };
  
  return countryNames[countryCode] || countryCode;
}