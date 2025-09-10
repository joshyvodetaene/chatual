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
  
  // Google Maps API for distance calculations
  private static readonly GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
  private static readonly DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';

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

  // Comprehensive geocoding fallback for common locations
  private static getCoordinatesForLocation(location: string): { lat: number; lng: number } | null {
    const locationMap: { [key: string]: { lat: number; lng: number } } = {
      // Major US cities
      'new york': { lat: 40.7128, lng: -74.0060 },
      'new york city': { lat: 40.7128, lng: -74.0060 },
      'nyc': { lat: 40.7128, lng: -74.0060 },
      'manhattan': { lat: 40.7831, lng: -73.9712 },
      'brooklyn': { lat: 40.6782, lng: -73.9442 },
      'los angeles': { lat: 34.0522, lng: -118.2437 },
      'la': { lat: 34.0522, lng: -118.2437 },
      'chicago': { lat: 41.8781, lng: -87.6298 },
      'houston': { lat: 29.7604, lng: -95.3698 },
      'phoenix': { lat: 33.4484, lng: -112.0740 },
      'philadelphia': { lat: 39.9526, lng: -75.1652 },
      'san antonio': { lat: 29.4241, lng: -98.4936 },
      'san diego': { lat: 32.7157, lng: -117.1611 },
      'dallas': { lat: 32.7767, lng: -96.7970 },
      'san jose': { lat: 37.3382, lng: -121.8863 },
      'austin': { lat: 30.2672, lng: -97.7431 },
      'san francisco': { lat: 37.7749, lng: -122.4194 },
      'seattle': { lat: 47.6062, lng: -122.3321 },
      'denver': { lat: 39.7392, lng: -104.9903 },
      'washington': { lat: 38.9072, lng: -77.0369 },
      'boston': { lat: 42.3601, lng: -71.0589 },
      'detroit': { lat: 42.3314, lng: -83.0458 },
      'nashville': { lat: 36.1627, lng: -86.7816 },
      'memphis': { lat: 35.1495, lng: -90.0490 },
      'portland': { lat: 45.5152, lng: -122.6784 },
      'las vegas': { lat: 36.1699, lng: -115.1398 },
      'louisville': { lat: 38.2527, lng: -85.7585 },
      'baltimore': { lat: 39.2904, lng: -76.6122 },
      'milwaukee': { lat: 43.0389, lng: -87.9065 },
      'albuquerque': { lat: 35.0844, lng: -106.6504 },
      'tucson': { lat: 32.2226, lng: -110.9747 },
      'fresno': { lat: 36.7378, lng: -119.7871 },
      'sacramento': { lat: 38.5816, lng: -121.4944 },
      'mesa': { lat: 33.4152, lng: -111.8315 },
      'kansas city': { lat: 39.0997, lng: -94.5786 },
      'atlanta': { lat: 33.7490, lng: -84.3880 },
      'miami': { lat: 25.7617, lng: -80.1918 },
      'colorado springs': { lat: 38.8339, lng: -104.8214 },
      'raleigh': { lat: 35.7796, lng: -78.6382 },
      'omaha': { lat: 41.2565, lng: -95.9345 },
      'long beach': { lat: 33.7701, lng: -118.1937 },
      'virginia beach': { lat: 36.8529, lng: -75.9780 },
      'oakland': { lat: 37.8044, lng: -122.2711 },
      'minneapolis': { lat: 44.9778, lng: -93.2650 },
      'tulsa': { lat: 36.1540, lng: -95.9928 },
      'tampa': { lat: 27.9506, lng: -82.4572 },
      'arlington': { lat: 32.7357, lng: -97.1081 },
      'new orleans': { lat: 29.9511, lng: -90.0715 },
      'wichita': { lat: 37.6872, lng: -97.3301 },
      'cleveland': { lat: 41.4993, lng: -81.6944 },
      'bakersfield': { lat: 35.3733, lng: -119.0187 },
      'aurora': { lat: 39.7294, lng: -104.8319 },
      'anaheim': { lat: 33.8366, lng: -117.9143 },
      'honolulu': { lat: 21.3099, lng: -157.8581 },
      'santa ana': { lat: 33.7455, lng: -117.8677 },
      'corpus christi': { lat: 27.8006, lng: -97.3964 },
      'riverside': { lat: 33.9533, lng: -117.3962 },
      'lexington': { lat: 38.0406, lng: -84.5037 },
      'stockton': { lat: 37.9577, lng: -121.2908 },
      'st. paul': { lat: 44.9537, lng: -93.0900 },
      'cincinnati': { lat: 39.1031, lng: -84.5120 },
      'anchorage': { lat: 61.2181, lng: -149.9003 },
      'henderson': { lat: 36.0395, lng: -114.9817 },
      'greensboro': { lat: 36.0726, lng: -79.7920 },
      'plano': { lat: 33.0198, lng: -96.6989 },
      'newark': { lat: 40.7357, lng: -74.1724 },
      'lincoln': { lat: 40.8136, lng: -96.7026 },
      'toledo': { lat: 41.6528, lng: -83.5379 },
      'orlando': { lat: 28.5383, lng: -81.3792 },
      'chula vista': { lat: 32.6401, lng: -117.0842 },
      'jersey city': { lat: 40.7178, lng: -74.0431 },
      'chandler': { lat: 33.3062, lng: -111.8413 },
      'laredo': { lat: 27.5306, lng: -99.4803 },
      'madison': { lat: 43.0731, lng: -89.4012 },
      'lubbock': { lat: 33.5779, lng: -101.8552 },
      'winston-salem': { lat: 36.0999, lng: -80.2442 },
      'garland': { lat: 32.9126, lng: -96.6389 },
      'glendale': { lat: 33.5387, lng: -112.1860 },
      'hialeah': { lat: 25.8576, lng: -80.2781 },
      'reno': { lat: 39.5296, lng: -119.8138 },
      'baton rouge': { lat: 30.4515, lng: -91.1871 },
      'irvine': { lat: 33.6846, lng: -117.8265 },
      'chesapeake': { lat: 36.7682, lng: -76.2875 },
      'irving': { lat: 32.8140, lng: -96.9489 },
      'scottsdale': { lat: 33.4942, lng: -111.9261 },
      'north las vegas': { lat: 36.1989, lng: -115.1175 },
      'fremont': { lat: 37.5485, lng: -121.9886 },
      'gilbert': { lat: 33.3528, lng: -111.7890 },
      'san bernardino': { lat: 34.1083, lng: -117.2898 },
      'boise': { lat: 43.6150, lng: -116.2023 },
      'birmingham': { lat: 33.5186, lng: -86.8104 },

      // Major European cities
      'london': { lat: 51.5074, lng: -0.1278 },
      'london, uk': { lat: 51.5074, lng: -0.1278 },
      'london, england': { lat: 51.5074, lng: -0.1278 },
      'paris': { lat: 48.8566, lng: 2.3522 },
      'paris, france': { lat: 48.8566, lng: 2.3522 },
      'berlin': { lat: 52.5200, lng: 13.4050 },
      'berlin, germany': { lat: 52.5200, lng: 13.4050 },
      'madrid': { lat: 40.4168, lng: -3.7038 },
      'madrid, spain': { lat: 40.4168, lng: -3.7038 },
      'rome': { lat: 41.9028, lng: 12.4964 },
      'rome, italy': { lat: 41.9028, lng: 12.4964 },
      'amsterdam': { lat: 52.3676, lng: 4.9041 },
      'amsterdam, netherlands': { lat: 52.3676, lng: 4.9041 },
      'vienna': { lat: 48.2082, lng: 16.3738 },
      'vienna, austria': { lat: 48.2082, lng: 16.3738 },
      'brussels': { lat: 50.8503, lng: 4.3517 },
      'brussels, belgium': { lat: 50.8503, lng: 4.3517 },
      'zurich': { lat: 47.3769, lng: 8.5417 },
      'zurich, switzerland': { lat: 47.3769, lng: 8.5417 },
      'stockholm': { lat: 59.3293, lng: 18.0686 },
      'stockholm, sweden': { lat: 59.3293, lng: 18.0686 },
      'copenhagen': { lat: 55.6761, lng: 12.5683 },
      'copenhagen, denmark': { lat: 55.6761, lng: 12.5683 },
      'oslo': { lat: 59.9139, lng: 10.7522 },
      'oslo, norway': { lat: 59.9139, lng: 10.7522 },
      'helsinki': { lat: 60.1699, lng: 24.9384 },
      'helsinki, finland': { lat: 60.1699, lng: 24.9384 },
      'warsaw': { lat: 52.2297, lng: 21.0122 },
      'warsaw, poland': { lat: 52.2297, lng: 21.0122 },
      'prague': { lat: 50.0755, lng: 14.4378 },
      'prague, czech republic': { lat: 50.0755, lng: 14.4378 },
      'budapest': { lat: 47.4979, lng: 19.0402 },
      'budapest, hungary': { lat: 47.4979, lng: 19.0402 },
      'lisbon': { lat: 38.7223, lng: -9.1393 },
      'lisbon, portugal': { lat: 38.7223, lng: -9.1393 },
      'dublin': { lat: 53.3498, lng: -6.2603 },
      'dublin, ireland': { lat: 53.3498, lng: -6.2603 },
      'edinburgh': { lat: 55.9533, lng: -3.1883 },
      'edinburgh, scotland': { lat: 55.9533, lng: -3.1883 },
      'manchester': { lat: 53.4808, lng: -2.2426 },
      'manchester, uk': { lat: 53.4808, lng: -2.2426 },
      'birmingham': { lat: 52.4862, lng: -1.8904 },
      'birmingham, uk': { lat: 52.4862, lng: -1.8904 },
      'liverpool': { lat: 53.4084, lng: -2.9916 },
      'liverpool, uk': { lat: 53.4084, lng: -2.9916 },
      'glasgow': { lat: 55.8642, lng: -4.2518 },
      'glasgow, scotland': { lat: 55.8642, lng: -4.2518 },

      // Major Asian cities
      'tokyo': { lat: 35.6762, lng: 139.6503 },
      'tokyo, japan': { lat: 35.6762, lng: 139.6503 },
      'beijing': { lat: 39.9042, lng: 116.4074 },
      'beijing, china': { lat: 39.9042, lng: 116.4074 },
      'shanghai': { lat: 31.2304, lng: 121.4737 },
      'shanghai, china': { lat: 31.2304, lng: 121.4737 },
      'mumbai': { lat: 19.0760, lng: 72.8777 },
      'mumbai, india': { lat: 19.0760, lng: 72.8777 },
      'delhi': { lat: 28.7041, lng: 77.1025 },
      'delhi, india': { lat: 28.7041, lng: 77.1025 },
      'new delhi': { lat: 28.6139, lng: 77.2090 },
      'new delhi, india': { lat: 28.6139, lng: 77.2090 },
      'bangalore': { lat: 12.9716, lng: 77.5946 },
      'bangalore, india': { lat: 12.9716, lng: 77.5946 },
      'hyderabad': { lat: 17.3850, lng: 78.4867 },
      'hyderabad, india': { lat: 17.3850, lng: 78.4867 },
      'ahmedabad': { lat: 23.0225, lng: 72.5714 },
      'ahmedabad, india': { lat: 23.0225, lng: 72.5714 },
      'chennai': { lat: 13.0827, lng: 80.2707 },
      'chennai, india': { lat: 13.0827, lng: 80.2707 },
      'kolkata': { lat: 22.5726, lng: 88.3639 },
      'kolkata, india': { lat: 22.5726, lng: 88.3639 },
      'surat': { lat: 21.1702, lng: 72.8311 },
      'surat, india': { lat: 21.1702, lng: 72.8311 },
      'pune': { lat: 18.5204, lng: 73.8567 },
      'pune, india': { lat: 18.5204, lng: 73.8567 },
      'jaipur': { lat: 26.9124, lng: 75.7873 },
      'jaipur, india': { lat: 26.9124, lng: 75.7873 },
      'lucknow': { lat: 26.8467, lng: 80.9462 },
      'lucknow, india': { lat: 26.8467, lng: 80.9462 },
      'kanpur': { lat: 26.4499, lng: 80.3319 },
      'kanpur, india': { lat: 26.4499, lng: 80.3319 },
      'nagpur': { lat: 21.1458, lng: 79.0882 },
      'nagpur, india': { lat: 21.1458, lng: 79.0882 },
      'indore': { lat: 22.7196, lng: 75.8577 },
      'indore, india': { lat: 22.7196, lng: 75.8577 },
      'thane': { lat: 19.2183, lng: 72.9781 },
      'thane, india': { lat: 19.2183, lng: 72.9781 },
      'bhopal': { lat: 23.2599, lng: 77.4126 },
      'bhopal, india': { lat: 23.2599, lng: 77.4126 },
      'visakhapatnam': { lat: 17.6868, lng: 83.2185 },
      'visakhapatnam, india': { lat: 17.6868, lng: 83.2185 },
      'pimpri-chinchwad': { lat: 18.6298, lng: 73.7997 },
      'pimpri-chinchwad, india': { lat: 18.6298, lng: 73.7997 },
      'patna': { lat: 25.5941, lng: 85.1376 },
      'patna, india': { lat: 25.5941, lng: 85.1376 },
      'vadodara': { lat: 22.3072, lng: 73.1812 },
      'vadodara, india': { lat: 22.3072, lng: 73.1812 },
      'ghaziabad': { lat: 28.6692, lng: 77.4538 },
      'ghaziabad, india': { lat: 28.6692, lng: 77.4538 },
      'ludhiana': { lat: 30.9010, lng: 75.8573 },
      'ludhiana, india': { lat: 30.9010, lng: 75.8573 },
      'agra': { lat: 27.1767, lng: 78.0081 },
      'agra, india': { lat: 27.1767, lng: 78.0081 },
      'nashik': { lat: 19.9975, lng: 73.7898 },
      'nashik, india': { lat: 19.9975, lng: 73.7898 },
      'faridabad': { lat: 28.4089, lng: 77.3178 },
      'faridabad, india': { lat: 28.4089, lng: 77.3178 },
      'meerut': { lat: 28.9845, lng: 77.7064 },
      'meerut, india': { lat: 28.9845, lng: 77.7064 },
      'rajkot': { lat: 22.3039, lng: 70.8022 },
      'rajkot, india': { lat: 22.3039, lng: 70.8022 },
      'kalyan-dombivli': { lat: 19.2403, lng: 73.1305 },
      'kalyan-dombivli, india': { lat: 19.2403, lng: 73.1305 },
      'vasai-virar': { lat: 19.4912, lng: 72.8054 },
      'vasai-virar, india': { lat: 19.4912, lng: 72.8054 },
      'varanasi': { lat: 25.3176, lng: 82.9739 },
      'varanasi, india': { lat: 25.3176, lng: 82.9739 },
      'srinagar': { lat: 34.0837, lng: 74.7973 },
      'srinagar, india': { lat: 34.0837, lng: 74.7973 },
      'aurangabad': { lat: 19.8762, lng: 75.3433 },
      'aurangabad, india': { lat: 19.8762, lng: 75.3433 },
      'dhanbad': { lat: 23.7957, lng: 86.4304 },
      'dhanbad, india': { lat: 23.7957, lng: 86.4304 },
      'amritsar': { lat: 31.6340, lng: 74.8723 },
      'amritsar, india': { lat: 31.6340, lng: 74.8723 },
      'navi mumbai': { lat: 19.0330, lng: 73.0297 },
      'navi mumbai, india': { lat: 19.0330, lng: 73.0297 },
      'allahabad': { lat: 25.4358, lng: 81.8463 },
      'allahabad, india': { lat: 25.4358, lng: 81.8463 },
      'ranchi': { lat: 23.3441, lng: 85.3096 },
      'ranchi, india': { lat: 23.3441, lng: 85.3096 },
      'howrah': { lat: 22.5958, lng: 88.2636 },
      'howrah, india': { lat: 22.5958, lng: 88.2636 },
      'coimbatore': { lat: 11.0168, lng: 76.9558 },
      'coimbatore, india': { lat: 11.0168, lng: 76.9558 },
      'jabalpur': { lat: 23.1815, lng: 79.9864 },
      'jabalpur, india': { lat: 23.1815, lng: 79.9864 },
      'gwalior': { lat: 26.2183, lng: 78.1828 },
      'gwalior, india': { lat: 26.2183, lng: 78.1828 },
      'vijayawada': { lat: 16.5062, lng: 80.6480 },
      'vijayawada, india': { lat: 16.5062, lng: 80.6480 },
      'jodhpur': { lat: 26.2389, lng: 73.0243 },
      'jodhpur, india': { lat: 26.2389, lng: 73.0243 },
      'madurai': { lat: 9.9252, lng: 78.1198 },
      'madurai, india': { lat: 9.9252, lng: 78.1198 },
      'raipur': { lat: 21.2514, lng: 81.6296 },
      'raipur, india': { lat: 21.2514, lng: 81.6296 },
      'kota': { lat: 25.2138, lng: 75.8648 },
      'kota, india': { lat: 25.2138, lng: 75.8648 },
      'chandigarh': { lat: 30.7333, lng: 76.7794 },
      'chandigarh, india': { lat: 30.7333, lng: 76.7794 },
      'guwahati': { lat: 26.1445, lng: 91.7362 },
      'guwahati, india': { lat: 26.1445, lng: 91.7362 },
      'solapur': { lat: 17.6599, lng: 75.9064 },
      'solapur, india': { lat: 17.6599, lng: 75.9064 },
      'hubli-dharwad': { lat: 15.3647, lng: 75.1240 },
      'hubli-dharwad, india': { lat: 15.3647, lng: 75.1240 },
      'bareilly': { lat: 28.3670, lng: 79.4304 },
      'bareilly, india': { lat: 28.3670, lng: 79.4304 },
      'moradabad': { lat: 28.8386, lng: 78.7733 },
      'moradabad, india': { lat: 28.8386, lng: 78.7733 },
      'mysore': { lat: 12.2958, lng: 76.6394 },
      'mysore, india': { lat: 12.2958, lng: 76.6394 },
      'gurgaon': { lat: 28.4595, lng: 77.0266 },
      'gurgaon, india': { lat: 28.4595, lng: 77.0266 },
      'aligarh': { lat: 27.8974, lng: 78.0880 },
      'aligarh, india': { lat: 27.8974, lng: 78.0880 },
      'jalandhar': { lat: 31.3260, lng: 75.5762 },
      'jalandhar, india': { lat: 31.3260, lng: 75.5762 },
      'tiruchirappalli': { lat: 10.7905, lng: 78.7047 },
      'tiruchirappalli, india': { lat: 10.7905, lng: 78.7047 },
      'bhubaneswar': { lat: 20.2961, lng: 85.8245 },
      'bhubaneswar, india': { lat: 20.2961, lng: 85.8245 },
      'salem': { lat: 11.6643, lng: 78.1460 },
      'salem, india': { lat: 11.6643, lng: 78.1460 },
      'warangal': { lat: 17.9689, lng: 79.5941 },
      'warangal, india': { lat: 17.9689, lng: 79.5941 },
      'mira-bhayandar': { lat: 19.2952, lng: 72.8544 },
      'mira-bhayandar, india': { lat: 19.2952, lng: 72.8544 },
      'thiruvananthapuram': { lat: 8.5241, lng: 76.9366 },
      'thiruvananthapuram, india': { lat: 8.5241, lng: 76.9366 },
      'bhiwandi': { lat: 19.3002, lng: 73.0502 },
      'bhiwandi, india': { lat: 19.3002, lng: 73.0502 },
      'saharanpur': { lat: 29.9680, lng: 77.5552 },
      'saharanpur, india': { lat: 29.9680, lng: 77.5552 },
      'guntur': { lat: 16.3067, lng: 80.4365 },
      'guntur, india': { lat: 16.3067, lng: 80.4365 },
      'amravati': { lat: 20.9374, lng: 77.7796 },
      'amravati, india': { lat: 20.9374, lng: 77.7796 },
      'bikaner': { lat: 28.0229, lng: 73.3119 },
      'bikaner, india': { lat: 28.0229, lng: 73.3119 },
      'noida': { lat: 28.5355, lng: 77.3910 },
      'noida, india': { lat: 28.5355, lng: 77.3910 },
      'jamshedpur': { lat: 22.8046, lng: 86.2029 },
      'jamshedpur, india': { lat: 22.8046, lng: 86.2029 },
      'bhilai nagar': { lat: 21.1938, lng: 81.3509 },
      'bhilai nagar, india': { lat: 21.1938, lng: 81.3509 },
      'cuttack': { lat: 20.4625, lng: 85.8828 },
      'cuttack, india': { lat: 20.4625, lng: 85.8828 },
      'firozabad': { lat: 27.1592, lng: 78.3957 },
      'firozabad, india': { lat: 27.1592, lng: 78.3957 },
      'kochi': { lat: 9.9312, lng: 76.2673 },
      'kochi, india': { lat: 9.9312, lng: 76.2673 },
      'bhavnagar': { lat: 21.7645, lng: 72.1519 },
      'bhavnagar, india': { lat: 21.7645, lng: 72.1519 },
      'dehradun': { lat: 30.3165, lng: 78.0322 },
      'dehradun, india': { lat: 30.3165, lng: 78.0322 },
      'durgapur': { lat: 23.5204, lng: 87.3119 },
      'durgapur, india': { lat: 23.5204, lng: 87.3119 },
      'asansol': { lat: 23.6739, lng: 86.9524 },
      'asansol, india': { lat: 23.6739, lng: 86.9524 },
      'nanded': { lat: 19.1383, lng: 77.3210 },
      'nanded, india': { lat: 19.1383, lng: 77.3210 },
      'kolhapur': { lat: 16.7050, lng: 74.2433 },
      'kolhapur, india': { lat: 16.7050, lng: 74.2433 },
      'ajmer': { lat: 26.4499, lng: 74.6399 },
      'ajmer, india': { lat: 26.4499, lng: 74.6399 },
      'akola': { lat: 20.7002, lng: 77.0082 },
      'akola, india': { lat: 20.7002, lng: 77.0082 },
      'gulbarga': { lat: 17.3297, lng: 76.8343 },
      'gulbarga, india': { lat: 17.3297, lng: 76.8343 },
      'jamnagar': { lat: 22.4707, lng: 70.0577 },
      'jamnagar, india': { lat: 22.4707, lng: 70.0577 },
      'ujjain': { lat: 23.1765, lng: 75.7885 },
      'ujjain, india': { lat: 23.1765, lng: 75.7885 },
      'loni': { lat: 28.7594, lng: 77.2881 },
      'loni, india': { lat: 28.7594, lng: 77.2881 },
      'siliguri': { lat: 26.7271, lng: 88.3953 },
      'siliguri, india': { lat: 26.7271, lng: 88.3953 },
      'jhansi': { lat: 25.4484, lng: 78.5685 },
      'jhansi, india': { lat: 25.4484, lng: 78.5685 },
      'ulhasnagar': { lat: 19.2215, lng: 73.1645 },
      'ulhasnagar, india': { lat: 19.2215, lng: 73.1645 },
      'nellore': { lat: 14.4426, lng: 79.9865 },
      'nellore, india': { lat: 14.4426, lng: 79.9865 },
      'jammu': { lat: 32.7266, lng: 74.8570 },
      'jammu, india': { lat: 32.7266, lng: 74.8570 },
      'sangli-miraj & kupwad': { lat: 16.8524, lng: 74.5815 },
      'sangli-miraj & kupwad, india': { lat: 16.8524, lng: 74.5815 },
      'belgaum': { lat: 15.8497, lng: 74.4977 },
      'belgaum, india': { lat: 15.8497, lng: 74.4977 },
      'mangalore': { lat: 12.9141, lng: 74.8560 },
      'mangalore, india': { lat: 12.9141, lng: 74.8560 },
      'ambattur': { lat: 13.1143, lng: 80.1548 },
      'ambattur, india': { lat: 13.1143, lng: 80.1548 },
      'tirunelveli': { lat: 8.7139, lng: 77.7567 },
      'tirunelveli, india': { lat: 8.7139, lng: 77.7567 },
      'malegaon': { lat: 20.5579, lng: 74.5287 },
      'malegaon, india': { lat: 20.5579, lng: 74.5287 },
      'gaya': { lat: 24.7914, lng: 85.0002 },
      'gaya, india': { lat: 24.7914, lng: 85.0002 },
      'jalgaon': { lat: 21.0077, lng: 75.5626 },
      'jalgaon, india': { lat: 21.0077, lng: 75.5626 },
      'udaipur': { lat: 24.5854, lng: 73.7125 },
      'udaipur, india': { lat: 24.5854, lng: 73.7125 },
      'maheshtala': { lat: 22.5093, lng: 88.2482 },
      'maheshtala, india': { lat: 22.5093, lng: 88.2482 },
      'davanagere': { lat: 14.4644, lng: 75.9216 },
      'davanagere, india': { lat: 14.4644, lng: 75.9216 },
      'kozhikode': { lat: 11.2588, lng: 75.7804 },
      'kozhikode, india': { lat: 11.2588, lng: 75.7804 },
      'kurnool': { lat: 15.8281, lng: 78.0373 },
      'kurnool, india': { lat: 15.8281, lng: 78.0373 },
      'rajpur sonarpur': { lat: 22.4707, lng: 88.4045 },
      'rajpur sonarpur, india': { lat: 22.4707, lng: 88.4045 },
      'raghunathganj': { lat: 24.4647, lng: 87.8521 },
      'raghunathganj, india': { lat: 24.4647, lng: 87.8521 },
      'cochin': { lat: 9.9312, lng: 76.2673 },
      'cochin, india': { lat: 9.9312, lng: 76.2673 },

      // Additional Chinese cities
      'guangzhou': { lat: 23.1291, lng: 113.2644 },
      'guangzhou, china': { lat: 23.1291, lng: 113.2644 },
      'shenzhen': { lat: 22.5431, lng: 114.0579 },
      'shenzhen, china': { lat: 22.5431, lng: 114.0579 },
      'chongqing': { lat: 29.4316, lng: 106.9123 },
      'chongqing, china': { lat: 29.4316, lng: 106.9123 },
      'tianjin': { lat: 39.3434, lng: 117.3616 },
      'tianjin, china': { lat: 39.3434, lng: 117.3616 },
      'wuhan': { lat: 30.5928, lng: 114.3055 },
      'wuhan, china': { lat: 30.5928, lng: 114.3055 },
      'xian': { lat: 34.3416, lng: 108.9398 },
      'xian, china': { lat: 34.3416, lng: 108.9398 },
      'chengdu': { lat: 30.5728, lng: 104.0668 },
      'chengdu, china': { lat: 30.5728, lng: 104.0668 },
      'dongguan': { lat: 23.0489, lng: 113.7447 },
      'dongguan, china': { lat: 23.0489, lng: 113.7447 },
      'nanjing': { lat: 32.0603, lng: 118.7969 },
      'nanjing, china': { lat: 32.0603, lng: 118.7969 },
      'shenyang': { lat: 41.8057, lng: 123.4315 },
      'shenyang, china': { lat: 41.8057, lng: 123.4315 },
      'hangzhou': { lat: 30.2741, lng: 120.1551 },
      'hangzhou, china': { lat: 30.2741, lng: 120.1551 },
      'foshan': { lat: 23.0218, lng: 113.1219 },
      'foshan, china': { lat: 23.0218, lng: 113.1219 },
      'shijiazhuang': { lat: 38.0428, lng: 114.5149 },
      'shijiazhuang, china': { lat: 38.0428, lng: 114.5149 },

      // Additional Japanese cities
      'osaka': { lat: 34.6937, lng: 135.5023 },
      'osaka, japan': { lat: 34.6937, lng: 135.5023 },
      'yokohama': { lat: 35.4437, lng: 139.6380 },
      'yokohama, japan': { lat: 35.4437, lng: 139.6380 },
      'nagoya': { lat: 35.1815, lng: 136.9066 },
      'nagoya, japan': { lat: 35.1815, lng: 136.9066 },
      'sapporo': { lat: 43.0642, lng: 141.3469 },
      'sapporo, japan': { lat: 43.0642, lng: 141.3469 },
      'kobe': { lat: 34.6901, lng: 135.1956 },
      'kobe, japan': { lat: 34.6901, lng: 135.1956 },
      'kyoto': { lat: 35.0116, lng: 135.7681 },
      'kyoto, japan': { lat: 35.0116, lng: 135.7681 },
      'fukuoka': { lat: 33.5904, lng: 130.4017 },
      'fukuoka, japan': { lat: 33.5904, lng: 130.4017 },
      'kawasaki': { lat: 35.5308, lng: 139.7029 },
      'kawasaki, japan': { lat: 35.5308, lng: 139.7029 },
      'saitama': { lat: 35.8617, lng: 139.6455 },
      'saitama, japan': { lat: 35.8617, lng: 139.6455 },
      'hiroshima': { lat: 34.3853, lng: 132.4553 },
      'hiroshima, japan': { lat: 34.3853, lng: 132.4553 },

      // Major Middle Eastern cities
      'dubai': { lat: 25.2048, lng: 55.2708 },
      'dubai, uae': { lat: 25.2048, lng: 55.2708 },
      'abu dhabi': { lat: 24.4539, lng: 54.3773 },
      'abu dhabi, uae': { lat: 24.4539, lng: 54.3773 },
      'riyadh': { lat: 24.7136, lng: 46.6753 },
      'riyadh, saudi arabia': { lat: 24.7136, lng: 46.6753 },
      'doha': { lat: 25.2854, lng: 51.5310 },
      'doha, qatar': { lat: 25.2854, lng: 51.5310 },
      'kuwait city': { lat: 29.3759, lng: 47.9774 },
      'kuwait city, kuwait': { lat: 29.3759, lng: 47.9774 },
      'manama': { lat: 26.2285, lng: 50.5860 },
      'manama, bahrain': { lat: 26.2285, lng: 50.5860 },
      'muscat': { lat: 23.5859, lng: 58.4059 },
      'muscat, oman': { lat: 23.5859, lng: 58.4059 },
      'tehran': { lat: 35.6892, lng: 51.3890 },
      'tehran, iran': { lat: 35.6892, lng: 51.3890 },
      'istanbul': { lat: 41.0082, lng: 28.9784 },
      'istanbul, turkey': { lat: 41.0082, lng: 28.9784 },
      'ankara': { lat: 39.9334, lng: 32.8597 },
      'ankara, turkey': { lat: 39.9334, lng: 32.8597 },
      'izmir': { lat: 38.4192, lng: 27.1287 },
      'izmir, turkey': { lat: 38.4192, lng: 27.1287 },
      'baghdad': { lat: 33.3152, lng: 44.3661 },
      'baghdad, iraq': { lat: 33.3152, lng: 44.3661 },
      'cairo': { lat: 30.0444, lng: 31.2357 },
      'cairo, egypt': { lat: 30.0444, lng: 31.2357 },
      'tel aviv': { lat: 32.0853, lng: 34.7818 },
      'tel aviv, israel': { lat: 32.0853, lng: 34.7818 },
      'jerusalem': { lat: 31.7683, lng: 35.2137 },
      'jerusalem, israel': { lat: 31.7683, lng: 35.2137 },
      'beirut': { lat: 33.8938, lng: 35.5018 },
      'beirut, lebanon': { lat: 33.8938, lng: 35.5018 },
      'damascus': { lat: 33.5138, lng: 36.2765 },
      'damascus, syria': { lat: 33.5138, lng: 36.2765 },
      'amman': { lat: 31.9539, lng: 35.9106 },
      'amman, jordan': { lat: 31.9539, lng: 35.9106 },

      // Major African cities
      'cairo': { lat: 30.0444, lng: 31.2357 },
      'cairo, egypt': { lat: 30.0444, lng: 31.2357 },
      'lagos': { lat: 6.5244, lng: 3.3792 },
      'lagos, nigeria': { lat: 6.5244, lng: 3.3792 },
      'kinshasa': { lat: -4.4419, lng: 15.2663 },
      'kinshasa, democratic republic of the congo': { lat: -4.4419, lng: 15.2663 },
      'johannesburg': { lat: -26.2041, lng: 28.0473 },
      'johannesburg, south africa': { lat: -26.2041, lng: 28.0473 },
      'luanda': { lat: -8.8390, lng: 13.2894 },
      'luanda, angola': { lat: -8.8390, lng: 13.2894 },
      'dar es salaam': { lat: -6.7924, lng: 39.2083 },
      'dar es salaam, tanzania': { lat: -6.7924, lng: 39.2083 },
      'khartoum': { lat: 15.5007, lng: 32.5599 },
      'khartoum, sudan': { lat: 15.5007, lng: 32.5599 },
      'alexandria': { lat: 31.2001, lng: 29.9187 },
      'alexandria, egypt': { lat: 31.2001, lng: 29.9187 },
      'abidjan': { lat: 5.3600, lng: -4.0083 },
      'abidjan, ivory coast': { lat: 5.3600, lng: -4.0083 },
      'kano': { lat: 11.9999, lng: 8.5200 },
      'kano, nigeria': { lat: 11.9999, lng: 8.5200 },
      'ibadan': { lat: 7.3775, lng: 3.9470 },
      'ibadan, nigeria': { lat: 7.3775, lng: 3.9470 },
      'cape town': { lat: -33.9249, lng: 18.4241 },
      'cape town, south africa': { lat: -33.9249, lng: 18.4241 },
      'casablanca': { lat: 33.5731, lng: -7.5898 },
      'casablanca, morocco': { lat: 33.5731, lng: -7.5898 },
      'durban': { lat: -29.8587, lng: 31.0218 },
      'durban, south africa': { lat: -29.8587, lng: 31.0218 },
      'nairobi': { lat: -1.2921, lng: 36.8219 },
      'nairobi, kenya': { lat: -1.2921, lng: 36.8219 },
      'bamako': { lat: 12.6392, lng: -8.0029 },
      'bamako, mali': { lat: 12.6392, lng: -8.0029 },
      'ouagadougou': { lat: 12.3714, lng: -1.5197 },
      'ouagadougou, burkina faso': { lat: 12.3714, lng: -1.5197 },
      'mogadishu': { lat: 2.0469, lng: 45.3182 },
      'mogadishu, somalia': { lat: 2.0469, lng: 45.3182 },
      'kampala': { lat: 0.3476, lng: 32.5825 },
      'kampala, uganda': { lat: 0.3476, lng: 32.5825 },
      'lusaka': { lat: -15.3875, lng: 28.3228 },
      'lusaka, zambia': { lat: -15.3875, lng: 28.3228 },
      'harare': { lat: -17.8292, lng: 31.0522 },
      'harare, zimbabwe': { lat: -17.8292, lng: 31.0522 },
      'antananarivo': { lat: -18.8792, lng: 47.5079 },
      'antananarivo, madagascar': { lat: -18.8792, lng: 47.5079 },
      'maputo': { lat: -25.9692, lng: 32.5732 },
      'maputo, mozambique': { lat: -25.9692, lng: 32.5732 },

      // Major Australian and Oceanian cities
      'sydney': { lat: -33.8688, lng: 151.2093 },
      'sydney, australia': { lat: -33.8688, lng: 151.2093 },
      'melbourne': { lat: -37.8136, lng: 144.9631 },
      'melbourne, australia': { lat: -37.8136, lng: 144.9631 },
      'brisbane': { lat: -27.4705, lng: 153.0260 },
      'brisbane, australia': { lat: -27.4705, lng: 153.0260 },
      'perth': { lat: -31.9505, lng: 115.8605 },
      'perth, australia': { lat: -31.9505, lng: 115.8605 },
      'adelaide': { lat: -34.9285, lng: 138.6007 },
      'adelaide, australia': { lat: -34.9285, lng: 138.6007 },
      'gold coast': { lat: -28.0167, lng: 153.4000 },
      'gold coast, australia': { lat: -28.0167, lng: 153.4000 },
      'newcastle': { lat: -32.9283, lng: 151.7817 },
      'newcastle, australia': { lat: -32.9283, lng: 151.7817 },
      'canberra': { lat: -35.2809, lng: 149.1300 },
      'canberra, australia': { lat: -35.2809, lng: 149.1300 },
      'sunshine coast': { lat: -26.6500, lng: 153.0667 },
      'sunshine coast, australia': { lat: -26.6500, lng: 153.0667 },
      'wollongong': { lat: -34.4278, lng: 150.8931 },
      'wollongong, australia': { lat: -34.4278, lng: 150.8931 },
      'hobart': { lat: -42.8821, lng: 147.3272 },
      'hobart, australia': { lat: -42.8821, lng: 147.3272 },
      'geelong': { lat: -38.1499, lng: 144.3617 },
      'geelong, australia': { lat: -38.1499, lng: 144.3617 },
      'townsville': { lat: -19.2590, lng: 146.8169 },
      'townsville, australia': { lat: -19.2590, lng: 146.8169 },
      'cairns': { lat: -16.9186, lng: 145.7781 },
      'cairns, australia': { lat: -16.9186, lng: 145.7781 },
      'toowoomba': { lat: -27.5598, lng: 151.9507 },
      'toowoomba, australia': { lat: -27.5598, lng: 151.9507 },
      'darwin': { lat: -12.4634, lng: 130.8456 },
      'darwin, australia': { lat: -12.4634, lng: 130.8456 },
      'launceston': { lat: -41.4332, lng: 147.1441 },
      'launceston, australia': { lat: -41.4332, lng: 147.1441 },
      'auckland': { lat: -36.8485, lng: 174.7633 },
      'auckland, new zealand': { lat: -36.8485, lng: 174.7633 },
      'wellington': { lat: -41.2865, lng: 174.7762 },
      'wellington, new zealand': { lat: -41.2865, lng: 174.7762 },
      'christchurch': { lat: -43.5321, lng: 172.6362 },
      'christchurch, new zealand': { lat: -43.5321, lng: 172.6362 },
      'hamilton': { lat: -37.7870, lng: 175.2793 },
      'hamilton, new zealand': { lat: -37.7870, lng: 175.2793 },
      'tauranga': { lat: -37.6878, lng: 176.1651 },
      'tauranga, new zealand': { lat: -37.6878, lng: 176.1651 },
      'dunedin': { lat: -45.8788, lng: 170.5028 },
      'dunedin, new zealand': { lat: -45.8788, lng: 170.5028 },
      'palmerston north': { lat: -40.3523, lng: 175.6082 },
      'palmerston north, new zealand': { lat: -40.3523, lng: 175.6082 },

      // Major South American cities
      'sao paulo': { lat: -23.5558, lng: -46.6396 },
      'sao paulo, brazil': { lat: -23.5558, lng: -46.6396 },
      'lima': { lat: -12.0464, lng: -77.0428 },
      'lima, peru': { lat: -12.0464, lng: -77.0428 },
      'bogota': { lat: 4.7110, lng: -74.0721 },
      'bogota, colombia': { lat: 4.7110, lng: -74.0721 },
      'rio de janeiro': { lat: -22.9068, lng: -43.1729 },
      'rio de janeiro, brazil': { lat: -22.9068, lng: -43.1729 },
      'santiago': { lat: -33.4489, lng: -70.6693 },
      'santiago, chile': { lat: -33.4489, lng: -70.6693 },
      'caracas': { lat: 10.4806, lng: -66.9036 },
      'caracas, venezuela': { lat: 10.4806, lng: -66.9036 },
      'buenos aires': { lat: -34.6118, lng: -58.3960 },
      'buenos aires, argentina': { lat: -34.6118, lng: -58.3960 },
      'salvador': { lat: -12.9777, lng: -38.5016 },
      'salvador, brazil': { lat: -12.9777, lng: -38.5016 },
      'brasilia': { lat: -15.8267, lng: -47.9218 },
      'brasilia, brazil': { lat: -15.8267, lng: -47.9218 },
      'fortaleza': { lat: -3.7319, lng: -38.5267 },
      'fortaleza, brazil': { lat: -3.7319, lng: -38.5267 },
      'belo horizonte': { lat: -19.8157, lng: -43.9542 },
      'belo horizonte, brazil': { lat: -19.8157, lng: -43.9542 },
      'medelin': { lat: 6.2442, lng: -75.5812 },
      'medelin, colombia': { lat: 6.2442, lng: -75.5812 },
      'cali': { lat: 3.4516, lng: -76.5320 },
      'cali, colombia': { lat: 3.4516, lng: -76.5320 },
      'manaus': { lat: -3.1190, lng: -60.0217 },
      'manaus, brazil': { lat: -3.1190, lng: -60.0217 },
      'curitiba': { lat: -25.4244, lng: -49.2654 },
      'curitiba, brazil': { lat: -25.4244, lng: -49.2654 },
      'recife': { lat: -8.0476, lng: -34.8770 },
      'recife, brazil': { lat: -8.0476, lng: -34.8770 },
      'porto alegre': { lat: -30.0346, lng: -51.2177 },
      'porto alegre, brazil': { lat: -30.0346, lng: -51.2177 },
      'belem': { lat: -1.4558, lng: -48.5044 },
      'belem, brazil': { lat: -1.4558, lng: -48.5044 },
      'goiania': { lat: -16.6869, lng: -49.2648 },
      'goiania, brazil': { lat: -16.6869, lng: -49.2648 },
      'guarulhos': { lat: -23.4543, lng: -46.5336 },
      'guarulhos, brazil': { lat: -23.4543, lng: -46.5336 },
      'campinas': { lat: -22.9099, lng: -47.0626 },
      'campinas, brazil': { lat: -22.9099, lng: -47.0626 },
      'sao luis': { lat: -2.5307, lng: -44.3068 },
      'sao luis, brazil': { lat: -2.5307, lng: -44.3068 },
      'sao goncalo': { lat: -22.8267, lng: -43.0537 },
      'sao goncalo, brazil': { lat: -22.8267, lng: -43.0537 },
      'maceio': { lat: -9.6498, lng: -35.7089 },
      'maceio, brazil': { lat: -9.6498, lng: -35.7089 },
      'duque de caxias': { lat: -22.7856, lng: -43.3117 },
      'duque de caxias, brazil': { lat: -22.7856, lng: -43.3117 },
      'natal': { lat: -5.7945, lng: -35.2110 },
      'natal, brazil': { lat: -5.7945, lng: -35.2110 },
      'teresina': { lat: -5.0892, lng: -42.8019 },
      'teresina, brazil': { lat: -5.0892, lng: -42.8019 },
      'campo grande': { lat: -20.4697, lng: -54.6201 },
      'campo grande, brazil': { lat: -20.4697, lng: -54.6201 },
      'nova iguacu': { lat: -22.7592, lng: -43.4507 },
      'nova iguacu, brazil': { lat: -22.7592, lng: -43.4507 },
      'sao bernardo do campo': { lat: -23.6944, lng: -46.5653 },
      'sao bernardo do campo, brazil': { lat: -23.6944, lng: -46.5653 },
      'joao pessoa': { lat: -7.1195, lng: -34.8450 },
      'joao pessoa, brazil': { lat: -7.1195, lng: -34.8450 },
      'santo andre': { lat: -23.6633, lng: -46.5307 },
      'santo andre, brazil': { lat: -23.6633, lng: -46.5307 },
      'osasco': { lat: -23.5329, lng: -46.7918 },
      'osasco, brazil': { lat: -23.5329, lng: -46.7918 },
      'jaboatao dos guararapes': { lat: -8.1130, lng: -35.0147 },
      'jaboatao dos guararapes, brazil': { lat: -8.1130, lng: -35.0147 },
      'contagem': { lat: -19.9167, lng: -44.0500 },
      'contagem, brazil': { lat: -19.9167, lng: -44.0500 },
      'uberlandia': { lat: -18.9113, lng: -48.2622 },
      'uberlandia, brazil': { lat: -18.9113, lng: -48.2622 },
      'sorocaba': { lat: -23.5015, lng: -47.4526 },
      'sorocaba, brazil': { lat: -23.5015, lng: -47.4526 },
      'aracaju': { lat: -10.9472, lng: -37.0731 },
      'aracaju, brazil': { lat: -10.9472, lng: -37.0731 },
      'feira de santana': { lat: -12.2664, lng: -38.9663 },
      'feira de santana, brazil': { lat: -12.2664, lng: -38.9663 },
      'cuiaba': { lat: -15.6014, lng: -56.0979 },
      'cuiaba, brazil': { lat: -15.6014, lng: -56.0979 },
      'joinville': { lat: -26.3044, lng: -48.8487 },
      'joinville, brazil': { lat: -26.3044, lng: -48.8487 },
      'juiz de fora': { lat: -21.7642, lng: -43.3500 },
      'juiz de fora, brazil': { lat: -21.7642, lng: -43.3500 },
      'londrina': { lat: -23.3045, lng: -51.1696 },
      'londrina, brazil': { lat: -23.3045, lng: -51.1696 },
      'aparecida de goiania': { lat: -16.8239, lng: -49.2439 },
      'aparecida de goiania, brazil': { lat: -16.8239, lng: -49.2439 },
      'niteroi': { lat: -22.8833, lng: -43.1036 },
      'niteroi, brazil': { lat: -22.8833, lng: -43.1036 },
      'campos dos goytacazes': { lat: -21.7520, lng: -41.3280 },
      'campos dos goytacazes, brazil': { lat: -21.7520, lng: -41.3280 },
      'ananindeua': { lat: -1.3656, lng: -48.3720 },
      'ananindeua, brazil': { lat: -1.3656, lng: -48.3720 },
      'porto velho': { lat: -8.7612, lng: -63.9039 },
      'porto velho, brazil': { lat: -8.7612, lng: -63.9039 },
      'serra': { lat: -20.1288, lng: -40.3075 },
      'serra, brazil': { lat: -20.1288, lng: -40.3075 },
      'sao jose dos campos': { lat: -23.2237, lng: -45.9009 },
      'sao jose dos campos, brazil': { lat: -23.2237, lng: -45.9009 },
      'ribeirao preto': { lat: -21.1775, lng: -47.8108 },
      'ribeirao preto, brazil': { lat: -21.1775, lng: -47.8108 },
      'betim': { lat: -19.9678, lng: -44.1978 },
      'betim, brazil': { lat: -19.9678, lng: -44.1978 },
      'caxias do sul': { lat: -29.1678, lng: -51.1794 },
      'caxias do sul, brazil': { lat: -29.1678, lng: -51.1794 },
      'florianopolis': { lat: -27.5954, lng: -48.5480 },
      'florianopolis, brazil': { lat: -27.5954, lng: -48.5480 },
      'vila velha': { lat: -20.3297, lng: -40.2925 },
      'vila velha, brazil': { lat: -20.3297, lng: -40.2925 },
      'salvador': { lat: -12.9777, lng: -38.5016 },
      'salvador, brazil': { lat: -12.9777, lng: -38.5016 },
      'macapa': { lat: 0.0389, lng: -51.0664 },
      'macapa, brazil': { lat: 0.0389, lng: -51.0664 },
      'vitoria': { lat: -20.3155, lng: -40.3128 },
      'vitoria, brazil': { lat: -20.3155, lng: -40.3128 },
      'sao jose do rio preto': { lat: -20.8197, lng: -49.3794 },
      'sao jose do rio preto, brazil': { lat: -20.8197, lng: -49.3794 },
      'canoas': { lat: -29.9178, lng: -51.1817 },
      'canoas, brazil': { lat: -29.9178, lng: -51.1817 },
      'franca': { lat: -20.5386, lng: -47.4006 },
      'franca, brazil': { lat: -20.5386, lng: -47.4006 },
      'santos': { lat: -23.9608, lng: -46.3331 },
      'santos, brazil': { lat: -23.9608, lng: -46.3331 },
      'carapicuiba': { lat: -23.5225, lng: -46.8356 },
      'carapicuiba, brazil': { lat: -23.5225, lng: -46.8356 },
      'maua': { lat: -23.6678, lng: -46.4614 },
      'maua, brazil': { lat: -23.6678, lng: -46.4614 },

      // Canadian cities
      'toronto': { lat: 43.6532, lng: -79.3832 },
      'toronto, canada': { lat: 43.6532, lng: -79.3832 },
      'montreal': { lat: 45.5017, lng: -73.5673 },
      'montreal, canada': { lat: 45.5017, lng: -73.5673 },
      'vancouver': { lat: 49.2827, lng: -123.1207 },
      'vancouver, canada': { lat: 49.2827, lng: -123.1207 },
      'calgary': { lat: 51.0447, lng: -114.0719 },
      'calgary, canada': { lat: 51.0447, lng: -114.0719 },
      'edmonton': { lat: 53.5461, lng: -113.4938 },
      'edmonton, canada': { lat: 53.5461, lng: -113.4938 },
      'ottawa': { lat: 45.4215, lng: -75.6972 },
      'ottawa, canada': { lat: 45.4215, lng: -75.6972 },
      'winnipeg': { lat: 49.8951, lng: -97.1384 },
      'winnipeg, canada': { lat: 49.8951, lng: -97.1384 },
      'quebec city': { lat: 46.8139, lng: -71.2080 },
      'quebec city, canada': { lat: 46.8139, lng: -71.2080 },
      'hamilton': { lat: 43.2557, lng: -79.8711 },
      'hamilton, canada': { lat: 43.2557, lng: -79.8711 },
      'kitchener': { lat: 43.4516, lng: -80.4925 },
      'kitchener, canada': { lat: 43.4516, lng: -80.4925 },
      'london': { lat: 42.9849, lng: -81.2453 },
      'london, canada': { lat: 42.9849, lng: -81.2453 },
      'halifax': { lat: 44.6488, lng: -63.5752 },
      'halifax, canada': { lat: 44.6488, lng: -63.5752 },
      'victoria': { lat: 48.4284, lng: -123.3656 },
      'victoria, canada': { lat: 48.4284, lng: -123.3656 },
      'windsor': { lat: 42.3149, lng: -83.0364 },
      'windsor, canada': { lat: 42.3149, lng: -83.0364 },
      'oshawa': { lat: 43.8971, lng: -78.8658 },
      'oshawa, canada': { lat: 43.8971, lng: -78.8658 },
      'saskatoon': { lat: 52.1579, lng: -106.6702 },
      'saskatoon, canada': { lat: 52.1579, lng: -106.6702 },
      'regina': { lat: 50.4452, lng: -104.6189 },
      'regina, canada': { lat: 50.4452, lng: -104.6189 },
      'st. johns': { lat: 47.5615, lng: -52.7126 },
      'st. johns, canada': { lat: 47.5615, lng: -52.7126 },
      'kelowna': { lat: 49.8880, lng: -119.4960 },
      'kelowna, canada': { lat: 49.8880, lng: -119.4960 },
      'barrie': { lat: 44.3894, lng: -79.6903 },
      'barrie, canada': { lat: 44.3894, lng: -79.6903 },
      'abbotsford': { lat: 49.0504, lng: -122.3045 },
      'abbotsford, canada': { lat: 49.0504, lng: -122.3045 },
      'guelph': { lat: 43.5448, lng: -80.2482 },
      'guelph, canada': { lat: 43.5448, lng: -80.2482 },
      'kingston': { lat: 44.2312, lng: -76.4860 },
      'kingston, canada': { lat: 44.2312, lng: -76.4860 },
      'kanata': { lat: 45.3017, lng: -75.9067 },
      'kanata, canada': { lat: 45.3017, lng: -75.9067 },
      'milton': { lat: 43.5183, lng: -79.8774 },
      'milton, canada': { lat: 43.5183, lng: -79.8774 },
      'sherbrooke': { lat: 45.4042, lng: -71.8929 },
      'sherbrooke, canada': { lat: 45.4042, lng: -71.8929 },
      'saguenay': { lat: 48.3150, lng: -71.0669 },
      'saguenay, canada': { lat: 48.3150, lng: -71.0669 },
      'levis': { lat: 46.8074, lng: -71.1620 },
      'levis, canada': { lat: 46.8074, lng: -71.1620 },
      'trois-rivieres': { lat: 46.3432, lng: -72.5424 },
      'trois-rivieres, canada': { lat: 46.3432, lng: -72.5424 },
      'terrebonne': { lat: 45.7057, lng: -73.6470 },
      'terrebonne, canada': { lat: 45.7057, lng: -73.6470 },
      'brossard': { lat: 45.4504, lng: -73.4658 },
      'brossard, canada': { lat: 45.4504, lng: -73.4658 },
      'red deer': { lat: 52.2681, lng: -113.811 },
      'red deer, canada': { lat: 52.2681, lng: -113.811 },
      'kamloops': { lat: 50.6745, lng: -120.3273 },
      'kamloops, canada': { lat: 50.6745, lng: -120.3273 },
      'chilliwack': { lat: 49.1579, lng: -121.9514 },
      'chilliwack, canada': { lat: 49.1579, lng: -121.9514 },
      'prince george': { lat: 53.9171, lng: -122.7497 },
      'prince george, canada': { lat: 53.9171, lng: -122.7497 },
      'sault ste. marie': { lat: 46.5136, lng: -84.3206 },
      'sault ste. marie, canada': { lat: 46.5136, lng: -84.3206 },
      'sarnia': { lat: 42.9994, lng: -82.3089 },
      'sarnia, canada': { lat: 42.9994, lng: -82.3089 },
      'moncton': { lat: 46.0878, lng: -64.7782 },
      'moncton, canada': { lat: 46.0878, lng: -64.7782 },
      'thunder bay': { lat: 48.3809, lng: -89.2477 },
      'thunder bay, canada': { lat: 48.3809, lng: -89.2477 },
      'dieppe': { lat: 46.0747, lng: -64.6800 },
      'dieppe, canada': { lat: 46.0747, lng: -64.6800 },
      'waterloo': { lat: 43.4643, lng: -80.5204 },
      'waterloo, canada': { lat: 43.4643, lng: -80.5204 },
      'delta': { lat: 49.0847, lng: -123.0760 },
      'delta, canada': { lat: 49.0847, lng: -123.0760 },
      'chatham': { lat: 42.4047, lng: -82.1914 },
      'chatham, canada': { lat: 42.4047, lng: -82.1914 },
      'laval': { lat: 45.6066, lng: -73.7124 },
      'laval, canada': { lat: 45.6066, lng: -73.7124 },
      'north vancouver': { lat: 49.3163, lng: -123.0693 },
      'north vancouver, canada': { lat: 49.3163, lng: -123.0693 },
      'langley': { lat: 49.0955, lng: -122.6015 },
      'langley, canada': { lat: 49.0955, lng: -122.6015 },
      'ajax': { lat: 43.8509, lng: -79.0204 },
      'ajax, canada': { lat: 43.8509, lng: -79.0204 },
      'saint john': { lat: 45.2744, lng: -66.0765 },
      'saint john, canada': { lat: 45.2744, lng: -66.0765 },
      'lethbridge': { lat: 49.6936, lng: -112.8451 },
      'lethbridge, canada': { lat: 49.6936, lng: -112.8451 },
      'medicine hat': { lat: 50.0355, lng: -110.6764 },
      'medicine hat, canada': { lat: 50.0355, lng: -110.6764 },
      'grande prairie': { lat: 55.1708, lng: -118.8053 },
      'grande prairie, canada': { lat: 55.1708, lng: -118.8053 },
      'airdrie': { lat: 51.2917, lng: -114.0144 },
      'airdrie, canada': { lat: 51.2917, lng: -114.0144 },
      'halton hills': { lat: 43.6256, lng: -79.9254 },
      'halton hills, canada': { lat: 43.6256, lng: -79.9254 },
      'st. albert': { lat: 53.6334, lng: -113.6233 },
      'st. albert, canada': { lat: 53.6334, lng: -113.6233 },
      'fredericton': { lat: 45.9636, lng: -66.6431 },
      'fredericton, canada': { lat: 45.9636, lng: -66.6431 },
      'fort mcmurray': { lat: 56.7264, lng: -111.3790 },
      'fort mcmurray, canada': { lat: 56.7264, lng: -111.3790 },
      'prince albert': { lat: 53.2034, lng: -105.7531 },
      'prince albert, canada': { lat: 53.2034, lng: -105.7531 },
      'moose jaw': { lat: 50.3924, lng: -105.5345 },
      'moose jaw, canada': { lat: 50.3924, lng: -105.5345 },
      'courtenay': { lat: 49.6869, lng: -125.0021 },
      'courtenay, canada': { lat: 49.6869, lng: -125.0021 },
      'cranbrook': { lat: 49.5122, lng: -115.7731 },
      'cranbrook, canada': { lat: 49.5122, lng: -115.7731 },
      'brandon': { lat: 49.8391, lng: -99.9531 },
      'brandon, canada': { lat: 49.8391, lng: -99.9531 },
      'cornwall': { lat: 45.0268, lng: -74.7282 },
      'cornwall, canada': { lat: 45.0268, lng: -74.7282 },
      'victoriaville': { lat: 46.0522, lng: -71.9622 },
      'victoriaville, canada': { lat: 46.0522, lng: -71.9622 },
      'vernon': { lat: 50.2671, lng: -119.2720 },
      'vernon, canada': { lat: 50.2671, lng: -119.2720 },
      'duncan': { lat: 48.7787, lng: -123.7066 },
      'duncan, canada': { lat: 48.7787, lng: -123.7066 },
      'saint-jerome': { lat: 45.7755, lng: -74.0036 },
      'saint-jerome, canada': { lat: 45.7755, lng: -74.0036 },
      'drummondville': { lat: 45.8838, lng: -72.4819 },
      'drummondville, canada': { lat: 45.8838, lng: -72.4819 },
      'saint-hyacinthe': { lat: 45.6306, lng: -72.9575 },
      'saint-hyacinthe, canada': { lat: 45.6306, lng: -72.9575 },
      'shawinigan': { lat: 46.5668, lng: -72.7431 },
      'shawinigan, canada': { lat: 46.5668, lng: -72.7431 },
      'dollard-des ormeaux': { lat: 45.4937, lng: -73.7941 },
      'dollard-des ormeaux, canada': { lat: 45.4937, lng: -73.7941 },
      'granby': { lat: 45.4040, lng: -72.7308 },
      'granby, canada': { lat: 45.4040, lng: -72.7308 },
      'saint-eustache': { lat: 45.5625, lng: -73.9057 },
      'saint-eustache, canada': { lat: 45.5625, lng: -73.9057 },
      'mont-royal': { lat: 45.5085, lng: -73.6470 },
      'mont-royal, canada': { lat: 45.5085, lng: -73.6470 },
      'riviere-du-loup': { lat: 47.8303, lng: -69.5365 },
      'riviere-du-loup, canada': { lat: 47.8303, lng: -69.5365 },
      'stratford': { lat: 43.3701, lng: -80.9821 },
      'stratford, canada': { lat: 43.3701, lng: -80.9821 },
      'val-dor': { lat: 48.0974, lng: -77.7828 },
      'val-dor, canada': { lat: 48.0974, lng: -77.7828 },
      'timmins': { lat: 48.4758, lng: -81.3304 },
      'timmins, canada': { lat: 48.4758, lng: -81.3304 },
      'prince rupert': { lat: 54.3150, lng: -130.3209 },
      'prince rupert, canada': { lat: 54.3150, lng: -130.3209 },
      'campbell river': { lat: 50.0163, lng: -125.2444 },
      'campbell river, canada': { lat: 50.0163, lng: -125.2444 },
      'sept-iles': { lat: 50.2001, lng: -66.3821 },
      'sept-iles, canada': { lat: 50.2001, lng: -66.3821 },
      'lloydminster': { lat: 53.2783, lng: -110.0054 },
      'lloydminster, canada': { lat: 53.2783, lng: -110.0054 },
      'yorkton': { lat: 51.2139, lng: -102.4622 },
      'yorkton, canada': { lat: 51.2139, lng: -102.4622 },
      'estevan': { lat: 49.1394, lng: -102.9967 },
      'estevan, canada': { lat: 49.1394, lng: -102.9967 },
      'weyburn': { lat: 49.6617, lng: -103.8517 },
      'weyburn, canada': { lat: 49.6617, lng: -103.8517 },
      'north battleford': { lat: 52.7755, lng: -108.2866 },
      'north battleford, canada': { lat: 52.7755, lng: -108.2866 },
      'melfort': { lat: 52.8564, lng: -104.6089 },
      'melfort, canada': { lat: 52.8564, lng: -104.6089 },
      'humboldt': { lat: 52.2014, lng: -105.1231 },
      'humboldt, canada': { lat: 52.2014, lng: -105.1231 },
      'whitehorse': { lat: 60.7212, lng: -135.0568 },
      'whitehorse, canada': { lat: 60.7212, lng: -135.0568 },
      'yellowknife': { lat: 62.4540, lng: -114.3718 },
      'yellowknife, canada': { lat: 62.4540, lng: -114.3718 },
      'iqaluit': { lat: 63.7467, lng: -68.5170 },
      'iqaluit, canada': { lat: 63.7467, lng: -68.5170 },
      'dawson creek': { lat: 55.7596, lng: -120.2377 },
      'dawson creek, canada': { lat: 55.7596, lng: -120.2377 },
      'fort st. john': { lat: 56.2498, lng: -120.8529 },
      'fort st. john, canada': { lat: 56.2498, lng: -120.8529 },
      'hinton': { lat: 53.4003, lng: -117.5895 },
      'hinton, canada': { lat: 53.4003, lng: -117.5895 },
      'cold lake': { lat: 54.4539, lng: -110.1756 },
      'cold lake, canada': { lat: 54.4539, lng: -110.1756 },
      'lacombe': { lat: 52.4669, lng: -113.7369 },
      'lacombe, canada': { lat: 52.4669, lng: -113.7369 },
      'stony plain': { lat: 53.5267, lng: -114.0169 },
      'stony plain, canada': { lat: 53.5267, lng: -114.0169 },
      'spruce grove': { lat: 53.5450, lng: -113.9069 },
      'spruce grove, canada': { lat: 53.5450, lng: -113.9069 },
      'wetaskiwin': { lat: 52.9696, lng: -113.3786 },
      'wetaskiwin, canada': { lat: 52.9696, lng: -113.3786 },
      'leduc': { lat: 53.2669, lng: -113.5519 },
      'leduc, canada': { lat: 53.2669, lng: -113.5519 },
      'fort saskatchewan': { lat: 53.7206, lng: -113.2189 },
      'fort saskatchewan, canada': { lat: 53.7206, lng: -113.2189 },
      'sherwood park': { lat: 53.5169, lng: -113.3119 },
      'sherwood park, canada': { lat: 53.5169, lng: -113.3119 },
      'beaumont': { lat: 53.3569, lng: -113.4169 },
      'beaumont, canada': { lat: 53.3569, lng: -113.4169 },
      'camrose': { lat: 53.0169, lng: -112.8286 },
      'camrose, canada': { lat: 53.0169, lng: -112.8286 },
      'lloydminster': { lat: 53.2783, lng: -110.0054 },
      'lloydminster, canada': { lat: 53.2783, lng: -110.0054 },
      'vegreville': { lat: 53.4969, lng: -112.0586 },
      'vegreville, canada': { lat: 53.4969, lng: -112.0586 },
      'two hills': { lat: 53.7169, lng: -111.7419 },
      'two hills, canada': { lat: 53.7169, lng: -111.7419 },
      'vermilion': { lat: 53.3569, lng: -110.8586 },
      'vermilion, canada': { lat: 53.3569, lng: -110.8586 },
      'wainwright': { lat: 52.8369, lng: -110.8586 },
      'wainwright, canada': { lat: 52.8369, lng: -110.8586 },
      'provost': { lat: 52.3569, lng: -110.2619 },
      'provost, canada': { lat: 52.3569, lng: -110.2619 },
      'consort': { lat: 52.0769, lng: -110.4419 },
      'consort, canada': { lat: 52.0769, lng: -110.4419 },
      'coronation': { lat: 52.0769, lng: -111.4419 },
      'coronation, canada': { lat: 52.0769, lng: -111.4419 },
      'hardisty': { lat: 52.6769, lng: -111.3086 },
      'hardisty, canada': { lat: 52.6769, lng: -111.3086 },
      'sedgewick': { lat: 52.7669, lng: -111.7586 },
      'sedgewick, canada': { lat: 52.7669, lng: -111.7586 },
      'lougheed': { lat: 52.7669, lng: -111.9586 },
      'lougheed, canada': { lat: 52.7669, lng: -111.9586 },
      'killam': { lat: 52.7869, lng: -111.8586 },
      'killam, canada': { lat: 52.7869, lng: -111.8586 },
      'strome': { lat: 52.8069, lng: -112.2586 },
      'strome, canada': { lat: 52.8069, lng: -112.2586 },
      'forestburg': { lat: 52.8169, lng: -112.5586 },
      'forestburg, canada': { lat: 52.8169, lng: -112.5586 },
      'galahad': { lat: 52.8369, lng: -112.8586 },
      'galahad, canada': { lat: 52.8369, lng: -112.8586 },
      'heisler': { lat: 52.8569, lng: -112.6586 },
      'heisler, canada': { lat: 52.8569, lng: -112.6586 },
      'daysland': { lat: 52.8769, lng: -112.2586 },
      'daysland, canada': { lat: 52.8769, lng: -112.2586 },
      'rosalind': { lat: 52.8969, lng: -111.9586 },
      'rosalind, canada': { lat: 52.8969, lng: -111.9586 },
      'round hill': { lat: 52.9069, lng: -111.6586 },
      'round hill, canada': { lat: 52.9069, lng: -111.6586 },
      'holden': { lat: 52.9269, lng: -111.3586 },
      'holden, canada': { lat: 52.9269, lng: -111.3586 },
      'viking': { lat: 53.0869, lng: -111.7786 },
      'viking, canada': { lat: 53.0869, lng: -111.7786 },
      'kinsella': { lat: 53.1869, lng: -111.7786 },
      'kinsella, canada': { lat: 53.1869, lng: -111.7786 },
      'irma': { lat: 53.2869, lng: -111.5786 },
      'irma, canada': { lat: 53.2869, lng: -111.5786 },
      'jarrow': { lat: 53.2969, lng: -111.2786 },
      'jarrow, canada': { lat: 53.2969, lng: -111.2786 },
      'innisfree': { lat: 53.3969, lng: -111.3786 },
      'innisfree, canada': { lat: 53.3969, lng: -111.3786 },
      'mundare': { lat: 53.5769, lng: -112.3286 },
      'mundare, canada': { lat: 53.5769, lng: -112.3286 },
      'chipman': { lat: 53.6569, lng: -111.1786 },
      'chipman, canada': { lat: 53.6569, lng: -111.1786 },
      'willingdon': { lat: 53.6969, lng: -111.6786 },
      'willingdon, canada': { lat: 53.6969, lng: -111.6786 },
      'ashmont': { lat: 54.2269, lng: -111.6786 },
      'ashmont, canada': { lat: 54.2269, lng: -111.6786 },
      'smoky lake': { lat: 54.1269, lng: -112.4686 },
      'smoky lake, canada': { lat: 54.1269, lng: -112.4686 },
      'vilna': { lat: 54.1969, lng: -112.0986 },
      'vilna, canada': { lat: 54.1969, lng: -112.0986 },
      'spedden': { lat: 54.4369, lng: -112.5386 },
      'spedden, canada': { lat: 54.4369, lng: -112.5386 },
      'boyle': { lat: 54.6569, lng: -112.8386 },
      'boyle, canada': { lat: 54.6569, lng: -112.8386 },
      'athabasca': { lat: 54.7169, lng: -113.2886 },
      'athabasca, canada': { lat: 54.7169, lng: -113.2886 },
      'slave lake': { lat: 55.2869, lng: -114.7686 },
      'slave lake, canada': { lat: 55.2869, lng: -114.7686 },

      // Countries (approximate center)
      'usa': { lat: 39.8283, lng: -98.5795 },
      'united states': { lat: 39.8283, lng: -98.5795 },
      'canada': { lat: 56.1304, lng: -106.3468 },
      'uk': { lat: 55.3781, lng: -3.4360 },
      'united kingdom': { lat: 55.3781, lng: -3.4360 },
      'france': { lat: 46.2276, lng: 2.2137 },
      'germany': { lat: 51.1657, lng: 10.4515 },
      'japan': { lat: 36.2048, lng: 138.2529 },
      'australia': { lat: -25.2744, lng: 133.7751 },
      'india': { lat: 20.5937, lng: 78.9629 },
      'china': { lat: 35.8617, lng: 104.1954 },
      'russia': { lat: 61.5240, lng: 105.3188 },
      'brazil': { lat: -14.2350, lng: -51.9253 },
      'mexico': { lat: 23.6345, lng: -102.5528 },
      'spain': { lat: 40.4637, lng: -3.7492 },
      'italy': { lat: 41.8719, lng: 12.5674 },
      'netherlands': { lat: 52.1326, lng: 5.2913 },
      'switzerland': { lat: 46.8182, lng: 8.2275 },
      'austria': { lat: 47.5162, lng: 14.5501 },
      'belgium': { lat: 50.5039, lng: 4.4699 },
      'sweden': { lat: 60.1282, lng: 18.6435 },
      'norway': { lat: 60.4720, lng: 8.4689 },
      'denmark': { lat: 56.2639, lng: 9.5018 },
      'finland': { lat: 61.9241, lng: 25.7482 },
      'poland': { lat: 51.9194, lng: 19.1451 },
      'czech republic': { lat: 49.8175, lng: 15.4730 },
      'hungary': { lat: 47.1625, lng: 19.5033 },
      'portugal': { lat: 39.3999, lng: -8.2245 },
      'ireland': { lat: 53.1424, lng: -7.6921 },
      'greece': { lat: 39.0742, lng: 21.8243 },
      'turkey': { lat: 38.9637, lng: 35.2433 },
      'iran': { lat: 32.4279, lng: 53.6880 },
      'iraq': { lat: 33.2232, lng: 43.6793 },
      'saudi arabia': { lat: 23.8859, lng: 45.0792 },
      'uae': { lat: 23.4241, lng: 53.8478 },
      'united arab emirates': { lat: 23.4241, lng: 53.8478 },
      'qatar': { lat: 25.3548, lng: 51.1839 },
      'kuwait': { lat: 29.3117, lng: 47.4818 },
      'bahrain': { lat: 25.9304, lng: 50.6378 },
      'oman': { lat: 21.4735, lng: 55.9754 },
      'israel': { lat: 31.0461, lng: 34.8516 },
      'lebanon': { lat: 33.8547, lng: 35.8623 },
      'syria': { lat: 34.8021, lng: 38.9968 },
      'jordan': { lat: 30.5852, lng: 36.2384 },
      'egypt': { lat: 26.0975, lng: 30.0444 },
      'south africa': { lat: -30.5595, lng: 22.9375 },
      'nigeria': { lat: 9.0820, lng: 8.6753 },
      'morocco': { lat: 31.7917, lng: -7.0926 },
      'algeria': { lat: 28.0339, lng: 1.6596 },
      'tunisia': { lat: 33.8869, lng: 9.5375 },
      'libya': { lat: 26.3351, lng: 17.2283 },
      'sudan': { lat: 12.8628, lng: 30.2176 },
      'ethiopia': { lat: 9.1450, lng: 40.4897 },
      'kenya': { lat: -0.0236, lng: 37.9062 },
      'tanzania': { lat: -6.3690, lng: 34.8888 },
      'uganda': { lat: 1.3733, lng: 32.2903 },
      'ghana': { lat: 7.9465, lng: -1.0232 },
      'ivory coast': { lat: 7.5400, lng: -5.5471 },
      'senegal': { lat: 14.4974, lng: -14.4524 },
      'mali': { lat: 17.5707, lng: -3.9962 },
      'burkina faso': { lat: 12.2383, lng: -1.5616 },
      'niger': { lat: 17.6078, lng: 8.0817 },
      'chad': { lat: 15.4542, lng: 18.7322 },
      'cameroon': { lat: 7.3697, lng: 12.3547 },
      'central african republic': { lat: 6.6111, lng: 20.9394 },
      'democratic republic of the congo': { lat: -4.0383, lng: 21.7587 },
      'congo': { lat: -0.2280, lng: 15.8277 },
      'gabon': { lat: -0.8037, lng: 11.6094 },
      'equatorial guinea': { lat: 1.6508, lng: 10.2679 },
      'sao tome and principe': { lat: 0.1864, lng: 6.6131 },
      'cape verde': { lat: 16.5388, lng: -24.0132 },
      'gambia': { lat: 13.4432, lng: -15.3101 },
      'guinea-bissau': { lat: 11.8037, lng: -15.1804 },
      'guinea': { lat: 9.9456, lng: -9.6966 },
      'sierra leone': { lat: 8.4606, lng: -11.7799 },
      'liberia': { lat: 6.4281, lng: -9.4295 },
      'mauritania': { lat: 21.0079, lng: -10.9408 },
      'western sahara': { lat: 24.2155, lng: -12.8858 },
      'togo': { lat: 8.6195, lng: 0.8248 },
      'benin': { lat: 9.3077, lng: 2.3158 },
      'rwanda': { lat: -1.9403, lng: 29.8739 },
      'burundi': { lat: -3.3731, lng: 29.9189 },
      'djibouti': { lat: 11.8251, lng: 42.5903 },
      'eritrea': { lat: 15.1794, lng: 39.7823 },
      'somalia': { lat: 5.1521, lng: 46.1996 },
      'madagascar': { lat: -18.7669, lng: 46.8691 },
      'mauritius': { lat: -20.3484, lng: 57.5522 },
      'seychelles': { lat: -4.6796, lng: 55.4920 },
      'comoros': { lat: -11.6455, lng: 43.3333 },
      'zambia': { lat: -13.1339, lng: 27.8493 },
      'zimbabwe': { lat: -19.0154, lng: 29.1549 },
      'botswana': { lat: -22.3285, lng: 24.6849 },
      'namibia': { lat: -22.9576, lng: 18.4904 },
      'lesotho': { lat: -29.6100, lng: 28.2336 },
      'swaziland': { lat: -26.5225, lng: 31.4659 },
      'mozambique': { lat: -18.6657, lng: 35.5296 },
      'malawi': { lat: -13.2543, lng: 34.3015 },
      'angola': { lat: -11.2027, lng: 17.8739 },
      'south korea': { lat: 35.9078, lng: 127.7669 },
      'north korea': { lat: 40.3399, lng: 127.5101 },
      'mongolia': { lat: 46.8625, lng: 103.8467 },
      'afghanistan': { lat: 33.9391, lng: 67.7100 },
      'pakistan': { lat: 30.3753, lng: 69.3451 },
      'bangladesh': { lat: 23.6850, lng: 90.3563 },
      'sri lanka': { lat: 7.8731, lng: 80.7718 },
      'maldives': { lat: 3.2028, lng: 73.2207 },
      'nepal': { lat: 28.3949, lng: 84.1240 },
      'bhutan': { lat: 27.5142, lng: 90.4336 },
      'myanmar': { lat: 21.9162, lng: 95.9560 },
      'thailand': { lat: 15.8700, lng: 100.9925 },
      'laos': { lat: 19.8563, lng: 102.4955 },
      'cambodia': { lat: 12.5657, lng: 104.9910 },
      'vietnam': { lat: 14.0583, lng: 108.2772 },
      'malaysia': { lat: 4.2105, lng: 101.9758 },
      'singapore': { lat: 1.3521, lng: 103.8198 },
      'brunei': { lat: 4.5353, lng: 114.7277 },
      'indonesia': { lat: -0.7893, lng: 113.9213 },
      'east timor': { lat: -8.8742, lng: 125.7275 },
      'philippines': { lat: 12.8797, lng: 121.7740 },
      'papua new guinea': { lat: -6.3150, lng: 143.9555 },
      'solomon islands': { lat: -9.6457, lng: 160.1562 },
      'vanuatu': { lat: -15.3767, lng: 166.9592 },
      'fiji': { lat: -16.5782, lng: 179.4144 },
      'new caledonia': { lat: -20.9043, lng: 165.6180 },
      'samoa': { lat: -13.7590, lng: -172.1046 },
      'tonga': { lat: -21.1789, lng: -175.1982 },
      'kiribati': { lat: -3.3704, lng: -168.7340 },
      'tuvalu': { lat: -7.1095, lng: 177.6493 },
      'nauru': { lat: -0.5228, lng: 166.9315 },
      'palau': { lat: 7.5150, lng: 134.5825 },
      'marshall islands': { lat: 7.1315, lng: 171.1845 },
      'micronesia': { lat: 7.4256, lng: 150.5508 },
      'argentina': { lat: -38.4161, lng: -63.6167 },
      'chile': { lat: -35.6751, lng: -71.5430 },
      'uruguay': { lat: -32.5228, lng: -55.7658 },
      'paraguay': { lat: -23.4425, lng: -58.4438 },
      'bolivia': { lat: -16.2902, lng: -63.5887 },
      'peru': { lat: -9.1900, lng: -75.0152 },
      'ecuador': { lat: -1.8312, lng: -78.1834 },
      'colombia': { lat: 4.5709, lng: -74.2973 },
      'venezuela': { lat: 6.4238, lng: -66.5897 },
      'guyana': { lat: 4.8604, lng: -58.9302 },
      'suriname': { lat: 3.9193, lng: -56.0278 },
      'french guiana': { lat: 3.9339, lng: -53.1258 },
      'falkland islands': { lat: -51.7963, lng: -59.5236 },
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

  // Get real distance using Google Maps Distance Matrix API
  static async getRealDistance(
    originLat: number, 
    originLng: number, 
    destLat: number, 
    destLng: number
  ): Promise<{ distance: number; duration: number; mode: string } | null> {
    try {
      if (!this.GOOGLE_MAPS_API_KEY || this.GOOGLE_MAPS_API_KEY === '') {
        console.warn('[GEOCODING] Google Maps API key not configured, falling back to Haversine calculation');
        return {
          distance: this.calculateDistance(originLat, originLng, destLat, destLng),
          duration: 0,
          mode: 'straight_line'
        };
      }

      const origins = `${originLat},${originLng}`;
      const destinations = `${destLat},${destLng}`;
      
      const url = new URL(this.DISTANCE_MATRIX_URL);
      url.searchParams.set('origins', origins);
      url.searchParams.set('destinations', destinations);
      url.searchParams.set('units', 'metric');
      url.searchParams.set('mode', 'driving'); // Can be 'driving', 'walking', 'bicycling', 'transit'
      url.searchParams.set('avoid', 'tolls'); // Avoid tolls for more practical routes
      url.searchParams.set('key', this.GOOGLE_MAPS_API_KEY);

      console.log(`[GEOCODING] Requesting distance from Google Maps API: ${origins} -> ${destinations}`);
      
      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.status !== 'OK') {
        console.error(`[GEOCODING] Google Maps API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
        return {
          distance: this.calculateDistance(originLat, originLng, destLat, destLng),
          duration: 0,
          mode: 'straight_line'
        };
      }

      const element = data.rows[0]?.elements[0];
      if (!element || element.status !== 'OK') {
        console.warn(`[GEOCODING] Distance calculation failed: ${element?.status || 'No data'}`);
        return {
          distance: this.calculateDistance(originLat, originLng, destLat, destLng),
          duration: 0,
          mode: 'straight_line'
        };
      }

      const distanceKm = Math.round(element.distance.value / 1000); // Convert meters to km
      const durationMinutes = Math.round(element.duration.value / 60); // Convert seconds to minutes

      console.log(`[GEOCODING] Real distance calculated: ${distanceKm}km, ${durationMinutes} minutes driving`);

      return {
        distance: distanceKm,
        duration: durationMinutes,
        mode: 'driving'
      };

    } catch (error) {
      console.error('[GEOCODING] Error getting real distance:', error);
      return {
        distance: this.calculateDistance(originLat, originLng, destLat, destLng),
        duration: 0,
        mode: 'straight_line'
      };
    }
  }

  // Batch distance calculation for multiple destinations
  static async getBatchDistances(
    originLat: number,
    originLng: number,
    destinations: Array<{ lat: number; lng: number; userId: string }>
  ): Promise<Map<string, { distance: number; duration: number; mode: string }>> {
    const results = new Map();

    try {
      if (!this.GOOGLE_MAPS_API_KEY || this.GOOGLE_MAPS_API_KEY === '' || destinations.length === 0) {
        // Fallback to Haversine calculation for all destinations
        for (const dest of destinations) {
          results.set(dest.userId, {
            distance: this.calculateDistance(originLat, originLng, dest.lat, dest.lng),
            duration: 0,
            mode: 'straight_line'
          });
        }
        return results;
      }

      // Google Maps allows up to 25 destinations per request
      const chunks = [];
      for (let i = 0; i < destinations.length; i += 25) {
        chunks.push(destinations.slice(i, i + 25));
      }

      const origins = `${originLat},${originLng}`;

      for (const chunk of chunks) {
        const destinationCoords = chunk.map(d => `${d.lat},${d.lng}`).join('|');
        
        const url = new URL(this.DISTANCE_MATRIX_URL);
        url.searchParams.set('origins', origins);
        url.searchParams.set('destinations', destinationCoords);
        url.searchParams.set('units', 'metric');
        url.searchParams.set('mode', 'driving');
        url.searchParams.set('avoid', 'tolls');
        url.searchParams.set('key', this.GOOGLE_MAPS_API_KEY);

        console.log(`[GEOCODING] Batch distance request for ${chunk.length} destinations`);

        const response = await fetch(url.toString());
        const data = await response.json();

        if (data.status !== 'OK') {
          console.error(`[GEOCODING] Batch distance API error: ${data.status}`);
          // Fallback to Haversine for this chunk
          for (const dest of chunk) {
            results.set(dest.userId, {
              distance: this.calculateDistance(originLat, originLng, dest.lat, dest.lng),
              duration: 0,
              mode: 'straight_line'
            });
          }
          continue;
        }

        // Process results
        const elements = data.rows[0]?.elements || [];
        for (let i = 0; i < chunk.length; i++) {
          const element = elements[i];
          const dest = chunk[i];

          if (element && element.status === 'OK') {
            const distanceKm = Math.round(element.distance.value / 1000);
            const durationMinutes = Math.round(element.duration.value / 60);
            
            results.set(dest.userId, {
              distance: distanceKm,
              duration: durationMinutes,
              mode: 'driving'
            });
          } else {
            // Fallback to Haversine for this specific destination
            results.set(dest.userId, {
              distance: this.calculateDistance(originLat, originLng, dest.lat, dest.lng),
              duration: 0,
              mode: 'straight_line'
            });
          }
        }

        // Add small delay between requests to respect rate limits
        if (chunks.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

    } catch (error) {
      console.error('[GEOCODING] Error in batch distance calculation:', error);
      // Fallback to Haversine for all destinations
      for (const dest of destinations) {
        if (!results.has(dest.userId)) {
          results.set(dest.userId, {
            distance: this.calculateDistance(originLat, originLng, dest.lat, dest.lng),
            duration: 0,
            mode: 'straight_line'
          });
        }
      }
    }

    return results;
  }

  // Format distance for display
  static formatDistance(distanceKm: number, duration?: number, mode?: string): string {
    let distanceText = '';
    
    if (distanceKm < 1) {
      distanceText = 'Less than 1 km';
    } else if (distanceKm < 1000) {
      distanceText = `${distanceKm} km`;
    } else {
      distanceText = `${Math.round(distanceKm / 1000)} thousand km`;
    }

    if (duration && duration > 0 && mode === 'driving') {
      const hours = Math.floor(duration / 60);
      const minutes = duration % 60;
      
      let timeText = '';
      if (hours > 0) {
        timeText = `${hours}h ${minutes}m`;
      } else {
        timeText = `${minutes}m`;
      }
      
      return `${distanceText} (${timeText} drive)`;
    }

    return `${distanceText} away`;
  }
}