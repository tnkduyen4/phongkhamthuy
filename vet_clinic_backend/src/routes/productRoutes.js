const express = require('express');
const router = express.Router();
const {
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct
} = require('../controllers/productController');

const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router
    .route('/')
    .get(getProducts)
    .post(authorize('ADMIN'), createProduct);

router
    .route('/:id')
    .put(authorize('ADMIN'), updateProduct)
    .delete(authorize('ADMIN'), deleteProduct);

module.exports = router;
