import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Cookie, Settings, X, Shield } from 'lucide-react';
import { Link } from 'wouter';

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
}

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true, // Always true, can't be disabled
    analytics: false,
    functional: true,
    marketing: false,
  });

  useEffect(() => {
    // Check if user has already given consent
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAcceptAll = () => {
    const allAccepted = {
      necessary: true,
      analytics: true,
      functional: true,
      marketing: true,
    };
    localStorage.setItem('cookie-consent', JSON.stringify(allAccepted));
    localStorage.setItem('cookie-consent-date', new Date().toISOString());
    setIsVisible(false);
  };

  const handleAcceptSelected = () => {
    localStorage.setItem('cookie-consent', JSON.stringify(preferences));
    localStorage.setItem('cookie-consent-date', new Date().toISOString());
    setIsVisible(false);
  };

  const handleRejectAll = () => {
    const minimal = {
      necessary: true,
      analytics: false,
      functional: false,
      marketing: false,
    };
    localStorage.setItem('cookie-consent', JSON.stringify(minimal));
    localStorage.setItem('cookie-consent-date', new Date().toISOString());
    setIsVisible(false);
  };

  const updatePreference = (key: keyof CookiePreferences, value: boolean) => {
    if (key === 'necessary') return; // Can't disable necessary cookies
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center p-4" data-testid="cookie-consent-overlay">
      <Card className="w-full max-w-2xl border-primary/20 shadow-2xl">
        <div className="p-6">
          {!showSettings ? (
            // Main consent banner
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Cookie className="w-6 h-6 text-primary mt-1" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">Cookie Preferences</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    We use cookies to enhance your experience, analyze site usage, and assist in marketing efforts.
                    You can customize your preferences or accept all cookies to continue.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsVisible(false)}
                  className="p-1"
                  data-testid="button-close-consent"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  onClick={handleAcceptAll}
                  className="flex-1"
                  data-testid="button-accept-all"
                >
                  Accept All Cookies
                </Button>
                <Button
                  onClick={handleRejectAll}
                  variant="outline"
                  className="flex-1"
                  data-testid="button-reject-all"
                >
                  Reject All
                </Button>
                <Button
                  onClick={() => setShowSettings(true)}
                  variant="outline"
                  className="flex items-center"
                  data-testid="button-cookie-settings"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Customize
                </Button>
              </div>

              <div className="text-xs text-muted-foreground pt-2 border-t">
                <p>
                  By continuing to use our site, you consent to our use of cookies. 
                  Read our <Link href="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link> for more information.
                </p>
              </div>
            </div>
          ) : (
            // Detailed settings
            <div className="space-y-6">
              <div className="flex items-start space-x-3">
                <Settings className="w-6 h-6 text-primary mt-1" />
                <div>
                  <h3 className="text-lg font-semibold">Cookie Settings</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage your cookie preferences. Necessary cookies cannot be disabled as they are essential for the site to function.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Necessary Cookies */}
                <div className="flex items-start justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Shield className="w-4 h-4 text-green-500" />
                      <h4 className="font-medium">Necessary Cookies</h4>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Required</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Essential for authentication, security, and basic site functionality.
                    </p>
                  </div>
                  <Switch checked={true} disabled className="mt-1" />
                </div>

                {/* Functional Cookies */}
                <div className="flex items-start justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">Functional Cookies</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Remember your preferences, settings, and enhance user experience.
                    </p>
                  </div>
                  <Switch
                    checked={preferences.functional}
                    onCheckedChange={(checked) => updatePreference('functional', checked)}
                    className="mt-1"
                    data-testid="switch-functional-cookies"
                  />
                </div>

                {/* Analytics Cookies */}
                <div className="flex items-start justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">Analytics Cookies</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Help us understand how users interact with our site to improve performance.
                    </p>
                  </div>
                  <Switch
                    checked={preferences.analytics}
                    onCheckedChange={(checked) => updatePreference('analytics', checked)}
                    className="mt-1"
                    data-testid="switch-analytics-cookies"
                  />
                </div>

                {/* Marketing Cookies */}
                <div className="flex items-start justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">Marketing Cookies</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Used to deliver personalized ads and measure advertising effectiveness.
                    </p>
                  </div>
                  <Switch
                    checked={preferences.marketing}
                    onCheckedChange={(checked) => updatePreference('marketing', checked)}
                    className="mt-1"
                    data-testid="switch-marketing-cookies"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                <Button
                  onClick={() => setShowSettings(false)}
                  variant="outline"
                  className="flex-1"
                  data-testid="button-back-to-consent"
                >
                  Back
                </Button>
                <Button
                  onClick={handleAcceptSelected}
                  className="flex-1"
                  data-testid="button-save-preferences"
                >
                  Save Preferences
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}