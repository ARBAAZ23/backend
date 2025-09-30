import multer from "multer";
import path from "path";

// storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // all files go to "uploads" folder
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); 
    // unique filename: timestamp + original extension
  },
});

// multer middleware
const upload = multer({ storage });

export default upload;
