import { cn } from '../lib/utils';
import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User } from 'firebase/auth';
import { logout } from '../firebase';
import { ChefHat, User as UserIcon, LogOut, History, Calendar as CalendarIcon, ShoppingCart, Bot, Box, Refrigerator } from 'lucide-react';
import { motion } from 'motion/react';

export function Layout({ children, user }: { children: ReactNode; user: User }) {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Refrigerator, label: 'Pantry' },
    { path: '/grocery', icon: ShoppingCart, label: 'Grocery' },
    { path: '/recipes', icon: ChefHat, label: 'Pantry Chef' },
    { path: '/calendar', icon: CalendarIcon, label: 'Planner' },
    { path: '/profile', icon: UserIcon, label: 'My Profile' },
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#FAF7F2] text-[#2D2424] font-sans overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 border-r border-[#FFEDE1] flex-col p-8 bg-white shrink-0">
        <div className="flex items-center gap-3 mb-12">
          <div className="p-3 bg-[#FF8C42] rounded-2xl shadow-lg shadow-[#FF8C42]/20 relative">
            <Bot className="w-8 h-8 text-white" />
            <ChefHat className="w-6 h-6 text-white absolute -top-4 left-1/2 -translate-x-1/2 rotate-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)] stroke-[#FF8C42] stroke-[1.5px] fill-white" />
          </div>
          <h1 className="text-2xl font-serif font-bold tracking-tight text-[#2D2424]">PantryPal</h1>
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-4 px-6 py-4 rounded-[24px] transition-all duration-300",
                  isActive 
                    ? "bg-[#FF8C42] text-white shadow-xl shadow-[#FF8C42]/20 scale-[1.02]" 
                    : "text-[#2D2424]/40 hover:bg-[#FAF7F2] hover:text-[#FF8C42]"
                )}
              >
                <item.icon className={cn("w-6 h-6")} />
                <span className="font-bold text-sm tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-8 border-t border-[#FFEDE1]">
          <div className="flex items-center gap-4 px-4 py-4 mb-6 bg-[#FAF7F2] rounded-3xl">
            <img 
              src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
              className="w-10 h-10 rounded-2xl border-2 border-white shadow-sm"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate text-[#2D2424]">{user.displayName}</p>
              <p className="text-[10px] text-[#FF8C42] font-bold uppercase tracking-wider truncate">Master Chef</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-4 px-6 py-4 text-[#2D2424]/40 hover:text-rose-600 hover:bg-rose-50 rounded-[24px] transition-all font-bold text-sm"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="md:hidden flex items-center justify-between p-6 bg-white border-b border-[#FFEDE1] shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#FF8C42] rounded-xl relative">
            <Bot className="w-5 h-5 text-white" />
            <ChefHat className="w-4 h-4 text-white absolute -top-2 left-1/2 -translate-x-1/2 stroke-[#FF8C42] stroke-[1.5px] fill-white drop-shadow-md" />
          </div>
          <h1 className="text-xl font-serif font-bold tracking-tight text-[#2D2424]">PantryPal</h1>
        </div>
        <img 
          src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
          className="w-10 h-10 rounded-2xl border-2 border-[#FFEDE1]"
          referrerPolicy="no-referrer"
        />
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative pb-28 md:pb-0 font-medium">
        <div className="max-w-6xl mx-auto p-8 md:p-20">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-6 left-6 right-6 bg-white shadow-2xl rounded-[32px] border border-[#FFEDE1] flex items-center justify-around p-3 z-50">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300",
                isActive ? "text-[#FF8C42] bg-[#FFEDE1]" : "text-[#2D2424]/40"
              )}
            >
              <item.icon className={cn("w-5 h-5")} />
              <span className="text-[8px] font-bold uppercase tracking-widest">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
