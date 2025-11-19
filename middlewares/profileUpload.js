// import multer from "multer";

// const storage = multer.diskStorage({
//   filename: (req, file, cb) => {
//     cb(null, "profile_" + Date.now() + ".jpg");
//   },
// });

// const profileUpload = multer({ storage });

// export default profileUpload;


// import multer from "multer";

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, "./uploads"),
//   filename: (req, file, cb) => cb(null, "profile_" + Date.now() + ".jpg"),
// });

// const profileUpload = multer({ storage });

// export default profileUpload;   // ✔ FIXED
// middlewares/profileUpload.js

// middlewares/profileUpload.js
import multer from "multer";
import path from "path";
import fs from "fs";

// temp folder for blob images from cropper
const TEMP_FOLDER = "./uploads/profile-temp/";

if (!fs.existsSync(TEMP_FOLDER)) {
  fs.mkdirSync(TEMP_FOLDER, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TEMP_FOLDER),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
});

const profileUpload = multer({ storage });

export default profileUpload;
