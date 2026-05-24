import { supabase } from './supabase.js';
import { checkAuth, signOut, getProfile } from './auth.js';
import { initSidebarProgress } from './common.js';

let allTradesRaw = [];
let currentUserId = null;
let currentCharts = [];

document.addEventListener('DOMContentLoaded', async () => {
    const session = await checkAuth();
    if (!session) return;
    currentUserId = session.user.id;

    initSidebarProgress();

    const { data: profile } = await getProfile(currentUserId);
    const userDisplayName = document.getElementById('user-display-name');
    if (userDisplayName) userDisplayName.innerText = profile?.prenom ? `${profile.prenom} ${profile.nom || ''}`.trim() : session.user.email;

    await fetchAllTrades();

    const fAcc = document.getElementById('filter-account');
    const fPer = document.getElementById('filter-period');
    const dStart = document.getElementById('date-start');
    const dEnd = document.getElementById('date-end');

    if (fAcc) fAcc.addEventListener('change', refreshCharts);
    if (fPer) fPer.addEventListener('change', handlePeriodChange);
    if (dStart) dStart.addEventListener('change', refreshCharts);
    if (dEnd) dEnd.addEventListener('change', refreshCharts);

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.onclick = async () => { await signOut(); };
});

async function fetchAllTrades() {
    try {
        const { data, error } = await supabase.from('trades').select('*').eq('user_id', currentUserId);
        if (error) throw error;
        allTradesRaw = data || [];
        refreshCharts();
    } catch (err) { console.error("Fetch error:", err.message); }
}

function handlePeriodChange() {
    const period = document.getElementById('filter-period').value;
    const customDiv = document.getElementById('custom-date-inputs');
    if (customDiv) customDiv.style.display = (period === 'custom') ? 'block' : 'none';
    refreshCharts();
}

function refreshCharts() {
    const filteredTrades = applyFilters(allTradesRaw);
    
    const loadingState = document.getElementById('loading-state');
    if (loadingState) loadingState.style.display = 'none';
    
    const emptyState = document.getElementById('empty-state');
    const analyseContent = document.getElementById('analyse-content');
    
    if (filteredTrades.length < 1) {
        if (emptyState) emptyState.style.display = 'block';
        if (analyseContent) analyseContent.style.display = 'none';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    if (analyseContent) analyseContent.style.display = 'block';
    
    document.querySelectorAll('.session-trade-count').forEach(el => el.remove());
    currentCharts.forEach(c => { if(c && typeof c.destroy === 'function') c.destroy(); });
    currentCharts = [];
    
    const stats = processData(filteredTrades);
    renderAll(stats);
}

function applyFilters(trades) {
    const fAcc = document.getElementById('filter-account');
    const fPer = document.getElementById('filter-period');
    if (!fAcc || !fPer) return trades;

    const account = fAcc.value;
    const period = fPer.value;
    
    return trades.filter(t => {
        if (account !== 'all') {
            const acc = (t.account_type || '').toLowerCase();
            if (account === 'Demo' && acc !== 'demo' && acc !== 'backtesting' && acc !== 'paper') return false;
            if (account === 'Funded' && acc !== 'funded' && acc !== 'propfirm') return false;
            if (account === 'Personal' && acc !== 'personal' && acc !== 'compte_propre') return false;
            if (account !== 'Demo' && account !== 'Funded' && account !== 'Personal' && t.account_type !== account) return false;
        }
        if (period !== 'all') {
            const tradeDate = new Date(t.trade_date);
            const now = new Date();
            if (period === 'week') {
                const oneWeekAgo = new Date(); oneWeekAgo.setDate(now.getDate() - 7);
                if (tradeDate < oneWeekAgo) return false;
            } else if (period === 'month') {
                if (tradeDate.getMonth() !== now.getMonth() || tradeDate.getFullYear() !== now.getFullYear()) return false;
            } else if (period === 'custom') {
                const start = document.getElementById('date-start').value;
                const end = document.getElementById('date-end').value;
                if (start && new Date(t.trade_date) < new Date(start)) return false;
                if (end && new Date(t.trade_date) > new Date(end)) return false;
            }
        }
        return true;
    });
}

function processData(trades) {
    const s = {
        assets_data: {},
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
        if (!s.assets_data[a]) s.assets_data[a] = { sum: 0, t: 0 };
        s.assets_data[a].sum += signedR;
        s.assets_data[a].t += 1;

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
        if (t.bias_4h === 'haussier' || t.bias_4h === 'Bullish') { s.biases['4h_bull'].t++; if(isWin) s.biases['4h_bull'].w++; }
        if (t.bias_4h === 'baissier' || t.bias_4h === 'Bearish') { s.biases['4h_bear'].t++; if(isWin) s.biases['4h_bear'].w++; }
        if (t.bias_1h === 'haussier' || t.bias_1h === 'Bullish') { s.biases['1h_bull'].t++; if(isWin) s.biases['1h_bull'].w++; }
        if (t.bias_1h === 'baissier' || t.bias_1h === 'Bearish') { s.biases['1h_bear'].t++; if(isWin) s.biases['1h_bear'].w++; }
        const fv = t.fibonacci_retest;
        if (fv === '0.5') { s.fib['0.5'].t++; if(isWin) s.fib['0.5'].w++; }
        else if (fv === '0.71') { s.fib['0.71'].t++; if(isWin) s.fib['0.71'].w++; }
        else if (fv === 'jusqu_a_la_bougie') { s.fib['candle'].t++; if(isWin) s.fib['candle'].w++; }
    });
    return s;
}

function renderAll(s) {
    renderCircle("#chart-session-london", s.sessions['LONDRES'], 'LONDRES');
    renderCircle("#chart-session-ny", s.sessions['NEW YORK'], 'NEW YORK');
    renderCircle("#chart-session-asia", s.sessions['ASIE'], 'ASIE');
    
    // Calcul des moyennes par actif au lieu du cumul
    const assetCategories = Object.keys(s.assets_data || {});
    const assetAverages = assetCategories.map(a => {
        const data = s.assets_data[a];
        return data.t > 0 ? parseFloat((data.sum / data.t).toFixed(2)) : 0;
    });

    const assetChart = new ApexCharts(document.querySelector("#chart-asset-performance"), {
        series: [{ name: 'RR Moyen', data: assetAverages }],
        chart: { type: 'bar', height: 300, background: 'transparent', toolbar: { show: false }, fontFamily: 'Plus Jakarta Sans, sans-serif' },
        plotOptions: { 
            bar: { 
                colors: { 
                    ranges: [
                        { from: -999, to: -0.01, color: '#F43F5E' }, 
                        { from: 0, to: 999, color: '#3fb950' }
                    ] 
                }, 
                borderRadius: 6 
            } 
        },
        theme: { mode: 'dark' },
        xaxis: { categories: assetCategories },
        grid: { borderColor: '#30363d' },
        tooltip: { y: { formatter: (val) => val + " R (moy.)" } }
    });
    assetChart.render(); currentCharts.push(assetChart);
    
    const score = Math.round((s.discipline.res / (s.discipline.tot || 1)) * 100);
    const discChart = new ApexCharts(document.querySelector("#chart-discipline-impact"), {
        series: [score],
        chart: { type: 'radialBar', height: 300, background: 'transparent', fontFamily: 'Plus Jakarta Sans, sans-serif' },
        plotOptions: { radialBar: { hollow: { size: '70%' }, dataLabels: { name: { show: false }, value: { fontSize: '30px', fontWeight: '900', color: '#FFF', offsetY: 10, formatter: v => v + '%' } } } },
        colors: [score < 40 ? '#F43F5E' : '#3fb950']
    });
    discChart.render(); currentCharts.push(discChart);
    
    const dc = document.getElementById('discipline-comment'); 
    if(dc) dc.innerText = `Respect du plan : ${s.discipline.res}/${s.discipline.tot}`;
    
    const biasChart = new ApexCharts(document.querySelector("#chart-bias-performance"), {
        series: [
            { name: '4H Haussier', data: [getWR(s.biases['4h_bull'])] }, 
            { name: '4H Baissier', data: [getWR(s.biases['4h_bear'])] }, 
            { name: '1H Haussier', data: [getWR(s.biases['1h_bull'])] }, 
            { name: '1H Baissier', data: [getWR(s.biases['1h_bear'])] }
        ],
        chart: { type: 'bar', height: 300, background: 'transparent', toolbar: { show: false }, fontFamily: 'Plus Jakarta Sans, sans-serif' },
        theme: { mode: 'dark' },
        xaxis: { categories: ['Winrate %'] },
        yaxis: { max: 100 },
        plotOptions: {
            bar: {
                colors: {
                    ranges: [
                        { from: 0, to: 39.9, color: '#F43F5E' }
                    ]
                }
            }
        },
        colors: ['#3fb950', '#2d5a35', '#3fb950', '#2d5a35'],
        grid: { borderColor: '#30363d' }
    });
    biasChart.render(); currentCharts.push(biasChart);
    
    const fibChart = new ApexCharts(document.querySelector("#chart-fibonacci-performance"), {
        series: [{ name: 'Winrate %', data: [getWR(s.fib['0.5']), getWR(s.fib['0.71']), getWR(s.fib['candle'])] }],
        chart: { type: 'bar', height: 300, background: 'transparent', toolbar: { show: false }, fontFamily: 'Plus Jakarta Sans, sans-serif' },
        theme: { mode: 'dark' },
        plotOptions: {
            bar: {
                distributed: true,
                colors: {
                    ranges: [
                        { from: 0, to: 39.9, color: '#F43F5E' }
                    ]
                }
            }
        },
        xaxis: { categories: ['0.5', '0.71', 'Bougie'] },
        colors: ['#3fb950', '#2d5a35', '#4a7a4f'],
        grid: { borderColor: '#30363d' }
    });
    fibChart.render(); currentCharts.push(fibChart);
    
    const confChart = new ApexCharts(document.querySelector("#chart-confluence-performance"), {
        series: [
            { name: 'AVEC', data: Object.keys(s.confluences).map(k => getWR(s.confluences[k].with)) }, 
            { name: 'SANS', data: Object.keys(s.confluences).map(k => getWR(s.confluences[k].without)) }
        ],
        chart: { type: 'bar', height: 350, background: 'transparent', toolbar: { show: false }, fontFamily: 'Plus Jakarta Sans, sans-serif' },
        plotOptions: {
            bar: {
                colors: {
                    ranges: [
                        { from: 0, to: 39.9, color: '#F43F5E' }
                    ]
                }
            }
        },
        colors: ['#3fb950', '#2d5a35'],
        theme: { mode: 'dark' },
        xaxis: { categories: ['Liq. Inverse', 'Double Liq.', 'Bos', 'Trendline'] },
        yaxis: { max: 100 },
        grid: { borderColor: '#30363d' }
    });
    confChart.render(); currentCharts.push(confChart);
}

function renderCircle(sel, d, label) {
    const wr = getWR(d);
    const container = document.querySelector(sel);
    if (!container) return;
    const chart = new ApexCharts(container, {
        series: [wr],
        chart: { type: 'radialBar', width: 180, height: 180, background: 'transparent', fontFamily: 'Plus Jakarta Sans, sans-serif' },
        plotOptions: { radialBar: { hollow: { size: '60%' }, dataLabels: { name: { show: false }, value: { fontSize: '18px', fontWeight: '800', color: '#FFF', offsetY: 6, formatter: v => v + '%' } } } },
        colors: [wr < 40 ? '#F43F5E' : '#3fb950']
    });
    chart.render(); currentCharts.push(chart);
    const labelEl = container.parentElement.querySelector('.session-label');
    if (labelEl) labelEl.innerText = label;
    const countEl = document.createElement('div');
    countEl.className = 'session-trade-count';
    countEl.style.fontSize = '12px'; countEl.style.fontWeight = '600'; countEl.style.color = 'var(--text-muted)';
    countEl.style.marginTop = '-5px'; countEl.style.marginBottom = '15px';
    countEl.innerText = `${d.t} trades`;
    container.parentElement.appendChild(countEl);
}

function getWR(d) { return d.t > 0 ? parseFloat(((d.w / d.t) * 100).toFixed(1)) : 0; }
