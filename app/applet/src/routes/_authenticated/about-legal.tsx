import React from "react";
import { useMetaData } from "@/hooks/useMetaData";

const AboutLegalPage = () => {
  useMetaData({
    title: "About & Legal | Cymatic Resonance",
    description:
      "Learn about the mission of Cymatic Resonance, our privacy policy, and terms of service regarding our sound and vibration monitoring tools.",
  });

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">About & Legal</h1>
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-2">About Cymatic Resonance</h2>
        <p>Advanced sound and visual vibration tool for monitoring and communication.</p>
      </section>
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-2">Privacy Policy</h2>
        <p>We respect your privacy. [Insert details...]</p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold mb-2">Terms of Service</h2>
        <p>By using this app, you agree to our terms. [Insert details...]</p>
      </section>
    </div>
  );
};

export default AboutLegalPage;
