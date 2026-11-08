"use client";

import { useEffect, useState } from "react";

const HERO_SKINS = ["Black Knight", "Galaxy", "Skull Trooper"];

export default function FortniteHeroSkins() {
  const [images, setImages] = useState<Record<string, string>>({});

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/product-art?names=" + encodeURIComponent(JSON.stringify(HERO_SKINS)), {
      signal: controller.signal,
    })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("Skin artwork unavailable")))
      .then(result => {
        if (result?.images && typeof result.images === "object") {
          setImages(result.images as Record<string, string>);
        }
      })
      .catch(error => {
        if (error?.name !== "AbortError") {
          console.warn("Sumz Market Fortnite skin renders could not be loaded.", error);
        }
      });

    return () => controller.abort();
  }, []);

  const orderedSkins = HERO_SKINS
    .map(name => ({ name, image: images[name] }))
    .filter((skin): skin is { name: string; image: string } => !!skin.image);

  return (
    <div className="market-hero-skin-stage" aria-label="Real Fortnite character renders">
      <div className="market-hero-skin-glow" />
      {orderedSkins.map((skin, index) => (
        <div className={"market-hero-skin-wrap market-hero-skin-wrap-" + index} key={skin.name}>
          <img
            className="market-hero-skin"
            src={skin.image}
            alt={skin.name + " Fortnite outfit render"}
            loading="eager"
            decoding="async"
          />
          <span>{skin.name}</span>
        </div>
      ))}
    </div>
  );
}
