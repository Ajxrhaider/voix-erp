import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CreditCard, MapPin, Plus, Search, Upload, Users, X } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import CustomerProfileModal from '../components/CRM/CustomerProfileModal';

const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const blankCustomer = () => ({
  voix_no: '', name: '', mac_address: '', customer_type: 'FTTH', service_plan: '', ip_address: '',
  payment_schedule: 'Monthly', amount_payable: '', amount_paid: '', bank_received: '',
  last_payment_date: '', next_due_date: '', outstanding_balance: '', address: '', email: '',
  phone: '', status: 'Active', group_id: ''
});

const initialPayment = (user) => ({
  customer_id: '', customer_name: '', date: todayIso(), amount: '', method: 'Bank Transfer',
  reference: '', durationMonths: 1, customMonths: '', isVatExempt: false,
  vatCalculationType: 'INCLUSIVE', receivedBy: user?.fullname || 'Customer Service'
});

function parseDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const date = new Date(`${raw.slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function addMonthsClamped(dateValue, months) {
  const base = parseDate(dateValue);
  if (!base || !Number.isFinite(months) || months <= 0) return '';
  const monthIndex = base.getMonth() + months;
  const year = base.getFullYear() + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;
  const day = Math.min(base.getDate(), new Date(year, targetMonth + 1, 0).getDate());
  return `${year}-${String(targetMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dueLabel(dateValue, noticeDays = 7) {
  const due = parseDate(dateValue);
  if (!due) return null;
  const today = parseDate(todayIso());
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { text: `Overdue ${Math.abs(days)}d`, classes: 'bg-rose-100 text-rose-800' };
  if (days === 0) return { text: 'Due today', classes: 'bg-amber-100 text-amber-900' };
  if (days <= noticeDays) return { text: `Due in ${days}d`, classes: 'bg-amber-100 text-amber-900' };
  return { text: `Due ${due.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}`, classes: 'bg-emerald-100 text-emerald-800' };
}

function dateText(value) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`block text-[11px] font-bold text-slate-700 ${className}`}>
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-voix-500 focus:ring-2 focus:ring-voix-100';

export default function Customers() {
  const { customers, authFetch, refreshSystemData, hasRole, user } = useContext(AppContext);
  const fileInputRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeProfile, setActiveProfile] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isGroupSaving, setIsGroupSaving] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', group_type: 'line', parent_id: '' });
  const [customerGroups, setCustomerGroups] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [customerForm, setCustomerForm] = useState(blankCustomer);
  const [paymentData, setPaymentData] = useState(() => initialPayment(user));
  const [message, setMessage] = useState(null);
  const [formError, setFormError] = useState('');
  const [importSummary, setImportSummary] = useState(null);
  const [paymentReminderDays, setPaymentReminderDays] = useState(7);

  const loadCustomerGroups = useCallback(async () => {
    const response = await authFetch('/api/crm/customers/customer-groups');
    const body = await response.json().catch(() => []);
    if (!response.ok) throw new Error(body.message || 'Could not load customer location groups.');
    setCustomerGroups(Array.isArray(body) ? body : []);
  }, [authFetch]);

  useEffect(() => {
    loadCustomerGroups().catch((error) => setMessage({ type: 'error', text: error.message || 'Could not load customer location groups.' }));
  }, [loadCustomerGroups]);

  useEffect(() => {
    let isCurrent = true;
    authFetch('/api/crm/customers/payment-due')
      .then(async (response) => {
        if (!response.ok) return null;
        const data = await response.json();
        if (isCurrent && Number.isInteger(data.notice_days)) {
          setPaymentReminderDays(data.notice_days);
        }
        return null;
      })
      .catch(() => {});
    return () => { isCurrent = false; };
  }, [authFetch]);

  const canManageCustomers = hasRole(['Customer Service', 'Accounting', 'Management', 'GM', 'Admin', 'Dev']);
  const activePaymentCustomer = customers.find((customer) => customer.id === paymentData.customer_id) || activeProfile;

  const filteredCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((customer) => [
      customer.name, customer.voix_no, customer.mac_address, customer.phone,
      customer.email, customer.ip_address, customer.address, customer.service_plan, customer.group_path
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [customers, searchQuery]);

  const dueCustomers = useMemo(() => customers.filter((customer) => {
    if (String(customer.status || '').trim().toLowerCase() !== 'active') return false;
    const due = dueLabel(customer.next_due_date, paymentReminderDays);
    return due && (due.text.startsWith('Overdue') || due.text === 'Due today' || due.text.startsWith('Due in '));
  }), [customers, paymentReminderDays]);

  const loadProfile = useCallback(async (customer) => {
    setActiveProfile(customer);
    setProfileData(null);
    setProfileLoading(true);
    try {
      const response = await authFetch(`/api/crm/customers/${encodeURIComponent(customer.id)}/profile`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Could not load this customer profile.');
      }
      setProfileData(await response.json());
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Could not load this customer profile.' });
    } finally {
      setProfileLoading(false);
    }
  }, [authFetch]);

  const calculatedDueDate = useMemo(() => {
    const selectedMonths = paymentData.durationMonths === -1
      ? Number.parseInt(paymentData.customMonths, 10) || 0
      : Number(paymentData.durationMonths);
    if (selectedMonths <= 0 || !paymentData.date) return activePaymentCustomer?.next_due_date || '';
    const currentDue = parseDate(activePaymentCustomer?.next_due_date);
    const paymentDate = parseDate(paymentData.date);
    const baseDate = currentDue && paymentDate && currentDue > paymentDate
      ? activePaymentCustomer.next_due_date
      : paymentData.date;
    return addMonthsClamped(baseDate, selectedMonths);
  }, [activePaymentCustomer?.next_due_date, paymentData.date, paymentData.durationMonths, paymentData.customMonths]);

  const calculatedTax = useMemo(() => {
    const enteredAmount = Number.parseFloat(paymentData.amount) || 0;
    if (enteredAmount <= 0) return { gross: 0, vat: 0, net: 0 };
    if (paymentData.isVatExempt) return { gross: enteredAmount, vat: 0, net: enteredAmount };
    if (paymentData.vatCalculationType === 'INCLUSIVE') {
      const net = enteredAmount / 1.075;
      return { gross: enteredAmount, vat: enteredAmount - net, net };
    }
    const vat = enteredAmount * 0.075;
    return { gross: enteredAmount + vat, vat, net: enteredAmount };
  }, [paymentData.amount, paymentData.isVatExempt, paymentData.vatCalculationType]);

  const handleManualAdd = async (event) => {
    event.preventDefault();
    setFormError('');
    try {
      const response = await authFetch('/api/crm/customers', { method: 'POST', body: JSON.stringify(customerForm) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Customer profile could not be created.');
      setIsCustomerModalOpen(false);
      setCustomerForm(blankCustomer());
      setMessage({ type: 'success', text: 'Customer profile created.' });
      await refreshSystemData();
    } catch (error) {
      setFormError(error.message || 'Customer profile could not be created.');
    }
  };

  const handleGroupSave = async (event) => {
    event.preventDefault();
    setFormError('');
    setIsGroupSaving(true);
    try {
      const response = await authFetch('/api/crm/customers/customer-groups', {
        method: 'POST',
        body: JSON.stringify({ ...groupForm, parent_id: groupForm.parent_id || null })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Customer group could not be saved.');
      setIsGroupModalOpen(false);
      setGroupForm({ name: '', group_type: 'line', parent_id: '' });
      await loadCustomerGroups();
      setMessage({ type: 'success', text: 'Network location group saved.' });
    } catch (error) {
      setFormError(error.message || 'Customer group could not be saved.');
    } finally {
      setIsGroupSaving(false);
    }
  };

  const handleAssignCustomerGroup = async (customer, groupId) => {
    try {
      const response = await authFetch(`/api/crm/customers/${encodeURIComponent(customer.id)}/group`, {
        method: 'PATCH',
        body: JSON.stringify({ group_id: groupId || null })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Customer location could not be updated.');
      await refreshSystemData();
      setMessage({ type: 'success', text: `Location group updated for ${customer.name}.` });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Customer location could not be updated.' });
    }
  };

  const availableGroupParents = customerGroups.filter((group) => {
    if (groupForm.group_type === 'line') return group.group_type === 'network';
    if (groupForm.group_type === 'estate') return ['network', 'line'].includes(group.group_type);
    if (groupForm.group_type === 'house') return group.group_type === 'estate';
    return false;
  });

  const downloadArchivedSource = async (archiveId, suggestedName) => {
    try {
      const response = await authFetch(`/api/crm/customers/import-archives/${encodeURIComponent(archiveId)}/download`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Archived source file could not be downloaded.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = suggestedName || 'source-file';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Archived source file could not be downloaded.' });
    }
  };

  const handleBulkImport = async (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;
    setIsImporting(true);
    setImportSummary(null);
    setMessage(null);

    try {
      const payload = new FormData();
      selectedFiles.forEach((file) => payload.append('files', file));
      const response = await authFetch('/api/crm/customers/import', { method: 'POST', body: payload });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Import failed.');
      setImportSummary(body);
      const importedCustomers = body.totals?.customersCreated || 0;
      const importedTickets = body.totals?.queriesCreated || 0;
      setMessage({ type: 'success', text: `Import complete: ${importedCustomers} new customers, ${importedTickets} new queries. See the import report below.` });
      await Promise.all([refreshSystemData(), loadCustomerGroups()]);
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Import failed.' });
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  const openPaymentModal = (customer = null) => {
    const initial = initialPayment(user);
    setPaymentData({
      ...initial,
      customer_id: customer?.id || '',
      customer_name: customer?.name || ''
    });
    setFormError('');
    setIsPaymentModalOpen(true);
  };

  const handleRecordPayment = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!paymentData.customer_id) {
      setFormError('Select a customer profile from the suggestions before posting a payment.');
      return;
    }
    if (calculatedTax.gross <= 0) {
      setFormError('Enter a payment amount greater than zero.');
      return;
    }

    const durationMonths = paymentData.durationMonths === -1
      ? Number.parseInt(paymentData.customMonths, 10) || 0
      : Number(paymentData.durationMonths);
    if (paymentData.durationMonths === -1 && durationMonths < 1) {
      setFormError('Enter a valid custom payment duration.');
      return;
    }

    try {
      const response = await authFetch(`/api/crm/customers/${encodeURIComponent(paymentData.customer_id)}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          entry_date: paymentData.date,
          inv_no: paymentData.reference || undefined,
          category: 'Monthly Bandwidth Subscription',
          description: `Subscription renewal (${durationMonths || 'one-off'} month${durationMonths === 1 ? '' : 's'})`,
          gross_amount: calculatedTax.gross,
          is_vat_exempt: paymentData.isVatExempt ? 1 : 0,
          vat_rate: paymentData.isVatExempt ? 0 : 7.5,
          vat_amount: calculatedTax.vat,
          net_amount: calculatedTax.net,
          payment_mode: paymentData.method,
          duration_months: durationMonths,
          next_due_date: calculatedDueDate,
          received_by: paymentData.receivedBy || user?.fullname || 'Customer Service'
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Payment could not be recorded.');

      setIsPaymentModalOpen(false);
      setPaymentData(initialPayment(user));
      setMessage({ type: 'success', text: `Payment recorded. Next due date: ${dateText(body.next_due_date)}.` });
      await refreshSystemData();
      if (activeProfile) {
        const updatedCustomer = body.customer || activeProfile;
        await loadProfile(updatedCustomer);
      }
    } catch (error) {
      setFormError(error.message || 'Payment could not be recorded.');
    }
  };

  const updateCustomerField = (field, value) => setCustomerForm((current) => ({ ...current, [field]: value }));
  const updatePaymentField = (field, value) => setPaymentData((current) => ({ ...current, [field]: value }));

  return (
    <ModuleLayout
      title="Customer Profiles"
      subtitle="Subscriber accounts, support history, subscription payments and due reminders"
      icon={<Users className="h-6 w-6" />}
      headerActions={canManageCustomers && (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button onClick={() => openPaymentModal()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600 sm:w-auto">
            <CreditCard className="h-4 w-4" /> Record payment
          </button>
          <button onClick={() => { setFormError(''); setGroupForm({ name: '', group_type: 'line', parent_id: '' }); setIsGroupModalOpen(true); }} className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-600 sm:w-auto">
            <MapPin className="h-4 w-4" /> Location groups
          </button>
          <button onClick={() => { setCustomerForm(blankCustomer()); setFormError(''); setIsCustomerModalOpen(true); }} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-500 sm:w-auto">
            <Plus className="h-4 w-4" /> Add customer
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.html,.htm" multiple onChange={handleBulkImport} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60 sm:w-auto">
            <Upload className="h-4 w-4" /> {isImporting ? 'Importing…' : 'Import legacy sheets'}
          </button>
        </div>
      )}
    >
      {message && (
        <div role="status" className={`mb-4 flex items-start justify-between gap-3 rounded-xl border p-3 text-sm ${message.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
          <p>{message.text}</p>
          <button onClick={() => setMessage(null)} aria-label="Dismiss message" className="rounded p-0.5 opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>
        </div>
      )}

      {importSummary && (
        <section className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold">Legacy import report</h3>
            <p className="text-xs text-blue-800">Mapped rows can be re-imported; each original upload is retained unchanged.</p>
          </div>
          <div className="mt-3 space-y-2">
            {importSummary.summaries?.map((summary, index) => (
              <div key={`${summary.source}-${index}`} className="rounded-lg border border-blue-100 bg-white/80 px-3 py-2">
                <p className="font-semibold">{summary.source} <span className="font-normal text-blue-700">· {summary.type}</span></p>
                {summary.message && <p className="mt-0.5 text-xs text-rose-700">{summary.message}</p>}
                <p className="mt-1 text-xs text-blue-800">
                  {summary.customersCreated !== undefined && `${summary.customersCreated} created · ${summary.customersUpdated || 0} merged`}
                  {summary.customersGrouped !== undefined && ` · ${summary.customersGrouped} assigned to a network location group`}
                  {summary.paymentEntriesImported !== undefined && ` · ${summary.paymentEntriesImported} payment periods`}
                  {summary.paymentRowsImported !== undefined && ` · ${summary.paymentRowsImported} profile payment rows`}
                  {summary.supportRowsImported !== undefined && ` · ${summary.supportRowsImported} profile support rows`}
                  {summary.profileTabsImported !== undefined && ` · ${summary.profileTabsImported} profile tabs`}
                  {summary.queriesCreated !== undefined && `${summary.queriesCreated} queries created · ${summary.queriesUpdated || 0} updated`}
                  {summary.deploymentsCreated !== undefined && `${summary.deploymentsCreated} deployments created · ${summary.deploymentsUpdated || 0} updated`}
                  {summary.ledgerEntriesImported !== undefined && `${summary.ledgerEntriesImported} ledger rows imported`}
                  {summary.rowsSkipped > 0 && ` · ${summary.rowsSkipped} empty/invalid rows skipped`}
                </p>
                {summary.type === 'Original file archived' && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-blue-50 px-2.5 py-2 text-xs text-blue-900">
                    <span>{summary.fileBytes?.toLocaleString()} bytes · {summary.sheetsArchived} sheets · {summary.sourceRowsPreserved?.toLocaleString()} source rows retained</span>
                    <button type="button" onClick={() => downloadArchivedSource(summary.archiveId, summary.originalName)} className="rounded-md border border-blue-200 bg-white px-2.5 py-1.5 font-bold text-blue-800 hover:bg-blue-100">Download original</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-blue-800">Original XLSX, XLS, CSV and HTML uploads are archived unchanged, with non-empty source rows indexed. Mapped imports include the customer profile workbook’s individual payments and support logs, client and enterprise lists, query logs, deployments, day books and the HTML income records. Unmapped cells remain in the downloadable original.</p>
        </section>
      )}

      {dueCustomers.length > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="font-bold">Payment follow-up: {dueCustomers.length} active account{dueCustomers.length === 1 ? '' : 's'} due or overdue</p>
            <p className="mt-1 text-xs text-amber-900">In-app reminders are sent to Customer Service, Accounting and management users for accounts due within the {paymentReminderDays}-day notice window or already overdue.</p>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:mb-6 sm:p-4">
        <Search className="h-5 w-5 shrink-0 text-slate-400" />
        <input
          type="search"
          placeholder="Search name, Voix No., MAC, phone, email, IP, or address…"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
        />
        <span className="whitespace-nowrap text-xs font-semibold text-slate-500">{filteredCustomers.length} accounts</span>
      </div>

      <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
            <tr>
              <th className="p-3 font-bold">Voix No.</th>
              <th className="p-3 font-bold">Customer</th>
              <th className="p-3 font-bold">Service</th>
              <th className="p-3 font-bold">Network location</th>
              <th className="p-3 font-bold">Subscription</th>
              <th className="p-3 font-bold">Next due</th>
              <th className="p-3 text-right font-bold">Balance</th>
              <th className="p-3 text-right font-bold">Profile</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredCustomers.map((customer) => {
              const due = dueLabel(customer.next_due_date);
              return (
                <tr key={customer.id} className="transition hover:bg-slate-50">
                  <td className="whitespace-nowrap p-3 font-mono text-xs font-bold text-blue-800">{customer.voix_no || '—'}</td>
                  <td className="p-3">
                    <p className="font-bold text-slate-900">{customer.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{customer.phone || customer.email || customer.address || 'Contact details not added'}</p>
                  </td>
                  <td className="p-3">
                    <p className="font-semibold text-slate-800">{customer.service_plan || customer.customer_type || '—'}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{customer.ip_address || 'No IP assigned'} · {customer.mac_address || 'No MAC recorded'}</p>
                  </td>
                  <td className="p-3">
                    {canManageCustomers ? (
                      <select
                        value={customer.group_id || ''}
                        onChange={(event) => handleAssignCustomerGroup(customer, event.target.value)}
                        aria-label={`Network location group for ${customer.name}`}
                        className="w-full min-w-48 rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs text-slate-900"
                      >
                        <option value="">Not assigned</option>
                        {customerGroups.map((group) => <option key={group.id} value={group.id}>{group.path || group.name}</option>)}
                      </select>
                    ) : <span className="text-xs font-semibold text-slate-700">{customer.group_path || 'Not assigned'}</span>}
                  </td>
                  <td className="p-3">
                    <p className="font-semibold text-slate-800">{customer.payment_schedule || '—'}</p>
                    <p className="mt-0.5 text-xs text-slate-500">Payable {`₦${Number(customer.amount_payable || 0).toLocaleString('en-NG')}`}</p>
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${due?.classes || 'bg-slate-100 text-slate-600'}`}>
                      {due?.text || dateText(customer.next_due_date)}
                    </span>
                    <p className="mt-1 text-[10px] text-slate-500">{dateText(customer.next_due_date)}</p>
                  </td>
                  <td className="whitespace-nowrap p-3 text-right font-mono font-bold text-slate-900">₦{Number(customer.outstanding_balance || 0).toLocaleString('en-NG')}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => loadProfile(customer)} className="whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-slate-700">View full profile</button>
                  </td>
                </tr>
              );
            })}
            {filteredCustomers.length === 0 && <tr><td colSpan="8" className="p-8 text-center font-medium text-slate-500">No customers match this search.</td></tr>}
          </tbody>
        </table>
      </div>

      {activeProfile && (
        <CustomerProfileModal
          customer={activeProfile}
          profileData={profileData}
          loading={profileLoading}
          onClose={() => { setActiveProfile(null); setProfileData(null); }}
          onRecordPayment={openPaymentModal}
        />
      )}

      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-2 sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && setIsPaymentModalOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="payment-modal-title" className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 id="payment-modal-title" className="flex items-center gap-2 text-lg font-black text-slate-900"><CreditCard className="h-5 w-5 text-emerald-700" /> Record subscription payment</h2>
                <p className="mt-1 text-xs text-slate-500">Payment and profile balance are saved together with an accounting ledger record.</p>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} aria-label="Close payment dialog" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>

            {formError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-900">{formError}</p>}
            <form onSubmit={handleRecordPayment} className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <Field label="Customer / enterprise" className="sm:col-span-2">
                <input
                  list="payment-customers"
                  required
                  placeholder="Type a customer name or Voix Number…"
                  value={paymentData.customer_name}
                  onChange={(event) => {
                    const selectedName = event.target.value;
                    const customer = customers.find((item) => item.name === selectedName || item.voix_no === selectedName);
                    setPaymentData((current) => ({ ...current, customer_name: selectedName, customer_id: customer?.id || '' }));
                  }}
                  className={inputClass}
                />
                <datalist id="payment-customers">
                  {customers.map((customer) => <option key={customer.id} value={customer.name}>{customer.voix_no}</option>)}
                </datalist>
              </Field>

              <Field label="Payment date">
                <input type="date" required value={paymentData.date} onChange={(event) => updatePaymentField('date', event.target.value)} className={inputClass} />
              </Field>
              <Field label="Payment method">
                <select value={paymentData.method} onChange={(event) => updatePaymentField('method', event.target.value)} className={inputClass}>
                  <option>Bank Transfer</option><option>Cash</option><option>Card Payment</option><option>POS</option><option>Other</option>
                </select>
              </Field>
              <Field label="Payment reference (optional)">
                <input type="text" placeholder="Receipt or transfer reference" value={paymentData.reference} onChange={(event) => updatePaymentField('reference', event.target.value)} className={inputClass} />
              </Field>
              <Field label="Subscription duration">
                <select value={paymentData.durationMonths} onChange={(event) => updatePaymentField('durationMonths', Number(event.target.value))} className={inputClass}>
                  <option value={1}>1 month · Monthly</option>
                  <option value={2}>2 months</option>
                  <option value={3}>3 months · Quarterly</option>
                  <option value={6}>6 months · Biannual</option>
                  <option value={12}>12 months · Annual</option>
                  <option value={0}>One-off payment</option>
                  <option value={-1}>Custom duration</option>
                </select>
              </Field>
              {paymentData.durationMonths === -1 && (
                <Field label="Custom duration in months">
                  <input type="number" min="1" max="120" required value={paymentData.customMonths} onChange={(event) => updatePaymentField('customMonths', event.target.value)} className={inputClass} />
                </Field>
              )}
              <Field label="Next due date (calculated)">
                <input type="date" readOnly value={calculatedDueDate} className={`${inputClass} bg-slate-100 text-slate-700`} />
              </Field>

              <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3 sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-bold text-amber-950">Payment amount and VAT</p>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                    <input type="checkbox" checked={paymentData.isVatExempt} onChange={(event) => updatePaymentField('isVatExempt', event.target.checked)} className="rounded border-slate-400 text-emerald-600 focus:ring-emerald-500" />
                    VAT exempt
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Amount received (₦)">
                    <input type="number" required min="0.01" step="0.01" placeholder="0.00" value={paymentData.amount} onChange={(event) => updatePaymentField('amount', event.target.value)} className={inputClass} />
                  </Field>
                  <Field label="VAT calculation">
                    <select disabled={paymentData.isVatExempt} value={paymentData.vatCalculationType} onChange={(event) => updatePaymentField('vatCalculationType', event.target.value)} className={`${inputClass} disabled:bg-slate-100`}>
                      <option value="INCLUSIVE">Inclusive · within total</option>
                      <option value="EXCLUSIVE">Exclusive · add 7.5%</option>
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-amber-200 pt-2 text-xs font-bold text-slate-800">
                  <p>Gross: ₦{calculatedTax.gross.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p>VAT: ₦{calculatedTax.vat.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p>Net: ₦{calculatedTax.net.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>

              <Field label="Received by" className="sm:col-span-2">
                <input type="text" required value={paymentData.receivedBy} onChange={(event) => updatePaymentField('receivedBy', event.target.value)} className={inputClass} />
              </Field>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:col-span-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-200">Cancel</button>
                <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700">Post payment</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2 sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && setIsCustomerModalOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="customer-create-title" className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 id="customer-create-title" className="text-lg font-black text-slate-900">Create customer profile</h2>
                <p className="mt-1 text-xs text-slate-500">Keep service, contact and billing data together in one account.</p>
              </div>
              <button onClick={() => setIsCustomerModalOpen(false)} aria-label="Close customer form" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>

            {formError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-900">{formError}</p>}
            <form onSubmit={handleManualAdd} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Voix Number"><input type="text" placeholder="Optional · auto-generated" value={customerForm.voix_no} onChange={(event) => updateCustomerField('voix_no', event.target.value)} className={inputClass} /></Field>
              <Field label="Customer name" className="sm:col-span-2"><input type="text" required value={customerForm.name} onChange={(event) => updateCustomerField('name', event.target.value)} className={inputClass} /></Field>
              <Field label="Customer type">
                <select value={customerForm.customer_type} onChange={(event) => updateCustomerField('customer_type', event.target.value)} className={inputClass}><option>FTTH</option><option>Enterprise</option></select>
              </Field>
              <Field label="Service plan / bandwidth"><input type="text" placeholder="e.g. 50 Mbps Fiber" value={customerForm.service_plan} onChange={(event) => updateCustomerField('service_plan', event.target.value)} className={inputClass} /></Field>
              <Field label="Account status">
                <select value={customerForm.status} onChange={(event) => updateCustomerField('status', event.target.value)} className={inputClass}><option>Active</option><option>Inactive</option><option>Suspended</option></select>
              </Field>
              <Field label="Location group">
                <select value={customerForm.group_id || ''} onChange={(event) => updateCustomerField('group_id', event.target.value)} className={inputClass}>
                  <option value="">Not assigned</option>
                  {customerGroups.map((group) => <option key={group.id} value={group.id}>{group.path || group.name}</option>)}
                </select>
              </Field>
              <Field label="Phone number"><input type="tel" value={customerForm.phone} onChange={(event) => updateCustomerField('phone', event.target.value)} className={inputClass} /></Field>
              <Field label="Email address"><input type="email" value={customerForm.email} onChange={(event) => updateCustomerField('email', event.target.value)} className={inputClass} /></Field>
              <Field label="MAC address"><input type="text" value={customerForm.mac_address} onChange={(event) => updateCustomerField('mac_address', event.target.value)} className={inputClass} /></Field>
              <Field label="IP address"><input type="text" value={customerForm.ip_address} onChange={(event) => updateCustomerField('ip_address', event.target.value)} className={inputClass} /></Field>
              <Field label="Payment schedule">
                <select value={customerForm.payment_schedule} onChange={(event) => updateCustomerField('payment_schedule', event.target.value)} className={inputClass}><option>Monthly</option><option>2 Months</option><option>Quarterly</option><option>Biannually</option><option>Annually</option></select>
              </Field>
              <Field label="Amount payable (₦)"><input type="number" min="0" step="0.01" value={customerForm.amount_payable} onChange={(event) => updateCustomerField('amount_payable', event.target.value)} className={inputClass} /></Field>
              <Field label="Last payment amount (₦)"><input type="number" min="0" step="0.01" value={customerForm.amount_paid} onChange={(event) => updateCustomerField('amount_paid', event.target.value)} className={inputClass} /></Field>
              <Field label="Outstanding balance (₦)"><input type="number" min="0" step="0.01" value={customerForm.outstanding_balance} onChange={(event) => updateCustomerField('outstanding_balance', event.target.value)} className={inputClass} /></Field>
              <Field label="Bank received"><input type="text" value={customerForm.bank_received} onChange={(event) => updateCustomerField('bank_received', event.target.value)} className={inputClass} /></Field>
              <Field label="Last payment date"><input type="date" value={customerForm.last_payment_date} onChange={(event) => updateCustomerField('last_payment_date', event.target.value)} className={inputClass} /></Field>
              <Field label="Next due date"><input type="date" value={customerForm.next_due_date} onChange={(event) => updateCustomerField('next_due_date', event.target.value)} className={inputClass} /></Field>
              <Field label="Physical address" className="sm:col-span-2 lg:col-span-3"><input type="text" value={customerForm.address} onChange={(event) => updateCustomerField('address', event.target.value)} className={inputClass} /></Field>
              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:col-span-2 sm:flex-row sm:justify-end lg:col-span-3">
                <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-200">Cancel</button>
                <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700">Create profile</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isGroupModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-2 sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && setIsGroupModalOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="customer-groups-title" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 id="customer-groups-title" className="text-lg font-black text-slate-900">Network location groups</h2>
                <p className="mt-1 text-xs text-slate-500">Build Main 1 → line → estate → house. Estates can also sit directly under Main 1.</p>
              </div>
              <button onClick={() => setIsGroupModalOpen(false)} aria-label="Close location group manager" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2 text-[10px] font-bold text-slate-700">
              {['network', 'line', 'estate', 'house'].map((type) => (
                <span key={type} className="rounded-full bg-slate-100 px-2.5 py-1">{type}: {customerGroups.filter((group) => group.group_type === type).length}</span>
              ))}
            </div>
            {formError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-900">{formError}</p>}
            <form onSubmit={handleGroupSave} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Group type">
                <select value={groupForm.group_type} onChange={(event) => setGroupForm({ ...groupForm, group_type: event.target.value, parent_id: '' })} className={inputClass}>
                  <option value="network">Network (Main 1)</option>
                  <option value="line">Line</option>
                  <option value="estate">Estate</option>
                  <option value="house">House</option>
                </select>
              </Field>
              <Field label="Group name">
                <input required autoFocus value={groupForm.name} onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })} placeholder={groupForm.group_type === 'network' ? 'Main 1' : 'Enter the group name'} className={inputClass} />
              </Field>
              {groupForm.group_type !== 'network' && (
                <Field label="Parent group" className="sm:col-span-2">
                  <select required value={groupForm.parent_id} onChange={(event) => setGroupForm({ ...groupForm, parent_id: event.target.value })} className={inputClass}>
                    <option value="">Select parent…</option>
                    {availableGroupParents.map((group) => <option key={group.id} value={group.id}>{group.path || group.name}</option>)}
                  </select>
                </Field>
              )}
              <p className="text-xs leading-relaxed text-slate-600 sm:col-span-2">
                Select customers’ house, estate or line groups when logging an issue. A Main 1 impact includes every customer, even if their individual location has not been assigned yet.
              </p>
              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:col-span-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setIsGroupModalOpen(false)} className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-200">Cancel</button>
                <button type="submit" disabled={isGroupSaving} className="rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-800 disabled:opacity-60">{isGroupSaving ? 'Saving…' : 'Save group'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </ModuleLayout>
  );
}
