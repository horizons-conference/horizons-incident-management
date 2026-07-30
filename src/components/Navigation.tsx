import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ListChecks,
  UserCheck,
  BarChart3,
  Users,
  Settings,
  Plus,
  LogOut,
  Shield,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { CONFERENCE_NAME, CONFERENCE_SUBTITLE } from '@/lib/constants';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/incidents', label: 'Incidents', icon: ListChecks },
  { to: '/my-incidents', label: 'My Incidents', icon: UserCheck },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, adminOnly: true },
  { to: '/users', label: 'Users', icon: Users, adminOnly: true },
  { to: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const isAdmin = profile?.role === 'admin';

  return (
    <div className="flex h-full flex-col bg-ink-950 text-ink-100">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-ink-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-extrabold text-sm tracking-tight leading-none text-white">
              {CONFERENCE_NAME}
            </p>
            <p className="text-xs text-ink-400 mt-1 leading-none">{CONFERENCE_SUBTITLE}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar">
        {NAV.filter((n) => !n.adminOnly || isAdmin).map((item) => {
          const active =
            item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand-600 text-white'
                  : 'text-ink-300 hover:bg-ink-800/60 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-ink-800/60">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-9 h-9 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center font-bold text-sm shrink-0">
            {profile?.name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{profile?.name}</p>
            <p className="text-xs text-ink-400 capitalize">
              {profile?.role}
              {profile?.department ? ` · ${profile.department}` : ''}
            </p>
          </div>
          <button
            onClick={signOut}
            className="text-ink-400 hover:text-white hover:bg-ink-800 rounded-lg p-2 transition-colors"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function MobileNav({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="lg:hidden fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-72 max-w-[80vw] animate-slide-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-ink-400 hover:text-white z-10"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
        <Sidebar onNavigate={onClose} />
      </div>
    </div>
  );
}

export function MobileTopBar({ onMenu }: { onMenu: () => void }) {
  return (
    <div className="lg:hidden sticky top-0 z-30 bg-ink-950 text-white px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
          <Shield className="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <p className="font-extrabold text-xs tracking-tight leading-none">{CONFERENCE_NAME}</p>
          <p className="text-[10px] text-ink-400 mt-0.5 leading-none">{CONFERENCE_SUBTITLE}</p>
        </div>
      </div>
      <button
        onClick={onMenu}
        className="p-2 text-ink-200 hover:bg-ink-800 rounded-lg"
        aria-label="Open menu"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
    </div>
  );
}

export function ReportButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="btn-primary shadow-sm">
      <Plus className="w-4.5 h-4.5" />
      <span className="hidden sm:inline">Report Incident</span>
      <span className="sm:hidden">Report</span>
    </button>
  );
}
