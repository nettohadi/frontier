'use client';

import { useState } from 'react';
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
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';

const menuItems = [
  { id: 'dashboard', href: '/', label: 'Dashboard', icon: Home },
  { id: 'videos', href: '/videos', label: 'All Videos', icon: LayoutGrid },
  { id: 'topics', href: '/topics', label: 'Manage Topics', icon: BookOpen },
  { id: 'schedule', href: '/schedule', label: 'Upload Schedule', icon: Calendar },
  { id: 'settings', href: '/settings', label: 'Settings', icon: Settings },
];

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const getCurrentPage = () => {
    if (pathname === '/') return 'dashboard';
    // Get the first segment after /
    const segment = pathname.split('/')[1];
    return segment || 'dashboard';
  };

  const currentPage = getCurrentPage();

  return (
    <TooltipProvider>
      <div className="flex min-h-screen bg-background">
        {/* Sidebar */}
        <aside
          className={cn(
            'fixed left-0 top-0 z-40 h-screen border-r bg-card transition-all duration-300',
            sidebarCollapsed ? 'w-16' : 'w-64'
          )}
        >
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b px-4">
            {!sidebarCollapsed && (
              <Link href="/" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <span className="font-bold">Frontier</span>
              </Link>
            )}
            {sidebarCollapsed && (
              <Link href="/" className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </Link>
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
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {!sidebarCollapsed && <span>{item.label}</span>}
                    </Link>
                  </TooltipTrigger>
                  {sidebarCollapsed && (
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </nav>

          {/* Collapse button */}
          <div className="absolute bottom-4 left-0 right-0 px-2">
            <Separator className="mb-4" />
            <div className="flex items-center justify-between px-2">
              {!sidebarCollapsed && <ThemeToggle />}
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
          </div>
        </aside>

        {/* Main Content */}
        <main
          className={cn(
            'flex-1 transition-all duration-300',
            sidebarCollapsed ? 'ml-16' : 'ml-64'
          )}
        >
          {children}
        </main>
      </div>
      <Toaster position="top-right" richColors />
    </TooltipProvider>
  );
}
