export const menuCategories = {
  REVUELTO: { label: "Revueltos", singular: "Revuelto" },
  REVUELTITO: { label: "Revueltitos", singular: "Revueltito" },
  SANGUCHITO: { label: "Sanguchitos", singular: "Sanguchito" },
  BEBIDA: { label: "Bebidas", singular: "Bebida" },
} as const;

export type MenuCategory = keyof typeof menuCategories;

export function parseMenuCategory(value: string | undefined): MenuCategory {
  return value && Object.prototype.hasOwnProperty.call(menuCategories, value) ? value as MenuCategory : "REVUELTO";
}
