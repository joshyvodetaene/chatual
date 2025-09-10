export interface CityValidationResult {
  isValid: boolean;
  formattedAddress?: string;
  country?: string;
  administrativeArea?: string;
  locality?: string;
  latitude?: number;
  longitude?: number;
  message?: string;
  suggestion?: string;
}

const ALLOWED_COUNTRIES = ['Germany', 'Switzerland', 'Austria'];
const ALLOWED_COUNTRY_CODES = ['DE', 'CH', 'AT'];

export async function validateCity(cityName: string): Promise<CityValidationResult> {
  if (!cityName || cityName.trim().length === 0) {
    return {
      isValid: false,
      message: 'Please enter a city name'
    };
  }

  try {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key not found');
      return {
        isValid: false,
        message: 'City validation service unavailable'
      };
    }

    // Add country bias to improve results for German-speaking countries
    const query = encodeURIComponent(`${cityName.trim()}, Germany OR Switzerland OR Austria`);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}&region=de&language=en`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === 'ZERO_RESULTS') {
      return {
        isValid: false,
        message: 'City not found. Please check the spelling or try a different city.'
      };
    }

    if (data.status !== 'OK') {
      throw new Error(`Geocoding API error: ${data.status}`);
    }

    // Check if any result is in our allowed countries
    for (const result of data.results) {
      const countryComponent = result.address_components.find(
        (component: any) => component.types.includes('country')
      );

      if (countryComponent) {
        const isAllowedCountry = ALLOWED_COUNTRIES.includes(countryComponent.long_name) ||
                                ALLOWED_COUNTRY_CODES.includes(countryComponent.short_name);

        if (isAllowedCountry) {
          // Check if it's actually a city/locality
          const localityComponent = result.address_components.find(
            (component: any) => 
              component.types.includes('locality') || 
              component.types.includes('administrative_area_level_2') ||
              component.types.includes('administrative_area_level_3')
          );

          if (localityComponent) {
            return {
              isValid: true,
              formattedAddress: result.formatted_address,
              country: countryComponent.long_name,
              locality: localityComponent.long_name,
              latitude: result.geometry.location.lat,
              longitude: result.geometry.location.lng,
              message: `Valid city in ${countryComponent.long_name}`,
              suggestion: result.formatted_address
            };
          }
        }
      }
    }

    return {
      isValid: false,
      message: 'City not found in Germany, Switzerland, or Austria. Please enter a city from one of these countries.'
    };

  } catch (error) {
    console.error('City validation error:', error);
    return {
      isValid: false,
      message: 'Unable to validate city. Please try again later.'
    };
  }
}

export function getCityDisplayName(result: CityValidationResult): string {
  if (result.formattedAddress) {
    return result.formattedAddress;
  }
  
  if (result.locality && result.country) {
    return `${result.locality}, ${result.country}`;
  }
  
  return '';
}

export function isValidCountry(countryCode: string): boolean {
  return ALLOWED_COUNTRY_CODES.includes(countryCode.toUpperCase());
}