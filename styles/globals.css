* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14px;
  background: #f5f5f5;
  color: #111;
  min-height: 100vh;
}

a { color: inherit; text-decoration: none; }

input, select, button, textarea {
  font-family: inherit;
  font-size: 14px;
}

input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  opacity: 1;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }

/* ── Estilos de impresión ───────────────────────────────────────────── */
@media print {
  /* Ocultar elementos de navegación al imprimir */
  button, select, input[type="text"], input[type="password"],
  input[type="number"], .no-print {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Mostrar colores de fondo */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* Ocultar barra de guardado fija */
  div[style*="position:fixed"],
  div[style*="position: fixed"] {
    display: none !important;
  }

  /* Encabezado sticky visible en impresión */
  div[style*="position:sticky"],
  div[style*="position: sticky"] {
    position: relative !important;
  }

  /* Saltos de página */
  table { page-break-inside: auto; }
  tr    { page-break-inside: avoid; }
}
