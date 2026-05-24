import { supabase } from '../supabase.js';
import { adminState, loadView } from './main.js';
import { renderStudentDetail } from './student-detail.js';
import { showToast } from '../common.js';

window.deleteStudent = async (id) => {
    if (confirm("Supprimer cet élève définitivement ? Ses trades seront également supprimés.")) {
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) alert(error.message);
        else { showToast("Élève supprimé", "success"); loadView('students'); }
    }
};

export async function renderStudentsList(container) {
    console.log("👥 [DEBUG] Tentative de chargement de la liste des élèves...");
    console.log("👤 Mon Profil actuel:", adminState.profile);

    // 1. Requête pour les élèves (on prend tout ce qui n'est pas admin/coach pour être large)
    let query = supabase.from('profiles').select('*').not('role', 'in', '("admin","coach")');
    
    // Si je suis coach, je ne vois que les miens. Si je suis admin, je vois tout.
    if (adminState.profile.role === 'coach') {
        console.log("🧐 Filtrage par Coach ID:", adminState.profile.id);
        query = query.eq('coach_id', adminState.profile.id);
    }

    const { data: students, error } = await query;

    if (error) {
        console.error("❌ [DEBUG] Erreur Supabase (Profiles):", error);
        container.innerHTML = `<div class="alert alert-error">Erreur: ${error.message}</div>`;
        return;
    }

    console.log("✅ [DEBUG] Élèves trouvés dans la DB:", students.length, students);

    // 2. Récupération du total de leçons pour le calcul de progression
    const { count: totalLessons } = await supabase.from('lessons').select('*', { count: 'exact', head: true }).eq('is_published', true);

    // 3. Enrichissement des données (Trades et Progression)
    const studentsWithData = await Promise.all(students.map(async (s) => {
        try {
            const { count: tradeCount } = await supabase.from('trades').select('*', { count: 'exact', head: true }).eq('user_id', s.id);
            const { count: progCount } = await supabase.from('user_lesson_progress').select('*', { count: 'exact', head: true }).eq('user_id', s.id).eq('completed', true);
            return { ...s, tradeCount: tradeCount || 0, progCount: progCount || 0 };
        } catch (err) {
            console.warn("⚠️ Erreur calcul data pour élève:", s.email, err);
            return { ...s, tradeCount: 0, progCount: 0 };
        }
    }));

    // 4. Rendu HTML
    container.innerHTML = `
        <header class="admin-table-header">
            <div>
                <h1 style="font-size: 32px; margin-bottom: 8px;">Mes Élèves</h1>
                <p style="color: var(--text-muted);">Liste complète des membres de votre communauté.</p>
            </div>
            <button class="btn btn-primary" id="btn-show-create-form"><i class="fa-solid fa-user-plus"></i> Ajouter un élève</button>
        </header>

        <!-- Section de création (cachée par défaut) -->
        <div id="create-student-section" class="card" style="display:none; margin-bottom:30px; border:1px solid var(--primary-color);">
            <h3 class="card-title">Nouvel Élève</h3>
            <form id="form-create-student">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px;">
                    <input type="text" id="new-student-prenom" class="form-input" placeholder="Prénom" required>
                    <input type="text" id="new-student-nom" class="form-input" placeholder="Nom" required>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px;">
                    <input type="email" id="new-student-email" class="form-input" placeholder="Email" required>
                    <input type="text" id="new-student-password" class="form-input" placeholder="Mot de passe" required>
                </div>
                <div style="display:flex; gap:10px; justify-content:flex-end;">
                    <button type="button" class="btn btn-outline" onclick="document.getElementById('create-student-section').style.display='none'">Annuler</button>
                    <button type="submit" class="btn btn-primary" id="btn-submit-student">Créer l'accès</button>
                </div>
            </form>
        </div>

        <section class="card" style="padding: 0; overflow: hidden;">
            <div class="table-container" style="border: none; border-radius: 0;">
                <table>
                    <thead>
                        <tr>
                            <th>Élève</th>
                            <th>Date d'ajout</th>
                            <th>Trades</th>
                            <th>Progression</th>
                            <th style="text-align: center;">Détails</th>
                        </tr>
                    </thead>
                    <tbody id="students-table-body">
                        ${studentsWithData.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--text-muted);">Aucun élève trouvé dans votre base.</td></tr>' : studentsWithData.map(s => {
                            const progressPct = totalLessons > 0 ? Math.round((s.progCount / totalLessons) * 100) : 0;
                            return `
                                <tr onclick="window.viewStudent('${s.id}')" style="cursor: pointer;">
                                    <td>
                                        <div style="display: flex; align-items: center; gap: 12px;">
                                            <div class="user-avatar-sm" style="background: var(--border-color);">${(s.prenom?.[0] || s.email[0]).toUpperCase()}</div>
                                            <div>
                                                <div style="font-weight: 700;">${s.prenom || ''} ${s.nom || ''}</div>
                                                <div style="font-size: 11px; color: var(--text-muted);">${s.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style="color: var(--text-muted); font-size: 13px;">${new Date(s.created_at).toLocaleDateString('fr-FR')}</td>
                                    <td style="font-weight: 700;">${s.tradeCount} trades</td>
                                    <td>
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <div class="progress-bar-mini" style="flex: 1; height:6px; background:#1a1e26; border-radius:3px;">
                                                <div class="progress-fill" style="width: ${progressPct}%; height:100%; background:var(--primary-color); border-radius:3px;"></div>
                                            </div>
                                            <span style="font-size: 11px; font-weight: 800;">${progressPct}%</span>
                                        </div>
                                    </td>
                                    <td style="text-align: center;">
                                        <div style="display: flex; gap: 8px; justify-content: center;">
                                            <button class="btn-icon-admin"><i class="fa-solid fa-chevron-right"></i></button>
                                            <button class="btn-icon-admin danger" onclick="event.stopPropagation(); window.deleteStudent('${s.id}')"><i class="fa-solid fa-trash"></i></button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;

    // Interactivité
    document.getElementById('btn-show-create-form').onclick = () => {
        document.getElementById('create-student-section').style.display = 'block';
    };

    document.getElementById('form-create-student').onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-submit-student');
        const prenom = document.getElementById('new-student-prenom').value;
        const nom = document.getElementById('new-student-nom').value;
        const email = document.getElementById('new-student-email').value;
        const password = document.getElementById('new-student-password').value;

        btn.disabled = true;
        btn.innerText = "Création...";

        try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email, password, options: { data: { prenom, nom, role: 'student' } }
            });
            if (authError) throw authError;

            // Utilisation de upsert pour être sûr de créer/mettre à jour le profil avec le bon coach_id
            const { error: profError } = await supabase.from('profiles').upsert({
                id: authData.user.id,
                email,
                prenom, 
                nom, 
                coach_id: adminState.profile.id, 
                role: 'student'
            });
            
            if (profError) throw profError;

            showToast("Élève créé avec succès", "success");
            renderStudentsList(container);
        } catch (err) {
            alert("Erreur lors de la création: " + err.message);
        } finally {
            btn.disabled = false;
            btn.innerText = "Créer l'accès";
        }
    };

    window.viewStudent = (id) => renderStudentDetail(container, id);
}
