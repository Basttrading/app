import { supabase } from '../supabase.js';
import { adminState } from './state.js';
import { showToast } from '../common.js';

/**
 * EXPOSITION DES FONCTIONS GLOBALES POUR LE DOM
 */
window.selectFormation = (id) => selectFormation(id);
window.deleteFormation = (id) => deleteFormation(id);
window.selectChapter = (id, title) => selectChapter(id, title);
window.deleteChapter = (id) => deleteChapter(id);
window.deleteLesson = (id) => deleteLesson(id);
window.handleYoutubeChange = (id, url) => handleYoutubeChange(id, url);
window.updateLesson = (id, data) => updateLesson(id, data);

export async function renderContentManager(container) {
    console.log("🛠️ Initialisation de la Gestion Formation...");
    container.innerHTML = `
        <header class="admin-table-header">
            <div>
                <h1 style="font-size: 32px; margin-bottom: 8px;">Gestion Formation</h1>
                <p style="color: var(--text-muted);">Organisez vos contenus pédagogiques : formations, chapitres et leçons.</p>
            </div>
        </header>

        <div class="content-grid-v2" style="display: grid; grid-template-columns: 250px 250px 1fr; gap: 20px; align-items: start;">
            <!-- 1. FORMATIONS -->
            <aside class="card" style="padding: 15px;">
                <h3 class="card-title" style="font-size: 14px; display: flex; justify-content: space-between; align-items: center;">
                    Formations
                    <button class="btn-icon-admin primary" id="btn-add-formation-final" title="Ajouter une formation"><i class="fa-solid fa-plus"></i></button>
                </h3>
                <div id="formations-list-admin" class="admin-list-sidebar">
                    <div class="loader-admin" style="margin: 20px auto; display: block; width: 20px; height: 20px;"></div>
                </div>
            </aside>

            <!-- 2. CHAPITRES -->
            <aside class="card" style="padding: 15px;">
                <h3 class="card-title" style="font-size: 14px; display: flex; justify-content: space-between; align-items: center;">
                    Chapitres
                    <button class="btn-icon-admin primary" id="btn-add-chapter-final" style="display: none;" title="Ajouter un chapitre"><i class="fa-solid fa-plus"></i></button>
                </h3>
                <div id="chapters-list-admin" class="admin-list-sidebar">
                    <p style="font-size: 11px; color: var(--text-muted); text-align: center; padding: 20px;">Sélectionnez une formation</p>
                </div>
            </aside>

            <!-- 3. LEÇONS -->
            <main class="card" style="padding: 20px;">
                <div id="lessons-container-admin">
                    <div style="text-align: center; color: var(--text-muted); padding: 60px;">
                        <i class="fa-solid fa-clapperboard" style="font-size: 48px; margin-bottom: 20px; opacity: 0.1;"></i>
                        <p>Sélectionnez un chapitre pour gérer les vidéos.</p>
                    </div>
                </div>
            </main>
        </div>
    `;

    // Attachement des événements
    document.getElementById('btn-add-formation-final').onclick = () => {
        const title = prompt("Nom de la formation :");
        if (title) createFormation(title);
    };

    document.getElementById('btn-add-chapter-final').onclick = () => {
        const title = prompt("Nom du chapitre :");
        if (title) createChapter(title);
    };

    loadFormations();
}

/**
 * LOGIQUE FORMATIONS
 */
async function loadFormations() {
    const list = document.getElementById('formations-list-admin');
    if (!list) return;

    const { data: formations, error } = await supabase
        .from('formations')
        .select('*')
        .order('position', { ascending: true });

    if (error) {
        console.error("❌ Erreur chargement formations:", error);
        list.innerHTML = `<p style="color:var(--error-color); font-size:10px;">${error.message}</p>`;
        return;
    }

    list.innerHTML = formations.length === 0 ? '<p style="font-size: 11px; color: var(--text-muted); text-align: center;">Aucune formation</p>' : formations.map(f => `
        <div class="admin-list-item ${adminState.currentFormationId === f.id ? 'active' : ''}" onclick="window.selectFormation('${f.id}')">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${f.title}</span>
            <button class="btn-icon-admin danger" onclick="event.stopPropagation(); window.deleteFormation('${f.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
    `).join('');
}

async function createFormation(title) {
    console.log("🚀 Création formation:", title);
    const { data, error } = await supabase.from('formations').insert({
        title,
        coach_id: adminState.user.id,
        is_published: true,
        position: 99
    }).select();

    if (error) {
        console.error("❌ Échec création formation:", error);
        alert("Erreur Supabase: " + error.message);
    } else {
        showToast("Formation créée", "success");
        loadFormations();
    }
}

async function selectFormation(id) {
    console.log("🎯 Formation choisie:", id);
    adminState.currentFormationId = id;
    adminState.currentChapterId = null;
    document.getElementById('btn-add-chapter-final').style.display = 'block';
    loadFormations(); // Pour mettre à jour l'état visuel actif
    loadChapters(id);
}

/**
 * LOGIQUE CHAPITRES
 */
async function loadChapters(formationId) {
    const list = document.getElementById('chapters-list-admin');
    if (!list) return;

    const { data: chapters, error } = await supabase
        .from('chapters')
        .select('*')
        .eq('formation_id', formationId)
        .order('position', { ascending: true });

    if (error) {
        console.error("❌ Erreur chargement chapitres:", error);
        return;
    }

    list.innerHTML = chapters.length === 0 ? '<p style="font-size: 11px; color: var(--text-muted); text-align: center;">Aucun chapitre</p>' : chapters.map(c => `
        <div class="admin-list-item ${adminState.currentChapterId === c.id ? 'active' : ''}" onclick="window.selectChapter('${c.id}', '${c.title.replace(/'/g, "\\'")}')">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.title}</span>
            <button class="btn-icon-admin danger" onclick="event.stopPropagation(); window.deleteChapter('${c.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
    `).join('');
}

async function createChapter(title) {
    console.log("🚀 Création chapitre:", title);
    const { data, error } = await supabase.from('chapters').insert({
        title,
        formation_id: adminState.currentFormationId,
        position: 99
    }).select();

    if (error) {
        console.error("❌ Échec création chapitre:", error);
        alert("Erreur Supabase: " + error.message);
    } else {
        showToast("Chapitre créé", "success");
        loadChapters(adminState.currentFormationId);
    }
}

async function selectChapter(id, title) {
    console.log("🎯 Chapitre choisi:", id);
    adminState.currentChapterId = id;
    loadChapters(adminState.currentFormationId);
    renderLessonsManager(id, title);
}

/**
 * LOGIQUE LEÇONS
 */
async function renderLessonsManager(chapterId, chapterTitle) {
    const container = document.getElementById('lessons-container-admin');
    const { data: lessons, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('chapter_id', chapterId)
        .order('position', { ascending: true });

    if (error) {
        console.error("❌ Erreur chargement leçons:", error);
        return;
    }

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 15px;">
            <h2 style="font-size: 18px; color: var(--primary-color);">${chapterTitle}</h2>
            <button class="btn btn-primary btn-sm" id="btn-add-lesson-final"><i class="fa-solid fa-plus"></i> Ajouter une vidéo</button>
        </div>

        <div id="lessons-list-rows" style="display: flex; flex-direction: column; gap: 12px;">
            ${lessons.length === 0 ? '<p style="text-align: center; color: var(--text-muted); padding: 40px;">Aucune vidéo dans ce chapitre.</p>' : lessons.map(l => `
                <div class="lesson-admin-card" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 12px; padding: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <input type="text" value="${l.title}" class="form-input inline-edit" style="font-weight: 700; font-size: 15px; width: 70%; border:none; background:transparent;" onchange="window.updateLesson('${l.id}', {title: this.value})">
                        <button class="btn-icon-admin danger" onclick="window.deleteLesson('${l.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    <div style="display: grid; grid-template-columns: 2fr 1fr 80px 80px; gap: 15px; align-items: end;">
                        <div class="form-group" style="margin:0">
                            <label class="form-label" style="font-size: 10px;">LIEN YOUTUBE</label>
                            <input type="text" value="${l.youtube_url || ''}" class="form-input" placeholder="https://..." onchange="window.handleYoutubeChange('${l.id}', this.value)">
                        </div>
                        <div class="form-group" style="margin:0">
                            <label class="form-label" style="font-size: 10px;">ID VIDÉO</label>
                            <input type="text" value="${l.youtube_video_id || ''}" class="form-input" style="opacity:0.5;" readonly>
                        </div>
                        <div class="form-group" style="margin:0">
                            <label class="form-label" style="font-size: 10px;">POSITION</label>
                            <input type="number" value="${l.position}" class="form-input" onchange="window.updateLesson('${l.id}', {position: parseInt(this.value)})">
                        </div>
                        <div class="form-group" style="margin:0; text-align:center;">
                            <label class="form-label" style="font-size: 10px;">PUBLIÉ</label>
                            <input type="checkbox" ${l.is_published ? 'checked' : ''} onchange="window.updateLesson('${l.id}', {is_published: this.checked})" style="width:18px; height:18px;">
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    document.getElementById('btn-add-lesson-final').onclick = () => {
        const t = prompt("Titre de la leçon :");
        if (t) createLesson(t, chapterId, chapterTitle);
    };
}

async function createLesson(title, chapterId, chapterTitle) {
    const { error } = await supabase.from('lessons').insert({
        title,
        chapter_id: chapterId,
        position: 99,
        is_published: true
    }).select();

    if (error) alert(error.message);
    else {
        showToast("Leçon ajoutée", "success");
        renderLessonsManager(chapterId, chapterTitle);
    }
}

/**
 * UTILS & SUPPRESSIONS
 */
async function updateLesson(id, data) {
    const { error } = await supabase.from('lessons').update(data).eq('id', id);
    if (error) showToast(error.message, "error");
    else showToast("Enregistré", "success");
}

async function handleYoutubeChange(lessonId, url) {
    const videoId = extractYoutubeId(url);
    await updateLesson(lessonId, { youtube_url: url, youtube_video_id: videoId });
    renderLessonsManager(adminState.currentChapterId, "Chapitre");
}

function extractYoutubeId(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

async function deleteFormation(id) {
    if (confirm("Supprimer la formation et son contenu ?")) {
        await supabase.from('formations').delete().eq('id', id);
        loadFormations();
    }
}

async function deleteChapter(id) {
    if (confirm("Supprimer ce chapitre ?")) {
        await supabase.from('chapters').delete().eq('id', id);
        loadChapters(adminState.currentFormationId);
    }
}

async function deleteLesson(id) {
    if (confirm("Supprimer cette vidéo ?")) {
        await supabase.from('lessons').delete().eq('id', id);
        renderLessonsManager(adminState.currentChapterId, "Chapitre");
    }
}
