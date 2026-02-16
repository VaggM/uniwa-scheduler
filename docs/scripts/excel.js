function generateSchedule() {
    const sel1 = document.getElementById('sel1').value;
    const sel2 = document.getElementById('sel2').value;
    const rightList = document.getElementById('list-right');
    const selectedCourses = Array.from(rightList.options).map(opt => opt.value);

    if (selectedCourses.length === 0) { alert("No tasks selected!"); return; }

    // 1. Load the raw data
    const allData = appData.departments?.[sel2]?.[sel1];
    if (!allData) { console.error("Data not found"); return; }

    // 2. INTELLIGENT MODE DETECTION
    // If it is NOT an array, treat it as the Exam (Object) structure.
    const isExamMode = !Array.isArray(allData);

    const classrooms = appData.classrooms || []; 
    const usedClassroomsSet = new Set(); 

    const wb = XLSX.utils.book_new();
    let ws = null;

    // Common Styles
    const baseStyle = { alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: { top: { style: "medium" }, bottom: { style: "medium" }, left: { style: "medium" }, right: { style: "medium" } }, font: { bold: true } };
    const COLOR_FIRST_ELEM = "BF8F00"; 
    const COLOR_TIME_DATE = "FFE699";
    const COLOR_HAS_TEXT = "FDE9D8";
    const COLOR_NO_TEXT = "F4B084";
    const COLOR_WHITE = "FFFFFF";

    // Hide Conflict Warning by default
    const conflictContainer = document.getElementById('conflict-container');
    if(conflictContainer) conflictContainer.classList.add('hidden');

    // ==========================================
    // BRANCH A: EXAM MODE (Data is an Object)
    // ==========================================
    if (isExamMode) {
        const ws_data = [];
        
        // 1. Headers
        const headerStyle = { ...baseStyle, fill: { fgColor: { rgb: COLOR_TIME_DATE } } };
        const headers = ["Ημερομηνία", "Ώρα", "Μάθημα", "Αίθουσες", "", "Αίθουσα", "Τοποθεσία"];
        ws_data.push(headers.map(h => {
            if(h === "") return { v: "", t: 's', s: { fill: { fgColor: { rgb: COLOR_WHITE } } } };
            return { v: h, t: 's', s: headerStyle };
        }));

        // 2. Process Courses
        const examRows = [];
        selectedCourses.forEach(courseName => {
            // Access data by Key (Course Name)
            const item = allData[courseName];
            if (!item) return;

            const tStart = item.time_start || "";
            const tEnd = item.time_end || "";
            const timeStr = `${tStart} - ${tEnd}`;

            let codeList = [];
            if (item.area_id && Array.isArray(item.area_id)) {
                item.area_id.forEach(id => {
                    const cls = classrooms.find(c => c.id == id);
                    if (cls) {
                        codeList.push((cls.building || "") + "." + (cls.code || ""));
                        usedClassroomsSet.add(cls);
                    }
                });
            }
            examRows.push({
                date: item.date || "",
                time: timeStr,
                course: courseName,
                rooms: codeList.join(", ")
            });
        });

        // Sort by Date then Time
        examRows.sort((a, b) => {
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            return a.time.localeCompare(b.time);
        });

        // 3. Prepare Side Table
        const usedClassrooms = Array.from(usedClassroomsSet);
        usedClassrooms.sort((a,b) => ((a.building||"")+(a.code||"")).localeCompare((b.building||"")+(b.code||"")));

        // 4. Build Rows
        const totalRows = Math.max(examRows.length, usedClassrooms.length);

        for (let i = 0; i < totalRows; i++) {
            const rowCells = [];
            
            // LEFT SIDE: Exam Data
            if (i < examRows.length) {
                const ex = examRows[i];
                const cellStyle = { ...baseStyle, fill: { fgColor: { rgb: COLOR_HAS_TEXT } } };
                rowCells.push({ v: ex.date, t: 's', s: cellStyle });
                rowCells.push({ v: ex.time, t: 's', s: cellStyle });
                rowCells.push({ v: ex.course, t: 's', s: cellStyle });
                rowCells.push({ v: ex.rooms, t: 's', s: cellStyle });
            } else {
                for(let k=0; k<4; k++) rowCells.push({ v: "", t: 's', s: { fill: { fgColor: { rgb: COLOR_WHITE } } } });
            }

            // SPACER
            rowCells.push({ v: "", t: 's', s: { fill: { fgColor: { rgb: COLOR_WHITE } } } });

            // RIGHT SIDE: Classroom Details
            if (i < usedClassrooms.length) {
                const cls = usedClassrooms[i];
                const roomName = (cls.building || "") + "." + (cls.code || "");
                const details = `Κτίριο ${cls.building || '-'}, ${cls.floor || '-'}, Αίθουσα ${roomName}, Παν/πόλη ${cls.campus || '-'}`;
                const cellStyle = { ...baseStyle, fill: { fgColor: { rgb: COLOR_HAS_TEXT } } };
                rowCells.push({ v: roomName, t: 's', s: cellStyle });
                rowCells.push({ v: details, t: 's', s: cellStyle });
            } else {
                rowCells.push({ v: "", t: 's', s: { fill: { fgColor: { rgb: COLOR_WHITE } } } });
                rowCells.push({ v: "", t: 's', s: { fill: { fgColor: { rgb: COLOR_WHITE } } } });
            }
            ws_data.push(rowCells);
        }

        ws = XLSX.utils.aoa_to_sheet(ws_data);
        ws['!cols'] = [{wch: 25}, {wch: 25}, {wch: 50}, {wch: 25}, {wch: 5}, {wch: 25}, {wch: 75}];
        const wsrows = []; 
        for(let i=0; i<=totalRows; i++) wsrows.push({hpx: 40});
        ws['!rows'] = wsrows;
    } 
    
    // ==========================================
    // BRANCH B: STANDARD MODE (Data is an Array)
    // ==========================================
    else {
        // Safe to assume it is an array here
        const allItems = allData;
        
        // This line caused your error before because 'allItems' was an object.
        // Now we only reach here if !isExamMode (meaning it IS an array).
        const lessons = allItems.filter(item => selectedCourses.includes(item.course));
        
        const cldr = new CalendarMatrix();
        const dayMapping = { 1: 'Δευτέρα', 2: 'Τρίτη', 3: 'Τετάρτη', 4: 'Πέμπτη', 5: 'Παρασκευή', 6: 'Σάββατο', 7: 'Κυριακή' };

        lessons.forEach(lesson => {
            let classroomCode = "Unknown";
            if (lesson.area_id) {
                const cls = classrooms.find(c => c.id == lesson.area_id); 
                if (cls) {
                    classroomCode = (cls.building || "") + "." + (cls.code || "");
                    usedClassroomsSet.add(cls); 
                }
            }
            const prof = lesson.professor || '';
            const text = `${lesson.course}\n${prof}\n${classroomCode}`;
            
            let startH = parseInt(lesson.time_start.substring(0, 2));
            let endH = parseInt(lesson.time_end.substring(0, 2));
            let duration = endH - startH;
            if (isNaN(duration) || duration < 1) duration = 1;

            const correctDay = dayMapping[lesson.day] || lesson.day;
            cldr.write_lesson(text, correctDay, startH, duration);
        });

        cldr.check_saturday();
        cldr.empty_removal();
        cldr.empty_removal_reverse();
        cldr.get_merge_cells();

        // Handle Conflicts
        const conflictList = document.getElementById('conflict-list');
        conflictList.innerHTML = '';
        if (cldr.conflicts.length > 0) {
            cldr.conflicts.forEach(c => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${c.new}</strong> συμπίπτει με το <strong>${c.existing}</strong> την ${c.day} στις ${c.time}:00`;
                conflictList.appendChild(li);
            });
            conflictContainer.classList.remove('hidden');
        }

        // Build Matrix Data
        const ws_data = [];
        const usedClassrooms = Array.from(usedClassroomsSet);
        usedClassrooms.sort((a,b) => ((a.building||"")+(a.code||"")).localeCompare((b.building||"")+(b.code||"")));

        const totalRows = Math.max(cldr.calendar.length, usedClassrooms.length + 1);
        const calendarWidth = cldr.calendar[0].length;

        for (let r = 0; r < totalRows; r++) {
            const rowCells = [];
            
            // Calendar Side
            if (r < cldr.calendar.length) {
                const rowData = cldr.calendar[r];
                for (let c = 0; c < calendarWidth; c++) {
                    const val = rowData[c];
                    let bgColor = COLOR_NO_TEXT;
                    if (r === 0 && c === 0) bgColor = COLOR_FIRST_ELEM;
                    else if (r === 0 || c === 0) bgColor = COLOR_TIME_DATE;
                    else if (val !== '') bgColor = COLOR_HAS_TEXT;

                    let displayVal = val;
                    if (c === 0 && r > 0) {
                        try { let start = parseInt(val); displayVal = `${start}:00 - ${start + 1}:00`; } catch(e) {}
                    }
                    rowCells.push({ v: displayVal, t: 's', s: { ...baseStyle, fill: { fgColor: { rgb: bgColor } } } });
                }
            } else {
                for (let c = 0; c < calendarWidth; c++) rowCells.push({ v: "", t: 's', s: { fill: { fgColor: { rgb: COLOR_WHITE } } } });
            }
            
            // Spacer
            rowCells.push({ v: "", t: 's', s: { fill: { fgColor: { rgb: COLOR_WHITE } } } });

            // Classroom Side
            if (r === 0) {
                const headerStyle = { ...baseStyle, fill: { fgColor: { rgb: COLOR_TIME_DATE } } };
                rowCells.push({ v: "Αίθουσα", t: 's', s: headerStyle });
                rowCells.push({ v: "Τοποθεσία", t: 's', s: headerStyle });
            } else {
                const clsIndex = r - 1;
                if (clsIndex < usedClassrooms.length) {
                    const cls = usedClassrooms[clsIndex];
                    const roomName = (cls.building || "") + "." + (cls.code || "");
                    const details = `Κτίριο ${cls.building || '-'}, ${cls.floor || '-'}, Αίθουσα ${roomName}, Παν/πόλη ${cls.campus || '-'}`;
                    const listStyle = { ...baseStyle, fill: { fgColor: { rgb: COLOR_HAS_TEXT } } };
                    rowCells.push({ v: roomName, t: 's', s: listStyle });
                    rowCells.push({ v: details, t: 's', s: listStyle });
                } else {
                    rowCells.push({ v: "", t: 's', s: { fill: { fgColor: { rgb: COLOR_WHITE } } } });
                    rowCells.push({ v: "", t: 's', s: { fill: { fgColor: { rgb: COLOR_WHITE } } } });
                }
            }
            ws_data.push(rowCells);
        }

        ws = XLSX.utils.aoa_to_sheet(ws_data);

        ws['!merges'] = cldr.merge_cells.map(m => {
            const startR = m.s.r; const startC = m.s.c; const text = m.text;
            let mergeColor = COLOR_NO_TEXT;
            if (startR===0 && startC===0) mergeColor = COLOR_FIRST_ELEM;
            else if (startR===0 || startC===0) mergeColor = COLOR_TIME_DATE;
            else if (String(text).length > 1) mergeColor = COLOR_HAS_TEXT;
            const cellRef = XLSX.utils.encode_cell({c: startC, r: startR});
            if (ws[cellRef]) ws[cellRef].s.fill.fgColor.rgb = mergeColor;
            return { s: m.s, e: m.e };
        });

        const wscols = []; for(let i=0; i<calendarWidth; i++) wscols.push({wch: 25});
        wscols.push({wch: 5}); wscols.push({wch: 25}); wscols.push({wch: 75});
        ws['!cols'] = wscols;

        const wsrows = []; for(let i=0; i<totalRows; i++) wsrows.push({hpx: 40});
        ws['!rows'] = wsrows;
    }

    // ==========================================
    // FINALIZE
    // ==========================================
    XLSX.utils.book_append_sheet(wb, ws, "Schedule");
    currentWorkbook = wb;
    document.getElementById('btn-download').classList.remove('hidden');
    
    renderPreviewFromWorkbook(wb);
    
    document.getElementById('btn-generate').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
