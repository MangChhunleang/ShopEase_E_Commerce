import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directories if they don't exist
const productsDir = path.join(__dirname, '../../uploads', 'products');
const bannersDir = path.join(__dirname, '../../uploads', 'banners');

if (!fs.existsSync(productsDir)) {
  fs.mkdirSync(productsDir, { recursive: true });
}

if (!fs.existsSync(bannersDir)) {
  fs.mkdirSync(bannersDir, { recursive: true });
}

// Helper function to create storage for a specific directory
const createStorage = (uploadDir) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Generate unique filename: timestamp-random-originalname
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '-').toLowerCase();
      cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
  });
};

// Configure storage for products
const storage = createStorage(productsDir);

// Configure storage for banners
const bannerStorage = createStorage(bannersDir);

// File filter - only allow images
const fileFilter = (req, file, cb) => {
  // Check file extension
  const allowedExtensions = /\.(jpeg|jpg|png|gif|webp)$/i;
  const extname = allowedExtensions.test(file.originalname);
  
  // Check MIME type (more comprehensive list)
  const allowedMimeTypes = /^image\/(jpeg|jpg|png|gif|webp|pjpeg|x-png)$/i;
  const mimetype = allowedMimeTypes.test(file.mimetype);

  // Accept if either extension or mimetype is valid (more lenient for mobile apps)
  if (mimetype || extname) {
    return cb(null, true);
  } else {
    console.log(`[UPLOAD] Rejected file: ${file.originalname}, mimetype: ${file.mimetype}`);
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

// Configure multer for products
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Configure multer for banners
export const uploadBanner = multer({
  storage: bannerStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Helper function to get public URL for uploaded file
export function getImageUrl(filename) {
  return `/uploads/products/${filename}`;
}

// Helper function to get public URL for uploaded banner
export function getBannerUrl(filename) {
  return `/uploads/banners/${filename}`;
}

// Helper function to delete image file
export function deleteImageFile(filename) {
  const filePath = path.join(productsDir, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

// Helper function to delete banner file
export function deleteBannerFile(filename) {
  const filePath = path.join(bannersDir, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

// Helper function to extract filename from URL
export function extractFilenameFromUrl(url) {
  if (!url) return null;
  // Handle both /uploads/products/filename and /uploads/banners/filename and full URLs
  const match = url.match(/\/uploads\/(products|banners)\/([^\/\?]+)/);
  return match ? match[2] : null;
}
