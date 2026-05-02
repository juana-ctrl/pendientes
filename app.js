// ============================================
// PENDIENTES — GTD-style task manager
// ============================================
'use strict';

const STORAGE_KEY = 'pendientes_v1';
const uid = () => (crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id_' + Math.random().toString(36).slice(2) + Date.now();

// ----- Default state -----
const DEFAULT_AREAS = [
  { id: 'plutto', name: 'Plutto', color: 'purple', emoji: '💼' },
  { id: 'personal', name: 'Personal', color: 'teal', emoji: '🏠' },
];

const COLORS = {
  purple: '#7F77DD', teal: '#1D9E75', coral: '#D85A30',
  pink: '#D4537E', blue: '#378ADD', amber: '#BA7517',
  green: '#639922', red: '#E24B4A', gray: '#888780',
};

const SEED_TASKS = [
  { title: 'Mandar oferta a Lucas', priority: 'high', areaId: 'plutto', projectId: null, scheduledDate: todayISO() },
  { title: 'Revisar contrato proveedor', priority: 'high', areaId: 'plutto', dueDate: todayISO(), scheduledDate: todayISO() },
  { title: 'Llamar al dentista', priority: 'low', areaId: 'personal', scheduledDate: tomorrowISO() },
  { title: 'Preparar deck para inversores', priority: 'medium', areaId: 'plutto', scheduledDate: addDaysISO(2) },
  { title: 'Renovar pasaporte', priority: 'low', areaId: 'personal', scheduledDate: addDaysISO(7) },
  { title: 'Definir scope Q3 launch', priority: 'medium', areaId: 'plutto', someday: true },
  { title: 'Ordenar Drive viejo', someday: true },
  { title: 'Idea: blog post sobre fundraising' }, // inbox (sin área)
];

let state = loadState();

// ----- Storage -----
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Object.assign({
        tasks: [], areas: DEFAULT_AREAS.slice(), projects: [],
        view: 'today', selectedId: null, search: '', theme: 'auto',
      }, parsed);
    }
  } catch (e) { console.warn('Failed to load state:', e); }
  return {
    tasks: [],
    areas: DEFAULT_AREAS.slice(),
    projects: [
      { id: 'hiring', name: 'Hiring', areaId: 'plutto' },
      { id: 'q3launch', name: 'Q3 Launch', areaId: 'plutto' },
    ],
    view: 'today',
    selectedId: null,
    search: '',
    theme: 'auto',
  };
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ----- Date helpers -----
function todayISO() {
  const d = new Date(); d.setHours(0,0,0,0);
  return d.toISOString().slice(0,10);
}
function tomorrowISO() {
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0,0,0,0);
  return d.toISOString().slice(0,10);
}
function addDaysISO(n) {
  const d = new Date(); d.setDate(d.getDate() + n); d.setHours(0,0,0,0);
  return d.toISOString().slice(0,10);
}
function isPastDate(iso) {
  if (!iso) return false;
  return iso < todayISO();
}
function isToday(iso) {
  return iso && iso === todayISO();
}
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  const t = todayISO(); const tom = tomorrowISO();
  if (iso === t) return 'hoy';
  if (iso === tom) return 'mañana';
  if (isPastDate(iso)) {
    const days = Math.round((new Date(t) - d) / 86400000);
    return days === 1 ? 'ayer' : `hace ${days}d`;
  }
  const diffDays = Math.round((d - new Date(t)) / 86400000);
  if (diffDays > 0 && diffDays < 7) {
    return d.toLocaleDateString('es-AR', { weekday: 'long' });
  }
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}
function fullDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ----- Theme -----
function applyTheme() {
  const root = document.documentElement;
  if (state.theme === 'light') root.setAttribute('data-theme', 'light');
  else if (state.theme === 'dark') root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
}

// ----- Task helpers -----
function newTask(data = {}) {
  return {
    id: uid(),
    title: '',
    notes: '',
    areaId: null,
    projectId: null,
    priority: null,         // 'high' | 'medium' | 'low' | null
    dueDate: null,          // ISO date - hard deadline
    scheduledDate: null,    // ISO date - planned to do
    tags: [],
    subtasks: [],
    someday: false,
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...data,
  };
}
function addTask(data) {
  const t = newTask(data);
  state.tasks.unshift(t);
  save();
  return t;
}
function updateTask(id, patch) {
  const t = state.tasks.find(t => t.id === id);
  if (!t) return;
  Object.assign(t, patch, { updatedAt: new Date().toISOString() });
  save();
  return t;
}
function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  if (state.selectedId === id) state.selectedId = null;
  save();
}
function toggleTask(id) {
  const t = state.tasks.find(t => t.id === id);
  if (!t) return;
  t.completed = !t.completed;
  t.completedAt = t.completed ? new Date().toISOString() : null;
  t.updatedAt = new Date().toISOString();
  save();
  return t;
}

// ----- Filters / counts -----
function tasksFor(view) {
  const T = todayISO();
  let list;
  switch (view) {
    case 'inbox':
      list = state.tasks.filter(t => !t.completed && !t.areaId && !t.projectId && !t.someday);
      break;
    case 'today':
      list = state.tasks.filter(t => !t.completed && !t.someday && (
        (t.scheduledDate && t.scheduledDate <= T) ||
        (t.dueDate && t.dueDate <= T)
      ));
      break;
    case 'upcoming':
      list = state.tasks.filter(t => !t.completed && !t.someday && (
        (t.scheduledDate && t.scheduledDate > T) ||
        (t.dueDate && t.dueDate > T)
      ));
      break;
    case 'someday':
      list = state.tasks.filter(t => !t.completed && t.someday);
      break;
    case 'logbook':
      list = state.tasks.filter(t => t.completed);
      list.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
      return list;
    default:
      if (view.startsWith('area:')) {
        const id = view.slice(5);
        list = state.tasks.filter(t => !t.completed && t.areaId === id && !t.someday);
      } else if (view.startsWith('project:')) {
        const id = view.slice(8);
        list = state.tasks.filter(t => t.projectId === id);
      } else list = [];
  }
  // sort: priority, then date
  const pri = { high: 0, medium: 1, low: 2, null: 3 };
  list.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const da = a.scheduledDate || a.dueDate || '9999';
    const db = b.scheduledDate || b.dueDate || '9999';
    if (da !== db) return da.localeCompare(db);
    const pa = pri[a.priority] ?? 3, pb = pri[b.priority] ?? 3;
    return pa - pb;
  });
  return list;
}

function viewTitle(v) {
  const m = {
    inbox: 'Inbox', today: 'Hoy', upcoming: 'Próximo',
    someday: 'Algún día', logbook: 'Logbook',
  };
  if (m[v]) return m[v];
  if (v.startsWith('area:')) {
    const a = state.areas.find(x => x.id === v.slice(5));
    return a ? `${a.emoji || ''} ${a.name}`.trim() : 'Área';
  }
  if (v.startsWith('project:')) {
    const p = state.projects.find(x => x.id === v.slice(8));
    return p ? p.name : 'Proyecto';
  }
  return '';
}

function viewSubtitle(v) {
  if (v === 'today') return fullDate(todayISO());
  if (v === 'inbox') return 'Capturá ideas rápido, después las clasificás';
  if (v === 'upcoming') return 'Las próximas tareas programadas';
  if (v === 'someday') return 'Sin fecha — para revisar más adelante';
  if (v === 'logbook') return 'Tareas completadas';
  if (v.startsWith('project:')) {
    const p = state.projects.find(x => x.id === v.slice(8));
    if (!p) return '';
    const tasks = state.tasks.filter(t => t.projectId === p.id);
    const done = tasks.filter(t => t.completed).length;
    return `${done}/${tasks.length} completadas`;
  }
  return '';
}

// ============================================
// RENDER
// ============================================
function render() {
  renderSidebar();
  renderContent();
  renderDetail();
  document.getElementById('topbarTitle').textContent = viewTitle(state.view);
}

// ----- Sidebar -----
function renderSidebar() {
  const root = document.getElementById('sidebarNav');
  const sections = [];
  // Main nav
  sections.push(`
    <div class="sb-section">
      ${navItem({ id: 'inbox', icon: iconInbox, label: 'Inbox', count: tasksFor('inbox').length })}
      ${navItem({ id: 'today', icon: iconStar, label: 'Hoy', count: tasksFor('today').length })}
      ${navItem({ id: 'upcoming', icon: iconCal, label: 'Próximo', count: tasksFor('upcoming').length })}
      ${navItem({ id: 'someday', icon: iconArchive, label: 'Algún día', count: tasksFor('someday').length })}
      ${navItem({ id: 'logbook', icon: iconBook, label: 'Logbook' })}
    </div>
  `);
  // Areas
  if (state.areas.length || state.projects.length) {
    let s = `<div class="sb-section">
      <div class="sb-section-title">Áreas <button class="add icon-btn" data-action="add-area" title="Nueva área">＋</button></div>`;
    state.areas.forEach(a => {
      s += navItem({
        id: 'area:' + a.id, icon: `<span class="swatch" style="background:${COLORS[a.color] || COLORS.gray}"></span>`,
        label: `${a.emoji ? a.emoji + ' ' : ''}${a.name}`,
        count: state.tasks.filter(t => !t.completed && t.areaId === a.id && !t.someday).length || ''
      });
      const projs = state.projects.filter(p => p.areaId === a.id);
      if (projs.length) {
        s += `<div class="area-children">`;
        projs.forEach(p => {
          const total = state.tasks.filter(t => t.projectId === p.id).length;
          const done = state.tasks.filter(t => t.projectId === p.id && t.completed).length;
          const pct = total ? Math.round(done / total * 100) : 0;
          s += navItem({
            id: 'project:' + p.id,
            icon: `<span class="progress" style="--p:${pct}"></span>`,
            label: p.name,
            count: total ? `${done}/${total}` : '',
            cls: 'project',
          });
        });
        s += `</div>`;
      }
    });
    // Unassigned projects
    const orphans = state.projects.filter(p => !p.areaId);
    if (orphans.length) {
      orphans.forEach(p => {
        const total = state.tasks.filter(t => t.projectId === p.id).length;
        const done = state.tasks.filter(t => t.projectId === p.id && t.completed).length;
        const pct = total ? Math.round(done / total * 100) : 0;
        s += navItem({
          id: 'project:' + p.id,
          icon: `<span class="progress" style="--p:${pct}"></span>`,
          label: p.name,
          count: total ? `${done}/${total}` : '',
        });
      });
    }
    s += `</div>`;
    sections.push(s);
  }
  // Projects-only section heading (if no areas have projects but standalone exist) handled above
  sections.push(`
    <div class="sb-section">
      <div class="sb-section-title">Proyectos <button class="add icon-btn" data-action="add-project" title="Nuevo proyecto">＋</button></div>
    </div>
  `);
  root.innerHTML = sections.join('');
  // Click handlers
  root.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => {
      switchView(el.dataset.view);
      closeMobileSidebar();
    });
  });
  root.querySelectorAll('[data-action="add-area"]').forEach(b => {
    b.addEventListener('click', e => { e.stopPropagation(); promptAddArea(); });
  });
  root.querySelectorAll('[data-action="add-project"]').forEach(b => {
    b.addEventListener('click', e => { e.stopPropagation(); promptAddProject(); });
  });
}

function navItem({ id, icon, label, count, cls = '' }) {
  const active = state.view === id ? ' active' : '';
  const iconHTML = typeof icon === 'function' ? icon() : icon;
  return `
    <div class="nav-item ${cls}${active}" data-view="${id}">
      <div class="icon">${iconHTML}</div>
      <div class="label">${escapeHtml(label)}</div>
      ${count !== undefined && count !== '' ? `<div class="count">${count}</div>` : ''}
    </div>
  `;
}

// ----- Icons (inline SVG) -----
const iconInbox = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>`;
const iconStar = () => `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="0.5"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;
const iconCal = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;
const iconArchive = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>`;
const iconBook = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`;
const iconCheck = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

// ----- Content -----
function renderContent() {
  const el = document.getElementById('content');
  const tasks = tasksFor(state.view);

  let header = `
    <div class="view-header">
      <h2>${escapeHtml(viewTitle(state.view))}</h2>
      <span class="subtitle">${escapeHtml(viewSubtitle(state.view))}</span>
    </div>
  `;

  // Project info card
  if (state.view.startsWith('project:')) {
    const p = state.projects.find(x => x.id === state.view.slice(8));
    if (p) {
      const tot = state.tasks.filter(t => t.projectId === p.id);
      const done = tot.filter(t => t.completed).length;
      const pct = tot.length ? Math.round(done / tot.length * 100) : 0;
      header += `
        <div class="project-info">
          <div style="display:flex; align-items:center; gap:8px; justify-content:space-between;">
            <strong style="font-size:14px;">${escapeHtml(p.name)}</strong>
            <button class="icon-btn" data-action="del-project" title="Eliminar proyecto" style="color: var(--text-muted)">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>
            </button>
          </div>
          <div class="progress-bar"><div style="width:${pct}%"></div></div>
          <div class="progress-text">${done} de ${tot.length} tareas · ${pct}%</div>
        </div>
      `;
    }
  }

  if (!tasks.length) {
    el.innerHTML = header + emptyState(state.view);
    bindContentEvents();
    return;
  }

  // Group by date for Today/Upcoming
  let body;
  if (state.view === 'today') {
    const overdue = tasks.filter(t => isPastDate(t.scheduledDate || t.dueDate) && !isToday(t.scheduledDate || t.dueDate));
    const todayItems = tasks.filter(t => isToday(t.scheduledDate || t.dueDate) || (!t.scheduledDate && !t.dueDate));
    body = '';
    if (overdue.length) body += groupHeader('Atrasadas') + overdue.map(taskHTML).join('');
    if (todayItems.length) body += groupHeader('Hoy') + todayItems.map(taskHTML).join('');
  } else if (state.view === 'upcoming') {
    // Group by date
    const groups = {};
    tasks.forEach(t => {
      const d = t.scheduledDate || t.dueDate;
      groups[d] = groups[d] || [];
      groups[d].push(t);
    });
    body = Object.keys(groups).sort().map(d =>
      groupHeader(formatDate(d) + ' · ' + new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })) +
      groups[d].map(taskHTML).join('')
    ).join('');
  } else if (state.view === 'logbook') {
    // Group by completion date
    const groups = {};
    tasks.forEach(t => {
      const d = (t.completedAt || '').slice(0, 10) || 'sin fecha';
      groups[d] = groups[d] || [];
      groups[d].push(t);
    });
    body = Object.keys(groups).sort().reverse().map(d => {
      const label = d === 'sin fecha' ? 'Sin fecha' : formatDate(d) + ' · ' + new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
      return groupHeader(label) + groups[d].map(taskHTML).join('');
    }).join('');
  } else {
    body = tasks.map(taskHTML).join('');
  }

  el.innerHTML = header + `<ul class="task-list">${body}</ul>`;
  bindContentEvents();
}

function groupHeader(label) {
  return `<div class="group-header">${escapeHtml(label)}</div>`;
}

function taskHTML(t) {
  const area = state.areas.find(a => a.id === t.areaId);
  const project = state.projects.find(p => p.id === t.projectId);
  const dateIso = t.scheduledDate || t.dueDate;
  const cls = ['task'];
  if (t.completed) cls.push('done');
  if (state.selectedId === t.id) cls.push('selected');

  const cbCls = ['checkbox'];
  if (t.priority) cbCls.push(t.priority);

  const meta = [];
  if (area) meta.push(`<span class="pill"><span class="swatch" style="background:${COLORS[area.color] || COLORS.gray}"></span>${escapeHtml(area.name)}</span>`);
  if (project) meta.push(`<span class="pill">${escapeHtml(project.name)}</span>`);
  if (dateIso) {
    let pillCls = 'pill';
    if (isPastDate(dateIso) && !t.completed) pillCls += ' due-overdue';
    else if (isToday(dateIso)) pillCls += ' due-today';
    else if (dateIso <= addDaysISO(2)) pillCls += ' due-soon';
    meta.push(`<span class="${pillCls}">📅 ${formatDate(dateIso)}</span>`);
  }
  if (t.tags && t.tags.length) {
    t.tags.forEach(tag => meta.push(`<span class="pill">#${escapeHtml(tag)}</span>`));
  }
  const subDone = (t.subtasks || []).filter(s => s.completed).length;
  if (t.subtasks && t.subtasks.length) {
    meta.push(`<span class="pill subtasks">☑ ${subDone}/${t.subtasks.length}</span>`);
  }

  // Subtasks preview (only first 3 if not selected)
  let subList = '';
  if (t.subtasks && t.subtasks.length && state.selectedId === t.id) {
    subList = `<ul class="subtask-list">` + t.subtasks.map(s => `
      <li class="subtask ${s.completed ? 'done' : ''}" data-subtask-id="${s.id}">
        <div class="checkbox" data-action="toggle-subtask" data-task="${t.id}" data-sub="${s.id}">${iconCheck}</div>
        <span>${escapeHtml(s.title)}</span>
      </li>
    `).join('') + `</ul>`;
  }

  return `
    <li class="${cls.join(' ')}" data-task-id="${t.id}">
      <div class="${cbCls.join(' ')}" data-action="toggle" data-id="${t.id}">${iconCheck}</div>
      <div class="task-body">
        <div class="title">${escapeHtml(t.title || '(sin título)')}</div>
        ${meta.length ? `<div class="meta">${meta.join('')}</div>` : ''}
        ${subList}
      </div>
    </li>
  `;
}

function emptyState(view) {
  const map = {
    inbox: { emoji: '📥', title: 'Inbox vacío', text: 'Capturá una idea con el botón + (o ⌘N)' },
    today: { emoji: '🎯', title: '¡Día limpio!', text: 'No tenés nada para hoy. Revisá Próximo o Inbox.' },
    upcoming: { emoji: '📅', title: 'Sin tareas programadas', text: 'Programá algo desde el detalle de una tarea.' },
    someday: { emoji: '💭', title: 'Sin ideas guardadas', text: 'Marcá tareas como "Algún día" desde el detalle.' },
    logbook: { emoji: '📖', title: 'Logbook vacío', text: 'Las tareas completadas aparecen acá.' },
  };
  const m = map[view] || { emoji: '✨', title: 'Sin tareas', text: 'Agregá una con el botón +' };
  return `<div class="empty-state">
    <div class="emoji">${m.emoji}</div>
    <h3>${m.title}</h3>
    <p>${m.text}</p>
  </div>`;
}

function bindContentEvents() {
  document.querySelectorAll('.task').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('[data-action="toggle"]') || e.target.closest('[data-action="toggle-subtask"]')) return;
      selectTask(el.dataset.taskId);
    });
  });
  document.querySelectorAll('[data-action="toggle"]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const id = el.dataset.id;
      const wasCompleted = state.tasks.find(t => t.id === id)?.completed;
      toggleTask(id);
      render();
      if (!wasCompleted) toast('✓ Completada');
    });
  });
  document.querySelectorAll('[data-action="toggle-subtask"]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const tid = el.dataset.task, sid = el.dataset.sub;
      const t = state.tasks.find(x => x.id === tid);
      if (!t) return;
      const s = t.subtasks.find(x => x.id === sid);
      if (s) {
        s.completed = !s.completed;
        save();
        render();
      }
    });
  });
  document.querySelectorAll('[data-action="del-project"]').forEach(b => {
    b.addEventListener('click', () => {
      const id = state.view.slice(8);
      const p = state.projects.find(x => x.id === id);
      if (!p) return;
      if (!confirm(`¿Eliminar el proyecto "${p.name}"? Las tareas no se borran (vuelven al área o inbox).`)) return;
      state.tasks.forEach(t => { if (t.projectId === id) t.projectId = null; });
      state.projects = state.projects.filter(x => x.id !== id);
      state.view = 'today';
      save();
      render();
    });
  });
}

function selectTask(id) {
  state.selectedId = id;
  document.getElementById('detail').classList.add('open');
  render();
}

// ----- Detail panel -----
function renderDetail() {
  const el = document.getElementById('detailBody');
  const t = state.tasks.find(x => x.id === state.selectedId);
  if (!t) {
    el.innerHTML = '';
    document.getElementById('detail').classList.remove('open');
    return;
  }

  const areas = ['<option value="">Sin área</option>'].concat(
    state.areas.map(a => `<option value="${a.id}" ${t.areaId === a.id ? 'selected' : ''}>${escapeHtml(a.name)}</option>`)
  ).join('');
  const projects = ['<option value="">Sin proyecto</option>'].concat(
    state.projects.map(p => `<option value="${p.id}" ${t.projectId === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`)
  ).join('');

  el.innerHTML = `
    <input type="text" class="title-input" id="detailTitle" value="${escapeAttr(t.title)}" placeholder="Título de la tarea" />
    <textarea id="detailNotes" placeholder="Notas...">${escapeHtml(t.notes || '')}</textarea>

    <div class="detail-section">
      <div class="detail-row">
        <span class="label">Programada</span>
        <input type="date" id="detailScheduled" value="${t.scheduledDate || ''}" />
      </div>
      <div class="detail-row">
        <span class="label">Vence</span>
        <input type="date" id="detailDue" value="${t.dueDate || ''}" />
      </div>
      <div class="detail-row">
        <span class="label">Prioridad</span>
        <select id="detailPriority">
          <option value="" ${!t.priority ? 'selected' : ''}>Sin prioridad</option>
          <option value="high" ${t.priority === 'high' ? 'selected' : ''}>Alta</option>
          <option value="medium" ${t.priority === 'medium' ? 'selected' : ''}>Media</option>
          <option value="low" ${t.priority === 'low' ? 'selected' : ''}>Baja</option>
        </select>
      </div>
      <div class="detail-row">
        <span class="label">Área</span>
        <select id="detailArea">${areas}</select>
      </div>
      <div class="detail-row">
        <span class="label">Proyecto</span>
        <select id="detailProject">${projects}</select>
      </div>
      <div class="detail-row">
        <span class="label">Tags</span>
        <input type="text" id="detailTags" placeholder="separados por coma" value="${(t.tags || []).join(', ')}" style="border:none;background:none;flex:1;color:var(--text);font-size:13px;" />
      </div>
      <div class="detail-row">
        <span class="label">Algún día</span>
        <input type="checkbox" id="detailSomeday" ${t.someday ? 'checked' : ''} style="margin-left:0;" />
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-label">Subtareas</div>
      <ul class="subtask-list" id="detailSubtasks">
        ${(t.subtasks || []).map(s => `
          <li class="subtask ${s.completed ? 'done' : ''}" data-id="${s.id}">
            <div class="checkbox" data-toggle="${s.id}">${iconCheck}</div>
            <span>${escapeHtml(s.title)}</span>
            <button class="icon-btn" data-del="${s.id}" title="Eliminar"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
          </li>
        `).join('')}
      </ul>
      <div class="subtask-input-wrap">
        <div class="checkbox" style="opacity:0.5;"></div>
        <input type="text" class="subtask-input" id="newSubtask" placeholder="Agregar subtarea..." />
      </div>
    </div>

    <div class="detail-section" style="display:flex; justify-content:space-between; align-items:center; padding-top:16px; border-top: 1px solid var(--border);">
      <div style="font-size:11px; color:var(--text-subtle);">
        Creada ${formatDate(t.createdAt.slice(0,10)) || 'hoy'}
      </div>
      <button class="danger-btn" id="deleteTaskBtn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>
        Eliminar tarea
      </button>
    </div>
  `;

  // Bind detail events
  const upd = (key, val) => { updateTask(t.id, { [key]: val }); render(); };

  document.getElementById('detailTitle').addEventListener('blur', e => upd('title', e.target.value.trim()));
  document.getElementById('detailNotes').addEventListener('blur', e => upd('notes', e.target.value));
  document.getElementById('detailScheduled').addEventListener('change', e => upd('scheduledDate', e.target.value || null));
  document.getElementById('detailDue').addEventListener('change', e => upd('dueDate', e.target.value || null));
  document.getElementById('detailPriority').addEventListener('change', e => upd('priority', e.target.value || null));
  document.getElementById('detailArea').addEventListener('change', e => upd('areaId', e.target.value || null));
  document.getElementById('detailProject').addEventListener('change', e => upd('projectId', e.target.value || null));
  document.getElementById('detailTags').addEventListener('blur', e => {
    const tags = e.target.value.split(',').map(s => s.trim().replace(/^#/, '')).filter(Boolean);
    upd('tags', tags);
  });
  document.getElementById('detailSomeday').addEventListener('change', e => upd('someday', e.target.checked));

  // Subtasks
  document.querySelectorAll('[data-toggle]').forEach(el => {
    el.addEventListener('click', () => {
      const sid = el.dataset.toggle;
      const s = t.subtasks.find(x => x.id === sid);
      if (s) { s.completed = !s.completed; save(); render(); }
    });
  });
  document.querySelectorAll('[data-del]').forEach(el => {
    el.addEventListener('click', () => {
      const sid = el.dataset.del;
      t.subtasks = t.subtasks.filter(x => x.id !== sid);
      save(); render();
    });
  });
  document.getElementById('newSubtask').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      t.subtasks = t.subtasks || [];
      t.subtasks.push({ id: uid(), title: e.target.value.trim(), completed: false });
      save();
      render();
      setTimeout(() => document.getElementById('newSubtask')?.focus(), 30);
    }
  });
  document.getElementById('deleteTaskBtn').addEventListener('click', () => {
    if (confirm(`¿Eliminar "${t.title}"?`)) {
      deleteTask(t.id);
      render();
    }
  });
}

// ============================================
// VIEW SWITCHING
// ============================================
function switchView(v) {
  state.view = v;
  state.selectedId = null;
  document.getElementById('detail').classList.remove('open');
  save();
  render();
}

// ============================================
// QUICK ADD
// ============================================
const qaState = { areaId: null, projectId: null, priority: null, dueDate: null, scheduledDate: null, tags: [], someday: false };

function openQuickAdd() {
  document.getElementById('quickAddOverlay').classList.add('show');
  resetQA();
  setTimeout(() => document.getElementById('quickAddInput').focus(), 60);
}
function closeQuickAdd() {
  document.getElementById('quickAddOverlay').classList.remove('show');
  document.getElementById('quickAddInput').value = '';
  resetQA();
}
function resetQA() {
  qaState.areaId = null; qaState.projectId = null; qaState.priority = null;
  qaState.dueDate = null; qaState.scheduledDate = null; qaState.tags = []; qaState.someday = false;
  // Default scheduled to view context
  if (state.view === 'today') qaState.scheduledDate = todayISO();
  else if (state.view.startsWith('area:')) qaState.areaId = state.view.slice(5);
  else if (state.view.startsWith('project:')) {
    qaState.projectId = state.view.slice(8);
    const p = state.projects.find(x => x.id === qaState.projectId);
    if (p) qaState.areaId = p.areaId;
  }
  else if (state.view === 'someday') qaState.someday = true;
  renderQAMeta();
}
function renderQAMeta() {
  const meta = document.getElementById('quickAddMeta');
  const pills = [];
  if (qaState.areaId) {
    const a = state.areas.find(x => x.id === qaState.areaId);
    if (a) pills.push(`<span class="qa-pill active">@${a.name} <button data-clear="area">×</button></span>`);
  }
  if (qaState.projectId) {
    const p = state.projects.find(x => x.id === qaState.projectId);
    if (p) pills.push(`<span class="qa-pill active">+${p.name} <button data-clear="project">×</button></span>`);
  }
  if (qaState.priority) {
    const labels = { high: '!alta', medium: '!media', low: '!baja' };
    pills.push(`<span class="qa-pill active">${labels[qaState.priority]} <button data-clear="priority">×</button></span>`);
  }
  if (qaState.scheduledDate) pills.push(`<span class="qa-pill active">📅 ${formatDate(qaState.scheduledDate)} <button data-clear="scheduled">×</button></span>`);
  if (qaState.dueDate) pills.push(`<span class="qa-pill active">⚠ vence ${formatDate(qaState.dueDate)} <button data-clear="due">×</button></span>`);
  if (qaState.someday) pills.push(`<span class="qa-pill active">💭 algún día <button data-clear="someday">×</button></span>`);
  qaState.tags.forEach(tag => pills.push(`<span class="qa-pill active">#${tag}</span>`));
  meta.innerHTML = pills.join('') || `<span style="color:var(--text-subtle); font-size: 12px;">Tip: escribí @, +, !, # o palabras como "hoy", "mañana"</span>`;
  meta.querySelectorAll('[data-clear]').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      const k = b.dataset.clear;
      if (k === 'area') qaState.areaId = null;
      if (k === 'project') qaState.projectId = null;
      if (k === 'priority') qaState.priority = null;
      if (k === 'scheduled') qaState.scheduledDate = null;
      if (k === 'due') qaState.dueDate = null;
      if (k === 'someday') qaState.someday = false;
      renderQAMeta();
    });
  });
}

// Parse natural language input
function parseQuickAdd(input) {
  let title = input;
  let areaId = qaState.areaId, projectId = qaState.projectId, priority = qaState.priority;
  let scheduledDate = qaState.scheduledDate, dueDate = qaState.dueDate, someday = qaState.someday;
  const tags = [...qaState.tags];

  // @area
  title = title.replace(/(?:^|\s)@(\S+)/g, (_, name) => {
    const a = state.areas.find(x => x.name.toLowerCase() === name.toLowerCase() || x.id === name.toLowerCase());
    if (a) areaId = a.id;
    return '';
  });
  // +project
  title = title.replace(/(?:^|\s)\+(\S+)/g, (_, name) => {
    const p = state.projects.find(x => x.name.toLowerCase() === name.toLowerCase() || x.id === name.toLowerCase());
    if (p) { projectId = p.id; if (!areaId) areaId = p.areaId; }
    return '';
  });
  // !priority
  title = title.replace(/(?:^|\s)!(alta|media|baja|high|medium|low)/gi, (_, p) => {
    const map = { alta: 'high', high: 'high', media: 'medium', medium: 'medium', baja: 'low', low: 'low' };
    priority = map[p.toLowerCase()];
    return '';
  });
  // #tag
  title = title.replace(/(?:^|\s)#(\w+)/g, (_, t) => { tags.push(t); return ''; });
  // dates
  const dateMatchers = [
    [/\bhoy\b/i, () => todayISO()],
    [/\bmañana\b/i, () => tomorrowISO()],
    [/\balgun ?dia\b|\balgún ?día\b|\bsomeday\b/i, () => { someday = true; return null; }],
    [/\b(lun|mar|mie|mié|jue|vie|sab|sáb|dom)(es|tes|coles|ves|nes|ado|ingo)?\b/i, (m) => {
      const dayMap = { lun:1, mar:2, mie:3, mié:3, jue:4, vie:5, sab:6, sáb:6, dom:0 };
      const target = dayMap[m[1].toLowerCase()];
      if (target === undefined) return null;
      const d = new Date(); d.setHours(0,0,0,0);
      const cur = d.getDay();
      let diff = (target - cur + 7) % 7;
      if (diff === 0) diff = 7;
      d.setDate(d.getDate() + diff);
      return d.toISOString().slice(0,10);
    }],
    [/\bla semana que viene\b|\bproxima semana\b|\bpróxima semana\b/i, () => addDaysISO(7)],
    [/\ben (\d+) días?\b/i, (m) => addDaysISO(parseInt(m[1]))],
    [/\bel (\d{1,2})\/(\d{1,2})\b/, (m) => {
      const day = parseInt(m[1]), mon = parseInt(m[2]) - 1;
      const d = new Date(); d.setMonth(mon, day); d.setHours(0,0,0,0);
      if (d < new Date()) d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().slice(0,10);
    }],
  ];
  dateMatchers.forEach(([rx, fn]) => {
    title = title.replace(rx, (...args) => {
      const iso = fn(args);
      if (iso) scheduledDate = iso;
      return '';
    });
  });

  return {
    title: title.trim().replace(/\s+/g, ' '),
    areaId, projectId, priority, scheduledDate, dueDate, tags, someday,
  };
}

function saveQuickAdd() {
  const input = document.getElementById('quickAddInput').value.trim();
  if (!input) { closeQuickAdd(); return; }
  const parsed = parseQuickAdd(input);
  if (!parsed.title) { closeQuickAdd(); return; }
  addTask(parsed);
  closeQuickAdd();
  toast('✓ Tarea agregada');
  render();
}

// Live update meta as user types
function liveParseQA() {
  const v = document.getElementById('quickAddInput').value;
  if (!v.trim()) { renderQAMeta(); return; }
  const parsed = parseQuickAdd(v);
  // Don't mutate qaState fully (user may want to keep manual selections), only show preview
  const meta = document.getElementById('quickAddMeta');
  const pills = [];
  if (parsed.areaId) {
    const a = state.areas.find(x => x.id === parsed.areaId);
    if (a) pills.push(`<span class="qa-pill active">@${a.name}</span>`);
  }
  if (parsed.projectId) {
    const p = state.projects.find(x => x.id === parsed.projectId);
    if (p) pills.push(`<span class="qa-pill active">+${p.name}</span>`);
  }
  if (parsed.priority) {
    const labels = { high: '!alta', medium: '!media', low: '!baja' };
    pills.push(`<span class="qa-pill active">${labels[parsed.priority]}</span>`);
  }
  if (parsed.scheduledDate) pills.push(`<span class="qa-pill active">📅 ${formatDate(parsed.scheduledDate)}</span>`);
  if (parsed.someday) pills.push(`<span class="qa-pill active">💭 algún día</span>`);
  parsed.tags.forEach(tag => pills.push(`<span class="qa-pill active">#${tag}</span>`));
  meta.innerHTML = pills.join('') || `<span style="color:var(--text-subtle); font-size: 12px;">Tip: probá <kbd style="font-family:inherit;background:var(--bg-elev);border:1px solid var(--border);padding:1px 5px;border-radius:3px;font-size:11px;">@plutto !alta mañana</kbd></span>`;
}

// ============================================
// SEARCH
// ============================================
function openSearch() {
  document.getElementById('searchOverlay').classList.add('show');
  setTimeout(() => document.getElementById('searchModalInput').focus(), 60);
  renderSearchResults('');
}
function closeSearch() {
  document.getElementById('searchOverlay').classList.remove('show');
  document.getElementById('searchModalInput').value = '';
}
function renderSearchResults(q) {
  const el = document.getElementById('searchResults');
  q = q.toLowerCase().trim();
  if (!q) {
    el.innerHTML = `<div class="search-empty">Escribí para buscar tareas, proyectos o tags</div>`;
    return;
  }
  const results = state.tasks.filter(t =>
    t.title.toLowerCase().includes(q) ||
    (t.notes || '').toLowerCase().includes(q) ||
    (t.tags || []).some(tag => tag.toLowerCase().includes(q))
  ).slice(0, 30);
  if (!results.length) {
    el.innerHTML = `<div class="search-empty">Sin resultados para "${escapeHtml(q)}"</div>`;
    return;
  }
  el.innerHTML = `<ul class="task-list" style="padding: 0 14px 14px;">${results.map(taskHTML).join('')}</ul>`;
  el.querySelectorAll('.task').forEach(item => {
    item.addEventListener('click', () => {
      closeSearch();
      const t = state.tasks.find(x => x.id === item.dataset.taskId);
      if (t) {
        // Switch to a view that shows the task
        if (t.completed) state.view = 'logbook';
        else if (t.someday) state.view = 'someday';
        else if (t.scheduledDate && t.scheduledDate <= todayISO()) state.view = 'today';
        else if (t.scheduledDate) state.view = 'upcoming';
        else if (t.areaId) state.view = 'area:' + t.areaId;
        else state.view = 'inbox';
        selectTask(t.id);
      }
    });
  });
}

// ============================================
// AREAS / PROJECTS
// ============================================
function promptAddArea() {
  const name = prompt('Nombre del área (ej: Trabajo, Personal, Salud):');
  if (!name) return;
  const colors = ['purple', 'teal', 'coral', 'pink', 'blue', 'amber', 'green'];
  const used = new Set(state.areas.map(a => a.color));
  const color = colors.find(c => !used.has(c)) || 'gray';
  const emoji = prompt('Emoji para el área (opcional):', '📁') || '';
  state.areas.push({ id: uid(), name: name.trim(), color, emoji: emoji.trim() });
  save();
  render();
}

function promptAddProject() {
  const name = prompt('Nombre del proyecto:');
  if (!name) return;
  let areaId = null;
  if (state.areas.length) {
    const list = state.areas.map((a, i) => `${i + 1}. ${a.name}`).join('\n');
    const sel = prompt(`¿En qué área?\n${list}\n0. Sin área\n\nElegí un número:`, '1');
    const idx = parseInt(sel) - 1;
    if (idx >= 0 && state.areas[idx]) areaId = state.areas[idx].id;
  }
  state.projects.push({ id: uid(), name: name.trim(), areaId });
  save();
  render();
}

// ============================================
// EXPORT / IMPORT / RESET
// ============================================
function exportData() {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `pendientes-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('✓ Backup descargado');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed.tasks || !Array.isArray(parsed.tasks)) throw new Error('Formato inválido');
      if (!confirm(`Importar ${parsed.tasks.length} tareas? Esto reemplazará tus datos actuales.`)) return;
      state = Object.assign(loadState(), parsed);
      save();
      render();
      toast('✓ Datos importados');
    } catch (err) {
      alert('Error al importar: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function loadSeed() {
  if (state.tasks.length && !confirm('Esto va a agregar ~8 tareas de ejemplo a las que ya tenés. ¿Seguir?')) return;
  SEED_TASKS.forEach(seed => state.tasks.push(newTask(seed)));
  save();
  render();
  toast('✓ Tareas de ejemplo cargadas');
}

function resetAll() {
  if (!confirm('Esto borra TODAS tus tareas, áreas y proyectos. ¿Estás segura?')) return;
  if (!confirm('Última confirmación. ¿Borrar todo?')) return;
  localStorage.removeItem(STORAGE_KEY);
  state = loadState();
  render();
  toast('Todo borrado');
}

// ============================================
// UI HELPERS
// ============================================
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function escapeAttr(s) { return escapeHtml(s); }

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// Mobile sidebar
function openMobileSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sbOverlay').classList.add('show');
}
function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sbOverlay').classList.remove('show');
}

// ============================================
// EVENTS
// ============================================
function bindGlobalEvents() {
  // FAB
  document.getElementById('fab').addEventListener('click', openQuickAdd);

  // Quick add
  const qaInput = document.getElementById('quickAddInput');
  qaInput.addEventListener('input', liveParseQA);
  qaInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); saveQuickAdd(); }
    if (e.key === 'Escape') closeQuickAdd();
  });
  document.getElementById('qaCancel').addEventListener('click', closeQuickAdd);
  document.getElementById('qaSave').addEventListener('click', saveQuickAdd);
  document.getElementById('quickAddOverlay').addEventListener('click', e => {
    if (e.target.id === 'quickAddOverlay') closeQuickAdd();
  });

  // Search
  document.getElementById('searchInput').addEventListener('focus', e => { e.target.blur(); openSearch(); });
  document.getElementById('searchInput').addEventListener('click', openSearch);
  const searchModalInput = document.getElementById('searchModalInput');
  searchModalInput.addEventListener('input', e => renderSearchResults(e.target.value));
  searchModalInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSearch();
  });
  document.getElementById('searchOverlay').addEventListener('click', e => {
    if (e.target.id === 'searchOverlay') closeSearch();
  });

  // Detail close
  document.getElementById('detailClose').addEventListener('click', () => {
    state.selectedId = null;
    document.getElementById('detail').classList.remove('open');
    render();
  });

  // Mobile menu
  document.getElementById('menuBtn').addEventListener('click', openMobileSidebar);
  document.getElementById('sbOverlay').addEventListener('click', closeMobileSidebar);

  // Settings menu
  const settingsBtn = document.getElementById('settingsBtn');
  const menu = document.getElementById('settingsMenu');
  settingsBtn.addEventListener('click', e => {
    e.stopPropagation();
    const rect = settingsBtn.getBoundingClientRect();
    menu.style.top = (rect.bottom + 4) + 'px';
    menu.style.left = (rect.left - 160) + 'px';
    menu.style.right = 'auto';
    menu.classList.toggle('show');
  });
  document.addEventListener('click', () => menu.classList.remove('show'));
  menu.addEventListener('click', e => e.stopPropagation());
  menu.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      menu.classList.remove('show');
      if (action === 'theme-light') { state.theme = 'light'; save(); applyTheme(); }
      else if (action === 'theme-dark') { state.theme = 'dark'; save(); applyTheme(); }
      else if (action === 'theme-auto') { state.theme = 'auto'; save(); applyTheme(); }
      else if (action === 'export') exportData();
      else if (action === 'import') document.getElementById('importFile').click();
      else if (action === 'seed') loadSeed();
      else if (action === 'reset') resetAll();
    });
  });

  // Import file
  document.getElementById('importFile').addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) importData(f);
    e.target.value = '';
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    const meta = e.metaKey || e.ctrlKey;
    // Modal-aware: when modals open, ignore most shortcuts
    const modalOpen = document.querySelector('.modal-overlay.show');

    if (e.key === 'Escape') {
      if (modalOpen) { closeQuickAdd(); closeSearch(); return; }
      if (state.selectedId) {
        state.selectedId = null;
        document.getElementById('detail').classList.remove('open');
        render();
        return;
      }
    }

    if (modalOpen) return;

    // Cmd/Ctrl + N: new task
    if (meta && e.key.toLowerCase() === 'n') { e.preventDefault(); openQuickAdd(); return; }
    // Cmd/Ctrl + K: search
    if (meta && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); return; }
    // Cmd/Ctrl + 1..5: views
    if (meta && /^[1-5]$/.test(e.key)) {
      e.preventDefault();
      const map = { '1': 'inbox', '2': 'today', '3': 'upcoming', '4': 'someday', '5': 'logbook' };
      switchView(map[e.key]);
      return;
    }

    if (inField) return;

    // Plain shortcuts
    if (e.key.toLowerCase() === 'n') { e.preventDefault(); openQuickAdd(); return; }
    if (e.key === '/') { e.preventDefault(); openSearch(); return; }
    if (e.key === ' ' && state.selectedId) {
      e.preventDefault();
      toggleTask(state.selectedId);
      render();
      return;
    }
    // Arrow nav
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      const tasks = tasksFor(state.view);
      if (!tasks.length) return;
      let idx = tasks.findIndex(t => t.id === state.selectedId);
      if (e.key === 'ArrowDown') idx = Math.min(idx + 1, tasks.length - 1);
      else idx = Math.max(idx - 1, 0);
      if (idx < 0) idx = 0;
      selectTask(tasks[idx].id);
      // scroll into view
      setTimeout(() => {
        const el = document.querySelector(`.task[data-task-id="${tasks[idx].id}"]`);
        if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 30);
      return;
    }
    if (e.key === 'Backspace' && state.selectedId) {
      e.preventDefault();
      const t = state.tasks.find(x => x.id === state.selectedId);
      if (t && confirm(`¿Eliminar "${t.title}"?`)) {
        deleteTask(t.id);
        render();
      }
      return;
    }
  });
}

// ============================================
// INIT
// ============================================
function init() {
  applyTheme();
  // Watch for system theme changes when in auto mode
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (state.theme === 'auto') applyTheme();
    });
  }

  // First run: load seed
  if (!state.tasks.length && !localStorage.getItem(STORAGE_KEY + '_initialized')) {
    SEED_TASKS.forEach(seed => state.tasks.push(newTask(seed)));
    localStorage.setItem(STORAGE_KEY + '_initialized', '1');
    save();
  }

  bindGlobalEvents();
  render();
}

init();
