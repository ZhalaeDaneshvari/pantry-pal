import { cn } from '../lib/utils';
import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, getDoc, serverTimestamp, where, getDocs } from 'firebase/firestore';
import { generateRecipes, Recipe } from '../services/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { ChefHat, Loader2, Sparkles, Bookmark, Trash2, Flame, Beef, Wheat, Droplets, ChevronRight, Refrigerator, ShoppingCart, ArrowLeft, Bot, Box, Timer, Gauge, CheckCircle2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { useHousehold } from '../contexts/HouseholdContext';
import { useRecipes } from '../contexts/RecipeContext';
import { useLocation, useNavigate } from 'react-router-dom';

export function Recipes({ user }: { user: User }) {
  const { household } = useHousehold();
  const { generatedRecipes, setGeneratedRecipes, lastGeneratedAt, setLastGeneratedAt } = useRecipes();
  const location = useLocation();
  const navigate = useNavigate();
  const [fridgeItems, setFridgeItems] = useState<any[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedIngredients] = useState<string[]>(location.state?.ingredients || []);
  const [userPreferences, setUserPreferences] = useState({ 
    likes: [], 
    dislikes: [], 
    allergies: [], 
    cuisines: [],
    healthConditions: [],
    dietaryGoal: 'Maintain',
    targetCalories: 2000
  });

  const basePath = household ? `households/${household.id}` : `users/${user.uid}`;

  useEffect(() => {
    // Fetch fridge items
    const fridgeUnsubscribe = onSnapshot(collection(db, basePath, 'fridgeItems'), (snapshot) => {
      setFridgeItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch saved recipes
    const recipesUnsubscribe = onSnapshot(
      query(collection(db, basePath, 'recipes'), orderBy('savedAt', 'desc')), 
      (snapshot) => {
        setSavedRecipes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      }
    );

    // Fetch user preferences
    const fetchPrefs = async () => {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserPreferences({
          likes: data.preferences?.likes || [],
          dislikes: data.preferences?.dislikes || [],
          allergies: data.preferences?.allergies || [],
          cuisines: data.preferences?.cuisines || [],
          healthConditions: data.healthConditions || [],
          dietaryGoal: data.dietaryGoal || 'Maintain',
          targetCalories: data.targetCalories || 2000
        });
      }
    };
    fetchPrefs();

    // Auto-generate if ingredients passed and no current recipes
    if (location.state?.ingredients && generatedRecipes.length === 0) {
      handleGenerateRecipes();
    }

    return () => {
      fridgeUnsubscribe();
      recipesUnsubscribe();
    };
  }, [user.uid, basePath]);

  const handleGenerateRecipes = async () => {
    const ingredientsToUse = selectedIngredients.length > 0 ? selectedIngredients : fridgeItems.map(item => item.name);
    
    if (ingredientsToUse.length === 0) {
      toast.error("Add some items to your pantry first!");
      return;
    }

    setGenerating(true);
    try {
      const savedTitles = savedRecipes.map(r => r.title);
      const recipes = await generateRecipes(ingredientsToUse, userPreferences, savedTitles);
      setGeneratedRecipes(recipes);
      setLastGeneratedAt(Date.now());
      toast.success("PantryChef has finished cooking up ideas!");
    } catch (error) {
      console.error("Error generating recipes:", error);
      toast.error("Failed to generate recipes. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveRecipe = async (recipe: Recipe) => {
    try {
      await addDoc(collection(db, basePath, 'recipes'), {
        ...recipe,
        savedAt: serverTimestamp()
      });
      toast.success("Recipe saved!");
    } catch (error) {
      toast.error("Failed to save recipe");
    }
  };

  const handleDeleteRecipe = async (id: string) => {
    try {
      await deleteDoc(doc(db, basePath, 'recipes', id));
      toast.success("Recipe removed");
    } catch (error) {
      toast.error("Failed to remove recipe");
    }
  };

  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-8">
        <div className="relative">
          <motion.div
            animate={{ 
              y: [0, -20, 0],
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="p-10 bg-white rounded-[50px] shadow-2xl shadow-[#FF8C42]/20 relative"
          >
            <Bot className="w-24 h-24 text-[#FF8C42]" />
            <motion.div 
              animate={{ rotate: [-5, 5, -5] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-8 left-1/2 -translate-x-1/2"
            >
              <ChefHat className="w-16 h-16 text-white stroke-[#FF8C42] stroke-2 fill-white drop-shadow-xl" />
            </motion.div>
          </motion.div>
        </div>
        <div className="text-center space-y-2">
          <motion.h3 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-3xl font-serif font-bold text-[#2D2424]"
          >
            Cooking up ideas...
          </motion.h3>
          <p className="text-[#FF8C42] font-medium animate-pulse font-bold uppercase tracking-widest text-[10px]">Consulting my robot recipes database</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-2">
            <button 
              onClick={() => navigate('/')}
              className="p-3 bg-white border border-[#FFEDE1] hover:bg-[#FFEDE1] rounded-2xl text-[#FF8C42] transition-colors shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-4xl font-serif font-bold tracking-tight text-[#2D2424]">Pantry Chef</h2>
          </div>
          <p className="text-[#FF8C42] font-medium italic">
            {selectedIngredients.length > 0 
              ? `Using ${selectedIngredients.length} items from your pantry ✨`
              : generatedRecipes.length > 0 
                ? "Here are your latest suggestions!"
                : "Let's see what we can make with your ingredients!"}
          </p>
        </div>
        <button
          onClick={handleGenerateRecipes}
          disabled={generating || (fridgeItems.length === 0 && selectedIngredients.length === 0)}
          className="h-[60px] px-8 bg-[#FF8C42] text-white rounded-3xl font-bold flex items-center justify-center gap-3 hover:bg-[#FF8C42]/90 disabled:opacity-50 transition-all shadow-lg shadow-[#FF8C42]/10"
        >
          <Sparkles className="w-5 h-5" />
          Generate Recipes
        </button>
      </header>

      {/* Generated Recipes */}
      <AnimatePresence>
        {generatedRecipes.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <h3 className="text-xl font-serif font-bold text-[#2D2424] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#FF8C42]" />
              PantryPal Suggestions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {generatedRecipes.map((recipe, idx) => (
                <RecipeCard 
                  key={idx} 
                  recipe={recipe} 
                  onSave={() => handleSaveRecipe(recipe)}
                  isGenerated
                  fridgeItems={fridgeItems}
                  basePath={basePath}
                />
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Saved Recipes */}
      <section className="space-y-6">
        <h3 className="text-xl font-serif font-bold text-[#2D2424] flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-[#FF8C42]" />
          My Recipe Book
        </h3>
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#FFEDE1] animate-spin" />
          </div>
        ) : savedRecipes.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-[50px] border-4 border-dashed border-[#FFEDE1]">
            <div className="w-20 h-20 bg-[#FFEDE1] rounded-[30px] flex items-center justify-center mx-auto mb-6">
              <Bot className="w-10 h-10 text-[#FF8C42]" />
            </div>
            <p className="text-[#FF8C42] font-semibold italic">No saved recipes yet!</p>
            <p className="text-xs text-[#2D2424]/40 mt-1 font-bold">Generate some healthy ideas above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {savedRecipes.map((recipe) => (
              <RecipeCard 
                key={recipe.id} 
                recipe={recipe} 
                onDelete={() => handleDeleteRecipe(recipe.id)}
                fridgeItems={fridgeItems}
                basePath={basePath}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RecipeCard({ recipe, onSave, onDelete, isGenerated, fridgeItems, basePath }: { 
  recipe: any; 
  onSave?: () => void; 
  onDelete?: () => void;
  isGenerated?: boolean;
  fridgeItems: any[];
  basePath: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [addingToGrocery, setAddingToGrocery] = useState(false);

  const handleAddToGrocery = async () => {
    setAddingToGrocery(true);
    try {
      const missingIngredients = recipe.ingredients.filter((ing: string) => {
        const lowerIng = ing.toLowerCase();
        return !fridgeItems.some(item => lowerIng.includes(item.name.toLowerCase()));
      });

      if (missingIngredients.length === 0) {
        toast.info("You have everything for this! Get cooking! 👨‍🍳");
        return;
      }

      for (const ing of missingIngredients) {
        await addDoc(collection(db, basePath, 'groceryList'), {
          name: ing,
          quantity: 'To taste',
          isBought: false,
          addedAt: serverTimestamp()
        });
      }
      toast.success(`Missing items added to your grocery list!`);
    } catch (error) {
      toast.error("Failed to add to grocery list");
    } finally {
      setAddingToGrocery(false);
    }
  };

  return (
    <motion.div
      layout
      className="bg-white rounded-[45px] border border-[#FFEDE1] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col group p-2"
    >
      <div className="p-10 space-y-8 flex-1 select-none">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap gap-1.5 mb-1">
              <span className="px-3 py-1 bg-[#FFEDE1] text-[#FF8C42] text-[10px] font-extrabold uppercase tracking-widest rounded-full">
                {recipe.category || "PantryPal Rec"}
              </span>
              {recipe.healthTags?.map((tag: string, i: number) => (
                <span key={i} className="px-3 py-1 bg-teal-50 text-teal-600 text-[10px] font-extrabold uppercase tracking-widest rounded-full border border-teal-100 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  {tag}
                </span>
              ))}
            </div>
            <h4 className="text-xl font-serif font-bold text-[#2D2424] leading-tight">{recipe.title}</h4>
          </div>
          <div className="flex items-center gap-1">
            {isGenerated ? (
              <button
                onClick={onSave}
                className="p-3 text-[#FFEDE1] hover:text-[#FF8C42] hover:bg-[#FFEDE1] rounded-2xl transition-all"
              >
                <Bookmark className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={onDelete}
                className="p-3 text-[#FFEDE1] hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#FAF7F2] p-3.5 rounded-2xl text-center border border-[#FFEDE1] flex flex-col items-center justify-center min-h-[70px]">
            <Flame className="w-4 h-4 text-[#FF8C42] mb-1.5" />
            <p className="text-[11px] font-bold text-[#2D2424] leading-tight">{recipe.nutrition.calories} kcal</p>
          </div>
          <div className="bg-[#FAF7F2] p-3.5 rounded-2xl text-center border border-[#FFEDE1] flex flex-col items-center justify-center min-h-[70px]">
            <Timer className="w-4 h-4 text-sky-400 mb-1.5" />
            <p className="text-[11px] font-bold text-[#2D2424] leading-tight whitespace-nowrap">{recipe.prepTime || "25 mins"}</p>
          </div>
          <div className="bg-[#FAF7F2] p-3.5 rounded-2xl text-center border border-[#FFEDE1] flex flex-col items-center justify-center min-h-[70px]">
            <Gauge className="w-4 h-4 text-emerald-400 mb-1.5" />
            <p className="text-[11px] font-bold text-[#2D2424] leading-tight">{recipe.difficulty || "Easy"}</p>
          </div>
          <div className="bg-[#FAF7F2] p-3.5 rounded-2xl text-center border border-[#FFEDE1] flex flex-col items-center justify-center min-h-[70px]">
            <p className="text-base font-black text-[#FF8C42] tracking-tighter leading-none mb-1">{recipe.servings}</p>
            <p className="text-[9px] uppercase tracking-widest text-[#2D2424]/40 font-black">Serves</p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#FF8C42]">Pantry Check</p>
          <div className="flex flex-wrap gap-2">
            {recipe.ingredients.slice(0, 5).map((ing: string, i: number) => (
              <span key={i} className="px-3 py-1.5 bg-[#FAF7F2] text-[10px] font-bold text-[#2D2424]/60 rounded-xl border border-[#FFEDE1]">{ing}</span>
            ))}
            {recipe.ingredients.length > 5 && (
              <span className="px-3 py-1.5 bg-[#FAF7F2] text-[10px] font-bold text-[#FF8C42] rounded-xl border border-[#FFEDE1]">+{recipe.ingredients.length - 5} more</span>
            )}
          </div>
        </div>
      </div>

      <div className="p-10 pt-0 space-y-5">
        <button
          onClick={handleAddToGrocery}
          disabled={addingToGrocery}
          className="w-full py-5 px-4 bg-[#FFEDE1] text-[#FF8C42] rounded-3xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-[#FF8C42] hover:text-white transition-all disabled:opacity-50"
        >
          {addingToGrocery ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingCart className="w-5 h-5" />}
          Get Missing Items
        </button>

        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-5 px-6 bg-white border-2 border-[#FFEDE1] flex items-center justify-between text-[11px] font-black uppercase tracking-[0.1em] text-[#2D2424]/60 hover:bg-[#FAF7F2] rounded-3xl transition-all"
        >
          {expanded ? "Hide Recipes" : "View Cooking Instructions"}
          <ChevronDown className={cn("w-5 h-5 transition-transform duration-300", expanded && "rotate-180")} />
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-[#FAF7F2]/50"
          >
            <div className="p-8 text-[#2D2424] leading-relaxed prose prose-stone prose-sm max-w-none border-t border-[#FFEDE1] markdown-body">
              <ReactMarkdown>{recipe.instructions}</ReactMarkdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

