import AnalisisPareto from "./AnalisisPareto.jsx";
import logoPrincipal from "./assets/cimbra-logo-principal.svg";
import logoHorizontal from "./assets/cimbra-logo-horizontal.svg";
import { LANDING as T, WHATSAPP_NUMERO, WHATSAPP_MENSAJE } from "./textos.js";

const YEAR = new Date().getFullYear();
const whatsappUrl = WHATSAPP_NUMERO
  ? "https://wa.me/" + WHATSAPP_NUMERO + "?text=" + encodeURIComponent(WHATSAPP_MENSAJE)
  : null;

const btnCta =
  "inline-block bg-cimbra-amber text-white font-medium rounded-lg hover:opacity-90 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cimbra-dark";

export default function App() {
  return (
    <div className="min-h-screen bg-white text-cimbra-dark font-sans">
      {/* Barra superior */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between">
          <img src={logoHorizontal} alt="Cimbra" className="h-7 w-auto" />
          <nav className="flex items-center gap-4 text-sm">
            <a href="#que-es" className="hidden sm:inline text-gray-600 hover:text-cimbra-dark">Qué es</a>
            <a href="#preguntas" className="hidden sm:inline text-gray-600 hover:text-cimbra-dark">Preguntas</a>
            <a href="#herramienta" className={btnCta + " text-sm px-4 py-1.5 rounded"}>{T.cta}</a>
          </nav>
        </div>
      </header>

      {/* Encabezado: logo, mensaje de 10 segundos, una línea de apoyo y el botón */}
      <section className="bg-[#F7F5F1] blueprint-grid border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-6 md:py-8 flex flex-col items-center text-center">
          <img src={logoPrincipal} alt="Cimbra — inteligencia de costos" className="h-16 w-auto mb-3" />
          <h1 className="text-lg md:text-xl font-semibold leading-snug max-w-xl text-cimbra-dark">
            {T.mensaje10s}
          </h1>
          <p className="mt-2 text-sm text-gray-600 max-w-lg leading-relaxed">{T.apoyo}</p>
          <a href="#herramienta" className={btnCta + " mt-4 px-5 py-2.5"}>{T.cta}</a>
        </div>
      </section>

      {/* Qué es Cimbra: toda la descripción en un solo lugar */}
      <section id="que-es" className="max-w-5xl mx-auto px-4 py-8 scroll-mt-14">
        <h2 className="text-xl font-semibold mb-4 text-center">{T.quienesSomosTitulo}</h2>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 md:p-6">
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-5">
            {T.bloques.map((b, i) => (
              <div key={b.titulo} className={i === 0 ? "md:col-span-2 pb-5 border-b border-gray-200" : ""}>
                <h3 className="text-base font-semibold mb-1.5">{b.titulo}</h3>
                <p className="text-gray-700 text-sm leading-relaxed">{b.texto}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-5 border-t border-gray-200">
            <h3 className="text-base font-semibold mb-1.5">{T.casoTitulo}</h3>
            <div className="grid grid-cols-3 gap-3 my-3">
              {T.casoCifras.map((c) => (
                <div key={c.etiqueta} className="bg-white border border-gray-200 rounded-lg py-2 px-2 text-center">
                  <p className="text-xl md:text-2xl font-semibold text-cimbra-amber leading-tight">{c.valor}</p>
                  <p className="text-xs text-gray-500">{c.etiqueta}</p>
                </div>
              ))}
            </div>
            <p className="text-gray-700 text-sm leading-relaxed">{T.casoTexto}</p>
          </div>
        </div>
      </section>

      {/* La herramienta */}
      <section id="herramienta" className="bg-gray-50 border-t border-gray-100 scroll-mt-14">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <h2 className="text-xl font-semibold mb-2 text-center">{T.herramientaTitulo}</h2>
          <p className="text-gray-500 text-sm text-center mb-8">{T.herramientaTexto}</p>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <AnalisisPareto />
          </div>
        </div>
      </section>

      {/* Preguntas frecuentes */}
      <section id="preguntas" className="max-w-3xl mx-auto px-4 py-10 scroll-mt-14">
        <h2 className="text-xl font-semibold mb-4 text-center">{T.faqTitulo}</h2>
        <div className="divide-y divide-gray-200 border-y border-gray-200">
          {T.faq.map((f) => (
            <details key={f.p} className="group py-3">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-medium text-sm">
                {f.p}
                <span className="text-cimbra-amber text-lg leading-none transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm text-gray-700 leading-relaxed">{f.r}</p>
            </details>
          ))}
        </div>
        {whatsappUrl && (
          <div className="text-center mt-6">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
              className="inline-block border border-cimbra-dark text-cimbra-dark text-sm font-medium px-5 py-2 rounded-lg hover:bg-cimbra-dark hover:text-white transition">
              {T.whatsappTexto}
            </a>
          </div>
        )}
      </section>

      {/* Pie de página */}
      <footer className="py-8 text-center text-sm text-gray-400 border-t border-gray-100">Cimbra · {YEAR}</footer>
    </div>
  );
}
