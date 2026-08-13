import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const downloadPDF = (surveyData) => {
  const doc = new jsPDF();
  
  doc.setFontSize(22);
  doc.setTextColor(13, 148, 136); 
  doc.text("VOIX NETWORKS LTD.", 14, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Official Advice of Quote (AQ) / Proforma Invoice", 14, 28);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 34);
  
  doc.setDrawColor(200);
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 40, 182, 30, 'FD');
  doc.setTextColor(0);
  doc.text(`Client: ${surveyData.customer}`, 20, 48);
  doc.text(`Location: ${surveyData.location}`, 20, 56);
  doc.text(`Service Plan: ${surveyData.proposedPlan}`, 20, 64);

  const tableData = [
    ["Fiber Cable & Poles", "Materials", `N${Number(surveyData.materialCost || 0).toLocaleString()}`],
    ["Standard ONU CPE", "Hardware", `N${Number(surveyData.routerCost || 0).toLocaleString()}`],
    ["Splicing & Labour", "Service", `N${Number(surveyData.installationLabour || 0).toLocaleString()}`]
  ];

  doc.autoTable({
    startY: 80,
    head: [['Item Description', 'Category', 'Amount']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42] },
    foot: [['', 'TOTAL QUOTE:', `N${Number(surveyData.totalQuote || 0).toLocaleString()}`]],
    footStyles: { fillColor: [13, 148, 136], textColor: [255, 255, 255], fontStyle: 'bold' }
  });

  doc.save(`Voix_Invoice_${surveyData.customer.replace(/\s+/g, '_')}.pdf`);
};