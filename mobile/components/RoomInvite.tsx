import { useEffect, useMemo, useState } from "react";
import { encode } from "uqr";
import { Check, Copy } from "lucide-react";
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]", "::1"];

/**
 * QR code and link that open the app with the room code already filled in.
 * Opened as localhost, it asks the server for an address other devices reach.
 */
export function RoomInvite({ room }: { room: string }) {
  const local = LOCAL_HOSTS.includes(location.hostname);
  const [lanOrigin, setLanOrigin] = useState<string | null>(null);
  const [checked, setChecked] = useState(!local);
  useEffect(() => {
    if (!local) return;
    const controller = new AbortController();
    fetch("/api/network", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        const urls =
          typeof data === "object" && data !== null && "urls" in data
            ? data.urls
            : null;
        if (Array.isArray(urls) && typeof urls[0] === "string")
          setLanOrigin(urls[0]);
        setChecked(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setChecked(true);
      });
    return () => controller.abort();
  }, [local]);
  const origin = lanOrigin ?? location.origin;
  const url = `${origin}/?room=${room}`;
  const unreachable = local && checked && !lanOrigin;
  const [copied, setCopied] = useState(false);
  const { size, path } = useMemo(() => {
    const qr = encode(url, { border: 2 });
    let d = "";
    qr.data.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      }),
    );
    return { size: qr.size, path: d };
  }, [url]);
  const canCopy = typeof navigator !== "undefined" && !!navigator.clipboard;
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="room-invite">
      <svg
        className="qr"
        viewBox={`0 0 ${size} ${size}`}
        shapeRendering="crispEdges"
        role="img"
        aria-label={"Código QR para unirse a la sala " + room}
      >
        <rect width={size} height={size} fill="#f4efe0" />
        <path d={path} fill="#141711" />
      </svg>
      <small>Escanéalo con el móvil para unirte</small>
      {lanOrigin && <code className="invite-url">{lanOrigin}</code>}
      {canCopy && (
        <button className="ghost" onClick={copy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Enlace copiado" : "Copiar enlace"}
        </button>
      )}
      {unreachable && (
        <p className="invite-warning">
          Estás en <b>{location.hostname}</b>: otros dispositivos no podrán
          abrir este enlace. Arranca el servidor con <code>HOST=0.0.0.0</code> y
          abre la app con la IP de tu red.
        </p>
      )}
    </div>
  );
}
