// Registro de eventos de navegación (visita, secciones vistas, clics, uso de la herramienta).
import { asegurarEsquema, json, limpio, dispositivo, origenPermitido } from "../../servidor/db.js";

const NOMBRE_VALIDO = /^[a-z0-9_]{2,40}$/;

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, motivo: "sin_base_de_datos" }, 503);
  if (!origenPermitido(request)) return json({ ok: false }, 403);
  let cuerpo;
  try {
    const texto = await request.text();
    if (texto.length > 4000) return json({ ok: false }, 413);
    cuerpo = JSON.parse(texto);
  } catch (e) {
    return json({ ok: false }, 400);
  }
  const eventos = Array.isArray(cuerpo.eventos) ? cuerpo.eventos.slice(0, 20) : [];
  const sesion = limpio(cuerpo.sesion, 40);
  if (!sesion || !/^[a-z0-9-]{8,40}$/i.test(sesion) || !eventos.length) return json({ ok: false }, 400);
  const disp = dispositivo(request);
  if (disp === "bot") return json({ ok: true, ignorado: true });
  const pais = (request.cf && request.cf.country) || null;
  const ref = limpio(cuerpo.referencia, 200);
  const utm = cuerpo.utm && typeof cuerpo.utm === "object" ? cuerpo.utm : {};

  await asegurarEsquema(env.DB);
  const ahora = new Date().toISOString();
  const stmt = env.DB.prepare(
    "INSERT INTO eventos (creado, sesion, nombre, datos, pais, dispositivo, referencia, utm_source, utm_medium, utm_campaign, utm_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const lote = [];
  for (const ev of eventos) {
    const nombre = limpio(ev && ev.n, 40);
    if (!nombre || !NOMBRE_VALIDO.test(nombre)) continue;
    let datos = null;
    if (ev.d && typeof ev.d === "object") {
      const d = {};
      for (const [k, v] of Object.entries(ev.d).slice(0, 5)) {
        if (/^[a-z_]{1,30}$/.test(k) && (typeof v === "string" || typeof v === "number")) d[k] = typeof v === "string" ? limpio(v, 80) : v;
      }
      datos = Object.keys(d).length ? JSON.stringify(d) : null;
    }
    lote.push(stmt.bind(ahora, sesion, nombre, datos, pais, disp, ref, limpio(utm.source, 60), limpio(utm.medium, 60), limpio(utm.campaign, 80), limpio(utm.content, 80)));
  }
  if (lote.length) await env.DB.batch(lote);
  return json({ ok: true, guardados: lote.length });
}
