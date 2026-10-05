const nodemailer = require("nodemailer");
const Order = require("../models/Order");

const defaultRecipient = "sotonyewealth@gmail.com";
const notificationLeaseMs = 10 * 60 * 1000;

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
})[character]);

const formatMoney = amount => new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN"
}).format(amount);

const formatDeliveryNotification = order => {
  const orderId = String(order._id);
  const address = order.shippingAddress;
  const customer = order.customer;
  const orderDate = new Intl.DateTimeFormat("en-NG", {
    dateStyle: "full",
    timeStyle: "long",
    timeZone: "Africa/Lagos"
  }).format(new Date(order.createdAt));
  const items = order.items.map(item =>
    `${item.name} x ${item.quantity} — ${formatMoney(item.price * item.quantity)}`
  );
  const paymentStatus = order.paymentStatus === "paid"
    ? "Paid"
    : `Pending (${order.paymentMethod.replaceAll("_", " ")})`;
  const subject = `NovaShop delivery order #${orderId}`;
  const text = [
    "A new delivery order has been placed.",
    `Order: ${orderId}`,
    `Date and time (Africa/Lagos): ${orderDate}`,
    `Customer: ${address.fullName}`,
    `Phone: ${address.phone}`,
    `Email: ${customer.email || "Not provided"}`,
    `Delivery address: ${address.address}, ${address.city}, ${address.state}`,
    "",
    "Items:",
    ...items.map(item => `- ${item}`),
    `Total: ${formatMoney(order.totalAmount)}`,
    `Payment: ${paymentStatus}`,
    order.paymentStatus === "paid" ? "" : "Confirm payment before dispatch."
  ].filter(Boolean).join("\n");
  const itemRows = order.items.map(item =>
    `<li>${escapeHtml(item.name)} &times; ${escapeHtml(item.quantity)} — ${escapeHtml(formatMoney(item.price * item.quantity))}</li>`
  ).join("");
  const html = `
    <h2>New delivery order</h2>
    <p><strong>Order:</strong> ${escapeHtml(orderId)}</p>
    <p><strong>Date and time (Africa/Lagos):</strong> ${escapeHtml(orderDate)}</p>
    <h3>Customer and delivery details</h3>
    <p>${escapeHtml(address.fullName)}<br>
    ${escapeHtml(address.phone)}<br>
    ${escapeHtml(customer.email || "Email not provided")}<br>
    ${escapeHtml(address.address)}, ${escapeHtml(address.city)}, ${escapeHtml(address.state)}</p>
    <h3>Items</h3>
    <ul>${itemRows}</ul>
    <p><strong>Total:</strong> ${escapeHtml(formatMoney(order.totalAmount))}</p>
    <p><strong>Payment:</strong> ${escapeHtml(paymentStatus)}</p>
    ${order.paymentStatus === "paid" ? "" : "<p>Confirm payment before dispatch.</p>"}
  `;

  return { subject, text, html };
};

const shouldNotifyDeliveryOrder = order =>
  order.paymentMethod !== "paystack" || order.paymentStatus === "paid";

const sendDeliveryNotification = async order => {
  const user = process.env.GMAIL_USER;
  const appPassword = process.env.GMAIL_APP_PASSWORD;
  if (!user || !appPassword) {
    throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD must be configured.");
  }

  const message = formatDeliveryNotification(order);
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass: appPassword.replace(/\s/g, "") },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });

  await transporter.sendMail({
    from: { name: "NovaShop Orders", address: user },
    to: process.env.DELIVERY_NOTIFICATION_EMAIL || defaultRecipient,
    replyTo: order.customer.email || undefined,
    ...message
  });
};

const notifyDeliveryOrder = async order => {
  if (!shouldNotifyDeliveryOrder(order)) return false;

  const now = new Date();
  const claimedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      $or: [
        { deliveryNotificationStatus: { $in: ["pending", "failed"] } },
        {
          deliveryNotificationStatus: "sending",
          deliveryNotificationStartedAt: { $lt: new Date(now.getTime() - notificationLeaseMs) }
        }
      ]
    },
    {
      $set: {
        deliveryNotificationStatus: "sending",
        deliveryNotificationStartedAt: now
      }
    },
    { new: true }
  );
  if (!claimedOrder) return false;

  try {
    await sendDeliveryNotification(claimedOrder);
    await Order.updateOne(
      { _id: claimedOrder._id, deliveryNotificationStatus: "sending" },
      {
        $set: {
          deliveryNotificationStatus: "sent",
          deliveryNotificationSentAt: new Date()
        },
        $unset: { deliveryNotificationStartedAt: 1 }
      }
    );
    return true;
  } catch (error) {
    try {
      await Order.updateOne(
        { _id: claimedOrder._id, deliveryNotificationStatus: "sending" },
        {
          $set: { deliveryNotificationStatus: "failed" },
          $unset: { deliveryNotificationStartedAt: 1 }
        }
      );
    } catch (updateError) {
      console.error("Could not record delivery email failure.", {
        orderId: String(claimedOrder._id),
        message: updateError.message
      });
    }
    console.error("Delivery notification email failed.", {
      orderId: String(claimedOrder._id),
      message: error.message
    });
    return false;
  }
};

module.exports = {
  formatDeliveryNotification,
  notifyDeliveryOrder,
  shouldNotifyDeliveryOrder
};
