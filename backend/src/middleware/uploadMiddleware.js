import multer from "multer";
import path from "path";

// In-memory storage for processing streams & direct S3 forwarding
const storage = multer.memoryStorage();

// Profile Image Filter (JPG, JPEG, PNG, max 5MB)
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = [".jpg", ".jpeg", ".png"];

  if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file format. Only JPG, JPEG, and PNG files are accepted."), false);
  }
};

export const uploadProfileImage = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: imageFileFilter,
});

// CSV File Filter
const csvFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === ".csv" || file.mimetype.includes("csv") || file.mimetype.includes("text/plain")) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file format. Only CSV files are supported."), false);
  }
};

export const uploadCSV = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
  fileFilter: csvFileFilter,
});
