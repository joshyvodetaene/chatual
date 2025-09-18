import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useResponsive } from '@/hooks/use-responsive';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Shield, 
  UserPlus,
  Edit3,
  Trash2,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Crown,
  ShieldCheck,
  Search,
  Eye,
  EyeOff
} from 'lucide-react';

// Define admin user type
interface AdminUser {
  id: string;
  username: string;
  role: 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN';
  isActive: boolean;
  createdAt: string;
  lastLogin: string | null;
  createdBy: string;
  updatedBy: string | null;
}

// Form schemas
const createAdminSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50, "Username must be less than 50 characters"),
  password: z.string().min(6, "Password must be at least 6 characters").max(100, "Password must be less than 100 characters"),
  role: z.enum(['MODERATOR', 'ADMIN', 'SUPER_ADMIN'], { message: "Please select a valid role" })
});

const updateAdminSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50, "Username must be less than 50 characters").optional(),
  password: z.string().min(6, "Password must be at least 6 characters").max(100, "Password must be less than 100 characters").optional(),
  role: z.enum(['MODERATOR', 'ADMIN', 'SUPER_ADMIN']).optional()
});

type CreateAdminForm = z.infer<typeof createAdminSchema>;
type UpdateAdminForm = z.infer<typeof updateAdminSchema>;

export default function AdminAccountManagement() {
  const { toast } = useToast();
  const { isMobile, isTablet } = useResponsive();
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [showPasswords, setShowPasswords] = useState({ create: false, edit: false });

  // Form hooks
  const createForm = useForm<CreateAdminForm>({
    resolver: zodResolver(createAdminSchema),
    defaultValues: {
      username: '',
      password: '',
      role: 'MODERATOR'
    }
  });

  const editForm = useForm<UpdateAdminForm>({
    resolver: zodResolver(updateAdminSchema),
    defaultValues: {
      username: '',
      password: '',
      role: 'MODERATOR'
    }
  });

  // Data queries
  const { data: adminsData, isLoading: adminsLoading, refetch: refetchAdmins } = useQuery({
    queryKey: ['/api/admin/manage/users'],
    queryFn: async () => {
      const response = await fetch('/api/admin/manage/users');
      if (!response.ok) {
        throw new Error('Failed to fetch admin users');
      }
      return response.json();
    }
  });

  // Mutations
  const createAdminMutation = useMutation({
    mutationFn: async (data: CreateAdminForm) => {
      const response = await fetch('/api/admin/manage/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create admin user');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ 
        title: 'Admin Created', 
        description: 'New admin user has been created successfully' 
      });
      refetchAdmins();
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Creation Failed', 
        description: error.message || 'Failed to create admin user',
        variant: 'destructive'
      });
    }
  });

  const updateAdminMutation = useMutation({
    mutationFn: async ({ adminId, data }: { adminId: string; data: UpdateAdminForm }) => {
      const response = await fetch(`/api/admin/manage/users/${adminId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update admin user');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ 
        title: 'Admin Updated', 
        description: 'Admin user has been updated successfully' 
      });
      refetchAdmins();
      setIsEditDialogOpen(false);
      editForm.reset();
      setSelectedAdmin(null);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Update Failed', 
        description: error.message || 'Failed to update admin user',
        variant: 'destructive'
      });
    }
  });

  const deleteAdminMutation = useMutation({
    mutationFn: async (adminId: string) => {
      const response = await fetch(`/api/admin/manage/users/${adminId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete admin user');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ 
        title: 'Admin Deleted', 
        description: 'Admin user has been deleted successfully' 
      });
      refetchAdmins();
      setIsDeleteDialogOpen(false);
      setSelectedAdmin(null);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Deletion Failed', 
        description: error.message || 'Failed to delete admin user',
        variant: 'destructive'
      });
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ adminId, isActive }: { adminId: string; isActive: boolean }) => {
      const response = await fetch(`/api/admin/manage/users/${adminId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to toggle admin status');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({ 
        title: variables.isActive ? 'Admin Activated' : 'Admin Deactivated', 
        description: `Admin user has been ${variables.isActive ? 'activated' : 'deactivated'} successfully` 
      });
      refetchAdmins();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Status Change Failed', 
        description: error.message || 'Failed to change admin status',
        variant: 'destructive'
      });
    }
  });

  // Helper functions
  const openEditDialog = (admin: AdminUser) => {
    setSelectedAdmin(admin);
    editForm.reset({
      username: admin.username,
      password: '',
      role: admin.role
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (admin: AdminUser) => {
    setSelectedAdmin(admin);
    setIsDeleteDialogOpen(true);
  };

  const handleCreateSubmit = (data: CreateAdminForm) => {
    createAdminMutation.mutate(data);
  };

  const handleEditSubmit = (data: UpdateAdminForm) => {
    if (!selectedAdmin) return;
    
    // Only include fields that have values
    const cleanData: UpdateAdminForm = {};
    if (data.username && data.username !== selectedAdmin.username) {
      cleanData.username = data.username;
    }
    if (data.password) {
      cleanData.password = data.password;
    }
    if (data.role && data.role !== selectedAdmin.role) {
      cleanData.role = data.role;
    }

    updateAdminMutation.mutate({ adminId: selectedAdmin.id, data: cleanData });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return <Crown className="h-4 w-4 text-yellow-400" />;
      case 'ADMIN': return <Shield className="h-4 w-4 text-blue-400" />;
      case 'MODERATOR': return <ShieldCheck className="h-4 w-4 text-green-400" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'default';
      case 'ADMIN': return 'secondary'; 
      case 'MODERATOR': return 'outline';
      default: return 'outline';
    }
  };

  const filteredAdmins = adminsData?.admins?.filter((admin: AdminUser) =>
    admin.username.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className={cn(
          "font-bold text-white mb-2",
          isMobile ? "text-xl" : "text-2xl"
        )} data-testid="text-admin-accounts-title">
          Admin Account Management
        </h2>
        <p className={cn(
          "text-slate-400",
          isMobile ? "text-sm" : "text-base"
        )} data-testid="text-admin-accounts-description">
          Manage admin user accounts, roles, and permissions. Only SUPER_ADMIN users can access this panel.
        </p>
      </div>

      {/* Controls */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Admin Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn(
            "flex gap-4",
            isMobile ? "flex-col" : "flex-row items-end"
          )}>
            <div className="flex-1">
              <label className="text-sm text-slate-400 mb-2 block">Search Admin Users</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="Search by username..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-700 border-slate-600 text-white"
                  data-testid="input-search-admins"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => refetchAdmins()}
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
                data-testid="button-refresh-admins"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    data-testid="button-create-admin"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create Admin
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-800 border-slate-700">
                  <DialogHeader>
                    <DialogTitle className="text-white">Create New Admin User</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Create a new admin user with specified role and permissions.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...createForm}>
                    <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
                      <FormField
                        control={createForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-200">Username</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                className="bg-slate-700 border-slate-600 text-white"
                                data-testid="input-create-username"
                                autoComplete="username"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-200">Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  {...field}
                                  type={showPasswords.create ? "text" : "password"}
                                  className="bg-slate-700 border-slate-600 text-white pr-10"
                                  data-testid="input-create-password"
                                  autoComplete="new-password"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                  onClick={() => setShowPasswords(prev => ({ ...prev, create: !prev.create }))}
                                >
                                  {showPasswords.create ? (
                                    <EyeOff className="h-4 w-4 text-slate-400" />
                                  ) : (
                                    <Eye className="h-4 w-4 text-slate-400" />
                                  )}
                                </Button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-200">Role</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-slate-700 border-slate-600 text-white" data-testid="select-create-role">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="MODERATOR">Moderator</SelectItem>
                                <SelectItem value="ADMIN">Admin</SelectItem>
                                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex gap-2 pt-4">
                        <Button
                          type="submit"
                          disabled={createAdminMutation.isPending}
                          className="flex-1 bg-blue-600 hover:bg-blue-700"
                          data-testid="button-submit-create"
                        >
                          {createAdminMutation.isPending ? 'Creating...' : 'Create Admin'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsCreateDialogOpen(false)}
                          className="border-slate-600 text-slate-300 hover:bg-slate-700"
                          data-testid="button-cancel-create"
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Users List */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">
            Admin Users ({filteredAdmins.length})
          </CardTitle>
          <CardDescription className="text-slate-400">
            Manage admin user accounts, roles, and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {adminsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
              <span className="ml-2 text-slate-400">Loading admin users...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAdmins.map((admin: AdminUser) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg hover:bg-slate-900/70 transition-colors"
                  data-testid={`admin-card-${admin.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold",
                      admin.isActive ? "bg-blue-600" : "bg-slate-600"
                    )}>
                      {admin.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-medium">{admin.username}</span>
                        <Badge variant={getRoleBadgeVariant(admin.role)}>
                          <div className="flex items-center gap-1">
                            {getRoleIcon(admin.role)}
                            {admin.role}
                          </div>
                        </Badge>
                        {!admin.isActive && <Badge variant="destructive">Inactive</Badge>}
                      </div>
                      <p className="text-sm text-slate-400">
                        Created: {new Date(admin.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-slate-500">
                        ID: {admin.id.slice(0, 8)}... | Created by: {admin.createdBy}
                      </p>
                    </div>
                  </div>
                  <div className={cn(
                    "flex gap-2",
                    isMobile ? "flex-col" : "flex-row"
                  )}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(admin)}
                      className="border-blue-600 text-blue-300 hover:bg-blue-600/20"
                      data-testid={`button-edit-${admin.id}`}
                    >
                      <Edit3 className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleStatusMutation.mutate({ adminId: admin.id, isActive: !admin.isActive })}
                      className={admin.isActive ? 
                        "border-orange-600 text-orange-300 hover:bg-orange-600/20" :
                        "border-green-600 text-green-300 hover:bg-green-600/20"
                      }
                      disabled={toggleStatusMutation.isPending}
                      data-testid={`button-toggle-${admin.id}`}
                    >
                      {admin.isActive ? (
                        <>
                          <ToggleLeft className="h-3 w-3 mr-1" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <ToggleRight className="h-3 w-3 mr-1" />
                          Activate
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openDeleteDialog(admin)}
                      className="border-red-600 text-red-300 hover:bg-red-600/20"
                      data-testid={`button-delete-${admin.id}`}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
              {filteredAdmins.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  No admin users found matching your search criteria.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Admin User</DialogTitle>
            <DialogDescription className="text-slate-400">
              Update admin user details and permissions. Leave password empty to keep current password.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-200">Username</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="bg-slate-700 border-slate-600 text-white"
                        data-testid="input-edit-username"
                        autoComplete="username"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-200">Password (optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showPasswords.edit ? "text" : "password"}
                          placeholder="Leave empty to keep current password"
                          className="bg-slate-700 border-slate-600 text-white pr-10"
                          data-testid="input-edit-password"
                          autoComplete="new-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPasswords(prev => ({ ...prev, edit: !prev.edit }))}
                        >
                          {showPasswords.edit ? (
                            <EyeOff className="h-4 w-4 text-slate-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-slate-400" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-200">Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white" data-testid="select-edit-role">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="MODERATOR">Moderator</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  disabled={updateAdminMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  data-testid="button-submit-edit"
                >
                  {updateAdminMutation.isPending ? 'Updating...' : 'Update Admin'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Admin User</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete the admin user "{selectedAdmin?.username}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-4">
            <Button
              onClick={() => selectedAdmin && deleteAdminMutation.mutate(selectedAdmin.id)}
              disabled={deleteAdminMutation.isPending}
              variant="destructive"
              className="flex-1"
              data-testid="button-confirm-delete"
            >
              {deleteAdminMutation.isPending ? 'Deleting...' : 'Delete Admin'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}