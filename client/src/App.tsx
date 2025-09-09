import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ChatPage from "@/pages/chat";
import ProfileSettings from "@/pages/profile-settings";
import FriendsPage from "@/pages/friends";
import AdminDashboard from "@/pages/admin-dashboard";
import UserProfilePage from "@/pages/user-profile";
import PrivacyPolicyPage from "@/pages/privacy-policy";
import NotFound from "@/pages/not-found";
import CookieConsent from "@/components/gdpr/cookie-consent";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ChatPage} />
      <Route path="/chat" component={ChatPage} />
      <Route path="/settings" component={ProfileSettings} />
      <Route path="/friends" component={FriendsPage} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/profile/:userId" component={UserProfilePage} />
      <Route path="/privacy-policy" component={PrivacyPolicyPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
          <CookieConsent />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
