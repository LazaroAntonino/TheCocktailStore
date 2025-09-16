import { products } from "../data/products.js";
import { cartService } from "../services/cart.js";

export class ProductsUI {
  constructor() {
    this.products = products;
    this.filteredProducts = [...products];
    this.currentCategory = "all";

    this.productsGrid = document.querySelector(".products__grid");
    this.filterButtons = document.querySelectorAll(".filter__button");
    this.searchInput = document.querySelector(".nav__search-input");

    this.handleFilter = this.handleFilter.bind(this);
    this.handleSearch = this.handleSearch.bind(this);
    this.handleAddToCart = this.handleAddToCart.bind(this);

    this.setupEventListeners();
    this.renderProducts();
  }

  setupEventListeners() {
    this.filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.handleFilter(button.dataset.filter);
      });
    });

    this.searchInput.addEventListener("input", this.handleSearch);

    this.productsGrid.addEventListener("click", (e) => {
      const addButton = e.target.closest(".product__button");
      if (addButton) {
        const productId = parseInt(addButton.dataset.id);
        const product = this.products.find((p) => p.id === productId);
        if (product) {
          this.handleAddToCart(product);
        }
      }
    });
  }

  handleFilter(category) {
    this.currentCategory = category;
    this.filterButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.filter === category);
    });

    this.applyFilters();
  }

  handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    this.applyFilters(searchTerm);
  }

  applyFilters(searchTerm = "") {
    this.filteredProducts = this.products.filter((product) => {
      const matchesCategory =
        this.currentCategory === "all" ||
        product.category === this.currentCategory;
      const matchesSearch =
        product.name.toLowerCase().includes(searchTerm) ||
        product.description.toLowerCase().includes(searchTerm);
      return matchesCategory && matchesSearch;
    });

    this.renderProducts();
  }

  handleAddToCart(product) {
    cartService.addItem(product);

    const button = this.productsGrid.querySelector(`[data-id="${product.id}"]`);
    if (button) {
      button.textContent = "¡Añadido!";
      button.classList.add("added");
      setTimeout(() => {
        button.textContent = "Añadir al Carrito";
        button.classList.remove("added");
      }, 1500);
    }
  }

  renderProducts() {
    this.productsGrid.innerHTML = this.filteredProducts
      .map(
        (product) => `
            <article class="product__card">
                <a href="product.html?id=${product.id
          }" class="product__img-link" id="${product.id}-${product.name}">
                    <img src="${product.image}" alt="${product.name
          }" class="product__img" onclick="
                    dataLayer.push({
                      event: 'product_details_view',
                      event_category: 'ecommerce',
                      event_action: 'view_product_card_details',
                      event_label: '${product.name}',
                      product_id: '${product.id}',
                      product_name: '${product.name}',
                      product_price: '${product.price.toFixed(2)}',
                      product_list_position: '${product.id}', // Usar la posición calculada
                      currency: 'USD',
                      link_url: 'product.html?id=${product.id}'
                    });
                  " >
                </a>
                <div class="product__content">
                    <h3 class="product__title">
                        <a href="product.html?id=${product.id}" onclick="
                    dataLayer.push({
                      event: 'product_details_view',
                      event_category: 'ecommerce',
                      event_action: 'view_product_text_details',
                      event_label: '${product.name}',
                      product_id: '${product.id}',
                      product_name: '${product.name}',
                      product_price: '${product.price.toFixed(2)}',
                      product_list_position: '${product.id}', // Usar la posición calculada
                      currency: 'USD',
                      link_url: 'product.html?id=${product.id}'
                    });
                  ">${product.name
          } ${product.name}"</a>
                    </h3>
                    <p class="product__description">${product.description}</p>
                    <p class="product__price">$${product.price.toFixed(2)}</p>
                    <div class="product__buttons">
                        <a href="product.html?id=${product.id
          }" onclick="
                    dataLayer.push({
                      event: 'product_details_view',
                      event_category: 'ecommerce',
                      event_action: 'view_product_button_details',
                      event_label: '${product.name}',
                      product_id: '${product.id}',
                      product_name: '${product.name}',
                      product_price: '${product.price.toFixed(2)}',
                      product_list_position: '${product.id}', // Usar la posición calculada
                      currency: 'USD',
                      link_url: 'product.html?id=${product.id}'
                    });
                  " class="button button--secondary" 
                        })} id="${product.id}-${product.name}">Ver Detalles Producto</a>
                        <button class="button product__button" onclick="
                    dataLayer.push({
                      event: 'add_to_cart',
                      event_category: 'ecommerce',
                      event_action: 'add_to_cart_card',
                      event_label: 'add_to_cart',
                      product_id: '${product.id}',
                      product_name: '${product.name}',
                      product_price: '${product.price.toFixed(2)}',
                      product_list_position: '${product.id}', // Usar la posición calculada
                      currency: 'USD',
                    });
                  " data-id="${product.id
          }">
                            <i class="fas fa-cart-plus"></i>
                        </button>
                    </div>
                </div>
            </article>
        `
      )
      .join("");

    if (!document.getElementById("productsStyles")) {
      const styles = document.createElement("style");
      styles.id = "productsStyles";
      styles.textContent = `
        .product__card {
            background: var(--bg-color);
            border-radius: 1rem;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,.1);
            transition: .3s;
        }

        .product__card:hover {
            transform: translateY(-5px);
        }

        .product__img {
            width: 100%;
            height: 200px;
            object-fit: cover;
        }

        .product__content {
            padding: 1.5rem;
        }

        .product__title {
            font-size: var(--h3-font-size);
            margin-bottom: var(--mb-1);
        }

        .product__description {
            color: var(--text-color-light);
            margin-bottom: var(--mb-2);
            font-size: var(--small-font-size);
        }

        .product__price {
            color: var(--primary-color);
            font-size: var(--h2-font-size);
            font-weight: 600;
            margin-bottom: var(--mb-2);
        }

        .product__button {
            width: 100%;
        }

        .product__button.added {
            background-color: var(--secondary-color);
        }
    `;
      document.head.appendChild(styles);
    }
  }
}

export const productsUI = new ProductsUI();
