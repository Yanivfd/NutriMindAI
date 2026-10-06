import type { ImageSourcePropType } from 'react-native';

// Bundled photos keyed by recipe id; recipes without a photo show an icon instead.
const RECIPE_IMAGES: Record<string, ImageSourcePropType> = {
  'bacon-eggs': require('../../assets/recipes/bacon-eggs.jpg'),
  'bacon-mac-and-cheese': require('../../assets/recipes/bacon-mac-and-cheese.jpg'),
  'baked-chicken-rice': require('../../assets/recipes/baked-chicken-rice.jpg'),
  'beef-stroganoff': require('../../assets/recipes/beef-stroganoff.jpg'),
  'blt-sandwich': require('../../assets/recipes/blt-sandwich.jpg'),
  'butter-chicken-rice': require('../../assets/recipes/butter-chicken-rice.jpg'),
  'cheeseburger': require('../../assets/recipes/cheeseburger.jpg'),
  'chicken-alfredo': require('../../assets/recipes/chicken-alfredo.jpg'),
  'chicken-caesar': require('../../assets/recipes/chicken-caesar.jpg'),
  'chicken-pita-tahini': require('../../assets/recipes/chicken-pita-tahini.jpg'),
  'cottage-veggie-plate': require('../../assets/recipes/cottage-veggie-plate.jpg'),
  'crab-cakes': require('../../assets/recipes/crab-cakes.jpg'),
  'greek-salad-tuna': require('../../assets/recipes/greek-salad-tuna.jpg'),
  'greek-yogurt-bowl': require('../../assets/recipes/greek-yogurt-bowl.jpg'),
  'ham-cheese-toast': require('../../assets/recipes/ham-cheese-toast.jpg'),
  'hummus-egg-plate': require('../../assets/recipes/hummus-egg-plate.jpg'),
  'linguine-clams': require('../../assets/recipes/linguine-clams.jpg'),
  'mujadara': require('../../assets/recipes/mujadara.jpg'),
  'noodle-kugel': require('../../assets/recipes/noodle-kugel.jpg'),
  'overnight-oats': require('../../assets/recipes/overnight-oats.jpg'),
  'pasta-tomato-mozzarella': require('../../assets/recipes/pasta-tomato-mozzarella.jpg'),
  'pepperoni-pizza': require('../../assets/recipes/pepperoni-pizza.jpg'),
  'pork-chop': require('../../assets/recipes/pork-chop.jpg'),
  'pork-fried-rice': require('../../assets/recipes/pork-fried-rice.jpg'),
  'prosciutto-melon-plate': require('../../assets/recipes/prosciutto-melon-plate.jpg'),
  'quiche-lorraine': require('../../assets/recipes/quiche-lorraine.jpg'),
  'red-lentil-soup': require('../../assets/recipes/red-lentil-soup.jpg'),
  'sabich-pita': require('../../assets/recipes/sabich-pita.jpg'),
  'salmon-sweet-potato': require('../../assets/recipes/salmon-sweet-potato.jpg'),
  'sausage-breakfast-burrito': require('../../assets/recipes/sausage-breakfast-burrito.jpg'),
  'sausage-peppers': require('../../assets/recipes/sausage-peppers.jpg'),
  'shakshuka-feta': require('../../assets/recipes/shakshuka-feta.jpg'),
  'shrimp-stirfry': require('../../assets/recipes/shrimp-stirfry.jpg'),
  'spaghetti-carbonara': require('../../assets/recipes/spaghetti-carbonara.jpg'),
  'tofu-veggie-stirfry': require('../../assets/recipes/tofu-veggie-stirfry.jpg'),
  'tuna-chickpea-salad': require('../../assets/recipes/tuna-chickpea-salad.jpg'),
  'tuna-pasta-salad': require('../../assets/recipes/tuna-pasta-salad.jpg'),
  'turkey-burger': require('../../assets/recipes/turkey-burger.jpg'),
  'turkey-noodle-stirfry': require('../../assets/recipes/turkey-noodle-stirfry.jpg'),
  'veggie-omelette-toast': require('../../assets/recipes/veggie-omelette-toast.jpg'),
};

/** Photo for a recipe, or undefined when none is bundled. */
export function recipeImage(recipeId: string): ImageSourcePropType | undefined {
  return RECIPE_IMAGES[recipeId];
}
