// Contactos que dejan su correo voluntariamente (p. ej. para descargar el reporte completo).
import { asegurarEsquema, json, limpio, origenPermitido } from "../../servidor/db.js";

const CORREO = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, motivo: "sin_base_de_datos" }, 503);
  if (!origenPermitido(request)) return json({ ok: false }, 403);
  let c;
  try {
    const texto = await request.text();
    if (texto.length > 4000) return json({ ok: false }, 413);
    c = JSON.parse(texto);
  } catch (e) {
    return json({ ok: false }, 400);
  }
  // Campo trampa: las personas no lo ven; los robots lo llenan.
  if (c.sitio_web) return json({ ok: true });
  const correo = (limpio(c.correo, 254) || "").toLowerCase();
  if (!CORREO.test(correo)) return json({ ok: false, motivo: "correo_invalido" }, 400);
  if (c.acepta !== true) return json({ ok: false, motivo: "falta_consentimiento" }, 400);

  await asegurarEsquema(env.DB);
  const utm = c.utm && typeof c.utm === "object" ? c.utm : {};
  // Si la misma persona vuelve a dejar el correo en menos de 10 minutos, no se duplica.
  const reciente = await env.DB.prepare("SELECT id FROM leads WHERE correo = ? AND creado > ? LIMIT 1")
    .bind(correo, new Date(Date.now() - 10 * 60 * 1000).toISOString()).first();
  if (reciente) return json({ ok: true, repetido: true });
  await env.DB.prepare(
    `INSERT INTO leads (creado, nombre, correo, empresa, cargo, pais, telefono, origen, sesion, pais_ip, referencia, utm_source, utm_medium, utm_campaign, utm_content, acepta_comunicaciones)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    new Date().toISOString(), limpio(c.nombre, 100), correo, limpio(c.empresa, 120), limpio(c.cargo, 60), limpio(c.pais, 60),
    limpio(c.telefono, 30), limpio(c.origen, 40), limpio(c.sesion, 40), (request.cf && request.cf.country) || null,
    limpio(c.referencia, 200), limpio(utm.source, 60), limpio(utm.medium, 60), limpio(utm.campaign, 80), limpio(utm.content, 80), c.comunicaciones === true ? 1 : 0
  ).run();
  return json({ ok: true });
}
