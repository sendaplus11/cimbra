import { useState } from "react";
import { ComposedChart, BarChart, Bar, Cell, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import * as XLSX from "xlsx";

let idCounter = 1;
const newId = () => idCounter++;

const initialPartidas = [
  { id: newId(), name: "Transformador de subestación", monto: 9800 },
  { id: newId(), name: "Tubería de acero API 5L", monto: 4600 },
  { id: newId(), name: "Concreto armado (losa y columnas)", monto: 3900 },
  { id: newId(), name: "Pavimento asfáltico", monto: 2600 },
  { id: newId(), name: "Cableado eléctrico media tensión", monto: 2300 },
  { id: newId(), name: "Estructura metálica galpón", monto: 1900 },
  { id: newId(), name: "Movimiento de tierra", monto: 1200 },
  { id: newId(), name: "Tablero eléctrico", monto: 1100 },
  { id: newId(), name: "Instalaciones sanitarias", monto: 950 },
  { id: newId(), name: "Acabados y pintura", monto: 750 },
  { id: newId(), name: "Cerramiento y señalización", monto: 700 },
  { id: newId(), name: "Documentación técnica", monto: 400 },
];

const fmt = (n) => "$" + Math.round(n || 0).toLocaleString("en-US");

function truncar(s, n = 70) {
  const str = String(s || "");
  return str.length > n ? str.slice(0, n).trim() + "…" : str;
}

function resumirNombres(items, max, formatFn) {
  const fmtFn = formatFn || ((p) => truncar(p.name));
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
const AMOUNT_KEYS_PRIORITY = ["total", "monto", "importe", "subtotal", "costo", "precio"];

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

export default function AnalisisPareto() {
  const [partidas, setPartidas] = useState(initialPartidas);
  const [umbralA, setUmbralA] = useState(80);
  const [umbralB, setUmbralB] = useState(95);
  const [plazoTotal, setPlazoTotal] = useState(90);
  const [periodicidad, setPeriodicidad] = useState("mensual");
  const [inicioManual, setInicioManual] = useState({});
  const [duracionManual, setDuracionManual] = useState({});
  const [topN, setTopN] = useState("todos");
  const [importError, setImportError] = useState("");
  const [importInfo, setImportInfo] = useState("");

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
        const nuevas = [];
        for (let r = headerRowIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;
          const name = row[nameIdx];
          const amountRaw = row[amountIdx];
          const amount = typeof amountRaw === "number" ? amountRaw : parseFloat(String(amountRaw || "").replace(/[^0-9.-]/g, ""));
          const nombreLimpio = name ? String(name).trim() : "";
          if (nombreLimpio && !isNaN(amount) && amount > 0) {
            nuevas.push({ id: newId(), name: nombreLimpio, monto: amount });
          }
        }
        if (nuevas.length === 0) {
          setImportError("No se encontraron partidas válidas en el archivo.");
          return;
        }
        setPartidas(nuevas);
        setImportInfo(nuevas.length + " partidas importadas correctamente.");
      } catch (err) {
        setImportError("No se pudo leer el archivo. Verifica que sea un Excel o CSV válido.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const updatePartida = (id, field, value) => {
    setPartidas((ps) =>
      ps.map((p) => (p.id !== id ? p : { ...p, [field]: field === "monto" ? Number(value) || 0 : value }))
    );
  };

  const addPartida = () => setPartidas((ps) => [...ps, { id: newId(), name: "Nueva partida", monto: 0 }]);
  const removePartida = (id) => setPartidas((ps) => ps.filter((p) => p.id !== id));

  const total = partidas.reduce((s, p) => s + p.monto, 0);

  const ordenadas = [...partidas].sort((a, b) => b.monto - a.monto);
  let acumulado = 0;
  const analizadas = ordenadas.map((p, i) => {
    acumulado += p.monto;
    const pctInd = total ? (p.monto / total) * 100 : 0;
    const pctAcum = total ? (acumulado / total) * 100 : 0;
    const clase = pctAcum <= umbralA ? "A" : pctAcum <= umbralB ? "B" : "C";
    return { ...p, rank: i + 1, pctInd, pctAcum, clase };
  });

  const partidasMostradas = topN === "todos" ? analizadas : analizadas.slice(0, Number(topN));
  const pctCubierto = partidasMostradas.length ? partidasMostradas[partidasMostradas.length - 1].pctAcum : 0;

  const porClase = { A: [], B: [], C: [] };
  analizadas.forEach((p) => porClase[p.clase].push(p));

  function encontrarN(umbral) {
    for (let i = 0; i < analizadas.length; i++) {
      if (analizadas[i].pctAcum >= umbral) return i + 1;
    }
    return analizadas.length;
  }
  const n80 = encontrarN(80);
  const n90 = encontrarN(90);
  const n95 = encontrarN(95);
  const pct80DePartidas = analizadas.length ? (n80 / analizadas.length) * 100 : 0;
  const reviewCompression = n80 > 0 ? analizadas.length / n80 : 0;

  const fasesMap = {};
  analizadas.forEach((p) => {
    const ph = classifyPhase(p.name);
    if (!fasesMap[ph]) fasesMap[ph] = { name: ph, monto: 0, partidas: [] };
    fasesMap[ph].monto += p.monto;
    fasesMap[ph].partidas.push(p);
  });
  const fasesOrdenadas = PHASE_ORDER.filter((ph) => fasesMap[ph]).map((ph) => fasesMap[ph]);
  let cursorDia = 0;
  const cronograma = fasesOrdenadas.map((f, i) => {
    const pct = total ? f.monto / total : 0;
    const diasAuto = Math.max(1, Math.round(pct * plazoTotal));
    const esManualDuracion = duracionManual[f.name] !== undefined;
    const dias = esManualDuracion ? Math.max(1, duracionManual[f.name]) : diasAuto;
    const inicioAuto = cursorDia;
    const esManualInicio = inicioManual[f.name] !== undefined;
    const inicio = esManualInicio ? inicioManual[f.name] : inicioAuto;
    cursorDia = inicio + dias;
    return { ...f, pct, dias, diasAuto, inicio, inicioAuto, esManualInicio, esManualDuracion, fin: inicio + dias };
  });
  if (cronograma.length) {
    const ultima = cronograma[cronograma.length - 1];
    if (!ultima.esManualInicio && !ultima.esManualDuracion) {
      ultima.fin = plazoTotal;
      ultima.dias = Math.max(1, plazoTotal - ultima.inicio);
    }
  }
  const domainMax = Math.max(plazoTotal, ...cronograma.map((f) => f.fin), 1);

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
  cronograma.forEach((f) => (faseInicioMap[f.name] = f.inicio));
  const LONG_LEAD_KEYWORDS = ["transformador", "ascensor", "planta electrica", "planta eléctrica", "generador electrico", "generador eléctrico", "grupo electrogeno", "grupo electrógeno", "aire acondicionado", "sistema contra incendio", "subestacion electrica", "subestación eléctrica", "equipo de bombeo", "bomba centrifuga", "bomba centrífuga", "servidor", "escalera metalica", "escalera metálica", "estructura de acero", "estructura metalica", "estructura metálica", "blindad", "acero inoxidable", "sistema de piso falso", "piso tecnico", "piso técnico", "camara de seguridad", "cámara de seguridad", "circuito cerrado", "panel solar", "importad"];
  const esLargoPlazo = (name) => LONG_LEAD_KEYWORDS.some((k) => String(name).toLowerCase().includes(k));

  const analizadasConFase = analizadas.map((p) => {
    const fase = classifyPhase(p.name);
    const inicioFase = faseInicioMap[fase] ?? 0;
    const urgencia = plazoTotal ? 1 - inicioFase / plazoTotal : 0;
    const criticidad = p.pctInd * 0.7 + urgencia * 100 * 0.3;
    return { ...p, fase, inicioFase, criticidad };
  });

  const actividadesCriticas = [...analizadasConFase].sort((a, b) => b.criticidad - a.criticidad).slice(0, 5);

  const prioridadesCompra = analizadasConFase
    .filter((p) => (p.clase === "A" || p.clase === "B") && esLargoPlazo(p.name))
    .sort((a, b) => a.inicioFase - b.inicioFase);

  const picoFlujo = flujoCaja.length ? flujoCaja.reduce((max, f) => (f.monto > max.monto ? f : max), flujoCaja[0]) : null;

  const handleExport = () => {
    const rows = analizadas.map((p) => ({
      Ranking: p.rank,
      Partida: p.name,
      Monto: p.monto,
      "% Individual": Number(p.pctInd.toFixed(2)),
      "% Acumulado": Number(p.pctAcum.toFixed(2)),
      Clase: p.clase,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 10 }, { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 8 }];
    XLSX.utils.sheet_add_json(ws, [
      {},
      { Ranking: "Review Compression", Partida: reviewCompression.toFixed(1) + "×" },
      { Ranking: "Partidas para 80%", Partida: n80, Monto: pct80DePartidas.toFixed(0) + "%" },
      { Ranking: "Partidas para 90%", Partida: n90, Monto: (analizadas.length ? (n90/analizadas.length*100) : 0).toFixed(0) + "%" },
      { Ranking: "Partidas para 95%", Partida: n95, Monto: (analizadas.length ? (n95/analizadas.length*100) : 0).toFixed(0) + "%" },
    ], { origin: -1, skipHeader: true });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cost Drivers");

    const cronoRows = cronograma.map((f) => ({
      Fase: f.name,
      "Día inicio": f.inicio,
      "Día fin": f.fin,
      "Duración (días)": f.dias,
      Monto: f.monto,
      Partidas: f.partidas.map((p) => p.name).join(", "),
    }));
    const ws2 = XLSX.utils.json_to_sheet(cronoRows);
    ws2["!cols"] = [{ wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Cronograma");

    const flujoSemanal = calcularFlujo(7, "Semana");
    const flujoMensual = calcularFlujo(30, "Mes");
    const flujoAnual = calcularFlujo(365, "Año");
    [
      ["Flujo Semanal", flujoSemanal],
      ["Flujo Mensual", flujoMensual],
      ["Flujo Anual", flujoAnual],
    ].forEach(([sheetName, filas]) => {
      const filaRows = filas.map((f) => ({
        Periodo: f.periodo,
        "Flujo del período": Math.round(f.monto),
        "% Acumulado": Number(f.pctAcum.toFixed(2)),
      }));
      const wsF = XLSX.utils.json_to_sheet(filaRows);
      wsF["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsF, sheetName);
    });

    const curvaRows = flujoCaja.map((f) => ({ Periodo: f.periodo, "% Avance financiero acumulado": Number(f.pctAcum.toFixed(2)) }));
    const wsCurva = XLSX.utils.json_to_sheet(curvaRows);
    wsCurva["!cols"] = [{ wch: 14 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, wsCurva, "Curva de Avance");

    const compraRows = prioridadesCompra.map((p, i) => ({ Prioridad: i + 1, Partida: p.name, "Día requerido": p.inicioFase, Fase: p.fase, Clase: p.clase }));
    const wsCompra = XLSX.utils.json_to_sheet(compraRows);
    wsCompra["!cols"] = [{ wch: 10 }, { wch: 40 }, { wch: 14 }, { wch: 32 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, wsCompra, "Prioridades de Compra");

    const criticaRows = actividadesCriticas.map((p, i) => ({ Prioridad: i + 1, Partida: p.name, "% del presupuesto": Number(p.pctInd.toFixed(2)), Fase: p.fase, "Día de inicio": p.inicioFase }));
    const wsCritica = XLSX.utils.json_to_sheet(criticaRows);
    wsCritica["!cols"] = [{ wch: 10 }, { wch: 40 }, { wch: 16 }, { wch: 32 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsCritica, "Actividades Criticas");

    XLSX.writeFile(wb, "project-intelligence-report.xlsx");
  };

  return (
    <div className="max-w-4xl mx-auto p-4 bg-white text-gray-900 font-sans text-sm">
      <h1 className="text-lg font-semibold mb-1">Analiza tu presupuesto</h1>
      <p className="text-xs text-gray-500 mb-4">Herramienta complementaria de análisis para toma de decisiones — no reemplaza a Project, Primavera ni al software de presupuesto que ya usas.</p>

      {total > 0 && (
        <p className="text-sm bg-blue-50 text-blue-900 rounded p-3 mb-4">
          {porClase.A.length} de {analizadas.length} partidas ({((porClase.A.length / analizadas.length) * 100).toFixed(0)}% del total de partidas) concentran el {analizadas.length ? analizadas.filter(p=>p.clase==="A").reduce((s,p)=>s+p.pctInd,0).toFixed(0) : 0}% del costo del presupuesto. Enfoca ahí tu revisión antes de decidir.
        </p>
      )}

      <div className="mb-4 bg-gray-50 p-3 rounded border border-gray-200">
        <label className="text-xs text-gray-500 block mb-1">Importar presupuesto de construcción (Excel, .xls o .csv)</label>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="text-xs" />
        {importError && <p className="text-xs mt-1" style={{ color: "#b91c1c" }}>{importError}</p>}
        {importInfo && <p className="text-xs mt-1" style={{ color: "#166534" }}>{importInfo}</p>}
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mt-2">Bloque de pre-oferta — para usar antes de presentar la propuesta</p>
      <h2 className="text-base font-semibold mt-2 mb-1">1. 💰 Cost Analysis</h2>
      <p className="text-xs text-gray-400 mb-2">Categorías estimadas por palabras clave a partir del nombre de cada partida.</p>
      <div className="mb-6 border border-gray-200 rounded p-3">
        {costoPorFase.map((f) => (
          <div key={f.name} className="flex items-center gap-3 mb-2 text-xs">
            <span className="w-52 truncate">{f.name}</span>
            <div className="flex-1 bg-gray-100 rounded h-4 relative overflow-hidden">
              <div className="h-4 rounded" style={{ width: (f.pct * 100).toFixed(1) + "%", background: "#3A5A73" }}></div>
            </div>
            <span className="w-28 text-right text-gray-600">{fmt(f.monto)} ({(f.pct * 100).toFixed(1)}%)</span>
          </div>
        ))}
      </div>

      <h2 className="text-base font-semibold mt-6 mb-2">2. 📊 Cost Drivers</h2>

      <div className="flex items-center gap-6 mb-4 bg-gray-50 p-3 rounded border border-gray-200">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Umbral clase A (%)</label>
          <input type="number" className="w-16 border border-gray-200 rounded px-1 py-0.5 text-right"
            value={umbralA} onChange={(e) => setUmbralA(Number(e.target.value) || 0)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Umbral clase B (%)</label>
          <input type="number" className="w-16 border border-gray-200 rounded px-1 py-0.5 text-right"
            value={umbralB} onChange={(e) => setUmbralB(Number(e.target.value) || 0)} />
        </div>
        <div className="ml-auto text-right flex items-center gap-4">
          <div>
            <p className="text-xs text-gray-500">Total analizado</p>
            <p className="text-base font-medium">{fmt(total)}</p>
          </div>
          <button onClick={handleExport} disabled={total === 0}
            className="text-xs border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">
            Descargar reporte completo (Excel)
          </button>
        </div>
      </div>

      <div className="mb-4 border border-blue-200 rounded p-3 bg-blue-50">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-blue-900">
            Review Compression: {reviewCompression.toFixed(1)}×
          </span>
          <span className="text-xs text-blue-900">
            {n80} de {analizadas.length} partidas ({pct80DePartidas.toFixed(0)}%) explican el 80% del valor
          </span>
        </div>
        <p className="text-xs mb-2 text-blue-900">
          Reduce el universo de revisión {reviewCompression.toFixed(1)} veces para cubrir el 80% del valor económico de este presupuesto. Es una lectura descriptiva de este proyecto puntual, no una categoría estadística validada con muchos proyectos.
        </p>
        <div className="flex gap-4 text-xs text-blue-900">
          <span>80% del valor → {n80} partidas ({pct80DePartidas.toFixed(0)}%)</span>
          <span>90% → {n90} ({analizadas.length ? (n90/analizadas.length*100).toFixed(0) : 0}%)</span>
          <span>95% → {n95} ({analizadas.length ? (n95/analizadas.length*100).toFixed(0) : 0}%)</span>
        </div>
      </div>

      <div className="mb-6 border border-gray-200 rounded p-2">
        <div className="flex items-center gap-4 px-2 pt-1 pb-2 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span style={{ width: 10, height: 10, background: claseInfo.A.color, display: "inline-block", borderRadius: 2 }}></span>Clase A</span>
          <span className="flex items-center gap-1"><span style={{ width: 10, height: 10, background: claseInfo.B.color, display: "inline-block", borderRadius: 2 }}></span>Clase B</span>
          <span className="flex items-center gap-1"><span style={{ width: 10, height: 10, background: claseInfo.C.color, display: "inline-block", borderRadius: 2 }}></span>Clase C</span>
          <span className="ml-auto">Línea: % acumulado</span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={analizadas} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={70} tick={{ fontSize: 10 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v, n) => (n === "pctAcum" ? v.toFixed(1) + "%" : fmt(v))} />
            <ReferenceLine yAxisId="right" y={umbralA} stroke="#b91c1c" strokeDasharray="4 4" />
            <Bar yAxisId="left" dataKey="monto">
              {analizadas.map((p) => (
                <Cell key={p.id} fill={claseInfo[p.clase].color} />
              ))}
            </Bar>
            <Line yAxisId="right" dataKey="pctAcum" stroke="#111827" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs">
            <label className="text-gray-500">Mostrar</label>
            <select className="border border-gray-200 rounded px-1 py-0.5" value={topN} onChange={(e) => setTopN(e.target.value)}>
              <option value="10">Top 10</option>
              <option value="20">Top 20</option>
              <option value="50">Top 50</option>
              <option value="todos">Todas ({analizadas.length})</option>
            </select>
          </div>
          <span className="text-xs text-gray-500">{partidasMostradas.length} partidas representan {pctCubierto.toFixed(1)}% de la oferta</span>
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
            <input className="col-span-4 border-none bg-transparent focus:outline-none focus:bg-gray-50 rounded px-1"
              value={p.name} onChange={(e) => updatePartida(p.id, "name", e.target.value)} />
            <input type="number" className="col-span-2 border border-gray-200 rounded px-1 py-0.5 text-right"
              value={p.monto} onChange={(e) => updatePartida(p.id, "monto", e.target.value)} />
            <span className="col-span-1 text-right text-gray-500">{p.pctInd.toFixed(1)}%</span>
            <span className="col-span-2 text-right text-gray-500">{p.pctAcum.toFixed(1)}%</span>
            <span className="col-span-1 text-center">
              <span style={{ background: claseInfo[p.clase].bg, color: claseInfo[p.clase].color }} className="px-2 py-0.5 rounded text-xs font-medium">
                {p.clase}
              </span>
            </span>
            <button onClick={() => removePartida(p.id)} className="col-span-1 text-gray-400 hover:text-red-500 text-right">✕</button>
          </div>
        ))}
        <button onClick={addPartida} className="text-xs text-blue-600 hover:underline mt-2">+ agregar partida</button>
      </div>

      <div className="mb-6">
        {["A", "B", "C"].map((c) =>
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

      <h2 className="text-base font-semibold mt-8 mb-1">3. 🏗️ Construction Schedule</h2>
      <p className="text-xs text-gray-400 mb-2">Útil como anexo de la oferta y también durante la ejecución</p>
      <div className="mb-6 border border-gray-200 rounded p-3">
        <div className="flex items-center justify-end mb-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Plazo total (días)</label>
            <input type="number" className="w-16 border border-gray-200 rounded px-1 py-0.5 text-right"
              value={plazoTotal} onChange={(e) => setPlazoTotal(Math.max(1, Number(e.target.value) || 1))} />
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Los días por fase se estiman en proporción al peso de sus partidas dentro del presupuesto total, no a partir de rendimientos reales de cuadrilla. Si ya tienes fechas y duraciones reales de tu propio cronograma (en Primavera, Project o Excel), edita el día de inicio y la duración de cada fase abajo; el resto de los módulos de ejecución usará esos valores en lugar de los calculados automáticamente.
        </p>
        {cronograma.length > 0 && (
          <>
            <ResponsiveContainer width="100%" height={cronograma.length * 40 + 40}>
              <BarChart data={cronograma} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" domain={[0, domainMax]} tick={{ fontSize: 11 }} label={{ value: "días", position: "insideBottom", offset: -2, fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, n) => (n === "dias" ? v + " días" : null)} labelFormatter={(l) => l} />
                <Bar dataKey="inicio" stackId="g" fill="transparent" />
                <Bar dataKey="dias" stackId="g" fill="#3A5A73" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3">
              {cronograma.map((f) => (
                <div key={f.name} className="mb-2 border-t border-gray-100 pt-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{f.name}</span>
                    <span className="flex items-center gap-2 text-gray-500">
                      Día
                      <input type="number" className="w-14 border border-gray-200 rounded px-1 py-0.5 text-right"
                        value={f.inicio}
                        onChange={(e) => setInicioManual((m) => ({ ...m, [f.name]: Math.max(0, Number(e.target.value) || 0) }))} />
                      {f.esManualInicio && (
                        <button className="text-blue-600 hover:underline"
                          onClick={() => setInicioManual((m) => { const c = { ...m }; delete c[f.name]; return c; })}>
                          inicio auto
                        </button>
                      )}
                      – Día {f.fin} (
                      <input type="number" className="w-14 border border-gray-200 rounded px-1 py-0.5 text-right"
                        value={f.dias}
                        onChange={(e) => setDuracionManual((m) => ({ ...m, [f.name]: Math.max(1, Number(e.target.value) || 1) }))} />
                      días)
                      {f.esManualDuracion && (
                        <button className="text-blue-600 hover:underline"
                          onClick={() => setDuracionManual((m) => { const c = { ...m }; delete c[f.name]; return c; })}>
                          duración auto
                        </button>
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {resumirNombres(f.partidas, 8, (p) => truncar(p.name) + (p.clase === "A" ? " (prioridad alta)" : ""))}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <h2 className="text-base font-semibold mt-6 mb-1">4. 📈 Cash Flow</h2>
      <p className="text-xs text-gray-400 mb-2">Útil como anexo de la oferta y también durante la ejecución</p>
      <div className="mb-6 border border-gray-200 rounded p-3">
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
            <Tooltip formatter={(v, n) => (n === "pctAcum" ? v.toFixed(1) + "%" : fmt(v))} />
            <Bar yAxisId="left" dataKey="monto" fill="#3A5A73" name="Flujo de caja del período" />
            <Line yAxisId="right" dataKey="pctAcum" stroke="#111827" strokeWidth={2} dot={{ r: 3 }} name="Avance físico-financiero acumulado" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <h2 className="text-base font-semibold mt-6 mb-1">5. 🛒 Procurement Priorities</h2>
      <p className="text-xs text-gray-400 mb-2">Ejecución — para usar una vez adjudicado el proyecto</p>
      <div className="mb-6 border border-gray-200 rounded p-3">
        <p className="text-xs text-gray-500 mb-3">
          Partidas de alto o medio impacto que además corresponden a insumos de entrega larga (equipos, materiales importados o de fabricación especializada), ordenadas por cuándo se necesitan según el cronograma. Son las primeras órdenes de compra a colocar.
        </p>
        {prioridadesCompra.length === 0 && <p className="text-xs text-gray-400 italic">No se detectaron partidas de compra crítica con la información actual.</p>}
        {prioridadesCompra.map((p, i) => (
          <div key={p.id} className="flex items-center justify-between text-xs mb-1.5 border-b border-gray-100 pb-1.5">
            <span>{i + 1}. {truncar(p.name, 90)}</span>
            <span className="text-gray-500">Necesario desde día {p.inicioFase} · fase {p.fase} · clase {p.clase}</span>
          </div>
        ))}
      </div>

      <h2 className="text-base font-semibold mt-6 mb-1">6. 🎯 Critical Activities</h2>
      <p className="text-xs text-gray-400 mb-2">Pausado — hoy no aporta información distinta a Cost Drivers</p>
      <div className="mb-6 border border-gray-200 rounded p-3">
        <p className="text-xs text-gray-500 mb-3">
          Combina peso en el presupuesto y urgencia según el cronograma (qué tan pronto se necesita). No es una ruta crítica calculada por dependencias reales entre actividades, sino una priorización razonable para dar seguimiento cercano.
        </p>
        {actividadesCriticas.map((p, i) => (
          <div key={p.id} className="flex items-center justify-between text-xs mb-1.5 border-b border-gray-100 pb-1.5">
            <span>{i + 1}. {truncar(p.name, 90)}</span>
            <span className="text-gray-500">{p.pctInd.toFixed(1)}% del presupuesto · fase {p.fase} · día {p.inicioFase}</span>
          </div>
        ))}
      </div>

      <h2 className="text-base font-semibold mt-6 mb-2">7. 📑 Executive Report</h2>
      <div className="mb-6 border border-gray-200 rounded p-3 bg-gray-50">
        <p className="text-sm text-gray-800 leading-relaxed">
          El presupuesto analizado asciende a {fmt(total)}, distribuido en {analizadas.length} partidas y {cronograma.length} fases constructivas, con un plazo estimado de {plazoTotal} días.
          {" "}Este presupuesto tiene un Review Compression de {reviewCompression.toFixed(1)}×: {n80} partidas ({pct80DePartidas.toFixed(0)}%) explican el 80% del valor total.
          {" "}{porClase.A.length} partidas de clase A concentran la mayor parte del impacto financiero y deben revisarse con prioridad, siendo "{truncar(analizadas.find(p=>p.clase==="A")?.name, 60) || "—"}" la de mayor peso individual.
          {" "}La fase de mayor costo es "{costoPorFase[0]?.name}" con {costoPorFase[0] ? (costoPorFase[0].pct*100).toFixed(0) : 0}% del presupuesto.
          {" "}El período de mayor exigencia de flujo de caja es {picoFlujo?.periodo || "—"}, con un desembolso estimado de {picoFlujo ? fmt(picoFlujo.monto) : "$0"}.
          {" "}{prioridadesCompra.length > 0 && <>La primera orden de compra a colocar es "{truncar(prioridadesCompra[0].name, 60)}", requerida desde el día {prioridadesCompra[0].inicioFase}. </>}
          La actividad más crítica para dar seguimiento cercano es "{truncar(actividadesCriticas[0]?.name, 60) || "—"}".
        </p>
      </div>
    </div>
  );
}
