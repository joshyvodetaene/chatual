import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useResponsive } from '@/hooks/use-responsive';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';

import { 
  Shield, 
  Activity, 
  Settings, 
  Users, 
  AlertTriangle, 
  TrendingUp, 
  Database, 
  RefreshCw,
  Play,
  Clock,
  BarChart3,
  Eye,
  UserCheck,
  Ban,
  AlertCircle,
  CheckCircle,
  Search,
  Filter,
  Calendar,
  Download
} from 'lucide-react';

interface AdminUser {
  id: string;
  username: string;
  isActive: boolean;
  createdAt: string;
  lastLogin: string | null;
}

interface ModerationToolsProps {
  adminUser: AdminUser;
}

// Form schemas
const bulkActionSchema = z.object({
  userIds: z.array(z.string()).min(1, "At least one user must be selected"),
  actionType: z.enum(['ban', 'unban', 'block', 'warn']),
  reason: z.string().min(1, "Reason is required").max(500, "Reason must be less than 500 characters"),
  notes: z.string().max(1000, "Notes must be less than 1000 characters").optional(),
  severity: z.number().min(1).max(5).optional()
});

const configUpdateSchema = z.object({
  configKey: z.string().min(1, "Config key is required"),
  configValue: z.union([z.string(), z.number(), z.boolean()]),
  description: z.string().optional()
});

const cleanupConfigSchema = z.object({
  messageRetentionDays: z.number().min(1).max(365).optional(),
  messagesPerRoom: z.number().min(10).max(1000).optional(),
  autoCleanup: z.boolean().optional()
});

const warningEscalationSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  reason: z.string().min(1, "Reason is required").max(500, "Reason must be less than 500 characters"),
  severity: z.number().min(1).max(5).default(1),
  autoEscalate: z.boolean().default(false)
});

type BulkActionForm = z.infer<typeof bulkActionSchema>;
type ConfigUpdateForm = z.infer<typeof configUpdateSchema>;
type CleanupConfigForm = z.infer<typeof cleanupConfigSchema>;
type WarningEscalationForm = z.infer<typeof warningEscalationSchema>;

export default function ModerationTools({ adminUser }: ModerationToolsProps) {
  const { toast } = useToast();
  const { isMobile, isTablet } = useResponsive();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);

  // Form hooks
  const bulkActionForm = useForm<BulkActionForm>({
    resolver: zodResolver(bulkActionSchema),
    defaultValues: {
      userIds: [],
      actionType: 'warn',
      reason: '',
      notes: '',
      severity: 1
    }
  });

  const configForm = useForm<ConfigUpdateForm>({
    resolver: zodResolver(configUpdateSchema),
    defaultValues: {
      configKey: '',
      configValue: '',
      description: ''
    }
  });

  const cleanupForm = useForm<CleanupConfigForm>({
    resolver: zodResolver(cleanupConfigSchema),
    defaultValues: {
      messageRetentionDays: 30,
      messagesPerRoom: 40,
      autoCleanup: true
    }
  });

  const warningForm = useForm<WarningEscalationForm>({
    resolver: zodResolver(warningEscalationSchema),
    defaultValues: {
      userId: '',
      reason: '',
      severity: 1,
      autoEscalate: false
    }
  });

  // Data queries
  const { data: moderationStats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/admin/moderation/stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/moderation/stats');
      if (!response.ok) throw new Error('Failed to fetch moderation stats');
      return response.json();
    },
  });

  const { data: moderationActions, isLoading: actionsLoading } = useQuery({
    queryKey: ['/api/admin/moderation/actions'],
    queryFn: async () => {
      const response = await fetch('/api/admin/moderation/actions?limit=50');
      if (!response.ok) throw new Error('Failed to fetch moderation actions');
      return response.json();
    },
  });

  const { data: behaviorScores, isLoading: scoresLoading } = useQuery({
    queryKey: ['/api/admin/users/behavior-scores'],
    queryFn: async () => {
      const response = await fetch('/api/admin/users/behavior-scores?limit=50');
      if (!response.ok) throw new Error('Failed to fetch behavior scores');
      return response.json();
    },
  });

  const { data: systemConfigs, isLoading: configsLoading } = useQuery({
    queryKey: ['/api/admin/system/config'],
    queryFn: async () => {
      const response = await fetch('/api/admin/system/config');
      if (!response.ok) throw new Error('Failed to fetch system configs');
      return response.json();
    },
  });

  const { data: cleanupConfig, isLoading: cleanupLoading } = useQuery({
    queryKey: ['/api/admin/cleanup/configuration'],
    queryFn: async () => {
      const response = await fetch('/api/admin/cleanup/configuration');
      if (!response.ok) throw new Error('Failed to fetch cleanup config');
      return response.json();
    },
  });

  // Mutations
  const bulkActionMutation = useMutation({
    mutationFn: async (data: BulkActionForm) => {
      return apiRequest('POST', '/api/admin/bulk/user-action', data);
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Bulk Action Completed',
        description: `${data.result.success} users processed successfully, ${data.result.failed} failed`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/moderation/actions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/moderation/stats'] });
      setActionDialogOpen(false);
      bulkActionForm.reset();
      setSelectedUsers([]);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to perform bulk action',
        variant: 'destructive',
      });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (data: ConfigUpdateForm) => {
      return apiRequest('POST', '/api/admin/system/config', data);
    },
    onSuccess: () => {
      toast({
        title: 'Configuration Updated',
        description: 'System configuration has been updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/system/config'] });
      setConfigDialogOpen(false);
      configForm.reset();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update configuration',
        variant: 'destructive',
      });
    },
  });

  const updateCleanupMutation = useMutation({
    mutationFn: async (data: CleanupConfigForm) => {
      return apiRequest('PUT', '/api/admin/cleanup/configuration', data);
    },
    onSuccess: () => {
      toast({
        title: 'Cleanup Configuration Updated',
        description: 'Cleanup settings have been updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/cleanup/configuration'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update cleanup configuration',
        variant: 'destructive',
      });
    },
  });

  const runCleanupMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/admin/cleanup/run');
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Cleanup Completed',
        description: `Deleted ${data.result.messagesDeleted} messages from ${data.result.roomsCleaned} rooms`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/moderation/stats'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to run cleanup operation',
        variant: 'destructive',
      });
    },
  });

  const escalateWarningMutation = useMutation({
    mutationFn: async (data: WarningEscalationForm) => {
      return apiRequest('POST', `/api/admin/users/${data.userId}/escalate-warning`, {
        reason: data.reason,
        severity: data.severity,
        autoEscalate: data.autoEscalate
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Warning Escalated',
        description: `Warning issued to user. ${data.result.escalated ? 'User was auto-escalated to ban.' : `Next escalation level: ${data.result.nextLevel}`}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users/behavior-scores'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/moderation/actions'] });
      warningForm.reset();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to escalate warning',
        variant: 'destructive',
      });
    },
  });

  // Helper functions
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString();
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'ban': return 'destructive';
      case 'warning': return 'secondary';
      case 'block': return 'outline';
      case 'bulk_action': return 'default';
      default: return 'secondary';
    }
  };

  const getBehaviorScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  // Handle bulk action form submission
  const handleBulkAction = (data: BulkActionForm) => {
    const finalData = {
      ...data,
      userIds: selectedUsers
    };
    bulkActionMutation.mutate(finalData);
  };

  const stats = moderationStats?.stats || {};
  const actions = moderationActions?.actions?.items || [];
  const users = behaviorScores?.users?.items || [];
  const configs = systemConfigs?.configs || [];
  const cleanup = cleanupConfig?.config || {};

  return (
    <div className="space-y-6">
      {/* Overview Statistics */}
      <div className={cn(
        "grid gap-4",
        isMobile ? "grid-cols-1" : isTablet ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"
      )}>
        <Card className="card-gradient border-gradient">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Actions</CardTitle>
            <Shield className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalActions || 0}</div>
            <p className="text-xs text-muted-foreground">Moderation actions logged</p>
          </CardContent>
        </Card>

        <Card className="card-gradient border-gradient">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warning Escalations</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.warningEscalations || 0}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card className="card-gradient border-gradient">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Behavior Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.behaviorScoreAverage || 100}</div>
            <p className="text-xs text-muted-foreground">Community health</p>
          </CardContent>
        </Card>

        <Card className="card-gradient border-gradient">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto-Moderation</CardTitle>
            <Activity className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.autoModerationEvents || 0}</div>
            <p className="text-xs text-muted-foreground">Automated actions</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={cn(
          "grid w-full",
          isMobile ? "grid-cols-2" : "grid-cols-5"
        )}>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            {!isMobile && "Overview"}
          </TabsTrigger>
          <TabsTrigger value="actions" data-testid="tab-actions">
            <Eye className="h-4 w-4 mr-2" />
            {!isMobile && "Actions"}
          </TabsTrigger>
          <TabsTrigger value="behavior" data-testid="tab-behavior">
            <UserCheck className="h-4 w-4 mr-2" />
            {!isMobile && "Behavior"}
          </TabsTrigger>
          <TabsTrigger value="bulk" data-testid="tab-bulk">
            <Users className="h-4 w-4 mr-2" />
            {!isMobile && "Bulk Ops"}
          </TabsTrigger>
          <TabsTrigger value="system" data-testid="tab-system">
            <Settings className="h-4 w-4 mr-2" />
            {!isMobile && "System"}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className={cn(
            "grid gap-4",
            isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
          )}>
            <Card className="card-gradient border-gradient">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Recent Actions
                </CardTitle>
                <CardDescription>Latest moderation activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {actionsLoading ? (
                    <div className="text-sm text-muted-foreground">Loading recent actions...</div>
                  ) : actions.slice(0, 5).map((action: any) => (
                    <div key={action.id} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={getActionColor(action.actionType)} className="text-xs">
                            {action.actionType}
                          </Badge>
                          <span className="text-sm font-medium">{action.user?.username}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{action.reason}</p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(action.performedAt)}
                      </div>
                    </div>
                  ))}
                  {!actionsLoading && actions.length === 0 && (
                    <div className="text-sm text-muted-foreground">No recent actions</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="card-gradient border-gradient">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Cleanup Status
                </CardTitle>
                <CardDescription>Automated maintenance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {cleanupLoading ? (
                  <div className="text-sm text-muted-foreground">Loading cleanup configuration...</div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Messages per room:</span>
                        <span className="text-sm font-medium">{cleanup.messagesPerRoom || 40}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Retention days:</span>
                        <span className="text-sm font-medium">{cleanup.messageRetentionDays || 30}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Auto cleanup:</span>
                        <Badge variant={cleanup.autoCleanup ? "default" : "secondary"}>
                          {cleanup.autoCleanup ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Last cleanup:</span>
                        <span className="text-sm font-medium">
                          {cleanup.lastCleanup ? formatDate(cleanup.lastCleanup) : 'Never'}
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => runCleanupMutation.mutate()}
                      disabled={runCleanupMutation.isPending}
                      className="w-full"
                      size="sm"
                      data-testid="button-run-cleanup"
                    >
                      <RefreshCw className={cn("h-4 w-4 mr-2", runCleanupMutation.isPending && "animate-spin")} />
                      {runCleanupMutation.isPending ? 'Running...' : 'Run Cleanup Now'}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Actions Log Tab */}
        <TabsContent value="actions" className="space-y-4">
          <Card className="card-gradient border-gradient">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Moderation Actions Log
              </CardTitle>
              <CardDescription>Complete audit trail of all moderation activities</CardDescription>
            </CardHeader>
            <CardContent>
              {actionsLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <div className="text-sm text-muted-foreground">Loading moderation actions...</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {actions.map((action: any) => (
                    <div key={action.id} className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={getActionColor(action.actionType)}>
                              {action.actionType}
                            </Badge>
                            <span className="font-medium">{action.user?.username}</span>
                            <span className="text-sm text-muted-foreground">
                              by {action.performedByUser?.username || action.performedBy}
                            </span>
                          </div>
                          <p className="text-sm">{action.reason}</p>
                          {action.notes && (
                            <p className="text-xs text-muted-foreground italic">{action.notes}</p>
                          )}
                          {action.severity && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs">Severity:</span>
                              <div className="flex items-center gap-1">
                                {Array.from({ length: 5 }, (_, i) => (
                                  <div
                                    key={i}
                                    className={cn(
                                      "w-2 h-2 rounded-full",
                                      i < action.severity ? "bg-red-500" : "bg-slate-600"
                                    )}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(action.performedAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {actions.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No moderation actions recorded yet
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Behavior Tab */}
        <TabsContent value="behavior" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="card-gradient border-gradient">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  User Behavior Scores
                </CardTitle>
                <CardDescription>Track user behavior patterns and warnings</CardDescription>
              </CardHeader>
              <CardContent>
                {scoresLoading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <div className="text-sm text-muted-foreground">Loading behavior scores...</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {users.slice(0, 10).map((user: any) => (
                      <div key={user.id} className="p-3 bg-slate-800 rounded-lg border border-slate-700">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="font-medium">{user.username}</div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>Warnings: {user.warningCount || 0}</span>
                              <span>Violations: {user.violationCount || 0}</span>
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <div className={cn(
                              "text-lg font-bold",
                              getBehaviorScoreColor(user.behaviorScore?.behaviorScore || 100)
                            )}>
                              {user.behaviorScore?.behaviorScore || 100}
                            </div>
                            <Progress 
                              value={user.behaviorScore?.behaviorScore || 100} 
                              className="w-20 h-2"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {users.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No user behavior data available
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="card-gradient border-gradient">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Issue Warning
                </CardTitle>
                <CardDescription>Escalate user warnings with automated responses</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...warningForm}>
                  <form onSubmit={warningForm.handleSubmit((data) => escalateWarningMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={warningForm.control}
                      name="userId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>User ID</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter user ID" {...field} data-testid="input-warning-user-id" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={warningForm.control}
                      name="reason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reason</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe the violation or behavior" 
                              {...field} 
                              data-testid="textarea-warning-reason"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={warningForm.control}
                      name="severity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Severity Level</FormLabel>
                          <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger data-testid="select-warning-severity">
                                <SelectValue placeholder="Select severity" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="1">1 - Minor</SelectItem>
                              <SelectItem value="2">2 - Moderate</SelectItem>
                              <SelectItem value="3">3 - Serious</SelectItem>
                              <SelectItem value="4">4 - Severe</SelectItem>
                              <SelectItem value="5">5 - Critical</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={warningForm.control}
                      name="autoEscalate"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Auto-escalate</FormLabel>
                            <FormDescription>
                              Automatically ban user if thresholds are exceeded
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-auto-escalate"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      disabled={escalateWarningMutation.isPending}
                      className="w-full"
                      data-testid="button-escalate-warning"
                    >
                      {escalateWarningMutation.isPending ? 'Processing...' : 'Issue Warning'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Bulk Operations Tab */}
        <TabsContent value="bulk" className="space-y-4">
          <Card className="card-gradient border-gradient">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Bulk User Operations
              </CardTitle>
              <CardDescription>Perform actions on multiple users simultaneously</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-600 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Bulk Operations Warning</span>
                </div>
                <p className="text-sm text-yellow-600/90">
                  Bulk operations affect multiple users at once. Please review selections carefully before proceeding.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Users (Enter user IDs separated by commas)</label>
                  <Textarea
                    placeholder="user-id-1, user-id-2, user-id-3..."
                    value={selectedUsers.join(', ')}
                    onChange={(e) => {
                      const ids = e.target.value.split(',').map(id => id.trim()).filter(Boolean);
                      setSelectedUsers(ids);
                    }}
                    className="min-h-[100px]"
                    data-testid="textarea-bulk-user-ids"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Selected: {selectedUsers.length} users
                  </p>
                </div>

                <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      disabled={selectedUsers.length === 0}
                      className="w-full"
                      data-testid="button-open-bulk-action"
                    >
                      Configure Bulk Action
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Bulk User Action</DialogTitle>
                      <DialogDescription>
                        Configure action to perform on {selectedUsers.length} selected users
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...bulkActionForm}>
                      <form onSubmit={bulkActionForm.handleSubmit(handleBulkAction)} className="space-y-4">
                        <FormField
                          control={bulkActionForm.control}
                          name="actionType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Action Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-bulk-action-type">
                                    <SelectValue placeholder="Select action" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="warn">Issue Warning</SelectItem>
                                  <SelectItem value="ban">Ban Users</SelectItem>
                                  <SelectItem value="unban">Unban Users</SelectItem>
                                  <SelectItem value="block">Block Users</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={bulkActionForm.control}
                          name="reason"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Reason</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Explain the reason for this action" 
                                  {...field} 
                                  data-testid="textarea-bulk-reason"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={bulkActionForm.control}
                          name="severity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Severity (for warnings)</FormLabel>
                              <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-bulk-severity">
                                    <SelectValue placeholder="Select severity" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="1">1 - Minor</SelectItem>
                                  <SelectItem value="2">2 - Moderate</SelectItem>
                                  <SelectItem value="3">3 - Serious</SelectItem>
                                  <SelectItem value="4">4 - Severe</SelectItem>
                                  <SelectItem value="5">5 - Critical</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={bulkActionForm.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Additional Notes (Optional)</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Any additional information..." 
                                  {...field} 
                                  data-testid="textarea-bulk-notes"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button 
                          type="submit" 
                          disabled={bulkActionMutation.isPending}
                          className="w-full"
                          data-testid="button-execute-bulk-action"
                        >
                          {bulkActionMutation.isPending ? 'Processing...' : `Execute Action on ${selectedUsers.length} Users`}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Configuration Tab */}
        <TabsContent value="system" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="card-gradient border-gradient">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  System Configuration
                </CardTitle>
                <CardDescription>Manage system-wide moderation settings</CardDescription>
              </CardHeader>
              <CardContent>
                {configsLoading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <div className="text-sm text-muted-foreground">Loading configurations...</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {configs.map((config: any) => (
                      <div key={config.id} className="p-3 bg-slate-800 rounded-lg border border-slate-700">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{config.configKey}</span>
                            <Badge variant="outline" className="text-xs">
                              {typeof config.configValue}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Value: <span className="font-mono">{String(config.configValue)}</span>
                          </div>
                          {config.description && (
                            <p className="text-xs text-muted-foreground">{config.description}</p>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Updated: {formatDate(config.updatedAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {configs.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No configurations found
                      </div>
                    )}
                    
                    <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full" data-testid="button-add-config">
                          <Settings className="h-4 w-4 mr-2" />
                          Add Configuration
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>Add System Configuration</DialogTitle>
                          <DialogDescription>
                            Create a new system configuration setting
                          </DialogDescription>
                        </DialogHeader>
                        <Form {...configForm}>
                          <form onSubmit={configForm.handleSubmit((data) => updateConfigMutation.mutate(data))} className="space-y-4">
                            <FormField
                              control={configForm.control}
                              name="configKey"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Configuration Key</FormLabel>
                                  <FormControl>
                                    <Input placeholder="e.g., max_warnings_before_ban" {...field} data-testid="input-config-key" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={configForm.control}
                              name="configValue"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Value</FormLabel>
                                  <FormControl>
                                    <Input 
                                      placeholder="Configuration value" 
                                      {...field} 
                                      value={String(field.value)}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        // Try to parse as number or boolean
                                        if (value === 'true') field.onChange(true);
                                        else if (value === 'false') field.onChange(false);
                                        else if (!isNaN(Number(value)) && value !== '') field.onChange(Number(value));
                                        else field.onChange(value);
                                      }}
                                      data-testid="input-config-value"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={configForm.control}
                              name="description"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Description (Optional)</FormLabel>
                                  <FormControl>
                                    <Textarea 
                                      placeholder="Describe what this configuration does" 
                                      {...field} 
                                      data-testid="textarea-config-description"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <Button 
                              type="submit" 
                              disabled={updateConfigMutation.isPending}
                              className="w-full"
                              data-testid="button-save-config"
                            >
                              {updateConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
                            </Button>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="card-gradient border-gradient">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Cleanup Configuration
                </CardTitle>
                <CardDescription>Configure automated message cleanup</CardDescription>
              </CardHeader>
              <CardContent>
                {cleanupLoading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <div className="text-sm text-muted-foreground">Loading cleanup settings...</div>
                  </div>
                ) : (
                  <Form {...cleanupForm}>
                    <form onSubmit={cleanupForm.handleSubmit((data) => updateCleanupMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={cleanupForm.control}
                        name="messageRetentionDays"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Message Retention (Days)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="1" 
                                max="365"
                                placeholder={String(cleanup.messageRetentionDays || 30)}
                                {...field}
                                value={field.value || ''}
                                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                                data-testid="input-retention-days"
                              />
                            </FormControl>
                            <FormDescription>
                              How many days to keep messages before cleanup
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={cleanupForm.control}
                        name="messagesPerRoom"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Messages Per Room</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="10" 
                                max="1000"
                                placeholder={String(cleanup.messagesPerRoom || 40)}
                                {...field}
                                value={field.value || ''}
                                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                                data-testid="input-messages-per-room"
                              />
                            </FormControl>
                            <FormDescription>
                              Maximum messages to keep per room
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={cleanupForm.control}
                        name="autoCleanup"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Auto Cleanup</FormLabel>
                              <FormDescription>
                                Automatically run cleanup daily
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value ?? cleanup.autoCleanup}
                                onCheckedChange={field.onChange}
                                data-testid="switch-auto-cleanup"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit" 
                        disabled={updateCleanupMutation.isPending}
                        className="w-full"
                        data-testid="button-update-cleanup-config"
                      >
                        {updateCleanupMutation.isPending ? 'Updating...' : 'Update Cleanup Settings'}
                      </Button>
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}