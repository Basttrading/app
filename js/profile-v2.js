import { supabase } from './supabase.js';
import { checkAuth, signOut, getProfile } from './auth.js';
import { initSidebarProgress, showToast } from './common.js';

/**
 * INITIALISATION
 */
document.addEventListener('DOMContentLoaded', async () => {
    const session = await checkAuth();
    if (!session) return;

    const currentUserId = session.user.id;
    const email = session.user.email;
    
    // Sidebar progress visible partout
    initSidebarProgress();

    // 1. Affichage email
    const emailDisplay = document.getElementById('display-email');
    if (emailDisplay) emailDisplay.innerText = email;

    // 2. Chargement données Supabase
    try {
        const { data: profile, error } = await getProfile(currentUserId);
        if (error) throw error;

        if (profile) {
            updateUI('nom', profile.nom);
            updateUI('prenom', profile.prenom);
            updateUI('nom_discord', profile.nom_discord);
        }
    } catch (err) {
        console.warn("⚠️ Profile warning:", err.message);
    }

    // 3. Header display
    const userDisplayName = document.getElementById('user-display-name');
    if (userDisplayName) {
        const { data: profile } = await getProfile(currentUserId);
        userDisplayName.innerText = profile?.prenom ? `${profile.prenom} ${profile.nom || ''}`.trim() : email;
    }

    // Logout
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.onclick = async () => { await signOut(); };
});

/**
 * Fonctions de mise à jour UI
 */
function updateUI(field, val) {
    const elementId = field === 'nom_discord' ? 'display-discord' : `display-${field}`;
    const el = document.getElementById(elementId);
    if (el) {
        el.innerText = val || "à compléter";
        if (!val) el.classList.add('empty-text');
        else el.classList.remove('empty-text');
    }
}

/**
 * Fonctions globales pour les boutons onclick
 */
window.triggerEdit = async (field, label) => {
    const elementId = `display-${field}`;
    const el = document.getElementById(elementId);
    if (!el) return;

    const currentValue = el.innerText;
    const initialValue = (currentValue === "à compléter" || currentValue === "Chargement...") ? "" : currentValue;

    const newValue = prompt(`Modifier ${label} :`, initialValue);

    if (newValue !== null) {
        const trimmedValue = newValue.trim();
        if (trimmedValue !== initialValue) {
            await window.saveProfileField(field, trimmedValue);
        }
    }
};

window.saveProfileField = async (field, value) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const userId = session.user.id;

    try {
        const updateData = { id: userId, last_active_at: new Date() };
        updateData[field] = value;

        const { error } = await supabase
            .from('profiles')
            .upsert(updateData);

        if (error) throw error;

        // Mise à jour de l'affichage
        updateUI(field, value);
        showToast("Profil mis à jour", 'success');
    } catch (err) {
        console.error("Erreur mise à jour:", err);
        alert("Enregistrement impossible");
    }
};

window.updatePassword = async () => {
    const newPassword = prompt("Entrez votre nouveau mot de passe (min 6 caractères) :");
    if (!newPassword) return;
    if (newPassword.length < 6) return showToast("Le mot de passe doit faire au moins 6 caractères.", 'error');

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
        showToast("Erreur : " + error.message, 'error');
    } else {
        showToast("Mot de passe mis à jour ! Redirection...", 'success');
        setTimeout(async () => {
            await signOut();
        }, 1500);
    }
};
