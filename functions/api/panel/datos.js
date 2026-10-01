// Panel privado de Carlos: contactos y embudo de uso. Protegido con la clave PANEL_CLAVE,
// que se define como secreto en Cloudflare Pages (Configuración → Variables y secretos).
import { asegurarEsquema, json } from "../../../servidor/db.js";

async function claveCorrecta(recibida, esperada) {
  if (!esperada || !recibida) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(recibida)), crypto.subtle.digest("SHA-256", enc.encode(esperada))]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let dif = 0;
  for (let i = 0; i < x.length; i++) dif |= x[i] ^ y[i];
  return dif === 0;
}

export async function onRequestGet({ request, env }) {
  if (!env.DB || !env.PANEL_CLAVE) return json({ ok: false, motivo: "panel_no_configurado" }, 503);
  if (!(await claveCorrecta(request.headers.get("x-clave"), env.PANEL_CLAVE))) {
    await new Promise((r) => setTimeout(r, 800));
    return json({ ok: false, motivo: "clave" }, 401);
  }
  await asegurarEsquema(env.DB);
  const url = new URL(request.url);
  const dias = Math.min(365, Math.max(1, Number(url.searchParams.get("dias")) || 30));
  const desde = new Date(Date.now() - dias * 864e5).toISOString();
  const db = env.DB;
  const q = (sql, ...args) => db.prepare(sql).bind(...args).all().then((r) => r.results || []);

  const [leads, embudo, porDia, fuentes, paises, dispositivos, secciones, preguntas, botones, activaciones] = await Promise.all([
    q("SELECT * FROM leads ORDER BY creado DESC LIMIT 1000"),
    q("SELECT nombre, COUNT(DISTINCT sesion) AS sesiones, COUNT(*) AS veces FROM eventos WHERE creado >= ? GROUP BY nombre ORDER BY sesiones DESC", desde),
    q("SELECT substr(creado,1,10) AS dia, COUNT(DISTINCT sesion) AS sesiones FROM eventos WHERE creado >= ? GROUP BY dia ORDER BY dia", desde),
    q(`SELECT COALESCE(NULLIF(utm_source,''), CASE WHEN referencia IS NULL OR referencia = '' THEN 'directo' ELSE referencia END) AS fuente,
       COUNT(DISTINCT sesion) AS sesiones FROM eventos WHERE creado >= ? AND nombre = 'visita' GROUP BY fuente ORDER BY sesiones DESC LIMIT 25`, desde),
    q("SELECT COALESCE(pais,'?') AS pais, COUNT(DISTINCT sesion) AS sesiones FROM eventos WHERE creado >= ? GROUP BY pais ORDER BY sesiones DESC LIMIT 25", desde),
    q("SELECT dispositivo, COUNT(DISTINCT sesion) AS sesiones FROM eventos WHERE creado >= ? GROUP BY dispositivo ORDER BY sesiones DESC", desde),
    q("SELECT json_extract(datos,'$.seccion') AS seccion, COUNT(DISTINCT sesion) AS sesiones FROM eventos WHERE creado >= ? AND nombre = 'seccion_vista' GROUP BY seccion ORDER BY sesiones DESC", desde),
    q("SELECT json_extract(datos,'$.pregunta') AS pregunta, COUNT(*) AS veces FROM eventos WHERE creado >= ? AND nombre = 'pregunta_abierta' GROUP BY pregunta ORDER BY veces DESC", desde),
    q("SELECT nombre || COALESCE(' · ' || json_extract(datos,'$.ubicacion'), '') AS boton, COUNT(*) AS veces FROM eventos WHERE creado >= ? AND nombre LIKE 'clic_%' GROUP BY boton ORDER BY veces DESC LIMIT 30", desde),
    // Activación calificada: completó el análisis de SU PROPIO archivo (no el ejemplo), por canal de origen.
    q(`SELECT COALESCE(NULLIF(utm_source,''), CASE WHEN referencia IS NULL OR referencia = '' THEN 'directo' ELSE referencia END) AS fuente,
       COUNT(DISTINCT sesion) AS sesiones FROM eventos WHERE creado >= ? AND nombre = 'analisis_completado' AND json_extract(datos,'$.origen') = 'archivo'
       GROUP BY fuente ORDER BY sesiones DESC LIMIT 25`, desde),
  ]);
  return json({ ok: true, dias, leads, embudo, porDia, fuentes, paises, dispositivos, secciones, preguntas, botones, activaciones });
}
