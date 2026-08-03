const express = require("express");
const router = express.Router();

const order = require("../controllers/order");

const {
    isLoggedIn,
    isAdmin
} = require("../middleware/middleware");

// Require authentication for ALL order routes
router.use(isLoggedIn);

/* =======================================================
   1. SPECIFIC / STATIC ROUTES FIRST
   ======================================================= */

// Checkout page
router.get("/checkout", order.showCheckout);

// Customer - My Orders
router.get("/", order.showMyOrders);

// Admin - All Orders
router.get("/admin/all", isAdmin, order.adminOrders);

// Place Direct Order (Buy Now Single Item)
router.post("/direct/:id", order.placeDirectOrder);

// Place Order (From Cart)
router.post("/", order.placeOrder);

/* =======================================================
   2. DYNAMIC PARAMETER ROUTES LAST (/:id)
   ======================================================= */

// Admin - Update Order Status
router.patch(
    "/admin/:id/status",
    isAdmin,
    order.updateOrderStatus
);

// Customer - Cancel Order
router.patch(
    "/:id/cancel",
    order.cancelOrder
);

// Customer - Single Order (MUST BE AFTER /checkout AND /admin/all)
router.get("/:id", order.showOrder);

module.exports = router;