import { supabase } from './supabase.js';
import { checkAuth, signOut } from './auth.js';
import { initSidebarProgress } from './common.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("📝 Initialisation page Nouveau Trade...");
    
    // 1. Protection et récupération de l'ID
    const session = await checkAuth();
    if (!session) return;

    const userId = session.user.id;
    console.log("👤 ID Utilisateur actuel (Session):", userId);

    initSidebarProgress();

    // 2. Init date
    const dateInput = document.getElementById('trade_date');
    if (dateInput) dateInput.valueAsDate = new Date();

    const btnSave = document.getElementById('btn-save-final');
    const alertMsg = document.getElementById('alert-msg');

    function showAlert(text, type) {
        alertMsg.innerText = text;
        alertMsg.className = `alert alert-${type}`;
        alertMsg.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // 3. LOGIQUE D'ENREGISTREMENT
    if (btnSave) {
        btnSave.onclick = async (e) => {
            e.preventDefault();
            console.log("🚀 Clic sur Enregistrer détecté.");
            
            btnSave.disabled = true;
            btnSave.innerText = "ENCOURS...";

            const tradeData = {
                user_id: userId, // C'est ici que Supabase vérifie la clé étrangère
                trade_date: document.getElementById('trade_date').value,
                asset: document.getElementById('asset').value,
                order_side: document.getElementById('order_side').value,
                session: document.getElementById('session').value,
                account_type: document.getElementById('account_type').value,
                tradingview_link: document.getElementById('tradingview_link').value || null,
                bias_4h: document.getElementById('bias_4h').value,
                bias_1h: document.getElementById('bias_1h').value,
                fibonacci_retest: document.getElementById('fibonacci_retest').value,
                internal_liquidity: document.getElementById('internal_liquidity').checked,
                tr_liquidity_x2: document.getElementById('tr_liquidity_x2').checked,
                bos: document.getElementById('bos').checked,
                trendline: document.getElementById('trendline').checked,
                rr_realized: parseFloat(document.getElementById('rr_realized').value) || 0,
                result: document.getElementById('result').value,
                plan_respected: document.getElementById('plan_respected').checked,
                trade_quality: parseInt(document.getElementById('trade_quality').value) || 5,
                emotion: document.getElementById('emotion').value || null,
                comment: document.getElementById('comment').value || null
            };

            console.log("📊 Données prêtes à être envoyées:", tradeData);

            try {
                const { data, error } = await supabase.from('trades').insert([tradeData]).select();

                if (error) {
                    console.error("❌ ERREUR SUPABASE:", error);
                    throw error;
                }

                console.log("✅ SUCCÈS:", data);
                showAlert("Trade enregistré avec succès !", "success");
                setTimeout(() => window.location.href = 'mes-trades.html', 1500);

            } catch (err) {
                console.error("❌ Erreur attrapée:", err.message);
                showAlert("Erreur : " + err.message, "error");
                btnSave.disabled = false;
                btnSave.innerText = "RÉESSAYER L'ENREGISTREMENT";
            }
        };
    }
});
