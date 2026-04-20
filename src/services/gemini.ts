import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface NutritionInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Recipe {
  title: string;
  ingredients: string[];
  instructions: string;
  servings: number;
  nutrition: NutritionInfo;
}

export const getNutritionInfo = async (itemName: string, quantity: string): Promise<NutritionInfo> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Estimate the nutritional information for ${quantity} of ${itemName}. Provide the response in JSON format.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          calories: { type: Type.NUMBER },
          protein: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fat: { type: Type.NUMBER }
        },
        required: ["calories", "protein", "carbs", "fat"]
      }
    }
  });

  return JSON.parse(response.text);
};

export const getQuantitySuggestions = async (itemName: string, userHistory: string[] = []): Promise<string[]> => {
  const historyContext = userHistory.length > 0 
    ? `The user has previously bought these quantities for this item: ${userHistory.join(", ")}.`
    : "";

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Suggest 4 common purchase quantities/sizes for "${itemName}". ${historyContext} 
    Consider standard container sizes (e.g., for yogurt: 150g, 500g, 1kg). 
    Provide the response as a JSON array of strings.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  return JSON.parse(response.text);
};

export const generateRecipes = async (
  ingredients: string[], 
  preferences: { 
    likes: string[], 
    dislikes: string[], 
    allergies: string[], 
    cuisines: string[],
    healthConditions?: string[],
    dietaryGoal?: string,
    targetCalories?: number
  },
  savedRecipes: string[] = []
): Promise<Recipe[]> => {
  const savedContext = savedRecipes.length > 0 
    ? `The user has previously saved these recipes: ${savedRecipes.join(", ")}. Use these as inspiration for their taste profile.`
    : "";

  const healthContext = `
    Health Conditions: ${preferences.healthConditions?.join(", ") || "None"}
    Dietary Goal: ${preferences.dietaryGoal || "Maintain"}
    Target Daily Calories: ${preferences.targetCalories || "Not specified"}
    
    IMPORTANT: 
    - Estimate calories and nutritional information based on the ingredients used in the recipe.
    - If the user has PCOS, prioritize high protein, low glycemic index, and balanced macro splits. 
    - If the user has Diabetes, prioritize low sugar and fiber-rich ingredients.
    - If the user is on a "Cut", prioritize high volume, low calorie density meals.
    - If the user is on a "Bulk", prioritize nutrient-dense, higher calorie meals.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate 3 recipes using some or all of these ingredients: ${ingredients.join(", ")}. 
    User preferences: 
    - Likes: ${preferences.likes.join(", ")}
    - Dislikes: ${preferences.dislikes.join(", ")}
    - Allergies: ${preferences.allergies.join(", ")}
    - Preferred Cuisines: ${preferences.cuisines.join(", ")}
    
    ${healthContext}
    ${savedContext}
    
    IMPORTANT: Assume the user has basic pantry staples like salt, pepper, common spices, oil, and water. Do not list these as required ingredients unless they are central to the dish.
    
    Provide the response as an array of recipe objects including 'servings' and 'instructions'.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
            instructions: { type: Type.STRING },
            servings: { type: Type.NUMBER },
            nutrition: {
              type: Type.OBJECT,
              properties: {
                calories: { type: Type.NUMBER },
                protein: { type: Type.NUMBER },
                carbs: { type: Type.NUMBER },
                fat: { type: Type.NUMBER }
              },
              required: ["calories", "protein", "carbs", "fat"]
            }
          },
          required: ["title", "ingredients", "instructions", "servings", "nutrition"]
        }
      }
    }
  });

  return JSON.parse(response.text);
};
