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
          if (!data.preferences || (data.preferences.likes.length === 0 && data.preferences.dislikes.length === 0)) {
            setShowSetup(true);
          }
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
          setShowSetup(true);
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
      setShowSetup(true);
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
        <Loader2 className="w-8 h-8 text-stone-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-serif font-light tracking-tight">Your Profile</h2>
          <p className="text-stone-500 font-light italic">Customize your AI chef's knowledge of you</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-[60px] px-8 bg-stone-900 text-stone-50 rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-stone-800 disabled:opacity-50 transition-all shadow-lg shadow-stone-200"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Save Changes
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Health Metrics */}
        <section className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-stone-900" />
            <h3 className="text-xl font-serif font-light text-stone-900">Health Metrics</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400 ml-2">Height (cm)</label>
              <input
                type="number"
                value={profile.height || ''}
                onChange={(e) => setProfile({ ...profile, height: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-stone-50 rounded-xl text-sm border-none focus:ring-2 focus:ring-stone-200"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400 ml-2">Weight (kg)</label>
              <input
                type="number"
                value={profile.weight || ''}
                onChange={(e) => setProfile({ ...profile, weight: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-stone-50 rounded-xl text-sm border-none focus:ring-2 focus:ring-stone-200"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400 ml-2">Age</label>
              <input
                type="number"
                value={profile.age || ''}
                onChange={(e) => setProfile({ ...profile, age: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-stone-50 rounded-xl text-sm border-none focus:ring-2 focus:ring-stone-200"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400 ml-2">Gender</label>
              <select
                value={profile.gender || ''}
                onChange={(e) => setProfile({ ...profile, gender: e.target.value as any })}
                className="w-full px-4 py-3 bg-stone-50 rounded-xl text-sm border-none focus:ring-2 focus:ring-stone-200"
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400 ml-2">Activity Level</label>
            <select
              value={profile.activityLevel || ''}
              onChange={(e) => setProfile({ ...profile, activityLevel: e.target.value as any })}
              className="w-full px-4 py-3 bg-stone-50 rounded-xl text-sm border-none focus:ring-2 focus:ring-stone-200"
            >
              <option value="sedentary">Sedentary (Office job, little exercise)</option>
              <option value="light">Light (Exercise 1-3 days/week)</option>
              <option value="moderate">Moderate (Exercise 3-5 days/week)</option>
              <option value="active">Active (Exercise 6-7 days/week)</option>
              <option value="very_active">Very Active (Physical job + training)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400 ml-2">Dietary Goal</label>
            <select
              value={profile.dietaryGoal || ''}
              onChange={(e) => setProfile({ ...profile, dietaryGoal: e.target.value as any })}
              className="w-full px-4 py-3 bg-stone-50 rounded-xl text-sm border-none focus:ring-2 focus:ring-stone-200"
            >
              <option value="maintain">Maintain Weight</option>
              <option value="cut">Lose Weight (Cut)</option>
              <option value="bulk">Gain Weight (Bulk)</option>
            </select>
          </div>

          <div className="pt-4 flex flex-col gap-4">
            <button
              onClick={calculateCalories}
              className="w-full py-3 bg-stone-100 text-stone-900 rounded-xl text-sm font-medium hover:bg-stone-200 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Calculate Target Calories
            </button>
            
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400 ml-2">Target Calories (kcal)</label>
              <input
                type="number"
                value={profile.targetCalories || ''}
                onChange={(e) => setProfile({ ...profile, targetCalories: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-stone-900 text-stone-50 rounded-xl text-lg font-bold border-none focus:ring-2 focus:ring-stone-700"
              />
            </div>
          </div>
        </section>

        {/* Health Conditions */}
        <section className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-stone-900" />
            <h3 className="text-xl font-serif font-light text-stone-900">Health Conditions</h3>
          </div>
          <p className="text-xs text-stone-400 font-light italic">Select conditions like PCOS or Diabetes to personalize AI meal suggestions.</p>
          
          <div className="space-y-4">
            <div className="relative">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. PCOS, Diabetes, Gluten-free"
                  value={newInputs.condition}
                  onChange={(e) => setNewInputs({ ...newInputs, condition: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && addItem('healthConditions', newInputs.condition)}
                  className="flex-1 px-4 py-3 bg-stone-50 rounded-xl text-sm border-none focus:ring-2 focus:ring-stone-200 transition-all"
                />
                <button
                  onClick={() => addItem('healthConditions', newInputs.condition)}
                  className="p-3 bg-stone-900 text-stone-50 rounded-xl hover:bg-stone-800 transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {conditionSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-stone-100 rounded-2xl shadow-xl z-10 overflow-hidden">
                  {conditionSuggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => addItem('healthConditions', s)}
                      className="w-full px-4 py-3 text-left text-sm hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-none"
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
                    className="px-3 py-1.5 bg-stone-50 text-stone-600 text-xs font-medium rounded-lg flex items-center gap-2 group"
                  >
                    {item}
                    <button
                      onClick={() => removeItem('healthConditions', idx)}
                      className="text-stone-300 hover:text-red-500 transition-colors"
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
          title="Likes"
          icon={Heart}
          color="text-red-400"
          items={profile.preferences.likes}
          onAdd={(val) => addItem('likes', val)}
          onRemove={(idx) => removeItem('likes', idx)}
          inputValue={newInputs.like}
          onInputChange={(val) => setNewInputs({ ...newInputs, like: val })}
          placeholder="e.g. Spicy food, Salmon"
        />

        {/* Dislikes */}
        <PreferenceSection
          title="Dislikes"
          icon={Ban}
          color="text-stone-400"
          items={profile.preferences.dislikes}
          onAdd={(val) => addItem('dislikes', val)}
          onRemove={(idx) => removeItem('dislikes', idx)}
          inputValue={newInputs.dislike}
          onInputChange={(val) => setNewInputs({ ...newInputs, dislike: val })}
          placeholder="e.g. Cilantro, Olives"
        />

        {/* Allergies */}
        <PreferenceSection
          title="Allergies"
          icon={ShieldAlert}
          color="text-amber-400"
          items={profile.preferences.allergies}
          onAdd={(val) => addItem('allergies', val)}
          onRemove={(idx) => removeItem('allergies', idx)}
          inputValue={newInputs.allergy}
          onInputChange={(val) => setNewInputs({ ...newInputs, allergy: val })}
          placeholder="e.g. Peanuts, Shellfish"
        />

        {/* Preferred Cuisines */}
        <PreferenceSection
          title="Preferred Cuisines"
          icon={UserIcon}
          color="text-blue-400"
          items={profile.preferences.cuisines}
          onAdd={(val) => addItem('cuisines', val)}
          onRemove={(idx) => removeItem('cuisines', idx)}
          inputValue={newInputs.cuisine}
          onInputChange={(val) => setNewInputs({ ...newInputs, cuisine: val })}
          placeholder="e.g. Italian, Japanese"
        />
      </div>

      {/* Household Section */}
      <section className="bg-white p-10 rounded-[40px] border border-stone-100 shadow-sm space-y-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-stone-50 text-stone-900 rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-serif font-light">Family Syncing</h3>
            <p className="text-sm text-stone-400">Share your fridge with your household</p>
          </div>
        </div>

        {householdLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-stone-200" />
          </div>
        ) : household ? (
          <div className="space-y-6">
            <div className="p-6 bg-stone-50 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Active Household</span>
                <span className="px-3 py-1 bg-green-100 text-green-600 text-[10px] font-bold uppercase rounded-full tracking-widest">Connected</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-serif font-light">{household.name}</p>
                <div className="flex items-center gap-2">
                  <code className="px-3 py-1 bg-white border border-stone-200 rounded-lg text-xs font-mono text-stone-600">{household.id}</code>
                  <button 
                    onClick={() => copyToClipboard(household.id)}
                    className="p-2 hover:bg-stone-200 rounded-lg transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-stone-400" />}
                  </button>
                </div>
              </div>
              <div className="flex -space-x-2">
                {household.members.map((m, i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-stone-200 border-2 border-stone-50 flex items-center justify-center text-[10px] font-bold text-stone-500">
                    {m.substring(0, 2).toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={leaveHousehold}
              className="w-full py-4 text-stone-500 font-medium hover:text-red-500 transition-colors"
            >
              Leave Household
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <p className="text-sm font-medium text-stone-900">Create New</p>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Household Name"
                  value={newHouseholdName}
                  onChange={(e) => setNewHouseholdName(e.target.value)}
                  className="w-full px-5 py-3 bg-stone-50 rounded-2xl text-sm focus:ring-2 focus:ring-stone-900 transition-all border-none"
                />
                <button
                  onClick={() => createHousehold(newHouseholdName)}
                  disabled={!newHouseholdName}
                  className="w-full py-3 bg-stone-900 text-stone-50 rounded-2xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-stone-800 disabled:opacity-50 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Create
                </button>
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-sm font-medium text-stone-900">Join Existing</p>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Household ID"
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  className="w-full px-5 py-3 bg-stone-50 rounded-2xl text-sm focus:ring-2 focus:ring-stone-900 transition-all border-none"
                />
                <button
                  onClick={() => joinHousehold(joinId)}
                  disabled={!joinId}
                  className="w-full py-3 bg-stone-100 text-stone-600 rounded-2xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-stone-200 disabled:opacity-50 transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  Join
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Danger Zone */}
      <section className="mt-20 pt-12 border-t border-stone-100">
        <div className="bg-red-50/50 p-8 rounded-[40px] border border-red-100 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-xl font-serif font-light text-red-900 flex items-center justify-center md:justify-start gap-2">
              <AlertTriangle className="w-5 h-5" />
              Danger Zone
            </h3>
            <p className="text-red-600/60 text-sm font-light italic">Resetting will permanently delete your fridge items, history, and recipes.</p>
          </div>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-8 py-4 bg-red-600 text-white rounded-2xl font-medium hover:bg-red-700 transition-all flex items-center gap-2 shadow-lg shadow-red-100"
          >
            <RefreshCcw className="w-4 h-4" />
            Hard Reset All Data
          </button>
        </div>
      </section>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-stone-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white max-w-md w-full rounded-[40px] shadow-2xl p-10 text-center space-y-8"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-serif font-light text-stone-900">Are you absolutely sure?</h3>
                <p className="text-stone-500 text-sm font-light leading-relaxed">
                  This action cannot be undone. This will permanently delete your entire fridge inventory, purchase history, saved recipes, and profile preferences.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleHardReset}
                  disabled={resetting}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-medium hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                >
                  {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                  Yes, Reset Everything
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  disabled={resetting}
                  className="w-full py-4 bg-stone-100 text-stone-600 rounded-2xl font-medium hover:bg-stone-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* First-time Setup Modal */}
      <AnimatePresence>
        {showSetup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-stone-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white max-w-2xl w-full rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-10 space-y-8">
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-stone-900 text-stone-50 rounded-2xl flex items-center justify-center mb-4">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-3xl font-serif font-light text-stone-900">Welcome to ChefFridge AI</h3>
                  <p className="text-stone-500 font-light italic">Let's personalize your experience. What are your food preferences?</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-xs uppercase tracking-widest font-bold text-stone-400">Allergies</h4>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. Peanuts"
                        value={newInputs.allergy}
                        onChange={(e) => setNewInputs({ ...newInputs, allergy: e.target.value })}
                        className="flex-1 px-4 py-3 bg-stone-50 rounded-xl text-sm border-none focus:ring-2 focus:ring-stone-200"
                      />
                      <button onClick={() => addItem('allergies', newInputs.allergy)} className="p-3 bg-stone-900 text-stone-50 rounded-xl"><Plus className="w-4 h-4" /></button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {profile.preferences.allergies.map((a, i) => <span key={i} className="px-2 py-1 bg-stone-50 text-[10px] rounded-lg">{a}</span>)}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs uppercase tracking-widest font-bold text-stone-400">Preferred Cuisines</h4>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. Italian"
                        value={newInputs.cuisine}
                        onChange={(e) => setNewInputs({ ...newInputs, cuisine: e.target.value })}
                        className="flex-1 px-4 py-3 bg-stone-50 rounded-xl text-sm border-none focus:ring-2 focus:ring-stone-200"
                      />
                      <button onClick={() => addItem('cuisines', newInputs.cuisine)} className="p-3 bg-stone-900 text-stone-50 rounded-xl"><Plus className="w-4 h-4" /></button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {profile.preferences.cuisines.map((c, i) => <span key={i} className="px-2 py-1 bg-stone-50 text-[10px] rounded-lg">{c}</span>)}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSave}
                  className="w-full py-5 bg-stone-900 text-stone-50 rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-stone-800 transition-all shadow-xl shadow-stone-200"
                >
                  Start Cooking
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PreferenceSection({ title, icon: Icon, color, items, onAdd, onRemove, inputValue, onInputChange, placeholder }: any) {
  return (
    <section className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm space-y-6">
      <div className="flex items-center gap-3">
        <Icon className={cn("w-6 h-6", color)} />
        <h3 className="text-xl font-serif font-light text-stone-900">{title}</h3>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdd(inputValue)}
          className="flex-1 px-4 py-3 bg-stone-50 rounded-xl text-sm border-none focus:ring-2 focus:ring-stone-200 transition-all"
        />
        <button
          onClick={() => onAdd(inputValue)}
          className="p-3 bg-stone-900 text-stone-50 rounded-xl hover:bg-stone-800 transition-all"
        >
          <Plus className="w-4 h-4" />
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
              className="px-3 py-1.5 bg-stone-50 text-stone-600 text-xs font-medium rounded-lg flex items-center gap-2 group"
            >
              {item}
              <button
                onClick={() => onRemove(idx)}
                className="text-stone-300 hover:text-red-500 transition-colors"
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

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
