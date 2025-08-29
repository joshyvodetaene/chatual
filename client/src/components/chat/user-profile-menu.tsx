import { useState } from 'react';
import { User } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { MessageCircle, User as UserIcon, Shield, Flag, AlertTriangle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';

interface UserProfileMenuProps {
  user: User;
  currentUser: User;
  onStartPrivateChat?: (userId: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export function UserProfileMenu({ 
  user, 
  currentUser, 
  onStartPrivateChat,
  children,
  disabled = false
}: UserProfileMenuProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Report dialog state
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string>('');
  const [reportDescription, setReportDescription] = useState<string>('');

  // Block dialog state
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockReason, setBlockReason] = useState<string>('');

  const reportUserMutation = useMutation({
    mutationFn: async (data: { reportedUserId: string; reason: string; description: string }) => {
      return await apiRequest('POST', '/api/reports', {
        ...data,
        reporterId: currentUser.id,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User reported successfully",
      });
      setReportDialogOpen(false);
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

  const blockUserMutation = useMutation({
    mutationFn: async (data: { blockedId: string; reason?: string }) => {
      return await apiRequest('POST', `/api/users/${currentUser.id}/blocked-users`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `${user.displayName} has been blocked`,
      });
      setBlockDialogOpen(false);
      setBlockReason('');
      // Invalidate related queries to refresh blocked users list
      queryClient.invalidateQueries({ queryKey: ['/api/users', currentUser.id, 'blocked-users'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to block user",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (onStartPrivateChat) {
      onStartPrivateChat(user.id);
    }
  };

  const handleViewProfile = () => {
    setLocation(`/profile/${user.id}`);
  };

  const handleBlockUser = () => {
    setBlockDialogOpen(true);
  };

  const handleReportUser = () => {
    setReportDialogOpen(true);
  };

  const handleSubmitReport = () => {
    if (!reportReason || !reportDescription.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    reportUserMutation.mutate({
      reportedUserId: user.id,
      reason: reportReason,
      description: reportDescription.trim(),
    });
  };

  const handleSubmitBlock = () => {
    blockUserMutation.mutate({
      blockedId: user.id,
      reason: blockReason.trim() || undefined,
    });
  };

  // Don't show menu for current user
  if (disabled) {
    return <>{children}</>;
  }

  const isCurrentUser = user.id === currentUser.id;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div 
            role="button" 
            tabIndex={0} 
            className="w-full cursor-pointer"
          >
            {children}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48 z-50">
          {isCurrentUser ? (
            // Menu options for current user
            <DropdownMenuItem onClick={handleViewProfile} data-testid="menu-view-profile">
              <UserIcon className="w-4 h-4 mr-2" />
              View My Profile
            </DropdownMenuItem>
          ) : (
            // Menu options for other users
            <>
              <DropdownMenuItem onClick={handleSendMessage} data-testid="menu-send-message">
                <MessageCircle className="w-4 h-4 mr-2" />
                Send Message
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleViewProfile} data-testid="menu-view-profile">
                <UserIcon className="w-4 h-4 mr-2" />
                View Profile
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem 
                onClick={handleBlockUser} 
                className="text-orange-600 focus:text-orange-700"
                data-testid="menu-block-user"
              >
                <Shield className="w-4 h-4 mr-2" />
                Block User
              </DropdownMenuItem>

              <DropdownMenuItem 
                onClick={handleReportUser} 
                className="text-red-600 focus:text-red-700"
                data-testid="menu-report-user"
              >
                <Flag className="w-4 h-4 mr-2" />
                Report User
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Block User Dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-orange-500" />
              <span>Block User</span>
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to block {user.displayName}? You won't see their messages or be able to interact with them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="block-reason">Reason (optional)</Label>
              <Textarea
                id="block-reason"
                placeholder="Why are you blocking this user? (optional)"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                maxLength={200}
                data-testid="textarea-block-reason"
              />
              <p className="text-xs text-gray-500 mt-1">{blockReason.length}/200 characters</p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setBlockDialogOpen(false)}
              data-testid="button-cancel-block"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSubmitBlock}
              disabled={blockUserMutation.isPending}
              data-testid="button-confirm-block"
            >
              {blockUserMutation.isPending ? 'Blocking...' : 'Block User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report User Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span>Report User</span>
            </DialogTitle>
            <DialogDescription>
              Report {user.displayName} for inappropriate behavior. Our moderation team will review your report.
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
    </>
  );
}