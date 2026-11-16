import React from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Cable,
  CreditCard,
  Mail,
  MapPin,
  Phone,
  Ticket,
  UserRound,
  X
} from 'lucide-react';

const emptyValue = (value) => value === null || value === undefined || String(value).trim() === '' ? '—' : value;

const formatMoney = (value) => `₦${Number(value || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

function formatDate(value) {
  if (!value) return '—';
  const datePart = String(value).slice(0, 10);
  const date = new Date(`${datePart}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function dueStatus(dateValue, daysNotice = 7) {
  if (!dateValue) return null;
  const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`, style: 'bg-rose-100 text-rose-800 border-rose-200' };
  if (days === 0) return { label: 'Due today', style: 'bg-amber-100 text-amber-900 border-amber-200' };
  if (days <= daysNotice) return { label: `Due in ${days} day${days === 1 ? '' : 's'}`, style: 'bg-amber-100 text-amber-900 border-amber-200' };
  return { label: `Due ${formatDate(dateValue)}`, style: 'bg-emerald-100 text-emerald-900 border-emerald-200' };
}

function Detail({ label, value, icon: Icon }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-semibold text-slate-900">{emptyValue(value)}</div>
    </div>
  );
}

export default function CustomerProfileModal({ customer, profileData, loading, onClose, onRecordPayment }) {
  const profile = profileData?.customer || customer;
  if (!profile) return null;

  const queries = profileData?.queries || [];
  const payments = profileData?.payments || [];
  const deployments = profileData?.deployments || [];
  const due = dueStatus(profile.next_due_date);
  const totalSubscriptionPayments = payments
    .filter((payment) => payment.type === 'Income' && /subscription|bandwidth/i.test(`${payment.category || ''} ${payment.description || ''}`))
    .reduce((total, payment) => total + Number(payment.gross_amount || 0), 0);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-2 sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="customer-profile-title" className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-voix-50 text-voix-700">
              <UserRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 id="customer-profile-title" className="break-words text-lg font-black text-slate-900 sm:text-xl">{profile.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="font-mono font-bold text-voix-700">{emptyValue(profile.voix_no)}</span>
                <span>•</span>
                <span>{emptyValue(profile.customer_type)}</span>
                <span>•</span>
                <span>{emptyValue(profile.service_plan)}</span>
                <span className={`rounded-full px-2 py-0.5 font-bold ${String(profile.status).toLowerCase() === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                  {emptyValue(profile.status)}
                </span>
                {due && <span className={`rounded-full border px-2 py-0.5 font-bold ${due.style}`}>{due.label}</span>}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button onClick={() => onRecordPayment(profile)} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 sm:flex-none sm:px-4 sm:text-sm">
              <CreditCard className="h-4 w-4" /> Record payment
            </button>
            <button onClick={onClose} aria-label="Close customer profile" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-6 p-4 sm:p-6">
          <section aria-label="Subscription summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-800">Amount payable</p>
              <p className="mt-1 text-lg font-black text-blue-950">{formatMoney(profile.amount_payable)}</p>
              <p className="mt-1 text-[11px] text-blue-800">{emptyValue(profile.payment_schedule)} billing cycle</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Amount paid</p>
              <p className="mt-1 text-lg font-black text-emerald-950">{formatMoney(profile.amount_paid)}</p>
              <p className="mt-1 text-[11px] text-emerald-800">Latest payment amount recorded on this account</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-rose-800">Outstanding balance</p>
              <p className="mt-1 text-lg font-black text-rose-950">{formatMoney(profile.outstanding_balance ?? profile.balance)}</p>
              <p className="mt-1 text-[11px] text-rose-800">{due?.label || 'Current amount owed'}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-900">Next payment due</p>
              <p className="mt-1 text-lg font-black text-amber-950">{formatDate(profile.next_due_date)}</p>
              <p className="mt-1 text-[11px] text-amber-900">Last payment: {formatDate(profile.last_payment_date)}</p>
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-black text-slate-900">Customer and service details</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Phone number" value={profile.phone} icon={Phone} />
              <Detail label="Email address" value={profile.email} icon={Mail} />
              <Detail label="Physical address / location" value={profile.address} icon={MapPin} />
              <Detail label="Customer / service type" value={`${emptyValue(profile.customer_type)} · ${emptyValue(profile.service_plan)}`} icon={Cable} />
              <Detail label="MAC address" value={profile.mac_address} />
              <Detail label="Assigned IP address" value={profile.ip_address} />
              <Detail label="Payment schedule" value={profile.payment_schedule} icon={CalendarClock} />
              <Detail label="Bank received" value={profile.bank_received} />
              <Detail label="Account created" value={formatDate(profile.created_at)} />
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-black text-slate-900"><Ticket className="h-4 w-4 text-rose-600" /> Query and support history</h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{queries.length} record{queries.length === 1 ? '' : 's'}</span>
            </div>
            {loading ? (
              <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Loading customer history…</p>
            ) : queries.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">No query or ticket history is linked to this customer yet.</p>
            ) : (
              <div className="space-y-3">
                {queries.map((query) => (
                  <article key={query.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-bold text-slate-900">{query.title || query.query_type || 'Customer query'}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          <span className="font-mono font-bold text-voix-700">{query.external_ref || query.id}</span>
                          {' · '}{formatDate(query.date_received || query.created_at)}
                          {query.time_received ? ` · ${query.time_received}` : ''}
                          {query.location ? ` · ${query.location}` : ''}
                        </p>
                      </div>
                      <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${['resolved', 'closed'].includes(String(query.status).toLowerCase()) ? 'bg-emerald-100 text-emerald-800' : String(query.status).toLowerCase() === 'escalated' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-900'}`}>
                        {query.status || 'Open'}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{query.description || 'No issue description recorded.'}</p>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-600">
                      {query.service_type && <span>Service: <strong className="text-slate-800">{query.service_type}</strong></span>}
                      {query.customer_ip && <span>IP: <strong className="font-mono text-slate-800">{query.customer_ip}</strong></span>}
                      {query.opened_by && <span>Opened by: <strong className="text-slate-800">{query.opened_by}</strong></span>}
                      {query.assigned_to && <span>Assigned to: <strong className="text-slate-800">{query.assigned_to}</strong></span>}
                      {query.mttr && <span>MTTR: <strong className="text-slate-800">{query.mttr}</strong></span>}
                      {query.resolution_by && <span>Resolved by: <strong className="text-slate-800">{query.resolution_by}</strong></span>}
                    </div>
                    {(query.customer_feedback || query.closure_notes) && (
                      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                        {query.customer_feedback && <p><strong>Customer feedback:</strong> {query.customer_feedback}</p>}
                        {query.closure_notes && <p className={query.customer_feedback ? 'mt-1' : ''}><strong>Closure notes:</strong> {query.closure_notes}</p>}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-black text-slate-900"><CreditCard className="h-4 w-4 text-emerald-700" /> Payment and accounting history</h3>
              <div className="flex flex-wrap justify-end gap-2">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">Subscription payments: {formatMoney(totalSubscriptionPayments)}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{payments.length} record{payments.length === 1 ? '' : 's'}</span>
              </div>
            </div>
            {loading ? (
              <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Loading payment history…</p>
            ) : payments.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">No payment or financial history is linked to this customer yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[850px] text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-3 font-bold">Date</th>
                      <th className="p-3 font-bold">Reference / description</th>
                      <th className="p-3 font-bold">Method</th>
                      <th className="p-3 text-right font-bold">Gross amount</th>
                      <th className="p-3 text-right font-bold">VAT</th>
                      <th className="p-3 font-bold">Coverage / due date</th>
                      <th className="p-3 font-bold">Received by</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((payment) => (
                      <tr key={payment.id} className="align-top text-slate-700">
                        <td className="whitespace-nowrap p-3 font-medium">{formatDate(payment.entry_date)}</td>
                        <td className="max-w-sm p-3">
                          <span className="font-mono font-bold text-voix-700">{payment.inv_no || '—'}</span>
                          <p className="mt-1 whitespace-normal text-slate-600">{payment.description || payment.category || 'Financial transaction'}</p>
                          {payment.category && <p className="mt-1 text-[10px] text-slate-400">{payment.type || 'Income'} · {payment.category}</p>}
                        </td>
                        <td className="p-3">{payment.payment_mode || '—'}</td>
                        <td className="whitespace-nowrap p-3 text-right font-bold text-emerald-800">{formatMoney(payment.gross_amount)}</td>
                        <td className="whitespace-nowrap p-3 text-right">{formatMoney(payment.vat_amount)}</td>
                        <td className="p-3">
                          {payment.duration_months > 0 ? `${payment.duration_months} month${payment.duration_months === 1 ? '' : 's'}` : '—'}
                          {payment.next_due_date && <p className="mt-1 text-slate-500">Due {formatDate(payment.next_due_date)}</p>}
                        </td>
                        <td className="p-3">{payment.received_by || payment.approved_by || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-[11px] text-slate-500">Legacy monthly spreadsheet amounts are retained as month-level totals; the original sheets did not provide individual payment references or exact dates.</p>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-black text-slate-900"><Cable className="h-4 w-4 text-blue-700" /> Deployment history</h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{deployments.length} record{deployments.length === 1 ? '' : 's'}</span>
            </div>
            {deployments.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">No deployment history is linked to this profile.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {deployments.map((deployment) => (
                  <div key={deployment.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-xs font-bold text-voix-700">{deployment.external_ref || deployment.id}</p>
                      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-700">{deployment.status}</span>
                    </div>
                    <p className="mt-2 text-sm font-bold text-slate-900">{deployment.plan || deployment.customer_type}</p>
                    <p className="mt-1 text-xs text-slate-600">{deployment.location || 'Location not recorded'}</p>
                    <p className="mt-2 text-xs text-slate-500">Started {formatDate(deployment.start_date)} · Completed {formatDate(deployment.end_date)}</p>
                    {deployment.notes && <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600">{deployment.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>

          {due && due.label.startsWith('Overdue') && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>This account is overdue. A payment reminder has been issued to Customer Service, Accounting, and management users.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
