// Description: This file contains functions for generating bar charts in table cells - each cell gets a partial background color in line with the value of the cell.

export function generateTableBarCharts({ tableElement, columnIndex, barWidth, barColor }) {
    let rows = tableElement.rows;
    if (rows.length <= 1) return; // No data in the table

    // Get maximum value in the column
    let maxVal = -Infinity;
    for (let i = 1; i < rows.length; i++) {
        let cellValue = parseFloat(rows[i].cells[columnIndex].dataset.value);
        if (cellValue > maxVal) {
            maxVal = cellValue;
        }
    }

    // Create a dummy label for measuring widths
    let dummyLabel = document.createElement('span');
    dummyLabel.id = 'dummy-label';
    document.body.appendChild(dummyLabel);

    // Update cells with bar charts
    for (let i = 1; i < rows.length; i++) {
        let cell = rows[i].cells[columnIndex];
        let cellValue = parseFloat(cell.dataset.value);
        let percentage = (cellValue / maxVal) * 100;

        // Create the bar chart
        let barContainer = document.createElement('div');
        barContainer.classList.add('bar-container');
        barContainer.style.width = barWidth + 'px';

        let bar = document.createElement('div');
        bar.classList.add('bar');
        bar.style.width = percentage + '%';
        bar.style.backgroundColor = barColor;

        let valueLabel = document.createElement('span');
        valueLabel.innerText = cell.innerText;

        // Use dummy label to measure width
        dummyLabel.textContent = cell.innerText;
        let labelWidth = dummyLabel.getBoundingClientRect().width;
        
        bar.appendChild(valueLabel);
        barContainer.appendChild(bar);
        cell.innerHTML = ''; // Clear existing content
        cell.appendChild(barContainer);

        let innerBarWidth = barWidth * percentage / 100;

        if (labelWidth > innerBarWidth) {
            valueLabel.classList.add('outside');
        }
    }

    document.body.removeChild(dummyLabel);
}
