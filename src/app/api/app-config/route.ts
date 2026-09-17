import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// URL del repositorio GitHub de la app de conversor (modo nube/producción)
const GITHUB_RAW_URL =
  'https://raw.githubusercontent.com/grupojk-cambios/grupojk-conversor/main/src/constants.js';

// Ruta local en la máquina del usuario (modo local)
const LOCAL_APP_CONSTANTS_PATH =
  'C:\\Users\\USER\\Documents\\APP PARA CAMBIOS JK CONVERSOR\\src\\constants.js';

const FALLBACK_SHEETS_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwirpun5iWeuc7fc0mvv-nXQl-2ZyJMkOOJbNGLoh9U5qb5Hy9SRKnldeifWHp8a10MC1UK_0DU8co/pub?output=csv';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  let source = 'fallback';
  let fileContent = '';
  let googleSheetsUrl = FALLBACK_SHEETS_URL;

  // 1. Intentar leer del disco local (si se ejecuta en la PC del usuario)
  try {
    if (fs.existsSync(LOCAL_APP_CONSTANTS_PATH)) {
      fileContent = fs.readFileSync(LOCAL_APP_CONSTANTS_PATH, 'utf-8');
      source = 'local_disk';
    }
  } catch (err) {
    // Si no está en disco local, continuaremos al paso 2
  }

  // 2. Si no se pudo leer localmente (ej. en Vercel o la nube), consultar GitHub Raw
  if (!fileContent) {
    try {
      const ghRes = await fetch(`${GITHUB_RAW_URL}?nocache=${Date.now()}`, {
        cache: 'no-store',
      });
      if (ghRes.ok) {
        fileContent = await ghRes.text();
        source = 'github_main';
      }
    } catch (err) {
      console.error('Error obteniendo constants.js de GitHub:', err);
    }
  }

  // 3. Extraer URL de Google Sheets si está en el archivo constants.js
  if (fileContent) {
    const matchSheet = fileContent.match(/GOOGLE_SHEET_CSV_URL\s*=\s*['"`]([^'"`]+)['"`]/i);
    if (matchSheet && matchSheet[1]) {
      googleSheetsUrl = matchSheet[1];
    }
  }

  return NextResponse.json(
    {
      success: true,
      source,
      googleSheetsUrl,
      githubRepo: 'https://github.com/grupojk-cambios/grupojk-conversor',
      timestamp: new Date().toISOString(),
      hasAppConstants: !!fileContent,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  );
}
