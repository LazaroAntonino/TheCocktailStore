import { cartService } from "../services/cart.js";
import { checkoutService } from "../services/checkout.js";

export class CheckoutUI {
  constructor() {
    this.form = document.getElementById("shipping-form");
    this.orderItems = document.querySelector(".order-items");
    this.orderTotals = document.querySelector(".order-totals");

    this.renderOrderSummary();
    this.setupEventListeners();

    this.prefillForm();
  }

  setupEventListeners() {
    this.form.addEventListener("submit", (e) => {
      e.preventDefault();

      const formData = new FormData(this.form);
      const shippingInfo = {
        fullname: formData.get("fullname"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        address: formData.get("address"),
        city: formData.get("city"),
        postal: formData.get("postal"),
        country: formData.get("country"),
      };

      const shippingMethod = formData.get("shipping");

      checkoutService.saveShippingInfo(shippingInfo);
      checkoutService.setShippingMethod(shippingMethod);

      window.location.href = "/payment.html";
    });
  }

  renderOrderSummary() {
    const cart = cartService.getItems();

    this.orderItems.innerHTML = cart
      .map(
        (item) => `
        <div class="order-item">
            <div class="item-image">
                <img src="${item.image}" alt="${item.name}">
                <span class="item-quantity">${item.quantity}</span>
            </div>
            <div class="item-info">
                <h4>${item.name}</h4>
                <p>€${item.price.toFixed(2)}</p>
            </div>
        </div>
    `
      )
      .join("");

    const subtotal = cartService.getTotal();
    const shipping = checkoutService.getShippingCost();
    const tax = checkoutService.getTaxAmount();
    const total = subtotal + shipping + tax;

    this.orderTotals.innerHTML = `
        <div class="total-row">
            <span>Subtotal</span>
            <span>€${subtotal.toFixed(2)}</span>
        </div>
        <div class="total-row">
            <span>Envío</span>
            <span>€${shipping.toFixed(2)}</span>
        </div>
        <div class="total-row">
            <span>Impuestos</span>
            <span>€${tax.toFixed(2)}</span>
        </div>
        <div class="total-row total-final">
            <span>Total</span>
            <span>€${total.toFixed(2)}</span>
        </div>
    `;
  }

  prefillForm() {
    const shippingInfo = checkoutService.shippingInfo;

    if (Object.keys(shippingInfo).length === 0) return;

    for (const [key, value] of Object.entries(shippingInfo)) {
      const input = this.form.elements[key];
      if (input) input.value = value;
    }

    const shippingMethod = checkoutService.shippingMethod;
    const radioButton = this.form.querySelector(
      `input[name="shipping"][value="${shippingMethod}"]`
    );
    if (radioButton) radioButton.checked = true;
  }
}
