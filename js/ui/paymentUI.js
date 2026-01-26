import { cartService } from "../services/cart.js";
import { checkoutService } from "../services/checkout.js";

export class PaymentUI {
  constructor() {
    this.form = document.getElementById("payment-form");
    this.orderItems = document.querySelector(".order-items");
    this.orderTotals = document.querySelector(".order-totals");

    this.renderOrderSummary();
    this.setupEventListeners();
  }

  setupEventListeners() {
    const paymentOptions = document.querySelectorAll('input[name="payment"]');
    paymentOptions.forEach((option) => {
      option.addEventListener("change", () => {
        const paymentDetails = document.querySelectorAll(".payment-details");
        paymentDetails.forEach((detail) => (detail.style.display = "none"));

        const selectedOption = option.value;
        const selectedDetails = document.querySelector(
          `.payment-details[data-method="${selectedOption}"]`
        );
        if (selectedDetails) selectedDetails.style.display = "block";
      });
    });

    this.form.addEventListener("submit", (e) => {
      e.preventDefault();

      const formData = new FormData(this.form);
      const paymentMethod = formData.get("payment");

      let paymentInfo = { method: paymentMethod };

      if (paymentMethod === "credit-card") {
        paymentInfo = {
          ...paymentInfo,
          cardNumber: formData.get("card-number"),
          cardHolder: formData.get("card-holder"),
          expiry: formData.get("expiry"),
          cvv: formData.get("cvv"),
        };
      }

      checkoutService.savePaymentInfo(paymentInfo);

      this.processPayment();
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
                <p>$${item.price.toFixed(2)}</p>
            </div>
        </div>
    `
      )
      .join("");

    const subtotal = cartService.getTotal();
    const shipping = checkoutService.getShippingCost();
    const tax = subtotal * 0.21;
    const total = subtotal + shipping + tax;

    this.orderTotals.innerHTML = `
        <div class="total-row">
            <span>Subtotal</span>
            <span>$${subtotal.toFixed(2)}</span>
        </div>
        <div class="total-row">
            <span>Envío</span>
            <span>$${shipping.toFixed(2)}</span>
        </div>
        <div class="total-row">
            <span>Impuestos</span>
            <span>$${tax.toFixed(2)}</span>
        </div>
        <div class="total-row total-final">
            <span>Total</span>
            <span>$${total.toFixed(2)}</span>
        </div>
    `;
  }

  processPayment() {
    const submitButton = this.form.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Procesando...';

    setTimeout(() => {
      checkoutService
        .placeOrder()
        .then((orderDetails) => {
          window.location.href = `/confirmation.html?order=${orderDetails.orderNumber}`;
        })
        .catch((error) => {
          alert("Error al procesar el pago: " + error.message);
          submitButton.disabled = false;
          submitButton.textContent = originalText;
        });
    }, 2000);
  }
}
