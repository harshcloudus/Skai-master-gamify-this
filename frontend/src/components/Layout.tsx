import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useLockBodyScroll } from '../lib/use-lock-body-scroll';
import { cn } from '../lib/utils';
import type { AppLayoutOutletContext } from '../types/layout-context';
import { titleForAppPath } from '../lib/route-titles';

const SIDEBAR_STORAGE_KEY = 'skai.sidebarCollapsed';

function readSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function Layout() {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [headerTitleOverride, setHeaderTitleOverride] = useState<string | null>(
    null,
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SIDEBAR_STORAGE_KEY,
        sidebarCollapsed ? 'true' : 'false',
      );
    } catch {
      // ignore
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const closeIfDesktop = () => {
      if (mq.matches) setMobileMenuOpen(false);
    };
    closeIfDesktop();
    mq.addEventListener('change', closeIfDesktop);
    return () => mq.removeEventListener('change', closeIfDesktop);
  }, []);

  useLockBodyScroll(mobileMenuOpen);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileMenuOpen]);

  useLayoutEffect(() => {
    setHeaderTitleOverride(null);
  }, [location.pathname]);

  const headerTitle =
    headerTitleOverride ?? titleForAppPath(location.pathname);

  const outletContext: AppLayoutOutletContext = {
    sidebarCollapsed,
    setHeaderTitle: setHeaderTitleOverride,
  };

  return (
    <div className="min-h-screen flex">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[215] bg-slate-900/50 md:hidden"
          aria-hidden
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <main
        className={cn(
          'flex min-h-screen min-h-dvh min-w-0 flex-1 flex-col bg-surface transition-[margin] duration-200 ease-out',
          'ml-0',
          sidebarCollapsed ? 'md:ml-[5.5rem]' : 'md:ml-64',
        )}
      >
        <TopBar
          title={headerTitle}
          sidebarCollapsed={sidebarCollapsed}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden pt-16">
          <Outlet context={outletContext} />
        </div>
      </main>
    </div>
  );
}
