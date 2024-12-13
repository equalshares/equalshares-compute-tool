importScripts('./libraries/fraction.min.js');

function sum(arr) {
    var res = 0;
    for (var x of arr) {
        res += x;
    }
    return res;
}

function fractionSum(xs, zero) {
    return xs.reduce((a, b) => a.add(b), zero);
}

function breakTies(N, C, cost, approvers, params, choices) {
    let remaining = [...choices];
    for (let method of params.tieBreaking) {
        if (method == "maxVotes") {
            const bestCount = Math.max(...remaining.map(c => approvers[c].length));
            remaining = remaining.filter(c => approvers[c].length == bestCount);
        } else if (method == "minCost") {
            const bestCost = Math.min(...remaining.map(c => cost[c]));
            remaining = remaining.filter(c => cost[c] == bestCost);
        } else if (method == "maxCost") {
            const bestCost = Math.max(...remaining.map(c => cost[c]));
            remaining = remaining.filter(c => cost[c] == bestCost);
        } else {
            // check that method is a list
            if (!Array.isArray(method)) {
                throw `Unknown tie-breaking method: ${method}`;
            }
            // take the first remaining candidate in list
            for (let c of remaining) {
                if (method.includes(c)) {
                    remaining = [c];
                    break;
                }
            }
        }
    }
    if (remaining.length == 0) {
        throw `Tie-breaking failed in a way that should not happen: ${choices}`;
    }
    return remaining;
}

function equalSharesFixedBudgetFractions(N, C, cost, approvers, B, params, reportDetails=false, reportProgress=false) {
    let budget = {};
    for (let i of N) {
        budget[i] = new Fraction(B).div(N.length);
    }
    // keep track of numbers to report them for result explanation
    const report = {};
    report.moneyBehindCandidate = {};
    report.effectiveVoteCount = {};
    report.endowment = B / N.length;
    let remaining = new Map(); // remaining candidate -> previous effective vote count
    for (let c of C) {
        if (cost[c] > 0 && approvers[c].length > 0) {
            remaining.set(c, new Fraction(approvers[c].length));
        }
        report.moneyBehindCandidate[c] = [];
        report.effectiveVoteCount[c] = [];
    }
    let winners = [];
    while (true) {
        let best = [];
        let bestEffVoteCount = 0;
        // go through remaining candidates in order of decreasing previous effective vote count
        let remainingSorted = [...remaining.keys()];
        remainingSorted.sort((a, b) => remaining.get(b).compare(remaining.get(a)));
        for (let c of remainingSorted) {
            let previousEffVoteCount = remaining.get(c);
            if (previousEffVoteCount.compare(bestEffVoteCount) < 0 && !reportDetails) {
                // c cannot be better than the best so far
                // only use this optimization if we don't need to report detailed results
                break;
            }
            const moneyBehindNow = fractionSum(approvers[c].map(i => budget[i]), new Fraction(0))
            report.moneyBehindCandidate[c].push(moneyBehindNow.valueOf()); // convert to float
            if (moneyBehindNow.compare(cost[c]) < 0) {
                // c is not affordable
                remaining.delete(c);
                report.effectiveVoteCount[c].push(0);
                continue;
            }
            // calculate the effective vote count of c, which involves splitting the cost of c as equally as possible among its approvers
            approvers[c].sort((a, b) => budget[a].compare(budget[b]));
            let paidSoFar = new Fraction(0);
            let denominator = approvers[c].length; // this will be the number of approvers who can afford the max payment
            for (let j = 0; j < approvers[c].length; j++) {
                let i = approvers[c][j];
                let maxPayment = new Fraction(cost[c]).sub(paidSoFar).div(denominator); // payment if remaining approvers pay equally
                let effVoteCount = new Fraction(cost[c]).div(maxPayment);
                if (maxPayment.compare(budget[i]) > 0) {
                    // i cannot afford the max payment, so pays entire remaining budget
                    paidSoFar = paidSoFar.add(budget[i]);
                    denominator -= 1;
                } else {
                    // i (and all later approvers) can afford the max payment; stop here
                    remaining.set(c, effVoteCount);
                    report.effectiveVoteCount[c].push(effVoteCount.valueOf());
                    if (effVoteCount.compare(bestEffVoteCount) > 0) {
                        bestEffVoteCount = effVoteCount;
                        best = [c];
                    } else if (effVoteCount.equals(bestEffVoteCount)) {
                        best.push(c);
                    }
                    break;
                }
            }
        }
        if (best.length == 0) {
            // no remaining candidates are affordable
            break;
        }
        best = breakTies(N, C, cost, approvers, params, best);
        // if best is null, raise an error
        if (best.length > 1) {
            throw new Error(`Tie-breaking failed: tie between projects ${best.join(", ")} could not be resolved. Another tie-breaking needs to be added.`);
        }
        best = best[0];
        winners.push(best);
        if (reportProgress) {
            postMessage({ type: "progress", text: `${Math.floor( 100 * sum(winners.map(c => cost[c])) / B )}%` });
        }
        let bestMaxPayment = new Fraction(cost[best]).div(bestEffVoteCount);
        for (let i of approvers[best]) {
            if (budget[i].compare(bestMaxPayment) > 0) {
                budget[i] = budget[i].sub(bestMaxPayment);
            } else {
                budget[i] = new Fraction(0);
            }
        }
        remaining.delete(best);
    }
    return { winners, report };
}

function equalSharesFixedBudgetFloats(N, C, cost, approvers, B, params, reportDetails=false, reportProgress=false) {
    let budget = {};
    const endowment = B / N.length;
    for (let i of N) {
        budget[i] = endowment;
    }
    // keep track of numbers to report them for result explanation
    const report = {};
    report.moneyBehindCandidate = {};
    report.effectiveVoteCount = {};
    report.endowment = B / N.length;
    let remaining = new Map(); // remaining candidate -> previous effective vote count
    for (let c of C) {
        if (cost[c] > 0 && approvers[c].length > 0) {
            remaining.set(c, approvers[c].length);
        }
        report.moneyBehindCandidate[c] = [];
        report.effectiveVoteCount[c] = [];
    }
    let winners = [];
    while (true) {
        let best = [];
        let bestEffVoteCount = 0;
        // go through remaining candidates in order of decreasing previous effective vote count
        let remainingSorted = [...remaining.keys()];
        remainingSorted.sort((a, b) => remaining.get(b) - remaining.get(a));
        for (let c of remainingSorted) {
            let previousEffVoteCount = remaining.get(c);
            if (previousEffVoteCount < bestEffVoteCount && !reportDetails) {
                // c cannot be better than the best so far
                // only use this optimization if we don't need to report detailed results
                break;
            }
            const moneyBehindNow =  sum(approvers[c].map(i => budget[i]));
            report.moneyBehindCandidate[c].push(moneyBehindNow);
            if (moneyBehindNow < cost[c]) {
                // c is not affordable
                remaining.delete(c);
                report.effectiveVoteCount[c].push(0);
                continue;
            }
            // calculate the effective vote count of c, which involves splitting the cost of c as equally as possible among its approvers
            approvers[c].sort((a, b) => budget[a] - budget[b]);
            let paidSoFar = 0;
            let denominator = approvers[c].length; // this will be the number of approvers who can afford the max payment
            for (let j = 0; j < approvers[c].length; j++) {
                const i = approvers[c][j];
                const maxPayment = (cost[c] - paidSoFar) / denominator; // payment if remaining approvers pay equally
                if (maxPayment > budget[i]) {
                    // i cannot afford the max payment, so pays entire remaining budget
                    paidSoFar += budget[i];
                    denominator -= 1;
                } else {
                    const effVoteCount = cost[c] / maxPayment;
                    // i (and all later approvers) can afford the max payment; stop here
                    remaining.set(c, effVoteCount);
                    report.effectiveVoteCount[c].push(effVoteCount);
                    if (effVoteCount > bestEffVoteCount) {
                        bestEffVoteCount = effVoteCount;
                        best = [c];
                    } else if (effVoteCount == bestEffVoteCount) {
                        best.push(c);
                    }
                    break;
                }
            }
        }
        if (best.length == 0) {
            // no remaining candidates are affordable
            if (remaining.size > 0) {
                throw new Error(`No available candidate found even though there are still affordable candidates: ${remaining}`);
            }
            break;
        }
        best = breakTies(N, C, cost, approvers, params, best);
        // if best is null, raise an error
        if (best.length > 1) {
            throw new Error(`Tie-breaking failed: tie between projects ${best.join(", ")} could not be resolved. Another tie-breaking needs to be added.`);
        }
        best = best[0];
        winners.push(best);
        if (reportProgress) {
            postMessage({ type: "progress", text: `${Math.floor( 100 * sum(winners.map(c => cost[c])) / B )}%` });
        }
        let bestMaxPayment = cost[best] / bestEffVoteCount;
        for (let i of approvers[best]) {
            if (budget[i] > bestMaxPayment) {
                budget[i] -= bestMaxPayment;
            } else {
                budget[i] = 0;
            }
        }
        remaining.delete(best);
    }
    return { winners, report };
}

function equalSharesFixedBudget(N, C, cost, approvers, B, params, reportDetails=false, reportProgress=false) {
    if (params.accuracy === "fractions") {
        return equalSharesFixedBudgetFractions(N, C, cost, approvers, B, params, reportDetails, reportProgress);
    } else if (params.accuracy === "floats") {
        return equalSharesFixedBudgetFloats(N, C, cost, approvers, B, params, reportDetails, reportProgress);
    } else {
        throw 'Unknown accuracy parameter';
    }
}

function equalSharesAdd1(N, C, cost, approvers, B, params) {
    // Method of Equal Shares with Add1 completion
    // Input:
    //   N: list of voters
    //   C: list of candidates
    //   cost[c]: cost of candidate c
    //   approvers[c]: list of voters who approve candidate c
    //   B: budget
    // Output:
    //   committee: list of candidates
    let startBudget = B;
    if (params.add1options.includes("integral")) {
        const perVoter = Math.floor(B / N.length);
        startBudget = perVoter * N.length;
    }
    let mes = equalSharesFixedBudget(N, C, cost, approvers, startBudget, params, false, true).winners;
    let currentCost = sum(mes.map(c => cost[c]));
    postMessage({ type: "progress", text: `${Math.floor( 100 * currentCost / B )}%` });
    let budget = startBudget;
    while (true) {
        if (params.add1options.includes("exhaustive")) {
            // is current outcome exhaustive?
            let isExhaustive = true;
            for (let extra of C) {
                if (!mes.includes(extra) && currentCost + cost[extra] <= B) {
                    isExhaustive = false;
                    break;
                }
            }
            if (isExhaustive) {
                break;
            }
        }
        // would the next highest budget work?
        let nextBudget = budget + (N.length * params.increment);
        let nextMes = equalSharesFixedBudget(N, C, cost, approvers, nextBudget, params).winners;
        currentCost = sum(nextMes.map(c => cost[c]));
        if (currentCost <= B) {
            postMessage({ type: "progress", text: `${Math.floor( 100 * currentCost / B )}%` });
            budget = nextBudget;
            mes = nextMes;
        } else {
            break;
        }
    }
    // recompute with final budget while reporting details
    postMessage({ type: "progress", text: `Finishing` });
    let result = equalSharesFixedBudget(N, C, cost, approvers, budget, params, true);
    return { winners: result.winners, report: result.report };
}

function utilitarianCompletion(N, C, cost, approvers, B, alreadyWinners) {
    let winners = [...alreadyWinners];
    let costSoFar = sum(winners.map(c => cost[c]));
    // sort candidates by number of approvers
    let sortedC = [...C];
    let addedByUtlitarianCompletion = [];
    sortedC.sort((a, b) => approvers[b].length - approvers[a].length);
    // for each candidate in order of decreasing number of approvers, try to add it to the committee
    for (let c of sortedC) {
        if (winners.includes(c) || costSoFar + cost[c] > B) {
            continue;
        }
        winners.push(c);
        addedByUtlitarianCompletion.push(c);
        costSoFar += cost[c];
    }
    return { winners, addedByUtlitarianCompletion };
}

function comparisonStep(N, C, cost, approvers, B, greedy, winners, params) {
    let prefersMES = 0;
    let prefersGreedy = 0;
    if (params.comparison == "satisfaction") {
        // compute utilities
        const mesSatisfaction = {};
        const greedySatisfaction = {};
        for (let [candidates, satisfaction] of [[winners, mesSatisfaction], [greedy, greedySatisfaction]]) {
            for (let c of candidates) {
                for (let i of approvers[c]) {
                    if (!satisfaction[i]) {
                        satisfaction[i] = 0;
                    }
                    satisfaction[i]++;
                }
            }
        }
        for (let i of N) {
            if (mesSatisfaction[i] > greedySatisfaction[i]) {
                prefersMES++;
            } else if (greedySatisfaction[i] > mesSatisfaction[i]) {
                prefersGreedy++;
            }
        }
    } else if (params.comparison == "exclusionRatio") {
        // by taking a union of the approvers of a committee, figure out how many voters approve at least one winner
        const mesApprovals = new Set();
        for (let c of winners) {
            for (let i of approvers[c]) {
                mesApprovals.add(i);
            }
        }
        const greedyApprovals = new Set();
        for (let c of greedy) {
            for (let i of approvers[c]) {
                greedyApprovals.add(i);
            }
        }
        for (let i of N) {
            if (mesApprovals.has(i) && !greedyApprovals.has(i)) {
                prefersMES++;
            } else if (greedyApprovals.has(i) && !mesApprovals.has(i)) {
                prefersGreedy++;
            }
        }
    }
    let stickToMES = true;
    if (prefersGreedy > prefersMES) {
        stickToMES = false;
    }
    return { stickToMES, prefersMES, prefersGreedy };
}

function gatherOutcomeStatistics(N, C, cost, approvers, B, winners) {
    const stats = {};
    stats.totalCost = sum(winners.map(c => cost[c]));
    stats.avgApprovedProjects = sum(winners.map(c => approvers[c].length)) / N.length;
    stats.avgCostOfWinningApprovedProjects = sum(winners.map(c => approvers[c].length * cost[c])) / N.length;
    // compute voter utility
    const voterUtility = {};
    for (let i of N) {
        voterUtility[i] = 0;
    }
    for (let c of winners) {
        for (let i of approvers[c]) {
            voterUtility[i]++;
        }
    }
    // for each r, how many voters approve exactly r winning projects?
    stats.utilityDistribution = {};
    for (let util = 0; util <= winners.length; util++) {
        stats.utilityDistribution[util] = 0;
    }
    for (let i of N) {
        stats.utilityDistribution[voterUtility[i]] += 1;
    }
    return stats;
}

function equalShares(instance, params) {
    const { meta, projects, votes, approvers } = instance;
    const N = Object.keys(votes);
    const C = Object.keys(projects);
    let cost, B;
    try {
        cost = Object.fromEntries(C.map(c => [c, parseFloat(projects[c].cost)]));
        B = parseFloat(meta.budget);
    } catch (error) {
        throw `Error parsing costs and budget as numbers: ${error.message}`;
    }

    const everythingAffordable = sum(Object.values(cost)) <= B;

    // compute MES
    let result;
    if (["none", "utilitarian"].includes(params.completion) || everythingAffordable) { // don't use Add1 if everything is affordable
        result = equalSharesFixedBudget(N, C, cost, approvers, B, params, true, true);
    } else if (["add1", "add1e", "add1u", "add1eu"].includes(params.completion)) {
        result = equalSharesAdd1(N, C, cost, approvers, B, params);
    } else {
        throw "Unknown completion rule: " + params.completion;
    }
    
    let winners = result.winners;
    const notes = {
        endowment: result.report.endowment,
        moneyBehindCandidate: result.report.moneyBehindCandidate,
        effectiveVoteCount: result.report.effectiveVoteCount,
    };

    // utilitarian completion if needed
    if (["utilitarian", "add1u"].includes(params.completion)) {
        const completionResult = utilitarianCompletion(N, C, cost, approvers, B, winners);
        winners = completionResult.winners;
        notes.addedByUtlitarianCompletion = completionResult.addedByUtlitarianCompletion;
    }

    // comparison step
    const greedyOutput = utilitarianCompletion(N, C, cost, approvers, B, []);
    const greedy = greedyOutput.winners;
    if (params.comparison !== "none") {
        const { stickToMES, prefersMES, prefersGreedy } = comparisonStep(N, C, cost, approvers, B, greedy, winners, params);
        if (!stickToMES) {
            winners = greedy;
            notes.comparison = `The committee chosen by the greedy algorithm is preferred by ${prefersGreedy} voters, while the committee chosen by the method of equal shares is preferred by ${prefersMES} voters.`;
        }
    }

    // compute stats
    notes.stats = gatherOutcomeStatistics(N, C, cost, approvers, B, winners);
    notes.greedyStats = gatherOutcomeStatistics(N, C, cost, approvers, B, greedy);

    return { winners, notes };
}

onmessage = (e) => {
    const startTime = performance.now();
    const { instance, params } = e.data;
    let { winners, notes } = equalShares(instance, params);
    const endTime = performance.now();
    notes.time = ((endTime - startTime) / 1000).toFixed(1);
    postMessage({ type: "result", winners, notes });
}
