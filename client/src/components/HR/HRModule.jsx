// HRModule.jsx
import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { Users, Calculator, Coins, ShieldAlert, Sliders } from 'lucide-react';

export default function HRModule() {
  const { authFetch } = useContext(AppContext);
  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  
  // Dynamic Calculation Form Fields
  const [bonuses, setBonuses] = useState(0);
  const [overtime, setOvertime] = useState(0);
  const [penalties, setPenalties] = useState(0);
  const [spoilage, setSpoilage] = useState(0);
  const [lateComing, setLateComing] = useState(0);
  const [salaryAdvance, setSalaryAdvance] = useState(0);
  const [taxRate, setTaxRate] = useState(10);
  const [healthIns, setHealthIns] = useState(5000);

  // Balanced Scorecard appraisal inputs
  const [hrScore, setHrScore] = useState(80);
  const [hodScore, setHodScore] = useState(80);
  const [gmScore, setGmScore] = useState(80);

  useEffect(() => {
    loadHRRecords();
  }, []);

  const loadHRRecords = async () => {
    try {
      const res = await authFetch('/api/hr/employees');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
        if (data.length > 0 && !selectedEmpId) {
          handleEmployeeSelection(data[0]);
        }
      }
    } catch (e) { console.error(e); }
  };

  const handleEmployeeSelection = (emp) => {
    setSelectedEmpId(emp.id);
    setBonuses(emp.bonuses || 0);
    setOvertime(emp.overtime || 0);
    setPenalties(emp.penalties || 0);
    setSpoilage(emp.spoilage || 0);
    setLateComing(emp.lateComing || 0);
    setSalaryAdvance(emp.salaryAdvance || 0);
    setTaxRate(emp.taxRate || 10);
    setHealthIns(emp.healthInsurance || 5000);
    
    setHrScore(emp.hrScore || 80);
    setHodScore(emp.hodScore || 80);
    setGmScore(emp.gmScore || 80);
  };

  const currentEmp = employees.find(e => e.id === selectedEmpId);

  // Live Payroll Mathematical Formulas Engine
  const computation = React.useMemo(() => {
    if (!currentEmp) return { gross: 0, deductions: 0, net: 0 };
    
    const base = currentEmp.baseSalary || 0;
    const grossEarned = base + Number(bonuses) + Number(overtime) + (currentEmp.salesComm || 0);
    
    const taxDeduction = grossEarned * (Number(taxRate) / 100);
    const cumulativeDeductions = Number(penalties) + Number(spoilage) + Number(lateComing) + Number(salaryAdvance) + Number(healthIns) + taxDeduction;
    
    return {
      gross: grossEarned,
      deductions: cumulativeDeductions,
      net: Math.max(0, grossEarned - cumulativeDeductions)
    };
  }, [currentEmp, bonuses, overtime, penalties, spoilage, lateComing, salaryAdvance, taxRate, healthIns]);

  const handleSaveAdjustments = async (e) => {
    e.preventDefault();
    try {
      await authFetch(`/api/hr/payroll-adjustments/${selectedEmpId}`, {
        method: 'PUT',
        body: JSON.stringify({
          penalties, spoilage, lateComing, absenteeism: 0, damagedProperty: 0,
          salaryAdvance, bonuses, commissions: currentEmp?.salesComm || 0, overtime,
          taxRate, healthInsurance: healthIns, rentAdvance: 0
        })
      });
      loadHRRecords();
      alert("Payroll adjustments saved into ledger vector.");
    } catch (err) { console.error(err); }
  };

  const handleSaveAppraisal = async () => {
    try {
      await authFetch(`/api/hr/appraisals/${selectedEmpId}`, {
        method: 'PUT',
        body: JSON.stringify({ hrScore: Number(hrScore), hodScore: Number(hodScore), gmScore: Number(gmScore) })
      });
      loadHRRecords();
      alert("Performance Appraisal scores committed successfully.");
    } catch (err) { console.error(err); }
  };

  return (
    <div className="space-y-6 text-slate-100 font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Staff Directory Selector Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 mb-3 uppercase">Employee Ledger Registry</h3>
          {employees.map(e => (
            <div
              key={e.id}
              onClick={() => handleEmployeeSelection(e)}
              className={`p-3 rounded-lg border font-mono text-xs cursor-pointer transition-all ${selectedEmpId === e.id ? 'bg-teal-950/40 border-teal-500' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
            >
              <h4 className="font-bold font-sans text-sm text-white truncate">{e.name}</h4>
              <p className="text-slate-400 mt-1">{e.dept}</p>
              <p className="text-teal-400 text-[11px] mt-0.5">Base: ₦{(e.baseSalary || 0).toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Dynamic Payroll Math Panel */}
        {currentEmp ? (
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex flex-col md:flex-row justify-between border-b border-slate-800 pb-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{currentEmp.name}</h3>
                  <p className="text-xs font-mono text-slate-500">{currentEmp.dept} — Employee Reference Code: {currentEmp.id}</p>
                </div>
                {/* Payroll Computation Display Nodes */}
                <div className="flex space-x-6 text-xs font-mono mt-4 md:mt-0">
                  <div className="text-right">
                    <span className="text-slate-500">Gross Remuneration</span>
                    <p className="text-sm font-bold text-slate-200">₦{computation.gross.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500">Deductions Node</span>
                    <p className="text-sm font-bold text-rose-400">₦{computation.deductions.toLocaleString()}</p>
                  </div>
                  <div className="text-right bg-teal-500/10 border border-teal-500/20 px-3 py-1 rounded">
                    <span className="text-teal-400 font-bold">Net Payout Vector</span>
                    <p className="text-lg font-bold text-teal-400">₦{computation.net.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Ledger Adjustment Input Forms */}
              <form onSubmit={handleSaveAdjustments} className="space-y-4">
                <h4 className="text-xs font-bold font-mono tracking-wider text-slate-400 uppercase">Interactive Ledger adjustments inputs</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                  <div>
                    <label className="block text-slate-500 mb-1">Add: Bonuses (₦)</label>
                    <input type="number" value={bonuses} onChange={e => setBonuses(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-right" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Add: Overtime Compensation (₦)</label>
                    <input type="number" value={overtime} onChange={e => setOvertime(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-right" />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-rose-400 mb-1">Deduct: Spoilage / Damage (₦)</label>
                    <input type="number" value={spoilage} onChange={e => setSpoilage(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-right" />
                  </div>
                  <div>
                    <label className="block text-rose-400 mb-1">Deduct: Late Coming / Absence (₦)</label>
                    <input type="number" value={lateComing} onChange={e => setLateComing(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-right" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Deduct: Rent / Salary Advance (₦)</label>
                    <input type="number" value={salaryAdvance} onChange={e => setSalaryAdvance(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-right" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Deduct: Health Insurance (₦)</label>
                    <input type="number" value={healthIns} onChange={e => setHealthIns(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-right" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Statutory PAYE Tax Rate (%)</label>
                    <input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-center" />
                  </div>
                  <div className="flex items-end">
                    <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-sans font-medium py-2 rounded transition-all">Save Adjustments</button>
                  </div>
                </div>
              </form>
            </div>

            {/* Appraisal Matrices Section */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <h4 className="text-xs font-bold font-mono tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-teal-400" /> Dynamic Performance Appraisal Weights
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs font-mono">
                <div className="space-y-1">
                  <div className="flex justify-between"><span className="text-slate-500">HR Weight:</span> <span className="text-teal-400 font-bold">{hrScore}%</span></div>
                  <input type="range" min="0" max="100" value={hrScore} onChange={e => setHrScore(e.target.value)} className="w-full accent-teal-500 bg-slate-950 rounded h-1.5" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between"><span className="text-slate-500">HOD Weight:</span> <span className="text-teal-400 font-bold">{hodScore}%</span></div>
                  <input type="range" min="0" max="100" value={hodScore} onChange={e => setHodScore(e.target.value)} className="w-full accent-teal-500 bg-slate-950 rounded h-1.5" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between"><span className="text-slate-500">GM Final Command Weight:</span> <span className="text-teal-400 font-bold">{gmScore}%</span></div>
                  <input type="range" min="0" max="100" value={gmScore} onChange={e => setGmScore(e.target.value)} className="w-full accent-teal-500 bg-slate-950 rounded h-1.5" />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button type="button" onClick={handleSaveAppraisal} className="bg-slate-800 hover:bg-slate-700 text-teal-400 border border-slate-700 px-4 py-1.5 rounded text-xs font-medium">
                  Commit Appraisal Score
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-3 text-slate-500 text-xs flex items-center justify-center border border-dashed border-slate-800 rounded-xl">Select an active staff ledger coordinate to compute compensation statements.</div>
        )}

      </div>
    </div>
  );
}