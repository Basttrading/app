import { supabase } from '../supabase.js';
import { checkAuth, signOut } from '../auth.js';
import { adminState } from './state.js';
import { renderDashboard } from './dashboard.js';
import { renderStudentsList } from './students.js';
import { renderContentManager } from './content.js';

export { adminState };

/**
 * INITIALIZATION
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 [v2.2] Initialisation Admin Portal...");
    import('../common.js').then(m => m.showToast("Portail Bast Prêt", "success"));
    
    // 1. Auth Check
    const session = await checkAuth();
    if (!session) {
        console.warn("⚠️ Pas de session trouvée, redirection login...");
        return;
    }
    adminState.user = session.user;
    console.log("👤 Utilisateur connecté:", session.user.id);

    // 2. Role Check
    const OWNER_ID = '30e08842-7731-4346-a438-5d5d406d07bb';
    let { data: profile, error } = await supabase.from('profiles').select('*').eq('id', adminState.user.id).single();
    
    console.log("👤 Profil DB chargé:", profile);

    // Bypass pour le propriétaire
    if (adminState.user.id === OWNER_ID) {
        console.log("👑 Propriétaire détecté.");
        if (!profile) {
            profile = { id: OWNER_ID, email: adminState.user.email, role: 'admin', prenom: 'Admin' };
        } else {
            profile.role = 'admin'; 
        }
    }

    if (!profile || (profile.role !== 'admin' && profile.role !== 'coach')) {
        console.error("🚫 Accès refusé pour rôle:", profile?.role);
        window.location.href = 'dashboard.html';
        return;
    }
    
    adminState.profile = profile;
    window.loadView = loadView; 

    // UI Updates
    const coachNameEl = document.getElementById('coach-name');
    if (coachNameEl) coachNameEl.textContent = "Bastien";

    // 3. Setup Navigation
    setupNavigation();
    
    // 4. Initial Load
    loadView('dashboard');

    // Logout
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.onclick = () => signOut();
});

function setupNavigation() {
    const links = document.querySelectorAll('.admin-sidebar .nav-link[data-view]');
    links.forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            const view = link.getAttribute('data-view');
            loadView(view);
        };
    });
}

export async function loadView(view, params = {}) {
    console.log("切换视图 ->", view);
    adminState.view = view;
    
    document.querySelectorAll('.admin-sidebar .nav-link').forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector(`.admin-sidebar .nav-link[data-view="${view}"]`);
    if (activeLink) activeLink.classList.add('active');

    const area = document.getElementById('admin-content-area');
    if (!area) return;
    area.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 50vh;"><div class="loader-admin"></div></div>';

    try {
        switch(view) {
            case 'dashboard':
                await renderDashboard(area);
                break;
            case 'students':
                await renderStudentsList(area);
                break;
            case 'content':
                await renderContentManager(area);
                break;
            case 'profile':
                area.innerHTML = `
                    <header class="admin-table-header">
                        <div>
                            <h1 style="font-size: 32px; margin-bottom: 8px;">Mon Profil</h1>
                            <p style="color: var(--text-muted);">Gérez votre sécurité et vos accès.</p>
                        </div>
                    </header>
                    <div class="card" style="max-width: 500px; padding: 30px;">
                        <h3 class="card-title" style="margin-bottom: 20px;">Changer mon mot de passe</h3>
                        
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label class="form-label" style="font-size: 11px; margin-bottom: 8px; color: var(--text-muted);">NOUVEAU MOT DE PASSE</label>
                            <input type="password" id="new-password" class="form-input" placeholder="6 caractères minimum" style="background: #080a0f;">
                        </div>

                        <div class="form-group" style="margin-bottom: 25px;">
                            <label class="form-label" style="font-size: 11px; margin-bottom: 8px; color: var(--text-muted);">CONFIRMER LE MOT DE PASSE</label>
                            <input type="password" id="confirm-password" class="form-input" placeholder="Répétez le mot de passe" style="background: #080a0f;">
                        </div>

                        <button class="btn btn-primary" id="btn-update-password" style="width: 100%;">METTRE À JOUR LE MOT DE PASSE</button>
                    </div>
                `;

                document.getElementById('btn-update-password').onclick = async () => {
                    const pwd = document.getElementById('new-password').value;
                    const confirmPwd = document.getElementById('confirm-password').value;
                    const btn = document.getElementById('btn-update-password');

                    if (pwd.length < 6) {
                        return alert("Le mot de passe doit contenir au moins 6 caractères.");
                    }

                    if (pwd !== confirmPwd) {
                        return alert("Les mots de passe ne correspondent pas.");
                    }

                    try {
                        btn.disabled = true;
                        btn.innerText = "MISE À JOUR...";
                        
                        const { error } = await supabase.auth.updateUser({ password: pwd });
                        
                        if (error) throw error;

                        alert("Mot de passe mis à jour avec succès !");
                        document.getElementById('new-password').value = '';
                        document.getElementById('confirm-password').value = '';
                    } catch (err) {
                        alert("Erreur : " + err.message);
                    } finally {
                        btn.disabled = false;
                        btn.innerText = "METTRE À JOUR LE MOT DE PASSE";
                    }
                };
                break;
            default:
                area.innerHTML = `<h1>Vue ${view} non trouvée</h1>`;
        }
    } catch (err) {
        console.error("❌ Erreur lors du chargement de la vue:", err);
        area.innerHTML = `<div class="alert alert-error">Erreur: ${err.message}</div>`;
    }
}
