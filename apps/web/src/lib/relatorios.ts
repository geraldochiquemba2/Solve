import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { descarregar, gerarXlsx, nomeFicheiro } from './xlsx';

// Utilitário partilhado de relatórios (Excel + PDF) — só com dados reais
// passados por cada página (Pagamentos, Clientes, Dashboard). Nada aqui vai
// à API: quem chama já tem as linhas filtradas no ecrã.

export interface FolhaExcel {
  nome: string;
  cabecalho: string[];
  linhas: Array<Array<string | number>>;
  larguras?: number[];
}

export interface SeccaoPDF {
  titulo?: string;
  cabecalho: string[];
  linhas: Array<Array<string | number>>;
}

export function nomeRelatorio(base: string, ext: string): string {
  return nomeFicheiro(base, ext);
}

export function exportarExcel(base: string, folhas: FolhaExcel[]): void {
  descarregar(gerarXlsx(folhas), nomeRelatorio(base, 'xlsx'));
}

export function exportarPDF(opts: {
  titulo: string;
  subtitulo?: string;
  ficheiro: string;
  seccoes: SeccaoPDF[];
}): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margem = 40;
  let y = 50;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(opts.titulo, margem, y);
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const gerado = new Date().toLocaleString('pt-AO');
  doc.text(`${opts.subtitulo ? opts.subtitulo + ' · ' : ''}Gerado em ${gerado}`, margem, y);
  y += 18;
  opts.seccoes.forEach((s) => {
    if (s.titulo) {
      if (y > 770) { doc.addPage(); y = 50; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(s.titulo, margem, y);
      y += 8;
    }
    autoTable(doc, {
      head: [s.cabecalho],
      body: s.linhas.map((r) => r.map((c) => String(c ?? ''))),
      startY: y,
      margin: { left: margem, right: margem },
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [23, 60, 120], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 244, 250] },
    });
    y = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 18 : y + 18;
  });
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Página ${i} de ${paginas}`, 555, 822, { align: 'right' });
  }
  doc.save(nomeRelatorio(opts.ficheiro, 'pdf'));
}

export function formatarData(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return String(iso);
  }
}
