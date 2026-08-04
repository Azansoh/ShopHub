const Order = require("../Models/order");
const Product = require("../Models/products");
const User = require("../Models/user");

// Show checkout page
module.exports.showCheckout = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate("cart.product");

        if (!user.cart || user.cart.length === 0) {
            req.flash("error", "Your cart is empty!");
            return res.redirect("/cart");
        }

        const cartProducts = [];

        for (const item of user.cart) {
            const product = item.product;

            if (!product) {
                req.flash("error", "A product in your cart no longer exists!");
                return res.redirect("/cart");
            }

            if (item.quantity > product.stock) {
                req.flash(
                    "error",
                    `${product.title} does not have enough stock (Available: ${product.stock}).`
                );
                return res.redirect("/cart");
            }

            cartProducts.push({
                product,
                quantity: item.quantity,
                subtotal: product.price * item.quantity
            });
        }

        const total = cartProducts.reduce(
            (sum, item) => sum + item.subtotal,
            0
        );

        res.render("orders/checkout.ejs", {
            cartProducts,
            total
        });
    } catch (err) {
        console.error(err);
        req.flash("error", "Failed to load checkout page.");
        res.redirect("/cart");
    }
};

// Unified Place Order Controller (From Cart)
module.exports.placeOrder = async (req, res) => {
    try {
        const { fullName, address, city, phone, paymentMethod } = req.body;

        if (!fullName || !address || !city || !phone) {
            req.flash("error", "Please fill in all delivery information.");
            return res.redirect("/orders/checkout");
        }

        const user = await User.findById(req.user._id).populate("cart.product");

        if (!user.cart || user.cart.length === 0) {
            req.flash("error", "Cannot place an order with an empty cart.");
            return res.redirect("/cart");
        }

        const orderItems = [];
        let totalAmount = 0;

        for (const item of user.cart) {
            const product = item.product;

            if (!product || item.quantity > product.stock) {
                req.flash("error", "Stock issue detected. Please review your cart.");
                return res.redirect("/cart");
            }

            const subtotal = product.price * item.quantity;
            orderItems.push({
                product: product._id,
                title: product.title,
                price: product.price,
                quantity: item.quantity,
                subtotal
            });

            totalAmount += subtotal;
        }

        const updatedItems = [];

        for (const item of user.cart) {
            const result = await Product.updateOne(
                { _id: item.product._id, stock: { $gte: item.quantity } },
                { $inc: { stock: -item.quantity } }
            );

            if (result.matchedCount === 0) {
                for (const updated of updatedItems) {
                    await Product.updateOne(
                        { _id: updated.productId },
                        { $inc: { stock: updated.quantity } }
                    );
                }

                req.flash("error", "An item in your cart sold out during checkout.");
                return res.redirect("/cart");
            }

            updatedItems.push({
                productId: item.product._id,
                quantity: item.quantity
            });
        }

        const newOrder = new Order({
            user: req.user._id,
            customer: { fullName, address, city, phone },
            items: orderItems,
            totalAmount,

            payment: {
                method: paymentMethod || "COD",
                status: "Pending",
                paidAt: null
            }
        });

        await newOrder.save();

        user.cart = [];
        await user.save();

        req.flash("success", "Your order has been placed successfully!");
        res.redirect(`/orders/${newOrder._id}`);
    } catch (error) {
        console.error(error);
        req.flash("error", "Something went wrong while placing your order.");
        res.redirect("/orders/checkout");
    }
};

// Place Direct Order Controller (Buy Now Single Item)
module.exports.placeDirectOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { fullName, address, city, phone, paymentMethod } = req.body;
        
        const quantity = parseInt(req.body.quantity) || 1;

        if (!fullName || !address || !city || !phone) {
            req.flash("error", "Please fill in all delivery information.");
            return res.redirect(`/cart/checkout/direct/${id}`);
        }

        const product = await Product.findById(id);

        if (!product) {
            req.flash("error", "Product no longer exists!");
            return res.redirect("/products");
        }

        if (product.stock < quantity) {
            req.flash("error", `Only ${product.stock} items available in stock.`);
            return res.redirect(`/products/${id}`);
        }

        const stockResult = await Product.updateOne(
            { _id: product._id, stock: { $gte: quantity } },
            { $inc: { stock: -quantity } }
        );

        if (stockResult.matchedCount === 0) {
            req.flash("error", "Not enough stock remaining to complete order.");
            return res.redirect(`/products/${id}`);
        }

        const totalAmount = product.price * quantity;

        const orderItems = [{
            product: product._id,
            title: product.title,
            price: product.price,
            quantity: quantity,
            subtotal: totalAmount
        }];

        const newOrder = new Order({
            user: req.user._id,
            customer: { fullName, address, city, phone },
            items: orderItems,
            totalAmount: totalAmount,

            payment: {
                method: paymentMethod || "COD",
                status: "Pending",
                paidAt: null
            }
        });

        await newOrder.save();

        req.flash("success", "Your order has been placed successfully!");
        res.redirect(`/orders/${newOrder._id}`);
    } catch (error) {
        console.error(error);
        req.flash("error", "Something went wrong while placing your order.");
        res.redirect("/products");
    }
};

// Show Order Details
// Show Order Details
module.exports.showOrder = async (req, res) => {
    try {
        const { id } = req.params;

        // Added .populate("user") here
        const order = await Order.findById(id)
            .populate("items.product")
            .populate("user");

        if (!order) {
            req.flash("error", "Order not found.");
            return res.redirect("/orders");
        }

        const isOwner = order.user && order.user._id.toString() === req.user._id.toString();
        const isAdminUser = req.user.isAdmin || req.user.role === "admin"; 

        if (!isOwner && !isAdminUser) {
            req.flash("error", "You are not authorized to view this order.");
            return res.redirect("/orders");
        }

        res.render("orders/show.ejs", { order });
    } catch (error) {
        console.error(error);
        req.flash("error", "Invalid order ID.");
        res.redirect("/orders");
    }
};

// Show all orders of logged-in user
module.exports.showMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id })
            .populate("items.product")
            .sort({ createdAt: -1 });

        res.render("orders/index.ejs", { orders });
    } catch (error) {
        console.error(error);
        req.flash("error", "Unable to load your orders.");
        res.redirect("/products");
    }
};

// Admin - Show all orders (RESTORED MISSING FUNCTION)
module.exports.adminOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate("user")
            .populate("items.product")
            .sort({ createdAt: -1 });

        res.render("admin/orders/index.ejs", { orders });
    } catch (error) {
        console.error(error);
        req.flash("error", "Unable to load orders.");
        res.redirect("/products");
    }
};

// Admin - Update Order Status (With stock refund support)
module.exports.updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const allowedStatuses = [
            "Pending",
            "Processing",
            "Shipped",
            "Delivered",
            "Cancelled"
        ];

        if (!allowedStatuses.includes(status)) {
            req.flash("error", "Invalid order status.");
            return res.redirect("/orders/admin/all");
        }

        const order = await Order.findById(id);

        if (!order) {
            req.flash("error", "Order not found.");
            return res.redirect("/orders/admin/all");
        }

        if (status === "Cancelled" && order.status !== "Cancelled") {
            for (const item of order.items) {
                await Product.updateOne(
                    { _id: item.product },
                    { $inc: { stock: item.quantity } }
                );
            }
        }

        order.status = status;
        await order.save();

        req.flash("success", `Order status updated to ${status}.`);
        res.redirect("/orders/admin/all");
    } catch (error) {
        console.error(error);
        req.flash("error", "Unable to update order status.");
        res.redirect("/orders/admin/all");
    }
};

// Customer - Cancel Order
module.exports.cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;

        const order = await Order.findById(id);

        if (!order) {
            req.flash("error", "Order not found.");
            return res.redirect("/orders");
        }

        if (order.user.toString() !== req.user._id.toString()) {
            req.flash(
                "error",
                "You are not authorized to cancel this order."
            );
            return res.redirect("/orders");
        }

        if (
            order.status === "Shipped" ||
            order.status === "Delivered" ||
            order.status === "Cancelled"
        ) {
            req.flash(
                "error",
                "This order can no longer be cancelled."
            );
            return res.redirect(`/orders/${order._id}`);
        }

        const bulkOperations = order.items.map((item) => {
            const productId = item.product._id ? item.product._id : item.product;

            return {
                updateOne: {
                    filter: { _id: productId },
                    update: { $inc: { stock: item.quantity } }
                }
            };
        });

        if (bulkOperations.length > 0) {
            await Product.bulkWrite(bulkOperations);
        }

        order.status = "Cancelled";
        await order.save();

        req.flash(
            "success",
            "Your order has been cancelled successfully and product stock restored."
        );

        res.redirect(`/orders/${order._id}`);

    } catch (error) {
        console.error(error);

        req.flash(
            "error",
            "Unable to cancel the order."
        );

        res.redirect("/orders");
    }
};