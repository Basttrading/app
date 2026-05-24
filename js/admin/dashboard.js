import { supabase } from '../supabase.js';
import { adminState } from './main.js';

let dashboardChart = null;

export async function renderDashboard(container) {
    console.log("📊 Loading dashboard with real data...");
    
    // 1. Fetch Students
    let query = supabase.from('profiles').select('id, created_at, role').eq('role', 'student');
    if (adminState.profile.role === 'coach') query = query.eq('coach_id', adminState.profile.id);
    
    const { data: students, error: sErr } = await query;
    if (sErr) throw sErr;

    // 2. Fetch all trades and progress separately
    const [tradesRes, progressRes, lessonsRes] = await Promise.all([
        supabase.from('trades').select('id, result, rr_realized, trade_date, user_id'),
        supabase.from('user_lesson_progress').select('user_id, completed').eq('completed', true),
        supabase.from('lessons').select('id').eq('is_published', true)
    ]);

    const trades = tradesRes.data || [];
    const allProgress = progressRes.data || [];
    const totalLessons = lessonsRes.data?.length || 1;

    // 3. Calculations
    const totalStudents = students.length;
    const totalTrades = trades.length;
    
    // Calcul des moyennes par élève
    let studentWinRates = [];
    let studentRRs = [];

    students.forEach(s => {
        const sTrades = trades.filter(t => t.user_id === s.id);
        if (sTrades.length > 0) {
            const sWins = sTrades.filter(t => {
                const res = (t.result || "").toLowerCase();
                return res === 'win' || res === 'take_profit' || res === 'gagnant';
            }).length;
            const sWinRate = (sWins / sTrades.length) * 100;
            studentWinRates.push(sWinRate);

            const sWinningTrades = sTrades.filter(t => {
                const res = (t.result || "").toLowerCase();
                return res === 'win' || res === 'take_profit' || res === 'gagnant';
            });
            if (sWinningTrades.length > 0) {
                const sAvgRR = sWinningTrades.reduce((acc, t) => acc + (parseFloat(t.rr_realized) || 0), 0) / sWinningTrades.length;
                studentRRs.push(sAvgRR);
            }
        }
    });

    const avgWinRate = studentWinRates.length > 0 ? (studentWinRates.reduce((a, b) => a + b, 0) / studentWinRates.length).toFixed(1) : 0;
    const avgRR = studentRRs.length > 0 ? (studentRRs.reduce((a, b) => a + b, 0) / studentRRs.length).toFixed(2) : 0;

    let comp100 = 0;
    students.forEach(s => {
        const done = allProgress.filter(p => p.user_id === s.id).length;
        if (done >= totalLessons) comp100++;
    });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newStudents = students.filter(s => new Date(s.created_at) > sevenDaysAgo).length;

    // 3. Render HTML
    container.innerHTML = `
        <header style="margin-bottom: 40px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
                <h1 style="font-size: 32px; margin-bottom: 8px;">Dashboard Coach</h1>
                <p style="color: var(--text-muted); font-size: 16px;">Vue d'ensemble de la performance communautaire.</p>
            </div>
            <div class="filter-group">
                <button class="filter-btn active" data-filter="all">Global</button>
                <button class="filter-btn" data-filter="7">7 Jours</button>
                <button class="filter-btn" data-filter="30">Mensuel</button>
                <button class="filter-btn" data-filter="365">Annuel</button>
            </div>
        </header>

        <!-- KPI Grid -->
        <div class="admin-stats-grid">
            <div class="admin-kpi-card">
                <span class="admin-kpi-label">Communauté</span>
                <span class="admin-kpi-value">${totalStudents}</span>
                <span class="admin-kpi-trend trend-up"><i class="fa-solid fa-user-plus"></i> ${newStudents} nouveaux (7j)</span>
            </div>
            <div class="admin-kpi-card">
                <span class="admin-kpi-label">Win Rate Moyen</span>
                <span class="admin-kpi-value" style="color: #ffffff">${avgWinRate}%</span>
                <span class="admin-kpi-trend trend-up">Moyenne des élèves</span>
            </div>
            <div class="admin-kpi-card">
                <span class="admin-kpi-label">RR Moyen</span>
                <span class="admin-kpi-value" style="color: #ffffff">${avgRR} R</span>
                <span class="admin-kpi-trend trend-up">Par trade gagnant</span>
            </div>
            <div class="admin-kpi-card">
                <span class="admin-kpi-label">Formés à 100%</span>
                <span class="admin-kpi-value">${comp100}</span>
                <span class="admin-kpi-trend" style="color: var(--primary-color)">Félicitations</span>
            </div>
        </div>

        <!-- Community Performance Chart -->
        <section class="card" style="margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 class="card-title" style="margin: 0;">Courbe de Performance Communautaire</h3>
            </div>
            <div id="community-chart" style="min-height: 350px;"></div>
        </section>

        <!-- Average Daily RR Chart -->
        <section class="card" style="margin-bottom: 40px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 class="card-title" style="margin: 0; border-left-color: var(--secondary-color);">RR Moyen Journalier</h3>
            </div>
            <div id="avg-rr-chart" style="min-height: 350px;"></div>
        </section>
    `;

    // 4. Initialize Charts
    initPerformanceChart(trades, 'all');
    initAvgRRChart(trades, 'all');

    // Filter Buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.dataset.filter;
            initPerformanceChart(trades, filter);
            initAvgRRChart(trades, filter);
        };
    });
}

function initAvgRRChart(trades, filter) {
    const data = processAvgRRData(trades, filter);
    
    const options = {
        series: [{ name: 'RR Moyen (J)', data: data.seriesData }],
        chart: { 
            type: 'bar', 
            height: 350, 
            toolbar: { show: false }, 
            zoom: { enabled: false }, // Zoom désactivé
            background: 'transparent',
            fontFamily: 'Plus Jakarta Sans, sans-serif'
        },
        colors: ['#0072B9'],
        plotOptions: { 
            bar: { 
                borderRadius: 4, 
                colors: { 
                    ranges: [{ from: -99, to: -0.01, color: '#F43F5E' }, { from: 0, to: 99, color: '#3fb950' }] 
                } 
            } 
        },
        xaxis: { 
            type: 'datetime',
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: { style: { colors: '#94A3B8', fontWeight: 600 } }
        },
        yaxis: {
            labels: { style: { colors: '#94A3B8' }, formatter: (val) => val.toFixed(1) + " R" }
        },
        grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 5 },
        tooltip: { 
            theme: 'dark',
            x: { format: 'dd MMM yyyy' },
            y: { formatter: val => val.toFixed(2) + " R" }
        }
    };

    const chartEl = document.querySelector("#avg-rr-chart");
    if (chartEl) {
        chartEl.innerHTML = "";
        new ApexCharts(chartEl, options).render();
    }
}

function processAvgRRData(trades, filter) {
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

    const dailyStats = {};
    filtered.forEach(t => {
        const d = t.trade_date;
        const r = Math.abs(parseFloat(t.rr_realized) || 0);
        const res = (t.result || "").toLowerCase();
        const signedR = (res === 'stop_loss' || res === 'loss' || res === 'perdant') ? -r : r;
        
        if (!dailyStats[d]) dailyStats[d] = { sum: 0, count: 0 };
        dailyStats[d].sum += signedR;
        dailyStats[d].count += 1;
    });

    const sortedDates = Object.keys(dailyStats).sort();
    const seriesData = sortedDates.map(date => {
        const avg = dailyStats[date].sum / dailyStats[date].count;
        return { x: new Date(date).getTime(), y: parseFloat(avg.toFixed(2)) };
    });

    return { seriesData };
}

function initPerformanceChart(trades, filter) {
    const data = processPerformanceData(trades, filter);
    
    const options = {
        series: [{ name: 'RR Communautaire', data: data.seriesData }],
        chart: { 
            type: 'area', 
            height: 350, 
            toolbar: { show: false }, 
            zoom: { enabled: false }, 
            foreColor: '#64748B',
            background: 'transparent',
            fontFamily: 'Plus Jakarta Sans, sans-serif'
        },
        colors: ['#3fb950'],
        stroke: { curve: 'smooth', width: 4, lineCap: 'round' },
        fill: { 
            type: 'gradient',
            gradient: { shadeIntensity: 1, opacityFrom: 0.45, opacityTo: 0.02, stops: [0, 90, 100] } 
        },
        xaxis: { 
            type: 'datetime',
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: { style: { colors: '#94A3B8', fontWeight: 600 } }
        },
        yaxis: {
            show: false, // On cache les numéros comme demandé
            labels: { show: false }
        },
        grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 5 },
        dataLabels: { enabled: false },
        tooltip: { 
            theme: 'dark',
            x: { format: 'dd MMM yyyy' },
            y: { formatter: val => val.toFixed(2) + " R" }
        }
    };

    const chartEl = document.querySelector("#community-chart");
    if (chartEl) {
        chartEl.innerHTML = "";
        dashboardChart = new ApexCharts(chartEl, options);
        dashboardChart.render();
    }
}

function processPerformanceData(trades, filter) {
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

    return { seriesData };
}
