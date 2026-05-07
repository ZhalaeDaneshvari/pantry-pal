import { cn } from '../lib/utils';
import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, writeBatch, deleteDoc, arrayUnion, getDocFromServer } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { User as UserIcon, Heart, Ban, ShieldAlert, Plus, X, Loader2, Save, Sparkles, ChevronRight, RefreshCcw, AlertTriangle, Users, UserPlus, Copy, Check, Activity, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { useHousehold } from '../contexts/HouseholdContext';
import { auth } from '../firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface UserProfile {
  height?: number;
  weight?: number;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  dietaryGoal?: 'cut' | 'bulk' | 'maintain';
  healthConditions: string[];
  targetCalories?: number;
  preferences: {
    likes: string[];
    dislikes: string[];
    allergies: string[];
    cuisines: string[];
  };
}

export function Profile({ user }: { user: User }) {
  const { household, createHousehold, joinHousehold, leaveHousehold, loading: householdLoading } = useHousehold();
  const [profile, setProfile] = useState<UserProfile>({
    healthConditions: [],
    preferences: { likes: [], dislikes: [], allergies: [], cuisines: [] }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [newInputs, setNewInputs] = useState({ like: '', dislike: '', allergy: '', cuisine: '', condition: '' });
  const [conditionSuggestions, setConditionSuggestions] = useState<string[]>([]);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [joinId, setJoinId] = useState('');
  const [copied, setCopied] = useState(false);

  const COMMON_CONDITIONS = [
    'PCOS', 'Diabetes Type 1', 'Diabetes Type 2', 'Gluten-free', 'Lactose Intolerant', 
    'Celiac Disease', 'Hypertension', 'IBS', 'Keto', 'Paleo', 'Low Carb', 'High Protein'
  ];

  useEffect(() => {
    if (newInputs.condition.length > 0) {
      const filtered = COMMON_CONDITIONS.filter(c => 
        c.toLowerCase().includes(newInputs.condition.toLowerCase()) && 
        !profile.healthConditions.includes(c)
      );
      setConditionSuggestions(filtered);
    } else {
      setConditionSuggestions([]);
    }
  }, [newInputs.condition, profile.healthConditions]);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    const fetchProfile = async () => {
      const path = `users/${user.uid}`;
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfile({
            height: data.height,
            weight: data.weight,
            age: data.age,
            gender: data.gender,
            activityLevel: data.activityLevel,
            dietaryGoal: data.dietaryGoal,
            healthConditions: data.healthConditions || [],
            targetCalories: data.targetCalories,
            preferences: {
              likes: data.preferences?.likes || [],
              dislikes: data.preferences?.dislikes || [],
              allergies: data.preferences?.allergies || [],
              cuisines: data.preferences?.cuisines || []
            }
          });
        } else {
          // Initialize profile
          const initialProfile = {
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            healthConditions: [],
            preferences: { likes: [], dislikes: [], allergies: [], cuisines: [] }
          };
          await setDoc(docRef, initialProfile);
          setProfile(initialProfile as UserProfile);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user.uid]);

  const calculateCalories = () => {
    if (!profile.height || !profile.weight || !profile.age || !profile.gender) {
      toast.error("Please fill in height, weight, age, and gender first.");
      return;
    }

    // Mifflin-St Jeor Equation
    let bmr = 0;
    if (profile.gender === 'male') {
      bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
    } else {
      bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
    }

    const multipliers: Record<string, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9
    };

    let tdee = bmr * (multipliers[profile.activityLevel || 'moderate']);

    if (profile.dietaryGoal === 'cut') tdee -= 500;
    if (profile.dietaryGoal === 'bulk') tdee += 500;

    setProfile({ ...profile, targetCalories: Math.round(tdee) });
    toast.success(`Target calories calculated: ${Math.round(tdee)} kcal`);
  };

  const handleSave = async () => {
    setSaving(true);
    const path = `users/${user.uid}`;
    try {
      // Clean undefined values before saving to Firestore
      const cleanProfile = JSON.parse(JSON.stringify(profile));
      
      await setDoc(doc(db, 'users', user.uid), cleanProfile, { merge: true });
      toast.success("Profile updated!");
      setShowSetup(false);
    } catch (error) {
      toast.error("Failed to update profile");
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setSaving(false);
    }
  };

  const handleHardReset = async () => {
    setResetting(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Clear fridgeItems
      const fridgeSnap = await getDocs(collection(db, 'users', user.uid, 'fridgeItems'));
      fridgeSnap.forEach(doc => batch.delete(doc.ref));

      // 2. Clear history
      const historySnap = await getDocs(collection(db, 'users', user.uid, 'history'));
      historySnap.forEach(doc => batch.delete(doc.ref));

      // 3. Clear recipes
      const recipesSnap = await getDocs(collection(db, 'users', user.uid, 'recipes'));
      recipesSnap.forEach(doc => batch.delete(doc.ref));

      // 4. Reset profile preferences
      batch.update(doc(db, 'users', user.uid), {
        preferences: { likes: [], dislikes: [], allergies: [], cuisines: [] }
      });

      await batch.commit();
      
      setProfile({ 
        healthConditions: [],
        preferences: { likes: [], dislikes: [], allergies: [], cuisines: [] } 
      });
      setShowResetConfirm(false);
      toast.success("All data has been reset successfully.");
    } catch (error) {
      console.error("Reset error:", error);
      toast.error("Failed to reset data.");
    } finally {
      setResetting(false);
    }
  };

  const addItem = (type: string, value: string) => {
    if (!value) return;
    if (type === 'healthConditions') {
      setProfile({
        ...profile,
        healthConditions: [...(profile.healthConditions || []), value]
      });
      setNewInputs({ ...newInputs, condition: '' });
      setConditionSuggestions([]);
    } else {
      const prefType = type as keyof UserProfile['preferences'];
      setProfile({
        ...profile,
        preferences: {
          ...profile.preferences,
          [prefType]: [...(profile.preferences[prefType] || []), value]
        }
      });
      setNewInputs({ ...newInputs, [prefType === 'likes' ? 'like' : prefType === 'dislikes' ? 'dislike' : prefType === 'allergies' ? 'allergy' : 'cuisine']: '' });
    }
  };

  const removeItem = (type: string, index: number) => {
    if (type === 'healthConditions') {
      const newList = [...(profile.healthConditions || [])];
      newList.splice(index, 1);
      setProfile({
        ...profile,
        healthConditions: newList
      });
    } else {
      const prefType = type as keyof UserProfile['preferences'];
      const newList = [...(profile.preferences[prefType] || [])];
      newList.splice(index, 1);
      setProfile({
        ...profile,
        preferences: {
          ...profile.preferences,
          [prefType]: newList
        }
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Household ID copied!");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 text-sky-200 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-serif font-bold tracking-tight text-[#2D2424]">My Profile</h2>
          <p className="text-[#FF8C42] font-medium italic">Help PantryPal understand your unique health needs and tastes.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-[60px] px-8 bg-[#FF8C42] text-white rounded-3xl font-bold flex items-center justify-center gap-3 hover:bg-[#FF8C42]/90 disabled:opacity-50 transition-all shadow-lg shadow-[#FF8C42]/10"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Update Profile
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Health Metrics */}
        <section className="bg-white p-8 rounded-[40px] border border-[#FFEDE1] shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-[#FF8C42]" />
            <h3 className="text-xl font-serif font-bold text-[#2D2424]">Body Stats</h3>
          </div>
          <p className="text-xs text-[#2D2424]/40 font-medium">Used to calculate your daily energy needs and refine recipe health scores.</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest font-bold text-[#FF8C42] ml-2">Height (cm)</label>
              <input
                type="number"
                value={profile.height || ''}
                onChange={(e) => setProfile({ ...profile, height: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-[#FAF7F2] rounded-xl text-sm border-none focus:ring-2 focus:ring-[#FF8C42]/20 font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest font-bold text-[#FF8C42] ml-2">Weight (kg)</label>
              <input
                type="number"
                value={profile.weight || ''}
                onChange={(e) => setProfile({ ...profile, weight: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-[#FAF7F2] rounded-xl text-sm border-none focus:ring-2 focus:ring-[#FF8C42]/20 font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest font-bold text-[#FF8C42] ml-2">Age</label>
              <input
                type="number"
                value={profile.age || ''}
                onChange={(e) => setProfile({ ...profile, age: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-[#FAF7F2] rounded-xl text-sm border-none focus:ring-2 focus:ring-[#FF8C42]/20 font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest font-bold text-[#FF8C42] ml-2">Gender</label>
              <select
                value={profile.gender || ''}
                onChange={(e) => setProfile({ ...profile, gender: e.target.value as any })}
                className="w-full px-4 py-3 bg-[#FAF7F2] rounded-xl text-sm border-none focus:ring-2 focus:ring-[#FF8C42]/20 font-bold"
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest font-bold text-[#FF8C42] ml-2">Activity Level</label>
            <select
              value={profile.activityLevel || ''}
              onChange={(e) => setProfile({ ...profile, activityLevel: e.target.value as any })}
              className="w-full px-4 py-3 bg-[#FAF7F2] rounded-xl text-sm border-none focus:ring-2 focus:ring-[#FF8C42]/20 font-bold"
            >
              <option value="sedentary">Sedentary (Office job)</option>
              <option value="light">Light (Active sometimes)</option>
              <option value="moderate">Moderate (Workout 3-5 days)</option>
              <option value="active">Active (Workout 6-7 days)</option>
              <option value="very_active">Very Active (Physical Job)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest font-bold text-[#FF8C42] ml-2">Health Goal</label>
            <select
              value={profile.dietaryGoal || ''}
              onChange={(e) => setProfile({ ...profile, dietaryGoal: e.target.value as any })}
              className="w-full px-4 py-3 bg-[#FAF7F2] rounded-xl text-sm border-none focus:ring-2 focus:ring-[#FF8C42]/20 font-bold"
            >
              <option value="maintain">Maintain Current Weight</option>
              <option value="cut">Healthier / Lose Weight</option>
              <option value="bulk">Gain Strength / Bulk</option>
            </select>
          </div>

          <div className="pt-4 flex flex-col gap-4">
            <button
              onClick={calculateCalories}
              className="w-full py-4 bg-[#FFEDE1] text-[#FF8C42] rounded-2xl text-sm font-bold hover:bg-[#FF8C42] hover:text-white transition-all flex items-center justify-center gap-3"
            >
              <Sparkles className="w-4 h-4" />
              Calculate My Needs
            </button>
            
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest font-bold text-[#FF8C42] ml-2">Daily Goal (kcal)</label>
              <input
                type="number"
                value={profile.targetCalories || ''}
                onChange={(e) => setProfile({ ...profile, targetCalories: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-[#2D2424] text-white rounded-2xl text-xl font-bold border-none focus:ring-2 focus:ring-white/20"
              />
            </div>
          </div>
        </section>

        {/* Health Conditions */}
        <section className="bg-white p-8 rounded-[40px] border border-[#FFEDE1] shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-[#FF8C42]" />
            <h3 className="text-xl font-serif font-bold text-[#2D2424]">Wellness Focus</h3>
          </div>
          <p className="text-xs text-[#2D2424]/40 font-medium">Select conditions or diets PantryPal should always keep in mind when suggesting recipes.</p>
          
          <div className="space-y-4">
            <div className="relative">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. PCOS, Diabetes, Keto"
                  value={newInputs.condition}
                  onChange={(e) => setNewInputs({ ...newInputs, condition: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && addItem('healthConditions', newInputs.condition)}
                  className="flex-1 px-4 py-3 bg-[#FAF7F2] rounded-xl text-sm border-none focus:ring-2 focus:ring-[#FF8C42]/20 transition-all font-bold"
                />
                <button
                  onClick={() => addItem('healthConditions', newInputs.condition)}
                  className="p-3 bg-[#FF8C42] text-white rounded-xl hover:bg-[#FF8C42]/90 transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {conditionSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#FFEDE1] rounded-2xl shadow-xl z-20 overflow-hidden">
                  {conditionSuggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => addItem('healthConditions', s)}
                      className="w-full px-4 py-3 text-left text-sm hover:bg-[#FAF7F2] transition-colors border-b border-[#FAF7F2] last:border-none font-bold text-[#2D2424]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <AnimatePresence>
                {profile.healthConditions.map((item: string, idx: number) => (
                  <motion.span
                    key={idx}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="px-4 py-2 bg-[#FFEDE1] text-[#FF8C42] text-xs font-bold rounded-xl flex items-center gap-2 group border border-[#FFEDE1]"
                  >
                    {item}
                    <button
                      onClick={() => removeItem('healthConditions', idx)}
                      className="opacity-40 hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* Likes */}
        <PreferenceSection
          title="Faves"
          icon={Heart}
          color="text-[#FF8C42]"
          items={profile.preferences.likes}
          onAdd={(val) => addItem('likes', val)}
          onRemove={(idx) => removeItem('likes', idx)}
          inputValue={newInputs.like}
          onInputChange={(val) => setNewInputs({ ...newInputs, like: val })}
          placeholder="e.g. Avocado, Salmon"
          description="Ingredients the Chef Bot will try to include more often."
        />

        {/* Dislikes */}
        <PreferenceSection
          title="No Thanks"
          icon={Ban}
          color="text-stone-400"
          items={profile.preferences.dislikes}
          onAdd={(val) => addItem('dislikes', val)}
          onRemove={(idx) => removeItem('dislikes', idx)}
          inputValue={newInputs.dislike}
          onInputChange={(val) => setNewInputs({ ...newInputs, dislike: val })}
          placeholder="e.g. Olives, Cilantro"
          description="Ingredients to avoid in all generated recipes."
        />

        {/* Allergies */}
        <PreferenceSection
          title="Allergies"
          icon={ShieldAlert}
          color="text-rose-400"
          items={profile.preferences.allergies}
          onAdd={(val) => addItem('allergies', val)}
          onRemove={(idx) => removeItem('allergies', idx)}
          inputValue={newInputs.allergy}
          onInputChange={(val) => setNewInputs({ ...newInputs, allergy: val })}
          placeholder="e.g. Peanuts, Shellfish"
          description="Critical safety check! These will NEVER be suggested."
        />

        {/* Preferred Cuisines */}
        <PreferenceSection
          title="Cuisine Styles"
          icon={UserIcon}
          color="text-[#FF8C42]"
          items={profile.preferences.cuisines}
          onAdd={(val) => addItem('cuisines', val)}
          onRemove={(idx) => removeItem('cuisines', idx)}
          inputValue={newInputs.cuisine}
          onInputChange={(val) => setNewInputs({ ...newInputs, cuisine: val })}
          placeholder="e.g. Mexican, Italian"
          description="The flavors you crave most often."
        />
      </div>

      {/* Danger Zone */}
      <section className="mt-20 pt-12 border-t border-[#FFEDE1]">
        <div className="bg-rose-50/30 p-10 rounded-[40px] border border-rose-100 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-xl font-serif font-bold text-rose-950 flex items-center justify-center md:justify-start gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              Fresh Start
            </h3>
            <p className="text-rose-600 font-medium italic text-sm">Wipes your Pantry, History, and Recipes. Cannot be undone.</p>
          </div>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-10 py-4 bg-white text-rose-600 border-2 border-rose-100 rounded-2xl font-bold hover:bg-rose-50 transition-all flex items-center gap-3 shadow-sm"
          >
            <RefreshCcw className="w-4 h-4" />
            Reset All My Data
          </button>
        </div>
      </section>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-[#2D2424]/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white max-w-md w-full rounded-[40px] shadow-2xl p-10 text-center space-y-8"
            >
              <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-[30px] flex items-center justify-center mx-auto shadow-inner">
                <AlertTriangle className="w-10 h-10" />
              </div>
              <div className="space-y-4">
                <h3 className="text-3xl font-serif font-bold text-[#2D2424] leading-tight">Start Fresh?</h3>
                <p className="text-rose-600 text-sm font-medium leading-relaxed italic">
                  This will permanently delete everything the Chef Bot knows about your kitchen and history.
                </p>
              </div>
              <div className="flex flex-col gap-4">
                <button
                  onClick={handleHardReset}
                  disabled={resetting}
                  className="w-full py-5 bg-rose-600 text-white rounded-3xl font-bold hover:bg-rose-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-rose-100"
                >
                  {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                  Yes, Reset Everything
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  disabled={resetting}
                  className="w-full py-5 bg-[#FAF7F2] text-[#2D2424]/40 rounded-3xl font-bold hover:bg-[#FFEDE1] transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PreferenceSection({ title, icon: Icon, color, items, onAdd, onRemove, inputValue, onInputChange, placeholder, description }: any) {
  return (
    <section className="bg-white p-8 rounded-[40px] border border-[#FFEDE1] shadow-sm space-y-6">
      <div className="flex items-center gap-3">
        <Icon className={cn("w-6 h-6", color)} />
        <h3 className="text-xl font-serif font-bold text-[#2D2424]">{title}</h3>
      </div>
      {description && <p className="text-xs text-[#2D2424]/40 font-medium">{description}</p>}

      <div className="flex gap-2">
        <input
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdd(inputValue)}
          className="flex-1 px-5 py-4 bg-[#FAF7F2] rounded-2xl text-sm border-none focus:ring-2 focus:ring-[#FF8C42]/20 transition-all font-bold"
        />
        <button
          onClick={() => onAdd(inputValue)}
          className="p-4 bg-[#FF8C42] text-white rounded-2xl shadow-md"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <AnimatePresence>
          {items.map((item: string, idx: number) => (
            <motion.span
              key={idx}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="px-4 py-2 bg-[#FAF7F2] text-[#FF8C42] text-xs font-bold rounded-xl flex items-center gap-2 group border border-[#FFEDE1]"
            >
              {item}
              <button
                onClick={() => onRemove(idx)}
                className="opacity-40 hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

