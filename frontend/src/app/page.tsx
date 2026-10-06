import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Languages from "@/components/Language";
import HowItWorks from "@/components/HowItWork";
import Footer from "@/components/Footer";
import Approach from "@/components/Approach";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Approach />
        <Languages />
        <HowItWorks />
      </main>
      <Footer />
    </>
  );
}