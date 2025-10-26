// Job Application Tracker - Main JavaScript

// Global state
let applications = [];
let currentEditId = null;
let currentViewId = null;

// Subscription verification for ad management
function validateSubscriptionKey(key) {
    return key && key.startsWith('HA-') && key.length >= 23;
}

function isSubscriptionExpired(activationDate) {
    if (!activationDate) return true;
    const daysSinceActivation = (Date.now() - new Date(activationDate).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceActivation > 31;
}

function checkSubscription() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['subscriptionKey', 'subscriptionActive', 'subscriptionStartDate'], function(result) {
            if (result.subscriptionActive && result.subscriptionKey && validateSubscriptionKey(result.subscriptionKey)) {
                if (isSubscriptionExpired(result.subscriptionStartDate)) {
                    resolve({ isPaid: false }); // Expired = show ads
                    return;
                }
                resolve({ isPaid: true }); // Active = no ads
                return;
            }
            resolve({ isPaid: false }); // Free user = show ads
        });
    });
}

// Show or hide ads based on subscription status
function manageAdVisibility(isPaid) {
    const adContainers = document.querySelectorAll('.ad-container');
    adContainers.forEach(container => {
        container.style.display = isPaid ? 'none' : 'flex';
    });
}

// DOM Elements
const elements = {
    applicationsList: document.getElementById('applicationsList'),
    emptyState: document.getElementById('emptyState'),
    jobModal: document.getElementById('jobModal'),
    detailsModal: document.getElementById('detailsModal'),
    jobForm: document.getElementById('jobForm'),
    statusFilter: document.getElementById('statusFilter'),
    searchInput: document.getElementById('searchInput'),
    sortBy: document.getElementById('sortBy'),
    // Stats
    totalApps: document.getElementById('totalApps'),
    activeApps: document.getElementById('activeApps'),
    interviewApps: document.getElementById('interviewApps'),
    offerApps: document.getElementById('offerApps')
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
    // Check subscription and manage ad visibility
    const subscriptionStatus = await checkSubscription();
    manageAdVisibility(subscriptionStatus.isPaid);

    setupEventListeners();
    loadApplications();
});

// Load applications from storage
function loadApplications() {
    chrome.storage.local.get(['jobApplications'], function(result) {
        if (result.jobApplications) {
            applications = result.jobApplications;
        }
        renderApplications();
        updateStats();
    });
}

// Save applications to storage
function saveApplications() {
    chrome.storage.local.set({ jobApplications: applications }, function() {
        if (chrome.runtime.lastError) {
            console.error('Error saving applications:', chrome.runtime.lastError);
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    // Add application buttons
    document.getElementById('addJobBtn').addEventListener('click', () => openModal());
    document.getElementById('addFirstJobBtn').addEventListener('click', () => openModal());

    // Modal controls
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);
    document.getElementById('closeDetailsModal').addEventListener('click', closeDetailsModal);

    // Form submission
    elements.jobForm.addEventListener('submit', handleFormSubmit);

    // Filters and search
    elements.statusFilter.addEventListener('change', renderApplications);
    elements.searchInput.addEventListener('input', renderApplications);
    elements.sortBy.addEventListener('change', renderApplications);

    // Close modals on background click
    elements.jobModal.addEventListener('click', function(e) {
        if (e.target === elements.jobModal) closeModal();
    });
    elements.detailsModal.addEventListener('click', function(e) {
        if (e.target === elements.detailsModal) closeDetailsModal();
    });

    // Details modal actions
    document.getElementById('editJobBtn').addEventListener('click', function() {
        closeDetailsModal();
        openModal(currentViewId);
    });
    document.getElementById('deleteJobBtn').addEventListener('click', deleteApplication);
}

// Open modal for add/edit
function openModal(id = null) {
    currentEditId = id;
    const modalTitle = document.getElementById('modalTitle');

    if (id) {
        modalTitle.textContent = 'Edit Application';
        const app = applications.find(a => a.id === id);
        if (app) {
            document.getElementById('company').value = app.company || '';
            document.getElementById('position').value = app.position || '';
            document.getElementById('location').value = app.location || '';
            document.getElementById('salary').value = app.salary || '';
            document.getElementById('applicationDate').value = app.applicationDate || '';
            document.getElementById('status').value = app.status || 'Applied';
            document.getElementById('jobUrl').value = app.jobUrl || '';
            document.getElementById('contactName').value = app.contactName || '';
            document.getElementById('contactEmail').value = app.contactEmail || '';
            document.getElementById('notes').value = app.notes || '';
        }
    } else {
        modalTitle.textContent = 'Add New Application';
        elements.jobForm.reset();
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('applicationDate').value = today;
    }

    elements.jobModal.classList.add('active');
}

// Close add/edit modal
function closeModal() {
    elements.jobModal.classList.remove('active');
    elements.jobForm.reset();
    currentEditId = null;
}

// Handle form submission
function handleFormSubmit(e) {
    e.preventDefault();

    const formData = {
        company: document.getElementById('company').value.trim(),
        position: document.getElementById('position').value.trim(),
        location: document.getElementById('location').value.trim(),
        salary: document.getElementById('salary').value.trim(),
        applicationDate: document.getElementById('applicationDate').value,
        status: document.getElementById('status').value,
        jobUrl: document.getElementById('jobUrl').value.trim(),
        contactName: document.getElementById('contactName').value.trim(),
        contactEmail: document.getElementById('contactEmail').value.trim(),
        notes: document.getElementById('notes').value.trim()
    };

    if (currentEditId) {
        // Edit existing application
        const index = applications.findIndex(a => a.id === currentEditId);
        if (index !== -1) {
            const existingApp = applications[index];
            applications[index] = {
                ...formData,
                id: currentEditId,
                createdAt: existingApp.createdAt,
                updatedAt: new Date().toISOString(),
                timeline: updateTimeline(existingApp, formData)
            };
        }
    } else {
        // Add new application
        const newApp = {
            ...formData,
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            timeline: [{
                status: formData.status,
                date: formData.applicationDate,
                note: 'Application submitted'
            }]
        };
        applications.push(newApp);
    }

    saveApplications();
    renderApplications();
    updateStats();
    closeModal();
}

// Update timeline when status changes
function updateTimeline(existingApp, newData) {
    const timeline = [...existingApp.timeline];

    if (existingApp.status !== newData.status) {
        timeline.push({
            status: newData.status,
            date: new Date().toISOString().split('T')[0],
            note: `Status changed to ${newData.status}`
        });
    }

    return timeline;
}

// Generate unique ID
function generateId() {
    return 'app_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Render applications list
function renderApplications() {
    const filtered = getFilteredApplications();

    if (filtered.length === 0) {
        elements.applicationsList.style.display = 'none';
        elements.emptyState.classList.add('visible');
        return;
    }

    elements.applicationsList.style.display = 'grid';
    elements.emptyState.classList.remove('visible');

    elements.applicationsList.innerHTML = filtered.map(app => createApplicationCard(app)).join('');

    // Add event listeners to cards
    document.querySelectorAll('.application-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (!e.target.closest('.card-btn')) {
                openDetailsModal(this.dataset.id);
            }
        });
    });

    // Add event listeners to quick action buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            openModal(this.dataset.id);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this application?')) {
                const id = this.dataset.id;
                applications = applications.filter(a => a.id !== id);
                saveApplications();
                renderApplications();
                updateStats();
            }
        });
    });
}

// Get filtered and sorted applications
function getFilteredApplications() {
    let filtered = [...applications];

    // Filter by status
    const statusFilter = elements.statusFilter.value;
    if (statusFilter !== 'all') {
        filtered = filtered.filter(app => app.status === statusFilter);
    }

    // Filter by search
    const searchTerm = elements.searchInput.value.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(app =>
            app.company.toLowerCase().includes(searchTerm) ||
            app.position.toLowerCase().includes(searchTerm)
        );
    }

    // Sort
    const sortBy = elements.sortBy.value;
    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'date-desc':
                return new Date(b.applicationDate) - new Date(a.applicationDate);
            case 'date-asc':
                return new Date(a.applicationDate) - new Date(b.applicationDate);
            case 'company':
                return a.company.localeCompare(b.company);
            case 'status':
                return a.status.localeCompare(b.status);
            default:
                return 0;
        }
    });

    return filtered;
}

// Create application card HTML
function createApplicationCard(app) {
    const daysSince = getDaysSinceApplication(app.applicationDate);

    return `
        <div class="application-card" data-id="${app.id}">
            <div class="card-header">
                <div class="card-title">
                    <h3>${escapeHtml(app.company)}</h3>
                    <p>${escapeHtml(app.position)}</p>
                </div>
                <span class="status-badge status-${app.status}">${app.status}</span>
            </div>
            <div class="card-details">
                ${app.location ? `
                    <div class="card-detail">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                        ${escapeHtml(app.location)}
                    </div>
                ` : ''}
                <div class="card-detail">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    Applied ${daysSince} day${daysSince !== 1 ? 's' : ''} ago
                </div>
                ${app.salary ? `
                    <div class="card-detail">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        ${escapeHtml(app.salary)}
                    </div>
                ` : ''}
            </div>
            <div class="card-actions">
                <button class="card-btn edit-btn" data-id="${app.id}">Edit</button>
                <button class="card-btn delete-btn" data-id="${app.id}">Delete</button>
            </div>
        </div>
    `;
}

// Open details modal
function openDetailsModal(id) {
    currentViewId = id;
    const app = applications.find(a => a.id === id);
    if (!app) return;

    document.getElementById('detailsCompany').textContent = app.company;
    document.getElementById('detailsPosition').textContent = app.position;

    const statusBadge = document.getElementById('detailsStatusBadge');
    statusBadge.textContent = app.status;
    statusBadge.className = `status-badge status-${app.status}`;

    document.getElementById('detailsLocation').textContent = app.location || '-';
    document.getElementById('detailsSalary').textContent = app.salary || '-';
    document.getElementById('detailsDate').textContent = formatDate(app.applicationDate);
    document.getElementById('detailsDays').textContent = getDaysSinceApplication(app.applicationDate) + ' days';
    document.getElementById('detailsContact').textContent = app.contactName || '-';
    document.getElementById('detailsEmail').textContent = app.contactEmail || '-';

    // Job URL
    const urlContainer = document.getElementById('detailsUrlContainer');
    const urlLink = document.getElementById('detailsUrl');
    if (app.jobUrl) {
        urlLink.href = app.jobUrl;
        urlContainer.style.display = 'flex';
    } else {
        urlContainer.style.display = 'none';
    }

    // Notes
    const notesContainer = document.getElementById('detailsNotesContainer');
    const notesText = document.getElementById('detailsNotes');
    if (app.notes) {
        notesText.textContent = app.notes;
        notesContainer.style.display = 'flex';
    } else {
        notesContainer.style.display = 'none';
    }

    // Timeline
    renderTimeline(app.timeline);

    elements.detailsModal.classList.add('active');
}

// Close details modal
function closeDetailsModal() {
    elements.detailsModal.classList.remove('active');
    currentViewId = null;
}

// Render timeline
function renderTimeline(timeline) {
    const timelineEl = document.getElementById('timeline');

    if (!timeline || timeline.length === 0) {
        timelineEl.innerHTML = '<p style="color: #6b7280;">No timeline events yet.</p>';
        return;
    }

    const sortedTimeline = [...timeline].sort((a, b) => new Date(b.date) - new Date(a.date));

    timelineEl.innerHTML = sortedTimeline.map(item => `
        <div class="timeline-item">
            <div class="timeline-item-header">
                <span class="timeline-status">${escapeHtml(item.status)}</span>
                <span class="timeline-date">${formatDate(item.date)}</span>
            </div>
            ${item.note ? `<div class="timeline-note">${escapeHtml(item.note)}</div>` : ''}
        </div>
    `).join('');
}

// Delete application
function deleteApplication() {
    if (!currentViewId) return;

    if (confirm('Are you sure you want to delete this application? This cannot be undone.')) {
        applications = applications.filter(a => a.id !== currentViewId);
        saveApplications();
        renderApplications();
        updateStats();
        closeDetailsModal();
    }
}

// Update statistics
function updateStats() {
    elements.totalApps.textContent = applications.length;

    const activeStatuses = ['Applied', 'Screening', 'Interview', 'Technical', 'Final'];
    elements.activeApps.textContent = applications.filter(a => activeStatuses.includes(a.status)).length;

    const interviewStatuses = ['Interview', 'Technical', 'Final'];
    elements.interviewApps.textContent = applications.filter(a => interviewStatuses.includes(a.status)).length;

    elements.offerApps.textContent = applications.filter(a => a.status === 'Offer').length;
}

// Utility functions
function getDaysSinceApplication(dateStr) {
    const appDate = new Date(dateStr);
    const today = new Date();
    const diffTime = Math.abs(today - appDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export data function (for future use)
function exportApplications() {
    const dataStr = JSON.stringify(applications, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `job-applications-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
}
