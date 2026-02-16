function renderPreviewFromWorkbook(workbook) {
    const worksheet = workbook.Sheets["Schedule"];
    // Get raw data
    const jsonSheet = XLSX.utils.sheet_to_json(worksheet, {header: 1});
    const tableBody = document.getElementById('table-body');
    const tableHead = document.getElementById('table-head-row');
    
    tableBody.innerHTML = '';
    tableHead.innerHTML = '';

    if (jsonSheet.length > 0) {
        // --- 1. Determine Column Limit ---
        // We want to stop rendering when we hit the first Empty Header (the spacer column)
        // This hides the side-panel info from the preview, but keeps it in the Excel.
        let colLimit = jsonSheet[0].length;
        
        for (let i = 0; i < jsonSheet[0].length; i++) {
            let h = jsonSheet[0][i];
            let val = (h && typeof h === 'object') ? h.v : h;
            if (val === "" || val === undefined) {
                colLimit = i; // Stop exactly here
                break;
            }
        }

        // --- 2. Render Header (Up to colLimit) ---
        for (let i = 0; i < colLimit; i++) {
            let h = jsonSheet[0][i];
            let val = (h && typeof h === 'object') ? h.v : h;
            tableHead.innerHTML += `<th class="py-3 px-6 bg-gray-100 border-b font-bold whitespace-nowrap text-center">${val || ""}</th>`;
        }

        // --- 3. Render Data Rows (Up to colLimit) ---
        for (let i = 1; i < jsonSheet.length; i++) {
            const row = jsonSheet[i];
            
            // Skip totally empty rows
            if (!row || row.length === 0) continue;

            let tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50";

            for (let c = 0; c < colLimit; c++) {
                let cell = row[c];
                let val = (cell && typeof cell === 'object') ? cell.v : (cell || "");
                
                // Clean text for preview (1st line only)
                if (typeof val === 'string' && val.includes('\n')) {
                    val = val.split('\n')[0]
                }
                tr.innerHTML += `<td class="py-3 px-6 border-b whitespace-nowrap text-center">${val}</td>`;
            }
            tableBody.appendChild(tr);
        }
        
        document.getElementById('result-container').classList.remove('hidden');
    }
}