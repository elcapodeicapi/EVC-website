import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";

// Load env from current working dir and from functions directory (if executed from repo root)
dotenv.config();
try {
  const url = new URL("../.env", import.meta.url);
  dotenv.config({ path: url });
} catch {}

const apiKey = process.env.SENDGRID_API_KEY;
const to = process.env.TO_EMAIL || "hudayfa2005@gmail.com";
const from = process.env.FROM_EMAIL || "info@evcgo.nl";
const subject = process.env.SUBJECT || "SendGrid test (sandbox mode)";
const text = process.env.BODY || "If you received this, SendGrid works!";
const sandbox = String(process.env.SENDGRID_SANDBOX ?? "true").toLowerCase() !== "false"; // default true

if (!apiKey) {
  console.error("Missing SENDGRID_API_KEY. Set it as an environment variable.");
  process.exit(1);
}

sgMail.setApiKey(apiKey);

const msg = {
  to,
  from,
  subject,
  text,
  mailSettings: {
    sandboxMode: {
      enable: sandbox,
    },
  },
};

(async () => {
  try {
    const [response] = await sgMail.send(msg);
    console.log(
      `SendGrid responded with status ${response.statusCode}. Sandbox=${sandbox}.`
    );
    if (response.headers) {
      const sid = response.headers["x-message-id"] || response.headers["x-message-id".toLowerCase()];
      if (sid) console.log(`Message ID: ${sid}`);
    }
    if (!sandbox) {
      console.log("If no error occurred, the email was accepted for delivery.");
    } else {
      console.log("Sandbox mode enabled: no real email was sent.");
    }
    process.exit(0);
  } catch (err) {
    const details = err?.response?.body || err?.message || err;
    console.error("Error sending mail via SendGrid:", details);
    process.exit(2);
  }
})();