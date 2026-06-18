export type {
  Category,
  CarouselItem,
  Product,
  ProductQuery,
  ProductSort,
  StockFilter,
  StockStatus,
} from './types';

export { getCategories, getCategoryById } from './categories';
export { getCarouselItems } from './carousel';
export {
  getProductById,
  getProducts,
  getProductsByCategory,
  getTopProducts,
} from './products';

export {
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from './addresses';

export { listOrders, placeOrder } from './orders';
export type { PlaceOrderInput } from './orders';
