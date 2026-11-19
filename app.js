/* ErgoAI v1 · Evaluación ergonómica preliminar · datos locales (localStorage) */
'use strict';
const $ = s => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KEY = 'ergoai.v1';
const fresh = () => ({ companies: [], jobs: [], evals: [], profile: { name: '', license: '', role: 'Fisioterapeuta' } });
let db = (() => { try { return Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY))); } catch { return fresh(); } })();
const save = () => localStorage.setItem(KEY, JSON.stringify(db));
const fmtDate = d => new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); }

/* ---------- Modelo de factores de riesgo (tamizaje simplificado 0-3) ---------- */
const FACTORS = [
  { id: 'tronco', g: 'Postura', label: 'Tronco / columna', w: 1.5,
    o: ['Erguido, apoyado o neutro', 'Inclinación leve (< 20°)', 'Flexión 20–60° o rotación frecuente', 'Flexión > 60°, rotación + flexión o postura sostenida'],
    r: [['Ingeniería', 'Ajustar la altura de la superficie de trabajo y acercar materiales a la zona de alcance óptima para evitar flexión de tronco.'], ['Administrativa', 'Rotar tareas y programar pausas activas de movilidad lumbar cada 60–90 min.'], ['Individual', 'Capacitar en higiene postural y ejercicios de control lumbopélvico.']] },
  { id: 'cuello', g: 'Postura', label: 'Cuello / cabeza', w: 1,
    o: ['Posición neutra', 'Flexión leve ocasional', 'Flexión > 20° o rotación frecuente', 'Flexión/extensión sostenida o extrema'],
    r: [['Ingeniería', 'Elevar pantallas o planos de trabajo al nivel de los ojos; usar atril o soporte de documentos.'], ['Administrativa', 'Pausas visuales y de movilidad cervical (regla 20-20-20 en tareas con pantalla).'], ['Individual', 'Ejercicios de fortalecimiento de flexores profundos cervicales y estiramiento de trapecio superior.']] },
  { id: 'brazos', g: 'Postura', label: 'Hombros / brazos', w: 1.5,
    o: ['Codos pegados al cuerpo, por debajo del hombro', 'Elevación 20–45°', 'Elevación 45–90° o abducción frecuente', 'Brazos sobre el hombro (> 90°) o sostenidos'],
    r: [['Ingeniería', 'Reubicar herramientas y materiales entre la cadera y el hombro; usar plataformas elevables o brazos articulados.'], ['Administrativa', 'Limitar la duración de tareas por encima del hombro y alternar con tareas a nivel neutro.'], ['Individual', 'Programa de estabilización escapular y manguito rotador.']] },
  { id: 'munecas', g: 'Postura', label: 'Muñecas / manos', w: 1.2,
    o: ['Muñeca neutra', 'Desviación leve', 'Flexión/extensión o desviación marcada', 'Posición extrema, repetida o con agarre en pinza forzado'],
    r: [['Ingeniería', 'Rediseñar herramientas y mandos para mantener la muñeca neutra; usar mangos de diámetro adecuado.'], ['Administrativa', 'Micropausas y alternancia de tareas con agarre fino.'], ['Individual', 'Ejercicios de deslizamiento neural y estiramiento de flexores y extensores de muñeca.']] },
  { id: 'piernas', g: 'Postura', label: 'Piernas / base de apoyo', w: 0.8,
    o: ['Sentado con apoyo o bipedestación estable alternada', 'Bipedestación prolongada ocasional', 'Bipedestación estática prolongada o cuclillas ocasionales', 'Cuclillas/rodillas flexionadas sostenidas o apoyo inestable'],
    r: [['Ingeniería', 'Instalar tapetes antifatiga, apoyapiés o sillas semisentado.'], ['Administrativa', 'Alternar sedente/bipedestación y permitir cambios de postura.'], ['Individual', 'Calzado adecuado y ejercicios de retorno venoso y movilidad de cadera.']] },
  { id: 'carga', g: 'Fuerza y carga', label: 'Peso manipulado', w: 1.5,
    o: ['< 3 kg o sin manipulación', '3–10 kg', '10–25 kg', '> 25 kg (o carga inestable/asimétrica)'],
    r: [['Ingeniería', 'Incorporar ayudas mecánicas (carretillas, polipastos, mesas elevadoras) y reducir peso por unidad.'], ['Administrativa', 'Establecer límites de peso, levantamiento entre dos personas y procedimientos de manipulación manual de cargas.'], ['Individual', 'Entrenamiento en técnica de levantamiento y acondicionamiento físico.']] },
  { id: 'fuerza', g: 'Fuerza y carga', label: 'Esfuerzo / agarre', w: 1,
    o: ['Esfuerzo ligero, agarre cómodo', 'Esfuerzo moderado ocasional', 'Esfuerzo notable (empujar, jalar, apretar) frecuente', 'Esfuerzo máximo o agarre en pinza con fuerza'],
    r: [['Ingeniería', 'Reducir fuerzas de empuje/arrastre con ruedas adecuadas, mantenimiento y superficies lisas.'], ['Administrativa', 'Planificar tareas de alta fuerza fuera de picos de fatiga y rotar al personal.'], ['Individual', 'Fortalecimiento de agarre y antebrazo de forma progresiva.']] },
  { id: 'repeticion', g: 'Repetitividad y tiempo', label: 'Repetitividad', w: 1.3,
    o: ['Ciclos > 30 s, tareas variadas', 'Ciclos 15–30 s', 'Ciclos 10–15 s o mismo movimiento > 50 % del tiempo', 'Ciclos < 10 s o movimiento idéntico casi continuo'],
    r: [['Ingeniería', 'Automatizar o semiautomatizar movimientos repetitivos y rediseñar el flujo de trabajo.'], ['Administrativa', 'Rotación de tareas con grupos musculares distintos y pausas programadas.'], ['Individual', 'Pausas activas dirigidas a segmentos más expuestos.']] },
  { id: 'duracion', g: 'Repetitividad y tiempo', label: 'Duración de la exposición diaria', w: 1.2,
    o: ['< 1 hora', '1–2 horas', '2–4 horas', '> 4 horas'],
    r: [['Administrativa', 'Reducir el tiempo continuo de exposición mediante rotación, pausas y redistribución de tareas.']] },
  { id: 'pausas', g: 'Organización', label: 'Pausas y recuperación', w: 1,
    o: ['Pausas suficientes y autorregulables', 'Pausas adecuadas pero fijas', 'Pausas insuficientes', 'Sin pausas efectivas'],
    r: [['Administrativa', 'Implementar pausas activas programadas y espacios de recuperación; evaluar la carga de trabajo.']] },
  { id: 'ritmo', g: 'Organización', label: 'Ritmo y control del trabajo', w: 0.8,
    o: ['Ritmo autocontrolado', 'Ritmo mixto', 'Ritmo impuesto con metas altas', 'Ritmo impuesto por máquina/línea sin margen'],
    r: [['Administrativa', 'Revisar metas y tiempos estándar, ampliar el margen de control del trabajador y valorar riesgo psicosocial asociado.']] },
  { id: 'ambiente', g: 'Entorno', label: 'Vibración, frío, iluminación o espacio', w: 0.7,
    o: ['Entorno confortable', 'Molestias leves', 'Factores ambientales moderados (vibración, frío, deslumbramiento, espacio limitado)', 'Factores severos o combinados'],
    r: [['Ingeniería', 'Corregir iluminación, aislar vibración, climatizar o ampliar espacios de trabajo.'], ['Individual', 'Dotar EPP o ropa adecuada cuando el control en la fuente no sea posible.']] }
];
const LEVELS = [
  { k: 'bajo', max: 25, l: 'Bajo', c: '#16a34a', a: 'Riesgo aceptable. Mantener vigilancia y reevaluar al menos una vez al año.' },
  { k: 'moderado', max: 50, l: 'Moderado', c: '#d97706', a: 'Intervención a mediano plazo. Reevaluar en 6 meses y priorizar controles de ingeniería y administrativos.' },
  { k: 'alto', max: 75, l: 'Alto', c: '#ea580c', a: 'Intervención prioritaria a corto plazo. Reevaluar en 3 meses tras implementar controles.' },
  { k: 'muy', max: 101, l: 'Muy alto', c: '#dc2626', a: 'Intervención inmediata. Considerar suspender o modificar la tarea mientras se implementan controles.' }
];
function analyze(ans) {
  let s = 0, m = 0, crit = 0;
  const detail = FACTORS.map(f => { const v = +ans[f.id] || 0; s += v * f.w; m += 3 * f.w; if (v === 3) crit++; return { id: f.id, label: f.label, g: f.g, v, w: f.w, txt: f.o[v] }; });
  const score = Math.round((s / m) * 100);
  let i = LEVELS.findIndex(l => score < l.max);
  if (crit >= 2 && i < 2) i = 2; // dos factores críticos elevan a Alto como mínimo
  const level = LEVELS[i];
  const recs = [];
  FACTORS.forEach(f => { const v = +ans[f.id] || 0; if (v >= 2) f.r.forEach(([t, x]) => recs.push({ factor: f.label, tipo: t, texto: x, prio: v === 3 ? 'Alta' : 'Media' })); });
  const ord = { Ingeniería: 0, Administrativa: 1, Individual: 2 };
  recs.sort((a, b) => (a.prio === b.prio ? 0 : a.prio === 'Alta' ? -1 : 1) || ord[a.tipo] - ord[b.tipo]);
  return { score, level: level.k, detail, recs, crit };
}
const lvl = k => LEVELS.find(l => l.k === k);
const badge = k => `<span class="badge b-${k}">${lvl(k).l}</span>`;

/* ---------- Utilidades de datos ---------- */
const company = id => db.companies.find(c => c.id === id);
const job = id => db.jobs.find(j => j.id === id);
const lastEval = jid => db.evals.filter(e => e.jobId === jid).sort((a, b) => b.date.localeCompare(a.date))[0];
const inp = (n, l, v = '', t = 'text', x = '') => `<div><label for="${n}">${l}</label><input id="${n}" name="${n}" type="${t}" value="${esc(v)}" ${x}></div>`;
const fdata = f => Object.fromEntries(new FormData(f));

/* ---------- Vistas ---------- */
const V = {};
V.inicio = () => {
  const al = db.evals.filter(e => ['alto', 'muy'].includes(e.level)).length;
  return `<h1>Hola${db.profile.name ? ', ' + esc(db.profile.name.split(' ')[0]) : ''} 👋</h1>
  <p class="sub">Evalúa puestos de trabajo y genera informes profesionales.</p>
  <div class="grid2">
    <div class="card stat"><b>${db.companies.length}</b><span>Empresas</span></div>
    <div class="card stat"><b>${db.jobs.length}</b><span>Puestos</span></div>
    <div class="card stat"><b>${db.evals.length}</b><span>Evaluaciones</span></div>
    <div class="card stat"><b style="color:var(--hi)">${al}</b><span>Riesgo alto / muy alto</span></div>
  </div>
  <h2>Flujo de trabajo</h2>
  <div class="card stack">
    <div>① <b>Registra la empresa</b> y sus datos</div><div>② <b>Describe el puesto</b> y sus tareas</div>
    <div>③ <b>Evalúa los factores</b> de riesgo biomecánico</div><div>④ <b>Descarga el informe</b> en PDF</div>
    <a class="btn block" href="#/empresa/nueva">+ Nueva empresa</a>
    ${db.companies.length ? '' : '<button class="btn sec block" data-act="demo">Cargar datos de ejemplo</button>'}
  </div>
  <h2>Últimas evaluaciones</h2>${evalList(db.evals.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4))}`;
};
function evalList(list) {
  if (!list.length) return '<div class="card empty">Aún no hay evaluaciones.</div>';
  return list.map(e => { const j = job(e.jobId), c = j && company(j.companyId); return `<a class="card item" href="#/informe/${e.id}"><div class="row"><h3>${esc(j?.name || 'Puesto eliminado')}</h3>${badge(e.level)}</div><div class="meta">${esc(c?.name || '')} · ${fmtDate(e.date)} · Puntaje ${e.score}/100</div></a>`; }).join('');
}
V.empresas = () => `<div class="row"><h1>Empresas</h1><a class="btn sm" href="#/empresa/nueva">+ Nueva</a></div>
  ${db.companies.length ? db.companies.map(c => `<a class="card item" href="#/empresa/${c.id}"><h3>${esc(c.name)}</h3><div class="meta">${esc(c.sector || 'Sin sector')} · ${esc(c.city || '')} · ${db.jobs.filter(j => j.companyId === c.id).length} puestos</div></a>`).join('') : '<div class="card empty">Registra tu primera empresa para comenzar.</div>'}`;
V.empresa = id => {
  const c = id === 'nueva' ? {} : company(id); if (!c) return V.empresas();
  const jobs = db.jobs.filter(j => j.companyId === c.id);
  return `<h1>${c.id ? 'Empresa' : 'Nueva empresa'}</h1>
  <form class="card stack" data-form="empresa" data-id="${c.id || ''}">
    ${inp('name', 'Razón social *', c.name, 'text', 'required')}${inp('nit', 'NIT / identificación', c.nit)}
    ${inp('sector', 'Sector económico', c.sector)}${inp('city', 'Ciudad', c.city)}
    ${inp('contact', 'Contacto (nombre y cargo)', c.contact)}${inp('workers', 'N.º de trabajadores', c.workers, 'number', 'min="0" inputmode="numeric"')}
    <button class="btn block">Guardar empresa</button>
    ${c.id ? `<a class="btn sec block" href="#/puesto/nuevo/${c.id}">+ Agregar puesto de trabajo</a><button type="button" class="btn danger block" data-act="del-empresa" data-id="${c.id}">Eliminar empresa</button>` : ''}
  </form>
  ${c.id ? `<h2>Puestos de ${esc(c.name)}</h2>${jobList(jobs)}` : ''}`;
};
function jobList(list) {
  if (!list.length) return '<div class="card empty">Sin puestos registrados.</div>';
  return list.map(j => { const e = lastEval(j.id); return `<a class="card item" href="#/puesto/${j.id}"><div class="row"><h3>${esc(j.name)}</h3>${e ? badge(e.level) : '<span class="meta">Sin evaluar</span>'}</div><div class="meta">${esc(company(j.companyId)?.name || '')} · ${esc(j.area || '')}</div></a>`; }).join('');
}
V.puestos = () => `<div class="row"><h1>Puestos</h1></div>${db.companies.length ? '' : '<div class="card empty">Primero registra una empresa.</div>'}${jobList(db.jobs)}`;
V.puesto = (id, cid) => {
  const isNew = id === 'nuevo'; const j = isNew ? { companyId: cid } : job(id); if (!j) return V.puestos();
  const evs = db.evals.filter(e => e.jobId === j.id).sort((a, b) => b.date.localeCompare(a.date));
  return `<h1>${isNew ? 'Nuevo puesto' : 'Puesto de trabajo'}</h1>
  <form class="card stack" data-form="puesto" data-id="${j.id || ''}">
    <div><label>Empresa *</label><select name="companyId" required>${db.companies.map(c => `<option value="${c.id}" ${c.id === j.companyId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
    ${inp('name', 'Nombre del puesto *', j.name, 'text', 'required')}${inp('area', 'Área / proceso', j.area)}
    <div class="grid2">${inp('workers', 'Trabajadores expuestos', j.workers, 'number', 'min="0" inputmode="numeric"')}${inp('hours', 'Horas/día', j.hours, 'number', 'min="0" max="24" step="0.5"')}</div>
    <div><label for="tasks">Descripción de tareas y condiciones</label><textarea id="tasks" name="tasks" placeholder="Ej: El operario alimenta la máquina manualmente con piezas de 8 kg desde una estiba a nivel del piso...">${esc(j.tasks)}</textarea></div>
    <div><label for="equip">Equipos, herramientas y mobiliario</label><textarea id="equip" name="equip">${esc(j.equip)}</textarea></div>
    <button class="btn block">Guardar puesto</button>
    ${j.id ? `<a class="btn sec block" href="#/evaluar/${j.id}">▶ Nueva evaluación de riesgo</a><button type="button" class="btn danger block" data-act="del-puesto" data-id="${j.id}">Eliminar puesto</button>` : ''}
  </form>
  ${j.id ? `<h2>Evaluaciones</h2>${evalList(evs)}` : ''}`;
};
V.evaluar = (jid, eid) => {
  const j = job(jid); if (!j) return V.puestos();
  const prev = eid ? db.evals.find(e => e.id === eid) : null; const a = prev?.answers || {};
  let g = '';
  return `<h1>Evaluación</h1><p class="sub">${esc(j.name)} · ${esc(company(j.companyId)?.name || '')}</p>
  <div class="live"><div class="row"><b>Puntaje preliminar</b><span id="lscore">0/100</span><span id="llevel"></span></div><div class="bar"><i id="lbar" style="width:0"></i></div></div>
  <form data-form="eval" data-job="${jid}" data-id="${prev?.id || ''}" class="stack">
    ${FACTORS.map(f => { const h = f.g !== g ? `<h2>${f.g}</h2>` : ''; g = f.g; return h + `<fieldset class="card factor" style="border:1px solid var(--bd)"><legend>${f.label}</legend>${f.o.map((o, i) => `<label class="opt"><input type="radio" name="${f.id}" value="${i}" ${(+a[f.id] || 0) === i ? 'checked' : ''}><span>${o}</span></label>`).join('')}</fieldset>`; }).join('')}
    <h2>Observaciones</h2>
    <div class="card stack"><div><label for="obs">Hallazgos y observaciones del evaluador</label><textarea id="obs" name="obs">${esc(prev?.obs)}</textarea></div>
    <div><label for="method">Método / instrumentos usados</label><input id="method" name="method" value="${esc(prev?.method || 'Observación directa y tamizaje ergonómico ErgoAI')}"></div></div>
    <button class="btn block">Calcular y generar informe</button>
  </form>`;
};
V.informes = () => `<h1>Informes</h1>${evalList(db.evals.slice().sort((a, b) => b.date.localeCompare(a.date)))}`;
V.informe = id => {
  const e = db.evals.find(x => x.id === id); if (!e) return V.informes();
  const j = job(e.jobId) || {}, c = company(j.companyId) || {}, L = lvl(e.level), p = db.profile;
  const groups = [...new Set(e.detail.map(d => d.g))];
  return `<div class="actions noprint" style="margin:0 0 12px"><button class="btn" data-act="print">⬇ Descargar PDF</button><a class="btn sec" href="#/evaluar/${j.id}/${e.id}">Editar</a><button class="btn danger" data-act="del-eval" data-id="${e.id}">Eliminar</button></div>
  <p class="sub noprint">Al pulsar «Descargar PDF» elige «Guardar como PDF» en el diálogo de impresión.</p>
  <article class="report">
    <h1>Informe de evaluación ergonómica</h1>
    <div style="color:var(--mu)">Generado con ErgoAI · ${fmtDate(e.date)}</div>
    <h2>1. Datos de la empresa</h2>
    <table><tr><th>Empresa</th><td>${esc(c.name)}</td><th>NIT</th><td>${esc(c.nit)}</td></tr>
    <tr><th>Sector</th><td>${esc(c.sector)}</td><th>Ciudad</th><td>${esc(c.city)}</td></tr>
    <tr><th>Contacto</th><td colspan="3">${esc(c.contact)}</td></tr></table>
    <h2>2. Descripción del puesto</h2>
    <table><tr><th>Puesto</th><td>${esc(j.name)}</td><th>Área</th><td>${esc(j.area)}</td></tr>
    <tr><th>Expuestos</th><td>${esc(j.workers)}</td><th>Jornada (h/día)</th><td>${esc(j.hours)}</td></tr>
    <tr><th>Tareas</th><td colspan="3">${esc(j.tasks || '—').replace(/\n/g, '<br>')}</td></tr>
    <tr><th>Equipos</th><td colspan="3">${esc(j.equip || '—').replace(/\n/g, '<br>')}</td></tr></table>
    <h2>3. Resultado global</h2>
    <p style="font-size:18px"><b style="color:${L.c}">Nivel de riesgo ${L.l.toLowerCase()}</b> · Puntaje ${e.score}/100</p>
    <div class="bar"><i style="width:${e.score}%;background:${L.c}"></i></div>
    <p style="margin-top:8px">${L.a}</p>
    ${e.crit >= 2 ? '<p><b>Nota:</b> se identificaron dos o más factores en nivel crítico; el nivel global se elevó a «Alto» como mínimo.</p>' : ''}
    <h2>4. Factores de riesgo evaluados</h2>
    ${groups.map(gr => `<h3 style="margin-top:10px">${gr}</h3>` + e.detail.filter(d => d.g === gr).map(d => `<div class="rl"><span>${d.label}</span><div class="bar" style="margin:0"><i style="width:${d.v / 3 * 100}%;background:${['#16a34a', '#d97706', '#ea580c', '#dc2626'][d.v]}"></i></div><b>${d.v}/3</b></div><div style="font-size:12px;color:var(--mu);margin:-2px 0 4px">${esc(d.txt)}</div>`).join('')).join('')}
    <h2>5. Recomendaciones (jerarquía de controles)</h2>
    ${e.recs.length ? e.recs.map(r => `<div class="rec"><b>${r.tipo}</b> · prioridad ${r.prio}<small>Factor: ${esc(r.factor)}</small>${esc(r.texto)}</div>`).join('') : '<p>No se identificaron factores que requieran intervención inmediata. Mantener buenas prácticas y vigilancia periódica.</p>'}
    <h2>6. Observaciones y método</h2>
    <p>${esc(e.obs || 'Sin observaciones adicionales.').replace(/\n/g, '<br>')}</p><p><b>Método:</b> ${esc(e.method)}</p>
    <div class="sign"><div>${esc(p.name || 'Evaluador')}<br>${esc(p.role)}${p.license ? ' · Registro ' + esc(p.license) : ''}</div><div>Representante de la empresa</div></div>
    <p class="disc">Este informe es un tamizaje ergonómico preliminar basado en criterios simplificados de observación. No sustituye métodos validados (REBA, RULA, OCRA, NIOSH, GATISST u otros aplicables), ni el criterio profesional, ni el concepto médico ocupacional. Las recomendaciones deben ser validadas y priorizadas por el profesional responsable del Sistema de Gestión de SST.</p>
  </article>`;
};
V.ajustes = () => `<h1>Ajustes</h1>
  <form class="card stack" data-form="perfil"><h3>Perfil del evaluador (aparece en el informe)</h3>
    ${inp('name', 'Nombre completo', db.profile.name)}
    <div><label>Profesión</label><select name="role">${['Fisioterapeuta', 'Profesional SST', 'Ingeniero SST', 'Médico laboral', 'Otro'].map(r => `<option ${r === db.profile.role ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
    ${inp('license', 'Licencia SST / registro profesional', db.profile.license)}<button class="btn block">Guardar perfil</button></form>
  <div class="card stack"><h3>Copia de seguridad</h3><p class="meta">Los datos se guardan solo en este dispositivo. Exporta una copia con regularidad.</p>
    <button class="btn sec block" data-act="export">Exportar datos (JSON)</button>
    <label class="btn sec block" style="margin:0">Importar copia<input type="file" accept="application/json" data-import hidden></label>
    <button class="btn danger block" data-act="wipe">Borrar todos los datos</button></div>`;

/* ---------- Router ---------- */
function route() {
  const [, p = 'inicio', a, b] = location.hash.split('/');
  const name = p || 'inicio';
  const tab = { empresa: 'empresas', puesto: 'puestos', evaluar: 'puestos', informe: 'informes', ajustes: '' }[name] ?? name;
  document.querySelectorAll('.bottom a').forEach(x => x.classList.toggle('on', x.dataset.tab === tab));
  const view = V[name] || V.inicio;
  $('#app').innerHTML = view(a, b); scrollTo(0, 0);
  if (name === 'evaluar') liveScore();
}
function liveScore() {
  const f = document.querySelector('[data-form=eval]'); if (!f) return;
  const upd = () => { const r = analyze(fdata(f)), L = lvl(r.level); $('#lscore').textContent = r.score + '/100'; $('#llevel').innerHTML = badge(r.level); $('#lbar').style.cssText = `width:${r.score}%;background:${L.c}`; };
  f.addEventListener('change', upd); upd();
}

/* ---------- Eventos ---------- */
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault();
  const d = fdata(f), id = f.dataset.id, t = f.dataset.form;
  if (t === 'empresa') { if (id) Object.assign(company(id), d); else { const n = { id: uid(), ...d }; db.companies.push(n); save(); toast('Empresa guardada'); return (location.hash = '#/empresa/' + n.id); } save(); toast('Empresa guardada'); route(); }
  if (t === 'puesto') { if (id) Object.assign(job(id), d); else { const n = { id: uid(), ...d }; db.jobs.push(n); save(); toast('Puesto guardado'); return (location.hash = '#/puesto/' + n.id); } save(); toast('Puesto guardado'); route(); }
  if (t === 'eval') {
    const { obs = '', method = '', ...ans } = d; const r = analyze(ans);
    const rec = { id: id || uid(), jobId: f.dataset.job, date: new Date().toISOString(), answers: ans, obs, method, ...r };
    const i = db.evals.findIndex(x => x.id === rec.id); i >= 0 ? (db.evals[i] = rec) : db.evals.push(rec);
    save(); toast('Evaluación guardada'); location.hash = '#/informe/' + rec.id;
  }
  if (t === 'perfil') { db.profile = d; save(); toast('Perfil guardado'); }
});
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]'); if (g) return (location.hash = g.dataset.go);
  const b = e.target.closest('[data-act]'); if (!b) return; const id = b.dataset.id;
  const act = b.dataset.act;
  if (act === 'print') return print();
  if (act === 'del-eval' && confirm('¿Eliminar esta evaluación?')) { db.evals = db.evals.filter(x => x.id !== id); save(); location.hash = '#/informes'; }
  if (act === 'del-puesto' && confirm('¿Eliminar el puesto y sus evaluaciones?')) { db.evals = db.evals.filter(x => x.jobId !== id); db.jobs = db.jobs.filter(x => x.id !== id); save(); location.hash = '#/puestos'; }
  if (act === 'del-empresa' && confirm('¿Eliminar la empresa, sus puestos y evaluaciones?')) { const ids = db.jobs.filter(j => j.companyId === id).map(j => j.id); db.evals = db.evals.filter(x => !ids.includes(x.jobId)); db.jobs = db.jobs.filter(j => j.companyId !== id); db.companies = db.companies.filter(c => c.id !== id); save(); location.hash = '#/empresas'; }
  if (act === 'export') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' })); a.download = `ergoai-respaldo-${new Date().toISOString().slice(0, 10)}.json`; a.click(); }
  if (act === 'wipe' && confirm('Se borrarán TODOS los datos de este dispositivo. ¿Continuar?')) { db = fresh(); save(); toast('Datos borrados'); location.hash = '#/'; route(); }
  if (act === 'demo') {
    const c = { id: uid(), name: 'Manufacturas Andinas S.A.S.', nit: '900.123.456-7', sector: 'Manufactura', city: 'Medellín', contact: 'Laura Gómez, Jefe SST', workers: 120 };
    const j = { id: uid(), companyId: c.id, name: 'Operario de ensamble', area: 'Línea 2', workers: 14, hours: 8, tasks: 'Ensambla componentes sobre banda transportadora, ciclo de 12 s. Levanta cajas de 9 kg desde estiba al nivel del piso.', equip: 'Mesa fija de 90 cm, atornillador neumático.' };
    db.companies.push(c); db.jobs.push(j);
    const ans = { tronco: 2, cuello: 1, brazos: 2, munecas: 2, piernas: 2, carga: 1, fuerza: 1, repeticion: 3, duracion: 3, pausas: 2, ritmo: 2, ambiente: 1 };
    db.evals.push({ id: uid(), jobId: j.id, date: new Date().toISOString(), answers: ans, obs: 'Ejemplo ilustrativo.', method: 'Observación directa', ...analyze(ans) });
    save(); toast('Datos de ejemplo cargados'); route();
  }
});
document.addEventListener('change', e => {
  if (!e.target.matches('[data-import]')) return;
  const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(r.result); if (!Array.isArray(d.companies)) throw 0; db = Object.assign(fresh(), d); save(); toast('Datos importados'); route(); } catch { toast('Archivo no válido'); } }; r.readAsText(e.target.files[0]);
});
addEventListener('hashchange', route); route();
