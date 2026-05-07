import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, loginWithGoogle, logout } from './firebase';
import { Toaster, toast } from 'sonner';
import { Fridge } from './components/Fridge';
import { Recipes } from './components/Recipes';
import { Profile } from './components/Profile';
import { HistoryLog } from './components/HistoryLog';
import { CalendarView } from './components/CalendarView';
import { GroceryList } from './components/GroceryList';
import { Layout } from './components/Layout';
import { motion, AnimatePresence } from 'motion/react';
import { HouseholdProvider } from './contexts/HouseholdContext';
import { RecipeProvider } from './contexts/RecipeContext';
import { ChefHat, Refrigerator, User as UserIcon, LogOut, LogIn, History, Calendar as CalendarIcon, ShoppingCart, Mail, AlertTriangle, Bot } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success("Account created!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success("Welcome back!");
      }
    } catch (error: any) {
      if (error.code === 'auth/operation-not-allowed') {
        toast.error("Email/Password login is not enabled in your Firebase Console.", {
          description: "Please go to Authentication > Sign-in method and enable it.",
          duration: 6000
        });
      } else {
        toast.error(error.message);
      }
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#FAF7F2]">
        <div className="relative">
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            className="p-8 bg-white rounded-[40px] shadow-xl relative"
          >
            <Bot className="w-16 h-16 text-[#FF8C42]" />
            <motion.div 
              animate={{ 
                rotate: [10, 15, 10],
                y: [0, -2, 0]
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-5 left-1/2 -translate-x-1/2"
            >
              <ChefHat className="w-12 h-12 text-white stroke-[#FF8C42] stroke-2 drop-shadow-md fill-white" />
            </motion.div>
          </motion.div>
        </div>
        <p className="mt-12 font-serif text-xl font-bold text-[#2D2424]">PantryPal is waking up...</p>
      </div>
    );
  }

  return (
    <Router>
      <Toaster position="top-center" richColors />
      <RecipeProvider>
        <HouseholdProvider user={user}>
        <AnimatePresence mode="wait">
          {!user ? (
            <motion.div
              key="login"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-screen w-screen flex flex-col items-center justify-center bg-[#FAF7F2] p-6 overflow-y-auto"
            >
              <div className="max-w-md w-full text-center space-y-8 py-12">
                <div className="space-y-6">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-24 h-24 bg-[#FF8C42] rounded-[32px] flex items-center justify-center mx-auto shadow-2xl shadow-[#FF8C42]/20 relative"
                  >
                    <Bot className="w-12 h-12 text-white" />
                    <ChefHat className="w-10 h-10 text-white stroke-[#FF8C42] stroke-2 absolute -top-6 left-1/2 -translate-x-1/2 rotate-0 drop-shadow-lg fill-white" />
                  </motion.div>
                  <div className="space-y-2">
                    <h1 className="text-5xl font-serif font-bold tracking-tight text-[#2D2424]">PantryPal</h1>
                    <p className="text-[#FF8C42] font-medium italic">Your cute robot kitchen sidekick!</p>
                  </div>
                </div>

                {!showEmailLogin ? (
                  <div className="bg-white p-10 rounded-[48px] shadow-xl border border-[#FFEDE1] space-y-8">
                    <div className="space-y-4">
                      <button
                        onClick={loginWithGoogle}
                        className="w-full py-5 px-6 bg-white border-2 border-[#FFEDE1] text-[#2D2424] rounded-3xl font-bold flex items-center justify-center gap-4 hover:bg-[#FAF7F2] transition-all shadow-sm"
                      >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
                        Continue with Google
                      </button>
                      <button
                        onClick={() => setShowEmailLogin(true)}
                        className="w-full py-5 px-6 bg-[#FFEDE1] text-[#FF8C42] rounded-3xl font-bold flex items-center justify-center gap-4 hover:bg-[#FF8C42] hover:text-white transition-all group"
                      >
                        <Mail className="w-6 h-6" />
                        Use Email Address
                      </button>

                      <div className="pt-8 border-t border-sky-50">
                        <button
                          onClick={() => {
                            toast.info("Need Help?", {
                              description: "Sign in with Google for the fastest setup!",
                              duration: 5000
                            });
                          }}
                          className="text-sky-200 text-xs font-bold hover:text-sky-400 transition-colors flex items-center justify-center gap-2 mx-auto uppercase tracking-widest"
                        >
                          <AlertTriangle className="w-4 h-4" />
                          Trouble logging in?
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <motion.form 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onSubmit={handleEmailAuth} 
                    className="space-y-6 bg-white p-10 rounded-[48px] border border-sky-50 shadow-xl"
                  >
                    <h2 className="text-2xl font-serif font-bold text-sky-900 text-center">{isSignUp ? 'New Member! ✨' : 'Welcome Back! 👋'}</h2>
                      <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-6 py-4 bg-sky-50 rounded-2xl border-none focus:ring-2 focus:ring-sky-200 transition-all font-medium"
                        required
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-6 py-4 bg-sky-50 rounded-2xl border-none focus:ring-2 focus:ring-sky-200 transition-all font-medium"
                        required
                      />
                    <button
                      type="submit"
                      className="w-full py-4 bg-sky-500 text-white rounded-2xl font-bold hover:bg-sky-600 transition-all shadow-lg"
                    >
                      {isSignUp ? 'Start My Fridge' : 'Sign In'}
                    </button>
                    <div className="flex flex-col gap-4 pt-4">
                      <button
                        type="button"
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-sky-400 text-sm font-bold hover:text-sky-500 text-center"
                      >
                        {isSignUp ? 'Already have an account? Sign in' : 'New here? Create account'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEmailLogin(false)}
                        className="text-sky-300 text-xs font-bold uppercase tracking-widest text-center"
                      >
                        Go Back
                      </button>
                    </div>
                  </motion.form>
                )}
              </div>
            </motion.div>
          ) : (
            <Layout user={user}>
              <Routes>
                <Route path="/" element={<Fridge user={user} />} />
                <Route path="/grocery" element={<GroceryList user={user} />} />
                <Route path="/recipes" element={<Recipes user={user} />} />
                <Route path="/history" element={<HistoryLog user={user} />} />
                <Route path="/calendar" element={<CalendarView user={user} />} />
                <Route path="/profile" element={<Profile user={user} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          )}
        </AnimatePresence>
      </HouseholdProvider>
      </RecipeProvider>
    </Router>
  );
}
