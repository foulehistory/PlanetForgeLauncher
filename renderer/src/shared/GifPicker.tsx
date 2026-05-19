import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";

// Clé Giphy — configure via VITE_GIPHY_API_KEY dans .env
const GIPHY_KEY = (import.meta as { env: Record<string, string> }).env?.VITE_GIPHY_API_KEY ?? "";

interface GiphyItem {
  id: string;
  title: string;
  images: {
    fixed_height_small: { url: string };
    fixed_height:       { url: string };
  };
}

export default function GifPicker({ onGif }: { onGif: (url: string) => void }) {
  const [query, setQuery]     = useState("");
  const [gifs, setGifs]       = useState<GiphyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef           = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchGifs = async (q: string) => {
    if (!GIPHY_KEY) { setGifs([]); return; }
    setLoading(true);
    try {
      const endpoint = q.trim()
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=12&rating=g&lang=fr`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=12&rating=g`;
      const res  = await fetch(endpoint);
      const json = await res.json();
      setGifs((json.data as GiphyItem[]) ?? []);
    } catch {
      setGifs([]);
    } finally {
      setLoading(false);
    }
  };

  // Trending on mount
  useEffect(() => {
    fetchGifs("");
  }, []);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchGifs(query), 450);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  return (
    <div className="gif-picker" onClick={(e) => e.stopPropagation()}>
      {/* Search */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
        <Search size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        <input
          className="input"
          placeholder="Rechercher un GIF..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, height: 26, fontSize: 12 }}
          autoFocus
        />
      </div>

      {/* Grid */}
      <div className="gif-grid">
        {loading ? (
          <span style={{ gridColumn: "1/-1", fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: 12 }}>
            Chargement...
          </span>
        ) : gifs.length === 0 ? (
          <span style={{ gridColumn: "1/-1", fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: 12 }}>
            Aucun résultat
          </span>
        ) : (
          gifs.map((gif) => {
            const url = gif.images?.fixed_height_small?.url ?? gif.images?.fixed_height?.url ?? "";
            return (
              <button
                key={gif.id}
                className="gif-item"
                onClick={() => onGif(url)}
                title={gif.title}
              >
                <img
                  src={url}
                  alt={gif.title}
                  loading="lazy"
                  style={{ width: "100%", height: 70, objectFit: "cover", borderRadius: 4, display: "block" }}
                />
              </button>
            );
          })
        )}
      </div>

      {/* Powered by Giphy */}
      <div style={{ padding: "4px 8px", fontSize: 9, color: "var(--text-muted)", textAlign: "right", borderTop: "1px solid var(--border)" }}>
        Powered by GIPHY
      </div>
    </div>
  );
}
