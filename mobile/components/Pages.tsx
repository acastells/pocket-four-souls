import { useState } from "react";
export function Pages<T>({
  items,
  size = 4,
  render,
  empty = "No hay cartas aquí.",
}: {
  items: T[];
  size?: number;
  render: (item: T, index: number) => React.ReactNode;
  empty?: string;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / size)),
    current = Math.min(page, pages - 1);
  return (
    <div className="pages">
      <div className="page-items">
        {items.length ? (
          items.slice(current * size, (current + 1) * size).map((item, i) => (
            <div className="page-item" key={current * size + i}>
              {render(item, current * size + i)}
            </div>
          ))
        ) : (
          <p className="empty">{empty}</p>
        )}
      </div>
      {pages > 1 && (
        <div className="pager">
          <button
            aria-label="Página anterior"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            ‹
          </button>
          <span>
            {current + 1} / {pages}
          </span>
          <button
            aria-label="Página siguiente"
            disabled={current === pages - 1}
            onClick={() => setPage(current + 1)}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
