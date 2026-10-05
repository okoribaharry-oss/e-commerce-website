const test = require("node:test");
const assert = require("node:assert/strict");
const {
  formatDeliveryNotification,
  shouldNotifyDeliveryOrder
} = require("../notifications/deliveryEmail");

const order = {
  _id: "order-123",
  createdAt: new Date("2025-02-03T04:05:06.000Z"),
  customer: { email: "shopper@example.com" },
  items: [
    { name: "Blue shirt", price: 12000, quantity: 2 },
    { name: "Cap", price: 5000, quantity: 1 }
  ],
  totalAmount: 29000,
  paymentMethod: "cash_on_delivery",
  paymentStatus: "pending",
  shippingAddress: {
    fullName: "Ada Shopper",
    phone: "+2348000000000",
    address: "12 Market Road",
    city: "Lagos",
    state: "Lagos"
  }
};

test("formats the delivery address, order time, items, total, and payment status", () => {
  const message = formatDeliveryNotification(order);

  assert.match(message.subject, /order-123/);
  assert.match(message.text, /Date and time \(Africa\/Lagos\):/);
  assert.match(message.text, /12 Market Road, Lagos, Lagos/);
  assert.match(message.text, /Blue shirt x 2/);
  assert.match(message.text, /Cap x 1/);
  assert.match(message.text, /₦29,000/);
  assert.match(message.text, /Pending \(cash on delivery\)/);
  assert.match(message.text, /Confirm payment before dispatch/);
});

test("escapes customer-controlled values in the HTML email", () => {
  const message = formatDeliveryNotification({
    ...order,
    shippingAddress: { ...order.shippingAddress, fullName: "<img src=x onerror=alert(1)>" },
    items: [{ name: "<script>alert(1)</script>", price: 100, quantity: 1 }]
  });

  assert.doesNotMatch(message.html, /<script>|<img/);
  assert.match(message.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(message.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test("only sends Paystack delivery notifications after payment is verified", () => {
  assert.equal(shouldNotifyDeliveryOrder({ paymentMethod: "paystack", paymentStatus: "pending" }), false);
  assert.equal(shouldNotifyDeliveryOrder({ paymentMethod: "paystack", paymentStatus: "paid" }), true);
  assert.equal(shouldNotifyDeliveryOrder({ paymentMethod: "cash_on_delivery", paymentStatus: "pending" }), true);
  assert.equal(shouldNotifyDeliveryOrder({ paymentMethod: "manual", paymentStatus: "pending" }), true);
});
