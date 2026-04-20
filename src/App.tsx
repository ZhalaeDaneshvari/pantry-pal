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
import { ChefHat, Refrigerator, User as UserIcon, LogOut, LogIn, History, Calendar as CalendarIcon, ShoppingCart, Mail, AlertTriangle } from 'lucide-react';
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
      <div className="h-screen w-screen flex items-center justify-center bg-stone-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <ChefHat className="w-12 h-12 text-stone-400" />
        </motion.div>
      </div>
    );
  }

  return (
    <Router>
      <Toaster position="top-center" richColors />
      <HouseholdProvider user={user}>
        <AnimatePresence mode="wait">
          {!user ? (
            <motion.div
              key="login"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-screen w-screen flex flex-col items-center justify-center bg-stone-50 p-6 overflow-y-auto"
            >
              <div className="max-w-md w-full text-center space-y-8 py-12">
                <div className="space-y-2">
                  <ChefHat className="w-16 h-16 mx-auto text-stone-800" />
                  <h1 className="text-4xl font-serif font-light tracking-tight text-stone-900">ChefFridge AI</h1>
                  <p className="text-stone-500 font-light italic">Your personal AI chef & fridge companion</p>
                </div>

                {!showEmailLogin ? (
                  <div className="space-y-3">
                    <button
                      onClick={loginWithGoogle}
                      className="w-full py-4 px-6 bg-white border border-stone-200 text-stone-900 rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-stone-50 transition-all shadow-sm"
                    >
                      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                      Continue with Google
                    </button>
                    <button
                      onClick={() => setShowEmailLogin(true)}
                      className="w-full py-4 px-6 bg-stone-100 text-stone-600 rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-stone-200 transition-all"
                    >
                      <Mail className="w-5 h-5" />
                      Use Email Address
                    </button>

                    <div className="pt-6 border-t border-stone-100">
                      <button
                        onClick={() => {
                          toast.info("Setup Required", {
                            description: "Please enable Email login in your Firebase Console (Project: gen-lang-client-0452440829).",
                            duration: 10000,
                            action: {
                              label: "Open Console",
                              onClick: () => window.open("https://console.firebase.google.com/project/gen-lang-client-0452440829/authentication/providers", "_blank")
                            }
                          });
                        }}
                        className="text-stone-400 text-sm font-light hover:text-stone-600 transition-colors flex items-center justify-center gap-2 mx-auto"
                      >
                        <AlertTriangle className="w-4 h-4" />
                        Trouble logging in?
                      </button>
                    </div>
                  </div>
                ) : (
                  <motion.form 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onSubmit={handleEmailAuth} 
                    className="space-y-4 bg-white p-8 rounded-[32px] border border-stone-100 shadow-xl"
                  >
                    <h2 className="text-xl font-serif font-light">{isSignUp ? 'Create Profile' : 'Sign In'}</h2>
                    <input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-stone-50 rounded-xl text-sm border-none focus:ring-2 focus:ring-stone-200"
                      required
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-stone-50 rounded-xl text-sm border-none focus:ring-2 focus:ring-stone-200"
                      required
                    />
                    <button
                      type="submit"
                      className="w-full py-4 bg-stone-900 text-stone-50 rounded-2xl font-medium hover:bg-stone-800 transition-all"
                    >
                      {isSignUp ? 'Create Profile' : 'Sign In'}
                    </button>
                    <div className="flex flex-col gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
                      >
                        {isSignUp ? 'Already have a profile? Sign In' : "Don't have a profile? Create one"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEmailLogin(false)}
                        className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
                      >
                        Back to other options
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
    </Router>
  );
}
