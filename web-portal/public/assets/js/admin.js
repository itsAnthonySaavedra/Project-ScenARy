function switchAdminView(viewName) {
    const views = document.querySelectorAll('.admin-view');
    views.forEach(view => view.style.display = 'none');

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));

    const view = document.getElementById('view-' + viewName);
    if (view) {
        view.style.display = 'block';
        const navItem = Array.from(navItems).find(item => item.getAttribute('onclick') && item.getAttribute('onclick').includes(viewName));
        if (navItem) navItem.classList.add('active');
    }
}
