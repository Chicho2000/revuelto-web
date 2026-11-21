type VegetableChoiceInput = {
  recipeIngredients: Array<{ ingredientId: string }>;
  choiceGroups: Array<{
    code: string;
    category: string;
    minSelections: number;
    maxSelections: number;
    options: Array<{ ingredientId: string }>;
  }>;
};

export function getRevueltitoVegetableChoiceError(input: VegetableChoiceInput): string | null {
  if (input.choiceGroups.length === 0) return null;
  const group = input.choiceGroups[0];
  if (input.choiceGroups.length !== 1 || group.code !== "vegetables" || group.category !== "VEGETABLE") {
    return "Los Revueltitos solo admiten un grupo opcional de elección de vegetales.";
  }
  if (!Number.isInteger(group.minSelections) || group.minSelections < 1 || group.minSelections > 20 || group.minSelections !== group.maxSelections) {
    return "Indicá una cantidad obligatoria de vegetales entre 1 y 20.";
  }
  const ids = new Set(group.options.map((option) => option.ingredientId));
  if (ids.size !== group.options.length) return "No repitas vegetales entre las opciones.";
  if (ids.size < group.minSelections) return "Elegí suficientes vegetales disponibles para cubrir la cantidad obligatoria.";
  if (input.recipeIngredients.some((ingredient) => ids.has(ingredient.ingredientId))) {
    return "Un vegetal a elección no debe estar también incluido en la receta fija.";
  }
  return null;
}

export function toggleIngredientChoice(current: string[], ingredientId: string, checked: boolean, maxSelections: number): string[] {
  if (!checked) return current.filter((id) => id !== ingredientId);
  if (maxSelections === 1) return [ingredientId];
  if (current.includes(ingredientId) || current.length >= maxSelections) return current;
  return [...current, ingredientId];
}
