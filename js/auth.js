import { supabase } from './supabase.js';

/**
 * Helper to check if user is authenticated and redirect if not.
 * Redirects to the appropriate portal based on role.
 */
export async function checkAuth() {
    const { data: { session }, error } = await supabase.auth.getSession();
    const isLoginPage = window.location.pathname.includes('login.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/');

    if (session) {
        // Fetch profile to check role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        const role = profile?.role || 'student';
        const targetPage = (role === 'admin' || role === 'coach') ? 'admin.html' : 'dashboard.html';

        if (isLoginPage) {
            window.location.href = targetPage;
        }
    } else if (!isLoginPage) {
        window.location.href = 'login.html';
    }

    return session;
}

/**
 * Sign in a user with email and password.
 */
export async function signIn(email, password) {
    return await supabase.auth.signInWithPassword({ email, password });
}

/**
 * Sign up a new user with email and password.
 * DISABLED: Signups are now private and handled by the coach portal.
 */
export async function signUp(email, password) {
    return { data: null, error: { message: "L'inscription publique est désactivée. Veuillez contacter votre coach." } };
}

/**
 * Sign out the current user and redirect to login.
 */
export async function signOut() {
    // Prevent multiple modals
    if (document.getElementById('logout-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'logout-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-card" style="text-align: center; max-width: 400px; padding: 40px;">
            <div style="margin-bottom: 30px;">
                <div style="width: 70px; height: 70px; background: rgba(244, 63, 94, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                    <i class="fa-solid fa-power-off" style="font-size: 30px; color: var(--error-color);"></i>
                </div>
                <h2 style="font-size: 22px; margin-bottom: 12px; font-weight: 800; color: white;">Déconnexion</h2>
                <p style="color: var(--text-muted); font-size: 14px; line-height: 1.6;">Voulez-vous vraiment vous déconnecter ?<br>Toutes vos données sont sécurisées.</p>
            </div>
            <div style="display: flex; gap: 12px;">
                <button id="cancel-logout" class="btn btn-outline" style="flex: 1; padding: 12px; font-size: 13px; font-weight: 800; letter-spacing: 1px;">ANNULER</button>
                <button id="confirm-logout" class="btn btn-primary" style="flex: 1; padding: 12px; font-size: 13px; font-weight: 800; letter-spacing: 1px; background: var(--error-color) !important; color: white; border: none; box-shadow: 0 4px 15px rgba(244, 63, 94, 0.2) !important;">DÉCONNEXION</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    return new Promise((resolve) => {
        document.getElementById('cancel-logout').onclick = () => {
            modal.remove();
            resolve(false);
        };

        document.getElementById('confirm-logout').onclick = async () => {
            const btn = document.getElementById('confirm-logout');
            btn.disabled = true;
            btn.innerText = "CONNEXION...";
            await supabase.auth.signOut();
            window.location.href = 'login.html';
            resolve(true);
        };

        // Close on overlay click
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.remove();
                resolve(false);
            }
        };
    });
}

/**
 * Get current user profile from public.profiles.
 */
export async function getProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    return { data, error };
}
