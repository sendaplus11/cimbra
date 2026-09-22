// Textos de la plataforma Cimbra.
// Todo el contenido visible de la landing y los nombres oficiales de los módulos
// viven aquí, separados del código de los componentes. Cuando llegue la versión
// en inglés, basta con crear un objeto equivalente (por ejemplo `en`) con las
// mismas claves y elegir cuál usar.

// Glosario oficial. Regla: todo en español excepto "Cost Drivers", que es el
// concepto de identidad del producto. La palabra "Pareto" no aparece de cara al usuario.
export const MODULOS = {
  analisisCostos: "Análisis de Costos",
  costDrivers: "Cost Drivers",
  compresionRevision: "Compresión de Revisión",
  cronograma: "Cronograma de Obra",
  flujoCaja: "Flujo de Caja",
  procura: "Prioridades de Procura",
  actividadesCriticas: "Actividades Críticas",
  reporteEjecutivo: "Reporte Ejecutivo",
};

// Número de WhatsApp para el botón de contacto, en formato internacional sin "+",
// espacios ni guiones (ejemplo: "584141234567"). Mientras esté vacío, el botón no se muestra.
export const WHATSAPP_NUMERO = "";
export const WHATSAPP_MENSAJE = "Hola, tengo una pregunta sobre Cimbra.";

export const LANDING = {
  cta: "Probar gratis",
  mensaje10s: "Tu software calcula el presupuesto. Cimbra te ayuda a saber dónde mirar.",
  apoyo:
    "Sube tu presupuesto en Excel y descubre en segundos qué partidas concentran el valor de tu obra, antes de comprometerte con la oferta.",

  quienesSomosTitulo: "Qué es Cimbra",
  bloques: [
    {
      titulo: "Qué es",
      texto:
        "Cimbra es una herramienta de inteligencia de costos para presupuestos de construcción. Toma una oferta o presupuesto ya elaborado (en Excel o exportado desde cualquier software de estimación) y muestra automáticamente dónde está concentrado el valor económico del proyecto, para que el profesional sepa por dónde empezar su revisión antes de comprometerse con una oferta o una decisión.",
    },
    {
      titulo: "Para quién",
      texto:
        "Contratistas, gerentes de construcción y consultores de proyecto, principalmente pequeñas y medianas empresas que preparan sus propios presupuestos y cronogramas (a menudo en Excel, sin Primavera ni MS Project) y participan en licitaciones públicas o privadas.",
    },
    {
      titulo: "Qué problema resuelve",
      texto:
        "En un presupuesto de cientos de partidas, no todas pesan igual, pero el tiempo de revisión de un profesional sí es limitado. Cimbra identifica qué partidas concentran la mayor parte del valor económico (sus Cost Drivers), calcula cuánto se reduce el universo de revisión necesario (Compresión de Revisión) y, a partir de ahí, ayuda a estimar un cronograma de obra y un flujo de caja del proyecto.",
    },
    {
      titulo: "Qué NO hace",
      texto:
        "Cimbra no reemplaza el software de estimación de costos ni sus bases de precios (APU). No reemplaza a Primavera ni a MS Project como motor de programación con dependencias y ruta crítica. No le dice al profesional qué precio poner ni afirma que una partida esté mal cotizada: identifica dónde está el impacto económico y deja el criterio final en manos del profesional.",
    },
    {
      titulo: "Por qué es diferente",
      texto:
        "Cimbra no exige migrar a otra plataforma ni reconstruir el presupuesto desde cero: funciona sobre lo que el profesional ya elaboró, sin importar en qué programa lo hizo. Se coloca como una capa de análisis independiente sobre lo que ya existe.",
    },
  ],
  casoTitulo: "Caso de referencia",
  casoTexto:
    "En uno de los proyectos de mayor envergadura ejecutados por su fundador como Director de Construcción, un presupuesto real de 557 partidas mostró que apenas 105 partidas (el 19% del total) concentraban el 80% del valor económico de la obra, una compresión de revisión de 5,3 veces. La partida de mayor peso individual, casi el 10% del presupuesto completo, no era la más evidente a simple vista.",
  casoCifras: [
    { valor: "557", etiqueta: "partidas con valor" },
    { valor: "105", etiqueta: "concentran el 80%" },
    { valor: "5,3×", etiqueta: "compresión de revisión" },
  ],

  herramientaTitulo: "Compruébalo con tu propio presupuesto",
  herramientaTexto:
    "Sube tu presupuesto (Excel o CSV). El archivo nunca se sube a ningún servidor: todo el análisis ocurre en tu navegador.",

  faqTitulo: "Preguntas frecuentes",
  faq: [
    {
      p: "¿Cimbra reemplaza mi software de presupuesto?",
      r: "No. Cimbra trabaja sobre el presupuesto que ya elaboraste, sin importar el programa. Cimbra te dice dónde mirar; tu software de estimación te permite decidir cómo cambiarlo.",
    },
    {
      p: "¿Qué formato debe tener mi archivo?",
      r: "Excel (.xlsx o .xls) o CSV. Cimbra busca automáticamente una columna con la descripción de la partida (partida, descripción, concepto o actividad) y otra con el monto (total, monto, importe o subtotal). Si el archivo trae una columna de código, también la reconoce. Por ahora no se aceptan archivos PDF.",
    },
    {
      p: "¿Mi presupuesto se envía a algún servidor?",
      r: "No. El archivo se procesa completamente en tu navegador y nunca sale de tu computadora.",
    },
    {
      p: "¿Cimbra me dice cuánto voy a ahorrar?",
      r: "No. Cimbra no promete ahorros ni afirma que una partida esté mal cotizada. Te muestra qué partidas concentran el valor económico para que tu revisión empiece donde más impacto tiene. La decisión sobre precios y alcance siempre es tuya.",
    },
    {
      p: "¿Qué es la Compresión de Revisión?",
      r: "Es el número de partidas totales dividido entre las partidas necesarias para alcanzar el 80% del valor. Por ejemplo, 5,3× significa que revisando una de cada 5,3 partidas cubres el 80% del dinero del proyecto.",
    },
    {
      p: "¿El cronograma sustituye a Primavera o MS Project?",
      r: "No. Es una aproximación temprana por fases, con duraciones en proporción al peso económico de cada fase. No calcula dependencias, holguras ni ruta crítica. Si ya tienes fechas reales, puedes editar el inicio y la duración de cada fase.",
    },
    {
      p: "¿Cómo se calcula el flujo de caja?",
      r: "Se distribuye el monto de cada fase a lo largo de su duración en el cronograma y se agrupa por semana, mes o año. Es un flujo estimado: mientras más ajustes el cronograma con tus fechas reales, más se acerca a tu proyecto.",
    },
  ],
  whatsappTexto: "¿Tienes otra pregunta? Escríbenos",
};
