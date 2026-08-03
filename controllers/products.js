const cloudinary = require("../utils/cloudinary");
const Product = require("../Models/products");
const Order = require("../Models/order");

// Show All Products (with Search, Filtering & Sorting)
module.exports.index = async (req, res) => {
    const {
        search,
        category,
        minPrice,
        maxPrice,
        sort,
        page = 1
    } = req.query;

    let filter = {};

    // Search by title
    if (search && search.trim() !== "") {
        filter.title = {
            $regex: search.trim(),
            $options: "i"
        };
    }

    // Filter by category
    if (category) {
        filter.category = category;
    }

    // Filter by price
    if (minPrice || maxPrice) {
        filter.price = {};

        if (minPrice) {
            filter.price.$gte = Number(minPrice);
        }

        if (maxPrice) {
            filter.price.$lte = Number(maxPrice);
        }
    }

    // Sorting
    let sortOption = {};

    if (sort === "priceAsc") {
        sortOption.price = 1;
    } else if (sort === "priceDesc") {
        sortOption.price = -1;
    } else {
        sortOption._id = -1;
    }

    // Pagination
    const limit = 9;
    const currentPage = Math.max(1, parseInt(page) || 1);
    const skip = (currentPage - 1) * limit;

    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);

    const allProducts = await Product
        .find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limit);

    res.render("products/index.ejs", {
        allProducts,
        search: search || "",
        category: category || "",
        minPrice: minPrice || "",
        maxPrice: maxPrice || "",
        sort: sort || "",
        currentPage,
        totalPages
    });
};

// Show Form
module.exports.renderNewForm = (req, res) => {
    res.render("products/new");
};

// Create Product
module.exports.createProduct = async (req, res) => {
    try {
        const productData = req.body.product || {};
        const { title, description, price, category, stock } = productData;

        // 1. Server-side check for image count requirement (Min 3)
        if (!req.files || req.files.length < 3) {
            req.flash("error", "Please upload at least 3 images.");
            // Render the form again and pass the previously entered values
            return res.render("products/new", { product: productData });
        }

        // 2. Server-side check for Description Word Count (At least 15 words)
        const wordCount = description ? description.trim().split(/\s+/).filter(word => word.length > 0).length : 0;
        
        if (wordCount < 15) {
            req.flash("error", "Description must contain at least 15 words.");
            // Render the form again and pass the previously entered values
            return res.render("products/new", { product: productData });
        }

        // Create product instance
        const product = new Product({
            title,
            description,
            price: Number(price),
            category,
            stock: Number(stock),
            owner: req.user._id
        });

        // Map through uploaded files
        product.images = req.files.map(file => ({
            url: file.path,
            filename: file.filename
        }));

        await product.save();

        req.flash("success", "Product added successfully!");
        res.redirect(`/products/${product._id}`);
    } catch (err) {
        req.flash("error", err.message);
        // On error, re-render and pass back the entered data
        res.render("products/new", { product: req.body.product || {} });
    }
};

// Show One Product
module.exports.showProduct = async (req, res) => {
    const { id } = req.params;

    const product = await Product.findById(id)
        .populate({
            path: "reviews",
            populate: {
                path: "author",
            },
        })
        .populate("owner");

    if (!product) {
        req.flash("error", "Cannot find that product!");
        return req.session.save(() => res.redirect("/products"));
    }

    // Recently Viewed Logic
    if (!req.session.recentlyViewed) {
        req.session.recentlyViewed = [];
    }

    req.session.recentlyViewed = req.session.recentlyViewed.filter(
        productId => productId.toString() !== product._id.toString()
    );

    req.session.recentlyViewed.unshift(product._id);
    req.session.recentlyViewed = req.session.recentlyViewed.slice(0, 5);

    let recentlyViewedProducts = [];

    if (req.session.recentlyViewed.length > 0) {
        const viewedProducts = await Product.find({
            _id: { $in: req.session.recentlyViewed }
        });

        recentlyViewedProducts = req.session.recentlyViewed
            .map(productId =>
                viewedProducts.find(
                    p => p._id.toString() === productId.toString()
                )
            )
            .filter(Boolean);
    }

    // Average Rating Calculation
    let avgRating = 0;
    if (product.reviews && product.reviews.length > 0) {
        const total = product.reviews.reduce(
            (sum, review) => sum + review.rating,
            0
        );
        avgRating = (total / product.reviews.length).toFixed(1);
    }

    // Purchase Verification
    let hasPurchased = false;
    if (req.user) {
        const purchasedOrder = await Order.findOne({
            user: req.user._id,
            "items.product": id,
            orderStatus: "Delivered",
        });

        if (purchasedOrder) {
            hasPurchased = true;
        }
    }

    // Product Recommendations
    const relatedProducts = await Product.find({
        category: product.category,
        _id: { $ne: product._id },
        stock: { $gt: 0 }
    }).limit(4);

    res.render("products/show", {
        product,
        avgRating,
        hasPurchased,
        relatedProducts,
        recentlyViewedProducts
    });
};

// Render Edit Form
module.exports.renderEditForm = async (req, res) => {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
        req.flash("error", "Cannot find that product!");
        return req.session.save(() => res.redirect("/products"));
    }

    res.render("products/edit", { product });
};

// Update Product
module.exports.updateProduct = async (req, res) => {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
        req.flash("error", "Cannot find that product!");
        return res.redirect("/products");
    }

    const updateData = { ...req.body.product };
    if (updateData.price) updateData.price = Number(updateData.price);
    if (updateData.stock) updateData.stock = Number(updateData.stock);

    Object.assign(product, updateData);

    // Append newly uploaded images to the images array
    if (req.files && req.files.length > 0) {
        const newImages = req.files.map(file => ({
            url: file.path,
            filename: file.filename
        }));
        product.images.push(...newImages);
    }

    await product.save();

    req.flash("success", "Successfully updated product!");
    
    req.session.save(() => {
        res.redirect(`/products/${id}`);
    });
};

// Delete Product
module.exports.deleteProduct = async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (!product) {
        req.flash("error", "Product not found!");
        return res.redirect("/products");
    }

    // Destroy all images stored on Cloudinary
    if (product.images && product.images.length > 0) {
        for (let img of product.images) {
            if (img.filename) {
                await cloudinary.uploader.destroy(img.filename);
            }
        }
    }

    await Product.findByIdAndDelete(req.params.id);

    req.flash("success", "Product deleted successfully!");

    req.session.save(() => {
        res.redirect("/products");
    });
};

// Show Recently Viewed Products
module.exports.recentlyViewed = async (req, res) => {
    let recentlyViewedProducts = [];

    if (req.session.recentlyViewed && req.session.recentlyViewed.length > 0) {
        const viewedProducts = await Product.find({
            _id: { $in: req.session.recentlyViewed }
        });

        recentlyViewedProducts = req.session.recentlyViewed
            .map(productId =>
                viewedProducts.find(
                    p => p._id.toString() === productId.toString()
                )
            )
            .filter(Boolean);
    }

    res.render("products/recentlyViewed", {
        recentlyViewedProducts
    });
};

// Show products owned by the logged-in user
module.exports.myProducts = async (req, res) => {
    const myProducts = await Product.find({
        owner: req.user._id
    }).sort({ _id: -1 });

    res.render("products/myProducts", {
        myProducts
    });
};