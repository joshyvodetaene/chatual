import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Shield, Eye, Lock, Database, Globe, Users } from 'lucide-react';
import { Link } from 'wouter';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-8">
          <Link href="/profile">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <Shield className="w-8 h-8 mr-3 text-primary" />
              Privacy Policy
            </h1>
            <p className="text-muted-foreground mt-2">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Introduction */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Eye className="w-5 h-5 mr-2" />
                Introduction
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                This Privacy Policy explains how we collect, use, process, and protect your personal information
                when you use our chat application. We are committed to protecting your privacy and ensuring
                transparency about our data practices.
              </p>
              <p>
                <strong>Data Controller:</strong> Chat Application Inc.<br />
                <strong>Contact:</strong> privacy@chatapp.com<br />
                <strong>Legal Basis:</strong> GDPR Article 6(1)(b) - Contract performance and GDPR Article 6(1)(f) - Legitimate interests
              </p>
            </CardContent>
          </Card>

          {/* Data Collection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="w-5 h-5 mr-2" />
                What Data We Collect
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Personal Information</h4>
                  <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
                    <li>Username and display name</li>
                    <li>Age and location (optional)</li>
                    <li>Profile photos and bio</li>
                    <li>Account preferences and settings</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Communication Data</h4>
                  <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
                    <li>Messages sent in chat rooms</li>
                    <li>Private messages and conversations</li>
                    <li>Reactions and interactions</li>
                    <li>Room memberships and participation</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Technical Data</h4>
                  <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
                    <li>IP address and device information</li>
                    <li>Browser type and version</li>
                    <li>Usage patterns and analytics</li>
                    <li>Session and authentication data</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* How We Use Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Globe className="w-5 h-5 mr-2" />
                How We Use Your Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium">Service Provision</p>
                    <p className="text-sm text-muted-foreground">
                      Enable chat functionality, user connections, and app features
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium">Safety & Security</p>
                    <p className="text-sm text-muted-foreground">
                      Prevent abuse, detect spam, and maintain community standards
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium">Communication</p>
                    <p className="text-sm text-muted-foreground">
                      Send notifications, updates, and respond to your inquiries
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium">Legal Compliance</p>
                    <p className="text-sm text-muted-foreground">
                      Comply with legal obligations and respond to law enforcement
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Your Rights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Your GDPR Rights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-green-600">Right to Access</h4>
                    <p className="text-sm text-muted-foreground">
                      View and export all your personal data
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-blue-600">Right to Rectification</h4>
                    <p className="text-sm text-muted-foreground">
                      Correct inaccurate or incomplete data
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-red-600">Right to Erasure</h4>
                    <p className="text-sm text-muted-foreground">
                      Delete your account and personal data
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-purple-600">Right to Portability</h4>
                    <p className="text-sm text-muted-foreground">
                      Transfer your data to another service
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-orange-600">Right to Restrict</h4>
                    <p className="text-sm text-muted-foreground">
                      Limit how we process your data
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-yellow-600">Right to Object</h4>
                    <p className="text-sm text-muted-foreground">
                      Object to certain data processing
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Lock className="w-5 h-5 mr-2" />
                Data Security & Retention
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Security Measures</h4>
                <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
                  <li>End-to-end encryption for sensitive communications</li>
                  <li>Secure HTTPS connections and encrypted data storage</li>
                  <li>Regular security audits and vulnerability assessments</li>
                  <li>Access controls and employee training programs</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Data Retention</h4>
                <p className="text-sm text-muted-foreground">
                  We retain your data only as long as necessary to provide our services or as required by law.
                  Account data is deleted within 30 days of account deletion. Messages may be anonymized
                  to preserve chat history integrity.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact & Complaints</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                For privacy-related questions, data requests, or complaints, please contact us:
              </p>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p><strong>Email:</strong> privacy@chatapp.com</p>
                <p><strong>Data Protection Officer:</strong> dpo@chatapp.com</p>
                <p><strong>Response Time:</strong> Within 30 days as required by GDPR</p>
              </div>
              <p className="text-sm text-muted-foreground">
                You also have the right to lodge a complaint with your local data protection authority
                if you believe we have not addressed your concerns adequately.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}