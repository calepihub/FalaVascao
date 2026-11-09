export type UserRole = 'owner' | 'admin' | 'moderator' | 'vip' | 'member';
export type UserStatus = 'active' | 'pending' | 'blocked';

export interface UserPermissions {
  canPostMural: boolean;
  canUseTactics: boolean;
  canUseAdvancedTools: boolean;
  canModerate: boolean;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  avatar: string;
  role: UserRole;
  status: UserStatus;
  permissions: UserPermissions;
  createdAt: string;
}

export interface SiteSettings {
  muralVisible: boolean;
  muralPublicPosting: boolean;
  tacticsVisible: boolean;
  advancedToolsVisible: boolean;
  liveStreamsVisible: boolean;
  kickBannerVisible: boolean;
}

export const OWNER_EMAIL = 'tazmaniacrvg@gmail.com';

const AUTH_STORAGE_KEY = 'falavascao_current_user_v2';

export const authService = {
  getCurrentUser(): AppUser | null {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const user = JSON.parse(saved) as AppUser;
        // Strict security: if email is tazmaniacrvg@gmail.com, force owner
        if (user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
          user.role = 'owner';
          user.status = 'active';
          user.permissions = {
            canPostMural: true,
            canUseTactics: true,
            canUseAdvancedTools: true,
            canModerate: true
          };
        }
        return user;
      }
    } catch {}
    return null;
  },

  setCurrentUser(user: AppUser | null): void {
    if (user) {
      if (user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
        user.role = 'owner';
        user.status = 'active';
        user.permissions = {
          canPostMural: true,
          canUseTactics: true,
          canUseAdvancedTools: true,
          canModerate: true
        };
      }
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  },

  isOwner(user?: AppUser | null): boolean {
    if (!user) return false;
    return (
      user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase() || user.role === 'owner'
    );
  },

  isAdminOrOwner(user?: AppUser | null): boolean {
    if (!user) return false;
    return (
      this.isOwner(user) || user.role === 'admin'
    );
  },

  async loginWithGoogle(
    email: string,
    name?: string,
    avatar?: string
  ): Promise<AppUser> {
    const isOwner = email.trim().toLowerCase() === OWNER_EMAIL.toLowerCase();

    // Call server to persist in InterBase database
    try {
      const res = await fetch('/api/interbase/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name || (isOwner ? 'Tazmania CRVG (Owner)' : email.split('@')[0]),
          avatar: avatar || ''
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          const user = data.user as AppUser;
          if (isOwner) {
            user.role = 'owner';
            user.status = 'active';
            user.permissions = {
              canPostMural: true,
              canUseTactics: true,
              canUseAdvancedTools: true,
              canModerate: true
            };
          }
          this.setCurrentUser(user);
          return user;
        }
      }
    } catch (e) {
      console.warn('Could not sync user with server, using local fallback', e);
    }

    // Local fallback if server had temporary failure
    const fallbackUser: AppUser = {
      id: isOwner ? 'owner_tazmaniacrvg' : `usr_${Date.now()}`,
      email: email.trim().toLowerCase(),
      name: name || (isOwner ? 'Tazmania CRVG (Owner)' : email.split('@')[0]),
      avatar: avatar || '',
      role: isOwner ? 'owner' : 'member',
      status: 'active',
      permissions: isOwner
        ? { canPostMural: true, canUseTactics: true, canUseAdvancedTools: true, canModerate: true }
        : { canPostMural: true, canUseTactics: true, canUseAdvancedTools: false, canModerate: false },
      createdAt: new Date().toISOString()
    };
    this.setCurrentUser(fallbackUser);
    return fallbackUser;
  },

  logout(): void {
    this.setCurrentUser(null);
  },

  async getRegisteredUsers(): Promise<AppUser[]> {
    try {
      const res = await fetch('/api/interbase/users');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Failed to load registered users', e);
    }
    return [];
  },

  async updateUser(update: {
    id: string;
    role?: UserRole;
    status?: UserStatus;
    permissions?: Partial<UserPermissions>;
  }): Promise<AppUser | null> {
    try {
      const res = await fetch('/api/interbase/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update)
      });
      if (res.ok) {
        const data = await res.json();
        return data.user;
      }
    } catch (e) {
      console.warn('Failed to update user', e);
    }
    return null;
  },

  async deleteUser(userId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/interbase/users?id=${userId}`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async getSiteSettings(): Promise<SiteSettings> {
    const defaults: SiteSettings = {
      muralVisible: true,
      muralPublicPosting: true,
      tacticsVisible: true,
      advancedToolsVisible: true,
      liveStreamsVisible: true,
      kickBannerVisible: true
    };
    try {
      const res = await fetch('/api/interbase/settings');
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return defaults;
  },

  async updateSiteSettings(settings: Partial<SiteSettings>): Promise<SiteSettings | null> {
    try {
      const res = await fetch('/api/interbase/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        const data = await res.json();
        return data.settings;
      }
    } catch {}
    return null;
  }
};
