import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, FileText, Download, Settings, Eye, AlertCircle } from 'lucide-react';
import { Link } from 'wouter';
import DataExport from './data-export';
import type { User } from '@shared/schema';

interface GDPRComplianceProps {
  user: User;
  isMobile?: boolean;
}

export default function GDPRCompliance({ user, isMobile = false }: GDPRComplianceProps) {
  return (
    <div className="space-y-6" data-testid="gdpr-compliance">
      {/* GDPR Overview */}
      <Card className="glass-effect backdrop-blur-glass border-primary/20">
        <CardHeader className={isMobile ? 'p-4 pb-3' : ''}>
          <CardTitle className={`flex items-center space-x-2 ${isMobile ? 'text-lg' : ''}`}>
            <Shield className="w-6 h-6 text-primary" />
            <span>Data Protection & Privacy Rights</span>
          </CardTitle>
          <CardDescription className={`${isMobile ? 'text-sm' : ''}`}>
            Your privacy rights under GDPR (General Data Protection Regulation) and how to exercise them.
          </CardDescription>
        </CardHeader>
        <CardContent className={isMobile ? 'p-4 pt-0' : ''}>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Eye className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-600">Right to Access</h4>
                  <p className="text-sm text-muted-foreground">
                    View and export all personal data we have about you
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Download className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-600">Data Portability</h4>
                  <p className="text-sm text-muted-foreground">
                    Transfer your data to another service provider
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Settings className="w-5 h-5 text-purple-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-purple-600">Right to Rectification</h4>
                  <p className="text-sm text-muted-foreground">
                    Correct inaccurate or incomplete personal data
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-600">Right to Erasure</h4>
                  <p className="text-sm text-muted-foreground">
                    Delete your account and associated personal data
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="glass-effect backdrop-blur-glass border-primary/20">
        <CardHeader className={isMobile ? 'p-4 pb-3' : ''}>
          <CardTitle className={`${isMobile ? 'text-lg' : ''}`}>Quick Actions</CardTitle>
          <CardDescription className={`${isMobile ? 'text-sm' : ''}`}>
            Common privacy-related actions you can take right now.
          </CardDescription>
        </CardHeader>
        <CardContent className={isMobile ? 'p-4 pt-0' : ''}>
          <div className="grid sm:grid-cols-2 gap-4">
            <Link href="/privacy-policy">
              <Button variant="outline" className="w-full justify-start h-auto p-4" data-testid="button-privacy-policy">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <div className="text-left">
                    <div className="font-medium">Privacy Policy</div>
                    <div className="text-sm text-muted-foreground">
                      Read our detailed privacy policy
                    </div>
                  </div>
                </div>
              </Button>
            </Link>

            <Button 
              variant="outline" 
              className="w-full justify-start h-auto p-4"
              onClick={() => {
                // Open cookie settings
                const event = new CustomEvent('open-cookie-settings');
                window.dispatchEvent(event);
              }}
              data-testid="button-cookie-settings"
            >
              <div className="flex items-center space-x-3">
                <Settings className="w-5 h-5 text-purple-500" />
                <div className="text-left">
                  <div className="font-medium">Cookie Settings</div>
                  <div className="text-sm text-muted-foreground">
                    Manage cookie preferences
                  </div>
                </div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Export Component */}
      <DataExport user={user} isMobile={isMobile} />

      {/* Contact Information */}
      <Card className="glass-effect backdrop-blur-glass border-orange-500/20">
        <CardHeader className={isMobile ? 'p-4 pb-3' : ''}>
          <CardTitle className={`text-orange-600 ${isMobile ? 'text-lg' : ''}`}>
            Data Protection Contact
          </CardTitle>
          <CardDescription className={`${isMobile ? 'text-sm' : ''}`}>
            Need help with your privacy rights or have data protection concerns?
          </CardDescription>
        </CardHeader>
        <CardContent className={isMobile ? 'p-4 pt-0' : ''}>
          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
            <div className="space-y-2">
              <p className={`font-medium text-orange-800 dark:text-orange-200 ${isMobile ? 'text-sm' : ''}`}>
                Data Protection Officer (DPO)
              </p>
              <p className={`text-orange-700 dark:text-orange-300 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                <strong>Email:</strong> dpo@chatapp.com<br />
                <strong>Response Time:</strong> Within 30 days (GDPR requirement)<br />
                <strong>Languages:</strong> English, German, French, Spanish
              </p>
              <p className={`text-orange-600 dark:text-orange-400 ${isMobile ? 'text-xs' : 'text-sm'} mt-3`}>
                You can also file a complaint with your local data protection authority if you believe
                your privacy rights have been violated.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}