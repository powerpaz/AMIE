// scripts/check_coords.js
// Usage: node scripts/check_coords.js <input.csv> <output.csv>
// - Reads a ; delimited CSV with headers including LATITUD and LONGITUD
// - Normalizes weird numeric formats (commas/dots, micro/milli degrees)
// - Writes a normalized CSV
// - Fails CI if rows remain invalid after normalization

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

const inFile = process.argv[2] || 'rubros_csv.csv';
const outFile = process.argv[3] || 'rubros_csv.normalized.csv';

function parseCoord(value){
  if (value === undefined || value === null) return undefined;
  let s = String(value).trim();
  if (!s) return undefined;
  // Remove non-numeric except dot/comma/minus
  s = s.replace(/[^\d,\.\-]/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    // 1.234.567,89 -> 1234567.89
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // 1,234,567.89 -> 1234567.89
    s = s.replace(/,/g, '');
  }
  let num = Number(s);
  if (!Number.isFinite(num)) return undefined;
  // Scale down absurd magnitudes (e.g., -7900115439 -> -79.00115439)
  let tries = 0;
  while (Math.abs(num) > 180 && tries < 10) {
    num = num / 10;
    tries++;
  }
  return num;
}

function withinLat(num){ return typeof num === 'number' && num >= -90 && num <= 90; }
function withinLon(num){ return typeof num === 'number' && num >= -180 && num <= 180; }

const raw = fs.readFileSync(inFile, 'utf8');
// Detect BOM and ensure ; delimiter
let text = raw.replace(/^\uFEFF/, '');
const records = parse(text, { delimiter: ';', columns: true, skip_empty_lines: true });

if (!records.length) {
  console.error('CSV vacío o sin filas.');
  process.exit(1);
}

const headers = Object.keys(records[0]);
// Find columns ignoring accents/case
const norm = s => (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
const findCol = (aliases) => headers.find(h => aliases.some(a => norm(h) === norm(a))) ||
                             headers.find(h => aliases.some(a => norm(h).includes(norm(a))));

const LAT_COL = findCol(['LATITUD','LAT','Y','LATITUDE','LATITUD_WGS84']);
const LON_COL = findCol(['LONGITUD','LON','X','LONGITUDE','LONGITUD_WGS84']);

if (!LAT_COL || !LON_COL) {
  console.error(`No se encontraron columnas de coordenadas. Detectado LAT='${LAT_COL}', LON='${LON_COL}'`);
  process.exit(1);
}

let fixed = 0, invalid = 0;

const out = records.map(row => {
  let lat = parseCoord(row[LAT_COL]);
  let lon = parseCoord(row[LON_COL]);

  const origLat = row[LAT_COL], origLon = row[LON_COL];

  if (!withinLat(lat) || !withinLon(lon)) {
    // Intento adicional: si lat/lon invertidos (comunes), prueba swap
    const swapLat = parseCoord(origLon);
    const swapLon = parseCoord(origLat);
    if (withinLat(swapLat) && withinLon(swapLon)) {
      lat = swapLat; lon = swapLon;
    }
  }

  if (withinLat(lat) && withinLon(lon)) {
    // Redondeo a 6 decimales (suficiente para mapa)
    const latStr = (Math.round(lat * 1e6) / 1e6).toFixed(6);
    const lonStr = (Math.round(lon * 1e6) / 1e6).toFixed(6);
    if (String(origLat) !== latStr || String(origLon) !== lonStr) fixed++;
    row[LAT_COL] = latStr;
    row[LON_COL] = lonStr;
  } else {
    invalid++;
    // Mantener valores originales para trazabilidad
  }
  return row;
});

// Escribir CSV normalizado con ; y mismas cabeceras
const csvOut = stringify(out, { header: true, delimiter: ';', columns: headers });
fs.writeFileSync(outFile, csvOut, 'utf8');

console.log(`✔ Normalización completada. Filas corregidas: ${fixed}, filas inválidas: ${invalid}.`);

// Política de failure: si hay inválidas > 0, fallamos para que revises el origen.
if (invalid > 0) {
  console.error(`❌ Quedaron ${invalid} filas inválidas tras normalizar. Revisa el archivo de entrada.`);
  process.exit(2);
}
