import { supabase } from './supabase.js';

/**
 * INITIALISATION COMMUNE DE LA SIDEBAR
 * Cette fonction charge la progression de la formation et met à jour la mini-barre de la sidebar sur toutes les pages.
 */
export async function initSidebarProgress() {
    // Initialisation immédiate des éléments DOM si possible
    const elPct = document.getElementById('sidebar-progress-percent');
    const elCount = document.getElementById('sidebar-progress-count');
    const elBar = document.getElementById('sidebar-progress-bar');

    const sessionRes = await supabase.auth.getSession();
    const user = sessionRes.data?.session?.user;
    if (!user) return;

    try {
        // ... (rest of the logic remains same, but we ensure it's called as early as possible)
        const { data: formation } = await supabase
            .from('formations')
            .select('id')
            .eq('is_published', true)
            .limit(1)
            .single();

        if (!formation) return;

        const { data: chapters } = await supabase
            .from('chapters')
            .select('id')
            .eq('formation_id', formation.id);
        
        if (!chapters || chapters.length === 0) return;

        const chapterIds = chapters.map(c => c.id);
        const { data: lessons } = await supabase
            .from('lessons')
            .select('id')
            .in('chapter_id', chapterIds)
            .eq('is_published', true);

        if (!lessons || lessons.length === 0) return;

        const { data: progress } = await supabase
            .from('user_lesson_progress')
            .select('lesson_id, completed')
            .eq('user_id', user.id);

        const total = lessons.length;
        const done = lessons.filter(l => {
            const p = progress?.find(pr => pr.lesson_id === l.id);
            return p && (p.completed === true || p.completed === "true");
        }).length;

        const pct = Math.round((done / total) * 100);

        if (elPct) elPct.textContent = `${pct}%`;
        if (elCount) elCount.textContent = `${done}/${total}`;
        if (elBar) elBar.style.width = `${pct}%`;

    } catch (err) {
        console.warn("Sidebar Progress Sync:", err.message);
    }
}

/**
 * SYSTÈME DE NOTIFICATIONS (TOASTS) PREMIUM
 */
export function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            top: 24px;
            right: 24px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 12px;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const colors = {
        success: { bg: 'rgba(38, 166, 154, 0.95)', icon: 'fa-circle-check' },
        error: { bg: 'rgba(239, 83, 80, 0.95)', icon: 'fa-circle-exclamation' },
        info: { bg: 'rgba(0, 114, 185, 0.95)', icon: 'fa-circle-info' }
    };
    const style = colors[type] || colors.info;

    toast.style.cssText = `
        background: ${style.bg};
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        font-weight: 700;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 12px;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.1);
        transform: translateX(120%);
        transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        pointer-events: auto;
    `;

    toast.innerHTML = `<i class="fa-solid ${style.icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    // Animation entrée
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
    });

    // Suppression automatique
    setTimeout(() => {
        toast.style.transform = 'translateX(120%)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

