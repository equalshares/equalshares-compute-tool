import { generateTableBarCharts } from "./tableBarChart.js";
import {
    buildSummaryTiles, buildBudgetBar, buildCostVotesScatter, buildCategoryChart, hasCategories,
    buildPaymentChart, buildLeftoverHistogram, buildUtilityChart, buildGreedyComparison
} from "./outcomeCharts.js";
import { buildExplanationSection } from "./explanation.js";

let showLosers = true;

function showNumber(value) {
    return parseFloat(value).toLocaleString();
}

////////////////////////////////////////////
/////////  map generation  ///////////////
////////////////////////////////////////////

function showMap(mapContainerId, instance, winners) {
    // find bounding box
    let minLat = 90; let maxLat = -90;
    let minLon = 180; let maxLon = -180;
    let foundCoordinates = false;
    for (const winner of winners) {
        const project = instance.projects[winner];
        if (project.latitude && project.longitude) {
            minLat = Math.min(minLat, project.latitude);
            maxLat = Math.max(maxLat, project.latitude);
            minLon = Math.min(minLon, project.longitude);
            maxLon = Math.max(maxLon, project.longitude);
            foundCoordinates = true;
        }
    }
    // add padding
    const latPadding = (maxLat - minLat) * 0.1;
    const lonPadding = (maxLon - minLon) * 0.1;
    minLat -= latPadding; maxLat += latPadding;
    minLon -= lonPadding; maxLon += lonPadding;

    const container = document.getElementById(mapContainerId);

    if (!foundCoordinates) {
        container.innerHTML = "<p>No coordinates provided in .pb file.</p>";
        return;
    }

    container.style.width = "100%";
    container.style.height = "500px";

    const map = new mapboxgl.Map({
        container: mapContainerId,
        style: 'mapbox://styles/mapbox/standard-beta',
        bounds: [[minLon, minLat], [maxLon, maxLat]],
    });

    // add markers
    for (const winner of winners) {
        const project = instance.projects[winner];
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<b>${project.name}</b> Cost:&nbsp;${showNumber(project.cost)}`
        );
        if (project.latitude && project.longitude) {
            const marker = new mapboxgl.Marker()
                .setLngLat([project.longitude, project.latitude])
                .setPopup(popup)
                .addTo(map);
        }
    }
}

////////////////////////////////////////////
/////////////////  table  //////////////////
////////////////////////////////////////////

function buildProjectTable(table, instance, winners, notes, includeLosers=true) {
    let tr, th, td;
    table.classList.add("sortable-theme-light");
    table.dataset.sortable = "true";

    // if the detailed rounds are known (and correspond to the displayed winners),
    // show the round in which each project was selected
    let roundOf = null;
    let completionSet = new Set();
    if (notes.rounds && !notes.comparisonReplaced) {
        roundOf = {};
        notes.rounds.forEach((r, idx) => { roundOf[r.project] = idx + 1; });
        completionSet = new Set(notes.addedByUtlitarianCompletion || []);
    }

    // table header
    const thead = document.createElement("thead");
    tr = document.createElement("tr");
    th = document.createElement("th");
    th.textContent = "ID";
    th.style.minWidth = "70px";
    tr.appendChild(th);
    if (roundOf) {
        th = document.createElement("th");
        th.textContent = "Round";
        th.style.minWidth = "60px";
        th.title = "The round in which the project was selected by the Method of Equal Shares ('extra' = added by utilitarian completion)";
        tr.appendChild(th);
    }
    th = document.createElement("th");
    th.textContent = "Project name";
    th.style.minWidth = "130px";
    tr.appendChild(th);
    th = document.createElement("th");
    th.textContent = "Votes";
    th.style.minWidth = "130px";
    tr.appendChild(th);
    th = document.createElement("th");
    th.textContent = "eff. votes";
    th.style.minWidth = "130px";
    tr.appendChild(th);
    th = document.createElement("th");
    th.textContent = "Cost";
    th.style.minWidth = "130px";
    tr.appendChild(th);
    thead.appendChild(tr);
    table.appendChild(thead);

    // table body
    let projectsToShow;
    if (includeLosers) {
        projectsToShow = Object.keys(instance.projects).sort((a, b) => instance.approvers[b].length - instance.approvers[a].length);
    } else {
        projectsToShow = winners;
    }
    const tbody = document.createElement("tbody");
    for (const c of projectsToShow) {
        const project = instance.projects[c];
        tr = document.createElement("tr");
        if (winners.includes(c)) {
            tr.classList.add("winner-row");
        }
        td = document.createElement("td");
        td.textContent = c;
        tr.appendChild(td);
        if (roundOf) {
            td = document.createElement("td");
            td.classList.add("right");
            if (roundOf[c] !== undefined) {
                td.textContent = roundOf[c];
                td.dataset.value = roundOf[c];
            } else if (completionSet.has(c)) {
                td.textContent = "extra";
                td.dataset.value = 100000;
            } else {
                td.textContent = "–";
                td.dataset.value = 200000;
            }
            tr.appendChild(td);
        }
        td = document.createElement("td");
        td.textContent = project.name;
        tr.appendChild(td);
        td = document.createElement("td");
        td.classList.add("right");
        td.textContent = showNumber(instance.approvers[c].length);
        td.dataset.value = instance.approvers[c].length;
        tr.appendChild(td);
        td = document.createElement("td");
        td.classList.add("right");
        // show last value of effectiveVoteCount
        let effVotes = notes.effectiveVoteCount[c][notes.effectiveVoteCount[c].length - 1];
        if (isNaN(effVotes)) { effVotes = 0; }
        td.textContent = showNumber(effVotes.toFixed(0));
        td.dataset.value = effVotes + 0.0001 * instance.approvers[c].length;
        tr.appendChild(td);
        td = document.createElement("td");
        td.classList.add("right");
        td.textContent = showNumber(project.cost);
        td.dataset.value = project.cost;
        tr.appendChild(td);
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    Sortable.initTable(table);

    const offset = roundOf ? 1 : 0;
    generateTableBarCharts({ tableElement: table, columnIndex: 2 + offset, barWidth: 150, barColor: 'rgb(75, 159, 201)'});
    generateTableBarCharts({ tableElement: table, columnIndex: 3 + offset, barWidth: 150, barColor: 'rgb(75, 159, 201)'});
    generateTableBarCharts({ tableElement: table, columnIndex: 4 + offset, barWidth: 150, barColor: 'rgb(75, 159, 201)'});
}

////////////////////////////////////////////
///////////  section helper  ///////////////
////////////////////////////////////////////

function addSection(parent, title, open = true) {
    const details = document.createElement("details");
    details.className = "result-section";
    details.open = open;
    const summary = document.createElement("summary");
    summary.textContent = title;
    details.appendChild(summary);
    // charts inside an initially-closed <details> are rendered with zero width;
    // trigger a resize when the section is opened
    details.addEventListener("toggle", () => {
        if (details.open) {
            window.dispatchEvent(new Event("resize"));
        }
    });
    parent.appendChild(details);
    return details;
}

export function displayResults(instance, { winners, notes }, params) {
    const resultsInfo = document.getElementById("results-section");
    resultsInfo.innerHTML = "";
    let h3, p, li;

    ////// statistics //////
    h3 = document.createElement("h3");
    h3.innerText = "Statistics";
    resultsInfo.appendChild(h3);

    buildSummaryTiles(resultsInfo, instance, winners, notes);

    const statsList = document.createElement("ul");
    li = document.createElement("li");
    li.innerHTML = `Computation time: ${showNumber(notes.time)} s`;
    statsList.appendChild(li);
    li = document.createElement("li");
    li.innerHTML = `Number of winning projects: ${showNumber(winners.length)}`;
    statsList.appendChild(li);
    li = document.createElement("li");
    li.innerHTML = `Total cost of winning projects: ${showNumber(notes.stats.totalCost)}`;
    statsList.appendChild(li);
    li = document.createElement("li");
    li.innerHTML = `Average number of approved projects per voter: ${notes.stats.avgApprovedProjects.toFixed(2)}`;
    statsList.appendChild(li);
    li = document.createElement("li");
    li.innerHTML = `Voter endowment: ${notes.endowment.toFixed(2)}`;
    statsList.appendChild(li);
    if (notes.comparisonReplaced && notes.comparison) {
        li = document.createElement("li");
        li.innerHTML = `<b>Comparison step:</b> the greedy outcome is displayed instead of the Equal Shares outcome. ${notes.comparison}`;
        statsList.appendChild(li);
    }
    resultsInfo.appendChild(statsList);

    ////// budget allocation bar //////
    let section = addSection(resultsInfo, "Budget allocation");
    p = document.createElement("p");
    p.className = "chart-note";
    p.textContent = "How the budget is divided among the winning projects (each colored segment is one project; hover for details).";
    section.appendChild(p);
    buildBudgetBar(section, instance, winners, notes);

    ////// winning projects table //////
    h3 = document.createElement("h3");
    h3.innerText = "Winning projects";
    resultsInfo.appendChild(h3);

    let label = document.createElement("label");
    label.style.margin = '0';
    label.style.marginBottom = '8px';
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = showLosers;
    checkbox.addEventListener("change", function () {
        showLosers = checkbox.checked;
        displayResults(instance, { winners, notes }, params);
    });
    checkbox.style.marginRight = '5px';
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode("Show losing projects"));
    resultsInfo.appendChild(label);

    const table = document.createElement("table");
    table.id = 'winning-projects-table';
    buildProjectTable(table, instance, winners, notes, showLosers);
    resultsInfo.appendChild(table);
    // download buttons
    table.style.marginBottom = '5px';
    const xslxButton = document.createElement("a");
    xslxButton.href = "#";
    xslxButton.textContent = "Download as .xlsx";
    xslxButton.addEventListener("click", function (e) {
        e.preventDefault();
        var wb = XLSX.utils.table_to_book(table, { sheet: "Winning projects" });
        XLSX.writeFile(wb, "winning-projects.xlsx");
    });
    resultsInfo.appendChild(xslxButton);
    const csvButton = document.createElement("a");
    csvButton.href = "#";
    csvButton.textContent = "Download as .csv";
    csvButton.style.marginLeft = '10px';
    csvButton.addEventListener("click", function (e) {
        e.preventDefault();
        var wb = XLSX.utils.table_to_book(table);
        XLSX.writeFile(wb, "winning-projects.csv");
    });
    resultsInfo.appendChild(csvButton);

    ////// utility chart //////
    section = addSection(resultsInfo, "Utility chart");
    p = document.createElement("p");
    p.className = "chart-note";
    p.innerHTML = "How many voters approved this number of winning projects?";
    section.appendChild(p);
    buildUtilityChart(section, instance, notes);

    ////// votes vs cost scatter //////
    section = addSection(resultsInfo, "Votes and costs of funded projects");
    p = document.createElement("p");
    p.className = "chart-note";
    p.textContent = "Each dot is one proposed project. The Method of Equal Shares tends to fund projects that combine many votes with a modest cost.";
    section.appendChild(p);
    buildCostVotesScatter(section, instance, winners, notes);

    ////// category chart (only if the file has categories) //////
    if (hasCategories(instance, winners)) {
        section = addSection(resultsInfo, "Spending by category");
        buildCategoryChart(section, instance, winners);
    }

    ////// payments and leftover budgets (only when rounds match the outcome) //////
    if (notes.rounds && !notes.comparisonReplaced) {
        section = addSection(resultsInfo, "What did supporters pay?", false);
        buildPaymentChart(section, instance, notes);

        if (notes.finalVoterBudgets) {
            section = addSection(resultsInfo, "Leftover budget shares of voters", false);
            buildLeftoverHistogram(section, instance, notes);
        }
    }

    ////// explanation of the computation //////
    section = addSection(resultsInfo, "How was the outcome computed?");
    buildExplanationSection(section, instance, winners, notes, params);

    ////// comparison with greedy //////
    if (notes.greedyWinners && !notes.comparisonReplaced) {
        section = addSection(resultsInfo, "Comparison with the greedy method", false);
        buildGreedyComparison(section, instance, winners, notes);
    }
}
