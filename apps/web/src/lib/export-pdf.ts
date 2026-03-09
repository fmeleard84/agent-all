const PDF_STYLES = `
  .pdf-export {
    --foreground: 0 0% 5%;
    --muted-foreground: 0 0% 40%;
    --card: 0 0% 100%;
    --background: 0 0% 100%;
    --muted: 0 0% 95%;
    --border: 0 0% 85%;
    --accent: 0 0% 95%;
  }
  .pdf-export [class*="bg-emerald"],
  .pdf-export [class*="bg-red"],
  .pdf-export [class*="bg-violet"],
  .pdf-export [class*="bg-amber"],
  .pdf-export [class*="bg-blue"],
  .pdf-export [class*="bg-orange"],
  .pdf-export [class*="bg-purple"],
  .pdf-export [class*="bg-pink"] {
    background-color: #ffffff !important;
  }
  .pdf-export [class*="text-emerald"]:not(svg),
  .pdf-export [class*="text-red"]:not(svg),
  .pdf-export [class*="text-violet"]:not(svg),
  .pdf-export [class*="text-amber"]:not(svg),
  .pdf-export [class*="text-blue"]:not(svg),
  .pdf-export [class*="text-orange"]:not(svg),
  .pdf-export [class*="text-purple"]:not(svg),
  .pdf-export [class*="text-pink"]:not(svg) {
    color: #1a1a1a !important;
  }
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
