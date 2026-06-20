// Enlaces de afiliado para ticketeras.
//
// Cómo activarlo: cuando te registres en el programa de afiliados de una
// ticketera (p. ej. Ticketmaster vía Impact), te dan una "plantilla" de
// deep-link de tracking. Pegala acá usando {url} como placeholder de la URL
// destino (se inserta URL-encodeada). Mientras la plantilla quede vacía, se
// usa la URL directa sin tracking, así que el botón funciona igual.
//
// Ejemplo de formato Impact (REEMPLAZAR por el tuyo real):
//   Ticketmaster: "https://ticketmaster.evyy.net/c/<AFFID>/<CAMPAIGNID>/<TRACK>?u={url}"
const AFFILIATE_TEMPLATES: Record<string, string> = {
  Ticketmaster: "",
  // Agregá acá otras ticketeras a futuro, ej:
  // Passline: "",
  // Puntoticket: "",
};

/**
 * Devuelve la URL lista para usar en el botón de entradas. Si hay plantilla de
 * afiliado configurada para esa ticketera, envuelve la URL con el tracking;
 * si no, devuelve la URL original sin cambios.
 */
export function affiliateUrl(url: string, vendor?: string | null): string {
  const tpl = vendor ? AFFILIATE_TEMPLATES[vendor] : "";
  if (!tpl) return url;
  return tpl.replace("{url}", encodeURIComponent(url));
}
