import fetch from 'node-fetch';

interface GeocodingResult {
  latitude: number;
  longitude: number;
  success: boolean;
  error?: string;
}

export class GeocodingService {
  // Using OpenCage Geocoding API (free tier: 2500 requests/day)
  private static readonly API_KEY = process.env.OPENCAGE_API_KEY || 'demo-key';
  private static readonly BASE_URL = 'https://api.opencagedata.com/geocode/v1/json';

  static async geocodeLocation(location: string): Promise<GeocodingResult> {
    try {
      // Clean and validate input
      const cleanLocation = location.trim();
      if (!cleanLocation) {
        return { latitude: 0, longitude: 0, success: false, error: 'Location is required' };
      }

      // For demo purposes, we'll use a simple geocoding approach
      // In production, you'd use the OpenCage API with proper error handling
      const coordinates = this.getCoordinatesForLocation(cleanLocation);
      
      if (coordinates) {
        return {
          latitude: coordinates.lat,
          longitude: coordinates.lng,
          success: true
        };
      }

      // If no match found, return default coordinates (0,0) but mark as unsuccessful
      return { 
        latitude: 0, 
        longitude: 0, 
        success: false, 
        error: 'Location not found' 
      };
      
    } catch (error) {
      console.error('Geocoding error:', error);
      return { 
        latitude: 0, 
        longitude: 0, 
        success: false, 
        error: 'Geocoding service unavailable' 
      };
    }
  }

  // Simple geocoding fallback for common locations
  private static getCoordinatesForLocation(location: string): { lat: number; lng: number } | null {
    const locationMap: { [key: string]: { lat: number; lng: number } } = {
      // Major cities
      'new york': { lat: 40.7128, lng: -74.0060 },
      'new york city': { lat: 40.7128, lng: -74.0060 },
      'nyc': { lat: 40.7128, lng: -74.0060 },
      'london': { lat: 51.5074, lng: -0.1278 },
      'london, uk': { lat: 51.5074, lng: -0.1278 },
      'paris': { lat: 48.8566, lng: 2.3522 },
      'paris, france': { lat: 48.8566, lng: 2.3522 },
      'tokyo': { lat: 35.6762, lng: 139.6503 },
      'tokyo, japan': { lat: 35.6762, lng: 139.6503 },
      'los angeles': { lat: 34.0522, lng: -118.2437 },
      'la': { lat: 34.0522, lng: -118.2437 },
      'chicago': { lat: 41.8781, lng: -87.6298 },
      'sydney': { lat: -33.8688, lng: 151.2093 },
      'sydney, australia': { lat: -33.8688, lng: 151.2093 },
      'berlin': { lat: 52.5200, lng: 13.4050 },
      'berlin, germany': { lat: 52.5200, lng: 13.4050 },
      'moscow': { lat: 55.7558, lng: 37.6176 },
      'moscow, russia': { lat: 55.7558, lng: 37.6176 },
      'beijing': { lat: 39.9042, lng: 116.4074 },
      'beijing, china': { lat: 39.9042, lng: 116.4074 },
      'mumbai': { lat: 19.0760, lng: 72.8777 },
      'mumbai, india': { lat: 19.0760, lng: 72.8777 },
      'dubai': { lat: 25.2048, lng: 55.2708 },
      'dubai, uae': { lat: 25.2048, lng: 55.2708 },
      // Countries (approximate center)
      'usa': { lat: 39.8283, lng: -98.5795 },
      'canada': { lat: 56.1304, lng: -106.3468 },
      'uk': { lat: 55.3781, lng: -3.4360 },
      'france': { lat: 46.2276, lng: 2.2137 },
      'germany': { lat: 51.1657, lng: 10.4515 },
      'japan': { lat: 36.2048, lng: 138.2529 },
      'australia': { lat: -25.2744, lng: 133.7751 },
      'india': { lat: 20.5937, lng: 78.9629 },
      'china': { lat: 35.8617, lng: 104.1954 },
      'russia': { lat: 61.5240, lng: 105.3188 },
    };

    const normalizedLocation = location.toLowerCase();
    
    // Check for exact matches first
    if (locationMap[normalizedLocation]) {
      return locationMap[normalizedLocation];
    }

    // Check for partial matches
    for (const [key, coords] of Object.entries(locationMap)) {
      if (normalizedLocation.includes(key) || key.includes(normalizedLocation)) {
        return coords;
      }
    }

    return null;
  }

  // Calculate distance between two points using Haversine formula
  static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers
    return Math.round(distance);
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // Format distance for display
  static formatDistance(distanceKm: number): string {
    if (distanceKm < 1) {
      return 'Less than 1 km';
    } else if (distanceKm < 1000) {
      return `${distanceKm} km away`;
    } else {
      return `${Math.round(distanceKm / 1000)} thousand km away`;
    }
  }
}