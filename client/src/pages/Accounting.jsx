import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
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
  const { ledger, authFetch, refreshSystemData, user, hasRole } = useContext(AppContext);

  const [activeTab, setActiveTab] = useState('excel-grid');
  const [currencySymbol] = useState('₦');
  const [searchQuery, setSearchQuery] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState('ALL');
  const [vatFilter, setVatFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const incomeRecords = useMemo(() => {
    return ledger.filter(l => l.type === 'Income');
  }, [ledger]);

  const availableMonths = useMemo(() => {
    const months = new Set(incomeRecords.map(r => r.entry_date ? r.entry_date.substring(0, 7) : ''));
    const filtered = Array.from(months).filter(Boolean).sort().reverse();
    return filtered.length > 0 ? filtered : [new Date().toISOString().substring(0, 7)];
  }, [incomeRecords]);

  const [selectedMonth, setSelectedMonth] = useState(() => availableMonths[0] || '2026-08');

  useEffect(() => {
    if (!availableMonths.includes(selectedMonth) && availableMonths.length > 0) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths]);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    invNo: `INV-VN-${new Date().getFullYear()}-${String(incomeRecords.length + 101).padStart(3, '0')}`,
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

  const calculatedDueDate = useMemo(() => {
    if (!formData.date || formData.durationMonths === 0) return '-';
    const monthsToAdd = formData.durationMonths === -1 ? (parseInt(formData.customMonths) || 1) : formData.durationMonths;
    if (monthsToAdd <= 0) return '-';
    const pDate = new Date(formData.date);
    if (isNaN(pDate.getTime())) return '-';
    pDate.setMonth(pDate.getMonth() + monthsToAdd);
    return pDate.toISOString().split('T')[0];
  }, [formData.date, formData.durationMonths, formData.customMonths]);

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
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailedRows), "Income Day Book");
    XLSX.writeFile(wb, `Voix_ERP_Income_DayBook_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <ModuleLayout
      title="Accounting & Revenue"
      subtitle="ISP Revenue Ledger • 7.5% Auto-VAT • Subscription Expirations"
      headerActions={hasRole(['Accounting', 'Management', 'GM', 'Dev']) && (
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold flex items-center justify-center shadow-sm transition w-full sm:w-auto">+ Post Income Entry</button>
          <button onClick={exportToExcel} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold flex items-center justify-center shadow-sm transition w-full sm:w-auto">Export Excel (.xlsx)</button>
        </div>
      )}
    >
      <div className="bg-white p-2 rounded-xl border border-slate-200 flex space-x-2 text-xs font-bold overflow-x-auto custom-scrollbar mb-6 w-full">
        <button onClick={() => setActiveTab('excel-grid')} className={`px-4 py-2.5 sm:py-2 rounded-lg whitespace-nowrap transition ${activeTab === 'excel-grid' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>📊 Income Day Book</button>
        <button onClick={() => setActiveTab('due-register')} className={`px-4 py-2.5 sm:py-2 rounded-lg whitespace-nowrap transition ${activeTab === 'due-register' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>⏰ Renewal Register</button>
        <button onClick={() => setActiveTab('monthly')} className={`px-4 py-2.5 sm:py-2 rounded-lg whitespace-nowrap transition ${activeTab === 'monthly' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>📅 Monthly VAT Summary</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 w-full">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <p className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Gross Revenue Received</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{currencySymbol}{totals.gross.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <p className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">7.5% Output VAT Deducted</p>
          <p className="text-xl sm:text-2xl font-bold text-amber-700 mt-1">{currencySymbol}{totals.vat.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <p className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Net Earned Revenue</p>
          <p className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1">{currencySymbol}{totals.net.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <p className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Client Ratio</p>
          <p className="text-sm font-bold text-slate-900 mt-2"><span className="text-blue-700">{totals.ftthCount} FTTH</span> / <span className="text-purple-700">{totals.enterpriseCount} Enterprise</span></p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
          <input type="text" placeholder="Search invoice, customer..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full sm:w-auto px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400" />
          <div className="flex gap-2 w-full sm:w-auto">
            <select value={customerTypeFilter} onChange={(e) => setCustomerTypeFilter(e.target.value)} className="w-full sm:w-auto px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 font-bold"><option value="ALL">All Types</option><option value="FTTH">FTTH (Home)</option><option value="Enterprise">Enterprise</option></select>
            <select value={vatFilter} onChange={(e) => setVatFilter(e.target.value)} className="w-full sm:w-auto px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 font-bold"><option value="ALL">All Tax Status</option><option value="APPLICABLE">7.5% Taxed</option><option value="EXEMPT">Tax Exempt</option></select>
          </div>
        </div>
      </div>

      {activeTab === 'excel-grid' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden w-full">
          <div className="overflow-x-auto custom-scrollbar w-full">
            <table className="w-full text-left text-xs border-collapse font-mono min-w-[1000px]">
              <thead>
                <tr className="bg-slate-900 text-white font-sans text-[11px]">
                  <th className="p-2.5 border-r border-slate-800">Date</th><th className="p-2.5 border-r border-slate-800">Invoice #</th><th className="p-2.5 border-r border-slate-800">Customer Name</th><th className="p-2.5 text-center border-r border-slate-800">Type</th><th className="p-2.5 border-r border-slate-800">Category</th><th className="p-2.5 text-right bg-slate-800 border-r border-slate-800">Gross (₦)</th><th className="p-2.5 text-center border-r border-slate-800">VAT Status</th><th className="p-2.5 text-right bg-amber-950/60 border-r border-slate-800">7.5% VAT (₦)</th><th className="p-2.5 text-right bg-emerald-950/60 border-r border-slate-800">Net Revenue (₦)</th><th className="p-2.5 text-center border-r border-slate-800">Next Due</th><th className="p-2.5">Received By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px]">
                {filteredRecords.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="p-2.5 whitespace-nowrap text-slate-600 border-r border-slate-100">{r.entry_date}</td>
                    <td className="p-2.5 font-bold text-emerald-700 border-r border-slate-100">{r.inv_no}</td>
                    <td className="p-2.5 font-sans font-bold text-slate-900 border-r border-slate-100">{r.customer_name}</td>
                    <td className="p-2.5 text-center font-sans border-r border-slate-100"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.customer_type === 'FTTH' ? 'bg-blue-100 text-blue-900' : 'bg-purple-100 text-purple-900'}`}>{r.customer_type}</span></td>
                    <td className="p-2.5 font-sans text-slate-700 border-r border-slate-100">{r.category}</td>
                    <td className="p-2.5 text-right font-bold text-slate-900 bg-slate-50 border-r border-slate-100">{currencySymbol}{r.gross_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="p-2.5 text-center font-sans font-bold text-slate-700 border-r border-slate-100">{r.is_vat_exempt ? 'EXEMPT' : '7.5% VAT'}</td>
                    <td className="p-2.5 text-right font-bold text-amber-700 bg-amber-50/50 border-r border-slate-100">{r.vat_amount > 0 ? `${currencySymbol}${r.vat_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}</td>
                    <td className="p-2.5 text-right font-bold text-emerald-900 bg-emerald-50/50 border-r border-slate-100">{currencySymbol}{r.net_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="p-2.5 text-center font-bold text-slate-900 border-r border-slate-100">{r.next_due_date}</td>
                    <td className="p-2.5 font-sans text-slate-600">{r.received_by}</td>
                  </tr>
                ))}
                {filteredRecords.length === 0 && <tr><td colSpan="11" className="p-8 text-center font-sans text-slate-600 font-medium">No ledger entries found.</td></tr>}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold text-right text-xs">
                  <td colSpan="5" className="p-3 text-left font-sans uppercase tracking-wider">TOTAL REVENUE & VAT</td>
                  <td className="p-3 text-white bg-slate-950">{currencySymbol}{totals.gross.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border-r border-slate-800"></td>
                  <td className="p-3 text-amber-400 bg-amber-950">{currencySymbol}{totals.vat.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="p-3 text-emerald-400 bg-emerald-950">{currencySymbol}{totals.net.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td colSpan="2" className="text-left font-sans text-slate-400 text-[10px] pl-3">{filteredRecords.length} Receipts</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'due-register' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden w-full">
          <div className="overflow-x-auto custom-scrollbar w-full">
            <table className="w-full text-left text-sm border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 text-xs">
                  <th className="p-3">Customer Name</th><th className="p-3">Type</th><th className="p-3">Particulars</th><th className="p-3 font-mono">Next Due Date</th><th className="p-3 text-center">Status</th><th className="p-3 text-right">Last Gross Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {dueRegisterRecords.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-bold text-slate-900">{r.customer_name}</td>
                    <td className="p-3 font-bold text-slate-700 text-[10px] uppercase">{r.customer_type}</td>
                    <td className="p-3 text-xs text-slate-600">{r.description}</td>
                    <td className="p-3 font-mono font-bold text-slate-900 bg-slate-50">{r.next_due_date}</td>
                    <td className="p-3 text-center"><span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${r.badgeClass}`}>{r.status} ({r.diffDays}d)</span></td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">₦{r.gross_amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'monthly' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 w-full overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 mb-6 gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">Monthly Income & Tax Report</h2>
              <p className="text-xs text-slate-600 mt-0.5">Selected Month: <span className="font-bold">{selectedMonth}</span></p>
            </div>
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full sm:w-auto px-3 py-2 text-sm font-bold border border-slate-300 rounded-lg text-slate-900 bg-slate-50">
              {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto custom-scrollbar w-full">
            <table className="w-full text-left text-sm border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-y border-slate-200 text-xs">
                  <th className="p-3">Stream Category</th><th className="p-3 text-center">Count</th><th className="p-3 text-right">Gross Total (₦)</th><th className="p-3 text-right text-amber-800">7.5% VAT (₦)</th><th className="p-3 text-right font-black">Net Income (₦)</th><th className="p-3 text-right">% Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-900">
                {monthlySummaryData.categoryBreakdown.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-bold">{item.category}</td>
                    <td className="p-3 text-center font-mono text-slate-600">{item.count}</td>
                    <td className="p-3 text-right font-mono font-medium">₦{item.gross.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="p-3 text-right font-mono font-bold text-amber-700">₦{item.vat.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-800">₦{item.net.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-500">{item.percentage}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold text-sm">
                  <td className="p-3 uppercase text-xs">TOTAL MONTHLY REVENUE</td>
                  <td className="p-3 text-center font-mono">{monthlyRecords.length}</td>
                  <td className="p-3 text-right font-mono">₦{monthlySummaryData.totalGross.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="p-3 text-right font-mono text-amber-400">₦{monthlySummaryData.totalVat.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="p-3 text-right font-mono text-emerald-400">₦{monthlySummaryData.totalNet.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="p-3 text-right font-mono">100.0%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="font-bold text-lg mb-4 border-b border-slate-200 pb-2 text-slate-900">Post Income Payment Receipt</h3>
            <form onSubmit={handleAddIncome} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="text-[10px] font-bold text-slate-900 block mb-1">Payment Date</label><input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 text-slate-900" /></div>
                <div><label className="text-[10px] font-bold text-slate-900 block mb-1">Invoice / Receipt #</label><input type="text" required value={formData.invNo} onChange={e => setFormData({...formData, invNo: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono font-bold bg-slate-50 text-slate-900" /></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2"><label className="text-[10px] font-bold text-slate-900 block mb-1">Customer Name</label><input type="text" required placeholder="e.g. Zenith Tech Park" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400" /></div>
                <div><label className="text-[10px] font-bold text-slate-900 block mb-1">Customer Type</label><select value={formData.customerType} onChange={e => setFormData({...formData, customerType: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 text-slate-900 font-bold"><option value="FTTH">FTTH (Home)</option><option value="Enterprise">Enterprise</option></select></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="text-[10px] font-bold text-slate-900 block mb-1">Income Stream Category</label><select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 text-slate-900 font-bold">{INCOME_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
                <div><label className="text-[10px] font-bold text-slate-900 block mb-1">Payment Mode</label><select value={formData.paymentMode} onChange={e => setFormData({...formData, paymentMode: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 text-slate-900 font-bold"><option value="Bank Transfer">Bank Transfer</option><option value="Card Payment">Card Payment</option><option value="Cash">Cash</option></select></div>
              </div>

              <div><label className="text-[10px] font-bold text-slate-900 block mb-1">Particulars / Description</label><input type="text" required placeholder="e.g. 50Mbps Dedicated Fiber Internet" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400" /></div>

              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl space-y-3">
                <div className="flex justify-between items-center"><span className="text-xs font-bold text-amber-900">💰 7.5% Auto-VAT Calculation Engine</span><label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-800"><input type="checkbox" checked={formData.isVatExempt} onChange={e => setFormData({...formData, isVatExempt: e.target.checked})} className="w-4 h-4 rounded text-emerald-600 border-slate-400" /><span>VAT Exempt</span></label></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="text-[10px] font-bold text-slate-900 block mb-1">Gross Amount (₦)</label><input type="number" required placeholder="0.00" value={formData.grossAmount} onChange={e => setFormData({...formData, grossAmount: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono font-bold bg-white text-slate-900 placeholder:text-slate-400" /></div>
                  <div><label className="text-[10px] font-bold text-slate-900 block mb-1">Calculation Type</label><select disabled={formData.isVatExempt} value={formData.vatCalculationType} onChange={e => setFormData({...formData, vatCalculationType: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-100 text-slate-900 font-bold"><option value="INCLUSIVE">Inclusive (7.5% Inside Total)</option><option value="EXCLUSIVE">Exclusive (+7.5% Added)</option></select></div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-amber-200 font-mono text-xs">
                  <div className="text-slate-900 font-bold">Gross: ₦{calculatedTax.gross.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                  <div className="text-amber-800 font-bold">VAT: ₦{calculatedTax.vat.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                  <div className="text-emerald-800 font-bold">Net: ₦{calculatedTax.net.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl space-y-3">
                <p className="text-xs font-bold text-blue-900">🗓️ Duration & Subscription Expiration</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-900 block mb-1">Duration Cycle</label>
                    <select value={formData.durationMonths} onChange={e => setFormData({...formData, durationMonths: parseInt(e.target.value)})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 font-bold"><option value={1}>1 Month (Monthly)</option><option value={3}>3 Months (Quarterly)</option><option value={6}>6 Months (Bi-Annual)</option><option value={12}>12 Months (1 Year)</option><option value={0}>One-off / Non-recurring</option><option value={-1}>Custom Months</option></select>
                  </div>
                  {formData.durationMonths === -1 ? (
                    <div><label className="text-[10px] font-bold text-slate-900 block mb-1">Number of Months</label><input type="number" min="1" placeholder="e.g. 5" value={formData.customMonths} onChange={e => setFormData({...formData, customMonths: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900" /></div>
                  ) : (
                    <div><label className="text-[10px] font-bold text-slate-900 block mb-1">Next Due Date (Auto)</label><input type="date" value={formData.nextDueDate || calculatedDueDate} onChange={e => setFormData({...formData, nextDueDate: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono font-bold bg-white text-slate-900" /></div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-slate-200 mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 sm:py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg text-sm w-full sm:w-auto transition shadow-sm">Cancel</button>
                <button type="submit" className="px-4 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm shadow-sm w-full sm:w-auto transition">Post Income & VAT</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleLayout>
  );
}