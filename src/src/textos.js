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

// Correo de contacto. Mientras esté vacío, no se muestra el recuadro de contacto
// en preguntas frecuentes ni el correo en el pie de página.
export const CORREO_CONTACTO = "contacto@cimbrapro.com";

// Perfil profesional del fundador (se muestra en "Quién está detrás"). Mientras esté vacío, no se muestra el enlace.
export const LINKEDIN_URL = "https://www.linkedin.com/in/carlos-magallanes-construction";

export const LANDING = {
  cta: "Probar gratis",
  etiqueta: "Inteligencia de costos",
  mensaje10s: "Tu software calcula el presupuesto. Cimbra te ayuda a saber dónde mirar.",
  apoyo:
    "Sube tu presupuesto en Excel y descubre en segundos qué partidas concentran el mayor valor económico de la obra, para enfocar tu revisión antes de presentar la oferta.",
  ctaPrincipal: "Probar con mi presupuesto",
  ctaEjemplo: "Ver ejemplo",
  lineaConfianza: "Excel o CSV · Análisis en tu navegador · Tu presupuesto no se sube a ningún servidor",

  pasosTitulo: "De cientos de partidas a una revisión enfocada",
  pasosSubtitulo: "Cimbra trabaja sobre el presupuesto que ya tienes. No tienes que reconstruirlo ni cambiar de software.",
  pasos: [
    { n: "01", titulo: "Sube tu presupuesto", texto: "Importa un archivo Excel o CSV generado desde tu sistema habitual." },
    { n: "02", titulo: "Identifica dónde está el valor", texto: "Cimbra ordena las partidas por peso económico e identifica los Cost Drivers del proyecto." },
    { n: "03", titulo: "Enfoca tu revisión", texto: "Concentra tu atención en las partidas que reúnen la mayor parte del valor antes de comprometerte con la oferta." },
  ],

  casoEtiqueta: "Caso de referencia",
  casoTitulo: "Un presupuesto de 557 partidas no exige revisar las 557 con la misma prioridad.",
  casoCifras: [
    { valor: "557", etiqueta: "partidas con valor" },
    { valor: "105", etiqueta: "concentraban el 80% del presupuesto" },
    { valor: "5,3×", etiqueta: "compresión de revisión" },
  ],
  casoTexto:
    "En uno de los proyectos de mayor envergadura ejecutados por su fundador como Director de Construcción, apenas 105 de 557 partidas (el 19%) concentraban el 80% del valor económico del presupuesto: una compresión de revisión de 5,3 veces.",
  casoDestacado:
    "La partida de mayor peso individual, casi el 10% del presupuesto completo, no era la más evidente a simple vista.",
  casoCta: "Comprobarlo con mi presupuesto",

  nucleoTitulo: "El núcleo de Cimbra",
  nucleoSubtitulo: "Cimbra no revisa por ti: reduce el universo de partidas que merece tu atención.",
  nucleo: [
    { titulo: "Cost Drivers", texto: "Identifica y ordena las partidas que concentran el mayor peso económico del presupuesto." },
    { titulo: "Clasificación A / B / C", texto: "Agrupa las partidas según su aporte acumulado al valor total para facilitar la priorización." },
    { titulo: "Compresión de Revisión", texto: "Mide cuántas veces se reduce el universo de revisión para cubrir el 80% del valor económico." },
  ],

  vistaTitulo: "Mira qué obtendrás antes de subir tu archivo",
  vistaSubtitulo: "El análisis convierte un presupuesto extenso en una vista priorizada para tu revisión. Esta captura usa un presupuesto de ejemplo con datos ficticios.",
  vistaElementos: [
    "Ranking de partidas por peso económico",
    "Cost Drivers y clasificación A / B / C",
    "Línea que marca hasta dónde llega tu revisión",
    "Compresión de Revisión",
    "Peso individual y acumulado de cada partida",
    "Reporte exportable a Excel con gráficos",
  ],
  vistaAlt: "Captura del análisis de un presupuesto de ejemplo: ranking de partidas y gráfico de Cost Drivers",

  complementariosEtiqueta: "Resultados complementarios",
  complementariosTitulo: "Más información a partir del mismo presupuesto",
  complementariosSubtitulo:
    "Una vez identificado dónde está el valor, Cimbra genera referencias iniciales para apoyar la preparación de la oferta. Son aproximaciones tempranas, no reemplazan tu programación detallada.",
  complementarios: [
    { titulo: "Cronograma de Obra", texto: "Una secuencia inicial por fases con su diagrama de Gantt, editable. No sustituye Primavera ni MS Project." },
    { titulo: "Flujo de Caja", texto: "La distribución del dinero en el tiempo, por semana, mes o año, con su curva de avance." },
    { titulo: "Prioridades de Procura", texto: "Las partidas de mayor peso ordenadas según el momento estimado en que se necesitan." },
    { titulo: "Reporte Ejecutivo", texto: "Un resumen de los resultados, listo para revisar y anexar a tu oferta." },
  ],

  herramientaTitulo: "Pruébalo con tu propio presupuesto",
  herramientaTexto:
    "Sube tu presupuesto (Excel o CSV). El archivo nunca se sube a ningún servidor: todo el análisis ocurre en tu navegador. ¿No tienes un archivo a mano? Usa el presupuesto de ejemplo.",

  quienesSomosTitulo: "Cimbra trabaja sobre lo que ya existe",
  problema:
    "En un presupuesto de cientos de partidas no todas pesan igual, pero el tiempo de revisión del profesional sí es limitado.",
  bloques: [
    {
      titulo: "Qué es",
      puntos: [
        "Una herramienta de inteligencia de costos para presupuestos de construcción.",
        "Analiza ofertas y presupuestos ya elaborados, en Excel o exportados de cualquier software.",
        "Ayuda a decidir dónde concentrar la revisión antes de ofertar.",
      ],
    },
    {
      titulo: "Para quién",
      puntos: [
        "Contratistas y gerentes de construcción.",
        "Estimadores y profesionales de costos.",
        "Consultores y pequeñas o medianas empresas que preparan sus propios presupuestos y participan en licitaciones públicas o privadas.",
      ],
    },
    {
      titulo: "Qué NO hace",
      puntos: [
        "No reemplaza tu software de estimación ni sus bases de precios (APU).",
        "No sustituye a Primavera ni a MS Project.",
        "No te dice qué precio poner ni si una partida está bien o mal cotizada.",
        "El criterio profesional sigue siendo tuyo.",
      ],
    },
    {
      titulo: "Por qué es diferente",
      puntos: [
        "No exige migrar de plataforma ni reconstruir el presupuesto.",
        "Funciona con archivos de tu flujo actual, sin importar el programa.",
        "Se coloca como una capa de análisis independiente sobre lo que ya existe.",
      ],
    },
  ],

  fundadorTitulo: "Diseñado desde la experiencia real en construcción",
  fundadorTexto:
    "Cimbra nace de más de dos décadas de experiencia en gerencia, ejecución y estimación de proyectos de construcción. Surge de un problema cotidiano: presupuestos extensos, tiempo limitado de revisión y la necesidad de saber rápido dónde está concentrado el valor económico.",
  fundadorEnlace: "Ver perfil profesional en LinkedIn",

  faqTitulo: "Preguntas frecuentes",
  faq: [
    {
      p: "¿Cimbra reemplaza mi software de presupuesto?",
      r: "No. Cimbra trabaja sobre el presupuesto que ya elaboraste, sin importar el programa. Cimbra te dice dónde mirar; tu software de estimación te permite decidir cómo cambiarlo.",
    },
    {
      p: "¿Qué formato debe tener mi archivo?",
      r: "Excel (.xlsx o .xls) o CSV. Cimbra busca automáticamente una columna con la descripción de la partida (partida, descripción, concepto o actividad) y otra con el monto (total, monto, importe o subtotal). Si el archivo trae una columna de código, también la reconoce. Puedes descargar el archivo de ejemplo para ver el formato. Por ahora no se aceptan archivos PDF.",
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
      p: "¿Qué incluye el reporte en Excel?",
      r: "Una hoja de resumen con el reporte ejecutivo y un gráfico de las partidas de mayor peso, el ranking completo de Cost Drivers con la línea que marca hasta dónde llega tu revisión, el cronograma de obra con su diagrama de Gantt (editable: al cambiar una duración, las demás fases se desplazan), el flujo de caja semanal, mensual y anual con sus gráficos, la curva de avance financiero y las prioridades de procura. Los gráficos vienen dentro del archivo, listos para anexar a tu oferta.",
    },
    {
      p: "¿Cómo se calcula el flujo de caja?",
      r: "Se distribuye el monto de cada fase a lo largo de su duración en el cronograma y se agrupa por semana, mes o año. Es un flujo estimado: mientras más ajustes el cronograma con tus fechas reales, más se acerca a tu proyecto.",
    },
    {
      p: "¿Cuánto cuesta?",
      r: "Por ahora la herramienta está en fase de prueba y no tiene costo.",
    },
  ],
  whatsappTexto: "¿Tienes otra pregunta? Escríbenos",
  correoTitulo: "¿Tu pregunta no está aquí?",
  correoTexto: "Escríbenos a",

  ctaFinalTitulo: "Tu presupuesto ya está hecho. Ahora decide dónde mirar.",
  ctaFinalTexto: "Analízalo con Cimbra y descubre qué partidas concentran el valor económico del proyecto.",
  ctaFinalBoton: "Analizar mi presupuesto",
};
