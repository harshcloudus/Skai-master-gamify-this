import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  PhoneCall,
  UtensilsCrossed,
  BarChart3,
  CircleDollarSign,
  Settings,
  HelpCircle,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/auth-context';
import { useMediaQuery } from '../lib/use-media-query';

const navItems = [
  { icon: LayoutDashboard, label: 'Overview', path: '/app/overview' },
  { icon: PhoneCall, label: 'Calls & Orders', path: '/app/calls' },
  { icon: UtensilsCrossed, label: 'Menu', path: '/app/menu' },
  { icon: BarChart3, label: 'Reports', path: '/app/reports' },
  { icon: CircleDollarSign, label: 'Earnings', path: '/app/earnings' },
];

const prefItems = [
  { icon: Settings, label: 'Settings', path: '/app/settings' },
  { icon: HelpCircle, label: 'Support', path: '/app/support' },
];

export default function Sidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const isNarrowViewport = useMediaQuery('(max-width: 767px)');

  const displayName = profile?.restaurant?.name || 'Restaurant';
  const displayRole = profile?.full_name || profile?.email || 'User';

  const showNavText = !collapsed || isNarrowViewport;

  async function handleLogout() {
    onCloseMobile();
    await signOut();
    navigate('/login', { replace: true });
  }

  function handleSeamToggle() {
    if (isNarrowViewport) onCloseMobile();
    else onToggleCollapsed();
  }

  return (
    <aside
      className={cn(
        'h-dvh fixed left-0 top-0 z-[220] flex shrink-0 flex-col border-r border-nav-border bg-nav-bg/95 px-4 py-8 backdrop-blur-3xl',
        'transition-transform duration-200 ease-out',
        'w-64',
        collapsed && 'md:w-20',
        // Small viewports: drawer off-screen unless open (CSS — no flash from JS)
        'max-md:pointer-events-none max-md:-translate-x-full',
        mobileOpen && 'max-md:pointer-events-auto max-md:translate-x-0',
        'md:pointer-events-auto md:translate-x-0',
        mobileOpen && 'max-md:shadow-2xl',
      )}
    >
      <button
        type="button"
        onClick={handleSeamToggle}
        className={cn(
          'absolute left-full top-8 z-[225] flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full',
          'border border-nav-border bg-nav-bg/90 text-nav-text-muted shadow-lg shadow-black/30 backdrop-blur-xl transition-colors',
          'hover:bg-nav-bg hover:text-nav-text',
          !mobileOpen && 'max-md:hidden',
        )}
        aria-label={
          isNarrowViewport
            ? 'Close menu'
            : collapsed
              ? 'Expand sidebar'
              : 'Collapse sidebar'
        }
        title={
          isNarrowViewport
            ? 'Close menu'
            : collapsed
              ? 'Show sidebar'
              : 'Hide sidebar'
        }
      >
        {isNarrowViewport || !collapsed ? (
          <PanelLeftClose className="h-4 w-4" />
        ) : (
          <PanelLeftOpen className="h-4 w-4" />
        )}
      </button>

      <div className={cn('mb-6 w-full min-w-0', showNavText ? 'px-4' : '')}>
        <button
          type="button"
          onClick={() => {
            navigate('/app/overview');
            onCloseMobile();
          }}
          className={cn(
            'flex min-w-0 items-center rounded-lg',
            showNavText ? 'gap-3' : 'w-full justify-center',
          )}
          aria-label="Go to overview"
          title="Overview"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
            <img
              src="/skai-favicon.png"
              alt="Skai"
              className="h-7 w-7 max-h-7 max-w-[1.75rem] object-contain object-center"
              draggable={false}
            />
          </div>
          {showNavText && (
            <div className="min-w-0">
              <img
                src="/skai-wordmark-white.png"
                alt="Skai"
                className="h-6 max-w-full object-contain object-left"
                draggable={false}
              />
            </div>
          )}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <nav className="space-y-1.5">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => onCloseMobile()}
              className={({ isActive }) =>
                cn(
                  cn(
                    'flex items-center rounded-xl text-sm font-semibold transition-all',
                    showNavText
                      ? 'gap-3 px-4 py-3'
                      : 'justify-center px-2 py-3',
                  ),
                  isActive
                    ? 'bg-primary/10 font-bold text-primary ring-1 ring-inset ring-primary/25'
                    : 'text-nav-text-muted hover:bg-white/10 hover:text-nav-text',
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {showNavText && item.label}
            </NavLink>
          ))}

          {prefItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => onCloseMobile()}
              className={({ isActive }) =>
                cn(
                  cn(
                    'flex items-center rounded-xl text-sm font-semibold transition-all',
                    showNavText
                      ? 'gap-3 px-4 py-3'
                      : 'justify-center px-2 py-3',
                  ),
                  isActive
                    ? 'bg-primary/10 font-bold text-primary ring-1 ring-inset ring-primary/25'
                    : 'text-nav-text-muted hover:bg-white/10 hover:text-nav-text',
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {showNavText && item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="mt-4 pt-4">
        <div
          className={cn(
            'mb-4 flex items-center',
            showNavText ? 'gap-3 px-2' : 'justify-center px-1',
          )}
        >
          <div className="relative shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-nav-border bg-primary/10 text-sm font-bold text-primary">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-nav-bg bg-secondary"></div>
          </div>
          {showNavText && (
            <div className="min-w-0 overflow-hidden text-left">
              <p className="truncate text-sm font-bold text-nav-text">
                {displayName}
              </p>
              <p className="truncate text-xs text-nav-text-muted">
                {displayRole}
              </p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            'flex w-full items-center text-xs font-bold uppercase tracking-wider text-nav-text-muted transition-colors hover:text-primary',
            showNavText ? 'gap-3 px-4 py-2 text-left' : 'justify-center px-2 py-2',
          )}
          title="Logout"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {showNavText && 'Logout'}
        </button>
      </div>
    </aside>
  );
}
