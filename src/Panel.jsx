import { useEffect, useState } from "react";
import logoHeader from "./assets/obralyt-web-header.svg";

// Panel privado (obralyt.com/#/panel): contactos captados y embudo de uso del sitio.
// Los datos solo se entregan con la clave PANEL_CLAVE definida en Cloudflare Pages.

const PASOS_EMBUDO = [
  ["visita", "Visitaron el sitio"],
  ["seccion_vista:herramienta", "Llegaron a la herramienta"],
  ["uso_herramienta", "Usaron la herramienta (archivo o ejemplo)"],
  ["presupuesto_cargado", "Subieron su propio presupuesto"],
  ["clic_descargar_excel", "Pidieron el reporte Excel"],
  ["contacto_registrado", "Dejaron su contacto"],
];

const NOMBRES_EVENTO = {
  visita: "Visita",
  seccion_vista: "Vio una sección",
  ejemplo_cargado: "Usó el presupuesto de ejemplo",
  presupuesto_cargado: "Subió su presupuesto",
  clic_descargar_excel: "Pidió el Excel",
  formulario_contacto_visto: "Vio el formulario de contacto",
  formulario_contacto_cerrado: "Cerró el formulario sin enviar",
  contacto_registrado: "Dejó su contacto",
  reporte_excel_descargado: "Descargó el Excel (su presupuesto)",
  reporte_excel_descargado_ejemplo: "Descargó el Excel (ejemplo)",
  video_reproducido: "Reprodujo el video",
  video_completado: "Vio el video completo",
  nav_resultados: "Usó la barra de resultados",
  tiempo_en_pagina: "Permanencia",
  pregunta_abierta: "Abrió una pregunta frecuente",
  clic_probar: "Clic en «Probar»",
  clic_ver_ejemplo: "Clic en «Ver ejemplo»",
  formato_ejemplo_descargado: "Descargó el formato de ejemplo",
  clic_linkedin: "Clic en LinkedIn",
  clic_correo: "Clic en el correo",
  clic_whatsapp: "Clic en WhatsApp",
  captura_ampliada: "Amplió la captura",
  pagina_legal_vista: "Vio Privacidad o Términos",
};

const fmtFecha = (iso) => {
  try { return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) { return iso; }
};

function aCSV(filas) {
  if (!filas.length) return "";
  const cols = Object.keys(filas[0]);
  const esc = (v) => (v === null || v === undefined ? "" : /[",;\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
  return "﻿" + [cols.join(","), ...filas.map((f) => cols.map((c) => esc(f[c])).join(","))].join("\r\n");
}

function Tabla({ titulo, filas, col1, col2 = "sesiones", etiqueta = (x) => x }) {
  const max = Math.max(1, ...filas.map((f) => f[col2] || 0));
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white">
      <h3 className="text-sm font-semibold mb-2">{titulo}</h3>
      {!filas.length && <p className="text-xs text-gray-400">Sin datos todavía.</p>}
      {filas.map((f, i) => (
        <div key={i} className="flex items-center gap-2 text-xs mb-1">
          <span className="w-40 truncate" title={String(f[col1])}>{etiqueta(f[col1] ?? "—")}</span>
          <div className="flex-1 bg-gray-100 rounded h-2.5"><div className="h-2.5 rounded" style={{ width: (100 * (f[col2] || 0) / max) + "%", background: "#3A5A73" }}></div></div>
          <span className="w-10 text-right tabular-nums">{f[col2]}</span>
        </div>
      ))}
    </div>
  );
}

export default function Panel() {
  const [clave, setClave] = useState(() => { try { return sessionStorage.getItem("obralyt_panel") || ""; } catch (e) { return ""; } });
  const [dias, setDias] = useState(30);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const cargar = async (c = clave, d = dias) => {
    if (!c) return;
    setCargando(true);
    setError("");
    try {
      const r = await fetch("/api/panel/datos?dias=" + d, { headers: { "x-clave": c } });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { setError("Clave incorrecta."); setDatos(null); try { sessionStorage.removeItem("obralyt_panel"); } catch (e) { /* */ } }
      else if (!r.ok) setError(j.motivo === "panel_no_configurado" ? "El panel aún no está configurado en Cloudflare (falta la base de datos o la clave PANEL_CLAVE)." : "No se pudieron cargar los datos.");
      else { setDatos(j); try { sessionStorage.setItem("obralyt_panel", c); localStorage.setItem("obralyt_no_medir", "1"); } catch (e) { /* */ } }
    } catch (e) {
      setError("Sin conexión con el servidor.");
    }
    setCargando(false);
  };
  useEffect(() => { if (clave) cargar(); }, []);

  const valorPaso = (clavePaso) => {
    if (!datos) return 0;
    if (clavePaso === "seccion_vista:herramienta") return (datos.secciones.find((s) => s.seccion === "herramienta") || {}).sesiones || 0;
    if (clavePaso === "uso_herramienta") {
      const e = datos.embudo.find((x) => x.nombre === "ejemplo_cargado");
      const p = datos.embudo.find((x) => x.nombre === "presupuesto_cargado");
      return Math.max((e && e.sesiones) || 0, (p && p.sesiones) || 0);
    }
    const f = datos.embudo.find((x) => x.nombre === clavePaso);
    return f ? f.sesiones : 0;
  };

  const descargarCSV = () => {
    const blob = new Blob([aCSV(datos.leads)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "obralyt-contactos-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 text-obralyt-dark font-sans">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
          <a href="#"><img src={logoHeader} alt="OBRALYT" className="h-8 w-auto" /></a>
          <span className="text-sm font-medium text-gray-500">Panel de marketing</span>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        {!datos && (
          <form onSubmit={(e) => { e.preventDefault(); cargar(); }} className="max-w-sm mx-auto bg-white border border-gray-200 rounded-xl p-5 mt-10">
            <h1 className="text-lg font-semibold mb-3">Acceso al panel</h1>
            <input type="password" autoComplete="current-password" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" placeholder="Clave del panel" value={clave} onChange={(e) => setClave(e.target.value)} />
            {error && <p className="text-xs mt-2 text-red-700">{error}</p>}
            <button className="mt-3 w-full text-sm font-medium text-white rounded px-3 py-2" style={{ background: "#1C2B39" }} disabled={cargando}>{cargando ? "Cargando…" : "Entrar"}</button>
          </form>
        )}
        {datos && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <h1 className="text-xl font-semibold">Resultados de los últimos {dias} días</h1>
              <div className="flex items-center gap-2 text-sm">
                <select className="border border-gray-300 rounded px-2 py-1" value={dias} onChange={(e) => { const d = Number(e.target.value); setDias(d); cargar(clave, d); }}>
                  {[1, 7, 30, 90, 365].map((d) => <option key={d} value={d}>{d === 1 ? "Hoy" : "Últimos " + d + " días"}</option>)}
                </select>
                <button onClick={() => cargar()} className="border border-gray-300 rounded px-3 py-1 bg-white">{cargando ? "…" : "Actualizar"}</button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
              {PASOS_EMBUDO.map(([k, t], i) => {
                const v = valorPaso(k);
                const base = valorPaso(PASOS_EMBUDO[0][0]) || 1;
                return (
                  <div key={k} className="bg-white border border-gray-200 rounded-lg p-3">
                    <p className="text-2xl font-semibold" style={{ color: i === PASOS_EMBUDO.length - 1 ? "#C9922B" : "#1C2B39" }}>{v}</p>
                    <p className="text-xs text-gray-600 leading-snug">{t}</p>
                    {i > 0 && <p className="text-[11px] text-gray-400 mt-1">{Math.round((100 * v) / base)}% de las visitas</p>}
                  </div>
                );
              })}
            </div>

            <section className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h2 className="text-base font-semibold">Contactos (leads) — {datos.leads.length}</h2>
                <button onClick={descargarCSV} disabled={!datos.leads.length} className="text-xs font-medium text-white rounded px-3 py-1.5 disabled:opacity-40" style={{ background: "#C9922B" }}>Descargar CSV (abre en Excel)</button>
              </div>
              {!datos.leads.length && <p className="text-sm text-gray-400">Todavía no hay contactos.</p>}
              {datos.leads.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-gray-500 border-b border-gray-200">
                      {["Fecha", "Nombre", "Correo", "Empresa", "Rol", "País", "WhatsApp", "Llegó desde", "Desde"].map((h) => <th key={h} className="py-1.5 pr-3 font-medium whitespace-nowrap">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {datos.leads.map((l) => (
                        <tr key={l.id} className="border-b border-gray-100">
                          <td className="py-1.5 pr-3 whitespace-nowrap">{fmtFecha(l.creado)}</td>
                          <td className="py-1.5 pr-3">{l.nombre}</td>
                          <td className="py-1.5 pr-3"><a className="underline" href={"mailto:" + l.correo}>{l.correo}</a></td>
                          <td className="py-1.5 pr-3">{l.empresa}</td>
                          <td className="py-1.5 pr-3">{l.cargo}</td>
                          <td className="py-1.5 pr-3">{l.pais || l.pais_ip}</td>
                          <td className="py-1.5 pr-3 whitespace-nowrap">{l.telefono && <a className="underline" href={"https://wa.me/" + l.telefono.replace(/\D/g, "")} target="_blank" rel="noopener noreferrer">{l.telefono}</a>}</td>
                          <td className="py-1.5 pr-3">{l.utm_source || l.referencia || "directo"}{l.utm_campaign ? " · " + l.utm_campaign : ""}</td>
                          <td className="py-1.5 pr-3">{l.origen}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <Tabla titulo="Visitas por día" filas={datos.porDia} col1="dia" />
              <Tabla titulo="De dónde llegan" filas={datos.fuentes} col1="fuente" />
              <Tabla titulo="Hasta dónde leen (secciones vistas)" filas={datos.secciones} col1="seccion" />
              <Tabla titulo="Países" filas={datos.paises} col1="pais" />
              <Tabla titulo="Dispositivos" filas={datos.dispositivos} col1="dispositivo" />
              <Tabla titulo="Botones más usados" filas={datos.botones} col1="boton" col2="veces" />
              <Tabla titulo="Preguntas frecuentes abiertas" filas={datos.preguntas} col1="pregunta" col2="veces" />
              <Tabla titulo="Todas las acciones (visitas únicas)" filas={datos.embudo} col1="nombre" etiqueta={(n) => NOMBRES_EVENTO[n] || n} />
            </div>
            <p className="text-xs text-gray-400">Tus propias visitas desde este navegador ya no se cuentan. Cada visita se cuenta una vez por pestaña abierta. No se registran presupuestos, montos ni nombres de archivo.</p>
          </>
        )}
      </main>
    </div>
  );
}
