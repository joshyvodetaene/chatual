import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useResponsive } from '@/hooks/use-responsive';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Database, 
  Trash2, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  RefreshCw,
  BarChart3,
  HardDrive
} from 'lucide-react';

interface CleanupStatus {
  isRunning: boolean;
  isScheduled: boolean;
  nextRun: string | null;
  messagesPerRoom: number;
}

interface DatabaseStats {
  totalMessages: number;
  totalRooms: number;
  totalUsers: number;
  totalReports: number;
}

export default function DatabaseManagement() {
  const { toast } = useToast();
  const { isMobile, isTablet } = useResponsive();
  const [isCleanupRunning, setIsCleanupRunning] = useState(false);

  // Get cleanup status
  const { data: cleanupStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ['/api/admin/cleanup-status'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Get database statistics (we'll implement this endpoint)
  const { data: dbStats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['/api/admin/database-stats'],
  });

  // Manual cleanup mutation
  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/cleanup-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to run cleanup');
      }
      
      return response.json();
    },
    onMutate: () => {
      setIsCleanupRunning(true);
    },
    onSuccess: (data: any) => {
      const result = data.result || data;
      toast({
        title: 'Cleanup completed',
        description: `${result.totalDeleted} messages deleted from ${result.roomsCleaned} rooms`,
      });
      refetchStatus();
      refetchStats();
    },
    onError: (error: any) => {
      toast({
        title: 'Cleanup failed',
        description: error.message || 'Failed to run cleanup',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsCleanupRunning(false);
    },
  });

  // Clear all messages mutation (dangerous operation)
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/messages', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to clear messages');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'All messages cleared',
        description: 'All messages have been permanently deleted',
      });
      refetchStats();
    },
    onError: (error: any) => {
      toast({
        title: 'Clear failed',
        description: error.message || 'Failed to clear messages',
        variant: 'destructive',
      });
    },
  });

  const handleManualCleanup = () => {
    cleanupMutation.mutate();
  };

  const handleClearAllMessages = () => {
    if (confirm('This will permanently delete ALL messages in the system. This action cannot be undone. Are you sure?')) {
      clearAllMutation.mutate();
    }
  };

  const statusData = (cleanupStatus as any)?.status as CleanupStatus | undefined;
  const statsData = (dbStats as any)?.stats as DatabaseStats | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className={cn(
          "font-bold text-white mb-2",
          isMobile ? "text-xl" : "text-2xl"
        )} data-testid="text-database-management-title">
          Database Management
        </h2>
        <p className={cn(
          "text-slate-400",
          isMobile ? "text-sm" : "text-base"
        )} data-testid="text-database-management-description">
          Monitor and manage database operations, cleanup old data, and view system statistics.
        </p>
      </div>

      {/* Database Statistics */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Database Statistics
          </CardTitle>
          <CardDescription className="text-slate-400">
            Overview of your database size and content
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="flex items-center gap-2 text-slate-400">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading statistics...
            </div>
          ) : (
            <div className={cn(
              "grid gap-4",
              isMobile ? "grid-cols-2" : "grid-cols-4"
            )}>
              <div className="text-center">
                <div className="text-2xl font-bold text-white" data-testid="stat-total-messages">
                  {statsData?.totalMessages || 0}
                </div>
                <div className="text-sm text-slate-400">Messages</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white" data-testid="stat-total-rooms">
                  {statsData?.totalRooms || 0}
                </div>
                <div className="text-sm text-slate-400">Rooms</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white" data-testid="stat-total-users">
                  {statsData?.totalUsers || 0}
                </div>
                <div className="text-sm text-slate-400">Users</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white" data-testid="stat-total-reports">
                  {statsData?.totalReports || 0}
                </div>
                <div className="text-sm text-slate-400">Reports</div>
              </div>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchStats()}
            className="mt-4 border-slate-600 text-slate-300 hover:bg-slate-700"
            data-testid="button-refresh-stats"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Stats
          </Button>
        </CardContent>
      </Card>

      {/* Cleanup Status */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Database className="h-5 w-5" />
            Message Cleanup Status
          </CardTitle>
          <CardDescription className="text-slate-400">
            Automatic cleanup keeps only the {statusData?.messagesPerRoom || 40} newest messages per room
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div className="flex items-center gap-2 text-slate-400">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading cleanup status...
            </div>
          ) : (
            <div className="space-y-4">
              <div className={cn(
                "grid gap-4",
                isMobile ? "grid-cols-1" : "grid-cols-2"
              )}>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Scheduler:</span>
                  <Badge variant={statusData?.isScheduled ? "default" : "secondary"} data-testid="badge-scheduler-status">
                    {statusData?.isScheduled ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Inactive
                      </>
                    )}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Current Status:</span>
                  <Badge variant={statusData?.isRunning ? "destructive" : "outline"} data-testid="badge-cleanup-status">
                    {statusData?.isRunning ? (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        Running
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3 mr-1" />
                        Idle
                      </>
                    )}
                  </Badge>
                </div>
              </div>
              
              {statusData?.nextRun && (
                <div className="text-sm text-slate-400" data-testid="text-next-run">
                  Next scheduled run: {new Date(statusData.nextRun).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Database Operations */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Database Operations
          </CardTitle>
          <CardDescription className="text-slate-400">
            Perform maintenance operations on your database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Manual Cleanup */}
            <div className={cn(
              "flex justify-between items-center p-4 bg-slate-900/50 rounded-lg",
              isMobile && "flex-col gap-3"
            )}>
              <div className={cn(
                isMobile && "text-center"
              )}>
                <h3 className="font-medium text-white">Manual Message Cleanup</h3>
                <p className="text-sm text-slate-400">
                  Run cleanup now to remove old messages (keeps {statusData?.messagesPerRoom || 40} per room)
                </p>
              </div>
              <Button
                onClick={handleManualCleanup}
                disabled={isCleanupRunning || statusData?.isRunning || cleanupMutation.isPending}
                size={isMobile ? "sm" : "default"}
                className={cn(
                  "bg-blue-600 hover:bg-blue-700",
                  isMobile && "w-full"
                )}
                data-testid="button-manual-cleanup"
              >
                {(isCleanupRunning || statusData?.isRunning || cleanupMutation.isPending) ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4 mr-2" />
                    Run Cleanup
                  </>
                )}
              </Button>
            </div>

            {/* Clear All Messages - Dangerous Operation */}
            <div className={cn(
              "flex justify-between items-center p-4 bg-red-950/30 border border-red-800/50 rounded-lg",
              isMobile && "flex-col gap-3"
            )}>
              <div className={cn(
                isMobile && "text-center"
              )}>
                <h3 className="font-medium text-red-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Clear All Messages
                </h3>
                <p className="text-sm text-red-300/80">
                  Permanently delete ALL messages from the system. This action cannot be undone!
                </p>
              </div>
              <Button
                onClick={handleClearAllMessages}
                disabled={clearAllMutation.isPending}
                variant="destructive"
                size={isMobile ? "sm" : "default"}
                className={cn(
                  isMobile && "w-full"
                )}
                data-testid="button-clear-all-messages"
              >
                {clearAllMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}