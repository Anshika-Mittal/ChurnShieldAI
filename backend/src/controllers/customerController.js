import { Customer } from "../models/Customer.js";

export const customerController = {
  /**
   * GET /api/customers
   * List customers for the logged in user with pagination & search.
   */
  async getCustomers(req, res, next) {
    try {
      const page = parseInt(req.query.page || "1", 10);
      const limit = parseInt(req.query.limit || "10", 10);
      const search = (req.query.search || "").trim();

      const query = { user_id: req.userId };
      if (search) {
        query.$or = [
          { customer_id: { $regex: search, $options: "i" } },
          { contract: { $regex: search, $options: "i" } },
          { internet_service: { $regex: search, $options: "i" } },
        ];
      }

      const total = await Customer.countDocuments(query);
      const customers = await Customer.find(query)
        .populate("last_prediction_id")
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      return res.status(200).json({
        total,
        page,
        limit,
        customers,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/customers
   * Create a new customer record.
   */
  async createCustomer(req, res, next) {
    try {
      const customerData = req.body || {};
      const customerId = (customerData.customer_id || customerData.customerId || "").trim();

      if (!customerId) {
        return res.status(400).json({ message: "Customer ID is required." });
      }

      const existing = await Customer.findOne({
        user_id: req.userId,
        customer_id: customerId,
      });

      if (existing) {
        return res.status(400).json({ message: "Customer with this ID already exists." });
      }

      const customer = await Customer.create({
        user_id: req.userId,
        ...customerData,
        customer_id: customerId,
      });

      return res.status(201).json({
        message: "Customer created successfully.",
        customer,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/customers/:id
   */
  async getCustomerById(req, res, next) {
    try {
      const customer = await Customer.findOne({
        _id: req.params.id,
        user_id: req.userId,
      }).populate("last_prediction_id");

      if (!customer) {
        return res.status(404).json({ message: "Customer not found." });
      }

      return res.status(200).json(customer);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PUT /api/customers/:id
   */
  async updateCustomer(req, res, next) {
    try {
      const updated = await Customer.findOneAndUpdate(
        { _id: req.params.id, user_id: req.userId },
        { $set: req.body },
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({ message: "Customer not found." });
      }

      return res.status(200).json({
        message: "Customer updated successfully.",
        customer: updated,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/customers/:id
   */
  async deleteCustomer(req, res, next) {
    try {
      const deleted = await Customer.findOneAndDelete({
        _id: req.params.id,
        user_id: req.userId,
      });

      if (!deleted) {
        return res.status(404).json({ message: "Customer not found." });
      }

      return res.status(200).json({ message: "Customer deleted successfully." });
    } catch (err) {
      next(err);
    }
  },
};
