# PantryPal: Your AI-Powered Kitchen Companion

PantryPal is a sophisticated, full-stack web application designed to eliminate food waste and simplify meal planning. By combining real-time inventory tracking with advanced AI, PantryPal turns the ingredients you already have into delicious, personalized recipe inspirations.

## Key Features

**Intelligent Inventory Management**  
Track your pantry, fridge, and freezer items with ease. Features include smart quantity suggestions and automated expiry date tracking to ensure nothing goes to waste.

**AI Chef (Gemini Powered)**  
Our custom AI "Chef Bot" analyzes your current inventory to generate creative, nutritious recipes on demand. It prioritizes what you have while identifying exactly what's missing.

**Smart Categorization**  
Recipes are automatically tagged for dietary needs, including "Healthier Choice," "PCOS Friendly," "Low-GI," and more, ensuring everyone at your table is catered for.

**Collaborative Households**  
Create or join a household to sync your pantry with roommates or family members in real-time.

**Seamless Grocery Integration**  
Instantly add missing ingredients from any recipe to your integrated shopping list with a single click.

**Nutritional Transparency**  
View detailed macros (calories, protein, carbs, fat) and prep difficulty for every AI-generated meal.

**High-End Aesthetic**  
A meticulously crafted "editorial" UI built with Tailwind CSS and Framer Motion, featuring smooth transitions and a premium, responsive design.

## Tech Stack

- **Frontend:** React (Vite) + TypeScript
- **Styling:** Tailwind CSS + Framer Motion (animations)
- **Database & Auth:** Firebase Firestore & Firebase Authentication
- **AI Engine:** Google Gemini Pro (via @google/generai SDK)
- **Icons:** Lucide React
- **Notifications:** Sonner

## Getting Started

### Prerequisites
Node.js

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key

3. Run the app:
   ```bash
   npm run dev
   ```

## How to Use

1. **Add Your Staples:** Start by logging what's in your kitchen. PantryPal will assign icons and suggest quantities.

2. **Generate Recipes:** Click "Generate Recipes" to see what your AI Chef suggests based on your current stockpile.

3. **Adjust Settings:** Set up your health profile to receive specifically tailored "Friendly" tags on your recipe suggestions.

4. **Stay Inspired:** Use the expiry alerts to decide what to cook next based on what needs to be used first.

## Deploy

[PantryPal Live App](https://pantrypal-252908779850.us-central1.run.app/)
