// Load environment variables in non-production environments
require("dotenv").config();

// 1. Import Packages
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const session = require("express-session");
const MongoStore = require("connect-mongodb-session")(session);
const flash = require("connect-flash");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

// Models & Routes
const User = require("./Models/user");
const userRoutes = require("./routes/user");
const productRoutes = require("./routes/products"); 
const reviewRoutes = require("./routes/review");
const cartRoutes = require("./routes/cart");
const orderRoutes = require("./routes/order");
const directcartRoutes = require("./routes/cart");
const wishlistRoutes = require("./routes/wishlist");

// 2. Database Connection Setup (Single source of truth)
const dbUrl = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/major_project";

console.log("Connecting to Database URL:", dbUrl);

mongoose.connect(dbUrl)
  .then(() => console.log("Successfully connected to MongoDB!"))
  .catch(err => console.error("DB Connection Error:", err));

// 3. Create Express App
const app = express();

// 4. Views & Basic Middleware Configuration
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// 5. Session Setup (Persistent store for Vercel serverless)
const store = new MongoStore({
    uri: dbUrl,
    collection: "sessions"
});

store.on("error", (err) => console.error("Session store error:", err));

const sessionOptions = {
    secret: process.env.SECRET || "thisshouldbeabettersecret!",
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true
    }
};

app.use(session(sessionOptions));
app.use(flash());

// 6. Passport Authentication Setup
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: "/auth/google/callback",
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let user = await User.findOne({ googleId: profile.id });

                if (!user) {
                    const email = profile.emails[0].value;
                    user = await User.findOne({ email: email });

                    if (user) {
                        user.googleId = profile.id;
                        await user.save();
                    } else {
                        user = new User({
                            username: profile.displayName || email.split("@")[0],
                            email: email,
                            googleId: profile.id,
                        });
                        await user.save();
                    }
                }
                return done(null, user);
            } catch (err) {
                return done(err, null);
            }
        }
    )
);

// 7. Global Middleware (Local Variables & Dynamic Clean Cart Count)
app.use(async (req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.currentPath = req.path;
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");

    if (req.user) {
        try {
            const freshUser = await User.findById(req.user._id).populate("cart.product");

            if (freshUser && freshUser.cart) {
                const items = freshUser.cart.items || freshUser.cart;
                
                const validItems = items.filter(item => {
                    if (!item) return false;
                    const productObj = item.product !== undefined ? item.product : item;
                    return productObj !== null && productObj !== undefined;
                });

                res.locals.cartCount = validItems.length;
            } else {
                res.locals.cartCount = 0;
            }
        } catch (err) {
            console.error("Cart count calculation error:", err);
            res.locals.cartCount = 0;
        }
    } else {
        res.locals.cartCount = 0;
    }

    next();
});

// 8. Routes
app.use("/", userRoutes);
app.use("/products", productRoutes);
app.use("/products", reviewRoutes);
app.use("/cart", cartRoutes);
app.use("/orders", orderRoutes);
app.use("/", directcartRoutes);
app.use("/", wishlistRoutes);

// Home route redirect
app.get("/", (req, res) => {
    res.redirect("/products");
});

// 9. Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app; 