export function parsePabulibFromString(filetext) {
    const meta = {};
    const projects = {};
    const votes = {};
    const approvers = {};
    const projectIdsSet = new Set();
    const voterIdsSet = new Set();
    const encounteredSections = new Set();

    let section = "";
    let header = [];

    let lineNumber = 0;

    // CSV parsing helper function to handle escaping
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        let i = 0;
        
        while (i < line.length) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                    // Escaped quote
                    current += '"';
                    i += 2;
                } else {
                    // Toggle quote mode
                    inQuotes = !inQuotes;
                    i++;
                }
            } else if (char === ';' && !inQuotes) {
                // Field separator
                result.push(current);
                current = '';
                i++;
            } else {
                current += char;
                i++;
            }
        }
        
        // Add the last field
        result.push(current);
        return result;
    }

    filetext.split('\n').forEach(line => {
        lineNumber++;
        if (line.trim().length === 0) return;
        const row = parseCSVLine(line);

        if (['meta', 'projects', 'votes'].includes(row[0].trim().toLowerCase())) {
            section = row[0].trim().toLowerCase();
            encounteredSections.add(section);
            header = [];
            return;
        }

        if (header.length === 0) {
            header = row.map(col => col.trim());
            if (section === "meta") {
                if (header[0] !== "key" || header[1] !== "value") {
                    throw new Error(`Line ${lineNumber}: Invalid header in meta section (expecting "key;value").`);
                }
            }
            return;
        }

        if (section === "meta") {
            meta[row[0]] = row[1].trim();
        } else if (section === "projects") {
            const projectIdIdx = header.indexOf("project_id");
            const costIdx = header.indexOf("cost");
            const nameIdx = header.indexOf("name");

            if (projectIdIdx === -1 || costIdx === -1) {
                throw new Error(`Line ${lineNumber}: Missing required column(s) in projects section: ${projectIdIdx === -1 ? 'project_id ' : ''}${costIdx === -1 ? 'cost' : ''}.`);
            }

            const projectId = row[projectIdIdx].trim();
            if (projectIdsSet.has(projectId)) {
                throw new Error(`Line ${lineNumber}: Duplicate project ID '${projectId}' found.`);
            }

            if (!row[projectIdIdx] || isNaN(row[costIdx])) {
                throw new Error(`Line ${lineNumber}: Invalid or missing values in projects section.`);
            }

            if (row.length !== header.length) {
                throw new Error(`Line ${lineNumber}: Invalid number of columns in projects section.`);
            }

            projectIdsSet.add(projectId);
            projects[projectId] = {};
            approvers[projectId] = [];

            for (let it = 0; it < header.length; it++) {
                projects[projectId][header[it].trim()] = row[it].trim();
            }

            // If no name column or empty name, use project_id as name
            if (nameIdx === -1 || !projects[projectId]['name'] || projects[projectId]['name'].trim() === '') {
                projects[projectId]['name'] = projectId;
            }

        } else if (section === "votes") {
            const voterIdIdx = header.indexOf("voter_id");
            const voteIdx = header.indexOf("vote");
            const pointsIdx = header.indexOf("points");

            if (voterIdIdx === -1 || voteIdx === -1) {
                throw new Error(`Line ${lineNumber}: Missing required column(s) in votes section: ${voterIdIdx === -1 ? 'voter_id ' : ''}${voteIdx === -1 ? 'vote' : ''}.`);
            }

            if (row.length !== header.length) {
                throw new Error(`Line ${lineNumber}: Invalid number of columns in votes section.`);
            }

            const voterId = row[voterIdIdx].trim();
            if (voterIdsSet.has(voterId)) {
                throw new Error(`Line ${lineNumber}: Duplicate voter ID '${voterId}' found.`);
            }

            if (row[voteIdx] !== '') { // Empty votes are allowed
                const projectIds = row[voteIdx].split(',');

                // If points column exists and has data, parse it
                let pointsArray = [];
                if (pointsIdx !== -1 && row[pointsIdx] && row[pointsIdx].trim() !== '') {
                    pointsArray = row[pointsIdx].split(',').map(p => p.trim());

                    // Validate that the number of points matches the number of projects
                    if (pointsArray.length !== projectIds.length) {
                        throw new Error(`Line ${lineNumber}: Number of points (${pointsArray.length}) does not match number of projects voted for (${projectIds.length}).`);
                    }
                }

                projectIds.forEach(projectId => {
                    if (!projectIdsSet.has(projectId.trim())) {
                        throw new Error(`Line ${lineNumber}: Invalid project ID '${projectId.trim()}' found in vote.`);
                    }

                    approvers[projectId.trim()].push(voterId);
                });
            }

            voterIdsSet.add(voterId);
            votes[voterId] = {};
            for (let it = 0; it < header.length; it++) {
                votes[voterId][header[it].trim()] = row[it].trim();
            }
        }
    });

    ['meta', 'projects', 'votes'].forEach(sectionName => {
        if (!encounteredSections.has(sectionName)) {
            throw new Error(`The file is missing the required '${sectionName}' section.`);
        }
    });

    // Validate mandatory META fields
    const mandatoryMetaFields = [
        'description', 'country', 'unit', 'instance',
        'num_projects', 'num_votes', 'budget',
        'vote_type', 'rule', 'date_begin', 'date_end'
    ];

    for (const field of mandatoryMetaFields) {
        if (!meta[field] || meta[field].trim() === '') {
            throw new Error(`The meta section is missing the required field '${field}'.`);
        }
    }

    // Validate that budget is numeric
    if (isNaN(meta['budget'])) {
        throw new Error("The 'budget' in the meta section is not a numeric value.");
    }

    // Validate that num_projects is numeric
    if (isNaN(meta['num_projects'])) {
        throw new Error("The 'num_projects' in the meta section is not a numeric value.");
    }

    // Validate that num_votes is numeric
    if (isNaN(meta['num_votes'])) {
        throw new Error("The 'num_votes' in the meta section is not a numeric value.");
    }

    // Validate that num_projects matches actual project count
    const actualProjectCount = Object.keys(projects).length;
    if (parseInt(meta['num_projects']) !== actualProjectCount) {
        throw new Error(`The 'num_projects' value (${meta['num_projects']}) does not match the actual number of projects (${actualProjectCount}).`);
    }

    // Validate that num_votes matches actual vote count
    const actualVoteCount = Object.keys(votes).length;
    if (parseInt(meta['num_votes']) !== actualVoteCount) {
        throw new Error(`The 'num_votes' value (${meta['num_votes']}) does not match the actual number of votes (${actualVoteCount}).`);
    }

    // Validate vote_type is one of the allowed values
    const allowedVoteTypes = ['approval', 'ordinal', 'cumulative', 'scoring', 'choose-1'];
    if (!allowedVoteTypes.includes(meta['vote_type'])) {
        throw new Error(`The 'vote_type' value '${meta['vote_type']}' is not valid. Must be one of: ${allowedVoteTypes.join(', ')}.`);
    }

    // Validate that 'points' field is present for cumulative and scoring vote types
    if (meta['vote_type'] === 'cumulative' || meta['vote_type'] === 'scoring') {
        // Check if any vote has the points field (we only check the structure, not every vote)
        const sampleVote = Object.values(votes)[0];
        if (sampleVote && !sampleVote.hasOwnProperty('points')) {
            throw new Error(`The vote_type is '${meta['vote_type']}', which requires a 'points' column in the VOTES section.`);
        }
    }

    return { meta, projects, votes, approvers };
}