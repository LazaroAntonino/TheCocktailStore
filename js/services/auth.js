// Servicio de autenticación
const AuthService = {
  // Almacenamiento de tokens
  setTokens(accessToken, refreshToken) {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  },

  getAccessToken() {
    return localStorage.getItem('accessToken');
  },

  getRefreshToken() {
    return localStorage.getItem('refreshToken');
  },

  clearTokens() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  },

  // Almacenamiento de usuario
  setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
  },

  getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  isAuthenticated() {
    return !!this.getAccessToken();
  },

  // API calls
  async register(email, password, name) {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error en el registro');
    }

    this.setTokens(data.accessToken, data.refreshToken);
    this.setUser(data.user);

    return data;
  },

  async login(email, password) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error en el login');
    }

    this.setTokens(data.accessToken, data.refreshToken);
    this.setUser(data.user);

    return data;
  },

  async logout() {
    const refreshToken = this.getRefreshToken();

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
    } catch (error) {
      console.error('Error en logout:', error);
    }

    this.clearTokens();
  },

  async refreshAccessToken() {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    const data = await response.json();

    if (!response.ok) {
      this.clearTokens();
      throw new Error(data.error || 'Error al refrescar token');
    }

    localStorage.setItem('accessToken', data.accessToken);
    return data.accessToken;
  },

  // Fetch con autenticación automática
  async authFetch(url, options = {}) {
    let accessToken = this.getAccessToken();

    if (!accessToken) {
      throw new Error('No autenticado');
    }

    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`
    };

    let response = await fetch(url, options);

    // Si el token expiró, intentar refrescar
    if (response.status === 403 || response.status === 401) {
      try {
        accessToken = await this.refreshAccessToken();
        options.headers['Authorization'] = `Bearer ${accessToken}`;
        response = await fetch(url, options);
      } catch (error) {
        this.clearTokens();
        window.location.href = '/login.html';
        throw error;
      }
    }

    return response;
  }
};

// Exportar para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthService;
}
