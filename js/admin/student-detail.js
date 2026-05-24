import { supabase } from '../supabase.js';
import { loadView } from './main.js';

let currentCalendarDate = new Date();

export async function renderStudentDetail(container, studentId) {
    console.log("🔍 [DIAGNOSTIC] Démarrage chargement élève:", studentId);
    container.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 50vh;"><div class="loader-admin"></div></div>';

    // 1. Récupération des données de base de l'élève et de la formation active
    const [profileRes, tradesRes, formationRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', studentId).single(),
        supabase.from('trades').select('*').eq('user_id', studentId).order('trade_date', { ascending: true }),
        supabase.from('formations').select('id').eq('is_published', true).limit(1).single()
    ]);

    if (!profileRes.data) {
        container.innerHTML = `<div class="alert alert-error">Élève non trouvé.</div>`;
        return;
    }

    const s = profileRes.data;
    const allTrades = tradesRes.data || [];
    const formation = formationRes.data;
    
    // 2. Calcul précis de la progression (identique à common.js)
    let studentProgressPct = 0;
    if (formation) {
        const { data: chapters } = await supabase.from('chapters').select('id').eq('formation_id', formation.id);
        if (chapters && chapters.length > 0) {
            const chapterIds = chapters.map(c => c.id);
            const { data: lessons } = await supabase.from('lessons').select('id').in('chapter_id', chapterIds).eq('is_published', true);
            
            if (lessons && lessons.length > 0) {
                const { data: progress } = await supabase.from('user_lesson_progress')
                    .select('lesson_id, completed')
                    .eq('user_id', studentId);
                
                const total = lessons.length;
                const done = lessons.filter(l => {
                    const p = progress?.find(pr => pr.lesson_id === l.id);
                    return p && (p.completed === true || p.completed === "true");
                }).length;
                
                studentProgressPct = Math.round((done / total) * 100);
            }
        }
    }

    // Calculs initiaux (Global)
    const getSignedR = (t) => {
        const r = Math.abs(parseFloat(t.rr_realized) || 0);
        const res = (t.result || "").toLowerCase();
        const isLoss = (res === 'loss' || res === 'stop_loss' || res === 'perdant');
        return isLoss ? -r : r;
    };

    const totalRR = allTrades.reduce((acc, t) => acc + getSignedR(t), 0).toFixed(2);
    const wins = allTrades.filter(t => {
        const res = (t.result || '').toLowerCase();
        return res === 'win' || res === 'take_profit' || res === 'gagnant';
    });
    const winrate = allTrades.length > 0 ? (wins.length / allTrades.length * 100).toFixed(1) : 0;
    const avgRR = allTrades.length > 0 ? (allTrades.reduce((acc, t) => acc + getSignedR(t), 0) / allTrades.length).toFixed(2) : "0.00";

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; gap: 20px; flex-wrap: wrap;">
            <button class="btn btn-outline" onclick="loadView('students')" style="flex-shrink: 0;">
                <i class="fa-solid fa-arrow-left"></i> Retour
            </button>
            <div style="display: flex; align-items: center; gap: 15px; background: var(--surface-color); padding: 10px 20px; border-radius: 12px; border: 1px solid var(--border-color); flex: 1; min-width: 300px;">
                <div class="user-avatar-sm" style="width:32px; height:32px; font-size:12px; background: var(--primary-color); color: black;">${(s.prenom?.[0] || s.email[0]).toUpperCase()}</div>
                <div style="font-size: 15px; font-weight: 800;">${s.prenom || ''} ${s.nom || ''}</div>
                <div style="font-size: 13px; color: var(--text-muted); border-left: 1px solid var(--border-color); padding-left: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${s.email}</div>
                <div style="font-size: 13px; font-weight: 800; color: var(--primary-color); border-left: 1px solid var(--border-color); padding-left: 15px; white-space: nowrap;">
                    Formation: ${studentProgressPct}%
                </div>
            </div>
        </div>

        <div class="data-main-panel" style="display: flex; flex-direction: column; gap: 24px;">
            <div class="tab-navigation" style="display: flex; gap: 20px; margin-bottom: 0px; border-bottom: 1px solid var(--border-color);">
                <button class="tab-btn active" data-tab="trades" style="background:none; border:none; color:white; font-weight:700; cursor:pointer; padding: 15px; border-bottom: 2px solid var(--primary-color);">TABLEAU DE BORD</button>
                <button class="tab-btn" data-tab="analyse" style="background:none; border:none; color:var(--text-muted); font-weight:700; cursor:pointer; padding: 15px;">ANALYSES DÉTAILLÉES</button>
                <button class="tab-btn" data-tab="calendar" style="background:none; border:none; color:var(--text-muted); font-weight:700; cursor:pointer; padding: 15px;">CALENDRIER</button>
            </div>

            <!-- Tab: DASHBOARD -->
            <div id="tab-trades" class="tab-content">
                <div class="admin-stats-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 24px;">
                    <div class="admin-kpi-card">
                        <span class="admin-kpi-label">Winrate</span>
                        <span class="admin-kpi-value">${winrate}%</span>
                    </div>
                    <div class="admin-kpi-card">
                        <span class="admin-kpi-label">RR Moyen</span>
                        <span class="admin-kpi-value" style="color: var(--success-color)">${avgRR} R</span>
                    </div>
                    <div class="admin-kpi-card">
                        <span class="admin-kpi-label">Profit Total</span>
                        <span class="admin-kpi-value" style="color: ${totalRR >= 0 ? 'var(--success-color)' : 'var(--error-color)'}">${totalRR} R</span>
                    </div>
                    <div class="admin-kpi-card">
                        <span class="admin-kpi-label">Trades</span>
                        <span class="admin-kpi-value">${allTrades.length}</span>
                    </div>
                </div>

                <section class="card" style="margin-bottom: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h3 class="card-title" style="margin:0;">Évolution Équité</h3>
                        <div class="filter-group">
                            <button class="filter-btn active" data-filter="all">Global</button>
                            <button class="filter-btn" data-filter="7">7J</button>
                            <button class="filter-btn" data-filter="30">30J</button>
                            <button class="filter-btn" data-filter="365">12M</button>
                        </div>
                    </div>
                    <div id="student-equity-chart" style="min-height: 350px;"></div>
                </section>

                <section class="card" style="padding: 0;">
                    <div style="padding: 20px; border-bottom: 1px solid var(--border-color);">
                        <h3 class="card-title" style="margin:0;">Historique Récent</h3>
                    </div>
                    <div class="table-container" style="border:none;">
                        <table style="width: 100%;">
                            <thead><tr><th>Date</th><th>Actif</th><th>RR</th><th>Résultat</th><th style="text-align:center;">Action</th></tr></thead>
                            <tbody id="student-trades-history">
                                <!-- Rempli dynamiquement -->
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            <!-- Tab: ANALYSE -->
            <div id="tab-analyse" class="tab-content" style="display: none;">
                <div id="analyse-charts-container"></div>
            </div>

            <!-- Tab: CALENDAR -->
            <div id="tab-calendar" class="tab-content" style="display: none;">
                <section class="card calendar-section">
                    <div class="calendar-header-wrapper">
                        <div class="calendar-title-group">
                            <h2 class="calendar-main-title">Calendrier de Trading</h2>
                        </div>
                        <div class="calendar-nav-group">
                            <button id="student-prev-month" class="btn-nav"><i class="fa-solid fa-arrow-left"></i></button>
                            <h2 id="student-month-display" class="calendar-month-year">...</h2>
                            <button id="student-next-month" class="btn-nav"><i class="fa-solid fa-arrow-right"></i></button>
                        </div>
                    </div>
                    <div class="calendar-grid-header">
                        <span>LUN</span><span>MAR</span><span>MER</span><span>JEU</span><span>VEN</span><span>SAM</span><span>DIM</span>
                    </div>
                    <div id="student-calendar-days" class="calendar-grid"></div>
                </section>
            </div>
        </div>
    `;

    // Gestion des Onglets
    const tabBtns = container.querySelectorAll('.tab-btn');
    const tabContents = container.querySelectorAll('.tab-content');
    tabBtns.forEach(btn => {
        btn.onclick = () => {
            tabBtns.forEach(b => { b.style.color = 'var(--text-muted)'; b.style.borderBottom = 'none'; });
            btn.style.color = 'white'; btn.style.borderBottom = '2px solid var(--primary-color)';
            const target = btn.dataset.tab;
            tabContents.forEach(c => c.style.display = 'none');
            container.querySelector(`#tab-${target}`).style.display = 'block';
            if (target === 'analyse' && allTrades.length > 0) renderAnalyseView(allTrades);
            if (target === 'calendar') renderCalendar(allTrades);
        };
    });

    // Navigation Calendrier
    container.querySelector('#student-prev-month').onclick = () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar(allTrades);
    };
    container.querySelector('#student-next-month').onclick = () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar(allTrades);
    };

    // Initialisation Graphique et Table
    const renderFilteredView = (filter) => {
        const filtered = filterData(allTrades, filter);
        updateEquityChart(filtered, container);
        updateTradesTable(filtered);
    };

    container.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = () => {
            container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderFilteredView(btn.dataset.filter);
        };
    });

    renderFilteredView('all');
}

function filterData(trades, filter) {
    let filtered = [...trades].sort((a,b) => new Date(a.trade_date) - new Date(b.trade_date));
    const now = new Date();
    if (filter === '7') {
        const start = new Date(); start.setDate(now.getDate() - 7);
        filtered = filtered.filter(t => new Date(t.trade_date) >= start);
    } else if (filter === '30') {
        const start = new Date(); start.setDate(now.getDate() - 30);
        filtered = filtered.filter(t => new Date(t.trade_date) >= start);
    } else if (filter === '365') {
        const start = new Date(); start.setDate(now.getDate() - 365);
        filtered = filtered.filter(t => new Date(t.trade_date) >= start);
    }
    return filtered;
}

function updateEquityChart(trades, container) {
    const equityData = [];
    let cumul = 0;
    trades.forEach(t => {
        const r = Math.abs(parseFloat(t.rr_realized) || 0);
        const res = (t.result || "").toLowerCase();
        const isLoss = (res === 'loss' || res === 'stop_loss' || res === 'perdant');
        cumul += (isLoss ? -r : r);
        equityData.push({ x: new Date(t.trade_date).getTime(), y: parseFloat(cumul.toFixed(2)) });
    });

    const options = {
        series: [{ name: 'RR Cumulé', data: equityData }],
        chart: { 
            type: 'area', 
            height: 350, 
            toolbar: { show: false }, 
            background: 'transparent', 
            zoom: { enabled: false },
            fontFamily: 'Plus Jakarta Sans, sans-serif'
        },
        stroke: { curve: 'smooth', width: 4, lineCap: 'round' },
        colors: ['#3fb950'],
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.45, opacityTo: 0.02, stops: [0, 90, 100] } },
        xaxis: { type: 'datetime', labels: { style: { colors: '#94A3B8', fontWeight: 600 } }, axisBorder: { show: false }, axisTicks: { show: false } },
        yaxis: { show: false },
        grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 5 },
        theme: { mode: 'dark' },
        dataLabels: { enabled: false },
        tooltip: { theme: 'dark', x: { format: 'dd MMM yyyy' }, y: { formatter: val => val.toFixed(2) + " R" } }
    };

    const chartEl = container.querySelector("#student-equity-chart");
    if (chartEl) {
        chartEl.innerHTML = "";
        new ApexCharts(chartEl, options).render();
    }
}

function updateTradesTable(trades) {
    const tbody = document.getElementById('student-trades-history');
    if (!tbody) return;
    const sortedForTable = [...trades].sort((a,b) => new Date(b.trade_date) - new Date(a.trade_date));
    tbody.innerHTML = sortedForTable.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding:30px;">Aucun trade</td></tr>' : sortedForTable.map(t => `
        <tr>
            <td style="color: var(--text-muted);">${new Date(t.trade_date).toLocaleDateString('fr-FR')}</td>
            <td><strong>${(t.asset || '').toUpperCase()}</strong></td>
            <td style="font-weight:700; color: ${ (t.result || '').toLowerCase().includes('loss') ? 'var(--error-color)' : 'var(--success-color)' }">
                ${ (t.result || '').toLowerCase().includes('loss') ? '-' : '+' }${Math.abs(t.rr_realized)} R
            </td>
            <td><span class="badge badge-${(t.result || '').toLowerCase()}">${t.result}</span></td>
            <td style="text-align: center;">
                <div style="display: flex; gap: 8px; justify-content: center;">
                    ${t.tradingview_link ? `<a href="${t.tradingview_link}" target="_blank" class="btn-icon-admin primary" title="Voir l'analyse" style="width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:8px;"><i class="fa-solid fa-arrow-up-right-from-square" style="font-size:14px;"></i></a>` : '<span style="opacity:0.2">-</span>'}
                </div>
            </td>
        </tr>
    `).join('');
}

function renderCalendar(trades) {
    const calendarDays = document.getElementById('student-calendar-days');
    const monthDisplay = document.getElementById('student-month-display');
    if (!calendarDays || !monthDisplay) return;

    calendarDays.innerHTML = "";
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(currentCalendarDate);

    const daily = {};
    let monthTotalR = 0;

    trades.forEach(t => {
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
        if (res === 'take_profit' || res === 'win' || res === 'gagnant') daily[d].wins++;
    });

    monthDisplay.innerHTML = `${monthLabel} <span class="badge ${monthTotalR >= 0 ? 'badge-win' : 'badge-loss'}" style="margin-left:10px; font-size:12px;">${monthTotalR >= 0 ? '+' : ''}${monthTotalR.toFixed(2)} R</span>`;

    let firstDay = new Date(year, month, 1).getDay(); 
    const startingOffset = (firstDay === 0) ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < startingOffset; i++) calendarDays.innerHTML += `<div class="calendar-day empty"></div>`;

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const data = daily[dateStr];
        let cls = data ? (data.r > 0 ? "day-win" : (data.r < 0 ? "day-loss" : "")) : "";
        const dayOfWeek = new Date(year, month, day).getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) cls += " day-weekend";
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

function renderAnalyseView(trades) {
    const container = document.getElementById('analyse-charts-container');
    if (!container) return;
    
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 24px;">
            <section class="card" style="background:transparent; border-color:rgba(255,255,255,0.05);">
                <h3 class="card-title">Performance par Actif</h3>
                <div id="chart-asset-performance"></div>
            </section>
            <section class="card" style="background:transparent; border-color:rgba(255,255,255,0.05);">
                <h3 class="card-title">Winrate par Session</h3>
                <div style="display: flex; justify-content: space-around; padding: 30px 0;">
                    <div style="text-align:center;">
                        <div id="chart-session-london"></div>
                        <span style="font-size:12px; font-weight:800; color:var(--text-muted); letter-spacing:1px;">LONDRES</span>
                    </div>
                    <div style="text-align:center;">
                        <div id="chart-session-ny"></div>
                        <span style="font-size:12px; font-weight:800; color:var(--text-muted); letter-spacing:1px;">NEW YORK</span>
                    </div>
                    <div style="text-align:center;">
                        <div id="chart-session-asia"></div>
                        <span style="font-size:12px; font-weight:800; color:var(--text-muted); letter-spacing:1px;">ASIE</span>
                    </div>
                </div>
            </section>
            <section class="card" style="background:transparent; border-color:rgba(255,255,255,0.05);">
                <h3 class="card-title">Discipline (Respect du Plan)</h3>
                <div id="chart-discipline-impact"></div>
            </section>
            <section class="card" style="background:transparent; border-color:rgba(255,255,255,0.05);">
                <h3 class="card-title">Efficacité des Biais</h3>
                <div id="chart-bias-performance"></div>
            </section>
            <section class="card" style="background:transparent; border-color:rgba(255,255,255,0.05);">
                <h3 class="card-title">Performance Fibonacci</h3>
                <div id="chart-fibonacci-performance"></div>
            </section>
            <section class="card" style="background:transparent; border-color:rgba(255,255,255,0.05);">
                <h3 class="card-title">Impact des Confluences</h3>
                <div id="chart-confluence-performance"></div>
            </section>
        </div>
    `;
    
    setTimeout(() => {
        const s = processStudentStats(trades);
        
        // 1. Assets (Moyen)
        const assetCategories = Object.keys(s.assets);
        const assetAverages = assetCategories.map(a => {
            const data = s.assets[a];
            return data.t > 0 ? parseFloat((data.sum / data.t).toFixed(2)) : 0;
        });

        new ApexCharts(document.querySelector("#chart-asset-performance"), {
            series: [{ name: 'RR Moyen', data: assetAverages }],
            chart: { type: 'bar', height: 280, toolbar: { show: false }, background: 'transparent', fontFamily: 'inherit' },
            plotOptions: { 
                bar: { 
                    borderRadius: 6, 
                    colors: { 
                        ranges: [
                            { from: -999, to: -0.01, color: '#F43F5E' }, 
                            { from: 0, to: 999, color: '#3fb950' }
                        ] 
                    } 
                } 
            },
            xaxis: { categories: assetCategories, labels: { style: { colors: '#94A3B8' } } },
            yaxis: { labels: { style: { colors: '#94A3B8' } } },
            grid: { borderColor: 'rgba(255,255,255,0.05)' },
            theme: { mode: 'dark' },
            tooltip: { y: { formatter: (val) => val + " R (moy.)" } }
        }).render();

        renderMiniCircle("#chart-session-london", s.sessions['LONDRES']);
        renderMiniCircle("#chart-session-ny", s.sessions['NEW YORK']);
        renderMiniCircle("#chart-session-asia", s.sessions['ASIE']);

        const score = Math.round((s.discipline.res / (s.discipline.tot || 1)) * 100);
        new ApexCharts(document.querySelector("#chart-discipline-impact"), {
            series: [score],
            chart: { type: 'radialBar', height: 280, background: 'transparent', fontFamily: 'inherit' },
            plotOptions: { radialBar: { hollow: { size: '70%' }, dataLabels: { name: { show: false }, value: { fontSize: '32px', fontWeight: 800, color: '#FFF', offsetY: 10 } } } },
            colors: [score < 40 ? '#F43F5E' : '#3fb950'],
            theme: { mode: 'dark' }
        }).render();

        new ApexCharts(document.querySelector("#chart-bias-performance"), {
            series: [
                { name: '4H Haussier', data: [getWR(s.biases['4h_bull'])] }, 
                { name: '4H Baissier', data: [getWR(s.biases['4h_bear'])] },
                { name: '1H Haussier', data: [getWR(s.biases['1h_bull'])] }, 
                { name: '1H Baissier', data: [getWR(s.biases['1h_bear'])] }
            ],
            chart: { type: 'bar', height: 280, toolbar: { show: false }, background: 'transparent', fontFamily: 'inherit' },
            plotOptions: { 
                bar: { 
                    borderRadius: 6, 
                    columnWidth: '65%',
                    distributed: false,
                    colors: {
                        ranges: [
                            { from: 0, to: 39.9, color: '#F43F5E' }
                        ]
                    }
                } 
            },
            colors: ['#3fb950', '#2d5a35', '#3fb950', '#2d5a35'],
            xaxis: { categories: ['Winrate %'], labels: { style: { colors: '#94A3B8' } } },
            yaxis: { max: 100, labels: { style: { colors: '#94A3B8' } } },
            grid: { borderColor: 'rgba(255,255,255,0.05)' },
            theme: { mode: 'dark' }
        }).render();

        new ApexCharts(document.querySelector("#chart-fibonacci-performance"), {
            series: [{ name: 'Winrate %', data: [getWR(s.fib['0.5']), getWR(s.fib['0.71']), getWR(s.fib['candle'])] }],
            chart: { type: 'bar', height: 280, toolbar: { show: false }, background: 'transparent', fontFamily: 'inherit' },
            theme: { mode: 'dark' },
            plotOptions: {
                bar: {
                    borderRadius: 6,
                    distributed: true,
                    colors: {
                        ranges: [
                            { from: 0, to: 39.9, color: '#F43F5E' }
                        ]
                    }
                }
            },
            xaxis: { categories: ['0.5', '0.71', 'Bougie'], labels: { style: { colors: '#94A3B8' } } },
            yaxis: { max: 100, labels: { style: { colors: '#94A3B8' } } },
            colors: ['#3fb950', '#2d5a35', '#4a7a4f'],
            grid: { borderColor: 'rgba(255,255,255,0.05)' }
        }).render();

        new ApexCharts(document.querySelector("#chart-confluence-performance"), {
            series: [
                { name: 'AVEC', data: Object.keys(s.confluences).map(k => getWR(s.confluences[k].with)) }, 
                { name: 'SANS', data: Object.keys(s.confluences).map(k => getWR(s.confluences[k].without)) }
            ],
            chart: { type: 'bar', height: 280, toolbar: { show: false }, background: 'transparent', fontFamily: 'inherit' },
            plotOptions: {
                bar: {
                    borderRadius: 4,
                    colors: {
                        ranges: [
                            { from: 0, to: 39.9, color: '#F43F5E' }
                        ]
                    }
                }
            },
            colors: ['#3fb950', '#2d5a35'],
            theme: { mode: 'dark' },
            xaxis: { categories: ['Liq. Inverse', 'Double Liq.', 'Bos', 'Trendline'], labels: { style: { colors: '#94A3B8' } } },
            yaxis: { max: 100, labels: { style: { colors: '#94A3B8' } } },
            grid: { borderColor: 'rgba(255,255,255,0.05)' }
        }).render();

    }, 100);
}

function processStudentStats(trades) {
    const s = {
        assets: {},
        sessions: { 'ASIE': {w:0, t:0}, 'LONDRES': {w:0, t:0}, 'NEW YORK': {w:0, t:0} },
        discipline: { res: 0, tot: trades.length },
        confluences: {
            'liquidité_inverse': { with: {w:0, t:0}, without: {w:0, t:0} },
            'double_liquidation': { with: {w:0, t:0}, without: {w:0, t:0} },
            'bos': { with: {w:0, t:0}, without: {w:0, t:0} },
            'trendline': { with: {w:0, t:0}, without: {w:0, t:0} }
        },
        biases: {
            '4h_bull': {w:0, t:0}, '4h_bear': {w:0, t:0},
            '1h_bull': {w:0, t:0}, '1h_bear': {w:0, t:0}
        },
        fib: { '0.5': {w:0, t:0}, '0.71': {w:0, t:0}, 'candle': {w:0, t:0} }
    };
    trades.forEach(t => {
        const r = Math.abs(parseFloat(t.rr_realized) || 0);
        const res = (t.result || "").toLowerCase();
        const isWin = (res === 'win' || res === 'take_profit' || res === 'gagnant');
        const isLoss = (res === 'loss' || res === 'stop_loss' || res === 'perdant');
        const signedR = isLoss ? -r : (isWin ? r : 0);

        const a = (t.asset || 'Autre').toUpperCase();
        if (!s.assets[a]) s.assets[a] = { sum: 0, t: 0 };
        s.assets[a].sum += signedR;
        s.assets[a].t += 1;

        const sess = (t.session || '').toUpperCase();
        const mSess = (sess.includes('ASIE') || sess.includes('ASIA')) ? 'ASIE' : 
                      (sess.includes('LONDRES') || sess.includes('LONDON')) ? 'LONDRES' : 
                      (sess.includes('YORK') || sess === 'NY') ? 'NEW YORK' : null;
        if (mSess) { s.sessions[mSess].t++; if (isWin) s.sessions[mSess].w++; }
        
        if (t.plan_respected) s.discipline.res++;

        const cMap = { 'internal_liquidity': 'liquidité_inverse', 'tr_liquidity_x2': 'double_liquidation', 'bos': 'bos', 'trendline': 'trendline' };
        Object.keys(cMap).forEach(key => {
            const target = t[key] ? s.confluences[cMap[key]].with : s.confluences[cMap[key]].without;
            target.t++; if (isWin) target.w++;
        });

        const b4h = (t.bias_4h || '').toLowerCase();
        if (b4h === 'haussier' || b4h === 'bullish') { s.biases['4h_bull'].t++; if(isWin) s.biases['4h_bull'].w++; }
        if (b4h === 'baissier' || b4h === 'bearish') { s.biases['4h_bear'].t++; if(isWin) s.biases['4h_bear'].w++; }
        const b1h = (t.bias_1h || '').toLowerCase();
        if (b1h === 'haussier' || b1h === 'bullish') { s.biases['1h_bull'].t++; if(isWin) s.biases['1h_bull'].w++; }
        if (b1h === 'baissier' || b1h === 'bearish') { s.biases['1h_bear'].t++; if(isWin) s.biases['1h_bear'].w++; }

        const fv = t.fibonacci_retest;
        if (fv === '0.5') { s.fib['0.5'].t++; if(isWin) s.fib['0.5'].w++; }
        else if (fv === '0.71') { s.fib['0.71'].t++; if(isWin) s.fib['0.71'].w++; }
        else if (fv === 'jusqu_a_la_bougie') { s.fib['candle'].t++; if(isWin) s.fib['candle'].w++; }
    });
    return s;
}

function renderMiniCircle(sel, d) {
    const wr = getWR(d);
    const container = document.querySelector(sel);
    if (!container) return;
    new ApexCharts(container, {
        series: [wr],
        chart: { type: 'radialBar', width: 140, height: 140, background: 'transparent', fontFamily: 'inherit' },
        plotOptions: { 
            radialBar: { 
                hollow: { size: '60%' },
                dataLabels: { 
                    name: { show: false },
                    value: { fontSize: '16px', fontWeight: 800, color: '#FFF', offsetY: 6 } 
                } 
            } 
        },
        colors: ['#0072B9'],
        theme: { mode: 'dark' }
    }).render();
}

function getWR(d) { return d.t > 0 ? parseFloat(((d.w / d.t) * 100).toFixed(1)) : 0; }
