import { useEffect, useRef, useState } from "react";
import { idSesion, contextoVisita, registrarEvento } from "./medicion.js";

// Formulario que se muestra al pedir el reporte completo en Excel. Es la forma honesta de
// conocer a quienes usan OBRALYT: la persona deja sus datos a cambio del reporte, sabiendo
// para qué se usarán. El presupuesto analizado NO se envía: solo los datos del formulario.

const CLAVE_LOCAL = "obralyt_contacto";

export function contactoYaRegistrado() {
  try { return Boolean(localStorage.getItem(CLAVE_LOCAL)); } catch (e) { return false; }
}

const CARGOS = [
  "Contratista / dueño de constructora",
  "Ingeniero de costos / estimador",
  "Gerente o director de proyecto",
  "Ingeniero residente / de obra",
  "Consultor / inspector",
  "Arquitecto",
  "Estudiante",
  "Otro",
];
const PAISES = ["Venezuela", "Colombia", "México", "Perú", "Chile", "Argentina", "Ecuador", "Panamá", "República Dominicana", "Costa Rica", "Guatemala", "Bolivia", "Paraguay", "Uruguay", "Estados Unidos", "España", "Otro"];

export default function FormularioContacto({ abierto, onCerrar, onListo, origen }) {
  const [f, setF] = useState({ nombre: "", correo: "", empresa: "", cargo: "", pais: "", telefono: "", acepta: false, sitio_web: "" });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const primerCampo = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    registrarEvento("formulario_contacto_visto", { origen });
    setTimeout(() => primerCampo.current && primerCampo.current.focus(), 50);
    const alTeclear = (e) => { if (e.key === "Escape") cerrar(); };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  if (!abierto) return null;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const cerrar = () => { registrarEvento("formulario_contacto_cerrado", { origen }); onCerrar(); };

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(f.correo.trim())) { setError("Escribe un correo válido."); return; }
    if (!f.acepta) { setError("Para continuar, acepta la política de privacidad."); return; }
    setEnviando(true);
    const { referencia, utm } = contextoVisita();
    let guardado = false;
    try {
      const r = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...f, correo: f.correo.trim(), comunicaciones: f.acepta, origen, sesion: idSesion(), referencia, utm }),
      });
      const datos = await r.json().catch(() => ({}));
      if (r.status === 400 && datos.motivo === "correo_invalido") { setError("Revisa el correo: parece incompleto."); setEnviando(false); return; }
      guardado = r.ok;
    } catch (err) {
      guardado = false;
    }
    // Si el servidor no responde, el reporte se entrega igual: nunca se bloquea al usuario.
    if (guardado) {
      try { localStorage.setItem(CLAVE_LOCAL, new Date().toISOString()); } catch (e2) { /* sin almacenamiento */ }
    }
    registrarEvento(guardado ? "contacto_registrado" : "contacto_no_guardado", { origen });
    setEnviando(false);
    onListo();
  };

  const campo = "w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-gray-500";
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-contacto">
      <div className="absolute inset-0 bg-black/40" onClick={cerrar}></div>
      <form onSubmit={enviar} className="relative bg-white w-full sm:max-w-md rounded-t-xl sm:rounded-xl shadow-xl p-5 max-h-[92vh] overflow-y-auto text-left">
        <button type="button" onClick={cerrar} aria-label="Cerrar" className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-lg leading-none">✕</button>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#C9922B" }}>Reporte completo en Excel</p>
        <h2 id="titulo-contacto" className="text-lg font-semibold mt-1 mb-1" style={{ color: "#1C2B39" }}>¿A quién le enviamos las novedades?</h2>
        <p className="text-xs text-gray-600 mb-4 leading-relaxed">
          El reporte se descarga en cuanto completes el formulario. OBRALYT está en fase de prueba y tus datos nos ayudan a mejorarlo:
          te escribiremos solo sobre OBRALYT (mejoras, nuevas funciones, invitación a dar tu opinión). <strong>Tu presupuesto no se envía</strong>: solo estos datos.
        </p>
        <div className="grid grid-cols-1 gap-3">
          <label className="text-xs text-gray-700">Nombre y apellido
            <input ref={primerCampo} className={campo} value={f.nombre} onChange={set("nombre")} autoComplete="name" maxLength={100} />
          </label>
          <label className="text-xs text-gray-700">Correo electrónico <span className="text-red-600">*</span>
            <input type="email" required className={campo} value={f.correo} onChange={set("correo")} autoComplete="email" maxLength={254} placeholder="tu@empresa.com" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-gray-700">Empresa
              <input className={campo} value={f.empresa} onChange={set("empresa")} autoComplete="organization" maxLength={120} />
            </label>
            <label className="text-xs text-gray-700">País
              <select className={campo} value={f.pais} onChange={set("pais")}>
                <option value="">Elegir…</option>
                {PAISES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
          </div>
          <label className="text-xs text-gray-700">¿Cuál es tu rol?
            <select className={campo} value={f.cargo} onChange={set("cargo")}>
              <option value="">Elegir…</option>
              {CARGOS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-700">WhatsApp <span className="text-gray-400">(opcional)</span>
            <input type="tel" className={campo} value={f.telefono} onChange={set("telefono")} autoComplete="tel" maxLength={30} placeholder="+58 414 1234567" />
          </label>
          {/* Campo trampa para robots: invisible para las personas. */}
          <input type="text" name="sitio_web" tabIndex={-1} autoComplete="off" value={f.sitio_web} onChange={set("sitio_web")} className="hidden" aria-hidden="true" />
          <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={f.acepta} onChange={set("acepta")} />
            <span>Acepto la <a href="#/privacidad" target="_blank" rel="noopener noreferrer" className="underline">política de privacidad</a> y que OBRALYT me contacte sobre el servicio. Puedo darme de baja cuando quiera.</span>
          </label>
        </div>
        {error && <p className="text-xs mt-3" style={{ color: "#b91c1c" }}>{error}</p>}
        <button type="submit" disabled={enviando} className="mt-4 w-full text-sm font-medium text-white rounded-lg px-4 py-2.5 hover:opacity-90 disabled:opacity-60" style={{ background: "#C9922B" }}>
          {enviando ? "Preparando tu reporte…" : "Descargar el reporte"}
        </button>
      </form>
    </div>
  );
}
