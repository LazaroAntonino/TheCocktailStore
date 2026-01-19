export class CartService {
  constructor() {
    this.cart = JSON.parse(localStorage.getItem("cart")) || [];
    this.subscribers = [];
  }

  getItems() {
    return this.cart;
  }

  getTotal() {
    const total = this.cart.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );
    return total;
  }

  addItem(product, quantity = 1) {
    const existingItem = this.cart.find((item) => item.id === product.id);

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      this.cart.push({
        ...product,
        quantity,
      });
    }

    this.saveCart();
    this.notifySubscribers();
  }

  removeItem(productId) {
    this.cart = this.cart.filter((item) => item.id !== productId);
    this.saveCart();
    this.notifySubscribers();
  }

  updateQuantity(productId, quantity) {
    const item = this.cart.find((item) => item.id === productId);
    if (item) {
      item.quantity = quantity;
      if (item.quantity <= 0) {
        this.removeItem(productId);
      } else {
        this.saveCart();
        this.notifySubscribers();
      }
    }
  }

  clearCart() {
    this.cart = [];
    this.saveCart();
    this.notifySubscribers();
  }

  saveCart() {
    localStorage.setItem("cart", JSON.stringify(this.cart));
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    callback(this.cart);
  }

  unsubscribe(callback) {
    this.subscribers = this.subscribers.filter((sub) => sub !== callback);
  }

  notifySubscribers() {
    this.subscribers.forEach((callback) => callback(this.cart));
  }
}

export const cartService = new CartService();

// Exponer globalmente para que chatbot.js pueda usarlo
window.cartService = cartService;
