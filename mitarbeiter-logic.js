// ============================================
// mitarbeiter-logic.js - All Portal Staff Logic
// Nutzt die globalen Variablen aus db.js
// Modulares Rang- & Rollen-System
// ============================================

const FEATURES = ['users', 'ranks', 'employees', 'citizens', 'evidence', 'training', 'applications', 'citations', 'charges', 'press', 'requests', 'admin'];

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

let activeChargesTab = 'all';
let currentChargeId = null;
let activeAdminTab = 'roles'; // Aktiver Tab im Admin-Panel

// Rückwärtskompatibilität: getAllRoles gibt Rollennamen zurück
function getAllRoles() {
    return getAllRoleNames();
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
    migrateDataIfNeeded();
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
    const strong = document.createElement('strong');
    strong.textContent = title;
    d.appendChild(strong);
    d.appendChild(document.createElement('br'));
    const msg = document.createTextNode(message);
    d.appendChild(msg);
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 3000);
}

// ========== ROLE & PERMISSIONS ==========
function getRolePermissions() {
    // Primär aus Rollen-Objekten, Fallback auf alte Map
    const perms = {};
    getAvailableRoles().forEach(r => { perms[r.name] = r.permissions || []; });
    return perms;
}

function canAccess(capability) {
    if (!currentUser) return false;
    const perms = getPermissionsForRole(currentUser.role);
    const userObj = database.users.find(u => u.username === currentUser.username);
    const extra = userObj?.extraPermissions || [];
    return perms.includes(capability) || extra.includes(capability);
}

function filterDashboardCards() {
    if (!currentUser) return;
    document.querySelectorAll('.card[data-permission]').forEach(card => {
        const reqPerm = card.dataset.permission;
        card.classList.toggle('hidden', !canAccess(reqPerm));
    });
    // Rückwärtskompatibilität: Karten mit data-role
    document.querySelectorAll('.card[data-role]').forEach(card => {
        if (card.dataset.permission) return; // Schon via permission behandelt
        const roles = card.dataset.role.split(',');
        card.classList.toggle('hidden', !roles.includes(currentUser.role));
    });
    // Show/hide training add button based on permission
    const trainAddBtn = document.getElementById('trainingAddBtn');
    if (trainAddBtn) trainAddBtn.style.display = canAccess('training') ? '' : 'none';
}

// ========== LOGIN ==========
const SESSION_KEY = 'lspd_session';
const REMEMBER_KEY = 'lspd_remember';
const SESSION_TTL_MS = ONE_WEEK_MS; // Sitzung läuft nach 7 Tagen ab

function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    const remember = document.getElementById('rememberPassword').checked;
    const stayIn = document.getElementById('stayLoggedIn').checked;
    const usr = database.users.find(x => x.username === u && x.password === p);

    if (usr) {
        if (remember) {
            localStorage.setItem(REMEMBER_KEY, u);
        } else {
            localStorage.removeItem(REMEMBER_KEY);
        }
        currentUser = { username: u, role: usr.role, stayLoggedIn: stayIn };
        loginSuccess();
    } else {
        document.getElementById('loginError').style.display = 'block';
        document.getElementById('loginError').textContent = 'Ungültig';
    }
}

function loginSuccess() {
    if (currentUser.stayLoggedIn) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
            username: currentUser.username,
            role: currentUser.role,
            expires: Date.now() + SESSION_TTL_MS
        }));
    }
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('currentUser').textContent = currentUser.username;
    document.getElementById('userRole').textContent = `(${currentUser.role})`;
    filterDashboardCards();
    updateCounts();

    if (firebaseEnabled) {
        // Lade aktuelle Daten und validiere den angemeldeten Nutzer
        loadFromFirestore().then(() => {
            const freshUser = database.users.find(x => x.username === currentUser.username);
            if (!freshUser) {
                // Nutzer existiert nicht mehr – automatisch abmelden
                showToast('⚠️ Konto nicht gefunden', 'Bitte erneut anmelden', 'error');
                handleLogout();
                return;
            }
            // Rolle aus aktuellen Firestore-Daten übernehmen (könnte sich geändert haben)
            currentUser.role = freshUser.role;
            // Sitzung mit aktualisierten Daten und erneuerter TTL speichern
            if (currentUser.stayLoggedIn) {
                localStorage.setItem(SESSION_KEY, JSON.stringify({
                    username: currentUser.username,
                    role: currentUser.role,
                    expires: Date.now() + SESSION_TTL_MS
                }));
            }
            document.getElementById('userRole').textContent = `(${currentUser.role})`;
            filterDashboardCards();
            updateCounts();
            cleanupOldApplications();
        }).catch(e => console.warn('Firestore load on login failed:', e));
        startAutoSync();
    }
}

function handleLogout() {
    localStorage.removeItem(SESSION_KEY);
    currentUser = null;
    stopAutoSync();
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    // Behalte gespeicherten Benutzernamen falls "Benutzernamen merken" aktiv war
    const savedUsername = localStorage.getItem(REMEMBER_KEY);
    document.getElementById('username').value = savedUsername || '';
    document.getElementById('password').value = '';
    if (savedUsername) {
        document.getElementById('rememberPassword').checked = true;
    }
}

function tryAutoLogin() {
    // Gespeicherte Sitzung wiederherstellen
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
        try {
            const session = JSON.parse(raw);
            if (session && session.username && session.role && session.expires && Date.now() < session.expires) {
                // Sitzungsdaten vertrauen – Firestore-Daten werden erst nach dem Login geladen.
                // Die Validierung des Nutzers erfolgt in loginSuccess() nach dem Laden.
                currentUser = { username: session.username, role: session.role, stayLoggedIn: true };
                loginSuccess();
                return true;
            }
        } catch (_) { /* ungültige Sitzungsdaten */ }
        // Sitzung abgelaufen oder ungültig - entfernen
        localStorage.removeItem(SESSION_KEY);
    }
    // Gespeicherten Benutzernamen vorausfüllen
    const savedUsername = localStorage.getItem(REMEMBER_KEY);
    if (savedUsername) {
        document.getElementById('username').value = savedUsername;
        document.getElementById('rememberPassword').checked = true;
    }
    return false;
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
    if (t === 'addRank') populateRankDepartmentDropdown();
    if (t === 'addEvidence') populateEvidenceModal();
    if (t === 'addTraining') populateTrainingRankDropdown();
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
        trainingDetail: 'trainingDetailModal',
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
    // Ränge nach Priorität sortiert
    const sortedRanks = [...database.jobRanks].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    sortedRanks.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.name;
        opt.textContent = r.abbreviation ? `${r.abbreviation} – ${r.name}` : r.name;
        s.appendChild(opt);
    });
    const r = document.getElementById('newRole');
    r.innerHTML = '';
    getAvailableRoles().forEach(role => {
        const opt = document.createElement('option');
        opt.value = role.name;
        opt.textContent = role.name;
        opt.style.color = role.color || '';
        r.appendChild(opt);
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
        const roleObj = findRoleByName(u.role);
        const roleColor = roleObj ? roleObj.color : 'var(--info)';
        const roleIcon = roleObj ? `<i class="${roleObj.icon}" style="margin-right:4px"></i>` : '';
        const rankObj = database.jobRanks.find(r => r.name === u.jobRank);
        const rankDisplay = rankObj
            ? `<span style="color:${rankObj.color};font-weight:600">${rankObj.abbreviation ? rankObj.abbreviation + ' – ' : ''}${u.jobRank}</span>`
            : u.jobRank;
        return `<tr><td>${escapeHtml(u.username)}</td><td><span class="badge" style="background:${roleColor}22;color:${roleColor};border:1px solid ${roleColor}44">${roleIcon}${escapeHtml(u.role)}</span></td><td>${rankDisplay}</td><td><span class="badge badge-success">${u.status}</span></td><td><button class="btn btn-small btn-primary" onclick="openUserPermissionsModal(${u.id})" title="Individuelle Berechtigungen">🔑${extraBadge}</button><button class="btn btn-small" onclick="deleteUser(${u.id})">×</button></td></tr>`;
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
        icon: document.getElementById('rankIcon').value || 'fas fa-award',
        priority: parseInt(document.getElementById('rankPriority').value) || 0,
        department: document.getElementById('rankDepartment').value || '',
        abbreviation: document.getElementById('rankAbbreviation').value || '',
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
    const sorted = [...database.jobRanks].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    b.innerHTML = sorted.map(r => {
        const deptBadge = r.department ? `<span class="badge badge-info" style="font-size:0.7em">${escapeHtml(r.department)}</span>` : '<span style="color:var(--text-secondary);font-size:0.8em">–</span>';
        const iconHtml = r.icon ? `<i class="${r.icon}" style="color:${r.color};margin-right:4px"></i>` : '';
        return `<tr>
            <td>${iconHtml}<strong style="color:${r.color}">${escapeHtml(r.name)}</strong>${r.abbreviation ? ` <span style="color:var(--text-secondary);font-size:0.8em">(${escapeHtml(r.abbreviation)})</span>` : ''}</td>
            <td><div style="width:20px;height:20px;background:${r.color};border-radius:4px;border:1px solid rgba(255,255,255,0.2)"></div></td>
            <td>${deptBadge}</td>
            <td style="text-align:center"><span style="color:var(--info);font-weight:700">${r.priority || 0}</span></td>
            <td style="font-size:0.85em;color:var(--text-secondary)">${escapeHtml(r.description || '')}</td>
            <td style="white-space:nowrap">
                <button class="btn btn-small btn-primary" onclick="editRank(${r.id})" title="Bearbeiten">✎</button>
                <button class="btn btn-small" onclick="deleteRank(${r.id})" style="background:rgba(255,51,51,0.2);color:var(--danger);border:1px solid rgba(255,51,51,0.3)">×</button>
            </td>
        </tr>`;
    }).join('');
}

function editRank(id) {
    const r = database.jobRanks.find(x => x.id === id);
    if (!r) return;
    document.getElementById('rankName').value = r.name;
    document.getElementById('rankColor').value = r.color || '#0066cc';
    document.getElementById('rankIcon').value = r.icon || 'fas fa-award';
    document.getElementById('rankPriority').value = r.priority || 0;
    document.getElementById('rankDepartment').value = r.department || '';
    document.getElementById('rankAbbreviation').value = r.abbreviation || '';
    document.getElementById('rankDesc').value = r.description || '';

    const form = document.getElementById('addRankModal').querySelector('form');
    form.onsubmit = (e) => {
        e.preventDefault();
        r.name = document.getElementById('rankName').value;
        r.color = document.getElementById('rankColor').value;
        r.icon = document.getElementById('rankIcon').value || 'fas fa-award';
        r.priority = parseInt(document.getElementById('rankPriority').value) || 0;
        r.department = document.getElementById('rankDepartment').value || '';
        r.abbreviation = document.getElementById('rankAbbreviation').value || '';
        r.description = document.getElementById('rankDesc').value;
        saveDatabase();
        closeModal('addRank');
        form.reset();
        form.onsubmit = null;
        showToast('✅ Rang aktualisiert', r.name, 'success');
        renderRanksView();
    };
    const el = document.getElementById('addRankModal');
    if (el) el.classList.add('show');
}

function deleteRank(id) {
    if (confirm('Rang wirklich löschen?')) {
        database.jobRanks = database.jobRanks.filter(r => r.id !== id);
        saveDatabase();
        renderRanksView();
        updateCounts();
    }
}

// Rang-Modal Abteilungs-Dropdown befüllen
function populateRankDepartmentDropdown() {
    const sel = document.getElementById('rankDepartment');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">– Keine Abteilung –</option>';
    getAvailableDepartments().forEach(d => {
        sel.innerHTML += `<option value="${escapeHtml(d.name)}">${escapeHtml(d.name)}</option>`;
    });
    sel.value = current;
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

const VERGEHEN_TAG_STYLES = {
    active:   { background: 'rgba(0,102,204,0.55)', borderColor: 'var(--secondary)', color: '#fff', fontWeight: '600' },
    inactive: { background: 'rgba(0,102,204,0.08)', borderColor: 'rgba(0,102,204,0.35)', color: 'var(--text-primary)', fontWeight: '' }
};

function _applyVergehenTagStyle(el, active) {
    const s = active ? VERGEHEN_TAG_STYLES.active : VERGEHEN_TAG_STYLES.inactive;
    el.style.background = s.background;
    el.style.borderColor = s.borderColor;
    el.style.color = s.color;
    el.style.fontWeight = s.fontWeight;
}

function renderVergehenTags(containerId, selected = []) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = VERGEHEN_LIST.map(v => {
        const isSelected = selected.includes(v);
        const s = isSelected ? VERGEHEN_TAG_STYLES.active : VERGEHEN_TAG_STYLES.inactive;
        const inlineStyle = `display:inline-block;padding:4px 11px;border-radius:12px;font-size:0.82em;cursor:pointer;border:1px solid;user-select:none;transition:all 0.15s;margin:2px;background:${s.background};border-color:${s.borderColor};color:${s.color};font-weight:${s.fontWeight}`;
        return `<span class="vergehen-tag${isSelected ? ' selected' : ''}" role="checkbox" aria-checked="${isSelected}" tabindex="0" onclick="toggleVergehenTag(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleVergehenTag(this)}" style="${inlineStyle}">${escapeHtml(v)}</span>`;
    }).join('');
}

function toggleVergehenTag(el) {
    el.classList.toggle('selected');
    const active = el.classList.contains('selected');
    el.setAttribute('aria-checked', active);
    _applyVergehenTagStyle(el, active);
    const kiModal = document.getElementById('kiImproveModal');
    if (kiModal && kiModal.classList.contains('show')) {
        updateKiPreview();
    }
}

function getSelectedVergehen(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    return Array.from(container.querySelectorAll('.vergehen-tag.selected')).map(el => el.textContent);
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
    renderVergehenTags('evVergehen');
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
    renderVergehenTags('chargeVergehen');
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
    const modal = document.getElementById('kiImproveModal');
    if (!modal) return;
    modal.dataset.fieldId = fieldId;
    renderVergehenTags('kiImproveVergehen');
    updateKiPreview();
    modal.classList.add('show');
}

function updateKiPreview() {
    const modal = document.getElementById('kiImproveModal');
    if (!modal) return;
    const fieldId = modal.dataset.fieldId;
    const field = document.getElementById(fieldId);
    if (!field) return;
    const selectedVergehen = getSelectedVergehen('kiImproveVergehen');
    const preview = document.getElementById('kiImprovePreview');
    if (preview) preview.textContent = formatLegalText(field.value.trim(), selectedVergehen);
}

function applyKiImprovement() {
    const modal = document.getElementById('kiImproveModal');
    if (!modal) return;
    const fieldId = modal.dataset.fieldId;
    const field = document.getElementById(fieldId);
    if (!field) return;
    const selectedVergehen = getSelectedVergehen('kiImproveVergehen');
    field.value = formatLegalText(field.value.trim(), selectedVergehen);
    modal.classList.remove('show');
    showToast('🤖 KI', 'Text wurde rechtssicherer formuliert.', 'success');
}

function formatLegalText(text, vergehen = []) {
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

    if (vergehen.length > 0) {
        const vergehenText = vergehen.join(', ');
        t += ` Dem Beschuldigten werden folgende Vergehen zur Last gelegt: ${vergehenText}.`;
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
    const safeReport = escapeHtml(c.report);
    modal.innerHTML = `
        <div class="modal-content" style="max-width:700px;max-height:90vh;overflow-y:auto">
            <div class="modal-header"><h2>📋 Anzeige ${escapeHtml(c.chargeNumber)}</h2><button class="modal-close" onclick="this.closest('.modal').remove()">×</button></div>
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
        creator: currentUser ? currentUser.username : 'Unbekannt',
        minRank: document.getElementById('trainMinRank').value,
        date: document.getElementById('trainDate').value || '',
        time: document.getElementById('trainTime').value || '',
        googleDocsUrl: document.getElementById('trainGoogleDocs').value || '',
        enrollments: [],
        created: new Date().toISOString()
    };
    database.training.push(t);
    saveDatabase();
    closeModal('addTraining');
    document.getElementById('addTrainingModal').querySelector('form').reset();
    showToast('✅ Schulung erstellt', t.title, 'success');
    updateCounts();
}

function populateTrainingRankDropdown() {
    const s = document.getElementById('trainMinRank');
    if (!s) return;
    s.innerHTML = '';
    const sortedRanks = [...database.jobRanks].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    sortedRanks.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.name;
        opt.textContent = r.abbreviation ? `${r.abbreviation} – ${r.name}` : r.name;
        s.appendChild(opt);
    });
}

function formatTrainingDate(date, time) {
    if (!date) return '—';
    return new Date(date + (time ? 'T' + time : '')).toLocaleDateString('de-DE', time ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function checkUserMeetsRank(minRankName, username) {
    const minRankObj = database.jobRanks.find(r => r.name === minRankName);
    const user = username ? database.users.find(u => u.username === username) : currentUser;
    const userRankObj = user ? database.jobRanks.find(r => r.name === user.jobRank) : null;
    return !minRankObj || (userRankObj && (userRankObj.priority || 0) >= (minRankObj.priority || 0));
}

function renderTrainingView() {
    const b = document.getElementById('trainingViewTableBody');
    const isAdmin = canAccess('admin');
    const canManage = canAccess('training');

    if (database.training.length === 0) {
        b.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary);padding:20px">Keine Schulungen vorhanden</td></tr>';
        return;
    }

    b.innerHTML = database.training.map(t => {
        const enrollCount = (t.enrollments || []).length;
        const dateStr = formatTrainingDate(t.date, t.time);
        const isCreator = currentUser && t.creator === currentUser.username;
        const canDelete = isAdmin || (canManage && isCreator);
        const detailBtn = `<button class="btn btn-small btn-primary" onclick="viewTraining(${t.id})" title="Details"><i class="fas fa-eye"></i></button>`;
        const delBtn = canDelete ? ` <button class="btn btn-small" onclick="deleteTraining(${t.id})" style="background:rgba(255,51,51,0.2);color:var(--danger);border:1px solid rgba(255,51,51,0.3)">×</button>` : '';
        return `<tr>
            <td><strong>${escapeHtml(t.title)}</strong></td>
            <td>${escapeHtml(t.creator || t.instructor || '—')}</td>
            <td><span class="badge badge-info">${escapeHtml(t.minRank || '—')}</span></td>
            <td style="font-size:0.85em">${dateStr}</td>
            <td><span class="badge badge-success">${enrollCount}</span></td>
            <td style="white-space:nowrap">${detailBtn}${delBtn}</td>
        </tr>`;
    }).join('');
}

function deleteTraining(id) {
    if (confirm('Schulung wirklich löschen?')) {
        const t = database.training.find(x => x.id === id);
        if (t && !canAccess('admin') && !(canAccess('training') && currentUser && t.creator === currentUser.username)) {
            showToast('🚫 Keine Berechtigung', 'Nur der Ersteller oder Admin kann diese Schulung löschen', 'error');
            return;
        }
        database.training = database.training.filter(t => t.id !== id);
        saveDatabase();
        renderTrainingView();
        updateCounts();
        showToast('✅ Gelöscht', 'Schulung wurde gelöscht', 'success');
    }
}

function getGoogleDocsEmbedUrl(url) {
    if (!url) return '';
    let embedUrl = url.trim();
    // Strict origin check: must start with https://docs.google.com/
    if (!/^https:\/\/docs\.google\.com\//.test(embedUrl)) return '';
    embedUrl = embedUrl.replace(/\/(edit|view|preview)(#.*)?(\?.*)?$/, '/preview');
    if (!embedUrl.endsWith('/preview')) {
        embedUrl = embedUrl.replace(/\/?(\?.*)?$/, '/preview');
    }
    return embedUrl;
}

function viewTraining(id) {
    const t = database.training.find(x => x.id === id);
    if (!t) return;

    const enrollments = t.enrollments || [];
    const isEnrolled = currentUser && enrollments.includes(currentUser.username);
    const dateStr = t.date ? formatTrainingDate(t.date, t.time) : 'Kein Datum festgelegt';
    const timeStr = t.time || '';

    const meetsRank = checkUserMeetsRank(t.minRank, currentUser ? currentUser.username : null);

    const content = document.getElementById('trainingDetailContent');
    let html = `
        <div style="display:grid;gap:12px">
            <div style="display:flex;align-items:center;gap:12px;padding:14px;background:rgba(0,102,204,0.1);border-radius:8px;border:1px solid rgba(0,102,204,0.2)">
                <i class="fas fa-book" style="font-size:2em;color:var(--primary-bright)"></i>
                <div style="flex:1">
                    <div style="font-size:1.2em;font-weight:700;color:var(--secondary)">${escapeHtml(t.title)}</div>
                    <div style="font-size:0.85em;color:var(--text-secondary);margin-top:2px">Erstellt von <strong>${escapeHtml(t.creator || t.instructor || '—')}</strong></div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div style="background:rgba(0,102,204,0.07);padding:10px;border-radius:6px">
                    <div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:4px"><i class="fas fa-award"></i> Mindest-Rang</div>
                    <div style="font-weight:600"><span class="badge badge-info">${escapeHtml(t.minRank || 'Kein')}</span></div>
                </div>
                <div style="background:rgba(0,102,204,0.07);padding:10px;border-radius:6px">
                    <div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:4px"><i class="fas fa-calendar-alt"></i> Datum & Uhrzeit</div>
                    <div style="font-weight:600">${dateStr}${timeStr ? ' um ' + escapeHtml(timeStr) + ' Uhr' : ''}</div>
                </div>
                <div style="background:rgba(0,102,204,0.07);padding:10px;border-radius:6px;grid-column:1/-1">
                    <div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:4px"><i class="fas fa-users"></i> Teilnehmer (${enrollments.length})</div>
                    <div style="font-weight:600">${enrollments.length > 0 ? enrollments.map(u => '<span class="badge badge-success" style="margin:2px">' + escapeHtml(u) + '</span>').join(' ') : '<span style="color:var(--text-secondary)">Noch keine Teilnehmer</span>'}</div>
                </div>
            </div>`;

    if (currentUser) {
        if (isEnrolled) {
            html += `<button class="btn btn-small" onclick="unenrollTraining(${t.id})" style="background:rgba(255,51,51,0.2);color:var(--danger);border:1px solid rgba(255,51,51,0.3);padding:10px;font-size:0.9em"><i class="fas fa-user-minus"></i> Abmelden</button>`;
        } else if (meetsRank) {
            html += `<button class="btn btn-success" onclick="enrollTraining(${t.id})" style="padding:10px;font-size:0.9em"><i class="fas fa-user-plus"></i> Einschreiben</button>`;
        } else {
            html += `<div style="background:rgba(255,170,0,0.15);border:1px solid rgba(255,170,0,0.3);padding:10px;border-radius:6px;color:var(--warning);font-size:0.9em"><i class="fas fa-exclamation-triangle"></i> Dein Rang reicht nicht aus, um dich einzuschreiben. Mindestrang: <strong>${escapeHtml(t.minRank || '—')}</strong></div>`;
        }
    }

    if (t.googleDocsUrl) {
        const embedUrl = getGoogleDocsEmbedUrl(t.googleDocsUrl);
        html += `
            <div style="margin-top:8px;border-top:1px solid rgba(0,102,204,0.2);padding-top:12px">
                <div style="font-size:1em;font-weight:700;color:var(--secondary);margin-bottom:10px"><i class="fas fa-file-alt"></i> Schulungsmaterial</div>
                <div style="background:rgba(0,102,204,0.05);border:1px solid rgba(0,102,204,0.2);border-radius:8px;overflow:hidden">
                    <iframe src="${escapeHtml(embedUrl)}" style="width:100%;height:500px;border:none" sandbox="allow-scripts allow-popups allow-forms" allowfullscreen></iframe>
                </div>
                <a href="${escapeHtml(t.googleDocsUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;color:var(--info);font-size:0.85em;text-decoration:none"><i class="fas fa-external-link-alt"></i> Dokument in neuem Tab öffnen</a>
            </div>`;
    }

    html += '</div>';
    content.innerHTML = html;
    document.getElementById('trainingDetailModal').classList.add('show');
}

function enrollTraining(id) {
    if (!currentUser) return;
    const t = database.training.find(x => x.id === id);
    if (!t) return;
    if (!t.enrollments) t.enrollments = [];
    if (t.enrollments.includes(currentUser.username)) {
        showToast('ℹ️ Bereits eingeschrieben', 'Du bist bereits für diese Schulung eingeschrieben', 'info');
        return;
    }
    if (!checkUserMeetsRank(t.minRank, currentUser.username)) {
        showToast('🚫 Rang nicht ausreichend', 'Dein Rang reicht für diese Schulung nicht aus', 'error');
        return;
    }
    t.enrollments.push(currentUser.username);
    saveDatabase();
    viewTraining(id);
    renderTrainingView();
    updateCounts();
    showToast('✅ Eingeschrieben', 'Du bist jetzt für "' + t.title + '" eingeschrieben', 'success');
}

function unenrollTraining(id) {
    if (!currentUser) return;
    const t = database.training.find(x => x.id === id);
    if (!t || !t.enrollments) return;
    t.enrollments = t.enrollments.filter(u => u !== currentUser.username);
    saveDatabase();
    viewTraining(id);
    renderTrainingView();
    updateCounts();
    showToast('✅ Abgemeldet', 'Du bist von "' + t.title + '" abgemeldet', 'success');
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
        status: (document.getElementById('citStatus') || {}).value || 'Offen',
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
    const isAdmin = canAccess('admin') || canAccess('citations');
    const statusColors = { 'Offen': 'badge-danger', 'In Bearbeitung': 'badge-warning', 'Abgeschlossen': 'badge-success', 'Archiviert': 'badge-info' };
    b.innerHTML = database.citations.map(c => {
        const withinWindow = Date.now() < c.editUntil;
        const canEdit = isAdmin || withinWindow;
        const timeLeft = Math.max(0, Math.ceil((c.editUntil - Date.now()) / 60000));
        const linkedEvCount = database.evidence.filter(e => e.citationAZ === c.aktenzeichen).length;
        const linkedChCount = database.charges.filter(ch => ch.aktenzeichen === c.aktenzeichen).length;
        const statusBadge = `<span class="badge ${statusColors[c.status] || 'badge-danger'}">${escapeHtml(c.status || 'Offen')}</span>`;
        const linksInfo = (linkedEvCount + linkedChCount > 0)
            ? `<span title="${linkedEvCount} Beweise, ${linkedChCount} Anzeigen" style="font-size:0.75em;color:var(--text-secondary);margin-right:4px">🔗${linkedEvCount + linkedChCount}</span>`
            : '';
        return `<tr>
            <td style="font-family:monospace;font-size:0.85em">${escapeHtml(c.aktenzeichen)}</td>
            <td><strong>${escapeHtml(c.name)}</strong></td>
            <td><span class="badge badge-info">${escapeHtml(c.type)}</span></td>
            <td>${statusBadge}</td>
            <td>${escapeHtml(c.officer)}</td>
            <td style="font-size:0.85em">${new Date(c.date).toLocaleDateString('de-DE')}</td>
            <td style="white-space:nowrap">${linksInfo}<button class="btn btn-small btn-primary" onclick="viewCitationDetail(${c.id})" title="Akte anzeigen"><i class="fas fa-eye"></i></button> ${canEdit ? `<button class="btn btn-small" onclick="editCitation(${c.id})" title="${withinWindow ? `Noch ${timeLeft} Min` : 'Admin-Bearbeitung'}">✎</button>` : '<span style="color:var(--text-secondary);font-size:0.8em">Gesperrt</span>'}<button class="btn btn-small" ${canEdit ? `onclick="deleteCitation(${c.id})"` : 'disabled'} style="background:rgba(255,51,51,0.1);color:var(--danger)">×</button></td>
        </tr>`;
    }).join('');
}

function deleteCitation(id) {
    if (confirm('Strafakte löschen?')) {
        const c = database.citations.find(x => x.id === id);
        if (c && !canAccess('admin') && !canAccess('citations') && Date.now() >= c.editUntil) {
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
    const isPrivileged = canAccess('admin') || canAccess('citations');
    if (!c || (!isPrivileged && Date.now() >= c.editUntil)) {
        showToast('🔒 Zu spät', 'Diese Strafakte kann nicht mehr bearbeitet werden', 'error');
        return;
    }
    document.getElementById('citName').value = c.name;
    document.getElementById('citType').value = c.type;
    document.getElementById('citDesc').value = c.description;
    document.getElementById('citOfficer').value = c.officer;
    const citStatus = document.getElementById('citStatus');
    if (citStatus) citStatus.value = c.status || 'Offen';
    
    document.getElementById('addCitationModal').querySelector('form').onsubmit = ((e) => {
        e.preventDefault();
        c.name = document.getElementById('citName').value;
        c.type = document.getElementById('citType').value;
        c.description = document.getElementById('citDesc').value;
        c.officer = document.getElementById('citOfficer').value;
        if (citStatus) c.status = citStatus.value;
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
        source: 'police',
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
        const canEdit = isAdmin || withinWindow;
        const reportBtn = c.report ? `<button class="btn btn-small" onclick="showChargeReport(database.charges.find(x=>x.id===${c.id}))" title="Bericht">📋</button>` : '';
        const detailBtn = `<button class="btn btn-small btn-primary" onclick="viewCharge(${c.id})" title="Details"><i class="fas fa-eye"></i></button>`;
        const editBtn = canEdit ? `<button class="btn btn-small" onclick="editCharge(${c.id})" title="${withinWindow ? `Noch ${timeLeft} Min` : 'Admin-Bearbeitung'}">✎</button>` : '';
        const delBtn = canDel ? `<button class="btn btn-small" onclick="deleteCharge(${c.id})" style="background:rgba(255,51,51,0.2);color:var(--danger);border:1px solid rgba(255,51,51,0.3)">×</button>` : '<span style="color:var(--text-secondary);font-size:0.8em">Gesperrt</span>';
        const sourceLabel = c.source === 'citizen' ? '<span class="badge badge-warning">Bürger</span>' : '<span class="badge badge-info">Polizei</span>';
        const chargeStatusColors = { 'Aktiv': 'badge-danger', 'In Bearbeitung': 'badge-warning', 'Eingestellt': 'badge-info', 'Verurteilt': 'badge-success', 'Freigesprochen': 'badge-success' };
        return `<tr>
            <td style="font-family:monospace;font-size:0.85em">${escapeHtml(c.chargeNumber)}</td>
            <td><strong>${escapeHtml(c.name)}</strong></td>
            <td><span class="badge badge-danger">${escapeHtml(c.type)}</span></td>
            <td>${sourceLabel}</td>
            <td><span class="badge ${chargeStatusColors[c.status] || 'badge-info'}">${escapeHtml(c.status || 'Aktiv')}</span></td>
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
    const isPrivileged = canAccess('admin') || canAccess('charges');
    if (!c || (!isPrivileged && Date.now() >= c.editUntil)) {
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
        renderVergehenTags('chargeVergehen', c.vergehen);
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
        return `<div style="background:rgba(0,102,204,0.1);border:1px solid rgba(0,102,204,0.2);border-radius:8px;overflow:hidden"><div style="display:grid;grid-template-columns:200px 1fr;gap:15px;padding:20px">${p.image ? `<img src="${escapeHtml(p.image)}" style="width:100%;height:180px;object-fit:cover;border-radius:6px;border:1px solid rgba(0,102,204,0.3)">` : ''}<div><h3 style="color:var(--secondary);margin-bottom:6px;font-size:1.2em">${escapeHtml(p.title)}</h3><p style="color:rgba(255,255,255,0.7);margin-bottom:10px;font-size:0.9em">${escapeHtml(p.subtitle)}</p><p style="color:var(--text-secondary);line-height:1.6;margin-bottom:12px">${escapeHtml(p.content.substring(0, 200))}...</p><div style="display:flex;gap:8px;align-items:center;font-size:0.85em;color:rgba(255,255,255,0.6);margin-bottom:12px"><i class="fas fa-user-circle"></i> <span>${escapeHtml(p.author)}</span> <i class="fas fa-calendar" style="margin-left:12px"></i> <span>${new Date(p.date).toLocaleDateString('de-DE')}</span></div><div style="display:flex;gap:8px">${editBtn}${delBtn}</div></div></div></div>`;
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
    const linkedCitation = c.aktenzeichen ? database.citations.find(x => x.aktenzeichen === c.aktenzeichen) : null;
    const linkedEvidence = c.linkedEvidenceIds && c.linkedEvidenceIds.length
        ? database.evidence.filter(ev => c.linkedEvidenceIds.includes(ev.id))
        : (c.aktenzeichen ? database.evidence.filter(ev => ev.citationAZ === c.aktenzeichen) : []);
    const CHARGE_STATUSES = ['Aktiv', 'In Bearbeitung', 'Eingestellt', 'Verurteilt', 'Freigesprochen'];
    const statusOpts = CHARGE_STATUSES.map(s => `<option value="${s}" ${c.status === s ? 'selected' : ''}>${s}</option>`).join('');
    const citationHtml = linkedCitation
        ? `<a style="color:var(--info);cursor:pointer;text-decoration:underline" onclick="document.getElementById('chargeDetailModal').classList.remove('show');viewCitationDetail(${linkedCitation.id})">${escapeHtml(linkedCitation.aktenzeichen)} – ${escapeHtml(linkedCitation.name)}</a>`
        : (c.aktenzeichen ? `<span style="color:var(--text-secondary)">${escapeHtml(c.aktenzeichen)}</span>` : '<span style="color:var(--text-secondary)">–</span>');
    const evidenceHtml = linkedEvidence.length
        ? linkedEvidence.map(ev => `<div style="padding:4px 6px;background:rgba(0,102,204,0.07);border-radius:4px;margin-bottom:3px;font-size:0.85em">${EVIDENCE_TYPE_ICON[ev.type] || '📦'} <strong>${escapeHtml(ev.name || ev.description)}</strong> – ${escapeHtml(ev.location)}</div>`).join('')
        : '<span style="color:var(--text-secondary);font-size:0.85em">Keine Beweismittel verknüpft</span>';
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
                    <div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:4px">Status ändern</div>
                    <select onchange="changeChargeStatus(${c.id}, this.value)" style="background:rgba(0,102,204,0.15);border:1px solid rgba(0,102,204,0.3);color:var(--text-primary);padding:4px 8px;border-radius:4px;font-size:0.85em;width:100%">${statusOpts}</select>
                </div>
            </div>
            ${c.aktenzeichen ? `<div style="background:rgba(0,102,204,0.07);padding:10px;border-radius:6px">
                <div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:4px">Verknüpfte Strafakte</div>
                <div>${citationHtml}</div>
            </div>` : ''}
            <div style="background:rgba(0,102,204,0.07);padding:10px;border-radius:6px">
                <div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:6px">Beweismittel</div>
                ${evidenceHtml}
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

// ========== STATUS MANAGEMENT ==========
function changeChargeStatus(id, newStatus) {
    const c = database.charges.find(x => x.id === id);
    if (!c) return;
    c.status = newStatus;
    saveDatabase();
    renderChargesView();
    showToast('✅ Status geändert', `${c.chargeNumber}: ${newStatus}`, 'success');
}

function changeCitationStatus(id, newStatus) {
    const c = database.citations.find(x => x.id === id);
    if (!c) return;
    c.status = newStatus;
    saveDatabase();
    renderCitationsView();
    showToast('✅ Status geändert', `${c.aktenzeichen}: ${newStatus}`, 'success');
}

// ========== STRAFAKTEN DETAIL (Akte anzeigen) ==========
function viewCitationDetail(id) {
    const c = database.citations.find(x => x.id === id);
    if (!c) return;
    const linkedEv = database.evidence.filter(e => e.citationAZ === c.aktenzeichen);
    const linkedCh = database.charges.filter(ch => ch.aktenzeichen === c.aktenzeichen);
    const statusColors = { 'Offen': 'badge-danger', 'In Bearbeitung': 'badge-warning', 'Abgeschlossen': 'badge-success', 'Archiviert': 'badge-info' };
    const CITATION_STATUSES = ['Offen', 'In Bearbeitung', 'Abgeschlossen', 'Archiviert'];
    const statusOpts = CITATION_STATUSES.map(s => `<option value="${s}" ${(c.status || 'Offen') === s ? 'selected' : ''}>${s}</option>`).join('');
    const evHtml = linkedEv.length
        ? linkedEv.map(ev => `<div style="padding:6px 8px;background:rgba(0,102,204,0.07);border-radius:4px;margin-bottom:4px;font-size:0.85em">${EVIDENCE_TYPE_ICON[ev.type] || '📦'} <strong>${escapeHtml(ev.name || ev.description)}</strong> <span class="badge badge-info">${escapeHtml(ev.aktenzeichen)}</span> – ${escapeHtml(ev.location)}</div>`).join('')
        : '<div style="color:var(--text-secondary);font-size:0.85em;padding:4px 0">Keine Beweismittel erfasst</div>';
    const chHtml = linkedCh.length
        ? linkedCh.map(ch => `<div style="padding:6px 8px;background:rgba(255,51,51,0.07);border-radius:4px;margin-bottom:4px;font-size:0.85em;cursor:pointer" onclick="document.getElementById('citationDetailModal').classList.remove('show');viewCharge(${ch.id})"><span class="badge badge-danger">${escapeHtml(ch.type)}</span> <strong>${escapeHtml(ch.chargeNumber)}</strong> – ${escapeHtml(ch.name)} <span class="badge ${ch.status === 'Aktiv' ? 'badge-danger' : 'badge-success'}">${escapeHtml(ch.status || 'Aktiv')}</span></div>`).join('')
        : '<div style="color:var(--text-secondary);font-size:0.85em;padding:4px 0">Keine Anzeigen vorhanden</div>';
    document.getElementById('citationDetailContent').innerHTML = `
        <div style="display:grid;gap:12px">
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:rgba(0,102,204,0.1);padding:12px;border-radius:8px;border:1px solid rgba(0,102,204,0.2)">
                <span style="font-family:monospace;font-size:1.1em;font-weight:700;color:var(--info)">${escapeHtml(c.aktenzeichen)}</span>
                <span class="badge badge-info">${escapeHtml(c.type)}</span>
                <div style="margin-left:auto;display:flex;align-items:center;gap:6px">
                    <span style="font-size:0.8em;color:var(--text-secondary)">Status:</span>
                    <select onchange="changeCitationStatus(${c.id}, this.value)" style="background:rgba(0,102,204,0.15);border:1px solid rgba(0,102,204,0.3);color:var(--text-primary);padding:4px 8px;border-radius:4px;font-size:0.85em">${statusOpts}</select>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                <div style="background:rgba(0,102,204,0.07);padding:10px;border-radius:6px">
                    <div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:4px">Bürger</div>
                    <div style="font-weight:600">${escapeHtml(c.name)}</div>
                </div>
                <div style="background:rgba(0,102,204,0.07);padding:10px;border-radius:6px">
                    <div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:4px">Beamte(r)</div>
                    <div>${escapeHtml(c.officer)}</div>
                </div>
            </div>
            <div style="background:rgba(0,102,204,0.05);padding:10px;border-radius:6px;border-left:3px solid var(--primary)">
                <div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:4px">Beschreibung</div>
                <div style="font-size:0.9em;line-height:1.6;white-space:pre-wrap">${escapeHtml(c.description)}</div>
            </div>
            <div>
                <div style="color:var(--secondary);font-weight:700;margin-bottom:8px;font-size:0.95em"><i class="fas fa-dna"></i> Beweismittel (${linkedEv.length})</div>
                ${evHtml}
            </div>
            <div>
                <div style="color:var(--secondary);font-weight:700;margin-bottom:8px;font-size:0.95em"><i class="fas fa-exclamation-triangle"></i> Anzeigen (${linkedCh.length})</div>
                ${chHtml}
            </div>
        </div>`;
    document.getElementById('citationDetailModal').classList.add('show');
}

// ========== FALLÜBERSICHT (Unified Case View) ==========
function openFallubersicht() {
    renderFallubersicht();
    document.getElementById('fallubersichtModal').classList.add('show');
}

function renderFallubersicht(filteredCitations, filteredCharges) {
    const container = document.getElementById('fallubersichtContent');
    if (!container) return;
    const citations = filteredCitations !== undefined ? filteredCitations : database.citations;
    const charges = filteredCharges !== undefined ? filteredCharges : database.charges;
    // Alle einzigartigen Bürgernamen aus citations und charges sammeln
    const subjects = new Set();
    citations.forEach(c => { if (c.name) subjects.add(c.name); });
    charges.forEach(c => { if (c.name) subjects.add(c.name); });
    if (subjects.size === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary)"><i class="fas fa-folder-open" style="font-size:2em;margin-bottom:10px"></i><br>Noch keine Akten vorhanden</div>';
        return;
    }
    const statusColors = { 'Offen': 'badge-danger', 'In Bearbeitung': 'badge-warning', 'Abgeschlossen': 'badge-success', 'Archiviert': 'badge-info' };
    const cards = [...subjects].sort().map(name => {
        const cits = citations.filter(c => c.name === name);
        const chgs = charges.filter(c => c.name === name);
        const evs = database.evidence.filter(ev => cits.some(c => c.aktenzeichen === ev.citationAZ));
        const activeCount = chgs.filter(c => c.status === 'Aktiv').length;
        const citsHtml = cits.map(c => {
            const cStatus = c.status || 'Offen';
            return `<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid rgba(0,102,204,0.1);cursor:pointer" onclick="document.getElementById('fallubersichtModal').classList.remove('show');viewCitationDetail(${c.id})">
                <span style="font-family:monospace;font-size:0.8em;color:var(--info);flex-shrink:0">${escapeHtml(c.aktenzeichen)}</span>
                <span class="badge badge-info" style="font-size:0.7em">${escapeHtml(c.type)}</span>
                <span class="badge ${statusColors[cStatus] || 'badge-info'}" style="font-size:0.7em">${escapeHtml(cStatus)}</span>
                <span style="margin-left:auto;font-size:0.75em;color:var(--text-secondary)">${new Date(c.date).toLocaleDateString('de-DE')}</span>
            </div>`;
        }).join('');
        const chgsHtml = chgs.map(c => {
            const chargeStatusColors = { 'Aktiv': 'badge-danger', 'In Bearbeitung': 'badge-warning', 'Eingestellt': 'badge-info', 'Verurteilt': 'badge-success', 'Freigesprochen': 'badge-success' };
            return `<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid rgba(255,51,51,0.1);cursor:pointer" onclick="document.getElementById('fallubersichtModal').classList.remove('show');viewCharge(${c.id})">
                <span style="font-family:monospace;font-size:0.8em;color:var(--danger);flex-shrink:0">${escapeHtml(c.chargeNumber)}</span>
                <span class="badge badge-danger" style="font-size:0.7em">${escapeHtml(c.type)}</span>
                <span class="badge ${chargeStatusColors[c.status] || 'badge-info'}" style="font-size:0.7em">${escapeHtml(c.status || 'Aktiv')}</span>
                <span style="margin-left:auto;font-size:0.75em;color:var(--text-secondary)">${new Date(c.date).toLocaleDateString('de-DE')}</span>
            </div>`;
        }).join('');
        return `<div style="background:rgba(15,25,50,0.6);border:1px solid rgba(0,102,204,0.25);border-radius:8px;padding:14px;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">
                <i class="fas fa-user-shield" style="color:var(--secondary)"></i>
                <strong style="font-size:1em">${escapeHtml(name)}</strong>
                ${activeCount > 0 ? `<span class="badge badge-danger">${activeCount} aktive Anzeige${activeCount !== 1 ? 'n' : ''}</span>` : ''}
                <div style="margin-left:auto;display:flex;gap:8px;font-size:0.8em;color:var(--text-secondary)">
                    <span title="Strafakten"><i class="fas fa-gavel"></i> ${cits.length}</span>
                    <span title="Anzeigen"><i class="fas fa-exclamation-triangle"></i> ${chgs.length}</span>
                    <span title="Beweismittel"><i class="fas fa-dna"></i> ${evs.length}</span>
                </div>
            </div>
            ${cits.length ? `<div style="margin-bottom:8px"><div style="font-size:0.75em;color:var(--secondary);font-weight:700;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">Strafakten</div>${citsHtml}</div>` : ''}
            ${chgs.length ? `<div><div style="font-size:0.75em;color:var(--danger);font-weight:700;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">Anzeigen</div>${chgsHtml}</div>` : ''}
        </div>`;
    }).join('');
    container.innerHTML = cards;
}


function renderAdminStats() {
    const s = document.getElementById('statsPanel');
    if (!s) return;
    const stats = [
        { label: 'Nutzer', value: database.users.length, icon: '👤' },
        { label: 'Ränge', value: database.jobRanks.length, icon: '🏅' },
        { label: 'Rollen', value: getAvailableRoles().length, icon: '🎭' },
        { label: 'Abteilungen', value: getAvailableDepartments().length, icon: '🏢' },
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
    setAdminTab(activeAdminTab);
}

function setAdminTab(tab) {
    activeAdminTab = tab;
    ['roles', 'ranks', 'departments', 'stats'].forEach(t => {
        const btn = document.getElementById('adminTab_' + t);
        const panel = document.getElementById('adminPanel_' + t);
        if (btn) {
            btn.className = t === tab ? 'btn btn-primary btn-small' : 'btn btn-small';
            if (t !== tab) btn.style.cssText = 'background:rgba(0,102,204,0.15);border:1px solid rgba(0,102,204,0.3);color:var(--text-primary)';
            else btn.style.cssText = '';
        }
        if (panel) panel.style.display = t === tab ? 'block' : 'none';
    });
    if (tab === 'roles') renderRoleEditor();
    if (tab === 'ranks') renderAdminRanksEditor();
    if (tab === 'departments') renderDepartmentsEditor();
    if (tab === 'stats') renderAdminStats();
}

// ========== ADMIN: ROLLEN-EDITOR ==========
function renderRoleEditor() {
    const panel = document.getElementById('roleEditorPanel');
    if (!panel) return;
    const allRoles = getAvailableRoles();

    let html = '<div style="margin-bottom:15px"><p style="font-size:0.9em;margin:0;color:rgba(255,255,255,0.7)">Verwalte alle Rollen im System. Jede Rolle hat Farbe, Icon, Priorität und Berechtigungen.</p></div>';

    allRoles.forEach(role => {
        const isDefault = role.isDefault;
        const badgeStyle = `background:${role.color}22;color:${role.color};border:1px solid ${role.color}44`;
        html += `<div style="border:1px solid ${role.color}55;border-radius:8px;padding:12px;margin-bottom:12px;background:rgba(0,0,0,0.15)">`;
        html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="display:flex;align-items:center;gap:8px">
                <i class="${role.icon || 'fas fa-user'}" style="color:${role.color};font-size:1.2em"></i>
                <strong style="color:${role.color};font-size:1.1em">${escapeHtml(role.name)}</strong>
                <span style="font-size:0.75em;color:var(--text-secondary);border:1px solid rgba(255,255,255,0.2);border-radius:4px;padding:1px 6px">Prio: ${role.priority}</span>
                ${isDefault ? '<span style="font-size:0.7em;color:var(--info);border:1px solid var(--info);border-radius:4px;padding:1px 5px">Standard</span>' : '<span style="font-size:0.7em;color:var(--warning);border:1px solid var(--warning);border-radius:4px;padding:1px 5px">Custom</span>'}
            </div>
            <div style="display:flex;gap:4px">
                <button onclick="editRoleModal('${escapeHtml(role.id)}')" class="btn btn-small btn-primary" title="Rolle bearbeiten">✎</button>
                ${!isDefault ? `<button onclick="deleteRole('${escapeHtml(role.id)}')" class="btn btn-small" style="background:rgba(255,51,51,0.2);color:var(--danger);border:1px solid rgba(255,51,51,0.3)" title="Rolle löschen">×</button>` : ''}
            </div>
        </div>`;
        if (role.description) html += `<div style="font-size:0.8em;color:var(--text-secondary);margin-bottom:8px"><i class="fas fa-info-circle"></i> ${escapeHtml(role.description)}</div>`;

        // Berechtigungen als Chips
        html += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
        FEATURES.forEach(feature => {
            const has = (role.permissions || []).includes(feature);
            const chipStyle = has
                ? `background:${role.color}22;color:${role.color};border:1px solid ${role.color}44;opacity:1`
                : 'background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.25);border:1px solid rgba(255,255,255,0.08);opacity:0.5';
            html += `<label style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:12px;${chipStyle};cursor:pointer;font-size:0.8em;transition:all 0.2s">
                <input type="checkbox" ${has ? 'checked' : ''} onchange="toggleRolePermission('${escapeHtml(role.id)}','${feature}')" style="display:none">
                ${has ? '✓' : '○'} ${feature}
            </label>`;
        });
        html += '</div></div>';
    });

    // Neue Rolle erstellen
    html += `<div style="border:2px dashed rgba(0,255,136,0.3);border-radius:8px;padding:14px;margin-top:15px">
        <h4 style="color:var(--secondary);margin-bottom:10px">➕ Neue Rolle erstellen</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <input type="text" id="newRoleName" placeholder="Rollenname..." style="padding:8px;background:rgba(0,102,204,0.1);border:1px solid rgba(0,102,204,0.3);border-radius:4px;color:var(--text-primary);font-size:0.9em">
            <input type="color" id="newRoleColor" value="#888888" style="height:36px;border:1px solid rgba(0,102,204,0.3);border-radius:4px;background:transparent;cursor:pointer">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <input type="text" id="newRoleIcon" placeholder="Icon (z.B. fas fa-user-tag)" value="fas fa-user-tag" style="padding:8px;background:rgba(0,102,204,0.1);border:1px solid rgba(0,102,204,0.3);border-radius:4px;color:var(--text-primary);font-size:0.9em">
            <input type="number" id="newRolePriority" placeholder="Priorität (0-100)" value="20" min="0" max="100" style="padding:8px;background:rgba(0,102,204,0.1);border:1px solid rgba(0,102,204,0.3);border-radius:4px;color:var(--text-primary);font-size:0.9em">
        </div>
        <input type="text" id="newRoleDescription" placeholder="Beschreibung..." style="width:100%;padding:8px;background:rgba(0,102,204,0.1);border:1px solid rgba(0,102,204,0.3);border-radius:4px;color:var(--text-primary);font-size:0.9em;margin-bottom:8px">
        <button onclick="createNewRole()" style="padding:8px 18px;background:linear-gradient(90deg,var(--primary),var(--primary-bright));color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;font-size:0.9em">Erstellen</button>
        <p style="font-size:0.8em;color:rgba(255,255,255,0.5);margin-top:6px">Berechtigungen können nach der Erstellung direkt per Klick vergeben werden.</p>
    </div>`;

    // Reset-Button
    html += '<div style="border-top:1px solid rgba(0,255,136,0.2);padding-top:12px;margin-top:15px"><button onclick="resetRolesToDefault()" style="padding:8px 15px;background:rgba(255,107,107,0.2);border:1px solid #ff6b6b;color:#ff6b6b;border-radius:5px;cursor:pointer;font-size:0.9em;transition:all 0.3s">🔄 Rollen auf Standard zurücksetzen</button></div>';

    panel.innerHTML = html;
}

function toggleRolePermission(roleId, feature) {
    const role = (database.roles || []).find(r => r.id === roleId);
    if (!role) return;
    if (!role.permissions) role.permissions = [];
    const idx = role.permissions.indexOf(feature);
    if (idx >= 0) role.permissions.splice(idx, 1);
    else role.permissions.push(feature);
    _syncRolePermissions();
    saveDatabase();
    renderRoleEditor();
    filterDashboardCards();
    showToast('✅ Berechtigung aktualisiert', `${role.name} – ${feature}`, 'success');
}

function createNewRole() {
    const name = (document.getElementById('newRoleName').value || '').trim();
    if (!name) { showToast('⚠️ Fehler', 'Bitte einen Rollennamen eingeben', 'error'); return; }
    if (getAvailableRoles().find(r => r.name === name)) { showToast('⚠️ Fehler', `Rolle "${name}" existiert bereits`, 'error'); return; }
    const newRole = {
        id: 'role_custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        name: name,
        color: document.getElementById('newRoleColor').value || '#888888',
        icon: document.getElementById('newRoleIcon').value || 'fas fa-user-tag',
        priority: parseInt(document.getElementById('newRolePriority').value) || 20,
        description: document.getElementById('newRoleDescription').value || '',
        isDefault: false,
        permissions: []
    };
    if (!database.roles) database.roles = [];
    database.roles.push(newRole);
    // Rückwärtskompatibilität
    if (!database.customRoles) database.customRoles = [];
    database.customRoles.push(name);
    _syncRolePermissions();
    saveDatabase();
    document.getElementById('newRoleName').value = '';
    document.getElementById('newRoleDescription').value = '';
    renderRoleEditor();
    showToast('✅ Rolle erstellt', name, 'success');
}

function deleteRole(roleId) {
    const role = (database.roles || []).find(r => r.id === roleId);
    if (!role) return;
    if (role.isDefault) { showToast('⚠️ Fehler', 'Standard-Rollen können nicht gelöscht werden', 'error'); return; }
    if (!confirm(`Rolle "${role.name}" wirklich löschen?`)) return;
    database.roles = database.roles.filter(r => r.id !== roleId);
    database.customRoles = (database.customRoles || []).filter(r => r !== role.name);
    if (database.rolePermissions) delete database.rolePermissions[role.name];
    saveDatabase();
    renderRoleEditor();
    showToast('✅ Rolle gelöscht', role.name, 'success');
}

function editRoleModal(roleId) {
    const role = (database.roles || []).find(r => r.id === roleId);
    if (!role) return;
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.style.zIndex = '10001';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:480px">
            <div class="modal-header"><h2><i class="${escapeHtml(role.icon || 'fas fa-user')}" style="color:${role.color}"></i> Rolle bearbeiten: ${escapeHtml(role.name)}</h2><button class="modal-close" onclick="this.closest('.modal').remove()">×</button></div>
            <div style="display:grid;gap:10px;padding:10px 0">
                <div class="form-group"><label>Name</label><input type="text" id="editRoleName" value="${escapeHtml(role.name)}" ${role.isDefault ? 'readonly style="opacity:0.6"' : ''}></div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                    <div class="form-group"><label>Farbe</label><input type="color" id="editRoleColor" value="${role.color || '#888888'}" style="height:36px;width:100%"></div>
                    <div class="form-group"><label>Priorität</label><input type="number" id="editRolePriority" value="${role.priority || 0}" min="0" max="100"></div>
                </div>
                <div class="form-group"><label>Icon (Font Awesome Klasse)</label><input type="text" id="editRoleIcon" value="${escapeHtml(role.icon || 'fas fa-user')}" placeholder="fas fa-user"></div>
                <div class="form-group"><label>Beschreibung</label><textarea id="editRoleDesc">${escapeHtml(role.description || '')}</textarea></div>
                <button class="btn btn-success" style="width:100%" onclick="saveRoleEdit('${escapeHtml(roleId)}')">💾 Speichern</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function saveRoleEdit(roleId) {
    const role = (database.roles || []).find(r => r.id === roleId);
    if (!role) return;
    const oldName = role.name;
    if (!role.isDefault) {
        const newName = document.getElementById('editRoleName').value.trim();
        if (newName && newName !== oldName) {
            // Prüfe ob Name schon existiert
            if (getAvailableRoles().find(r => r.name === newName && r.id !== roleId)) {
                showToast('⚠️ Fehler', 'Dieser Rollenname existiert bereits', 'error');
                return;
            }
            role.name = newName;
            // Nutzer mit alter Rolle aktualisieren
            database.users.forEach(u => { if (u.role === oldName) u.role = newName; });
            // customRoles aktualisieren
            database.customRoles = (database.customRoles || []).map(r => r === oldName ? newName : r);
        }
    }
    role.color = document.getElementById('editRoleColor').value;
    role.priority = parseInt(document.getElementById('editRolePriority').value) || 0;
    role.icon = document.getElementById('editRoleIcon').value || 'fas fa-user';
    role.description = document.getElementById('editRoleDesc').value;
    _syncRolePermissions();
    saveDatabase();
    document.querySelector('.modal[style*="z-index: 10001"]')?.remove();
    renderRoleEditor();
    showToast('✅ Rolle aktualisiert', role.name, 'success');
}

function resetRolesToDefault() {
    if (!confirm('Alle Rollen auf Standard zurücksetzen? Custom-Rollen bleiben erhalten, aber Standard-Rollen werden zurückgesetzt.')) return;
    const customRoles = (database.roles || []).filter(r => !r.isDefault);
    database.roles = [...JSON.parse(JSON.stringify(DEFAULT_ROLES_DATA)), ...customRoles];
    _syncRolePermissions();
    saveDatabase();
    renderRoleEditor();
    filterDashboardCards();
    showToast('✅ Rollen zurückgesetzt', 'Standard-Rollen wiederhergestellt', 'success');
}

// Rückwärtskompatibilität: alte Funktionen
function resetPermissionsToDefault() { resetRolesToDefault(); }
function createCustomRole() { createNewRole(); }
function deleteCustomRole(roleName) {
    const role = (database.roles || []).find(r => r.name === roleName && !r.isDefault);
    if (role) deleteRole(role.id);
}

// ========== ADMIN: RÄNGE-EDITOR ==========
function renderAdminRanksEditor() {
    const panel = document.getElementById('adminRanksPanel');
    if (!panel) return;
    const sorted = [...database.jobRanks].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    let html = '<div style="margin-bottom:15px"><p style="font-size:0.9em;margin:0;color:rgba(255,255,255,0.7)">Verwalte alle Dienstgrade. Ränge bestimmen die Position in der Hierarchie und können Abteilungen zugeordnet werden.</p></div>';

    sorted.forEach(rank => {
        const deptBadge = rank.department
            ? `<span class="badge badge-info" style="font-size:0.7em">${escapeHtml(rank.department)}</span>`
            : '';
        html += `<div style="border:1px solid ${rank.color}55;border-radius:8px;padding:10px;margin-bottom:8px;background:rgba(0,0,0,0.15);display:flex;align-items:center;gap:10px">
            <i class="${rank.icon || 'fas fa-award'}" style="color:${rank.color};font-size:1.3em;width:28px;text-align:center"></i>
            <div style="flex:1">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                    <strong style="color:${rank.color}">${escapeHtml(rank.name)}</strong>
                    ${rank.abbreviation ? `<span style="font-size:0.75em;color:var(--text-secondary)">(${escapeHtml(rank.abbreviation)})</span>` : ''}
                    ${deptBadge}
                    <span style="font-size:0.7em;color:var(--info);border:1px solid rgba(0,221,255,0.3);border-radius:4px;padding:1px 5px">Prio ${rank.priority || 0}</span>
                </div>
                ${rank.description ? `<div style="font-size:0.8em;color:var(--text-secondary);margin-top:2px">${escapeHtml(rank.description)}</div>` : ''}
            </div>
            <div style="display:flex;gap:4px">
                <button class="btn btn-small btn-primary" onclick="editRank(${rank.id})" title="Bearbeiten">✎</button>
                <button class="btn btn-small" onclick="deleteRank(${rank.id});renderAdminRanksEditor()" style="background:rgba(255,51,51,0.2);color:var(--danger);border:1px solid rgba(255,51,51,0.3)">×</button>
            </div>
        </div>`;
    });

    html += `<div style="border:2px dashed rgba(0,255,136,0.3);border-radius:8px;padding:12px;margin-top:12px">
        <button class="btn btn-primary" onclick="openModal('addRank')" style="width:100%"><i class="fas fa-plus"></i> Neuen Rang hinzufügen</button>
    </div>`;

    panel.innerHTML = html;
}

// ========== ADMIN: ABTEILUNGEN-EDITOR ==========
function renderDepartmentsEditor() {
    const panel = document.getElementById('adminDepartmentsPanel');
    if (!panel) return;
    const depts = getAvailableDepartments();

    let html = '<div style="margin-bottom:15px"><p style="font-size:0.9em;margin:0;color:rgba(255,255,255,0.7)">Verwalte Abteilungen. Abteilungen können Rängen zugeordnet werden.</p></div>';

    depts.forEach(d => {
        const assignedRanks = database.jobRanks.filter(r => r.department === d.name).length;
        html += `<div style="border:1px solid ${d.color}55;border-radius:8px;padding:10px;margin-bottom:8px;background:rgba(0,0,0,0.15);display:flex;align-items:center;gap:10px">
            <i class="${d.icon || 'fas fa-building'}" style="color:${d.color};font-size:1.3em;width:28px;text-align:center"></i>
            <div style="flex:1">
                <div style="display:flex;align-items:center;gap:6px">
                    <strong style="color:${d.color}">${escapeHtml(d.name)}</strong>
                    <span style="font-size:0.7em;color:var(--text-secondary)">${assignedRanks} Ränge</span>
                </div>
                ${d.description ? `<div style="font-size:0.8em;color:var(--text-secondary);margin-top:2px">${escapeHtml(d.description)}</div>` : ''}
            </div>
            <div style="display:flex;gap:4px">
                <button class="btn btn-small btn-primary" onclick="editDepartmentModal('${escapeHtml(d.id)}')" title="Bearbeiten">✎</button>
                <button class="btn btn-small" onclick="deleteDepartment('${escapeHtml(d.id)}')" style="background:rgba(255,51,51,0.2);color:var(--danger);border:1px solid rgba(255,51,51,0.3)">×</button>
            </div>
        </div>`;
    });

    html += `<div style="border:2px dashed rgba(0,255,136,0.3);border-radius:8px;padding:12px;margin-top:12px">
        <h4 style="color:var(--secondary);margin-bottom:10px">➕ Neue Abteilung</h4>
        <div style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:8px">
            <input type="text" id="newDeptName" placeholder="Name..." style="padding:8px;background:rgba(0,102,204,0.1);border:1px solid rgba(0,102,204,0.3);border-radius:4px;color:var(--text-primary);font-size:0.9em">
            <input type="color" id="newDeptColor" value="#0066cc" style="height:36px;border:1px solid rgba(0,102,204,0.3);border-radius:4px;background:transparent;cursor:pointer">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <input type="text" id="newDeptIcon" placeholder="Icon (fas fa-...)" value="fas fa-building" style="padding:8px;background:rgba(0,102,204,0.1);border:1px solid rgba(0,102,204,0.3);border-radius:4px;color:var(--text-primary);font-size:0.9em">
            <input type="text" id="newDeptDesc" placeholder="Beschreibung..." style="padding:8px;background:rgba(0,102,204,0.1);border:1px solid rgba(0,102,204,0.3);border-radius:4px;color:var(--text-primary);font-size:0.9em">
        </div>
        <button onclick="createDepartment()" style="padding:8px 18px;background:linear-gradient(90deg,var(--primary),var(--primary-bright));color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;font-size:0.9em">Erstellen</button>
    </div>`;

    panel.innerHTML = html;
}

function createDepartment() {
    const name = (document.getElementById('newDeptName').value || '').trim();
    if (!name) { showToast('⚠️ Fehler', 'Bitte einen Abteilungsnamen eingeben', 'error'); return; }
    if (getAvailableDepartments().find(d => d.name === name)) { showToast('⚠️ Fehler', 'Abteilung existiert bereits', 'error'); return; }
    const dept = {
        id: 'dept_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        name: name,
        color: document.getElementById('newDeptColor').value || '#0066cc',
        icon: document.getElementById('newDeptIcon').value || 'fas fa-building',
        description: document.getElementById('newDeptDesc').value || ''
    };
    if (!database.departments) database.departments = [];
    database.departments.push(dept);
    saveDatabase();
    document.getElementById('newDeptName').value = '';
    document.getElementById('newDeptDesc').value = '';
    renderDepartmentsEditor();
    showToast('✅ Abteilung erstellt', name, 'success');
}

function deleteDepartment(deptId) {
    const dept = (database.departments || []).find(d => d.id === deptId);
    if (!dept) return;
    if (!confirm(`Abteilung "${dept.name}" löschen?`)) return;
    database.departments = database.departments.filter(d => d.id !== deptId);
    // Ränge in dieser Abteilung entkoppeln
    database.jobRanks.forEach(r => { if (r.department === dept.name) r.department = ''; });
    saveDatabase();
    renderDepartmentsEditor();
    showToast('✅ Abteilung gelöscht', dept.name, 'success');
}

function editDepartmentModal(deptId) {
    const dept = (database.departments || []).find(d => d.id === deptId);
    if (!dept) return;
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.style.zIndex = '10001';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:450px">
            <div class="modal-header"><h2><i class="${escapeHtml(dept.icon)}" style="color:${dept.color}"></i> Abteilung bearbeiten</h2><button class="modal-close" onclick="this.closest('.modal').remove()">×</button></div>
            <div style="display:grid;gap:10px;padding:10px 0">
                <div class="form-group"><label>Name</label><input type="text" id="editDeptName" value="${escapeHtml(dept.name)}"></div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                    <div class="form-group"><label>Farbe</label><input type="color" id="editDeptColor" value="${dept.color || '#0066cc'}" style="height:36px;width:100%"></div>
                    <div class="form-group"><label>Icon</label><input type="text" id="editDeptIcon" value="${escapeHtml(dept.icon || 'fas fa-building')}"></div>
                </div>
                <div class="form-group"><label>Beschreibung</label><textarea id="editDeptDesc">${escapeHtml(dept.description || '')}</textarea></div>
                <button class="btn btn-success" style="width:100%" onclick="saveDepartmentEdit('${escapeHtml(deptId)}')">💾 Speichern</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function saveDepartmentEdit(deptId) {
    const dept = (database.departments || []).find(d => d.id === deptId);
    if (!dept) return;
    const oldName = dept.name;
    const newName = document.getElementById('editDeptName').value.trim();
    if (newName && newName !== oldName) {
        dept.name = newName;
        // Ränge aktualisieren
        database.jobRanks.forEach(r => { if (r.department === oldName) r.department = newName; });
    }
    dept.color = document.getElementById('editDeptColor').value;
    dept.icon = document.getElementById('editDeptIcon').value || 'fas fa-building';
    dept.description = document.getElementById('editDeptDesc').value;
    saveDatabase();
    document.querySelector('.modal[style*="z-index: 10001"]')?.remove();
    renderDepartmentsEditor();
    showToast('✅ Abteilung aktualisiert', dept.name, 'success');
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

// ========== CUSTOM ROLES (Rückwärtskompatibilität) ==========

// ========== USER PERMISSIONS ==========
function openUserPermissionsModal(userId) {
    const user = database.users.find(u => u.id === userId);
    if (!user) return;
    if (!canAccess('admin')) { showToast('🚫 Zugriff verweigert', 'Nur Admins dürfen Berechtigungen vergeben', 'error'); return; }
    const extra = user.extraPermissions || [];
    const rolePerms = getPermissionsForRole(user.role);
    const roleObj = findRoleByName(user.role);
    const roleColor = roleObj ? roleObj.color : 'var(--info)';
    const roleIcon = roleObj ? `<i class="${roleObj.icon}" style="margin-right:4px"></i>` : '';
    document.getElementById('userPermissionsTitle').innerHTML = `🔑 Berechtigungen: ${escapeHtml(user.username)} <span class="badge" style="background:${roleColor}22;color:${roleColor};border:1px solid ${roleColor}44">${roleIcon}${escapeHtml(user.role)}</span>`;
    let html = '<p style="color:var(--text-secondary);font-size:0.85em;margin-bottom:12px">Aktivierte Features zusätzlich zur Rollen-Berechtigung:</p>';
    FEATURES.forEach(f => {
        const fromRole = rolePerms.includes(f);
        const fromExtra = extra.includes(f);
        const labelColor = fromRole ? `${roleColor}15` : fromExtra ? 'rgba(0,255,136,0.1)' : 'rgba(0,0,0,0.1)';
        html += `<label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;background:${labelColor};margin-bottom:6px;cursor:${fromRole ? 'default' : 'pointer'}">
            <input type="checkbox" ${(fromRole || fromExtra) ? 'checked' : ''} ${fromRole ? 'disabled' : `onchange="saveUserPermission(${userId}, '${f}', this.checked)"`} style="cursor:${fromRole ? 'default' : 'pointer'}">
            <span style="flex:1;font-weight:600">${f}</span>
            ${fromRole ? `<span style="font-size:0.75em;color:${roleColor};border:1px solid ${roleColor};border-radius:4px;padding:1px 5px">Rolle</span>` : fromExtra ? '<span style="font-size:0.75em;color:var(--success);border:1px solid var(--success);border-radius:4px;padding:1px 5px">Individuell</span>' : ''}
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

function filterFallubersicht() {
    const search = (document.getElementById('fallubersichtSearch')?.value || '').toLowerCase();
    if (!search) { renderFallubersicht(); return; }
    const filteredCitations = database.citations.filter(c =>
        (c.name || '').toLowerCase().includes(search) || (c.aktenzeichen || '').toLowerCase().includes(search)
    );
    const filteredCharges = database.charges.filter(c =>
        (c.name || '').toLowerCase().includes(search) || (c.chargeNumber || '').toLowerCase().includes(search)
    );
    renderFallubersicht(filteredCitations, filteredCharges);
}
function filterTrainingModal() { makeSearchFilter('trainingModalSearch', 'trainingViewTableBody', [0, 1, 2, 3]); }
function filterApplicationsModal() { makeSearchFilter('applicationsModalSearch', 'applicationsViewTableBody', [0, 1, 2]); }
function filterCitationsModal() { makeSearchFilter('citationsModalSearch', 'citationsViewTableBody', [0, 1]); }
function filterChargesModal() { renderChargesView(); }

// Inline-Tabellen-Filter (Dashboard-Sektion)
function filterCitizens() { makeSearchFilter('citizensSearch', 'citizensTableBody', [0, 1, 2]); }
function filterCitations() { makeSearchFilter('citationSearch', 'citationsInlineTableBody', [0, 1]); }
function filterCharges() { makeSearchFilter('chargesSearch', 'chargesInlineTableBody', [0, 1, 2]); }

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
    // Anzahl einzigartiger Personen in den Akten (Fallübersicht)
    const subjects = new Set([
        ...database.citations.map(c => c.name),
        ...database.charges.map(c => c.name)
    ].filter(Boolean));
    set('fallCount', subjects.size);
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
        { id: 'fallubersichtModal',    render: renderFallubersicht,    filter: () => {} },
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
