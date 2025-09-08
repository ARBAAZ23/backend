import checkoutNodeJssdk from "@paypal/checkout-server-sdk";

function environment() {
  return new checkoutNodeJssdk.core.SandboxEnvironment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
  );
}

function client() {
  return new checkoutNodeJssdk.core.PayPalHttpClient(environment());
}

// ✅ export both client and checkoutNodeJssdk
export { client, checkoutNodeJssdk };
