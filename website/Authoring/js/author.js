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
  meta: { title:'New Course', storageKey:'course-new', backLink:'../hub.html', backLabel:'Coffee Hours', format:'stage' },
  lessons: []
};

let sel = { type:null, lessonIdx:null, blockIdx:null };
// sel.type: 'meta' | 'lesson' | 'block' | null

let pendingBlockLessonIdx = null;
let previewCss = '';
let previewMainJs = '';
let previewDirty = true;
let previewTimer = null;
let publishedCourses = []; // loaded from courses/index.json for path picker

// ── Path designer state ─────────────────────────────────────────
let pathsList = [];
let selPath   = null; // id of selected path

function savePathsList() {
  localStorage.setItem('au-paths', JSON.stringify(pathsList));
}
function loadPathsList() {
  try { pathsList = JSON.parse(localStorage.getItem('au-paths') || '[]'); } catch(e) { pathsList = []; }
}
function pathById(id) { return pathsList.find(p => p.id === id) || null; }

// ── Persistence ─────────────────────────────────────────────────
function saveState() {
  localStorage.setItem('au-state', JSON.stringify(state));
  const key = state.meta.storageKey;
  if (key) localStorage.setItem('au-course-' + key, JSON.stringify(state));
}
function loadState(courseKey) {
  const stored = courseKey
    ? (localStorage.getItem('au-course-' + courseKey) || localStorage.getItem('au-state'))
    : localStorage.getItem('au-state');
  if (stored) { try { state = JSON.parse(stored); } catch(e) {} }
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

  // Paths section
  html += `<div class="au-outline-section-sep">
    <span>Lernpfade</span>
    <button class="au-icon-btn" id="btnAddPath" title="Neuen Lernpfad erstellen">+</button>
  </div>`;
  pathsList.forEach(p => {
    html += `<div class="au-outline-path-item ${selPath===p.id?'selected':''}" data-path="${p.id}">
      <span style="opacity:0.45">⟳</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.title||'Neuer Pfad')}</span>
      <button class="au-outline-del" data-del-path="${p.id}">×</button>
    </div>`;
  });

  c.innerHTML = html;
}

// ── Editor ───────────────────────────────────────────────────────
function renderEditor() {
  const c = document.getElementById('editorContent');
  if (selPath) {
    const p = pathById(selPath);
    if (p) { c.innerHTML = editorPath(p); return; }
  }
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

// ── Path editor ──────────────────────────────────────────────────
function slugify(s) {
  return String(s||'').toLowerCase()
    .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50) || 'pfad';
}

function editorPath(path) {
  const levels  = ['Einsteiger','Fortgeschritten','Experte'];
  const levelSel = levels.map(lv =>
    `<option value="${lv}" ${path.level===lv?'selected':''}>${lv}</option>`
  ).join('');

  // Course picker options (from publishedCourses loaded at init)
  const coursePickerOpts = publishedCourses.length
    ? `<option value="">— Kurs auswählen —</option>` +
      publishedCourses.map(c =>
        `<option value="${esc(c.key)}" ${path._tmpPickKey===c.key?'selected':''}>${esc(c.title)}</option>`
      ).join('')
    : null;

  const stepHtml = (path.steps||[]).map((step, si) => {
    const typeSel = ['course','checkin'].map(t =>
      `<option value="${t}" ${step.type===t?'selected':''}>${t==='course'?'Kurs':'Check-in / Reflexion'}</option>`
    ).join('');

    const courseFields = step.type !== 'checkin' ? `
      ${coursePickerOpts ? `
        <div class="au-field">
          <label class="au-label">Kurs auswählen</label>
          <select class="au-select au-course-picker" data-step="${si}">${
            coursePickerOpts.replace(
              `value="${esc(step.courseKey)}"`,
              `value="${esc(step.courseKey)}" selected`
            )
          }</select>
        </div>
      ` : ''}
      <div class="au-field">
        <label class="au-label">Kurs-Key</label>
        <input class="au-input" type="text" name="step.${si}.courseKey" value="${esc(step.courseKey||'')}" placeholder="z.B. transformer-attention">
        <p class="au-hint">Der storageKey aus den Kurs-Einstellungen.</p>
      </div>
      <div class="au-field">
        <label class="au-label">Kurs-URL</label>
        <input class="au-input" type="text" name="step.${si}.courseUrl" value="${esc(step.courseUrl||'')}" placeholder="courses/mein-kurs.html">
      </div>
      <div class="au-field">
        <label class="au-label">Reflexionsfrage</label>
        <input class="au-input" type="text" name="step.${si}.reflection" value="${esc(step.reflection||'')}" placeholder="Was war die überraschendste Erkenntnis für dich?">
        <p class="au-hint">Wird nach dem Kurs angezeigt, bevor der nächste Schritt freigeschaltet wird.</p>
      </div>
      <div class="au-field">
        <label class="au-label">Adaptiver Hinweis</label>
        <input class="au-input" type="text" name="step.${si}.adaptiveHint" value="${esc(step.adaptiveHint||'')}" placeholder="Schau noch einmal Lektion … an, bevor du weitermachst.">
        <p class="au-hint">Erscheint automatisch, wenn Lernende ihre Sicherheit mit 1 oder 2 Sternen bewerten.</p>
      </div>
    ` : `
      <div class="au-field">
        <label class="au-label">Reflexionsprompt</label>
        <textarea class="au-textarea" name="step.${si}.prompt" rows="2" placeholder="Erkläre in eigenen Worten: …">${esc(step.prompt||'')}</textarea>
        <p class="au-hint">Die konkrete Frage, über die Lernende nachdenken sollen.</p>
      </div>
      <div class="au-field">
        <label class="au-label">Hinweis (aufklappbar)</label>
        <input class="au-input" type="text" name="step.${si}.hint" value="${esc(step.hint||'')}" placeholder="Denke an die Analogie aus Lektion 2 …">
        <p class="au-hint">Optionaler Denkanstoß, den Lernende selbst aufklappen können.</p>
      </div>
    `;

    return `<div class="au-path-step-block">
      <div class="au-path-step-header">
        <span class="au-path-step-num">${si+1}</span>
        <strong style="flex:1;font-size:0.85rem">${esc(step.title||'Schritt '+(si+1))}</strong>
        <button class="au-icon-btn au-outline-del" data-del-step="${si}" title="Schritt löschen">×</button>
      </div>
      <div class="au-field">
        <label class="au-label">Typ</label>
        <select class="au-select" name="step.${si}.type">${typeSel}</select>
      </div>
      <div class="au-field">
        <label class="au-label">Titel des Schritts</label>
        <input class="au-input" type="text" name="step.${si}.title" value="${esc(step.title||'')}" placeholder="Sichtbarer Name in der Fortschrittsleiste">
      </div>
      ${courseFields}
      <div class="au-field">
        <label class="au-label">Geschätzte Zeit (Min.)</label>
        <input class="au-input" type="number" name="step.${si}.estimatedMin" value="${step.estimatedMin||''}" min="1" max="180" placeholder="20">
      </div>
    </div>`;
  }).join('');

  const noSteps = !(path.steps||[]).length;

  return `<div class="au-section-header">
    <span class="au-section-title">Lernpfad</span>
    <button class="au-btn au-btn-publish" id="btnPublishPath" style="margin-left:auto">
      <span id="publishPathLabel">Pfad veröffentlichen</span>
      <span id="publishPathSpinner" style="display:none">⟳</span>
    </button>
  </div>

  <div class="au-card">
    <div class="au-field">
      <label class="au-label">Titel <span style="color:var(--magenta)">*</span></label>
      <input class="au-input" type="text" name="path.title" value="${esc(path.title||'')}" placeholder="KI-Einstieg: Konzepte verstehen" id="pathTitleInput">
    </div>
    <div class="au-field">
      <label class="au-label">URL-Slug (Pfad-ID)</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input class="au-input" type="text" name="path.id" value="${esc(path.id||'')}" placeholder="ki-einstieg" id="pathSlugInput" style="font-family:monospace;font-size:0.82rem">
        <button class="au-btn au-btn-ghost" id="btnAutoSlug" title="Aus Titel generieren" style="white-space:nowrap;font-size:0.75rem;padding:6px 10px">↺ Auto</button>
      </div>
      <p class="au-hint">Sichtbar in der URL: /path.html?path=<strong id="slugPreview">${esc(path.id||'…')}</strong></p>
    </div>
    <div class="au-field">
      <label class="au-label">Untertitel</label>
      <input class="au-input" type="text" name="path.subtitle" value="${esc(path.subtitle||'')}" placeholder="Von der Theorie zur Praxis">
    </div>
    <div class="au-field">
      <label class="au-label">Beschreibung (Katalogkarte)</label>
      <textarea class="au-textarea" name="path.description" rows="3" placeholder="Was lernen deine Teilnehmenden? Was können sie danach?">${esc(path.description||'')}</textarea>
    </div>
    <div class="au-settings-row">
      <div class="au-field">
        <label class="au-label">Level</label>
        <select class="au-select" name="path.level">${levelSel}</select>
      </div>
      <div class="au-field">
        <label class="au-label">Gesamtzeit (Min.)</label>
        <input class="au-input" type="number" name="path.estimatedMin" value="${path.estimatedMin||''}" placeholder="45">
      </div>
    </div>
    <div class="au-field">
      <label class="au-label">Themen (kommagetrennt)</label>
      <input class="au-input" type="text" name="path.topics" value="${esc((path.topics||[]).join(','))}" placeholder="ai, learning">
    </div>
  </div>

  <div class="au-card" style="margin-top:12px">
    <div class="au-section-title" style="margin-bottom:14px">Prozesssicherung</div>
    <div class="au-field">
      <label class="au-label">Lernziel-Vorlage</label>
      <textarea class="au-textarea" name="path.goal" rows="2" placeholder="Verstehe, wie moderne KI-Systeme grundsätzlich funktionieren …">${esc(path.goal||'')}</textarea>
      <p class="au-hint">Lernende sehen diesen Text vorausgefüllt und können ihn personalisieren.</p>
    </div>
    <div class="au-field">
      <label class="au-label">Verhaltensanker-Vorlage (Wenn-dann-um-Formel)</label>
      <textarea class="au-textarea" name="path.behavioralAnchorTemplate" rows="2" placeholder="Wenn ich auf ein neues KI-Tool stoße, wende ich die Konzepte aus diesem Lernpfad an, um es kritisch einzuordnen.">${esc(path.behavioralAnchorTemplate||'')}</textarea>
      <p class="au-hint">Implementation Intention: hilft Lernenden, das Gelernte an konkrete Situationen zu knüpfen.</p>
    </div>
  </div>

  <div class="au-section-header" style="margin-top:20px">
    <span class="au-section-title">Schritte ${(path.steps||[]).length ? '(' + path.steps.length + ')' : ''}</span>
  </div>
  ${noSteps ? `<p class="au-hint" style="margin-bottom:12px">Noch keine Schritte. Füge Kurse und Reflexionen hinzu, um den Lernpfad zu strukturieren.</p>` : ''}
  <div id="pathStepsContainer">${stepHtml}</div>
  <div style="display:flex;gap:8px;margin:8px 0 32px">
    <button class="au-btn au-btn-ghost" id="btnAddCourseStep">+ Kurs-Schritt</button>
    <button class="au-btn au-btn-ghost" id="btnAddCheckinStep">+ Reflexion</button>
  </div>`;
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
function imgField(label, name, value) {
  return `<div class="au-field">
    <label class="au-label">${label}</label>
    <div class="au-img-row">
      <input class="au-input" type="text" name="${name}" value="${esc(value)}" placeholder="https://... oder ↑ Upload">
      <button class="au-img-upload-btn" data-upload-for="${name}" type="button">↑ Upload</button>
    </div>
  </div>`;
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
    ${sel_('Kursformat','meta.format',[
      {id:'stage',  label:'Stage (horizontale Lektionsnavigation)'},
      {id:'scroll', label:'Endless Scroll (vertikales Scrollen)'},
    ], m.format||'stage')}
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
      ${imgField('Bild',`aga.${si}.image`,s.image)}
      ${ta('Beschriftung / Text',`aga.${si}.caption`,s.caption,2)}
    </div>`;
  });
  return html + `<button class="au-btn au-btn-add" data-add-aga>+ Schritt hinzufügen</button>`;
}

function edJuxtapose(b) {
  return ta('Intro-Text (optional)','juxtapose.intro',b.intro||'',2)
       + imgField('Vorher-Bild','juxtapose.beforeImage',b.beforeImage)
       + f('Vorher-Label','juxtapose.beforeLabel',b.beforeLabel)
       + imgField('Nachher-Bild','juxtapose.afterImage',b.afterImage)
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

// ── Scroll preview ───────────────────────────────────────────────
function generateScrollPreviewHtml() {
  const titles = state.lessons.map(l => l.title || 'Lektion');
  const total  = state.lessons.length;
  const tocHtml = titles.map((t,i) => `
    <li class="lesson-item" id="toc-${i+1}" data-lesson="${i+1}">
      <a class="toc-anchor" href="#section-${i+1}" style="text-decoration:none;color:inherit;display:flex;align-items:center;gap:10px;">
        <span class="lesson-num">${i+1}</span><span class="lesson-name">${esc(t)}</span>
      </a>
    </li>`).join('');
  let sectionsHtml = '';
  state.lessons.forEach((lesson, li) => {
    sectionsHtml += `<div class="scroll-section" id="section-${li+1}" data-section="${li+1}" style="padding:40px 0;border-bottom:1px solid rgba(22,11,82,0.06);">
      <h2 class="lesson-title">${esc(lesson.title || 'Lektion ' + (li+1))}</h2>
      ${lesson.blocks.map((b,bi) => generateBlockHtml(b,li,bi)).join('\n')}
    </div>`;
  });
  return `<!DOCTYPE html><html lang="de"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(state.meta.title)}</title>
<style>${previewCss}
.scroll-section:last-child{padding-bottom:80px;border-bottom:none;}
</style></head>
<body class="course-page">
<nav class="nav scrolled" id="nav">
  <a href="#" class="nav-logo">${esc('schmidpower')}</a>
  <div class="nav-right"><a href="#" class="nav-link">Coffee Hours</a><a href="#" class="nav-btn">Join me on Substack</a></div>
</nav>
<header class="course-header">
  <div class="course-header-inner">
    <div class="course-meta"><h1 class="course-title">${esc(state.meta.title)}</h1></div>
    <div class="course-progress">
      <span class="progress-text" id="progressText">0%</span>
      <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
    </div>
  </div>
</header>
<div class="course-layout">
  <div class="sidebar-wrap">
    <aside class="course-sidebar"><nav><ul class="lesson-list" id="lessonList">${tocHtml}</ul></nav></aside>
    <button class="sidebar-toggle" id="sidebarToggle"><span></span><span></span><span></span></button>
  </div>
  <main class="course-main" id="courseMain">${sectionsHtml}</main>
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
  <div class="quicknotes-footer"><span class="quicknotes-saved" id="quicknotesSaved"></span><button class="quicknotes-clear" id="quicknotesClear">Clear</button></div>
</div>
<script>
${previewMainJs}
${inlineScrollCourseJs(state, total, titles)}
</script>
</body></html>`;
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
  if ((state.meta.format || 'stage') === 'scroll') return generateScrollPreviewHtml();
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

// ── Scroll format generators ─────────────────────────────────────
function generateScrollCourseHtml() {
  const m      = state.meta;
  const titles = state.lessons.map(l => l.title || 'Lektion');
  const total  = state.lessons.length;
  const tocHtml = titles.map((t,i) => `
    <li class="lesson-item" id="toc-${i+1}" data-lesson="${i+1}">
      <a class="toc-anchor" href="#section-${i+1}">
        <span class="lesson-num">${i+1}</span>
        <span class="lesson-name">${esc(t)}</span>
      </a>
    </li>`).join('');
  let sectionsHtml = '';
  state.lessons.forEach((lesson, li) => {
    sectionsHtml += `
      <div class="scroll-section" id="section-${li+1}" data-section="${li+1}">
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
  <style>
    .scroll-section { padding: 40px 0; border-bottom: 1px solid rgba(22,11,82,0.06); }
    .scroll-section:last-child { border-bottom: none; padding-bottom: 80px; }
    .toc-anchor { text-decoration: none; color: inherit; display: flex; align-items: center; gap: 10px; width: 100%; }
    .toc-anchor:hover .lesson-name { color: var(--magenta); }
  </style>
</head>
<body class="course-page">
  <nav class="nav scrolled" id="nav">
    <a href="../index.html" class="nav-logo">schmidpower</a>
    <div class="nav-right">
      <a href="${esc(m.backLink)}" class="nav-link">${esc(m.backLabel)}</a>
      <a href="../ueber-mich.html" class="nav-link">About</a>
      <a href="https://substack.com/prohelias" target="_blank" rel="noopener" class="nav-btn">Join me on Substack</a>
    </div>
    <button class="nav-toggle" id="navToggle" aria-label="Menu"><span></span><span></span><span></span></button>
  </nav>
  <div class="nav-mobile" id="navMobile">
    <a href="../index.html" onclick="closeMobileMenu()">Home</a>
    <a href="${esc(m.backLink)}" onclick="closeMobileMenu()">${esc(m.backLabel)}</a>
    <a href="../ueber-mich.html" onclick="closeMobileMenu()">About</a>
  </div>
  <header class="course-header">
    <div class="course-header-inner">
      <div class="course-meta"><h1 class="course-title">${esc(m.title)}</h1></div>
      <div class="course-progress">
        <span class="progress-text" id="progressText">0%</span>
        <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
      </div>
    </div>
  </header>
  <div class="course-layout">
    <div class="sidebar-wrap">
      <aside class="course-sidebar">
        <nav aria-label="Inhalte"><ul class="lesson-list" id="lessonList">${tocHtml}</ul></nav>
      </aside>
      <button class="sidebar-toggle" id="sidebarToggle" aria-label="Toggle TOC">
        <span></span><span></span><span></span>
      </button>
    </div>
    <main class="course-main" id="courseMain">
${sectionsHtml}
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
${inlineScrollCourseJs(state, total, titles)}
  </script>
  <script>
  (function() {
    if (!localStorage.getItem('au-gh-token')) return;
    var btn = document.createElement('a');
    btn.href = '../Authoring/?edit=${escJs(m.storageKey)}';
    btn.title = 'Kurs bearbeiten';
    btn.style.cssText = 'position:fixed;bottom:80px;right:20px;z-index:9999;width:42px;height:42px;border-radius:50%;background:#160B52;color:#fff;display:flex;align-items:center;justify-content:center;text-decoration:none;font-size:18px;box-shadow:0 2px 12px rgba(22,11,82,0.35);opacity:0.8;transition:opacity 0.2s;';
    btn.onmouseenter = function() { this.style.opacity = '1'; };
    btn.onmouseleave = function() { this.style.opacity = '0.8'; };
    btn.innerHTML = '&#9998;';
    document.body.appendChild(btn);
  })();
  </script>
</body>
</html>`;
}

function inlineScrollCourseJs(state, total, titles) {
  const key = state.meta.storageKey || 'course-new';
  return `
    var pf = document.getElementById('progressFill');
    var pt = document.getElementById('progressText');
    function updateScrollProgress() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) { if (pf) pf.style.width = '100%'; if (pt) pt.textContent = '100%'; return; }
      var pct = Math.min(100, Math.round(window.scrollY / max * 100));
      if (pf) pf.style.width = pct + '%';
      if (pt) pt.textContent = pct + '%';
    }
    window.addEventListener('scroll', updateScrollProgress, { passive: true });
    updateScrollProgress();

    if ('IntersectionObserver' in window) {
      var tocOb = new IntersectionObserver(function(entries) {
        entries.forEach(function(e) {
          if (e.isIntersecting) {
            var n = e.target.dataset.section;
            document.querySelectorAll('.lesson-item').forEach(function(el) { el.classList.remove('active'); });
            var toc = document.getElementById('toc-' + n);
            if (toc) toc.classList.add('active');
          }
        });
      }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });
      document.querySelectorAll('.scroll-section').forEach(function(s) { tocOb.observe(s); });

      var confettiFired = false;
      function launchConfetti() {
        if (confettiFired) return; confettiFired = true;
        var colors = ['#FF00FF','#e909f6','#160B52','#7C3AED','#a78bfa','#fff'];
        var wrap = document.createElement('div');
        wrap.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10000;overflow:hidden;';
        document.body.appendChild(wrap);
        for (var i = 0; i < 120; i++) {
          var el = document.createElement('div');
          var c = colors[Math.floor(Math.random() * colors.length)];
          var l = Math.random() * 100, d = Math.random() * 1.6, dur = 2 + Math.random() * 2.5, w = 5 + Math.random() * 13;
          var drift = (Math.random() - 0.5) * 200, wobble = (Math.random() - 0.5) * 80;
          el.style.cssText = 'position:absolute;top:-20px;left:' + l + '%;width:' + w + 'px;height:' + w + 'px;background:' + c + ';border-radius:50%;opacity:0.95;animation:confettiFall ' + dur + 's ' + d + 's ease-in forwards;--drift:' + drift + 'px;--wobble:' + wobble + 'px;';
          wrap.appendChild(el);
        }
        setTimeout(function() { wrap.remove(); }, 7000);
      }
      var lastSec = document.querySelector('.scroll-section:last-child');
      if (lastSec) {
        var confOb = new IntersectionObserver(function(entries) { if (entries[0].isIntersecting) launchConfetti(); }, { threshold: 0.3 });
        confOb.observe(lastSec);
      }
    }

    function submitFeedback(btn) {
      document.querySelectorAll('.feedback-btn').forEach(function(b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
      var thanks = document.getElementById('feedbackThanks');
      if (thanks) { thanks.textContent = 'Thanks for your feedback!'; thanks.classList.add('visible'); }
      localStorage.setItem('${escJs(key)}-feedback', '1');
    }

    var sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) sidebarToggle.addEventListener('click', function() {
      document.querySelector('.course-layout').classList.toggle('sidebar-collapsed');
    });

    function initDots(deckId) {
      var deck = document.getElementById(deckId); if (!deck) return;
      var slides = deck.querySelectorAll('.slide'); var dots = document.getElementById('dots-' + deckId); if (!dots) return;
      dots.innerHTML = '';
      slides.forEach(function(_, i) { var d = document.createElement('button'); d.className = 'slide-dot' + (i===0?' active':''); d.setAttribute('aria-label','Slide '+(i+1)); d.onclick = function() { goToSlide(deckId, i); }; dots.appendChild(d); });
    }
    function goToSlide(deckId, idx) {
      var deck = document.getElementById(deckId); if (!deck) return;
      deck.querySelectorAll('.slide').forEach(function(s,i) { s.classList.toggle('active', i===idx); });
      var dotsEl = document.getElementById('dots-'+deckId); if (dotsEl) dotsEl.querySelectorAll('.slide-dot').forEach(function(d,i) { d.classList.toggle('active',i===idx); });
      var prev = document.getElementById('prev-'+deckId), next = document.getElementById('next-'+deckId), slides = deck.querySelectorAll('.slide');
      if (prev) prev.disabled = idx===0; if (next) next.disabled = idx===slides.length-1;
    }
    function currentSlideIdx(deckId) { var deck = document.getElementById(deckId); return deck ? Array.from(deck.querySelectorAll('.slide')).findIndex(function(s){return s.classList.contains('active');}) : 0; }
    function nextSlide(deckId) { var slides = document.getElementById(deckId)?document.getElementById(deckId).querySelectorAll('.slide'):[]; goToSlide(deckId, Math.min(currentSlideIdx(deckId)+1, slides.length-1)); }
    function prevSlide(deckId) { goToSlide(deckId, Math.max(currentSlideIdx(deckId)-1, 0)); }
    document.querySelectorAll('.slide-deck').forEach(function(deck) { initDots(deck.id); });

    document.querySelectorAll('.agamotto').forEach(function(ag) {
      var slider = ag.querySelector('.agamotto-slider'), steps = ag.querySelectorAll('.agamotto-step'), counter = ag.querySelector('.agamotto-counter');
      function showStep(idx) { steps.forEach(function(s,i){s.classList.toggle('active',i===idx);}); if(counter) counter.textContent=(idx+1)+' / '+steps.length; }
      if (slider) { slider.max = steps.length-1; slider.addEventListener('input', function() { showStep(parseInt(slider.value)); }); }
      showStep(0);
    });

    document.querySelectorAll('.juxtapose-stage').forEach(function(stage) {
      var beforeDiv = stage.querySelector('.juxtapose-before'), handle = stage.querySelector('.juxtapose-handle'), dragging = false;
      function setPos(x) { var rect=stage.getBoundingClientRect(), pct=Math.max(0,Math.min(100,(x-rect.left)/rect.width*100)); if(beforeDiv)beforeDiv.style.width=pct+'%'; if(handle)handle.style.left=pct+'%'; }
      stage.addEventListener('mousedown',function(e){dragging=true;setPos(e.clientX);});
      stage.addEventListener('touchstart',function(e){dragging=true;setPos(e.touches[0].clientX);},{passive:true});
      document.addEventListener('mousemove',function(e){if(dragging)setPos(e.clientX);});
      document.addEventListener('touchmove',function(e){if(dragging)setPos(e.touches[0].clientX);},{passive:true});
      document.addEventListener('mouseup',function(){dragging=false;}); document.addEventListener('touchend',function(){dragging=false;});
      setPos(stage.getBoundingClientRect().left+stage.getBoundingClientRect().width/2);
    });

    function checkQuiz(quizId, correct, okMsg, wrongMsg) {
      var quiz=document.getElementById(quizId); if(!quiz)return;
      var sel=quiz.querySelector('input[type="radio"]:checked'), fb=document.getElementById('feedback-'+quizId);
      if(!sel){fb.textContent='Bitte eine Antwort wählen.';fb.className='quiz-feedback show neutral';return;}
      fb.textContent=sel.value===correct?(okMsg||'Richtig!'):(wrongMsg||'Nicht ganz.');
      fb.className='quiz-feedback show '+(sel.value===correct?'correct':'wrong');
    }
    function checkMulti(quizId, correct, okMsg, wrongMsg) {
      var quiz=document.getElementById(quizId); if(!quiz)return;
      var sel=Array.from(quiz.querySelectorAll('input[type="checkbox"]:checked')).map(function(i){return i.value;}).sort();
      var fb=document.getElementById('feedback-'+quizId);
      if(sel.length===0){fb.textContent='Bitte mindestens eine Antwort wählen.';fb.className='quiz-feedback show neutral';return;}
      var ok=JSON.stringify(sel)===JSON.stringify(Array.from(correct).sort());
      fb.textContent=ok?(okMsg||'Richtig!'):(wrongMsg||'Nicht ganz.'); fb.className='quiz-feedback show '+(ok?'correct':'wrong');
    }

    document.querySelectorAll('.accordion-trigger').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var exp=this.getAttribute('aria-expanded')==='true'; this.setAttribute('aria-expanded',String(!exp));
        var panel=this.nextElementSibling; if(panel)panel.style.display=exp?'none':'block';
      });
    });

    (function() {
      var NOTES_KEY='${escJs(key)}-notes', area=document.getElementById('quicknotesArea'), savedEl=document.getElementById('quicknotesSaved'), clearBtn=document.getElementById('quicknotesClear'), fab=document.getElementById('quicknotesToggle'), panel=document.getElementById('quicknotesPanel');
      if(!area)return;
      area.value=localStorage.getItem(NOTES_KEY)||'';
      var saveTimer;
      area.addEventListener('input',function(){clearTimeout(saveTimer);savedEl.textContent='';saveTimer=setTimeout(function(){localStorage.setItem(NOTES_KEY,area.value);savedEl.textContent='Saved';setTimeout(function(){savedEl.textContent='';},2000);},600);});
      if(clearBtn)clearBtn.addEventListener('click',function(){if(!area.value)return;if(confirm('Clear all notes?')){area.value='';localStorage.removeItem(NOTES_KEY);}});
      if(fab&&panel)fab.addEventListener('click',function(){var isOpen=panel.classList.toggle('open');fab.classList.toggle('active',isOpen);});
    })();
  `;
}

// ── HTML Generator (export) ──────────────────────────────────────
function generateCourseHtml() {
  if ((state.meta.format || 'stage') === 'scroll') return generateScrollCourseHtml();
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

  <script>
  (function() {
    if (!localStorage.getItem('au-gh-token')) return;
    var btn = document.createElement('a');
    btn.href = '../Authoring/?edit=${escJs(m.storageKey)}';
    btn.title = 'Kurs bearbeiten';
    btn.setAttribute('aria-label', 'Kurs bearbeiten');
    btn.style.cssText = 'position:fixed;bottom:80px;right:20px;z-index:9999;width:42px;height:42px;border-radius:50%;background:#160B52;color:#fff;display:flex;align-items:center;justify-content:center;text-decoration:none;font-size:18px;box-shadow:0 2px 12px rgba(22,11,82,0.35);opacity:0.8;transition:opacity 0.2s;';
    btn.onmouseenter = function() { this.style.opacity = '1'; };
    btn.onmouseleave = function() { this.style.opacity = '0.8'; };
    btn.innerHTML = '&#9998;';
    document.body.appendChild(btn);
  })();
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

// ── Mobile preview ───────────────────────────────────────────────
function openMobilePreview() {
  if (!state.lessons.length) { toast('Keine Lektionen vorhanden.'); return; }

  let d;
  try {
    d = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
  } catch(e) {
    toast('Fehler beim Kodieren: ' + e.message); return;
  }

  const base = window.location.href.split('?')[0].replace(/index\.html$/, '');
  const url  = base + 'preview.html#d=' + d;

  const input = document.getElementById('mobilePreviewUrl');
  input.value = url;

  const shareBtn = document.getElementById('btnShareMobilePreview');
  shareBtn.style.display = navigator.share ? '' : 'none';

  document.getElementById('btnOpenMobilePreview').onclick  = () => window.open(url, '_blank');
  document.getElementById('btnShareMobilePreview').onclick = () =>
    navigator.share({ title: state.meta.title || 'Kursvorschau', url }).catch(() => {});

  document.getElementById('mobilePreviewOverlay').classList.add('open');
}

// ── Anthropic / AI config ────────────────────────────────────────
function getAiConfig() {
  return { key: localStorage.getItem('au-anthropic-key') || '' };
}

function openAiModal() {
  document.getElementById('aiError').textContent = '';
  document.getElementById('aiOverlay').classList.add('open');
}
function closeAiModal() {
  document.getElementById('aiOverlay').classList.remove('open');
}

async function generateAiCourse() {
  const cfg = getAiConfig();
  if (!cfg.key) {
    document.getElementById('aiError').textContent =
      'Bitte zuerst den Anthropic API Key in den Einstellungen (⚙) eingeben.';
    return;
  }
  const topic      = document.getElementById('aiTopic').value.trim();
  const goal       = document.getElementById('aiGoal').value.trim();
  const audience   = document.getElementById('aiAudience').value;
  const prior      = document.getElementById('aiPrior').value;
  const numLessons = document.getElementById('aiNumLessons').value;
  const format     = document.getElementById('aiFormat').value;

  if (!topic) { document.getElementById('aiError').textContent = 'Bitte das Thema eingeben.'; return; }

  const btn = document.getElementById('btnAiGenerate');
  btn.disabled    = true;
  btn.textContent = '⟳ Erstelle Konzept…';
  document.getElementById('aiError').textContent = '';

  const prompt = `Du bist ein erfahrener Instructional Designer. Erstelle einen Microlearning-Kurs auf Deutsch.

THEMA: ${topic}
LERNZIEL: ${goal || 'nicht angegeben'}
ZIELGRUPPE: ${audience}
VORERFAHRUNG: ${prior}
ANZAHL LEKTIONEN: ${numLessons}
FORMAT: ${format}

Antworte NUR mit einem validen JSON-Objekt (kein Markdown, keine Erklärung) mit exakt dieser Struktur:

{
  "meta": {
    "title": "Kurstitel auf Deutsch",
    "storageKey": "kurs-slug-mit-bindestrichen",
    "backLink": "../hub.html",
    "backLabel": "Zurück",
    "format": "${format}"
  },
  "lessons": [
    {
      "title": "Lektionstitel",
      "blocks": [
        // 2 bis 4 Blöcke pro Lektion, verschiedene Typen verwenden

        // Page-Block (Einführung, Erklärung):
        {"type":"page","heading":"Überschrift","body":"<p>HTML-Text</p>"},

        // Slides (Schritt-für-Schritt):
        {"type":"slides","intro":"Optionaler Intro-Text","slides":[{"heading":"","body":""}]},

        // Accordion (aufklappbare Fragen & Antworten):
        {"type":"accordion","intro":"","items":[{"trigger":"Frage?","content":"Antwort"}]},

        // Flip Cards (Vorderseite = Frage, Rückseite = Konzept + Erklärung):
        {"type":"flipcards","intro":"","cards":[{"label":"Begriff 1","question":"Was ist…?","title":"Konzeptname","answer":"Erklärung"}]},

        // Quiz (Wissensabfrage):
        {"type":"quiz","intro":"","questions":[{"text":"Frage?","multi":false,"options":[{"text":"Richtige Antwort","correct":true},{"text":"Falsche Antwort","correct":false},{"text":"Falsche Antwort","correct":false}],"okMsg":"Richtig!","wrongMsg":"Leider falsch."}]},

        // Completion (NUR als letzter Block der letzten Lektion):
        {"type":"completion","heading":"Gut gemacht!","subtitle":"Microlearning abgeschlossen.","message":"","showFeedback":true}
      ]
    }
  ]
}

Regeln:
- Alle Inhalte auf Deutsch
- Jede Lektion hat 2 bis 4 sinnvoll gewählte Blöcke
- Genau einen Completion-Block als letzten Block der letzten Lektion
- Quizfragen: 3 bis 4 Optionen, mindestens eine korrekte Antwort
- Flip Cards: label = Konzeptname, question = anregende Frage, title = kurzer Titel, answer = Erklärung
- Inhalt soll spezifisch und nützlich sein
- storageKey: aus dem Titel ableiten, nur Kleinbuchstaben und Bindestriche`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': cfg.key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: 'Du bist ein Experte für Instructional Design und Microlearning. Antworte ausschließlich mit validem JSON.',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'API-Fehler ' + res.status);
    }

    const data   = await res.json();
    const text   = data.content?.[0]?.text || '';
    const match  = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Keine valide JSON-Antwort erhalten.');

    const generated = JSON.parse(match[0]);
    if (!generated.meta || !Array.isArray(generated.lessons)) throw new Error('Ungültige Kursstruktur generiert.');

    state = generated;
    sel   = { type: null, lessonIdx: null, blockIdx: null };
    saveState();
    document.getElementById('courseTitleDisplay').textContent = state.meta.title || 'New Course';
    closeAiModal();
    renderAll();
    toast(`✨ Kurs generiert: ${state.lessons.length} Lektionen.`);

  } catch(ex) {
    document.getElementById('aiError').textContent = 'Fehler: ' + ex.message;
  } finally {
    btn.disabled    = false;
    btn.textContent = '✨ Konzept erstellen';
  }
}

// ── GitHub config ────────────────────────────────────────────────
function getGhConfig() {
  return {
    token:  localStorage.getItem('au-gh-token')  || '',
    owner:  localStorage.getItem('au-gh-owner')  || '',
    repo:   localStorage.getItem('au-gh-repo')   || '',
    branch: localStorage.getItem('au-gh-branch') || 'master',
  };
}
function saveGhConfig(token, owner, repo, branch) {
  localStorage.setItem('au-gh-token',  token);
  localStorage.setItem('au-gh-owner',  owner);
  localStorage.setItem('au-gh-repo',   repo);
  localStorage.setItem('au-gh-branch', branch || 'master');
}

// ── Settings modal ───────────────────────────────────────────────
function openSettings() {
  const cfg = getGhConfig();
  document.getElementById('ghToken').value       = cfg.token;
  document.getElementById('ghOwner').value       = cfg.owner;
  document.getElementById('ghRepo').value        = cfg.repo;
  document.getElementById('ghBranch').value      = cfg.branch;
  document.getElementById('anthropicKey').value  = getAiConfig().key;
  document.getElementById('settingsOverlay').classList.add('open');
}
function closeSettings() {
  document.getElementById('settingsOverlay').classList.remove('open');
}

// ── GitHub PUT helper ─────────────────────────────────────────────
async function ghPut(cfg, path, content, message) {
  const url  = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
  const hdrs = { Authorization:`token ${cfg.token}`, Accept:'application/vnd.github+json', 'Content-Type':'application/json' };
  let sha = null;
  const check = await fetch(url, { headers: hdrs });
  if (check.ok) sha = (await check.json()).sha;
  const isStr  = typeof content === 'string';
  const b64    = isStr ? btoa(unescape(encodeURIComponent(content)))
                       : btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2))));
  const body   = { message, content: b64, branch: cfg.branch };
  if (sha) body.sha = sha;
  return fetch(url, { method:'PUT', headers: hdrs, body: JSON.stringify(body) });
}

// ── Update courses/index.json after publish ───────────────────────
async function updateCoursesIndex(cfg) {
  const m = state.meta;
  const entry = {
    key: m.storageKey || 'course',
    title: m.title || 'Kurs',
    description: m.description || '',
    url: 'courses/' + (m.storageKey||'course') + '.html',
    level: m.level || 'Einsteiger',
    topics: m.topics || [],
    estimatedMin: m.estimatedMin || 20
  };
  try {
    const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/website/courses/index.json`;
    const hdrs = { Authorization:`token ${cfg.token}`, Accept:'application/vnd.github+json' };
    let existing = [];
    const check = await fetch(url, { headers: hdrs });
    if (check.ok) {
      const file = await check.json();
      try { existing = JSON.parse(atob(file.content.replace(/\n/g,''))); } catch(e) {}
    }
    const idx = existing.findIndex(c => c.key === entry.key);
    if (idx >= 0) existing[idx] = entry; else existing.push(entry);
    await ghPut(cfg, 'website/courses/index.json', existing, `Update courses index: ${entry.title}`);
  } catch(e) { /* non-critical */ }
}

// ── Publish Learning Path ─────────────────────────────────────────
async function publishPath() {
  const cfg = getGhConfig();
  if (!cfg.token || !cfg.owner || !cfg.repo) {
    toast('Bitte zuerst GitHub-Einstellungen konfigurieren (⚙).'); return;
  }
  const p = pathById(selPath);
  if (!p) return;

  // Validation
  const errs = [];
  if (!p.title || p.title === 'Neuer Lernpfad') errs.push('Kein Titel gesetzt');
  if (!p.id || p.id.startsWith('pfad-')) errs.push('Bitte einen lesbaren URL-Slug vergeben (↺ Auto-Knopf)');
  if (!(p.steps||[]).length) errs.push('Mindestens 1 Schritt erforderlich');
  const emptyCourse = (p.steps||[]).find(s => s.type!=='checkin' && !s.comingSoon && !s.courseKey);
  if (emptyCourse) errs.push(`Schritt "${emptyCourse.title}" hat keinen Kurs-Key`);
  if (errs.length) { toast('Vor dem Veröffentlichen: ' + errs.join(' · ')); return; }

  const label   = document.getElementById('publishPathLabel');
  const spinner = document.getElementById('publishPathSpinner');
  const btn     = document.getElementById('btnPublishPath');
  if (label)   label.style.display   = 'none';
  if (spinner) spinner.style.display = '';
  if (btn)     btn.disabled = true;

  try {
    const r1 = await ghPut(cfg, `website/paths/${p.id}.json`, p, `Publish path: ${p.title}`);
    if (!r1.ok) { const e = await r1.json().catch(()=>({})); throw new Error(e.message || r1.status); }

    // Rebuild index from all paths in localStorage
    const index = pathsList.map(p2 => ({
      id: p2.id, title: p2.title||'', subtitle: p2.subtitle||'',
      description: p2.description||'', level: p2.level||'',
      topics: p2.topics||[], stepsCount: (p2.steps||[]).length,
      estimatedMin: p2.estimatedMin||0
    }));
    await ghPut(cfg, 'website/paths/index.json', index, 'Update paths index');
    toast(`Lernpfad "${p.title}" veröffentlicht!`);
  } catch(ex) {
    toast('Fehler: ' + ex.message);
  } finally {
    if (label)   label.style.display   = '';
    if (spinner) spinner.style.display = 'none';
    if (btn)     btn.disabled = false;
  }
}

// ── Publish to GitHub Pages ──────────────────────────────────────
async function publishCourse() {
  const cfg = getGhConfig();
  if (!cfg.token || !cfg.owner || !cfg.repo) {
    toast('Bitte zuerst GitHub-Einstellungen konfigurieren (⚙).'); return;
  }
  if (!state.lessons.length) { toast('Keine Lektionen vorhanden.'); return; }

  const btn     = document.getElementById('btnPublish');
  const label   = btn.querySelector('.au-publish-label');
  const spinner = btn.querySelector('.au-publish-spinner');
  label.style.display   = 'none';
  spinner.style.display = '';
  btn.disabled = true;

  try {
    const html = generateCourseHtml();
    const key  = state.meta.storageKey || 'course';
    const res  = await ghPut(cfg, `website/courses/${key}.html`, html, `Publish: ${state.meta.title}`);
    if (res.ok) {
      await updateCoursesIndex(cfg);
      toast('Veröffentlicht! GitHub Pages aktualisiert sich in ~30 Sekunden.');
    } else {
      const err = await res.json().catch(() => ({}));
      toast('Fehler: ' + (err.message || res.status));
    }
  } catch(ex) {
    toast('Netzwerkfehler: ' + ex.message);
  } finally {
    label.style.display   = '';
    spinner.style.display = 'none';
    btn.disabled = false;
  }
}

// ── Image upload via GitHub API ──────────────────────────────────
let pendingUploadField = null;

async function uploadImage(file) {
  const cfg = getGhConfig();
  if (!cfg.token || !cfg.owner || !cfg.repo) {
    toast('Bitte zuerst GitHub-Einstellungen konfigurieren.'); return;
  }
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const b64  = e.target.result.split(',')[1];
      const name = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `website/images/${name}`;
      const url  = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
      const hdrs = {
        Authorization: `token ${cfg.token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      };

      let sha = null;
      const check = await fetch(url, { headers: hdrs });
      if (check.ok) sha = (await check.json()).sha;

      const body = { message: `Upload image: ${name}`, content: b64, branch: cfg.branch };
      if (sha) body.sha = sha;

      const res = await fetch(url, { method: 'PUT', headers: hdrs, body: JSON.stringify(body) });
      if (res.ok) {
        const imgUrl = `../images/${name}`;
        if (pendingUploadField) {
          const input = document.querySelector(`[name="${pendingUploadField}"]`);
          if (input) {
            input.value = imgUrl;
            applyField(pendingUploadField, imgUrl);
            saveState();
            schedulePreview();
          }
          pendingUploadField = null;
        }
        toast('Bild hochgeladen.');
      } else {
        const err = await res.json().catch(() => ({}));
        toast('Upload-Fehler: ' + (err.message || res.status));
      }
    } catch(ex) {
      toast('Fehler: ' + ex.message);
    }
  };
  reader.readAsDataURL(file);
}

// ── SCORM export ─────────────────────────────────────────────────
const SCORM_API_JS = `var ScormAPI = (function () {
  function findAPI(win) {
    var tries = 0;
    while (!win.API && win.parent && win.parent !== win && tries < 10) {
      win = win.parent; tries++;
    }
    return win.API || null;
  }
  var api = null, initialized = false;
  return {
    init: function () { api = findAPI(window); if (api) { api.LMSInitialize(''); initialized = true; } },
    setValue: function (k, v) { if (api && initialized) { api.LMSSetValue(k, String(v)); api.LMSCommit(''); } },
    getValue: function (k) { return api && initialized ? api.LMSGetValue(k) : ''; },
    saveLocation: function (n) { this.setValue('cmi.core.lesson_location', n); },
    getLocation: function () { return parseInt(this.getValue('cmi.core.lesson_location')) || 0; },
    complete: function () { this.setValue('cmi.core.lesson_status', 'completed'); this.setValue('cmi.core.score.raw', '100'); },
    finish: function () { if (api && initialized) { api.LMSFinish(''); initialized = false; } }
  };
})();
ScormAPI.init();
window.addEventListener('beforeunload', function () { ScormAPI.finish(); });
`;

function generateManifest(title, id) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${id}" version="1.2"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org1">
    <organization identifier="org1">
      <title>${esc(title)}</title>
      <item identifier="item1" identifierref="res1">
        <title>${esc(title)}</title>
        <adlcp:masteryscore>80</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
      <file href="scorm_api.js"/>
    </resource>
  </resources>
</manifest>`;
}

function generateScormHtml() {
  const m      = state.meta;
  const titles = state.lessons.map(l => l.title || 'Lektion');
  const total  = state.lessons.length;

  let lessonsHtml = '';
  state.lessons.forEach((lesson, li) => {
    lessonsHtml += `
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
  <title>${esc(m.title)}</title>
  <style>
${previewCss}
.nav { display: none !important; }
body.course-page { --nav-h: 0px; }
.course-header { top: 0; }
  </style>
</head>
<body class="course-page">
  <header class="course-header">
    <div class="course-header-inner">
      <div class="course-meta">
        <h1 class="course-title">${esc(m.title)}</h1>
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
        <nav aria-label="Lessons"><ul class="lesson-list" id="lessonList"></ul></nav>
      </aside>
      <button class="sidebar-toggle" id="sidebarToggle" aria-label="Toggle TOC">
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
  <script src="scorm_api.js"><\/script>
  <script>
${inlineCourseJs(state, total, titles)}
(function () {
  var origGoTo = window.goTo;
  if (origGoTo) {
    window.goTo = function (n, silent) {
      origGoTo(n, silent);
      ScormAPI.saveLocation(n);
      if (n === TOTAL) ScormAPI.complete();
    };
    var bookmark = ScormAPI.getLocation();
    if (bookmark > 1 && bookmark <= TOTAL) window.goTo(bookmark, true);
  }
})();
  <\/script>
</body>
</html>`;
}

async function exportScorm() {
  if (!state.lessons.length) { toast('Keine Lektionen vorhanden.'); return; }
  if (typeof JSZip === 'undefined') { toast('JSZip nicht geladen.'); return; }
  if (!previewCss) { toast('CSS noch nicht geladen. Bitte kurz warten.'); return; }

  const title = state.meta.title || 'Course';
  const id    = state.meta.storageKey || 'course-new';

  try {
    const zip = new JSZip();
    zip.file('imsmanifest.xml', generateManifest(title, id));
    zip.file('scorm_api.js',    SCORM_API_JS);
    zip.file('index.html',      generateScormHtml());

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = id + '-scorm.zip';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('SCORM-Paket erstellt.');
  } catch(ex) {
    toast('SCORM-Fehler: ' + ex.message);
  }
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
    selPath = null;
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

  // Outline: add path
  if (t.id === 'btnAddPath') {
    const id = 'pfad-' + Date.now().toString(36);
    pathsList.push({ id, title:'Neuer Lernpfad', subtitle:'', description:'', level:'Einsteiger',
      topics:[], estimatedMin:45, goal:'', behavioralAnchorTemplate:'', steps:[] });
    savePathsList();
    sel = { type:null, lessonIdx:null, blockIdx:null };
    selPath = id;
    renderAll(); return;
  }

  // Outline: select path
  if (t.closest('[data-path]') && !t.closest('[data-del-path]')) {
    const id = t.closest('[data-path]').dataset.path;
    selPath = selPath === id ? null : id;
    sel = { type:null, lessonIdx:null, blockIdx:null };
    renderAll(); return;
  }

  // Outline: delete path
  if (t.closest('[data-del-path]')) {
    e.stopPropagation();
    const id = (t.closest('[data-del-path]') || t).dataset.delPath;
    if (!id || !confirm('Lernpfad löschen?')) return;
    pathsList = pathsList.filter(p => p.id !== id);
    if (selPath === id) selPath = null;
    savePathsList(); renderAll(); return;
  }

  // Path editor: auto-slug button
  if (t.id === 'btnAutoSlug') {
    const p = pathById(selPath);
    if (!p) return;
    const titleEl = document.getElementById('pathTitleInput');
    const slugEl  = document.getElementById('pathSlugInput');
    const newSlug = slugify(titleEl ? titleEl.value : p.title);
    p.id = newSlug;
    if (slugEl) { slugEl.value = newSlug; }
    const prev = document.getElementById('slugPreview');
    if (prev) prev.textContent = newSlug;
    // Update selPath and pathsList entry
    pathsList = pathsList.map(lp => lp.id === selPath ? p : lp);
    selPath = newSlug;
    savePathsList(); renderOutline(); return;
  }

  // Path editor: add course step
  if (t.id === 'btnAddCourseStep') {
    const p = pathById(selPath);
    if (!p) return;
    const n = (p.steps||[]).length + 1;
    if (!p.steps) p.steps = [];
    p.steps.push({ id:'step-'+n, type:'course', title:'Kurs '+n, courseKey:'', courseUrl:'', estimatedMin:20, reflection:'', adaptiveHint:'' });
    savePathsList(); renderEditor(); return;
  }

  // Path editor: add checkin step
  if (t.id === 'btnAddCheckinStep') {
    const p = pathById(selPath);
    if (!p) return;
    const n = (p.steps||[]).length + 1;
    if (!p.steps) p.steps = [];
    p.steps.push({ id:'step-'+n, type:'checkin', title:'Reflexion '+n, prompt:'', hint:'', estimatedMin:5 });
    savePathsList(); renderEditor(); return;
  }

  // Path editor: delete step
  if (t.dataset.delStep !== undefined) {
    e.stopPropagation();
    const p = pathById(selPath);
    if (!p || !p.steps) return;
    p.steps.splice(+t.dataset.delStep, 1);
    savePathsList(); renderEditor(); return;
  }

  // Path editor: publish path
  if (t.id === 'btnPublishPath') { publishPath(); return; }

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
    state = { meta:{title:'New Course',storageKey:'course-new',backLink:'../hub.html',backLabel:'Coffee Hours',format:'stage'}, lessons:[] };
    sel   = { type:null, lessonIdx:null, blockIdx:null };
    localStorage.removeItem('au-state');
    document.getElementById('courseTitleDisplay').textContent = 'New Course';
    renderAll(); return;
  }
  if (t.id === 'btnPreviewRefresh') { updatePreview(); return; }

  // Outline collapse
  if (t.id === 'btnCollapseOutline') {
    const panel     = document.querySelector('.au-outline');
    const collapsed = panel.classList.toggle('collapsed');
    document.documentElement.style.setProperty('--outline-w', collapsed ? '40px' : '240px');
    localStorage.setItem('au-outline-collapsed', collapsed ? '1' : '0');
    return;
  }

  // Mobile preview
  if (t.id === 'btnMobilePreview') { openMobilePreview(); return; }
  if (t.id === 'closeMobilePreview' || t.id === 'mobilePreviewOverlay') {
    document.getElementById('mobilePreviewOverlay').classList.remove('open'); return;
  }
  if (t.id === 'btnCopyPreviewUrl') {
    const val = document.getElementById('mobilePreviewUrl').value;
    navigator.clipboard.writeText(val).then(() => toast('Link kopiert.')).catch(() => toast('Kopieren fehlgeschlagen.'));
    return;
  }

  // Settings / Publish / SCORM
  if (t.id === 'btnSettings')    { openSettings();  return; }
  if (t.id === 'btnPublish' || t.closest('#btnPublish')) { publishCourse(); return; }
  if (t.id === 'btnExportScorm') { exportScorm();   return; }
  if (t.id === 'saveSettings') {
    const token  = document.getElementById('ghToken').value.trim();
    const owner  = document.getElementById('ghOwner').value.trim();
    const repo   = document.getElementById('ghRepo').value.trim();
    const branch = document.getElementById('ghBranch').value.trim() || 'master';
    saveGhConfig(token, owner, repo, branch);
    const aiKey = document.getElementById('anthropicKey').value.trim();
    if (aiKey) localStorage.setItem('au-anthropic-key', aiKey);
    else localStorage.removeItem('au-anthropic-key');
    const st = document.getElementById('settingsStatus');
    st.textContent = 'Gespeichert ✓';
    setTimeout(() => { st.textContent = ''; }, 2000);
    return;
  }
  if (t.id === 'closeSettings' || t.id === 'settingsOverlay') { closeSettings(); return; }

  // AI modal
  if (t.id === 'btnOpenAi')  { openAiModal();  return; }
  if (t.id === 'closeAiModal' || t.id === 'aiOverlay') { closeAiModal(); return; }
  if (t.id === 'btnAiGenerate') { generateAiCourse(); return; }

  // Image upload trigger
  if (t.closest('[data-upload-for]')) {
    pendingUploadField = (t.closest('[data-upload-for]')).dataset.uploadFor;
    document.getElementById('imageInput').click();
    return;
  }
});

// Editor: form input changes
document.addEventListener('input', e => {
  const t = e.target;
  if (!t.name) return;

  // Path field updates
  if (t.name.startsWith('path.') && selPath) {
    const p = pathById(selPath);
    if (p) {
      const field = t.name.slice(5);

      if (field === 'id') {
        // Rename the path: update selPath and entry in list
        const newId = slugify(t.value) || selPath;
        pathsList = pathsList.map(lp => lp.id === selPath ? {...lp, id: newId} : lp);
        selPath = newId;
        const prev = document.getElementById('slugPreview');
        if (prev) prev.textContent = newId || '…';
        savePathsList(); renderOutline();
        return;
      }

      p[field] = field === 'topics' ? t.value.split(',').map(s=>s.trim()).filter(Boolean)
               : t.type === 'number' ? +t.value : t.value;
      savePathsList();
      if (field === 'title') {
        renderOutline();
        // Live-update slug preview with suggestion
        const slugPrev = document.getElementById('slugPreview');
        const slugInp  = document.getElementById('pathSlugInput');
        if (slugPrev && slugInp && !slugInp.dataset.manuallyEdited) {
          slugPrev.textContent = slugify(t.value) || '…';
        }
      }
    }
    return;
  }

  // Step field updates
  if (t.name.startsWith('step.') && selPath) {
    const p = pathById(selPath);
    if (p && p.steps) {
      const parts = t.name.split('.');
      const si    = +parts[1];
      const field = parts.slice(2).join('.');
      if (p.steps[si]) {
        p.steps[si][field] = t.type === 'number' ? +t.value : t.value;
        savePathsList();
        if (field === 'title' || field === 'type') renderEditor();
      }
    }
    return;
  }

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

  // Path course picker
  if (t.classList && t.classList.contains('au-course-picker') && selPath) {
    const p   = pathById(selPath);
    const si  = +t.dataset.step;
    if (!p || !p.steps || !p.steps[si]) return;
    const found = publishedCourses.find(c => c.key === t.value);
    if (found) {
      p.steps[si].courseKey = found.key;
      p.steps[si].courseUrl = found.url;
      if (!p.steps[si].title || p.steps[si].title === 'Kurs ' + (si+1)) {
        p.steps[si].title = found.title;
      }
      savePathsList(); renderEditor();
    }
    return;
  }

  // Path step type change: re-render editor
  if (t.name.startsWith('step.') && t.name.endsWith('.type') && selPath) {
    const p = pathById(selPath);
    if (p && p.steps) {
      const si = +t.name.split('.')[1];
      if (p.steps[si]) { p.steps[si].type = t.value; savePathsList(); renderEditor(); }
    }
    return;
  }

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

// Image upload input
document.getElementById('imageInput').addEventListener('change', e => {
  if (e.target.files[0]) uploadImage(e.target.files[0]);
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

  if (localStorage.getItem('au-outline-collapsed') === '1') {
    document.querySelector('.au-outline').classList.add('collapsed');
    document.documentElement.style.setProperty('--outline-w', '40px');
  }

  const params  = new URLSearchParams(window.location.search);
  const editKey = params.get('edit');

  loadState(editKey);
  loadPathsList();

  // Load published courses for course picker in path designer
  fetch('../courses/index.json').then(r => r.ok ? r.json() : []).then(list => {
    publishedCourses = list || [];
  }).catch(() => {});

  // If opened via Edit button from a course page, show back link
  if (editKey) {
    const left    = document.querySelector('.au-header-left');
    const backBtn = document.createElement('a');
    backBtn.href      = `../courses/${editKey}.html`;
    backBtn.className = 'au-btn au-btn-ghost';
    backBtn.style.cssText = 'margin-left:12px;font-size:0.78rem;';
    backBtn.textContent   = '← Kurs';
    backBtn.title         = 'Zurück zur Kursseite';
    left.appendChild(backBtn);
  }

  document.getElementById('courseTitleDisplay').textContent = state.meta.title || 'New Course';
  renderAll();
}

init();
