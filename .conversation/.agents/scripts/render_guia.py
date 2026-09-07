import fitz
from pathlib import Path
p=Path('attached_assets/Guia_Tecnico_Desenvolvimento_Ecossistema_Digital_(1)_1788798111512.pdf')
outdir=Path('.agents/outputs')
doc=fitz.open(p)
print('pages', doc.page_count, 'metadata', doc.metadata)
for i,page in enumerate(doc):
    pix=page.get_pixmap(matrix=fitz.Matrix(1.5,1.5), alpha=False)
    out=outdir/f'guia-page-{i+1}.png'
    pix.save(out)
    print(out, page.rect)
