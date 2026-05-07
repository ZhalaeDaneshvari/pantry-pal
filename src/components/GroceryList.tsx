import { cn } from '../lib/utils';
import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, serverTimestamp, getDocs, getDocFromServer } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, Plus, Trash2, Check, Loader2, Refrigerator, Sparkles, ChevronRight, Info, AlertTriangle } from 'lucide-react';
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

interface GroceryItem {
  id: string;
  name: string;
  quantity: string;
  isBought: boolean;
  addedAt: any;
}

export function GroceryList({ user }: { user: User }) {
  const { household } = useHousehold();
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState({ name: '', quantity: '' });
  const [adding, setAdding] = useState(false);

  const basePath = household ? `households/${household.id}` : `users/${user.uid}`;

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

    const path = `${basePath}/groceryList`;
    const q = query(collection(db, basePath, 'groceryList'), orderBy('addedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as GroceryItem[];
      setItems(itemsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return unsubscribe;
  }, [basePath]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name) return;
    setAdding(true);
    try {
      await addDoc(collection(db, basePath, 'groceryList'), {
        ...newItem,
        isBought: false,
        addedAt: serverTimestamp()
      });
      setNewItem({ name: '', quantity: '' });
      toast.success("Added to list");
    } catch (error) {
      toast.error("Failed to add item");
      handleFirestoreError(error, OperationType.CREATE, `${basePath}/groceryList`);
    } finally {
      setAdding(false);
    }
  };

  const toggleBought = async (id: string, currentStatus: boolean) => {
    const path = `${basePath}/groceryList/${id}`;
    try {
      await updateDoc(doc(db, basePath, 'groceryList', id), {
        isBought: !currentStatus
      });
    } catch (error) {
      toast.error("Failed to update item");
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteItem = async (id: string) => {
    const path = `${basePath}/groceryList/${id}`;
    try {
      await deleteDoc(doc(db, basePath, 'groceryList', id));
    } catch (error) {
      toast.error("Failed to delete item");
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const moveToFridge = async () => {
    const boughtItems = items.filter(item => item.isBought);
    if (boughtItems.length === 0) {
      toast.error("No bought items to move");
      return;
    }

    setLoading(true);
    try {
      for (const item of boughtItems) {
        // Add to fridge
        await addDoc(collection(db, basePath, 'fridgeItems'), {
          name: item.name,
          quantity: item.quantity || '1 unit',
          addedAt: serverTimestamp(),
          calories: 0, protein: 0, carbs: 0, fat: 0 // Nutrition will be fetched when viewed or edited
        });
        // Delete from grocery list
        await deleteDoc(doc(db, basePath, 'groceryList', item.id));
      }
      toast.success(`Moved ${boughtItems.length} items to fridge!`);
    } catch (error) {
      toast.error("Failed to move items");
      handleFirestoreError(error, OperationType.WRITE, basePath);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-12 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-serif font-light tracking-tight">Grocery List</h2>
          <p className="text-stone-500 font-light italic">Plan your next shopping trip</p>
        </div>
        {items.some(i => i.isBought) && (
          <button
            onClick={moveToFridge}
            className="h-[60px] px-8 bg-stone-900 text-stone-50 rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-stone-800 transition-all shadow-lg shadow-stone-200"
          >
            <Refrigerator className="w-5 h-5" />
            Move Bought to Fridge
          </button>
        )}
      </header>

      {/* Add Item Form */}
      <section className="bg-white p-8 rounded-[32px] shadow-sm border border-stone-100">
        <form onSubmit={handleAddItem} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400 ml-4">Item Name</label>
            <input
              type="text"
              placeholder="e.g. Almond Milk"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-stone-200 transition-all"
            />
          </div>
          <div className="w-full md:w-32 space-y-1">
            <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400 ml-4">Qty</label>
            <input
              type="text"
              placeholder="1 carton"
              value={newItem.quantity}
              onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
              className="w-full px-6 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-stone-200 transition-all"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={adding || !newItem.name}
              className="w-full md:w-auto h-[60px] px-8 bg-stone-100 text-stone-900 rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-stone-200 disabled:opacity-50 transition-all"
            >
              {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              Add
            </button>
          </div>
        </form>
      </section>

      {/* List */}
      <section className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-stone-300 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 bg-stone-100/50 rounded-[32px] border border-dashed border-stone-200">
            <ShoppingCart className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-400 font-light italic">Your list is empty. Time to plan a meal!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className={cn(
                    "bg-white p-4 rounded-2xl border border-stone-100 shadow-sm flex items-center justify-between group transition-all",
                    item.isBought && "opacity-50 bg-stone-50"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => toggleBought(item.id, item.isBought)}
                      className={cn(
                        "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                        item.isBought 
                          ? "bg-stone-900 border-stone-900 text-white" 
                          : "border-stone-200 hover:border-stone-400"
                      )}
                    >
                      {item.isBought && <Check className="w-4 h-4" />}
                    </button>
                    <div>
                      <h3 className={cn(
                        "text-lg font-serif font-light text-stone-900",
                        item.isBought && "line-through"
                      )}>
                        {item.name}
                      </h3>
                      {item.quantity && (
                        <p className="text-xs text-stone-400 font-light italic">{item.quantity}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-2 text-stone-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      <section className="bg-stone-900 p-8 rounded-[32px] text-stone-50 flex items-start gap-4">
        <Info className="w-6 h-6 text-stone-400 shrink-0 mt-1" />
        <div className="space-y-2">
          <h4 className="font-serif font-light text-xl">Smart Shopping</h4>
          <p className="text-stone-400 text-sm font-light leading-relaxed">
            When you mark items as bought, you can move them all to your fridge with one click. We'll automatically set their added date to today so you can track their freshness.
          </p>
        </div>
      </section>
    </div>
  );
}

