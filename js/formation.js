import { supabase } from './supabase.js';
import { initSidebarProgress } from './common.js';

// --- Override Mapping ---
const VIDEO_OVERRIDES = {
    "Tradingview": "OtuUAtms9Sw",
    "Ajouter nos actifs": "esGwrHiQhcY",
    "Analyser nos actifs": "esGwrHiQhcY"
};

// --- State Management ---
let state = {
    user: null,
    formation: null,
    chapters: [],
    lessons: [],
    progress: {}, 
    currentLesson: null,
    allLessonsSorted: []
};

// --- DOM Elements ---
const el = {
    get formationTitle() { return document.getElementById('formation-title'); },
    get formationDescription() { return document.getElementById('formation-description'); },
    get chaptersContainer() { return document.getElementById('chapters-container'); },
    get videoPlaceholder() { return document.getElementById('video-placeholder'); },
    get playerContainer() { return document.getElementById('youtube-player-container'); },
    get currentLessonTitle() { return document.getElementById('current-lesson-title'); },
    get currentLessonDescription() { return document.getElementById('current-lesson-description'); },
    get lessonStatusBadge() { return document.getElementById('lesson-status-badge'); },
    get completionZone() { return document.getElementById('completion-zone'); },
    get btnComplete() { return document.getElementById('btn-complete-lesson'); }
};

// --- Utils ---
function getTargetYouTubeID(lesson) {
    if (!lesson) return null;
    for (const [titlePart, overrideID] of Object.entries(VIDEO_OVERRIDES)) {
        if (lesson.title.toLowerCase().includes(titlePart.toLowerCase())) return overrideID;
    }
    let input = lesson.youtube_video_id || lesson.youtube_url || "";
    input = input.trim();
    if (!input) return null;
    if (input.length === 11 && !input.includes('/') && !input.includes('?')) return input;
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = input.match(regExp);
    return (match && match[7].length === 11) ? match[7] : input;
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }
    state.user = session.user;

    initSidebarProgress();
    await loadFormationPage();
    setupEventListeners();
});

async function loadFormationPage() {
    try {
        const success = await loadData();
        if (success) {
            await loadProgress();
            renderUI();
            updateGlobalProgress();
        } else {
            if (el.chaptersContainer) el.chaptersContainer.innerHTML = '<p class="text-muted">Aucune formation active.</p>';
        }
    } catch (err) { console.error("❌ Erreur chargement:", err); }
}

async function loadData() {
    const { data: f } = await supabase.from('formations').select('id, title, description').eq('is_published', true).limit(1).single();
    if (!f) return false;
    state.formation = f;

    const { data: c } = await supabase.from('chapters').select('id, title, position').eq('formation_id', f.id).order('position', { ascending: true });
    state.chapters = c || [];

    const { data: l } = await supabase.from('lessons')
        .select('id, chapter_id, title, description, youtube_video_id, youtube_url, position, is_published')
        .in('chapter_id', state.chapters.map(chap => chap.id))
        .eq('is_published', true)
        .order('position', { ascending: true });
    state.lessons = l || [];

    state.allLessonsSorted = [];
    state.chapters.forEach(chap => {
        const chapLessons = state.lessons.filter(less => less.chapter_id === chap.id).sort((a,b) => a.position - b.position);
        state.allLessonsSorted.push(...chapLessons);
    });
    return true;
}

async function loadProgress() {
    const { data } = await supabase.from('user_lesson_progress').select('*').eq('user_id', state.user.id);
    state.progress = {};
    if (data) data.forEach(p => state.progress[p.lesson_id] = p);
}

// --- Rendering ---
function renderUI() {
    if (!state.formation) return;
    if (el.formationTitle) el.formationTitle.textContent = state.formation.title;
    if (el.formationDescription) el.formationDescription.textContent = state.formation.description;
    if (el.chaptersContainer) {
        el.chaptersContainer.innerHTML = '';
        state.chapters.forEach(chap => {
            const chapLessons = state.lessons.filter(l => l.chapter_id === chap.id);
            if (chapLessons.length === 0) return;
            const group = document.createElement('div');
            group.className = 'chapter-group';
            group.innerHTML = `<div class="chapter-header"><span>${chap.title}</span></div><div class="lessons-list" id="list-${chap.id}"></div>`;
            el.chaptersContainer.appendChild(group);
            const list = document.getElementById(`list-${chap.id}`);
            chapLessons.forEach(less => { list.appendChild(renderLessonItem(less)); });
        });
    }
}

function renderLessonItem(lesson) {
    const progress = state.progress[lesson.id];
    const isComp = progress?.completed === true;
    const isActive = state.currentLesson?.id === lesson.id;
    const div = document.createElement('div');
    div.className = `lesson-item ${isComp ? 'completed' : ''} ${isActive ? 'active' : ''}`;
    const icon = isComp ? 'fa-circle-check' : 'fa-play';
    div.innerHTML = `<div class="lesson-icon"><i class="fa-solid ${icon}"></i></div><div class="lesson-content"><span class="lesson-title">${lesson.title}</span></div>${isComp ? '<span class="lesson-badge badge-completed">Fini</span>' : (progress ? '<span class="lesson-badge badge-in-progress">En cours</span>' : '')}`;
    div.onclick = () => playLesson(lesson);
    return div;
}

async function playLesson(lesson) {
    const cleanID = getTargetYouTubeID(lesson);
    if (!cleanID) return alert("ID YouTube manquant.");
    state.currentLesson = lesson;
    renderUI(); 
    const embedUrl = `https://www.youtube.com/embed/${cleanID}?autoplay=1&rel=0&modestbranding=1`;
    if (el.videoPlaceholder) el.videoPlaceholder.style.display = 'none';
    if (el.playerContainer) {
        el.playerContainer.style.display = 'block';
        el.playerContainer.innerHTML = `<iframe width="100%" height="100%" src="${embedUrl}" frameborder="0" style="width:100%; height:100%; border:0; display:block; border-radius:12px; background:#000;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    }
    if (el.currentLessonTitle) el.currentLessonTitle.textContent = lesson.title;
    if (el.currentLessonDescription) el.currentLessonDescription.textContent = lesson.description || 'Apprentissage via YouTube.';
    const progress = state.progress[lesson.id];
    updateStatusBadge(progress);
    if (el.completionZone) el.completionZone.style.display = (progress && progress.completed) ? 'none' : 'block';
    if (!progress) await saveLessonProgress(0, false);
}

function updateStatusBadge(progress) {
    if (!el.lessonStatusBadge) return;
    if (progress?.completed) { el.lessonStatusBadge.textContent = 'Terminé'; el.lessonStatusBadge.className = 'badge badge-completed'; }
    else if (progress) { el.lessonStatusBadge.textContent = 'En cours'; el.lessonStatusBadge.className = 'badge badge-in-progress'; }
    else { el.lessonStatusBadge.textContent = 'Prêt'; el.lessonStatusBadge.className = 'badge'; }
}

async function saveLessonProgress(percent, completed = false) {
    const upsertData = { user_id: state.user.id, lesson_id: state.currentLesson.id, progress_percent: Math.round(percent), last_watched_at: new Date().toISOString() };
    if (completed) { upsertData.completed = true; upsertData.completed_at = new Date().toISOString(); upsertData.progress_percent = 100; }
    const { data } = await supabase.from('user_lesson_progress').upsert(upsertData, { onConflict: 'user_id,lesson_id' }).select().single();
    if (data) { state.progress[state.currentLesson.id] = data; updateGlobalProgress(); renderUI(); }
}

function updateGlobalProgress() {
    const total = state.allLessonsSorted.length;
    if (total === 0) return;
    const done = state.allLessonsSorted.filter(lesson => state.progress[lesson.id]?.completed).length;
    const pct = Math.round((done / total) * 100);
    const elPct = document.getElementById('progress-text');
    const elCount = document.getElementById('progress-count');
    const elBar = document.getElementById('global-progress-bar');
    if (elPct) elPct.textContent = `${pct}% complété`;
    if (elCount) elCount.textContent = `${done}/${total} vidéos`;
    if (elBar) elBar.style.width = `${pct}%`;
    const sPct = document.getElementById('sidebar-progress-percent');
    const sCount = document.getElementById('sidebar-progress-count');
    const sBar = document.getElementById('sidebar-progress-bar');
    if (sPct) sPct.textContent = `${pct}%`;
    if (sCount) sCount.textContent = `${done}/${total}`;
    if (sBar) sBar.style.width = `${pct}%`;
}

function setupEventListeners() {
    if (el.btnComplete) el.btnComplete.onclick = async () => { if (state.currentLesson) { await saveLessonProgress(100, true); if (el.completionZone) el.completionZone.style.display = 'none'; } };
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.onclick = () => { if (confirm('Déconnexion ?')) supabase.auth.signOut().then(() => window.location.href = 'login.html'); };
}
