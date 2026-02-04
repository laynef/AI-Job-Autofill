// Job Application Tracker - Main JavaScript

const JobTracker = {
    // Global state
    applications: [],
    currentEditId: null,
    currentViewId: null,

    // DOM Elements
    elements: {
        applicationsList: null,
        emptyState: null,
        jobModal: null,
        detailsModal: null,
        jobForm: null,
        statusFilter: null,
        searchInput: null,
        sortBy: null,
        // Stats
        totalApps: null,
        activeApps: null,
        interviewApps: null,
        offerApps: null
    },

    // Initialize
    async init() {
        this.cacheElements();
        this.setupEventListeners();
        this.loadApplications();
        
        // Show free app status - Non-blocking
        try {
            if (typeof AppManager !== 'undefined') {
                const appStatus = await AppManager.getStatus();
                const licenseInfoEl = document.getElementById('licenseInfo');
                if (licenseInfoEl && typeof UIUtils !== 'undefined') {
                    UIUtils.showFreeBadge(licenseInfoEl);
                }
            }
        } catch (e) {
            console.error("AppManager init error:", e);
        }
    },

    cacheElements() {
        this.elements = {
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
    },

    // Load applications from storage
    loadApplications() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['jobApplications'], (result) => {
                if (result.jobApplications) {
                    this.applications = result.jobApplications;
                }
                this.renderApplications();
                this.updateStats();
            });
        }
    },

    // Save applications to storage
    saveApplications() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ jobApplications: this.applications }, function() {
                if (chrome.runtime.lastError) {
                    console.error('Error saving applications:', chrome.runtime.lastError);
                }
            });
        }
    },

    // Setup event listeners
    setupEventListeners() {
        if (!document.getElementById('addJobBtn')) return; // Guard for testing environment without DOM

        // Add application buttons
        document.getElementById('addJobBtn')?.addEventListener('click', () => this.openModal());
        document.getElementById('addFirstJobBtn')?.addEventListener('click', () => this.openModal());

        // Modal controls
        document.getElementById('closeModal')?.addEventListener('click', () => this.closeModal());
        document.getElementById('cancelBtn')?.addEventListener('click', () => this.closeModal());
        document.getElementById('closeDetailsModal')?.addEventListener('click', () => this.closeDetailsModal());

        // Form submission
        this.elements.jobForm?.addEventListener('submit', (e) => this.handleFormSubmit(e));

        // Filters and search
        this.elements.statusFilter?.addEventListener('change', () => this.renderApplications());
        
        if (this.elements.searchInput && typeof PerformanceUtils !== 'undefined') {
            this.elements.searchInput.addEventListener('input', PerformanceUtils.debounce(() => this.renderApplications(), 300));
        } else {
             this.elements.searchInput?.addEventListener('input', () => this.renderApplications());
        }
        
        this.elements.sortBy?.addEventListener('change', () => this.renderApplications());

        // Close modals on background click
        this.elements.jobModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.jobModal) this.closeModal();
        });
        this.elements.detailsModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.detailsModal) this.closeDetailsModal();
        });

        // Details modal actions
        document.getElementById('editJobBtn')?.addEventListener('click', () => {
            this.closeDetailsModal();
            this.openModal(this.currentViewId);
        });
        document.getElementById('deleteJobBtn')?.addEventListener('click', () => this.deleteApplication());
    },

    // Open modal for add/edit
    openModal(id = null) {
        this.currentEditId = id;
        const modalTitle = document.getElementById('modalTitle');

        if (id) {
            if (modalTitle) modalTitle.textContent = 'Edit Application';
            const app = this.applications.find(a => a.id === id);
            if (app) {
                this.setInputValue('company', app.company);
                this.setInputValue('position', app.position);
                this.setInputValue('location', app.location);
                this.setInputValue('salary', app.salary);
                this.setInputValue('applicationDate', app.applicationDate);
                this.setInputValue('status', app.status || 'Applied');
                this.setInputValue('jobUrl', app.jobUrl);
                this.setInputValue('contactName', app.contactName);
                this.setInputValue('contactEmail', app.contactEmail);
                this.setInputValue('notes', app.notes);
            }
        } else {
            if (modalTitle) modalTitle.textContent = 'Add New Application';
            this.elements.jobForm?.reset();
            // Set default date to today
            const today = new Date().toISOString().split('T')[0];
            this.setInputValue('applicationDate', today);
        }

        this.elements.jobModal?.classList.add('active');
    },

    setInputValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    },

    // Close add/edit modal
    closeModal() {
        this.elements.jobModal?.classList.remove('active');
        this.elements.jobForm?.reset();
        this.currentEditId = null;
    },

    // Handle form submission
    handleFormSubmit(e) {
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

        if (this.currentEditId) {
            // Edit existing application
            const index = this.applications.findIndex(a => a.id === this.currentEditId);
            if (index !== -1) {
                const existingApp = this.applications[index];
                this.applications[index] = {
                    ...formData,
                    id: this.currentEditId,
                    createdAt: existingApp.createdAt,
                    updatedAt: new Date().toISOString(),
                    timeline: this.updateTimeline(existingApp, formData)
                };
            }
        } else {
            // Add new application
            const newApp = {
                ...formData,
                id: this.generateId(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                timeline: [{
                    status: formData.status,
                    date: formData.applicationDate,
                    note: 'Application submitted'
                }]
            };
            this.applications.push(newApp);
        }

        this.saveApplications();
        this.renderApplications();
        this.updateStats();
        this.closeModal();
    },

    // Update timeline when status changes
    updateTimeline(existingApp, newData) {
        const timeline = [...existingApp.timeline];

        if (existingApp.status !== newData.status) {
            timeline.push({
                status: newData.status,
                date: new Date().toISOString().split('T')[0],
                note: `Status changed to ${newData.status}`
            });
        }

        return timeline;
    },

    // Generate unique ID
    generateId() {
        if (typeof DataUtils !== 'undefined') {
            return DataUtils.generateId();
        }
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Render applications list
    renderApplications() {
        const filtered = this.getFilteredApplications();

        if (!this.elements.applicationsList) return;

        if (filtered.length === 0) {
            this.elements.applicationsList.style.display = 'none';
            this.elements.emptyState?.classList.add('visible');
            return;
        }

        this.elements.applicationsList.style.display = 'grid';
        this.elements.emptyState?.classList.remove('visible');

        this.elements.applicationsList.innerHTML = filtered.map(app => this.createApplicationCard(app)).join('');

        // Add event listeners to cards
        document.querySelectorAll('.application-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.card-btn')) {
                    this.openDetailsModal(card.dataset.id);
                }
            });
        });

        // Add event listeners to quick action buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openModal(btn.dataset.id);
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this application?')) {
                    const id = btn.dataset.id;
                    this.applications = this.applications.filter(a => a.id !== id);
                    this.saveApplications();
                    this.renderApplications();
                    this.updateStats();
                }
            });
        });
    },

    // Get filtered and sorted applications
    getFilteredApplications() {
        let filtered = [...this.applications];

        // Filter by status
        const statusFilter = this.elements.statusFilter?.value;
        if (statusFilter && statusFilter !== 'all') {
            filtered = filtered.filter(app => app.status === statusFilter);
        }

        // Filter by search
        const searchTerm = this.elements.searchInput?.value.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(app =>
                (app.company && app.company.toLowerCase().includes(searchTerm)) ||
                (app.position && app.position.toLowerCase().includes(searchTerm))
            );
        }

        // Sort
        const sortBy = this.elements.sortBy?.value;
        if (sortBy) {
            filtered.sort((a, b) => {
                switch (sortBy) {
                    case 'date-desc':
                        return new Date(b.applicationDate) - new Date(a.applicationDate);
                    case 'date-asc':
                        return new Date(a.applicationDate) - new Date(b.applicationDate);
                    case 'company':
                        return (a.company || '').localeCompare(b.company || '');
                    case 'status':
                        return (a.status || '').localeCompare(b.status || '');
                    default:
                        return 0;
                }
            });
        }

        return filtered;
    },

    // Create application card HTML
    createApplicationCard(app) {
        const daysSince = this.getDaysSinceApplication(app.applicationDate);
        const escapeHtml = (text) => typeof UIUtils !== 'undefined' ? UIUtils.escapeHtml(text) : text;

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
    },

    // Open details modal
    openDetailsModal(id) {
        this.currentViewId = id;
        const app = this.applications.find(a => a.id === id);
        if (!app) return;

        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el && typeof UIUtils !== 'undefined') UIUtils.setTextContent(el, text);
        };

        setText('detailsCompany', app.company);
        setText('detailsPosition', app.position);

        const statusBadge = document.getElementById('detailsStatusBadge');
        if (statusBadge) {
            statusBadge.textContent = app.status || '';
            statusBadge.className = `status-badge status-${app.status}`;
        }

        setText('detailsLocation', app.location || '-');
        setText('detailsSalary', app.salary || '-');
        setText('detailsDate', this.formatDate(app.applicationDate));
        setText('detailsDays', this.getDaysSinceApplication(app.applicationDate) + ' days');
        setText('detailsContact', app.contactName || '-');
        setText('detailsEmail', app.contactEmail || '-');

        // Job URL
        const urlContainer = document.getElementById('detailsUrlContainer');
        const urlLink = document.getElementById('detailsUrl');
        if (app.jobUrl) {
            if (urlLink) urlLink.href = app.jobUrl;
            if (urlContainer) urlContainer.style.display = 'flex';
        } else {
            if (urlContainer) urlContainer.style.display = 'none';
        }

        // Notes
        const notesContainer = document.getElementById('detailsNotesContainer');
        const notesText = document.getElementById('detailsNotes');
        if (app.notes) {
            if (notesText && typeof UIUtils !== 'undefined') UIUtils.setTextContent(notesText, app.notes);
            if (notesContainer) notesContainer.style.display = 'flex';
        } else {
            if (notesContainer) notesContainer.style.display = 'none';
        }

        // Timeline
        this.renderTimeline(app.timeline);

        this.elements.detailsModal?.classList.add('active');
    },

    // Close details modal
    closeDetailsModal() {
        this.elements.detailsModal?.classList.remove('active');
        this.currentViewId = null;
    },

    // Render timeline
    renderTimeline(timeline) {
        const timelineEl = document.getElementById('timeline');
        if (!timelineEl) return;

        if (!timeline || timeline.length === 0) {
            timelineEl.innerHTML = '<p style="color: #6b7280;">No timeline events yet.</p>';
            return;
        }

        const sortedTimeline = [...timeline].sort((a, b) => new Date(b.date) - new Date(a.date));
        const escapeHtml = (text) => typeof UIUtils !== 'undefined' ? UIUtils.escapeHtml(text) : text;
        const formatDate = (date) => this.formatDate(date);

        timelineEl.innerHTML = sortedTimeline.map(item => `
            <div class="timeline-item">
                <div class="timeline-item-header">
                    <span class="timeline-status">${escapeHtml(item.status)}</span>
                    <span class="timeline-date">${formatDate(item.date)}</span>
                </div>
                ${item.note ? `<div class="timeline-note">${escapeHtml(item.note)}</div>` : ''}
            </div>
        `).join('');
    },

    // Delete application
    deleteApplication() {
        if (!this.currentViewId) return;

        if (confirm('Are you sure you want to delete this application? This cannot be undone.')) {
            this.applications = this.applications.filter(a => a.id !== this.currentViewId);
            this.saveApplications();
            this.renderApplications();
            this.updateStats();
            this.closeDetailsModal();
        }
    },

    // Update statistics
    updateStats() {
        if (!this.elements.totalApps) return;

        this.elements.totalApps.textContent = this.applications.length;

        const activeStatuses = ['Applied', 'Screening', 'Interview', 'Technical', 'Final'];
        if (this.elements.activeApps) {
            this.elements.activeApps.textContent = this.applications.filter(a => activeStatuses.includes(a.status)).length;
        }

        const interviewStatuses = ['Interview', 'Technical', 'Final'];
        if (this.elements.interviewApps) {
            this.elements.interviewApps.textContent = this.applications.filter(a => interviewStatuses.includes(a.status)).length;
        }

        if (this.elements.offerApps) {
            this.elements.offerApps.textContent = this.applications.filter(a => a.status === 'Offer').length;
        }
    },

    // Utility functions
    getDaysSinceApplication(dateStr) {
        if (typeof DataUtils !== 'undefined') {
            return DataUtils.getDaysSince(dateStr);
        }
        if (!dateStr) return 0;
        const diff = new Date() - new Date(dateStr);
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    },

    formatDate(dateStr) {
        if (typeof DataUtils !== 'undefined') {
            return DataUtils.formatDate(dateStr);
        }
        return dateStr;
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    JobTracker.init();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { JobTracker };
}

