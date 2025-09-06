import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Trash2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { User } from '@shared/schema';

interface AccountDeletionProps {
  user: User;
  isMobile?: boolean;
}

export default function AccountDeletion({ user, isMobile = false }: AccountDeletionProps) {
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const { toast } = useToast();

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      if (!confirmPassword.trim()) {
        throw new Error('Password confirmation is required');
      }
      
      const response = await fetch(`/api/users/${user.id}/account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirmPassword })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete account');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      console.log('Account deletion successful:', data);
      
      // Clear all local storage data
      localStorage.removeItem('chatual_user');
      localStorage.removeItem('chatual_active_room');
      
      toast({
        title: "Account Deleted",
        description: "Your account and all associated data have been permanently deleted according to GDPR requirements.",
      });
      
      // Redirect to home page after a brief delay
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    },
    onError: (error: any) => {
      console.error('Account deletion failed:', error);
      
      const errorMessage = error.message || 'Failed to delete account. Please try again later.';
      
      toast({
        title: "Deletion Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const handleDeleteAccount = () => {
    if (!confirmPassword.trim()) {
      toast({
        title: "Password Required",
        description: "Please enter your password to confirm account deletion.",
        variant: "destructive",
      });
      return;
    }
    
    deleteAccountMutation.mutate();
    setIsConfirmOpen(false);
  };

  return (
    <Card className={`border-destructive/20 ${isMobile ? 'mx-0' : ''}`} data-testid="account-deletion">
      <CardHeader className={isMobile ? 'p-4 pb-3' : ''}>
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <CardTitle className={`text-destructive ${isMobile ? 'text-lg' : ''}`}>
            Delete Account
          </CardTitle>
        </div>
        <CardDescription className={`${isMobile ? 'text-sm' : ''} text-muted-foreground`}>
          Permanently delete your account and all associated data. This action cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent className={isMobile ? 'p-4 pt-0' : ''}>
        <div className="space-y-4">
          {/* GDPR Information */}
          <div className="bg-muted/50 p-4 rounded-lg border">
            <h4 className={`font-semibold mb-2 ${isMobile ? 'text-sm' : ''}`}>What will be deleted:</h4>
            <ul className={`space-y-1 ${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
              <li>• Your profile information and photos</li>
              <li>• All your messages (will be anonymized in chat history)</li>
              <li>• Your reactions, reports, and moderation records</li>
              <li>• Room memberships and blocking relationships</li>
              <li>• Notification settings and preferences</li>
              <li>• All personal data according to GDPR requirements</li>
            </ul>
            <p className={`mt-3 font-medium text-destructive ${isMobile ? 'text-xs' : 'text-sm'}`}>
              This action is permanent and cannot be reversed.
            </p>
          </div>

          {/* Password Confirmation */}
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className={isMobile ? 'text-sm' : ''}>
              Confirm your password to proceed
            </Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Enter your current password"
                className="pr-10"
                data-testid="input-confirm-password"
                disabled={deleteAccountMutation.isPending}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                data-testid="button-toggle-password"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Delete Button with Confirmation Dialog */}
          <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className={`w-full ${isMobile ? 'text-sm py-2' : ''}`}
                disabled={!confirmPassword.trim() || deleteAccountMutation.isPending}
                data-testid="button-delete-account"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {deleteAccountMutation.isPending ? 'Deleting Account...' : 'Delete My Account'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent data-testid="confirm-deletion-dialog">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  <span>Confirm Account Deletion</span>
                </AlertDialogTitle>
                <AlertDialogDescription className="text-left space-y-2">
                  <p>
                    You are about to permanently delete your account for <strong>{user.displayName}</strong> (@{user.username}).
                  </p>
                  <p className="text-destructive font-medium">
                    This will immediately and permanently remove all your data from our servers according to GDPR requirements.
                  </p>
                  <p>
                    Are you absolutely sure you want to continue?
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-deletion">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  data-testid="button-confirm-deletion"
                  disabled={deleteAccountMutation.isPending}
                >
                  {deleteAccountMutation.isPending ? 'Deleting...' : 'Yes, Delete My Account'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Legal Notice */}
          <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground border-t pt-4`}>
            <p>
              <strong>Legal Notice:</strong> Account deletion complies with GDPR Article 17 (Right to Erasure).
              Your data will be permanently removed from our systems within 30 days.
              Some anonymized data may be retained for legal compliance purposes.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}