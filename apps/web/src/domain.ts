export type Extra = { id: string; name: string; priceCents: number };
export type MenuItem = {
  id: string; name: string; description: string; category: string; priceCents: number;
  poster: string; videoUrl?: string; tags: string[]; allergens: string[]; extras: Extra[]; available: boolean;
};
export type CartLine = { lineId: string; itemId: string; extraIds: string[]; quantity: number };
export type DemoOrder = { number: string; lines: CartLine[]; totalCents: number; status: "recebido" | "preparando" | "pronto" | "entregue" };
export const formatMoney = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
export function itemUnitPrice(item: MenuItem, extraIds: string[]): number {
  const chosen = new Set(extraIds);
  return item.priceCents + item.extras.reduce((sum, extra) => sum + (chosen.has(extra.id) ? extra.priceCents : 0), 0);
}
export function lineTotal(line: CartLine, items: MenuItem[]): number {
  const item = items.find(candidate => candidate.id === line.itemId);
  if (!item) return 0;
  return itemUnitPrice(item, line.extraIds) * Math.max(0, line.quantity);
}
export function cartTotal(lines: CartLine[], items: MenuItem[]): number {
  return lines.reduce((sum, line) => sum + lineTotal(line, items), 0);
}
export function addCartLine(lines: CartLine[], next: CartLine): CartLine[] {
  const signature = (line: CartLine) => line.itemId + ":" + [...line.extraIds].sort().join(",");
  const index = lines.findIndex(line => signature(line) === signature(next));
  if (index < 0) return [...lines, next];
  return lines.map((line, i) => i === index ? { ...line, quantity: line.quantity + next.quantity } : line);
}
