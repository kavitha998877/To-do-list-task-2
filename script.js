/* Multi-theme Dev To-Do — features:
   - 6 themes + light mode toggle
   - Inline edit, keyboard-first
   - Filters: all/active/completed
   - Import/Export JSON
   - LocalStorage persistence
*/

const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));

const listEl = qs('#list');
const input = qs('#taskInput');
const addForm = qs('#addForm');
const search = qs('#search');
const filters = qsa('.filter');
const countEl = qs('#count');
const clearCompletedBtn = qs('#clearCompleted');
const exportBtn = qs('#exportBtn');
const importFile = qs('#importFile');
const themeSelect = qs('#themeSelect');
const toggleLight = qs('#toggleLight');

const STORAGE_KEY = 'dev-todo-v2';
let state = {
  tasks: [], // {id, text, done, priority, created}
  filter: 'all',
  q: ''
};

// -- Utility helpers
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
const load = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
const plural = n => n === 1 ? 'task' : 'tasks';

// safe text
function escapeHtml(s=''){ return String(s).replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]))}

// -- Render
function render(){
  const items = state.tasks.filter(t => {
    if(state.filter === 'active') return !t.done;
    if(state.filter === 'completed') return t.done;
    return true;
  }).filter(t => t.text.toLowerCase().includes(state.q.toLowerCase()));

  listEl.innerHTML = '';
  items.forEach(t => {
    const li = document.createElement('li');
    li.className = 'task-item' + (t.done ? ' completed' : '');
    li.dataset.id = t.id;

    li.innerHTML = `
      <div class="chk ${t.done ? 'checked' : ''}" title="Toggle done" role="button" tabindex="0"> ${t.done ? '✔' : ''}</div>
      <div class="task-text" contenteditable="false" aria-label="Task">${escapeHtml(t.text)}</div>
      <div class="task-meta">${t.priority} · ${new Date(t.created).toLocaleTimeString()}</div>
      <div class="actions">
        <button class="btn edit" title="Edit (E)">Edit</button>
        <button class="btn delete" title="Delete">Delete</button>
      </div>
    `;

    const chk = li.querySelector('.chk');
    const txt = li.querySelector('.task-text');
    const editBtn = li.querySelector('.edit');
    const deleteBtn = li.querySelector('.delete');

    chk.addEventListener('click', () => toggleDone(t.id));
    chk.addEventListener('keydown', e => { if(e.key==='Enter') toggleDone(t.id) });

    editBtn.addEventListener('click', () => startEdit(li, t.id));
    txt.addEventListener('dblclick', () => startEdit(li, t.id));

    deleteBtn.addEventListener('click', () => {
      state.tasks = state.tasks.filter(x => x.id !== t.id);
      save(); render();
    });

    listEl.appendChild(li);
  });

  countEl.textContent = state.tasks.length + ' ' + plural(state.tasks.length);
}

// -- Actions
function addTask(text, priority='normal'){
  const task = { id: uid(), text: text.trim(), done:false, priority, created: Date.now() };
  state.tasks.unshift(task);
  save();
  render();
}

function toggleDone(id){
  const t = state.tasks.find(x=>x.id===id);
  if(!t) return;
  t.done = !t.done;
  save(); render();
}

function startEdit(li, id){
  const t = state.tasks.find(x=>x.id===id);
  if(!t) return;
  const txt = li.querySelector('.task-text');
  txt.contentEditable = "true";
  txt.classList.add('editable');
  txt.focus();

  // caret to end
  document.execCommand('selectAll', false, null);
  document.getSelection().collapseToEnd();

  function finish(){
    txt.contentEditable = "false";
    txt.classList.remove('editable');
    const newText = txt.textContent.trim();
    if(newText) t.text = newText;
    save(); render();
    cleanup();
  }
  function cleanup(){
    txt.removeEventListener('blur', finish);
    txt.removeEventListener('keydown', onKey);
  }
  function onKey(e){
    if(e.key === 'Enter'){ e.preventDefault(); finish(); }
    if(e.key === 'Escape'){ txt.textContent = t.text; finish(); }
  }
  txt.addEventListener('blur', finish);
  txt.addEventListener('keydown', onKey);
}

function setFilter(f){
  state.filter = f;
  filters.forEach(b => b.classList.toggle('active', b.dataset.filter===f));
  render();
}

// -- Handlers
addForm.addEventListener('submit', e => {
  e.preventDefault();
  const txt = input.value.trim();
  const pr = qs('#priority').value;
  if(!txt) return input.focus();
  addTask(txt, pr);
  input.value = '';
});

qs('#search').addEventListener('input', e => {
  state.q = e.target.value;
  render();
});

filters.forEach(btn => btn.addEventListener('click', () => setFilter(btn.dataset.filter)));

clearCompletedBtn.addEventListener('click', () => {
  state.tasks = state.tasks.filter(t => !t.done);
  save(); render();
});

// export JSON
exportBtn.addEventListener('click', exportJSON);
function exportJSON(){
  const blob = new Blob([JSON.stringify(state.tasks, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'dev-todo-export.json'; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}

// import JSON
importFile.addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if(!f) return;
  try{
    const txt = await f.text();
    const parsed = JSON.parse(txt);
    if(Array.isArray(parsed)){
      parsed.forEach(it => {
        if(!it.id) it.id = uid();
        if(typeof it.done !== 'boolean') it.done = false;
        if(!it.created) it.created = Date.now();
        if(!it.text) it.text = 'Untitled task';
      });
      state.tasks = [...parsed, ...state.tasks];
      save(); render();
      importFile.value = '';
    } else throw new Error('Invalid file format');
  } catch(err){
    alert('Import failed: ' + err.message);
  }
});

// load at startup
function boot(){
  state.tasks = load();
  render();
}
boot();

// keyboard shortcuts (global)
document.addEventListener('keydown', (e) => {
  if(e.ctrlKey && (e.key === 's' || e.key === 'S')){
    e.preventDefault();
    exportJSON();
  }
  if(e.key === 'e' || e.key === 'E'){ // edit first item
    const first = listEl.querySelector('.task-item');
    if(first) {
      const id = first.dataset.id;
      startEdit(first, id);
    }
  }
  if(e.key === 'Delete'){
    const focused = document.activeElement.closest && document.activeElement.closest('.task-item');
    if(focused){
      const id = focused.dataset.id;
      state.tasks = state.tasks.filter(t=>t.id !== id);
      save(); render();
    }
  }
});

// -- THEME SWITCHING
// apply theme class to <body> and reflect the select
function applyTheme(themeClass){
  // clear existing theme classes (they all start with "theme-")
  document.body.className = document.body.className
    .split(/\s+/)
    .filter(c => !c.startsWith('theme-'))
    .join(' ')
    .trim();

  document.body.classList.add(themeClass);
  // keep light class if active
  if(localStorage.getItem('dev-todo-light') === 'true') document.body.classList.add('light');
}

themeSelect.addEventListener('change', (e) => {
  applyTheme(e.target.value);
  // save default theme (optional)
  localStorage.setItem('dev-todo-theme', e.target.value);
});

// toggle light
toggleLight.addEventListener('click', () => {
  document.body.classList.toggle('light');
  const on = document.body.classList.contains('light');
  localStorage.setItem('dev-todo-light', on ? 'true' : 'false');
});

// restore saved theme / light preferences
(function restoreTheme(){
  const saved = localStorage.getItem('dev-todo-theme');
  if(saved){
    themeSelect.value = saved;
    applyTheme(saved);
  } else {
    // initial select sync
    const initial = document.body.classList.value.split(' ').find(c=>c.startsWith('theme-')) || 'theme-professional';
    themeSelect.value = initial;
  }
  if(localStorage.getItem('dev-todo-light') === 'true') document.body.classList.add('light');
})();

// If you want to hide the switcher (for standalone pages), remove or hide the .tools block in the HTML
