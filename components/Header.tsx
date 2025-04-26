"use client";

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Bell, LogOut, Loader2, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSupabase } from '@/app/supabase-provider';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { supabase, session } = useSupabase();
  const { toast } = useToast();
  
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
      router.refresh(); // Refresh server state first
      router.push('/login');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const navItems = [
    { name: 'Dashboard', href: '/' },
    { name: 'Analytics', href: '/analytics' },
    { name: 'Tasks', href: '/tasks' },
    { name: 'Settings', href: '/settings' },
  ];

  // Compute user initials from full_name or fallback to email
  const userName = session?.user.user_metadata?.full_name;
  const initials = userName
    ? userName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : session?.user.email?.[0]?.toUpperCase() ?? '';

  return (
    <header className={`sticky top-0 z-50 w-full transition-all duration-300 ${
      scrolled ? 'bg-background/90 backdrop-blur-md border-b' : 'bg-transparent'
    }`}>
      <div className="container w-full h-16 mx-auto flex items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary rounded-md">
            <img src="/logo.png" alt="hustlebro.ai logo" className="h-10 w-auto mr-2" />
            <span className="font-bold text-2xl text-black dark:text-white">
              hustlebro.ai
            </span>
          </Link>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full" />
          </Button>
          
          <ThemeToggle />
          
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleSignOut}
            disabled={isLoading}
            aria-label="Sign out"
            className="hidden md:flex"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <LogOut className="h-5 w-5" />
            )}
          </Button>

          <div className="hidden md:flex pl-2">
            <Avatar className="h-10 w-10 border border-border">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </div>

          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[260px]">
              <div className="flex flex-col h-full">
                <div className="flex flex-col gap-4 pt-6">
                  <h3 className="font-semibold text-foreground px-3">Navigation</h3>
                  {navItems.map((item) => (
                    <Link 
                      key={item.name}
                      href={item.href} 
                      className={`px-3 py-2 rounded-md text-sm font-medium
                        ${pathname === item.href 
                          ? 'text-primary bg-primary/10' 
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                        }`}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
                <div className="mt-auto pt-6 flex items-center">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={handleSignOut}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <LogOut className="h-4 w-4 mr-2" />
                    )}
                    Sign Out
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}