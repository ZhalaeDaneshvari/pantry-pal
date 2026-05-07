import { cn } from '../lib/utils';
import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, serverTimestamp, updateDoc, where, getDocs, limit, Timestamp, getDocFromServer, getDoc, setDoc } from 'firebase/firestore';
import { getNutritionInfo, getQuantitySuggestions, NutritionInfo } from '../services/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Loader2, Refrigerator, Info, Calendar, Flame, Beef, Wheat, Droplets, Sparkles, AlertCircle, X, AlertTriangle, CheckCircle2, Circle, ChevronRight, Bot, Box, Salad, Utensils, ChefHat } from 'lucide-react';
import { toast } from 'sonner';
import { useHousehold } from '../contexts/HouseholdContext';
import { format, addDays, isBefore, isAfter } from 'date-fns';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FridgeItem {
  id: string;
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  addedAt: any;
  removedAt?: any;
  expiryDate?: string;
  barcode?: string;
}

const getFoodIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('apple')) return '🍎';
  if (n.includes('banana')) return '🍌';
  if (n.includes('tomato')) return '🍅';
  if (n.includes('chicken') || n.includes('poultry')) return '🍗';
  if (n.includes('beef') || n.includes('steak') || n.includes('meat')) return '🥩';
  if (n.includes('egg')) return '🥚';
  if (n.includes('milk') || n.includes('dairy')) return '🥛';
  if (n.includes('cheese')) return '🧀';
  if (n.includes('bread') || n.includes('toast')) return '🍞';
  if (n.includes('fish') || n.includes('salmon')) return '🐟';
  if (n.includes('shrimp')) return '🍤';
  if (n.includes('broccoli') || n.includes('veg')) return '🥦';
  if (n.includes('carrot')) return '🥕';
  if (n.includes('potato')) return '🥔';
  if (n.includes('rice') || n.includes('grain')) return '🍚';
  if (n.includes('pasta') || n.includes('noodle')) return '🍝';
  if (n.includes('avocado')) return '🥑';
  if (n.includes('berry') || n.includes('strawberry') || n.includes('blueber')) return '🍓';
  if (n.includes('lemon') || n.includes('lime')) return '🍋';
  if (n.includes('onion') || n.includes('garlic')) return '🧅';
  if (n.includes('nut') || n.includes('almond') || n.includes('walnut')) return '🥜';
  if (n.includes('honey') || n.includes('sweet')) return '🍯';
  if (n.includes('oil') || n.includes('butter')) return '🧈';
  return '🤖';
};

export function Fridge({ user }: { user: User }) {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const [items, setItems] = useState<FridgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', quantity: '', expiryDate: '' });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [qtySuggestions, setQtySuggestions] = useState<string[]>([]);
  const [loadingQty, setLoadingQty] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [newPrefs, setNewPrefs] = useState({ allergy: '', cuisine: '', allergies: [] as string[], cuisines: [] as string[] });
  const [savingSetup, setSavingSetup] = useState(false);
  const [isQtyFocused, setIsQtyFocused] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const basePath = household ? `households/${household.id}` : `users/${user.uid}`;
  const nameInputRef = useRef<HTMLInputElement>(null);

  const commonIngredients = [
    'Apple', 'Avocado', 'Asparagus', 'Almonds',
    'Banana', 'Blueberries', 'Broccoli', 'Bacon', 'Butter', 'Bread', 'Bell Pepper',
    'Chicken Breast', 'Chicken Thighs', 'Cheddar Cheese', 'Carrots', 'Cucumber', 'Celery', 'Cottage Cheese', 'Corn',
    'Eggs', 'Egg Whites', 'English Muffin', 'Eggplant',
    'Feta Cheese', 'Fish', 'Flour',
    'Greek Yogurt', 'Green Beans', 'Green Peas', 'Grapes', 'Ground Beef', 'Ground Turkey', 'Garlic',
    'Ham', 'Honey', 'Hummus',
    'Iceberg Lettuce',
    'Jam', 'Juice',
    'Kale', 'Ketchup',
    'Lemon', 'Lime', 'Lamb',
    'Milk', 'Mozzarella', 'Mushrooms', 'Maple Syrup', 'Mayonnaise', 'Mustard',
    'Onion', 'Olive Oil', 'Oatmeal', 'Orange Juice', 'Oranges',
    'Potatoes', 'Pasta', 'Peanut Butter', 'Parmesan', 'Pork', 'Peas',
    'Quinoa',
    'Rice', 'Red Onion', 'Raspberries', 'Romaine Lettuce', 'Radish',
    'Spinach', 'Strawberries', 'Salmon', 'Steak', 'Shrimp', 'Soy Sauce',
    'Tomatoes', 'Tuna', 'Tofu', 'Tortillas', 'Turkey',
    'Vinegar',
    'Walnuts', 'Watermelon',
    'Yogurt',
    'Zucchini'
  ];

  useEffect(() => {
    if (newItem.name.length > 1) {
      const filtered = commonIngredients.filter(ing => 
        ing.toLowerCase().startsWith(newItem.name.toLowerCase())
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [newItem.name]);

  const fetchQtySuggestions = async (name: string) => {
    setLoadingQty(true);
    try {
      const q = query(
        collection(db, basePath, 'history'),
        where('name', '==', name),
        limit(5)
      );
      const snap = await getDocs(q);
      const history = snap.docs.map(d => d.data().quantity);
      
      const suggestions = await getQuantitySuggestions(name, history);
      setQtySuggestions(suggestions);
    } catch (error) {
      console.error("Error fetching qty suggestions:", error);
    } finally {
      setLoadingQty(false);
    }
  };

  useEffect(() => {
    const checkSetup = async () => {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (!data.hasCompletedSetup) {
          setShowSetup(true);
        }
      } else {
        setShowSetup(true);
      }
    };
    checkSetup();

    const q = query(
      collection(db, basePath, 'fridgeItems'),
      where('removedAt', '==', null),
      orderBy('addedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FridgeItem[];
      setItems(itemsData);
      setLoading(false);
    });

    return unsubscribe;
  }, [basePath, user.uid]);

  const handleAddItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newItem.name) return;

    setAdding(true);
    try {
      const quantity = newItem.quantity || 'As needed';
      const nutrition = await getNutritionInfo(newItem.name, quantity);
      const itemData = {
        name: newItem.name,
        quantity,
        expiryDate: newItem.expiryDate,
        ...nutrition,
        addedAt: serverTimestamp(),
        removedAt: null
      };
      
      await addDoc(collection(db, basePath, 'fridgeItems'), itemData);
      await addDoc(collection(db, basePath, 'history'), itemData);

      setNewItem({ name: '', quantity: '', expiryDate: '' });
      setSuggestions([]);
      setQtySuggestions([]);
      setIsNameFocused(false);
      setIsQtyFocused(false);
      toast.success(`${newItem.name} added to your pantry!`, {
        icon: <Box className="w-4 h-4 text-[#FF8C42]" />
      });
    } catch (error) {
      console.error("Error adding item:", error);
      toast.error("Failed to add item. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await updateDoc(doc(db, basePath, 'fridgeItems', id), {
        removedAt: serverTimestamp()
      });
      toast.success("Item removed from pantry");
    } catch (error) {
      toast.error("Failed to remove item");
    }
  };

  const handleGenerateConfirm = (useAll: boolean) => {
    const ingredients = useAll 
      ? items.map(item => item.name)
      : items.filter(item => selectedIds.has(item.id)).map(item => item.name);
    
    setShowGenerateModal(false);
    navigate('/recipes', { state: { ingredients } });
  };

  const handleGenerateClick = () => {
    if (items.length === 0) {
      toast.error("Your pantry is empty! Add more items first.");
      return;
    }
    setShowGenerateModal(true);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaveSetup = async () => {
    setSavingSetup(true);
    try {
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, {
        preferences: {
          allergies: newPrefs.allergies,
          cuisines: newPrefs.cuisines,
          likes: [],
          dislikes: []
        },
        hasCompletedSetup: true
      }, { merge: true });
      setShowSetup(false);
      toast.success("Welcome aboard, Master Chef!");
    } catch (error) {
      toast.error("Failed to save setup");
    } finally {
      setSavingSetup(false);
    }
  };

  const addSetupItem = (type: 'allergies' | 'cuisines') => {
    const val = type === 'allergies' ? newPrefs.allergy : newPrefs.cuisine;
    if (!val) return;
    setNewPrefs({
      ...newPrefs,
      [type]: [...newPrefs[type], val],
      [type === 'allergies' ? 'allergy' : 'cuisine']: ''
    });
  };

  const removeSetupItem = (type: 'allergies' | 'cuisines', idx: number) => {
    const list = [...newPrefs[type]];
    list.splice(idx, 1);
    setNewPrefs({ ...newPrefs, [type]: list });
  };

  return (
    <div className="space-y-12">
      {/* Welcome Setup Modal */}
      <AnimatePresence>
        {showSetup && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-[#2D2424]/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white max-w-2xl w-full rounded-[50px] shadow-2xl overflow-hidden border border-[#FFEDE1]"
            >
              <div className="p-12 space-y-10">
                <div className="space-y-4 text-center">
                  <div className="w-24 h-24 bg-[#FF8C42] rounded-[35px] flex items-center justify-center mb-8 mx-auto shadow-xl shadow-[#FF8C42]/20 border-4 border-white relative">
                    <Bot className="w-12 h-12 text-white" />
                    <ChefHat className="w-10 h-10 text-white stroke-[#FF8C42] stroke-2 absolute -top-6 left-1/2 -translate-x-1/2 rotate-0 drop-shadow-lg fill-white" />
                  </div>
                  <h3 className="text-4xl font-serif font-bold text-[#2D2424] leading-tight">Welcome to PantryPal!</h3>
                  <p className="text-[#FF8C42] text-lg font-medium italic">I'm your Robot Chef. Let's customize your kitchen!</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-[10px] uppercase tracking-widest font-black text-[#FF8C42] flex items-center gap-2">
                       <AlertTriangle className="w-3 h-3" /> Allergies
                    </h4>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. Peanuts"
                        value={newPrefs.allergy}
                        onChange={(e) => setNewPrefs({ ...newPrefs, allergy: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && addSetupItem('allergies')}
                        className="flex-1 px-5 py-4 bg-[#FAF7F2] rounded-2xl text-sm border-none focus:ring-2 focus:ring-[#FF8C42]/20 font-bold"
                      />
                      <button onClick={() => addSetupItem('allergies')} className="p-4 bg-[#FF8C42] text-white rounded-2xl shadow-md"><Plus className="w-5 h-5" /></button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {newPrefs.allergies.map((a, i) => (
                        <span key={i} className="px-4 py-2 bg-[#FAF7F2] text-[10px] font-bold text-[#FF8C42] rounded-xl border border-[#FFEDE1] flex items-center gap-2">
                          {a}
                          <button onClick={() => removeSetupItem('allergies', i)}><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] uppercase tracking-widest font-black text-[#FF8C42] flex items-center gap-2">
                      <Utensils className="w-3 h-3" /> Cuisines
                    </h4>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. French"
                        value={newPrefs.cuisine}
                        onChange={(e) => setNewPrefs({ ...newPrefs, cuisine: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && addSetupItem('cuisines')}
                        className="flex-1 px-5 py-4 bg-[#FAF7F2] rounded-2xl text-sm border-none focus:ring-2 focus:ring-[#FF8C42]/20 font-bold"
                      />
                      <button onClick={() => addSetupItem('cuisines')} className="p-4 bg-[#FF8C42] text-white rounded-2xl shadow-md"><Plus className="w-5 h-5" /></button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {newPrefs.cuisines.map((c, i) => (
                        <span key={i} className="px-4 py-2 bg-[#FAF7F2] text-[10px] font-bold text-[#FF8C42] rounded-xl border border-[#FFEDE1] flex items-center gap-2">
                          {c}
                          <button onClick={() => removeSetupItem('cuisines', i)}><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <button
                    onClick={handleSaveSetup}
                    disabled={savingSetup}
                    className="w-full py-6 bg-[#FF8C42] text-white rounded-3xl font-bold text-lg flex items-center justify-center gap-4 hover:bg-[#FF8C42]/90 transition-all shadow-2xl shadow-[#FF8C42]/20"
                  >
                    {savingSetup ? <Loader2 className="w-6 h-6 animate-spin" /> : "Open Pantry"}
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Generate Recipes Modal */}
      <AnimatePresence>
        {showGenerateModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-[#2D2424]/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white max-w-md w-full rounded-[40px] shadow-2xl overflow-hidden border border-[#FFEDE1] p-10 space-y-8"
            >
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-[#FFEDE1] rounded-[30px] flex items-center justify-center mx-auto mb-2">
                  <Sparkles className="w-10 h-10 text-[#FF8C42]" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-[#2D2424]">Generate Recipes?</h3>
                <p className="text-[#FF8C42] font-medium text-sm">Which ingredients should I focus on today?</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => handleGenerateConfirm(true)}
                  className="w-full py-5 bg-[#FF8C42] text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-[#FF8C42]/90 transform active:scale-[0.98] transition-all shadow-lg shadow-[#FF8C42]/20"
                >
                  <Sparkles className="w-5 h-5" />
                  Use all {items.length} items
                </button>
                <button
                  onClick={() => {
                    setShowGenerateModal(false);
                    setSelectionMode(true);
                  }}
                  className="w-full py-5 bg-white border-2 border-[#FFEDE1] text-[#FF8C42] rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-[#FAF7F2] transform active:scale-[0.98] transition-all"
                >
                  <Salad className="w-5 h-5" />
                  Select specific items
                </button>
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => handleGenerateConfirm(false)}
                    className="w-full py-5 bg-[#2D2424] text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-black transform active:scale-[0.98] transition-all shadow-lg shadow-black/10"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Use {selectedIds.size} selected items
                  </button>
                )}
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="w-full py-4 text-xs font-black uppercase tracking-widest text-[#2D2424]/40 hover:text-[#FF8C42] transition-colors"
                >
                  Nevermind
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-16">
        <div className="space-y-4">
          <div className="flex items-center gap-5">
            <div className="w-[72px] h-[72px] bg-[#FF8C42] rounded-3xl flex items-center justify-center shadow-2xl shadow-[#FF8C42]/20 border-4 border-white relative">
              <Bot className="w-8 h-8 text-white" />
              <ChefHat className="w-6 h-6 text-white stroke-[#FF8C42] stroke-2 absolute -top-4 left-1/2 -translate-x-1/2 rotate-0 fill-white drop-shadow-lg" />
            </div>
            <h2 className="text-6xl font-serif font-bold tracking-tight text-[#2D2424]">My Pantry</h2>
          </div>
          <p className="text-[#FF8C42] text-xl font-medium italic pl-1 leading-relaxed">Manage your ingredients and uncover delicious possibilities!</p>
        </div>
        <div className="flex items-center gap-4">
          {items.length > 0 && (
            <>
              <button
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  if (selectionMode) setSelectedIds(new Set());
                }}
                className={cn(
                  "h-[60px] px-6 rounded-3xl font-bold transition-all flex items-center gap-2",
                  selectionMode ? "bg-[#FFEDE1] text-[#FF8C42]" : "bg-white border border-[#FFEDE1] text-[#FF8C42]"
                )}
              >
                {selectionMode ? <X className="w-5 h-5" /> : <Salad className="w-5 h-5" />}
                {selectionMode ? "Cancel Selection" : "Multi-Select"}
              </button>
              <button
                onClick={handleGenerateClick}
                className="h-[60px] px-8 bg-[#FF8C42] text-white rounded-3xl font-bold flex items-center justify-center gap-3 hover:bg-[#FF8C42]/90 transition-all shadow-lg shadow-[#FF8C42]/20"
              >
                <Sparkles className="w-5 h-5" />
                Generate Recipes
              </button>
            </>
          )}
        </div>
      </header>

      {/* Add Item Form */}
      <section className="bg-white p-12 md:p-16 rounded-[60px] shadow-sm border border-[#FFEDE1] space-y-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#FAF7F2] rounded-full -mr-24 -mt-24 opacity-50" />
        
        <div className="flex items-center justify-between relative z-10">
          <h3 className="text-3xl font-serif font-bold text-[#2D2424]">Restock the Pantry</h3>
        </div>

        <form onSubmit={handleAddItem} className="space-y-10 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div 
              className="space-y-1 relative"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setIsNameFocused(false);
                }
              }}
            >
              <label className="text-[10px] uppercase tracking-widest font-black text-[#FF8C42] ml-4 mb-2 block">Ingredient Name</label>
              <input
                ref={nameInputRef}
                type="text"
                placeholder="e.g. Fresh Tomatoes"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                onFocus={() => setIsNameFocused(true)}
                className="w-full px-6 py-5 bg-[#FAF7F2] rounded-[24px] border-2 border-transparent focus:border-[#FF8C42]/30 focus:bg-white focus:ring-0 transition-all outline-none text-[#2D2424] font-bold placeholder:text-[#2D2424]/20 shadow-inner"
              />
              <AnimatePresence>
                {isNameFocused && suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute z-20 w-full mt-2 bg-white border border-[#FFEDE1] rounded-[30px] shadow-2xl overflow-hidden backdrop-blur-lg"
                  >
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setNewItem({ ...newItem, name: suggestion });
                          setSuggestions([]);
                          setIsNameFocused(false);
                          fetchQtySuggestions(suggestion);
                        }}
                        className="w-full text-left px-6 py-4 hover:bg-[#FAF7F2] text-[#2D2424] font-bold text-sm transition-colors border-b border-[#FAF7F2] last:border-0"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div 
              className="space-y-1 relative"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setIsQtyFocused(false);
                }
              }}
            >
              <label className="text-[10px] uppercase tracking-widest font-black text-[#FF8C42] ml-4 mb-2 block">Quantity (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 500g, 2 pieces"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                onFocus={() => {
                  setIsQtyFocused(true);
                  if (newItem.name && qtySuggestions.length === 0) fetchQtySuggestions(newItem.name);
                }}
                className="w-full px-6 py-5 bg-[#FAF7F2] rounded-[24px] border-2 border-transparent focus:border-[#FF8C42]/30 focus:bg-white focus:ring-0 transition-all outline-none text-[#2D2424] font-bold placeholder:text-[#2D2424]/20 shadow-inner"
              />
              <AnimatePresence>
                {isQtyFocused && qtySuggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute z-10 w-full mt-2 bg-white border border-[#FFEDE1] rounded-[30px] shadow-2xl overflow-hidden backdrop-blur-lg"
                  >
                    <div className="px-6 py-3 bg-[#FFEDE1] text-[10px] uppercase tracking-widest font-black text-[#FF8C42] flex items-center gap-2">
                      <Sparkles className="w-3 h-3" />
                      Suggested sizes
                    </div>
                    {qtySuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setNewItem({ ...newItem, quantity: suggestion });
                          setIsQtyFocused(false);
                        }}
                        className="w-full text-left px-6 py-4 hover:bg-[#FAF7F2] text-[#2D2424] font-bold text-sm transition-colors border-b border-[#FAF7F2] last:border-0"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest font-black text-[#FF8C42] ml-4 mb-2 block">Use By (Optional)</label>
              <input
                type="date"
                value={newItem.expiryDate}
                onChange={(e) => setNewItem({ ...newItem, expiryDate: e.target.value })}
                className="w-full px-6 py-5 bg-[#FAF7F2] rounded-[24px] border-2 border-transparent focus:border-[#FF8C42]/30 focus:bg-white focus:ring-0 transition-all outline-none text-[#2D2424] font-bold shadow-inner"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={adding || !newItem.name}
                className="w-full h-[66px] px-8 bg-[#2D2424] text-white rounded-[24px] font-bold flex items-center justify-center gap-3 hover:bg-black disabled:opacity-50 transition-all shadow-xl shadow-[#2D2424]/10"
              >
                {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                Add to My Pantry
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* Items Section */}
      <section className="space-y-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <Loader2 className="w-10 h-10 text-[#FF8C42] animate-spin" />
            <p className="text-xs font-black uppercase tracking-widest text-[#FF8C42]/40">Scanning the shelves...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-32 bg-white rounded-[60px] border-4 border-dashed border-[#FFEDE1]">
            <div className="w-24 h-24 bg-[#FFEDE1] rounded-[40px] flex items-center justify-center mx-auto mb-8 shadow-inner">
              <Refrigerator className="w-10 h-10 text-[#FF8C42]" />
            </div>
            <p className="text-[#FF8C42] text-xl font-serif font-bold mb-2">Pantry is looking a bit empty!</p>
            <p className="text-[#2D2424]/40 text-sm font-medium">Add some items above to get personalized recipe ideas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
            <AnimatePresence mode="popLayout">
              {items.map((item) => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={() => selectionMode && toggleSelection(item.id)}
                    className={cn(
                      "group relative bg-white p-8 rounded-[45px] border-2 transition-all duration-300 flex flex-col justify-between cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1",
                      selectionMode && isSelected ? "border-[#FF8C42] bg-[#FAF7F2]" : "border-[#FFEDE1]",
                      !selectionMode && "hover:border-[#FF8C42]/30"
                    )}
                  >
                    {selectionMode && (
                      <div className="absolute top-8 right-8 z-10">
                        {isSelected ? (
                          <CheckCircle2 className="w-7 h-7 text-[#FF8C42] fill-white shadow-sm" />
                        ) : (
                          <Circle className="w-7 h-7 text-[#FFEDE1] fill-white" />
                        )}
                      </div>
                    )}
                    
                    <div className="space-y-4 mb-6">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2 pr-8">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl drop-shadow-sm">{getFoodIcon(item.name)}</span>
                            <h3 className="text-xl font-serif font-bold text-[#2D2424] leading-tight group-hover:text-[#FF8C42] transition-colors flex items-center gap-2">
                              {item.name}
                              {item.expiryDate && isBefore(new Date(item.expiryDate), new Date()) && (
                                <motion.div 
                                  animate={{ scale: [1, 1.2, 1] }}
                                  transition={{ duration: 1, repeat: Infinity }}
                                  className="w-2 h-2 rounded-full bg-rose-500 shadow-lg shadow-rose-500/50" 
                                />
                              )}
                            </h3>
                          </div>
                          <p className="px-3 py-1 bg-[#FAF7F2] text-[#FF8C42] rounded-full text-[10px] font-black uppercase tracking-widest inline-block border border-[#FFEDE1]">
                            {item.quantity}
                          </p>
                        </div>
                      </div>

                      {item.expiryDate && (
                        <div className={cn(
                          "flex items-center gap-2 p-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all duration-500",
                          isBefore(new Date(item.expiryDate), new Date())
                            ? "bg-rose-50 text-rose-600 border border-rose-100 animate-pulse" 
                            : isBefore(new Date(item.expiryDate), addDays(new Date(), 3))
                            ? "bg-amber-50 text-amber-600 border border-amber-100"
                            : "bg-[#FAF7F2] text-[#FF8C42] border border-[#FFEDE1]"
                        )}>
                          <Flame className="w-3.5 h-3.5" />
                          {isBefore(new Date(item.expiryDate), new Date()) ? 'Expired' : 'Expires'}: {format(new Date(item.expiryDate), 'MMM do')}
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-4 gap-2">
                        <div className="bg-[#FAF7F2] p-3 rounded-[20px] text-center border border-[#FFEDE1]">
                          <Flame className="w-3.5 h-3.5 text-[#FF8C42] mx-auto mb-1" />
                          <p className="text-[10px] font-black text-[#2D2424]">{Math.round(item.calories)}</p>
                        </div>
                        <div className="bg-[#FAF7F2] p-3 rounded-[20px] text-center border border-[#FFEDE1]">
                          <Beef className="w-3.5 h-3.5 text-rose-400 mx-auto mb-1" />
                          <p className="text-[10px] font-black text-[#2D2424]">{Math.round(item.protein)}g</p>
                        </div>
                        <div className="bg-[#FAF7F2] p-3 rounded-[20px] text-center border border-[#FFEDE1]">
                          <Wheat className="w-3.5 h-3.5 text-amber-500 mx-auto mb-1" />
                          <p className="text-[10px] font-black text-[#2D2424]">{Math.round(item.carbs)}g</p>
                        </div>
                        <div className="bg-[#FAF7F2] p-3 rounded-[20px] text-center border border-[#FFEDE1]">
                          <Droplets className="w-3.5 h-3.5 text-orange-400 mx-auto mb-1" />
                          <p className="text-[10px] font-black text-[#2D2424]">{Math.round(item.fat)}g</p>
                        </div>
                      </div>

                      {!selectionMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(item.id);
                          }}
                          className="w-full py-4 bg-white border border-[#FFEDE1] text-[#2D2424]/40 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Mark as Used / Trash
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  );
}
