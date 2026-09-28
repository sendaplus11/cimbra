import { useEffect, useState } from "react";
import AnalisisPareto from "./AnalisisPareto.jsx";
import Legal from "./Legal.jsx";
import Panel from "./Panel.jsx";
import { iniciarMedicion, registrarEvento, observarSecciones } from "./medicion.js";
import logoHero from "./assets/obralyt-web-hero.svg";
import logoHeader from "./assets/obralyt-web-header.svg";
import vistaEjemplo from "./assets/ejemplo-resultado.jpg";
import { LANDING as T, WHATSAPP_NUMERO, WHATSAPP_MENSAJE, CORREO_CONTACTO, LINKEDIN_URL } from "./textos.js";

const YEAR = new Date().getFullYear();
const whatsappUrl = WHATSAPP_NUMERO
  ? "https://wa.me/" + WHATSAPP_NUMERO + "?text=" + encodeURIComponent(WHATSAPP_MENSAJE)
  : null;

// Términos clave que nunca deben partirse entre dos renglones ("Cost / Drivers").
// Se unen con espacio duro y se resaltan en negrita dentro de los textos largos.
const TERMINOS_CLAVE = /(Cost Drivers|Compresión de Revisión)/g;
function Texto({ children }) {
  return String(children)
    .split(TERMINOS_CLAVE)
    .map((parte, i) =>
      i % 2 === 1 ? (
        <strong key={i} className="font-semibold text-obralyt-dark whitespace-nowrap">
          {parte.replace(/ /g, " ")}
        </strong>
      ) : (
        parte
      )
    );
}

// Ícono genérico de LinkedIn (glifo "in" en un cuadrado), usado en el enlace del fundador y el pie.
function IconoLinkedIn({ className }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.11 1 2.48 1s2.5 1.12 2.5 2.5zM.22 8.24h4.5V23H.22V8.24zM8.5 8.24h4.31v2.01h.06c.6-1.13 2.06-2.32 4.24-2.32 4.54 0 5.38 2.99 5.38 6.88V23h-4.5v-6.86c0-1.64-.03-3.74-2.28-3.74-2.29 0-2.64 1.79-2.64 3.63V23H8.5V8.24z" />
    </svg>
  );
}

const btnCta =
  "inline-block bg-obralyt-amber text-white font-medium rounded-lg hover:opacity-90 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obralyt-dark";
const btnSecundario =
  "inline-block border border-obralyt-dark text-obralyt-dark font-medium rounded-lg hover:bg-obralyt-dark hover:text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obralyt-dark";

function usarHash() {
  const [hash, setHash] = useState(typeof window === "undefined" ? "" : window.location.hash);
  useEffect(() => {
    const alCambiar = () => setHash(window.location.hash);
    window.addEventListener("hashchange", alCambiar);
    return () => window.removeEventListener("hashchange", alCambiar);
  }, []);
  return hash;
}

// El botón "Ver ejemplo" le pide a la herramienta que cargue el presupuesto de ejemplo.
function verEjemplo(e, ubicacion) {
  e.preventDefault();
  registrarEvento("clic_ver_ejemplo", { ubicacion });
  window.dispatchEvent(new Event("obralyt:ejemplo"));
}

// Clic en un botón que lleva a la herramienta (se registra desde qué parte de la página).
const clicProbar = (ubicacion) => () => registrarEvento("clic_probar", { ubicacion });

const SECCIONES_MEDIDAS = ["como-funciona", "video", "caso-real", "nucleo", "vista-previa", "herramienta", "complementarios", "que-es", "fundador", "preguntas", "cta-final"];

// Menú de la página: lleva a cada bloque sin tener que desplazarse a ciegas.
// "Cómo funciona" lleva directo al video (la explicación más rápida), sin pasos intermedios.
const MENU = [
  { href: "#video", texto: "Cómo funciona" },
  { href: "#vista-previa", texto: "Qué obtendrás" },
  { href: "#herramienta", texto: "Herramienta" },
  { href: "#que-es", texto: "Qué es" },
  { href: "#preguntas", texto: "Preguntas" },
];

export default function App() {
  const hash = usarHash();
  const [menuAbierto, setMenuAbierto] = useState(false);
  useEffect(() => { setMenuAbierto(false); }, [hash]);
  const esLegal = hash === "#/privacidad" || hash === "#/terminos";
  const esPanel = hash === "#/panel";
  // El panel privado no se mide (así las visitas de Carlos no ensucian las estadísticas).
  useEffect(() => { if (!esPanel) iniciarMedicion(); }, []);
  useEffect(() => {
    if (esPanel) return undefined;
    if (esLegal) {
      registrarEvento("pagina_legal_vista", { pagina: hash.slice(2) });
      return undefined;
    }
    return observarSecciones(SECCIONES_MEDIDAS);
  }, [hash, esLegal]);
  if (esPanel) return <Panel />;
  if (hash === "#/privacidad") return <Legal tipo="privacidad" />;
  if (hash === "#/terminos") return <Legal tipo="terminos" />;

  return (
    <div className="min-h-screen bg-white text-obralyt-dark font-sans">
      {/* Barra superior */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between">
          <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label="Ir al inicio">
            <img src={logoHeader} alt="OBRALYT" className="h-7 sm:h-9 w-auto" />
          </a>
          <nav aria-label="Secciones de la página" className="flex items-center gap-3 sm:gap-4 text-sm">
            {MENU.map((m) => (
              <a key={m.href} href={m.href} className="hidden md:inline text-gray-600 hover:text-obralyt-dark">{m.texto}</a>
            ))}
            <a href="#herramienta" onClick={clicProbar("barra_superior")} className={btnCta + " text-sm px-3 sm:px-4 py-1.5 rounded whitespace-nowrap"}>{T.cta}</a>
            <button type="button" className="md:hidden text-obralyt-dark px-1 text-xl leading-none" aria-expanded={menuAbierto} aria-label="Abrir menú"
              onClick={() => setMenuAbierto((v) => !v)}>{menuAbierto ? "✕" : "☰"}</button>
          </nav>
        </div>
        {menuAbierto && (
          <div className="md:hidden border-t border-gray-100 bg-white">
            {MENU.map((m) => (
              <a key={m.href} href={m.href} onClick={() => setMenuAbierto(false)} className="block px-4 py-3 text-sm text-gray-700 border-b border-gray-50">{m.texto}</a>
            ))}
          </div>
        )}
      </header>

      {/* Encabezado: logo, "inteligencia de costos" legible, mensaje de 10 segundos, apoyo y botones */}
      <section className="bg-[#F7F5F1] blueprint-grid border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-5 md:py-7 flex flex-col items-center text-center">
          <img src={logoHero} alt="OBRALYT" className="h-24 md:h-28 w-auto" />
          <p className="mt-1 flex items-center gap-3 text-obralyt-dark font-semibold uppercase tracking-[0.16em] sm:tracking-[0.22em] text-xs sm:text-sm md:text-base">
            <span aria-hidden="true" className="hidden sm:block h-px w-10 md:w-14 bg-obralyt-amber"></span>
            {T.etiqueta}
            <span aria-hidden="true" className="hidden sm:block h-px w-10 md:w-14 bg-obralyt-amber"></span>
          </p>
          <h1 className="mt-4 text-lg md:text-2xl font-semibold leading-snug max-w-2xl text-balance text-obralyt-dark">
            {T.mensaje10s}
          </h1>
          <p className="mt-2 text-sm md:text-base text-gray-600 max-w-xl leading-relaxed text-balance">{T.apoyo}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <a href="#herramienta" onClick={clicProbar("portada")} className={btnCta + " px-5 py-2.5"}>{T.ctaPrincipal}</a>
            <a href="#herramienta" onClick={(e) => verEjemplo(e, "portada")} className={btnSecundario + " px-5 py-2.5"}>{T.ctaEjemplo}</a>
          </div>
          <p className="mt-3 text-xs text-gray-500 max-w-xl">{T.lineaConfianza}</p>
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="max-w-5xl mx-auto px-4 pt-10 pb-6 scroll-mt-14">
        <h2 className="text-xl font-semibold mb-1 text-center">{T.pasosTitulo}</h2>
        <p className="text-gray-500 text-sm text-center mb-6">{T.pasosSubtitulo}</p>
        <div className="grid md:grid-cols-3 gap-4">
          {T.pasos.map((p) => (
            <div key={p.n} className="border border-gray-200 rounded-xl p-4 bg-white">
              <p className="text-2xl font-semibold text-obralyt-amber leading-none mb-2">{p.n}</p>
              <h3 className="text-base font-semibold mb-1">{p.titulo}</h3>
              <p className="text-sm text-gray-700 leading-relaxed"><Texto>{p.texto}</Texto></p>
            </div>
          ))}
        </div>
      </section>

      {/* Video explicativo */}
      <section id="video" className="bg-[#F7F5F1] border-y border-gray-200 scroll-mt-14">
        <div className="max-w-4xl mx-auto px-4 py-7">
          <h2 className="text-xl font-semibold mb-1 text-center">Mira cómo funciona en un minuto</h2>
          <p className="text-gray-500 text-sm text-center mb-4">Un recorrido real por la herramienta con un presupuesto de ejemplo: de subir el archivo al reporte en Excel.</p>
          <video className="w-full rounded-xl border border-gray-200 shadow-sm bg-white" controls playsInline preload="none"
            poster="/video/obralyt-como-funciona.jpg"
            onPlay={(e) => { if (!e.currentTarget.dataset.medido) { e.currentTarget.dataset.medido = "1"; registrarEvento("video_reproducido"); } }}
            onEnded={() => registrarEvento("video_completado")}>
            <source src="/video/obralyt-como-funciona.mp4?v=audio1" type="video/mp4" />
            Tu navegador no puede reproducir este video.
          </video>
          <p className="text-center mt-4">
            <a href="#herramienta" onClick={clicProbar("video")} className={btnCta + " text-sm px-5 py-2"}>Probar con mi presupuesto</a>
          </p>
        </div>
      </section>

      {/* Caso de referencia: primera prueba concreta */}
      <section id="caso-real" className="max-w-5xl mx-auto px-4 py-8 scroll-mt-14">
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-obralyt-amber mb-1">{T.casoEtiqueta}</p>
          <h2 className="text-lg md:text-xl font-semibold mb-4 text-balance">{T.casoTitulo}</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {T.casoCifras.map((c) => (
              <div key={c.etiqueta} className="bg-white border border-gray-200 rounded-lg py-2 px-2 text-center">
                <p className="text-xl md:text-2xl font-semibold text-obralyt-amber leading-tight">{c.valor}</p>
                <p className="text-xs text-gray-500">{c.etiqueta}</p>
              </div>
            ))}
          </div>
          <p className="text-gray-700 text-sm leading-relaxed"><Texto>{T.casoTexto}</Texto></p>
          <p className="text-gray-700 text-sm leading-relaxed mt-2 font-medium">{T.casoDestacado}</p>
          <a href="#herramienta" onClick={clicProbar("caso_referencia")} className={btnCta + " mt-4 text-sm px-4 py-2"}>{T.casoCta}</a>
        </div>
      </section>

      {/* El núcleo */}
      <section id="nucleo" className="max-w-5xl mx-auto px-4 pb-8">
        <h2 className="text-xl font-semibold mb-1 text-center">{T.nucleoTitulo}</h2>
        <p className="text-gray-500 text-sm text-center mb-6">{T.nucleoSubtitulo}</p>
        <div className="grid md:grid-cols-3 gap-4">
          {T.nucleo.map((f) => (
            <div key={f.titulo} className="border-l-4 border-obralyt-amber bg-white border border-gray-200 rounded-r-xl p-4">
              <h3 className="text-base font-semibold mb-1 whitespace-nowrap">{f.titulo.replace(/ /g, " ")}</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{f.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Qué obtendrás: captura real del resultado */}
      <section id="vista-previa" className="bg-[#F7F5F1] border-y border-gray-200 scroll-mt-14">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <h2 className="text-xl font-semibold mb-1 text-center">{T.vistaTitulo}</h2>
          <p className="text-gray-500 text-sm text-center mb-6 max-w-2xl mx-auto">{T.vistaSubtitulo}</p>
          <div className="grid md:grid-cols-7 gap-6 items-start">
            <ul className="md:col-span-2 space-y-2 text-sm text-gray-700 md:pt-4">
              {T.vistaElementos.map((x) => (
                <li key={x} className="flex gap-2"><span className="text-obralyt-amber font-semibold">✓</span><span><Texto>{x}</Texto></span></li>
              ))}
            </ul>
            <div className="md:col-span-5">
              <a href={vistaEjemplo} target="_blank" rel="noopener noreferrer" title="Abrir la captura en tamaño completo" onClick={() => registrarEvento("captura_ampliada")}>
                <img src={vistaEjemplo} alt={T.vistaAlt} className="w-full rounded-lg border border-gray-200 shadow-sm bg-white" loading="lazy" />
              </a>
              <p className="text-center mt-3">
                <a href="#herramienta" onClick={(e) => verEjemplo(e, "vista_previa")} className={btnSecundario + " text-sm px-4 py-1.5"}>{T.ctaEjemplo} en vivo</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* La herramienta */}
      <section id="herramienta" className="bg-gray-50 border-t border-gray-100 scroll-mt-14">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <h2 className="text-xl font-semibold mb-2 text-center">{T.herramientaTitulo}</h2>
          <p className="text-gray-500 text-sm text-center mb-8 max-w-2xl mx-auto">{T.herramientaTexto}</p>
          {/* Sin overflow-hidden: impediría que la barra de secciones del análisis quede fija al desplazarse. */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <AnalisisPareto />
          </div>
        </div>
      </section>

      {/* Resultados complementarios */}
      <section id="complementarios" className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-obralyt-amber text-center mb-1">{T.complementariosEtiqueta}</p>
        <h2 className="text-xl font-semibold mb-1 text-center">{T.complementariosTitulo}</h2>
        <p className="text-gray-500 text-sm text-center mb-6 max-w-2xl mx-auto">{T.complementariosSubtitulo}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {T.complementarios.map((c) => (
            <div key={c.titulo} className="border border-gray-200 rounded-xl p-4 bg-white">
              <h3 className="text-sm font-semibold mb-1">{c.titulo}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{c.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Qué es OBRALYT: información escaneable */}
      <section id="que-es" className="max-w-5xl mx-auto px-4 py-10 scroll-mt-14">
        <h2 className="text-xl font-semibold mb-2 text-center">{T.quienesSomosTitulo}</h2>
        <p className="text-gray-600 text-sm text-center mb-6 max-w-2xl mx-auto">{T.problema}</p>

        {/* Quién está detrás: primero, para que el enlace de LinkedIn se vea de inmediato al llegar a "Qué es" */}
        <div id="fundador" className="max-w-3xl mx-auto text-center mb-8 pb-8 border-b border-gray-100">
          <h3 className="text-base font-semibold mb-2">{T.fundadorTitulo}</h3>
          <p className="text-sm text-gray-700 leading-relaxed">{T.fundadorTexto}</p>
          {LINKEDIN_URL && (
            <p className="mt-4">
              <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" onClick={() => registrarEvento("clic_linkedin")}
                className={btnSecundario + " inline-flex items-center gap-2 text-sm px-4 py-2"}>
                <IconoLinkedIn className="w-4 h-4" />
                {T.fundadorEnlace}
              </a>
            </p>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {T.bloques.map((b) => (
            <div key={b.titulo} className="bg-gray-50 border border-gray-100 rounded-xl p-4">
              <h3 className="text-base font-semibold mb-2">{b.titulo}</h3>
              <ul className="space-y-1.5 text-sm text-gray-700 leading-relaxed">
                {b.puntos.map((x) => (
                  <li key={x} className="flex gap-2"><span aria-hidden="true" className="text-obralyt-amber">•</span><span><Texto>{x}</Texto></span></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Preguntas frecuentes */}
      <section id="preguntas" className="max-w-3xl mx-auto px-4 py-10 scroll-mt-14">
        <h2 className="text-xl font-semibold mb-4 text-center">{T.faqTitulo}</h2>
        <div className="divide-y divide-gray-200 border-y border-gray-200">
          {T.faq.map((f) => (
            <details key={f.p} className="group py-3" onToggle={(e) => { if (e.currentTarget.open) registrarEvento("pregunta_abierta", { pregunta: f.p }); }}>
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-medium text-sm">
                {f.p}
                <span className="text-obralyt-amber text-lg leading-none transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm text-gray-700 leading-relaxed"><Texto>{f.r}</Texto></p>
            </details>
          ))}
        </div>
        {whatsappUrl && (
          <div className="text-center mt-6">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={() => registrarEvento("clic_whatsapp")}
              className="inline-block border border-obralyt-dark text-obralyt-dark text-sm font-medium px-5 py-2 rounded-lg hover:bg-obralyt-dark hover:text-white transition">
              {T.whatsappTexto}
            </a>
          </div>
        )}
        {CORREO_CONTACTO && (
          <div className="text-center mt-4">
            <p className="text-sm text-gray-500">
              {T.correoTitulo}{" "}
              <a href={"mailto:" + CORREO_CONTACTO} onClick={() => registrarEvento("clic_correo", { ubicacion: "preguntas" })} className="text-obralyt-amber font-medium hover:underline">
                {T.correoTexto} {CORREO_CONTACTO}
              </a>
            </p>
          </div>
        )}
      </section>

      {/* Llamado final */}
      <section id="cta-final" className="bg-[#F7F5F1] border-t border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-10 text-center">
          <h2 className="text-xl md:text-2xl font-semibold mb-2 text-balance">{T.ctaFinalTitulo}</h2>
          <p className="text-sm text-gray-600 mb-4">{T.ctaFinalTexto}</p>
          <a href="#herramienta" onClick={clicProbar("cierre")} className={btnCta + " px-5 py-2.5"}>{T.ctaFinalBoton}</a>
        </div>
      </section>

      {/* Pie de página */}
      <footer className="py-8 text-center text-sm text-gray-400 border-t border-gray-100">
        <p>
          <a href="#/privacidad" className="hover:text-obralyt-dark">Privacidad</a>
          {" "}·{" "}
          <a href="#/terminos" className="hover:text-obralyt-dark">Términos de uso</a>
          {CORREO_CONTACTO && (
            <>
              {" "}·{" "}
              <a href={"mailto:" + CORREO_CONTACTO} onClick={() => registrarEvento("clic_correo", { ubicacion: "pie" })} className="hover:text-obralyt-dark">{CORREO_CONTACTO}</a>
            </>
          )}
          {LINKEDIN_URL && (
            <>
              {" "}·{" "}
              <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" onClick={() => registrarEvento("clic_linkedin", { ubicacion: "pie" })}
                aria-label="LinkedIn de OBRALYT" className="hover:text-obralyt-dark inline-flex items-center align-middle">
                <IconoLinkedIn className="w-4 h-4" />
              </a>
            </>
          )}
        </p>
        <p className="mt-1">OBRALYT · {YEAR}</p>
      </footer>
    </div>
  );
}
