import { PHOTO_MAX_OCTETS, resoudreUrlPhoto, validatePhoto } from "@/lib/photo";

describe("validatePhoto", () => {
  it("accepte les images JPEG, PNG et WebP jusqu'à 2 Mo", () => {
    expect(validatePhoto({ type: "image/jpeg", size: 300_000 })).toBeUndefined();
    expect(validatePhoto({ type: "image/png", size: PHOTO_MAX_OCTETS })).toBeUndefined();
    expect(validatePhoto({ type: "image/webp", size: 1 })).toBeUndefined();
  });

  it("refuse les autres formats", () => {
    expect(validatePhoto({ type: "image/gif", size: 1000 })).toBe("Choisissez une image JPEG, PNG ou WebP.");
    expect(validatePhoto({ type: "application/pdf", size: 1000 })).toBe("Choisissez une image JPEG, PNG ou WebP.");
  });

  it("refuse une image de plus de 2 Mo ou un fichier vide", () => {
    expect(validatePhoto({ type: "image/jpeg", size: PHOTO_MAX_OCTETS + 1 })).toBe("L'image ne doit pas dépasser 2 Mo.");
    expect(validatePhoto({ type: "image/jpeg", size: 0 })).toBe("Ce fichier est vide.");
  });
});

describe("resoudreUrlPhoto", () => {
  it("renvoie null sans photo", () => {
    expect(resoudreUrlPhoto(null)).toBeNull();
    expect(resoudreUrlPhoto(undefined)).toBeNull();
    expect(resoudreUrlPhoto("")).toBeNull();
  });

  it("préfixe un chemin par l'adresse du backend", () => {
    expect(resoudreUrlPhoto("/media/photos/7.jpg")).toBe("http://localhost:8000/media/photos/7.jpg");
  });

  it("garde une URL complète telle quelle", () => {
    expect(resoudreUrlPhoto("https://cdn.exemple.com/7.jpg")).toBe("https://cdn.exemple.com/7.jpg");
  });
});
