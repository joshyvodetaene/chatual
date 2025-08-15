import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Shield, Users, AlertTriangle, Ban, FileText, Activity } from 'lucide-react';
import AdminStats from '@/components/admin/admin-stats';
import ReportsManagement from '@/components/admin/reports-management';
import UserModerationPanel from '@/components/admin/user-moderation-panel';
import BannedUsersPanel from '@/components/admin/banned-users-panel';
import type { AdminDashboardStats, ModerationData } from '@shared/schema';
import { BackButton } from '@/components/ui/back-button';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  const { data: statsData, isLoading: statsLoading } = useQuery<{ stats: AdminDashboardStats }>({
    queryKey: ['/api/admin/dashboard-stats'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: moderationData, isLoading: moderationLoading } = useQuery<ModerationData>({
    queryKey: ['/api/admin/moderation-data'],
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  const stats = statsData?.stats;

  if (statsLoading || moderationLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              ))}
            </div>
            <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" data-testid="admin-dashboard">
      <div className="container mx-auto p-6">
        <BackButton className="mb-4" />
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <Shield className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Admin Dashboard
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-300">
            Monitor user activity, manage reports, and moderate the platform
          </p>
        </div>

        {/* Quick Stats Overview */}
        {stats && <AdminStats stats={stats} />}

        {/* Main Dashboard Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger 
              value="overview" 
              className="flex items-center space-x-2"
              data-testid="tab-overview"
            >
              <Activity className="w-4 h-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger 
              value="reports" 
              className="flex items-center space-x-2"
              data-testid="tab-reports"
            >
              <FileText className="w-4 h-4" />
              <span>Reports</span>
              {moderationData && moderationData.pendingCount > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {moderationData.pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="moderation" 
              className="flex items-center space-x-2"
              data-testid="tab-moderation"
            >
              <Users className="w-4 h-4" />
              <span>Users</span>
            </TabsTrigger>
            <TabsTrigger 
              value="banned" 
              className="flex items-center space-x-2"
              data-testid="tab-banned"
            >
              <Ban className="w-4 h-4" />
              <span>Banned</span>
              {stats && stats.bannedUsers > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {stats.bannedUsers}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Reports Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    <span>Recent Reports</span>
                  </CardTitle>
                  <CardDescription>
                    Latest user reports requiring attention
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {moderationData?.reports.slice(0, 5).map((report) => (
                    <div
                      key={report.id}
                      className="flex items-center justify-between py-3 border-b last:border-0"
                      data-testid={`recent-report-${report.id}`}
                    >
                      <div className="flex-1">
                        <p className="font-medium">
                          {report.reportedUser.displayName}
                        </p>
                        <p className="text-sm text-gray-500 capitalize">
                          {report.reason.replace('_', ' ')}
                        </p>
                      </div>
                      <Badge
                        variant={
                          report.status === 'pending' 
                            ? 'destructive' 
                            : report.status === 'resolved' 
                            ? 'default' 
                            : 'secondary'
                        }
                      >
                        {report.status}
                      </Badge>
                    </div>
                  )) ?? (
                    <p className="text-gray-500 text-center py-4">
                      No reports to display
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Recent Actions Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="w-5 h-5 text-blue-500" />
                    <span>Recent Actions</span>
                  </CardTitle>
                  <CardDescription>
                    Latest moderation actions taken
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {moderationData?.recentActions.slice(0, 5).map((action) => (
                    <div
                      key={action.id}
                      className="flex items-center justify-between py-3 border-b last:border-0"
                      data-testid={`recent-action-${action.id}`}
                    >
                      <div className="flex-1">
                        <p className="font-medium">
                          {action.user.displayName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {action.reason}
                        </p>
                      </div>
                      <Badge
                        variant={
                          action.actionType === 'ban' 
                            ? 'destructive' 
                            : action.actionType === 'warning' 
                            ? 'secondary' 
                            : 'default'
                        }
                        className="capitalize"
                      >
                        {action.actionType}
                      </Badge>
                    </div>
                  )) ?? (
                    <p className="text-gray-500 text-center py-4">
                      No recent actions
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reports">
            {moderationData && (
              <ReportsManagement reports={moderationData.reports} />
            )}
          </TabsContent>

          <TabsContent value="moderation">
            <UserModerationPanel />
          </TabsContent>

          <TabsContent value="banned">
            <BannedUsersPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}