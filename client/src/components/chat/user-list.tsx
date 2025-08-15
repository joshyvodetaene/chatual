import { RoomWithMembers, User } from '@shared/schema';
import { cn } from '@/lib/utils';
import UserDistance from './user-distance';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Flag } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface UserListProps {
  room: RoomWithMembers;
  onlineUsers: Set<string>;
  currentUser?: User;
  onStartPrivateChat: (userId: string) => void;
  blockedUserIds?: Set<string>;
}

export default function UserList({ room, onlineUsers, currentUser, onStartPrivateChat, blockedUserIds = new Set() }: UserListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportingUserId, setReportingUserId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<string>('');
  const [reportDescription, setReportDescription] = useState<string>('');

  const reportUserMutation = useMutation({
    mutationFn: async (data: { reportedUserId: string; reason: string; description: string }) => {
      return await apiRequest(`/api/reports`, {
        method: 'POST',
        body: {
          ...data,
          reporterId: currentUser?.id,
        },
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User reported successfully",
      });
      setReportDialogOpen(false);
      setReportingUserId(null);
      setReportReason('');
      setReportDescription('');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to report user",
        variant: "destructive",
      });
    },
  });

  const handleReportUser = (userId: string) => {
    setReportingUserId(userId);
    setReportDialogOpen(true);
  };

  const handleSubmitReport = () => {
    if (!reportingUserId || !reportReason || !reportDescription.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    reportUserMutation.mutate({
      reportedUserId: reportingUserId,
      reason: reportReason,
      description: reportDescription.trim(),
    });
  };
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-gradient-to-br from-blue-400 to-blue-600',
      'bg-gradient-to-br from-green-400 to-green-600',
      'bg-gradient-to-br from-purple-400 to-purple-600',
      'bg-gradient-to-br from-orange-400 to-orange-600',
      'bg-gradient-to-br from-pink-400 to-pink-600',
      'bg-gradient-to-br from-indigo-400 to-indigo-600',
    ];
    const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // Filter out blocked users and ensure unique members
  const uniqueMembers = room.members.reduce((acc, member) => {
    if (!acc.find(m => m.id === member.id) && !blockedUserIds.has(member.id)) {
      acc.push(member);
    }
    return acc;
  }, [] as User[]);
  
  const filteredMembers = uniqueMembers;
  const onlineMembers = filteredMembers.filter(member => onlineUsers.has(member.id));
  const offlineMembers = filteredMembers.filter(member => !onlineUsers.has(member.id));

  return (
    <div className="w-64 bg-white border-l border-gray-200 flex flex-col" data-testid="user-list">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Online in Room</h3>
        <p className="text-xs text-gray-500 mt-1" data-testid="online-count">
          {onlineMembers.length} online • {filteredMembers.length} visible
        </p>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {/* Online Members */}
        {onlineMembers.length > 0 && (
          <div className="p-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              Online — {onlineMembers.length}
            </h4>
            
            <div className="space-y-2">
              {onlineMembers.map((member) => (
                <div
                  key={`online-${member.id}`}
                  className="group flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => member.id !== currentUser?.id && onStartPrivateChat(member.id)}
                  data-testid={`online-user-${member.id}`}
                >
                  <div className="relative">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium",
                      getAvatarColor(member.displayName)
                    )}>
                      {getInitials(member.displayName)}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-accent border-2 border-white rounded-full"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {member.displayName}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-gray-500">Member</p>
                      {currentUser && (
                        <UserDistance 
                          currentUserId={currentUser.id} 
                          targetUserId={member.id}
                          className="text-xs"
                        />
                      )}
                    </div>
                  </div>
                  
                  {/* Report Button */}
                  {currentUser && member.id !== currentUser.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReportUser(member.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`button-report-${member.id}`}
                    >
                      <Flag className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Offline Members */}
        {offlineMembers.length > 0 && (
          <div className={cn("p-4", onlineMembers.length > 0 && "border-t border-gray-100")}>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              Offline — {offlineMembers.length}
            </h4>
            
            <div className="space-y-2">
              {offlineMembers.map((member) => (
                <div
                  key={`offline-${member.id}`}
                  className="group flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors opacity-60"
                  onClick={() => member.id !== currentUser?.id && onStartPrivateChat(member.id)}
                  data-testid={`offline-user-${member.id}`}
                >
                  <div className="relative">
                    <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                      {getInitials(member.displayName)}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-gray-400 border-2 border-white rounded-full"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {member.displayName}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-gray-400">Last seen recently</p>
                      {currentUser && (
                        <UserDistance 
                          currentUserId={currentUser.id} 
                          targetUserId={member.id}
                          className="text-xs opacity-60"
                        />
                      )}
                    </div>
                  </div>
                  
                  {/* Report Button */}
                  {currentUser && member.id !== currentUser.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReportUser(member.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`button-report-${member.id}`}
                    >
                      <Flag className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Report User Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span>Report User</span>
            </DialogTitle>
            <DialogDescription>
              Report this user for inappropriate behavior. Our moderation team will review your report.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="report-reason">Reason *</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger data-testid="select-report-reason">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="harassment">Harassment</SelectItem>
                  <SelectItem value="spam">Spam</SelectItem>
                  <SelectItem value="inappropriate_content">Inappropriate Content</SelectItem>
                  <SelectItem value="fake_profile">Fake Profile</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="report-description">Description *</Label>
              <Textarea
                id="report-description"
                placeholder="Please provide details about why you're reporting this user..."
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                maxLength={500}
                data-testid="textarea-report-description"
              />
              <p className="text-xs text-gray-500 mt-1">{reportDescription.length}/500 characters</p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setReportDialogOpen(false)}
              data-testid="button-cancel-report"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReport}
              disabled={reportUserMutation.isPending || !reportReason || !reportDescription.trim()}
              data-testid="button-submit-report"
            >
              {reportUserMutation.isPending ? 'Reporting...' : 'Submit Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
