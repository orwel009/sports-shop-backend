const express = require('express');
const Product = require('../models/Product');
const adminAuth = require('../middleware/adminAuth');
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');


const router = express.Router();

const multer = require('multer');
const storage = multer.memoryStorage();
const parser = multer({ storage });

router.post('/', adminAuth, parser.array('images', 5), async (req, res) => {
  try {
    const uploadedUrls = [];

    // Upload files to Cloudinary
    for (const file of req.files) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'sports-product-images' },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        streamifier.createReadStream(file.buffer).pipe(stream);
      });

      uploadedUrls.push(result.secure_url);
    }


    const productData = {
      ...req.body,
      isFeatured: req.body.isFeatured === 'true',
      images: uploadedUrls,
    };

    const product = new Product(productData);
    await product.save();

    res.status(201).json({ success: true, product });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { category, brand, minPrice, maxPrice, search } = req.query;

    let filter = {};
    if (category) filter.category = category;
    if (brand) filter.brand = brand;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (search) filter.name = { $regex: search, $options: 'i' };

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: products.length, products });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    res.json(categories);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// ----------------------
// GET DISTINCT BRANDS
// ----------------------
router.get('/brands', async (req, res) => {
  try {
    const brands = await Product.distinct('brand');
    res.json(brands);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get('/featured', async (req, res) => {
  try {
    const products = await Product.find({ isFeatured: true }).sort({ createdAt: -1 });
    res.json({ success: true, count: products.length, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ msg: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.put('/:id', adminAuth, parser.array('images', 5), async (req, res) => {
  try {
    const updatedData = {
      ...req.body,
      isFeatured: req.body.isFeatured === 'true',
    };

    const uploadedUrls = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'sports-product-images' },
            (error, result) => {
              if (result) resolve(result);
              else reject(error);
            }
          );
          streamifier.createReadStream(file.buffer).pipe(stream);
        });

        uploadedUrls.push(result.secure_url);
      }

      updatedData.images = uploadedUrls;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updatedData,
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, product: updatedProduct });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', adminAuth, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;