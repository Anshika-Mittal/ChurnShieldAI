import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app.js";
import { User } from "../src/models/User.js";
import { Customer } from "../src/models/Customer.js";
import { generateJWT } from "../src/middleware/authMiddleware.js";

describe("Customer CRUD Operations", () => {
  let authToken;
  let userId;
  let customerDocId;

  beforeAll(async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/churn_db_test");
    } catch (err) {}

    const user = await User.create({
      name: "Customer CRUD User",
      email: "cust.crud@test.com",
      verified: true,
    });
    userId = String(user._id);
    authToken = generateJWT(user);
  });

  afterAll(async () => {
    try {
      await User.deleteMany({ email: "cust.crud@test.com" });
      await Customer.deleteMany({ user_id: userId });
      await mongoose.disconnect();
    } catch (err) {}
  });

  it("should create a new customer", async () => {
    const res = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        customer_id: "CUST-9999",
        gender: "Male",
        contract: "Two year",
        monthly_charges: 85.0,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("customer");
    expect(res.body.customer.customer_id).toBe("CUST-9999");
    customerDocId = res.body.customer._id;
  });

  it("should list customers with pagination and filtering", async () => {
    const res = await request(app)
      .get("/api/customers?page=1&limit=10&search=CUST-9999")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.customers[0].customer_id).toBe("CUST-9999");
  });

  it("should update an existing customer", async () => {
    const res = await request(app)
      .put(`/api/customers/${customerDocId}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ contract: "One year" });

    expect(res.status).toBe(200);
    expect(res.body.customer.contract).toBe("One year");
  });

  it("should delete a customer", async () => {
    const res = await request(app)
      .delete(`/api/customers/${customerDocId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("Customer deleted successfully");
  });
});
