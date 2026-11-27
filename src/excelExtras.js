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

export { AMBAR };
