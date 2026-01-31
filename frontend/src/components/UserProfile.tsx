import { useAuth } from '../contexts/AuthContext';
import { UserAvatar } from './UserAvatar';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  LogOut,
  Shield,
  Star,
  Calendar,
  Building2
} from 'lucide-react';

interface UserProfileProps {
  onLogout?: () => void;
  compact?: boolean;
}

const roleLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  user: { label: 'Member', variant: 'secondary' },
  moderator: { label: 'Moderator', variant: 'default' },
  admin: { label: 'Admin', variant: 'destructive' },
  government: { label: 'Government', variant: 'outline' }
};

export function UserProfile({ onLogout, compact = false }: UserProfileProps) {
  const { user, logout, isUserModerator, isGovernmentUser } = useAuth();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    onLogout?.();
  };

  const roleInfo = roleLabels[user.role] || roleLabels.user;
  const joinDate = new Date(user.created_at * 1000).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short'
  });

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <UserAvatar user={user} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{user.display_name}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border p-6">
      <div className="flex items-start gap-4">
        <UserAvatar user={user} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold truncate">{user.display_name}</h3>
            <Badge variant={roleInfo.variant}>{roleInfo.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{user.email}</p>

          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 text-yellow-500" />
              <span>{user.reputation_score} reputation</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Joined {joinDate}</span>
            </div>
          </div>

          {(isUserModerator || isGovernmentUser) && (
            <div className="flex items-center gap-2 mt-3">
              {isUserModerator && (
                <div className="flex items-center gap-1 text-sm text-blue-600">
                  <Shield className="h-4 w-4" />
                  <span>Moderator Access</span>
                </div>
              )}
              {isGovernmentUser && (
                <div className="flex items-center gap-1 text-sm text-green-600">
                  <Building2 className="h-4 w-4" />
                  <span>Government User</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t">
        <Button variant="outline" onClick={handleLogout} className="w-full">
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

// Dropdown menu version for navbar
export function UserProfileDropdown() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-sidebar-accent/50 transition-colors">
        <UserAvatar user={user} size="sm" />
      </button>

      <div className="absolute right-0 top-full mt-2 w-64 bg-popover border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <UserAvatar user={user} size="md" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{user.display_name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <Badge variant={roleLabels[user.role]?.variant || 'secondary'}>
              {roleLabels[user.role]?.label || 'Member'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {user.reputation_score} rep
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={logout}
            className="w-full"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
