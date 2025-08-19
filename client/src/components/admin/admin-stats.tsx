import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Ban, AlertTriangle, FileText, TrendingUp, Activity } from 'lucide-react';
import type { AdminDashboardStats } from '@shared/schema';

interface AdminStatsProps {
  stats: AdminDashboardStats;
}

export default function AdminStats({ stats }: AdminStatsProps) {
  const statsCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      description: 'Registered users',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      testId: 'stat-total-users'
    },
    {
      title: 'Active Users',
      value: stats.activeUsers,
      description: 'Currently online',
      icon: Activity,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      testId: 'stat-active-users'
    },
    {
      title: 'Pending Reports',
      value: stats.pendingReports,
      description: 'Need attention',
      icon: AlertTriangle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      testId: 'stat-pending-reports'
    },
    {
      title: 'Total Reports',
      value: stats.totalReports,
      description: 'All time reports',
      icon: FileText,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      testId: 'stat-total-reports'
    },
    {
      title: 'Recent Warnings',
      value: stats.recentWarnings,
      description: 'Past 7 days',
      icon: TrendingUp,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      testId: 'stat-recent-warnings'
    },
    {
      title: 'Banned Users',
      value: stats.bannedUsers,
      description: 'Currently banned',
      icon: Ban,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      testId: 'stat-banned-users'
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      {statsCards.map(({ title, value, description, icon: Icon, color, bgColor, testId }) => (
        <Card key={title} data-testid={testId} className="card-gradient border-gradient interactive-card hover-lift">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-shadow-sm">{title}</CardTitle>
            <div className={`${bgColor} p-3 rounded-xl shadow-md relative overflow-hidden`}>
              <div className="absolute inset-0 shimmer"></div>
              <Icon className={`w-5 h-5 ${color} relative z-10`} />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-3xl font-bold gradient-text mb-1" data-testid={`${testId}-value`}>
              {value.toLocaleString()}
            </div>
            <CardDescription className="text-xs text-muted-foreground font-medium">
              {description}
            </CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}