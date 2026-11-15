"""Build the single PDF from the report, captured screenshots and complete source.
Run from any directory with reportlab, Pillow and pypdf installed.
"""
from pathlib import Path
import hashlib, html, json, re, textwrap, zipfile
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak, NextPageTemplate, Image, Preformatted
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from PIL import Image as PILImage
from pypdf import PdfReader
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent / 'outputs'
OUT.mkdir(exist_ok=True)
PDF = OUT / 'MIT-8333-CampusFix-Submission.pdf'
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='BodyCustom', fontName='Helvetica', fontSize=10, leading=15, spaceAfter=10, textColor=colors.HexColor('#233d31')))
styles.add(ParagraphStyle(name='SectionCustom', fontName='Helvetica-Bold', fontSize=18, leading=23, spaceBefore=18, spaceAfter=14, textColor=colors.HexColor('#25694f'), keepWithNext=True))
styles.add(ParagraphStyle(name='CaptionCustom', fontName='Helvetica', fontSize=9, leading=13, spaceAfter=12, textColor=colors.HexColor('#536b5e')))
styles.add(ParagraphStyle(name='SourceCustom', fontName='Courier', fontSize=7, leading=9, spaceAfter=0))
W,H=A4
LW,LH=landscape(A4)
def footer(canvas, doc):
    width,height=canvas._pagesize
    canvas.saveState();canvas.setStrokeColor(colors.HexColor('#d6e1d7'));canvas.line(38,30,width-38,30)
    canvas.setFont('Helvetica',8);canvas.setFillColor(colors.HexColor('#607768'));canvas.drawString(38,18,'CampusFix | MIT 8333 | Cloudflare Workers + D1 | Live deployment verified')
    canvas.drawRightString(width-38,18,str(doc.page));canvas.restoreState()
doc=BaseDocTemplate(str(PDF),pagesize=A4,leftMargin=44,rightMargin=44,topMargin=44,bottomMargin=42,title='CampusFix - MIT 8333 submission',author='CampusFix assessment project')
doc.addPageTemplates([PageTemplate(id='portrait',pagesize=A4,frames=[Frame(44,42,W-88,H-86,id='body',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)],onPage=footer),PageTemplate(id='landscape',pagesize=(LW,LH),frames=[Frame(38,42,LW-76,LH-80,id='wide',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)],onPage=footer)])
story=[]
def para(s,style='BodyCustom'):
    story.append(Paragraph(html.escape(s),styles[style]))
def switch(name):story.extend([NextPageTemplate(name),PageBreak()])
def md(text):
    for block in re.split(r'\n\s*\n',text.strip()):
        if block.startswith('# '):para(block[2:],'Title')
        elif block.startswith('## '):para(block[3:],'SectionCustom')
        else:para(block.replace('\n',' '))
para('CAMPUSFIX','Title');story.append(Spacer(1,12))
para('University maintenance and service request management','SectionCustom')
para('MIT 8333 - Advanced Web Application Development (Virtual lab)')
para('MIVA Open University | 2026/2027 | Continuous assessment, 40 marks')
para('15 November 2026')
story.append(Spacer(1,24))
para('Submission contents','SectionCustom')
for s in ['Technical report: all 12 required sections','Nine screenshots captured from the actual application','Observed verification and API guide','Complete authored source, tests, schema, migrations and deployment configuration','Full pnpm dependency lockfile appendix (packages themselves excluded)']:para(s)
story.append(Spacer(1,18))
para('Verified: 9 component/policy/password tests pass; all 8 API/browser scenarios pass locally and on the live Cloudflare deployment. Build, type check and D1 migration pass.')
para('Live deployment: https://campusfix.campusfix.workers.dev. Private account passwords and the Worker password pepper are excluded. The student must add their actual name and matriculation number before submission.')
para('The companion source archive excludes secrets, .env, database files, installed dependencies and generated builds. Public demo credentials are documented for local assessment use.')
story.append(PageBreak())
report=(ROOT/'docs/report.md').read_text()
before,after=report.split('## 9. Testing evidence',1)
md(before)
shots=[('01-login.png','Login and account registration entry'),('02-admin-dashboard.png','Administrator dashboard: campus-wide requests and pagination'),('03-reports.png','Administrator reports and CSV export'),('04-user-management.png','Administrator user roles and active access'),('05-officer-dashboard.png','Maintenance officer assigned queue'),('06-student-dashboard.png','Student request tracker'),('07-request-form.png','Request submission with evidence upload'),('08-request-tracking.png','Request detail and status timeline'),('09-mobile.png','Mobile student dashboard at 390 pixels')]
for i,(filename,caption) in enumerate(shots,1):
    portrait=filename.startswith('09')
    switch('portrait' if portrait else 'landscape')
    para(f'Figure {i}. {caption}','SectionCustom')
    para('Actual live Cloudflare deployment, captured by Playwright on 15 November 2026. Synthetic demonstration records.','CaptionCustom')
    imagepath=ROOT/'docs/screenshots'/filename
    if not imagepath.exists():raise RuntimeError('Missing actual screenshot: '+filename)
    iw,ih=PILImage.open(imagepath).size
    maxw,maxh=(W-88,H-190) if portrait else (LW-76,LH-170)
    ratio=min(maxw/iw,maxh/ih)
    img=Image(str(imagepath),width=iw*ratio,height=ih*ratio);img.hAlign='CENTER';story.append(img)
switch('portrait');md('## 9. Testing evidence'+after)
story.append(PageBreak());para('Appendix A. Observed verification','SectionCustom');md((ROOT/'docs/verification.md').read_text())
for filename in ['unit.log','e2e.log','live-api-browser.log','live-health.log','live-persistence.json','typecheck.log','remote-migration.log']:
    para(filename,'Heading3')
    content=(ROOT/'docs/evidence'/filename).read_text()
    content=re.sub(r'\x1b\[[0-9;]*[A-Za-z]','',content)
    content=content.replace(str(ROOT),'<CampusFix project>')
    for line in content.splitlines():
        # Keep evidence portable and readable without changing result counts.
        for part in textwrap.wrap(line,width=93,replace_whitespace=False,drop_whitespace=False) or ['']:
            story.append(Preformatted(part.encode('ascii','replace').decode(),styles['SourceCustom']))
    story.append(Spacer(1,12))
story.append(PageBreak());para('Appendix B. API guide','SectionCustom');md((ROOT/'docs/api.md').read_text())
# Every application/config/test source is included, plus the dependency lockfile.
exclude={'node_modules','.nuxt','.output','.git','test-results','playwright-report','.wrangler','ui-comparison'}
source=[]
for p in sorted(ROOT.rglob('*')):
    rel=p.relative_to(ROOT)
    if not p.is_file() or any(part in exclude for part in rel.parts):continue
    if rel.parts[0]=='docs':continue
    if p.name=='.env' or p.name.startswith('.dev.vars') or '.db' in p.name or p.suffix in {'.png','.jpg','.pdf','.zip','.woff','.woff2','.ttf','.ico'}:continue
    source.append(p)
manifest=[{'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in source]
(ROOT/'docs/source-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
switch('landscape');para('Appendix C. Complete source code','SectionCustom')
para(f'{len(source)} text files follow, including the lockfile. Line numbers are source line numbers; long lines wrap with a continuation indent. No installed packages, generated build, environment secrets or database content is included.')
for item in manifest:para(item['path']+' | SHA-256 '+item['sha256'],'CaptionCustom')
for p in source:
    story.append(PageBreak());para(str(p.relative_to(ROOT)),'SectionCustom')
    for n,line in enumerate(p.read_text().splitlines(),1):
        # Eight-point-compatible ASCII source, preserving source line boundaries.
        line=line.expandtabs(2)
        parts=textwrap.wrap(line,width=166,replace_whitespace=False,drop_whitespace=False,break_long_words=True,break_on_hyphens=False) or ['']
        for k,part in enumerate(parts):
            prefix=f'{n:5} ' if k==0 else '      '
            story.append(Preformatted(prefix+part.encode('ascii','backslashreplace').decode(),styles['SourceCustom']))
doc.build(story)
reader=PdfReader(str(PDF));print(f'PDF: {len(reader.pages)} pages; {PDF.stat().st_size} bytes')
print('Source files:',len(source))
# Bundle source and human-readable documentation without secrets or dependencies.
archive=OUT/'CampusFix-source.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(ROOT.rglob('*')):
        rel=p.relative_to(ROOT)
        if not p.is_file() or any(part in exclude for part in rel.parts):continue
        if p.name=='.env' or p.name.startswith('.dev.vars') or '.db' in p.name or p.suffix in {'.pdf','.zip'}:continue
        z.write(p,'CampusFix/'+str(rel))
print('Archive:',archive)
