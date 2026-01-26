import { checkoutService } from "../services/checkout.js";

export class ConfirmationUI {
  constructor() {
    this.orderNumber = new URLSearchParams(window.location.search).get("order");
    this.orderDetails = document.querySelector(".order-details");
    this.orderItems = document.querySelector(".order-items");
    this.orderSummary = document.querySelector(".order-summary");
    this.orderTotal = document.querySelector(".order-total");

    if (this.orderNumber) {
      document.querySelector(".order-number").textContent = this.orderNumber;
    } else {
      const orderDetails = checkoutService.getOrderDetails();
      if (orderDetails.orderNumber) {
        document.querySelector(".order-number").textContent =
          orderDetails.orderNumber;
      }
    }

    this.renderConfirmation();
  }

  renderConfirmation() {
    const orderInfo = checkoutService.getOrderDetails();

    this.orderDetails.innerHTML = `
        <p><strong>Fecha:</strong> ${new Date().toLocaleDateString()}</p>
        <p><strong>Nombre:</strong> ${orderInfo.shippingInfo.fullname}</p>
        <p><strong>Email:</strong> ${orderInfo.shippingInfo.email}</p>
        <p><strong>Dirección:</strong> ${orderInfo.shippingInfo.address}, ${
      orderInfo.shippingInfo.city
    }, ${orderInfo.shippingInfo.postal}</p>
        <p><strong>Método de envío:</strong> ${
          orderInfo.shippingMethod === "express" ? "Express" : "Estándar"
        }</p>
        <p><strong>Método de pago:</strong> ${this.formatPaymentMethod(
          orderInfo.paymentInfo
        )}</p>
    `;

    if (orderInfo.items && orderInfo.items.length > 0) {
      this.orderItems.innerHTML = orderInfo.items
        .map(
          (item) => `
            <div class="order-item">
                <div class="item-image">
                    <img src="${item.image}" alt="${item.name}">
                    <span class="item-quantity">${item.quantity}</span>
                </div>
                <div class="item-info">
                    <h4>${item.name}</h4>
                    <p>$${item.price.toFixed(2)} x ${item.quantity} = $${(
            item.price * item.quantity
          ).toFixed(2)}</p>
                </div>
            </div>
        `
        )
        .join("");
    } else {
      this.orderItems.innerHTML = "<p>No hay productos en el pedido.</p>";
    }

    this.orderSummary.innerHTML = `
        <div class="summary-row">
            <span>Subtotal:</span>
            <span>$${orderInfo.subtotal.toFixed(2)}</span>
        </div>
        <div class="summary-row">
            <span>Envío (${
              orderInfo.shippingMethod === "express" ? "Express" : "Estándar"
            }):</span>
            <span>$${orderInfo.shipping.toFixed(2)}</span>
        </div>
        <div class="summary-row">
            <span>Impuestos:</span>
            <span>$${orderInfo.tax.toFixed(2)}</span>
        </div>
        <div class="summary-row total">
            <span>Total:</span>
            <span>$${orderInfo.total.toFixed(2)}</span>
        </div>
    `;

    if (this.orderTotal) {
      this.orderTotal.textContent = `$${orderInfo.total.toFixed(2)}`;
    }
  }

  formatPaymentMethod(paymentInfo) {
    if (paymentInfo.method === "credit-card") {
      return `Tarjeta terminada en ${paymentInfo.cardNumber.slice(-4)}`;
    } else if (paymentInfo.method === "paypal") {
      return "PayPal";
    }
    return paymentInfo.method;
  }
}
