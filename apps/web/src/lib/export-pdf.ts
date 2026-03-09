const PDF_STYLES = `
  /* Force all text to near-black */
  .pdf-export,
  .pdf-export p,
  .pdf-export span,
  .pdf-export h1,
  .pdf-export h2,
  .pdf-export h3,
  .pdf-export h4,
  .pdf-export li,
  .pdf-export div,
  .pdf-export code,
  .pdf-export a {
    color: #1a1a1a !important;
  }

  /* Muted text: readable dark gray */
  .pdf-export .text-muted-foreground {
    color: #666666 !important;
  }

  /* Sub-muted captions: medium gray */
  .pdf-export .italic {
    color: #888888 !important;
  }

  /* White backgrounds — remove all colored bgs */
  .pdf-export [class*="bg-emerald"],
  .pdf-export [class*="bg-red"],
  .pdf-export [class*="bg-violet"],
  .pdf-export [class*="bg-amber"],
  .pdf-export [class*="bg-blue"],
  .pdf-export [class*="bg-orange"],
  .pdf-export [class*="bg-purple"],
  .pdf-export [class*="bg-pink"],
  .pdf-export [class*="bg-muted"] {
    background-color: #ffffff !important;
  }

  /* Neutral borders */
  .pdf-export [class*="border-emerald"],
  .pdf-export [class*="border-red"],
  .pdf-export [class*="border-violet"],
  .pdf-export [class*="border-amber"],
  .pdf-export [class*="border-blue"],
  .pdf-export [class*="border-orange"],
  .pdf-export [class*="border-purple"],
  .pdf-export [class*="border-pink"] {
    border-color: #e0e0e0 !important;
  }

  /* Card background forced white */
  .pdf-export .bg-card,
  .pdf-export [class*="bg-card"] {
    background-color: #ffffff !important;
  }

  /* Keep icon SVG colors */
  .pdf-export svg[class*="text-red"] { color: #dc2626 !important; }
  .pdf-export svg[class*="text-emerald"] { color: #059669 !important; }
  .pdf-export svg[class*="text-violet"] { color: #7c3aed !important; }
  .pdf-export svg[class*="text-amber"] { color: #d97706 !important; }
  .pdf-export svg[class*="text-blue"] { color: #2563eb !important; }
  .pdf-export svg[class*="text-orange"] { color: #ea580c !important; }
  .pdf-export svg[class*="text-purple"] { color: #9333ea !important; }
  .pdf-export svg[class*="text-pink"] { color: #db2777 !important; }

  /* Progress bars keep color */
  .pdf-export .bg-violet-500 { background-color: #7c3aed !important; }
  .pdf-export [class*="from-violet"] { background-color: #7c3aed !important; }
`

export async function exportDashboardPdf(element: HTMLElement, filename: string) {
  const html2pdf = (await import('html2pdf.js')).default

  const style = document.createElement('style')
  style.textContent = PDF_STYLES
  document.head.appendChild(style)
  element.classList.add('pdf-export')

  await html2pdf()
    .set({
      margin: [10, 10],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    })
    .from(element)
    .save()

  element.classList.remove('pdf-export')
  style.remove()
}
