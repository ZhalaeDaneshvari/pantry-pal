import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User } from 'firebase/auth';
import { logout } from '../firebase';
import { ChefHat, Refrigerator, User as UserIcon, LogOut, History, Calendar as CalendarIcon, ShoppingCart } from 'lucide-react';
import { motion } from 'motion/react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

export function Layout({ children, user }: { children: ReactNode; user: User }) {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Refrigerator, label: 'Fridge' },
    { path: '/grocery', icon: ShoppingCart, label: 'Grocery' },
    { path: '/recipes', icon: ChefHat, label: 'Recipes' },
    { path: '/calendar', icon: CalendarIcon, label: 'Calendar' },
    { path: '/profile', icon: UserIcon, label: 'Profile' },
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-stone-50 text-stone-900 font-sans overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-stone-200 flex-col p-6 bg-white shrink-0">
        <div className="flex items-center gap-3 mb-12">
          <ChefHat className="w-8 h-8 text-stone-800" />
          <h1 className="text-xl font-serif font-light tracking-tight">ChefFridge</h1>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200",
                  isActive 
                    ? "bg-stone-900 text-stone-50 shadow-lg shadow-stone-200" 
                    : "text-stone-500 hover:bg-stone-50 hover:text-stone-900"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 border-t border-stone-100">
          <div className="flex items-center gap-3 px-4 py-3 mb-4">
            <img 
              src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
              className="w-8 h-8 rounded-full"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.displayName}</p>
              <p className="text-xs text-stone-400 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 text-stone-500 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="md:hidden flex items-center justify-between p-4 bg-white border-b border-stone-100 shrink-0">
        <div className="flex items-center gap-2">
          <ChefHat className="w-6 h-6 text-stone-800" />
          <h1 className="text-lg font-serif font-light tracking-tight">ChefFridge</h1>
        </div>
        <img 
          src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
          className="w-8 h-8 rounded-full"
          referrerPolicy="no-referrer"
        />
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative pb-24 md:pb-0">
        <div className="max-w-5xl mx-auto p-6 md:p-12">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-stone-100 flex items-center justify-around p-4 pb-8 z-50">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 transition-all duration-200",
                isActive ? "text-stone-900" : "text-stone-400"
              )}
            >
              <item.icon className={cn("w-6 h-6", isActive && "scale-110")} />
              <span className="text-[10px] font-medium uppercase tracking-widest">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
