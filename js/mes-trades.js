import { supabase } from './supabase.js';
import { checkAuth, signOut } from './auth.js';
import { initSidebarProgress, showToast } from './common.js';

let allTrades = [];
let currentUserId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const session = await checkAuth();
    if (!session) return;
    currentUserId = session.user.id;

    initSidebarProgress();

    await loadHistory();

    const searchSymbol = document.getElementById('search-symbol');
    const filterStatus = document.getElementById('filter-status');
    const filterAccount = document.getElementById('filter-account');

    if (searchSymbol) searchSymbol.addEventListener('input', applyFilters);
    if (filterStatus) filterStatus.addEventListener('change', applyFilters);
    if (filterAccount) filterAccount.addEventListener('change', applyFilters);

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.onclick = async () => { await signOut(); };
});

async function loadHistory() {
    const statusLabel = document.getElementById('load-status');
    try {
        const { data: trades, error } = await supabase.from('trades').select('*').eq('user_id', currentUserId).order('trade_date', { ascending: false });
        if (error) throw error;
        allTrades = trades || [];
        if (statusLabel) statusLabel.innerText = allTrades.length + " trades chargés.";
        renderTrades(allTrades);
    } catch (err) {
        console.error('Error fetching history:', err);
        if (statusLabel) statusLabel.innerText = "Erreur de chargement.";
    }
}

function applyFilters() {
    const searchTerm = document.getElementById('search-symbol').value.toUpperCase();
    const statusFilter = document.getElementById('filter-status').value;
    const accountFilter = document.getElementById('filter-account').value;
    const filtered = allTrades.filter(t => {
        const matchSymbol = (t.asset || "").toUpperCase().includes(searchTerm);
        
        let matchStatus = statusFilter === 'all';
        if (!matchStatus) {
            const res = (t.result || "").toLowerCase();
            if (statusFilter === 'Win') matchStatus = (res === 'win' || res === 'take_profit' || res === 'gagnant');
            else if (statusFilter === 'Loss') matchStatus = (res === 'loss' || res === 'stop_loss' || res === 'perdant');
            else if (statusFilter === 'BE') matchStatus = (res === 'be' || res === 'break_even');
            else matchStatus = t.result === statusFilter;
        }

        let matchAccount = accountFilter === 'all';
        if (!matchAccount) {
            const acc = (t.account_type || '').toLowerCase();
            if (accountFilter === 'Demo') matchAccount = (acc === 'demo' || acc === 'backtesting' || acc === 'paper');
            else if (accountFilter === 'Funded') matchAccount = (acc === 'funded' || acc === 'propfirm');
            else if (accountFilter === 'Personal') matchAccount = (acc === 'personal' || acc === 'compte_propre');
            else matchAccount = t.account_type === accountFilter;
        }

        return matchSymbol && matchStatus && matchAccount;
    });
    renderTrades(filtered);
}

function renderTrades(trades) {
    const listEl = document.getElementById('history-list');
    const emptyState = document.getElementById('empty-state');
    const tableEl = document.getElementById('history-table');
    if (!trades || trades.length === 0) {
        if (listEl) listEl.innerHTML = '';
        if (tableEl) tableEl.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    if (tableEl) tableEl.style.display = 'table';
    if (emptyState) emptyState.style.display = 'none';
    if (listEl) {
        listEl.innerHTML = trades.map(t => {
            const res = (t.result || "").toLowerCase();
            const isWin = (res === 'take_profit' || res === 'win' || res === 'gagnant');
            const isLoss = (res === 'stop_loss' || res === 'loss' || res === 'perdant');
            
            const resLabel = isWin ? 'Gagnant' : (isLoss ? 'Perdant' : 'BE');
            const resClass = isWin ? 'win' : (isLoss ? 'loss' : 'be');

            const side = (t.order_side || '').toUpperCase();
            const sideLabel = (side === 'ACHAT' || side === 'BUY') ? 'Achat' : 'Vente';

            return `<tr id="trade-${t.id}">
                <td>${new Date(t.trade_date).toLocaleDateString('fr-FR')}</td>
                <td style="font-weight: 800; color: #ffffff !important;">${(t.asset || "").toUpperCase()}</td>
                <td>${sideLabel}</td>
                <td style="font-weight: 700;">${parseFloat(t.rr_realized || 0).toFixed(2)} R</td>
                <td><span class="badge badge-${resClass}">${resLabel}</span></td>
                <td><span style="font-weight: 800; font-size: 11px; color: ${t.plan_respected ? 'var(--success-color)' : 'var(--error-color)'}">${t.plan_respected ? 'OUI' : 'NON'}</span></td>
                <td style="color: var(--primary-color); font-size: 12px;">${'★'.repeat(t.trade_quality || 0)}</td>
                <td style="text-align: center;">
                    <div style="display: flex; gap: 8px; justify-content: center;">
                        ${t.tradingview_link ? `<a href="${t.tradingview_link}" target="_blank" class="btn-action" title="Voir Graphique"><i class="fa-solid fa-chart-line"></i></a>` : ''}
                        <button class="btn-action" onclick="window.editTrade('${t.id}')" title="Modifier"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button class="btn-action btn-delete" onclick="window.deleteTrade('${t.id}')" title="Supprimer"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }
}

window.editTrade = function(id) { window.location.href = `new-trade.html?edit=${id}`; };
window.deleteTrade = async (tradeId) => {
    if (!confirm('Supprimer ce trade définitivement ?')) return;
    const { error } = await supabase.from('trades').delete().eq('id', tradeId);
    if (error) showToast("Erreur : " + error.message, 'error');
    else { 
        allTrades = allTrades.filter(t => t.id !== tradeId); 
        renderTrades(allTrades); 
        showToast("Trade supprimé avec succès", 'success');
    }
};
