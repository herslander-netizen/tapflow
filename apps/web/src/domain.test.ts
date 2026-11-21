import { describe, expect, it } from "vitest";
import { addCartLine, cartTotal, itemUnitPrice, lineTotal } from "./domain";
import { catalog } from "./catalog";
describe("cálculos da vitrine demonstrativa", () => {
  it("soma adicionais válidos sem duplicar ids", () => {
    expect(itemUnitPrice(catalog[0], ["cheese", "cheese", "inexistente"])).toBe(4390);
  });
  it("calcula quantidades e subtotal em centavos", () => {
    const lines = [{ lineId: "1", itemId: "burger", extraIds: ["bacon"], quantity: 2 }];
    expect(lineTotal(lines[0], catalog)).toBe(9180);
    expect(cartTotal(lines, catalog)).toBe(9180);
  });
  it("agrupa itens apenas com os mesmos adicionais", () => {
    const first = { lineId: "1", itemId: "burger", extraIds: ["cheese"], quantity: 1 };
    const grouped = addCartLine([first], { ...first, lineId: "2", quantity: 2 });
    expect(grouped).toHaveLength(1);
    expect(grouped[0].quantity).toBe(3);
    expect(addCartLine(grouped, { ...first, lineId: "3", extraIds: [] })).toHaveLength(2);
  });
});
