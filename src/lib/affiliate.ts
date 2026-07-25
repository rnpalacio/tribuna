// Programas de afiliados — soporta tickets y e-commerce (merch).
//
// Dos mecanismos:
//  - "wrap": deep-link de tracking que envuelve la URL destino. El template
//    usa {url} como placeholder (se inserta URL-encodeada). Típico de redes
//    como Impact (ticketeras). Ej: "https://x.evyy.net/c/AFF/CAMP?u={url}"
//  - "param": se agrega un parámetro de tracking a la URL destino. Típico de
//    Amazon Asociados (?tag=tu-store-20) y similares.
//
// Los programas viven en la tabla `affiliate_programs` (editable desde el panel
// /admin/afiliados). Mientras un programa esté inactivo o sin configurar, el
// botón usa la URL directa, así que igual funciona.

export type AffiliateProgram = {
  id: string;
  vendor: string;
  name: string | null;
  mode: "wrap" | "param";
  template: string | null;
  param_key: string | null;
  param_value: string | null;
  active: boolean;
};

// Fallback estático (por si no hay tabla / para v1). Vacío = link directo.
const STATIC_TEMPLATES: Record<string, string> = {
  // Ticketmaster: "https://ticketmaster.evyy.net/c/<AFFID>/<CAMP>/<TRACK>?u={url}",
};

function appendParam(url: string, key: string, value: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set(key, value);
    return u.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  }
}

/** Aplica un programa de afiliado (de la base) a una URL destino. */
export function applyAffiliate(url: string, program?: AffiliateProgram | null): string {
  if (!url || !program || !program.active) return url;
  if (program.mode === "wrap" && program.template?.includes("{url}")) {
    return program.template.replace("{url}", encodeURIComponent(url));
  }
  if (program.mode === "param" && program.param_key && program.param_value) {
    return appendParam(url, program.param_key, program.param_value);
  }
  return url;
}

/** Versión sincrónica con fallback estático (compatibilidad). */
export function affiliateUrl(url: string, vendor?: string | null): string {
  const tpl = vendor ? STATIC_TEMPLATES[vendor] : "";
  if (!tpl) return url;
  return tpl.replace("{url}", encodeURIComponent(url));
}

/** Construye un buscador de programas a partir de una lista (de la base). */
export function programLookup(programs: AffiliateProgram[]): (vendor?: string | null) => AffiliateProgram | undefined {
  const map = new Map(programs.map((p) => [p.vendor.toLowerCase(), p]));
  return (vendor?: string | null) => (vendor ? map.get(vendor.toLowerCase()) : undefined);
}
