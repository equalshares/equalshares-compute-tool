// Visualizations of the computed outcome: summary tiles, budget allocation bar,
// votes-vs-cost scatter plot, spending by category, payments per supporter,
// leftover voter budgets, utility chart, and a comparison with the greedy method.
// All charts use the echarts library (loaded globally before displayResults is called).

const COLOR_BLUE = 'rgb(75, 159, 201)';
const COLOR_DARKBLUE = 'rgb(54, 54, 123)';
const COLOR_GREEN = 'hsl(144, 42%, 45%)';
const COLOR_TEAL = 'rgb(100, 167, 130)';
const COLOR_GRAY = '#bbbbbb';
const CHART_FONT = { fontFamily: 'Roboto', fontSize: 14 };

function showNumber(value) {
    return parseFloat(value).toLocaleString();
}

function showMoney(value, instance) {
    let str = parseFloat(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (instance && instance.meta.currency) {
        str += ' ' + instance.meta.currency;
    }
    return str;
}

function showPercent(fraction) {
    return (100 * fraction).toLocaleString(undefined, { maximumFractionDigits: 1 }) + '%';
}

function truncate(text, maxLength = 50) {
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text;
}

function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

function compactNumber(value) {
    if (Math.abs(value) >= 1e6) return (value / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'M';
    if (Math.abs(value) >= 1e3) return (value / 1e3).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'k';
    return value.toLocaleString();
}

function makeChartContainer(parent, height) {
    const div = document.createElement('div');
    div.style.width = '100%';
    div.style.height = `${height}px`;
    parent.appendChild(div);
    return div;
}

function initChart(container) {
    const chart = echarts.init(container, null, { renderer: 'svg' });
    window.addEventListener('resize', () => chart.resize());
    return chart;
}

// used for the vertical bar charts to avoid labels overflowing narrow bars
const myLabelLayout = function (params) {
    if (params.labelRect.width > params.rect.width - 5) {
        return { x: params.labelRect.x + params.rect.width, y: params.labelRect.y };
    }
}

////////////////////////////////////////////
///////////  summary stat tiles  ///////////
////////////////////////////////////////////

export function buildSummaryTiles(parent, instance, winners, notes) {
    const stats = notes.stats;
    const B = parseFloat(instance.meta.budget);
    const numVoters = stats.numVoters || Object.keys(instance.votes).length;
    const numProjects = Object.keys(instance.projects).length;
    const covered = stats.numVotersCovered !== undefined ?
        stats.numVotersCovered : numVoters - (stats.utilityDistribution[0] || 0);

    const tiles = [
        { value: showNumber(winners.length), label: `winning projects, out of ${showNumber(numProjects)} proposed` },
        { value: showPercent(stats.totalCost / B), label: `of the budget is used (${showMoney(stats.totalCost, instance)} of ${showMoney(B, instance)})` },
        { value: showPercent(covered / numVoters), label: `of voters get at least one project they voted for (${showNumber(covered)} of ${showNumber(numVoters)} voters)` },
        { value: stats.avgApprovedProjects.toFixed(1), label: `winning projects were approved by the average voter` },
    ];

    const tilesDiv = document.createElement('div');
    tilesDiv.className = 'stat-tiles';
    for (const tile of tiles) {
        const tileDiv = document.createElement('div');
        tileDiv.className = 'stat-tile';
        const valueDiv = document.createElement('div');
        valueDiv.className = 'stat-value';
        valueDiv.textContent = tile.value;
        const labelDiv = document.createElement('div');
        labelDiv.className = 'stat-label';
        labelDiv.textContent = tile.label;
        tileDiv.appendChild(valueDiv);
        tileDiv.appendChild(labelDiv);
        tilesDiv.appendChild(tileDiv);
    }
    parent.appendChild(tilesDiv);
}

////////////////////////////////////////////
/////////  budget allocation bar  //////////
////////////////////////////////////////////

export function buildBudgetBar(parent, instance, winners, notes) {
    const B = parseFloat(instance.meta.budget);
    const sorted = [...winners].sort((a, b) => parseFloat(instance.projects[b].cost) - parseFloat(instance.projects[a].cost));
    const totalCost = notes.stats.totalCost;
    const palette = [COLOR_BLUE, COLOR_DARKBLUE, COLOR_TEAL];

    const container = makeChartContainer(parent, 110);
    const chart = initChart(container);

    const series = sorted.map((c, idx) => ({
        name: instance.projects[c].name,
        type: 'bar',
        stack: 'budget',
        barWidth: 45,
        data: [parseFloat(instance.projects[c].cost)],
        itemStyle: { color: palette[idx % palette.length], borderColor: '#fff', borderWidth: 0.5 },
    }));
    series.push({
        name: 'Unspent budget',
        type: 'bar',
        stack: 'budget',
        barWidth: 45,
        data: [Math.max(0, B - totalCost)],
        itemStyle: { color: '#dddddd' },
    });

    chart.setOption({
        animation: false,
        grid: { left: 5, right: 15, top: 10, bottom: 25, containLabel: true },
        xAxis: {
            type: 'value',
            max: B,
            axisLabel: { formatter: compactNumber, color: '#000' },
        },
        yAxis: { type: 'category', data: [''], show: false },
        textStyle: CHART_FONT,
        tooltip: {
            trigger: 'item',
            confine: true,
            formatter: (params) => {
                const value = params.value;
                return `<b>${escapeHTML(truncate(params.seriesName, 80))}</b><br>` +
                    `${showMoney(value, instance)} (${showPercent(value / B)} of the budget)`;
            },
        },
        toolbox: { show: true, feature: { saveAsImage: {} } },
        series: series,
    });
}

////////////////////////////////////////////
////////  votes vs. cost scatter  //////////
////////////////////////////////////////////

export function buildCostVotesScatter(parent, instance, winners, notes) {
    const completionSet = new Set(notes.addedByUtlitarianCompletion || []);
    const winnersSet = new Set(winners);
    const mesData = [];
    const completionData = [];
    const loserData = [];
    let allCostsPositive = true;
    let minCost = Infinity, maxCost = 0;
    for (const c of Object.keys(instance.projects)) {
        const cost = parseFloat(instance.projects[c].cost);
        const votes = instance.approvers[c].length;
        if (cost <= 0) allCostsPositive = false;
        minCost = Math.min(minCost, cost);
        maxCost = Math.max(maxCost, cost);
        const point = [votes, cost, c];
        if (completionSet.has(c)) {
            completionData.push(point);
        } else if (winnersSet.has(c)) {
            mesData.push(point);
        } else {
            loserData.push(point);
        }
    }
    const useLogScale = allCostsPositive && minCost > 0 && maxCost / minCost > 50;

    const container = makeChartContainer(parent, 420);
    const chart = initChart(container);
    const tooltipFormatter = (params) => {
        const c = params.data[2];
        const project = instance.projects[c];
        return `<b>${escapeHTML(truncate(project.name, 80))}</b><br>` +
            `${showNumber(params.data[0])} votes, cost ${showMoney(params.data[1], instance)}`;
    };
    const series = [
        {
            name: 'Selected by Equal Shares',
            type: 'scatter',
            data: mesData,
            itemStyle: { color: COLOR_BLUE },
            symbolSize: 10,
        },
        {
            name: 'Not funded',
            type: 'scatter',
            data: loserData,
            itemStyle: { color: COLOR_GRAY },
            symbolSize: 8,
        },
    ];
    if (completionData.length > 0) {
        series.splice(1, 0, {
            name: 'Added by completion',
            type: 'scatter',
            data: completionData,
            itemStyle: { color: COLOR_GREEN },
            symbolSize: 10,
        });
    }
    chart.setOption({
        animation: false,
        grid: { left: 10, right: 30, top: 40, bottom: 30, containLabel: true },
        legend: { top: 5, textStyle: CHART_FONT },
        xAxis: {
            type: 'value',
            name: 'votes',
            nameLocation: 'middle',
            nameGap: 28,
            axisLabel: { formatter: compactNumber, color: '#000' },
        },
        yAxis: {
            type: useLogScale ? 'log' : 'value',
            name: 'cost' + (useLogScale ? ' (log scale)' : ''),
            axisLabel: { formatter: compactNumber, color: '#000' },
        },
        textStyle: CHART_FONT,
        tooltip: { trigger: 'item', confine: true, formatter: tooltipFormatter },
        toolbox: { show: true, feature: { saveAsImage: {} } },
        series: series,
    });
}

////////////////////////////////////////////
////////  spending by category  ////////////
////////////////////////////////////////////

export function hasCategories(instance, winners) {
    return winners.some(c => instance.projects[c].category && instance.projects[c].category.trim() !== '');
}

export function buildCategoryChart(parent, instance, winners) {
    // spending per category; the cost of a project with several categories is
    // split equally between them, so that the total matches the amount spent
    const spendPerCategory = {};
    const countPerCategory = {};
    for (const c of winners) {
        const project = instance.projects[c];
        if (!project.category || project.category.trim() === '') continue;
        const categories = project.category.split(',').map(x => x.trim()).filter(x => x !== '');
        for (const cat of categories) {
            spendPerCategory[cat] = (spendPerCategory[cat] || 0) + parseFloat(project.cost) / categories.length;
            countPerCategory[cat] = (countPerCategory[cat] || 0) + 1;
        }
    }
    const data = Object.keys(spendPerCategory)
        .sort((a, b) => spendPerCategory[b] - spendPerCategory[a])
        .map(cat => ({ name: cat, value: Math.round(spendPerCategory[cat] * 100) / 100 }));

    const p = document.createElement('p');
    p.className = 'chart-note';
    p.textContent = 'How the money is distributed over project categories. The cost of a project belonging to several categories is split equally between its categories.';
    parent.appendChild(p);

    const container = makeChartContainer(parent, 400);
    const chart = initChart(container);
    chart.setOption({
        animation: false,
        textStyle: CHART_FONT,
        tooltip: {
            trigger: 'item',
            confine: true,
            formatter: (params) =>
                `<b>${escapeHTML(params.name)}</b><br>${showMoney(params.value, instance)} (${params.percent}%)<br>` +
                `${countPerCategory[params.name]} winning project${countPerCategory[params.name] === 1 ? '' : 's'}`,
        },
        toolbox: { show: true, feature: { saveAsImage: {} } },
        series: [{
            type: 'pie',
            radius: ['35%', '65%'],
            data: data,
            label: { color: '#000', formatter: '{b}\n{d}%' },
        }],
    });
}

////////////////////////////////////////////
//////  payments per supporter chart  //////
////////////////////////////////////////////

export function buildPaymentChart(parent, instance, notes) {
    const rounds = notes.rounds || [];
    if (rounds.length === 0) {
        const p = document.createElement('p');
        p.textContent = 'No projects were selected by the Method of Equal Shares.';
        parent.appendChild(p);
        return;
    }

    const p = document.createElement('p');
    p.className = 'chart-note';
    p.innerHTML = `Each winning project is paid for by its supporters, out of their budget shares of
        ${showMoney(notes.endowment, instance)} each. The cost is split as equally as possible.
        The bars show the highest amount that a supporter paid for each project (supporters with less money
        left contributed their entire remaining share). Projects are listed in the order of selection.`;
    parent.appendChild(p);

    const names = rounds.map((r, idx) => `${idx + 1}. ${truncate(instance.projects[r.project].name, 45)}`);
    const payments = rounds.map(r => Math.round(r.maxPayment * 100) / 100);

    const container = makeChartContainer(parent, rounds.length * 26 + 60);
    const chart = initChart(container);
    chart.setOption({
        animation: false,
        grid: { left: 10, right: 105, top: 10, bottom: 30, containLabel: true },
        xAxis: {
            type: 'value',
            name: 'per supporter',
            nameGap: 8,
            axisLabel: { formatter: compactNumber, color: '#000' },
        },
        yAxis: {
            type: 'category',
            data: names,
            inverse: true,
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: '#000' },
        },
        textStyle: CHART_FONT,
        tooltip: {
            trigger: 'item',
            confine: true,
            formatter: (params) => {
                const r = rounds[params.dataIndex];
                const project = instance.projects[r.project];
                return `<b>${escapeHTML(truncate(project.name, 80))}</b><br>` +
                    `Cost: ${showMoney(project.cost, instance)}<br>` +
                    `Effective votes at selection: ${r.effVoteCount.toFixed(1)}<br>` +
                    `Highest payment per supporter: ${showMoney(r.maxPayment, instance)}<br>` +
                    `${showNumber(r.numPaidFull)} supporters paid this amount,<br>` +
                    `${showNumber(r.numPaidPartial)} paid their entire remaining share`;
            },
        },
        toolbox: { show: true, feature: { saveAsImage: {} } },
        series: [{
            type: 'bar',
            data: payments,
            label: {
                show: true,
                color: '#fff',
                position: 'insideLeft',
                formatter: (params) => showNumber(params.value),
            },
            labelLayout: myLabelLayout,
        }],
        color: COLOR_BLUE,
    });
}

////////////////////////////////////////////
////  leftover voter budget histogram  /////
////////////////////////////////////////////

export function buildLeftoverHistogram(parent, instance, notes) {
    const fb = notes.finalVoterBudgets;
    if (!fb) return;

    const p = document.createElement('p');
    p.className = 'chart-note';
    p.innerHTML = `Each voter was assigned a budget share of ${showMoney(fb.endowment, instance)},
        which was virtually spent on the projects the voter approved.
        <b>${showNumber(fb.numExhausted)}</b> of ${showNumber(fb.numVoters)} voters
        (${showPercent(fb.numExhausted / fb.numVoters)}) spent their entire share.
        On average, ${showMoney(fb.totalRemaining / fb.numVoters, instance)} per voter remained unspent.
        The histogram shows how much money voters had left at the end of the computation.`;
    parent.appendChild(p);

    const binLabels = [];
    for (let i = 0; i < fb.numBins; i++) {
        const lo = (i / fb.numBins) * fb.endowment;
        const hi = ((i + 1) / fb.numBins) * fb.endowment;
        binLabels.push(`${compactNumber(Math.round(lo * 100) / 100)}–${compactNumber(Math.round(hi * 100) / 100)}`);
    }

    const container = makeChartContainer(parent, 300);
    const chart = initChart(container);
    chart.setOption({
        animation: false,
        grid: { left: 10, right: 20, top: 25, bottom: 45, containLabel: true },
        xAxis: {
            type: 'category',
            data: binLabels,
            name: 'money left',
            nameLocation: 'middle',
            nameGap: 45,
            axisLabel: { color: '#000', rotate: 45, fontSize: 11 },
        },
        yAxis: {
            type: 'value',
            name: 'voters',
            axisLabel: { formatter: compactNumber, color: '#000' },
        },
        textStyle: CHART_FONT,
        tooltip: {
            trigger: 'item',
            confine: true,
            formatter: (params) =>
                `${showNumber(params.value)} voters (${showPercent(params.value / fb.numVoters)})<br>` +
                `have between ${params.name.replace('–', ' and ')} ${instance.meta.currency || ''} left`,
        },
        toolbox: { show: true, feature: { saveAsImage: {} } },
        series: [{ type: 'bar', data: fb.counts, barCategoryGap: '10%' }],
        color: COLOR_BLUE,
    });
}

////////////////////////////////////////////
/////////////  utility chart  //////////////
////////////////////////////////////////////

export function buildUtilityChart(parent, instance, notes) {
    const utilityDistribution = notes.stats.utilityDistribution;
    const numVoters = Object.values(utilityDistribution).reduce((a, b) => a + b, 0);
    const cutoff = numVoters * 0.95;
    let votersSoFar = 0;
    let utilityDescriptors = [];
    let utilities = [];
    for (let util in utilityDistribution) {
        votersSoFar += utilityDistribution[util];
        utilityDescriptors.push(util);
        utilities.push(utilityDistribution[util]);
        if (votersSoFar == numVoters) {
            break;
        } else if (votersSoFar > cutoff) {
            const remaining = numVoters - votersSoFar;
            utilityDescriptors.push(`${parseInt(util) + 1}+`);
            utilities.push(remaining);
            break;
        }
    }

    const container = makeChartContainer(parent, utilities.length * 30);
    const chart = initChart(container);
    const option = {
        yAxis: {
            data: utilityDescriptors,
            inverse: true,
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { align: 'left', color: '#000' },
            offset: 40
        },
        xAxis: { show: false },
        grid: {
            left: 50,
            top: 0,
            bottom: 0,
        },
        textStyle: CHART_FONT,
        animation: false,
        toolbox: {
            show: true,
            feature: {
                saveAsImage: {},
            }
        },
        series: [
            {
                type: 'bar',
                data: utilities,
                barCategoryGap: '20%',
                label: {
                    show: true,
                    color: '#fff',
                    position: 'insideLeft',
                },
                labelLayout: myLabelLayout
            }
        ],
        color: COLOR_BLUE
    };
    chart.setOption(option);
}

////////////////////////////////////////////
/////  comparison with greedy method  //////
////////////////////////////////////////////

export function buildGreedyComparison(parent, instance, winners, notes) {
    const greedy = notes.greedyWinners;
    if (!greedy) return;
    const stats = notes.stats;
    const greedyStats = notes.greedyStats;
    const numVoters = stats.numVoters || Object.keys(instance.votes).length;

    const intro = document.createElement('p');
    intro.className = 'chart-note';
    intro.innerHTML = `Many cities select projects <i>greedily</i>: go through the projects in order of
        decreasing vote count, and fund each project that still fits into the budget. This section compares
        the outcome of the Method of Equal Shares with the greedy outcome, to show what difference the method makes.`;
    parent.appendChild(intro);

    // diff lists
    const greedySet = new Set(greedy);
    const winnersSet = new Set(winners);
    const byVotes = (a, b) => instance.approvers[b].length - instance.approvers[a].length;
    const onlyMES = winners.filter(c => !greedySet.has(c)).sort(byVotes);
    const onlyGreedy = greedy.filter(c => !winnersSet.has(c)).sort(byVotes);
    const inBoth = winners.filter(c => greedySet.has(c));

    const diffDiv = document.createElement('div');
    diffDiv.className = 'diff-columns';
    const makeColumn = (title, projects, color) => {
        const col = document.createElement('div');
        col.className = 'diff-column';
        const h = document.createElement('h4');
        h.textContent = title;
        h.style.borderBottom = `3px solid ${color}`;
        col.appendChild(h);
        if (projects.length === 0) {
            const none = document.createElement('p');
            none.textContent = 'None – both methods agree on these projects.';
            col.appendChild(none);
        } else {
            const ul = document.createElement('ul');
            for (const c of projects) {
                const li = document.createElement('li');
                li.innerHTML = `${escapeHTML(truncate(instance.projects[c].name, 60))}<br>
                    <span class="diff-details">${showNumber(instance.approvers[c].length)} votes,
                    cost ${showMoney(instance.projects[c].cost, instance)}</span>`;
                ul.appendChild(li);
            }
            col.appendChild(ul);
        }
        return col;
    };
    diffDiv.appendChild(makeColumn(`Funded only by Equal Shares (${onlyMES.length})`, onlyMES, COLOR_BLUE));
    diffDiv.appendChild(makeColumn(`Funded only by the greedy method (${onlyGreedy.length})`, onlyGreedy, COLOR_GRAY));
    parent.appendChild(diffDiv);

    const agreement = document.createElement('p');
    agreement.innerHTML = `<b>${inBoth.length}</b> projects are funded by both methods.
        Typically, the Method of Equal Shares funds more (and cheaper) projects, so that more voters
        see some of their choices funded, while the greedy method tends to spend large amounts on the
        few most popular projects.`;
    parent.appendChild(agreement);

    // stats comparison table
    const mesCovered = stats.numVotersCovered !== undefined ? stats.numVotersCovered : numVoters - (stats.utilityDistribution[0] || 0);
    const greedyCovered = greedyStats.numVotersCovered !== undefined ? greedyStats.numVotersCovered : numVoters - (greedyStats.utilityDistribution[0] || 0);
    const table = document.createElement('table');
    table.className = 'comparison-table';
    table.innerHTML = `
        <thead><tr><th></th><th>Method of Equal Shares</th><th>Greedy method</th></tr></thead>
        <tbody>
            <tr><td>Projects funded</td><td>${showNumber(winners.length)}</td><td>${showNumber(greedy.length)}</td></tr>
            <tr><td>Total cost</td><td>${showMoney(stats.totalCost, instance)}</td><td>${showMoney(greedyStats.totalCost, instance)}</td></tr>
            <tr><td>Voters who get at least one project they voted for</td>
                <td>${showNumber(mesCovered)} (${showPercent(mesCovered / numVoters)})</td>
                <td>${showNumber(greedyCovered)} (${showPercent(greedyCovered / numVoters)})</td></tr>
            <tr><td>Funded projects approved by the average voter</td>
                <td>${stats.avgApprovedProjects.toFixed(2)}</td>
                <td>${greedyStats.avgApprovedProjects.toFixed(2)}</td></tr>
        </tbody>`;
    parent.appendChild(table);

    // grouped utility distribution chart
    const chartTitle = document.createElement('p');
    chartTitle.className = 'chart-note';
    chartTitle.textContent = 'How many voters approve this number of funded projects, under each method?';
    parent.appendChild(chartTitle);

    const maxUtilToShow = 12;
    const categories = [];
    const mesCounts = [];
    const greedyCounts = [];
    const maxUtil = Math.max(
        ...Object.keys(stats.utilityDistribution).map(Number),
        ...Object.keys(greedyStats.utilityDistribution).map(Number));
    for (let util = 0; util <= Math.min(maxUtil, maxUtilToShow); util++) {
        if (util === maxUtilToShow && maxUtil > maxUtilToShow) {
            categories.push(`${maxUtilToShow}+`);
            let mesRest = 0, greedyRest = 0;
            for (let u = maxUtilToShow; u <= maxUtil; u++) {
                mesRest += stats.utilityDistribution[u] || 0;
                greedyRest += greedyStats.utilityDistribution[u] || 0;
            }
            mesCounts.push(mesRest);
            greedyCounts.push(greedyRest);
        } else {
            categories.push(String(util));
            mesCounts.push(stats.utilityDistribution[util] || 0);
            greedyCounts.push(greedyStats.utilityDistribution[util] || 0);
        }
    }

    const container = makeChartContainer(parent, 320);
    const chart = initChart(container);
    chart.setOption({
        animation: false,
        grid: { left: 10, right: 20, top: 40, bottom: 45, containLabel: true },
        legend: { top: 5, textStyle: CHART_FONT },
        xAxis: {
            type: 'category',
            data: categories,
            name: 'number of approved projects that are funded',
            nameLocation: 'middle',
            nameGap: 28,
            axisLabel: { color: '#000' },
        },
        yAxis: {
            type: 'value',
            name: 'voters',
            axisLabel: { formatter: compactNumber, color: '#000' },
        },
        textStyle: CHART_FONT,
        tooltip: { trigger: 'axis', confine: true },
        toolbox: { show: true, feature: { saveAsImage: {} } },
        series: [
            { name: 'Method of Equal Shares', type: 'bar', data: mesCounts, itemStyle: { color: COLOR_BLUE } },
            { name: 'Greedy method', type: 'bar', data: greedyCounts, itemStyle: { color: COLOR_GRAY } },
        ],
    });
}
