// Hojas complementarias del reporte en Excel: flujo de caja por fase (semanal y mensual)
// y diagrama de Gantt semanal en celdas. Funciones puras: reciben el cronograma ya calculado
// (en días) y devuelven hojas de SheetJS (xlsx-js-style), para poder probarlas sin la interfaz.

const NAVY = "1C2B39";
const AMBAR = "C9922B";
const borde = { style: "thin", color: { rgb: "D1D5DB" } };
const bordes = { top: borde, bottom: borde, left: borde, right: borde };
const ENCABEZADO = {
  font: { bold: true, color: { rgb: "FFFFFF" }, name: "Arial", sz: 10 },
  fill: { patternType: "solid", fgColor: { rgb: NAVY } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: bordes,
};
const TOTAL = {
  font: { bold: true, name: "Arial", sz: 10, color: { rgb: NAVY } },
  fill: { patternType: "solid", fgColor: { rgb: "FBEFD9" } },
  border: bordes,
};

// Monto de cada fase en cada período, con la misma regla del Flujo de Caja del reporte:
// cada fase reparte su monto de manera uniforme entre su inicio y su fin (en días).
export function matrizPorFase(cronograma, periodDias, horizonte) {
  const n = Math.max(1, Math.ceil(horizonte / periodDias - 1e-9));
  return {
    n,
    filas: cronograma.map((f) => {
      const tasa = f.dias > 0 ? f.monto / f.dias : 0;
      const valores = [];
      for (let i = 0; i < n; i++) {
        const ini = i * periodDias;
        const fin = Math.min(horizonte, (i + 1) * periodDias);
        valores.push(Math.max(0, Math.min(f.fin, fin) - Math.max(f.inicio, ini)) * tasa);
      }
      return valores;
    }),
  };
}

// Flujo de caja por fase: una fila por fase, una columna por período, totales con fórmulas.
export function hojaFlujoPorFase(XLSX, { cronograma, periodDias, etiqueta, horizonte, total, fmtMonto }) {
  const { n, filas } = matrizPorFase(cronograma, periodDias, horizonte);
  const col = (i) => XLSX.utils.encode_col(i);
  const encabezados = ["Fase"].concat(Array.from({ length: n }, (_, i) => etiqueta + " " + (i + 1)), ["Total"]);
  const ws = XLSX.utils.aoa_to_sheet([encabezados]);
  const poner = (r, c, celda) => { ws[XLSX.utils.encode_cell({ r, c })] = celda; };
  cronograma.forEach((f, k) => {
    const r = k + 1;
    poner(r, 0, { t: "s", v: f.name, s: { border: bordes, font: { name: "Arial", sz: 10 } } });
    filas[k].forEach((v, i) => poner(r, i + 1, { t: "n", v: Math.round(v), z: fmtMonto, s: { border: bordes } }));
    poner(r, n + 1, { t: "n", f: "SUM(B" + (r + 1) + ":" + col(n) + (r + 1) + ")", v: Math.round(f.monto), z: fmtMonto, s: { ...TOTAL, fill: undefined } });
  });
  const ultima = cronograma.length; // última fila de fases (0-based)
  const rFlujo = ultima + 1, rAcum = ultima + 2, rPct = ultima + 3;
  const totalesPeriodo = Array.from({ length: n }, (_, i) => filas.reduce((s, fila) => s + fila[i], 0));
  let acum = 0;
  poner(rFlujo, 0, { t: "s", v: "Flujo del período", s: TOTAL });
  poner(rAcum, 0, { t: "s", v: "Flujo acumulado", s: TOTAL });
  poner(rPct, 0, { t: "s", v: "% acumulado", s: TOTAL });
  for (let i = 0; i < n; i++) {
    const c = col(i + 1);
    acum += totalesPeriodo[i];
    poner(rFlujo, i + 1, { t: "n", f: "SUM(" + c + "2:" + c + (ultima + 1) + ")", v: Math.round(totalesPeriodo[i]), z: fmtMonto, s: TOTAL });
    poner(rAcum, i + 1, { t: "n", f: i === 0 ? c + (rFlujo + 1) : col(i) + (rAcum + 1) + "+" + c + (rFlujo + 1), v: Math.round(acum), z: fmtMonto, s: TOTAL });
    poner(rPct, i + 1, { t: "n", f: "IF($" + col(n + 1) + "$" + (rFlujo + 1) + "=0,0," + c + (rAcum + 1) + "/$" + col(n + 1) + "$" + (rFlujo + 1) + ")", v: total ? acum / total : 0, z: "0.0%", s: TOTAL });
  }
  poner(rFlujo, n + 1, { t: "n", f: "SUM(B" + (rFlujo + 1) + ":" + col(n) + (rFlujo + 1) + ")", v: Math.round(totalesPeriodo.reduce((a, b) => a + b, 0)), z: fmtMonto, s: TOTAL });
  const rNota = rPct + 2;
  poner(rNota, 0, {
    t: "s",
    v: "Cada fase reparte su monto de manera uniforme entre su inicio y su fin del Cronograma de Obra. Es la inversión que la obra exige en cada período, no el calendario de pagos de la entidad.",
    s: { font: { italic: true, sz: 9, color: { rgb: "6B7680" } } },
  });
  encabezados.forEach((_, c) => { const a = XLSX.utils.encode_cell({ r: 0, c }); ws[a].s = ENCABEZADO; });
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rNota, c: n + 1 } });
  ws["!cols"] = [{ wch: 40 }].concat(Array.from({ length: n }, () => ({ wch: 13 })), [{ wch: 16 }]);
  ws["!rows"] = [{ hpt: 30 }];
  return ws;
}

// Diagrama de Gantt semanal en celdas: una barra por fase, una columna por semana.
// La celda de cada semana muestra qué parte del monto de la fase se ejecuta en ella.
export function hojaGanttSemanal(XLSX, { cronograma, horizonte }) {
  const SEM = 7;
  const { n, filas } = matrizPorFase(cronograma, SEM, horizonte);
  const encabezados = ["Fase", "Semana inicio", "Semana fin", "Duración (sem.)"].concat(Array.from({ length: n }, (_, i) => "S" + (i + 1)));
  const ws = XLSX.utils.aoa_to_sheet([encabezados]);
  const poner = (r, c, celda) => { ws[XLSX.utils.encode_cell({ r, c })] = celda; };
  const fina = { style: "hair", color: { rgb: "E5E7EB" } };
  const bordeSemana = { top: borde, bottom: borde, left: fina, right: fina };
  cronograma.forEach((f, k) => {
    const r = k + 1;
    const semIni = Math.floor(f.inicio / SEM + 1e-9) + 1;
    const semFin = Math.max(semIni, Math.ceil(f.fin / SEM - 1e-9));
    poner(r, 0, { t: "s", v: f.name, s: { border: bordes, font: { name: "Arial", sz: 9 } } });
    poner(r, 1, { t: "n", v: semIni, s: { border: bordes, alignment: { horizontal: "center" } } });
    poner(r, 2, { t: "n", v: semFin, s: { border: bordes, alignment: { horizontal: "center" } } });
    poner(r, 3, { t: "n", v: Math.round((f.dias / SEM) * 10) / 10, s: { border: bordes, alignment: { horizontal: "center" } } });
    filas[k].forEach((v, i) => {
      const activa = v > 0.5;
      poner(r, 4 + i, activa
        ? { t: "n", v: f.monto ? v / f.monto : 0, z: "0%", s: { fill: { patternType: "solid", fgColor: { rgb: NAVY } }, font: { color: { rgb: "FFFFFF" }, sz: 7, name: "Arial" }, alignment: { horizontal: "center" }, border: bordeSemana } }
        : { t: "s", v: "", s: { border: bordeSemana } });
    });
  });
  const rNota = cronograma.length + 2;
  poner(rNota, 0, {
    t: "s",
    v: "Cada barra es una fase del Cronograma de Obra, semana a semana. El número de cada celda es la parte del monto de la fase que se ejecuta esa semana.",
    s: { font: { italic: true, sz: 9, color: { rgb: "6B7680" } } },
  });
  encabezados.forEach((_, c) => {
    const a = XLSX.utils.encode_cell({ r: 0, c });
    ws[a].s = c < 4 ? ENCABEZADO : { ...ENCABEZADO, font: { ...ENCABEZADO.font, sz: 7 } };
  });
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rNota, c: 3 + n } });
  ws["!cols"] = [{ wch: 38 }, { wch: 9 }, { wch: 9 }, { wch: 10 }].concat(Array.from({ length: n }, () => ({ wch: 4.2 })));
  ws["!rows"] = [{ hpt: 30 }];
  return ws;
}

// Financiamiento de la obra: cuánto capital de trabajo pone el contratista mientras cobra las actas.
// Los parámetros dependen del pliego (anticipo, rezago de pago de actas) y quedan editables en ámbar.
// Egreso = inversión mensual de la obra; ingreso = acta del mes (m - rezago), menos la amortización
// proporcional del anticipo; el anticipo entra en el mes 1.
export function hojaFinanciamiento(XLSX, { inversionMensual, total, fmtMonto }) {
  const n = inversionMensual.length;
  const filasExtra = 3; // meses después del fin de obra para cobrar las últimas actas (rezago hasta 3)
  const nFilas = n + filasExtra;
  const ws = {};
  const poner = (a, celda) => { ws[a] = celda; };
  const ambar = { fill: { patternType: "solid", fgColor: { rgb: "FFF7E6" } }, font: { bold: true, color: { rgb: NAVY } }, border: bordes };
  const etiqueta = { font: { name: "Arial", sz: 10 }, border: bordes };
  poner("A1", { t: "s", v: "Financiamiento de la obra (ajusta los parámetros a las condiciones del pliego)", s: { font: { bold: true, sz: 12, color: { rgb: NAVY } } } });
  poner("A3", { t: "s", v: "Anticipo (% del contrato)", s: etiqueta });
  poner("B3", { t: "n", v: 0, z: "0%", s: ambar });
  poner("A4", { t: "s", v: "Rezago de pago de actas (meses, 0 a 3)", s: etiqueta });
  poner("B4", { t: "n", v: 1, z: "0", s: ambar });
  poner("A5", { t: "s", v: "Valor del contrato", s: etiqueta });
  poner("B5", { t: "n", v: Math.round(total), z: fmtMonto, s: etiqueta });
  const enc = ["Mes", "Inversión de obra (egreso)", "Acta del mes", "Ingreso por actas", "Anticipo recibido", "Saldo del mes", "Saldo acumulado"];
  const rEnc = 7; // fila 8 de Excel
  enc.forEach((t, c) => { ws[XLSX.utils.encode_cell({ r: rEnc, c })] = { t: "s", v: t, s: ENCABEZADO }; });
  const f1 = rEnc + 2, fN = rEnc + 1 + nFilas; // filas de Excel de la tabla
  let acum = 0, minAcum = 0;
  for (let i = 0; i < nFilas; i++) {
    const r = f1 + i;
    const inv = i < n ? inversionMensual[i] : 0;
    const cobroPrevio = i - 1 >= 0 && i - 1 < n ? inversionMensual[i - 1] : 0; // valores iniciales con rezago 1
    acum += cobroPrevio - inv;
    minAcum = Math.min(minAcum, acum);
    const m = { border: bordes };
    poner("A" + r, { t: "n", v: i + 1, s: { ...m, alignment: { horizontal: "center" } } });
    poner("B" + r, { t: "n", v: Math.round(inv), z: fmtMonto, s: m });
    poner("C" + r, { t: "n", f: "B" + r, v: Math.round(inv), z: fmtMonto, s: m });
    poner("D" + r, { t: "n", f: "IF(A" + r + "-INT($B$4)<1,0,INDEX($C$" + f1 + ":$C$" + fN + ",A" + r + "-INT($B$4)))*(1-$B$3)", v: Math.round(cobroPrevio), z: fmtMonto, s: m });
    poner("E" + r, { t: "n", f: i === 0 ? "$B$3*$B$5" : "0", v: 0, z: fmtMonto, s: m });
    poner("F" + r, { t: "n", f: "D" + r + "+E" + r + "-B" + r, v: Math.round(cobroPrevio - inv), z: fmtMonto, s: m });
    poner("G" + r, { t: "n", f: i === 0 ? "F" + r : "G" + (r - 1) + "+F" + r, v: Math.round(acum), z: fmtMonto, s: { ...m, font: { bold: true } } });
  }
  const rRes = fN + 2;
  poner("A" + rRes, { t: "s", v: "Capital de trabajo máximo que pone el contratista", s: TOTAL });
  poner("B" + rRes, { t: "n", f: "MAX(0,-MIN(G" + f1 + ":G" + fN + "))", v: Math.round(-minAcum), z: fmtMonto, s: TOTAL });
  poner("A" + (rRes + 1), { t: "s", v: "% del valor del contrato", s: TOTAL });
  poner("B" + (rRes + 1), { t: "n", f: "IF($B$5=0,0,B" + rRes + "/$B$5)", v: total ? -minAcum / total : 0, z: "0.0%", s: TOTAL });
  poner("A" + (rRes + 3), {
    t: "s",
    v: "La inversión mensual sale del Flujo de Caja (valor de la obra ejecutada cada mes). El acta de cada mes se cobra con el rezago indicado y descuenta la amortización proporcional del anticipo. Es una referencia conservadora: el egreso se toma al valor del presupuesto, sin separar la utilidad.",
    s: { font: { italic: true, sz: 9, color: { rgb: "6B7680" } }, alignment: { wrapText: true, vertical: "top" } },
  });
  ws["!merges"] = [{ s: { r: rRes + 2, c: 0 }, e: { r: rRes + 2, c: 6 } }];
  ws["!rows"] = []; ws["!rows"][rEnc] = { hpt: 30 }; ws["!rows"][rRes + 2] = { hpt: 42 };
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rRes + 2, c: 6 } });
  ws["!cols"] = [{ wch: 44 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }];
  return { ws, filaInicio: f1, filaFin: fN };
}

export { AMBAR };
