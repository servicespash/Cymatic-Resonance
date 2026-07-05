import { webcrypto } from "crypto";

async function generate() {
  const keyPair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);

  const pub = await webcrypto.subtle.exportKey("jwk", keyPair.publicKey);
  const priv = await webcrypto.subtle.exportKey("jwk", keyPair.privateKey);

  console.log("--- VAPID PUBLIC KEY ---");
  console.log(JSON.stringify(pub));
  console.log("\n--- VAPID PRIVATE KEY ---");
  console.log(JSON.stringify(priv));
}

generate();
