import { supabase } from './supabase.js';
import { checkAuth, signOut, getProfile } from './auth.js';

console.log("🚀 Profile Script V3 Loaded - Defensive Mode");

/**
 * Fonctions globales sécurisées
 */
window.triggerEdit = async (field, label) => {
    console.log("✏️ Editing field:", field);
    const elementId = field === 'nom_discord' ? 'display-discord' : `display-${field}`;
    const el = document.getElementById(elementId);
    
    if (!el) {
        console.error("❌ Element not found:", elementId);
        return;
    }

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
    console.log(`💾 Saving ${field} = "${value}" for user ${userId}`);

    try {
        const updateData = { id: userId, updated_at: new Date() };
        updateData[field] = value;

        const { error } = await supabase
            .from('profiles')
            .upsert(updateData);

        if (error) throw error;

        console.log("✅ Saved successfully");

        // Mise à jour de l'affichage sécurisée
        const elementId = field === 'nom_discord' ? 'display-discord' : `display-${field}`;
        const el = document.getElementById(elementId);
        if (el) {
            el.innerText = value || "à compléter";
            if (!value) el.classList.add('empty-text');
            else el.classList.remove('empty-text');
        }

        // Mise à jour des cartes du haut sécurisée
        const cardId = field === 'nom' ? 'profile-nom' : (field === 'prenom' ? 'profile-prenom' : 'profile-discord');
        const cardEl = document.getElementById(cardId);
        if (cardEl) cardEl.innerText = value || '-';

    } catch (err) {
        console.error("❌ Save error:", err.message);
        alert("Erreur lors de l'enregistrement. Vérifiez votre connexion.");
    }
};

/**
 * Chargement initial
 */
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Session check
    const session = await checkAuth();
    if (!session) return;

    const userId = session.user.id;
    const email = session.user.email;

    // 2. Affichage email (avec vérification)
    const emailDisplay = document.getElementById('display-email');
    if (emailDisplay) {
        emailDisplay.innerText = email;
    }

    // 3. Chargement données Supabase
    try {
        const { data: profile, error } = await getProfile(userId);
        if (error) throw error;

        if (profile) {
            console.log("📥 Profile data loaded:", profile);
            
            const updateUI = (field, val) => {
                const elementId = field === 'nom_discord' ? 'display-discord' : `display-${field}`;
                const el = document.getElementById(elementId);
                if (el) {
                    el.innerText = val || "à compléter";
                    if (!val) el.classList.add('empty-text');
                    else el.classList.remove('empty-text');
                }
                
                const cardId = field === 'nom' ? 'profile-nom' : (field === 'prenom' ? 'profile-prenom' : 'profile-discord');
                const cardEl = document.getElementById(cardId);
                if (cardEl) cardEl.innerText = val || '-';
            };

            updateUI('nom', profile.nom);
            updateUI('prenom', profile.prenom);
            updateUI('nom_discord', profile.nom_discord);
        }
    } catch (err) {
        console.warn("⚠️ Profile warning:", err.message);
    }

    // 4. Logout event
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            if (confirm('Déconnexion ?')) await signOut();
        };
    }
});
