import { supabase } from './supabase.js';
import { checkAuth, signOut, getProfile } from './auth.js';
import { initSidebarProgress } from './common.js';

let allTrades = [];
let currentUserId = null;
let currentCalendarDate = new Date();
let currentFilter = 'all'; // all, weekly, monthly, yearly

/**
 * INITIALISATION
 */
document.addEventListener('DOMContentLoaded', async () => {
    const session = await checkAuth();
    if (!session) return;

    currentUserId = session.user.id;
    const userEmail = session.user.email;

    // Sidebar progress visible partout
    initSidebarProgress();

    try {
        const [profileRes, tradesRes] = await Promise.all([
            getProfile(currentUserId).catch(e => ({ data: null })),
            supabase
                .from('trades')
                .select('*')
                .eq('user_id', currentUserId)
                .order('trade_date', { ascending: true })
        ]);

        const profile = profileRes.data;
        const userDisplayName = document.getElementById('user-display-name');
        if (userDisplayName) userDisplayName.innerText = profile?.prenom ? `${profile.prenom} ${profile.nom || ''}`.trim() : userEmail;

        if (tradesRes.error) throw tradesRes.error;
        allTrades = tradesRes.data || [];

        updateUIState(allTrades.length);

        if (allTrades.length > 0) {
            renderStats(allTrades);
            renderEquityChart(allTrades);
            renderCalendar();
            renderRecentTrades(allTrades);
            setupChartFilters();
        } else {
            resetStatsToZero();
        }

    } catch (err) {
        console.error("Erreur chargement dashboard:", err.message);
    }

    setupCalendarNavigation();
    setupLogout();

    // Fix le bouton "Tout voir"
    const seeAllBtn = document.querySelector('a[href="history.html"]');
    if (seeAllBtn) seeAllBtn.href = "mes-trades.html";
});

function updateUIState(count) {
    const emptyState = document.getElementById('empty-state');
    const sections = ['stats-container', 'chart-section', 'calendar-section', 'recent-trades-section'];
    if (count === 0) {
        if (emptyState) emptyState.style.display = 'block';
        sections.forEach(id => { const el = document.getElementById(id) || document.querySelector('.'+id); if(el) el.style.display = 'none'; });
    } else {
        if (emptyState) emptyState.style.display = 'none';
        sections.forEach(id => { const el = document.getElementById(id) || document.querySelector('.'+id); if(el) el.style.display = 'block'; });
        const sc = document.getElementById('stats-container'); if(sc) sc.style.display = 'grid';
    }
}

function renderStats(trades) {
    const totalTrades = trades.length;
    let winsCount = 0;
    let sumWinR = 0;
    let allR = [];

    trades.forEach(t => {
        const rValue = Math.abs(parseFloat(t.rr_realized) || 0);
        const res = (t.result || "").toLowerCase();
        const isWin = (res === 'take_profit' || res === 'win' || res === 'gagnant');
        const isLoss = (res === 'stop_loss' || res === 'loss' || res === 'perdant');
        const signedR = isLoss ? -rValue : (isWin ? rValue : 0);
        allR.push(signedR);
        if (isWin) { winsCount++; sumWinR += rValue; }
    });

    // Ordre demandé : Win rate, RR moyen, Meilleur trade, Total trade (Enlever Total R)
    const statsContainer = document.getElementById('stats-container');
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-label">Win Rate</span>
                    <i class="fa-solid fa-chart-pie stat-icon-bg"></i>
                </div>
                <span class="stat-value" id="stat-winrate">0%</span>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-label">RR Moyen</span>
                    <i class="fa-solid fa-arrow-up-right-dots stat-icon-bg" style="color: var(--success-color);"></i>
                </div>
                <span class="stat-value" id="stat-avg-win" style="color: var(--success-color);">0 R</span>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-label">Meilleur Trade</span>
                    <i class="fa-solid fa-trophy stat-icon-bg" style="color: var(--primary-color);"></i>
                </div>
                <span class="stat-value" id="stat-best-trade" style="color: var(--success-color);">0 R</span>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-label">Total Trades</span>
                    <i class="fa-solid fa-hashtag stat-icon-bg"></i>
                </div>
                <span class="stat-value" id="stat-total-trades">0</span>
            </div>
        `;
    }

    safeSetText('stat-winrate', totalTrades > 0 ? ((winsCount / totalTrades) * 100).toFixed(1) + '%' : '0%');
    safeSetText('stat-avg-win', totalTrades > 0 ? (allR.reduce((a,b)=>a+b, 0) / totalTrades).toFixed(2) + ' R' : '0.00 R');
    safeSetText('stat-best-trade', allR.length > 0 ? Math.max(...allR).toFixed(2) + ' R' : '0.00 R');
    safeSetText('stat-total-trades', totalTrades);
}

function renderEquityChart(trades) {
    if (typeof ApexCharts === 'undefined' || trades.length === 0) return;

    // Filtre temporel
    let filtered = [...trades];
    const now = new Date();
    if (currentFilter === 'weekly') {
        const start = new Date(); start.setDate(now.getDate() - 7);
        filtered = trades.filter(t => new Date(t.trade_date) >= start);
    } else if (currentFilter === 'monthly') {
        filtered = trades.filter(t => {
            const d = new Date(t.trade_date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
    } else if (currentFilter === 'yearly') {
        filtered = trades.filter(t => new Date(t.trade_date).getFullYear() === now.getFullYear());
    }

    const dailyResults = {};
    filtered.forEach(t => {
        const d = t.trade_date;
        const r = Math.abs(parseFloat(t.rr_realized) || 0);
        const res = (t.result || "").toLowerCase();
        const signedR = (res === 'stop_loss' || res === 'loss' || res === 'perdant') ? -r : r;
        dailyResults[d] = (dailyResults[d] || 0) + signedR;
    });

    const sortedDates = Object.keys(dailyResults).sort();
    let cumul = 0;
    const seriesData = sortedDates.map(date => {
        cumul += dailyResults[date];
        return { x: new Date(date).getTime(), y: parseFloat(cumul.toFixed(2)) };
    });

    // MISE À JOUR DU COMPTEUR RR (Top du graphique)
    safeSetText('total-r-badge', cumul.toFixed(2) + ' R');

    const options = {
        series: [{ name: 'Performance', data: seriesData }],
        chart: { 
            type: 'area', 
            height: 350, 
            toolbar: { show: false }, 
            background: 'transparent',
            zoom: { enabled: false },
            fontFamily: 'Plus Jakarta Sans, sans-serif'
        },
        colors: ['#3fb950'],
        stroke: { curve: 'smooth', width: 4, lineCap: 'round' },
        dataLabels: { enabled: false },
        fill: { 
            type: 'gradient', 
            gradient: { 
                shadeIntensity: 1, 
                opacityFrom: 0.45, 
                opacityTo: 0.02, 
                stops: [0, 90, 100] 
            } 
        },
        theme: { mode: 'dark' },
        xaxis: { 
            type: 'datetime', 
            labels: { style: { colors: '#94A3B8', fontWeight: 600 } },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: { 
            show: false, // On cache les numéros comme demandé
            labels: { show: false }
        },
        grid: { borderColor: '#30363d', strokeDashArray: 5 },
        tooltip: {
            theme: 'dark',
            x: { format: 'dd MMM yyyy' },
            y: { formatter: val => val.toFixed(2) + " R" },
            style: { fontSize: '13px' }
        }
    };

    const chartEl = document.querySelector("#equity-chart");
    if (chartEl) {
        chartEl.innerHTML = "";
        new ApexCharts(chartEl, options).render();
    }
}

function setupChartFilters() {
    let container = document.querySelector('.chart-section .calendar-toggles');
    if (!container) {
        container = document.createElement('div');
        container.className = 'calendar-toggles';
        container.style.marginTop = '10px';
        const chartHeader = document.querySelector('.chart-section div');
        if (chartHeader) chartHeader.appendChild(container);
    }
    
    container.innerHTML = `
        <button class="toggle-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">Global</button>
        <button class="toggle-btn ${currentFilter === 'weekly' ? 'active' : ''}" data-filter="weekly">Hebdo</button>
        <button class="toggle-btn ${currentFilter === 'monthly' ? 'active' : ''}" data-filter="monthly">Mensuel</button>
        <button class="toggle-btn ${currentFilter === 'yearly' ? 'active' : ''}" data-filter="yearly">Annuel</button>
    `;
    
    container.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.onclick = () => {
            container.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderEquityChart(allTrades);
        };
    });
}

function renderCalendar() {
    const calendarDays = document.getElementById('calendar-days');
    const monthDisplay = document.getElementById('current-month-display');
    if (!calendarDays || !monthDisplay) return;

    calendarDays.innerHTML = "";
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(currentCalendarDate);

    const daily = {};
    let monthTotalR = 0;

    allTrades.forEach(t => {
        const d = t.trade_date; 
        const dateObj = new Date(d);
        const rValue = Math.abs(parseFloat(t.rr_realized) || 0);
        const res = (t.result || "").toLowerCase();
        const signedR = (res === 'stop_loss' || res === 'loss' || res === 'perdant') ? -rValue : rValue;
        
        if (dateObj.getMonth() === month && dateObj.getFullYear() === year) {
            monthTotalR += signedR;
        }

        if (!daily[d]) daily[d] = { r: 0, wins: 0, total: 0 };
        daily[d].r += signedR;
        daily[d].total++;
        if (res === 'take_profit' || res === 'win') daily[d].wins++;
    });

    // Afficher le total R du mois
    monthDisplay.innerHTML = `${monthLabel} <span class="badge ${monthTotalR >= 0 ? 'badge-win' : 'badge-loss'}" style="margin-left:10px; font-size:12px;">${monthTotalR >= 0 ? '+' : ''}${monthTotalR.toFixed(2)} R</span>`;

    let firstDay = new Date(year, month, 1).getDay(); 
    const startingOffset = (firstDay === 0) ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < startingOffset; i++) calendarDays.innerHTML += `<div class="calendar-day empty"></div>`;

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const data = daily[dateStr];
        let cls = data ? (data.r > 0 ? "day-win" : (data.r < 0 ? "day-loss" : "")) : "";
        
        // Appliquer style week-end (Samedi=6, Dimanche=0)
        const dayOfWeek = new Date(year, month, day).getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) cls += " day-weekend";

        // Calcul winrate journalier
        const wr = data ? Math.round((data.wins / data.total) * 100) : 0;

        calendarDays.innerHTML += `
            <div class="calendar-day ${cls}">
                <span class="day-number">${day}</span>
                <div style="text-align: center; flex: 1; display: flex; flex-direction: column; justify-content: center;">
                    <span class="day-r">${data ? (data.r > 0 ? '+' : '') + data.r.toFixed(1) + ' R' : ''}</span>
                    <span class="day-trades-count">${data ? data.total + ' trades' : ''}</span>
                    <span class="day-winrate" style="display: ${data ? 'block' : 'none'}; opacity: 0.6;">${wr}%</span>
                </div>
            </div>
        `;
    }
}

function renderRecentTrades(trades) {
    const list = document.getElementById('trades-list');
    if (!list) return;
    const recent = trades.slice(-5).reverse();
    list.innerHTML = recent.map(t => {
        const res = (t.result || "").toLowerCase();
        const isWin = (res === 'take_profit' || res === 'win' || res === 'gagnant');
        const isLoss = (res === 'stop_loss' || res === 'loss' || res === 'perdant');
        const rValue = Math.abs(parseFloat(t.rr_realized) || 0);
        let badgeClass = 'badge-be', resLabel = 'BE', colorStyle = 'var(--text-muted)', prefix = '';
        if (isWin) { badgeClass = 'badge-win'; resLabel = 'Gain'; colorStyle = 'var(--success-color)'; prefix = '+'; }
        else if (isLoss) { badgeClass = 'badge-loss'; resLabel = 'Perte'; colorStyle = 'var(--error-color)'; prefix = '-'; }

        let sess = (t.session || '-').toUpperCase();
        if (sess === 'NY') sess = 'NEW YORK';

        return `
            <tr>
                <td style="color: var(--text-muted);">${new Date(t.trade_date).toLocaleDateString('fr-FR')}</td>
                <td style="font-weight:700;">${(t.asset || '').toUpperCase()}</td>
                <td>${(t.order_side || '-').toUpperCase() === 'BUY' ? 'ACHAT' : (t.order_side || '-').toUpperCase()}</td>
                <td>${sess}</td>
                <td><span class="badge ${badgeClass}">${resLabel}</span></td>
                <td style="text-align:right; font-weight:800; color:${colorStyle}">${prefix}${rValue.toFixed(1)} R</td>
            </tr>
        `;
    }).join('');
}

function safeSetText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }
function resetStatsToZero() { ['stat-winrate', 'stat-avg-win', 'stat-best-trade', 'stat-total-trades'].forEach(id => safeSetText(id, id.includes('rate') ? '0%' : '0')); }
function setupCalendarNavigation() {
    const prev = document.getElementById('prev-month');
    const next = document.getElementById('next-month');
    if (prev) prev.onclick = () => { currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1); renderCalendar(); };
    if (next) next.onclick = () => { currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1); renderCalendar(); };
}
function setupLogout() { const btn = document.getElementById('btn-logout'); if (btn) btn.onclick = async () => { await signOut(); }; }
