// --- STATE MANAGEMENT ---
// Stores all available tasks in memory so we can search/filter them
let leftSideState = []; 
let currentWorkbook = null; // Stores generated Excel file

// ==========================================================
// 1. INITIALIZATION & DROPDOWNS
// ==========================================================

window.onload = function() { initSelectors(); };

function initSelectors() {
    const sel1 = document.getElementById('sel1');
    const sel2 = document.getElementById('sel2');

    // 1. Initialize Program Dropdown (sel1)
    sel1.innerHTML = '<option value="" disabled selected>Επέλεξε Πρόγραμμα...</option>';
    if (appData.period_names) {
        appData.period_names.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item; 
            opt.textContent = item; 
            sel1.appendChild(opt);
        });
    }

    // 2. Reset Department Dropdown (sel2) to initial state
    sel2.innerHTML = '<option value="" disabled selected>Πρώτα Eπέλεξε Πρόγραμμα...</option>';

    // 3. Add Event Listener to sel1
    sel1.onchange = function() {
        updateDepartmentSelector(this.value);
        updateAvailableTasks(); // Clear lists/state
    };

    // 4. Add Event Listener to sel2
    sel2.onchange = updateAvailableTasks;

    updateCounts();
}


function updateDepartmentSelector(selectedProgram) {
    const sel2 = document.getElementById('sel2');
    sel2.innerHTML = '<option value="" disabled selected>Επέλεξε Τμήμα...</option>';

    if (!appData.departments) return;

    // Get all department keys and sort them
    const sortedKeys = Object.keys(appData.departments).sort((a, b) => 
        a.localeCompare(b, 'el', { sensitivity: 'base' })
    );

    sortedKeys.forEach(deptKey => {
        const programData = appData.departments[deptKey][selectedProgram];
        
        // --- LOGIC: Only add if list/object is NOT empty ---
        let hasData = false;
        if (Array.isArray(programData)) {
            hasData = programData.length > 0;
        } else if (programData && typeof programData === 'object') {
            hasData = Object.keys(programData).length > 0;
        }

        if (hasData) {
            const opt = document.createElement('option');
            opt.value = deptKey;
            
            // Apply your existing text cleaning logic
            let displayText = deptKey;
            try { 
                displayText = deptKey.replace(']', '').split(' ').slice(1).join(' '); 
            } catch (e) {}
            
            opt.textContent = displayText;
            sel2.appendChild(opt);
        }
    });
}


function updateAvailableTasks() {
    const sel1 = document.getElementById('sel1').value;
    const sel2 = document.getElementById('sel2').value;
    const rightList = document.getElementById('list-right');
    
    // Clear right list when changing context
    rightList.innerHTML = ''; 
    
    // Clear Search Input
    const searchInput = document.getElementById('search-left');
    if (searchInput) searchInput.value = '';

    if (sel1 && sel2) {
        const departmentData = appData.departments?.[sel2]?.[sel1];
        
        if (departmentData) {
            let items = [];
            
            // --- LOGIC: DETECT EXAM VS STANDARD ---
            // We use Array.isArray to automatically detect the mode
            // If it is NOT an array, it is the Exam Object structure
            if (!Array.isArray(departmentData)) {
                // Exam Mode: Keys are courses
                items = Object.keys(departmentData);
            } else {
                // Standard Mode: Array of objects
                items = departmentData.map(i => i.course);
            }
            
            // Deduplicate and Sort
            let unique_names = [...new Set(items)];
            unique_names.sort((a, b) => a.localeCompare(b, 'el', { sensitivity: 'base' }));
            
            // SAVE TO STATE
            leftSideState = unique_names;
        } else {
            leftSideState = [];
        }
    } else {
        leftSideState = [];
    }

    // Render the list from state
    renderLeftList();
    updateButtonState();
    updateCounts();
}

// ==========================================================
// 2. LIST MANIPULATION & SEARCH
// ==========================================================

function renderLeftList() {
    const list = document.getElementById('list-left');
    // Get search term safely
    const searchInput = document.getElementById('search-left');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    
    list.innerHTML = '';

    leftSideState.forEach(item => {
        // Filter: Show item if it matches search
        if (item.toLowerCase().includes(searchTerm)) {
            const option = document.createElement('option');
            option.value = item;
            option.textContent = item;
            list.appendChild(option);
        }
    });
}

// Linked to the onkeyup event in HTML
function filterLeftList() {
    renderLeftList();
}

function moveItems(sourceId, destId) {
    const source = document.getElementById(sourceId);
    const dest = document.getElementById(destId);
    
    // Get currently selected options
    const selectedOptions = Array.from(source.selectedOptions);
    if (selectedOptions.length === 0) return;

    const valuesToMove = selectedOptions.map(opt => opt.value);

    // LOGIC: MOVING LEFT -> RIGHT (Add to selection)
    if (sourceId === 'list-left') {
        // 1. Remove from Left State (Available)
        leftSideState = leftSideState.filter(item => !valuesToMove.includes(item));
        
        // 2. Add to Right DOM (Selected)
        valuesToMove.forEach(val => {
            const opt = document.createElement('option');
            opt.value = val; 
            opt.textContent = val; 
            dest.appendChild(opt);
        });

        // 3. Re-render Left Side (State changed)
        renderLeftList();
        
        // 4. Sort Right List
        sortList(dest);
    } 
    
    // LOGIC: MOVING RIGHT -> LEFT (Remove from selection)
    else if (sourceId === 'list-right') {
        // 1. Remove from Right DOM
        selectedOptions.forEach(opt => opt.remove());

        // 2. Add back to Left State
        valuesToMove.forEach(val => {
            if (!leftSideState.includes(val)) {
                leftSideState.push(val);
            }
        });

        // 3. Sort Left State
        leftSideState.sort((a, b) => a.localeCompare(b, 'el', { sensitivity: 'base' }));

        // 4. Re-render Left
        renderLeftList();
    }

    updateButtonState();
    updateCounts();
}

function clearAll() {
    // Move everything from Right back to Left
    const rightList = document.getElementById('list-right');
    const options = Array.from(rightList.options);
    const values = options.map(opt => opt.value);

    // Add back to state
    values.forEach(val => {
        if (!leftSideState.includes(val)) {
            leftSideState.push(val);
        }
    });

    // Sort State
    leftSideState.sort((a, b) => a.localeCompare(b, 'el', { sensitivity: 'base' }));

    // Clear Right
    rightList.innerHTML = '';

    // Render
    renderLeftList();
    updateButtonState();
    updateCounts();
}

// ==========================================================
// 3. HELPERS
// ==========================================================

function sortList(selectElement) {
    const options = Array.from(selectElement.options);
    options.sort((a, b) => a.text.localeCompare(b.text, 'el', { sensitivity: 'base' }));
    selectElement.innerHTML = '';
    options.forEach(opt => selectElement.appendChild(opt));
}

function updateButtonState() {
    const rightList = document.getElementById('list-right');
    const btn = document.getElementById('btn-generate');
    if (btn) btn.disabled = rightList.options.length === 0;
}

function updateCounts() {
    const rightList = document.getElementById('list-right');
    const rightCount = rightList ? rightList.options.length : 0;
    
    // Left count is based on TOTAL available (state), not just filtered search results
    const leftCount = leftSideState.length;

    const countLeftEl = document.getElementById('count-left');
    const countRightEl = document.getElementById('count-right');

    if (countLeftEl) countLeftEl.textContent = leftCount;
    if (countRightEl) countRightEl.textContent = rightCount;
}

function downloadExcel() {
    const sel1 = document.getElementById('sel1').value;

    if (typeof currentWorkbook !== 'undefined' && currentWorkbook) {
        XLSX.writeFile(currentWorkbook, sel1 + ".xlsx");
    } else {
        alert("Please generate the schedule first.");
    }
}
