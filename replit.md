# Project Overview

## Overview

This is a real-time chat application built with a modern full-stack architecture. The application allows users to create accounts, join chat rooms, send messages, and see other users' online status in real-time. It features a clean, responsive user interface with support for typing indicators and real-time message delivery through WebSocket connections.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript running on Vite for fast development and build processes
- **UI Framework**: shadcn/ui components built on top of Radix UI primitives for accessibility and customization
- **Styling**: Tailwind CSS with CSS variables for theming and responsive design
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Real-time Communication**: Native WebSocket API for bidirectional communication with the server

### Backend Architecture
- **Runtime**: Node.js with Express.js framework for HTTP server and API endpoints
- **Language**: TypeScript with ES modules for type safety and modern JavaScript features
- **Real-time**: WebSocket server using the 'ws' library for real-time chat functionality
- **Development**: tsx for TypeScript execution in development, esbuild for production builds
- **Static Files**: Vite integration for serving the React frontend in development

### Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Connection**: Neon Database serverless PostgreSQL for cloud hosting
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Session Storage**: connect-pg-simple for PostgreSQL-backed session storage
- **Development Storage**: In-memory storage implementation for rapid development and testing

### Authentication and Authorization
- **Strategy**: Simple username-based authentication with session management
- **Session Storage**: PostgreSQL-backed sessions with connect-pg-simple middleware
- **User Management**: User creation and login through REST API endpoints
- **Persistence**: localStorage for client-side user preference storage

### Real-time Features
- **WebSocket Management**: Custom WebSocket connection handling with user room management
- **Message Broadcasting**: Room-based message distribution to connected clients
- **Online Presence**: Real-time user online/offline status tracking and broadcasting
- **Typing Indicators**: Live typing status updates within chat rooms

### Database Maintenance
- **Automated Message Cleanup**: Daily scheduled task that automatically removes old messages, keeping only the 40 newest messages per chat room to prevent database bloat
- **Manual Cleanup Controls**: Admin endpoints for triggering message cleanup on-demand and checking cleanup status
- **Cleanup Logging**: Comprehensive logging of cleanup operations with statistics on messages deleted and rooms cleaned

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Drizzle ORM**: Type-safe database toolkit with automatic TypeScript inference
- **PostgreSQL**: Relational database for persistent data storage

### UI and Design System
- **shadcn/ui**: Pre-built component library with customizable design tokens
- **Radix UI**: Unstyled, accessible UI primitives for complex components
- **Tailwind CSS**: Utility-first CSS framework with design system integration
- **Lucide React**: Feather-style icon library for consistent iconography

### Development and Build Tools
- **Vite**: Fast build tool with hot module replacement for development
- **TypeScript**: Static type checking and modern JavaScript features
- **esbuild**: Fast JavaScript bundler for production builds
- **Replit Integration**: Development environment integration with runtime error handling

### Client-side Libraries
- **TanStack Query**: Server state management with caching and synchronization
- **React Hook Form**: Form handling with validation and error management
- **date-fns**: Date manipulation and formatting utilities
- **Wouter**: Minimalist routing library for single-page applications