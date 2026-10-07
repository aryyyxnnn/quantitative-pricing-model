
// Combined script.js
(function() {
const state = {
    currentCurrency: '$',
    baseline: null,
    currentSimulationState: null,
    scenarioHistory: [],
    profitChartInstance: null,
    theme: localStorage.getItem('theme') || 'light'
};



const STORAGE_KEY = 'pricingDashboardV1';

function persist() {
    try {
        const inputs = {};
        ['fixed-costs', 'variable-costs', 'selling-price', 'units-sold'].forEach(id => {
            inputs[id] = document.getElementById(id).value;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            currency: state.currentCurrency,
            inputs,
            history: state.scenarioHistory,
            hasBaseline: !!state.baseline
        }));
    } catch (e) { /* storage unavailable */ }
}

function showToast(message) {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // Trigger reflow
    void toast.offsetWidth;
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

function formatCurrency(value) {
    return state.currentCurrency + value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

function sanitizeInputs() {
    const inputs = [
        document.getElementById('fixed-costs'),
        document.getElementById('variable-costs'),
        document.getElementById('selling-price'),
        document.getElementById('units-sold')
    ];
    
    let isValid = true;
    inputs.forEach(input => {
        const errorText = document.getElementById(`error-${input.id}`);
        input.classList.remove('input-error');
        if(errorText) errorText.classList.add('hidden');
        
        if (input.value === '') {
            input.classList.add('input-error');
            if(errorText) errorText.classList.remove('hidden');
            isValid = false;
        } else if (parseFloat(input.value) < 0 || (input.id === 'selling-price' && parseFloat(input.value) === 0)) {
            input.classList.add('input-error');
            if(errorText) errorText.classList.remove('hidden');
            isValid = false;
        } else {
            // Ensure error text stays hidden when valid
            if(errorText) errorText.classList.add('hidden');
        }
    });
    return isValid;
}

function renderScenarioTable(formatCurrencyFn) {
    const scenarioTableBody = document.getElementById('scenario-table-body');
    scenarioTableBody.innerHTML = '';
    
    let maxProfit = -Infinity;
    let maxIndex = -1;
    state.scenarioHistory.forEach((scenario, index) => {
        if (scenario.projectedProfit > maxProfit) {
            maxProfit = scenario.projectedProfit;
            maxIndex = index;
        }
    });

    state.scenarioHistory.forEach((scenario, index) => {
        const tr = document.createElement('tr');
        if (index === maxIndex) {
            tr.classList.add('best-scenario');
        }
        tr.innerHTML = `
            <td><input type="checkbox" class="scenario-checkbox" data-index="${index}"></td>
            <td>${scenario.timestamp}</td>
            <td>${scenario.ped.toFixed(2)}</td>
            <td>${scenario.priceChangePercent > 0 ? '+' : ''}${scenario.priceChangePercent}%</td>
            <td>${formatCurrencyFn(scenario.newPrice)}</td>
            <td>${Math.round(scenario.volume).toLocaleString()}</td>
            <td>${scenario.grossMarginPercent.toFixed(1)}%</td>
            <td>${formatCurrencyFn(scenario.projectedProfit)}</td>
            <td class="settings-cell">XED ${scenario.xed ?? 0}, comp ${scenario.compPriceChange ?? 0}%, ${scenario.demandCurveType === 'constant' ? 'constant elasticity' : 'linear'}, ${scenario.volumeDiscounts ? 'discounts on' : 'no discounts'}</td>
            <td><button class="btn-dark-outline load-btn" data-index="${index}">Load</button></td>
        `;
        scenarioTableBody.appendChild(tr);
    });
}



function calculateBaseline(fixedCosts, variableCostsPerUnit, currentSellingPrice, currentUnitsSold) {
    const totalRevenue = currentSellingPrice * currentUnitsSold;
    const totalVariableCosts = variableCostsPerUnit * currentUnitsSold;
    const totalCosts = fixedCosts + totalVariableCosts;
    const baselineProfit = totalRevenue - totalCosts;

    return {
        fixedCosts,
        variableCostsPerUnit,
        currentSellingPrice,
        currentUnitsSold,
        baselineProfit
    };
}

function calculateSimulationValues(ped, priceChangePercent, xed = 0, compPriceChangePercent = 0, enableDiscounts = false, demandCurveType = 'linear') {
    if (!state.baseline) return null;

    let quantityChangePercent = 0;
    const newPrice = state.baseline.currentSellingPrice * (1 + (priceChangePercent / 100));
    let rawNewUnitsSold = state.baseline.currentUnitsSold;
    
    // Demand Curve Calculation
    if (demandCurveType === 'linear') {
        quantityChangePercent = (ped * priceChangePercent) + (xed * compPriceChangePercent);
        rawNewUnitsSold = state.baseline.currentUnitsSold * (1 + (quantityChangePercent / 100));
    } else if (demandCurveType === 'constant') {
        // Q = a * P^PED (a is implicitly calculated based on baseline)
        // Adjust for Competitor price with XED: Q = a * P^PED * Pc^XED
        const priceRatio = newPrice / state.baseline.currentSellingPrice;
        const compPriceRatio = 1 + (compPriceChangePercent / 100);
        rawNewUnitsSold = state.baseline.currentUnitsSold * Math.pow(priceRatio, ped) * Math.pow(compPriceRatio, xed);
        quantityChangePercent = ((rawNewUnitsSold - state.baseline.currentUnitsSold) / state.baseline.currentUnitsSold) * 100;
    }

    const newUnitsSold = Math.max(0, rawNewUnitsSold); 
    
    // Volume Discounts Calculation
    let currentVariableCost = state.baseline.variableCostsPerUnit;
    if (enableDiscounts && quantityChangePercent > 0) {
        const discountTiers = Math.floor(quantityChangePercent / 10);
        // max discount of 50% for sanity
        const discountFactor = Math.max(0.5, 1 - (0.02 * discountTiers));
        currentVariableCost = currentVariableCost * discountFactor;
    }

    const newTotalRevenue = newPrice * newUnitsSold;
    const newTotalCosts = state.baseline.fixedCosts + (currentVariableCost * newUnitsSold);
    const newProjectedProfit = newTotalRevenue - newTotalCosts;

    const contributionMarginPerUnit = newPrice - currentVariableCost;
    const breakEvenVolume = contributionMarginPerUnit > 0 ? state.baseline.fixedCosts / contributionMarginPerUnit : 0;
    const grossMarginPercent = newTotalRevenue > 0 ? ((newTotalRevenue - currentVariableCost * newUnitsSold) / newTotalRevenue) * 100 : 0;

    return {
        newPrice,
        newUnitsSold,
        newTotalRevenue,
        newTotalCosts,
        newProjectedProfit,
        contributionMarginPerUnit,
        breakEvenVolume,
        grossMarginPercent,
        ped,
        priceChangePercent,
        currentVariableCost
    };
}

function runMonteCarlo(ped, priceChangePercent, xed = 0, compPriceChangePercent = 0, enableDiscounts = false, demandCurveType = 'linear', iterations = 1000) {
    if (!state.baseline) return null;

    let profits = [];
    
    for (let i = 0; i < iterations; i++) {
        // PED variance ± 20%
        const randomMultiplier = 0.8 + (Math.random() * 0.4);
        const variedPed = ped * randomMultiplier;
        
        const vals = calculateSimulationValues(variedPed, priceChangePercent, xed, compPriceChangePercent, enableDiscounts, demandCurveType);
        if (vals) {
            profits.push(vals.newProjectedProfit);
        }
    }

    profits.sort((a, b) => a - b);
    
    // 5th percentile (Worst Case)
    const worstCase = profits[Math.floor(iterations * 0.05)];
    // Median (Expected)
    const expected = profits[Math.floor(iterations * 0.50)];
    // 95th percentile (Best Case)
    const bestCase = profits[Math.floor(iterations * 0.95)];

    return {
        worstCase,
        expected,
        bestCase
    };
}

function findOptimalPriceChange(ped, xed = 0, compPriceChangePercent = 0, enableDiscounts = false, demandCurveType = 'linear') {
    if (!state.baseline) return 0;
    
    let maxProfit = -Infinity;
    let optimalPercentage = 0;

    for (let percent = -99; percent <= 100; percent++) {
        const vals = calculateSimulationValues(ped, percent, xed, compPriceChangePercent, enableDiscounts, demandCurveType);
        if (vals && vals.newProjectedProfit > maxProfit) {
            maxProfit = vals.newProjectedProfit;
            optimalPercentage = percent;
        }
    }
    return optimalPercentage;
}




function getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const style = getComputedStyle(document.body);
    return {
        textMain: style.getPropertyValue('--text-main').trim(),
        gridColor: style.getPropertyValue('--chart-grid-color').trim(),
        profitLine: isDark ? '#38bdf8' : '#0ea5e9',
        revenueLine: isDark ? '#a78bfa' : '#8b5cf6'
    };
}

function updateChartTheme() {
    if (!state.profitChartInstance) return;
    const colors = getThemeColors();
    const chart = state.profitChartInstance;
    chart.options.color = colors.textMain;
    Object.values(chart.options.scales).forEach(sc => {
        sc.title = sc.title || {};
        sc.title.color = colors.textMain;
    });
    
    state.profitChartInstance.options.scales.x.grid.color = colors.gridColor;
    state.profitChartInstance.options.scales.x.ticks.color = colors.textMain;
    
    state.profitChartInstance.options.scales.yProfit.grid.color = colors.gridColor;
    state.profitChartInstance.options.scales.yProfit.ticks.color = colors.textMain;
    
    state.profitChartInstance.options.scales.yRevenue.ticks.color = colors.textMain;

    state.profitChartInstance.data.datasets[0].borderColor = colors.profitLine; 
    state.profitChartInstance.data.datasets[0].backgroundColor = colors.profitLine + '33'; 
    
    state.profitChartInstance.data.datasets[1].borderColor = colors.revenueLine; 
    
    state.profitChartInstance.data.datasets[2].backgroundColor = colors.textMain; 
    state.profitChartInstance.data.datasets[2].borderColor = colors.textMain;
    
    state.profitChartInstance.data.datasets[3].backgroundColor = colors.textMain; 
    state.profitChartInstance.data.datasets[3].borderColor = colors.textMain;

    state.profitChartInstance.update();
}

function plotComparison(s1, s2) {
    const chart = state.profitChartInstance;
    if (!chart) return;
    clearComparison(true);
    [[s1, 'Scenario 1', '#10b981'], [s2, 'Scenario 2', '#f59e0b']].forEach(([sc, name, color]) => {
        chart.data.datasets.push({
            label: `Compare: ${name} Profit`,
            isComparison: true,
            data: [{ x: sc.priceChangePercent, y: sc.projectedProfit }],
            backgroundColor: color,
            borderColor: '#ffffff',
            borderWidth: 3,
            pointRadius: 8,
            pointHoverRadius: 10,
            showLine: false,
            yAxisID: 'yProfit'
        });
    });
    chart.update();
}

function clearComparison(silent) {
    const chart = state.profitChartInstance;
    if (!chart) return;
    chart.data.datasets = chart.data.datasets.filter(d => !d.isComparison);
    if (!silent) chart.update();
}

function renderChart(profitPoints, revenuePoints) {
    const ctx = document.getElementById('profitChart').getContext('2d');
    
    if (state.profitChartInstance) {
        const ds = state.profitChartInstance.data.datasets;
        ds[0].data = profitPoints;
        ds[1].data = revenuePoints;
        state.profitChartInstance.update('none');
        return;
    }

    state.profitChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: `Projected Profit`,
                data: profitPoints,
                borderColor: '#0ea5e9',
                backgroundColor: 'rgba(14, 165, 233, 0.1)',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: true,
                tension: 0.4,
                yAxisID: 'yProfit'
            }, {
                label: `Total Revenue`,
                data: revenuePoints,
                borderColor: '#8b5cf6',
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: false,
                tension: 0.4,
                yAxisID: 'yRevenue'
            }, {
                label: 'Current Profit',
                data: [], 
                backgroundColor: '#0f172a',
                borderColor: '#ffffff',
                borderWidth: 3,
                pointRadius: 8,
                pointHoverRadius: 10,
                showLine: false,
                yAxisID: 'yProfit'
            }, {
                label: 'Current Revenue',
                data: [], 
                backgroundColor: '#8b5cf6',
                borderColor: '#ffffff',
                borderWidth: 3,
                pointRadius: 6,
                pointHoverRadius: 8,
                showLine: false,
                yAxisID: 'yRevenue'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        filter: function(item) {
                            return !item.text.includes('Current');
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                },
                annotation: {
                    annotations: {
                        line1: {
                            type: 'line',
                            xMin: 0,
                            xMax: 0,
                            borderColor: 'rgba(255, 99, 132, 0.5)',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                content: 'Baseline',
                                display: true,
                                position: 'start',
                                backgroundColor: 'rgba(255, 99, 132, 0.8)',
                                color: 'white',
                                font: {
                                    size: 10
                                }
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Proposed Price Change (%)'
                    },
                    min: -100,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                },
                yProfit: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: `Profit`
                    },
                    ticks: {
                        callback: function(value) {
                            if (Math.abs(value) >= 1e6) {
                                return (value / 1e6).toFixed(1) + 'M';
                            }
                            if (Math.abs(value) >= 1e3) {
                                return (value / 1e3).toFixed(1) + 'k';
                            }
                            return value;
                        }
                    }
                },
                yRevenue: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: `Revenue`
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                    ticks: {
                        callback: function(value) {
                            if (Math.abs(value) >= 1e6) {
                                return (value / 1e6).toFixed(1) + 'M';
                            }
                            if (Math.abs(value) >= 1e3) {
                                return (value / 1e3).toFixed(1) + 'k';
                            }
                            return value;
                        }
                    }
                }
            }
        }
    });
    updateChartTheme(); 
}

function generateChartData(ped, xed = 0, compPriceChangePercent = 0, enableDiscounts = false, demandCurveType = 'linear') {
    
        if (!state.baseline) return;

        const profitPoints = [];
        const revenuePoints = [];

        for (let percent = -99; percent <= 100; percent++) {
            const vals = calculateSimulationValues(ped, percent, xed, compPriceChangePercent, enableDiscounts, demandCurveType);
            if(vals) {
                profitPoints.push({ x: percent, y: vals.newProjectedProfit });
                revenuePoints.push({ x: percent, y: vals.newTotalRevenue });
            }
        }

        renderChart(profitPoints, revenuePoints);
}

function updateChartDot(percent, profit, revenue) {
    if (!state.profitChartInstance) return;
    state.profitChartInstance.data.datasets[2].data = [{ x: percent, y: profit }];
    state.profitChartInstance.data.datasets[3].data = [{ x: percent, y: revenue }];
    state.profitChartInstance.update('none'); 
}






document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const themeSwitch = document.getElementById('theme-switch');
    const themeLabel = document.getElementById('theme-label');
    const currencySelect = document.getElementById('currency-select');
    const calculateBtn = document.getElementById('calculate-btn');
    const pedInput = document.getElementById('ped');
    const xedInput = document.getElementById('xed');
    const compPriceChangeInput = document.getElementById('comp-price-change');
    const volumeDiscountsCheckbox = document.getElementById('volume-discounts');
    const demandCurveSelect = document.getElementById('demand-curve-type');
    const priceChangeInput = document.getElementById('price-change');
    const priceChangeDisplay = document.getElementById('price-change-display');
    const kpiContainer = document.getElementById('kpi-container');
    const maximizeBtn = document.getElementById('maximize-btn');
    const saveScenarioBtn = document.getElementById('save-scenario-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const compareBtn = document.getElementById('compare-btn');
    const runMonteCarloBtn = document.getElementById('run-monte-carlo-btn');

    // Tippy initialization for tooltips
    if (window.tippy) {
        tippy('[data-tippy-content]', {
            animation: 'scale',
            theme: 'light-border',
        });
    }

    // Theme initialization
    if (state.theme) {
        document.documentElement.setAttribute('data-theme', state.theme);
        if (state.theme === 'dark') {
            themeSwitch.checked = true;
            themeLabel.textContent = 'Dark Mode';
        }
    }

    function getSimulationInputs() {
        return {
            ped: parseFloat(pedInput.value),
            xed: parseFloat(xedInput.value) || 0,
            compPriceChange: parseFloat(compPriceChangeInput.value) || 0,
            volumeDiscounts: volumeDiscountsCheckbox.checked,
            demandCurveType: demandCurveSelect.value
        };
    }

    // Event Delegation for parent container instead of individual inputs where applicable
    document.querySelector('.dashboard-grid').addEventListener('input', (e) => {
        const simInputs = ['ped', 'xed', 'comp-price-change', 'volume-discounts', 'demand-curve-type'];
        if (simInputs.includes(e.target.id)) {
            if(state.baseline) {
               const { ped, xed, compPriceChange, volumeDiscounts, demandCurveType } = getSimulationInputs();
               generateChartData(ped, xed, compPriceChange, volumeDiscounts, demandCurveType);
               calculateSimulation();
            }
        } else if (e.target.id === 'price-change') {
            calculateSimulation();
        } else if (e.target.id === 'currency-select') {
             state.currentCurrency = e.target.value;
             persist();
             if (state.baseline) {
                 if (state.profitChartInstance) {
                     state.profitChartInstance.options.scales.yProfit.title.text = `Profit (${state.currentCurrency})`;
                     state.profitChartInstance.options.scales.yRevenue.title.text = `Revenue (${state.currentCurrency})`;
                     state.profitChartInstance.update('none');
                 }
                 calculateSimulation();
                 renderScenarioTable(formatCurrency);
             }
        }
    });
    
    // Kept calculate btn separate since it's a click not input
    calculateBtn.addEventListener('click', () => {
        if (!sanitizeInputs()) return;

        const fixedCosts = parseFloat(document.getElementById('fixed-costs').value);
        const variableCostsPerUnit = parseFloat(document.getElementById('variable-costs').value);
        const currentSellingPrice = parseFloat(document.getElementById('selling-price').value);
        const currentUnitsSold = parseInt(document.getElementById('units-sold').value, 10);

        if (isNaN(fixedCosts) || isNaN(variableCostsPerUnit) || isNaN(currentSellingPrice) || isNaN(currentUnitsSold)) return;
        
        // Show skeletons
        kpiContainer.innerHTML = Array(8).fill('<div class="skeleton-kpi"></div>').join('');
        document.getElementById('simulation-controls').classList.remove('hidden');
        document.getElementById('insights-section').classList.remove('hidden');
        document.getElementById('scenario-history-section').classList.remove('hidden');

        const prevBaseline = state.baseline;
        state.baseline = calculateBaseline(fixedCosts, variableCostsPerUnit, currentSellingPrice, currentUnitsSold);
        if (prevBaseline && prevBaseline.baselineProfit !== state.baseline.baselineProfit && state.scenarioHistory.length) {
            state.scenarioHistory = [];
            renderScenarioTable(formatCurrency);
            clearComparison();
            showToast('Baseline changed. Scenario history cleared.');
        }
        persist();

        calculateBtn.textContent = 'Recalculate Baseline';

        // Init chart axes titles
        setTimeout(() => {
            if (state.profitChartInstance) {
                 state.profitChartInstance.options.scales.yProfit.title.text = `Profit (${state.currentCurrency})`;
                 state.profitChartInstance.options.scales.yRevenue.title.text = `Revenue (${state.currentCurrency})`;
            }
        }, 0);

        const { ped, xed, compPriceChange, volumeDiscounts, demandCurveType } = getSimulationInputs();
        generateChartData(ped, xed, compPriceChange, volumeDiscounts, demandCurveType);
        calculateSimulation();
    });

    themeSwitch.addEventListener('change', function(e) {
        if (e.target.checked) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            themeLabel.textContent = 'Dark Mode';
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
            themeLabel.textContent = 'Light Mode';
        }
        updateChartTheme();
    });

    // Main calculation binding
    function calculateSimulation() {
        if (!state.baseline) return;

        const { ped, xed, compPriceChange, volumeDiscounts, demandCurveType } = getSimulationInputs();
        const priceChangePercent = parseFloat(priceChangeInput.value);
        
        priceChangeDisplay.textContent = `${priceChangePercent > 0 ? '+' : ''}${priceChangePercent}%`;

        const vals = calculateSimulationValues(ped, priceChangePercent, xed, compPriceChange, volumeDiscounts, demandCurveType);
        if(!vals) return;

        let profitClass = '';
        if (vals.newProjectedProfit > state.baseline.baselineProfit) {
            profitClass = 'profit-positive';
        } else if (vals.newProjectedProfit < state.baseline.baselineProfit) {
            profitClass = 'profit-negative';
        }

        kpiContainer.innerHTML = `
            <div class="kpi-card">
                <h4>New Price</h4>
                <p>${formatCurrency(vals.newPrice)}</p>
            </div>
            <div class="kpi-card">
                <h4>New Units Sold</h4>
                <p>${Math.round(vals.newUnitsSold).toLocaleString()}</p>
            </div>
            <div class="kpi-card">
                <h4>New Total Revenue</h4>
                <p>${formatCurrency(vals.newTotalRevenue)}</p>
            </div>
            <div class="kpi-card">
                <h4>New Total Costs</h4>
                <p>${formatCurrency(vals.newTotalCosts)}</p>
            </div>
            <div class="kpi-card">
                <h4>New Projected Profit</h4>
                <p class="${profitClass}">${formatCurrency(vals.newProjectedProfit)}</p>
            </div>
            <div class="kpi-card">
                <h4>Contr. Margin/Unit</h4>
                <p>${formatCurrency(vals.contributionMarginPerUnit)}</p>
            </div>
            <div class="kpi-card">
                <h4>Break-Even Volume</h4>
                <p>${vals.contributionMarginPerUnit <= 0 ? 'N/A' : Math.ceil(vals.breakEvenVolume).toLocaleString()}</p>
            </div>
            <div class="kpi-card">
                <h4>Gross Margin %</h4>
                <p>${vals.grossMarginPercent.toFixed(1)}%</p>
            </div>
        `;

        updateChartDot(priceChangePercent, vals.newProjectedProfit, vals.newTotalRevenue);

        state.currentSimulationState = {
            ped: ped,
            xed, compPriceChange, volumeDiscounts, demandCurveType,
            priceChangePercent: priceChangePercent,
            newPrice: vals.newPrice,
            volume: vals.newUnitsSold,
            grossMarginPercent: vals.grossMarginPercent,
            projectedProfit: vals.newProjectedProfit
        };
    }

    maximizeBtn.addEventListener('click', () => {
        const { ped, xed, compPriceChange, volumeDiscounts, demandCurveType } = getSimulationInputs();
        const optimal = findOptimalPriceChange(ped, xed, compPriceChange, volumeDiscounts, demandCurveType);
        priceChangeInput.value = optimal;
        if (optimal <= -99 || optimal >= 100) {
            showToast('The optimum sits at the edge of the range. Check your PED and costs.');
        }
        priceChangeInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    saveScenarioBtn.addEventListener('click', () => {
        if (!state.currentSimulationState) return;
        
        const timestamp = new Date().toLocaleString();
        state.scenarioHistory.push({
            timestamp,
            ...state.currentSimulationState
        });
        renderScenarioTable(formatCurrency);
        persist();
        showToast("Scenario Saved Successfully");
    });

    clearHistoryBtn.addEventListener('click', () => {
        state.scenarioHistory = [];
        renderScenarioTable(formatCurrency);
        clearComparison();
        persist();
    });
    
    compareBtn.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.scenario-checkbox:checked');
        if (checkboxes.length !== 2) {
            showToast("Please select exactly two scenarios to compare.");
            return;
        }
        
        const idx1 = parseInt(checkboxes[0].getAttribute('data-index'), 10);
        const idx2 = parseInt(checkboxes[1].getAttribute('data-index'), 10);
        
        plotComparison(state.scenarioHistory[idx1], state.scenarioHistory[idx2]);
        showToast("Comparison plotted on chart.");
    });
    
    runMonteCarloBtn.addEventListener('click', () => {
        const { ped, xed, compPriceChange, volumeDiscounts, demandCurveType } = getSimulationInputs();
        const priceChangePercent = parseFloat(priceChangeInput.value);
        const results = runMonteCarlo(ped, priceChangePercent, xed, compPriceChange, volumeDiscounts, demandCurveType);
        
        if (results) {
            document.getElementById('mc-worst').textContent = formatCurrency(results.worstCase);
            document.getElementById('mc-expected').textContent = formatCurrency(results.expected);
            document.getElementById('mc-best').textContent = formatCurrency(results.bestCase);
            document.getElementById('monte-carlo-results').classList.remove('hidden');
        }
    });

    exportCsvBtn.addEventListener('click', () => {
        if (state.scenarioHistory.length === 0) {
            showToast('No scenarios to export. Please save a scenario first.');
            return;
        }

        const headers = ['Timestamp', 'PED', 'Price Change (%)', `New Price (${state.currentCurrency})`, 'Volume', 'Gross Margin (%)', `Projected Profit (${state.currentCurrency})`];
        const csvRows = [];
        csvRows.push(headers.join(','));

        state.scenarioHistory.forEach(scenario => {
            const row = [
                `"${scenario.timestamp}"`,
                scenario.ped,
                scenario.priceChangePercent,
                scenario.newPrice.toFixed(2),
                Math.round(scenario.volume),
                scenario.grossMarginPercent.toFixed(1),
                scenario.projectedProfit.toFixed(2)
            ];
            csvRows.push(row.join(','));
        });

        const download = (name, blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = name;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        };
        download('pricing_scenarios.csv', new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' }));
        const jsonPayload = JSON.stringify({
            currency: state.currentCurrency,
            baseline: state.baseline,
            scenarios: state.scenarioHistory
        }, null, 2);
        setTimeout(() => download('pricing_payload.json', new Blob([jsonPayload], { type: 'application/json' })), 500);
        showToast('CSV and JSON exported');
    });
    
    exportPdfBtn.addEventListener('click', async () => {
        if (!state.baseline || !state.currentSimulationState) {
            showToast('Please run a simulation before exporting to PDF.');
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(20);
        doc.text("Executive Summary: Pricing Strategy", 15, 20);
        
        doc.setFontSize(12);
        doc.text(`Baseline Profit: ${formatCurrency(state.baseline.baselineProfit)}`, 15, 35);
        doc.text(`Projected Profit: ${formatCurrency(state.currentSimulationState.projectedProfit)}`, 15, 45);
        doc.text(`Price Change: ${state.currentSimulationState.priceChangePercent}%`, 15, 55);
        doc.text(`PED: ${state.currentSimulationState.ped.toFixed(2)}`, 15, 65);
        
        // Add chart image
        if (state.profitChartInstance) {
            const canvas = document.getElementById('profitChart');
            const flat = document.createElement('canvas');
            flat.width = canvas.width;
            flat.height = canvas.height;
            const fctx = flat.getContext('2d');
            fctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--kpi-bg').trim() || '#ffffff';
            fctx.fillRect(0, 0, flat.width, flat.height);
            fctx.drawImage(canvas, 0, 0);
            const imgData = flat.toDataURL('image/png', 1.0);
            doc.addImage(imgData, 'PNG', 15, 80, 180, 180 * flat.height / flat.width);
        }
        
        doc.save("executive_summary.pdf");
        showToast("PDF Exported");
    });

    document.getElementById('scenario-table-body').addEventListener('click', (e) => {
        const btn = e.target.closest('.load-btn');
        if (!btn) return;
        const sc = state.scenarioHistory[parseInt(btn.dataset.index, 10)];
        if (!sc) return;
        pedInput.value = sc.ped;
        xedInput.value = sc.xed ?? 0;
        compPriceChangeInput.value = sc.compPriceChange ?? 0;
        volumeDiscountsCheckbox.checked = !!sc.volumeDiscounts;
        demandCurveSelect.value = sc.demandCurveType || 'linear';
        priceChangeInput.value = sc.priceChangePercent;
        pedInput.dispatchEvent(new Event('input', { bubbles: true }));
        showToast('Scenario loaded.');
    });

    // Restore saved session
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if (saved) {
            state.currentCurrency = saved.currency || '$';
            currencySelect.value = state.currentCurrency;
            Object.entries(saved.inputs || {}).forEach(([id, v]) => {
                const el = document.getElementById(id);
                if (el) el.value = v;
            });
            state.scenarioHistory = Array.isArray(saved.history) ? saved.history : [];
            if (saved.hasBaseline) calculateBtn.click();
            renderScenarioTable(formatCurrency);
        }
    } catch (e) { /* ignore corrupt saved data */ }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 'm') {
            e.preventDefault();
            if (maximizeBtn && !maximizeBtn.closest('.hidden')) maximizeBtn.click();
        }
        if (e.altKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            if (saveScenarioBtn && !saveScenarioBtn.closest('.hidden')) saveScenarioBtn.click();
        }
    });
    
});

})();
