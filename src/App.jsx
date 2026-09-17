import AnalisisPareto from "./AnalisisPareto.jsx";
import logoPrincipal from "./assets/cimbra-logo-principal.svg";
import logoHorizontal from "./assets/cimbra-logo-horizontal.svg";

const YEAR = new Date().getFullYear();

export default function App() {
  return (
    <div className="min-h-screen bg-white text-cimbra-dark font-sans">
      {/* Encabezado */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <img src={logoHorizontal} alt="Cimbra" className="h-8 w-auto" />
          <a
            href="#herramienta"
            className="text-sm font-medium bg-cimbra-amber text-white px-4 py-2 rounded hover:opacity-90 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cimbra-dark"
          >
            Probar gratis
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-[#F7F5F1] blueprint-grid border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-10 md:py-14 flex flex-col items-center text-center">
          <img src={logoPrincipal} alt="Cimbra — inteligencia de costos" className="h-24 w-auto mb-5" />
          <h1 className="text-lg md:text-xl font-semibold leading-snug max-w-xl text-cimbra-dark">
            Tu software calcula el presupuesto. Cimbra te ayuda a saber dónde mirar.
          </h1>
          <a
            href="#herramienta"
            className="mt-5 inline-block bg-cimbra-amber text-white font-medium px-5 py-2.5 rounded-lg hover:opacity-90 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cimbra-dark"
          >
            Probar gratis
          </a>
        </div>
      </section>

      {/* Posicionamiento: todo en un solo bloque compacto */}
      <section className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-6 md:p-8">
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold mb-2">Qué es</h2>
            <p className="text-gray-700 text-sm leading-relaxed">
              Cimbra es una herramienta de inteligencia de costos para presupuestos de construcción. Toma
              una oferta o presupuesto ya elaborado (en Excel o exportado desde cualquier software de
              estimación) y muestra automáticamente dónde está concentrado el valor económico del proyecto,
              para que el profesional sepa por dónde empezar su revisión antes de comprometerse con una
              oferta o una decisión.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
            <div>
              <h2 className="text-base font-semibold mb-2">Para quién</h2>
              <p className="text-gray-700 text-sm leading-relaxed">
                Contratistas, gerentes de construcción y consultores de proyecto, principalmente pequeñas y
                medianas empresas que preparan sus propios presupuestos y cronogramas (a menudo en Excel,
                sin Primavera ni MS Project) y participan en licitaciones públicas o privadas. Pensado
                primero para el mercado de construcción en Venezuela, con visión de expandirse a otros
                países de la región y, con el tiempo, a los sectores de petróleo y energía.
              </p>
            </div>
            <div>
              <h2 className="text-base font-semibold mb-2">Qué problema resuelve</h2>
              <p className="text-gray-700 text-sm leading-relaxed">
                En un presupuesto de cientos de partidas, no todas pesan igual, pero el tiempo de revisión
                de un profesional sí es limitado. Cimbra identifica qué partidas concentran la mayor parte
                del valor económico (sus Cost Drivers), calcula cuánto se reduce el universo de revisión
                necesario (Review Compression), y a partir de ahí ayuda a estimar un cronograma de obra y un
                flujo de caja del proyecto, todo antes o durante la ejecución.
              </p>
            </div>
            <div>
              <h2 className="text-base font-semibold mb-2">Qué NO hace</h2>
              <p className="text-gray-700 text-sm leading-relaxed">
                Cimbra no reemplaza el software de estimación de costos ni sus bases de precios (APU). No
                reemplaza a Primavera ni a MS Project como motor de programación con dependencias y ruta
                crítica. No le dice al profesional qué precio poner ni afirma que una partida esté mal
                cotizada: identifica dónde está el impacto económico y deja el criterio final en manos del
                profesional.
              </p>
            </div>
            <div>
              <h2 className="text-base font-semibold mb-2">Por qué es diferente</h2>
              <p className="text-gray-700 text-sm leading-relaxed">
                Cimbra no exige migrar a otra plataforma ni reconstruir el presupuesto desde cero: funciona
                sobre lo que el profesional ya elaboró, sin importar en qué programa lo hizo. No compite con
                los softwares de estimación ni con los sistemas de programación de obra; se coloca como una
                capa de análisis independiente sobre lo que ya existe.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Caso de referencia */}
      <section className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold mb-3">Caso de referencia</h2>
        <p className="text-gray-700 leading-relaxed">
          En uno de los proyectos de mayor envergadura ejecutados por su fundador como Director de
          Construcción, un presupuesto real de 557 partidas mostró que apenas 105 partidas (el 19% del
          total) concentraban el 80% del valor económico de la obra, una compresión de revisión de 5,3
          veces. La partida de mayor peso individual, casi el 10% del presupuesto completo, no era la más
          evidente a simple vista.
        </p>
      </section>

      {/* La herramienta */}
      <section id="herramienta" className="bg-gray-50 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <h2 className="text-xl font-semibold mb-2 text-center">Prueba la herramienta</h2>
          <p className="text-gray-500 text-sm text-center mb-8">
            Sube tu presupuesto (Excel o CSV) o edita las partidas de ejemplo. El archivo nunca se sube a
            ningún servidor: todo el análisis ocurre en tu navegador.
          </p>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <AnalisisPareto />
          </div>
        </div>
      </section>

      {/* Pie de página */}
      <footer className="py-8 text-center text-sm text-gray-400">Cimbra · {YEAR}</footer>
    </div>
  );
}
