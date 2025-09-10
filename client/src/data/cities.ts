// Major cities in Germany, Switzerland, and Austria for autocomplete suggestions
export const DACH_CITIES = [
  // Germany - Major cities
  'Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt am Main', 'Stuttgart', 'Düsseldorf', 
  'Leipzig', 'Dortmund', 'Essen', 'Bremen', 'Dresden', 'Hannover', 'Nürnberg', 'Duisburg',
  'Bochum', 'Wuppertal', 'Bielefeld', 'Bonn', 'Münster', 'Karlsruhe', 'Mannheim', 'Augsburg',
  'Wiesbaden', 'Mönchengladbach', 'Gelsenkirchen', 'Aachen', 'Braunschweig', 'Chemnitz',
  'Kiel', 'Krefeld', 'Halle (Saale)', 'Magdeburg', 'Freiburg im Breisgau', 'Oberhausen',
  'Lübeck', 'Erfurt', 'Mainz', 'Rostock', 'Kassel', 'Hagen', 'Saarbrücken', 'Hamm',
  'Potsdam', 'Ludwigshafen am Rhein', 'Oldenburg', 'Leverkusen', 'Osnabrück', 'Solingen',
  'Heidelberg', 'Herne', 'Neuss', 'Darmstadt', 'Paderborn', 'Regensburg', 'Ingolstadt',
  'Würzburg', 'Fürth', 'Wolfsburg', 'Offenbach am Main', 'Ulm', 'Heilbronn', 'Pforzheim',
  'Göttingen', 'Bottrop', 'Trier', 'Recklinghausen', 'Reutlingen', 'Bremerhaven',
  'Koblenz', 'Bergisch Gladbach', 'Jena', 'Remscheid', 'Erlangen', 'Moers', 'Siegen',
  'Hildesheim', 'Salzgitter', 'Cottbus',

  // Switzerland - Major cities
  'Zürich', 'Genève', 'Basel', 'Lausanne', 'Bern', 'Winterthur', 'Luzern', 'St. Gallen',
  'Lugano', 'Biel/Bienne', 'Thun', 'Köniz', 'La Chaux-de-Fonds', 'Schaffhausen', 'Fribourg',
  'Vernier', 'Chur', 'Neuchâtel', 'Uster', 'Sion', 'Emmen', 'Yverdon-les-Bains', 'Zug',
  'Kriens', 'Rapperswil-Jona', 'Dübendorf', 'Dietikon', 'Montreux', 'Frauenfeld', 'Wetzikon',
  'Baar', 'Nyon', 'Rheinfelden', 'Kloten', 'Bülach', 'Renens', 'Wädenswil', 'Allschwil',
  'Carouge', 'Baden', 'Meyrin', 'Wil', 'Bellinzona', 'Oftringen', 'Adliswil', 'Opfikon',
  'Kreuzlingen', 'Solothurn', 'Wettingen', 'Pratteln', 'Gossau', 'Schwyz', 'Ebikon',
  'Riehen', 'Horgen', 'Burgdorf', 'Grenchen', 'Volketswil', 'Lancy', 'Küsnacht', 'Martigny',

  // Austria - Major cities  
  'Wien', 'Graz', 'Linz', 'Salzburg', 'Innsbruck', 'Klagenfurt am Wörthersee', 'Villach',
  'Wels', 'Sankt Pölten', 'Dornbirn', 'Steyr', 'Wiener Neustadt', 'Feldkirch', 'Bregenz',
  'Leonding', 'Klosterneuburg', 'Baden bei Wien', 'Wolfsberg', 'Leoben', 'Krems an der Donau',
  'Traun', 'Amstetten', 'Lustenau', 'Kapfenberg', 'Mödling', 'Hallein', 'Kufstein',
  'Traiskirchen', 'Schwechat', 'Braunau am Inn', 'Stockerau', 'Saalfelden am Steinernen Meer',
  'Ansfelden', 'Tulln an der Donau', 'Hohenems', 'Spittal an der Drau', 'Telfs', 'Ternitz',
  'Perchtoldsdorf', 'Feldkirchen in Kärnten', 'Bludenz', 'Bad Ischl', 'Eisenstadt',
  'Mistelbach', 'Zwettl-Niederösterreich', 'Vöcklabruck', 'Korneuburg', 'Wörgl', 'Götzis',
  'St. Andrä', 'Seekirchen am Wallersee', 'Groß-Enzersdorf', 'Rankweil', 'Hollabrunn',
  'Neunkirchen', 'Gänserndorf', 'Melk', 'Laakirchen', 'Lienz'
];

export const COUNTRY_CODES = ['DE', 'CH', 'AT'] as const;
export type CountryCode = typeof COUNTRY_CODES[number];

export function filterCities(query: string): string[] {
  if (!query.trim()) return [];
  
  const lowerQuery = query.toLowerCase();
  return DACH_CITIES
    .filter(city => city.toLowerCase().includes(lowerQuery))
    .slice(0, 10); // Limit to 10 suggestions
}