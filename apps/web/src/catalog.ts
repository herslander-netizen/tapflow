import type { MenuItem } from "./domain";
// Restaurante, mesa, produtos e fotografias: exemplos fictícios, sem oferta comercial.
export const restaurant = { name: "Casa Aurora", table: "Mesa 07", subtitle: "Cozinha contemporânea · Demonstração" };
export const catalog: MenuItem[] = [
  { id: "burger", name: "Burger da casa", category: "Favoritos",
    description: "Pão tostado, burger artesanal, queijo e molho da casa.", priceCents: 3890,
    poster: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1000&q=80",
    tags: ["Mais pedido", "Artesanal"], allergens: ["Glúten", "Leite"],
    extras: [{ id: "cheese", name: "Queijo extra", priceCents: 500 }, { id: "bacon", name: "Bacon crocante", priceCents: 700 }], available: true },
  { id: "pizza", name: "Pizza da horta", category: "Para compartilhar",
    description: "Massa de longa fermentação, tomate fresco, manjericão e queijo.", priceCents: 5990,
    poster: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1000&q=80",
    tags: ["Para dividir"], allergens: ["Glúten", "Leite"],
    extras: [{ id: "burrata", name: "Burrata", priceCents: 1200 }], available: true },
  { id: "bowl", name: "Bowl verde", category: "Leves",
    description: "Grãos, folhas frescas, abacate, legumes e molho cítrico.", priceCents: 3490,
    poster: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1000&q=80",
    tags: ["Vegetariano"], allergens: ["Pode conter soja"],
    extras: [{ id: "egg", name: "Ovo extra", priceCents: 450 }], available: true },
  { id: "pasta", name: "Massa ao pomodoro", category: "Favoritos",
    description: "Massa artesanal, tomate reduzido e ervas frescas.", priceCents: 4290,
    poster: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1000&q=80",
    tags: ["Da cozinha"], allergens: ["Glúten"],
    extras: [{ id: "parmesan", name: "Parmesão", priceCents: 600 }], available: true },
  { id: "dessert", name: "Doce da casa", category: "Sobremesas",
    description: "Sobremesa cremosa com frutas da estação.", priceCents: 2290,
    poster: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1000&q=80",
    tags: ["Final feliz"], allergens: ["Leite"], extras: [], available: false }
];
