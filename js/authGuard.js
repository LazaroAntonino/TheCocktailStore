// Guard de autenticación - incluir en páginas protegidas
(function() {
  // Verificar si el usuario está autenticado
  const accessToken = localStorage.getItem('accessToken');
  
  if (!accessToken) {
    // Guardar URL actual para redirigir después del login
    const currentUrl = window.location.pathname + window.location.search;
    window.location.href = `/login.html?return=${encodeURIComponent(currentUrl)}`;
  }
})();
