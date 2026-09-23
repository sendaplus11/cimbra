import { useState } from "react";
import { ComposedChart, BarChart, Bar, Cell, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import * as XLSX from "xlsx-js-style";
import { MODULOS as M } from "./textos.js";
import { ganttXML, barrasYLineaXML, lineaXML, agregarGraficos } from "./excelGraficos.js";

let idCounter = 1;
const newId = () => idCounter++;

const initialPartidas = [];

// Formato numérico en español, igual que la landing ("5,3×", "$1.234.567"):
// coma decimal y punto de miles. Solo afecta lo que se ve en pantalla; los Excel
// exportados guardan números reales y Excel los muestra según la configuración regional del usuario.
const fmtNum = (n) => Math.round(n || 0).toLocaleString("de-DE");
const d1 = (n) => (Number.isFinite(n) ? n : 0).toFixed(1).replace(".", ",");

function truncar(s, n = 70) {
  const str = String(s || "");
  return str.length > n ? str.slice(0, n).trim() + "…" : str;
}

function resumirNombres(items, max, formatFn) {
  const fmtFn = formatFn || ((p) => (p.codigo ? p.codigo + " " : "") + encabezado(p.name));
  const mostrados = items.slice(0, max).map(fmtFn);
  const resto = items.length - max;
  return mostrados.join(" · ") + (resto > 0 ? " · y " + resto + " más" : "");
}

const claseInfo = {
  A: { color: "#b91c1c", bg: "#fee2e2", label: "Clase A — máximo impacto" },
  B: { color: "#92400e", bg: "#fef3c7", label: "Clase B — impacto medio" },
  C: { color: "#374151", bg: "#f3f4f6", label: "Clase C — impacto bajo" },
};

const fasePorClase = {
  A: "Máximo impacto en el presupuesto: valida precios con más de un proveedor, confirma disponibilidad de materiales y rendimientos de cuadrilla antes de cerrar el precio.",
  B: "Impacto medio: confirma el precio con tu proveedor habitual, sin necesidad de un análisis exhaustivo.",
  C: "Bajo impacto individual: usa el precio de referencia disponible sin invertir más tiempo en esta partida.",
};

const NAME_KEYS = ["partida", "descripcion", "descripción", "concepto", "item", "actividad"];
const MOSTRAR_CRITICAL_ACTIVITIES = false;
const MOSTRAR_COST_ANALYSIS = false;
const CODE_KEYS = ["cod", "código", "nº", "no.", "n°"];
const AMOUNT_KEYS_PRIORITY = ["total", "monto", "importe", "subtotal", "costo", "precio"];

function prefijoCodigo(codigo) {
  if (!codigo) return null;
  const partes = String(codigo).trim().split("-");
  if (partes.length <= 1) return null;
  const ultima = partes[partes.length - 1].trim();
  if (/^\d+(\.\d+)?$/.test(ultima)) {
    return partes.slice(0, -1).join("-");
  }
  return codigo;
}

// Textos de una sola celda que NO son capítulos (títulos de columna, totales, etc.).
const NO_ES_CAPITULO = /^(partidas?|descripci[oó]n|[ií]tem|item|total|sub-?total|obra|cliente|servicio|propietario|fecha)\b/i;
// Filas que traen totales, subtotales o impuestos en la columna de descripción: no son partidas.
const FILA_DE_TOTAL = /^\s*(i\.?v\.?a\b|impuesto|sub-?total|total\b)/i;
// Líneas que suelen ser ajustes financieros y no trabajos de obra: se avisan, no se excluyen.
const LINEA_DE_AJUSTE = /variaci[oó]n de precios|escalaci[oó]n|imprevistos|reajuste de precios|contingencias?\b/i;
// Normaliza un texto para comparar descripciones: sin acentos, mayúsculas, sin signos.
function normalizar(t) {
  return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

// "OBRAS CIVILES - ARQUITECTURA (1 al 127)" -> "OBRAS CIVILES - ARQUITECTURA"
function limpiarCapitulo(t) {
  return t.replace(/\s*\(\s*\d+\s*(al|a|-)\s*\d+\s*\)\s*$/i, "").replace(/\s+/g, " ").trim();
}

function encabezado(s, maxFallback = 55) {
  const str = String(s || "").trim();
  const corte = str.indexOf(".");
  if (corte > 5 && corte < 120) return str.slice(0, corte);
  return truncar(str, maxFallback);
}

function findKeyIndex(headerRow, keys) {
  for (let i = 0; i < headerRow.length; i++) {
    const h = String(headerRow[i] || "").toLowerCase().trim();
    if (keys.some((k) => h.includes(k))) return i;
  }
  return -1;
}

function findAmountIndex(headerRow) {
  for (const keyword of AMOUNT_KEYS_PRIORITY) {
    const idx = findKeyIndex(headerRow, [keyword]);
    if (idx !== -1) return idx;
  }
  return -1;
}

const PHASE_KEYWORDS = [
  { phase: "Preliminares y movimiento de tierra", keywords: ["excavacion", "excavación", "movimiento de tierra", "demolicion", "demolición", "replanteo", "fundacion", "fundación", "cimentacion", "cimentación"] },
  { phase: "Estructura y obra civil", keywords: ["concreto", "estructura", "acero", "columna", "viga", "losa", "mamposteria", "mampostería", "pared", "bloque", "vialidad", "pavimento", "asfalto", "tuberia acero", "tubería acero"] },
  { phase: "Instalaciones eléctricas y mecánicas", keywords: ["electric", "eléctric", "cable", "tablero", "transformador", "subestacion", "subestación", "tuberia", "tubería", "sanitari", "mecanic", "mecánic", "instrumentacion", "instrumentación"] },
  { phase: "Acabados y equipos", keywords: ["acabado", "pintura", "piso", "revestimiento", "carpinteria", "carpintería", "equipo", "ventana", "puerta"] },
  { phase: "Pruebas, señalización y cierre", keywords: ["prueba", "señalizacion", "señalización", "documentacion", "documentación", "entrega", "puesta en servicio", "epp", "cerramiento"] },
];
const PHASE_ORDER = PHASE_KEYWORDS.map((p) => p.phase).concat(["Otras partidas"]);

function classifyPhase(name) {
  const n = String(name || "").toLowerCase();
  for (const { phase, keywords } of PHASE_KEYWORDS) {
    if (keywords.some((k) => n.includes(k))) return phase;
  }
  return "Otras partidas";
}

function CostDriverTooltip({ active, payload, fmt }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 10px", fontSize: 12, maxWidth: 280, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
      {p.codigo && <div style={{ color: "#6B7680", fontFamily: "monospace", fontSize: 11, marginBottom: 2 }}>{p.codigo}</div>}
      <div style={{ fontWeight: 500, marginBottom: 4 }}>{p.name}</div>
      <div style={{ color: "#374151" }}>{fmt(p.monto)} · {d1(p.pctInd)}% individual · {d1(p.pctAcum)}% acumulado</div>
    </div>
  );
}

export default function AnalisisPareto() {
  const [partidas, setPartidas] = useState(initialPartidas);
  const [umbralA, setUmbralA] = useState(80);
  const [umbralB, setUmbralB] = useState(90);
  const [plazoTotal, setPlazoTotal] = useState(null);
  const [unidadTiempo, setUnidadTiempo] = useState("meses");
  const [periodicidad, setPeriodicidad] = useState("mensual");
  const [inicioManual, setInicioManual] = useState({});
  const [duracionManual, setDuracionManual] = useState({});
  const [topN, setTopN] = useState("80");
  const [importError, setImportError] = useState("");
  const [importInfo, setImportInfo] = useState("");
  // Moneda detectada en el archivo ("Bs. ", "$"). Si el archivo no la indica, no se muestra ningún símbolo.
  const [moneda, setMoneda] = useState("");
  // Solape entre fases del cronograma, en % de la duración de la fase anterior. Lo decide el usuario.
  const [solape, setSolape] = useState(0);
  // Cuando el archivo trae líneas de ajuste (variación de precios, imprevistos), el usuario elige si entran al análisis.
  const [excluirAjustes, setExcluirAjustes] = useState(false);
  // Avisos de lectura del archivo: partidas sin monto y total declarado en el propio archivo.
  const [avisos, setAvisos] = useState({ sinMonto: 0, totalArchivo: null });
  const fmt = (n) => moneda + fmtNum(n);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportError("");
    setImportInfo("");
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
        if (!rows || rows.length < 2) {
          setImportError("El archivo no tiene filas suficientes.");
          return;
        }
        let headerRowIdx = 0;
        let nameIdx = findKeyIndex(rows[0], NAME_KEYS);
        let amountIdx = findAmountIndex(rows[0]);
        if (nameIdx === -1 || amountIdx === -1) {
          for (let r = 0; r < Math.min(20, rows.length); r++) {
            const ni = findKeyIndex(rows[r], NAME_KEYS);
            const ai = findAmountIndex(rows[r]);
            if (ni !== -1 && ai !== -1) {
              headerRowIdx = r;
              nameIdx = ni;
              amountIdx = ai;
              break;
            }
          }
        }
        if (nameIdx === -1 || amountIdx === -1) {
          setImportError("No se detectaron columnas de partida y monto. Verifica los encabezados del archivo.");
          return;
        }
        let codigoIdx = -1;
        const headerRow = rows[headerRowIdx];
        for (let i = 0; i < headerRow.length; i++) {
          if (i === nameIdx || i === amountIdx) continue;
          const h = String(headerRow[i] || "").toLowerCase().trim();
          if (CODE_KEYS.some((k) => h.includes(k))) { codigoIdx = i; break; }
        }

        // Capítulos del archivo: filas con una sola celda de texto (a la izquierda de la descripción
        // o en ella) y sin monto. Si hay varios niveles, el capítulo es el nivel superior.
        const esEncabezado = (row) => {
          const celdas = [];
          row.forEach((c, j) => { if (c !== null && c !== undefined && String(c).trim() !== "") celdas.push([j, c]); });
          if (celdas.length !== 1) return null;
          const [j, c] = celdas[0];
          const texto = String(c).trim();
          if (typeof c !== "string" || j > nameIdx || texto.length < 4 || NO_ES_CAPITULO.test(texto)) return null;
          return { col: j, texto: limpiarCapitulo(texto) };
        };
        const encabezados = new Map();
        for (let r = headerRowIdx + 1; r < rows.length; r++) {
          if (!rows[r]) continue;
          const h = esEncabezado(rows[r]);
          if (h) encabezados.set(r, h);
        }
        const colTope = encabezados.size ? Math.min(...[...encabezados.values()].map((h) => h.col)) : -1;

        const nuevas = [];
        let sinMonto = 0;
        let capituloActual = null;
        for (let r = headerRowIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;
          const enc = encabezados.get(r);
          if (enc) {
            if (enc.col === colTope) capituloActual = enc.texto;
            continue;
          }
          const name = row[nameIdx];
          const amountRaw = row[amountIdx];
          const amount = typeof amountRaw === "number" ? amountRaw : parseFloat(String(amountRaw || "").replace(/[^0-9.-]/g, ""));
          const nombreLimpio = name ? String(name).trim().replace(/^descripci[oó]n\s*:\s*/i, "") : "";
          // Filas de totales, subtotales o impuestos que algunos presupuestos traen en la columna de descripción.
          if (!nombreLimpio || FILA_DE_TOTAL.test(nombreLimpio)) continue;
          const codigo = codigoIdx !== -1 && row[codigoIdx] ? String(row[codigoIdx]).trim() : null;
          // Partida escrita en el archivo pero con monto cero: puede ser una omisión del presupuesto.
          if (amount === 0 && (codigo || typeof row[0] === "number")) { sinMonto += 1; continue; }
          if (isNaN(amount) || amount <= 0) continue;
          nuevas.push({
            id: newId(), orden: nuevas.length, name: nombreLimpio, monto: amount, codigo,
            capitulo: capituloActual, categoria: codigo ? prefijoCodigo(codigo) : null,
            esAjuste: LINEA_DE_AJUSTE.test(nombreLimpio),
          });
        }
        if (nuevas.length === 0) {
          setImportError("No se encontraron partidas válidas en el archivo.");
          return;
        }
        // ¿Sirven los capítulos del archivo? Deben ser al menos 2 y agrupar en promedio 2 o más partidas.
        const capitulosDistintos = new Set(nuevas.map((p) => p.capitulo).filter(Boolean));
        const usarCapitulos = capitulosDistintos.size >= 2 && nuevas.length / capitulosDistintos.size >= 2;
        nuevas.forEach((p) => {
          if (usarCapitulos) p.categoria = p.capitulo || "Otras partidas";
        });

        // Total declarado por el propio archivo (fila de "Total"): sirve para confirmar la lectura.
        const totalImportado = nuevas.reduce((s, p) => s + p.monto, 0);
        let totalArchivo = null;
        let filasRevisadas = 0;
        for (let r = rows.length - 1; r >= 0 && totalArchivo === null && filasRevisadas < 40; r--) {
          const row = rows[r];
          if (!row || !row.some((c) => c !== null && c !== undefined && String(c).trim() !== "")) continue;
          filasRevisadas += 1;
          const hayEtiqueta = row.some((c) => typeof c === "string" && /total|sub-?total/i.test(c));
          if (!hayEtiqueta) continue;
          for (const c of row) {
            if (typeof c === "number" && c > 0 && Math.abs(c - totalImportado) / totalImportado < 0.005) { totalArchivo = c; break; }
          }
        }
        setAvisos({ sinMonto, totalArchivo });
        setExcluirAjustes(false);
        setSolape(0);

        const textoContexto = rows.slice(0, headerRowIdx + 1).concat(rows.slice(-25)).flat().filter((c) => typeof c === "string").join(" ");
        const monedaDetectada = /(^|[^a-zñ])bs\.?([^a-zñ]|$)|bol[ií]vares\b/i.test(textoContexto) ? "Bs. " : /US\$|\bUSD\b|\bd[oó]lares\b|\(\$\)|\$\s*\d/i.test(textoContexto) ? "$" : "";
        setMoneda(monedaDetectada);

        setPartidas(nuevas);
        setPlazoTotal(null);
        setInicioManual({});
        setDuracionManual({});
        const totalCategorias = new Set(nuevas.map((p) => p.categoria).filter(Boolean)).size;
        const ajustes = nuevas.filter((p) => p.esAjuste);
        const otrasHojas = wb.SheetNames.slice(1).filter((n) => {
          const ref = wb.Sheets[n] && wb.Sheets[n]["!ref"];
          if (!ref) return false;
          const rg = XLSX.utils.decode_range(ref);
          return rg.e.r - rg.s.r >= 5;
        });
        setImportInfo(
          nuevas.length + " partidas importadas correctamente." +
          (totalArchivo !== null ? " La suma coincide con el total indicado en el archivo." : "") +
          (totalCategorias > 1 ? " Se detectaron " + totalCategorias + " capítulos propios del archivo y se usarán para agrupar el " + M.cronograma + "." : "") +
          (sinMonto ? " " + sinMonto + (sinMonto === 1 ? " partida del archivo no tiene monto y quedó fuera del análisis" : " partidas del archivo no tienen monto y quedaron fuera del análisis") + "; revisa si es una omisión del presupuesto." : "") +
          (ajustes.length
            ? " Atención: " + ajustes.length + (ajustes.length === 1 ? " línea parece un ajuste" : " líneas parecen ajustes") + " y no un trabajo de obra («" + ajustes.map((p) => truncar(p.name, 40)).join("», «") + "», " + d1((ajustes.reduce((s, p) => s + p.monto, 0) / totalImportado) * 100) + "% del total); se incluye en el análisis, revísala."
            : "") +
          (otrasHojas.length ? " El archivo tiene otras hojas con datos (" + otrasHojas.join(", ") + "); se analizó solo la primera («" + wb.SheetNames[0] + "»)." : "")
        );
      } catch (err) {
        setImportError("No se pudo leer el archivo. Verifica que sea un Excel o CSV válido.");
      }
    };
    reader.readAsArrayBuffer(file);
  };


  const lineasDeAjuste = partidas.filter((p) => p.esAjuste);
  const partidasActivas = excluirAjustes ? partidas.filter((p) => !p.esAjuste) : partidas;
  const total = partidasActivas.reduce((s, p) => s + p.monto, 0);

  const ordenadas = [...partidasActivas].sort((a, b) => b.monto - a.monto);
  let acumulado = 0;
  const conAcumulado = ordenadas.map((p, i) => {
    acumulado += p.monto;
    const pctInd = total ? (p.monto / total) * 100 : 0;
    const pctAcum = total ? (acumulado / total) * 100 : 0;
    return { ...p, rank: i + 1, pctInd, pctAcum };
  });
  // La clase A son las partidas necesarias para ALCANZAR el umbral (incluye la que lo cruza),
  // igual que en la Compresión de Revisión: así todos los conteos de la pantalla coinciden.
  const partidasHasta = (umbral) => {
    for (let i = 0; i < conAcumulado.length; i++) {
      if (conAcumulado[i].pctAcum >= umbral) return i + 1;
    }
    return conAcumulado.length;
  };
  const nClaseA = partidasHasta(umbralA);
  const nClaseB = Math.max(nClaseA, partidasHasta(umbralB));
  const analizadas = conAcumulado.map((p, i) => ({
    ...p,
    clase: i < nClaseA ? "A" : i < nClaseB ? "B" : "C",
    nombreCorto: (p.codigo ? p.codigo + " " : "") + encabezado(p.name, 26),
  }));

  const porClase = { A: [], B: [], C: [] };
  analizadas.forEach((p) => porClase[p.clase].push(p));

  const n80 = partidasHasta(80);
  const n90 = partidasHasta(90);
  const pct80DePartidas = analizadas.length ? (n80 / analizadas.length) * 100 : 0;
  const reviewCompression = n80 > 0 ? analizadas.length / n80 : 0;

  const partidasMostradas = topN === "todos" ? analizadas : analizadas.slice(0, topN === "90" ? n90 : n80);
  const pctCubierto = partidasMostradas.length ? partidasMostradas[partidasMostradas.length - 1].pctAcum : 0;

  // Familias: partidas que comparten el mismo código en el archivo (o, sin códigos, la misma
  // descripción). Una familia puede pesar mucho sin que ninguna de sus partidas destaque sola.
  const familiasMap = new Map();
  analizadas.forEach((p) => {
    const clave = p.codigo ? "cod:" + p.codigo.toUpperCase() : "des:" + normalizar(encabezado(p.name, 60));
    if (!familiasMap.has(clave)) {
      familiasMap.set(clave, { clave, etiqueta: p.codigo ? p.codigo : encabezado(p.name, 60), nombre: encabezado(p.name, 60), monto: 0, partidas: [] });
    }
    const f = familiasMap.get(clave);
    f.monto += p.monto;
    f.partidas.push(p);
  });
  const todasLasFamilias = [...familiasMap.values()]
    .filter((f) => f.partidas.length > 1)
    .map((f) => ({ ...f, pct: total ? (f.monto / total) * 100 : 0, mejorRank: Math.min(...f.partidas.map((p) => p.rank)) }))
    .sort((a, b) => b.monto - a.monto);
  // Una familia que pesa más que la mayor partida individual es justo lo que el ranking por partida no muestra.
  const familiaDestacada = todasLasFamilias.find((f) => analizadas.length && f.monto > analizadas[0].monto) || null;
  // Solo se muestran si aportan algo: o hay una familia que supera a la mayor partida, o alguna pesa 3% o más.
  const familias = familiaDestacada || (todasLasFamilias[0] && todasLasFamilias[0].pct >= 3) ? todasLasFamilias.filter((f) => f.pct >= 0.5) : [];

  const usaCategoriasReales = analizadas.some((p) => p.categoria);
  const categoriasUnicas = new Set(analizadas.map((p) => p.categoria).filter(Boolean)).size;
  const usarCapitulosParaSchedule = usaCategoriasReales && categoriasUnicas > 1;
  let fasesOrdenadas;
  if (usarCapitulosParaSchedule) {
    const fasesMap = {};
    const fasesAppearanceOrder = [];
    analizadas.forEach((p) => {
      const ph = p.categoria || "Sin categoría en el archivo";
      if (!fasesMap[ph]) {
        fasesMap[ph] = { key: "c:" + ph, name: ph, monto: 0, partidas: [] };
        fasesAppearanceOrder.push(ph);
      }
      fasesMap[ph].monto += p.monto;
      fasesMap[ph].partidas.push(p);
    });
    // Los capítulos se ordenan como aparecen en el archivo original (orden constructivo del
    // presupuesto), no por monto: el cronograma debe respetar la secuencia de obra.
    const primeraAparicion = (ph) => Math.min(...fasesMap[ph].partidas.map((p) => p.orden ?? 0));
    fasesOrdenadas = fasesAppearanceOrder.sort((x, y) => primeraAparicion(x) - primeraAparicion(y)).map((ph) => fasesMap[ph]);
  } else {
    // Sin capítulos reales, o con un único capítulo que abarca todo el presupuesto:
    // no tiene sentido agrupar, cada partida aparece en el cronograma con su propio peso económico,
    // en el mismo orden del archivo (que normalmente sigue la secuencia constructiva), no por monto.
    fasesOrdenadas = [...analizadas]
      .sort((x, y) => (x.orden ?? 0) - (y.orden ?? 0))
      .map((p) => ({
        key: "p:" + p.id,
        name: (p.codigo ? p.codigo + " " : "") + encabezado(p.name, 45),
        monto: p.monto,
        partidas: [p],
      }));
    // Partidas distintas con el mismo texto (p. ej. tuberías de varios diámetros): se numeran.
    const repetidos = {};
    fasesOrdenadas.forEach((f) => (repetidos[f.name] = (repetidos[f.name] || 0) + 1));
    const contados = {};
    fasesOrdenadas.forEach((f) => {
      if (repetidos[f.name] > 1) {
        contados[f.name] = (contados[f.name] || 0) + 1;
        f.name = f.name + " (" + contados[f.name] + "/" + repetidos[f.name] + ")";
      }
    });
  }
  // Duración mínima por fase: una semana, salvo que haya tantas fases que ni siquiera quepan;
  // así se evitan fases de "0,3 semanas" que ningún profesional puede ejecutar.
  const nFases = fasesOrdenadas.length || 1;
  const minDias = plazoTotal ? Math.min(7, plazoTotal / nFases) : 1;
  const factorSolape = 1 - solape / 100;
  let huboMinimo = false;
  // Duración proporcional al peso económico, con mínimo, y reescalada para que el conjunto
  // termine en el plazo indicado por el usuario (el solape acorta el calendario, no las fases).
  const duracionesBase = fasesOrdenadas.map((f) => {
    const pct = total ? f.monto / total : 0;
    const d = pct * (plazoTotal || 0);
    if (plazoTotal && d < minDias) huboMinimo = true;
    return Math.max(minDias, d);
  });
  let cursorProv = 0;
  const provisional = duracionesBase.map((d, i) => {
    const ini = cursorProv;
    cursorProv = ini + d * factorSolape;
    return { ini, d };
  });
  const spanProv = provisional.length ? provisional[provisional.length - 1].ini + provisional[provisional.length - 1].d : 0;
  const escala = plazoTotal && spanProv > 0 ? plazoTotal / spanProv : 1;

  let cursorDia = 0;
  const cronograma = fasesOrdenadas.map((f, i) => {
    const pct = total ? f.monto / total : 0;
    const diasAuto = Math.max(1, Math.round(duracionesBase[i] * escala));
    const esManualDuracion = duracionManual[f.key] !== undefined;
    const dias = esManualDuracion ? Math.max(1, duracionManual[f.key]) : diasAuto;
    const inicioAuto = Math.round(cursorDia);
    const esManualInicio = inicioManual[f.key] !== undefined;
    const inicio = esManualInicio ? inicioManual[f.key] : inicioAuto;
    cursorDia = inicio + dias * factorSolape;
    return { ...f, pct, dias, diasAuto, inicio, inicioAuto, esManualInicio, esManualDuracion, fin: inicio + dias };
  });
  const domainMax = Math.max(plazoTotal, ...cronograma.map((f) => f.fin), 1);
  // El motor calcula siempre en días; las unidades solo cambian la presentación.
  // Mes = 30 días y año = 365 días, igual que en el Flujo de Caja.
  const DIAS_UNIDAD = { semanas: 7, meses: 30, "años": 365 };
  const NOMBRE_UNIDAD = { semanas: "semanas", meses: "meses", "años": "años" };
  const aniosDisponible = plazoTotal === null || plazoTotal >= 365;
  const unidadEfectiva = unidadTiempo === "años" && !aniosDisponible ? "meses" : unidadTiempo;
  const diasPorUnidad = DIAS_UNIDAD[unidadEfectiva];
  const unidadLabel = NOMBRE_UNIDAD[unidadEfectiva];
  const aUnidad = (dias) => Math.round((dias / diasPorUnidad) * 10) / 10;
  const aDias = (valorUnidad) => Math.round(valorUnidad * diasPorUnidad);
  // La edición por fase siempre es en semanas: nadie planifica una fase de "1,4 meses".
  const aSemanas = (dias) => Math.round((dias / 7) * 10) / 10;
  const semanasADias = (sem) => Math.round(sem * 7);
  const semanaDeDia = (dia) => Math.floor(dia / 7) + 1;
  const plazoTexto = (dias) => aUnidad(dias).toLocaleString("es") + " " + unidadLabel;
  const cronogramaDisplay = cronograma.map((f) => ({ ...f, inicio: aUnidad(f.inicio), dias: aUnidad(f.dias) }));

  function calcularFlujo(periodDays, label) {
    const n = Math.max(1, Math.ceil(plazoTotal / periodDays));
    const filas = [];
    let acum = 0;
    for (let i = 0; i < n; i++) {
      const pStart = i * periodDays;
      const pEnd = Math.min(plazoTotal, (i + 1) * periodDays);
      let montoPeriodo = 0;
      cronograma.forEach((f) => {
        const dailyRate = f.dias > 0 ? f.monto / f.dias : 0;
        const overlap = Math.max(0, Math.min(f.fin, pEnd) - Math.max(f.inicio, pStart));
        montoPeriodo += overlap * dailyRate;
      });
      acum += montoPeriodo;
      filas.push({ periodo: label + " " + (i + 1), monto: montoPeriodo, pctAcum: total ? (acum / total) * 100 : 0 });
    }
    return filas;
  }

  const periodDays = periodicidad === "semanal" ? 7 : periodicidad === "mensual" ? 30 : 365;
  const periodLabel = periodicidad === "semanal" ? "Semana" : periodicidad === "mensual" ? "Mes" : "Año";
  const flujoCaja = calcularFlujo(periodDays, periodLabel);
  const numPeriodos = flujoCaja.length;

  const costoPorFase = [...cronograma].sort((a, b) => b.monto - a.monto);

  const faseInicioMap = {};
  const faseNombreMap = {};
  cronograma.forEach((f) => { faseInicioMap[f.key] = f.inicio; faseNombreMap[f.key] = f.name; });

  const analizadasConFase = analizadas.map((p) => {
    const faseKey = usarCapitulosParaSchedule ? "c:" + (p.categoria || "Sin categoría en el archivo") : "p:" + p.id;
    const fase = faseNombreMap[faseKey] ?? "";
    const inicioFase = faseInicioMap[faseKey] ?? 0;
    const urgencia = plazoTotal ? 1 - inicioFase / plazoTotal : 0;
    const criticidad = p.pctInd * 0.7 + urgencia * 100 * 0.3;
    return { ...p, fase, inicioFase, criticidad };
  });

  const actividadesCriticas = [...analizadasConFase].sort((a, b) => b.criticidad - a.criticidad).slice(0, 5);

  const prioridadesCompra = analizadasConFase
    .filter((p) => p.clase === "A" || p.clase === "B")
    .sort((a, b) => a.inicioFase - b.inicioFase);

  const picoFlujo = flujoCaja.length ? flujoCaja.reduce((max, f) => (f.monto > max.monto ? f : max), flujoCaja[0]) : null;

  const hayPlazo = plazoTotal !== null && plazoTotal > 0;
  const primeraClaseA = analizadas.find((p) => p.clase === "A");

  // Texto del Reporte Ejecutivo: el mismo en pantalla y en el Excel.
  const textoEjecutivo = [
    "El presupuesto analizado asciende a " + fmt(total) + ", distribuido en " + analizadas.length + " partidas y " + cronograma.length + " fases constructivas" + (hayPlazo ? ", con un plazo estimado de " + plazoTexto(plazoTotal) : " (plazo aún no definido en " + M.cronograma + ")") + ".",
    "Este presupuesto tiene una " + M.compresionRevision + " de " + d1(reviewCompression) + "×: " + n80 + " partidas (" + pct80DePartidas.toFixed(0) + "%) explican el 80% del valor total.",
    porClase.A.length + " partidas de clase A concentran la mayor parte del impacto financiero y deben revisarse con prioridad" + (primeraClaseA ? ", siendo \"" + encabezado(primeraClaseA.name, 60) + "\" la de mayor peso individual." : "."),
    hayPlazo && picoFlujo ? "El período de mayor exigencia de flujo de caja es " + picoFlujo.periodo + ", con un desembolso estimado de " + fmt(picoFlujo.monto) + "." : null,
    hayPlazo && prioridadesCompra.length > 0 ? "La primera orden de compra a colocar es \"" + encabezado(prioridadesCompra[0].name, 60) + "\", requerida desde la semana " + semanaDeDia(prioridadesCompra[0].inicioFase) + "." : null,
  ].filter(Boolean).join(" ");

  const NAVY = "1C2B39";
  const AMBAR = "C9922B";
  const borde = { style: "thin", color: { rgb: "D1D5DB" } };
  const bordes = { top: borde, bottom: borde, left: borde, right: borde };
  const estiloEncabezado = {
    font: { bold: true, color: { rgb: "FFFFFF" }, name: "Arial", sz: 10 },
    fill: { patternType: "solid", fgColor: { rgb: NAVY } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: bordes,
  };
  const estiloClase = {
    A: { font: { bold: true, color: { rgb: "B91C1C" } }, fill: { patternType: "solid", fgColor: { rgb: "FEE2E2" } } },
    B: { font: { bold: true, color: { rgb: "92400E" } }, fill: { patternType: "solid", fgColor: { rgb: "FEF3C7" } } },
    C: { font: { bold: true, color: { rgb: "374151" } }, fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } } },
  };
  const FMT_MONTO = moneda ? '"' + moneda + '"#,##0' : "#,##0";
  const FMT_PCT = "0.0%";

  const estilar = (ws, r, c, extra) => {
    const a = XLSX.utils.encode_cell({ r, c });
    if (!ws[a]) return;
    ws[a].s = { ...(ws[a].s || {}), ...extra };
  };

  // Hoja de tabla: encabezado de marca, anchos, formatos numéricos y filtro.
  // `formatos` asigna un formato de número por índice de columna.
  const hojaTabla = (encabezados, filas, anchos, formatos = {}, colClase = -1) => {
    const ws = XLSX.utils.aoa_to_sheet([encabezados, ...filas]);
    ws["!cols"] = anchos.map((wch) => ({ wch }));
    ws["!rows"] = [{ hpt: 30 }];
    encabezados.forEach((_, c) => estilar(ws, 0, c, estiloEncabezado));
    filas.forEach((fila, i) => {
      fila.forEach((valor, c) => {
        const a = XLSX.utils.encode_cell({ r: i + 1, c });
        if (!ws[a]) return;
        if (formatos[c]) ws[a].z = formatos[c];
        if (c === 0 && typeof valor === "number") ws[a].s = { alignment: { horizontal: "center" } };
        if (c === colClase && estiloClase[valor]) {
          ws[a].s = { ...estiloClase[valor], alignment: { horizontal: "center" } };
        }
      });
    });
    if (filas.length) {
      ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length, c: encabezados.length - 1 } }) };
    }
    return ws;
  };

  // Un texto de celda no puede pasar de 32.767 caracteres: se resume la lista de partidas por fase.
  const listaPartidas = (partidas) => resumirNombres(partidas, 25, (p) => (p.codigo ? p.codigo + " " : "") + encabezado(p.name, 60));

  const colLetra = (i) => XLSX.utils.encode_col(i);

  const handleExport = () => {
    const fecha = new Date().toLocaleDateString("es", { year: "numeric", month: "long", day: "numeric" });
    const wb = XLSX.utils.book_new();
    const graficos = [];

    // --- Hoja 1: Resumen (con el gráfico de las partidas de mayor peso) ---
    const filasResumen = [];
    const fila = (...celdas) => { filasResumen.push(celdas); return filasResumen.length - 1; };
    const rTitulo = fila("Cimbra — Inteligencia de costos");
    const rSubtitulo = fila("Reporte de análisis de presupuesto · " + fecha);
    fila();
    const rDatos1 = fila("Total analizado (suma de las partidas, sin IVA)", total);
    fila("Partidas con valor", analizadas.length);
    fila(M.compresionRevision, Number(reviewCompression.toFixed(2)));
    const rPct80 = fila("Partidas que concentran el 80% del valor", n80, analizadas.length ? n80 / analizadas.length : 0);
    const rPct90 = fila("Partidas que concentran el 90% del valor", n90, analizadas.length ? n90 / analizadas.length : 0);
    fila("Umbral clase A / clase B", umbralA + "% / " + umbralB + "%");
    fila("Partidas clase A", porClase.A.length);
    const rDatos2 = fila("Plazo total estimado", hayPlazo ? plazoTexto(plazoTotal) : "No definido");
    fila();
    const rTitEjec = fila(M.reporteEjecutivo);
    const rTextoEjec = fila(textoEjecutivo);
    fila();
    const rTitLeer = fila("Cómo leer este reporte");
    const parrafos = [
      "Cimbra te dice DÓNDE mirar: las partidas de clase A concentran el mayor valor económico y merecen tu revisión primero. Tu software de estimación te permite decidir CÓMO cambiarlo. El criterio final sobre precios, alcance y compras es siempre del profesional.",
      "El total analizado es la suma de las partidas importadas: no incluye IVA ni otros montos que el archivo sume aparte." +
        (avisos.totalArchivo !== null ? " Coincide con el total indicado en el archivo de origen." : ""),
      "El cronograma es una aproximación por fases proporcional al peso económico; no es un cronograma CPM (sin dependencias ni ruta crítica).",
    ];
    if (huboMinimo && hayPlazo) parrafos.push("Las fases de menor peso recibieron una duración mínima para que el cronograma sea ejecutable; el conjunto se ajusta al plazo indicado.");
    if (solape > 0 && hayPlazo) parrafos.push("El cronograma se calculó con un solape de " + solape + "% entre fases consecutivas, indicado por el usuario.");
    if (avisos.sinMonto) parrafos.push(avisos.sinMonto + (avisos.sinMonto === 1 ? " partida del archivo no tiene monto y quedó fuera del análisis." : " partidas del archivo no tienen monto y quedaron fuera del análisis.") + " Revisa si es una omisión del presupuesto.");
    if (excluirAjustes && lineasDeAjuste.length) parrafos.push("Se excluyeron " + lineasDeAjuste.length + " líneas de ajuste (variación de precios, imprevistos u similares) a pedido del usuario.");
    if (!hayPlazo) parrafos.push("Este reporte se descargó sin plazo total, por lo que no incluye Cronograma de Obra, Flujo de Caja ni Curva de Avance. Define el plazo en el módulo " + M.cronograma + " y vuelve a descargar para incluirlos.");
    const rParrafos = parrafos.map((t) => fila(t));

    // Bloque de datos que alimenta el gráfico del Resumen.
    const topGrafico = analizadas.slice(0, 15);
    let rTitGrafico = null;
    let rDatoGrafico1 = null;
    if (topGrafico.length >= 3) {
      fila();
      rTitGrafico = fila("Las " + topGrafico.length + " partidas de mayor peso");
      rDatoGrafico1 = fila("Partida", "Monto", "% acumulado", "Descripción") + 1;
      // La etiqueta del gráfico va corta para que se lea; la descripción completa queda al lado.
      topGrafico.forEach((p) => fila(p.codigo ? p.codigo : "#" + p.rank, p.monto, p.pctAcum / 100, encabezado(p.name, 70)));
    }

    const wsResumen = XLSX.utils.aoa_to_sheet(filasResumen);
    wsResumen["!cols"] = [{ wch: 46 }, { wch: 18 }, { wch: 14 }, { wch: 52 }];
    wsResumen["!merges"] = [];
    wsResumen["!rows"] = [];
    estilar(wsResumen, rTitulo, 0, { font: { bold: true, sz: 16, color: { rgb: NAVY }, name: "Arial" } });
    estilar(wsResumen, rSubtitulo, 0, { font: { italic: true, sz: 10, color: { rgb: "6B7680" }, name: "Arial" } });
    for (let r = rDatos1; r <= rDatos2; r++) {
      estilar(wsResumen, r, 0, { font: { bold: true, color: { rgb: NAVY } }, border: bordes });
      estilar(wsResumen, r, 1, { alignment: { horizontal: "right" }, border: bordes });
    }
    wsResumen[XLSX.utils.encode_cell({ r: rDatos1, c: 1 })].z = FMT_MONTO;
    wsResumen[XLSX.utils.encode_cell({ r: rDatos1 + 2, c: 1 })].z = '0.0"×"';
    [rPct80, rPct90].forEach((r) => {
      wsResumen[XLSX.utils.encode_cell({ r, c: 2 })].z = "0%";
      estilar(wsResumen, r, 2, { alignment: { horizontal: "right" }, border: bordes });
    });
    [rTitEjec, rTitLeer].concat(rTitGrafico === null ? [] : [rTitGrafico]).forEach((r) =>
      estilar(wsResumen, r, 0, { font: { bold: true, sz: 12, color: { rgb: AMBAR } }, border: { bottom: { style: "medium", color: { rgb: AMBAR } } } })
    );
    [rTextoEjec].concat(rParrafos).forEach((r) => {
      wsResumen["!merges"].push({ s: { r, c: 0 }, e: { r, c: 2 } });
      estilar(wsResumen, r, 0, { alignment: { wrapText: true, vertical: "top" }, font: { name: "Arial", sz: 10 } });
      const texto = String(filasResumen[r][0] || "");
      wsResumen["!rows"][r] = { hpt: Math.max(16, Math.ceil(texto.length / 95) * 15) };
    });
    if (rDatoGrafico1 !== null) {
      [0, 1, 2, 3].forEach((c) => estilar(wsResumen, rDatoGrafico1 - 1, c, estiloEncabezado));
      for (let i = 0; i < topGrafico.length; i++) {
        wsResumen[XLSX.utils.encode_cell({ r: rDatoGrafico1 + i, c: 1 })].z = FMT_MONTO;
        wsResumen[XLSX.utils.encode_cell({ r: rDatoGrafico1 + i, c: 2 })].z = FMT_PCT;
      }
      graficos.push({
        hoja: "Resumen",
        xml: barrasYLineaXML({
          hoja: "Resumen", colCat: "A", colBarra: "B", colLinea: "C",
          fila1: rDatoGrafico1 + 1, filaN: rDatoGrafico1 + topGrafico.length,
          filaNombre: rDatoGrafico1,
          titulo: "Partidas de mayor peso y valor acumulado",
          formatoBarra: FMT_MONTO, tituloEjeIzq: "Monto de la partida", tituloEjeDer: "% acumulado del presupuesto",
        }),
        col1: 5, fila1: rDatoGrafico1 - 1, col2: 16, fila2: rDatoGrafico1 + 21,
      });
    }
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

    // --- Hoja 2: Cost Drivers ---
    const conCodigo = analizadas.some((p) => p.codigo);
    const encCD = ["Ranking"].concat(conCodigo ? ["Código"] : [], ["Partida"], usarCapitulosParaSchedule ? ["Capítulo"] : [], ["Monto", "% Individual", "% Acumulado", "Clase"]);
    const filasCD = analizadas.map((p) =>
      [p.rank].concat(conCodigo ? [p.codigo || ""] : [], [p.name], usarCapitulosParaSchedule ? [p.categoria || ""] : [], [p.monto, p.pctInd / 100, p.pctAcum / 100, p.clase])
    );
    const iMonto = encCD.indexOf("Monto");
    const anchosCD = encCD.map((h) => ({ Ranking: 9, "Código": 14, Partida: 60, "Capítulo": 26, Monto: 16, "% Individual": 13, "% Acumulado": 13, Clase: 8 }[h]));
    XLSX.utils.book_append_sheet(
      wb,
      hojaTabla(encCD, filasCD, anchosCD, { [iMonto]: FMT_MONTO, [iMonto + 1]: FMT_PCT, [iMonto + 2]: FMT_PCT }, iMonto + 3),
      M.costDrivers
    );

    // --- Familias de partidas (mismo código o misma descripción) ---
    if (familias.length) {
      const filasFam = familias.slice(0, 200).map((f, i) => [
        i + 1, f.etiqueta, f.partidas.length, f.monto, f.pct / 100, f.mejorRank, listaPartidas(f.partidas),
      ]);
      XLSX.utils.book_append_sheet(
        wb,
        hojaTabla(["#", "Familia (código o descripción)", "Partidas", "Monto total", "% del presupuesto", "Mejor ranking individual", "Partidas incluidas"],
          filasFam, [6, 40, 10, 16, 16, 20, 70], { 3: FMT_MONTO, 4: FMT_PCT }),
        "Familias de Partidas"
      );
    }

    // --- Cronograma, Flujo de Caja y Curva de Avance: solo con plazo definido ---
    if (hayPlazo) {
      const filasCrono = cronograma.map((f) => [
        f.name, aSemanas(f.inicio), aSemanas(f.dias), aSemanas(f.fin), f.monto, f.pct, listaPartidas(f.partidas),
      ]);
      const wsCrono = hojaTabla(
        ["Fase", "Inicio (sem.)", "Duración (sem.)", "Fin (sem.)", "Monto", "% del presupuesto", "Partidas incluidas"],
        filasCrono, [40, 13, 15, 12, 16, 16, 70], { 4: FMT_MONTO, 5: FMT_PCT }
      );
      XLSX.utils.book_append_sheet(wb, wsCrono, M.cronograma);
      const nGantt = Math.min(filasCrono.length, 60);
      if (nGantt >= 1) {
        graficos.push({
          hoja: M.cronograma,
          xml: ganttXML({
            hoja: M.cronograma, colCat: "A", colInicio: "B", colDuracion: "C",
            fila1: 2, filaN: nGantt + 1,
            titulo: "Cronograma de obra por fases" + (nGantt < filasCrono.length ? " (primeras " + nGantt + ")" : ""),
            tituloEjeX: "Semanas desde el inicio de la obra",
          }),
          col1: 7, fila1: 0, col2: 20, fila2: Math.max(18, nGantt + 4),
        });
      }

      const flujoSemanal = calcularFlujo(7, "Semana");
      const flujoMensual = calcularFlujo(30, "Mes");
      const flujoAnual = calcularFlujo(365, "Año");
      [
        ["Flujo de Caja Semanal", flujoSemanal],
        ["Flujo de Caja Mensual", flujoMensual],
        ["Flujo de Caja Anual", flujoAnual],
      ].forEach(([nombreHoja, filas]) => {
        let acum = 0;
        const datos = filas.map((f) => { acum += f.monto; return [f.periodo, Math.round(f.monto), Math.round(acum), f.pctAcum / 100]; });
        XLSX.utils.book_append_sheet(
          wb,
          hojaTabla(["Periodo", "Flujo del período", "Flujo acumulado", "% Acumulado"], datos, [14, 18, 18, 14], { 1: FMT_MONTO, 2: FMT_MONTO, 3: FMT_PCT }),
          nombreHoja
        );
        if (datos.length >= 2) {
          graficos.push({
            hoja: nombreHoja,
            xml: barrasYLineaXML({
              hoja: nombreHoja, colCat: "A", colBarra: "B", colLinea: "D",
              fila1: 2, filaN: datos.length + 1,
              titulo: nombreHoja, formatoBarra: FMT_MONTO,
              tituloEjeIzq: "Flujo del período", tituloEjeDer: "% acumulado",
            }),
            col1: 5, fila1: 0, col2: 17, fila2: 22,
          });
        }
      });

      const curva = flujoMensual.map((f) => [f.periodo, f.pctAcum / 100]);
      XLSX.utils.book_append_sheet(
        wb,
        hojaTabla(["Periodo (mensual)", "% Avance financiero acumulado"], curva, [18, 30], { 1: FMT_PCT }),
        "Curva de Avance"
      );
      if (curva.length >= 2) {
        graficos.push({
          hoja: "Curva de Avance",
          xml: lineaXML({
            hoja: "Curva de Avance", colCat: "A", colLinea: "B",
            fila1: 2, filaN: curva.length + 1,
            titulo: "Curva de avance financiero acumulado", tituloEjeIzq: "% del presupuesto ejecutado",
          }),
          col1: 3, fila1: 0, col2: 15, fila2: 22,
        });
      }
    }

    // --- Prioridades de Procura ---
    const filasCompra = prioridadesCompra.map((p, i) => [
      i + 1, p.codigo || "", p.name, hayPlazo ? semanaDeDia(p.inicioFase) : "Plazo no definido", p.fase, p.clase, p.monto, p.pctInd / 100,
    ]);
    XLSX.utils.book_append_sheet(
      wb,
      hojaTabla(["Prioridad", "Código", "Partida", "Semana requerida", "Fase", "Clase", "Monto", "% Individual"],
        filasCompra, [10, 14, 60, 18, 32, 8, 16, 13], { 6: FMT_MONTO, 7: FMT_PCT }, 5),
      M.procura
    );

    // Actividades Críticas está en pausa: no se exporta mientras el módulo no aporte información propia.
    if (MOSTRAR_CRITICAL_ACTIVITIES) {
      const criticaRows = actividadesCriticas.map((p, i) => [i + 1, p.name, p.pctInd / 100, p.fase, p.inicioFase]);
      XLSX.utils.book_append_sheet(
        wb,
        hojaTabla(["Prioridad", "Partida", "% del presupuesto", "Fase", "Día de inicio"], criticaRows, [10, 40, 16, 32, 12], { 2: FMT_PCT }),
        M.actividadesCriticas
      );
    }

    const nombreArchivo = "cimbra-reporte-" + new Date().toISOString().slice(0, 10) + ".xlsx";
    try {
      const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const conGraficos = agregarGraficos(bytes, graficos);
      const blob = new Blob([conGraficos], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
    } catch (err) {
      // Si algo falla al incrustar los gráficos, el reporte se descarga igual, solo que sin ellos.
      XLSX.writeFile(wb, nombreArchivo);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 bg-white text-gray-900 font-sans text-sm">
      <h1 className="text-lg font-semibold mb-1">Analiza tu presupuesto</h1>
      <p className="text-xs text-gray-500 mb-4">Herramienta complementaria de análisis para toma de decisiones — no reemplaza a Project, Primavera ni al software de presupuesto que ya usas.</p>

      {total > 0 && (
        <p className="text-sm bg-blue-50 text-blue-900 rounded p-3 mb-4">
          {porClase.A.length} de {analizadas.length} partidas ({((porClase.A.length / analizadas.length) * 100).toFixed(0)}% del total de partidas) concentran el {porClase.A.length ? porClase.A[porClase.A.length - 1].pctAcum.toFixed(0) : 0}% del costo del presupuesto. Enfoca ahí tu revisión antes de decidir.
        </p>
      )}

      <div className="mb-4 bg-gray-50 p-3 rounded border border-gray-200">
        <label className="text-xs text-gray-500 block mb-1">Importar presupuesto de construcción (Excel, .xls o .csv)</label>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="text-xs" />
        {importError && <p className="text-xs mt-1" style={{ color: "#b91c1c" }}>{importError}</p>}
        {importInfo && <p className="text-xs mt-1" style={{ color: "#166534" }}>{importInfo}</p>}
        {lineasDeAjuste.length > 0 && (
          <label className="flex items-start gap-2 text-xs text-gray-600 mt-2 cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={excluirAjustes} onChange={(e) => setExcluirAjustes(e.target.checked)} />
            <span>
              Excluir del análisis {lineasDeAjuste.length === 1 ? "la línea de ajuste" : "las " + lineasDeAjuste.length + " líneas de ajuste"} (variación de precios, imprevistos y similares).
              {" "}Al excluirlas, los porcentajes se calculan solo sobre los trabajos de obra.
            </span>
          </label>
        )}
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mt-2">Bloque de pre-oferta — para usar antes de presentar la propuesta</p>

      {MOSTRAR_COST_ANALYSIS && (
        <>
          <h2 className="text-base font-semibold mt-2 mb-1">💰 {M.analisisCostos}</h2>
          {analizadas.length === 0 && (
            <p className="text-xs text-gray-400 italic mb-6">Sube un presupuesto para ver la distribución por categoría.</p>
          )}
          {analizadas.length > 0 && !usaCategoriasReales && (
            <p className="text-xs text-gray-400 italic mb-6">No disponible: este presupuesto no trae capítulos ni códigos jerárquicos identificables. Usa {M.costDrivers}, que funciona sin importar la estructura del archivo.</p>
          )}
          {usaCategoriasReales && (
            <>
              <p className="text-xs text-gray-400 mb-2">Capítulos tomados directamente del archivo importado.</p>
              <div className="mb-6 border border-gray-200 rounded p-3">
                {costoPorFase.map((f) => (
                  <div key={f.key} className="flex items-center gap-3 mb-2 text-xs">
                    <span className="w-52 truncate">{f.name}</span>
                    <div className="flex-1 bg-gray-100 rounded h-4 relative overflow-hidden">
                      <div className="h-4 rounded" style={{ width: (f.pct * 100).toFixed(1) + "%", background: "#3A5A73" }}></div>
                    </div>
                    <span className="w-28 text-right text-gray-600">{fmt(f.monto)} ({d1((f.pct * 100))}%)</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <h2 className="text-base font-semibold mt-2 mb-2">1. 📊 {M.costDrivers}</h2>

      <div className="flex items-center gap-6 mb-4 bg-gray-50 p-3 rounded border border-gray-200">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Umbral clase A (%)</label>
          <input type="number" onWheel={(e) => e.currentTarget.blur()} className="w-16 border border-gray-200 rounded px-1 py-0.5 text-right"
            value={umbralA} onChange={(e) => setUmbralA(Number(e.target.value) || 0)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Umbral clase B (%)</label>
          <input type="number" onWheel={(e) => e.currentTarget.blur()} className="w-16 border border-gray-200 rounded px-1 py-0.5 text-right"
            value={umbralB} onChange={(e) => setUmbralB(Number(e.target.value) || 0)} />
        </div>
        <div className="ml-auto text-right flex items-center gap-4">
          <div>
            <p className="text-xs text-gray-500">Total analizado</p>
            <p className="text-base font-medium leading-tight">{fmt(total)}</p>
            <p className="text-[10px] text-gray-400">suma de partidas, sin IVA</p>
          </div>
          <div className="text-right">
            <button onClick={handleExport} disabled={total === 0}
              className="text-xs border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">
              Descargar reporte completo (Excel)
            </button>
            <p className="text-[11px] text-gray-400 mt-1">Con diagrama de Gantt, flujo de caja y curva de avance</p>
          </div>
        </div>
      </div>

      <div className="mb-4 border border-blue-200 rounded p-3 bg-blue-50">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-blue-900">
            {M.compresionRevision}: {analizadas.length ? d1(reviewCompression) + "×" : "—"}
          </span>
          <span className="text-xs text-blue-900">
            {analizadas.length ? n80 + " de " + analizadas.length + " partidas (" + pct80DePartidas.toFixed(0) + "%) explican el 80% del valor" : "Se calcula al subir tu presupuesto"}
          </span>
        </div>
        <p className="text-xs mb-2 text-blue-900">
          {analizadas.length
            ? "Reduce el universo de revisión " + d1(reviewCompression) + " veces para cubrir el 80% del valor económico de este presupuesto. Es una lectura descriptiva de este proyecto puntual, no una categoría estadística validada con muchos proyectos."
            : "Indica cuántas veces se reduce el universo de revisión para cubrir el 80% del valor económico del presupuesto. Sube tu archivo para calcularla."}
        </p>
        {analizadas.length > 0 && (
          <div className="flex gap-4 text-xs text-blue-900">
            <span>80% del valor → {n80} partidas ({pct80DePartidas.toFixed(0)}%)</span>
            <span>90% → {n90} ({(n90 / analizadas.length * 100).toFixed(0)}%)</span>
          </div>
        )}
      </div>

      <div className="mb-6 border border-gray-200 rounded p-2">
        {analizadas.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-16">Sube un presupuesto para ver el análisis.</p>
        ) : (
          <>
            <div className="flex items-center gap-4 px-2 pt-1 pb-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span style={{ width: 10, height: 10, background: claseInfo.A.color, display: "inline-block", borderRadius: 2 }}></span>Clase A</span>
              <span className="flex items-center gap-1"><span style={{ width: 10, height: 10, background: claseInfo.B.color, display: "inline-block", borderRadius: 2 }}></span>Clase B</span>
              <span className="flex items-center gap-1"><span style={{ width: 10, height: 10, background: claseInfo.C.color, display: "inline-block", borderRadius: 2 }}></span>Clase C</span>
              <span className="ml-auto">Mostrando {partidasMostradas.length} de {analizadas.length} · Línea: % acumulado</span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={partidasMostradas} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="nombreCorto" angle={-35} textAnchor="end" interval={0} height={70} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip content={<CostDriverTooltip fmt={fmt} />} />
                <ReferenceLine yAxisId="right" y={umbralA} stroke="#b91c1c" strokeDasharray="4 4" />
                <Bar yAxisId="left" dataKey="monto">
                  {partidasMostradas.map((p) => (
                    <Cell key={p.id} fill={claseInfo[p.clase].color} />
                  ))}
                </Bar>
                <Line yAxisId="right" dataKey="pctAcum" stroke="#111827" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      <div className="mb-3">
        {analizadas.length > 0 && (
        <>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs">
            <label className="text-gray-500">Mostrar</label>
            <select className="border border-gray-200 rounded px-1 py-0.5" value={topN} onChange={(e) => setTopN(e.target.value)}>
              <option value="80">80% del valor ({n80})</option>
              <option value="90">90% del valor ({n90})</option>
              <option value="todos">Todas ({analizadas.length})</option>
            </select>
          </div>
          <span className="text-xs text-gray-500">{partidasMostradas.length} partidas representan {d1(pctCubierto)}% de la oferta</span>
        </div>
        <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 border-b border-gray-200 pb-1 mb-1">
          <span className="col-span-1">#</span>
          <span className="col-span-4">Partida</span>
          <span className="col-span-2 text-right">Monto</span>
          <span className="col-span-1 text-right">% ind.</span>
          <span className="col-span-2 text-right">% acum.</span>
          <span className="col-span-1 text-center">Clase</span>
          <span className="col-span-1"></span>
        </div>
        {partidasMostradas.map((p) => (
          <div key={p.id} className="grid grid-cols-12 gap-2 items-center text-xs py-1 border-b border-gray-100">
            <span className="col-span-1 text-gray-400">{p.rank}</span>
            <div className="col-span-4 flex items-baseline gap-1.5 min-w-0">
              {p.codigo && <span className="font-mono text-[11px] text-gray-400 shrink-0">{p.codigo}</span>}
              <span className="px-1 min-w-0 flex-1 truncate" title={p.name}>{p.name}</span>
            </div>
            <span className="col-span-2 text-right tabular-nums">{fmt(p.monto)}</span>
            <span className="col-span-1 text-right text-gray-500">{d1(p.pctInd)}%</span>
            <span className="col-span-2 text-right text-gray-500">{d1(p.pctAcum)}%</span>
            <span className="col-span-1 text-center">
              <span style={{ background: claseInfo[p.clase].bg, color: claseInfo[p.clase].color }} className="px-2 py-0.5 rounded text-xs font-medium">
                {p.clase}
              </span>
            </span>
            <span className="col-span-1"></span>
          </div>
        ))}
        </>
        )}
        {analizadas.length === 0 && (
          <p className="text-sm text-gray-400 italic py-4">No hay partidas cargadas todavía.</p>
        )}
      </div>

      <div className="mb-6">
        {(topN === "80" ? ["A"] : topN === "90" ? ["A", "B"] : ["A", "B", "C"]).map((c) =>
          porClase[c].length === 0 ? null : (
            <div key={c} className="mb-3 border border-gray-200 rounded p-3">
              <div className="flex items-center gap-2 mb-1">
                <span style={{ background: claseInfo[c].bg, color: claseInfo[c].color }} className="px-2 py-0.5 rounded text-xs font-medium">
                  {c}
                </span>
                <span className="text-sm font-medium">{claseInfo[c].label}</span>
              </div>
              <p className="text-xs text-gray-600 mb-2">{fasePorClase[c]}</p>
              {c === "A" && (
                <p className="text-xs text-gray-500 mb-2 italic">
                  Vale la pena que reflexiones si alguna de estas partidas corresponde a un insumo importado, de fabricación especializada o de entrega larga: al concentrar tanto peso, cualquier riesgo cambiario o de suministro en ellas afecta de forma desproporcionada al resto de la oferta.
                </p>
              )}
              <p className="text-xs text-gray-500">{resumirNombres(porClase[c], 8)}</p>
            </div>
          )
        )}
      </div>

      {familias.length > 0 && (
        <div className="mb-6 border border-gray-200 rounded p-3">
          <h3 className="text-sm font-medium mb-1">Familias de partidas</h3>
          <p className="text-xs text-gray-500 mb-2">
            Partidas que comparten el mismo código en tu archivo{analizadas.some((p) => p.codigo) ? "" : " o la misma descripción"}. Una familia puede pesar mucho aunque ninguna de sus partidas destaque por separado.
            {familiaDestacada
              ? " Aquí la familia " + familiaDestacada.etiqueta + " suma " + d1(familiaDestacada.pct) + "% del presupuesto, más que la partida individual de mayor peso."
              : ""}
          </p>
          <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 border-b border-gray-200 pb-1 mb-1">
            <span className="col-span-5">Familia</span>
            <span className="col-span-2 text-center">Partidas</span>
            <span className="col-span-3 text-right">Monto total</span>
            <span className="col-span-2 text-right">% del total</span>
          </div>
          {familias.slice(0, 8).map((f) => (
            <div key={f.clave} className="grid grid-cols-12 gap-2 items-center text-xs py-1 border-b border-gray-100">
              <span className="col-span-5 truncate" title={f.nombre}>
                {f.etiqueta !== f.nombre && <span className="font-mono text-[11px] text-gray-400 mr-1.5">{f.etiqueta}</span>}
                {f.nombre}
              </span>
              <span className="col-span-2 text-center text-gray-500">{f.partidas.length}</span>
              <span className="col-span-3 text-right tabular-nums">{fmt(f.monto)}</span>
              <span className="col-span-2 text-right text-gray-500">{d1(f.pct)}%</span>
            </div>
          ))}
          {familias.length > 8 && (
            <p className="text-xs text-gray-400 mt-2">Y {familias.length - 8} familias más en la hoja «Familias de Partidas» del reporte en Excel.</p>
          )}
        </div>
      )}

      <h2 className="text-base font-semibold mt-8 mb-1">2. 🏗️ {M.cronograma}</h2>
      <p className="text-xs text-gray-400 mb-2">Útil como anexo de la oferta y también durante la ejecución</p>
      <div className="mb-6 border border-gray-200 rounded p-3">
        {analizadas.length === 0 && <p className="text-xs text-gray-400 italic">Sube un presupuesto para poder estimar un cronograma.</p>}
        {analizadas.length > 0 && (
        <>
        <div className="flex items-center justify-end gap-4 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500" title="Porcentaje de cada fase que puede ejecutarse en paralelo con la siguiente.">Solape entre fases</label>
            <select className="border border-gray-200 rounded px-1 py-0.5 text-xs" value={solape} onChange={(e) => setSolape(Number(e.target.value))}>
              <option value={0}>Sin solape (en secuencia)</option>
              <option value={15}>15% — solape leve</option>
              <option value={30}>30% — solape moderado</option>
              <option value={50}>50% — obra muy solapada</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Unidad</label>
            <select className="border border-gray-200 rounded px-1 py-0.5 text-xs" value={unidadEfectiva} onChange={(e) => setUnidadTiempo(e.target.value)}>
              <option value="semanas">Semanas</option>
              <option value="meses">Meses</option>
              <option value="años" disabled={!aniosDisponible}>Años{aniosDisponible ? "" : " (plazo menor a 1 año)"}</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Plazo total estimado ({unidadLabel})</label>
            <input type="number" onWheel={(e) => e.currentTarget.blur()} className="w-20 border border-gray-200 rounded px-1 py-0.5 text-right"
              placeholder={unidadEfectiva === "semanas" ? "Ej: 36" : unidadEfectiva === "meses" ? "Ej: 8" : "Ej: 2"}
              step="any"
              value={plazoTotal === null ? "" : aUnidad(plazoTotal)}
              onChange={(e) => { const raw = e.target.value; setPlazoTotal(raw === "" ? null : aDias(Number(raw))); }} />
          </div>
        </div>
        {plazoTotal === null && (
          <p className="text-xs text-gray-400 italic">Escribe el plazo total del proyecto arriba para generar el cronograma.</p>
        )}
        {plazoTotal !== null && plazoTotal > 0 && (
        <>
        <p className="text-xs text-gray-500 mb-3">
          {huboMinimo ? "Las fases de menor peso reciben una duración mínima para que el cronograma sea ejecutable, y el conjunto se reajusta al plazo que indicaste. " : ""}
          {solape > 0 ? "Cada fase arranca cuando la anterior lleva " + (100 - solape) + "% de avance, según el solape que elegiste. " : ""}
          La duración de cada fase se estima en proporción al peso de sus partidas dentro del presupuesto total, no a partir de rendimientos reales de cuadrilla. Si ya tienes fechas y duraciones reales de tu propio cronograma (en Primavera, Project o Excel), edita la semana de inicio y la duración en semanas de cada fase abajo; el {M.flujoCaja} y las {M.procura} usarán esos valores en lugar de los calculados automáticamente.
        </p>
        {cronograma.length > 0 && (
          <>
            <ResponsiveContainer width="100%" height={cronograma.length * (cronograma.length > 25 ? 18 : 40) + 40}>
              <BarChart data={cronogramaDisplay} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" domain={[0, aUnidad(domainMax)]} tick={{ fontSize: 11 }} label={{ value: unidadLabel, position: "insideBottom", offset: -2, fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, n) => (n === "dias" ? v + " " + unidadLabel : null)} labelFormatter={(l) => l} />
                <Bar dataKey="inicio" stackId="g" fill="transparent" />
                <Bar dataKey="dias" stackId="g" fill="#3A5A73" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3">
              {cronograma.map((f) => (
                <div key={f.key} className="mb-2 border-t border-gray-100 pt-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{f.name}</span>
                    <span className="flex items-center gap-2 text-gray-500">
                      Inicio (sem.)
                      <input type="number" step="any" onWheel={(e) => e.currentTarget.blur()} className="w-14 border border-gray-200 rounded px-1 py-0.5 text-right"
                        value={aSemanas(f.inicio)}
                        onChange={(e) => setInicioManual((m) => ({ ...m, [f.key]: Math.max(0, semanasADias(Number(e.target.value) || 0)) }))} />
                      {f.esManualInicio && (
                        <button className="text-blue-600 hover:underline"
                          onClick={() => setInicioManual((m) => { const c = { ...m }; delete c[f.key]; return c; })}>
                          inicio auto
                        </button>
                      )}
                      Duración (sem.)
                      <input type="number" step="any" onWheel={(e) => e.currentTarget.blur()} className="w-14 border border-gray-200 rounded px-1 py-0.5 text-right"
                        value={aSemanas(f.dias)}
                        onChange={(e) => setDuracionManual((m) => ({ ...m, [f.key]: Math.max(1, semanasADias(Number(e.target.value) || 1)) }))} />
                      <span className="text-gray-400">→ termina sem. {aSemanas(f.fin)}</span>
                      {f.esManualDuracion && (
                        <button className="text-blue-600 hover:underline"
                          onClick={() => setDuracionManual((m) => { const c = { ...m }; delete c[f.key]; return c; })}>
                          duración auto
                        </button>
                      )}
                    </span>
                  </div>
                  {f.partidas.length > 1 && (
                    <p className="text-xs text-gray-500">
                      {resumirNombres(f.partidas, 8, (p) => (p.codigo ? p.codigo + " " : "") + encabezado(p.name) + (p.clase === "A" ? " (prioridad alta)" : ""))}
                    </p>
                  )}
                  {f.partidas.length === 1 && f.partidas[0].clase === "A" && (
                    <p className="text-xs text-gray-500">Prioridad alta (clase A)</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        </>
        )}
        </>
        )}
      </div>

      <h2 className="text-base font-semibold mt-6 mb-1">3. 📈 {M.flujoCaja}</h2>
      <p className="text-xs text-gray-400 mb-2">Útil como anexo de la oferta y también durante la ejecución</p>
      <div className="mb-6 border border-gray-200 rounded p-3">
        {(analizadas.length === 0 || plazoTotal === null) ? (
          <p className="text-xs text-gray-400 italic">
            {analizadas.length === 0 ? "Sube un presupuesto para ver el flujo de caja." : "Define el plazo total en " + M.cronograma + " (módulo 2) para poder calcular el flujo de caja."}
          </p>
        ) : (
        <>
        <div className="flex items-center justify-end mb-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Periodicidad</label>
            <select className="border border-gray-200 rounded px-1 py-0.5 text-xs" value={periodicidad} onChange={(e) => setPeriodicidad(e.target.value)}>
              <option value="semanal">Semanal</option>
              <option value="mensual">Mensual</option>
              <option value="anual">Anual</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Curva del presupuesto total del proyecto, no solo de las partidas clase A. El avance físico se representa igual al avance financiero (ponderado por presupuesto), práctica habitual sin metrados de campo independientes.
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={flujoCaja} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="periodo" tick={{ fontSize: 11 }} angle={numPeriodos > 8 ? -35 : 0} textAnchor={numPeriodos > 8 ? "end" : "middle"} height={numPeriodos > 8 ? 55 : 30} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v, n) => (String(n).startsWith("Avance") ? d1(v) + "%" : fmt(v))} />
            <Bar yAxisId="left" dataKey="monto" fill="#3A5A73" name="Flujo de caja del período" />
            <Line yAxisId="right" dataKey="pctAcum" stroke="#111827" strokeWidth={2} dot={{ r: 3 }} name="Avance físico-financiero acumulado" />
          </ComposedChart>
        </ResponsiveContainer>
        </>
        )}
      </div>

      <h2 className="text-base font-semibold mt-6 mb-1">4. 🛒 {M.procura}</h2>
      <p className="text-xs text-gray-400 mb-2">Ejecución — para usar una vez adjudicado el proyecto</p>
      <div className="mb-6 border border-gray-200 rounded p-3">
        <p className="text-xs text-gray-500 mb-3">
          Partidas de alto o medio impacto económico (clase A y B), ordenadas por cuándo se necesitan según el cronograma. No distinguen todavía si el insumo es de entrega larga o inmediata; úsalas como guía de orden de compra y aplica tu propio criterio sobre cuáles requieren más antelación.
        </p>
        {analizadas.length === 0 && <p className="text-xs text-gray-400 italic">Sube un presupuesto para ver las prioridades de procura.</p>}
        {analizadas.length > 0 && !hayPlazo && <p className="text-xs text-gray-400 italic mb-2">Define el plazo total en {M.cronograma} (módulo 2) para ver la semana en que se necesita cada partida.</p>}
        {analizadas.length > 0 && prioridadesCompra.length === 0 && <p className="text-xs text-gray-400 italic">No se detectaron partidas de compra crítica con la información actual.</p>}
        {prioridadesCompra.map((p, i) => (
          <div key={p.id} className="flex items-center justify-between text-xs mb-1.5 border-b border-gray-100 pb-1.5">
            <span>{i + 1}. {p.codigo ? p.codigo + " — " : ""}{encabezado(p.name, 70)}</span>
            <span className="text-gray-500">{hayPlazo ? "Necesario desde la semana " + semanaDeDia(p.inicioFase) + " · " : ""}fase {p.fase} · clase {p.clase}</span>
          </div>
        ))}
      </div>

      {MOSTRAR_CRITICAL_ACTIVITIES && (
        <>
          <h2 className="text-base font-semibold mt-6 mb-1">🎯 {M.actividadesCriticas}</h2>
          <p className="text-xs text-gray-400 mb-2">Pausado — hoy no aporta información distinta a {M.costDrivers}</p>
          <div className="mb-6 border border-gray-200 rounded p-3">
            <p className="text-xs text-gray-500 mb-3">
              Combina peso en el presupuesto y urgencia según el cronograma (qué tan pronto se necesita). No es una ruta crítica calculada por dependencias reales entre actividades, sino una priorización razonable para dar seguimiento cercano.
            </p>
            {actividadesCriticas.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between text-xs mb-1.5 border-b border-gray-100 pb-1.5">
                <span>{i + 1}. {p.codigo ? p.codigo + " — " : ""}{encabezado(p.name, 70)}</span>
                <span className="text-gray-500">{d1(p.pctInd)}% del presupuesto · fase {p.fase} · semana {semanaDeDia(p.inicioFase)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="text-base font-semibold mt-6 mb-2">5. 📑 {M.reporteEjecutivo}</h2>
      <div className="mb-6 border border-gray-200 rounded p-3 bg-gray-50">
        <p className={analizadas.length ? "text-sm text-gray-800 leading-relaxed" : "text-xs text-gray-400 italic"}>
          {analizadas.length ? textoEjecutivo : "Sube un presupuesto para generar el reporte ejecutivo."}
        </p>
      </div>
    </div>
  );
}
