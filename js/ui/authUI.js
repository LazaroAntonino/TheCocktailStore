// UI de autenticación
const AuthUI = {
  init() {
    this.updateNavbar();
    this.setupEventListeners();
    this.setupPasswordToggles();
  },

  updateNavbar() {
    const user = AuthService.getUser();
    const authContainer = document.getElementById('auth-nav');
    
    if (!authContainer) return;

    if (user) {
      authContainer.innerHTML = `
        <div class="user-menu">
          <span class="user-name">Hola, ${user.name}</span>
          <button id="logout-btn" class="btn-logout">Cerrar sesión</button>
        </div>
      `;
      
      document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await AuthService.logout();
        window.location.href = '/index.html';
      });
    } else {
      authContainer.innerHTML = `
        <a href="/login.html" class="btn-auth">Iniciar sesión</a>
        <a href="/register.html" class="btn-auth btn-register">Registrarse</a>
      `;
    }
  },

  setupEventListeners() {
    // Formulario de login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleLogin(e);
      });
    }

    // Formulario de registro
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleRegister(e);
      });
    }
  },

  setupPasswordToggles() {
    const toggleButtons = document.querySelectorAll('.password-toggle');
    
    toggleButtons.forEach(button => {
      button.addEventListener('click', () => {
        const wrapper = button.closest('.password-wrapper');
        const input = wrapper.querySelector('input');
        const icon = button.querySelector('i');
        
        if (input.type === 'password') {
          input.type = 'text';
          icon.classList.remove('fa-eye');
          icon.classList.add('fa-eye-slash');
        } else {
          input.type = 'password';
          icon.classList.remove('fa-eye-slash');
          icon.classList.add('fa-eye');
        }
      });
    });
  },

  async handleLogin(e) {
    const form = e.target;
    const email = form.querySelector('#email').value;
    const password = form.querySelector('#password').value;
    const errorDiv = document.getElementById('auth-error');
    const submitBtn = form.querySelector('button[type="submit"]');

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Iniciando sesión...';
      errorDiv.textContent = '';

      await AuthService.login(email, password);

      // Evento GA4 para login
      if (window.dataLayer) {
        dataLayer.push({
          event: 'login',
          method: 'email'
        });
      }

      // Redirigir a página anterior o inicio
      const returnUrl = new URLSearchParams(window.location.search).get('return') || '/index.html';
      window.location.href = returnUrl;

    } catch (error) {
      errorDiv.textContent = error.message;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Iniciar sesión';
    }
  },

  async handleRegister(e) {
    const form = e.target;
    const name = form.querySelector('#name').value;
    const email = form.querySelector('#email').value;
    const password = form.querySelector('#password').value;
    const confirmPassword = form.querySelector('#confirm-password').value;
    const errorDiv = document.getElementById('auth-error');
    const submitBtn = form.querySelector('button[type="submit"]');

    // Validar contraseñas
    if (password !== confirmPassword) {
      errorDiv.textContent = 'Las contraseñas no coinciden';
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Registrando...';
      errorDiv.textContent = '';

      await AuthService.register(email, password, name);

      // Evento GA4 para registro
      if (window.dataLayer) {
        dataLayer.push({
          event: 'sign_up',
          method: 'email'
        });
      }

      // Redirigir a página de inicio
      window.location.href = '/index.html';

    } catch (error) {
      errorDiv.textContent = error.message;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Registrarse';
    }
  },

  showError(message) {
    const errorDiv = document.getElementById('auth-error');
    if (errorDiv) {
      errorDiv.textContent = message;
    }
  }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  AuthUI.init();
});
