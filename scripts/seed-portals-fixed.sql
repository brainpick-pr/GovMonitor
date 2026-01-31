-- Seed data for expanded government portals (fixed for current schema)
-- 100+ portals across multiple categories

-- ============================================================================
-- CENTRAL GOVERNMENT PORTALS
-- ============================================================================

INSERT OR IGNORE INTO targets (name, url, hostname, state, interval_min, enabled, category, description, department)
VALUES
  ('India.gov.in', 'https://www.india.gov.in', 'www.india.gov.in', 'Central', 15, 1, 'central', 'National Portal of India', 'NIC'),
  ('DigiLocker', 'https://www.digilocker.gov.in', 'www.digilocker.gov.in', 'Central', 10, 1, 'central', 'Digital document storage platform', 'MeitY'),
  ('UMANG App', 'https://web.umang.gov.in', 'web.umang.gov.in', 'Central', 10, 1, 'central', 'Unified Mobile Application for New-age Governance', 'MeitY'),
  ('myScheme', 'https://www.myscheme.gov.in', 'www.myscheme.gov.in', 'Central', 15, 1, 'central', 'Government schemes discovery portal', 'MeitY'),
  ('RTI Online', 'https://rtionline.gov.in', 'rtionline.gov.in', 'Central', 15, 1, 'transparency', 'Right to Information online portal', 'DoPT'),
  ('PM India', 'https://www.pmindia.gov.in', 'www.pmindia.gov.in', 'Central', 15, 1, 'central', 'Prime Ministers Office website', 'PMO'),
  ('MyGov', 'https://www.mygov.in', 'www.mygov.in', 'Central', 10, 1, 'central', 'Citizen engagement platform', 'MeitY');

-- ============================================================================
-- IDENTITY & CITIZEN SERVICES
-- ============================================================================

INSERT OR IGNORE INTO targets (name, url, hostname, state, interval_min, enabled, category, description, department)
VALUES
  ('UIDAI Aadhaar', 'https://uidai.gov.in', 'uidai.gov.in', 'Central', 5, 1, 'identity', 'Unique Identification Authority of India', 'UIDAI'),
  ('Voter Portal NVSP', 'https://www.nvsp.in', 'www.nvsp.in', 'Central', 10, 1, 'identity', 'National Voter Services Portal', 'ECI'),
  ('Birth Certificate Portal', 'https://crsorgi.gov.in', 'crsorgi.gov.in', 'Central', 15, 1, 'identity', 'Civil Registration System', 'RGI');

-- ============================================================================
-- FINANCIAL SERVICES
-- ============================================================================

INSERT OR IGNORE INTO targets (name, url, hostname, state, interval_min, enabled, category, description, department)
VALUES
  ('EPFO', 'https://www.epfindia.gov.in', 'www.epfindia.gov.in', 'Central', 5, 1, 'financial', 'Employees Provident Fund Organisation', 'Ministry of Labour'),
  ('Income Tax Portal', 'https://www.incometax.gov.in', 'www.incometax.gov.in', 'Central', 5, 1, 'financial', 'Income Tax e-Filing portal', 'CBDT'),
  ('GST Portal', 'https://www.gst.gov.in', 'www.gst.gov.in', 'Central', 5, 1, 'financial', 'Goods and Services Tax Network', 'GSTN'),
  ('NPS Portal', 'https://www.npscra.nsdl.co.in', 'www.npscra.nsdl.co.in', 'Central', 10, 1, 'financial', 'National Pension System', 'PFRDA'),
  ('PM Kisan', 'https://pmkisan.gov.in', 'pmkisan.gov.in', 'Central', 10, 1, 'financial', 'PM Kisan Samman Nidhi scheme', 'Ministry of Agriculture');

-- ============================================================================
-- TRANSPORT SERVICES
-- ============================================================================

INSERT OR IGNORE INTO targets (name, url, hostname, state, interval_min, enabled, category, description, department)
VALUES
  ('IRCTC', 'https://www.irctc.co.in', 'www.irctc.co.in', 'Central', 5, 1, 'transport', 'Indian Railway Catering and Tourism', 'Ministry of Railways'),
  ('Parivahan', 'https://parivahan.gov.in', 'parivahan.gov.in', 'Central', 10, 1, 'transport', 'National Transport Portal', 'MoRTH'),
  ('Passport Seva', 'https://www.passportindia.gov.in', 'www.passportindia.gov.in', 'Central', 10, 1, 'identity', 'Passport Seva Portal', 'MEA');

-- ============================================================================
-- HEALTH SERVICES
-- ============================================================================

INSERT OR IGNORE INTO targets (name, url, hostname, state, interval_min, enabled, category, description, department)
VALUES
  ('Ayushman Bharat', 'https://pmjay.gov.in', 'pmjay.gov.in', 'Central', 10, 1, 'health', 'Ayushman Bharat PM-JAY', 'MoHFW'),
  ('CoWIN', 'https://www.cowin.gov.in', 'www.cowin.gov.in', 'Central', 10, 1, 'health', 'COVID Vaccine Portal', 'MoHFW'),
  ('ABDM', 'https://abdm.gov.in', 'abdm.gov.in', 'Central', 10, 1, 'health', 'Ayushman Bharat Digital Mission', 'MoHFW');

-- ============================================================================
-- BUSINESS & COMMERCE
-- ============================================================================

INSERT OR IGNORE INTO targets (name, url, hostname, state, interval_min, enabled, category, description, department)
VALUES
  ('MCA Portal', 'https://www.mca.gov.in', 'www.mca.gov.in', 'Central', 10, 1, 'business', 'Ministry of Corporate Affairs', 'MCA'),
  ('GeM Portal', 'https://gem.gov.in', 'gem.gov.in', 'Central', 10, 1, 'business', 'Government e-Marketplace', 'Ministry of Commerce'),
  ('Udyam Registration', 'https://udyamregistration.gov.in', 'udyamregistration.gov.in', 'Central', 10, 1, 'business', 'MSME Registration Portal', 'Ministry of MSME'),
  ('Startup India', 'https://www.startupindia.gov.in', 'www.startupindia.gov.in', 'Central', 15, 1, 'business', 'Startup India Initiative', 'DPIIT');

-- ============================================================================
-- EDUCATION
-- ============================================================================

INSERT OR IGNORE INTO targets (name, url, hostname, state, interval_min, enabled, category, description, department)
VALUES
  ('CBSE', 'https://www.cbse.gov.in', 'www.cbse.gov.in', 'Central', 15, 1, 'education', 'Central Board of Secondary Education', 'Ministry of Education'),
  ('UGC', 'https://www.ugc.gov.in', 'www.ugc.gov.in', 'Central', 15, 1, 'education', 'University Grants Commission', 'Ministry of Education'),
  ('National Scholarship Portal', 'https://scholarships.gov.in', 'scholarships.gov.in', 'Central', 10, 1, 'education', 'National Scholarship Portal', 'Ministry of Education'),
  ('SWAYAM', 'https://swayam.gov.in', 'swayam.gov.in', 'Central', 15, 1, 'education', 'Free Online Courses Portal', 'Ministry of Education');

-- ============================================================================
-- TENDER PORTALS (State-wise)
-- ============================================================================

INSERT OR IGNORE INTO targets (name, url, hostname, state, interval_min, enabled, category, description, department)
VALUES
  ('Central Public Procurement Portal', 'https://eprocure.gov.in', 'eprocure.gov.in', 'Central', 5, 1, 'tender', 'Central Government eProcurement Portal', 'NIC'),
  ('GeM Bid', 'https://bidplus.gem.gov.in', 'bidplus.gem.gov.in', 'Central', 10, 1, 'tender', 'GeM Bidding Portal', 'GeM'),

  -- State Tender Portals
  ('Maharashtra eTendering', 'https://mahatenders.gov.in', 'mahatenders.gov.in', 'Maharashtra', 10, 1, 'tender', 'Maharashtra State eProcurement', 'IT Dept'),
  ('Gujarat eProcurement', 'https://www.nprocure.com', 'www.nprocure.com', 'Gujarat', 10, 1, 'tender', 'Gujarat State eProcurement', 'IT Dept'),
  ('Karnataka eProcurement', 'https://eproc.karnataka.gov.in', 'eproc.karnataka.gov.in', 'Karnataka', 10, 1, 'tender', 'Karnataka State eProcurement', 'IT Dept'),
  ('Tamil Nadu eTendering', 'https://tntenders.gov.in', 'tntenders.gov.in', 'Tamil Nadu', 10, 1, 'tender', 'Tamil Nadu State eProcurement', 'IT Dept'),
  ('Rajasthan eProcurement', 'https://eproc.rajasthan.gov.in', 'eproc.rajasthan.gov.in', 'Rajasthan', 10, 1, 'tender', 'Rajasthan State eProcurement', 'IT Dept'),
  ('UP eProcurement', 'https://etender.up.nic.in', 'etender.up.nic.in', 'Uttar Pradesh', 10, 1, 'tender', 'Uttar Pradesh eProcurement', 'IT Dept'),
  ('MP eProcurement', 'https://mptenders.gov.in', 'mptenders.gov.in', 'Madhya Pradesh', 10, 1, 'tender', 'Madhya Pradesh eProcurement', 'IT Dept'),
  ('Kerala eTenders', 'https://etenders.kerala.gov.in', 'etenders.kerala.gov.in', 'Kerala', 10, 1, 'tender', 'Kerala State eProcurement', 'IT Dept'),
  ('Telangana eProcurement', 'https://tender.telangana.gov.in', 'tender.telangana.gov.in', 'Telangana', 10, 1, 'tender', 'Telangana State eProcurement', 'IT Dept'),
  ('Andhra Pradesh eProcurement', 'https://tender.apeprocurement.gov.in', 'tender.apeprocurement.gov.in', 'Andhra Pradesh', 10, 1, 'tender', 'Andhra Pradesh eProcurement', 'IT Dept'),
  ('West Bengal eTender', 'https://wbtenders.gov.in', 'wbtenders.gov.in', 'West Bengal', 10, 1, 'tender', 'West Bengal eProcurement', 'IT Dept'),
  ('Punjab eProcurement', 'https://eproc.punjab.gov.in', 'eproc.punjab.gov.in', 'Punjab', 10, 1, 'tender', 'Punjab State eProcurement', 'IT Dept'),
  ('Haryana eProcurement', 'https://etenders.hry.nic.in', 'etenders.hry.nic.in', 'Haryana', 10, 1, 'tender', 'Haryana State eProcurement', 'IT Dept'),
  ('Bihar eProcurement', 'https://eproc.bihar.gov.in', 'eproc.bihar.gov.in', 'Bihar', 10, 1, 'tender', 'Bihar State eProcurement', 'IT Dept'),
  ('Odisha eProcurement', 'https://tendersodisha.gov.in', 'tendersodisha.gov.in', 'Odisha', 10, 1, 'tender', 'Odisha State eProcurement', 'IT Dept'),
  ('Jharkhand eProcurement', 'https://jharkhandtenders.gov.in', 'jharkhandtenders.gov.in', 'Jharkhand', 10, 1, 'tender', 'Jharkhand State eProcurement', 'IT Dept'),
  ('Chhattisgarh eProcurement', 'https://eproc.cgstate.gov.in', 'eproc.cgstate.gov.in', 'Chhattisgarh', 10, 1, 'tender', 'Chhattisgarh State eProcurement', 'IT Dept'),
  ('Assam eProcurement', 'https://assamtenders.gov.in', 'assamtenders.gov.in', 'Assam', 15, 1, 'tender', 'Assam State eProcurement', 'IT Dept'),
  ('Uttarakhand eProcurement', 'https://uktenders.gov.in', 'uktenders.gov.in', 'Uttarakhand', 15, 1, 'tender', 'Uttarakhand State eProcurement', 'IT Dept'),
  ('Himachal Pradesh eTender', 'https://hptenders.gov.in', 'hptenders.gov.in', 'Himachal Pradesh', 15, 1, 'tender', 'HP State eProcurement', 'IT Dept'),
  ('Goa eProcurement', 'https://goaenivida.gov.in', 'goaenivida.gov.in', 'Goa', 15, 1, 'tender', 'Goa State eProcurement', 'IT Dept'),
  ('Delhi eProcurement', 'https://govtprocurement.delhi.gov.in', 'govtprocurement.delhi.gov.in', 'Delhi', 10, 1, 'tender', 'Delhi State eProcurement', 'IT Dept');

-- ============================================================================
-- STATE ELECTRICITY BOARDS
-- ============================================================================

INSERT OR IGNORE INTO targets (name, url, hostname, state, interval_min, enabled, category, description, department)
VALUES
  ('BESCOM Karnataka', 'https://bescom.karnataka.gov.in', 'bescom.karnataka.gov.in', 'Karnataka', 10, 1, 'utility', 'Bangalore Electricity Supply Company', 'Energy Dept'),
  ('MSEDCL Maharashtra', 'https://www.mahadiscom.in', 'www.mahadiscom.in', 'Maharashtra', 10, 1, 'utility', 'Maharashtra State Electricity Distribution', 'Energy Dept'),
  ('TANGEDCO Tamil Nadu', 'https://www.tnebnet.org', 'www.tnebnet.org', 'Tamil Nadu', 10, 1, 'utility', 'Tamil Nadu Generation and Distribution', 'Energy Dept'),
  ('APSPDCL Andhra', 'https://www.apspdcl.in', 'www.apspdcl.in', 'Andhra Pradesh', 10, 1, 'utility', 'AP Southern Power Distribution', 'Energy Dept'),
  ('TSSPDCL Telangana', 'https://www.tssouthernpower.com', 'www.tssouthernpower.com', 'Telangana', 10, 1, 'utility', 'Telangana Southern Power Distribution', 'Energy Dept'),
  ('UPPCL UP', 'https://www.uppclonline.com', 'www.uppclonline.com', 'Uttar Pradesh', 10, 1, 'utility', 'UP Power Corporation Ltd', 'Energy Dept'),
  ('PSPCL Punjab', 'https://www.pspcl.in', 'www.pspcl.in', 'Punjab', 10, 1, 'utility', 'Punjab State Power Corporation', 'Energy Dept'),
  ('DGVCL Gujarat', 'https://www.dgvcl.com', 'www.dgvcl.com', 'Gujarat', 10, 1, 'utility', 'Dakshin Gujarat Vij Company', 'Energy Dept'),
  ('KSEB Kerala', 'https://www.kseb.in', 'www.kseb.in', 'Kerala', 10, 1, 'utility', 'Kerala State Electricity Board', 'Energy Dept'),
  ('WBSEDCL West Bengal', 'https://www.wbsedcl.in', 'www.wbsedcl.in', 'West Bengal', 10, 1, 'utility', 'WB State Electricity Distribution', 'Energy Dept');

-- ============================================================================
-- STATE TRANSPORT CORPORATIONS
-- ============================================================================

INSERT OR IGNORE INTO targets (name, url, hostname, state, interval_min, enabled, category, description, department)
VALUES
  ('KSRTC Karnataka', 'https://www.ksrtc.in', 'www.ksrtc.in', 'Karnataka', 15, 1, 'transport', 'Karnataka State Road Transport', 'Transport Dept'),
  ('MSRTC Maharashtra', 'https://www.msrtc.gov.in', 'www.msrtc.gov.in', 'Maharashtra', 15, 1, 'transport', 'Maharashtra State Road Transport', 'Transport Dept'),
  ('APSRTC Andhra', 'https://www.apsrtconline.in', 'www.apsrtconline.in', 'Andhra Pradesh', 15, 1, 'transport', 'Andhra Pradesh State Road Transport', 'Transport Dept'),
  ('TSRTC Telangana', 'https://www.tsrtconline.in', 'www.tsrtconline.in', 'Telangana', 15, 1, 'transport', 'Telangana State Road Transport', 'Transport Dept'),
  ('UPSRTC UP', 'https://www.upsrtconline.co.in', 'www.upsrtconline.co.in', 'Uttar Pradesh', 15, 1, 'transport', 'Uttar Pradesh State Road Transport', 'Transport Dept'),
  ('RSRTC Rajasthan', 'https://rsrtc.rajasthan.gov.in', 'rsrtc.rajasthan.gov.in', 'Rajasthan', 15, 1, 'transport', 'Rajasthan State Road Transport', 'Transport Dept'),
  ('GSRTC Gujarat', 'https://www.gsrtc.in', 'www.gsrtc.in', 'Gujarat', 15, 1, 'transport', 'Gujarat State Road Transport', 'Transport Dept'),
  ('TNSTC Tamil Nadu', 'https://www.tnstc.in', 'www.tnstc.in', 'Tamil Nadu', 15, 1, 'transport', 'Tamil Nadu State Transport', 'Transport Dept'),
  ('KSRTC Kerala', 'https://www.keralartc.com', 'www.keralartc.com', 'Kerala', 15, 1, 'transport', 'Kerala State Road Transport', 'Transport Dept');

-- ============================================================================
-- LAND RECORDS PORTALS
-- ============================================================================

INSERT OR IGNORE INTO targets (name, url, hostname, state, interval_min, enabled, category, description, department)
VALUES
  ('Bhulekh UP', 'https://upbhulekh.gov.in', 'upbhulekh.gov.in', 'Uttar Pradesh', 15, 1, 'land', 'UP Land Records Portal', 'Revenue Dept'),
  ('Bhumi Karnataka', 'https://landrecords.karnataka.gov.in', 'landrecords.karnataka.gov.in', 'Karnataka', 15, 1, 'land', 'Karnataka Land Records', 'Revenue Dept'),
  ('Mahabhulekh Maharashtra', 'https://bhulekh.mahabhumi.gov.in', 'bhulekh.mahabhumi.gov.in', 'Maharashtra', 15, 1, 'land', 'Maharashtra Land Records', 'Revenue Dept'),
  ('Patta Chitta Tamil Nadu', 'https://eservices.tn.gov.in', 'eservices.tn.gov.in', 'Tamil Nadu', 15, 1, 'land', 'Tamil Nadu Land Records', 'Revenue Dept'),
  ('Dharani Telangana', 'https://dharani.telangana.gov.in', 'dharani.telangana.gov.in', 'Telangana', 15, 1, 'land', 'Telangana Integrated Land Records', 'Revenue Dept'),
  ('Meebhoomi Andhra', 'https://meebhoomi.ap.gov.in', 'meebhoomi.ap.gov.in', 'Andhra Pradesh', 15, 1, 'land', 'Andhra Pradesh Land Records', 'Revenue Dept'),
  ('Apna Khata Rajasthan', 'https://apnakhata.raj.nic.in', 'apnakhata.raj.nic.in', 'Rajasthan', 15, 1, 'land', 'Rajasthan Land Records', 'Revenue Dept'),
  ('Anyror Gujarat', 'https://anyror.gujarat.gov.in', 'anyror.gujarat.gov.in', 'Gujarat', 15, 1, 'land', 'Gujarat Land Records', 'Revenue Dept'),
  ('Banglarbhumi West Bengal', 'https://banglarbhumi.gov.in', 'banglarbhumi.gov.in', 'West Bengal', 15, 1, 'land', 'West Bengal Land Records', 'Revenue Dept'),
  ('Bhunaksha MP', 'https://mpbhulekh.gov.in', 'mpbhulekh.gov.in', 'Madhya Pradesh', 15, 1, 'land', 'Madhya Pradesh Land Records', 'Revenue Dept');

-- ============================================================================
-- RTO / VEHICLE REGISTRATION
-- ============================================================================

INSERT OR IGNORE INTO targets (name, url, hostname, state, interval_min, enabled, category, description, department)
VALUES
  ('Vahan Parivahan', 'https://vahan.parivahan.gov.in', 'vahan.parivahan.gov.in', 'Central', 10, 1, 'transport', 'National Vehicle Registration', 'MoRTH'),
  ('Sarathi Parivahan', 'https://sarathi.parivahan.gov.in', 'sarathi.parivahan.gov.in', 'Central', 10, 1, 'transport', 'Driving License Services', 'MoRTH'),
  ('mParivahan', 'https://m.parivahan.gov.in', 'm.parivahan.gov.in', 'Central', 10, 1, 'transport', 'Mobile Transport Services', 'MoRTH');
