'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  LayoutGrid,
  Home,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Settings,
  Calendar,
  Menu,
  X,
  LogOut,
} from 'lucide-react';

import NextTopLoader from 'nextjs-toploader';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { ThemeToggle } from '@/components/theme-toggle';
import { signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';

const menuItems = [
  { id: 'dashboard', href: '/', label: 'Dashboard', icon: Home },
  { id: 'videos', href: '/videos', label: 'All Videos', icon: LayoutGrid },
  { id: 'topics', href: '/topics', label: 'Manage Topics', icon: BookOpen },
  { id: 'schedule', href: '/schedule', label: 'Upload Schedule', icon: Calendar },
  { id: 'settings', href: '/settings', label: 'Settings', icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const getCurrentPage = () => {
    if (pathname === '/') return 'dashboard';
    // Get the first segment after /
    const segment = pathname.split('/')[1];
    return segment || 'dashboard';
  };

  const currentPage = getCurrentPage();
  const currentPageLabel = menuItems.find((item) => item.id === currentPage)?.label || 'Dashboard';

  return (
    <TooltipProvider>
      <NextTopLoader color="hsl(var(--primary))" height={2} showSpinner={false} />
      <div className="bg-background flex min-h-screen">
        {/* Mobile Header */}
        <header className="bg-background/95 fixed top-0 right-0 left-0 z-50 flex items-center justify-between border-b px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(true)}
            className="h-9 w-9"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-primary/10 flex h-7 w-7 items-center justify-center rounded-lg">
              <Sparkles className="text-primary h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-bold">Frontier</span>
          </Link>
          <ThemeToggle />
        </header>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/50 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            'bg-card fixed top-0 left-0 z-50 h-screen border-r transition-all duration-300',
            // Desktop: always visible, can be collapsed
            'hidden md:block',
            sidebarCollapsed ? 'md:w-16' : 'md:w-64',
            // Mobile: slide in from left
            mobileMenuOpen && 'block w-64 shadow-xl'
          )}
        >
          {/* Logo */}
          <div className="flex h-14 items-center justify-between border-b px-4 pt-[env(safe-area-inset-top)] md:h-16 md:pt-0">
            {(!sidebarCollapsed || mobileMenuOpen) && (
              <Link href="/" className="flex items-center gap-2">
                <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg">
                  <Sparkles className="text-primary h-4 w-4" />
                </div>
                <span className="font-bold">Frontier</span>
              </Link>
            )}
            {sidebarCollapsed && !mobileMenuOpen && (
              <Link
                href="/"
                className="bg-primary/10 mx-auto flex h-8 w-8 items-center justify-center rounded-lg"
              >
                <Sparkles className="text-primary h-4 w-4" />
              </Link>
            )}
            {/* Mobile close button */}
            {mobileMenuOpen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                className="h-8 w-8 md:hidden"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-1 p-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <Tooltip key={item.id} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {(!sidebarCollapsed || mobileMenuOpen) && <span>{item.label}</span>}
                    </Link>
                  </TooltipTrigger>
                  {sidebarCollapsed && !mobileMenuOpen && (
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </nav>

          {/* Collapse button (desktop only) */}
          <div className="absolute right-0 bottom-4 left-0 hidden px-2 md:block">
            <Separator className="mb-4" />
            <div className="flex items-center justify-between px-2">
              {!sidebarCollapsed && <ThemeToggle />}
              {!sidebarCollapsed && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="h-8 w-8"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className={cn('h-8 w-8', sidebarCollapsed && 'mx-auto')}
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </div>
            {sidebarCollapsed && (
              <div className="mt-2 flex justify-center px-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="h-8 w-8"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Mobile bottom section */}
          <div className="absolute right-0 bottom-4 left-0 px-2 md:hidden">
            <Separator className="mb-4" />
            <div className="flex items-center justify-center gap-2 px-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="h-8 w-8"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main
          className={cn(
            'flex-1 transition-all duration-300 min-w-0 overflow-x-hidden',
            // Mobile: no margin, add top padding for header
            'mt-[calc(3.75rem+env(safe-area-inset-top))] md:mt-0',
            // Desktop: margin based on sidebar state
            sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
          )}
        >
          {children}
        </main>
      </div>
      <Toaster position="top-right" richColors />
    </TooltipProvider>
  );
}
