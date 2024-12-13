import { parsePabulibFromString } from './pabulibParser.js';
import { initializeDragDrop } from './interface/dragDropHandler.js';
import { initializeForm, parseURLParameters } from './interface/formHandler.js';
import { displayResults } from './interface/displayResults.js';

let equalSharesParams = {
    tieBreaking: [],
    completion: "add1u",
    add1options: ["exhaustive", "integral"],
    comparison: "none",
    accuracy: "floats",
    increment: 1
}

///////////////////////////////////////////////
//// communicate with Equal Shares worker /////
///////////////////////////////////////////////


let equalSharesWorker;
let awaitingResponse = false;
const progress = document.getElementById("progress");
const progressText = document.getElementById("progress-text");

function clearResults() {
    progress.style.display = "none";
    progressText.textContent = "";
    document.getElementById('results-section').innerHTML = "";
}

const workerOnMessage = async function (e) {
    if (e.data.type == "result") {
        awaitingResponse = false;
        await loadScript("js/libraries/sortable.min.js");
        await loadScript("js/libraries/echarts.min.js");
        await loadScript("js/libraries/xlsx.mini.min.js");
        clearResults();
        const winners = e.data.winners;
        const notes = e.data.notes;
        displayResults(instance, { winners, notes });
    } else if (e.data.type == "progress") {
        progressText.textContent = e.data.text;
    }
}

const workerOnError = function (e) {
    awaitingResponse = false;
    clearResults();
    document.getElementById('results-section').innerHTML = `<p><b>Error computing results:</b> ${e.message}</p>`;
}

function setUpWorker() {
    equalSharesWorker = new Worker("./js/methodOfEqualSharesWorker.js?v=1");
    equalSharesWorker.onmessage = workerOnMessage;
    equalSharesWorker.onerror = workerOnError;
    awaitingResponse = false;
}

function equalShares(instance, params) {
    if (awaitingResponse) {
        equalSharesWorker.terminate();
        setUpWorker();
    }
    awaitingResponse = true;
    equalSharesWorker.postMessage({ instance, params });
    document.getElementById('results-header').style.display = "block";
    clearResults();
    progress.style.display = "block";
}

let instance;

function computeRule() {
    if (!instance) return;
    equalShares(instance, equalSharesParams);
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (!document.querySelector(`script[src="${src}"]`)) {
            const scriptElement = document.createElement("script");
            scriptElement.src = src;
            scriptElement.onload = resolve; // Resolve the promise when the script is loaded
            scriptElement.onerror = reject; // Reject the promise if there's an error
            document.head.appendChild(scriptElement);
        } else {
            resolve(); // If the script is already loaded, resolve immediately
        }
    });
}

///////////////////////////////////////////////
////////////// loading .pb files //////////////
///////////////////////////////////////////////

async function handleFileDrop(fileName, fileText) {
    const fileInfoDiv = document.getElementById("fileInfo");
    fileInfoDiv.style.display = "flex";
    fileInfoDiv.innerHTML = "";
    const fileInfoImg = document.createElement("img");
    const fileInfoText = document.createElement("div");
    fileInfoDiv.appendChild(fileInfoImg);
    fileInfoDiv.appendChild(fileInfoText);
    fileInfoImg.width = 50;
    try {
        instance = parsePabulibFromString(fileText);
        // success
        fileInfoImg.src = "img/file-earmark-check.svg";
        document.getElementById('uploadBtn').style.backgroundColor = "#d1e7ff";
        document.getElementById('uploadBtn').style.color = "#000";
    } catch (error) {
        fileInfoText.innerHTML = `<b>Error parsing file ${fileName}.</b><br>${error.message}`;
        fileInfoImg.src = "img/file-earmark-x.svg";
        clearResults();
        return;
    }
    let info = `File: ${fileName}<br>`;
    // if (instance.meta.description) {
        info += `<b>${instance.meta.description}</b><br>`;
    // }
    info += `Budget limit: ${parseFloat(instance.meta.budget).toLocaleString()}<br>
    ${Object.keys(instance.projects).length} projects, ${Object.keys(instance.votes).length.toLocaleString()} votes`;
    if (Object.keys(instance.meta).includes("vote_type")) {
        if (instance.meta.vote_type != "approval") {
            info += `<br><i>Warning: File has vote type ${instance.meta.vote_type}. This calculator only supports approval votes, and the file has been interpreted as an approval instance, which will lead to different results.`;
        }
    } else {
        info += `<br><i>Warning: File does not specify vote type. Interpreting as approval vote.`;
    }
    fileInfoText.innerHTML = info;
    await computeRule();
}

///////////////////////////////////////////////
///////////////// Initialize //////////////////
///////////////////////////////////////////////

async function main() {
    initializeDragDrop(handleFileDrop);
    parseURLParameters(equalSharesParams);
    initializeForm(handleFileDrop, computeRule, equalSharesParams);
    setUpWorker();
}

document.addEventListener('DOMContentLoaded', function () {
    main();
    tippy('[data-tippy-content]');
});
