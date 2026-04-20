import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, serverTimestamp, updateDoc, where, getDocs, limit, Timestamp, getDocFromServer } from 'firebase/firestore';
import { getNutritionInfo, getQuantitySuggestions, NutritionInfo } from '../services/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Loader2, Refrigerator, Info, Calendar, Flame, Beef, Wheat, Droplets, Sparkles, Scan, AlertCircle, X, Camera, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useHousehold } from '../contexts/HouseholdContext';
import { BarcodeScanner } from './BarcodeScanner';
import { format, addDays, isBefore, isAfter } from 'date-fns';
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

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
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

export function Fridge({ user }: { user: User }) {
  const { household } = useHousehold();
  const [items, setItems] = useState<FridgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', quantity: '', expiryDate: '', barcode: '' });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [qtySuggestions, setQtySuggestions] = useState<string[]>([]);
  const [loadingQty, setLoadingQty] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const basePath = household ? `households/${household.id}` : `users/${user.uid}`;

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
      // Get user history for this item
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

    const path = `${basePath}/fridgeItems`;
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
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return unsubscribe;
  }, [basePath]);

  const handleAddItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newItem.name) return;

    setAdding(true);
    try {
      const quantity = newItem.quantity || '1 unit';
      const nutrition = await getNutritionInfo(newItem.name, quantity);
      const itemData = {
        ...newItem,
        quantity: newItem.quantity || 'As needed',
        ...nutrition,
        addedAt: serverTimestamp(),
        removedAt: null
      };
      
      // Add to current fridge
      await addDoc(collection(db, basePath, 'fridgeItems'), itemData);
      
      // Add to big log (history)
      await addDoc(collection(db, basePath, 'history'), itemData);

      setNewItem({ name: '', quantity: '', expiryDate: '', barcode: '' });
      setQtySuggestions([]);
      toast.success(`${newItem.name} added to your fridge!`);
    } catch (error) {
      console.error("Error adding item:", error);
      toast.error("Failed to add item. Please try again.");
      handleFirestoreError(error, OperationType.CREATE, `${basePath}/fridgeItems`);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    const path = `${basePath}/fridgeItems/${id}`;
    try {
      // Instead of deleting, we mark as removed for the calendar view
      await updateDoc(doc(db, basePath, 'fridgeItems', id), {
        removedAt: serverTimestamp()
      });
      toast.success("Item removed");
    } catch (error) {
      toast.error("Failed to remove item");
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleBarcodeScan = (barcode: string) => {
    setNewItem(prev => ({ ...prev, barcode }));
    setShowScanner(false);
    toast.success(`Barcode ${barcode} scanned! Please enter the item name.`);
  };

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-serif font-light tracking-tight">Your Fridge</h2>
          <p className="text-stone-500 font-light italic">Track what's inside and stay organized</p>
        </div>
        {items.length > 0 && (
          <button
            onClick={() => window.location.href = '/recipes'}
            className="h-[60px] px-8 bg-stone-900 text-stone-50 rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-stone-800 transition-all shadow-lg shadow-stone-200"
          >
            <Sparkles className="w-5 h-5" />
            Generate Recipes
          </button>
        )}
      </header>

      {/* Add Item Form */}
      <section className="bg-white p-8 rounded-[32px] shadow-sm border border-stone-100 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-serif font-light">Add New Item</h3>
          <button 
            onClick={() => setShowScanner(true)}
            className="flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-xs font-medium hover:bg-stone-200 transition-all"
          >
            <Scan className="w-4 h-4" />
            Scan Barcode
          </button>
        </div>

        <form onSubmit={handleAddItem} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 relative">
              <label className="text-[10px] uppercase tracking-widest font-semibold text-stone-400 ml-4">Item Name</label>
              <input
                type="text"
                placeholder="e.g. Greek Yogurt"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                onBlur={() => {
                  if (newItem.name) fetchQtySuggestions(newItem.name);
                }}
                className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-stone-200 transition-all"
              />
              <AnimatePresence>
                {suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute z-20 w-full mt-2 bg-white border border-stone-100 rounded-2xl shadow-xl overflow-hidden"
                  >
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          setNewItem({ ...newItem, name: suggestion });
                          setSuggestions([]);
                          fetchQtySuggestions(suggestion);
                        }}
                        className="w-full text-left px-6 py-3 hover:bg-stone-50 text-stone-600 text-sm transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="space-y-1 relative">
              <label className="text-[10px] uppercase tracking-widest font-semibold text-stone-400 ml-4">Quantity</label>
              <input
                type="text"
                placeholder="e.g. 500g"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-stone-200 transition-all"
              />
              <AnimatePresence>
                {qtySuggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute z-10 w-full mt-2 bg-white border border-stone-100 rounded-2xl shadow-xl overflow-hidden"
                  >
                    <div className="px-4 py-2 bg-stone-50 text-[10px] uppercase tracking-widest font-bold text-stone-400 flex items-center gap-2">
                      <Sparkles className="w-3 h-3" />
                      Smart Suggestions
                    </div>
                    {qtySuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          setNewItem({ ...newItem, quantity: suggestion });
                          setQtySuggestions([]);
                        }}
                        className="w-full text-left px-6 py-3 hover:bg-stone-50 text-stone-600 text-sm transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest font-semibold text-stone-400 ml-4">Expiry Date (Optional)</label>
              <input
                type="date"
                value={newItem.expiryDate}
                onChange={(e) => setNewItem({ ...newItem, expiryDate: e.target.value })}
                className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-stone-200 transition-all"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={adding || !newItem.name}
                className="w-full h-[60px] px-8 bg-stone-900 text-stone-50 rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-stone-800 disabled:opacity-50 transition-all shadow-lg shadow-stone-200"
              >
                {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                Add to Fridge
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* Items Grid */}
      <section>
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-stone-300 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 bg-stone-100/50 rounded-[32px] border border-dashed border-stone-200">
            <Refrigerator className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-400 font-light italic">Your fridge is empty. Add some items to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group bg-white p-6 rounded-[32px] border border-stone-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="space-y-1">
                      <h3 className="text-xl font-serif font-light text-stone-900">{item.name}</h3>
                      <p className="text-sm text-stone-400 font-light italic">{item.quantity}</p>
                      {item.expiryDate && (
                        <div className={cn(
                          "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest",
                          isBefore(new Date(item.expiryDate), addDays(new Date(), 3)) 
                            ? "text-red-500" 
                            : "text-stone-400"
                        )}>
                          <AlertCircle className="w-3 h-3" />
                          Expires {format(new Date(item.expiryDate), 'MMM do')}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-6">
                    <div className="bg-stone-50 p-3 rounded-2xl text-center">
                      <Flame className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                      <p className="text-[10px] font-bold text-stone-900">{item.calories}</p>
                      <p className="text-[8px] uppercase tracking-tighter text-stone-400">kcal</p>
                    </div>
                    <div className="bg-stone-50 p-3 rounded-2xl text-center">
                      <Beef className="w-4 h-4 text-red-400 mx-auto mb-1" />
                      <p className="text-[10px] font-bold text-stone-900">{item.protein}g</p>
                      <p className="text-[8px] uppercase tracking-tighter text-stone-400">prot</p>
                    </div>
                    <div className="bg-stone-50 p-3 rounded-2xl text-center">
                      <Wheat className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                      <p className="text-[10px] font-bold text-stone-900">{item.carbs}g</p>
                      <p className="text-[8px] uppercase tracking-tighter text-stone-400">carb</p>
                    </div>
                    <div className="bg-stone-50 p-3 rounded-2xl text-center">
                      <Droplets className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                      <p className="text-[10px] font-bold text-stone-900">{item.fat}g</p>
                      <p className="text-[8px] uppercase tracking-tighter text-stone-400">fat</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-stone-400 uppercase tracking-widest font-semibold">
                    <Calendar className="w-3 h-3" />
                    Added {item.addedAt?.toDate().toLocaleDateString()}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      <AnimatePresence>
        {showScanner && (
          <BarcodeScanner 
            onScan={handleBarcodeScan} 
            onClose={() => setShowScanner(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
