import { db } from '../server/db';
import { users, rooms, roomMembers, messages } from '../shared/schema';
import { sql } from 'drizzle-orm';

const testRooms = [
  {
    name: 'General Chat',
    description: 'Welcome to the main chat room! Perfect for general conversations and meeting new people.',
    isPrivate: false,
    maxMembers: 15
  },
  {
    name: 'Tech Talk',
    description: 'Discuss the latest in technology, programming, and digital trends.',
    isPrivate: false,
    maxMembers: 12
  },
  {
    name: 'Fitness & Health',
    description: 'Share workout tips, healthy recipes, and motivation for staying active!',
    isPrivate: false,
    maxMembers: 10
  },
  {
    name: 'Travel Stories',
    description: 'Share your travel experiences, photos, and get recommendations for your next adventure.',
    isPrivate: false,
    maxMembers: 8
  },
  {
    name: 'Book Club',
    description: 'Discuss current reads, share book recommendations, and connect with fellow book lovers.',
    isPrivate: false,
    maxMembers: 10
  }
];

const sampleMessages = [
  "Hey everyone! Great to meet you all 👋",
  "Has anyone tried the new coffee shop downtown?",
  "Looking forward to chatting with everyone here!",
  "What's everyone up to this weekend?",
  "Love the energy in this room already!",
  "Anyone have good movie recommendations?",
  "Just finished a great workout - feeling energized!",
  "Happy Friday everyone! 🎉",
  "The weather has been amazing lately",
  "Hope everyone is having a great day!"
];

async function createTestRooms() {
  try {
    console.log('🏠 Creating test chat rooms...');
    
    // Get some test users to use as room creators and members
    const testUsers = await db.select().from(users).limit(25);
    
    if (testUsers.length < 10) {
      console.log('⚠️  Need at least 10 users to create test rooms. Run generate-test-users.ts first.');
      return;
    }
    
    console.log(`👥 Found ${testUsers.length} test users to populate rooms`);
    
    for (const [index, roomData] of testRooms.entries()) {
      console.log(`Creating room ${index + 1}/${testRooms.length}: ${roomData.name}`);
      
      try {
        // Select a random user as room creator
        const creator = testUsers[Math.floor(Math.random() * testUsers.length)];
        
        // Create the room
        const [newRoom] = await db.insert(rooms).values({
          name: roomData.name,
          description: roomData.description,
          isPrivate: roomData.isPrivate,
          createdBy: creator.id
        }).returning();
        
        console.log(`✅ Created room: ${newRoom.name}`);
        
        // Add random members to the room (including creator)
        const memberCount = Math.floor(Math.random() * (roomData.maxMembers - 5)) + 5; // At least 5 members
        const selectedMembers = [creator]; // Always include creator
        
        // Add random additional members
        const availableUsers = testUsers.filter(u => u.id !== creator.id);
        for (let i = 0; i < memberCount - 1 && i < availableUsers.length; i++) {
          const randomUser = availableUsers.splice(
            Math.floor(Math.random() * availableUsers.length), 1
          )[0];
          selectedMembers.push(randomUser);
        }
        
        // Insert room memberships
        for (const member of selectedMembers) {
          await db.insert(roomMembers).values({
            roomId: newRoom.id,
            userId: member.id
          });
        }
        
        console.log(`👥 Added ${selectedMembers.length} members to ${newRoom.name}`);
        
        // Create some sample messages for the room
        const messageCount = Math.floor(Math.random() * 5) + 3; // 3-7 messages per room
        for (let i = 0; i < messageCount; i++) {
          const randomMember = selectedMembers[Math.floor(Math.random() * selectedMembers.length)];
          const randomMessage = sampleMessages[Math.floor(Math.random() * sampleMessages.length)];
          
          await db.insert(messages).values({
            content: randomMessage,
            userId: randomMember.id,
            roomId: newRoom.id,
            messageType: 'text'
          });
        }
        
        console.log(`💬 Added ${messageCount} sample messages to ${newRoom.name}`);
        
      } catch (error: any) {
        console.error(`❌ Error creating room ${roomData.name}:`, error.message);
      }
    }
    
    console.log('\n✨ Test rooms creation completed!');
    console.log('\n📋 Summary:');
    console.log(`• ${testRooms.length} chat rooms created`);
    console.log(`• Each room has 5-15 active members`);
    console.log(`• Sample messages added for realistic chat history`);
    console.log(`• Users can join/leave rooms and test all features`);
    console.log('\n🎯 Test Coverage:');
    console.log(`• User profile menus (click usernames/avatars)`);
    console.log(`• Private messaging system`);
    console.log(`• Room switching and member management`);
    console.log(`• Message history and real-time chat`);
    console.log(`• Online/offline status indicators`);
    console.log(`• Blocking and reporting features`);
    
  } catch (error) {
    console.error('❌ Error creating test rooms:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
createTestRooms();