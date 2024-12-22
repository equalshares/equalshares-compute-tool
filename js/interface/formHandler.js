const tieBreakMethods = {
    "maxVotes": "Highest vote count",
    "minCost": "Lowest cost",
    "maxCost": "Highest cost",
    // "custom": "Custom tie-breaking order"
};

let equalSharesParams;
let paramsChanged;

function refreshTieBreakUI() {
    const criteriaList = document.getElementById('tieBreakingList');
    criteriaList.innerHTML = '';

    const availableMethods = document.getElementById('unusedTieBreakingMethods');
    availableMethods.innerHTML = '';

    if (equalSharesParams.tieBreaking.length === 0) {
        criteriaList.innerHTML = 'Tie breaking is <b>not active</b>: If a tie is encountered, no results will be computed and an error message will be displayed. To activate tie breaking, click on one of the methods below.';
    } else {
        let html = 'Tie breaking is <b>active</b>: <ul><li>If a tie is encountered, it is broken in favor of projects with the <b>';
        // lower case
        html += tieBreakMethods[equalSharesParams.tieBreaking[0]].toLowerCase() + '</b>.</li>';
        if (equalSharesParams.tieBreaking.length > 1) {
            html += '<li>If there is still a tie, it is broken in favor of projects with the <b>';
            html += tieBreakMethods[equalSharesParams.tieBreaking[1]].toLowerCase() + '</b>.</li>';
        }
        html += '<li>If there is still a tie, no results will be computed and an error message will be displayed.</li></ul>';
        criteriaList.innerHTML = html;
        const deleteButton = document.createElement('a');
        deleteButton.href = '#';
        deleteButton.textContent = 'Remove all tie-breaking methods';
        deleteButton.style.backgroundColor = 'hsl(213, 48%, 88%)';
        deleteButton.addEventListener('click', function () {
            equalSharesParams.tieBreaking = [];
            paramsChanged();
            refreshTieBreakUI();
        });
        availableMethods.appendChild(deleteButton);
    }

    const span = document.createElement('span');
    span.textContent = 'Add a tie-breaking method:';
    availableMethods.appendChild(span);

    const costUsed = equalSharesParams.tieBreaking.includes('minCost') || equalSharesParams.tieBreaking.includes('maxCost');
    let atLeastOneAvailable = false;

    for (const method in tieBreakMethods) {
        if (!equalSharesParams.tieBreaking.includes(method) && ((method !== 'minCost' && method !== 'maxCost') || !costUsed)) {
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = tieBreakMethods[method];
            link.addEventListener('click', function (e) {
                e.preventDefault();
                equalSharesParams.tieBreaking.push(method);
                paramsChanged();
                refreshTieBreakUI();
            });
            atLeastOneAvailable = true;
            availableMethods.appendChild(link);
        }
    }

    if (!atLeastOneAvailable) {
        availableMethods.removeChild(span);
    }
}

function refreshRadios() {
    // Initialization based on equalSharesParams values
    const completionRadios = document.querySelectorAll('input[name="completion_method"]');
    completionRadios.forEach(radio => {
        if (radio.value == equalSharesParams.completion) {
            radio.checked = true;
        }
    });

    const comparisonRadios = document.querySelectorAll('input[name="comparison_step"]');
    comparisonRadios.forEach(radio => {
        if (radio.value == equalSharesParams.comparison) {
            radio.checked = true;
        }
    });

    const accuracyRadios = document.querySelectorAll('input[name="accuracy"]');
    accuracyRadios.forEach(radio => {
        if (radio.value == equalSharesParams.accuracy) {
            radio.checked = true;
        }
    });

    // Add event listeners
    completionRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (radio.checked) {
                equalSharesParams.completion = radio.value;
                paramsChanged();
            }
        });
    });

    comparisonRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (radio.checked) {
                equalSharesParams.comparison = radio.value;
                paramsChanged();
            }
        });
    });

    accuracyRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (radio.checked) {
                equalSharesParams.accuracy = radio.value;
                paramsChanged();
            }
        });
    });

    for (let checkboxId of ["add_1_exhaustive", "add_1_integral"]) {
        const checkbox = document.getElementById(checkboxId);
        checkbox.addEventListener('change', function() {
            if (checkbox.checked) {
                equalSharesParams.add1options.push(checkboxId.split("_")[2]);
                equalSharesParams.add1options.sort();
            } else {
                equalSharesParams.add1options = equalSharesParams.add1options.filter(x => x !== checkboxId.split("_")[2]);
            }
            paramsChanged();
        });
    }

    const incrementInput = document.getElementById('budget_increment');
    incrementInput.addEventListener('blur', function() {
        equalSharesParams.increment = parseInt(incrementInput.value);
        paramsChanged();
    });
}

// Mapping from internal representation to display representation
const displayOptions = {
    ballots: {
        "approval": "Approval ballots",
        "score": "Score ballots",
    },
    tieBreaking: {
        "": "None",
        "maxVotes": "In favor of higher vote count",
        "minCost": "In favor of lower cost",
        "maxCost": "In favor of higher cost",
        "maxVotes,minCost": "In favor of higher vote count, then lower cost",
        "maxVotes,maxCost": "In favor of higher vote count, then higher cost",
        "minCost,maxVotes": "In favor of lower cost, then higher vote count",
        "maxCost,maxVotes": "In favor of higher cost, then higher vote count",
    },
    completion: function(increment) {
        return {
            "none": "None",
            "utilitarian": "Utilitarian (select the projects with the highest vote count)",
            "add1": `Repeated increase of voter budgets by ${increment} currency unit${increment !== 1 ? 's' : ''} (Add1)`,
            "add1u": `Repeated increase of voter budgets by ${increment} currency unit${increment !== 1 ? 's' : ''}, followed by utilitarian completion (Add1u)`,
        };
    },
    comparison: {
        "none": "None",
        "satisfaction": "Popularity with respect to voter satisfaction",
        "exclusionRatio": "Popularity with respect to exclusion ratio",
    },
    accuracy: {
        "floats": "Use floating point numbers (faster to compute, recommended for testing)",
        "fractions": "Use exact fractions (slower to compute, recommended for official results)",
    }
};

const headerText = {
    tieBreaking: "Tie-breaking",
    completion: "Completion method",
    comparison: "Comparison step",
    accuracy: "Numerical accuracy",
}

function showCurrentChoices() {
    // for showing current choices in <summary> elements
    for (let details of document.querySelectorAll('details')) {
        let field;
        try {
            field = details.dataset.field;
        } catch (e) { continue; }
        const summary = details.querySelector('summary');
        const options = field === 'completion' ? 
            displayOptions[field](equalSharesParams.increment) : 
            displayOptions[field];
        summary.innerHTML = `<strong>${headerText[field]}</strong>: ${options[equalSharesParams[field]].split('(')[0]}`;
    }
    // for showing add1 options
    const add1options = document.getElementById('add1options');
    const radio = document.querySelector('input[name="completion_method"]:checked');
    if (radio && radio.value.includes("add1")) {
        // move add1options to be a child of the parent of radio (if not already)
        if (add1options.parentNode !== radio.parentNode) {
            radio.parentNode.appendChild(add1options);
        }
        add1options.style.display = "block";
    } else {
        add1options.style.display = "none";
    }

    const incrementInput = document.getElementById('budget_increment');
    equalSharesParams.increment = equalSharesParams.increment || 1;
    incrementInput.value = equalSharesParams.increment;
    // update labels
    const add1Label = document.getElementById('add1_label');
    const add1uLabel = document.getElementById('add1u_label');
    const completionOptions = displayOptions.completion(equalSharesParams.increment);
    if (add1Label) add1Label.innerHTML = completionOptions.add1;
    if (add1uLabel) add1uLabel.innerHTML = completionOptions.add1u;
}

const defaultParams = {
    tieBreaking: [],
    completion: "add1u",
    add1options: ["exhaustive", "integral"],
    comparison: "none",
    accuracy: "floats",
    increment: 1
};

function addParametersToURL(equalSharesParams) {
    const url = new URL(window.location.href);
    for (let field in defaultParams) {
        let value = equalSharesParams[field];
        let defaultValue = defaultParams[field];
        // arrays -> comma-separated strings
        if (Array.isArray(value)) {
            value = value.join(',');
            defaultValue = defaultValue.join(',');
        }
        if (value !== defaultValue) {
            url.searchParams.set(field, value);
        } else {
            url.searchParams.delete(field);
        }
    }
    window.history.replaceState({}, '', url);
}

export function parseURLParameters(params) {
    const url = new URL(window.location.href);
    for (let field in defaultParams) {
        let value = url.searchParams.get(field);
        if (value !== null) {
            if (Array.isArray(defaultParams[field])) {
                value = value.split(',');
            }
            params[field] = value;
        }
    }
    return;
}

export function initializeForm(fileHandler, moduleParamsChanged, moduleEqualSharesParams) {
    let pabulibDataLoaded = false;
    equalSharesParams = moduleEqualSharesParams;
    paramsChanged = () => {
        addParametersToURL(equalSharesParams);
        showCurrentChoices();
        moduleParamsChanged();
    };

    refreshTieBreakUI();
    refreshRadios();
    showCurrentChoices();

    document.getElementById('uploadBtn').addEventListener('click', function () {
        // Trigger click event on hidden file input
        document.getElementById('hiddenFileInput').click();
    });

    document.getElementById('hiddenFileInput').addEventListener('change', function (event) {
        var file = event.target.files[0];
        if (file) {
            var reader = new FileReader();
            reader.onload = function (e) {
                var content = e.target.result;
                fileHandler(file.name, content);
            };
            reader.readAsText(file);
        }
    });

    document.getElementById('pabulibLoadButton').addEventListener('click', function () {
        const pabulibArea = document.getElementById('pabulibList');
        
        if (pabulibDataLoaded) {
            // Toggle visibility if data is already loaded
            pabulibArea.style.display = pabulibArea.style.display === 'none' ? 'block' : 'none';
            return;
        }

        pabulibArea.innerHTML = 'Loading list of available files...';
        pabulibArea.style.display = 'block';

        fetch('./pb/_pabulib.json')
            .then(response => response.json())
            .then(data => {
                pabulibArea.innerHTML = '';
                
                // Sort countries alphabetically
                Object.keys(data).sort().forEach(country => {
                    const countryDetails = document.createElement('details');
                    const countrySummary = document.createElement('summary');
                    countrySummary.textContent = country;
                    countryDetails.appendChild(countrySummary);
                    
                    const unitList = document.createElement('ul');
                    
                    // Sort units alphabetically
                    Object.keys(data[country]).sort().forEach(unit => {
                        const unitItem = document.createElement('li');
                        unitItem.textContent = unit;
                        
                        const fileList = document.createElement('ul');
                        const files = data[country][unit].sort((a, b) => a.filename.localeCompare(b.filename));
                        
                        const createFileElement = (file) => {
                            const fileItem = document.createElement('li');
                            const fileLink = document.createElement('span');
                            fileLink.className = 'pabulib-file';
                            const descriptionSpan = document.createElement('span');
                            descriptionSpan.textContent = file.description;
                            descriptionSpan.className = 'pabulib-description';
                            fileLink.appendChild(descriptionSpan);
                            const fileNameSpan = document.createElement('span');
                            fileNameSpan.textContent = file.filename;
                            fileNameSpan.className = 'pabulib-filename';
                            fileLink.appendChild(fileNameSpan);
                            fileLink.addEventListener('click', (e) => {
                                e.preventDefault();
                                pabulibArea.style.display = 'none';
                                fetch(`./pb/${file.filename}`)
                                    .then(response => response.text())
                                    .then(text => fileHandler(file.filename, text));
                            });
                            fileItem.appendChild(fileLink);
                            return fileItem;
                        };

                        const initialFiles = files.slice(0, 12);
                        initialFiles.forEach(file => {
                            fileList.appendChild(createFileElement(file));
                        });

                        if (files.length > 12) {
                            const showMoreItem = document.createElement('li');
                            const showMoreLink = document.createElement('a');
                            showMoreLink.href = '#';
                            showMoreLink.textContent = `Show ${files.length - 12} more files...`;
                            showMoreLink.className = 'pabulib-show-more';
                            showMoreLink.addEventListener('click', (e) => {
                                e.preventDefault();
                                const remainingFiles = files.slice(12);
                                remainingFiles.forEach(file => {
                                    fileList.appendChild(createFileElement(file));
                                });
                                showMoreItem.remove();
                            });
                            showMoreItem.appendChild(showMoreLink);
                            fileList.appendChild(showMoreItem);
                        }
                        
                        unitItem.appendChild(fileList);
                        unitList.appendChild(unitItem);
                    });
                    
                    countryDetails.appendChild(unitList);
                    pabulibArea.appendChild(countryDetails);
                });

                pabulibDataLoaded = true;
            });
    });
}
