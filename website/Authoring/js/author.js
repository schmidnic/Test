/* ═══════════════════════════════════════════════════════════════
   schmidpower Authoring Tool  –  author.js
   ═══════════════════════════════════════════════════════════════ */

// ── Block type registry ─────────────────────────────────────────
const BLOCK_TYPES = [
  { id:'page',       label:'Page',        icon:'≡',  desc:'Text, Überschriften, freier Inhalt' },
  { id:'slides',     label:'Slides',      icon:'◧',  desc:'Slideshow mit Pfeilen und Dots' },
  { id:'accordion',  label:'Accordion',   icon:'☰',  desc:'Aufklappbare Fragen & Antworten' },
  { id:'flipcards',  label:'Flip Cards',  icon:'⬡',  desc:'Karten zum Umdrehen (Frage / Antwort)' },
  { id:'agamotto',   label:'Agamotto',    icon:'◈',  desc:'Schrittweise Bildprogression (Slider)' },
  { id:'juxtapose',  label:'Juxtapose',   icon:'⬕',  desc:'Vorher / Nachher Bildvergleich' },
  { id:'quiz',       label:'Quiz',        icon:'✓',  desc:'Multiple-Choice Wissensabfrage' },
  { id:'completion', label:'Completion',  icon:'★',  desc:'Abschlussbildschirm mit Konfetti' },
  { id:'embed',      label:'Embed',       icon:'⊡',  desc:'Video, Audio, Website, Hotspot-Bild' },
];

const EMBED_TYPES = [
  { id:'video',   label:'Video (YouTube, Vimeo)' },
  { id:'audio',   label:'Audio (Podcast, SoundCloud)' },
  { id:'website', label:'Website / Tool' },
  { id:'gamemap', label:'Game Map / Interactive Map' },
  { id:'hotspot', label:'Hotspot-Bild' },
  { id:'other',   label:'Sonstiges iframe' },
];

// ── Default factories ───────────────────────────────────────────
const DEFAULTS = {
  page:       () => ({ type:'page',      heading:'',      body:'' }),
  slides:     () => ({ type:'slides',    intro:'',        slides:[{heading:'',body:''}] }),
  accordion:  () => ({ type:'accordion', intro:'',        items:[{trigger:'',content:''}] }),
  flipcards:  () => ({ type:'flipcards', intro:'',        cards:[{label:'Claim 1',question:'',title:'',answer:''}] }),
  agamotto:   () => ({ type:'agamotto',  intro:'',        steps:[{image:'',caption:''},{image:'',caption:''}] }),
  juxtapose:  () => ({ type:'juxtapose', intro:'',        beforeLabel:'Before',afterLabel:'After',beforeImage:'',afterImage:'' }),
  quiz:       () => ({ type:'quiz',      intro:'',        questions:[{text:'',multi:false,options:[{text:'',correct:true},{text:'',correct:false}],okMsg:'',wrongMsg:''}] }),
  completion: () => ({ type:'completion',heading:'You made it.',subtitle:'Microlearning complete.',message:'',showFeedback:true }),
  embed:      () => ({ type:'embed',     embedType:'video',url:'',title:'',height:'400' }),
};

// ── App state ───────────────────────────────────────────────────
let state = {
  meta: { title:'New Course', storageKey:'course-new', backLink:'../hub.html', backLabel:'Coffee Hours' },
  lessons: []
};

let sel = { type:null, lessonIdx:null, blockIdx:null };
// sel.type: 'meta' | 'lesson' | 'block' | null

let pendingBlockLessonIdx = null;
let previewCss = '';
let previewMainJs = '';
let previewDirty = true;
let previewTimer = null;

// ── Persistence ─────────────────────────────────────────────────
function saveState() {
  localStorage.setItem('au-state', JSON.stringify(state));
}
function loadState() {
  const s = localStorage.getItem('au-state');
  if (s) { try { state = JSON.parse(s); } catch(e) {} }
}

// ── Utils ────────────────────────────────────────────────────────
function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escJs(v) {
  return String(v ?? '').replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$/g,'\\$');
}
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2500);
}

// ── Outline ──────────────────────────────────────────────────────
function renderOutline() {
  const c = document.getElementById('outlineContent');
  let html = '';

  // Course settings entry
  html += `<div class="au-outline-item ${sel.type==='meta'?'selected':''}" data-sel="meta">
    <span class="au-outline-icon">⚙</span>
    <span>Kurseinstellungen</span>
  </div>`;

  state.lessons.forEach((lesson, li) => {
    const lessonSel = sel.type==='lesson' && sel.lessonIdx===li;
    const hasBlockSel = sel.type==='block' && sel.lessonIdx===li;
    const open = lessonSel || hasBlockSel;

    html += `<div class="au-outline-lesson">
      <div class="au-outline-lesson-header ${lessonSel?'selected':''}" data-sel="lesson" data-li="${li}">
        <span class="au-outline-chevron">${open?'▾':'▸'}</span>
        <span class="au-outline-lesson-title">${esc(lesson.title || 'Lektion ' + (li+1))}</span>
        <button class="au-outline-del" data-del-lesson="${li}" title="Lektion löschen">×</button>
      </div>`;

    if (open) {
      lesson.blocks.forEach((block, bi) => {
        const bt = BLOCK_TYPES.find(b => b.id === block.type);
        const blockSel = sel.type==='block' && sel.lessonIdx===li && sel.blockIdx===bi;
        html += `<div class="au-outline-block ${blockSel?'selected':''}" data-sel="block" data-li="${li}" data-bi="${bi}">
          <span class="au-outline-block-icon">${bt?bt.icon:'?'}</span>
          <span class="au-outline-block-label">${bt?bt.label:block.type}</span>
          <button class="au-outline-del" data-del-block="${li}-${bi}" title="Block löschen">×</button>
        </div>`;
      });
      html += `<div class="au-outline-addblock">
        <button class="au-outline-add-btn" data-open-picker="${li}">+ Block hinzufügen</button>
      </div>`;
    }
    html += `</div>`;
  });

  html += `<div class="au-add-lesson-btn" id="addLessonBtn">+ Neue Lektion</div>`;
  c.innerHTML = html;
}

// ── Editor ───────────────────────────────────────────────────────
function renderEditor() {
  const c = document.getElementById('editorContent');
  if (sel.type === 'meta') {
    c.innerHTML = editorMeta();
  } else if (sel.type === 'lesson') {
    c.innerHTML = editorLesson(state.lessons[sel.lessonIdx], sel.lessonIdx);
  } else if (sel.type === 'block') {
    const block = state.lessons[sel.lessonIdx].blocks[sel.blockIdx];
    c.innerHTML = editorBlock(block, sel.lessonIdx, sel.blockIdx);
  } else {
    c.innerHTML = `<div class="au-empty-state"><div class="au-empty-icon">✦</div>
      <p>Wähle einen Eintrag im Outline<br>oder lege eine neue Lektion an.</p></div>`;
  }
}

function f(label, name, value, type='text', attrs='') {
  return `<div class="au-field">
    <label class="au-label">${label}</label>
    <input class="au-input" type="${type}" name="${name}" value="${esc(value)}" ${attrs}>
  </div>`;
}
function ta(label, name, value, rows=3) {
  return `<div class="au-field">
    <label class="au-label">${label}</label>
    <textarea class="au-textarea" name="${name}" rows="${rows}">${esc(value)}</textarea>
  </div>`;
}
function sel_(label, name, options, current) {
  const opts = options.map(o =>
    `<option value="${esc(o.id)}" ${o.id===current?'selected':''}>${esc(o.label)}</option>`
  ).join('');
  return `<div class="au-field">
    <label class="au-label">${label}</label>
    <select class="au-select" name="${name}">${opts}</select>
  </div>`;
}
function sectionTitle(t) {
  return `<div class="au-editor-header"><h3 class="au-editor-title">${esc(t)}</h3></div>`;
}

// ── Block editors ────────────────────────────────────────────────
function editorMeta() {
  const m = state.meta;
  return `<div class="au-editor-section">
    ${sectionTitle('Kurseinstellungen')}
    ${f('Kurstitel','meta.title',m.title)}
    ${f('Storage-Key (eindeutig pro Kurs)','meta.storageKey',m.storageKey)}
    ${f('Zurück-Link (URL)','meta.backLink',m.backLink)}
    ${f('Zurück-Label','meta.backLabel',m.backLabel)}
  </div>`;
}

function editorLesson(lesson, li) {
  return `<div class="au-editor-section">
    ${sectionTitle('Lektion ' + (li+1))}
    ${f('Lektionstitel (im TOC sichtbar)','lesson.title',lesson.title)}
    <p class="au-hint">Klicke im Outline auf "+ Block hinzufügen", um Inhalte zu ergänzen.</p>
  </div>`;
}

function editorBlock(block, li, bi) {
  const bt = BLOCK_TYPES.find(b => b.id === block.type);
  let inner = '';
  switch(block.type) {
    case 'page':       inner = edPage(block);    break;
    case 'slides':     inner = edSlides(block);  break;
    case 'accordion':  inner = edAccordion(block); break;
    case 'flipcards':  inner = edFlipCards(block); break;
    case 'agamotto':   inner = edAgamotto(block);  break;
    case 'juxtapose':  inner = edJuxtapose(block); break;
    case 'quiz':       inner = edQuiz(block);    break;
    case 'completion': inner = edCompletion(block); break;
    case 'embed':      inner = edEmbed(block);   break;
    default:           inner = '<p>Unbekannter Block-Typ.</p>';
  }
  return `<div class="au-editor-section">
    <div class="au-editor-header">
      <h3 class="au-editor-title">${bt?bt.icon+' '+bt.label:block.type}</h3>
      <span class="au-editor-path">Lektion ${li+1} · Block ${bi+1}</span>
    </div>
    ${inner}
  </div>`;
}

function edPage(b) {
  return f('Überschrift (optional)','page.heading',b.heading)
       + ta('Inhalt (HTML erlaubt)','page.body',b.body,8);
}

function edSlides(b) {
  let html = ta('Intro-Text (optional, über den Slides)','slides.intro',b.intro||'',2);
  b.slides.forEach((s,si) => {
    html += `<div class="au-list-item">
      <div class="au-list-item-header">
        <span class="au-list-num">Slide ${si+1}</span>
        ${b.slides.length>1?`<button class="au-btn au-btn-danger-sm" data-rm-slide="${si}">Entfernen</button>`:''}
      </div>
      ${f('Überschrift',`slide.${si}.heading`,s.heading)}
      ${ta('Text',`slide.${si}.body`,s.body,3)}
    </div>`;
  });
  return html + `<button class="au-btn au-btn-add" data-add-slide>+ Slide hinzufügen</button>`;
}

function edAccordion(b) {
  let html = ta('Intro-Text (optional)','accordion.intro',b.intro||'',2);
  b.items.forEach((item,ii) => {
    html += `<div class="au-list-item">
      <div class="au-list-item-header">
        <span class="au-list-num">Eintrag ${ii+1}</span>
        ${b.items.length>1?`<button class="au-btn au-btn-danger-sm" data-rm-acc="${ii}">Entfernen</button>`:''}
      </div>
      ${f('Frage / Trigger',`acc.${ii}.trigger`,item.trigger)}
      ${ta('Antwort / Inhalt',`acc.${ii}.content`,item.content,3)}
    </div>`;
  });
  return html + `<button class="au-btn au-btn-add" data-add-acc>+ Eintrag hinzufügen</button>`;
}

function edFlipCards(b) {
  let html = ta('Intro-Text (optional)','flipcards.intro',b.intro||'',2);
  b.cards.forEach((c,ci) => {
    html += `<div class="au-list-item">
      <div class="au-list-item-header">
        <span class="au-list-num">Karte ${ci+1}</span>
        ${b.cards.length>1?`<button class="au-btn au-btn-danger-sm" data-rm-card="${ci}">Entfernen</button>`:''}
      </div>
      ${f('Label (z.B. "Claim 1")',`fc.${ci}.label`,c.label)}
      ${f('Vorderseite: Frage',`fc.${ci}.question`,c.question)}
      ${f('Rückseite: Überschrift (Claim-Titel)',`fc.${ci}.title`,c.title)}
      ${ta('Rückseite: Antwort',`fc.${ci}.answer`,c.answer,2)}
    </div>`;
  });
  return html + `<button class="au-btn au-btn-add" data-add-card>+ Karte hinzufügen</button>`;
}

function edAgamotto(b) {
  let html = ta('Intro-Text (optional)','agamotto.intro',b.intro||'',2);
  b.steps.forEach((s,si) => {
    html += `<div class="au-list-item">
      <div class="au-list-item-header">
        <span class="au-list-num">Schritt ${si+1}</span>
        ${b.steps.length>2?`<button class="au-btn au-btn-danger-sm" data-rm-aga="${si}">Entfernen</button>`:''}
      </div>
      ${f('Bild-URL (optional)',`aga.${si}.image`,s.image)}
      ${ta('Beschriftung / Text',`aga.${si}.caption`,s.caption,2)}
    </div>`;
  });
  return html + `<button class="au-btn au-btn-add" data-add-aga>+ Schritt hinzufügen</button>`;
}

function edJuxtapose(b) {
  return ta('Intro-Text (optional)','juxtapose.intro',b.intro||'',2)
       + f('Vorher-Bild URL','juxtapose.beforeImage',b.beforeImage)
       + f('Vorher-Label','juxtapose.beforeLabel',b.beforeLabel)
       + f('Nachher-Bild URL','juxtapose.afterImage',b.afterImage)
       + f('Nachher-Label','juxtapose.afterLabel',b.afterLabel);
}

function edQuiz(b) {
  let html = ta('Intro-Text (optional)','quiz.intro',b.intro||'',2);
  b.questions.forEach((q,qi) => {
    html += `<div class="au-list-item">
      <div class="au-list-item-header">
        <span class="au-list-num">Frage ${qi+1}</span>
        ${b.questions.length>1?`<button class="au-btn au-btn-danger-sm" data-rm-q="${qi}">Entfernen</button>`:''}
      </div>
      ${ta('Fragetext',`q.${qi}.text`,q.text,2)}
      ${sel_('Typ','q.'+qi+'.multi',[{id:'false',label:'Einfachauswahl (Radio)'},{id:'true',label:'Mehrfachauswahl (Checkbox)'}], q.multi?'true':'false')}
      <div class="au-field">
        <label class="au-label">Antwortoptionen <span style="font-size:0.68rem;font-weight:400">(✓ = richtig)</span></label>`;
    q.options.forEach((opt,oi) => {
      html += `<div class="au-option-row">
        <input type="checkbox" class="au-opt-correct" name="q.${qi}.opt.${oi}.correct" ${opt.correct?'checked':''}>
        <input class="au-input au-input-sm" type="text" name="q.${qi}.opt.${oi}.text" value="${esc(opt.text)}" placeholder="Option ${oi+1}">
        ${q.options.length>2?`<button class="au-btn au-btn-danger-sm" data-rm-opt="${qi}-${oi}">×</button>`:''}
      </div>`;
    });
    html += `<button class="au-btn au-btn-add-sm" data-add-opt="${qi}">+ Option</button>
      </div>
      ${f('Feedback bei richtiger Antwort',`q.${qi}.okMsg`,q.okMsg||'')}
      ${f('Feedback bei falscher Antwort',`q.${qi}.wrongMsg`,q.wrongMsg||'')}
    </div>`;
  });
  return html + `<button class="au-btn au-btn-add" data-add-q>+ Frage hinzufügen</button>`;
}

function edCompletion(b) {
  return f('Überschrift','completion.heading',b.heading)
       + f('Untertitel','completion.subtitle',b.subtitle||'')
       + ta('Nachricht','completion.message',b.message,4)
       + `<div class="au-field">
            <label class="au-label">Feedback-Smiley anzeigen</label>
            <select class="au-select" name="completion.showFeedback">
              <option value="true" ${b.showFeedback!==false?'selected':''}>Ja</option>
              <option value="false" ${b.showFeedback===false?'selected':''}>Nein</option>
            </select>
          </div>`;
}

function edEmbed(b) {
  return sel_('Embed-Typ','embed.embedType',EMBED_TYPES,b.embedType)
       + f('URL (iframe src)','embed.url',b.url)
       + f('Titel / Label (Accessibility)','embed.title',b.title)
       + f('Höhe in px','embed.height',b.height,'number','min="100" max="2000"')
       + `<p class="au-hint">YouTube: Teilen → Einbetten → src-URL verwenden. Vimeo entsprechend.</p>`;
}

// ── State update from form ────────────────────────────────────────
function applyField(name, value) {
  const p = name.split('.');

  if (p[0] === 'meta') { state.meta[p[1]] = value; return; }
  if (p[0] === 'lesson') { state.lessons[sel.lessonIdx][p[1]] = value; return; }

  const block = state.lessons[sel.lessonIdx].blocks[sel.blockIdx];
  if (!block) return;

  switch(p[0]) {
    case 'page':       block[p[1]] = value; break;
    case 'slides':     block[p[1]] = value; break;
    case 'slide':      block.slides[+p[1]][p[2]] = value; break;
    case 'accordion':  block[p[1]] = value; break;
    case 'acc':        block.items[+p[1]][p[2]] = value; break;
    case 'flipcards':  block[p[1]] = value; break;
    case 'fc':         block.cards[+p[1]][p[2]] = value; break;
    case 'agamotto':   block[p[1]] = value; break;
    case 'aga':        block.steps[+p[1]][p[2]] = value; break;
    case 'juxtapose':  block[p[1]] = value; break;
    case 'quiz':       block[p[1]] = value; break;
    case 'q':
      if (p[2] === 'multi') {
        block.questions[+p[1]].multi = (value === 'true');
      } else if (p[2] === 'opt') {
        const opt = block.questions[+p[1]].options[+p[3]];
        if (p[4] === 'correct') opt.correct = (value === true || value === 'true');
        else opt[p[4]] = value;
      } else {
        block.questions[+p[1]][p[2]] = value;
      }
      break;
    case 'completion': block[p[1]] = (p[1]==='showFeedback') ? (value==='true') : value; break;
    case 'embed':      block[p[1]] = value; break;
  }
}

// ── Preview ──────────────────────────────────────────────────────
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, 600);
}

function updatePreview() {
  if (!previewCss) return;
  const html = generatePreviewHtml();
  document.getElementById('previewFrame').srcdoc = html;
}

function generatePreviewHtml() {
  const lessonCount = state.lessons.length;
  const titles = state.lessons.map(l => l.title || 'Lektion');
  let lessonsHtml = '';
  state.lessons.forEach((lesson, li) => {
    lessonsHtml += `<div class="lesson ${li===0?'active':''}" id="lesson-${li+1}">
      <h2 class="lesson-title">${esc(lesson.title || 'Lektion ' + (li+1))}</h2>
      ${lesson.blocks.map((b,bi) => generateBlockHtml(b, li, bi)).join('\n')}
    </div>`;
  });

  return `<!DOCTYPE html><html lang="de"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(state.meta.title)}</title>
<style>${previewCss}</style>
</head>
<body class="course-page">
<nav class="nav scrolled" id="nav">
  <a href="#" class="nav-logo">${esc('schmidpower')}</a>
  <div class="nav-right">
    <a href="#" class="nav-link">Coffee Hours</a>
    <a href="#" class="nav-link">About</a>
    <a href="#" class="nav-btn">Join me on Substack</a>
  </div>
</nav>
<header class="course-header">
  <div class="course-header-inner">
    <div class="course-meta"><h1 class="course-title">${esc(state.meta.title)}</h1></div>
    <div class="course-progress">
      <span class="progress-text" id="progressText">1 / ${lessonCount}</span>
      <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
    </div>
  </div>
</header>
<div class="course-layout">
  <div class="sidebar-wrap">
    <aside class="course-sidebar">
      <nav><ul class="lesson-list" id="lessonList"></ul></nav>
    </aside>
    <button class="sidebar-toggle" id="sidebarToggle"><span></span><span></span><span></span></button>
  </div>
  <main class="course-main" id="courseMain">
    ${lessonsHtml}
    <div class="lesson-footer" id="lessonFooter">
      <button class="lesson-nav-btn" id="prevBtn" disabled>← Back</button>
      <span class="lesson-counter" id="lessonCounter">1 / ${lessonCount}</span>
      <button class="lesson-nav-btn" id="nextBtn">Next →</button>
    </div>
  </main>
</div>
<button class="quicknotes-fab" id="quicknotesToggle" aria-label="Open notes">
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
</button>
<div class="quicknotes-panel" id="quicknotesPanel">
  <div class="quicknotes-header"><p class="quicknotes-title">Notes</p></div>
  <textarea class="quicknotes-area" id="quicknotesArea" placeholder="Jot down your thoughts..."></textarea>
  <div class="quicknotes-footer">
    <span class="quicknotes-saved" id="quicknotesSaved"></span>
    <button class="quicknotes-clear" id="quicknotesClear">Clear</button>
  </div>
</div>
<script>
${previewMainJs}
${inlineCourseJs(state, lessonCount, titles)}
</script>
</body></html>`;
}

// ── HTML Generator (export) ──────────────────────────────────────
function generateCourseHtml() {
  const m = state.meta;
  const titles = state.lessons.map(l => l.title || 'Lektion');
  const total  = state.lessons.length;

  let lessonsHtml = '';
  state.lessons.forEach((lesson, li) => {
    lessonsHtml += `
      <!-- Lesson ${li+1}: ${lesson.title || ''} -->
      <div class="lesson ${li===0?'active':''}" id="lesson-${li+1}">
        <h2 class="lesson-title">${esc(lesson.title)}</h2>
        ${lesson.blocks.map((b,bi) => generateBlockHtml(b, li, bi)).join('\n        ')}
      </div>`;
  });

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <title>${esc(m.title)} – schmidpower</title>
  <link rel="stylesheet" href="../css/style.css">
  <link rel="stylesheet" href="../css/course.css">
</head>
<body class="course-page">

  <nav class="nav scrolled" id="nav">
    <a href="../index.html" class="nav-logo">schmidpower</a>
    <div class="nav-right">
      <a href="${esc(m.backLink)}" class="nav-link">${esc(m.backLabel)}</a>
      <a href="../ueber-mich.html" class="nav-link">About</a>
      <a href="https://substack.com/prohelias" target="_blank" rel="noopener" class="nav-btn">Join me on Substack</a>
    </div>
    <button class="nav-toggle" id="navToggle" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
  </nav>

  <div class="nav-mobile" id="navMobile">
    <a href="../index.html" onclick="closeMobileMenu()">Home</a>
    <a href="${esc(m.backLink)}" onclick="closeMobileMenu()">${esc(m.backLabel)}</a>
    <a href="../ueber-mich.html" onclick="closeMobileMenu()">About</a>
  </div>

  <header class="course-header">
    <div class="course-header-inner">
      <div class="course-meta">
        <h1 class="course-title">${esc(m.title)}</h1>
        <button class="reset-btn" onclick="resetProgress()" title="Start over">
          <svg viewBox="0 0 16 16" width="18" height="18" fill="none">
            <path d="M13.5 8a5.5 5.5 0 1 1-1.1-3.3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
            <path d="M13.5 3v2.5H11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div class="course-progress">
        <span class="progress-text" id="progressText">1 / ${total}</span>
        <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
      </div>
    </div>
  </header>

  <div class="course-layout">

    <div class="sidebar-wrap">
      <aside class="course-sidebar">
        <nav aria-label="Lessons">
          <ul class="lesson-list" id="lessonList"></ul>
        </nav>
      </aside>
      <button class="sidebar-toggle" id="sidebarToggle" aria-label="Toggle table of contents">
        <span></span><span></span><span></span>
      </button>
    </div>

    <main class="course-main" id="courseMain">
${lessonsHtml}

      <div class="lesson-footer" id="lessonFooter">
        <button class="lesson-nav-btn" id="prevBtn" onclick="navigate(-1)" disabled>← Back</button>
        <span class="lesson-counter" id="lessonCounter">1 / ${total}</span>
        <button class="lesson-nav-btn" id="nextBtn" onclick="navigate(1)">Next →</button>
      </div>
    </main>

  </div>

  <button class="quicknotes-fab" id="quicknotesToggle" aria-label="Open notes">
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>

  <div class="quicknotes-panel" id="quicknotesPanel">
    <div class="quicknotes-header"><p class="quicknotes-title">Notes</p></div>
    <textarea class="quicknotes-area" id="quicknotesArea" placeholder="Jot down your thoughts..."></textarea>
    <div class="quicknotes-footer">
      <span class="quicknotes-saved" id="quicknotesSaved"></span>
      <button class="quicknotes-clear" id="quicknotesClear">Clear</button>
    </div>
  </div>

  <script src="../js/main.js"></script>
  <script>
${inlineCourseJs(state, total, titles)}
  </script>

</body>
</html>`;
}

// ── Block HTML generator ─────────────────────────────────────────
function generateBlockHtml(block, li, bi) {
  switch(block.type) {
    case 'page':       return genPage(block);
    case 'slides':     return genSlides(block, li, bi);
    case 'accordion':  return genAccordion(block);
    case 'flipcards':  return genFlipCards(block);
    case 'agamotto':   return genAgamotto(block, li, bi);
    case 'juxtapose':  return genJuxtapose(block, li, bi);
    case 'quiz':       return genQuiz(block, li, bi);
    case 'completion': return genCompletion(block, li);
    case 'embed':      return genEmbed(block, li, bi);
    default:           return '';
  }
}

function genPage(b) {
  let html = '';
  if (b.heading) html += `<h3>${esc(b.heading)}</h3>\n`;
  if (b.body)    html += `<div class="page-body">${b.body}</div>`;
  return html;
}

function genSlides(b, li, bi) {
  const deckId = `slide-deck-${li+1}-${bi+1}`;
  let slidesHtml = b.slides.map((s, si) => `
          <div class="slide ${si===0?'active':''}">
            <div class="slide-content">
              <p class="slide-label">Slide ${si+1} of ${b.slides.length}</p>
              ${s.heading ? `<h3>${esc(s.heading)}</h3>` : ''}
              <p>${esc(s.body)}</p>
            </div>
          </div>`).join('');

  let intro = b.intro ? `<p>${esc(b.intro)}</p>` : '';
  return `${intro}
        <div class="slide-deck" id="${deckId}">
          ${slidesHtml}
          <div class="slide-controls">
            <button class="slide-btn" id="prev-${deckId}" onclick="prevSlide('${deckId}')" aria-label="Previous slide">&#8249;</button>
            <div class="slide-dots" id="dots-${deckId}"></div>
            <button class="slide-btn" id="next-${deckId}" onclick="nextSlide('${deckId}')" aria-label="Next slide">&#8250;</button>
          </div>
        </div>`;
}

function genAccordion(b) {
  let intro = b.intro ? `<p>${esc(b.intro)}</p>` : '';
  let items = b.items.map(item => `
          <div class="accordion-item">
            <button class="accordion-trigger" aria-expanded="false">${esc(item.trigger)}</button>
            <div class="accordion-panel"><p>${esc(item.content)}</p></div>
          </div>`).join('');
  return `${intro}<div class="accordion">${items}\n        </div>`;
}

function genFlipCards(b) {
  let intro = b.intro ? `<p>${esc(b.intro)}</p>` : '';
  const hintSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M21 12a9 9 0 1 1-2.64-6.36" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M21 3v5h-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  let cards = b.cards.map((c,ci) => `
            <div class="flip-card" onclick="this.classList.toggle('flipped')">
              <div class="flip-card-inner">
                <div class="flip-card-front">
                  <p class="flip-card-label">${esc(c.label)}</p>
                  <p class="flip-card-title">${esc(c.question)}</p>
                  <div class="flip-card-hint">${hintSvg}</div>
                </div>
                <div class="flip-card-back">
                  <strong>${esc(c.title)}</strong>
                  <p>${esc(c.answer)}</p>
                </div>
              </div>
            </div>`).join('');
  return `${intro}<div class="flip-cards-grid">${cards}\n          </div>`;
}

function genAgamotto(b, li, bi) {
  const id = `agamotto-${li+1}-${bi+1}`;
  let intro = b.intro ? `<p>${esc(b.intro)}</p>` : '';
  let steps = b.steps.map((s,si) => `
          <div class="agamotto-step ${si===0?'active':''}" id="${id}-step-${si}">
            ${s.image ? `<img src="${esc(s.image)}" alt="${esc(s.caption)}">` : ''}
            ${s.caption ? `<p class="agamotto-caption">${esc(s.caption)}</p>` : ''}
          </div>`).join('');
  return `${intro}
        <div class="agamotto" id="${id}">
          <div class="agamotto-stage">${steps}
          </div>
          <div class="agamotto-controls">
            <input class="agamotto-slider" type="range" min="0" max="${b.steps.length-1}" value="0" aria-label="Step">
            <span class="agamotto-counter">1 / ${b.steps.length}</span>
          </div>
        </div>`;
}

function genJuxtapose(b, li, bi) {
  const id = `jux-${li+1}-${bi+1}`;
  let intro = b.intro ? `<p>${esc(b.intro)}</p>` : '';
  return `${intro}
        <div class="juxtapose">
          <div class="juxtapose-stage" id="${id}">
            <img class="juxtapose-after" src="${esc(b.afterImage)}" alt="${esc(b.afterLabel)}">
            <div class="juxtapose-before">
              <img src="${esc(b.beforeImage)}" alt="${esc(b.beforeLabel)}">
            </div>
            <div class="juxtapose-handle"></div>
            <span class="juxtapose-label before">${esc(b.beforeLabel)}</span>
            <span class="juxtapose-label after">${esc(b.afterLabel)}</span>
          </div>
        </div>`;
}

function genQuiz(b, li, bi) {
  let intro = b.intro ? `<p>${esc(b.intro)}</p>` : '';
  let quizzesHtml = b.questions.map((q, qi) => {
    const qid = `quiz-${li+1}-${bi+1}-${qi+1}`;
    const isMulti = q.multi;
    const letters = 'abcdefghijklmnop';
    // Find correct letter(s)
    const correct = q.options
      .map((o,oi) => ({ o, letter: letters[oi] }))
      .filter(x => x.o.correct)
      .map(x => x.letter);

    let options = q.options.map((opt, oi) => {
      const inputType = isMulti ? 'checkbox' : 'radio';
      const name = isMulti ? `${qid}-${oi}` : qid;
      return `<label class="quiz-option">
              <input type="${inputType}" name="${name}" value="${letters[oi]}">
              <span>${esc(opt.text)}</span>
            </label>`;
    }).join('\n            ');

    const okMsg = q.okMsg || 'Richtig!';
    const wrongMsg = q.wrongMsg || 'Nicht ganz.';

    let checkFn, checkCall;
    if (isMulti) {
      checkFn = 'checkMulti';
      checkCall = `checkMulti('${qid}', ${JSON.stringify(correct)}, \`${escJs(okMsg)}\`, \`${escJs(wrongMsg)}\`)`;
    } else {
      checkFn = 'checkQuiz';
      checkCall = `checkQuiz('${qid}', '${correct[0]||'a'}', \`${escJs(okMsg)}\`, \`${escJs(wrongMsg)}\`)`;
    }

    return `
        <div class="quiz" id="${qid}">
          <p class="quiz-question">${qi+1}. ${esc(q.text)}</p>
          <p class="quiz-hint">${isMulti ? 'Mehrere Antworten möglich' : 'Eine Antwort korrekt'}</p>
          <div class="quiz-options">
            ${options}
          </div>
          <button class="quiz-submit" onclick="${checkCall}">Antwort prüfen</button>
          <div class="quiz-feedback" id="feedback-${qid}"></div>
        </div>`;
  }).join('');

  return intro + quizzesHtml;
}

function genCompletion(b, li) {
  const feedbackHtml = b.showFeedback !== false ? `
          <div class="feedback-section" style="border-top:none;padding-top:0;margin-top:36px;">
            <p class="feedback-prompt">How was this Microlearning?</p>
            <div class="feedback-emojis">
              <button class="feedback-btn" onclick="submitFeedback(this)" aria-label="Great">
                <svg viewBox="0 0 32 32" width="44" height="44" fill="none">
                  <circle cx="16" cy="16" r="14" fill="var(--navy)" fill-opacity="0.06" stroke="var(--navy)" stroke-width="1.5"/>
                  <circle cx="11.5" cy="13" r="1.8" fill="var(--navy)"/>
                  <circle cx="20.5" cy="13" r="1.8" fill="var(--navy)"/>
                  <path d="M10 18.5 Q16 24.5 22 18.5" stroke="var(--navy)" stroke-width="1.8" stroke-linecap="round" fill="none"/>
                </svg>
              </button>
              <button class="feedback-btn" onclick="submitFeedback(this)" aria-label="Okay">
                <svg viewBox="0 0 32 32" width="44" height="44" fill="none">
                  <circle cx="16" cy="16" r="14" fill="var(--navy)" fill-opacity="0.06" stroke="var(--navy)" stroke-width="1.5"/>
                  <circle cx="11.5" cy="13" r="1.8" fill="var(--navy)"/>
                  <circle cx="20.5" cy="13" r="1.8" fill="var(--navy)"/>
                  <path d="M10 20.5 Q16 20.5 22 20.5" stroke="var(--navy)" stroke-width="1.8" stroke-linecap="round" fill="none"/>
                </svg>
              </button>
              <button class="feedback-btn" onclick="submitFeedback(this)" aria-label="Not great">
                <svg viewBox="0 0 32 32" width="44" height="44" fill="none">
                  <circle cx="16" cy="16" r="14" fill="var(--navy)" fill-opacity="0.06" stroke="var(--navy)" stroke-width="1.5"/>
                  <circle cx="11.5" cy="13" r="1.8" fill="var(--navy)"/>
                  <circle cx="20.5" cy="13" r="1.8" fill="var(--navy)"/>
                  <path d="M10 22 Q16 17 22 22" stroke="var(--navy)" stroke-width="1.8" stroke-linecap="round" fill="none"/>
                </svg>
              </button>
            </div>
            <p class="feedback-thanks" id="feedbackThanks"></p>
          </div>` : '';

  return `
        <div class="completion-screen">
          <div class="completion-screen-icon" aria-hidden="true">
            <div class="thumb-icon">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
          <h2 class="celebration-title">${esc(b.heading)}</h2>
          <p class="celebration-subtitle">${esc(b.subtitle || '')}</p>
          <p class="celebration-msg">${esc(b.message)}</p>
          ${feedbackHtml}
        </div>`;
}

function genEmbed(b, li, bi) {
  const id = `embed-${li+1}-${bi+1}`;
  let src = b.url;
  // Auto-convert YouTube watch URLs to embed
  src = src.replace(/youtube\.com\/watch\?v=([^&]+)/,'youtube.com/embed/$1')
           .replace(/youtu\.be\/([^?]+)/,'youtube.com/embed/$1');
  const height = parseInt(b.height) || 400;

  if (b.embedType === 'hotspot') {
    return `<div class="embed-wrap" style="position:relative;max-width:640px;">
        <img src="${esc(src)}" style="width:100%;border-radius:10px;" alt="${esc(b.title)}">
        <p class="au-hint" style="margin-top:8px;">Hotspot-Punkte direkt im HTML ergänzen.</p>
      </div>`;
  }
  if (b.embedType === 'audio') {
    return `<div style="margin-top:16px;">
        ${b.title ? `<p style="margin-bottom:8px;font-weight:600;">${esc(b.title)}</p>` : ''}
        <audio controls style="width:100%;max-width:500px;">
          <source src="${esc(src)}">
        </audio>
      </div>`;
  }
  return `<div class="embed-responsive" style="position:relative;padding-bottom:${Math.round(height/6.4)}%;height:0;overflow:hidden;border-radius:10px;max-width:640px;">
        <iframe id="${id}" src="${esc(src)}" title="${esc(b.title||'Embed')}"
          style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"
          allowfullscreen allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture">
        </iframe>
      </div>`;
}

// ── Inline course JS template ────────────────────────────────────
function inlineCourseJs(state, total, titles) {
  const key = state.meta.storageKey || 'course-new';
  const titlesJson = JSON.stringify(titles);

  return `
    const LESSON_TITLES = ${titlesJson};
    const TOTAL = ${total};
    let current = 1;

    const list = document.getElementById('lessonList');
    if (list) LESSON_TITLES.forEach((title, i) => {
      const li = document.createElement('li');
      li.className = 'lesson-item' + (i === 0 ? ' active' : '');
      li.dataset.lesson = i + 1;
      li.innerHTML = '<span class="lesson-num">' + (i+1) + '</span><span class="lesson-name">' + title + '</span>';
      li.addEventListener('click', () => goTo(i + 1));
      list.appendChild(li);
    });

    function launchConfetti() {
      const existing = document.getElementById('confetti-container');
      if (existing) existing.remove();
      const colors = ['#FF00FF','#e909f6','#160B52','#7C3AED','#a78bfa','#E9D5FF','#F0EFFE','#fff','#c4b5fd'];
      const wrap = document.createElement('div');
      wrap.id = 'confetti-container';
      wrap.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10000;overflow:hidden;';
      document.body.appendChild(wrap);
      for (let i = 0; i < 140; i++) {
        const el = document.createElement('div');
        const color  = colors[Math.floor(Math.random() * colors.length)];
        const left   = Math.random() * 100;
        const delay  = Math.random() * 1.6;
        const dur    = 2 + Math.random() * 2.5;
        const w      = 5 + Math.random() * 13;
        const drift  = (Math.random() - 0.5) * 200;
        const wobble = (Math.random() - 0.5) * 80;
        el.style.cssText = 'position:absolute;top:-20px;left:' + left + '%;width:' + w + 'px;height:' + w + 'px;background:' + color + ';border-radius:50%;opacity:0.95;animation:confettiFall ' + dur + 's ' + delay + 's ease-in forwards;--drift:' + drift + 'px;--wobble:' + wobble + 'px;';
        wrap.appendChild(el);
      }
      setTimeout(() => wrap.remove(), 7000);
    }

    function resetProgress() {
      localStorage.removeItem('${escJs(key)}-lesson');
      localStorage.removeItem('${escJs(key)}-feedback');
      const ft = document.getElementById('feedbackThanks');
      if (ft) { ft.textContent = ''; ft.classList.remove('visible'); }
      document.querySelectorAll('.feedback-btn').forEach(b => b.classList.remove('selected'));
      goTo(1);
    }

    function submitFeedback(btn) {
      document.querySelectorAll('.feedback-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const thanks = document.getElementById('feedbackThanks');
      if (thanks) { thanks.textContent = 'Thanks for your feedback!'; thanks.classList.add('visible'); }
      const lastItem = document.querySelector('.lesson-item[data-lesson="' + TOTAL + '"]');
      if (lastItem) { lastItem.classList.add('done'); lastItem.classList.remove('active'); }
      localStorage.setItem('${escJs(key)}-feedback', '1');
      const thumb = document.querySelector('.thumb-icon');
      if (thumb) {
        thumb.classList.remove('bounce'); void thumb.offsetWidth; thumb.classList.add('bounce');
        thumb.addEventListener('animationend', () => thumb.classList.remove('bounce'), { once: true });
      }
    }

    function goTo(n, silent) {
      const curr = document.getElementById('lesson-' + current);
      if (curr) curr.classList.remove('active');
      document.querySelectorAll('.lesson-item').forEach(el => {
        el.classList.remove('active');
        if (parseInt(el.dataset.lesson) < n) el.classList.add('done');
        else el.classList.remove('done');
      });
      current = n;
      const next = document.getElementById('lesson-' + current);
      if (next) next.classList.add('active');
      const item = document.querySelector('.lesson-item[data-lesson="' + n + '"]');
      if (item) item.classList.add('active');
      updateUI();
      if (!silent) {
        const courseTop = document.getElementById('courseMain') ? document.getElementById('courseMain').offsetTop - 130 : 0;
        if (window.scrollY > courseTop) window.scrollTo({ top: courseTop, behavior: 'smooth' });
      }
      if (n === TOTAL && !silent) launchConfetti();
      localStorage.setItem('${escJs(key)}-lesson', n);
    }

    function navigate(dir) {
      const n = current + dir;
      if (n >= 1 && n <= TOTAL) goTo(n);
    }

    function updateUI() {
      const pct = TOTAL > 1 ? ((current - 1) / (TOTAL - 1) * 100).toFixed(0) : 100;
      const pf = document.getElementById('progressFill');
      if (pf) pf.style.width = pct + '%';
      const pt = document.getElementById('progressText');
      if (pt) pt.textContent = current + ' / ' + TOTAL;
      const lc = document.getElementById('lessonCounter');
      if (lc) lc.textContent = current + ' / ' + TOTAL;
      const prevBtn = document.getElementById('prevBtn');
      if (prevBtn) prevBtn.disabled = current === 1;
      const nextBtn = document.getElementById('nextBtn');
      const footer  = document.getElementById('lessonFooter');
      if (current === TOTAL) {
        if (footer) footer.style.display = 'none';
      } else {
        if (footer) footer.style.display = '';
        if (nextBtn) {
          nextBtn.disabled = false;
          nextBtn.onclick = () => navigate(1);
          nextBtn.textContent = current === TOTAL - 1 ? 'Finish' : 'Next →';
        }
      }
    }

    const savedLesson = parseInt(localStorage.getItem('${escJs(key)}-lesson')) || 1;
    goTo(Math.min(savedLesson, TOTAL), true);
    if (localStorage.getItem('${escJs(key)}-feedback')) {
      const lastItem = document.querySelector('.lesson-item[data-lesson="' + TOTAL + '"]');
      if (lastItem) { lastItem.classList.add('done'); lastItem.classList.remove('active'); }
      const ft = document.getElementById('feedbackThanks');
      if (ft) { ft.textContent = 'Thanks for your feedback!'; ft.classList.add('visible'); }
    }

    // Slides
    function initDots(deckId) {
      const deck = document.getElementById(deckId);
      if (!deck) return;
      const slides = deck.querySelectorAll('.slide');
      const dots = document.getElementById('dots-' + deckId);
      if (!dots) return;
      dots.innerHTML = '';
      slides.forEach((_, i) => {
        const d = document.createElement('button');
        d.className = 'slide-dot' + (i === 0 ? ' active' : '');
        d.setAttribute('aria-label', 'Slide ' + (i + 1));
        d.onclick = () => goToSlide(deckId, i);
        dots.appendChild(d);
      });
    }
    function goToSlide(deckId, idx) {
      const deck = document.getElementById(deckId);
      if (!deck) return;
      deck.querySelectorAll('.slide').forEach((s, i) => s.classList.toggle('active', i === idx));
      const dotsEl = document.getElementById('dots-' + deckId);
      if (dotsEl) dotsEl.querySelectorAll('.slide-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
      const prevBtn = document.getElementById('prev-' + deckId);
      const nextBtn = document.getElementById('next-' + deckId);
      const slides = deck.querySelectorAll('.slide');
      if (prevBtn) prevBtn.disabled = idx === 0;
      if (nextBtn) nextBtn.disabled = idx === slides.length - 1;
    }
    function currentSlideIdx(deckId) {
      const deck = document.getElementById(deckId);
      return deck ? [...deck.querySelectorAll('.slide')].findIndex(s => s.classList.contains('active')) : 0;
    }
    function nextSlide(deckId) {
      const slides = document.getElementById(deckId) ? document.getElementById(deckId).querySelectorAll('.slide') : [];
      goToSlide(deckId, Math.min(currentSlideIdx(deckId) + 1, slides.length - 1));
    }
    function prevSlide(deckId) {
      goToSlide(deckId, Math.max(currentSlideIdx(deckId) - 1, 0));
    }
    document.querySelectorAll('.slide-deck').forEach(deck => initDots(deck.id));

    // Agamotto
    document.querySelectorAll('.agamotto').forEach(ag => {
      const slider  = ag.querySelector('.agamotto-slider');
      const steps   = ag.querySelectorAll('.agamotto-step');
      const counter = ag.querySelector('.agamotto-counter');
      function showStep(idx) {
        steps.forEach((s,i) => s.classList.toggle('active', i === idx));
        if (counter) counter.textContent = (idx+1) + ' / ' + steps.length;
      }
      if (slider) {
        slider.max = steps.length - 1;
        slider.addEventListener('input', () => showStep(parseInt(slider.value)));
      }
      showStep(0);
    });

    // Juxtapose
    document.querySelectorAll('.juxtapose-stage').forEach(stage => {
      const beforeDiv = stage.querySelector('.juxtapose-before');
      const handle    = stage.querySelector('.juxtapose-handle');
      let dragging = false;
      function setPos(clientX) {
        const rect = stage.getBoundingClientRect();
        const pct  = Math.max(0, Math.min(100, (clientX - rect.left) / rect.width * 100));
        if (beforeDiv) beforeDiv.style.width = pct + '%';
        if (handle)    handle.style.left = pct + '%';
      }
      stage.addEventListener('mousedown',  e => { dragging = true; setPos(e.clientX); });
      stage.addEventListener('touchstart', e => { dragging = true; setPos(e.touches[0].clientX); }, {passive:true});
      document.addEventListener('mousemove',  e => { if (dragging) setPos(e.clientX); });
      document.addEventListener('touchmove',  e => { if (dragging) setPos(e.touches[0].clientX); }, {passive:true});
      document.addEventListener('mouseup',  () => dragging = false);
      document.addEventListener('touchend', () => dragging = false);
      setPos(stage.getBoundingClientRect().left + stage.getBoundingClientRect().width / 2);
    });

    // Hotspots
    document.querySelectorAll('.hotspot').forEach(hs => {
      hs.addEventListener('click', e => {
        e.stopPropagation();
        const id = hs.dataset.tooltip;
        const tooltip = document.getElementById(id);
        if (!tooltip) return;
        const isOpen = tooltip.classList.contains('open');
        document.querySelectorAll('.hotspot-tooltip').forEach(t => t.classList.remove('open'));
        document.querySelectorAll('.hotspot').forEach(h => h.classList.remove('active'));
        if (!isOpen) { tooltip.classList.add('open'); hs.classList.add('active'); }
      });
    });
    document.querySelectorAll('.tooltip-close').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        btn.closest('.hotspot-tooltip').classList.remove('open');
        document.querySelectorAll('.hotspot').forEach(h => h.classList.remove('active'));
      });
    });
    document.addEventListener('click', () => {
      document.querySelectorAll('.hotspot-tooltip').forEach(t => t.classList.remove('open'));
      document.querySelectorAll('.hotspot').forEach(h => h.classList.remove('active'));
    });

    // Quiz
    function checkQuiz(quizId, correct, okMsg, wrongMsg) {
      const quiz = document.getElementById(quizId);
      if (!quiz) return;
      const selected = quiz.querySelector('input[type="radio"]:checked');
      const fb = document.getElementById('feedback-' + quizId);
      if (!selected) { fb.textContent = 'Bitte eine Antwort wählen.'; fb.className = 'quiz-feedback show neutral'; return; }
      fb.textContent = selected.value === correct ? (okMsg || 'Richtig!') : (wrongMsg || 'Nicht ganz.');
      fb.className   = 'quiz-feedback show ' + (selected.value === correct ? 'correct' : 'wrong');
    }
    function checkMulti(quizId, correct, okMsg, wrongMsg) {
      const quiz = document.getElementById(quizId);
      if (!quiz) return;
      const selected = [...quiz.querySelectorAll('input[type="checkbox"]:checked')].map(i => i.value).sort();
      const fb = document.getElementById('feedback-' + quizId);
      if (selected.length === 0) { fb.textContent = 'Bitte mindestens eine Antwort wählen.'; fb.className = 'quiz-feedback show neutral'; return; }
      const ok = JSON.stringify(selected) === JSON.stringify([...correct].sort());
      fb.textContent = ok ? (okMsg || 'Richtig!') : (wrongMsg || 'Nicht ganz.');
      fb.className   = 'quiz-feedback show ' + (ok ? 'correct' : 'wrong');
    }

    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) sidebarToggle.addEventListener('click', function() {
      document.querySelector('.course-layout').classList.toggle('sidebar-collapsed');
    });

    // Quicknotes
    (function() {
      var NOTES_KEY = '${escJs(key)}-notes';
      var area     = document.getElementById('quicknotesArea');
      var savedEl  = document.getElementById('quicknotesSaved');
      var clearBtn = document.getElementById('quicknotesClear');
      var fab      = document.getElementById('quicknotesToggle');
      var panel    = document.getElementById('quicknotesPanel');
      if (!area) return;
      area.value = localStorage.getItem(NOTES_KEY) || '';
      var saveTimer;
      area.addEventListener('input', function() {
        clearTimeout(saveTimer);
        savedEl.textContent = '';
        saveTimer = setTimeout(function() {
          localStorage.setItem(NOTES_KEY, area.value);
          savedEl.textContent = 'Saved';
          setTimeout(function() { savedEl.textContent = ''; }, 2000);
        }, 600);
      });
      if (clearBtn) clearBtn.addEventListener('click', function() {
        if (!area.value) return;
        if (confirm('Clear all notes?')) { area.value = ''; localStorage.removeItem(NOTES_KEY); }
      });
      if (fab && panel) fab.addEventListener('click', function() {
        var isOpen = panel.classList.toggle('open');
        fab.classList.toggle('active', isOpen);
      });
    })();
  `;
}

// ── Block picker modal ───────────────────────────────────────────
function openBlockPicker(lessonIdx) {
  pendingBlockLessonIdx = lessonIdx;
  const grid = document.getElementById('blockPickerGrid');
  grid.innerHTML = BLOCK_TYPES.map(bt => `
    <button class="au-block-pick-btn" data-pick-type="${bt.id}">
      <span class="au-block-pick-icon">${bt.icon}</span>
      <span class="au-block-pick-label">${bt.label}</span>
    </button>`).join('');
  document.getElementById('blockPickerOverlay').classList.add('open');
}

function closeBlockPicker() {
  document.getElementById('blockPickerOverlay').classList.remove('open');
  pendingBlockLessonIdx = null;
}

// ── Export ───────────────────────────────────────────────────────
function exportHtml() {
  if (!state.lessons.length) { toast('Keine Lektionen vorhanden.'); return; }
  const html = generateCourseHtml();
  const blob = new Blob([html], { type:'text/html' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = (state.meta.storageKey || 'course') + '.html';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('HTML exportiert.');
}

function saveJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type:'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = (state.meta.storageKey || 'course') + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('JSON gespeichert.');
}

function loadJson(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      state = JSON.parse(e.target.result);
      sel   = { type:null, lessonIdx:null, blockIdx:null };
      saveState();
      renderAll();
      document.getElementById('courseTitleDisplay').textContent = state.meta.title || 'New Course';
      toast('Kurs geladen.');
    } catch(err) {
      toast('Fehler beim Laden der JSON-Datei.');
    }
  };
  reader.readAsText(file);
}

// ── Render all ───────────────────────────────────────────────────
function renderAll() {
  renderOutline();
  renderEditor();
  schedulePreview();
}

// ── Event handling ────────────────────────────────────────────────
document.addEventListener('click', e => {
  const t = e.target;

  // Outline: select meta
  if (t.closest('[data-sel="meta"]')) {
    sel = { type:'meta', lessonIdx:null, blockIdx:null };
    renderAll(); return;
  }

  // Outline: select lesson
  if (t.closest('[data-sel="lesson"]') && !t.closest('[data-del-lesson]')) {
    const li = parseInt(t.closest('[data-sel="lesson"]').dataset.li);
    sel = sel.type==='lesson' && sel.lessonIdx===li
      ? { type:null, lessonIdx:null, blockIdx:null }
      : { type:'lesson', lessonIdx:li, blockIdx:null };
    renderAll(); return;
  }

  // Outline: select block
  if (t.closest('[data-sel="block"]') && !t.closest('[data-del-block]')) {
    const el = t.closest('[data-sel="block"]');
    const li = parseInt(el.dataset.li);
    const bi = parseInt(el.dataset.bi);
    sel = { type:'block', lessonIdx:li, blockIdx:bi };
    renderAll(); return;
  }

  // Outline: delete lesson
  if (t.closest('[data-del-lesson]')) {
    e.stopPropagation();
    const li = parseInt(t.closest('[data-del-lesson]').dataset.delLesson || t.dataset.delLesson);
    if (!confirm('Lektion löschen?')) return;
    state.lessons.splice(li, 1);
    sel = { type:null, lessonIdx:null, blockIdx:null };
    saveState(); renderAll(); return;
  }

  // Outline: delete block
  if (t.closest('[data-del-block]')) {
    e.stopPropagation();
    const key = (t.closest('[data-del-block]') || t).dataset.delBlock || t.dataset.delBlock;
    if (!key) return;
    const [li, bi] = key.split('-').map(Number);
    if (!confirm('Block löschen?')) return;
    state.lessons[li].blocks.splice(bi, 1);
    sel = { type:'lesson', lessonIdx:li, blockIdx:null };
    saveState(); renderAll(); return;
  }

  // Outline: open block picker
  if (t.closest('[data-open-picker]')) {
    const li = parseInt((t.closest('[data-open-picker]') || t).dataset.openPicker);
    openBlockPicker(li); return;
  }

  // Add lesson btn in outline
  if (t.closest('#addLessonBtn') || t.id === 'addLessonBtn') {
    const li = state.lessons.length;
    state.lessons.push({ title:'Neue Lektion', blocks:[] });
    sel = { type:'lesson', lessonIdx:li, blockIdx:null };
    saveState(); renderAll(); return;
  }

  // Header: add lesson
  if (t.id === 'btnAddLesson') {
    const li = state.lessons.length;
    state.lessons.push({ title:'Neue Lektion', blocks:[] });
    sel = { type:'lesson', lessonIdx:li, blockIdx:null };
    saveState(); renderAll(); return;
  }

  // Block picker: pick a type
  if (t.closest('[data-pick-type]')) {
    const type = (t.closest('[data-pick-type]') || t).dataset.pickType;
    if (pendingBlockLessonIdx === null) return;
    state.lessons[pendingBlockLessonIdx].blocks.push(DEFAULTS[type]());
    const bi = state.lessons[pendingBlockLessonIdx].blocks.length - 1;
    sel = { type:'block', lessonIdx:pendingBlockLessonIdx, blockIdx:bi };
    closeBlockPicker();
    saveState(); renderAll(); return;
  }

  // Close block picker
  if (t.id === 'closeBlockPicker' || t.id === 'blockPickerOverlay') {
    closeBlockPicker(); return;
  }

  // Editor: Add slide
  if (t.dataset.addSlide !== undefined) {
    const b = state.lessons[sel.lessonIdx].blocks[sel.blockIdx];
    b.slides.push({ heading:'', body:'' });
    saveState(); renderEditor(); schedulePreview(); return;
  }
  // Editor: Remove slide
  if (t.dataset.rmSlide !== undefined) {
    const b = state.lessons[sel.lessonIdx].blocks[sel.blockIdx];
    b.slides.splice(+t.dataset.rmSlide, 1);
    saveState(); renderEditor(); schedulePreview(); return;
  }

  // Editor: Add accordion item
  if (t.dataset.addAcc !== undefined) {
    const b = state.lessons[sel.lessonIdx].blocks[sel.blockIdx];
    b.items.push({ trigger:'', content:'' });
    saveState(); renderEditor(); schedulePreview(); return;
  }
  if (t.dataset.rmAcc !== undefined) {
    const b = state.lessons[sel.lessonIdx].blocks[sel.blockIdx];
    b.items.splice(+t.dataset.rmAcc, 1);
    saveState(); renderEditor(); schedulePreview(); return;
  }

  // Editor: Add/remove flip card
  if (t.dataset.addCard !== undefined) {
    const b = state.lessons[sel.lessonIdx].blocks[sel.blockIdx];
    b.cards.push({ label:'Claim '+(b.cards.length+1), question:'', title:'', answer:'' });
    saveState(); renderEditor(); schedulePreview(); return;
  }
  if (t.dataset.rmCard !== undefined) {
    const b = state.lessons[sel.lessonIdx].blocks[sel.blockIdx];
    b.cards.splice(+t.dataset.rmCard, 1);
    saveState(); renderEditor(); schedulePreview(); return;
  }

  // Editor: Add/remove agamotto step
  if (t.dataset.addAga !== undefined) {
    const b = state.lessons[sel.lessonIdx].blocks[sel.blockIdx];
    b.steps.push({ image:'', caption:'' });
    saveState(); renderEditor(); schedulePreview(); return;
  }
  if (t.dataset.rmAga !== undefined) {
    const b = state.lessons[sel.lessonIdx].blocks[sel.blockIdx];
    b.steps.splice(+t.dataset.rmAga, 1);
    saveState(); renderEditor(); schedulePreview(); return;
  }

  // Editor: Add/remove quiz question
  if (t.dataset.addQ !== undefined) {
    const b = state.lessons[sel.lessonIdx].blocks[sel.blockIdx];
    b.questions.push({ text:'', multi:false, options:[{text:'',correct:true},{text:'',correct:false}], okMsg:'', wrongMsg:'' });
    saveState(); renderEditor(); schedulePreview(); return;
  }
  if (t.dataset.rmQ !== undefined) {
    const b = state.lessons[sel.lessonIdx].blocks[sel.blockIdx];
    b.questions.splice(+t.dataset.rmQ, 1);
    saveState(); renderEditor(); schedulePreview(); return;
  }

  // Editor: Add/remove quiz option
  if (t.dataset.addOpt !== undefined) {
    const b = state.lessons[sel.lessonIdx].blocks[sel.blockIdx];
    b.questions[+t.dataset.addOpt].options.push({ text:'', correct:false });
    saveState(); renderEditor(); schedulePreview(); return;
  }
  if (t.dataset.rmOpt !== undefined) {
    const b = state.lessons[sel.lessonIdx].blocks[sel.blockIdx];
    const [qi, oi] = t.dataset.rmOpt.split('-').map(Number);
    b.questions[qi].options.splice(oi, 1);
    saveState(); renderEditor(); schedulePreview(); return;
  }

  // Header buttons
  if (t.id === 'btnExport') { exportHtml(); return; }
  if (t.id === 'btnSave')   { saveJson();  return; }
  if (t.id === 'btnLoad')   { document.getElementById('fileInput').click(); return; }
  if (t.id === 'btnNew') {
    if (!confirm('Neuen Kurs starten? Ungespeicherte Änderungen gehen verloren.')) return;
    state = { meta:{title:'New Course',storageKey:'course-new',backLink:'../hub.html',backLabel:'Coffee Hours'}, lessons:[] };
    sel   = { type:null, lessonIdx:null, blockIdx:null };
    localStorage.removeItem('au-state');
    document.getElementById('courseTitleDisplay').textContent = 'New Course';
    renderAll(); return;
  }
  if (t.id === 'btnPreviewRefresh') { updatePreview(); return; }
});

// Editor: form input changes
document.addEventListener('input', e => {
  const t = e.target;
  if (!t.name) return;

  // Checkbox (au-opt-correct)
  if (t.type === 'checkbox') {
    applyField(t.name, t.checked);
  } else {
    applyField(t.name, t.value);
  }

  // Update course title display live
  if (t.name === 'meta.title') {
    document.getElementById('courseTitleDisplay').textContent = t.value || 'New Course';
  }
  // Update lesson title in outline live
  if (t.name === 'lesson.title') {
    renderOutline();
  }

  saveState();
  schedulePreview();
});

// Select change
document.addEventListener('change', e => {
  const t = e.target;
  if (!t.name) return;
  applyField(t.name, t.value);
  // Re-render quiz editor if type toggled (multi/single)
  if (t.name.startsWith('q.') && t.name.endsWith('.multi')) {
    renderEditor();
  }
  saveState();
  schedulePreview();
});

// File input
document.getElementById('fileInput').addEventListener('change', e => {
  if (e.target.files[0]) loadJson(e.target.files[0]);
  e.target.value = '';
});

// ── Init ──────────────────────────────────────────────────────────
async function init() {
  // Fetch course CSS for preview
  try {
    const [styleCss, courseCss] = await Promise.all([
      fetch('../css/style.css').then(r => r.text()),
      fetch('../css/course.css').then(r => r.text()),
    ]);
    previewCss = styleCss + '\n' + courseCss;
  } catch(e) {
    previewCss = '/* CSS not available offline */';
  }
  try {
    previewMainJs = await fetch('../js/main.js').then(r => r.text());
  } catch(e) {
    previewMainJs = '';
  }

  loadState();
  document.getElementById('courseTitleDisplay').textContent = state.meta.title || 'New Course';
  renderAll();
}

init();
