import React from 'react';
import { Home, Search, Bell, Mail, Bookmark, User, Settings, LogOut, MoreHorizontal, PenSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const { user, logout } = useAuth();

  const getSafeUsername = (user: any): string => {
    try {
      if (user?.username && typeof user.username === 'string') return user.username;
      if (user?.email && typeof user.email === 'string') return user.email.split('@')[0] || 'user';
      return 'user';
    } catch { return 'user'; }
  };

  const getSafeDisplayName = (user: any): string => {
    try {
      if (user?.displayName && typeof user.displayName === 'string') return user.displayName;
      if (user?.name && typeof user.name === 'string') return user.name;
      const u = getSafeUsername(user);
      return u.charAt(0).toUpperCase() + u.slice(1);
    } catch { return 'User'; }
  };

  const navigation = [
    { name: 'Home1',          icon: Home,     key: 'home' },
    { name: 'Explore1',       icon: Search,   key: 'explore' },
    { name: 'Notifications', icon: Bell,     key: 'notifications' },
    { name: 'Messages',      icon: Mail,     key: 'messages' },
    { name: 'Bookmarks',     icon: Bookmark, key: 'bookmarks' },
    { name: 'Profile',       icon: User,     key: 'profile' },
    { name: 'Settings',      icon: Settings, key: 'settings' },
  ];

  const handleLogout = async () => {
    try { await logout(); } catch (e) { console.error('Logout failed:', e); }
  };

  if (!user) return null;

  const safeUsername     = getSafeUsername(user);
  const safeDisplayName  = getSafeDisplayName(user);
  const safeProfileImage = user?.profileImageUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(safeDisplayName)}&background=6366f1&color=ffffff`;

  return (
    <aside
      style={{ borderRightColor: 'var(--border, #2f3336)', backgroundColor: 'var(--bg, #000)' }}
      className="w-64 h-screen sticky top-0 p-4 border-r flex flex-col"
    >
      {/* ── Logo ── */}
      <div className="flex items-center space-x-3 mb-8 p-2">
        <div
          style={{ background: 'var(--accent, #1d9bf0)' }}
          className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="var(--accent-text, #fff)">
            <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
          </svg>
        </div>
        <span style={{ color: 'var(--text, #e7e9ea)' }} className="text-xl font-bold tracking-tight">
          Patr
        </span>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onTabChange(item.key)}
              style={{
                color:           isActive ? 'var(--text, #e7e9ea)'    : 'var(--text-dim, #71767b)',
                backgroundColor: isActive ? 'var(--active-bg, rgba(255,255,255,0.10))' : 'transparent',
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-full text-left transition-all duration-150 group"
              onMouseEnter={e => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--hover, rgba(255,255,255,0.06))';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text, #e7e9ea)';
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-dim, #71767b)';
                }
              }}
            >
              <Icon
                style={{ color: isActive ? 'var(--accent, #1d9bf0)' : 'inherit' }}
                className="w-6 h-6 flex-shrink-0 transition-colors"
              />
              <span className={`text-base ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.name}
              </span>
            </button>
          );
        })}

        {/* Post button */}
        <button
          onClick={() => onTabChange('compose')}
          style={{
            backgroundColor: 'var(--accent, #1d9bf0)',
            color:           'var(--accent-text, #fff)',
          }}
          className="w-full mt-4 flex items-center justify-center space-x-2 font-bold py-3 px-6 rounded-full transition-all duration-150 hover:opacity-90 active:scale-95 shadow-md"
        >
          <PenSquare className="w-5 h-5" />
          <span>Post</span>
        </button>
      </nav>

      {/* ── User card ── */}
      <div className="mt-auto relative group">
        <button
          style={{ color: 'var(--text, #e7e9ea)' }}
          className="w-full flex items-center space-x-3 p-3 rounded-full transition-all duration-150"
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--hover, rgba(255,255,255,0.06))'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'}
        >
          <img
            src={safeProfileImage}
            alt={safeDisplayName}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(safeDisplayName)}&background=6366f1&color=ffffff`; }}
          />
          <div className="flex-1 text-left overflow-hidden">
            <div style={{ color: 'var(--text, #e7e9ea)' }} className="font-bold text-sm truncate">
              {safeDisplayName}
            </div>
            <div style={{ color: 'var(--text-dim, #71767b)' }} className="text-sm truncate">
              @{safeUsername}
            </div>
          </div>
          <MoreHorizontal style={{ color: 'var(--text-dim, #71767b)' }} className="w-5 h-5 flex-shrink-0" />
        </button>

        {/* Dropdown */}
        <div
          style={{
            backgroundColor: 'var(--bg, #000)',
            borderColor:     'var(--border, #2f3336)',
          }}
          className="absolute bottom-full left-0 mb-2 w-full border rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 z-50"
        >
          <div className="p-2">
            <button
              onClick={handleLogout}
              style={{ color: 'var(--text, #e7e9ea)' }}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-red-500/10 transition-colors text-left"
            >
              <LogOut className="w-5 h-5 text-red-400" />
              <span>Log out @{safeUsername}</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;