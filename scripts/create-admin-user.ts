
import bcrypt from 'bcryptjs';
import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function createAdminUser() {
  try {
    console.log('🔧 Checking for admin user...');
    
    // Check if admin user already exists
    const [existingAdmin] = await db.select().from(users).where(eq(users.username, 'administrator'));
    
    if (existingAdmin) {
      console.log('✅ Admin user already exists');
      
      // Update password and ensure admin role
      const hashedPassword = await bcrypt.hash('12345678', 10);
      await db.update(users)
        .set({ 
          password: hashedPassword,
          role: 'admin',
          displayName: 'Administrator'
        })
        .where(eq(users.username, 'administrator'));
      
      console.log('🔄 Admin user password and role updated');
      return;
    }
    
    // Create new admin user
    const hashedPassword = await bcrypt.hash('12345678', 10);
    
    const adminUserData = {
      username: 'administrator',
      displayName: 'Administrator',
      password: hashedPassword,
      age: 30,
      gender: 'male',
      location: 'System',
      latitude: '0',
      longitude: '0',
      genderPreference: 'all',
      ageMin: 18,
      ageMax: 99,
      role: 'admin',
      avatar: null,
      bio: 'System Administrator',
      dateOfBirth: '1994-01-01',
      isOnline: false,
      isBanned: false,
    };
    
    const [newAdmin] = await db.insert(users).values(adminUserData).returning();
    
    console.log('✅ Admin user created successfully:');
    console.log(`   Username: administrator`);
    console.log(`   Password: 12345678`);
    console.log(`   Role: admin`);
    console.log(`   ID: ${newAdmin.id}`);
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
createAdminUser();
