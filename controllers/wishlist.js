const User = require("../Models/user");
const Product = require("../Models/products");

// Add product to wishlist
module.exports.addToWishlist = async (req, res) => {
    try {
        const { id } = req.params;

        // Check that the product exists
        const product = await Product.findById(id);

        if (!product) {
            req.flash("error", "Product not found.");
            return res.redirect("/products");
        }

        const user = await User.findById(req.user._id);

        // Check if product is already in wishlist
        const alreadyExists = user.wishlist.some(
            productId => productId.toString() === id
        );

        if (alreadyExists) {
            req.flash("info", "Product is already in your wishlist.");
            return res.redirect(`/products/${id}`);
        }

        // Add product to wishlist
        user.wishlist.push(product._id);

        await user.save();

        req.flash("success", "Product added to your wishlist ❤️");

        res.redirect(`/products/${id}`);

    } catch (error) {
        console.error(error);

        req.flash("error", "Unable to add product to wishlist.");
        res.redirect("/products");
    }
};


// Remove product from wishlist
module.exports.removeFromWishlist = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(req.user._id);

        // Remove the product from wishlist
        user.wishlist = user.wishlist.filter(
            productId => productId.toString() !== id
        );

        await user.save();

        req.flash("success", "Product removed from your wishlist.");

        res.redirect("/wishlist");

    } catch (error) {
        console.error(error);

        req.flash("error", "Unable to remove product from wishlist.");
        res.redirect("/wishlist");
    }
};


// Show user's wishlist
module.exports.showWishlist = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate("wishlist");

        res.render("wishlist/index.ejs", {
            wishlist: user.wishlist
        });

    } catch (error) {
        console.error(error);

        req.flash("error", "Unable to load your wishlist.");
        res.redirect("/products");
    }
};


// Move Wishlist Product to Cart (ADDED THIS FUNCTION)
module.exports.moveToCart = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(req.user._id);

        // Check if item already exists in user's cart
        const cartIndex = user.cart.findIndex(
            item => item.product.toString() === id
        );

        if (cartIndex > -1) {
            user.cart[cartIndex].quantity += 1;
        } else {
            user.cart.push({ product: id, quantity: 1 });
        }

        // Remove item from wishlist
        user.wishlist = user.wishlist.filter(
            productId => productId.toString() !== id
        );

        await user.save();

        req.flash("success", "Item moved to cart! 🛒");
        res.redirect("/wishlist");

    } catch (error) {
        console.error(error);

        req.flash("error", "Unable to move item to cart.");
        res.redirect("/wishlist");
    }
};