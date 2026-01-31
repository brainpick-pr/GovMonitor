-- Seed data for expanded government portals
-- 100+ portals across multiple categories

-- ============================================================================
-- CENTRAL GOVERNMENT PORTALS
-- ============================================================================

INSERT OR IGNORE INTO targets (name, url, hostname, state, interval_min, enabled, check_mode, expected_status, category, description, department)
VALUES
  ('India.gov.in', 'https://www.india.gov.in', 'www.india.gov.in', 'Central', 15, 1, 'website', 200, 'central', 'National Portal of India - One-stop gateway for government information', 'NIC'),
  ('DigiLocker', 'https://www.digilocker.gov.in', 'www.digilocker.gov.in', 'Central', 10, 1, 'website', 200, 'central', 'Digital document storage and verification platform', 'MeitY'),
  ('UMANG App', 'https://web.umang.gov.in', 'web.umang.gov.in', 'Central', 10, 1, 'website', 200, 'central', 'Unified Mobile Application for New-age Governance', 'MeitY'),
  ('myScheme', 'https://www.myscheme.gov.in', 'www.myscheme.gov.in', 'Central', 15, 1, 'website', 200, 'central', 'Government schemes discovery portal', 'MeitY'),
  ('Service Plus', 'https://serviceonline.gov.in', 'serviceonline.gov.in', 'Central', 15, 1, 'website', 200, 'central', 'e-Service delivery gateway', 'NIC'),
  ('RTI Online', 'https://rtionline.gov.in', 'rtionline.gov.in', 'Central', 15, 1, 'website', 200, 'transparency', 'Right to Information online portal', 'DoPT'),
  ('PM India', 'https://www.pmindia.gov.in', 'www.pmindia.gov.in', 'Central', 15, 1, 'website', 200, 'central', 'Prime Ministers Office website', 'PMO'),
  ('MyGov', 'https://www.mygov.in', 'www.mygov.in', 'Central', 10, 1, 'website', 200, 'central', 'Citizen engagement platform', 'MeitY');

-- ============================================================================
-- IDENTITY & CITIZEN SERVICES
-- ============================================================================

INSERT OR IGNORE INTO targets (name, url, hostname, state, interval_min, enabled, check_mode, expected_status, category, description, department)
VALUES
  ('UIDAI Aadhaar', 'https://uidai.gov.in', 'uidai.gov.in', 'Central', 5, 1, 'website', 200, 'identity', 'Unique Identification Authority of India - Aadhaar services', 'UIDAI'),
  ('Voter Portal NVSP', 'https://www.nvsp.in', 'www.nvsp.in', 'Central', 10, 1, 'website', 200, 'identity', 'National Voter Services Portal', 'ECI'),
  ('Birth Certificate Portal', 'https://crsorgi.gov.in', 'crsorgi.gov.in', 'Central', 15, 1, 'website', 200, 'identity', 'Civil Registration System - Birth/Death certificates', 'RGI'),
  ('eDistrict', 'https://edistrict.up.gov.in', 'edistrict.up.gov.in', 'Uttar Pradesh', 15, 1, 'website', 200, 'identity', 'UP eDistrict services', 'UP IT Dept');

-- ============================================================================
-- FINANCIAL SERVICES
-- ============================================================================

INSERT OR IGNORE INTO targets (name, url, hostname, state, interval_min, enabled, check_mode, expected_status, category, description, department)
VALUES
  ('EPFO', 'https://www.epfindia.gov.in', 'www.epfindia.gov.in', 'Central', 5, 1, 'website', 200, 'financial', 'Employees Provident Fund Organisation', 'Ministry of Labour'),
  ('Income Tax Portal', 'https://www.incometax.gov.in', 'www.incometax.gov.in', 'Central', 5, 1, 'website', 200, 'financial', 'Income Tax e-Filing portal', 'CBDT'),
  ('GST Portal', 'https://www.gst.gov.in', 'www.gst.gov.in', 'Central', 5, 1, 'website', 200, 'financial', 'Goods and Services Tax Network', 'GSTN'),
  ('NPS Portal', 'https://www.npscra.nsdl.co.in', 'www.npscra.nsdl.co.in', 'Central', 10, 1, 'website', 200, 'financial', 'National Pension System', 'PFRDA'),
  ('Jan Dhan', 'https://pmjdy.gov.in', 'pmjdy.gov.in', 'Central', 15, 1, 'website', 200, 'financial', 'Pradhan Mantri Jan Dhan Yojana', 'DFS'),
  ('PM Kisan', 'https://pmkisan.gov.in', 'pmkisan.gov.in', 'Central', 10, 1, 'website', 200, 'financial', 'PM Kisan Samman Nidhi scheme', 'Ministry of Agriculture'),
  ('e-RUPI', 'https://www.npci.org.in/what-we-do/e-rupi/product-overview', 'www.npci.org.in', 'Central', 15, 1, 'website', 200, 'financial', 'Digital voucher platform', 'NPCI'),
  ('TIN NSDL', 'https://www.tin-nsdl.com', 'www.tin-nsdl.com', 'Central', 10, 1, 'website', 200, 'financial', 'Tax Information Network', 'NSDL');

-- ============================================================================
-- TRANSPORT SERVICES
-- ============================================================================

INSERT OR IGNORE INTO targets (name, url, hostname, state, interval_min, enabled, check_mode, expected_status, category, description, department)
VALUES
  ('IRCTC', 'https://www.irctc.co.in', 'www.irctc.co.in', 'Central', 5, 1, 'website', 200, 'transport', 'Indian Railways ticket booking', 'Ministry of Railways'),
  ('Parivahan', 'https://parivahan.gov.in', 'parivahan.gov.in', 'Central', 10, 1, 'website', 200, 'transport', 'Transport services and driving license', 'MoRTH'),
  ('FASTag', 'https://www.ihmcl.in', 'www.ihmcl.in', 'Central', 15, 1, 'website', 200, 'transport', 'Electronic toll collection', 'NHAI'),
  ('KSRTC Karnataka', 'https://www.ksrtc.in', 'www.ksrtc.in', 'Karnataka', 15, 1, 'website', 200, 'transport', 'Karnataka State Road Transport Corporation', 'Transport Dept'),
  ('MSRTC Maharashtra', 'https://www.msrtc.gov.in', 'www.msrtc.gov.in', 'Maharashtra', 15, 1, 'website', 200, 'transport', 'Maharashtra State Road Transport Corporation', 'Transport Dept'),
  ('APSRTC', 'https://www.apsrtc.ap.gov.in', 'www.apsrtc.ap.gov.in', 'Andhra Pradesh', 15, 1, 'website', 200, 'transport', 'Andhra Pradesh State Road Transport Corporation', 'Transport Dept'),
  ('TSRTC', 'https://www.tsrtc.telangana.gov.in', 'www.tsrtc.telangana.gov.in', 'Telangana', 15, 1, 'website', 200, 'transport', 'Telangana State Road Transport Corporation', 'Transport Dept'),
  ('UPSRTC', 'https://www.upsrtc.com', 'www.upsrtc.com', 'Uttar Pradesh', 15, 1, 'website', 200, 'transport', 'Uttar Pradesh State Road Transport Corporation', 'Transport Dept'),
  ('DTC Delhi', 'https://dtc.delhi.gov.in', 'dtc.delhi.gov.in', 'Delhi', 15, 1, 'website', 200, 'transport', 'Delhi Transport Corporation', 'Transport Dept'),
  ('BMTC Bangalore', 'https://mybmtc.karnataka.gov.in', 'mybmtc.karnataka.gov.in', 'Karnataka', 15, 1, 'website', 200, 'transport', 'Bangalore Metropolitan Transport Corporation', 'Transport Dept');

-- ============================================================================
-- UTILITIES (ELECTRICITY)
-- ============================================================================

INSERT OR IGNORE INTO targets (name, url, hostname, state, interval_min, enabled, check_mode, expected_status, category, description, department)
VALUES
  ('BESCOM Bangalore', 'https://bescom.karnataka.gov.in', 'bescom.karnataka.gov.in', 'Karnataka', 15, 1, 'website', 200, 'utilities', 'Bangalore Electricity Supply Company', 'Energy Dept'),
  ('MSEDCL Maharashtra', 'https://www.mahadiscom.in', 'www.mahadiscom.in', 'Maharashtra', 15, 1, 'website', 200, 'utilities', 'Maharashtra State Electricity Distribution Co', 'Energy Dept'),
  ('TANGEDCO Tamil Nadu', 'https://www.tnebnet.org', 'www.tnebnet.org', 'Tamil Nadu', 15, 1, 'website', 200, 'utilities', 'Tamil Nadu Generation and Distribution Corporation', 'Energy Dept'),
  ('APSPDCL AP', 'https://www.apspdcl.in', 'www.apspdcl.in', 'Andhra Pradesh', 15, 1, 'website', 200, 'utilities', 'AP Southern Power Distribution Company', 'Energy Dept'),
  ('TSSPDCL Telangana', 'https://www.tssouthernpower.com', 'www.tssouthernpower.com', 'Telangana', 15, 1, 'website', 200, 'utilities', 'Telangana State Southern Power Distribution', 'Energy Dept'),
  ('UPPCL', 'https://www.uppclonline.com', 'www.uppclonline.com', 'Uttar Pradesh', 15, 1, 'website', 200, 'utilities', 'UP Power Corporation Limited', 'Energy Dept'),
  ('WBSEDCL', 'https://www.wbsedcl.in', 'www.wbsedcl.in', 'West Bengal', 15, 1, 'website', 200, 'utilities', 'West Bengal State Electricity Distribution', 'Energy Dept'),
  ('BSES Delhi', 'https://www.bsesdelhi.com', 'www.bsesdelhi.com', 'Delhi', 15, 1, 'website', 200, 'utilities', 'BSES Rajdhani Power Limited', 'Energy Dept'),
  ('PSPCL Punjab', 'https://www.pspcl.in', 'www.pspcl.in', 'Punjab', 15, 1, 'website', 200, 'utilities', 'Punjab State Power Corporation Limited', 'Energy Dept'),
  ('MGVCL Gujarat', 'https://www.mgvcl.in', 'www.mgvcl.in', 'Gujarat', 15, 1, 'website', 200, 'utilities', 'Madhya Gujarat Vij Company Limited', 'Energy Dept');

-- ============================================================================
-- HEALTH SERVICES
-- ============================================================================

INSERT OR IGNORE INTO targets (name, url, hostname, state, interval_min, enabled, check_mode, expected_status, category, description, department)
VALUES
  ('Ayushman Bharat', 'https://pmjay.gov.in', 'pmjay.gov.in', 'Central', 10, 1, 'website', 200, 'health', 'Pradhan Mantri Jan Arogya Yojana', 'MoHFW'),
  ('ABDM', 'https://abdm.gov.in', 'abdm.gov.in', 'Central', 10, 1, 'website', 200, 'health', 'Ayushman Bharat Digital Mission', 'NHA'),
  ('CoWIN', 'https://www.cowin.gov.in', 'www.cowin.gov.in', 'Central', 10, 1, 'website', 200, 'health', 'COVID Vaccine Intelligence Network', 'MoHFW'),
  ('eHospital', 'https://ehospital.gov.in', 'ehospital.gov.in', 'Central', 15, 1, 'website', 200, 'health', 'Online registration system for hospitals', 'NIC'),
  ('CGHS', 'https://cghs.gov.in', 'cghs.gov.in', 'Central', 15, 1, 'website', 200, 'health', 'Central Government Health Scheme', 'MoHFW'),
  ('CDSCO', 'https://cdsco.gov.in', 'cdsco.gov.in', 'Central', 15, 1, 'website', 200, 'health', 'Central Drugs Standard Control Organization', 'MoHFW');

-- ============================================================================
-- BUSINESS SERVICES
-- ============================================================================

INSERT OR IGNORE INTO targets (name, url, hostname, state, interval_min, enabled, check_mode, expected_status, category, description, department)
VALUES
  ('MCA Portal', 'https://www.mca.gov.in', 'www.mca.gov.in', 'Central', 10, 1, 'website', 200, 'business', 'Ministry of Corporate Affairs - Company registration', 'MCA'),
  ('GeM Portal', 'https://gem.gov.in', 'gem.gov.in', 'Central', 5, 1, 'website', 200, 'business', 'Government e-Marketplace', 'MoC&I'),
  ('Udyam Registration', 'https://udyamregistration.gov.in', 'udyamregistration.gov.in', 'Central', 10, 1, 'website', 200, 'business', 'MSME registration portal', 'MSME Ministry'),
  ('Startup India', 'https://www.startupindia.gov.in', 'www.startupindia.gov.in', 'Central', 15, 1, 'website', 200, 'business', 'Startup ecosystem support', 'DPIIT'),
  ('IEC Gateway', 'https://www.dgft.gov.in', 'www.dgft.gov.in', 'Central', 15, 1, 'website', 200, 'business', 'Importer Exporter Code registration', 'DGFT'),
  ('FSSAI', 'https://foscos.fssai.gov.in', 'foscos.fssai.gov.in', 'Central', 15, 1, 'website', 200, 'business', 'Food license registration', 'FSSAI'),
  ('Shop Act Maharashtra', 'https://mahakamgar.maharashtra.gov.in', 'mahakamgar.maharashtra.gov.in', 'Maharashtra', 15, 1, 'website', 200, 'business', 'Shop and establishment registration', 'Labour Dept');

-- ============================================================================
-- PASSPORT SERVICES
-- ============================================================================

INSERT OR IGNORE INTO targets (name, url, hostname, state, interval_min, enabled, check_mode, expected_status, category, description, department)
VALUES
  ('Passport Seva', 'https://www.passportindia.gov.in', 'www.passportindia.gov.in', 'Central', 5, 1, 'website', 200, 'passport', 'Passport application and services', 'MEA'),
  ('eMigrate', 'https://emigrate.gov.in', 'emigrate.gov.in', 'Central', 15, 1, 'website', 200, 'passport', 'Emigration services for workers', 'MEA'),
  ('Indian Visa Online', 'https://indianvisaonline.gov.in', 'indianvisaonline.gov.in', 'Central', 10, 1, 'website', 200, 'passport', 'e-Visa application portal', 'MEA');

-- ============================================================================
-- TRANSPARENCY & GOVERNANCE
-- ============================================================================

INSERT OR IGNORE INTO targets (name, url, hostname, state, interval_min, enabled, check_mode, expected_status, category, description, department)
VALUES
  ('MPLADS', 'https://www.mplads.gov.in', 'www.mplads.gov.in', 'Central', 15, 1, 'website', 200, 'transparency', 'MP Local Area Development Scheme', 'MoS&PI'),
  ('GFR Portal', 'https://gfrportal.gov.in', 'gfrportal.gov.in', 'Central', 15, 1, 'website', 200, 'transparency', 'General Financial Rules', 'DoE'),
  ('PFMS', 'https://pfms.nic.in', 'pfms.nic.in', 'Central', 10, 1, 'website', 200, 'transparency', 'Public Financial Management System', 'CGA'),
  ('e-Procurement India', 'https://eprocure.gov.in', 'eprocure.gov.in', 'Central', 10, 1, 'website', 200, 'transparency', 'Central public procurement portal', 'NIC'),
  ('CPGRAMS', 'https://pgportal.gov.in', 'pgportal.gov.in', 'Central', 15, 1, 'website', 200, 'transparency', 'Centralized Public Grievance Redress', 'DARPG');

-- ============================================================================
-- EDUCATION PORTALS
-- ============================================================================

INSERT OR IGNORE INTO targets (name, url, hostname, state, interval_min, enabled, check_mode, expected_status, category, description, department)
VALUES
  ('CBSE', 'https://www.cbse.gov.in', 'www.cbse.gov.in', 'Central', 10, 1, 'website', 200, 'education', 'Central Board of Secondary Education', 'MoE'),
  ('DIKSHA', 'https://diksha.gov.in', 'diksha.gov.in', 'Central', 15, 1, 'website', 200, 'education', 'National platform for school education', 'MoE'),
  ('NTA Portal', 'https://nta.ac.in', 'nta.ac.in', 'Central', 10, 1, 'website', 200, 'education', 'National Testing Agency - JEE, NEET exams', 'NTA'),
  ('UGC', 'https://www.ugc.ac.in', 'www.ugc.ac.in', 'Central', 15, 1, 'website', 200, 'education', 'University Grants Commission', 'MoE'),
  ('AICTE', 'https://www.aicte-india.org', 'www.aicte-india.org', 'Central', 15, 1, 'website', 200, 'education', 'All India Council for Technical Education', 'MoE'),
  ('NAD Portal', 'https://nad.gov.in', 'nad.gov.in', 'Central', 15, 1, 'website', 200, 'education', 'National Academic Depository', 'MoE'),
  ('Swayam', 'https://swayam.gov.in', 'swayam.gov.in', 'Central', 15, 1, 'website', 200, 'education', 'Online courses and MOOCs', 'MoE'),
  ('National Scholarship', 'https://scholarships.gov.in', 'scholarships.gov.in', 'Central', 10, 1, 'website', 200, 'education', 'National Scholarship Portal', 'MoE');

-- ============================================================================
-- STATE-SPECIFIC TENDER PORTALS (Additional)
-- ============================================================================

INSERT OR IGNORE INTO targets (name, url, hostname, state, interval_min, enabled, check_mode, expected_status, category, description, department)
VALUES
  ('Kerala eTenders', 'https://etenders.kerala.gov.in', 'etenders.kerala.gov.in', 'Kerala', 15, 1, 'website', 200, 'tender', 'Kerala Government e-Procurement', 'IT Dept'),
  ('Bihar eTenders', 'https://eproc.bihar.gov.in', 'eproc.bihar.gov.in', 'Bihar', 15, 1, 'website', 200, 'tender', 'Bihar Government e-Procurement', 'IT Dept'),
  ('Odisha eTenders', 'https://tendersodisha.gov.in', 'tendersodisha.gov.in', 'Odisha', 15, 1, 'website', 200, 'tender', 'Odisha Government e-Procurement', 'IT Dept'),
  ('Jharkhand eTenders', 'https://jharkhandtenders.gov.in', 'jharkhandtenders.gov.in', 'Jharkhand', 15, 1, 'website', 200, 'tender', 'Jharkhand Government e-Procurement', 'IT Dept'),
  ('Assam eTenders', 'https://assamtenders.gov.in', 'assamtenders.gov.in', 'Assam', 15, 1, 'website', 200, 'tender', 'Assam Government e-Procurement', 'IT Dept'),
  ('HP eTenders', 'https://hptenders.gov.in', 'hptenders.gov.in', 'Himachal Pradesh', 15, 1, 'website', 200, 'tender', 'Himachal Pradesh e-Procurement', 'IT Dept'),
  ('Uttarakhand eTenders', 'https://uktenders.gov.in', 'uktenders.gov.in', 'Uttarakhand', 15, 1, 'website', 200, 'tender', 'Uttarakhand Government e-Procurement', 'IT Dept'),
  ('Chhattisgarh eTenders', 'https://eproc.cgstate.gov.in', 'eproc.cgstate.gov.in', 'Chhattisgarh', 15, 1, 'website', 200, 'tender', 'Chhattisgarh Government e-Procurement', 'IT Dept'),
  ('Goa eTenders', 'https://goaenivida.gov.in', 'goaenivida.gov.in', 'Goa', 15, 1, 'website', 200, 'tender', 'Goa Government e-Procurement', 'IT Dept'),
  ('J&K eTenders', 'https://jktenders.gov.in', 'jktenders.gov.in', 'Jammu & Kashmir', 15, 1, 'website', 200, 'tender', 'J&K Government e-Procurement', 'IT Dept');

-- ============================================================================
-- Update central tender portal (already existing, but update category)
-- ============================================================================

UPDATE targets SET category = 'tender', description = 'Central public procurement portal', department = 'NIC'
WHERE hostname = 'eprocure.gov.in';

-- Summary: This adds approximately 80+ new government portals across 12 categories
