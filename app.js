/**
 * AgroCount - Core Logic
 * Designed for 100% offline, secure, and responsive field count entry.
 */

// DATA STRUCTURE & STATE
let appState = {
    fecha: "",
    supervisor: "",
    campo: "",
    cuartel: "",
    coordenadas: "",
    numPlanta: 1,
    conteos: [], // List of all registered rows (1 row per axis count)
    
    // Autocomplete registers saved locally to remember history
    sugerencias: {
        campos: [],
        cuarteles: [],
        trabajadores: []
    }
};

// STORAGE KEYS
const STORAGE_KEYS = {
    STATE: 'agrocount_state',
    CONTEOS: 'agrocount_conteos',
    SUGERENCIAS: 'agrocount_sugerencias',
    DRAFT: 'agrocount_draft_form'
};

// INITIALIZATION
document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

function initApp() {
    setupDateInput();
    loadFromLocalStorage();
    setupEventListeners();
    setupAutocomplete();
    setupDraftRestore();
    checkGPSSupport();
    renderHistoryTable();
    updateBadges();
}

// SETUP DATE INPUT (Default to today)
function setupDateInput() {
    const dateInput = document.getElementById("fecha");
    if (dateInput && !dateInput.value) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        dateInput.value = `${yyyy}-${mm}-${dd}`;
        appState.fecha = dateInput.value;
    }
}

// CHECK GPS
function checkGPSSupport() {
    const badge = document.getElementById("badge-gps");
    if ("geolocation" in navigator) {
        badge.textContent = "📍 GPS Disponible";
        badge.className = "badge badge-info";
    } else {
        badge.textContent = "📍 GPS No Soportado";
        badge.className = "badge badge-warning";
    }
}

// SECURITY: Sanitize inputs to prevent XSS / HTML Injection
function sanitizeHTML(str) {
    if (typeof str !== 'string') return '';
    return str
        .trim()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

// Load configurations and data
function loadFromLocalStorage() {
    try {
        // Load counts
        const storedConteos = localStorage.getItem(STORAGE_KEYS.CONTEOS);
        if (storedConteos) {
            appState.conteos = JSON.parse(storedConteos);
        }
        
        // Load suggestions history
        const storedSugerencias = localStorage.getItem(STORAGE_KEYS.SUGERENCIAS);
        if (storedSugerencias) {
            appState.sugerencias = JSON.parse(storedSugerencias);
        }
        
        // Load general info (Supervisor, Campo, Cuartel, Planta #)
        const storedState = localStorage.getItem(STORAGE_KEYS.STATE);
        if (storedState) {
            const parsedState = JSON.parse(storedState);
            if (parsedState.fecha) document.getElementById("fecha").value = parsedState.fecha;
            if (parsedState.supervisor) document.getElementById("supervisor").value = parsedState.supervisor;
            if (parsedState.campo) document.getElementById("campo").value = parsedState.campo;
            if (parsedState.cuartel) document.getElementById("cuartel").value = parsedState.cuartel;
            if (parsedState.coordenadas) document.getElementById("coordenadas").value = parsedState.coordenadas;
            if (parsedState.numPlanta) {
                document.getElementById("num-planta").value = parsedState.numPlanta;
                appState.numPlanta = parseInt(parsedState.numPlanta, 10);
            }
            
            // Sync local state
            appState.fecha = document.getElementById("fecha").value;
            appState.supervisor = document.getElementById("supervisor").value;
            appState.campo = document.getElementById("campo").value;
            appState.cuartel = document.getElementById("cuartel").value;
            appState.coordenadas = document.getElementById("coordenadas").value;
        }
    } catch (e) {
        console.error("Error cargando de LocalStorage:", e);
        showToast("Error al cargar los datos guardados en el navegador.", "danger");
    }
}

// Save main state (metadata of the counting)
function saveStateToStorage() {
    appState.fecha = document.getElementById("fecha").value;
    appState.supervisor = document.getElementById("supervisor").value;
    appState.campo = document.getElementById("campo").value;
    appState.cuartel = document.getElementById("cuartel").value;
    appState.coordenadas = document.getElementById("coordenadas").value;
    appState.numPlanta = parseInt(document.getElementById("num-planta").value, 10) || 1;
    
    localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify({
        fecha: appState.fecha,
        supervisor: appState.supervisor,
        campo: appState.campo,
        cuartel: appState.cuartel,
        coordenadas: appState.coordenadas,
        numPlanta: appState.numPlanta
    }));
}

// Save active draft of worker names and counters so they aren't lost on reload
function saveDraftForm() {
    const axesData = {};
    const axisCards = document.querySelectorAll(".axis-card");
    axisCards.forEach(card => {
        const eje = card.dataset.eje;
        const workerInput = card.querySelector(".worker-input");
        const worker = workerInput ? workerInput.value : "";
        
        const counts = {};
        const countInputs = card.querySelectorAll(".count-val");
        countInputs.forEach(input => {
            const state = input.dataset.state;
            counts[state] = parseInt(input.value, 10) || 0;
        });
        
        axesData[eje] = { worker, counts };
    });
    localStorage.setItem(STORAGE_KEYS.DRAFT, JSON.stringify(axesData));
}

// Restore draft data
function setupDraftRestore() {
    try {
        const draftStr = localStorage.getItem(STORAGE_KEYS.DRAFT);
        if (draftStr) {
            const draft = JSON.parse(draftStr);
            const axisCards = document.querySelectorAll(".axis-card");
            axisCards.forEach(card => {
                const eje = card.dataset.eje;
                if (draft[eje]) {
                    const workerInput = card.querySelector(".worker-input");
                    if (workerInput) workerInput.value = draft[eje].worker;
                    
                    const countInputs = card.querySelectorAll(".count-val");
                    countInputs.forEach(input => {
                        const state = input.dataset.state;
                        if (draft[eje].counts && draft[eje].counts[state] !== undefined) {
                            input.value = draft[eje].counts[state];
                        }
                    });
                }
            });
        }
    } catch (e) {
        console.error("Error al restaurar borrador:", e);
    }
}

// Add word to suggestion lists
function registerSuggestion(type, value) {
    if (!value || typeof value !== 'string') return;
    const cleanValue = value.trim();
    if (!cleanValue) return;
    
    if (!appState.sugerencias[type]) {
        appState.sugerencias[type] = [];
    }
    
    if (!appState.sugerencias[type].includes(cleanValue)) {
        appState.sugerencias[type].push(cleanValue);
        // Limit suggestions cache size to 40 per category for memory optimization
        if (appState.sugerencias[type].length > 40) {
            appState.sugerencias[type].shift();
        }
        localStorage.setItem(STORAGE_KEYS.SUGERENCIAS, JSON.stringify(appState.sugerencias));
    }
}

// GPS FUNCTIONALITY
function captureGPS() {
    const btn = document.getElementById("btn-gps");
    const gpsInput = document.getElementById("coordenadas");
    const badge = document.getElementById("badge-gps");
    
    if (!("geolocation" in navigator)) {
        showToast("El navegador no soporta GPS Geolocation", "warning");
        return;
    }
    
    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="btn-icon">⏳</span> Buscando...`;
    
    badge.textContent = "📍 Localizando...";
    badge.className = "badge badge-warning";
    
    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude.toFixed(6);
            const lng = position.coords.longitude.toFixed(6);
            const accuracy = position.coords.accuracy.toFixed(1);
            
            gpsInput.value = `${lat}, ${lng}`;
            btn.disabled = false;
            btn.innerHTML = originalText;
            
            badge.textContent = `📍 GPS Activo (±${accuracy}m)`;
            badge.className = "badge badge-success";
            
            saveStateToStorage();
            showToast("Coordenadas obtenidas con éxito.", "success");
        },
        (error) => {
            btn.disabled = false;
            btn.innerHTML = originalText;
            
            badge.textContent = "📍 GPS Fallido";
            badge.className = "badge badge-warning";
            
            let errMsg = "No se pudo obtener la ubicación.";
            if (error.code === error.PERMISSION_DENIED) {
                errMsg = "Permiso de GPS denegado por el usuario.";
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                errMsg = "Ubicación no disponible en este momento.";
            } else if (error.code === error.TIMEOUT) {
                errMsg = "Tiempo de espera agotado al buscar señal GPS.";
            }
            
            showToast(errMsg + " Puedes ingresarla manualmente.", "warning");
        },
        options
    );
}

// EVENT LISTENERS SETUP
function setupEventListeners() {
    // Save metadata states on change
    const metaInputs = ['fecha', 'supervisor', 'campo', 'cuartel', 'coordenadas', 'num-planta'];
    metaInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener("input", saveStateToStorage);
            input.addEventListener("change", saveStateToStorage);
        }
    });

    // Save active draft of plant form
    document.addEventListener("input", (e) => {
        if (e.target.classList.contains("worker-input") || e.target.classList.contains("count-val")) {
            saveDraftForm();
        }
    });

    // GPS Button
    const gpsBtn = document.getElementById("btn-gps");
    if (gpsBtn) {
        gpsBtn.addEventListener("click", captureGPS);
    }

    // Counters logic (+ and - buttons)
    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("btn-count")) {
            const isInc = e.target.classList.contains("inc") || e.target.classList.contains("modal-inc");
            const isDec = e.target.classList.contains("dec") || e.target.classList.contains("modal-dec");
            
            const input = e.target.parentNode.querySelector("input[type='number']");
            if (input) {
                let val = parseInt(input.value, 10) || 0;
                if (isInc) {
                    val++;
                } else if (isDec) {
                    val = Math.max(0, val - 1);
                }
                input.value = val;
                
                // Dispatch input event to save draft
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    });

    // Validate manual inputs in counters (prevent negatives or weird text)
    document.addEventListener("change", (e) => {
        if (e.target.classList.contains("count-val") || e.target.id.startsWith("edit-") && e.target.type === "number") {
            let val = parseInt(e.target.value, 10);
            if (isNaN(val) || val < 0) {
                e.target.value = 0;
            } else {
                e.target.value = val;
            }
        }
    });

    // Save plant data button
    const btnSavePlant = document.getElementById("btn-save-plant");
    if (btnSavePlant) {
        btnSavePlant.addEventListener("click", handleSavePlant);
    }

    // Reset plant form button
    const btnResetForm = document.getElementById("btn-reset-form");
    if (btnResetForm) {
        btnResetForm.addEventListener("click", () => {
            if (confirm("¿Estás seguro de que deseas limpiar las entradas de la planta actual? Esto no borrará el historial de la jornada.")) {
                clearPlantInputs();
                showToast("Formulario de planta limpiado.", "info");
            }
        });
    }

    // Export button
    const btnExport = document.getElementById("btn-export");
    if (btnExport) {
        btnExport.addEventListener("click", exportToCSV);
    }

    // Clear all history button
    const btnClearAll = document.getElementById("btn-clear-all");
    if (btnClearAll) {
        btnClearAll.addEventListener("click", handleClearAllHistory);
    }

    // Modal close events
    document.getElementById("btn-close-modal").addEventListener("click", closeModal);
    document.getElementById("btn-cancel-edit").addEventListener("click", closeModal);
    document.getElementById("btn-save-edit").addEventListener("click", handleSaveEdit);
    
    // Close modal on click outside modal-container
    const modal = document.getElementById("edit-modal");
    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
    });
}

// AUTOCOMPLETE LOGIC
function setupAutocomplete() {
    setupInputSuggestions("campo", "campos");
    setupInputSuggestions("cuartel", "cuarteles");
    
    // Worker autocompletes (multiple elements)
    const initWorkerSuggestions = () => {
        document.querySelectorAll(".axis-card").forEach(card => {
            const input = card.querySelector(".worker-input");
            const suggDiv = card.querySelector(".worker-suggestions");
            if (input && suggDiv) {
                setupAutocompleteBehavior(input, suggDiv, "trabajadores");
            }
        });
    };
    initWorkerSuggestions();
    
    // Modal worker autocomplete
    const modalInput = document.getElementById("edit-trabajador");
    const modalSugg = document.getElementById("edit-worker-suggestions");
    setupAutocompleteBehavior(modalInput, modalSugg, "trabajadores");
}

function setupInputSuggestions(inputId, storageCategory) {
    const input = document.getElementById(inputId);
    const suggDiv = document.getElementById(`${inputId}-suggestions`);
    if (input && suggDiv) {
        setupAutocompleteBehavior(input, suggDiv, storageCategory);
    }
}

function setupAutocompleteBehavior(input, suggestionsElement, storageCategory) {
    // On focus or input, show suggestions
    const handler = () => {
        const value = input.value.trim().toLowerCase();
        const list = appState.sugerencias[storageCategory] || [];
        
        // Filter list
        const filtered = list.filter(item => item.toLowerCase().includes(value));
        
        if (filtered.length > 0) {
            suggestionsElement.innerHTML = "";
            filtered.forEach(item => {
                const div = document.createElement("div");
                div.className = "suggestion-item";
                div.textContent = item; // Security: textContent prevents HTML injection
                div.addEventListener("click", () => {
                    input.value = item;
                    suggestionsElement.style.display = "none";
                    saveStateToStorage();
                    saveDraftForm();
                });
                suggestionsElement.appendChild(div);
            });
            suggestionsElement.style.display = "block";
        } else {
            suggestionsElement.style.display = "none";
        }
    };

    input.addEventListener("input", handler);
    input.addEventListener("focus", handler);
    
    // Hide when clicking outside
    document.addEventListener("click", (e) => {
        if (e.target !== input && e.target !== suggestionsElement) {
            suggestionsElement.style.display = "none";
        }
    });
}

// SAVE PLANT LOGIC
function handleSavePlant() {
    // 1. Fetch values
    const dateVal = document.getElementById("fecha").value;
    const supervisorVal = document.getElementById("supervisor").value.trim();
    const campoVal = document.getElementById("campo").value.trim();
    const cuartelVal = document.getElementById("cuartel").value.trim();
    const coordenadasVal = document.getElementById("coordenadas").value.trim();
    const plantaNum = parseInt(document.getElementById("num-planta").value, 10);

    // 2. Validations
    if (!dateVal) {
        showToast("Debes ingresar una fecha.", "danger");
        document.getElementById("fecha").focus();
        return;
    }
    if (!supervisorVal) {
        showToast("Debes ingresar el nombre del supervisor.", "danger");
        document.getElementById("supervisor").focus();
        return;
    }
    if (!campoVal) {
        showToast("Debes especificar el Campo.", "danger");
        document.getElementById("campo").focus();
        return;
    }
    if (!cuartelVal) {
        showToast("Debes especificar el Cuartel.", "danger");
        document.getElementById("cuartel").focus();
        return;
    }
    if (isNaN(plantaNum) || plantaNum < 1) {
        showToast("Número de planta inválido.", "danger");
        document.getElementById("num-planta").focus();
        return;
    }

    // Check if the plant number is already registered in this campo/cuartel to prevent duplication errors
    const isDuplicate = appState.conteos.some(c => 
        c.fecha === dateVal && 
        c.campo.toLowerCase() === campoVal.toLowerCase() && 
        c.cuartel.toLowerCase() === cuartelVal.toLowerCase() && 
        parseInt(c.planta, 10) === plantaNum
    );
    if (isDuplicate) {
        if (!confirm(`La planta N° ${plantaNum} ya tiene registros cargados hoy en este cuartel. ¿Deseas agregar más conteos para la misma planta?`)) {
            return;
        }
    }

    // 3. Process axes cards
    const axisCards = document.querySelectorAll(".axis-card");
    const timestamp = Date.now();
    const newRecords = [];

    // Register headers suggestions
    registerSuggestion("campos", campoVal);
    registerSuggestion("cuarteles", cuartelVal);

    for (let card of axisCards) {
        const eje = card.dataset.eje;
        const workerInput = card.querySelector(".worker-input");
        const workerVal = workerInput ? workerInput.value.trim() : "";
        
        if (!workerVal) {
            showToast(`Debes ingresar el nombre del trabajador para el eje ${eje}.`, "danger");
            if (workerInput) workerInput.focus();
            return;
        }
        
        // Register worker name suggestion
        registerSuggestion("trabajadores", workerVal);

        const counts = {};
        let totalYemas = 0;
        const countInputs = card.querySelectorAll(".count-val");
        
        for (let input of countInputs) {
            const state = input.dataset.state;
            const countVal = parseInt(input.value, 10) || 0;
            if (countVal < 0) {
                showToast(`Las cantidades no pueden ser negativas en eje ${eje}.`, "danger");
                input.focus();
                return;
            }
            counts[state] = countVal;
            totalYemas += countVal;
        }

        // Security check: at least 0 yemas are registered, but warning if 0
        if (totalYemas === 0) {
            if (!confirm(`El eje ${eje} tiene un conteo de 0 yemas. ¿Es correcto?`)) {
                return;
            }
        }

        // Build item
        newRecords.push({
            id: `${timestamp}_${eje}_${Math.random().toString(36).substr(2, 5)}`,
            fecha: dateVal,
            campo: campoVal,
            cuartel: cuartelVal,
            coordenadas: coordenadasVal,
            planta: plantaNum,
            eje: eje,
            trabajador: workerVal,
            punto_rojo: counts['punto_rojo'],
            estilo_elongado: counts['estilo_elongado'],
            plena_flor: counts['plena_flor'],
            flor_senescente: counts['flor_senescente'],
            supervisor: supervisorVal
        });
    }

    // 4. Save to global state and LocalStorage
    appState.conteos.push(...newRecords);
    localStorage.setItem(STORAGE_KEYS.CONTEOS, JSON.stringify(appState.conteos));

    // 5. Success actions
    showToast(`Planta N° ${plantaNum} registrada con éxito.`, "success");
    
    // Clear draft form
    localStorage.removeItem(STORAGE_KEYS.DRAFT);

    // Auto increment plant number
    const nextPlant = plantaNum + 1;
    document.getElementById("num-planta").value = nextPlant;
    appState.numPlanta = nextPlant;

    // Keep general metadata, but reset counts and workers on the layout
    clearPlantInputs(false); // do not clear worker names if they are counting in the same team
    
    // Save updated metadata state (especially plant number)
    saveStateToStorage();
    
    // Render
    renderHistoryTable();
    updateBadges();
}

// Clear plant form inputs
function clearPlantInputs(clearWorkers = true) {
    document.querySelectorAll(".axis-card").forEach(card => {
        if (clearWorkers) {
            const workerInput = card.querySelector(".worker-input");
            if (workerInput) workerInput.value = "";
        }
        
        card.querySelectorAll(".count-val").forEach(input => {
            input.value = "0";
        });
    });
    localStorage.removeItem(STORAGE_KEYS.DRAFT);
}

// RENDER REPORT HISTORY TABLE
function renderHistoryTable() {
    const tbody = document.getElementById("history-body");
    const recordsBadge = document.getElementById("record-count");
    
    if (!tbody) return;

    if (appState.conteos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No hay plantas registradas en esta jornada todavía.</td></tr>`;
        recordsBadge.textContent = "0 registros cargados";
        recordsBadge.className = "badge badge-info";
        return;
    }

    // Sort by plant number (descending) so new entries show first
    const sorted = [...appState.conteos].sort((a, b) => {
        if (b.planta !== a.planta) {
            return b.planta - a.planta;
        }
        // If same plant, order by standard Norte, Sur, Este, Oeste order
        const axisOrder = { 'Norte': 1, 'Sur': 2, 'Este': 3, 'Oeste': 4 };
        return (axisOrder[a.eje] || 0) - (axisOrder[b.eje] || 0);
    });

    recordsBadge.textContent = `${appState.conteos.length} filas registradas`;
    recordsBadge.className = "badge badge-success";
    tbody.innerHTML = "";

    sorted.forEach((item) => {
        const tr = document.createElement("tr");

        // Security: sanitizing all dynamically built texts
        const plantCell = document.createElement("td");
        plantCell.textContent = `Planta ${item.planta}`;
        plantCell.style.fontWeight = "bold";

        const ejeCell = document.createElement("td");
        ejeCell.textContent = item.eje;
        // Apply color depending on axis
        if (item.eje === 'Norte') ejeCell.style.color = 'var(--primary)';
        else if (item.eje === 'Sur') ejeCell.style.color = 'var(--state-blue)';
        else if (item.eje === 'Este') ejeCell.style.color = 'var(--state-orange)';
        else if (item.eje === 'Oeste') ejeCell.style.color = 'var(--state-red)';
        ejeCell.style.fontWeight = "700";

        const workerCell = document.createElement("td");
        workerCell.textContent = sanitizeHTML(item.trabajador);

        const prCell = document.createElement("td");
        prCell.className = "text-center text-red";
        prCell.textContent = item.punto_rojo;

        const eeCell = document.createElement("td");
        eeCell.className = "text-center text-orange";
        eeCell.textContent = item.estilo_elongado;

        const pfCell = document.createElement("td");
        pfCell.className = "text-center text-blue";
        pfCell.textContent = item.plena_flor;

        const fsCell = document.createElement("td");
        fsCell.className = "text-center text-purple";
        fsCell.textContent = item.flor_senescente;

        const actionsCell = document.createElement("td");
        actionsCell.className = "text-center";

        // Create safe buttons using DOM APIs to avoid injection
        const btnEdit = document.createElement("button");
        btnEdit.className = "btn-table-action btn-edit";
        btnEdit.title = "Editar conteo";
        btnEdit.innerHTML = "✏️";
        btnEdit.addEventListener("click", () => openEditModal(item.id));

        const btnDel = document.createElement("button");
        btnDel.className = "btn-table-action btn-delete";
        btnDel.title = "Eliminar conteo";
        btnDel.innerHTML = "🗑️";
        btnDel.addEventListener("click", () => handleDeleteRecord(item.id));

        actionsCell.appendChild(btnEdit);
        actionsCell.appendChild(btnDel);

        tr.appendChild(plantCell);
        tr.appendChild(ejeCell);
        tr.appendChild(workerCell);
        tr.appendChild(prCell);
        tr.appendChild(eeCell);
        tr.appendChild(pfCell);
        tr.appendChild(fsCell);
        tr.appendChild(actionsCell);

        tbody.appendChild(tr);
    });
}

// UPDATE APP HEADER BADGES
function updateBadges() {
    const isOnline = navigator.onLine;
    const badgeOffline = document.getElementById("badge-offline");
    if (badgeOffline) {
        if (isOnline) {
            badgeOffline.textContent = "📶 En Línea";
            badgeOffline.className = "badge badge-success";
        } else {
            badgeOffline.textContent = "⚡ Offline OK";
            badgeOffline.className = "badge badge-success";
        }
    }
}
window.addEventListener('online', updateBadges);
window.addEventListener('offline', updateBadges);

// TOAST NOTIFICATIONS LIBRERIA LOCAL
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let icon = "ℹ️";
    if (type === "success") icon = "✅";
    else if (type === "danger") icon = "❌";
    else if (type === "warning") icon = "⚠️";
    
    toast.innerHTML = `<span class="toast-icon">${icon}</span> <span>${sanitizeHTML(message)}</span>`;
    container.appendChild(toast);
    
    // Auto-remove toast after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// DELETE RECORD ACTION
function handleDeleteRecord(id) {
    const record = appState.conteos.find(r => r.id === id);
    if (!record) return;

    const confirmMsg = `¿Estás seguro de que deseas eliminar el conteo de la Planta ${record.planta} (${record.eje}) registrado por ${record.trabajador}?`;
    
    if (confirm(confirmMsg)) {
        // Safe delete
        appState.conteos = appState.conteos.filter(r => r.id !== id);
        localStorage.setItem(STORAGE_KEYS.CONTEOS, JSON.stringify(appState.conteos));
        
        renderHistoryTable();
        showToast("Registro eliminado.", "warning");
    }
}

// MODAL CONTROLS (EDIT)
function openEditModal(id) {
    const record = appState.conteos.find(r => r.id === id);
    if (!record) return;

    document.getElementById("edit-index").value = id;
    document.getElementById("edit-planta").value = record.planta;
    document.getElementById("edit-eje").value = record.eje;
    document.getElementById("edit-trabajador").value = record.trabajador;
    document.getElementById("edit-punto-rojo").value = record.punto_rojo;
    document.getElementById("edit-estilo-elongado").value = record.estilo_elongado;
    document.getElementById("edit-plena-flor").value = record.plena_flor;
    document.getElementById("edit-flor-senescente").value = record.flor_senescente;

    const modal = document.getElementById("edit-modal");
    modal.classList.add("active");
}

function closeModal() {
    const modal = document.getElementById("edit-modal");
    modal.classList.remove("active");
}

function handleSaveEdit() {
    const id = document.getElementById("edit-index").value;
    const idx = appState.conteos.findIndex(r => r.id === id);
    if (idx === -1) {
        closeModal();
        return;
    }

    const plantaVal = parseInt(document.getElementById("edit-planta").value, 10);
    const workerVal = document.getElementById("edit-trabajador").value.trim();
    const pr = parseInt(document.getElementById("edit-punto-rojo").value, 10);
    const ee = parseInt(document.getElementById("edit-estilo-elongado").value, 10);
    const pf = parseInt(document.getElementById("edit-plena-flor").value, 10);
    const fs = parseInt(document.getElementById("edit-flor-senescente").value, 10);

    // Validations
    if (isNaN(plantaVal) || plantaVal < 1) {
        showToast("Número de planta inválido", "danger");
        return;
    }
    if (!workerVal) {
        showToast("Debe ingresar un trabajador", "danger");
        return;
    }
    if (isNaN(pr) || pr < 0 || isNaN(ee) || ee < 0 || isNaN(pf) || pf < 0 || isNaN(fs) || fs < 0) {
        showToast("Los conteos deben ser números positivos", "danger");
        return;
    }

    // Backup copy for safety audit (log)
    console.log(`Editando registro ${id}. Anterior:`, appState.conteos[idx]);

    // Apply changes
    appState.conteos[idx].planta = plantaVal;
    appState.conteos[idx].trabajador = workerVal;
    appState.conteos[idx].punto_rojo = pr;
    appState.conteos[idx].estilo_elongado = ee;
    appState.conteos[idx].plena_flor = pf;
    appState.conteos[idx].flor_senescente = fs;

    // Register worker name if changed
    registerSuggestion("trabajadores", workerVal);

    // Save
    localStorage.setItem(STORAGE_KEYS.CONTEOS, JSON.stringify(appState.conteos));
    
    closeModal();
    renderHistoryTable();
    showToast("Cambios guardados con éxito.", "success");
}

// CLEAR ALL JORNADA DATA
function handleClearAllHistory() {
    if (appState.conteos.length === 0) {
        showToast("No hay registros en el historial para borrar.", "info");
        return;
    }

    const doubleConfirm = confirm("⚠️ ATENCIÓN: Esto borrará permanentemente todos los registros del día actual. ¿Estás seguro?");
    if (doubleConfirm) {
        const tripleConfirm = confirm("¿Exportaste los datos a Excel antes de borrar? Confirma una última vez si realmente deseas borrar.");
        if (tripleConfirm) {
            // Keep suggestions index for next times, but clear counts
            appState.conteos = [];
            localStorage.setItem(STORAGE_KEYS.CONTEOS, JSON.stringify([]));
            
            // Clean plant values back to 1
            document.getElementById("num-planta").value = "1";
            appState.numPlanta = 1;
            saveStateToStorage();
            
            clearPlantInputs(true);
            renderHistoryTable();
            showToast("Historial de la jornada borrado.", "danger");
        }
    }
}

// EXPORT TO EXCEL COMPATIBLE CSV
function exportToCSV() {
    if (appState.conteos.length === 0) {
        showToast("No hay datos cargados para exportar.", "warning");
        return;
    }

    // CSV Headers
    const headers = [
        "Fecha",
        "Campo",
        "Cuartel",
        "Coordenadas",
        "Planta",
        "Eje",
        "Trabajador",
        "Punto Rojo",
        "Estilo Elongado",
        "Plena Flor",
        "Flor Senescente",
        "Supervisor"
    ];

    // Helper to escape values for CSV safety
    // Encloses in double quotes and escapes existing quotes by doubling them
    // Prevents issues with semicolons or accents
    const cleanCSVCell = (val) => {
        if (val === null || val === undefined) return '""';
        let strVal = String(val);
        // Clean double quotes
        strVal = strVal.replace(/"/g, '""');
        return `"${strVal}"`;
    };

    // Build rows
    const csvRows = [];
    csvRows.push(headers.join(";")); // Using semicolon as delimiter for Excel Spanish

    // Sort logically by Plant number and then Axis before exporting
    const sortedConteos = [...appState.conteos].sort((a, b) => {
        if (a.planta !== b.planta) return a.planta - b.planta;
        const axisOrder = { 'Norte': 1, 'Sur': 2, 'Este': 3, 'Oeste': 4 };
        return (axisOrder[a.eje] || 0) - (axisOrder[b.eje] || 0);
    });

    sortedConteos.forEach(item => {
        const row = [
            cleanCSVCell(item.fecha),
            cleanCSVCell(item.campo),
            cleanCSVCell(item.cuartel),
            cleanCSVCell(item.coordenadas),
            cleanCSVCell(item.planta),
            cleanCSVCell(item.eje),
            cleanCSVCell(item.trabajador),
            cleanCSVCell(item.punto_rojo),
            cleanCSVCell(item.estilo_elongado),
            cleanCSVCell(item.plena_flor),
            cleanCSVCell(item.flor_senescente),
            cleanCSVCell(item.supervisor)
        ];
        csvRows.push(row.join(";"));
    });

    // Create CSV content with UTF-8 BOM (\uFEFF)
    // The BOM ensures Excel on Windows reads UTF-8 characters (like accents and ñ) correctly
    const csvContent = "\uFEFF" + csvRows.join("\r\n");

    try {
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        
        // Build readable file name: conteo_campo_cuartel_fecha.csv
        const cleanField = appState.campo.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const cleanBlock = appState.cuartel.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `conteo_${cleanField}_${cleanBlock}_${appState.fecha}.csv`;

        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast("Archivo Excel (CSV) exportado con éxito.", "success");
    } catch (e) {
        console.error("Error al exportar CSV:", e);
        showToast("No se pudo generar el archivo de exportación.", "danger");
    }
}
