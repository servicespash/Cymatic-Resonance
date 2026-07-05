const { webcrypto } = require("crypto");

async function generate() {
  const keyPair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);

  const pubJwk = await webcrypto.subtle.exportKey("raw", keyPair.publicKey);
  const pubBase64 = Buffer.from(pubJwk)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  console.log("--- VAPID PUBLIC KEY (Base64 URL-safe) ---");
  console.log(pubBase64);
}

generate();
