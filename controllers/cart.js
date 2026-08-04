const Product = require("../Models/products");
const User = require("../Models/user");

// Add product to cart
module.exports.addToCart = async (req, res) => {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
        req.flash("error", "Product not found!");
        return res.redirect("/products");
    }

    const user = await User.findById(req.user._id);

    // Check if product already exists in user's database cart
    const existingIndex = user.cart.findIndex(
        item => item.product.toString() === id
    );

    if (existingIndex > -1) {
        user.cart[existingIndex].quantity += 1;
    } else {
        user.cart.push({ product: id, quantity: 1 });
    }

    await user.save();
    req.flash("success", "Product added to cart!");
    res.redirect("/products");
};

// Show cart
// Show cart (with automatic DB cleanup for deleted products)
module.exports.showCart = async (req, res) => {
    const user = await User.findById(req.user._id).populate("cart.product");

    // Filter out null products (deleted from DB)
    const validItems = user.cart.filter(item => item.product !== null);

    // If deleted items were found, clean up the database document
    if (validItems.length !== user.cart.length) {
        user.cart = validItems.map(item => ({
            product: item.product._id,
            quantity: item.quantity
        }));
        await user.save();
    }

    const cartProducts = validItems.map(item => ({
        product: item.product,
        quantity: item.quantity,
        subtotal: item.product.price * item.quantity
    }));

    const total = cartProducts.reduce(
        (sum, item) => sum + item.subtotal,
        0
    );

    res.render("cart/index.ejs", {
        cartProducts,
        total
    });
};

// Increase quantity
module.exports.increaseQuantity = async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(req.user._id);

    const item = user.cart.find(
        item => item.product.toString() === id
    );

    if (item) {
        item.quantity += 1;
        await user.save();
    }

    res.redirect("/cart");
};

// Decrease quantity
module.exports.decreaseQuantity = async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(req.user._id);

    const itemIndex = user.cart.findIndex(
        item => item.product.toString() === id
    );

    if (itemIndex > -1) {
        if (user.cart[itemIndex].quantity > 1) {
            user.cart[itemIndex].quantity -= 1;
        } else {
            // Remove item if quantity falls to 0
            user.cart.splice(itemIndex, 1);
        }
        await user.save();
    }

    res.redirect("/cart");
};

// Remove product from cart
module.exports.removeFromCart = async (req, res) => {
    const { id } = req.params;

    // Use Mongoose $pull to remove item from array
    await User.findByIdAndUpdate(req.user._id, {
        $pull: { cart: { product: id } }
    });

    res.redirect("/cart");
};

// Validate cart before checkout
module.exports.validateCart = async (req, res) => {
    const user = await User.findById(req.user._id).populate("cart.product");

    // Automatically remove references to deleted products from DB
    const validItems = user.cart.filter(item => item.product !== null);
    if (validItems.length !== user.cart.length) {
        user.cart = validItems.map(item => ({
            product: item.product._id,
            quantity: item.quantity
        }));
        await user.save();
    }

    if (!user.cart || user.cart.length === 0) {
        req.flash("error", "Your cart is empty!");
        return res.redirect("/cart");
    }

    for (const item of user.cart) {
        if (item.quantity > item.product.stock) {
            req.flash(
                "error",
                `${item.product.title} does not have enough stock.`
            );
            return res.redirect("/cart");
        }
    }

    // Cart is valid
    res.redirect("/checkout");
};


// Buy Now (Add item to database cart and immediately go to cart)
module.exports.buyNow = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findById(id);

        if (!product) {
            req.flash("error", "Product not found!");
            return res.redirect("/products");
        }

        // Updated path to match views/orders/direct.ejs
        res.render("orders/direct.ejs", { product });
    } catch (err) {
        req.flash("error", "Something went wrong.");
        res.redirect("/products");
    }
};