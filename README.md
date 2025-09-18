# Chatual - Real-Time Chat Application

A modern, full-stack real-time chat application built with React, TypeScript, Node.js, and PostgreSQL. Designed for seamless communication with comprehensive user management and administrative tools.

## 📋 Quick Links

- **[Complete Features Documentation](FEATURES_DOCUMENTATION.md)** - Detailed list of all application features
- **[System Flowcharts & Architecture](SYSTEM_FLOWCHARTS.md)** - Visual diagrams and system architecture
- **[Technical Architecture](#technical-architecture)** - Overview of the technology stack
- **[Getting Started](#getting-started)** - Setup and installation instructions

## 🚀 Key Features

### Core Chat Features
- **Real-time messaging** with WebSocket connections
- **Multi-room support** (public and private rooms)
- **Photo sharing** in messages with AWS S3 integration
- **User mentions** with @username functionality
- **Typing indicators** and online presence tracking
- **Message pagination** with infinite scroll

### User Management
- **Complete user profiles** with photos and preferences
- **Friend system** with requests and private messaging
- **Location-based matching** with distance calculations
- **Privacy controls** and user blocking
- **GDPR compliance** with data export and deletion

### Admin Panel
- **Comprehensive dashboard** with real-time statistics
- **User moderation** (block, ban, message, delete)
- **Report management** with resolution tracking
- **Chatroom management** (create, delete, monitor)
- **Database management** with automated cleanup

### Technical Features
- **Mobile-responsive design** with touch-friendly interface
- **Offline message queuing** with automatic retry
- **Connection recovery** with exponential backoff
- **Performance optimization** with caching and lazy loading
- **Accessibility support** with keyboard navigation

## 🏗️ Technical Architecture

### Frontend Stack
- **React 18** with TypeScript for type-safe development
- **Vite** for fast development and optimized builds
- **shadcn/ui + Radix UI** for accessible, customizable components
- **TanStack Query** for server state management
- **Tailwind CSS** for responsive styling
- **Wouter** for lightweight client-side routing

### Backend Stack
- **Node.js + Express** with TypeScript
- **WebSocket server** using 'ws' library
- **PostgreSQL** with Drizzle ORM for type-safe database operations
- **Session-based authentication** with PostgreSQL storage
- **AWS S3** integration for file storage

### Real-Time Infrastructure
- **WebSocket connections** with automatic reconnection
- **Room-based message broadcasting**
- **Connection pooling** for optimal performance
- **Message deduplication** and delivery confirmation

## 📊 System Overview

```
Frontend (React/TypeScript) 
    ↕️ WebSocket & REST API
Backend (Node.js/Express)
    ↕️ Drizzle ORM
Database (PostgreSQL)
    ↕️ File Storage
AWS S3
```

## 🔧 Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- AWS S3 bucket (for file uploads)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd chatual
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Configure your PostgreSQL and AWS credentials
   ```

4. **Initialize database**
   ```bash
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000`

## 👤 Default Admin Access

In development mode, a default admin account is created:
- **Username**: `chatualladmin`
- **Password**: `Hardcore123!`

Access the admin panel at `/admin`

## 📱 User Interface

### Main Chat Interface
- **Sidebar**: Room list, friends, and navigation
- **Message Area**: Real-time chat with photos and mentions
- **User List**: Online members in current room
- **Mobile Menu**: Responsive navigation for mobile devices

### Profile Settings
- **Basic Profile**: Display name, age, bio, gender
- **Photos**: Upload and manage profile pictures
- **Location**: Set geographic location for matching
- **Privacy**: Control visibility and blocking
- **Notifications**: Configure alerts and sounds

### Admin Dashboard
- **Statistics**: Real-time system metrics
- **User Management**: Comprehensive user controls
- **Moderation**: Report handling and content management
- **System Tools**: Database cleanup and maintenance

## 🗄️ Database Schema

The application uses a comprehensive PostgreSQL schema with the following main tables:

- **users** - User accounts and profile information
- **rooms** - Chat rooms (public and private)
- **messages** - Chat message history
- **user_photos** - Profile photo management
- **blocked_users** - User blocking system
- **friend_requests** - Friend system management
- **reports** - User report and moderation system
- **admin_users** - Administrative account management

## 🔐 Security Features

- **Password hashing** with bcrypt
- **Session security** with HTTP-only cookies
- **Input validation** with Zod schemas
- **CORS protection** for API endpoints
- **SQL injection prevention** through ORM
- **Role-based access control** for admin features

## 📊 Performance & Scalability

- **Message pagination** to handle large chat histories
- **Lazy loading** for images and components
- **Query caching** with TanStack Query
- **WebSocket connection optimization**
- **Database indexing** for fast queries
- **Automated cleanup** to prevent database bloat

## 🌐 GDPR Compliance

- **Data export** functionality for users
- **Account deletion** with complete data removal
- **Cookie consent** management
- **Privacy policy** integration
- **Data retention** policies with automatic cleanup

## 📈 Future Enhancements

- **Voice messages** and audio chat
- **Video calling** integration
- **File sharing** beyond photos
- **Message encryption** for enhanced privacy
- **Mobile app** development
- **Integration APIs** for third-party services

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run db:push` - Push database schema changes
- `npm run db:studio` - Open database studio

### Project Structure

```
├── client/          # React frontend
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Route components
│   │   ├── hooks/       # Custom React hooks
│   │   └── lib/         # Utility libraries
├── server/          # Node.js backend
│   ├── lib/         # Server utilities
│   └── routes.ts    # API endpoints
├── shared/          # Shared TypeScript types
└── drizzle/         # Database migrations
```

## 📝 Documentation

For comprehensive feature documentation and system flowcharts, see:

- **[FEATURES_DOCUMENTATION.md](FEATURES_DOCUMENTATION.md)** - Complete feature list with detailed descriptions
- **[SYSTEM_FLOWCHARTS.md](SYSTEM_FLOWCHARTS.md)** - Visual system architecture and user flow diagrams

## 🤝 Contributing

This is a complete, production-ready application with comprehensive documentation. The codebase follows modern development practices with TypeScript, proper error handling, and extensive feature coverage.

## 📄 License

This project is proprietary software. All rights reserved.

---

**Chatual** - *Connecting people through real-time communication*

*Last Updated: September 18, 2025*