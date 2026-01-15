document.addEventListener('DOMContentLoaded', () => {
    // Views
    const viewLogin = document.getElementById('view-login');
    const viewRegister1 = document.getElementById('view-register-1');
    const viewRegister2 = document.getElementById('view-register-2');
    const viewForgotPassword = document.getElementById('view-forgot-password');
    const viewAdminLogin = document.getElementById('view-admin-login');

    // Buttons
    const btnToRegister = document.getElementById('btn-to-register');
    const btnToLogin = document.getElementById('btn-to-login');
    const btnNextStep = document.getElementById('btn-next-step');
    const btnBackStep = document.getElementById('btn-back-step');
    const btnForgotPassword = document.getElementById('btn-forgot-password');
    const btnBackToLogin = document.getElementById('btn-back-to-login');
    const btnBackLoginLink = document.getElementById('btn-back-login-link');

    const btnToAdminLogin = document.getElementById('btn-to-admin-login');
    const btnBackToInstituteLogin = document.getElementById('btn-back-to-institute-login');

    // Forms
    const loginForm = viewLogin ? viewLogin.querySelector('form') : null;
    const adminLoginForm = viewAdminLogin ? viewAdminLogin.querySelector('form') : null;

    // Helper to switch views
    function switchView(fromView, toView) {
        if (fromView) fromView.classList.remove('active');
        if (toView) toView.classList.add('active');
    }

    // Event Listeners
    if (btnToRegister) btnToRegister.addEventListener('click', () => switchView(viewLogin, viewRegister1));
    if (btnToLogin) btnToLogin.addEventListener('click', () => switchView(viewRegister1, viewLogin));
    if (btnNextStep) btnNextStep.addEventListener('click', () => switchView(viewRegister1, viewRegister2));
    if (btnBackStep) btnBackStep.addEventListener('click', () => switchView(viewRegister2, viewRegister1));
    if (btnForgotPassword) btnForgotPassword.addEventListener('click', () => switchView(viewLogin, viewForgotPassword));
    if (btnBackToLogin) btnBackToLogin.addEventListener('click', () => switchView(viewForgotPassword, viewLogin));
    if (btnBackLoginLink) btnBackLoginLink.addEventListener('click', () => switchView(viewForgotPassword, viewLogin));

    // Admin Login Transitions
    if (btnToAdminLogin) btnToAdminLogin.addEventListener('click', () => switchView(viewLogin, viewAdminLogin));
    if (btnBackToInstituteLogin) btnBackToInstituteLogin.addEventListener('click', () => switchView(viewAdminLogin, viewLogin));

    // Institute Login Redirect
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            window.location.href = '../institute/dashboard.html';
        });
    }

    // Admin Login Redirect
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            window.location.href = '../admin/dashboard.html';
        });
    }
});
