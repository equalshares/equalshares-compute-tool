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

    filetext.split('\n').forEach(line => {
        lineNumber++;
        if (line.trim().length === 0) return;
        const row = line.split(';');

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

            if (projectIdIdx === -1 || costIdx === -1 || nameIdx === -1) {
                throw new Error(`Line ${lineNumber}: Missing required column(s) in projects section: ${projectIdIdx === -1 ? 'project_id ' : ''}${costIdx === -1 ? 'cost ' : ''}${nameIdx === -1 ? 'name' : ''}.`);
            }

            const projectId = row[projectIdIdx].trim();
            if (projectIdsSet.has(projectId)) {
                throw new Error(`Line ${lineNumber}: Duplicate project ID '${projectId}' found.`);
            }

            if (!row[projectIdIdx] || isNaN(row[costIdx]) || !row[nameIdx]) {
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

        } else if (section === "votes") {
            const voterIdIdx = header.indexOf("voter_id");
            const voteIdx = header.indexOf("vote");

            if (voterIdIdx === -1 || voteIdx === -1) {
                throw new Error(`Line ${lineNumber}: Missing required column(s) in votes section: ${voterIdIdx === -1 ? 'voter_id ' : ''}${voteIdx === -1 ? 'vote' : ''}.`);
            }

            const voterId = row[voterIdIdx].trim();
            if (voterIdsSet.has(voterId)) {
                throw new Error(`Line ${lineNumber}: Duplicate voter ID '${voterId}' found.`);
            }

            if (row[voteIdx] !== '') { // Empty votes are allowed
                const projectIds = row[voteIdx].split(',');
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
    

    if (isNaN(meta['budget'])) {
        throw new Error("The 'budget' in the meta section is not a numeric value.");
    }

    return { meta, projects, votes, approvers };
}
