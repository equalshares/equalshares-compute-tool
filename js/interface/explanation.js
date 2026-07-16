// Explanations of how the outcome was computed: a narrative description of the
// computation, a chart and table of the selection rounds, a per-project
// "why was this project (not) funded?" explorer, and a downloadable
// standalone HTML explanation report.

const COLOR_BLUE = 'rgb(75, 159, 201)';
const COLOR_GREEN = 'hsl(144, 42%, 45%)';
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

////////////////////////////////////////////
///////  narrative text generation  ////////
////////////////////////////////////////////

// returns a list of HTML paragraph contents describing the computation
function narrativeParagraphs(instance, winners, notes, params) {
    const B = parseFloat(instance.meta.budget);
    const numVoters = notes.numVoters || Object.keys(instance.votes).length;
    const E = notes.endowment;
    const baseShare = B / numVoters;
    const completionAdded = notes.addedByUtlitarianCompletion || [];
    const rounds = notes.rounds || [];
    const paragraphs = [];

    paragraphs.push(
        `The Method of Equal Shares is based on the idea that <b>every voter controls an equal share of
        the budget</b>. The budget of ${showMoney(B, instance)} was divided equally among the
        ${showNumber(numVoters)} voters, so each voter was assigned a virtual budget share of about
        ${showMoney(baseShare, instance)}. A voter's share can only be spent on projects that the voter voted for.`
    );

    if (E > baseShare * 1.0001) {
        paragraphs.push(
            `With these initial shares, part of the budget would have remained unused, because voters' shares
            get "stuck" with projects that are not funded. Therefore, following the <b>Add1 completion method</b>,
            the computation was repeated with voter shares that were repeatedly increased by
            ${showMoney(params && params.increment ? params.increment : 1, instance)}. The final result shown here
            uses a share of <b>${showMoney(E, instance)}</b> per voter — the largest tested share for which the
            cost of the selected projects still fits within the actual budget limit of ${showMoney(B, instance)}.`
        );
    }

    paragraphs.push(
        `The projects were then selected <b>one by one, in ${showNumber(rounds.length)} rounds</b>. In each round,
        the method looked for the project that could be funded by the budget shares of its supporters, splitting
        its cost as equally as possible among them. Among these projects, it selected the one with the highest number of
        <b>"effective votes"</b> — the cost of the project divided by the highest amount any single supporter needed
        to pay. A project with many supporters who still have money left needs only a small payment from each
        supporter, and thus has a high effective vote count. After a project was selected, the payments were
        subtracted from its supporters' shares.`
    );

    let endText = `The selection process ended when no remaining project could be paid for by the remaining
        budget shares of its supporters.`;
    if (completionAdded.length > 0) {
        const completionCost = completionAdded.reduce((acc, c) => acc + parseFloat(instance.projects[c].cost), 0);
        endText += ` At that point, the selected projects did not use up the entire budget. Therefore, in a
        <b>utilitarian completion step</b>, ${showNumber(completionAdded.length)} additional
        project${completionAdded.length === 1 ? ' was' : 's were'} added (with a total cost of
        ${showMoney(completionCost, instance)}), by going through the unselected projects in order of decreasing
        vote count and adding each project that still fits within the budget.`;
    }
    paragraphs.push(endText);

    return paragraphs;
}

////////////////////////////////////////////
//////  per-project explanations  //////////
////////////////////////////////////////////

// returns an HTML string explaining why project c was funded or not funded
export function explainProject(c, instance, winners, notes) {
    const project = instance.projects[c];
    const cost = parseFloat(project.cost);
    const numVotes = instance.approvers[c].length;
    const E = notes.endowment;
    const rounds = notes.rounds || [];
    const completionSet = new Set(notes.addedByUtlitarianCompletion || []);
    const roundIndex = rounds.findIndex(r => r.project === c);
    const name = escapeHTML(project.name);

    let html = `<p><b>${name}</b> (id ${escapeHTML(c)}) costs ${showMoney(cost, instance)} and received
        ${showNumber(numVotes)} votes.</p>`;

    if (numVotes === 0) {
        html += `<p>❌ The project was <b>not funded</b> because it received no votes, so no budget shares
            were available to pay for it.</p>`;
        return html;
    }
    if (cost <= 0) {
        html += `<p>The project has a cost of 0 and was therefore not considered by the method.</p>`;
        return html;
    }

    const maxTheoretical = numVotes * E;
    const minVotesNeeded = Math.ceil(cost / E);

    if (roundIndex >= 0) {
        const r = rounds[roundIndex];
        html += `<p>✅ The project was <b>selected in round ${roundIndex + 1}</b> of ${rounds.length}.
            At that point, its ${showNumber(numVotes)} supporters together still had
            ${showMoney(r.moneyBehind, instance)} of their budget shares available — enough to cover the cost of
            ${showMoney(cost, instance)}.</p>`;
        html += `<p>The cost was split as equally as possible among the supporters: no supporter paid more than
            <b>${showMoney(r.maxPayment, instance)}</b>. ` +
            (r.numPaidPartial > 0 ?
                `${showNumber(r.numPaidFull)} supporters paid this amount, and ${showNumber(r.numPaidPartial)}
                supporters (who had less than that left) contributed their entire remaining share. ` : '') +
            `This corresponds to <b>${r.effVoteCount.toFixed(1)} effective votes</b>
            (cost divided by the highest payment) — the highest effective vote count among all projects that were
            still affordable in that round, which is why this project was selected next.</p>`;
        return html;
    }

    if (completionSet.has(c)) {
        const moneyBehindHistory = notes.moneyBehindCandidate[c] || [];
        const lastMoneyBehind = moneyBehindHistory[moneyBehindHistory.length - 1];
        html += `<p>✅ The project was <b>not selected by the Method of Equal Shares</b>: its supporters spent
            their budget shares on other projects they voted for` +
            (lastMoneyBehind !== undefined ?
                `, and in the end had only ${showMoney(lastMoneyBehind, instance)} left — less than the cost of
                ${showMoney(cost, instance)}` : '') + `.</p>`;
        html += `<p>However, it was <b>added in the utilitarian completion step</b>: after the Method of Equal
            Shares finished, part of the budget was still unused, and this project was among the projects with the
            highest vote counts that still fit into the remaining budget.</p>`;
        return html;
    }

    // not funded
    const moneyBehindHistory = notes.moneyBehindCandidate[c] || [];
    const lastMoneyBehind = moneyBehindHistory[moneyBehindHistory.length - 1];
    html += `<p>❌ The project was <b>not funded</b>.</p>`;
    if (maxTheoretical < cost) {
        html += `<p>Its ${showNumber(numVotes)} supporters controlled budget shares of
            ${showMoney(E, instance)} each, so even if they had spent nothing else, they could have contributed at
            most ${showMoney(maxTheoretical, instance)} — less than the cost of ${showMoney(cost, instance)}.
            The project would have needed at least <b>${showNumber(minVotesNeeded)} votes</b> to be fundable
            by its supporters' shares.</p>`;
    } else if (lastMoneyBehind !== undefined) {
        html += `<p>Its supporters' budget shares ran out: when the project was last considered, its
            ${showNumber(numVotes)} supporters together had only <b>${showMoney(lastMoneyBehind, instance)}</b> of
            their shares left, which is less than the cost of ${showMoney(cost, instance)}
            (a shortfall of ${showMoney(cost - lastMoneyBehind, instance)}; the supporters could cover
            ${showPercent(lastMoneyBehind / cost)} of the cost). This happens because the supporters' shares were
            spent on other projects that they also voted for and that were selected earlier.</p>`;
    } else {
        html += `<p>The project could not be paid for by the budget shares of its supporters.</p>`;
    }
    // without a utilitarian completion step, unfunded projects may still fit
    // within the unused part of the budget; point this out
    if (notes.stats) {
        const B = parseFloat(instance.meta.budget);
        if (cost <= B - notes.stats.totalCost) {
            html += `<p>Note: the project would still have fit within the unused part of the budget
                (it could have been added by a utilitarian completion step).</p>`;
        }
    }
    return html;
}

////////////////////////////////////////////
////////  cumulative spending chart  ///////
////////////////////////////////////////////

function buildSpendingChart(parent, instance, winners, notes) {
    const B = parseFloat(instance.meta.budget);
    const rounds = notes.rounds || [];
    const completionAdded = notes.addedByUtlitarianCompletion || [];
    if (rounds.length + completionAdded.length === 0) return;

    const mesData = [];
    const completionData = [];
    let cumulative = 0;
    for (let idx = 0; idx < rounds.length; idx++) {
        cumulative += parseFloat(instance.projects[rounds[idx].project].cost);
        mesData.push([idx + 1, Math.round(cumulative * 100) / 100, rounds[idx].project]);
    }
    if (completionAdded.length > 0 && mesData.length > 0) {
        // connect the two line segments
        completionData.push(mesData[mesData.length - 1]);
    }
    for (let idx = 0; idx < completionAdded.length; idx++) {
        cumulative += parseFloat(instance.projects[completionAdded[idx]].cost);
        completionData.push([rounds.length + idx + 1, Math.round(cumulative * 100) / 100, completionAdded[idx]]);
    }

    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '320px';
    parent.appendChild(container);
    const chart = echarts.init(container, null, { renderer: 'svg' });
    window.addEventListener('resize', () => chart.resize());

    const series = [{
        name: 'Selected by Equal Shares',
        type: 'line',
        step: 'end',
        data: mesData,
        symbolSize: 5,
        itemStyle: { color: COLOR_BLUE },
        lineStyle: { color: COLOR_BLUE },
        markLine: {
            silent: true,
            symbol: 'none',
            data: [{ yAxis: B }],
            lineStyle: { color: '#d9534f', type: 'dashed' },
            label: { formatter: 'budget limit', position: 'insideEndTop', color: '#d9534f' },
        },
    }];
    if (completionData.length > 0) {
        series.push({
            name: 'Added by completion',
            type: 'line',
            step: 'end',
            data: completionData,
            symbolSize: 5,
            itemStyle: { color: COLOR_GREEN },
            lineStyle: { color: COLOR_GREEN },
        });
    }

    chart.setOption({
        animation: false,
        grid: { left: 10, right: 25, top: 40, bottom: 45, containLabel: true },
        legend: { top: 5, show: completionData.length > 0, textStyle: CHART_FONT },
        xAxis: {
            type: 'value',
            name: 'round',
            nameLocation: 'middle',
            nameGap: 28,
            min: 0,
            max: rounds.length + completionAdded.length,
            axisLabel: { color: '#000' },
        },
        yAxis: {
            type: 'value',
            name: 'total amount spent',
            nameTextStyle: { align: 'left' },
            max: Math.max(B, cumulative) * 1.05,
            axisLabel: { formatter: compactNumber, color: '#000' },
        },
        textStyle: CHART_FONT,
        tooltip: {
            trigger: 'item',
            confine: true,
            formatter: (params) => {
                const c = params.data[2];
                return `Round ${params.data[0]}: <b>${truncate(escapeHTML(instance.projects[c].name), 60)}</b><br>` +
                    `Cost: ${showMoney(instance.projects[c].cost, instance)}<br>` +
                    `Total spent after this round: ${showMoney(params.data[1], instance)}`;
            },
        },
        toolbox: { show: true, feature: { saveAsImage: {} } },
        series: series,
    });
}

////////////////////////////////////////////
////////////  rounds table  ////////////////
////////////////////////////////////////////

// returns the table element (also used for the downloadable report)
function roundsTableHTML(instance, notes) {
    const rounds = notes.rounds || [];
    const completionAdded = notes.addedByUtlitarianCompletion || [];
    let cumulative = 0;
    let html = `<table class="rounds-table">
        <thead><tr>
            <th>Round</th><th>ID</th><th>Project</th><th>Votes</th><th>Effective votes</th>
            <th>Highest payment per supporter</th><th>Cost</th><th>Total spent so far</th>
        </tr></thead><tbody>`;
    for (let idx = 0; idx < rounds.length; idx++) {
        const r = rounds[idx];
        const project = instance.projects[r.project];
        cumulative += parseFloat(project.cost);
        html += `<tr>
            <td class="right">${idx + 1}</td>
            <td>${escapeHTML(r.project)}</td>
            <td>${escapeHTML(project.name)}</td>
            <td class="right">${showNumber(instance.approvers[r.project].length)}</td>
            <td class="right">${r.effVoteCount.toFixed(1)}</td>
            <td class="right">${showMoney(r.maxPayment, instance)}</td>
            <td class="right">${showMoney(project.cost, instance)}</td>
            <td class="right">${showMoney(cumulative, instance)}</td>
        </tr>`;
    }
    for (const c of completionAdded) {
        const project = instance.projects[c];
        cumulative += parseFloat(project.cost);
        html += `<tr class="completion-row">
            <td>extra</td>
            <td>${escapeHTML(c)}</td>
            <td>${escapeHTML(project.name)}</td>
            <td class="right">${showNumber(instance.approvers[c].length)}</td>
            <td class="right">–</td>
            <td class="right">–</td>
            <td class="right">${showMoney(project.cost, instance)}</td>
            <td class="right">${showMoney(cumulative, instance)}</td>
        </tr>`;
    }
    html += `</tbody></table>`;
    return html;
}

////////////////////////////////////////////
///////////  project explorer  /////////////
////////////////////////////////////////////

function buildProjectExplorer(parent, instance, winners, notes) {
    const h4 = document.createElement('h4');
    h4.textContent = 'Why was a project funded or not funded?';
    parent.appendChild(h4);

    const p = document.createElement('p');
    p.textContent = 'Select a project to see an explanation of its result:';
    parent.appendChild(p);

    const select = document.createElement('select');
    select.className = 'project-explorer-select';
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '– select a project –';
    select.appendChild(emptyOption);
    const projectIds = Object.keys(instance.projects)
        .sort((a, b) => instance.approvers[b].length - instance.approvers[a].length);
    for (const c of projectIds) {
        const option = document.createElement('option');
        option.value = c;
        const marker = winners.includes(c) ? '✅' : '❌';
        option.textContent = `${marker} ${c}: ${truncate(instance.projects[c].name, 70)} (${instance.approvers[c].length} votes)`;
        select.appendChild(option);
    }
    parent.appendChild(select);

    const explanationDiv = document.createElement('div');
    explanationDiv.className = 'project-explanation';
    explanationDiv.style.display = 'none';
    parent.appendChild(explanationDiv);

    select.addEventListener('change', () => {
        const c = select.value;
        if (!c) {
            explanationDiv.style.display = 'none';
            return;
        }
        explanationDiv.style.display = 'block';
        explanationDiv.innerHTML = explainProject(c, instance, winners, notes);

        // chart of the money available to the project's supporters over time
        const moneyBehindHistory = notes.moneyBehindCandidate[c] || [];
        const cost = parseFloat(instance.projects[c].cost);
        if (moneyBehindHistory.length >= 2) {
            const chartNote = document.createElement('p');
            chartNote.className = 'chart-note';
            chartNote.textContent = 'Money available to the project\'s supporters each time the project was considered by the method:';
            explanationDiv.appendChild(chartNote);
            const container = document.createElement('div');
            container.style.width = '100%';
            container.style.height = '250px';
            explanationDiv.appendChild(container);
            const chart = echarts.init(container, null, { renderer: 'svg' });
            chart.setOption({
                animation: false,
                grid: { left: 10, right: 70, top: 20, bottom: 40, containLabel: true },
                xAxis: {
                    type: 'category',
                    data: moneyBehindHistory.map((_, i) => i + 1),
                    name: 'consideration',
                    nameLocation: 'middle',
                    nameGap: 25,
                    axisLabel: { color: '#000' },
                },
                yAxis: {
                    type: 'value',
                    max: Math.max(cost, ...moneyBehindHistory) * 1.1,
                    axisLabel: { formatter: compactNumber, color: '#000' },
                },
                textStyle: CHART_FONT,
                tooltip: {
                    trigger: 'axis',
                    confine: true,
                    formatter: (params) =>
                        `Supporters had ${showMoney(params[0].value, instance)} available`,
                },
                series: [{
                    type: 'line',
                    data: moneyBehindHistory.map(v => Math.round(v * 100) / 100),
                    itemStyle: { color: COLOR_BLUE },
                    lineStyle: { color: COLOR_BLUE },
                    markLine: {
                        silent: true,
                        symbol: 'none',
                        data: [{ yAxis: cost }],
                        lineStyle: { color: '#d9534f', type: 'dashed' },
                        label: { formatter: 'cost', position: 'end', color: '#d9534f' },
                    },
                }],
            });
        }
    });
}

////////////////////////////////////////////
////////  downloadable report  /////////////
////////////////////////////////////////////

function buildReportHTML(instance, winners, notes, params) {
    const B = parseFloat(instance.meta.budget);
    const numVoters = notes.numVoters || Object.keys(instance.votes).length;
    const completionLabels = {
        none: 'none',
        utilitarian: 'utilitarian completion',
        add1: 'repeated increase of voter budgets (Add1)',
        add1u: 'repeated increase of voter budgets, followed by utilitarian completion (Add1u)',
    };
    const paragraphs = narrativeParagraphs(instance, winners, notes, params);
    const projectIds = Object.keys(instance.projects)
        .sort((a, b) => instance.approvers[b].length - instance.approvers[a].length);

    let html = `<!doctype html>
<html>
<head>
<meta charset="UTF-8">
<title>Method of Equal Shares – Explanation of the Outcome</title>
<style>
    body { font-family: system-ui, -apple-system, sans-serif; font-size: 16px; max-width: 900px; margin: 30px auto; padding: 0 15px; line-height: 1.5; }
    table { border-collapse: collapse; margin: 15px 0; font-size: 14px; }
    th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
    td.right { text-align: right; }
    tr.completion-row { background-color: #e8f5ee; }
    .project-block { border: 1px solid #ddd; border-radius: 5px; padding: 5px 15px; margin-bottom: 10px; }
    .project-block.winner { background-color: hsl(144, 42%, 95%); }
    h1, h2 { color: rgb(54, 54, 123); }
</style>
</head>
<body>
<h1>Method of Equal Shares: Explanation of the Outcome</h1>
<p><b>${escapeHTML(instance.meta.description || 'Participatory budgeting election')}</b></p>
<ul>
    <li>Budget limit: ${showMoney(B, instance)}</li>
    <li>${showNumber(Object.keys(instance.projects).length)} proposed projects, ${showNumber(numVoters)} voters</li>
    <li>${showNumber(winners.length)} winning projects with a total cost of ${showMoney(notes.stats.totalCost, instance)}</li>
    <li>Completion method: ${completionLabels[params && params.completion] || 'unknown'}</li>
    <li>Numerical accuracy: ${params && params.accuracy === 'fractions' ? 'exact fractions' : 'floating point numbers'}</li>
    <li>Report generated by the <a href="https://equalshares.net/tools/compute/">Equal Shares computation tool</a> on ${new Date().toLocaleDateString()}</li>
</ul>
<h2>How the outcome was computed</h2>`;
    for (const paragraph of paragraphs) {
        html += `<p>${paragraph}</p>`;
    }
    html += `<h2>The selection rounds</h2>`;
    html += roundsTableHTML(instance, notes);
    html += `<h2>Project-by-project explanations</h2>
        <p>Projects are listed in order of decreasing vote count.</p>`;
    for (const c of projectIds) {
        const isWinner = winners.includes(c);
        html += `<div class="project-block ${isWinner ? 'winner' : ''}">`;
        html += explainProject(c, instance, winners, notes);
        html += `</div>`;
    }
    html += `</body></html>`;
    return html;
}

////////////////////////////////////////////
//////////////  main entry  ////////////////
////////////////////////////////////////////

export function buildExplanationSection(parent, instance, winners, notes, params) {
    if (notes.comparisonReplaced) {
        const p = document.createElement('p');
        p.innerHTML = `<b>Note:</b> Due to the selected comparison step, the outcome of the Method of Equal Shares
            was replaced by the outcome of the greedy method, because more voters prefer the greedy outcome.
            ${escapeHTML(notes.comparison || '')} A round-by-round explanation is therefore not available: the
            displayed winning projects are simply the projects with the highest vote counts that fit into the
            budget, considered in order of decreasing vote count.`;
        parent.appendChild(p);
        return;
    }
    if (!notes.rounds) {
        const p = document.createElement('p');
        p.textContent = 'No detailed information about the computation is available.';
        parent.appendChild(p);
        return;
    }

    for (const paragraph of narrativeParagraphs(instance, winners, notes, params)) {
        const p = document.createElement('p');
        p.innerHTML = paragraph;
        parent.appendChild(p);
    }

    let h4 = document.createElement('h4');
    h4.textContent = 'Money spent over the course of the selection rounds';
    parent.appendChild(h4);
    buildSpendingChart(parent, instance, winners, notes);

    h4 = document.createElement('h4');
    h4.textContent = 'The selection rounds in detail';
    parent.appendChild(h4);
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'rounds-table-wrapper';
    tableWrapper.innerHTML = roundsTableHTML(instance, notes);
    parent.appendChild(tableWrapper);

    buildProjectExplorer(parent, instance, winners, notes);

    // download report button
    const downloadP = document.createElement('p');
    const downloadButton = document.createElement('a');
    downloadButton.href = '#';
    downloadButton.textContent = 'Download full explanation report (HTML file, with explanations for every project)';
    downloadButton.addEventListener('click', (e) => {
        e.preventDefault();
        const html = buildReportHTML(instance, winners, notes, params);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'equal-shares-explanation.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
    downloadP.appendChild(downloadButton);
    downloadP.style.marginTop = '20px';
    parent.appendChild(downloadP);
}
