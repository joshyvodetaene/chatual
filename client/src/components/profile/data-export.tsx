import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileJson, Eye, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@shared/schema';

interface DataExportProps {
  user: User;
  isMobile?: boolean;
}

export default function DataExport({ user, isMobile = false }: DataExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const exportDataMutation = useMutation({
    mutationFn: async () => {
      setIsExporting(true);
      const response = await fetch(`/api/users/${user.id}/export-data`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to export data');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Create download link
      const filename = `user-data-export-${user.id}-${new Date().toISOString().split('T')[0]}.json`;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Data Export Successful",
        description: "Your data has been downloaded as a JSON file.",
      });
      
      setIsExporting(false);
    },
    onError: (error: any) => {
      console.error('Data export failed:', error);
      
      toast({
        title: "Export Failed",
        description: error.message || 'Failed to export data. Please try again later.',
        variant: "destructive",
      });
      
      setIsExporting(false);
    }
  });

  const handleExportData = () => {
    exportDataMutation.mutate();
  };

  return (
    <Card className={`border-blue-500/20 ${isMobile ? 'mx-0' : ''}`} data-testid="data-export">
      <CardHeader className={isMobile ? 'p-4 pb-3' : ''}>
        <div className="flex items-center space-x-2">
          <Download className="w-5 h-5 text-blue-500" />
          <CardTitle className={`text-blue-500 ${isMobile ? 'text-lg' : ''}`}>
            Export Your Data
          </CardTitle>
        </div>
        <CardDescription className={`${isMobile ? 'text-sm' : ''} text-muted-foreground`}>
          Download a complete copy of your personal data in JSON format (GDPR Article 20 - Right to Data Portability).
        </CardDescription>
      </CardHeader>
      <CardContent className={isMobile ? 'p-4 pt-0' : ''}>
        <div className="space-y-4">
          {/* What's included */}
          <div className="bg-muted/50 p-4 rounded-lg border">
            <h4 className={`font-semibold mb-2 flex items-center ${isMobile ? 'text-sm' : ''}`}>
              <Eye className="w-4 h-4 mr-2" />
              Your export will include:
            </h4>
            <ul className={`space-y-1 ${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
              <li>• Profile information and settings</li>
              <li>• Your photos and media files</li>
              <li>• Message history (last 1,000 messages)</li>
              <li>• Room memberships and preferences</li>
              <li>• Blocked users list</li>
              <li>• Notification settings</li>
              <li>• Reports you've submitted</li>
              <li>• Account activity data</li>
            </ul>
          </div>

          {/* Privacy notice */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start space-x-2">
              <Shield className="w-4 h-4 text-blue-600 mt-0.5" />
              <div>
                <h4 className={`font-semibold text-blue-800 dark:text-blue-200 ${isMobile ? 'text-sm' : ''}`}>
                  Privacy & Security
                </h4>
                <p className={`text-blue-700 dark:text-blue-300 ${isMobile ? 'text-xs' : 'text-sm'} mt-1`}>
                  Your exported data is generated on-demand and sent directly to your device. 
                  We don't store or track these exports. The file is yours to keep and manage.
                </p>
              </div>
            </div>
          </div>

          {/* Export button */}
          <Button
            onClick={handleExportData}
            disabled={isExporting || exportDataMutation.isPending}
            className={`w-full ${isMobile ? 'text-sm py-2' : ''} bg-blue-600 hover:bg-blue-700`}
            data-testid="button-export-data"
          >
            <FileJson className="w-4 h-4 mr-2" />
            {isExporting || exportDataMutation.isPending ? 'Preparing Export...' : 'Download My Data'}
          </Button>

          {/* Legal notice */}
          <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground border-t pt-4`}>
            <p>
              <strong>Legal Notice:</strong> This export complies with GDPR Article 20 (Right to Data Portability).
              The data is provided in a structured, commonly used, and machine-readable format (JSON).
              You may transmit this data to another controller without hindrance.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}