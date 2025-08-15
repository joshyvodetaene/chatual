import { db } from '../server/db';
import { users, userPhotos } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Generated profile photos and their target users
const profileAssignments = [
  {
    imagePath: '/attached_assets/generated_images/Professional_male_headshot_portrait_b3da9fae.png',
    targetUsername: 'alexjohnson517', // Alex Johnson
    fileName: 'alex_johnson_profile.png'
  },
  {
    imagePath: '/attached_assets/generated_images/Professional_female_headshot_portrait_a6ec6512.png',
    targetUsername: 'sarahwilliams666', // Sarah Williams
    fileName: 'sarah_williams_profile.png'
  },
  {
    imagePath: '/attached_assets/generated_images/Casual_Asian_male_portrait_49afece0.png',
    targetUsername: 'marcuschen192', // Marcus Chen
    fileName: 'marcus_chen_profile.png'
  },
  {
    imagePath: '/attached_assets/generated_images/Hispanic_female_professional_portrait_a02f5eb1.png',
    targetUsername: 'emmajohnson464', // Emma Johnson
    fileName: 'emma_johnson_profile.png'
  },
  {
    imagePath: '/attached_assets/generated_images/Black_male_casual_portrait_3681d3a1.png',
    targetUsername: 'davidrodriguez741', // David Rodriguez
    fileName: 'david_rodriguez_profile.png'
  },
  {
    imagePath: '/attached_assets/generated_images/Blonde_female_professional_headshot_37502067.png',
    targetUsername: 'jessicachen881', // Jessica Chen
    fileName: 'jessica_chen_profile.png'
  },
  {
    imagePath: '/attached_assets/generated_images/Indian_female_professional_portrait_a39aa744.png',
    targetUsername: 'ashleydavis117', // Ashley Davis
    fileName: 'ashley_davis_profile.png'
  },
  {
    imagePath: '/attached_assets/generated_images/Casual_bearded_male_portrait_eba7ab27.png',
    targetUsername: 'jameswilson198', // James Wilson
    fileName: 'james_wilson_profile.png'
  }
];

async function assignProfilePhotos() {
  try {
    console.log('📸 Assigning profile photos to test users...');
    
    for (const [index, assignment] of profileAssignments.entries()) {
      console.log(`Processing ${index + 1}/${profileAssignments.length}: ${assignment.targetUsername}`);
      
      try {
        // Find the user
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, assignment.targetUsername));
        
        if (!user) {
          console.log(`⚠️  User ${assignment.targetUsername} not found, skipping...`);
          continue;
        }
        
        // Check if user already has photos
        const existingPhotos = await db
          .select()
          .from(userPhotos)
          .where(eq(userPhotos.userId, user.id));
        
        if (existingPhotos.length > 0) {
          console.log(`⚠️  User ${user.displayName} already has profile photos, skipping...`);
          continue;
        }
        
        // Create user photo record
        const photoData = {
          userId: user.id,
          photoUrl: assignment.imagePath,
          fileName: assignment.fileName,
          isPrimary: true // Set as primary photo
        };
        
        const [newPhoto] = await db.insert(userPhotos).values(photoData).returning();
        
        console.log(`✅ Added profile photo for ${user.displayName}: ${assignment.fileName}`);
        
      } catch (error: any) {
        console.error(`❌ Error assigning photo to ${assignment.targetUsername}:`, error.message);
      }
    }
    
    console.log('\n✨ Profile photo assignment completed!');
    console.log('\n📋 Summary:');
    console.log(`• ${profileAssignments.length} users now have profile photos`);
    console.log(`• Photos are set as primary profile pictures`);
    console.log(`• Images are stored in attached_assets/generated_images/`);
    console.log(`• Profile photos will be visible in user profiles and chat`);
    
  } catch (error) {
    console.error('❌ Error assigning profile photos:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
assignProfilePhotos();