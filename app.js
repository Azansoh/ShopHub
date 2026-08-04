// Load environment variables in non-production environments
require("dotenv").config();

// 1. Import Packages
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const session = require("express-session");
const MongoStore = require("connect-mongo").MongoStore;
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
const wishlistRoutes = require("./routes/wishlist");

// 2. Express App Initialization
const app = express();

// Set trust proxy first for Vercel/reverse proxies
app.set("trust proxy", 1); 

// 3. Database Connection (Serverless Cached Pattern)
const dbUrl = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/major_project";

mongoose.connection.on("error", (err) => console.error("Mongoose Connection Error:", err));

let isConnected = false;
async function connectDB() {
    if (isConnected || mongoose.connection.readyState === 1) {
        isConnected = true;
        return;
    }
    try {
        await mongoose.connect(dbUrl, { serverSelectionTimeoutMS: 5000 });
        isConnected = true;
        console.log("Successfully connected to MongoDB!");
    } catch (err) {
        console.error("DB Connection Error:", err);
    }
}
connectDB();

// 4. Views & Middleware Configuration
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// 5. Session Setup (Configured safely for Vercel)
const store = MongoStore.create({
    mongoUrl: dbUrl,
    crypto: {
        secret: process.env.SECRET || "thisshouldbeabettersecret!"
    },
    touchAfter: 24 * 3600,
    mongoOptions: { serverSelectionTimeoutMS: 5000 }
});

store.on("error", (err) => console.error("Session Store Error:", err));

const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

const sessionOptions = {
    store: store,
    secret: process.env.SECRET || "thisshouldbeabettersecret!",
    resave: false,
    saveUninitialized: false,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: isProduction && process.env.NODE_ENV === "production",
        sameSite: "lax"
    }
};

app.use(session(sessionOptions));
app.use(flash());

// 6. Middleware to ensure DB connection per request on cold starts
app.use(async (req, res, next) => {
    await connectDB();
    next();
});

// 7. Passport Authentication Setup
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
            clientID: process.env.GOOGLE_CLIENT_ID || "dummy_id",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "dummy_secret",
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

// 8. Global Template Variables (Safe & Fail-proof)
app.use((req, res, next) => {
    res.locals.currentUser = req.user || null;
    res.locals.currentPath = req.path || "";
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");

    // Compute cart count directly from session user array safely
    if (req.user && Array.isArray(req.user.cart)) {
        res.locals.cartCount = req.user.cart.length;
    } else {
        res.locals.cartCount = 0;
    }

    next();
});
// 9. Routes
app.get("/", (req, res) => {
    res.redirect("/products");
});

app.use("/", userRoutes);
app.use("/products", productRoutes);
app.use("/products", reviewRoutes);
app.use("/cart", cartRoutes);
app.use("/orders", orderRoutes);
app.use("/checkout", orderRoutes);
app.use("/", wishlistRoutes);

// Catch-all route to handle direct checkout POST requests originating without the /cart prefix
app.post("/checkout/direct/:id", (req, res) => {
    res.redirect(307, `/cart/checkout/direct/${req.params.id}`);
});



// 10. Start Server
const PORT = process.env.PORT || 3000;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;