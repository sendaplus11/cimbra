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
      utm_campaign TEXT
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
      acepta_comunicaciones INTEGER NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'nuevo',
      notas TEXT
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_leads_correo ON leads(correo)`),
  ]);
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
