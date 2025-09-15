import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Ban, AlertTriangle, FileText, TrendingUp, Activity } from 'lucide-react';
import type { AdminDashboardStats } from '@shared/schema';
import { useResponsive } from '@/hooks/use-responsive';
import { cn } from '@/lib/utils';

interface AdminStatsProps {
  stats: AdminDashboardStats;
}

export default function AdminStats({ stats }: AdminStatsProps) {
  const { isMobile, isTablet } = useResponsive();
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
    <div className={cn(
      "grid gap-4 mb-6",
      isMobile ? "grid-cols-1" : isTablet ? "grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
      isMobile ? "gap-4" : "gap-6",
      isMobile ? "mb-6" : "mb-8"
    )}>
      {statsCards.map(({ title, value, description, icon: Icon, color, bgColor, testId }) => (
        <Card key={title} data-testid={testId} className="card-gradient border-gradient interactive-card hover-lift">
          <CardHeader className={cn(
            "flex flex-row items-center justify-between space-y-0",
            isMobile ? "pb-2" : "pb-3"
          )}>
            <CardTitle className={cn(
              "font-medium text-shadow-sm",
              isMobile ? "text-xs" : "text-sm"
            )}>{title}</CardTitle>
            <div className={cn(
              `${bgColor} rounded-xl shadow-md relative overflow-hidden`,
              isMobile ? "p-2" : "p-3"
            )}>
              <div className="absolute inset-0 shimmer"></div>
              <Icon className={cn(
                `${color} relative z-10`,
                isMobile ? "w-4 h-4" : "w-5 h-5"
              )} />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className={cn(
              "font-bold gradient-text mb-1",
              isMobile ? "text-2xl" : "text-3xl"
            )} data-testid={`${testId}-value`}>
              {value.toLocaleString()}
            </div>
            <CardDescription className={cn(
              "text-muted-foreground font-medium",
              isMobile ? "text-xs" : "text-xs"
            )}>
              {description}
            </CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}