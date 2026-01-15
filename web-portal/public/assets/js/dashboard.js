function switchDashboardView(viewName) {
    const views = document.querySelectorAll('.dashboard-view');
    views.forEach(view => view.style.display = 'none');

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));

    const view = document.getElementById('view-' + viewName);
    if (view) {
        view.style.display = 'block';

        // Handle sub-views for navigation highlighting
        let navViewName = viewName;
        if (viewName.includes('analytics-')) {
            navViewName = 'analytics';
        }

        // Find the nav item that calls this function with this viewName
        const navItem = Array.from(navItems).find(item => item.getAttribute('onclick') && item.getAttribute('onclick').includes("'" + navViewName + "'"));
        if (navItem) navItem.classList.add('active');

        // Update Header Title
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) {
            if (viewName === 'dashboard') {
                pageTitle.textContent = 'Good Morning, Curator';
            } else if (viewName === 'content-management') {
                pageTitle.textContent = 'Institute Content Management info';
            } else if (viewName === 'analytics') {
                pageTitle.textContent = 'View Data';
            } else if (viewName === 'analytics-engagement') {
                pageTitle.textContent = ''; // Title is in the back-nav
                // Initialize charts if not already done (simple check)
                if (!window.engagementChartsInitialized) {
                    initEngagementCharts();
                    window.engagementChartsInitialized = true;
                }
            } else if (viewName === 'settings') {
                pageTitle.textContent = 'Institute Settings';
            } else {
                pageTitle.textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1);
            }
        }
    }
}

function initEngagementCharts() {
    // Daily Report (Line)
    const ctxDaily = document.getElementById('chartDailyReport').getContext('2d');
    new Chart(ctxDaily, {
        type: 'line',
        data: {
            labels: ['2025-2', '2025-3', '2025-4', '2025-5', '2025-6'],
            datasets: [{
                data: [20, 35, 33, 45, 55],
                borderColor: '#855e2e',
                borderWidth: 2,
                tension: 0,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { display: false },
                x: {
                    grid: { display: false },
                    ticks: { color: '#a8a29e', font: { size: 10 } }
                }
            },
            plugins: { legend: { display: false } }
        }
    });

    // Engagement Type (Pie)
    const ctxType = document.getElementById('chartEngagementType').getContext('2d');
    new Chart(ctxType, {
        type: 'pie',
        data: {
            labels: ['Fact', 'Info', 'Quiz'],
            datasets: [{
                data: [30, 15, 55],
                backgroundColor: ['#4a4a4a', '#d4af37', '#855e2e'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });

    // Monthly Report (Line)
    const ctxMonthly = document.getElementById('chartMonthlyReport').getContext('2d');
    new Chart(ctxMonthly, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
            datasets: [{
                data: [10, 10, 25, 40, 40],
                borderColor: '#855e2e',
                borderWidth: 2,
                tension: 0,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { display: false },
                x: { display: false }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}
