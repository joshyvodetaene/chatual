import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Eye, MessageSquare, Calendar, User as UserIcon, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { ReportWithDetails } from '@shared/schema';

interface ReportsManagementProps {
  reports: ReportWithDetails[];
}

export default function ReportsManagement({ reports }: ReportsManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedReport, setSelectedReport] = useState<ReportWithDetails | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [newStatus, setNewStatus] = useState<'reviewed' | 'resolved' | 'dismissed'>('reviewed');

  const updateReportMutation = useMutation({
    mutationFn: async ({ reportId, status, adminNotes }: { reportId: string; status: string; adminNotes?: string }) => {
      return await apiRequest('PUT', `/api/admin/reports/${reportId}/status`, {
        status,
        adminNotes,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Report status updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/moderation-data'] });
      setReviewDialogOpen(false);
      setSelectedReport(null);
      setAdminNotes('');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update report status',
        variant: 'destructive',
      });
    },
  });

  const handleReviewReport = (report: ReportWithDetails) => {
    setSelectedReport(report);
    setAdminNotes(report.adminNotes || '');
    setNewStatus(report.status === 'pending' ? 'reviewed' : report.status as any);
    setReviewDialogOpen(true);
  };

  const handleUpdateReport = () => {
    if (!selectedReport) return;

    updateReportMutation.mutate({
      reportId: selectedReport.id,
      status: newStatus,
      adminNotes: adminNotes.trim() || undefined,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'destructive';
      case 'reviewed': return 'secondary';
      case 'resolved': return 'default';
      case 'dismissed': return 'outline';
      default: return 'secondary';
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pendingReports = reports.filter(r => r.status === 'pending');
  const otherReports = reports.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-6" data-testid="reports-management">
      {/* Pending Reports Section */}
      {pendingReports.length > 0 && (
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Pending Reports ({pendingReports.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {pendingReports.map((report) => (
              <Card key={report.id} className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">
                        Report against {report.reportedUser.displayName}
                      </CardTitle>
                      <CardDescription className="flex items-center space-x-4 text-sm">
                        <span className="flex items-center space-x-1">
                          <UserIcon className="w-3 h-3" />
                          <span>By {report.reporter.displayName}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(report.reportedAt)}</span>
                        </span>
                      </CardDescription>
                    </div>
                    <Badge variant={getStatusColor(report.status)} className="capitalize">
                      {report.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Reason:
                      </span>
                      <span className="ml-2 text-sm capitalize">
                        {report.reason.replace('_', ' ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Description:
                      </span>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {report.description}
                      </p>
                    </div>

                    <div className="flex justify-end space-x-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReviewReport(report)}
                        data-testid={`button-review-${report.id}`}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Review
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* All Reports Section */}
      <div>
        <div className="flex items-center space-x-2 mb-4">
          <Shield className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            All Reports ({reports.length})
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {reports.map((report) => (
            <Card key={report.id} data-testid={`report-card-${report.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">
                      Report against {report.reportedUser.displayName}
                    </CardTitle>
                    <CardDescription className="flex items-center space-x-4 text-sm">
                      <span className="flex items-center space-x-1">
                        <UserIcon className="w-3 h-3" />
                        <span>By {report.reporter.displayName}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(report.reportedAt)}</span>
                      </span>
                      {report.reviewedAt && (
                        <span className="flex items-center space-x-1">
                          <Shield className="w-3 h-3" />
                          <span>Reviewed {formatDate(report.reviewedAt)}</span>
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <Badge variant={getStatusColor(report.status)} className="capitalize">
                    {report.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Reason:
                    </span>
                    <span className="ml-2 text-sm capitalize">
                      {report.reason.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Description:
                    </span>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {report.description}
                    </p>
                  </div>

                  {report.adminNotes && (
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Admin Notes:
                      </span>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {report.adminNotes}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end space-x-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReviewReport(report)}
                      data-testid={`button-review-${report.id}`}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      {report.status === 'pending' ? 'Review' : 'Edit'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Review Report Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Review Report
            </DialogTitle>
            <DialogDescription>
              Update the report status and add admin notes
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <span className="text-sm font-medium">Reported User:</span>
                  <p className="font-semibold">{selectedReport.reportedUser.displayName}</p>
                </div>
                <div>
                  <span className="text-sm font-medium">Reporter:</span>
                  <p className="font-semibold">{selectedReport.reporter.displayName}</p>
                </div>
                <div>
                  <span className="text-sm font-medium">Reason:</span>
                  <p className="capitalize">{selectedReport.reason.replace('_', ' ')}</p>
                </div>
                <div>
                  <span className="text-sm font-medium">Reported:</span>
                  <p>{formatDate(selectedReport.reportedAt)}</p>
                </div>
              </div>

              <div>
                <span className="text-sm font-medium block mb-2">Description:</span>
                <p className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded">
                  {selectedReport.description}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">
                  Status
                </label>
                <Select value={newStatus} onValueChange={(value: any) => setNewStatus(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">
                  Admin Notes
                </label>
                <Textarea
                  placeholder="Add notes about your decision..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={4}
                  data-testid="textarea-admin-notes"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReviewDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateReport}
              disabled={updateReportMutation.isPending}
              data-testid="button-update-report"
            >
              {updateReportMutation.isPending ? 'Updating...' : 'Update Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}