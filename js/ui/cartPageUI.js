import { cartService } from "../services/cart.js";

export class CartPageUI {
  constructor() {
    this.cartItems = document.querySelector(".cart-items");
    this.cartEmpty = document.querySelector(".cart-empty");
    this.subtotalElement = document.querySelector(".cart-subtotal");
    this.totalElement = document.querySelector(".cart-total");
    this.checkoutButton = document.querySelector(".checkout-button");

    this.setupEventListeners();

    this.updateCartUI(cartService.getItems());

    cartService.subscribe(this.updateCartUI.bind(this));
  }

  setupEventListeners() {
    this.cartItems.addEventListener("click", (e) => {
      const button = e.target.closest("button");
      if (!button) return;

      const item = button.closest(".cart-item");
      const productId = parseInt(item.dataset.id);

      if (button.classList.contains("quantity-btn")) {
        const action = button.dataset.action;
        const currentItem = cartService
          .getItems()
          .find((i) => i.id === productId);

        if (action === "increase") {
          cartService.updateQuantity(productId, currentItem.quantity + 1);
        } else if (action === "decrease") {
          cartService.updateQuantity(productId, currentItem.quantity - 1);
        }
      } else if (button.classList.contains("remove-btn")) {
        cartService.removeItem(productId);
      }
    });

    document.querySelector(".apply-coupon").addEventListener("click", () => {
      const couponCode = document
        .querySelector(".coupon-form input")
        .value.trim();
      if (couponCode) {
        alert(`Cupón "${couponCode}" aplicado`);
      }
    });
  }

  updateCartUI(cart) {
    if (cart.length === 0) {
      this.cartEmpty.style.display = "block";
      this.cartItems.innerHTML = "";
      this.checkoutButton.disabled = true;
      this.checkoutButton.classList.add("disabled");
    } else {
      this.cartEmpty.style.display = "none";
      this.checkoutButton.disabled = false;
      this.checkoutButton.classList.remove("disabled");

      this.cartItems.innerHTML = cart
        .map(
          (item) => `
        <div class="cart-item" data-id="${item.id}">
            <div class="item-image">
                <img src="${item.image}" alt="${item.name}">
            </div>
            <div class="item-details">
                <h3 class="item-name">${item.name}</h3>
                <p class="item-price">€${item.price.toFixed(2)}</p>
            </div>
            <div class="item-quantity">
                <button class="quantity-btn" data-action="decrease">-</button>
                <span>${item.quantity}</span>
                <button class="quantity-btn" data-action="increase">+</button>
            </div>
            <div class="item-total">
                €${(item.price * item.quantity).toFixed(2)}
            </div>
            <button class="remove-btn">&times;</button>
        </div>
    `
        )
        .join("");
    }

    const subtotal = cartService.getTotal();
    this.subtotalElement.textContent = `€${subtotal.toFixed(2)}`;
    this.totalElement.textContent = `€${subtotal.toFixed(2)}`;
  }
}
