import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { WebSocketProvider } from "@/contexts/websocket-context";
import ChatPage from "@/pages/chat";
import ProfileSettings from "@/pages/profile-settings";
import FriendsPage from "@/pages/friends";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminLogin from "@/pages/admin-login";
import AdminDesk from "@/pages/admin-desk";
import AdminChatroomManagement from "@/pages/admin-chatroom-management";
import UserProfilePage from "@/pages/user-profile";
import PrivacyPolicyPage from "@/pages/privacy-policy";
import NotFound from "@/pages/not-found";
import CookieConsent from "@/components/gdpr/cookie-consent";
import { useState, useEffect } from 'react';
import type { User } from '@shared/schema';

function Router() {
  return (
    <Switch>
      <Route path="/" component={ChatPage} />
      <Route path="/chat" component={ChatPage} />
      <Route path="/settings" component={ProfileSettings} />
      <Route path="/friends" component={FriendsPage} />
      <Route path="/admin" component={AdminLogin} />
      <Route path="/admin/admindesk" component={AdminDesk} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/chatrooms" component={AdminChatroomManagement} />
      <Route path="/profile/:userId" component={UserProfilePage} />
      <Route path="/privacy-policy" component={PrivacyPolicyPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('chatual_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Listen for auth changes across the app
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('chatual_user');
      setCurrentUser(saved ? JSON.parse(saved) : null);
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events in case of same-tab changes
    const handleAuthChange = (event: CustomEvent) => {
      setCurrentUser(event.detail);
    };
    
    window.addEventListener('userAuthChanged', handleAuthChange as EventListener);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userAuthChanged', handleAuthChange as EventListener);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <WebSocketProvider key={currentUser?.id || 'anonymous'} user={currentUser}>
            <Toaster />
            <Router />
            <CookieConsent />
          </WebSocketProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
