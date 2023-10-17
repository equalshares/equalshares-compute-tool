import { generateTableBarCharts } from "./tableBarChart.js";

let showLosers = true;

function showNumber(value) {
    return parseFloat(value).toLocaleString();
}

////////////////////////////////////////////
/////////  chart generation  ///////////////
////////////////////////////////////////////

const myLabelLayout = function (params) {
    if (params.labelRect.width > params.rect.width - 5) {
        return { x: params.labelRect.x + params.rect.width, y: params.labelRect.y };
    }
}

const hideLabelLayout = function (params) {
    if (params.labelRect.width > params.rect.width - 2) {
        return { fontSize: 0 };
    }
    if (params.labelRect.width > params.rect.width - 8) {
        return { dx: (params.rect.width - params.labelRect.width - 8) / 2 };
    }
}

function buildUtilityChart(containerId, instance, notes) {
    const utilityDistribution = notes.stats.utilityDistribution;
    const numVoters = Object.values(utilityDistribution).reduce((a, b) => a + b, 0);
    const cutoff = numVoters * 0.95;
    let maxUtil;
    let votersSoFar = 0;
    let utilityDescriptors = [];
    let utilities = [];
    for (let util in utilityDistribution) {
        votersSoFar += utilityDistribution[util];
        utilityDescriptors.push(util);
        utilities.push(utilityDistribution[util]);
        if (votersSoFar == numVoters) {
            maxUtil = util;
            break;
        } else if (votersSoFar > cutoff) {
            maxUtil = util;
            const remaining = numVoters - votersSoFar;
            utilityDescriptors.push(`${parseInt(util) + 1}+`);
            utilities.push(remaining);
            break;
        }
    }

    const container = document.getElementById(containerId);
    container.style.width = "100%";
    container.style.height = `${utilities.length * 30}px`;
    const chart = echarts.init(container, null, { renderer: 'svg' });
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
        textStyle: { fontFamily: 'Roboto', fontSize: 14 },
        animation: false,
        toolbox: { 
            show: true, 
            feature : { 
                saveAsImage: {}, 
                // dataView: {} 
            } },
        series: [
            {
                name: 'sales',
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
        color: 'rgb(75, 159, 201)'
    };
    chart.setOption(option);
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
    // table header
    const thead = document.createElement("thead");
    tr = document.createElement("tr");
    th = document.createElement("th");
    th.textContent = "ID";
    th.style.minWidth = "70px";
    tr.appendChild(th);
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
        // console.log(notes.effectiveVoteCount[c]);
        if (isNaN(effVotes)) { effVotes = 0; }
        // td.textContent = effVotes.toFixed(1).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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

    generateTableBarCharts({ tableElement: table, columnIndex: 2, barWidth: 150, barColor: 'rgb(75, 159, 201)'});
    generateTableBarCharts({ tableElement: table, columnIndex: 3, barWidth: 150, barColor: 'rgb(75, 159, 201)'});
    generateTableBarCharts({ tableElement: table, columnIndex: 4, barWidth: 150, barColor: 'rgb(75, 159, 201)'});
}

export function displayResults(instance, { winners, notes }) {
    const resultsInfo = document.getElementById("results-section");
    resultsInfo.innerHTML = "";
    let h3, p, li;
    h3 = document.createElement("h3");
    h3.innerText = "Statistics";
    resultsInfo.appendChild(h3);
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
    resultsInfo.appendChild(statsList);


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
        displayResults(instance, { winners, notes });
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

    h3 = document.createElement("h3");
    h3.innerText = "Utility chart";
    resultsInfo.appendChild(h3);
    p = document.createElement("p");
    p.innerHTML = "How many voters approved this number of winning projects?";
    resultsInfo.appendChild(p);
    const utilityChart = document.createElement("div");
    utilityChart.id = "utility-chart";
    resultsInfo.appendChild(utilityChart);
    buildUtilityChart("utility-chart", instance, notes);

    // h3 = document.createElement("h3");
    // h3.innerText = "Map";
    // resultsInfo.appendChild(h3);
    // const map = document.createElement("div");
    // map.id = "map";
    // resultsInfo.appendChild(map);
    // showMap("map", instance, winners);
}