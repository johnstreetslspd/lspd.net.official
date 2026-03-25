// ============================================
// mitarbeiter-logic.js - All Portal Staff Logic
// Nutzt die globalen Variablen aus db.js
// ============================================

const DEFAULT_ROLES = ['Trainee', 'Mitarbeiter', 'Ausbilder', 'Leitungseben', 'Personalverwaltung', 'Admin', 'Commissioner'];
const FEATURES = ['users', 'ranks', 'employees', 'citizens', 'evidence', 'training', 'applications', 'citations', 'charges', 'press', 'requests', 'admin'];

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

let activeChargesTab = 'all';
let currentChargeId = null;

function getAllRoles() {
    return [...DEFAULT_ROLES, ...(database.customRoles || [])];
}

// ========== PASSWORD & GENERATION ==========
function generatePassword() {
    let p = '';
    for (let i = 0; i < 12; i++) p += Math.random().toString(36).charAt(2);
    return p.toUpperCase();
}

function generateNewPassword() {
    document.getElementById('newPassword').value = generatePassword();
}

// ========== DATABASE OPERATIONS ==========
function loadDatabase() {
    // Die Daten sind jetzt in db.js initialisiert
    if (!database.rolePermissions) {
        database.rolePermissions = { ...defaultRolePermissions };
    }
}

function saveDatabase() {
    // Nutze die globale Funktion aus db.js
    if (typeof saveToFirestore !== 'undefined') {
        saveToFirestore().catch(e => console.error('Firebase sync failed:', e));
    } else {
        console.warn('⚠️ Firestore nicht verfügbar');
    }
}

// ========== UI NOTIFICATIONS ==========
function showToast(title, message, type) {
    const d = document.createElement('div');
    d.className = `toast ${type}`;
    d.innerHTML = `<strong>${title}</strong><br>${message}`;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 3000);
}

// ========== ROLE & PERMISSIONS ==========
function getRolePermissions() {
    return database.rolePermissions || defaultRolePermissions;
}

function canAccess(capability) {
    if (!currentUser) return false;
    const perms = getRolePermissions()[currentUser.role] || [];
    const userObj = database.users.find(u => u.username === currentUser.username);
    const extra = userObj?.extraPermissions || [];
    return perms.includes(capability) || extra.includes(capability);
}

function filterDashboardCards() {
    if (!currentUser) return;
    const cards = document.querySelectorAll('.card[data-role]');
    cards.forEach(card => {
        const roles = card.dataset.role.split(',');
        card.classList.toggle('hidden', !roles.includes(currentUser.role));
    });
}

// ========== LOGIN ==========
function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    const usr = database.users.find(x => x.username === u && x.password === p);
    
    if (usr) {
        currentUser = { username: u, role: usr.role };
        loginSuccess();
    } else {
        document.getElementById('loginError').style.display = 'block';
        document.getElementById('loginError').textContent = 'Ungültig';
    }
}

function loginSuccess() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('currentUser').textContent = currentUser.username;
    document.getElementById('userRole').textContent = `(${currentUser.role})`;
    filterDashboardCards();
    updateCounts();

    if (firebaseEnabled) {
        // Load fresh data after login and update counters once loaded
        loadFromFirestore().then(() => {
            updateCounts();
            cleanupOldApplications();
        }).catch(e => console.warn('Firestore load on login failed:', e));
        startAutoSync();
    }
}

function handleLogout() {
    currentUser = null;
    stopAutoSync();
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

// ========== MODALS ==========
function openModal(t) {
    const m = {
        addUser: 'addUserModal', addRank: 'addRankModal', addEmployee: 'addEmployeeModal',
        addCitizen: 'addCitizenModal', addEvidence: 'addEvidenceModal', addTraining: 'addTrainingModal',
        addCitation: 'addCitationModal', addCharge: 'addChargeModal', addPress: 'addPressModal',
        users: 'usersViewModal', ranks: 'ranksViewModal', employees: 'employeesViewModal',
        citizens: 'citizensViewModal', evidence: 'evidenceViewModal', training: 'trainingViewModal',
        applications: 'applicationsViewModal', citations: 'citationsViewModal', charges: 'chargesViewModal', press: 'pressViewModal',
        requests: 'requestsViewModal'
    };

    const permMap = {
        addUser: ['users'], addRank: ['ranks'], addEmployee: ['employees'], addCitizen: ['citizens'],
        addEvidence: ['evidence'], addTraining: ['training'], addCitation: ['citations'],
        addCharge: ['charges'], addPress: ['press'], users: ['users'], ranks: ['ranks'],
        employees: ['employees'], citizens: ['citizens'], evidence: ['evidence'],
        training: ['training'], applications: ['applications'], citations: ['citations'],
        charges: ['charges'], press: ['press'], requests: ['requests']
    };

    const reqPerms = permMap[t] || [];
    if (reqPerms.length > 0 && !reqPerms.some(p => canAccess(p))) {
        showToast('🚫 Keine Berechtigung', `Diese Funktion benötigt: ${reqPerms.join(', ')}`, 'error');
        return;
    }

    if (t === 'addUser') { populateJobRankDropdown(); generateNewPassword(); }
    if (t === 'addEvidence') populateEvidenceModal();
    if (t === 'addCharge') populateChargeModal();
    if (t === 'users') renderUsersView();
    if (t === 'ranks') renderRanksView();
    if (t === 'employees') renderEmployeesView();
    if (t === 'citizens') renderCitizensView();
    if (t === 'evidence') renderEvidenceView();
    if (t === 'training') renderTrainingView();
    if (t === 'applications') renderApplicationsView();
    if (t === 'citations') renderCitationsView();
    if (t === 'charges') renderChargesView();
    if (t === 'press') renderPressArticles();
    if (t === 'requests') renderRequestsView();

    const el = document.getElementById(m[t]);
    if (el) el.classList.add('show');
}

function closeModal(t) {
    const m = {
        addUser: 'addUserModal', addRank: 'addRankModal', addEmployee: 'addEmployeeModal',
        addCitizen: 'addCitizenModal', addEvidence: 'addEvidenceModal', addTraining: 'addTrainingModal',
        addCitation: 'addCitationModal', addCharge: 'addChargeModal', addPress: 'addPressModal'
    };
    const el = document.getElementById(m[t]);
    if (el) el.classList.remove('show');
}

function closeViewModal(t) {
    const m = {
        users: 'usersViewModal', ranks: 'ranksViewModal', employees: 'employeesViewModal',
        citizens: 'citizensViewModal', evidence: 'evidenceViewModal', training: 'trainingViewModal',
        applications: 'applicationsViewModal', citations: 'citationsViewModal', charges: 'chargesViewModal',
        press: 'pressViewModal', admin: 'adminPanelModal', userPermissions: 'userPermissionsModal',
        requests: 'requestsViewModal'
    };
    const el = document.getElementById(m[t]);
    if (el) el.classList.remove('show');
}

// ========== DROPDOWNS ==========
function populateJobRankDropdown() {
    const s = document.getElementById('newJobRank');
    s.innerHTML = '';
    database.jobRanks.forEach(r => {
        s.innerHTML += `<option>${r.name}</option>`;
    });
    const r = document.getElementById('newRole');
    r.innerHTML = '';
    getAllRoles().forEach(rl => {
        r.innerHTML += `<option>${rl}</option>`;
    });
}

// ========== USERS ==========
function addUser(e) {
    e.preventDefault();
    const u = {
        id: Date.now(),
        username: document.getElementById('newUsername').value,
        password: document.getElementById('newPassword').value,
        role: document.getElementById('newRole').value,
        jobRank: document.getElementById('newJobRank').value,
        status: 'Aktiv',
        created: new Date().toISOString()
    };
    database.users.push(u);
    saveDatabase();
    closeModal('addUser');
    document.getElementById('addUserModal').querySelector('form').reset();
    showToast('✅ Nutzer hinzugefügt', u.username, 'success');
    updateCounts();
    renderUsersView();
}

function renderUsersView() {
    const b = document.getElementById('usersViewTableBody');
    b.innerHTML = database.users.map(u => {
        const extra = u.extraPermissions || [];
        const extraBadge = extra.length > 0 ? ` <span style="color:var(--warning);font-size:0.8em">+${extra.length}</span>` : '';
        return `<tr><td>${u.username}</td><td><span class="badge badge-info">${u.role}</span></td><td>${u.jobRank}</td><td><span class="badge badge-success">${u.status}</span></td><td><button class="btn btn-small btn-primary" onclick="openUserPermissionsModal(${u.id})" title="Individuelle Berechtigungen">🔑${extraBadge}</button><button class="btn btn-small" onclick="deleteUser(${u.id})">×</button></td></tr>`;
    }).join('');
}

function deleteUser(id) {
    if (confirm('Löschen?')) {
        database.users = database.users.filter(u => u.id !== id);
        saveDatabase();
        renderUsersView();
        updateCounts();
    }
}

// ========== RANKS ==========
function addRank(e) {
    e.preventDefault();
    const r = {
        id: Date.now(),
        name: document.getElementById('rankName').value,
        color: document.getElementById('rankColor').value,
        description: document.getElementById('rankDesc').value
    };
    database.jobRanks.push(r);
    saveDatabase();
    closeModal('addRank');
    document.getElementById('addRankModal').querySelector('form').reset();
    showToast('✅ Rang hinzugefügt', r.name, 'success');
    updateCounts();
}

function renderRanksView() {
    const b = document.getElementById('ranksViewTableBody');
    b.innerHTML = database.jobRanks.map(r => 
        `<tr><td>${r.name}</td><td><div style="width:20px;height:20px;background:${r.color};border-radius:2px"></div></td><td>${r.description}</td><td><button class="btn btn-small" onclick="deleteRank(${r.id})">×</button></td></tr>`
    ).join('');
}

function deleteRank(id) {
    if (confirm('Löschen?')) {
        database.jobRanks = database.jobRanks.filter(r => r.id !== id);
        saveDatabase();
        renderRanksView();
        updateCounts();
    }
}

// ========== EMPLOYEES ==========
function addEmployee(e) {
    e.preventDefault();
    const emp = {
        id: Date.now(),
        name: document.getElementById('empName').value,
        role: document.getElementById('empRole').value,
        dept: document.getElementById('empDept').value,
        status: document.getElementById('empStatus').value
    };
    database.employees.push(emp);
    saveDatabase();
    closeModal('addEmployee');
    document.getElementById('addEmployeeModal').querySelector('form').reset();
    showToast('✅ Mitarbeiter hinzugefügt', emp.name, 'success');
    updateCounts();
}

function renderEmployeesView() {
    const b = document.getElementById('employeesViewTableBody');
    b.innerHTML = database.employees.map(e => 
        `<tr><td>${e.name}</td><td>${e.role}</td><td>${e.dept}</td><td>${e.status}</td><td><button class="btn btn-small" onclick="deleteEmployee(${e.id})">×</button></td></tr>`
    ).join('');
}

function deleteEmployee(id) {
    if (confirm('Löschen?')) {
        database.employees = database.employees.filter(e => e.id !== id);
        saveDatabase();
        renderEmployeesView();
        updateCounts();
    }
}

// ========== CITIZENS ==========
function addCitizen(e) {
    e.preventDefault();
    const c = {
        id: Date.now(),
        name: document.getElementById('ctName').value,
        phone: document.getElementById('ctPhone').value,
        address: document.getElementById('ctAddress').value,
        status: document.getElementById('ctStatus').value
    };
    database.citizens.push(c);
    saveDatabase();
    closeModal('addCitizen');
    document.getElementById('addCitizenModal').querySelector('form').reset();
    showToast('✅ Bürger hinzugefügt', c.name, 'success');
    updateCounts();
}

function renderCitizensView() {
    const b = document.getElementById('citizensViewTableBody');
    b.innerHTML = database.citizens.map(c => 
        `<tr><td>${c.name}</td><td>${c.phone}</td><td>${c.address}</td><td>${c.status}</td><td><button class="btn btn-small" onclick="deleteCitizen(${c.id})">×</button></td></tr>`
    ).join('');
}

function deleteCitizen(id) {
    if (confirm('Löschen?')) {
        database.citizens = database.citizens.filter(c => c.id !== id);
        saveDatabase();
        renderCitizensView();
        updateCounts();
    }
}

// ========== EVIDENCE ==========
function addEvidence(e) {
    e.preventDefault();
    const vergehen = getSelectedVergehen('evVergehen');
    const ev = {
        id: Date.now(),
        aktenzeichen: `BM-${Date.now().toString().slice(-6)}`,
        type: document.getElementById('evType').value,
        name: document.getElementById('evName').value,
        description: document.getElementById('evDesc').value,
        location: document.getElementById('evLocation').value,
        citationAZ: document.getElementById('evCitationAZ').value,
        vergehen: vergehen,
        date: new Date().toISOString()
    };
    database.evidence.push(ev);
    saveDatabase();
    closeModal('addEvidence');
    document.getElementById('addEvidenceModal').querySelector('form').reset();
    showToast('✅ Beweismittel hinzugefügt', ev.aktenzeichen, 'success');
    updateCounts();
}

const EVIDENCE_TYPE_ICON = { Waffe: '🔫', Drogen: '💊', Sonstiges: '📦' };

function renderEvidenceView() {
    const b = document.getElementById('evidenceViewTableBody');
    b.innerHTML = database.evidence.map(e => {
        const icon = EVIDENCE_TYPE_ICON[e.type] || '📦';
        const az = e.citationAZ ? `<span class="badge badge-info" style="font-size:0.75em">${e.citationAZ}</span>` : '<span style="color:var(--text-secondary)">–</span>';
        const vergehen = (e.vergehen && e.vergehen.length) ? e.vergehen.join(', ') : '<span style="color:var(--text-secondary)">–</span>';
        return `<tr><td>${e.aktenzeichen}</td><td>${icon} ${e.type || 'Sonstiges'}</td><td><strong>${e.name || e.description}</strong></td><td>${e.location}</td><td>${az}</td><td style="max-width:180px;font-size:0.8em">${vergehen}</td><td><button class="btn btn-small" onclick="deleteEvidence(${e.id})">×</button></td></tr>`;
    }).join('');
}

function deleteEvidence(id) {
    if (confirm('Löschen?')) {
        database.evidence = database.evidence.filter(e => e.id !== id);
        saveDatabase();
        renderEvidenceView();
        updateCounts();
    }
}

// ========== EVIDENCE & CHARGE HELPERS ==========
const VERGEHEN_LIST = [
    'Körperverletzung', 'Schwere Körperverletzung', 'Totschlag', 'Mord',
    'Raub', 'Diebstahl', 'Einbruchsdiebstahl', 'Betrug',
    'Drogenbesitz', 'Drogenhandel', 'Illegaler Waffenbesitz',
    'Widerstand gegen Vollstreckungsbeamte', 'Fahren ohne Fahrerlaubnis',
    'Fahren unter Einfluss', 'Sachbeschädigung', 'Erpressung'
];

function renderVergehenCheckboxes(containerId, selected = []) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = VERGEHEN_LIST.map(v => {
        const checked = selected.includes(v) ? 'checked' : '';
        return `<label style="display:flex;align-items:center;gap:4px;font-size:0.85em;cursor:pointer"><input type="checkbox" value="${v}" ${checked} style="accent-color:var(--secondary)"> ${v}</label>`;
    }).join('');
}

function getSelectedVergehen(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    return Array.from(container.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
}

function populateEvidenceModal() {
    const sel = document.getElementById('evCitationAZ');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Keine Strafakte zuordnen --</option>';
    database.citations.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.aktenzeichen;
        opt.textContent = `${c.aktenzeichen} – ${c.name}`;
        sel.appendChild(opt);
    });
    renderVergehenCheckboxes('evVergehen');
}

function populateChargeModal() {
    const sel = document.getElementById('chargeAktenzeichen');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Keine Strafakte --</option>';
    database.citations.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.aktenzeichen;
        opt.textContent = `${c.aktenzeichen} – ${c.name}`;
        sel.appendChild(opt);
    });
    renderVergehenCheckboxes('chargeVergehen');
    const box = document.getElementById('chargeLinkedEvidenceBox');
    if (box) box.style.display = 'none';
}

function updateLinkedEvidence() {
    const az = document.getElementById('chargeAktenzeichen').value;
    const box = document.getElementById('chargeLinkedEvidenceBox');
    const list = document.getElementById('chargeLinkedEvidence');
    if (!az) { if (box) box.style.display = 'none'; return; }
    const linked = database.evidence.filter(ev => ev.citationAZ === az);
    if (box) box.style.display = 'block';
    if (list) {
        if (linked.length === 0) {
            list.innerHTML = '<em style="color:var(--text-secondary)">Keine Beweismittel für dieses AZ erfasst.</em>';
        } else {
            list.innerHTML = linked.map(ev =>
                `<div>• ${EVIDENCE_TYPE_ICON[ev.type] || '📦'} <strong>${ev.name || ev.description}</strong> (${ev.type || 'Sonstiges'}) – ${ev.location}</div>`
            ).join('');
        }
    }
}

// ========== AI TEXT IMPROVEMENT ==========
function improveTextLegal(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field || !field.value.trim()) {
        showToast('⚠️ Hinweis', 'Bitte zuerst eine Beschreibung eingeben.', 'error');
        return;
    }
    const original = field.value.trim();
    field.value = formatLegalText(original);
    showToast('🤖 KI', 'Text wurde rechtssicherer formuliert.', 'success');
}

function formatLegalText(text) {
    let t = text.replace(/([.!?]\s+)([a-zäöüß])/g, (m, p1, p2) => p1 + p2.toUpperCase());
    t = t.charAt(0).toUpperCase() + t.slice(1);
    if (!/[.!?]$/.test(t.trim())) t = t.trim() + '.';

    const replacements = [
        [/\bwurde erwischt\b/gi, 'wurde auf frischer Tat angetroffen'],
        [/\bwar dabei\b/gi, 'wurde dabei angetroffen'],
        [/\bziemlich\b/gi, 'deutlich'],
        [/\bsehr\b/gi, 'erheblich'],
        [/\bviele\b/gi, 'mehrere'],
        [/\bein bisschen\b/gi, 'geringfügig'],
        [/\bman hat\b/gi, 'die Beamten haben'],
        [/\bwir haben\b/gi, 'die eingesetzten Beamten haben'],
        [/\bich habe\b/gi, 'der unterzeichnende Beamte hat'],
        [/\bschnell\b/gi, 'unverzüglich'],
        [/\bDann\b/g, 'Im Anschluss daran'],
        [/\bdann\b/g, 'im Anschluss daran'],
        [/\bDanach\b/g, 'Im weiteren Verlauf'],
        [/\bdanach\b/g, 'im weiteren Verlauf'],
        [/\bgefunden\b/g, 'aufgefunden'],
        [/\bsah\b/g, 'nahm wahr'],
        [/\bsehen\b/g, 'wahrnehmen']
    ];

    for (const [pattern, replacement] of replacements) {
        t = t.replace(pattern, replacement);
    }

    const formalPrefixes = ['Am ', 'Im Rahmen', 'Hiermit', 'Es wird', 'Der Beschuldigte', 'Die Beamten'];
    const hasPrefix = formalPrefixes.some(p => t.startsWith(p));
    if (!hasPrefix) {
        const date = new Date().toLocaleDateString('de-DE');
        t = `Am ${date} wurde Folgendes festgestellt: ${t}`;
    }
    return t;
}

// ========== CHARGE REPORT ==========
function generateChargeReport(data) {
    const date = new Date().toLocaleDateString('de-DE');
    const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const vergehen = (data.vergehen && data.vergehen.length) ? data.vergehen.join(', ') : data.type;
    const evidenceSection = (data.evidence && data.evidence.length)
        ? data.evidence.map(ev => `  • [${ev.type || 'Sonstiges'}] ${ev.name || ev.description} – Fundort: ${ev.location}`).join('\n')
        : '  Keine Beweismittel erfasst.';

    return `POLIZEIANZEIGE – Los Santos Police Department
${'='.repeat(50)}
Datum: ${date}  |  Uhrzeit: ${time}
Bearbeitender Beamter: ${data.officer}
${'─'.repeat(50)}
BESCHULDIGTER: ${data.name}
Aktenzeichen Strafakte: ${data.aktenzeichen || 'Nicht zugeordnet'}
Hauptvorwurf: ${data.type}
Vergehen: ${vergehen}
${'─'.repeat(50)}
SACHVERHALT:
${data.description}
${'─'.repeat(50)}
SICHERGESTELLTE BEWEISMITTEL:
${evidenceSection}
${'─'.repeat(50)}
Diese Anzeige wurde gemäß den Vorschriften der
Los Santos Police Department erstellt.`;
}

function showChargeReport(c) {
    if (!c.report) return;
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.style.zIndex = '10000';
    const escHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const safeReport = escHtml(c.report);
    modal.innerHTML = `
        <div class="modal-content" style="max-width:700px;max-height:90vh;overflow-y:auto">
            <div class="modal-header"><h2>📋 Anzeige ${escHtml(c.chargeNumber)}</h2><button class="modal-close" onclick="this.closest('.modal').remove()">×</button></div>
            <pre style="background:rgba(0,0,0,0.3);padding:16px;border-radius:6px;white-space:pre-wrap;font-size:0.85em;color:var(--text-primary);font-family:monospace;margin:12px 0">${safeReport}</pre>
            <button class="btn btn-primary" style="width:100%" id="copyReportBtn_${c.id}">📋 Bericht kopieren</button>
        </div>`;
    document.body.appendChild(modal);
    modal.querySelector(`#copyReportBtn_${c.id}`).addEventListener('click', function() {
        const btn = this;
        navigator.clipboard.writeText(c.report).then(() => {
            btn.textContent = '✅ Kopiert!';
            setTimeout(() => { btn.textContent = '📋 Bericht kopieren'; }, 2000);
        }).catch(() => {
            showToast('⚠️ Fehler', 'Kopieren nicht möglich. Bitte manuell kopieren.', 'error');
        });
    });
    modal.addEventListener('click', function(ev) { if (ev.target === modal) modal.remove(); });
}


function addTraining(e) {
    e.preventDefault();
    const t = {
        id: Date.now(),
        title: document.getElementById('trainTitle').value,
        instructor: document.getElementById('trainInstructor').value
    };
    database.training.push(t);
    saveDatabase();
    closeModal('addTraining');
    document.getElementById('addTrainingModal').querySelector('form').reset();
    showToast('✅ Schulung hinzugefügt', t.title, 'success');
    updateCounts();
}

function renderTrainingView() {
    const b = document.getElementById('trainingViewTableBody');
    b.innerHTML = database.training.map(t => 
        `<tr><td>${t.title}</td><td>${t.instructor}</td><td><button class="btn btn-small" onclick="deleteTraining(${t.id})">×</button></td></tr>`
    ).join('');
}

function deleteTraining(id) {
    if (confirm('Löschen?')) {
        database.training = database.training.filter(t => t.id !== id);
        saveDatabase();
        renderTrainingView();
        updateCounts();
    }
}

// ========== APPLICATIONS ==========
function renderApplicationsView() {
    const b = document.getElementById('applicationsViewTableBody');
    const pending = database.applications.filter(a => a.status === 'Eingereicht').length;
    const badge = document.getElementById('pendingAppsBadge');
    if (badge) badge.textContent = pending > 0 ? `${pending} ausstehend` : '';

    const filterText = document.getElementById('applicationsSearch')?.value?.toLowerCase() || '';
    const filterStatus = document.getElementById('applicationsFilter')?.value || '';

    const filtered = database.applications.filter(a => {
        const matchText = !filterText ||
            a.name?.toLowerCase().includes(filterText) ||
            a.code?.toLowerCase().includes(filterText) ||
            a.email?.toLowerCase().includes(filterText);
        const matchStatus = !filterStatus || a.status === filterStatus;
        return matchText && matchStatus;
    });

    if (filtered.length === 0) {
        b.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-secondary);padding:20px">Keine Bewerbungen gefunden</td></tr>`;
        return;
    }

    b.innerHTML = filtered.sort((x, y) => {
        // Ausstehende Bewerbungen zuerst
        if (x.status === 'Eingereicht' && y.status !== 'Eingereicht') return -1;
        if (x.status !== 'Eingereicht' && y.status === 'Eingereicht') return 1;
        return new Date(y.date) - new Date(x.date);
    }).map(a => {
        const isPending = a.status === 'Eingereicht';
        const badgeCls = a.status === 'Akzeptiert' ? 'badge-success' : a.status === 'Abgelehnt' ? 'badge-danger' : 'badge-warning';
        const dateStr = a.date ? new Date(a.date).toLocaleDateString('de-DE') : '—';
        const isAdmin = canAccess('admin');
        const deleteBtn = isAdmin ? `<button class="btn btn-small" onclick="deleteApplication(${a.id})" title="Löschen" style="margin-left:4px;background:rgba(255,51,51,0.2);color:var(--danger);border:1px solid rgba(255,51,51,0.4)">🗑</button>` : '';
        let autoDeleteInfo = '';
        if (!isPending && a.resolvedDate) {
            const daysLeft = Math.ceil((new Date(a.resolvedDate).getTime() + ONE_WEEK_MS - Date.now()) / (24 * 60 * 60 * 1000));
            if (daysLeft > 0) autoDeleteInfo = `<div style="font-size:0.7em;color:var(--text-secondary);margin-top:2px">Löscht in ${daysLeft} ${daysLeft !== 1 ? 'Tage' : 'Tag'}</div>`;
        }
        return `<tr>
            <td><strong>${escapeHtml(a.name)}</strong></td>
            <td style="font-size:0.8em;font-family:monospace">${escapeHtml(a.code)}</td>
            <td>${escapeHtml(a.email || '—')}</td>
            <td>${escapeHtml(a.phone || '—')}</td>
            <td style="font-size:0.85em">${dateStr}</td>
            <td><span class="badge ${badgeCls}">${a.status}</span></td>
            <td style="white-space:nowrap">
                <button class="btn btn-small btn-primary" onclick="viewApplication(${a.id})" title="Details anzeigen"><i class="fas fa-eye"></i></button>
                ${isPending ? `<button class="btn btn-small btn-success" onclick="acceptApplication(${a.id})" title="Annehmen" style="margin-left:4px">✓</button><button class="btn btn-small" onclick="rejectApplication(${a.id})" title="Ablehnen" style="margin-left:4px;background:rgba(255,51,51,0.2);color:var(--danger);border:1px solid rgba(255,51,51,0.4)">✗</button>` : ''}
                ${deleteBtn}
                ${autoDeleteInfo}
            </td>
        </tr>`;
    }).join('');
}

function filterApplications() {
    renderApplicationsView();
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function viewApplication(id) {
    const a = database.applications.find(x => x.id === id);
    if (!a) return;

    const isPending = a.status === 'Eingereicht';
    const badgeCls = a.status === 'Akzeptiert' ? 'badge-success' : a.status === 'Abgelehnt' ? 'badge-danger' : 'badge-warning';
    const dateStr = a.date ? new Date(a.date).toLocaleString('de-DE') : '—';

    const content = document.getElementById('applicationDetailContent');
    content.innerHTML = `
        <div style="display:grid;gap:12px">
            <div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(0,102,204,0.1);border-radius:8px;border:1px solid rgba(0,102,204,0.2)">
                <i class="fas fa-user-circle" style="font-size:2.5em;color:var(--primary-bright)"></i>
                <div>
                    <div style="font-size:1.2em;font-weight:700;color:var(--secondary)">${escapeHtml(a.name)}</div>
                    <div style="font-size:0.85em;color:var(--text-secondary);font-family:monospace">${escapeHtml(a.code)}</div>
                    <span class="badge ${badgeCls}" style="margin-top:4px">${a.status}</span>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div style="background:rgba(0,102,204,0.07);padding:10px;border-radius:6px">
                    <div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:4px"><i class="fas fa-envelope"></i> E-Mail</div>
                    <div style="font-weight:600">${escapeHtml(a.email || '—')}</div>
                </div>
                <div style="background:rgba(0,102,204,0.07);padding:10px;border-radius:6px">
                    <div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:4px"><i class="fas fa-phone"></i> Telefon</div>
                    <div style="font-weight:600">${escapeHtml(a.phone || '—')}</div>
                </div>
                <div style="background:rgba(0,102,204,0.07);padding:10px;border-radius:6px">
                    <div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:4px"><i class="fas fa-graduation-cap"></i> Ausbildung</div>
                    <div>${escapeHtml(a.education || '—')}</div>
                </div>
                <div style="background:rgba(0,102,204,0.07);padding:10px;border-radius:6px">
                    <div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:4px"><i class="fas fa-calendar-alt"></i> Eingereicht am</div>
                    <div>${dateStr}</div>
                </div>
            </div>
            ${a.experience ? `<div style="background:rgba(0,102,204,0.07);padding:12px;border-radius:6px">
                <div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:6px"><i class="fas fa-briefcase"></i> Erfahrung / Motivation</div>
                <div style="line-height:1.6;white-space:pre-wrap">${escapeHtml(a.experience)}</div>
            </div>` : ''}
        </div>`;

    const actions = document.getElementById('applicationDetailActions');
    const adminDeleteBtn = canAccess('admin') ? `<button class="btn" onclick="deleteApplication(${a.id});document.getElementById('applicationDetailModal').classList.remove('show')" style="background:rgba(255,51,51,0.2);color:var(--danger);border:1px solid rgba(255,51,51,0.4)"><i class="fas fa-trash"></i> Löschen</button>` : '';
    if (isPending) {
        actions.innerHTML = `
            <button class="btn btn-success" onclick="acceptApplication(${a.id});document.getElementById('applicationDetailModal').classList.remove('show')">
                <i class="fas fa-check"></i> Annehmen
            </button>
            <button class="btn" onclick="rejectApplication(${a.id});document.getElementById('applicationDetailModal').classList.remove('show')" style="background:rgba(255,51,51,0.2);color:var(--danger);border:1px solid rgba(255,51,51,0.4)">
                <i class="fas fa-times"></i> Ablehnen
            </button>
            ${adminDeleteBtn}`;
    } else {
        actions.innerHTML = `<span style="color:var(--text-secondary);font-size:0.9em">Diese Bewerbung wurde bereits bearbeitet.</span> ${adminDeleteBtn}`;
    }

    document.getElementById('applicationDetailModal').classList.add('show');
}

function acceptApplication(id) {
    const a = database.applications.find(x => x.id === id);
    if (a && a.status === 'Eingereicht') {
        a.status = 'Akzeptiert';
        a.resolvedDate = new Date().toISOString();
        saveDatabase();
        renderApplicationsView();
        updateCounts();
        showToast('✅ Bewerbung angenommen', a.name, 'success');
    }
}

function rejectApplication(id) {
    const a = database.applications.find(x => x.id === id);
    if (a && a.status === 'Eingereicht') {
        if (!confirm('Bewerbung wirklich ablehnen?')) return;
        a.status = 'Abgelehnt';
        a.resolvedDate = new Date().toISOString();
        saveDatabase();
        renderApplicationsView();
        updateCounts();
        showToast('❌ Bewerbung abgelehnt', a.name, 'error');
    }
}

function deleteApplication(id) {
    if (!canAccess('admin')) {
        showToast('🚫 Keine Berechtigung', 'Nur Admins können Bewerbungen löschen', 'error');
        return;
    }
    if (!confirm('Bewerbung wirklich löschen?')) return;
    database.applications = database.applications.filter(a => a.id !== id);
    saveDatabase();
    renderApplicationsView();
    updateCounts();
    showToast('🗑️ Bewerbung gelöscht', '', 'success');
}

function cleanupOldApplications() {
    const oneWeekAgo = Date.now() - ONE_WEEK_MS;
    const before = database.applications.length;
    database.applications = database.applications.filter(a => {
        if (a.status === 'Eingereicht') return true;
        const resolvedTs = a.resolvedDate ? new Date(a.resolvedDate).getTime() : null;
        if (!resolvedTs) return true;
        return resolvedTs > oneWeekAgo;
    });
    if (database.applications.length < before) {
        saveDatabase();
        updateCounts();
        console.log(`🗑️ ${before - database.applications.length} alte Bewerbung(en) automatisch gelöscht`);
    }
}

// ========== CITATIONS (Strafakten) ==========
function addCitation(e) {
    e.preventDefault();
    const c = {
        id: Date.now(),
        aktenzeichen: `CA-${Date.now().toString().slice(-6)}`,
        name: document.getElementById('citName').value,
        type: document.getElementById('citType').value,
        description: document.getElementById('citDesc').value,
        officer: document.getElementById('citOfficer').value,
        date: new Date().toISOString(),
        editUntil: Date.now() + 30 * 60000
    };
    database.citations.push(c);
    saveDatabase();
    closeModal('addCitation');
    document.getElementById('addCitationModal').querySelector('form').reset();
    showToast('✅ Strafakte erstellt', c.aktenzeichen, 'success');
    updateCounts();
    renderCitationsView();
}

function renderCitationsView() {
    const b = document.getElementById('citationsViewTableBody');
    b.innerHTML = database.citations.map(c => {
        const canEdit = Date.now() < c.editUntil;
        const timeLeft = Math.max(0, Math.ceil((c.editUntil - Date.now()) / 60000));
        return `<tr><td>${c.aktenzeichen}</td><td>${c.name}</td><td><span class="badge badge-info">${c.type}</span></td><td>${c.officer}</td><td>${new Date(c.date).toLocaleDateString('de-DE')}</td><td>${canEdit ? `<button class="btn btn-small" onclick="editCitation(${c.id})" title="Noch ${timeLeft} Min">✎</button>` : '<span style="color:var(--text-secondary);font-size:0.8em">Gesperrt</span>'}<button class="btn btn-small" ${canEdit ? '' : 'disabled'} onclick="deleteCitation(${c.id})">×</button></td></tr>`;
    }).join('');
}

function deleteCitation(id) {
    if (confirm('Strafakte löschen?')) {
        const c = database.citations.find(x => x.id === id);
        if (c && Date.now() >= c.editUntil) {
            showToast('🔒 Zu spät', 'Diese Strafakte kann nicht mehr gelöscht werden', 'error');
            return;
        }
        database.citations = database.citations.filter(c => c.id !== id);
        saveDatabase();
        renderCitationsView();
        updateCounts();
        showToast('✅ Gelöscht', 'Strafakte gelöscht', 'success');
    }
}

function editCitation(id) {
    const c = database.citations.find(x => x.id === id);
    if (!c || Date.now() >= c.editUntil) {
        showToast('🔒 Zu spät', 'Diese Strafakte kann nicht mehr bearbeitet werden', 'error');
        return;
    }
    document.getElementById('citName').value = c.name;
    document.getElementById('citType').value = c.type;
    document.getElementById('citDesc').value = c.description;
    document.getElementById('citOfficer').value = c.officer;
    
    document.getElementById('addCitationModal').querySelector('form').onsubmit = ((e) => {
        e.preventDefault();
        c.name = document.getElementById('citName').value;
        c.type = document.getElementById('citType').value;
        c.description = document.getElementById('citDesc').value;
        c.officer = document.getElementById('citOfficer').value;
        saveDatabase();
        closeModal('addCitation');
        document.getElementById('addCitationModal').querySelector('form').reset();
        document.getElementById('addCitationModal').querySelector('form').onsubmit = null;
        showToast('✅ Aktualisiert', 'Strafakte aktualisiert', 'success');
        renderCitationsView();
    });
    openModal('addCitation');
}

// ========== CHARGES (Anzeigen) ==========
function setChargesTab(tab) {
    activeChargesTab = tab;
    ['All', 'Polizei', 'Buerger'].forEach(t => {
        const btn = document.getElementById('chargesTab' + t);
        if (!btn) return;
        if (tab === t.toLowerCase()) {
            btn.className = 'btn btn-primary btn-small';
            btn.style.cssText = '';
        } else {
            btn.className = 'btn btn-small';
            btn.style.cssText = 'background:rgba(0,102,204,0.15);border:1px solid rgba(0,102,204,0.3);color:var(--text-primary)';
        }
    });
    renderChargesView();
}

function addCharge(e) {
    e.preventDefault();
    const vergehen = getSelectedVergehen('chargeVergehen');
    const aktenzeichen = document.getElementById('chargeAktenzeichen').value;
    const linkedEvidence = database.evidence.filter(ev => ev.citationAZ === aktenzeichen);
    const c = {
        id: Date.now(),
        chargeNumber: `AZ-${Date.now().toString().slice(-6)}`,
        name: document.getElementById('chargeName').value,
        type: document.getElementById('chargeType').value,
        vergehen: vergehen,
        aktenzeichen: aktenzeichen,
        description: document.getElementById('chargeDesc').value,
        officer: document.getElementById('chargeOfficer').value,
        status: 'Aktiv',
        date: new Date().toISOString(),
        editUntil: Date.now() + 30 * 60000,
        linkedEvidenceIds: linkedEvidence.map(ev => ev.id),
        report: generateChargeReport({
            name: document.getElementById('chargeName').value,
            type: document.getElementById('chargeType').value,
            vergehen: vergehen,
            aktenzeichen: aktenzeichen,
            description: document.getElementById('chargeDesc').value,
            officer: document.getElementById('chargeOfficer').value,
            evidence: linkedEvidence
        })
    };
    database.charges.push(c);
    saveDatabase();
    closeModal('addCharge');
    document.getElementById('addChargeModal').querySelector('form').reset();
    showToast('✅ Anzeige erstellt', c.chargeNumber, 'success');
    updateCounts();
    renderChargesView();
    showChargeReport(c);
}

function renderChargesView() {
    const b = document.getElementById('chargesViewTableBody');
    const search = (document.getElementById('chargesModalSearch')?.value || '').toLowerCase();
    const isAdmin = canAccess('admin');

    let charges = [...database.charges];
    if (activeChargesTab === 'polizei') charges = charges.filter(c => c.source !== 'citizen');
    else if (activeChargesTab === 'buerger') charges = charges.filter(c => c.source === 'citizen');

    if (search) {
        charges = charges.filter(c =>
            (c.chargeNumber || '').toLowerCase().includes(search) ||
            (c.name || '').toLowerCase().includes(search) ||
            (c.type || '').toLowerCase().includes(search)
        );
    }

    if (charges.length === 0) {
        b.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-secondary);padding:20px">Keine Anzeigen gefunden</td></tr>';
        return;
    }

    b.innerHTML = charges.map(c => {
        const withinWindow = Date.now() < c.editUntil;
        const timeLeft = Math.max(0, Math.ceil((c.editUntil - Date.now()) / 60000));
        const canDel = isAdmin || withinWindow;
        const reportBtn = c.report ? `<button class="btn btn-small" onclick="showChargeReport(database.charges.find(x=>x.id===${c.id}))" title="Bericht">📋</button>` : '';
        const detailBtn = `<button class="btn btn-small btn-primary" onclick="viewCharge(${c.id})" title="Details"><i class="fas fa-eye"></i></button>`;
        const editBtn = withinWindow ? `<button class="btn btn-small" onclick="editCharge(${c.id})" title="Noch ${timeLeft} Min">✎</button>` : '';
        const delBtn = canDel ? `<button class="btn btn-small" onclick="deleteCharge(${c.id})" style="background:rgba(255,51,51,0.2);color:var(--danger);border:1px solid rgba(255,51,51,0.3)">×</button>` : '<span style="color:var(--text-secondary);font-size:0.8em">Gesperrt</span>';
        const sourceLabel = c.source === 'citizen' ? '<span class="badge badge-warning">Bürger</span>' : '<span class="badge badge-info">Polizei</span>';
        return `<tr>
            <td style="font-family:monospace;font-size:0.85em">${c.chargeNumber}</td>
            <td><strong>${c.name}</strong></td>
            <td><span class="badge badge-danger">${c.type}</span></td>
            <td>${sourceLabel}</td>
            <td><span class="badge ${c.status === 'Aktiv' ? 'badge-danger' : 'badge-success'}">${c.status}</span></td>
            <td style="font-size:0.85em">${new Date(c.date).toLocaleDateString('de-DE')}</td>
            <td style="white-space:nowrap">${detailBtn}${reportBtn}${editBtn}${delBtn}</td>
        </tr>`;
    }).join('');
}

function deleteCharge(id) {
    if (confirm('Anzeige wirklich löschen?')) {
        const c = database.charges.find(x => x.id === id);
        if (c && !canAccess('admin') && Date.now() >= c.editUntil) {
            showToast('🔒 Zu spät', 'Diese Anzeige kann nicht mehr gelöscht werden', 'error');
            return;
        }
        database.charges = database.charges.filter(c => c.id !== id);
        saveDatabase();
        renderChargesView();
        updateCounts();
        showToast('✅ Gelöscht', 'Anzeige wurde gelöscht', 'success');
    }
}

function editCharge(id) {
    const c = database.charges.find(x => x.id === id);
    if (!c || Date.now() >= c.editUntil) {
        showToast('🔒 Zu spät', 'Diese Anzeige kann nicht mehr bearbeitet werden', 'error');
        return;
    }
    populateChargeModal();
    document.getElementById('chargeName').value = c.name;
    document.getElementById('chargeType').value = c.type;
    document.getElementById('chargeDesc').value = c.description;
    document.getElementById('chargeOfficer').value = c.officer;
    if (c.aktenzeichen) {
        document.getElementById('chargeAktenzeichen').value = c.aktenzeichen;
        updateLinkedEvidence();
    }
    if (c.vergehen && c.vergehen.length) {
        renderVergehenCheckboxes('chargeVergehen', c.vergehen);
    }
    
    document.getElementById('addChargeModal').querySelector('form').onsubmit = ((e) => {
        e.preventDefault();
        const vergehen = getSelectedVergehen('chargeVergehen');
        c.name = document.getElementById('chargeName').value;
        c.type = document.getElementById('chargeType').value;
        c.vergehen = vergehen;
        c.aktenzeichen = document.getElementById('chargeAktenzeichen').value;
        c.description = document.getElementById('chargeDesc').value;
        c.officer = document.getElementById('chargeOfficer').value;
        saveDatabase();
        closeModal('addCharge');
        document.getElementById('addChargeModal').querySelector('form').reset();
        document.getElementById('addChargeModal').querySelector('form').onsubmit = null;
        showToast('✅ Aktualisiert', 'Anzeige aktualisiert', 'success');
        renderChargesView();
    });
    // Show modal directly to avoid populateChargeModal() being called again by openModal()
    const el = document.getElementById('addChargeModal');
    if (el) el.classList.add('show');
}

// ========== PRESS ARTICLES ==========
function addPressArticle(e) {
    e.preventDefault();
    const p = {
        id: Date.now(),
        title: document.getElementById('pressTitle').value,
        subtitle: document.getElementById('pressSubtitle').value,
        content: document.getElementById('pressContent').value,
        image: document.getElementById('pressImage').value,
        author: document.getElementById('pressAuthor').value,
        date: new Date().toISOString(),
        canEdit: true,
        editUntil: new Date(Date.now() + 30 * 60000).getTime()
    };
    database.press.push(p);
    saveDatabase();
    closeModal('addPress');
    document.getElementById('addPressModal').querySelector('form').reset();
    showToast('✅ Nachricht veröffentlicht', p.title, 'success');
    updateCounts();
    renderPressArticles();
}

function renderPressArticles() {
    const c = document.getElementById('pressArticlesContainer');
    if (database.press.length === 0) {
        c.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:40px">Keine Nachrichten vorhanden</p>';
        return;
    }
    const isAdmin = canAccess('admin');
    c.innerHTML = database.press.sort((a, b) => new Date(b.date) - new Date(a.date)).map(p => {
        const canEdit = Date.now() < p.editUntil;
        const editBtn = canEdit ? `<button class="btn btn-primary btn-small" onclick="editPressArticle(${p.id})">✎ Bearbeiten</button>` : '';
        const canDel = canEdit || isAdmin;
        const delBtn = canDel ? `<button class="btn btn-small" style="background:rgba(255,51,51,0.2);border:1px solid #ff6b6b;color:#ff6b6b" onclick="deletePressArticle(${p.id})">× Löschen</button>` : '';
        return `<div style="background:rgba(0,102,204,0.1);border:1px solid rgba(0,102,204,0.2);border-radius:8px;overflow:hidden"><div style="display:grid;grid-template-columns:200px 1fr;gap:15px;padding:20px">${p.image ? `<img src="${p.image}" style="width:100%;height:180px;object-fit:cover;border-radius:6px;border:1px solid rgba(0,102,204,0.3)">` : ''}<div><h3 style="color:var(--secondary);margin-bottom:6px;font-size:1.2em">${p.title}</h3><p style="color:rgba(255,255,255,0.7);margin-bottom:10px;font-size:0.9em">${p.subtitle}</p><p style="color:var(--text-secondary);line-height:1.6;margin-bottom:12px">${p.content.substring(0, 200)}...</p><div style="display:flex;gap:8px;align-items:center;font-size:0.85em;color:rgba(255,255,255,0.6);margin-bottom:12px"><i class="fas fa-user-circle"></i> <span>${p.author}</span> <i class="fas fa-calendar" style="margin-left:12px"></i> <span>${new Date(p.date).toLocaleDateString('de-DE')}</span></div><div style="display:flex;gap:8px">${editBtn}${delBtn}</div></div></div></div>`;
    }).join('');
}

function editPressArticle(id) {
    const p = database.press.find(x => x.id === id);
    if (!p) return;
    document.getElementById('pressTitle').value = p.title;
    document.getElementById('pressSubtitle').value = p.subtitle;
    document.getElementById('pressContent').value = p.content;
    document.getElementById('pressImage').value = p.image;
    document.getElementById('pressAuthor').value = p.author;
    
    document.getElementById('addPressModal').querySelector('form').onsubmit = ((e) => {
        e.preventDefault();
        p.title = document.getElementById('pressTitle').value;
        p.subtitle = document.getElementById('pressSubtitle').value;
        p.content = document.getElementById('pressContent').value;
        p.image = document.getElementById('pressImage').value;
        p.author = document.getElementById('pressAuthor').value;
        saveDatabase();
        closeModal('addPress');
        document.getElementById('addPressModal').querySelector('form').reset();
        document.getElementById('addPressModal').querySelector('form').onsubmit = null;
        showToast('✅ Nachricht aktualisiert', p.title, 'success');
        renderPressArticles();
    });
    openModal('addPress');
}

function deletePressArticle(id) {
    if (confirm('Nachricht wirklich löschen?')) {
        database.press = database.press.filter(p => p.id !== id);
        saveDatabase();
        renderPressArticles();
        updateCounts();
        showToast('🗑️ Nachricht gelöscht', '', 'success');
    }
}

// ========== CHARGE DETAIL & NOTES ==========
function viewCharge(id) {
    const c = database.charges.find(x => x.id === id);
    if (!c) return;
    currentChargeId = id;
    const sourceLabel = c.source === 'citizen' ? '🧑 Bürger' : '👮 Polizei';
    const content = document.getElementById('chargeDetailContent');
    content.innerHTML = `
        <div style="display:grid;gap:10px">
            <div style="background:rgba(0,102,204,0.1);padding:12px;border-radius:8px;border:1px solid rgba(0,102,204,0.2)">
                <div style="font-size:1.1em;font-weight:700;color:var(--secondary)">${escapeHtml(c.chargeNumber)}</div>
                <div style="font-size:0.85em;color:var(--text-secondary);margin-top:2px">${sourceLabel} · ${new Date(c.date).toLocaleDateString('de-DE')}</div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                <div style="background:rgba(0,102,204,0.07);padding:10px;border-radius:6px">
                    <div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:4px">Bürger</div>
                    <div style="font-weight:600">${escapeHtml(c.name)}</div>
                </div>
                <div style="background:rgba(0,102,204,0.07);padding:10px;border-radius:6px">
                    <div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:4px">Vorwurf</div>
                    <span class="badge badge-danger">${escapeHtml(c.type)}</span>
                </div>
                <div style="background:rgba(0,102,204,0.07);padding:10px;border-radius:6px">
                    <div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:4px">Beamte(r)</div>
                    <div>${escapeHtml(c.officer || '—')}</div>
                </div>
                <div style="background:rgba(0,102,204,0.07);padding:10px;border-radius:6px">
                    <div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:4px">Status</div>
                    <span class="badge ${c.status === 'Aktiv' ? 'badge-danger' : 'badge-success'}">${escapeHtml(c.status)}</span>
                </div>
            </div>
            ${c.description ? `<div style="background:rgba(0,102,204,0.07);padding:10px;border-radius:6px">
                <div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:4px">Sachverhalt</div>
                <div style="line-height:1.6;white-space:pre-wrap">${escapeHtml(c.description)}</div>
            </div>` : ''}
        </div>`;
    renderChargeNotes(c);
    document.getElementById('chargeDetailModal').classList.add('show');
}

function renderChargeNotes(c) {
    const list = document.getElementById('chargeNotesList');
    if (!list) return;
    const notes = c.notes || [];
    if (notes.length === 0) {
        list.innerHTML = '<p style="color:var(--text-secondary);font-size:0.9em;margin:0">Noch keine Notizen vorhanden.</p>';
        return;
    }
    list.innerHTML = notes.map((n, i) => `
        <div style="background:rgba(0,102,204,0.08);border:1px solid rgba(0,102,204,0.2);border-radius:6px;padding:10px;display:flex;gap:10px;align-items:flex-start">
            <div style="flex:1">
                <div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:4px"><i class="fas fa-user"></i> ${escapeHtml(n.author)} · ${new Date(n.date).toLocaleString('de-DE')}</div>
                <div style="line-height:1.5;white-space:pre-wrap">${escapeHtml(n.text)}</div>
            </div>
            <button class="btn btn-small" onclick="deleteChargeNote(${i})" style="background:rgba(255,51,51,0.15);color:var(--danger);border:1px solid rgba(255,51,51,0.3);flex-shrink:0" title="Notiz löschen">×</button>
        </div>`).join('');
}

function addChargeNote() {
    const c = database.charges.find(x => x.id === currentChargeId);
    if (!c) return;
    const input = document.getElementById('chargeNoteInput');
    const text = input.value.trim();
    if (!text) return;
    if (!c.notes) c.notes = [];
    c.notes.push({ text, author: currentUser?.username || 'Unbekannt', date: new Date().toISOString() });
    saveDatabase();
    input.value = '';
    renderChargeNotes(c);
    showToast('✅ Notiz hinzugefügt', '', 'success');
}

function deleteChargeNote(index) {
    const c = database.charges.find(x => x.id === currentChargeId);
    if (!c || !c.notes) return;
    c.notes.splice(index, 1);
    saveDatabase();
    renderChargeNotes(c);
}


function renderAdminStats() {
    const s = document.getElementById('statsPanel');
    if (!s) return;
    const stats = [
        { label: 'Nutzer', value: database.users.length, icon: '👤' },
        { label: 'Ränge', value: database.jobRanks.length, icon: '🏅' },
        { label: 'Mitarbeiter', value: database.employees.length, icon: '👮' },
        { label: 'Bürger', value: database.citizens.length, icon: '🧑' },
        { label: 'Beweise', value: database.evidence.length, icon: '🔍' },
        { label: 'Schulungen', value: database.training.length, icon: '📚' },
        { label: 'Bewerbungen', value: database.applications.length, icon: '📋' },
        { label: 'Strafakten', value: database.citations.length, icon: '📄' },
        { label: 'Anzeigen', value: database.charges.length, icon: '⚠️' },
        { label: 'Nachrichten', value: database.press.length, icon: '📰' },
    ];
    s.innerHTML = stats.map(stat =>
        `<div style="background:rgba(0,255,136,0.1);padding:10px;border-radius:6px;text-align:center"><div style="font-size:1.2em">${stat.icon}</div><div style="color:var(--secondary);font-size:0.8em">${stat.label}</div><div style="font-size:1.4em;font-weight:700">${stat.value}</div></div>`
    ).join('');
}

function openAdminPanel() {
    if (!canAccess('admin')) {
        showToast('🚫 Zugriff verweigert', 'Nur Admins dürfen das Admin Panel öffnen', 'error');
        return;
    }
    document.getElementById('adminPanelModal').classList.add('show');
    renderRoleEditor();
    renderAdminStats();
}

function renderRoleEditor() {
    const perms = getRolePermissions();
    const allRoles = getAllRoles();
    let html = '<div style="margin-bottom:15px"><h4 style="color:var(--secondary);margin:0 0 10px 0">📋 Berechtigungen verwalten</h4><p style="font-size:0.9em;margin:0;color:rgba(255,255,255,0.7)">Wähle aus, welche Funktionen jede Rolle verwenden kann:</p></div>';
    allRoles.forEach(role => {
        const isCustom = (database.customRoles || []).includes(role);
        html += `<div style="border:1px solid rgba(0,255,136,0.3);border-radius:8px;padding:12px;margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong style="color:var(--secondary);font-size:1.1em">${role}${isCustom ? ' <span style="font-size:0.7em;color:var(--warning);border:1px solid var(--warning);border-radius:4px;padding:1px 5px">Custom</span>' : ''}</strong>${isCustom ? `<button onclick="deleteCustomRole('${role}')" style="background:rgba(255,51,51,0.2);border:1px solid #ff6b6b;color:#ff6b6b;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:0.8em">Löschen</button>` : ''}</div>`;
        FEATURES.forEach(feature => {
            const isChecked = perms[role] && perms[role].includes(feature);
            html += `<label style="display:inline-flex;align-items:center;gap:8px;margin-right:15px;cursor:pointer;font-size:0.9em"><input type="checkbox" id="perm_${role}_${feature}" ${isChecked ? 'checked' : ''} onchange="toggleRolePermission('${role}','${feature}')" style="cursor:pointer"><span>${feature}</span></label>`;
        });
        html += '</div>';
    });
    html += `<div style="border:2px dashed rgba(0,255,136,0.3);border-radius:8px;padding:12px;margin-top:15px"><h4 style="color:var(--secondary);margin-bottom:10px">➕ Neue Rolle erstellen</h4><div style="display:flex;gap:8px;align-items:center"><input type="text" id="newRoleName" placeholder="Rollenname..." style="flex:1;padding:8px;background:rgba(0,102,204,0.1);border:1px solid rgba(0,102,204,0.3);border-radius:4px;color:var(--text-primary);font-size:0.9em"><button onclick="createCustomRole()" style="padding:8px 15px;background:linear-gradient(90deg,var(--primary),var(--primary-bright));color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;font-size:0.9em">Erstellen</button></div><p style="font-size:0.8em;color:rgba(255,255,255,0.5);margin-top:6px">Berechtigungen können nach der Erstellung vergeben werden.</p></div>`;
    html += '<div style="border-top:1px solid rgba(0,255,136,0.2);padding-top:12px;margin-top:15px"><button onclick="resetPermissionsToDefault()" style="padding:8px 15px;background:rgba(255,107,107,0.2);border:1px solid #ff6b6b;color:#ff6b6b;border-radius:5px;cursor:pointer;font-size:0.9em;transition:all 0.3s">🔄 Auf Standard zurücksetzen</button></div>';
    document.getElementById('roleEditorPanel').innerHTML = html;
}

function resetPermissionsToDefault() {
    if (!confirm('Alle Berechtigungen auf Standard zurücksetzen?')) return;
    database.rolePermissions = JSON.parse(JSON.stringify(defaultRolePermissions));
    saveDatabase();
    renderRoleEditor();
    showToast('✅ Berechtigungen', 'Auf Standard zurückgesetzt', 'success');
    filterDashboardCards();
}

function toggleRolePermission(role, feature) {
    const perms = getRolePermissions();
    if (!perms[role]) perms[role] = [];
    const idx = perms[role].indexOf(feature);
    const checkbox = document.getElementById(`perm_${role}_${feature}`);
    if (checkbox.checked) {
        if (idx < 0) perms[role].push(feature);
    } else {
        if (idx >= 0) perms[role].splice(idx, 1);
    }
    database.rolePermissions = perms;
    saveDatabase();
    showToast('✅ Berechtigung aktualisiert', `${role} - ${feature}`, 'success');
    filterDashboardCards();
}

function exportAdminData() {
    const e = {timestamp: new Date().toISOString(), data: database};
    const j = JSON.stringify(e, null, 2);
    const b = new Blob([j], {type: 'application/json'});
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u;
    a.download = `admin-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast('💾 Admin-Export', 'Exportiert', 'success');
}

// ========== CUSTOM ROLES ==========
function createCustomRole() {
    const nameInput = document.getElementById('newRoleName');
    const name = nameInput.value.trim();
    if (!name) { showToast('⚠️ Fehler', 'Bitte einen Rollennamen eingeben', 'error'); return; }
    if (getAllRoles().includes(name)) { showToast('⚠️ Fehler', `Rolle "${name}" existiert bereits`, 'error'); return; }
    if (!database.customRoles) database.customRoles = [];
    database.customRoles.push(name);
    if (!database.rolePermissions) database.rolePermissions = {};
    database.rolePermissions[name] = [];
    saveDatabase();
    nameInput.value = '';
    renderRoleEditor();
    showToast('✅ Rolle erstellt', name, 'success');
}

function deleteCustomRole(roleName) {
    if (!confirm(`Rolle "${roleName}" wirklich löschen?`)) return;
    database.customRoles = (database.customRoles || []).filter(r => r !== roleName);
    if (database.rolePermissions) delete database.rolePermissions[roleName];
    saveDatabase();
    renderRoleEditor();
    showToast('✅ Rolle gelöscht', roleName, 'success');
}

// ========== USER PERMISSIONS ==========
function openUserPermissionsModal(userId) {
    const user = database.users.find(u => u.id === userId);
    if (!user) return;
    if (!canAccess('admin')) { showToast('🚫 Zugriff verweigert', 'Nur Admins dürfen Berechtigungen vergeben', 'error'); return; }
    const extra = user.extraPermissions || [];
    const rolePerms = getRolePermissions()[user.role] || [];
    document.getElementById('userPermissionsTitle').textContent = `🔑 Berechtigungen: ${user.username} (${user.role})`;
    let html = '<p style="color:var(--text-secondary);font-size:0.85em;margin-bottom:12px">Aktivierte Features zusätzlich zur Rollen-Berechtigung:</p>';
    FEATURES.forEach(f => {
        const fromRole = rolePerms.includes(f);
        const fromExtra = extra.includes(f);
        const labelColor = fromRole ? 'rgba(0,102,204,0.2)' : fromExtra ? 'rgba(0,255,136,0.1)' : 'rgba(0,0,0,0.1)';
        html += `<label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;background:${labelColor};margin-bottom:6px;cursor:${fromRole ? 'default' : 'pointer'}">
            <input type="checkbox" ${(fromRole || fromExtra) ? 'checked' : ''} ${fromRole ? 'disabled' : `onchange="saveUserPermission(${userId}, '${f}', this.checked)"`} style="cursor:${fromRole ? 'default' : 'pointer'}">
            <span style="flex:1;font-weight:600">${f}</span>
            ${fromRole ? '<span style="font-size:0.75em;color:var(--info);border:1px solid var(--info);border-radius:4px;padding:1px 5px">Rolle</span>' : fromExtra ? '<span style="font-size:0.75em;color:var(--success);border:1px solid var(--success);border-radius:4px;padding:1px 5px">Individuell</span>' : ''}
        </label>`;
    });
    document.getElementById('userPermissionsBody').innerHTML = html;
    document.getElementById('userPermissionsModal').classList.add('show');
}

function saveUserPermission(userId, feature, checked) {
    const user = database.users.find(u => u.id === userId);
    if (!user) return;
    if (!user.extraPermissions) user.extraPermissions = [];
    const idx = user.extraPermissions.indexOf(feature);
    if (checked && idx < 0) user.extraPermissions.push(feature);
    else if (!checked && idx >= 0) user.extraPermissions.splice(idx, 1);
    saveDatabase();
    showToast('✅ Berechtigung gespeichert', `${feature} für ${user.username}`, 'success');
}

// ========== REQUESTS (Anfragen & Beschwerden) ==========
function renderRequestsView() {
    const b = document.getElementById('requestsViewTableBody');
    const requests = database.requests || [];
    const pending = requests.filter(r => r.status === 'Eingereicht').length;
    const badge = document.getElementById('pendingRequestsBadge');
    if (badge) badge.textContent = pending > 0 ? `${pending} ausstehend` : '';

    const filterText = (document.getElementById('requestsSearch')?.value || '').toLowerCase();
    const filterStatus = document.getElementById('requestsFilter')?.value || '';

    const filtered = requests.filter(r => {
        const matchText = !filterText ||
            (r.name || '').toLowerCase().includes(filterText) ||
            (r.subject || '').toLowerCase().includes(filterText) ||
            (r.email || '').toLowerCase().includes(filterText);
        const matchStatus = !filterStatus || r.status === filterStatus;
        return matchText && matchStatus;
    });

    if (filtered.length === 0) {
        b.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-secondary);padding:20px">Keine Anfragen gefunden</td></tr>`;
        return;
    }

    b.innerHTML = filtered.sort((x, y) => {
        if (x.status === 'Eingereicht' && y.status !== 'Eingereicht') return -1;
        if (x.status !== 'Eingereicht' && y.status === 'Eingereicht') return 1;
        return new Date(y.date) - new Date(x.date);
    }).map(r => {
        const badgeCls = r.status === 'Abgeschlossen' ? 'badge-success' : r.status === 'In Bearbeitung' ? 'badge-info' : 'badge-warning';
        const dateStr = r.date ? new Date(r.date).toLocaleDateString('de-DE') : '—';
        return `<tr>
            <td style="font-size:0.8em;font-family:monospace">${escapeHtml(r.id)}</td>
            <td><strong>${escapeHtml(r.name)}</strong></td>
            <td>${escapeHtml(r.email || '—')}</td>
            <td>${escapeHtml(r.subject || '—')}</td>
            <td><span class="badge ${badgeCls}">${r.status}</span></td>
            <td style="font-size:0.85em">${dateStr}</td>
            <td style="white-space:nowrap">
                <button class="btn btn-small btn-primary" onclick="viewRequest('${r.id}')" title="Details anzeigen"><i class="fas fa-eye"></i></button>
                ${r.status === 'Eingereicht' ? `<button class="btn btn-small" onclick="updateRequestStatus('${r.id}','In Bearbeitung')" title="In Bearbeitung" style="margin-left:4px;background:rgba(0,221,255,0.2);color:var(--info);border:1px solid rgba(0,221,255,0.4)">⏳</button>` : ''}
                ${r.status !== 'Abgeschlossen' ? `<button class="btn btn-small btn-success" onclick="updateRequestStatus('${r.id}','Abgeschlossen')" title="Abschließen" style="margin-left:4px">✓</button>` : ''}
            </td>
        </tr>`;
    }).join('');
}

function filterRequestsModal() {
    renderRequestsView();
}

function viewRequest(id) {
    const r = (database.requests || []).find(x => x.id === id);
    if (!r) return;
    const badgeCls = r.status === 'Abgeschlossen' ? 'badge-success' : r.status === 'In Bearbeitung' ? 'badge-info' : 'badge-warning';
    const dateStr = r.date ? new Date(r.date).toLocaleString('de-DE') : '—';
    const content = document.getElementById('requestDetailContent');
    content.innerHTML = `
        <div style="display:grid;gap:12px">
            <div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(0,102,204,0.1);border-radius:8px;border:1px solid rgba(0,102,204,0.2)">
                <i class="fas fa-envelope" style="font-size:2em;color:var(--primary-bright)"></i>
                <div>
                    <div style="font-size:1.1em;font-weight:700;color:var(--secondary)">${escapeHtml(r.subject || '(kein Betreff)')}</div>
                    <div style="font-size:0.85em;color:var(--text-secondary);font-family:monospace">${escapeHtml(r.id)}</div>
                    <span class="badge ${badgeCls}" style="margin-top:4px">${r.status}</span>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div style="background:rgba(0,102,204,0.07);padding:10px;border-radius:6px">
                    <div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:4px"><i class="fas fa-user"></i> Name</div>
                    <div style="font-weight:600">${escapeHtml(r.name || '—')}</div>
                </div>
                <div style="background:rgba(0,102,204,0.07);padding:10px;border-radius:6px">
                    <div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:4px"><i class="fas fa-envelope"></i> E-Mail</div>
                    <div style="font-weight:600">${escapeHtml(r.email || '—')}</div>
                </div>
                <div style="background:rgba(0,102,204,0.07);padding:10px;border-radius:6px;grid-column:1/-1">
                    <div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:4px"><i class="fas fa-calendar-alt"></i> Eingereicht am</div>
                    <div>${dateStr}</div>
                </div>
            </div>
            <div style="background:rgba(0,102,204,0.07);padding:12px;border-radius:6px">
                <div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:6px"><i class="fas fa-comment"></i> Nachricht</div>
                <div style="line-height:1.6;white-space:pre-wrap">${escapeHtml(r.message || '—')}</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
                ${r.status === 'Eingereicht' ? `<button class="btn btn-small" onclick="updateRequestStatus('${r.id}','In Bearbeitung');document.getElementById('requestDetailModal').classList.remove('show')" style="background:rgba(0,221,255,0.2);color:var(--info);border:1px solid rgba(0,221,255,0.4)">⏳ In Bearbeitung</button>` : ''}
                ${r.status !== 'Abgeschlossen' ? `<button class="btn btn-small btn-success" onclick="updateRequestStatus('${r.id}','Abgeschlossen');document.getElementById('requestDetailModal').classList.remove('show')">✓ Abschließen</button>` : ''}
            </div>
        </div>`;
    document.getElementById('requestDetailModal').classList.add('show');
}

function updateRequestStatus(id, newStatus) {
    const r = (database.requests || []).find(x => x.id === id);
    if (!r) return;
    r.status = newStatus;
    saveDatabase();
    renderRequestsView();
    updateCounts();
    showToast('✅ Status aktualisiert', `Anfrage ${id}: ${newStatus}`, 'success');
}

// ========== SEARCH FILTERS ==========
function makeSearchFilter(inputId, tbodyId, columns) {
    const query = (document.getElementById(inputId)?.value || '').toLowerCase();
    document.querySelectorAll(`#${tbodyId} tr`).forEach(row => {
        const match = columns.some(col => row.cells[col]?.textContent.toLowerCase().includes(query));
        row.style.display = match ? '' : 'none';
    });
}

function filterUsersModal() { makeSearchFilter('usersModalSearch', 'usersViewTableBody', [0, 1, 2]); }
function filterRanksModal() { makeSearchFilter('ranksModalSearch', 'ranksViewTableBody', [0, 2]); }
function filterEmployeesModal() { makeSearchFilter('employeesModalSearch', 'employeesViewTableBody', [0, 1, 2]); }
function filterCitizensModal() { makeSearchFilter('citizensModalSearch', 'citizensViewTableBody', [0, 1, 2]); }
function filterEvidenceModal() { makeSearchFilter('evidenceModalSearch', 'evidenceViewTableBody', [0, 1, 2, 3, 4]); }
function filterTrainingModal() { makeSearchFilter('trainingModalSearch', 'trainingViewTableBody', [0, 1]); }
function filterApplicationsModal() { makeSearchFilter('applicationsModalSearch', 'applicationsViewTableBody', [0, 1, 2]); }
function filterCitationsModal() { makeSearchFilter('citationsModalSearch', 'citationsViewTableBody', [0, 1]); }
function filterChargesModal() { renderChargesView(); }
function filterPressModal() {
    const query = (document.getElementById('pressModalSearch')?.value || '').toLowerCase();
    document.querySelectorAll('#pressArticlesContainer > div').forEach(el => {
        el.style.display = el.textContent.toLowerCase().includes(query) ? '' : 'none';
    });
}

//  ========== EXPORT FUNCTIONS ==========
function downloadJSON() {
    const d = JSON.stringify(database, null, 2);
    const b = new Blob([d], {type: 'application/json'});
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u;
    a.download = `lspd-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast('📥 Export', 'JSON exportiert', 'success');
}

function downloadCSV() {
    let c = 'Benutzer,Rolle,Status\n';
    database.users.forEach(u => {
        c += `${u.username},${u.role},${u.status}\n`;
    });
    const b = new Blob([c], {type: 'text/csv'});
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u;
    a.download = `lspd-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    showToast('📥 Export', 'CSV exportiert', 'success');
}

// ========== COUNTERS ==========
function updateCounts() {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('userCount', database.users.length);
    set('rankCount', database.jobRanks.length);
    set('employeeCount', database.employees.length);
    set('citizenCount', database.citizens.length);
    set('evidenceCount', database.evidence.length);
    set('trainingCount', database.training.length);
    set('applicationsCount', database.applications.length);
    set('citationsCount', database.citations.length);
    set('chargesCount', database.charges.length);
    set('pressCount', database.press.length);
    set('requestsCount', (database.requests || []).length);
    renderOverviewStats();
}

function renderOverviewStats() {
    const panel = document.getElementById('overviewStatsPanel');
    if (!panel) return;
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const recentCitations = (database.citations || []).filter(c => c.date && new Date(c.date).getTime() >= oneDayAgo).length;
    const recentApplications = (database.applications || []).filter(a => a.date && new Date(a.date).getTime() >= oneDayAgo).length;
    const stats = [
        { label: 'Akten (24h)', value: recentCitations, icon: '📄', color: 'rgba(0,102,204,0.15)', border: 'rgba(0,102,204,0.3)' },
        { label: 'Bewerbungen (24h)', value: recentApplications, icon: '📋', color: 'rgba(0,255,136,0.1)', border: 'rgba(0,255,136,0.3)' }
    ];
    panel.innerHTML = stats.map(s =>
        `<div style="background:${s.color};border:1px solid ${s.border};padding:14px;border-radius:8px;display:flex;align-items:center;gap:12px"><div style="font-size:1.8em">${s.icon}</div><div><div style="color:var(--text-secondary);font-size:0.8em">${s.label}</div><div style="font-size:1.6em;font-weight:700;color:var(--text-primary)">${s.value}</div></div></div>`
    ).join('');
}

// ========== LIVE UI REFRESH (called by auto-sync every 5 s) ==========
function refreshUI() {
    if (!currentUser) return;
    cleanupOldApplications();
    updateCounts();
    const viewModals = [
        { id: 'usersViewModal',        render: renderUsersView,        filter: filterUsersModal },
        { id: 'ranksViewModal',        render: renderRanksView,        filter: filterRanksModal },
        { id: 'employeesViewModal',    render: renderEmployeesView,    filter: filterEmployeesModal },
        { id: 'citizensViewModal',     render: renderCitizensView,     filter: filterCitizensModal },
        { id: 'evidenceViewModal',     render: renderEvidenceView,     filter: filterEvidenceModal },
        { id: 'trainingViewModal',     render: renderTrainingView,     filter: filterTrainingModal },
        { id: 'applicationsViewModal', render: renderApplicationsView, filter: filterApplications },
        { id: 'citationsViewModal',    render: renderCitationsView,    filter: filterCitationsModal },
        { id: 'chargesViewModal',      render: renderChargesView,      filter: filterChargesModal },
        { id: 'pressViewModal',        render: renderPressArticles,    filter: filterPressModal },
        { id: 'requestsViewModal',     render: renderRequestsView,     filter: filterRequestsModal },
    ];
    viewModals.forEach(({ id, render, filter }) => {
        const el = document.getElementById(id);
        if (el && el.classList.contains('show')) { render(); filter(); }
    });
    const adminPanel = document.getElementById('adminPanelModal');
    if (adminPanel && adminPanel.classList.contains('show')) {
        renderAdminStats();
    }
}

// ========== MODAL CLICK OUTSIDE ==========
window.onclick = function(e) {
    if (e.target.classList.contains('modal'))
        e.target.classList.remove('show');
};

// ========== INITIALIZATION ==========
console.log('✅ mitarbeiter-logic.js geladen');
