// Base de datos de OBRALYT (Cloudflare D1, enlazada al proyecto de Pages con el nombre DB).
// Guarda SOLO datos de navegación y los contactos que las personas dejan voluntariamente.
// Nunca guarda presupuestos, montos, partidas ni nombres de archivo.

let esquemaListo = false;

export async function asegurarEsquema(db) {
  if (esquemaListo) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      creado TEXT NOT NULL,
      sesion TEXT NOT NULL,
      nombre TEXT NOT NULL,
      datos TEXT,
      pais TEXT,
      dispositivo TEXT,
      referencia TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      utm_content TEXT
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_eventos_creado ON eventos(creado)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_eventos_sesion ON eventos(sesion)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      creado TEXT NOT NULL,
      nombre TEXT,
      correo TEXT NOT NULL,
      empresa TEXT,
      cargo TEXT,
      pais TEXT,
      telefono TEXT,
      origen TEXT,
      sesion TEXT,
      pais_ip TEXT,
      referencia TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      utm_content TEXT,
      acepta_comunicaciones INTEGER NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'nuevo',
      notas TEXT
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_leads_correo ON leads(correo)`),
    // Eventos que NO cuentan en las estadísticas: equipo (Carlos/Jacob), pruebas y tráfico desde servidores.
    db.prepare(`CREATE TABLE IF NOT EXISTS eventos_excluidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      creado TEXT NOT NULL,
      motivo TEXT NOT NULL,
      sesion TEXT NOT NULL,
      nombre TEXT NOT NULL,
      datos TEXT,
      pais TEXT,
      dispositivo TEXT,
      referencia TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      utm_content TEXT,
      red TEXT
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_excluidos_creado ON eventos_excluidos(creado)`),
  ]);
  // Migración: las tablas creadas antes de medir utm_content no tienen esa columna.
  for (const tabla of ["eventos", "leads"]) {
    const { results } = await db.prepare(`PRAGMA table_info(${tabla})`).all();
    if (!(results || []).some((c) => c.name === "utm_content")) {
      await db.prepare(`ALTER TABLE ${tabla} ADD COLUMN utm_content TEXT`).run();
    }
  }
  esquemaListo = true;
}

export const json = (datos, estado = 200) =>
  new Response(JSON.stringify(datos), {
    status: estado,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

// Texto corto y limpio (sin saltos de línea ni caracteres de control).
export const limpio = (v, max = 120) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : null;

export function dispositivo(request) {
  const ua = request.headers.get("user-agent") || "";
  if (/bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless/i.test(ua)) return "bot";
  if (/ipad|tablet/i.test(ua)) return "tableta";
  if (/mobi|android|iphone/i.test(ua)) return "móvil";
  return "computadora";
}

// Solo se aceptan peticiones desde el propio sitio (o sus vistas previas de Cloudflare Pages).
export function origenPermitido(request) {
  const o = request.headers.get("origin") || "";
  if (!o) return true;
  try {
    const h = new URL(o).hostname;
    return h === "obralyt.com" || h === "www.obralyt.com" || h.endsWith(".pages.dev") || h === "localhost" || h === "127.0.0.1";
  } catch (e) {
    return false;
  }
}

// ¿Por qué un evento no debe contar? "equipo" / "prueba" (lo marca el navegador) o "servidor"
// (la visita llega desde la red de un centro de datos: robots, agentes de IA, herramientas de prueba).
// Devuelve null si es una visita normal.
const RED_SERVIDOR = /amazon|aws|google cloud|google llc|microsoft|azure|digitalocean|ovh|hetzner|linode|akamai|alibaba|tencent|oracle|vultr|choopa|contabo|leaseweb|scaleway|huawei cloud|cloudflare|fastly|m247|datacamp|hostinger|godaddy|ionos|hosting|data ?cent(er|re)|colocation|servers?\b/i;
const ASN_SERVIDOR = new Set([16509, 14618, 15169, 396982, 19527, 8075, 14061, 16276, 24940, 63949, 45102, 37963, 132203, 45090, 31898, 13335, 20473, 51167, 12876, 60781, 20940, 54113, 9009, 136907, 55990]);

export function motivoExclusion(request, marcaNavegador) {
  if (marcaNavegador === "equipo" || marcaNavegador === "prueba") return marcaNavegador;
  const cf = request.cf || {};
  const org = typeof cf.asOrganization === "string" ? cf.asOrganization : "";
  if (ASN_SERVIDOR.has(Number(cf.asn)) || (RED_SERVIDOR.test(org) && !/fiber|fibra/i.test(org))) return "servidor";
  return null;
}

export function redDe(request) {
  const cf = request.cf || {};
  return cf.asn ? limpio(`AS${cf.asn} ${cf.asOrganization || ""}`, 80) : null;
}
