// ============================================
// mitarbeiter-logic.js - All Portal Staff Logic
// Nutzt die globalen Variablen aus db.js
// ============================================

const ROLES = ['Trainee', 'Mitarbeiter', 'Ausbilder', 'Leitungseben', 'Personalverwaltung', 'Admin', 'Commissioner'];
const FEATURES = ['users', 'ranks', 'employees', 'citizens', 'evidence', 'training', 'applications', 'citations', 'charges', 'press', 'admin'];

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
    return perms.includes(capability);
}

function filterDashboardCards() {
    if (!currentUser) return;
    const cards = document.querySelectorAll('.card[data-role]');
    cards.forEach(card => {
        const roles = card.dataset.role.split(',');
        card.classList.toggle('hidden', !roles.includes(currentUser.role));
    });
}

function switchRole(role) {
    if (!currentUser) return;
    currentUser.role = role;
    document.getElementById('roleSelector').value = role;
    document.getElementById('currentUser').textContent = role;
    document.getElementById('userRole').textContent = `(${role})`;
    filterDashboardCards();
    showToast('🔄 Rolle gewechselt', `Sie sind jetzt: ${role}`, 'info');
}

// ========== LOGIN ==========
function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    const usr = database.users.find(x => x.username === u && x.password === p);
    
    if (usr) {
        currentUser = { username: u, role: usr.role };
        document.getElementById('roleSelector').value = usr.role;
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
    document.getElementById('roleSelector').value = currentUser.role;
    filterDashboardCards();
    updateCounts();
    
    if (firebaseEnabled) {
        loadFromFirestore().catch(e => console.warn('Firestore load on login failed:', e));
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
        applications: 'applicationsViewModal', citations: 'citationsViewModal', charges: 'chargesViewModal', press: 'pressViewModal'
    };

    const permMap = {
        addUser: ['users'], addRank: ['ranks'], addEmployee: ['employees'], addCitizen: ['citizens'],
        addEvidence: ['evidence'], addTraining: ['training'], addCitation: ['citations'],
        addCharge: ['charges'], addPress: ['press'], users: ['users'], ranks: ['ranks'],
        employees: ['employees'], citizens: ['citizens'], evidence: ['evidence'],
        training: ['training'], applications: ['applications'], citations: ['citations'],
        charges: ['charges'], press: ['press']
    };

    const reqPerms = permMap[t] || [];
    if (reqPerms.length > 0 && !reqPerms.some(p => canAccess(p))) {
        showToast('🚫 Keine Berechtigung', `Diese Funktion benötigt: ${reqPerms.join(', ')}`, 'error');
        return;
    }

    if (t === 'addUser') { populateJobRankDropdown(); generateNewPassword(); }
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
        press: 'pressViewModal', admin: 'adminPanelModal'
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
    ROLES.forEach(rl => {
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
    b.innerHTML = database.users.map(u => 
        `<tr><td>${u.username}</td><td><span class="badge badge-info">${u.role}</span></td><td>${u.jobRank}</td><td><span class="badge badge-success">${u.status}</span></td><td><button class="btn btn-small" onclick="deleteUser(${u.id})">×</button></td></tr>`
    ).join('');
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

function filterCitizens() {
    const query = document.getElementById('citizensSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#citizensTableBody tr');
    rows.forEach(row => {
        const name = row.cells[0]?.textContent.toLowerCase();
        const phone = row.cells[1]?.textContent.toLowerCase();
        const match = name?.includes(query) || phone?.includes(query);
        row.style.display = match ? '' : 'none';
    });
}

// ========== EVIDENCE ==========
function addEvidence(e) {
    e.preventDefault();
    const ev = {
        id: Date.now(),
        aktenzeichen: `AZ-${Date.now().toString().slice(-6)}`,
        description: document.getElementById('evDesc').value,
        location: document.getElementById('evLocation').value
    };
    database.evidence.push(ev);
    saveDatabase();
    closeModal('addEvidence');
    document.getElementById('addEvidenceModal').querySelector('form').reset();
    showToast('✅ Beweismittel hinzugefügt', ev.aktenzeichen, 'success');
    updateCounts();
}

function renderEvidenceView() {
    const b = document.getElementById('evidenceViewTableBody');
    b.innerHTML = database.evidence.map(e => 
        `<tr><td>${e.aktenzeichen}</td><td>${e.description}</td><td>${e.location}</td><td><button class="btn btn-small" onclick="deleteEvidence(${e.id})">×</button></td></tr>`
    ).join('');
}

function deleteEvidence(id) {
    if (confirm('Löschen?')) {
        database.evidence = database.evidence.filter(e => e.id !== id);
        saveDatabase();
        renderEvidenceView();
        updateCounts();
    }
}

// ========== TRAINING ==========
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
    if (isPending) {
        actions.innerHTML = `
            <button class="btn btn-success" onclick="acceptApplication(${a.id});document.getElementById('applicationDetailModal').classList.remove('show')">
                <i class="fas fa-check"></i> Annehmen
            </button>
            <button class="btn" onclick="rejectApplication(${a.id});document.getElementById('applicationDetailModal').classList.remove('show')" style="background:rgba(255,51,51,0.2);color:var(--danger);border:1px solid rgba(255,51,51,0.4)">
                <i class="fas fa-times"></i> Ablehnen
            </button>`;
    } else {
        actions.innerHTML = `<span style="color:var(--text-secondary);font-size:0.9em">Diese Bewerbung wurde bereits bearbeitet.</span>`;
    }

    document.getElementById('applicationDetailModal').classList.add('show');
}

function acceptApplication(id) {
    const a = database.applications.find(x => x.id === id);
    if (a && a.status === 'Eingereicht') {
        a.status = 'Akzeptiert';
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
        saveDatabase();
        renderApplicationsView();
        updateCounts();
        showToast('❌ Bewerbung abgelehnt', a.name, 'error');
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

function filterCitations() {
    const query = document.getElementById('citationSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#citationsViewTableBody tr');
    rows.forEach(row => {
        const az = row.cells[0]?.textContent.toLowerCase();
        const name = row.cells[1]?.textContent.toLowerCase();
        const match = az?.includes(query) || name?.includes(query);
        row.style.display = match ? '' : 'none';
    });
}

// ========== CHARGES (Anzeigen) ==========
function addCharge(e) {
    e.preventDefault();
    const c = {
        id: Date.now(),
        chargeNumber: `AZ-${Date.now().toString().slice(-6)}`,
        name: document.getElementById('chargeName').value,
        type: document.getElementById('chargeType').value,
        description: document.getElementById('chargeDesc').value,
        officer: document.getElementById('chargeOfficer').value,
        status: 'Aktiv',
        date: new Date().toISOString(),
        editUntil: Date.now() + 30 * 60000
    };
    database.charges.push(c);
    saveDatabase();
    closeModal('addCharge');
    document.getElementById('addChargeModal').querySelector('form').reset();
    showToast('✅ Anzeige erstellt', c.chargeNumber, 'success');
    updateCounts();
    renderChargesView();
}

function renderChargesView() {
    const b = document.getElementById('chargesViewTableBody');
    b.innerHTML = database.charges.map(c => {
        const canEdit = Date.now() < c.editUntil;
        const timeLeft = Math.max(0, Math.ceil((c.editUntil - Date.now()) / 60000));
        return `<tr><td>${c.chargeNumber}</td><td>${c.name}</td><td><span class="badge badge-danger">${c.type}</span></td><td>${c.officer}</td><td><span class="badge ${c.status === 'Aktiv' ? 'badge-danger' : 'badge-success'}">${c.status}</span></td><td>${new Date(c.date).toLocaleDateString('de-DE')}</td><td>${canEdit ? `<button class="btn btn-small" onclick="editCharge(${c.id})" title="Noch ${timeLeft} Min">✎</button>` : '<span style="color:var(--text-secondary);font-size:0.8em">Gesperrt</span>'}<button class="btn btn-small" ${canEdit ? '' : 'disabled'} onclick="deleteCharge(${c.id})">×</button></td></tr>`;
    }).join('');
}

function deleteCharge(id) {
    if (confirm('Anzeige löschen?')) {
        const c = database.charges.find(x => x.id === id);
        if (c && Date.now() >= c.editUntil) {
            showToast('🔒 Zu spät', 'Diese Anzeige kann nicht mehr gelöscht werden', 'error');
            return;
        }
        database.charges = database.charges.filter(c => c.id !== id);
        saveDatabase();
        renderChargesView();
        updateCounts();
        showToast('✅ Gelöscht', 'Anzeige gelöscht', 'success');
    }
}

function editCharge(id) {
    const c = database.charges.find(x => x.id === id);
    if (!c || Date.now() >= c.editUntil) {
        showToast('🔒 Zu spät', 'Diese Anzeige kann nicht mehr bearbeitet werden', 'error');
        return;
    }
    document.getElementById('chargeName').value = c.name;
    document.getElementById('chargeType').value = c.type;
    document.getElementById('chargeDesc').value = c.description;
    document.getElementById('chargeOfficer').value = c.officer;
    
    document.getElementById('addChargeModal').querySelector('form').onsubmit = ((e) => {
        e.preventDefault();
        c.name = document.getElementById('chargeName').value;
        c.type = document.getElementById('chargeType').value;
        c.description = document.getElementById('chargeDesc').value;
        c.officer = document.getElementById('chargeOfficer').value;
        saveDatabase();
        closeModal('addCharge');
        document.getElementById('addChargeModal').querySelector('form').reset();
        document.getElementById('addChargeModal').querySelector('form').onsubmit = null;
        showToast('✅ Aktualisiert', 'Anzeige aktualisiert', 'success');
        renderChargesView();
    });
    openModal('addCharge');
}

function filterCharges() {
    const query = document.getElementById('chargesSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#chargesViewTableBody tr');
    rows.forEach(row => {
        const az = row.cells[0]?.textContent.toLowerCase();
        const name = row.cells[1]?.textContent.toLowerCase();
        const match = az?.includes(query) || name?.includes(query);
        row.style.display = match ? '' : 'none';
    });
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
    c.innerHTML = database.press.sort((a, b) => new Date(b.date) - new Date(a.date)).map(p => {
        const canEdit = Date.now() < p.editUntil;
        const editBtn = canEdit ? `<button class="btn btn-primary btn-small" onclick="editPressArticle(${p.id})">✎ Bearbeiten</button>` : '';
        const delBtn = canEdit ? `<button class="btn btn-small" style="background:rgba(255,51,51,0.2);border:1px solid #ff6b6b;color:#ff6b6b" onclick="deletePressArticle(${p.id})">×</button>` : '';
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

// ========== ADMIN PANEL ==========
function openAdminPanel() {
    if (!canAccess('admin')) {
        showToast('🚫 Zugriff verweigert', 'Nur Admins dürfen das Admin Panel öffnen', 'error');
        return;
    }
    document.getElementById('adminPanelModal').classList.add('show');
    renderRoleEditor();
    const s = document.getElementById('statsPanel');
    s.innerHTML = `<div style="background:rgba(0,255,136,0.1);padding:10px;border-radius:6px"><div style="color:var(--secondary)">Nutzer</div><div style="font-size:1.2em;font-weight:700">${database.users.length}</div></div><div style="background:rgba(0,255,136,0.1);padding:10px;border-radius:6px"><div style="color:var(--secondary)">Mitarbeiter</div><div style="font-size:1.2em;font-weight:700">${database.employees.length}</div></div>`;
}

function renderRoleEditor() {
    const perms = getRolePermissions();
    let html = '<div style="margin-bottom:15px"><h4 style="color:var(--secondary);margin:0 0 10px 0">📋 Berechtigungen verwalten</h4><p style="font-size:0.9em;margin:0;color:rgba(255,255,255,0.7)">Wähle aus, welche Funktionen jede Rolle verwenden kann:</p></div>';
    ROLES.forEach(role => {
        html += `<div style="border:1px solid rgba(0,255,136,0.3);border-radius:8px;padding:12px;margin-bottom:12px"><strong style="color:var(--secondary);font-size:1.1em;display:block;margin-bottom:8px">${role}</strong>`;
        FEATURES.forEach(feature => {
            const isChecked = perms[role] && perms[role].includes(feature);
            html += `<label style="display:inline-flex;align-items:center;gap:8px;margin-right:15px;cursor:pointer;font-size:0.9em"><input type="checkbox" id="perm_${role}_${feature}" ${isChecked ? 'checked' : ''} onchange="toggleRolePermission('${role}','${feature}')" style="cursor:pointer"><span>${feature}</span></label>`;
        });
        html += '</div>';
    });
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

function resetTestData() {
    if (!confirm('Alle Daten zurücksetzen?')) return;
    database = {
        users: [{id: 1, username: 'Admin', password: 'Admin123!', role: 'Admin', jobRank: 'Admin', status: 'Aktiv', created: new Date().toISOString()}],
        jobRanks: [{id: 1, name: 'Admin', color: '#ff0000'}, {id: 2, name: 'Chief', color: '#0066cc'}, {id: 3, name: 'Officer', color: '#00ff88'}],
        employees: [], citizens: [], evidence: [], training: [], applications: [], citations: [], charges: [], press: [], auditLog: [], requests: [], news: [],
        rolePermissions: JSON.parse(JSON.stringify(defaultRolePermissions))
    };
    saveDatabase();
    showToast('🔄 Reset', 'Daten & Berechtigungen zurückgesetzt', 'success');
    location.reload();
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
    document.getElementById('userCount').textContent = database.users.length;
    document.getElementById('rankCount').textContent = database.jobRanks.length;
    document.getElementById('employeeCount').textContent = database.employees.length;
    document.getElementById('citizenCount').textContent = database.citizens.length;
    document.getElementById('evidenceCount').textContent = database.evidence.length;
    document.getElementById('trainingCount').textContent = database.training.length;
    document.getElementById('applicationsCount').textContent = database.applications.length;
    document.getElementById('citationsCount').textContent = database.citations.length;
    document.getElementById('chargesCount').textContent = database.charges.length;
    document.getElementById('pressCount').textContent = database.press.length;
}

// ========== MODAL CLICK OUTSIDE ==========
window.onclick = function(e) {
    if (e.target.classList.contains('modal'))
        e.target.classList.remove('show');
};

// ========== INITIALIZATION ==========
console.log('✅ mitarbeiter-logic.js geladen');
