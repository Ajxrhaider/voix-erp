import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import * as XLSX from 'xlsx';

const INCOME_CATEGORIES = [
  "Monthly Bandwidth Subscription",
  "Installation & Setup Fee",
  "Equipment & Router Sales",
  "Dark Fiber Lease",
  "IP Transit & Dedicated Bandwidth",
  "Technical Support & SLA Contract",
  "Miscellaneous Income"
];

export default function Accounting() {
  const { ledger, authFetch, refreshSystemData, user } = useContext(AppContext);

  const [activeTab, setActiveTab] = useState('excel-grid');
  const [currencySymbol] = useState('₦');
  const [searchQuery, setSearchQuery] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState('ALL');
  const [vatFilter, setVatFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Income records only
  const incomeRecords = useMemo(() => {
    return ledger.filter(l => l.type === 'Income');
  }, [ledger]);

  // Available Reporting Months
  const availableMonths = useMemo(() => {
    const months = new Set(incomeRecords.map(r => r.entry_date ? r.entry_date.substring(0, 7) : ''));
    const filtered = Array.from(months).filter(Boolean).sort().reverse();
    return filtered.length > 0 ? filtered : [new Date().toISOString().substring(0, 7)];
  }, [incomeRecords]);

  const [selectedMonth, setSelectedMonth] = useState(() => availableMonths[0] || '2026-08');

  // Form Data State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    invNo: `INV-VN-2026-${String(incomeRecords.length + 101).padStart(3, '0')}`,
    customerName: '',
    customerType: 'FTTH',
    category: 'Monthly Bandwidth Subscription',
    description: '',
    grossAmount: '',
    isVatExempt: false,
    vatCalculationType: 'INCLUSIVE',
    paymentMode: 'Bank Transfer',
    durationMonths: 1,
    customMonths: '',
    nextDueDate: '',
    receivedBy: user?.fullname || 'Finance Desk'
  });

  // Auto-calculate Next Due Date
  const calculatedDueDate = useMemo(() => {
    if (!formData.date || formData.durationMonths === 0) return '-';
    const monthsToAdd = formData.durationMonths === -1 ? (parseInt(formData.customMonths) || 1) : formData.durationMonths;
    if (monthsToAdd <= 0) return '-';
    const pDate = new Date(formData.date);
    if (isNaN(pDate.getTime())) return '-';
    pDate.setMonth(pDate.getMonth() + monthsToAdd);
    return pDate.toISOString().split('T')[0];
  }, [formData.date, formData.durationMonths, formData.customMonths]);

  // Auto VAT Breakdown Engine
  const calculatedTax = useMemo(() => {
    const gross = parseFloat(formData.grossAmount) || 0;
    if (gross <= 0) return { gross: 0, vat: 0, net: 0 };
    if (formData.isVatExempt) return { gross, vat: 0, net: gross };

    if (formData.vatCalculationType === 'INCLUSIVE') {
      const net = gross / 1.075;
      const vat = gross - net;
      return { gross, vat, net };
    } else {
      const vat = gross * 0.075;
      const totalGross = gross + vat;
      return { gross: totalGross, vat, net: gross };
    }
  }, [formData.grossAmount, formData.isVatExempt, formData.vatCalculationType]);

  const handleAddIncome = async (e) => {
    e.preventDefault();
    const rawAmount = parseFloat(formData.grossAmount);
    if (!rawAmount || isNaN(rawAmount) || rawAmount <= 0) {
      alert("Please enter a valid income amount.");
      return;
    }

    const monthsNum = formData.durationMonths === -1 ? (parseInt(formData.customMonths) || 1) : formData.durationMonths;
    const nextDue = monthsNum > 0 ? (formData.nextDueDate || calculatedDueDate) : '-';

    const payload = {
      entry_date: formData.date,
      inv_no: formData.invNo,
      customer_name: formData.customerName,
      customer_type: formData.customerType,
      type: 'Income',
      category: formData.category,
      description: formData.description,
      gross_amount: calculatedTax.gross,
      is_vat_exempt: formData.isVatExempt ? 1 : 0,
      vat_rate: formData.isVatExempt ? 0 : 7.5,
      vat_amount: calculatedTax.vat,
      net_amount: calculatedTax.net,
      payment_mode: formData.paymentMode,
      duration_months: monthsNum,
      next_due_date: nextDue,
      received_by: formData.receivedBy
    };

    const res = await authFetch('/api/accounting/ledger', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      setIsModalOpen(false);
      refreshSystemData();
    }
  };

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return incomeRecords.filter(r => {
      const matchesSearch =
        (r.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.inv_no || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = customerTypeFilter === 'ALL' || r.customer_type === customerTypeFilter;
      const matchesVat = vatFilter === 'ALL' || (vatFilter === 'EXEMPT' && r.is_vat_exempt) || (vatFilter === 'APPLICABLE' && !r.is_vat_exempt);
      const matchesStart = !startDate || r.entry_date >= startDate;
      const matchesEnd = !endDate || r.entry_date <= endDate;

      return matchesSearch && matchesType && matchesVat && matchesStart && matchesEnd;
    });
  }, [incomeRecords, searchQuery, customerTypeFilter, vatFilter, startDate, endDate]);

  // Aggregate Totals
  const totals = useMemo(() => {
    return filteredRecords.reduce((acc, r) => {
      acc.gross += r.gross_amount || 0;
      acc.vat += r.vat_amount || 0;
      acc.net += r.net_amount || 0;
      if (r.customer_type === 'FTTH') acc.ftthCount++;
      if (r.customer_type === 'Enterprise') acc.enterpriseCount++;
      return acc;
    }, { gross: 0, vat: 0, net: 0, ftthCount: 0, enterpriseCount: 0 });
  }, [filteredRecords]);

  // Monthly Summary
  const monthlyRecords = useMemo(() => {
    return incomeRecords.filter(r => r.entry_date && r.entry_date.startsWith(selectedMonth));
  }, [incomeRecords, selectedMonth]);

  const monthlySummaryData = useMemo(() => {
    const totalGross = monthlyRecords.reduce((s, r) => s + (r.gross_amount || 0), 0);
    const totalVat = monthlyRecords.reduce((s, r) => s + (r.vat_amount || 0), 0);
    const totalNet = monthlyRecords.reduce((s, r) => s + (r.net_amount || 0), 0);

    const categoryBreakdown = INCOME_CATEGORIES.map((cat, idx) => {
      const catRecs = monthlyRecords.filter(r => r.category === cat);
      const gross = catRecs.reduce((s, r) => s + (r.gross_amount || 0), 0);
      const vat = catRecs.reduce((s, r) => s + (r.vat_amount || 0), 0);
      const net = catRecs.reduce((s, r) => s + (r.net_amount || 0), 0);
      const percentage = totalGross > 0 ? ((gross / totalGross) * 100).toFixed(1) : "0.0";

      return { id: idx + 1, category: cat, count: catRecs.length, gross, vat, net, percentage: parseFloat(percentage) };
    });

    return { totalGross, totalVat, totalNet, categoryBreakdown };
  }, [monthlyRecords]);

  // Due Register Records
  const dueRegisterRecords = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return incomeRecords
      .filter(r => r.next_due_date && r.next_due_date !== '-')
      .map(r => {
        const due = new Date(r.next_due_date);
        const today = new Date(todayStr);
        const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

        let status = "ACTIVE";
        let badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300";
        if (diffDays < 0) {
          status = "OVERDUE";
          badgeClass = "bg-red-100 text-red-800 border-red-300 font-bold";
        } else if (diffDays <= 7) {
          status = "DUE SOON";
          badgeClass = "bg-amber-100 text-amber-800 border-amber-300 font-bold";
        }

        return { ...r, diffDays, status, badgeClass };
      })
      .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date));
  }, [incomeRecords]);

  const exportToExcel = () => {
    const detailedRows = filteredRecords.map((r, idx) => ({
      "S/N": idx + 1,
      "Payment Date": r.entry_date,
      "Invoice #": r.inv_no,
      "Customer Name": r.customer_name,
      "Customer Type": r.customer_type,
      "Income Category": r.category,
      "Description": r.description,
      "Gross Receipts (₦)": r.gross_amount,
      "VAT Status": r.is_vat_exempt ? "Exempted" : "7.5% Taxed",
      "7.5% Output VAT (₦)": r.vat_amount,
      "Net Revenue (₦)": r.net_amount,
      "Payment Mode": r.payment_mode,
      "Next Due Date": r.next_due_date,
      "Received By": r.received_by
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(detailedRows);
    XLSX.utils.book_append_sheet(wb, ws, "Income Day Book");
    XLSX.writeFile(wb, `Voix_ERP_Income_DayBook_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation Header (Gold Standard Slate-900) */}
      <header className="bg-slate-900 text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-600 p-2.5 rounded-lg shadow-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              VOIX NETWORKS <span className="text-xs bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full font-semibold">Income & Revenue Day Book</span>
            </h1>
            <p className="text-xs text-slate-400">ISP Revenue Ledger • 7.5% Auto-VAT • Customer Due Date Schedule (FTTH / Enterprise)</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 shadow-sm transition"
          >
            + Post Income Entry
          </button>
          <button
            onClick={exportToExcel}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 shadow-sm transition"
          >
            Export Excel (.xlsx)
          </button>
          <button
            onClick={() => window.print()}
            className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg font-medium text-xs transition"
          >
            Print Day Book
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 flex space-x-2 text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setActiveTab('excel-grid')}
          className={`px-4 py-2 rounded-lg transition ${activeTab === 'excel-grid' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          📊 Income Day Book Ledger (Excel View)
        </button>
        <button
          onClick={() => setActiveTab('due-register')}
          className={`px-4 py-2 rounded-lg transition ${activeTab === 'due-register' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          ⏰ Renewal & Due Date Schedule
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`px-4 py-2 rounded-lg transition ${activeTab === 'monthly' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          📅 Monthly Revenue & VAT Summary
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gross Revenue Received</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{currencySymbol}{totals.gross.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
          <p className="text-xs text-slate-400 mt-1">{filteredRecords.length} Payment Receipts</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">7.5% Output VAT Deducted</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{currencySymbol}{totals.vat.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
          <p className="text-xs text-slate-400 mt-1">Payable to FIRS</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Earned Revenue</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{currencySymbol}{totals.net.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
          <p className="text-xs text-slate-400 mt-1">Exclusive of 7.5% Tax</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Client Ratio</p>
          <p className="text-sm font-bold text-slate-800 mt-2">
            <span className="text-blue-600">{totals.ftthCount} FTTH</span> / <span className="text-purple-600">{totals.enterpriseCount} Enterprise</span>
          </p>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <input
            type="text"
            placeholder="Search customer, invoice #, or plan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 min-w-[220px]"
          />
          <select
            value={customerTypeFilter}
            onChange={(e) => setCustomerTypeFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="ALL">All Types</option>
            <option value="FTTH">FTTH (Home)</option>
            <option value="Enterprise">Enterprise</option>
          </select>
          <select
            value={vatFilter}
            onChange={(e) => setVatFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="ALL">All Tax Status</option>
            <option value="APPLICABLE">7.5% Taxed</option>
            <option value="EXEMPT">Tax Exempt</option>
          </select>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span>From:</span>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-2 py-1 border rounded" />
          <span>To:</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-2 py-1 border rounded" />
        </div>
      </div>

      {/* TAB 1: Columnar Day Book Ledger */}
      {activeTab === 'excel-grid' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-slate-900 text-white font-sans text-[11px]">
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Invoice #</th>
                  <th className="p-2.5">Customer Name</th>
                  <th className="p-2.5 text-center">Type</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5 text-right bg-slate-800">Gross Total (₦)</th>
                  <th className="p-2.5 text-center">VAT Status</th>
                  <th className="p-2.5 text-right bg-amber-950/60">7.5% VAT (₦)</th>
                  <th className="p-2.5 text-right bg-emerald-950/60">Net Revenue (₦)</th>
                  <th className="p-2.5 text-center">Next Due</th>
                  <th className="p-2.5">Received By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px]">
                {filteredRecords.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-2.5 whitespace-nowrap">{r.entry_date}</td>
                    <td className="p-2.5 font-bold text-emerald-700">{r.inv_no}</td>
                    <td className="p-2.5 font-sans font-bold text-slate-900">{r.customer_name}</td>
                    <td className="p-2.5 text-center font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.customer_type === 'FTTH' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                        {r.customer_type}
                      </span>
                    </td>
                    <td className="p-2.5 font-sans text-slate-600">{r.category}</td>
                    <td className="p-2.5 text-right font-black bg-slate-50">{currencySymbol}{r.gross_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="p-2.5 text-center font-sans">{r.is_vat_exempt ? 'EXEMPT' : '7.5% VAT'}</td>
                    <td className="p-2.5 text-right font-bold text-amber-700">{currencySymbol}{r.vat_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="p-2.5 text-right font-black text-emerald-900 bg-emerald-50/50">{currencySymbol}{r.net_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="p-2.5 text-center font-bold text-slate-800">{r.next_due_date}</td>
                    <td className="p-2.5 font-sans text-slate-500">{r.received_by}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold text-right text-xs">
                  <td colSpan="5" className="p-3 text-left font-sans">TOTAL SUMMARY</td>
                  <td className="p-3 text-white bg-slate-950">{currencySymbol}{totals.gross.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td></td>
                  <td className="p-3 text-amber-400 bg-amber-950">{currencySymbol}{totals.vat.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="p-3 text-emerald-400 bg-emerald-950">{currencySymbol}{totals.net.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Renewal & Due Date Schedule */}
      {activeTab === 'due-register' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-sm">Contract Expirations & Renewal Register</h3>
            <div className="flex gap-2 text-xs">
              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">● Active</span>
              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">● Due in 7 Days</span>
              <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold">● Overdue</span>
            </div>
          </div>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b">
                <th className="p-3">Customer Name</th>
                <th className="p-3">Type</th>
                <th className="p-3">Particulars</th>
                <th className="p-3 font-mono">Next Due Date</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Last Gross Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {dueRegisterRecords.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{r.customer_name}</td>
                  <td className="p-3">{r.customer_type}</td>
                  <td className="p-3 text-slate-500">{r.description}</td>
                  <td className="p-3 font-mono font-bold text-slate-900 bg-slate-50">{r.next_due_date}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${r.badgeClass}`}>
                      {r.status} ({r.diffDays}d)
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono font-bold">₦{r.gross_amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: Monthly Revenue & VAT Summary */}
      {activeTab === 'monthly' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div className="flex justify-between items-center border-b pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">VOIX NETWORKS - Monthly Income & FIRS Tax Report</h2>
              <p className="text-xs text-slate-500 mt-0.5">Selected Month: {selectedMonth}</p>
            </div>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 text-sm font-bold border rounded-lg"
            >
              {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-y">
                <th className="p-3">Head #</th>
                <th className="p-3">Income Stream Category</th>
                <th className="p-3 text-center">Count</th>
                <th className="p-3 text-right">Gross Total (₦)</th>
                <th className="p-3 text-right text-amber-700">7.5% VAT (₦)</th>
                <th className="p-3 text-right font-black">Net Income (₦)</th>
                <th className="p-3 text-right">% Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {monthlySummaryData.categoryBreakdown.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono text-slate-500 font-bold">{item.id}</td>
                  <td className="p-3 font-bold text-slate-900">{item.category}</td>
                  <td className="p-3 text-center font-mono">{item.count}</td>
                  <td className="p-3 text-right font-mono">₦{item.gross.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="p-3 text-right font-mono font-bold text-amber-700">₦{item.vat.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-900">₦{item.net.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="p-3 text-right font-mono">{item.percentage}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 text-white font-bold text-sm">
                <td colSpan="2" className="p-3 uppercase">TOTAL MONTHLY REVENUE</td>
                <td className="p-3 text-center font-mono">{monthlyRecords.length}</td>
                <td className="p-3 text-right font-mono">₦{monthlySummaryData.totalGross.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="p-3 text-right font-mono text-amber-400">₦{monthlySummaryData.totalVat.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="p-3 text-right font-mono text-emerald-400">₦{monthlySummaryData.totalNet.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="p-3 text-right font-mono">100.0%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Post Income Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">Post Income Payment Receipt</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleAddIncome} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 mb-1 block">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 mb-1 block">Invoice #</label>
                  <input
                    type="text"
                    required
                    value={formData.invNo}
                    onChange={e => setFormData({...formData, invNo: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="font-semibold text-slate-600 mb-1 block">Customer Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Zenith Tech Park"
                    value={formData.customerName}
                    onChange={e => setFormData({...formData, customerName: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg font-medium"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 mb-1 block">Customer Type</label>
                  <select
                    value={formData.customerType}
                    onChange={e => setFormData({...formData, customerType: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg bg-white font-bold"
                  >
                    <option value="FTTH">FTTH (Home)</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-600 mb-1 block">Category</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  {INCOME_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-600 mb-1 block">Particulars / Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 50Mbps Dedicated Fiber Internet"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              {/* VAT Calculation Engine Box */}
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-amber-900">💰 7.5% Auto-VAT Calculation Engine</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isVatExempt}
                      onChange={e => setFormData({...formData, isVatExempt: e.target.checked})}
                      className="rounded"
                    />
                    <span>VAT Exempt</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 font-semibold">Amount (₦)</label>
                    <input
                      type="number"
                      required
                      placeholder="0.00"
                      value={formData.grossAmount}
                      onChange={e => setFormData({...formData, grossAmount: e.target.value})}
                      className="w-full px-3 py-2 border rounded font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-semibold">Calculation Type</label>
                    <select
                      disabled={formData.isVatExempt}
                      value={formData.vatCalculationType}
                      onChange={e => setFormData({...formData, vatCalculationType: e.target.value})}
                      className="w-full px-3 py-2 border rounded bg-white"
                    >
                      <option value="INCLUSIVE">Inclusive (7.5% Inside Total)</option>
                      <option value="EXCLUSIVE">Exclusive (+7.5% Added)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-amber-200 font-mono">
                  <div>Gross: ₦{calculatedTax.gross.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                  <div className="text-amber-700">VAT: ₦{calculatedTax.vat.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                  <div className="text-emerald-800 font-bold">Net: ₦{calculatedTax.net.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500">Post Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}