/** Default TopBar titles by pathname (under /app). */
export function titleForAppPath(pathname: string): string {
  if (pathname.endsWith('/overview') || pathname === '/app') return 'Overview';
  if (pathname.includes('/calls')) return 'Calls & Orders';
  if (pathname.includes('/menu')) return 'Menu Management';
  if (pathname.includes('/achievements')) return 'Achievements';
  if (pathname.includes('/settings')) return 'Settings';
  if (pathname.includes('/reports')) return 'Reports';
  if (pathname.includes('/earnings')) return 'Earnings';
  if (pathname.includes('/support')) return 'Support';
  return 'Skai';
}
