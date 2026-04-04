// ==========================================
// Near Point Add Testing App
// ==========================================

// --- Physical Constants ---
const CREDIT_CARD_WIDTH_MM = 85.6;
const CREDIT_CARD_HEIGHT_MM = 53.98;
const M_UNIT_MM = 1.454; // 1M = 1.454mm height (x-height for reading charts)
const M_SIZES = [0.50, 0.75, 1.00, 1.25];
const DEFAULT_CSS_PX_PER_MM = 96 / 25.4; // ~3.78, CSS spec: 1in = 96px
const PT_TO_MM = 25.4 / 72; // 1pt = 0.3528mm

// --- Snellen Distance Acuity ---
const SLOAN_LETTERS = ['C', 'D', 'E', 'F', 'L', 'N', 'O', 'P', 'T', 'Z'];
const SNELLEN_LEVELS = [200, 100, 70, 50, 40, 30, 25, 20, 15, 10];

// --- Bailey-Lovie Chart ---
const BAILEY_LOVIE_LETTERS = ['D', 'E', 'F', 'H', 'N', 'P', 'R', 'U', 'V', 'Z'];
// LogMAR levels from 1.0 (20/200) down to -0.3 (20/10), step 0.1
const LOGMAR_LEVELS = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0, -0.1, -0.2, -0.3];
// Preset contrast levels (Weber %) for low-contrast testing
const CONTRAST_LEVELS = [100, 25, 10, 5, 2.5, 1.25];

// --- Document Types (fixed physical sizes) ---
const DOCUMENTS = [
    {
        name: 'Paperback Book',
        description: '11pt body text — typical mass-market or trade paperback',
        font: '"Georgia", "Times New Roman", serif',
        physicalEmMM: 11 * PT_TO_MM, // 3.88mm
        sample: `The morning light filtered through the curtains as she reached for the worn leather journal on the nightstand. Its pages, yellowed with age, held the stories of three generations — tales of quiet courage, unexpected love, and the ordinary moments that somehow became extraordinary in the retelling. She turned to where she had left off the night before and began to read.`
    },
    {
        name: 'Hardcover Novel',
        description: '12pt body text — standard hardcover fiction',
        font: '"Georgia", "Times New Roman", serif',
        physicalEmMM: 12 * PT_TO_MM, // 4.23mm
        sample: `He walked along the river path as the last colors of sunset reflected off the still water. Somewhere downstream, a church bell rang the hour, its tone carrying across the valley with a clarity that seemed to sharpen the evening air. He paused at the old stone bridge, resting his hands on the railing worn smooth by centuries of travelers who had stopped in this very spot.`
    },
    {
        name: 'Newspaper',
        description: '8.5pt body text — typical broadsheet or tabloid article',
        font: '"Times New Roman", "Georgia", serif',
        physicalEmMM: 8.5 * PT_TO_MM, // 3.0mm
        sample: `City officials announced Thursday that the proposed downtown transit expansion will proceed to a public comment period beginning next month. The $2.4 billion project, which has been under review since 2023, would add 12 miles of light rail connecting the central business district to three suburban corridors. Transit authority chair Margaret Chen said the project could reduce commute times by up to 35 percent for an estimated 140,000 daily riders.`
    },
    {
        name: 'Magazine',
        description: '10pt body text — typical glossy magazine article',
        font: '"Georgia", "Times New Roman", serif',
        physicalEmMM: 10 * PT_TO_MM, // 3.53mm
        sample: `The trend toward sustainable architecture has moved well beyond solar panels and recycled materials. Today's leading designers are incorporating living walls, passive ventilation systems, and bio-responsive facades that adapt to changing weather conditions. In Copenhagen, a recently completed office tower generates 20 percent more energy than it consumes, earning it recognition as the most efficient commercial building in Northern Europe.`
    },
    {
        name: 'iPhone / Android (Default)',
        description: '~17pt system font — default body text on most smartphones',
        font: '"Segoe UI", "Helvetica Neue", "Arial", sans-serif',
        physicalEmMM: 3.75, // measured: 17pt CSS at 460 PPI, 3x scaling
        sample: `Hey, are you still coming to dinner tonight? We changed the reservation to 7:30. Let me know if that still works for you.\n\nAlso, Mom asked if you can bring that salad you made last time. Everyone loved it.`
    },
    {
        name: 'Kindle / E-Reader (Default)',
        description: '~11pt Bookerly — factory default reading size',
        font: '"Georgia", "Palatino Linotype", serif',
        physicalEmMM: 3.9, // Kindle Paperwhite default size 4
        sample: `It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered as the rightful property of some one or other of their daughters.`
    },
    {
        name: 'Prescription / Medicine Label',
        description: '6pt — typical drug facts and dosage instructions',
        font: '"Arial", "Helvetica", sans-serif',
        physicalEmMM: 6 * PT_TO_MM, // 2.12mm
        sample: `Adults and children 12 years and over: Take 1 to 2 tablets every 4 to 6 hours while symptoms last. Do not take more than 6 tablets in 24 hours unless directed by a doctor. Children under 12 years: Ask a doctor. Store at 20-25\u00B0C (68-77\u00B0F). Protect from moisture. Keep out of reach of children.`
    },
    {
        name: 'Fine Print / Legal Disclaimer',
        description: '5pt — credit card agreements, insurance terms, package inserts',
        font: '"Arial", "Helvetica", sans-serif',
        physicalEmMM: 5 * PT_TO_MM, // 1.76mm
        sample: `By using this service you agree to be bound by these Terms and Conditions, including all amendments and revisions. The company reserves the right to modify, suspend, or discontinue the service at any time without prior notice. Liability is limited to the amount paid for the service in the twelve months preceding the claim. This agreement shall be governed by the laws of the State of Delaware without regard to conflict of law provisions. Arbitration of disputes is mandatory and shall be conducted in accordance with the rules of the American Arbitration Association.`
    }
];

// --- Standard Test Passages (different text at each size to prevent memorization) ---
const TEST_PASSAGES = {
    0.50: "The advancement of modern telecommunications has fundamentally transformed how information travels across global networks. Instantaneous data exchange between individuals and institutions separated by vast distances is now routine, enabling collaboration that was unimaginable just decades ago. This shift continues to accelerate as bandwidth increases and latency decreases.",
    0.75: "Research consistently demonstrates that regular physical exercise improves not only cardiovascular health but also cognitive function, emotional resilience, and overall quality of life. Walking thirty minutes each day has been shown to reduce the risk of chronic disease while enhancing memory retention and creative problem-solving ability in adults of all ages.",
    1.00: "The old lighthouse keeper climbed the winding stone staircase each evening as the sun dipped below the horizon. For over a century, the beacon atop the weathered tower had guided mariners safely through treacherous coastal waters. He took great pride in maintaining the light, knowing that countless lives depended on its steady glow.",
    1.25: "Mountain streams cascade over ancient moss-covered rocks, carrying minerals that enrich the fertile valleys below. For generations, farmers have cultivated these lowlands, planting orchards and tending fields that stretch toward the distant foothills."
};

// --- Monitor Resolution Defaults ---
const MONITOR_RES_DEFAULTS = {
    21: '1920x1080', 22: '1920x1080', 23: '1920x1080', 24: '1920x1080',
    25: '2560x1440', 27: '2560x1440',
    32: '3840x2160', 34: '3440x1440'
};

const SCALING_DEFAULTS = {
    '1920x1080': '100', '2560x1440': '100',
    '3840x2160': '150', '3440x1440': '100'
};

// --- Occupation Data ---
// Font sizes in pt (desktop apps) or px (web apps, marked with fontUnit:'px')
// Based on default application settings for each platform
const OCCUPATIONS = {
    'general': {
        title: 'General Office Work',
        apps: [
            {
                name: 'Web Browser (16px default)',
                description: 'Chrome / Edge - Website Body Text',
                font: '"Segoe UI", "Arial", sans-serif',
                fontSize: 16,
                fontUnit: 'px',
                sample: `Your order has been confirmed and is being prepared for shipment. You will receive a tracking number by email within 24 hours. If you have any questions about your order, please contact our support team or visit the Help Center for frequently asked questions.`
            },
            {
                name: 'Microsoft Word (11pt Calibri)',
                description: 'Microsoft Word - Document',
                font: '"Calibri", "Segoe UI", sans-serif',
                fontSize: 11,
                sample: `Please review the attached document and provide your feedback by end of day Friday. The revised proposal includes updated figures from the quarterly report as well as the new timeline discussed during last week's meeting. Let me know if you have any questions or need additional information.`
            },
            {
                name: 'Microsoft Excel (11pt Calibri)',
                description: 'Microsoft Excel - Spreadsheet',
                font: '"Calibri", "Segoe UI", sans-serif',
                fontSize: 11,
                tabular: {
                    headers: ['Item', 'Description', 'Qty', 'Unit Price', 'Total'],
                    alignments: ['left', 'left', 'right', 'right', 'right'],
                    rows: [
                        ['A-1001', 'Office Supplies', '24', '$12.50', '$300.00'],
                        ['A-1002', 'Printer Paper (case)', '6', '$45.99', '$275.94'],
                        ['A-1003', 'Toner Cartridge', '3', '$89.00', '$267.00'],
                        ['A-1004', 'USB Flash Drive 64GB', '10', '$8.75', '$87.50'],
                        ['A-1005', 'Desk Organizer', '4', '$22.00', '$88.00'],
                        ['', '', '', 'Subtotal:', '$1,018.44']
                    ]
                }
            },
            {
                name: 'Outlook Email (11pt Calibri)',
                description: 'Microsoft Outlook - Email',
                font: '"Calibri", "Segoe UI", sans-serif',
                fontSize: 11,
                sample: `Hi Team,\n\nJust a reminder that the staff meeting has been moved to 2:00 PM in Conference Room B. Please bring your project updates and any items you'd like to add to the agenda.\n\nThanks,\nJennifer`
            },
            {
                name: 'PDF Document (12pt Times)',
                description: 'Adobe Acrobat - PDF Report',
                font: '"Times New Roman", "Georgia", serif',
                fontSize: 12,
                sample: `The annual performance review indicates steady growth across all departments, with overall revenue increasing by 8.3% compared to the previous fiscal year. Customer satisfaction scores remained above the 90th percentile for the third consecutive quarter, reflecting the team's continued commitment to service excellence.`
            },
            {
                name: 'Small UI Text (9pt)',
                description: 'Toolbar / Menu / Status Bar Text',
                font: '"Segoe UI", "Arial", sans-serif',
                fontSize: 9,
                sample: `File  Edit  View  Insert  Format  Tools  Help  |  Page 1 of 12  |  Words: 3,847  |  English (United States)  |  100%  |  Last saved: 2:34 PM`
            }
        ]
    },
    'investment-banker': {
        title: 'Investment Banker',
        apps: [
            {
                name: 'Bloomberg Terminal',
                description: 'Bloomberg Terminal - Market Data',
                font: '"Consolas", "Courier New", monospace',
                fontSize: 11,
                fontUnit: 'px',
                dark: true,
                sample:
`AAPL US Equity   Last: 178.72  Chg: +2.34  %Chg: +1.33  Vol: 52.3M
MSFT US Equity   Last: 412.56  Chg: -1.87  %Chg: -0.45  Vol: 23.1M
GOOGL US Equity  Last: 163.24  Chg: +0.89  %Chg: +0.55  Vol: 18.7M
JPM US Equity    Last: 198.33  Chg: +3.12  %Chg: +1.60  Vol: 8.92M
GS US Equity     Last: 467.81  Chg: -2.45  %Chg: -0.52  Vol: 2.15M`
            },
            {
                name: 'Excel - Financial Model (11pt)',
                description: 'Microsoft Excel - DCF Model',
                font: '"Calibri", "Segoe UI", sans-serif',
                fontSize: 11,
                tabular: {
                    headers: ['Revenue ($M)', 'FY2023', 'FY2024E', 'FY2025E', 'FY2026E', 'CAGR'],
                    alignments: ['left', 'right', 'right', 'right', 'right', 'right'],
                    rows: [
                        ['Product Sales', '1,234.5', '1,389.2', '1,562.1', '1,756.4', '12.5%'],
                        ['Service Revenue', '567.3', '634.0', '709.2', '793.1', '11.8%'],
                        ['Total Revenue', '1,801.8', '2,023.2', '2,271.3', '2,549.5', '12.3%'],
                        ['COGS', '(990.1)', '(1,112.8)', '(1,249.2)', '(1,402.2)', ''],
                        ['Gross Profit', '811.7', '910.4', '1,022.1', '1,147.3', ''],
                        ['\u2003Gross Margin', '45.0%', '45.0%', '45.0%', '45.0%', '']
                    ]
                }
            },
            {
                name: 'Excel - Dense Spreadsheet (8pt)',
                description: 'Microsoft Excel - Sensitivity Table',
                font: '"Calibri", "Segoe UI", sans-serif',
                fontSize: 8,
                tabular: {
                    headers: ['EV/EBITDA', '8.0x', '8.5x', '9.0x', '9.5x', '10.0x', '10.5x'],
                    alignments: ['left', 'right', 'right', 'right', 'right', 'right', 'right'],
                    rows: [
                        ['WACC 8.0%', '$42.18', '$45.67', '$49.16', '$52.65', '$56.14', '$59.63'],
                        ['WACC 9.0%', '$38.52', '$41.78', '$45.04', '$48.30', '$51.56', '$54.82'],
                        ['WACC 10.0%', '$35.21', '$38.26', '$41.31', '$44.36', '$47.41', '$50.46'],
                        ['WACC 11.0%', '$32.19', '$35.05', '$37.91', '$40.77', '$43.63', '$46.49'],
                        ['WACC 12.0%', '$29.42', '$32.11', '$34.80', '$37.49', '$40.18', '$42.87']
                    ]
                }
            },
            {
                name: 'Outlook Email (11pt)',
                description: 'Microsoft Outlook - Email',
                font: '"Calibri", "Segoe UI", sans-serif',
                fontSize: 11,
                sample: `Subject: Q4 Earnings Update - CONFIDENTIAL\n\nHi Team,\n\nPlease find attached the revised financial projections for the proposed acquisition target. Key metrics have been updated to reflect the latest market conditions and management guidance from yesterday's call.\n\nThe implied EV/EBITDA multiple at the proposed offer price is 9.2x, which represents a 15% premium to the current trading level.\n\nPlease review and send comments by EOD Thursday.`
            }
        ]
    },
    'lawyer': {
        title: 'Lawyer',
        apps: [
            {
                name: 'Word - Legal Document (12pt TNR)',
                description: 'Microsoft Word - Contract',
                font: '"Times New Roman", "Georgia", serif',
                fontSize: 12,
                sample: `WHEREAS, the Party of the First Part (hereinafter referred to as "Licensor") hereby grants to the Party of the Second Part (hereinafter referred to as "Licensee") a non-exclusive, non-transferable license to use the intellectual property described in Exhibit A, subject to the terms and conditions set forth in this Agreement.\n\nSection 2.1  Term. The initial term of this Agreement shall commence on the Effective Date and shall continue for a period of thirty-six (36) months thereafter, unless earlier terminated in accordance with Section 8 of this Agreement.`
            },
            {
                name: 'Word - Footnotes (10pt TNR)',
                description: 'Microsoft Word - Legal Footnotes',
                font: '"Times New Roman", "Georgia", serif',
                fontSize: 10,
                sample: `1. See Johnson v. State, 482 U.S. 451, 461 (1987) (holding that the standard of review for summary judgment requires the moving party to demonstrate the absence of a genuine issue of material fact).\n2. Cf. Roberts v. Anderson, 127 F.3d 1082, 1085 (D.C. Cir. 1997) (distinguishing the instant case on grounds that the statutory language at issue was unambiguous on its face).\n3. But see Williams v. Taylor, 529 U.S. 362, 390 (2000) (cautioning that a de novo standard does not permit the reviewing court to substitute its own judgment for that of the trial court).`
            },
            {
                name: 'Westlaw - Case Research',
                description: 'Westlaw - Case Law Research',
                font: '"Georgia", "Times New Roman", serif',
                fontSize: 14,
                fontUnit: 'px',
                sample: `SUPREME COURT OF THE UNITED STATES\nNo. 21-1271\n\nJOHNSON v. DEPARTMENT OF COMMERCE\n\nOpinion of the Court\n\n   The question presented is whether the Administrative Procedure Act requires an agency to provide notice-and-comment rulemaking before issuing guidance documents that carry the force and effect of law. We hold that it does.\n\n   Respondent Department of Commerce issued Directive 2019-04 without prior notice or opportunity for public comment.`
            },
            {
                name: 'Outlook Email (11pt)',
                description: 'Microsoft Outlook - Legal Correspondence',
                font: '"Calibri", "Segoe UI", sans-serif',
                fontSize: 11,
                sample: `Dear Counsel,\n\nPlease be advised that the deposition of the plaintiff has been rescheduled to March 15, 2026 at 10:00 AM in our offices at 200 Park Avenue, 25th Floor. Kindly confirm your availability at your earliest convenience.\n\nWe also request that you produce the documents identified in our Second Request for Production no later than March 10, 2026.\n\nRegards,\nSarah Mitchell, Esq.`
            }
        ]
    },
    'accountant': {
        title: 'Accountant',
        apps: [
            {
                name: 'Excel - General Ledger (11pt)',
                description: 'Microsoft Excel - General Ledger',
                font: '"Calibri", "Segoe UI", sans-serif',
                fontSize: 11,
                tabular: {
                    headers: ['Acct', 'Description', 'Debit', 'Credit', 'Balance'],
                    alignments: ['left', 'left', 'right', 'right', 'right'],
                    rows: [
                        ['1010', 'Cash - Operating', '234,567.89', '', '234,567.89'],
                        ['1200', 'Accounts Receivable', '456,123.45', '', '456,123.45'],
                        ['2010', 'Accounts Payable', '', '198,234.56', '(198,234.56)'],
                        ['3010', 'Retained Earnings', '', '892,456.78', '(892,456.78)'],
                        ['4010', 'Revenue - Services', '', '567,890.12', '(567,890.12)'],
                        ['5010', 'Cost of Services', '312,456.78', '', '312,456.78'],
                        ['6010', 'Salaries Expense', '198,234.56', '', '198,234.56']
                    ]
                }
            },
            {
                name: 'Excel - Detail Cells (8pt)',
                description: 'Microsoft Excel - Detailed Worksheet',
                font: '"Calibri", "Segoe UI", sans-serif',
                fontSize: 8,
                tabular: {
                    headers: ['Inv#', 'Date', 'Vendor', 'Amount', 'Tax', 'Total', 'Status', 'GL Acct'],
                    alignments: ['left', 'left', 'left', 'right', 'right', 'right', 'left', 'left'],
                    rows: [
                        ['10234', '01/15/26', 'Office Depot', '$1,234.56', '$98.76', '$1,333.32', 'Paid', '6200'],
                        ['10235', '01/16/26', 'FedEx Shipping', '$456.78', '$36.54', '$493.32', 'Pending', '6300'],
                        ['10236', '01/17/26', 'Adobe Systems', '$599.88', '$47.99', '$647.87', 'Paid', '6150'],
                        ['10237', '01/18/26', 'AT&T Business', '$234.99', '$18.80', '$253.79', 'Paid', '6400'],
                        ['10238', '01/19/26', 'Staples Inc', '$167.45', '$13.40', '$180.85', 'Pending', '6200']
                    ]
                }
            },
            {
                name: 'Tax Software (9pt)',
                description: 'Drake Tax / Lacerte - Tax Form',
                font: '"Segoe UI", "Calibri", sans-serif',
                fontSize: 9,
                tabular: {
                    headers: ['Schedule C - Profit or Loss From Business', '', 'Amount'],
                    alignments: ['left', 'left', 'right'],
                    rows: [
                        ['Part I', 'Income', ''],
                        ['Line 1', 'Gross receipts or sales', '1,245,678.00'],
                        ['Line 2', 'Returns and allowances', '12,456.00'],
                        ['Line 3', 'Subtract line 2 from line 1', '1,233,222.00'],
                        ['Line 4', 'Cost of goods sold (from line 42)', '567,890.00'],
                        ['Line 5', 'Gross profit (subtract line 4 from 3)', '665,332.00'],
                        ['Line 6', 'Other income', '34,567.00'],
                        ['Line 7', 'Gross income (add lines 5 and 6)', '699,899.00']
                    ]
                }
            },
            {
                name: 'QuickBooks (10pt)',
                description: 'QuickBooks - Profit & Loss',
                font: '"Segoe UI", "Calibri", sans-serif',
                fontSize: 10,
                tabular: {
                    headers: ['Profit & Loss  (Jan\u2013Mar 2026)', 'Jan', 'Feb', 'Mar', 'Total'],
                    alignments: ['left', 'right', 'right', 'right', 'right'],
                    rows: [
                        ['Income', '', '', '', ''],
                        ['\u2003Consulting Services', '45,200.00', '52,100.00', '48,750.00', '146,050.00'],
                        ['\u2003Software Licenses', '12,500.00', '12,500.00', '12,500.00', '37,500.00'],
                        ['\u2003Training Revenue', '8,400.00', '6,200.00', '9,100.00', '23,700.00'],
                        ['Total Income', '66,100.00', '70,800.00', '70,350.00', '207,250.00'],
                        ['', '', '', '', ''],
                        ['Expenses', '', '', '', ''],
                        ['\u2003Payroll', '32,000.00', '32,000.00', '32,000.00', '96,000.00'],
                        ['\u2003Rent', '4,500.00', '4,500.00', '4,500.00', '13,500.00']
                    ]
                }
            }
        ]
    },
    'engineer': {
        title: 'Engineer',
        apps: [
            {
                name: 'AutoCAD / SolidWorks UI (9pt)',
                description: 'CAD Software - Properties Panel',
                font: '"Segoe UI", "Calibri", sans-serif',
                fontSize: 9,
                sample:
`PROPERTIES - Part Assembly Rev. 4.2
Layer:        DIMENSIONS
Color:        ByLayer (Yellow)
Linetype:     Continuous

Dimension Values:
  Length:      45.720 mm  +/- 0.005
  Width:       23.114 mm  +/- 0.010
  Depth:       12.700 mm  +/- 0.005
  Radius:       6.350 mm  +/- 0.002
  Surface Finish: 0.8 um Ra
  Material:   AISI 316L Stainless Steel
  Weight:     0.234 kg`
            },
            {
                name: 'MATLAB / Python IDE (10pt)',
                description: 'MATLAB - Script Editor',
                font: '"Consolas", "Courier New", monospace',
                fontSize: 10,
                dark: true,
                sample:
`function [stress, strain] = analyzeBeam(F, L, E, I)
    % Calculate bending stress and deflection
    % F = applied force (N), L = beam length (m)
    % E = Young's modulus (Pa), I = moment of inertia (m^4)

    x = linspace(0, L, 1000);
    M = F .* x .* (L - x) / L;      % Bending moment
    stress = M .* (0.05) ./ I;       % Max bending stress
    strain = stress ./ E;            % Strain (Hooke's law)
    deflection = F.*x.^2.*(3*L - x) / (6*E*I);

    fprintf('Max stress: %.2f MPa\\n', max(stress)/1e6);
    fprintf('Max deflection: %.4f mm\\n', max(deflection)*1000);
end`
            },
            {
                name: 'Visual Studio / VS Code (10pt)',
                description: 'IDE - C++ / Python Code',
                font: '"Consolas", "Courier New", monospace',
                fontSize: 10,
                dark: true,
                sample:
`#include <vector>
#include <algorithm>
#include <cmath>

struct SensorReading {
    double timestamp;
    double value;
    int    sensor_id;
};

double computeRMS(const std::vector<SensorReading>& data) {
    double sum_sq = 0.0;
    for (const auto& r : data) {
        sum_sq += r.value * r.value;
    }
    return std::sqrt(sum_sq / data.size());
}`
            },
            {
                name: 'Excel - Engineering Data (11pt)',
                description: 'Microsoft Excel - Test Results',
                font: '"Calibri", "Segoe UI", sans-serif',
                fontSize: 11,
                tabular: {
                    headers: ['Test ID', 'Specimen', 'Load (kN)', 'Disp (mm)', 'Stress (MPa)', 'Strain', 'Result'],
                    alignments: ['left', 'left', 'right', 'right', 'right', 'right', 'left'],
                    rows: [
                        ['T-2026-01', 'AL6061-T6', '45.23', '1.234', '312.8', '0.00456', 'PASS'],
                        ['T-2026-02', 'AL6061-T6', '44.87', '1.218', '310.3', '0.00452', 'PASS'],
                        ['T-2026-03', 'SS316L', '89.12', '0.567', '615.3', '0.00312', 'PASS'],
                        ['T-2026-04', 'SS316L', '88.56', '0.554', '611.4', '0.00308', 'PASS'],
                        ['T-2026-05', 'Ti6Al4V', '112.34', '0.892', '776.1', '0.00698', 'FAIL']
                    ]
                }
            }
        ]
    },
    'it': {
        title: 'IT Professional',
        apps: [
            {
                name: 'VS Code (14px default)',
                description: 'Visual Studio Code - Editor',
                font: '"Consolas", "Cascadia Code", "Courier New", monospace',
                fontSize: 14,
                fontUnit: 'px',
                dark: true,
                sample:
`const express = require('express');
const app = express();

app.get('/api/health', (req, res) => {
    const status = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    };
    res.json({ status: 'healthy', ...status });
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});`
            },
            {
                name: 'Terminal / PowerShell (12pt)',
                description: 'Terminal - CLI Commands',
                font: '"Consolas", "Cascadia Code", "Courier New", monospace',
                fontSize: 12,
                dark: true,
                sample:
`PS C:\\> kubectl get pods -n production
NAME                          READY   STATUS    RESTARTS   AGE
api-server-6d4f8b7c9-x2k4m   1/1     Running   0          4d
auth-svc-7f8a9b2c1-p3n5q     1/1     Running   2          12d
db-primary-0                  1/1     Running   0          30d
redis-cache-5c6d7e8f-j9k2l   1/1     Running   0          8d
worker-batch-4b5c6d7e-m1n8p   0/1     Error     5          1h

PS C:\\> docker ps --format "table {{.Names}}\\t{{.Status}}"
NAMES               STATUS
nginx-proxy         Up 12 days
postgres-14         Up 30 days
redis-7             Up 8 days`
            },
            {
                name: 'Log Files (10pt)',
                description: 'Application Logs',
                font: '"Consolas", "Courier New", monospace',
                fontSize: 10,
                dark: true,
                sample:
`2026-03-05 14:23:01.234 [INFO]  RequestHandler  - GET /api/users 200 12ms
2026-03-05 14:23:01.456 [INFO]  RequestHandler  - POST /api/auth 200 45ms
2026-03-05 14:23:02.789 [WARN]  ConnectionPool  - Pool size at 85% capacity
2026-03-05 14:23:03.012 [ERROR] PaymentService  - Timeout connecting to gateway
2026-03-05 14:23:03.234 [INFO]  RetryHandler    - Retrying payment (attempt 2/3)
2026-03-05 14:23:04.567 [INFO]  PaymentService  - Payment processed: $1,234.56
2026-03-05 14:23:05.890 [INFO]  RequestHandler  - GET /api/dashboard 200 89ms`
            },
            {
                name: 'Jira / Web App (14px)',
                description: 'Jira - Project Board',
                font: '"Segoe UI", "-apple-system", sans-serif',
                fontSize: 14,
                fontUnit: 'px',
                sample:
`PROJ-1234  Migrate authentication to OAuth 2.0
           Priority: High | Assignee: J. Chen | Sprint 24
           Status: In Progress | Story Points: 8

PROJ-1235  Fix memory leak in background worker
           Priority: Critical | Assignee: M. Torres | Sprint 24
           Status: Code Review | Story Points: 5

PROJ-1236  Add rate limiting to public API endpoints
           Priority: Medium | Assignee: A. Patel | Sprint 25
           Status: To Do | Story Points: 3

PROJ-1237  Update TLS certificates before March expiry
           Priority: Critical | Assignee: S. Kim | Sprint 24
           Status: Done | Story Points: 2`
            }
        ]
    },
    'musician': {
        title: 'Musician',
        apps: [
            {
                name: 'Standard Sheet Music (7mm staff)',
                description: 'Printed Sheet Music \u2014 Standard Part',
                sheetMusic: {
                    staffSpaceMM: 1.75,
                    keySig: 1,
                    timeSig: [4, 4],
                    bars: [
                        [{p:6,d:.5,bm:'a'},{p:7,d:.5,bm:'a'},{p:8,d:1},{p:9,d:2}],
                        [{p:7,d:1},{p:6,d:.5,bm:'b'},{p:5,d:.5,bm:'b'},{p:4,d:1},{p:3,d:1}],
                        [{p:2,d:2},{p:4,d:.5,bm:'c'},{p:6,d:.5,bm:'c'},{p:5,d:1}],
                        [{p:4,d:2,dot:1},{r:1,d:1}]
                    ]
                }
            },
            {
                name: 'Miniature Score (4.4mm staff)',
                description: 'Orchestral Study Score \u2014 Pocket Edition',
                sheetMusic: {
                    staffSpaceMM: 1.1,
                    keySig: 2,
                    timeSig: [3, 4],
                    bars: [
                        [{p:8,d:1},{p:7,d:.5,bm:'d'},{p:6,d:.5,bm:'d'},{p:5,d:1}],
                        [{p:4,d:1.5},{p:3,d:.5},{p:2,d:1}],
                        [{p:3,d:.5,bm:'e'},{p:4,d:.5,bm:'e'},{p:5,d:.5,bm:'f'},{p:6,d:.5,bm:'f'},{p:7,d:1}],
                        [{p:5,d:2,dot:1}]
                    ]
                }
            },
            {
                name: 'Lead Sheet / Chord Chart (12pt)',
                description: 'Real Book Style \u2014 Chord Chart',
                font: '"Courier New", "Consolas", monospace',
                fontSize: 12,
                sample: `  Cmaj7        Dm7          G7           Cmaj7\n\u2502  /  /  /  /  \u2502  /  /  /  /  \u2502  /  /  /  /  \u2502  /  /  /  /  \u2502\n\n  Am7          D7           Gmaj7        Em7\n\u2502  /  /  /  /  \u2502  /  /  /  /  \u2502  /  /  /  /  \u2502  /  /  /  /  \u2502\n\n  Fmaj7        Fm7          Em7          A7\n\u2502  /  /  /  /  \u2502  /  /  /  /  \u2502  /  /  /  /  \u2502  /  /  /  /  \u2502\n\n  Dm7          G7           Cmaj7        Cmaj7\n\u2502  /  /  /  /  \u2502  /  /  /  /  \u2502  /  /  /  /  \u2502  /  /  /  /  \u2551`
            }
        ]
    }
};

// --- App State ---
let state = {
    cssPixelsPerMm: null,
    calibrationSource: null,
    monitorSize: 24,
    monitorResolution: '1920x1080',
    displayScaling: 150,
    workingDistance: 60, // cm
    distanceUnit: 'cm',
    occupation: 'general',
    zoomFactor: 1.0
};

// --- Distance Tab State ---
let distanceSnellenIndex = 4; // index into SNELLEN_LEVELS, starts at 20/40
let distanceLetters = [];
let baileyLovieMode = false;
let blLogmarIndex = 7; // index into LOGMAR_LEVELS, starts at LogMAR 0.3 (≈20/40)
let blLetters = [];
let contrastPercent = 100; // Weber contrast percentage

// --- CSF Test State ---
const CSF_ALL_LEVELS = [100, 70, 50, 40, 30, 25, 20, 15, 10]; // full range, tested top-down
const CSF_LETTERS_PASS1 = 8;   // single letter per contrast (coarse survey)
const CSF_LETTERS_PASS2 = 10;  // 2 letters at each of 5 contrast levels (paired validation)
const CSF_MIN_CONTRAST = 1.25; // Display floor %

const csfState = {
    active: false,
    pass: 1,            // 1 = coarse, 2 = refined
    levelIndex: 0,
    levels: [],         // current pass's level list (denoms, may include non-standard like 20/18)
    currentLetters: [],
    currentContrasts: [],
    results: {},        // keyed by snellenDenom: { coarseThreshold, refinedThreshold }
    channel: null,
    clinicianWindow: null,
    waitingForClinician: false
};

// --- Font Metrics Cache ---
const fontXHeightRatios = {};

// --- DOM Helpers ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    loadCalibration();
    setupCalibrationScreen();
    setupInputScreen();
    setupTestScreen();
    setupWelcomeScreen();
    setupDistanceCalScreen();

    // Always start at welcome screen
    showScreen('welcome');
});

function showScreen(name) {
    $$('.screen').forEach(s => s.classList.add('hidden'));
    $(`#${name}-screen`).classList.remove('hidden');

    // Clear distance clean mode when leaving test screen
    if (name !== 'test') {
        $('#test-screen').classList.remove('distance-clean');
    }

    if (name === 'input') {
        updateConfigSummary();
    }
}

// ==========================================
// WELCOME SCREEN
// ==========================================

function setupWelcomeScreen() {
    $('#mode-near-btn').addEventListener('click', () => {
        if (state.cssPixelsPerMm) {
            showScreen('input');
        } else {
            showScreen('calibration');
        }
    });

    $('#mode-distance-btn').addEventListener('click', () => {
        showScreen('distance-cal');
    });
}

// ==========================================
// DISTANCE CALIBRATION SCREEN
// ==========================================

function setupDistanceCalScreen() {
    const cardEl = $('#dist-cal-card');
    const sizeSlider = $('#dist-cal-slider');
    const sizeReadout = $('#dist-cal-readout');
    const gammaSlider = $('#dist-cal-gamma');
    const gammaReadout = $('#dist-cal-gamma-readout');
    const circleEl = $('#dist-cal-circle');

    // Restore saved values
    const savedGamma = localStorage.getItem('nearpoint_gamma_grey');
    if (savedGamma) {
        gammaSlider.value = savedGamma;
        circleEl.style.backgroundColor = `rgb(${savedGamma},${savedGamma},${savedGamma})`;
        gammaReadout.textContent = savedGamma;
    }

    const savedPxPerMm = localStorage.getItem('nearpoint_dist_px_per_mm');
    if (savedPxPerMm) {
        const px = parseFloat(savedPxPerMm) * 85.6;
        sizeSlider.value = px;
        cardEl.style.width = px + 'px';
        cardEl.style.height = (px / 1.585) + 'px';
        sizeReadout.textContent = Math.round(px) + ' px';
    }

    // Credit card size slider
    sizeSlider.addEventListener('input', () => {
        const px = parseFloat(sizeSlider.value);
        cardEl.style.width = px + 'px';
        cardEl.style.height = (px / 1.585) + 'px';
        sizeReadout.textContent = Math.round(px) + ' px';
    });

    // Gamma slider
    gammaSlider.addEventListener('input', () => {
        const v = gammaSlider.value;
        circleEl.style.backgroundColor = `rgb(${v},${v},${v})`;
        gammaReadout.textContent = v;
    });

    // Back button
    $('#dist-cal-back').addEventListener('click', () => showScreen('welcome'));

    // Start distance testing
    $('#dist-cal-start').addEventListener('click', () => {
        // Save calibration
        const pxPerMm = parseFloat(sizeSlider.value) / 85.6;
        localStorage.setItem('nearpoint_dist_px_per_mm', pxPerMm);
        localStorage.setItem('nearpoint_gamma_grey', gammaSlider.value);

        // Apply to state
        state.cssPixelsPerMm = pxPerMm;

        // Set testing distance from input
        const distVal = parseFloat($('#dist-cal-distance').value) || 20;
        const distUnit = $('#dist-cal-dist-unit').value;

        // Show test screen in clean mode (no toolbars, just hallway bg + letters)
        showScreen('test');
        $('#test-screen').classList.add('distance-clean');

        // Activate distance tab
        const distTab = $('[data-tab="distance"]');
        if (distTab) distTab.click();

        // Set distance slider values
        const slider = $('#distance-test-slider');
        const unitToggle = $('#distance-test-unit');
        if (distUnit === 'm') {
            unitToggle.dataset.unit = 'm';
            unitToggle.textContent = 'm';
            slider.min = 1.5; slider.max = 12; slider.step = 0.1;
            slider.value = distVal;
        } else {
            unitToggle.dataset.unit = 'ft';
            unitToggle.textContent = 'ft';
            slider.min = 5; slider.max = 40; slider.step = 0.5;
            slider.value = distVal;
        }
        $('#distance-test-value').textContent = parseFloat(slider.value).toFixed(1);
        renderDistanceTest();

        // Set up persistent channel and launch clinician
        setupDistanceChannel();
        launchClinicianWindow();
    });
}

let clinicianWindow = null;
let distanceChannel = null; // persistent channel for line controls

function setupDistanceChannel() {
    if (distanceChannel) return;
    distanceChannel = new BroadcastChannel('nearpoint-csf');
    distanceChannel.onmessage = (e) => {
        const data = e.data;
        // Line control messages from clinician
        switch (data.type) {
            case 'line-up':
                if (!csfState.active) $('#snellen-up-btn').click();
                break;
            case 'line-down':
                if (!csfState.active) $('#snellen-down-btn').click();
                break;
            case 'line-refresh':
                if (!csfState.active) $('#snellen-refresh-btn').click();
                break;
            case 'csf-start-remote':
                if (!csfState.active) csfStartTest();
                break;
            default:
                // Forward CSF messages to the CSF handler
                csfHandleClinicianMessage(data);
                break;
        }
    };
}

// Broadcast current line indicator to clinician
function broadcastLineUpdate() {
    if (distanceChannel) {
        const indicator = $('#snellen-indicator');
        if (indicator) {
            distanceChannel.postMessage({ type: 'line-update', indicator: indicator.textContent });
        }
    }
}

function launchClinicianWindow() {
    if (!clinicianWindow || clinicianWindow.closed) {
        clinicianWindow = window.open('clinician.html', 'csf-clinician', 'width=700,height=900');
    } else {
        clinicianWindow.focus();
    }
}

// ==========================================
// CALIBRATION
// ==========================================

function loadCalibration() {
    const saved = localStorage.getItem('nearpoint_calibration');
    if (saved) {
        const data = JSON.parse(saved);
        state.cssPixelsPerMm = data.cssPixelsPerMm;
        state.calibrationSource = data.source;
    }
}

function saveCalibration(pxPerMm, source) {
    state.cssPixelsPerMm = pxPerMm;
    state.calibrationSource = source;
    localStorage.setItem('nearpoint_calibration', JSON.stringify({
        cssPixelsPerMm: pxPerMm,
        source: source
    }));
}

function setupCalibrationScreen() {
    // Device preset buttons
    $$('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const ppi = parseFloat(btn.dataset.ppi);
            const name = btn.dataset.name;

            $$('.preset-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            if (ppi === 0) {
                // "Other" selected - highlight manual calibration
                $('.method-section:last-child').scrollIntoView({ behavior: 'smooth' });
                return;
            }

            // Calculate CSS px/mm from physical PPI and devicePixelRatio
            const dpr = window.devicePixelRatio || 1;
            const cssPPI = ppi / dpr;
            const pxPerMm = cssPPI / 25.4;

            saveCalibration(pxPerMm, name);
            showCalibrationStatus(name, pxPerMm);
            setTimeout(() => showScreen('input'), 600);
        });
    });

    // Manual calibration slider
    const slider = $('#calibration-slider');
    const card = $('#calibration-card');
    const valueDisplay = $('#calibration-value');

    function updateCardSize() {
        const scale = slider.value / 100;
        const pxPerMm = DEFAULT_CSS_PX_PER_MM * scale;
        card.style.width = (CREDIT_CARD_WIDTH_MM * pxPerMm) + 'px';
        card.style.height = (CREDIT_CARD_HEIGHT_MM * pxPerMm) + 'px';
        valueDisplay.textContent = slider.value + '%';
    }

    slider.addEventListener('input', updateCardSize);
    updateCardSize();

    $('#save-manual-calibration').addEventListener('click', () => {
        const scale = slider.value / 100;
        const pxPerMm = DEFAULT_CSS_PX_PER_MM * scale;
        saveCalibration(pxPerMm, 'Manual calibration');
        showCalibrationStatus('Manual', pxPerMm);
        setTimeout(() => showScreen('input'), 600);
    });
}

function showCalibrationStatus(name, pxPerMm) {
    const bar = $('#calibration-status');
    bar.classList.remove('hidden');
    $('#calibration-device-name').textContent = name;
    $('#calibration-ppmm').textContent = pxPerMm.toFixed(2);
}

// ==========================================
// INPUT SCREEN
// ==========================================

function setupInputScreen() {
    const monitorSize = $('#monitor-size');
    const monitorRes = $('#monitor-resolution');
    const scaling = $('#display-scaling');
    const distance = $('#working-distance');
    const unitToggle = $('#distance-unit');
    const occupation = $('#occupation');

    // Auto-fill resolution when monitor size changes
    monitorSize.addEventListener('change', () => {
        const size = parseInt(monitorSize.value);
        if (MONITOR_RES_DEFAULTS[size]) {
            monitorRes.value = MONITOR_RES_DEFAULTS[size];
            // Also update scaling default
            if (SCALING_DEFAULTS[monitorRes.value]) {
                scaling.value = SCALING_DEFAULTS[monitorRes.value];
            }
        }
        updateConfigSummary();
    });

    monitorRes.addEventListener('change', () => {
        if (SCALING_DEFAULTS[monitorRes.value]) {
            scaling.value = SCALING_DEFAULTS[monitorRes.value];
        }
        updateConfigSummary();
    });

    // Distance unit toggle (cm <-> inches)
    unitToggle.addEventListener('click', () => {
        const currentUnit = unitToggle.dataset.unit;
        const val = parseFloat(distance.value);
        if (currentUnit === 'cm') {
            unitToggle.dataset.unit = 'in';
            unitToggle.textContent = 'in';
            distance.value = Math.round(val / 2.54);
            distance.min = 8;
            distance.max = 60;
            state.distanceUnit = 'in';
        } else {
            unitToggle.dataset.unit = 'cm';
            unitToggle.textContent = 'cm';
            distance.value = Math.round(val * 2.54);
            distance.min = 20;
            distance.max = 150;
            state.distanceUnit = 'cm';
        }
        updateVergence();
        updateConfigSummary();
    });

    distance.addEventListener('input', () => {
        updateVergence();
        updateConfigSummary();
    });

    [scaling, occupation].forEach(el => el.addEventListener('change', updateConfigSummary));

    // Form submit
    $('#patient-form').addEventListener('submit', (e) => {
        e.preventDefault();
        readFormValues();
        showScreen('test');
        renderTest();
    });

    // Recalibrate button
    $('#recalibrate-btn').addEventListener('click', () => showScreen('calibration'));

    // Set correct scaling default on page load based on initial resolution
    if (SCALING_DEFAULTS[monitorRes.value]) {
        scaling.value = SCALING_DEFAULTS[monitorRes.value];
    }

    updateVergence();
    updateConfigSummary();
}

function readFormValues() {
    state.monitorSize = parseInt($('#monitor-size').value);
    state.monitorResolution = $('#monitor-resolution').value;
    state.displayScaling = parseInt($('#display-scaling').value);
    state.occupation = $('#occupation').value;

    const rawDist = parseFloat($('#working-distance').value);
    state.workingDistance = state.distanceUnit === 'in' ? rawDist * 2.54 : rawDist;
}

function updateVergence() {
    const rawDist = parseFloat($('#working-distance').value) || 60;
    const distCm = state.distanceUnit === 'in' ? rawDist * 2.54 : rawDist;
    const vergence = (100 / distCm).toFixed(2);
    $('#vergence-display').textContent = vergence + ' D';
}

function updateConfigSummary() {
    readFormValues();
    const ppi = getMonitorPPI(state.monitorSize, state.monitorResolution);
    const distCm = state.workingDistance;
    const vergence = (100 / distCm).toFixed(2);
    const occ = OCCUPATIONS[state.occupation]?.title || state.occupation;

    $('#config-summary').innerHTML =
        `<strong>Monitor:</strong> ${state.monitorSize}" at ${state.monitorResolution} (${ppi.toFixed(0)} PPI) with ${state.displayScaling}% scaling<br>` +
        `<strong>Working Distance:</strong> ${distCm.toFixed(0)} cm (${(distCm / 2.54).toFixed(1)}") &mdash; Vergence demand: ${vergence} D<br>` +
        `<strong>Occupation:</strong> ${occ}<br>` +
        `<strong>Tablet Calibration:</strong> ${state.cssPixelsPerMm?.toFixed(2) || 'Not set'} CSS px/mm (${state.calibrationSource || 'none'})`;
}

// ==========================================
// CALCULATIONS
// ==========================================

function getMonitorPPI(diagonalInches, resolution) {
    const [w, h] = resolution.split('x').map(Number);
    return Math.sqrt(w * w + h * h) / diagonalInches;
}

// Physical em-size (mm) of a font rendered on the patient's monitor
function getPhysicalEmSize(fontSize, fontUnit, monitorPPI, scalingPercent) {
    let devicePixels;
    if (fontUnit === 'px') {
        // CSS/web pixels: at OS scaling S%, 1 CSS px = S/100 device pixels
        devicePixels = fontSize * (scalingPercent / 100);
    } else {
        // Points: 1pt at scaling S% → (S/100 * 96/72) device pixels
        devicePixels = fontSize * (scalingPercent / 100) * 96 / 72;
    }
    return devicePixels / monitorPPI * 25.4; // mm
}

// Convert a physical mm measurement to CSS px on this tablet
function mmToCSS(mm) {
    return mm * state.cssPixelsPerMm * state.zoomFactor;
}

// Measure x-height ratio for a font using canvas
function getXHeightRatio(fontFamily) {
    if (fontXHeightRatios[fontFamily]) return fontXHeightRatios[fontFamily];

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const testSize = 200; // large size for accuracy
    ctx.font = `${testSize}px ${fontFamily}`;

    const metrics = ctx.measureText('x');
    // actualBoundingBoxAscent = distance from baseline to top of 'x' = x-height
    if (metrics.actualBoundingBoxAscent) {
        const ratio = metrics.actualBoundingBoxAscent / testSize;
        fontXHeightRatios[fontFamily] = ratio;
        return ratio;
    }

    // Fallback: estimate
    fontXHeightRatios[fontFamily] = 0.48;
    return 0.48;
}

// ==========================================
// TEST RENDERING
// ==========================================

function setupTestScreen() {
    // Tab switching with animation
    $$('.tab-group .tab').forEach(tab => {
        tab.addEventListener('click', () => {
            $$('.tab-group .tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            $$('.tab-content').forEach(c => c.classList.add('hidden'));
            const target = $(`#${tab.dataset.tab}-tab`);
            target.classList.remove('hidden');
            // Re-trigger fade animation
            target.style.animation = 'none';
            target.offsetHeight; // force reflow
            target.style.animation = '';

            // Show/hide distance bottom panels
            const bottomPanel = $('#snellen-bottom-panel');
            const blPanel = $('#bl-bottom-panel');
            if (tab.dataset.tab === 'distance') {
                bottomPanel.classList.remove('hidden');
                blPanel.classList.remove('hidden');
            } else {
                bottomPanel.classList.add('hidden');
                blPanel.classList.add('hidden');
            }
        });
    });

    // Distance slider for standard test
    $('#standard-distance-slider').addEventListener('input', () => {
        const d = parseInt($('#standard-distance-slider').value);
        const unit = $('#standard-distance-unit').dataset.unit;
        $('#standard-distance-value').textContent = d;
        const distCm = unit === 'in' ? d * 2.54 : d;
        renderStandardTestType(distCm);
    });

    // Unit toggle on standard test distance slider
    $('#standard-distance-unit').addEventListener('click', () => {
        const toggle = $('#standard-distance-unit');
        const slider = $('#standard-distance-slider');
        const currentUnit = toggle.dataset.unit;
        const val = parseInt(slider.value);

        if (currentUnit === 'cm') {
            toggle.dataset.unit = 'in';
            toggle.textContent = 'in';
            slider.min = 12;
            slider.max = 35;
            slider.value = Math.round(val / 2.54);
        } else {
            toggle.dataset.unit = 'cm';
            toggle.textContent = 'cm';
            slider.min = 30;
            slider.max = 90;
            slider.value = Math.round(val * 2.54);
        }
        const newVal = parseInt(slider.value);
        $('#standard-distance-value').textContent = newVal;
        const distCm = toggle.dataset.unit === 'in' ? newVal * 2.54 : newVal;
        renderStandardTestType(distCm);
    });

    // Zoom +/- buttons for fine-tuning calibration
    function applyZoom(delta) {
        state.zoomFactor = Math.round((state.zoomFactor + delta) * 100) / 100;
        state.zoomFactor = Math.max(0.80, Math.min(1.20, state.zoomFactor));
        $('#zoom-value').textContent = Math.round(state.zoomFactor * 100) + '%';
        localStorage.setItem('nearpoint_zoom', state.zoomFactor);
        renderTest();
    }

    $('#zoom-in-btn').addEventListener('click', () => applyZoom(0.02));
    $('#zoom-out-btn').addEventListener('click', () => applyZoom(-0.02));

    // Restore saved zoom
    const savedZoom = parseFloat(localStorage.getItem('nearpoint_zoom'));
    if (savedZoom && savedZoom >= 0.80 && savedZoom <= 1.20) {
        state.zoomFactor = savedZoom;
        $('#zoom-value').textContent = Math.round(savedZoom * 100) + '%';
    }

    // Occupation picker in test header
    $('#test-occupation-picker').addEventListener('change', () => {
        state.occupation = $('#test-occupation-picker').value;
        renderOccupationSamples();
    });

    // Camera panel toggle
    $('#camera-track-btn').addEventListener('click', () => {
        const panel = $('#camera-panel');
        const btn = $('#camera-track-btn');
        if (panel.classList.contains('hidden')) {
            panel.classList.remove('hidden');
            btn.classList.add('active');
            distanceTracker.start();
        } else {
            panel.classList.add('hidden');
            btn.classList.remove('active');
            distanceTracker.stop();
        }
    });

    $('#marker-separation').addEventListener('change', () => {
        distanceTracker.markerSeparationMM = parseInt($('#marker-separation').value) || 120;
        distanceTracker.saveSettings();
    });

    $('#camera-capture-btn').addEventListener('click', () => distanceTracker.capture());
    $('#camera-calibrate-btn').addEventListener('click', () => distanceTracker.startCalibration());
    $('#camera-measure-btn').addEventListener('click', () => distanceTracker.startMeasure());
    // Click-and-drag marker placement (mouse + touch)
    const cvs = $('#camera-canvas');
    cvs.addEventListener('mousedown', (e) => distanceTracker.handlePointerDown(e));
    cvs.addEventListener('mousemove', (e) => distanceTracker.handlePointerMove(e));
    cvs.addEventListener('mouseup',   (e) => distanceTracker.handlePointerUp(e));
    cvs.addEventListener('touchstart', (e) => { e.preventDefault(); distanceTracker.handlePointerDown(e.touches[0]); }, { passive: false });
    cvs.addEventListener('touchmove',  (e) => { e.preventDefault(); distanceTracker.handlePointerMove(e.touches[0]); }, { passive: false });
    cvs.addEventListener('touchend',   (e) => { e.preventDefault(); distanceTracker.handlePointerUp(e.changedTouches[0]); }, { passive: false });

    // Load saved calibration early so the quick-measure button can show
    distanceTracker.loadSettings();
    const qmBtn = $('#quick-measure-btn');
    if (distanceTracker.calibrationK && distanceTracker.colorProfile) {
        qmBtn.style.display = '';
    }

    // Quick-measure button — silent background measurement
    qmBtn.addEventListener('click', async () => {
        const valueSpan = $('#standard-distance-value');
        const origText = valueSpan.textContent;
        qmBtn.disabled = true;
        valueSpan.textContent = 'Measuring\u2026';

        const ok = await distanceTracker.quickMeasure();

        qmBtn.disabled = false;
        if (!ok) {
            valueSpan.textContent = origText;
            // Fall back to opening the camera panel for manual mode
            const panel = $('#camera-panel');
            if (panel.classList.contains('hidden')) {
                panel.classList.remove('hidden');
                $('#camera-track-btn').classList.add('active');
                distanceTracker.start();
            }
            distanceTracker.startMeasure();
        }
    });

    // --- Distance acuity tab ---
    $('#distance-test-slider').addEventListener('input', () => {
        const val = parseFloat($('#distance-test-slider').value);
        const unit = $('#distance-test-unit').dataset.unit;
        $('#distance-test-value').textContent = unit === 'ft' ? val.toFixed(1) : val.toFixed(1);
        renderDistanceTest();
    });

    $('#distance-test-unit').addEventListener('click', () => {
        const toggle = $('#distance-test-unit');
        const slider = $('#distance-test-slider');
        const val = parseFloat(slider.value);

        if (toggle.dataset.unit === 'ft') {
            // Switch to metres
            toggle.dataset.unit = 'm';
            toggle.textContent = 'm';
            slider.min = 1.5;
            slider.max = 12;
            slider.step = 0.1;
            slider.value = (val * 0.3048).toFixed(1);
        } else {
            // Switch to feet
            toggle.dataset.unit = 'ft';
            toggle.textContent = 'ft';
            slider.min = 5;
            slider.max = 40;
            slider.step = 0.5;
            slider.value = (val / 0.3048).toFixed(1);
        }
        $('#distance-test-value').textContent = parseFloat(slider.value).toFixed(1);
        renderDistanceTest();
    });

    $('#mirror-checkbox').addEventListener('change', () => renderDistanceTest());

    $('#snellen-refresh-btn').addEventListener('click', () => {
        if (baileyLovieMode) {
            blLetters = pickBaileyLovieLetters();
        } else {
            distanceLetters = pickSnellenLetters();
        }
        renderDistanceTest();
    });

    $('#snellen-up-btn').addEventListener('click', () => {
        if (baileyLovieMode) {
            if (blLogmarIndex > 0) {
                blLogmarIndex--;
                blLetters = pickBaileyLovieLetters();
                renderDistanceTest();
            }
        } else {
            if (distanceSnellenIndex > 0) {
                distanceSnellenIndex--;
                distanceLetters = pickSnellenLetters();
                renderDistanceTest();
            }
        }
    });

    $('#snellen-down-btn').addEventListener('click', () => {
        if (baileyLovieMode) {
            if (blLogmarIndex < LOGMAR_LEVELS.length - 1) {
                blLogmarIndex++;
                blLetters = pickBaileyLovieLetters();
                renderDistanceTest();
            }
        } else {
            if (distanceSnellenIndex < SNELLEN_LEVELS.length - 1) {
                distanceSnellenIndex++;
                distanceLetters = pickSnellenLetters();
                renderDistanceTest();
            }
        }
    });

    // --- Bailey-Lovie toggle ---
    $('#bl-toggle-btn').addEventListener('click', () => {
        baileyLovieMode = !baileyLovieMode;
        const btn = $('#bl-toggle-btn');
        const contrastPanel = $('#contrast-panel');

        btn.classList.toggle('active', baileyLovieMode);

        if (baileyLovieMode) {
            contrastPanel.classList.remove('hidden');
            if (blLetters.length === 0) blLetters = pickBaileyLovieLetters();
        } else {
            contrastPanel.classList.add('hidden');
            contrastPercent = 100;
            $('#contrast-value').textContent = '100%';
            updateContrastSlider();
        }
        renderDistanceTest();
    });

    // --- Contrast controls ---
    $('#contrast-slider').addEventListener('input', () => {
        contrastPercent = parseFloat($('#contrast-slider').value);
        $('#contrast-value').textContent = contrastPercent <= 1.25
            ? contrastPercent.toFixed(2) + '%'
            : contrastPercent <= 10
            ? contrastPercent.toFixed(1) + '%'
            : Math.round(contrastPercent) + '%';
        renderDistanceTest();
    });

    $('#contrast-up-btn').addEventListener('click', () => {
        const idx = CONTRAST_LEVELS.indexOf(contrastPercent);
        if (idx > 0) {
            contrastPercent = CONTRAST_LEVELS[idx - 1];
        } else if (idx === -1) {
            // Find next higher preset
            const higher = CONTRAST_LEVELS.filter(l => l > contrastPercent);
            contrastPercent = higher.length ? higher[higher.length - 1] : 100;
        }
        updateContrastSlider();
        renderDistanceTest();
    });

    $('#contrast-down-btn').addEventListener('click', () => {
        const idx = CONTRAST_LEVELS.indexOf(contrastPercent);
        if (idx >= 0 && idx < CONTRAST_LEVELS.length - 1) {
            contrastPercent = CONTRAST_LEVELS[idx + 1];
        } else if (idx === -1) {
            // Find next lower preset
            const lower = CONTRAST_LEVELS.filter(l => l < contrastPercent);
            contrastPercent = lower.length ? lower[0] : 1.25;
        }
        updateContrastSlider();
        renderDistanceTest();
    });

    // --- CSF Test ---
    $('#csf-start-btn').addEventListener('click', () => csfStartTest());
    $('#csf-stop-btn').addEventListener('click', () => csfStopTest());
    $('#csf-results-close').addEventListener('click', () => csfClosePatientResults());
    $('#csf-results-overlay').addEventListener('click', (e) => {
        if (e.target === $('#csf-results-overlay')) csfClosePatientResults();
    });

    // --- Luminance calibration ---
    initLuminanceCalibration();

    $('#luminance-cal-btn').addEventListener('click', () => {
        $('#luminance-modal').classList.remove('hidden');
    });

    $('#luminance-modal-close').addEventListener('click', () => {
        $('#luminance-modal').classList.add('hidden');
    });

    $('#luminance-modal').addEventListener('click', (e) => {
        if (e.target === $('#luminance-modal')) {
            $('#luminance-modal').classList.add('hidden');
        }
    });

    // Back button
    $('#back-btn').addEventListener('click', () => showScreen('input'));
}

function renderTest() {
    updateTestInfoBar();
    // Sync occupation picker with form selection
    $('#test-occupation-picker').value = state.occupation;
    // Sync unit toggle with input screen preference
    const unit = state.distanceUnit;
    const toggle = $('#standard-distance-unit');
    const slider = $('#standard-distance-slider');
    if (unit === 'in') {
        toggle.dataset.unit = 'in';
        toggle.textContent = 'in';
        slider.min = 12;
        slider.max = 35;
        slider.value = Math.round(40 / 2.54); // default 40cm in inches
    } else {
        toggle.dataset.unit = 'cm';
        toggle.textContent = 'cm';
        slider.min = 30;
        slider.max = 90;
        slider.value = 40;
    }
    const sliderVal = parseInt(slider.value);
    $('#standard-distance-value').textContent = sliderVal;
    const sliderDistCm = unit === 'in' ? sliderVal * 2.54 : sliderVal;
    renderStandardTestType(sliderDistCm);
    renderOccupationSamples();
    renderDocumentSamples();
    renderDistanceTest();
}

function updateTestInfoBar() {
    const distCm = state.workingDistance;
    const vergence = (100 / distCm).toFixed(2);
    const ppi = getMonitorPPI(state.monitorSize, state.monitorResolution);

    const distDisplay = state.distanceUnit === 'in'
        ? `Distance: ${(distCm / 2.54).toFixed(1)}" (${distCm.toFixed(0)} cm)`
        : `Distance: ${distCm.toFixed(0)} cm (${(distCm / 2.54).toFixed(1)}")`;
    $('#test-distance-info').textContent = distDisplay;
    $('#test-monitor-info').textContent =
        `Monitor: ${state.monitorSize}" ${state.monitorResolution} @ ${state.displayScaling}% (${ppi.toFixed(0)} PPI)`;
    $('#test-vergence-info').textContent =
        `Vergence: ${vergence} D`;
}

// --- Repeat content 2x ---
// Clones all child elements so the user gets a second full copy to scroll through.
function repeatContent(contentEl) {
    const origItems = Array.from(contentEl.children);
    origItems.forEach(item => {
        contentEl.appendChild(item.cloneNode(true));
    });
}

function renderStandardTestType(testDistanceCm) {
    const container = $('#standard-test-container');
    container.innerHTML = '';

    testDistanceCm = testDistanceCm || 40;
    const distM = testDistanceCm / 100;
    const testFont = '"Times New Roman", "Georgia", serif';
    const xRatio = getXHeightRatio(testFont);

    // Container width scales with distance to simulate phoropter field of view
    // Narrower at close range, wider at far range
    // 30% at 30cm, 50% at 40cm, 75% at 60cm, clamped 25%-95%
    const widthPercent = Math.max(25, Math.min(95, 50 + (testDistanceCm - 40) * 1.25));
    container.style.maxWidth = widthPercent + '%';

    M_SIZES.forEach(m => {
        // Scale x-height with testing distance (reference: 40cm standard)
        const xHeightMM = m * M_UNIT_MM * (testDistanceCm / 40);
        const emSizeMM = xHeightMM / xRatio;
        const cssFontSize = mmToCSS(emSizeMM);

        // Snellen equivalent (constant with distance-scaled sizing)
        const snellenDenom = Math.round(20 * m / 0.4);

        // Card wrapper (matches occupation/document card style)
        const sample = document.createElement('div');
        sample.className = 'occupation-sample';

        const titlebar = document.createElement('div');
        titlebar.className = 'sample-titlebar';
        titlebar.innerHTML = `
            <div class="titlebar-dots"><span></span><span></span><span></span></div>
            <strong>${m.toFixed(2)}M</strong>&ensp;&mdash;&ensp;20/${snellenDenom} at ${testDistanceCm}cm
        `;

        const content = document.createElement('div');
        content.className = 'sample-content';

        const text = document.createElement('p');
        text.className = 'test-text';
        text.style.fontFamily = testFont;
        text.style.fontSize = cssFontSize + 'px';
        text.style.lineHeight = '1.15';
        text.textContent = TEST_PASSAGES[m];

        content.appendChild(text);

        const meta = document.createElement('div');
        meta.className = 'sample-meta';
        meta.innerHTML =
            `<span><strong>Physical x-height:</strong> ${xHeightMM.toFixed(2)}mm</span>` +
            `<span><strong>M-notation:</strong> ${m.toFixed(2)}M</span>` +
            `<span><strong>Snellen:</strong> 20/${snellenDenom}</span>`;

        sample.appendChild(titlebar);
        sample.appendChild(content);
        sample.appendChild(meta);
        container.appendChild(sample);
    });

    repeatContent(container);
}

// Build an SVG element containing sheet music notation.
// ss = staff space in CSS pixels; music = {keySig, timeSig, bars}
// Engraving proportions follow standard music publishing (Gould, Behind Bars):
//   notehead height = 1 staff space, width ≈ 1.3 ss, stem = 3.5 ss
function buildSheetMusicSVG(ss, music) {
    const NS = 'http://www.w3.org/2000/svg';
    const mk = (tag, a) => {
        const e = document.createElementNS(NS, tag);
        for (const k in a) e.setAttribute(k, a[k]);
        return e;
    };
    // Note position to y in staff-space units from top line
    // pos 0=E4(bottom line), 8=F5(top line)
    const ny = p => (8 - p) * 0.5;

    const NHW = 0.65, NHH = 0.47; // notehead radii (ss)
    const STEM = 3.5;
    const BEATW = 2.2;
    const BPAD = 0.8;

    const preamble = 3.5 + (music.keySig || 0) * 1.2 + (music.keySig ? 0.5 : 0) + 2.5;
    let totalBeats = 0;
    music.bars.forEach(b => b.forEach(n => { totalBeats += n.dot ? n.d * 1.5 : n.d; }));
    const W = preamble + totalBeats * BEATW + music.bars.length * BPAD + 1.5;

    const mt = 2.5, mb = 1.5;
    const svgW = W * ss, svgH = (4 + mt + mb) * ss;
    const sY = mt * ss; // y of top staff line

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', svgW);
    svg.setAttribute('height', svgH);
    svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
    svg.style.display = 'block';
    svg.style.overflow = 'visible';

    // Staff lines
    const slw = Math.max(0.5, 0.1 * ss);
    for (let i = 0; i < 5; i++)
        svg.appendChild(mk('line', { x1: 0, y1: sY + i * ss, x2: svgW, y2: sY + i * ss, stroke: '#000', 'stroke-width': slw }));

    let cx = 0.5 * ss;

    // Treble clef (Unicode character with font fallbacks)
    const clef = mk('text', {
        x: cx, y: sY + 4 * ss,
        'font-size': (6.5 * ss) + 'px',
        'font-family': '"Noto Music","Segoe UI Symbol","Apple Symbols",serif',
        fill: '#000'
    });
    clef.textContent = String.fromCodePoint(0x1D11E);
    svg.appendChild(clef);
    cx += 3.5 * ss;

    // Key signature sharps
    if (music.keySig > 0) {
        const spos = [8, 5, 9, 6, 3, 7, 4]; // standard sharp order on treble staff
        for (let i = 0; i < music.keySig; i++) {
            const t = mk('text', {
                x: cx, y: sY + ny(spos[i]) * ss,
                'font-size': (1.6 * ss) + 'px', 'font-family': 'serif',
                fill: '#000', 'dominant-baseline': 'central'
            });
            t.textContent = '\u266F';
            svg.appendChild(t);
            cx += 1.2 * ss;
        }
        cx += 0.5 * ss;
    }

    // Time signature
    [[music.timeSig[0], sY + ss], [music.timeSig[1], sY + 3 * ss]].forEach(([n, y]) => {
        const t = mk('text', {
            x: cx + ss, y: y,
            'font-size': (1.9 * ss) + 'px',
            'font-family': '"Times New Roman",serif',
            'font-weight': 'bold', fill: '#000',
            'dominant-baseline': 'central', 'text-anchor': 'middle'
        });
        t.textContent = String(n);
        svg.appendChild(t);
    });
    cx += 2.5 * ss;

    // Render bars
    const stemW = Math.max(1, 0.12 * ss);
    music.bars.forEach((bar, barIdx) => {
        cx += BPAD * ss;
        const beams = {};

        bar.forEach(note => {
            const dur = note.dot ? note.d * 1.5 : note.d;

            if (note.r) {
                // Rests
                const rx = cx + dur * BEATW * ss * 0.4;
                if (note.d === 1) {
                    // Quarter rest (zigzag approximation)
                    svg.appendChild(mk('path', {
                        d: `M${rx - 0.15 * ss},${sY + 1.2 * ss} l${0.4 * ss},${0.5 * ss} l${-0.4 * ss},${0.5 * ss} l${0.4 * ss},${0.5 * ss} l${-0.2 * ss},${0.4 * ss}`,
                        stroke: '#000', 'stroke-width': Math.max(1, 0.13 * ss),
                        fill: 'none', 'stroke-linecap': 'round'
                    }));
                } else if (note.d === 2) {
                    // Half rest (rectangle on middle line)
                    svg.appendChild(mk('rect', {
                        x: rx - 0.5 * ss, y: sY + 1.5 * ss,
                        width: ss, height: 0.5 * ss, fill: '#000'
                    }));
                }
                cx += dur * BEATW * ss;
                return;
            }

            const nx = cx + 0.1 * ss;
            const nYpx = sY + ny(note.p) * ss;
            const up = note.p <= 4; // on or below middle line → stem up
            const filled = note.d <= 1;

            // Ledger lines (above staff)
            for (let lp = 10; lp <= note.p; lp += 2) {
                const ly = sY + ny(lp) * ss;
                svg.appendChild(mk('line', { x1: nx - NHW * ss - 0.3 * ss, y1: ly, x2: nx + NHW * ss + 0.3 * ss, y2: ly, stroke: '#000', 'stroke-width': slw }));
            }
            // Ledger lines (below staff)
            for (let lp = -2; lp >= note.p; lp -= 2) {
                const ly = sY + ny(lp) * ss;
                svg.appendChild(mk('line', { x1: nx - NHW * ss - 0.3 * ss, y1: ly, x2: nx + NHW * ss + 0.3 * ss, y2: ly, stroke: '#000', 'stroke-width': slw }));
            }

            // Notehead (ellipse, slight tilt per engraving convention)
            svg.appendChild(mk('ellipse', {
                cx: nx, cy: nYpx, rx: NHW * ss, ry: NHH * ss,
                fill: filled ? '#000' : 'none', stroke: '#000',
                'stroke-width': filled ? 0 : Math.max(1, 0.13 * ss),
                transform: `rotate(-15,${nx},${nYpx})`
            }));

            // Stem (not drawn for whole notes)
            if (note.d < 4) {
                const sx = up ? nx + NHW * ss * 0.85 : nx - NHW * ss * 0.85;
                const se = up ? nYpx - STEM * ss : nYpx + STEM * ss;
                svg.appendChild(mk('line', { x1: sx, y1: nYpx, x2: sx, y2: se, stroke: '#000', 'stroke-width': stemW }));

                if (note.bm) {
                    if (!beams[note.bm]) beams[note.bm] = [];
                    beams[note.bm].push({ sx, se });
                } else if (note.d <= 0.5) {
                    // Flag for unbeamed eighth note
                    const dir = up ? 1 : -1;
                    svg.appendChild(mk('path', {
                        d: `M${sx},${se} q${0.6 * ss},${dir * 0.6 * ss} ${0.1 * ss},${dir * 1.4 * ss}`,
                        stroke: '#000', 'stroke-width': Math.max(1, 0.14 * ss), fill: 'none'
                    }));
                }
            }

            // Augmentation dot
            if (note.dot) {
                const dy = (note.p % 2 === 0) ? nYpx - 0.25 * ss : nYpx;
                svg.appendChild(mk('circle', { cx: nx + NHW * ss + 0.35 * ss, cy: dy, r: 0.15 * ss, fill: '#000' }));
            }

            cx += dur * BEATW * ss;
        });

        // Beams connecting grouped eighth notes
        for (const gid in beams) {
            const g = beams[gid];
            if (g.length >= 2)
                svg.appendChild(mk('line', { x1: g[0].sx, y1: g[0].se, x2: g[g.length - 1].sx, y2: g[g.length - 1].se, stroke: '#000', 'stroke-width': 0.5 * ss }));
        }

        // Barline
        svg.appendChild(mk('line', { x1: cx, y1: sY, x2: cx, y2: sY + 4 * ss, stroke: '#000', 'stroke-width': Math.max(1, 0.16 * ss) }));
    });

    // Final thick barline (double bar)
    svg.appendChild(mk('line', { x1: cx + 0.35 * ss, y1: sY, x2: cx + 0.35 * ss, y2: sY + 4 * ss, stroke: '#000', 'stroke-width': Math.max(1, 0.3 * ss) }));

    return svg;
}

function renderOccupationSamples() {
    const container = $('#occupation-test-container');
    container.innerHTML = '';

    const occData = OCCUPATIONS[state.occupation];
    if (!occData) return;

    const monitorPPI = getMonitorPPI(state.monitorSize, state.monitorResolution);

    // Add occupation header
    const header = document.createElement('h2');
    header.textContent = `${occData.title} - Typical Screen Content`;
    header.style.marginBottom = '20px';
    container.appendChild(header);

    occData.apps.forEach(app => {
        const fontUnit = app.fontUnit || 'pt';
        let physicalEmMM, cssFontSize, equivalentM;

        if (app.sheetMusic) {
            // Sheet music: staff space is the critical physical dimension
            // Notehead height = 1 staff space, so use it as the reference size
            physicalEmMM = app.sheetMusic.staffSpaceMM;
            equivalentM = physicalEmMM / M_UNIT_MM;
        } else {
            physicalEmMM = getPhysicalEmSize(app.fontSize, fontUnit, monitorPPI, state.displayScaling);
            cssFontSize = mmToCSS(physicalEmMM) * 0.9;
            const xRatio = getXHeightRatio(app.font);
            const xHeightMM = physicalEmMM * xRatio;
            equivalentM = xHeightMM / M_UNIT_MM;
        }

        const sample = document.createElement('div');
        sample.className = 'occupation-sample';

        // Titlebar
        const titlebar = document.createElement('div');
        titlebar.className = 'sample-titlebar';
        titlebar.innerHTML = `
            <div class="titlebar-dots"><span></span><span></span><span></span></div>
            ${app.description}
        `;

        // Content
        const content = document.createElement('div');
        content.className = 'sample-content' + (app.dark ? ' dark' : '');

        if (app.sheetMusic) {
            const staffSpacePx = mmToCSS(app.sheetMusic.staffSpaceMM) * 0.9;
            content.style.padding = '12px';
            content.style.overflowX = 'auto';
            content.appendChild(buildSheetMusicSVG(staffSpacePx, app.sheetMusic));
        } else if (app.tabular) {
            const table = document.createElement('table');
            table.className = 'sample-table';
            table.style.fontFamily = app.font;
            table.style.fontSize = cssFontSize + 'px';

            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            app.tabular.headers.forEach((h, i) => {
                const th = document.createElement('th');
                th.textContent = h;
                th.style.textAlign = app.tabular.alignments[i] || 'left';
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            app.tabular.rows.forEach(row => {
                const tr = document.createElement('tr');
                row.forEach((cell, i) => {
                    const td = document.createElement('td');
                    td.textContent = cell;
                    td.style.textAlign = app.tabular.alignments[i] || 'left';
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            content.appendChild(table);
        } else {
            const text = document.createElement('pre');
            text.className = 'sample-text';
            text.style.fontFamily = app.font;
            text.style.fontSize = cssFontSize + 'px';
            text.style.lineHeight = '1.15';
            text.textContent = app.sample;
            content.appendChild(text);
        }

        // Meta info
        const meta = document.createElement('div');
        meta.className = 'sample-meta';
        if (app.sheetMusic) {
            const ssMM = app.sheetMusic.staffSpaceMM;
            meta.innerHTML =
                `<span><strong>Staff height:</strong> ${(ssMM * 4).toFixed(1)}mm (${ssMM.toFixed(2)}mm space)</span>` +
                `<span><strong>Notehead:</strong> ${ssMM.toFixed(2)}mm</span>` +
                `<span><strong>Approx:</strong> ${equivalentM.toFixed(2)}M</span>`;
        } else {
            const sizeLabel = fontUnit === 'px' ? `${app.fontSize}px` : `${app.fontSize}pt`;
            meta.innerHTML =
                `<span><strong>App font:</strong> ${sizeLabel} ${app.font.split(',')[0].replace(/"/g, '')}</span>` +
                `<span><strong>Physical size:</strong> ${physicalEmMM.toFixed(2)}mm em</span>` +
                `<span><strong>Approx:</strong> ${equivalentM.toFixed(2)}M</span>`;
        }

        sample.appendChild(titlebar);
        sample.appendChild(content);
        sample.appendChild(meta);
        container.appendChild(sample);
    });

    repeatContent(container);
}

function renderDocumentSamples() {
    const container = $('#documents-test-container');
    container.innerHTML = '';

    const header = document.createElement('h2');
    header.textContent = 'Common Document & Device Font Sizes';
    header.style.marginBottom = '20px';
    container.appendChild(header);

    DOCUMENTS.forEach(doc => {
        const cssFontSize = mmToCSS(doc.physicalEmMM);

        const xRatio = getXHeightRatio(doc.font);
        const xHeightMM = doc.physicalEmMM * xRatio;
        const equivalentM = xHeightMM / M_UNIT_MM;

        const sample = document.createElement('div');
        sample.className = 'occupation-sample';

        const titlebar = document.createElement('div');
        titlebar.className = 'sample-titlebar';
        titlebar.innerHTML = `
            <div class="titlebar-dots"><span></span><span></span><span></span></div>
            <strong>${doc.name}</strong>&ensp;&mdash;&ensp;${doc.description}
        `;

        const content = document.createElement('div');
        content.className = 'sample-content';

        const text = document.createElement('pre');
        text.className = 'sample-text';
        text.style.fontFamily = doc.font;
        text.style.fontSize = cssFontSize + 'px';
        text.style.lineHeight = '1.15';
        text.textContent = doc.sample;
        content.appendChild(text);

        const meta = document.createElement('div');
        meta.className = 'sample-meta';
        meta.innerHTML =
            `<span><strong>Physical em:</strong> ${doc.physicalEmMM.toFixed(2)}mm</span>` +
            `<span><strong>Approx:</strong> ${equivalentM.toFixed(2)}M</span>`;

        sample.appendChild(titlebar);
        sample.appendChild(content);
        sample.appendChild(meta);
        container.appendChild(sample);
    });

    repeatContent(container);
}

// ==========================================
// DISTANCE ACUITY TEST
// ==========================================

function getCapHeightRatio(fontFamily) {
    const key = fontFamily + '__cap';
    if (fontXHeightRatios[key]) return fontXHeightRatios[key];

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const testSize = 200;
    ctx.font = `${testSize}px ${fontFamily}`;
    const metrics = ctx.measureText('H');
    if (metrics.actualBoundingBoxAscent) {
        const ratio = metrics.actualBoundingBoxAscent / testSize;
        fontXHeightRatios[key] = ratio;
        return ratio;
    }
    fontXHeightRatios[key] = 0.72;
    return 0.72;
}

const BANNED_SUBSTRINGS = [
    'FUC', 'FUK', 'FUN', 'CUN', 'NUT', 'TIT', 'PEN', 'HUP',
    'DIE', 'DIC', 'COC', 'COD', 'HOE', 'HOR', 'PEE', 'POO',
    'FAP', 'FAT', 'FED', 'POD', 'NIP', 'TET', 'NUD', 'NUB',
    'DON', 'DOP', 'COP', 'CON', 'PUD', 'PUN', 'RUN', 'RUT',
    'HUN', 'DUH', 'DEN', 'END'
];

function containsBanned(letters) {
    const str = letters.join('');
    return BANNED_SUBSTRINGS.some(b => str.includes(b));
}

function pickFromPool(pool, count) {
    for (let attempt = 0; attempt < 50; attempt++) {
        const letters = [];
        for (let i = 0; i < count; i++) {
            let pick;
            do {
                pick = pool[Math.floor(Math.random() * pool.length)];
            } while (i > 0 && pick === letters[i - 1]);
            letters.push(pick);
        }
        if (!containsBanned(letters)) return letters;
    }
    // Fallback: just return the last attempt (extremely unlikely to reach here)
    return pickFromPool(pool, count);
}

function pickSnellenLetters() {
    return pickFromPool(SLOAN_LETTERS, 5);
}

function pickBaileyLovieLetters() {
    return pickFromPool(BAILEY_LOVIE_LETTERS, 5);
}

function renderDistanceTest() {
    const container = $('#snellen-letters');
    if (!container) return;

    const unit = $('#distance-test-unit').dataset.unit;
    const sliderVal = parseFloat($('#distance-test-slider').value);
    const mirror = $('#mirror-checkbox').checked;

    // Convert distance to mm
    const distMM = unit === 'ft' ? sliderVal * 304.8 : sliderVal * 1000;

    let letterHeightMM, indicatorText, currentLetters;
    let perLetterContrasts = null; // null = uniform, array = CSF mode

    if (csfState.active) {
        // CSF mode: use current level's Snellen denominator
        const snellenDenom = csfState.levels[csfState.levelIndex] || csfState.levels[csfState.levels.length - 1];
        const arcminTotal = 5 * snellenDenom / 20;
        const radians = arcminTotal * Math.PI / (180 * 60);
        letterHeightMM = distMM * Math.tan(radians);
        indicatorText = `CSF Pass ${csfState.pass} — 20/${snellenDenom}`;
        currentLetters = csfState.currentLetters;
        perLetterContrasts = csfState.currentContrasts;
    } else if (baileyLovieMode) {
        // Bailey-Lovie: LogMAR progression
        const logmar = LOGMAR_LEVELS[blLogmarIndex];
        const snellenDenom = 20 * Math.pow(10, logmar);

        // Letter height: subtends 5 * (denom/20) arcminutes at testing distance
        const arcminTotal = 5 * snellenDenom / 20;
        const radians = arcminTotal * Math.PI / (180 * 60);
        letterHeightMM = distMM * Math.tan(radians);

        indicatorText = `LogMAR ${logmar.toFixed(1)} (≈20/${Math.round(snellenDenom)})`;

        if (blLetters.length === 0) {
            blLetters = pickBaileyLovieLetters();
        }
        currentLetters = blLetters;
    } else {
        // Standard Snellen
        const snellenDenom = SNELLEN_LEVELS[distanceSnellenIndex];
        const arcminTotal = 5 * snellenDenom / 20;
        const radians = arcminTotal * Math.PI / (180 * 60);
        letterHeightMM = distMM * Math.tan(radians);

        indicatorText = `20/${snellenDenom}`;

        if (distanceLetters.length === 0) {
            distanceLetters = pickSnellenLetters();
        }
        currentLetters = distanceLetters;
    }

    // Convert physical cap-height to CSS font-size
    const optFont = '"Arial", "Helvetica", sans-serif';
    const capRatio = getCapHeightRatio(optFont);
    const emSizeMM = letterHeightMM / capRatio;
    const cssFontSize = mmToCSS(emSizeMM);

    // Update indicator
    $('#snellen-indicator').textContent = indicatorText;
    broadcastLineUpdate();

    // Calculate letter color from contrast (Weber contrast on white background)
    // C = (Lb - Lt) / Lb, so Lt = Lb * (1 - C)
    // With white bg (255): letterGray = 255 * (1 - contrastPercent/100)
    const letterGray = Math.round(255 * (1 - contrastPercent / 100));
    const letterColor = `rgb(${letterGray}, ${letterGray}, ${letterGray})`;

    // Render
    container.innerHTML = '';
    container.style.fontSize = cssFontSize + 'px';
    container.style.fontFamily = optFont;
    container.style.transform = mirror ? 'scaleX(-1)' : 'none';
    if (!perLetterContrasts) {
        container.style.color = letterColor;
    }

    currentLetters.forEach((letter, i) => {
        const span = document.createElement('span');
        span.className = 'snellen-letter';
        span.textContent = letter;
        if (perLetterContrasts && perLetterContrasts[i] != null) {
            const g = Math.round(255 * (1 - perLetterContrasts[i] / 100));
            span.style.color = `rgb(${g}, ${g}, ${g})`;
        }
        container.appendChild(span);
    });
}

function updateContrastSlider() {
    const slider = $('#contrast-slider');
    slider.value = contrastPercent;
    $('#contrast-value').textContent = contrastPercent <= 1.25
        ? contrastPercent.toFixed(2) + '%'
        : contrastPercent <= 10
        ? contrastPercent.toFixed(1) + '%'
        : Math.round(contrastPercent) + '%';
}

// ==========================================
// CSF TEST ALGORITHM
// ==========================================

function csfPickLetters(count) {
    return pickFromPool(SLOAN_LETTERS, count);
}

function csfComputeContrasts(startContrast, endContrast, count) {
    // Geometric step-down from startContrast to endContrast across count letters
    const clamped_start = Math.min(100, Math.max(CSF_MIN_CONTRAST, startContrast));
    const clamped_end = Math.max(CSF_MIN_CONTRAST, endContrast);
    const contrasts = [];
    if (count <= 1) return [clamped_start];
    const ratio = Math.pow(clamped_end / clamped_start, 1 / (count - 1));
    for (let i = 0; i < count; i++) {
        contrasts.push(Math.max(CSF_MIN_CONTRAST, clamped_start * Math.pow(ratio, i)));
    }
    return contrasts;
}

function csfAdaptiveStart(levelIndex) {
    const denom = csfState.levels[levelIndex];
    if (csfState.pass >= 2) {
        const expected = csfInterpolateThreshold(denom);
        if (expected != null) {
            return Math.min(100, expected * 1.8);
        }
    }
    if (levelIndex === 0) return 100;
    // Pass 1: use previous level's threshold to adapt starting contrast
    const prevDenom = csfState.levels[levelIndex - 1];
    const prevResult = csfState.results[prevDenom];
    if (prevResult && prevResult.coarseThreshold != null) {
        return Math.min(100, prevResult.coarseThreshold * 2.0);
    }
    return 100;
}

function csfAdaptiveEnd(levelIndex) {
    const denom = csfState.levels[levelIndex];
    if (csfState.pass === 2) {
        // Pass 2: narrow range around interpolated threshold
        const expected = csfInterpolateThreshold(denom);
        if (expected != null) {
            return Math.max(CSF_MIN_CONTRAST, expected * 0.3);
        }
    }
    // Pass 1: sweep all the way to the display floor
    return CSF_MIN_CONTRAST;
}

// Interpolate expected threshold for a denom using coarse results
function csfInterpolateThreshold(denom) {
    const result = csfState.results[denom];
    if (result && result.coarseThreshold != null) return result.coarseThreshold;

    // Find nearest coarse results above and below this denom
    const coarseKeys = CSF_ALL_LEVELS.filter(d => csfState.results[d] && csfState.results[d].coarseThreshold != null);
    if (coarseKeys.length === 0) return null;

    const above = coarseKeys.filter(d => d > denom).sort((a, b) => a - b)[0];
    const below = coarseKeys.filter(d => d < denom).sort((a, b) => b - a)[0];

    if (above != null && below != null) {
        // Log-linear interpolation between neighbors
        const logD = Math.log10(denom);
        const logA = Math.log10(above);
        const logB = Math.log10(below);
        const tA = Math.log10(csfState.results[above].coarseThreshold);
        const tB = Math.log10(csfState.results[below].coarseThreshold);
        const t = (logD - logB) / (logA - logB);
        return Math.pow(10, tB + t * (tA - tB));
    }
    if (above != null) return csfState.results[above].coarseThreshold;
    if (below != null) return csfState.results[below].coarseThreshold;
    return null;
}

// Generate pass 2 levels: insert intermediate sizes where CSF changes fastest
function csfGenerateRefinedLevels() {
    // Include all tested levels (coarse + any extensions)
    const allTested = Object.keys(csfState.results)
        .map(Number)
        .filter(d => csfState.results[d].coarseThreshold != null)
        .sort((a, b) => b - a); // descending
    if (allTested.length < 2) return [...allTested];

    const levels = [];
    for (let i = 0; i < allTested.length; i++) {
        levels.push(allTested[i]);
        if (i < allTested.length - 1) {
            const d1 = allTested[i];
            const d2 = allTested[i + 1];
            const t1 = csfState.results[d1].coarseThreshold;
            const t2 = csfState.results[d2].coarseThreshold;
            const deltaLog = Math.abs(Math.log10(t1) - Math.log10(t2));
            if (deltaLog > 0.2) {
                const midDenom = Math.round(Math.sqrt(d1 * d2));
                if (midDenom !== d1 && midDenom !== d2) {
                    levels.push(midDenom);
                }
            }
        }
    }
    return levels.sort((a, b) => b - a);
}



function csfEstimateThreshold(contrasts, errors) {
    // Find the last correctly identified letter (lowest contrast correct)
    let lastCorrectIdx = -1;
    for (let i = 0; i < errors.length; i++) {
        if (!errors[i]) lastCorrectIdx = i;
    }
    if (lastCorrectIdx === -1) {
        // All wrong — threshold is above our starting contrast
        return contrasts[0] * 1.5;
    }
    if (lastCorrectIdx === errors.length - 1) {
        // All correct — threshold is below our lowest contrast
        return contrasts[contrasts.length - 1] * 0.7;
    }
    // Interpolate between last correct and first wrong after it
    const correctContrast = contrasts[lastCorrectIdx];
    const wrongContrast = contrasts[lastCorrectIdx + 1];
    return (correctContrast + wrongContrast) / 2;
}

function csfBroadcast(type, payload) {
    if (csfState.channel) {
        csfState.channel.postMessage({ type, ...payload });
    }
}

function csfStartTest() {
    // Initialize state
    csfState.active = true;
    csfState.pass = 1;
    csfState.levelIndex = 0;
    csfState.levels = [...CSF_ALL_LEVELS]; // pass 1 walks the full range
    csfState.results = {};
    csfState.waitingForClinician = false;

    // Open BroadcastChannel
    // Reuse the persistent distance channel
    setupDistanceChannel();
    csfState.channel = distanceChannel;

    // Open clinician window
    // Reuse existing clinician window if already open
    launchClinicianWindow();
    csfState.clinicianWindow = clinicianWindow;

    // Update UI to CSF mode
    csfUpdateUI();

    // Wait briefly for clinician to load, then send first line
    setTimeout(() => csfNextLine(), 800);
}

function csfStopTest() {
    csfBroadcast('csf-cancel', {});
    csfState.active = false;
    csfState.channel = null; // don't close — persistent channel stays open
    csfState.clinicianWindow = null;
    csfUpdateUI();
    renderDistanceTest();
}

// Build paired contrast array for pass 2+: 2 letters at each of N levels
function csfComputePairedContrasts(startContrast, endContrast, numLevels) {
    const levels = csfComputeContrasts(startContrast, endContrast, numLevels);
    // Duplicate each level: [A, A, B, B, C, C, ...]
    const paired = [];
    levels.forEach(c => { paired.push(c); paired.push(c); });
    return paired;
}

// Estimate threshold from paired pass 2 data: require both letters correct at a contrast
function csfEstimateThresholdPaired(contrasts, errors) {
    // Group into pairs (indices 0-1, 2-3, 4-5, ...)
    let lastConfirmedIdx = -1;
    for (let i = 0; i < contrasts.length - 1; i += 2) {
        const bothCorrect = !errors[i] && !errors[i + 1];
        if (bothCorrect) {
            lastConfirmedIdx = i + 1; // last index of this pair
        }
    }
    if (lastConfirmedIdx === -1) {
        return contrasts[0] * 1.5;
    }
    if (lastConfirmedIdx >= contrasts.length - 1) {
        return contrasts[contrasts.length - 1] * 0.7;
    }
    // Threshold between last confirmed pair and next pair
    const confirmedContrast = contrasts[lastConfirmedIdx];
    const nextContrast = contrasts[lastConfirmedIdx + 1];
    return (confirmedContrast + nextContrast) / 2;
}

function csfNextLine() {
    const denom = csfState.levels[csfState.levelIndex];
    const startContrast = csfAdaptiveStart(csfState.levelIndex);
    const endContrast = csfAdaptiveEnd(csfState.levelIndex);

    if (csfState.pass === 1) {
        // Pass 1: single letter per contrast (fast coarse survey)
        csfState.currentLetters = csfPickLetters(CSF_LETTERS_PASS1);
        csfState.currentContrasts = csfComputeContrasts(startContrast, endContrast, CSF_LETTERS_PASS1);
    } else {
        // Pass 2+: paired letters for statistical validation
        const numLevels = CSF_LETTERS_PASS2 / 2; // 5 contrast levels
        csfState.currentContrasts = csfComputePairedContrasts(startContrast, endContrast, numLevels);
        csfState.currentLetters = csfPickLetters(CSF_LETTERS_PASS2);
    }
    csfState.waitingForClinician = true;

    // Render on patient display
    renderDistanceTest();

    // Update indicator — show fractional denoms like 20/35 for non-standard sizes
    const indicator = $('#snellen-indicator');
    if (indicator) {
        const denomLabel = Number.isInteger(denom) ? denom : denom.toFixed(0);
        indicator.textContent = `CSF Pass ${csfState.pass} — 20/${denomLabel}`;
    }

    // Broadcast to clinician
    csfBroadcast('csf-line', {
        snellenDenom: denom,
        letters: csfState.currentLetters,
        contrasts: csfState.currentContrasts,
        pass: csfState.pass,
        levelIndex: csfState.levelIndex,
        totalLevels: csfState.levels.length
    });
}

function csfProcessResponse(errors) {
    const denom = csfState.levels[csfState.levelIndex];
    const allWrong = errors.every(e => e === 1);
    // Use paired estimator for pass 2+ (requires both letters correct per level)
    const threshold = csfState.pass >= 2
        ? csfEstimateThresholdPaired(csfState.currentContrasts, errors)
        : csfEstimateThreshold(csfState.currentContrasts, errors);

    // Store result — pass 3 overwrites refined threshold for retested levels
    if (!csfState.results[denom]) {
        csfState.results[denom] = {};
    }
    if (csfState.pass === 1) {
        csfState.results[denom].coarseThreshold = threshold;
    } else {
        csfState.results[denom].refinedThreshold = threshold;
    }

    csfState.waitingForClinician = false;

    // In pass 1: if patient got 0 correct, stop descending — they've hit their limit
    const hitFloor = csfState.pass === 1 && allWrong;

    // Advance to next level (unless floored)
    csfState.levelIndex++;

    if (hitFloor || csfState.levelIndex >= csfState.levels.length) {
        if (csfState.pass === 1) {
            // Trim untested levels from pass 1 if we stopped early
            const testedLevels = csfState.levels.slice(0, csfState.levelIndex);
            // Generate refined levels from what was actually tested
            csfState.pass = 2;
            csfState.levels = csfGenerateRefinedLevels();
            csfState.levelIndex = 0;
            csfNextLine();
        } else {
            csfComplete();
        }
    } else {
        csfNextLine();
    }
}

function csfBuildResults() {
    const allDenoms = Object.keys(csfState.results).map(Number).sort((a, b) => b - a);
    return allDenoms.map(denom => {
        const r = csfState.results[denom];
        const threshold = r.refinedThreshold || r.coarseThreshold || 100;
        const cpd = 30 / denom;
        const sensitivity = 100 / threshold;
        return { denom, cpd, threshold, sensitivity };
    });
}

// Detect noisy regions: places where normalized dB reverses direction unexpectedly
// Returns array of denoms that need retesting, or empty if clean
function csfDetectNoisyRegions(results) {
    if (results.length < 3) return [];

    // Compute normalized dB for each point
    const withDB = results.map(r => {
        const norm = csfNormative(r.cpd);
        const dB = 10 * Math.log10(Math.max(0.01, r.sensitivity) / norm);
        return { ...r, dB };
    });

    const suspicious = [];
    // Look for sign reversals: point flanked by neighbors that are both above or both below it
    for (let i = 1; i < withDB.length - 1; i++) {
        const prev = withDB[i - 1].dB;
        const curr = withDB[i].dB;
        const next = withDB[i + 1].dB;

        // Is this point a local outlier? (both neighbors on the same side, and the deviation is meaningful)
        const avgNeighbors = (prev + next) / 2;
        const deviation = Math.abs(curr - avgNeighbors);
        if (deviation > 3) { // > 3 dB swing from neighbors' average
            suspicious.push(withDB[i].denom);
            // Also retest neighbors for confirmation
            suspicious.push(withDB[i - 1].denom);
            suspicious.push(withDB[i + 1].denom);
        }
    }

    // Deduplicate
    return [...new Set(suspicious)].sort((a, b) => b - a);
}

function csfComplete() {
    const finalResults = csfBuildResults();

    // After pass 2, check for noise before finalizing
    if (csfState.pass === 2) {
        const noisyDenoms = csfDetectNoisyRegions(finalResults);
        if (noisyDenoms.length > 0) {
            // Suggest pass 3 to clinician — don't auto-start
            csfBroadcast('csf-suggest-pass3', {
                results: finalResults,
                noisyDenoms: noisyDenoms
            });
            // Stay active, waiting for clinician decision
            csfState.waitingForClinician = true;
            return;
        }
    }

    // No noise (or pass 3 already done) — finalize
    csfFinalize(finalResults);
}

function csfStartPass3(denoms) {
    csfState.pass = 3;
    csfState.levels = denoms.sort((a, b) => b - a);
    csfState.levelIndex = 0;

    // Update indicator
    const indicator = $('#snellen-indicator');
    if (indicator) {
        indicator.style.background = 'linear-gradient(135deg, #8b5cf6, #6d28d9)';
    }

    csfNextLine();
}

function csfFinalize(finalResults) {
    // Broadcast to clinician
    csfBroadcast('csf-complete', { results: finalResults });

    // Show results on patient display
    csfShowPatientResults(finalResults);

    csfState.active = false;
    csfState.waitingForClinician = false;
    csfUpdateUI();
}

function csfHandleClinicianMessage(data) {
    switch (data.type) {
        case 'csf-response':
            if (csfState.active && csfState.waitingForClinician) {
                csfProcessResponse(data.errors);
            }
            break;
        case 'csf-accept-pass3':
            if (csfState.active && data.denoms) {
                csfStartPass3(data.denoms);
            }
            break;
        case 'csf-decline-pass3':
            if (csfState.active) {
                csfFinalize(csfBuildResults());
            }
            break;
        case 'csf-abort':
            csfStopTest();
            break;
        case 'clinician-ready':
            // Clinician loaded; if we have a pending line, resend
            if (csfState.active && csfState.currentLetters.length > 0) {
                const denom = csfState.levels[csfState.levelIndex];
                csfBroadcast('csf-line', {
                    snellenDenom: denom,
                    letters: csfState.currentLetters,
                    contrasts: csfState.currentContrasts,
                    pass: csfState.pass,
                    levelIndex: csfState.levelIndex,
                    totalLevels: csfState.levels.length
                });
            }
            break;
    }
}

function csfUpdateUI() {
    const csfBtn = $('#csf-start-btn');
    const csfStopBtn = $('#csf-stop-btn');
    const blPanel = $('#bl-bottom-panel');
    const contrastPanel = $('#contrast-panel');
    const snellenControls = $('.snellen-controls');
    const indicator = $('#snellen-indicator');

    if (csfState.active) {
        if (csfBtn) csfBtn.classList.add('hidden');
        if (csfStopBtn) csfStopBtn.classList.remove('hidden');
        if (contrastPanel) contrastPanel.classList.add('hidden');
        if (snellenControls) snellenControls.classList.add('hidden');
        if (indicator) indicator.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
    } else {
        if (csfBtn) csfBtn.classList.remove('hidden');
        if (csfStopBtn) csfStopBtn.classList.add('hidden');
        if (snellenControls) snellenControls.classList.remove('hidden');
        if (indicator) {
            indicator.style.background = '';
            renderDistanceTest();
        }
        // Restore BL panel state
        if (baileyLovieMode && contrastPanel) {
            contrastPanel.classList.remove('hidden');
        }
    }
}

function csfShowPatientResults(results) {
    // Show overlay with CSF graph on patient display
    let overlay = $('#csf-results-overlay');
    if (!overlay) return;

    overlay.classList.remove('hidden');

    const canvas = $('#csf-patient-canvas');
    if (canvas) {
        renderCSFGraph(canvas, results);
    }
}

function csfClosePatientResults() {
    const overlay = $('#csf-results-overlay');
    if (overlay) overlay.classList.add('hidden');
}

// Normative letter-optotype CSF: log-Gaussian in log-frequency space
// Peaks near 20/50 (0.5 cpd), smooth decline through 20/20 to 20/10.
// Average thresholds: 20/50 ~2.3%, 20/20 ~8%, 20/15 ~17%, 20/10 ~64%
function csfNormative(cpd) {
    const peak = 45;
    const fp = 0.5;
    const sigma = 0.3;
    const logRatio = Math.log10(cpd / fp);
    return peak * Math.exp(-(logRatio * logRatio) / (2 * sigma * sigma));
}

// Catmull-Rom spline: returns array of {x, y} points for smooth curve through data
function catmullRomSpline(points, segments) {
    if (points.length < 2) return points;
    const result = [];
    // Pad endpoints by reflecting
    const pts = [
        { x: 2 * points[0].x - points[1].x, y: 2 * points[0].y - points[1].y },
        ...points,
        { x: 2 * points[points.length - 1].x - points[points.length - 2].x,
          y: 2 * points[points.length - 1].y - points[points.length - 2].y }
    ];
    for (let i = 1; i < pts.length - 2; i++) {
        const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2];
        for (let s = 0; s < segments; s++) {
            const t = s / segments;
            const t2 = t * t, t3 = t2 * t;
            const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t +
                (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
            const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t +
                (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
            result.push({ x, y });
        }
    }
    result.push(points[points.length - 1]);
    return result;
}

function renderCSFGraph(canvas, results) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.clearRect(0, 0, w, h);

    // Margins — extra room for dual labels
    const ml = 58, mr = 50, mt = 24, mb = 62;
    const pw = w - ml - mr;
    const ph = h - mt - mb;

    // Compute normalized deviations
    const normData = results.map(r => {
        const norm = csfNormative(r.cpd);
        const dB = 10 * Math.log10(Math.max(0.01, r.sensitivity) / norm);
        return { ...r, norm, dB };
    });

    // X-axis: log spatial frequency
    const cpdValues = results.map(r => r.cpd);
    const logCpdMin = Math.floor(Math.log10(Math.min(...cpdValues)) * 4) / 4 - 0.05;
    const logCpdMax = Math.ceil(Math.log10(Math.max(...cpdValues)) * 4) / 4 + 0.05;

    // Y-axis: dB deviation, symmetric
    const maxAbsDB = Math.max(10, Math.ceil(Math.max(...normData.map(d => Math.abs(d.dB))) / 5) * 5);
    const yMin = -maxAbsDB;
    const yMax = maxAbsDB;

    function toX(cpd) { return ml + pw * (Math.log10(cpd) - logCpdMin) / (logCpdMax - logCpdMin); }
    function toY(dB) { return mt + ph * (1 - (dB - yMin) / (yMax - yMin)); }
    const zeroY = toY(0);

    // --- Background gradient zones ---
    const greenGrad = ctx.createLinearGradient(0, mt, 0, zeroY);
    greenGrad.addColorStop(0, 'rgba(16, 185, 129, 0.10)');
    greenGrad.addColorStop(1, 'rgba(16, 185, 129, 0.01)');
    ctx.fillStyle = greenGrad;
    ctx.fillRect(ml, mt, pw, zeroY - mt);
    const redGrad = ctx.createLinearGradient(0, zeroY, 0, mt + ph);
    redGrad.addColorStop(0, 'rgba(239, 68, 68, 0.01)');
    redGrad.addColorStop(1, 'rgba(239, 68, 68, 0.10)');
    ctx.fillStyle = redGrad;
    ctx.fillRect(ml, zeroY, pw, mt + ph - zeroY);

    // --- Fine grid ---
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let lv = Math.floor(logCpdMin * 4) / 4; lv <= logCpdMax; lv += 0.125) {
        const x = toX(Math.pow(10, lv));
        if (x < ml || x > ml + pw) continue;
        ctx.beginPath(); ctx.moveTo(x, mt); ctx.lineTo(x, mt + ph); ctx.stroke();
    }
    for (let dB = yMin; dB <= yMax; dB += 2.5) {
        if (Math.abs(dB) < 0.1) continue;
        const y = toY(dB);
        ctx.strokeStyle = (dB % 5 === 0) ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)';
        ctx.beginPath(); ctx.moveTo(ml, y); ctx.lineTo(ml + pw, y); ctx.stroke();
    }

    // --- Axes ---
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ml, mt); ctx.lineTo(ml, mt + ph); ctx.lineTo(ml + pw, mt + ph);
    ctx.stroke();

    // --- Average line ---
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 0.75;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(ml, zeroY); ctx.lineTo(ml + pw, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = `9px ${font}`;
    ctx.textAlign = 'left';
    ctx.fillText('AVERAGE', ml + pw + 5, zeroY + 3);

    // --- Spline ---
    const dataPoints = normData.map(d => ({ x: toX(d.cpd), y: toY(d.dB) }));
    const spline = catmullRomSpline(dataPoints, 24);

    // --- Gradient fill between spline and zero ---
    ctx.save();
    ctx.beginPath(); ctx.rect(ml, mt, pw, zeroY - mt); ctx.clip();
    const gf = ctx.createLinearGradient(0, mt, 0, zeroY);
    gf.addColorStop(0, 'rgba(52, 211, 153, 0.25)');
    gf.addColorStop(1, 'rgba(52, 211, 153, 0.03)');
    ctx.fillStyle = gf;
    ctx.beginPath();
    ctx.moveTo(spline[0].x, zeroY);
    spline.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(spline[spline.length - 1].x, zeroY);
    ctx.closePath(); ctx.fill(); ctx.restore();

    ctx.save();
    ctx.beginPath(); ctx.rect(ml, zeroY, pw, mt + ph - zeroY); ctx.clip();
    const rf = ctx.createLinearGradient(0, zeroY, 0, mt + ph);
    rf.addColorStop(0, 'rgba(248, 113, 113, 0.03)');
    rf.addColorStop(1, 'rgba(248, 113, 113, 0.25)');
    ctx.fillStyle = rf;
    ctx.beginPath();
    ctx.moveTo(spline[0].x, zeroY);
    spline.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(spline[spline.length - 1].x, zeroY);
    ctx.closePath(); ctx.fill(); ctx.restore();

    // --- Subtle glow ---
    ctx.save();
    ctx.shadowColor = 'rgba(59, 130, 246, 0.35)';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    spline.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();
    ctx.restore();

    // --- Main curve ---
    const lineGrad = ctx.createLinearGradient(spline[0].x, 0, spline[spline.length - 1].x, 0);
    lineGrad.addColorStop(0, '#60a5fa');
    lineGrad.addColorStop(0.5, '#a78bfa');
    lineGrad.addColorStop(1, '#818cf8');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    spline.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();

    // --- Data points (small, refined) ---
    normData.forEach(d => {
        const x = toX(d.cpd);
        const y = toY(d.dB);
        const color = d.dB >= 0 ? '#34d399' : '#f87171';
        // Small dot matching curve weight
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 0.75;
        ctx.stroke();
    });

    // --- X-axis: dual labels ---
    // Technical: cpd values at each data point
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `9px ${font}`;
    ctx.textAlign = 'center';
    normData.forEach(d => {
        const x = toX(d.cpd);
        ctx.fillText(d.cpd < 1 ? d.cpd.toFixed(2) : d.cpd.toFixed(1), x, mt + ph + 13);
    });
    // Snellen equivalents
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = `7.5px ${font}`;
    normData.forEach(d => {
        const x = toX(d.cpd);
        const denomLabel = Number.isInteger(d.denom) ? d.denom : Math.round(d.denom);
        ctx.fillText(`20/${denomLabel}`, x, mt + ph + 23);
    });
    // Technical axis title
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = `8px ${font}`;
    ctx.fillText('Spatial Frequency (cpd)', ml + pw / 2, mt + ph + 36);
    // Layman axis: coarse ←→ fine
    ctx.font = `bold 7.5px ${font}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillText('COARSE', ml, mt + ph + 50);
    ctx.textAlign = 'center';
    ctx.fillText('Detail \u2192', ml + pw / 2, mt + ph + 50);
    ctx.textAlign = 'right';
    ctx.fillText('FINE', ml + pw, mt + ph + 50);

    // --- Y-axis: dual labels ---
    ctx.font = `9px ${font}`;
    ctx.textAlign = 'right';
    for (let dB = yMin; dB <= yMax; dB += 5) {
        const y = toY(dB);
        const label = (dB > 0 ? '+' : '') + dB;
        ctx.fillStyle = dB > 0 ? 'rgba(52, 211, 153, 0.5)'
                      : dB < 0 ? 'rgba(248, 113, 113, 0.5)'
                      : 'rgba(255,255,255,0.4)';
        ctx.fillText(label + ' dB', ml - 5, y + 3);
    }
    // Technical axis title
    ctx.save();
    ctx.translate(11, mt + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = `8px ${font}`;
    ctx.fillText('Contrast Sensitivity vs. Average', 0, 0);
    ctx.restore();
    // Layman axis: contrast description
    ctx.save();
    ctx.translate(ml + pw + 42, mt + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.font = `bold 7.5px ${font}`;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillText('needs bold \u2190  Contrast  \u2192 sees faint', 0, 0);
    ctx.restore();

    // --- Better / Worse ---
    ctx.font = `bold 8px ${font}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(52, 211, 153, 0.3)';
    ctx.fillText('BETTER \u25B2', ml + pw - 4, mt + 12);
    ctx.fillStyle = 'rgba(248, 113, 113, 0.3)';
    ctx.fillText('WORSE \u25BC', ml + pw - 4, mt + ph - 5);
}

function initLuminanceCalibration() {
    const slider = $('#gamma-slider');
    const circle = $('#luminance-inner-circle');
    const valueDisplay = $('#gamma-value');

    // Restore saved gamma
    const saved = localStorage.getItem('nearpoint_gamma_grey');
    if (saved) {
        slider.value = saved;
    }

    function updateGamma() {
        const v = slider.value;
        circle.style.backgroundColor = `rgb(${v},${v},${v})`;
        valueDisplay.textContent = v;
    }

    slider.addEventListener('input', updateGamma);
    updateGamma();

    function nudgeGamma(delta) {
        slider.value = Math.max(60, Math.min(220, parseInt(slider.value) + delta));
        updateGamma();
    }

    $('#gamma-down-btn').addEventListener('click', () => nudgeGamma(-1));
    $('#gamma-up-btn').addEventListener('click', () => nudgeGamma(1));

    $('#luminance-save-btn').addEventListener('click', () => {
        localStorage.setItem('nearpoint_gamma_grey', slider.value);
        $('#luminance-modal').classList.add('hidden');
    });
}

// ==========================================
// RECALIBRATE FROM INLINE
// ==========================================

document.addEventListener('click', (e) => {
    if (e.target.id === 'recalibrate-inline') {
        showScreen('calibration');
    }
});

// ==========================================
// CAMERA DISTANCE MEASUREMENT
// ==========================================
// Freeze-frame approach: user captures a still frame, then clicks
// on each of the two orange stickers to mark them precisely.
// Multi-point calibration (40, 50, 60, 80 cm) builds an accurate
// distance model. Measurement uses: distance = k / pixelSeparation
// where k is the averaged calibration constant.

const distanceTracker = {
    stream: null,
    video: null,
    canvas: null,
    ctx: null,

    // State
    mode: 'off', // off | live | cal_live | cal_frozen | meas_live | meas_frozen | meas_auto
    frozen: false,
    frozenImageData: null,
    clickPoints: [],       // [{x,y}] for current frame (max 2)

    // Calibration (single-point: user provides distance + we measure pixel separation)
    calDistanceCm: 40,     // user-entered distance during calibration
    calibrationK: null,    // calibration constant (cm * px)

    // Color learning — samples collected during calibration clicks
    colorSamples: [],      // [{h,s,v}] from all calibration click neighborhoods
    colorProfile: null,    // {hMin,hMax,sMin,sMax,vMin,vMax} learned HSV thresholds

    // Settings
    markerSeparationMM: 75,

    // Convert RGB (0-255) to HSV (h: 0-360, s: 0-100, v: 0-100)
    rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const d = max - min;
        let h = 0;
        if (d !== 0) {
            if (max === r) h = ((g - b) / d + 6) % 6;
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h *= 60;
        }
        const s = max === 0 ? 0 : (d / max) * 100;
        const v = max * 100;
        return { h, s, v };
    },

    // Sample pixels around a click point to learn the sticker color.
    // Filters out low-saturation/low-brightness pixels that are likely background
    // leaking in from the edge of the sampling radius.
    sampleColorAtPoint(imageData, cx, cy, radius) {
        const w = imageData.width;
        const h = imageData.height;
        const data = imageData.data;
        const samples = [];
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dx * dx + dy * dy > radius * radius) continue;
                const px = Math.round(cx + dx);
                const py = Math.round(cy + dy);
                if (px < 0 || px >= w || py < 0 || py >= h) continue;
                const idx = (py * w + px) * 4;
                const hsv = this.rgbToHsv(data[idx], data[idx + 1], data[idx + 2]);
                // Only keep clearly colored pixels — skip grays/whites/blacks
                if (hsv.s >= 20 && hsv.v >= 20) {
                    samples.push(hsv);
                }
            }
        }
        return samples;
    },

    // Build a color profile from accumulated samples (mean ± 3*std with padding)
    buildColorProfile() {
        if (this.colorSamples.length < 10) return null;
        const n = this.colorSamples.length;

        const hVals = this.colorSamples.map(s => s.h);
        const sVals = this.colorSamples.map(s => s.s);
        const vVals = this.colorSamples.map(s => s.v);

        const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
        const std = arr => {
            const m = mean(arr);
            return Math.sqrt(arr.reduce((sum, x) => sum + (x - m) ** 2, 0) / arr.length);
        };

        const hMean = mean(hVals), hStd = std(hVals);
        const sMean = mean(sVals), sStd = std(sVals);
        const vMean = mean(vVals), vStd = std(vVals);

        // Use 2*std + small padding for tighter matching
        // Enforce minimum saturation & value floors — orange stickers are vivid and bright
        return {
            hMin: Math.max(0, hMean - 2 * hStd - 5),
            hMax: Math.min(360, hMean + 2 * hStd + 5),
            sMin: Math.max(30, sMean - 2 * sStd - 10),
            sMax: Math.min(100, sMean + 2 * sStd + 10),
            vMin: Math.max(30, vMean - 2 * vStd - 10),
            vMax: Math.min(100, vMean + 2 * vStd + 10)
        };
    },

    // Auto-detect markers in the frozen frame using learned color profile
    autoDetectMarkers() {
        if (!this.colorProfile || !this.frozenImageData) return null;

        const imageData = this.frozenImageData;
        const w = imageData.width, h = imageData.height;
        const data = imageData.data;
        const profile = this.colorProfile;
        const matchingPixels = [];

        // Scan every 2nd pixel for speed
        for (let y = 0; y < h; y += 2) {
            for (let x = 0; x < w; x += 2) {
                const idx = (y * w + x) * 4;
                const hsv = this.rgbToHsv(data[idx], data[idx + 1], data[idx + 2]);
                if (hsv.h >= profile.hMin && hsv.h <= profile.hMax &&
                    hsv.s >= profile.sMin && hsv.s <= profile.sMax &&
                    hsv.v >= profile.vMin && hsv.v <= profile.vMax) {
                    matchingPixels.push({ x, y });
                }
            }
        }

        if (matchingPixels.length < 10) return null;

        return this.clusterMarkers(matchingPixels);
    },

    // Cluster matching pixels into blobs via connected-component labeling,
    // then return centroids of the two largest compact blobs.
    clusterMarkers(pixels) {
        if (pixels.length < 10) return null;

        // Grid-based connected component labeling (6px cells)
        const cellSize = 6;
        const grid = new Map();

        for (const p of pixels) {
            const key = `${Math.floor(p.x / cellSize)},${Math.floor(p.y / cellSize)}`;
            if (!grid.has(key)) grid.set(key, []);
            grid.get(key).push(p);
        }

        // BFS flood-fill to find connected components
        const visited = new Set();
        const components = [];

        for (const key of grid.keys()) {
            if (visited.has(key)) continue;
            visited.add(key);

            const component = [...grid.get(key)];
            const queue = [key];

            while (queue.length > 0) {
                const current = queue.shift();
                const [cx, cy] = current.split(',').map(Number);

                // 8-connected neighbors
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const nkey = `${cx + dx},${cy + dy}`;
                        if (!visited.has(nkey) && grid.has(nkey)) {
                            visited.add(nkey);
                            component.push(...grid.get(nkey));
                            queue.push(nkey);
                        }
                    }
                }
            }

            components.push(component);
        }

        // Sort by pixel count descending, take two largest
        components.sort((a, b) => b.length - a.length);
        if (components.length < 2) return null;

        // Each blob needs a minimum pixel count (at least 8, or 5% of all matches)
        const minBlobSize = Math.max(8, pixels.length * 0.05);
        if (components[0].length < minBlobSize || components[1].length < minBlobSize) return null;

        // Compactness check — each blob's bounding box must be sticker-sized,
        // not scattered noise spread across the image
        const maxBlobSpan = Math.max(this.canvas.width, this.canvas.height) * 0.15;
        for (const comp of [components[0], components[1]]) {
            let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
            for (const p of comp) {
                if (p.x < xMin) xMin = p.x;
                if (p.x > xMax) xMax = p.x;
                if (p.y < yMin) yMin = p.y;
                if (p.y > yMax) yMax = p.y;
            }
            if ((xMax - xMin) > maxBlobSpan || (yMax - yMin) > maxBlobSpan) return null;
        }

        const centroid = arr => ({
            x: arr.reduce((s, p) => s + p.x, 0) / arr.length,
            y: arr.reduce((s, p) => s + p.y, 0) / arr.length
        });

        const c1 = centroid(components[0]);
        const c2 = centroid(components[1]);

        // Centroids must be meaningfully separated (at least 30px)
        if (Math.hypot(c1.x - c2.x, c1.y - c2.y) < 30) return null;

        return [c1, c2];
    },

    async start() {
        this.video = document.getElementById('camera-video');
        this.canvas = document.getElementById('camera-canvas');
        this.ctx = this.canvas.getContext('2d');

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            this.video.srcObject = this.stream;
            await this.video.play();

            // Size canvas to match video resolution
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;

            this.loadSettings();
            const sepInput = document.getElementById('marker-separation');
            if (sepInput) sepInput.value = this.markerSeparationMM;

            this.mode = 'live';
            this.frozen = false;
            this.video.style.visibility = '';
            this.canvas.style.cursor = 'default';
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.updateUI();
        } catch (err) {
            document.getElementById('camera-status').textContent = 'Camera access denied';
        }
    },

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
        this.mode = 'off';
        this.frozen = false;
        this.frozenImageData = null;
        this.clickPoints = [];
        this.video.style.visibility = '';
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        document.getElementById('camera-status').textContent = 'Camera off';
    },

    // Freeze the current video frame onto the canvas
    captureFrame() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        // Draw mirrored so the display matches the live preview
        this.ctx.save();
        this.ctx.translate(w, 0);
        this.ctx.scale(-1, 1);
        this.ctx.drawImage(this.video, 0, 0, w, h);
        this.ctx.restore();
        // Save the clean frame for redrawing after marker annotations
        this.frozenImageData = this.ctx.getImageData(0, 0, w, h);
        this.video.style.visibility = 'hidden';
        this.canvas.style.cursor = 'crosshair';
        this.frozen = true;
        this.clickPoints = [];
    },

    // Return to live video
    unfreezeFrame() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.video.style.visibility = '';
        this.canvas.style.cursor = 'default';
        this.frozen = false;
        this.frozenImageData = null;
        this.clickPoints = [];
    },

    // Button: Capture
    capture() {
        if (this.mode === 'cal_live') {
            this.captureFrame();
            this.mode = 'cal_frozen';
        } else if (this.mode === 'meas_live') {
            this.captureFrame();
            this.mode = 'meas_frozen';
        }
        this.updateUI();
    },

    // Button: Calibrate — single-point: user enters distance, we compute k
    startCalibration() {
        this.colorSamples = [];   // Reset color learning
        this.colorProfile = null;
        this.unfreezeFrame();
        this.mode = 'cal_live';
        // Expand viewfinder for calibration
        document.getElementById('camera-panel').classList.add('calibrating');
        document.getElementById('cal-distance-row').style.display = '';
        this.updateUI();
    },

    // Button: Measure — auto-detect markers using learned colors
    startMeasure() {
        if (!this.calibrationK) {
            document.getElementById('camera-status').textContent = 'Calibrate first!';
            return;
        }

        // Return to live video first (in case we're re-measuring)
        this.unfreezeFrame();

        // Brief delay to let the video feed update before capturing
        document.getElementById('camera-status').textContent = 'Capturing...';
        setTimeout(() => this._doMeasure(), 300);
    },

    _doMeasure() {
        // Capture a frame
        this.captureFrame();

        // Try auto-detection if we have a color profile
        if (this.colorProfile) {
            const markers = this.autoDetectMarkers();
            if (markers) {
                // Auto-detected successfully
                this.clickPoints = markers;
                this.drawMarkers();

                const pixSep = Math.hypot(markers[0].x - markers[1].x, markers[0].y - markers[1].y);
                const distCm = Math.round(this.calibrationK / pixSep);

                document.getElementById('camera-status').textContent =
                    `Auto-detected: ${distCm} cm  (${pixSep.toFixed(0)}px separation)`;

                // Update the slider
                const slider = document.getElementById('standard-distance-slider');
                const clamped = Math.max(
                    parseInt(slider.min),
                    Math.min(parseInt(slider.max), distCm)
                );
                slider.value = clamped;
                document.getElementById('standard-distance-value').textContent = clamped + ' cm';
                renderStandardTestType(clamped);

                this.mode = 'meas_auto';
                this.updateUI();
                return;
            }
        }

        // Fallback: manual click mode
        this.mode = 'meas_frozen';
        this.updateUI();
    },

    // Canvas click — mark sticker positions
    // --- Click-and-drag marker placement ---
    // mousedown/touchstart: begin dragging a new marker
    // mousemove/touchmove: live crosshair follows pointer
    // mouseup/touchend: finalize the marker position

    dragging: false,
    dragPoint: null, // {x, y} current drag position in canvas coords

    canvasCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
        };
    },

    // Search near a point for the center of an orange blob (snap-to-sticker)
    findNearestOrangeBlob(cx, cy, searchRadius) {
        if (!this.frozenImageData) return null;
        const w = this.frozenImageData.width, h = this.frozenImageData.height;
        const data = this.frozenImageData.data;

        // Use learned color profile if available, otherwise broad orange hue
        const hasProfile = !!this.colorProfile;
        const prof = this.colorProfile || { hMin: 5, hMax: 35, sMin: 40, sMax: 100, vMin: 40, vMax: 100 };

        const matches = [];
        const r = Math.round(searchRadius);
        for (let dy = -r; dy <= r; dy += 2) {
            for (let dx = -r; dx <= r; dx += 2) {
                if (dx * dx + dy * dy > r * r) continue;
                const px = Math.round(cx + dx), py = Math.round(cy + dy);
                if (px < 0 || px >= w || py < 0 || py >= h) continue;
                const idx = (py * w + px) * 4;
                const hsv = this.rgbToHsv(data[idx], data[idx + 1], data[idx + 2]);
                if (hsv.h >= prof.hMin && hsv.h <= prof.hMax &&
                    hsv.s >= prof.sMin && hsv.s <= prof.sMax &&
                    hsv.v >= prof.vMin && hsv.v <= prof.vMax) {
                    matches.push({ x: px, y: py });
                }
            }
        }
        if (matches.length < 4) return null;

        // Return centroid of matches
        return {
            x: matches.reduce((s, p) => s + p.x, 0) / matches.length,
            y: matches.reduce((s, p) => s + p.y, 0) / matches.length
        };
    },

    handlePointerDown(e) {
        if (!this.frozen || this.clickPoints.length >= 2) return;
        this.dragging = true;
        let pt = this.canvasCoords(e);

        // Snap to nearest orange blob within 60px
        const snap = this.findNearestOrangeBlob(pt.x, pt.y, 60);
        if (snap) pt = snap;

        this.dragPoint = pt;
        this.drawMarkers(); // show preview immediately
    },

    handlePointerMove(e) {
        if (!this.dragging) return;
        this.dragPoint = this.canvasCoords(e);
        this.drawMarkers(); // redraw with live crosshair
    },

    handlePointerUp(e) {
        if (!this.dragging) return;
        this.dragging = false;
        let pt = this.canvasCoords(e);
        this.dragPoint = null;

        // Snap to nearest orange blob on release too
        const snap = this.findNearestOrangeBlob(pt.x, pt.y, 30);
        if (snap) pt = snap;

        this.clickPoints.push(pt);

        // During calibration, learn the sticker color from each placed marker
        if (this.mode === 'cal_frozen' && this.frozenImageData) {
            const samples = this.sampleColorAtPoint(this.frozenImageData, Math.round(pt.x), Math.round(pt.y), 12);
            this.colorSamples.push(...samples);
        }

        this.drawMarkers();

        if (this.clickPoints.length === 2) {
            const pixSep = Math.hypot(
                this.clickPoints[0].x - this.clickPoints[1].x,
                this.clickPoints[0].y - this.clickPoints[1].y
            );

            if (this.mode === 'cal_frozen') {
                // Single-point calibration: k = distance * pixelSep
                const distInput = document.getElementById('cal-distance');
                this.calDistanceCm = parseInt(distInput.value) || 40;
                this.calibrationK = this.calDistanceCm * pixSep;
                this.finishCalibration(pixSep);
            } else if (this.mode === 'meas_frozen') {
                if (!this.calibrationK) {
                    document.getElementById('camera-status').textContent = 'Calibrate first!';
                    return;
                }
                const distCm = Math.round(this.calibrationK / pixSep);
                document.getElementById('camera-status').textContent =
                    `Distance: ${distCm} cm  (${pixSep.toFixed(0)}px separation)`;

                // Update the slider
                const slider = document.getElementById('standard-distance-slider');
                const clamped = Math.max(
                    parseInt(slider.min),
                    Math.min(parseInt(slider.max), distCm)
                );
                slider.value = clamped;
                document.getElementById('standard-distance-value').textContent = clamped + ' cm';
                renderStandardTestType(clamped);
            }
        }
        this.updateUI();
    },

    // Redraw the frozen frame + any marker annotations
    drawMarkers() {
        if (this.frozenImageData) {
            this.ctx.putImageData(this.frozenImageData, 0, 0);
        }
        const ctx = this.ctx;

        // Draw finalized markers
        this.clickPoints.forEach((p, i) => {
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(p.x - 18, p.y); ctx.lineTo(p.x + 18, p.y);
            ctx.moveTo(p.x, p.y - 18); ctx.lineTo(p.x, p.y + 18);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#ff4444';
            ctx.font = 'bold 16px Inter, sans-serif';
            ctx.fillText(i === 0 ? 'A' : 'B', p.x + 26, p.y - 12);
        });

        // Draw live drag-preview crosshair (semi-transparent)
        if (this.dragging && this.dragPoint) {
            const p = this.dragPoint;
            const label = this.clickPoints.length === 0 ? 'A' : 'B';
            ctx.strokeStyle = 'rgba(255, 68, 68, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(p.x - 18, p.y); ctx.lineTo(p.x + 18, p.y);
            ctx.moveTo(p.x, p.y - 18); ctx.lineTo(p.x, p.y + 18);
            ctx.stroke();
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(255, 68, 68, 0.5)';
            ctx.font = 'bold 16px Inter, sans-serif';
            ctx.fillText(label, p.x + 26, p.y - 12);
        }

        // Dashed line + pixel distance label
        if (this.clickPoints.length === 2) {
            const a = this.clickPoints[0], b = this.clickPoints[1];
            ctx.strokeStyle = 'rgba(255, 68, 68, 0.8)';
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 4]);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.setLineDash([]);

            const pixSep = Math.hypot(a.x - b.x, a.y - b.y);
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.fillRect(mx - 45, my - 24, 90, 26);
            ctx.fillStyle = '#ff4444';
            ctx.font = 'bold 14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${pixSep.toFixed(0)} px`, mx, my - 6);
            ctx.textAlign = 'left';
        }
    },

    // Complete calibration, save, and auto-close camera panel
    finishCalibration(pixSep) {
        // Build color profile from accumulated samples
        this.colorProfile = this.buildColorProfile();
        this.saveSettings();

        // Show the quick-measure button
        if (this.colorProfile) {
            const qmBtn = document.getElementById('quick-measure-btn');
            if (qmBtn) qmBtn.style.display = '';
        }

        // Brief confirmation then auto-close panel
        document.getElementById('camera-status').textContent =
            `Calibrated! k=${this.calibrationK.toFixed(0)} (${this.calDistanceCm}cm @ ${pixSep.toFixed(0)}px)`;

        setTimeout(() => {
            // Close camera panel and stop stream
            this.stop();
            const panel = document.getElementById('camera-panel');
            panel.classList.add('hidden');
            panel.classList.remove('calibrating');
            document.getElementById('cal-distance-row').style.display = 'none';
            document.getElementById('camera-track-btn').classList.remove('active');
        }, 1200);
    },

    // Update button visibility and status text based on current mode
    updateUI() {
        const status = document.getElementById('camera-status');
        const captureBtn = document.getElementById('camera-capture-btn');
        const calBtn = document.getElementById('camera-calibrate-btn');
        const measBtn = document.getElementById('camera-measure-btn');

        captureBtn.style.display = 'none';
        calBtn.style.display = 'none';
        measBtn.style.display = 'none';

        switch (this.mode) {
            case 'live':
                if (this.calibrationK) {
                    const autoLabel = this.colorProfile ? ' (auto-detect)' : '';
                    status.textContent = `Calibrated (k=${this.calibrationK.toFixed(0)}).${autoLabel} Measure or re-calibrate.`;
                    measBtn.style.display = '';
                    measBtn.textContent = 'Measure';
                } else {
                    status.textContent = 'Not calibrated. Click Calibrate to begin.';
                }
                calBtn.style.display = '';
                calBtn.textContent = this.calibrationK ? 'Re-calibrate' : 'Calibrate';
                break;

            case 'cal_live':
                status.textContent = 'Set distance below, then press Capture';
                captureBtn.style.display = '';
                break;

            case 'cal_frozen':
                if (this.clickPoints.length === 0) {
                    status.textContent = 'Click on the FIRST orange sticker (snaps to orange)';
                } else if (this.clickPoints.length === 1) {
                    status.textContent = 'Click on the SECOND orange sticker';
                }
                break;

            case 'meas_live':
                status.textContent = 'Position tablet at desired distance \u2192 Capture';
                captureBtn.style.display = '';
                break;

            case 'meas_frozen':
                if (this.clickPoints.length === 0) {
                    status.textContent = 'Auto-detect failed. Click & drag onto the FIRST orange sticker';
                } else if (this.clickPoints.length === 1) {
                    status.textContent = 'Click & drag onto the SECOND orange sticker';
                }
                // After 2 markers placed, status is set in handlePointerUp
                if (this.clickPoints.length === 2) {
                    measBtn.style.display = '';
                    measBtn.textContent = 'Remeasure';
                    calBtn.style.display = '';
                    calBtn.textContent = 'Re-calibrate';
                }
                break;

            case 'meas_auto':
                // Auto-detection succeeded — show remeasure and recalibrate options
                measBtn.style.display = '';
                measBtn.textContent = 'Remeasure';
                calBtn.style.display = '';
                calBtn.textContent = 'Re-calibrate';
                break;
        }
    },

    saveSettings() {
        localStorage.setItem('nearpoint_camera', JSON.stringify({
            calibrationK: this.calibrationK,
            markerSeparationMM: this.markerSeparationMM,
            colorProfile: this.colorProfile
        }));
    },

    loadSettings() {
        const saved = localStorage.getItem('nearpoint_camera');
        if (saved) {
            const data = JSON.parse(saved);
            if (data.calibrationK) this.calibrationK = data.calibrationK;
            if (data.markerSeparationMM) this.markerSeparationMM = data.markerSeparationMM;
            if (data.colorProfile) this.colorProfile = data.colorProfile;
        }
    },

    // Silent background measurement — no camera UI shown.
    // Uses a temporary offscreen video element to avoid display:none issues.
    async quickMeasure() {
        if (!this.calibrationK || !this.colorProfile) return false;

        // Ensure canvas is referenced (for autoDetectMarkers compactness check)
        if (!this.canvas) {
            this.canvas = document.getElementById('camera-canvas');
            this.ctx = this.canvas.getContext('2d');
        }

        let tempVideo = null;
        let stream = null;
        try {
            // Create a temporary offscreen video (avoids display:none blocking)
            tempVideo = document.createElement('video');
            tempVideo.autoplay = true;
            tempVideo.playsInline = true;
            tempVideo.muted = true;
            tempVideo.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;';
            document.body.appendChild(tempVideo);

            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            tempVideo.srcObject = stream;
            await tempVideo.play();

            // Let auto-exposure settle
            await new Promise(r => setTimeout(r, 600));

            // Use an offscreen canvas for the capture
            const w = tempVideo.videoWidth, h = tempVideo.videoHeight;
            const offCanvas = document.createElement('canvas');
            offCanvas.width = w;
            offCanvas.height = h;
            const offCtx = offCanvas.getContext('2d');

            // Capture frame (mirrored, same as calibration)
            offCtx.save();
            offCtx.translate(w, 0);
            offCtx.scale(-1, 1);
            offCtx.drawImage(tempVideo, 0, 0, w, h);
            offCtx.restore();

            // Stop camera immediately
            stream.getTracks().forEach(t => t.stop());
            stream = null;
            tempVideo.srcObject = null;
            document.body.removeChild(tempVideo);
            tempVideo = null;

            // Set up state for autoDetectMarkers
            this.frozenImageData = offCtx.getImageData(0, 0, w, h);
            this.canvas.width = w;
            this.canvas.height = h;

            const markers = this.autoDetectMarkers();
            this.frozenImageData = null;

            if (markers) {
                const pixSep = Math.hypot(markers[0].x - markers[1].x, markers[0].y - markers[1].y);
                const distCm = Math.round(this.calibrationK / pixSep);

                const slider = document.getElementById('standard-distance-slider');
                const clamped = Math.max(parseInt(slider.min), Math.min(parseInt(slider.max), distCm));
                slider.value = clamped;
                document.getElementById('standard-distance-value').textContent = clamped + ' cm';
                renderStandardTestType(clamped);
                return true;
            }
            return false;
        } catch (err) {
            console.error('Quick measure failed:', err);
            // Clean up on error
            if (stream) stream.getTracks().forEach(t => t.stop());
            if (tempVideo && tempVideo.parentNode) document.body.removeChild(tempVideo);
            return false;
        }
    }
};
