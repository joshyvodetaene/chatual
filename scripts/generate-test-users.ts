import bcrypt from 'bcryptjs';
import { db } from '../server/db';
import { users, userPhotos } from '../shared/schema';

interface TestUser {
  username: string;
  displayName: string;
  password: string;
  gender: 'male' | 'female';
  location: string;
  latitude: string;
  longitude: string;
  bio: string;
  dateOfBirth: string;
  genderPreference: 'male' | 'female' | 'all';
  ageMin: number;
  ageMax: number;
  role: string;
}

// Realistic test data
const maleNames = [
  'Alex Johnson', 'Marcus Chen', 'David Rodriguez', 'James Wilson', 'Ryan Thompson',
  'Kevin Park', 'Michael Davis', 'Daniel Kim', 'Christopher Lee', 'Matthew Garcia',
  'Joshua Martinez', 'Andrew Brown', 'Benjamin Taylor', 'Nathan Moore', 'Tyler Clark'
];

const femaleNames = [
  'Sarah Williams', 'Emma Johnson', 'Jessica Chen', 'Ashley Davis', 'Amanda Rodriguez',
  'Jennifer Kim', 'Lauren Thompson', 'Stephanie Wilson', 'Michelle Garcia', 'Rebecca Martinez',
  'Nicole Brown', 'Samantha Taylor', 'Rachel Moore', 'Amy Clark', 'Lisa Anderson'
];

const cities = [
  { name: 'New York, NY', lat: '40.7128', lng: '-74.0060' },
  { name: 'Los Angeles, CA', lat: '34.0522', lng: '-118.2437' },
  { name: 'Chicago, IL', lat: '41.8781', lng: '-87.6298' },
  { name: 'Houston, TX', lat: '29.7604', lng: '-95.3698' },
  { name: 'Phoenix, AZ', lat: '33.4484', lng: '-112.0740' },
  { name: 'Philadelphia, PA', lat: '39.9526', lng: '-75.1652' },
  { name: 'San Antonio, TX', lat: '29.4241', lng: '-98.4936' },
  { name: 'San Diego, CA', lat: '32.7157', lng: '-117.1611' },
  { name: 'Dallas, TX', lat: '32.7767', lng: '-96.7970' },
  { name: 'Austin, TX', lat: '30.2672', lng: '-97.7431' },
  { name: 'Jacksonville, FL', lat: '30.3322', lng: '-81.6557' },
  { name: 'San Jose, CA', lat: '37.3382', lng: '-121.8863' },
  { name: 'Fort Worth, TX', lat: '32.7555', lng: '-97.3308' },
  { name: 'Columbus, OH', lat: '39.9612', lng: '-82.9988' },
  { name: 'Charlotte, NC', lat: '35.2271', lng: '-80.8431' },
  { name: 'Seattle, WA', lat: '47.6062', lng: '-122.3321' },
  { name: 'Denver, CO', lat: '39.7392', lng: '-104.9903' },
  { name: 'Boston, MA', lat: '42.3601', lng: '-71.0589' },
  { name: 'Nashville, TN', lat: '36.1627', lng: '-86.7816' },
  { name: 'Portland, OR', lat: '45.5152', lng: '-122.6784' }
];

const maleBios = [
  "Love hiking and outdoor adventures. Always up for trying new restaurants and exploring the city.",
  "Software engineer by day, guitarist by night. Looking for someone who shares my passion for music.",
  "Fitness enthusiast who enjoys rock climbing and CrossFit. Also love cooking and trying new recipes.",
  "Travel addict who's been to 25 countries. Next stop: Japan! Love photography and street food.",
  "Dog dad to a golden retriever. Enjoy craft beer, board games, and weekend camping trips.",
  "Marathon runner and yoga enthusiast. Believe in work-life balance and mindful living.",
  "Coffee connoisseur and bookworm. Spend weekends exploring farmers markets and local cafes.",
  "Tech startup founder with a passion for sustainable living and renewable energy.",
  "Professional chef who loves experimenting with fusion cuisine. Foodie at heart.",
  "Marine biologist who spends free time surfing and diving. Ocean conservation advocate.",
  "Former teacher turned freelance writer. Love poetry, indie films, and long walks.",
  "Architect with a passion for urban design. Enjoy cycling and visiting art museums.",
  "Personal trainer who believes fitness should be fun. Rock climbing and snowboarding enthusiast.",
  "Musician and sound engineer. Love live concerts, vinyl records, and acoustic sessions.",
  "Environmental scientist working on climate change research. Avid hiker and nature photographer."
];

const femaleBios = [
  "Yoga instructor and wellness coach. Love meditation, organic cooking, and weekend retreats.",
  "Graphic designer with a passion for sustainable fashion. Enjoy vintage shopping and art galleries.",
  "Nurse practitioner who loves helping others. Spend free time gardening and reading mystery novels.",
  "Travel blogger who's explored 30+ countries. Always planning the next adventure!",
  "Cat mom to two rescue cats. Love cozy nights in, true crime podcasts, and homemade pizza.",
  "Marketing professional with a creative soul. Enjoy painting, wine tasting, and live music.",
  "Elementary school teacher who loves working with kids. Enjoy baking, hiking, and board games.",
  "Veterinarian and animal rights advocate. Spend weekends volunteering at animal shelters.",
  "Freelance photographer specializing in portraits. Love capturing genuine moments and emotions.",
  "Lawyer by profession, dancer by passion. Enjoy salsa classes, cooking, and wine country trips.",
  "Pharmacist with a love for chemistry and helping patients. Enjoy rock climbing and camping.",
  "Social worker dedicated to community service. Love farmers markets and sustainable living.",
  "Interior designer with an eye for modern aesthetics. Enjoy home renovation and antique hunting.",
  "Physical therapist who helps athletes recover. Love running, cycling, and outdoor yoga sessions.",
  "Journalist and aspiring novelist. Enjoy coffee shops, book clubs, and investigative stories."
];

function getRandomAge(min: number = 22, max: number = 35): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateDateOfBirth(age: number): string {
  const today = new Date();
  const birthYear = today.getFullYear() - age;
  const birthMonth = Math.floor(Math.random() * 12);
  const birthDay = Math.floor(Math.random() * 28) + 1;
  return `${birthYear}-${String(birthMonth + 1).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;
}

function generateUsername(displayName: string): string {
  const name = displayName.toLowerCase().replace(/\s+/g, '');
  const randomNum = Math.floor(Math.random() * 999) + 1;
  return `${name}${randomNum}`;
}

function getRandomPreference(): 'male' | 'female' | 'all' {
  const preferences = ['male', 'female', 'all'];
  return preferences[Math.floor(Math.random() * preferences.length)] as 'male' | 'female' | 'all';
}

async function generateTestUsers(): Promise<TestUser[]> {
  const testUsers: TestUser[] = [];
  const hashedPassword = await bcrypt.hash('testpassword123', 10);
  
  // Generate 15 male users
  for (let i = 0; i < 15; i++) {
    const displayName = maleNames[i];
    const age = getRandomAge();
    const city = cities[Math.floor(Math.random() * cities.length)];
    
    testUsers.push({
      username: generateUsername(displayName),
      displayName,
      password: hashedPassword,
      gender: 'male',
      location: city.name,
      latitude: city.lat,
      longitude: city.lng,
      bio: maleBios[i],
      dateOfBirth: generateDateOfBirth(age),
      genderPreference: getRandomPreference(),
      ageMin: Math.max(18, age - 5),
      ageMax: Math.min(45, age + 10),
      role: 'user'
    });
  }
  
  // Generate 15 female users
  for (let i = 0; i < 15; i++) {
    const displayName = femaleNames[i];
    const age = getRandomAge();
    const city = cities[Math.floor(Math.random() * cities.length)];
    
    testUsers.push({
      username: generateUsername(displayName),
      displayName,
      password: hashedPassword,
      gender: 'female',
      location: city.name,
      latitude: city.lat,
      longitude: city.lng,
      bio: femaleBios[i],
      dateOfBirth: generateDateOfBirth(age),
      genderPreference: getRandomPreference(),
      ageMin: Math.max(18, age - 5),
      ageMax: Math.min(45, age + 10),
      role: 'user'
    });
  }
  
  return testUsers;
}

async function insertTestUsers() {
  try {
    console.log('🚀 Generating 30 test users...');
    
    const testUsers = await generateTestUsers();
    
    console.log('📝 Inserting users into database...');
    
    for (const [index, userData] of testUsers.entries()) {
      console.log(`Creating user ${index + 1}/30: ${userData.displayName}`);
      
      try {
        // Insert user
        const [newUser] = await db.insert(users).values(userData).returning();
        console.log(`✅ Created user: ${newUser.displayName} (${newUser.username})`);
        
        // Note: Profile photos will be created separately using the image generation tool
        
      } catch (error: any) {
        if (error.code === '23505') { // Unique constraint violation
          console.log(`⚠️  User ${userData.username} already exists, skipping...`);
        } else {
          console.error(`❌ Error creating user ${userData.displayName}:`, error.message);
        }
      }
    }
    
    console.log('\n✨ Test user generation completed!');
    console.log('\n📋 Summary:');
    console.log(`• 30 users with realistic profiles`);
    console.log(`• Ages range from 22-35 years old`);
    console.log(`• Locations across major US cities`);
    console.log(`• Diverse bios and preferences`);
    console.log(`• Password for all test users: testpassword123`);
    console.log('\n🖼️  Note: Profile images can be generated separately for each user.');
    
  } catch (error) {
    console.error('❌ Error generating test users:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
insertTestUsers();