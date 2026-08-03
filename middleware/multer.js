const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const cloudinary = require("../utils/cloudinary");

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: "e-commerce-products",
        allowed_formats: ["jpg", "jpeg", "png", "webp"]
    }
});

const upload = multer({ storage });

module.exports = upload;