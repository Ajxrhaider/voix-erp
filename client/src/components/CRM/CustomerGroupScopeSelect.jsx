import React, { useEffect, useState } from 'react';

const selectClass = 'w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100';

export default function CustomerGroupScopeSelect({ authFetch, value = [], onChange }) {
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    authFetch('/api/crm/customers/customer-groups')
      .then(async (response) => {
        const body = await response.json().catch(() => []);
        if (!response.ok) throw new Error(body.message || 'Could not load network groups.');
        return Array.isArray(body) ? body : [];
      })
      .then((rows) => { if (active) setGroups(rows); })
      .catch((loadError) => { if (active) setError(loadError.message || 'Could not load network groups.'); });
    return () => { active = false; };
  }, [authFetch]);

  const selected = Array.isArray(value) ? value : [];
  return (
    <div className="sm:col-span-2 md:col-span-4">
      <label className="text-[10px] font-bold block mb-1 text-slate-900">Affected customer group(s)</label>
      <select
        multiple
        size={Math.min(6, Math.max(3, groups.length))}
        value={selected}
        onChange={(event) => onChange(Array.from(event.target.selectedOptions, (option) => option.value))}
        className={selectClass}
        aria-label="Select one or more affected network groups"
      >
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.path || group.name} · {group.group_type}
          </option>
        ))}
      </select>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
        <span>{error || 'Choose a house, estate, line, Main 1, or multiple groups. Hold Ctrl/Command to select several.'}</span>
        {selected.length > 0 && <button type="button" onClick={() => onChange([])} className="font-bold text-violet-700 hover:underline">Clear selection ({selected.length})</button>}
      </div>
    </div>
  );
}
