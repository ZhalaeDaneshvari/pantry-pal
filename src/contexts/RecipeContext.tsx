import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Recipe } from '../services/gemini';

interface RecipeContextType {
  generatedRecipes: Recipe[];
  setGeneratedRecipes: (recipes: Recipe[]) => void;
  lastGeneratedAt: number | null;
  setLastGeneratedAt: (timestamp: number) => void;
}

const RecipeContext = createContext<RecipeContextType | undefined>(undefined);

export function RecipeProvider({ children }: { children: ReactNode }) {
  const [generatedRecipes, setGeneratedRecipes] = useState<Recipe[]>([]);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<number | null>(null);

  return (
    <RecipeContext.Provider value={{ 
      generatedRecipes, 
      setGeneratedRecipes, 
      lastGeneratedAt, 
      setLastGeneratedAt 
    }}>
      {children}
    </RecipeContext.Provider>
  );
}

export function useRecipes() {
  const context = useContext(RecipeContext);
  if (context === undefined) {
    throw new Error('useRecipes must be used within a RecipeProvider');
  }
  return context;
}
