// Gráficos nativos de Excel (OOXML) añadidos a un libro ya generado por SheetJS.
// SheetJS no escribe gráficos, así que se abre el .xlsx (que es un zip), se le agregan
// las partes de gráfico y dibujo, y se vuelve a comprimir.
import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";

const NAVY = "1C2B39";
const AMBAR = "C9922B";
const AZUL = "3A5A73";
const GRIS = "9AA3AB";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

// 'Hoja con espacios'!$A$2:$A$10
const rango = (hoja, col, desde, hasta) =>
  "'" + String(hoja).replace(/'/g, "''") + "'!$" + col + "$" + desde + (hasta ? ":$" + col + "$" + hasta : "");

const txt = (pt, color, bold) =>
  '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="' + pt * 100 + '" b="' + (bold ? 1 : 0) + '"><a:solidFill><a:srgbClr val="' + color + '"/></a:solidFill><a:latin typeface="Arial"/></a:defRPr></a:pPr><a:endParaRPr lang="es-ES"/></a:p></c:txPr>';

const titulo = (t) =>
  '<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1"><a:solidFill><a:srgbClr val="' +
  NAVY + '"/></a:solidFill><a:latin typeface="Arial"/></a:defRPr></a:pPr><a:r><a:rPr lang="es-ES"/><a:t>' + esc(t) +
  '</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>';

const relleno = (color) =>
  color === null
    ? "<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>"
    : '<c:spPr><a:solidFill><a:srgbClr val="' + color + '"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>';

const lineaSer = (color, ancho) =>
  '<c:spPr><a:ln w="' + ancho + '"><a:solidFill><a:srgbClr val="' + color + '"/></a:solidFill></a:ln></c:spPr>';

function serie({ idx, hoja, nombreCelda, filaNombre, colCat, colVal, fila1, filaN, spPr, marcador, suavizado }) {
  return (
    "<c:ser><c:idx val=\"" + idx + '"/><c:order val="' + idx + '"/>' +
    "<c:tx><c:strRef><c:f>" + esc(rango(hoja, nombreCelda, filaNombre || 1)) + "</c:f></c:strRef></c:tx>" +
    spPr +
    (marcador === false ? '<c:marker><c:symbol val="none"/></c:marker>' : "") +
    "<c:cat><c:strRef><c:f>" + esc(rango(hoja, colCat, fila1, filaN)) + "</c:f></c:strRef></c:cat>" +
    "<c:val><c:numRef><c:f>" + esc(rango(hoja, colVal, fila1, filaN)) + "</c:f></c:numRef></c:val>" +
    (suavizado !== undefined ? '<c:smooth val="' + (suavizado ? 1 : 0) + '"/>' : "") +
    "</c:ser>"
  );
}

function catAx(id, crossId, { borrado, tituloEje, invertido, tamano } = {}) {
  return (
    "<c:catAx><c:axId val=\"" + id + '"/><c:scaling><c:orientation val="' + (invertido ? "maxMin" : "minMax") + '"/></c:scaling>' +
    '<c:delete val="' + (borrado ? 1 : 0) + '"/><c:axPos val="' + (invertido ? "l" : "b") + '"/>' +
    (tituloEje ? ejeTitulo(tituloEje, false) : "") +
    '<c:spPr><a:ln><a:solidFill><a:srgbClr val="D1D5DB"/></a:solidFill></a:ln></c:spPr>' +
    txt(tamano || 8, "374151") +
    '<c:crossAx val="' + crossId + '"/><c:lblAlgn val="ctr"/><c:noMultiLvlLbl val="1"/></c:catAx>'
  );
}

function valAx(id, crossId, { secundario, formato, tituloEje, maximo, posicion } = {}) {
  return (
    "<c:valAx><c:axId val=\"" + id + '"/><c:scaling><c:orientation val="minMax"/>' +
    (maximo !== undefined ? '<c:max val="' + maximo + '"/>' : "") + '<c:min val="0"/></c:scaling>' +
    '<c:delete val="0"/><c:axPos val="' + (posicion || (secundario ? "r" : "l")) + '"/>' +
    (secundario ? "" : '<c:majorGridlines><c:spPr><a:ln><a:solidFill><a:srgbClr val="E5E7EB"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>') +
    (tituloEje ? ejeTitulo(tituloEje, (posicion || (secundario ? "r" : "l")) !== "b") : "") +
    '<c:numFmt formatCode="' + esc(formato || "#,##0") + '" sourceLinked="0"/>' +
    '<c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>' +
    txt(8, "374151") +
    '<c:crossAx val="' + crossId + '"/>' + (secundario ? '<c:crosses val="max"/>' : '<c:crosses val="autoZero"/>') +
    "</c:valAx>"
  );
}

function ejeTitulo(t, vertical) {
  return (
    "<c:title><c:tx><c:rich>" +
    (vertical ? '<a:bodyPr rot="-5400000" vert="horz"/>' : "<a:bodyPr/>") +
    '<a:lstStyle/><a:p><a:pPr><a:defRPr sz="900" b="0"><a:solidFill><a:srgbClr val="6B7680"/></a:solidFill><a:latin typeface="Arial"/></a:defRPr></a:pPr>' +
    '<a:r><a:rPr lang="es-ES"/><a:t>' + esc(t) + "</a:t></a:r></a:p></c:rich></c:tx><c:overlay val=\"0\"/></c:title>"
  );
}

const envoltura = (interior) =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  '<c:roundedCorners val="0"/><c:chart>' + interior + '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>' +
  '<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="E5E7EB"/></a:solidFill></a:ln></c:spPr>' +
  "</c:chartSpace>";

const leyenda = (pos) =>
  '<c:legend><c:legendPos val="' + pos + '"/><c:overlay val="0"/>' + txt(8, "374151") + "</c:legend>";

// Gantt: barras horizontales apiladas; la primera serie (el inicio) va invisible.
export function ganttXML({ hoja, colCat, colInicio, colDuracion, fila1, filaN, filaNombre, titulo: t, tituloEjeX }) {
  const cuerpo =
    titulo(t) +
    "<c:plotArea><c:layout/><c:barChart><c:barDir val=\"bar\"/><c:grouping val=\"stacked\"/><c:varyColors val=\"0\"/>" +
    serie({ idx: 0, hoja, nombreCelda: colInicio, filaNombre, colCat, colVal: colInicio, fila1, filaN, spPr: relleno(null) }) +
    serie({ idx: 1, hoja, nombreCelda: colDuracion, filaNombre, colCat, colVal: colDuracion, fila1, filaN, spPr: relleno(AZUL) }) +
    '<c:gapWidth val="40"/><c:overlap val="100"/><c:axId val="811111111"/><c:axId val="822222222"/></c:barChart>' +
    catAx("811111111", "822222222", { invertido: true, tamano: 7 }) +
    valAx("822222222", "811111111", { formato: "#,##0", tituloEje: tituloEjeX, posicion: "b" }) +
    "</c:plotArea>";
  return envoltura(cuerpo);
}

// Barras (monto por periodo) + línea de % acumulado en el eje derecho.
export function barrasYLineaXML({ hoja, colCat, colBarra, colLinea, fila1, filaN, filaNombre, titulo: t, formatoBarra, tituloEjeIzq, tituloEjeDer, maximoDerecho }) {
  const cuerpo =
    titulo(t) +
    "<c:plotArea><c:layout/><c:barChart><c:barDir val=\"col\"/><c:grouping val=\"clustered\"/><c:varyColors val=\"0\"/>" +
    serie({ idx: 0, hoja, nombreCelda: colBarra, filaNombre, colCat, colVal: colBarra, fila1, filaN, spPr: relleno(AZUL) }) +
    '<c:gapWidth val="60"/><c:axId val="911111111"/><c:axId val="922222222"/></c:barChart>' +
    '<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>' +
    serie({ idx: 1, hoja, nombreCelda: colLinea, filaNombre, colCat, colVal: colLinea, fila1, filaN, spPr: lineaSer(AMBAR, 25400), marcador: false, suavizado: false }) +
    '<c:marker val="1"/><c:axId val="933333333"/><c:axId val="944444444"/></c:lineChart>' +
    catAx("911111111", "922222222", { tamano: 7 }) +
    valAx("922222222", "911111111", { formato: formatoBarra || "#,##0", tituloEje: tituloEjeIzq }) +
    catAx("933333333", "944444444", { borrado: true }) +
    valAx("944444444", "933333333", { secundario: true, formato: "0%", maximo: maximoDerecho === undefined ? 1 : maximoDerecho, tituloEje: tituloEjeDer }) +
    "</c:plotArea>" + leyenda("b");
  return envoltura(cuerpo);
}

// Línea sola (curva de avance).
export function lineaXML({ hoja, colCat, colLinea, fila1, filaN, filaNombre, titulo: t, tituloEjeIzq }) {
  const cuerpo =
    titulo(t) +
    "<c:plotArea><c:layout/><c:lineChart><c:grouping val=\"standard\"/><c:varyColors val=\"0\"/>" +
    serie({ idx: 0, hoja, nombreCelda: colLinea, filaNombre, colCat, colVal: colLinea, fila1, filaN, spPr: lineaSer(AMBAR, 28575), marcador: false, suavizado: false }) +
    '<c:marker val="1"/><c:axId val="711111111"/><c:axId val="722222222"/></c:lineChart>' +
    catAx("711111111", "722222222", { tamano: 7 }) +
    valAx("722222222", "711111111", { formato: "0%", maximo: 1, tituloEje: tituloEjeIzq }) +
    "</c:plotArea>" + leyenda("b");
  return envoltura(cuerpo);
}

// Pareto: barras de monto + línea de % acumulado.
export function paretoXML(opts) {
  return barrasYLineaXML(opts);
}

function dibujoXML(anclas) {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    anclas
      .map(
        (an, i) =>
          '<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>' + an.col1 + "</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>" + an.fila1 +
          "</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>" + an.col2 + "</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>" + an.fila2 +
          "</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>" +
          '<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="' + (i + 2) + '" name="Gráfico ' + (i + 1) +
          '"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>' +
          '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">' +
          '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="' +
          an.rId + '"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>'
      )
      .join("") +
    "</xdr:wsDr>"
  );
}

/**
 * Añade gráficos a un .xlsx ya escrito.
 * graficos: [{ hoja, xml, col1, fila1, col2, fila2 }]
 */
export function agregarGraficos(bytes, graficos) {
  if (!graficos.length) return bytes;
  const zip = unzipSync(new Uint8Array(bytes));
  const leer = (n) => strFromU8(zip[n]);

  // hoja -> archivo xl/worksheets/sheetN.xml
  const wbXml = leer("xl/workbook.xml");
  const relsXml = leer("xl/_rels/workbook.xml.rels");
  const relTarget = {};
  relsXml.replace(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g, (m, id, t) => { relTarget[id] = t; return m; });
  const archivoDeHoja = {};
  wbXml.replace(/<sheet\b[^>]*\/>/g, (tag) => {
    const nombre = (tag.match(/name="([^"]*)"/) || [])[1];
    const rid = (tag.match(/r:id="([^"]*)"/) || [])[1];
    if (nombre !== undefined && relTarget[rid]) {
      archivoDeHoja[nombre.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")] =
        "xl/" + relTarget[rid].replace(/^\//, "");
    }
    return tag;
  });

  const porHoja = new Map();
  graficos.forEach((g) => {
    if (!archivoDeHoja[g.hoja]) return;
    if (!porHoja.has(g.hoja)) porHoja.set(g.hoja, []);
    porHoja.get(g.hoja).push(g);
  });
  if (!porHoja.size) return bytes;

  let nChart = 0;
  let nDrawing = 0;
  const overrides = [];

  porHoja.forEach((lista, hoja) => {
    nDrawing += 1;
    const drawingName = "xl/drawings/drawing" + nDrawing + ".xml";
    const anclas = [];
    const relsDibujo = [];
    lista.forEach((g, i) => {
      nChart += 1;
      const chartName = "xl/charts/chart" + nChart + ".xml";
      zip[chartName] = strToU8(g.xml);
      overrides.push('<Override PartName="/' + chartName + '" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>');
      const rId = "rId" + (i + 1);
      relsDibujo.push('<Relationship Id="' + rId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart' + nChart + '.xml"/>');
      anclas.push({ rId, col1: g.col1, fila1: g.fila1, col2: g.col2, fila2: g.fila2 });
    });
    zip[drawingName] = strToU8(dibujoXML(anclas));
    overrides.push('<Override PartName="/' + drawingName + '" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>');
    zip["xl/drawings/_rels/drawing" + nDrawing + ".xml.rels"] = strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        relsDibujo.join("") + "</Relationships>"
    );

    // relación hoja -> dibujo
    const archivo = archivoDeHoja[hoja];
    const base = archivo.replace(/^xl\/worksheets\//, "");
    const relHoja = "xl/worksheets/_rels/" + base + ".rels";
    const existente = zip[relHoja] ? leer(relHoja) : null;
    const nuevaRel = '<Relationship Id="rIdDib' + nDrawing + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing' + nDrawing + '.xml"/>';
    zip[relHoja] = strToU8(
      existente
        ? existente.replace("</Relationships>", nuevaRel + "</Relationships>")
        : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + nuevaRel + "</Relationships>"
    );

    // <drawing/> va al final de la hoja, después de ignoredErrors
    const hojaXml = leer(archivo);
    zip[archivo] = strToU8(hojaXml.replace("</worksheet>", '<drawing r:id="rIdDib' + nDrawing + '"/></worksheet>'));
  });

  // El elemento <drawing> usa el prefijo r:, que SheetJS no siempre declara en la hoja.
  porHoja.forEach((_, hoja) => {
    const archivo = archivoDeHoja[hoja];
    let x = leer(archivo);
    if (!/xmlns:r=/.test(x)) {
      x = x.replace("<worksheet ", '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
      zip[archivo] = strToU8(x);
    }
  });

  let ct = leer("[Content_Types].xml");
  ct = ct.replace("</Types>", overrides.join("") + "</Types>");
  zip["[Content_Types].xml"] = strToU8(ct);

  return zipSync(zip, { level: 6 });
}
