class SpaceTakenError extends Error {}

class CalendarMatrix {
    constructor(time_start = 8, time_end = 22, days = ['Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο']) {
        this.calendar = [];
        this.days = days;
        this.columns = 1 + days.length;
        this.rows = 1 + time_end - time_start;
        this.time_start = time_start;
        this.conflicts = []; 

        this._set_matrix_limits();
        this._set_days_row(days);
        this._set_times_column(time_start);
    }

    _set_matrix_limits() {
        for (let i = 0; i < this.rows; i++) {
            let row = [];
            for (let j = 0; j < this.columns; j++) row.push('');
            this.calendar.push(row);
        }
    }

    _set_days_row(days) {
        this.calendar[0][0] = 'Ώρες \\ Ημέρες';
        for (let i = 0; i < days.length; i++) this.calendar[0][i + 1] = days[i];
    }

    _set_times_column(time_start) {
        for (let i = 0; i < this.rows - 1; i++) {
            let t = i + time_start;
            let timeStr = t < 10 ? '0' + t : '' + t;
            this.calendar[i + 1][0] = timeStr;
        }
    }

    write_lesson(lesson_text, dayName, time, lasting = 2) {
        let x = 0, y = 0;
        const cleanDayName = dayName.trim();
        
        for (let c = 1; c < this.calendar[0].length; c++) {
            if (this.calendar[0][c] === cleanDayName) {
                x = c;
                break;
            }
        }
        if (x === 0) return;

        const targetTime = parseInt(time);
        for (let r = 1; r < this.calendar.length; r++) {
            if (parseInt(this.calendar[r][0]) === targetTime) {
                y = r;
                break;
            }
        }
        
        if (y === 0) {
            console.warn(`Time '${targetTime}' not found.`);
            return; 
        }

        this._check_space_taken(x, y, lesson_text, lasting, cleanDayName, targetTime);
    }

    _check_space_taken(x, y, lesson_text, lasting, dayName, time) {
        try {
            // Έλεγχος αν ο χώρος είναι ελεύθερος
            for (let i = 0; i < lasting; i++) {
                if (y + i >= this.calendar.length) break; 
                if (this.calendar[y + i][x] !== '') throw new SpaceTakenError();
            }
            // Εγγραφή μαθήματος
            for (let i = 0; i < lasting; i++) {
                if (y + i < this.calendar.length) this.calendar[y + i][x] = lesson_text;
            }
        } catch (e) {
            if (e instanceof SpaceTakenError) {
                // ΕΥΡΕΣΗ ΥΠΑΡΧΟΝΤΟΣ ΜΑΘΗΜΑΤΟΣ (Ακόμα και αν η σύγκρουση είναι σε ενδιάμεση ώρα)
                let existingVal = this.calendar[y][x];
                
                if (existingVal === '') {
                    // Αν το συγκεκριμένο κελί είναι κενό, σημαίνει ότι το μάθημα ξεκίνησε νωρίτερα
                    for (let r = y - 1; r >= 1; r--) {
                        if (this.calendar[r][x] !== '') {
                            existingVal = this.calendar[r][x];
                            break;
                        }
                    }
                }

                let existingName = (existingVal || "").split('\n')[0];
                let newName = lesson_text.split('\n')[0];

                if (existingName !== "")
                    this.conflicts.push({
                        existing: existingName,
                        new: newName,
                        day: dayName,
                        time: time
                    });

                // Επίλυση: Προσθήκη νέας στήλης για την ίδια μέρα
                let shouldAddColumn = true;
                if (x + 1 < this.calendar[0].length) {
                    // Αν η επόμενη στήλη έχει ήδη το ίδιο όνομα μέρας, μην ξαναπροσθέτεις
                    shouldAddColumn = (this.calendar[0][x] !== this.calendar[0][x + 1]);
                }

                if (shouldAddColumn) {
                    for (let row of this.calendar) {
                        if (row === this.calendar[0]) row.splice(x + 1, 0, row[x]); // Αντιγραφή επικεφαλίδας μέρας
                        else row.splice(x + 1, 0, ''); // Κενό κελί στις υπόλοιπες γραμμές
                    }
                }
                
                // Αναδρομική προσπάθεια εγγραφής στη νέα στήλη
                this._check_space_taken(x + 1, y, lesson_text, lasting, dayName, time);
            } else throw e;
        }
    }

    get_merge_cells() {
        this.merge_cells = [];
        const H = this.calendar.length;
        const W = this.calendar[0].length;
        const visited = Array.from({ length: H }, () => Array(W).fill(false));

        // 1. Οριζόντια Merges για τις Ημέρες (Header)
        let first_row = this.calendar[0];
        let j = 0;
        while (j < first_row.length) {
            let text = first_row[j];
            let k = 0;
            if (j + 1 < first_row.length) {
                while ((j + k + 1 < first_row.length) && (text === first_row[j + k + 1])) k++;
            }
            if (k !== 0) {
                this.merge_cells.push({s: {r:0, c:j}, e: {r:0, c:j+k}, text: text});
                for(let m=0; m<=k; m++) visited[0][j+m] = true;
                j = j + k;
            } else {
                visited[0][j] = true;
            }
            j++;
        }

        // 2. Κάθετα Merges για τα Μαθήματα
        for (let c = 1; c < W; c++) {
            for (let r = 1; r < H; r++) {
                if (visited[r][c]) continue;
                
                const val = this.calendar[r][c];
                if (val === '') { visited[r][c] = true; continue; }

                let height = 1;
                while (r + height < H && this.calendar[r + height][c] === val) {
                    height++;
                }

                let width = 1;
                let currentDay = this.calendar[0][c];

                while (c + width < W) {
                    if (this.calendar[0][c + width] !== currentDay) break;
                    let isColumnFree = true;
                    for (let k = 0; k < height; k++) {
                        if (this.calendar[r + k][c + width] !== '') {
                            isColumnFree = false;
                            break;
                        }
                    }
                    if (!isColumnFree) break;
                    width++;
                }

                for (let i = 0; i < height; i++) {
                    for (let k = 0; k < width; k++) {
                        visited[r + i][c + k] = true;
                    }
                }

                if (height > 1 || width > 1) {
                    this.merge_cells.push({
                        s: { r: r, c: c },
                        e: { r: r + height - 1, c: c + width - 1 },
                        text: val
                    });
                }
            }
        }
    }

    empty_removal() {
        let rows_to_delete = [];
        for (let i = 1; i < this.calendar.length; i++) {
            let row = this.calendar[i];
            let empty = true;
            for (let j = 1; j < row.length; j++) { if (row[j] !== '') { empty = false; break; } }
            if (empty) rows_to_delete.push(i); else break;
        }
        for (let i = rows_to_delete.length - 1; i >= 0; i--) this.calendar.splice(rows_to_delete[i], 1);
    }

    empty_removal_reverse() {
        let rows_to_delete = [];
        for (let i = this.calendar.length - 1; i >= 1; i--) {
            let row = this.calendar[i];
            let empty = true;
            for (let j = 1; j < row.length; j++) { if (row[j] !== '') { empty = false; break; } }
            if (empty) rows_to_delete.push(i); else break;
        }
        for (let i = 0; i < rows_to_delete.length; i++) this.calendar.splice(rows_to_delete[i], 1);
    }

    check_saturday() {
        let remove = true;
        const header = this.calendar[0];
        if (header[header.length - 1] !== 'Σάββατο') return;
        for (let i = 1; i < this.calendar.length; i++) {
            if (this.calendar[i][this.calendar[i].length - 1] !== '') { remove = false; break; }
        }
        if (remove) { for (let row of this.calendar) row.pop(); }
    }
}
