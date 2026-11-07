type CosmeticImage = {
  featured?: string;
  icon?: string;
  smallIcon?: string;
  large?: string;
};

type Cosmetic = {
  name: string;
  images?: CosmeticImage;
};

const normalize = (value: string) =>
  value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export const runtime = "nodejs";
export const revalidate = 86400;

export async function GET(request: Request) {
  const url = new URL(request.url);
  let requested: unknown;

  try {
    requested = JSON.parse(url.searchParams.get("names") ?? "[]");
  } catch {
    return Response.json({ error: "Invalid cosmetic name list." }, { status: 400 });
  }

  if (!Array.isArray(requested) || requested.length > 100) {
    return Response.json({ error: "Request up to 100 product image names at a time." }, { status: 400 });
  }

  const names = [...new Set(requested.filter(
    (name): name is string => typeof name === "string" && name.trim().length > 0 && name.length <= 90
  ).map(name => name.trim()))];

  if (!names.length) return Response.json({ images: {} });

  try {
    const response = await fetch("https://fortnite-api.com/v2/cosmetics/br?language=en", {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      return Response.json({ images: {}, sourceUnavailable: true }, { status: 200 });
    }

    const payload = await response.json() as { data?: Cosmetic[] };
    const cosmetics = Array.isArray(payload.data) ? payload.data : [];
    const images: Record<string, string> = {};

    for (const name of names) {
      const key = normalize(name);
      const match = cosmetics.find(item => normalize(item.name) === key);
      const image = match?.images?.featured ?? match?.images?.icon ?? match?.images?.smallIcon ?? match?.images?.large;
      if (image && /^https:\/\//i.test(image)) images[name] = image;
    }

    return Response.json({ images, source: "Fortnite-API" }, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch {
    return Response.json({ images: {}, sourceUnavailable: true }, { status: 200 });
  }
}
