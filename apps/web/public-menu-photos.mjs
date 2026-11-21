// Fotos ilustrativas só da vitrine fictícia. Não associa imagens por nome,
// não aceita URLs vindas do catálogo e não é um serviço de upload para lojistas.
const photos = Object.freeze({
  "aurora-coado": "coado",
  "aurora-cap": "cap",
  "aurora-bolo": "bolo",
  "aurora-croissant": "croissant",
});
export function demoPhoto(slug, locationId, itemId) {
  if (slug !== "cafe-aurora-demo" || locationId !== "vitrine-demo" || !Object.hasOwn(photos, itemId)) return null;
  return "/menu-photos/aurora/" + photos[itemId];
}
