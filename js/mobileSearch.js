/**
 * Funcionalidad de búsqueda móvil
 * Script compartido para todas las páginas
 */
(function() {
  'use strict';
  
  function initMobileSearch() {
    const searchToggle = document.querySelector('.nav__search-toggle');
    const mobileSearch = document.querySelector('.nav__search-mobile');
    const searchInput = mobileSearch?.querySelector('input');
    
    if (!searchToggle || !mobileSearch) return;

    // Toggle búsqueda móvil
    searchToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      mobileSearch.classList.toggle('active');
      if (mobileSearch.classList.contains('active') && searchInput) {
        setTimeout(() => searchInput.focus(), 100);
      }
    });

    // Cerrar al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!mobileSearch.contains(e.target) && !searchToggle.contains(e.target)) {
        mobileSearch.classList.remove('active');
      }
    });

    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        mobileSearch.classList.remove('active');
      }
    });
    
    // Sincronizar búsqueda móvil con la búsqueda principal
    const mainSearchInput = document.querySelector('.nav__search-input');
    const mobileSearchInput = document.querySelector('.nav__search-mobile-input');
    
    if (mainSearchInput && mobileSearchInput) {
      // Copiar valor cuando se cambie
      mobileSearchInput.addEventListener('input', () => {
        mainSearchInput.value = mobileSearchInput.value;
        // Disparar evento input para que otros listeners lo detecten
        mainSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      
      // Búsqueda al presionar Enter
      mobileSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          mainSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
          mobileSearch.classList.remove('active');
        }
      });
      
      // Botón de búsqueda móvil
      const mobileSearchBtn = document.querySelector('.nav__search-mobile-btn');
      if (mobileSearchBtn) {
        mobileSearchBtn.addEventListener('click', () => {
          mainSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
          mobileSearch.classList.remove('active');
        });
      }
    }
  }
  
  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileSearch);
  } else {
    initMobileSearch();
  }
})();
