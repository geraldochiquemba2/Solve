/**
 * Escritor XLSX mínimo, sem dependências.
 *
 * Substitui a biblioteca `xlsx`, que tem duas vulnerabilidades HIGH sem versão
 * corrigida disponível no registry npm (CVE-2023-30533 prototype pollution e
 * CVE-2024-22363 ReDoS). O `xlsx@0.18.5` é a última versão publicada no npm —
 * o projeto SheetJS distributes via CDN, o que exigiria desativar a política
 * de supply-chain do repositório (`blockExoticSubdeps: true`).
 *
 * Só cobre o que a aplicação usa: células de texto e número, várias folhas,
 * larguras de coluna. Sem fórmulas, sem datas interpretadas, sem estilos.
 * Um ficheiro .xlsx é um ZIP de partes XML; aqui escrevemos ZIP sem compressão
 * (método "store"), que o Excel abre normalmente.
 */

export interface FolhaXlsx {
  nome: string;
  cabecalho: string[];
  linhas: Array<Array<string | number>>;
  larguras?: number[];
}

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(dados: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < dados.length; i++) c = TABELA_CRC[(c ^ dados[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(ficheiros: { nome: string; dados: Uint8Array }[]): Uint8Array<ArrayBuffer> {
  const d = new Date();
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const data = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const Locais: number[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  const blocos: Uint8Array[] = [];
  let offset = 0;

  for (const f of ficheiros) {
    const nome = new TextEncoder().encode(f.nome);
    const crc = crc32(f.dados);
    Locais.push(offset);

    const local = new Uint8Array(30 + nome.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, hora, true);
    lv.setUint16(12, data, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, f.dados.length, true);
    lv.setUint32(22, f.dados.length, true);
    lv.setUint16(26, nome.length, true);
    lv.setUint16(28, 0, true);
    local.set(nome, 30);

    blocos.push(local, f.dados);
    offset += local.length + f.dados.length;
  }

  for (let i = 0; i < ficheiros.length; i++) {
    const f = ficheiros[i];
    const nome = new TextEncoder().encode(f.nome);
    const crc = crc32(f.dados);
    const cd = new Uint8Array(46 + nome.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, hora, true);
    cv.setUint16(14, data, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, f.dados.length, true);
    cv.setUint32(24, f.dados.length, true);
    cv.setUint16(28, nome.length, true);
    cv.setUint32(42, Locais[i], true);
    cd.set(nome, 46);
    central.push(cd);
  }

  const tamCentral = central.reduce((t, b) => t + b.length, 0);
  const fim = new Uint8Array(22);
  const fv = new DataView(fim.buffer);
  fv.setUint32(0, 0x06054b50, true);
  fv.setUint16(8, ficheiros.length, true);
  fv.setUint16(10, ficheiros.length, true);
  fv.setUint32(12, tamCentral, true);
  fv.setUint32(16, offset, true);

  const total = offset + tamCentral + fim.length;
  const saida = new Uint8Array(total);
  let p = 0;
  for (const b of blocos) { saida.set(b, p); p += b.length; }
  for (const b of central) { saida.set(b, p); p += b.length; }
  saida.set(fim, p);
  return saida;
}

function letraColuna(i: number): string {
  let s = '';
  let n = i;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

function xml(valor: string): string {
  const limpo = valor
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .slice(0, 32767)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return limpo;
}

function celula(ref: string, valor: string | number): string {
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return `<c r="${ref}"><v>${valor}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(String(valor ?? ''))}</t></is></c>`;
}

function folhaXml(f: FolhaXlsx): string {
  const grelha: Array<Array<string | number>> = [f.cabecalho, ...f.linhas];
  const linhas = grelha
    .map((linha, i) => {
      const celulas = linha
        .map((v, j) => (v === null || v === undefined || v === '' ? '' : celula(`${letraColuna(j)}${i + 1}`, v)))
        .join('');
      return `<row r="${i + 1}">${celulas}</row>`;
    })
    .join('');

  const cols = f.larguras?.length
    ? `<cols>${f.larguras
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join('')}</cols>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${linhas}</sheetData></worksheet>`;
}

function nomeSeguro(nome: string, usados: Set<string>, indice: number): string {
  let base = (nome || `Folha${indice}`).replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim();
  if (!base) base = `Folha${indice}`;
  let candidato = base;
  let n = 2;
  while (usados.has(candidato.toLowerCase())) {
    const sufixo = ` (${n})`;
    candidato = base.slice(0, 31 - sufixo.length) + sufixo;
    n++;
  }
  usados.add(candidato.toLowerCase());
  return candidato;
}

const CONTENT_TYPES = (n: number) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${Array.from(
    { length: n },
    (_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

const RELS_RAIZ = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const WORKBOOK_RELS = (n: number) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${Array.from(
    { length: n },
    (_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  ).join('')}<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`;

function workbookXml(nomes: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nomes
    .map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('')}</sheets></workbook>`;
}

export function gerarXlsx(folhas: FolhaXlsx[]): Blob {
  const usadas = new Set<string>();
  const nomes = folhas.map((f, i) => nomeSeguro(f.nome, usadas, i + 1));
  const cod = new TextEncoder();

  const partes = [
    { nome: '[Content_Types].xml', dados: cod.encode(CONTENT_TYPES(folhas.length)) },
    { nome: '_rels/.rels', dados: cod.encode(RELS_RAIZ) },
    { nome: 'xl/workbook.xml', dados: cod.encode(workbookXml(nomes)) },
    { nome: 'xl/_rels/workbook.xml.rels', dados: cod.encode(WORKBOOK_RELS(folhas.length)) },
    { nome: 'xl/styles.xml', dados: cod.encode(STYLES) },
    ...folhas.map((f, i) => ({ nome: `xl/worksheets/sheet${i + 1}.xml`, dados: cod.encode(folhaXml(f)) })),
  ];

  return new Blob([zip(partes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function nomeFicheiro(base: string, ext: string): string {
  const d = new Date();
  const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${base}-${dia}.${ext}`;
}

export function descarregar(blob: Blob, ficheiro: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = ficheiro;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
