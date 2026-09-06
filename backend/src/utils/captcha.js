import jwt from "jsonwebtoken";
import { config } from "../config/env.js";

export function generateCaptcha() {
  const num1 = Math.floor(Math.random() * 9) + 1;
  const num2 = Math.floor(Math.random() * 9) + 1;
  const question = `What is ${num1} + ${num2}?`;
  const answer = String(num1 + num2);

  const captcha_token = jwt.sign(
    { ans: answer },
    config.SECRET_KEY,
    { expiresIn: "3m" }
  );

  return { question, captcha_token };
}

export function verifyCaptcha(token, answer) {
  if (!token || !answer) {
    return { valid: false, message: "Captcha answer and token are required." };
  }

  try {
    const payload = jwt.verify(token, config.SECRET_KEY);
    if (payload.ans !== String(answer).trim()) {
      return { valid: false, message: "Incorrect Captcha answer. Please try again." };
    }
    return { valid: true };
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return { valid: false, message: "Captcha code expired. Please reload the Captcha challenge." };
    }
    return { valid: false, message: "Invalid Captcha token. Access denied." };
  }
}
