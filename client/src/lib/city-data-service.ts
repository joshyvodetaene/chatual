export interface CityData {
  city: string;
  lat: string;
  lng: string;
  country: string;
  iso2: string;
  admin_name: string;
  capital: string;
  population: string;
  population_proper: string;
}

export interface CitySuggestion {
  name: string;
  country: string;
  adminArea: string;
  latitude: number;
  longitude: number;
  population: number;
}

// Load city data asynchronously
let allCityData: CityData[] = [];
let isDataLoaded = false;

async function loadCityData(): Promise<CityData[]> {
  if (isDataLoaded) {
    return allCityData;
  }

  try {
    const [deResponse, atResponse, chResponse] = await Promise.all([
      fetch('/attached_assets/de_1757498700690.json'),
      fetch('/attached_assets/at_1757498700692.json'),
      fetch('/attached_assets/ch_1757498700693.json')
    ]);

    const [deData, atData, chData] = await Promise.all([
      deResponse.json() as Promise<CityData[]>,
      atResponse.json() as Promise<CityData[]>,
      chResponse.json() as Promise<CityData[]>
    ]);

    allCityData = [...deData, ...atData, ...chData];
    isDataLoaded = true;
    return allCityData;
  } catch (error) {
    console.error('Failed to load city data:', error);
    return [];
  }
}

// Create a city search index for better performance
function createSearchIndex(cities: CityData[]) {
  return cities.map(city => ({
    ...city,
    searchTerm: city.city.toLowerCase(),
    countryName: getCountryName(city.iso2),
    populationNum: parseInt(city.population) || 0
  }));
}

function getCountryName(iso2: string): string {
  switch (iso2) {
    case 'DE': return 'Germany';
    case 'AT': return 'Austria';
    case 'CH': return 'Switzerland';
    default: return iso2;
  }
}

export async function searchCities(query: string, limit: number = 10): Promise<CitySuggestion[]> {
  if (!query || query.length < 2) {
    return [];
  }

  const cityData = await loadCityData();
  if (cityData.length === 0) {
    return [];
  }

  const searchIndex = createSearchIndex(cityData);
  const searchTerm = query.toLowerCase();
  
  // Find matching cities
  const matches = searchIndex
    .filter(city => city.searchTerm.includes(searchTerm))
    .sort((a, b) => {
      // Prioritize exact matches at the beginning
      const aStartsWith = a.searchTerm.startsWith(searchTerm);
      const bStartsWith = b.searchTerm.startsWith(searchTerm);
      
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      
      // Then sort by population (larger cities first)
      return b.populationNum - a.populationNum;
    })
    .slice(0, limit)
    .map(city => ({
      name: city.city,
      country: city.countryName,
      adminArea: city.admin_name,
      latitude: parseFloat(city.lat),
      longitude: parseFloat(city.lng),
      population: city.populationNum
    }));

  return matches;
}

export async function getCityByName(cityName: string, countryCode?: string): Promise<CitySuggestion | null> {
  const cityData = await loadCityData();
  if (cityData.length === 0) {
    return null;
  }

  const searchIndex = createSearchIndex(cityData);
  const searchTerm = cityName.toLowerCase();
  
  const match = searchIndex.find(city => {
    const nameMatches = city.searchTerm === searchTerm;
    const countryMatches = !countryCode || city.iso2 === countryCode;
    return nameMatches && countryMatches;
  });

  if (!match) return null;

  return {
    name: match.city,
    country: match.countryName,
    adminArea: match.admin_name,
    latitude: parseFloat(match.lat),
    longitude: parseFloat(match.lng),
    population: match.populationNum
  };
}

// Get popular cities from each country (for initial suggestions)
export async function getPopularCities(count: number = 20): Promise<CitySuggestion[]> {
  const cityData = await loadCityData();
  if (cityData.length === 0) {
    return [];
  }

  const searchIndex = createSearchIndex(cityData);
  const popularByCountry = {
    DE: searchIndex.filter(city => city.iso2 === 'DE').slice(0, 8),
    AT: searchIndex.filter(city => city.iso2 === 'AT').slice(0, 6),
    CH: searchIndex.filter(city => city.iso2 === 'CH').slice(0, 6)
  };

  const popular = [
    ...popularByCountry.DE,
    ...popularByCountry.AT,
    ...popularByCountry.CH
  ]
    .sort((a, b) => b.populationNum - a.populationNum)
    .slice(0, count)
    .map(city => ({
      name: city.city,
      country: city.countryName,
      adminArea: city.admin_name,
      latitude: parseFloat(city.lat),
      longitude: parseFloat(city.lng),
      population: city.populationNum
    }));

  return popular;
}