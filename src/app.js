import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { createTicket as saveNewTicket, subscribeTickets, updateTicket as saveTicket } from './data.js';
import { auth, isFirebaseConfigured, missingFirebaseConfig } from './firebase.js';

const root = document.querySelector('#app');
const teamMembers = ['Prince Maglalang', 'Alex Rivera', 'Jamie Lee', 'Unassigned'];
const statuses = ['All tickets', 'Open', 'In Progress', 'Resolved'];
const iconPaths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  ticket: '<path d="M3 8a2 2 0 0 0 0 4v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a2 2 0 0 1 0-4V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2Z"/><path d="M13 5v2m0 4v2m0 4v1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m7 10 5 5 5-5"/>',
  close: '<path d="m18 6-12 12M6 6l12 12"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  alert: '<path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/>',
  filter: '<path d="M4 7h16M7 12h10m-7 5h4"/><circle cx="8" cy="7" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="11" cy="17" r="1"/>',
  monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  wifi: '<path d="M5 9a11 11 0 0 1 14 0m-11 4a6 6 0 0 1 8 0m-5 4h.01"/><path d="M2 6a16 16 0 0 1 20 0"/>',
  key: '<circle cx="8" cy="15" r="5"/><path d="m11.5 11.5 8-8L22 6l-2 2 2 2-3 3-2-2-3 3"/>',
  package: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 8 9 5 9-5m-18 0v9l9 5 9-5V8m-9 5v9"/>',
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
};

const state = {
  tickets: [],
  activeView: 'dashboard',
  activeStatus: 'All tickets',
  search: '',
  location: 'All locations',
  selectedTicketId: null,
  isCreateOpen: false,
  isLoading: true,
  isAuthReady: false,
  user: null,
  isSaving: false,
  hasLoadError: false,
  notice: '',
};
let unsubscribeTickets = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function icon(name, size = 18) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name]}</svg>`;
}

function ticketIcon(category) {
  if (category === 'Network') return 'wifi';
  if (category === 'Account access') return 'key';
  if (category === 'Equipment') return 'package';
  return 'monitor';
}

function firebaseError(error) {
  const messages = {
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/operation-not-allowed': 'Email and password sign-in is not enabled in Firebase Authentication.',
    'auth/too-many-requests': 'Too many sign-in attempts. Try again later.',
    'auth/network-request-failed': 'Could not reach Firebase. Check your internet connection.',
    'auth/unauthorized-domain': 'This website domain is not authorized. Add its hostname in Firebase Authentication settings.',
    'permission-denied': 'Your account is not allowed to access tickets. Check Firestore security rules.',
    'unavailable': 'Firebase is temporarily unavailable. Try again shortly.',
  };
  return messages[error.code] || error.message || 'An unexpected Firebase error occurred.';
}

function getCounts() {
  return {
    'All tickets': state.tickets.length,
    Open: state.tickets.filter((ticket) => ticket.status === 'Open').length,
    'In Progress': state.tickets.filter((ticket) => ticket.status === 'In Progress').length,
    Resolved: state.tickets.filter((ticket) => ticket.status === 'Resolved').length,
  };
}

function getFilteredTickets() {
  return state.tickets.filter((ticket) => {
    const matchesStatus = state.activeStatus === 'All tickets' || ticket.status === state.activeStatus;
    const matchesLocation = state.location === 'All locations' || ticket.location === state.location;
    const searchText = `${ticket.id} ${ticket.issue} ${ticket.requester} ${ticket.location} ${ticket.category}`.toLowerCase();
    return matchesStatus && matchesLocation && searchText.includes(state.search.toLowerCase().trim());
  });
}

function ticketRow(ticket) {
  const typeIcon = ticketIcon(ticket.category);
  const assigneeInitials = ticket.assignee === 'Unassigned'
    ? '?'
    : ticket.assignee.split(' ').map((part) => part[0]).join('');
  const statusClass = ticket.status.toLowerCase().replace(' ', '-');
  return `<tr data-ticket-open="${escapeHtml(ticket.id)}" tabindex="0">
    <td><div class="ticket-cell"><span class="ticket-type-icon type-${typeIcon}">${icon(typeIcon, 16)}</span><div class="ticket-copy"><strong>${escapeHtml(ticket.issue)}</strong><span>${escapeHtml(ticket.id)} <i></i> ${escapeHtml(ticket.location)}</span></div></div></td>
    <td><span class="requester-name">${escapeHtml(ticket.requester)}</span></td>
    <td><span class="category-label">${escapeHtml(ticket.category)}</span></td>
    <td><span class="priority-badge priority-${escapeHtml(ticket.priority.toLowerCase())}"><span></span>${escapeHtml(ticket.priority)}</span></td>
    <td><span class="status-badge status-${statusClass}">${ticket.status === 'In Progress' ? '<span class="status-spinner"></span>' : ''}${escapeHtml(ticket.status)}</span></td>
    <td><span class="assignee${ticket.assignee === 'Unassigned' ? ' unassigned' : ''}"><span class="assignee-avatar">${escapeHtml(assigneeInitials)}</span>${escapeHtml(ticket.assignee)}</span></td>
    <td class="time-cell">${escapeHtml(ticket.time)}</td>
    <td><button class="row-action" aria-label="View ${escapeHtml(ticket.id)}" data-ticket-open="${escapeHtml(ticket.id)}">${icon('chevron', 17)}</button></td>
  </tr>`;
}

function renderMetrics(counts, openTickets) {
  const critical = state.tickets.filter((ticket) => ticket.priority === 'Critical' && ticket.status !== 'Resolved').length;
  const resolved = counts.Resolved;
  return `<section class="metrics-grid" aria-label="Ticket summary">
    <article class="metric-card"><div class="metric-top"><span class="metric-icon icon-blue">${icon('ticket')}</span><span class="metric-trend">${icon('arrow', 13)} Live</span></div><p class="metric-label">Active tickets</p><div class="metric-value">${openTickets.length}<span class="metric-note">currently open</span></div><div class="metric-footer"><span class="mini-bar blue-bar"></span><span>Across all locations</span></div></article>
    <article class="metric-card"><div class="metric-top"><span class="metric-icon icon-red">${icon('alert')}</span><span class="metric-trend muted-trend">Needs attention</span></div><p class="metric-label">Critical priority</p><div class="metric-value">${critical}<span class="metric-note">unresolved</span></div><div class="metric-footer"><span class="mini-bar red-bar"></span><span>Requires immediate response</span></div></article>
    <article class="metric-card"><div class="metric-top"><span class="metric-icon icon-violet">${icon('clock')}</span><span class="metric-trend muted-trend">In progress</span></div><p class="metric-label">Being handled</p><div class="metric-value">${counts['In Progress']}<span class="metric-note">with your team</span></div><div class="metric-footer"><span class="mini-bar violet-bar"></span><span>Assigned and in progress</span></div></article>
    <article class="metric-card"><div class="metric-top"><span class="metric-icon icon-green">${icon('check')}</span><span class="metric-trend positive-trend">On track</span></div><p class="metric-label">Resolved tickets</p><div class="metric-value">${resolved}<span class="metric-note">completed</span></div><div class="metric-footer"><span class="mini-bar green-bar"></span><span>Marked as resolved</span></div></article>
  </section>`;
}

function renderCreateDialog() {
  if (!state.isCreateOpen) return '';
  return `<div class="modal-backdrop" data-dismiss-dialog>
    <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="create-title">
      <div class="modal-heading"><div><span class="modal-icon">${icon('plus')}</span><div><h2 id="create-title">Create a ticket</h2><p>Log a new support request for your team.</p></div></div><button class="icon-button" aria-label="Close dialog" data-action="close-dialog">${icon('close')}</button></div>
      <form class="ticket-form" data-form="create">
        <label class="form-field full-field">Issue summary<input name="issue" placeholder="Briefly describe the issue" maxlength="120" required autofocus></label>
        <label class="form-field full-field">Description<textarea name="description" placeholder="Add details that will help the team resolve this request..." rows="3" maxlength="1000" required></textarea></label>
        <label class="form-field">Requester<input name="requester" placeholder="Full name" maxlength="80" required></label>
        <label class="form-field">Location<input name="location" placeholder="e.g. Lab 304" maxlength="80" required></label>
        <label class="form-field">Category<select name="category"><option>Hardware</option><option>Network</option><option>Software</option><option>Account access</option><option>Equipment</option><option>Other</option></select></label>
        <label class="form-field">Priority<select name="priority"><option>Low</option><option selected>Medium</option><option>High</option><option>Critical</option></select></label>
        <div class="form-actions"><button type="button" class="secondary-button" data-action="close-dialog">Cancel</button><button type="submit" class="primary-button" ${state.isSaving ? 'disabled' : ''}>${icon('plus', 16)} ${state.isSaving ? 'Creating...' : 'Create ticket'}</button></div>
      </form>
    </section>
  </div>`;
}

function renderDetailDialog(ticket) {
  if (!ticket) return '';
  const memberOptions = teamMembers.map((member) => `<option${ticket.assignee === member ? ' selected' : ''}>${escapeHtml(member)}</option>`).join('');
  const statusOptions = ['Open', 'In Progress', 'Resolved'].map((status) => `<option${ticket.status === status ? ' selected' : ''}>${status}</option>`).join('');
  return `<div class="modal-backdrop" data-dismiss-dialog>
    <section class="modal-card detail-card" role="dialog" aria-modal="true" aria-labelledby="detail-title">
      <div class="modal-heading"><div><span class="modal-icon">${icon(ticketIcon(ticket.category))}</span><div><p class="detail-id">${escapeHtml(ticket.id)} <span>·</span> ${escapeHtml(ticket.time)}</p><h2 id="detail-title">${escapeHtml(ticket.issue)}</h2></div></div><button class="icon-button" aria-label="Close dialog" data-action="close-dialog">${icon('close')}</button></div>
      <p class="detail-description">${escapeHtml(ticket.description)}</p>
      <div class="detail-meta"><div><span>Requester</span><strong>${escapeHtml(ticket.requester)}</strong></div><div><span>Location</span><strong>${escapeHtml(ticket.location)}</strong></div><div><span>Category</span><strong>${escapeHtml(ticket.category)}</strong></div><div><span>Priority</span><strong><span class="priority-badge priority-${escapeHtml(ticket.priority.toLowerCase())}"><span></span>${escapeHtml(ticket.priority)}</span></strong></div></div>
      <div class="detail-edit">
        <label class="form-field">Status<select data-ticket-field="status" data-ticket-id="${escapeHtml(ticket.id)}">${statusOptions}</select></label>
        <label class="form-field">Assignee<select data-ticket-field="assignee" data-ticket-id="${escapeHtml(ticket.id)}">${memberOptions}</select></label>
      </div>
      <div class="detail-footer"><span><span class="online-dot"></span> Updates appear in the queue immediately</span><button class="primary-button" data-action="close-dialog">Done</button></div>
    </section>
  </div>`;
}

function renderSetupMessage() {
  return `<main class="auth-page"><section class="auth-card"><span class="brand-mark">${icon('ticket', 21)}</span><h1>Firebase setup required</h1><p>Add your Firebase web app settings to <code>.env</code>, then restart the development server.</p><ul>${missingFirebaseConfig.map((key) => `<li><code>${escapeHtml(key)}</code></li>`).join('')}</ul><p>See <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer">Firebase Console</a> and the setup steps in README.md.</p></section></main>`;
}

function renderSignIn() {
  root.innerHTML = `<main class="auth-page"><section class="auth-card">
    <span class="brand-mark">${icon('ticket', 21)}</span>
    <p class="eyebrow">NATIONAL UNIVERSITY</p>
    <h1>Sign in to IT Ticketing</h1>
    <p class="page-subtitle">Use your staff Firebase Authentication account to access the ticket queue.</p>
    ${state.notice ? `<div class="notice error" role="alert">${escapeHtml(state.notice)}</div>` : ''}
    <form class="auth-form" data-form="sign-in">
      <label class="form-field">Email<input name="email" type="email" autocomplete="username" required></label>
      <label class="form-field">Password<input name="password" type="password" autocomplete="current-password" required></label>
      <button class="primary-button" type="submit" ${state.isSaving ? 'disabled' : ''}>${state.isSaving ? 'Signing in...' : 'Sign in'}</button>
    </form>
  </section></main>`;
}

function render() {
  if (!isFirebaseConfigured) {
    root.innerHTML = renderSetupMessage();
    return;
  }
  if (!state.isAuthReady) {
    root.innerHTML = '<main class="auth-page"><section class="auth-card"><p>Checking staff sign-in...</p></section></main>';
    return;
  }
  if (!state.user) {
    renderSignIn();
    return;
  }

  const counts = getCounts();
  const filteredTickets = getFilteredTickets();
  const openTickets = state.tickets.filter((ticket) => ticket.status !== 'Resolved');
  const locations = ['All locations', ...new Set(state.tickets.map((ticket) => ticket.location))];
  const selectedTicket = state.tickets.find((ticket) => ticket.id === state.selectedTicketId);
  const isDashboard = state.activeView === 'dashboard';
  const tableContent = state.isLoading
    ? '<div class="empty-state"><strong>Loading tickets...</strong></div>'
    : state.hasLoadError
      ? '<div class="empty-state"><strong>Ticket data is unavailable</strong><p>Check the database connection, then try again.</p><button data-action="retry">Try again</button></div>'
      : filteredTickets.length === 0
        ? `<div class="empty-state"><span class="empty-icon">${icon('search', 22)}</span><strong>No tickets found</strong><p>Try adjusting your search or filters.</p><button data-action="clear-filters">Clear filters</button></div>`
        : '';

  root.innerHTML = `<div class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="#dashboard" data-view="dashboard"><span class="brand-mark">${icon('ticket', 21)}</span><span class="brand-copy"><strong>National University</strong><small>IT TICKETING</small></span></a>
      <div class="workspace-label">WORKSPACE</div>
      <nav class="main-nav" aria-label="Main navigation">
        <button class="nav-item${isDashboard ? ' active' : ''}" data-view="dashboard">${icon('grid')}<span>Overview</span></button>
        <button class="nav-item${!isDashboard ? ' active' : ''}" data-view="tickets">${icon('ticket')}<span>Tickets</span><span class="nav-count">${openTickets.length}</span></button>
      </nav>
      <div class="sidebar-spacer"></div>
      <div class="sidebar-sla"><div class="sla-icon">${icon('alert', 17)}</div><p class="sla-title">Triage tip</p><p class="sla-value">Start with critical requests</p><p class="sla-caption">Issues affecting multiple people should be handled first.</p></div>
      <div class="profile"><div class="avatar avatar-profile">${escapeHtml(state.user.email.slice(0, 2).toUpperCase())}</div><div class="profile-copy"><strong>${escapeHtml(state.user.email)}</strong><span>IT Administrator</span></div><button class="icon-button profile-menu" aria-label="Sign out" data-action="sign-out">${icon('down', 15)}</button></div>
    </aside>
    <main class="main-area">
      <header class="topbar"><div class="breadcrumb"><span>Workspace</span>${icon('chevron', 14)}<strong>${isDashboard ? 'Overview' : 'Tickets'}</strong></div><div class="topbar-actions"><span class="system-status">Campus IT service desk</span><button class="icon-button notification-button" aria-label="Notifications">${icon('bell', 19)}<span class="notification-dot"></span></button><div class="avatar avatar-topbar">${escapeHtml(state.user.email.slice(0, 2).toUpperCase())}</div></div></header>
      <div class="page-content">
        <section class="page-heading"><div><p class="eyebrow">${isDashboard ? 'WEDNESDAY, OCTOBER 7' : 'SERVICE DESK'}</p><h1>${isDashboard ? 'Good morning, Prince' : 'Ticket queue'}</h1><p class="page-subtitle">${isDashboard ? 'Here’s what’s happening with your support desk today.' : 'Track, prioritize, and resolve your team’s support requests.'}</p></div><button class="primary-button" data-action="open-create">${icon('plus', 17)} Create ticket</button></section>
        ${state.notice ? `<div class="notice${state.notice.startsWith('Could not') ? ' error' : ''}" role="${state.notice.startsWith('Could not') ? 'alert' : 'status'}">${escapeHtml(state.notice)}<button data-action="dismiss-notice" aria-label="Dismiss notification">${icon('close', 15)}</button></div>` : ''}
        ${isDashboard ? renderMetrics(counts, openTickets) : ''}
        <section class="queue-panel">
          <div class="queue-heading"><div><h2>${isDashboard ? 'Ticket queue' : 'All tickets'}</h2><p>${isDashboard ? 'Keep an eye on incoming requests and priority issues.' : 'A complete view of all requests submitted to your team.'}</p></div><button class="export-button" data-action="export">${icon('arrow', 15)} Export</button></div>
          <div class="queue-controls"><div class="status-tabs" role="tablist" aria-label="Filter tickets by status">${statuses.map((status) => `<button role="tab" aria-selected="${state.activeStatus === status}" class="status-tab${state.activeStatus === status ? ' selected' : ''}" data-status="${escapeHtml(status)}">${escapeHtml(status)}<span class="tab-count">${counts[status]}</span></button>`).join('')}</div>
            <div class="filter-controls"><label class="search-box">${icon('search', 17)}<input data-search aria-label="Search tickets" placeholder="Search tickets..." value="${escapeHtml(state.search)}"><kbd>/</kbd></label>
              <label class="location-select">${icon('filter', 16)}<select data-location aria-label="Filter by location">${locations.map((item) => `<option${state.location === item ? ' selected' : ''}>${escapeHtml(item)}</option>`).join('')}</select>${icon('down', 14)}</label></div></div>
          <div class="table-wrap"><table class="ticket-table"><thead><tr><th>Ticket</th><th>Requester</th><th>Category</th><th>Priority</th><th>Status</th><th>Assignee</th><th>Updated</th><th><span class="sr-only">Open ticket</span></th></tr></thead><tbody>${filteredTickets.map(ticketRow).join('')}</tbody></table>${tableContent}</div>
          <div class="table-footer"><span>Showing <strong>${filteredTickets.length}</strong> of <strong>${state.tickets.length}</strong> tickets</span><span>Updated just now <span class="online-dot"></span></span></div>
        </section>
        <footer class="page-footer"><span>National University IT Ticketing</span><span>Need a hand? <a href="mailto:helpdesk@example.com">Contact IT support</a></span></footer>
      </div>
    </main>
    ${renderCreateDialog()}${renderDetailDialog(selectedTicket)}
  </div>`;
}

function exportTickets() {
  const columns = ['Ticket ID', 'Issue', 'Description', 'Requester', 'Location', 'Category', 'Priority', 'Status', 'Assignee', 'Updated'];
  const csvValue = (value) => `"${String(value).replace(/^[\s]*[=+\-@]/, "'$&").replaceAll('"', '""')}"`;
  const rows = getFilteredTickets().map((ticket) => [
    ticket.id, ticket.issue, ticket.description, ticket.requester, ticket.location,
    ticket.category, ticket.priority, ticket.status, ticket.assignee, ticket.time,
  ]);
  const csv = [columns, ...rows].map((row) => row.map(csvValue).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'national-university-tickets.csv';
  link.click();
  URL.revokeObjectURL(url);
  state.notice = `Exported ${rows.length} ${rows.length === 1 ? 'ticket' : 'tickets'} to CSV.`;
  render();
}

function loadTickets() {
  state.isLoading = true;
  state.hasLoadError = false;
  render();
  if (unsubscribeTickets) unsubscribeTickets();
  unsubscribeTickets = subscribeTickets((tickets) => {
    state.tickets = tickets;
    state.hasLoadError = false;
    state.isLoading = false;
    render();
  }, (error) => {
    state.hasLoadError = true;
    state.isLoading = false;
    state.notice = `Could not load tickets: ${firebaseError(error)}`;
    render();
  });
}

async function createTicket(form) {
  const formData = new FormData(form);
  const ticket = Object.fromEntries(['issue', 'description', 'category', 'location', 'requester', 'priority']
    .map((name) => [name, String(formData.get(name)).trim()]));
  state.isSaving = true;
  render();
  try {
    const newTicket = await saveNewTicket(ticket);
    state.activeStatus = 'All tickets';
    state.location = 'All locations';
    state.search = '';
    state.activeView = 'tickets';
    state.isCreateOpen = false;
    state.notice = `${newTicket.id} was created successfully.`;
  } catch (error) {
    state.notice = `Could not create ticket: ${firebaseError(error)}`;
  } finally {
    state.isSaving = false;
    render();
  }
}

async function updateTicket(id, updates) {
  try {
    await saveTicket(id, updates);
    state.notice = '';
  } catch (error) {
    state.notice = `Could not update ticket: ${firebaseError(error)}`;
  }
  render();
}

root.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const viewButton = target.closest('[data-view]');
  if (viewButton) {
    event.preventDefault();
    state.activeView = viewButton.dataset.view;
    render();
    return;
  }
  const ticketRowElement = target.closest('[data-ticket-open]');
  if (ticketRowElement) {
    state.selectedTicketId = ticketRowElement.dataset.ticketOpen;
    render();
    return;
  }
  const action = target.closest('[data-action]')?.dataset.action;
  if (action === 'open-create') {
    state.notice = '';
    state.isCreateOpen = true;
  } else if (action === 'sign-out') {
    signOut(auth).catch((error) => {
      state.notice = `Could not sign out: ${firebaseError(error)}`;
      render();
    });
  } else if (action === 'close-dialog' || (target.matches('[data-dismiss-dialog]'))) {
    state.isCreateOpen = false;
    state.selectedTicketId = null;
  } else if (action === 'dismiss-notice') {
    state.notice = '';
  } else if (action === 'clear-filters') {
    state.search = '';
    state.location = 'All locations';
    state.activeStatus = 'All tickets';
  } else if (action === 'retry') {
    state.notice = '';
    loadTickets();
    return;
  } else if (action === 'export') {
    exportTickets();
    return;
  } else {
    const statusButton = target.closest('[data-status]');
    if (statusButton) state.activeStatus = statusButton.dataset.status;
    else return;
  }
  render();
});

root.addEventListener('input', (event) => {
  if (!event.target.matches('[data-search]')) return;
  const cursorPosition = event.target.selectionStart;
  state.search = event.target.value;
  render();
  const searchInput = root.querySelector('[data-search]');
  searchInput.focus();
  searchInput.setSelectionRange(cursorPosition, cursorPosition);
});

root.addEventListener('change', (event) => {
  if (event.target.matches('[data-location]')) {
    state.location = event.target.value;
    render();
  } else if (event.target.matches('[data-ticket-field]')) {
    updateTicket(event.target.dataset.ticketId, { [event.target.dataset.ticketField]: event.target.value });
  }
});

root.addEventListener('submit', (event) => {
  if (event.target.matches('[data-form="sign-in"]')) {
    event.preventDefault();
    const formData = new FormData(event.target);
    state.isSaving = true;
    state.notice = '';
    render();
    signInWithEmailAndPassword(auth, formData.get('email'), formData.get('password'))
      .catch((error) => {
        state.notice = `Sign-in failed: ${firebaseError(error)}`;
      })
      .finally(() => {
        state.isSaving = false;
        render();
      });
    return;
  }
  if (!event.target.matches('[data-form="create"]')) return;
  event.preventDefault();
  createTicket(event.target);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && (state.isCreateOpen || state.selectedTicketId)) {
    state.isCreateOpen = false;
    state.selectedTicketId = null;
    render();
    return;
  }
  const isEditing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName);
  const isSearchShortcut = event.key === '/' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k');
  if (!isEditing && isSearchShortcut) {
    event.preventDefault();
    root.querySelector('[data-search]')?.focus();
  }
  if (!isEditing && event.key === 'Enter' && event.target.matches('[data-ticket-open]')) {
    state.selectedTicketId = event.target.dataset.ticketOpen;
    render();
  }
});

render();
if (isFirebaseConfigured) {
  onAuthStateChanged(auth, (user) => {
    state.user = user;
    state.isAuthReady = true;
    state.notice = '';
    if (unsubscribeTickets) {
      unsubscribeTickets();
      unsubscribeTickets = null;
    }
    if (user) {
      loadTickets();
    } else {
      state.tickets = [];
      state.isLoading = false;
      render();
    }
  }, (error) => {
    state.isAuthReady = true;
    state.notice = `Could not verify sign-in: ${firebaseError(error)}`;
    render();
  });
}
