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
    occupation: 'general'
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

    if (state.cssPixelsPerMm) {
        showScreen('input');
    } else {
        showScreen('calibration');
    }
});

function showScreen(name) {
    $$('.screen').forEach(s => s.classList.add('hidden'));
    $(`#${name}-screen`).classList.remove('hidden');

    if (name === 'input') {
        updateConfigSummary();
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
    return mm * state.cssPixelsPerMm;
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
        });
    });

    // Distance slider for standard test
    $('#standard-distance-slider').addEventListener('input', () => {
        const d = parseInt($('#standard-distance-slider').value);
        $('#standard-distance-value').textContent = d + ' cm';
        renderStandardTestType(d);
    });

    // Occupation picker in test header
    $('#test-occupation-picker').addEventListener('change', () => {
        state.occupation = $('#test-occupation-picker').value;
        renderOccupationSamples();
    });

    // Camera tracking toggle
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
            $('#camera-status').textContent = 'Camera off';
        }
    });

    $('#marker-separation').addEventListener('change', () => {
        distanceTracker.markerSeparationMM = parseInt($('#marker-separation').value) || 120;
        distanceTracker.saveSettings();
    });

    $('#camera-calibrate-btn').addEventListener('click', () => {
        const knownDist = parseInt($('#calibrate-distance').value) || 50;
        if (distanceTracker.calibrate(knownDist)) {
            $('#camera-status').textContent = 'Calibrated! Tracking...';
        } else {
            $('#camera-status').textContent = 'Hold markers visible to calibrate';
        }
    });

    // Back button
    $('#back-btn').addEventListener('click', () => showScreen('input'));
}

function renderTest() {
    updateTestInfoBar();
    // Sync occupation picker with form selection
    $('#test-occupation-picker').value = state.occupation;
    const sliderDist = parseInt($('#standard-distance-slider').value) || 40;
    $('#standard-distance-value').textContent = sliderDist + ' cm';
    renderStandardTestType(sliderDist);
    renderOccupationSamples();
    renderDocumentSamples();
}

function updateTestInfoBar() {
    const distCm = state.workingDistance;
    const vergence = (100 / distCm).toFixed(2);
    const ppi = getMonitorPPI(state.monitorSize, state.monitorResolution);

    $('#test-distance-info').textContent =
        `Distance: ${distCm.toFixed(0)} cm (${(distCm / 2.54).toFixed(1)}")`;
    $('#test-monitor-info').textContent =
        `Monitor: ${state.monitorSize}" ${state.monitorResolution} @ ${state.displayScaling}% (${ppi.toFixed(0)} PPI)`;
    $('#test-vergence-info').textContent =
        `Vergence: ${vergence} D`;
}

function renderStandardTestType(testDistanceCm) {
    const container = $('#standard-test-container');
    container.innerHTML = '';

    testDistanceCm = testDistanceCm || 40;
    const distM = testDistanceCm / 100;
    const testFont = '"Times New Roman", "Georgia", serif';
    const xRatio = getXHeightRatio(testFont);

    // Container width: 50% at 40cm, 75% at 60cm (linear interpolation)
    const widthPercent = 50 + (testDistanceCm - 40) * 1.25;
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
        // Calculate the physical em-size of this font on the patient's monitor
        const physicalEmMM = getPhysicalEmSize(app.fontSize, fontUnit, monitorPPI, state.displayScaling);
        // Render at that physical size on the tablet
        const cssFontSize = mmToCSS(physicalEmMM);

        // Calculate what M-notation this corresponds to (for clinical reference)
        const xRatio = getXHeightRatio(app.font);
        const xHeightMM = physicalEmMM * xRatio;
        const equivalentM = xHeightMM / M_UNIT_MM;

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

        if (app.tabular) {
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
        const sizeLabel = fontUnit === 'px' ? `${app.fontSize}px` : `${app.fontSize}pt`;
        meta.innerHTML =
            `<span><strong>App font:</strong> ${sizeLabel} ${app.font.split(',')[0].replace(/"/g, '')}</span>` +
            `<span><strong>Physical size:</strong> ${physicalEmMM.toFixed(2)}mm em</span>` +
            `<span><strong>Approx:</strong> ${equivalentM.toFixed(2)}M</span>`;

        sample.appendChild(titlebar);
        sample.appendChild(content);
        sample.appendChild(meta);
        container.appendChild(sample);
    });
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
// CAMERA DISTANCE TRACKING
// ==========================================
// Uses two bright green stickers on the phoropter.
// Detects them via color thresholding and calculates
// distance using the pinhole camera model:
//   distance = (known_separation × focal_length_px) / pixel_separation

const distanceTracker = {
    stream: null,
    video: null,
    procCanvas: null,
    procCtx: null,
    overlayCanvas: null,
    overlayCtx: null,
    active: false,
    timeoutId: null,

    // Settings (persisted)
    markerSeparationMM: 120, // physical distance between stickers
    focalLengthPx: null,     // calibrated focal length at processing resolution

    // Processing
    processingWidth: 640,
    lastPixelSeparation: null,

    // Green color thresholds (HSV)
    hueMin: 60,
    hueMax: 160,
    satMin: 30,
    valMin: 30,

    // Smoothing
    distanceHistory: [],
    smoothingWindow: 5,

    async start() {
        this.video = document.getElementById('camera-video');
        this.overlayCanvas = document.getElementById('camera-canvas');
        this.overlayCtx = this.overlayCanvas.getContext('2d');
        this.procCanvas = document.createElement('canvas');
        this.procCtx = this.procCanvas.getContext('2d', { willReadFrequently: true });

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            this.video.srcObject = this.stream;
            await this.video.play();

            // Size the processing canvas
            const aspect = this.video.videoHeight / this.video.videoWidth;
            this.procCanvas.width = this.processingWidth;
            this.procCanvas.height = Math.round(this.processingWidth * aspect);

            // Size the overlay to match the video
            this.overlayCanvas.width = this.video.videoWidth;
            this.overlayCanvas.height = this.video.videoHeight;

            // Load saved calibration or estimate focal length from ~78 deg FOV
            this.loadSettings();
            if (!this.focalLengthPx) {
                this.focalLengthPx = this.procCanvas.width / (2 * Math.tan(78 / 2 * Math.PI / 180));
            }

            // Sync UI with saved marker separation
            const sepInput = document.getElementById('marker-separation');
            if (sepInput) sepInput.value = this.markerSeparationMM;

            this.active = true;
            this.distanceHistory = [];
            this.processLoop();

            document.getElementById('camera-status').textContent = 'Looking for markers\u2026';
        } catch (err) {
            document.getElementById('camera-status').textContent = 'Camera access denied';
        }
    },

    stop() {
        this.active = false;
        if (this.timeoutId) { clearTimeout(this.timeoutId); this.timeoutId = null; }
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
        if (this.overlayCtx) {
            this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        }
        this.distanceHistory = [];
        this.lastPixelSeparation = null;
    },

    processLoop() {
        if (!this.active) return;
        this.processFrame();
        this.timeoutId = setTimeout(() => this.processLoop(), 66); // ~15 fps
    },

    processFrame() {
        if (!this.video || this.video.readyState < 2) return;

        const pw = this.procCanvas.width;
        const ph = this.procCanvas.height;

        // Draw video frame to processing canvas (downscaled)
        this.procCtx.drawImage(this.video, 0, 0, pw, ph);
        const imageData = this.procCtx.getImageData(0, 0, pw, ph);
        const data = imageData.data;

        // Find green pixels
        const greenPixels = [];
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            if (this.isTargetColor(r, g, b)) {
                const idx = i / 4;
                greenPixels.push({ x: idx % pw, y: (idx / pw) | 0 });
            }
        }

        // Draw overlay
        const ctx = this.overlayCtx;
        const ow = this.overlayCanvas.width;
        const oh = this.overlayCanvas.height;
        ctx.clearRect(0, 0, ow, oh);

        if (greenPixels.length < 10) {
            document.getElementById('camera-status').textContent = 'No markers detected';
            return;
        }

        // Cluster into two markers
        const markers = this.clusterMarkers(greenPixels);
        if (!markers) {
            document.getElementById('camera-status').textContent = 'Need 2 markers visible';
            return;
        }

        // Scale positions from processing canvas to overlay canvas
        const sx = ow / pw;
        const sy = oh / ph;

        // Draw detected markers
        ctx.fillStyle = 'rgba(0, 255, 100, 0.4)';
        [markers.a, markers.b].forEach(m => {
            ctx.beginPath();
            ctx.arc(m.x * sx, m.y * sy, 14, 0, Math.PI * 2);
            ctx.fill();
        });

        // Line between markers
        ctx.strokeStyle = 'rgba(0, 255, 100, 0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(markers.a.x * sx, markers.a.y * sy);
        ctx.lineTo(markers.b.x * sx, markers.b.y * sy);
        ctx.stroke();
        ctx.setLineDash([]);

        // Pixel distance between marker centroids
        const pixelDist = Math.hypot(markers.a.x - markers.b.x, markers.a.y - markers.b.y);
        this.lastPixelSeparation = pixelDist;

        // Pinhole model: distance = (real_size * focal_length) / pixel_size
        const distanceMM = (this.markerSeparationMM * this.focalLengthPx) / pixelDist;
        const distanceCm = distanceMM / 10;

        // Smooth the reading
        this.distanceHistory.push(distanceCm);
        if (this.distanceHistory.length > this.smoothingWindow) this.distanceHistory.shift();
        const smoothed = this.distanceHistory.reduce((a, b) => a + b, 0) / this.distanceHistory.length;
        const roundedCm = Math.round(smoothed);

        // Update readout
        document.getElementById('camera-status').textContent = `Distance: ${roundedCm} cm`;

        // Drive the slider if value is within range
        const slider = document.getElementById('standard-distance-slider');
        const lo = parseInt(slider.min);
        const hi = parseInt(slider.max);
        const clamped = Math.max(lo, Math.min(hi, roundedCm));
        if (parseInt(slider.value) !== clamped) {
            slider.value = clamped;
            document.getElementById('standard-distance-value').textContent = clamped + ' cm';
            renderStandardTestType(clamped);
        }
    },

    // Split green pixels into two spatial clusters
    clusterMarkers(pixels) {
        pixels.sort((a, b) => a.x - b.x);

        // Find the largest horizontal gap
        let maxGap = 0, gapIdx = 0;
        for (let i = 1; i < pixels.length; i++) {
            const gap = pixels[i].x - pixels[i - 1].x;
            if (gap > maxGap) { maxGap = gap; gapIdx = i; }
        }

        // Gap must be meaningful (>5% of frame width)
        if (maxGap < this.procCanvas.width * 0.05) return null;

        const groupA = pixels.slice(0, gapIdx);
        const groupB = pixels.slice(gapIdx);
        if (groupA.length < 5 || groupB.length < 5) return null;

        const centroid = (arr) => ({
            x: arr.reduce((s, p) => s + p.x, 0) / arr.length,
            y: arr.reduce((s, p) => s + p.y, 0) / arr.length
        });

        return { a: centroid(groupA), b: centroid(groupB) };
    },

    // One-shot calibration: place markers at a known distance
    calibrate(knownDistanceCm) {
        if (!this.lastPixelSeparation || this.lastPixelSeparation < 1) return false;

        // focal_length = pixel_separation * distance_mm / real_separation_mm
        this.focalLengthPx = this.lastPixelSeparation * (knownDistanceCm * 10) / this.markerSeparationMM;
        this.distanceHistory = [];
        this.saveSettings();
        return true;
    },

    // Fast inline HSV-ish check for bright green
    isTargetColor(r, g, b) {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;

        // Value check (brightness)
        if (max < 77) return false; // ~30% of 255

        // Saturation check
        if (max === 0 || d / max < 0.30) return false;

        // Hue check — only compute if we passed sat/val
        let h;
        if (d === 0) return false;
        if (max === r) h = 60 * (((g - b) / d) % 6);
        else if (max === g) h = 60 * ((b - r) / d + 2);
        else h = 60 * ((r - g) / d + 4);
        if (h < 0) h += 360;

        return h >= this.hueMin && h <= this.hueMax;
    },

    saveSettings() {
        localStorage.setItem('nearpoint_camera', JSON.stringify({
            focalLengthPx: this.focalLengthPx,
            markerSeparationMM: this.markerSeparationMM
        }));
    },

    loadSettings() {
        const saved = localStorage.getItem('nearpoint_camera');
        if (saved) {
            const data = JSON.parse(saved);
            if (data.focalLengthPx) this.focalLengthPx = data.focalLengthPx;
            if (data.markerSeparationMM) this.markerSeparationMM = data.markerSeparationMM;
        }
    }
};
