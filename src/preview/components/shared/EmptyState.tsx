import React from 'react';

export function EmptyState() {
  return (
    <div className="empty-state">
      <svg className="empty-state__icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="4" width="40" height="40" rx="6" stroke="currentColor" strokeWidth="2" />
        <line x1="4" y1="16" x2="44" y2="16" stroke="currentColor" strokeWidth="2" />
        <line x1="18" y1="16" x2="18" y2="44" stroke="currentColor" strokeWidth="2" />
      </svg>
      <div className="empty-state__title">No tables yet</div>
      <div className="empty-state__hint">
        Ask your AI agent to create a table using diagram_create_table
      </div>
      <code className="empty-state__code">
        diagram_create_table({'{'} name: "users", columns: [...] {'}'})
      </code>
    </div>
  );
}
